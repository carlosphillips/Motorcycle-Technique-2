# V02-GATES — the v0.2 PHASE-EXIT gate sweep

## CURRENT STATE — 2026-07-24 (build race fixed; v0.2 phase exit MET, green in ONE run)

**Definitive v0.2 exit-gate tally: 26 GREEN / 0 AMBER / 0 RED.**

This section is the single authority. Every block below it (the earlier "POST-RUN",
"POST-FIX", and "original audit" sweeps) is **SUPERSEDED** and kept only for
provenance — do not read their tallies (25/1/0, 24/0/2, 12/1/13) or their
A-RECIPE-C AMBER as current.

**The test build is now DETERMINISTIC.** `dist/` is built exactly once, in a vitest
`globalSetup` (`test/globalSetup.ts` → `test/helpers/build.ts`), before the worker
pool starts. No test file builds in its own `beforeAll` anymore, so no build ever
rewrites `dist/` while a sibling spawns `node dist/cli/main.js` against it. The
build race that produced phantom reds throughout this project — empty stdout /
`SyntaxError: Unexpected end of JSON input` in whichever CLI-spawning file was
unlucky under the parallel thread pool — is now **structurally impossible**, not
merely rare. (Before: ~9 files ran `npm run build` in `beforeAll`, two behind a
stale-mtime guard, plus two sleep-3s retry masks. After: one globalSetup build,
mtime-guarded so a warm tree writes nothing, and the retry masks are gone.)

**Suite (this run, measured):** `npm run typecheck` → exit 0. `npx vitest run` (full)
run **three times back-to-back**, all three identical and green:

| run | Test Files | Tests | duration |
|---|---|---|---|
| 1 | 46 passed (46) | 1311 passed \| 4 todo (1315) | 169.19 s |
| 2 | 46 passed (46) | 1311 passed \| 4 todo (1315) | 172.17 s |
| 3 | 46 passed (46) | 1311 passed \| 4 todo (1315) | 170.70 s |

Zero failures in every run. The 4 `todo` are the design-declared open seams (not
silent skips), all gated on the A-DOUBLEAPEX / believed-band pins:
`G-APEXLIST` (`test/golden/gates.test.ts`), `G-8.5-RED as designed`
(`test/golden/scenes.test.ts`), and the two rubric seams
(`A-CATALOGUE` `hold_wide_for_sight` PASS witness and `A-CHAIN-GREEN`,
`test/oracle/rubric.test.ts`).

**The two formerly not-fully-green gates are now GREEN:**
- **`C-RECOMPUTE-BUDGET` → GREEN** (was RED): the `solve/run.ts` warm-cache
  mistake-line fix landed; `fig-08-06`'s warm all-lines recompute meets the 300 ms
  budget in the full run (`test/cli/controls.test.ts` 10/10 in every run above).
- **`A-RECIPE-C` → GREEN** (was AMBER): `adj-recipe-c` amended design/09 §3.6 and
  08 §6(c) to the ratified `adj-vis` hold-wide signature; `test/cli/serve.test.ts`'s
  two former `it.fails` clauses are now real green tripwires (24/24), and its
  clause-1 case no longer load-timeout-flakes now that the build race is gone
  (serve.test.ts ~34 s in every run above, inside its explicit per-test timeouts).

### The 26 v0.2 exit gates (all GREEN this run)

design/00 §3 v0.2 row = design/09 §10 v0.2 list; anchors are design/09 line refs.

| gate | design anchor | enforcing test (file :: name-fragment) | result | note |
|---|---|---|---|---|
| G2 | 01 §2 L29-32 | `viewer/hud.test.ts` :: C-HUD-EQUALS-STATEAT (+ byte-identity) | **GREEN** | HUD populated entirely from one `stateAt`; a computed row can't pass |
| G3 | 01 §2 L33-36 | `viewer/viewer.test.ts` :: stepper + `contract/viewer-goals.test.ts` (0 integrate calls) | **GREEN** | 200+-sample scrub adds 0 `core/integrate` calls |
| G5 (inspection half) | 01 §2 L44-48 | `contract/viewer-goals.test.ts` (scrub a real `premature` line) | **GREEN** | mistake line scrubbed trajectory + HUD |
| C-STATEAT-LAWS | 09 §6 L1886-1890 | `contract/stateAt.test.ts` | **GREEN** | endpoint exactness, 3 interp families, domain refusals, derived block |
| C-HUD-EQUALS-STATEAT | 09 §6 L1919-1921 | `viewer/hud.test.ts` | **GREEN** | byte-identity in-proc HUD vs spawned `state` |
| C-BOOKMARKS | 09 §6 L1926-1927 | `viewer/viewer.test.ts` + `contract/stateAt.test.ts` + `cli/controls.test.ts` | **GREEN** | jump points === events array; no probe/tau mark leaks |
| C-ONE-CORE | 09 §6 L1957-1964 | `meta/imports.test.ts` (served-graph one `integrate.js`) + `viewer/onecore.test.ts` | **GREEN** | bundle-graph lint (real, not grep) |
| C-RECOMPUTE-BUDGET | 09 §6.1 L2013-2018 | `cli/controls.test.ts` :: C-RECOMPUTE-BUDGET | **GREEN** | **was RED** — `run.ts` warm-cache mistake fix; `bad.cache="hit"`, budget met (deterministic now the build race is gone) |
| A-RECIPE-C | 09 §4 L1435-1437 | `cli/serve.test.ts` :: A-RECIPE-C (24) | **GREEN** | **was AMBER** — `adj-recipe-c`: the two clauses are now real green tripwires on the hold-wide signature (no `it.fails`); clause-1 no longer load-flakes |
| G-STANDING-BITES | 09 §10 L2312-2327 | `contract/standing.test.ts` | **GREEN** | `fx-standing-straight` named rung-3 → genuine set-equality |
| G-STANDING-NO-HASH-MOVE | 09 §10 L2328-2331 | `contract/standing.test.ts` (annex A/B) | **GREEN** | real A/B: `spec_hash` + every `result_hash` + all 6 scenes byte-identical |
| A-STANDING-WARN-BAND | 09 §4 L1687 | `contract/standing.test.ts` (3 arms) | **GREEN** | `adj-warn-band` reachable 3-arm gate |
| A-STANDING-RESERVED | 09 §4 L1688-1689 | `contract/standing.test.ts` | **GREEN** | rung 4, reserve rows pass, 0 integrate calls |
| A-STANDING-LADDER-CUMULATIVE | 09 §4 L1690-1693 | `contract/standing.test.ts` | **GREEN** | 250-case product vs retyped 05 §6.4 table |
| A-STANDING-REFUSAL | 09 §4 L1694-1695 | `contract/standing.test.ts` | **GREEN** | refusal → `standing:null`, `refused:true`, no throw |
| A-RESERVE-CHECKS-RESOLVE | 09 §4 L1696-1699 | `contract/standing.test.ts` | **GREEN** | all 4 typed errors on code + reason |
| A-LADDER-PROSE | 09 §4 L1700-1707 | `contract/standing.test.ts` | **GREEN** | placard byte-identical across shipped surfaces |
| A-STANDING-TOMBSTONE | 09 §4 L1505-1509 | `contract/standing.test.ts` | **GREEN** | 4 struck names → `struck_by_decision`, never deferred |
| C-SAVEWIN-HUD | 09 §10 L2332-2334 | `viewer/saveWindow.test.ts` | **GREEN** | overlay built; every field === returned object |
| C-SAVEWIN-CLIP | 09 §10 L2335-2338 | `viewer/saveWindow.test.ts` + `viewer/correctiveGhost.test.ts` | **GREEN** | probe/ghost clipped at `s*` |
| C-SAVEWIN-NO-INK | 09 §10 L2339-2342 | `viewer/overlayHash.test.ts` (v0.2 leg) + `contract/wire.test.ts` (v0.1 sentinel) | **GREEN** | byte-identical export toggle on/off × 6 scenes |
| C-SAVEWIN-REFUSE-COARSE | 09 §10 L2347-2349 | `contract/saveWindow.test.ts` | **GREEN** | `--scan-ds 2.0` → `SCHEMA/scan_ds_too_coarse`, no value |
| C-SAVEWIN-BUDGET | 09 §10 L2343-2346 | `contract/saveWindow.test.ts` | **GREEN** | timing + `⌈domain/scan_ds⌉+5+≤8` bound |
| G-SAVEWIN-GRID | 09 §3.2 L426-430 | `contract/saveWindow.test.ts` | **GREEN** | real 0.25/0.5/1.0 m suite; `adj-tshot-grid` v_max≥10 scope |
| A-SAVEWIN-PLACARD | 09 §4 L1502-1504 | `cli/inspection.test.ts` | **GREEN** | `explain save-window` un-deferred; placard byte-identical |
| A-SAVEWIN-VERB | 09 §4 L1500-1501 | `cli/inspection.test.ts` + `contract/saveWindow.test.ts` | **GREEN** | CLI stdout byte-equals library `saveWindow` |

