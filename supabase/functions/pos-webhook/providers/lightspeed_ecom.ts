/**
 * Handle Lightspeed eCom (Ecwid) webhook events
 * Docs: https://api-docs.ecwid.com/reference/webhooks
 *
 * Ecwid webhook payload format:
 * {
 *   "eventType": "product.updated",
 *   "eventId": "...",
 *   "entityId": 123456,       <- product/order ID
 *   "storeId": 12345678,      <- Ecwid store ID
 *   "data": { ... }
 * }
 *
 * Supported events:
 * - product.created / product.updated  → fetch product from API and upsert
 * - product.deleted                    → soft-delete product in DB
 * - order.updated                      → detect barter order completion
 */
export async function handleLightspeedEcomWebhook(
  payload: any,
  headers: any,
  supabase: any
): Promise<any> {
  console.log('Processing Lightspeed eCom (Ecwid) webhook');

  const eventType = payload.eventType;
  const entityId = payload.entityId;
  const storeId = payload.storeId?.toString();

  console.log('Event type:', eventType);
  console.log('Entity ID:', entityId);
  console.log('Store ID:', storeId);

  if (!eventType || !storeId) {
    console.error('Missing eventType or storeId in Ecwid webhook payload');
    return { success: false, error: 'Missing required fields' };
  }

  // Look up the merchant's integration by store_id + provider lightspeed + mode ecom
  const { data: integration, error: integrationError } = await supabase
    .from('pos_integrations')
    .select('id, user_id, store_id, access_token, access_token_encrypted, encryption_nonce, config')
    .eq('provider', 'lightspeed')
    .eq('store_id', storeId)
    .eq('status', 'active')
    .single();

  if (integrationError || !integration) {
    console.error('No active Lightspeed eCom integration found for store:', storeId);
    return { success: false, error: 'Integration not found' };
  }

  // Verify this is actually an eCom integration
  if (integration.config?.lightspeed_mode !== 'ecom') {
    console.error('Integration found but is not eCom mode for store:', storeId);
    return { success: false, error: 'Not an eCom integration' };
  }

  // Decrypt access token if encrypted
  let accessToken = integration.access_token;
  if (integration.access_token_encrypted && integration.encryption_nonce) {
    const { data: decrypted, error: decryptError } = await supabase
      .rpc('decrypt_pos_token', {
        p_encrypted_token: integration.access_token_encrypted,
        p_nonce: integration.encryption_nonce
      });

    if (decryptError || !decrypted) {
      console.error('Failed to decrypt access token:', decryptError);
      return { success: false, error: 'Token decryption failed' };
    }
    accessToken = decrypted;
  }

  // Route by event type
  if (eventType === 'product.created' || eventType === 'product.updated') {
    return await handleProductUpsert(entityId, storeId, accessToken, integration, supabase);
  }

  if (eventType === 'product.deleted') {
    return await handleProductDelete(entityId, integration, supabase);
  }

  if (eventType === 'order.updated' || eventType === 'order.created') {
    return await handleOrderEvent(entityId, storeId, accessToken, integration, supabase);
  }

  console.log('Unhandled Ecwid event type:', eventType);
  return { success: true, message: `Event type ${eventType} not handled` };
}

/**
 * Fetch product from Ecwid API and upsert into DB
 */
