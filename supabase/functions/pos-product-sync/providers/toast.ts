/**
 * Sync products from Toast
 * Docs: https://doc.toasttab.com/openapi/orders/operation/menusGet/
 */
export async function syncToastProducts(
  integration: any,
  userId: string,
  supabase: any,
  progressId?: string
): Promise<any> {
  console.log('🍞 Syncing Toast products...');

  // TODO: Implement Toast product sync
  // Will fetch from: https://ws-api.toasttab.com/menus/v2/menus

  return {
    success: false,
    error: 'Toast product sync not yet implemented'
  };
}
