# Result Contract & Per-Instant Inspection

How a linelab run records what happened, and how any consumer — the stepper HUD,
the POV view, the CLI, an AI agent — asks "what was the full state of the bike at
this exact point?" and gets a complete, typed answer.

This document owns the **Sample contract** (the canonical per-sample record), the
**time-base and interpolation contract**, the **`stateAt` query**, the **events
array**, the **verdict shape**, the **multi-line result envelope**, and the
**sharing/export formats**. It does not own the physics that produces these values
(`02-physics-model.md`), the road/sight/scenario inputs
(`03-roads-scenarios-and-visibility.md`), the drawing of them
(`06-rendering-and-projection.md`, `07-viewer-animation-and-pov.md`), or the
regression gates over them (`09-verification-and-testing.md`).

---

## 1. What this document covers — and the rule it enforces

The prior design's deepest inspection defect was not missing data but missing
*recording*: the controller computed `{target_lean, roll_rate, a_cmd, active}` on
every integration step and then threw them away — only the delivered kinematics
survived into the Sample. "The controls of the bike at any point" was therefore
derivable (by re-running the engine) but not inspectable (by reading the result).
Similarly, sight distance was precomputed per sample but the limit point's world
coordinates were not carried, and the in-memory channel columns were never pinned.

The rule this document enforces, stated once:

> **If the engine knew it during the run, the result records it — commanded and
> delivered, kinematic and doctrinal — in one pinned, frozen, per-sample record.**

Everything downstream (HUD, POV, CSV, `stateAt`, agents) reads the record; nothing
downstream ever re-derives state the engine already had.

---

## 2. The Sample contract

A run produces a deep-frozen `Trajectory`:

```
Trajectory = { samples: [Sample], events: [Event], terminated: {reason, s, t} }
```

`samples` is one flat array of full-precision records — the prior design's split
between raw `samples` and rounded, separately-emitted `channels` (with its
`channels[i].s === samples[i].s` alignment contract) is **collapsed**: there is
one array, it is the channel set, and there is nothing to keep aligned. Rounding
happens only at export boundaries (§8), never in the record.

### 2.1 Field table (pinned; append-only by design change)

**Kinematics & dynamics** — written by `core/` (the integrator):

| Field | Type | Units | Meaning |
|---|---|---|---|
| `s` | number | m | Arc-length station along the road centreline |
| `t` | number | s | Sim time since run start; strictly monotone |
| `x`, `y` | number | m | World position of the bike (point-mass) |
| `psi` | number | deg | Heading (world frame) |
| `v` | number | m/s | Speed |
| `phi` | number | deg | Lean angle, signed by turn direction |
| `kappa` | number | 1/m | Path curvature actually ridden (`= g·tan(phi)/v²`) |
| `a_long` | number | m/s² | **Delivered** longitudinal acceleration (post-clip) |
| `a_lat` | number | m/s² | Lateral acceleration (`= v²·kappa`) |
| `grip` | number | 0..1 | Friction-ellipse margin, `1 − ellipseMag` |
| `mu` | number | — | Local friction coefficient at `(s, d)` |
| `d` | number | m | Signed lateral offset from centreline |
| `f` | number | — | Lane fraction: 0 = inside usable edge, 1 = outside, >1 = oncoming |

**Commanded controls** — written by `plan/` (the Controller), recorded every
sample. This is the block the prior design computed and dropped:

| Field | Type | Units | Meaning |
|---|---|---|---|
| `cmd_lean` | number | deg | The controller's lean setpoint at this instant |
| `cmd_a` | number | m/s² | **Commanded** longitudinal accel (brake < 0, drive > 0) |
| `roll_rate` | number | deg/s | The roll-rate cap in force (rider profile) |
| `action_id` | string \| null | — | `id` of the plan action currently driving control |
| `clipped` | boolean | — | True when the friction ellipse limited `cmd_a` → `a_long` |
| `n_long` | number | −1..1 | Normalised ellipse component `a_long / aLongMax(mu)` |
| `n_lat` | number | −1..1 | Normalised ellipse component `a_lat / aLatMax(mu)` |

