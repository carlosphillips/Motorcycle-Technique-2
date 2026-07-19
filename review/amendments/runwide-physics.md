## Run-wide slice re-derivation (runwide-physics)

> **EDITORIAL RECONCILIATION (binding) — 2026-07-19 editor pass.** Merged against the
> thirteen sibling amendment sections per the three reconciliation audits. Where the
> body below disagrees with a bullet, the bullet wins.
>
> - **Outcome law (Option B, doctrine-catalogue).** The closed outcome set is
>   `crash > runoff > wide > stopped > contained` — this section's `stopped`
>   requirement is honoured, but `violation`/`clean` are retired as outcome values
>   (`clean` = derived predicate contained ∧ zero applicable check fails). This
>   section's §8 precedence line re-keys accordingly; its UD1 recommendation is
>   adopted: `stopped` maps to quality `caution` (amber family) in 06 §5.1's single
>   total quality law.
> - **Sample fields.** The stand-up channel is stored as the SPLIT
>   `su_sustained` + `su_transient` (pov-samples wins — attribution is unrecoverable
>   from the sum); `phi_dot_su ≡ su_sustained + su_transient` becomes defined
>   notation, never a stored column — every consumer in this section (invariants,
>   `P-ROLLRATE`/`-EXCESS`, C30-chop assertions) reads the sum. `a_cmd_rate` **stays
>   recorded** (this section wins — under slew-limiting it is the dt-invariant
>   per-step ZOH value `P-SLEW` audits). Merged CSV order after `limit_y`:
>   `sight_ride_m, steer_state, lat_action_id, su_sustained, su_transient,
>   a_cmd_rate, below_validity` (05 §2.1, one block).
> - **Controller output.** This section's `{roll_cmd, a_cmd, a_cmd_rate}` return is
>   merged with the steering machine: 02 §3's one sentence outputs `{steer_state,
>   target_lean, roll_cmd, a_cmd, a_cmd_rate}`; `target_lean` comes from the merged
>   four-state machine (corner-exit/position-channel); `roll_cmd` is computed exactly
>   as §9 pins (pre-step ZOH). Chop freeze = `roll_cmd = 0` without changing
>   `steer_state`.
> - **Sight basis.** Every sight-vs-ssd judgment (`stop_within_sight`, the V1
>   governor, `A-SSD-GOVERNOR`) compares against the recorded `sight_ride_m`
>   (rider-path lookahead, bug-sheet 9.4); `sight_m` stays the
>   comparability/render channel. This section's `ssd(v, phi, model, profile, mu) →
>   {ssd_m, react_m, standup_m, brake_m}` is THE one exported stopping function —
>   doctrine-catalogue's `ssd_lean` spelling is deleted in its favour.
> - **Validity constant.** `v_valid_min_ms = 7.0` is the single validity boundary;
>   scene-vocabulary's `SPEED_VALID_MIN_KMH = 25` is deleted (prose displays
>   ≈25 km/h).
> - **Oracle pin.** `C30-chop` pins outcome `runoff` per the ONE normative pin table
>   (03 §7.1, verification's structure; fixture roster F-ORACLE-90/DR/CHAIN). The
>   contested chop cell (wide vs runoff) is listed for owner sign-off exactly as
>   verification frames it.
> - **Termination.** corrective-offroad owns `terminated` — merged shape
>   `{reason ∈ crash|off_road|stopped|road_end|max_time|max_dist, s, t, x, y}`; this
>   section's bracketed `v_floor` crossing requirement is satisfied; the
>   `stop` event ↔ `stopped` reason spelling pair is deliberate.

Owner cluster: review §3, all bullets except the position-action channel. This
section re-derives the run-wide slice so its equations actually deliver its
invariants, replaces the impulse transient with slewed longitudinal commands,
rescopes the roll-rate property, defines the lean-aware stopping model that
`stop_within_sight` and the V1 governor consume, closes the v_floor/validity
gap, states the `stopped` termination requirement, and pins the roll tracker's
RK4 semantics. Every formula is in SI (m, m/s, m/s², m/s³, rad, rad/s) unless a
`_deg`/`_dps` suffix says otherwise; `G = 9.81 m/s²`. Constants marked TUNING
are servants to the restated invariants (02 §5.4's rule is kept).

Laws honoured: D7 (nothing here authors a path — all new fields are control
*intent*: slew rates, braking levels), D8 (every new field has typed rejection
rules), D6 (new sample fields ride the result, never the wire).

---

### 1. The widening algebra: `a_widen` decoupled from `a_noreturn` (review §3.1)

#### 1.1 Derivation (shown, as required)

The emergent curvature is `kappa = G·tan(phi)/v²`. Take `phi > 0` WLOG and
differentiate the log:

```
ln kappa      = ln G + ln tan(phi) − 2·ln v
d(ln kappa)/dt = phi_dot / (sin(phi)·cos(phi)) − 2·v_dot / v
```

Under braking, `v_dot = a_clip = −b_del` where `b_del ≥ 0` is the **delivered**
decel (post-ellipse). So

```
d(ln kappa)/dt = phi_dot/(sin(phi)cos(phi)) + 2·b_del/v          (†)
```

The path **widens** (kappa falls) iff `(†) < 0`, i.e. iff

```
−phi_dot > b_del · sin(2·phi) / v            [using 2·sin·cos = sin(2phi)]
```

During a held brake with the rider countering at fraction `c` of full roll
authority (`c = 1`: tracker railed toward the line; `c = 0`: frozen rider),
with the revised sustained driver of §2 (`b_dem`, the grip-capped braking
*demand*) and envelope `T = tanh(|phi|/PHI0)`:

```
phi_dot = c·roll_rate − K_SU·relu(b_dem − A_SU_ONSET)·T
```

Substituting and solving for the demand at which widening begins, in the
**unclipped regime** (`b_dem ≤ aLongAvail(phi)`, so `b_del = b_dem = a`):

```
K_SU·(a − A_SU_ONSET)·T − c·roll_rate  >  a·sin(2phi)/v
a·(K_SU·T − sin(2phi)/v)               >  c·roll_rate + K_SU·A_SU_ONSET·T

