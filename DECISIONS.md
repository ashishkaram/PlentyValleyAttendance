# Decisions

Choices made where the PRD (v1.1) was silent or needed interpreting. Newest last.

## Stack

| # | Decision | Why |
| --- | --- | --- |
| D1 | Next.js 16 (App Router), React 19, Tailwind 4, as in the PRD. Next 16 renamed `middleware.ts` to `proxy.ts`; the auth/session refresh lives in `src/proxy.ts`. | Latest stable at build time. |
| D2 | Business rules are pure functions in `src/lib/domain/` (no React, no Supabase), unit tested with Vitest. Tests run with `TZ=America/New_York` so any accidental use of the machine's time zone fails. | PRD section 2. |
| D3 | Dates are handled as `YYYY-MM-DD` strings with UTC arithmetic; only "today" uses `date-fns-tz` with `Australia/Melbourne`. | DST can never shift a date (section 7.3). |
| D4 | Multi-row writes go through Postgres functions (`create_player`, `deactivate_player`, `reactivate_player`, `save_attendance`, `apply_regeneration`, `save_season_settings`, `import_players`). They are `security invoker`, so RLS still applies. | Each change is atomic (e.g. saving attendance and setting `attendance_taken`). |
| D5 | Rules are checked in the app (for friendly messages) and again by database constraints: no overlapping active periods (a GiST exclusion constraint, which also means at most one open period), `end_date > start_date`, name 1-100 chars, statuses. | Defence in depth. |
| D6 | `players.is_active` is maintained by a trigger on `player_active_periods` (true when she has an open period). | Keeps it in sync automatically; never used for %. |
| D7 | `xlsx` is the npm build 0.18.5. SheetJS publishes newer, patched builds only on its own CDN (cdn.sheetjs.com), which was not reachable from the build environment. Known advisories affect parsing untrusted files; here only the signed-in manager uploads, and parsing happens in her own browser. **Before go-live, switch to** `npm i https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz` (or later). | Supply-chain note. |
| D8 | PDF export uses `@react-pdf/renderer` on the server (`/reports/export`). | Same data code as the page; no headless browser needed. |

## Auth and access

| # | Decision | Why |
| --- | --- | --- |
| D9 | Persistent login: the auth cookie is capped at 30 days. `@supabase/ssr` hard-codes 400 days, so `withSessionMaxAge` overrides it. Each token refresh rewrites the cookie, so the 30 days roll with use. For a server-side limit too, set Supabase Auth "inactivity timeout" to 30 days (see README). | Section 6.1, open question 3. |
| D10 | Logout signs out only this device (`scope: "local"`). | "Logging out ends the session on that device." |
| D11 | MVP RLS: the `manager` role has full access to all tables. `committee` and `coach` exist in the `profiles.role` check but have **no** access until their permissions are decided; granting them is a new policy migration, not a schema change. Signed-in users with no role see a "No access yet" page. | Section 4 and open question 2. |
| D12 | Password reset: the "check your inbox" message is the same whether or not the email exists. New passwords need at least 10 characters. | Avoid account enumeration. |

## Players

| # | Decision | Why |
| --- | --- | --- |
| D13 | "Active from" may not be before the season start **or after the season end**. | Outside the season is almost certainly a typo. |
| D14 | Deactivating a player whose open period starts today or later deletes that period instead of closing it (end must be after start). | She was never in the squad under it. |
| D15 | Reactivation date defaults to today, may equal the previous period's end date (end is exclusive, so there is no overlap), and may not be before the season start. | FR-05. |
| D16 | Player numbers are text up to 10 characters. Search matches name substrings or an exact number. | "07" is kept. |
| D17 | Bulk upload: duplicates default to **Skip**. "Update player number" is offered only when the row matches exactly one existing player and the row has a number. Within-file duplicates (no existing match) offer Skip / Add anyway. Rows with errors are never imported; the rest are imported in one transaction. The server re-validates every row. Blank lines are ignored; headers are matched case-insensitively. An Excel file's first sheet is used. A numeric Excel cell in "Active from" is treated as an Excel date. | FR-03. |
| D18 | Names are trimmed and internal whitespace is collapsed (`"Jane  Citizen"` → `"Jane Citizen"`). | Cleaner duplicate matching. |

## Sessions and attendance

| # | Decision | Why |
| --- | --- | --- |
| D19 | Regeneration also **clears** `needs_review` on a generated session whose date becomes an expected date again (e.g. a break was removed). A generated session is never created on a date that already has a manual session. | Keeps flags meaningful; one session per date. |
| D20 | "Has attendance" for regeneration = `attendance_taken` or any attendance row. The database re-checks this at apply time, so a session that gained attendance between preview and apply is flagged, never deleted. | Section 7.1 step 2. |
| D21 | For a flagged session, **Keep** clears the flag; **Cancel** sets it to cancelled (and clears the flag). | FR-07. |
| D22 | Extra (manual) sessions with no attendance can be removed; otherwise sessions are cancelled, never deleted from the UI. | Fixing a mistyped extra session. |
| D23 | The seed script generates the 44 sessions directly (first setup). From then on, changes go through the Settings preview. | Section 7.1 step 4 applies to the manager's changes. |
| D24 | The attendance form opens on today's session, else the most recent past session, else (before the season) the first session. Future sessions can be marked (with a notice). | FR-08. |
| D25 | "Mark all present" does not overwrite players already marked Excused. | Avoid losing excused marks when re-opening. |
| D26 | Saving writes one row per listed player. A row is only updated if its status changed, so `updated_by`/`updated_at` show who last *changed* each mark. The form shows "Last edited by … on …". If the squad for that date changed while the form was open, saving asks you to reload. | FR-09. |
| D27 | A cancelled session's form is read-only until it is un-cancelled. Cancelling keeps any attendance rows (they are just not counted). | FR-07. |

## Reports

| # | Decision | Why |
| --- | --- | --- |
| D28 | **Held** = sessions counted for that player that were recorded (present + excused + absent): scheduled, attendance taken, she was active, and she has a row. The % uses present ÷ (present + absent). | Section 7.2; "held" is per player so the columns add up. |
| D29 | Season-to-date runs from the season start to the **end of the report range** (not today). | A past week's report stays the same when viewed later. |
| D30 | Players included = active on at least one **scheduled** (non-cancelled) session date in the range. | FR-10. |
| D31 | The week list shows every report week of the season except weeks entirely within a break; the default is the latest *completed* week, stepping back over breaks. Before the first week has ended, the page says the first report is not ready. The first report week (23-29 Sep 2026) contains only the 29 Sep session. | FR-10. |
| D32 | Low attendance is highlighted by colour **and** a "Below 75%" badge (not colour alone). | WCAG 1.4.1. |
| D33 | CSV export has a UTF-8 BOM (Excel) and prefixes cells starting with `= + - @` with `'`. | Formula-injection safety. |
| D34 | The report-day setting (`report_weekday`) sets the first day of the report week; the default Wednesday gives Wed-Tue weeks. | Section 5. |

## Other

| # | Decision | Why |
| --- | --- | --- |
| D35 | Security headers: HSTS, `X-Frame-Options: DENY`, `nosniff`, strict referrer, no camera/mic/location. Pages are `noindex`. | Section 9. |
| D36 | Light theme only, dark text on light backgrounds, 3px focus rings, ≥44px tap targets; automated axe (WCAG 2.1 AA) checks run in Playwright. | Outdoor readability. |