The commanded/delivered pair is what makes the HUD honest: "brake `b1` active,
commanded −3.0 m/s², grip-limited to −2.1" is read directly as
`(action_id, cmd_a, a_long)` with `clipped = true`. The clip magnitude is the
derived difference `cmd_a − a_long`; it is not stored separately. `n_long`/`n_lat`
exist so a live friction-circle widget plots one point per sample with no
recomputation.

**Sight** — written by `sight/`, cast from the **rider's actual position** per D4
(never the centreline):

| Field | Type | Units | Meaning |
|---|---|---|---|
| `sight_m` | number | m | Geometric sight distance from eye at `(x, y)`; speed-independent |
| `ssd_m` | number | m | Stopping sight distance at current `v` (model per `03` §sight) |
| `limit_x`, `limit_y` | number | m | World coordinates of the limit point |

The sight margin (`sight_m − ssd_m`) and the limit-point *trend*
(opening/closing, the sign of `d(sight_m)/ds`) are derived values, computed by
`stateAt` (§4), not stored.

### 2.2 Contract rules

- **Frozen.** The whole `Trajectory` is deep-frozen before it leaves the core
  (children before parents, so no mutability window exists) — carried unchanged.
- **Full precision.** Samples are raw f64. No field is rounded in the record.
- **Pinned and append-only.** This field list is the contract. New fields may be
  *appended* by a design change to this document; no field is renamed, reordered,
  or repurposed. An agent that learned the contract once stays correct.
- **Every line gets the same record.** A mistake line's samples carry every field
  above, identically to the ideal line's (D6). There is no reduced "overlay"
  record anywhere in the system.

---

## 3. The time-base

### 3.1 Dual parameterisation, one grid

The integrator steps at a fixed `dt` (owned by `02-physics-model.md`). Samples are
**retained** on the arc-length doctrine grid: one sample each `ds_m = 0.5 m`
(carried; TUNING), plus a final exact sample at termination. Each retained sample
records its exact `t`, and both `s` and `t` are strictly monotone over the array —
so the trajectory is a bijection between station-space and time-space, and either
may parameterise playback or queries.

An optional time-uniform series (`record_dt_s`, default unset — TUNING) may
additionally be retained for export convenience, but **no consumer may require
it**: the interpolation contract below must fully define constant-time stepping
from the arc-grid alone.

### 3.2 The interpolation contract

For a query falling between retained samples `i` and `i+1`, the blend factor is

```
alpha = (q − q_i) / (q_{i+1} − q_i)        where q is s or t, per the query
```

and each field interpolates by its declared rule:

| Rule | Fields | Definition |
|---|---|---|
| `linear` | `s, t, x, y, v, kappa, a_long, a_lat, grip, d, f, cmd_a, n_long, n_lat, sight_m, ssd_m, limit_x, limit_y` | Standard lerp |
| `angle` | `psi, phi, cmd_lean` | Shortest-arc lerp in degrees (wrap-aware, so a 359°→1° step blends through 0°, never through 180°) |
| `hold` | `action_id, clipped, mu, roll_rate` | Value of sample `i` (these are step functions; blending them would fabricate states that never existed) |

Positional lerp error is bounded by curvature: at `ds_m = 0.5 m` and the tightest
in-scope corner (`kappa ≈ 1/15 m⁻¹`) the chord deviation is `≤ κ·(ds/2)²/8 ≈ 0.5 mm`
— far below drawing resolution. No consumer needs spline reconstruction.

Variable-speed playback is defined entirely on this contract: a playback clock `τ`
at rate `r` queries `stateAt(result, {t: t₀ + r·τ})`. Nothing about playback is
renderer-specific; `07-viewer-animation-and-pov.md` builds on this section without
extending it.

