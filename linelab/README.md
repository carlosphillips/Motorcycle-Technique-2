# linelab — v1.0

**Status: v1.0 CLOSED.** All three phases shipped — v0.1 (figure spine), v0.2
(inspection), v0.3 (immersion). Every gate green in two consecutive full runs;
G1–G9 all hold. See `V03-GATES.md` for the gate tally and `DEVIATIONS.md` for
the ratification record.

linelab is a deterministic, dependency-free TypeScript engine that simulates
a motorcycle riding a road: it takes a road (an arc/straight DSL or a preset)
and a rider plan, integrates real single-track physics (RK4 over a
friction-ellipse/steering-state model — commit → track → hold → unwind),
grades the resulting line against a rubric of Total Control-style riding
checks (late apex, quick-steer, trail-brake, sight-line discipline, and 11
more), and renders the outcome three ways — a proportion-gated top-down SVG, a
per-line controls strip, and a first-person **POV** with the limit point marked
and occlusion visible. It is built to answer questions like "does turning in
early on this esses actually run you wide at the third corner?" — precisely,
reproducibly, and byte-for-byte the same on every run of the same JSON.

## Install / build / test

```sh
cd linelab
npm install          # dev deps only — zero runtime dependencies, ever (D1)
npm run build         # tsc -> dist/
npm run typecheck     # tsc --noEmit
npm test              # vitest run — 50 files, 1357 passed, 4 todo, 0 red (deterministic)
```

`npm run cli -- <verb> ...` runs the built CLI, but npm's own banner lines
land on stdout ahead of the JSON — for piping/parsing, invoke the built
binary directly: `node dist/cli/main.js <verb> ...`. Every example below
uses that direct form and was run against the current build to produce the
output described.

## The verbs

Every verb speaks JSON on stdin/stdout/files and returns
`{ok:true,value:...}` or `{ok:false,error:{code,at,message,detail}}` — never
throws, never prints anything else. Exit code mirrors `ok` (0 for success;
2/3/4 for usage/refusal/internal — see `design/08 §3.1`).

The nine v0.1 verbs are documented below. **v0.2 adds four inspection verbs**:
`state <envelope> --s|--t` (the full `stateAt` instant — every HUD value reads
from it), `serve <envelope>` (the pure viewer session, no socket), `sweep`
(per-cell pipeline recompute over a parameter grid), and `save-window
<envelope> --line <id> [--corner <id>]` (the D44 reserve-lean save window:
`status ∈ {resolved, open_at_end, never_open, intermittent, not_applicable}`
plus `tau_close_s`/`reaction_budget_s`, byte-equal to the library `saveWindow`).
**v0.3 immersion adds the `compare` verb** (documented below), the **`pov`**
render target + viewer view, and the **`--look <heading|limit_point>`** camera
flag — 14 verbs and three views (`topdown`, `controls`, `pov`) in total.

### `run` — compose a road + plan, simulate every declared line
```sh
linelab run --road "lane 3.5 | S 20 | R 25 ^90 | S 25" --entry 48 --turn-in auto
```
Returns the full envelope: composed road, every line's trajectory samples,
verdict, and doctrine checks. (The design doc's own example speed of 55 km/h
has an empty feasible band on this engine's tuning — see `DEVIATIONS.md`
design/02 §8 — 48 km/h is used here as a verified-solving substitute.)

### `solve` — the same pipeline, solver-authored lines only
```sh
linelab solve --road "lane 3.5 | S 20 | R 25 ^90 | S 25" --entry 48 --turn-in auto
```
Identical shape to `run`, scoped to solver-composed lines (no scene/mistake
overlay).

### `mistake` — compile a named riding error against a base line
```sh
linelab run --road "lane 3.5 | S 20 | R 25 ^90 | S 25" --entry 48 --turn-in auto \
            --mistake premature --out fig81.json
```
Adds a second, red-graded line riding the `premature` mistake (turn in too
soon) beside the green ideal line; writes the envelope to `fig81.json`.

