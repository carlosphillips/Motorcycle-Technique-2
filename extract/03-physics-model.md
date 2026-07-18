# The Physics Model

This document specifies the physical model at the heart of the *moto-sim/1*
simulator: the scalar laws, the friction model, the equations of motion, the
numerical integration scheme, the two shooting solvers, and the sight-distance
geometry. It is written so that a physicist could reconstruct the model from the
equations and constants below without reading the source. Every constant is given
as `name = value + units`, and every method is given as pseudocode.

The governing design conviction runs through everything: **nothing about the
"correct" line is authored.** A scenario supplies only a road, a rider start
state, and a timed plan of brake / turn-in / throttle / position actions. The
**apex, exit, run-wide (or not), and lean angle all EMERGE from re-integrating
the physics** — there is no apex input anywhere in the core, and any attempt to
anchor a plan action to `apex:<cornerId>` is rejected at validation time. The
feasibility of a line is decided by *shooting* it (re-integrating through the
same pure stepper), never by evaluating a closed-form lean formula.

---

## 1. What is and isn't modelled

The vehicle is a **point mass carving arcs on a 2-D road surface**, integrated in
a screen frame that is **y-down, x-east**, with `+kappa` denoting a right-hand
turn. The state vector carried through integration is:

```
state = { t, x, y, psi, v, phi }
```

| Symbol | Meaning | Units |
|--------|---------|-------|
| `t`   | time | s |
| `x, y` | planar position (screen frame, y-down) | m |
| `psi` | heading | rad |
| `v`   | forward speed | m/s |
| `phi` | lean (roll) angle | rad |

**Modelled:** planar kinematics; lean-driven curvature; a combined
lateral+longitudinal traction limit (the friction ellipse) enforced at every
integration sub-stage; rate-limited roll-in (finite steering speed); a "stand-up"
coupling whereby an abrupt brake/throttle chop stands the bike up out of lean;
per-location surface grip; and a separate line-of-sight/stopping-distance safety
channel.

**Not modelled:** suspension, tyre slip / load transfer, aerodynamic drag, engine
torque curves, gyroscopic effects, longitudinal weight-transfer on grip, and any
vertical (crest/dip) sight geometry. The model is explicitly quasi-static in
lean: curvature is taken as the steady-state `g·tan(phi)/v²` at the current lean,
not the output of a full multibody roll dynamics. Vertical-blind scenarios are
handled by *refusing* to render a verdict rather than faking one (see §8).

The entire physics core is written as classic-script IIFEs attaching frozen
namespaces to a shared global `SIM` object — no ES modules, no bundler, no build
step — so the identical file runs byte-for-byte the same in a browser
(`<script src>`) and in Node (side-effect import via `core/load.mjs`). Every
exported object is deep-frozen; immutability is structural, not stylistic.

---

## 2. Scalar physics laws (`physics.js`)

All scalar laws live in exactly **one** file so that "no module re-derives (or
re-derates) them" — a controller and the integrator can never drift apart with
two copies of the friction ellipse. Every relation below is evaluated against the
single gravity constant `G = 9.81 m/s²`.

### 2.1 Curvature, lean, and speed

The quasi-static relation between the curvature a bike carves, its lean, and its
speed:

```
kappa(v, phi)          = G · tan(phi) / v²          [1/m]
aLat(v, kappaVal)      = v² · kappaVal              [m/s²]   (≡ g·tan φ)
requiredLean(v, kappa) = atan(v² · kappa / G)       [rad]
speedForLean(r, phi)   = sqrt(G · r · tan(phi))     [m/s]
```

`speedForLean` is the classic `v ∝ √r` sustainable-speed relation. These four are
algebraic rearrangements of the same identity `tan φ = v²·κ / g = v² / (g·r)`.

### 2.2 The friction circle / ellipse (the "one-mu policy")

There is exactly **one** physical grip ceiling, the surface's true coefficient
`mu`. All hard limits derive from it and nothing else:

```
aLatMax(mu)  = mu · G          [m/s²]   hard lateral grip ceiling
aLongMax(mu) = mu · G          [m/s²]   hard longitudinal grip ceiling
phiMax(mu)   = atan(mu)        [rad]    hard lean ceiling  →  45.0° at mu = 1.0
```

