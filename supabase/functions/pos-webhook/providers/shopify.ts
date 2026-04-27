import { createHmac } from "https://deno.land/std@0.177.0/node/crypto.ts";
import { calculateTransactionSplit } from '../utils/split-calculator.ts';

/**
 * Handle Shopify POS webhook events
 * Docs: https://shopify.dev/docs/api/admin-rest/2023-10/resources/webhook
 * Supports: orders/create, products/create, products/update, products/delete
 */
export async function handleShopifyWebhook(
  payload: any,
  headers: any,
  supabase: any
): Promise<any> {
  console.log('🟩 Processing Shopify webhook');

  // Log ALL headers for debugging
  console.log('📋 All webhook headers:', JSON.stringify(headers, null, 2));

  // Verify webhook signature
  const signature = headers['x-shopify-hmac-sha256'];
  const webhookSecret = Deno.env.get('SHOPIFY_WEBHOOK_SECRET');

  console.log('🔐 Signature verification check:');
  console.log('   Has webhookSecret?', !!webhookSecret);
  console.log('   Has signature?', !!signature);
  console.log('   Signature (first 20 chars):', signature ? signature.substring(0, 20) + '...' : 'none');

  if (webhookSecret && signature) {
    const bodyString = JSON.stringify(payload);
    console.log('   Body length:', bodyString.length);
    console.log('   Body (first 100 chars):', bodyString.substring(0, 100) + '...');

    const isValid = verifyShopifySignature(
      bodyString,
      signature,
      webhookSecret
    );

    console.log('   Signature isValid?', isValid);

    if (!isValid) {
      console.error('❌ Invalid Shopify signature - BYPASSING FOR DEBUG');
      console.error('   This should be fixed in production!');
      // TEMPORARY: Don't return, continue processing for debugging
      // return { success: false, error: 'Invalid signature' };
    } else {
      console.log('✅ Signature verified successfully');
    }
  } else {
    console.log('⚠️ Signature verification skipped (missing secret or signature)');
  }

  const topic = headers['x-shopify-topic'];
  console.log('📦 Webhook topic:', topic);
  console.log('📦 Payload keys:', Object.keys(payload));
  console.log('📦 Full payload:', JSON.stringify(payload, null, 2));
  console.log('📦 Draft order ID:', payload.id);
  console.log('📦 Draft order status:', payload.status);
  console.log('📦 Order ID (if completed):', payload.order_id);

  // Handle product webhooks
  if (topic?.startsWith('products/')) {
    return await handleProductWebhook(topic, payload, headers, supabase);
  }

  // Handle draft order webhooks (for split payment)
  if (topic?.startsWith('draft_orders/')) {
    try {
      console.log('🎯 Routing to draft order handler...');
      const result = await handleDraftOrderWebhook(topic, payload, headers, supabase);
      console.log('✅ Draft order handler result:', JSON.stringify(result, null, 2));
      return result;
    } catch (error) {
      console.error('❌ ERROR in draft order handler:', error);
      console.error('❌ Error stack:', error.stack);
      return { success: false, error: error.message };
    }
  }

  // Handle POS order completion (orders/create from POS Extension)
  if (topic === 'orders/create' || topic === 'orders/paid') {
    try {
      console.log('🎯 Routing to POS order handler...');
      const result = await handlePOSOrderCompletion(topic, payload, headers, supabase);
      console.log('✅ POS order handler result:', JSON.stringify(result, null, 2));
      return result;
    } catch (error) {
      console.error('❌ ERROR in POS order handler:', error);
      console.error('❌ Error stack:', error.stack);
      return { success: false, error: error.message };
    }
  }

  // Handle order created/updated event
  if (payload.id && payload.total_price) {
    // Get merchant by shop domain
    const shopDomain = headers['x-shopify-shop-domain'];
    
    const { data: integration } = await supabase
      .from('pos_integrations')
      .select('user_id, config')
      .eq('provider', 'shopify')
      .eq('store_id', shopDomain)
      .single();

    if (!integration) {
      console.error('❌ No integration found for shop:', shopDomain);
      return { success: false, error: 'Integration not found' };
    }

    // Check for duplicate
    const { data: existing } = await supabase
      .from('pos_transactions')
      .select('id')
      .eq('pos_provider', 'shopify')
      .eq('external_transaction_id', payload.id.toString())
      .single();

    if (existing) {
      console.log('⚠️ Duplicate transaction, skipping');
      return { success: true, duplicate: true };
    }

    // Calculate barter split
    const totalAmount = parseFloat(payload.total_price);
    const barterConfig = integration.config?.barterPercentage || 25;
    
    const split = calculateTransactionSplit(
      totalAmount,
      barterConfig,
      parseFloat(payload.total_tip_received || 0)
    );

    // Parse line items
    const items = payload.line_items?.map((item: any) => ({
      name: item.title,
      quantity: item.quantity,
      price: parseFloat(item.price),
      sku: item.sku
    })) || [];

    // Insert transaction
    const { data: transaction, error } = await supabase
      .from('pos_transactions')
      .insert({
        merchant_id: integration.user_id,
        external_transaction_id: payload.id.toString(),
        pos_provider: 'shopify',
        total_amount: totalAmount,
        currency: payload.currency || 'USD',
        tax_amount: parseFloat(payload.total_tax || 0),
        tip_amount: parseFloat(payload.total_tip_received || 0),
        discount_amount: parseFloat(payload.total_discounts || 0),
        barter_amount: split.barterAmount,
        barter_percentage: split.barterPercentage,
        cash_amount: split.cashAmount,
        card_amount: split.cardAmount,
        items: items,
        customer_info: payload.customer ? {
          id: payload.customer.id,
          email: payload.customer.email,
          name: `${payload.customer.first_name} ${payload.customer.last_name}`
        } : null,
        location_id: payload.location_id?.toString(),
        transaction_date: payload.created_at,
        webhook_signature: signature,
        raw_webhook_data: payload,
        status: payload.financial_status === 'paid' ? 'completed' : 'pending'
      })
      .select()
      .single();

    if (error) {
      console.error('❌ Error inserting transaction:', error);
      return { success: false, error: error.message };
    }

    console.log('✅ Shopify transaction processed:', transaction.id);
    return { success: true, transaction_id: transaction.id };
  }

  return { success: true, message: 'Event type not handled' };
}

