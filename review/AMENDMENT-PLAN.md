# linelab — Amendment Plan (the "one more hard pass")

**Date:** 2026-07-19 · **Status:** spec-ready, pre-implementation · **Design of record:** `design/00-README.md` (D1–D10) · **Review of record:** `review/DESIGN-REVIEW.md`

## What this document is

The design review's verdict was that `design/` names the right product but repeatedly
records **intentions where mechanisms are needed** — the engine cannot finish a corner,
the corrective shot is a name, the check catalogue exists nowhere, the solver's
constants don't fit its own presets. This document is the amendment plan that closes
that gap, organized by the review's own priority tiers (§11: P0 engine-blocking, P1
figure-blocking, P2 agent interface, P3 strategic).

**The mechanisms themselves live in `review/amendments/*.md`** — fourteen spec-body
sections, one per capability cluster, written in the design docs' register (closed
sets, `TUNING` marks, typed error names, worked arithmetic on the named presets). This
document integrates and indexes them; it does not duplicate them. Each amendment file
opens with a binding **EDITORIAL RECONCILIATION** banner recording how three
reconciliation audits (grammar surfaces, decision law, result contracts) merged the
fourteen sections into one mutually consistent whole — one token form per concept, one
merged shape per shared contract surface, one owner per surface. Where a banner bullet
and a section body disagree, the bullet wins.

Editor overrides of auditor resolutions (recorded, with reasons):

1. **Quality tier words** — one audit renamed the amber quality word to `caution`
   (killing the `contained (contained)` homonym); another audit's merged Verdict kept
   `"contained"`. The rename wins: `quality ∈ good | caution | failing`.
2. **Unwind→tracker handoff** — one audit proposed handing off at `PHI_TRACK_AUTH`
   (5°); that demonstrably breaks the ln-sec heading-capture formula's exactness, so
   the handoff stays at `EPS_UNWIND_DONE_DEG` (0.25°), per the "auditor wins unless it
   demonstrably breaks a mechanism" rule.
3. **Steering-state tokens** — the three audits produced three enums; the editor's
   merge keeps four states with position-channel's word for the commitment:
   `steer_state ∈ track | commit | unwind | position` (homonym hygiene: `track` must
   not mean "commitment" while a tracker exists).
4. **`expect` vs `expected`** — one audit collapsed them to one block; two kept both.
   Both are kept (different provenance classes), each defined exactly once in 05 §8.1.

## Scoreboard

| Axis | Count |
|---|---|
| Review §11 priority items closed | P0 7/7 · P1 8/8 · P2 9/9 · P3 6/6 |
| Review §8 wholecloth proposals specified | 8/8 (8.1–8.8) |
| Review §9 consistency bugs resolved | 14/14 |
| Review §2 structural blockers | 5/5 (2.1–2.5) |
| Amendment sections published | 14 (`review/amendments/`) |
| New decision-log entries drafted | **D11–D41** (§6 below) |
| Owner decisions pending | **42** (§7 below; every one carries a recommendation) |
| Consolidated re-bless migrations | **1** (one commit, every cause enumerated) |

## §0. The merged contract spine (what every section now agrees on)

These are the cross-cutting shapes the editor pinned; every amendment file cites them.

- **Outcome law (Option B, owner ratification pending §7-1):**
  `outcome ∈ crash > runoff > wide > stopped > contained` — physics-only, never reads
  a check (`P-OUTCOME-RUBRIC-FREE`). `clean` = derived predicate: `contained ∧ zero
  applicable check fails`. `violation` retired; `dnf-spec-error` deleted (refusals are
  `LineRefusal` envelope entries; runtime spec errors exit 4 `INTERNAL`).
  **Quality** (06 §5.1, one total function): `failing` iff outcome ∈
  {crash, runoff, wide} or a critical-severity check failed; `good` iff clean;
  `caution` otherwise (contained-with-fails, and all stopped). Colour: green/amber/red
  from quality alone (D9 intact).
- **Steering machine (02 §3.1):** `steer_state ∈ track | commit | unwind | position`;
  `commit` ends at the heading-capture `release` event (or a superseding `turn_in`);
  `unwind` rolls to upright at the profile rate and hands to `track` (the bounded
  lane-keeping tracker, `PHI_TRACK_AUTH_DEG = 5.0`) with the f-snapshot as `f_hold`;
  completed `position` holds. Precedence: corrective (shadow-run only) > unreleased
  pre-`s1` commit > position > unwind > track. Controller per-step output:
  `{steer_state, target_lean, roll_cmd, a_cmd, a_cmd_rate}`, `roll_cmd` pre-step ZOH.
- **Sample appends (05 §2.1, one block; CSV pinned order after `limit_y`):**
  `sight_ride_m, steer_state, lat_action_id, su_sustained, su_transient, a_cmd_rate,
  below_validity`. `phi_dot_su ≡ su_sustained + su_transient` (defined notation, never
  a column); `lat_mode` retired.
- **Termination (05 §2, 02 §7):** `terminated = {reason, s, t, x, y}`, `reason ∈
  crash | off_road | stopped | road_end | max_time | max_dist` (closed); per-step
  precedence in that order; "corner end" deleted as a terminator.
- **Event kinds (05 §5, closed):** `brake_start, brake_end, turn_in,
  steering_complete, crack, roll_on, apex, exit, release, position_start,
  position_complete, position_shortfall, sight_min, run_wide_detect, correction,
  off_road, hazard_visible, violation, crash, stop, road_end`. (`release` = the
  commitment release, every line; `correction` = corrective shot-start bookmark; the
  `violation` event survives as the constraint-breach bookmark — owner item §7-4.)
- **Verdict (05 §6.3, merged):** gains `rubric`, `quality`, `acceptance{policy,met}`,
  `misjudgment`, `validity`, `sight.holds[]` (with `hold_release_s`), per-corner
  `corner_type`, `turn_ins[] = [{s, lean_commit_deg, hand, release_s|null}]`,
  `apexes[] = [{s, pct, f, clearance_m, v_kmh, lean_deg}]` (ONE detector:
  hysteresis, `APEX_PROMINENCE_F = 0.08`, `APEX_MIN_SEP_M = 5.0`), `danger_dwell_s`
  (per-corner reserve-exceedance dwell in seconds, evidence only — arithmetic in
  doctrine-catalogue §3; test `A-DANGER-DWELL`),
  `corrective`. `CheckResult` becomes a typed object with scope/pair addressing.
- **Hash law (05 §8.3):** `result_hash = fnv1a(canonical verdict minus {result_hash,
  diagnosis, cache, skew} + resolved plan)`. Sample appends alone move no hash. All
  hash-moving changes land in ONE re-bless commit (09 §3.3), causes enumerated.
- **Envelope (05 §7):** `lines: [LineResult | LineRefusal]` (refusals keyed
  `line_id`); `LineResult` gains `resolved_scenario` (output provenance, excluded
  from spec_hash) and `cache`; `FigureResult` gains resolved `occluders`/`hazards`
  and `skew`.
- **FigureSpec (05 §8.1):** figure-level `engine_semver`; per-line `expect`
  (authored gate declaration, IN spec_hash; deliberately JSON-only — no scene key,
  no flag, per D30) vs `expected {outcome, result_hash}`
  (exporter stamp, EXCLUDED) vs `solved {spec_hash, plan}` (cached solver conclusion,
  EXCLUDED; must not ship without the stamps). `spec_hash` computed on the lowered
  form (`lowerScene`), so scene text vs JSON never changes identity.
- **Exit law (08 §3.1, one table):** tiers 0/1/2/3/4 (4 = `INTERNAL`);
  expectation-based gating (`gateFigure`); roles never gate; `figure`/`scene` bakes
  default-gated; story-tier skew exits 3 under `--gate`; `NO_SOLUTION` exits 3 on
  every verb; no chain-specific tier.
- **Grammar spine:** anchors `entry|exit|mid:<id>` (bare id = entry sugar; absolute
  `s:<m>`; offsets never inside the anchor); one mistake token
  `[lineId=]kind[:k=v,...][@scope]`; `hand` spells `L|R` wherever it means road/corner
  handedness, `left|right` only for rider-relative occluder sides; mistake kinds
  `premature, premature_contained, slow_steer, fifty_pence, chop, overspeed,
  underread, overread` (`early_apex` → `UNKNOWN_ID/renamed_kind` tombstone).
- **One pin table:** normative home 03 §7.1, machine-readable, feeds `schema
  mistakes` and the 09 §4 oracle (`ORACLE-PIN-TABLE`). Fixtures `F-ORACLE-90`
  (book90, now left-hand default), `F-ORACLE-DR` (bookDecreasing), `F-ORACLE-CHAIN`
  (the 4-corner bookEsses). Pins: `premature → runoff`, `premature_contained →
  contained (+ mandatory late_apex fail)`, `slow_steer → runoff (+ quick_steer)`,
  `fifty_pence → wide (+ single_input)`, `chop → runoff`, `overspeed → runoff`
  (admissible {wide, runoff, crash}).
- **Constants deleted by the merge:** `SPEED_VALID_MIN_KMH`, `EXIT_EPS_DEG` (+ its
  lookahead), `CHAIN_GAP_ARC_FRAC`, `GROUP_GAP_M`, `DA_RISE_F`, `book90L` (the name),
  `over_m` default 15, `config.mode`, `dnf-spec-error`, `commit_end`, `lat_mode`,
  `ssd_lean` (the spelling), `--corners`, scene `scope=`.

---

## §1. P0 — engine-blocking (the engine cannot be built without these)

### 1.1 Lean-unwind semantics + signed steering (review §2.1; fig 8.6 sign gap)

**Mechanism.** A four-state steering-channel machine (§0) with a **heading-capture
release**: while committed, each step computes the remaining road heading to the
governing corner's exit, `dpsi_rem = handSign(c.hand) · wrapToPi(psi_exit(c) − psi)`,
and the closed-form heading a constant-rate unwind will accrue, `dpsi_unwind =
(G/(v_eff · roll_rate)) · ln(sec|phi|)`; **release ⇔ dpsi_rem ≤ dpsi_unwind**, then
`unwind` rolls to upright at the profile rate — lean reaches zero exactly as heading
reaches the exit heading, so the out-in-out exit is derived, not asserted. Worked at
book90 scale: unreleased residual yaw 33.2°/s (review confirmed); release accrual 8.9°
over 0.56 s; a corner-end station release would miss by O(5–10°) ≈ O(1–2.5 m) on the
16 m exit — why heading capture wins. **Signed steering:** `turn_in.hand?: "L"|"R"`;
direction defaults to the next corner's hand; an explicit hand binds to the next
matching corner or refuses `BAD_RANGE/no_governing_corner` — contradictions are
unrepresentable, alternating esses are commandable, magnitudes stay unsigned
(`handSign("R") = +1`, y-down frame).

**Spec body:** `review/amendments/corner-exit.md` (§1 machine + release predicate, §2
hand binding, §5 REQ-STEER-OWNERSHIP). **Doc placement:** 02 §2/§3.1/§8 · 03 §6.1 ·
01 §4.1 (`EPS_EXIT_DEG = 1.0°` deadband) · 04 §4.2/§5 · 05 §2.1/§5/§6.3.
**09 gains:** `C30` extended (release station, exit heading error ≤ 1.0°, final lean
≤ 0.25°, outcome contained/quality good), `C30-LR` two-corner alternating-hand golden,
`P-UNWIND-CAPTURE`, `P-UNWIND-NOCROSS`, `P-STEER-OWNER`, hand-effectuality rows.