Lateral and longitudinal grip trade on a **friction ellipse** (a circle when
`aLatMax == aLongMax`, which holds here since both equal `mu·G`). The
dimensionless ellipse magnitude:

```
ellipseMag(aLong, aLat, mu) = sqrt( (aLong/aLongMax)² + (aLat/aLatMax)² )
```

`ellipseMag > 1` (plus a deadband, §6) means the combined demand has exceeded
available grip — this is the crash trigger. The longitudinal acceleration still
available given a lateral demand is the ellipse solved for the long axis:

```
aLongAvail(aLat, mu) = aLongMax · sqrt( max(0, 1 − (aLat/aLatMax)²) )
```

The radicand is provably real and `≥ 0` for every `phi ≤ phiMax = atan(mu)` (the
"one-mu policy proof"); the explicit `max(0, ·)` guards only the last-ULP negative
value exactly at `phi_max`. The grip margin is the signed slack:

```
gripMargin(aLong, aLat, mu) = 1 − ellipseMag(aLong, aLat, mu)
```

Positive = safety margin, negative = crash.

### 2.3 One-mu policy: hard ceilings vs soft reserves

The **rationale for the one-mu policy is that the naming itself is the guard
rail.** The hard ceilings above (`aLatMax`, `aLongMax`, `phiMax`) are computed
*only* from the surface's physical `mu`. Wherever rider-skill derating is wanted,
the caller must construct a *separately named* derated coefficient

```
mu_use = skill · mu
```

and pass it into the distinctly named **reserve** functions:

```
aLatReserve(muUse) = muUse · G      [m/s²]
phiReserve(muUse)  = atan(muUse)    [rad]   →  40.36° at mu_use = 0.85
```

Because the soft-threshold functions have different names and demand an already-
derated argument, no code path can silently substitute an advisory threshold for
a hard physical ceiling (or vice-versa). This is the invariant the whole core is
organized to protect.

### 2.4 Ideal outside-inside-outside line radius

The doctrinal geometric ideal — the maximum-radius single arc that is tangent to
the outer usable edge at entry and exit and kisses the inner usable edge at the
apex — is a pure geometry function of corner radius `Rc`, lane width, an edge
margin, and the corner's swept angle:

```
r_i    = Rc − laneWidth/2 + margin        (inner usable radius)
r_o    = Rc + laneWidth/2 − margin        (outer usable radius)
R_line = (r_o − r_i·cos(sweep/2)) / (1 − cos(sweep/2))
```

For a 90° sweep this reduces to `(r_o·√2 − r_i)/(√2 − 1)`, giving **67.9 m** at
the book's example numbers (`67.87 m` for the R60 half-lane golden used by the
shooting solver, which keys on usable half-width `H` with `r_i = Rc − H`,
`r_o = Rc + H`). This value is a *readout / target*, not the verdict — the actual
apex radius emerges from integrating the shot.

---

## 3. Equations of motion (`integrate.js`)

The state derivatives, in the y-down screen frame (`+kappa` = right-hander):

```
x_dot   = v · cos(psi)
y_dot   = v · sin(psi)
psi_dot = v · kappa = G · tan(phi) / v
v_dot   = a_long                              (friction-ellipse-clipped)
phi_dot = clamp(roll_cmd, −roll_rate, +roll_rate) + phi_dot_standup
```

### 3.1 Roll command (finite steering speed)

Steering is not instantaneous. The roll command is a rate-limited set-point
tracker toward the controller's target lean:

```
roll_cmd = clamp( (target_lean − phi) / dt, −roll_rate, +roll_rate )
```

It reaches the target in one step whenever the target is within `roll_rate · dt`
of the current lean, and by construction never overshoots. The per-rider steering
rate `roll_rate` is what distinguishes a "quick steer" from the slow-turning
Mistake-2 rider (see §9 profiles).

### 3.2 Friction-ellipse clipping inside every sub-stage

At **every** RK4 sub-stage's derivative evaluation, the achieved longitudinal
acceleration is clipped against the local physical grip circle *before* it drives
`v_dot`:

```
a_lat   = G · tan(phi)
a_avail = aLongAvail(|a_lat|, mu)          # mu is the LOCAL physical grip at (s,d)
a_clip  = clamp(a_cmd, −a_avail, +a_avail)
v_dot   = a_clip
```

