import { mapCategory } from '../utils/category-mapper.ts';

/**
 * Sync products from Toast POS menu API
 * Docs: https://doc.toasttab.com/openapi/orders/operation/menusGet/
 */
export async function syncToastProducts(
  integration: any,
  userId: string,
  supabase: any,
  progressId?: string
): Promise<any> {
  console.log('🍞 Syncing Toast products...');

  const accessToken = integration.access_token;
  const restaurantGuid = integration.store_id;

  if (!accessToken) {
    return { success: false, error: 'Toast access token not configured' };
  }

  if (!restaurantGuid) {
    return { success: false, error: 'Toast restaurant GUID not configured' };
  }

  try {
    console.log('📡 Fetching menus from Toast...');

    const response = await fetch('https://ws-api.toasttab.com/menus/v2/menus', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Toast-Restaurant-External-ID': restaurantGuid,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error('❌ Toast API error:', errorBody);
      throw new Error(`Toast API error: ${response.status} - ${errorBody}`);
    }

    const data = await response.json();
    const menus: any[] = data.menus || [];

    // Flatten all items across menus and groups, preserving group name as category
    const allItems: Array<{ item: any; groupName: string; menuName: string }> = [];
    for (const menu of menus) {
      for (const group of (menu.groups || [])) {
        for (const item of (group.items || [])) {
          allItems.push({ item, groupName: group.name || '', menuName: menu.name || '' });
        }
      }
    }

    console.log(`📦 Found ${allItems.length} items across ${menus.length} menus`);

    if (allItems.length === 0) {
      return { success: true, message: 'No menu items found in Toast', synced: 0, skipped: 0 };
    }

    if (progressId) {
      await supabase
        .from('product_sync_progress')
        .update({
          total_items: allItems.length,
          current_step: `Syncing ${allItems.length} items from Toast...`,
        })
        .eq('id', progressId);
    }

    let syncedCount = 0;
    let skippedCount = 0;
    let processedCount = 0;
    const syncErrors: string[] = [];

    for (const { item, groupName, menuName } of allItems) {
      try {
        await syncToastProduct(item, groupName, menuName, integration, userId, supabase);
        syncedCount++;
      } catch (error: any) {
        console.error(`❌ Error syncing item ${item.guid}:`, error.message);
        syncErrors.push(`${item.guid}: ${error.message}`);
        skippedCount++;
      }

      processedCount++;

      if (progressId) {
        await supabase
          .from('product_sync_progress')
          .update({
            processed_items: processedCount,
            synced_items: syncedCount,
            skipped_items: skippedCount,
            error_items: syncErrors.length,
            current_item_name: item.name || 'Unknown item',
            current_step: `Processing item ${processedCount}/${allItems.length}...`,
          })
          .eq('id', progressId);
      }
    }

    console.log(`\n✅ Toast sync complete! Synced: ${syncedCount}, Skipped: ${skippedCount}`);

    return {
      success: true,
      message: 'Products synced successfully',
      synced: syncedCount,
      skipped: skippedCount,
      errors: syncErrors.length > 0 ? syncErrors : undefined,
    };

  } catch (error: any) {
    console.error('❌ Toast sync error:', error);
    return {
      success: false,
      error: error.message || 'Failed to sync Toast products',
    };
  }
}

/**
 * Upsert a single Toast menu item into the products table
 */
async function syncToastProduct(
  item: any,
  groupName: string,
  menuName: string,
  integration: any,
  userId: string,
  supabase: any
): Promise<void> {
  const itemGuid = item.guid;
  const name = item.name || 'Unnamed Item';
  const description = item.description || null;

  // Toast prices are in dollars (not cents)
  const price = typeof item.price === 'number' ? item.price : 0;

  // Use the menu group name as the category
  const categoryMapping = await mapCategory(groupName, name, description, supabase);

  // First image URL if present
  const imageUrl = item.images?.[0]?.url || null;

  // Item is available if visibility includes POS and it's not deleted
  const isActive = !item.isDeleted && (item.visibility?.includes('POS') ?? true);

  console.log(`  📊 Item: ${name}`);
  console.log(`  💰 Price: $${price}`);
  console.log(`  📁 Group: ${groupName} → Category: ${categoryMapping.matchedCategory}`);
  console.log(`  🚫 Restricted: ${categoryMapping.isRestricted}`);

  // Check for existing product
  const { data: existingRows } = await supabase
    .from('products')
    .select('id')
    .eq('pos_integration_id', integration.id)
    .eq('external_product_id', itemGuid)
    .is('external_variant_id', null)
    .limit(1);

  const existing = existingRows?.[0] ?? null;

  const productData = {
    merchant_id: userId,
    pos_integration_id: integration.id,
    external_product_id: itemGuid,
    external_variant_id: null,
    name,
    description,
    category_id: categoryMapping.categoryId,
    price,
    currency: 'USD',
    stock_quantity: 0, // Toast does not expose inventory counts via menu API
    sku: item.sku || null,
    barcode: null,
    upc: null,
    barter_enabled: !categoryMapping.isRestricted && isActive,
    image_url: imageUrl,
    is_active: isActive,
    last_synced_at: new Date().toISOString(),
    sync_status: 'synced',
    metadata: {
      toast_item_guid: itemGuid,
      toast_menu_name: menuName,
      toast_group_name: groupName,
      toast_unit_of_measure: item.unitOfMeasure || null,
      toast_type: item.type || null,
      toast_visibility: item.visibility || [],
      toast_is_discountable: item.isDiscountable ?? true,
      toast_calories: item.calories || null,
      is_restricted: categoryMapping.isRestricted,
      restriction_reason: categoryMapping.isRestricted
        ? `Restricted category: ${categoryMapping.matchedCategory}`
        : null,
    },
  };

  if (existing) {
    console.log(`  🔄 Updating existing product...`);
    const { error } = await supabase
      .from('products')
      .update(productData)
      .eq('id', existing.id);

    if (error) throw new Error(`Failed to update product: ${error.message}`);
  } else {
    console.log(`  ➕ Inserting new product...`);
    const { error } = await supabase
      .from('products')
      .insert(productData);

    if (error) throw new Error(`Failed to insert product: ${error.message}`);
  }

  console.log(`  ✅ Product synced successfully`);
}
