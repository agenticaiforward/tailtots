# TailTots

Mobile-first family PWA for pet care missions, kid profile switching, parent approvals, Kid Bank goals, pet passports, parent-gated neighborhood jobs, and character growth.

## Stack

- Next.js, React, TypeScript
- Tailwind CSS
- PWA manifest and service worker
- Supabase-ready PostgreSQL schema
- Production target: Cloudflare Pages on `tailtots.com`
- Secure backend target: Supabase Auth + PostgreSQL
- Temporary beta preview: OpenAI Sites

## Local Development

```bash
npm install
npm run dev
```

## Supabase Setup

1. Create a Supabase project.
2. Open the SQL editor.
3. Run `supabase/schema.sql`.
4. Copy `.env.example` to `.env.local`.
5. Add:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

When these keys are missing, the app runs in local device mode for early family testing. Do not use browser-only storage for real children or neighborhood jobs.

Secure backend foundations:

- `supabase/schema.sql` defines parent-owned family data with row-level security.
- Parent controls protect setup, approvals, rewards, and neighborhood job visibility.
- Kids switch profiles without passcodes so shared family devices stay easy to use.
- `lib/secure-family-backend.ts` contains the typed client access layer for authenticated Supabase reads/writes.
- `docs/SECURE_BACKEND.md` has the deployment and security checklist.
- `docs/CLOUDFLARE_SUPABASE_DEPLOYMENT.md` has the production launch checklist.

## MVP Scope

- Parent account and family setup
- Multiple child profiles with age-aware task assignment
- Multiple pet profiles and Pet Passports
- Daily pet-care missions and household responsibility flow
- Parent-controlled neighborhood job visibility
- Easy, Medium, Hard, Super Hard level progression
- Points, coins, approvals, savings goals, and Kid Bank categories
- Memory moments for kindness, silly, proud, helper, or cranky pet-care days
- No child-to-child messaging in the free MVP

## Pro Account Ideas

Payments, public marketplace, social messaging, GPS, and cloud AI should remain parent-controlled paid/pro modules after the child-safe core is working.
