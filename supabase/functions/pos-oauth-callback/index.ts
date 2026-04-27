import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_at?: string;
  merchant_id?: string;
  scope?: string;
}

/**
 * Register webhooks with Shopify using Admin API
 * Split architecture: draft_orders → dedicated endpoint, others → general endpoint
 */
const registerShopifyWebhook = async (shopDomain: string, accessToken: string): Promise<void> => {
  const baseUrl = Deno.env.get('SUPABASE_URL');

  // Webhook configuration with dedicated endpoints
  const webhooks = [
    // Draft order webhooks → Dedicated endpoint for split payments
    { topic: 'draft_orders/create', url: `${baseUrl}/functions/v1/shopify-draft-webhook` },
    { topic: 'draft_orders/update', url: `${baseUrl}/functions/v1/shopify-draft-webhook` },
    { topic: 'draft_orders/delete', url: `${baseUrl}/functions/v1/shopify-draft-webhook` },

    // Order webhooks → General POS endpoint for POS Extension payments
    { topic: 'orders/create', url: `${baseUrl}/functions/v1/pos-webhook?provider=shopify` },
    { topic: 'orders/paid', url: `${baseUrl}/functions/v1/pos-webhook?provider=shopify` },

    // Product webhooks → General POS endpoint for inventory sync
    { topic: 'products/create', url: `${baseUrl}/functions/v1/pos-webhook?provider=shopify` },
    { topic: 'products/update', url: `${baseUrl}/functions/v1/pos-webhook?provider=shopify` },
    { topic: 'products/delete', url: `${baseUrl}/functions/v1/pos-webhook?provider=shopify` },
  ];

  console.log('📋 Registering Shopify webhooks with split architecture:');
  console.log('   Draft orders → /shopify-draft-webhook (payment flow)');
  console.log('   Products → /pos-webhook (inventory sync)');

  for (const webhook of webhooks) {
    try {
      const response = await fetch(`https://${shopDomain}/admin/api/2024-01/webhooks.json`, {
        method: 'POST',
        headers: {
          'X-Shopify-Access-Token': accessToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          webhook: {
            topic: webhook.topic,
            address: webhook.url,
            format: 'json',
          },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        // Don't throw error if webhook already exists
        if (response.status === 422 && errorText.includes('already exists')) {
          console.log(`⚠️ Webhook ${webhook.topic} already exists, skipping`);
          continue;
        }
        console.error(`Failed to register webhook ${webhook.topic}:`, errorText);
        throw new Error(`Webhook registration failed for ${webhook.topic}: ${response.statusText}`);
      }

      const data = await response.json();
      console.log(`✅ Webhook registered: ${webhook.topic} → ${webhook.url}`);
    } catch (error) {
      console.error(`Error registering webhook ${webhook.topic}:`, error);
      // Continue registering other webhooks even if one fails
    }
  }
};

/**
 * Register Square catalog webhook subscription
 * Subscribes to catalog.version.updated so product changes auto-sync
 */
const registerSquareWebhooks = async (
  accessToken: string,
  environment: string,
  integrationId: string
): Promise<void> => {
  const baseUrl = environment === 'sandbox'
    ? 'https://connect.squareupsandbox.com'
    : 'https://connect.squareup.com';
  const webhookUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/pos-webhook?provider=square`;

  const response = await fetch(`${baseUrl}/v2/webhooks/subscriptions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'Square-Version': '2023-12-13'
    },
    body: JSON.stringify({
      idempotency_key: integrationId || crypto.randomUUID(),
      subscription: {
        name: 'Product catalog sync',
        notification_url: webhookUrl,
        event_types: ['catalog.version.updated']
      }
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error('Failed to register Square catalog webhook:', errText);
  } else {
    const data = await response.json();
    console.log('✅ Square catalog webhook registered:', data.subscription?.id);
  }
};

/**
 * Register webhooks with Ecwid (Lightspeed eCom) API
 * Uses POST /api/v3/{storeId}/webhooks
 */
const registerEcwidWebhooks = async (storeId: string, accessToken: string): Promise<void> => {
  const webhookUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/pos-webhook?provider=lightspeed_ecom`;

  const events = ['orders.updated', 'products.created', 'products.updated', 'products.deleted'];

  for (const event of events) {
    const response = await fetch(`https://app.ecwid.com/api/v3/${storeId}/webhooks`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ url: webhookUrl, event })
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`Failed to register Ecwid webhook for ${event}:`, errText);
    } else {
      console.log(`✅ Ecwid webhook registered: ${event}`);
    }
  }
};

