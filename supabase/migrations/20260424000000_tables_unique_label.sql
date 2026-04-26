-- Partial unique index on (restaurant_id, label) for live (non-archived) tables.
--
-- Background:
--   POST /api/tables runs a duplicate-label pre-check before insert. Two
--   concurrent bulk creates can both pass the pre-check and produce clashing
--   labels — a classic TOCTOU race. The DB must be the source of truth.
--
-- Why partial:
--   Tables are soft-deleted (archived_at) so order history stays intact.
--   Two archived rows with the same label are fine; only live rows must be
--   unique. `WHERE archived_at IS NULL` keeps the index small and avoids
--   blocking label re-use after a table is decommissioned.
--
-- Idempotent — safe to re-run.

create unique index if not exists tables_unique_live_label
  on public.tables (restaurant_id, label)
  where archived_at is null;
