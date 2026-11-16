# FieldCraft One-Day — Product Requirements Document
### Field-map generator for Victorian Premier Cricket Women's — One-Day instance (Grades 1, 2 and 3)

*Prepared for: Ashish | Version 6.0 | 16 November 2026 | Companion document: FieldCraft-PRD-T20.md*

> **What changed from v5.0.** FieldCraft is now two instances, one per format: **FieldCraft T20** and **FieldCraft One-Day**. This document is the complete brief for the One-Day instance. Sections 3, 4, 5, 7 and 8 are identical in both documents; sections 2, 6 and 9 are format-specific. v6.0 also (a) replaces the three-bucket line tendency with five line buckets and three length buckets per bowler, (b) falls back to a generic field for the bowling type when a bowler has no data, (c) makes the field-generation algorithm fully deterministic, and (d) corrects the v5.0 errors found in review (spin sides in the QA matrix, mirror-last ordering, undefined swing frame, y-axis sign, bowler/keeper radii, missing base templates).

> **⚠ Rule-book status: NOT YET VERIFIED.** The VPC rule book could not be opened while writing this document. Every number in §2.1 is a seed value marked `confirmed = false`. Before build sign-off, replace them from the 2026/27 VPC rule book for each grade. The app reads these numbers from configuration (§2.1), so correcting them needs no code change.

---

## 1. Purpose and scope

A captain or coach picks the bowler, the batter and the match phase and immediately sees a correct top-down field map. Where the club has recorded where a bowler actually pitches the ball (line and length percentages), the field is tuned to that bowler. Where it has not, the field is the generic one for that type of bowler.

**In scope for this instance**
- Club login with roles (§3).
- Player details, including bowling type and line/length percentages (§4).
- The field-generation engine and rendered map for One-Day (§5, §6).
- Grade selection — Grade 1 (Firsts), Grade 2 (Seconds), Grade 3 (Thirds) — which loads that grade's playing conditions (§2.1).

**Out of scope**
- Men's cricket. This product covers the Victorian Premier Cricket **Women's** competition only; every rule, circle size and template here is the women's one.
- Live scoring, ball-by-ball capture, video analysis. Line and length percentages are typed in by a coach; the app does not measure them.
- Cross-club sharing or comparison.
- The other format. T20 is a separate instance with its own rules, templates and bowling data.

**One backend, two instances.** Both instances use the same Supabase project, so a club signs up once and enters its players once. Each instance is its own deployed app with its own URL, title and colour accent, and reads only its own format's rules, templates and bowling data.

---

## 2. One-Day format rules

### 2.1 Playing conditions per grade (configuration, seeded, unconfirmed)

Stored in `format_rules`, one row per (format, grade). The grade chip in the selector chooses the row.

| Setting | Grade 1 (Firsts) | Grade 2 (Seconds) | Grade 3 (Thirds) |
|---|---|---|---|
| Overs per innings | 50 | 40 | 40 |
| Powerplay overs | 1–10 | 1–8 | 1–8 |
| Middle overs | 11–40 | 9–32 | 9–32 |
| Death overs | 41–50 | 33–40 | 33–40 |
| Max fielders outside circle — Powerplay | 2 | 2 | 2 |
| Max fielders outside circle — Middle | 4 | 4 | 4 |
| Max fielders outside circle — Death | 4 | 4 | 4 |
| Max overs per bowler | 10 | 8 | 8 |
| Circle radius | 23 m | 23 m | 23 m |
| Nominal boundary (for drawing the circle) | 55 m | 55 m | 55 m |

Each row also carries `confirmed` (boolean) and `source_ref` (rule number in the VPC rule book). While `confirmed = false` the app shows a small "rules unconfirmed" marker next to the grade chip, visible to Admins and Coaches.

