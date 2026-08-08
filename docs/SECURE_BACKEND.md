# TailTots Secure Backend Plan

TailTots should not store real children, secret codes, pet-care jobs, photos, or family rewards only in browser storage.

## Recommended MVP Backend

Use Supabase for the first secure hosted version:

- Supabase Auth for parent accounts.
- PostgreSQL tables in `supabase/schema.sql`.
- Row Level Security on every family-owned table.
- Parent ownership through the `parents.auth_user_id = auth.uid()` relationship.
- Child secret codes stored only as `crypt()` hashes.
- Child code verification through `verify_child_secret_code()`.
- Child code updates through `set_child_secret_code()`.
- Neighborhood jobs, badges, rewards, bank requests, and memories stored as family-owned rows.

## Data Boundaries

Parents:

- Can create and manage their family, kids, pets, jobs, rewards, badges, bank requests, and memories.
- Must be authenticated with Supabase Auth.
- Own all external/community actions.

Children:

- Do not get public accounts for the MVP.
- Use a local family-level secret code only after the parent session is available.
- Cannot browse other children or families.
- Cannot directly message neighbors or post public content.

Neighbors/community:

- Should not see child profiles directly.
- Should only interact with parent-approved job or goal surfaces.
- Should not receive addresses, contact details, or private notes from child UI.

## Launch Checklist

1. Create a Supabase project.
2. Run `supabase/schema.sql`.
3. Add environment variables:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

4. Add parent sign-in UI before public launch.
5. Route all real data writes through `lib/secure-family-backend.ts`.
6. Keep local device mode clearly labeled until secure accounts are enabled.
7. Do not store real child codes, parent passcodes, precise addresses, or private notes in localStorage.
8. Use Supabase Storage with private buckets for photos before allowing real uploads.

## AWS/Cheap Hosting Notes

For a low-cost MVP, host the web app as a PWA on Cloudflare Pages, Vercel, AWS Amplify, or S3/CloudFront. Keep Supabase as the managed backend until the product has enough usage to justify a custom AWS backend.

If moving fully into AWS later:

- Cognito for parent auth.
- RDS Postgres or DynamoDB for data.
- S3 private buckets for media.
- CloudFront for the app.
- Lambda/API Gateway for server APIs.

The product should first prove parent retention and neighborhood/job safety before paying the complexity cost of a custom AWS backend.
