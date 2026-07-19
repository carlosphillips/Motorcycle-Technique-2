# linelab Design Review — Simulated Authoring of Figures 8.1–8.6

**Date:** 2026-07-18 · **Method:** the program was *pretended fully implemented exactly as `design/` specifies* — no more, no less. Six agents each simulated the complete authoring session for one book figure (viewing the actual book raster and chapter text first), one ran a cold-start test of the G4 promise, five attacked the design from physics / agent-UX / wholecloth / verification / pedagogy lenses, and one audited all ten docs for internal contradictions. Every finding was then adversarially re-verified against the doc text by an independent agent instructed to refute it.

**Corpus:** 171 findings → **125 CONFIRMED, 42 PARTIAL (nucleus survives, scope adjusted), 3 REFUTED, 1 unverified.** Raw data with full claims, fixes, and verifier notes: `review/findings-full.json`.

---

## 0. Verdict

The design's *ideas* are strong and most of its carried machinery is genuinely good (see §10). But simulated against its own promise — G7, "for each line diagram in Chapter 8, linelab produces an equivalent figure from a scene file" — **none of the six figures can be produced exactly as designed**, and three classes of defect recur so often they are structural:

1. **The doc set specifies intentions, not mechanisms, at exactly the load-bearing joints.** The doctrine check catalogue, the corrective shot, `solveDoubleApex`, chained-mistake seeding, and the position-action channel are each one sentence with three documents pointing at each other.
2. **The carried constants were tuned for the dead R60 world and the new book-scale presets break them.** Solver brackets in absolute metres overrun a 47 m road; the run-wide slice's own algebra fails at its stated boundary; `ssd`'s 7.0 m/s² exceeds the model's own 5.4 m/s² point of no return.
3. **The figures' red lines are the hard part, and the design has no theory of them.** Every book mistake is a *misjudgment* — a plan formed for the corner the rider believed in, executed on the corner that exists. linelab can only perturb a solved good line or refuse to solve. The two-strategy figures (8.4, 8.5) fall into the gap between those.

Nothing here says the project is wrong-headed. It says the design of record needs one more hard pass before implementation — mostly *specification* work, plus a handful of genuine design decisions listed in §8.

---

## 1. Can the six figures be built? (simulation outcomes)

| Figure | As-designed outcome | Blocking issues |
|---|---|---|
| **8.1 Premature Initiation** | Close — best of the six. Sight rays, markers, colours, proportions all fall out of the defaults. | Lean never unwinds (no exit — see §2.1); oncoming vehicle unplaceable on the road; preset/recipe produce a **mirror image** (book90 is a right-hander, the book figure a left-hander); runoff line has no endpoint; red path renders *dashed* (role law) while its sight ray is also dashed — the book's solid-path/dashed-sight grammar inverted. |
| **8.2 Slow Steering** | Mostly reachable. Shared turn point emerges correctly from the one-perturbation rule. | `slow_steer`'s ×0.3 roll rate has no schema home (profile enum is closed; no plan field carries roll rate) so the compiled mistake is not expressible as a wire scenario; on book-scale geometry the defaults plausibly leave the road mid-corner, not at the exit as drawn; runoff endpoint undefined. |
| **8.3 Fifty Pencing** | Shape reachable; annotation & markers not. | Book's red line *starts earlier* than green ("almost always associated with premature initiation") — inexpressible: `fifty_pence` has only a facet count and the one-perturbation rule forbids combining with `early_by_m`; `marks: auto\|all` cannot draw per-facet hourglasses on the mistake line only; labels cannot target a specific line's features (four of four callouts unreproducible). |
| **8.4 Decreasing Radius** | **Not producible as promised.** | Red double-apex companion **cannot render red**: colour law grants red only to wide/runoff/crash, `solveDoubleApex` either converges contained (→amber) or returns `NO_SOLUTION` (→no line). The book caption moreover *sanctions* the double-apex path at lower speed — a book-vs-design dispute the design resolves against the book without noticing. `use_full_width` unreachable from scene text/flags; faithful teardrop geometry (~200°+, r→9 m) trips the super-tight refusal (and which radius a taper is tested on is unspecified); `target_apex_pct=58` fights the >60 % DR late bar; `C_TAPER` compresses the teaching corner itself. |
| **8.5 Double Apex** | **Not producible as promised.** | No preset exists (the only Ch-8 archetype without one). The green double-apex line's solver is one sentence with no parameter surface, and it plausibly grades **amber** (fails single-input/out-in-out; the chain-aware green carve-out has no double-apex analogue). The red "typical late apex" line has **no authoring path at all**: slow entry → solves clean (no lesson); fast entry → typed refusal (no line to draw). The verdict schema records exactly one apex per corner, so the two-touch property is unrecordable. `sweep` cannot sweep entry speed to find the teaching window. |
| **8.6 Linked Turns** | Chain solving is promised but not specified enough to build. | Chained-mistake seeding is one sentence (per-corner perturbed turn-ins, lean derivation from mistaken state, out-of-corridor behaviour all unanswered); chain-aware checks ("containment + link-continuity + flow") **do not exist** in the check list; `chainedSolve` is uninvocable from scene text; zero-gap esses contradict the solver's own inter-corner position budget and the A-CHAIN-VIS acceptance test; portrait 4-corner chains fail `road_ink`/aspect gates with no authorable lever; `bookEsses` has 3 corners vs the book's 4. |

