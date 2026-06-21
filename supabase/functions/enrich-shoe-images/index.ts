// Enriches shoe models with side-view product images.
// Accepts {modelId} for one shoe, or {limit} to sweep models missing images.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PREFERRED_DOMAINS = [
  "runningwarehouse.com",
  "roadrunnersports.com",
  "fleetfeet.com",
  "zappos.com",
  "dickssportinggoods.com",
  "rei.com",
];

interface Candidate {
  image_url: string;
  page_url: string | null;
  is_side_view: boolean;
  confidence: number;
}

async function firecrawlSideViewSearch(brand: string, model: string): Promise<Candidate[]> {
  const FIRECRAWL = Deno.env.get("FIRECRAWL_API_KEY");
  if (!FIRECRAWL) return [];
  const domainBoost = PREFERRED_DOMAINS.map((d) => `site:${d}`).join(" OR ");
  const query = `"${brand} ${model}" running shoe side view lateral profile product image -review -reddit -youtube`;
  try {
    const res = await fetch("https://api.firecrawl.dev/v2/search", {
      method: "POST",
      headers: { Authorization: `Bearer ${FIRECRAWL}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        query: `${query} (${domainBoost})`,
        limit: 5,
        scrapeOptions: {
          formats: [
            {
              type: "json",
              prompt:
                'Return the URL of the single best product image that shows the shoe from a pure lateral/side view (full profile, toe pointing left or right, entire shoe visible, plain or white background, no model wearing it, no angled 3/4 view, no top-down view). Also return the page URL. JSON: {"image_url": string|null, "page_url": string|null, "is_side_view": boolean, "confidence": number between 0 and 1}',
            },
          ],
        },
      }),
    });
    const data = await res.json();
    // Firecrawl v2 search returns { data: { web: [...], images: [...] } } or { data: [...] }
    let results: any[] = [];
    if (Array.isArray(data?.data)) results = data.data;
    else if (Array.isArray(data?.data?.web)) results = data.data.web;
    else if (Array.isArray(data?.web)) results = data.web;
    else if (Array.isArray(data?.data?.results)) results = data.data.results;
    if (!results.length) console.log("firecrawl no results", JSON.stringify(data).slice(0, 500));
    const cands: Candidate[] = [];
    for (const r of results) {
      const j = r?.json;
      const image = j?.image_url || r?.metadata?.ogImage;
      if (!image || typeof image !== "string" || !image.startsWith("http")) continue;
      cands.push({
        image_url: image,
        page_url: j?.page_url || r?.url || r?.metadata?.sourceURL || null,
        is_side_view: Boolean(j?.is_side_view),
        confidence: typeof j?.confidence === "number" ? j.confidence : 0.4,
      });
    }
    // Prefer is_side_view first, then by confidence
    cands.sort((a, b) => {
      if (a.is_side_view !== b.is_side_view) return a.is_side_view ? -1 : 1;
      return b.confidence - a.confidence;
    });
    return cands;
  } catch (e) {
    console.error("firecrawl search err", e);
    return [];
  }
}

async function fetchImage(url: string, referer?: string | null): Promise<{ bytes: Uint8Array; contentType: string } | { error: string }> {
  try {
    const headers: Record<string, string> = {
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
      "Accept": "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
    };
    if (referer) {
      try { headers["Referer"] = new URL(referer).origin + "/"; } catch { /* noop */ }
    }
    const r = await fetch(url, { headers, redirect: "follow" });
    if (!r.ok) return { error: `HTTP ${r.status}` };
    const ct = r.headers.get("content-type") || "image/jpeg";
    if (!ct.startsWith("image/")) return { error: `not image (${ct})` };
    const bytes = new Uint8Array(await r.arrayBuffer());
    if (bytes.byteLength < 1024) return { error: `too small (${bytes.byteLength}b)` };
    return { bytes, contentType: ct };
  } catch (e: any) {
    return { error: e?.message ?? String(e) };
  }
}

function bytesToDataUrl(bytes: Uint8Array, contentType: string): string {
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return `data:${contentType};base64,${btoa(bin)}`;
}

async function visionConfirmSideView(dataUrl: string, brand: string, model: string): Promise<boolean> {
  const LOVABLE = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE) return true;
  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: 'You verify shoe product photos. Reply with strict JSON: {"side_view": boolean, "single_shoe": boolean, "clean_background": boolean}. side_view=true only if pure lateral profile (toe points left or right, full silhouette, NOT 3/4, NOT top-down, NOT worn).' },
          { role: "user", content: [
            { type: "text", text: `Is this a clean side-view product photo of the ${brand} ${model} shoe?` },
            { type: "image_url", image_url: { url: dataUrl } },
          ] },
        ],
      }),
    });
    if (!res.ok) { console.error("vision check failed", res.status, await res.text().catch(() => "")); return true; }
    const data = await res.json();
    const text: string = data?.choices?.[0]?.message?.content ?? "";
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return false;
    const parsed = JSON.parse(match[0]);
    return Boolean(parsed.side_view && parsed.single_shoe);
  } catch (e) { console.error("vision err", e); return true; }
}

async function uploadBytes(supabase: any, modelId: string, bytes: Uint8Array, contentType: string): Promise<string | null> {
  try {
    const ext = contentType.includes("png") ? "png" : contentType.includes("webp") ? "webp" : "jpg";
    const path = `models/${modelId}.${ext}`;
    const { error } = await supabase.storage.from("shoe-photos").upload(path, bytes, { contentType, upsert: true });
    if (error) { console.error("upload err", error); return null; }
    const { data } = supabase.storage.from("shoe-photos").getPublicUrl(path);
    return data.publicUrl;
  } catch (e) { console.error("upload err", e); return null; }
}

async function logEvent(supabase: any, jobId: string | null, modelId: string | null, modelName: string | null, stage: string, status: string, message: string, data?: any) {
  if (!jobId) return;
  try {
    await supabase.from("catalog_job_events").insert({
      job_id: jobId, model_id: modelId, model_name: modelName, stage, status, message, data: data ?? null,
    });
  } catch (e) { console.error("event log err", e); }
}

async function enrichOne(supabase: any, model: any, jobId: string | null): Promise<"ok" | "failed"> {
  const brand = model.brands?.name ?? "";
  const fullName = `${brand} ${model.name}`.trim();
  await supabase.from("models").update({ image_status: "fetching" }).eq("id", model.id);
  await logEvent(supabase, jobId, model.id, fullName, "started", "info", `Processing ${fullName}`);

  const candidates = await firecrawlSideViewSearch(brand, model.name);
  await logEvent(supabase, jobId, model.id, fullName, "search_results", candidates.length ? "ok" : "warn",
    `${candidates.length} candidate(s) from Firecrawl`,
    { candidates: candidates.slice(0, 5).map((c) => ({ image_url: c.image_url, page_url: c.page_url, is_side_view: c.is_side_view, confidence: c.confidence })) });

  if (!candidates.length) {
    await supabase.from("models").update({ image_status: "failed" }).eq("id", model.id);
    await logEvent(supabase, jobId, model.id, fullName, "failed", "error", "No candidates returned by Firecrawl");
    return "failed";
  }

  let chosen: { cand: Candidate; bytes: Uint8Array; contentType: string } | null = null;
  let firstDownloaded: { cand: Candidate; bytes: Uint8Array; contentType: string } | null = null;

  for (const c of candidates.slice(0, 5)) {
    const dl = await fetchImage(c.image_url, c.page_url);
    if ("error" in dl) {
      await logEvent(supabase, jobId, model.id, fullName, "download_failed", "warn", `Could not fetch image: ${dl.error}`, { image_url: c.image_url, page_url: c.page_url });
      continue;
    }
    if (!firstDownloaded) firstDownloaded = { cand: c, bytes: dl.bytes, contentType: dl.contentType };
    const dataUrl = bytesToDataUrl(dl.bytes, dl.contentType);
    const ok = await visionConfirmSideView(dataUrl, brand, model.name);
    await logEvent(supabase, jobId, model.id, fullName, "vision_check", ok ? "ok" : "warn",
      ok ? "Vision confirmed side view" : "Vision rejected (not side view)",
      { image_url: c.image_url, page_url: c.page_url });
    if (ok) { chosen = { cand: c, bytes: dl.bytes, contentType: dl.contentType }; break; }
  }

  if (!chosen) {
    if (!firstDownloaded) {
      await supabase.from("models").update({ image_status: "failed" }).eq("id", model.id);
      await logEvent(supabase, jobId, model.id, fullName, "failed", "error", "All candidate images failed to download");
      return "failed";
    }
    chosen = firstDownloaded;
    await logEvent(supabase, jobId, model.id, fullName, "fallback", "warn", "No candidate passed vision — using first downloaded image", { image_url: chosen.cand.image_url, page_url: chosen.cand.page_url });
  }

  const stored = await uploadBytes(supabase, model.id, chosen.bytes, chosen.contentType);
  if (!stored) {
    await supabase.from("models").update({ image_status: "failed" }).eq("id", model.id);
    await logEvent(supabase, jobId, model.id, fullName, "failed", "error", "Failed to upload image to bucket", { source: chosen.cand.image_url });
    return "failed";
  }
  await supabase.from("models").update({
    image_url: stored,
    image_source_url: chosen.cand.page_url ?? chosen.cand.image_url,
    image_status: "ok",
  }).eq("id", model.id);
  await logEvent(supabase, jobId, model.id, fullName, "uploaded", "ok", "Image saved", { image_url: stored, source_url: chosen.cand.page_url ?? chosen.cand.image_url });
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
    const jobId = job?.id ?? null;

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

    await logEvent(supabase, jobId, null, null, "queue", "info", `Queued ${models.length} model(s) for enrichment`);

    for (const m of models) {
      const result = await enrichOne(supabase, m, jobId);
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

    return new Response(JSON.stringify({ ok, failed, total: models.length, jobId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error(e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

