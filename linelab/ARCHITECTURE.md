# linelab — ARCHITECTURE (binding contract for v0.1)

This document is binding on every implementation agent. The design of record is
`../design/*.md` (00–09, D1–D46). Where this file pins a choice, the pin wins over an
agent's preference; where this file is silent, the design doc named in the relevant brief
wins; on conflict between the two, STOP and escalate — do not improvise.

Scope here = **v0.1, the figure spine** (00-README §3): `core/ road/ sight/ plan/ solve/`,
`render/` top-down in `true` mode, `cli/` verbs `run solve mistake figure render check
schema explain export`, the six book-figure bakes, the D42 counterfactual layer, first
bless. `viewer/` and everything v0.2+ gets file placement pinned but no implementation.

---

## 1. Package setup (exact)

`linelab/package.json`:

```json
{
  "name": "linelab",
  "version": "0.1.0",
  "type": "module",
  "engines": { "node": ">=20" },
  "bin": { "linelab": "./dist/cli/main.js", "linelab-bless": "./dist/cli/bless.js" },
  "exports": { ".": "./dist/index.js" },
  "files": ["dist"],
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "cli": "node --enable-source-maps dist/cli/main.js",
    "bless": "node --enable-source-maps dist/cli/bless.js"
  },
  "devDependencies": {
    "typescript": "~5.7.0",
    "vitest": "^3.0.0",
    "@types/node": "^20.17.0"
  }
}
```

**Runtime dependencies: NONE, ever, anywhere in v0.1** (D1). `viewer/` (v0.2) may add
dev-tooling (Vite) later; nothing beneath `viewer/`/`cli/` ever gains a dependency.
No JSON-schema library — all validators are hand-written typed guards.

`linelab/tsconfig.json`:

```json
{
  "compilerOptions": {
    "module": "nodenext",
    "moduleResolution": "nodenext",
    "target": "es2022",
    "lib": ["es2023"],
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "verbatimModuleSyntax": true,
    "isolatedModules": true,
    "resolveJsonModule": true,
    "declaration": true,
    "sourceMap": true,
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

**Resolution choice: NodeNext.** Justification: the CLI is a `bin` that must run as
compiled output directly under Node ESM with no bundler in v0.1; NodeNext is the only
mode whose emitted specifiers Node resolves unmodified. Vite (v0.2 viewer) consumes the
same output without change. Consequence, binding on every agent: **every relative import
in `.ts` source ends in `.js`** (e.g. `import { fnv1a } from "./hash.js"`). No `lib: dom`
in v0.1 — the renderer builds SVG strings, never touches a DOM.

JSON data files (rubric/continuation packs) are imported with
`import pack from "./parks-street.json" with { type: "json" }` (TS 5.7 + Node 20 import
attributes; `resolveJsonModule` is on).

`linelab/vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";
export default defineConfig({
  test: { include: ["test/**/*.test.ts"], pool: "threads", isolate: true }
});
```

Tests import product code by relative path with `.js` extensions
(`import { solve } from "../../src/index.js"`). `src/cli/main.ts` and `bless.ts` begin
with `#!/usr/bin/env node` (tsc preserves shebangs).

---

## 2. Module graph (binding import DAG)

Strict linear order; a module may import **only from strictly earlier modules**:

```
core  ←  road  ←  sight  ←  plan  ←  solve  ←  render  ←  cli        (viewer beside cli, v0.2)
```

- `core` imports **nothing** (not even node builtins beyond types). It defines the
  *interfaces* it consumes (`RoadModel`, `SightCaster`, `World`) — `road/` and `sight/`
  produce values satisfying them; composition happens in `solve/run.ts`.
- Exactly **one** integrator exists: `core/integrate.ts`. Solvers, the corrective shadow,
  counterfactual riders, and (later) the viewer all call it. No second stepper, no state
  stitching (chained candidates re-integrate from road start). This is `C-ONE-CORE`'s
  substance from commit one.
- IO (fs/process/env/argv) is legal **only** in `src/cli/main.ts` and `src/cli/bless.ts`.
  Every other file in `src/` (including the rest of `cli/`) is pure and synchronous over
  frozen inputs. Enforced by `test/meta/imports.test.ts` (greps import graph + forbidden
  identifiers: `Date.now`, `Math.random`, `process.`, `fs`, `Intl`, `toLocale`).

---

## 3. Directory layout (v0.1, complete)

