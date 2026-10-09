-- Phase 4a — Flow Calibration: Elo-style Kid Readiness Ratings.
--
-- readiness_ratings: per-child, per-category Elo rating. Written by the
-- flow-calibration Worker route (weekly cron + on demand). The Mission
-- Engine's snapshot builder consumes these via runFlowCalibration; the
-- difficulty_calibration table (Phase 2) remains the persisted band store.
--
-- Guardrails: behavioral observations only. Ratings are internal-only
-- relative signals — never shown to children, never labels, never
-- cross-child comparisons. No clinical content of any kind.

create table public.readiness_ratings (
  child_id uuid not null references public.children(id) on delete cascade,
  category text not null,
  rating numeric not null default 1200,
  games_played int not null default 0,
  scaffold_level text not null default 'full' check (scaffold_level in ('full', 'light', 'independent')),
  consecutive_wins int not null default 0,
  updated_at timestamptz not null default now(),
  primary key (child_id, category)
);

alter table public.readiness_ratings enable row level security;

-- Parents manage their own family's readiness ratings.
create policy "Parents can manage readiness ratings"
on public.readiness_ratings for all
using (child_id in (
  select c.id from public.children c
  where c.family_id in (select public.current_parent_family_ids())
))
with check (child_id in (
  select c.id from public.children c
  where c.family_id in (select public.current_parent_family_ids())
));
