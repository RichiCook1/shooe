// Post-build prerender: writes static HTML AND markdown twins for every
// public content route (model, brand, best/segment) into dist/. HTML content
// is injected INSIDE <div id="root">…</div> so crawlers see it. createRoot
// replaces it on hydration. Markdown files are written to dist/<path>.md and
// serve as clean, agent-friendly copies of the same data.
// Run via: tsx scripts/prerender.ts (npm postbuild hook).
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";

const SITE = "https://shoe-sherpa.com";
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "https://xezxeyrygwfbidcafoho.supabase.co";
const ANON = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY || "";
const DIST = resolve(process.cwd(), "dist");
const MIN_REVIEWS = 10;
const PAGE_SIZE = 1000;

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

async function pg<T = any>(path: string, rangeStart?: number, rangeEnd?: number): Promise<T[]> {
  const headers: Record<string, string> = { apikey: ANON, Authorization: `Bearer ${ANON}` };
  if (rangeStart != null && rangeEnd != null) {
    headers["Range-Unit"] = "items";
    headers["Range"] = `${rangeStart}-${rangeEnd}`;
  }
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers });
  if (!res.ok) {
    console.warn(`[prerender] ${path} -> ${res.status}`);
    return [];
  }
  return res.json();
}

// Fetch ALL rows for a query by paging through with Range headers.
async function pgAll<T = any>(path: string): Promise<T[]> {
  const out: T[] = [];
  let start = 0;
  for (;;) {
    const batch = await pg<T>(path, start, start + PAGE_SIZE - 1);
    if (!batch.length) break;
    out.push(...batch);
    if (batch.length < PAGE_SIZE) break;
    start += PAGE_SIZE;
  }
  return out;
}

