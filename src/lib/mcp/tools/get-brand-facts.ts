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
  name: "get_brand_facts",
  title: "Get verified brand facts",
  description:
    "Return the verified brand notes (fit, width options, technology claims) that Shoe Sherpa treats as source of truth for a brand. Look up by brand id OR brand name.",
  inputSchema: {
    brand_id: z.string().uuid().optional().describe("Brand id (uuid). Preferred."),
    brand_name: z.string().trim().optional().describe("Brand name (case-insensitive) if id not known."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ brand_id, brand_name }) => {
    if (!brand_id && !brand_name) {
      return { content: [{ type: "text", text: "Provide brand_id or brand_name" }], isError: true };
    }
    const supabase = sb();
    let q = supabase.from("brands").select("id,name,notes,facts_updated_at,updated_at").limit(1);
    if (brand_id) q = q.eq("id", brand_id);
    else if (brand_name) q = q.ilike("name", brand_name!);
    const { data, error } = await q.maybeSingle();
    if (error || !data) {
      return { content: [{ type: "text", text: `Brand not found: ${error?.message ?? brand_id ?? brand_name}` }], isError: true };
    }
    const payload = {
      id: data.id,
      name: data.name,
      notes: data.notes ?? null,
      facts_updated_at: (data as any).facts_updated_at ?? null,
      url: `https://shoe-sherpa.com/brand/${data.id}`,
    };
    return {
      content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
      structuredContent: payload,
    };
  },
});