```
linelab/
  package.json  tsconfig.json  vitest.config.ts  ARCHITECTURE.md
  src/
    index.ts                     # root export surface (A-IMPORT-SURFACE); v0.1 names only
    core/
      result.ts                  # Result<T>, LinelabError, ok()/err() — THE one error shape
      types.ts                   # State, Sample, Event, EventKind, Trajectory, Terminated,
                                 #   Outcome, SteerState, Phase, RiderProfile, ResolvedScenario,
                                 #   ResolvedPlanAction, RoadModel/Corner/World interfaces,
                                 #   InstantState (type only in v0.1)
      constants.ts               # every 02-owned constant (G, K_SU, K_CHOP, A_SU_ONSET, PHI0,
                                 #   A_SLEW_DEFAULT, SLEW_MIN/MAX, FREEZE_MAX_S, OMEGA_POS,
                                 #   PHI_TRACK_AUTH_DEG, a_lat_pos_max, EPS_* , v_floor_ms,
                                 #   v_valid_min_ms, dt_s, ds_m, V_MIN_RHS, rider profiles, …)
      units.ts                   # handSign, deg↔rad, kmh↔ms; the ONLY conversion helpers
      hash.ts                    # fnv1a32 + canonicalize (see §6.3)
      controller.ts              # per-step ZOH control eval, longitudinal slew, freeze
      steering.ts                # four-state machine, release predicate, tracker, unwind
      slice.ts                   # run-wide slice: S_sustained/S_transient, (W), a_widen, a_noreturn
      integrate.ts               # THE RK4 stepper + termination scan + bracketing
      events.ts                  # event emission during/after run; reason↔event mapping
      resample.ts                # arc-grid retention, lerp/hold/OR rules, f recompute
      record.ts                  # rad→deg conversion into Sample records; deep-freeze
      analyze.ts                 # post-run: corners[] rows, ONE apex detector, exit/release
                                 #   post-hoc events, danger_dwell_s, phase openers
      stateAt.ts                 # RESERVED — v0.2 (interpolation + phase machine + derived)
    road/
      types.ts                   # Segment, roadSpec union, CornerRecord, composed RoadModel impl
      constants.ts               # TAPER_RATIO_MIN, LINK_GAP_FRAC, R_UTURN_MAX, SWEEP_UTURN_MIN,
                                 #   occluder/hazard defaults, LINK_GAP_M
      compose.ts                 # compose(roadSpec) → Result<RoadModel>; corner minting;
                                 #   super-tight refusal (owning statement)
      dsl.ts                     # parseRoadDSL / printRoadDSL; strict number lexer
      presets.ts                 # 03 §3.1 table verbatim incl. reshaped bookBlind (^140);
                                 #   preset → {dsl, hand, occluders, suggested_entry_kmh}
      corridor.ts                # dOf/fOf, governing-corner rule, sideSign, muAt (lateral clamp)
      truncate.ts                # truncateAt(roadSpec, s) — built in v0.1 (03 §7a.11)
    sight/
      constants.ts               # SIGHT_TREND_WINDOW_M/DEADBAND_M, ssd model table (alert/aashto)
      footprints.ts              # occluder → opaque footprint polygons; vehicle rectangles
      cast.ts                    # sightFrom(road, eye, occluders) — pure, first-blocked
      ssd.ts                     # ssd(v, phi, model, profile, mu) — THE one definition
      analyze.ts                 # post-run: sight_ride_m rebase, hazard_visible, sight_min event
    plan/
      types.ts                   # wire shapes: Scenario, PlanAction, Occluder, Hazard,
                                 #   MistakeSpec, SolveSpec, Constraint, Figure, FigureSpec
      constants.ts               # config defaults (mu 1.0, ds_m 0.5, ssd_model alert,
                                 #   rubric "parks-street", checks_version 2, start.f 1.0)
      anchors.ts                 # THE anchor grammar (D32): entry|exit|mid:<id>, s:<m>, offsets
      placements.ts              # occluder/hazard placement tokens → absolute geometry
      validate.ts                # validate(json) → Result<Scenario>; the sole rejection point;
                                 #   position reachability (L_req), governing-corner binding
      mistakes.ts                # THE machine-readable pin table (03 §7.1) + mistake-token
                                 #   grammar parse/print; single source for schema/oracle/gate
      scene.ts                   # lowerScene(sceneText) → FigureSpec JSON (pure, total)
      figure.ts                  # FigureSpec validation, specHash (fnv1a over lowered canonical)
      doctrine/
        types.ts                 # CheckResult, DoctrineBlock, RubricPack, Severity, CheckVerdict
        metrics.ts               # the 14 closed metric implementations (checks_version 2)
        checks.ts                # the 16 check evaluators over the record (01 Appendix A)
        pack.ts                  # pack loader/validator (requires_checks_version, renames,
                                 #   annex.reserve_checks validation, provenance rule)
        quality.ts               # quality(outcome, doctrine) + clean() — THE one colour law
        packs/parks-street.json  # the committed rubric pack (design-named path)
      continuations/
        packs/street.json        # committed D45 pack DATA (no loader in v0.1; provenance-scanned)
    solve/
      types.ts                   # Verdict, CorrectiveBlock, MisjudgmentBlock, LineResult,
                                 #   LineRefusal, FigureResult, GateReport, SkewRecord,
                                 #   NO_SOLUTION sub_reason union, CfRefusal
      constants.ts               # 04's table: N_SWEEP, SWEEP_*, brackets, lean_frac 0.70,
                                 #   exit_target 0.85, DA_*, F_DETECT, eps_f_detect/save,
                                 #   LINKED_EXIT_F_*, N_PROBE, KISS_TOL_F, vis defaults, …
      stations.ts                # derived stations per corner (§4.1a) + road_too_short
      suggest.ts                 # suggestTurnIn (coarse sweep → full-solve top 4)
      solve.ts                   # main pipeline: probe, two bisections, self-verify
      merge.ts                   # authored-plan merge contract (§4.9)
      accept.ts                  # accept=clean|best_failing ranking (§4.8)
      doubleApex.ts              # solveDoubleApex + touch predicate
      chained.ts                 # chainedSolve + d_flip + link targets
      vis.ts                     # vis=cautious: V1 governor + V2 hold generation + self-check
      believed.ts                # believed-road pipeline: solve/literalize/execute, s_div
      mistake.ts                 # compileMistake(kind, params, ctx) + chained seeding
      counterfactual.ts          # counterfactual(world, x0, latency, rider, predicate);
                                 #   rider/predicate registries (lean_only_reserve reachable)
      corrective.ts              # run_wide_detect, correctiveShot wrapper, wide/runoff law
      verdict.ts                 # verdict assembly: outcome (physics-only), doctrine run,
                                 #   quality via plan/doctrine, corners[], sight block
      emit.ts                    # THE emission-rounding policy (2dp/3dp/1dp) — one function
      envelope.ts                # LineResult/FigureResult assembly, result_hash, skew eval,
                                 #   solved-plan cache-load semantics
      run.ts                     # run(input): compose world, delegate-to-solve rule, runLine
      gate.ts                    # gateFigure(envelope) → GateReport; E(line) derivation (D33)
    render/
      constants.ts               # 06's table: ink widths/dashes, colours, gate bands, WINDOW_*
      project.ts                 # project(road, lines, viewSpec) → Result<DrawnScene>
                                 #   v0.1 surface: mode="true" identity, auto-window (§2.4),
                                 #   explicit window crop, orient (auto→0 in true mode,
                                 #   explicit 0/90/180/270 honored). Diagram compression deferred.
      scene.ts                   # DrawnScene internal type (designed here, validated vs 06 §3.1)
      topdown.ts                 # renderTopdown(drawnScene, style?) → SvgString; draw order 1–11
      ink.ts                     # ink grammar table, terminal glyphs
      markers.ts                 # marker-from-event law + coincident collapse
      labels.ts                  # callout resolution + leader layout
      legend.ts                  # legend rows `role · quality (outcome)`, auto trigger
      gateProportions.ts         # gateProportions(metrics) + the four metrics from DrawnScene
      manifest.ts                # export manifest.json writer (pure: returns object)
      fallback.ts                # fallbackSvg(msg); never-throw wrapper
      index.ts                   # renderViews dispatch (v0.1: topdown only)
    cli/
      main.ts                    # IO shell: argv → verbs → stdout/exit (shebang line 1)
      bless.ts                   # linelab-bless (IO): analytic-gate → goldens + 02 §8.1 block
                                 #   + FigureSpec stamps; refuses exit 3 unless A-AN-*+D-BOUNDS green
      args.ts                    # flag table (bijective with `schema cli`), flag-over-file merge
      deferred.ts                # THE deferred-token table (§6.4); checked before flag parse
      exit.ts                    # exit tiers 0/1/2/3/4 mapping (08 §3.1)
      doc/schema.ts              # `schema` document builder (pure; reads owning-module registries)
      doc/explain.ts             # `explain` builder + 3-vocabulary disambiguation (pure)
      verbs/                     # one thin file per verb: run.ts solve.ts mistake.ts figure.ts
                                 #   render.ts check.ts schema.ts explain.ts export.ts
  test/                          # see §7 for the gate map
    meta/  analytic/  golden/  property/  oracle/  contract/  render/  cli/
    effectuality/  hash/  fixtures/
  verify/
    judge.json  coldstart.json  effectuality.json
  figures/                       # BAKE OUTPUTS: <figure_id>.svg, <figure_id>.judge.json,
                                 #   manifest.json  (scene SOURCES stay at ../figures/*.scene,
                                 #   the design of record — read-only from here)
```

