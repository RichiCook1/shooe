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
  name: "get_model",
  title: "Get shoe model detail",
  description:
    "Fetch the full spec sheet, aggregate rating, and up to 20 verified reviews for a specific shoe model by id.",
  inputSchema: {
    model_id: z.string().uuid().describe("Model id (uuid)."),
    review_limit: z.number().int().min(0).max(50).optional().describe("How many reviews to include (default 20)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ model_id, review_limit }) => {
    const supabase = sb();
    const [{ data: model, error: mErr }, { data: summary }, { data: reviews }] = await Promise.all([
      supabase
        .from("models")
        .select("id,name,image_url,category,release_year,weight_g,drop_mm,stack_height_mm,msrp,updated_at,brand:brands(id,name,notes)")
        .eq("id", model_id)
        .maybeSingle(),
      supabase.from("model_summaries").select("avg_rating,review_count,summary").eq("model_id", model_id).maybeSingle(),
      supabase
        .from("reviews")
        .select("rating,content,created_at,profile:profiles(display_name,username)")
        .eq("model_id", model_id)
        .order("created_at", { ascending: false })
        .limit(review_limit ?? 20),
    ]);
    if (mErr || !model) {
      return { content: [{ type: "text", text: `Model not found: ${mErr?.message ?? model_id}` }], isError: true };
    }
    const brand = (model as any).brand;
    const payload = {
      id: model.id,
      name: [brand?.name, model.name].filter(Boolean).join(" "),
      brand: brand ? { id: brand.id, name: brand.name, notes: brand.notes ?? null } : null,
      category: model.category,
      release_year: model.release_year,
      weight_g: model.weight_g,
      drop_mm: model.drop_mm,
      stack_height_mm: model.stack_height_mm,
      msrp: model.msrp,
      image_url: model.image_url,
      updated_at: model.updated_at,
      aggregate: summary
        ? { avg_rating: summary.avg_rating, review_count: summary.review_count, summary: summary.summary }
        : null,
      reviews: (reviews ?? []).map((r: any) => ({
        author: r.profile?.display_name || r.profile?.username || "Runner",
        rating: r.rating,
        date: r.created_at?.slice(0, 10) ?? null,
        content: r.content,
      })),
      url: `https://shoe-sherpa.com/model/${model.id}`,
    };
    return {
      content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
      structuredContent: payload,
    };
  },
});
