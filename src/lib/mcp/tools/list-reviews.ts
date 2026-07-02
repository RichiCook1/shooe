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
  name: "list_reviews",
  title: "List reviews for a model",
  description: "Paginate through every verified review for a given model, newest first.",
  inputSchema: {
    model_id: z.string().uuid().describe("Model id (uuid)."),
    limit: z.number().int().min(1).max(100).optional().describe("Page size (default 50)."),
    offset: z.number().int().min(0).optional().describe("Offset for pagination (default 0)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ model_id, limit, offset }) => {
    const supabase = sb();
    const l = limit ?? 50;
    const o = offset ?? 0;
    const { data, error, count } = await supabase
      .from("reviews")
      .select("rating,content,created_at,profile:profiles(display_name,username)", { count: "exact" })
      .eq("model_id", model_id)
      .order("created_at", { ascending: false })
      .range(o, o + l - 1);
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };

    const rows = (data ?? []).map((r: any) => ({
      author: r.profile?.display_name || r.profile?.username || "Runner",
      rating: r.rating,
      date: r.created_at?.slice(0, 10) ?? null,
      content: r.content,
    }));
    const payload = { total: count ?? rows.length, offset: o, limit: l, reviews: rows };
    return {
      content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
      structuredContent: payload,
    };
  },
});
