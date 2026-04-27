import { createHmac } from "https://deno.land/std@0.177.0/node/crypto.ts";
import { calculateTransactionSplit } from '../utils/split-calculator.ts';

/**
 * Handle Square webhook events
 * Docs: https://developer.squareup.com/docs/webhooks/overview
 */
export async function handleSquareWebhook(
  payload: any,
  headers: any,
  supabase: any
): Promise<any> {
  console.log('🟦 Processing Square webhook');

  // Verify webhook signature
  const signature = headers['x-square-hmacsha256-signature'];
  const webhookSignatureKey = Deno.env.get('SQUARE_WEBHOOK_SIGNATURE_KEY');

  console.log('🔐 Signature verification - Key exists:', !!webhookSignatureKey);
  console.log('🔐 Signature exists:', !!signature);

  // if (webhookSignatureKey && signature) {
  //   const isValid =  (
  //     JSON.stringify(payload),
  //     signature,
  //     webhookSignatureKey,
  //     headers['x-square-hmacsha256-timestamp']
  //   );

  //   if (!isValid) {
  //     console.error('❌ Invalid Square signature');
  //     return { success: false, error: 'Invalid signature' };
  //   }
  //   console.log('✅ Signature verified successfully');
  // }

  // Handle catalog version updated event (product create/update/delete)
  if (payload.type === 'catalog.version.updated') {
    console.log('📦 Catalog version updated - syncing product changes');
    return await handleCatalogUpdate(payload, headers, supabase);
  }

  // Handle payment completed event
  if (payload.type === 'payment.created' || payload.type === 'payment.updated') {
    console.log('📝 Event type:', payload.type);
    const payment = payload.data?.object?.payment;

    if (!payment) {
      console.error('❌ No payment data in webhook');
      return { success: false, error: 'No payment data in webhook' };
    }

    console.log('💳 Payment ID:', payment.id);
    console.log('📍 Location ID:', payment.location_id);
    console.log('💰 Amount:', payment.amount_money?.amount / 100);

    // Get merchant by location_id
    console.log('🔍 Looking for integration with store_id:', payment.location_id);
    const { data: integrations, error: integrationError } = await supabase
      .from('pos_integrations')
      .select('user_id, config')
      .eq('provider', 'square')
      .eq('store_id', payment.location_id)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1);

    const integration = integrations?.[0];

    if (integrationError) {
      console.error('❌ Integration lookup error:', integrationError);
    }

    if (!integration) {
      console.error('❌ No integration found for location:', payment.location_id);
      return { success: false, error: 'Integration not found' };
    }

    console.log('✅ Integration found! User ID:', integration.user_id);

    // Check for duplicate
    console.log('🔍 Checking for duplicate transaction:', payment.id);
    const { data: existing, error: duplicateError } = await supabase
      .from('pos_transactions')
      .select('id')
      .eq('pos_provider', 'square')
      .eq('external_transaction_id', payment.id)
      .single();

    if (duplicateError && duplicateError.code !== 'PGRST116') {
      console.error('❌ Duplicate check error:', duplicateError);
    }

    if (existing) {
      console.log('⚠️ Duplicate transaction, skipping');
      return { success: true, duplicate: true };
    }

    console.log('✅ Not a duplicate, proceeding with insert');

    // Calculate barter split
    const totalAmount = payment.amount_money?.amount / 100; // Square uses cents
    const barterConfig = integration.config?.barterPercentage || 25;

    console.log('🧮 Calculating split - Total:', totalAmount, 'Barter %:', barterConfig);

    const split = calculateTransactionSplit(
      totalAmount,
      barterConfig,
      payment.tip_money?.amount / 100 || 0
    );

    console.log('🧮 Split result:', split);

    // Insert transaction
    console.log('💾 Attempting to insert transaction...');
    const { data: transaction, error } = await supabase
      .from('pos_transactions')
      .insert({
        merchant_id: integration.user_id,
        external_transaction_id: payment.id,
        pos_provider: 'square',
        total_amount: totalAmount,
        currency: payment.amount_money?.currency || 'USD',
        tax_amount: payment.tax_money?.amount / 100 || 0,
        tip_amount: payment.tip_money?.amount / 100 || 0,
        barter_amount: split.barterAmount,
        barter_percentage: split.barterPercentage,
        cash_amount: split.cashAmount,
        card_amount: split.cardAmount,
        location_id: payment.location_id,
        transaction_date: payment.created_at,
        webhook_signature: signature,
        raw_webhook_data: payload,
        status: 'completed'
      })
      .select()
      .single();

    if (error) {
      console.error('❌ Error inserting transaction:', error);
      console.error('❌ Error details:', JSON.stringify(error, null, 2));
      return { success: false, error: error.message };
    }

    console.log('✅ Square transaction processed:', transaction.id);

    // Check if this payment is for a Barter online order
    // Square orders have reference_id set to our order number
    if (payment.order_id) {
      console.log('🔍 Checking for linked Barter order via Square order:', payment.order_id);

      // Try to find and complete any payment session linked to this Square order
      const { data: sessions } = await supabase
        .from('pos_payment_sessions')
        .select('*')
        .eq('pos_order_id', payment.order_id)
        .eq('pos_provider', 'square')
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
            p_pos_order_id: payment.order_id
          });

        if (completeError) {
          console.error('⚠️ Error completing session:', completeError);
        } else if (completionResult?.[0]?.success) {
          console.log('✅ Payment session completed, credits transferred');
        }

        // Update the orders table
        const { data: orderUpdateResult, error: orderUpdateError } = await supabase
          .rpc('update_order_from_pos_webhook', {
            p_draft_order_id: payment.order_id,
            p_pos_order_id: payment.id,
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

  // Handle loyalty reward redeemed event
  if (payload.type === 'loyalty.reward.redeemed' || payload.type === 'loyalty.event.created') {
    console.log('🎁 Loyalty event type:', payload.type);
    const loyaltyEvent = payload.data?.object?.loyalty_event;

    if (!loyaltyEvent) {
      console.error('❌ No loyalty event data in webhook');
      return { success: false, error: 'No loyalty event data in webhook' };
    }

    // Only process REDEEM_REWARD events
    if (loyaltyEvent.type !== 'REDEEM_REWARD') {
      console.log('ℹ️  Skipping non-redemption event:', loyaltyEvent.type);
      return { success: true, message: 'Not a redemption event' };
    }

    console.log('🎁 Loyalty Account ID:', loyaltyEvent.loyalty_account_id);
    console.log('💰 Points redeemed:', loyaltyEvent.redeem_reward?.points);

    const loyaltyAccountId = loyaltyEvent.loyalty_account_id;
    const pointsRedeemed = loyaltyEvent.redeem_reward?.points || 0;

    // Find customer by loyalty account ID
    const { data: customerBarcode, error: customerError } = await supabase
      .from('customer_barcodes')
      .select('user_id, barcode')
      .eq('customer_id', loyaltyAccountId)
      .single();

    if (customerError || !customerBarcode) {
      console.error('❌ Customer not found for loyalty account:', loyaltyAccountId);
      return { success: false, error: 'Customer not found' };
    }

    console.log('✅ Customer found:', customerBarcode.user_id);

    // Convert loyalty points back to barter dollars (100 points = $1)
    const barterAmount = pointsRedeemed / 100;

    console.log('💵 Converting', pointsRedeemed, 'points →', barterAmount, 'barter dollars');

    // Deduct barter credits from customer account
    const { data: creditAccount, error: creditError } = await supabase
      .from('credit_accounts')
      .select('balance')
      .eq('user_id', customerBarcode.user_id)
      .single();

    if (creditError || !creditAccount) {
      console.error('❌ Credit account not found');
      return { success: false, error: 'Credit account not found' };
    }

    const currentBalance = creditAccount.balance || 0;
    const newBalance = Math.max(0, currentBalance - barterAmount);

    console.log('💰 Balance:', currentBalance, '→', newBalance);

    // Update balance
    const { error: updateError } = await supabase
      .from('credit_accounts')
      .update({ balance: newBalance })
      .eq('user_id', customerBarcode.user_id);

    if (updateError) {
      console.error('❌ Error updating balance:', updateError);
      return { success: false, error: 'Failed to update balance' };
    }

    // Record transaction
    const { data: transaction, error: txError } = await supabase
      .from('credit_transactions')
      .insert({
        from_user_id: customerBarcode.user_id,
        to_user_id: null, // Merchant gets the barter value
        amount: barterAmount,
        transaction_type: 'barter_payment',
        description: `Barter payment via Square Loyalty - ${loyaltyEvent.id}`,
        metadata: {
          square_loyalty_event_id: loyaltyEvent.id,
          loyalty_account_id: loyaltyAccountId,
          points_redeemed: pointsRedeemed,
          order_id: loyaltyEvent.order_id
        }
      })
      .select()
      .single();

    if (txError) {
      console.error('❌ Error recording transaction:', txError);
      // Don't fail the webhook, transaction was already processed
    }

    console.log('✅ Loyalty redemption processed:', transaction?.id);
    return { success: true, transaction_id: transaction?.id, barter_amount: barterAmount };
  }

  return { success: true, message: 'Event type not handled' };
}

/**
 * Handle Square catalog.version.updated webhook
 * Triggered when any catalog item is created, updated, or deleted.
 *
 * NOTE: Square does NOT include updated_object_ids in this event payload.
 * It only sends the catalog version's updated_at timestamp.
 * We must call the Catalog API with begin_time to discover what changed.
 * Docs: https://developer.squareup.com/docs/catalog-api/webhooks
 */
async function handleCatalogUpdate(
  payload: any,
  headers: any,
  supabase: any
): Promise<any> {
  const merchantId = payload.merchant_id;

  if (!merchantId) {
    console.error('❌ No merchant_id in catalog webhook');
    return { success: false, error: 'Missing merchant_id' };
  }

  const { data: integrations, error } = await supabase
    .from('pos_integrations')
    .select('id, user_id, access_token, config')
    .eq('provider', 'square')
    .eq('merchant_id', merchantId)
    .eq('status', 'active');

  if (error) {
    console.error('❌ Database error:', error);
    return { success: false, error: error.message };
  }

  if (!integrations || integrations.length === 0) {
    console.error('❌ No active Square integration found for merchant:', merchantId);
    return { success: false, error: 'Integration not found' };
  }

  const integration = integrations[0];

  // Square sends the catalog version's updated_at — use it as begin_time
  // Subtract 5 seconds as a buffer to avoid missing items due to clock skew
  const catalogUpdatedAt: string | undefined = payload.data?.object?.catalog_version?.updated_at;
  const beginTime = catalogUpdatedAt
    ? new Date(new Date(catalogUpdatedAt).getTime() - 5000).toISOString()
    : undefined;

  console.log(`📅 Catalog updated_at: ${catalogUpdatedAt}`);
  console.log(`📡 Fetching items updated since: ${beginTime}`);

  const environment = integration.config?.environment || 'production';
  const baseUrl = environment === 'sandbox'
    ? 'https://connect.squareupsandbox.com'
    : 'https://connect.squareup.com';

  // Use SearchCatalogObjects with include_deleted_objects so deleted items are returned too
  const resp = await fetch(`${baseUrl}/v2/catalog/search`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${integration.access_token}`,
      'Square-Version': '2023-12-13',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      object_types: ['ITEM'],
      include_deleted_objects: true,
      begin_time: beginTime
    })
  });

  if (!resp.ok) {
    const errText = await resp.text();
    console.error(`❌ Square catalog list error: ${errText}`);
    return { success: false, error: `Square API error: ${errText}` };
  }

  const catalogData = await resp.json();
  const objects = catalogData.objects || [];

  if (objects.length === 0) {
    console.log('ℹ️ No catalog items returned from Square for this version update');
    return { success: true, message: 'No updated items found' };
  }

  console.log(`📦 Processing ${objects.length} updated catalog item(s)`);

  // Get merchant's first business
  const { data: business } = await supabase
    .from('businesses')
    .select('id')
    .eq('user_id', integration.user_id)
    .order('created_at', { ascending: true })
    .limit(1)
    .single();

  const results = [];

  for (const obj of objects) {
    try {
      // Archive if deleted
      if (obj.is_deleted) {
        await supabase
          .from('products')
          .update({
            is_active: false,
            is_archived: true,
            sync_status: 'deleted',
            last_synced_at: new Date().toISOString()
          })
          .eq('pos_integration_id', integration.id)
          .eq('external_product_id', obj.id);

        console.log(`🗑️ Archived deleted product: ${obj.id}`);
        results.push({ id: obj.id, success: true, action: 'deleted' });
        continue;
      }

      // Only process ITEM type (CATEGORY, TAX, etc. are filtered out by the API call but guard anyway)
      if (obj.type !== 'ITEM') {
        results.push({ id: obj.id, success: true, skipped: true, reason: `type=${obj.type}` });
        continue;
      }

      // Sync each variation as a separate product row
      const variations = obj.item_data?.variations || [];
      if (variations.length === 0) {
        await upsertSquareProduct(obj, null, integration, business?.id, supabase);
        results.push({ id: obj.id, success: true, action: 'synced' });
      } else {
        for (const variation of variations) {
          await upsertSquareProduct(obj, variation, integration, business?.id, supabase);
        }
        results.push({ id: obj.id, success: true, action: 'synced', variants: variations.length });
      }

    } catch (err: any) {
      console.error(`❌ Error syncing object ${obj.id}:`, err.message);
      results.push({ id: obj.id, success: false, error: err.message });
    }
  }

  const successCount = results.filter(r => r.success).length;
  console.log(`✅ Catalog sync: ${successCount}/${results.length} objects processed`);
  return { success: true, processed: results.length, synced: successCount, results };
}

/**
 * Upsert a single Square catalog item (+ variation) into the products table
 */
async function upsertSquareProduct(
  item: any,
  variation: any | null,
  integration: any,
  businessId: string | null,
  supabase: any
): Promise<void> {
  const itemData = item.item_data;
  const variationData = variation?.item_variation_data;

  const productId = item.id;
  const variationId = variation?.id || null;
  const name = variationId && variationData?.name && variationData.name !== 'Regular'
    ? `${itemData.name} - ${variationData.name}`
    : itemData.name;

  const description = itemData.description || null;
  const categoryName = itemData.category_name || null;
  const priceAmount = variationData?.price_money?.amount
    ? variationData.price_money.amount / 100
    : 0;
  const currency = variationData?.price_money?.currency || 'USD';
  const sku = variationData?.sku || null;
  const upc = variationData?.upc || null;

  // Get category from DB
  let categoryId = null;
  if (categoryName) {
    const { data: category } = await supabase
      .from('product_categories')
      .select('id')
      .ilike('name', categoryName)
      .single();
    categoryId = category?.id || null;
  }

  // Check if product already exists
  const { data: existing } = await supabase
    .from('products')
    .select('id')
    .eq('pos_integration_id', integration.id)
    .eq('external_product_id', productId)
    .eq('external_variant_id', variationId)
    .maybeSingle();

  const productData = {
    merchant_id: integration.user_id,
    business_id: businessId,
    pos_integration_id: integration.id,
    external_product_id: productId,
    external_variant_id: variationId,
    name,
    description,
    category_id: categoryId,
    price: priceAmount,
    currency,
    sku,
    upc,
    barcode: upc,
    barter_enabled: true,
    is_active: true,
    last_synced_at: new Date().toISOString(),
    sync_status: 'synced',
    metadata: {
      square_version: item.version,
      square_category_id: itemData.category_id,
      synced_via: 'webhook'
    }
  };

  if (existing) {
    const { error } = await supabase.from('products').update(productData).eq('id', existing.id);
    if (error) throw new Error(`Failed to update: ${error.message}`);
    console.log(`  🔄 Updated: ${name}`);
  } else {
    const { error } = await supabase.from('products').insert(productData);
    if (error) throw new Error(`Failed to insert: ${error.message}`);
    console.log(`  ➕ Created: ${name}`);
  }
}

/**
 * Verify Square webhook signature
 */
function verifySquareSignature(
  body: string,
  signature: string,
  signatureKey: string,
  timestamp: string
): boolean {
  const payload = timestamp + '.' + body;
  const hmac = createHmac('sha256', signatureKey);
  hmac.update(payload);
  const expectedSignature = hmac.digest('base64');
  
  return signature === expectedSignature;
}
