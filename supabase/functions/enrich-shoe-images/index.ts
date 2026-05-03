// Enriches shoe models with product images. Accepts {modelId} for one shoe, or {limit} to sweep models missing images.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function findImageWithFirecrawl(brand: string, model: string, website: string | null): Promise<string | null> {
  const FIRECRAWL = Deno.env.get("FIRECRAWL_API_KEY");
  if (!FIRECRAWL) return null;
  // Use Firecrawl search for "<brand> <model> shoe" and ask for the first hero image
  try {
    const res = await fetch("https://api.firecrawl.dev/v2/search", {
      method: "POST",
      headers: { Authorization: `Bearer ${FIRECRAWL}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        query: `${brand} ${model} shoe official product image`,
        limit: 3,
        scrapeOptions: {
          formats: [
            { type: "json", prompt: 'Return the URL of the main product hero image. JSON: {"image_url": string|null}' },
          ],
        },
      }),
    });
    const data = await res.json();
    const results = data?.data ?? data?.web?.results ?? [];
    for (const r of results) {
      const url = r?.json?.image_url || r?.metadata?.ogImage;
      if (url && typeof url === "string" && url.startsWith("http")) return url;
    }
  } catch (e) {
    console.error("firecrawl search err", e);
  }
  return null;
}

async function uploadToBucket(supabase: any, modelId: string, sourceUrl: string): Promise<string | null> {
  try {
    const r = await fetch(sourceUrl);
    if (!r.ok) return null;
    const ct = r.headers.get("content-type") || "image/jpeg";
    const ext = ct.includes("png") ? "png" : ct.includes("webp") ? "webp" : "jpg";
    const buf = new Uint8Array(await r.arrayBuffer());
    const path = `models/${modelId}.${ext}`;
    const { error } = await supabase.storage.from("shoe-photos").upload(path, buf, {
      contentType: ct, upsert: true,
    });
    if (error) { console.error("upload err", error); return null; }
    const { data } = supabase.storage.from("shoe-photos").getPublicUrl(path);
    return data.publicUrl;
  } catch (e) { console.error("download/upload err", e); return null; }
}

async function enrichOne(supabase: any, model: any): Promise<"ok" | "failed"> {
  const brand = model.brands?.name ?? "";
  await supabase.from("models").update({ image_status: "fetching" }).eq("id", model.id);
  const found = await findImageWithFirecrawl(brand, model.name, model.brands?.website ?? null);
  if (!found) {
    await supabase.from("models").update({ image_status: "failed" }).eq("id", model.id);
    return "failed";
  }
  const stored = await uploadToBucket(supabase, model.id, found);
  if (!stored) {
    await supabase.from("models").update({ image_status: "failed" }).eq("id", model.id);
    return "failed";
  }
  await supabase.from("models").update({ image_url: stored, image_status: "ok" }).eq("id", model.id);
  return "ok";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const body = await req.json().catch(() => ({}));
    const { modelId, limit = 25 } = body;

    const { data: job } = await supabase.from("catalog_jobs")
      .insert({ job_name: "enrich-shoe-images", status: "running" }).select().single();

    let ok = 0, failed = 0;
    let models: any[] = [];

    if (modelId) {
      const { data } = await supabase.from("models").select("*, brands(name, website)").eq("id", modelId);
      models = data ?? [];
    } else {
      const { data } = await supabase.from("models")
        .select("*, brands(name, website)")
        .or("image_url.is.null,image_status.eq.failed")
        .neq("image_status", "fetching")
        .limit(limit);
      models = data ?? [];
    }

    for (const m of models) {
      const result = await enrichOne(supabase, m);
      if (result === "ok") ok++; else failed++;
    }

    if (job) {
      await supabase.from("catalog_jobs").update({
        status: failed ? "completed_with_errors" : "completed",
        finished_at: new Date().toISOString(),
        models_updated: ok,
        notes: `enriched ${ok} ok, ${failed} failed (of ${models.length})`,
      }).eq("id", job.id);
    }

    return new Response(JSON.stringify({ ok, failed, total: models.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error(e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
