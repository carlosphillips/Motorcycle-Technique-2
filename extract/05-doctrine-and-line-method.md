# Doctrine Engine — Grading a Line Against the Book's Method

## 1. What this engine is for

The simulator (`moto-sim/1`) exists to make Lee Parks' cornering doctrine **causal and inspectable** rather than asserted. A rider — human author or the machine `author` verb — commits only *inputs*: where to brake and how hard, where to turn in and how quickly to roll to lean, where to pick up throttle. Everything the doctrine cares about — **apex position, apex timing, exit position, run-wide behaviour, and lean angle — emerges from the physics integration**, never from a knob. There is no `apex` field anywhere in the input schema; this is grep-provable and is the structural enforcement of the book's rule #5, "the turn point is the master decision."

The **doctrine engine** is the layer that turns a finished trajectory into a **verdict**: a per-corner and global judgment of whether the ridden line obeyed the book. It is deliberately split from measurement:

- **`analyze.js`** — a pure measurement layer. Given a trajectory's `samples` and the `RoadModel`, it computes the geometric and kinematic *facts*: apex station/position/class, exit state, run-wide detection, corner-to-corner link continuity, danger-zone dwell, grip margin, and the line-vs-road radius ratio. It measures; it does not judge. It also owns `diagnose()`, the root-cause classifier for *why* a run was not clean.
- **`doctrine.js`** — the grading engine. It runs a fixed set of **12 named checks** (`checks_version: 1`, "DESIGN §7") over the already-simulated trajectory plus the already-measured `analysis` bundle, producing a per-check verdict (`pass`/`fail`/`warn`/`na`) plus a summary. It is pure: it never integrates, never touches the road model directly, and **never throws** — every check body is wrapped so any internal error degrades to `na`.

The design intent, stated throughout the design of record: **doctrine is computed from emergent physics, not asserted.** Asking the engine whether a line was good is asking an exact trajectory function, not soliciting an opinion.

---

## 2. The book's line-selection method, restated

The doctrine the engine operationalizes is distilled in `STANDARD.md` from *Total Control* Chapter 8 ("Line Selection") plus the supporting physics chapters. The engine's 12 checks are the mechanical encoding of the following tenets.

### 2.1 The ideal street line

Quoting the book: *"When conditions permit and there are no hazards, a good street line is described as an 'outside-inside-outside' path of travel."* The canonical shorthand used across the whole project is:

> **a single smooth-arc, late-apex, outside–inside–outside path.**

Concretely:

- **Outside–inside–outside, late (delayed) apex.** Enter wide, delay the turn point, touch the inside *past* the geometric middle of the corner, and drift back out already pointed down the road.
- **One smooth, continuous arc — a single steering input, one radius.** *"By taking the straightest line through a curve, lean angle is reduced and traction is maximized."*
- **`Arc = Speed`.** The radius of the chosen line is directly proportional to the carryable speed. Because sustainable speed scales as `v ∝ √r` (see §6), a bigger-radius line lets you carry more speed at the same lean. The street rider banks that surplus as hazard reserve rather than spending it on speed.
- **The turn point is the master decision.** *"Creating the ideal line through a turn starts with the choice of a turning point."*
- **Quick steering, then throttle.** Delay entry, countersteer to the needed lean *quickly*, then roll on throttle to stabilize the chassis and drive out.
- **Slow in, fast out.** *"It is always better to err on the side of a slow entry and faster exit than vice versa"* — entry-speed discipline over corner-entry bravado.

### 2.2 Trail-braking and throttle roll-on

Two chassis-behaviour rules from the book underpin two of the checks:

