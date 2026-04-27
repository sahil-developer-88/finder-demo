import { mapCategory } from '../utils/category-mapper.ts';

/**
 * Sync products from Lightspeed eCom (Ecwid) API
 * Docs: https://api-docs.ecwid.com/reference/products
 * API: https://app.ecwid.com/api/v3/{storeId}/products
 */
export async function syncLightspeedEcomProducts(
  integration: any,
  userId: string,
  supabase: any,
  progressId?: string
): Promise<any> {
  console.log('Syncing Lightspeed eCom (Ecwid) products...');

  const accessToken = integration.access_token;
  const storeId = integration.store_id || integration.config?.ecwid_store_id;

  console.log('Access token (first 30 chars):', accessToken?.substring(0, 30) + '...');
  console.log('Ecwid Store ID:', storeId);

  if (!storeId) {
    return {
      success: false,
      error: 'Lightspeed eCom store ID not configured'
    };
  }

  if (!accessToken) {
    return {
      success: false,
      error: 'Lightspeed eCom access token not configured'
    };
  }

  try {
    const baseUrl = `https://app.ecwid.com/api/v3/${storeId}`;
    const limit = 100;
    let offset = 0;
    let allProducts: any[] = [];
    let total = 0;

    // Ecwid uses offset-based pagination
    do {
      const apiUrl = `${baseUrl}/products?limit=${limit}&offset=${offset}&enabled=true`;
      console.log(`Fetching from: ${apiUrl}`);

      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });

      console.log(`Response status: ${response.status}`);

      if (!response.ok) {
        const errorData = await response.text();
        console.error('Ecwid API error:', errorData);
        throw new Error(`Lightspeed eCom API error: ${response.status} - ${errorData}`);
      }

      const data = await response.json();
      total = data.total || 0;
      const products = data.items || [];

      allProducts = allProducts.concat(products);
      offset += products.length;

      console.log(`Fetched ${products.length} products (offset ${offset}/${total})`);

    } while (offset < total);

    console.log(`Total products found: ${allProducts.length}`);

    if (allProducts.length === 0) {
      return {
        success: true,
        message: 'No products found in Lightspeed eCom store',
        synced: 0,
        skipped: 0
      };
    }

    // Update progress with total count
    if (progressId) {
      await supabase
        .from('product_sync_progress')
        .update({
          total_items: allProducts.length,
          current_step: `Syncing ${allProducts.length} products from Lightspeed eCom...`
        })
        .eq('id', progressId);
    }

    let syncedCount = 0;
    let skippedCount = 0;
    const syncErrors: string[] = [];

    for (const product of allProducts) {
      try {
        console.log(`\nProcessing product: ${product.name}`);

        // Ecwid uses "combinations" for variants (size/color combinations)
        const combinations = product.combinations || [];

        if (combinations.length === 0) {
          // No variants — sync main product directly
          await syncEcomProduct(product, null, integration, userId, supabase);
          syncedCount++;
        } else {
          // Sync each combination as a separate product entry
          for (const combination of combinations) {
            await syncEcomProduct(product, combination, integration, userId, supabase);
            syncedCount++;
          }
        }

      } catch (error: any) {
        console.error(`Error syncing product ${product.id}:`, error.message);
        syncErrors.push(`${product.id}: ${error.message}`);
        skippedCount++;
      }
    }

    console.log(`\nLightspeed eCom sync complete! Synced: ${syncedCount}, Skipped: ${skippedCount}`);

    return {
      success: true,
      message: 'Products synced successfully',
      synced: syncedCount,
      skipped: skippedCount,
      errors: syncErrors.length > 0 ? syncErrors : undefined
    };

  } catch (error: any) {
    console.error('Lightspeed eCom sync error:', error);
    return {
      success: false,
      error: error.message || 'Failed to sync Lightspeed eCom products'
    };
  }
}

/**
 * Sync a single Lightspeed eCom product (product + optional combination/variant)
 */
