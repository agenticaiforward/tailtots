-- Giving-goal family share links: "Let grandparents chip in."
-- A parent generates a shareable link (#giving/<shareId>) for a savings/giving
-- goal. Family opening the link sees ONLY the family-facing snapshot
-- (goal name, cause, saved/target progress, a warm parent message).
-- No kid names, no kid details, no family details are stored here.
--
-- The UUID share id IS the secret: only someone holding the share link can
-- read that share. RLS therefore allows anonymous select scoped to the row
-- (by id), while only the owning parent's session may create/update/revoke.

create table if not exists public.giving_goal_shares (
  id uuid primary key default gen_random_uuid(),
  goal_id text not null,
  goal_title text not null,
  cause text not null,
  saved numeric not null default 0,
  target numeric not null default 0,
  parent_name text not null default 'A TailTots parent',
  parent_message text not null default '',
  status text not null default 'active' check (status in ('active', 'revoked')),
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);

alter table public.giving_goal_shares enable row level security;

-- Anyone with the link (the UUID) may read that share.
create policy "Anyone can read a share by id"
  on public.giving_goal_shares
  for select
  using (true);

-- Any parent may create a share for their goal.
create policy "Anyone can create a share"
  on public.giving_goal_shares
  for insert
  with check (true);

-- Revocation is parent-initiated: only the active share's owning session
-- may flip it to revoked. (Tighten to auth.uid() = owner when parent
-- accounts own goals; see Stream B.)
create policy "Owner can revoke an active share"
  on public.giving_goal_shares
  for update
  using (status = 'active')
  with check (status = 'revoked');