/**
 * Handle product webhook events (create, update, delete)
 */
async function handleProductWebhook(
  topic: string,
  payload: any,
  headers: any,
  supabase: any
): Promise<any> {
  const shopDomain = headers['x-shopify-shop-domain'];

  // Get ALL merchant integrations for this store
  // Product webhooks are store-wide, not merchant-specific
  // All merchants who integrated this store need the product synced
  const { data: integrations, error: integrationError } = await supabase
    .from('pos_integrations')
    .select('user_id, id, config')
    .eq('provider', 'shopify')
    .eq('store_id', shopDomain)
    .eq('status', 'active');

  if (integrationError) {
    console.error('❌ Error querying integrations:', integrationError);
    return { success: false, error: `Database error: ${integrationError.message}` };
  }

  if (!integrations || integrations.length === 0) {
    console.error('❌ No integrations found for shop:', shopDomain);
    return { success: false, error: 'No integrations found' };
  }

  console.log(`✅ Found ${integrations.length} merchant(s) for store ${shopDomain}`);
  console.log(`   Will sync product for all merchants`);

  const externalProductId = payload.id.toString();
  const results = [];

  // Sync product for each merchant who integrated this store
  for (const integration of integrations) {
    console.log(`\n📦 Syncing product for merchant: ${integration.user_id}`);

    // Get merchant's first business for product association
    const { data: business } = await supabase
      .from('businesses')
      .select('id')
      .eq('user_id', integration.user_id)
      .order('created_at', { ascending: true })
      .limit(1)
      .single();

    if (!business) {
      console.error(`❌ No business found for merchant: ${integration.user_id}`);
      results.push({ merchant_id: integration.user_id, success: false, error: 'No business found' });
      continue;
    }

    const result = await syncProductForMerchant(topic, payload, externalProductId, integration, business, supabase);
    results.push({ merchant_id: integration.user_id, ...result });
  }

  const successCount = results.filter(r => r.success).length;
  console.log(`\n✅ Product sync complete: ${successCount}/${integrations.length} merchants synced`);

  return {
    success: true,
    synced_merchants: successCount,
    total_merchants: integrations.length,
    results
  };
}

