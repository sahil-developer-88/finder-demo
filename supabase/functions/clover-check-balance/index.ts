import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Clover Check Balance API
 * Called by Clover Custom Tender App when customer barcode is scanned
 *
 * Returns:
 * - Customer info (name, balance)
 * - Payment calculation (barter amount, cash amount)
 * - Session ID for tracking
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const {
      barcode,
      order_total,
      merchant_id,
      clover_order_id
    } = await req.json();

    console.log('🍀 Clover Balance Check');
    console.log(`   Barcode: ${barcode}`);
    console.log(`   Order Total: $${order_total}`);
    console.log(`   Merchant ID: ${merchant_id}`);

    if (!barcode || !order_total || !merchant_id) {
      throw new Error('barcode, order_total, and merchant_id are required');
    }

    // Look up customer by barcode in customer_barcodes table
    // Barcode format: BARTER-XXXXXXXX
    const { data: barcodeData, error: barcodeError } = await supabase
      .from('customer_barcodes')
      .select('user_id')
      .eq('barcode', barcode.trim())
      .eq('is_active', true)
      .single();

    if (barcodeError || !barcodeData) {
      console.error('❌ Invalid barcode:', barcodeError);
      return new Response(
        JSON.stringify({
          success: false,
          error: 'INVALID_BARCODE',
          message: 'Invalid barcode - customer not found'
        }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const customerId = barcodeData.user_id;
    console.log(`   Customer ID: ${customerId}`);

    // Get customer profile and credits in parallel
    const [profileResult, creditsResult, merchantResult] = await Promise.all([
      supabase
        .from('profiles')
        .select('user_id, full_name, email')
        .eq('user_id', customerId)
        .single(),
      supabase
        .from('user_credits')
        .select('available_credits')
        .eq('user_id', customerId)
        .single(),
      supabase
        .from('pos_integrations')
        .select('user_id, config, merchant_id')
        .eq('provider', 'clover')
        .eq('merchant_id', merchant_id)
        .eq('status', 'active')
        .single()
    ]);

    if (profileResult.error || !profileResult.data) {
      console.error('❌ Customer profile not found:', profileResult.error);
      return new Response(
        JSON.stringify({
          success: false,
          error: 'CUSTOMER_NOT_FOUND',
          message: 'Customer profile not found in barter network'
        }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Update barcode usage tracking
    await supabase.rpc('update_barcode_usage', { p_barcode: barcode.trim() });

    if (!merchantResult.data) {
      console.error('❌ Merchant not found');
      return new Response(
        JSON.stringify({
          success: false,
          error: 'MERCHANT_NOT_FOUND',
          message: 'Merchant not registered in barter network'
        }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const profile = profileResult.data;
    const availableCredits = creditsResult.data?.available_credits || 0;
    const merchantUserId = merchantResult.data.user_id;

    // Get merchant POS settings for limits
    const { data: merchantSettings } = await supabase
      .from('merchant_pos_settings')
      .select('*')
      .eq('merchant_id', merchantUserId)
      .single();

    // Use settings from merchant_pos_settings, fallback to pos_integrations.config
    const barterPercentage = merchantSettings?.default_barter_percentage
      || merchantResult.data.config?.barterPercentage
      || 30;
    const maxBarterPerTransaction = merchantSettings?.max_barter_amount_per_transaction
      || merchantResult.data.config?.maxBarterAmount
      || null;
    const dailyBarterLimit = merchantSettings?.daily_barter_limit || null;

    console.log(`   Customer: ${profile.full_name}`);
    console.log(`   Available Credits: $${availableCredits}`);
    console.log(`   Barter %: ${barterPercentage}%`);
    console.log(`   Max per transaction: ${maxBarterPerTransaction ? '$' + maxBarterPerTransaction : 'No limit'}`);
    console.log(`   Daily limit: ${dailyBarterLimit ? '$' + dailyBarterLimit : 'No limit'}`);

    // Check daily limit usage
    let dailyRemaining = dailyBarterLimit;
    let dailyUsed = 0;

    if (dailyBarterLimit) {
      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

      const { data: dailyLimitData } = await supabase
        .from('merchant_daily_barter_limits')
        .select('used_amount, remaining_amount')
        .eq('merchant_id', merchantUserId)
        .eq('customer_id', profile.user_id)
        .eq('limit_date', today)
        .single();

      if (dailyLimitData) {
        dailyUsed = dailyLimitData.used_amount || 0;
        dailyRemaining = dailyLimitData.remaining_amount || (dailyBarterLimit - dailyUsed);
      } else {
        dailyRemaining = dailyBarterLimit;
      }

      console.log(`   Daily used: $${dailyUsed}, Daily remaining: $${dailyRemaining}`);
    }

    // Calculate split
    let idealBarterAmount = (order_total * barterPercentage) / 100;

    // Apply max per transaction limit if set
    if (maxBarterPerTransaction && idealBarterAmount > maxBarterPerTransaction) {
      console.log(`   ⚠️ Capped by max per transaction: $${maxBarterPerTransaction}`);
      idealBarterAmount = maxBarterPerTransaction;
    }

    // Apply daily limit if set
    if (dailyRemaining !== null && idealBarterAmount > dailyRemaining) {
      console.log(`   ⚠️ Capped by daily remaining: $${dailyRemaining}`);
      idealBarterAmount = Math.max(0, dailyRemaining);
    }

    // Check if customer has enough credits
    let actualBarterAmount = idealBarterAmount;
    let insufficientCredits = false;
    let dailyLimitReached = false;

    if (idealBarterAmount > availableCredits) {
      console.log(`   ⚠️ Insufficient credits - using all available`);
      actualBarterAmount = availableCredits;
      insufficientCredits = true;
    }

    if (dailyRemaining !== null && dailyRemaining <= 0) {
      console.log(`   ⚠️ Daily barter limit reached`);
      actualBarterAmount = 0;
      dailyLimitReached = true;
    }

    const cashAmount = order_total - actualBarterAmount;

    console.log(`   Barter Amount: $${actualBarterAmount.toFixed(2)}`);
    console.log(`   Cash Amount: $${cashAmount.toFixed(2)}`);

    // Create payment session for tracking
    const sessionId = crypto.randomUUID();

    const { error: sessionError } = await supabase
      .from('pos_payment_sessions')
      .insert({
        id: sessionId,
        customer_id: customerId,
        merchant_id: merchantResult.data.user_id,
        pos_provider: 'clover',
        pos_order_id: clover_order_id || null,
        total_amount: order_total,
        barter_amount: actualBarterAmount,
        cash_amount: cashAmount,
        barter_percentage: barterPercentage,
        session_status: 'pending',
        created_at: new Date().toISOString()
      });

    if (sessionError) {
      console.error('❌ Error creating session:', sessionError);
      throw new Error('Failed to create payment session');
    }

    console.log(`   Session ID: ${sessionId}`);

    // Build status message
    let message = `Applying ${barterPercentage}% barter discount`;
    if (dailyLimitReached) {
      message = 'Daily barter limit reached - full payment in cash/card required';
    } else if (insufficientCredits) {
      message = `Using all available credits ($${actualBarterAmount.toFixed(2)})`;
    } else if (dailyRemaining !== null && actualBarterAmount < idealBarterAmount) {
      message = `Limited by daily remaining ($${dailyRemaining.toFixed(2)})`;
    }

    // Return response
    return new Response(
      JSON.stringify({
        success: true,
        session_id: sessionId,
        customer: {
          id: customerId,
          name: profile.full_name || profile.email || 'Customer',
          email: profile.email,
          available_credits: availableCredits,
          credits_after: availableCredits - actualBarterAmount
        },
        merchant: {
          id: merchantUserId,
          clover_merchant_id: merchant_id,
          barter_percentage: barterPercentage,
          max_barter_per_transaction: maxBarterPerTransaction,
          daily_barter_limit: dailyBarterLimit
        },
        payment: {
          order_total: order_total,
          barter_amount: actualBarterAmount,
          cash_amount: cashAmount,
          barter_percentage: barterPercentage
        },
        limits: {
          daily_limit: dailyBarterLimit,
          daily_used: dailyUsed,
          daily_remaining: dailyRemaining,
          max_per_transaction: maxBarterPerTransaction
        },
        insufficient_credits: insufficientCredits,
        daily_limit_reached: dailyLimitReached,
        message: message
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error: any) {
    console.error('❌ Error in clover-check-balance:', error);
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
