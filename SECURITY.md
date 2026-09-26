# TailTots Security Policy

TailTots is a kid-safety product. Security here means protecting children's
data and making sure every authorization decision is enforced server-side,
not in the browser.

## What is enforced today

- **Row-level security** across Supabase tables (`supabase/schema.sql`).
  Family-owned rows are scoped to `current_parent_family_ids()`; account
  snapshots are scoped to `auth.uid()`.
- **Child-code RPCs** (`claim_child_code`, `use_child_code`) verify parent
  family ownership before linking a profile.
- **Client keys only.** The web client uses only `NEXT_PUBLIC_SUPABASE_URL`
  and `NEXT_PUBLIC_SUPABASE_ANON_KEY`. No service-role key exists in client
  code or in the repo.
- **Input validation at every boundary.** Saved snapshots, form input,
  cloud writes, and Alexa events are Zod-validated before use. Corrupt
  local data is dropped, never executed.
- **Secrets stripped before local persistence.** Child secret codes and the
  parent passcode are removed or cleared before family state is written to
  `localStorage`.
- **Structured logging** with redaction at error level — children's names
  and family details never go into log lines.

## Known limitations (human decisions required)

- **The parent passcode (`defaultParentPasscode = "4321"`) is a demo
  convenience gate, not a security boundary.** It gates UI tabs only. Any
  real authorization must be enforced by Supabase RLS/RPCs on the server.
  Do not strengthen the passcode and call it security.
- **Anonymous launch-list and feedback inserts have no CAPTCHA or rate
  limiting yet.** Before public launch, add bot protection and insert
  throttling on `launch_interest` and `website_feedback`.
- **Snapshot payload size/shape is not constrained database-side.**
  `family_account_snapshots.snapshot` (jsonb) should get a size limit and,
  ideally, a shape check to bound abuse.
- **Security-definer functions need a privilege/grant review** before
  production (`supabase/schema.sql`).
- **Family creation may need abuse/rate limits** before open sign-ups.
- **Local demo data includes sample child/family names.** Treat it as
  sample content, never as production child records.

## Reporting a vulnerability

Email the maintainer privately with a description, reproduction steps, and
the affected version/commit. Do not open a public issue for a live
vulnerability. Kid-safety issues (anything that could expose a child to
contact, location, or identity risk) are treated as critical and
prioritized above all other work.

## Out of scope for contributors

- Do not add stranger messaging, open kid chat, public rankings, GPS
  tracking, or photo sharing without a documented safety review.
- Do not weaken RLS policies to "make the demo work" — fix the query or
  the policy properly, with a comment explaining the threat model.
