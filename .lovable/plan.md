
## Goal

Let admins capture quick in-person interviews at events: record the interviewee's voice, transcribe it, snap a photo of the shoe, auto-identify the shoe, and submit an **anonymous** review (not attributed to the admin).

## Flow

1. Admin Overview page gets a prominent "Start Interview" button → routes to `/admin/interview` (admin-only, mobile-first full-screen layout).
2. Step 1 — Audio capture
   - Big record button using `MediaRecorder` (webm/opus).
   - Live timer, stop button, replay before sending.
   - On stop → upload blob to new edge function `transcribe-interview` which forwards to Lovable AI Gateway (Gemini 2.5 Flash, multimodal audio input) and returns transcript text.
   - Transcript shown in an editable textarea so admin can fix typos.
3. Step 2 — Shoe photo
   - Camera capture via `<input type="file" accept="image/*" capture="environment">` + preview.
   - Compress with existing `imageCompression.ts`.
   - Call existing `identify-shoe-from-image` function → pre-fill brand/model in the Combobox.
   - Admin can correct/override (typeahead + add-new already supported).
4. Step 3 — Confirm & submit
   - Show: photo, suggested brand/model (editable), transcript (editable), optional rating slider + terrain + location.
   - Submit creates a `reviews` row with `user_id = null`, `is_guest = true`, `guest_session_id = 'interview:<uuid>'`, `content = transcript`, `media_urls = [shoePhotoUrl]`.
   - Existing "Anyone can create reviews (guests allowed)" RLS already permits this. No admin attribution stored.

## Backend changes

- New edge function `supabase/functions/transcribe-interview/index.ts`
  - Accepts `multipart/form-data` with an `audio` file (or base64 JSON).
  - Calls Lovable AI Gateway with `google/gemini-2.5-flash` using `input_audio` content part; system prompt asks for a clean verbatim transcript.
  - Returns `{ transcript: string }`.
  - Handles 402/429 and CORS.
- No DB migration required — reuses `reviews` guest path and existing `shoe-photos` / `review-media` buckets.

## Frontend changes

- `src/pages/admin/Interview.tsx` — new 3-step page (Record → Photo → Confirm).
- `src/components/admin/AudioRecorder.tsx` — MediaRecorder wrapper with timer + replay.
- Route added to `src/App.tsx` under the `/admin` nested routes.
- Sidebar entry "Interview" in `AdminSidebar.tsx` (Mic icon).
- "Start Interview" CTA card on `pages/admin/Overview.tsx`.

## Technical notes

- Reuse `Combobox` (with `allowCustom`) for brand/model selection, prefilled by AI identification.
- Audio uploaded directly to the edge function (no storage bucket needed — transcripts only); raw audio is not persisted to keep things simple. (Can be added later if desired.)
- Photo stored in `shoe-photos` bucket; URL added to `reviews.media_urls`.
- All AI calls go through Lovable AI Gateway via the edge function — no client-side keys.

## Out of scope

- Persisting raw audio recordings.
- A separate `interviews` table — review is the sole output.
- Offline/queued capture (events with no signal).