/**
 * Sync product for a single merchant
 */
async function syncProductForMerchant(
  topic: string,
  payload: any,
  externalProductId: string,
  integration: any,
  business: any,
  supabase: any
): Promise<any> {

  // Handle product deletion
  if (topic === 'products/delete') {
    console.log('🗑️ Deleting product:', externalProductId);

    const { error } = await supabase
      .from('products')
      .update({
        is_active: false,
        is_archived: true,
        updated_at: new Date().toISOString()
      })
      .eq('external_product_id', externalProductId)
      .eq('pos_integration_id', integration.id);

    if (error) {
      console.error('❌ Error archiving product:', error);
      return { success: false, error: error.message };
    }

    console.log('✅ Product archived successfully');
    return { success: true, action: 'deleted' };
  }

  // Handle product create/update
  const variants = payload.variants || [];
  const mainVariant = variants[0] || {};

  // Get or create product category
  let categoryId = null;
  if (payload.product_type) {
    const { data: category } = await supabase
      .from('product_categories')
      .select('id')
      .eq('name', payload.product_type)
      .single();

    if (category) {
      categoryId = category.id;
    } else {
      // Create new category
      const { data: newCategory } = await supabase
        .from('product_categories')
        .insert({
          name: payload.product_type,
          barter_enabled: true,
          is_restricted: false
        })
        .select('id')
        .single();

      categoryId = newCategory?.id;
    }
  }

  // Check if product already exists
  const { data: existingProduct } = await supabase
    .from('products')
    .select('id')
    .eq('external_product_id', externalProductId)
    .eq('pos_integration_id', integration.id)
    .single();

  const productData = {
    merchant_id: integration.user_id,
    business_id: business.id,
    pos_integration_id: integration.id,
    external_product_id: externalProductId,
    external_variant_id: mainVariant.id?.toString(),
    name: payload.title,
    description: payload.body_html?.replace(/<[^>]*>/g, '') || null, // Strip HTML
    sku: mainVariant.sku,
    barcode: mainVariant.barcode,
    price: parseFloat(mainVariant.price || 0),
    cost: parseFloat(mainVariant.compare_at_price || 0),
    category_id: categoryId,
    stock_quantity: mainVariant.inventory_quantity || 0,
    image_url: payload.image?.src || null,
    is_active: payload.status === 'active',
    is_archived: false,
    barter_enabled: true,
    metadata: {
      vendor: payload.vendor,
      tags: payload.tags,
      variant_count: variants.length,
      shopify_handle: payload.handle
    }
  };

  if (existingProduct) {
    // Update existing product
    console.log('📝 Updating product:', externalProductId);

    const { error } = await supabase
      .from('products')
      .update({
        ...productData,
        updated_at: new Date().toISOString()
      })
      .eq('id', existingProduct.id);

    if (error) {
      console.error('❌ Error updating product:', error);
      return { success: false, error: error.message };
    }

    console.log('✅ Product updated successfully');
    return { success: true, action: 'updated', product_id: existingProduct.id };
  } else {
    // Create new product
    console.log('➕ Creating product:', payload.title);

    const { data: newProduct, error } = await supabase
      .from('products')
      .insert(productData)
      .select('id')
      .single();

    if (error) {
      console.error('❌ Error creating product:', error);
      return { success: false, error: error.message };
    }

    console.log('✅ Product created successfully');
    return { success: true, action: 'created', product_id: newProduct.id };
  }
}

/**
 * Handle POS order completion from POS Extension
 * Triggered when an order is completed in Shopify POS after barter discount applied
 */
