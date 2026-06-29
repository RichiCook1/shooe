// Post-build prerender: writes static HTML for every public content route
// (model, brand, best/segment) into dist/. Content is injected INSIDE
// <div id="root">…</div> so crawlers see it. createRoot replaces it on hydration.
// Run via: tsx scripts/prerender.ts (npm postbuild hook).
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";

const SITE = "https://shoe-sherpa.com";
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "https://xezxeyrygwfbidcafoho.supabase.co";
const ANON = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY || "";
const DIST = resolve(process.cwd(), "dist");
const MIN_REVIEWS = 10;

if (!existsSync(DIST)) {
  console.warn("[prerender] dist/ not found, skipping");
  process.exit(0);
}

const indexHtml = readFileSync(resolve(DIST, "index.html"), "utf8");

const esc = (s: string) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

async function pg<T = any>(path: string): Promise<T[]> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: ANON, Authorization: `Bearer ${ANON}` },
  });
  if (!res.ok) {
    console.warn(`[prerender] ${path} -> ${res.status}`);
    return [];
  }
  return res.json();
}

function injectHead(html: string, headExtras: string) {
  return html.replace("</head>", `${headExtras}\n</head>`);
}
function injectRoot(html: string, bodyHtml: string) {
  // existing pattern in vite template: <div id="root"></div>
  return html.replace(
    /<div id="root">[\s\S]*?<\/div>/,
    `<div id="root">${bodyHtml}</div>`
  );
}
function writeRoute(routePath: string, html: string) {
  const out = resolve(DIST, routePath.replace(/^\//, ""), "index.html");
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, html);
}

function shoeSentence(brand: string | null, model: string, count: number, avg: number | null) {
  const name = [brand, model].filter(Boolean).join(" ");
  if (!count) return `${name} doesn't have community reviews yet — be the first to rate it.`;
  const rating = avg != null ? `averages ${Number(avg).toFixed(1)}/10` : "is rated by the community";
  return `Across ${count} verified review${count === 1 ? "" : "s"}, the ${name} ${rating}.`;
}

async function prerenderModels() {
  const models = await pg<any>(
    "models?select=id,name,image_url,category,release_year,weight_g,drop_mm,stack_height_mm,msrp,updated_at,brand:brands(id,name)"
  );
  const summaries = await pg<any>("model_summaries?select=model_id,avg_rating,review_count,summary");
  const summaryMap = new Map(summaries.map((s: any) => [s.model_id, s]));
  // pull a few reviews per model in one shot
  const reviews = await pg<any>("reviews?select=model_id,rating,content,created_at,profile:profiles(display_name,username)&order=created_at.desc&limit=2000");
  const reviewsByModel = new Map<string, any[]>();
  for (const r of reviews) {
    if (!r.model_id) continue;
    const arr = reviewsByModel.get(r.model_id) ?? [];
    if (arr.length < 5) arr.push(r);
    reviewsByModel.set(r.model_id, arr);
  }

  let count = 0;
  for (const m of models) {
    const s = summaryMap.get(m.id) as any;
    const rs = reviewsByModel.get(m.id) ?? [];
    const brandName = m.brand?.name ?? null;
    const fullName = [brandName, m.name].filter(Boolean).join(" ");
    const url = `${SITE}/model/${m.id}`;
    const reviewCount = s?.review_count ?? rs.length;
    const lead = shoeSentence(brandName, m.name, reviewCount, s?.avg_rating ?? null);
    const title = `${fullName} Review (2026) — Shoe Sherpa`;
    const desc = lead.slice(0, 158);

    const reviewsJsonLd = rs
      .filter((r) => r.content)
      .slice(0, 5)
      .map((r) => ({
        "@type": "Review",
        ...(r.rating ? { reviewRating: { "@type": "Rating", ratingValue: r.rating, bestRating: "10", worstRating: "1" } } : {}),
        author: { "@type": "Person", name: r.profile?.display_name || r.profile?.username || "Verified runner" },
        reviewBody: String(r.content).slice(0, 600),
        ...(r.created_at ? { datePublished: r.created_at.slice(0, 10) } : {}),
      }));

    const productJsonLd: any = {
      "@context": "https://schema.org",
      "@type": "Product",
      name: fullName,
      url,
      ...(brandName ? { brand: { "@type": "Brand", name: brandName } } : {}),
      ...(m.image_url ? { image: m.image_url } : {}),
      description: lead,
      ...(m.category ? { category: String(m.category).replace(/_/g, " ") } : {}),
      ...(m.msrp ? { offers: { "@type": "Offer", price: String(m.msrp), priceCurrency: "USD" } } : {}),
      ...(s?.avg_rating != null && reviewCount > 0
        ? { aggregateRating: { "@type": "AggregateRating", ratingValue: Number(s.avg_rating).toFixed(2), reviewCount, bestRating: "10", worstRating: "1" } }
        : {}),
      ...(reviewsJsonLd.length ? { review: reviewsJsonLd } : {}),
      dateModified: m.updated_at || new Date().toISOString(),
    };

    const head = `
    <title>${esc(title)}</title>
    <meta name="description" content="${esc(desc)}" />
    <link rel="canonical" href="${url}" />
    <meta property="og:title" content="${esc(title)}" />
    <meta property="og:description" content="${esc(desc)}" />
    <meta property="og:url" content="${url}" />
    <meta property="og:type" content="product" />
    ${m.image_url ? `<meta property="og:image" content="${esc(m.image_url)}" />` : ""}
    <script type="application/ld+json">${JSON.stringify(productJsonLd)}</script>`.trim();

    const specs = [
      m.category && `<li>Category: ${esc(String(m.category).replace(/_/g, " "))}</li>`,
      m.release_year && `<li>Release year: ${m.release_year}</li>`,
      m.weight_g && `<li>Weight: ${m.weight_g}g</li>`,
      m.drop_mm != null && `<li>Drop: ${m.drop_mm}mm</li>`,
      m.stack_height_mm && `<li>Stack: ${m.stack_height_mm}mm</li>`,
      m.msrp && `<li>MSRP: $${m.msrp}</li>`,
    ].filter(Boolean).join("");

    const reviewsHtml = rs
      .filter((r) => r.content)
      .map((r) => `<article><p><strong>${esc(r.profile?.display_name || r.profile?.username || "Runner")}</strong>${r.rating ? ` rated ${r.rating}/10` : ""}</p><p>${esc(String(r.content).slice(0, 800))}</p></article>`)
      .join("");

    const body = `
      <main>
        ${brandName ? `<p><a href="/brand/${m.brand?.id}">${esc(brandName)}</a></p>` : ""}
        <h1>${esc(fullName)}</h1>
        <p>${esc(lead)}</p>
        ${s?.summary ? `<p>${esc(s.summary)}</p>` : ""}
        ${specs ? `<ul>${specs}</ul>` : ""}
        <h2>Verified reviews</h2>
        ${reviewsHtml || "<p>No reviews yet for this shoe.</p>"}
        <p><small>Last updated ${(m.updated_at || new Date().toISOString()).slice(0, 10)}</small></p>
      </main>
    `;

    let html = injectHead(indexHtml, head);
    html = injectRoot(html, body);
    writeRoute(`/model/${m.id}`, html);
    count++;
  }
  console.log(`[prerender] wrote ${count} model pages`);
}

async function prerenderBrands() {
  const brands = await pg<any>("brands?select=id,name,notes,updated_at");
  const models = await pg<any>("models?select=id,name,brand_id,category,release_year,image_url");
  const byBrand = new Map<string, any[]>();
  for (const m of models) {
    const arr = byBrand.get(m.brand_id) ?? [];
    arr.push(m);
    byBrand.set(m.brand_id, arr);
  }
  let count = 0;
  for (const b of brands) {
    const list = byBrand.get(b.id) ?? [];
    const url = `${SITE}/brand/${b.id}`;
    const lead = list.length
      ? `${b.name} has ${list.length} model${list.length === 1 ? "" : "s"} reviewed by the Shoe Sherpa community.`
      : `${b.name} doesn't have community-reviewed shoes yet.`;
    const title = `${b.name} Running Shoes — Reviews & Models (2026) | Shoe Sherpa`;
    const desc = lead.slice(0, 158);

    const head = `
    <title>${esc(title)}</title>
    <meta name="description" content="${esc(desc)}" />
    <link rel="canonical" href="${url}" />
    <meta property="og:title" content="${esc(title)}" />
    <meta property="og:description" content="${esc(desc)}" />
    <meta property="og:url" content="${url}" />
    <meta property="og:type" content="website" />`.trim();

    const modelsHtml = list
      .map((m) => `<li><a href="/model/${m.id}">${esc(m.name)}</a>${m.category ? ` — ${esc(String(m.category).replace(/_/g, " "))}` : ""}${m.release_year ? ` (${m.release_year})` : ""}</li>`)
      .join("");

    const body = `
      <main>
        <h1>${esc(b.name)}</h1>
        <p>${esc(lead)}</p>
        ${b.notes ? `<p>${esc(b.notes)}</p>` : ""}
        ${modelsHtml ? `<h2>Models</h2><ul>${modelsHtml}</ul>` : ""}
        <p><small>Last updated ${(b.updated_at || new Date().toISOString()).slice(0, 10)}</small></p>
      </main>
    `;

    let html = injectHead(indexHtml, head);
    html = injectRoot(html, body);
    writeRoute(`/brand/${b.id}`, html);
    count++;
  }
  console.log(`[prerender] wrote ${count} brand pages`);
}

async function prerenderSegments() {
  const segments = await pg<any>("segments?select=slug,title,description,updated_at");
  const stats = await pg<any>(
    `model_segment_stats?select=segment_slug,model_id,avg_rating,review_count&review_count=gte.${MIN_REVIEWS}&order=avg_rating.desc`
  );
  const modelIds = Array.from(new Set(stats.map((s: any) => s.model_id)));
  let models: any[] = [];
  if (modelIds.length) {
    const inList = `(${modelIds.map((id) => `"${id}"`).join(",")})`;
    models = await pg<any>(`models?select=id,name,image_url,category,msrp,brand:brands(id,name)&id=in.${encodeURIComponent(inList)}`);
  }
  const modelMap = new Map(models.map((m) => [m.id, m]));

  let count = 0;
  for (const seg of segments) {
    const rows = stats
      .filter((s: any) => s.segment_slug === seg.slug)
      .slice(0, 5)
      .map((s: any) => ({ ...s, model: modelMap.get(s.model_id) }))
      .filter((s: any) => s.model);

    if (rows.length === 0) continue;

    const url = `${SITE}/best/${seg.slug}`;
    const top = rows[0];
    const topName = [top.model.brand?.name, top.model.name].filter(Boolean).join(" ");
    const totalReviews = rows.reduce((sum: number, r: any) => sum + (r.review_count || 0), 0);
    const lead = `Based on ${totalReviews} verified reviews from this segment, the ${topName}${top.model.msrp ? ` ($${top.model.msrp})` : ""} is the top match — reviewers rated it ${Number(top.avg_rating).toFixed(1)}/10.`;
    const title = `${seg.title} | Shoe Sherpa`;
    const desc = lead.slice(0, 158);

    const itemList: any = {
      "@context": "https://schema.org",
      "@type": "ItemList",
      name: seg.title,
      url,
      numberOfItems: rows.length,
      itemListElement: rows.map((r: any, i: number) => ({
        "@type": "ListItem",
        position: i + 1,
        url: `${SITE}/model/${r.model.id}`,
        name: [r.model.brand?.name, r.model.name].filter(Boolean).join(" "),
        ...(r.model.image_url ? { image: r.model.image_url } : {}),
      })),
    };

    const head = `
    <title>${esc(title)}</title>
    <meta name="description" content="${esc(desc)}" />
    <link rel="canonical" href="${url}" />
    <meta property="og:title" content="${esc(title)}" />
    <meta property="og:description" content="${esc(desc)}" />
    <meta property="og:url" content="${url}" />
    <meta property="og:type" content="website" />
    <script type="application/ld+json">${JSON.stringify(itemList)}</script>`.trim();

    const itemsHtml = rows
      .map((r: any, i: number) => {
        const name = [r.model.brand?.name, r.model.name].filter(Boolean).join(" ");
        const evidence = `${name} — ${r.review_count} reviews from this segment, averaging ${Number(r.avg_rating).toFixed(1)}/10.`;
        return `<li><a href="/model/${r.model.id}"><strong>${i + 1}. ${esc(name)}</strong></a><p>${esc(evidence)}</p></li>`;
      })
      .join("");

    const body = `
      <main>
        <h1>${esc(seg.title)} (2026)</h1>
        <p>${esc(lead)}</p>
        ${seg.description ? `<p>${esc(seg.description)}</p>` : ""}
        <ol>${itemsHtml}</ol>
        <p><small>Last updated ${(seg.updated_at || new Date().toISOString()).slice(0, 10)}</small></p>
      </main>
    `;

    let html = injectHead(indexHtml, head);
    html = injectRoot(html, body);
    writeRoute(`/best/${seg.slug}`, html);
    count++;
  }
  console.log(`[prerender] wrote ${count} segment pages`);
}

async function main() {
  if (!ANON) {
    console.warn("[prerender] no Supabase anon key, skipping");
    return;
  }
  await prerenderModels();
  await prerenderBrands();
  await prerenderSegments();
}

main().catch((e) => {
  console.error("[prerender] failed", e);
  process.exit(0);
});
