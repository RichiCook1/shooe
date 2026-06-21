# Side-view shoe images

## 1. Schema
Migration on `public.models`:
- Add `image_source_url text` — original page URL we found the image on.
- (Keep existing `image_url`, `image_status`.)

## 2. Edge function: `enrich-shoe-images`
Rewrite the Firecrawl search to strongly prefer lateral/side-profile product shots:

- **Search query**: `"{brand} {model}" running shoe side view lateral profile product image -review -reddit -youtube`, with a domain preference toward brand sites and major retailers (e.g. brand.com, runningwarehouse.com, roadrunnersports.com, fleetfeet.com, zappos.com, dickssportinggoods.com).
- **Top 5 results** instead of 3, each scraped with two formats:
  - `screenshot` (skip — too heavy), and
  - `json` with a stricter prompt:
    > "Return the URL of the single best product image that shows the shoe from a pure lateral/side view (full profile, toe pointing left or right, entire shoe visible, plain/white background, no model wearing it, no angled 3/4 view). Also return the page URL. JSON: {\"image_url\": string|null, \"page_url\": string|null, \"is_side_view\": boolean, \"confidence\": number}"
- **Selection**: filter to `is_side_view === true`, sort by `confidence` desc, take the first. Fallback to highest confidence if none pass.
- **Vision re-check** (cheap pass): before uploading, send the candidate image to Lovable AI (`google/gemini-3-flash-preview`) with a prompt asking it to confirm "true side/lateral profile of a single shoe on plain background". If it returns false, skip to the next candidate. Cap at 3 vision checks per model to control cost.
- **Persist**: upload the chosen image to the `shoe-photos` bucket (existing logic) and update `models` with `image_url`, `image_source_url` (the `page_url`), and `image_status = 'ok'`.
- Mark `failed` if no candidate passes the vision check.

## 3. No UI changes
The existing Catalog Health admin page already triggers the enrichment job — no new buttons needed in this pass. The selection is fully automatic.

## Technical details
- Files: `supabase/functions/enrich-shoe-images/index.ts` (rewrite), one new migration.
- Models: Lovable AI `google/gemini-3-flash-preview` for the vision re-check (multimodal, cheap).
- Secrets used: `FIRECRAWL_API_KEY`, `LOVABLE_API_KEY` (both already configured).
- No breaking changes to callers (`{ modelId }` or `{ limit }` signature unchanged).
