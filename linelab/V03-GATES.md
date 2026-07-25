# V03-GATES.md — v0.3 (immersion) phase-exit gate sweep + v1.0 (G1–G9) inventory

Auditor run, 2026-07-24, then the **v1.0-close fix pass (2026-07-24, post-fix — this
file is now FINAL, post-fix reality).** Design of record: `../design/`. Normative gate
statements live in `design/09-verification-and-testing.md` §6 (the `C-*` contract tests)
and the phase-gates table §7 (L2374–2379); the v0.3 exit-gate SET is pinned in
`design/00-README.md` S3 (L551) and `design/09` L2378.

**Method.** For each gate: located its normative statement in `design/09`, found the
enforcing test, read the test body adversarially (looking for weaker-than-statement or
vacuous assertions), and RAN it. Then enumerated G1–G9 and ran the FULL suite + typecheck.

---

## 0. v1.0-close fix pass — what the audit found, and what was DONE (post-fix)

The audit + the concurrent adversarial review left the v0.3 build **coherent on the
merits but incomplete at the CLI seam**: `pov` was un-deferred at the render layer while
still refused on the `controls`-routed path (a "split-brain"), `--look` was still deferred
though `pov` shipped, and four v0.2/v0.1 tests still pinned the pre-immersion phase. This
pass RESOLVED all of it and closed v1.0. Every item below is landed and green in two
consecutive full runs.

| Finding (source) | Disposition | Where |
|---|---|---|
| **F1 (HIGH) — `pov` split-brain** (`render --views pov` rendered, `--views controls,pov` refused) | **FIXED** — the un-deferral is now COMPLETE. The whole `immersion (v0.3)` deferred row is retired (`compare`+`pov`+`--look` all shipped); `controls.ts`'s pov guard is deleted and it now composes `topdown`/`pov` via the one `render` verb. The phase decision for `pov` lives in exactly one place. | `cli/deferred.ts`, `cli/verbs/controls.ts`, `cli/verbs/render.ts` |
| **F2 (MED) — `--look` deferred though `pov` ships** | **FIXED** — `--look <heading\|limit_point>` is now a first-class `view.look` ViewSpec flag (design/08 §4.1 View group + 06 §2.1), un-deferred and wired; the CLI pov camera honours both aims. New schema field + two D8 effectuality witnesses (`view:look`, `cli:--look`). | `cli/args.ts`, `cli/doc/schema.ts`, `verify/effectuality.json`, `test/effectuality/d8.test.ts` |
| **F3 (MED) — CLI pov ignores `--at`/`--every`** | **DEVIATION (recorded)** — design/08 §3 lists `--at`/`--every` for the render verb, but design/07 §5.5 scopes STATIC CLI POV frame-sequence export as "a future rasterizer seam"; the interactive viewer (serve → step → pov) is the shipped per-station POV surface. Recorded under design/08 in DEVIATIONS. | DEVIATIONS.md |
| **F4 (LOW) — POV omits the red deficit band** (07 §5.3 item 5) | **DEVIATION (recorded)** — a faithful subset; the red band needs `stateAt.derived.ssd_station_m` threaded into the pure builder (a future stateAt-wiring pass). | DEVIATIONS.md |
| **F5 (LOW) — POV draw order (sight band before occluders)** | **DEVIATION (recorded, implemented-invariant-first)** — the code paints the 12%-opacity tint before the opaque occluder quads on purpose (a tint over an opaque occluder would contradict the occlusion invariant the stage exists to show). | DEVIATIONS.md |
| **4 stale phase-pins** (schema roster, serve leg-3, D8 `--lock`, ink pov-deferred) | **FIXED** — all four re-pinned to the shipped v0.3 phase. | `test/cli/schema.test.ts`, `test/cli/serve.test.ts`, `test/effectuality/d8.test.ts`, `test/render/ink.test.ts` |
| **Weak clause — C-POV-LIMIT-CONSISTENT two-views** (vacuous `if (ray != null)` on an unoccluded fixture) | **STRENGTHENED** — now uses the occluder-bearing `wallBlind` fixture so `project()` actually draws the topdown sight ray; the render-layer two-views equality FIRES (asserted `ray != null`). | `test/render/pov.test.ts` |
| **Weak clause — C-POV-OCCLUDE golden** (no `clamped` assertion) | **STRENGTHENED** — `expect(f.limit.markerState).toBe("clamped")` added (verified clamped at `s0+2`). | `test/render/pov.test.ts` |

