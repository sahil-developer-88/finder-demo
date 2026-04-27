import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { ShopifyGraphQLClient } from './shopify-graphql-client.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Shopify Apply Barter Discount - Edge Function
 *
 * This function handles the automated split payment flow for Shopify POS:
 * 1. Receives customer barcode scan from cashier
 * 2. Validates customer and gets credit balance
 * 3. Creates draft order in Shopify with barter discount
 * 4. Returns instructions for cashier to complete payment
 *
 * Flow:
 * - Customer shows barcode at checkout
 * - Cashier scans barcode via app
 * - This function creates discounted draft order
 * - Cashier completes sale in Shopify POS
 * - Webhook confirms payment → credits transferred
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

    // Get authenticated user (merchant)
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);

    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    const { barcode, draft_order_id, total_amount } = await req.json();

    if (!barcode) {
      throw new Error('Barcode is required');
    }

    console.log('🔵 Shopify Barter Application Started');
    console.log(`   Merchant (logged in): ${user.id}`);
    console.log(`   Barcode: ${barcode}`);
    console.log(`   Draft Order ID: ${draft_order_id || 'N/A'}`);
    console.log(`   Total Amount: $${total_amount || 'Will fetch from draft order'}`);

    // DEBUG: Barcode format is now BARTER-XXXXXXXX (from customer_barcodes table)
    console.log(`🔍 DEBUG: Customer barcode: ${barcode}`);

    // Step 1: Get merchant's Shopify integration
    const { data: integration, error: integrationError } = await supabaseClient
      .from('pos_integrations')
      .select('*')
      .eq('user_id', user.id)
      .eq('provider', 'shopify')
      .eq('status', 'active')
      .single();

    if (integrationError || !integration) {
      throw new Error('No active Shopify integration found. Please connect your Shopify store first.');
    }

    console.log(`   Shop Domain: ${integration.store_id}`);

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

    // Step 2: Initiate payment session
    const { data: sessionData, error: sessionError } = await supabaseClient
      .rpc('initiate_pos_payment_session', {
        p_barcode: barcode,
        p_merchant_id: user.id,
        p_pos_integration_id: integration.id
      });

    if (sessionError || !sessionData || sessionData.length === 0) {
      console.error('❌ Session creation failed:', sessionError);
      throw new Error('Failed to create payment session');
    }

    const session = sessionData[0];

    if (!session.success) {
      throw new Error(session.error_message || 'Failed to initiate payment session');
    }

    console.log(`✅ Session created: ${session.session_id}`);
    console.log(`🔍 DEBUG: Buyer/Customer details from database:`);
    console.log(`   Customer ID: ${session.customer_id}`);
    console.log(`   Customer Name: ${session.customer_name}`);
    console.log(`   Available Credits: $${session.available_credits}`);
    console.log(`   Barter %: ${session.barter_percentage}%`);

    // Step 3: Get total amount (either manual or from draft order)
    let totalAmount;
    let fetchedFromDraftOrder = false;

    if (total_amount) {
      // Manual total entry (for testing or when draft order API is blocked)
      totalAmount = parseFloat(total_amount);
      console.log(`💵 Using manual total: $${totalAmount}`);
    } else if (draft_order_id) {
      // Try to fetch from draft order (may fail if app not approved for protected data)
      console.log(`📋 Attempting to fetch draft order: ${draft_order_id}`);

      try {
        const shopifyClient = new ShopifyGraphQLClient(
          integration.store_id,
          integration.access_token
        );

        const draftOrder = await shopifyClient.getDraftOrder(draft_order_id);

        if (!draftOrder) {
          throw new Error(`Draft order ${draft_order_id} not found`);
        }

        totalAmount = parseFloat(draftOrder.totalPrice || draftOrder.total_price);
        fetchedFromDraftOrder = true;
        console.log(`   Total from draft order: $${totalAmount}`);
      } catch (error: any) {
        // If fetching fails due to protected data restrictions, ask for manual total
        console.error(`⚠️ Could not fetch draft order: ${error.message}`);
        return new Response(
          JSON.stringify({
            success: false,
            error: 'manual_total_required',
            message: 'Unable to fetch draft order. Please enter the total amount manually.',
            reason: 'App needs Shopify approval to access draft orders. Use manual total entry for now.',
            session_id: session.session_id,
            customer_info: {
              name: session.customer_name,
              credits: session.available_credits,
              barter_percentage: session.barter_percentage
            }
          }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }
    } else {
      // No total or draft order ID provided
      return new Response(
        JSON.stringify({
          success: false,
          error: 'total_required',
          message: 'Please provide either total_amount or draft_order_id',
          session_id: session.session_id,
          customer_info: {
            name: session.customer_name,
            credits: session.available_credits,
            barter_percentage: session.barter_percentage
          }
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Step 5: Calculate barter split
    const barterPercentage = session.barter_percentage;
    let idealBarterAmount = (totalAmount * barterPercentage) / 100;
    let actualBarterAmount = idealBarterAmount;
    let usedPartialCredits = false;

    // Step 6: Check if customer has enough credits - if not, use what they have
    if (idealBarterAmount > session.available_credits) {
      console.log(`⚠️ Insufficient credits for full discount:`);
      console.log(`   Needed: $${idealBarterAmount.toFixed(2)}`);
      console.log(`   Available: $${session.available_credits.toFixed(2)}`);
      console.log(`   Using partial payment: ALL available credits + cash for remainder`);

      actualBarterAmount = session.available_credits; // Use all available credits
      usedPartialCredits = true;
    }

    const cashAmount = totalAmount - actualBarterAmount;

    console.log(`💰 Split Calculation:`);
    console.log(`   Total: $${totalAmount.toFixed(2)}`);
    console.log(`   Barter discount applied: $${actualBarterAmount.toFixed(2)}`);
    console.log(`   Cash payment: $${cashAmount.toFixed(2)}`);
    if (usedPartialCredits) {
      console.log(`   ℹ️ Partial payment: Customer used all available credits`);
    }

    // Step 7: Apply discount to draft order (only if we have draft order ID and can access it)
    let discountApplied = false;
    let discountId = null;

    if (draft_order_id && fetchedFromDraftOrder) {
      // We were able to fetch the draft order, try to apply discount
      const discountDescription = usedPartialCredits
        ? `Barter Credits - Partial (All available: $${actualBarterAmount.toFixed(2)})`
        : `Barter Credits - ${barterPercentage}%`;

      console.log(`🎯 Applying $${actualBarterAmount.toFixed(2)} discount to draft order...`);

      try {
        const shopifyClient = new ShopifyGraphQLClient(
          integration.store_id,
          integration.access_token
        );

        const discountResult = await shopifyClient.applyDiscountToDraftOrder(
          draft_order_id,
          actualBarterAmount,
          discountDescription
        );

        if (discountResult.success) {
          console.log(`✅ Discount applied automatically via API`);
          discountApplied = true;
          discountId = discountResult.discount_id;
        } else {
          console.warn(`⚠️ Could not apply discount automatically: ${discountResult.error}`);
        }
      } catch (error: any) {
        console.warn(`⚠️ Could not apply discount: ${error.message}`);
      }
    }

    if (!discountApplied) {
      console.log(`📝 Discount will need to be applied manually in Shopify`);
    }

    // Step 8: Update session status
    await supabaseClient
      .from('pos_payment_sessions')
      .update({
        session_status: discountApplied ? 'discount_applied' : 'validated',
        total_amount: totalAmount,
        barter_amount: actualBarterAmount,
        cash_amount: cashAmount,
        barter_percentage: barterPercentage,
        pos_order_id: draft_order_id || null,
        pos_discount_id: discountId
      })
      .eq('id', session.session_id);

    console.log(`🎉 Barter discount calculation complete!`);

    // Build next steps based on whether discount was auto-applied
    const partialPaymentNote = usedPartialCredits
      ? `⚠️ Partial payment: Using ALL available credits ($${actualBarterAmount.toFixed(2)})`
      : '';

    const nextSteps = discountApplied
      ? [
          partialPaymentNote,
          `✅ Discount of $${actualBarterAmount.toFixed(2)} applied automatically`,
          `💰 Customer pays $${cashAmount.toFixed(2)} (cash/card)`,
          `📱 Complete payment in Shopify POS`,
          `🔄 Credits will transfer automatically after payment`
        ].filter(s => s) // Remove empty strings
      : [
          partialPaymentNote,
          `📝 MANUALLY apply $${actualBarterAmount.toFixed(2)} discount in Shopify`,
          `💰 Customer should pay $${cashAmount.toFixed(2)} (cash/card)`,
          `📱 Complete payment in Shopify POS`,
          `🔄 Credits will transfer automatically after payment`
        ].filter(s => s);

    // Return success response
    return new Response(
      JSON.stringify({
        success: true,
        discount_applied_automatically: discountApplied,
        partial_payment_used: usedPartialCredits,
        session_id: session.session_id,
        draft_order_id: draft_order_id || null,
        customer: {
          name: session.customer_name,
          credits_before: session.available_credits,
          credits_after: session.available_credits - actualBarterAmount
        },
        payment: {
          total: totalAmount,
          barter_amount: actualBarterAmount,
          barter_percentage: barterPercentage,
          cash_amount: cashAmount,
          discount_id: discountId
        },
        next_steps: nextSteps
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error: any) {
    console.error('❌ Error in shopify-apply-barter:', error);
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
