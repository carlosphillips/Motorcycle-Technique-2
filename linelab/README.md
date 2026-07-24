# linelab

linelab is a deterministic, dependency-free TypeScript engine that simulates
a motorcycle riding a road: it takes a road (an arc/straight DSL or a preset)
and a rider plan, integrates real single-track physics (RK4 over a
friction-ellipse/steering-state model — commit → track → hold → unwind),
grades the resulting line against a rubric of Total Control-style riding
checks (late apex, quick-steer, trail-brake, sight-line discipline, and 11
more), and renders the outcome as a proportion-gated top-down SVG. It is
built to answer questions like "does turning in early on this esses actually
run you wide at the third corner?" — precisely, reproducibly, and byte-for-
byte the same on every run of the same JSON.

## Install / build / test

```sh
cd linelab
npm install          # dev deps only — zero runtime dependencies, ever (D1)
npm run build         # tsc -> dist/
npm run typecheck     # tsc --noEmit
npm test              # vitest run — 981 passed, 4 todo (v0.1 exit state)
```

`npm run cli -- <verb> ...` runs the built CLI, but npm's own banner lines
land on stdout ahead of the JSON — for piping/parsing, invoke the built
binary directly: `node dist/cli/main.js <verb> ...`. Every example below
uses that direct form and was run against the current build to produce the
output described.

## The nine verbs

Every verb speaks JSON on stdin/stdout/files and returns
`{ok:true,value:...}` or `{ok:false,error:{code,at,message,detail}}` — never
throws, never prints anything else. Exit code mirrors `ok` (0 for success;
2/3/4 for usage/refusal/internal — see `design/08 §3.1`).

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
linelab render fig81.json --views topdown --mode true --out renderout/
```
Takes the envelope written by `run`/`solve`/`figure` and produces the SVG
independently of the solve step.

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

## The six baked book figures

All six bake successfully (`figure <scene> --mode true`) and are committed
under `figures/`. "Bake exit" is the CLI's declaration-gate exit code (0 =
green, 3 = refused lines present in the bake); "judge" is the independent
visual-rubric verdict over the rendered SVG, re-judged after the render fixes
below (see `DEVIATIONS.md` for the per-figure breakdown of what the judge
still finds missing — every figure fails at least the diagram-mode
disclosure-note criterion, which isn't implemented in v0.1's renderer yet).

| id | book figure | bake exit | judge verdict | still-failing criteria (majority) |
|---|---|---|---|---|
| `fig-08-01` | Fig 8.1 — premature turn point | 0 | fail | J2 marker glyph, J6 disclosure note |
| `fig-08-02` | Fig 8.2 — slow steering | 0 | fail | J6 disclosure note |
| `fig-08-03` | Fig 8.3 — fifty-pencing | 0 | fail | J2 marker glyph, J6 disclosure note |
| `fig-08-04` | Fig 8.4 — decreasing radius entered too fast | 0 | fail | J2 marker glyph, J5 mistake legibility, J6 disclosure note |
| `fig-08-05` | Fig 8.5 — the double apex | 3 (all lines refused — see `DEVIATIONS.md` `adj-doubleapex`) | fail | J1/J2/J3/J5/J6/J8 (entire line/mark/label layer absent) |
| `fig-08-06` | Fig 8.6 — the esses | 3 (chain grades caution, not the designed green) | fail | J6 disclosure note |

## Phase status

**v0.1 (this release): shipped.** Full engine spine — `core/ road/ sight/
plan/ solve/` — plus `render/` topdown (true-mode), all 9 CLI verbs, the
D42 counterfactual layer, and the six book-figure bakes. Test suite: 981
passed, 4 todo, across 28 files; `npm run typecheck` clean; first bless
committed (goldens in `test/fixtures/goldens/`, blessed block in
`design/02-physics-model.md §8.1`). See `DEVIATIONS.md` for every place the
shipped engine reads differently than the design letter, and what each one
needs from the design owner.

**v0.2 (pending):** the `viewer/` package, `stateAt`/phase-machine
interpolation, `state`/`serve`/`sweep`/`save-window` verbs, standing reports,
diagram-mode compression, and the diagram-mode disclosure-note draw stage
flagged in `DEVIATIONS.md` (the one rendering gap the D36 re-judge still
finds on every figure — role-based line draw order, occlusion-wash scoping,
and gravel/occluder glyphs were fixed this cycle, see `DEVIATIONS.md`
design/06).

**v0.3 (pending):** `compare`, POV rendering, immersion features.

## Where to go next

- **`ARCHITECTURE.md`** — the binding v0.1 contract: module graph, directory
  layout, type ownership, cross-cutting laws (frame/units, determinism,
  hashing), the work-package build order, and the drift-risk/judgment-call
  registers this codebase was built against.
- **`DEVIATIONS.md`** — the complete ratification queue: every deviation
  from the design-of-record letter, grouped by design doc, with status
  (`adjudicated-fixed` / `implemented-invariant-first` / `pinned-engine-truth`
  / `needs-decision`) and a pointer to the test that pins it.