async function syncEcomProduct(
  product: any,
  combination: any | null,
  integration: any,
  userId: string,
  supabase: any
): Promise<void> {
  const productId = String(product.id);
  const combinationId = combination?.id ? String(combination.id) : null;

  // Build name: append combination option values if present
  let name = product.name;
  if (combination?.options && combination.options.length > 0) {
    const optionLabel = combination.options
      .map((o: any) => o.value)
      .join(' / ');
    name = `${product.name} - ${optionLabel}`;
  }

  // Strip HTML from description
  const description = product.description
    ? product.description.replace(/<[^>]*>/g, '').trim() || null
    : null;

  // Category: Ecwid provides categoryIds[], fetch first category name
  const categoryName = product.categoryIds?.length > 0
    ? await getEcwidCategoryName(product.categoryIds[0], integration)
    : null;

  // Price: combination overrides base product price
  const priceAmount = parseFloat(combination?.price ?? product.price ?? 0);

  // Stock: Ecwid has two modes — tracked quantity or unlimited/untracked
  // If product is unlimited or not tracking quantity, treat as 9999 (always in stock)
  // Otherwise use the actual quantity count
  const isUnlimited = combination
    ? (combination.unlimited ?? product.unlimited ?? false)
    : (product.unlimited ?? false);
  const tracksQuantity = product.trackQuantity !== false;
  const stockQuantity = isUnlimited || !tracksQuantity
    ? 9999
    : (combination?.quantity ?? product.quantity ?? 0);

  // Identifiers: combination overrides base product sku/upc
  const sku = combination?.sku || product.sku || null;
  const upc = combination?.upc || product.upc || null;

  // Images
  const imageUrl = product.imageUrl || null;
  const images = (product.galleryImages || []).map((img: any) => img.url).filter(Boolean);

  // Map to our category system
  const categoryMapping = await mapCategory(
    categoryName,
    name,
    description,
    supabase
  );

  console.log(`  Product: ${name}`);
  console.log(`  Price: ${priceAmount}`);
  console.log(`  Stock: ${stockQuantity}`);
  console.log(`  Category: ${categoryMapping.matchedCategory}`);
  console.log(`  Restricted: ${categoryMapping.isRestricted}`);

  // Check if product already exists
  // Use .is() for null variant, .eq() for non-null — avoids PostgreSQL NULL equality bug
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
    merchant_id: userId,
    pos_integration_id: integration.id,
    external_product_id: productId,
    external_variant_id: combinationId,
    name: name,
    description: description,
    category_id: categoryMapping.categoryId,
    price: priceAmount,
    currency: product.defaultDisplayedPriceCurrency || 'USD',
    stock_quantity: stockQuantity,
    sku: sku,
    upc: upc,
    barcode: upc,
    barter_enabled: !categoryMapping.isRestricted,
    image_url: imageUrl,
    images: images,
    is_active: product.enabled !== false,
    last_synced_at: new Date().toISOString(),
    sync_status: 'synced',
    metadata: {
      ecwid_product_id: product.id,
      ecwid_combination_id: combination?.id,
      ecwid_category_ids: product.categoryIds,
      ecwid_url: product.url,
      ecwid_weight: combination?.weight ?? product.weight,
      ecwid_shipping_required: product.shippingRequired,
      is_restricted: categoryMapping.isRestricted,
      restriction_reason: categoryMapping.isRestricted
        ? `Restricted category: ${categoryMapping.matchedCategory}`
        : null,
      has_combinations: product.combinations && product.combinations.length > 0
    }
  };

  if (existing) {
    console.log(`  Updating existing product...`);
    const { error } = await supabase
      .from('products')
      .update(productData)
      .eq('id', existing.id);

    if (error) {
      throw new Error(`Failed to update product: ${error.message}`);
    }
  } else {
    console.log(`  Inserting new product...`);
    const { error } = await supabase
      .from('products')
      .insert(productData);

    if (error) {
      throw new Error(`Failed to insert product: ${error.message}`);
    }
  }

  console.log(`  Product synced successfully`);
}

/**
 * Fetch Ecwid category name by category ID
 */
async function getEcwidCategoryName(
  categoryId: number,
  integration: any
): Promise<string | null> {
  try {
    const storeId = integration.store_id || integration.config?.ecwid_store_id;
    const response = await fetch(
      `https://app.ecwid.com/api/v3/${storeId}/categories/${categoryId}`,
      {
        headers: {
          'Authorization': `Bearer ${integration.access_token}`,
          'Accept': 'application/json'
        }
      }
    );

    if (!response.ok) return null;

    const data = await response.json();
    return data.name || null;
  } catch {
    return null;
  }
}
