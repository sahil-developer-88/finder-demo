import { calculateTransactionSplit } from '../utils/split-calculator.ts';

/**
 * Handle Clover webhook events
 * Supports both:
 * 1. Regular Clover webhooks (inventory, orders, payments)
 * 2. Hosted Checkout webhooks (online payments)
 *
 * Docs: https://docs.clover.com/docs/webhooks
 * Hosted Checkout: https://docs.clover.com/dev/docs/ecomm-hosted-checkout-webhook
 */
export async function handleCloverWebhook(
  payload: any,
  headers: any,
  supabase: any
): Promise<any> {
  console.log('🟫 Processing Clover webhook');
  console.log('   Payload:', JSON.stringify(payload, null, 2));

  // Check if this is a Hosted Checkout webhook
  // Hosted Checkout webhooks have: Type, Status, Id, MerchantId, Data (checkout session UUID)
  if (payload.Type === 'PAYMENT' && (payload.Status === 'APPROVED' || payload.Status === 'DECLINED')) {
    return handleHostedCheckoutWebhook(payload, headers, supabase);
  }

  // Verify token for all regular Clover webhooks (ITEM, PAYMENT, etc.)
  const verificationToken = headers['x-clover-verification-token'];
  const expectedToken = Deno.env.get('CLOVER_WEBHOOK_VERIFICATION_TOKEN');

  if (expectedToken && verificationToken && verificationToken !== expectedToken) {
    console.error('❌ Invalid Clover verification token');
    return { success: false, error: 'Invalid verification token' };
  }

  // Handle the standard Clover webhook format:
  // { appId, merchants: { MERCHANT_ID: [{ objectId, type, ts }] } }
  // objectId prefix indicates type: "I:" = ITEM, "P:" = PAYMENT
  if (payload.merchants) {
    const results: any[] = [];
    for (const [merchantId, events] of Object.entries(payload.merchants as Record<string, any[]>)) {
      for (const event of events) {
        const { objectId, type } = event;
        // Normalize to flat structure the sub-handlers expect
        const normalized = { merchantId, objectId, type, ts: event.ts };

        if (objectId?.startsWith('I:')) {
          normalized.objectId = objectId.replace('I:', '');
          const flatPayload = { ...normalized, objectType: 'ITEM' };
          if (type === 'DELETE') {
            results.push(await handleCloverItemDelete(flatPayload, supabase));
          } else if (type === 'CREATE' || type === 'UPDATE') {
            results.push(await handleCloverItemSync(flatPayload, supabase));
          }
        } else if (objectId?.startsWith('P:')) {
          normalized.objectId = objectId.replace('P:', '');
          const flatPayload = { ...normalized, objectType: 'PAYMENT' };
          if (type === 'CREATE') {
            results.push(await handleRegularPaymentWebhook(flatPayload, supabase));
          }
        } else {
          console.log(`ℹ️  Unhandled objectId prefix: ${objectId}`);
          results.push({ success: true, message: `Unhandled objectId: ${objectId}` });
        }
      }
    }
    return { success: true, processed: results.length, results };
  }

  // Legacy flat-format fallback (objectType at top level)
  if (payload.objectType === 'ITEM') {
    if (payload.type === 'DELETE') {
      return await handleCloverItemDelete(payload, supabase);
    }
    if (payload.type === 'CREATE' || payload.type === 'UPDATE') {
      return await handleCloverItemSync(payload, supabase);
    }
  }

  if (payload.type === 'CREATE' && payload.objectType === 'PAYMENT') {
    return handleRegularPaymentWebhook(payload, supabase);
  }

  return { success: true, message: 'Event type not handled' };
}

/**
 * Handle Hosted Checkout webhook events
 * These come from the /invoicingcheckoutservice endpoint
 */
