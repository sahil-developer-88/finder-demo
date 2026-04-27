import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Shopify Complete Order - Auto-complete draft order after discount applied
 *
 * This eliminates the manual "mark as paid" step:
 * 1. Merchant clicks "Complete Transaction" button
 * 2. This function completes the draft order via Shopify API
 * 3. Shopify fires webhook with status "completed"
 * 4. Credits transfer automatically
 */

serve(async (req) => {
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

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);

    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    const { session_id, draft_order_id } = await req.json();

    if (!session_id || !draft_order_id) {
      throw new Error('session_id and draft_order_id are required');
    }

    console.log('🔵 Auto-completing Shopify Draft Order');
    console.log(`   Session ID: ${session_id}`);
    console.log(`   Draft Order ID: ${draft_order_id}`);
    console.log(`   Merchant: ${user.id}`);

    // Get payment session
    const { data: session, error: sessionError } = await supabaseClient
      .from('pos_payment_sessions')
      .select('*, pos_integrations(*)')
      .eq('id', session_id)
      .single();

    if (sessionError || !session) {
      throw new Error('Payment session not found');
    }

    if (session.merchant_id !== user.id) {
      throw new Error('Unauthorized - not your session');
    }

    if (session.session_status !== 'discount_applied') {
      throw new Error(`Cannot complete - session status is: ${session.session_status}`);
    }

    // Get integration
    const integration = session.pos_integrations;
    if (!integration) {
      throw new Error('POS integration not found');
    }

    console.log(`✅ Session validated`);
    console.log(`   Customer: ${session.customer_id}`);
    console.log(`   Barter Amount: $${session.barter_amount}`);
    console.log(`   Cash Amount: $${session.cash_amount}`);

    // Complete draft order via Shopify API
    console.log(`📤 Calling Shopify API to complete draft order...`);

    const shopifyApiUrl = `https://${integration.store_id}/admin/api/2024-01/draft_orders/${draft_order_id}/complete.json`;

    const response = await fetch(shopifyApiUrl, {
      method: 'PUT',
      headers: {
        'X-Shopify-Access-Token': integration.access_token,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        payment_pending: false
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Shopify API error: ${response.status} - ${errorText}`);
      throw new Error(`Failed to complete draft order: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    console.log(`✅ Draft order completed successfully!`);
    console.log(`   Order ID: ${data.draft_order?.order?.id || 'N/A'}`);
    console.log(`   Order Name: ${data.draft_order?.order?.name || 'N/A'}`);

    // Update session to payment_pending (webhook will complete it)
    await supabaseClient
      .from('pos_payment_sessions')
      .update({
        session_status: 'payment_pending'
      })
      .eq('id', session_id);

    console.log(`🎉 Order completed! Webhook will transfer credits automatically.`);

    return new Response(
      JSON.stringify({
        success: true,
        order_id: data.draft_order?.order?.id,
        order_name: data.draft_order?.order?.name,
        message: 'Order completed successfully! Credits will transfer automatically.',
        session_id
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error: any) {
    console.error('❌ Error completing order:', error);
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
