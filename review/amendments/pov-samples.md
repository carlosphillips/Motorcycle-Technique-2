## POV Gaze + Sample-Contract Additions (`pov-samples`)

> **EDITORIAL RECONCILIATION (binding) — 2026-07-19 editor pass.** Merged against the
> thirteen sibling amendment sections per the three reconciliation audits. Where the
> body below disagrees with a bullet, the bullet wins.
>
> - **This section WINS:** the stored su split (`su_sustained` + `su_transient`;
>   `phi_dot_su` ≡ their sum, derived notation project-wide — runwide-physics' and
>   doctrine-catalogue's stored-`phi_dot_su` rows re-key to it) and the five-token
>   phase machine `approach|turning|midcorner|exiting|done` (bug-sheet 9.11's six-value
>   fold retires; `C-PHASE-TOTAL` re-keys to five tokens; brake_start opens no phase).
> - **This section LOSES on `a_cmd_rate`:** it IS recorded (runwide-physics wins; the
>   in-place correction below). Merged CSV order after `limit_y`: `sight_ride_m,
>   steer_state, lat_action_id, su_sustained, su_transient, a_cmd_rate,
>   below_validity` (05 §2.1, one block).
> - **Steering enum** on stateAt/HUD surfaces: `steer_state ∈
>   "track"|"commit"|"unwind"|"position"` (merged corner-exit/position-channel
>   machine; `lat_mode` retired).
> - **Phase openers** are the single partition (05 §4.1 opener table): turn_in→turning,
>   steering_complete→midcorner, roll_on→exiting, exit→approach|done; `release` and
>   terminal events open no phase; extension only via the opener table.
> - **Outcome/quality words** on any HUD/legend surface: outcome ∈ crash|runoff|wide|
>   stopped|contained (Option B); quality ∈ good|caution|failing (the amber tier word
>   is `caution` — editor homonym fix).
> - A-SU-ATTRIBUTION rides the renamed oracle fixtures (F-ORACLE-90/DR/CHAIN; kinds
>   `premature`/`premature_contained` per the project rename).

Closes review §6's POV-teaching-device bullet, the sample-contract-additions bullet, and the
phase-vocabulary bullet; plus §9 items 11 (phase clause) and 14. Five mechanisms:
(1) the off-frame limit-point clamp-with-arrow rule, (2) the `look` camera toggle,
(3) the gaze placard in 01 §8, (4) per-sample stand-up recording with the 00 §4
reconciliation, (5) one phase vocabulary shared by `stateAt` and the controls strip.

No mechanism here touches a verdict, an outcome class, a hash input, or an input schema's
physics surface — D6/D7/D8/D9 are untouched by construction (each mechanism states why).

---

### 1. The off-frame limit-point rule: clamp-with-arrow

#### 1.1 Verification of the review's geometry claim (CONFIRMED, independently recomputed)

For an eye on a circular arc of radius `R`, a limit point at arc distance `a` ahead has chord
bearing `β = a / (2R)` rad off the tangent (inscribed-angle theorem). With yaw = `psi` the
tangent is the optical axis, so the marker leaves a 60° frame when `β > 30°`, i.e.

```
a_offframe = R · fov_rad = 12 × 1.0472 ≈ 12.6 m        (on the R 12 presets)
```

Recomputed on the presets (rider on centreline; wide `f` makes bearings slightly larger, so
these are the *favourable* numbers):

- `book90`, mid-corner (45° consumed), **no occluders**: the limit point is the road end
  (remaining 9.42 m arc + 16 m exit straight); chord bearing = **36.8° > 30°** — off-frame.
- `bookBlind`: the hedge holds `sight_m` short early in the corner (marker in frame); the
  doctrinal **opening** moment is precisely when `sight_m` grows through ~12.6 m — the marker
  exits the frame at the exact instant the speed-release cue (01 §6) fires.
- Frame roll makes it worse, not better: at the suggested entries `phi ≈ 37.2°` (34 km/h) /
  `33.9°` (32 km/h), the rotated rectangle's usable horizontal half-angle at the horizon row
  is *less* than 30°, so exit happens earlier than the flat-frame arithmetic says.

The review's claim stands. `fov_deg` is TUNING but no plausible widening fixes a 36.8°
bearing plus roll; the fix must be a marker rule, not a constant.

#### 1.2 Mechanism (replaces 07 §5.3 item 7's single sentence)

The limit-point marker has a closed two-state presentation:

```
markerState = "placed" | "clamped"        (closed set; appears in the frame draw list)
```

**Geometry test.** Per frame, transform the sample's recorded `(limit_x, limit_y, 0)`:
translate by the eye `(x, y, eye_height_m)`, rotate by `−yaw` (yaw per the active `look`
mode, §2) into camera axes `(F forward, L lateral)`; then:

1. **If `F > near_m`:** project per 07 §5.2 (`u = f·L/F`, `v = v_horizon + f·eye_height_m/F`)
   and rotate `(u, v)` by `−phi` about the principal point → final frame point `p`.
2. **In-frame predicate:** `p` lies inside the **inset rectangle** `R_inset` = the frame
   rectangle shrunk on all sides by `CHEVRON_INSET = 0.05 × min(frame_w, frame_h)`
   (TUNING; the inset keeps the clamped glyph fully visible). If yes → `markerState =
   "placed"`, chevron at `p`, exactly as today.
3. **Otherwise (`p ∉ R_inset`, or `F ≤ near_m`):** `markerState = "clamped"`.
   - Direction ray: from the principal point `P0` through `p` when the projection exists
     (`F > near_m`); when `F ≤ near_m`, through `rotate(−phi)` of the pre-roll direction
     `(sign(L), 0)` — "the limit point is off to the left/right at eye level". Both branches
     give a unit direction `d̂` in final frame coordinates.
   - **Clamped chevron position** = the intersection of the ray `P0 + k·d̂ (k > 0)` with the
     boundary of `R_inset` (unique because `P0` is interior).
   - **Arrow semantics:** an arrowhead is drawn on the chevron's outward side pointing along
     `d̂` — the direction the gaze must turn to bring the true limit point into frame. The
     arrow exists **iff** `markerState = "clamped"`: its presence *is* the off-frame signal.
     Arrow length `1.2 ×` chevron size (renderer style constant, presentation-only).
   - The **trend badge** (opening/closing/steady) stays attached to the chevron in both
     states — the mid-corner "opening" cue is now readable even while the point is off-frame.

**Invariant (new, normative):** every POV frame of every line contains exactly one
limit-point marker. G9's "with the limit point marked" becomes unconditional; there is no
sample at which the POV silently drops its teaching device.

This is pure presentation over recorded fields (`limit_x, limit_y, x, y, psi, phi` are all in
05 §2.1) — no physics, no contract fields, no hashes move.

#### 1.3 Placement

- **07 §5.3 item 7** — replace the current two sentences with §1.2's marker spec (the
  "chevron at the base of the occluder" sentence is kept verbatim as the `placed`-state
  refinement).
