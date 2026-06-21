## Problem

From the job timeline + edge logs, the flow is:

1. Firecrawl returns candidates ✓
2. Vision confirms side view ✓
3. **Download/upload fails** ✗ — because the source image URL returns `403` or `404` when fetched from the edge function (e.g. `dks.scene7.com` blocks unknown UAs, some CDNs hotlink-protect).

We currently:
- Fetch the image in `visionConfirmSideView` by passing the **URL** to the Lovable AI gateway — gateway also gets 403 from these CDNs (`Received 403 status code when fetching image from URL`).
- Re-fetch the same URL in `uploadToBucket` with no headers — also fails → "Failed to download/upload image" → job ends with 1 failed.

We never try the next candidate when download fails, so one bad URL kills the whole model.

## Fix

### 1. Download once, with browser-like headers
In `enrich-shoe-images/index.ts`, add `fetchImage(url)` that does `fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 ...', 'Accept': 'image/*', 'Referer': <page_url origin> } })` and returns `{ bytes, contentType }` or `null`. Use the candidate's `page_url` host as `Referer` when available — most hotlink protections accept that.

### 2. Vision check on bytes, not URL
Convert the downloaded bytes to a base64 `data:` URL and pass that to the vision model. Eliminates the gateway-side 403/404 entirely and is faster (one fetch instead of two).

### 3. Upload the already-downloaded bytes
`uploadToBucket` takes `(modelId, bytes, contentType)` instead of re-fetching.

### 4. Try next candidate on any failure
Loop candidates: for each, attempt `fetchImage` → if null, log `download_failed` (warn) and continue. Then vision check; if rejected, continue. First candidate that downloads + passes vision wins. If none pass vision but at least one downloaded, fall back to the first downloaded one (current behaviour, but now guaranteed uploadable).

### 5. Better event logging
- `download_failed` event with status code + URL when fetch fails
- Include final `image_url` thumbnail in the `uploaded` event (already done) — keep
- On total failure, log which candidates were tried and why each failed

## Files changed

- `supabase/functions/enrich-shoe-images/index.ts` — refactor `enrichOne` per above, replace `uploadToBucket` signature, swap vision input to base64.

No DB/UI changes — the existing `CatalogHealth` drawer will surface the new event types automatically.

## Out of scope

- Adding more search sources (still Firecrawl only)
- Image proxy/caching service
- Retrying entire job on partial failures