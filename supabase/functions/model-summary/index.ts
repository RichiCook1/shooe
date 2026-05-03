// Generates an AI summary + average rating + top tags for a model. Cached in model_summaries.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { modelId, force } = await req.json();
    if (!modelId) {
      return new Response(JSON.stringify({ error: "modelId required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Pull existing cache
    const { data: cached } = await supabase
      .from("model_summaries").select("*").eq("model_id", modelId).maybeSingle();

    // Pull reviews
    const { data: reviews } = await supabase
      .from("reviews")
      .select("id, content, rating")
      .eq("model_id", modelId)
      .order("created_at", { ascending: false })
      .limit(50);

    const reviewCount = reviews?.length ?? 0;
    const ratings = (reviews ?? []).map((r: any) => r.rating).filter((x: any) => x != null);
    const avgRating = ratings.length ? ratings.reduce((a: number, b: number) => a + b, 0) / ratings.length : null;

    // Top tags
    const reviewIds = (reviews ?? []).map((r: any) => r.id);
    let topTags: Array<{ label: string; type: string; count: number }> = [];
    if (reviewIds.length > 0) {
      const { data: rt } = await supabase
        .from("review_tags")
        .select("tag_id, tag:tags(label, type)")
        .in("review_id", reviewIds);
      const counts = new Map<string, { label: string; type: string; count: number }>();
      (rt ?? []).forEach((row: any) => {
        if (!row.tag) return;
        const key = row.tag.label;
        const existing = counts.get(key) ?? { label: row.tag.label, type: row.tag.type, count: 0 };
        existing.count++;
        counts.set(key, existing);
      });
      topTags = [...counts.values()].sort((a, b) => b.count - a.count).slice(0, 6);
    }

    // Decide if regen needed
    const stale = !cached
      || force
      || cached.review_count !== reviewCount
      || (cached.updated_at && (Date.now() - new Date(cached.updated_at).getTime() > 24 * 3600 * 1000));

    let summary = cached?.summary ?? null;
    if (stale && reviewCount > 0) {
      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      if (LOVABLE_API_KEY) {
        const reviewText = (reviews ?? [])
          .map((r: any, i: number) => `Review ${i + 1} (${r.rating ?? "?"}/10): ${r.content || "(no comment)"}`)
          .join("\n");
        try {
          const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              model: "google/gemini-2.5-flash",
              messages: [
                { role: "system", content: "You summarize shoe reviews. Reply with 2-3 short sentences in plain English: what people love, what they criticize. No headings, no bullets, no markdown." },
                { role: "user", content: reviewText.slice(0, 8000) },
              ],
              max_tokens: 200,
            }),
          });
          const data = await aiRes.json();
          summary = data?.choices?.[0]?.message?.content?.trim() ?? summary;
        } catch (e) {
          console.error("AI error", e);
        }
      }
    }

    // Upsert
    if (cached) {
      await supabase.from("model_summaries").update({
        summary, avg_rating: avgRating, review_count: reviewCount,
        top_tags: topTags, updated_at: new Date().toISOString(),
      }).eq("model_id", modelId);
    } else {
      await supabase.from("model_summaries").insert({
        model_id: modelId, summary, avg_rating: avgRating, review_count: reviewCount, top_tags: topTags,
      });
    }

    return new Response(
      JSON.stringify({ summary, avg_rating: avgRating, review_count: reviewCount, top_tags: topTags }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    console.error(e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
