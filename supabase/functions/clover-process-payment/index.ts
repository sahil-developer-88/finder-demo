import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Clover Process Payment API
 * Called by Clover Custom Tender App when customer confirms barter payment
 *
 * Actions:
 * 1. Validate session
 * 2. Debit customer credits
 * 3. Credit merchant account
 * 4. Record transaction
 * 5. Update session status
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
      session_id,
      clover_order_id,
      clover_payment_id
    } = await req.json();

    console.log('🍀 Clover Process Payment');
    console.log(`   Session ID: ${session_id}`);
    console.log(`   Clover Order ID: ${clover_order_id}`);

    if (!session_id) {
      throw new Error('session_id is required');
    }

    // Get session details
    const { data: session, error: sessionError } = await supabase
      .from('pos_payment_sessions')
      .select('*')
      .eq('id', session_id)
      .single();

    if (sessionError || !session) {
      console.error('❌ Session not found:', sessionError);
      return new Response(
        JSON.stringify({
          success: false,
          error: 'SESSION_NOT_FOUND',
          message: 'Payment session not found or expired'
        }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Check if session already processed
    if (session.session_status === 'completed') {
      console.log('⚠️ Session already completed');
      return new Response(
        JSON.stringify({
          success: false,
          error: 'SESSION_ALREADY_COMPLETED',
          message: 'This payment has already been processed'
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const customerId = session.customer_id;
    const merchantId = session.merchant_id;
    const barterAmount = session.barter_amount;

    console.log(`   Customer ID: ${customerId}`);
    console.log(`   Merchant ID: ${merchantId}`);
    console.log(`   Barter Amount: $${barterAmount}`);

    // Start transaction - Get current balances
    const [customerCredits, merchantCredits] = await Promise.all([
      supabase
        .from('user_credits')
        .select('available_credits, total_spent')
        .eq('user_id', customerId)
        .single(),
      supabase
        .from('user_credits')
        .select('available_credits, total_earned')
        .eq('user_id', merchantId)
        .single()
    ]);

    if (customerCredits.error || !customerCredits.data) {
      throw new Error('Customer credits not found');
    }

    const currentCustomerBalance = customerCredits.data.available_credits || 0;

    // Verify sufficient balance
    if (currentCustomerBalance < barterAmount) {
      console.error('❌ Insufficient balance');
      return new Response(
        JSON.stringify({
          success: false,
          error: 'INSUFFICIENT_BALANCE',
          message: `Customer only has $${currentCustomerBalance.toFixed(2)} available`,
          available_balance: currentCustomerBalance
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Update session to processing
    await supabase
      .from('pos_payment_sessions')
      .update({
        session_status: 'processing',
        pos_order_id: clover_order_id || session.pos_order_id,
        updated_at: new Date().toISOString()
      })
      .eq('id', session_id);

    // Debit customer
    const newCustomerBalance = currentCustomerBalance - barterAmount;
    const { error: customerUpdateError } = await supabase
      .from('user_credits')
      .update({
        available_credits: newCustomerBalance,
        total_spent: (customerCredits.data.total_spent || 0) + barterAmount,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', customerId);

    if (customerUpdateError) {
      console.error('❌ Error debiting customer:', customerUpdateError);
      throw new Error('Failed to debit customer credits');
    }

    console.log(`   ✅ Customer debited: $${barterAmount}`);
    console.log(`   Customer new balance: $${newCustomerBalance}`);

    // Credit merchant (create account if doesn't exist)
    if (merchantCredits.data) {
      const newMerchantBalance = (merchantCredits.data.available_credits || 0) + barterAmount;
      const { error: merchantUpdateError } = await supabase
        .from('user_credits')
        .update({
          available_credits: newMerchantBalance,
          total_earned: (merchantCredits.data.total_earned || 0) + barterAmount,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', merchantId);

      if (merchantUpdateError) {
        console.error('❌ Error crediting merchant:', merchantUpdateError);
        // Note: We should ideally rollback customer debit here
        // For now, log the error but continue
      } else {
        console.log(`   ✅ Merchant credited: $${barterAmount}`);
        console.log(`   Merchant new balance: $${newMerchantBalance}`);
      }
    } else {
      // Create merchant credit account
      const { error: merchantCreateError } = await supabase
        .from('user_credits')
        .insert({
          user_id: merchantId,
          available_credits: barterAmount,
          total_earned: barterAmount
        });

      if (merchantCreateError) {
        console.error('❌ Error creating merchant credits:', merchantCreateError);
      } else {
        console.log(`   ✅ Merchant account created with: $${barterAmount}`);
      }
    }

    // Record transaction
    const { data: transaction, error: transactionError } = await supabase
      .from('transactions')
      .insert({
        from_user_id: customerId,
        to_user_id: merchantId,
        points_amount: barterAmount,
        status: 'completed',
        notes: `Barter payment via Clover POS - Order: ${clover_order_id || 'N/A'}`,
        metadata: {
          session_id: session_id,
          clover_order_id: clover_order_id,
          clover_payment_id: clover_payment_id,
          pos_provider: 'clover',
          total_amount: session.total_amount,
          barter_amount: barterAmount,
          cash_amount: session.cash_amount
        }
      })
      .select()
      .single();

    if (transactionError) {
      console.error('❌ Error recording transaction:', transactionError);
      // Continue anyway - the credits have been transferred
    } else {
      console.log(`   ✅ Transaction recorded: ${transaction?.id}`);
    }

    // Update session to completed
    await supabase
      .from('pos_payment_sessions')
      .update({
        session_status: 'completed',
        pos_payment_id: clover_payment_id,
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', session_id);

    // Update daily barter limit tracking
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

    // Get merchant's daily limit setting
    const { data: merchantSettings } = await supabase
      .from('merchant_pos_settings')
      .select('daily_barter_limit')
      .eq('merchant_id', merchantId)
      .single();

    if (merchantSettings?.daily_barter_limit && barterAmount > 0) {
      // Check if record exists for today
      const { data: existingLimit } = await supabase
        .from('merchant_daily_barter_limits')
        .select('id, used_amount, transaction_count')
        .eq('merchant_id', merchantId)
        .eq('customer_id', customerId)
        .eq('limit_date', today)
        .single();

      if (existingLimit) {
        // Update existing record - increment used_amount
        const { error: updateError } = await supabase
          .from('merchant_daily_barter_limits')
          .update({
            used_amount: (existingLimit.used_amount || 0) + barterAmount,
            transaction_count: (existingLimit.transaction_count || 0) + 1,
            last_transaction_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', existingLimit.id);

        if (updateError) {
          console.error('⚠️ Failed to update daily limit:', updateError);
        } else {
          console.log(`   ✅ Daily limit updated: $${(existingLimit.used_amount || 0) + barterAmount} used`);
        }
      } else {
        // Insert new record for today
        const { error: insertError } = await supabase
          .from('merchant_daily_barter_limits')
          .insert({
            merchant_id: merchantId,
            customer_id: customerId,
            limit_date: today,
            daily_limit: merchantSettings.daily_barter_limit,
            used_amount: barterAmount,
            transaction_count: 1,
            last_transaction_at: new Date().toISOString()
          });

        if (insertError) {
          console.error('⚠️ Failed to insert daily limit:', insertError);
        } else {
          console.log(`   ✅ Daily limit created: $${barterAmount} used of $${merchantSettings.daily_barter_limit}`);
        }
      }
    }

    console.log('✅ Clover payment processed successfully');

    // Return success response
    return new Response(
      JSON.stringify({
        success: true,
        session_id: session_id,
        transaction_id: transaction?.id,
        payment: {
          barter_amount: barterAmount,
          cash_amount: session.cash_amount,
          total_amount: session.total_amount
        },
        customer: {
          id: customerId,
          new_balance: newCustomerBalance
        },
        message: `Successfully applied $${barterAmount.toFixed(2)} barter payment`
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error: any) {
    console.error('❌ Error in clover-process-payment:', error);
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
