import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

// Ping IndexNow (Bing/Copilot/Yandex) with changed URLs for instant reindex.
// Called from the prerender/deploy pipeline OR ad-hoc from admin UI.

const KEY = '0c29e210c52b1bc987901f929476039b';
const HOST = 'shoe-sherpa.com';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const body = await req.json().catch(() => ({}));
  const urls: string[] = Array.isArray(body.urls) && body.urls.length
    ? body.urls
    : [`https://${HOST}/`];

  const payload = {
    host: HOST,
    key: KEY,
    keyLocation: `https://${HOST}/${KEY}.txt`,
    urlList: urls.slice(0, 10000),
  };

  const res = await fetch('https://api.indexnow.org/IndexNow', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify(payload),
  });

  return new Response(JSON.stringify({ status: res.status, submitted: payload.urlList.length }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
