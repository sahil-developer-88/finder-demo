import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Create Clover Order - Edge Function
 *
 * Creates a Clover Hosted Checkout session for online payment.
 * Uses the /invoicingcheckoutservice/v1/checkouts endpoint.
 *
 * Flow:
 * 1. Customer places order in Barter app
 * 2. This function creates a Hosted Checkout session in Clover
 * 3. Customer is redirected to Clover's hosted payment page
 * 4. After payment, customer is redirected back to our success page
 * 5. Webhook confirms payment and credits are transferred
 */

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get authenticated user
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);

    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    const { order_id, pos_integration_id } = await req.json();

    if (!order_id) {
      throw new Error('order_id is required');
    }

    console.log('🟫 Create Clover Order Started');
    console.log(`   Order ID: ${order_id}`);
    console.log(`   User ID: ${user.id}`);

    // Step 1: Fetch order with items
    const { data: order, error: orderError } = await supabaseClient
      .from('orders')
      .select(`
        *,
        order_items (*)
      `)
      .eq('id', order_id)
      .single();

    if (orderError || !order) {
      throw new Error(`Order not found: ${orderError?.message || 'Unknown error'}`);
    }

    // Verify the user owns this order
    if (order.customer_id !== user.id) {
      throw new Error('Unauthorized: Not your order');
    }

    console.log(`   Order Number: ${order.order_number}`);
    console.log(`   Merchant ID: ${order.merchant_id}`);
    console.log(`   Items: ${order.order_items?.length || 0}`);
    console.log(`   Barter Amount: $${order.barter_amount}`);
    console.log(`   Cash Amount: $${order.cash_amount}`);

    // Step 2: Get merchant's Clover integration
    let integration;

    if (pos_integration_id) {
      const { data, error } = await supabaseClient
        .from('pos_integrations')
        .select('*')
        .eq('id', pos_integration_id)
        .eq('provider', 'clover')
        .eq('status', 'active')
        .single();

      integration = data;
      if (error) {
        console.log('⚠️ Specified integration not found:', error.message);
      }
    }

    if (!integration) {
      // Auto-detect: Find merchant's active Clover integration
      const { data, error } = await supabaseClient
        .from('pos_integrations')
        .select('*')
        .eq('user_id', order.merchant_id)
        .eq('provider', 'clover')
        .eq('status', 'active')
        .limit(1)
        .single();

      integration = data;
      if (error) {
        console.log('⚠️ No Clover integration found for merchant');
        return new Response(
          JSON.stringify({
            success: true,
            pos_sync_skipped: true,
            reason: 'Merchant does not have an active Clover integration',
            order_id: order_id
          }),
          {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }
    }

    // Clover merchant ID from integration
    const cloverMerchantId = integration.merchant_id || integration.store_id;
    console.log(`   Clover Merchant: ${cloverMerchantId}`);

    if (!cloverMerchantId) {
      throw new Error('Clover merchant ID not found in integration');
    }

    // Decrypt access token if stored encrypted (new merchants post-encryption migration)
    if (integration.access_token_encrypted && integration.encryption_nonce) {
      console.log('🔓 Decrypting Clover access token...');
      const { data: decryptedToken, error: decryptError } = await supabaseClient
        .rpc('decrypt_pos_token', {
          p_encrypted_token: integration.access_token_encrypted,
          p_nonce: integration.encryption_nonce
        });

      if (decryptError || !decryptedToken) {
        console.error('❌ Token decryption failed:', decryptError);
        throw new Error('Failed to decrypt Clover access token');
      }

      integration.access_token = decryptedToken;
      console.log('✅ Token decrypted successfully');
    } else if (!integration.access_token) {
      throw new Error('No Clover access token available');
    } else {
      console.log('ℹ️  Using legacy plaintext token');
    }

    // Clover API URL based on environment
    // OAuth uses: sandbox.dev.clover.com
    // REST API uses: apisandbox.dev.clover.com
    const environment = integration.config?.environment || 'production';
    console.log(`   Environment: ${environment}`);

    // Hosted Checkout API endpoints
    const checkoutBaseUrl = environment === 'sandbox'
      ? 'https://apisandbox.dev.clover.com'
      : 'https://www.clover.com';

    // Step 3: Build line items for Clover Hosted Checkout
    const lineItems = order.order_items.map((item: any) => ({
      name: item.product_name,
      price: Math.round(item.unit_price * 100), // Clover uses cents
      unitQty: item.quantity,
      note: item.product_sku ? `SKU: ${item.product_sku}` : undefined
    }));

    // Add barter discount as a negative line item if applicable
    if (order.barter_amount > 0) {
      lineItems.push({
        name: `Barter Credits Discount (${order.barter_percentage}%)`,
        price: -Math.round(order.barter_amount * 100), // Negative for discount
        unitQty: 1,
        note: `Barter Order #${order.order_number}`
      });
    }

    // Add tax as a line item if applicable
    if (order.tax_amount > 0) {
      lineItems.push({
        name: 'Tax',
        price: Math.round(order.tax_amount * 100),
        unitQty: 1
      });
    }

    console.log(`📦 Creating Clover Hosted Checkout with ${lineItems.length} items`);

    // Step 4: Create Hosted Checkout session
    const redirectUrl = Deno.env.get('FRONTEND_URL') || 'https://app.barterfindr.com';

    // Parse customer name into first/last
    const nameParts = (order.customer_name || '').trim().split(' ');
    const firstName = nameParts[0] || 'Customer';
    const lastName = nameParts.slice(1).join(' ') || '';

    const checkoutPayload = {
      customer: {
        email: order.customer_email || undefined,
        firstName: firstName,
        lastName: lastName || undefined,
        phoneNumber: order.customer_phone || undefined
      },
      shoppingCart: {
        lineItems: lineItems
      },
      redirectUrls: {
        success: `${redirectUrl}/checkout/complete?provider=clover&order_id=${order.id}`,
        failure: `${redirectUrl}/checkout/failed?provider=clover&order_id=${order.id}`
      }
    };

    console.log(`💳 Checkout payload:`, JSON.stringify(checkoutPayload, null, 2));

    const checkoutResponse = await fetch(
      `${checkoutBaseUrl}/invoicingcheckoutservice/v1/checkouts`,
      {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${integration.access_token}`,
          'X-Clover-Merchant-Id': cloverMerchantId
        },
        body: JSON.stringify(checkoutPayload)
      }
    );

    const checkoutData = await checkoutResponse.json();

    let checkoutUrl = null;
    let cloverCheckoutSessionId = null;

    if (checkoutResponse.ok && checkoutData.href) {
      checkoutUrl = checkoutData.href;
      cloverCheckoutSessionId = checkoutData.checkoutSessionId;
      console.log(`✅ Clover Hosted Checkout created!`);
      console.log(`   Checkout URL: ${checkoutUrl}`);
      console.log(`   Session ID: ${cloverCheckoutSessionId}`);
      console.log(`   Expires: ${new Date(checkoutData.expirationTime).toISOString()}`);
    } else {
      const errorMsg = checkoutData.message || checkoutData.error || JSON.stringify(checkoutData);
      console.error(`❌ Clover Hosted Checkout failed (${checkoutResponse.status}): ${errorMsg}`);

      if (checkoutResponse.status === 401 || checkoutResponse.status === 403) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Your Clover integration has expired. Please go to Settings → POS Integration and reconnect Clover.',
            error_code: 'CLOVER_AUTH_EXPIRED'
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({
          success: false,
          error: `Failed to create Clover checkout: ${errorMsg}`
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Step 5: Create POS payment session for tracking
    const { data: sessionData, error: sessionError } = await supabaseClient
      .from('pos_payment_sessions')
      .insert({
        customer_id: order.customer_id,
        merchant_id: order.merchant_id,
        pos_integration_id: integration.id,
        pos_provider: 'clover',
        pos_order_id: cloverCheckoutSessionId,
        total_amount: order.total_amount,
        barter_amount: order.barter_amount,
        barter_percentage: order.barter_percentage,
        cash_amount: order.cash_amount + order.tax_amount,
        session_status: 'discount_applied',
        expires_at: new Date(checkoutData.expirationTime || Date.now() + 15 * 60 * 1000).toISOString()
      })
      .select()
      .single();

    if (sessionError) {
      console.error(`⚠️ Failed to create payment session: ${sessionError.message}`);
    } else {
      console.log(`✅ Payment session created: ${sessionData.id}`);
    }

    // Step 6: Update order with POS tracking info
    const { error: updateError } = await supabaseClient
      .from('orders')
      .update({
        status: 'pending_pos_payment',
        pos_draft_order_id: cloverCheckoutSessionId,
        pos_provider: 'clover',
        pos_integration_id: integration.id,
        metadata: {
          ...order.metadata,
          clover_checkout_session_id: cloverCheckoutSessionId,
          clover_merchant_id: cloverMerchantId,
          checkout_url: checkoutUrl,
          checkout_expires_at: checkoutData.expirationTime,
          pos_synced_at: new Date().toISOString()
        }
      })
      .eq('id', order_id);

    if (updateError) {
      console.error(`⚠️ Failed to update order: ${updateError.message}`);
    } else {
      console.log(`✅ Order updated with POS tracking info`);
    }

    console.log('🎉 Clover checkout creation complete!');

    return new Response(
      JSON.stringify({
        success: true,
        order_id: order_id,
        clover_checkout_session_id: cloverCheckoutSessionId,
        payment_session_id: sessionData?.id,
        amount_to_pay: order.cash_amount + order.tax_amount,
        checkout_url: checkoutUrl,
        pos_provider: 'clover',
        message: 'Redirecting to Clover checkout for payment.'
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error: any) {
    console.error('❌ Error in create-clover-order:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Unknown error occurred'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