a_widen(phi, v; c) = (c·roll_rate + K_SU·A_SU_ONSET·T) / (K_SU·T − sin(2phi)/v)
                     defined only where the denominator > 0
```

At `c = 1`, `T ≈ 1` (any `|phi| ≥ 15°`, since `tanh(3) = 0.995`) this **is the
review's proposed formula** — verified, with two refinements the review's
version omits: the envelope factor `T` (negligible above 15°, kept for
exactness) and the counter-command fraction `c` (the frozen-rider threshold is
much lower: `a_widen(30°, 15, c=0) = 3.10 m/s²` vs `6.70` at `c = 1` — which is
exactly why a chop-plus-freeze runs wide at decels a fighting rider survives).

In the **clipped regime** (`b_dem > aLongAvail(phi)`, so `b_del =
aLongAvail(phi) < b_dem`) the kinematic tightening term uses the smaller
`b_del`, so the widening condition relaxes to

```
b_dem > A_SU_ONSET + (c·roll_rate + aLongAvail(phi)·sin(2phi)/v · 0) …  — stated directly:
K_SU·(b_dem − A_SU_ONSET)·T − c·roll_rate > aLongAvail(phi)·sin(2phi)/v      (W)
```

Predicate **(W)** is the normative instantaneous widening predicate (it covers
both regimes when `b_del = min(b_dem, aLongAvail)` is substituted for
`aLongAvail`); the closed-form `a_widen` is its unclipped solution and the
HUD/teaching quantity. Using unclipped `a_widen` as a display is
*conservative*: clipping only makes widening easier.

Worked values (street profile, `roll_rate = 0.8727 rad/s`, `K_SU = 0.30`,
`A_SU_ONSET = 2.5`, `mu = 1`):

| phi | v | a_noreturn | a_widen (c=1) | aLongAvail |
|---|---|---|---|---|
| 30° | 15 | 5.41 | 6.70 | 8.49 |
| 28° | 13 | 5.41 | 6.87 | 8.31 |
| 40° | 15 | 5.41 | 6.92 | 5.34 (clipped regime — see §2) |

Existence bound: the denominator requires `v > sin(2phi)/(K_SU·T)`; demand
reachability (`b_dem ≤ mu·G`) tightens this to
`v ≥ sin(2phi) / (K_SU·T − (c·roll_rate + K_SU·A_SU_ONSET·T)/(mu·G))`
≈ **6.4 m/s at 30°, ≤ 7.4 m/s at any lean** (street). Below that speed no
commandable brake widens — kinematic tightening (`2b/v`) dominates. This is a
real, derived low-speed validity floor for the run-wide doctrine and is what
`v_valid_min_ms` (§7) pins.

#### 1.2 `a_noreturn`'s new role (replaces 02 §5.3)

`a_noreturn = A_SU_ONSET + roll_rate/(K_SU·T)` is **kept, as a teaching
quantity only**: it is the braking demand beyond which the rider cannot hold
lean even at full counter-command (net roll rate ≤ 0 by construction). It is
*not* a path-widening threshold — at exactly `a_noreturn` the net roll rate is
zero, `phi` holds, `v` falls, and kappa strictly rises. 02 §5.3 gains this
three-band disclosure (normative prose):

- `b_dem < a_noreturn` — the rider can hold lean; sub-threshold braking
  tightens (trail-braking regime).
- `a_noreturn ≤ b_dem < a_widen` — **the bike stands up yet the line still
  tightens**: lean sheds slower than speed falls. Tier 1R's honest answer for
  this band; the run typically ends `stopped` (the envelope's small-lean
  equilibrium — e.g. `phi_eq ≈ 6.0°` at `b_dem = 6 m/s²`, street — is reached
  only near/after termination and is disclosed, not hidden).
- `b_dem ≥ a_widen(phi, v; c)` — the path itself opens: the geometric run-wide
  the book teaches.

Both quantities are HUD-displayable via `stateAt.derived` (§10.2). Invariant
5.4.2 is restated **only above `a_widen`** (§4).

The `tanh` envelope sentence in 02 §5.2 is replaced with: "the envelope is a
**continuity device** — it keeps the term C0 through zero-lean inflections and
zero at upright; it is saturated (> 0.96) above 10° lean, so `a_noreturn` and
`a_widen` are effectively lean-shaped only by `sin(2phi)/v` and grip
availability, not by the envelope."

---

### 2. Deep-lean escape hatch: the commanded-demand driver (review §3.2)

**Defect.** With `S_sustained` keyed to achieved `−a_clip`, the ellipse caps
the driver at `aLongAvail(phi) = mu·G·sqrt(1 − (tan(phi)/mu)²)`, which falls
below `a_noreturn = 5.41` above `phi ≈ 39.85°` — so a firmly **held** hard
brake at 40° lean reads as a stable, grip-perfect tightening spiral. The
headline anti-book behaviour.

**Mechanism (normative).** The sustained term's driver becomes the
**grip-capped braking demand**:

```
b_dem       = clamp(−a_cmd, 0, aLongMax(mu))        // = min(max(0, −a_cmd), mu·G)
S_sustained = K_SU · relu(b_dem − A_SU_ONSET)
```

Rationale (replaces 02 §5.2's "responds to achieved deceleration" sentence):
load transfer and geometry torque follow what the rider *asks* of the tire up
to the physical ceiling. Below the clip, `b_dem` equals delivered decel —
**behaviour is bit-identical to the current spec everywhere the ellipse is not
clipping**. When the ellipse clips at lean, the refused demand is exactly what
stands the bike up. The cap at `aLongMax(mu) = mu·G` keeps absurd commands
bounded and honours the one-mu policy (physical ceiling, never skill-derated).

Worked headline case (golden `C30-deeplean`, §11): `phi = 40°`, `v = 15`,
commanded `−9.0 m/s²` held, rider fighting: `b_del = aLongAvail = 5.34`
(clipped, `clipped = true` recorded), `b_dem = 9.0`. Widening predicate (W):
`0.30·(9.0 − 2.5) − 0.873 = 1.077 > 5.34·sin(80°)/15 = 0.351` — **the bike
stands up and runs wide**, no crash (ellipseMag rides ≤ 1), matching "Getting
off the gas or braking while at a high lean angle will cause the bike to
straighten up and run wide."

The transient term continues to fire on *grabbed* brakes independently (§3);
this section fixes the *held* case. No placard is needed once the mechanism is
in — the placard alternative is recorded as the rejected option in §14.

---

### 3. Slewed longitudinal commands; the graded transient (review §3.3)

#### 3.1 Onset slew on longitudinal actions (wire schema, 03 §6.1)

Every longitudinal plan action gains an authorable slew rate:

| Action | New field | Type/range | Default | Spellings |
|---|---|---|---|---|
| `brake` | `slew_mss?` | number, `[SLEW_MIN, SLEW_MAX] = [1, 100] m/s³`, else typed `BAD_RANGE` | `A_SLEW_DEFAULT = 6.0 m/s³` (TUNING) | JSON `slew_mss`; scene `slew=`; CLI `--brake-slew` (flag spelling to be reconciled by the CLI cluster) |
| `throttle` | `slew_mss?` | same | same | JSON `slew_mss`; scene `slew=`; CLI `--throttle-slew` |

Controller semantics (02 §3): the commanded level `a_cmd` is a **slew-limited
approach** to the active action's target level: per step,
`a_cmd_k = a_cmd_{k−1} + clamp(target_level − a_cmd_{k−1}, −slew·dt, +slew·dt)`.
`taper_to_s` keeps its release-to-zero-by-station meaning; precedence rule:
the action's declared profile defines the target trajectory, and **any** change
of commanded level is additionally rate-limited by `slew_mss` (a taper whose
implied rate is below the slew is unaffected). D8: `slew_mss` on a `position`
or `turn_in` action is rejected `SCHEMA` (field unknown there); values outside
range are `BAD_RANGE`.

`A_SLEW_DEFAULT = 6.0 m/s³` sits deliberately **below** `RATE_THRESHOLD = 8.0
m/s³`: a default-authored brake is a firm squeeze that never fires the
transient — *gently squeezing on the brake mid-corner is now expressible* (and
is the `C30-squeeze` golden). A grab is authored intent (`slew` above
threshold), which is D8-friendly: the transient never fires on an action the
author didn't make abrupt.

#### 3.2 `a_cmd_rate` redefined; K_CHOP restated as an impulse gain

02 §6's sentence "`a_cmd_rate` is the finite difference of commanded
longitudinal accel between consecutive steps" is kept but now well-posed:
because `a_cmd` is slew-limited, `a_cmd_rate = (a_cmd_k − a_cmd_{k−1})/dt`
**equals the active slew during a ramp and is dt-invariant**; it is defined
`0` at the first step, computed once per step, and held ZOH across all four
RK4 stages (§9).

```
S_transient = K_CHOP · relu(−a_cmd_rate − RATE_THRESHOLD)
```

**Impulse-gain restatement (normative, replaces the bare constant row):** for
a command drop of magnitude `Δa` at slew `r`, the integrated lean shed by the
transient (at saturated envelope, no counter) is

```
Δphi_su ≈ K_CHOP · Δa · (1 − RATE_THRESHOLD/r)        bounded above by K_CHOP·Δa
```

so `K_CHOP` has units **rad per m/s² of command drop** (dimensionally equal to
the previous `(rad/s)/(m/s³)`), and severity is *graded and monotone in both
`r` and `Δa`*. Re-derived default: `K_CHOP = 0.12 rad/(m/s²)` (TUNING). The
carried `6.0` was calibrated to the one-step-impulse regime the review proved
degenerate (any stepped drop ≥ 0.04 m/s² produced a full stand-up in ~5 ms);
under `0.12`, a 3 m/s² chop sheds ≈ 4.1° at `r = 10`, 12.4° at `r = 20`,
16.5° at `r = 40`, 18.6° at `r = 80` — the graded family that makes
`P-RUNWIDE-MONOTONE` non-vacuous.

#### 3.3 Chop severity and the freeze, pinned

- The `chop` mistake compiles to a throttle-cut whose slew is
  `chop_slew_mss = 40 m/s³` (TUNING default), authorable via a mistake param
  `slew_mss` (shared surface with the mistake-compiler cluster; the
  one-perturbation rule is intact — slew is a parameter *of* the one perturbed
  control, like `early_by_m`).
- **Freeze semantics (pinned, 02 §5 + 03 §7.1):** during `freeze_s` the rider
  makes **no steering input**: `roll_cmd = 0` (rider yields; `phi` evolves
  under `phi_dot_su` alone). Not target-hold — a tracker fighting at full
  authority would cancel sub-`a_noreturn` stand-ups and erase the chop lesson.
  This also selects the `c = 0` column of the widening algebra, which is why a
  chop runs wide at decels a fighting rider survives (§1.1). Wire home
  (03 §6.1; agent-interface §1's wire-closure rule): the compiled cut carries
  `freeze_steer_s = freeze_s` on its throttle action — the freeze is spellable
  in the resolved plan, so `export --as scenario` round-trips per kind
  (`A-RESOLVED-RERUN`).

---

### 4. Invariants 5.4.1–5.4.5, restated (full replacement of 02 §5.4)

1. **Sub-threshold neutrality (trail-braking preserved).** Wherever
   `b_dem < A_SU_ONSET` and `−a_cmd_rate < RATE_THRESHOLD`, `phi_dot_su ≡ 0`
   and Tier 1R is bit-identical to the pure point-mass; light trail braking
   (taper ≤ 2.5 m/s²) still tightens. *Test:* `P-TRAILBRAKE-TIGHTENS`,
   `C30-trailbrake`, `C30-squeeze`.
2. **Geometric widening above `a_widen` only.** At every sample where
   `|phi| ≥ PHI_WIDEN_MIN = 15°` (TUNING), `v ≥ v_valid_min_ms`, and predicate
   (W) holds (equivalently `b_dem ≥ a_widen(phi, v; c)` in the unclipped
   regime), `d|kappa|/dt ≤ 0` within tolerance; path-level, the trajectory is
   never tighter than the unperturbed twin from onset. Stated for both
   canonical rider configurations (`c = 1` held-fight; `c = 0` freeze).
   *Test:* `P-RUNWIDE-WIDEN` (rescoped), `P-AWIDEN-SIGN`, `C30-heldbrake`,
   `C30-deeplean`.
3. **Chop → run-wide class.** Unchanged in substance (canonical `chop` preset
   yields the run-wide class pinned on the named fixture), now with graded
   severity per §3. *Test:* mistake oracle + `C30-chop`, `C30-chop-sweep`.
4. **Upright immunity, falsifiable.** For any run with `|phi| ≤ 2°`
   throughout: recorded `phi_dot_su` is zero at every sample where `phi = 0`
   exactly, and the trajectory deviates from the analytic upright-braking
   solution by ≤ `eps_m = 0.05 m`. (Restated as a path bound because the raw
   term is *not* negligible at 1.9° — `tanh(1.9/5) ≈ 0.36` — only its path
   effect is. No slice-off engine exists or is needed: the recorded
   `phi_dot_su` channel plus an analytic twin make this testable, which also
   resolves the review §7 `P-RUNWIDE-UPRIGHT` finding.)
5. **Continuity, narrowed to what 02 can promise.** `phi_dot_su` is C0 in
   `(phi, a_cmd, a_clip)`; slew limiting makes `a_cmd` C0 in time; the crash
   boundary keeps its §7 deadbands. Verdict-flip protection at the
   wide/runoff/violation boundaries is **delegated** to the classification
   margins owned by the corrective-shot/outcome cluster (interaction noted;
   02 no longer over-promises it).

---

### 5. P-ROLLRATE rescoped to the tracker (review §3.4)

09 §3.4's `P-ROLLRATE` line is replaced by two properties:

- `P-ROLLRATE` (rescoped) — **the tracker component never exceeds the cap**:
  at every sample, `|phi_dot − phi_dot_su| ≤ roll_rate + tol` (both terms
  recorded/derivable per §10; realized `phi_dot` by finite difference of
  `phi` over `t`).
- `P-ROLLRATE-EXCESS` (new) — realized `|phi_dot| > roll_rate` **only** at
  samples where `phi_dot_su ≠ 0`; i.e. the cap is exceeded exactly and only
  during stand-up events. The C30-chop golden asserts at least one such sample
  exists (the property is exercised, not vacuous).

With this rescope the `C30-chop` golden **passes by design**: the stand-up
exceeding the rider cap is the slice's entire point, and the property now says
so instead of contradicting it.

---

### 6. Lean-aware `ssd` — the definition the doctrine cluster consumes (review §3.6)

**Decision: lean-aware closed form, not a placard.** Shooting per
sample/station would multiply the already-broken recompute budget; a placard
would leave the safety-central check certifying stops the simulator refuses to
execute. The closed form below is a *yardstick* (like `aashto`), now consistent
with Tier 1R's own limits, and conservative by construction.

**Replaces 03 §5.2 in full:**

```
ssd(v_ms, phi_rad, model, profile, mu) → {ssd_m, react_m, standup_m, brake_m}