- **Throttle roll-on (Keith Code Rule #1).** Once the bike is turned, get to a stabilizing throttle: a maintenance "crack" at/before the apex, `v_min` at/before the apex, then a smooth roll-on driving out. Getting off the gas or braking at high lean makes the bike stand up and run wide — a crash precursor — which is *why* "quick steering + early throttle is safer."
- **Trail-braking taper.** When braking is carried past the turn-in (an advanced variant, not the baseline), the brake must be released smoothly and monotonically as lean builds, tapering off so little residual braking remains at the apex. Note the deliberate design decision: **trail braking is NOT the canonical clean baseline.** The foundational clean scenario is "brake-complete-then-quick-steer" per `STANDARD.md` §1; trail braking is a separately-labelled advanced technique. A red-team review flagged that treating trail brake as the baseline over-generalizes an advanced skill.

### 2.3 The three canonical mistakes

All three share one consequence — they force a wide exit, "magnified with speed" — and most single-vehicle curve crashes involve running wide at the exit:

1. **Premature initiation** (turning in too soon → early apex). The most common mistake; forces the line wide or demands a mid-corner steering correction, commits the rider blind, and hides oncoming hazards on blind corners.
2. **Slow steering** (too long from upright to full lean → the "danger zone"). This is about *steering-input duration*, not travel speed; it keeps the bike at the vulnerable lean angle too long. The rule is to minimize both time-at-lean and the number of entries into the danger zone.
3. **Fifty-pencing** (multiple mid-corner corrections — British slang for a many-faceted line resembling the edges of a 50-pence coin), usually from not looking far enough through the turn. This is explicitly distinguished from a **double apex**, which is a *legitimate* two-touch line, not fifty-pencing.

### 2.4 Special cases

Each special case shifts a threshold or exempts a check:

- **Decreasing-radius turn** ("the dreaded one"): slower entry, deeper/later turn point, single late apex — the late-apex bar moves later.
- **Increasing-radius turn**: apex earlier, throttle on earlier/harder — late-apex classification is not applicable.
- **Double apex**: by definition "will require at least one mid-turn correction"; a legitimate two-inside-touch line drawn deliberately, distinct from fifty-pencing.
- **Linked turns / esses**: think more than one turn ahead; a mistake amplifies through the sequence.
- **Blind / walled / crest corners**: delay turn-in, hold wide to open the sight line, keep a lean *reserve*, never touch the barrier.

---

## 3. What `analyze.js` measures from a trajectory

`analyze.js` is measurement only — no solvers, no judging. Every function is pure and independently callable. The doctrine checks consume its outputs.

### 3.1 Coordinate and position conventions

- **Screen y-down frame** (so SVG export needs no vertical flip). `+d` = the rider's **LEFT**, absolute regardless of turn direction, so obstacle placement never needs re-deriving per corner hand. Signed offset: `pathOffsetD(road, sample) = (x−c.x)·sin(c.psi) − (y−c.y)·cos(c.psi)`.
- **Lane fraction `f`** is the *primary doctrine-facing position*, because raw `d` is doctrine-ambiguous (rider's-left is the outside edge on a right-hander but the inside edge on a left-hander). It is hand-independent:
  - `f = 0` → inside usable edge
  - `f = 1` → outside usable edge
  - `f > 1` → into oncoming / past the far edge

  Using `f`, an agent can compare mixed left/right corners directly with no sign gymnastics. Positions come from `road.laneFraction`.

### 3.2 The measurement functions

| Function | Returns | What it measures |
|---|---|---|
| `measureApex(samples, road, corner)` | `{s_apex, d_apex, f_apex, clearance_m, apex_pct, v_apex, phi_max_deg, phi_max_at_s}` | Apex = station of **minimum lane fraction** (closest approach to inner usable edge). Apex timing via `apex_pct` (see below). |
| `classifyApex(apex_pct, corner, config)` | `"late"` \| `"early"` \| `"na"` | Trend-aware early/late classification. |
| `measureExit(samples, road, corner)` | `{s_exit, d_exit, f_exit, heading_err_deg}` | First station at/after apex where heading has returned to the exit heading. |
| `detectRunWide(samples, road, corner, config)` | `{ran_wide, d_max, s, edge, s_detect, s_react}` | Peak outward excursion and whether the line left its lane. |
| `measureLink(samples, road, cornerA, cornerB)` | `{from, to, at_s, linked, d_gap, d_continuous, heading_gap_deg, heading_continuous, entry_f, entry_ok}` | Continuity between an adjacent corner pair. |
| `vLimPointwise(road, s, muUse)` | m/s | Point-wise speed limit `√(aLatReserve(muUse) / \|kappa_road(s)\|)`, `Infinity` on a straight. |
| `vMinStation(samples)` | `{s, v}` | Minimum-speed station. |
| `dangerZone(samples, config)` | `{entries, dwell_s}` | Entries into and dwell inside the high-lean danger band. |
| `gripMarginMin(samples)` | `{grip_margin_min, at_s}` | Worst grip margin anywhere on the line. |
| `lineVsRoadRadius(samples, road)` | `[{s, r_line, r_road, ratio}]` | `ratio = r_line/r_road`; `1` = tracking the road exactly. |
| `diagnose(bundle)` | `null` \| `{cause, at_s, corner_id, detail}` | Single root-cause classifier (§7). |

### 3.3 The apex — one definition so verdict and number can never diverge

The apex is defined *once*, canonically:

```
s_apex = argmin_s ( d_inner_edge(s) − d_path(s) )      # closest approach to the inner usable edge
```

Apex *timing* is `apex_pct`, the fraction of the corner's **cumulative swept angle** consumed at the apex station:

```
apex_pct = 100 * cum[apexIndex] / total       # cum = cumulative |Δpsi| swept along the trajectory
```

Cumulative swept angle is monotone even on stepped-arc corners, so the number stays well-defined. Crucially, **this is the exact quantity `classifyApex` judges** — the number reported and the verdict rendered can never disagree, because they are computed from the same scalar.

`classifyApex` reads the corner's radius trend (substring match on `radius_trend` / `line_type`: "increas" / "decreas" / else "constant") and applies a trend-aware bar:

- **Increasing-radius** → `"na"` (apex-late doesn't apply; governed by assertion #19).
- **Decreasing-radius** → `late` iff `apex_pct > 60`.
- **Constant-radius** → `late` iff `apex_pct > 50`.

### 3.4 Exit, run-wide, and links — measurement detail

- **`measureExit`**: first station at/after apex where `|psi − psi_exit| < EXIT_EPS_DEG (2.0°)`, searched over the corner span plus a bounded `EXIT_LOOKAHEAD_M = 25.0 m` of exit straight (capped before the next corner); falls back to corner-end.
- **`detectRunWide`**: finds the peak outward lane fraction; `ran_wide` iff `peakF > 1`. `edge` classifies the overshoot as `"lane"` (into oncoming but still on the carriageway) vs `"road"` (past the far edge) via `roadEdgeOvershoot = bike_margin_m + lane_width_m`. The reaction/recognition station is `s_react = s_detect + v · t_react`, with `DEFAULT_T_REACT_S = 1.0 s` (config `profiles.street.t_react_s`).
- **`measureLink`** tuning constants: `LINK_MIN_STRAIGHT_M = 1.0`, `LINK_BRAKE_RESET_MS2 = 1.0` (harder braking on the connecting straight counts as a *reset* → `linked: false`), `LINK_HEADING_DEG = 3.0`, `LINK_D_GAP_M = 0.4`, `LINK_ENTRY_OUTER_MIN = 0.5` (the next corner must be entered with `entry_f ≥ 0.5`, i.e. from its outer half).
- **`dangerZone`** uses a band `|phi| ≥ phi_reserve` by default — e.g. **40.36° at skill 0.85, μ 1.0** — overridable via `config.danger_band_lo_deg`.

---

## 4. The verdict structure

### 4.1 The doctrine engine's own output

The sole doctrine entry point is:

```
SIM.doctrine.checkAll(scenario, trajectory, analysis)
  → { checks_version: 1,
      checks: [ { id, corner, verdict, evidence } ],
      summary: { pass, fail, warn, na,
                 expected_fail_present, missing_expected_fail, unexpected_fail } }
```

- `SIM.doctrine.CHECK_IDS` is a frozen array of the 12 stable check-id strings; output order is preserved.
- Each `Check` carries `id`, the `corner` it applies to, a `verdict` ∈ `pass|fail|warn|na`, and human-readable `evidence`.
- `safeCheck(id, corner, fn)` wraps every check body: any thrown error becomes `{ verdict: "na", evidence: "internal: <msg>" }` — no exception escapes `checkAll`.
- `summarize(checks, scenario)` tallies the pass/fail/warn/na counts and reconciles the actually-failed ids against the scenario's declared `expect_fail` (see §5.2).

### 4.2 The assembled Tier-1 verdict

`simulate.js` assembles the checks into the full ≤2 KB Tier-1 verdict JSON that the CLI emits:

```
{ ok, spec_hash, result_hash, checks_version, engine: "moto-sim/1.0.0",
  scenario, outcome, headline,
  diagnosis: null | { cause, at_s, corner_id, detail },
  corners: [ { id, reached, turn_in_s, apex_s, apex_pct, apex_f, apex_clearance_m,
               v_apex_kmh, lean_max_deg, lean_max_at_s,
               grip_margin_min, grip_margin_min_at_s,
               exit: { s, d, f, heading_err_deg },
               ran_wide, corrective: null | {…}, crash?: { s, phi_deg, kind } } ],
  sight: { margin_min_m, at_s, v_at_s_kmh, note } | null,
  doctrine: { pass, fail, warn, na,
              expected_fail_present, missing_expected_fail, unexpected_fail },
  files: { trace, render } }
```

- **`outcome`** ∈ the closed set `clean | wide | runoff | violation | crash | dnf-spec-error`, with precedence `crash > runoff > wide > violation > clean`.
- **`spec_hash`** is computed from the scenario; **`result_hash`** is an `fnv-1a` hash over the canonicalized verdict, deliberately **excluding `result_hash` and `diagnosis` themselves**. Excluding `diagnosis` lets the root-cause narrative be refined without perturbing the frozen preset bytes. (fnv-1a, not `node:crypto`, so hashing still works from a `file://` browser origin.)

---

## 5. The 12 checks — measurement → verdict criteria

### 5.1 Where the thresholds live (and why the split matters)

There are two threshold sources, but the doctrine/tuning line is drawn *per-constant by comment*, not by file — and it cuts through `config.js` itself, not cleanly between the two files:

- **`config.js` holds both doctrinal *and* tuning constants**, and the file's own header states the policy: "Every threshold with NO book source is marked `// TUNING` and must never be attributed to Parks/Code; book-derived values cite their source." Only three of its bars are actually doctrinal:

  | Constant | Value | Meaning | Status in `config.js` |
  |---|---|---|---|
  | `mu_default` | `1.0` | dry asphalt μ | doctrinal ("dry asphalt physical coefficient") |
  | `apex_late_pct` | `50` | constant-radius late-apex bar | doctrinal ("doctrine, not tuning") |
  | `apex_late_pct_decreasing` | `60` | decreasing-radius late-apex bar | doctrinal (`STANDARD.md` §3) |
  | `blind_reserve_deg` | `35.0°` | lean reserve on blind corners | **`// TUNING`** |
  | `single_input_delta_phi_deg` | `1.5°` | steering-hump smoothing tolerance | **`// TUNING`** |
  | `quick_steer_max_s` | `1.0 s` | steering-ramp time bar (WARN only) | **`// TUNING`** |

  So living in `config.js` does *not* by itself make a threshold book-traceable — three of the six carry the same `// TUNING` quarantine marker as the `doctrine.js` constants below.

- **`doctrine.js` holds only tuning constants**, explicitly marked "simulator-internal; NEVER attributed to Parks/Code":

  ```
  OIO   = { outside_min: 0.55, inside_max: 0.45, swing_min: 0.4 }
  THR   = { eps_accel: 0.05 (m/s²), vel_tol: 0.1 (m/s), a_step_max: 1.5 (m/s²),
            chop_tol: 0.5 (m/s²), rollon_late_m: 12.0 (m), lean_est_frac: 0.95 }
  TRAIL = { redeepen_tol: 0.3, resid_frac: 0.35 }
  LINK  = { heading_gap_deg: 3.0, d_gap_m: 0.4 }
  RIDE  = { kappa_step: 0.01, rate_tol_dps: 2.0, phi_jump_deg: 3.0 }
  SMALL_LEAN_DEG = 3.0
  ```

  It is the per-constant `// TUNING` comment — enforced in both files — not the file boundary, that keeps the "attributable to the book" line auditable.

### 5.2 The checks and their exact pass/fail arithmetic

| # | id | Verdict logic |
|---|---|---|
| 1 | **`late_apex`** | Classify apex via `apex_pct` against the corner-frame-aware bar: increasing-radius → `na` (assertion #19); decreasing-radius → late iff `apex_pct > 60`; constant-radius → late iff `apex_pct > 50`. |
| 2 | **`out_in_out`** | Uses lane fractions at turn-in (`ti.f`), apex (`apex.f`), exit (`exit.f`). **PASS iff** `ti.f ≥ 0.55 && apex.f ≤ 0.45 && exit.f ≥ 0.55 && swing ≥ 0.4`, where `swing = max(ti.f, exit.f) − apex.f`. (Constants from `OIO`.) |
| 3 | **`single_input`** | Counts interior local maxima of `\|phi(s)\|` via a hysteresis walk (`countInteriorMaxima`, tol = `single_input_delta_phi_deg` = 1.5°). Single-apex corners must have ≤1 hump; `double_apex`-tagged corners tolerate ≤2 (one correction); **≥3 always fails** as "fifty-pencing," even for a double apex. |
| 4 | **`quick_steer`** | Brackets the 10%→90% steering ramp on `\|phi(s)\|` and measures `dt`. **WARN** (informational, *not* FAIL) if `dt > quick_steer_max_s` (1.0 s). |
| 5 | **`throttle_rule`** (Keith Code Rule #1) | Requires all of: (a) a maintenance crack (`\|accel\| ≤ 0.05`) at/before apex and not more than 12 m before steering-complete; (b) `v_min` at/before apex; (c) roll-on onset not later than `apex + 12 m` (`rollon_late_m`); (d) from onset to exit, `dv/ds ≥ −0.1`, no throttle chop (`a_long < −0.5` after steering-complete), and non-abrupt (`\|Δa_long\| ≤ 1.5` between 0.5 m samples). |
| 6 | **`trail_brake_taper`** | `na` if braking completes before turn-in (the baseline). Else requires a monotone brake release after peak (no re-application beyond `redeepen_tol = 0.3`) and residual braking at apex `≤ 0.35 × peak` (`resid_frac`), else WARN "incomplete taper." |
| 7 | **`traction_ceiling`** | **FAIL** if `\|a_lat\| > aLatMax(mu)·(1+eps_mag)` anywhere, or `grip_margin < −eps_mag` anywhere (`grip_margin = 1 − ellipse_mag`), or a crash/lowside/termination event falls inside the corner window. Uses **physical** μ (see §6, one-μ policy). |
| 8 | **`lean_ceiling`** | Compares `phi_max_deg` against `reserveDeg = phiReserve(mu_use)·RAD2DEG` (capped at `blind_reserve_deg = 35°` if the corner is tagged blind) and `ceilDeg = phiMax(mu)·RAD2DEG`: **PASS** if `≤ reserve`, **WARN** ("ate the reserve") if `≤ ceiling`, **FAIL** ("lowside") if `> ceiling`. |
| 9 | **`sight_vs_stopping`** | Delegates to a pre-computed `sight` object `{ok, margin_m, worst:{s, sight_m, ssd_m, margin_m, v_kmh}}`; `na` if the geometry is not modeled (e.g. vertical/crest sight in v1). |
| 10 | **`exit_containment`** | **PASS iff** exit lane fraction `f_exit < 1.0` (not past the outer edge into oncoming). |
| 11 | **`link_continuity`** | Per declared corner-pair link. `na` if `linked === false` (not a flowing pair — adjacent arcs or a brake-reset). Else requires `d` continuity (`\|d_gap\| ≤ 0.4 m`), heading continuity (`\|heading_gap_deg\| ≤ 3.0°`), and correct entry side (`entry_ok`: the next corner entered from its outer half). |
| 12 | **`rideability`** | Global. **FAIL** if `\|dphi/dt\| > roll_rate_dps + 2.0` anywhere (`rate_tol_dps`), or if `kappa` jumps by `> 0.01` between adjacent samples (`kappa_step`, a discontinuous path), or a `phi` jump `> 3.0°` (`phi_jump_deg`) occurs with near-zero `dt`. |

Note the deliberate severity gradations: `quick_steer` only *warns* because slow steering is informational rather than crash-causing at the verdict level; `lean_ceiling` has a three-band reserve/warn/fail ladder that mirrors the book's "keep reserve" doctrine; `single_input` distinguishes a tolerated double-apex correction from disqualifying fifty-pencing.

---

## 6. The physics the criteria rest on (one-μ policy)

The checks reference a small set of physics functions (`SIM.physics`) with one binding design decision — the **one coefficient-of-friction policy [R1]**, called "the single most important physics correction" in the design of record. The draft used a skill-derated μ in *both* the friction ellipse and the hard ceilings, which produced a 40.4°–45° band that was simultaneously NaN/WARN/CRASH — self-contradictory. The fix:

- **Physical μ** is used for every hard ceiling and the friction ellipse.
- **Skill-derated `mu_use = skill · μ`** (skill 0.85 street / 0.95 expert) sets *only* the soft-reserve thresholds.

Key quantities (μ = 1.0 dry, `g = 9.81 m/s²`):

```
kappa(v, phi)  = g·tan(phi) / v²          # emergent-curvature identity — why the apex emerges
a_lat          = v²·kappa = g·tan(phi)
a_lat_max      = mu·g
a_long_max     = mu·g
ellipse_mag    = sqrt((a_long/a_long_max)² + (a_lat/a_lat_max)²)
grip_margin    = 1 − ellipse_mag
phi_max        = atan(mu)                  # = 45.0° at mu = 1.0   (hard ceiling)
a_lat_reserve  = mu_use·g                  # = 8.34 m/s² at skill .85, mu 1
phi_reserve    = atan(mu_use)              # = 40.4° at skill .85, mu 1   (soft reserve)
```

The lean/speed/radius relations from `STANDARD.md` §4 that the doctrine leans on:

```
tan θ = v² / (g·r)          # θ = lean from vertical
v     = √(g·r·tan θ)   ⇒   v ∝ √r  at fixed lean   — the square-root law behind "Arc = Speed"
tan θ_max = μ              # grip ceiling (≈45° at μ = 1.0)
```

Sight vs stopping (check #9) rests on the **hard-doctrine invariant** that sight distance is speed-independent geometry (ray-cast), while only stopping distance shrinks with `v²`:

```
SSD(s) = v(s)·t_react + v(s)² / (2·a_ssd)     # evaluated at the LOCAL instantaneous v(s)
```

with named presets **alert** (`a_ssd = 7.0 m/s²`, `t_react = 1.0 s`) and **AASHTO-conservative** (`a_ssd = 3.4 m/s²`, `t_react = 2.5 s`). A frozen invariance test guarantees SSD never implies a decel greater than `μg` — making the course's confirmed "sight shrinks with speed" bug impossible by construction.

---

## 7. Diagnosis — root cause when a run is not clean

When the outcome is not clean, `analyze.diagnose(bundle)` assigns a *single* root cause from a closed set, by first-match precedence — so the "why" is deterministic, not a heuristic guess:

| Precedence | Cause | Trigger |
|---|---|---|
| 1 | `grip_exceeded` | a crash event |
| 2 | `roll_rate_limited` | run-wide **and** the corrective is feasible-but-rate-limited (`phi_req_deg < ceiling`) |
| 3 | `sight_deficit` | negative sight margin |
| 4 | `overspeed_entry` | run-wide **and** the corrective needs `phi_req_deg ≥ ceiling` and the apex is not early |
| 5 | `late_brake` | braking still active at/after turn-in |
| 6 | `plan_gap` | else — early apex, bad out-in-out, or a bare doctrine miss |

`diagnosis` is excluded from `result_hash`, so this narrative can be improved without churning preset bytes.

---

## 8. The preset system — the library of canonical corners

The doctrine is exercised against a registry of **canonical corners** — every teaching example in the course expressed as a `{ scenario, expect }` pair. This is where the engine is proven correct: a preset's `expect` block is the **validation oracle**.

### 8.1 Preset shape and registry

```
Preset  = { id, title, group, chapter, quiz_ref, expect, scenario }
expect  = { outcome, pass:[checkId…], fail:[…], warn?:[…], na?:[…], expect_fail?:[…], notes? }
```

Each `scenario` carries `{ spec:"moto-sim/1", id, road:{lane_width_m, bike_margin_m, use_full_width, segments:[straight|arc|taper]}, rider:{profile, start:{speed_kmh, d}, plan:[…]}, config:{mu, mode, ds_m, checks_version}, expect_fail?, obstacles? }`.

Registry API (`SIM.presets`): `register(preset)`, `get(id)`, `byGroup(group)`, `byChapter(chapter)`, `all()`, `ids()`. Presets self-register via classic-script side effects (no import/export/require) — the modules `presets-anatomy.js`, `presets-corner-types.js`, and `presets-special.js` call `SIM.presets.register(...)` at load time. A duplicate or non-string id throws at load; every entry is `deepFreeze`d on insert.

### 8.2 The three preset groups

| File | Group | Chapters | Contents |
|---|---|---|---|
| `presets-anatomy.js` | `anatomy` | 5–8 | Corner-anatomy baseline + the 3 canonical mistakes (premature turn-in/early apex, slow-steering/danger-zone, fifty-pencing via a `double_apex` `line_type` exemption). 9 presets, all on a canonical **R60 90° right-hander, total length 254.5 m**. |
| `presets-corner-types.js` | `corner-types` | 9–10 | Trail-braking + decreasing/increasing-radius apex frames. 5 presets. |
| `presets-special.js` | `special` | 11 / 14 / 15 | Blind bends + sight/reserve, linked S-bend + double-apex, crest (sight `na`), and a static-correctable-but-shot-runs-off case. |

### 8.3 The oracle loop — the engine's verdict must *match*, not be told

The preset system encodes the project's central rule: **a mismatch between the engine's emergent verdict and a preset's declared `expect` is treated as a simulator bug or a preset mis-authoring — never patched by editing `expect`.**

The loop:

1. An author adds a scenario with a hand-written `expect` block encoding what doctrine *should* say.
2. `tests/presets*.test.mjs` runs `SIM.simulate.run(scenario)` for every preset and asserts the emergent verdict matches `expect` exactly.
3. `expect_fail: [checkId]` on a scenario is reconciled by `summarize()` against the actually-failed ids, producing `expected_fail_present` / `missing_expected_fail` / `unexpected_fail`. This means **a "mistake" preset is *required* to actually fail the doctrinal check it claims to teach** — not merely asserted to. If the early-apex preset does not actually fail `late_apex`, the test breaks.

### 8.4 Byte-stability tripwire

Any intended change to engine output must be *deliberately re-blessed*:

- `tests/bless-preset-hashes.mjs` runs every registered preset **and** every `simulator/scenarios/*.json` scenario through `SIM.simulate.run`, extracts `spec_hash` + `result_hash`, and writes them to the canonical, key-sorted, 2-space-indent `tests/fixtures/preset-hashes.json`.
- `tests/preset-hashes.test.mjs` is the tripwire: any drift in a registered preset's or scenario's hash pair — or presets and fixture going out of sync (added/removed without re-blessing) — fails the suite. Silent hash drift is thereby caught as a regression rather than patched around.

### 8.5 Documented preset design tensions (honest limits, not hacks)

The presets record where the as-built engine cannot reach the book's ideal, keeping the limitation honest:

- **Stepped-radius geometry cannot be ridden clean.** A genuine 2-arc decreasing-radius corner (e.g. R90→R45) cannot be ridden clean by the current controller — a single committed lean can't tighten across a same-direction arc boundary (verified across ~40 tuning attempts). So the decreasing-radius "trap" preset *keeps* the 2-arc geometry to teach the run-off, while a separate `taper`-segment "true-taper" twin demonstrates the same lesson on a continuously-tightening clothoid the engine *can* grade against a single tagged `line_type`.
- **Two escalations** in `presets-special.js` record that a doctrinal `expect` is not reachable by the as-built engine, because `position` plan actions are a no-op in `integrate.js` and `simulate.js` hardcodes `analysisBundle.links = []`.
- **The `chop` mistake cannot produce a run-wide outcome** in this point-mass model — the book's chop lesson is a Tier-2 chassis load-transfer effect (out of v1 scope). A throttle cut here only decelerates, pinching the arc *inward*, producing an honest `violation` rather than the book's `wide/runoff`. Flagged, not special-cased.

---

## 9. Two callers: grading human lines and self-verifying machine figures

The same doctrine engine sits behind both directions of use.

### 9.1 Grading a human/course-authored line

`plan.js` compiles the human's declarative `rider.plan` (an ordered list of `brake` / `turn_in` / `throttle` / `position` actions, each addressed by a stable string `id`) into a pure `Controller` the integrator steps each tick:

```
SIM.plan.compile(rider, road, config) → Result<Controller>
```

`compile` validates action ids, `at_s` finiteness, and per-`do`-type ranges; resolves the effective roll rate (`rider.roll_rate_dps` else the profile's); and **signs turn-ins by corner hand** (`sign = corner.hand === "left" ? −1 : 1`). A `turn_in { target: "tangent_inside" }` is marked `deferred` (a marker with `lean_rad: 0`, `needsShoot: true`); Phase-2's `shoot.js` root-finds the concrete lean magnitude, then `SIM.plan.resolveTangentInside(controller, resolvedLeans)` rebuilds the controller with the signed lean spliced in.

The declarative intent turns into a per-instant `control(state)` returning commanded lean, roll-rate cap, and longitudinal accel; the integrator produces a `Trajectory`; `analyze.js` measures it; `doctrine.checkAll` grades it. **Apex, exit, run-wide, and lean all emerge** — the human authored only inputs.

### 9.2 Self-verifying a machine-authored figure

The v2 `author` verb is the front door: hand it a road + a turn-in station and it runs the per-corner inverse solve (filling in brake decel and roll-on), **then re-runs the *same* engine on its own output to self-verify**, and gates on the verdict. A non-clean author exits with code `3` — but still draws the mistake line so the failure is visible. The `--mistake <spec>` compiler perturbs exactly one input off the solved good line, forward-runs the *real* engine, and reports the engine's own outcome/diagnosis; nothing is asserted by the compiler — **"physics is the validator, not the generator."**

Both paths route through `checkAll`, so a machine-authored figure is held to precisely the same 12 checks and the same thresholds as a hand-authored teaching scenario. That symmetry is the whole point: the doctrine verdict is a property of the *trajectory*, computed identically no matter who authored the inputs, and never asserted by whoever drew the line.
