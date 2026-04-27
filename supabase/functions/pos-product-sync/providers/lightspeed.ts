import { mapCategory } from '../utils/category-mapper.ts';

/**
 * Sync products from Lightspeed X-Series API
 * Docs: https://x-series-api.lightspeedhq.com/
 * API: https://{domain_prefix}.retail.lightspeed.app/api/2.0/products
 */
export async function syncLightspeedProducts(
  integration: any,
  userId: string,
  supabase: any,
  progressId?: string
): Promise<any> {
  console.log('💡 Syncing Lightspeed X-Series products...');

  const accessToken = integration.access_token;
  const storeId = integration.store_id; // Shop domain (e.g., "developerdemowxovj9")

  console.log('🔑 Access token (first 30 chars):', accessToken?.substring(0, 30) + '...');
  console.log('🔑 Access token type:', accessToken?.startsWith('lsxs_at_') ? 'OAuth' : accessToken?.startsWith('lsxs_') ? 'Legacy API Key' : 'Unknown');

  if (!storeId) {
    return {
      success: false,
      error: 'Lightspeed store ID not configured'
    };
  }

  if (!accessToken) {
    return {
      success: false,
      error: 'Lightspeed access token not configured'
    };
  }

  try {
    // Fetch products from Lightspeed X-Series API
    console.log('📡 Fetching products from Lightspeed X-Series...');
    console.log('🏪 Store ID:', storeId);

    // Use X-Series API format: https://{domain_prefix}.retail.lightspeed.app/api/2.0/products
    const baseUrl = `https://${storeId}.retail.lightspeed.app/api/2.0`;

    let allProducts: any[] = [];
    let page = 1;
    const pageSize = 200; // X-Series max per page
    let hasMore = true;

    // Lightspeed X-Series uses page-based pagination
    while (hasMore) {
      const apiUrl = `${baseUrl}/products?page_size=${pageSize}&page=${page}`;
      console.log(`🔗 Fetching from: ${apiUrl}`);

      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });

      console.log(`📊 Response status: ${response.status}`);
      console.log(`📊 Content-Type: ${response.headers.get('content-type')}`);

      if (!response.ok) {
        const errorData = await response.text();
        console.error('❌ Lightspeed API error:', errorData);
        throw new Error(`Lightspeed API error: ${response.status} - ${errorData}`);
      }

      // Check if response is JSON
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const responseText = await response.text();
        console.error('❌ Response is not JSON:');
        console.error('   Content-Type:', contentType);
        console.error('   First 500 chars:', responseText.substring(0, 500));
        throw new Error(`Lightspeed API returned non-JSON response: ${contentType}`);
      }

      const data = await response.json();
      const products = data.data || [];
      const pagination = data.pagination || {};

      allProducts = allProducts.concat(products);

      // Check if there are more pages
      if (pagination.page < pagination.pages) {
        page++;
      } else {
        hasMore = false;
      }

      console.log(`📦 Fetched ${products.length} products (page ${page - 1}/${pagination.pages || 1}, total: ${allProducts.length})`);
    }

    console.log(`📦 Total products found: ${allProducts.length}`);

    if (allProducts.length === 0) {
      return {
        success: true,
        message: 'No products found in Lightspeed account',
        synced: 0,
        skipped: 0
      };
    }

    let syncedCount = 0;
    let skippedCount = 0;
    const syncErrors: string[] = [];

    // Process each product
    for (const product of allProducts) {
      try {
        console.log(`\n📝 Processing product: ${product.name}`);

        // X-Series products can have variants
        const variants = product.variants || [];

        if (variants.length === 0) {
          // No variants, sync main product
          await syncLightspeedProduct(product, null, integration, userId, supabase);
          syncedCount++;
        } else {
          // Has variants, sync each variant
          for (const variant of variants) {
            await syncLightspeedProduct(product, variant, integration, userId, supabase);
            syncedCount++;
          }
        }

      } catch (error: any) {
        console.error(`❌ Error syncing product ${product.id}:`, error.message);
        syncErrors.push(`${product.id}: ${error.message}`);
        skippedCount++;
      }
    }

    console.log(`\n✅ Lightspeed sync complete! Synced: ${syncedCount}, Skipped: ${skippedCount}`);

    return {
      success: true,
      message: 'Products synced successfully',
      synced: syncedCount,
      skipped: skippedCount,
      errors: syncErrors.length > 0 ? syncErrors : undefined
    };

  } catch (error: any) {
    console.error('❌ Lightspeed sync error:', error);
    return {
      success: false,
      error: error.message || 'Failed to sync Lightspeed products'
    };
  }
}