async function handleHostedCheckoutWebhook(
  payload: any,
  headers: any,
  supabase: any
): Promise<any> {
  console.log('🔷 Processing Clover Hosted Checkout webhook');

  const {
    Type,
    Status,
    Id: paymentId,
    MerchantId: merchantId,
    Data: checkoutSessionId,
    Message
  } = payload;

  console.log(`   Type: ${Type}`);
  console.log(`   Status: ${Status}`);
  console.log(`   Payment ID: ${paymentId}`);
  console.log(`   Merchant ID: ${merchantId}`);
  console.log(`   Checkout Session: ${checkoutSessionId}`);
  console.log(`   Message: ${Message}`);

  // Get merchant integration
  const { data: integration } = await supabase
    .from('pos_integrations')
    .select('id, user_id, config, access_token')
    .eq('provider', 'clover')
    .eq('merchant_id', merchantId)
    .single();

  if (!integration) {
    console.error('❌ No integration found for merchant:', merchantId);
    return { success: false, error: 'Integration not found' };
  }

  // Check for duplicate
  const { data: existing } = await supabase
    .from('pos_transactions')
    .select('id')
    .eq('pos_provider', 'clover')
    .eq('external_transaction_id', paymentId)
    .single();

  if (existing) {
    console.log('⚠️ Duplicate transaction, skipping');
    return { success: true, duplicate: true };
  }

  // Handle based on status
  if (Status === 'APPROVED') {
    // Parse amount from message (e.g., "Approved for 100" = $1.00)
    const amountMatch = Message?.match(/for\s+(\d+)/);
    const totalAmountCents = amountMatch ? parseInt(amountMatch[1]) : 0;
    const totalAmount = totalAmountCents / 100;

    console.log(`   Amount: $${totalAmount}`);

    // Find the payment session using checkout session ID
    const { data: sessions } = await supabase
      .from('pos_payment_sessions')
      .select('*')
      .eq('pos_order_id', checkoutSessionId)
      .eq('pos_provider', 'clover')
      .in('session_status', ['discount_applied', 'payment_pending'])
      .limit(1);

    let barterAmount = 0;
    let barterPercentage = 25;

    if (sessions && sessions.length > 0) {
      const session = sessions[0];
      barterAmount = session.barter_amount || 0;
      barterPercentage = session.barter_percentage || 25;

      console.log(`✅ Found payment session: ${session.id}`);
      console.log(`   Barter amount: $${barterAmount}`);

      // Complete the payment session - transfer credits
      const { data: completionResult, error: completeError } = await supabase
        .rpc('complete_pos_payment_session', {
          p_session_id: session.id,
          p_total_amount: totalAmount + barterAmount, // Original total before discount
          p_barter_amount: barterAmount,
          p_pos_order_id: paymentId
        });

      if (completeError) {
        console.error('⚠️ Error completing session:', completeError);
      } else if (completionResult?.[0]?.success) {
        console.log('✅ Payment session completed, credits transferred');
      }

      // Update the order status to completed
      const { error: orderUpdateError } = await supabase
        .from('orders')
        .update({
          status: 'completed',
          pos_order_id: paymentId,
          metadata: supabase.sql`metadata || jsonb_build_object('clover_payment_id', ${paymentId}, 'payment_completed_at', ${new Date().toISOString()})`
        })
        .eq('pos_draft_order_id', checkoutSessionId)
        .eq('pos_provider', 'clover');

      if (orderUpdateError) {
        console.error('⚠️ Error updating order:', orderUpdateError.message);

        // Try alternate update without jsonb operation
        await supabase
          .from('orders')
          .update({
            status: 'completed',
            pos_order_id: paymentId
          })
          .eq('pos_draft_order_id', checkoutSessionId)
          .eq('pos_provider', 'clover');
      } else {
        console.log('✅ Order marked as completed');
      }
    }

    // Insert transaction record
    const { data: transaction, error } = await supabase
      .from('pos_transactions')
      .insert({
        merchant_id: integration.user_id,
        external_transaction_id: paymentId,
        pos_provider: 'clover',
        total_amount: totalAmount + barterAmount,
        currency: 'USD',
        barter_amount: barterAmount,
        barter_percentage: barterPercentage,
        cash_amount: totalAmount,
        transaction_date: new Date().toISOString(),
        raw_webhook_data: payload,
        status: 'completed'
      })
      .select()
      .single();

    if (error) {
      console.error('❌ Error inserting transaction:', error);
      return { success: false, error: error.message };
    }

    console.log('✅ Clover Hosted Checkout payment processed:', transaction.id);
    return { success: true, transaction_id: transaction.id };

  } else if (Status === 'DECLINED') {
    console.log('❌ Payment was declined');

    // Find and update the order as failed
    const { error: orderUpdateError } = await supabase
      .from('orders')
      .update({
        status: 'payment_failed',
        metadata: supabase.sql`metadata || jsonb_build_object('payment_declined_at', ${new Date().toISOString()}, 'decline_message', ${Message})`
      })
      .eq('pos_draft_order_id', checkoutSessionId)
      .eq('pos_provider', 'clover');

    if (orderUpdateError) {
      // Try simpler update
      await supabase
        .from('orders')
        .update({ status: 'payment_failed' })
        .eq('pos_draft_order_id', checkoutSessionId)
        .eq('pos_provider', 'clover');
    }

    // Update payment session as failed
    await supabase
      .from('pos_payment_sessions')
      .update({ session_status: 'payment_failed' })
      .eq('pos_order_id', checkoutSessionId)
      .eq('pos_provider', 'clover');

    return { success: true, status: 'declined', message: Message };
  }

  return { success: true, message: 'Status not handled' };
}

