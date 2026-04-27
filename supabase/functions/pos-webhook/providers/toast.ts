import { calculateTransactionSplit } from '../utils/split-calculator.ts';

/**
 * Handle Toast POS webhook events
 * Docs: https://doc.toasttab.com/doc/devguide/webhooks.html
 */
export async function handleToastWebhook(
  payload: any,
  headers: any,
  supabase: any
): Promise<any> {
  console.log('🟧 Processing Toast webhook');

  // Toast uses HMAC SHA256 signature
  const signature = headers['toast-signature'];
  const webhookSecret = Deno.env.get('TOAST_WEBHOOK_SECRET');
  
  if (webhookSecret && signature) {
    // Toast signature verification would go here
    // For now, we'll skip it in development
  }

  // Handle check created/updated event
  if (payload.eventType === 'CHECK_CREATED' || payload.eventType === 'CHECK_UPDATED') {
    const check = payload.check;
    
    if (!check || check.amount === 0) {
      return { success: true, message: 'Empty check, skipping' };
    }

    // Get merchant by restaurant GUID
    const { data: integration } = await supabase
      .from('pos_integrations')
      .select('user_id, config')
      .eq('provider', 'toast')
      .eq('store_id', payload.restaurantGuid)
      .single();

    if (!integration) {
      console.error('❌ No integration found for restaurant:', payload.restaurantGuid);
      return { success: false, error: 'Integration not found' };
    }

    // Check for duplicate
    const { data: existing } = await supabase
      .from('pos_transactions')
      .select('id')
      .eq('pos_provider', 'toast')
      .eq('external_transaction_id', check.guid)
      .single();

    if (existing) {
      console.log('⚠️ Duplicate transaction, skipping');
      return { success: true, duplicate: true };
    }

    // Calculate barter split
    const totalAmount = check.amount;
    const barterConfig = integration.config?.barterPercentage || 25;
    
    const split = calculateTransactionSplit(
      totalAmount,
      barterConfig,
      check.tipAmount || 0
    );

    // Parse selections (items)
    const items = check.selections?.map((item: any) => ({
      name: item.itemName,
      quantity: item.quantity,
      price: item.price
    })) || [];

    // Insert transaction
    const { data: transaction, error } = await supabase
      .from('pos_transactions')
      .insert({
        merchant_id: integration.user_id,
        external_transaction_id: check.guid,
        pos_provider: 'toast',
        total_amount: totalAmount,
        currency: 'USD',
        tax_amount: check.taxAmount || 0,
        tip_amount: check.tipAmount || 0,
        discount_amount: check.discountAmount || 0,
        barter_amount: split.barterAmount,
        barter_percentage: split.barterPercentage,
        cash_amount: split.cashAmount,
        card_amount: split.cardAmount,
        items: items,
        location_id: payload.restaurantGuid,
        transaction_date: check.createdDate,
        webhook_signature: signature,
        raw_webhook_data: payload,
        status: check.closedDate ? 'completed' : 'pending'
      })
      .select()
      .single();

    if (error) {
      console.error('❌ Error inserting transaction:', error);
      return { success: false, error: error.message };
    }

    console.log('✅ Toast transaction processed:', transaction.id);
    return { success: true, transaction_id: transaction.id };
  }

  return { success: true, message: 'Event type not handled' };
}
