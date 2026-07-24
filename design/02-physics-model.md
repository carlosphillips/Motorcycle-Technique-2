# The Physics Model — Tier 1R

## 1. What this document covers

This document specifies linelab's physics: the state vector and equations of
motion, the rider model and its steering-channel state machine, the friction
ellipse, **the run-wide slice** (the one addition that makes Tier 1R more than a
point-mass), the integrator, the termination and fate policy, and the
golden-numerics plan. It is written so the model can be reimplemented from the
equations and constants here alone. Every constant is `name = value + units`;
constants with no book source are marked `TUNING` and must never be attributed
to the book.

The governing conviction is carried unchanged from the prior design: **nothing
about the "correct" line is authored.** A scenario supplies a road, a start
state, and a plan of `brake` / `turn_in` / `throttle` / `position` actions.
Apex, exit, run-wide behaviour, and lean **emerge from integration** (D7).
Feasibility is decided by *shooting* — re-integrating through the same pure
stepper — never by a closed-form formula (`04-solver-and-authoring.md`).

Module home: `core/` (pure, dependency-free, no wall-clock, no randomness — the
same code runs in CLI and browser per D1). Road geometry is owned by `road/`
(`03-roads-scenarios-and-visibility.md`); sight by `sight/`; this document's
contract is the physics only.

---

## 2. State vector and equations of motion

The vehicle is a point mass carving arcs on a flat 2-D road surface, in a
**y-down, x-east screen frame** with `+kappa` denoting a right-hand turn (SVG
export needs no vertical flip; carried from the prior design). `phi` and
`cmd_lean` are **positive leaning right** — `handSign("R") = +1`,
`handSign("L") = −1`, the single sign-conversion point, shared with the
occluder `sideSign` family (`03-roads-scenarios-and-visibility.md` §4) — and
the paired lateral convention: the road-frame offset `d` is **positive to the
rider's left** (sample contract, `05-result-contract-and-inspection.md` §2.1).

```
state = { t, x, y, psi, v, phi }
```

| Symbol | Meaning | Units |
|---|---|---|
| `t` | time | s |
| `x, y` | planar position | m |
| `psi` | heading | rad |
| `v` | forward speed | m/s |
| `phi` | lean (roll) angle, signed (+ = right lean) | rad |

State derivatives:

```
x_dot   = v · cos(psi)
y_dot   = v · sin(psi)
psi_dot = v · kappa = G · tan(phi) / v
v_dot   = a_clip                       (friction-ellipse-clipped, §4)
phi_dot = roll_cmd + phi_dot_su        (§3, §5 — no second clamp here)
```

`roll_cmd` is computed **once per step** from the pre-step state, already
clamped to `±roll_rate` (§3), and held zero-order across all four RK4 stages;
`phi_dot_su` is evaluated **per stage** from the stage's own `phi` and `a_clip`
(§6). `psi_dot = G·tan(phi)/v` is sign-correct for signed `phi` as written — a
left lean (`phi < 0`) yields a left turn (`kappa < 0`).

With `G = 9.81 m/s²`, the **emergent-curvature identity** is the model's heart:

```
kappa(v, phi) = G · tan(phi) / v²        [1/m]
```

and its algebraic family:

```
aLat(v, kappa)         = v² · kappa            ( ≡ G·tan(phi) )
requiredLean(v, kappa) = atan(v² · kappa / G)
speedForLean(r, phi)   = sqrt(G · r · tan(phi))     ( v ∝ √r )
```

Causal consequences that make the doctrine emerge: at fixed lean, **decelerating
tightens** the arc (`v` falls, `kappa` rises) and **rolling on widens** it — the
mechanism behind late-apex exit drift, the double-apex inter-touch drift, and
(inverted by the run-wide slice, §5) the stand-up mechanic.

Quasi-static lean: curvature is the steady-state value at the current lean.
There is no roll inertia state and no handlebar state (D3).

---

## 3. The rider model

The controller — compiled from the plan (`03-roads-scenarios-and-visibility.md`)
— is evaluated once per step and returns

```
{ steer_state, target_lean, roll_cmd, a_cmd, a_cmd_rate }
```

(zero-order hold across the step, §6). `target_lean` is produced by the
steering-channel state machine (§3.1) — **never read raw off the plan**.

**Lean is a rate-limited setpoint tracker.** Steering is never instantaneous:

```
roll_cmd = clamp( (target_lean − phi_prestep) / dt, −roll_rate, +roll_rate )
```

computed once per step from the pre-step `phi` and held across all four RK4
stages. It reaches the target within one step when close, and never overshoots
— provable, not aspirational, under the §6 stage semantics. The per-rider
`roll_rate` is what separates a quick steer from the slow-steer mistake.

**The effective roll rate.** Everywhere the controller reads the profile rate
it reads `roll_rate_eff = min(roll_rate_dps, rider.roll_rate_cap_dps)` — the
optional wire cap (`03-roads-scenarios-and-visibility.md` §6.1; `slow_steer`
compiles to a cap of 0.3 × the profile rate): the commit ramp, the
heading-capture release accrual (§3.1), the unwind, the tracker cap, the
chain-link flip budget, and the lean-aware `ssd` stand-up phase. `roll_rate` in
every formula of this document means this effective rate.

**The longitudinal channel is slew-limited.** The commanded level `a_cmd` is a
slew-limited approach to the active `brake`/`throttle` action's target level:
per step, `a_cmd_k = a_cmd_{k−1} + clamp(target_level − a_cmd_{k−1}, −slew·dt,
+slew·dt)`, with `slew` the action's `slew_mss` (wire field, default
`A_SLEW_DEFAULT`, §5.2). `taper_to_s` keeps its release-to-zero-by-station
meaning; the action's declared profile defines the target trajectory, and
**any** change of commanded level is additionally rate-limited by `slew_mss` (a
taper whose implied rate is below the slew is unaffected). `a_cmd_rate` is the
per-step ZOH rate (§6) that the transient stand-up term reads (§5.2).

