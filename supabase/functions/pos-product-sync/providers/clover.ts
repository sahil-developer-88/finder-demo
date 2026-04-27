import { mapCategory } from '../utils/category-mapper.ts';

/**
 * Sync products from Clover
 * Docs: https://docs.clover.com/docs/items
 */
export async function syncCloverProducts(
  integration: any,
  userId: string,
  supabase: any,
  progressId?: string
): Promise<any> {
  console.log('☘️ Syncing Clover products...');

  const accessToken = integration.access_token;
  let merchantId = integration.merchant_id || integration.config?.merchant_id;

  console.log('🔑 Access token present:', !!accessToken);
  console.log('🔑 Access token first 30 chars:', accessToken?.substring(0, 30) + '...');
  console.log('🔑 Access token length:', accessToken?.length);
  console.log('🏪 Merchant ID from integration:', merchantId);
  console.log('⚙️ Environment:', integration.config?.environment || 'production');

  if (!accessToken) {
    console.error('❌ No access token found');
    return {
      success: false,
      error: 'Clover access token not configured'
    };
  }

  try {
    // Determine environment (sandbox vs production)
    // OAuth uses: sandbox.dev.clover.com
    // REST API uses: apisandbox.dev.clover.com
    // Production: api.clover.com
    const baseUrl = integration.config?.environment === 'sandbox'
      ? 'https://apisandbox.dev.clover.com'
      : 'https://api.clover.com';

    // If merchant_id is not stored, fetch it from Clover API
    if (!merchantId) {
      console.log('🔍 Merchant ID not found, fetching from Clover API...');
      const merchantResponse = await fetch(`${baseUrl}/v3/merchants/me`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        }
      });

      if (!merchantResponse.ok) {
        const errorText = await merchantResponse.text();
        console.error('❌ Failed to fetch merchant info:', errorText);
        return {
          success: false,
          error: `Failed to fetch Clover merchant info: ${merchantResponse.status} - ${errorText}`
        };
      }

      const merchantData = await merchantResponse.json();
      merchantId = merchantData.id;
      console.log('✅ Fetched merchant ID from API:', merchantId);

      // Update the integration with the merchant_id for future use
      console.log('💾 Updating integration with merchant_id...');
      await supabase
        .from('pos_integrations')
        .update({ merchant_id: merchantId })
        .eq('id', integration.id);
      console.log('✅ Integration updated with merchant_id');
    }

    console.log('🌐 Using base URL:', baseUrl);
    console.log('📡 Fetching items from Clover...');

    // Fetch all items with expanded data
    const apiUrl = `${baseUrl}/v3/merchants/${merchantId}/items?expand=categories,itemStock,tags,modifierGroups`;
    console.log('🔗 API URL:', apiUrl);

    const authHeader = `Bearer ${accessToken}`;
    console.log('🔐 Authorization header (first 40 chars):', authHeader.substring(0, 40) + '...');

    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json'
      }
    });

    console.log('📊 Response status:', response.status);
    console.log('📊 Response ok:', response.ok);
    console.log('📊 Response headers:', Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      const errorData = await response.text();
      console.error('❌ Clover API error:', errorData);
      console.error('❌ Response status:', response.status);
      throw new Error(`Clover API error: ${response.status} - ${errorData}`);
    }

    console.log('✅ Clover API call successful, parsing response...');
    const data = await response.json();
    console.log('✅ Response parsed successfully');
    const items = data.elements || [];

    console.log(`📦 Total items found: ${items.length}`);

    if (items.length === 0) {
      return {
        success: true,
        message: 'No items found in Clover merchant',
        synced: 0,
        skipped: 0
      };
    }

    let syncedCount = 0;
    let skippedCount = 0;
    const syncErrors: string[] = [];

    // Process each item
    for (const item of items) {
      try {
        console.log(`\n📝 Processing item: ${item.name}`);

        // Clover items can have item variations (sizes, colors, etc.)
        // For now, we'll create one product per item
        // TODO: Handle item variations if needed
        await syncCloverProduct(item, integration, userId, supabase);
        syncedCount++;

      } catch (error: any) {
        console.error(`❌ Error syncing item ${item.id}:`, error.message);
        syncErrors.push(`${item.id}: ${error.message}`);
        skippedCount++;
      }
    }

    console.log(`\n✅ Clover sync complete! Synced: ${syncedCount}, Skipped: ${skippedCount}`);

    return {
      success: true,
      message: 'Products synced successfully',
      synced: syncedCount,
      skipped: skippedCount,
      errors: syncErrors.length > 0 ? syncErrors : undefined
    };

  } catch (error: any) {
    console.error('❌ Clover sync error:', error);
    console.error('❌ Error name:', error.name);
    console.error('❌ Error message:', error.message);
    console.error('❌ Error stack:', error.stack);
    return {
      success: false,
      error: error.message || 'Failed to sync Clover products'
    };
  }
}