async function handleProductUpsert(
  productId: number,
  storeId: string,
  accessToken: string,
  integration: any,
  supabase: any
): Promise<any> {
  console.log('Fetching product from Ecwid API:', productId);

  const response = await fetch(
    `https://app.ecwid.com/api/v3/${storeId}/products/${productId}`,
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json'
      }
    }
  );

  if (!response.ok) {
    const errText = await response.text();
    console.error('Failed to fetch Ecwid product:', response.status, errText);
    return { success: false, error: `Failed to fetch product: ${response.status}` };
  }

  const product = await response.json();
  console.log('Fetched product:', product.name);

  try {
    const combinations = product.combinations || [];

    if (combinations.length === 0) {
      await upsertEcomProduct(product, null, accessToken, integration, supabase);
    } else {
      for (const combination of combinations) {
        await upsertEcomProduct(product, combination, accessToken, integration, supabase);
      }
    }

    return { success: true, action: 'upserted', product_id: productId };
  } catch (error: any) {
    console.error('Error upserting product:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Soft-delete a product when Ecwid sends a delete event
 */
async function handleProductDelete(
  productId: number,
  integration: any,
  supabase: any
): Promise<any> {
  console.log('Soft-deleting product:', productId);

  const { error } = await supabase
    .from('products')
    .update({
      is_active: false,
      sync_status: 'deleted',
      last_synced_at: new Date().toISOString()
    })
    .eq('pos_integration_id', integration.id)
    .eq('external_product_id', productId.toString());

  if (error) {
    console.error('Error deleting product:', error);
    return { success: false, error: error.message };
  }

  console.log('Product soft-deleted:', productId);
  return { success: true, action: 'deleted', product_id: productId };
}

/**
 * Handle order events — detect when a barter order is completed
 */
async function handleOrderEvent(
  orderId: number,
  storeId: string,
  accessToken: string,
  integration: any,
  supabase: any
): Promise<any> {
  console.log('Handling Ecwid order event:', orderId);

  // Fetch order from Ecwid to check status
  const response = await fetch(
    `https://app.ecwid.com/api/v3/${storeId}/orders/${orderId}`,
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json'
      }
    }
  );

  if (!response.ok) {
    console.error('Failed to fetch Ecwid order:', response.status);
    return { success: true, message: 'Could not fetch order details' };
  }

  const order = await response.json();
  console.log('Order status:', order.paymentStatus, '/', order.fulfillmentStatus);

  // Only proceed when payment is accepted
  if (order.paymentStatus !== 'ACCEPTED' && order.paymentStatus !== 'PAID') {
    return { success: true, message: `Order payment status is ${order.paymentStatus}, skipping` };
  }

  // Match payment session by Ecwid order ID (stored as pos_order_id at checkout creation)
  const { data: session, error: sessionError } = await supabase
    .from('pos_payment_sessions')
    .select('*, orders!inner(*)')
    .eq('pos_provider', 'lightspeed')
    .eq('pos_order_id', orderId.toString())
    .eq('session_status', 'discount_applied')
    .single();

  if (sessionError || !session) {
    console.log('No pending barter session for Ecwid order:', orderId);
    return { success: true, message: 'No pending barter session' };
  }

  console.log('Found barter order:', session.orders.order_number);

  // Complete the payment session — transfers barter credits to merchant
  const { error: rpcError } = await supabase.rpc('complete_pos_payment_session', {
    p_session_id: session.id,
    p_total_amount: session.total_amount,
    p_barter_amount: session.barter_amount,
    p_pos_order_id: orderId.toString()
  });

  if (rpcError) {
    console.error('Error completing payment session:', rpcError);
    return { success: false, error: rpcError.message };
  }

  // Update order status to completed
  await supabase
    .from('orders')
    .update({
      status: 'completed',
      pos_payment_id: orderId.toString(),
      completed_at: new Date().toISOString(),
      metadata: {
        ...session.orders.metadata,
        ecwid_order_id: orderId,
        payment_confirmed_via: 'webhook',
        lightspeed_ecom_payment_completed_at: new Date().toISOString()
      }
    })
    .eq('id', session.orders.id);

  // Record POS transaction
  await supabase
    .from('pos_transactions')
    .insert({
      merchant_id: integration.user_id,
      external_transaction_id: orderId.toString(),
      pos_provider: 'lightspeed',
      total_amount: session.total_amount,
      currency: order.currency || 'USD',
      tax_amount: session.orders.tax_amount || 0,
      tip_amount: 0,
      barter_amount: session.barter_amount,
      barter_percentage: session.barter_percentage,
      cash_amount: session.cash_amount || 0,
      transaction_date: new Date().toISOString(),
      raw_webhook_data: order,
      status: 'completed'
    });

  console.log('Barter order completed via Ecwid webhook');
  return {
    success: true,
    order_id: session.orders.id,
    order_number: session.orders.order_number,
    barter_amount: session.barter_amount,
    message: 'Payment confirmed, credits transferred'
  };
}

/**
 * Upsert a single Ecwid product (with optional combination) into our DB
 */