**Seeds to check first**
- **Overs per grade.** 50 / 40 / 40 are placeholders, not rule-book figures. This is the setting most likely to differ by grade. When overs are changed, the default windows are: powerplay = first 20% of overs, death = last 20%.
- **Outside the circle in the death overs: 4 or 5.** Women's one-day internationals allow 4 for all non-powerplay overs; the men's rule allows 5 in the last ten. v5.0 seeded 5. Seeded here as 4. The Death templates in §6.1 are written with 5 deep fielders and trimmed automatically, so either value works.
- **Circle radius.** 23 m (25.15 yards) is the women's international figure; v5.0 said 30 yards, which is the men's.
- **Reduced-overs matches.** Rain-shortened games change the windows. v1 uses the full-match windows; the user simply picks the phase that applies.

### 2.2 Phases

Exactly three phases, mutually exclusive: **Powerplay**, **Middle**, **Death**. The over windows come from §2.1. The user picks the phase by chip; no over number is entered.

### 2.3 Fielding laws enforced in every phase

1. At most `max_deep` fielders outside the circle for the active phase (§2.1).
2. At most **5 fielders on the leg side** at the instant of delivery.
3. At most **2 fielders behind square on the leg side** (Law 28.4.1), not counting the wicketkeeper.
4. Exactly **9 fielders** on the map. The bowler and wicketkeeper are drawn separately and never counted among the 9.

Rules 2 and 3 were not modelled in v5.0. Confirm rule 2's number against the rule book along with §2.1.

### 2.4 Modifiers (one-tap toggles on top of the phase)

| Modifier | Engine action (Step 6) |
|---|---|
| New batter in | Repeat Step 2's Attack once (skipped if Tail-ender already did it) |
| Set batter | Protect on the batter's scoring side: movement In → (deep midwicket, long-on); Away → (deep cover, long-off) |
| Need wickets | Repeat Step 2's Attack once |
| Protect runs | Remove the last-added close catcher to the nearest free ring position |
| Old ball reversing (pace only; Middle and Death only) | Applied **before Step 2**: the bowler's movement flips (Away ↔ In). Then Protect(Away → third man; In → fine leg) |
| Overcast / Dry / Dew | Recorded and shown in the rationale. No field change in v1 |

"New batter in" and "Set batter" are mutually exclusive, as are "Need wickets" and "Protect runs". "Old ball reversing" exists only in the One-Day instance.

---

## 3. Club login and roles

### 3.1 Accounts
- Email and password sign-in through Supabase Auth. The app never stores or sees a password. Session persists across app restarts; several devices per user at once is supported.
- Password reset by emailed link. Requires a custom SMTP sender; Supabase's built-in sender is rate-limited and not suitable for production.
- Not in v1: social login, two-factor authentication.

### 3.2 Creating and joining a club
- **Create:** sign up → name the club → that user is the club's first Admin.
- **Join:** by invite only. An Admin generates an invite (link plus short code) with a role already assigned and an expiry date. Each invite is single-use.
- Claiming an invite is one server-side function (`claim_invite(code)`) that, in a single transaction, checks the invite is unused and unexpired, creates the profile row with the invite's club and role, and marks the invite used. The `invites` table is never readable from the client.
- A user belongs to exactly one club.

### 3.3 Roles

| Action | Admin | Coach | Captain | Player |
|---|---|---|---|---|
| Open the selector and view a generated map | ✓ | ✓ | ✓ | ✓ |
| View players and their bowling data | ✓ | ✓ | ✓ | ✓ |
| Add or edit players and bowling data (§4) | ✓ | ✓ | — | — |
| Save a field / add a note (Phase 2, §8) | ✓ | ✓ | ✓ | — |
| Invite, remove, change roles; edit club name | ✓ | — | — | — |

Map generation runs in the browser from data the user is already allowed to read, so every role can generate a map; roles restrict **writes** only. (v5.0 said Players could not generate a map, which contradicted its own user description and could not be enforced.)

### 3.4 Security requirements
- **Club isolation at the database.** Every club-scoped table has row-level security: a row is visible only when its `club_id` equals the caller's club. A UI bug must not be able to expose another club's data.
- **Role checks at the database.** Write policies check the caller's role. Hiding a button is not a permission.
- **No self-promotion.** A user cannot update `role` or `club_id` on their own profile row. Role changes go through an Admin-only server function.
- **Last Admin protected.** The server refuses to remove or demote a club's only Admin.
- The profile table holds `user_id`, `club_id`, `role`, `display_name` only. Email and password stay in Supabase Auth.

