# Admin Dashboard

Build a protected `/admin` section, accessible only to users with the `admin` role (you already have it). A link will appear in the main nav for admins.

## Structure

```
/admin                  → Overview (stats: users, reviews, brands, models, pending queue count)
/admin/catalog          → Shoe Catalog Manager (brands + models)
/admin/queue            → Pending Shoe Submissions (model_review_queue)
/admin/fields           → Field Manager (tags + field_options)
/admin/users            → User Management (grant/revoke admin)
/admin/moderation       → Reviews & Comments moderation
/admin/analytics        → Analytics (tag frequency, brand performance, activity)
```

A collapsible shadcn sidebar nests these pages under an `AdminLayout`.

## Pages

**Overview** — KPI cards: total users, reviews this week, brands, models, pending queue count, catalog jobs status. Recent activity list.

**Catalog Manager** — Searchable table of brands and models. Edit name, brand, category, image, MSRP, weight, drop, stack, year. Toggle `verified` / `pending_review`. Delete. Buttons to trigger `seed-brand-catalog` and `discover-new-shoes` edge functions; show progress from `catalog_jobs`.

**Pending Queue** — Items from `model_review_queue` with `submitted_brand`, `submitted_model`, web check result. Actions: Approve (creates/links model, marks verified), Correct (edit name then approve), Reject. Re-run web validation via `validate-shoe-name`.

**Field Manager** — Two tabs: Tags (CRUD on `tags` by type) and Field Options (CRUD on `field_options` grouped by `field_name`). Toggle active, reorder by `sort_order`.

**User Management** — Search `profiles`, view stats (review count, joined date). Toggle admin role (insert/delete in `user_roles`). Cannot remove your own admin role.

**Moderation** — List recent reviews/comments with filters. Delete inappropriate content. Show flagged items (future: reports table).

**Analytics** — Charts using recharts: tag frequency (bar), reviews per brand (bar), reviews over time (line), top reviewed models (table), terrain breakdown (pie). All from existing tables.

## Access Control

- `useIsAdmin()` hook queries `user_roles` for current user.
- `AdminRoute` wrapper redirects non-admins to `/`.
- "Admin" link in `Navbar` only renders when `useIsAdmin()` returns true.

## How you access it (after build)

1. Sign in as **richi69**.
2. An **Admin** link appears in the top nav (and in the mobile menu).
3. Click it to land on `/admin`.

## Technical

- New files: `src/pages/admin/{Overview,Catalog,Queue,Fields,Users,Moderation,Analytics}.tsx`, `src/components/admin/{AdminLayout,AdminSidebar}.tsx`, `src/hooks/useIsAdmin.ts`, `src/components/AdminRoute.tsx`.
- Routes added to `src/App.tsx` under `/admin/*`.
- Nav link added to `src/components/landing/Navbar.tsx` (and any mobile nav).
- All data ops use existing RLS policies (admin-only via `has_role`).
- No DB schema changes required — every table needed already exists with admin policies.
- Uses existing edge functions (`seed-brand-catalog`, `discover-new-shoes`, `validate-shoe-name`, `model-summary`).
