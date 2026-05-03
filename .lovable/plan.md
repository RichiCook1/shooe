
# Group Reviews by Shoe Model + Build a Living Shoe Catalog

Three connected pieces of work:

1. **Model pages** — every shoe gets its own URL with summary, average score, and list of reviews.
2. **Catalog seeding pipeline** — automated jobs that go online, pull real shoe brand/model data, and insert it into the DB so the autocomplete is rich from day one and stays current.
3. **Smart name validation on review submit** — when a user types a custom model, the system checks the web, fixes typos, and either auto-corrects, links to an existing model, or flags it for admin review.

---

## Part 1 — Model Pages & Search

### New route
`/model/:modelId` — renders a `Model.tsx` page showing:
- **Header**: brand logo, model name, category, key specs (weight, drop, stack, MSRP, release year), official image if available
- **Summary card**:
  - Average rating (computed from all reviews of that model)
  - Total review count
  - AI-generated "what people say" extract (2–3 sentences) summarizing common themes from the reviews
  - Top tags (most-applied tags across reviews)
- **Reviews list**: all reviews for this model, sorted by recent / top-rated / most-liked, using the existing `ReviewCard`

### How users get there
- `ReviewCard` shoe name (brand + model) becomes a clickable link → `/model/:id`
- `ReviewDetailModal` shoe header becomes clickable
- New **shoe search** entry on Feed: a search box (next to the existing user search) that queries `models` by name with brand suggestion, results link to `/model/:id`
- `FeedFilters` brand dropdown gains a sibling "Model" combobox (filtered by selected brand) that, when picked, navigates to that model's page

### Summary extract
A new edge function `model-summary` takes a `modelId`, pulls up to ~50 reviews + ratings, sends them to Lovable AI (`google/gemini-2.5-flash`) with a prompt to produce a short pros/cons-style summary. Cached in a new `model_summaries` table (`model_id`, `summary`, `avg_rating`, `review_count`, `updated_at`) and refreshed when stale (>24h) or when review count changes.

---

## Part 2 — Catalog Seeding Pipeline

Goal: populate `brands` + `models` with thousands of real entries so users almost always pick from the list instead of typing.

### Sources (layered, free first)
1. **Curated seed list** — a one-time bulk import of ~30 well-known brands (Nike, Adidas, Hoka, Asics, Brooks, Saucony, New Balance, On, Salomon, La Sportiva, Scarpa, Altra, Topo, Mizuno, Puma, Under Armour, Merrell, Inov-8, Nnormal, Norda, Speedland, Craft, Diadora, Reebok, Vibram, Five Ten, Black Diamond, Tecnica, Dynafit, Lowa, Meindl, Keen). Inserted via migration.
2. **Web scraping via Firecrawl connector** (already documented in our integrations) — for each brand, scrape the brand's "running shoes" / "trail" / "climbing" collection pages, extract model names + specs + image. Firecrawl's `scrape` with `formats: ['json']` + a schema is ideal.
3. **Perplexity connector** — fallback for "list every model released by Brand X in 2025 with weight, drop, stack, MSRP" using `sonar-pro` with a JSON schema. Useful for brands without easily-scrapable sites.
4. **Wikipedia / RunRepeat / Believe in the Run** as Firecrawl targets for review counts and specs (no auth needed).

### Edge functions
- `seed-brand-catalog` — input: `brand_id`. Fetches that brand's product pages via Firecrawl, normalizes results, upserts into `models` (dedupe by `lower(name)` + `brand_id`).
- `discover-new-shoes` — runs across all brands, focused on "new releases" (last 90 days). Uses Perplexity for "What running/trail/climbing shoes did {brand} release in {year}?".
- `enrich-model` — for a given `model_id` missing specs, fetches and fills `weight_g`, `drop_mm`, `stack_height_mm`, `msrp`, `release_year`, `image_url`.

### Scheduling
Enable `pg_cron` + `pg_net`. Two cron jobs:
- **Daily 03:00 UTC** → `discover-new-shoes` (cheap, looks for new releases only)
- **Weekly Sunday 02:00 UTC** → full sweep: iterate all brands through `seed-brand-catalog` + `enrich-model` for entries missing specs

### Admin visibility
A new `catalog_jobs` table logs each run (`job_name`, `started_at`, `finished_at`, `status`, `models_added`, `models_updated`, `errors jsonb`) so an admin can see what the routine did.

