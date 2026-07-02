import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const BOT_REGEX = /(GPTBot|OAI-SearchBot|ChatGPT-User|PerplexityBot|Perplexity-User|ClaudeBot|Claude-Web|Anthropic-AI|Google-Extended|Googlebot|Bingbot|CCBot|YouBot|Applebot-Extended|Amazonbot|meta-externalagent|DuckAssistBot|Bytespider|Diffbot)/i;

function detectBot(ua: string): string | null {
  const m = ua?.match(BOT_REGEX);
  return m ? m[1] : null;
}

async function hashIp(ip: string): Promise<string> {
  const data = new TextEncoder().encode(ip + 'shoe-sherpa-salt');
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash)).slice(0, 8).map(b => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const ua = body.ua || req.headers.get('user-agent') || '';
    const bot = detectBot(ua);
    if (!bot) {
      return new Response(JSON.stringify({ logged: false, reason: 'not-a-known-bot' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown';
    const ipHash = ip !== 'unknown' ? await hashIp(ip) : null;

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    await supabase.from('llm_crawler_hits').insert({
      bot_name: bot,
      user_agent: ua.slice(0, 500),
      path: (body.path || '').slice(0, 500),
      referer: (body.referer || req.headers.get('referer') || '').slice(0, 500),
      ip_hash: ipHash,
      source: body.source || 'beacon',
      metadata: body.metadata || null,
    });

    return new Response(JSON.stringify({ logged: true, bot }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