/**
 * Handle regular Clover payment webhook (POS payments, not Hosted Checkout)
 */
async function handleRegularPaymentWebhook(
  payload: any,
  supabase: any
): Promise<any> {
  const merchantId = payload.merchantId;

  // Get merchant integration
  const { data: integration } = await supabase
    .from('pos_integrations')
    .select('user_id, config, access_token')
    .eq('provider', 'clover')
    .eq('merchant_id', merchantId)
    .single();

  if (!integration) {
    console.error('❌ No integration found for merchant:', merchantId);
    return { success: false, error: 'Integration not found' };
  }

  // Fetch full payment details from Clover API
  const paymentId = payload.objectId;
  const environment = integration.config?.environment || 'production';
  const paymentDetails = await fetchCloverPayment(
    merchantId,
    paymentId,
    integration.access_token,
    environment
  );

  if (!paymentDetails) {
    return { success: false, error: 'Failed to fetch payment details' };
  }

  // Check for duplicate
  const { data: existing } = await supabase
    .from('pos_transactions')
    .select('id')
    .eq('pos_provider', 'clover')
    .eq('external_transaction_id', paymentId)
    .single();

  if (existing) {
    console.log('⚠️ Duplicate transaction, skipping');
    return { success: true, duplicate: true };
  }

  // Calculate barter split
  const totalAmount = paymentDetails.amount / 100; // Clover uses cents
  const barterConfig = integration.config?.barterPercentage || 25;

  const split = calculateTransactionSplit(
    totalAmount,
    barterConfig,
    paymentDetails.tipAmount / 100 || 0
  );

  // Insert transaction
  const { data: transaction, error } = await supabase
    .from('pos_transactions')
    .insert({
      merchant_id: integration.user_id,
      external_transaction_id: paymentId,
      pos_provider: 'clover',
      total_amount: totalAmount,
      currency: 'USD',
      tax_amount: paymentDetails.taxAmount / 100 || 0,
      tip_amount: paymentDetails.tipAmount / 100 || 0,
      barter_amount: split.barterAmount,
      barter_percentage: split.barterPercentage,
      cash_amount: split.cashAmount,
      card_amount: split.cardAmount,
      transaction_date: new Date(paymentDetails.createdTime).toISOString(),
      raw_webhook_data: payload,
      status: paymentDetails.result === 'SUCCESS' ? 'completed' : 'failed'
    })
    .select()
    .single();

  if (error) {
    console.error('❌ Error inserting transaction:', error);
    return { success: false, error: error.message };
  }

  console.log('✅ Clover transaction processed:', transaction.id);

  // Check if this payment is for a Barter online order
  if (paymentDetails.order?.id) {
    const cloverOrderId = paymentDetails.order.id;
    console.log('🔍 Checking for linked Barter order via Clover order:', cloverOrderId);

    // Try to find and complete any payment session linked to this Clover order
    const { data: sessions } = await supabase
      .from('pos_payment_sessions')
      .select('*')
      .eq('pos_order_id', cloverOrderId)
      .eq('pos_provider', 'clover')
      .in('session_status', ['discount_applied', 'payment_pending'])
      .limit(1);

    if (sessions && sessions.length > 0) {
      const session = sessions[0];
      console.log(`✅ Found payment session: ${session.id}`);

      // Complete the payment session
      const { data: completionResult, error: completeError } = await supabase
        .rpc('complete_pos_payment_session', {
          p_session_id: session.id,
          p_total_amount: totalAmount,
          p_barter_amount: session.barter_amount,
          p_pos_order_id: cloverOrderId
        });

      if (completeError) {
        console.error('⚠️ Error completing session:', completeError);
      } else if (completionResult?.[0]?.success) {
        console.log('✅ Payment session completed, credits transferred');
      }

      // Update the orders table
      const { data: orderUpdateResult, error: orderUpdateError } = await supabase
        .rpc('update_order_from_pos_webhook', {
          p_draft_order_id: cloverOrderId,
          p_pos_order_id: paymentId,
          p_new_status: 'completed'
        });

      if (orderUpdateError) {
        console.error('⚠️ Error updating order:', orderUpdateError.message);
      } else if (orderUpdateResult?.[0]?.success) {
        console.log(`✅ Order marked as completed`);
      }
    }
  }

  return { success: true, transaction_id: transaction.id };
}

