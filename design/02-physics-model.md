# The Physics Model — Tier 1R

## 1. What this document covers

This document specifies linelab's physics: the state vector and equations of
motion, the rider model, the friction ellipse, **the run-wide slice** (the one
addition that makes Tier 1R more than a point-mass), the integrator, the event
and outcome policy, and the golden-numerics plan. It is written so the model can
be reimplemented from the equations and constants here alone. Every constant is
`name = value + units`; constants with no book source are marked `TUNING` and
must never be attributed to the book.

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
export needs no vertical flip; carried from the prior design).

```
state = { t, x, y, psi, v, phi }
```

| Symbol | Meaning | Units |
|---|---|---|
| `t` | time | s |
| `x, y` | planar position | m |
| `psi` | heading | rad |
| `v` | forward speed | m/s |
| `phi` | lean (roll) angle, signed | rad |

State derivatives:

```
x_dot   = v · cos(psi)
y_dot   = v · sin(psi)
psi_dot = v · kappa = G · tan(phi) / v
v_dot   = a_clip                       (friction-ellipse-clipped, §4)
phi_dot = clamp(roll_cmd, −roll_rate, +roll_rate) + phi_dot_su   (§3, §5)
```

with `G = 9.81 m/s²`. The **emergent-curvature identity** is the model's heart:

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
`{ target_lean, roll_rate, a_cmd }` (zero-order hold across the step, §6).

**Lean is a rate-limited setpoint tracker.** Steering is never instantaneous:

```
roll_cmd = clamp( (target_lean − phi) / dt, −roll_rate, +roll_rate )
```

It reaches the target within one step when close, and never overshoots. The
per-rider `roll_rate` is what separates a quick steer from the slow-steer
mistake.

**Rider profiles** (all `TUNING`):

| Profile | `roll_rate_dps` (deg/s) | `skill` | `t_react_s` (s) |
|---|---|---|---|
| `casual` | 20 | 0.85 | 1.0 |
| `street` | 50 | 0.85 | 1.0 |
| `trained` | 65 | 0.90 | 0.8 |
| `racer` | 85 | 0.95 | 0.7 |

`skill` derates *reserves only* (§4); `t_react_s` is the recognition delay used
by run-wide correction. The stopping-distance (`ssd`) models carry their own
`t_react_s` per model (`alert`, `aashto` — owned by
`03-roads-scenarios-and-visibility.md` §5), independent of the rider profile.

