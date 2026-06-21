## Goal

Make the "Enrich shoe images" run observable so you can see which models are being processed, which candidates were found, and where it fails.

## Changes

### 1. Edge function: stream progress to the DB

Extend `supabase/functions/enrich-shoe-images/index.ts` so every model write also logs to a new `catalog_job_events` table:
- `started` — model id + name being processed
- `search_results` — number of Firecrawl candidates + first 3 page URLs
- `vision_check` — candidate URL + pass/fail + reason
- `uploaded` — final image_url + image_source_url
- `failed` — error message

Also: link each event to its `catalog_jobs.id` and stamp timestamps.

### 2. New table `catalog_job_events`

Columns: `job_id` (fk), `model_id`, `model_name`, `stage` (text), `status` (`info`/`ok`/`warn`/`error`), `message`, `data` (jsonb), `created_at`. Admin-only RLS read; service role writes.

### 3. Admin UI: live job inspector

On `src/pages/admin/CatalogHealth.tsx`:
- Each row in "Recent Jobs" becomes clickable → opens a drawer/dialog "Job details"
- Drawer shows a live-polling timeline (refetch every 2s while job `status = running`) grouped by model:
  - Model name + thumbnail of chosen image
  - Sub-rows for each event with colored status dot, stage, message, and expandable JSON (`data`) for the Firecrawl payload / vision reply
- A "Run on single model" input (model id or search) that calls `enrich-shoe-images` with `{ modelId }` so you can test one shoe at a time and watch it stream.

### 4. Diagnostics surfaced in the toast

When the function returns, the existing toast shows `ok / failed / total`. Add the `job.id` to the response so the UI auto-opens the new drawer for that job.

## Technical notes

- Polling via React Query `refetchInterval` keyed off job status — stops once job is `completed`/`completed_with_errors`.
- Events are append-only; no migration on `catalog_jobs` itself.
- Keeps the existing function contract; only adds observability.
- No changes to the user-facing app, admin only.
