// Identifies the top shoe candidates from an image using Lovable AI vision, then fuzzy-matches catalog.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { imageUrl, imageBase64, topK = 3 } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY missing");
    if (!imageUrl && !imageBase64) {
      return new Response(JSON.stringify({ error: "imageUrl or imageBase64 required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const k = Math.max(1, Math.min(5, Number(topK) || 3));
    const content: any[] = [
      { type: "text", text: `Identify the running, trail, climbing, or hiking shoe in this picture. Use visible logos, colorway, midsole shape, outsole pattern and any text on the shoe to narrow it down. Search your knowledge of current and recent shoe catalogs. Reply with ONLY strict JSON: {"candidates":[{"brand":string,"model":string,"confidence":number 0-1,"reason":string}]}. Return the top ${k} most likely shoes, ordered by confidence (highest first). If you truly cannot tell, return an empty array.` },
      { type: "image_url", image_url: { url: imageBase64 ? imageBase64 : imageUrl } },
    ];

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        response_format: { type: "json_object" },
        messages: [{ role: "user", content }],
      }),
    });

    if (res.status === 429) {
      return new Response(JSON.stringify({ error: "Rate limit exceeded, try again shortly." }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (res.status === 402) {
      return new Response(JSON.stringify({ error: "AI credits exhausted." }), {
        status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!res.ok) {
      const t = await res.text();
      return new Response(JSON.stringify({ error: "Vision call failed", detail: t }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await res.json();
    const txt = data?.choices?.[0]?.message?.content || "{}";
    let parsed: any = {};
    try { parsed = JSON.parse(txt); }
    catch {
      const m = txt.match(/\{[\s\S]*\}/);
      if (m) { try { parsed = JSON.parse(m[0]); } catch {} }
    }
    let raw: any[] = Array.isArray(parsed.candidates) ? parsed.candidates : [];
    // Back-compat: if model returned a single {brand, model, confidence}
    if (!raw.length && parsed.brand) {
      raw = [{ brand: parsed.brand, model: parsed.model, confidence: parsed.confidence }];
    }

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
      JSON.stringify({ candidates }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    console.error(e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
