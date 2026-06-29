## Goal
Make Shoe Sherpa's public content visible to search engines and AI crawlers (ChatGPT, Perplexity, Claude, Gemini, Google AI Overviews) without rebuilding the SPA or resetting the database.

## Approach
Build-time **prerendering** of public routes — the SPA stays, but every public URL ships full HTML (review content, aggregate sentences, JSON-LD) before JavaScript runs. Plus a new `/best/[segment]` page family backed by a curated list of high-value segment combos.

---

## 1. Prerendering pipeline (foundation)

- Add a Node script `scripts/prerender.ts` run as a `postbuild` step.
- After Vite builds, the script:
  1. Reads `dist/index.html` as the shell.
  2. Fetches data from Supabase via the anon client for: all published `models`, all `brands`, the curated segment list, and the homepage feed snapshot.
  3. For each route, renders a static HTML body server-side (no React DOM render — a plain string template using the fetched data) and writes `dist/model/<id>/index.html`, `dist/brand/<id>/index.html`, `dist/best/<slug>/index.html`, etc.
  4. Each generated file contains the full review text, aggregate sentence, JSON-LD, `<link rel="canonical">`, `Last updated` date, and the same `<div id="root">` + script tags so React hydrates normally for users.
- The static body lives inside `<div id="root">…prerendered HTML…</div>`. React replaces it on hydration; crawlers + JS-off users see it directly.
- Routes prerendered: `/`, `/feed`, `/model/:id`, `/brand/:id`, `/best/:slug`. Auth-only routes (`/profile`, `/messages`, `/admin/*`, `/review`) are skipped.
- Interactive `/sherpa` advisor stays client-only as you requested.

**Verification:** `curl https://shoe-sherpa.com/model/<id>` returns review text and JSON-LD.

## 2. Schema additions (additive, no data loss)

Add nullable columns to `reviews` if missing: `gait`, `foot_shape`, `arch`, `terrain`, `distance_focus`, `goal`, `weight_band`, `injury_history`, `verified` (bool), `race_seeded` (bool). All default null/false — existing rows untouched.

Add a SQL view `model_segment_stats` returning `(model_id, segment_key, review_count, avg_rating, top_attribute)` for any (shoe × segment) with ≥10 reviews. Used by segment pages.

Add a `segments` table seeded with the curated 20–40 combos (slug, title, filter JSON, description). Editable later from admin.

## 3. Answer-first shoe pages

Update `src/pages/Model.tsx` so the first rendered block is a one-sentence verdict built from `model_summaries` + review count + top tag, e.g. *"Across 128 verified reviews, the Nike Pegasus 41 averages 4.3/5, rated strongest for daily training by neutral runners."* This sentence is plain `<p>` text (not inside a chart), so the prerender script captures it.

Add `Last updated <date>` visible footer + `dateModified` in JSON-LD.

JSON-LD (`Product` + `AggregateRating` + up to 5 `Review` nodes) injected via `react-helmet-async` AND mirrored into the prerendered HTML.

## 4. Segment pages — `/best/:slug`

New route + page `src/pages/BestFor.tsx`. Loads `segments` row + ranked top 3–5 models from `model_segment_stats`. Renders:
- H1 *"Best [category] for [need] (2026)"*
- Lead quotable sentence with N + price + score + attribute
- Ranked list, each shoe linking to `/model/:id` with its own evidence sentence
- Cross-links to related segments
- `ItemList` JSON-LD

Curated seed list of ~30 combos written as a migration insert (we can edit/extend later from admin).

## 5. Crawl files + freshness

- `public/robots.txt`: explicit `Allow: /` blocks for GPTBot, OAI-SearchBot, ChatGPT-User, PerplexityBot, ClaudeBot, Claude-Web, Google-Extended, Googlebot, Bingbot + `Sitemap:` directive.
- `scripts/generate-sitemap.ts` (run in `prebuild`): pulls every model, brand, segment from Supabase with `lastmod` from `updated_at`.
- `public/llms.txt`: short list of section categories with one-line descriptions.
- Canonicals self-referencing per page, no trailing slashes.
- `react-helmet-async` wired in `main.tsx` for per-route title/description/canonical.

---

## Technical details

**Stack stays:** Vite + React Router + Supabase. No framework migration.

**New files:**
- `scripts/prerender.ts` — postbuild static HTML generator (uses Supabase anon client)
- `scripts/generate-sitemap.ts` — prebuild sitemap generator
- `src/pages/BestFor.tsx` — segment page
- `src/lib/segmentStats.ts` — shared aggregate-sentence builder (used by both prerender script and the React page so output matches)
- `src/lib/jsonld.ts` — JSON-LD builders
- `public/llms.txt`, updated `public/robots.txt`

**Edited files:**
- `package.json` — `postbuild`/`prebuild` scripts, add `react-helmet-async`
- `src/main.tsx` — `HelmetProvider`
- `src/App.tsx` — add `/best/:slug` route
- `src/pages/Model.tsx`, `src/pages/Brand.tsx`, `src/pages/Index.tsx` — answer-first lead, Helmet tags, "Last updated"

**Migrations:**
1. Add columns to `reviews` (all nullable, no defaults that touch existing rows)
2. Create `segments` table + GRANTs + RLS (public select, admin write)
3. Create `model_segment_stats` view + GRANT select to anon
4. Seed `segments` with ~30 curated combos

**Hydration safety:** The prerender uses the same component output shape React produces on hydration to avoid mismatch warnings. Pure data-driven sections only — no `Date.now()` etc.

---

## Build order

1. Migrations: columns, view, segments table + seed.
2. `react-helmet-async` + per-route head, answer-first leads, JSON-LD.
3. `/best/:slug` route + page.
4. `scripts/prerender.ts` postbuild.
5. `scripts/generate-sitemap.ts` prebuild, `robots.txt`, `llms.txt`.
6. Verify `curl` on a built page shows review content + JSON-LD.

## Out of scope (flagged for later)

- Full TanStack Start / Next.js migration (option C) — separate project when you're ready.
- Re-collecting segmentation data on existing reviews. New columns will fill as new reviews arrive; old reviews stay as-is.
- Admin UI for editing the `segments` table — can add later; seed is editable via SQL for now.

Reply with **approve** to start, or call out anything to change.