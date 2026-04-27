import { calculateTransactionSplit } from '../utils/split-calculator.ts';
import { createHmac } from "https://deno.land/std@0.177.0/node/crypto.ts";

/**
 * Handle Lightspeed webhook events
 * Docs: https://x-series-api.lightspeedhq.com/docs/webhooks
 *
 * Supports:
 * - sale.update / sale.complete - Transaction events (including layby completion)
 * - product.create / product.update / product.delete - Inventory sync
 */
export async function handleLightspeedWebhook(
  payload: any,
  headers: any,
  supabase: any
): Promise<any> {
  console.log('🟦 Processing Lightspeed webhook');

  // Verify HMAC signature
  const signature = headers['x-signature'];
  if (signature) {
    const isValid = verifyLightspeedSignature(payload, signature);
    if (!isValid) {
      console.error('❌ Invalid Lightspeed webhook signature');
      return { success: false, error: 'Invalid signature' };
    }
  }

  // Parse form-encoded payload
  let saleData;
  if (typeof payload === 'string') {
    try {
      const parsed = new URLSearchParams(payload);
      saleData = JSON.parse(parsed.get('payload') || '{}');
    } catch (e) {
      console.error('Failed to parse payload:', e);
      return { success: false, error: 'Invalid payload format' };
    }
  } else if (payload.payload) {
    saleData = typeof payload.payload === 'string' ? JSON.parse(payload.payload) : payload.payload;
  } else {
    saleData = payload;
  }

  // Check event type from payload
  const eventType = saleData.event_type || saleData.eventType || null;
  const saleStatus = saleData.status || saleData.saleStatus || null;

  console.log('📌 Event type:', eventType);
  console.log('📌 Sale status:', saleStatus);

  // Handle product events (create, update, delete)
  if (eventType && eventType.startsWith('product.')) {
    return await handleProductEvent(saleData, supabase);
  }

  // Handle sale.complete event (layby/pending sale was paid)
  if (eventType === 'sale.complete' || eventType === 'sale.completed' ||
      saleStatus === 'complete' || saleStatus === 'completed') {
    console.log('💳 Sale completed - checking for pending barter order');
    return await handleSaleCompleted(saleData, supabase);
  }

  // Handle sale.update event
  if (saleData && saleData.saleID) {
    const saleId = saleData.saleID;
    const accountId = saleData.accountID;

    // Get merchant integration
    const { data: integration } = await supabase
      .from('pos_integrations')
      .select('user_id, config, access_token, store_id')
      .eq('provider', 'lightspeed')
      .eq('merchant_id', accountId)
      .single();

    if (!integration) {
      console.error('❌ No integration found for account:', accountId);
      return { success: false, error: 'Integration not found' };
    }

    // Check for duplicate
    const { data: existing } = await supabase
      .from('pos_transactions')
      .select('id')
      .eq('pos_provider', 'lightspeed')
      .eq('external_transaction_id', saleId.toString())
      .single();

    if (existing) {
      console.log('⚠️ Duplicate transaction, skipping');
      return { success: true, duplicate: true };
    }

    // Fetch full sale details from Lightspeed API
    const saleDetails = await fetchLightspeedSale(
      integration.store_id,
      saleId,
      integration.access_token
    );

    if (!saleDetails) {
      return { success: false, error: 'Failed to fetch sale details' };
    }

    // Calculate totals
    const totalAmount = parseFloat(saleDetails.total || '0');
    const taxAmount = parseFloat(saleDetails.totalTax || '0');
    const barterConfig = integration.config?.barterPercentage || 25;

    const split = calculateTransactionSplit(
      totalAmount,
      barterConfig,
      0 // No tip for now
    );

    // Insert transaction
    const { data: transaction, error } = await supabase
      .from('pos_transactions')
      .insert({
        merchant_id: integration.user_id,
        external_transaction_id: saleId.toString(),
        pos_provider: 'lightspeed',
        total_amount: totalAmount,
        currency: 'USD',
        tax_amount: taxAmount,
        tip_amount: 0,
        barter_amount: split.barterAmount,
        barter_percentage: split.barterPercentage,
        cash_amount: split.cashAmount,
        card_amount: split.cardAmount,
        transaction_date: saleDetails.createTime || new Date().toISOString(),
        raw_webhook_data: saleData,
        status: saleDetails.completed ? 'completed' : 'pending'
      })
      .select()
      .single();

    if (error) {
      console.error('❌ Error inserting transaction:', error);
      return { success: false, error: error.message };
    }

    console.log('✅ Lightspeed transaction processed:', transaction.id);
    return { success: true, transaction_id: transaction.id };
  }

  return { success: true, message: 'Event type not handled' };
}

