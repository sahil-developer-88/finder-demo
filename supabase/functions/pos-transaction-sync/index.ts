import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { syncShopifyOrder } from "./providers/shopify.ts";
import { syncSquarePayment } from "./providers/square.ts";
import { syncCloverOrder } from "./providers/clover.ts";
import { syncToastCheck } from "./providers/toast.ts";
import { syncLightspeedSale } from "./providers/lightspeed.ts";
import { refreshPOSToken, isTokenExpiredError } from "./utils/token-refresh.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SyncRequest {
  transaction_id: string;
  merchant_id: string;
  pos_integration_id: string;
  items: Array<{
    product_id: string;
    external_product_id: string;
    external_variant_id?: string;
    name: string;
    price: number;
    quantity: number;
    sku?: string;
    barcode?: string;
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

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    // Get request body
    const requestData: SyncRequest = await req.json();

    console.log('POS Transaction Sync Request:', {
      transaction_id: requestData.transaction_id,
      merchant_id: requestData.merchant_id,
      pos_integration_id: requestData.pos_integration_id,
    });

    // Fetch POS integration details
    const { data: integration, error: integrationError } = await supabaseClient
      .from('pos_integrations')
      .select('*')
      .eq('id', requestData.pos_integration_id)
      .eq('user_id', requestData.merchant_id)
      .single();

    if (integrationError || !integration) {
      throw new Error('POS integration not found');
    }

    if (integration.status !== 'active') {
      throw new Error('POS integration is not active');
    }

    // Create service role client for token decryption
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Decrypt access token if encrypted
    if (integration.access_token_encrypted && integration.encryption_nonce) {
      console.log('🔓 Decrypting access token...');
      const { data: decryptedAccessToken, error: decryptError } = await supabaseAdmin
        .rpc('decrypt_pos_token', {
          p_encrypted_token: integration.access_token_encrypted,
          p_nonce: integration.encryption_nonce
        });

      if (decryptError || !decryptedAccessToken) {
        console.error('❌ Failed to decrypt access token:', decryptError);
        throw new Error('Token decryption failed');
      }

      integration.access_token = decryptedAccessToken;

      // Decrypt refresh token if present
      if (integration.refresh_token_encrypted) {
        const { data: decryptedRefreshToken } = await supabaseAdmin
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
      throw new Error('No access token available');
    }

    let posTransactionId: string | null = null;
    let syncResponse: any = null;

    // Route to appropriate provider with automatic token refresh
    try {
      switch (integration.provider) {
        case 'shopify':
          syncResponse = await syncShopifyOrder(integration, requestData);
          posTransactionId = syncResponse.order_id;
          break;

        case 'square':
          syncResponse = await syncSquarePayment(integration, requestData);
          posTransactionId = syncResponse.payment_id;
          break;

        case 'clover':
          syncResponse = await syncCloverOrder(integration, requestData);
          posTransactionId = syncResponse.order_id;
          break;

        case 'toast':
          syncResponse = await syncToastCheck(integration, requestData);
          posTransactionId = syncResponse.check_guid;
          break;

        case 'lightspeed':
          syncResponse = await syncLightspeedSale(integration, requestData);
          posTransactionId = syncResponse.sale_id;
          break;

        default:
          throw new Error(`POS provider ${integration.provider} not supported for transaction sync`);
      }
    } catch (error: any) {
      // Check if error is due to token expiration
      if (isTokenExpiredError(error) && integration.refresh_token) {
        console.log('⚠️ Token expired during transaction sync, attempting refresh and retry...');

        try {
          // Refresh the token
          const { accessToken } = await refreshPOSToken(integration, supabaseAdmin);

          // Update integration object with new token
          integration.access_token = accessToken;

          // Retry the sync with new token
          console.log('🔄 Retrying transaction sync with refreshed token...');
          switch (integration.provider) {
            case 'shopify':
              syncResponse = await syncShopifyOrder(integration, requestData);
              posTransactionId = syncResponse.order_id;
              break;

            case 'square':
              syncResponse = await syncSquarePayment(integration, requestData);
              posTransactionId = syncResponse.payment_id;
              break;

            case 'clover':
              syncResponse = await syncCloverOrder(integration, requestData);
              posTransactionId = syncResponse.order_id;
              break;

            case 'toast':
              syncResponse = await syncToastCheck(integration, requestData);
              posTransactionId = syncResponse.check_guid;
              break;

            case 'lightspeed':
              syncResponse = await syncLightspeedSale(integration, requestData);
              posTransactionId = syncResponse.sale_id;
              break;
          }

          console.log('✅ Transaction sync succeeded after token refresh');
        } catch (refreshError: any) {
          console.error('❌ Token refresh failed:', refreshError);
          throw new Error(`Token expired and refresh failed: ${refreshError.message}`);
        }
      } else {
        // Not a token expiration error, rethrow original error
        throw error;
      }
    }

    // Update transaction record with external ID
    const { error: updateError } = await supabaseClient
      .from('pos_transactions')
      .update({
        external_transaction_id: posTransactionId,
        pos_integration_id: integration.id,
        synced_at: new Date().toISOString(),
      })
      .eq('id', requestData.transaction_id);

    if (updateError) {
      console.error('Error updating transaction:', updateError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        pos_transaction_id: posTransactionId,
        provider: integration.provider,
        details: syncResponse,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error: any) {
    console.error('POS Transaction Sync Error:', error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Failed to sync transaction to POS',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
