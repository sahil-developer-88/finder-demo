/**
 * Lightspeed Sale Creation
 * Creates a sale in Lightspeed Retail POS
 */

interface LightspeedConfig {
  id: string;
  provider: string;
  store_id: string; // account_id
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

export async function syncLightspeedSale(
  integration: LightspeedConfig,
  request: SyncRequest
): Promise<{ sale_id: string }> {

  const baseUrl = 'https://api.lightspeedapp.com/API/V3';
  const accountId = integration.store_id;

  // Build sale lines
  const saleLines = request.items.map(item => ({
    itemID: item.external_product_id,
    unitQuantity: item.quantity,
    unitPrice: item.price,
    note: '',
  }));

  // Build payments
  const salePayments = [];

  if (request.totals.cash_amount > 0) {
    salePayments.push({
      paymentTypeID: 1, // Cash - ID varies by account
      amount: request.totals.total,
    });
  }

  if (request.totals.barter_amount > 0) {
    salePayments.push({
      paymentTypeID: 4, // Custom payment type
      amount: request.totals.barter_amount,
      merchantAccountID: null,
    });
  }

  const salePayload = {
    Sale: {
      SaleLines: {
        SaleLine: saleLines,
      },
      SalePayments: {
        SalePayment: salePayments,
      },
      tax: request.totals.tax_amount,
      completed: true,
      note: `Barter transaction ${request.transaction_id}`,
    },
  };

  console.log('Creating Lightspeed sale:', {
    account: accountId,
    lines: saleLines.length,
  });

  const response = await fetch(
    `${baseUrl}/Account/${accountId}/Sale.json`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${integration.access_token}`,
      },
      body: JSON.stringify(salePayload),
    }
  );

  if (!response.ok) {
    const errorBody = await response.text();
    console.error('Lightspeed API Error:', errorBody);
    throw new Error(`Lightspeed API error: ${response.status}`);
  }

  const result = await response.json();

  console.log('Lightspeed sale created:', result.Sale.saleID);

  return {
    sale_id: result.Sale.saleID.toString(),
  };
}
