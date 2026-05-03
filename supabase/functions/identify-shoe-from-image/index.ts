// Identifies a shoe brand+model from an image using Lovable AI vision, then fuzzy-matches catalog.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { imageUrl, imageBase64 } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY missing");
    if (!imageUrl && !imageBase64) {
      return new Response(JSON.stringify({ error: "imageUrl or imageBase64 required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const content: any[] = [
      { type: "text", text: "Identify the running, trail, climbing, or hiking shoe in this picture. Reply ONLY with strict JSON: {\"brand\":string,\"model\":string,\"confidence\":number 0-1}. If unsure, set confidence < 0.4." },
      { type: "image_url", image_url: { url: imageBase64 ? imageBase64 : imageUrl } },
    ];

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [{ role: "user", content }],
        max_tokens: 200,
      }),
    });
    const data = await res.json();
    const txt = data?.choices?.[0]?.message?.content || "";
    const match = txt.match(/\{[\s\S]*\}/);
    let parsed: any = { brand: "", model: "", confidence: 0 };
    if (match) {
      try { parsed = JSON.parse(match[0]); } catch {}
    }

    // Match against catalog
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    let brandMatch: any = null, modelMatch: any = null;
    if (parsed.brand) {
      const { data: b } = await supabase
        .from("brands").select("id, name").ilike("name", `%${parsed.brand}%`).limit(1);
      brandMatch = b?.[0] ?? null;
    }
    if (brandMatch && parsed.model) {
      const { data: m } = await supabase
        .from("models").select("id, name")
        .eq("brand_id", brandMatch.id).ilike("name", `%${parsed.model}%`).limit(1);
      modelMatch = m?.[0] ?? null;
    }

    return new Response(
      JSON.stringify({ ...parsed, brandMatch, modelMatch }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    console.error(e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
