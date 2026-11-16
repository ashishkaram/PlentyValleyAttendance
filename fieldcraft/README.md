# FieldCraft T20

Field-map generator for Victorian Premier Cricket Women's T20 (Grades 1, 2 and 3).
Pick the bowler, batter and phase and get a field map that obeys the playing conditions.
Built from `docs/fieldcraft/FieldCraft-PRD-T20.md` (v6.2), Phase 1.

## Run it

```bash
npm install
npm run dev
```

With no Supabase settings the app runs in **demo mode**: no login, four sample players,
and everything you enter stays in that browser.

## Connect Supabase (club login and shared data)

1. Create a Supabase project and run `supabase/migrations/20261116000000_init.sql` in its SQL editor.
2. Copy `.env.example` to `.env.local` and fill in `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
3. In Supabase → Authentication → URL Configuration, set the Site URL to where the app is hosted.
4. For production, configure a custom SMTP sender; the built-in one is rate-limited.

The first person to sign up creates the club and becomes its Admin. Everyone else joins by invite.

## Tests

```bash
npm test                 # engine: 36 tests, including a 140,000-combination sweep of the fielding laws
scripts/test-db.sh       # database: isolation, roles, invites (needs a local Postgres 16+, PGHOST etc.)
```

## Layout

- `src/engine/` — the field algorithm. Pure TypeScript, no network. `config.ts` holds the
  playing conditions (Rule 19), positions, templates and thresholds.
- `src/store/` — data layer. `demo.ts` (browser storage) and `supabase.ts` share one interface.
- `src/ui/` — Field, Players, Club, Reference and sign-in screens.
- `supabase/` — schema, row-level security and membership functions, plus their tests.

## Where this build differs from the PRD

- Playing conditions, positions, templates and thresholds are in `src/engine/config.ts`, not in
  database tables. This lets the map work with no reception; editing them means a code change.
- Close-in positions (slips, keeper, short leg) are drawn further from the bat than in real life
  so the markers do not overlap on a phone.
- The "stump to stump" and "full in the powerplay" adjustments do not place a mid-off or mid-on
  in front of a long-off or long-on that is already out.
- The Batter row offers hand and type only; picking a club player as the batter is not built.
- The Supabase path is type-checked and its SQL is tested on plain Postgres, but it has not yet
  been run against a live Supabase project.
- One-Day is a separate instance and is not built.

## Deploy

Any static host. Build with `npm run build` and serve `dist/`. Set the two `VITE_SUPABASE_*`
variables in the host's build settings.
