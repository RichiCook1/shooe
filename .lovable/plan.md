# Getting Shoe Sherpa cited by LLMs

You already shipped the technical foundation (prerendered pages, .md twins, MCP server, robots/llms.txt, JSON-LD). LLMs still aren't citing you for one core reason: **citation is a function of authority + uniqueness + freshness**, not just crawlability. Being crawlable makes you eligible; being *quoted* requires signals the models trust.

Here's a concrete, phased plan — ordered by impact.

## Why we're not being cited (diagnosis)

1. **No inbound authority.** Perplexity/ChatGPT rank sources partly by domain authority and by whether they show up in Google/Bing top results. A brand-new domain with ~0 backlinks is filtered out even if it has the best content.
2. **Content isn't uniquely quotable.** Aggregate sentences exist but read like every other review site. LLMs prefer sources with *proprietary data* (numbers, quotes, stats) they can't get elsewhere.
3. **Not indexed by Google/Bing yet.** Perplexity and ChatGPT Search largely re-rank Google/Bing SERPs. If you're not on page 1 for a query, you won't be cited for it.
4. **No entity presence.** LLMs cite sites they "know" — Wikipedia, Reddit, YouTube, brand sites. Shoe Sherpa isn't yet a recognized entity.
5. **Query mismatch.** Probes may be too generic ("best marathon shoes") — you can't out-rank Runner's World on those. Long-tail segment queries are winnable first.

## Phase 1 — Make what we have actually findable (this week)

**1a. Verify indexing & submit sitemap**
- Submit `sitemap.xml` to Google Search Console and Bing Webmaster Tools.
- Run URL Inspection on 5–10 top model pages; request indexing for any not indexed.
- Add Bing IndexNow ping in the deploy pipeline (one HTTP call per changed URL — instant Bing/Copilot ingestion).

**1b. Refocus citation probes to winnable queries**
- Replace generic probes ("best carbon race shoes") with long-tail segment queries you actually cover uniquely:
  - "Hoka Bondi 9 for flat feet reviews"
  - "Nike Pegasus 41 vs Brooks Ghost 16 wide feet"
  - "Best trail shoes for 50k with wide toe box"
- Add ~30 probes matching your top-reviewed models × segments.
- These are the queries where a small niche site can beat Runner's World.

**1c. Fix the "unique data" gap in prerendered HTML**
- Every model page's lead sentence should include a **number no one else has**: "Based on 47 verified runner reviews, avg 4.2/5, most-cited pro: 'plush heel', most-cited con: 'narrow toe box'."
- Add a `<blockquote>` of the single highest-rated verified review verbatim, with reviewer's gait/foot shape as attribution — LLMs love pull-quotes.
- Add a small comparison table (this model vs 2 closest siblings) on every model page — tables get quoted heavily.

## Phase 2 — Build entity + authority signals (next 2–4 weeks)

**2a. Wikipedia-adjacent presence**
- Create/claim entries on: Wikidata (Shoe Sherpa as an organization), Crunchbase, Product Hunt launch, G2/Capterra if applicable.
- These are the sources LLMs cross-reference to decide "is this a real thing?"

**2b. Reddit + YouTube distribution**
- Reddit is *the* top-cited source for both Perplexity and ChatGPT on running-shoe questions. Post genuinely helpful, non-spammy segment analyses in r/RunningShoeGeeks, r/RunningCirclejerk, r/AdvancedRunning — link to Shoe Sherpa segment pages as data source, not as a plug.
- Publish 5–10 short YouTube videos (one per top segment page) with the URL in the description. YouTube transcripts get ingested.

**2c. Cite-worthy proprietary content**
- Publish a monthly "State of Running Shoes" post using aggregated data from your DB (e.g. "Wide-foot mentions up 34% in Q2 reviews"). This is exactly the kind of statistic LLMs quote because no one else has it.
- Add an `Article` JSON-LD schema and `datePublished`/`dateModified` — freshness matters for GPT-5/Perplexity.

**2d. Get 10 real backlinks**
- Guest posts on running blogs, podcast interviews, HARO responses about running shoes, /r/running weekly threads. Aim for 10 dofollow links from DR>30 domains. This alone moves the needle more than any on-site change.

## Phase 3 — Instrument and iterate (ongoing)

**3a. Expand the probe grid**
- Add a "long-tail probe generator" in `probe-llm-citations` that auto-creates one probe per (top-50 model × top-10 segment) and runs monthly. This gives statistical signal on which queries convert.

**3b. Track SERP position alongside citation**
- Extend the LLM Visibility page with a "Google position" column (via SerpAPI) per probe query. Correlation: if you're not top 10 on Google, you won't be cited by Perplexity.

**3c. Add a "cite this" affordance**
- On each model page, add a visible "Cite this page" button that copies a formatted quote + URL. Journalists and Reddit posters actually use these, which creates natural backlinks.

## Technical work items (for build mode)

Small, concrete changes I'll ship when you approve:

1. `scripts/prerender.ts` — enrich model-page lead paragraph with top-pro/top-con phrases (extracted from reviews) and a verbatim pull-quote block.
2. `scripts/prerender.ts` — add a sibling-comparison HTML table (same category, closest stack/drop).
3. New edge function `ping-indexnow` triggered by prerender to notify Bing/Yandex of changed URLs.
4. New admin action "Seed long-tail probes" that inserts ~50 model×segment probes.
5. `src/pages/admin/LlmVisibility.tsx` — add SerpAPI Google-position column per probe.
6. New public route `/insights/:slug` for monthly data posts (Article schema, dateModified), with a starter post generated from current DB.
7. Model page "Cite this" button (copy-to-clipboard with formatted attribution).

## What I need from you

- Which phase do you want to start with? (I'd recommend Phase 1 in full + item #6 from Phase 2 — that's the highest-leverage code work.)
- Do you have a SerpAPI key already (used for Lens)? If yes I can reuse it for Google-position tracking.
- Are you willing to do the non-code work (GSC/Bing submission, Reddit posts, backlink outreach)? Without it, the code changes alone won't get you cited — they'll just make you *eligible*.
