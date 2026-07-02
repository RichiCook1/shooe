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
  name: "search_models",
  title: "Search shoe models",
  description:
    "Search the Shoe Sherpa catalog for running shoe models by name, optionally filtered by brand or category. Returns id, full name, aggregate rating, and review count.",
  inputSchema: {
    query: z.string().trim().min(1).describe("Model name or partial name to search for."),
    brand: z.string().trim().optional().describe("Optional brand name filter (case-insensitive)."),
    category: z.string().trim().optional().describe("Optional category filter (e.g. road, trail, race)."),
    limit: z.number().int().min(1).max(50).optional().describe("Max results (default 20)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ query, brand, category, limit }) => {
    const supabase = sb();
    let q = supabase
      .from("models")
      .select("id,name,category,msrp,image_url,brand:brands(id,name)")
      .ilike("name", `%${query}%`)
      .limit(limit ?? 20);
    if (category) q = q.ilike("category", `%${category}%`);
    const { data: models, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };

    let filtered = models ?? [];
    if (brand) {
      const b = brand.toLowerCase();
      filtered = filtered.filter((m: any) => m.brand?.name?.toLowerCase().includes(b));
    }
    const ids = filtered.map((m: any) => m.id);
    const { data: summaries } = ids.length
      ? await supabase.from("model_summaries").select("model_id,avg_rating,review_count").in("model_id", ids)
      : { data: [] as any[] };
    const summaryMap = new Map((summaries ?? []).map((s: any) => [s.model_id, s]));

    const rows = filtered.map((m: any) => {
      const s = summaryMap.get(m.id) as any;
      return {
        id: m.id,
        name: [m.brand?.name, m.name].filter(Boolean).join(" "),
        brand: m.brand?.name ?? null,
        category: m.category ?? null,
        msrp: m.msrp ?? null,
        image_url: m.image_url ?? null,
        avg_rating: s?.avg_rating ?? null,
        review_count: s?.review_count ?? 0,
        url: `https://shoe-sherpa.com/model/${m.id}`,
      };
    });
    return {
      content: [{ type: "text", text: JSON.stringify(rows, null, 2) }],
      structuredContent: { results: rows },
    };
  },
});
