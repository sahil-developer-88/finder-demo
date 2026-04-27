import { createHmac } from "https://deno.land/std@0.177.0/node/crypto.ts";
import { calculateTransactionSplit } from '../utils/split-calculator.ts';

/**
 * Handle Adyen webhook notifications
 * Docs: https://docs.adyen.com/development-resources/webhooks
 */
export async function handleAdyenWebhook(
  payload: any,
  headers: any,
  supabase: any
): Promise<any> {
  console.log('🟪 Processing Adyen webhook');

  // Verify webhook signature
  const signature = headers['hmacSignature'] || payload.additionalData?.hmacSignature;
  const webhookHmacKey = Deno.env.get('ADYEN_WEBHOOK_HMAC_KEY');
  
  if (webhookHmacKey && signature) {
    const isValid = verifyAdyenSignature(payload, signature, webhookHmacKey);
    
    if (!isValid) {
      console.error('❌ Invalid Adyen signature');
      return { success: false, error: 'Invalid signature' };
    }
  }

  // Handle AUTHORISATION event
  const notificationItem = payload.notificationItems?.[0]?.NotificationRequestItem;
  
  if (notificationItem && notificationItem.eventCode === 'AUTHORISATION' && notificationItem.success === 'true') {
    // Get merchant by merchant account
    const { data: integration } = await supabase
      .from('pos_integrations')
      .select('user_id, config')
      .eq('provider', 'adyen')
      .eq('merchant_id', notificationItem.merchantAccountCode)
      .single();

    if (!integration) {
      console.error('❌ No integration found for merchant:', notificationItem.merchantAccountCode);
      return { success: false, error: 'Integration not found' };
    }

    // Check for duplicate
    const { data: existing } = await supabase
      .from('pos_transactions')
      .select('id')
      .eq('pos_provider', 'adyen')
      .eq('external_transaction_id', notificationItem.pspReference)
      .single();

    if (existing) {
      console.log('⚠️ Duplicate transaction, skipping');
      return { success: true, duplicate: true };
    }

    // Calculate barter split
    const totalAmount = notificationItem.amount.value / 100; // Adyen uses minor units
    const barterConfig = integration.config?.barterPercentage || 25;
    
    const split = calculateTransactionSplit(totalAmount, barterConfig, 0);

    // Insert transaction
    const { data: transaction, error } = await supabase
      .from('pos_transactions')
      .insert({
        merchant_id: integration.user_id,
        external_transaction_id: notificationItem.pspReference,
        pos_provider: 'adyen',
        total_amount: totalAmount,
        currency: notificationItem.amount.currency,
        barter_amount: split.barterAmount,
        barter_percentage: split.barterPercentage,
        cash_amount: split.cashAmount,
        card_amount: split.cardAmount,
        payment_methods: [{
          method: notificationItem.paymentMethod
        }],
        transaction_date: notificationItem.eventDate,
        webhook_signature: signature,
        raw_webhook_data: payload,
        status: 'completed'
      })
      .select()
      .single();

    if (error) {
      console.error('❌ Error inserting transaction:', error);
      return { success: false, error: error.message };
    }

    console.log('✅ Adyen transaction processed:', transaction.id);
    return { success: true, transaction_id: transaction.id };
  }

  return { success: true, message: 'Event type not handled' };
}

/**
 * Verify Adyen HMAC signature
 */
function verifyAdyenSignature(payload: any, signature: string, hmacKey: string): boolean {
  const notificationItem = payload.notificationItems?.[0]?.NotificationRequestItem;
  
  if (!notificationItem) return false;

  // Create signature string according to Adyen spec
  const signatureString = [
    notificationItem.pspReference,
    notificationItem.originalReference,
    notificationItem.merchantAccountCode,
    notificationItem.merchantReference,
    notificationItem.amount.value,
    notificationItem.amount.currency,
    notificationItem.eventCode,
    notificationItem.success
  ].join(':');

  // Convert hex key to Buffer for Node crypto
  const keyBuffer = Buffer.from(hmacKey, 'hex');
  const signatureBuffer = Buffer.from(signatureString, 'utf8');
  
  const hmac = createHmac('sha256', keyBuffer);
  hmac.update(signatureBuffer);
  const expectedSignature = hmac.digest('base64');

  return signature === expectedSignature;
}
