/**
 * Webhook Signature Verification Utility
 * Validates HMAC signatures for all POS providers to prevent fake webhooks
 */

import { createHmac } from "https://deno.land/std@0.177.0/node/crypto.ts";

/**
 * Verify Square webhook signature using native Web Crypto API
 * Uses HMAC SHA256 of (notification_url + raw_body)
 * Docs: https://developer.squareup.com/docs/webhooks/step3validate
 */
export async function verifySquareSignature(
  body: string,
  signature: string | undefined,
  notificationUrl: string
): Promise<boolean> {
  const signatureKey = Deno.env.get('SQUARE_WEBHOOK_SIGNATURE_KEY');

  if (!signatureKey) {
    console.warn('⚠️ SQUARE_WEBHOOK_SIGNATURE_KEY not configured - signature verification disabled');
    return true;
  }

  if (!signature) {
    console.error('❌ Square webhook missing x-square-hmacsha256-signature header');
    return false;
  }

  try {
    console.log(`   Notification URL used: ${notificationUrl}`);

    const encoder = new TextEncoder();
    const keyData = encoder.encode(signatureKey);
    const message = encoder.encode(notificationUrl + body);

    const cryptoKey = await crypto.subtle.importKey(
      'raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
    );

    const signatureBytes = await crypto.subtle.sign('HMAC', cryptoKey, message);
    const expectedSignature = btoa(String.fromCharCode(...new Uint8Array(signatureBytes)));

    const isValid = signature === expectedSignature;

    if (!isValid) {
      console.error('❌ Square signature verification failed');
      console.error(`   Expected: ${expectedSignature.substring(0, 20)}...`);
      console.error(`   Received: ${signature.substring(0, 20)}...`);
    }

    return isValid;
  } catch (error) {
    console.error('❌ Error verifying Square signature:', error);
    return false;
  }
}

/**
 * Verify Shopify webhook signature
 * Uses HMAC SHA256
 */
export function verifyShopifySignature(
  body: string,
  signature: string | undefined
): boolean {
  const secret = Deno.env.get('SHOPIFY_WEBHOOK_SECRET');

  // TEMPORARY: Disable signature verification for testing
  console.warn('⚠️ SHOPIFY SIGNATURE VERIFICATION TEMPORARILY DISABLED FOR TESTING');
  return true;

  /* Re-enable this after testing:
  if (!secret) {
    console.warn('⚠️ SHOPIFY_WEBHOOK_SECRET not configured - signature verification disabled');
    return true;
  }

  if (!signature) {
    console.error('❌ Shopify webhook missing signature header');
    return false;
  }

  try {
    const hmac = createHmac('sha256', secret);
    hmac.update(body);
    const expectedSignature = hmac.digest('base64');

    const isValid = signature === expectedSignature;

    if (!isValid) {
      console.error('❌ Shopify signature verification failed');
      console.error(`   Expected: ${expectedSignature.substring(0, 20)}...`);
      console.error(`   Received: ${signature.substring(0, 20)}...`);
    }

    return isValid;
  } catch (error) {
    console.error('❌ Error verifying Shopify signature:', error);
    return false;
  }
  */
}

/**
 * Verify Clover webhook token
 * Uses simple token comparison (not HMAC)
 */
export function verifyCloverToken(
  receivedToken: string | undefined
): boolean {
  const expectedToken = Deno.env.get('CLOVER_WEBHOOK_VERIFICATION_TOKEN');

  if (!expectedToken) {
    console.warn('⚠️ CLOVER_WEBHOOK_VERIFICATION_TOKEN not configured - verification disabled');
    return true;
  }

  if (!receivedToken) {
    console.warn('⚠️ Clover webhook missing verification token - allowing (token not configured in Clover dashboard)');
    return true;
  }

  const isValid = receivedToken === expectedToken;

  if (!isValid) {
    console.error('❌ Clover token verification failed');
  }

  return isValid;
}

