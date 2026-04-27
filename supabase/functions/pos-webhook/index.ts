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
import { handleSquareWebhook } from './providers/square.ts';
import { handleShopifyWebhook } from './providers/shopify.ts';
import { handleAdyenWebhook } from './providers/adyen.ts';
import { handleCloverWebhook } from './providers/clover.ts';
import { handleToastWebhook } from './providers/toast.ts';
import { handleLightspeedWebhook } from './providers/lightspeed.ts';
import { handleLightspeedEcomWebhook } from './providers/lightspeed_ecom.ts';

// Import signature verification
import { verifyWebhookSignature } from './utils/signature-verification.ts';

/**
 * Main webhook endpoint that routes to provider-specific handlers
 * Supports: Square, Shopify, Adyen, Clover, Toast, Lightspeed
 */
serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const provider = url.searchParams.get('provider');

    if (!provider) {
      return new Response(
        JSON.stringify({ error: 'Provider parameter is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`📥 Webhook received for provider: ${provider}`);

    // Get raw body and headers for signature verification
    const body = await req.text();
    const headers = Object.fromEntries(req.headers.entries());

    let payload: any;
    try {
      payload = JSON.parse(body);
    } catch (e) {
      payload = body;
    }

    // Verify webhook signature BEFORE processing
    // Use SUPABASE_URL to construct the exact registered notification URL
    // (req.url is internal localhost which won't match what Square signed against)
    const notificationUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/pos-webhook?provider=${provider}`;
    const isSignatureValid = await verifyWebhookSignature(provider, body, headers, notificationUrl);

    if (!isSignatureValid) {
      console.error(`❌ Invalid signature for ${provider} webhook - REJECTING`);

      // Log failed verification for security audit
      await logWebhook(
        provider,
        req.url,
        payload,
        headers['x-signature'] || headers['signature'] || headers['x-shopify-hmac-sha256'] || headers['toast-signature'],
        'failed_verification'
      );

      return new Response(
        JSON.stringify({
          error: 'Invalid webhook signature',
          message: 'Webhook signature verification failed'
        }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`✅ ${provider} webhook signature verified`);

    // Log webhook for debugging
    await logWebhook(provider, req.url, payload, headers['x-signature'] || headers['signature'], 'success');

    let result;

    // Route to appropriate provider handler
    switch (provider.toLowerCase()) {
      case 'square':
        result = await handleSquareWebhook(payload, headers, supabase);
        break;
      case 'shopify':
        result = await handleShopifyWebhook(payload, headers, supabase);
        break;
      case 'adyen':
        result = await handleAdyenWebhook(payload, headers, supabase);
        break;
      case 'clover':
        result = await handleCloverWebhook(payload, headers, supabase);
        break;
      case 'toast':
        result = await handleToastWebhook(payload, headers, supabase);
        break;
      case 'lightspeed':
        result = await handleLightspeedWebhook(payload, headers, supabase);
        break;
      case 'lightspeed_ecom':
        result = await handleLightspeedEcomWebhook(payload, headers, supabase);
        break;
      default:
        return new Response(
          JSON.stringify({ error: `Unsupported provider: ${provider}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    return new Response(
      JSON.stringify(result),
      { 
        status: result.success ? 200 : 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error: any) {
    console.error('❌ Webhook error:', error);
    
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error', 
        message: error.message 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

/**
 * Log webhook for debugging and auditing
 */
async function logWebhook(
  provider: string,
  endpoint: string,
  payload: any,
  signature?: string,
  status: string = 'success'
) {
  try {
    await supabase.from('webhook_logs').insert({
      provider,
      endpoint,
      payload,
      signature,
      status
    });
  } catch (error) {
    console.error('Failed to log webhook:', error);
  }
}