- **07 §5.2** — add `CHEVRON_INSET` to the camera-model TUNING constants.
- Contradicts/replaces: nothing else; 06's top-down limit-point drawing is untouched.

---

### 2. `look: heading | limit_point` — the camera-yaw toggle

#### 2.1 Mechanism

A closed two-value POV camera mode, **pure presentation over recorded per-sample data**:

```
look = "heading" (default) | "limit_point"
```

- **`heading`** — yaw = `psi`, exactly today's 07 §5.2. Default, because the POV's stated job
  is "where the rider is pointed" and mistake lines must not imply their rider looked through
  the turn (the fifty-pence rider, per the book, did not).
- **`limit_point`** — the yaw law:

  ```
  bearing = atan2(limit_y − y, limit_x − x)                       // world bearing, eye → recorded limit point
  yaw     = psi + clamp(wrapDeg(bearing − psi), −LOOK_MAX_DEG, +LOOK_MAX_DEG)
  LOOK_MAX_DEG = 70   // TUNING, range 60–90: max head-turn from the bike's heading
  ```

  `wrapDeg` is shortest-arc (−180, 180]. Roll stays `= phi` in both modes (the head rides the
  bike; the horizon-tilt honesty rule of §5.2 is unchanged). All inputs (`x, y, psi, phi,
  limit_x, limit_y`) are recorded Sample fields — **verified against 05 §2.1: every needed
  field is already in the contract**; interpolated queries use the already-pinned `linear`
  rule for `limit_x/limit_y`. No new recording is required.

