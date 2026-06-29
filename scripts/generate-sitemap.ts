// Generates public/sitemap.xml from Supabase data at build time.
// Run via: tsx scripts/generate-sitemap.ts
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

const SITE = "https://shoe-sherpa.com";
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "https://xezxeyrygwfbidcafoho.supabase.co";
const ANON = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY || "";

async function pg<T = any>(path: string): Promise<T[]> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: ANON, Authorization: `Bearer ${ANON}` },
  });
  if (!res.ok) {
    console.warn(`[sitemap] ${path} -> ${res.status}`);
    return [];
  }
  return res.json();
}

function urlEntry(loc: string, lastmod?: string) {
  return `  <url>\n    <loc>${loc}</loc>${lastmod ? `\n    <lastmod>${lastmod.slice(0, 10)}</lastmod>` : ""}\n  </url>`;
}

async function main() {
  const today = new Date().toISOString().slice(0, 10);
  const staticUrls = ["/", "/feed", "/sherpa", "/review"].map((p) => urlEntry(`${SITE}${p}`, today));

  const models = await pg<any>("models?select=id,updated_at");
  const brands = await pg<any>("brands?select=id,updated_at");
  const segments = await pg<any>("segments?select=slug,updated_at");

  const modelUrls = models.map((m) => urlEntry(`${SITE}/model/${m.id}`, m.updated_at || today));
  const brandUrls = brands.map((b) => urlEntry(`${SITE}/brand/${b.id}`, b.updated_at || today));
  const segUrls = segments.map((s) => urlEntry(`${SITE}/best/${s.slug}`, s.updated_at || today));

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${[...staticUrls, ...modelUrls, ...brandUrls, ...segUrls].join("\n")}\n</urlset>\n`;
  const out = resolve(process.cwd(), "public/sitemap.xml");
  writeFileSync(out, xml);
  console.log(`[sitemap] wrote ${staticUrls.length + modelUrls.length + brandUrls.length + segUrls.length} urls -> ${out}`);
}

main().catch((e) => {
  console.error("[sitemap] failed", e);
  process.exit(0); // don't block build
});