/**
 * Sync a single Lightspeed X-Series product (product + variant)
 */
async function syncLightspeedProduct(
  product: any,
  variant: any | null,
  integration: any,
  userId: string,
  supabase: any
): Promise<void> {
  const productId = String(product.id);
  const variantId = variant?.id ? String(variant.id) : null;

  // Build product name
  const name = variant
    ? `${product.name} - ${variant.name || variant.sku}`
    : product.name;

  const description = product.description || null;

  // Get category - X-Series has brand and product types
  const categoryName = product.brand?.name || product.product_type?.name || null;

  // Get price from variant or product
  const retailPrice = variant?.retail_price || product.retail_price || 0;
  const priceAmount = parseFloat(retailPrice);

  // Get inventory from variant or product
  const inventoryData = variant?.inventory || product.inventory || [];
  const totalStock = inventoryData.reduce((sum: number, inv: any) =>
    sum + (parseInt(inv.count) || 0), 0
  );

  // Get identifiers
  const sku = variant?.sku || product.sku || null;
  const upc = variant?.barcode || product.barcode || null;

  // Map category
  const categoryMapping = await mapCategory(
    categoryName,
    name,
    description,
    supabase
  );

  console.log(`  📊 Product: ${name}`);
  console.log(`  💰 Price: ${priceAmount} USD`);
  console.log(`  📦 Stock: ${totalStock}`);
  console.log(`  📁 Category: ${categoryMapping.matchedCategory}`);
  console.log(`  🚫 Restricted: ${categoryMapping.isRestricted}`);

  // Check if product already exists — limit(1) handles existing duplicates gracefully
  // Use .is() for null variant, .eq() for non-null — avoids PostgreSQL NULL equality bug
  const query = supabase
    .from('products')
    .select('id')
    .eq('pos_integration_id', integration.id)
    .eq('external_product_id', productId)
    .limit(1);

  const { data: existingRows } = variantId
    ? await query.eq('external_variant_id', variantId)
    : await query.is('external_variant_id', null);

  const existing = existingRows?.[0] ?? null;

  // Get image URL - X-Series has image_url field
  const imageUrl = variant?.image_url || product.image_url || null;
  const images = product.images || [];
  const imageArray = Array.isArray(images) ? images : (images ? [images] : []);

  const productData = {
    merchant_id: userId,
    pos_integration_id: integration.id,
    external_product_id: productId,
    external_variant_id: variantId,
    name: name,
    description: description,
    category_id: categoryMapping.categoryId,
    price: priceAmount,
    currency: 'USD',
    stock_quantity: totalStock,
    sku: sku,
    upc: upc,
    barcode: upc,
    barter_enabled: !categoryMapping.isRestricted,
    image_url: imageUrl,
    images: imageArray.map((img: any) => img?.url || img).filter(Boolean),
    is_active: product.active !== false,
    last_synced_at: new Date().toISOString(),
    sync_status: 'synced',
    metadata: {
      lightspeed_product_id: product.id,
      lightspeed_variant_id: variant?.id,
      lightspeed_brand: product.brand?.name,
      lightspeed_product_type: product.product_type?.name,
      lightspeed_supplier: product.supplier?.name,
      is_restricted: categoryMapping.isRestricted,
      restriction_reason: categoryMapping.isRestricted
        ? `Restricted category: ${categoryMapping.matchedCategory}`
        : null,
      supply_price: variant?.supply_price || product.supply_price,
      has_variants: product.variants && product.variants.length > 0
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