### `figure` — bake a `.scene` file into an SVG + manifest
```sh
linelab figure figures/fig-08-01.scene --mode true --out out/
```
Lowers the scene, solves/compiles every declared line, renders topdown SVG,
and writes `out/out.svg` + `out/out.json` + `out/manifest.json` (proportion-
gate metrics + verdict). `--mode true` is required in v0.1 even though the
committed scenes author `mode=diagram` (diagram compression is deferred post-
v0.1 — flag-over-file merge composes a valid input; see ARCHITECTURE §6.5).

### `render` — render an existing envelope without re-solving
```sh
linelab render fig81.json --views topdown,controls,pov --mode true --out renderout/
```
Takes the envelope written by `run`/`solve`/`figure` and produces the SVG(s)
independently of the solve step. `--views` is any subset of the closed set
`topdown | controls | pov`. `pov` (v0.3 immersion) writes a first-person
`<figure_id>.pov.svg` — a pinhole projection of TRUE geometry with the limit
point marked and occluders extruded; `--look <heading|limit_point>` aims the
camera (default `heading`). (Per-station POV frame selection is the interactive
viewer's job — `serve` then step; the static render emits one default frame.
See `DEVIATIONS.md` design/07 §5.5 on `--at`/`--every`.)

### `check` — lint a scenario/scene/figure without solving
```sh
linelab check figures/fig-08-01.scene
```
Returns `{valid, spec_hash}` (or a typed rejection) — validates and hashes
without running physics.

### `schema` — print the machine-readable spec for a section
```sh
linelab schema scenario
```
Every closed vocabulary (wire fields, CLI flags, check ids, mistake kinds,
error codes...) is introspectable this way — `schema cli` for the flag
table, `schema` alone for the full document.

### `explain` — look up one check/error-code/mistake-kind's teaching text
```sh
linelab explain late_apex
```
Disambiguates automatically across the three vocabularies (checks, error
codes, mistake kinds) and returns the book reference, message, and scope.

### `export` — shareable artifact off a solved envelope
```sh
linelab export fig81.json --as envelope
```
`--as` is one of `share-url|trace-csv|svg|envelope|scenario|figure-spec`;
`svg` requires `--out <dir>`, the rest print to stdout (or `--out <file>`
for the non-svg forms via shell redirection).

### `compare` — diff two or more lines at shared stations (v0.3)
```sh
linelab compare geom.json vis.json --lock station
```
Recomputes every input through the one engine (D6 — never trusts shipped
trajectories) and emits per-line verdict deltas plus a station-aligned metric
diff (sight, speed, lean, grip) and an overlay figure. All inputs must resolve
to the SAME road; occluders/hazards may differ and are disclosed in
`world_delta`. `--lock station|time` chooses how paired lines align. Every
metric cell is that line's OWN `stateAt` — no cross-line leakage, no second
engine (C-COMPARE, C-ONE-CORE).

## The six baked book figures

Six book scenes live at `../figures/*.scene` (the design of record) and bake to
committed SVG + judge records under `figures/`. "Bake exit" is the CLI's
declaration-gate exit code (0 = green, 3 = refused/failing lines present).

**All six committed SVGs are CURRENT and all six D36 judge records grade overall
`pass`** (fig-08-03/04/05 were re-baked + re-judged; fig-08-01/02/06 were
re-judged green earlier — J6 projection-disclosure is `na` on true-mode bakes).
Every `re-bake is byte-identical` and `T-JUDGE-RECORD` arm is GREEN, and the
`fig-08-05` v0.1 test-lag reds (scene text, G-8.5-RED, proportion pins) have all
been re-pinned to the `adj-fig-08-05` amended reality — **zero figure-related
reds remain.** v0.3 moved no figure (a pure engine consumer): all six re-bake
byte-identical after this run.