---

## 4. `stateAt(result, {s | t})` — the per-instant query

The single query API for "everything about the bike at this point." Pure,
Result-based, no IO:

```
stateAt(lineResult, {s: number} | {t: number}) -> Result<InstantState>
```

**Semantics.** Exactly one of `s` or `t` must be supplied (both or neither →
`err(SCHEMA)`). The query is resolved against the monotone sample array by binary
search, then interpolated per §3.2. Queries outside `[first, terminated]` return
`err(BAD_RANGE)` with `at` set to the valid interval — the function never clamps
silently; clamping is a caller (viewer) policy. A query beyond a line's early
termination (crash, run-off) is `BAD_RANGE`: state after the end of a trajectory
does not exist, and pretending otherwise would violate the honesty stance.

**Returned shape** (frozen):

```
InstantState = {
  sample,                       // one full interpolated Sample (§2.1, every field)
  derived: {
    v_kmh,                      // display speed
    sight_margin_m,             // sight_m − ssd_m
    sight_trend,                // "opening" | "closing" | "steady" — 03 §5.1's definition (deadbanded), verbatim
    phi_max_deg,                // atan(mu), the lean ceiling here
    limit_point: {x, y},        // convenience copy of limit_x/limit_y
    action,                     // the full resolved PlanAction for action_id, or null
    corner_id,                  // corner containing s, or null
    phase                       // "approach"|"entry"|"steering"|"mid"|"exit"|"done" (from events)
  },
  at: {i0, i1, alpha}           // bracketing sample indices — viewers highlight the span
}
```

`stateAt` is exposed identically in the library and as a CLI verb
(`08-cli-and-agent-interface.md`), so an agent inspects any instant of any line —
including failed lines — without parsing CSVs or re-running the engine.

---

## 5. Events as bookmarks

`Trajectory.events` is an ordered array of typed markers:

```
Event = { kind, s, t, line_note?, corner_id?, action_id?, detail? }
```

**Kinds (closed set):** `brake_start`, `brake_end`, `turn_in`,
`steering_complete`, `crack`, `roll_on`, `apex`, `exit`, `position_start`,
`position_complete`, `sight_min`, `run_wide_detect`, `violation`, `correction`,
`crash`, `stop`, `road_end`.

Rules:

- **Exact crossings.** Event `s`/`t` are computed by linear interpolation between
  the bracketing integrator steps (the event-bracketing machinery is owned by
  `02-physics-model.md` §integrator) — an event's coordinates are exact to the
  bracketing tolerance, not snapped to the 0.5 m grid.
- **Emergent events stay emergent.** `apex` and `exit` are *measured* post-hoc by
  the analyzers and injected into the same array. They are outputs living beside
  the input-driven events — D7 is untouched: no event is ever an input.
- **Bookmarks for free.** The stepper's named jump targets — "step to turn-in",
  "step to apex", "step to crash instant" — are exactly `events` filtered by
  `kind`, resolved through `stateAt`. `sight_min` (station of worst sight margin)
  gives blind-corner scenarios a canonical "worst moment" bookmark.
- Events are strictly ordered by `t` (ties broken by declaration order), and every
  event of a line lies within that line's sample range, so every bookmark is
  `stateAt`-resolvable by construction.

---

## 6. The verdict

The verdict is the doctrinal judgment of one line. Its shape is carried from the
prior design with the additions the new scope demands.

### 6.1 Outcome and diagnosis (closed sets)

```
outcome   : "clean" | "wide" | "runoff" | "violation" | "crash" | "dnf-spec-error"
precedence: crash > runoff > wide > violation > clean        (one deterministic headline)

diagnosis.cause : "overspeed_entry" | "grip_exceeded" | "roll_rate_limited"
                | "sight_deficit" | "late_brake" | "plan_gap" | "stand_up"
```

