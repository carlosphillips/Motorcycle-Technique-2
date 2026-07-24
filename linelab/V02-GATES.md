# V02-GATES — the v0.2 PHASE-EXIT gate sweep

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