The strongest single result: **fig 8.1's core devices (per-line sight rays from turn-in events, hourglass/ring markers, verdict-derived colours, book-band proportions at true scale) all fall out of the defaults with zero authoring** — when the underlying engine and grammar gaps are patched, the design's compositional idea demonstrably works.

---

## 2. Structural blockers (fix before anything else)

### 2.1 The engine cannot finish a corner — no lean-unwind exists ⟨CONFIRMED, blocker⟩
Nothing in the plan vocabulary or controller ever returns lean to zero. `turn_in` commits a lean target with no lifetime; `lean_deg ∈ (0,90)` excludes upright; `position` overlapping a `turn_in` is rejected; roll-on widens the arc but never stops the yaw (`psi_dot = G·tanφ/v` stays positive at any lean). At book90 scale (~28°, 9 m/s ⇒ ~33°/s of residual yaw) every "clean" line curls across the lane on the exit straight — self-verification can never return clean, and **every figure's out-in-out exit is asserted, not derivable**. `turn_in` also has no sign, so alternating-hand esses cannot even be commanded. *Fix:* define a turn-in lifetime (commitment ends at corner end / next steering action, then `target_lean = 0` under the profile roll rate) and a signed or per-corner-inferred steering target; state it in 02 §3, 03 §6.1, 04 §4.2; add a golden asserting C30's exit straightens.

### 2.2 The corrective shot is a name, not a spec — `wide` vs `runoff` is undecidable ⟨CONFIRMED, blocker⟩
The headline outcome split is defined entirely by "a feasible add-lean corrective exists," but no doc specifies the trigger predicate, start time, control policy, success predicate, or the verdict's `corrective` shape — 02 points at 04, 04 points back at 02. The mistake oracle pins `early_apex` to exactly `runoff` (corrective must *fail*), so the oracle is unimplementable. *Fix:* a dedicated section in 04 (detect predicate; start = detect + `t_react_s` (+ `freeze_s`); roll toward `phiReserve` at profile rate with `a_cmd = 0`; success = `f ≤ 1` before road end without ceiling violation; recorded shape).

