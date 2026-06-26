import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { brand_id } = await req.json();
    if (!brand_id) throw new Error("brand_id required");

    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: brand, error } = await sb.from("brands").select("id, name, website").eq("id", brand_id).maybeSingle();
    if (error) throw error;
    if (!brand) throw new Error("brand not found");

    const PPLX = Deno.env.get("PERPLEXITY_API_KEY");
    if (!PPLX) throw new Error("PERPLEXITY_API_KEY not set");

    const prompt = `Research the running/athletic footwear brand "${brand.name}".
Return a concise factual briefing (max ~250 words) covering ONLY verifiable facts:
- Country of origin / HQ
- Width options offered (e.g. narrow, standard, wide, extra wide) — be specific
- Signature foam/midsole technologies
- Typical fit characteristics (narrow toebox, roomy, true to size, etc.)
- Categories they make (road, trail, racing, training)
- Price tier
- Anything notable / what they're known for

Use bullet points. No marketing fluff. If you don't know something, omit it. Do NOT invent.`;

    const r = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${PPLX}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "sonar",
        messages: [
          { role: "system", content: "You are a factual research assistant for running shoe brands. Only state verifiable facts." },
          { role: "user", content: prompt },
        ],
        temperature: 0.1,
      }),
    });
    if (!r.ok) throw new Error(`Perplexity error ${r.status}: ${await r.text()}`);
    const data = await r.json();
    const notes = data.choices?.[0]?.message?.content?.trim() ?? "";

    const { error: upErr } = await sb.from("brands").update({ notes, facts_updated_at: new Date().toISOString() }).eq("id", brand_id);
    if (upErr) throw upErr;

    return new Response(JSON.stringify({ notes }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("research-brand", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
