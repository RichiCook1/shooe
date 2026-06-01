# Normalize Interview Drafts

Turn raw interview transcripts into clean, structured reviews before an admin publishes them. Admin still approves everything in Drafts — no auto-publish.

## What the AI does

For each interview transcript it produces:
1. **Cleaned content** in the original language — grammar/spelling fixed, filler words ("um", "uh", false starts) removed, restructured into coherent paragraphs (intro · pros · cons · verdict), keeping the reviewer's voice.
2. **English translation** of the cleaned content (skipped if already English).
3. **Extracted metadata**: suggested `rating` (0–10), `terrain` (from existing field options), and matching `tags` from the active `tags` table — only when the transcript clearly supports them.

## When it runs

- **Automatic**: right after `transcribe-interview` succeeds in the Interview page, before the draft row is inserted. The draft lands in Drafts already clean.
- **Manual re-run**: a "Re-clean with AI" button in `EditDraftDialog` (Drafts page) re-runs normalization on the stored raw transcript. Admin can also revert to the raw transcript with one click.

## Workflow

```text
Audio → transcribe-interview → raw transcript
                                      │
                                      ▼
                       normalize-interview (new edge fn)
                                      │
                  ┌───────────────────┼────────────────────┐
                  ▼                   ▼                    ▼
           cleaned content     english translation   rating/terrain/tags
                  │
                  ▼
            insert into reviews (is_guest=true)  →  Drafts page
                                      │
                          Admin edits/approves   →  publishes
```

## Technical details

### Database (migration)
Add to `reviews`:
- `raw_transcript text` — original verbatim transcript (never overwritten)
- `content_en text` — English translation of cleaned `content`
- `original_language text` — ISO code detected by the model (e.g. `it`, `en`)
- `cleaned_at timestamptz` — set when normalization runs
- `ai_suggestions jsonb` — `{ rating, terrain, tag_ids[] }` for admin to accept/reject in the editor

No new table — reviews still represent drafts (is_guest=true) and published items.

### Edge function: `normalize-interview`
- Input: `{ transcript: string, available_tags: [{id,label}], available_terrains: [...] }`
- Uses Lovable AI Gateway (`google/gemini-3-flash-preview`) with AI SDK `Output.object` for structured output:
  ```ts
  { language, content_cleaned, content_en, rating?, terrain?, tag_ids[] }
  ```
- System prompt enforces: keep reviewer voice, original language, no invented facts, only pick tags/terrain from the supplied lists.
- Returns the full object; client persists it.

### Interview page (`src/pages/admin/Interview.tsx`)
- After `transcribe-interview` resolves, fetch active `tags` + terrain field options once per session (cached), then call `normalize-interview`.
- Insert the review with: `content = content_cleaned`, `raw_transcript`, `content_en`, `original_language`, `cleaned_at`, `ai_suggestions`, plus auto-applied `rating`/`terrain` if the admin's session has "auto-apply suggestions" on (default on).
- Auto-create `review_tags` for suggested tag IDs.
- Failure mode: if normalize fails, fall back to saving the raw transcript as `content` (today's behavior) and flag `cleaned_at = null` so Drafts shows a "Needs cleanup" badge.

### Drafts page + EditDraftDialog
- New badge: "Needs cleanup" when `cleaned_at IS NULL`.
- `EditDraftDialog` gains:
  - Tabs: **Cleaned** (editable `content`) · **English** (editable `content_en`) · **Raw transcript** (read-only)
  - "Re-clean with AI" button — calls `normalize-interview` with `raw_transcript` and refreshes the fields (admin confirms before overwriting their edits).
  - "Revert to raw" — copies `raw_transcript` into `content`.
  - Suggestion chips for rating/terrain/tags from `ai_suggestions` with one-click Apply.

### Out of scope
- No auto-publishing; admin approval flow unchanged.
- No retroactive cleanup of historic drafts (button is available per-draft if they want it).
- No changes to public feed rendering (still reads `content`; `content_en` is available for a future language toggle).
