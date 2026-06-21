// Identifies shoe using SerpAPI Google Lens reverse image search + Gemini to extract brand/model.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { imageUrl, topK = 4 } = await req.json();
    const SERPAPI_API_KEY = Deno.env.get("SERPAPI_API_KEY");
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!SERPAPI_API_KEY) throw new Error("SERPAPI_API_KEY missing");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY missing");
    if (!imageUrl) {
      return new Response(JSON.stringify({ error: "imageUrl required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const k = Math.max(1, Math.min(5, Number(topK) || 4));

    // 1. Call SerpAPI Google Lens
    const lensUrl = `https://serpapi.com/search.json?engine=google_lens&url=${encodeURIComponent(imageUrl)}&api_key=${SERPAPI_API_KEY}`;
    const lensRes = await fetch(lensUrl);
    if (!lensRes.ok) {
      const t = await lensRes.text();
      return new Response(JSON.stringify({ error: "Google Lens failed", detail: t }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const lensData = await lensRes.json();
    const matches: any[] = (lensData.visual_matches || []).slice(0, 20);
    if (matches.length === 0) {
      return new Response(JSON.stringify({ candidates: [], lensTitles: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const titles = matches.map((m, i) => `${i + 1}. ${m.title || ""} — ${m.source || ""}`).join("\n");
    const thumbs = matches.slice(0, 8).map((m) => m.thumbnail).filter(Boolean);

    // 2. Use Gemini to extract brand/model from Lens titles
    const prompt = `These are reverse-image search results from Google Lens for a shoe photo. Each line is "TITLE — SOURCE". Identify the single shoe model. Reply with ONLY JSON: {"candidates":[{"brand":string,"model":string,"confidence":number 0-1,"reason":string}]}. Return up to ${k} most likely candidates ordered by confidence. Brand should be canonical (e.g. "Nike", "Hoka", "Salomon"). Model should be the clean product name without brand prefix, size, color, or year (e.g. "Pegasus 40", "Speedgoat 5", "Sense Ride 5"). Drop generic results like "running shoes" or marketplace listings without a clear model.\n\nResults:\n${titles}`;

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        response_format: { type: "json_object" },
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (aiRes.status === 429) {
      return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!aiRes.ok) {
      const t = await aiRes.text();
      return new Response(JSON.stringify({ error: "AI extraction failed", detail: t }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiRes.json();
    const txt = aiData?.choices?.[0]?.message?.content || "{}";
    let parsed: any = {};
    try { parsed = JSON.parse(txt); } catch {
      const m = txt.match(/\{[\s\S]*\}/);
      if (m) { try { parsed = JSON.parse(m[0]); } catch {} }
    }
    const raw: any[] = Array.isArray(parsed.candidates) ? parsed.candidates : [];

    // 3. Fuzzy match against catalog
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const candidates = await Promise.all(
      raw.slice(0, k).map(async (c: any) => {
        const brand = String(c.brand || "").trim();
        const model = String(c.model || "").trim();
        let brandMatch: any = null, modelMatch: any = null;
        if (brand) {
          const { data: b } = await supabase
            .from("brands").select("id, name").ilike("name", `%${brand}%`).limit(1);
          brandMatch = b?.[0] ?? null;
        }
        if (brandMatch && model) {
          const { data: m } = await supabase
            .from("models").select("id, name, image_url")
            .eq("brand_id", brandMatch.id).ilike("name", `%${model}%`).limit(1);
          modelMatch = m?.[0] ?? null;
        }
        return {
          brand, model,
          confidence: typeof c.confidence === "number" ? c.confidence : null,
          reason: typeof c.reason === "string" ? c.reason : null,
          brandMatch, modelMatch,
        };
      })
    );

    return new Response(
      JSON.stringify({ candidates, lensThumbs: thumbs, ...(candidates[0] || {}) }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    console.error(e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
