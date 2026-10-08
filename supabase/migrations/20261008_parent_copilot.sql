-- Phase 2 — Parent Copilot: pattern insights + difficulty calibration.
--
-- pattern_insights: precomputed per-child behavioral pattern flags. Written
-- by the /api/ai/copilot-insights Worker route (on demand) and, later, a
-- weekly cron. The UI and copilot narration read this table; they never
-- compute patterns live. Narratives are LLM-generated on demand and cached.
--
-- difficulty_calibration: per-child, per-category calibrated difficulty band.
-- Written by detection; consumed by the Mission Engine's Stage-B planner.
--
-- Guardrails: behavioral observations only. detail_json carries rates, counts,
-- and ratios — never interpretations, diagnoses, or mental-health labels.
-- Parents can dismiss any insight (dismissed_by_parent_id). No persistent
-- psychological profiles: insights expire (valid_until) and are recomputed.

create table public.pattern_insights (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  child_id uuid not null references public.children(id) on delete cascade,
  insight_type text not null check (insight_type in (
    'weak_weekday', 'weak_category', 'weak_skill', 'difficulty_mismatch',
    'streak_at_risk', 'completion_drop', 'skill_imbalance', 'engagement_rise'
  )),
  severity text not null default 'info' check (severity in ('info', 'watch', 'act')),
  detail_json jsonb not null default '{}'::jsonb,
  narrative text,
  valid_from date not null default current_date,
  valid_until date,
  dismissed_by_parent_id uuid references public.parents(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (child_id, insight_type, valid_from)
);

create index pattern_insights_child_active_idx
  on public.pattern_insights (child_id, valid_from desc)
  where dismissed_by_parent_id is null;

create table public.difficulty_calibration (
  child_id uuid not null references public.children(id) on delete cascade,
  category text not null,
  band text not null check (band in ('easy', 'medium', 'hard')),
  completion_rate_30d numeric,
  sample_size int,
  updated_at timestamptz not null default now(),
  primary key (child_id, category)
);

alter table public.pattern_insights enable row level security;
alter table public.difficulty_calibration enable row level security;

-- Parents manage their own family's insights and calibration.
create policy "Parents can manage pattern insights"
on public.pattern_insights for all
using (family_id in (select public.current_parent_family_ids()))
with check (family_id in (select public.current_parent_family_ids()));

create policy "Parents can manage difficulty calibration"
on public.difficulty_calibration for all
using (child_id in (
  select c.id from public.children c
  where c.family_id in (select public.current_parent_family_ids())
))
with check (child_id in (
  select c.id from public.children c
  where c.family_id in (select public.current_parent_family_ids())
));
