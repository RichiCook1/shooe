import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";

function sb() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

export default defineTool({
  name: "best_for",
  title: "Best shoes for a runner segment",
  description:
    "Return the ranked shortlist of shoes for a given runner segment (e.g. 'marathon-wide-feet', 'trail-50k-neutral'). Uses only models with at least 10 verified reviews in that segment.",
  inputSchema: {
    segment_slug: z.string().trim().min(1).describe("Segment slug — see the segments list at /best."),
    limit: z.number().int().min(1).max(20).optional().describe("Top N results (default 5)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ segment_slug, limit }) => {
    const supabase = sb();
    const [{ data: seg }, { data: stats, error }] = await Promise.all([
      supabase.from("segments").select("slug,title,description").eq("slug", segment_slug).maybeSingle(),
      supabase
        .from("model_segment_stats")
        .select("model_id,avg_rating,review_count")
        .eq("segment_slug", segment_slug)
        .gte("review_count", 10)
        .order("avg_rating", { ascending: false })
        .limit(limit ?? 5),
    ]);
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    if (!seg) return { content: [{ type: "text", text: `Unknown segment: ${segment_slug}` }], isError: true };

    const ids = (stats ?? []).map((s: any) => s.model_id);
    const { data: models } = ids.length
      ? await supabase.from("models").select("id,name,image_url,msrp,brand:brands(id,name)").in("id", ids)
      : { data: [] as any[] };
    const modelMap = new Map((models ?? []).map((m: any) => [m.id, m]));

    const rows = (stats ?? [])
      .map((s: any, i: number) => {
        const m: any = modelMap.get(s.model_id);
        if (!m) return null;
        return {
          rank: i + 1,
          model_id: m.id,
          name: [m.brand?.name, m.name].filter(Boolean).join(" "),
          avg_rating: s.avg_rating,
          review_count: s.review_count,
          msrp: m.msrp ?? null,
          image_url: m.image_url ?? null,
          url: `https://shoe-sherpa.com/model/${m.id}`,
        };
      })
      .filter(Boolean);

    const payload = { segment: seg, results: rows };
    return {
      content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
      structuredContent: payload,
    };
  },
});
