// Discovers new shoe releases for all brands using Perplexity. Logs to catalog_jobs.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const PPLX = Deno.env.get("PERPLEXITY_API_KEY");
    if (!PPLX) throw new Error("PERPLEXITY_API_KEY missing");

    const { data: job } = await supabase
      .from("catalog_jobs").insert({ job_name: "discover-new-shoes", status: "running" }).select().single();

    const body = await req.json().catch(() => ({}));
    const limit = body?.limit ?? 5;
    const year = body?.year ?? new Date().getFullYear();
    const errors: any[] = [];
    let added = 0, updated = 0;

    const { data: brands } = await supabase.from("brands").select("id, name").order("name").limit(limit);
    for (const brand of brands ?? []) {
      try {
        const res = await fetch("https://api.perplexity.ai/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${PPLX}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "sonar",
            messages: [
              {
                role: "system",
                content: 'You list official shoe releases from a specific brand. Reply ONLY with strict JSON: {"models":[{"name":string,"year":number,"category":"road"|"trail"|"track"|"racing"|"hiking"|"indoor_climbing"|"outdoor_climbing"|"mountaineering"|"recovery"|"cross_training"|"walking","msrp":number|null,"weight_g":number|null,"drop_mm":number|null}]}. Only include real, verifiable models.',
              },
              { role: "user", content: `List up to 12 ${brand.name} running, trail, or climbing shoe models released in ${year}. Be precise. JSON only.` },
            ],
            max_tokens: 1500,
            temperature: 0.1,
          }),
        });
        const data = await res.json();
        const txt = data?.choices?.[0]?.message?.content || "";
        const m = txt.match(/\{[\s\S]*\}/);
        if (!m) continue;
        const parsed = JSON.parse(m[0]);
        for (const model of parsed.models ?? []) {
          const { data: existing } = await supabase
            .from("models").select("id").eq("brand_id", brand.id).ilike("name", model.name).maybeSingle();
          if (existing) {
            await supabase.from("models").update({
              release_year: model.year ?? null,
              category: model.category ?? null,
              msrp: model.msrp ?? null,
              weight_g: model.weight_g ?? null,
              drop_mm: model.drop_mm ?? null,
              verified: true,
              source: "perplexity",
            }).eq("id", existing.id);
            updated++;
          } else {
            await supabase.from("models").insert({
              name: model.name,
              brand_id: brand.id,
              category: model.category ?? null,
              release_year: model.year ?? null,
              msrp: model.msrp ?? null,
              weight_g: model.weight_g ?? null,
              drop_mm: model.drop_mm ?? null,
              verified: true,
              source: "perplexity",
            });
            added++;
          }
        }
      } catch (e: any) {
        errors.push({ brand: brand.name, error: e.message });
      }
    }

    if (job) {
      await supabase.from("catalog_jobs").update({
        status: errors.length ? "completed_with_errors" : "completed",
        finished_at: new Date().toISOString(),
        models_added: added, models_updated: updated, errors,
      }).eq("id", job.id);
    }

    return new Response(JSON.stringify({ added, updated, errors }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error(e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
