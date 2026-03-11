import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Generate ECDSA P-256 key pair for VAPID
    const keyPair = await crypto.subtle.generateKey(
      { name: "ECDSA", namedCurve: "P-256" },
      true,
      ["sign", "verify"]
    );

    const publicKeyJwk = await crypto.subtle.exportKey("jwk", keyPair.publicKey);
    const privateKeyJwk = await crypto.subtle.exportKey("jwk", keyPair.privateKey);

    // Convert to URL-safe base64 (uncompressed public key for applicationServerKey)
    const x = publicKeyJwk.x!;
    const y = publicKeyJwk.y!;
    
    // Build uncompressed point: 0x04 || x || y
    const xBytes = Uint8Array.from(atob(x.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
    const yBytes = Uint8Array.from(atob(y.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
    const uncompressed = new Uint8Array(65);
    uncompressed[0] = 0x04;
    uncompressed.set(xBytes, 1);
    uncompressed.set(yBytes, 33);
    
    const publicKeyBase64 = btoa(String.fromCharCode(...uncompressed))
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

    // Private key as base64url
    const d = privateKeyJwk.d!;

    return new Response(JSON.stringify({
      publicKey: publicKeyBase64,
      privateKey: JSON.stringify(privateKeyJwk),
      instructions: "Store publicKey as VAPID_PUBLIC_KEY and privateKey as VAPID_PRIVATE_KEY in your secrets."
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