/**
 * Handle sale completed event (layby/pending sale was paid)
 * This is triggered when a customer pays for a pending barter order
 */
async function handleSaleCompleted(saleData: any, supabase: any): Promise<any> {
  const saleId = saleData.saleID || saleData.sale_id || saleData.id;
  const accountId = saleData.accountID || saleData.account_id;

  if (!saleId) {
    console.log('⚠️ No sale ID in completed event');
    return { success: true, message: 'No sale ID' };
  }

  console.log(`💰 Processing completed sale: ${saleId}`);

  // Find the payment session for this sale
  const { data: session, error: sessionError } = await supabase
    .from('pos_payment_sessions')
    .select('*, orders!inner(*)')
    .eq('pos_provider', 'lightspeed')
    .eq('pos_order_id', saleId.toString())
    .eq('session_status', 'discount_applied')
    .single();

  if (sessionError || !session) {
    console.log('⚠️ No pending payment session found for sale:', saleId);
    // This might be a regular POS sale, not a barter order
    return { success: true, message: 'No pending barter session' };
  }

  console.log(`✅ Found barter order: ${session.orders.order_number}`);
  console.log(`   Barter amount: $${session.barter_amount}`);
  console.log(`   Customer ID: ${session.customer_id}`);

  // Get integration for this merchant
  const { data: integration } = await supabase
    .from('pos_integrations')
    .select('user_id, config')
    .eq('id', session.pos_integration_id)
    .single();

  if (!integration) {
    console.error('❌ Integration not found for session');
    return { success: false, error: 'Integration not found' };
  }

  // Complete the payment session - transfer barter credits
  try {
    const { data: result, error: rpcError } = await supabase.rpc('complete_pos_payment_session', {
      p_session_id: session.id,
      p_total_amount: session.total_amount,
      p_barter_amount: session.barter_amount,
      p_pos_order_id: saleId.toString()
    });

    if (rpcError) {
      console.error('❌ Error completing payment session:', rpcError);
      return { success: false, error: rpcError.message };
    }

    console.log('✅ Payment session completed, credits transferred');

    // Update order status
    const { error: orderError } = await supabase
      .from('orders')
      .update({
        status: 'completed',
        pos_payment_id: saleId.toString(),
        completed_at: new Date().toISOString(),
        metadata: {
          ...session.orders.metadata,
          lightspeed_payment_completed_at: new Date().toISOString(),
          payment_confirmed_via: 'webhook'
        }
      })
      .eq('id', session.orders.id);

    if (orderError) {
      console.error('⚠️ Error updating order status:', orderError);
    }

    // Record transaction
    const { error: txError } = await supabase
      .from('pos_transactions')
      .insert({
        merchant_id: integration.user_id,
        external_transaction_id: saleId.toString(),
        pos_provider: 'lightspeed',
        total_amount: session.total_amount,
        currency: 'USD',
        tax_amount: session.orders.tax_amount || 0,
        tip_amount: 0,
        barter_amount: session.barter_amount,
        barter_percentage: session.barter_percentage,
        cash_amount: session.cash_amount || 0,
        card_amount: session.card_amount || (session.total_amount - session.barter_amount - (session.cash_amount || 0)),
        transaction_date: new Date().toISOString(),
        raw_webhook_data: saleData,
        status: 'completed'
      });

    if (txError) {
      console.error('⚠️ Error recording transaction:', txError);
    }

    console.log('🎉 Lightspeed sale completion processed successfully');

    return {
      success: true,
      order_id: session.orders.id,
      order_number: session.orders.order_number,
      barter_amount: session.barter_amount,
      message: 'Payment confirmed, credits transferred'
    };

  } catch (error: any) {
    console.error('❌ Error processing sale completion:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Verify Lightspeed HMAC signature
 */
function verifyLightspeedSignature(payload: string, signatureHeader: string): boolean {
  try {
    const clientSecret = Deno.env.get('LIGHTSPEED_OAUTH_CLIENT_SECRET');
    if (!clientSecret) {
      console.error('Missing LIGHTSPEED_OAUTH_CLIENT_SECRET');
      return false;
    }

    // Parse signature header: signature=XXX,algorithm=HMAC-SHA256
    const parts = signatureHeader.split(',');
    const sigMap: Record<string, string> = {};
    parts.forEach(part => {
      const [key, value] = part.split('=');
      sigMap[key.trim()] = value.trim();
    });

    const providedSignature = sigMap['signature'];
    const algorithm = sigMap['algorithm'] || 'HMAC-SHA256';

    if (algorithm !== 'HMAC-SHA256') {
      console.error('Unsupported signature algorithm:', algorithm);
      return false;
    }

    // Compute HMAC
    const hmac = createHmac('sha256', clientSecret);
    hmac.update(payload);
    const computedSignature = hmac.digest('hex');

    return computedSignature === providedSignature;
  } catch (error) {
    console.error('Error verifying signature:', error);
    return false;
  }
}

/**
 * Fetch sale details from Lightspeed API
 */
async function fetchLightspeedSale(
  storeId: string,
  saleId: number,
  accessToken: string
): Promise<any> {
  try {
    const response = await fetch(
      `https://${storeId}.retail.lightspeed.app/api/1.0/sale/${saleId}.json`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!response.ok) {
      console.error('Failed to fetch Lightspeed sale:', response.status);
      return null;
    }

    const data = await response.json();
    return data.Sale;
  } catch (error) {
    console.error('Error fetching Lightspeed sale:', error);
    return null;
  }
}

/**
 * Handle product events (create, update, delete)
 * Syncs product changes from Lightspeed in real-time
 */
async function handleProductEvent(eventData: any, supabase: any): Promise<any> {
  console.log('🛍️ Processing Lightspeed product event');

  const eventType = eventData.event_type || eventData.eventType;
  const productId = eventData.product_id || eventData.productID || eventData.id;
  const accountId = eventData.account_id || eventData.accountID;

  if (!productId || !accountId) {
    console.error('❌ Missing product_id or account_id in payload');
    return { success: false, error: 'Missing required fields' };
  }

  console.log(`📦 Product ${productId} - Event: ${eventType}`);

  // Get merchant integration
  const { data: integration } = await supabase
    .from('pos_integrations')
    .select('id, user_id, business_id, access_token, store_id')
    .eq('provider', 'lightspeed')
    .eq('merchant_id', accountId)
    .single();

  if (!integration) {
    console.error('❌ No integration found for account:', accountId);
    return { success: false, error: 'Integration not found' };
  }

  // Handle delete event
  if (eventType === 'product.delete' || eventType === 'product.deleted') {
    console.log('🗑️ Deleting product from database');

    const { error } = await supabase
      .from('products')
      .update({
        is_active: false,
        is_archived: true,
        sync_status: 'deleted',
        last_synced_at: new Date().toISOString()
      })
      .eq('pos_integration_id', integration.id)
      .eq('external_product_id', productId.toString());

    if (error) {
      console.error('❌ Error marking product as deleted:', error);
      return { success: false, error: error.message };
    }

    console.log('✅ Product marked as deleted');
    return { success: true, action: 'deleted' };
  }

  // For create/update events, fetch product details from Lightspeed
  console.log('📡 Fetching product details from Lightspeed API');

  const productDetails = await fetchLightspeedProduct(
    integration.store_id,
    productId,
    integration.access_token
  );

  if (!productDetails) {
    return { success: false, error: 'Failed to fetch product details' };
  }

  // Sync the product
  console.log('💾 Syncing product to database');

  try {
    await syncSingleProduct(productDetails, integration, supabase);

    console.log('✅ Product synced successfully');
    return {
      success: true,
      action: eventType === 'product.create' ? 'created' : 'updated',
      product_id: productId
    };
  } catch (error: any) {
    console.error('❌ Error syncing product:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Fetch product details from Lightspeed API
 */
async function fetchLightspeedProduct(
  storeId: string,
  productId: string,
  accessToken: string
): Promise<any> {
  try {
    const response = await fetch(
      `https://${storeId}.retail.lightspeed.app/api/2.0/products/${productId}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      }
    );

    if (!response.ok) {
      console.error('Failed to fetch Lightspeed product:', response.status);
      return null;
    }

    const data = await response.json();
    return data.data || data;
  } catch (error) {
    console.error('Error fetching Lightspeed product:', error);
    return null;
  }
}

/**
 * Sync a single product to the database
 */
async function syncSingleProduct(product: any, integration: any, supabase: any): Promise<void> {
  const productId = String(product.id);

  // Build product name
  const name = product.name;
  const description = product.description || null;

  // Get category
  const categoryName = product.brand?.name || product.product_type?.name || null;

  // Get price
  const retailPrice = product.retail_price || 0;
  const priceAmount = parseFloat(retailPrice);

  // Get inventory
  const inventoryData = product.inventory || [];
  const totalStock = inventoryData.reduce((sum: number, inv: any) =>
    sum + (parseInt(inv.count) || 0), 0
  );

  // Get identifiers
  const sku = product.sku || null;
  const upc = product.barcode || null;

  // Get category from database
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
    .maybeSingle();

  // Get image URL
  const imageUrl = product.image_url || null;
  const images = product.images || [];
  const imageArray = Array.isArray(images) ? images : (images ? [images] : []);

  const productData = {
    merchant_id: integration.user_id,
    business_id: integration.business_id,
    pos_integration_id: integration.id,
    external_product_id: productId,
    name: name,
    description: description,
    category_id: categoryId,
    price: priceAmount,
    currency: 'USD',
    stock_quantity: totalStock,
    sku: sku,
    upc: upc,
    barcode: upc,
    barter_enabled: true,
    image_url: imageUrl,
    images: imageArray.map((img: any) => img?.url || img).filter(Boolean),
    is_active: product.active !== false,
    last_synced_at: new Date().toISOString(),
    sync_status: 'synced',
    metadata: {
      lightspeed_product_id: product.id,
      lightspeed_brand: product.brand?.name,
      lightspeed_product_type: product.product_type?.name,
      lightspeed_supplier: product.supplier?.name,
      supply_price: product.supply_price,
      synced_via: 'webhook'
    }
  };

  if (existing) {
    // Update existing product
    console.log(`  🔄 Updating existing product ${name}`);
    const { error } = await supabase
      .from('products')
      .update(productData)
      .eq('id', existing.id);

    if (error) {
      throw new Error(`Failed to update product: ${error.message}`);
    }
  } else {
    // Insert new product
    console.log(`  ➕ Inserting new product ${name}`);
    const { error } = await supabase
      .from('products')
      .insert(productData);

    if (error) {
      throw new Error(`Failed to insert product: ${error.message}`);
    }
  }

  console.log(`  ✅ Product ${name} synced`);
}
