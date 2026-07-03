# PawPal Quest

Mobile-first family PWA for pet care missions, child secret-code access, parent approvals, Kid Bank goals, pet passports, and character growth.

## Stack

- Next.js, React, TypeScript
- Tailwind CSS
- PWA manifest and service worker
- Supabase-ready PostgreSQL schema
- Deployable through OpenAI Sites now, and portable to GitHub + Vercel

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

The current app runs in demo mode when these keys are missing. Once Supabase keys are present, the next step is replacing the seeded in-memory state in `app/components/PawPalApp.tsx` with reads/writes through `lib/supabase.ts`.

## MVP Scope

- Parent account and family setup
- Multiple child profiles with secret codes
- Multiple pet profiles and Pet Passports
- Daily pet-care missions and household responsibility flow
- Easy, Medium, Hard, Super Hard level progression
- Points, coins, approvals, savings goals, and Kid Bank categories
- Memory moments for kindness, silly, proud, helper, or cranky pet-care days
- No child-to-child messaging in the free MVP

## Pro Account Ideas

Payments, public marketplace, social messaging, GPS, and cloud AI should remain parent-controlled paid/pro modules after the child-safe core is working.
