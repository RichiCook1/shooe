## Goal
Replace the weak Firecrawl-based image search with a direct **Google Images** search via SerpAPI (already configured as `SERPAPI_API_KEY`, same provider already used for Google Lens).

## Why this works better
- Google Images returns dozens of high-quality product shots per query, ranked by relevance to the exact product name.
- We skip Firecrawl's scrape + JSON extraction round-trip (which often returned nothing because retailer pages don't expose clean image metadata).
- SerpAPI gives us direct `original` image URLs + source page URLs in one call.

## Changes

### `supabase/functions/enrich-shoe-images/index.ts`
1. Add a new `googleImagesSearch(brand, model)` function that calls:
   ```
   https://serpapi.com/search.json?engine=google_images&q=<brand>+<model>+running+shoe&tbs=isz:m&num=15
   ```
   Returns the top ~10 candidates with `image_url` + `page_url` from the `images_results` array.
2. Use Google Images as the **primary** source. Keep Firecrawl as fallback only if SerpAPI returns nothing or the key is missing.
3. Keep the existing **Gemini vision verification step** that confirms each candidate is a clean lateral/side view on plain background — this is what actually guarantees quality. Walk down the Google Images list until one passes.
4. Keep the existing download + upload-to-storage + `image_source_url` save flow unchanged.
5. Keep the `catalog_job_events` logging so the live job timeline on Catalog Health still shows per-candidate reasoning.

### Query tuning
- Primary query: `"<brand> <model>" running shoe`
- If 0 verified results, retry with `"<brand> <model>" side view`
- Skip results whose URL points to YouTube/Reddit/Pinterest thumbnails.

## What stays the same
- Frontend UI (Import Reviews "Find images" card, Catalog Health timeline).
- Batch processing, scope filters (`imported-reviews`, single `modelId`, sweep).
- Vision verification — still required before saving to avoid junk images.
- Storage bucket and DB columns.

## Out of scope
- No new secrets needed (SerpAPI already configured).
- No frontend changes.