### Picture-based suggestion ("Google Lens for shoes")
The current Review flow already has a photo upload step. Add an edge function `identify-shoe-from-image`:
- Takes the uploaded image URL, sends it to Lovable AI `google/gemini-2.5-pro` (vision) with a prompt: "Identify the running/climbing shoe brand and model. Reply as JSON `{brand, model, confidence}`."
- Result is matched against `brands` + `models` (case-insensitive + fuzzy). If found, the brand/model selectors pre-fill. If brand matches but model doesn't, suggest the closest model. If neither, fall through to web validation (Part 3).
- A "Detect from photo" button on the **shoe** step triggers this; we already do something similar for shoe detection per the AI-integration memory, so this extends that flow to also cross-check the catalog.

---

## Part 3 — Smart Validation for Custom Names

When a user submits a review with `useCustomBrand` or `useCustomModel`, instead of just inserting raw text:

### Flow (server-side, new edge function `validate-shoe-name`)
Input: `{ brand: string, model: string, brandId?: uuid }`
1. **Fuzzy match** against existing `models` (Postgres trigram / `pg_trgm` similarity ≥ 0.7). If a strong match exists → return `{action: 'matched', modelId}` and the review uses that existing model.
2. **Web check** via Perplexity (`sonar`, structured output): "Does the running/climbing shoe '{brand} {model}' exist? If misspelled, what is the correct name? Return JSON `{exists: boolean, corrected_brand, corrected_model, confidence}`."
3. **Decision**:
   - `exists: true` and corrected name differs slightly → auto-correct, insert into `models`, link review. Toast: "We saved this as '{corrected}'."
   - `exists: true` exact → insert as-is.
   - `exists: false` → still create the model but mark `pending_review = true` on a new column, and insert into a new `model_review_queue` table for admin (`model_id`, `submitted_brand`, `submitted_model`, `web_check_result jsonb`, `status: pending|approved|rejected`).

### Schema additions
- `models.pending_review boolean default false`
- `models.verified boolean default false` (true for catalog-seeded entries)
- New table `model_review_queue` (admin-only RLS via `has_role(..., 'admin')`)
- Enable `pg_trgm` extension + GIN index on `lower(models.name)`

### Admin UI
A simple `/admin/models` route (admin role only) listing the queue with **Approve** / **Rename** / **Reject & merge into existing** actions. Approve → `verified = true`, `pending_review = false`. Reject & merge → updates all reviews pointing to the rejected model to point at the chosen one, then deletes the rejected model.

---

## Required Setup Before Implementation

Two connectors need to be linked to the project (we already have Lovable AI):
1. **Firecrawl** — for scraping brand websites and review sites
2. **Perplexity** — for "does this shoe exist?" checks and new-release discovery

I'll trigger the connection pickers when we move to default mode. No manual API keys needed — both are managed through the connector flow.

---

## Technical Details (for reference)

- New tables: `model_summaries`, `catalog_jobs`, `model_review_queue`
- New columns on `models`: `pending_review`, `verified`
- Enable extensions: `pg_trgm`, `pg_cron`, `pg_net`
- New edge functions: `model-summary`, `seed-brand-catalog`, `discover-new-shoes`, `enrich-model`, `identify-shoe-from-image`, `validate-shoe-name`
- New routes: `/model/:modelId`, `/admin/models`
- Modified files: `src/App.tsx` (routes), `src/pages/Review.tsx` (call validate-shoe-name on submit + "Detect from photo" enhancement), `src/components/ReviewCard.tsx` + `ReviewDetailModal.tsx` (clickable shoe name), `src/pages/Feed.tsx` + `src/components/FeedFilters.tsx` (model search/filter)
- Cron jobs registered via SQL insert (uses project URL + service key)

---

## Suggested Build Order

1. Schema + extensions + RLS (migration)
2. Connect Firecrawl + Perplexity
3. One-time seed migration with the 30 curated brands
4. `seed-brand-catalog` + `discover-new-shoes` + cron jobs
5. `validate-shoe-name` + wire into `Review.tsx` submit
6. `/model/:modelId` page + `model-summary` function
7. Model search box + clickable shoe links
8. `identify-shoe-from-image` + "Detect from photo" button
9. `/admin/models` review queue UI
