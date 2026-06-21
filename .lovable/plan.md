# Identify shoes from interview photos

Many interview drafts are attached to the `Unknown / Unidentified (needs ID)` placeholder model. They already have a photo in `media_urls[0]`. This plan adds an admin tool to identify each shoe from its photo and re-link the review to the correct model — reusing the existing `identify-shoe-from-image` and `validate-shoe-name` edge functions, with no schema changes.

## What changes

### `src/pages/admin/Drafts.tsx`
- On each draft card that "Needs ID" (or has a photo), add a **Identify from photo** button next to *Edit*.
- Add a top-bar **Identify all unidentified** button that processes every "Needs ID" draft sequentially with a progress toast (`3/12 identified…`), skipping ones with no photo.

### New `src/components/admin/IdentifyShoeDialog.tsx`
- Opens when clicking *Identify from photo* on a single draft.
- Shows the photo plus a loading state while calling `supabase.functions.invoke("identify-shoe-from-image", { body: { imageUrl } })`.
- Renders the top candidates returned by the function:
  - For each candidate, show `brand · model`, confidence %, the AI's reason, and — if `modelMatch` is present — a "Use this" button that re-links the review to that catalog model.
  - If no `modelMatch` but a `brandMatch` + free-text `model`, a "Use & create" button that calls `validate-shoe-name` (existing function) to find/create the model, then re-links.
  - Manual fallback: a `ShoeSearch` combobox to pick any catalog model, plus free-text "brand + model" inputs that fall through to `validate-shoe-name`.
- On confirm:
  1. `update reviews set model_id = <newId>, content = stripped` where `content` is the existing content with `\n\n[NEEDS SHOE IDENTIFICATION]` removed.
  2. Refresh the drafts list.

### Bulk flow
- "Identify all unidentified" iterates drafts that have a photo and currently point at the Unknown placeholder.
- For each, calls `identify-shoe-from-image` and **auto-applies the top candidate only if** `confidence >= 0.7` AND it has a `modelMatch` (safe auto-link). Otherwise leaves the draft for manual review.
- Shows summary toast: `Auto-identified 7 · 5 need manual review`.

## Technical notes

- Reuses existing edge functions — no new functions, no migrations.
- `identify-shoe-from-image` already accepts `imageUrl` and returns `candidates[]` with `brandMatch` / `modelMatch` lookups against the catalog.
- Re-linking is a plain `reviews.update({ model_id })` — same pattern used by `merge_model_duplicates`. The old `Unidentified` placeholder model is left in place (other drafts may still reference it).
- After all unidentified drafts are cleared, the placeholder can be deleted manually via the existing Catalog dedup/delete UI — not handled by this change.
- No design-system changes; uses existing `Dialog`, `Card`, `Button`, `Badge`, `ShoeSearch`.
