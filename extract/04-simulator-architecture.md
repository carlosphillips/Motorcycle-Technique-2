# Simulator Architecture (moto-sim/1)

The `moto-sim/1` simulator is a zero-build JavaScript subsystem that integrates a
motorcycle through a corner and returns a **doctrine verdict** graded against Lee
Parks' line-selection method. Its defining architectural commitment is that
**nothing about the "correct" line is authored** — a scenario supplies only a road,
a rider start state, and a timed plan of brake / turn-in / throttle / position
actions; the **apex, exit, required lean, run-wide outcome, and corrective maneuver
all emerge from re-integrating the physics**. There is no `apex` field anywhere in
the input schema, and this absence is treated as a grep-provable structural
guarantee of doctrine rule #5 ("the turn point is the master decision").

This document describes the software architecture: the layering and the reasoning
behind each boundary, the Result-over-exceptions and IO-at-the-edges patterns, the
v1-simulator / v2-authoring relationship, the end-to-end data flow, the public API
spine, and the scenario serialization and URL hash-sharing scheme.

- Forward references: **03** covers the physics (equations of motion, friction
  ellipse, integration scheme); **05** covers the doctrine checks and their
  arithmetic; **06** covers the v2 authoring layer (`author/`, mistakes, scenes);
  **09** covers the CLI verbs and entry points in operational detail.

---

## 1. Layering

The subsystem is deliberately partitioned into concentric layers, purest at the
center, with IO strictly at the outer edge. The layout mirrors the design intent:
one physics source of truth, wrapped by read-only surfaces that can never diverge
from it.

| Layer | Directory | Nature | May do IO? | May throw? |
|---|---|---|---|---|
| v1 physics core | `core/` | Pure, Result-based classic-script IIFEs on a frozen `SIM` global | No | No |
| Rendering | `render/` | Pure SVG string builders (`topdown`, `controls`, `style`) | No | No (try/catch → fallback SVG) |
| v2 authoring | `author/` | ESM; imports core via `load.mjs`; solves the line and self-verifies | No (pure solve) | No (Result-based) |
| Read-only viewer | `app/` + `ui/` | Browser presentation; `file://`-loadable, no editing | Browser DOM only | UI edges only |
| Saved inputs | `scenarios/` + `examples/` + presets | JSON scenarios + registered course presets | — | — |
| Artifacts | `out/` | Run outputs (SVG, PNG, CSV, manifests) — git-ignored | (written by CLI) | — |
| The single IO edge | `cli.mjs` | The one binary; the only place that touches `process`/`fs`/`zlib` | Yes | Catches all |

### 1.1 Why `core/` is pure and Result-based

Every core file is a **classic-script IIFE** that attaches a frozen namespace to a
shared global `SIM` object — no ESM `import`/`export` appears in any core file. The
one exception is `core/load.mjs` (§7), the sole ESM seam. This is not stylistic: it
is chosen so the *identical* core files can be `<script src>`-loaded in a browser
**or** side-effect-imported in Node, guaranteeing that a browser run and a CLI run
execute byte-identical code. The course requires that chapters open directly as
local files, and `<script type="module">` plus `fetch()` both fail from a `file://`
origin in every major browser — so classic scripts on an ordered `<script src>`
load are the only mechanism that satisfies "runs unchanged in both Node and the
browser with no dev server." (Rejected alternative: TypeScript, which would need a
build step for the browser.)

Purity means no core function performs file or network IO, reads a wall clock,
draws from an RNG, or throws an exception that escapes the module. Fallibility is
expressed entirely through the `Result` type (§3).

### 1.2 Why `render/` sits beside core

The renderers produce **self-contained SVG strings** — inline `fill`/`stroke`/
`<defs>` only, never a CSS class, `<style>`, `<link>`, or external `url()`. The
constraint exists because an exported SVG must drop unmodified into a hand-authored
course chapter and pass `tools/render_diagrams.py` (the cairosvg gate). A concrete
consequence: gravel is drawn as explicit stippled `<circle>` elements rather than
an SVG `<pattern>` fill, because a `<pattern>` is "not guaranteed to rasterise"
reliably under cairosvg. The renderers are wrapped in try/catch and yield a minimal
valid `fallbackSvg(msg)` rather than throwing, preserving the never-throw
discipline at the presentation boundary.

