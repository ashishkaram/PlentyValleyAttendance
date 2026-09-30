# Plenty Valley Training Attendance

A mobile-first web app for the Plenty Valley girls' team manager to keep the squad list, tick attendance at every Tuesday and Thursday training session, and produce a weekly attendance report (CSV and PDF).

Built with Next.js 16, TypeScript, Tailwind CSS and Supabase (Postgres + Auth), hosted on Vercel. See `DECISIONS.md` for choices made beyond the PRD.

## What's where

| Path | What |
| --- | --- |
| `src/lib/domain/` | Business rules as pure functions: session generation, active periods, attendance %, report weeks, bulk-upload parsing. Unit tests in `__tests__/`. |
| `src/app/` | Pages (`/`, `/attendance/[date]`, `/players`, `/players/upload`, `/sessions`, `/reports`, `/settings`, `/login`, …) and server actions. |
| `src/proxy.ts` | Refreshes the login cookie and sends signed-out visitors to `/login`. |
| `supabase/migrations/` | Database schema, Row Level Security policies and database functions. |
| `supabase/tests/` | SQL smoke test for constraints, RLS and functions. |
| `scripts/seed.ts` | Creates the manager login, the 2026-27 season, the Christmas break and the 44 sessions (optionally 10 sample players). |
| `e2e/` | Playwright tests for the key flows and accessibility. |

## Local setup

Needs Node.js 20.9+ and Docker (for the local Supabase stack).

```bash
npm install
npx supabase start          # local Postgres, Auth and a mail catcher; prints the keys
cp .env.example .env.local  # fill in the values printed by `supabase start`
npm run seed -- --sample-players
npm run dev                 # http://localhost:3000
```

Log in with `MANAGER_EMAIL` / `MANAGER_PASSWORD` from `.env.local`. Password-reset emails are caught locally at http://127.0.0.1:54324.

To start again from an empty database: `npx supabase db reset && npm run seed -- --sample-players`.

The sample squad has 10 players: some without a number, Isla joined mid-season (20 Oct), and Jade left on 27 Oct and rejoined on 17 Nov.

## Environment variables

| Variable | Where | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | App (Vercel) and seed | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | App (Vercel) and seed | Supabase anon / publishable key. Safe in the browser: RLS protects the data. |
| `NEXT_PUBLIC_SITE_URL` | App (Vercel) | Public URL of the app, used in password-reset links, e.g. `https://pv-attendance.vercel.app` |
| `SUPABASE_SERVICE_ROLE_KEY` | Seed script only | Admin key. **Never** put it in Vercel or any `NEXT_PUBLIC_` variable. |
| `MANAGER_EMAIL`, `MANAGER_PASSWORD`, `MANAGER_NAME` | Seed script only | The manager login to create |
| `E2E_EMAIL`, `E2E_PASSWORD`, `E2E_BASE_URL` | Playwright only | Test login (use a local or test project, not production) |

## Tests

```bash
npm test             # unit tests for the section 7 business rules (Vitest)
npm run typecheck
npm run lint
npm run test:db      # SQL smoke test on a throwaway database; uses PGHOST/PGPORT/PGUSER,
                     # e.g. PGHOST=127.0.0.1 PGPORT=54322 PGUSER=postgres PGPASSWORD=postgres npm run test:db
npm run test:e2e     # Playwright against http://localhost:3000 (starts `npm run dev` if nothing is running)
```

The e2e tests sign in as `E2E_EMAIL` and change data (they add players and save attendance for 1 Oct 2026), so run them against the local stack or a test project. If Playwright cannot download its browser, point it at an installed Chromium with `PLAYWRIGHT_CHROMIUM_PATH=/path/to/chrome`.

## Deploying

### 1. Supabase

1. Create a project in the **Sydney (ap-southeast-2)** region on the **Pro plan** (no pausing over the Christmas break, daily backups included). Check current pricing first.
2. Apply the schema: `npx supabase link --project-ref <ref>` then `npx supabase db push`. Or, without the CLI, paste each file in `supabase/migrations/` (in name order) into **SQL Editor → New query** and click **Run**.
3. **Authentication → Sign In / Providers**: turn **off** "Allow new users to sign up". Keep the Email provider on.
4. **Authentication → URL Configuration**: Site URL = your Vercel URL; add `https://<your-app>/auth/confirm` to the redirect URLs.
5. **Authentication → Sessions** (Pro): set the inactivity timeout to 30 days (matches the app's 30-day rolling login). Leave refresh-token rotation on.
6. **Authentication → SMTP**: set up a custom SMTP sender so reset emails are delivered reliably (the built-in sender is rate-limited).
7. Create the manager and season from your computer (the service-role key stays local):

   ```bash
   NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co \
   SUPABASE_SERVICE_ROLE_KEY=<service role key> \
   MANAGER_EMAIL=... MANAGER_PASSWORD=... MANAGER_NAME="Ashish Karambelkar" \
   npm run seed
   ```

   Do **not** pass `--sample-players` in production.

### 2. Vercel

1. Import the GitHub repository into Vercel (framework: Next.js).
2. Set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` and `NEXT_PUBLIC_SITE_URL` for Production. Nothing else.
3. Optionally set the function region to Sydney (`syd1`) in Project Settings → Functions, next to the database.
4. Deploy. Vercel serves HTTPS only; the app also sends an HSTS header.

### 3. Go-live checklist

1. Log in on the manager's phone and add the site to the home screen.
2. Upload the initial squad at **Players → Bulk upload**. The default active-from date for the first upload is the season start (29 Sep 2026), so everyone appears on the 29 Sep and 1 Oct forms.
3. Back-enter the paper records for sessions held before go-live at **Attendance**, using the session picker.
4. Add any other breaks (school or public holidays) in **Settings**; the preview shows which sessions will be removed or flagged before anything changes.

## Using the app safely

- **Keep a screen lock (PIN, fingerprint or face) on the phone used for this app.** The manager stays signed in on that phone for up to 30 days, so anyone who can open the phone can open the app.
- Use **Log out** on any shared or borrowed device.
- The app stores only each player's name, optional number and squad dates. Do not add other details (date of birth, contact details, photos) anywhere in the app, including session notes and player names.
- Reports contain minors' names. Share exported files only with people who need them.

## Accessibility

Automated axe checks (WCAG 2.1 A/AA) run on every page in `e2e/accessibility.spec.ts`. Also check manually before go-live: the attendance form with VoiceOver (iOS) and TalkBack (Android), keyboard-only use on desktop, 200% zoom, and readability outdoors in sunlight.