Clipping at every sub-stage (not just the outer step boundary) guarantees the
achieved trajectory never transiently leaves the grip circle mid-step.

### 3.3 Stand-up coupling

An abrupt commanded-acceleration drop (a hard brake or throttle chop) physically
stands a leaned bike up. This is modelled by an extra roll term that fires *only*
when the commanded-accel rate falls faster than a threshold:

```
excess      = relu( −a_cmd_rate − RATE_THRESHOLD )
standupRate = −K_STANDUP · excess · tanh(phi / PHI0)      # exactly +0 when excess == 0
```

Two deliberate choices:

- It uses the **commanded** accel rate `a_cmd_rate` (a finite difference of the
  controller's *requested* longitudinal accel across the step), **not** the
  ellipse-clipped achieved accel. The term is meant to react to rider *intent*,
  not to a grip-limited outcome.
- The `tanh(phi / PHI0)` envelope keeps the term continuous through zero-lean
  inflection points (chicanes, where `phi` changes sign) and self-limits near
  upright. This continuity is an explicit smoothness requirement, not an ad-hoc
  gain curve.

`standupRate` is exposed as a standalone function so callers and tests can
examine it in isolation.

### 3.4 Low-speed guard

Inside a sub-step, `kappa = G·tan(phi)/v²` blows up as `v → 0`. A local floor
`V_MIN_RHS = 0.01 m/s` protects the right-hand side. This is distinct from the
*outer* termination floor `v_floor_ms = 2.0 m/s` (the Tier-1 low-speed model
floor at which the sim stops).

---

## 4. Numerical integration scheme

### 4.1 Integrator and step size

- **Classical explicit 4th-order Runge-Kutta (RK4)**, fixed step. The four
  stages `k1..k4` are computed through a shared `deriv(st)` closure and combined
  with the standard weighted sum for every state component:

  ```
  next = state + (dt/6)·(k1 + 2·k2 + 2·k3 + k4)
  ```

- **Fixed step size `dt_s = 0.005 s` → 200 Hz**, documented as "200 Hz fixed RK4
  step."

### 4.2 Zero-order-hold control

The controller is evaluated **once per step** and its command (`{target_lean,
roll_rate, a_cmd, mu, a_cmd_rate}`) is **held constant across all four RK4
sub-stages** (a zero-order hold). Rationale: this keeps the commanded quantities —
notably `a_cmd_rate` for the stand-up term — well-defined per discrete step
rather than smeared across sub-stage evaluations, and it avoids extra controller
calls per step. `a_cmd_rate` itself is computed as a finite difference of the
commanded longitudinal accel between the previous and current step.

### 4.3 Two-tier stepping: time RK4, then arc-length resample

Physics integrates naturally in *time*, but doctrine/verdict analysis wants
uniform *spatial* samples. The design resolves this with a two-stage scheme
rather than a native arc-length integrator:

1. Step the physics in time at 200 Hz.
2. **Resample the raw time-series onto a fixed arc-length grid** of spacing
   `ds_m = 0.5 m` for downstream analysis. Resampling lerps every numeric field,
   OR-s the boolean `clipped` flag across each bracket, and recomputes lane-
   fraction `f` via the same corridor algebra used elsewhere so the two never
   disagree.

Keeping the physics integrator standard and simple while giving analysis a
convenient fixed spatial grid is the whole point of the split.

### 4.4 Per-step loop and termination

Inside `run()`, each step:

1. Reads the controller *once* at the current station `(s, d)` (ZOH).
2. Computes `a_cmd_rate` as a finite difference of commanded long-accel.
3. Resolves local physical `mu` via `muAt(s, d)` (falls back to `mu_default`).
4. RK4-integrates one `dt_s` tick with ellipse clipping at each sub-stage.
5. Re-locates the new station via `stationOf()` using a windowed LUT hint (§4.6).
6. Checks termination in this precedence order:
   **crash** (lean past `phiMax + eps`, or `ellipseMag > 1 + eps`) →
   **stopped** (`v < v_floor_ms`) → **corner/road end reached** →
   **max-distance guard**. If the loop exhausts `maxSteps`, it falls through to
   the **max-time guard**.

Runaway guards (hard, doctrine-independent): `max_time_s = 120.0 s`,
`max_dist_m = 5000.0 m`.

### 4.5 Event bracketing

Crash / stop / end-of-road crossings are located by **linear interpolation**
between the last accepted state and the first violating state — not by adaptive
step-size root-finding. For a crash on lean angle, with `before`/`after` the
signed distance-past-ceiling on lean:

```
f = clamp( (0 − before) / (after − before), 0, 1 )
```

and `x, y, phi` are lerped at fraction `f` to report the exact crossing point
rather than the coarse post-step state.

Before gridding, the raw series is forced non-decreasing in `s` via a running
cummax (`if s[i] < s[i−1]: s[i] = s[i−1]`) so the arc-length grid walk is
well-posed even if a station lookup produced a tiny local regression.

### 4.6 Windowed LUT lookup (provably exact optimization)

`nearestLutIndex()` finds the nearest centreline LUT point to a query. It
defaults to a full O(n) scan, but given a `hint` (the previous index) and the
road's precomputed `road.window_safe_dist`, it scans only a `±W` index window
whenever `2·dist(query, lut[hint]) < window_safe_dist` — and this is **provably
byte-identical to the full scan** (any point outside the window is necessarily
farther than `safeDist` from the hint point, so it cannot beat the window's local
minimum). Otherwise it falls back to a full scan, so results are *always*
identical to a naive scan. The window radius `W = 24` must equal `road.js`'s
`WINDOW_RADIUS = 24` — a cross-file invariant not enforced by the type system.
This is the source of the ~8.2× solve speedup with zero mismatches: a proven
optimization, not a heuristic.

---

## 5. The shooting method (`shoot.js`)

The **central design fact**: the "correct" line is never authored and never
computed in closed form. Two solvers decide feasibility by *shooting* — repeatedly
re-integrating through the same pure stepper and reading back where the trajectory
actually landed. Static geometric values (`R_req`, `phi_req`) are computed but are
explicitly "a READOUT only; the shot is the verdict." This is why apex, exit,
run-wide, and lean are *emergent*.

### 5.1 `solveTangentInside` — committing a deferred turn-in

**Unknown solved for:** for each deferred `tangent_inside` turn-in action, the
committed **lean magnitude** (degrees) such that the re-integrated path *just
kisses* the inner usable lane edge at the apex — the max-radius outside-inside-
outside arc — rather than spiraling inward off-road.

**Constants:**

| Name | Value | Meaning |
|------|-------|---------|
| `TARGET_F` | `0.06` | target apex lane-fraction (a hair inside `f = 0`) |
| `PROBE_DEG` | `12` (deg) | gentle seed probe lean for the `v_apex` fixed point |

**Doctrinal lean band.** The apex radius is constrained to `[Rc, R_line]`, which
maps to a committed-lean band `[lean_geo, lean_forRc]`:

```
lean_geo   = requiredLean(v_apex, 1/R_line)   # apex radius == R_line (loosest ideal arc)
lean_forRc = requiredLean(v_apex, 1/Rc)       # apex radius == Rc     (tightest allowed)
```

The upper bound (`lean_forRc`) guarantees emergent apex radius `≥ Rc` (prevents a
too-tight lean spiraling off-road inside); the lower bound excludes the too-loose
early-apex "run wide" root. This band is documented as **"the fix for the spiral
bug"**: bisecting over the whole feasible-lean range would converge on the
tightest root, which is a spiral off the road.

**`v_apex` fixed point.** Seeds a gentle probe shot at
`clampDeg(PROBE_DEG, 2, phiMaxDeg − 1)` to read `v_apex` *without* over-leaning
the first shot into a collapse (probing at entry speed triggers "the hard-brake
trap"), then refines with 2 passes of `leanForR(v, R_line)` — 2 passes suffice
because `v_apex` depends only weakly on the exact lean.

**Root find (bisection).** `bisectTangent(fApexOf, lo, hi)` bisects the
monotone-decreasing `f_apex(magDeg)` for `f_apex == TARGET_F`:

```
for up to 30 iterations, while (hi − lo) > 0.03 deg:
    mid = (lo + hi)/2
    if fApexOf(mid) > TARGET_F: lo = mid    # too loose (apex too wide)
    else:                       hi = mid    # tight enough
# boundary clamps:
#   flo <= TARGET_F  → return lo   (loosest arc already reaches inside)
#   fhi >= TARGET_F  → return hi   (tightest allowed still can't reach; cap at Rc, never spiral)
```

Each `fApexOf(magDeg)` is a **full re-integration** (`SIM.integrate.run`) plus a
`measureApex` readback — literally shooting the trajectory. A collapsed/failed
shot reads as `OVER = −1e3` (treated as "too much lean, back off"). Multiple
deferred turn-ins are solved in station order, each shot holding earlier-resolved
leans fixed.

### 5.2 `solveCorrection` — can a run-wide corner be saved?

**Unknown solved for:** for a corner that ran wide, the **minimum committed target
lean** (rate-limited roll-in from the recognition station) whose re-integrated
path returns inside the outer usable lane edge by corner-end without exceeding
`phi_max`. Feasible → outcome `"wide"` (an "add-lean" save exists); infeasible →
`"runoff"`.

**Recognition point:** `s_react` from `detectRunWide` (or `s_detect`, or corner
end).

**Static readouts (never the verdict):**

```
R_req       = L² / (2·hPerp)                          # tangent-arc fit to reclaim outer edge
                                                      # L² = fwd² + hPerp²; guarded: fwd > 2.0 m,
                                                      #      hPerp > 1e-6, else R_req = Infinity
phi_req_deg = atan(v_react² / (G · R_req))            # readout; → phiMaxDeg if R_req not finite
v_ok_kmh    = speedForLean(R_req, phi_ok)             # entry speed keeping the reserve intact
                                                      # phi_ok = config.phi_ok_deg (default 36°)
```

The `fwd > 2.0 m` guard prevents a deep/late-detected runoff from producing a
nonsensical sub-metre-radius pivot readout from `L²/(2h)`.

**The integrated shot** (`shotContained(magDeg)`): re-integrate from the
recognition state with a constant-target-lean controller
`{target_lean: sign·deg2rad(magDeg), roll_rate: rollRate, a_cmd: 0}`; fail if
crashed; else pass if lane-fraction at corner-end is `≤ 1.0 + 0.03` (returned
inside the outer edge, 3% tolerance).

**Root find (bisection):**

```
loMag = max(curLeanMag, 1),  hiMag = phiMaxDeg − 0.5
for up to 26 iterations, while (hi − lo) > 0.1 deg:
    bisect on shotContained(mid)
# runoff immediately if hiMag doesn't return inside, or s_react >= corner.s1
consumes_reserve = magStar > phiReserveDeg           # phiReserveDeg = rad2deg(phiReserve(skill·mu))
rollRate         = deg2rad(config.roll_rate_dps ?? 50)
```

**Crash detection strictly precedes corrective solving** — `solveCorrection` runs
only "when this corner ran wide AND the run did not crash," so no nonsensical
"save" is computed for a trajectory that already lowsided.

---

## 6. Crash boundaries and deadbands (`config.js`)

Crash conditions carry small tolerance bands so that floating-point boundary
flicker exactly at `phi_max` or `ellipseMag == 1` cannot flip a verdict between
platforms/runtimes ("cross-runtime stability"):

| Name | Value | Role |
|------|-------|------|
| `eps_phi_deg` | `0.05` deg | crash only when `phi > phiMax + eps_phi` |
| `eps_mag` | `1e-3` | crash only when `ellipseMag > 1 + eps_mag` |
| `eps_deg_report` | `0.1` deg | continuous-field comparison epsilon |
| `eps_m` | `0.05` m | metres tolerance for tolerance-equal verdicts |

The deadband is baked into the crash condition itself rather than left to raw
floating-point comparison.

---

## 7. Constants and config (`units.js`, `config.js`)

### 7.1 Units and conversions (`units.js`)

```
G       = 9.81                      # m/s², standard gravity (SI)
DEG2RAD = π / 180
RAD2DEG = 180 / π
kmh2ms(kmh) = kmh · 1000 / 3600
mph2kmh(mph) = mph · 1.609344       # imperial→metric, CROSS-CHECK ONLY, never used in the engine
ft2m(ft)     = ft · 0.3048
```

The engine is metric throughout (km/h, m, m/s, degrees); imperial conversions
exist only for cross-checking against the (US-units) source book.

### 7.2 Core config block (`SIM.config`, deep-frozen)

| Name | Value | Units | Note |
|------|-------|-------|------|
| `mu_default` | `1.0` | — | dry asphalt physical coefficient |
| `lane_width_m` | `3.5` | m | book/course default |
| `bike_margin_m` | `0.40` | m | TUNING: contact-patch clearance to each edge |
| `blind_reserve_deg` | `35.0` | deg | TUNING: lean reserve for blind corners |
| `phi_ok_deg` | `36.0` | deg | TUNING: comfortable margin below reserve, for `v_ok` |
| `dt_s` | `0.005` | s | 200 Hz fixed RK4 step |
| `ds_m` | `0.5` | m | analysis/station grid |
| `v_floor_ms` | `2.0` | m/s | Tier-1 low-speed model floor |
| `max_time_s` | `120.0` | s | runaway guard |
| `max_dist_m` | `5000.0` | m | runaway guard |

Stand-up sub-block:

| Name | Value | Units | Note |
|------|-------|-------|------|
| `k_standup` | `6.0` | rad/s per (m/s³) | TUNING: gain on abrupt chop above threshold |
| `rate_threshold` | `8.0` | m/s³ | TUNING: `|d(a_cmd)/dt|` below this never stands the bike up |
| `phi0_deg` | `5.0` | deg | TUNING: `tanh(phi/phi0)` width |

Doctrine/smoothing constants:

| Name | Value | Note |
|------|-------|------|
| `single_input_delta_phi_deg` | `1.5` deg | TUNING: smoothing tol — speed-driven kappa ripple ≠ a hump |
| `quick_steer_max_s` | `1.0` s | TUNING: 0→100% steering slower than this WARNs |
| `apex_late_pct` | `50` % | doctrine (not tuning): constant-radius corner |
| `apex_late_pct_decreasing` | `60` % | STANDARD §3: decreasing-radius bar moves later |
| `default_ssd` | `"alert"` | default sight-vs-stopping model |

**Config value quarantine.** Every constant with no source in the book is
explicitly commented `// TUNING` and "must never be attributed to Parks/Code in
any output"; book-derived values cite a DESIGN §-section instead. This provenance
discipline is structurally enforced by keeping ALL config in exactly one frozen
file, so an auditor has a single place to check.

### 7.3 Rider profiles (`PROFILES`)

`roll_rate_dps` is lean rate in deg/s; `skill` is the `mu_use = skill·mu`
*reserve-only* derating factor; `t_react_s` is the recognition delay.

| Profile | `roll_rate_dps` | `skill` | `t_react_s` | Note |
|---------|-----------------|---------|-------------|------|
| `casual` | 20 | 0.85 | 1.0 | slow steering (Mistake 2) |
| `street` | 50 | 0.85 | 1.0 | trained "quick turn" baseline |
| `trained` | 50 | 0.85 | 1.0 | alias of `street` |
| `racer` | 85 | 0.95 | 0.7 | track pace |

---

## 8. Visibility / sight-distance geometry (`visibility.js`)

Sight safety is a **separate physical channel** from grip. The hard doctrine
(M3): **geometric sight distance around a bend is speed-independent** —
`sightDistance` takes no `v` parameter, it is pure ray-cast road geometry, and
this is backed by an explicit invariance test. Only the *stopping* distance is
speed-dependent. Keeping line-of-sight geometry and braking physics separate
prevents conflating the two phenomena.

### 8.1 Constants

| Name | Value | Role |
|------|-------|------|
| `MAX_LOOK_M` | `300` m | cap on forward ray length (a long straight won't scan forever) |
| `TREND_TOL_M` | `0.2` m | below this, `|d(sight)/ds|` reads as "steady" |

### 8.2 Sight-distance ray cast

From an eye at station `s` on the centreline, cast a ray to the inside-edge point
at each forward station (`insideEdgePoint`, offset `−signC·lane_width_m/2` where
`signC` is the bend's curvature sign within `MAX_LOOK_M`, 0 if all straight), and
test whether that ray crosses any modelled vision-blocking obstacle polygon
(proper-crossing test excluding shared endpoints, `EPS = 1e-9`). Returns:

```
{ sight_m, limit_point:{x,y}, s_limit, trend }   # trend ∈ approaching | steady | receding
```

**Design point:** the road's own inside edge is **not** an opaque wall. An open
corner you can see across is *not* sight-limited by construction. Sight is cut
only by a modelled obstacle polygon; reaching the un-obstructed model boundary
reports the **full `MAX_LOOK_M`**, not "distance to road end" — otherwise "every
exit trivially fails sight near the road's end," a model-boundary artifact rather
than real geometry.

### 8.3 Stopping sight distance (the speed-dependent half)

```
ssd_m   = react_m + brake_m
react_m = v · t_react_s
brake_m = v² / (2 · a_ssd)
```

The deceleration `a_ssd` used here is deliberately **distinct from and less than
the physical braking ceiling** `a_brake_max = mu·g ≈ 9.81 m/s²` — it is a
realistic sub-mu emergency figure, not the traction limit. Models
(`SSD_MODELS`, chosen via `config.ssd_models[...]`, ultimate hardcoded fallback
`{a_ssd: 7.0, t_react_s: 1.0}`):

| Model | `a_ssd` (m/s²) | `t_react_s` (s) | Note |
|-------|----------------|-----------------|------|
| `alert` | 7.0 | 1.0 | realistic sub-mu emergency figure (default) |
| `aashto` | 3.4 | 2.5 | FHWA conservative |

### 8.4 The safe-entry cap and vertical-blind refusal

`sightVsStopping(road, samples, obstacles, config, model)` finds the worst-margin
station: `margin_m = sight_m − ssd_m`, `ok = margin_m >= 0`. Because `ssd`
increases with `v²` while `sight_m` is fixed by geometry, limited sight
effectively **caps a safe entry speed**: the fastest `v` for which
`v·t_react + v²/(2·a_ssd) ≤ sight_m`.

**Vertical-blind scenarios (crests/dips) refuse a verdict entirely**, returning
`{na: true, reason: "vertical sight geometry not modelled in v1"}` rather than
drawing an in-plane 2-D ray. The stated reasoning: a wrong-but-plausible-looking
ray "a student could mistake for the real over-the-top limit point" is judged
worse than an honest "not modelled." `isVerticalBlind` is true if
`config.vertical_blind`, or `road.vertical`/`road.crest`, or any obstacle `kind`
is `"crest"`/`"dip"` or `blocks` includes `"vertical"`.

---

## 9. Road geometry model (`road.js`)

### 9.1 Sign convention

Screen **y-down, x-east**; `dpsi/ds = kappa`. Right-hand arcs → `kappa = +1/R`
(psi increases); left-hand arcs → `kappa = −1/R`. `+d` is the rider's **left**;
the left normal is `n_left = (sin psi, −cos psi)`. A right-hander's inside edge is
at `−d`, its outside (oncoming) edge at `+d`.

### 9.2 Arc, straight, and taper geometry (closed-form EOM integrals)

For a signed curvature `k` from pose `(x0, y0, psi0)`, the arc geometry is the
closed-form integral of the EOM (matching a reference LUT to `< 5e-5 m` over 509
grid points):

```
psi(s) = psi0 + k·(s − s0)
x(s)   = x0 + (sin psi − sin psi0) / k
y(s)   = y0 − (cos psi − cos psi0) / k        # MINUS on y (y-down frame)
```

Straights: `x += cos(psi0)·u ; y += sin(psi0)·u`.

**Taper (clothoid / linear-curvature) segments:** curvature is linear in arc
length, so heading is quadratic:

```
kappa(u) = k1 + (k2 − k1)/len · u
psi(u)   = psi0 + k1·u + (k2 − k1)/(2·len)·u²
len      = 2·Δθ / (1/r1 + 1/r2)               # closed-form taper length
```

Because the resulting sin/cos integrals are Fresnel-shaped (no elementary closed
form), `compose()` pre-integrates a dense node table at fixed step
`TAPER_NODE_M = 0.25 m` via per-interval Simpson's rule, and `taperPose` does one
exact Simpson step from the nearest lower node. The taper's exposed `r` is
`min(r1, r2)` (tightest point, conservative for doctrine/reserve checks).

**Segment-boundary rule:** a boundary belongs to the *earlier* segment (a
straight-then-arc boundary reads `kappa = 0`, not the following arc's).

### 9.3 Coordinate conversions

```
sdToXY(road, s, d):   x = c.x + d·sin(c.psi),   y = c.y − d·cos(c.psi)
```

`xyToStation(road, x, y)` is the exact inverse: it minimizes the along-tangent
residual `h(s) = (p − pose)·(cos psi, sin psi)` by **golden-section search** —
robust through flat apex regions where Newton stalls — round-trip tight to
`≤ 1e-6`. The minimizer uses ratio `gr = (√5 − 1)/2 ≈ 0.6180339887`, up to **80
iterations**, convergence `b − a > 1e-12`.

### 9.4 Windowed-LUT self-approach safety

`windowSafeDist` (with `WINDOW_RADIUS = 24`, `SAFE_CAP = 12.0 m`) computes, in
O(n) via a spatial grid, the closest the road's LUT ever comes to *itself* across
a `> WINDOW_RADIUS` index gap (a fold/switchback/near-parallel limb). This lower
bound (`road.window_safe_dist`) is what lets the integrator's O(1) windowed
station lookup (§4.6) *prove* it equals a full scan.

### 9.5 Usable corridor and lane fraction

```
usableHalf(road)                   = (use_full_width ? lane_width_m : lane_width_m/2) − bike_margin_m
laneFraction(road, cornerId, d)    = (d − inner_d) / (outer_d − inner_d)
```

`f = 0` is the inner usable edge, `f = 1` the outer usable edge, `f > 1` past the
outer edge into oncoming. The fraction is hand-independent, so left- and
right-handers compare directly. `edges(road)` returns the `centerline`,
`roadOuter/Inner` (offset `±lane_width_m/2`) and `laneOuter/Inner` (offset
`±usableHalf`) polylines via `geom.offsetPolyline`.

---

## 10. Geometry primitives (`geom.js`)

The 2-D vector toolkit is **total** — no operation throws, no `Result` wrapping —
because pure vector math cannot fail (a deliberate scope decision, contrasting
with the Result-based rest of the core). Frame: screen **y-down, x-east**;
`perpLeft(T) = (T.y, −T.x)` is the rider's left for heading `T` (verified for
`T = (1,0)` east → `(0,−1)` = "up" = left). Thresholds: `EPS = 1e-12` (zero-vector
guard in `norm`, which maps the zero vector to `{0,0}`, never NaN), `1e-9` on
ray-intersection bracket checks.

| Function | Returns |
|----------|---------|
| `v2, add, sub, scale, dot, cross, len` | basic vector ops (`cross` = scalar z-component) |
| `norm(a)` | unit vector; zero → `{0,0}` |
| `perpLeft(a)` | y-down left normal |
| `rot(v, ang)` | CCW rotation by `ang` rad in standard math axes |
| `lerp(a, b, t)` | point lerp |
| `polylineLength(poly)` | sum of segment lengths |
| `signedArea(poly)` | shoelace; `+ve = CCW` |
| `offsetPolyline(points, dist)` | offset along local left normal (central-difference tangent interior, one-sided at endpoints) |
| `pointToPolyline(p, poly)` | `{dist, segIndex, foot, t}` nearest point (unsigned) |
| `rayPolyline(origin, dir, poly, maxLen)` | `{hit, point, dist}` first intersection (parallel segments skipped via `|cross(d,e)| < EPS`) |

---

## 11. Why physics decides — summary of the emergent-line principle

The recurring architectural decision, stated across every layer, is that
**feasibility is decided by re-integrating the physics, never by a closed-form
formula.** Concretely:

- There is **no apex input anywhere.** A plan anchor `apex:<cornerId>` is
  *rejected* at scenario validation — the apex is unknown until the engine runs,
  so it can only be resolved in a higher author layer that shoots the engine first.
- Both shooting solvers (`solveTangentInside`, `solveCorrection`) compute static
  geometric readouts (`R_line`, `R_req`, `phi_req`, `v_ok`) but use them only as
  bounds/labels — the *shot* (a full `SIM.integrate.run`) is the verdict, because
  "geometry math can look right while the physical path (with roll-rate limits,
  grip, drag) diverges from it."
- The doctrinal lean band `[lean_geo, lean_forRc]` constrains the root search to
  the physically sane range instead of letting bisection converge on a
  spiral-off-road root — the explicit "fix for the spiral bug."
- Apex, exit, run-wide/no-run-wide, and lean angle all **emerge** from the
  integrated trajectory and are read back by the analysis layer, never authored.

This is what makes the simulator a *check* on riding doctrine rather than a
restatement of it: the book's line method is a hypothesis, and the physics is the
adversary that either confirms or refutes each line by riding it.