### 1.3 Why the viewer (`app/` + `ui/`) is read-only

The viewer is a deliberately **read-only** presentation layer over the same core:
no drag, edit, or hit-testing (deferred to "v1.5"). Its purpose is to let a human —
or a course reader via an embedded `<iframe>` — see a scenario's line and verdict
without a server, entirely from `file://`, using the *identical* pipeline the CLI
drives. This "one core, two surfaces" guarantee is enforced by a gate (called "G6′"
in comments): load a scenario through the viewer and through the CLI and assert the
verdicts are **tolerance-equal**. Keeping the viewer a pure consumer avoids a second
authoring surface that could drift from `author/`'s v2 solver. Even a future editor
is constrained: the steering/lean channel would remain read-only always, because
"letting users sculpt the lean curve would contradict the doctrine" — lean must
emerge from a turn-in event plus a roll-rate limit, never be hand-drawn.

### 1.4 Why `simulator/` is a top-level directory

The simulator lives at repo top level, not inside `cornering-course/` (which would
muddy the hand-authored teaching HTML and its audit trail) and not under `tools/`
(reserved for single-purpose verification scripts — this is an app with a browser
surface). A `package.json` project structure was rejected outright to preserve the
repo's gate-checked "no package.json anywhere" invariant; "if v2 ever needs deps,
that is the flagged decision point."

---

## 2. The Result-over-exceptions and IO-at-the-edges principles

### 2.1 Result over exceptions

Every fallible core operation returns either `{ok: true, value}` or
`{ok: false, error: {code, at, message}}`. **No thrown exception escapes `core/`.**
This is a deliberate architectural choice (aligned with the project's global
"Results over exceptions" preference): a `Result` short-circuits by *propagation*,
not by unwinding the stack, so the orchestration pipeline (§5) can thread failures
through cleanly and the CLI can translate a typed error into machine-readable JSON
on stdout instead of a stack trace escaping to a human or agent caller.

The error vocabulary is **closed and greppable** — "so an agent can `rg` a whole
session's failures":

| Code | Meaning |
|---|---|
| `SCHEMA` | Malformed scenario JSON / bad field |
| `DUP_ID` | Duplicate plan-action / segment / obstacle id |
| `OUT_OF_SCOPE` | U-turn, brake-to-stop-in-corner, and other v1 scope cuts |
| `UNKNOWN_ID` | Addressed a plan/segment id that does not exist |
| `BAD_RANGE` | Negative radius, `len ≤ 0`, `mu ≤ 0`, `speed ≤ 0`, … |
| `NO_SOLUTION` | A solver (`shoot.js`) found no feasible target |
| `NOT_IMPLEMENTED` | A v1.5/v2 feature reached in v1 |
| `INTERNAL` | An invariant the core believes impossible |

### 2.2 IO pushed to the edges

`cli.mjs` is "the ONLY place (besides tests and `ui/`) allowed to import or use
`process`, `fs`, or `zlib`." The core physics/authoring stack is pure and never
throws across the boundary; the CLI's job is to translate typed `Result` errors
into JSON on stdout, keep human diagnostics on stderr, and encode outcome semantics
into exit codes. The literal architectural reading of "IO at the edges" is that no
core file *can* do file/network IO or throw — only `cli.mjs` and the UI files may.

---

## 3. The `Result` type (`result.js` → `SIM.result`)

`SIM.result` is the spine shared by every layer.

```
ok(value)              -> {ok:true, value}
err(code, at, message) -> {ok:false, error:{code, at, message}}
isOk(r) / isErr(r)     -> boolean
deepFreeze(obj)        -> obj      // recursive Object.freeze, same reference
all(results)           -> Result<value[]>   // first error, else ok(values[])
ERR                    -> {SCHEMA, DUP_ID, OUT_OF_SCOPE, UNKNOWN_ID,
                           BAD_RANGE, NO_SOLUTION, NOT_IMPLEMENTED, INTERNAL}
```

