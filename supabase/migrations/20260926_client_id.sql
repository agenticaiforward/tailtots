-- TailTots relational cloud sync: stable local <-> cloud id mapping (2026-09-26).
--
-- Every row the app syncs carries the app's local id in `client_id`, so push/pull
-- can match local objects to cloud rows without ever guessing. All statements are
-- idempotent (IF NOT EXISTS), so this migration is safe to re-run.
--
-- Notes:
-- * `children.age` is added because the app Child type has `age` but the table lacked it.
-- * `children.secret_code_hash` gets a harmless default ('pending', never a valid
--   bcrypt hash, so code verification fails closed until set). The sync layer
--   upserts children WITHOUT this column: inserts fall back to the default and
--   conflict-updates never touch it, so a parent-set code (via the
--   set_child_secret_code RPC) is never clobbered by a later push.
-- * Postgres treats NULLs as distinct in unique indexes, so pre-existing rows
--   with NULL client_id can never collide.

alter table public.children
  add column if not exists client_id text;
alter table public.pets
  add column if not exists client_id text;
alter table public.tasks
  add column if not exists client_id text;
alter table public.task_completions
  add column if not exists client_id text;
alter table public.kid_bank_transactions
  add column if not exists client_id text;
alter table public.savings_goals
  add column if not exists client_id text;
alter table public.badge_awards
  add column if not exists client_id text;
alter table public.neighborhood_jobs
  add column if not exists client_id text;
alter table public.memory_moments
  add column if not exists client_id text;

alter table public.children
  add column if not exists age integer;

alter table public.children
  alter column secret_code_hash set default 'pending';

create unique index if not exists children_family_client_idx
  on public.children (family_id, client_id);
create unique index if not exists pets_family_client_idx
  on public.pets (family_id, client_id);
create unique index if not exists tasks_family_client_idx
  on public.tasks (family_id, client_id);
create unique index if not exists badge_awards_family_client_idx
  on public.badge_awards (family_id, client_id);
create unique index if not exists neighborhood_jobs_family_client_idx
  on public.neighborhood_jobs (family_id, client_id);

create unique index if not exists task_completions_child_client_idx
  on public.task_completions (child_id, client_id);
create unique index if not exists kid_bank_transactions_child_client_idx
  on public.kid_bank_transactions (child_id, client_id);
create unique index if not exists savings_goals_child_client_idx
  on public.savings_goals (child_id, client_id);
create unique index if not exists memory_moments_child_client_idx
  on public.memory_moments (child_id, client_id);

alter table public.children
  add column if not exists last_streak_date date;