Semantic guard rails, stated normatively:

- `look` is a **camera control, not a gaze model**: it never enters `sightFrom` (the eye is
  positional only), never touches a verdict, a check, `result_hash`, or any recorded field.
  The frame remains a pure function `frame(result, lineId, cursor, look)`.
- Because the recorded limit point can jump between samples (occluder-edge release), the yaw
  under `limit_point` may step visibly. That is honest — the limit point *does* jump — and
  the `LOOK_MAX_DEG` clamp bounds the swing; no smoothing state is introduced (would break
  frame purity).
- Under `limit_point`, the marker is near frame-centre by construction; §1's clamp rule still
  covers the residual case where the clamp at `LOOK_MAX_DEG` leaves it outside.
- The POV HUD strip (07 §5.3 item 8) gains a mode chip — `look: limit point` — plus a small
  **heading tick** on the horizon line marking where `psi` points, so the head-turn amount is
  always disclosed in-frame (placard policy: a rotated camera must not read as a rotated bike).

#### 2.2 Spellings (all three surfaces)

| Surface | Spelling |
|---|---|
| JSON (`ViewSpec`, 06 §2.1) | `look?: "heading" \| "limit_point"` — new optional key, default `"heading"`; consumed by every POV renderer (viewer pane, `render --views pov`); like `mode`, it is a per-view presentation field, valid in any ViewSpec (D8: it is effectual wherever a POV frame is produced) |
| Scene text (`view:` line, 04 §7) | `view: … look=limit_point` (token key `look=`, values verbatim) |
| CLI (08 §3 `render`) | `--look heading\|limit_point` (default `heading`); composes with the `--line` focus selector the CLI cluster is pinning — the POV renders the focused line's camera |
| Viewer UI (07 §6.1) | a `look` toggle in the POV pane's controls, beside the path-overlay toggle |

Unknown values are rejected `SCHEMA` with a `schema_ref` (closed set, D8).

#### 2.3 Placement

- **07 §5.2** — add the `look` mode block and yaw law after the "Yaw = psi" bullet; the
  existing parenthetical "(target fixation and head-turn modelling are out of scope)" is
  **replaced** by: "gaze *behaviour* is out of scope (01 §8 placard); the `look` toggle is a
  camera control over recorded data, not a rider model."
- **07 §6.1** — add the toggle to the side controls list.
- **06 §2.1** — add `look` to the ViewSpec grammar (one line; note "consumed by POV only,
  ignored by no renderer that draws a POV frame").
- **04 §7** — add `look=` to the `view:` line's key list ("vocabulary owned by 06" already).
- **08 §3 / §4.1** — add `--look` to `render`'s flag list.

---

### 3. The gaze placard (01 §8)

The design's gaze cut currently exists only as a parenthetical in 07 §5.2, while the book
attributes all three canonical mistakes to gaze (verified verbatim in
`book_text/parts/part0014`): "it's important to look through the turn before you enter it";
premature initiation "often happens when the rider fixates on the inside of the turn";
fifty-pencing "is usually caused by not looking far enough through the turn".

**Add to 01 §8's "Out of scope, refused honestly (D5)" list, after the body-position bullet:**

> - **Rider gaze and target fixation.** The book attributes the canonical mistakes to vision
>   behaviour — looking through the turn, inside-fixation, not looking far enough ahead —
>   and linelab does not model it: no gaze state exists, no mistake kind perturbs vision, and
>   no check grades where the rider looks. What the tool offers instead is the *geometry* of
>   gaze: the recorded limit point on every sample, the POV's limit-point marker (never
>   dropped, `07`), and the `look: limit_point` camera toggle that makes "look through the
>   turn" a literal button. Any check or scenario feature that would require a gaze *model*
>   answers `{na: "rider gaze behaviour not modelled"}` — never a fabricated gaze.

