## Goal
After identifying a shoe in the Identify dialog, automatically advance to the next "needs ID" draft so the admin can blast through them without reopening the dialog each time.

## Changes

### `src/pages/admin/Drafts.tsx`
- Build an ordered queue of drafts that need ID (same predicate as the "Needs ID" badge, with a photo).
- Track current index in queue. When opening Identify from a card, set the queue to start at that card.
- Add a new `onApplied` behavior: instead of just closing + reloading, refresh data, then jump to the next item in the queue. Close the dialog only when the queue is exhausted.
- Pass `queuePosition` info to the dialog header (e.g. "3 of 12") and a "Skip" button to advance without applying.

### `src/components/admin/IdentifyShoeDialog.tsx`
- Accept optional `queueInfo`: `{ index, total, onNext, onSkip }`.
- Show "N of M" in the header when present.
- Show a "Skip" button next to the manual section when `onNext` is provided.
- After a successful `applyIdentification` / `useCandidate` / `useManual`, instead of always closing, call `onNext()` if provided (which will swap the dialog's `reviewId` + `photoUrl` to the next draft). The dialog's internal `useEffect` already resets state and re-runs `identifyFromUrl` whenever `photoUrl` changes, so the next shoe loads automatically.
- Keep current behavior (close on apply) when `queueInfo` is absent.

### UX details
- "Skip" advances without changing the draft.
- When the last item is identified/skipped, the dialog closes and we `load()` once.
- Bulk auto-identify flow is unchanged; this only improves the manual loop.

No schema or edge function changes.