### 1.2 Corrective shot + off-road termination (review §2.2, §2.3; §1 runoff rows)

**Mechanism (2.2).** The corrective is a **fixed-policy branched shadow run** — never
inside the main integration. Detect = first bracketed outward crossing of `f` through
`1.0 + eps_f_detect (0.01)` after turn-in; start = `max(detect, freeze end) +
t_react_s`; policy = roll toward `phiReserve` at the profile rate with `a_cmd = 0`
(empty command history, so the chop transient cannot fire); success = `f ≤ 1.03`
before road end without shadow crash/off_road/stopped. Verdict carries
`corners[].corrective = {feasible, detect{s,f}, shot{s, v_kmh, phi_deg,
target_phi_deg}, returned{s,f}|null, fail_reason}` with the closed `fail_reason` set
(`departed_before_reaction | shadow_off_road | shadow_crash | shadow_stopped |
no_return_before_road_end`); `wide` vs `runoff` = feasible vs not. Detection is
outward-only and corrective-offroad owns the corridor-departure predicate:
inside-corridor excursions (`f < −eps_f_detect` on pavement) never move outcome
(check territory — `out_in_out`/`chain_containment`); an inside-side `off_road`
with no outward detect classifies `runoff`, corrective null. The drawn line is
always the uncorrected consequence; `correction` is a shot-start bookmark; the save is
inspectable as the `correctiveShot` ghost (stepper-only, never exported). One extra
engine run per ran-wide corner enters `C-RECOMPUTE-BUDGET`.

**Mechanism (2.3).** Lateral departure is terminal: `off_road` fires at the bracketed
crossing of `|d| > lane_width_m` with exact `(x, y)` recorded (the drawn-endpoint
rule consumes it); `muAt` clamps laterally only so the crossing RK4 step is
well-defined — no grass physics. `terminated.reason` is the closed six-value set (§0);
`stopped` joins the outcome classes (quality `caution`/amber). The `premature` oracle
pin is implementable: on book90 (left) the compiled early-turn line departs with 0.4 m
of pavement margin against a 3.9 m recovery need — structurally `runoff`.

**Spec body:** `review/amendments/corrective-offroad.md` (§1 shot, §2 termination, §3
endpoint/auto-window, §4 oracle pin). **Doc placement:** 02 §7 (precedence rewrite) ·
03 §2 (edges, muAt clamp) · 04 (new corrective §) · 05 §2/§5/§6.1/§6.3 · 06
§2.4/§3.1/§5.1 · 07 §3 · 08 §3.1/§7.1 (`correctiveShot`). **09 gains:**
`G-CORR-RUNOFF` (book90 + premature), `G-CORR-WIDE` (book90 hand=R), oracle fixture
column, `P-TERMINATED-CLOSED`, endpoint acceptance `A-FIG81-ENDPOINT`.

### 1.3 Run-wide slice v2 + lean-aware stopping (review §3, all bullets; P1 ssd item)

**Mechanism.** Re-derived from the EOM: the sustained stand-up keys on **grip-capped
braking demand** `b_dem = clamp(−a_cmd, 0, mu·G)` (closing the deep-lean escape
hatch); the geometric widening threshold `a_widen(phi, v; c)` (with envelope factor T
and counter-command fraction c, and a clipped-regime predicate W) decouples from
`a_noreturn` (kept as teaching, three-band disclosure — the `[a_noreturn, a_widen)`
"stands up yet tightens" band is disclosed, not hidden). Longitudinal actions gain
`slew_mss` (default 6 m/s³ < `RATE_THRESHOLD`), making the chop transient a graded,
dt-invariant impulse (`K_CHOP` restated as impulse gain 0.12 rad per m/s²; freeze =
`roll_cmd 0`); mid-corner squeezes become expressible. `ssd` becomes the lean-aware
two-phase closed form `ssd(v, phi, model, profile, mu) → {ssd_m, react_m, standup_m,
brake_m}` (stand-up phase capped at `min(a_ssd, aLongAvail, a_noreturn)`, then upright
`a_ssd`; reduces to the carried formula at `phi = 0`) — one definition for the sample
channel, `stop_within_sight`, and the V1 governor. A model-validity band splits from
the numeric floor: `v_valid_min_ms = 7.0` (derived — below it no commandable brake
widens) with per-sample `below_validity` and a verdict `validity` block;
`v_floor_ms = 2` stays numeric-only. `P-ROLLRATE` rescopes to the tracker
(+ `P-ROLLRATE-EXCESS` for the physics), so `C30-chop` passes by design.

**Spec body:** `review/amendments/runwide-physics.md`. **Doc placement:** 02
§2/§3/§5.2/§5.4/§6/§7 · 03 §5.2 (ssd replacement)/§6.1 (slew fields)/§7.1 (chop row) ·
04 §6 (governor gains phi, basis `sight_ride_m`) · 05 §2.1/§4/§6.1 · 01 §8.
**09 gains:** goldens `C30-chop` (updated, pin runoff), `C30-trailbrake`,
`C30-squeeze`, `C30-heldbrake`, `C30-deeplean`, `C30-stop`, `C30-chop-sweep`;
properties `P-ROLLRATE(-EXCESS)`, `P-RUNWIDE-WIDEN`, `P-TRAILBRAKE-TIGHTENS`,
`P-RUNWIDE-UPRIGHT`, `P-RUNWIDE-MONOTONE`, `P-AWIDEN-SIGN`, `P-SLEW`, `P-SSD-LEAN`,
`P-VALIDITY-FLAG`, `A-SSD-GOVERNOR`.

### 1.4 Doctrine check catalogue + rubric identity + the outcome law (review §2.4, §8.2, §9.12)

**Mechanism.** The complete **16-check catalogue** as the shipped data pack
`parks-street/2`, owned by 01 Appendix A (05 keeps only the record shape): per-check
arithmetic with TUNING thresholds, `severity ∈ advisory | standard | critical`,
scopes, and a normative na/exemption table. Tier-1R re-derivations run on the
recorded commanded channel (`single_input` counts commanded steering runs;
`throttle_rule`'s chop leg keys on `RATE_THRESHOLD`; `trail_brake_taper` grades vs
`a_widen`; `rideability` is su-compensated via `|phi_dot − (su_sustained +
su_transient)| ≤ roll_rate + tol`). `quick_steer` becomes a two-sided
geometry-normalized gate (`steer_share` — roll-in real estate over corner real
estate), which is what makes `slow_steer` finally fail a check (share ≈ 0.74 on
book90). The chain-aware set (`link_continuity`, `chain_containment`, `chain_flow`)
gets full arithmetic with the two-level applicability rule: geometric chain from
`linked_next` (road) AND ridden-linked (the line's own `cmd_a` on the connecting
span). `sight_vs_stopping` → `stop_within_sight` with a typed `UNKNOWN_ID` tombstone.
Pack shape: bindings are data (ids, thresholds, bands, severity, applicability),
metrics are code versioned by the independent `checks_version`; every verdict carries
`rubric`. The outcome law (§0) is this section's Option B — physics decides outcome,
the rubric decides doctrine, quality composes them.

**Spec body:** `review/amendments/doctrine-catalogue.md`. **Doc placement:** 01
Appendix A (new) + §4.3 · 02 §7 · 05 §6.1/§6.2/§6.3/§2.1 · 06 §5.1 · 08 §3.1 ·
03 §7.1. **09 gains:** `A-CATALOGUE-RESOLVES`/`-EXERCISED` (16 ids),
`G-C30-CHECKVECTOR`, `P-OUTCOME-RUBRIC-FREE`, `P-QUALITY-TOTAL`, `A-CHAIN-GREEN`,
per-check pass/fail fixtures, rubric-swap acceptance.

### 1.5 Position-action physical channel (review §3; D8 effectuality corollary)

**Mechanism.** One critically-damped, authority-capped lateral tracker writes the
existing `target_lean` through the existing roll tracker: `a_track =
clamp(OMEGA_POS²·e − 2·OMEGA_POS·d_dot, ±a_lat_pos_max)`, `target_lean =
clamp(atan(v²·kappa_cmd/G), ±PHI_TRACK_AUTH)` with `OMEGA_POS = 2.0`,
`PHI_TRACK_AUTH_DEG = 5.0`, `a_lat_pos_max = 0.8` — the guidance law of the `track`
and `position` states (§0). The authority cap is the D7 guard: cornering without a
`turn_in` saturates at ~4.7° and runs off (`P-POS-NO-CORNER`). One reachability
formula `dd_max = a_lat_pos_max · max(0, T_cmd/2 − t_roll)²` (with `K_REACH = 1.2`)
triples as the `over_m = "auto"` resolver (default; the fantasy 15 m default dies),
the validation predicate (`INEFFECTUAL/position_target_unreachable` with a
machine-readable payload naming `required_over_m`), and V2's clipping rule — V2 holds
become ordinary generated `position` actions, or **no wire action** below
`MIN_POS_DD_M` (which is what makes zero-gap esses validate). Runtime honesty
backstop: the `position_shortfall` event.

**Spec body:** `review/amendments/position-channel.md`. **Doc placement:** 02
§3.1/§5.4 · 03 §6.1 (row + rules replacement) · 04 §6 (V2 restated) · 05
§2.1/§3.2/§5 · 08 §4.1. **09 gains:** `T-POS-EFFECT/INEFFECTUAL/OVERLAP/SHORTFALL`
rows (in `verify/effectuality.json`), `G-POS-REACH`, `P-POS-AUTH`, `P-POS-NO-CORNER`,
`A-VIS-HOLD-REACH`, fixtures `FX-POS-*`.

### 1.6 Corner-relative solver constants (review §4 bullet 1; §11 P0)

**Mechanism.** Every solver station constant becomes a fraction of per-corner
reference lengths `L_app / L_arc / L_exit` (worked on book90 and C30 — the carried
absolute metres provably emptied the search domain on the presets behind figs
8.1–8.3), clamped with a typed `NO_SOLUTION/road_too_short` refusal instead of silent
bracket overrun. Corner-type detection (`constant | decreasing | increasing` via
`r1/r2`) drives a per-type `target_apex_pct` table; the super-tight refusal becomes
**sweep content**: refuse `OUT_OF_SCOPE` iff ≥ 170° of sweep accumulates at local
radius ≤ 15 m — decidable on tapers, reduces to the carried rule on arcs, makes the
fig 8.4 teardrop authorable.

**Spec body:** `review/amendments/solver-refit.md` (SR-1, SR-2; SR-4..SR-7 are P1).
**Doc placement:** 04 (constants respec, §7 defaults) · 02 §7/03 validation
(super-tight predicate) · 03 §2 (corner record gains `type, r1/r2, gap_to_next_m,
linked_next`). **09 gains:** `A-SOLVER-FIT`, `book90-ideal` golden,
`P-APEX-TARGET-TYPED`, run-count rows for `C-RECOMPUTE-BUDGET`.

---

## §2. P1 — figure-blocking (the six figures cannot ship without these)

### 2.1 Two-strategy authoring: believed-road misjudgment + accept=best_failing (review §8.1; fig 8.4/8.5 rows)

