## Plan

1. **Add exact product verification before saving**
   - Update `enrich-shoe-images` so the vision check verifies:
     - side-view product photo
     - single shoe
     - visible brand/branding matches the requested brand
     - model/page context matches the requested model closely enough
   - Require the AI response to return structured fields like `brand_match`, `model_match`, `detected_brand`, `detected_model`, and `reason`.

2. **Reject obvious page/query mismatches early**
   - Before downloading or uploading, inspect each candidate `page_url` / `image_url` text.
   - If the URL clearly contains another brand or another model name, log it as `candidate_rejected` and move to the next candidate.
   - This would have rejected the On Cloudsurfer Trail URL for `The North Face Clyffe`.

3. **Remove unsafe fallback behavior**
   - Do not “use first downloaded image” when all candidates fail verification.
   - Instead mark the model as `image_status = failed` and log a clear failure: “No exact brand/model image found.”
   - This avoids silently saving wrong shoes.

4. **Improve the admin timeline UI**
   - Show candidate preview thumbnails for `search_results`, `vision_check`, `candidate_rejected`, and failed download events.
   - Display the AI’s detected brand/model and rejection reason inline, so it’s obvious why a candidate was accepted or rejected.

5. **Clean up this bad record**
   - Clear the incorrect image for `The North Face Clyffe` and set it back to `failed` or `missing`, so it can be retried safely after the stricter logic is live.

## Technical notes

- Main logic change: `supabase/functions/enrich-shoe-images/index.ts`.
- UI-only visibility change: `src/pages/admin/CatalogHealth.tsx`.
- Data correction: one update to the affected model record, no schema change needed.
- No new database tables are required.