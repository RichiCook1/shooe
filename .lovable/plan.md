## Goal

Give you a single admin page — `/admin/llm-visibility` — that answers two questions:

1. **Are AI crawlers actually fetching our pages?** (GPTBot, PerplexityBot, ClaudeBot, Google-Extended, OAI-SearchBot, ChatGPT-User, etc.)
2. **When someone asks a running-shoe question, do LLMs cite shoe-sherpa.com?**

Two independent signals, one dashboard.

---

## Part 1 — AI crawler hit log (passive)

**How it works:** every request to the site goes through Vite in dev / the static host in prod. We can't intercept static hits at that layer, so instead we add a tiny **client-side beacon** that fires only when the User-Agent matches a known AI bot pattern *and* JS runs (some AI crawlers do execute JS — Google-Extended, ChatGPT-User, PerplexityBot on preview fetches). For non-JS crawlers, we lean on the MCP server and edge functions where we *do* control the runtime.

Realistically the strongest signal is: **log every hit to the MCP endpoint, the `.md` twins served through an edge function, and any prerendered page beacon**.

Concrete pieces:
- New table `llm_crawler_hits` (ts, user_agent, bot_name, path, referer, ip_hash, source: 'mcp'|'beacon'|'md').
- Wrap the `mcp` edge function to insert one row per call (tool name + args go in metadata).
- New edge function `md-proxy` that serves the `.md` twins from `dist/` (or from Supabase Storage) and logs the hit with UA parsing. Update `llms.txt` + sitemap to point `.md` URLs at `/functions/v1/md-proxy?path=...` (or add a simple rewrite).
- Add a `<script>` beacon in `index.html` that POSTs `{ua, path}` to a `log-crawler-hit` edge function only when `navigator.userAgent` matches the bot regex. Cheap, no PII beyond hashed IP.

Dashboard view:
- Table of hits (bot, path, time, count).
- Chart: hits per bot per day (last 30d).
- Top pages crawled.
- "Last seen" per bot.

## Part 2 — Citation probes (active)

Weekly cron edge function `probe-llm-citations` that runs a curated list of ~30 questions (stored in a new `citation_probes` table) through Perplexity's API (we already have `PERPLEXITY_API_KEY`) and records whether `shoe-sherpa.com` appears in the returned `citations[]`.

- Table `citation_probe_runs`: probe_id, run_at, model, answer_text, cited_urls (jsonb), was_cited (bool), position (int|null).
- Seed probes: "best marathon shoes for wide feet", "how is the Nike Pegasus 41", "trail shoes under 100km", etc. — editable in the admin UI.
- Cron: weekly via `pg_cron` + `pg_net` calling the edge function.
- Optional: also probe **OpenAI web-search** (`gpt-4o-search-preview` via Lovable AI gateway) and ChatGPT-shared results. Skip Claude / Google AI Overviews for v1 — no public citation API.

Dashboard view:
- Citation rate over time (% of probes citing us, weekly).
- Per-probe history: green tick when cited, red X when not, with the answer text expandable.
- "New citations this week" and "Lost citations" callouts.
- Button to run a probe on-demand.

## Part 3 — Manual check helpers (in the same page)

A small "Manual checks" card listing one-click links that open pre-filled prompts in each LLM:
- Perplexity share URL with `?q=best+trail+shoes+2026`
- ChatGPT `https://chat.openai.com/?q=...`
- Google AI Mode URL
- Claude — no URL param, just instructions.

Plus the exact Google Search Console filter to see impressions from AI Overviews (`Search appearance = AI Overviews`), noted in a tooltip.

---

## Technical details

**Files:**
- Migration: `llm_crawler_hits`, `citation_probes`, `citation_probe_runs` tables + RLS (admin-only read, service-role write) + GRANTs.
- Edge functions:
  - `log-crawler-hit` — public POST, hashes IP, parses UA, inserts row.
  - `probe-llm-citations` — service-role, iterates probes, calls Perplexity, stores runs.
  - `md-proxy` (optional) — serves `.md` twins + logs; skip if we can't easily route around the static host.
  - Modify `supabase/functions/mcp/index.ts` to log each call.
- Cron: `pg_cron` job calling `probe-llm-citations` weekly (Sundays 03:00 UTC).
- Frontend:
  - `src/pages/admin/LlmVisibility.tsx` — three sections (Crawler hits, Citation probes, Manual checks).
  - Add nav entry in `src/components/admin/AdminSidebar.tsx`.
  - Add beacon `<script>` in `index.html` (bot-UA regex only).

**Bot UA regex (single source of truth, used by beacon + parser):**
`/(GPTBot|OAI-SearchBot|ChatGPT-User|PerplexityBot|Perplexity-User|ClaudeBot|Claude-Web|Anthropic-AI|Google-Extended|Googlebot|Bingbot|CCBot|YouBot|Applebot-Extended|Amazonbot|meta-externalagent)/i`

**Cost:** Perplexity probes are ~$0.005/query — 30 probes/week ≈ $0.60/month. Negligible.

**Not in scope:**
- Historical data before we ship this (we have none).
- ChatGPT / Claude direct citation tracking (no API for their web answers). Perplexity + Google are the practical proxies.
- Google Search Console API integration — the manual link is enough for v1.

---

Reply **approve** to build it, or say which parts to drop / add.