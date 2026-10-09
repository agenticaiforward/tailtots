-- Child Resilience Blueprint snapshots (Phase 5).
--
-- Blueprints are computed snapshots, not persistent psychological profiles:
-- each row captures one generated guide for one child at one point in time.
-- Rows expire (valid_until) and recompute; nothing here is a diagnosis.
--
-- Guardrails enforced at the application layer (see lib/ai/blueprint.ts):
-- behavioral observations only, no clinical language, parent-side only,
-- model sees facts + age band, never child PII.

create table if not exists blueprint_snapshots (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references children(id) on delete cascade,
  family_id uuid not null references families(id) on delete cascade,

  -- Engine-state metaphor at generation time: cruising | running_hot | stalled
  engine_state text not null check (engine_state in ('cruising', 'running_hot', 'stalled')),
  age_band text not null,

  -- The three blueprint parts as JSON (structured data, parent-facing copy).
  observations_json jsonb not null default '[]'::jsonb,
  body_toolkit_json jsonb not null default '[]'::jsonb,
  growth_plan_json jsonb not null default '[]'::jsonb,

  brightest_pillar text not null,
  growing_pillar text not null,

  -- Warm parent-facing narrative (LLM or deterministic fallback).
  narrative text,
  -- 'ai' | 'deterministic' — honest labeling of how the narrative was made.
  mode text not null default 'deterministic'
    check (mode in ('ai', 'deterministic')),

  -- Snapshots expire after 30 days; the UI regenerates on demand.
  valid_until timestamptz not null default (now() + interval '30 days'),
  created_at timestamptz not null default now()
);

create index if not exists blueprint_snapshots_child_idx
  on blueprint_snapshots (child_id, created_at desc);
create index if not exists blueprint_snapshots_family_idx
  on blueprint_snapshots (family_id);

-- RLS: parents see only their own family's blueprints.
alter table blueprint_snapshots enable row level security;

drop policy if exists blueprint_snapshots_parent_read on blueprint_snapshots;
create policy blueprint_snapshots_parent_read on blueprint_snapshots
  for select using (family_id in (select current_parent_family_ids()));

drop policy if exists blueprint_snapshots_parent_insert on blueprint_snapshots;
create policy blueprint_snapshots_parent_insert on blueprint_snapshots
  for insert with check (family_id in (select current_parent_family_ids()));
