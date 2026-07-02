import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

// Seed long-tail citation probes: top-N reviewed models × core segment questions.
// These are winnable queries where a niche site can rank above Runner's World.

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const body = await req.json().catch(() => ({}));
  const topN: number = Math.min(Math.max(Number(body.top_n ?? 40), 5), 100);

  // Pull most-reviewed models via model_summaries view
  const { data: summaries } = await supabase
    .from('model_summaries')
    .select('model_id, review_count')
    .order('review_count', { ascending: false })
    .limit(topN);

  const ids = (summaries ?? []).map((s: any) => s.model_id);
  if (!ids.length) {
    return new Response(JSON.stringify({ inserted: 0, reason: 'no reviewed models' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const { data: models } = await supabase
    .from('models')
    .select('id, name, category, brand:brands(name)')
    .in('id', ids);

  const templates: Array<(name: string, category?: string | null) => { q: string; cat: string }> = [
    (n) => ({ q: `${n} review from real runners`, cat: 'model-review' }),
    (n) => ({ q: `${n} for wide feet`, cat: 'fit' }),
    (n) => ({ q: `${n} for flat feet`, cat: 'fit' }),
    (n) => ({ q: `${n} for marathon training`, cat: 'distance' }),
    (n) => ({ q: `is the ${n} good for beginners`, cat: 'level' }),
    (n) => ({ q: `${n} pros and cons`, cat: 'model-review' }),
  ];

  const rows: any[] = [];
  for (const m of models ?? []) {
    const name = [m.brand?.name, m.name].filter(Boolean).join(' ');
    for (const tpl of templates) {
      const { q, cat } = tpl(name, m.category);
      rows.push({ question: q, category: cat, active: true });
    }
  }

  // Dedupe against existing
  const { data: existing } = await supabase.from('citation_probes').select('question');
  const seen = new Set((existing ?? []).map((r: any) => r.question.toLowerCase()));
  const fresh = rows.filter((r) => !seen.has(r.question.toLowerCase()));

  let inserted = 0;
  if (fresh.length) {
    // Chunk inserts
    for (let i = 0; i < fresh.length; i += 100) {
      const batch = fresh.slice(i, i + 100);
      const { error } = await supabase.from('citation_probes').insert(batch);
      if (!error) inserted += batch.length;
    }
  }

  return new Response(JSON.stringify({ inserted, considered: rows.length, skipped_duplicates: rows.length - fresh.length }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