Two implementation notes reveal the intent:

- **`deepFreeze` recurses children before the parent**, "so no window of
  mutability exists on a frozen parent." Verdict and trajectory objects are frozen
  before they leave the core, making the whole result immutable.
- Hot-path functions (`deepFreeze`, the per-step mu lookup) use **indexed loops,
  not `for…of`**, to avoid iterator allocation — `deepFreeze` runs roughly twice
  per trajectory record.

---

## 4. The API spine (from `CONTRACT.md`)

`CONTRACT.md` is the as-built JS API spine; these signatures are frozen ("do not
edit"). The spine below is grouped by namespace. Bodies are omitted deliberately —
what matters here is the contract and its invariants. (Physics-detail semantics are
in **03**; doctrine-check semantics in **05**.)

### 4.1 Units, config, physics (constants live in one place)

The repo's "most-audited bug class" is leftover imperial constants, guarded against
by putting every unit constant in one module.

- **`SIM.units`** — `G = 9.81` (m/s²), `DEG2RAD`/`RAD2DEG`, `kmh2ms`/`ms2kmh`,
  `mph2kmh`/`kmh2mph`/`ft2m`/`m2ft`, `clamp(x,lo,hi)`, `relu(x)`,
  `pctChange(from,to)`.
- **`SIM.config`** — profiles (`casual`/`street`/`trained`/`racer` →
  `{roll_rate_dps, skill, t_react_s}`), `ssd_models` (`alert{a_ssd:7.0,
  t_react_s:1.0}`, `aashto{a_ssd:3.4, t_react_s:2.5}`), plus `mu_default`,
  `lane_width_m`, `bike_margin_m`, `dt_s`, `ds_m`, `v_floor_ms`, deadbands, and the
  book-sourced doctrine bars (`apex_late_pct`, `apex_late_pct_decreasing`,
  `phi_ok_deg`, `single_input_delta_phi_deg`).
- **`SIM.physics`** — pure physics helpers: `kappa(v,phi)`, `aLat(v,kappa)`,
  `requiredLean(v,kappa)`, `speedForLean(r,phi)`, `aLatMax(mu)`, `aLongMax(mu)`,
  `phiMax(mu)=atan(mu)`, `aLatReserve(muUse)`, `phiReserve(muUse)=atan(muUse)`,
  `ellipseMag`, `aLongAvail`, `gripMargin`, `idealLineRadius(Rc,lane,margin,sweepDeg)`.

### 4.2 Geometry and road model

```
SIM.geom.offsetPolyline(points, dist)         -> polyline
SIM.geom.pointToPolyline(p, poly)             -> {dist, segIndex, foot, t}
SIM.geom.rayPolyline(origin, dir, poly, maxLen) -> {hit, point, dist}
    // plus v2, add/sub/scale/dot/len/norm/perpLeft, rot, lerp, signedArea, polylineLength

SIM.road.compose(roadSpec)          -> Result<RoadModel>
SIM.road.at(road, s)                -> {x, y, psi, kappa}
SIM.road.sdToXY(road, s, d)         -> {x, y}
SIM.road.xyToStation(road, x, y)    -> {s, d}          // exact inverse, round-trip ≤ 1e-6
SIM.road.usableCorridor(road, s)    -> {inner_d, outer_d}
SIM.road.laneFraction(road, cornerId, d) -> number     // 0=inner edge, 1=outer, >1=oncoming
SIM.road.edges(road)                -> {centerline, roadOuter, roadInner, laneOuter, laneInner}
```

`RoadModel` (frozen) carries a dense lookup table plus derived structure:

```
RoadModel = { length, ds_m, lane_width_m, bike_margin_m, use_full_width,
  lut:[{s,x,y,psi,kappa}], segments:[{id,type,s0,s1,…}],
  corners:[{id,hand,s0,s1,s_mid,r,angle_deg,kappa,…}], window_safe_dist }
```

**Invariants worth noting for architecture:** the position `f` (lane fraction) is
the *primary* doctrine-facing coordinate, not raw `d`, because raw `d` is
doctrine-ambiguous — rider's-left is the outside edge on a right-hander but the
inside edge on a left-hander — whereas `f` (0=inside usable edge, 1=outside, >1=
oncoming) lets an agent compare mixed L/R corners directly. `compose` validates and
rejects malformed specs (`SCHEMA`/`BAD_RANGE`) and appends an exact final LUT
station when the length isn't a whole multiple of `ds_m`. A windowed LUT lookup is
used **only when provably safe** (`window_safe_dist`), else it falls back to a full
scan — chosen so results are *always* byte-identical to a naive scan; the O(1)
windowed path is a performance optimization with a proven correctness bound, tied to
the memory-recorded "8.2× solve speedup," not a behavior change.

### 4.3 Plan compilation

```
SIM.plan.compile(rider, road, config)              -> Result<Controller>
SIM.plan.resolveTangentInside(controller, resolvedLeans) -> Controller
SIM.plan.nearestStation(lut, x, y, hint?, safeDist?)     -> number
```

`compile` turns the declarative `rider.plan` (an ordered action list) into a
`Controller` the integrator steps each tick:

```
Controller = { actions, control(state, hint) -> {target_lean, roll_rate, a_cmd, active},
  needsShoot, steerEvents, brakeEvents, throttleEvents, positionEvents, __road, __rollRate }
```

A `turn_in {target: "tangent_inside"}` action is marked `deferred` (with
`needsShoot = true`) — its concrete lean magnitude is unknown until the shooting
solver runs, and `resolveTangentInside` is the Phase-2 seam where the root-found
leans are spliced back in, re-signed by the corner hand captured at compile time.

### 4.4 Integration, analysis, visibility

```
SIM.integrate.step(state, control, road, dt)              -> {state', record}
SIM.integrate.run(state0, control, road, config, muAt)    -> Result<Trajectory>

SIM.analyze.measureApex(samples, road, corner)   -> {s_apex, d_apex, f_apex,
                                clearance_m, apex_pct, v_apex, phi_max_deg, phi_max_at_s}
SIM.analyze.classifyApex(apex_pct, corner, config) -> "late"|"early"|"na"
SIM.analyze.measureExit(samples, road, corner)   -> {s_exit, d_exit, f_exit, heading_err_deg}
SIM.analyze.detectRunWide(samples, road, corner, config) -> {ran_wide, d_max, s, edge, s_detect, s_react}
SIM.analyze.measureLink(samples, road, cornerA, cornerB) -> {from,to,at_s,linked,…}
SIM.analyze.vLimPointwise(road, s, muUse)  /  vMinStation  /  dangerZone  /
            gripMarginMin  /  lineVsRoadRadius  /  diagnose(bundle)

SIM.visibility.sightDistance(road, s, obstacles, config) -> {sight_m, limit_point, s_limit, trend}
SIM.visibility.ssd(v_ms, model, config)                  -> {ssd_m, react_m, brake_m}
SIM.visibility.sightVsStopping(road, samples, obstacles, config, model)
                                            -> {ok, margin_m, worst} | {na:true, reason}
SIM.visibility.obstaclePolygon(road, obstacle)           -> {x,y}[]
```

`SIM.analyze` is measurement-only — no solvers, no integration. `sightDistance`
takes **no `v` parameter** by hard doctrine: geometric sight distance is
speed-independent ray-cast geometry, while only `ssd` (stopping sight distance)
shrinks with `v²`. `Trajectory` and `Sample` shapes:

```
Trajectory = { samples:[Sample], events:[Event], outcome_hint, terminated:{reason,s} }
Sample     = { s,t,x,y,psi,v,phi,kappa,a_long,a_lat,grip_margin,clipped,mu,d,f }
```

### 4.5 Scenario, doctrine, solvers, orchestration

```
SIM.scenario.validate(json)      -> Result<Scenario>    // sole rejection entry point
SIM.scenario.canonicalize(scn)   -> string
SIM.scenario.specHash(scn)       -> string  // 6 hex chars, fnv-1a, no node:crypto
SIM.scenario.explain(checkId)    -> string
SIM.scenario.schemaText()        -> string
SIM.scenario.sideSign(side, handSign) -> 1 | -1
SIM.scenario.CHECK_IDS           -> string[]  // the 12 doctrine check ids

SIM.doctrine.checkAll(scenario, trajectory, analysis)
    -> { checks_version, checks:[{id,corner,verdict,evidence}], summary:{…} }
SIM.doctrine.CHECK_IDS           -> frozen array of the 12 ids

SIM.shoot.solveTangentInside(controller, road, state0, config, muAt)
    -> {ok:true, value:{leans: Object<string,number>}}   // lean MAGNITUDE (deg) per steer id
SIM.shoot.solveCorrection(trajectory, road, corner, config)
    -> {outcome:"wide"|"runoff", d_max, kind, delta, apply_at_s, feasible,
        consumes_reserve, v_ok /*km/h*/, phi_req_deg}     // frozen object, not a Result

SIM.simulate.run(scenario) -> Result<{trajectory, channels, verdict}>   // the top-level entry

SIM.presets.{register, get, byGroup, byChapter, all, ids}
```

---

## 5. Data flow: inputs → integrate → analyze → verdict → render

`SIM.simulate.run(scenario)` is the single orchestration spine. It wires the pure
modules into one deterministic `run(scenario) → Verdict` pipeline. The stages, in
order:

1. **Validate + compose + compile.** `scenario.validate` normalizes and freezes
   the spec (the *only* place a scenario can be rejected); `road.compose` builds the
   `RoadModel`; `plan.compile` builds the `Controller`. Any failing `Result`
   short-circuits and is returned as-is — no throw.
2. **Local-μ function** `muAt(s,d)` scans surface patches (obstacles that block
   `"surface"` with a `d` band and a `mu`), else falls back to the scenario μ.
3. **`runConfig`** merges global `SIM.config` with scenario/rider overrides
   (`mu`, `roll_rate_dps`, `skill`, `t_react_s`).
4. **Start state** built from the rider start (speed, lateral `d`, road heading),
   upright (`phi = 0`).
5. **Tangent-inside resolution.** If `controller.needsShoot`, `shoot.solveTangentInside`
   resolves each deferred turn-in to a committed lean, spliced back via
   `plan.resolveTangentInside`.
6. **Integrate.** `integrate.run` produces the `Trajectory`.
7. **Sight precompute.** Per-sample `sightDistance` (speed-independent, computed
   once); set an `isVerticalBlind` flag if any crest/dip/vertical obstacle applies.
8. **Crash detection — before any corrective solve** (so no nonsensical "save" is
   computed for a trajectory that already lowsided).
9. **Per-corner analysis loop.** For each corner: apex, apex class, exit, run-wide,
   grip margin, `v_min`, danger zone, turn-in lane fraction, worst sight-vs-SSD
   margin, blind flag. **Only if the corner ran wide and the run did not crash** is
   `shoot.solveCorrection` invoked (lazily) to test whether an "add-lean" save is
   feasible.
10. **Doctrine.** Build links (`analyze.measureLink` per consecutive flowing pair),
    the global worst sight margin, then `doctrine.checkAll`.
11. **Outcome by strict precedence:** `crash > runoff > wide > violation > clean`
    (a fixed total order, not a union of flags — the verdict is one deterministic
    headline).
12. **Headline** text.
13. **Diagnosis.** If not clean, `analyze.diagnose` runs a root-cause classifier
    over *full-precision* per-corner measurements — explicitly excluded from
    `result_hash`.
14. **Verdict assembly + hashing.** Compute `spec_hash` over the canonical
    scenario; compute `result_hash` as the first 6 hex of fnv-1a over the
    canonicalized verdict **with `result_hash` and `diagnosis` deleted** — a
    byte-stability rule so adding diagnostic fields never perturbs an existing
    preset's hash.
15. **Tier-3 channels** — per-station trace arrays, each numeric column at 3 dp
    except raw station `s` (kept full precision so `channels[i].s === samples[i].s`
    exactly — a pinned 1:1 alignment contract).
16. Return `ok(deepFreeze({trajectory, channels, verdict}))`.

### 5.1 Two shooting solves, never a static formula

Both `solveTangentInside` and `solveCorrection` decide feasibility by
**re-integrating through the same pure stepper**, never by a closed-form lean
formula. Static readouts (`R_req`, `phi_req_deg`) are computed but explicitly marked
"a READOUT only; the shot is the verdict." The rationale is the whole point of the
simulator: geometry math can look right while the physical path — with roll-rate
limits, grip, and drag — diverges from it. (Solver internals: **03**.)

### 5.2 Centralized float-emission policy

One rounding policy is applied only at the verdict/channel boundary — metres/km-h/
degrees to 2 dp, grip margins and lane fractions to 3 dp, `apex_pct` to 1 dp — never
inside the physics. Raw trajectory samples and the `diagnosis` block stay full
precision, because diagnosis "reasons on raw measurements, not rounded emission
values." Because this rounding feeds `result_hash`, any change to it requires a
dedicated re-blessing commit, keeping display rounding (the CLI's `r1/r2/r3`)
deliberately separate from hash-affecting rounding.

### 5.3 The verdict shape (Tier 1, ≤ 2 KB)

```
{ ok, spec_hash, result_hash, checks_version, engine:"moto-sim/1.0.0", scenario,
  outcome, headline,
  diagnosis: null | {cause, at_s, corner_id, detail},
  corners:[{id, reached, turn_in_s, apex_s, apex_pct, apex_f, apex_clearance_m,
    v_apex_kmh, lean_max_deg, lean_max_at_s, grip_margin_min, grip_margin_min_at_s,
    exit:{s,d,f,heading_err_deg}, ran_wide, corrective:null|{…}, crash?:{s,phi_deg,kind}}],
  sight:{margin_min_m, at_s, v_at_s_kmh, note} | null,
  doctrine:{pass, fail, warn, na, expected_fail_present, missing_expected_fail, unexpected_fail},
  files:{trace, render} }
```

`outcome` is a closed set `clean | wide | runoff | violation | crash |
dnf-spec-error`; `diagnosis.cause` is a closed set `overspeed_entry |
grip_exceeded | roll_rate_limited | sight_deficit | late_brake | plan_gap`.

---

## 6. v1 vs v2 — the simulator doubles as its own validator

The system has two authoring tiers, and their relationship is the load-bearing
architectural idea:

- **v1** (`core/`) is the physics engine and the grader: given a fully-specified
  scenario (road + rider plan), it integrates and grades. It *simulates a plan*.
- **v2** (`author/`, ESM) is the front door: hand it a road and a turn-in station,
  and it *solves the line* — running a per-corner inverse solve to fill in the
  brake decel and roll-on that produce a clean late-apex arc.

Crucially, **v2 does not trust its own solution.** After solving, the author layer
**re-runs the v1 engine on its own output to self-verify**, and gates on the result
(a non-clean solve exits 3, but still draws the mistake line so a reader can see
why). The v1 simulator is therefore the *validator* for v2 authoring: "physics is
the validator, not the generator." The same principle governs mistake compiling —
`--mistake <spec>` perturbs exactly one input off the solved good line, forward-runs
the *real* engine, and reports the engine's own outcome and diagnosis, never an
outcome asserted by the compiler.

This is why the two tiers split cleanly across the ESM/classic-script boundary. The
`apex:<cornerId>` plan anchor makes the boundary concrete: it is **rejected by
core** (`scenario.validate`), because the apex is emergent and unknown until the
engine runs; it is resolvable *only* in the author layer, which runs the engine
first and rewrites the anchor to an absolute `at_s` before handing core a
fully-resolved plan. The "no apex input" invariant survives even as ergonomic sugar
is layered on top. (Authoring detail: **06**.)

### 6.1 Solvers carved into a separate phase

The two shooting solvers live in `core/shoot.js`, built *after* the integrator, not
alongside it. The reasoning ([R5] in the design record): the hardest algorithms
(tangent-inside solve, corrective solve) both depend on a *finished* integrator, so
building them in parallel with the integrator would violate "no agent imports
another's work-in-progress." Splitting them into a later phase made that constraint
actually true.

---

## 7. `core/load.mjs` — the one ESM seam

`core/load.mjs` is explicitly the **one ESM file allowed to use import/export** in
core. Its only job is to side-effect-import every core and render file in a fixed
order (CONTRACT §7) and re-export the populated `globalThis.SIM` as its default —
the single seam between "pure IO-free classic-script core" and Node's module system.
`import SIM from "./core/load.mjs"` yields the same `SIM` the browser builds by
loading the identical file list in the identical order via `<script src>` in
`app/index.html`. The header comment flags this as a **two-list invariant** kept in
sync by hand. The fixed order (registry before per-group preset files, which
self-register at load time):

```
units.js, result.js, config.js, physics.js, geom.js, road.js, plan.js, integrate.js,
analyze.js, visibility.js, scenario.js, doctrine.js, shoot.js, simulate.js,
render/style.js, presets.js, presets-anatomy.js, presets-corner-types.js,
presets-special.js, render/topdown.js, render/controls.js
```

---

## 8. Scenario serialization and identity hashing

### 8.1 The wire schema

`scenario.validate(json) → Result<Scenario>` is the sole rejection entry point; it
returns a frozen, normalized object with defaults filled. The wire format (no `apex`
field anywhere, all plan actions addressed by a stable string `id`):

```
{ spec:"moto-sim/1", id,
  road:{ lane_width_m, bike_margin_m, use_full_width, segments:[straight|arc|taper] },
  rider:{ profile, start:{speed_kmh, d}, plan:[PlanAction…] },
  config:{ mu, mode, ds_m, checks_version }, expect_fail?, obstacles? }

PlanAction:
  {id, at_s, do:"brake",    decel>0, taper_to_s?}
  {id, at_s, do:"turn_in",  target:"tangent_inside" | {lean_deg ∈ (0,90)}}
  {id, at_s, do:"throttle", accel>=0}          // 0.0 = maintenance crack; >0 = drive roll-on
  {id, at_s, do:"position", d}
  <station> = at_s (absolute) | at:{ref:"entry|exit|mid:<cornerId>", offset_m?}
```

Key validation rules and their reasoning:

- `spec` must literally equal `"moto-sim/1"`.
- **`apex:<id>` anchors are rejected** (apex is emergent — see §6); only the static
  refs `entry`/`exit`/`mid` of a corner resolve, and they resolve to absolute `at_s`
  *inside* `validate`, so the hashed scenario always carries only `at_s`.
- **Addressing is by `id`, never array index.** The single rider-plan schema is an
  ordered action list where every action has a stable `id` ([R4]); positional
  addressing "breaks a saved sweep" when an action is inserted, so `setByPath` and
  `diffScenario` match plan actions by `.id`.
- **U-turn / brake-to-stop-in-corner** are rejected `OUT_OF_SCOPE`. The U-turn
  thresholds (`angle_deg ≥ 170°` AND `r ≤ 15 m`) are annotated as **tuning, not
  doctrine** — "no book source, never attributed to Parks" — a deliberate marker
  keeping heuristic engineering constants distinct from book-derived doctrine.
- **Named lateral obstacle placement** (`side + margin_m + width_m`) resolves
  statically to a signed `d:[a,b]` band at validation time via a single
  `sideSign(side, handSign)` rule ("one rule, so no one ever hand-computes a signed
  `d` again"), opt-in via `margin_m` so existing presets' `spec_hash` is untouched.

### 8.2 Canonical hashing — input and result identity

Two hashes give the scenario and its verdict stable identities:

```
sortKeys(value)          // recursively rebuild objects with sorted keys (arrays keep order)
canonicalize(scenario) = JSON.stringify(sortKeys(scenario))
specHash(scenario)     = fnv1a(canonicalize(scenario)).slice(0, 6)
result_hash            = fnv1a(canonicalize(verdict − {result_hash, diagnosis})).slice(0, 6)
```

The hash is a **pure fnv-1a, no `node:crypto`**, so it runs byte-identically from a
`file://` origin in the browser and in Node — the same "works from `file://`"
constraint that shapes the whole core. These hashes back the **preset-hash
byte-stability tripwire**: `bless-preset-hashes.mjs` records every registered
preset's and every `scenarios/*.json` file's `{spec_hash, result_hash}` pair into a
key-sorted fixture, and a test fails on any drift, forcing a deliberate re-bless
whenever an engine change is genuinely intended. Silent hash drift is a caught
regression, not something to patch around.

### 8.3 Saved inputs: `scenarios/`, `examples/`, and presets

Saved scenario JSON lives in `scenarios/` and `examples/`. The course teaching
examples are registered *in code* via `presets*.js` — classic-script,
self-registering modules that call `SIM.presets.register` at load time. Each preset
is a `{scenario, expect}` pair; `expect` is the **validation oracle** — a mismatch
between the engine's emergent verdict and the declared `expect` is treated as a
simulator bug or a mis-authored preset, never patched by editing `expect`. (Preset
system detail: **05**.)

---

## 9. URL / decode — hash-based scenario sharing

The `url` and `decode` verbs let a whole scenario ride a shareable link with no
server-side state, so a course chapter can embed a specific scenario in an
`<iframe>`.

- **Encoding** (`url` verb, CLI side): the scenario JSON is `deflateRawSync`-
  compressed (`node:zlib`), then base64url-encoded (`+`→`-`, `/`→`_`, trailing `=`
  stripped), producing:

  ```
  file://…/embed.html#s=<base64url(deflateRaw(JSON.stringify(scenario)))>
  ```

  A preset can also be addressed directly by id: `embed.html#p=<presetId>`.
- **Decoding in the viewer** (`app/embed.html`): uses the browser
  `DecompressionStream`, trying format `"deflate"`, then `"deflate-raw"`, then
  falling back to treating the payload as uncompressed JSON. (The CLI always encodes
  with **raw** deflate, so the embed's first `"deflate"` attempt fails and it falls
  through to `"deflate-raw"` — functionally fine but an asymmetry worth noting.)
- **`decode`** is the inverse: it accepts a bare payload, an `s=PAYLOAD`, or a full
  URL/hash (matching `[#?&]s=([^#?&]+)`), inflates, and pretty-prints the JSON.

**Honest-by-design constraint:** the `#s=` hash carries exactly *one* trajectory, so
when a `.scene` is encoded, only the solved **good line**'s scenario rides the hash —
a scene's mistake/naive overlays stay figure-only and can never be shared as if they
were the taught line. This is documented as a deliberate design constraint, not a
bug.

`embed.html` is "the ONE viewer that actually parses the `#s=` hash"; `index.html`'s
fragment handling is inert. That split is intentional: `index.html` is the full
(preset-only) workstation, while `embed.html` is a deliberately slim, iframe-able
shell whose entire configuration lives in the URL hash — so a shared link or a
chapter embed needs no server-side state.

---

## 10. Cross-cutting invariants (why they hold system-wide)

A few rules recur across every layer and are worth stating once as architecture:

- **One core, two surfaces.** Browser and Node run byte-identical core code; the
  viewer is proven tolerance-equal to the CLI (G6′). No second physics
  implementation exists to drift.
- **Never-throw all the way out.** Core returns `Result`; renderers fall back to a
  valid error-SVG; only `cli.mjs` (and tests/UI edges) may throw or do IO.
- **Deterministic, no wall-clock/RNG.** Pure functions, fixed stepping, f64.
  Bit-identical results are guaranteed only *within a single pinned runtime*;
  cross-engine, discrete verdicts are stabilized by documented deadbands and
  hysteresis, not by chasing IEEE-754 bit-equality across JS engines (an explicit
  rejection of assumed cross-engine bit-identity).
- **Colour code reserved for line quality.** Green = ideal (`#1f6f43`), amber =
  geometric/middling (`#b07d1e`), red = mistake (`#b32e2e`); the strip-chart channel
  colours are deliberately neutral so they never collide with the line-quality code.
- **No apex input, anywhere.** Enforced structurally at the schema, hashed, and
  guarded at the core/author boundary — the architectural expression of doctrine
  rule #5.
```
