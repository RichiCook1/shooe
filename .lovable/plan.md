# Group Reviews by Model + Build a Living Shoe Catalog

Schema is already in place (`model_summaries`, `catalog_jobs`, `model_review_queue`, `models.verified/pending_review`, `pg_trgm`). This plan builds the features on top.

---

## Part 1 — Model Pages & Search

**New route `/model/:modelId`** showing:
- Header: brand, model name, category, specs (weight, drop, stack, MSRP, year), image
- Summary card: average rating, review count, AI-generated 2–3 sentence "what people say" extract, top tags
- Reviews list: every review for that model, sortable by recent / top-rated / most-liked, reusing `ReviewCard`

**How users reach it**:
- Shoe name in `ReviewCard` and `ReviewDetailModal` becomes a clickable link
- New shoe search box on Feed (next to user search) querying `models` by name
- `FeedFilters` gains a "Model" combobox under the brand dropdown

**Summary extract**: edge function `model-summary` pulls up to ~50 reviews, asks Lovable AI (`google/gemini-2.5-flash`) for a short pros/cons summary, caches it in `model_summaries`. Refreshed when stale (>24h) or review count changes.

---

## Part 2 — Catalog Seeding Pipeline

Goal: populate `brands` + `models` so users almost always pick from autocomplete.

**Sources (layered)**:
1. One-time seed of ~30 well-known brands (Nike, Adidas, Hoka, Asics, Brooks, Saucony, New Balance, On, Salomon, La Sportiva, Scarpa, Altra, Topo, Mizuno, Puma, UA, Merrell, Inov-8, Nnormal, Norda, Speedland, Craft, Diadora, Reebok, Vibram, Five Ten, Black Diamond, Tecnica, Dynafit, Lowa, Meindl, Keen) — via insert.
2. **Firecrawl** (already connected) scrapes each brand's running/trail/climbing collection pages → extract model name + specs + image.
3. **Perplexity** (needs connection) for "list every model {brand} released in {year}" and "does shoe X exist?" checks — fills gaps Firecrawl misses.

**Edge functions**:
- `seed-brand-catalog` — input `brand_id`, scrapes brand pages via Firecrawl, upserts into `models` (dedupe by `lower(name) + brand_id`), marks `verified = true`, `source = 'firecrawl'`
- `discover-new-shoes` — runs across all brands using Perplexity, focused on releases in last 90 days
- `enrich-model` — fills missing specs (weight, drop, stack, MSRP, image) for a given model
- `identify-shoe-from-image` — sends review photo to `google/gemini-2.5-pro` vision: returns `{brand, model, confidence}`, fuzzy-matches against catalog, pre-fills selectors. Wired to a "Detect from photo" button on the shoe step of Review.

**Scheduling** (pg_cron + pg_net):
- Daily 03:00 UTC → `discover-new-shoes`
- Weekly Sunday 02:00 UTC → full sweep: `seed-brand-catalog` for every brand + `enrich-model` for entries missing specs

Each run logs to `catalog_jobs` (already created) so admins can audit.

---

## Part 3 — Smart Validation for Custom Names

When a user submits a review with a custom brand/model, instead of inserting raw text, call edge function `validate-shoe-name`:

1. **Fuzzy match** against existing `models` via `pg_trgm` similarity ≥ 0.7 — if hit, link the review to that existing model.
2. **Web check** via Perplexity (`sonar`, structured JSON): "Does the shoe '{brand} {model}' exist? If misspelled, what's the correct name?"
3. **Decide**:
   - Exists, name slightly off → auto-correct, insert into `models`, link review, toast "Saved as '{corrected}'."
   - Exists, exact → insert as-is.
   - Not found → still insert but with `pending_review = true`, push a row into `model_review_queue` for admin.

**Admin UI `/admin/models`** (admin role only): list the queue with **Approve**, **Rename**, **Reject & merge into existing** actions. Reject & merge re-points all affected reviews at the chosen model and deletes the rejected one.

---

## Required Setup

- **Perplexity** connector — needs to be linked (Firecrawl already done). I'll trigger the picker first.

---

## Build Order

1. Connect Perplexity
2. Seed 30 curated brands (insert)
3. `seed-brand-catalog` + `discover-new-shoes` + `enrich-model` + cron jobs
4. `validate-shoe-name` + wire into `Review.tsx` submit
5. `/model/:modelId` page + `model-summary` function
6. Model search box on Feed + clickable shoe links in cards/modal
7. `identify-shoe-from-image` + "Detect from photo" button on Review
8. `/admin/models` queue UI

---

## Technical reference

- Routes added: `/model/:modelId`, `/admin/models`
- Edge functions added: `model-summary`, `seed-brand-catalog`, `discover-new-shoes`, `enrich-model`, `identify-shoe-from-image`, `validate-shoe-name`
- Files modified: `src/App.tsx`, `src/pages/Review.tsx`, `src/pages/Feed.tsx`, `src/components/ReviewCard.tsx`, `src/components/ReviewDetailModal.tsx`, `src/components/FeedFilters.tsx`
- Cron registered via `supabase--insert` (uses project URL + anon key, not committed as migration)
