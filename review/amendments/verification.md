## Cluster: Verification Regime (`verification`)

> **EDITORIAL RECONCILIATION (binding) — 2026-07-19 editor pass.** Merged against the
> thirteen sibling amendment sections per the three reconciliation audits. Where the
> body below disagrees with a bullet, the bullet wins.
>
> - **This section WINS:** the oracle reconciliation (single-class pins, one
>   machine-readable table whose normative home is 03 §7.1, structure + bug-sheet's
>   admissible-set/TUNING-PIN mechanism and `ORACLE-PIN-TABLE` test; fixture roster
>   `F-ORACLE-90` / `F-ORACLE-DR` / `F-ORACLE-CHAIN`, book90 left-hand default;
>   solver-refit's `bookEsses-early` folds into `F-ORACLE-CHAIN`); the D8 harness
>   (`verify/effectuality.json`, `T-D8-EXHAUSTIVE`; position-channel's rows migrate
>   in, its `T-D8-ENUM` retired); the `A-CHAIN-VIS-FULL`/`-BUDGET` split (re-based:
>   FULL on `fx-esses-blind`, BUDGET on the zero-gap bookEsses variant); the
>   analytic-acceptance layer, BLESSED write-back, cached solved plans, and judge
>   record machinery.
> - **Merged pins after the rename + Option B:** `premature` (nee early_apex) →
>   `runoff`; `premature_contained` (nee premature) → `contained` + mandatory check
>   fails; `slow_steer` → `runoff`; `fifty_pence` → `wide` + mandatory
>   `single_input` fail; `chop` → `runoff`; `overspeed` → `runoff` (admissible
>   {wide, runoff, crash}). The two contested cells (chop, fifty_pence) remain
>   owner-decision items exactly as §UD1 frames them.
> - **Stamps:** the per-line prediction lives ONCE at line level as `expected:
>   {outcome, result_hash}` (lifecycle's shape); `engine_semver` is figure-level;
>   this section's `solved` member reads both (embedded copies folded — edited in
>   place above). `cache` and `skew` are EXCLUDED from `result_hash` (exclusion
>   list: result_hash, diagnosis, cache, skew) so warm/cold loads hash identically
>   (C-CACHE-HONEST).
> - **Recipe letters:** 08 §6 (g)/(h) are agent-interface's two sweeps; this
>   section's believed-road and double-apex recipes append as (i)/(j) — its
>   A-RECIPE-G/H respelled A-RECIPE-I/J in place.
> - **Basis:** every sight-vs-ssd assertion reads `sight_ride_m` (bug-sheet 9.4);
>   the stopping function is the one exported `ssd(v, phi, model, profile, mu)`.
> - Outcome words: Option B (`crash|runoff|wide|stopped|contained`; `clean` =
>   derived predicate — assertions spelling `outcome clean` read "outcome
>   `contained`, quality `good`").

Owns: review §7 (all bullets), the §5 "does not exist in 09" items (cold-start test, per-recipe
acceptance tests, D8 effectuality conformance), the §9.2 outcome-pin reconciliation, and the
property rescopes other clusters depend on. Primary landing doc: `design/09-verification-and-testing.md`,
with write-backs into 02 §8, 03 §7.1/§8, 05 §7/§8.1, and 01 §4.3.

Section-numbering convention used below: 09 gains one new subsection (§3.2a) and one new top-level
section ("Agent-interface acceptance", inserted after current §7); current §8 (Testing philosophy)
and §9 (Relation) renumber to §9/§10. All other placements are amendments in place.

---

### 1. The analytic-acceptance layer and the golden bootstrap

**Closes:** review §7 bullet 1 (golden bootstrap, CONFIRMED) + the "fixtures raw vs
emission-rounded" minor + the "P-RUNWIDE-UPRIGHT needs a slice-off engine" minor.

**The defect.** 09 §3.2 claims 02 holds "worked numbers"; 02 §8 defers every value to the
not-yet-existing engine; 09 forbids hand-computed goldens and makes analytic cross-checks optional.
The first bless therefore certifies nothing — the engine grades its own homework, and thereafter the
suite detects only drift, never correctness.

**Mechanism — new 09 §3.2a "The analytic-acceptance layer (pre-bless)".**

A closed set of tests whose expectations are **closed-form, hand-computed, and normative** — the
single designed exception to "goldens are blessed, never hand-computed" (the rule inverts here
because the ground truth is arithmetic, not the engine). All A-AN-* tests read **raw pre-emission
samples**, ignore verdicts and doctrine checks entirely, and must be green before any bless is
permitted.

Analytic fixtures (committed under `verify/analytic/`; all `profile: street`, `mu: 1.0`,
`use_full_width: true`, wide carriageway `lane 8` so containment/off-road termination never
interferes with the physics under test):

| Test | Fixture | Road / plan | Closed-form expectation | Tolerance |
|---|---|---|---|---|
| `A-AN-RADIUS` | `F-AN-CIRCLE` | `lane 8 \| S 10 \| R 30 ^270 \| S 10`, start `d=0`, entry `42.17 km/h` (= `sqrt(G·30·tan 25°)` = 11.715 m/s), plan: `turn_in {lean_deg: 25}` at `entry:c1`, `throttle accel=0` at `entry:c1` | On the steady span (from `turn_in + 2·(25°/roll_rate)` to arc end): `kappa = G·tan(phi)/v²` per sample; path radius `1/kappa = 30.000 m`; a circle fitted to `(x, y)` samples has `r = 30.00 m` | identity ≤ 1e-9 relative; `1/kappa` ± 0.001 m; fitted radius ± 0.01 m |
| `A-AN-BRAKE` | `F-AN-BRAKE` | `lane 8 \| S 400`, entry `100 km/h` (27.778 m/s), plan: `brake decel=3.0` at `at_s=50`, held | `stopped` termination at `s* = 50 + (v0² − v_floor²)/(2·3.0) = 177.93 m`; `v(t) = v0 − 3.0·t` at every raw sample before the floor | `s*` ± 0.01 m; `v(t)` ≤ 1e-9 relative |
| `A-AN-ROLL` | `F-AN-ROLL` | `lane 8 \| S 200`, entry `54 km/h` (15 m/s), plan: `turn_in {lean_deg: 30}` at `at_s=20` | ramp duration `30°/roll_rate = 0.600 s`; interior ramp slope = `roll_rate` (50°/s street); zero overshoot; `phi` holds at 30° after arrival; `\|phi_dot\| ≤ roll_rate` throughout (stand-up inactive: `a_cmd = 0`) | duration ± 2·dt (± 0.010 s); slope ± 0.5 °/s (robust to either per-stage-clamp reading — the roll-tracker semantics pin is the physics cluster's); overshoot ≤ 0.01° |
| `A-AN-RK4` | `F-AN-ACCEL` | `lane 8 \| S 400`, entry `36 km/h` (10 m/s), plan: `throttle accel=2.0` at `at_s=0` | `v(t) = 10 + 2t`, `x(t) = 10t + t²` (RK4 is exact on polynomial dynamics — any deviation is a stage-weight/dt wiring bug), `v(s) = sqrt(100 + 4s)` at resampled stations | ≤ 1e-9 relative, all three |

**`P-RUNWIDE-UPRIGHT` restated (no slice-off engine).** The current wording ("byte-identical with
the slice on or off") requires a second engine no schema exposes. Replacement: on `F-AN-BRAKE` and
`F-AN-ACCEL` (`phi = 0` throughout) every sample matches the closed-form pure point-mass prediction
to ≤ 1e-9 relative — the slice's upright contribution is proven zero against the analytic layer, not
against a toggled twin. (The `tanh(|phi|/PHI0)` envelope makes this an identity; the test pins the
implementation to it.) 09 §3.4's entry is replaced accordingly.

**The bootstrap procedure (normative order, 09 §3.2a + a gating sentence in §3.3):**

1. `A-AN-*` green.
2. `D-BOUNDS` green — the a-priori doctrinal bound assertions 02 §8 already states for `C30`,
   promoted to named tests: outcome `clean`; `apex_pct ∈ (50, 90)`; `phi_max ≤ 40.36°` (the street
   reserve); `ellipseMag ≤ 1` at every sample. These are design pins, not goldens: they exist
   before the engine does.
3. Only then is `bless` permitted: **the bless script mechanically refuses (exit 3) unless steps 1–2
   are green in the same invocation.** This is enforcement, not procedure.
4. The bless writes the golden fixtures (raw full-precision f64, captured by a bless-only tap
   *before* emission rounding) **and writes the blessed values back into 02 §8** (below).

**The write-back format (02 §8 gains subsection "8.1 Blessed values (generated)").** Immediately
after the existing quantity list ("Once the engine exists, the golden run pins the following
quantities…" — that sentence stays), 02 §8.1 holds a generated block:

```
<!-- BLESSED:BEGIN engine=<semver> date=<YYYY-MM-DD> -->
| fixture | quantity | value | unit | tol |
|---|---|---|---|---|
| C30 | turn_in_s | … | m | ±0.01 |
| C30 | apex_pct | … | % | ±0.1 |
| … (exactly the quantities 02 §8 enumerates, for C30, C30-chop, C30-trailbrake, C30-DR) |
<!-- BLESSED:END -->
```

Written only by `linelab-bless --write-docs`; hand edits between the markers are forbidden; new test
`T-BLESSED-DOC-SYNC` regenerates the block from the committed fixtures and asserts byte equality
(runs in the normal suite, so 02 can never again claim numbers the fixtures don't hold). This kills
both halves of the circle: correctness is anchored outside the engine (analytic layer + design-pin
bounds), and the "02 holds worked numbers" claim becomes *true by generation* instead of false by
aspiration.

**Fixture-precision rule (resolves the raw-vs-rounded minor).** Golden fixtures store raw doubles;
golden comparisons run raw against the tolerance table; the emission-rounding policy (05 §8.3) is
verified by a separate 05 contract test and never entangled with goldens. The tolerance table
(still one table, in 09 beside the fixtures) gains a category row for **discrete grid-derived
quantities** (coarse-sweep turn-in station, resample-grid apex argmin): exact equality on the pinned
runtime; ± one grid quantum (2 m coarse step / `ds_m`) wherever a cross-runtime comparison is made —
tolerance category must match quantity category. (The full cross-runtime divergence model and
browser harness are flagged as an interaction — see §9 below — not respecified here.)

**Placement.** New 09 §3.2a before Golden numerics. 09 §3.2's sentence
"`02-physics-model.md` defines the canonical scenarios … and their worked numbers" is **replaced**
with: "02 defines the canonical scenarios and the pinned quantity list; the *values* are produced by
the first bless and written back into 02 §8.1's generated block." 09 §3.2's
"never hand-computed into the fixtures" gains "— with one designed exception: the
analytic-acceptance fixtures (§3.2a), whose expectations are closed-form and normative."

---

### 2. The recompute budget: cached solved plans

**Closes:** review §7 bullet 2 (C-RECOMPUTE-BUDGET, CONFIRMED). Chosen mechanism: **(b) cached
solved plans in the FigureSpec**, with the honest arithmetic stated in 09 as rationale.

**The arithmetic (goes into 09 §6 verbatim, so the budget is honest).** One auto-solved line =
`suggestTurnIn` (17 coarse runs) + up to 4 candidates × full solve (1 probe + 16 decel + 16 roll-on
+ 1 self-verify = 34 runs) ≈ up to 153 engine runs. `chainedSolve` multiplies per corner plus its
ascending decel scan; `vis=cautious` wraps the whole chain in up to `vis_max_iterations = 4`
fixpoint passes. The blind-esses figure lands at order **600 engine runs**, each ~2,000 RK4 steps
plus `sightFrom`'s O(stations × occluders) scan per resampled sample. A "coarse" run at `ds_m = 1.0`
costs the same integration as a full run (dt is fixed at 0.005 s). The solve-included 100 ms budget
is therefore off by roughly two orders of magnitude — confirmed, not defended.

**Why (b) and not (a)/(c).** A coarse integrator tier (a) is a second physics: coarse-dt answers can
rank candidates and converge fixpoints differently, making every solver conclusion tier-dependent
and colliding with the one-core honesty stance (`C-ONE-CORE`) and the coarse/fine-disagreement-is-a-
typed-error rule. A bare re-scope (c) leaves D6's load-a-shared-figure story at multi-second stalls
forever. Caching the solver's *conclusion* removes the search while every drawn trajectory is still
produced by the consumer's own engine — and it rides the same version stamp the share-URL skew
contract (review §8.5) needs anyway.

**Mechanism — FigureSpec line entries gain an optional `solved` member** (05 §8.1; mirrored in
03 §8's Figure object):

```
lines: [{ line_id, role, label, source,
          solved?: { spec_hash,                  // fnv-1a over canonical {road_spec, occluders,
                                                 //   hazards, this line's source}
                     plan: [PlanAction…] } }]    // the resolved wire plan, absolute stations,
                                                 //   exactly the 03 §6.1 schema — no apex field,
                                                 //   no trajectory, must pass validate()
```

MERGED placement (05 §8.1 owner): `engine_semver` is the ONE figure-level stamp
(lifecycle's home; this member's per-line copy folds up), and the prediction block
is the ONE line-level `expected: {outcome, result_hash}` stamp (lifecycle's shape;
this member's embedded copy folds in — the load rule below already treats them as
the same block). `solved` must not ship without both stamps present.

- **Written** automatically by `scene` bake and `export --as share-url|envelope` for every
  `solve`- and `mistake`-sourced line (mistake lines cache the compiled plan).
- **Load semantics.** Valid iff `engine_semver` equals the running engine's **and** `spec_hash`
  recomputes equal. Valid → skip the search, run the engine **once** on the cached plan, compute the
  verdict fresh; if the fresh outcome ≠ `expected.outcome` or hash ≠ `expected.result_hash`, render
  the divergence placard (the lifecycle cluster's §8.5 machinery — deliberately the same `expected`
  block). Invalid → drop the cache and re-solve.
- **Never silent (D8).** `LineResult` gains `cache: "hit" | "stale_engine" | "stale_spec" |
  "absent"`; a dropped cache always produces this provenance record plus a viewer placard.
- **D6/D7 intact.** A cached plan is an *input* by the provenance rule: it is a wire plan (03 §6
  schema), carries no trajectory and no apex field, and must pass `validate` unchanged
  (`P-EMERGENT-APEX` applies to it like any plan). Consumers still recompute every drawn line; what
  is cached is the search's conclusion, never the engine's output. The system still never ships a
  trajectory the engine didn't produce.

**Budget tests (09 §6 — the `C-RECOMPUTE-BUDGET` entry is replaced by three):**

- `C-RECOMPUTE-BUDGET` (rescoped): largest committed figure, **warm cache** — all-lines recompute
  ≤ 100 ms (× 3 CI machine-variance multiplier, TUNING). This is the D6 share-and-recompute
  tripwire, now honestly scoped to the path shared figures actually take.
- `C-COLDSOLVE-BUDGET` (new): same figure, cache dropped — full re-solve ≤ 10 s (TUNING) wall
  clock. A regression tripwire, not an interactivity promise; the viewer must show progress on this
  path (07's contract, referenced not respecified).
- `C-CACHE-HONEST` (new): for every committed figure, warm and cold paths produce tolerance-equal
  trajectories and **identical** outcome classes and check verdicts — the cache may change the
  time, never the answer. Runs on every re-bless.

---

### 3. Oracle base fixtures and the one outcome table

**Closes:** review §7 bullet 3 (oracle base scenarios, CONFIRMED) + §9.2 (01 vs 03 pin
disagreement). Coordinates with: the corrective-shot cluster (the wide/runoff boundary is decided by
corrective feasibility — the table below is that spec's *acceptance surface*).

**Named base fixtures (committed; 09 §4 and 03 §7.1 both reference them by name):**

- `F-ORACLE-90` — preset `book90`, entry 34 km/h, profile `street`, `mu 1.0`; good line = default
  `solve` (the R1 context). Base for `premature_contained`, `premature`, `slow_steer`, `fifty_pence`, `chop`.
- `F-ORACLE-DR` — preset `bookDecreasing`, entry 34 km/h, `street`. Base for `overspeed`.
- `F-ORACLE-CHAIN` — preset `bookEsses`, entry 32 km/h, `street`; chained `premature`
  `scope: "all_corners"`. The chained-oracle fixture review §4 notes is missing.

**The ONE table (normative home: 03 §7.1 — its outcome column is replaced; 01 §4.3's table keeps
its teaching prose but its outcome column becomes descriptive with a pointer: "normative
single-class pins and fixtures: 03 §7.1").** Every pin is a **single** class — the "wide/runoff"
double-pins are resolved; "roll-rate-limited" is stricken as an outcome (it survives only as
`diagnosis.cause: roll_rate_limited`).

| Kind | Fixture | Pinned outcome | Mandatory check failure (`expect_fail`) |
|---|---|---|---|
| `premature_contained` | `F-ORACLE-90` | `contained` (+ mandatory check fails — Option B re-key of the old `violation` cell) | `late_apex` (+ the out-in-out check, id per doctrine-catalogue cluster) |
| `premature` | `F-ORACLE-90` | `runoff` | — (the outcome *is* the lesson) |
| `slow_steer` | `F-ORACLE-90` | `runoff` | the steer-rate check (id per doctrine-catalogue cluster — this row is the reason that check cannot stay WARN-only) |
| `fifty_pence` | `F-ORACLE-90` | `wide` | `single_input` |
| `chop` | `F-ORACLE-90` | `runoff` | the chop-keyed check (id per doctrine-catalogue cluster) |
| `overspeed` | `F-ORACLE-DR` | `runoff` | — |
| `premature` @ `all_corners` | `F-ORACLE-CHAIN` | `runoff` at the final corner | — (per-corner compounding metric: slot reserved for the chained-mistake cluster) |

**Rules attached to the table (03 §7.1 text):** (i) pins are design pins in the invariant-first
style of 02 §5.4 — each kind's TUNING default params are *servants to the pin*: if the defaults
don't produce the pinned class on the named fixture, the params move (a TUNING re-tune landing via
re-bless), never the pin; (ii) `premature → runoff` on `F-ORACLE-90` is a stated requirement on the
corrective-shot spec (the corrective must be infeasible there) — the oracle is what makes that spec
falsifiable; (iii) a pin flip is a design change, full stop.

**09 §4 amendment.** "Every mistake preset … asserts the outcome class matches the pinned table" now
names the table above as *the* pinned table and the fixtures as its scenarios; the reconciled-both-
ways rule and the iron rule are unchanged.

---

### 4. Vision-judge machinery

**Closes:** review §7 bullet 4 (PARTIAL — machinery gap real; not an automated CI merge-gate, per
the verifier note). Design stance: **the judging is workflow under a pinned identity; CI gates
deterministically on committed judge records.** 09 §7 gains four subsections.

**§7.1 Judge identity.** Committed `verify/judge.json`:
`{ judge_model, judge_model_version, rubric_version, temperature: 0, attempts: 3 }`.
A judge record produced under any other identity is invalid.

**§7.2 The operationalized rubric (closed checklist; each item `pass | fail | na` + one-line
evidence).** The judge receives the PNG *and* the figure's manifest (view spec, per-line verdict
classes, marks setting, occluder presence) — it confirms the picture against declared facts, it
never re-derives physics:

- `J1 colour-verdict` — every line's rendered colour matches its manifest-declared verdict class
  under the D9 mapping.
- `J2 markers` — hourglass turn-point / ring apex / dot exit present per the `marks` setting, each
  on its line, none floating.
- `J3 labels` — every callout anchored at its declared anchor; none floating, clipped, or swallowed.
- `J4 sight grammar` — when occluders are present: dashed rays from each line's eye to its limit
  point; occluded region shaded.
- `J5 mistake legibility` — each mistake-role line visually reads as the error it teaches (the one
  genuinely judgmental item).
- `J6 projection disclosure` — `diagram` mode only: disclosure note present; the compressed figure
  still reads physically sensible.
- `J7 no fabrication` — nothing drawn that the manifest doesn't declare.
- `J8 legibility floor` — lines distinguishable and text readable at the 2× raster.

Overall `verdict: "fail"` iff any item fails; `na` items never fail a figure.

**§7.3 The record schema** (committed as `figures/<figure_id>.judge.json`):

```
{ judge:  { judge_model, judge_model_version, rubric_version },
  figure: { path, spec_hash, result_hash },
  attempts: [ { attempt, items: [{ id, verdict: "pass"|"fail"|"na", evidence }] } ],
  items:   [ { id, verdict, flaky? } ],      // per-item majority over attempts
  verdict: "pass" | "fail" }
```

**§7.4 Flake policy and determinism.** Three independent attempts; per-item verdict = 2-of-3
majority; any split item is marked `flaky: true` and is a **rubric defect** to tighten (a checklist
item that flakes is under-operationalized). CI never invokes the judge: the deterministic gate is
new test `T-JUDGE-RECORD` — every committed/exported figure has a committed judge record whose
`spec_hash`/`result_hash` match the current figure and whose judge identity matches
`verify/judge.json`; missing or stale → exit 3 (the existing test/gate tier). Judging runs in the
authoring and re-bless workflows; its record is committed like a golden.

**Judge-version bump.** Editing `verify/judge.json` invalidates every record → a **re-judge
ceremony** mirroring §3.3's re-bless: one dedicated commit re-judging all figures and enumerating
every verdict flip; a pass→fail flip on an unchanged figure is a finding (figure or rubric) resolved
by human arbiter before the commit lands.

09 §7's carried sentence "the subagent's visual verdict — not the arithmetic — is the gate" is
scoped in place: "…is the gate *for done in the authoring workflow*; in CI, the deterministic
`T-JUDGE-RECORD` check stands in for it."

---

### 5. Property and acceptance-test fixes

**Closes:** review §7 bullet 5 (P-SIGHT-EYE / A-CHAIN-VIS / D8-effectuality, all CONFIRMED) + the
"solver-intent tests never state their quantifier" minor; supplies the rescopes other clusters need.

**5.1 `P-SIGHT-EYE` → three tests (09 §3.4 entry replaced).**

- `P-SIGHT-PURE` (full fuzzing): `sightFrom` is pure and deterministic; `sight_m ≥ 0`;
  `s_limit ∈ [s_eye, road_end]`; first-blocked semantics (re-emergent visibility past a gap never
  counts).
- `P-SIGHT-INSIDE-MONOTONE` (scoped quantifier): fuzzed over roads whose occluders are all
  `inside`-side relative to the corner containing the eye's station, with no `vehicle` footprint in
  the oncoming lane — moving the eye laterally outward never shortens `sight_m`. This is the
  hold-wide doctrine's geometric premise, stated with the hypothesis it actually needs.
- `F-SIGHT-OUTSIDE` (directed educational fixture): an outside wall past which widening *shortens*
  sight — asserted as such, pinning the non-monotone reality so nobody "fixes" it back into the
  property.

**5.2 `P-VIS-MARGIN-MONOTONE` (09 §3.5).** Quantifier: **named fixtures only** (`bookBlind`,
`fx-esses-blind` — MERGED: scene-vocabulary's fixture subsumes and retires
`F-CHAIN-VIS-GAPPED`) — never fuzzed (each evaluation is a full solve, and the property is false
under adversarial outside/oncoming occluders). Edge pin added: where a raised `vis_margin` governs
speed below `v_floor`, the expected result is a typed `NO_SOLUTION` with sub-reason
`vis_speed_below_model_floor` (solver-refit SR-7's closed-registry spelling), never a
`stopped` run.

**5.3 Solver-intent quantifiers (09 §3.5 preamble).** Every §3.5 test now states its quantifier:
`P-CONSTRAINT-BINDING` runs on the R6 fixture family with fuzzed *constraint values* (road fixed);
all others are fixtures-only. (Closes the quantifier minor.)

**5.4 `P-EXPORT-DETERMINISM` (09 §3.1).** Quantifier made explicit: committed scene corpus + fuzzed
scenes, pinned runtime and tool version. Added clause: **cache independence** — warm-cache and
cold-solve exports of the same figure are byte-identical (the SVG embeds no timings or solve-path
provenance); enforced alongside `C-CACHE-HONEST`.

**5.5 `A-CHAIN-VIS` → two fixtures (09 §3.5 entry replaced).** The current single assertion fails
by construction on `bookEsses` (zero gaps) because 04 §6's own carve-out says the hold is
budget-limited there.

- `A-CHAIN-VIS-FULL` on `fx-esses-blind` (MERGED: the respecified 4-corner S-6
  `bookEsses` + hedges — scene-vocabulary's fixture; the separately-minted
  `F-CHAIN-VIS-GAPPED` := `lane 3.5 | S 8 | L 12 ^75 | S 12 | R 12 ^75 | S 12 | L 12 ^75 | S 10` is RETIRED as a duplicate) + a hedge inside each
  corner, entry 32 km/h (geometry TUNING; gaps sized so `vis_hold_f` is reachable under the 03 §6.1
  lateral budget): over each corner's hold window, `f ≥ vis_hold_f − f_tol` (`f_tol = 0.05`,
  TUNING); each hold-release station satisfies `trend = opening ∧ sight_ride_m ≥ vis_margin · ssd_m`; V1
  (`vis_margin · ssd(v, phi).ssd_m ≤ sight_ride_m`) holds at every station of the chain
  (MERGED basis: bug-sheet 9.4 — every sight-vs-ssd judgment reads `sight_ride_m`).
- `A-CHAIN-VIS-BUDGET` on the named ZERO-GAP bookEsses variant fixture (MERGED — the preset itself is now 4 corners with S 6 links, so the phrase "on bookEsses (zero gaps)" is struck; the variant is scene-vocabulary's A-LINK-FLIP fixture): asserts the carve-out itself — the solver report
  marks each hold `budget_limited: true`; achieved `f` is monotone toward the target across each
  inter-corner span; the release condition is evaluated from the **actual** position; V1 still
  holds at every station. Requires the solver to record per-corner
  `{ corner_id, target_f, achieved_f, budget_limited, hold_release_s }` — home
  `verdict.sight.holds: […]`, pinned by the §0 merged Verdict and corner-exit's
  banner (the field spells `hold_release_s`, never `release_s` — that name is
  the per-commitment member of `corners[].turn_ins[]`).
- `A-SOLVED-PLAN-VALIDATES` (new, general): every solver-emitted plan — `solve`, `chainedSolve`,
  vis mode, `solveDoubleApex`, mistake compiles, and every cached `solved.plan` — passes
  `validate` unchanged. This pins the zero-length-span position/turn_in-overlap wrinkle as a solver
  bug class regardless of which resolution the solver cluster picks.

**5.6 The D8 effectuality harness (09 §9 — replaces the current §8 effectuality bullet's
aspiration with a mechanism).** 03 §6.1 promises this spec exists in 09; it now does. The
obligation is made **decidable** by inverting the quantifier: not "effectual on all scenarios" but
"demonstrably effectual on a *named witness*", exhaustively over the closed field enumeration.

Committed witness table `verify/effectuality.json`, one row per schema-accepted field:

```
rows: [{ id,
         surface: "scenario"|"plan"|"road-dsl"|"occluders"|"hazards"|"mistakes"|"solve"|"scene"|"view"|"cli",
         field,                                  // schema path, e.g. "rider.plan[].over_m"
         fixture,                                // named witness fixture
         perturbation: { from, to } | "presence",
         effect_class: "trajectory"|"verdict"|"sight"|"render"|"envelope",
         expect: "effect" | "reject:<CODE>/<reason>" }]
```

Harness semantics: for `expect: "effect"`, run the witness fixture with and without the
perturbation and assert an observable difference per `effect_class`; for `reject`, assert
`validate` returns exactly the typed code + reason. The per-class difference predicate
`effectAt(class, before, after)` — thresholds included — is **owned by the position-channel
cluster**; this harness consumes it. The `envelope` class (value carried verbatim into the output —
`meta`, labels, `note`) and `render` class (changes the drawn artifact) resolve the review's
"labels/meta would be INEFFECTUAL under a literal reading" objection: passthrough and presentation
are observable effects with their own detectors.

Exhaustiveness: `T-D8-EXHAUSTIVE` — every field path the `schema` verb prints appears in exactly
one row of the witness table (schema-driven enumeration: adding a schema field without a witness
fails CI). Together the two tests are the conformance mechanism D8 advertises: finite fixtures,
closed field set, decidable verdicts.

---

### 6. Agent-interface acceptance: cold start and recipes

**Closes:** review §5's "the cold-start test and per-recipe acceptance tests 08 twice delegates to
09 do not exist in 09" (CONFIRMED). New top-level 09 section "Agent-interface acceptance", inserted
after §7 (current §8/§9 renumber to §9/§10).

**6.1 The cold-start test (`T-COLDSTART`).** Operationalizes G4/08 §2 and resolves 08's two
contradictory statements of the bar. Normative definition (08 §2's "nothing but the printed
`schema` output" sentence is conformed to this):

- **Context:** a fresh agent context (identity pinned in `verify/coldstart.json` —
  `{ agent_model, agent_model_version, attempts: 3 }`, same pattern as the vision judge) containing
  only the complete `linelab schema` output. During the attempt the agent may freely invoke
  `schema`, `explain`, and `check`; it may not read design docs, examples, source, or the book.
- **Tasks:** one per recipe, phrased as *goals* (never commands) — e.g. "produce a two-line figure:
  ideal line plus an early-apex mistake on this road; emit the envelope".
- **First-try, defined:** the first non-lint invocation (`run` / `solve` / `scene` / `sweep` /
  `compare`) must satisfy the task's mechanical acceptance predicate. `schema`/`explain`/`check`
  calls are free — self-documentation is the designed path; trial-and-error against the engine is
  what the bar forbids.
- **Pass bar:** 3 attempts per task; release bar = 3/3. A 2/3 is recorded `flaky` and is a
  **schema-text defect** (the `schema` output is the artifact under test) — fixed there, never by
  loosening the bar.
- **Trigger:** at release, and whenever the hash of the full `schema` output changes. Never
  per-commit. Deterministic CI leg: `T-COLDSTART-RECORD` asserts a committed record exists whose
  `schema_output_hash` matches the current binary's output (same committed-record pattern as
  `T-JUDGE-RECORD`).

**6.2 Per-recipe acceptance tests (`A-RECIPE-*`).** Deterministic, agent-free. The harness
**extracts the command blocks from 08 §6 verbatim and executes them** — the doc text is the test
input, so a recipe edit that breaks behaviour fails CI and recipe rot is structurally impossible
(this subsumes a separate doc-sync check). Assertions per recipe (each also written as the narrated
walk-through 09's educational-test rule demands):

- `A-RECIPE-A` (ideal line): exit 0; one `ideal` line; outcome `clean`; `apex_pct ∈ (50, 90)`;
  events include brake, turn-in, apex.
- `A-RECIPE-B` (ideal + mistake overlay): exit 0 (`expect_fail`/gate wiring per the exit-code
  cluster); two lines; mistake line outcome = the §3 table's `premature` pin (`runoff`); render
  exit 0; proportion gate passes in `diagram` mode.
- `A-RECIPE-C` (blind compare): both solves succeed; over the shared approach span,
  `min(sight_m − ssd_m)` is strictly larger on the governed line; governed entry speed is lower;
  both verdicts present in the compare output.
- `A-RECIPE-D` (linked chain + per-corner mistake): the chained ideal line grades by the
  chain-aware set to the green class (class name per the outcome-vocabulary cluster); the mistake
  line's per-corner deviation **increases** corner-over-corner (compounding, measured — metric per
  the chained-mistake cluster).
- `A-RECIPE-E` (named book figure): scene bake exit 0; two lines; SVG written; proportion gate
  passes; manifest shows hourglass/ring/dot markers and per-line sight rays (occluder present);
  `T-JUDGE-RECORD` satisfied for the exported figure.
- `A-RECIPE-F` (constraint recipe, R6 — exists on disk): satisfiable arm — verdict `constraints`
  block records `satisfied: true`, non-negative margin, tightest station; refusal arm (a tightened
  variant fixture) — exit 3, `NO_SOLUTION`/`constraint_unmet` naming the constraint id and worst
  station.
- `A-RECIPE-I` — **reserved slot**: believed-road / misjudgment recipe (fixture slot
  `F-BELIEVED-90`); assertions pinned by the misjudgment cluster (executed line grades a failing
  class; envelope carries believed-vs-actual provenance).
- `A-RECIPE-J` — **reserved slot**: double-apex recipe (preset slot `bookDoubleApex`); assertions
  pinned by the double-apex cluster (two recorded lane-fraction minima; green class under the
  double-apex carve-out).

---

### 7. The development-phase note (honouring the REFUTED finding)

Appended to 09 §3.3, one paragraph: "**Development phase.** The ceremony is per-commit, never
per-iteration: during a designed migration's search, constants and expectations co-evolve freely in
the working tree — the 02 §5.4 invariants and the pinned oracle classes are the fixed points the
search serves — and the tripwire binds only committed fixtures. Batching any number of TUNING moves
into one re-bless commit is the designed procedure; pre-first-bless there is nothing to drift from,
and the analytic layer (§3.2a) is what correctness means until the first bless."

---

### 8. Placement map (doc → change)

| Where | Change |
|---|---|
| 09 §1 | Coverage list adds the analytic layer and the agent-interface acceptance section. |
| 09 §3.1 | `P-EXPORT-DETERMINISM` gains its quantifier + cache-independence clause. |
| 09 §3.2a (new) | Analytic layer, fixtures, bootstrap order, bless gating, write-back spec. |
| 09 §3.2 | "02 … worked numbers" sentence replaced; hand-computed exception clause; raw-f64 fixture rule; discrete-quantity tolerance category. |
| 09 §3.3 | Bless-refuses-unless-analytic-green sentence; development-phase paragraph. |
| 09 §3.4 | `P-SIGHT-EYE` → `P-SIGHT-PURE` + `P-SIGHT-INSIDE-MONOTONE` + `F-SIGHT-OUTSIDE`; `P-RUNWIDE-UPRIGHT` restated against the analytic layer. |
| 09 §3.5 | Quantifier preamble; `P-VIS-MARGIN-MONOTONE` rescope + `v_floor` edge; `A-CHAIN-VIS` → `-FULL`/`-BUDGET` pair; `A-SOLVED-PLAN-VALIDATES`; D8 bullet → pointer to the harness. |
| 09 §4 | Oracle runs the named-fixture table; sentence naming 03 §7.1 as the single pinned table. |
| 09 §6 | `C-RECOMPUTE-BUDGET` entry → the three budget tests + the honest run-count arithmetic. |
| 09 §7 | Gains §7.1–§7.4 (judge identity, rubric, record schema, flake/CI policy, re-judge ceremony); "visual verdict is the gate" sentence scoped to workflow. |
| 09 new §8 | Agent-interface acceptance: `T-COLDSTART`, `T-COLDSTART-RECORD`, `A-RECIPE-A…H`. Current §8/§9 renumber. |
| 09 §9 (was §8) | Effectuality bullet replaced by the witness-table harness + `T-D8-EXHAUSTIVE`. |
| 02 §8.1 (new) | "Blessed values (generated)" block with `BLESSED:BEGIN/END` markers; `T-BLESSED-DOC-SYNC`. |
| 03 §7.1 | Outcome column → single-class pins + fixture column; params-serve-pins rule; corrective-acceptance note. |
| 03 §8 / 05 §8.1 | FigureSpec `lines[].solved` cache member. |
| 05 §7 | `LineResult.cache` status field. |
| 01 §4.3 | Outcome column marked descriptive; pointer to 03 §7.1 as normative. |
| 08 §2 | Cold-start bar sentence conformed to 09's normative definition (schema preloaded; `explain`/`check` callable). CLI cluster executes the edit. |

### 9. Contract impact (exact shapes)

- **FigureSpec** `lines[].solved?: { engine_semver, spec_hash, plan: [PlanAction…], expected:
  { outcome, result_hash } }` — shared surface with the lifecycle cluster's share-stamp (§8.5);
  the `expected` block is deliberately the same one.
- **LineResult** `cache: "hit" | "stale_engine" | "stale_spec" | "absent"`.
- **Verdict** `sight.holds: [{ corner_id, target_f, achieved_f, budget_limited,
  hold_release_s }]` — needed by `A-CHAIN-VIS-BUDGET`; pinned per the §0 merged Verdict
  (`hold_release_s`, distinct from the per-commitment `release_s` in `corners[].turn_ins[]`).
- **NO_SOLUTION sub-reason** `vis_speed_below_model_floor` (solver-refit SR-7's
  registry spelling, adopted).
- **Committed verify/ artifacts** (not wire): `verify/judge.json`, `figures/<id>.judge.json`,
  `verify/coldstart.json` + record, `verify/effectuality.json`, `verify/analytic/` fixtures.
- **02 §8.1 generated block** with `BLESSED:BEGIN/END` markers.

### 10. Decision drafts (editor numbers them)

1. **Analytic-first bless.** *Every bless — including the first — is mechanically gated on a
   closed-form analytic-acceptance layer; hand-computed expectations are permitted exactly there
   and nowhere else; blessed values are written back into 02 §8 by the bless script and doc-synced
   by CI.* Rationale: the golden regime otherwise certifies drift, not correctness — the first
   bless was the engine grading its own homework, and 09's claim that 02 held worked numbers was
   false. Anchoring correctness in arithmetic outside the engine closes the circle; the write-back
   makes 02's claim true by generation.
2. **Solved plans are shareable inputs.** *A FigureSpec may carry each line's solver-resolved wire
   plan, stamped with `engine_semver` + `spec_hash` and an `expected` outcome; consumers on a cache
   hit recompute the trajectory (one engine run), never the search; any mismatch drops the cache,
   re-solves, and records/placards the fact.* Rationale: the honest cost of a vis-chained figure is
   ~600 engine runs — two orders past the 100 ms recompute budget; caching the search's conclusion
   preserves D6 (trajectories never ride the wire; every drawn line is engine-produced on the
   consumer's machine) and D7 (a cached plan is a plan: apex-free, validated), while a coarse
   integrator tier would have been a second physics.
3. **Nondeterministic judges commit records; CI checks records.** *Vision-judge and cold-start
   verdicts are produced in workflow under pinned model identities with an N-of-M flake policy, and
   committed; CI gates deterministically on record presence and hash match.* Rationale: an
   LLM-sampled verdict cannot be a deterministic merge gate, but its committed record can — the
   same discipline goldens already use. (May merge with the lifecycle cluster's stamp decision if
   the editor prefers one provenance entry.)

### 11. User decisions

1. **Single-class oracle pins.** The formerly ambiguous kinds must each pin one class on the named
   fixture: proposed `premature → runoff`, `slow_steer → runoff`, `fifty_pence → wide`,
   `chop → runoff`, `overspeed → runoff`. These become design pins the TUNING search must serve;
   flipping one later is a design change. **Recommendation:** accept as proposed —
   `fifty_pence → wide` is the least certain (the book's 8.3 line wanders but survives); if the
   owner prefers maximal book-drama, `runoff` is defensible, but `wide` + mandatory `single_input`
   failure keeps the kind's lesson (the check) distinct from `slow_steer`'s (the outcome).
2. **Cold-start release bar.** 3/3 attempts per task (flake = schema-text defect) vs a softer 2/3.
   **Recommendation:** 3/3 at release, cold-start runs only on schema-output-hash change or
   release — the bar is the product claim G4 makes; a schema that teaches two times out of three
   is a defect, not a pass.
3. **Cache blocks in share URLs by default.** `solved` blocks add roughly 200–400 bytes per line
   post-deflate to `#f=` URLs. Include by default with a `--no-cache` opt-out, or opt-in?
   **Recommendation:** include by default — the entire point is that a shared vis-chained figure
   opens in 100 ms instead of ~10 s; the URL cost is trivial against that, and version skew is
   already handled by the stamp + placard.

### 12. Interactions (shared surfaces touched)

- `FigureSpec.lines[].solved` + `expected: {outcome, result_hash}` + `engine_semver` — lifecycle /
  share-stamp cluster (same stamp, same placard).
- `LineResult.cache` enum; `resolved_scenario` adjacency — agent-interface cluster (the cached plan
  *is* the resolved plan promoted to input; shapes must match).
- `verdict.sight.holds` per-corner hold record — solver/vis cluster.
- `NO_SOLUTION` sub-reasons: `constraint_unmet` (existing), `vis_speed_below_model_floor`
  (new; SR-7's registry spelling) — solver cluster.
- Outcome classes RESOLVED (Option B): the chain-aware green reading is outcome `contained` +
  quality `good` (`A-RECIPE-D` asserts exactly that; `clean` is the derived predicate; any
  remaining `outcome clean` spelling in this file reads as that pair).
- Check ids consumed by the oracle table and recipes: `late_apex`, `single_input`,
  `stop_within_sight`, the steer-rate and chop-keyed checks — doctrine-catalogue cluster (the
  `slow_steer` row requires the steer-rate check not be WARN-only).
- `effectAt(class, before, after)` difference predicate — position-channel cluster (harness
  consumes it).
- Mistake kind names — pedagogy/rename cluster (the oracle table re-keys wholesale on rename;
  fixtures and pins are name-independent).
- 02 §8 generated block markers — physics cluster owns 02's text.
- 08 §6 recipe command blocks as verbatim test inputs; 08 §2 cold-start sentence — CLI cluster.
- Exit tier 3 for `T-JUDGE-RECORD`/gate failures; `expect_fail`-aware `--gate` in `A-RECIPE-B` —
  exit-code cluster.
- Preset/fixture name slots: `bookDoubleApex`, `F-BELIEVED-90` — double-apex and misjudgment
  clusters.
- Cross-runtime divergence model + browser harness: flagged, not respecified here — the
  discrete-quantity tolerance category (§1) is this cluster's contribution; the divergence-channel
  spec belongs with the determinism owner.
