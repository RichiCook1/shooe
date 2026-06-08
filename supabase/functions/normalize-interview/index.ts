// Cleans up a raw interview transcript into a publishable review and extracts metadata.
// Returns: { language, content_cleaned, content_en, rating?, terrain?, tag_ids[] }
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

async function loadCatalog() {
  const headers = { apikey: SERVICE_ROLE, Authorization: `Bearer ${SERVICE_ROLE}` };
  const [tagsRes, terrainRes] = await Promise.all([
    fetch(`${SUPABASE_URL}/rest/v1/tags?select=id,label,type&active=eq.true`, { headers }),
    fetch(`${SUPABASE_URL}/rest/v1/field_options?select=value,label&field_name=eq.terrain&active=eq.true`, { headers }),
  ]);
  const tags = tagsRes.ok ? await tagsRes.json() : [];
  let terrains: { value: string; label: string }[] = terrainRes.ok ? await terrainRes.json() : [];
  if (!terrains.length) {
    terrains = ["road", "trail", "mixed", "track"].map((v) => ({ value: v, label: v }));
  }
  return { tags, terrains };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { transcript } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY missing");
    if (!transcript || typeof transcript !== "string" || !transcript.trim()) {
      return new Response(JSON.stringify({ error: "transcript required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { tags, terrains } = await loadCatalog();
    const tagList = tags.map((t: any) => `- ${t.id} | ${t.label} (${t.type})`).join("\n");
    const terrainList = terrains.map((t) => `- ${t.value}`).join("\n");

    const system = `You normalize spoken shoe-review interviews into clean written reviews.

Rules:
- Preserve the reviewer's voice, opinions and facts. Do NOT invent details.
- Fix grammar, spelling, punctuation. Remove filler words ("um", "uh", "you know"), repetitions and false starts.
- CRITICAL: STRIP ALL INTERVIEWER QUESTIONS, PROMPTS AND THIRD-PARTY VOICES. The final text must read EXACTLY as if the reviewer wrote it themselves, unprompted, on their own. NEVER include questions (no "?" sentences that come from an interviewer), NEVER reference an interview/interviewer/being asked/"you asked me"/"good question"/etc. If the reviewer answers "yes/no" or briefly to a question, REWRITE it as a standalone first-person statement that absorbs the question's context (e.g. Q: "How's the grip?" A: "Really good." → "The grip is really good.").
- Do not preserve the Q&A structure. Merge answers into a flowing first-person monologue.
- Restructure into 2–4 short paragraphs covering: quick intro → what works (pros) → what doesn't (cons) → verdict. Use plain prose, no headings or bullet symbols. No question marks unless the reviewer is rhetorically asking themselves something.
- Detect the source language (ISO 639-1, e.g. "en", "it", "es"). Keep "content_cleaned" in that language. Produce "content_en" as an English translation (if source is English, repeat the cleaned text).
- If the transcript clearly implies an overall rating on 0–10 (e.g. "I'd give it a solid 8"), set "rating". Otherwise omit.
- Pick "terrain" ONLY from this list:
${terrainList}
- Pick up to 5 "tag_ids" ONLY from this list (use the UUID before the |):
${tagList}
- Only include rating/terrain/tags when the transcript clearly supports them. Empty arrays / null are fine.

Reply with ONLY a JSON object, no markdown, no preamble.`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: `Transcript:\n"""\n${transcript.trim()}\n"""` },
        ],
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
      console.error("AI gateway error:", res.status, t);
      return new Response(JSON.stringify({ error: "Normalization failed", detail: t }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await res.json();
    const raw = data?.choices?.[0]?.message?.content || "{}";
    let parsed: any = {};
    try { parsed = JSON.parse(raw); }
    catch {
      const m = raw.match(/\{[\s\S]*\}/);
      if (m) { try { parsed = JSON.parse(m[0]); } catch { /* noop */ } }
    }

    // Sanitize
    const validTerrain = new Set(terrains.map((t) => t.value));
    const validTagIds = new Set(tags.map((t: any) => t.id));
    const out = {
      language: typeof parsed.language === "string" ? parsed.language.toLowerCase().slice(0, 5) : null,
      content_cleaned: typeof parsed.content_cleaned === "string" ? parsed.content_cleaned.trim() : "",
      content_en: typeof parsed.content_en === "string" ? parsed.content_en.trim() : "",
      rating: typeof parsed.rating === "number" && parsed.rating >= 0 && parsed.rating <= 10
        ? Math.round(parsed.rating * 2) / 2 : null,
      terrain: typeof parsed.terrain === "string" && validTerrain.has(parsed.terrain) ? parsed.terrain : null,
      tag_ids: Array.isArray(parsed.tag_ids)
        ? parsed.tag_ids.filter((id: any) => typeof id === "string" && validTagIds.has(id)).slice(0, 5)
        : [],
    };

    if (!out.content_cleaned) out.content_cleaned = transcript.trim();
    if (!out.content_en) out.content_en = out.content_cleaned;

    return new Response(JSON.stringify(out), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error(e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
