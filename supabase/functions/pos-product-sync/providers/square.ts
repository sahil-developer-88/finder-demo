import { mapCategory } from '../utils/category-mapper.ts';

/**
 * Sync products from Square Catalog API
 * Docs: https://developer.squareup.com/reference/square/catalog-api
 */
export async function syncSquareProducts(
  integration: any,
  userId: string,
  supabase: any,
  progressId?: string
): Promise<any> {
  console.log('🟦 Syncing Square products...');

  const accessToken = integration.access_token;
  const environment = integration.config?.environment || 'production';
  const baseUrl = environment === 'sandbox'
    ? 'https://connect.squareupsandbox.com'
    : 'https://connect.squareup.com';

  try {
    // Fetch catalog items (products) from Square
    console.log('📡 Fetching catalog items from Square...');
    const response = await fetch(`${baseUrl}/v2/catalog/list?types=ITEM`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Square-Version': '2023-12-13'
      }
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('❌ Square API error:', errorData);
      throw new Error(`Square API error: ${response.status} - ${errorData}`);
    }

    const data = await response.json();
    const items = data.objects || [];

    // Collect all variation IDs for inventory batch fetch
    const variationIds: string[] = [];
    for (const item of items) {
      const variations = item.item_data?.variations || [];
      if (variations.length === 0) {
        variationIds.push(item.id);
      } else {
        for (const v of variations) variationIds.push(v.id);
      }
    }

    // Fetch inventory counts from Square Inventory API
    const inventoryMap: Record<string, number> = {};
    if (variationIds.length > 0) {
      console.log(`📦 Fetching inventory for ${variationIds.length} variations...`);
      try {
        const invResponse = await fetch(`${baseUrl}/v2/inventory/counts/batch-retrieve`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'Square-Version': '2023-12-13'
          },
          body: JSON.stringify({ catalog_object_ids: variationIds })
        });

        if (invResponse.ok) {
          const invData = await invResponse.json();
          for (const count of (invData.counts || [])) {
            if (count.state === 'IN_STOCK') {
              const prev = inventoryMap[count.catalog_object_id] || 0;
              inventoryMap[count.catalog_object_id] = prev + parseFloat(count.quantity || '0');
            }
          }
          console.log(`✅ Inventory fetched for ${Object.keys(inventoryMap).length} variations`);
        } else {
          console.warn('⚠️ Failed to fetch inventory counts:', await invResponse.text());
        }
      } catch (invError: any) {
        console.warn('⚠️ Inventory fetch error (non-fatal):', invError.message);
      }
    }

    console.log(`📦 Found ${items.length} items in Square catalog`);

    if (items.length === 0) {
      return {
        success: true,
        message: 'No products found in Square catalog',
        synced: 0,
        skipped: 0
      };
    }

    // Update progress with total items count
    if (progressId) {
      await supabase
        .from('product_sync_progress')
        .update({
          total_items: items.length,
          current_step: `Syncing ${items.length} products from Square...`
        })
        .eq('id', progressId);
    }

    let syncedCount = 0;
    let skippedCount = 0;
    let processedCount = 0;
    const syncErrors: string[] = [];

    // Process each item
    for (const item of items) {
      try {
        // Square items can have multiple variations (sizes, colors, etc.)
        const itemData = item.item_data;
        const variations = itemData?.variations || [];

        console.log(`\n📝 Processing item: ${itemData?.name}`);

        // If no variations, create one product entry
        if (variations.length === 0) {
          await syncSquareProduct(item, null, integration, userId, supabase, inventoryMap);
          syncedCount++;
        } else {
          // Create a product for each variation
          for (const variation of variations) {
            await syncSquareProduct(item, variation, integration, userId, supabase, inventoryMap);
            syncedCount++;
          }
        }

        processedCount++;

        // Update progress every item
        if (progressId) {
          await supabase
            .from('product_sync_progress')
            .update({
              processed_items: processedCount,
              synced_items: syncedCount,
              skipped_items: skippedCount,
              error_items: syncErrors.length,
              current_item_name: itemData?.name || 'Unknown product',
              current_step: `Processing product ${processedCount}/${items.length}...`
            })
            .eq('id', progressId);
        }

      } catch (error: any) {
        console.error(`❌ Error syncing item ${item.id}:`, error.message);
        syncErrors.push(`${item.id}: ${error.message}`);
        skippedCount++;
        processedCount++;

        // Update progress on error too
        if (progressId) {
          await supabase
            .from('product_sync_progress')
            .update({
              processed_items: processedCount,
              synced_items: syncedCount,
              skipped_items: skippedCount,
              error_items: syncErrors.length,
              current_step: `Processing product ${processedCount}/${items.length}...`
            })
            .eq('id', progressId);
        }
      }
    }

    console.log(`\n✅ Square sync complete! Synced: ${syncedCount}, Skipped: ${skippedCount}`);

    return {
      success: true,
      message: 'Products synced successfully',
      synced: syncedCount,
      skipped: skippedCount,
      errors: syncErrors.length > 0 ? syncErrors : undefined
    };

  } catch (error: any) {
    console.error('❌ Square sync error:', error);
    return {
      success: false,
      error: error.message || 'Failed to sync Square products'
    };
  }
}

