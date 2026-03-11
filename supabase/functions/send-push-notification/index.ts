import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helpers for base64url
function base64urlEncode(data: Uint8Array): string {
  return btoa(String.fromCharCode(...data))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64urlDecode(str: string): Uint8Array {
  const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  const padding = '='.repeat((4 - base64.length % 4) % 4);
  const binary = atob(base64 + padding);
  return Uint8Array.from(binary, c => c.charCodeAt(0));
}

// Create VAPID Authorization header
async function createVapidAuth(endpoint: string, vapidPrivateKeyJwk: JsonWebKey, subject: string) {
  const url = new URL(endpoint);
  const audience = `${url.protocol}//${url.host}`;

  const header = { typ: "JWT", alg: "ES256" };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    aud: audience,
    exp: now + 12 * 3600,
    sub: subject,
  };

  const headerB64 = base64urlEncode(new TextEncoder().encode(JSON.stringify(header)));
  const payloadB64 = base64urlEncode(new TextEncoder().encode(JSON.stringify(payload)));
  const unsignedToken = `${headerB64}.${payloadB64}`;

  const privateKey = await crypto.subtle.importKey(
    "jwk",
    vapidPrivateKeyJwk,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"]
  );

  const signatureBuffer = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    privateKey,
    new TextEncoder().encode(unsignedToken)
  );

  // Convert DER signature to raw r||s format (64 bytes)
  const sig = new Uint8Array(signatureBuffer);
  let r: Uint8Array, s: Uint8Array;
  
  if (sig.length === 64) {
    r = sig.slice(0, 32);
    s = sig.slice(32, 64);
  } else {
    // Web Crypto returns raw r||s on most platforms
    r = sig.slice(0, 32);
    s = sig.slice(32, 64);
  }

  const rawSig = new Uint8Array(64);
  rawSig.set(r, 0);
  rawSig.set(s, 32);

  const jwt = `${unsignedToken}.${base64urlEncode(rawSig)}`;

  // Get public key from private JWK
  const publicKeyBytes = new Uint8Array(65);
  publicKeyBytes[0] = 0x04;
  publicKeyBytes.set(base64urlDecode(vapidPrivateKeyJwk.x!), 1);
  publicKeyBytes.set(base64urlDecode(vapidPrivateKeyJwk.y!), 33);
  const publicKeyB64 = base64urlEncode(publicKeyBytes);

  return {
    authorization: `vapid t=${jwt}, k=${publicKeyB64}`,
  };
}

// Encrypt push message payload per RFC 8291
async function encryptPayload(
  payload: string,
  p256dhBase64: string,
  authBase64: string
): Promise<{ encrypted: Uint8Array; salt: Uint8Array; serverPublicKey: Uint8Array }> {
  const payloadBytes = new TextEncoder().encode(payload);
  const clientPublicKey = base64urlDecode(p256dhBase64);
  const clientAuth = base64urlDecode(authBase64);

  // Generate ephemeral ECDH key pair
  const serverKeys = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveBits"]
  );

  const serverPublicKeyRaw = new Uint8Array(
    await crypto.subtle.exportKey("raw", serverKeys.publicKey)
  );

  // Import client public key
  const clientKey = await crypto.subtle.importKey(
    "raw",
    clientPublicKey,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    []
  );

  // ECDH shared secret
  const sharedSecret = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: "ECDH", public: clientKey },
      serverKeys.privateKey,
      256
    )
  );

  // Generate salt
  const salt = crypto.getRandomValues(new Uint8Array(16));

  // HKDF for auth secret
  const authInfo = new TextEncoder().encode("Content-Encoding: auth\0");
  const prkKey = await crypto.subtle.importKey("raw", sharedSecret, { name: "HKDF" }, false, ["deriveBits"]);
  
  // IKM = HKDF(auth, sharedSecret, "Content-Encoding: auth\0", 32)
  const ikmKey = await crypto.subtle.importKey("raw", clientAuth, { name: "HKDF" }, false, ["deriveBits"]);
  
  // Simplified: use HKDF to derive key material
  // PRK = HKDF-Extract(auth, ecdh_secret)
  const prkMaterial = await crypto.subtle.importKey("raw", sharedSecret, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const prk = new Uint8Array(await crypto.subtle.sign("HMAC", await crypto.subtle.importKey("raw", clientAuth, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]), sharedSecret));

  // Build info for key and nonce
  const keyInfoBuf = buildInfo("aesgcm", clientPublicKey, serverPublicKeyRaw);
  const nonceInfoBuf = buildInfo("nonce", clientPublicKey, serverPublicKeyRaw);

  // Derive key and nonce using HKDF
  const prkForHkdf = await crypto.subtle.importKey("raw", prk, { name: "HKDF" }, false, ["deriveBits"]);
  
  const contentKeyBits = await crypto.subtle.deriveBits(
    { name: "HKDF", hash: "SHA-256", salt: salt, info: keyInfoBuf },
    prkForHkdf,
    128
  );
  const nonceBits = await crypto.subtle.deriveBits(
    { name: "HKDF", hash: "SHA-256", salt: salt, info: nonceInfoBuf },
    prkForHkdf,
    96
  );

  const contentKey = await crypto.subtle.importKey(
    "raw",
    contentKeyBits,
    { name: "AES-GCM" },
    false,
    ["encrypt"]
  );

  // Add padding: 2 bytes (big-endian length) + padding + payload
  const paddingLength = 0;
  const record = new Uint8Array(2 + paddingLength + payloadBytes.length);
  record[0] = 0;
  record[1] = 0;
  record.set(payloadBytes, 2 + paddingLength);

  const encrypted = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: new Uint8Array(nonceBits), tagLength: 128 },
      contentKey,
      record
    )
  );

  return { encrypted, salt, serverPublicKey: serverPublicKeyRaw };
}

