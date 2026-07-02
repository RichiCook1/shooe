## Goal
Maximize how much of Shoe Sherpa's review corpus LLMs (ChatGPT, Perplexity, Claude, Google AI Overviews, agentic clients) can actually ingest and cite. Three complementary channels: fatter static HTML, machine-friendly markdown dumps, and a live MCP server for tool-using agents.

---

## 1. Prerender all reviews per model (not just 5)

Currently `scripts/prerender.ts` embeds up to 5 reviews per model in JSON-LD + visible HTML. Change it so **every review** ships in the static HTML for `/model/:id`.

- Drop the `limit: 2000` global fetch; page through `reviews` in batches of 1000 keyed by `model_id` so every published review is included.
- HTML body: render all reviews as a list (author, rating, date, full text) below the aggregate lead. Long pages are fine — crawlers prefer one deep URL over pagination.
- JSON-LD stays capped at 5 `Review` nodes (schema.org convention — more triggers Google warnings), but the full set lives in the visible `<article>` block so LLMs still see it.
- Same treatment for `/brand/:id`: include all models with their aggregate sentences.

**Verification:** `curl https://shoe-sherpa.com/model/<id> | grep -c '<article class="review"'` returns the full review count.

## 2. Per-model markdown dump at `/model/:id.md`

Perplexity, Claude web-fetch, and many agent tools prefer clean markdown over parsing HTML. Ship a plaintext-markdown twin of every prerendered page.

- Extend `scripts/prerender.ts` to also write `dist/model/<id>.md`, `dist/brand/<id>.md`, `dist/best/<slug>.md`.
- Content per model: H1 name, aggregate sentence, spec table, then every review as `### <author> — <rating>/10` followed by the body.
- Add a `/models.md` index listing every model with its markdown URL, so an LLM given `https://shoe-sherpa.com/models.md` can crawl the whole catalog cheaply.
- Update `public/llms.txt` to advertise the `.md` variants and `/models.md` index.
- Update `robots.txt` to explicitly allow `.md` (no change needed for `*` but note it).
- Sitemap: add the `.md` URLs alongside the HTML URLs.

**Verification:** `curl https://shoe-sherpa.com/model/<id>.md` returns markdown, not HTML.

## 3. MCP server exposing the review corpus

Build a Model Context Protocol server so tool-using agents (Claude Desktop, ChatGPT with connectors, Cursor, etc.) can query the review database live instead of scraping.

Use `@lovable.dev/mcp-js` — authored in `src/lib/mcp/`, auto-bundled into a Supabase edge function at `/functions/v1/mcp`. Public (no auth) since all data is already public.

**Tools exposed:**
- `search_models({ query, category?, brand? })` → list of matching models with id, name, brand, avg rating, review count.
- `get_model({ model_id })` → full spec sheet + aggregate + up to 20 reviews.
- `list_reviews({ model_id, limit?, offset? })` → paginate all reviews for a model.
- `best_for({ segment_slug })` → ranked shortlist from `model_segment_stats`.
- `get_brand_facts({ brand_id })` → verified brand notes (same source Sherpa uses).

Each tool reads from Supabase via the service role (server-side only, read-only queries). No user-scoped data.

**Discovery:** add the MCP URL to `llms.txt` and a `<link rel="mcp">` tag pointing at the endpoint so agents can auto-discover it.

**Verification:** connect the endpoint from Claude Desktop, call `search_models({ query: "pegasus" })`, confirm it returns rows.

---

## Technical details

**Files touched:**
- `scripts/prerender.ts` — remove per-fetch cap, page through reviews, emit `.md` twins.
- `public/llms.txt` — add markdown index + MCP URL.
- `public/robots.txt` — no functional change; add comment documenting `.md` variants.
- `scripts/generate-sitemap.ts` — add `.md` URLs.
- `src/lib/mcp/index.ts` — `defineMcp` entry.
- `src/lib/mcp/tools/*.ts` — one file per tool.
- `vite.config.ts` — add `mcpPlugin()`.
- `index.html` — add `<link rel="mcp" href="…/functions/v1/mcp">`.

**No schema changes.** All three channels read from existing `models`, `brands`, `reviews`, `model_summaries`, `model_segment_stats`, `segments`.

**Build order:**
1. Prerender changes + markdown dumps (biggest immediate LLM win, no infra).
2. Sitemap + llms.txt updates.
3. MCP server + edge function deploy.
4. Verify with `curl` and one MCP client.

**Out of scope:**
- Per-review permalinks (`/review/:id`) — could add later if you want individual reviews indexed as their own pages.
- OAuth on MCP — everything exposed is already public, no need.
- Real-time updates: prerender runs at build time; new reviews appear on next deploy. If you want faster freshness, we can add a nightly redeploy cron separately.

Reply **approve** to start, or call out anything to adjust.