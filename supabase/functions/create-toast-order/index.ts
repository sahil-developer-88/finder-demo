import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Create Toast Order - Edge Function
 *
 * Submits an order to Toast POS via the Orders API.
 * Toast is an in-person restaurant POS — there is no hosted checkout redirect.
 * The order is recorded in Toast and the customer pays at the counter.
 *
 * Flow:
 * 1. Customer places order in Barter app
 * 2. This function creates an order in Toast via POST /orders/v2/orders
 * 3. Returns success — customer is shown the checkout complete screen
 * 4. Merchant sees the order on their Toast POS terminal
 */

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const json = (data: any, status = 200) =>
    new Response(JSON.stringify(data), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Missing authorization header');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) throw new Error('Unauthorized');

    const { order_id, pos_integration_id } = await req.json();
    if (!order_id) throw new Error('order_id is required');

    console.log('🍞 Create Toast Order Started');
    console.log(`   Order ID: ${order_id}`);

    // ── Fetch order with items ─────────────────────────────────────────────
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*, order_items (*)')
      .eq('id', order_id)
      .single();

    if (orderError || !order) throw new Error(`Order not found: ${orderError?.message}`);
    if (order.customer_id !== user.id) throw new Error('Unauthorized: Not your order');

    console.log(`   Order Number: ${order.order_number}`);
    console.log(`   Items: ${order.order_items?.length || 0}`);
    console.log(`   Barter: $${order.barter_amount}  Cash: $${order.cash_amount}`);

    // ── Find Toast integration ─────────────────────────────────────────────
    let integration: any = null;

    if (pos_integration_id) {
      const { data } = await supabase
        .from('pos_integrations')
        .select('*')
        .eq('id', pos_integration_id)
        .eq('provider', 'toast')
        .eq('status', 'active')
        .single();
      integration = data;
    }

    if (!integration) {
      const { data } = await supabase
        .from('pos_integrations')
        .select('*')
        .eq('user_id', order.merchant_id)
        .eq('provider', 'toast')
        .eq('status', 'active')
        .limit(1)
        .single();
      integration = data;
    }

    if (!integration) {
      return json({
        success: true,
        pos_sync_skipped: true,
        reason: 'Merchant does not have an active Toast integration',
        order_id,
      });
    }

    // ── Decrypt access token ───────────────────────────────────────────────
    if (integration.access_token_encrypted && integration.encryption_nonce) {
      const { data: decrypted, error: decryptErr } = await supabase.rpc('decrypt_pos_token', {
        p_encrypted_token: integration.access_token_encrypted,
        p_nonce: integration.encryption_nonce,
      });
      if (decryptErr || !decrypted) throw new Error('Failed to decrypt Toast access token');
      integration.access_token = decrypted;
    } else if (!integration.access_token) {
      throw new Error('No Toast access token available');
    }

    const restaurantGuid = integration.store_id;
    if (!restaurantGuid) throw new Error('Toast restaurant GUID not configured');

    // ── Build Toast order payload ──────────────────────────────────────────
    const selections = (order.order_items || []).map((item: any) => ({
      itemGuid: item.external_product_id || null,
      displayName: item.product_name,
      preDiscountPrice: item.unit_price,
      price: item.unit_price,
      quantity: item.quantity,
      modifiers: [],
    }));

    // Represent barter as a discount on the check
    const appliedDiscounts = order.barter_amount > 0
      ? [{
          name: `Barter Credits (Order #${order.order_number})`,
          discountAmount: order.barter_amount,
          discountType: 'FIXED_TOTAL',
        }]
      : [];

    // Build payments array — cash covers the remaining amount after barter
    const payments = [
      {
        type: 'CASH',
        amount: order.cash_amount + order.tax_amount,
        tipAmount: 0,
      },
    ];

    if (order.barter_amount > 0) {
      payments.push({
        type: 'OTHER',
        amount: order.barter_amount,
        tipAmount: 0,
        // @ts-ignore Toast extra field
        otherPayment: { name: 'Barter Credits' },
      });
    }

    // Fulfillment note
    const fulfillmentNote = order.fulfillment_method === 'delivery'
      ? `Delivery to: ${order.delivery_address}, ${order.delivery_city}, ${order.delivery_state} ${order.delivery_zip}`
      : `Pickup — ${order.customer_name} (${order.customer_phone || order.customer_email})`;

    const toastOrderPayload = {
      entityType: 'Order',
      checks: [
        {
          entityType: 'Check',
          displayNumber: order.order_number,
          amount: order.total_amount,
          taxAmount: order.tax_amount,
          tipAmount: 0,
          selections,
          appliedDiscounts,
          payments,
        },
      ],
      table: { entityType: 'Table', name: fulfillmentNote },
      serviceArea: null,
      deliveryInfo: order.fulfillment_method === 'delivery'
        ? {
            address1: order.delivery_address,
            city: order.delivery_city,
            state: order.delivery_state,
            zipCode: order.delivery_zip,
          }
        : null,
    };

    console.log('📦 Submitting order to Toast...');

    // ── Call Toast Orders API ──────────────────────────────────────────────
    const toastRes = await fetch('https://ws-api.toasttab.com/orders/v2/orders', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${integration.access_token}`,
        'Toast-Restaurant-External-ID': restaurantGuid,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(toastOrderPayload),
    });

    let toastOrderGuid: string | null = null;

    if (toastRes.ok) {
      const toastData = await toastRes.json();
      toastOrderGuid = toastData.guid || toastData.orders?.[0]?.guid || null;
      console.log(`✅ Toast order created: ${toastOrderGuid}`);
    } else {
      const errBody = await toastRes.text();
      console.error(`❌ Toast API error (${toastRes.status}): ${errBody}`);

      if (toastRes.status === 401 || toastRes.status === 403) {
        return json({
          success: false,
          error: 'Your Toast integration has expired. Please reconnect Toast from your POS settings.',
          error_code: 'TOAST_AUTH_EXPIRED',
        });
      }

      // Non-fatal: record the order locally even if Toast API fails
      console.warn('⚠️ Toast API failed — order recorded locally only');
    }

    // ── Create POS payment session ─────────────────────────────────────────
    const { data: sessionData, error: sessionError } = await supabase
      .from('pos_payment_sessions')
      .insert({
        customer_id: order.customer_id,
        merchant_id: order.merchant_id,
        pos_integration_id: integration.id,
        pos_provider: 'toast',
        pos_order_id: toastOrderGuid,
        total_amount: order.total_amount,
        barter_amount: order.barter_amount,
        barter_percentage: order.barter_percentage,
        cash_amount: order.cash_amount + order.tax_amount,
        session_status: 'discount_applied',
        expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      })
      .select()
      .single();

    if (sessionError) {
      console.error(`⚠️ Failed to create payment session: ${sessionError.message}`);
    }

    // ── Update order record ────────────────────────────────────────────────
    await supabase
      .from('orders')
      .update({
        status: 'confirmed',
        pos_draft_order_id: toastOrderGuid,
        pos_provider: 'toast',
        pos_integration_id: integration.id,
        metadata: {
          ...order.metadata,
          toast_order_guid: toastOrderGuid,
          toast_restaurant_guid: restaurantGuid,
          pos_synced_at: new Date().toISOString(),
        },
      })
      .eq('id', order_id);

    console.log('🎉 Toast order creation complete!');

    // Toast has no hosted checkout URL — customer pays in person at the counter
    return json({
      success: true,
      order_id,
      toast_order_guid: toastOrderGuid,
      payment_session_id: sessionData?.id,
      pos_provider: 'toast',
      amount_to_pay: order.cash_amount + order.tax_amount,
      message: 'Order submitted to Toast. Please pay at the counter.',
    });

  } catch (error: any) {
    console.error('❌ Error in create-toast-order:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message || 'Unknown error occurred' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