**Commanded vs delivered.** The plan commands `a_cmd` (longitudinal) and
`target_lean`; physics delivers `a_clip` (ellipse-clipped, §4) and `phi` (rate-
limited and stand-up-perturbed, §5). Both the commanded and delivered values are
recorded per sample (`05-result-contract-and-inspection.md`) — the gap between
them is exactly what the HUD teaches ("commanded −3.0 m/s², grip-limited to
−2.1").

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
*decelerates*, and deceleration at fixed lean **tightens** the arc — so the
model's chop verdict was an inward-drifting `violation`, the opposite of what
the book teaches and riders experience: an abrupt chop or a hard brake at lean
**stands the bike up and runs it wide**. The physical causes (fork geometry,
tire profile, load transfer) are Tier-3 machinery, but their *net effect on the
path* is simple and robust: longitudinal deceleration at lean produces a
stand-up tendency that sheds lean faster than the rider can counter. Tier 1R
models that net effect — and nothing else — as a roll-rate disturbance.

### 5.2 Model form

The stand-up disturbance is the sum of a **sustained** term (responds to
achieved deceleration — load transfer is physical, so it follows what the tire
actually does) and a **transient** term (responds to the *commanded* accel rate
— an abrupt chop is a rider action, so intent triggers it; carried from the
prior design):

```
phi_dot_su = −sign(phi) · [ S_sustained + S_transient ] · tanh(|phi| / PHI0)

S_sustained = K_SU   · relu( −a_clip     − A_SU_ONSET )
S_transient = K_CHOP · relu( −a_cmd_rate − RATE_THRESHOLD )
```

| Name | Value | Units | Status |
|---|---|---|---|
| `A_SU_ONSET` | `2.5` | m/s² | `TUNING` — decel below this never stands the bike up |
| `K_SU` | `0.30` | (rad/s) per (m/s²) | `TUNING` — sustained stand-up gain |
| `K_CHOP` | `6.0` | (rad/s) per (m/s³) | `TUNING` — transient gain (carried) |
| `RATE_THRESHOLD` | `8.0` | m/s³ | `TUNING` — command-drop rate that reads as a chop (carried) |
| `PHI0` | `5.0` | deg | `TUNING` — `tanh` envelope width (carried) |

The `tanh(|phi|/PHI0)` envelope keeps the term continuous through zero-lean
inflections (chicanes) and extinguishes it upright. `−sign(phi)` always pushes
toward upright, never past it (the `tanh` factor guarantees the term vanishes
at `phi = 0`, so it cannot flip the bike to the other side).

### 5.3 The point of no return

Because `phi_dot_su` subtracts from the tracker's authority, there is a decel
beyond which the rider *cannot hold the line* even at full roll command:

```
a_noreturn ≈ A_SU_ONSET + roll_rate / (K_SU · tanh(|phi|/PHI0))
```

For the `street` profile (`roll_rate = 50 deg/s = 0.873 rad/s`) at meaningful
lean (`tanh → 1`): `a_noreturn ≈ 2.5 + 0.873/0.30 ≈ 5.4 m/s²`. Braking harder
than that while leaned *forces* the stand-up — the bike straightens and runs
wide regardless of intent. This crossover is a teachable, inspectable quantity
(the HUD may display it), and its existence — not its exact value, which is
`TUNING` — is the design requirement.

### 5.4 Behavioural invariants (testable properties)

These are the specification; the constants above are servants to them
(`09-verification-and-testing.md` §property-tests):

1. **Steady throttle or gentle roll-off at lean → no effect.** For
   `−a_clip < A_SU_ONSET` and `|a_cmd_rate| < RATE_THRESHOLD`, Tier 1R is
   bit-identical to the pure point-mass. In particular light trail braking
   (taper ≤ ~2.5 m/s²) still *tightens* the line — the advanced technique
   remains representable and gradeable.
2. **Hard braking at lean widens, never tightens.** For sustained
   `−a_clip ≥ a_noreturn` at `|phi| ≥ 15°`, the emergent path's radius grows
   relative to the pre-brake arc; the trajectory's lane fraction moves outward.
3. **A chop at lean produces a run-wide outcome class.** The canonical `chop`
   mistake preset must yield `wide` or `runoff` — **this reclassifies `chop`
   from the prior design's `violation`** and is pinned by the preset oracle. The
   mistake compile pairs the physics with a rider freeze (`freeze_s ≈ 1.0 s`,
   `TUNING`, owned by the mistake compiler in
   `03-roads-scenarios-and-visibility.md`): the panicked rider does not re-lean
   during the freeze. Physics provides the stand-up; the rider model provides
   the freeze; the wide exit emerges.
4. **Upright immunity.** At `|phi| < 2°` the term is negligible: straight-line
   braking is unchanged pure physics.
5. **Continuity.** `phi_dot_su` is continuous in `phi`, `a_clip`, and
   `a_cmd_rate`; no verdict may flip across an infinitesimal input change
   (deadbands in §7 still apply at classification time).

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
- Run-wide correction solving (`04-solver-and-authoring.md`) must integrate
  with the slice active: a "save" that requires braking past `a_noreturn` at
  lean is infeasible by construction.

---

## 6. The integrator

- **Classical fixed-step RK4**, `dt_s = 0.005 s` (200 Hz, `TUNING`). The four
  stages share one derivative closure; ellipse clipping (§4) runs inside every
  stage evaluation.
- **Zero-order-hold control:** the controller is read once per step; its
  command holds across all four stages. `a_cmd_rate` is the finite difference
  of commanded longitudinal accel between consecutive steps — well-defined per
  step, which the transient stand-up term (§5.2) depends on.
- **Low-speed guard:** `V_MIN_RHS = 0.01 m/s` floors the `v` in
  `kappa = G·tan(phi)/v²` inside a stage; distinct from the outer termination
  floor `v_floor_ms` (§7).
- **Two-tier stepping:** physics integrates in *time*; analysis wants uniform
  *arc length*. The raw 200 Hz series is resampled onto a fixed grid
  `ds_m = 0.5 m` (numeric fields lerped, boolean flags OR-ed per bracket, lane
  fraction recomputed from the same corridor algebra — never lerped
  independently). Both series are retained; the time-base and sample contract
  are owned by `05-result-contract-and-inspection.md`.
- **Event bracketing:** crash / stop / road-end crossings are located by linear
  interpolation between the last accepted and first violating state, so events
  carry exact crossing coordinates rather than post-step states.
- **Determinism:** `core/` is pure — no wall-clock, no randomness, no
  environment reads; iteration order is stable; identical scenario JSON yields
  identical output on every platform. This is what makes D6's
  share-inputs-and-recompute honesty work, and what result hashing
  (`09-verification-and-testing.md`) relies on.

---

## 7. Events, violations, and outcomes

**Termination precedence per step:** crash → stopped (`v < v_floor_ms`) →
road/corner end → runaway guards.

| Name | Value | Role |
|---|---|---|
| `v_floor_ms` | `2.0 m/s` | model-validity floor: below this the quasi-static lean model is invalid; run terminates with an honest `stopped` |
| `max_time_s` | `120 s` | runaway guard |
| `max_dist_m` | `5000 m` | runaway guard |

**Crash deadbands** (carried; cross-runtime verdict stability): crash only when
`phi > phiMax + eps_phi_deg (0.05°)` or `ellipseMag > 1 + eps_mag (1e-3)`.
Reporting tolerances: `eps_m = 0.05 m`, `eps_deg_report = 0.1°`.

**Outcome classes** (closed set, precedence left to right):

```
crash > runoff > wide > violation > clean
```

- `crash` — grip or lean ceiling exceeded (deadbanded).
- `runoff` — left the road/lane and no feasible corrective returns it (the
  corrective shot, integrated with the run-wide slice active, fails).
- `wide` — ran wide but a feasible add-lean corrective exists.
- `violation` — stayed contained but failed doctrine (early apex, faceting,
  reserve eaten, sight deficit…).
- `clean` — all checks pass.

(`dnf-spec-error` covers invalid input surfaced at run time; validation should
catch nearly all of these earlier per D8.)

**Refusals (placard policy, `01-scope-and-doctrine.md` §8):** super-tight
geometry (sweep ≥ 170° **and** r ≤ 15 m) is rejected at validation as
out-of-scope; vertically-blind sight reads `na`; a run that hits `v_floor_ms`
reports `stopped`, never a fabricated low-speed path.

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
- outcome `clean` with the full doctrine check vector.

Companion goldens exercise the run-wide slice: `C30-chop` (canonical chop →
`wide`/`runoff`, invariant §5.4.3) and `C30-trailbrake` (2.0 m/s² taper carried
past turn-in → still tightens, taper check gradeable, invariant §5.4.1). A
decreasing-radius taper twin (`C30-DR`, R40→R25 clothoid) pins the special-case
late bar. Byte-level result hashing exists as a *regression tripwire* one layer
up (`09-verification-and-testing.md`); the goldens here are numeric with stated
tolerances so the model can be re-implemented from this document and still pass.

---

## 9. Relation to the prior design

**Carried:** the state vector, EOM, and emergent-curvature identity; rate-
limited lean tracking and the rider profiles; the friction ellipse with sub-
stage clipping and the one-μ naming policy; fixed-step RK4 at 200 Hz with ZOH
control and the two-tier time/arc-length scheme; event bracketing; the crash
deadbands; the runaway guards; the `v_floor` and super-tight refusals; the
transient stand-up term's form and rationale.

**Changed:** the stand-up coupling is promoted from a cosmetic transient into
the **run-wide slice** — a sustained, achieved-decel-driven term with pinned
behavioural invariants, strong enough to dominate kinematic tightening beyond a
defined crossover; `chop`'s canonical outcome class becomes run-wide; corrective
feasibility must be solved with the slice active.

**New:** the point-of-no-return quantity (§5.3); the invariant-first
specification style (§5.4) that makes every `TUNING` constant subordinate to a
testable behaviour; the book-proportioned canonical corner `C30` replacing R60;
numeric-tolerance goldens as the model-layer contract.