/**
 * Register webhook with Lightspeed using API
 */
const registerLightspeedWebhook = async (storeId: string, accessToken: string): Promise<void> => {
  const webhookUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/pos-webhook?provider=lightspeed`;

  const response = await fetch(
    `https://${storeId}.retail.lightspeed.app/api/webhook.json`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        topic: 'sale.update',
        url: webhookUrl,
        format: 'json',
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Failed to register Lightspeed webhook:', errorText);
    throw new Error(`Webhook registration failed: ${response.statusText}`);
  }

  const data = await response.json();
  console.log('Lightspeed webhook registered:', data);
};

const exchangeCodeForToken = async (
  provider: string,
  code: string,
  redirectUri: string,
  shopName?: string
): Promise<TokenResponse> => {
  let tokenUrl = '';
  let clientId = '';
  let clientSecret = '';

  switch (provider.toLowerCase()) {
    case 'square':
      console.log("llllllll")
      clientId = Deno.env.get('SQUARE_OAUTH_CLIENT_ID') || '';
      clientSecret = Deno.env.get('SQUARE_OAUTH_CLIENT_SECRET') || '';
      // Use sandbox URL if client ID contains 'sandbox'
      tokenUrl = clientId.includes('sandbox')
        ? 'https://connect.squareupsandbox.com/oauth2/token'
        : 'https://connect.squareup.com/oauth2/token';
      break;

    case 'shopify':
      if (!shopName) {
        throw new Error('Shop name is required for Shopify OAuth');
      }
      tokenUrl = `https://${shopName}/admin/oauth/access_token`;
      clientId = Deno.env.get('SHOPIFY_CLIENT_ID') || '';
      clientSecret = Deno.env.get('SHOPIFY_CLIENT_SECRET') || '';
      break;

    case 'clover':
      // Support both sandbox and production Clover environments
      // NOTE: Using legacy OAuth v1 endpoint which returns merchant access tokens (UUID format)
      // OAuth v2 returns JWT app tokens which CANNOT access /v3/merchants/* endpoints
      // Legacy OAuth: sandbox.dev.clover.com/oauth/token (NOT apisandbox which is for REST API)
      const cloverEnv = Deno.env.get('CLOVER_ENVIRONMENT') || 'production';
      tokenUrl = cloverEnv === 'sandbox'
        ? 'https://sandbox.dev.clover.com/oauth/token'
        : 'https://www.clover.com/oauth/token';
      clientId = Deno.env.get('CLOVER_OAUTH_CLIENT_ID') || '';
      clientSecret = Deno.env.get('CLOVER_OAUTH_CLIENT_SECRET') || '';
      console.log(`🔧 Clover environment: ${cloverEnv}, using LEGACY token URL: ${tokenUrl}`);
      break;

    case 'lightspeed':
      // Lightspeed token endpoint requires store domain
      if (!shopName) {
        throw new Error('Lightspeed requires store domain for token exchange');
      }
      tokenUrl = `https://${shopName}.retail.lightspeed.app/api/1.0/token`;
      clientId = Deno.env.get('LIGHTSPEED_OAUTH_CLIENT_ID') || '';
      clientSecret = Deno.env.get('LIGHTSPEED_OAUTH_CLIENT_SECRET') || '';
      break;

    case 'lightspeed_ecom':
      // Ecwid (Lightspeed eCom) token exchange
      tokenUrl = 'https://my.ecwid.com/api/oauth/token';
      clientId = Deno.env.get('ECWID_CLIENT_ID') || '';
      clientSecret = Deno.env.get('ECWID_CLIENT_SECRET') || '';
      break;

    default:
      throw new Error(`Unsupported provider: ${provider}`);
  }

  console.log(`🔄 Exchanging code for ${provider}`);
  console.log(`   Token URL: ${tokenUrl}`);
  console.log(`   Client ID (full): ${clientId}`);
  console.log(`   Client Secret (first 10 chars): ${clientSecret.substring(0, 10)}...`);
  console.log(`   Client Secret (last 4 chars): ...${clientSecret.slice(-4)}`);
  console.log(`   Redirect URI: ${redirectUri}`);
  console.log(`   Shop Name: ${shopName || 'N/A'}`);
  console.log(`   Code (first 10 chars): ${code.substring(0, 10)}...`);

  // Different providers have different token exchange formats
  let response: Response;

  if (provider.toLowerCase() === 'clover') {
    // Clover OAuth token exchange - GET request with query parameters
    // Based on official example: https://github.com/cloverhackathons/OAuthNodeExpress
    // URL: /oauth/token?client_id=X&client_secret=Y&code=Z
    const cloverTokenUrl = `${tokenUrl}?client_id=${encodeURIComponent(clientId)}&client_secret=${encodeURIComponent(clientSecret)}&code=${encodeURIComponent(code)}`;
    console.log(`   Request format: GET with query params (Clover OAuth)`);
    console.log(`   Token URL: ${tokenUrl}`);
    console.log(`   Params: client_id=${clientId}, client_secret=***, code=${code.substring(0, 10)}...`);

    response = await fetch(cloverTokenUrl, {
      method: 'GET',
    });

    // Log full response for debugging
    const responseText = await response.text();
    console.log(`   Response status: ${response.status}`);
    console.log(`   Response body: ${responseText}`);

    if (!response.ok) {
      console.error(`❌ Clover token exchange failed: ${responseText}`);
      throw new Error(`Failed to exchange authorization code: ${response.statusText} - ${responseText}`);
    }

    // Parse and validate the response
    const cloverTokenData = JSON.parse(responseText);
    console.log(`✅ Clover token response:`);
    console.log(`   access_token: ${cloverTokenData.access_token?.substring(0, 20)}...`);
    console.log(`   token_type: ${cloverTokenData.token_type}`);
    console.log(`   expires_in: ${cloverTokenData.expires_in}`);
    console.log(`   merchant_id: ${cloverTokenData.merchant_id}`);

    // Validate it's a UUID token, not a JWT
    if (cloverTokenData.access_token?.startsWith('eyJ')) {
      console.error(`❌ ERROR: Received JWT token instead of merchant access token!`);
      throw new Error('Invalid token type: received JWT instead of merchant access token');
    }

    return cloverTokenData;
  } else if (provider.toLowerCase() === 'lightspeed' || provider.toLowerCase() === 'lightspeed_ecom') {
    // Lightspeed X-Series and Ecwid (Lightspeed eCom): credentials in body as form-urlencoded
    const params = new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
    });
    console.log(`   Request format: form-urlencoded (credentials in body)`);
    console.log(`   Body params: code=..., client_id=${clientId}, grant_type=authorization_code, redirect_uri=${redirectUri}`);

    response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });
  } else {
    // Square, Shopify: Use JSON body
    const body = JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    });
    console.log(`   Request format: JSON body`);

    response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body,
    });
  }

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`❌ Token exchange failed for ${provider}`);
    console.error(`   Status: ${response.status} ${response.statusText}`);
    console.error(`   URL: ${tokenUrl}`);
    console.error(`   Response: ${errorText}`);
    console.error(`   Client ID: ${clientId.substring(0, 10)}...`);
    console.error(`   Redirect URI: ${redirectUri}`);
    throw new Error(`Failed to exchange authorization code: ${response.statusText} - ${errorText}`);
  }

  console.log(`✅ Token exchange successful for ${provider}`);

  const tokenResponse = await response.json();

  // Log full token response for debugging
  if (provider.toLowerCase() === 'lightspeed') {
    console.log('🔍 Lightspeed token response:', JSON.stringify(tokenResponse, null, 2));
    console.log('🔑 access_token:', tokenResponse.access_token?.substring(0, 30) + '...');
    console.log('🔄 refresh_token:', tokenResponse.refresh_token?.substring(0, 30) + '...');
    console.log('⏰ expires_in:', tokenResponse.expires_in);
    console.log('🔐 token_type:', tokenResponse.token_type);
    console.log('📋 scope:', tokenResponse.scope);
  }

  if (provider.toLowerCase() === 'clover') {
    console.log('🔍 Clover token response:', JSON.stringify(tokenResponse, null, 2));
    console.log('🔑 access_token:', tokenResponse.access_token?.substring(0, 30) + '...');
  }

  return tokenResponse;
};