function injectHead(html: string, headExtras: string) {
  return html.replace("</head>", `${headExtras}\n</head>`);
}
function injectRoot(html: string, bodyHtml: string) {
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
function writeFile(relPath: string, content: string) {
  const out = resolve(DIST, relPath.replace(/^\//, ""));
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, content);
}

function shoeSentence(
  brand: string | null,
  model: string,
  count: number,
  avg: number | null,
  topPro?: string | null,
  topCon?: string | null,
) {
  const name = [brand, model].filter(Boolean).join(" ");
  if (!count) return `${name} doesn't have community reviews yet — be the first to rate it.`;
  const rating = avg != null ? `averages ${Number(avg).toFixed(1)}/10` : "is rated by the community";
  const tail =
    topPro && topCon
      ? ` Most-cited pro: "${topPro}". Most-cited con: "${topCon}".`
      : topPro
        ? ` Most-cited pro: "${topPro}".`
        : "";
  return `Across ${count} verified review${count === 1 ? "" : "s"}, the ${name} ${rating}.${tail}`;
}

// Lightweight phrase-frequency extraction from review bodies. Not perfect —
// picks the most common 2-3 word noun-ish phrases after stopword removal.
const STOP = new Set(("the a an of and or but if to in on for with is are was were be been being " +
  "this that these those i you he she it we they me him her us them my your his its our their " +
  "not no yes so then just very really too much more most less least all some any each every " +
  "have has had do does did will would could should can may might must about after before " +
  "from into over under between while during than then also feel felt feels shoe shoes running run runs " +
  "wear wore worn get got gets pair pairs mile miles km kms one two three four five ")
  .split(/\s+/));

function extractPhrases(texts: string[], n = 3): string[] {
  const counts = new Map<string, number>();
  for (const t of texts) {
    const words = String(t).toLowerCase().replace(/[^a-z\s]/g, " ").split(/\s+/).filter(Boolean);
    for (let i = 0; i < words.length - 1; i++) {
      const w1 = words[i], w2 = words[i + 1];
      if (STOP.has(w1) || STOP.has(w2)) continue;
      if (w1.length < 3 || w2.length < 3) continue;
      const bigram = `${w1} ${w2}`;
      counts.set(bigram, (counts.get(bigram) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .filter(([, c]) => c >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([p]) => p);
}

async function prerenderModels() {
  const models = await pgAll<any>(
    "models?select=id,name,image_url,category,release_year,weight_g,drop_mm,stack_height_mm,msrp,updated_at,brand:brands(id,name)"
  );
  const summaries = await pgAll<any>("model_summaries?select=model_id,avg_rating,review_count,summary");
  const summaryMap = new Map(summaries.map((s: any) => [s.model_id, s]));

  // Pull EVERY review, paginated (was capped at 2000 before).
  const reviews = await pgAll<any>(
    "reviews?select=model_id,rating,content,created_at,profile:profiles(display_name,username)&order=created_at.desc"
  );
  const reviewsByModel = new Map<string, any[]>();
  for (const r of reviews) {
    if (!r.model_id) continue;
    const arr = reviewsByModel.get(r.model_id) ?? [];
    arr.push(r);
    reviewsByModel.set(r.model_id, arr);
  }

  const modelIndex: Array<{ id: string; name: string; brand: string | null; count: number }> = [];
  let count = 0;
  for (const m of models) {
    const s = summaryMap.get(m.id) as any;
    const rs = reviewsByModel.get(m.id) ?? [];
    const brandName = m.brand?.name ?? null;
    const fullName = [brandName, m.name].filter(Boolean).join(" ");
    const url = `${SITE}/model/${m.id}`;
    const reviewCount = s?.review_count ?? rs.length;

    // Extract top phrases from positive vs negative reviews for the lead.
    const positives = rs.filter((r: any) => r.content && (r.rating ?? 0) >= 7);
    const negatives = rs.filter((r: any) => r.content && (r.rating ?? 0) > 0 && (r.rating ?? 0) < 6);
    const topPros = extractPhrases(positives.map((r: any) => r.content));
    const topCons = extractPhrases(negatives.map((r: any) => r.content));
    const topPro = topPros[0] ?? null;
    const topCon = topCons[0] ?? null;

    const lead = shoeSentence(brandName, m.name, reviewCount, s?.avg_rating ?? null, topPro, topCon);
    const title = `${fullName} Review (2026) — Shoe Sherpa`;
    const desc = lead.slice(0, 158);

    // Pull-quote: highest-rated verified review with real text.
    const pullQuote = [...rs]
      .filter((r: any) => r.content && String(r.content).trim().length >= 40)
      .sort((a: any, b: any) => (b.rating ?? 0) - (a.rating ?? 0))[0];

    modelIndex.push({ id: m.id, name: fullName, brand: brandName, count: reviewCount });

    // JSON-LD keeps 5-review cap (Google warns above that); visible HTML ships ALL reviews.
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
    <link rel="alternate" type="text/markdown" href="${url}.md" />
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

    // ALL reviews in visible HTML (no slice).
    const reviewsHtml = rs
      .filter((r) => r.content)
      .map((r) => {
        const author = esc(r.profile?.display_name || r.profile?.username || "Runner");
        const rating = r.rating ? ` rated ${r.rating}/10` : "";
        const date = r.created_at ? ` on ${r.created_at.slice(0, 10)}` : "";
        return `<article class="review"><p><strong>${author}</strong>${rating}${date}</p><p>${esc(String(r.content))}</p></article>`;
      })
      .join("");

    const body = `
      <main>
        ${brandName ? `<p><a href="/brand/${m.brand?.id}">${esc(brandName)}</a></p>` : ""}
        <h1>${esc(fullName)}</h1>
        <p>${esc(lead)}</p>
        ${s?.summary ? `<p>${esc(s.summary)}</p>` : ""}
        ${specs ? `<ul>${specs}</ul>` : ""}
        <h2>Verified reviews (${rs.filter((r) => r.content).length})</h2>
        ${reviewsHtml || "<p>No reviews yet for this shoe.</p>"}
        <p><small>Last updated ${(m.updated_at || new Date().toISOString()).slice(0, 10)}</small></p>
      </main>
    `;

    let html = injectHead(indexHtml, head);
    html = injectRoot(html, body);
    writeRoute(`/model/${m.id}`, html);

    // Markdown twin at /model/<id>.md
    const specLines = [
      m.category && `- Category: ${String(m.category).replace(/_/g, " ")}`,
      m.release_year && `- Release year: ${m.release_year}`,
      m.weight_g && `- Weight: ${m.weight_g}g`,
      m.drop_mm != null && `- Drop: ${m.drop_mm}mm`,
      m.stack_height_mm && `- Stack: ${m.stack_height_mm}mm`,
      m.msrp && `- MSRP: $${m.msrp}`,
    ].filter(Boolean).join("\n");

    const reviewsMd = rs
      .filter((r) => r.content)
      .map((r) => {
        const author = r.profile?.display_name || r.profile?.username || "Runner";
        const rating = r.rating ? ` — ${r.rating}/10` : "";
        const date = r.created_at ? ` (${r.created_at.slice(0, 10)})` : "";
        return `### ${author}${rating}${date}\n\n${String(r.content).trim()}`;
      })
      .join("\n\n---\n\n");

    const md = [
      `# ${fullName}`,
      "",
      lead,
      "",
      s?.summary ? `${s.summary}\n` : "",
      specLines ? `## Specs\n\n${specLines}\n` : "",
      `## Verified reviews (${rs.filter((r) => r.content).length})`,
      "",
      reviewsMd || "_No reviews yet for this shoe._",
      "",
      `---`,
      `Source: ${url}`,
      `Last updated: ${(m.updated_at || new Date().toISOString()).slice(0, 10)}`,
      "",
    ].join("\n");
    writeFile(`/model/${m.id}.md`, md);

    count++;
  }
  console.log(`[prerender] wrote ${count} model pages (+ .md twins)`);

  // /models.md — flat index for agents.
  const indexMd = [
    `# Shoe Sherpa — Model Index`,
    "",
    `Every reviewed running shoe in the Shoe Sherpa catalog. Markdown twins live at \`/model/<id>.md\`.`,
    "",
    `Total models: ${modelIndex.length}`,
    "",
    ...modelIndex
      .sort((a, b) => b.count - a.count)
      .map((m) => `- [${m.name}](${SITE}/model/${m.id}.md) — ${m.count} review${m.count === 1 ? "" : "s"}`),
    "",
  ].join("\n");
  writeFile(`/models.md`, indexMd);
  console.log(`[prerender] wrote /models.md index (${modelIndex.length} models)`);
}

async function prerenderBrands() {
  const brands = await pgAll<any>("brands?select=id,name,notes,updated_at");
  const models = await pgAll<any>("models?select=id,name,brand_id,category,release_year,image_url");
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
    <link rel="alternate" type="text/markdown" href="${url}.md" />
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

    // Markdown twin
    const md = [
      `# ${b.name}`,
      "",
      lead,
      "",
      b.notes ? `${b.notes}\n` : "",
      list.length ? `## Models\n\n${list.map((m) => `- [${m.name}](${SITE}/model/${m.id}.md)${m.category ? ` — ${String(m.category).replace(/_/g, " ")}` : ""}${m.release_year ? ` (${m.release_year})` : ""}`).join("\n")}\n` : "",
      `---`,
      `Source: ${url}`,
      `Last updated: ${(b.updated_at || new Date().toISOString()).slice(0, 10)}`,
      "",
    ].join("\n");
    writeFile(`/brand/${b.id}.md`, md);

    count++;
  }
  console.log(`[prerender] wrote ${count} brand pages (+ .md twins)`);
}

async function prerenderSegments() {
  const segments = await pgAll<any>("segments?select=slug,title,description,updated_at");
  const stats = await pgAll<any>(
    `model_segment_stats?select=segment_slug,model_id,avg_rating,review_count&review_count=gte.${MIN_REVIEWS}&order=avg_rating.desc`
  );
  const modelIds = Array.from(new Set(stats.map((s: any) => s.model_id)));
  let models: any[] = [];
  if (modelIds.length) {
    const inList = `(${modelIds.map((id) => `"${id}"`).join(",")})`;
    models = await pgAll<any>(`models?select=id,name,image_url,category,msrp,brand:brands(id,name)&id=in.${encodeURIComponent(inList)}`);
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
    <link rel="alternate" type="text/markdown" href="${url}.md" />
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

    // Markdown twin
    const md = [
      `# ${seg.title} (2026)`,
      "",
      lead,
      "",
      seg.description ? `${seg.description}\n` : "",
      `## Ranked shortlist`,
      "",
      ...rows.map((r: any, i: number) => {
        const name = [r.model.brand?.name, r.model.name].filter(Boolean).join(" ");
        return `${i + 1}. **[${name}](${SITE}/model/${r.model.id}.md)** — ${r.review_count} reviews, ${Number(r.avg_rating).toFixed(1)}/10${r.model.msrp ? `, $${r.model.msrp}` : ""}`;
      }),
      "",
      `---`,
      `Source: ${url}`,
      `Last updated: ${(seg.updated_at || new Date().toISOString()).slice(0, 10)}`,
      "",
    ].join("\n");
    writeFile(`/best/${seg.slug}.md`, md);

    count++;
  }
  console.log(`[prerender] wrote ${count} segment pages (+ .md twins)`);
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
