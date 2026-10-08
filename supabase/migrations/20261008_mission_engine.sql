-- Phase 1 — Developmental Mission Engine: signal store + generation audit.
--
-- mission_events: append-only engagement events. One row per meaningful child
-- action. Raw material for ALL pattern detection (Phase 2). Never updated,
-- only inserted.
--
-- mission_generations: every AI-generated mission set, for audit + learning
-- what worked. Written by the /api/ai/mission-set Worker route.
--
-- Guardrails: behavioral observations only — no free-text child notes, no
-- voice transcripts, no mental-health labels are stored or sent to the model.

create table public.mission_events (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  child_id uuid not null references public.children(id) on delete cascade,
  task_id uuid references public.tasks(id) on delete set null,
  generation_id uuid references public.mission_generations(id) on delete set null,
  event_type text not null check (event_type in (
    'assigned', 'started', 'completed', 'approved', 'rejected',
    'skipped', 'expired', 'edited_by_parent', 'discarded_by_parent',
    'checkin', 'streak_extended', 'streak_broken'
  )),
  -- Denormalized at write time so analytics never needs joins:
  category text,            -- pet_care | chore | kindness | money | community
  difficulty text,          -- easy | medium | hard
  skill text,               -- responsibility | empathy | teamwork | leadership | time
  points int,
  weekday smallint,         -- 0=Sunday..6=Saturday, from created_at
  hour_of_day smallint,
  minutes_to_complete int,  -- completed_at - started_at, when known
  created_at timestamptz not null default now()
);

create index mission_events_child_time_idx on public.mission_events (child_id, created_at desc);
create index mission_events_family_time_idx on public.mission_events (family_id, created_at desc);
create index mission_events_type_idx on public.mission_events (child_id, event_type);

create table public.mission_generations (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  child_id uuid not null references public.children(id) on delete cascade,
  parent_id uuid references public.parents(id) on delete set null,
  model_id text not null,
  plan_json jsonb not null,        -- the Stage-B plan (slots + constraints)
  snapshot_json jsonb not null,    -- the redacted child snapshot (Stage A)
  output_json jsonb not null,      -- missions as generated
  mode text not null default 'ai' check (mode in ('ai', 'cache', 'smart_template', 'static_template')),
  parent_action text check (parent_action in ('approved_all', 'edited', 'partial', 'discarded')),
  created_at timestamptz not null default now()
);

create index mission_generations_child_time_idx on public.mission_generations (child_id, created_at desc);

alter table public.mission_events enable row level security;
alter table public.mission_generations enable row level security;

-- Parents manage their own family's signal store (same pattern as other tables).
create policy "Parents can manage mission events"
on public.mission_events for all
using (family_id in (select public.current_parent_family_ids()))
with check (family_id in (select public.current_parent_family_ids()));

create policy "Parents can manage mission generations"
on public.mission_generations for all
using (family_id in (select public.current_parent_family_ids()))
with check (family_id in (select public.current_parent_family_ids()));
