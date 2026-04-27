/**
 * Square Payment Creation
 * Creates a payment in Square so it appears in Square Dashboard
 * Uses custom tender for barter credits
 */

interface SquareConfig {
  id: string;
  provider: string;
  store_id: string; // location_id
  access_token: string;
}

interface SyncRequest {
  transaction_id: string;
  merchant_id: string;
  items: Array<{
    external_product_id: string;
    external_variant_id?: string;
    name: string;
    price: number;
    quantity: number;
    sku?: string;
  }>;
  totals: {
    subtotal: number;
    cash_amount: number;
    barter_amount: number;
    tax_amount: number;
    total: number;
  };
  customer_info?: {
    id?: string;
    name?: string;
    email?: string;
  };
}

export async function syncSquarePayment(
  integration: SquareConfig,
  request: SyncRequest
): Promise<{ payment_id: string; order_id?: string }> {

  const apiVersion = '2024-12-18';
  const baseUrl = 'https://connect.squareup.com/v2';

  // Step 1: Create Order (itemized receipt)
  const lineItems = request.items.map(item => ({
    name: item.name,
    quantity: item.quantity.toString(),
    base_price_money: {
      amount: Math.round(item.price * 100), // Square uses cents
      currency: 'USD',
    },
    variation_name: item.sku || undefined,
  }));

  const orderPayload = {
    idempotency_key: `barter-${request.transaction_id}`,
    order: {
      location_id: integration.store_id,
      line_items: lineItems,
      taxes: request.totals.tax_amount > 0 ? [{
        name: 'Sales Tax',
        percentage: '8.25', // Should be configurable
        scope: 'ORDER',
      }] : [],
      metadata: {
        barter_transaction_id: request.transaction_id,
        barter_amount: request.totals.barter_amount.toFixed(2),
        cash_amount: request.totals.cash_amount.toFixed(2),
      },
    },
  };

  console.log('Creating Square order:', {
    location: integration.store_id,
    items: lineItems.length,
  });

  const orderResponse = await fetch(`${baseUrl}/orders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${integration.access_token}`,
      'Square-Version': apiVersion,
    },
    body: JSON.stringify(orderPayload),
  });

  if (!orderResponse.ok) {
    const errorBody = await orderResponse.text();
    console.error('Square Order API Error:', {
      status: orderResponse.status,
      body: errorBody,
    });
    throw new Error(`Square Order API error: ${orderResponse.status}`);
  }

  const orderResult = await orderResponse.json();
  const orderId = orderResult.order.id;

  console.log('Square order created:', orderId);

  // Step 2: Create Payment with multiple tenders
  const tenders = [];

  // Cash tender
  if (request.totals.cash_amount > 0) {
    tenders.push({
      type: 'CASH',
      amount_money: {
        amount: Math.round(request.totals.total * 100), // Total cash including tax
        currency: 'USD',
      },
      note: 'Cash payment',
    });
  }

  // Barter credits as OTHER tender (custom)
  if (request.totals.barter_amount > 0) {
    tenders.push({
      type: 'OTHER',
      amount_money: {
        amount: Math.round(request.totals.barter_amount * 100),
        currency: 'USD',
      },
      note: 'Barter Credits',
      payment_note: 'Payment via Barter Credits',
    });
  }

  const paymentPayload = {
    idempotency_key: `payment-${request.transaction_id}`,
    location_id: integration.store_id,
    order_id: orderId,
    amount_money: {
      amount: Math.round((request.totals.total + request.totals.barter_amount) * 100),
      currency: 'USD',
    },
    // Note: Square doesn't support multiple tenders in API v2
    // We'll create as cash and add note about barter
    note: `Split payment: $${request.totals.cash_amount.toFixed(2)} cash + $${request.totals.barter_amount.toFixed(2)} barter credits`,
    reference_id: request.transaction_id,
  };

  console.log('Creating Square payment:', {
    order_id: orderId,
    amount: request.totals.total + request.totals.barter_amount,
  });

  const paymentResponse = await fetch(`${baseUrl}/payments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${integration.access_token}`,
      'Square-Version': apiVersion,
    },
    body: JSON.stringify(paymentPayload),
  });

  if (!paymentResponse.ok) {
    const errorBody = await paymentResponse.text();
    console.error('Square Payment API Error:', {
      status: paymentResponse.status,
      body: errorBody,
    });
    throw new Error(`Square Payment API error: ${paymentResponse.status}`);
  }

  const paymentResult = await paymentResponse.json();

  console.log('Square payment created:', {
    payment_id: paymentResult.payment.id,
    order_id: orderId,
  });

  return {
    payment_id: paymentResult.payment.id,
    order_id: orderId,
  };
}
