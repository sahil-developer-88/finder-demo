import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface OAuthConfig {
  authUrl: string;
  clientId: string;
  redirectUri: string;
  scopes: string[];
}

const getOAuthConfig = (provider: string): OAuthConfig | null => {
  const baseRedirectUri = `${Deno.env.get('SUPABASE_URL')}/functions/v1/pos-oauth-callback`;
  
  switch (provider.toLowerCase()) {
    case 'square':
      const squareClientId = Deno.env.get('SQUARE_OAUTH_CLIENT_ID') || '';
      console.log(`Square Client ID: ${squareClientId}`);
      console.log(`Contains sandbox: ${squareClientId.includes('sandbox')}`);
      // Use sandbox URL if client ID contains 'sandbox'
      const squareAuthUrl = squareClientId.includes('sandbox')
        ? 'https://connect.squareupsandbox.com/oauth2/authorize'
        : 'https://connect.squareup.com/oauth2/authorize';
      console.log(`Square Auth URL: ${squareAuthUrl}`);
      return {
        authUrl: squareAuthUrl,
        clientId: squareClientId,
        redirectUri: baseRedirectUri,
        scopes: [
          'MERCHANT_PROFILE_READ',
          'PAYMENTS_WRITE',
          'PAYMENTS_READ',
          'ORDERS_READ',
          'ORDERS_WRITE',
          'ITEMS_READ',
          'ITEMS_WRITE',
          'INVENTORY_READ',
          'INVENTORY_WRITE',
        ]
      };
    
    case 'shopify':
      return {
        authUrl: 'https://SHOP_NAME.myshopify.com/admin/oauth/authorize',
        clientId: Deno.env.get('SHOPIFY_CLIENT_ID') || '',
        redirectUri: baseRedirectUri,
        scopes: [
          'read_orders',
          'write_orders',
          'read_products',
          'write_products',
          'write_draft_orders',    // Create/modify draft orders for split payment
          'read_draft_orders',     // Read draft orders
          'write_price_rules',     // Create automatic discounts
          'read_price_rules',      // Read discount rules
          'write_discounts',       // Apply discount codes
          'read_discounts',        // Read discounts
          'read_customers'         // Lookup customer by phone/email
        ]
      };
    
    case 'clover': {
      // Clover LEGACY OAuth v1 - use environment-specific URL
      // Using legacy OAuth to get merchant access tokens (UUID format)
      // IMPORTANT: Must pass scopes in URL for merchant to see permission request
      // Scope names: https://docs.clover.com/docs/permissions
      const cloverEnv = Deno.env.get('CLOVER_ENVIRONMENT') || 'production';
      const cloverAuthUrl = cloverEnv === 'sandbox'
        ? 'https://sandbox.dev.clover.com/oauth/authorize'
        : 'https://www.clover.com/oauth/authorize';
      return {
        authUrl: cloverAuthUrl,
        clientId: Deno.env.get('CLOVER_OAUTH_CLIENT_ID') || '',
        redirectUri: baseRedirectUri,
        scopes: [
          'MERCHANT_READ',
          'INVENTORY_READ',
          'INVENTORY_WRITE',
          'ITEMS_READ',
          'ORDERS_READ',
          'ORDERS_WRITE',
          'PAYMENTS_READ',
          'PAYMENTS_WRITE'
        ]
      };
    }

    case 'toast':
      return {
        authUrl: 'https://www.toasttab.com/api/1.0/login/oauth/authorize',
        clientId: Deno.env.get('TOAST_CLIENT_ID') || '',
        redirectUri: baseRedirectUri,
        scopes: [
          'orders.read',
          'orders.write',
          'menus.read',
          'payments.read',
          'restaurant.read',
        ]
      };

    case 'lightspeed':
      return {
        authUrl: 'https://secure.retail.lightspeed.app/connect',
        clientId: Deno.env.get('LIGHTSPEED_OAUTH_CLIENT_ID') || '',
        redirectUri: baseRedirectUri,
        scopes: ['products:read', 'inventory:read']  // X-Series scopes
      };

    case 'lightspeed_ecom':
      return {
        authUrl: 'https://my.ecwid.com/api/oauth/authorize',
        clientId: Deno.env.get('ECWID_CLIENT_ID') || '',
        redirectUri: baseRedirectUri,
        scopes: [
          'read_store_profile',
          'read_catalog',
          'update_catalog',
          'create_catalog',
          'read_orders',
          'create_orders',
          'update_orders'
        ]
      };

    default:
      return null;
  }
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    const { provider, shopName, lightspeedMode, platform, targetUserId, callbackRedirect } = await req.json();

    if (!provider) {
      throw new Error('Provider is required');
    }

    // For Lightspeed eCom, use the ecwid OAuth config
    const oauthProvider = (provider.toLowerCase() === 'lightspeed' && lightspeedMode === 'ecom')
      ? 'lightspeed_ecom'
      : provider;

    const oauthConfig = getOAuthConfig(oauthProvider);
    if (!oauthConfig || !oauthConfig.clientId) {
      throw new Error(`OAuth not configured for provider: ${oauthProvider}`);
    }

    // Generate random state token for CSRF protection
    const stateToken = crypto.randomUUID();

    // Store state in database with shop name for providers that need it
    const metadata: Record<string, any> = {};
    if (shopName) {
      metadata.shop_name = shopName;
    }
    if (lightspeedMode) {
      metadata.lightspeed_mode = lightspeedMode;
    }
    if (platform === 'mobile') {
      metadata.mobile_redirect_uri = 'valueexchange://oauth-callback';
    }
    if (callbackRedirect) {
      metadata.callback_redirect = callbackRedirect;
    }

    // Admin connecting on behalf of a merchant → save under merchant's user_id
    const integrationUserId = targetUserId || user.id;

    // When targetUserId differs from auth user (admin flow), use service role to bypass RLS
    const insertClient = targetUserId && targetUserId !== user.id
      ? createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '')
      : supabase;

    const { error: stateError } = await insertClient
      .from('oauth_states')
      .insert({
        user_id: integrationUserId,
        state_token: stateToken,
        provider: provider.toLowerCase(), // always store as 'lightspeed', mode is in metadata
        metadata: metadata,
      });

    if (stateError) {
      console.error('Error storing OAuth state:', stateError);
      throw new Error('Failed to initiate OAuth flow');
    }

    // Build authorization URL
    // Clover uses comma-separated scopes, others use space-separated
    const scopeSeparator = provider.toLowerCase() === 'clover' ? ',' : ' ';
    const params = new URLSearchParams({
      client_id: oauthConfig.clientId,
      redirect_uri: oauthConfig.redirectUri,
      state: stateToken,
      response_type: 'code',
    });

    // Only add scope if there are scopes defined
    if (oauthConfig.scopes.length > 0) {
      params.set('scope', oauthConfig.scopes.join(scopeSeparator));
    }

    // For Shopify, replace SHOP_NAME in URL
    let authUrl = oauthConfig.authUrl;
    if (provider.toLowerCase() === 'shopify' && shopName) {
      authUrl = authUrl.replace('SHOP_NAME', shopName);
    }

    const authorizationUrl = `${authUrl}?${params.toString()}`;

    console.log(`OAuth flow initiated for ${provider}, user: ${user.id}`);
    console.log(`Authorization URL: ${authorizationUrl}`);
    console.log(`Auth URL base: ${authUrl}`);
    console.log(`Client ID: ${oauthConfig.clientId}`);
    console.log(`Redirect URI: ${oauthConfig.redirectUri}`);
    console.log(`Scopes: ${oauthConfig.scopes.join(scopeSeparator)}`);

    return new Response(
      JSON.stringify({
        authorizationUrl,
        state: stateToken
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error: any) {
    console.error('Error in pos-oauth-initiate:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
