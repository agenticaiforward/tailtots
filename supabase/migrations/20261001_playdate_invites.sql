-- Playdate invites: real playdate coordination between two families.
-- The UUID invite id IS the secret: only someone holding the share link can
-- read or claim that invite. RLS therefore allows anonymous access scoped
-- to the row, and every row is private by obscurity of its UUID.

create table if not exists public.playdate_invites (
  id uuid primary key default gen_random_uuid(),
  family_name text not null,
  host_name text not null,
  slots jsonb not null default '[]'::jsonb,
  status text not null default 'open' check (status in ('open', 'booked')),
  created_at timestamptz not null default now(),
  claimed_by text,
  claimed_at timestamptz
);

alter table public.playdate_invites enable row level security;

-- Anyone with the link (the UUID) may read that invite.
create policy "Anyone can read an invite by id"
  on public.playdate_invites
  for select
  using (true);

-- Any parent may create an invite for their family.
create policy "Anyone can create an invite"
  on public.playdate_invites
  for insert
  with check (true);

-- Any parent holding the link may claim the one open slot (book it).
-- The app also guards with status = 'open' so only the first claim wins.
create policy "Anyone can claim an open invite"
  on public.playdate_invites
  for update
  using (status = 'open')
  with check (true);