| id | book figure | bake exit | committed SVG | judge |
|---|---|---|---|---|
| `fig-08-01` | Fig 8.1 — premature turn point | 0 | current | **pass** |
| `fig-08-02` | Fig 8.2 — slow steering | 0 | current | **pass** |
| `fig-08-03` | Fig 8.3 — fifty-pencing (6 inputs) | 0 | current (re-baked) | **pass** |
| `fig-08-04` | Fig 8.4 — decreasing radius entered too fast (`bad` → `wide`, `adj-fig84`) | 0 | current (re-baked) | **pass** |
| `fig-08-05` | Fig 8.5 — the double apex (`good` refuses `no_two_touch_line`; `late` solves `runoff`) | 3 | current (re-baked) | **pass** |
| `fig-08-06` | Fig 8.6 — the esses (chain grades caution) | 3 | current | **pass** |

## Phase status

**v0.1: complete.** Full engine spine — `core/ road/ sight/ plan/ solve/` —
plus `render/` topdown (true-mode), the nine v0.1 CLI verbs, the D42
counterfactual layer, and the six book-figure bakes. First bless committed
(goldens in `test/fixtures/goldens/`, blessed block in
`design/02-physics-model.md §8.1`).

**v0.2: shipped** (inspection). The `viewer/` package (session, stepper, HUD,
bookmarks, save-window + corrective-ghost overlays), `core/stateAt.ts`
(`stateAt`/`dualAt` interpolation + phase machine), the `state`/`serve`/`sweep`/
`save-window` inspection verbs, the D43 **standing** ladder, and the D44
reserve-lean **save window**. The v0.2 exit-gate tally is **26 GREEN / 0 RED**
(the `adj-recipe-c` amendment moved `A-RECIPE-C` from AMBER to GREEN; the
`fig-08-05` test-lag reds were re-pinned) — see `V02-GATES.md`.

**v0.3: shipped** (immersion) — **the v1.0 close.** The `compare` verb (per-line
verdict deltas + station-aligned metric diff + overlay, D6 recompute through the
one engine), the **`pov`** render target and viewer view (a first-person pinhole
of TRUE geometry — the limit point marked, occluders extruded, look toggle
`heading|limit_point`), and compare-mode top-down ghosts. `render/pov.ts` never
imports `render/project.ts` (C-POV-TRUE-GEOMETRY), and the viewer reads
`core/stateAt` — it never re-derives physics (C-ONE-CORE). v0.3 exit gates
(C-POV-LIMIT-CONSISTENT, C-POV-TRUE-GEOMETRY, C-COMPARE, per-view boot smoke) +
the full POV family (C-POV-LIMIT-ALWAYS, C-POV-LOOK, C-POV-OCCLUDE) + G9: **all
GREEN** — see `V03-GATES.md`.

**v1.0: CLOSED.** v0.3 complete with every gate green — the point design/00 L554
defines as v1.0, where G1–G9 all hold. `npm run typecheck` clean; full suite
**50 files / 1357 passed / 4 todo / 0 red**, run twice, deterministic (the
build race is eliminated — `vitest.config.ts` wires a `globalSetup` that builds
`dist/` once). The 4 `it.todo` are the documented `adj-doubleapex` two-touch
seams (design/04 §4.6). Design-letter items deferred to a future pass and
recorded in `DEVIATIONS.md`: diagram-mode compression + its disclosure note, the
POV red deficit band and POV ghost paths (need `stateAt.derived` wiring), and
static CLI POV `--at`/`--every` frame selection (the design's own "future
rasterizer seam", 07 §5.5 — per-station POV is delivered in the viewer today).

## Where to go next

- **`ARCHITECTURE.md`** — the binding v0.1 contract: module graph, directory
  layout, type ownership, cross-cutting laws (frame/units, determinism,
  hashing), the work-package build order, and the drift-risk/judgment-call
  registers this codebase was built against.
- **`DEVIATIONS.md`** — the complete ratification queue: every deviation
  from the design-of-record letter, grouped by design doc, with status
  (`adjudicated-fixed` / `implemented-invariant-first` / `pinned-engine-truth`
  / `needs-decision`) and a pointer to the test that pins it.