This also adds the typed `na` reason string `"rider gaze behaviour not modelled"` to the
placard vocabulary (same class as the vertical-geometry placard).

**Placement:** 01 §8 bullet list, verbatim above. Contradicts nothing; it converts a silent
cut into a placarded one, and cross-references §2's toggle as the honest partial substitute.

---

### 4. Per-sample stand-up recording (the run-wide channel)

#### 4.1 Shape decision: record the split, not the sum

Chosen shape: **two fields, `su_sustained` and `su_transient`**, rather than one `phi_dot_su`.
Rationale: the review's surviving nucleus is *attribution* — a trace reader must be able to
tell a transient-impulse run-wide from a sustained-brake run-wide and audit the `stand_up`
diagnosis; the sum alone cannot. The net value is recovered by addition (below), so nothing
is lost, and one derived field avoids storing a redundant column.

**Append to 05 §2.1 as a new block after "Commanded controls" (written by `core/`):**

| Field | Type | Units | Meaning |
|---|---|---|---|
| `su_sustained` | number | deg/s | Signed roll-rate contribution of the sustained stand-up term actually applied this step: `−sign(phi) · S_sustained · tanh(\|phi\|/PHI0)` (02 §5.2), converted rad→deg |
| `su_transient` | number | deg/s | Signed roll-rate contribution of the transient (chop) term actually applied this step, same sign and envelope; if the physics re-derivation restates the transient as an impulse, this field records the realized `Δphi/dt` of the step it lands in — the field pins the *applied disturbance*, not the term's internal form |

Contract rules:

- **Identity (normative):** `phi_dot_su ≡ su_sustained + su_transient` at every sample. The
  net disturbance is derived, never stored (same rule as `sight_margin_m`).
- **Exact zero when gentle:** under invariant 5.4.1's bit-identity condition both fields are
  exactly `0.0` — a sharp, tolerance-free test hook.
- **Interpolation rule (05 §3.2):** both fields `linear`.
- **Trace CSV (05 §8.2):** column order becomes `…, limit_x, limit_y, su_sustained,
  su_transient` — append-only, as the contract already licenses. `result_hash` covers the
  verdict only and `spec_hash` covers inputs only, so this append moves **no hash** and needs
  no migration ceremony; only the CSV/export goldens re-bless.
- `a_cmd_rate` **is recorded** (merged: runwide-physics wins — this draft's objection
  predated the slew respec, under which `a_cmd_rate` is a dt-invariant per-step ZOH
  quantity that `P-SLEW` and the `throttle_rule` chop leg audit; the 200 Hz-
  reconstruction concern is obsolete). (The raw-series home question is 09-consistency
  item 6, owned elsewhere.)

#### 4.2 `stateAt.derived` additions — the `a_noreturn` display becomes contract-legal

**Append to the `derived` block (05 §4):**

```
stand_up_dps,      // su_sustained + su_transient — the net phi_dot_su, by the §2.1 identity
a_noreturn_ms2,    // A_SU_ONSET + roll_rate_rad / (K_SU · tanh(|phi|/PHI0))   (02 §5.3),
                   // computed by the same exported pure core function the engine uses;
                   // null when |phi| < 2° (upright immunity band, 02 §5.4.4 — no stand-up
                   // regime exists; the HUD renders "—")
```

Both are pure functions of recorded Sample fields (`phi`, `roll_rate`), so
`C-HUD-EQUALS-STATEAT` is satisfiable: the HUD reads them from `stateAt`, never re-derives.
02 §5.3's "the HUD may display it" promise is now buildable without breaking 07 §2.4.
*Interaction note:* if the physics cluster decouples `a_widen(phi, v)` from `a_noreturn` per
review §3, the derived block gains `a_widen_ms2` by the identical mechanism (pure function of
recorded `phi, v, roll_rate`); this section's mechanism transfers unchanged.

