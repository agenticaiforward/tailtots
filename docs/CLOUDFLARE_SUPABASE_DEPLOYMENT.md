# TailTots Production Deployment

Use this path for the real TailTots launch:

- Domain: `tailtots.com`
- Frontend/PWA hosting: Cloudflare Pages
- Secure family data: Supabase
- Mobile/tablet app wrapper: Capacitor Android using `https://tailtots.com`

The previous `chatgpt.site` URL is only a temporary beta preview host.

## 1. Supabase Backend

1. Create a Supabase project.
2. Open the SQL editor.
3. Run `supabase/schema.sql`.
4. Copy these values from Supabase project settings:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
```

Do not use browser-only demo storage for real families, children, rewards,
neighborhood jobs, or photos.

## 2. Cloudflare Pages

Create a Cloudflare Pages project connected to the TailTots repo.

Recommended build settings:

```text
Framework preset: None / custom
Build command: npm run build
Build output directory: dist
Node version: 22
```

Add these environment variables in Cloudflare Pages:

```text
NEXT_PUBLIC_SUPABASE_URL=<your Supabase URL>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your Supabase anon key>
```

## 3. Domain DNS

In Cloudflare DNS:

```text
CNAME  www  <your Cloudflare Pages project hostname>
```

For the root domain `tailtots.com`, use Cloudflare Pages custom domains so
Cloudflare creates the correct apex routing automatically.

## 4. App Store Packages

After Cloudflare Pages is live at `https://tailtots.com`, run:

```powershell
npm run android:sync
npm run android:open
```

Build a signed Android App Bundle from Android Studio and upload it to Amazon
Appstore or Google Play.

## 5. Launch URLs

Use these in app store submissions:

```text
Website: https://tailtots.com
Privacy policy: https://tailtots.com/privacy
Terms: https://tailtots.com/terms
Support: https://tailtots.com/support
```