---

## 4. Player details

### 4.1 Player record
One list per club, shared by both instances. A player record does not need an app account.

| Field | Values | Required |
|---|---|---|
| Name | text | yes |
| Batting hand | Right / Left | yes |
| Batting type | Aggressive / Accumulator / Technical / Finisher / Tail-ender | no |
| Bowls | yes / no | yes |
| Bowling arm | Right / Left | if bowls |
| Bowling family | Pace / Spin | if bowls |
| Pace band (pace only) | Fast / Fast-medium / Medium | if pace |
| Swing shape (pace only) | Outswing / Inswing / None — **as it behaves to a right-handed batter** | no, default None |
| Spin type (spin only) | Off-spin / Leg-spin / Left-arm orthodox / Left-arm wrist-spin | if spin |
| Keeper stands up | yes / no — default yes for spin, no for pace | no |

Spin type fixes the bowling arm (off-spin and leg-spin are right-arm; the two left-arm types are left-arm), so the form sets the arm automatically for spinners.

### 4.2 Bowling line and length data
Entered per bowler **per format**, because a bowler's plan in T20 is often different from her plan in a one-day match. This instance reads and writes the **One-Day** set.

**Line — five percentages, must total 100**

| Bucket | Meaning (relative to the stumps of the batter faced) |
|---|---|
| Outside off | Wide of off stump — the channel and wider |
| Off stump | On or just outside off stump |
| Middle stump | On middle |
| Leg stump | On leg stump |
| Outside leg | Down the leg side |

**Length — three percentages, must total 100**

| Bucket | Meaning |
|---|---|
| Short | Short of a length and shorter |
| Good length | On a good length |
| Full | Full, including yorkers and half-volleys |

**Entry rules**
- Line and length are two independent groups. Either group may be filled without the other.
- Within a group it is all or nothing: all five line values, or all three length values.
- Whole numbers 0–100. The form shows a running total and blocks save unless the group totals exactly 100. A "scale to 100" button rescales proportionally when the total is between 95 and 105.
- Optional: **balls sampled** (how many deliveries the percentages are based on) and a free-text source note. If balls sampled is entered and is under 30, the map shows a "small sample" marker; the data is still used.
- Line is recorded once and applied to both right- and left-handed batters. Separate figures per batter hand are a possible later addition (§10).

### 4.3 Fallback when data is missing
Checked separately for line and for length, in this order:

1. Use this bowler's **One-Day** data.
2. If none, use this bowler's **T20** data and mark the map "using T20 data".
3. If none, apply no adjustment for that group. The field is the **generic field for the bowling type** (base template plus movement bias, §5.3 Steps 1–2) and the map is marked "generic field — no line/length data".

A bowler who is not in the player list at all can still be selected through the generic bowler chips (arm, family, pace band or spin type, swing shape). That always produces the generic field.

---

## 5. Field-generation engine

A pure function: `generateField(rules, bowler, bowlingData, batter, phase, modifiers) → { fielders[9], keeper, bowlerMark, firedRules[] }`. It has no network or database dependency at call time, so once the app has loaded it keeps working with no reception at the ground. It is unit-tested against §9.

### 5.1 Coordinate frame
- Top-down view, **bowler's end at the top of the screen**, striker at the bottom.
- Each position is (θ, r). θ is degrees clockwise from the direction striker → bowler. r is 0 at the striker's stumps and 1 at the boundary.
- Screen conversion, SVG axes (x right, y **down**), striker at (cx, cy), boundary radius R pixels: `x = cx + R·r·sin θ`, `y = cy − R·r·cos θ`.
- For a **right-handed** batter the off side is the **right** of the screen (θ 0–180) and the leg side is the left (θ 180–360).
- For a **left-handed** batter, replace θ with 360 − θ. Nothing else changes.
- All engine logic works in **batter-relative** terms (off side / leg side). Mirroring is purely the last drawing step.

### 5.2 Positions
Each position has a **zone**. Zone, not radius, decides whether a named fielder counts as outside the circle.