#### 4.3 The promised readouts, shown derivable

- **Controls strip (06 §4)** — the sentence "the run-wide slice's stand-up deviation is
  *visible* here" gains a mechanism. Add one channel bullet: "**stand-up** (`deg/s`):
  `su_sustained` and `su_transient` drawn as an overlaid pair (neutral palette) — nonzero
  exactly while the slice is acting. The `phi` vs `cmd_lean` divergence above it becomes
  *attributable*: rate-railing shows the tracker pinned at `roll_rate` with `su ≈ 0`;
  stand-up shows `su ≠ 0`."
- **HUD (07 §3.3)** — the Lean group gains two read-outs, both sourced from `stateAt`:
  a **stand-up chip** showing `stand_up_dps` (rendered only when nonzero), and
  **`a_noreturn`** ("brake ceiling at lean: 5.4 m/s²", "—" when upright). Source column:
  Sample + derived.

#### 4.4 Reconciling 00 §4's core-minimum list (review §9 item 14 + adjudicated polish)

**Replace 00 §4's core-per-sample bullet with:**

> - **Core per-sample fields** (a **declared minimum** — the full pinned table, and the Trace
>   CSV column order that follows it, live in `05` §2.1): `s, t, x, y, psi, v, phi, kappa,
>   a_long, a_lat, grip, mu, d, f` plus commanded controls (`cmd_lean`, `cmd_a`, `roll_rate`,
>   `action_id`, `clipped`, `n_long`, `n_lat`) plus sight (`sight_m`, `ssd_m`, `limit_x`,
>   `limit_y`) plus the run-wide split (`su_sustained`, `su_transient`).

This says "minimum" where 00 lists it (item 14's exact ask) and appends the three
commanded-control fields the adjudicated polish finding requested, so an agent primed on 00
is never surprised by the wire format.

---

### 5. One phase vocabulary

#### 5.1 Mechanism: a five-token opening-event machine (owned by 05)

The six-value `stateAt` set and 06's four bands are replaced by **one closed set** whose
every transition has a boundary predicate. Tokens are chosen **disjoint from the station
anchors (`entry|mid|exit:<cornerId>`) and the Event kinds** — the review confirmed the
triple-loading of `entry/mid/exit` as a live defect on an agent-facing field:

```
Phase = "approach" | "turning" | "midcorner" | "exiting" | "done"     (closed set)
```

**The machine.** Phase is a total pure function of the query point and the line's events
array: *phase at query `q` = the phase opened by the latest opener with `t ≤ t(q)`*.
Openers and the phases they open:

| Opener | Opens | Boundary predicate / notes |
|---|---|---|
| run start (first sample) | `approach` | Every line starts in `approach`; totality is guaranteed. `brake_start` **does not** bound a phase (it stays an event tick) — this answers "what precedes brake_start" and "what if the plan has no brake action": nothing changes, `approach` opens at the line start regardless. |
| `turn_in` (corner c) | `turning` | |
| `steering_complete` (c) | `midcorner` | `crack` opens no phase |
| `roll_on` (c) | `exiting` | |
| `exit` (c), c **not** the road's last corner | `approach` | chain re-entry: between corners the phase is the *next* corner's `approach` while the geometric `corner_id` is `null` — phase and `corner_id` are independent fields, stated explicitly |
| `exit` (c), c the road's last corner | `done` | `done` spans last-exit → termination, over *live samples* — it does not conflict with `BAD_RANGE` beyond termination, which remains the rule for queries past the end |

Rules, normative:

- **Skipped phases are legal.** Missing intermediate events skip their phase: a plan with no
  throttle action has an empty `exiting` (`midcorner` runs to `exit(c)`); a line with no
  `turn_in` stays `approach` throughout.
- **Terminal events open no phase.** A line crashing during `turning` *ends in* `turning` —
  the terminal fact lives in `terminated.reason`, never duplicated into phase. Early-
  terminated lines never reach `done`; `done` means "finished the road's corner work".
- **Half-open intervals.** A phase includes its opening instant (the sample at `turn_in`
  reads `turning`); event-time ties resolve by the events array's pinned declaration order
  (05 §5).
- **Interpolation:** `phase` follows the `hold` rule family — the latest opener at `t ≤ t(q)`.
- **Vocabulary discipline:** the five tokens are a namespace disjoint from anchors and event
  kinds; the book's *entry/mid/exit* words remain the anchors' and captions' vocabulary
  (prose may say "the book's 'entry' spans `approach`+`turning`"), never machine tokens.

#### 5.2 Placement

- **05 §4** — the `phase` line in `InstantState.derived` becomes
  `phase  // Phase, §4.1` and a new **§4.1 "The phase machine"** carries the table above.
  Replaces (contradicts) the current
  `"approach"|"entry"|"steering"|"mid"|"exit"|"done" (from events)` — `entry` is deleted
  (it never had a boundary), `steering → turning`, `mid → midcorner`, `exit → exiting`.
- **06 §4** — the "Corner-phase bands" bullet is **replaced** with: "**Phase bands:** the
  vertical bands are exactly `05` §4.1's phase partition — one band per phase span, labelled
  with the phase token verbatim. The strip defines no partition of its own; `brake_start`
  remains an event tick, not a band edge." (Replaces the four-band derivation
  `approach (brake_start→turn_in), steering, mid (→roll_on), exit (→exit)` and its
  "labelled per the book's entry/mid/exit teaching vocabulary" clause — the book words move
  to caption prose per §5.1.)
