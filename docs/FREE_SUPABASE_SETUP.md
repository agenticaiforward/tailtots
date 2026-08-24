# Free TailTots Backend Setup

Best free option for TailTots right now: Supabase Free.

Supabase Free fits this app because TailTots already uses Supabase Auth, Postgres, row-level security, and the family snapshot table. The free tier includes a Postgres database, email/password auth, 50,000 monthly active auth users, 500 MB database storage, and 1 GB file storage. A free project can pause after inactivity, which is fine for early testing but not ideal once real families depend on it daily.

## Create the Free Backend

1. Go to `https://supabase.com`.
2. Create a free project.
3. In the Supabase dashboard, open `SQL Editor`.
4. Paste and run everything from `supabase/schema.sql`.
5. Open `Project Settings` > `API`.
6. Copy:
   - Project URL
   - `anon` public key
7. Put them in `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-public-key
```

## Turn On Parent Sign Up

In Supabase, open `Authentication` > `Providers` and make sure Email is enabled.

For early testing, you can leave email confirmation off so parents can sign up and enter the app immediately. Before a public launch, turn confirmation on and configure a branded SMTP sender.

## Verify It Works

Run:

```bash
npm run supabase:check
npm run test:first-three
```

The first command confirms TailTots can reach the Supabase schema. The second command rebuilds the website and syncs Android/Amazon assets with the same Supabase keys.

## Free Hosting For The Website

Use one of these:

- Cloudflare Pages: best fit for `tailtots.com`, generous free static hosting, good custom-domain path.
- OpenAI Sites: already connected for preview deployments in this workspace.

For production, use Cloudflare Pages with the same two environment variables:

```bash
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
```

## When Free Stops Being Enough

Upgrade Supabase when real daily families need non-pausing uptime, more storage, backups, custom email branding, or more operational safety.