| Zone | Position | θ | r |
|---|---|---|---|
| Close | 1st slip | 168 | 0.17 keeper back / 0.05 keeper up |
| Close | 2nd slip | 160 | 0.17 / 0.05 |
| Close | 3rd slip | 152 | 0.17 / 0.05 |
| Close | Gully | 135 | 0.20 |
| Close | Leg slip | 192 | 0.15 / 0.05 |
| Close | Silly point | 75 | 0.06 |
| Close | Short leg | 285 | 0.06 |
| Close | Short cover | 50 | 0.16 |
| Close | Short midwicket | 310 | 0.16 |
| Ring | Short third man | 150 | 0.36 |
| Ring | Backward point | 110 | 0.36 |
| Ring | Point | 90 | 0.36 |
| Ring | Cover | 60 | 0.36 |
| Ring | Extra cover | 40 | 0.36 |
| Ring | Mid-off | 20 | 0.38 |
| Ring | Mid-on | 340 | 0.38 |
| Ring | Midwicket | 300 | 0.36 |
| Ring | Square leg | 272 | 0.36 |
| Ring | Short fine leg | 215 | 0.36 |
| Deep | Third man | 150 | 0.92 |
| Deep | Deep backward point | 110 | 0.92 |
| Deep | Deep point | 90 | 0.92 |
| Deep | Deep cover | 60 | 0.92 |
| Deep | Long-off | 15 | 0.92 |
| Deep | Long-on | 345 | 0.92 |
| Deep | Cow corner | 325 | 0.92 |
| Deep | Deep midwicket | 300 | 0.92 |
| Deep | Deep square leg | 272 | 0.92 |
| Deep | Fine leg | 215 | 0.92 |
| Deep | Deep fine leg | 200 | 0.92 |
| — | Wicketkeeper | 180 | 0.15 back / 0.02 up |
| — | Bowler | 0 | 0.33 (bowling crease) |

- **Leg side** = θ strictly between 180 and 360. **Behind square on the leg side** = θ strictly between 180 and 270 (leg slip, short fine leg, fine leg, deep fine leg).
- The circle is drawn at `circle_radius_m ÷ nominal_boundary_m` from §2.1. Ring positions sit inside it.
- Each deep position has an **inner partner**, the ring position at the same angle: third man → short third man; deep backward point → backward point; deep point → point; deep cover → cover; long-off → mid-off; long-on → mid-on; cow corner and deep midwicket → midwicket; deep square leg → square leg; fine leg and deep fine leg → short fine leg. If the partner is occupied, use the nearest free ring position by angle.
- Table values are seed data in `field_positions`, editable without a code change.

### 5.3 Algorithm
Every step is expressed batter-relative. A step that cannot find a fielder to move, or whose target is already occupied by every option, is **skipped** and recorded as skipped in `firedRules`.

**Two shared operations**
- **Attack(list)** — add a close catcher: take the first free position in `list`. Fund it by removing the first ring fielder present from the donor order for the *opposite* side; if that side has no ring fielder, use the same side's donor order. Skipped if the phase's close-catcher cap (§6.2) is already reached.
  - Leg-side donor order: short fine leg, square leg, midwicket, mid-on.
  - Off-side donor order: short third man, backward point, point, extra cover, cover, mid-off.
- **Protect(list)** — make sure a deep position is manned: take the first position in `list` not already occupied. If the deep count is below the phase limit, fund it from the first close catcher present in this order: leg slip, short leg, silly point, short midwicket, short cover, gully, 3rd slip, 2nd slip, 1st slip; if there is no close catcher, from the opposite side's ring donor order. If the deep count is already at the limit, **relocate** instead: move the lowest-priority deep fielder (§6.1 keep order) that is not in `list`.

**Step 1 — Base template.** Pick the template for (bowling family, phase) from §6.1. If the batter type is **Finisher**, use the Death template whatever the phase.

**Step 2 — Movement bias.** Work out whether the ball moves **away** from this batter (towards her off side) or **in**, using the real batter hand:

| Bowler | Right-handed batter | Left-handed batter |
|---|---|---|
| Off-spin | In | Away |
| Leg-spin | Away | In |
| Left-arm orthodox | Away | In |
| Left-arm wrist-spin | In | Away |
| Pace, Outswing | Away | In |
| Pace, Inswing | In | Away |
| Pace, None | Away | Away |