react_m    = v · t_react                                  // model's reaction time; no braking
t_su       = |phi| / roll_rate                            // stand-up phase: roll to upright at the
                                                          // profile rate (full authority)
a_lean     = min(a_ssd,  aLongAvail(G·tan|phi|, mu),  a_noreturn(phi))
                                                          // decel usable while any lean remains:
                                                          // never beyond grip at lean, never beyond
                                                          // the controllable-stand-up demand
if v ≤ a_lean·t_su:   standup_m = v²/(2·a_lean);  brake_m = 0        // stops while still rolling up
else:                 v_up      = v − a_lean·t_su
                      standup_m = v·t_su − a_lean·t_su²/2
                      brake_m   = v_up² / (2·a_ssd)                  // upright full-rate phase

ssd_m = react_m + standup_m + brake_m
```

Properties of the definition (normative):

- **Upright reduction:** at `phi = 0`, `t_su = 0` and the formula reduces
  exactly to the carried `v·t_react + v²/(2·a_ssd)` — models `alert
  {a_ssd 7.0, t_react 1.0}` and `aashto {3.4, 2.5}` carry unchanged, their
  `a_ssd` now honestly meaning *upright* braking.
- **Conservative:** `a_lean` is evaluated at the *initial* lean and held for
  the whole stand-up phase, though availability only grows as the bike rolls
  up. Disclosed as such.
- **Monotone:** `ssd_m` is non-decreasing in `|phi|` and continuous at
  `phi = 0` (`P-SSD-LEAN`).
- Worked example: street, `alert`, `v = 13`, `phi = 28°`: `a_lean = 5.41`
  (the `a_noreturn` cap binds), `t_su = 0.56 s`, `ssd_m ≈ 26.5 m` vs 25.1 m
  upright — modest at street lean, large at deep lean, zero upright.

**Consumers (stated as requirements, one definition for all):** the per-sample
`ssd_m` field (05 §2.1) is computed with **that sample's own `phi`** and the
scenario's profile/mu; `stop_within_sight` (05 §6.2, doctrine-catalogue
cluster) and the V1 governor (04 §6) evaluate `vis_margin · ssd(v, phi) ≤
sight_ride_m` on exactly this definition (rider-path basis per bug-sheet 9.4; `sight_m` stays the comparability channel) — the governor's fixpoint loop already
re-reads the sight channel per iteration, so lean-awareness slots in with no
new machinery. Entry-speed capping (upright, `phi = 0`) is unchanged. Effect
is one-directional: governed speeds can only drop, strengthening the
blind-corner caution teaching (acceptance test `A-SSD-GOVERNOR`, §11).

The 7.0-vs-5.41 contradiction dissolves: 7.0 m/s² is now only ever applied
upright; while leaned the model caps at grip and at `a_noreturn`.

---

### 7. Closing the v_floor (2 m/s) vs sub-25-km/h gap (review §3.7)

Two different claims were sharing one constant. Split them:

- `v_floor_ms = 2.0 m/s` — **numerical termination floor** (unchanged): below
  it the quasi-static `kappa = G·tan(phi)/v²` blows up numerically; the run
  terminates `stopped`. 02 §7's row description is rewritten to say
  "numerical floor", dropping the "model-validity" wording; 01 §8's low-speed
  paragraph likewise.
- `v_valid_min_ms = 7.0 m/s` (TUNING, ≈ 25.2 km/h) — **model-validity band**,
  new constant in 02 §7. Derivation-backed, not arbitrary: below ≈ 6.4–7.4 m/s
  (lean-dependent, §1.1) no commandable brake can widen the line — the
  run-wide doctrine itself is unrepresentable — and D3's sub-25 km/h scope cut
  says the lean-driven model is untrustworthy there anyway.

**Semantics (not a termination):** per-sample boolean `below_validity` is set
whenever `v < v_valid_min_ms` **and** `|phi| ≥ 2°` (straight-line stops never
flag — a governed emergency stop to zero remains fully in scope). Resampling
ORs it per bracket like other boolean flags (02 §6). The verdict gains
`validity: {below_validity_s: number} | null` (total flagged dwell; `null`
when zero). Whether a doctrine check or placard hangs off the dwell is the
doctrine-catalogue cluster's call (interaction); the physics layer's duty ends
at honest recording. Presets living near the line (bookHairpin apex ≈ 26 km/h)
stay legal and unflagged; anything dipping below 25 km/h *while leaned* is now
visibly marked rather than silently trusted.

---

### 8. `stopped` termination and outcome — precise requirement (review §3.7)

The corrective/off-road cluster owns `terminated.reason`; this cluster states
its requirement exactly:

1. `terminated.reason` MUST include the value `stopped`, fired when `v`
   crosses `v_floor_ms` downward, with the crossing located by the standard
   event bracketing (exact `s`, `t` interpolated between the last conforming
   and first violating step) and a final exact sample emitted at the crossing.
2. 05 §6.1's closed outcome set gains **`stopped`**, precedence (merged, Option B):

   ```
   crash > runoff > wide > stopped > contained
   ```

   Rationale for the slot: a stop is strictly less bad than leaving the road
   or lane (`wide`/`runoff`) but is not a completed, gradeable corner
   (`contained`, whose zero-fail case is the derived `clean`). Checks the run never reached grade `na` with
   evidence `terminated_early: "stopped"`; checks over the completed portion
   grade normally. Recommended colour-law mapping (owned by the colour
   cluster, D9): amber family — "contained, incomplete".
3. Golden `C30-stop` pins the whole chain (§11).

---

### 9. Roll tracker per-RK4-stage semantics (review §3.8)

Replaces the ambiguous composition in 02 §2/§3/§6:

- **The clamp is evaluated once per step, from the pre-step state — no RK4
  stage evaluates it.** The controller's per-step output becomes
  `{roll_cmd, a_cmd, a_cmd_rate}` where
  `roll_cmd = clamp((target_lean − phi_prestep)/dt, −roll_rate, +roll_rate)`
  is computed from pre-step `phi` and held ZOH across all four stages (it
  joins the existing ZOH command; 02 §6's "the controller is read once per
  step" now includes it explicitly).
- The EOM drops the double clamp:
  `phi_dot = roll_cmd + phi_dot_su(stage state)` — `roll_cmd` constant across
  stages, **`phi_dot_su` evaluated per stage** from the stage's own `phi` and
  `a_clip` (the disturbance is genuine dynamics; the ellipse clip already runs
  per stage and `b_dem` uses the step's ZOH `a_cmd`).
- Consequence, now provable: with `phi_dot_su = 0`, RK4 integrates the
  constant `roll_cmd` exactly, so `phi_new = phi + roll_cmd·dt` — the tracker
  **reaches the target within one step when close and never overshoots**,
  exactly as 02 §3 claims; the claim stops being reading-dependent, and result
  hashes are implementation-independent.
- `a_cmd_rate`: computed once per step (§3.2), ZOH across stages, `0` at the
  first step.

---

### 10. Contract impact (exact shapes)

#### 10.1 Sample appends (05 §2.1; CSV column order §8.2 — append-only, after `limit_y`)

| Field | Type | Units | Interp. rule | Meaning |
|---|---|---|---|---|
| `su_sustained` | number | deg/s | `linear` | Sustained stand-up disturbance at this sample (merged: pov-samples' split is stored; `phi_dot_su ≡ su_sustained + su_transient` is defined notation, never a column). Zero everywhere the slice is inert — the summed channel is what makes invariants 1/4 and both roll-rate properties testable without a slice-off engine. |
| `su_transient` | number | deg/s | `linear` | Transient (onset-slew) stand-up disturbance at this sample (signed, post-envelope). |
| `a_cmd_rate` | number | m/s³ | `linear` | The step's ZOH commanded-accel rate (audits the transient trigger). |
| `below_validity` | boolean | — | `hold` (OR per bracket) | §7's validity flag. |

(Pinned merged CSV order after `limit_y`: `sight_ride_m, steer_state, lat_action_id, su_sustained, su_transient, a_cmd_rate, below_validity`.)

(The HUD/pedagogy cluster independently requested `phi_dot_su`; this is the
same field — one append, two consumers.)

#### 10.2 `stateAt.derived` additions (05 §4)

```
a_noreturn_ms2 : number | null   // A_SU_ONSET + roll_rate/(K_SU·tanh(|phi|/PHI0)); null when |phi| < 2°
a_widen_ms2    : number | null   // a_widen(phi, v; c=1); null when |phi| < 2°, v below the existence
                                 // bound, or the denominator ≤ 0