Both runs after the pass: `npm run typecheck` **exit 0**; full `npx vitest run` **50 files
passed / 1357 passed / 4 todo / 0 failed**, TWICE (172.6 s, 174.8 s). No golden fixture, no
`result_hash`, and no baked figure SVG moved (verified: `test/golden/**`, `test/hash/**`,
`test/render/gate.test.ts` all green — the six figures re-bake byte-identical). v0.3 is a
pure consumer of the v0.1 engine, exactly as designed.

---

## 1. v0.3 exit-gate SET (design/00 S3 L551 · design/09 L2378)

The exit-gate row names four: `C-POV-LIMIT-CONSISTENT`, `C-POV-TRUE-GEOMETRY`,
`C-COMPARE`, per-view boot smoke tests — plus goal **G9**. The full POV gate family in
`design/09` §6 also includes `C-POV-LIMIT-ALWAYS`, `C-POV-LOOK`, `C-POV-OCCLUDE`; a
complete build satisfies all of them, so they are audited here too.

| Gate | Anchor | Enforcing test (file :: name) | Result | Notes |
|---|---|---|---|---|
| **C-COMPARE** | 09 L2005 | `test/cli/compare.test.ts` :: "C-COMPARE — each line's state equals its OWN stateAt; no cross-line leakage" (2 its) | **GREEN** | Strong. Independently recomputes BOTH lines (compare's own A-RESOLVED-RERUN) and asserts every station/time cell `== stateAt(THAT line)` field-for-field, AND a live no-leakage guard (`leakageGuardHit` must fire: where v_kmh differs the two cells must differ). Not vacuous. |
| **C-COMPARE** (viewer) | 09 L2005 | `test/viewer/compare.test.ts` :: station-lock / time-lock / freeze-at-terminal (9 its) | **GREEN** | Real 2-line envelope (good + `overspeed` mistake). Each ghost `== stateAt(that line)`; ghosts genuinely differ; freeze at each line's OWN terminal (07 §3.4); frozen+independent instants. Faithful. |
| **C-POV-LIMIT-CONSISTENT** | 09 L2014 | `test/render/pov.test.ts` :: "the POV limit-marker's WORLD source is the recorded (limit_x, limit_y) in BOTH look modes" + "at a line's first turn_in … one sightFrom result, two views" | **GREEN (strengthened this pass)** | POV world `== sample.limit_x/y` asserted UNCONDITIONALLY in both look modes. The "two views" clause was rebuilt on the occluder-bearing `wallBlind` fixture, so `project()` genuinely draws the topdown sight ray (it is `null` only on an unoccluded road); the test now asserts `ray != null` and `ray.to == POV limit world == recorded (limit_x, limit_y)` at the shared turn_in sample. The render-layer topdown-ray equality now FIRES (no longer guarded-out). Both layers prove the two-views claim. |
| **C-POV-LIMIT-CONSISTENT** (viewer) | 09 L2014 | `test/viewer/pov.test.ts` :: "the POV limit world is the recorded (limit_x, limit_y)" | **GREEN** | Ties it together: asserts `instant.derived.limit_point.{x,y} == instant.sample.limit_{x,y}` (derived.limit_point is topdown's sight-ray source) AND POV frame world `== sample.limit` in both look modes. This is the genuine "one number, two views" proof. |
| **C-POV-LIMIT-ALWAYS** | 09 L2018 (D40) | `test/render/pov.test.ts` :: "every POV frame of every fixture line carries exactly one marker, markerState ∈ {placed,clamped}, world = (limit_x,limit_y)" + SVG one-marker | **GREEN** | Iterates EVERY sample of both lines (solved + premature) × both look modes; `f.limit` defined, state in closed set, world == recorded, arrow present IFF clamped. SVG carries exactly one `data-marker="limit_point"`. Strong and exhaustive. |
| **C-POV-LOOK** | 09 L2022 | `test/render/pov.test.ts` :: "C-POV-LOOK (design/09 L2021)" (a/b/c) | **GREEN** | (a) `look=limit_point` → markerState=placed, yaw recomputed independently from camera law, agrees with `povYawDeg`, heading differs; (b) frames pure (byte-identical povFrame + SVG per look); (c) toggling look leaves result_hash/outcome/sample untouched and frame carries no hash. Faithful to all three clauses. Also asserted at viewer layer (`test/viewer/pov.test.ts`: look closed set, purity, POV-only). |
| **C-POV-TRUE-GEOMETRY** | 09 L2027 | `test/render/pov.test.ts` :: "POV consumes only true geometry" (structural + behavioural) AND `test/viewer/pov.test.ts` :: "the viewer POV path avoids the diagram-projection module" | **GREEN** | Structural: import-closure of `render/pov.ts` AND `viewer/pov.ts` proven NOT to reach `render/project.ts` (transitive scan). Behavioural: POV SVG byte-identical across orient 0/90/180/270, window=all, mode=true; control asserts `look` toggle DOES change it. Both halves of the letter enforced, at both layers. |
| **C-POV-OCCLUDE** | 09 L2031 | `test/render/pov.test.ts` :: "min heights ≥ eye + clear" + "a wall at the limit point is extruded and painted OVER the road" | **GREEN (tightened this pass)** | Static: `min(POV_OCCLUDER_HEIGHT_M) ≥ POV_EYE_HEIGHT_M + POV_OCCLUDE_CLEAR_M`, each kind individually. Golden: `wallBlind` fixture — wall extruded (quads>0), paint order road(stage2) < occluders(stage4) so road disappears behind wall, one limit marker with occluder present, AND `f.limit.markerState === "clamped"` (the marker's own witness that the road is fully occluded at that station, verified clamped at `s0+2`). |
| **per-view boot smoke** | 09 L1958 (§6) · 00 L551 | `test/viewer/viewer.test.ts` :: "every view the viewer offers renders once, without throwing" + `test/viewer/pov.test.ts` :: "every view renders once … topdown, controls, and pov all boot" + "pov boots even with NO cursor" | **GREEN** | `VIEWER_VIEWS == {topdown, controls, pov}` in layout order; `bootViews` returns 3 results, each `ok`, SVG well-formed (`<svg…</svg>`), never the "render failed" fallback card. POV boots with `instant:null` and still carries exactly one limit marker. Real recomputed session (D1 path). |
| **goal G9 — rider's-eye view** | 01 S2 L61–63 · 00 L551 | the whole POV family above (`test/render/pov.test.ts` 15 · `test/viewer/pov.test.ts` 8 · `test/viewer/viewer.test.ts` pov leg) | **GREEN** | "Every scenario renders a first-person POV at any sample, with the limit point marked and occlusion visible." Delivered: POV at any sample (LIMIT-ALWAYS iterates every sample), limit point marked (one marker/frame, D40), occlusion visible (C-POV-OCCLUDE wall golden). |

**Targeted run (foreground, all v0.3 gate tests, post-fix):**
`npx vitest run test/render/pov.test.ts test/viewer/pov.test.ts test/viewer/compare.test.ts test/cli/compare.test.ts test/viewer/viewer.test.ts`
→ all pass. Combined with `test/render/ink.test.ts` + `test/effectuality/d8.test.ts`
(the un-deferral + look-witness surfaces): **all green**.

**Verdict on the v0.3 exit-gate SET: all GREEN, with no weak clauses remaining.** No gate
is RED, and the one formerly-vacuous clause (C-POV-LIMIT-CONSISTENT render-layer
topdown-ray) now FIRES on an occluder-bearing fixture (see §0). The gate set is proven at
both the render and viewer layers.

---

## 2. Full suite + typecheck (v1.0 "every gate green" bar)

- **`npm run typecheck`** → **exit 0** (clean, no errors).
- **`npx vitest run`** (full, post-fix) → **50 test files passed / 1357 tests passed /
  4 todo / 0 failed**, run TWICE (172.6 s, 174.8 s) — byte-identical counts both runs.

**Build-race status: ELIMINATED.** `vitest.config.ts` wires `test/globalSetup.ts` →
`ensureBuilt()`, which builds `dist/` exactly once, single-threaded, in the main process
BEFORE the worker pool starts. No test file builds in its own `beforeAll`. Zero
empty-stdout / "Unexpected end of JSON input" / truncated-bundle reds; the CLI e2e tests
that spawn `dist/cli/main.js` pass cleanly.

**The 4 phase-pin reds the audit found are now FIXED** (re-pinned to the shipped v0.3
phase — see §0). Each hard-coded the pre-immersion phase state (compare deferred, pov
deferred, `--lock` absent) and fails *precisely because v0.3 correctly shipped those
tokens*; this pass re-pinned all four:

| # | File :: test | Was | Now (FIXED) |
|---|---|---|---|
| 1 | `test/cli/schema.test.ts` :: "the deferred table has shrunk …" | expected 13-verb roster, `DEFERRED_TABLE` length 5 | roster gains `compare` (14 verbs); `DEFERRED_TABLE` length **4** (the `immersion (v0.3)` row retired with `pov`/`--look` shipping). |
| 2 | `test/cli/serve.test.ts` :: recipe-c leg 3 | expected `compare` → exit 2 SCHEMA/deferred | asserts the shipped `compare` (exit 0, `kind:"compare"`, one pair, two verdicts, `world_delta.differs:false`). |
| 3 | `test/effectuality/d8.test.ts` :: T-D8-VERB-SCOPED | `sample` map missing `--lock` | `"--lock": { lock: "station" }` added; count self-adjusts. |
| 4 | `test/render/ink.test.ts` :: pov render target | asserted `pov` STILL deferred | asserts `pov` RENDERS (`r.ok`, svg contains `data-view="pov"`). |

The 4 remaining `it.todo` are the documented `adj-doubleapex` two-touch seams (design/04
§4.6), not failures. A single all-green v1.0 CI run is now the shipped reality.

---

## 3. v1.0 goal inventory (G1–G9)

design/00 L554: "**v1.0** is v0.3 complete with every gate green — the point at which
G1–G9 all hold." Enumerated from design/01 S2 (L24–63); demonstrated-by = the shipped
suite.

| Goal | Phase | Demonstrated by the suite? | Evidence |
|---|---|---|---|
| **G1** — every drawn line is a ridden line | v0.1 | **YES** | No input surface accepts path points / radii-of-line / apex (D7); `test/meta/imports.test.ts` + `test/contract/validate.test.ts`; a grep for an `apex` input field across `plan/` finds nothing. Viewer recomputes via `run()` (07 §2.1), never authors geometry. |
| **G2** — full state at any point | v0.2 | **YES** | `C-STATEAT-LAWS` (`test/contract/stateAt.test.ts`) + `C-HUD-EQUALS-STATEAT` (`test/viewer/hud.test.ts`): HUD populated entirely from one `stateAt` call. |
| **G3** — steppable animation | v0.2 | **YES** | `test/viewer/viewer.test.ts` stepper suite (10 its): scrubs t/s, named jump points (`C-BOOKMARKS`), renders any sample without re-running the solver. |
| **G4** — agent-first authoring | v0.1 | **YES** | `A-RECIPE-A/B/E/F` (`test/cli/recipes.test.ts`) run from clean checkout; compound figure ≤ 6 scene lines / one CLI command. `serve.test.ts` recipe-c leg 3 now runs the shipped `compare` (exit 0) — the whole recipe (c) is green end to end. |
| **G5** — failed lines are first-class | v0.1 + v0.2 | **YES** | Mistake oracle (`test/oracle/oracle.test.ts`, 8 kinds); `test/viewer/compare.test.ts` scrubs an `overspeed` MISTAKE line's trajectory + instants exactly like a good line (shareable/loadable/per-instant inspectable, D6). |
| **G6** — roads are one-liners | v0.1 | **YES** | `test/property/road.test.ts` DSL round-trip + preset table; every archetype in scope has a worked single-line DSL. |
| **G7** — book-figure parity | v0.1 | **YES** | Six book-figure scenes bake with valid PASS judge records; `test/render/gate.test.ts` `T-JUDGE-RECORD` (0/0/0/0/3/3 baked, all six grade overall `pass` per DEVIATIONS post-run). |
| **G8** — book-compact diagrams | v0.1 | **YES** | Proportion gate green on all six baked scenes in `true` mode (`test/render/gate.test.ts`); `A-ESSES-GATE` orient=90 manifest pin. |
| **G9** — rider's-eye view | v0.3 | **YES** | The full POV gate family — see §1: POV at any sample, limit point marked (D40, one marker/frame), occlusion visible (wall golden). All POV/boot tests green. |

**G1–G9 all hold on the merits.** The only thing standing between this state and a
literal "every gate green" v1.0 CI run is the four §2 phase-pin re-pins — none of which
contradicts a goal (each asserts the ABSENCE of a v0.3 feature that now correctly
exists).

---

## 4. Weak/missing-gate findings — ALL RESOLVED this pass

1. **C-POV-LIMIT-CONSISTENT render-layer topdown-ray clause — RESOLVED (strengthened).**
   The formerly-vacuous `if (ray != null)` clause (book90 has no occluders → `sightRay ===
   null` → clause never fired) was rebuilt on the occluder-bearing `wallBlind` fixture.
   `project()` now genuinely draws the ray, and the test asserts `ray != null` plus
   `ray.to == POV limit world == recorded (limit_x, limit_y)` at the shared turn_in
   sample. The render layer now proves the two-views claim directly (not only the viewer
   layer). `test/render/pov.test.ts`.

2. **C-POV-OCCLUDE clamped assertion — RESOLVED (tightened).**
   `expect(f.limit.markerState).toBe("clamped")` added to the wall golden (verified clamped
   at `s0+2`, alongside the existing paint-order + wall-extrusion proof). `test/render/pov.test.ts`.

3. **Four v0.2/v0.1 phase-pins — RESOLVED (re-pinned).** All four (schema roster, serve
   recipe-c leg 3, D8 `--lock` sample, ink pov-deferred) are re-pinned to the shipped v0.3
   phase (§0, §2). A single all-green v1.0 CI run is the shipped reality.

4. **`pov` split-brain + `--look` deferral — RESOLVED (the v1.0-close fix, §0).** The
   un-deferral is now complete: the `immersion (v0.3)` deferred row is retired, `controls`
   composes `pov`, and `--look` is a shipped `view.look` ViewSpec flag with two new D8
   effectuality witnesses. The three residual design-letter deviations (`--at`/`--every`
   frame-sequence per 07 §5.5; the red deficit band; the sight-band/occluder draw order)
   are recorded in DEVIATIONS.md — none is a gate, and none bends the engine.

---

## 5. Bottom line — v1.0 CLOSED

- **v0.3 exit-gate SET (C-POV-LIMIT-CONSISTENT, C-POV-TRUE-GEOMETRY, C-COMPARE, per-view
  boot smoke) + G9: all GREEN**, with **no weak clauses remaining** — the two flagged
  clauses were strengthened this pass.
- **Full POV family (C-POV-LIMIT-ALWAYS, C-POV-LOOK, C-POV-OCCLUDE): all GREEN.**
- **G1–G9: all demonstrated by the suite on the merits.**
- **typecheck: exit 0. Build race: eliminated (globalSetup builds `dist/` once).**
- **Full suite: 50 files pass / 1357 pass / 0 fail / 4 todo, run TWICE (deterministic).**
  The 4 `it.todo` are the documented `adj-doubleapex` two-touch seams (design/04 §4.6).
- **The project meets the design/00 v1.0 bar: v0.3 complete, every gate green, G1–G9 all
  hold.** No re-bless / re-bake occurred (v0.3 is a pure consumer of the v0.1 engine; no
  golden, hash, or figure moved).
