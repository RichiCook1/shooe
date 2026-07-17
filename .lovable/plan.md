## The situation

I found the test reviews. They share a clear fingerprint in the database:

- **60 reviews** have a `guest_session_id` matching the pattern `guest-001`, `guest-002`, … `guest-040` — these were injected as seed/demo data (not from the interview flow, not from the CSV importer, not from a real guest submission which uses a UUID).
- Their locations are exactly the "US test cities" you remember: Portland OR, San Diego CA, Nashville TN, Minneapolis MN, Philadelphia PA, Flagstaff AZ, Chicago IL, Sedona AZ, Miami FL, Moab UT, Boulder CO, plus a few non-US (Berlin, Zurich, Tokyo, Chamonix, Whistler, London).
- Real submissions instead use either `interview:<admin>:<uuid>` (44 rows, from the interview page), `import:<batch>` (60 rows, from the CSV importer), or a raw UUID `guest_session_id` (from the public review form, 20-ish rows).

So `guest_session_id ~ '^guest-[0-9]+$'` is a reliable identifier for the seeded test set.

## Plan

Two changes, both in the Admin → Reviews page — no database mutation until you confirm:

### 1. Add a "Source" column and filter to `src/pages/admin/Reviews.tsx`

Compute a source label per review from `guest_session_id`:
- `guest-NNN` → **Seed** (test data)
- `interview:*` → **Interview**
- `import:*` → **Import**
- UUID / null → **Guest** or **User** (based on `is_guest` / `user_id`)

Add a filter dropdown alongside the existing "verified/source" filters with the values above, defaulting to "All". Show the label as a small badge in each row.

### 2. Add a "Delete all seeded test reviews" action

A button (with a confirm dialog showing the exact count, currently 60) that deletes only rows where `guest_session_id ~ '^guest-[0-9]+$'`. Admin-only, uses the existing RLS admin-delete policy. Nothing runs until you click it.

## Technical section

- Filter query: `.like('guest_session_id', 'guest-%')` combined with a regex check client-side, or a Postgres RPC `SELECT id FROM reviews WHERE guest_session_id ~ '^guest-[0-9]+$'` to be exact.
- Bulk delete: `supabase.from('reviews').delete().like('guest_session_id', 'guest-%')` — the `guest-XXX` prefix is unique to the seed set, no collision risk with real UUIDs.
- No migration needed; no schema change. Purely a UI + a scoped delete.

## Open question

Do you want me to (a) just add the filter/badge so you can review and manually delete, or (b) also add the one-click "delete all 60 seeded reviews" button?
