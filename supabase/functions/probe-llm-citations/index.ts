import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const PERPLEXITY_API_KEY = Deno.env.get('PERPLEXITY_API_KEY');
const DOMAIN_MATCH = /shoe-sherpa\.com/i;

async function runProbe(question: string) {
  const res = await fetch('https://api.perplexity.ai/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${PERPLEXITY_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'sonar',
      messages: [
        { role: 'system', content: 'Answer concisely with sources.' },
        { role: 'user', content: question },
      ],
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message || `perplexity ${res.status}`);
  const answer = data.choices?.[0]?.message?.content || '';
  const citations: string[] = data.citations || data.search_results?.map((s: any) => s.url) || [];
  const position = citations.findIndex((u) => DOMAIN_MATCH.test(u));
  return {
    answer_text: answer,
    cited_urls: citations,
    was_cited: position >= 0 || DOMAIN_MATCH.test(answer),
    position: position >= 0 ? position + 1 : null,
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  if (!PERPLEXITY_API_KEY) {
    return new Response(JSON.stringify({ error: 'PERPLEXITY_API_KEY not set' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const body = await req.json().catch(() => ({}));
  const singleProbeId: string | undefined = body.probe_id;

  let query = supabase.from('citation_probes').select('*').eq('active', true);
  if (singleProbeId) query = supabase.from('citation_probes').select('*').eq('id', singleProbeId);

  const { data: probes, error } = await query;
  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const model = 'perplexity/sonar';
  let ok = 0, fail = 0, cited = 0;

  for (const probe of probes || []) {
    try {
      const result = await runProbe(probe.question);
      await supabase.from('citation_probe_runs').insert({
        probe_id: probe.id,
        model,
        ...result,
      });
      ok++;
      if (result.was_cited) cited++;
    } catch (e) {
      await supabase.from('citation_probe_runs').insert({
        probe_id: probe.id,
        model,
        error: String(e).slice(0, 500),
        cited_urls: [],
        was_cited: false,
      });
      fail++;
    }
    // small delay to be polite
    await new Promise((r) => setTimeout(r, 300));
  }

  return new Response(JSON.stringify({ ok, fail, cited, total: probes?.length ?? 0 }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