**Steering freeze.** A throttle action carrying `freeze_steer_s` (the compiled
`chop`'s freeze; range `(0, FREEZE_MAX_S]`, §5.2) overrides `roll_cmd = 0` for
its window **without changing `steer_state`**: the rider yields and `phi`
evolves under `phi_dot_su` alone. Not target-hold — a tracker fighting at full
authority would cancel sub-`a_noreturn` stand-ups and erase the chop lesson;
the freeze selects the `c = 0` column of the widening algebra (§5.3).

**Rider profiles** (all `TUNING`):

| Profile | `roll_rate_dps` (deg/s) | `skill` | `t_react_s` (s) |
|---|---|---|---|
| `casual` | 20 | 0.85 | 1.0 |
| `street` | 50 | 0.85 | 1.0 |
| `trained` | 65 | 0.90 | 0.8 |
| `racer` | 85 | 0.95 | 0.7 |

`skill` derates *reserves only* (§4); `t_react_s` is the recognition delay
consumed by the corrective shot (`04-solver-and-authoring.md` owns the shot).
The stopping-distance (`ssd`) models carry their own `t_react_s` per model
(`alert`, `aashto` — owned by `03-roads-scenarios-and-visibility.md` §5),
independent of the rider profile.

**Commanded vs delivered.** The plan commands `a_cmd` (longitudinal) and, via
the steering machine, `target_lean`; physics delivers `a_clip` (ellipse-clipped,
§4) and `phi` (rate-limited, tracker-guided, and stand-up-perturbed, §3.1, §5).
Both the commanded and delivered values are recorded per sample
(`05-result-contract-and-inspection.md`) — the gap between them is exactly what
the HUD teaches ("commanded −3.0 m/s², grip-limited to −2.1").

### 3.1 The steering channel and the turn-in lifetime

The steering channel has exactly **one owner per control step**, determined by
a four-state machine evaluated once per step (ZOH, same cadence as the rest of
the controller). The longitudinal channel (`a_cmd` from `brake`/`throttle`) is
orthogonal and never participates — roll-on and unwind compose freely by
construction. The state is recorded per sample as `steer_state`, with
`lat_action_id` naming the owning action (`05-result-contract-and-inspection.md`
§2.1).

```
steer_state ∈ { "track", "commit", "unwind", "position" }      (closed enum)

track      : the bounded lane-keeping tracker holding f_hold (target_lean ≈ 0
             on straights). Initial state; also the terminal state of every
             clean exit.
commit(k)  : target_lean = handSign(k.hand) · k.lean_deg — turn_in k's
             commitment.
unwind(c)  : target_lean = 0, entered from commit by the release predicate;
             c is the released commitment's governing corner.
position(p): the same tracker slewing to an authored position target.
```

Transitions (complete; anything not listed cannot occur):

| From | To | Trigger |
|---|---|---|
| `track` | `commit(k)` | integration reaches `turn_in` k's `at_s` |
| `commit(k)` | `commit(k')` | next `turn_in` k' reaches its `at_s` — **supersede**: k' takes the channel immediately, whether or not k released; this is the esses flip and the fifty-pence facet chain |
| `commit(k)` | `unwind(c)` | the release predicate fires — once per commitment |
| `unwind(c)` | `track` | `\|phi\| ≤ EPS_UNWIND_DONE_DEG` — `f_hold` := the f-snapshot at handoff |
| `unwind(c)` / `track` | `commit(k')` | a later `turn_in` reaches its `at_s` |
| `unwind(c)` / `track` | `position(p)` | a `position` action reaches its `at_s` (validation guarantees this cannot happen inside a static commitment window, `03-roads-scenarios-and-visibility.md` §6.1) |
| `position(p)` | `track` | the position action completes — the tracker **holds** the achieved `f` as `f_hold` (holding is what makes hold-wide work) |
| `commit(k)` | `position(p)` | only when k's governing corner's `s1` has already passed (a stale commitment yields) |

**Ownership (REQ-STEER-OWNERSHIP).** The steering channel has exactly one owner
per instant, with precedence: *(1)* the corrective-shot policy — **within the
corrective shadow run only** (the corrective is a branched shadow,
`04-solver-and-authoring.md`; the main line's channel never sees it); *(2)* an
unreleased `turn_in` commitment whose governing corner's `s1` has not passed;
*(3)* a `position` action inside its window — including one that starts during
an unwind or over a stale (past-`s1`) commitment: the position action takes the
channel, an incomplete unwind is subsumed by the position guidance law, which
terminates at its target `f` with zero lean commitment and hands the channel to
`track`, holding the achieved `f` as `f_hold`; *(4)* `unwind`; *(5)* `track`.
Validation guarantees case (3) never collides with case (2) before `s1` (the
static-window rejection, `03-roads-scenarios-and-visibility.md` §6.1). There is
never a blended output and never a step with no lateral law in force.

#### The tracker law (`track` and `position`)

Evaluated once per integrator step (ZOH). `dOf(f)` and the corridor algebra are
owned by `road/` (`03-roads-scenarios-and-visibility.md` §2) and shared with
the resampler.

```
d_tgt       = dOf(f_hold)                                  [m]   corridor algebra
e           = d_tgt − d                                    [m]   lateral error, signed in d-space
d_dot       = v · sin(psi − psi_road(s))                   [m/s] lateral closure rate
a_track     = clamp( OMEGA_POS² · e  −  2 · OMEGA_POS · d_dot,
                     −a_lat_pos_max, +a_lat_pos_max )      [m/s²] (ζ = 1, critical damping, fixed)
kappa_ff    = kappa_road(s) / (1 − d · kappa_road(s))      [1/m] feedforward: hold the offset line
kappa_cmd   = kappa_ff + a_track / v²                      [1/m]
target_lean = clamp( atan(v² · kappa_cmd / G),
                     −PHI_TRACK_AUTH, +PHI_TRACK_AUTH )    [rad]
```

`target_lean` then feeds the **same** rate-limited setpoint tracker of §3, and
the run-wide disturbance `phi_dot_su` still adds after it — position never
bypasses lean, roll rate, or the friction ellipse. Every term is a pure
function of `(state, road, plan, constants)`; two implementers converge from
the formulas alone. On straight approaches with the default `start.f` the
output is exactly `target_lean = 0`. Constants (`OMEGA_POS = 2.0 rad/s`,
`PHI_TRACK_AUTH_DEG = 5.0°`, `a_lat_pos_max = 0.8 m/s²`, `EPS_POS_M`,
`EPS_POS_RATE`) live in the §5.2 constants table — their normative home;
`03-roads-scenarios-and-visibility.md` references them.

**The D7 guard (invariant §5.4.6).** `PHI_TRACK_AUTH_DEG` is what keeps the
tracker from becoming a hidden path-follower: at
`atan(a_lat_pos_max/G) = 4.66°` of correction authority the tracker can hold a
line only where the road demands `a_lat ≲ 0.8 m/s²` (`R ≥ v²/0.8` — at
34 km/h, R ≥ 111 m). Entering a real corner (`book90`'s R12 needs 7.4 m/s² at
34 km/h) without a `turn_in`, the tracker saturates at ~4.7° and the bike
**runs off** — cornering is possible only through a committed `turn_in`, so
apex, exit, and run-wide remain emergent, and a plan with no `turn_in` still
fails honestly. Positioning is an approach/exit, near-straight-domain tool by
*physics*, not by prose.

**Completion and events** (kinds owned by
`05-result-contract-and-inspection.md` §5): `position_start` at activation
(exact station crossing via event bracketing); `position_complete` at the first
sample in `track` for action `p` with `|e| ≤ EPS_POS_M` **and**
`|d_dot| ≤ EPS_POS_RATE`; `position_shortfall` at the first sample with
`s > p.at_s + over_m` if completion has not fired — the tracker *keeps
converging* afterward (`over_m` is the declared completion budget, not a
switch-off); the shortfall is recorded, never silent, and alone changes no
outcome class. After completion the tracker **holds** `f_hold` until the next
transition — "hold wide until release" is the law's natural behaviour, not a
special mode. The reachability formula that validates `position` targets and
resolves `over_m: "auto"` is owned by `03-roads-scenarios-and-visibility.md`
§6.1; its constants `K_REACH` and `MIN_POS_DD_M` live in the §5.2 table.

**Interaction with the run-wide slice.** `phi_dot_su` perturbs `phi`; the
tracker is feedback, so it counteracts within its authority and no special
coupling is specified. A stand-up event stronger than the tracker's authority
wins — which is the honest outcome.

#### The commitment and its governing corner

`commit(k)` sets `target_lean = handSign(k.hand) · k.lean_deg`. Lean magnitudes
stay unsigned in the wire (`lean_deg ∈ (0, 90)`) — direction rides the
per-corner `hand` binding. Every `turn_in` has a **governing corner**, resolved
at validation (static, recorded in the frozen scenario): `hand` omitted → the
corner with the smallest `s1 > at_s` (the next corner to be exited), the action
inheriting that corner's hand; `hand` explicit → the corner with the smallest
`s1 > at_s` **whose hand equals the action's hand**; no such corner → typed
rejection `BAD_RANGE / no_governing_corner`. Binding and rejection are stated
normatively in `03-roads-scenarios-and-visibility.md` §6.1; the release
predicate below is this document's. The binding rule is why chained solving
works at zero-gap esses: a `turn_in` for corner n+1 may legally sit at a
station still inside corner n; with `hand` explicit it binds past corner n, and
its commitment, release, and exit heading are all keyed to corner n+1. Both
`tangent_inside` and explicit-`lean_deg` targets use the same binding;
`tangent_inside` defers only the magnitude to the solver, never the direction.

#### The release predicate (heading capture)

While in `commit(k)` with governing corner `c`, each control step computes:

```
psi_exit(c)  = road heading at c.s1                              [rad]  (from RoadModel)
dpsi_rem     = handSign(c.hand) · wrapToPi(psi_exit(c) − psi)    [rad]
t_unwind     = |phi| / roll_rate                                 [s]    (roll_rate in rad/s)
v_eff        = max(V_MIN_RHS, v + 0.5 · a_clip · t_unwind)       [m/s]  (first-order speed prediction)
dpsi_unwind  = (G / (v_eff · roll_rate)) · ln(1 / cos(|phi|))    [rad]

RELEASE  ⇔  dpsi_rem ≤ dpsi_unwind
```

`dpsi_unwind` is the closed-form heading accrued during a constant-rate unwind:
`∫ G·tan(phi)/v dt` with `phi(t) = phi₀ − roll_rate·t` gives
`(G/(v·roll_rate))·ln(sec phi₀)` exactly. Release fires when the remaining road
heading to the corner's exit equals what the unwind itself will accrue — lean
reaches zero just as heading reaches `psi_exit(c)`, so the out-in-out exit is
**derived, not asserted**. `dpsi_rem ≤ 0` (heading already past exit —
over-rotated) releases immediately. The predicate re-evaluates every step until
it fires, then is done: one release per commitment, no re-entry into `commit`
without a new `turn_in`. A station release pinned to `c.s1` was considered and
rejected: the ideal line's turning extends past `s1` while an early-apex line
over-rotates before it, so a station trigger leaves an O(5–10°) heading error
of either sign at book90 scale (an O(1–2.5 m) lateral error on a 16 m exit);
heading capture costs one closed-form formula, needs no `TUNING` station, and
works unchanged on `C30`, `book90`, and esses.

**Worked numbers at book90 scale.** Street profile
(`roll_rate = 50 °/s = 0.8727 rad/s`), solved apex lean ≈ 28°, v ≈ 9 m/s:

- Residual yaw if never released: `psi_dot = G·tan 28°/9 = 33.2 °/s`. The
  uncorrected path (radius `v²/(G·tan 28°) = 15.5 m` > road's 12 m) crosses the
  half-corridor (1.35 m) just 6.5 m into book90's 16 m exit straight — without
  a release rule, no exit could ever self-verify.
- With the release rule: `dpsi_unwind = 8.9°`, `t_unwind = 0.56 s`, ≈ 5.0 m of
  travel. Release fires with 8.9° of heading still to accrue; capture completes
  on the exit straight with lean at zero.
- Prediction error bound: with a 2 m/s² roll-on active through the unwind, the
  constant-v accrual overestimates by 0.52°; the `v_eff` refinement shrinks
  that to ≪ `EPS_EXIT_DEG = 1.0°`. Even an aggressive 5 m/s² drive leaves
  ≈ 1.2° one-shot error, and since the predicate re-evaluates until it fires,
  only post-release speed change contributes. Decel during the unwind
  (brake-at-lean, a mistake regime) makes the stand-up term *assist* the
  unwind — capture is early, never late.

#### The unwind

In `unwind` the rate-limited tracker of §3 does the work —
`roll_cmd = clamp((0 − phi)/dt, −roll_rate, +roll_rate)` — so the unwind rate
**is** the profile roll rate; no new constant. `slow_steer`'s cap derates the
whole effective rate, so a slow-steer line also unwinds slowly — one
perturbation, both edges. The `phi_dot_su` stand-up term already pushes toward
upright and vanishes at `phi = 0` (tanh envelope), so it can only *speed* an
unwind, never fight it or cross zero. At `|phi| ≤ EPS_UNWIND_DONE_DEG` the
channel hands to `track` with the f-snapshot as `f_hold` (no snap-back); the
tracker levels the last fraction of a degree and holds.

#### Exit, figure end, and chains

- The `exit` event (`05-result-contract-and-inspection.md` §5, measured
  post-hoc): first station at/after the apex where
  `|wrapToPi(psi − psi_exit(c))| ≤ EPS_EXIT_DEG` (deadband shared with
  `01-scope-and-doctrine.md` §4.1).
- The `release` event marks the release station/time per commitment, emitted on
  **every** line with a released `turn_in`.
- At figure end, a clean line reaches `road_end` in `track` with
  `|phi| ≤ EPS_UNWIND_DONE_DEG` and heading error ≤ `EPS_EXIT_DEG` on the exit
  straight — downstream consumers may rely on "clean lines terminate upright".
- At chain boundaries, if `turn_in(n+1)` starts before corner n's release, **no
  unwind occurs** — supersession rolls the tracker continuously through zero
  toward the opposite sign (0.56 s + 0.56 s ≈ 1.1 s, ≈ 10 m of travel for a
  28°→−28° street flip; the chain solver must fit flips of that length,
  `04-solver-and-authoring.md` §5, and link-continuity checks grade the
  handoff).

#### The mistakes fall out unchanged

`premature`: the committed lean consumes the heading budget early → release
fires *early*, deep inside the corner → the bike straightens onto exit heading
from an inside position while the road still curves away → `f` climbs →
wide/runoff — fig 8.1's red-line geometry, emergent. `premature_contained`
(eased lean): captures near the end, stays contained. `slow_steer`: heading
accrues too slowly, release comes late or never — the commitment persists to
termination and the line leaves the road mid-corner still leaned. Double apex:
after touch one, `psi_exit` is still far, so the predicate stays silent and the
inter-touch drift remains roll-on widening per `01-scope-and-doctrine.md` §5;
touch two supersedes; release fires once, near the true exit.

---

## 4. The friction ellipse and the one-μ policy

There is exactly one physical grip ceiling: the surface's true coefficient `mu`
(`mu_default = 1.0`, dry asphalt; per-location patches via
`muAt(s, d)` from the road model). All hard limits derive from it:

```
aLatMax(mu)  = mu · G           aLongMax(mu) = mu · G
phiMax(mu)   = atan(mu)                       ( 45.0° at mu = 1.0 )

ellipseMag(aLong, aLat, mu) = sqrt( (aLong/aLongMax)² + (aLat/aLatMax)² )
gripMargin                  = 1 − ellipseMag
aLongAvail(aLat, mu)        = aLongMax · sqrt(max(0, 1 − (aLat/aLatMax)²))
```

**Clipping happens inside every integrator sub-stage** (§6): at each derivative
evaluation, `a_lat = G·tan(phi)` is computed from the stage's own `phi`, and
`a_clip = clamp(a_cmd, −aLongAvail, +aLongAvail)` drives `v_dot`. The trajectory
can never transiently leave the grip circle mid-step.

**One-μ policy (carried verbatim in spirit).** Hard ceilings use physical `mu`
only. Skill derating exists solely in *separately named* reserve functions that
demand an already-derated argument:

```
mu_use            = skill · mu
aLatReserve(muUse) = muUse · G
phiReserve(muUse)  = atan(muUse)      ( 40.36° at skill 0.85, mu 1.0 )
```

The naming is the guard rail: no code path can silently substitute an advisory
reserve for a physical ceiling or vice versa. Doctrine checks that grade
"reserve kept" use reserves; crash detection uses ceilings.

---

## 5. The run-wide slice (the R in Tier 1R)

### 5.1 Why it exists

In the pure point-mass model, cutting throttle or braking mid-corner only
*decelerates*, and deceleration at fixed lean **tightens** the arc — so a
chopped line drifted *inward* and stayed contained, the opposite of what the
book teaches and riders experience: an abrupt chop or a hard brake at lean
**stands the bike up and runs it wide**. The physical causes (fork geometry,
tire profile, load transfer) are Tier-3 machinery, but their *net effect on the
path* is simple and robust: longitudinal deceleration at lean produces a
stand-up tendency that sheds lean faster than the rider can counter. Tier 1R
models that net effect — and nothing else — as a roll-rate disturbance.

### 5.2 Model form

The stand-up disturbance is the sum of a **sustained** term — keyed on the
**grip-capped braking demand** (load transfer and geometry torque follow what
the rider *asks* of the tire, up to the physical ceiling) — and a **transient**
term (responds to the *commanded* accel rate — an abrupt chop is a rider
action, so intent triggers it; carried from the prior design):

```
phi_dot_su  = −sign(phi) · [ S_sustained + S_transient ] · tanh(|phi| / PHI0)

b_dem       = clamp(−a_cmd, 0, aLongMax(mu))         // = min(max(0, −a_cmd), mu·G)
S_sustained = K_SU   · relu( b_dem − A_SU_ONSET )
S_transient = K_CHOP · relu( −a_cmd_rate − RATE_THRESHOLD )
```

Below the ellipse clip, `b_dem` equals delivered decel, so behaviour is
bit-identical to a delivered-decel driver everywhere the ellipse is not
clipping. When the ellipse clips at lean, the refused demand is exactly what
stands the bike up — a firmly *held* hard brake at deep lean no longer reads as
a stable, grip-perfect tightening spiral (the headline case, worked in §5.3).
The cap at `aLongMax(mu) = mu·G` keeps absurd commands bounded and honours the
one-μ policy (physical ceiling, never skill-derated).

Because `a_cmd` is slew-limited (§3), `a_cmd_rate` equals the active slew
during a ramp and is dt-invariant (§6); the transient is a **graded impulse**:
for a command drop of magnitude `Δa` at slew `r`, the integrated lean shed
(saturated envelope, no counter) is

```
Δphi_su ≈ K_CHOP · Δa · (1 − RATE_THRESHOLD/r)        bounded above by K_CHOP·Δa
```

so `K_CHOP` carries units of rad per m/s² of command drop, and severity is
monotone in both `r` and `Δa` (under `0.12`, a 3 m/s² chop sheds ≈ 4.1° at
`r = 10`, 12.4° at 20, 16.5° at 40, 18.6° at 80). `A_SLEW_DEFAULT = 6.0 m/s³`
sits deliberately **below** `RATE_THRESHOLD = 8.0 m/s³`: a default-authored
brake is a firm squeeze that never fires the transient — gently squeezing on
the brake mid-corner is expressible. A grab is authored intent (`slew_mss`
above threshold); the `chop` mistake compiles to a throttle cut at
`chop_slew_mss = 40 m/s³` (default, owned by
`03-roads-scenarios-and-visibility.md` §7.1) paired with a steering freeze
(`freeze_steer_s`, §3).

The two terms are recorded per sample as `su_sustained` and `su_transient`
(deg/s, signed, post-envelope); `phi_dot_su ≡ su_sustained + su_transient` is
defined notation, never a stored column
(`05-result-contract-and-inspection.md` §2.1).

**Constants** (the document's consolidated table — §3.1, §5, and §7 constants):

| Name | Value | Units | Status |
|---|---|---|---|
| `A_SU_ONSET` | `2.5` | m/s² | `TUNING` — demand below this never stands the bike up |
| `K_SU` | `0.30` | (rad/s) per (m/s²) | `TUNING` — sustained stand-up gain (driver: `b_dem`) |
| `K_CHOP` | `0.12` | rad per (m/s²) | `TUNING` — transient impulse gain (re-derived; the carried 6.0 belonged to a degenerate one-step-impulse regime) |
| `RATE_THRESHOLD` | `8.0` | m/s³ | `TUNING` — command-drop rate that reads as a chop (carried; now discriminates authored slews) |
| `PHI0` | `5.0` | deg | `TUNING` — `tanh` envelope width (carried) |
| `A_SLEW_DEFAULT` | `6.0` | m/s³ | `TUNING` — default `slew_mss` on `brake`/`throttle` (`03` §6.1) |
| `SLEW_MIN` / `SLEW_MAX` | `1` / `100` | m/s³ | schema bounds on `slew_mss` (`BAD_RANGE` outside) |
| `FREEZE_MAX_S` | `5.0` | s | `TUNING` — upper bound on `freeze_steer_s` (`03` §6.1) |
| `PHI_WIDEN_MIN` | `15` | deg | `TUNING` — invariant-2 domain floor (§5.4) |
| `v_valid_min_ms` | `7.0` | m/s | `TUNING` — model-validity band (§7; derived from the widening algebra, §5.3) |
| `EPS_UNWIND_DONE_DEG` | `0.25` | deg | `TUNING` — unwind→`track` handoff (§3.1; one step of street roll authority) |
| `EPS_EXIT_DEG` | `1.0` | deg | `TUNING` — exit heading-capture deadband (§3.1; `01` §4.1) |
| `OMEGA_POS` | `2.0` | rad/s | `TUNING` — lateral-tracker natural frequency (§3.1; ζ = 1 fixed, not a knob) |
| `PHI_TRACK_AUTH_DEG` | `5.0` | deg | `TUNING` — tracker total-lean authority cap (§3.1); `atan(a_lat_pos_max/G) = 4.66°` leaves the feedforward ~0.34° of headroom |
| `a_lat_pos_max` | `0.8` | m/s² | `TUNING` — tracker lateral-accel budget (§3.1; carried, normative home now here; `03` references it) |
| `EPS_POS_M` | `0.05` | m | = carried `eps_m` — position completion tolerance (§3.1) |
| `EPS_POS_RATE` | `0.05` | m/s | `TUNING` — position completion closure-rate tolerance (§3.1) |
| `K_REACH` | `1.2` | — | `TUNING` — position-reachability margin (`03` §6.1 validation formula) |
| `MIN_POS_DD_M` | `0.10` | m | `TUNING` — displacement below which a generated hold emits no wire action (`04` §6) |
| `eps_f_detect` | `0.01` | f-units | `TUNING` — `run_wide_detect` outward-crossing deadband (§7; `04`'s corrective shot) |
| `eps_f_save` | `0.03` | f-units | `TUNING` (carried) — corrective return tolerance; the wide/runoff classification deadband (`04`) |

The `tanh(|phi|/PHI0)` envelope is a **continuity device** — it keeps the term
C0 through zero-lean inflections (chicanes) and zero at upright; it is
saturated (> 0.96) above 10° lean, so `a_noreturn` and `a_widen` are
effectively lean-shaped only by `sin(2phi)/v` and grip availability, not by the
envelope. `−sign(phi)` always pushes toward upright, never past it (the `tanh`
factor guarantees the term vanishes at `phi = 0`, so it cannot flip the bike to
the other side).

### 5.3 Two crossovers: `a_noreturn` and `a_widen`

#### The widening algebra (derivation)

The emergent curvature is `kappa = G·tan(phi)/v²`. Take `phi > 0` WLOG and
differentiate the log:

```
ln kappa       = ln G + ln tan(phi) − 2·ln v
d(ln kappa)/dt = phi_dot / (sin(phi)·cos(phi)) − 2·v_dot / v
```

Under braking, `v_dot = a_clip = −b_del` where `b_del ≥ 0` is the **delivered**
decel (post-ellipse). So

```
d(ln kappa)/dt = phi_dot/(sin(phi)cos(phi)) + 2·b_del/v          (†)
```

The path **widens** (kappa falls) iff `(†) < 0`, i.e. iff
`−phi_dot > b_del · sin(2·phi) / v`. During a held brake with the rider
countering at fraction `c` of full roll authority (`c = 1`: tracker railed
toward the line; `c = 0`: frozen rider), with the demand driver of §5.2 and
envelope `T = tanh(|phi|/PHI0)`:

```
phi_dot = c·roll_rate − K_SU·relu(b_dem − A_SU_ONSET)·T
```

Substituting and solving for the demand at which widening begins, in the
**unclipped regime** (`b_dem ≤ aLongAvail(phi)`, so `b_del = b_dem = a`):

```
a_widen(phi, v; c) = (c·roll_rate + K_SU·A_SU_ONSET·T) / (K_SU·T − sin(2phi)/v)
                     defined only where the denominator > 0
```

In the **clipped regime** (`b_dem > aLongAvail(phi)`, so
`b_del = aLongAvail(phi) < b_dem`) the kinematic tightening term uses the
smaller `b_del`, so the widening condition relaxes to

```
K_SU·(b_dem − A_SU_ONSET)·T − c·roll_rate  >  aLongAvail(phi)·sin(2phi)/v      (W)
```

Predicate **(W)** is the normative instantaneous widening predicate (it covers
both regimes when `b_del = min(b_dem, aLongAvail)` is substituted for
`aLongAvail`); the closed-form `a_widen` is its unclipped solution and the
HUD/teaching quantity. Using unclipped `a_widen` as a display is
*conservative*: clipping only makes widening easier. The counter-command
fraction `c` matters: `a_widen(30°, 15, c=0) = 3.10 m/s²` vs `6.70` at `c = 1`
— which is exactly why a chop-plus-freeze runs wide at decels a fighting rider
survives.

Worked values (street profile, `roll_rate = 0.8727 rad/s`, `K_SU = 0.30`,
`A_SU_ONSET = 2.5`, `mu = 1`):

| phi | v (m/s) | a_noreturn | a_widen (c=1) | aLongAvail |
|---|---|---|---|---|
| 30° | 15 | 5.41 | 6.70 | 8.49 |
| 28° | 13 | 5.41 | 6.87 | 8.31 |
| 40° | 15 | 5.41 | 6.92 | 5.34 (clipped regime) |

Existence bound: the denominator requires `v > sin(2phi)/(K_SU·T)`; demand
reachability (`b_dem ≤ mu·G`) tightens this to
`v ≥ sin(2phi) / (K_SU·T − (c·roll_rate + K_SU·A_SU_ONSET·T)/(mu·G))`
≈ **6.4 m/s at 30°, ≤ 7.4 m/s at any lean** (street). Below that speed no
commandable brake widens — kinematic tightening (`2b/v`) dominates. This is a
real, derived low-speed validity floor for the run-wide doctrine and is what
`v_valid_min_ms` pins (§7).

**Worked headline case** (golden `C30-deeplean`, §8): `phi = 40°`, `v = 15`,
commanded `−9.0 m/s²` held, rider fighting: `b_del = aLongAvail = 5.34`
(clipped, `clipped = true` recorded), `b_dem = 9.0`. Predicate (W):
`0.30·(9.0 − 2.5) − 0.873 = 1.077 > 5.34·sin(80°)/15 = 0.351` — **the bike
stands up and runs wide**, no crash (ellipseMag rides ≤ 1), matching "getting
off the gas or braking at a high lean angle straightens the bike and runs it
wide".

#### Three bands (`a_noreturn` kept as teaching)

```
a_noreturn(phi) = A_SU_ONSET + roll_rate / (K_SU · tanh(|phi|/PHI0))
```

is **kept, as a teaching quantity only**: the braking demand beyond which the
rider cannot hold lean even at full counter-command (net roll rate ≤ 0 by
construction). It is *not* a path-widening threshold — at exactly `a_noreturn`
the net roll rate is zero, `phi` holds, `v` falls, and kappa strictly rises.
The normative three-band disclosure:

- `b_dem < a_noreturn` — the rider can hold lean; sub-threshold braking
  tightens (trail-braking regime).
- `a_noreturn ≤ b_dem < a_widen` — **the bike stands up yet the line still
  tightens**: lean sheds slower than speed falls. Tier 1R's honest answer for
  this band; the run typically ends `stopped` (the envelope's small-lean
  equilibrium — e.g. `phi_eq ≈ 6.0°` at `b_dem = 6 m/s²`, street — is reached
  only near/after termination and is disclosed, not hidden).
- `b_dem ≥ a_widen(phi, v; c)` — the path itself opens: the geometric run-wide
  the book teaches.

For the `street` profile at meaningful lean, `a_noreturn ≈ 5.41 m/s²` — a
teachable, inspectable quantity. Both crossovers are HUD-displayable via
`stateAt.derived` (`a_noreturn_ms2`, `a_widen_ms2`, nullable —
`05-result-contract-and-inspection.md` §4); their existence — not their exact
values, which are `TUNING` — is the design requirement.

### 5.4 Behavioural invariants (testable properties)

These are the specification; the constants above are servants to them
(`09-verification-and-testing.md` §property-tests):

1. **Sub-threshold neutrality (trail-braking preserved).** Wherever
   `b_dem < A_SU_ONSET` and `−a_cmd_rate < RATE_THRESHOLD`, `phi_dot_su ≡ 0`
   and Tier 1R is bit-identical to the pure point-mass; light trail braking
   (taper ≤ 2.5 m/s²) still *tightens* the line — the advanced technique
   remains representable and gradeable. *Tests:* `P-TRAILBRAKE-TIGHTENS`,
   `C30-trailbrake`, `C30-squeeze`.
2. **Geometric widening above `a_widen` only.** At every sample where
   `|phi| ≥ PHI_WIDEN_MIN`, `v ≥ v_valid_min_ms`, and predicate (W) holds
   (equivalently `b_dem ≥ a_widen(phi, v; c)` in the unclipped regime),
   `d|kappa|/dt ≤ 0` within tolerance; path-level, the trajectory is never
   tighter than the unperturbed twin from onset. Stated for both canonical
   rider configurations (`c = 1` held-fight; `c = 0` freeze). *Tests:*
   `P-RUNWIDE-WIDEN`, `P-AWIDEN-SIGN`, `C30-heldbrake`, `C30-deeplean`.
3. **A chop at lean produces the pinned run-wide class.** The canonical `chop`
   mistake preset yields the outcome pinned per fixture in the one pin table
   (`03-roads-scenarios-and-visibility.md` §7.1 — `runoff` on the named
   fixture), with severity graded per §5.2. The mistake compile pairs the
   physics with the rider freeze (`freeze_steer_s`, default ≈ 1.0 s, owned by
   the mistake compiler): `roll_cmd = 0` during the freeze — the panicked rider
   makes no steering input. Physics provides the stand-up; the rider model
   provides the freeze; the wide exit emerges. *Tests:* the mistake oracle +
   `C30-chop`, `C30-chop-sweep`.
4. **Upright immunity, falsifiable.** For any run with `|phi| ≤ 2°`
   throughout: recorded `phi_dot_su` is zero at every sample where `phi = 0`
   exactly, and the trajectory deviates from the analytic upright-braking
   solution by ≤ `eps_m = 0.05 m`. (Stated as a path bound because the raw
   term is *not* negligible at 1.9° — `tanh(1.9/5) ≈ 0.36` — only its path
   effect is; the recorded channel plus an analytic twin make this testable
   with no slice-off engine.) *Test:* `P-RUNWIDE-UPRIGHT`.
5. **Continuity, narrowed to what this document can promise.** `phi_dot_su` is
   C0 in `(phi, a_cmd, a_clip)`; slew limiting makes `a_cmd` C0 in time; the
   crash boundary keeps its §7 deadbands. Verdict-flip protection at the
   wide/runoff classification boundary is delegated to the classification
   margins (`eps_f_detect`, `eps_f_save`) owned by the corrective shot
   (`04-solver-and-authoring.md`).
6. **Tracker authority (the D7 guard).** At every sample with
   `steer_state ∈ {track, position}`,
   `|cmd_lean| ≤ PHI_TRACK_AUTH_DEG + eps_deg_report`; a plan with no `turn_in`
   cannot corner — on a real corner the tracker saturates and the line runs
   off. *Tests:* `P-POS-AUTH`, `P-POS-NO-CORNER`.

### 5.5 What it deliberately does not model

Fork geometry and trail torque, tire profile and contact-patch migration,
suspension pitch, engine-braking character, rider body english, and any
handlebar/countersteer state. Those mechanisms are *why* the net effect exists;
Tier 1R asserts only the net effect. If a future tier models them, the
invariants in §5.4 remain the acceptance tests.

### 5.6 Consequences

- The `chop` mistake and fig 8.5's failed single-apex strategy (sustained
  braking at lean) become honestly representable (`01-scope-and-doctrine.md`
  §4.3, §5).
- The doctrine's causal claim — quick steer then early throttle is *safer*
  because off-throttle at lean stands the bike up — is now demonstrable in the
  simulator rather than merely asserted in prose.
- The corrective shot (`04-solver-and-authoring.md`) integrates its shadow with
  the slice active and commands add-lean off the brakes (`a_cmd = 0`), so the
  sustained term stays dormant during a legitimate save; a save that would
  require braking past the crossovers at lean is penalised by the physics
  automatically.

---

## 6. The integrator

- **Classical fixed-step RK4**, `dt_s = 0.005 s` (200 Hz, `TUNING`). The four
  stages share one derivative closure; ellipse clipping (§4) runs inside every
  stage evaluation.
- **Zero-order-hold control:** the controller is read once per step; its full
  output `{steer_state, target_lean, roll_cmd, a_cmd, a_cmd_rate}` holds across
  all four stages. `roll_cmd` is computed from the pre-step `phi` — no stage
  re-evaluates the clamp — so with `phi_dot_su = 0`, RK4 integrates the
  constant `roll_cmd` exactly and `phi_new = phi + roll_cmd·dt`: the tracker
  reaches its target within one step when close and never overshoots, by
  construction, and result hashes are implementation-independent.
  `phi_dot_su` is evaluated **per stage** from the stage's own `phi` and
  `a_clip` (the disturbance is genuine dynamics; the ellipse clip already runs
  per stage; `b_dem` uses the step's ZOH `a_cmd`).
  `a_cmd_rate = (a_cmd_k − a_cmd_{k−1})/dt` is computed once per step, held
  across the stages, and defined `0` at the first step; because `a_cmd` is
  slew-limited (§3) it **equals the active slew during a ramp and is
  dt-invariant** — well-posed, which the transient stand-up term (§5.2)
  depends on.
- **Low-speed guard:** `V_MIN_RHS = 0.01 m/s` floors the `v` in
  `kappa = G·tan(phi)/v²` inside a stage; distinct from the outer termination
  floor `v_floor_ms` (§7).
- **Two-tier stepping:** physics integrates in *time*; analysis wants uniform
  *arc length*. **The raw 200 Hz series is integrator-internal working state,
  discarded after resampling.** The retained record is the resampled arc-grid
  series (`ds_m = 0.5 m`; numeric fields lerped, boolean flags —
  `below_validity` included — OR-ed per bracket, lane fraction recomputed from
  the same corridor algebra — never lerped independently) plus the exact event
  crossings (`05-result-contract-and-inspection.md` §5) and the final exact
  sample at termination. The time-base and sample contract are owned by
  `05-result-contract-and-inspection.md`.
- **Event bracketing:** crash / off-road / stop / road-end crossings are
  located by linear interpolation between the last accepted and first violating
  state, so events — and the terminal sample — carry exact crossing coordinates
  rather than post-step states.
- **Determinism:** `core/` is pure — no wall-clock, no randomness, no
  environment reads; iteration order is stable; identical scenario JSON yields
  identical output on every platform. This is what makes D6's
  share-inputs-and-recompute honesty work, and what result hashing
  (`09-verification-and-testing.md`) relies on.

---

## 7. Termination, events, and fate

**Termination precedence per step** (the closed `terminated.reason` set; the
`terminated = {reason, s, t, x, y}` shape is owned by
`05-result-contract-and-inspection.md` §2):

```
crash > off_road > stopped (v < v_floor_ms) > road_end > max_time > max_dist
```

- `crash` above `off_road`: a step that both lowsides and departs reports the
  more severe physical fact (and preserves the rule that crash strictly
  precedes corrective solving).
- `off_road` above `stopped`: crossing the edge is the doctrinally salient
  fact; a stopped-in-the-grass state is unrepresentable by construction.
- Runs terminate at **road end** only; corners are analysis windows, never
  terminators.

**Off-road trigger:** `off_road := |d| > lane_width_m` — the physical
carriageway edges (`03-roads-scenarios-and-visibility.md` §2) — evaluated per
step in the termination scan; the crossing is bracketed (§6), so the terminal
sample sits **exactly on the road edge**, not at a post-step point in the
grass. `muAt(s, d)` is laterally clamped beyond the edge solely so the crossing
step's RK4 sub-stages are well-defined — **no grass physics is modelled and no
sample is emitted beyond the crossing** (placard: *"left the road — off-road
behaviour not modelled"*).

Reason ↔ event mapping: `crash` → `crash` event, `off_road` → `off_road`,
`stopped` → `stop` (the two spellings are deliberate), `road_end` → `road_end`;
`max_time`/`max_dist` are runaway guards with no bookmark event — there is
nothing pedagogical at a guard, and the reason field records it.

| Name | Value | Role |
|---|---|---|
| `v_floor_ms` | `2.0 m/s` | **numerical** termination floor: below it `kappa = G·tan(phi)/v²` blows up numerically; the run terminates with an honest `stopped` (bracketed crossing, final exact sample) |
| `v_valid_min_ms` | `7.0 m/s` | model-validity band (`TUNING`, ≈ 25 km/h; §5.2 table): below it no commandable brake can widen the line (§5.3), so the run-wide doctrine is unrepresentable. Per-sample boolean `below_validity` is set when `v < v_valid_min_ms ∧ \|phi\| ≥ 2°` (straight-line stops never flag); resampling ORs it per bracket (§6); the verdict's `validity` dwell block is owned by `05-result-contract-and-inspection.md` §6.3. A flag, never a termination |
| `max_time_s` | `120 s` | runaway guard |
| `max_dist_m` | `5000 m` | runaway guard |

**Crash deadbands** (carried; cross-runtime verdict stability): crash only when
`phi > phiMax + eps_phi_deg (0.05°)` or `ellipseMag > 1 + eps_mag (1e-3)`.
Reporting tolerances: `eps_m = 0.05 m`, `eps_deg_report = 0.1°`.

**Fate.** The outcome law is owned by `05-result-contract-and-inspection.md`
§6.1; physics supplies the fates. The closed set, precedence left to right:

```
crash > runoff > wide > stopped > contained
```

- `crash` — grip or lean ceiling exceeded (deadbanded, above).
- `runoff` / `wide` — the outward corridor departure (`f` rising through
  `1 + eps_f_detect` after a turn-in — the `run_wide_detect` event), split by
  the corrective shot's feasibility: a fixed-policy branched **shadow** run,
  never inside the main integration, owned by `04-solver-and-authoring.md`.
  Detection is outward-only: an inside-corridor excursion on pavement never
  moves outcome (doctrine-check territory); an inside-side `off_road` with no
  outward detect classifies `runoff`, corrective null.
- `stopped` — terminated at `v_floor_ms` before road end, none of the above.
- `contained` — reached road end on the carriageway, none of the above.

`outcome` never reads a doctrine check (`P-OUTCOME-RUBRIC-FREE`); `clean` is
the derived predicate `contained ∧ zero applicable check fails`, and the
quality/colour composition is owned by `05-result-contract-and-inspection.md`
§6.1 / `06-rendering-and-projection.md` §5.1. Refused lines are `LineRefusal`
envelope entries (`05-result-contract-and-inspection.md` §7); invalid input
surfacing at run time is a linelab bug — typed `INTERNAL`, exit 4
(`08-cli-and-agent-interface.md` §3.1).

**Refusals (placard policy, `01-scope-and-doctrine.md` §8):** super-tight
geometry is refused at validation by **sweep content**: `OUT_OF_SCOPE /
super_tight_geometry` iff, **for some single corner** `c`, the swept angle
accumulated over the stations of `c` where the local radius
`r(s) ≤ R_UTURN_MAX = 15 m` is ≥ `SWEEP_UTURN_MIN = 170°`. The quantifier is
per corner, not per road — corners are minted per curved segment
(`03-…md` §2), so a road may accumulate more than 170° of tight sweep in total
without any one corner doing so. `03-…md` §2 is the owning statement. On
constant arcs this reduces exactly to the carried rule; on tapers it is
decidable and measures actual U-turn-regime content (`bookDecreasing`
`R 16>9 ^130` spends 111.4° at r ≤ 15 → in scope; a true `R 10 ^180` hairpin
still refuses; the fig 8.4 teardrop `R 30>9 ^210` spends 60.0° → in scope). The
typed error carries `detail: {sweep_below_r_max_deg, r_uturn_max_m}`.
Vertically-blind sight reads `na`; a run that hits `v_floor_ms` reports
`stopped`, never a fabricated low-speed path.

---

## 8. Golden numerics plan

The prior canonical corner (R60, 254.5 m total, 63 % straight) was itself part
of the stretched-figure problem. The new canonical corner is chosen to be
book-proportioned at true scale while remaining a genuine road-speed scenario:

**`C30` — the canonical corner.** Two-lane road, `lane_width_m = 3.5`,
`bike_margin_m = 0.40` (`TUNING`), constant-radius right-hander `R = 30 m`,
sweep `90°`, entry straight `35 m`, exit straight `25 m` (arc length ≈ 47 m —
the corner, not the approach, dominates the frame even unprojected). Entry
`70 km/h`, braking to a solved entry speed near `50 km/h`, `street` profile,
`mu = 1.0`.

Once the engine exists, the golden run pins the following quantities (numeric
values with tolerances, not byte hashes, at this layer; the single tolerance
table lives in `09-verification-and-testing.md` §3 and owns the ± values):

- solved committed lean and turn-in station,
- `apex_pct` (must exceed the late bar of 50),
- apex lane fraction and clearance,
- `v_apex` and `phi_max` (must sit at/below the 40.36° reserve),
- minimum grip margin,
- the `release` event station; heading error at the `exit` event ≤
  `EPS_EXIT_DEG`; final lean at road end ≤ `EPS_UNWIND_DONE_DEG`,
- outcome `contained`, quality `good` (the derived `clean` predicate), with the
  full doctrine check vector.

### 8.1 Blessed values (generated)

The values themselves are produced by the first bless and written back into the
block below by `linelab-bless --write-docs`
(`09-verification-and-testing.md` §3.2a). Hand edits between the markers are
forbidden; `T-BLESSED-DOC-SYNC` regenerates the block from the committed
fixtures and asserts byte equality, so this document can never claim numbers
the fixtures don't hold.

<!-- BLESSED:BEGIN engine=0.1.0 date=2026-07-23 -->
| fixture | quantity | value | unit | tol |
|---|---|---|---|---|
| C30 | turn_in_s | 26.21782053655581 | m | ±0.01 |
| C30 | lean_commit_deg | 31.372848313777666 | deg | ±0.01 |
| C30 | apex_s | 66 | m | ±0.01 |
| C30 | apex_pct | 65.78404314465008 | % | ±0.1 |
| C30 | apex_f | 0.03400197259168147 | - | ±0.001 |
| C30 | apex_clearance_m | 0.09180532599753999 | m | ±0.01 |
| C30 | v_apex_ms | 14.53278143623492 | m/s | ±0.01 |
| C30 | phi_max_deg | 31.372848313777666 | deg | ±0.01 |
| C30 | grip_min | 0.3503147709285165 | - | ±0.001 |
| C30 | release_s | 85.60701520889671 | m | ±0.01 |
| C30 | exit_heading_err_deg | -1 | deg | ±0.01 |
| C30 | road_end_phi_deg | -0.11893501352011661 | deg | ±0.01 |
| C30 | road_end_f | 0.7811758502112548 | - | ±0.001 |
| C30 | outcome | contained | - | exact |
| C30 | quality | good | - | exact |
| C30-chop | turn_in_s | 26.21782053655581 | m | ±0.01 |
| C30-chop | lean_commit_deg | 31.372848313777666 | deg | ±0.01 |
| C30-chop | apex_s | 64.5 | m | ±0.01 |
| C30-chop | apex_pct | 62.60094428281217 | % | ±0.1 |
| C30-chop | apex_f | 0.03933497673340397 | - | ±0.001 |
| C30-chop | apex_clearance_m | 0.10620443718019068 | m | ±0.01 |
| C30-chop | v_apex_ms | 14.140500000000065 | m/s | ±0.01 |
| C30-chop | phi_max_deg | 31.372848313777666 | deg | ±0.01 |
| C30-chop | grip_min | 0.36201515454929445 | - | ±0.001 |
| C30-chop | release_s | 86.40459927816184 | m | ±0.01 |
| C30-chop | exit_heading_err_deg | -1 | deg | ±0.01 |
| C30-chop | road_end_phi_deg | -0.004270317139838747 | deg | ±0.01 |
| C30-chop | road_end_f | 1.3751534418535318 | - | ±0.001 |
| C30-chop | outcome | wide | - | exact |
| C30-chop | quality | failing | - | exact |
| C30-trailbrake | turn_in_s | 29.5 | m | ±0.01 |
| C30-trailbrake | lean_commit_deg | 19.5 | deg | ±0.01 |
| C30-trailbrake | apex_s | 76 | m | ±0.01 |
| C30-trailbrake | apex_pct | 87.00470222356945 | % | ±0.1 |
| C30-trailbrake | apex_f | -0.09330622600272365 | - | ±0.001 |
| C30-trailbrake | apex_clearance_m | 0.25192681020735375 | m | ±0.01 |
| C30-trailbrake | v_apex_ms | 10.903052224879318 | m/s | ±0.01 |
| C30-trailbrake | phi_max_deg | 19.5 | deg | ±0.01 |
| C30-trailbrake | grip_min | 0.5913872156636455 | - | ±0.001 |
| C30-trailbrake | release_s | 81.90000313307213 | m | ±0.01 |
| C30-trailbrake | exit_heading_err_deg | -1 | deg | ±0.01 |
| C30-trailbrake | road_end_phi_deg | 0.008684415604949087 | deg | ±0.01 |
| C30-trailbrake | road_end_f | -0.01894723230658024 | - | ±0.001 |
| C30-trailbrake | outcome | contained | - | exact |
| C30-trailbrake | quality | caution | - | exact |
| C30-DR | turn_in_s | 8.297381841698263 | m | ±0.01 |
| C30-DR | lean_commit_deg | 32.27201713970964 | deg | ±0.01 |
| C30-DR | apex_s | 33 | m | ±0.01 |
| C30-DR | apex_pct | 75.98638268784303 | % | ±0.1 |
| C30-DR | apex_f | 0.22596122325811285 | - | ±0.001 |
| C30-DR | apex_clearance_m | 0.6100953027969047 | m | ±0.01 |
| C30-DR | v_apex_ms | 9.977296083176311 | m/s | ±0.01 |
| C30-DR | phi_max_deg | 32.27201713970964 | deg | ±0.01 |
| C30-DR | grip_min | 0.32987083846805987 | - | ±0.001 |
| C30-DR | release_s | 41.4432587121141 | m | ±0.01 |
| C30-DR | exit_heading_err_deg | -1 | deg | ±0.01 |
| C30-DR | road_end_phi_deg | -0.8487759120454561 | deg | ±0.01 |
| C30-DR | road_end_f | 0.8455986608147426 | - | ±0.001 |
| C30-DR | outcome | contained | - | exact |
| C30-DR | quality | good | - | exact |
<!-- BLESSED:END -->

### 8.2 Companion goldens

- **`C30-LR`** (two-corner alternating hand): road
  `lane 3.5 | S 35 | R 30 ^70 | S 10 | L 30 ^70 | S 25`, street profile, entry
  70 km/h, authored as an explicit wire plan with two `turn_in`s — `hand`
  omitted on both, exercising pure inference. Pins: governing corners resolve
  to `c1` (right) / `c2` (left); `phi` crosses zero exactly once between the
  corners (sign sequence + → 0 → −, monotone through the flip); a `release`
  event exists for the final commitment; corner 2's exit straightens under the
  same three exit assertions as `C30`.
- **`C30-chop`** — the default chop (`slew 40`, `freeze_steer_s 1.0`,
  `roll_cmd = 0` during the freeze): outcome pinned `runoff` per the pin table
  (`03-roads-scenarios-and-visibility.md` §7.1); asserts ≥ 1 sample with
  `|phi_dot| > roll_rate` and `phi_dot_su ≠ 0` (invariant §5.4.3; exercises
  `P-ROLLRATE-EXCESS`, passes `P-ROLLRATE` by design — the cap property is
  scoped to the tracker component).
- **`C30-trailbrake`** — 2.0 m/s² taper carried past turn-in at default slew:
  still tightens; asserts `phi_dot_su = 0` at every sample; taper check
  gradeable (invariant §5.4.1).
- **`C30-squeeze`** — mid-corner brake to 2.0 m/s² at `slew 4`:
  `phi_dot_su ≡ 0`, line tightens — "gently squeezing on the brake mid-corner"
  pinned as expressible.
- **`C30-heldbrake`** — explicit-plan fixture in the **clipped-widening regime**
  (the sustained-hold twin of `C30-deeplean`): onset lean 40° (R30 steady,
  `v ≈ 15.7 m/s`), start `f = 0` (inside), commanded −8.0 m/s² at default slew held
  to termination — above `a_long_avail ≈ 5.3 m/s²`, so the command clips throughout.
  Predicate (W) becomes true and stays true over the whole hold; `kappa`
  non-increasing while it holds; lane fraction moves **outward** across the entire
  hold; outcome in the run-wide class; **no crash**. (At −8.0 from the ordinary C30
  corner speed the lean was too shallow to clip — the line moved *inward* to
  `off_road`, outward excursion identically zero.)
- **`C30-deeplean`** — explicit-plan fixture: lean 40°, `v ≈ 15.7` (R30 steady
  state), commanded −9.0 held: `clipped = true`, `b_dem − b_del ≈ 3.7 m/s²`,
  sustained `phi_dot_su < 0`, path widens, no crash (§5.3's headline case,
  green by design).
- **`C30-stop`** — straight-line hard brake to zero:
  `terminated.reason = "stopped"` with bracketed crossing at `v_floor_ms`,
  outcome `stopped`, no `below_validity` flags (upright).
- **`C30-chop-sweep`** — chop at `slew ∈ {10, 20, 40, 80}`: the
  `P-RUNWIDE-MONOTONE` instantiation.
- **`C30-DR`** — the decreasing-radius taper twin (R40→R25 clothoid), pinning
  the special-case late bar.

Byte-level result hashing exists as a *regression tripwire* one layer up
(`09-verification-and-testing.md`); the goldens here are numeric with stated
tolerances so the model can be re-implemented from this document and still pass.

---

## 9. Relation to the prior design

**Carried:** the state vector, EOM, and emergent-curvature identity; rate-
limited lean tracking and the rider profiles; the friction ellipse with sub-
stage clipping and the one-μ naming policy; fixed-step RK4 at 200 Hz with ZOH
control; event bracketing; the crash deadbands; the runaway guards; the
numerical `v_floor`; the transient stand-up term's form and rationale.

**Changed:** the stand-up coupling is promoted from a cosmetic transient into
the **run-wide slice v2** — the sustained term keys on grip-capped braking
*demand* (`b_dem`, closing the deep-lean escape hatch), and the transient
becomes a graded, dt-invariant impulse under slew-limited longitudinal commands
(`K_CHOP` restated as an impulse gain); `chop`'s canonical outcome pins
`runoff` per the one pin table; the wide/runoff split is decided by a
fixed-policy branched shadow — the corrective shot
(`04-solver-and-authoring.md`) — with the slice active; termination gains
`off_road` and deletes the corner-end terminator; the outcome enum is
physics-only (`violation` retired, `stopped` added — the law lives in
`05-result-contract-and-inspection.md` §6.1); the raw 200 Hz series is demoted
to integrator-internal scratch; the super-tight refusal measures sweep content
instead of headline numbers.

**New:** the steering-channel state machine (§3.1) with heading-capture release
and profile-rate unwind — the out-in-out exit is derived, not asserted; the
bounded lateral tracker channel (`track`/`position`) whose authority cap is the
D7 guard; the `a_widen` crossover decoupled from `a_noreturn` and the
three-band disclosure (§5.3); the model-validity band `v_valid_min_ms` split
from the numeric floor; the invariant-first specification style (§5.4) that
makes every `TUNING` constant subordinate to a testable behaviour; the
book-proportioned canonical corner `C30` replacing R60, with the `C30-LR` and
run-wide golden families; numeric-tolerance goldens with the generated
blessed-values block (§8.1).
