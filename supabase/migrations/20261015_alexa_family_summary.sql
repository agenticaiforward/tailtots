-- TailTots Alexa parent skill: family summary RPC.
--
-- The Alexa Lambda fetches live family data through the Worker endpoint
-- GET /api/alexa/family-summary, which authenticates the request with the
-- skill's own opaque access token (issued after real Supabase parent auth in
-- the OAuth authorize step). The Worker never holds a service_role key, so
-- this function runs SECURITY DEFINER and is the *only* code path allowed to
-- read a family's rows on the basis of a verified Alexa token.
--
-- Deploy: paste this file into the Supabase SQL editor (project
-- opdfjjxfsravjwfcyzwn) and run it. Re-running is safe.

create or replace function public.get_alexa_family_summary(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_family_id uuid;
begin
  select p.family_id into v_family_id
  from public.parents p
  where p.auth_user_id = p_user_id
  limit 1;

  if v_family_id is null then
    return jsonb_build_object('kids', '[]'::jsonb, 'pendingApprovals', '[]'::jsonb, 'todayMissions', '[]'::jsonb);
  end if;

  return jsonb_build_object(
    'kids', (
      select coalesce(jsonb_agg(k), '[]'::jsonb) from (
        select
          c.display_name as name,
          c.streak_days as "streakDays",
          coalesce(sum(t.amount_cents) filter (where t.status = 'approved'), 0) as "bankCents",
          coalesce(sum(t.amount_cents) filter (where t.status = 'approved' and t.category = 'save'), 0) as "savedCents",
          coalesce(sum(t.amount_cents) filter (where t.status = 'approved' and t.category = 'give'), 0) as "givenCents"
        from public.children c
        left join public.kid_bank_transactions t on t.child_id = c.id
        where c.family_id = v_family_id
        group by c.id, c.display_name, c.streak_days
        order by c.display_name
      ) k
    ),
    'pendingApprovals', (
      select coalesce(jsonb_agg(a), '[]'::jsonb) from (
        select t.title, c.display_name as child
        from public.task_completions tc
        join public.tasks t on t.id = tc.task_id
        join public.children c on c.id = tc.child_id
        where tc.status = 'pending'
          and t.family_id = v_family_id
          and c.family_id = v_family_id
        order by tc.id desc
        limit 20
      ) a
    ),
    'todayMissions', (
      select coalesce(jsonb_agg(m), '[]'::jsonb) from (
        select
          t.title,
          c.display_name as child,
          case
            when tc.status = 'pending' then 'awaiting approval'
            when tc.status = 'approved' then 'done'
            else 'not done yet'
          end as state
        from public.tasks t
        join public.children c on c.family_id = v_family_id
        left join public.task_completions tc
          on tc.task_id = t.id and tc.child_id = c.id
        where t.family_id = v_family_id
          and t.is_active
        order by t.title, c.display_name
        limit 60
      ) m
    )
  );
end;
$$;

-- Lock it down: only the Worker (via anon REST /rpc) may call it.
revoke all on function public.get_alexa_family_summary(uuid) from public, anon, authenticated;
grant execute on function public.get_alexa_family_summary(uuid) to anon;
