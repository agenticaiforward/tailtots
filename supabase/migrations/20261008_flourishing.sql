-- Phase 3 — PERMA Growth Log: flourishing snapshots.
--
-- flourishing_snapshots: one row per child per week. Deterministic pillar
-- scores (0-100, internal only — never shown to children, never percentiles
-- vs other kids) + trend arrows + an optional warm parent-facing narrative.
-- Written by the /api/ai/flourishing Worker route. Append-only history
-- (no updates) so the parent can see their child's own trajectory over time.
--
-- Guardrails: behavioral observations only — no free-text child notes, no
-- voice transcripts, no mental-health labels, no clinical terms in
-- narrative_json (scanned server-side before insert).

create table public.flourishing_snapshots (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  child_id uuid not null references public.children(id) on delete cascade,
  week_start date not null,                       -- Monday (UTC) of the week
  scores_json jsonb not null,                     -- { joy, stick, together, giving, mastery } 0-100
  trends_json jsonb not null,                     -- { joy: up|steady|down, ... } vs prior week
  brightest text not null check (brightest in ('joy', 'stick', 'together', 'giving', 'mastery')),
  narrative text,                                 -- warm parent-facing celebration, clinical-scanned
  mode text not null default 'deterministic'
    check (mode in ('ai', 'deterministic')),
  created_at timestamptz not null default now(),
  unique (child_id, week_start)
);

create index flourishing_snapshots_child_time_idx
  on public.flourishing_snapshots (child_id, week_start desc);

alter table public.flourishing_snapshots enable row level security;

-- Parents read their own family's flourishing history.
create policy "Parents can manage flourishing snapshots"
on public.flourishing_snapshots for all
using (family_id in (select public.current_parent_family_ids()))
with check (family_id in (select public.current_parent_family_ids()));
