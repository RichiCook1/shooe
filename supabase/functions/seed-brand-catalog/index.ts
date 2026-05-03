// Seeds models for a single brand by scraping its site via Firecrawl + Perplexity fallback.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { brandId } = await req.json();
    if (!brandId) {
      return new Response(JSON.stringify({ error: "brandId required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const FIRECRAWL = Deno.env.get("FIRECRAWL_API_KEY");
    const PPLX = Deno.env.get("PERPLEXITY_API_KEY");

    const { data: job } = await supabase
      .from("catalog_jobs").insert({ job_name: `seed-brand-catalog`, status: "running", notes: brandId }).select().single();

    const { data: brand } = await supabase.from("brands").select("*").eq("id", brandId).single();
    if (!brand) throw new Error("Brand not found");

    let added = 0, updated = 0;
    const errors: any[] = [];
    let candidates: Array<{ name: string; image?: string }> = [];

    // 1. Try Firecrawl scrape of brand homepage / collection
    if (FIRECRAWL && brand.website) {
      try {
        const fcRes = await fetch("https://api.firecrawl.dev/v2/scrape", {
          method: "POST",
          headers: { Authorization: `Bearer ${FIRECRAWL}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            url: brand.website,
            formats: [
              {
                type: "json",
                prompt: `List every distinct shoe model name visible on this page. Return JSON: {\"models\":[{\"name\":string,\"image\":string|null}]}`,
              },
            ],
            onlyMainContent: true,
          }),
        });
        const fcData = await fcRes.json();
        const json = fcData?.data?.json ?? fcData?.json;
        if (json?.models) candidates = json.models;
      } catch (e: any) {
        errors.push({ step: "firecrawl", error: e.message });
      }
    }

    // 2. Fallback / supplement with Perplexity
    if (PPLX && candidates.length < 5) {
      try {
        const res = await fetch("https://api.perplexity.ai/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${PPLX}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "sonar",
            messages: [
              { role: "system", content: 'List shoe models. Reply ONLY with JSON: {"models":[{"name":string}]}.' },
              { role: "user", content: `List the 30 most popular ${brand.name} shoe models (running, trail, climbing or hiking). JSON only.` },
            ],
            max_tokens: 1500, temperature: 0.1,
          }),
        });
        const data = await res.json();
        const txt = data?.choices?.[0]?.message?.content || "";
        const m = txt.match(/\{[\s\S]*\}/);
        if (m) {
          const parsed = JSON.parse(m[0]);
          for (const mdl of parsed.models ?? []) {
            if (!candidates.find((c) => c.name.toLowerCase() === mdl.name.toLowerCase())) {
              candidates.push({ name: mdl.name });
            }
          }
        }
      } catch (e: any) {
        errors.push({ step: "perplexity", error: e.message });
      }
    }

    for (const cand of candidates) {
      const cleanName = (cand.name || "").trim();
      if (!cleanName || cleanName.length < 2 || cleanName.length > 80) continue;
      const { data: existing } = await supabase
        .from("models").select("id, image_url").eq("brand_id", brandId).ilike("name", cleanName).maybeSingle();
      if (existing) {
        if (cand.image && !existing.image_url) {
          await supabase.from("models").update({ image_url: cand.image, verified: true }).eq("id", existing.id);
          updated++;
        }
      } else {
        await supabase.from("models").insert({
          name: cleanName,
          brand_id: brandId,
          image_url: cand.image ?? null,
          verified: true,
          source: "catalog-seed",
        });
        added++;
      }
    }

    if (job) {
      await supabase.from("catalog_jobs").update({
        status: errors.length ? "completed_with_errors" : "completed",
        finished_at: new Date().toISOString(),
        models_added: added, models_updated: updated, errors,
      }).eq("id", job.id);
    }

    return new Response(JSON.stringify({ added, updated, errors, candidates: candidates.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error(e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
