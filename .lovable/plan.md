
# Shoe Catalog System — Plan

## What already exists

- `brands` + `models` tables, with `verified`, `pending_review`, `source`, `image_url` columns.
- `model_review_queue` for user-submitted names that fail verification.
- Edge functions:
  - `seed-brand-catalog` — scrapes one brand (Firecrawl + Perplexity fallback).
  - `discover-new-shoes` — sweeps all brands for current-year releases (Perplexity).
  - `validate-shoe-name` — fuzzy-matches user input, falls back to Perplexity, queues unknowns.
  - `identify-shoe-from-image` — vision model returns `{brand, model, confidence}` and matches catalog.
- Admin pages `/admin/catalog` and `/admin/queue` (manual triggers, approve/reject).

The pipeline is in place but: there is no schedule, no brand seed list, no shoe image enrichment, no Google-Lens-style suggestion in the review flow, and no visibility into catalog coverage / job history.

## Gaps to fill

### 1. Seed the brand list
Currently `brands` is whatever users typed. Insert a curated starter list (~50 brands) covering road / trail / racing / climbing / hiking / hiking boots, each with `website` so `seed-brand-catalog` can scrape them.

Brands: Nike, Adidas, Asics, Hoka, Saucony, Brooks, New Balance, On, Mizuno, Puma, Altra, Topo Athletic, Salomon, La Sportiva, Scarpa, Merrell, Inov-8, Norda, NNormal, Speedland, Craft, Vibram, Decathlon Kiprun, Mount To Coast, Tecnica, Lowa, Meindl, Hanwag, Arc'teryx, Five Ten, Black Diamond, Evolv, Tenaya, Boreal, Mad Rock, Unparallel, Butora, So iLL, etc.

### 2. Schedule the discovery jobs (cron)
Enable `pg_cron` + `pg_net` and schedule:
- **Weekly** — `discover-new-shoes` (current year + previous year), batched 10 brands per run.
- **Monthly** — `seed-brand-catalog` rotating through all brands (one per minute) to refresh full catalogs.
Each invocation already logs to `catalog_jobs`.

### 3. Enrich shoe images
New edge function `enrich-shoe-image`:
- Input: `modelId` (or run for all `image_url IS NULL`).
- Uses Firecrawl to scrape the brand site for the model name and pull the product hero image, falling back to a Perplexity image-URL lookup.
- Downloads, uploads to `shoe-photos` bucket (public), saves URL to `models.image_url`.
- Triggered: (a) automatically after `validate-shoe-name` approves a model, (b) by a nightly cron sweep over models missing images, (c) manually from admin Catalog row.

### 4. Image-based suggestion in the review flow
`identify-shoe-from-image` already exists; wire it into `Review.tsx`:
- When the user adds the first photo, call the function in the background.
- If `confidence >= 0.6` and a `modelMatch` exists → pre-select the shoe and show a "Detected: Brand Model — change?" chip.
- If only `brandMatch` exists → pre-select brand and surface model suggestion text.
- If no match but high confidence → prefill the custom-name inputs and let `validate-shoe-name` take over on submit.

### 5. Admin "Catalog Health" page
New route `/admin/catalog/health` (or add a tab to existing Catalog page):
- Stats: total brands, total models, % verified, % with image, models added last 7/30 days.
- `catalog_jobs` history table with status, counts, errors, duration.
- Buttons: "Run discovery now", "Run image enrichment now", "Seed brand X" (per-brand action with progress).
- Filter on Models table: `unverified`, `missing image`, `pending review`, `source=user_submitted`.
- Bulk actions: verify selected, delete selected, enrich images for selected.

### 6. Improve `validate-shoe-name`
- Replace substring fuzzy match with Postgres `pg_trgm` similarity (extension is already installed) for real typo tolerance.
- After successful creation, fire-and-forget call to `enrich-shoe-image` for the new model.
- When queueing, also create a `notifications` row for every admin user so they see new pending submissions in the bell.

## Technical changes

### Migration
- Insert curated brand list (idempotent on `name`).
- Enable `pg_cron`, `pg_net`.
- Schedule the two cron jobs (weekly / monthly).
- Add column `models.image_status` enum (`none|fetching|ok|failed`) for enrichment tracking.

### Edge functions
- New: `enrich-shoe-image` (Firecrawl scrape → upload to `shoe-photos` → update `models`).
- Edit: `validate-shoe-name` (trigram match, post-create enrichment, admin notifications).
- Edit: `discover-new-shoes` (accept `offset` param so cron can rotate through all brands instead of `limit` cap).

### Frontend
- `src/pages/Review.tsx` — call `identify-shoe-from-image` on first photo; show a "Detected" badge with one-tap accept.
- `src/components/ReviewCard.tsx` (and any model display) — fall back to `models.image_url` when the user uploaded no media.
- `src/pages/admin/Catalog.tsx` — add filters (unverified / missing image / pending), bulk actions, per-row "Enrich image" button, and a "Catalog Health" stats header with `catalog_jobs` history list.
- `src/pages/admin/Queue.tsx` — show suggested image when present.

## Out of scope (explicit)
- True reverse-image-search across the whole web (would need SerpAPI/Bing Visual Search and a paid plan). The vision-model approach in step 4 already handles "Google Lens-style" suggestion well enough for v1.
- Multi-angle / colorway-level image variants.