(Swing shape is stored as it behaves to a right-hander, so it reverses for a left-hander. "None" defaults to Away because the natural angle across the batter produces outside edges.)

- **Away:** Attack(pace: 1st slip, 2nd slip, gully, 3rd slip · spin: 1st slip, silly point, short cover).
- **In:** Attack(pace: short midwicket, leg slip · spin: short leg, leg slip, short midwicket). If the catcher cap blocks this, instead move the squarest slip already in the field to the first free position in that list.

**Step 3 — Line adjustment** (skipped if no line data, §4.3). Let `OFF = outside off + off stump`, `LEG = leg stump + outside leg`, `STRAIGHT = off stump + middle + leg stump`. First match wins:

| Tag | Trigger | Field change |
|---|---|---|
| Sprayed | OFF ≥ 55 **and** LEG ≥ 30 | None. No side to favour. |
| Off-channel | OFF ≥ 55 | Move the first leg-side ring donor to the first free of: backward point, extra cover, short third man. If outside off alone ≥ 40, also Protect(third man, deep point). |
| Leg-drift | LEG ≥ 30 | Move the first off-side ring donor to the first free of: square leg, short fine leg, midwicket. Also Protect(fine leg, deep square leg). If outside leg alone ≥ 15, fine leg becomes top keep-priority for Step 7. |
| Straight | STRAIGHT ≥ 65 | Ensure both mid-off and mid-on are in the ring, moving the first donor from whichever side has more ring fielders. |
| Balanced | otherwise | None. |

**Step 4 — Length adjustment** (skipped if no length data, §4.3). First match wins:

| Tag | Trigger | Field change |
|---|---|---|
| Short-heavy | Short ≥ 35 | Pace: Protect(deep square leg, third man). Spin: Protect(deep midwicket, deep point). |
| Full-heavy | Full ≥ 40 | Powerplay: ensure both mid-off and mid-on are in the ring (as "Straight" above). Middle and Death: Protect(long-on, long-off). |
| Good-length | Good ≥ 55 | None. The base templates assume a good length. |
| Mixed | otherwise | None. |

**Step 5 — Batter type.**

| Batter type | Field change |
|---|---|
| Aggressive | Movement In → Protect(cow corner, deep midwicket, long-on). Movement Away → Protect(deep cover, long-off, deep point). |
| Accumulator | None. |
| Technical | Same ring shift as Off-channel. Skipped if Off-channel already fired. |
| Finisher | Handled in Step 1. |
| Tail-ender | Repeat Step 2's Attack once more. Pace only: then Attack(short leg). |

**Step 6 — Modifiers**, in the order listed in §2.4.

**Step 7 — Enforce the laws (§2.3)**, in this order:
1. *Close-catcher cap* (§6.2): while over the cap, move the last-added catcher to the nearest free ring position.
2. *Deep limit:* while over `max_deep`, bring the lowest keep-priority deep fielder in to her inner partner.
3. *Leg side ≤ 5:* while over, move the first leg-side ring donor to the first free of: cover, point, mid-off, extra cover.
4. *Behind square leg ≤ 2:* while over, move the first present of short fine leg, leg slip, deep fine leg to the first free of: square leg, midwicket.
5. Assert exactly 9 fielders, all on distinct positions.

**Step 8 — Keeper and bowler.** Keeper up or back from the player record (§4.1); slips and leg slip use the matching radius.

**Step 9 — Mirror** for a left-handed batter (θ → 360 − θ).

**Step 10 — Rationale.** One line built only from `firedRules`, for example: *"Off-spin to a left-hander, middle overs: turning away → slip added. Line 62% off side → extra fielder at backward point. No length data."*

All thresholds (55, 30, 40, 15, 65, 35, 40, 55, small-sample 30) live in an `engine_thresholds` config row, not in code.

---

## 6. One-Day base templates

### 6.1 The six templates
Written for a right-handed batter, before Step 2. Deep fielders are listed in **keep-priority order** — the last one listed is the first brought in when the limit is lower.