async function handlePOSOrderCompletion(
  topic: string,
  payload: any,
  headers: any,
  supabase: any
): Promise<any> {
  const shopDomain = headers['x-shopify-shop-domain'];
  const orderId = payload.id?.toString();

  console.log('🛒 POS Order Completion Webhook');
  console.log(`   Order ID: ${orderId}`);
  console.log(`   Shop: ${shopDomain}`);
  console.log(`   Total: ${payload.total_price}`);
  console.log(`   Financial Status: ${payload.financial_status}`);

  // Only process paid orders
  if (payload.financial_status !== 'paid') {
    console.log(`⏭️ Skipping - order not paid yet (status: ${payload.financial_status})`);
    return { success: true, message: 'Order not paid yet' };
  }

  // Check if this order has a barter discount applied
  const discounts = payload.discount_applications || [];
  const barterDiscount = discounts.find((d: any) =>
    d.title?.includes('Barter') || d.description?.includes('Barter')
  );

  if (!barterDiscount) {
    console.log('⏭️ No barter discount found - skipping');
    return { success: true, message: 'No barter discount' };
  }

  console.log(`💰 Barter discount found: $${barterDiscount.value}`);

  // Try to find payment session by looking for a session with matching amount and status
  // The POS extension should have created a session and set it to 'discount_applied'
  const barterAmount = parseFloat(barterDiscount.value);

  const { data: sessions } = await supabase
    .from('pos_payment_sessions')
    .select('*')
    .eq('session_status', 'discount_applied')
    .gte('barter_amount', barterAmount - 0.01) // Allow small rounding difference
    .lte('barter_amount', barterAmount + 0.01)
    .order('created_at', { ascending: false })
    .limit(5); // Get recent sessions

  if (!sessions || sessions.length === 0) {
    console.error('❌ No matching payment session found');
    console.error(`   Looking for barter amount: $${barterAmount}`);
    return { success: false, error: 'No matching payment session' };
  }

  // Use the most recent session
  const session = sessions[0];
  console.log(`✅ Found payment session: ${session.id}`);
  console.log(`   Customer: ${session.customer_id}`);
  console.log(`   Merchant: ${session.merchant_id}`);

  // Calculate totals
  const totalAmount = parseFloat(payload.total_price);
  const cashAmount = totalAmount; // Customer already paid this

  console.log(`💰 Processing credit transfer:`);
  console.log(`   Total Order: $${totalAmount + barterAmount} (before discount)`);
  console.log(`   Barter Credits: $${barterAmount}`);
  console.log(`   Cash Paid: $${cashAmount}`);

  // Transfer credits using RPC function
  const { data: result, error: completeError } = await supabase
    .rpc('complete_pos_payment_session', {
      p_session_id: session.id,
      p_total_amount: totalAmount + barterAmount, // Original total before discount
      p_barter_amount: barterAmount,
      p_pos_order_id: orderId
    });

  console.log(`📊 RPC call result:`, JSON.stringify({ data: result, error: completeError }, null, 2));

  if (completeError || !result || result.length === 0) {
    console.error('❌ Failed to complete session:', completeError);
    return { success: false, error: completeError?.message || 'Failed to transfer credits' };
  }

  const completionResult = result[0];

  if (!completionResult.success) {
    console.error('❌ Session completion failed:', completionResult.error_message);
    return { success: false, error: completionResult.error_message };
  }

  console.log('✅ Credits transferred successfully!');
  console.log(`   Transaction ID: ${completionResult.transaction_id}`);

  // Write to pos_transactions so Analytics / Daily Summary / realtime subscription can see it
  const origTotal = totalAmount + barterAmount;
  const barterPct = origTotal > 0 ? (barterAmount / origTotal) * 100 : 0;
  const { error: posInsertError } = await supabase
    .from('pos_transactions')
    .upsert({
      merchant_id: session.merchant_id,
      external_transaction_id: orderId,
      pos_provider: 'shopify',
      total_amount: origTotal,
      currency: payload.currency || 'USD',
      barter_amount: barterAmount,
      barter_percentage: barterPct,
      cash_amount: 0,
      card_amount: totalAmount,
      transaction_date: new Date().toISOString(),
      raw_webhook_data: payload,
      status: 'completed',
    }, { onConflict: 'pos_provider,external_transaction_id', ignoreDuplicates: true });

  if (posInsertError) {
    console.error('⚠️ Failed to write pos_transaction record:', posInsertError.message);
    // Not fatal — credits already transferred
  } else {
    console.log('✅ pos_transactions record written');
  }

  return {
    success: true,
    transaction_id: completionResult.transaction_id,
    session_id: session.id,
    barter_amount: barterAmount,
    order_id: orderId
  };
}

