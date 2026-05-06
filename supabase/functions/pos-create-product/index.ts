import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

// ── Token refresh (mirrors pos-product-sync pattern) ─────────────────────────
async function refreshToken(integration: any): Promise<string> {
  const provider = integration.provider?.toLowerCase();
  let tokenUrl = '';
  let body: any = {};

  if (provider === 'clover') {
    // Clover v2 OAuth refresh: no client_secret, no grant_type
    // Docs: https://docs.clover.com/docs/use-refresh-token-to-generate-new-expiring-token
    const env = integration.config?.environment || 'production';
    tokenUrl = env === 'sandbox'
      ? 'https://apisandbox.dev.clover.com/oauth/v2/refresh'
      : 'https://api.clover.com/oauth/v2/refresh';
    body = {
      client_id: Deno.env.get('CLOVER_OAUTH_CLIENT_ID'),
      refresh_token: integration.refresh_token,
    };
  } else if (provider === 'square') {
    const clientId = Deno.env.get('SQUARE_OAUTH_CLIENT_ID') || '';
    tokenUrl = clientId.includes('sandbox')
      ? 'https://connect.squareupsandbox.com/oauth2/token'
      : 'https://connect.squareup.com/oauth2/token';
    body = {
      client_id: clientId,
      client_secret: Deno.env.get('SQUARE_OAUTH_CLIENT_SECRET'),
      grant_type: 'refresh_token',
      refresh_token: integration.refresh_token,
    };
  } else {
    throw new Error(`Token refresh not supported for ${provider}`);
  }

  const res = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) throw new Error(`Token refresh failed: ${res.status} - ${await res.text()}`);
  const data = await res.json();
  const newToken = data.access_token;

  // Encrypt and save refreshed token (same pattern as pos-product-sync)
  const encryptionNonce = crypto.randomUUID();
  const { data: encryptedAccess } = await supabase.rpc('encrypt_pos_token', {
    p_token: newToken,
    p_nonce: encryptionNonce,
  });

  let encryptedRefresh = null;
  if (data.refresh_token) {
    const { data: er } = await supabase.rpc('encrypt_pos_token', {
      p_token: data.refresh_token,
      p_nonce: encryptionNonce,
    });
    encryptedRefresh = er;
  }

  await supabase.from('pos_integrations').update({
    encryption_nonce: encryptionNonce,
    access_token_encrypted: encryptedAccess,
    refresh_token_encrypted: encryptedRefresh || integration.refresh_token_encrypted,
    access_token: newToken,
    refresh_token: data.refresh_token || integration.refresh_token,
    updated_at: new Date().toISOString(),
  }).eq('id', integration.id);

  integration.access_token = newToken;
  if (data.refresh_token) integration.refresh_token = data.refresh_token;
  return newToken;
}

async function callWithRefresh(integration: any, fn: (token: string) => Promise<string>): Promise<string> {
  try {
    return await fn(integration.access_token);
  } catch (err: any) {
    if ((err.message?.includes('401') || err.message?.includes('Unauthorized')) && integration.refresh_token) {
      console.log('Token expired, refreshing...');
      const newToken = await refreshToken(integration);
      return await fn(newToken);
    }
    throw err;
  }
}

