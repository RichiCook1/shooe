## Goal
The app feels slow mainly because of heavy images and inefficient data loading. Average uploaded review photo is **2.4 MB** (storage holds 205 MB across 86 files), the feed runs many small per-card queries, and the whole app loads as one JS bundle.

## What we'll change

### 1. Smaller images (biggest win)

**a. Compress harder on upload** — `src/lib/imageCompression.ts`
- Lower max dimensions: 1600 → for photos shown at most ~800 px wide on screen
- Lower JPEG quality: 0.82 → 0.72
- Lower size threshold: always re-encode if > 400 KB (currently skips anything < 1 MB)
- Output WebP when supported (much smaller than JPEG at same quality)
- Use `createImageBitmap` instead of `<img>` for faster decode

**b. Serve resized versions of existing images** via Supabase image transformations
- Add a small helper `getStorageThumb(url, { width, quality })` that rewrites `/object/public/...` URLs to `/render/image/public/...?width=…&quality=…&format=origin`
- Use it in:
  - `ReviewCard` (cards: width 800, quality 70)
  - `FeaturedReviews` (thumbs: width 600, quality 70)
  - `Profile`, `Model`, `Brand`, `SavedReviews` grids (width 400, quality 65)
  - Avatars (width 80)
- Add `decoding="async"` and `fetchpriority="low"` to lazy images; first hero image keeps `fetchpriority="high"`.

### 2. Cut request waterfalls in the Feed

`src/components/ReviewCard.tsx` currently fires **3 queries per card** (likes, comment count, saved). With 50 cards that's 150 round-trips.
- Move these into the parent `Feed` (and `FeaturedReviews`, `Profile`) as **single batched queries**:
  - `likes`: `select(review_id, user_id).in('review_id', ids)` → group client-side
  - `comments`: `select('review_id', { count: 'exact' })` per page → use a single `select(review_id).in(...)` and count in JS
  - `saved`: `select(review_id).eq('user_id', me).in('review_id', ids)`
- Pass `likeCount`, `isLiked`, `commentCount`, `isSaved` down as props. ReviewCard no longer queries on mount.

### 3. Smarter React Query defaults

In `src/App.tsx`, configure the `QueryClient` with:
- `staleTime: 60_000`
- `gcTime: 5 * 60_000`
- `refetchOnWindowFocus: false`
- `retry: 1`

This stops repeated refetches when navigating between pages.

### 4. Code-split routes

Convert `src/App.tsx` route imports to `React.lazy` + `<Suspense>`:
- Admin pages, `Sherpa`, `Messages`, `EditProfile`, `SavedReviews`, `Brand`, `Model`, `Review` are heavy and rarely needed on first paint.
- Keep `Index`, `Login`, `Feed` eager.

This shrinks the initial JS bundle significantly.

### 5. Smaller initial Feed page

- Lower default `.limit(50)` → `.limit(15)` and add a "Load more" button (or infinite scroll later).
- Move filters that we apply client-side (brand/category/city/country) into the SQL query so we don't fetch rows we'll discard.

### 6. Service worker
`public/sw.js` already does stale-while-revalidate. Confirm it's caching Supabase storage GETs (images) — if not, add a cache rule for `*.supabase.co/storage/v1/object/public/*` and `/render/image/public/*` so repeat visits are instant.

## Out of scope (can do later)
- Backfill job to re-encode existing 2.4 MB photos in storage to WebP. The Supabase transformation CDN above already gives us small versions on the fly, so this is optional.
- Switching to a CDN like Cloudflare Images.

## Expected impact
- First contentful image on Feed/landing should drop from ~2.4 MB to ~80–150 KB per card.
- Feed network requests drop from ~150+ to ~5.
- Initial JS payload roughly halved by route splitting.

## Files touched
- `src/lib/imageCompression.ts` (stronger compression + helper export)
- `src/components/ReviewCard.tsx` (accept props, drop internal queries)
- `src/components/landing/FeaturedReviews.tsx` (thumb URLs, batched tags already done)
- `src/pages/Feed.tsx` (batched likes/comments/saved, smaller limit, server-side filters)
- `src/pages/Profile.tsx`, `src/pages/Model.tsx`, `src/pages/Brand.tsx`, `src/pages/SavedReviews.tsx` (thumb URLs + batched data where they render cards)
- `src/App.tsx` (QueryClient config + lazy routes)
- `public/sw.js` (image cache rule, if missing)