`stand_up` is **new**: the run-wide slice (D3, `02-physics-model.md` §run-wide)
makes braking-at-lean and throttle-chop widen the line; when that mechanism is the
proximate cause of `wide`/`runoff`, the diagnosis says so. Under Tier 1R the
`chop` mistake kind's canonical outcome class changes from `violation` (the prior
inward pinch) to `wide`/`runoff` — the mistake presets' expectations are re-pinned
accordingly (`09-verification-and-testing.md` owns the re-bless discipline).

### 6.2 Doctrine checks

The check *content* is doctrine and lives in `01-scope-and-doctrine.md`; this
document pins the record shape and the id list. The carried 12-check concept is
extended with two visibility checks (D4):

```
CheckResult = { id, corner_id | null, verdict: "pass"|"fail"|"warn"|"na", evidence }

check ids (v2): the carried line-selection checks
              + "stop_within_sight"     — at every station, v permits stopping
                                          within sight_m (fail cites worst station)
              + "hold_wide_for_sight"   — on a blind corner, the line holds outside
                                          position while sight is closing, releasing
                                          inward only as the limit point opens
checks_version: 2
```

Checks whose arithmetic the run-wide slice touches (trail-brake taper, the
single-steering-input smoothness bar, and anything keyed to the chop outcome
class) are re-derived under Tier 1R physics and re-pinned; the check *ids* are
stable.

### 6.3 Verdict shape

```
Verdict = { ok, spec_hash, result_hash, checks_version, engine: "linelab/1",
  outcome, headline,
  diagnosis: null | {cause, at_s, corner_id, detail},
  corners: [ per-corner measurements: turn_in_s, apex_s, apex_pct, apex_f,
             clearance_m, v_apex_kmh, lean_max_deg, grip_min, exit {s, d, f,
             heading_err_deg}, ran_wide, corrective | null, crash? ],
  sight: { margin_min_m, at_s, v_at_s_kmh } | null,
  doctrine: { pass, fail, warn, na, checks: [CheckResult] },
}
```

Rounding at this boundary follows the carried centralized emission policy (§8.3).
The `diagnosis` block reasons on raw full-precision measurements and is excluded
from `result_hash`, exactly as before — richer diagnostics must never perturb
regression hashes.

---

## 7. The multi-line result envelope (D6)

The prior design had no result type for a *figure* — mistake overlays were
renderer-internal and unshareable. linelab's top-level result is the envelope:

```
FigureResult = {
  spec: "linelab/1",
  figure_id,
  road,                              // ONE composed RoadModel — all lines share it
  lines: [ LineResult ],             // 1..N, order = draw order
  meta: { title?, caption?, view? }  // presentation hints only, never physics
}

LineResult = {
  line_id,                           // stable string
  role: "ideal" | "alternative" | "mistake" | "reference",
  label,                             // legend text
  source:                            // how this line came to be — the shareable part
      { kind: "scenario", scenario }                       // explicit plan
    | { kind: "solve",    solveSpec }                      // solver-authored (04)
    | { kind: "mistake",  base_line_id, mistakeSpec },     // one-perturbation compile (03)
  trajectory,                        // full Sample/Event contract, §2–§5
  verdict                            // full Verdict, §6
}
```

Rules:

- **Identical citizenship.** Every line — role `mistake` included — carries the
  full trajectory and full verdict. `stateAt`, the stepper, the POV, and the CSV
  export accept any `line_id`. There is no lesser record for failed lines.
- **One road per figure.** Lines that need different roads are different figures.
- **Roles are labels.** Colour derives from each line's own verdict (D9, mapping
  owned by `06-rendering-and-projection.md`); the envelope stores no colour.
- **Provenance is causal.** A `mistake` line's `source` names its base line and
  the one perturbation applied; a `solve` line's `source` records the solver
  inputs. Given `road` + `source`, the engine reproduces the trajectory exactly —
  which is what makes the envelope shareable (§8).