function buildInfo(type: string, clientPublicKey: Uint8Array, serverPublicKey: Uint8Array): Uint8Array {
  const label = new TextEncoder().encode(`Content-Encoding: ${type}\0`);
  const clientLabel = new TextEncoder().encode("P-256\0");
  
  const info = new Uint8Array(
    label.length +
    5 + // "P-256\0" already in clientLabel
    2 + clientPublicKey.length +
    2 + serverPublicKey.length
  );

  let offset = 0;
  info.set(label, offset); offset += label.length;
  info.set(clientLabel, offset); offset += clientLabel.length;
  
  // Client public key length (2 bytes BE) + key
  info[offset++] = 0;
  info[offset++] = clientPublicKey.length;
  info.set(clientPublicKey, offset); offset += clientPublicKey.length;
  
  // Server public key length (2 bytes BE) + key
  info[offset++] = 0;
  info[offset++] = serverPublicKey.length;
  info.set(serverPublicKey, offset);

  return info;
}

function getNotificationBody(type: string, actorName: string): { title: string; body: string; url: string } {
  switch (type) {
    case 'like':
      return { title: 'Sherpa', body: `${actorName} liked your review`, url: '/feed' };
    case 'comment':
      return { title: 'Sherpa', body: `${actorName} commented on your review`, url: '/feed' };
    case 'follow':
      return { title: 'Sherpa', body: `${actorName} started following you`, url: '/feed' };
    case 'message':
      return { title: 'Sherpa', body: `${actorName} sent you a message`, url: '/messages' };
    default:
      return { title: 'Sherpa', body: 'You have a new notification', url: '/feed' };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { record } = await req.json();
    
    if (!record) {
      return new Response(JSON.stringify({ error: 'No record provided' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { user_id, actor_id, type } = record;

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const vapidPrivateKeyJson = Deno.env.get('VAPID_PRIVATE_KEY');

    if (!vapidPrivateKeyJson) {
      return new Response(JSON.stringify({ error: 'VAPID keys not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const vapidPrivateKeyJwk = JSON.parse(vapidPrivateKeyJson);
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get actor profile for notification text
    const { data: actorProfile } = await supabase
      .from('profiles')
      .select('display_name, username')
      .eq('user_id', actor_id)
      .single();

    const actorName = actorProfile?.display_name || actorProfile?.username || 'Someone';

    // Get user's push subscriptions
    const { data: subscriptions } = await supabase
      .from('push_subscriptions')
      .select('*')
      .eq('user_id', user_id);

    if (!subscriptions || subscriptions.length === 0) {
      return new Response(JSON.stringify({ message: 'No push subscriptions found' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const notificationData = getNotificationBody(type, actorName);
    const payloadStr = JSON.stringify(notificationData);

    const results = [];

    for (const sub of subscriptions) {
      try {
        const { authorization } = await createVapidAuth(
          sub.endpoint,
          vapidPrivateKeyJwk,
          'mailto:noreply@sherpa.app'
        );

        const { encrypted, salt, serverPublicKey } = await encryptPayload(
          payloadStr,
          sub.p256dh,
          sub.auth
        );

        const response = await fetch(sub.endpoint, {
          method: 'POST',
          headers: {
            'Authorization': authorization,
            'Content-Encoding': 'aesgcm',
            'Content-Type': 'application/octet-stream',
            'Encryption': `salt=${base64urlEncode(salt)}`,
            'Crypto-Key': `dh=${base64urlEncode(serverPublicKey)}`,
            'TTL': '86400',
          },
          body: encrypted,
        });

        if (response.status === 410 || response.status === 404) {
          // Subscription expired, remove it
          await supabase
            .from('push_subscriptions')
            .delete()
            .eq('id', sub.id);
          results.push({ endpoint: sub.endpoint, status: 'removed' });
        } else {
          results.push({ endpoint: sub.endpoint, status: response.status });
        }
      } catch (err) {
        results.push({ endpoint: sub.endpoint, error: err.message });
      }
    }

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
