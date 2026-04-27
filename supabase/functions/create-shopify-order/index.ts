import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SHOPIFY_API_VERSION = '2024-01';

/**
 * Create Shopify Order - Edge Function
 *
 * This function creates a Shopify draft order after a customer completes
 * checkout in the Barter app. It:
 * 1. Fetches the order from the database
 * 2. Gets the merchant's Shopify integration
 * 3. Creates a draft order in Shopify with line items
 * 4. Applies the barter discount
 * 5. Updates the order with POS tracking info
 *
 * Flow:
 * - Customer places order in Barter app (barter credits deducted)
 * - This function creates draft order in Shopify
 * - Merchant sees draft order in Shopify POS
 * - Customer pays cash at pickup
 * - Shopify webhook marks order as completed
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

    const {
      order_id,
      pos_integration_id,
      customer_name: body_customer_name,
      customer_email: body_customer_email,
      customer_phone: body_customer_phone,
      delivery_address: body_delivery_address,
      delivery_city: body_delivery_city,
      delivery_state: body_delivery_state,
      delivery_zip: body_delivery_zip,
    } = await req.json();

    if (!order_id) {
      throw new Error('order_id is required');
    }

    console.log('🛒 Create Shopify Order Started');
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

    // Step 2: Get merchant's Shopify integration
    let integration;

    if (pos_integration_id) {
      // Use provided integration ID
      const { data, error } = await supabaseClient
        .from('pos_integrations')
        .select('*')
        .eq('id', pos_integration_id)
        .eq('provider', 'shopify')
        .eq('status', 'active')
        .single();

      integration = data;
      if (error) {
        console.log('⚠️ Specified integration not found:', error.message);
      }
    }

    if (!integration) {
      // Auto-detect: Find merchant's active Shopify integration
      const { data, error } = await supabaseClient
        .from('pos_integrations')
        .select('*')
        .eq('user_id', order.merchant_id)
        .eq('provider', 'shopify')
        .eq('status', 'active')
        .limit(1)
        .single();

      integration = data;
      if (error) {
        console.log('⚠️ No Shopify integration found for merchant');
        // Not an error - merchant might not have Shopify
        return new Response(
          JSON.stringify({
            success: true,
            pos_sync_skipped: true,
            reason: 'Merchant does not have an active Shopify integration',
            order_id: order_id
          }),
          {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }
    }

    console.log(`   Shopify Store: ${integration.store_id}`);

    // Decrypt access token if stored encrypted (new merchants post-encryption migration)
    if (integration.access_token_encrypted && integration.encryption_nonce) {
      console.log('🔓 Decrypting Shopify access token...');
      const { data: decryptedToken, error: decryptError } = await supabaseClient
        .rpc('decrypt_pos_token', {
          p_encrypted_token: integration.access_token_encrypted,
          p_nonce: integration.encryption_nonce
        });

      if (decryptError || !decryptedToken) {
        console.error('❌ Token decryption failed:', decryptError);
        throw new Error('Failed to decrypt Shopify access token');
      }

      integration.access_token = decryptedToken;
      console.log('✅ Token decrypted successfully');
    } else if (!integration.access_token) {
      throw new Error('No Shopify access token available');
    } else {
      console.log('ℹ️  Using legacy plaintext token');
    }

    // Step 3: Check if order items have Shopify variant IDs
    const itemsWithVariants = order.order_items.filter(
      (item: any) => item.external_variant_id
    );

    if (itemsWithVariants.length === 0) {
      console.log('⚠️ No items have Shopify variant IDs');
      return new Response(
        JSON.stringify({
          success: true,
          pos_sync_skipped: true,
          reason: 'Order items do not have Shopify product IDs',
          order_id: order_id
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Step 4: Create Shopify draft order
    const lineItems = itemsWithVariants.map((item: any) => ({
      variant_id: parseInt(item.external_variant_id),
      quantity: item.quantity,
      title: item.product_name,
      price: item.unit_price.toString()
    }));

    console.log(`📦 Creating draft order with ${lineItems.length} items`);

    // Prefer values passed directly in body (always fresh from checkout form)
    const resolvedName    = body_customer_name    || order.customer_name    || '';
    const resolvedEmail   = body_customer_email   || order.customer_email   || '';
    const resolvedPhone   = body_customer_phone   || order.customer_phone   || '';
    const resolvedAddress = body_delivery_address || (order as any).delivery_address || '';
    const resolvedCity    = body_delivery_city    || (order as any).delivery_city    || '';
    const resolvedState   = body_delivery_state   || (order as any).delivery_state   || '';
    const resolvedZip     = body_delivery_zip     || (order as any).delivery_zip     || '';

    // Parse customer name into first/last for Shopify
    const nameParts = resolvedName.trim().split(' ');
    const firstName = nameParts[0] || '';
    const lastName  = nameParts.slice(1).join(' ') || '';

    const shippingAddress = resolvedAddress ? {
      first_name: firstName,
      last_name:  lastName,
      address1:   resolvedAddress,
      city:        resolvedCity,
      province:    resolvedState,
      zip:         resolvedZip,
      country:     'US',
      phone:       resolvedPhone,
    } : undefined;

    const draftOrderPayload = {
      draft_order: {
        line_items: lineItems,
        note: `Barter App Order #${order.order_number}\nCustomer: ${resolvedName}\nBarter Credits: $${order.barter_amount}\nCash to collect: $${order.cash_amount + order.tax_amount}`,
        tags: 'barter-app,online-order',
        email: resolvedEmail,
        phone: resolvedPhone || undefined,
        ...(shippingAddress && { shipping_address: shippingAddress }),
        customer: {
          first_name: firstName,
          last_name:  lastName,
          email:      resolvedEmail,
          phone:      resolvedPhone || undefined,
        }
      }
    };

    const shopifyUrl = `https://${integration.store_id}/admin/api/${SHOPIFY_API_VERSION}/draft_orders.json`;

    const createResponse = await fetch(shopifyUrl, {
      method: 'POST',
      headers: {
        'X-Shopify-Access-Token': integration.access_token,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(draftOrderPayload)
    });

    if (!createResponse.ok) {
      const errorText = await createResponse.text();
      console.error(`❌ Shopify API error: ${createResponse.status} - ${errorText}`);

      if (createResponse.status === 401 || createResponse.status === 403) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Your Shopify integration has expired. Please go to Settings → POS Integration and reconnect Shopify.',
            error_code: 'SHOPIFY_AUTH_EXPIRED'
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({
          success: false,
          error: `Failed to create Shopify order: ${errorText}`
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const draftOrderData = await createResponse.json();
    const draftOrder = draftOrderData.draft_order;
    const draftOrderId = draftOrder.id.toString();

    console.log(`✅ Draft order created: ${draftOrderId}`);
    console.log(`   Shopify order name: ${draftOrder.name}`);
    console.log(`   Total: $${draftOrder.total_price}`);

    // Step 5: Apply barter discount
    let updatedDraftOrder = draftOrder;
    if (order.barter_amount > 0) {
      console.log(`💰 Applying barter discount: $${order.barter_amount}`);

      const discountPayload = {
        draft_order: {
          applied_discount: {
            description: `Barter Credits (${order.barter_percentage}%)`,
            value_type: 'fixed_amount',
            value: order.barter_amount.toString(),
            amount: order.barter_amount.toString()
          }
        }
      };

      const discountUrl = `https://${integration.store_id}/admin/api/${SHOPIFY_API_VERSION}/draft_orders/${draftOrderId}.json`;

      const discountResponse = await fetch(discountUrl, {
        method: 'PUT',
        headers: {
          'X-Shopify-Access-Token': integration.access_token,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(discountPayload)
      });

      if (discountResponse.ok) {
        const updatedData = await discountResponse.json();
        updatedDraftOrder = updatedData.draft_order;
        console.log(`✅ Discount applied. New total: $${updatedDraftOrder.total_price}`);
      } else {
        const errorText = await discountResponse.text();
        console.error(`⚠️ Failed to apply discount: ${errorText}`);
      }
    }

    // Step 5b: Send invoice to get checkout URL
    // This creates a checkout URL where customer can pay online
    console.log(`📧 Creating checkout URL for customer...`);

    const invoiceUrl = `https://${integration.store_id}/admin/api/${SHOPIFY_API_VERSION}/draft_orders/${draftOrderId}/send_invoice.json`;

    const invoiceResponse = await fetch(invoiceUrl, {
      method: 'POST',
      headers: {
        'X-Shopify-Access-Token': integration.access_token,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        draft_order_invoice: {
          to: order.customer_email,
          subject: `Complete your order #${order.order_number}`,
          custom_message: `Thank you for your order! Your barter credits ($${order.barter_amount}) have been applied. Please complete payment for the remaining amount.`
        }
      })
    });

    // Get the invoice_url from the draft order (it's created after send_invoice)
    const refreshUrl = `https://${integration.store_id}/admin/api/${SHOPIFY_API_VERSION}/draft_orders/${draftOrderId}.json`;
    const refreshResponse = await fetch(refreshUrl, {
      method: 'GET',
      headers: {
        'X-Shopify-Access-Token': integration.access_token,
        'Content-Type': 'application/json'
      }
    });

    let checkoutUrl = null;
    if (refreshResponse.ok) {
      const refreshedData = await refreshResponse.json();
      checkoutUrl = refreshedData.draft_order.invoice_url;
      console.log(`✅ Checkout URL: ${checkoutUrl}`);
    } else {
      console.log(`⚠️ Could not get checkout URL, using fallback`);
      // Fallback: construct the checkout URL manually
      checkoutUrl = `https://${integration.store_id}/draft_orders/${draftOrderId}/invoice`;
    }

    // Step 6: Create POS payment session for webhook tracking
    const { data: sessionData, error: sessionError } = await supabaseClient
      .from('pos_payment_sessions')
      .insert({
        customer_id: order.customer_id,
        merchant_id: order.merchant_id,
        pos_integration_id: integration.id,
        pos_provider: 'shopify',
        pos_order_id: draftOrderId,
        total_amount: order.total_amount,
        barter_amount: order.barter_amount,
        barter_percentage: order.barter_percentage,
        cash_amount: order.cash_amount + order.tax_amount,
        session_status: 'discount_applied',
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24 hours
      })
      .select()
      .single();

    if (sessionError) {
      console.error(`⚠️ Failed to create payment session: ${sessionError.message}`);
      // Continue anyway - webhook can still work
    } else {
      console.log(`✅ Payment session created: ${sessionData.id}`);
    }

    // Step 7: Update order with POS tracking info
    const { error: updateError } = await supabaseClient
      .from('orders')
      .update({
        status: 'pending_pos_payment',
        pos_draft_order_id: draftOrderId,
        pos_provider: 'shopify',
        pos_integration_id: integration.id,
        metadata: {
          ...order.metadata,
          shopify_draft_order_name: draftOrder.name,
          shopify_admin_url: `https://${integration.store_id}/admin/draft_orders/${draftOrderId}`,
          pos_synced_at: new Date().toISOString()
        }
      })
      .eq('id', order_id);

    if (updateError) {
      console.error(`⚠️ Failed to update order: ${updateError.message}`);
    } else {
      console.log(`✅ Order updated with POS tracking info`);
    }

    console.log('🎉 Shopify order creation complete!');

    return new Response(
      JSON.stringify({
        success: true,
        order_id: order_id,
        shopify_draft_order_id: draftOrderId,
        shopify_order_name: draftOrder.name,
        payment_session_id: sessionData?.id,
        amount_to_pay: order.cash_amount + order.tax_amount,
        checkout_url: checkoutUrl,
        pos_provider: 'shopify',
        message: 'Redirecting to Shopify checkout for payment.'
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error: any) {
    console.error('❌ Error in create-shopify-order:', error);
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
