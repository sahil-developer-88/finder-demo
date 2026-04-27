import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Create Lightspeed Order - Edge Function
 *
 * Supports two modes:
 *
 * 1. Lightspeed eCom (E-Series / Ecwid) — if ecwid_store_id + ecwid_secret_token are configured:
 *    Creates a cart via Ecwid REST API → returns checkout URL for redirect
 *    API: https://app.ecwid.com/api/v3/{storeId}/
 *
 * 2. Lightspeed Retail (X-Series) — default OAuth integration:
 *    Creates a sale via Retail API as "layby" (pending payment)
 *    Customer pays at store or via Lightspeed Payments at register
 *
 * The merchant's integration type is auto-detected from the config.
 */

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);

    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    const { order_id, pos_integration_id } = await req.json();

    if (!order_id) {
      throw new Error('order_id is required');
    }

    console.log('💡 Create Lightspeed Order Started');
    console.log(`   Order ID: ${order_id}`);
    console.log(`   User ID: ${user.id}`);

    // Step 1: Fetch order with items
    const { data: order, error: orderError } = await supabaseClient
      .from('orders')
      .select(`
        *,
        order_items (*)
      `)
      .eq('id', order_id)
      .single();

    if (orderError || !order) {
      throw new Error(`Order not found: ${orderError?.message || 'Unknown error'}`);
    }

    if (order.customer_id !== user.id) {
      throw new Error('Unauthorized: Not your order');
    }

    console.log(`   Order Number: ${order.order_number}`);
    console.log(`   Merchant ID: ${order.merchant_id}`);
    console.log(`   Items: ${order.order_items?.length || 0}`);
    console.log(`   Barter Amount: $${order.barter_amount}`);
    console.log(`   Cash Amount: $${order.cash_amount}`);

    // Step 2: Get merchant's Lightspeed integration
    let integration;

    if (pos_integration_id) {
      const { data, error } = await supabaseClient
        .from('pos_integrations')
        .select('*')
        .eq('id', pos_integration_id)
        .eq('provider', 'lightspeed')
        .eq('status', 'active')
        .single();

      integration = data;
      if (error) {
        console.log('⚠️ Specified integration not found:', error.message);
      }
    }

    if (!integration) {
      const { data, error } = await supabaseClient
        .from('pos_integrations')
        .select('*')
        .eq('user_id', order.merchant_id)
        .eq('provider', 'lightspeed')
        .eq('status', 'active')
        .limit(1)
        .single();

      integration = data;
      if (error) {
        return new Response(
          JSON.stringify({
            success: true,
            pos_sync_skipped: true,
            reason: 'Merchant does not have an active Lightspeed integration',
            order_id: order_id
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Check if token is expired before decrypting
    if (integration.token_expires_at) {
      const expiresAt = new Date(integration.token_expires_at);
      const now = new Date();
      console.log(`Token expires at: ${expiresAt.toISOString()}, now: ${now.toISOString()}`);
      if (expiresAt <= now) {
        console.error('❌ Access token is expired');
        throw new Error('Access token expired. Please reconnect your Lightspeed integration.');
      }
    }

    // Decrypt access token if encrypted
    let accessToken = integration.access_token;

    if (integration.access_token_encrypted && integration.encryption_nonce) {
      console.log('🔓 Decrypting access token...');
      const { data: decryptedToken, error: decryptError } = await supabaseClient
        .rpc('decrypt_pos_token', {
          p_encrypted_token: integration.access_token_encrypted,
          p_nonce: integration.encryption_nonce
        });

      if (decryptError || !decryptedToken) {
        console.error('❌ Failed to decrypt access token:', decryptError);
        throw new Error('Token decryption failed');
      }
      accessToken = decryptedToken;
    } else if (!accessToken) {
      throw new Error('No access token available for Lightspeed');
    }

    const storeId = integration.store_id;
    const barterDiscount = order.barter_amount;
    const taxAmount = order.tax_amount || 0;
    const amountToPay = order.cash_amount + taxAmount;

    // Check if this is a Lightspeed eCom (Ecwid) integration
    const lightspeedMode = integration.config?.lightspeed_mode;
    const isEcomMode = lightspeedMode === 'ecom';
    const ecwidStoreId = integration.config?.ecwid_store_id || storeId;

    console.log(`   Store ID: ${storeId}`);
    console.log(`   Lightspeed Mode: ${lightspeedMode || 'xseries'}`);
    console.log(`   Is eCom (Ecwid): ${isEcomMode}`);
    console.log(`   Barter Discount: -$${barterDiscount}`);
    console.log(`   Amount to Pay: $${amountToPay}`);

    if (isEcomMode) {
      // ===== Ecwid / Lightspeed eCom Flow (redirect to checkout) =====
      // accessToken here is the OAuth token obtained during merchant connection
      return await createEcwidCheckout({
        supabaseClient,
        order,
        integration,
        ecwidStoreId,
        ecwidAccessToken: accessToken, // OAuth token from pos_integrations
        barterDiscount,
        amountToPay,
        order_id
      });
    } else {
      // ===== Retail X-Series Flow (create sale in POS) =====
      return await createRetailSale({
        supabaseClient,
        order,
        integration,
        accessToken,
        storeId,
        barterDiscount,
        amountToPay,
        order_id
      });
    }

  } catch (error: any) {
    console.error('❌ Error in create-lightspeed-order:', error);

    const msg: string = error.message || '';
    const isAuthError = msg.toLowerCase().includes('expired') || msg.includes('401') || msg.includes('403') || msg.toLowerCase().includes('unauthorized');

    return new Response(
      JSON.stringify({
        success: false,
        error: isAuthError
          ? 'Your Lightspeed integration has expired. Please go to Settings → POS Integration and reconnect Lightspeed.'
          : msg || 'Unknown error occurred',
        ...(isAuthError && { error_code: 'LIGHTSPEED_AUTH_EXPIRED' })
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

/**
 * Ecwid / Lightspeed eCom Checkout Flow
 * Uses Ecwid REST API to create an abandoned cart, then redirects
 * the customer to the storefront checkout URL to complete payment.
 *
 * API base: https://app.ecwid.com/api/v3/{storeId}/
 * Auth: Bearer {secretToken}
 *
 * Requires ecwid_store_id and ecwid_secret_token in integration config.
 */
async function createEcwidCheckout({
  supabaseClient, order, integration, ecwidStoreId, ecwidAccessToken,
  barterDiscount, amountToPay, order_id
}: any) {
  const ecwidBaseUrl = `https://app.ecwid.com/api/v3/${ecwidStoreId}`;
  const authHeader = `Bearer ${ecwidAccessToken}`;

  console.log('🛒 Ecwid (Lightspeed eCom) Checkout Flow');
  console.log(`   Store ID: ${ecwidStoreId}`);
  console.log(`   API URL: ${ecwidBaseUrl}`);

  // Step 1: Resolve storefront URL
  // Try to get merchant's configured store URL from profile first.
  // If not set, fall back to the Ecwid Instant Site URL built from the store ID.
  let storeUrl: string;

  console.log('Getting Ecwid store profile...');
  const profileResp = await fetch(`${ecwidBaseUrl}/profile`, {
    headers: { 'Authorization': authHeader }
  });

  if (profileResp.ok) {
    const profile = await profileResp.json();
    const generalInfo = profile.generalInfo || {};
    const starterSite = generalInfo.starterSite || {};

    const rawUrl = generalInfo.storeUrl
      || (starterSite.customDomain ? `https://${starterSite.customDomain}` : null)
      || (starterSite.ecwidSubdomain ? `https://${starterSite.ecwidSubdomain}.company.site` : null);

    // Strip any path — we only want the base URL (e.g. https://value-hub-2.company.site)
    storeUrl = rawUrl ? new URL(rawUrl).origin : null;

    if (!storeUrl) {
      console.error('Ecwid profile returned no store URL. generalInfo:', JSON.stringify(generalInfo));
      throw new Error('Could not determine store URL from Ecwid profile. Please set a store URL in your Lightspeed eCom settings.');
    }
  } else {
    const errText = await profileResp.text();
    console.error(`Failed to get Ecwid profile (${profileResp.status}): ${errText}`);
    throw new Error(`Failed to get Ecwid store profile: ${profileResp.status}`);
  }

  console.log(`Store URL resolved: ${storeUrl}`);

  // Step 2: Build items for calculate endpoint (needs productId + quantity)
  const cartItems = order.order_items
    .filter((item: any) => item.external_product_id)
    .map((item: any) => ({
      productId: parseInt(item.external_product_id),
      quantity: item.quantity
    }));

  if (cartItems.length === 0) {
    return new Response(
      JSON.stringify({
        success: true,
        pos_sync_skipped: true,
        reason: 'No cart items have Lightspeed eCom product IDs',
        order_id
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Step 3a: Calculate order details first (required by Ecwid before creating order)
  // This returns item names, prices, subtotal, total which are required by POST /orders
  console.log(`Calculating Ecwid order details (${cartItems.length} items)...`);

  const calculatePayload: any = {
    items: cartItems,
    billingPerson: {
      name: order.customer_name || '',
      phone: order.customer_phone || ''
    }
  };

  if (barterDiscount > 0) {
    calculatePayload.discountInfo = [{
      value: barterDiscount,
      type: 'ABSOLUTE',
      source: 'COUPON',
      description: `Barter Credits (${order.barter_percentage}%)`
    }];
  }

  const calcResp = await fetch(`${ecwidBaseUrl}/order/calculate`, {
    method: 'POST',
    headers: {
      'Authorization': authHeader,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(calculatePayload)
  });

  if (!calcResp.ok) {
    const errText = await calcResp.text();
    console.error(`Failed to calculate Ecwid order (${calcResp.status}): ${errText}`);
    throw new Error(`Failed to calculate Ecwid order: ${calcResp.status} - ${errText || 'no details'}`);
  }

  const calcData = await calcResp.json();
  console.log(`Order calculated: subtotal=${calcData.subtotal}, total=${calcData.total}`);

  // Step 3b: Create order using calculated data
  // Remove id/internalId from calculated response, add customer email and comments
  const { id: _id, internalId: _internalId, ...calcOrderData } = calcData;

  const ecwidOrderPayload: any = {
    ...calcOrderData,
    email: order.customer_email,
    paymentStatus: 'AWAITING_PAYMENT',
    fulfillmentStatus: 'AWAITING_PROCESSING',
    orderComments: order.customer_notes
      ? `Barter Order #${order.order_number}\n${order.customer_notes}`
      : `Barter Order #${order.order_number}`,
  };

  console.log(`Creating Ecwid order (discount: $${barterDiscount})...`);

  const orderResp = await fetch(`${ecwidBaseUrl}/orders`, {
    method: 'POST',
    headers: {
      'Authorization': authHeader,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(ecwidOrderPayload)
  });

  if (!orderResp.ok) {
    const errText = await orderResp.text();
    console.error(`Failed to create Ecwid order (${orderResp.status})`);
    console.error(`Response body: ${errText || '(empty)'}`);
    throw new Error(`Failed to create Ecwid order: ${orderResp.status} - ${errText || 'no details'}`);
  }

  const orderData = await orderResp.json();
  const ecwidOrderId = orderData.id;
  const ecwidOrderNumber = orderData.orderNumber;
  console.log(`Ecwid order created: ID=${ecwidOrderId}, Number=${ecwidOrderNumber}`);

  // Step 4: Build order page URL — customer pays here
  const checkoutUrl = `${storeUrl.replace(/\/$/, '')}/order/${ecwidOrderNumber}`;
  console.log(`Checkout URL: ${checkoutUrl}`);

  // Step 5: Record payment session — use Ecwid order ID for webhook matching
  await supabaseClient.from('pos_payment_sessions').insert({
    customer_id: order.customer_id,
    merchant_id: order.merchant_id,
    pos_integration_id: integration.id,
    pos_provider: 'lightspeed',
    pos_order_id: ecwidOrderId.toString(),
    total_amount: order.total_amount,
    barter_amount: order.barter_amount,
    barter_percentage: order.barter_percentage,
    cash_amount: amountToPay,
    session_status: 'discount_applied',
    expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
  });

  // Step 6: Update our order status
  await supabaseClient.from('orders').update({
    status: 'pending_pos_payment',
    pos_draft_order_id: ecwidOrderId.toString(),
    pos_provider: 'lightspeed',
    pos_integration_id: integration.id,
    metadata: {
      ...order.metadata,
      ecwid_order_id: ecwidOrderId,
      ecwid_order_number: ecwidOrderNumber,
      ecwid_store_id: ecwidStoreId,
      checkout_url: checkoutUrl,
      barter_discount: barterDiscount,
      pos_synced_at: new Date().toISOString()
    }
  }).eq('id', order_id);

  return new Response(
    JSON.stringify({
      success: true,
      order_id: order_id,
      ecwid_order_id: ecwidOrderId,
      amount_to_pay: amountToPay,
      checkout_url: checkoutUrl,
      pos_provider: 'lightspeed',
      message: 'Redirecting to Lightspeed eCom to complete payment.'
    }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

/**
 * Retail X-Series Flow
 * Uses Lightspeed Retail (X-Series) API to create a sale.
 * The Retail API uses OAuth Bearer token and the store domain.
 * Retail does NOT have a hosted checkout - creates a pending sale in the POS.
 */
async function createRetailSale({
  supabaseClient, order, integration, accessToken, storeId,
  barterDiscount, amountToPay, order_id
}: any) {
  // Retail X-Series API: https://{store}.retail.lightspeed.app/api/2.0/
  const retailBaseUrl = `https://${storeId}.retail.lightspeed.app/api/2.0`;

  console.log('🏪 Retail X-Series Flow');
  console.log(`   Retail API: ${retailBaseUrl}`);

  // Step 1: Get register and outlet info
  console.log('📋 Getting register info...');
  const registersResp = await fetch(`${retailBaseUrl}/registers`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    }
  });

  let registerId = null;
  let outletId = null;

  if (registersResp.ok) {
    const regData = await registersResp.json();
    const registers = regData.data || regData.registers || [];
    if (registers.length > 0) {
      registerId = registers[0].id;
      outletId = registers[0].outlet_id;
      console.log(`   Register: ${registers[0].name} (${registerId})`);
    }
  }

  // Step 2: Look up or create customer in Lightspeed
  console.log('👤 Looking up customer...');
  let customerId = null;

  const customerSearchResp = await fetch(
    `${retailBaseUrl}/customers?email=${encodeURIComponent(order.customer_email)}`,
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    }
  );

  if (customerSearchResp.ok) {
    const custData = await customerSearchResp.json();
    const customers = custData.data || custData.customers || [];
    if (customers.length > 0) {
      customerId = customers[0].id;
      console.log(`   Found customer: ${customerId}`);
    }
  }

  if (!customerId) {
    // Create customer
    const createCustResp = await fetch(`${retailBaseUrl}/customers`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        first_name: order.customer_name?.split(' ')[0] || 'Customer',
        last_name: order.customer_name?.split(' ').slice(1).join(' ') || '',
        email: order.customer_email,
        phone: order.customer_phone || ''
      })
    });

    if (createCustResp.ok) {
      const newCust = await createCustResp.json();
      customerId = newCust.data?.id || newCust.customer?.id || newCust.id;
      console.log(`   Created customer: ${customerId}`);
    }
  }

  // Step 3: Build sale line items
  const saleProducts = order.order_items.map((item: any) => {
    const lineItem: any = {
      quantity: item.quantity,
      price: item.unit_price,
      tax: item.tax_amount || 0
    };

    if (item.external_product_id) {
      lineItem.product_id = item.external_product_id;
    } else {
      // Custom product for items not synced from Lightspeed
      lineItem.product_name = item.product_name;
      lineItem.price = item.unit_price;
    }

    return lineItem;
  });

  // Step 4: Create sale as "layby" (pending payment)
  console.log('💳 Creating sale in Lightspeed Retail...');

  const salePayload: any = {
    register_id: registerId,
    customer_id: customerId,
    sale_date: new Date().toISOString(),
    status: 'layby', // Pending payment - shows as on-hold in POS
    note: `Barter Order #${order.order_number}\nBarter Discount: -$${barterDiscount.toFixed(2)}\nAmount Due: $${amountToPay.toFixed(2)}${order.customer_notes ? '\n' + order.customer_notes : ''}`,
    register_sale_products: saleProducts
  };

  // Apply barter discount as a line item discount
  if (barterDiscount > 0) {
    salePayload.register_sale_products.push({
      product_name: `Barter Credits Discount (${order.barter_percentage}%)`,
      quantity: 1,
      price: -barterDiscount,
      tax: 0
    });
  }

  const saleResp = await fetch(`${retailBaseUrl}/register_sales`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(salePayload)
  });

  let lightspeedSaleId = null;
  let saleInvoiceNumber = null;

  if (saleResp.ok) {
    const saleData = await saleResp.json();
    const sale = saleData.data || saleData.register_sale || saleData;
    lightspeedSaleId = sale.id;
    saleInvoiceNumber = sale.invoice_number || sale.receipt_number;
    console.log(`✅ Sale created: ${lightspeedSaleId}`);
    console.log(`   Invoice: ${saleInvoiceNumber}`);
  } else {
    const errText = await saleResp.text();
    console.error(`❌ Failed to create Retail sale (${saleResp.status}): ${errText}`);
    return new Response(
      JSON.stringify({
        success: false,
        error: `Failed to create Lightspeed sale: ${errText}`
      }),
      { status: 400, headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' } }
    );
  }

  // Step 5: Create payment session
  await supabaseClient.from('pos_payment_sessions').insert({
    customer_id: order.customer_id,
    merchant_id: order.merchant_id,
    pos_integration_id: integration.id,
    pos_provider: 'lightspeed',
    pos_order_id: lightspeedSaleId?.toString(),
    total_amount: order.total_amount,
    barter_amount: order.barter_amount,
    barter_percentage: order.barter_percentage,
    cash_amount: amountToPay,
    session_status: 'discount_applied',
    expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
  });

  // Step 6: Update order status
  await supabaseClient.from('orders').update({
    status: 'confirmed',
    pos_draft_order_id: lightspeedSaleId?.toString(),
    pos_provider: 'lightspeed',
    pos_integration_id: integration.id,
    metadata: {
      ...order.metadata,
      lightspeed_sale_id: lightspeedSaleId,
      lightspeed_invoice: saleInvoiceNumber,
      lightspeed_store_id: storeId,
      payment_method: 'pay_at_store',
      pos_synced_at: new Date().toISOString()
    }
  }).eq('id', order_id);

  // Deduct barter credits since order is confirmed
  if (order.barter_amount > 0) {
    await supabaseClient.rpc('deduct_user_credits', {
      p_user_id: order.customer_id,
      p_amount: order.barter_amount
    });
    console.log(`✅ Deducted ${order.barter_amount} barter credits`);
  }

  console.log('🎉 Retail sale complete');

  return new Response(
    JSON.stringify({
      success: true,
      order_id: order_id,
      lightspeed_sale_id: lightspeedSaleId,
      invoice_number: saleInvoiceNumber,
      payment_method: 'pay_at_store',
      amount_to_pay: amountToPay,
      pos_provider: 'lightspeed',
      message: 'Order created in Lightspeed POS. Barter discount applied. Please pay remaining balance at store.',
      setup_info: 'For online checkout redirect, configure eCom API credentials (ecom_api_key, ecom_api_secret) in the integration settings.'
    }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
