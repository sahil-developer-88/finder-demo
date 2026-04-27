/**
 * Clover Order Creation
 * Creates an order in Clover using Atomic Orders API
 */

interface CloverConfig {
  id: string;
  provider: string;
  store_id: string; // merchant_id
  access_token: string;
}

interface SyncRequest {
  transaction_id: string;
  items: Array<{
    external_product_id: string;
    name: string;
    price: number;
    quantity: number;
  }>;
  totals: {
    subtotal: number;
    cash_amount: number;
    barter_amount: number;
    tax_amount: number;
    total: number;
  };
}

export async function syncCloverOrder(
  integration: CloverConfig,
  request: SyncRequest
): Promise<{ order_id: string }> {

  const baseUrl = 'https://api.clover.com/v3';
  const merchantId = integration.store_id;

  // Create order with line items
  const lineItems = request.items.map(item => ({
    item: {
      id: item.external_product_id,
    },
    name: item.name,
    price: Math.round(item.price * 100), // Clover uses cents
    unitQty: item.quantity * 1000, // Clover uses thousandths
  }));

  const orderPayload = {
    state: 'locked',
    total: Math.round((request.totals.total + request.totals.barter_amount) * 100),
    lineItems: lineItems,
    note: `Barter transaction: $${request.totals.cash_amount} cash + $${request.totals.barter_amount} barter`,
    metadata: {
      barter_transaction_id: request.transaction_id,
    },
  };

  console.log('Creating Clover order:', {
    merchant: merchantId,
    items: lineItems.length,
  });

  const orderResponse = await fetch(
    `${baseUrl}/merchants/${merchantId}/atomic_order/orders`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${integration.access_token}`,
      },
      body: JSON.stringify(orderPayload),
    }
  );

  if (!orderResponse.ok) {
    const errorBody = await orderResponse.text();
    console.error('Clover API Error:', errorBody);
    throw new Error(`Clover API error: ${orderResponse.status}`);
  }

  const orderResult = await orderResponse.json();

  // Add payment to order
  const paymentPayload = {
    amount: Math.round(request.totals.total * 100),
    tender: {
      label: 'Cash + Barter',
      labelKey: 'com.clover.tender.cash',
    },
    note: `Split: $${request.totals.cash_amount} cash, $${request.totals.barter_amount} barter`,
  };

  await fetch(
    `${baseUrl}/merchants/${merchantId}/orders/${orderResult.id}/payments`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${integration.access_token}`,
      },
      body: JSON.stringify(paymentPayload),
    }
  );

  console.log('Clover order created:', orderResult.id);

  return {
    order_id: orderResult.id,
  };
}