async function upsertEcomProduct(
  product: any,
  combination: any | null,
  accessToken: string,
  integration: any,
  supabase: any
): Promise<void> {
  const productId = String(product.id);
  const combinationId = combination?.id ? String(combination.id) : null;

  // Build name with variant options if present
  let name = product.name;
  if (combination?.options && combination.options.length > 0) {
    const optionLabel = combination.options.map((o: any) => o.value).join(' / ');
    name = `${product.name} - ${optionLabel}`;
  }

  // Strip HTML from description
  const description = product.description
    ? product.description.replace(/<[^>]*>/g, '').trim() || null
    : null;

  // Fetch category name if available
  let categoryName: string | null = null;
  if (product.categoryIds?.length > 0) {
    const storeId = integration.store_id;
    const catResp = await fetch(
      `https://app.ecwid.com/api/v3/${storeId}/categories/${product.categoryIds[0]}`,
      { headers: { 'Authorization': `Bearer ${accessToken}`, 'Accept': 'application/json' } }
    );
    if (catResp.ok) {
      const catData = await catResp.json();
      categoryName = catData.name || null;
    }
  }

  const priceAmount = parseFloat(combination?.price ?? product.price ?? 0);
  const isUnlimited = combination
    ? (combination.unlimited ?? product.unlimited ?? false)
    : (product.unlimited ?? false);
  const tracksQuantity = product.trackQuantity !== false;
  const stockQuantity = isUnlimited || !tracksQuantity
    ? 9999
    : (combination?.quantity ?? product.quantity ?? 0);
  const sku = combination?.sku || product.sku || null;
  const upc = combination?.upc || product.upc || null;
  const imageUrl = product.imageUrl || null;
  const images = (product.galleryImages || []).map((img: any) => img.url).filter(Boolean);

  // Simple restricted-category check (mirrors the batch sync logic)
  const RESTRICTED_KEYWORDS = ['alcohol', 'beer', 'wine', 'liquor', 'tobacco', 'cigarette',
    'vape', 'lottery', 'gift card', 'prescription', 'firearm', 'gun', 'ammunition'];
  const searchText = [name, description, categoryName].filter(Boolean).join(' ').toLowerCase();
  const isRestricted = RESTRICTED_KEYWORDS.some(kw => searchText.includes(kw));

  // Resolve category_id from our categories table
  let categoryId: string | null = null;
  if (categoryName) {
    const { data: cat } = await supabase
      .from('product_categories')
      .select('id')
      .ilike('name', categoryName)
      .limit(1)
      .single();
    categoryId = cat?.id || null;
  }
  if (!categoryId) {
    const { data: other } = await supabase
      .from('product_categories')
      .select('id')
      .eq('slug', 'other')
      .single();
    categoryId = other?.id || null;
  }

  const query = supabase
    .from('products')
    .select('id')
    .eq('pos_integration_id', integration.id)
    .eq('external_product_id', productId)
    .limit(1);

  const { data: existingRows } = combinationId
    ? await query.eq('external_variant_id', combinationId)
    : await query.is('external_variant_id', null);

  const existing = existingRows?.[0] ?? null;

  const productData = {
    merchant_id: integration.user_id,
    pos_integration_id: integration.id,
    external_product_id: productId,
    external_variant_id: combinationId,
    name,
    description,
    category_id: categoryId,
    price: priceAmount,
    currency: product.defaultDisplayedPriceCurrency || 'USD',
    stock_quantity: stockQuantity,
    sku,
    upc,
    barcode: upc,
    barter_enabled: !isRestricted,
    image_url: imageUrl,
    images,
    is_active: product.enabled !== false,
    last_synced_at: new Date().toISOString(),
    sync_status: 'synced',
    metadata: {
      ecwid_product_id: product.id,
      ecwid_combination_id: combination?.id,
      ecwid_category_ids: product.categoryIds,
      is_restricted: isRestricted,
      synced_via: 'webhook',
      has_combinations: product.combinations && product.combinations.length > 0
    }
  };

  if (existing) {
    const { error } = await supabase.from('products').update(productData).eq('id', existing.id);
    if (error) throw new Error(`Failed to update product: ${error.message}`);
    console.log('Updated product:', name);
  } else {
    const { error } = await supabase.from('products').insert(productData);
    if (error) throw new Error(`Failed to insert product: ${error.message}`);
    console.log('Inserted product:', name);
  }
}
