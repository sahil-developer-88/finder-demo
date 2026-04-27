/**
 * Toast Check Creation
 * Creates a check (order) in Toast POS for restaurants
 */

interface ToastConfig {
  id: string;
  provider: string;
  store_id: string; // restaurant_guid
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

export async function syncToastCheck(
  integration: ToastConfig,
  request: SyncRequest
): Promise<{ check_guid: string }> {

  const baseUrl = 'https://ws-api.toasttab.com';
  const restaurantGuid = integration.store_id;

  // Build selections (line items)
  const selections = request.items.map(item => ({
    itemGuid: item.external_product_id,
    quantity: item.quantity,
    price: item.price,
    modifiers: [],
  }));

  const checkPayload = {
    entityType: 'Check',
    selections: selections,
    amount: request.totals.total + request.totals.barter_amount,
    taxAmount: request.totals.tax_amount,
    tipAmount: 0,
    payments: [
      {
        type: 'CASH',
        amount: request.totals.total,
        tipAmount: 0,
      },
      {
        type: 'OTHER',
        amount: request.totals.barter_amount,
        otherPayment: {
          name: 'Barter Credits',
        },
      },
    ],
    closedDate: new Date().toISOString(),
    note: `Barter transaction ${request.transaction_id}`,
  };

  console.log('Creating Toast check:', {
    restaurant: restaurantGuid,
    items: selections.length,
  });

  const response = await fetch(
    `${baseUrl}/orders/v2/checks`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${integration.access_token}`,
        'Toast-Restaurant-External-ID': restaurantGuid,
      },
      body: JSON.stringify(checkPayload),
    }
  );

  if (!response.ok) {
    const errorBody = await response.text();
    console.error('Toast API Error:', errorBody);
    throw new Error(`Toast API error: ${response.status}`);
  }

  const result = await response.json();

  console.log('Toast check created:', result.guid);

  return {
    check_guid: result.guid,
  };
}
