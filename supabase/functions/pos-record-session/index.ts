import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * POS Record Session - Link cart/order to payment session
 *
 * Called after discount is applied in POS
 * Stores cart_id so webhook can match completed order to session
 */

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { session_id, cart_id } = await req.json();

    if (!session_id) {
      throw new Error('session_id is required');
    }

    console.log('📝 Recording POS Session');
    console.log(`   Session ID: ${session_id}`);
    console.log(`   Cart ID: ${cart_id || 'N/A'}`);

    // Update session with cart_id and status
    const { error } = await supabaseClient
      .from('pos_payment_sessions')
      .update({
        session_status: 'discount_applied',
        pos_order_id: cart_id || null,
        updated_at: new Date().toISOString()
      })
      .eq('id', session_id);

    if (error) {
      throw new Error(`Failed to update session: ${error.message}`);
    }

    console.log('✅ Session recorded successfully');

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Session recorded'
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error: any) {
    console.error('❌ Error recording session:', error);
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