/**
 * Sync a single Square product (item + variation)
 */
async function syncSquareProduct(
  item: any,
  variation: any | null,
  integration: any,
  userId: string,
  supabase: any,
  inventoryMap: Record<string, number> = {}
): Promise<void> {
  const itemData = item.item_data;
  const variationData = variation?.item_variation_data;

  // Get product details
  const productId = item.id;
  const variationId = variation?.id || null;
  const name = variationId
    ? `${itemData.name} - ${variationData?.name || 'Default'}`
    : itemData.name;

  const description = itemData.description || null;
  const categoryName = itemData.category_name || itemData.product_type || null;

  // Get price (Square uses smallest currency unit - cents)
  const priceAmount = variationData?.price_money?.amount
    ? variationData.price_money.amount / 100
    : 0;

  const currency = variationData?.price_money?.currency || 'USD';

  // Get SKU and UPC
  const sku = variationData?.sku || null;
  const upc = variationData?.upc || null;

  // Map category
  const categoryMapping = await mapCategory(
    categoryName,
    name,
    description,
    supabase
  );

  console.log(`  📊 Product: ${name}`);
  console.log(`  💰 Price: ${priceAmount} ${currency}`);
  console.log(`  📁 Category: ${categoryMapping.matchedCategory}`);
  console.log(`  🚫 Restricted: ${categoryMapping.isRestricted}`);

  // Check if product already exists — limit(1) handles existing duplicates gracefully
  const { data: existingRows } = await supabase
    .from('products')
    .select('id')
    .eq('pos_integration_id', integration.id)
    .eq('external_product_id', productId)
    .eq('external_variant_id', variationId)
    .limit(1);

  const existing = existingRows?.[0] ?? null;

  const productData = {
    merchant_id: userId,
    pos_integration_id: integration.id,
    external_product_id: productId,
    external_variant_id: variationId,
    name: name,
    description: description,
    category_id: categoryMapping.categoryId,
    price: priceAmount,
    currency: currency,
    stock_quantity: inventoryMap[variationId || productId] ?? 0,
    sku: sku,
    upc: upc,
    barcode: upc, // Use UPC as barcode
    barter_enabled: !categoryMapping.isRestricted, // Disable barter for restricted items
    image_url: itemData.image_ids?.[0] ? await getSquareImageUrl(itemData.image_ids[0], integration.access_token) : null,
    is_active: !itemData.is_deleted,
    last_synced_at: new Date().toISOString(),
    sync_status: 'synced',
    metadata: {
      square_version: item.version,
      square_category_id: itemData.category_id,
      square_tax_ids: itemData.tax_ids,
      is_restricted: categoryMapping.isRestricted,
      restriction_reason: categoryMapping.isRestricted ? `Restricted category: ${categoryMapping.matchedCategory}` : null
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

/**
 * Get Square image URL by image ID
 */
async function getSquareImageUrl(
  imageId: string,
  accessToken: string
): Promise<string | null> {
  try {
    // In a real implementation, you would fetch the image details from Square
    // For now, return null - images can be synced separately if needed
    return null;
  } catch (error) {
    console.error('Error fetching image:', error);
    return null;
  }
}