- **00 §4** — add one vocabulary line: "**Phases (closed set, 05 §4.1):** `approach` |
  `turning` | `midcorner` | `exiting` | `done` — disjoint by design from station anchors and
  event kinds."
- *Interaction:* if the lean-unwind fix (review §2.1) adds an unwind event, it slots into
  this machine as a refinement of `exiting`/`done` boundaries — the machine's opener-table
  form is the extension point; that cluster should edit the table, not add a parallel one.
- The `dnf-spec-error` clause of review item 9.11 is **not** closed here — it belongs to the
  outcome/exit-tier cluster; noted so the editor doesn't double-count.

---

### 6. Contract impact (exact shapes, consolidated)

- `Sample` (05 §2.1, append-only): `+ su_sustained: number (deg/s)`, `+ su_transient: number
  (deg/s)`; identity `phi_dot_su = su_sustained + su_transient`; interpolation `linear`;
  CSV column order appends both after `limit_y`.
- `InstantState.derived` (05 §4): `+ stand_up_dps: number`, `+ a_noreturn_ms2: number | null`
  (null iff `|phi| < 2°`); `phase` value set becomes the five-token `Phase`.
- `ViewSpec` (06 §2.1): `+ look?: "heading" | "limit_point"` (default `"heading"`).
- POV frame draw list (07 §5.5's pure-function output): limit-point marker gains
  `markerState: "placed" | "clamped"` and, when clamped, an arrow direction — presentation
  shape, not a wire contract, but pinned so tests can assert it.
- New typed `na` reason: `"rider gaze behaviour not modelled"` (01 §8).
- New TUNING constants: `CHEVRON_INSET = 0.05 × min(frame_w, frame_h)`; `LOOK_MAX_DEG = 70`
  (range 60–90).
- **No change** to: outcome/diagnosis sets, check ids, `terminated.reason`, event kinds,
  `result_hash`/`spec_hash` inputs, exit codes, any input-plan schema.

### 7. Acceptance (09 additions)

Into **09 §6** (interactive-surface contract tests) unless noted:

- `C-POV-LIMIT-ALWAYS` — every POV frame of every fixture line contains exactly one
  limit-point marker, `markerState ∈ {placed, clamped}`, whose world source equals the
  sample's `(limit_x, limit_y)` (extends `C-POV-LIMIT-CONSISTENT`, which now must hold in
  **both** `look` modes).