`test/fixtures/` holds the golden store (raw-f64 JSON written only by bless) and
`tolerances.json` (the ONE tolerance table, 09 §3.2).

---

## 4. Type ownership (binding)

**One law: types live at the lowest module that can express them; behavior lives at its
design-doc owner.** Agents never re-declare a type — they import it.

| Type | Module/file | Notes |
|---|---|---|
| `Result<T>`, `LinelabError`, `ErrorCode` | `core/result.ts` | see below — defined ONCE |
| `State` (internal, radians), `Sample` (record, degrees), `Event`, `EventKind`, `Trajectory`, `Terminated`, `Outcome`, `SteerState`, `Phase`, `InstantState` | `core/types.ts` | Sample field order = 05 §2.1 pinned table; EventKind copied **verbatim from design/05 §5** (the brief's count is unreliable — copy from the doc, add an enumeration test) |
| `RoadModel`, `Corner`, `World`, `SightCaster` (interfaces) | `core/types.ts` | `road/`/`sight/` implement |
| `ResolvedScenario`, `ResolvedPlanAction`, `RiderProfile` | `core/types.ts` | frozen post-validate form the engine consumes |
| `Segment`, `roadSpec` union, `CornerRecord` | `road/types.ts` | |
| Wire `Scenario`, `PlanAction`, `Occluder`, `Hazard`, `MistakeSpec`, `SolveSpec`, `Constraint`, `Figure`, `FigureSpec` | `plan/types.ts` | all INPUT wire shapes in one file |
| `CheckResult`, `DoctrineBlock`, `RubricPack` | `plan/doctrine/types.ts` | |
| `Verdict`, `LineResult`, `LineRefusal`, `FigureResult`, `CorrectiveBlock`, `GateReport`, skew record, `CfRefusal`, NO_SOLUTION registry | `solve/types.ts` | all OUTPUT envelope shapes |
| `ViewSpec`, `DrawnScene`, manifest record | `render/` (`ViewSpec` in `render/constants.ts`-adjacent `project.ts`) | `plan/scene.ts` treats `view:` values as opaque strings passed through to FigureSpec; `render/project.ts` validates them (avoids plan→render dependency) |
| v0.2 shapes (`SaveWindow`, `StandingReport`) | `solve/types.ts` at v0.2 — do NOT declare in v0.1 | phase law: absent, not stubbed |

**The one error shape** (D8; 08 §3.2), `core/result.ts`:

```ts
export type Result<T, E = LinelabError> =
  | { ok: true; value: T }
  | { ok: false; error: E };

export type ErrorCode =
  | "SCHEMA" | "DUP_ID" | "OUT_OF_SCOPE" | "UNKNOWN_ID"
  | "BAD_RANGE" | "NO_SOLUTION" | "INEFFECTUAL" | "INTERNAL";   // closed; adding = design change

export interface LinelabError {
  code: ErrorCode;
  at: string;                       // offending path or token
  message: string;
  schema_ref?: string;
  detail?: Record<string, unknown>; // machine-readable payload
  deferred?: string;                // ONLY on SCHEMA, phase-gating law
}
```

Reason-token convention (binding): reason tokens ride `detail.reason: string`
(e.g. `{code:"SCHEMA", detail:{reason:"anchor_embedded_offset"}}`), **except**
`NO_SOLUTION`, whose registry token rides `detail.sub_reason` (04 §4.10 spells it so).
Tests assert on code + reason, never message text. No API function throws across its
boundary; `INTERNAL` is minted only for believed-impossible states.

---

## 5. Module interfaces (exported signatures, design names verbatim)

Root `src/index.ts` re-exports exactly the v0.1 surface (A-IMPORT-SURFACE); deferred
names are **absent** until their phase:

```ts
export { run, solve, suggestTurnIn, chainedSolve, solveDoubleApex, compileMistake,
         correctiveShot, counterfactual, gateFigure } from "./solve/…";
export { validate, lowerScene } from "./plan/…";
export { compose, parseRoadDSL, printRoadDSL, truncateAt } from "./road/…";
export { sightFrom, ssd } from "./sight/…";
export { project, renderTopdown, renderViews, gateProportions } from "./render/…";
export { explain, buildSchemaDoc } from "./cli/doc/…";
export type { Result, LinelabError, /* …all §4 types… */ } from "…";
// v0.2 adds: stateAt, standing, saveWindow, saveAt, renderControls, compare, sweep
// D45 adds: commitmentEnvelope
```

**core** — `integrate(scenario: ResolvedScenario, world: World, cfg: EngineConfig) →
Trajectory` (the only stepper); `handSign(h: "L"|"R"): 1|-1` (`handSign("R") === +1`);
kappa/lean algebra family (`kappa`, `aLat`, `requiredLean`, `speedForLean`), friction
family (`aLatMax`, `aLongMax`, `phiMax`, `ellipseMag`, `gripMargin(aLong, aLat, mu)`,
`aLongAvail`), reserve family (`mu_use`, `aLatReserve(muUse)`, `phiReserve(muUse)`) —
reserve functions demand an already-derated argument, per 02 §4; `a_widen(phi, v, c)`,
`a_noreturn(phi, rollRate)`; `analyzeCorners(traj, road) → CornerRow[]` (ONE apex
detector, emits `apex`/`exit` events too); `fnv1a(s: string): string` (6 hex),
`canonicalize(v: unknown): string`.

**road** — `compose(roadSpec) → Result<RoadModel>`; `parseRoadDSL(str) →
Result<roadSpec>`; `printRoadDSL(spec) → string` (`parse ∘ print ∘ parse` identity);
`truncateAt(roadSpec, s) → Result<roadSpec>`; `PRESETS` table; `sideSign` (occluder
side → signed d, imports `handSign`); `muAt(s, d)` on the composed model (lateral clamp
beyond the carriageway only).

**sight** — `sightFrom(road, eye: {x, y}, occluders) → {sight_m, limit_point: {x, y},
s_limit}` (pure, no trend, no speed); `ssd(v_ms, phi_rad, model, profile, mu) →
{ssd_m, react_m, standup_m, brake_m}` (THE one definition — check 10, the V1 governor and
the per-sample channel all import this); `analyzeSight(traj, road, occluders)` writes
`sight_ride_m` + `hazard_visible`/`sight_min` events post-run.

**plan** — `validate(json) → Result<Scenario>` (sole rejection point; normalizes, fills
defaults, resolves anchors/placements to absolute stations, freezes → also produces the
`ResolvedScenario`); `parseAnchor`/`parseMistakeToken`/`printMistakeToken`;
`MISTAKE_KINDS` pin table (single source for `schema mistakes`, the oracle, and gate
expectations); `lowerScene(sceneText) → Result<FigureSpec>`; `specHash(figureSpec) →
string`; `loadRubricPack(json) → Result<RubricPack>` + `runChecks(record, pack) →
DoctrineBlock`; `quality(outcome, doctrine) → "good"|"caution"|"failing"` and
`clean(...)` (the one colour law; render imports it, never re-derives).

**solve** — `solve(spec: SolveSpec) → Result<LineResult>`; `suggestTurnIn(spec) →
Result<LineResult>`; `chainedSolve(spec) → Result<LineResult>`; `solveDoubleApex(spec) →
Result<LineResult>`; `compileMistake(kind, params, ctx) → Result<{kind, plan, roadSpec,
outcome, diagnosis, label}>`; `correctiveShot(lineResult) → Result<{corrective, shadow:
Trajectory}>`; `counterfactual(world, x0, latency, rider, predicate) →
Result<{trajectory, verdict}, CfRefusal>` with closed sets `CounterfactualRider =
"lean_only_reserve" | "brake_reserve_escape"` (reachable set in v0.1 is exactly
`{"lean_only_reserve"}`; the other token rejects `SCHEMA` + `deferred: "continuation
envelope (D45)"`) and `CfPredicate = "return_after_detect" | "horizon_bounded_return" |
"reserve_bounded_run"`; wrappers declare bindings at their definition sites
(`correctiveShot` → `("lean_only_reserve","return_after_detect")`); `run(input) →
Result<FigureResult>` (delegate-to-solve rule, 08 §5.3); `gateFigure(envelope) →
GateReport`; `assembleVerdict`, `resultHash(verdict, plan)`, `evaluateSkew`.

**render** — `project(road, lines, viewSpec) → Result<DrawnScene>`;
`renderTopdown(drawnScene, style?) → SvgString` (projection-agnostic; never throws —
catch-all to `fallbackSvg(msg)`); `gateProportions(metrics) → {verdict: "pass"|"warn"|
"fail", findings}`; `renderViews(...)`; `buildManifest(...)`. `renderControls` is v0.2 —
file `render/controls.ts` reserved, not created.

**cli** — verbs per 08 §3; `buildSchemaDoc()` and `explain()` are pure and exported
(verb ↔ library byte-equality is the `A-STATE-VERB` pattern). `cli/args.ts` implements
flag-over-file merge; `cli/deferred.ts` holds the ONE deferred-token table.

---

## 6. Cross-cutting laws

### 6.1 Frame, units, angles
- World frame: **x east, y down** (screen frame); `+kappa` = right-hand turn; `phi`/
  `cmd_lean` positive = right lean; road offset `d` positive **to the rider's left**;
  `handSign("R") = +1` — defined once in `core/units.ts`; occluder `sideSign` in
  `road/corridor.ts` imports it. SVG export needs no vertical flip.
- **Internal math is SI + radians.** The internal `State` carries `psi`, `phi` in
  radians; every 02 formula runs in rad/s. The **`Sample` record stores angles in
  degrees** (`psi`, `phi`, `cmd_lean` deg; `roll_rate`, `su_*` deg/s) exactly per 05
  §2.1. Conversion happens in exactly one file: `core/record.ts`. Profiles carry
  `roll_rate_dps`; `roll_rate_eff = min(...)` is taken in deg/s, converted once via
  `core/units.ts` where formulas need rad/s.
- Display units (km/h, formatted degrees) are computed only at `derived`/emission/CLI
  layers. Book US-unit claims are judged by conversion (×1.609, ×0.3048), never string
  match.

### 6.2 Determinism (D29, D38)
No `Date.now`, `Math.random`, `process.env`, locale APIs, or map-iteration-order
dependence anywhere in `src/` except `cli/main.ts`/`cli/bless.ts` (wall-clock for the
bless date stamp only). Arrays ordered by `s` or declaration order. Identical scenario
JSON → byte-identical envelope on every platform (`P-DETERMINISM`,
`P-EXPORT-DETERMINISM`). The (v2, deferred) jitter RNG lives in `cli/` only.

### 6.3 Hashing (pinned algorithm)
- `canonicalize(v)`: JSON with recursively lexicographically sorted object keys (UTF-16
  code-unit order), arrays in order, no whitespace, `undefined`-valued keys omitted,
  `-0` normalized to `0`, non-finite numbers → `INTERNAL`. Numbers serialize via
  ECMAScript `JSON.stringify` (shortest round-trip).
- `fnv1a(s)`: **32-bit FNV-1a** (offset `0x811c9dc5`, prime `0x01000193`) over the UTF-8
  bytes of `s`; render as 8 lowercase hex chars; take the **first 6**.
- `spec_hash = fnv1a(canonicalize(lowered FigureSpec))` — covers `road_spec`, every
  line's `source`, authored `expect`; excludes `engine_semver`, `expected`, `solved`.
- `result_hash = fnv1a(canonicalize({verdict: V′, plan}))` where V′ = verdict minus
  `{result_hash, diagnosis}` and the full exclusion set is `{result_hash, diagnosis,
  cache, skew, commitment}` (D29 + D45); `plan` = `resolved_scenario.rider.plan`
  (+ `rider.roll_rate_cap_dps` when present).
- **Rounding is INSIDE the hash input** (resolves 05's ambiguity): `solve/emit.ts`
  rounds the verdict (2 dp metres/km-h/degrees, 3 dp fractions, 1 dp apex pct, via
  `Number(x.toFixed(dp))`, `-0→0`) and the hash is computed over that rounded canonical
  verdict — so a rounding-policy change moves hashes and is a re-bless event, exactly as
  05 §8.3 requires. Golden fixtures store raw f64 via a bless-only tap **before**
  emission rounding; goldens compare raw against `test/fixtures/tolerances.json`.

### 6.4 Phase-gating law (D8/D37)
The printed `schema` is the phase. One table, `cli/deferred.ts`, is the single source
for both `schema` omission and `SCHEMA`+`deferred` rejection (checked at the verb level
**before** flag parsing). v0.1 table:

| Token(s) | `deferred` string |
|---|---|
| verbs `state`, `serve`, `sweep`, `save-window`; flags `--standing`, `--scan-ds` | `"inspection (v0.2)"` |
| verb `compare`; `pov` render target; `--look` / `look=` | `"immersion (v0.3)"` |
| `view.mode = "diagram"`, `width_exag`, `straight_compress`, `taper_compress` | `"projection (post-v0.1)"` |
| verb `commitment`; `--commitment`, `--prior`, `view.fan`; token `brake_reserve_escape` | `"continuation envelope (D45)"` |
| `--jitter*` | `"ensembles (v2)"` |
| verb `fit` | `"fit (post-v1)"` |

Struck names (`out_available`, `sight_ok`, `SIGHT_MARGIN_ROB`, `commit_within_sight`)
and renames (`early_apex`→`premature`, `sight_vs_stopping`→`stop_within_sight`) are
`UNKNOWN_ID` tombstones (`struck_by_decision` / `renamed_kind` / `renamed_check`) —
**never** `deferred`. Nothing is ever accepted-and-ignored (`INEFFECTUAL` for legal-but-
inert values).

### 6.5 The six book-figure bakes under v0.1 (resolves the mode=diagram conflict)
The committed scenes (`../figures/*.scene`) author `view: mode=diagram`. Under v0.1 the
token `diagram` rejects `SCHEMA`/`deferred` — this is correct and stays. The v0.1 bake
uses the **flag-over-file merge law** (08 §4.2): CI bakes each scene as
`linelab figure <scene> --mode true`, composing to a valid v0.1 input; the proportion
gate runs on the `true`-mode exports (00 §3's v0.1 exit gate wins over 09 §10's
diagram-mode line, which lands with the projection). `window=auto` is pinned as a legal
explicit spelling of the §2.4 auto-window default: `ViewSpec.window: "auto" | "all" |
{from, to}`, default `"auto"`. `orient` ships in v0.1 (explicit `0|90|180|270` honored;
`auto` resolves to 0 in true mode) because fig-08-06 pins `orient=90`.
v0.1 `project()` therefore implements: identity transform, auto-window computation,
explicit-window crop, orient rotation, aspect-floor padding — **no** compression,
width_exag, or degradation machinery.

### 6.6 Constants discipline
Every named constant is declared in exactly **one** `constants.ts` (module = its
design-doc owner: 02→core, 03→road/sight/plan, 04→solve, 06→render, 08→cli). Check
thresholds (01 Appendix A) are **pack data** in `parks-street.json`, not code constants.
Cross-module use imports; re-declaring a literal is a review-rejectable offense.
Unnamed design literals get local names without TUNING status: `SUGGEST_TOPN = 4`,
`DA_GRID_N = 5`, `DA_TI2_HALF_F = 0.15`, `ROLLON_GUARD_M = 1.0`.

---

## 7. test/ layout — 09 gate map (v0.1)

| Directory / file | Gates hosted |
|---|---|
| `test/meta/imports.test.ts` | module DAG, purity lint, no-RNG/no-clock, one-engine precursor of `C-ONE-CORE` |
| `test/hash/hash.test.ts` | fnv1a/canonicalize vectors, rounding policy |
| `test/hash/tripwire.test.ts` | §3.3 tripwire: recompute `spec_hash`/`result_hash` for every committed preset/scenario/FigureSpec stamp |
| `test/analytic/an.test.ts` | `A-AN-RADIUS`, `A-AN-BRAKE`, `A-AN-ROLL`, `A-AN-RK4`, `A-AN-SAVE-POLICY`, `A-AN-SOLVER-KISS`, `F-AN-NEARUPRIGHT` (fixtures as ResolvedScenario literals — no `validate` dependency) |
| `test/analytic/bounds.test.ts` | `D-BOUNDS` (C30 a-priori pins) |
| `test/analytic/bless.test.ts` | `A-BLESS-REFUSES`, `T-BLESSED-DOC-SYNC` |
| `test/golden/*.test.ts` | `C30` family (C30, C30-LR, C30-chop, C30-trailbrake, C30-squeeze, C30-heldbrake, C30-deeplean, C30-stop, C30-chop-sweep, C30-DR), `book90-ideal`, `G-CORR-RUNOFF/WIDE`, `G-OFFROAD-BRACKET`, `G-STOPPED`, `G-POS-REACH`, `G-MISJUDGE-DR`, `G-8.5-RED`, `G-8.4-COMPANION`, `G-APEXLIST`, `G-PRESET-HANDS`, `G-SIGHT-BASIS`, `G-C30-CHECKVECTOR`, `G-POV-CLAMP-MIDCORNER` (fixture), `G-CF-PRECONDITION-TABLE` |
| `test/property/physics.test.ts` | `P-ELLIPSE`, `P-KAPPA`, `P-UNWIND-*`, `P-STEER-OWNER`, `P-MIRROR`, `P-ROLLRATE(-EXCESS)`, `P-RUNWIDE-*`, `P-TRAILBRAKE-TIGHTENS`, `P-AWIDEN-SIGN`, `P-SLEW`, `P-SSD-LEAN`, `P-VALIDITY-FLAG`, `A-SU-ZERO-WHEN-GENTLE` |
| `test/property/termination.test.ts` | `P-TERMINATED-CLOSED`, `P-EVENT-BRACKET`, `P-RESAMPLE`, `P-EMERGENT-APEX` |
| `test/property/corrective.test.ts` | `P-CORR-PURE`, `P-CORR-SHADOW-HONEST`, `P-CORR-CONSTANT-SPEED`, `P-ENDPOINT-IN-FRAME`, `P-CF-PRECONDITION`, `P-CF-LITERALISED`, `P-COUNTERFACTUAL-CLOSED/NAMED`, `A-CF-REGISTRY-CLOSED`, `A-CF-DEAD-REASON` |
| `test/property/determinism.test.ts` | `P-DETERMINISM`, `P-EXPORT-DETERMINISM` |
| `test/property/solver-core.test.ts` | `P-CONSTRAINT-BINDING` (R6), `P-ACCEPT-MONOTONE/GRADE/CONSTRAINT` (F-CONSTRAINT-HARD), `P-APEX-TARGET-TYPED`, `A-SOLVER-FIT`, `A-SOLVED-PLAN-VALIDATES` |
| `test/property/solver-ext.test.ts` | `P-VIS-MARGIN-MONOTONE`, `P-VIS-SELFCHECK`, `P-VIS-BOUNDED` (+`FX-VIS-FLOOR`/`FX-VIS-UNSAT`), `A-SSD-GOVERNOR` (vis_margin=1.4 pin), `A-VIS-HOLD-REACH` (OPEN — must first assert a hold was generated), `A-CHAIN-VIS-FULL/BUDGET` (fx-chain-blind), `A-LINK-FLIP`, `A-DOUBLEAPEX`, `P-MISJUDGE-PREFIX/IDENTITY`, `P-SIGHT-*`, `F-SIGHT-OUTSIDE` |
| `test/oracle/oracle.test.ts` | pin-table oracle over `F-ORACLE-90/DR/CHAIN`, `O-CHAIN-PREMATURE`, `A-SU-ATTRIBUTION`, `A-MISTAKE-FAILS-CHECK`, `A-QS-TWOSIDED`, `A-RENAME-REJECTED`, `ORACLE-PIN-TABLE` single-sourcing |
| `test/oracle/rubric.test.ts` | `A-CATALOGUE-RESOLVES/EXERCISED`, `A-CHAIN-GREEN`, `A-RUBRIC-STAMP`, `A-DANGER-DWELL`, `A-PACK-PROVENANCE` (scans `plan/doctrine/packs/` + `plan/continuations/packs/`), `P-OUTCOME-RUBRIC-FREE`, `P-QUALITY-TOTAL` |
| `test/contract/validate.test.ts` | plan validation suite, position reachability worked numbers, error-vocabulary reachability (09 §8 no-dead-error-names for v0.1 codes) |
| `test/contract/wire.test.ts` | `C-TREND-WINDOW`, `C-RAW-RETENTION`, `C-PHASE-TOTAL`, `C-COLOUR-DERIVE`, `C-SCENE-MULTIRIDE`, `C-REFUSAL-ENVELOPE`, `C-OCC-TOKEN`, `C-SKEW-DETECT/CLEAN/NEVER-BLOCKS`, `C-SAVEWIN-NO-INK` (v0.1 trivial sentinel) |
| `test/render/ink.test.ts` | `P-PROJ-IDENTITY` (P6, incl. window = identity ∘ crop), `P-MARKS-EVENTS`, `P-INK-GRAMMAR`, `A-FIG82-SINGLEMARK`, `A-FIG83-MARKS/TOPOLOGY`, `A-LABEL-ANCHORS`, `A-ANCHOR-ERRORS`, `A-LEGEND-AMBER`, marker-collapse golden |
| `test/render/gate.test.ts` | proportion gate on all six baked scenes (true mode), `A-ESSES-GATE` (orient=90 manifest pin; true-mode leg), `A-FIG81-ENDPOINT`, `T-JUDGE-RECORD` (record present + hashes/identity match) |
| `test/cli/recipes.test.ts` | `A-RECIPE-A/B/E/F` (v0.1 gates; D/I/J authored as available), commands extracted verbatim from design/08 §6 |
| `test/cli/schema.test.ts` | `A-SCHEMA-SHAPE/JSON`, `A-FLAG-MAP`, `A-IMPORT-SURFACE`, `A-EXIT-DECLARED`, `A-GATE-FIGURE`, `A-EXPLAIN-KIND`, `A-CORR-EXPLAIN` (substring "lean-only rider"), `A-MISTAKE-GRAMMAR/SUGAR`, `A-RESOLVED-RERUN`, `A-FIGURE-JSON-PARITY`, `A-HAZARD-FLAG`, `A-FULLWIDTH`, deferred-token rejections |
| `test/effectuality/d8.test.ts` | `T-D8-EXHAUSTIVE` over the v0.1 schema, `T-POS-EFFECT/INEFFECTUAL/OVERLAP/SHORTFALL` + mandated rows; `effectAt` lives beside `verify/effectuality.json` |

`fixture_geometry.py` (in `../review/verify/`) is the independent cross-check: golden
and solver tests must reproduce its published numbers (L_req, blind sweeps, ssd, reach).

---

## 8. Build order — v0.1 work packages (one agent each; file ownership is exclusive)

A package may only be started when its dependencies are DONE. DONE always includes
`npm run typecheck` green plus the named tests green. No two packages touch the same
file; `src/index.ts` is stubbed by WP-00 and thereafter owned solely by WP-15.

| WP | Files owned | Depends on | DONE means |
|---|---|---|---|
| **WP-00 scaffold** | `package.json`, `tsconfig.json`, `vitest.config.ts`, `src/index.ts` (stub), `test/meta/imports.test.ts` | — | typecheck; meta test runs (DAG rules encoded, trivially green) |
| **WP-01 core-base** | `src/core/{result,types,constants,units,hash}.ts`, `test/hash/hash.test.ts` | WP-00 | hash vectors green; types compile; EventKind enumeration test vs design/05 §5 |
| **WP-02 road** | `src/road/*`, `test/property/road.test.ts` | WP-01 | DSL round-trip identity; corner records incl. `linked_next`; super-tight refusal (bookEsses passes, `R 10 ^180` refuses); truncateAt split rules; preset table matches design/03 §3.1 byte-for-byte |
| **WP-03 sight** | `src/sight/{constants,footprints,cast,ssd}.ts`, `test/property/sight-unit.test.ts` | WP-02 | sightFrom first-blocked semantics; ssd upright reduction + monotonicity; numbers cross-checked vs `fixture_geometry.py` |
| **WP-04 core-engine** | `src/core/{controller,steering,slice,integrate,events,resample,record}.ts`, `test/analytic/an.test.ts`, `test/analytic/bounds.test.ts`, `test/property/physics.test.ts`, `test/property/termination.test.ts` | WP-02, WP-03 | full analytic layer `A-AN-*` green (pre-bless, D35); `D-BOUNDS` green; 02 §5.4 invariants 1–6 green |
| **WP-05 plan-validate** | `src/plan/{types,constants,anchors,placements,validate,mistakes}.ts`, `test/contract/validate.test.ts` | WP-02 | validation suite incl. position reachability worked numbers (book90: `f 0.5→0.9` rejected on 12 m straight); every 03 §6.2 reason token reachable |
| **WP-06 doctrine** | `src/plan/doctrine/**`, `src/plan/continuations/packs/street.json`, `test/oracle/rubric.test.ts` | WP-05 | pack loads + annex validates; `A-PACK-PROVENANCE`; per-check unit tests vs 01's worked numbers (check 4 steer_share table); `P-QUALITY-TOTAL`; `P-OUTCOME-RUBRIC-FREE` (stubbed outcome inputs) |
| **WP-07 analyzers** | `src/core/analyze.ts`, `src/sight/analyze.ts`, `test/contract/analyze.test.ts` | WP-04 | ONE apex detector produces rows + events; sight_ride_m rebase; hazard_visible; danger_dwell_s bracketed-crossing rule |
| **WP-08 counterfactual** | `src/solve/{counterfactual,corrective}.ts`, `test/property/corrective.test.ts` | WP-07 | full D42 gate list (`P-CF-*`, `P-COUNTERFACTUAL-*`, `P-CORR-CONSTANT-SPEED`, `A-CF-*`); `shadow_stopped` absent in both directions |
| **WP-09 verdict-envelope** | `src/solve/{types,verdict,emit,envelope,run,gate}.ts`, `test/contract/wire.test.ts`, `test/hash/tripwire.test.ts` | WP-06, WP-08 | verdict assembly on hand-built trajectories; result_hash exclusion set; skew tiers; cache-load semantics; `gateFigure` E(line) table; `run` delegate rule |
| **WP-10 solver-core** | `src/solve/{constants,stations,suggest,solve,merge,accept}.ts`, `test/property/solver-core.test.ts` | WP-09 | derived-station worked numbers (book90 sweep `[6.0, 16.71]`, C30 clamps); probe/bisect/self-verify pipeline solves C30 + book90 clean; merge contract; accept ranking |
| **WP-11 solver-ext** | `src/solve/{chained,doubleApex,vis,believed}.ts`, `test/property/solver-ext.test.ts` | WP-10 | chainedSolve on bookEsses; double-apex two-touch on bookDoubleApex; vis=cautious self-check on reshaped bookBlind; believed-road pipeline + s_div exactness |
| **WP-12 mistake** | `src/solve/mistake.ts`, `test/oracle/oracle.test.ts` | WP-11 | mistake oracle green over `F-ORACLE-90/DR/CHAIN` for all 8 kinds; `O-CHAIN-PREMATURE` |
| **WP-13 figure-scene** | `src/plan/{scene,figure}.ts`, `test/cli/scene.test.ts` | WP-05 | lowerScene pure/total/deterministic on all six scenes; specHash on lowered form; `A-FIGURE-JSON-PARITY` |
| **WP-14 render** | `src/render/**`, `test/render/ink.test.ts` | WP-09, WP-13 | P6 identity+crop; draw order; markers/labels/legend/ink grammar; gateProportions unit-tested; never-throw wrapper |
| **WP-15 cli** | `src/cli/**` (except `bless.ts`), `src/index.ts` (final), `test/cli/recipes.test.ts`, `test/cli/schema.test.ts` | WP-12, WP-14 | verbs `run solve mistake figure render check schema explain export`; exit tiers; deferred table; recipes a/b/e/f; `A-SCHEMA-SHAPE`, `A-IMPORT-SURFACE` |
| **WP-16 bless+verify** | `src/cli/bless.ts`, `verify/*.json`, `test/analytic/bless.test.ts`, `test/effectuality/d8.test.ts`, `test/fixtures/tolerances.json` | WP-15 | `A-BLESS-REFUSES` both arms; `T-BLESSED-DOC-SYNC`; D8 harness (`T-D8-EXHAUSTIVE`) over the printed v0.1 schema |
| **WP-17 first-bless + figures** | `test/golden/*.test.ts`, `test/property/determinism.test.ts`, `test/render/gate.test.ts`, `figures/*` (bake outputs), the bless commit | WP-16 | first bless executed (analytic gate green → goldens + 02 §8.1 block + stamps written); all six scenes bake via `figure <scene> --mode true`; proportion gate green in true mode; `T-JUDGE-RECORD` scaffold; `P-DETERMINISM`/`P-EXPORT-DETERMINISM`; full v0.1 gate list green in one CI run, recorded in the phase-exit commit message |

Parallelism: WP-02/WP-03 after WP-01; WP-04 and WP-05 in parallel; WP-06/WP-07 in
parallel; WP-13 runs parallel to WP-08–WP-12; everything funnels at WP-15.

---

## 9. Drift risks — pinned resolutions

1. **Degrees vs radians.** Internal radians, record degrees, one conversion file
   (`core/record.ts`), one helpers file (`core/units.ts`). Any formula touching
   `roll_rate` converts via the helper — never inline `* Math.PI / 180`.
2. **Hash vs rounding order.** Rounded verdict is the hash input (§6.3). Goldens compare
   raw f64 via the bless tap. Getting this backwards breaks re-bless discipline.
3. **Two colour laws.** `quality()` exists once, `plan/doctrine/quality.ts`; 06 §5.1 and
   05 §6.1 are the same law; render imports it.
4. **Two apex detectors.** One pass in `core/analyze.ts` feeds both `corners[].apexes[]`
   and `apex` events; the double-apex touch filter (solve) reads the *recorded* list.
5. **Error-shape divergence.** One `Result`/`LinelabError` in `core/result.ts`; reason in
   `detail.reason` (NO_SOLUTION: `detail.sub_reason`); codes are the closed 8-set.
6. **Second engine / import cycles.** Linear module order (§2) enforced by
   `test/meta/imports.test.ts`; only `core/integrate.ts` steps physics.
7. **mode=diagram scenes vs v0.1 gating.** Bake with `--mode true` (flag-over-file);
   scenes unchanged; the deferred rejection stays live for un-overridden input.
8. **Constant re-declaration.** One `constants.ts` per owning module; check thresholds
   are pack data. Duplicated literals are review-rejected.
9. **`f` interpolation.** `f` is recomputed from the corridor algebra at resample and at
   `stateAt` — never lerped independently; boolean flags OR per bracket.
10. **`ssd` restatement.** One definition in `sight/ssd.ts`; check 10, the V1 governor,
    and the per-sample channel import it; comparisons use `sight_ride_m` (D16), with
    `sight_m` reserved for rendering/comparability/trend.
11. **Sign conventions.** `handSign` and `sideSign` each defined once; y-down pinned;
    `P-MIRROR` and preset-hand goldens are the tripwires.
12. **Vocabulary paraphrase.** Closed sets (event kinds, outcomes, phases, mistake
    kinds, check ids, error codes, statuses) are copied verbatim from the design docs
    into single `const ... as const` declarations with enumeration tests — never retyped
    from a brief.

---

## 10. Resolved judgment calls (chosen, binding)

1. NodeNext + `.js` import extensions (§1). — 2. 05's result-contract code homes:
`stateAt`/phase machine/interpolation → `core/stateAt.ts` (v0.2); verdict/envelope/
hashing/skew → `solve/`; `CheckResult` → `plan/doctrine/types.ts`. — 3. `ssd` lives in
`sight/`; `muAt` in `road/corridor.ts`; `hazard_visible` analyzer in `sight/analyze.ts`.
— 4. `lowerScene` + FigureSpec live in `plan/` (inputs), spec_hash beside them. —
5. Reservation reason tokens minted: `traffic_reserved`, `segment_width_reserved`. —
6. Segment-authored roads get `dsl` filled by `printRoadDSL(spec)` in the resolved form.
— 7. `truncateAt` builds in v0.1 (road-layer primitive, 03 §7a.11). —
8. `rider.start.speed_kmh` is required, no default (`SCHEMA` if absent). — 9. Position
windows are half-open `[at_s, at_s + over_m)`, so an `over_m:"auto"` window ending at a
turn_in's `at_s` does not overlap the commitment window. — 10. `phi_dot_su` has **no**
`a_clip` dependence — the 02 §5.2 formula is normative; per-stage variation enters via
`sign(phi)`/`tanh` only; `b_dem` uses the step's ZOH `a_cmd`. — 11. Release-predicate
`v_eff` uses the most recent completed step's `a_clip`. — 12. HUD `a_widen_ms2` uses
`c = 1` (fighting rider) — v0.2, pinned now. — 13. `freeze_steer_s` mistake default is
1.0 s, owned by the 03 §7.1 pin table. — 14. `gripMargin(aLong, aLat, mu)` is the
three-argument form. — 15. `v_target` in `decel_min_fit` = `speedForLean(r_min(corner),
lean_frac · phiReserve(mu_use))`; a non-positive denominator folds into
`road_too_short/brake_run`. — 16. Believed-road (`misjudge`) solving ships in v0.1 (04's
phase map; fig 8.5 needs it). — 17. `vis=cautious` ships in the v0.1 schema (09 §3.5 is
a v0.1 section); `A-VIS-HOLD-REACH`/`A-SSD-GOVERNOR` carry their OPEN/pinned states from
09 §3.5. — 18. `schema <unknown-section>` → `SCHEMA`, message listing the closed section
list. — 19. Verb-level phase gating is checked before flag parsing. — 20. `--rubric`'s
sole legal value is `parks-street`; any other name → `SCHEMA`. — 21. `--checks-version`
naming anything but `2` → `SCHEMA`, message naming both versions (mirrors the pack rule).
— 22. `sweep` grid truncation keeps the first `sweep_max_cells` cells in row-major
(param-1 outer) order — documented in `schema sweep` (v0.2). — 23. `sweep --format tsv`
writes one file at `--out` (v0.2). — 24. Standing has no viewer surface (CLI/JSON only);
the corrective-ghost toggle is v0.2 with the stepper. — 25. Tolerance table at
`test/fixtures/tolerances.json`. — 26. `C30-DR` is in the golden roster (02 §8 defines
it) and in the blessed block. — 27. Analytic fixtures are constructed as
`ResolvedScenario` literals in tests (no `validate` dependency), per 09 §3.2a's
raw-pre-emission reading. — 28. Judge/coldstart records: identities in `verify/`,
per-figure judge records at `figures/<figure_id>.judge.json` beside the baked SVGs;
scene sources remain `../figures/*.scene` (design of record, read-only).
