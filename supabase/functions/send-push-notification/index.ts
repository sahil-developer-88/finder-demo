import { serve } from 'https://deno.land/std@0.190.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Build a signed JWT for Google service account OAuth2
async function getAccessToken(clientEmail: string, privateKeyPem: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000);

  const header  = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss:   clientEmail,
    sub:   clientEmail,
    aud:   'https://oauth2.googleapis.com/token',
    iat:   now,
    exp:   now + 3600,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
  };

  const encode = (obj: object) =>
    btoa(JSON.stringify(obj)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

  const headerB64  = encode(header);
  const payloadB64 = encode(payload);
  const unsigned   = `${headerB64}.${payloadB64}`;

  // Import private key
  const pemBody = privateKeyPem
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\n/g, '');
  const binaryKey = Uint8Array.from(atob(pemBody), c => c.charCodeAt(0));

  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8', binaryKey.buffer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false, ['sign']
  );

  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    new TextEncoder().encode(unsigned)
  );

  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

  const jwt = `${unsigned}.${sigB64}`;

  // Exchange JWT for access token
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion:  jwt,
    }),
  });

  const data = await res.json();
  if (!data.access_token) throw new Error(`OAuth2 error: ${JSON.stringify(data)}`);
  return data.access_token;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const payload = await req.json();

    // Support both direct calls { recipient_id, title, body }
    // and Supabase database webhook payloads { type, table, record }
    let recipient_id: string;
    let title: string;
    let body: string;

    if (payload.type && payload.record) {
      // Database webhook format
      const record = payload.record;
      if (payload.table === 'messages') {
        recipient_id = record.recipient_id;
        title = 'New message';
        body  = record.content?.slice(0, 100) || 'You have a new message';
      } else if (payload.table === 'trade_requests') {
        recipient_id = record.merchant_id;
        title = 'New trade request';
        body  = 'Someone sent you a trade request';
      } else {
        return new Response(JSON.stringify({ skipped: true, reason: 'unhandled_table' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    } else {
      // Direct call format
      recipient_id = payload.recipient_id;
      title        = payload.title;
      body         = payload.body;
    }

    if (!recipient_id || !title) throw new Error('recipient_id and title are required');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Look up recipient's FCM token
    const { data: profile } = await supabase
      .from('profiles')
      .select('fcm_token')
      .eq('user_id', recipient_id)
      .single();

    if (!profile?.fcm_token) {
      return new Response(JSON.stringify({ skipped: true, reason: 'no_token' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = profile.fcm_token;

    // Expo push token (mobile app via expo-notifications)
    if (token.startsWith('ExponentPushToken') || token.startsWith('ExpoPushToken')) {
      const expoRes = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          'Accept':       'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to:    token,
          title,
          body:  body || '',
          sound: 'default',
          data:  { type: payload.table || 'notification' },
        }),
      });
      const expoData = await expoRes.json();
      if (expoData.data?.status === 'error') {
        throw new Error(`Expo push error: ${expoData.data.message}`);
      }
      return new Response(JSON.stringify({ ok: true, provider: 'expo' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // FCM token (web app via Firebase)
    const projectId   = Deno.env.get('FIREBASE_PROJECT_ID')!;
    const clientEmail = Deno.env.get('FIREBASE_CLIENT_EMAIL')!;
    const privateKey  = Deno.env.get('FIREBASE_PRIVATE_KEY')!.replace(/\\n/g, '\n');

    const accessToken = await getAccessToken(clientEmail, privateKey);

    const fcmRes = await fetch(
      `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
      {
        method: 'POST',
        headers: {
          Authorization:  `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: {
            token,
            notification: { title, body: body || '' },
            webpush: { notification: { icon: '/favicon.ico' } },
          },
        }),
      }
    );

    const fcmData = await fcmRes.json();
    if (!fcmRes.ok) throw new Error(`FCM error: ${JSON.stringify(fcmData)}`);

    return new Response(JSON.stringify({ ok: true, provider: 'fcm' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err: any) {
    console.error('send-push-notification error:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
};

serve(handler);
