import { mapCategory } from '../utils/category-mapper.ts';

/**
 * Sync products from Shopify
 * Docs: https://shopify.dev/docs/api/admin-rest/2024-01/resources/product
 */
export async function syncShopifyProducts(
  integration: any,
  userId: string,
  supabase: any,
  progressId?: string
): Promise<any> {
  console.log('🛍️ Syncing Shopify products...');

  const accessToken = integration.access_token;
  const shopDomain = integration.store_id || integration.config?.shop_domain;

  if (!shopDomain) {
    return {
      success: false,
      error: 'Shopify shop domain not configured'
    };
  }

  try {
    // Fetch products from Shopify
    console.log('📡 Fetching products from Shopify...');
    const apiVersion = '2024-01';
    const baseUrl = `https://${shopDomain}/admin/api/${apiVersion}`;

    let allProducts: any[] = [];
    let nextPageUrl: string | null = `${baseUrl}/products.json?limit=250`;

    // Shopify uses pagination - fetch all pages
    while (nextPageUrl) {
      const response = await fetch(nextPageUrl, {
        method: 'GET',
        headers: {
          'X-Shopify-Access-Token': accessToken,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorData = await response.text();
        console.error('❌ Shopify API error:', errorData);
        throw new Error(`Shopify API error: ${response.status} - ${errorData}`);
      }

      const data = await response.json();
      const products = data.products || [];
      allProducts = allProducts.concat(products);

      console.log(`📦 Fetched ${products.length} products (total: ${allProducts.length})`);

      // Check for next page
      const linkHeader = response.headers.get('Link');
      nextPageUrl = parseLinkHeader(linkHeader);
    }

    console.log(`📦 Total products found: ${allProducts.length}`);

    if (allProducts.length === 0) {
      return {
        success: true,
        message: 'No products found in Shopify store',
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
        // Shopify products have variants (size, color, etc.)
        const variants = product.variants || [];

        console.log(`\n📝 Processing product: ${product.title}`);

        if (variants.length === 0) {
          // No variants - create single product
          await syncShopifyProduct(product, null, integration, userId, supabase);
          syncedCount++;
        } else {
          // Create a product for each variant
          for (const variant of variants) {
            await syncShopifyProduct(product, variant, integration, userId, supabase);
            syncedCount++;
          }
        }

      } catch (error: any) {
        console.error(`❌ Error syncing product ${product.id}:`, error.message);
        syncErrors.push(`${product.id}: ${error.message}`);
        skippedCount++;
      }
    }

    console.log(`\n✅ Shopify sync complete! Synced: ${syncedCount}, Skipped: ${skippedCount}`);

    return {
      success: true,
      message: 'Products synced successfully',
      synced: syncedCount,
      skipped: skippedCount,
      errors: syncErrors.length > 0 ? syncErrors : undefined
    };

  } catch (error: any) {
    console.error('❌ Shopify sync error:', error);
    return {
      success: false,
      error: error.message || 'Failed to sync Shopify products'
    };
  }
}

/**
 * Sync a single Shopify product (product + variant)
 */
async function syncShopifyProduct(
  product: any,
  variant: any | null,
  integration: any,
  userId: string,
  supabase: any
): Promise<void> {
  const productId = String(product.id);
  const variantId = variant?.id ? String(variant.id) : null;

  // Build product name
  const name = variantId && variant.title !== 'Default Title'
    ? `${product.title} - ${variant.title}`
    : product.title;

  const description = product.body_html
    ? product.body_html.replace(/<[^>]*>/g, '') // Strip HTML tags
    : null;

  const categoryName = product.product_type || null;

  // Get price (Shopify uses decimal strings)
  const priceAmount = variant?.price
    ? parseFloat(variant.price)
    : product.variants?.[0]?.price
    ? parseFloat(product.variants[0].price)
    : 0;

  // Get inventory
  const stockQuantity = variant?.inventory_quantity ?? 0;

  // Get SKU and barcode
  const sku = variant?.sku || null;
  const barcode = variant?.barcode || null;

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
    .eq('external_product_id', productId)
    .eq('external_variant_id', variantId)
    .limit(1);

  const existing = existingRows?.[0] ?? null;

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
    stock_quantity: stockQuantity,
    sku: sku,
    barcode: barcode,
    upc: barcode, // Shopify uses barcode field
    barter_enabled: !categoryMapping.isRestricted,
    image_url: variant?.image_id
      ? product.images?.find((img: any) => img.id === variant.image_id)?.src
      : product.image?.src || product.images?.[0]?.src || null,
    images: product.images?.map((img: any) => img.src) || [],
    is_active: product.status === 'active',
    last_synced_at: new Date().toISOString(),
    sync_status: 'synced',
    metadata: {
      shopify_product_id: product.id,
      shopify_variant_id: variant?.id,
      shopify_handle: product.handle,
      shopify_tags: product.tags,
      shopify_vendor: product.vendor,
      is_restricted: categoryMapping.isRestricted,
      restriction_reason: categoryMapping.isRestricted
        ? `Restricted category: ${categoryMapping.matchedCategory}`
        : null,
      inventory_management: variant?.inventory_management,
      weight: variant?.weight,
      weight_unit: variant?.weight_unit
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
 * Parse Shopify Link header for pagination
 */
function parseLinkHeader(linkHeader: string | null): string | null {
  if (!linkHeader) return null;

  const links = linkHeader.split(',');
  for (const link of links) {
    if (link.includes('rel="next"')) {
      const match = link.match(/<([^>]+)>/);
      return match ? match[1] : null;
    }
  }

  return null;
}