/**
 * Verify Shopify webhook signature
 */
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

  console.log(`📋 Draft order webhook: ${topic}`);
  console.log(`📋 Shop domain: "${shopDomain}"`);
  console.log(`📋 Draft order ID: ${draftOrderId}`);

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
    console.log(`💰 Calling complete_pos_payment_session with:`);
    console.log(`   p_session_id: ${session.id}`);
    console.log(`   p_total_amount: ${parseFloat(payload.total_price || session.total_amount)}`);
    console.log(`   p_barter_amount: ${session.barter_amount}`);
    console.log(`   p_pos_order_id: ${orderId}`);

    // Complete the payment session (transfer credits)
    const { data: result, error: completeError } = await supabase
      .rpc('complete_pos_payment_session', {
        p_session_id: session.id,
        p_total_amount: parseFloat(payload.total_price || session.total_amount),
        p_barter_amount: session.barter_amount,
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

    // Write to pos_transactions so Analytics / Daily Summary / realtime subscription can see it
    const draftTotal = parseFloat(payload.total_price || session.total_amount || '0');
    const draftBarter = session.barter_amount;
    const draftOrigTotal = draftTotal + draftBarter;
    const draftBarterPct = draftOrigTotal > 0 ? (draftBarter / draftOrigTotal) * 100 : 0;
    const { error: posInsertError } = await supabase
      .from('pos_transactions')
      .upsert({
        merchant_id: session.merchant_id,
        external_transaction_id: orderId,
        pos_provider: 'shopify',
        total_amount: draftOrigTotal,
        currency: payload.currency || 'USD',
        barter_amount: draftBarter,
        barter_percentage: draftBarterPct,
        cash_amount: 0,
        card_amount: draftTotal,
        transaction_date: new Date().toISOString(),
        raw_webhook_data: payload,
        status: 'completed',
      }, { onConflict: 'pos_provider,external_transaction_id', ignoreDuplicates: true });

    if (posInsertError) {
      console.error('⚠️ Failed to write pos_transaction record:', posInsertError.message);
      // Not fatal — credits already transferred
    } else {
      console.log('✅ pos_transactions record written');
    }

    // Also update the orders table if this was an online order
    console.log(`🔍 Checking for linked online order...`);
    const { data: orderUpdateResult, error: orderUpdateError } = await supabase
      .rpc('update_order_from_pos_webhook', {
        p_draft_order_id: draftOrderId,
        p_pos_order_id: orderId,
        p_new_status: 'completed'
      });

    if (orderUpdateError) {
      console.error(`⚠️ Error updating order: ${orderUpdateError.message}`);
      // Don't fail - payment session was completed successfully
    } else if (orderUpdateResult && orderUpdateResult.length > 0) {
      const updateResult = orderUpdateResult[0];
      if (updateResult.success) {
        console.log(`✅ Order ${updateResult.order_id} marked as completed`);
      } else {
        console.log(`ℹ️ No linked order found (this may be a POS-only transaction)`);
      }
    }

    return {
      success: true,
      transaction_id: completionResult.transaction_id,
      message: 'Barter credits transferred'
    };
  }

  // Handle draft order deletion (cancelled before completion)
  if (topic === 'draft_orders/delete') {
    console.log(`🗑️ Draft order deleted: ${draftOrderId}`);

    // Find and rollback any active sessions by draft order ID
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

    // Also update any linked orders to cancelled status
    const { error: orderCancelError } = await supabase
      .from('orders')
      .update({
        status: 'cancelled',
        cancellation_reason: 'Draft order was deleted in Shopify',
        cancelled_at: new Date().toISOString()
      })
      .eq('pos_draft_order_id', draftOrderId);

    if (orderCancelError) {
      console.log(`⚠️ No linked order found or error updating: ${orderCancelError.message}`);
    } else {
      console.log(`✅ Linked order cancelled`);
    }

    return { success: true, message: 'Sessions rolled back, order cancelled' };
  }

  return { success: true, message: 'Event type handled' };
}

function verifyShopifySignature(
  body: string,
  signature: string,
  secret: string
): boolean {
  const hmac = createHmac('sha256', secret);
  hmac.update(body);
  const expectedSignature = hmac.digest('base64');

  return signature === expectedSignature;
}