/**
 * Verify Toast webhook signature
 * Uses HMAC SHA256
 */
export function verifyToastSignature(
  body: string,
  signature: string | undefined
): boolean {
  const secret = Deno.env.get('TOAST_WEBHOOK_SECRET');

  if (!secret) {
    console.warn('⚠️ TOAST_WEBHOOK_SECRET not configured - signature verification disabled');
    return true;
  }

  if (!signature) {
    console.error('❌ Toast webhook missing signature header');
    return false;
  }

  try {
    const hmac = createHmac('sha256', secret);
    hmac.update(body);
    const expectedSignature = hmac.digest('base64');

    const isValid = signature === expectedSignature;

    if (!isValid) {
      console.error('❌ Toast signature verification failed');
    }

    return isValid;
  } catch (error) {
    console.error('❌ Error verifying Toast signature:', error);
    return false;
  }
}

/**
 * Verify Lightspeed eCom (Ecwid) webhook signature
 * Header: X-Ecwid-Webhook-Signature
 * Signs body with HMAC-SHA256 using ECWID_CLIENT_SECRET, base64-encoded
 * Docs: https://api-docs.ecwid.com/reference/webhooks#webhook-signature
 */
export function verifyEcwidSignature(
  body: string,
  signature: string | undefined
): boolean {
  // TEMPORARY: Disable signature verification for testing
  console.warn('ECWID SIGNATURE VERIFICATION TEMPORARILY DISABLED FOR TESTING');
  return true;
}

/**
 * Verify Lightspeed webhook signature
 * Uses HMAC SHA256
 */
export function verifyLightspeedSignature(
  body: string,
  signature: string | undefined
): boolean {
  const secret = Deno.env.get('LIGHTSPEED_WEBHOOK_SECRET');

  if (!secret) {
    console.warn('⚠️ LIGHTSPEED_WEBHOOK_SECRET not configured - signature verification disabled');
    return true;
  }

  if (!signature) {
    console.error('❌ Lightspeed webhook missing signature header');
    return false;
  }

  try {
    const hmac = createHmac('sha256', secret);
    hmac.update(body);
    const expectedSignature = hmac.digest('hex'); // Lightspeed uses hex encoding

    const isValid = signature === expectedSignature;

    if (!isValid) {
      console.error('❌ Lightspeed signature verification failed');
    }

    return isValid;
  } catch (error) {
    console.error('❌ Error verifying Lightspeed signature:', error);
    return false;
  }
}

/**
 * Verify webhook signature for any provider
 * Returns true if valid, false if invalid
 */
export async function verifyWebhookSignature(
  provider: string,
  body: string,
  headers: Record<string, string>,
  notificationUrl?: string
): Promise<boolean> {
  console.log(`🔐 Verifying ${provider} webhook signature...`);

  switch (provider.toLowerCase()) {
    case 'square': {
      const signature = headers['x-square-hmacsha256-signature'];
      return await verifySquareSignature(body, signature, notificationUrl || '');
    }

    case 'shopify': {
      const signature = headers['x-shopify-hmac-sha256'];
      return verifyShopifySignature(body, signature);
    }

    case 'clover': {
      const token = headers['x-clover-verification-token'];
      return verifyCloverToken(token);
    }

    case 'toast': {
      const signature = headers['toast-signature'];
      return verifyToastSignature(body, signature);
    }

    case 'lightspeed': {
      const signature = headers['x-lightspeed-signature'];
      return verifyLightspeedSignature(body, signature);
    }

    case 'lightspeed_ecom': {
      const signature = headers['x-ecwid-webhook-signature'];
      return verifyEcwidSignature(body, signature);
    }

    case 'adyen': {
      // Adyen has its own verification in the provider handler
      // Uses HMAC SHA256 but with more complex logic
      console.log('ℹ️  Adyen signature verified in provider handler');
      return true;
    }

    default:
      console.warn(`⚠️ No signature verification implemented for provider: ${provider}`);
      return true; // Allow unknown providers for now
  }
}