/**
 * Sync a single Clover product
 */
async function syncCloverProduct(
  item: any,
  integration: any,
  userId: string,
  supabase: any
): Promise<void> {
  const itemId = item.id;

  const name = item.name;
  const description = item.alternateName || null;

  // Get category from first category if available
  const categories = item.categories?.elements || [];
  const categoryName = categories.length > 0 ? categories[0].name : null;

  // Get price (Clover uses cents)
  const priceAmount = item.price ? item.price / 100 : 0;

  // Get stock quantity
  const stockData = item.itemStock || {};
  const stockQuantity = stockData.quantity || 0;

  // Get SKU and code
  const sku = item.sku || null;
  const code = item.code || null;

  // Map category
  const categoryMapping = await mapCategory(
    categoryName,
    name,
    description,
    supabase
  );

  console.log(`  📊 Product: ${name}`);
  console.log(`  💰 Price: ${priceAmount} USD`);
  console.log(`  📦 Stock: ${stockQuantity}`);
  console.log(`  📁 Category: ${categoryMapping.matchedCategory}`);
  console.log(`  🚫 Restricted: ${categoryMapping.isRestricted}`);

  // Check if product already exists — limit(1) handles existing duplicates gracefully
  const { data: existingRows } = await supabase
    .from('products')
    .select('id')
    .eq('pos_integration_id', integration.id)
    .eq('external_product_id', itemId)
    .is('external_variant_id', null)
    .limit(1);

  const existing = existingRows?.[0] ?? null;

  const productData = {
    merchant_id: userId,
    pos_integration_id: integration.id,
    external_product_id: itemId,
    external_variant_id: null,
    name: name,
    description: description,
    category_id: categoryMapping.categoryId,
    price: priceAmount,
    currency: 'USD',
    stock_quantity: stockQuantity,
    sku: sku,
    barcode: code,
    upc: code,
    barter_enabled: !categoryMapping.isRestricted && !item.hidden,
    image_url: null, // Clover images require separate API call
    is_active: !item.hidden && item.available,
    last_synced_at: new Date().toISOString(),
    sync_status: 'synced',
    metadata: {
      clover_item_id: item.id,
      clover_modified_time: item.modifiedTime,
      clover_price_type: item.priceType,
      clover_unit_name: item.unitName,
      clover_is_revenue: item.isRevenue,
      clover_tags: item.tags?.elements?.map((t: any) => t.name),
      clover_categories: categories.map((c: any) => c.name),
      is_restricted: categoryMapping.isRestricted,
      restriction_reason: categoryMapping.isRestricted
        ? `Restricted category: ${categoryMapping.matchedCategory}`
        : null,
      cost: item.cost ? item.cost / 100 : null
    }
  };

  if (existing) {
    // Update existing product
    console.log(`  🔄 Updating existing product...`);
    const { error } = await supabase
      .from('products')
      .update(productData)
      .eq('id', existing.id);

    if (error) {
      throw new Error(`Failed to update product: ${error.message}`);
    }
  } else {
    // Insert new product
    console.log(`  ➕ Inserting new product...`);
    const { error } = await supabase
      .from('products')
      .insert(productData);

    if (error) {
      throw new Error(`Failed to insert product: ${error.message}`);
    }
  }

  console.log(`  ✅ Product synced successfully`);
}