/**
 * Handle Clover item create/update webhook
 * Fetches full item details from Clover API and upserts into products table
 */
async function handleCloverItemSync(payload: any, supabase: any): Promise<any> {
  const merchantId = payload.merchantId;
  const itemId = payload.objectId;

  if (!merchantId || !itemId) {
    console.error('❌ Missing merchantId or objectId in Clover item webhook');
    return { success: false, error: 'Missing merchantId or objectId' };
  }

  console.log(`🛍️ Clover item ${payload.type}: ${itemId} for merchant: ${merchantId}`);

  // Find ALL active integrations for this merchant
  const { data: integrations } = await supabase
    .from('pos_integrations')
    .select('id, user_id, access_token, config')
    .eq('provider', 'clover')
    .eq('merchant_id', merchantId)
    .eq('status', 'active');

  if (!integrations || integrations.length === 0) {
    console.error('❌ No Clover integration found for merchant:', merchantId);
    return { success: false, error: 'Integration not found' };
  }

  console.log(`🔁 Syncing item to ${integrations.length} active integration(s)`);

  // Fetch item from Clover API — try each integration's token until one works
  let item: any = null;
  for (const tryIntegration of integrations) {
    const environment = tryIntegration.config?.environment || 'production';
    const baseUrl = environment === 'sandbox'
      ? 'https://apisandbox.dev.clover.com'
      : 'https://api.clover.com';

    const itemResp = await fetch(
      `${baseUrl}/v3/merchants/${merchantId}/items/${itemId}?expand=categories,itemStock`,
      { headers: { 'Authorization': `Bearer ${tryIntegration.access_token}` } }
    );

    if (itemResp.ok) {
      item = await itemResp.json();
      break;
    }
    console.warn(`⚠️ Token for user ${tryIntegration.user_id} failed (${itemResp.status}), trying next...`);
  }

  if (!item) {
    console.error(`❌ All tokens failed to fetch Clover item ${itemId}`);
    return { success: false, error: 'Could not fetch item — all access tokens may be expired' };
  }

  const name = item.name;
  const price = (item.price || 0) / 100;
  const sku = item.sku || null;
  const categoryName = item.categories?.elements?.[0]?.name || null;
  const stockCount = item.itemStock?.quantity || 0;

  // Resolve category once
  let categoryId = null;
  if (categoryName) {
    const { data: category } = await supabase
      .from('product_categories')
      .select('id')
      .ilike('name', categoryName)
      .single();
    categoryId = category?.id || null;
  }

  // Sync product for every active integration
  const results: any[] = [];
  for (const integration of integrations) {
    const { data: business } = await supabase
      .from('businesses')
      .select('id')
      .eq('user_id', integration.user_id)
      .order('created_at', { ascending: true })
      .limit(1)
      .single();

    const { data: existingRows } = await supabase
      .from('products')
      .select('id')
      .eq('pos_integration_id', integration.id)
      .eq('external_product_id', itemId)
      .limit(1);

    const existing = existingRows?.[0] ?? null;

    const productData = {
      merchant_id: integration.user_id,
      business_id: business?.id || null,
      pos_integration_id: integration.id,
      external_product_id: itemId,
      name,
      category_id: categoryId,
      price,
      currency: 'USD',
      stock_quantity: stockCount,
      sku,
      barter_enabled: true,
      is_active: !item.hidden,
      last_synced_at: new Date().toISOString(),
      sync_status: 'synced',
      metadata: { clover_item_id: item.id, synced_via: 'webhook' }
    };

    if (existing) {
      const { error } = await supabase.from('products').update(productData).eq('id', existing.id);
      if (error) {
        console.error(`❌ Error updating product for user ${integration.user_id}:`, error.message);
        results.push({ user_id: integration.user_id, action: 'error', error: error.message });
      } else {
        console.log(`✅ Updated Clover item: ${name} for user ${integration.user_id}`);
        results.push({ user_id: integration.user_id, action: 'updated' });
      }
    } else {
      const { error } = await supabase.from('products').insert(productData);
      if (error) {
        console.error(`❌ Error inserting product for user ${integration.user_id}:`, error.message);
        results.push({ user_id: integration.user_id, action: 'error', error: error.message });
      } else {
        console.log(`✅ Created Clover item: ${name} for user ${integration.user_id}`);
        results.push({ user_id: integration.user_id, action: 'created' });
      }
    }
  }

  return { success: true, results };
}