### 2.3 Runoff trajectories never end ⟨CONFIRMED, major, three independent rediscoveries⟩
Lateral departure is not a termination cause (02 §7's precedence has none), off-road `muAt` is undefined (defaults to dry asphalt on grass), and 05/07 *assume* run-off terminates early ("crash, road-end/run-off, stop") — the owner doc omits what the consumers assume. Every red line's drawn endpoint — the pedagogically loudest pixel in every figure — is unspecified. *Fix:* an `off_road` terminal event with bracketed crossing coordinates; pin `terminated.reason`'s vocabulary; define the auto-window fallback for lines with no exit event.

### 2.4 The doctrine check catalogue exists nowhere in `design/` ⟨PARTIAL — recoverable from extract/, but re-derivations are not⟩
01 §3 delegates ids+arithmetic to 05; 05 §6.2 delegates content back to 01 and never enumerates "the carried line-selection checks." Only 5 ids appear anywhere, in passing. The extract/ fallback partially rescues membership, but: the Tier-1R **re-derivations** 05 itself mandates (trail-brake taper, single-input smoothness, chop-keyed checks) are written nowhere; `sight_vs_stopping` (carried) vs `stop_within_sight` (new) is an unresolved id collision; and under carried arithmetic `slow_steer` fails **no** check (quick_steer is WARN-only), so one of six oracle entries cannot be written. Colour law v2 — "green iff clean and no check failed" — hangs on this list. *Fix:* enumerate the full v2 catalogue with arithmetic and TUNING thresholds in 01 (or an appendix owned by 05), including the chain-aware set and per-special-case `na` exemptions.

### 2.5 `stateAt` is promised as a CLI verb and absent from the verb table ⟨CONFIRMED, blocker for G2-via-CLI⟩
05 §4: "exposed identically in the library and as a CLI verb (08)". 08's normative table has no such verb, no line-selector convention, no exit mapping. *Fix:* add `linelab state <envelope> --line <id> (--s|--t)` (and note the multi-line envelope needs a `--line` selector everywhere — see §5).

---

## 3. The physics slice needs one more derivation pass

The run-wide slice's *intent* is right (and the book directly endorses it: "Getting off the gas or braking while at a high lean angle will cause the bike to straighten up and run wide"). The specified equations don't yet deliver it:

- **Invariant 5.4.2 is false at its own boundary** ⟨CONFIRMED; algebra re-verified independently⟩. At exactly `a_noreturn` the net roll rate is zero *by construction*, so φ holds while v falls — κ = G·tanφ/v² strictly **rises**: the line tightens forever. A whole band above the "point of no return" ([5.41, 6.70] m/s² at φ=30°, v=15) still tightens, and the tanh envelope creates a small-lean equilibrium that re-tightens κ past the pre-brake arc. *Fix:* decouple the roll-authority crossover (keep `a_noreturn` as a teaching quantity) from the geometric widening threshold `a_widen(φ,v) = (roll_rate + K_SU·A_SU_ONSET)/(K_SU − 2·sinφcosφ/v)` and pin the invariant only above it.
- **Deep-lean escape hatch** ⟨PARTIAL⟩. Above φ≈39.85°, the ellipse clips `a_clip` below `a_noreturn`, so *sustained* stand-up can never beat the rider — a held hard brake at 40° reads as a stable, grip-perfect tightening spiral (the transient term still fires on a grabbed brake, which saves the headline case but not a firmly held one).
- **The transient term is an impulse** ⟨CONFIRMED⟩. `a_cmd_rate` is a one-step finite difference, so any stepped command drop ≳0.08 m/s² at lean yields Δφ ≈ K_CHOP·Δa ≈ full stand-up in ~5 ms. Chop severity is binary (P-RUNWIDE-MONOTONE is vacuous); `brake` has onset-taper for release only, so *gently squeezing on* the brake mid-corner is inexpressible — every mid-corner brake engagement reads as a grab. *Fix:* onset slew on longitudinal actions; restate K_CHOP explicitly as an impulse gain.
- **P-ROLLRATE contradicts the EOM** ⟨CONFIRMED⟩: `phi_dot = clamp(...) + phi_dot_su` exceeds the cap in every stand-up event — the property test fails the design's own C30-chop golden. Rescope to the tracker component.
- **`position` actions have no physical channel** ⟨CONFIRMED⟩. The controller returns `{target_lean, roll_rate, a_cmd}` — no lateral member — yet 03 demands an effectual drift. The only channel is lean; no guidance law, arbitration, or turn-in-commitment end is specified, and the default `over_m = 15` window physically cannot reach typical hold-wide targets (0.51 m reachable vs 1.08 m needed). Two faithful implementations would diverge, breaking the determinism/hash story.
- **`ssd` contradicts the model** ⟨CONFIRMED⟩. `stop_within_sight` and the V1 governor certify stops at 7.0 m/s² *at every station including mid-corner*, while the design's own physics makes >5.4 m/s² at lean force a stand-up and the corrective solver calls such saves "infeasible by construction." The safety-central check certifies stops the simulator itself refuses to execute. *Fix:* lean-aware `ssd` (derate by `aLongAvail`/cap at `a_noreturn` while leaned) or a placard.
- Smaller but real: v_floor (2 m/s) vs the D3 "sub-25 km/h invalid" claim are an order of magnitude apart with the presets living in the gap; the roll tracker's per-stage semantics under RK4 are ambiguous; 'stopped' runs have no outcome class.

---

## 4. The solver doesn't fit its own world

- **Absolute-metre constants overrun the presets** ⟨CONFIRMED, arithmetic verified⟩. book90 is 46.85 m total with an 18.85 m arc; the turn-in sweep starts at station −12 (before the road exists) and the roll-on bracket's *lower* bound (+35 past turn-in) lands at/past the road end — the exit bisection has no domain **on the exact preset behind figs 8.1–8.3**. Even C30's +90 bound overruns its road by 13 m. *Fix:* respecify every station constant corner-relative (fractions of arc/sweep), clamped with a typed error.
- **`target_apex_pct = 58` fights the DR late bar (>60 %)** ⟨CONFIRMED⟩: on bookDecreasing the ranking *prefers candidates that fail the applicable check* and the typed failure blames the wrong cause. Make the target corner-type-aware.
- **`solveDoubleApex` is one sentence** with no parameter surface, no two-turn-in placement strategy, contradictory corner targeting, and no recipe — for the solver that produces an entire promised figure.
- **Chained-mistake seeding is one sentence**; the per-corner mechanics (perturbed turn-in when the mistaken entry state has diverged, lean derivation via engine probes, corridor exits) are all unanswered, and no chained oracle fixture exists.
- **The vis fixpoint's monotone-convergence argument is false under the design's own vocabulary** ⟨CONFIRMED⟩: outside/oncoming occluders mean widening can *shorten* sight (falsifying P-SIGHT-EYE under its stated fuzzing), and on alternating esses corner n+1's outside is corner n's inside — the canonical scenario is the likeliest to oscillate into `NO_SOLUTION`. Reframe the fixpoint as a bounded heuristic verified by self-check, and scope the properties.
- **"Contained, not clean" has no outcome value** ⟨CONFIRMED⟩: 04 promises chains grade green, 08 exits 3 on non-clean solves, 05's closed outcome set has no `contained` — three normative statements that cannot all hold (recipe (d) quietly routes chains through `run` instead of `solve`, evidence the seam is real).

---

## 5. The agent interface: right instincts, holes at the joints

Cold-start simulation of the G4 bar ("first try from `schema` + `explain` alone") found the bar *reachable* for kind-selection (the mistakes teaching table works) and *unreachable* for anything envelope- or figure-shaped:

- **The resolved plan is not in the envelope** ⟨PARTIAL, near-blocker⟩. `LineResult` carries source/trajectory/verdict but never the solved four-action wire plan — yet `explain` says "move `plan.b1.at_s` earlier," `sweep` addresses `plan.<id>.<field>`, and `stateAt.derived.action` must return "the full resolved PlanAction." The flagship run→explain→adjust→sweep loop is unactionable for every solver-authored line. *Fix:* a pinned `resolved_scenario` member (output provenance, not shareable input — D6 untouched).
- **`sweep` cannot sweep anything an author actually wants** ⟨CONFIRMED⟩: entry speed (the `Arc = Speed` axis), `config.mu`, `vis_margin`, constraint values, mistake params — all outside `plan.<id>.<field>`. The tipping-point question ("at what entry does chop become crash?") is unanswerable by the one exploration verb.
- **The figure layer has no JSON door** ⟨CONFIRMED⟩: `FigureSpec` is the canonical share payload, yet no verb accepts it; everything multi-line is authorable only as whitespace-significant scene text — a third spelling of every field. For an agent, "zero-file" solved the wrong problem: files are free, *grammars* are expensive. Make FigureSpec JSON first-class in/out and redefine scene text as sugar over it.
- **`--gate` is undefined over envelopes containing intended-fail mistake lines** ⟨CONFIRMED⟩ — as written, every good-vs-mistake figure exits 3 and the flag is useless in CI for the tool's primary artifact. Wire `expect_fail`/roles into the exit-tier rule (same fix resolves the fig 8.4 exit-3 problem).
- Three mistake-spec spellings with no composed grammar or precedence; `--line-id` listed but never defined while every operation that needs a line selector lacks one; `compare` silently presumes one shared road; hazards have **no** CLI flag and no schema section (falsifying 08's "every field has a flag" claim); occluder/hazard/segment **wire JSON shapes are never pinned** anywhere; the occluder ref token appears in three mutually incompatible shapes across 03/04/08; authored plan flags composed with `--turn-in auto` have no merge rule (reopening the accepted-but-ignored class D8 exists to abolish); `explain <kind>` is required by 01/03 and not accepted by 08's verb; the cold-start test and per-recipe acceptance tests that 08 twice delegates to 09 **do not exist in 09**.

---

## 6. Colour, parity, and pedagogy

- **The two-strategy figures break colour law v2** ⟨CONFIRMED⟩. Red requires wide/runoff/crash; the book's fig 8.4/8.5 companion lines are *contained on-road strategies*. The legitimate double-apex line plausibly grades **amber** (no `na` carve-out for its by-definition mid-corner correction, unlike the chain-aware green path); the "renders red because its verdict is red" claim in 01 has no mechanism behind it. Also a genuine book dispute: Parks' caption says either 8.4 path works at lower speed. *Decide explicitly:* a `wrong_strategy_for_corner` doctrine failure (red for contained-but-mismatched strategies), or follow the caption and ship the companion amber with a disclosed departure from the book's ink.
- **Amber conflates two opposite meanings** ⟨PARTIAL⟩ — "sound but contained" and "error you got away with." A student cannot distinguish them by colour, and the design insists colour is a hard signal. Make the legend print verdict-word + role, and pin every shipped book-figure scene's per-line outcome via the oracle so book-colour parity is *engineered*, not hoped.
- **`premature`/`early_apex` inverts the book's vocabulary** ⟨CONFIRMED⟩ — the book's name for the canonical runs-wide error *is* "Premature Initiation," and `early_apex` perturbs two controls anyway (early station **and** committed lean), straining the one-perturbation rule. Rename (`premature` = canonical/runs-wide; `premature_contained` = the eased variant) or collapse to one kind with a `commit:` parameter.
- **The POV loses its own teaching device** ⟨CONFIRMED⟩: with yaw = ψ and 60° FOV, the limit point sits at/beyond the frame edge exactly mid-corner on R12 presets, and there is no off-frame rule. The book attributes *all three* canonical mistakes to gaze ("look through the turn"), and the gaze cut is a parenthetical, not a placarded scope boundary. *Fix:* clamp-with-arrow for the off-frame chevron + a `look: heading|limit_point` camera toggle (pure presentation over recorded per-sample data) + add gaze to 01 §8's placard list.
- **Marker/label systems are below the figures' floor** ⟨CONFIRMED across 8.2/8.3/8.4/8.6⟩: `marks: auto|all` is figure-level and binary; labels anchor to road stations only. The book figures need per-line marker control (turn-points-only, per-facet hourglasses) and line-addressed callouts (`apex:c1@bad`, `turnin2:red`). This is one grammar extension: per-line `marks:` and line-qualified label anchors.
- **Role dash law vs the book** ⟨CONFIRMED⟩: the book draws all trajectories solid; linelab renders mistake-role lines short-dashed — colliding, in fig 8.1, with the dashed sight rays in the same red. Consider dashing *reference* roles only, or making role-dash a style option that book-parity scenes disable.
- Sample-contract additions the HUD story needs ⟨PARTIAL⟩: record `phi_dot_su` (or its S_sustained/S_transient split) per sample — the doc's own rule ("if the engine knew it, the result records it") demands it, and the controls strip's promised "stand-up deviation is visible here" is otherwise unreadable; `a_noreturn`'s promised HUD display is impossible from the current contract.
- The stateAt `phase` vocabulary (6 values) contradicts 06's 4 phase bands and neither defines boundaries.

---

## 7. Verification regime

- **Golden bootstrap** ⟨CONFIRMED⟩: 09 claims 02 holds "worked numbers"; 02 §8 explicitly defers all values to the not-yet-existing engine. The first bless is the engine grading its own homework. *Fix:* a mandatory analytic-acceptance layer (steady-state radius, braking distance, roll ramp, RK4-vs-exact upright) green before the first bless; then write the blessed numbers back into 02.
- **C-RECOMPUTE-BUDGET is off by ~two orders of magnitude** ⟨CONFIRMED⟩: honest run-count for a vis-chained figure is ~600 engine runs (17 coarse + 34/solve × 4 candidates × corners × 4 fixpoint iterations), and the "cheap" coarse tier is illusory — `ds_m` changes only the resample grid, dt is fixed. Either specify a coarse integrator tier, cache solved plans in the FigureSpec (plans are inputs — D6 survives), or re-scope the budget.
- **The oracle's base scenarios are unspecified** ⟨CONFIRMED⟩ — outcome pins are per-kind but outcomes are road-dependent; pin each kind on a named fixture. (Also reconcile 01 vs 03's differing outcome-class tables for three of six kinds.)
- **The vision judge is a CI gate with no machinery** ⟨PARTIAL⟩: no judge identity/version pinning, no operationalized rubric, no pass/fail schema, no flake policy.
- **P-EXPORT/P-SIGHT-EYE/A-CHAIN-VIS quantifier bugs**: P-SIGHT-EYE is false with outside/oncoming occluders; A-CHAIN-VIS contradicts 04's own budget-limited-hold carve-out on the zero-gap esses; the D8 effectuality "conformance test" 03 promises does not exist in 09 and is undecidable as stated (no scenario quantifier).
- One refutation worth keeping: the "every TUNING re-tune is a formal migration" complaint was **REFUTED** — the ceremony is per-commit, batching is the designed procedure. The regime's development-phase story is thinner than ideal but not broken.

---

## 8. Wholecloth challenges (the creative part)

**8.1 The design's missing concept is the misjudgment.** Every Chapter 8 error is a *belief error*: the rider solved the corner they thought they were in. linelab's mistake compiler perturbs *execution* (a station, a rate, a facet count) and therefore cannot author the book's most important red lines (8.4's wrong-strategy line, 8.5's "typical late apex" line, the blind-corner overspeed). Proposal — one first-class mechanism that subsumes several patches above:

```
ride ... believe_road="lane 3.5 | S 12 | L 20 ^90 | S 16"   # solve on the believed road,
                                                            # execute on the figure's road
mistake underread r_believed=20                             # sugar: believed radius/sweep
solve --accept best_failing                                 # return the self-verified
                                                            # non-clean line instead of refusing
```

This preserves D7 (no path input; the engine still produces everything) and turns "plausible-but-failing attempt" from an unreachable corner case into the tool's central teaching object. It is also honest to the book's psychology chapters, which the design otherwise has no channel for.

**8.2 Make the doctrine a named, pluggable rubric.** "The book wins" is the right *anchor*, but the check suite should be a declared data pack (`rubric: "parks-street/2"` in every verdict) rather than the tool's hard-coded morality. The book itself complicates the brake-complete baseline (Ch. 9 teaches a simultaneous brake/throttle transition; fig 9.1 celebrates trail braking), and modern street pedagogy argues the opposite baseline for exactly the sight-limited corners linelab centres on. A rubric seam costs one field and a data-driven check table — and it converts future doctrine disputes from forks into packs. (Verifier note: the "trail-braked line renders amber forever" fear was overstated — the carried `trail_brake_taper` check grades taper quality — but the rubric-identity absence is real.)

**8.3 Phase the build; demote the POV from the critical path.** ⟨CONFIRMED: no build order exists anywhere; 46 TUNING marks; the POV is "the largest subsystem with no prior equivalent"⟩ The six figures need `core/road/solve/mistake/render-topdown/cli-run-render` only. Proposal: **v0.1** = that spine + true-scale presets (delivers G1, G6, G7, G8); **v0.2** = stepper + `stateAt` + `serve`; **v0.3** = POV + compare; the diagram projection when realistic-road figures actually appear. D1's "the viewer is the product" inverts deliverable-vs-risk order for a v1.
  - Related ⟨PARTIAL⟩: on the presets the projection is nearly the identity (width ratios already in band) — its complexity currently buys almost nothing v1 ships. Keep the design, defer the implementation.

**8.4 "Grade MY line" is absent.** The single most natural request to a riding-line laboratory — here is my GPS/lean-logger trace, judge it — has no surface, and D7 as stated forbids even *evidence* input. A `fit(trace) → {plan, residual}` front door (search plan actions reproducing the trace, then grade the fitted plan normally) preserves every-drawn-line-is-engine-integrated while opening the coaching loop. The residual itself is teaching material ("your ride is best explained by a turn-in 6 m early").

**8.5 Share URLs need a version-skew contract.** ⟨CONFIRMED⟩ After any re-bless, a shared figure silently recomputes to a different story while its authored captions still assert the old one. Stamp `engine_semver` + optional per-line `expected: {outcome, result_hash}` into FigureSpec and render a first-class placard on divergence — squarely inside the design's own placard policy, ~40 bytes of URL.

**8.6 The fig 8.1 oncoming vehicle deserves to exist.** ⟨CONFIRMED⟩ `vehicle` is advertised as "oncoming-lane" but the placement grammar can only put footprints *outside the road edge*. Give it `lane=own|oncoming` or an `f=` coordinate through the same sideSign machinery — it is both the book's sight-line payoff and the only hazard-you-must-see the vocabulary could ever draw.

**8.7 A determinism-only tool about safety margins.** Everything is single-run deterministic; the book's argument for the late apex is explicitly probabilistic ("expect the unexpected", reserve against the *unseen*). Cheap creative option: a `--jitter` ensemble mode (N runs with small perturbations of entry speed/mu/turn-in under a seeded RNG at the CLI layer, core stays pure) rendering an envelope band instead of a line. Even as a v2 note, the design should acknowledge variability as the doctrine's actual subject.

**8.8 Handedness.** The presets are right-handers; figs 8.1–8.3 are left-handers. Either mirror the presets, add `hand=L|R` to preset invocation, or accept mirrored figures explicitly in the G7 parity criterion. (One token in the DSL — but the recipes as written produce mirror images of the book.)

---

## 9. Consistency bug sheet (confirmed unless noted)

1. 04 §7 "exactly one `ride` line is required" vs its own two-`ride` example and the subsequent-ride role rule (and the vis-compare figure *needs* two).
2. `early_apex`/`slow_steer`/`chop` outcome pins differ between 01 §4.3 and 03 §7.1 ("wide/runoff" vs "runoff"; "roll-rate-limited" is not an outcome class) — the oracle needs one class per kind on a named fixture.
3. Occluder ref token: bare `c1` (03 presets, 04 example) vs `entry|exit|mid:<id>` (03 grammar) vs `entry:c1-25 -1.0x30` (08 recipe (c)) — three shapes, none reconciled.
4. `sight_m` is centreline-arc metres; `ssd_m` is rider-path metres; they are compared raw (±~15 % systematic error on R12 presets, optimistic on inside lines). Also centreline targets overstate visible *corridor* for the rider's own lane.
5. Events: 09's bookmarks add "plan stations" that 05/07 exclude; `sightFrom`'s pure signature cannot produce the `trend` it promises (needs the previous sample's value); `sight_min` fine.
6. 02 retains raw 200 Hz + resampled series; 05's contract has one array and no home for the raw one.
7. Exit-code tiers: `scene`'s exit codes never specified; `run --gate` vs intended-fail lines (see §5); non-clean `solve` exit 3 vs "still renders" — reconcile against `expect_fail`.
8. Scene/CLI/schema spelling drift is mapped but not one-to-one as claimed (`vis=cautious` / `--visibility-governed` / `vis_hold_f` / `visHold=` / `--vis-hold`); `--mistake` sugar grammar undefined.
9. `schema` output is "exactly one JSON document" yet "schema text (wrapped)" — the schema's own structure is unspecified.
10. 08 announces "five canonical agent recipes," delivers six; `window:"all"` used but absent from the ViewSpec grammar; 08's importable API omits functions other docs require (`chainedSolve`, `suggestTurnIn`, `sightFrom`, projection); `config.mode` is a dangling stub; `checks_version` required but never versioned anywhere else; hazards missing from the schema section list.
11. `phase` vocab (05: six values) vs controls-strip bands (06: four) — neither with boundaries; `dnf-spec-error` unreachable given validate-as-sole-rejection-point and unmapped to exit tiers.
12. Colour law's "outcome = clean with failed checks" branch is vacuous under 02 §7's "clean = all checks pass" — the outcome/check relationship needs one definition.
13. Wall presentation height 1.2 m < 1.4 m eye while claimed to fully occlude — a wrong-but-plausible POV by spec.
14. 00 §4's core-sample field list is a declared minimum vs 05's full table — fine, but say so where 00 lists it.

---

## 10. What the simulation confirmed is *right* (keep these)

- **The compositional bet works.** Fig 8.1's whole visual grammar — per-line dashed sight rays anchored at turn-in events, hourglass/ring/dot markers, verdict-derived colour — emerges from defaults with zero authoring. The book-proportion arithmetic of the presets is genuinely correct at true scale (7 m/R12 = 0.58, inside the measured band); the projection really is a gentle correction there, exactly as 09 §5.3 intends.
- **The mistakes teaching table at the schema surface defuses the naming trap in practice** — every figure agent picked the right kind cold. (Rename anyway; docs propping names is admitted debt.)
- **Failed-lines-first-class (D6) delivers real value**: the red line carrying full per-sample `sight_m`/`ssd_m` turns the book's qualitative "turning early restricts your view" into a quantified, per-station comparison — no re-run, no CSV parsing.
- **The one-perturbation rule earns its keep** where it applies: `slow_steer` sharing the identical turn-point station with the good line *is* fig 8.2's central device, for free.
- **Hand-independent `f` + hand-resolved occluder sides**: mirroring a whole scene is a one-token change.
- **The typed-error / `schema_ref` / `--check` lint discipline**: every dead end in the simulations failed loudly with a named path. D8 is the right law; the findings above are places the docs violate their own law, not arguments against it.
- **Colour-from-verdict (D9)** is the right principle — the fixes in §6 are about making the verdicts *derivable*, not about repainting.
- **The decision log format itself** (D1–D10 with supersession rationale) made this entire adversarial review possible. Very few design sets can be attacked this precisely; that is a feature.

---

## 11. Priority order

**P0 — the engine can't be built without these:** lean-unwind semantics (§2.1) · corrective-shot spec (§2.2) · off-road termination (§2.3) · doctrine check catalogue with Tier-1R re-derivations (§2.4) · run-wide slice re-derivation: invariant 5.4.2 boundary, impulse transient, P-ROLLRATE scope (§3) · position-action channel (§3) · corner-relative solver constants (§4).

**P1 — the six figures can't ship without these:** two-strategy authoring (believed-road / accept=best_failing, §8.1) + double-apex verdict carve-out & two-apex verdict recording · `use_full_width` + road options in scene/flags · marker/label grammar extensions (per-line marks, line-addressed callouts) · outcome-pin reconciliation on named fixtures · exit-code/`expect_fail` wiring · oncoming-vehicle placement · `bookDoubleApex` preset + left-hand presets · `ssd`-vs-`a_noreturn` reconciliation.

**P2 — the agent story:** resolved plan in the envelope · `stateAt` verb · sweep over any id-addressed field · FigureSpec JSON door · one mistake-spec grammar · occluder/hazard wire shapes pinned · hazards flag/schema section · `--line-id`/`compare` semantics · cold-start & recipe acceptance tests actually written into 09.

**P3 — strategic:** phasing section in 00 (spine first, POV later) · rubric identity field · share-URL version stamp · POV look-at-limit-point + off-frame rule + gaze placard · fit-my-line front door · variability note.

---

*Method note: findings were produced by 13 independent simulation/critique agents and then adversarially verified by 13 refutation agents with citation requirements; 3 findings died in verification and 42 had severity or scope corrected. Verdicts and full evidence per finding: `review/findings-full.json`.*