const getMerchantInfo = async (provider: string, accessToken: string, clientId?: string, shopName?: string, tokenMerchantId?: string) => {
  let merchantId = '';
  let locationId = '';
  let storeId = '';
  let capabilities: string[] = [];
  let locationStatus = '';
  let businessName = '';

  try {
    switch (provider.toLowerCase()) {
      case 'square': {
        // Use sandbox URL if client ID contains 'sandbox'
        const isSandbox = clientId?.includes('sandbox');
        const baseUrl = isSandbox
          ? 'https://connect.squareupsandbox.com'
          : 'https://connect.squareup.com';

        const response = await fetch(`${baseUrl}/v2/merchants`, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Square-Version': '2024-01-18',
          },
        });

        if (response.ok) {
          const data = await response.json();
          merchantId = data.merchant?.[0]?.id || '';
          businessName = data.merchant?.[0]?.business_name || '';
          console.log(`🏪 Square merchant: ${businessName} (${merchantId})`);

          // Get locations with capabilities
          const locationsResponse = await fetch(`${baseUrl}/v2/locations`, {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Square-Version': '2024-01-18',
            },
          });

          if (locationsResponse.ok) {
            const locationsData = await locationsResponse.json();
            const location = locationsData.locations?.[0];
            locationId = location?.id || '';
            capabilities = location?.capabilities || [];
            locationStatus = location?.status || '';

            console.log(`📍 Square location: ${location?.name} (${locationId})`);
            console.log(`   Status: ${locationStatus}`);
            console.log(`   Capabilities: ${capabilities.join(', ') || 'NONE'}`);

            // Check if online payments are enabled
            const hasCardProcessing = capabilities.includes('CREDIT_CARD_PROCESSING');
            console.log(`   Can process cards: ${hasCardProcessing ? 'YES ✅' : 'NO ❌'}`);

            if (!hasCardProcessing) {
              console.log(`⚠️ WARNING: This Square account may not be able to accept online payments!`);
              console.log(`   The merchant needs to complete Square account setup and enable online payments.`);
            }
          }
        }
        break;
      }

      case 'shopify': {
        if (!shopName) {
          throw new Error('Shop name is required for Shopify');
        }
        const response = await fetch(`https://${shopName}/admin/api/2024-01/shop.json`, {
          headers: {
            'X-Shopify-Access-Token': accessToken,
          },
        });

        if (response.ok) {
          const data = await response.json();
          merchantId = data.shop?.id?.toString() || '';
          locationId = data.shop?.primary_location_id?.toString() || '';
          storeId = shopName; // Store the shop domain for webhook identification
        }
        break;
      }
      
      case 'clover': {
        // Clover provides merchant_id as a query parameter in the OAuth callback URL
        if (tokenMerchantId) {
          merchantId = tokenMerchantId;
          console.log(`✅ Clover merchant ID from callback URL: ${merchantId}`);
        } else {
          console.error(`❌ Clover merchant_id not found in callback URL parameters`);
          console.error(`   Expected: ?merchant_id=XXX in the OAuth callback URL`);
        }

        // Fetch merchant details from Clover API for debugging
        const cloverEnv = Deno.env.get('CLOVER_ENVIRONMENT') || 'production';
        const cloverApiBase = cloverEnv === 'sandbox'
          ? 'https://apisandbox.dev.clover.com'
          : 'https://api.clover.com';

        console.log(`🔍 Fetching Clover merchant details...`);
        console.log(`   API Base: ${cloverApiBase}`);
        console.log(`   Merchant ID: ${merchantId}`);
        console.log(`   Access Token (first 20): ${accessToken?.substring(0, 20)}...`);

        try {
          // Fetch merchant info
          const merchantResponse = await fetch(
            `${cloverApiBase}/v3/merchants/${merchantId}`,
            {
              headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Accept': 'application/json'
              }
            }
          );

          console.log(`   Merchant API Response Status: ${merchantResponse.status}`);

          if (merchantResponse.ok) {
            const merchantData = await merchantResponse.json();
            console.log(`✅ Clover Merchant Info:`);
            console.log(`   Name: ${merchantData.name}`);
            console.log(`   ID: ${merchantData.id}`);
            console.log(`   Owner Email: ${merchantData.owner?.email}`);
            console.log(`   Phone: ${merchantData.phoneNumber}`);
            console.log(`   Address: ${merchantData.address?.city}, ${merchantData.address?.state}`);
            console.log(`   Currency: ${merchantData.defaultCurrency}`);
            console.log(`   Timezone: ${merchantData.timezone}`);
            console.log(`   Full Response: ${JSON.stringify(merchantData, null, 2)}`);
            businessName = merchantData.name || '';
          } else {
            const errorText = await merchantResponse.text();
            console.error(`❌ Failed to fetch merchant info: ${merchantResponse.status}`);
            console.error(`   Error: ${errorText}`);
            console.error(`   This likely means the access token is invalid or missing permissions`);
          }

          // Fetch app info/permissions
          const appResponse = await fetch(
            `${cloverApiBase}/v3/merchants/${merchantId}/apps`,
            {
              headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Accept': 'application/json'
              }
            }
          );

          console.log(`   Apps API Response Status: ${appResponse.status}`);

          if (appResponse.ok) {
            const appsData = await appResponse.json();
            console.log(`✅ Clover Apps Installed:`);
            console.log(`   ${JSON.stringify(appsData, null, 2)}`);
          } else {
            const errorText = await appResponse.text();
            console.error(`❌ Failed to fetch apps: ${appResponse.status} - ${errorText}`);
          }

          // Fetch roles/permissions
          const rolesResponse = await fetch(
            `${cloverApiBase}/v3/merchants/${merchantId}/roles`,
            {
              headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Accept': 'application/json'
              }
            }
          );

          console.log(`   Roles API Response Status: ${rolesResponse.status}`);

          if (rolesResponse.ok) {
            const rolesData = await rolesResponse.json();
            console.log(`✅ Clover Roles:`);
            console.log(`   ${JSON.stringify(rolesData, null, 2)}`);
          } else {
            const errorText = await rolesResponse.text();
            console.error(`❌ Failed to fetch roles: ${rolesResponse.status} - ${errorText}`);
          }

        } catch (cloverError: any) {
          console.error(`❌ Error fetching Clover details: ${cloverError.message}`);
        }

        break;
      }

      case 'lightspeed': {
        console.log(`💡 Processing Lightspeed integration...`);
        console.log(`💡 Shop name/domain: ${shopName || 'NOT PROVIDED'}`);

        if (!shopName) {
          console.error(`❌ Shop name required for Lightspeed`);
          break;
        }

        // For Lightspeed R-Series, we can't easily get the account ID from the API
        // without knowing it first (chicken-egg problem).
        // So we'll just save the store_id (shop domain) and skip the account_id for now.
        // The product sync can use the store_id to make API calls.

        storeId = shopName; // Store domain prefix
        console.log(`✅ Lightspeed store ID (shop domain): ${storeId}`);
        console.log(`⚠️  Account ID will need to be configured separately if needed`);

        break;
      }
    }
  } catch (error) {
    console.error(`Error fetching merchant info for ${provider}:`, error);
  }

  return { merchantId, locationId, storeId, capabilities, locationStatus, businessName };
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const shop = url.searchParams.get('shop'); // Shopify shop domain
    const domainPrefix = url.searchParams.get('domain_prefix'); // Lightspeed domain prefix
    const cloverMerchantId = url.searchParams.get('merchant_id'); // Clover merchant ID from callback
    const cloverEmployeeId = url.searchParams.get('employee_id'); // Clover employee ID from callback
    const error = url.searchParams.get('error');

    console.log('📥 Callback URL params:', {
      code: code?.substring(0, 10) + '...',
      state: state?.substring(0, 10) + '...',
      shop,
      domainPrefix,
      cloverMerchantId,
      cloverEmployeeId
    });

    if (error) {
      console.error('OAuth error:', error);
      // Peek at state to check for mobile redirect before we have full state data
      const frontendUrl = Deno.env.get('FRONTEND_URL') || 'http://localhost:8080';
      if (state) {
        const supabaseEarly = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
        const { data: earlyState } = await supabaseEarly.from('oauth_states').select('metadata').eq('state_token', state).single();
        if (earlyState?.metadata?.mobile_redirect_uri) {
          return Response.redirect(`${earlyState.metadata.mobile_redirect_uri}?oauth_error=${encodeURIComponent(error)}`);
        }
      }
      return Response.redirect(`${frontendUrl}/merchant/dashboard?oauth_error=${error}`);
    }

    if (!code || !state) {
      throw new Error('Missing code or state parameter');
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Verify state token
    const { data: oauthState, error: stateError } = await supabase
      .from('oauth_states')
      .select('*')
      .eq('state_token', state)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (stateError || !oauthState) {
      throw new Error('Invalid or expired state token');
    }

    const provider = oauthState.provider;
    const userId = oauthState.user_id;
    const lightspeedMode = oauthState.metadata?.lightspeed_mode;
    const mobileRedirectUri = oauthState.metadata?.mobile_redirect_uri;

    // For Lightspeed eCom, use the ecwid token exchange
    const exchangeProvider = (provider === 'lightspeed' && lightspeedMode === 'ecom')
      ? 'lightspeed_ecom'
      : provider;

    // Get shop/domain name from callback params or metadata
    // Lightspeed sends domain_prefix, Shopify sends shop param
    // Ecwid sends store_id as a query param
    const ecwidStoreId = url.searchParams.get('store_id');
    const shopNameFromState = oauthState.metadata?.shop_name;
    const shopNameToUse = shop || domainPrefix || shopNameFromState;

    // Exchange code for tokens
    const redirectUri = `${Deno.env.get('SUPABASE_URL')}/functions/v1/pos-oauth-callback`;
    const tokenData = await exchangeCodeForToken(exchangeProvider, code, redirectUri, shopNameToUse || undefined);

    // Log token data for debugging (especially for Clover)
    if (provider.toLowerCase() === 'clover') {
      console.log('🔍 Clover token response:', JSON.stringify(tokenData, null, 2));
      console.log('🔍 merchant_id in token?:', tokenData.merchant_id);
    }

    // For Ecwid (Lightspeed eCom), store_id comes from callback URL or token response
    const resolvedEcwidStoreId = ecwidStoreId || tokenData.store_id?.toString();

    // Get merchant/location info
    const clientId = provider === 'square' ? Deno.env.get('SQUARE_OAUTH_CLIENT_ID') : undefined;
    const { merchantId, locationId, storeId, capabilities, locationStatus, businessName } = await getMerchantInfo(
      exchangeProvider, // use ecwid provider key for ecwid
      tokenData.access_token,
      clientId,
      shopNameToUse || undefined,
      cloverMerchantId || undefined // Pass Clover merchant_id from callback URL
    );

    // Build config object based on provider
    const config: any = {};

    if (provider.toLowerCase() === 'square') {
      const isSandbox = clientId?.includes('sandbox');
      config.environment = isSandbox ? 'sandbox' : 'production';
      config.capabilities = capabilities || [];
      config.location_status = locationStatus || '';
      config.business_name = businessName || '';
      config.can_accept_online_payments = capabilities?.includes('CREDIT_CARD_PROCESSING') || false;
      console.log(`💾 Saving Square integration:`);
      console.log(`   Environment: ${config.environment}`);
      console.log(`   Capabilities: ${config.capabilities.join(', ') || 'NONE'}`);
      console.log(`   Can accept online payments: ${config.can_accept_online_payments}`);
    }

    if (provider.toLowerCase() === 'clover') {
      const cloverEnv = Deno.env.get('CLOVER_ENVIRONMENT') || 'production';
      config.environment = cloverEnv;
      console.log(`💾 Saving Clover integration with environment: ${cloverEnv}`);
      console.log(`💾 merchant_id to save: ${merchantId || 'NULL'}`);
    }

    if (provider.toLowerCase() === 'lightspeed' && lightspeedMode === 'ecom') {
      config.lightspeed_mode = 'ecom';
      config.ecwid_store_id = resolvedEcwidStoreId;
      console.log(`💾 Saving Lightspeed eCom (Ecwid) integration`);
      console.log(`💾 ecwid_store_id: ${resolvedEcwidStoreId}`);
    }

    // Generate unique nonce for encryption
    const encryptionNonce = crypto.randomUUID();

    // Encrypt tokens before storing
    console.log('🔐 Encrypting OAuth tokens...');
    const { data: encryptedAccessToken } = await supabase
      .rpc('encrypt_pos_token', {
        p_token: tokenData.access_token,
        p_nonce: encryptionNonce
      });

    let encryptedRefreshToken = null;
    if (tokenData.refresh_token) {
      const { data: refreshToken } = await supabase
        .rpc('encrypt_pos_token', {
          p_token: tokenData.refresh_token,
          p_nonce: encryptionNonce
        });
      encryptedRefreshToken = refreshToken;
    }

    console.log('✅ Tokens encrypted successfully');

    // Deactivate previous integrations for this user and provider only
    console.log(`🔄 Deactivating previous ${provider} integrations...`);
    const { error: deactivateError } = await supabase
      .from('pos_integrations')
      .update({ status: 'inactive' })
      .eq('user_id', userId)
      .eq('provider', provider)
      .eq('status', 'active');

    if (deactivateError) {
      console.error(`⚠️ Warning: Failed to deactivate old ${provider} integrations:`, deactivateError);
      // Don't throw - continue with new integration
    } else {
      console.log(`✅ Previous ${provider} integrations deactivated`);
    }

    // Store integration in database with encrypted tokens
    // Parse scopes based on provider format
    let scopesArray: string[] = [];
    if (tokenData.scope) {
      // Shopify uses comma-separated scopes, others may use space-separated
      const delimiter = provider.toLowerCase() === 'shopify' ? ',' : ' ';
      scopesArray = tokenData.scope.split(delimiter).map(s => s.trim()).filter(s => s.length > 0);
    }

    const { error: integrationError } = await supabase
      .from('pos_integrations')
      .insert({
        user_id: userId,
        provider: provider,
        auth_method: 'oauth',
        encryption_nonce: encryptionNonce,
        access_token_encrypted: encryptedAccessToken,
        refresh_token_encrypted: encryptedRefreshToken,
        // Keep plaintext for backward compatibility during migration
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token || null,
        merchant_id: merchantId || null,
        store_id: resolvedEcwidStoreId || storeId || locationId || null, // Ecwid storeId takes priority
        status: 'active',
        scopes: scopesArray,
        token_expires_at: tokenData.expires_at || null,
        config: Object.keys(config).length > 0 ? config : null,
      });

    if (integrationError) {
      console.error('Error storing integration:', integrationError);
      throw new Error('Failed to store integration');
    }

    // Get the newly created integration ID
    const { data: newIntegration } = await supabase
      .from('pos_integrations')
      .select('id')
      .eq('user_id', userId)
      .eq('provider', provider)
      .eq('status', 'active')
      .single();

    // Create default merchant_pos_settings for all providers
    if (newIntegration?.id) {
      console.log(`🔧 Creating default merchant_pos_settings for ${provider}...`);
      const { error: settingsError } = await supabase
        .from('merchant_pos_settings')
        .upsert({
          merchant_id: userId,
          pos_integration_id: newIntegration.id,
          enable_pos_split_payment: true,
          enable_auto_discount: true,
          enable_barcode_scanning: true,
          default_barter_percentage: 25, // Default 25% barter
          max_barter_amount_per_transaction: 500, // Default $500 max
          daily_barter_limit: 2000, // Default $2000 daily limit
          notify_on_insufficient_credits: true,
          notify_on_payment_failure: true,
        }, {
          onConflict: 'merchant_id'
        });

      if (settingsError) {
        console.error('⚠️ Warning: Failed to create merchant_pos_settings:', settingsError);
        // Don't throw - integration is already saved
      } else {
        console.log(`✅ Merchant POS settings created for ${provider}`);
      }
    }

    // Update profile POS setup preference to 'completed'
    const { error: profileError } = await supabase
      .from('profiles')
      .update({ pos_setup_preference: 'completed' })
      .eq('user_id', userId);

    if (profileError) {
      console.error('Error updating profile POS preference:', profileError);
      // Don't throw error - integration is already saved
    }

    // Register webhooks for Square
    if (provider.toLowerCase() === 'square' && newIntegration?.id) {
      try {
        await registerSquareWebhooks(
          tokenData.access_token,
          config.environment || 'production',
          newIntegration.id
        );
      } catch (webhookError) {
        console.error('⚠️ Warning: Failed to register Square webhooks:', webhookError);
        // Don't fail the OAuth flow
      }
    }

    // Register webhooks for Shopify
    if (provider.toLowerCase() === 'shopify' && shop) {
      try {
        await registerShopifyWebhook(shop, tokenData.access_token);
        console.log(`✅ Shopify webhook registered for shop: ${shop}`);
      } catch (webhookError) {
        console.error('⚠️ Warning: Failed to register webhook:', webhookError);
        // Don't fail the entire OAuth flow if webhook registration fails
      }
    }

    // Register webhooks for Lightspeed X-Series
    if (provider.toLowerCase() === 'lightspeed' && lightspeedMode !== 'ecom' && storeId) {
      try {
        await registerLightspeedWebhook(storeId, tokenData.access_token);
        console.log(`✅ Lightspeed webhook registered for store: ${storeId}`);
      } catch (webhookError) {
        console.error('⚠️ Warning: Failed to register Lightspeed webhook:', webhookError);
        // Don't fail the entire OAuth flow if webhook registration fails
      }
    }

    // Register webhooks for Lightspeed eCom (Ecwid)
    if (provider.toLowerCase() === 'lightspeed' && lightspeedMode === 'ecom' && resolvedEcwidStoreId) {
      try {
        await registerEcwidWebhooks(resolvedEcwidStoreId, tokenData.access_token);
        console.log(`✅ Ecwid webhooks registered for store: ${resolvedEcwidStoreId}`);
      } catch (webhookError) {
        console.error('⚠️ Warning: Failed to register Ecwid webhooks:', webhookError);
        // Don't fail the entire OAuth flow if webhook registration fails
      }
    }

    // Delete used state token
    await supabase
      .from('oauth_states')
      .delete()
      .eq('state_token', state);

    console.log(`OAuth callback successful for ${provider}, user: ${userId}`);

    // Redirect back — mobile deep link takes priority over web URL
    const frontendUrl = Deno.env.get('FRONTEND_URL') || 'http://localhost:8080';

    let redirectUrl: string;
    if (mobileRedirectUri) {
      // Mobile app: redirect to deep link so the OS routes back into the app
      redirectUrl = `${mobileRedirectUri}?oauth_success=true&provider=${provider}`;
      if (provider.toLowerCase() === 'square' && !config.can_accept_online_payments) {
        redirectUrl += '&warning=online_payments_disabled';
      }
      console.log(`📱 Redirecting to mobile deep link: ${redirectUrl}`);
    } else {
      // Web app: redirect to merchant dashboard
      redirectUrl = `${frontendUrl}/merchant/dashboard?oauth_success=true&provider=${provider}`;
      if (provider.toLowerCase() === 'square' && !config.can_accept_online_payments) {
        redirectUrl += '&warning=online_payments_disabled';
        console.log(`⚠️ Redirecting with warning: Square account needs to enable online payments`);
      }
    }

    return Response.redirect(redirectUrl);

  } catch (error: any) {
    console.error('Error in pos-oauth-callback:', error);
    const frontendUrl = Deno.env.get('FRONTEND_URL') || 'http://localhost:8080';
    // Try to get mobile redirect URI from state if available
    try {
      const url = new URL(req.url);
      const state = url.searchParams.get('state');
      if (state) {
        const supabaseErr = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
        const { data: errState } = await supabaseErr.from('oauth_states').select('metadata').eq('state_token', state).single();
        if (errState?.metadata?.mobile_redirect_uri) {
          return Response.redirect(`${errState.metadata.mobile_redirect_uri}?oauth_error=${encodeURIComponent(error.message)}`);
        }
      }
    } catch (_) { /* ignore */ }
    return Response.redirect(`${frontendUrl}/merchant/dashboard?oauth_error=${encodeURIComponent(error.message)}`);
  }
});
