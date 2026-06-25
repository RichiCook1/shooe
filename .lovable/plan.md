# Plan: Enrich images for imported reviews

## Goal
Find side-view product images on the web for every shoe model linked to an imported review that doesn't yet have an image. Reviews inherit the model's `image_url`, so enriching the model populates all its reviews.

## Approach
Reuse the existing `enrich-shoe-images` edge function (Firecrawl search + Gemini vision verification + upload to `shoe-photos` bucket). No new scraping logic needed.

## Changes

### 1. Edge function: extend `enrich-shoe-images`
Add a new mode `{ scope: "imported-reviews" }` that:
- Queries distinct `model_id`s from `reviews` where `guest_session_id LIKE 'import:%'`
- Joins to `models` and filters to those with `image_url IS NULL` OR `image_status = 'failed'`
- Runs the existing `enrichOne()` loop over that set, with a configurable `limit` (default 50 per call to stay within timeout)
- Logs progress to `catalog_job_events` like today so it shows up in Catalog Health

### 2. UI: button on Import Reviews page
Add an "Enrich images for imported reviews" card to `src/pages/admin/ImportReviews.tsx`:
- Shows count of imported-review models missing an image
- Button triggers the edge function in batches (loop until 0 remain or user stops)
- Live progress: total / done / failed, plus a link to Catalog Health for the per-model timeline

## Technical notes
- No schema changes — `models.image_url`, `image_status`, `image_source_url`, and `catalog_job_events` already exist.
- Vision verification is strict (brand + model match) so junk results get rejected automatically; failures are marked `image_status='failed'` and can be retried.
- Firecrawl + Lovable AI Gateway keys are already configured.
- Processing is sequential per model (Firecrawl + vision per candidate) — expect ~10–20s per shoe. Batching from the UI keeps each function call under the edge timeout.

## Out of scope
- Per-review (non-catalog) photos.
- Improving the search/vision prompts (current pipeline is reused as-is).