---

## 8. Sharing, export, and identity

### 8.1 What is shared: specs, never trajectories

The shareable object is the **FigureSpec** — the envelope minus every computed
member:

```
FigureSpec = { spec: "linelab/1", figure_id, road_spec, lines: [{line_id, role,
               label, source}], meta }
```

Every consumer **recomputes** trajectories and verdicts from the spec with the
same engine (D6). The prior "one trajectory per URL, good line only" constraint is
gone because trajectories never ride the wire at all — the honesty property
("never ship a trajectory the engine didn't produce") is preserved by
construction, now covering N lines instead of restricting to one.

**URL form (carried mechanism, new payload):**
`#f=<base64url(deflateRaw(canonicalize(FigureSpec)))>` — deflate-raw compressed,
base64url-encoded (`+`→`-`, `/`→`_`, padding stripped). A single-line scenario may
still ride `#s=<…scenario…>` for the trivial case.

### 8.2 Export formats

| Format | Contents |
|---|---|
| **Result JSON** | The full `FigureResult`, canonical key order, frozen shape of §7. The complete machine-readable record. |
| **Trace CSV** (per line) | One row per sample. **Pinned column order:** `s, t, x, y, psi, v, phi, kappa, a_long, a_lat, grip, mu, d, f, cmd_lean, cmd_a, roll_rate, action_id, clipped, n_long, n_lat, sight_m, ssd_m, limit_x, limit_y` — the Sample contract in declaration order, append-only like it. |
| **Static SVG** | Rendered figures via `06-rendering-and-projection.md`; the export manifest records the view spec, mode, and proportion-gate metrics. |

### 8.3 Identity and determinism

Carried intact: `canonicalize` = JSON of recursively key-sorted objects (arrays
keep order); `spec_hash` = fnv-1a over the canonical spec, first 6 hex;
`result_hash` = fnv-1a over the canonical verdict with `result_hash` and
`diagnosis` removed. Pure fnv-1a, no crypto dependency, byte-identical in Node
and browser. A `FigureSpec` additionally hashes as the fnv-1a of its canonical
form covering all line sources, so a shared figure has one identity.

The centralized emission-rounding policy is carried: metres / km/h / degrees to
2 dp, fractions (grip, `f`, `n_*`) to 3 dp, `apex_pct` to 1 dp — applied **only**
at the verdict/CSV boundary, never inside samples, and any change to it is a
deliberate re-bless event. The engine is deterministic (no wall clock, no RNG,
fixed stepping); the regression gates built on these hashes are owned by
`09-verification-and-testing.md`.

---

## 9. Relation to the prior design

**Carried:** the Sample spine and its field meanings; the frozen/never-throw
Result discipline; strict outcome precedence; the closed error and outcome
vocabularies; event bracketing with exact crossings; fnv-1a canonical hashing and
the emission-rounding policy; `f` (lane fraction) as the doctrine-facing lateral
coordinate; the `diagnosis`-excluded-from-hash rule.

**Changed:** commanded controls (`cmd_lean, cmd_a, roll_rate, action_id, clipped,
n_long, n_lat`) are now *recorded* per sample instead of computed-and-dropped;
sight is per-sample from the rider's eye with the limit point's world coordinates
carried (D4); the samples/channels split is collapsed into one pinned array; the
result's top level is a multi-line `FigureResult` with identical citizenship for
failed lines (D6); sharing carries N line *specs* instead of one trajectory;
`checks_version` bumps to 2 with the visibility checks; `stand_up` joins the
diagnosis vocabulary (D3).

**New:** `stateAt` — the per-instant query that turns this contract into an
inspection surface; the interpolation contract that makes time-stepping
well-defined; events-as-bookmarks as a named API concept.

**Defects this contract closes:** controls derivable-but-not-inspectable; the
one-trajectory-per-URL cap; unpinned channel columns; mistake lines as
second-class unshareable overlays.
