import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SQUARE_API_VERSION = '2024-01-18';

/**
 * Create Square Order - Edge Function
 *
 * Creates a Square order with barter discount after customer checkout.
 * The order appears in Square Dashboard where merchant can view and manage it.
 *
 * Flow:
 * - Customer places order in Barter app (credits deducted)
 * - This function creates order in Square with discount
 * - Order appears in Square Dashboard/Back-office
 * - Merchant collects cash payment at pickup
 * - Payment webhook marks order as completed
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

    console.log('🟦 Create Square Order Started');
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

    // Step 2: Get merchant's Square integration
    let integration;

    if (pos_integration_id) {
      const { data, error } = await supabaseClient
        .from('pos_integrations')
        .select('*')
        .eq('id', pos_integration_id)
        .eq('provider', 'square')
        .eq('status', 'active')
        .single();

      integration = data;
      if (error) {
        console.log('⚠️ Specified integration not found:', error.message);
      }
    }

    if (!integration) {
      // Auto-detect: Find merchant's active Square integration
      const { data, error } = await supabaseClient
        .from('pos_integrations')
        .select('*')
        .eq('user_id', order.merchant_id)
        .eq('provider', 'square')
        .eq('status', 'active')
        .limit(1)
        .single();

      integration = data;
      if (error) {
        console.log('⚠️ No Square integration found for merchant');
        return new Response(
          JSON.stringify({
            success: true,
            pos_sync_skipped: true,
            reason: 'Merchant does not have an active Square integration',
            order_id: order_id
          }),
          {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }
    }

    console.log(`   Square Location: ${integration.store_id}`);

    // Decrypt access token if stored encrypted (new merchants post-encryption migration)
    if (integration.access_token_encrypted && integration.encryption_nonce) {
      console.log('🔓 Decrypting Square access token...');
      const { data: decryptedToken, error: decryptError } = await supabaseClient
        .rpc('decrypt_pos_token', {
          p_encrypted_token: integration.access_token_encrypted,
          p_nonce: integration.encryption_nonce
        });

      if (decryptError || !decryptedToken) {
        console.error('❌ Token decryption failed:', decryptError);
        throw new Error('Failed to decrypt Square access token');
      }

      integration.access_token = decryptedToken;
      console.log('✅ Token decrypted successfully');
    } else if (!integration.access_token) {
      throw new Error('No Square access token available');
    } else {
      console.log('ℹ️  Using legacy plaintext token');
    }

    // Check if merchant can accept online payments
    const canAcceptOnlinePayments = integration.config?.can_accept_online_payments;
    console.log(`   Can accept online payments: ${canAcceptOnlinePayments ? 'YES ✅' : 'NO/UNKNOWN ⚠️'}`);

    if (canAcceptOnlinePayments === false) {
      console.log(`⚠️ Merchant's Square account is not enabled for online payments`);
      // We'll still try to create the payment link, but warn in logs
    }

    // Square API URL based on environment
    const environment = integration.config?.environment || 'production';
    const squareBaseUrl = environment === 'sandbox'
      ? 'https://connect.squareupsandbox.com'
      : 'https://connect.squareup.com';

    // Step 3: Build line items for Square
    const lineItems = order.order_items.map((item: any) => ({
      name: item.product_name,
      quantity: item.quantity.toString(),
      base_price_money: {
        amount: Math.round(item.unit_price * 100), // Square uses cents
        currency: 'USD'
      },
      note: item.product_sku ? `SKU: ${item.product_sku}` : undefined
    }));

    // Build discounts array if barter amount > 0
    const discounts: any[] = [];
    if (order.barter_amount > 0) {
      discounts.push({
        name: `Barter Credits (${order.barter_percentage}%)`,
        type: 'FIXED_AMOUNT',
        amount_money: {
          amount: Math.round(order.barter_amount * 100), // Square uses cents
          currency: 'USD'
        },
        scope: 'ORDER'
      });
    }

    // Step 4: Create Payment Link with order details directly
    // NOTE: Square Payment Links API requires the order to be included in the request body
    // You CANNOT reference an existing order - Square creates the order as part of payment link creation
    console.log(`💳 Creating Square payment link with ${lineItems.length} items...`);

    const redirectUrl = `${Deno.env.get('FRONTEND_URL') || 'https://app.barterfindr.com'}/checkout/complete?provider=square&order_id=${order.id}`;

    const paymentLinkPayload: any = {
      idempotency_key: `payment-link-${order.id}`,
      order: {
        location_id: integration.store_id,
        reference_id: order.order_number, // Link back to Barter order
        line_items: lineItems,
        discounts: discounts.length > 0 ? discounts : undefined,
        metadata: {
          barter_order_id: order.id,
          barter_order_number: order.order_number,
          barter_amount: order.barter_amount.toString(),
          source: 'barter_app'
        }
      },
      checkout_options: {
        redirect_url: redirectUrl,
        ask_for_shipping_address: false
      },
      pre_populated_data: {
        buyer_email: order.customer_email,
        ...(order.customer_phone ? (() => {
          const digits = order.customer_phone.replace(/\D/g, '');
          const e164 = digits.length === 10 ? `+1${digits}` : digits.length === 11 && digits.startsWith('1') ? `+${digits}` : null;
          return e164 ? { buyer_phone_number: e164 } : {};
        })() : {})
      },
      payment_note: `Barter Order #${order.order_number}`
    };

    console.log(`📦 Payment link payload:`, JSON.stringify(paymentLinkPayload, null, 2));

    const paymentLinkResponse = await fetch(`${squareBaseUrl}/v2/online-checkout/payment-links`, {
      method: 'POST',
      headers: {
        'Square-Version': SQUARE_API_VERSION,
        'Authorization': `Bearer ${integration.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(paymentLinkPayload)
    });

    const paymentLinkData = await paymentLinkResponse.json();

    let checkoutUrl = null;
    let squareOrderId = null;
    let checkoutErrorDetails = null;

    if (paymentLinkResponse.ok && paymentLinkData.payment_link) {
      checkoutUrl = paymentLinkData.payment_link.url || paymentLinkData.payment_link.long_url;
      squareOrderId = paymentLinkData.payment_link.order_id;
      console.log(`✅ Payment link created successfully!`);
      console.log(`   Checkout URL: ${checkoutUrl}`);
      console.log(`   Square Order ID: ${squareOrderId}`);
    } else {
      const errorCode = paymentLinkData.errors?.[0]?.code || '';
      const errorCategory = paymentLinkData.errors?.[0]?.category || '';
      const errorMsg = paymentLinkData.errors?.[0]?.detail || JSON.stringify(paymentLinkData);

      // Auth errors mean the token is expired/revoked — surface a clear message immediately
      if (paymentLinkResponse.status === 401 || errorCategory === 'AUTHENTICATION_ERROR' || errorCode === 'UNAUTHORIZED') {
        console.error(`❌ Square authentication failed — token expired or revoked`);
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Your Square integration has expired. Please go to Settings → POS Integration and reconnect Square.',
            error_code: 'SQUARE_AUTH_EXPIRED'
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      checkoutErrorDetails = errorMsg;
      console.error(`⚠️ Payment Links API failed (${paymentLinkResponse.status}): ${errorMsg}`);
      console.error('Full response:', JSON.stringify(paymentLinkData, null, 2));

      // Fallback: Try creating order directly, then use legacy checkout
      console.log(`🔄 Trying fallback: Create order first, then legacy checkout...`);

      const orderPayload = {
        order: {
          location_id: integration.store_id,
          reference_id: order.order_number,
          line_items: lineItems,
          discounts: discounts.length > 0 ? discounts : undefined,
          fulfillments: [
            {
              type: 'PICKUP',
              state: 'PROPOSED',
              pickup_details: {
                recipient: {
                  display_name: order.customer_name,
                  email_address: order.customer_email
                },
                pickup_at: order.estimated_pickup_time || new Date(Date.now() + 30 * 60 * 1000).toISOString(),
                note: order.customer_notes || undefined
              }
            }
          ],
          metadata: {
            barter_order_id: order.id,
            barter_order_number: order.order_number,
            barter_amount: order.barter_amount.toString(),
            source: 'barter_app'
          }
        },
        idempotency_key: `order-${order.id}`
      };

      const orderResponse = await fetch(`${squareBaseUrl}/v2/orders`, {
        method: 'POST',
        headers: {
          'Square-Version': SQUARE_API_VERSION,
          'Authorization': `Bearer ${integration.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(orderPayload)
      });

      const orderData = await orderResponse.json();

      if (orderResponse.ok && orderData.order) {
        squareOrderId = orderData.order.id;
        console.log(`✅ Fallback order created: ${squareOrderId}`);

        // Try legacy checkout API (deprecated but may still work)
        const legacyCheckoutPayload = {
          idempotency_key: `legacy-checkout-${order.id}`,
          order: {
            order: {
              location_id: integration.store_id,
              reference_id: order.order_number,
              line_items: lineItems,
              discounts: discounts.length > 0 ? discounts : undefined
            }
          },
          redirect_url: redirectUrl,
          pre_populate_buyer_email: order.customer_email
        };

        const legacyResponse = await fetch(`${squareBaseUrl}/v2/locations/${integration.store_id}/checkouts`, {
          method: 'POST',
          headers: {
            'Square-Version': SQUARE_API_VERSION,
            'Authorization': `Bearer ${integration.access_token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(legacyCheckoutPayload)
        });

        if (legacyResponse.ok) {
          const legacyData = await legacyResponse.json();
          checkoutUrl = legacyData.checkout?.checkout_page_url;
          if (legacyData.checkout?.order?.id) {
            squareOrderId = legacyData.checkout.order.id;
          }
          console.log(`✅ Legacy checkout URL: ${checkoutUrl}`);
        } else {
          const legacyError = await legacyResponse.text();
          console.error(`⚠️ Legacy Checkout API also failed (${legacyResponse.status}): ${legacyError}`);
          checkoutErrorDetails = checkoutErrorDetails + ' | Legacy: ' + legacyError;
        }
      } else {
        const orderError = orderData.errors?.[0]?.detail || 'Unknown error';
        console.error(`⚠️ Fallback order creation failed: ${orderError}`);
        checkoutErrorDetails = checkoutErrorDetails + ' | Order: ' + orderError;
      }
    }

    if (!checkoutUrl) {
      // Only silently fall back to pay-at-store when merchant account is not enabled for online payments
      if (canAcceptOnlinePayments === false) {
        console.log(`⚠️ Merchant not enabled for online payments. Falling back to pay-at-store.`);

        await supabaseClient
          .from('orders')
          .update({
            status: 'confirmed',
            pos_draft_order_id: squareOrderId,
            pos_provider: 'square',
            pos_integration_id: integration.id,
            metadata: {
              ...order.metadata,
              square_order_id: squareOrderId,
              square_location_id: integration.store_id,
              payment_method: 'pay_at_store',
              pos_synced_at: new Date().toISOString()
            }
          })
          .eq('id', order_id);

        if (order.barter_amount > 0) {
          await supabaseClient.rpc('deduct_user_credits', {
            p_user_id: order.customer_id,
            p_amount: order.barter_amount
          });
        }

        return new Response(
          JSON.stringify({
            success: true,
            order_id: order_id,
            square_order_id: squareOrderId,
            payment_method: 'pay_at_store',
            amount_to_pay: order.cash_amount + order.tax_amount,
            pos_provider: 'square',
            message: 'Square account not enabled for online payments. Please pay at store.'
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // For any other error (invalid phone, API error, etc.) — return error so checkout shows it
      console.error(`❌ Failed to create Square checkout URL: ${checkoutErrorDetails}`);
      return new Response(
        JSON.stringify({
          success: false,
          error: checkoutErrorDetails || 'Failed to create Square payment link. Please check your details and try again.'
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
        pos_provider: 'square',
        pos_order_id: squareOrderId,
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
    } else {
      console.log(`✅ Payment session created: ${sessionData.id}`);
    }

    // Step 6: Update order with POS tracking info
    const { error: updateError } = await supabaseClient
      .from('orders')
      .update({
        status: 'pending_pos_payment',
        pos_draft_order_id: squareOrderId,
        pos_provider: 'square',
        pos_integration_id: integration.id,
        metadata: {
          ...order.metadata,
          square_order_id: squareOrderId,
          square_location_id: integration.store_id,
          checkout_url: checkoutUrl,
          pos_synced_at: new Date().toISOString()
        }
      })
      .eq('id', order_id);

    if (updateError) {
      console.error(`⚠️ Failed to update order: ${updateError.message}`);
    } else {
      console.log(`✅ Order updated with POS tracking info`);
    }

    console.log('🎉 Square order creation complete!');

    return new Response(
      JSON.stringify({
        success: true,
        order_id: order_id,
        square_order_id: squareOrderId,
        payment_session_id: sessionData?.id,
        amount_to_pay: order.cash_amount + order.tax_amount,
        checkout_url: checkoutUrl,
        pos_provider: 'square',
        message: 'Redirecting to Square checkout for payment.'
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error: any) {
    console.error('❌ Error in create-square-order:', error);
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
