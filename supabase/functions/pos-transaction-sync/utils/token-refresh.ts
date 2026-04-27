/**
 * Token Refresh Utility
 * Handles automatic refresh of expired OAuth tokens for POS integrations
 */

interface RefreshTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_at?: string;
  expires_in?: number;
}

/**
 * Refresh OAuth token for a POS integration
 * Supports: Square, Lightspeed, Clover
 */
export async function refreshPOSToken(
  integration: any,
  supabase: any
): Promise<{ accessToken: string; refreshToken?: string; expiresAt?: string }> {
  const provider = integration.provider.toLowerCase();
  console.log(`🔄 Refreshing ${provider} token for integration ${integration.id}...`);

  if (!integration.refresh_token) {
    throw new Error(`No refresh token available for ${provider} integration`);
  }

  let tokenUrl = '';
  let clientId = '';
  let clientSecret = '';
  let requestBody: any = {};
  let isFormEncoded = false;

  switch (provider) {
    case 'square': {
      clientId = Deno.env.get('SQUARE_OAUTH_CLIENT_ID') || '';
      clientSecret = Deno.env.get('SQUARE_OAUTH_CLIENT_SECRET') || '';

      // Use sandbox URL if client ID contains 'sandbox'
      tokenUrl = clientId.includes('sandbox')
        ? 'https://connect.squareupsandbox.com/oauth2/token'
        : 'https://connect.squareup.com/oauth2/token';

      requestBody = {
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'refresh_token',
        refresh_token: integration.refresh_token,
      };
      break;
    }

    case 'lightspeed': {
      if (!integration.store_id) {
        throw new Error('Lightspeed store_id required for token refresh');
      }

      clientId = Deno.env.get('LIGHTSPEED_OAUTH_CLIENT_ID') || '';
      clientSecret = Deno.env.get('LIGHTSPEED_OAUTH_CLIENT_SECRET') || '';
      tokenUrl = `https://${integration.store_id}.retail.lightspeed.app/api/1.0/token`;

      // Lightspeed uses form-urlencoded
      const params = new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: integration.refresh_token,
        client_id: clientId,
        client_secret: clientSecret,
      });
      requestBody = params.toString();
      isFormEncoded = true;
      break;
    }

    case 'clover': {
      clientId = Deno.env.get('CLOVER_OAUTH_CLIENT_ID') || '';
      clientSecret = Deno.env.get('CLOVER_OAUTH_CLIENT_SECRET') || '';

      // Check environment from integration config
      const cloverEnv = integration.config?.environment || 'production';
      tokenUrl = cloverEnv === 'sandbox'
        ? 'https://sandbox.dev.clover.com/oauth/token'
        : 'https://www.clover.com/oauth/token';

      requestBody = {
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'refresh_token',
        refresh_token: integration.refresh_token,
      };
      break;
    }

    case 'shopify':
      throw new Error('Shopify tokens do not expire and cannot be refreshed');

    case 'toast':
      throw new Error('Toast does not support refresh tokens');

    default:
      throw new Error(`Token refresh not supported for provider: ${provider}`);
  }

  // Make refresh token request
  const headers: Record<string, string> = isFormEncoded
    ? { 'Content-Type': 'application/x-www-form-urlencoded' }
    : { 'Content-Type': 'application/json' };

  const body = isFormEncoded ? requestBody : JSON.stringify(requestBody);

  console.log(`📡 Requesting token refresh from ${tokenUrl}...`);

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers,
    body,
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`❌ Token refresh failed for ${provider}`);
    console.error(`   Status: ${response.status} ${response.statusText}`);
    console.error(`   Response: ${errorText}`);
    throw new Error(`Token refresh failed: ${response.statusText} - ${errorText}`);
  }

  const tokenData: RefreshTokenResponse = await response.json();
  console.log(`✅ Token refreshed successfully for ${provider}`);

  // Calculate expiration timestamp
  let expiresAt: string | undefined;
  if (tokenData.expires_in) {
    const expiresDate = new Date();
    expiresDate.setSeconds(expiresDate.getSeconds() + tokenData.expires_in);
    expiresAt = expiresDate.toISOString();
  } else if (tokenData.expires_at) {
    expiresAt = tokenData.expires_at;
  }

  // Generate new encryption nonce
  const encryptionNonce = crypto.randomUUID();

  // Encrypt new tokens
  console.log('🔐 Encrypting refreshed tokens...');
  const { data: encryptedAccessToken } = await supabase
    .rpc('encrypt_pos_token', {
      p_token: tokenData.access_token,
      p_nonce: encryptionNonce,
    });

  let encryptedRefreshToken = null;
  if (tokenData.refresh_token) {
    const { data: refreshToken } = await supabase
      .rpc('encrypt_pos_token', {
        p_token: tokenData.refresh_token,
        p_nonce: encryptionNonce,
      });
    encryptedRefreshToken = refreshToken;
  }

  // Update database with new encrypted tokens
  console.log('💾 Updating integration with refreshed tokens...');
  const { error: updateError } = await supabase
    .from('pos_integrations')
    .update({
      encryption_nonce: encryptionNonce,
      access_token_encrypted: encryptedAccessToken,
      refresh_token_encrypted: encryptedRefreshToken || integration.refresh_token_encrypted,
      // Update plaintext for backward compatibility during migration
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token || integration.refresh_token,
      token_expires_at: expiresAt || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', integration.id);

  if (updateError) {
    console.error('❌ Failed to update tokens in database:', updateError);
    throw new Error('Failed to save refreshed tokens');
  }

  console.log('✅ Tokens updated in database successfully');

  return {
    accessToken: tokenData.access_token,
    refreshToken: tokenData.refresh_token,
    expiresAt,
  };
}

/**
 * Check if an error indicates token expiration
 */
export function isTokenExpiredError(error: any): boolean {
  const errorMessage = error.message?.toLowerCase() || '';
  const errorStatus = error.status || error.statusCode;

  return (
    errorStatus === 401 ||
    errorMessage.includes('unauthorized') ||
    errorMessage.includes('token expired') ||
    errorMessage.includes('invalid token') ||
    errorMessage.includes('authentication failed')
  );
}

/**
 * Execute a POS API call with automatic token refresh on expiration
 */
export async function executeWithTokenRefresh<T>(
  integration: any,
  supabase: any,
  apiCall: (accessToken: string) => Promise<T>
): Promise<T> {
  try {
    // First attempt with current token
    return await apiCall(integration.access_token);
  } catch (error: any) {
    // Check if error is due to token expiration
    if (isTokenExpiredError(error) && integration.refresh_token) {
      console.log('⚠️ Token expired, attempting refresh...');

      // Refresh the token
      const { accessToken } = await refreshPOSToken(integration, supabase);

      // Update integration object with new token
      integration.access_token = accessToken;

      // Retry the API call with new token
      console.log('🔄 Retrying API call with refreshed token...');
      return await apiCall(accessToken);
    }

    // If not a token expiration error or no refresh token available, rethrow
    throw error;
  }
}
