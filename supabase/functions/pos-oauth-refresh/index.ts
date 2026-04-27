import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const refreshToken = async (provider: string, refreshToken: string) => {
  let tokenUrl = '';
  let clientId = '';
  let clientSecret = '';

  switch (provider.toLowerCase()) {
    case 'square':
      tokenUrl = 'https://connect.squareup.com/oauth2/token';
      clientId = Deno.env.get('SQUARE_OAUTH_CLIENT_ID') || '';
      clientSecret = Deno.env.get('SQUARE_OAUTH_CLIENT_SECRET') || '';
      break;

    case 'shopify':
      // Shopify tokens don't expire, so no refresh needed
      throw new Error('Shopify tokens do not require refresh');

    case 'clover':
      tokenUrl = 'https://www.clover.com/oauth/token';
      clientId = Deno.env.get('CLOVER_OAUTH_CLIENT_ID') || '';
      clientSecret = Deno.env.get('CLOVER_OAUTH_CLIENT_SECRET') || '';
      break;

    case 'lightspeed':
      tokenUrl = 'https://cloud.lightspeedapp.com/auth/oauth/token';
      clientId = Deno.env.get('LIGHTSPEED_OAUTH_CLIENT_ID') || '';
      clientSecret = Deno.env.get('LIGHTSPEED_OAUTH_CLIENT_SECRET') || '';
      break;

    default:
      throw new Error(`Unsupported provider: ${provider}`);
  }

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`Token refresh failed for ${provider}:`, errorText);
    throw new Error(`Failed to refresh token: ${response.statusText}`);
  }

  return await response.json();
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

    const { integrationId } = await req.json();

    if (!integrationId) {
      throw new Error('Integration ID is required');
    }

    // Get integration
    const { data: integration, error: integrationError } = await supabase
      .from('pos_integrations')
      .select('*')
      .eq('id', integrationId)
      .eq('user_id', user.id)
      .single();

    if (integrationError || !integration) {
      throw new Error('Integration not found');
    }

    if (!integration.refresh_token) {
      throw new Error('No refresh token available');
    }

    // Refresh the token
    const tokenData = await refreshToken(integration.provider, integration.refresh_token);

    // Update integration with new tokens
    const { error: updateError } = await supabase
      .from('pos_integrations')
      .update({
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token || integration.refresh_token,
        token_expires_at: tokenData.expires_at || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', integrationId);

    if (updateError) {
      console.error('Error updating integration:', updateError);
      throw new Error('Failed to update integration');
    }

    console.log(`Token refreshed successfully for integration: ${integrationId}`);

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Token refreshed successfully' 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error: any) {
    console.error('Error in pos-oauth-refresh:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