// ── Shopify ───────────────────────────────────────────────────────────────────
async function createShopifyProduct(integration: any, data: any): Promise<string> {
  const shopDomain = integration.store_id || integration.config?.shop_domain;
  const apiVersion = '2024-01';

  return await callWithRefresh(integration, async (token) => {
    const payload: any = {
      product: {
        title: data.name,
        body_html: data.description || '',
        product_type: data.product_type || 'REGULAR',
        variants: [{
          price: String(Number(data.price).toFixed(2)),
          inventory_quantity: data.stock_quantity ?? 0,
          inventory_management: 'shopify',
        }],
        status: 'active',
      }
    };
    if (data.image_url) payload.product.images = [{ src: data.image_url }];

    const res = await fetch(`https://${shopDomain}/admin/api/${apiVersion}/products.json`, {
      method: 'POST',
      headers: { 'X-Shopify-Access-Token': token, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) throw new Error(`Shopify ${res.status} - ${await res.text()}`);
    const result = await res.json();
    return String(result.product.id);
  });
}

// ── Square ────────────────────────────────────────────────────────────────────
async function createSquareProduct(integration: any, data: any): Promise<string> {
  const env = integration.config?.environment || 'production';
  const baseUrl = env === 'sandbox' ? 'https://connect.squareupsandbox.com' : 'https://connect.squareup.com';
  const objId = `#${crypto.randomUUID()}`;
  const productType = data.product_type || 'REGULAR';

  return await callWithRefresh(integration, async (token) => {
    const payload: any = {
      idempotency_key: crypto.randomUUID(),
      object: {
        type: 'ITEM',
        id: objId,
        item_data: {
          name: data.name,
          description: data.description || '',
          product_type: productType,
          variations: [{
            type: 'ITEM_VARIATION',
            id: `#${crypto.randomUUID()}`,
            item_variation_data: {
              item_id: objId,
              name: 'Regular',
              pricing_type: 'FIXED_PRICING',
              price_money: { amount: Math.round(Number(data.price) * 100), currency: 'USD' },
            }
          }]
        }
      }
    };
    if (data.image_url) {
      payload.object.item_data.image_ids = []; // placeholder — Square image upload requires a separate API call
    }

    const res = await fetch(`${baseUrl}/v2/catalog/object`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json', 'Square-Version': '2023-12-13' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) throw new Error(`Square ${res.status} - ${await res.text()}`);
    const result = await res.json();
    return String(result.catalog_object.id);
  });
}

// ── Clover ────────────────────────────────────────────────────────────────────
async function createCloverProduct(integration: any, data: any): Promise<string> {
  const env = integration.config?.environment;
  const baseUrl = env === 'sandbox' ? 'https://apisandbox.dev.clover.com' : 'https://api.clover.com';

  return await callWithRefresh(integration, async (token) => {
    // Resolve merchant ID — fetch from API if not stored
    let merchantId = integration.merchant_id || integration.config?.merchant_id;
    if (!merchantId) {
      const mRes = await fetch(`${baseUrl}/v3/merchants/me`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!mRes.ok) throw new Error(`Clover merchant fetch ${mRes.status} - ${await mRes.text()}`);
      const mData = await mRes.json();
      merchantId = mData.id;
      // Save for future
      await supabase.from('pos_integrations').update({ merchant_id: merchantId }).eq('id', integration.id);
      integration.merchant_id = merchantId;
    }

    const payload = {
      name: data.name,
      alternateName: data.description || '',
      price: Math.round(Number(data.price) * 100),
      priceType: 'FIXED',
      defaultTaxRates: true,
      available: true,
      product_type: data.product_type || 'REGULAR',
    };

    const res = await fetch(`${baseUrl}/v3/merchants/${merchantId}/items`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) throw new Error(`Clover ${res.status} - ${await res.text()}`);
    const result = await res.json();
    return String(result.id);
  });
}

// ── Toast ─────────────────────────────────────────────────────────────────────
async function createToastProduct(integration: any, data: any): Promise<string> {
  const restaurantGuid = integration.store_id;

  return await callWithRefresh(integration, async (token) => {
    const payload = {
      name: data.name,
      description: data.description || '',
      price: Number(data.price),
      unitOfMeasure: 'NONE',
      type: 'MENU_ITEM',
      visibility: ['POS'],
    };

    const res = await fetch('https://ws-api.toasttab.com/menus/v2/menuItems', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Toast-Restaurant-External-ID': restaurantGuid,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) throw new Error(`Toast ${res.status} - ${await res.text()}`);
    const result = await res.json();
    return String(result.guid);
  });
}

// ── Main handler ──────────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const json = (data: any, status = 200) => new Response(
    JSON.stringify(data),
    { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Missing authorization header' }, 401);

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return json({ error: 'Unauthorized' }, 401);

    const body = await req.json();
    const { pos_integration_id, name, description, price, stock_quantity, image_url, barter_percentage, product_type } = body;

    if (!pos_integration_id || !name || price == null) {
      return json({ error: 'Missing required fields: pos_integration_id, name, price' }, 400);
    }

    const { data: integration, error: intError } = await supabase
      .from('pos_integrations').select('*')
      .eq('id', pos_integration_id).eq('user_id', user.id).single();

    if (intError || !integration) return json({ error: 'POS integration not found' }, 404);

    // Decrypt access token if stored encrypted (same pattern as pos-product-sync)
    if (integration.access_token_encrypted && integration.encryption_nonce) {
      const { data: decryptedAccess, error: decryptErr } = await supabase
        .rpc('decrypt_pos_token', {
          p_encrypted_token: integration.access_token_encrypted,
          p_nonce: integration.encryption_nonce,
        });
      if (decryptErr || !decryptedAccess) {
        return json({ error: 'Token decryption failed' }, 500);
      }
      integration.access_token = decryptedAccess;

      if (integration.refresh_token_encrypted) {
        const { data: decryptedRefresh } = await supabase
          .rpc('decrypt_pos_token', {
            p_encrypted_token: integration.refresh_token_encrypted,
            p_nonce: integration.encryption_nonce,
          });
        integration.refresh_token = decryptedRefresh;
      }
    } else if (!integration.access_token) {
      return json({ error: 'No access token available for this integration' }, 500);
    }

    const provider = integration.provider?.toLowerCase();
    let externalProductId: string;

    if (provider === 'shopify') {
      externalProductId = await createShopifyProduct(integration, { name, description, price, stock_quantity, image_url, product_type });
    } else if (provider === 'square') {
      externalProductId = await createSquareProduct(integration, { name, description, price, stock_quantity, image_url, product_type });
    } else if (provider === 'clover') {
      externalProductId = await createCloverProduct(integration, { name, description, price, stock_quantity, product_type });
    } else if (provider === 'toast') {
      externalProductId = await createToastProduct(integration, { name, description, price, product_type });
    } else {
      externalProductId = crypto.randomUUID();
    }

    const { data: product, error: insertError } = await supabase.from('products').insert({
      merchant_id: user.id,
      pos_integration_id,
      external_product_id: externalProductId,
      name,
      description: description || null,
      price: Number(price),
      stock_quantity: stock_quantity ? Number(stock_quantity) : null,
      image_url: image_url || null,
      custom_barter_percentage: barter_percentage ? Number(barter_percentage) : null,
      barter_enabled: !!barter_percentage,
      product_type: product_type || 'REGULAR',
      is_active: true,
      is_archived: false,
      sync_status: 'synced',
      last_synced_at: new Date().toISOString(),
    }).select().single();

    if (insertError) return json({ error: insertError.message }, 500);

    return json({ success: true, product });

  } catch (err: any) {
    console.error('pos-create-product error:', err);
    return json({ error: err.message }, 500);
  }
});