| Template | Close | Ring | Deep (keep-priority order) |
|---|---|---|---|
| Pace · Powerplay | 1st slip, 2nd slip, gully | cover, mid-off, mid-on, square leg | third man, fine leg |
| Pace · Middle | 1st slip | point, cover, mid-off, mid-on | third man, fine leg, deep square leg, deep cover |
| Pace · Death | — | short third man, backward point, extra cover, short fine leg | long-on, long-off, deep square leg, deep midwicket, deep cover |
| Spin · Powerplay | 1st slip | point, cover, mid-off, mid-on, midwicket, short fine leg | deep midwicket, deep cover |
| Spin · Middle | 1st slip | point, cover, midwicket, short fine leg | long-on, deep midwicket, long-off, deep square leg |
| Spin · Death | — | point, extra cover, midwicket, short fine leg | long-on, cow corner, long-off, deep square leg, deep cover |

The One-Day templates are more attacking than the T20 ones: three catchers behind the wicket with the new ball, and a slip kept through the middle overs. With the seeded Death limit of 4, Step 7 brings deep cover in to cover (or the nearest free ring position).

### 6.2 Close-catcher cap
Maximum close-zone fielders (keeper excluded) after all steps:

| Powerplay | Middle | Death |
|---|---|---|
| 4 | 3 | 1 |

---

## 7. Screens

Mobile-first, usable one-handed in direct sunlight. Do not rely on colour alone: close, ring and deep fielders use different marker shapes as well as colours, and every fielder has a text label.

1. **Sign in / Create club / Join with invite.**
2. **Field (home).** Club name in the header with the instance name (One-Day). Chip rows: Grade · Phase · Bowler (club bowlers first, then generic type chips) · Batter (type and hand; club players selectable for intra-club practice) · Modifiers. The map sits directly below and redraws on every change with no "generate" button and no spinner. A **Flip hand** button mirrors the map for the other batter. Under the map: the rationale line and any markers (generic field, using T20 data, small sample, rules unconfirmed). The last selection is remembered per user.
3. **Players.** List with search. Each bowler row shows a badge: "line + length", "line only", "length only" or "no data". Admin and Coach see Add / Edit; the edit form includes the line and length groups with running totals (§4.2).
4. **Club** (Admin only). Members, invites, club name.
5. **Reference.** Read-only glossary of positions, phases and how the engine uses line and length.

---

## 8. Data model and delivery phases

**Global reference tables** (readable by any signed-in user, writable only by the service role)
- `format_rules` (format, grade, overs, pp_end_over, death_start_over, max_deep_pp, max_deep_middle, max_deep_death, max_leg_side, max_bowler_overs, circle_radius_m, nominal_boundary_m, confirmed, source_ref)
- `field_positions` (name, zone, theta, r, r_keeper_up nullable, inner_partner nullable)
- `base_templates` (format, bowling_family, phase, positions[], deep_keep_order[])
- `engine_config` (format, catcher caps per phase, thresholds json)

**Club tables** (row-level security on `club_id`)
- `clubs` (id, name, created_at)
- `profiles` (user_id → auth.users, club_id, role, display_name)
- `invites` (id, club_id, code, role, expires_at, used_by nullable) — no client access; used only through server functions
- `players` (id, club_id, name, batting_hand, batting_type, bowls, bowl_arm, bowl_family, pace_band, swing_shape, spin_type, keeper_up, active, updated_by, updated_at)
- `player_bowling_data` (player_id, club_id, format, line_outside_off, line_off, line_middle, line_leg, line_outside_leg, len_short, len_good, len_full, balls_sampled, source_note, updated_by, updated_at) — primary key (player_id, format); check constraints: each group is all-null or totals 100

**Phase 1 (this brief):** club login and roles (§3), player details with line and length (§4), engine and map for One-Day with grade selection (§2, §5, §6), Field / Players / Club / Reference screens (§7), the QA matrix (§9).

**Phase 2:** drag-to-adjust and saved fields per bowler × phase (stored as right-hander-normalised coordinates with format and grade, mirrored on load); shared history, saved only when a selection has been unchanged for 5 seconds and is not a duplicate of the previous entry; naming fielders from the player list.

