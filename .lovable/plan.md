
## Problem

The uploaded file has a single sheet named `Merged` with columns: `Reviewer, Shoe Model, Detailed Review Summary, Weight, Stack Height, Heel Drop, Midsole Foam Material, Price, Key Features, Intended Use Case, Reviewer Sentiment (Inferred), Source`.

The current importer (`src/pages/admin/ImportReviews.tsx`) only understands the two-sheet `Sample Products` + `Generated Reviews` format and looks for `brand`, `model`, `review_text` columns. None match, so it parses 60 products with no brand column and 0 reviews.

## Fix

Update `src/pages/admin/ImportReviews.tsx` to auto-detect the format and handle the merged layout. No schema changes, no edge function changes.

### Format detection
- If a sheet has columns `Reviewer` + `Shoe Model` + `Detailed Review Summary` → treat as merged Kofuzi format.
- Otherwise fall back to existing two-sheet logic.

### Merged-row processing
For each row:
1. **Brand + model split** from `Shoe Model`:
   - Maintain a known-brand list (Adidas, Hoka, Nike, Asics, Saucony, Brooks, New Balance, On, Puma, Mizuno, Altra, Topo, Salomon, La Sportiva, Merrell, Reebok, Under Armour, Skechers, Diadora).
   - Match longest known brand prefix (so "New Balance" / "La Sportiva" work); remainder = model name. If none match, first token = brand.
2. **Specs parsing** (regex `(\d+(?:\.\d+)?)`, first match):
   - `weight_g`: from `Weight`, prefer the value inside `(### g)`; else if "oz" convert oz→g (×28.3495).
   - `stack_height_mm`: first number in `Stack Height` (handles "45 mm (Heel) / 39 mm").
   - `drop_mm`: first number in `Heel Drop`.
   - `msrp`: first number in `Price` (strip `$`, commas).
3. **Brand upsert**: reuse existing brand cache; insert new brands as needed.
4. **Model upsert**: lookup by `(brand_id, lowercased name)`. If new, insert with parsed specs + `source: "kofuzi-import"`, `category: "road"` (no category column in file), `verified: false`. If existing, patch any spec field that is currently null with parsed value (don't overwrite existing specs).
5. **Review insert**: build `content` as:
   ```
   {Detailed Review Summary}

   Key features: {Key Features}
   Best for: {Intended Use Case}
   Midsole: {Midsole Foam Material}

   [Reviewer: Kofuzi · Sentiment: ...]
   Sources: {Source}
   ```
   Only include sections whose source cell is non-empty. Insert with `is_guest: true`, `guest_session_id: "import:kofuzi:<uuid>"`, `media_urls: []`, `model_id: <upserted>`.

### UI
- Same upload UI; the summary card already shows Brands / Models / Reviews / Skipped — values will populate correctly once parsing works.
- Log lines mention "Detected merged Kofuzi format" when that path runs.

## Technical notes
- All changes confined to `src/pages/admin/ImportReviews.tsx`.
- Chunked inserts (100 models, 200 reviews) preserved.
- Existing two-sheet path untouched for backward compatibility.