---

## SUPERSEDED HISTORY (provenance only — not current state)

The three sweeps below are earlier snapshots, kept for provenance. Their tallies
(25/1/0, 24/0/2, 12/1/13), their A-RECIPE-C AMBER, and their references to the
build-race flake and the fig-08-05 test-lag reds are all **corrected by the CURRENT
STATE section above** (26/0/0, A-RECIPE-C GREEN, flake fixed, one fully-green run).

> **POST-RUN UPDATE — 2026-07-24 (judge-commit + full v0.2 sweep, this run).**
> This run committed fresh judge records for the three re-baked figures
> (`fig-08-03/04/05`) and ran the full suite ONCE. **Both previously-RED v0.2 gates were
> addressed:**
> - **`C-RECOMPUTE-BUDGET` → GREEN.** The `solve/run.ts` mistake-line warm-cache fix
>   landed: on the fig-08-06 `premature@all` chain the warm path now reports
>   `good.cache="hit"` AND `bad.cache="hit"` (the mistake line is no longer re-`compileMistake`d),
>   and the all-lines warm recompute meets the 300 ms budget in the full run
>   (`test/cli/controls.test.ts` 10/10 green in-suite).
> - **`A-RECIPE-C` → AMBER.** Its two never-asserted clauses are now asserted VERBATIM and
>   unweakened, but the engine MEASURES a CONTRADICTION of the design letter's direction on
>   this fixture (geom approach-span `min(sight_ride_m−ssd_m)` ≈ 18.84 m > vis ≈ 12.61 m;
>   geom corner-threshold speed ≈ 49.26 km/h < vis 60.00) — the same `adj-vis` hold-wide
>   mechanism (V1's speed governor never binds; V2 negotiates the blind corner under a wide
>   commitment). So clauses 2/3 ride `it.fails` as a tracked, recorded design-letter
>   deviation (a tripwire that reddens the day the engine ever satisfies the letter), NOT
>   coverage theater. This is the AMBER definition exactly: passes, on a documented
>   deviation. Filed in DEVIATIONS this run.
>
> **Final v0.2 exit-gate tally: 25 GREEN / 1 AMBER / 0 RED.**
>
> **Suite (this run, measured):** `npm run typecheck` → exit 0. `npx vitest run` (full,
> once) → **4 failed / 1307 passed / 4 todo (1315); 171.25 s.** Of the 4 red, **none is a
> real v0.2-gate regression:**
> - **1 touches a v0.2 gate and is a load-timeout FLAKE, not a real failure.**
>   `test/cli/serve.test.ts` A-RECIPE-C "clause 1 — both solves succeed" hit the default
>   5000 ms test timeout under full-suite parallel load — that one `it` (serve.test.ts:467)
>   carries no explicit timeout while its siblings carry 60–180 s. Re-run in ISOLATION:
>   `npx vitest run test/cli/serve.test.ts` → **24/24 passed** (clause 1 = 3730 ms; clauses
>   2/3 `it.fails` pass as expected). A one-line explicit timeout on serve.test.ts:467
>   removes it (out of this task's file grant — flagged).
> - **3 are v0.1 figure/golden gates — NOT v0.2 exit gates** — all `fig-08-05`-specific, all
>   consequences of the fig-08-05 re-bake + `adj-fig-08-05` scene amendment landing while
>   their test expectations lag (all out of this task's file grant — flagged for the owning
>   agents):
>   · `test/cli/scene.test.ts` fig-08-05 lowerScene — pins the PRE-amendment scene text
>     (`correction@late` / "corrects late" / "corrects too late" note); the scene now reads
>     `run_wide_detect@late` / "ran off before reacting" (adj-fig-08-05). → WP-13 re-pin.
>   · `test/golden/scenes.test.ts` G-8.5-RED — pins `late` as a refusal; the engine now
>     SOLVES `late` (runoff, `result_hash 1a5294`). adj-fig-08-05 already amended the design
>     letter (09 §3.2/§4) to the solved-runoff truth; the golden-owner re-pin is the residual.
>   · `test/render/gate.test.ts` fig-08-05 PROPORTION — the hardcoded `PINS` constant
>     (straight_share 0.323 / road_ink 0.43 / frame_aspect 0.719) is the OLD road-only bake;
>     the re-baked manifest is 0.516 / 0.373 / 0.860. → WP-17 re-pin. (Note: fig-08-05's
>     byte-identity and T-JUDGE-RECORD arms both PASS — only the stale value pins fail.)
>
> **What the re-bake DID clear:** all six `re-bake is byte-identical` arms PASS
> (fig-08-03/04/05 SVGs are current), all six `T-JUDGE-RECORD` arms PASS (fig-08-04
> `spec_hash` tripwire now `30fcb5`; fig-08-03/04 byte-identity + proportion green), all six
> judge records grade overall **pass**, `test/hash/tripwire.test.ts` green, and
> `test/cli/schema.test.ts` deferred-token green (`serve`/`sweep` are in `SHIPPED_VERBS`).
> No v0.2 gate regressed.
>
> **Correction to the POST-FIX block below (the fig-08-04 `spec_hash` arrow was backwards).**
> Recomputed on this run's engine: `specHash(lowerScene(current fig-08-04.scene))` =
> **`30fcb5`** (the adj-fig84 edit — matches the current `manifest.json` + this run's
> re-committed judge record); the pre-edit scene hashed **`1a9dd5`** (the stale value the
> committed judge.json carried before I rewrote it). So the move is **`1a9dd5 → 30fcb5`**,
> NOT "`30fcb5 → 1a9dd5`". The POST-FIX block below and DEVIATIONS.md both stated it
> backwards; corrected here and in DEVIATIONS.
>
> **Is v0.2 phase exit MET?** The v0.2 exit-gate SET is satisfied on the merits — **no v0.2
> exit gate is RED** (25 GREEN / 1 AMBER / 0 RED), and the one AMBER (A-RECIPE-C) is a
> documented design-letter deviation now recorded in DEVIATIONS, the same class as the
> already-ratified `adj-vis`/`adj-feasibility` recipe pins. But a single **fully-green CI
> run** is not yet achievable, ONLY because of (a) the A-RECIPE-C clause-1 load-timeout
> flake and (b) the three `fig-08-05` v0.1 test-lag reds above — all out of this task's file
> grant, none a v0.2 gate. Once the WP-13 / WP-17 / golden owners land the three test
> re-pins and serve.test.ts:467 gets an explicit timeout, the full suite is green and the
> phase exits cleanly.
>
> **The 26 v0.2 exit gates (design/00 §3 v0.2 row = design/09 §10 v0.2 list; every named
> test GREEN this run unless noted; anchors are design/09 line refs from the audit below):**
>
> | gate | design anchor | enforcing test (file :: name-fragment) | result | note |
> |---|---|---|---|---|
> | G2 | 01 §2 L29-32 | `viewer/hud.test.ts` :: C-HUD-EQUALS-STATEAT (+ byte-identity) | **GREEN** | HUD populated entirely from one `stateAt`; computed row can't pass |
> | G3 | 01 §2 L33-36 | `viewer/viewer.test.ts` :: stepper + `contract/viewer-goals.test.ts` (0 integrate calls) | **GREEN** | 200+-sample scrub adds 0 `core/integrate` calls |
> | G5 (inspection half) | 01 §2 L44-48 | `contract/viewer-goals.test.ts` (scrub a real `premature` line) | **GREEN** | mistake line scrubbed trajectory + HUD |
> | C-STATEAT-LAWS | 09 §6 L1886-1890 | `contract/stateAt.test.ts` (33) | **GREEN** | endpoint exactness, 3 interp families, domain refusals, derived block |
> | C-HUD-EQUALS-STATEAT | 09 §6 L1919-1921 | `viewer/hud.test.ts` (12) | **GREEN** | byte-identity in-proc HUD vs spawned `state` |
> | C-BOOKMARKS | 09 §6 L1926-1927 | `viewer/viewer.test.ts` + `contract/stateAt.test.ts` + `cli/controls.test.ts` | **GREEN** | jump points === events array; no probe/tau mark leaks |
> | C-ONE-CORE | 09 §6 L1957-1964 | `meta/imports.test.ts` (served-graph one `integrate.js`) + `viewer/onecore.test.ts` | **GREEN** | bundle-graph lint (real, not grep) |
> | C-RECOMPUTE-BUDGET | 09 §6.1 L2013-2018 | `cli/controls.test.ts` :: C-RECOMPUTE-BUDGET | **GREEN** | **was RED** — `run.ts` warm-cache mistake fix; `bad.cache="hit"`, budget met |
> | A-RECIPE-C | 09 §4 L1435-1437 | `cli/serve.test.ts` :: A-RECIPE-C (24) | **AMBER** | **was RED (weak)** — clauses 2/3 now VERBATIM via `it.fails` = MEASURED CONTRADICTION (adj-vis); clause-1 full-run timeout is a load flake (24/24 isolated) |
> | G-STANDING-BITES | 09 §10 L2312-2327 | `contract/standing.test.ts` | **GREEN** | **was AMBER** — `fx-standing-straight` named rung-3 → genuine set-equality |
> | G-STANDING-NO-HASH-MOVE | 09 §10 L2328-2331 | `contract/standing.test.ts` (annex A/B) | **GREEN** | **was RED (weak)** — real A/B: `spec_hash` + every `result_hash` + all 6 scenes byte-identical |
> | A-STANDING-WARN-BAND | 09 §4 L1687 | `contract/standing.test.ts` (3 arms) | **GREEN** | **was it.todo** — `adj-warn-band` reachable 3-arm gate |
> | A-STANDING-RESERVED | 09 §4 L1688-1689 | `contract/standing.test.ts` | **GREEN** | rung 4, reserve rows pass, 0 integrate calls |
> | A-STANDING-LADDER-CUMULATIVE | 09 §4 L1690-1693 | `contract/standing.test.ts` | **GREEN** | 250-case product vs retyped 05 §6.4 table |
> | A-STANDING-REFUSAL | 09 §4 L1694-1695 | `contract/standing.test.ts` | **GREEN** | refusal → `standing:null`, `refused:true`, no throw |
> | A-RESERVE-CHECKS-RESOLVE | 09 §4 L1696-1699 | `contract/standing.test.ts` | **GREEN** | all 4 typed errors on code + reason |
> | A-LADDER-PROSE | 09 §4 L1700-1707 | `contract/standing.test.ts` | **GREEN** | placard byte-identical across shipped surfaces |
> | A-STANDING-TOMBSTONE | 09 §4 L1505-1509 | `contract/standing.test.ts` | **GREEN** | 4 struck names → `struck_by_decision`, never deferred |
> | C-SAVEWIN-HUD | 09 §10 L2332-2334 | `viewer/saveWindow.test.ts` | **GREEN** | **was RED (no impl)** — overlay built; every field === returned object |
> | C-SAVEWIN-CLIP | 09 §10 L2335-2338 | `viewer/saveWindow.test.ts` + `viewer/correctiveGhost.test.ts` | **GREEN** | **was RED (no impl)** — probe/ghost clipped at `s*` |
> | C-SAVEWIN-NO-INK | 09 §10 L2339-2342 | `viewer/overlayHash.test.ts` (v0.2 leg) + `contract/wire.test.ts` (v0.1 sentinel) | **GREEN** | **was RED (weak)** — byte-identical export toggle on/off × 6 scenes |
> | C-SAVEWIN-REFUSE-COARSE | 09 §10 L2347-2349 | `contract/saveWindow.test.ts` | **GREEN** | **was RED (no test)** — `--scan-ds 2.0` → `SCHEMA/scan_ds_too_coarse`, no value |
> | C-SAVEWIN-BUDGET | 09 §10 L2343-2346 | `contract/saveWindow.test.ts` | **GREEN** | **was RED (no test)** — timing + `⌈domain/scan_ds⌉+5+≤8` bound |
> | G-SAVEWIN-GRID | 09 §3.2 L426-430 | `contract/saveWindow.test.ts` | **GREEN** | **was RED (scratch)** — real 0.25/0.5/1.0 m suite; `adj-tshot-grid` v_max≥10 scope |
> | A-SAVEWIN-PLACARD | 09 §4 L1502-1504 | `cli/inspection.test.ts` | **GREEN** | **was RED** — `explain save-window` un-deferred; placard byte-identical |
> | A-SAVEWIN-VERB | 09 §4 L1500-1501 | `cli/inspection.test.ts` + `contract/saveWindow.test.ts` | **GREEN** | **was RED (theater)** — CLI stdout byte-equals library `saveWindow` |
>
> ─────────────────────────────────────────────────────────────────────────────
> The POST-FIX block (2026-07-24, earlier the same day) follows for provenance; it is
> SUPERSEDED by the POST-RUN block above (its 24/0/2 tally and its backwards fig-08-04 arrow
> are both corrected above).

> **POST-FIX UPDATE — 2026-07-24 (SUPERSEDED — see the POST-RUN block above).** The original audit below (12 GREEN /
> 1 AMBER / 13 RED) predates the v0.2 build-out: since then the entire save-window
> surface was built, the standing suites landed, `C-ONE-CORE` got its real
> bundle-graph lint, `G3`/`G5` got `test/contract/viewer-goals.test.ts`, the
> `serve`/`sweep` deferred-token break was fixed, `explain save-window` was
> un-deferred, and this run applied the four AMEND-DESIGN adjudications
> (`adj-savewin-table`, `adj-tshot-grid`, `adj-warn-band`, `adj-fig84`). Verified
> post-fix state: **24 GREEN / 0 AMBER / 2 RED.**
>
> **Suite (this run, measured):** `npm run typecheck` → exit 0. `npx vitest run`
> (full) → **4–5 files / 9–10 tests failed, ~1296 passed, 4 todo (1309); ~174 s**
> (the range is the flake variance below). Every failure is a figure re-bake /
> cache / flake, NONE a v0.2 gate regression from the amendments.
>
> DETERMINISTIC red (7 tests across 4 files):
> - `test/render/gate.test.ts` — fig-08-03 / fig-08-04 / fig-08-05 byte-identity +
>   proportion(fig-08-05) — the committed figure SVGs are STALE (fig-08-03 from the
>   solver run's fifty_pence fix, fig-08-04 from this run's `adj-fig84` scene edit,
>   fig-08-05 from the solver run's C2 + the `correction@late` label anchor).
> - `test/render/gate.test.ts` `T-JUDGE-RECORD` fig-08-04 + `test/hash/tripwire.test.ts`
>   figure-stamp arm — both recompute `specHash(lowerScene(fig-08-04.scene))`, which
>   moved (30fcb5 → 1a9dd5) because `adj-fig84` edited the scene. This is a FIGURE
>   stamp, not a `test/fixtures/goldens/*` roster move; NO golden roster fixture
>   moved. Re-baking + re-blessing the figure stamps is DELIBERATELY deferred to a
>   later run (task instruction).
> - `test/golden/scenes.test.ts` G-8.5-RED — the solver run's C2 fix made fig-8.5's
>   `late` line SOLVE instead of refuse (contradicts unamended design/09 §5); an
>   unadjudicated design-vs-engine conflict, left red.
> - `test/cli/controls.test.ts` C-RECOMPUTE-BUDGET "warm spec really is warm" — the
>   `run.ts` mistake-line warm-cache gap (`cache 'absent'` not `'hit'`); out of
>   adjudicated scope. The one genuine v0.2-gate RED.
>
> FLAKY (pass in isolation — the phantom failures the task warned about; 7 test
> files run `npm build` in `beforeAll` under the parallel pool and clobber `dist/`
> mid-read): `test/cli/serve.test.ts` (21/21 isolated), `test/cli/sweep.test.ts`,
> and C-RECOMPUTE-BUDGET's 300 ms timing arm (load-sensitive). These come and go
> run-to-run; none is a code regression.
>
> **v0.2 gate tally, item by item (post-fix):**
>
> | gate | was | now | why the status moved |
> |---|---|---|---|
> | G2 | GREEN | **GREEN** | unchanged |
> | G3 (no re-solve while scrubbing) | RED (weak) | **GREEN** | `viewer-goals.test.ts` asserts a 200+-sample scrub adds 0 integrate calls |
> | G5 (mistake line first-class) | RED (no test) | **GREEN** | `viewer-goals.test.ts` scrubs a real premature line's trajectory + HUD |
> | C-STATEAT-LAWS | GREEN | **GREEN** | + this run's `lerpAngleDeg` range-normalisation fix and the 05 §3.2 psi 359→1 worked-example test |
> | C-HUD-EQUALS-STATEAT | GREEN | **GREEN** | unchanged |
> | C-BOOKMARKS | GREEN | **GREEN** | unchanged |
> | C-ONE-CORE | RED (grep only) | **GREEN** | `imports.test.ts` now asserts the SERVED `dist/` graph holds exactly one `core/integrate.js` |
> | C-RECOMPUTE-BUDGET | RED (fails) | **RED** | `run.ts` re-solves mistake lines on the warm path (`cache 'absent'`, not `'hit'`); budget arm also load-flaky — `solve/run.ts` fix, out of scope |
> | A-RECIPE-C | RED (weak) | **RED (weak)** | serve half passes, but the min-sight-margin and lower-entry-speed clauses are still unasserted (not strengthened this run) |
> | G-STANDING-BITES | AMBER | **GREEN** | `adj-warn-band` amended §10 to NAME `fx-standing-straight` the rung-3 witness → genuine set-equality, no deviation |
> | G-STANDING-NO-HASH-MOVE | RED (weak) | **GREEN** | real annex A/B + all six book scenes bake byte-identical before/after a varied valid annex (`spec_hash` + every `result_hash`) |
> | A-STANDING-WARN-BAND | RED (it.todo) | **GREEN** | `adj-warn-band`: the `it.todo` is a real three-arm gate (na-cap rung-3, blind-corner warn ¬clean, book90@38 empty_band) |
> | A-STANDING-RESERVED / -LADDER-CUMULATIVE / -REFUSAL / -TOMBSTONE, A-RESERVE-CHECKS-RESOLVE, A-LADDER-PROSE | GREEN | **GREEN** | unchanged |
> | C-SAVEWIN-HUD | RED (no impl) | **GREEN** | overlay built under `src/viewer/`; `viewer/saveWindow.test.ts` compares every displayed field to the returned object |
> | C-SAVEWIN-CLIP | RED (no impl) | **GREEN** | overlay + corrective ghost clip at `s*`, asserted |
> | C-SAVEWIN-NO-INK | RED (sentinel) | **GREEN** | real gate: byte-identical export toggle on/off across all six committed book scenes |
> | C-SAVEWIN-REFUSE-COARSE | RED (no test) | **GREEN** | `--scan-ds 2.0` → `SCHEMA/scan_ds_too_coarse` + full payload, no value, asserted (lib + CLI) |
> | C-SAVEWIN-BUDGET | RED (no test) | **GREEN** | timing arm + `runs` asserted against the ⌈domain_len/scan_ds⌉+5+≤8 bound |
> | G-SAVEWIN-GRID | RED (scratch) | **GREEN** | real suite; `adj-tshot-grid` scoped the 1.0 m rung to v_max ≥ 10 m/s (overspeed/chop/F-ORACLE-90 agree, slow_steer refuses 1.0 m) |
> | A-SAVEWIN-PLACARD | RED (explain deferred) | **GREEN** | `explain save-window` un-deferred; placard byte-identical on CLI summary + verb; `not_applicable` witness carries sentence + placard, no scalar |
> | A-SAVEWIN-VERB | RED (theater) | **GREEN** | `inspection.test.ts` now asserts CLI stdout BYTE-EQUALS the library `saveWindow` output |
>
> `adj-savewin-table` moved F-ORACLE-90 from `never_open` to a single-band
> `resolved` window (`open_count` classification), which is what makes
> `G-SAVEWIN-RUNOFF` producible; that gate lives on the v0.1 golden roster, not the
> v0.2 exit list, and its contract (`saveWindow.test.ts`) is green.
>
> The remaining RED v0.2 gate is **C-RECOMPUTE-BUDGET** (the `run.ts`
> mistake-line warm-cache gap, a scoped `solve/` follow-up). A-RECIPE-C passes but
> is still weak on two clauses. Neither was introduced by this run.
>
> ─────────────────────────────────────────────────────────────────────────────
> The original audit follows verbatim, for provenance.

# V02-GATES — the v0.2 PHASE-EXIT gate sweep (original audit)

Auditor's report. Scope: every gate named in `design/00-README.md` §3's **v0.2 — inspection**
row (line 550), cross-read against its normative statement in `design/09-verification-and-testing.md`
(and `design/01` §2 for the G-goals), then against the test that claims to enforce it, then run.

**Verdict: v0.2 PHASE EXIT IS NOT MET.** 26 gates audited: **12 GREEN, 1 AMBER, 13 RED.**
The whole `C-SAVEWIN-*` / `G-SAVEWIN-GRID` / `A-SAVEWIN-*` block (8 gates) is either untested
or tested by something materially weaker than the gate says, and two of its gates have no
implementation at all (there is no save-window surface anywhere under `src/render/` or
`src/viewer/`). Separately, one gate (`C-RECOMPUTE-BUDGET`) **fails in the full-suite run**
and one non-v0.2 test (`test/cli/schema.test.ts`) fails deterministically because the
deferred-token table still calls `serve`/`sweep` deferred while `cli/main.ts` ships them
behind an ad-hoc bypass.

---

## Suite-level facts (measured, this machine, 2026-07-24)

| Command | Result |
|---|---|
| `npm run typecheck` | **exit 0**, no diagnostics |
| `npx vitest run` (full) | **exit 1** — Test Files 2 failed \| 36 passed (38); Tests **2 failed \| 1182 passed \| 5 todo (1189)**; duration 150.98 s |

Full-suite failures:

1. `test/cli/controls.test.ts > C-RECOMPUTE-BUDGET … > recomputes every line of the largest committed figure inside 300 ms on the warm path`
   — `warm all-lines recompute took 414/355/356/326/430 ms: expected 326.33491700000013 to be less than 300`.
   Re-run **in isolation** (`npx vitest run test/cli/controls.test.ts`): 10 passed, budget test green.
   So: load-sensitive, not deterministic — but the phase-exit condition is "green in one CI run".
2. `test/cli/schema.test.ts > deferred-token rejections (ARCHITECTURE §6.4, verbatim table) > every deferred verb rejects SCHEMA + the row's deferred string`
   — `expected undefined to be 'inspection (v0.2)'`. **Deterministic** (re-run alone: 1 failed | 41 passed).

The 5 `todo`s (declared-open seams, none silently skipped):
`A-STANDING-WARN-BAND` (standing.test.ts), `A-CATALOGUE-EXERCISED` hold_wide_for_sight witness and
`A-CHAIN-GREEN` (rubric.test.ts), `G-8.5-RED` (scenes.test.ts), `G-APEXLIST` (gates.test.ts).

---

## The gate table

Legend — **GREEN**: a test asserts the gate's own statement and passes. **AMBER**: passes, but on a
declared, documented deviation from the letter. **RED**: no test, or the test asserts something
weaker than the gate (coverage theater), or it fails.

| gate id | design anchor | enforcing test (file::name) | ran? | result | notes |
|---|---|---|---|---|---|
| **G2** (full state at any point) | `design/01` §2 L29-32 — *Test:* "the HUD can be populated entirely from one `stateAt` call" | `test/viewer/hud.test.ts::C-HUD-EQUALS-STATEAT — every displayed physics value is READ from the instant — no UI arithmetic anywhere (07 §2.4)` (+ the two byte-identity cases) | yes | **GREEN** | Every HUD row declares `row.path` into the `InstantState` and the test resolves it and demands `===`. A computed row cannot pass. Strongest available form. |
| **G3** (steppable animation) | `design/01` §2 L33-36 — *Test:* "the stepper renders any sample index **without re-running the solver**" | `test/viewer/viewer.test.ts::the stepper — one cursor, one pathway (07 §3.1)` (7 cases: playback≡drag, ±0.1 s, ± one Sample, axis flip, clamping, terminal stop) | yes | **RED** (weak) | The *stepper* half is well covered. The gate's operative clause — **without re-running the solver** — is never asserted. `test/contract/standing.test.ts` shows the technique (a `vi.mock` counter on `core/integrate.js`, `A-STANDING-RESERVED`'s "zero integrate calls" arm); no viewer/stepper test uses it. Structurally true (`viewer/stepper.ts` imports only a type; `viewer/hud.ts` imports `stateAt`) but unenforced. |
| **G5** inspection half (failed lines are first-class) | `design/01` §2 L44-48 — *Test:* "**the viewer can scrub a mistake line's trajectory and HUD**" | none | n/a | **RED** (no test) | `rg "mistake\|premature" test/viewer/` → **0 hits**. Both viewer test files load the same single-line C30 golden. A mistake line reaches the CLI inspection verbs (`test/cli/inspection.test.ts` builds a `--mistake premature` envelope) and the controls strip (`test/cli/controls.test.ts`), but the *viewer* session/stepper/HUD path — which is what G5's test clause names — is never exercised on a failed line. |
| **C-STATEAT-LAWS** | `09` §6 L1886-1890 | `test/contract/stateAt.test.ts::C-STATEAT-LAWS — endpoint exactness` / `— the three interpolation rule families (05 §3.2)` / `— query validation and domain (typed Result errors)` / `— the derived block (05 §4)` / `— engine trajectory` (26 cases) | yes | **GREEN** | All four named laws asserted: endpoint exactness by both `s` and `t` (hand-built and on the `C30-trailbrake` engine line, every 10th sample); monotone `s`↔`t` (the dual-agreement case over `NUMERIC_SAMPLE_KEYS`); angle-aware blending (`350°→10°` passes through 0°, *"never 180"*); `BAD_RANGE/query_outside_domain` never clamped. |
| **C-HUD-EQUALS-STATEAT** | `09` §6 L1919-1921 | `test/viewer/hud.test.ts::C-HUD-EQUALS-STATEAT — the HUD's numbers ARE \`linelab state\`'s numbers` (8 cases) | yes | **GREEN** | Byte identity between the in-process HUD instant and a **spawned** `node dist/cli/main.js state … --s/--t` over the C30 golden, at 7 stations (incl. an exact sample hit, off-grid interpolations, an event station, the terminal sample) and 4 times. Nothing mocked. |
| **C-BOOKMARKS** | `09` §6 L1926-1927 | `test/viewer/viewer.test.ts::C-BOOKMARKS — named jump points are exactly the events array (07 §3.1)` (5) + `test/contract/stateAt.test.ts::C-BOOKMARKS` (2) + `test/cli/controls.test.ts::C-BOOKMARKS (controls half)` (2) | yes | **GREEN** | Both arms: one-for-one against `trajectory.events` with the event's own `(s,t)` copied not re-derived, kinds confined to `EVENT_KINDS`, and `jumpTo(...)` landing on `turnIn.t` exactly. The controls half adds the negative: no `probe#`/`tau_close` mark can enter the strip. |
| **C-ONE-CORE** | `09` §6 L1957-1964 — "**a bundle-graph lint**: the viewer's recompute path and the CLI's solve path resolve to **one** `engine/` module — a single entry imported by both, with **no second copy of the engine in either bundle**" | `test/meta/imports.test.ts::one engine (C-ONE-CORE precursor) > no src file other than core/integrate.ts matches /rk4\|RK4/` | yes | **RED** (weak) | The only enforcement is a **string grep for `rk4`**, in a `describe` block that names itself a *precursor*. It cannot see a second copy of the engine in a bundle, and it asserts nothing about viewer-and-cli resolving one entry. The design explicitly says recompute-equality is the *tautology* and **the lint is what has teeth** — the lint does not exist. Mitigating (not asserted): there is no bundler; `serve` mounts `dist/` read-only (`SERVE_MODULE_ROOT="/m"`), and `test/cli/serve.test.ts` fetches `/m/core/integrate.js` 200 — but nothing asserts *uniqueness*. |
| **C-RECOMPUTE-BUDGET** (as re-scoped by `09` §6.1) | `09` §6.1 L2013-2018 — largest committed figure (linked-chain), **warm cache**, all-lines recompute ≤ 100 ms × 3 | `test/cli/controls.test.ts::C-RECOMPUTE-BUDGET (as re-scoped by design/09 §6.1) > recomputes every line of the largest committed figure inside 300 ms on the warm path` (+ the "the warm spec really is warm" precondition case) | yes | **RED** (fails) | Test design is *correct and honest*: `fig-08-06` (the linked chain), a real cached-plan warm spec (asserts `cache === "hit"` on the solved line first), measured on shipped `dist/` in a fresh V8, best-of-5 after 3 untimed warmups. **It fails under full-suite load**: 414/355/356/326/430 ms, best 326.3 > 300. Passes alone. Either the budget genuinely has < 10 % headroom on this machine or the measurement needs isolation; either way the phase-exit "green in one CI run" condition is unmet today. |
| recipe (c) end to end incl. `serve` = **A-RECIPE-C** | `09` §4 L1407-1409 — "both solves succeed; over the shared approach span, `min(sight_ride_m − ssd_m)` is **strictly larger** on the governed line; **governed entry speed is lower**; both verdicts present in the compare output" | `test/cli/serve.test.ts::A-RECIPE-C — blind-corner visibility compare, through \`serve\` (08 §6(c), 07 §4.3)` (5 cases) | yes | **RED** (weak) | The `serve` half is real and good (both envelopes load through `serveVerb` → `loadSession` → `bootViews` + `hudAt`). But **two of the gate's three measurable clauses are never asserted**: no `min(sight_ride_m − ssd_m)` comparison between the geometry-optimal and governed lines, and **no entry-speed comparison** (the test even types `resolved_scenario.rider.start.speed_kmh` into its local interface and then never `expect`s it). What it asserts instead — `outcome === "contained"`, `sight.holds.length > 0` — is strictly weaker. Both missing clauses are v0.2-reachable. The third clause ("both verdicts present in the compare output") is legitimately blocked: `compare` is `immersion (v0.3)`, and the test pins that refusal honestly. Also carries a ratified arm: the doc's literal `--vis-margin 1.5` is `NO_SOLUTION/vis_unsatisfiable_within_bound` on this engine and the story is reproduced at 1.2. |
| **G-STANDING-BITES** | `09` §10 L2312-2327 (witness map table L2318-2324) | `test/contract/standing.test.ts::G-STANDING-BITES (design/09 §10) > the witness corpus attains exactly the rung set {0,1,2,3,4}` (+2 supporting cases) | yes | **AMBER** | Passes as a genuine set-equality over five committed witnesses, with the rung-3 case proved to be clean-but-not-reserved via the `na` cap (`lean_ceiling.instances === 0`, `reserved_blocked_by = [{lean_ceiling, na}]`). **Deviation from the design's witness map**: rung 3's declared witness is `F-STANDING-WARN`; the code substitutes `test/fixtures/standing/fx-standing-straight.json`, because `F-STANDING-WARN` is unattainable on this engine (see `A-STANDING-WARN-BAND`). Documented in the file's `SEAM-STANDING-WARN` banner with the probe arithmetic. |
| **G-STANDING-NO-HASH-MOVE** | `09` §10 L2328-2331 — "adding `annex.reserve_checks` to `parks-street/2` moves **no `result_hash` and no `spec_hash`**; the six Chapter-8 book figures and every committed book scene bake **byte-identical before and after**" | `test/contract/standing.test.ts::G-STANDING-NO-HASH-MOVE … > for every roster fixture: standing computes on every line, the entry's bytes are untouched, and result_hash equals the committed golden's` | yes | **RED** (weak) | What it actually asserts: calling `standing()` does not mutate a `LineResult`, no `"standing"` key appears in the serialized line, and every `BLESS_ROSTER` line still reproduces its committed golden `result_hash`. What the gate says: an **A/B on the annex** — hashes and *bakes* identical with and without `annex.reserve_checks`. Missing arms: (a) no A/B at all (there is one pack state, with the annex); (b) **`spec_hash` is never asserted**; (c) **the six Chapter-8 figures / committed book scenes are never baked before-and-after**. The literal "annex absent" arm is now unrunnable — `loadRubricPack` refuses `SCHEMA/reserve_checks_missing` — but a runnable equivalent exists (vary the annex to a different *valid* subset, e.g. `["lean_ceiling"]`, and re-bake), so the gate is testable and untested. |
| **A-STANDING-WARN-BAND** | `09` §4 L1687 (+ the `F-STANDING-WARN` pin L1670-1685) | `test/contract/standing.test.ts::A-STANDING-WARN-BAND / SEAM-STANDING-WARN > it.todo("A-STANDING-WARN-BAND as designed …")` | yes (reported `todo`) | **RED** (not enforced) | The gate is an `it.todo`. Three companion cases pin the *emergent* truth instead: `fx-standing-warn.json` (`{road:"book90", entry_kmh:38}`) refuses `NO_SOLUTION/empty_band`; the 34 km/h clean line reads `lean_ceiling` **pass**, never `warn`. Banner records the probe: entries 35/35.5/36/36.5/37/38/40/42/44 — `accept=clean` refuses across the whole `[36,44]` band; `accept=best_failing` shows `out_in_out` failing from 35 km/h (`phi_max` 33.17°/36.47°/36.77°) then containment breaking at 38 (wide, 39.17°), all below `phiReserve(0.85·1.0) = atan(0.85) = 40.36°`. The design prices this outcome (09 §4: "an engine or doctrine finding … never an edited expectation") — but the *gate itself* is unmet, and the phasing row lists it as a phase-exit condition. |
| **A-STANDING-RESERVED** | `09` §4 L1688-1689 | `test/contract/standing.test.ts::A-STANDING-RESERVED (design/09 §4)` (4 cases) | yes | **GREEN** | Asserts the letter exactly: `standing === "reserved"`, rung 4, `reserve` rows `[{lean_ceiling,pass},{stop_within_sight,pass}]` each with `instances > 0`, `reserved_blocked_by === []`. Plus the 05 §6.4 "Cost" arm, proved with a hoisted counter on `core/integrate.js`: **zero** integrate calls across 3 gradings. |
| **A-STANDING-LADDER-CUMULATIVE** | `09` §4 L1690-1693 | `test/contract/standing.test.ts::A-STANDING-LADDER-CUMULATIVE (design/09 §4)` (3 cases) | yes | **GREEN** | The full synthesised product `5 outcomes × 5 reserve specs × 5 × 2 = 250` cases, each checked against an **independently retyped** 05 §6.4 threshold table, plus the cumulative-monotone arm (every threshold at or below the returned rung holds) and the `na`/absent cap at 3. The table is the readable definition, as the design asks. |
| **A-STANDING-REFUSAL** | `09` §4 L1694-1695 | `test/contract/standing.test.ts::A-STANDING-REFUSAL (design/09 §4)` (2 cases) | yes | **GREEN** | `NO_SOLUTION` envelope entry → `standing: null`, `rung: null`, `refused: true`, `reserve: []`, no throw, provenance stamps + placard still present. Plus `standingAttachment` skipping refusals. A third case (in the SEAM block) repeats it on the *emergent* `fx-standing-warn` refusal. |
| **A-RESERVE-CHECKS-RESOLVE** | `09` §4 L1696-1699 (errors per `01` §A.6.1) | `test/contract/standing.test.ts::A-RESERVE-CHECKS-RESOLVE (design/01 §A.6.1)` (5 cases) | yes | **GREEN** | The committed annex resolves (`["lean_ceiling","stop_within_sight"]`, both in the pack's id set, both `resolveCheckId`-clean), and **all four** typed errors asserted on code **and** reason: `SCHEMA/reserve_checks_missing`, `SCHEMA/reserve_checks_empty`, `UNKNOWN_ID/unknown_reserve_check` (naming pack + id), `UNKNOWN_ID/renamed_check` (renames consulted first). |
| **A-LADDER-PROSE** | `09` §4 L1700-1707 | `test/contract/standing.test.ts::A-LADDER-PROSE (design/09 §4)` (6 cases) | yes | **GREEN** (with a scope note) | Every **shipped** printing surface carries pack id, `checks_version`, the rung-token gloss and the 05 §6.4 placard *byte-identically across surfaces* (`check --standing` rows vs `explain standing`/`reserved`/`reserve_checks`). Note: the design's list also names "the `06` legend row, the margin card" — `rg "standing" src/render/ src/viewer/` → **0 hits**, so those surfaces print no `standing` token and the obligation over them is vacuous. `06` §5.1 L494-499 is permissive ("**may** be printed as a word"), so this is legal, not a miss. |
| **A-STANDING-TOMBSTONE** | `09` §4 L1505-1509 | `test/contract/standing.test.ts::A-STANDING-TOMBSTONE (design/09 §4)` (3 cases) | yes | **GREEN** | All four struck names reject `UNKNOWN_ID/struck_by_decision`; `out_available`→`annex.reserve_checks`, `sight_ok`→`stop_within_sight`, `SIGHT_MARGIN_ROB`→`annex.reserve_checks` (on the `explain` surface, with `deferred` asserted **undefined** — struck is never deferred), `commit_within_sight`→"no successor"; `sight_vs_stopping` in an annex → `renamed_check` naming `stop_within_sight`. Typed reasons only. |
| **C-SAVEWIN-HUD** | `09` §10 L2332-2334 — "every displayed save-window field equals the returned object, precision-clamped to `HORIZON_DISPLAY_DP`" | **none** | n/a | **RED** (no test, no implementation) | `rg "saveWindow\|SaveWindow\|save_window\|save-window" src/` matches only `cli/{args,deferred,doc/explain,main,verbs/saveWindow}.ts`, `index.ts`, `solve/{constants,saveWindow,types}.ts`. **Nothing under `src/viewer/` or `src/render/`.** The 07 §3.6 stepper overlay does not exist, so there is no HUD field to compare and `HORIZON_DISPLAY_DP = 1` is never applied to a displayed value. |
| **C-SAVEWIN-CLIP** | `09` §10 L2335-2338 — "the drawn probe's last vertex is `s*` (or its termination station) in both the `07` §3.6 overlay and the §3.5 corrective ghost" | **none** | n/a | **RED** (no test, no implementation) | Same root cause: no overlay and no corrective ghost in `src/viewer/`. The `04` §4b.4 guard the gate calls "mechanical" is not mechanized. |
| **C-SAVEWIN-NO-INK** | `09` §10 L2339-2342 — "the exported SVG is **byte-identical with the save-window toggle on and off, on every one of the six committed book scenes**. Runs in the v0.1 leg as a sentinel and in the **v0.2 leg as a gate**" | `test/contract/wire.test.ts::C-SAVEWIN-NO-INK (v0.1 trivial sentinel — the phase law: absent, not stubbed)` | yes | **RED** (weak) | Still the **v0.1 sentinel**: it builds one synthetic `FigureResult` and asserts the strings `save_window`/`saveWindow`/`standing`/`commitment` are absent from it, plus a key-set equality. The file's own comment concedes it: *"The full gate (SVG byte-identity with the overlay off) arrives with the save-window feature."* The feature arrived; the gate did not. Zero of the six committed book scenes are rendered by this test, and there is no toggle to turn on. |
| **C-SAVEWIN-REFUSE-COARSE** | `09` §10 L2347-2349 — "`--scan-ds 2.0` on `F-ORACLE-90` exits `SCHEMA/scan_ds_too_coarse` with a populated `{scan_ds_m, v_max_ms, step_s, bound_s}`, and produces **no** `SaveWindow`" | **none** | n/a (behaviour hand-verified) | **RED** (no test) | The *implementation* is correct — verified by hand on `F-ORACLE-90` (`run --road "preset book90" --entry 34 --turn-in auto --mistake premature`, then `save-window … --scan-ds 2.0`): exit 2, `{"code":"SCHEMA","at":"scan_ds_m","detail":{"reason":"scan_ds_too_coarse","scan_ds_m":2,"v_max_ms":11.711495387037724,"step_s":0.17077238507164497,"bound_s":0.1}}`, no value member. **Nothing in `test/` asserts any of it.** `rg "scan_ds_too_coarse" test/` → 0 hits. |
| **C-SAVEWIN-BUDGET** | `09` §10 L2343-2346 — "≤ 400 ms per corner on the largest committed figure, × 3× CI multiplier; **`runs` is asserted against the `⌈domain_len / scan_ds⌉ + 5 + ≤ 8` bound** so the budget claim is auditable, not merely timed" | **none** | n/a | **RED** (no test) | `solve/saveWindow.ts` *emits* `runs` (observed `runs: 56` on the `F-ORACLE-90` premature line, c1) and its banner even cites `C-SAVEWIN-BUDGET` at the field's declaration — but neither the timing arm nor the arithmetic-bound arm is asserted anywhere. `rg "C-SAVEWIN-BUDGET" test/` → 0 hits. |
| **G-SAVEWIN-GRID** | `09` §3.2 L426-430 — "`HORIZON_SCAN_DS_M` sensitivity at **0.25 / 0.5 / 1.0 m** … all three agree on `status` and on `tau_close_s` within `HORIZON_EPS_S`" | **none** | n/a | **RED** (no test, no golden) | `rg "G-SAVEWIN" test/` → 0 hits. `test/fixtures/goldens/` contains no `G-SAVEWIN-*.json` (roster is C30×10, `book90-ideal`, `G-CORR-RUNOFF/WIDE`, `G-MISJUDGE-DR`). The only place the three-rung sweep appears is `test/contract/saveWindow.test.ts`, which is a **scratch file** — 61 lines, one `it("runoff + clean + rung agreement")` whose body `console.log`s and ends `expect(true).toBe(true)`. Its own line 1 says *"scratch exploration — will be replaced by the real contract suite"*. That is the purest coverage theater in the tree and it sits on the gate's own filename. |
| **A-SAVEWIN-PLACARD** | `09` §4 L1502-1504 — "the `04` §4b.7 placard string is present, **byte-identical**, on **every** surface that prints a save-window scalar: **HUD, CLI human summary, `explain`**. A scalar printed without its placard fails." | **none** | n/a (behaviour hand-verified: **fails**) | **RED** (no test — and the gate does not hold) | CLI JSON does carry `SAVE_WINDOW_PLACARD` verbatim. But **`explain save-window` refuses**: `{"code":"SCHEMA","at":"explain","message":"\"save-window\" is not shipped in this phase — deferred to inspection (v0.2)","deferred":"inspection (v0.2)"}` — likewise `explain tau_close_s` and `explain reaction_budget_s`, all three still listed in `src/cli/doc/explain.ts`'s `ANALYSIS_DEFERRED_V02`. And there is no HUD surface at all. `test/cli/inspection.test.ts` asserts only `w.placard.length > 0` — not byte-identity against `SAVE_WINDOW_PLACARD`, and not on any second surface. |
| **A-SAVEWIN-VERB** | `09` §4 L1500-1501 — "`linelab save-window` stdout **byte-equals** the library `saveWindow` output (the `A-STATE-VERB` pattern)" | `test/cli/inspection.test.ts::save-window verb (design/08 §3, §5's A-SAVEWIN-VERB pattern)` (6 cases) | yes | **RED** (coverage theater) | The `describe` is named after the gate and **never compares CLI stdout to the library**. It checks the status token is in the closed set, `rider`/`predicate` strings, `placard.length > 0`, `--corner` narrowing, `UNKNOWN_ID/unknown_corner_id`, `--scan-ds` threading, `line_selector_required`, and the never-exit-3 rule. All useful; none is the gate. Hand-verified that the substance *does* hold — `node dist/cli/main.js save-window <env> --line premature --corner c1` vs a script calling `saveWindow(line,"c1")` and printing `{ok, value}` → **byte-equal** — which makes the missing assertion pure omission, one `expect(cliStdout).toBe(libStdout)` away. |

---

## Cross-cutting findings (not on the gate list, found while sweeping)

1. **The deferred-token table lies about `serve` and `sweep` — and CI knows.**
   `src/cli/deferred.ts` still has `{ tokens: ["serve", "sweep"], deferred: "inspection (v0.2)" }`
   and `DEFERRED_VERBS = { serve, sweep, … }`, while `SHIPPED_VERBS` omits both. `src/cli/main.ts`
   L98-108 works around it with an inline `const SHIPPED_HERE = new Set(["sweep", "serve"])` and a
   comment naming the follow-up: *"the follow-up that owns `cli/deferred.ts` must delete 'sweep' and
   'serve' from the `inspection (v0.2)` row, add both to SHIPPED_VERBS"*. That follow-up did not run.
   Consequence: `test/cli/schema.test.ts::deferred-token rejections` fails deterministically, and
   ARCHITECTURE §6.4's "one table, the single source for both `schema` omission and `SCHEMA`+`deferred`
   rejection" is violated — the printed schema is no longer the phase (D8/D37).

2. **`explain` still defers three shipped save-window targets.**
   `ANALYSIS_DEFERRED_V02 = ["save-window", "tau_close_s", "reaction_budget_s"]` in
   `src/cli/doc/explain.ts` L138. All three ship in v0.2. This is the same phase-gating-law break as
   (1), on a different surface, and it is what makes `A-SAVEWIN-PLACARD` unsatisfiable today.

3. **`test/contract/saveWindow.test.ts` is a committed scratch file.**
   61 lines, `describe("explore-rest")`, `console.log` diagnostics, terminal `expect(true).toBe(true)`.
   It occupies the filename the save-window contract suite should own.

4. **The D44 viewer/render half of save-window does not exist.**
   No `src/viewer/*` or `src/render/*` file mentions save-window. `00-README` §3's v0.2 deliverable
   names *"the `save-window` CLI verb **and the stepper overlay**"*; only the verb shipped. Three
   gates (`C-SAVEWIN-HUD`, `C-SAVEWIN-CLIP`, and the v0.2 leg of `C-SAVEWIN-NO-INK`) are blocked on
   this, not on test-writing.

---

## What a follow-up agent must do to close v0.2

Ordered by "blocks the phase exit hardest":

1. Build the D44 stepper overlay + corrective ghost in `src/viewer/`, then write `C-SAVEWIN-HUD`,
   `C-SAVEWIN-CLIP`, and the real `C-SAVEWIN-NO-INK` (toggle on/off × six committed book scenes,
   byte-identical export).
2. Delete `serve`/`sweep` from `cli/deferred.ts`'s inspection row and `DEFERRED_VERBS`, add both to
   `SHIPPED_VERBS`, delete the `SHIPPED_HERE` bypass in `main.ts` — `test/cli/schema.test.ts` goes green.
3. Delete `save-window`/`tau_close_s`/`reaction_budget_s` from `ANALYSIS_DEFERRED_V02`, give them
   `explain` entries carrying `SAVE_WINDOW_PLACARD` verbatim, then write `A-SAVEWIN-PLACARD`.
4. Replace `test/contract/saveWindow.test.ts` with the real suite: `A-SAVEWIN-VERB` (byte-equality),
   `C-SAVEWIN-REFUSE-COARSE`, `C-SAVEWIN-BUDGET` (timing **and** the `⌈domain_len/scan_ds⌉+5+≤8`
   bound), `G-SAVEWIN-GRID` (0.25/0.5/1.0 m, `status` exact, `tau_close_s` within `HORIZON_EPS_S`)
   with its blessed golden.
5. Strengthen `A-RECIPE-C` with the two missing clauses (min sight margin strictly larger on the
   governed line; governed entry speed lower).
6. Turn `C-ONE-CORE` into the bundle-graph lint the design specifies (resolve the served module
   graph from `viewer/boot.js` and from `cli/main.js` and assert a single `core/integrate.js` node).
7. Strengthen `G-STANDING-NO-HASH-MOVE` into a real A/B over a varied-but-valid annex, covering
   `spec_hash` and the six book-scene bakes.
8. Add the "zero integrate calls while scrubbing" arm to the stepper tests (G3), and a viewer test
   that loads and scrubs a **mistake** line (G5).
9. Resolve or ratify `SEAM-STANDING-WARN` so `A-STANDING-WARN-BAND` stops being an `it.todo`.
10. Decide whether `C-RECOMPUTE-BUDGET`'s 300 ms is right, or whether the measurement needs
    isolation from the parallel suite; today it fails in the one full CI run the phase exit requires.
