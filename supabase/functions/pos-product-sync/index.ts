import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Initialize Supabase client
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Import provider handlers
import { syncSquareProducts } from './providers/square.ts';
import { syncShopifyProducts } from './providers/shopify.ts';
import { syncCloverProducts } from './providers/clover.ts';
import { syncLightspeedProducts } from './providers/lightspeed.ts';
import { syncLightspeedEcomProducts } from './providers/lightspeed_ecom.ts';
import { syncToastProducts } from './providers/toast.ts';

// Import token refresh utility
import { refreshPOSToken, isTokenExpiredError } from './utils/token-refresh.ts';

/**
 * Product Sync Edge Function
 * Syncs products from POS systems to the products table
 *
 * Endpoint: POST /pos-product-sync
 * Body: { pos_integration_id: string }
 * Headers: Authorization: Bearer <user-token>
 */
serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authenticate user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('❌ Missing authorization header');
      return new Response(
        JSON.stringify({
          error: 'Missing authorization header',
          details: 'Authorization header is required'
        }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    console.log('🔐 Authenticating user...');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      console.error('❌ Authentication failed:', authError?.message);
      return new Response(
        JSON.stringify({
          error: 'Unauthorized',
          details: authError?.message || 'Invalid or expired token'
        }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('✅ User authenticated:', user.id);

    // Parse request body
    const body = await req.json();
    const { pos_integration_id } = body;

    console.log('📋 Request body:', JSON.stringify(body));

    if (!pos_integration_id) {
      console.error('❌ Missing pos_integration_id');
      return new Response(
        JSON.stringify({
          error: 'pos_integration_id is required',
          details: 'Request body must include pos_integration_id field'
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`📦 Product sync requested for integration: ${pos_integration_id} by user: ${user.id}`);

    // Get POS integration
    console.log('🔍 Looking up POS integration...');
    const { data: integration, error: integrationError } = await supabase
      .from('pos_integrations')
      .select('*')
      .eq('id', pos_integration_id)
      .eq('user_id', user.id)
      .eq('status', 'active')
      .single();

    if (integrationError || !integration) {
      console.error('❌ Integration not found:', integrationError);
      console.error('❌ Searched for: id=', pos_integration_id, 'user_id=', user.id, 'status=active');

      return new Response(
        JSON.stringify({
          error: 'POS integration not found or inactive',
          details: `Integration ${pos_integration_id} not found for user ${user.id} or not active`,
          db_error: integrationError?.message
        }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`✅ Integration found: ${integration.provider} (ID: ${integration.id})`);

    // Decrypt access token if encrypted
    if (integration.access_token_encrypted && integration.encryption_nonce) {
      console.log('🔓 Decrypting access token...');
      const { data: decryptedAccessToken, error: decryptError } = await supabase
        .rpc('decrypt_pos_token', {
          p_encrypted_token: integration.access_token_encrypted,
          p_nonce: integration.encryption_nonce
        });

      if (decryptError || !decryptedAccessToken) {
        console.error('❌ Failed to decrypt access token:', decryptError);
        return new Response(
          JSON.stringify({
            error: 'Token decryption failed',
            details: 'Unable to decrypt POS access token'
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      integration.access_token = decryptedAccessToken;

      // Decrypt refresh token if present
      if (integration.refresh_token_encrypted) {
        const { data: decryptedRefreshToken } = await supabase
          .rpc('decrypt_pos_token', {
            p_encrypted_token: integration.refresh_token_encrypted,
            p_nonce: integration.encryption_nonce
          });
        integration.refresh_token = decryptedRefreshToken;
      }

      console.log('✅ Tokens decrypted successfully');
    } else if (integration.access_token) {
      console.log('ℹ️  Using legacy plaintext token (migration in progress)');
    } else {
      console.error('❌ No access token found (neither encrypted nor plaintext)');
      return new Response(
        JSON.stringify({
          error: 'No access token available',
          details: 'POS integration has no valid access token'
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize sync progress tracking
    console.log('📊 Initializing sync progress tracking...');
    const { data: progressRecord, error: progressError } = await supabase
      .from('product_sync_progress')
      .insert({
        pos_integration_id: pos_integration_id,
        user_id: user.id,
        total_items: 0, // Will be updated when we know the count
        status: 'in_progress',
        current_step: 'Initializing sync...'
      })
      .select()
      .single();

    if (progressError) {
      console.error('Failed to create progress record:', progressError);
      // Don't fail sync if progress tracking fails
    }

    const progressId = progressRecord?.id;

    let result;

    // Route to appropriate provider handler with automatic token refresh
    try {
      switch (integration.provider.toLowerCase()) {
        case 'square':
          result = await syncSquareProducts(integration, user.id, supabase, progressId);
          break;
        case 'shopify':
          result = await syncShopifyProducts(integration, user.id, supabase, progressId);
          break;
        case 'clover':
          result = await syncCloverProducts(integration, user.id, supabase, progressId);
          break;
        case 'lightspeed':
          if (integration.config?.lightspeed_mode === 'ecom') {
            result = await syncLightspeedEcomProducts(integration, user.id, supabase, progressId);
          } else {
            result = await syncLightspeedProducts(integration, user.id, supabase, progressId);
          }
          break;
        case 'toast':
          result = await syncToastProducts(integration, user.id, supabase, progressId);
          break;
        default:
          return new Response(
            JSON.stringify({ error: `Product sync not implemented for provider: ${integration.provider}` }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
      }
    } catch (error: any) {
      // Check if error is due to token expiration
      if (isTokenExpiredError(error) && integration.refresh_token) {
        console.log('⚠️ Token expired during sync, attempting refresh and retry...');

        try {
          // Refresh the token
          const { accessToken } = await refreshPOSToken(integration, supabase);

          // Update integration object with new token
          integration.access_token = accessToken;

          // Retry the sync with new token
          console.log('🔄 Retrying sync with refreshed token...');
          switch (integration.provider.toLowerCase()) {
            case 'square':
              result = await syncSquareProducts(integration, user.id, supabase, progressId);
              break;
            case 'shopify':
              result = await syncShopifyProducts(integration, user.id, supabase, progressId);
              break;
            case 'clover':
              result = await syncCloverProducts(integration, user.id, supabase, progressId);
              break;
            case 'lightspeed':
              if (integration.config?.lightspeed_mode === 'ecom') {
                result = await syncLightspeedEcomProducts(integration, user.id, supabase, progressId);
              } else {
                result = await syncLightspeedProducts(integration, user.id, supabase, progressId);
              }
              break;
            case 'toast':
              result = await syncToastProducts(integration, user.id, supabase, progressId);
              break;
          }

          console.log('✅ Sync succeeded after token refresh');
        } catch (refreshError: any) {
          console.error('❌ Token refresh failed:', refreshError);
          throw new Error(`Token expired and refresh failed: ${refreshError.message}`);
        }
      } else {
        // Not a token expiration error, rethrow original error
        throw error;
      }
    }

    // Update last sync timestamp
    await supabase
      .from('pos_integrations')
      .update({ last_sync_at: new Date().toISOString() })
      .eq('id', pos_integration_id);

    // Mark sync progress as complete
    if (progressId) {
      await supabase
        .from('product_sync_progress')
        .update({
          status: result.success ? 'completed' : 'failed',
          completed_at: new Date().toISOString(),
          synced_items: result.synced || 0,
          skipped_items: result.skipped || 0,
          error_items: result.errors?.length || 0,
          error: result.success ? null : (result.error || 'Sync failed'),
          current_step: result.success ? 'Completed' : 'Failed'
        })
        .eq('id', progressId);

      console.log(`✅ Sync progress marked as ${result.success ? 'completed' : 'failed'}`);
    }

    return new Response(
      JSON.stringify(result),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error: any) {
    console.error('❌ Product sync error:', error);

    return new Response(
      JSON.stringify({
        error: error.message || 'Internal server error',
        details: error.stack
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