- `G-POV-CLAMP-MIDCORNER` (golden) — `book90`, mid-corner sample (50 % sweep), `look:
  heading`: `markerState = clamped` and the arrow's horizontal sign points into the turn;
  pins the 36.8°-vs-30° arithmetic of §1.1 so a future `fov_deg` re-tune that changes the
  behaviour is a deliberate re-bless.
- `C-POV-LOOK` — (a) same sample under `look: limit_point`: `markerState = placed` and yaw
  equals the §2.1 law's worked value; (b) frames are pure: identical result → byte-identical
  draw lists per mode; (c) toggling `look` changes no `stateAt` output, no verdict, no hash.
- `A-SU-ZERO-WHEN-GENTLE` (09 §3.4 property) — on the clean C30 golden every sample has
  `su_sustained = su_transient = 0.0` exactly (invariant 5.4.1's bit-identity, now visible in
  the record).
- `A-SU-ATTRIBUTION` (09 §4, rides the mistake oracle's named fixtures) — chop fixture:
  `max |su_transient| > 0` and the `stand_up` diagnosis' evidence cites the su channel;
  sustained-brake fixture (fig 8.5 failed line): `max |su_sustained| > 0`. Trace-only
  auditability of the `stand_up` diagnosis is the point.
- `C-HUD-ANORETURN` — the HUD's `a_noreturn` and stand-up chips equal
  `stateAt.derived.a_noreturn_ms2` / `.stand_up_dps`; derived value equals the closed form
  over the recorded `phi`/`roll_rate`; `null`/"—" upright (extends `C-HUD-EQUALS-STATEAT`).
- `C-PHASE-MACHINE` — per fixture, the distinct-phase sequence over `t` equals a pinned
  expectation (C30 clean: `approach…done`; chop: ends in its pre-terminal phase, never
  `done`; `bookEsses`: contains the chain re-entry `…exiting|midcorner → approach →
  turning…`); phase changes occur only at opener events; querying an opener's exact `t`
  returns the opened phase.
- `C-STRIP-BANDS` — `renderControls` band edges equal the phase-transition stations of the
  same result: one partition, two consumers, zero drift.

### 8. Decision drafts (unnumbered; editor assigns)

- **Draft: "The limit point never leaves the POV frame; gaze is a placarded scope cut."**
  The POV's limit-point marker is unconditional via a clamp-with-arrow rule; a
  `look: heading | limit_point` camera toggle renders "look through the turn" as pure
  presentation over recorded per-sample data; gaze *behaviour* joins 01 §8's refused list
  with a typed `na` placard. Rationale: the book attributes all three canonical mistakes to
  gaze; the fixed-heading 60° camera loses the marker exactly at the mid-corner opening cue
  on the R 12 presets (36.8° bearing vs a 30° half-frame); the fix is presentation-only, so
  D4's sight model and every verdict are untouched.
- **Draft: "The run-wide channel is recorded, split."** `su_sustained`/`su_transient` join
  the Sample contract (identity: their sum is `phi_dot_su`), and `a_noreturn`/net stand-up
  join `stateAt.derived` as pure functions of recorded fields. Rationale: 05 §1's own rule
  ("if the engine knew it, the result records it") plus trace-auditability of the `stand_up`
  diagnosis; makes 06's promised stand-up readout and 02 §5.3's permitted `a_noreturn`
  display buildable without violating `C-HUD-EQUALS-STATEAT`.
- **Draft: "Phase vocabulary v2 — one five-token machine."** `stateAt.derived.phase` and the
  controls-strip bands share one closed set (`approach|turning|midcorner|exiting|done`)
  defined by an opening-event state machine in 05, with tokens disjoint from station anchors
  and event kinds. Rationale: closes the 05-vs-06 contradiction and the entry/mid/exit
  triple-loading; total by construction (run start opens `approach`), honest at terminals
  (`done` only via the last corner's exit; crashes keep their working phase).