**Phase 3:** separate line/length figures per batter hand; per-ground boundary sizes; multi-club membership.

---

## 9. Acceptance tests

All rows are automated unit tests on `generateField`, except rows 21–24.

| # | Setup | Expected |
|---|---|---|
| 1 | Right-arm pace, Outswing, RHB, Powerplay | Extra slip added on the off side (screen right) |
| 2 | Same, LHB | Movement is In → short midwicket on the leg side; drawn on screen right after mirroring |
| 3 | Right-arm pace, Inswing, LHB | Movement is Away → extra slip on the off side, drawn on screen left |
| 4 | Off-spin, RHB, Middle | In → short leg added (leg side, screen left) |
| 5 | Off-spin, LHB, Middle | Away → 1st slip added (off side, screen left) |
| 6 | Leg-spin, RHB, Middle | Away → 1st slip (screen right) |
| 7 | Leg-spin, LHB, Middle | In → short leg (screen right) |
| 8 | Left-arm orthodox, RHB | Same catcher side as row 6 |
| 9 | Left-arm wrist-spin, RHB | Same catcher side as row 4 |
| 10 | Any bowler, batter = Finisher, phase = Powerplay | Death template used, then reduced to the Powerplay deep limit |
| 11 | Every bowler × hand × phase × grade, no data | Deep count ≤ `max_deep` for that phase and grade |
| 12 | Same sweep | Leg-side count ≤ 5 and behind-square-leg count ≤ 2 |
| 13 | Same sweep | Exactly 9 fielders on 9 distinct named positions; close count ≤ cap |
| 14 | Change `max_deep_middle` in config from 4 to 5 | Middle-overs fields gain one deep fielder with no code change |
| 15 | Line 40/20/20/10/10 (OFF 60), vs same bowler with no data | One more off-side ring fielder; third man or deep point manned |
| 16 | Line 10/20/30/20/20 (LEG 40) | One more leg-side ring fielder; fine leg manned; laws still pass |
| 17 | Line 35/25/5/15/20 (OFF 60, LEG 35) | Tag = Sprayed; field identical to no-line-data field |
| 18 | Length 45/40/15, pace | Deep square leg manned |
| 19 | Length 10/40/50, Middle | Long-on manned |
| 20 | Bowler with no One-Day data but with T20 data; bowler with neither | First: T20 data used and marker shown. Second: generic field and "generic field" marker |
| 21 | Signed in to Club B, request Club A's `players` and `player_bowling_data` by id through the API | Refused by the database |
| 22 | Signed in as Player, write to `players` or `player_bowling_data` through the API | Refused by the database |
| 23 | Signed in as Coach, update own `role` to admin through the API | Refused |
| 24 | Claim the same invite code from two browsers at once | Exactly one succeeds |
| 25 | One-Day, Grade 1 vs Grade 2, same situation | Same field; only the over windows and bowler-overs shown differ, read from config |
| 26 | Right-arm Outswing, RHB, Middle, Old ball reversing on | Movement becomes In → short midwicket, and fine leg manned |
| 27 | Old ball reversing with a spinner, or in Powerplay | Toggle unavailable |

**Speed:** signed-in user, app already loaded — a correct map for a new situation within 10 seconds; selecting a club bowler changes the map in under 100 ms.

---

## 10. Open questions

1. **Rule book numbers (§2.1, §2.3).** Supply the 2026/27 VPC rule book, or the values for each grade, so the seeds can be confirmed.
2. **Coach sign-off on cricket content.** The six templates (§6.1), catcher caps (§6.2) and all thresholds (§5.3) are reasonable club-level defaults written for this document, not a Premier coach's judgement. They are configuration, so a coach's corrections need no code change.
3. **Line per batter hand.** One set of line figures is applied to both right- and left-handers. Is that acceptable for v1?
4. **Who may edit bowling data.** Currently Admin and Coach only. Should a Captain, or the bowler herself, be allowed?
5. **Where the percentages come from.** Typed by hand in v1. If the club has scoring-app or video-tagging exports, a CSV import could follow.
6. **Does each grade need its own bowling data?** Currently one set per bowler per format, shared across grades.