/**
 * Handle Clover item delete webhook
 * Archives the product in the database
 */
async function handleCloverItemDelete(payload: any, supabase: any): Promise<any> {
  const merchantId = payload.merchantId;
  const itemId = payload.objectId;

  if (!itemId) return { success: false, error: 'Missing objectId' };

  console.log(`🗑️ Clover item deleted: ${itemId} for merchant: ${merchantId}`);

  // Find ALL active integrations for this merchant
  const { data: integrations } = await supabase
    .from('pos_integrations')
    .select('id')
    .eq('provider', 'clover')
    .eq('merchant_id', merchantId)
    .eq('status', 'active');

  if (!integrations || integrations.length === 0) {
    return { success: false, error: 'Integration not found' };
  }

  const integrationIds = integrations.map((i: any) => i.id);

  const { error } = await supabase
    .from('products')
    .update({
      is_active: false,
      is_archived: true,
      sync_status: 'deleted',
      last_synced_at: new Date().toISOString()
    })
    .in('pos_integration_id', integrationIds)
    .eq('external_product_id', itemId);

  if (error) return { success: false, error: error.message };

  console.log(`✅ Archived Clover item: ${itemId} across ${integrations.length} integration(s)`);
  return { success: true, action: 'deleted', count: integrations.length };
}

/**
 * Fetch payment details from Clover API
 */
async function fetchCloverPayment(
  merchantId: string,
  paymentId: string,
  accessToken: string,
  environment: string = 'production'
): Promise<any> {
  try {
    // Use correct API URL based on environment
    // OAuth uses: sandbox.dev.clover.com
    // REST API uses: apisandbox.dev.clover.com
    const baseUrl = environment === 'sandbox'
      ? 'https://apisandbox.dev.clover.com'
      : 'https://api.clover.com';

    console.log(`🔧 Fetching Clover payment from ${environment} environment: ${baseUrl}`);

    const response = await fetch(
      `${baseUrl}/v3/merchants/${merchantId}/payments/${paymentId}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!response.ok) {
      console.error('Failed to fetch Clover payment:', response.status);
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching Clover payment:', error);
    return null;
  }
}