**Mechanism.** Every Chapter-8 error is a belief error, so a line may declare a
**believed road**: solve on it, **literalize** the plan (frozen `tangent_inside`
leans, absolute stations, f targets), execute on the actual road — with
`underread`/`overread` sugar kinds joining the mistake enum, a typed validation table
(shared prefix, lane-geometry equality, hand refusal `OUT_OF_SCOPE/
believed_hand_differs`, believed-world-must-solve-clean), an exact `s_div` rule, and
full provenance (`verdict.misjudgment = {believed_road_hash, s_divergence_m,
divergence, kappa_gap, believed, actions_unreached}`). D7 intact — the engine produces
the line in both worlds; the one-perturbation rule extends to **one control-channel
delta OR one belief, never both**. `accept = clean | best_failing` on solve specs:
best_failing returns the highest-ranked self-verified candidate (outcome severity per
§0 precedence → failed-check count → corridor excess → apex distance → deterministic
tie-break) instead of refusing; authored D10 constraints stay hard;
`verdict.acceptance {policy, met}` (always present, in-hash) makes a non-clean return
impossible to receive silently. Fig 8.4's red companion: `wrong_strategy_for_corner`
(check 16, critical — Mechanism A, owner item §7-5) renders red without physical
departure, downgrading to warn exactly under the caption's sanction (blind at
commitment ∧ significantly slower). Full fig 8.4/8.5 scene texts ship, plus
`startF=`/`--start-f` and the `use_full_width`/`bike_margin_m` road options in all
three spellings.

**Spec body:** `review/amendments/misjudgment.md`. **Doc placement:** 00 §4 (kinds) ·
03 §7.1 (underread/overread rows) · 04 §8 (R8) · 05 §6.3/§7 (misjudgment block,
source kind `misjudge`, corners reshape) · 06 (colour v2.1 arm, centreline
suppression) · 08 (believeRoad/accept spellings, recipe (h)). **09 gains:**
`G-MISJUDGE-DR`, `P-MISJUDGE-PREFIX`, `A-8.5-WINDOW` (= recipe (h)), acceptance-policy
invariance test, oracle rows underread/overread.

### 2.2 Double-apex solving + two-apex recording (review §4 bullets 3–4; §11 P1)

**Mechanism.** `solveDoubleApex` fully specified: compound-corner windowing (maximal
same-hand `linked_next` run), a 2-turn-in coarse grid, the solver-internal touch
acceptance predicate (depth ≤ `DA_TOUCH_F_MAX`, prominence, separation — a candidate
filter only, evaluated over the RECORDED apex list so an accepted two-touch line
always records exactly two apexes), a five-key ranking, the typed `NO_SOLUTION` set
(incl. `no_two_touch_line` — the fig 8.4 taper refusal, with best-failing retention
for `accept=best_failing`), and recipe R7. The verdict records
`corners[].apexes[]` via the ONE hysteresis detector (§0), which also emits per-touch
`apex` events with `detail.index` — markers, labels (`apex#2@double`), and checks all
read the same list. Chained-mistake seeding (state-seeded per-corner perturbation,
bounded kiss-probe lean derivation, out-of-corridor rules) lands the chained oracle
row `O-CHAIN-PREMATURE` on `F-ORACLE-CHAIN`.

**Spec body:** `review/amendments/solver-refit.md` (SR-3, SR-4) +
`review/amendments/misjudgment.md` (§4 verdict reshape). **Doc placement:** 04 (new
double-apex §, R7) · 05 §6.3 · 03 §3.1 (`bookDoubleApex` preset, left-hand).
**09 gains:** `A-DOUBLEAPEX` (two touches pinned on bookDoubleApex; typed refusal on
bookDecreasing), `O-CHAIN-PREMATURE`, `A-CHAIN-GREEN`.

### 2.3 Marker/label/dash/legend grammar (review §6; §11 P1 marker/label item)

**Mechanism.** Annotations are **event-sourced and line-addressable**: markers are
glyphs of trajectory events (closed classes `turn_point | apex | exit | release`)
with a `MarkSpec` value language (`auto | all | none | class-list`) at figure and
per-line scope plus a deterministic coincident-collapse rule; label anchors are one
closed grammar `feature[:corner][#n]@line ±m` (features `turn_point | apex | exit |
release | correction | run_wide_detect | end | sight_ray`) with multi-leader labels,
post-run resolution, and typed `anchor_no_match`/`anchor_ambiguous` errors — all six
book figures' callouts written out. Ink grammar v2: all non-reference trajectories
draw solid with arrowheads; dash is annotation ink (sight rays, occluder-triggered;
dotted reference lines); role reads from stroke-width tier plus a legend printing
`role · quality (outcome)` — quality words `good | caution | failing` disambiguate
amber's two meanings. Legend auto-on (≥2 lines or any non-good line); 06 §7 parity
becomes "equivalent modulo margin chrome".

**Spec body:** `review/amendments/annotation-grammar.md`. **Doc placement:** 06
§2.1/§3.1/§5.2/§7 · 05 §5 (consumers) · 08 (`--marks/--rays/--legend`) · 00 §4
(mistake-kind rename lands here too). **09 gains:** `P-MARKS-EVENTS`,
`P-INK-GRAMMAR`, `P-PROJ-LEADER`, `A-FIG82-SINGLEMARK`, `A-FIG83-MARKS/-TOPOLOGY`,
`A-LABEL-ANCHORS`, `A-ANCHOR-ERRORS`, `A-LEGEND-AMBER`.

### 2.4 Scene vocabulary: oncoming vehicle, handedness, bookEsses, orientation (review §8.6, §8.8; fig 8.1/8.6 rows)

**Mechanism.** (a) **Vehicles on the carriageway**: the vehicle occluder takes
exactly one of `lane: own|oncoming` ⊕ `f=` ⊕ `side` (+`margin_m`) through the same
sideSign machinery; fixed 4.5×1.8 footprint joins the opaque set; derived heading;
motion refused `OUT_OF_SCOPE/moving_hazards_not_modelled`; new `hazard_visible`
event `{occluder_id, dist_m}` makes the vehicle a measured sight target — fig 8.1
worked end-to-end. (b) **Handedness is physical**: presets take `hand=L|R` and
default to the book figure's ink hand (book90 becomes a left-hander); the mirror is a
road-level transform (y/psi/kappa negate; f, inside/outside, own/oncoming invariant);
ViewSpec rotates (`orient: auto|0|90|180|270`) but never reflects
(`SCHEMA/no_view_mirror`); G7 parity stays strict. (c) **bookEsses respecified**:
four corners R 12 ^75, first-corner R, with S 6 links sized by the flip budget
`d_flip(v) = v·(phi_n + phi_{n+1})/roll_rate` (9.0 m at 28.7 km/h street); authored
zero-gap chains stay legal, resolved by slowing, floor-refused
`NO_SOLUTION/link_flip_infeasible` at `v_valid_min_ms`. Aspect-floor padding makes
the portrait esses pass the proportion gates at road_ink 0.26.

**Spec body:** `review/amendments/scene-vocabulary.md`. **Doc placement:** 03
§3.1/§4 (occluder shape + tokens) · 05 §5/§2.1 (event; f/d conventions) · 06 §2.1 ·
01 §6 · 08 (road-ref token; schema road-dsl). **09 gains:** `A-FIG81-VEHICLE`,
`P-MIRROR`, `G-PRESET-HANDS`, `A-ESSES-GATE`, `A-LINK-FLIP`,
`A-CHAIN-VIS-FULL`/`-BUDGET` (re-based).

### 2.5 Outcome-pin reconciliation on named fixtures (review §9.2; §11 P1)

**Mechanism.** One machine-readable pin table (normative home 03 §7.1) with
**admissible sets** plus a **single-class fixture pin** per kind, `TUNING-PIN`
marked, frozen under the iron rule (a pin that stops holding is a design change,
never patched at the pin). The merged cells and fixture roster are in §0. `schema
mistakes` prints the same source (`{admissible_outcomes, fixture_pin}` rows);
`ORACLE-PIN-TABLE` asserts single-sourcing structurally.

**Spec body:** `review/amendments/verification.md` §3 + `review/amendments/bug-sheet.md`
9.2 + `review/amendments/corrective-offroad.md` §4. **Doc placement:** 03 §7.1 ·
01 §4.3 (column → pointer) · 09 §4. **09 gains:** `ORACLE-PIN-TABLE`, per-kind oracle
rows on `F-ORACLE-90/DR/CHAIN`.

### 2.6 Exit-code / expect_fail wiring (review §9.7, §5; §11 P1)

**Mechanism.** One law in 08 §3.1 (§0): five tiers with expectation derivation
`E(line)` — explicit `expect` wins; else a mistake source's pin-table row IS its
declaration (no redundant expect_fail); else `accept:best_failing` expects non-good;
else chained/vis solves expect contained + chain-aware pass; else contained +
quality good. Deviation **in either direction** exits 3; roles never gate; artifacts
still render on exit 3; tier 4 = `INTERNAL` (absorbs deleted `dnf-spec-error`);
`figure`/`scene` bakes are declaration-gated by default; story-tier skew exits 3
under `--gate`.

**Spec body:** `review/amendments/agent-interface.md` §8 (frame) +
`review/amendments/bug-sheet.md` 9.7 (tiers) + `review/amendments/lifecycle.md` (skew
row). **Doc placement:** 08 §3.1 (single table; 04 §4.2 cross-ref). **09 gains:**
`A-EXIT-DECLARED`, `A-GATE-FIGURE` (roles-permuted invariance).

### 2.7 ssd-vs-a_noreturn reconciliation (review §11 P1; §3.6)

Closed inside 1.3: the lean-aware `ssd` caps its stand-up-phase deceleration at
`a_noreturn`, so the safety check can no longer certify stops the simulator refuses
to execute; `A-SSD-GOVERNOR` pins the governed-entry consequence; the sole
comparison basis is `sight_ride_m` (§3.2 of the bug sheet / §0).

### 2.8 bookDoubleApex + left-hand presets (§11 P1)

Closed inside 2.2 and 2.4: `bookDoubleApex` (left-hand, taper geometry, TUNING) joins
03 §3.1 as the last preset-less Chapter-8 archetype; all book presets default to
their figure's ink hand; `G-PRESET-HANDS` pins the roster.

---

## §3. P2 — the agent story (review §5, §2.5, §9.3/9.7/9.9/9.10)

All nine §11-P2 items are specified in `review/amendments/agent-interface.md`;
verification owns the tests it hands to 09. Per item:

- **3.1 Resolved plan in the envelope.** Every `LineResult` carries
  `resolved_scenario` — the complete post-validation wire scenario the engine
  integrated (solver conclusions as canonical actions; mistake perturbations
  applied — incl. the two controller-level kinds via NEW 03 §6.1 wire fields:
  `rider.roll_rate_cap_dps` (slow_steer's ×0.3 derate; the controller reads
  `roll_rate_eff = min(profile, cap)`) and the throttle action's `freeze_steer_s`
  (chop's steering freeze), the wire-closure rule making the scenario schema
  total over the mistake enum; self-contained road/occluders/hazards). Output
  provenance: excluded from `spec_hash` (D6 intact), its plan (incl. the rider
  override) covered by the extended `result_hash` (§0). `explain`/`sweep`/`state`
  address against it. Test: `A-RESOLVED-RERUN` (feeding it back reproduces
  `result_hash`; names `slow_steer` and `chop` explicitly).
- **3.2 `state` verb** (review §2.5). `linelab state <result|figure> --line <id>
  (--s <m> | --t <s>)` = CLI `stateAt`; typed `BAD_RANGE` past termination (no
  silent clamp); the universal `--line` selector convention with typed
  `line_selector_required`. Test: `A-STATE-VERB`.
- **3.3 Root-qualified sweep.** Closed roots `plan. | scenario. | config. | ride. |
  mistake. | constraint. | believe.` with per-root hold-fixed semantics (believe.
  re-solves the believed world per cell); closed metric vocabulary + `acceptance_met,
  apex_count, s_divergence_m`; `sweep_max_cells = 2500` (TUNING); worked
  tipping-point (recipe (g)) and fig-8.5 entry-window (recipe (h)) sweeps. Test:
  `A-SWEEP-ROOTS`.
- **3.4 FigureSpec JSON door.** The `figure` verb (renamed from `scene`, owner item
  §7-31) accepts scene text or FigureSpec JSON; `lowerScene` is a pure total
  lowering; `spec_hash` is computed on the lowered form so spelling never changes
  identity. Test: `A-FIGURE-JSON-PARITY`.
- **3.5 One mistake grammar.** The composed token (§0) across verb/flag/scene;
  `--corners` removed; legacy scene `scope=` rejected with a rewrite hint printing
  the equivalent token; generated line_id rule + `DUP_ID`. Test: `A-MISTAKE-GRAMMAR`
  (+ bug-sheet's `A-MISTAKE-SUGAR` respelled onto the token).
- **3.6 Occluder/hazard wire shapes pinned.** Occluder union with the vehicle
  member's exclusive placement (2.4); hazards get `--hazard` and a `hazards` schema
  section; one anchor grammar shared with plan actions (bare `c1` = `entry:c1`
  sugar; `s:<m>` absolute; `SCHEMA/anchor_embedded_offset`). Tests: `A-HAZARD-FLAG`,
  `C-OCC-TOKEN`.
- **3.7 `--line-id` / `compare` semantics.** `--line` universal; compare requires
  same road (`road_mismatch` typed); solver merge contract pinned (delegation
  recorded as `source.kind = "solve"`). Test: `A-COMPARE-ROADS`, `A-MERGE-PIN`.
- **3.8 Schema output structure.** One wrapper `{ok, value: {schema_version, engine,
  rubric, checks_version, sections}}` with a Section meta-shape and a bijective flag
  table; `schema mistakes` rows = the pin table (`admissible_outcomes, fixture_pin`);
  section list gains `hazards`, `figure`, `sweep`, `rubric`. Test: `A-SCHEMA-SHAPE`
  (+ `A-SCHEMA-JSON`, `A-FLAG-MAP` from the bug sheet).
- **3.9 Cold-start & recipe acceptance tests written into 09.** `T-COLDSTART`
  (fresh-agent protocol, 3/3 at release, record-committed) and `A-RECIPE-A..J`
  (recipes (a)–(h) + verification's believed-road (i) and double-apex (j)) land as
  named 09 §3.6 tests with reserved slots. Spec body: `review/amendments/verification.md`
  §6–7.

**Doc placement (08 rewrite):** §1 count · §2 cold-start sentence · §3.1 exit table ·
§3.2 error shape (+`detail`, `deferred`) · §4.1 flags (+`--brake-slew,
--throttle-slew, --vis, --marks, --rays, --legend, --look, --orient, --hazard,
--use-full-width,
--bike-margin, --roll-rate-cap, --throttle-freeze, --believe-road, --accept,
--start-f, --rubric, --checks-version`; the authored `expect` block is deliberately
flag-less and scene-key-less — JSON-only per §0) ·
§5.1 schema shapes · §6 recipes (a)–(j) · §7.1 imports (+`correctiveShot, gateFigure,
lowerScene, chainedSolve, suggestTurnIn, sightFrom, ssd, project`) · §7.2 taxonomy.

---

## §4. P3 — strategic (review §8.3, §8.4, §8.5, §8.7; §6 POV; rubric identity in 1.4)

### 4.1 Phased delivery (review §8.3)

**Mechanism.** A normative phasing section in 00: **v0.1 figure spine** (core / road /
solve / mistake / render-topdown-true / CLI + true-scale presets — delivers G1, G4,
G6, G7, G8), **v0.2 inspection** (stepper + `stateAt` + `serve`), **v0.3 immersion**
(POV + compare), diagram projection deferred until realistic-road figures appear.
The **phase-gating law** keeps D8 airtight: the printed schema IS the phase;
unshipped tokens reject `SCHEMA` with a `deferred: "<phase>"` member. D1 survives via
a clarifying amendment (architecture and destination, not build sequence; D1a
supersession drafted only as fallback — owner item §7-39). 09 gains a "Phase gates"
section grouping the named tests per phase.

**Spec body:** `review/amendments/lifecycle.md` §1. **Doc placement:** 00 (new
section + D1 sentence) · 01 §2 (phase tags; G8 wording) · 08 (deferred member) · 09.

### 4.2 Share-URL version-skew contract (review §8.5) + solved-plan cache (review §7.2)

**Mechanism.** Exporters stamp figure-level `engine_semver` + per-line
`expected: {outcome, result_hash}` (~40 bytes/line) into FigureSpec; consumers
recompute per D6, compare, and render a first-class placard on divergence — tiers
`match | unstamped | detail | story` (figure-level `info` roll-up); never blocking;
story-tier exits 3 under `--gate`. Re-bless commits bump minor semver and re-stamp
committed fixtures (09 §3.3 step (f)). The recompute budget lands via **cached solved
plans**: `solved {spec_hash, plan}` per line (validity = engine_semver equality +
spec_hash recompute equality; hit ⇒ one engine run, verdict fresh; mismatch vs
`expected` ⇒ full re-solve + placard; `C-CACHE-HONEST` — cache never changes the
answer; ~600-run arithmetic shown in 09 §6). Share URLs include the cache by default
(`--no-cache` opt-out).

**Spec body:** `review/amendments/lifecycle.md` §2 +
`review/amendments/verification.md` §2. **Doc placement:** 05 §8.1/§7 (skew member) ·
08 §3.1 (gate row) · 09 §3.3/§6. **09 gains:** `C-SKEW-DETECT/-CLEAN/-NEVER-BLOCKS`,
`C-RECOMPUTE-BUDGET` (rescoped), `C-COLDSOLVE-BUDGET`, `C-CACHE-HONEST`,
`A-SOLVED-PLAN-VALIDATES`.

### 4.3 POV teaching devices + phase vocabulary + recorded run-wide channel (review §6, §9.11, §9.14; §11 P3)

**Mechanism.** The limit point never leaves the POV frame: clamp-with-arrow
(inset-rectangle test, ray-clamp position, arrow-iff-clamped, closed
`markerState ∈ placed|clamped`; off-frame arithmetic verified — 36.8° bearing vs 30°
half-frame at book90 mid-corner). `look: heading | limit_point` camera toggle as pure
presentation (`LOOK_MAX_DEG = 70` clamp; default `heading`); rider-gaze behaviour
joins 01 §8's refused list with a typed na placard. The run-wide channel is recorded
split (`su_sustained`/`su_transient`, §0) and `stateAt.derived` gains `stand_up_dps`,
`a_noreturn_ms2`, `a_widen_ms2` (nullable) for the HUD. Phase vocabulary v2: ONE
five-token machine `approach | turning | midcorner | exiting | done` defined by the
05 §4.1 opener-event table (brake_start opens no phase; terminal events open none);
06 §4's strip bands cite it.

**Spec body:** `review/amendments/pov-samples.md`. **Doc placement:** 05
§2.1/§3.2/§4 · 06 §4 · 07 (POV rules; heights: wall 2.0 / bank 1.8 / vehicle 1.8 with
`POV_OCCLUDE_CLEAR_M = 0.4`) · 08 (`--look`) · 00 §4 (Phases line; core-sample
bullet) · 01 §8. **09 gains:** `C-POV-LIMIT-ALWAYS`, `G-POV-CLAMP-MIDCORNER`,
`C-POV-LOOK`, `A-SU-ZERO-WHEN-GENTLE`, `A-SU-ATTRIBUTION`, `C-HUD-ANORETURN`,
`C-PHASE-MACHINE`, `C-STRIP-BANDS`, `C-POV-OCCLUDE`.

### 4.4 fit(trace) front door (review §8.4) + variability note (review §8.7)

**Mechanism.** `fit(trace) → {plan, residual}` sketched in 04 (Trace schema, `NO_FIT`
future error code, residual-as-coaching); D7 restated over
worlds / commands / evidence at fit promotion (Reading B — evidence is admissible
input, never drawn; every drawn line stays engine-integrated; owner item §7-40).
Variability: `--jitter` as a v2 note in 08 — splitmix64 CLI-layer RNG, N = 32,
TUNING spreads (entry ±5%, mu ±0.08, turn-in ±2 m), `EnsembleResult` with Option B
histogram + neutral band; core stays pure; the doctrine acknowledgment paragraph
lands in 01 now.

**Spec body:** `review/amendments/lifecycle.md` §3–4. **Doc placement:** 04 (fit
sketch) · 08 (v2 note) · 01 (doctrine paragraph). **09 gains (pre-written, run at
promotion):** `P-JITTER-DETERMINISM`, `P-JITTER-PURITY`, `A-JITTER-LATE-APEX`,
`A-FIT-ROUNDTRIP`, `A-FIT-REFUSE`, `P-FIT-LINE-PROVENANCE`.

### 4.5 Verification regime hardening (review §7 — cross-cutting)

**Mechanism.** The analytic-acceptance layer (`A-AN-RADIUS/BRAKE/ROLL/RK4`, closed
forms with tolerances on named fixtures) gates every bless mechanically; blessed
values write back into 02 §8.1 between `BLESSED:BEGIN/END` markers with
`T-BLESSED-DOC-SYNC` in CI. Vision-judge and cold-start verdicts run in workflow
under pinned model identities (J1–J8 rubric, 2-of-3 flake policy for the judge, 3/3
for cold-start); CI gates deterministically on committed records (`T-JUDGE-RECORD`,
`T-COLDSTART-RECORD`). D8 effectuality is decidable: `verify/effectuality.json` +
`T-D8-EXHAUSTIVE` (§0). Quantifier fixes: `P-SIGHT-EYE` three-way split,
`P-SIGHT-PURE`, `P-SIGHT-INSIDE-MONOTONE`, `P-EXPORT-DETERMINISM`,
`A-CHAIN-VIS-FULL/-BUDGET`; development-phase re-bless batching paragraph in 09 §3.3.

**Spec body:** `review/amendments/verification.md`. **Doc placement:** 09 (§3.2–§3.6,
§4, §6, §8, new analytic §) · 02 §8.1.

---

## §5. The consistency bug sheet (review §9, items 1–14)

Full resolutions: `review/amendments/bug-sheet.md` (with its banner recording which
floors retired to owning clusters). One paragraph each; **[subsumed by …]** marks
items whose mechanism now lives in a section above.

1. **One-ride-line rule.** 04 §7's "exactly one `ride` line" relaxes to "at least
   one"; the FIRST ride line is the reference for subsequent-ride roles; the
   two-`ride` example becomes normative. `C-SCENE-MULTIRIDE`. *(Incidental fix also
   landed by misjudgment's two-strategy figures — §2.1.)*
2. **Outcome pins differ between 01 §4.3 and 03 §7.1.** One machine-readable table:
   admissible set + single-class `TUNING-PIN` on `F-ORACLE-90`; 01's column becomes a
   pointer. `ORACLE-PIN-TABLE`. **[subsumed by §2.5]** — merged cells per §0
   (contested chop/fifty_pence cells → owner, §7-7).
3. **Occluder ref token three ways.** One anchor grammar: bare `c1` = `entry:c1`
   sugar; canonical `entry|exit|mid:<id>`; absolute `s:<m>`; offsets never inside the
   anchor (`SCHEMA/anchor_embedded_offset`); 08 recipe (c) corrected. `C-OCC-TOKEN`.
   **[subsumed by §3.6]**
4. **sight_m vs ssd_m basis mismatch (~15%).** New recorded `sight_ride_m` — exact
   lookahead along the line's own trajectory — is the SOLE basis for every
   sight-vs-ssd judgment (`stop_within_sight`, hold release, V1 governor,
   `A-CHAIN-VIS-*`, `verdict.sight.margin_min_m`); `sight_m` keeps centreline basis
   for comparability/rendering and stays the trend's source. `G-SIGHT-BASIS`,
   `P-SIGHT-BASIS`. **(This bug's resolution WINS project-wide.)**
5. **Events: bookmarks + sightFrom trend.** Bookmarks are events-only (`C-BOOKMARKS`
   drops "plan stations"); `trend` leaves `sightFrom`'s pure signature and is defined
   once in 05 §4, windowed (5 m) and deadbanded (2 m); the governor keys off the
   recorded per-sample trend. `C-TREND-WINDOW`.
6. **Raw 200 Hz series homeless.** Demoted to integrator-internal scratch; the
   retained record is the resampled series; `result_hash` = verdict + resolved plan
   (§0), with P-DETERMINISM + goldens as the record tripwire. `C-RAW-RETENTION`.
7. **Exit tiers vs intended-fail lines.** The declaration-aware five-tier law; tier 3
   = deviation from expectation in either direction; tier 4 = INTERNAL; scene/figure
   default-gated. `A-EXIT-DECLARED`. **[subsumed by §2.6]**
8. **Spelling drift; --mistake sugar undefined.** `--vis <none|cautious>` mirror
   flag; `--visibility-governed` demoted to documented sugar; `schema cli` pinned as
   the cross-surface spelling table `{field, scene_key, flag, sugar?}`; the mistake
   spelling is the ONE composed token (bug's `--corners`/scene-`scope=` retention
   lost). `A-MISTAKE-SUGAR`, `A-FLAG-MAP`. **[subsumed by §3.5]**
9. **Schema output structure unspecified.** agent-interface's wrapper + Section
   meta-shape win; this bug contributes the `{admissible_outcomes, fixture_pin}` Kind
   rows. `A-SCHEMA-JSON`. **[subsumed by §3.8]**
10. **Recipe count, window:"all", importable API, config.mode, checks_version,
    hazards section.** Recipes renumbered (a)–(j); `ViewSpec.window` gains `"all"`;
    08 §7.1 import list completed (+`suggestTurnIn, chainedSolve, sightFrom, ssd,
    project`, and the §0 additions); `config.mode` DELETED (owner §7-34);
    `checks_version` optional-with-default 2 (independent code version, §0);
    `hazards` joins the schema section list. `A-IMPORT-SURFACE`.
11. **Phase vocabulary; unreachable dnf-spec-error.** Split ownership: the phase half
    goes to pov-samples' five-token machine (§4.3); the dnf half WINS here —
    `dnf-spec-error` deleted, refused lines become `LineRefusal` envelope entries
    (keyed `line_id`), runtime spec errors exit 4 INTERNAL. `C-PHASE-TOTAL`
    (five-token), `C-REFUSAL-ENVELOPE`.
12. **Vacuous colour branch.** SUPERSEDED by the Option B outcome law (§0/§1.4):
    outcome = physics fate; refinement lives in quality/the derived clean predicate;
    06's vacuous branch dies. `C-COLOUR-DERIVE` re-keys to (outcome × checks ×
    severity) → quality. **[subsumed by §1.4]**
13. **Wall 1.2 m < 1.4 m eye.** One invariant: every "fully occludes" preset height ≥
    `eye_height_m 1.4 + POV_OCCLUDE_CLEAR_M 0.4` — wall 2.0, bank 1.8, vehicle raised
    1.5 → 1.8 (owner §7-29). `C-POV-OCCLUDE`.
14. **00 §4 core-sample list vs 05's table.** 00's bullet says "declared minimum,
    full table in 05" and gains `clipped, n_long, n_lat` + `sight_ride_m` + the su
    split + the Phases line. *(Also carried by §4.3's 00 §4 rewrite.)*

---

## §6. New decision-log entries (append to 00 §2 — full drafts, D11–D41)

Drafted in 00's register (decision + rationale + supersession note where one
applies), in dependency order. Sources: the fourteen sections' decision drafts,
deduplicated and merged per the reconciliation audits.

- **D11 — One outcome law: physics decides outcome; the rubric decides doctrine;
  quality composes them.** `outcome` is the physics-only closed set
  `crash > runoff > wide > stopped > contained` (never reads a check;
  `P-OUTCOME-RUBRIC-FREE`). `clean` is a derived predicate (`contained ∧ zero
  applicable check fails`); `violation` is retired; `dnf-spec-error` is deleted
  (refusals are `LineRefusal` entries; runtime spec errors are exit-4 `INTERNAL`).
  `quality ∈ good | caution | failing` is the single total colour function (amber
  word `caution` — the outcome word `contained` may not double as a quality word).
  *Supersedes* 02 §7's "clean = all checks pass" and 06 §5.1's vacuous branch.
- **D12 — The doctrine rubric is a declared data pack; the book wins as the shipped
  default.** Check bindings (ids, thresholds, bands, severity ∈
  advisory|standard|critical, applicability) are data in `parks-street/2`; metrics
  are code versioned by the independent `checks_version`; every verdict carries
  `rubric`. The catalogue (16 checks incl. `wrong_strategy_for_corner`, the sole v2
  critical — contingent on §7-5) is owned by 01 Appendix A; 05 owns only the record
  shape. Future doctrine disputes become packs, not forks.
- **D13 — The steering channel is one four-state machine; commitments end by heading
  capture; direction is a per-corner binding.** `steer_state ∈ track | commit |
  unwind | position`; release ⇔ remaining heading-to-exit ≤
  `(G/(v_eff·roll_rate))·ln(sec|phi|)`; unwind at the profile rate; `turn_in.hand ∈
  L|R` binds to the next matching corner or refuses
  `BAD_RANGE/no_governing_corner`; lean magnitudes stay unsigned (`handSign` the
  single conversion point). Exits become derivable, not asserted.
- **D14 — Run-wide slice v2: demand-driven stand-up, a_widen threshold, slewed
  commands.** `S_sustained` keys on grip-capped braking demand `b_dem`;
  `a_widen(phi, v; c)` decouples from `a_noreturn` (kept as teaching, disclosed
  bands); longitudinal commands are slew-limited (`slew_mss`, default 6 m/s³),
  making the chop transient a graded dt-invariant impulse (`K_CHOP` = 0.12 rad per
  m/s²) and mid-corner squeezes expressible.
- **D15 — Lean-aware stopping model, one function.** `ssd(v, phi, model, profile,
  mu) → {ssd_m, react_m, standup_m, brake_m}`: stand-up phase at the profile roll
  rate with decel capped at `min(a_ssd, aLongAvail, a_noreturn)`, then upright
  `a_ssd`; reduces to the carried formula upright. One definition for the sample
  channel, `stop_within_sight`, and the V1 governor.
- **D16 — Safety compares in rider-path metres.** The recorded `sight_ride_m`
  (exact trajectory lookahead) is the sole basis for every sight-vs-stopping
  judgment; `sight_m` keeps centreline/lane-centre station basis for cross-line
  comparability and rendering. Removes a ~15% systematic error.
- **D17 — The model-validity band is split from the numeric floor.** `v_floor_ms =
  2` terminates; `v_valid_min_ms = 7.0` (derived from the widening algebra) flags:
  per-sample `below_validity`, verdict `validity` dwell, and the chain-link
  `link_flip_infeasible` floor all cite the one constant.
- **D18 — The corrective shot is a fixed-policy branched shadow.** wide-vs-runoff is
  decided by one deterministic shadow re-integration (react, roll to `phiReserve`,
  `a_cmd = 0`) — never a search, never inside the main integration; the drawn line
  is always the plan's own consequence; the save ships as a stepper-only ghost and
  fig 8.5's ink departure is a disclosed parity note.
- **D19 — The world ends at the road edge.** Lateral departure is a terminal
  `off_road` event with bracketed crossing coordinates; `terminated.reason` is the
  closed six-value set; off-road physics is refused (muAt clamps laterally only to
  keep the crossing step well-defined); `stopped` joins the outcome classes.
- **D20 — The lateral tracker channel.** `position` actions, default lane-keeping,
  V2 holds, and the post-unwind hold share one bounded critically-damped tracker
  writing `target_lean` (authority `PHI_TRACK_AUTH_DEG = 5°` — the D7 guard);
  `turn_in` suspends it; one reachability formula is `over_m="auto"` resolver,
  validation predicate, and V2 clipping rule; the unreachable `over_m = 15` default
  is retired.
- **D21 — Corner-relative solver stations; super-tight refusal measures U-turn
  sweep content.** Station constants become fractions of `L_app/L_arc/L_exit` with
  a typed `road_too_short` refusal; corner-type detection drives per-type
  `target_apex_pct`; refuse `OUT_OF_SCOPE` iff ≥170° of sweep accumulates at
  r ≤ 15 m (decidable on tapers; the fig 8.4 teardrop becomes authorable).
- **D22 — The visibility mode is a bounded heuristic verified by self-check.** The
  monotone-convergence claim is withdrawn; acceptance is decided solely by the
  terminal self-check (`P-VIS-SELFCHECK`), bounded by `vis_max_iterations`, with two
  typed refusal sub-reasons.
- **D23 — Misjudgment is first-class: believed-road solving.** A line may declare a
  believed road — solve on it, literalize the plan, execute on the actual road —
  with `underread`/`overread` sugar, shared-prefix validation, and full provenance;
  D7 intact; the one-perturbation rule reads: exactly one control-channel delta
  (engine-probed interior values) OR one belief, never both.
- **D24 — Solvers return their best failing line on request.** `accept = clean |
  best_failing`; deterministic five-key ranking; authored D10 constraints stay
  hard; `verdict.acceptance {policy, met}` is always present and in-hash; grading
  and colour are policy-independent.
- **D25 — Mistake kinds speak the book's words.** `premature` = the canonical
  runs-wide error (was `early_apex`); `premature_contained` = the eased variant;
  `early_apex` gets an `UNKNOWN_ID/renamed_kind` tombstone; `fifty_pence` gains
  `early_by_m`; the enum closes as §0 lists it.
- **D26 — Handedness is physical, not presentational.** Presets take `hand=L|R`
  and default to the book figure's ink hand; the mirror is a road-level transform
  through hand-relative vocabulary; ViewSpec rotates but never reflects; G7 parity
  stays strict. `hand` spells `L|R`; `left|right` is exclusively rider-relative.
- **D27 — On-road vehicles are first-class sight objects; chain links carry a flip
  budget.** `vehicle` places via exactly one of `lane=own|oncoming ⊕ f ⊕ side`,
  acts as occluder AND recorded sight target (`hazard_visible`); motion refused.
  Chain links are sized by `d_flip(v) = v·(phi_n + phi_{n+1})/roll_rate`; zero-gap
  chains stay legal, resolved by slowing, floor-refused `link_flip_infeasible`.
- **D28 — Annotations are event-sourced; dash is annotation ink; the legend is the
  role channel.** Markers are glyphs of events; label anchors are one closed
  feature grammar resolved against the same events with typed errors; trajectories
  draw solid with arrowheads; sight rays are the only dashed ink; the legend prints
  `role · quality (outcome)` and defaults auto-on. *Supersedes* 06 §5.2's role-dash
  law.
- **D29 — The envelope records the resolved scenario; the hash covers the plan.**
  Every `LineResult` carries `resolved_scenario` (output provenance, excluded from
  spec_hash); `result_hash = fnv1a(verdict′ + resolved plan)` with exclusions
  `{result_hash, diagnosis, cache, skew}`; Sample appends alone never move hashes;
  all hash-moving amendments land in ONE re-bless commit.
- **D30 — FigureSpec JSON is the canonical figure spelling; scene text is sugar.**
  The `figure` verb accepts either; `lowerScene` is a pure total lowering;
  `spec_hash` is computed on the lowered form so spelling never changes identity.
- **D31 — Share URLs carry an engine stamp and per-line expectations; caches are
  stamped conclusions.** Figure-level `engine_semver`; per-line `expected {outcome,
  result_hash}` (exporter stamp) beside authored `expect` (gate declaration); story
  divergence renders a first-class placard, never blocks; `solved {spec_hash, plan}`
  makes shared figures load in one engine run, with the stamps as the mandatory
  safety net; re-bless bumps minor and re-stamps fixtures.
- **D32 — One mistake token, one anchor grammar.** `[lineId=]kind[:k=v,...][@scope]`
  across verb/flag/scene; anchors `entry|exit|mid:<id>` with `s:<m>` absolute and
  offsets outside the anchor; deprecated spellings are rejected with typed rewrite
  hints per D8.
- **D33 — Expectation-based gating; five exit tiers.** `E(line)` from explicit
  declarations, pin-table rows, acceptance policy, or the solve bar; deviation in
  either direction exits 3; tier 4 = INTERNAL; roles never gate (D9);
  figure/scene bakes are declaration-gated by default; no chain-specific tier.
- **D34 — Root-qualified sweep.** `sweep` addresses the whole composed input
  through the closed root set (incl. `believe.`) with per-root hold-fixed
  semantics and a closed metric vocabulary; `sweep_max_cells = 2500`.
- **D35 — Analytic-first bless.** Every bless is mechanically gated on the
  closed-form analytic-acceptance layer (the one place hand-computed expectations
  are legal); blessed values are written back into 02 §8.1 by the bless script;
  CI enforces doc-sync.
- **D36 — Nondeterministic judges commit records; CI checks records.** Vision-judge
  and cold-start verdicts run in workflow under pinned model identities with N-of-M
  flake policy; CI gates deterministically on committed record presence and hash
  match.
- **D37 — Phased delivery: the figure spine ships first.** v0.1 spine → v0.2
  inspection → v0.3 immersion; projection deferred; the printed schema is the
  phase; unshipped tokens reject `SCHEMA` with `deferred`. D1 is amended
  (architecture and destination, not sequence); C-ONE-CORE enforces D1's substance
  from phase one.
- **D38 — Randomness stays out of the core.** Variability ships as ensembles of
  deterministic runs (v2 `--jitter`): a seeded CLI-layer RNG generates N complete
  shareable scenarios; the band derives from engine-integrated lines only; the
  doctrine acknowledgment lands in 01 now.
- **D39 — Evidence input is admissible; command input stays forbidden (contingent,
  at fit promotion).** D7 restated over worlds / commands / evidence:
  `fit(trace) → {plan, residual}` accepts traces as evidence never drawn as lines;
  every drawn line remains engine-integrated.
- **D40 — The limit point never leaves the POV frame; gaze is a placarded scope
  cut.** Unconditional marker via clamp-with-arrow; `look: heading | limit_point`
  presentation-only toggle (default heading); rider-gaze behaviour joins 01 §8's
  refused list with a typed na placard.
- **D41 — Phase vocabulary v2.** `stateAt.derived.phase` and the controls-strip
  bands share one closed five-token machine (`approach | turning | midcorner |
  exiting | done`) defined by the 05 opener-event table; tokens disjoint from
  station anchors, event kinds, and the book's prose (which keeps entry/mid/exit as
  captions and anchors).

---

## §7. Open decisions for the project owner

Every item carries the plan's recommendation; the merged text provisionally adopts
each recommendation so the amendment set stays self-consistent — a contrary ruling
re-keys the named surfaces. Sources: 14 sections' user_decisions + auditor
escalations + editor flags, deduplicated.

**A. Vocabulary & law**

1. **Ratify the outcome law** — Option B (physics-only `crash>runoff>wide>stopped>
   contained`, clean derived, violation retired) vs Option A (keep carried words,
   delete the vacuous branch). *Rec: B — the only variant under which a rubric swap
   provably cannot move outcome pins, exit tiers, or the oracle
   (P-OUTCOME-RUBRIC-FREE); Option A fallback is drafted in doctrine-catalogue.*
2. **Quality tier word rename** `contained` → `caution` (homonym fix vs the outcome
   value). *Rec: yes — typed-enum hygiene beats homonym fidelity on agent-facing
   fields; colour unchanged.*
3. **`stopped` outcome colour class** — amber (contained-family) vs red. *Rec: amber
   (quality `caution`) — a vis-governed stop is doctrinally correct caution; a
   mistake-caused stop still reads failed via its checks.*
4. **The `violation` EVENT kind** — retained as the constraint-breach bookmark, now
   vocabulary-orphaned by the outcome refactor. *Rec: keep (feeds
   traction/lean-ceiling evidence and diagnosis); rename to `limit_breach` only if
   the homonym proves confusing in practice.*
5. **Fig 8.4 red companion** — Mechanism A (`wrong_strategy_for_corner` as sole
   critical check; red without physical departure; warn branch per the caption) vs
   Mechanism B (companion ships amber with a disclosed G7 departure). *Rec: A —
   reproduces the ink G7 promises while encoding the caption as arithmetic; colour
   stays verdict-derived (D9).*
6. **Ship the rubric selector now** (`config.rubric` / `--rubric` / scene `rubric:`
   with exactly one legal value) vs stamp-only. *Rec: ship — one field plus one
   validation path; keeps the seam honest before a second pack exists.*
7. **Contested oracle cells** — chop: wide vs runoff; fifty_pence: wide vs runoff.
   *Rec: chop → runoff, fifty_pence → wide (+ mandatory single_input fail), per
   verification's framing; pins are design pins the TUNING params must serve.*

**B. Engine & physics**

8. **Counter-hand turn_in** stays structurally inexpressible in v1? *Rec: yes —
   doctrine never steers away from the corner; a later `swerve` action is additive.*
9. **Heading-capture release vs corner-end station release.** *Rec: heading capture —
   a station release misses exit heading by O(5–10°) at book90 scale, recreating the
   §2.1 defect; the formula is disclosed, deterministic, scale-free.*
10. **Merged steering enum wording** (`track|commit|unwind|position`; corner-exit's
    `track`→`commit`, `neutral`→`track`). *Rec: ratify — kills the token-two-meanings
    trap on a recorded field.*
11. **Lane-keeping tracker as default lateral behaviour** (defines approach
    behaviour; one re-bless). *Rec: yes — the only way `position` can hold a target;
    the 5° cap preserves D7; straight-approach goldens behaviour-identical.*
12. **Unreachable position targets** — `INEFFECTUAL/position_target_unreachable` vs
    `BAD_RANGE`. *Rec: INEFFECTUAL — accepted-but-under-delivering is exactly the D8
    class; reason string stable either way.*
13. **Post-commitment position actions** — lenient validation + typed
    `position_shortfall` vs worst-case-corridor rejection. *Rec: lenient — worst-case
    bans legitimate short exit repositions (book90's 16 m exit fails at any preset
    speed).*
14. **Preset geometry untouched** despite book90's 12 m approach making the 0.27 m
    hold marginal at 34 km/h? *Rec: keep as-is — V1 governance resolves the canonical
    case; revisit only if presets are reshaped anyway (S 14–16 buys headroom).*
15. **Lean-aware ssd** vs placard-only vs per-station shot integration. *Rec:
    lean-aware closed form — a placard leaves the safety check certifying stops the
    simulator refuses to execute; shooting explodes the recompute budget.*
16. **K_SU = 0.30 with the disclosed "stands up yet tightens" band** vs retuning
    K_SU ≈ 0.5. *Rec: accept and disclose — b_dem already makes a_widen reachable at
    every lean; retuning silently moves the teachable a_noreturn 5.41 → ≈4.25 m/s².*
17. **Corrective lean target** — `phiReserve` vs `phiMax` vs two-tier. *Rec:
    phiReserve only — matches the doctrine's definition of a save; shadow crash-free
    by construction on clean surface.*
18. **Corrective ghost + shadow law** — ratify shadow-only (drawn line = uncorrected
    consequence; ghost stepper-only, never exported; fig 8.5 ink departure disclosed)
    vs riding the save into misjudge-line trajectories. *Rec: shadow-only —
    determinism/hash hygiene and the one-perturbation diff property are load-bearing;
    the callouts anchor on `correction`/`run_wide_detect`/`end` bookmarks.*

**C. Solver & scenes**

19. **Super-tight refusal loosening** (sweep-content predicate legalizes the fig 8.4
    teardrop) + keep `bookDecreasing` at R 16>9 ^130 for v1 goldens? *Rec: approve
    both — refuses exactly U-turn-regime content, decidable on tapers; move the
    fig 8.4 parity scene to the teardrop only after the proportion gate passes on
    it.*
20. **Bare `ride`/`solve` chains by default** across each linked run (corner= as the
    restriction). *Rec: yes — matches 08 recipe (d), closes "chainedSolve is
    uninvocable from scene text" with zero new grammar.*
21. **Preset hand defaults flip to book ink** (book90 becomes left). *Rec: flip —
    pre-implementation there is no compatibility cost; G7 parity holds with zero
    tokens; `hand=R` stays one token away.*
22. **bookEsses links** — S 6 connectors vs literal zero-gap. *Rec: S 6 — the book
    raster shows connectors; the preset should demonstrate the solver's sweet spot,
    not its validity floor.*
23. **bookEsses corner geometry** — keep R 12 ^75 vs re-measure ~R 14 ^80. *Rec:
    keep — both TUNING; the flip/gate arithmetic is blessed at 12; revisit only on a
    vision-judge sweep-fidelity flag.*
24. **Believed-world trajectory** — renderable ghost vs provenance-only. *Rec:
    provenance-only in v1 — a ghost on a road it wasn't ridden on would be the one
    drawn line that isn't a ridden line; authors can draw a second figure from the
    same spec on the believed road.*

**D. Presentation & inspection**

25. **Legend auto-on** (≥2 lines or any non-good line) despite book figures carrying
    none. *Rec: yes — after dash removal it is the sole in-frame role channel and the
    only place amber's two meanings separate; parity reads "modulo margin chrome".*
26. **marks:auto semantics** — keep current (all classes on ideal-role lines) vs
    book-truer default. *Rec: keep; revisit only if the vision judge flags clutter
    (one constant, no schema change).*
27. **POV default look** — `heading` vs `limit_point`. *Rec: heading — mistake lines
    must not imply their rider looked through the turn; limit_point is the explicit
    teaching overlay.*
28. **Phase tokens** — disjoint renamed set vs the book's words. *Rec: rename
    (approach|turning|midcorner|exiting|done) — the book's entry/mid/exit words
    survive as station anchors and captions, where the book actually uses them.*
29. **Vehicle POV presentation height 1.5 → 1.8 m** under the occlusion invariant vs
    a per-kind exception. *Rec: raise — one invariant, no exceptions; a 1.5 m car
    grazing a 1.4 m eye cannot honestly render full occlusion.*

**E. Contracts & CLI**

30. **Extend result_hash to cover the resolved plan** (one re-bless) vs verdict-only.
    *Rec: extend — silent solver drift with an unchanged rounded verdict is a real,
    otherwise-invisible regression class.*
31. **Rename the `scene` verb to `figure`** (canonical input is FigureSpec JSON).
    *Rec: rename; scene text stays as sugar input.*
32. **Remove `--corners` outright** vs alias-that-errors. *Rec: remove — pre-1.0, one
    spelling is the point of the composed grammar.*
33. **`state` verb beyond-termination queries** — typed `BAD_RANGE` vs clamp. *Rec:
    typed error per 05 §4's no-silent-clamp rule; add `--clamp` only if a real
    workflow demands it.*
34. **Delete `config.mode`** (unwired stub) vs enumerate-and-wire. *Rec: delete —
    rider.profile already selects the behaviour table; D8 forbids accepted-but-
    unwired fields.*
35. **Overspeed admissible set includes `crash`?** *Rec: yes — {wide, runoff, crash}
    with fixture pin runoff; the book's overspeed lesson includes unrecoverable
    entries.*
36. **Compiled mistake lines count as declared-failing** without explicit
    expect_fail? *Rec: yes — the 03 §7.1 pin table is the declaration; redundant
    expect_fail would make the common teaching figure noisy for no CI value.*

**F. Verification & lifecycle**

37. **Cold-start release bar** — 3/3 vs 2/3; trigger cadence. *Rec: 3/3 at release
    (a 2/3 is a schema-text defect); run only on schema-output-hash change or
    release.*
38. **Solved-plan cache blocks in share URLs by default** (~200–400 bytes/line) vs
    opt-in; adopt cached plans at all. *Rec: adopt + default-include with
    `--no-cache` — 100 ms shared-figure loads are the point; skew is placarded.*
39. **D1 reconciliation** — clarifying amendment vs formal D1a supersession. *Rec:
    amendment — nothing v0.1 builds is anything D1 superseded; C-ONE-CORE enforces
    D1's substance from phase one.*
40. **D7 wording for fit(trace)** — Reading A (implicit) vs Reading B (amend D7 + G1
    at fit promotion). *Rec: B at promotion — the honest wording; prevents quietly
    renegotiated invariants; no text change before fit ships.*
41. **`run --gate` exits 3 on story-tier skew?** *Rec: yes — a teaching artifact
    whose captions no longer match its recomputation is a doctrine-tier CI failure;
    landed as one row in the merged gate table.*
42. **Oracle single-class pins as a set** (premature/slow_steer/chop/overspeed →
    runoff; fifty_pence → wide; premature_contained/overread → contained+fails) —
    ratify wholesale. *Rec: ratify — pins are design pins the TUNING parameters must
    serve; a later flip is a design change with a re-bless, never a patch at the
    pin.*

---

## §8. Amendment execution order (each design doc amended once)

Sequence: **00 → 02 → 03 → 05 → 01 → 04 → 06 → 07 → 08 → 09**, then the single
re-bless. Vocabulary first (00), physics contracts before their consumers
(02/03/05), doctrine and solving next (01/04), presentation (06/07), interface (08),
verification last (09 names every test the others minted). Within each doc, the
ordered edit list:

- **00-README.md** — (1) §2: append D11–D41 (§6 drafts) + the D1 clarifying sentence
  (D37); (2) §4 shared vocabulary rewrite: mistake kinds (D25 enum + tombstone
  note), outcome/quality words (D11), Phases line (D41), plan-action anchor note
  (`s:<m>`, offsets outside anchors), hand alphabet note (D26), core-sample bullet
  (declared minimum + `clipped, n_long, n_lat` + the §0 appends); (3) new "Phasing"
  section (v0.1/v0.2/v0.3 + phase-gating law, D37); (4) §3 doc-map rows gain the new
  subsections (02 §3.1, 01 Appendix A, 04 corrective/fit §§).
- **02-physics-model.md** — (1) §2 frame sentence (`+phi` = right lean; paired
  rider-left-positive `d` convention); (2) §3 controller sentence (merged output;
  the `roll_rate_eff = min(profile, rider.roll_rate_cap_dps)` read) +
  new §3.1 steering machine (corner-exit §1 + position-channel §1 tracker law +
  REQ-STEER-OWNERSHIP); (3) §5.2 constants table (slew, K_CHOP, A_SLEW_DEFAULT,
  PHI_WIDEN_MIN, v_valid_min_ms, EPS_UNWIND_DONE_DEG, EPS_EXIT_DEG, OMEGA_POS,
  PHI_TRACK_AUTH_DEG, K_REACH, MIN_POS_DD_M, FREEZE_MAX_S, eps_f_detect/save); (4) §5.4 invariants
  restated over a_widen + tracker-authority invariant; (5) §6 a_cmd_rate/ZOH/RK4
  semantics + raw-series demotion; (6) §7 replacement: fate/termination precedence,
  outcome pointer to 05, super-tight sweep-content predicate, corner-end terminator
  deleted; (7) §8: BLESSED block markers + C30/C30-LR pinned quantities.
- **03-roads-scenarios-and-visibility.md** — (1) §2 road model: carriageway pin,
  edges at ±lane_width_m, muAt lateral clamp, corner record += `type, r1/r2,
  gap_to_next_m, linked_next`, road union += `hand?, use_full_width?,
  bike_margin_m?, {dsl:}`; (2) §3.1 presets: hand column + book-ink defaults,
  bookEsses respec, bookDoubleApex; (3) §4 occluder vocabulary: vehicle exclusive
  union + tokens + `hazard_visible`; (4) §5.1 sightFrom (trend removed; targets =
  ride-lane centre polyline + corridor placard); (5) §5.2 ssd replacement
  (lean-aware); (6) §6.1 wire schema: `turn_in.hand`, `slew_mss`, the throttle
  `freeze_steer_s`, `rider.roll_rate_cap_dps`, `position
  over_m:"auto"` + validation rules, `startF`; (7) §6.2/§7.2 error reasons + the
  composed mistake token; (8) §7.1: the ONE pin table (D25 kinds, §0 cells,
  admissible sets, fixture pins) + underread/overread rows + chop mechanics update
  + the wire-closure sentence (a kind compiles only to spellable surfaces).
- **05-result-contract-and-inspection.md** — (1) §2 `terminated` shape; (2) §2.1
  Sample merged append block + field-note amendments (phi sign, f governing-corner
  semantics + 1−f handoff note, d sign); (3) §3.2 interpolation rows; (4) §4 phase
  machine (five tokens, opener table) + derived additions (`stand_up_dps,
  a_noreturn_ms2, a_widen_ms2, ssd_station_m, sight_margin_m` rebased, windowed
  `sight_trend`); (5) §5 closed event set (§0); (6) §6.1 outcome law; (7) §6.2
  record shape + rubric pointer; (8) §6.3 merged Verdict (§0); (9) §7 envelope
  (LineResult/LineRefusal union, resolved_scenario, cache, skew, resolved
  occluders/hazards); (10) §8.1 FigureSpec (stamps, expect/expected, solved);
  (11) §8.2 CSV pinned order; (12) §8.3 hash law + exclusion list.
- **01-scope-and-doctrine.md** — (1) §2 goals: phase tags + G8 wording; (2) §4.1
  exit deadband; (3) §4.3 mistake table re-key (pointer to 03 §7.1); (4) §5
  double-apex/two-touch teaching note; (5) §6 fig-8.1 equivalence regains the
  vehicle; (6) §8 placards: gaze + divergence + jitter/variability paragraph;
  (7) **new Appendix A**: the 16-check catalogue (1.4).
- **04-solver-and-authoring.md** — (1) station-constant respec (SR-1/SR-2);
  (2) §4.2 solved-plan shape (explicit `{lean_deg, hand}`); (3) §5 chains: linked
  runs, supersession sentence, chain-green wording; (4) §6 V1/V2: governor basis +
  lean-aware ssd + V2 restated on the tracker; (5) §7 defaults: chain-by-default,
  first-ride-is-reference, "at least one ride line"; (6) new corrective-shot §
  (1.2); (7) solveDoubleApex § + R7; (8) misjudge/accept surfaces + R8; (9) fit
  sketch (4.4); (10) §9 carried list restated.
- **06-rendering-and-projection.md** — (1) §2.1 ViewSpec: `orient, look, rays,
  legend, window:"all"`, no-mirror rule; (2) §2.4 auto-window replacement
  (drawn-endpoint + all-lines fallback); (3) §3.1 draw stages 7–11 rewrite
  (sight-ray trigger, terminal glyphs, placard box slot); (4) §4 strip bands cite
  the phase machine + stand-up channel bullet; (5) §5.1 quality law (D11 words);
  (6) §5.2 ink grammar v2; (7) §7 manifest legend records + parity-modulo-chrome
  wording + resolved orient.
- **07-viewer-animation-and-pov.md** — (1) stepper bookmarks = events-only (+
  release bookmark); (2) corrective ghost toggle (stepper-only); (3) POV: clamp-
  with-arrow limit point, look toggle, occluder heights (wall 2.0 / bank 1.8 /
  vehicle 1.8 + POV_OCCLUDE_CLEAR_M), gaze placard; (4) terminal prose re-keyed to
  `terminated.reason`; (5) hypothetical-eye rule.
- **08-cli-and-agent-interface.md** — (1) verb table: `figure` rename + `state` +
  export/check/sweep completions; (2) §3.1 the merged exit table; (3) §3.2 error
  envelope (+`detail`, `deferred`); (4) §4.1 flag table + composed tokens +
  spelling table (schema cli); (5) §5.1 schema wrapper + section list; (6) §6
  recipes (a)–(j); (7) §7.1 import list; (8) §7.2 taxonomy note (INEFFECTUAL
  ruling); (9) §2 cold-start sentence; (10) `--jitter` v2 note.
- **09-verification-and-testing.md** — (1) new analytic-acceptance § + BLESSED
  write-back; (2) §3.2 goldens (C30 ext, C30-LR, C30-* family, G-CORR-*,
  G-POS-REACH, G-MISJUDGE-DR, G-PRESET-HANDS, G-SIGHT-BASIS, book90-ideal,
  G-C30-CHECKVECTOR, G-POV-CLAMP-MIDCORNER); (3) §3.3 re-bless: batching paragraph
  + step (f) re-stamp + the ONE migration's cause list; (4) §3.4 properties (all
  P-* named in §§1–4); (5) §3.5 solver-intent quantifiers + A-CHAIN-VIS pair;
  (6) §3.6 recipes A–J + T-COLDSTART(-RECORD) + T-JUDGE-RECORD; (7) §4 oracle =
  ORACLE-PIN-TABLE view + fixture column; (8) §5.3 preset gate checks (esses
  orient/padding); (9) §6 budgets (recompute arithmetic); (10) §8 effectuality =
  verify/effectuality.json + T-D8-EXHAUSTIVE; (11) "Phase gates" section.

**What gates implementation start:** the 02/03/05 amendments (the engine contract:
steering machine, run-wide v2, termination, Sample/Verdict/envelope shapes, pin
table) plus 00's vocabulary — i.e. every §1 item lands before `core/` is written.
04/06/07/08 amendments gate their own modules, not the core. 09's analytic layer
must exist **before the first bless**; the single re-bless migration closes the
pass. The §7 owner decisions that block merging text: 1, 2, 5, 7, 10, 18, 21 (the
rest are parameter/policy calls the drafts already encode).

---

## §9. Coverage matrix

Every review obligation → the amendment file (in `review/amendments/`) + the master
section above that closes it.

**§2 structural blockers**

| Review item | Amendment file | Master § |
|---|---|---|
| 2.1 lean-unwind | corner-exit.md | §1.1 |
| 2.2 corrective-shot spec | corrective-offroad.md | §1.2 |
| 2.3 off-road termination | corrective-offroad.md | §1.2 |
| 2.4 check catalogue + re-derivations | doctrine-catalogue.md | §1.4 |
| 2.5 stateAt verb | agent-interface.md | §3.2 |

**§11 P0**

| Item | File | § |
|---|---|---|
| lean-unwind semantics | corner-exit.md | §1.1 |
| corrective-shot spec | corrective-offroad.md | §1.2 |
| off-road termination | corrective-offroad.md | §1.2 |
| doctrine catalogue + Tier-1R re-derivations | doctrine-catalogue.md | §1.4 |
| run-wide slice re-derivation (5.4.2, impulse, P-ROLLRATE) | runwide-physics.md | §1.3 |
| position-action channel | position-channel.md | §1.5 |
| corner-relative solver constants | solver-refit.md | §1.6 |

**§11 P1**

| Item | File | § |
|---|---|---|
| two-strategy authoring (8.1) + double-apex carve-out & two-apex recording | misjudgment.md + solver-refit.md | §2.1, §2.2 |
| use_full_width + road options | misjudgment.md | §2.1 |
| marker/label grammar extensions | annotation-grammar.md | §2.3 |
| outcome-pin reconciliation on named fixtures | verification.md + bug-sheet.md | §2.5 |
| exit-code/expect_fail wiring | agent-interface.md + bug-sheet.md | §2.6 |
| oncoming-vehicle placement | scene-vocabulary.md | §2.4 |
| bookDoubleApex preset + left-hand presets | misjudgment.md + scene-vocabulary.md | §2.8 |
| ssd-vs-a_noreturn reconciliation | runwide-physics.md | §2.7 (§1.3) |

**§11 P2** — all nine items: agent-interface.md (tests: verification.md) → §3.1–3.9.

**§11 P3**

| Item | File | § |
|---|---|---|
| phasing section in 00 | lifecycle.md | §4.1 |
| rubric identity field | doctrine-catalogue.md | §1.4 |
| share-URL version stamp | lifecycle.md | §4.2 |
| POV look-at-limit-point + off-frame rule + gaze placard | pov-samples.md | §4.3 |
| fit-my-line front door | lifecycle.md | §4.4 |
| variability note | lifecycle.md | §4.4 |

**§8 wholecloth proposals**

| Proposal | File | § |
|---|---|---|
| 8.1 misjudgment | misjudgment.md | §2.1 |
| 8.2 pluggable rubric | doctrine-catalogue.md | §1.4 |
| 8.3 phase the build | lifecycle.md | §4.1 |
| 8.4 grade-my-line | lifecycle.md | §4.4 |
| 8.5 share-URL skew contract | lifecycle.md | §4.2 |
| 8.6 fig 8.1 oncoming vehicle | scene-vocabulary.md | §2.4 |
| 8.7 --jitter ensembles | lifecycle.md | §4.4 |
| 8.8 handedness | scene-vocabulary.md | §2.4 |

**§9 bugs** — all fourteen: bug-sheet.md → §5 (subsumption per item: 9.2→§2.5,
9.3→§3.6, 9.4→§0/D16, 9.7→§2.6, 9.8→§3.5, 9.9→§3.8, 9.11 phase→§4.3, 9.12→§1.4).

**Review §3 / §4 / §5 / §6 / §7 bodies** — §3 → runwide-physics.md +
position-channel.md (§1.3, §1.5); §4 → solver-refit.md (§1.6, §2.2, and the
contained seam closed by §1.4's law); §5 → agent-interface.md (§3); §6 →
annotation-grammar.md + pov-samples.md (§2.3, §4.3); §7 → verification.md (§4.5,
plus the cached-plan budget in §4.2).

**Fig-row findings (§1 of the review)** — 8.1 dashed-collision/vehicle/endpoint →
§2.3/§2.4/§1.2; 8.2 marker floor + slow_steer check → §2.3/§1.4, its ×0.3-roll-rate/freeze
wire-scenario home → §3.1 (03 §6.1 fields); 8.3 facets,
callouts, fifty_pence topology → §2.3; 8.4 teardrop/refusal/strategy-red →
§1.6/§2.1; 8.5 salvage ink/teaching window → §1.2 (disclosed departure)/§2.1;
8.6 esses corners/steering sign/zero-gap/portrait gates → §1.1/§2.4.

**Repair pass (2026-07-19 completeness audit) — closures folded into the rows above**

| Audit gap | File(s) repaired | Resolution now in the spec bodies |
|---|---|---|
| Inside-corridor departure had no outcome mechanism | corrective-offroad.md §1.2/§1.6/§1.7 + doctrine-catalogue.md §1 (rows: §1.2, §1.4) | corrective-offroad OWNS the corridor-departure predicate; detection is outward-only; inside excursions (`f < −eps_f_detect` on pavement) are check territory (`out_in_out`/`chain_containment`); inside-side `off_road` with no outward detect → `runoff`, corrective null (outcome stays total and physics-only) |
| Pre-merge spellings in committed example text | annotation-grammar.md §1.6/§4.1/§5.1/§8 (row: §2.3) | fig 8.3 example respelled to the composed token (`fifty_pence:facets=6,early_by_m=10`); legend words `good\|caution\|failing` + Option B outcome set; `premature_contained → contained (+ mandatory late_apex fail)` |
| Road-anchor "fallback" cited but never defined | annotation-grammar.md §2.6/§10 (row: §2.3) | fallback claim deleted; an authored `turn_point#2@late` errors `UNKNOWN_ID/anchor_no_match` (§2.4); the label grammar defines no anchor fallback |
| `orient` unreachable by flag; `expect` spelling surface undeclared | scene-vocabulary.md §4.3/§6/§10 + agent-interface.md §8 + §0/§3 here (rows: §2.4, §2.6, §3.8) | `--orient` joins the 08 §4.1 flag list (+ scene `view:` `orient=`) restoring the 9.8 field↔flag bijection; `expect` declared deliberately JSON-only (FigureSpec-only members are the bijection's stated exemption) |
| V2 hold-release field spelled two ways | verification.md §5.5/§9 (rows: §2.5, §4.5) | respelled `hold_release_s` per §0's merged Verdict; `release_s` remains only as the per-commitment member of `corners[].turn_ins[]` |
| Stale recipe-count edit instruction | agent-interface.md §3 (row: §3.3) | 08 §1 count = "Ten", letter-derived from the final recipe roster (a)–(j) |

**Repair pass, round 3 (2026-07-19 final targeted audit) — closures folded into the rows above**

| Audit gap | File(s) repaired | Resolution now in the spec bodies |
|---|---|---|
| `danger_dwell_s` listed in the merged Verdict with no defining arithmetic anywhere | doctrine-catalogue.md §3/§9/§10 + §0 here (row: §1.4) | defined in the Appendix A preamble (§3): per-corner reserve-exceedance dwell — total seconds within `W_c` with `\|phi\| > phiReserve(mu_use)` (the 02 danger-zone teaching), boundary crossings linearly interpolated between bracketing samples (the event-bracket rule); evidence only, feeds no `parks-street/2` check; test `A-DANGER-DWELL`; §0's Verdict entry points at the definition |
| Shipped fig 8.4/8.5 scenes contradicted the label grammar (`turn_in*` heads, embedded `+8` offset) and carried three fig 8.5 line-name rosters | misjudgment.md §6.1/§6.2/§11 + annotation-grammar.md §2.6/§8 + agent-interface.md §3/§14 (rows: §2.1, §2.3, §3.3) | label heads respelled to the closed `turn_point` feature; offset respelled spaced (`correction@late +8`); ONE roster per figure — fig 8.5 = the shipped scene's `good`/`late` (misjudgment §6.1 is the definition site), annotation-grammar §2.6 and recipe (h)/`A-RECIPE-H` aligned; `A-LABEL-ANCHORS` extended to fig 8.5 |
| Vehicle occluder token embedded its offset in the anchor (`+8` fused onto `exit:c1`) — typed-rejected under the one-anchor-grammar rule, leaving the fig 8.1 SUV unauthorable in scene text | scene-vocabulary.md §1.2/§1.4 + bug-sheet.md 9.3 (rows: §2.4, §5) | vehicle token gains a separate space-delimited signed offset slot (`vehicle oncoming exit:c1 +8`, mapping to `at.offset_m`; span still rejected `vehicle_span_not_allowed`); all three embedded spellings corrected; `C-OCC-TOKEN` gains the vehicle parse row (spaced form parses, embedded form rejected `SCHEMA/anchor_embedded_offset`) |
| `premature.early_by_m` default contradicted across files (10 vs 5) | corrective-offroad.md §4 + scene-vocabulary.md §1.4 (rows: §1.2, §2.4) | the kind-definition site wins (annotation-grammar §5.1: default = 10); corrective-offroad's `F-ORACLE-90` recoverability working re-keyed at 10 (early turn-in ≈ 53 % of the 18.85 m arc vs ≈ 27 % at the old 5 — the `runoff` pin holds with MORE margin; the ≈ 8 m reaction distance is `early_by_m`-independent); fig 8.1 walk-through now says ≈ 10 m early |
| Sweep metric vocabulary keyed on Verdict scalars struck by the `corners[]` reshape (`apex_pct`, `apex_f`, `v_apex_kmh`) | agent-interface.md §3 (row: §3.3) | normative re-keying added: the per-line apex metrics read the FINAL entry of the addressed corner's `apexes[]` list (the `late_apex`/`apex_pct_final` rule) and are `null` when the list is empty; `schema sweep`'s metric rows state the sourcing |

---

*End of amendment plan. The fourteen spec bodies in `review/amendments/` are the
normative text of this pass; on any conflict between this index and a section body,
the section's EDITORIAL RECONCILIATION banner wins, then this document's §0, then
the section body.*
