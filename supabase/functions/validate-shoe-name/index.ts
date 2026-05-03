// Validates a custom-typed shoe brand/model: fuzzy-match catalog, then web-check via Perplexity.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { brand, model, brandId } = await req.json();
    if (!brand || !model) {
      return new Response(JSON.stringify({ error: "brand and model required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 1. Resolve brand
    let resolvedBrandId = brandId as string | undefined;
    let resolvedBrandName = brand;
    if (!resolvedBrandId) {
      const { data: existingBrand } = await supabase
        .from("brands").select("id, name").ilike("name", brand).maybeSingle();
      if (existingBrand) {
        resolvedBrandId = existingBrand.id;
        resolvedBrandName = existingBrand.name;
      }
    }

    // 2. Fuzzy-match against existing models (trigram similarity for typo tolerance)
    if (resolvedBrandId) {
      const lower = model.toLowerCase().trim();
      // Try exact/ilike first
      const { data: exact } = await supabase
        .from("models").select("id, name").eq("brand_id", resolvedBrandId).ilike("name", model).limit(1);
      let match: any = exact?.[0] ?? null;
      if (!match) {
        // Trigram similarity via RPC-less workaround: pull all and score in JS
        const { data: candidates } = await supabase
          .from("models").select("id, name").eq("brand_id", resolvedBrandId);
        const score = (a: string, b: string) => {
          const grams = (s: string) => { const g = new Set<string>(); const t = `  ${s.toLowerCase()}  `; for (let i = 0; i < t.length - 2; i++) g.add(t.slice(i, i + 3)); return g; };
          const A = grams(a), B = grams(b); let inter = 0; A.forEach(x => { if (B.has(x)) inter++; });
          return inter / (A.size + B.size - inter || 1);
        };
        const ranked = (candidates ?? []).map((c: any) => ({ c, s: score(c.name, model) })).sort((a, b) => b.s - a.s);
        if (ranked[0] && ranked[0].s >= 0.55) match = ranked[0].c;
      }
      if (match) {
        return new Response(
          JSON.stringify({ action: "matched", modelId: match.id, brandId: resolvedBrandId, name: match.name }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // 3. Web check via Perplexity
    const PPLX = Deno.env.get("PERPLEXITY_API_KEY");
    let webCheck: any = { exists: null, corrected_brand: brand, corrected_model: model, confidence: 0 };
    if (PPLX) {
      try {
        const res = await fetch("https://api.perplexity.ai/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${PPLX}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "sonar",
            messages: [
              {
                role: "system",
                content:
                  "You verify whether a running, trail, climbing, or hiking shoe exists. Reply ONLY with strict JSON: {\"exists\": boolean, \"corrected_brand\": string, \"corrected_model\": string, \"confidence\": number 0-1}. If misspelled, return the corrected names. If unknown, exists=false.",
              },
              { role: "user", content: `Does the shoe "${brand} ${model}" exist? Reply with the JSON only.` },
            ],
            max_tokens: 200,
            temperature: 0.1,
          }),
        });
        const data = await res.json();
        const txt = data?.choices?.[0]?.message?.content || "";
        const jsonMatch = txt.match(/\{[\s\S]*\}/);
        if (jsonMatch) webCheck = { ...webCheck, ...JSON.parse(jsonMatch[0]) };
      } catch (e) {
        console.error("perplexity error", e);
      }
    }

    // 4. Ensure brand exists (create if needed using corrected name)
    if (!resolvedBrandId) {
      const finalBrand = (webCheck.exists && webCheck.corrected_brand) || brand;
      const { data: existingBrand2 } = await supabase
        .from("brands").select("id, name").ilike("name", finalBrand).maybeSingle();
      if (existingBrand2) {
        resolvedBrandId = existingBrand2.id;
        resolvedBrandName = existingBrand2.name;
      } else {
        const { data: newBrand, error: brandErr } = await supabase
          .from("brands").insert({ name: finalBrand }).select().single();
        if (brandErr) throw brandErr;
        resolvedBrandId = newBrand.id;
        resolvedBrandName = newBrand.name;
      }
    }

    // 5. Insert model with appropriate verified/pending flags
    const finalModelName = (webCheck.exists && webCheck.corrected_model) || model;
    const pending = !webCheck.exists;
    const { data: newModel, error: modelErr } = await supabase
      .from("models")
      .insert({
        name: finalModelName,
        brand_id: resolvedBrandId,
        verified: !!webCheck.exists,
        pending_review: pending,
        source: "user_submitted",
      })
      .select()
      .single();
    if (modelErr) throw modelErr;

    // 6. Queue for admin if not verified
    if (pending) {
      await supabase.from("model_review_queue").insert({
        model_id: newModel.id,
        submitted_brand: brand,
        submitted_model: model,
        web_check_result: webCheck,
        status: "pending",
      });
    } else {
      // Fire-and-forget image enrichment for newly verified models
      supabase.functions.invoke("enrich-shoe-images", { body: { modelId: newModel.id } }).catch(() => {});
    }

    const correctedName = `${resolvedBrandName} ${finalModelName}`;
    const wasCorrected =
      webCheck.exists &&
      (webCheck.corrected_brand?.toLowerCase().trim() !== brand.toLowerCase().trim() ||
        webCheck.corrected_model?.toLowerCase().trim() !== model.toLowerCase().trim());

    return new Response(
      JSON.stringify({
        action: pending ? "queued" : wasCorrected ? "corrected" : "created",
        modelId: newModel.id,
        brandId: resolvedBrandId,
        name: correctedName,
        webCheck,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    console.error(e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
