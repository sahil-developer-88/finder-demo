import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * POS Balance Check - Ultra-fast balance verification for POS extension
 *
 * Called by Shopify POS extension when customer barcode is scanned
 * Returns: customer info, available credits, and payment split calculation
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

    const { barcode, total_amount, shop_domain } = await req.json();

    if (!barcode || !total_amount || !shop_domain) {
      throw new Error('barcode, total_amount, and shop_domain are required');
    }

    console.log('⚡ Fast Balance Check');
    console.log(`   Barcode: ${barcode}`);
    console.log(`   Total: $${total_amount}`);
    console.log(`   Shop: ${shop_domain}`);

    // Look up customer by barcode in customer_barcodes table
    // Barcode format: BARTER-XXXXXXXX
    const { data: barcodeData, error: barcodeError } = await supabaseClient
      .from('customer_barcodes')
      .select('user_id')
      .eq('barcode', barcode.trim())
      .eq('is_active', true)
      .single();

    if (barcodeError || !barcodeData) {
      throw new Error('Invalid barcode - customer not found');
    }

    const customerId = barcodeData.user_id;
    console.log(`   Customer ID: ${customerId}`);

    // Get customer profile and credits in parallel
    const [profileResult, creditsResult] = await Promise.all([
      supabaseClient
        .from('profiles')
        .select('user_id, full_name, email')
        .eq('user_id', customerId)
        .single(),
      supabaseClient
        .from('user_credits')
        .select('available_credits')
        .eq('user_id', customerId)
        .single()
    ]);

    if (profileResult.error || !profileResult.data) {
      throw new Error('Customer profile not found');
    }

    // Update barcode usage tracking
    await supabaseClient.rpc('update_barcode_usage', { p_barcode: barcode.trim() });

    const profile = profileResult.data;
    const availableCredits = creditsResult.data?.available_credits || 0;

    console.log(`   Customer: ${profile.full_name}`);
    console.log(`   Available Credits: $${availableCredits}`);

    // Get merchant's barter settings
    const { data: integration } = await supabaseClient
      .from('pos_integrations')
      .select('user_id, config')
      .eq('provider', 'shopify')
      .eq('store_id', shop_domain)
      .eq('status', 'active')
      .limit(1)
      .single();

    if (!integration) {
      throw new Error('No active POS integration found for this store');
    }

    // Get barter percentage from integration config or default to 50%
    const barterPercentage = integration.config?.barter_percentage || 50;

    console.log(`   Barter %: ${barterPercentage}%`);

    // Calculate split
    const idealBarterAmount = (total_amount * barterPercentage) / 100;
    let actualBarterAmount = idealBarterAmount;
    let usedPartialCredits = false;

    // Check if customer has enough credits
    if (idealBarterAmount > availableCredits) {
      console.log(`   ⚠️ Insufficient credits - using all available`);
      actualBarterAmount = availableCredits;
      usedPartialCredits = true;
    }

    const cashAmount = total_amount - actualBarterAmount;

    console.log(`   Barter: $${actualBarterAmount.toFixed(2)}`);
    console.log(`   Cash: $${cashAmount.toFixed(2)}`);

    // Create payment session for tracking
    const { data: sessionData, error: sessionError } = await supabaseClient
      .rpc('initiate_pos_payment_session', {
        p_barcode: barcode,
        p_merchant_id: integration.user_id,
        p_pos_integration_id: integration.user_id // Using user_id as integration reference
      });

    if (sessionError || !sessionData || sessionData.length === 0) {
      throw new Error('Failed to create payment session');
    }

    const session = sessionData[0];

    if (!session.success) {
      throw new Error(session.error_message || 'Failed to create session');
    }

    console.log(`   Session ID: ${session.session_id}`);

    // Return customer info and payment calculation
    return new Response(
      JSON.stringify({
        success: true,
        session_id: session.session_id,
        customer: {
          user_id: customerId,
          name: profile.full_name || profile.email,
          credits_before: availableCredits,
          credits_after: availableCredits - actualBarterAmount
        },
        payment: {
          total: total_amount,
          barter_amount: actualBarterAmount,
          barter_percentage: barterPercentage,
          cash_amount: cashAmount
        },
        partial_payment_used: usedPartialCredits,
        message: usedPartialCredits
          ? `Using all available credits ($${actualBarterAmount.toFixed(2)})`
          : `Applying ${barterPercentage}% barter discount`
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error: any) {
    console.error('❌ Error in balance check:', error);
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
