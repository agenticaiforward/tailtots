create extension if not exists pgcrypto;

create table public.families (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  care_motto text default 'Care, earn, save, give, grow',
  created_at timestamptz not null default now()
);

create table public.parents (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  auth_user_id uuid not null unique,
  display_name text not null,
  role text not null default 'owner',
  created_at timestamptz not null default now()
);

create table public.children (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  display_name text not null,
  avatar_color text not null default '#ffd166',
  secret_code_hash text not null,
  level_key text not null default 'easy',
  points integer not null default 0,
  coins integer not null default 0,
  streak_days integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.pets (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  name text not null,
  species text not null,
  breed text,
  birthday date,
  favorite_food text,
  care_notes text,
  created_at timestamptz not null default now()
);

create table public.pet_passports (
  id uuid primary key default gen_random_uuid(),
  pet_id uuid not null unique references public.pets(id) on delete cascade,
  microchip_id text,
  vet_name text,
  vaccination_notes text,
  medication_notes text,
  emergency_notes text,
  updated_at timestamptz not null default now()
);

create table public.levels (
  key text primary key,
  label text not null,
  sort_order integer not null,
  required_points integer not null,
  question_style text not null
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  pet_id uuid references public.pets(id) on delete set null,
  title text not null,
  category text not null check (category in ('pet_care', 'chore', 'kindness', 'money', 'community')),
  difficulty text not null references public.levels(key),
  points integer not null default 5,
  coins integer not null default 0,
  requires_parent_approval boolean not null default true,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.chores (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  title text not null,
  room text,
  points integer not null default 5,
  coins integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.task_completions (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  child_id uuid not null references public.children(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  child_note text,
  voice_note_url text,
  completed_at timestamptz not null default now(),
  reviewed_at timestamptz
);

create table public.rewards (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  title text not null,
  cost_coins integer not null default 0,
  reward_type text not null check (reward_type in ('family', 'pet', 'toy', 'treat', 'donation', 'privilege')),
  requires_approval boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.stickers (
  id uuid primary key default gen_random_uuid(),
  family_id uuid references public.families(id) on delete cascade,
  title text not null,
  badge text not null,
  trait text not null,
  rarity text not null default 'common',
  created_at timestamptz not null default now()
);

create table public.kid_bank_transactions (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references public.children(id) on delete cascade,
  category text not null check (category in ('earn', 'save', 'spend', 'give')),
  amount_cents integer not null,
  description text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now()
);

create table public.savings_goals (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references public.children(id) on delete cascade,
  title text not null,
  target_cents integer not null,
  saved_cents integer not null default 0,
  goal_type text not null check (goal_type in ('toy', 'pet_food', 'treats', 'donation', 'family_reward')),
  created_at timestamptz not null default now()
);

create table public.donations (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references public.children(id) on delete cascade,
  organization_name text not null,
  amount_cents integer not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'sent')),
  created_at timestamptz not null default now()
);

create table public.approvals (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  parent_id uuid references public.parents(id) on delete set null,
  target_table text not null,
  target_id uuid not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reason text,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

create table public.memory_moments (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  child_id uuid not null references public.children(id) on delete cascade,
  pet_id uuid references public.pets(id) on delete set null,
  mood text not null check (mood in ('kind', 'silly', 'cranky', 'proud', 'helper')),
  note text not null,
  created_at timestamptz not null default now()
);

create table public.badge_awards (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  child_id uuid not null references public.children(id) on delete cascade,
  title text not null,
  skill text not null check (skill in ('responsibility', 'empathy', 'teamwork', 'leadership', 'time')),
  note text not null,
  awarded_at timestamptz not null default now(),
  awarded_by_parent_id uuid references public.parents(id) on delete set null
);

create table public.neighborhood_jobs (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  title text not null,
  neighbor_family_name text not null,
  pet_name text not null,
  scheduled_for text not null,
  reward_cents integer not null default 0,
  badge_title text not null default 'Trusted Helper',
  assigned_child_ids uuid[] not null default '{}',
  checklist text[] not null default '{}',
  safety_note text not null,
  status text not null default 'posted' check (status in ('posted', 'accepted', 'approved', 'completed', 'cancelled')),
  accepted_by_child_id uuid references public.children(id) on delete set null,
  task_id uuid references public.tasks(id) on delete set null,
  created_by_parent_id uuid references public.parents(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.levels (key, label, sort_order, required_points, question_style)
values
  ('easy', 'Easy', 1, 0, 'Simple yes/no care checks'),
  ('medium', 'Medium', 2, 100, 'Care checks plus short explanations'),
  ('hard', 'Hard', 3, 300, 'Less obvious pet needs and empathy questions'),
  ('super_hard', 'Super Hard', 4, 700, 'Leadership, planning, and community service')
on conflict (key) do nothing;

create index families_created_at_idx on public.families(created_at);
create index parents_family_id_idx on public.parents(family_id);
create index children_family_id_idx on public.children(family_id);
create index pets_family_id_idx on public.pets(family_id);
create index tasks_family_id_idx on public.tasks(family_id);
create index task_completions_child_id_idx on public.task_completions(child_id);
create index approvals_family_id_status_idx on public.approvals(family_id, status);
create index kid_bank_transactions_child_id_idx on public.kid_bank_transactions(child_id);
create index savings_goals_child_id_idx on public.savings_goals(child_id);
create index badge_awards_family_id_child_id_idx on public.badge_awards(family_id, child_id);
create index neighborhood_jobs_family_id_status_idx on public.neighborhood_jobs(family_id, status);

alter table public.families enable row level security;
alter table public.parents enable row level security;
alter table public.children enable row level security;
alter table public.pets enable row level security;
alter table public.pet_passports enable row level security;
alter table public.tasks enable row level security;
alter table public.chores enable row level security;
alter table public.task_completions enable row level security;
alter table public.rewards enable row level security;
alter table public.stickers enable row level security;
alter table public.kid_bank_transactions enable row level security;
alter table public.savings_goals enable row level security;
alter table public.donations enable row level security;
alter table public.approvals enable row level security;
alter table public.memory_moments enable row level security;
alter table public.badge_awards enable row level security;
alter table public.neighborhood_jobs enable row level security;

create or replace function public.current_parent_family_ids()
returns setof uuid
language sql
security definer
set search_path = public
as $$
  select family_id from public.parents where auth_user_id = auth.uid()
$$;

create policy "Parents can read their family"
on public.families for select
using (id in (select public.current_parent_family_ids()));

create policy "Parents can manage parent-owned family rows"
on public.parents for all
using (family_id in (select public.current_parent_family_ids()))
with check (family_id in (select public.current_parent_family_ids()));

create policy "Parents can manage children"
on public.children for all
using (family_id in (select public.current_parent_family_ids()))
with check (family_id in (select public.current_parent_family_ids()));

create policy "Parents can manage pets"
on public.pets for all
using (family_id in (select public.current_parent_family_ids()))
with check (family_id in (select public.current_parent_family_ids()));

create policy "Parents can manage tasks"
on public.tasks for all
using (family_id in (select public.current_parent_family_ids()))
with check (family_id in (select public.current_parent_family_ids()));

create policy "Parents can manage approvals"
on public.approvals for all
using (family_id in (select public.current_parent_family_ids()))
with check (family_id in (select public.current_parent_family_ids()));

create policy "Parents can manage pet passports"
on public.pet_passports for all
using (pet_id in (select id from public.pets where family_id in (select public.current_parent_family_ids())))
with check (pet_id in (select id from public.pets where family_id in (select public.current_parent_family_ids())));

create policy "Parents can manage levels"
on public.levels for select
using (true);

create policy "Parents can manage chores"
on public.chores for all
using (family_id in (select public.current_parent_family_ids()))
with check (family_id in (select public.current_parent_family_ids()));

create policy "Parents can manage task completions"
on public.task_completions for all
using (child_id in (select id from public.children where family_id in (select public.current_parent_family_ids())))
with check (child_id in (select id from public.children where family_id in (select public.current_parent_family_ids())));

create policy "Parents can manage rewards"
on public.rewards for all
using (family_id in (select public.current_parent_family_ids()))
with check (family_id in (select public.current_parent_family_ids()));

create policy "Parents can manage stickers"
on public.stickers for all
using (family_id is null or family_id in (select public.current_parent_family_ids()))
with check (family_id is null or family_id in (select public.current_parent_family_ids()));

create policy "Parents can manage kid bank transactions"
on public.kid_bank_transactions for all
using (child_id in (select id from public.children where family_id in (select public.current_parent_family_ids())))
with check (child_id in (select id from public.children where family_id in (select public.current_parent_family_ids())));

create policy "Parents can manage savings goals"
on public.savings_goals for all
using (child_id in (select id from public.children where family_id in (select public.current_parent_family_ids())))
with check (child_id in (select id from public.children where family_id in (select public.current_parent_family_ids())));

create policy "Parents can manage donations"
on public.donations for all
using (child_id in (select id from public.children where family_id in (select public.current_parent_family_ids())))
with check (child_id in (select id from public.children where family_id in (select public.current_parent_family_ids())));

create policy "Parents can manage memory moments"
on public.memory_moments for all
using (family_id in (select public.current_parent_family_ids()))
with check (family_id in (select public.current_parent_family_ids()));

create policy "Parents can manage badge awards"
on public.badge_awards for all
using (family_id in (select public.current_parent_family_ids()))
with check (family_id in (select public.current_parent_family_ids()));

create policy "Parents can manage neighborhood jobs"
on public.neighborhood_jobs for all
using (family_id in (select public.current_parent_family_ids()))
with check (family_id in (select public.current_parent_family_ids()));

create or replace function public.create_family_for_current_user(
  family_name text,
  parent_display_name text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_family_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  insert into public.families (name)
  values (coalesce(nullif(trim(family_name), ''), 'My Family'))
  returning id into new_family_id;

  insert into public.parents (family_id, auth_user_id, display_name, role)
  values (new_family_id, auth.uid(), coalesce(nullif(trim(parent_display_name), ''), 'Parent'), 'owner');

  return new_family_id;
end;
$$;

create or replace function public.set_child_secret_code(
  p_child_id uuid,
  p_secret_code text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_secret_code !~ '^[0-9]{4,8}$' then
    raise exception 'Child code must be 4 to 8 digits';
  end if;

  update public.children
  set secret_code_hash = crypt(p_secret_code, gen_salt('bf'))
  where id = p_child_id
    and family_id in (select public.current_parent_family_ids());

  if not found then
    raise exception 'Child not found or not allowed';
  end if;
end;
$$;

create or replace function public.verify_child_secret_code(
  p_child_id uuid,
  p_secret_code text
)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.children
    where id = p_child_id
      and family_id in (select public.current_parent_family_ids())
      and secret_code_hash = crypt(p_secret_code, secret_code_hash)
  );
$$;
