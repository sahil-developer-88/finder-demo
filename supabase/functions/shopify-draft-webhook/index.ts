import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Shopify Draft Order Webhook Handler
 * Handles ONLY draft order events for split payment processing
 * Topics: draft_orders/create, draft_orders/update, draft_orders/delete
 */
serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('📋 Shopify Draft Order webhook received');

    // Get raw body and headers
    const body = await req.text();
    const headers = Object.fromEntries(req.headers.entries());

    let payload: any;
    try {
      payload = JSON.parse(body);
    } catch (e) {
      return new Response(
        JSON.stringify({ error: 'Invalid JSON payload' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const topic = headers['x-shopify-topic'];
    const shopDomain = headers['x-shopify-shop-domain'];

    console.log('📦 Topic:', topic);
    console.log('🏪 Shop:', shopDomain);
    console.log('📋 Draft Order ID:', payload.id);
    console.log('📊 Status:', payload.status);

    // Validate this is a draft order webhook
    if (!topic?.startsWith('draft_orders/')) {
      console.error('❌ Invalid topic for this endpoint:', topic);
      return new Response(
        JSON.stringify({ error: 'This endpoint only handles draft_orders webhooks' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Handle different draft order events
    const result = await handleDraftOrderWebhook(topic, payload, headers, supabase);

    return new Response(
      JSON.stringify(result),
      {
        status: result.success ? 200 : 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (err: any) {
    console.error('❌ Unhandled error:', err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

/**
 * Handle draft order webhook events (for split payment)
 */
async function handleDraftOrderWebhook(
  topic: string,
  payload: any,
  headers: any,
  supabase: any
): Promise<any> {
  const shopDomain = headers['x-shopify-shop-domain'];
  const draftOrderId = payload.id?.toString();

  console.log(`📋 Processing ${topic} for draft order ${draftOrderId}`);

  // Handle draft order completion (when it becomes a regular order)
  if (topic === 'draft_orders/update' && payload.status === 'completed') {
    console.log(`🎯 Draft order completed: ${draftOrderId}`);

    // STEP 1: Find payment session by draft order ID (gets merchant_id)
    console.log(`🔍 Step 1: Finding payment session for draft order: ${draftOrderId}`);

    const { data: sessions, error: sessionError } = await supabase
      .from('pos_payment_sessions')
      .select('*')
      .eq('pos_order_id', draftOrderId)
      .eq('session_status', 'discount_applied')
      .order('created_at', { ascending: false })
      .limit(1);

    const session = sessions?.[0] || null;

    if (sessionError) {
      console.error('❌ Error finding session:', sessionError);
      return { success: false, error: 'Database error finding session' };
    }

    if (!session) {
      console.log('⚠️ No payment session found for draft order:', draftOrderId);

      // Debug: Check recent sessions
      const { data: allSessions } = await supabase
        .from('pos_payment_sessions')
        .select('id, merchant_id, pos_order_id, session_status, created_at')
        .order('created_at', { ascending: false })
        .limit(5);

      console.log('📋 Recent sessions (any merchant):', allSessions);

      return { success: true, message: 'No matching session' };
    }

    console.log(`✅ Step 1 complete: Found session ${session.id}`);
    console.log(`   Merchant ID: ${session.merchant_id}`);
    console.log(`   Customer ID: ${session.customer_id}`);
    console.log(`   Barter amount: $${session.barter_amount}`);

    // STEP 2: Find integration using merchant_id from session
    console.log(`🔍 Step 2: Finding integration for merchant: ${session.merchant_id}`);

    const { data: integrations, error: integrationError } = await supabase
      .from('pos_integrations')
      .select('user_id, id, store_id, status')
      .eq('user_id', session.merchant_id)
      .eq('provider', 'shopify')
      .eq('store_id', shopDomain)
      .eq('status', 'active')
      .limit(1);

    const integration = integrations?.[0] || null;

    if (integrationError) {
      console.error('❌ Error finding integration:', integrationError);
      return { success: false, error: 'Database error finding integration' };
    }

    if (!integration) {
      console.error('❌ No integration found for merchant:', session.merchant_id);
      return { success: false, error: 'Integration not found for merchant' };
    }

    console.log(`✅ Step 2 complete: Found integration ${integration.id}`);

    // Get the completed order details
    const orderId = payload.order_id?.toString();
    if (!orderId) {
      console.error('❌ No order_id in completed draft order');
      return { success: false, error: 'No order_id' };
    }

    console.log(`💰 Completing payment session for order: ${orderId}`);

    // Calculate original total BEFORE discounts
    // We need: original line items + shipping + tax
    const lineItemsTotal = parseFloat(payload.total_line_items_price_set?.shop_money?.amount || payload.subtotal_price);
    const shippingTotal = parseFloat(payload.total_shipping_price_set?.shop_money?.amount || '0');
    const taxTotal = parseFloat(payload.total_tax_set?.shop_money?.amount || payload.total_tax || '0');
    const originalTotal = lineItemsTotal + shippingTotal + taxTotal;

    // The barter amount is what was actually discounted (from applied_discount)
    const barterAmount = parseFloat(payload.applied_discount?.amount || session.barter_amount);

    console.log(`💰 Calling complete_pos_payment_session with:`);
    console.log(`   p_session_id: ${session.id}`);
    console.log(`   p_total_amount: ${originalTotal} (original total before discounts)`);
    console.log(`   p_barter_amount: ${barterAmount} (barter credits used)`);
    console.log(`   p_pos_order_id: ${orderId}`);
    console.log(`   Cash paid by customer: ${payload.total_price}`);

    // Complete the payment session (transfer credits)
    const { data: result, error: completeError } = await supabase
      .rpc('complete_pos_payment_session', {
        p_session_id: session.id,
        p_total_amount: originalTotal,
        p_barter_amount: barterAmount,
        p_pos_order_id: orderId
      });

    console.log(`📊 RPC call result:`, JSON.stringify({ data: result, error: completeError }, null, 2));

    if (completeError || !result || result.length === 0) {
      console.error('❌ Failed to complete session:', completeError);
      console.error('❌ Full error object:', JSON.stringify(completeError, null, 2));
      return { success: false, error: completeError?.message || 'Completion failed' };
    }

    const completionResult = result[0];
    console.log(`📊 Completion result:`, JSON.stringify(completionResult, null, 2));

    if (!completionResult.success) {
      console.error('❌ Session completion failed:', completionResult.error_message);
      return { success: false, error: completionResult.error_message };
    }

    console.log(`✅ Payment session completed successfully`);
    console.log(`   Transaction ID: ${completionResult.transaction_id}`);

    return {
      success: true,
      transaction_id: completionResult.transaction_id,
      message: 'Barter credits transferred'
    };
  }

  // Handle draft order deletion (cancelled before completion)
  if (topic === 'draft_orders/delete') {
    console.log(`🗑️ Draft order deleted: ${draftOrderId}`);

    // Find and rollback any active sessions
    const { data: sessions } = await supabase
      .from('pos_payment_sessions')
      .select('id')
      .eq('pos_order_id', draftOrderId)
      .in('session_status', ['discount_applied', 'payment_pending']);

    if (sessions && sessions.length > 0) {
      for (const session of sessions) {
        await supabase.rpc('rollback_pos_payment_session', {
          p_session_id: session.id,
          p_reason: 'Draft order was cancelled/deleted'
        });
        console.log(`♻️  Rolled back session: ${session.id}`);
      }
    }

    return { success: true, message: 'Sessions rolled back' };
  }

  // Draft order created - just log it
  if (topic === 'draft_orders/create') {
    console.log(`📝 Draft order created: ${draftOrderId}`);
    return { success: true, message: 'Draft order created (no action needed)' };
  }

  return { success: true, message: 'Event type handled' };
}
