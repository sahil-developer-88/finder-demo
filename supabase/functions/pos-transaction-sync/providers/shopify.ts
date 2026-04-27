/**
 * Shopify Order Creation
 * Creates an order in Shopify Admin so it appears in the dashboard
 * with split payment (cash + barter credits)
 */

interface ShopifyConfig {
  id: string;
  provider: string;
  store_id: string;
  access_token: string;
  shop_url?: string;
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

export async function syncShopifyOrder(
  integration: ShopifyConfig,
  request: SyncRequest
): Promise<{ order_id: string; order_number: string }> {

  // Handle shop URL properly - remove .myshopify.com if already present
  let shopUrl = integration.shop_url || integration.store_id;
  shopUrl = shopUrl.replace(/\.myshopify\.com.*$/, ''); // Remove .myshopify.com and anything after
  shopUrl = `${shopUrl}.myshopify.com`; // Add it back once

  const apiVersion = '2024-01';

  // Build line items from request
  const lineItems = request.items.map(item => ({
    variant_id: item.external_variant_id || null,
    product_id: item.external_product_id || null,
    title: item.name,
    price: item.price.toFixed(2),
    quantity: item.quantity,
    sku: item.sku || null,
    taxable: true,
  }));

  // Build transaction objects for split payment
  const transactions = [];

  // Cash payment
  if (request.totals.cash_amount > 0) {
    transactions.push({
      kind: 'sale',
      status: 'success',
      amount: request.totals.total.toFixed(2), // Total cash including tax
      gateway: 'Cash',
      currency: 'USD',
    });
  }

  // Barter credits as custom payment method
  if (request.totals.barter_amount > 0) {
    transactions.push({
      kind: 'sale',
      status: 'success',
      amount: request.totals.barter_amount.toFixed(2),
      gateway: 'Barter Credits',
      currency: 'USD',
    });
  }

  // Build order payload
  const orderPayload = {
    order: {
      line_items: lineItems,
      financial_status: 'paid',
      fulfillment_status: null,

      // Transactions (payments)
      transactions: transactions,

      // Customer info (optional)
      customer: request.customer_info?.email ? {
        email: request.customer_info.email,
        first_name: request.customer_info.name?.split(' ')[0] || 'Customer',
        last_name: request.customer_info.name?.split(' ').slice(1).join(' ') || '',
      } : undefined,

      // Tax
      tax_lines: request.totals.tax_amount > 0 ? [{
        price: request.totals.tax_amount.toFixed(2),
        rate: 0.0825, // 8.25% - should be configurable
        title: 'Sales Tax',
      }] : [],

      // Metadata
      note: 'Created via Barter App',
      tags: 'barter, split-payment',
      note_attributes: [
        {
          name: 'barter_transaction_id',
          value: request.transaction_id,
        },
        {
          name: 'barter_amount',
          value: request.totals.barter_amount.toFixed(2),
        },
        {
          name: 'cash_amount',
          value: request.totals.cash_amount.toFixed(2),
        },
      ],

      // Mark as processed
      processed_at: new Date().toISOString(),
    },
  };

  console.log('Creating Shopify order:', {
    shop: shopUrl,
    line_items: lineItems.length,
    total: request.totals.total,
  });

  // Call Shopify API
  const response = await fetch(
    `https://${shopUrl}/admin/api/${apiVersion}/orders.json`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': integration.access_token,
      },
      body: JSON.stringify(orderPayload),
    }
  );

  if (!response.ok) {
    const errorBody = await response.text();
    console.error('Shopify API Error:', {
      status: response.status,
      body: errorBody,
    });
    throw new Error(`Shopify API error: ${response.status} - ${errorBody}`);
  }

  const result = await response.json();

  console.log('Shopify order created:', {
    order_id: result.order.id,
    order_number: result.order.order_number,
    name: result.order.name,
  });

  return {
    order_id: result.order.id.toString(),
    order_number: result.order.order_number.toString(),
  };
}
