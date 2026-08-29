import pg from "pg";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("Set DATABASE_URL to the Supabase Postgres connection string.");
}

const sql = `
create table if not exists public.website_feedback (
  id uuid primary key default gen_random_uuid(),
  email text,
  message text not null,
  source text not null default 'tailtots-website',
  created_at timestamptz not null default now(),
  constraint website_feedback_email_format check (email is null or email ~* '^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$'),
  constraint website_feedback_message_length check (char_length(trim(message)) >= 8)
);

create index if not exists website_feedback_created_at_idx on public.website_feedback(created_at desc);

alter table public.website_feedback enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'website_feedback'
      and policyname = 'Anyone can send TailTots website feedback'
  ) then
    create policy "Anyone can send TailTots website feedback"
    on public.website_feedback for insert
    with check (true);
  end if;
end $$;
`;

const client = new pg.Client({
  connectionString: databaseUrl,
  ssl: { rejectUnauthorized: false },
});

await client.connect();
try {
  await client.query(sql);
  const result = await client.query(`
    select
      to_regclass('public.website_feedback') as table_name,
      count(*)::int as policies
    from pg_policies
    where schemaname = 'public'
      and tablename = 'website_feedback';
  `);
  console.log(JSON.stringify(result.rows[0]));
} finally {
  await client.end();
}