```

Derived, not stored (pure formulas of the sample) — the 02 §5.3 HUD promise
becomes contract-legal without violating `C-HUD-EQUALS-STATEAT`.

#### 10.3 Wire schema (03 §6.1) and constants (02 §5.2 table, replaced)

`brake.slew_mss?`, `throttle.slew_mss?` per §3.1. Constants table:

| Name | Value | Units | Status |
|---|---|---|---|
| `A_SU_ONSET` | 2.5 | m/s² | TUNING (unchanged) |
| `K_SU` | 0.30 | (rad/s)/(m/s²) | TUNING (driver: `b_dem`, §2) |
| `K_CHOP` | 0.12 | rad/(m/s²) impulse gain | TUNING (re-derived, §3.2; was 6.0 under degenerate impulse semantics) |
| `RATE_THRESHOLD` | 8.0 | m/s³ | TUNING (unchanged; now discriminates authored slews) |
| `PHI0` | 5.0 | deg | TUNING (continuity device — §1.2 wording) |
| `A_SLEW_DEFAULT` | 6.0 | m/s³ | TUNING (new) |
| `SLEW_MIN / SLEW_MAX` | 1 / 100 | m/s³ | schema bounds (`BAD_RANGE`) |
| `PHI_WIDEN_MIN` | 15 | deg | TUNING (invariant-2 domain) |
| `v_valid_min_ms` | 7.0 | m/s | TUNING (new, 02 §7) |

#### 10.4 Verdict / outcome

`outcome` enum + `stopped` with the §8 precedence; `validity` block per §7.
`diagnosis.cause` unchanged (`stand_up` already covers the slice; a stopped
run keeps whatever cause applies or `null`).

---

### 11. Acceptance: goldens and properties (review §3, item 9)

Goldens (02 §8 list; numeric values blessed per 09 §3.2, never hand-written):

- **`C30-chop` (updated)** — default chop (`slew 40`, `freeze_s 1.0`,
  `roll_cmd = 0` during freeze): pinned run-wide outcome class (single class
  pinned on this named fixture — reconciliation with 01 §4.3/03 §7.1 tables is
  the oracle cluster's; this golden supplies the fixture); asserts ≥ 1 sample
  with `|phi_dot| > roll_rate` and `phi_dot_su ≠ 0` (exercises
  `P-ROLLRATE-EXCESS`); **passes `P-ROLLRATE` by design** after §5.
- **`C30-trailbrake` (updated)** — 2.0 m/s² taper past turn-in at default
  slew: still tightens; **asserts `phi_dot_su = 0` at every sample** (the
  recorded-channel replacement for the impossible slice-off comparison).
- **`C30-squeeze` (new)** — mid-corner brake to 2.0 m/s² at `slew 4`:
  `phi_dot_su ≡ 0`, line tightens — "gently squeezing on the brake mid-corner"
  pinned as expressible.
- **`C30-heldbrake` (new)** — mid-corner commanded −8.0 m/s², default slew,
  held to termination, target lean held (`c = 1`): asserts predicate (W)
  becomes true and stays true; `kappa` non-increasing while it holds; lane
  fraction moves outward; outcome in the run-wide class; **no crash**.
- **`C30-deeplean` (new)** — explicit-plan fixture: `lean 40°`, `v ≈ 15.7`
  (R30 steady state), commanded −9.0 held: asserts `clipped = true`,
  `b_dem − b_del ≈ 3.7 m/s²`, sustained `phi_dot_su < 0`, path widens, no
  crash — the review's headline case, pinned green-by-design.
- **`C30-stop` (new)** — straight-line hard brake to zero:
  `terminated.reason = "stopped"` with bracketed crossing at `v_floor_ms`,
  outcome `stopped`, no `below_validity` flags (upright).
- **`C30-chop-sweep` (new fixture family)** — chop at `slew ∈ {10, 20, 40,
  80}`: the `P-RUNWIDE-MONOTONE` instantiation.

Properties (09 §3.4 — replaced/added lines):

- `P-ROLLRATE` (rescoped) and `P-ROLLRATE-EXCESS` — §5 wording.
- `P-RUNWIDE-WIDEN` (rescoped) — premise: predicate (W) sustained, `|phi| ≥
  15°`, `v ≥ v_valid_min_ms`; assertion: never tighter than the unperturbed
  twin from onset. No longer contradicts invariant 1.
- `P-TRAILBRAKE-TIGHTENS` (new) — `b_dem ≤ A_SU_ONSET`, slews ≤
  `RATE_THRESHOLD`, at lean: `phi_dot_su ≡ 0` and the line is at-or-tighter
  than the unbraked twin.
- `P-RUNWIDE-UPRIGHT` (restated) — invariant 4's two assertions (recorded
  channel + analytic twin); no slice-off engine.
- `P-RUNWIDE-MONOTONE` (restated, non-vacuous) — at fixed lean and `Δa`, exit
  lateral deviation is monotone non-decreasing in slew `r` over `[10, 80]
  m/s³`; and at fixed `r`, monotone in `Δa`. Stated domain (closes the
  "validity range stated nowhere" gap): `slew ∈ [SLEW_MIN, SLEW_MAX]`,
  `|phi| ∈ [15°, phiMax − 5°]`, `v ≥ v_valid_min_ms`.
- `P-AWIDEN-SIGN` (new) — at every sample of any fuzzed run (outside a
  deadband around the boundary), the sign of `d(ln kappa)/dt` computed from
  the recorded series matches the sign predicted by (†) from the recorded
  `phi_dot_su`, tracker term, `a_long`, `v`, `phi` — the algebra of §1 is
  self-auditing from trajectories alone.
- `P-SLEW` (new) — recorded `|a_cmd_rate|` never exceeds the active action's
  `slew_mss`; the command reaches its target level within `Δa/slew + dt`.
- `P-SSD-LEAN` (new) — `ssd_m` monotone non-decreasing in `|phi|` at fixed
  `v`; equals the carried upright formula at `phi = 0`; continuous at 0.
- `P-VALIDITY-FLAG` (new) — `below_validity` is set iff `v < v_valid_min_ms ∧
  |phi| ≥ 2°`, and the verdict's `validity.below_validity_s` equals the
  flagged dwell within one resample bracket.
- `A-SSD-GOVERNOR` (acceptance) — bookBlind solved `vis=cautious` under
  lean-aware `ssd` converges within `vis_max_iterations`, and its governed
  entry speed is ≤ the upright-`ssd` solve's (monotone-conservative).

---

### 12. Placement map

| Piece | Lands in | Replaces / contradicts |
|---|---|---|
| `b_dem` driver, revised `S_sustained`, envelope-role wording | 02 §5.2 | "responds to achieved deceleration — load transfer is physical…" sentence; the constants table (10.3 supersedes) |
| Three-band disclosure, `a_noreturn` new role, `a_widen` definition + derivation + worked table, existence/reachability bounds | 02 §5.3 (retitled "Two crossovers: `a_noreturn` and `a_widen`") | The whole current §5.3 ("Braking harder than that while leaned *forces* the stand-up… runs wide regardless of intent" — now true only above `a_widen`) |
| Restated invariants 1–5 | 02 §5.4 (full replacement) | All five current invariants |
| Slew-limited command, freeze `roll_cmd = 0`, controller output triple | 02 §3 | Tracker paragraph; the `{target_lean, roll_rate, a_cmd}` return shape |
| Per-step `roll_cmd` ZOH, per-stage `phi_dot_su`, `a_cmd_rate` definition, no double clamp | 02 §2 (EOM line), 02 §6 | `phi_dot = clamp(roll_cmd, …) + phi_dot_su`; the finite-difference sentence |
| `v_valid_min_ms`, `below_validity`, `v_floor` rewording | 02 §7; 01 §8 low-speed paragraph | "`v_floor_ms` … model-validity floor: below this the quasi-static lean model is invalid" |
| `stopped` outcome + precedence requirement | 05 §6.1 (+ handoff to corrective cluster for `terminated.reason`) | The merged 5-value outcome enum (`crash > runoff > wide > stopped > contained`) and precedence line |
| Sample appends, `stateAt.derived` additions, CSV columns | 05 §2.1, §3.2 table, §4, §8.2 | — (append-only) |
| `slew_mss` fields | 03 §6.1 action table | `brake`/`throttle` rows |
| Chop slew param + freeze pin | 03 §7.1 chop row | "abruptly cuts throttle… rider frozen" (mechanics now exact) |
| Lean-aware `ssd` | 03 §5.2 (full replacement) | The one-line closed form and its model table's implied semantics |
| V1 governor lean-aware sentence | 04 §6 | "`vis_margin · ssd(v) ≤ sight_m` for the configured stopping model" (gains `phi`; basis respelled `sight_ride_m` per bug-sheet 9.4) |
| Goldens & properties | 02 §8; 09 §3.4/§3.2 | `P-ROLLRATE`, `P-RUNWIDE-WIDEN`, `P-RUNWIDE-UPRIGHT`, `P-RUNWIDE-MONOTONE` lines; golden list |

---

### 13. Decision drafts (editor numbers them)

1. **Run-wide slice v2: demand-driven stand-up, widening threshold, slewed
   commands.** The sustained stand-up keys on grip-capped braking *demand*
   (`b_dem`), closing the deep-lean escape hatch; the geometric widening
   threshold `a_widen(phi, v; c)` is derived from the EOM and decouples from
   the roll-authority crossover `a_noreturn` (kept as a teaching quantity);
   longitudinal commands are slew-limited (`slew_mss`, default 6 m/s³), making
   the transient a graded, dt-invariant impulse (`Δphi ≈ K_CHOP·Δa·(1 − θ/r)`)
   and mid-corner brake squeezes expressible. One mechanism set replaces four
   review patches; invariants restated over domains the equations satisfy.
2. **Lean-aware stopping model.** `ssd` becomes a two-phase (stand-up at
   profile roll rate with decel capped at `min(a_ssd, aLongAvail,
   a_noreturn)`, then upright `a_ssd`) closed form, reducing exactly to the
   carried formula upright. One definition consumed by the per-sample channel,
   `stop_within_sight`, and the V1 governor — the safety check can no longer
   certify stops the simulator refuses to execute.
3. **Model-validity band split from the numeric floor.** `v_floor_ms = 2`
   (numeric termination) and `v_valid_min_ms = 7` (validity, derived from the
   widening algebra's own low-speed failure) are distinct; leaned dwell below
   validity is recorded per sample and surfaced in the verdict; `stopped`
   becomes a first-class outcome between `wide` and `contained`.

---

### 14. User decisions (owner calls; recommendations attached)

See structured summary — three genuine calls: the `stopped` outcome class vs
grade-on-completed-portion; lean-aware closed-form `ssd` vs placard-only vs
per-station corrective-shot integration; and accepting the disclosed
"stands-up-yet-tightens" band `[a_noreturn, a_widen)` with `K_SU = 0.30` vs
retuning `K_SU ≈ 0.5` to narrow it (which would also move the teachable
`a_noreturn` from 5.41 to ≈ 4.25 m/s²). Rejected alternative recorded for §2:
a placard on clipped-at-lean braking instead of the `b_dem` driver — rejected
because it leaves the headline anti-book trajectory in the product with a
caption instead of removing it.
