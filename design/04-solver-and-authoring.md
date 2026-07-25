# Solver & Authoring

## 1. What this document covers

How authored intent becomes a validated line: the **authoring ladder** (from one
command to scene text), **turn-in suggestion**, the **solve pipeline** with its
**corner-relative derived stations** and self-verification,
**constraint-targeted solving**, the specialized solvers including
**`solveDoubleApex`**, **believed-road solving** (misjudgment),
the **acceptance policy** (`accept=best_failing`), the **authored-plan merge
contract**, the closed **`NO_SOLUTION` sub-reason registry**, the **corrective
shot** (the machinery that decides `wide` vs `runoff`), the out-of-hash
**reserve-lean save window** (§4b), the closed **counterfactual rider registry**
(§4c), the gated **commitment escape** (§4d), **chained-corner
solving** with **chained-mistake seeding**, the **visibility-governed mode**
with its authorable knobs, the **scene text format**, the canonical **agent
workflows**, and the deferred **fit front door** sketch (§10).

The governing thesis is carried verbatim from the prior design: **physics is the
validator, not the generator.** An author supplies only physical inputs — a road
(or a believed road), a turn-in (or `auto`), an entry speed, optionally a mistake
perturbation. Apex, exit, lean, outcome, and diagnosis emerge from running the
real engine, and every solver re-runs the engine on its own output before
reporting success.

Owned elsewhere: the wire schema, mistake-kind vocabulary, and the one outcome
pin table (`03-roads-scenarios-and-visibility.md`), the physics the solvers
shoot through including the steering machine and lateral tracker
(`02-physics-model.md`), the doctrine check catalogue
(`01-scope-and-doctrine.md` Appendix A), the result envelope
(`05-result-contract-and-inspection.md`), view/projection details
(`06-rendering-and-projection.md`), and the CLI surface over these functions
(`08-cli-and-agent-interface.md`).

---

## 2. The authoring ladder

Four rungs, most-automated first. Every rung compiles down to the same wire
scenario and runs the same engine; the rungs differ only in how much the author
specifies.

**(a) One-command ideal line.** `solve({road, entry_kmh})` — road (DSL string or
preset name) plus entry speed; turn-in defaults to `auto`. On a multi-corner
road this chains by default across each linked run of corners (§5). Returns the
solved, self-verified late-apex line with its full result. This is the front
door and the agent default.

**(b) Mistake one-liner.** A solved context plus `compileMistake(kind, params?)`
— e.g. `mistake premature:early_by_m=6` — yields the failed line. No
hand-authoring of bad inputs, ever.

**(c) Explicit plan.** A full scenario JSON (`03-…md` §6) for authors who want
manual control of every action. Same validation, same engine, no privileged path.

**(d) Scene text.** A `.scene` file binding one road to N lines plus labels and a
view spec (§7). **The ergonomic bar, carried:** a compound multi-line teaching
figure in **≤ 6 lines of scene text** plus one bake command.

---

## 3. Turn-in suggestion (`suggestTurnIn`)

Answers "where should I turn in?" without a full solve per candidate — the
coarse-sweep-then-full-solve shape is carried:

1. **Coarse sweep:** one cheap engine run per candidate turn-in station —
   `N_SWEEP = 12` (TUNING) candidates evenly spaced over the derived sweep span
   of §4.1a, spacing floored at `SWEEP_STEP_MIN_M = 0.5 m` (TUNING; candidates
   dropped, span kept) — at coarse resolution (`ds_m = 1.0`, a resolution, not a
   station, unchanged). Filter to candidates that stay contained (no inside cut,
   no run-off) with an emergent apex in the corner type's plausible band (table
   below).
2. **Rank** the surviving band by `|apex_pct − target_apex_pct(type)|`.
3. **Full-solve the top 4** at full resolution; return the first that verifies
   clean.
4. On failure, return a typed `NO_SOLUTION` distinguishing `empty_band` (no
   contained candidate exists — the road/speed combination is the problem) from
   `non_clean_band` (candidates exist but none verifies — solver brackets or
   profile are the problem). Sub-reason registry: §4.10.

**Corner-type-aware targeting.** `compose` stamps each corner record with
`type ∈ constant | decreasing | increasing` (detected from `r1/r2` against
`TAPER_RATIO_MIN = 1.15`, TUNING — a road property, not a solver guess:
`03-…md` §2), so every line on the road grades against the same corner type.
The target table (all values TUNING):

| `type` | `target_apex_pct` | plausible band (coarse filter) | note |
|---|---|---|---|
| `constant` | 58 (carried — the doctrinal late apex) | 20–90 (carried) | late bar 50 % |
| `decreasing` | 70 | 62–92 | the doctrine bar is > 60 % (`01-…md` §5); the target sits past the bar with margin, so ranking and check agree instead of fighting |
| `increasing` | 40 | 15–85 | `late_apex` reads `na` here (`01-…md` §5); the target only orders candidates |

On `bookDecreasing` the ranking prefers candidates that pass the applicable
check, and a genuine failure blames the road/speed, not a mis-aimed target —
closing the spurious non-clean-band mode.

The coarse/fine discipline is normative: any coarse-stage winner **must** be
re-verified at full resolution, and a coarse/fine disagreement is a typed error
(`coarse_fine_disagreement`), never a silently-shipped line.

---

## 4. The solve pipeline (`solve`)

### 4.1 What it searches

Two near-independent, monotone controls, each bisected against a target measured
off the engine's own emergent verdict:

| Control | Target (emergent) | Direction |
|---|---|---|
| brake `decel` | apex lean = `lean_frac × reserve` | lean falls as decel rises |
| roll-on onset station | exit lane fraction `exit.f = exit_target` | exit f falls as roll-on moves later |

Defaults (TUNING, carried): `lean_frac 0.70` (slow-in doctrine — apex lean at 70 %
of the street reserve, ≈ 28° with the street profile), `exit_target 0.85`
(driven out to the outside but contained; linked interior corners retarget the
exit at the next corner's doctrinal entry — §5), decel bracket `2.4–3.8 m/s²`
(carried, fit-clipped per §4.1a), 16 bisection iterations per control, railing
cleanly to a bracket bound when a bisection *target* is unreachable. Every
station quantity — sweep span, brake gap, crack gap, roll-on bracket — is
derived per corner from the reference lengths of §4.1a; a bracket that
*degenerates* after clamping is the typed `road_too_short` refusal, never a
silent rail.

Two sequential bisections instead of a joint optimizer, carried with its
justification: the controls decouple (moving roll-on shifts the apex < 1 %), so
decel sets apex/speed first and roll-on trims the exit independently.

### 4.1a Derived stations and the `road_too_short` refusal

Every solver station constant is a fraction of per-corner reference lengths,
computed once per corner from the composed `RoadModel` (all derivable from
fields `03-…md` §2 mints):

```
L_arc(n)  = s1(n) − s0(n)                      // arc length as composed (works for tapers)
L_app(n)  = s0(n) − max(0, s1(n−1))            // approach available to corner n
L_exit(n) = min(road_end, s0(n+1)) − s1(n)     // exit available to corner n
gap(n)    = s0(n+1) − s1(n)                    // inter-corner gap (= L_app(n+1))
```

All fractions TUNING with the defaults shown. `clamp(x, lo, hi)` is ordinary
clamping; every clamp that degenerates a bracket is a typed error (below), never
a silent rail.

| Quantity | Formula | Defaults |
|---|---|---|
| turn-in sweep lower | `s0 − min(SWEEP_BACK_APP_F·L_app, SWEEP_BACK_ARC_F·L_arc)`, clamped ≥ `max(0, s1(n−1))` | `SWEEP_BACK_APP_F = 0.5`, `SWEEP_BACK_ARC_F = 0.35` |
| turn-in sweep upper | `s0 + SWEEP_FWD_F·L_arc` | `SWEEP_FWD_F = 0.25` |
| sweep candidates | `N_SWEEP` evenly spaced over the sweep span; spacing floored at `SWEEP_STEP_MIN_M` (drop candidates, keep span) | `N_SWEEP = 12`, `SWEEP_STEP_MIN_M = 0.5 m` |
| brake_gap | `clamp(BRAKE_GAP_F·L_app, BRAKE_GAP_MIN_M, BRAKE_GAP_MAX_M)` | `0.25 / 1.0 m / 6.0 m` |
| brake onset | earliest available station (road start, or previous corner's exit + `BRAKE_RUN_MIN_M` when `gap` permits — §5) | `BRAKE_RUN_MIN_M = 2.0 m` |
| decel bracket lower (fit clip) | `max(DECEL_LO, decel_min_fit)` where `decel_min_fit = (v_entry² − v_target²) / (2·(s_ti − brake_gap − s_brake_start))` [m/s²] | `DECEL_LO = 2.4`, `DECEL_HI = 3.8` (carried) |
| crack_gap | `clamp(CRACK_GAP_F·L_arc, CRACK_GAP_MIN_M, CRACK_GAP_MAX_M)` | `0.25 / 2.0 m / 8.0 m` |
| roll-on bracket (exit-bisection domain) | `[ max(s_crack + 1.0 m, s_ti + ROLLON_LO_F·L_arc), min(s_ti + ROLLON_HI_F·L_arc, s1) ]` | `ROLLON_LO_F = 0.20`, `ROLLON_HI_F = 0.95` |

`s_ti` is the candidate turn-in station under test; `s_crack = s_ti + crack_gap`.

Rationale for the reference lengths: backward turn-in candidates live on the
approach (fraction of `L_app`, capped by a fraction of `L_arc` so a 200 m
approach does not produce a 100 m sweep); forward candidates and all throttle
stations live in the arc (fractions of `L_arc`). The prior absolute metres are
recovered at R60 scale (24 m ≈ 0.26·94 m arc; +35…+90 ≈ 0.37–0.96·arc), so this
is a re-parameterisation of the same tuning, not a new tuning — and the absolutes
provably emptied the search domain on the book-scale presets (the fig 8.1–8.3
roads).

**The arithmetic fits the presets (normative worked values).** book90
(`lane 3.5 | S 12 | R 12 ^90 | S 16`: L_app 12, L_arc 18.85, L_exit 16), entry
34 km/h: sweep `[6.0, 16.71]` (12 candidates ≈ 0.97 m apart; the old spec
started at −12), brake_gap 3.0 m, crack_gap 4.71 m, roll-on bracket at
`s_ti = 13` `[18.7, 30.85]` (the old `+35…+90` mapped to `[48, 103]` — entirely
off-road). C30 (L_app 35, L_arc 47.12, L_exit 25), entry 70 km/h: sweep
`[18.5, 46.78]`, brake_gap clamps to 6.0 m with the fit clip raising the decel
bracket to `[3.67, 3.8]` (narrow but valid), roll-on bracket `[45.4, 80.8]`.
bookEsses interior corners (`gap = 6`): every derived quantity lands inside the
corner's own span; at a true zero-gap link the backward sweep term vanishes with
`L_app = 0` — turn-in candidates start at the hand-flip boundary, geometrically
correct for esses.

**The typed refusal.** After clamping, each derived quantity is checked: sweep
span < `SWEEP_SPAN_MIN_M = 2.0 m` (TUNING), or roll-on bracket width <
`BRACKET_MIN_M = 1.0 m` (TUNING), or `decel_min_fit > DECEL_HI` (the entry speed
cannot be shed in the available approach at the bracket's hardest decel). Any of
these → `NO_SOLUTION` with `detail.sub_reason = "road_too_short"`,
`detail.quantity ∈ {"turn_in_sweep", "roll_on_bracket", "brake_run"}`,
`detail.corner_id`, `detail.required_m`, `detail.available_m`. The scenario
itself remains schema-valid (an explicit plan may still ride the road); only the
solver refuses, and the refusal names the arithmetic — the D8-honest form of the
old silent bracket overrun.

### 4.2 Pipeline order

1. **Feasibility probe first.** One engine run at nominal decel and mid-bracket
   roll-on (over the derived bracket) asks whether this *turn-in placement* can
   work at all: a line that cuts inside means turn-in too early
   (`turn_in_infeasible_early`); an apex that never comes inside means turn-in
   too late (`turn_in_infeasible_late`). Either short-circuits with the typed
   infeasible reason — a placement problem cannot be braked or throttled away,
   and honest refusal beats a degenerate converged line. (Under
   `accept=best_failing` the probe no longer short-circuits — §4.8.)
2. **Bisect decel**, then **bisect roll-on**.
3. **Self-verify:** re-run the engine on the final plan and return *that* verdict
   verbatim — and self-verification now *includes the exit*: the released,
   unwound exit straight is part of the verified trajectory (`02-…md` §3.1). A
   non-clean self-verification is reported as such (and still renders, so the
   author can see why) and is carried explicitly in the contract as
   `verdict.acceptance = {policy: "clean", met: false}`
   (`05-…md` §6.3); it is never patched. Exit-tier consequences of a non-clean
   result are owned by the one exit table in `08-…md` §3.1.

The solved plan is the canonical four actions — brake (tapering to complete
`brake_gap` before turn-in), an **explicit signed turn-in (`{lean_deg, hand}`,
rewritten from `tangent_inside` by the solver — `tangent_inside` never survives
into a self-verified wire plan)**, maintenance crack, drive roll-on — with no
apex field anywhere (D7). Two implementers reading a solved envelope see the
same signed commitment. Note: the roll-on/exit-f bisection target is now a real
emergent quantity (the unwind exists), and bracket re-tuning stays with §4.1a's
TUNING fractions.

### 4.3 Under Tier 1R (the run-wide slice)

The good-line solve is structurally unchanged by D3: doctrine braking completes
before turn-in, so the stand-up term is inactive on the solved path, and roll-on's
widening keeps its sign (acceleration at lean still widens the arc; the slice
strengthens the transient). Consequences that **are** new:

- Both bisection brackets are re-tuned under Tier 1R (marked TUNING); the
  monotonicity assumptions behind `bisect` must be re-validated empirically as an
  implementation gate (`09-verification-and-testing.md`) before the brackets are
  trusted.
- Any plan that carries brake past turn-in (trail-braking analyses, the `chop`
  and brake-at-lean mistakes) now widens instead of pinching inward — the mistake
  outcome pins in `03-…md` §7.1 reflect this.
- The corrective shot — the "can this run-wide be saved?" counterfactual — is
  specified in §4a; its shadow runs under the same Tier 1R slice, which is
  exactly where adding lean while still decelerating bites.

### 4.4 Specialized solvers

Deliberately separate fixed-plan searches, carried, so the main solve's
feasibility gate stays strict: `solveGeometric` (the mid-apex largest-radius
alternative line, coarse forward search re-verified fine), `solveDoubleApex`
(the planned two-touch line — full mechanism in §4.6; under Tier 1R the
mid-corner stand-up drift between touches, previously impossible for the
point-mass, is representable), and `naive` (the fixed generic-rider baseline;
role `reference`).

### 4.5 Constraint-targeted solving (D10)

A solve spec — single-corner `solve` or `chainedSolve` — may carry declarative
**constraints**: bounds on *emergent* quantities over station spans.

```
constraints: [ { id,
                 span: {from: <anchor>, to: <anchor>} | {at: <anchor>},
                 bound: "f_min" | "f_max" | "v_max_kmh" | "sight_margin_min_m",
                 value } ]
```

Anchors use the one anchor grammar of `03-roads-scenarios-and-visibility.md`
§6.1 (`entry|exit|mid:<cornerId>`, bare id = `entry:` sugar, absolute `s:<m>`
token / wire `at_s`; station offsets ride a separate offset member, never inside
the anchor token), resolved to absolute stations at validation; a span outside
the road is `BAD_RANGE`, and — per D7 — `apex:` anchors are rejected here
exactly as everywhere else. The compact token form (scene text and CLI) is
`<field><op><value>@<from>[..<to>]`, field ∈ `f | v_kmh | sight_margin_m`, op ∈
`>= | <=` — e.g. `f>=0.6@entry:c1..mid:c1` ("stay outside lane fraction 0.6
until mid-corner": hold-wide intent stated as a bound), or `v_kmh<=45@mid:c2`.
An op that maps to no bound in the closed set (`v_kmh>=`, `sight_margin_m<=`)
is rejected `SCHEMA` — the bound vocabulary is closed.

**Constraints are acceptance bounds, not waypoints — D7 is untouched.** A
constraint never enters the wire plan; the engine never sees one. It narrows the
set of emergent lines the *solver* may accept: the author still cannot say where
the line goes, only where it may not go.

Search semantics: constraints join the containment filter at every stage of the
existing machinery. Coarse-sweep candidates (§3) that violate a bound are
discarded before ranking; a bisection target that conflicts with a bound is
clipped to it (`f_max = 0.7` over the exit span clips `exit_target` down from
0.85); among satisfying candidates the doctrinal ranking is unchanged. The
mandatory self-verification run re-checks every constraint on the final line —
a violation at self-verify is a typed error, never a shipped line. When no
candidate satisfies a bound, the result is `NO_SOLUTION` with sub-reason
`constraint_unmet` naming the constraint id, the worst station, and the
achieved-vs-required values — the agent's next move is legible from the error.
Constraints compose with `vis=cautious` (§6): authored bounds and the mode's
generated V1/V2 requirements join the same acceptance predicate. And authored
bounds stay **hard under every acceptance policy** (§4.8): `best_failing`
relaxes the doctrine bar, never a D10 bound.

Per-constraint evaluation — `satisfied`, worst station, remaining margin — is
recorded in the verdict (`05-result-contract-and-inspection.md` §6.3), so a
satisfying line also shows how much room each bound had left.

### 4.6 `solveDoubleApex`

The planned two-touch line, fully specified.

**Parameter surface.**

```
solveDoubleApex({ road, entry_kmh, profile?, mu?, constraints?, vis?,
                  corner?: "<id>" | "<id>..<id>" })   // span of 1..2+ consecutive corners
```

Scene/CLI spellings: `style=double_apex [corner=c1 | corner=c1..c2]`;
`--style double_apex [--corner c1..c2]`. No other author-facing parameters: the
two turn-ins, both touches, the mid-drift — all emergent. Internal constants
are TUNING.

**Corner targeting.** The solver operates on a **compound corner window**:
either one corner (`corner=c1` — two touches inside a single long arc) or a
maximal run of *same-hand* consecutive corners with `linked_next = true`
(`03-…md` §2) treated as one corner (`corner=c1..c2` — the two-arc horseshoe
composition). When `corner` is omitted, the solver picks the qualifying window
with the largest total sweep; qualification = total sweep ≥
`DA_SWEEP_MIN_DEG = 120°` (TUNING). No qualifying window → `NO_SOLUTION`,
`sub_reason = "no_double_apex_geometry"`. Window bounds: `s0 = s0(first)`,
`s1 = s1(last)`, `L_arc = s1 − s0`, sweep = summed sweeps; `pct` below means
percent of cumulative swept angle across the window.

**Search (two-turn-in placement strategy).** Fixed-plan search, carried style
(coarse→fine, ascending gentlest decel):

1. **Outer:** ascending decel scan over the (fit-clipped, §4.1a) decel bracket,
   `N_DA_DECEL = 4` (TUNING) evenly spaced values, gentlest first.
2. **Placement grid (coarse ds):** turn-in 1 ∈ 5 candidates over the §4.1a sweep
   (computed for the compound window); turn-in 2 ∈ 5 candidates over
   `[s(pct = DA_TI2_PCT) − 0.15·L_arc, s(pct = DA_TI2_PCT) + 0.15·L_arc]`,
   `DA_TI2_PCT = 55` (TUNING). Plan per candidate: brake (§4.1a stations) →
   `turn_in` #1 `tangent_inside` → crack (crack_gap) → mid-drive
   `throttle accel = DA_MID_ACCEL = 1.0 m/s²` (TUNING; roll-on widening produces
   the drift back out — `02-…md` §2's causal identity, no `position` action
   anywhere) → `turn_in` #2 `tangent_inside` → crack → exit roll-on.
3. **Filter:** contained (`f ∈ [0, 1]` over the window); exactly two touches per
   the touch predicate below; touch percents inside `[DA_APEX1_PCT ± 15]` and
   `[DA_APEX2_PCT ± 12]` (`DA_APEX1_PCT = 25`, `DA_APEX2_PCT = 80`, both
   TUNING); constraints (§4.5) joined as always.
4. **Rank:** `max(|pct₁ − DA_APEX1_PCT|, |pct₂ − DA_APEX2_PCT|)`, ascending.
5. **Fine:** top `N_DA_FINE = 3` (TUNING) re-solved at full resolution — exit
   roll-on bisected against `exit_target = 0.85` (carried) — then self-verified;
   the first that passes acceptance is returned verbatim. Coarse/fine
   disagreement is a typed error (carried discipline).

**"Touch", defined (the solver-internal candidate-acceptance filter).** A
**touch** is a local minimum of the resampled lane-fraction series `f(s)` over
the window with: **depth** `f_min ≤ DA_TOUCH_F_MAX = 0.25` (TUNING) — it
approaches the inside; **prominence** — the maximum `f` between two consecutive
touches exceeds the larger of their minima by ≥ `DA_PROMINENCE_F = 0.25`
(TUNING) — the line genuinely drifts back out between touches (`01-…md` §5's
requirement); **separation** — consecutive touch stations ≥
`DA_TOUCH_SEP_PCT = 25` (TUNING) percent of window sweep apart; minima with
prominence < 0.05 are noise-ignored. "Two distinct apex touches" = exactly two
touches under this predicate; three or more is faceting territory → candidate
rejected (distinct from `fifty_pence` by construction, as `01-…md` §5 demands).
The predicate is evaluated over the **recorded** apex list — the one hysteresis
detector of `05-…md` §6.3 is the recorder — so an accepted two-touch line
always records exactly two apexes (`corners[].apexes[]`), and each touch emits
an `apex` event with `detail.index`; markers, labels (`apex#2@double`), and
checks all read the same list.

**Acceptance and refusals.** Accepted iff the self-verified run is contained,
shows exactly two touches, satisfies all constraints, and passes the applicable
doctrine set. When the two-touch criterion is met and the line's source is a
solve with `style=double_apex`, `single_input` and `out_in_out` read `na`
(evidence: `double_apex_by_design` — the exact analogue of the chain-aware
carve-out in §5); `late_apex` reads the **final** apex's `pct`; and
`wrong_strategy_for_corner` reads the count (catalogue arithmetic:
`01-…md` Appendix A). Typed failures (`NO_SOLUTION`, closed sub-reasons —
registry §4.10):

| `sub_reason` | Condition | `detail` payload |
|---|---|---|
| `no_double_apex_geometry` | no qualifying window | best window's sweep, required sweep |
| `no_two_touch_line` | scan exhausted with no contained two-touch candidate — the corner does not reward two touches at this entry (the fig 8.4 taper case) | best candidate's touch count, worst `f`, its ranking metrics |
| `road_too_short` | §4.1a, computed on the window | as §4.1a |
| `constraint_unmet` | carried, §4.5 | carried |

The scan **always retains its best failing candidate** (ordering:
contained-two-touch > contained-one-touch > lowest max-`f`; ties by search
rank), so `accept=best_failing` (§4.8) can return that candidate as a normal
self-verified LineResult with its non-clean verdict verbatim instead of the
refusal. `LineResult.source.solveSpec` records `style: "single" | "double_apex"
| "geometric"` (closed), the resolved window (`corner_ids`, `s0`, `s1`), and
`accept`.

### 4.7 Believed-road solving (misjudgment)

**Concept, and the D7 statement.** A line spec may declare a **believed road**:
the solver solves the rider's plan against the believed road, then the engine
executes that resolved plan — verbatim, absolute stations, committed leans — on
the figure's **actual** road. D7 is untouched, and the statement is normative:
there is still no authored path anywhere. The author writes the geometry of a
*world*, never the geometry of a *line*; both worlds' lines are engine output.
What changes is only *which road the plan was optimal for* — the book's
psychology of error (anxiety, misread radius, "didn't know it tightens"),
previously channel-less.

**Grammar — two layers.** Layer 1, the general field (arbitrary misreads):

| Surface | Spelling |
|---|---|
| solve-spec JSON | `believed_road: "<road-DSL string>" \| { preset: "<name>" }` |
| scene text (ride line) | `believeRoad="lane 3.5 \| S 10 \| L 12 ^90 \| S 30"` |
| CLI | `--believe-road "<dsl \| preset name>"` |

`believed_road` is a **solve-layer** field. It never appears in the wire
scenario the engine validates and integrates — the engine sees only (actual
road, resolved plan), keeping `03-…md` §6's one-road-one-plan engine contract
byte-identical.

Layer 2, sugar: the misjudgment kinds `underread` and `overread` (the
misjudgment sub-family of the mistake enum; parameters, defaults, and outcome
pins live in the one table, `03-…md` §7.1). Sugar compiles to Layer 1:
`underread:r_believed=16` rewrites the target corner's segment on the actual
road (constant `arc r=16`, or a rescaled `angle_deg` for a sweep misread),
leaving every other segment byte-identical, and proceeds exactly as the general
field; the compiled believed road appears verbatim in provenance. Compile-path
difference, stated where the grammar lives: execution kinds perturb the base
ride's *solved plan*; misjudgment kinds take the base ride's *ride spec* (entry,
profile, style, vis mode), re-solve it on the believed road, and execute on the
actual road.

**The one-perturbation rule, extended.** A compiled teaching line differs from
its reference in exactly one authored respect: **one control (execution
sub-family) or one belief (misjudgment sub-family) — never both.** One belief =
one geometric parameter of one corner (sugar kinds), or one wholesale believed
road (general field — the escape hatch for compound misreads like fig 8.5; the
disclosure is the full believed DSL in provenance). A spec carrying both a
misjudgment and an execution mistake is rejected `SCHEMA`
(`misjudge_with_execution_mistake`). The diff property holds in belief space:
the executed plan is *byte-identical* to the believed-world plan — the entire
delta between the misjudged line and the reference is the world, never the
inputs.

**Validation rules (typed; all at `validate`/solve entry):**

| Rule | Error |
|---|---|
| believed road identical to actual (segment-list equality after normalization) | `INEFFECTUAL` / `believed_road_identical` |
| `lane_width_m`, `bike_margin_m`, `use_full_width` differ between worlds | `SCHEMA` / `believed_lane_geometry_differs` (v1: the rider misjudges curvature, not lane width) |
| the first divergent corner's hand differs | `OUT_OF_SCOPE` / `believed_hand_differs` (typed so the cut is explicit and liftable) |
| divergence station `s_div = 0` (worlds differ from the start) | `SCHEMA` / `believed_no_shared_prefix` (the plan's stations must mean the same asphalt in both worlds up to the misread) |
| believed-world solve does not verify clean | `NO_SOLUTION` / `believed_world_not_clean` (the misjudgment story requires a sound plan in the believed world; a bad plan in a wrong world is two perturbations) |
| `accept=best_failing` combined with a believed road | `SCHEMA` / `accept_policy_incompatible_with_misjudge` (it would relax the believed-world clean bar) |
| an occluder/hazard placement that cannot re-resolve on the believed road | `BAD_RANGE` / `believed_placement_unresolvable` (fix: absolute `at_s` placement; the believed world must be fully well-formed, never partially inherited) |

Believed-road length may differ freely from the actual road: plan actions whose
stations the actual run never reaches simply never fire — they were effectual in
the believed world, which is recorded (the one place D8's "provably reaches the
controller" is evaluated against the *believed* run).

**`s_div` — the divergence station, computed exactly** (no epsilon, no
sampling): walk both segment lists pairwise, accumulating length while segments
are identical (type + all params). At the first differing pair: if both are arcs
with equal `r` and `hand` but different `angle_deg`, `s_div` = boundary + arc
length of the smaller sweep; if both are straights of different `len`, `s_div` =
boundary + the smaller `len`; otherwise `s_div` = the boundary station.
Deterministic, unit-testable, and it lands mid-corner where the misread
geometrically bites.

**Execution semantics (normative pipeline).**

1. **Solve in the believed world.** The full ride spec — entry, `turnIn=auto`,
   `style=`, `vis=`, constraints — is solved on the believed road by the
   ordinary pipeline (§3–§6), including mandatory self-verification **on the
   believed road**; the result must be clean (else `believed_world_not_clean`).
2. **Literalize the plan.** Every deferred target is replaced by the value the
   believed-world run realized: `tangent_inside` becomes the explicit committed
   `{lean_deg, hand}` at the believed run's `steering_complete`; anchors are
   already absolute `at_s`; `position` targets stay in `f` (which means the same
   thing in both worlds because lane-geometry equality is validated). Stated
   generally: **every road-derived quantity in the plan is frozen from the
   believed world.** Without literalization, `tangent_inside` would re-derive
   against actual geometry and erase the misjudgment.
3. **Execute on the actual road** through the unmodified engine — same profile,
   same integrator, same corrective-shot machinery with no special-casing: when
   the divergence manifests as running wide, `run_wide_detect` fires and the
   fixed-policy corrective shadow (§4a) is evaluated, with the `correction`
   shot-start bookmark on the main line. The drawn misjudge line is the
   uncorrected consequence; the save is inspectable as the `correctiveShot`
   ghost (stepper-only, never exported).
4. **Grade normally.** Trajectory, events, verdict, colour are those of the
   actual-road run, computed by the unmodified analyzers. No misjudgment
   discount, no special colour path.

**Provenance.** `LineResult.source` gains kind `misjudge` (the solved ride spec,
the believed road, the sugar record), and the verdict gains a `misjudgment`
block — `believed_road_hash`, exact `s_divergence_m`, the divergence descriptor,
`kappa_gap` (max |κ_actual − κ_believed| past `s_div` — the quantitative "how
wrong was the belief"), the believed-world self-verify summary
(`{outcome: "clean", spec_hash, result_hash}`), and `actions_unreached` — shapes
owned by `05-…md` §6.3/§7. The believed-world run is **not** a line in the
figure (it lives on a different road; "one road per figure" is untouched): its
identity travels as the two hashes, and an author who wants it drawn makes a
second figure from the same solve spec on the believed road. `diagnosis.cause`
stays physical; `explain` composes the intent-level and physical stories
("plan solved for r=16; road tightens to 9 at s=24.7; stood up under braking at
s=31.2 → ran off at s=41.0").

**Colour and outcome.** By design these lines usually grade `wide`/`runoff` →
red: that is the point — no new colour machinery, D9 verbatim. An `underread`
small enough to be absorbed by street reserve grades `contained` with failed
checks → quality `caution`/amber ("you got away with it"); `overread` lines are
the contained/timid amber teaching object for free.

### 4.8 Acceptance policy (`accept`)

Solve-spec field `accept ∈ "clean" (default) | "best_failing"`. Scene:
`accept=best_failing` on `ride` lines; CLI: `--accept best_failing`. Closed
enum; anything else `SCHEMA`.

Under `accept=clean` nothing changes: the pipeline behaves per §4.2, including
its non-clean-self-verification seam, which the `acceptance` block makes
explicit in the contract. Under `accept=best_failing`, the solver's refusal
paths become best-effort returns:

1. The feasibility probe (§4.2 step 1) no longer short-circuits the solve; an
   infeasible placement's candidates stay in the pool.
2. The candidate pool is every **full-resolution, self-verified** final plan the
   pipeline produced; the pipeline must full-solve at least
   `BEST_FAILING_MIN_CANDIDATES = 4` (TUNING) turn-in candidates even when the
   coarse sweep's contained band is empty (take the 4 nearest-to-contained by
   corridor excess). A candidate whose self-verify re-run disagrees with its
   search-time outcome is **discarded**, never ranked.
3. Candidates violating any **authored constraint** (§4.5) are discarded before
   ranking: D10 bounds stay hard under every accept policy. All candidates
   constraint-violating → `NO_SOLUTION`/`constraint_unmet` exactly as today.
4. **Ranking** — ordered tuple, lexicographic, lower wins: (i) outcome severity
   per the `05-…md` §6.1 precedence — `contained` = 0, `stopped` = 1,
   `wide` = 2, `runoff` = 3, `crash` = 4; (ii) count of doctrine checks with
   verdict `fail` (`warn`/`na` excluded); (iii) corridor excess — max over
   samples of distance beyond the usable corridor edge, metres (0 for contained
   lines); (iv) doctrinal apex distance `|apex_pct_final − target_apex_pct|`
   (final apex; corner-type-aware target, §3); (v) earlier turn-in station
   (deterministic final tie-break — hash stability).
5. The winner is returned with its own **verbatim** verdict. Empty pool →
   `NO_SOLUTION` / `no_rankable_candidate`. `best_failing` never fabricates and
   never returns an un-self-verified line.

**Never silent.** The verdict carries `acceptance: {policy, met}` — always
present, in-hash (`05-…md` §6.3): `met` is true iff the returned line meets the
clean bar. A policy-`clean` solve reporting a non-clean self-verification
carries `{policy: "clean", met: false}`; a `best_failing` return that happens to
be clean carries `{policy: "best_failing", met: true}`. Grading is
policy-independent — the accept policy changes what is *returned*, never how it
is *graded* or coloured (D9). If `accept=clean` would have succeeded,
`accept=best_failing` returns the byte-identical line (09: `P-ACCEPT-MONOTONE`).

Guardrails: `accept` on a `mistake`-kind line is `INEFFECTUAL` /
`accept_on_mistake_line` (mistake lines forward-run a perturbed plan; nothing is
being accepted); `accept=best_failing` with `believed_road` is `SCHEMA` (§4.7).
A solve returning a ranked line under `policy=best_failing` exits 0 — non-clean
is the *requested* result; gating keys off `acceptance.{policy, met}` and
declarations, never roles (`08-…md` §3.1). `solveDoubleApex` composes: its typed
refusals become rankable pools under `best_failing` (§4.6).

### 4.9 Authored actions + `turnIn=auto`: the merge contract

When an authored plan fragment rides alongside solver delegation, nothing is
ever silently dropped (summarized for the CLI in `08-…md` §4.2):

- An authored **numeric brake decel pins the decel control**: the solver skips
  the decel bisection and uses the authored value (taper placement per
  `brake_gap` unchanged). `brake auto` bisects as today.
- An authored **throttle with an onset station pins the roll-on control** (exit
  bisection skipped); a bare magnitude pins only the magnitude, onset still
  bisected.
- Authored **`position` actions are carried verbatim into every candidate plan**
  the solver runs — present in the coarse sweep, both bisections, and the
  self-verify run. Hold-wide authoring composes with `auto` by construction.
- An authored **explicit turn-in station** fixes placement; remaining controls
  solve normally.
- **Nothing is ever dropped.** An authored action the solver cannot honour on
  any candidate (e.g. a `position` window that overlaps the turn-in commitment
  at every feasible placement) is a typed `NO_SOLUTION`, sub-reason
  `authored_action_conflict`, naming the action id.
- A **fully explicit plan plus a solver-only field** with nothing left to search
  rejects the dead input: `INEFFECTUAL` (e.g. `constraint_without_solver` for a
  constraint on a fully pinned plan).

### 4.10 The `NO_SOLUTION` sub-reason registry

Closed set; extension is a design change. Every prose refusal above has a name:

```
sub_reason ∈  turn_in_infeasible_early | turn_in_infeasible_late         (§4.2 probe)
            | empty_band | non_clean_band | coarse_fine_disagreement     (§3)
            | constraint_unmet                                           (§4.5)
            | road_too_short                                             (§4.1a)
            | no_double_apex_geometry | no_two_touch_line                (§4.6)
            | believed_world_not_clean                                   (§4.7)
            | no_rankable_candidate                                      (§4.8)
            | authored_action_conflict                                   (§4.9)
            | link_flip_infeasible                                       (§5)
            | vis_unsatisfiable_within_bound | vis_speed_below_model_floor (§6)
```

Wire shape: the error object gains a structured member — `{code: "NO_SOLUTION",
at, message, detail: {sub_reason, …per-reason fields}}` — extending the error
envelope owned by `08-…md` §3.2. `schema solve` prints this registry and the §3
target table; every sub-reason must be reachable by a committed fixture
(`09-…md` §8 — no dead error names).

---

## 4a. The corrective shot (`correctiveShot`)

The machinery that decides `wide` vs `runoff`. This section owns the algorithm;
`02-…md` §7 and `05-…md` §6 point here.

### 4a.1 What it is — and what it deliberately is not

The corrective shot is a **fixed-policy counterfactual**: one deterministic
shadow re-integration that asks "could a rider who noticed the drift and calmly
added lean to the street reserve have stayed on the road?" It is *not* a search
(the prior design's minimum-save-lean bisection is dropped), *not* part of the
main integration (the drawn line never contains it), and *not* a plan action
(nothing about it is authorable). Why fixed-policy: one shot is deterministic
and cheap (one bounded extra engine run per ran-wide corner — counted in the
recompute budget, `09-…md` §6); the doctrinal question is binary ("was this
recoverable within reserve?"); and a bisection inside the verdict pipeline would
make `result_hash` sensitive to solver iteration internals. This shadow's
controller is the registered rider `lean_only_reserve` under the predicate
`return_after_detect` (§4c.2); its precondition — the line must already be
outside the corridor and drifting outward — is normative at §4c.4 and is exactly
what §4a.2's outward-only detect gate enforces.

### 4a.2 Detect predicate (the `run_wide_detect` event)

```
run_wide_detect := the first bracketed crossing where
                   f rises through F_DETECT + eps_f_detect
                   with df/dt > 0 (outward)  and  a turn_in event has occurred

F_DETECT     = 1.0    (the outer usable edge — definitional, not TUNING)
eps_f_detect = 0.01   (TUNING — classification deadband; a line that grazes
                       f = 1.005 is not "running wide")
```

Crossing coordinates (`s, t, x, y, f, v`) are located by the standard event
bracketing of `02-…md` §6. The event lands in the main line's `events` array. At
most one `run_wide_detect` per corner: the first outward crossing attributed to
that corner (attribution: the last corner whose `s0 ≤ s_detect` — a drift on the
exit straight belongs to the corner being exited). The `turn_in`-must-precede
guard keeps a legitimate `f = 1.0` start position from firing detection on
sample noise.

**Outward-only, by design — this is the corridor-departure predicate the check
catalogue consumes.** No detect event exists for the inside direction: an
inside-corridor excursion (`f < −eps_f_detect` while still on pavement) is
doctrine-check territory (`out_in_out`, `chain_containment`), never an outcome
mechanism, and no inside corrective is defined — the save the book credits is
add-lean against *outward* drift. An inside excursion that crosses the physical
edge terminates `off_road` (`02-…md` §7) and classifies `runoff` via §4a.6's
table; one that returns and reaches road end is `contained`, graded by its
checks.

### 4a.3 Shot start: reaction (+ freeze)

```
t_shot = max(t_detect, t_freeze_end) + t_react_s
```

`t_react_s` is the rider profile's recognition delay (`02-…md` §3).
`t_freeze_end` exists only when the line's mistake spec carries a rider freeze
(today: `chop`'s `freeze_s`, `03-…md` §7.1) — a frozen rider cannot begin
reacting; for all other lines the formula reduces to `t_detect + t_react_s`.
The shot's initial state is `stateAt(mainLine, {t: t_shot})` — full recorded
state, no re-derivation. **If the main trajectory terminated before `t_shot`**,
the shot is not integrable: `feasible = false`, `fail_reason =
"departed_before_reaction"` — not a degenerate corner case but the *normal*
mechanism by which a short corner with a hard outside edge pins `runoff`.

The `correction` event is **the shot-start bookmark**: kind `correction` at
`(s_shot, t_shot)` on the main line, emitted iff the corrective was attempted
**and its shot start lies on the recorded line** — i.e. not the
`departed_before_reaction` arm, where `t_shot > t_terminated` and no on-line
shot instant exists — `detail: {feasible}` — "the last moment a save had to
begin", a stepper jump target. It never implies the main line bends back. **On
`departed_before_reaction` no `correction` event is emitted; the `corrective`
block still publishes `{feasible: false, fail_reason: departed_before_reaction}`
(§4a.6), and the `run_wide_detect` bookmark (§4a.2) is the on-line anchor a label
may address at the departure — no separate departed-bookmark event is minted.**

### 4a.4 Control policy (the shadow run)

From the shot state, re-integrate through the same pure stepper (same `dt_s`,
run-wide slice active) under a constant controller:

```
target_lean = handSign(corner.hand) · phiReserve(skill · config.mu)   // 40.36° street / mu 1.0
roll_rate   = the rider profile's cap (unchanged)
a_cmd       = 0                                                   // throttle closed, no brake
```

Toward `phiReserve`, not `phiMax`: the doctrinal question is "recoverable by a
competent street rider *within reserve*" — a save that needs the physical
ceiling is the danger zone, not a save. With `a_cmd = 0` and lean capped at the
reserve, the shadow cannot violate the ellipse on uniform `mu`; ceiling
violations can come only from hazard patches under the shadow path. The shadow
starts with an **empty command-rate history** (`a_cmd_rate = 0` for its first
step), so the transient stand-up term cannot fire off the shot's own start
artifact. The run-wide slice stays active: with `a_cmd = 0` the sustained term
is dormant, which is the *point* — the save the doctrine credits is
add-lean-off-the-brakes.

### 4a.5 Success predicate and termination of the shadow

The shadow integrates under the same termination rules as any run until the
earlier of first return or its own termination:

```
feasible := ∃ a bracketed station s* on the shadow, s_shot < s* ≤ road end,
            with f(s*) ≤ F_SAVE + eps_f_save,
            reached before any shadow termination of kind off_road | crash | stopped

F_SAVE     = 1.0     (back inside the outer usable edge)
eps_f_save = 0.03    (carried TUNING — the prior design's 3 % return tolerance;
                      doubles as the wide/runoff classification deadband)
```

`fail_reason` (closed set, D8): `departed_before_reaction | shadow_off_road |
shadow_crash | no_return_before_road_end`.

**`shadow_stopped` is deleted as a dead error name (D42).** The shadow commands
`a_cmd = 0` (§4a.4) and `02-…md` models no aerodynamic or rolling drag and no
grade, so `a_long = 0` at every shadow sample and `v` is **exactly** constant
from `t_shot` to termination. `v_floor_ms` (`02-…md` §7) can therefore fire only
if the main line was already below it at `t_shot` — in which case the main line
terminated first and the shot is `departed_before_reaction`. The branch was
unreachable on its whole domain. `09-…md` §8's no-dead-error-names rule requires
its removal rather than its documentation, and `P-CORR-CONSTANT-SPEED` pins the
fact that made it unreachable so nobody restores the name when drag arrives —
adding drag to `02-…md` would be a physics-tier change (D3) that reopens this
branch explicitly, with its own decision entry. The `brake_reserve_escape` rider
(§4c.3) *does* brake and therefore reaches `v < v_floor_ms` legitimately, which
is why the two policies must not share a termination-vocabulary derivation.

The success predicate and both constants (`F_SAVE`, `eps_f_save`) are
**unchanged**; §4a.5 remains their owning declaration and §4b.3 and §4d cite them.

### 4a.6 Recorded shape and the wide-vs-runoff decision

The verdict records per corner (`05-…md` §6.3):

```
corrective : null | {
  feasible:    boolean,
  detect:      { s, f },                                // bracketed crossing, main line
  shot:        { s, v_kmh, phi_deg, target_phi_deg },   // state at t_shot + policy
  returned:    { s, f } | null,                         // first return station (feasible only)
  fail_reason: null | <closed set, §4a.5>               // set iff !feasible
}
```

`null` ⇔ never attempted: the corner did not run wide **outward** (including the
inside-side `off_road` departure), or the main run crashed (**crash strictly
precedes corrective solving — no save is computed for a lowsided trajectory**).

```
ran_wide(corner) := a run_wide_detect event attributed to that corner exists
outcome contribution per corner:
    crash event anywhere            → crash        (corrective null)
    ran_wide ∧ corrective.feasible  → wide
    ran_wide ∧ ¬feasible            → runoff
    terminated off_road ∧ ¬ran_wide → runoff       (inside-side departure: no outward
                                                    detect, corrective null)
headline (multi-corner): worst class under the precedence
    crash > runoff > wide > stopped > contained
```

Colour law is untouched: `wide`, `runoff`, `crash` all map to quality
`failing`/red (`06-…md` §5.1). The split changes the **headline, diagnosis, and
teaching text** ("recoverable with reserve lean from s=31" vs "unrecoverable —
already off the road before a reaction was possible"), never the paint. D9
holds.

### 4a.7 Branched shadow, never the main integration

The corrective runs as a **branched shadow**. Consequences, stated so the trade
is auditable:

- The drawn line for a `wide` outcome is the *uncorrected* consequence of the
  authored plan — exactly the book's figs 8.1–8.3 red ink. The one-perturbation
  diff property survives (the mistake line's samples are a pure function of its
  plan); a main-line corrective would embed analyzer output in the trajectory
  and break it.
- `Trajectory` samples and the trace CSV are byte-independent of the corrective
  machinery; the only main-line artifacts are two events (`run_wide_detect`,
  `correction`) and the verdict block, which is **inside `result_hash`** (it is
  classification-bearing — `feasible` decides the headline).
- The shadow *trajectory* is not part of the envelope, the CSV, or any hash: it
  is recomputable output, exposed as the pure API
  `correctiveShot(lineResult) → Result<{corrective, shadow: Trajectory}>`
  (`08-…md` §7.1), so the viewer may draw the save as a ghost overlay —
  stepper-only, off by default, never exported
  (`07-viewer-animation-and-pov.md`). The fig 8.5 ink departure (the book draws
  the salvage; linelab draws the uncorrected consequence and bookmarks the save)
  is a disclosed parity note.
- The shadow uses the same pure stepper at the same `dt`: determinism properties
  cover it for free; a shadow is a run, not a special case.
- The returned shadow document carries `rider: "lean_only_reserve"` and
  `predicate: "return_after_detect"` (§4c.7). It is out-of-hash by
  construction — the shadow trajectory is in no envelope, no CSV and no hash —
  so the disclosure obligation costs nothing and moves nothing. The in-hash
  `corrective` block deliberately gains no field: its rider is fixed by §4a.4
  for all time, is therefore known from the design of record rather than from
  the record, and is disclosed in prose (§4c.7).

The start instant of this shadow is a *parameter*, and the out-of-hash scan over
it — with its own horizon rule, because §4a.5 has none — is specified in §4b
(D44); nothing in §4a is changed by it, and the classification remains this one
unsearched shot.

The `premature` oracle pin this machinery makes implementable — `runoff` on the
left-hand `book90` (0.4 m of pavement beyond the usable edge) vs `wide` on
`book90 hand=R` (≈ 3.9 m including the oncoming lane) — lives in `03-…md` §7.1
and `09-…md` §4 (`F-ORACLE-90`, `G-CORR-RUNOFF`/`G-CORR-WIDE`).

---

## 4b. The reserve-lean save window (`saveWindow`)

§4a evaluates one deterministic shadow from one instant and keeps one bit,
`corrective.feasible`. That bit is a single sample of a function of the start
instant. This section parameterises the start instant and reports the last
instant at which the function still held. It owns one concept §4a does not
have — a **station horizon** — and that is why it is a section and not a
cross-reference. The earlier framing of this feature as a free harvest of work
`correctiveShot` already discards was wrong and is recorded as wrong: §4a.5
defines feasibility only relative to the shot's own start station and says
nothing about the shadow past its first return, so a start-instant-independent
success predicate had to be authored here.

Everything in this section is **out-of-hash, off by default, computed on demand,
and absent from every committed book scene**. No verdict member, no check, no
exported ink.

### 4b.1 What it is — and what it deliberately is not

`saveWindow` reports the last start instant from which **one canned
controller** — the registered rider `lean_only_reserve` (§4c.2): roll at the
profile cap toward `phiReserve(skill · config.mu)`, throttle closed, no brake,
no body english, no countersteer channel — still returns the line inside the
corridor by the station at which this line ran wide. It is not a claim about
commitment in general and it is not a point of no return. "Point of no return"
appears nowhere in *Total Control*; Ch. 8's *committed* means the exhaustion of
line options ("you must have some line options in reserve… you're committed to
your maximum lean angle") — a state of the reserve, not a deadline. The save
window is introduced as the time-domain price of that option space, in the units
a rider experiences a corner in, and it is placarded (§4b.7) rather than
generalised.

### 4b.2 The parameterised shadow

```
saveAt(line, corner, tau) → Result<{ saved: bool, shadow: Trajectory, s_star_m: number|null }>
```

`saveAt` is a **named thin wrapper over `counterfactual`** (§4c.1) and declares
its binding here: `rider = "lean_only_reserve"`,
`predicate = "horizon_bounded_return"`. It introduces no second harness and no
second controller.

Initial state = `stateAt(line, {t: tau})` — full recorded state, no
re-derivation, the same restart §4a.3 already performs at `t_shot`. Controller,
**from §4a.4 by reference**, no new physics: target lean
`handSign(corner.hand) · phiReserve(skill · config.mu)`, roll at the profile cap,
`a_cmd = 0`, `a_cmd_rate = 0` on the first step per §4a.4's empty-history rule.
Same pure stepper, same `dt_s`, run-wide slice active, same termination
vocabulary. Tier 1R is untouched: no tire slip, no suspension, no countersteer,
no body model.

### 4b.3 The success predicate — a station horizon carried from the main line

Let `s_detect` be the station of the main line's `run_wide_detect` event for this
corner (recorded, §4a.2). It is identical for every `τ`, and it is guaranteed to
exist because §4b.5's status table gates the whole computation on
`corrective ≠ null`.

```
saveAt(line, corner, τ) integrates the §4a.4 policy from stateAt(line, {t: τ}) until the
earlier of
  (a) the first bracketed station  s* ≥ max(s_detect, s(τ))  with  f(s*) ≤ F_SAVE + eps_f_save
  (b) any termination of the shadow

saved(τ) := (a) was reached, and no termination of kind off_road | crash | stopped
            occurred at or before s*.
```

`F_SAVE` and `eps_f_save` are declared once, at §4a.5, and cited here. **No new
constant is introduced by the predicate.**

**Why the horizon, and why it is taken from the main line.** §4a.5's naked
predicate is *vacuously true* for every `τ < t_detect`: at those restarts the
line is still inside the corridor, so `f < 1` at the restart station itself and a
return is found immediately. Requiring `s* ≥ s_detect` forces the shadow to still
be inside the corridor **at the station where the main line was outside it**, and
to have survived to that station. That is exactly the question the feature is
for — *would starting the canned save here have avoided this run-wide?* — and it
is the only formulation that asks it without inventing a horizon the design does
not already own. `max(s_detect, s(τ))` keeps the horizon ahead of the restart for
late `τ`, so the predicate never degenerates to a backward-looking test.

**The horizon is also what discharges D42's rider precondition for this
consumer.** §4c.4 forbids launching `lean_only_reserve` from inside the corridor
*when the return itself is the verdict*, because on every book preset the
reserve-lean circle is 20–35 % tighter than the road and an in-corridor launch
closes on the inside edge. `saveWindow` deliberately scans `τ < t_detect`, and it
is entitled to because it binds the predicate `horizon_bounded_return`: an
in-corridor launch that curls inside and departs before `s_detect` scores
`saved = false` by the predicate itself, so the defect the precondition exists to
prevent is unrepresentable here without a launch-state restriction. That
discharge is **declared, not inferred** — a consumer passing
`horizon_bounded_return` without a main-line-derived horizon is refused
`Err(horizon_not_from_main_line)` (§4c.4).

**Why `saved(t_shot) ≡ corrective.feasible` holds by construction.** §4a.2's
detect strictly precedes §4a.3's reaction, so at `τ = t_shot` the line is already
outside the corridor and `s(t_shot) > s_detect`. The horizon clause
`max(s_detect, s(τ))` is therefore inert, the integration is §4a.5's prefix
condition verbatim over the same policy from the same state, and the two
predicates are the same predicate. The anchor identity is a **consequence of the
definition**, not a premise the design has to hope holds; `P-SAVEWIN-ANCHOR`
demotes from load-bearing assumption to regression test. The earlier form
asserted the identity while the two predicates differed in quantifier — prefix
versus terminal — and was false.

**The construction above assumes the main line reached `t_shot`.** When it did
not — `t_shot > t_terminated`, the `departed_before_reaction` case §4a.3 owns —
`stateAt(line, {t: t_shot})` is undefined, `corrective.feasible = false` by §4a.3
with no shadow run, and `saved(t_shot)` takes its **extended value `false`**: a
save cannot be launched from an instant the line never reached, so the identity
still holds (both sides `false`) by that same short-circuit. This is the one case
in which `t_shot` is *not* a grid point (§4b.5 admits it only when in domain), and
it is why §4b.6's consistency argument runs over two cases. `saveAt(t_shot)` there
returns `INTERNAL/save_launch_unresolvable` by design — the launch instant is off
the recorded line — so `P-SAVEWIN-ANCHOR` discharges this case by asserting
`corrective.feasible = false ∧ fail_reason = departed_before_reaction`, never a
live `saveAt` probe. Witnessed on `slow_steer` @34 (`t_shot_s = 2.66 s` on a line
gone `off_road` at `1.95 s`) and `underread`.

**Why the peak-guard repair is rejected.** The alternative repair on the table
was to delete only the terminal-reason clause and keep a peak guard,
`f_peak ≤ F_SAVE + eps_f_save` over the whole shadow. That is worse than the
defect it fixes. `f` is signed **outward-positive** (§4a.2), so a shadow that
curls *inside* and leaves the carriageway on the inside edge has `f_peak ≤ 1` and
scores `saved = true`. This is not hypothetical on the committed corpus: on
`book90` the probe radius at reserve lean is 8.33 m against a 12 m arc and a
straight exit, so every early-`τ` shadow eventually departs inward, and on a
left-hander inward is across the centreline. A peak-guarded `saveWindow` would
silently mint the **inside corrective that §4a.2 explicitly refuses to define** —
and would report it to the rider as a save window. Deleting the peak machinery
alongside the terminal-reason clause is not an optimisation; it is the whole
point of the repair.

Three further properties follow from the horizon form, and each is checkable from
this text: the absurd tail is never evaluated (the constant-`phiReserve` circle
past the return is not a trajectory any rider rides, and integration now stops at
`s*`); the ill-typedness disappears (a returning shadow has no
`terminated.reason` to bind a clause to); and the computation is **cheaper**,
because shadows are horizon-bounded rather than run to road end.

### 4b.4 The shadow is a probe, not a trajectory

**Normative.** The reserve-lean shadow is a *probe over a bounded station
horizon*, not a trajectory a rider would ride to completion; the design asserts
nothing whatever about its behaviour past `s*`. `07-…md` §3.6 MUST clip the
save-window shadow at `s*`, and `07-…md` §3.5's existing corrective ghost is clipped
identically. A view that draws the probe past `s*` is drawing unspecified output
and fails `C-SAVEWIN-CLIP`.

### 4b.5 Domain, grid, scan, refusal

```
domain: τ ∈ [ max( t(turn_in of corner), t_freeze_end ),
              min( t_terminated, t(exit of corner) + TAU_TAIL_S ) ]

TAU_TAIL_S = 2.0 s   (TUNING — carry past the corner's exit event so an exit-straight
                      departure attributed to that corner stays in domain)
```

`t_freeze_end` is the line's freeze-window end when its mistake spec carries one
(today: `chop`'s `freeze_s`, `03-…md` §7.1) and `−∞` otherwise. **The clamp is
not conservatism, it is validity:** inside a freeze `02-…md` §3 overrides
`roll_cmd = 0`, so a reserve-lean roll is a command the model forbids, and a
`tau_close_s` drawn from that region would assert an input the engine would have
refused to deliver. §4a.3 exists precisely to push `t_shot` past it.

Grid = the retained arc-grid stations inside the domain decimated to
`HORIZON_SCAN_DS_M`, plus the **mandatory grid points**
`{t_detect, t_shot, t_freeze_end}` (each when it lies in domain), plus both domain
endpoints. The grid is derived from the recorded sample array in station order:
no ordering freedom, no RNG, no wall-clock (D38).

```
HORIZON_SCAN_DS_M    = 0.5  m   TUNING — scan resolution. Bound by the resolution law below.
HORIZON_EPS_S        = 0.02 s   TUNING — bisection stop tolerance (JSON precision).
HORIZON_DISPLAY_DP   = 1        decimal places — clamps every human-facing string.
HORIZON_TAU_QUANTUM_S = 0.1 s   definitional: 10^(−HORIZON_DISPLAY_DP) seconds.
HORIZON_BISECT_MAX   = 8        iterations — hard cap (deterministic termination).
```

**The resolution law (normative).**
`HORIZON_SCAN_DS_M / v_max ≤ HORIZON_TAU_QUANTUM_S` over the scan domain, where
`v_max` is the maximum recorded speed in domain. *The monotonicity guard is never
coarser than the precision the tool displays.* The default 0.5 m satisfies it
with margin at `book90`'s 9.44 m/s (0.053 s ≤ 0.1 s); the retired 2.0 m did not
(0.21 s), which is why a scan step could be wider than the entire honest
post-detect domain. `HORIZON_DISPLAY_DP` and `HORIZON_TAU_QUANTUM_S` are two
spellings of one policy and are kept separate because one is a count and the
other a duration; comparing a step in seconds against a count of decimal places
is the type error this pair exists to prevent. The implementation MUST refuse a
`--scan-ds` that violates the law — `SCHEMA`, `scan_ds_too_coarse`, carrying
`{scan_ds_m, v_max_ms, step_s, bound_s}` — rather than silently under-triggering
`intermittent`.

**Declared limitation (and it belongs in the placard's long form).**
Monotonicity is certified only at grid resolution. A save-window flicker band
narrower than one grid interval is not detected, and `tau_close_s` is then an
early flicker edge rather than the last save instant. The law binds at the
fastest station in domain, so slower stations carry proportionally coarser `τ`
steps and the residual blindness is widest at the slowest point of the corner.
This is a property of any finite scan; bisection does not close it, because
bisection refines a bracket the scan already found.

Evaluate `saved` at every grid point in ascending `τ`. Let `transition_count` =
the number of adjacent grid pairs whose verdicts differ, and let `open_count` =
the number of maximal contiguous runs of `saved = true` (the save *bands*). A
leading `false` run is **not** a closed window but the §4b.3 inside-curl: at `τ`
early enough that the reserve-lean circle overshoots the inside edge and departs
before `s_detect`, `saved = false` by the predicate itself. That prefix precedes
the window; it does not deny that the window opens. The classification therefore
keys on `open_count` — how many times the window opened — not on `saved(τ₀)`.

| condition | `status` | scalars emitted |
|---|---|---|
| `corrective == null` for that corner | `not_applicable` | none |
| `open_count == 0` (no grid point `saved`) | `never_open` | none (+ `transition_count`) |
| every grid point `saved = true` | `open_at_end` | `tau_close_s = τ_last`, `open_at_end: true` |
| `open_count == 1` | `resolved` | the full set |
| `open_count ≥ 2` | `intermittent` | **only** `transition_count` |

**The table is first-match-wins in table order.** The rows are not pairwise
disjoint — a scan whose single save band reaches the horizon matches both
`open_at_end` and `open_count == 1` — so precedence, not disjointness, is what
makes `saveWindow` a total function. `never_open` (zero bands) is tested before
the band rows, which is why the `resolved` branch below can assume the scan
opens: a window that never opened has already been classified. `resolved` is
**exactly one** save band, whose trailing edge is the single closing instant
`tau_close_s`; the band may carry a §4b.3 inside-curl `false` prefix and a
`false` tail of too-late launches, and neither denies that single instant.
`intermittent` is **two or more** disjoint bands — the window genuinely opened
and closed more than once — the one shape with no single closing instant.
`status` is a **closed five-value set**. **`intermittent` is a refusal, not a
caveat**: no `tau_close_s`, no `s_close_m`, no `reaction_budget_s`, no glyph, no
HUD row — the stepper shows *"the reserve-lean save window opened and closed N
times over this corner; linelab will not report a single closing instant."* That
refusal is what keeps D11 closed (§4b.6).

**Disclosure survives every refusal.** `rider`, `predicate`, `policy`, `status`,
`transition_count` and `placard` are present on **every** `SaveWindow`, including
`intermittent`, `never_open` and `not_applicable`. Only the derived scalars are
suppressed. A refusal that concealed which controller had refused would be a
worse object than the one it replaced.

Under `resolved`, bisect the (true, false) adjacent pair at the **closing edge
of the single band** — the band's last `true` → first `false` grid pair — to
`HORIZON_EPS_S`, at most `HORIZON_BISECT_MAX` halvings, reporting **the last `τ`
that evaluated `true`** — the reported window is never longer than the measured
one. For a scan that opens at `τ₀` the closing edge is the sole transition; for
one carrying the §4b.3 inside-curl prefix it is the band's trailing edge, never
the leading `false → true`. `s_close_m = s(tau_close_s)` via `stateAt`.

### 4b.6 The reaction budget, and the freeze-aware D11 argument

```
t_earliest_s      := max(t_detect_s, t_freeze_end_s)     // §4a.3's own quantity, emitted
reaction_budget_s := tau_close_s − t_earliest_s
react_profile_s   := the rider profile's t_react_s
```

`t_earliest_s` is the earliest instant at which an input was physically possible.
Measuring the budget against it — rather than against `t_detect_s` — is what
makes the scalar mean "how much of the reaction you needed did you actually
have".

**The consistency argument, restated freeze-aware.** By §4a.3,
`t_shot = t_earliest + t_react_s`. Under `status: "resolved"`, `saved` is true on
a single contiguous band and false outside it (the band may carry a §4b.3
inside-curl `false` prefix); `t_shot` lies at or past that band's trailing edge,
being `≥ t_detect` and hence beyond the inside-curl prefix. The bound
`tau_close < t_shot` then holds in the two disjoint ways `corrective.feasible =
false` can arise (§4a.5). **(i) `departed_before_reaction`** (`t_shot >
t_terminated`, §4a.3): the τ-domain caps at `t_terminated` (§4b.5), so
`tau_close ≤ t_terminated < t_shot` outright — `t_shot` is *past* the grid, not
on it (§4b.5 admits it only when in domain), and `saveAt(t_shot)` is not
integrable, exactly as §4a.3 declares the corrective there. **(ii)
integrable-but-no-return** (`shadow_off_road | shadow_crash |
no_return_before_road_end`, `t_shot ≤ t_terminated`): if `t_shot` lies in domain
it is a grid point where `saved(t_shot) ≡ corrective.feasible = false` by §4b.3's
construction and the band shape forces `tau_close < t_shot`; if §4b.5's exit-tail
cap places `t_shot` above the domain top `hi` then `tau_close ≤ hi < t_shot`
directly. Hence

```
corrective.feasible = false  ⇒  tau_close < t_shot
                             ⇒  tau_close − t_earliest < t_react_s
                             ⇒  reaction_budget_s < react_profile_s
```

The chain now goes through **unconditionally**. Measured against `t_detect` it
silently assumed `t_freeze_end ≤ t_detect` and was false on every freeze-carrying
line — the `chop` family today. A `runoff` headline is therefore quantified by
this number and can never be contradicted by it; every configuration in which the
two could disagree is exactly a non-monotone scan, and every non-monotone scan
emits no scalar at all. The contradiction is closed structurally, not by wording.
The alternative baseline `tau_close_s − t(turn_in)` is **rejected**: it breaks
this derivation, which is the only reason the scalar earns its place.

### 4b.7 Output shape and placard

```
SaveWindow = {
  line_id, corner_id,
  rider:     "lean_only_reserve",           // 04 §4c registry id — always present
  predicate: "horizon_bounded_return",      // 04 §4c CfPredicate id — always present
  status: "resolved" | "open_at_end" | "never_open" | "intermittent" | "not_applicable",
  policy: { target_phi_deg, roll_rate_dps, a_cmd_ms2: 0.0,
            basis: "phiReserve(skill·mu)" },      // disclosure, always present
  tau_close_s?, s_close_m?, s_star_m?, open_at_end?: bool,
  t_detect_s?, t_shot_s?, t_freeze_end_s?, t_earliest_s?,
  reaction_budget_s?,        // = tau_close_s − t_earliest_s ; sign is outcome-consistent
  react_profile_s?,          // rider profile t_react_s, for the comparison
  transition_count: int, scan_ds_m, eps_s,
  runs: int,                 // shadow runs actually integrated — budget disclosure
  placard: string            // the sentence below, verbatim
}

saveWindow(lineResult, cornerId?) → Result<SaveWindow | SaveWindow[]>
```

Pure, synchronous, frozen output, `Result`-typed — the exact shape and API tier
`correctiveShot(lineResult)` already occupies (`08-…md` §7.1). `t_freeze_end_s`
is emitted when the line's mistake spec carries a freeze and omitted otherwise.

**The placard (normative, verbatim, always present, always rendered beside any
displayed scalar):**

> *"Reserve-lean save window, probed by the lean-only rider: the last instant
> from which a rider rolling immediately to `phiReserve` with the throttle closed
> still gets back inside the corridor by the station where this line ran wide.
> Assumes instantaneous, perfect initiation. The save commands zero longitudinal
> acceleration, so it forgoes the line-tightening that sub-threshold braking
> would give (bounded by the friction ellipse, `f_long ≤ √(1 − f_lat²)` ≈
> 5.2 m/s² at `phiReserve`, and by `a_widen`); `tau_close_s` is early on that
> axis. The save may cut inside the corridor; inside excursions are graded by the
> checks, not by this number. Not a general point of no return."*

The placard opens with the rider's registered `short_name`, which is how this
surface discharges §4c.7's disclosure obligation without printing a second
string; the corrective surfaces of §4a discharge the same obligation with
§4c.7's own sentence, and no surface prints both. The placard names the bound the
model **actually has**. The earlier wording pointed the reader at suspension
compression, which Tier 1R genuinely cannot model, while concealing the mechanism
the model does own and property-tests (`02-…md` §5.4 invariant 1,
`P-TRAILBRAKE-TIGHTENS`: sub-`A_SU_ONSET` braking tightens the line). It also
credited Ch. 11, whose own text says the technique is already gone once you are
in the corner; that credit is dropped as unearned. Never claim a book source for
a modelled bound the book does not state.

Displayed precision is clamped to `HORIZON_DISPLAY_DP` in the HUD, the CLI human
summary, and `explain`, even though the JSON carries `HORIZON_EPS_S`. Bisecting
finer than the policy's two known biases — optimistic (perfect initiation),
pessimistic (no brake) — can support would be precision theatre. `intermittent`
and `never_open` are first-class results with their own sentences, not error
states.

### 4b.8 Budget and placement

Per corner: `⌈domain_len / HORIZON_SCAN_DS_M⌉ + 5` grid runs plus at most
`HORIZON_BISECT_MAX` bisection runs — ≈ 80 runs on `book90` at 0.5 m, up from
≈ 32 at the retired 2.0 m, but each run is now horizon-bounded rather than
integrated to road end. Because the feature ships as a **stepper overlay and a
CLI verb only** — no exported ink, no controls-strip channel, no envelope
member — these runs are not in the figure recompute path: `C-RECOMPUTE-BUDGET`
and `C-COLDSOLVE-BUDGET` are untouched. The overlay is a user-initiated toggle
with its own looser bound, `C-SAVEWIN-BUDGET`, ≤ 400 ms per corner on the largest
committed figure under the standard 3× CI-variance multiplier. `runs` is emitted
so the budget claim is auditable from the output.

---

## 4c. The counterfactual rider registry

### 4c.1 One signature, two riders, three predicates

Four things in this design ask the same question — *what would have happened if
the rider had done something else?* — and until now each asked it in its own
words. They are one call:

```
counterfactual(world, x0, latency, rider, predicate) → Result<{trajectory, verdict}, CfRefusal>

world     : RoadSpec        // the actual road, or a generated continuation member (D45)
x0        : RiderState      // stateAt(literalised(line), selector) — never re-derived
latency   : seconds         // 0 or the profile's t_react_s
rider     : CounterfactualRider   // the closed set below — the ONLY controller axis
predicate : CfPredicate     // the closed set below — the ONLY success axis
```

`world`, `x0` and `latency` are per-consumer. **`rider` and `predicate` are
not.** The controller is the one part of a counterfactual that asserts doctrine —
it is the claim "this is what a competent street rider would have done" — and the
predicate is the one part that asserts what counts as a save. Both are declared
once, in this document, and consumed by id.

```
CounterfactualRider = "lean_only_reserve" | "brake_reserve_escape"                 // closed
CfPredicate         = "return_after_detect"        // §4a.5 — existential, strict precondition
                    | "horizon_bounded_return"     // §4b.3 — main-line station horizon
                    | "reserve_bounded_run"        // §4d   — reserve-bounded, divergent span
```

**Named entry points are thin wrappers, and each declares its binding.**
`correctiveShot`'s shadow binds `("lean_only_reserve", "return_after_detect")`
(§4a.1); `saveAt` binds `("lean_only_reserve", "horizon_bounded_return")`
(§4b.2); `E_c` binds `("brake_reserve_escape", "reserve_bounded_run")` (§4d).
There is no second harness and no unregistered controller anywhere in the design;
`P-COUNTERFACTUAL-CLOSED` enumerates *through* the wrappers, so a wrapper cannot
smuggle one in.

**Why exactly two riders, and why they may not be unified.** The two riders
answer two different book sentences about two different situations. The lean-only
rider answers a *known* road that the line is departing outward: Parks' remedy is
to add lean off the brakes (`book_text/` L1274), and the shadow that decides
`wide` vs `runoff` is that remedy mechanised. The lean-and-brake rider answers a
*newly revealed* road — a corner that turns out to be something other than what
was committed to: Parks' remedy there is significantly lower speed
(`book_text/` L1282, L1302). The physics forces the same split and forbids the
merge: on `bookDecreasing`'s tightest arc, `κ = 1/9 = 0.1111 1/m` (`03-…md`
§3.1), and at `phiReserve(0.85) = 40.364°` added lean alone meets that curvature
only below 31.2 km/h, while every book figure rides at 34. Unifying the
controllers would either give the corrective shot braking authority §4a.4 rejects
on physics grounds, or strip the escape of the only lever that can meet
`κ_required > κ_available`. **Two questions, two book sentences, two riders.
There is no third.**

### 4c.2 `lean_only_reserve` — the lean-only rider

Shipped since v0.1 as §4a.4's shadow policy. This registry entry is that policy's
declaration, not a redefinition; §4a.4 remains the normative statement of the
control law and is unamended by D42 except for the id binding in §4a.1.

```
id            = "lean_only_reserve"
short_name    = "lean-only rider"          // the exact substring prose must carry
target_lean   = handSign(corner.hand) · phiReserve(skill · config.mu)
roll_rate     = the rider profile's cap
a_cmd         = 0.0 m/s²                   // throttle closed, no brake
preconditions = §4c.4, keyed by predicate
consumers     : correctiveShot   (§4a, in-hash, classification-bearing, return_after_detect)
                saveWindow/saveAt (§4b, out-of-hash, off by default, horizon_bounded_return)
```

Its known conservatism, which every consumer's placard must carry: it commands
**zero longitudinal input**, so it forgoes the sub-`A_SU_ONSET` trail-brake
line-tightening the engine does model (`02-…md` §5.4 invariant 1,
`P-TRAILBRAKE-TIGHTENS`). The probe is therefore conservative on that axis. It is
a probe over a bounded horizon, not a trajectory, and it defines no inside
corrective — §4a.2's outward-only ruling is a property of this rider, not an
accident of the detect predicate.

### 4c.3 `brake_reserve_escape` — the lean-and-brake rider

Declared here, **implementation gated** behind D45's arithmetic spike
`S-CONT-SEPARATION-v2`. The registry is closed at two ids from the moment D42 lands;
in any phase where D45 is unimplemented the *reachable* set is exactly
`{"lean_only_reserve"}` and `P-COUNTERFACTUAL-CLOSED` asserts the subset, not the
equality. A CLI or wire token naming `brake_reserve_escape` before D45 ships is
rejected `SCHEMA` with `deferred: "continuation envelope (D45)"` under the
phase-gating law (`00-…md` §3).

```
id            = "brake_reserve_escape"
short_name    = "lean-and-brake rider"     // the exact substring prose must carry
target_lean   = handSign(sign κ_world(s)) · min( phi_required(κ_world(s), v),
                                                 phiReserve(skill · muAt(s, d)) )
roll_rate     = the rider profile's cap
a_cmd         = slew(A_SLEW_DEFAULT) → −min( escape_decel_mss, aLongAvail(a_lat, mu) )
precondition  = NONE                       // §4c.4 — this rider has none
consumers     : the commitment escape E_c (§4d, D45) — sole consumer, forever
```

`escape_decel_mss` and `escape_ellipse_max` are **declared pack scalars**, owned
by `03-…md` §7a.2 and cited here; the *law* that consumes them is this section's
and is code. That is the D12 seam drawn where it belongs: a pack may carry a
bound, and may never carry the expression that reads it. `A_SLEW_DEFAULT` is
owned by `02-…md` §5.2 and sits below `RATE_THRESHOLD`, so the escape can never
fire the chop transient off its own onset.

`target_lean` is **road-tracking and reserve-capped**, not constant. This is the
one place the registry departs from the shape the corrective shot uses, and it is
deliberate: a constant-lean escape does not track the member road at all, so its
verdict is a statement about the ridden line's instantaneous state rather than
about the road being escaped — the defect the pressure test proved fatal in the
original specification. Grading inside reserve rather than at the friction
ceiling is this rider's known conservatism and must appear on its placard.

The two riders are not in ellipse conflict: this rider's full-reserve operating
point is `sqrt(0.85² + (3.0/9.81)²) = 0.903`, inside its own
`escape_ellipse_max` cap (`03-…md` §7a.2 declares it at 0.95).

### 4c.4 `P-CF-PRECONDITION` — the law the set was relying on without stating

**Normative.** Define

```
OUTSIDE_DRIFTING_OUT(x0) :=  f(x0) > F_DETECT + eps_f_detect     // §4a.2
                          ∧  df/ds (x0) > 0
                          ∧  a turn_in event has occurred at or before x0
```

The obligation is **keyed by predicate, not by domain** — the rider may be
launched from anywhere; what is regulated is whether the return it finds may be
reported as a save.

| predicate | obligation on the caller | refusal if unmet |
|---|---|---|
| `return_after_detect` | `OUTSIDE_DRIFTING_OUT(x0)` must hold. The return station *is* the verdict, so the launch must already be a genuine outward drift. | `not_outside_corridor` / `not_drifting_outward` / `no_turn_in_before_x0` |
| `horizon_bounded_return` | No launch-state condition. The caller MUST supply a station horizon `s_h ≥ s_detect` derived from the **main line**, and grade only a return at or beyond `s_h`. | `horizon_not_from_main_line` |
| `reserve_bounded_run` | None — `brake_reserve_escape` carries no precondition. It is launched from a committed state on a road that has just been revealed, not from a drift, and its authority is speed rather than lean. | — |

**Why the strict route exists, in the design's own numbers.** The rider holds
`phiReserve(skill · mu)`, so on uniform `mu` it traces a circle of radius

```
R_res(v) = v² / (g · tan(phiReserve(skill · mu)))
         = v² / 8.3385                    // street skill 0.85, mu = 1.0, g = 9.81
```

Against the shipped presets, at the speeds those presets actually ride:

| preset | road R (m) | entry (km/h) | v (m/s) | R_res (m) | R_res / R_road |
|---|---|---|---|---|---|
| `book90`, entry speed | 12 | 34 | 9.444 | 10.70 | 0.89 |
| `book90`, solved turn-in (`01-…md` A.3's worked figure) | 12 | 30 | 8.333 | **8.33** | **0.69** |
| `bookBlind` | 12 | 34 | 9.444 | 10.70 | 0.89 |
| `bookEsses` | 12 | 32 | 8.889 | 9.48 | 0.79 |
| `bookHairpin` | 10 | 28 | 7.778 | **7.25** | **0.73** |
| `bookDoubleApex`, c1/c3 (R12 apex corners) | 12 | 30 | 8.333 | 8.33 | 0.69 |
| `bookDoubleApex`, c2 (R24 opening middle) | 24 | 30 | 8.333 | **8.33** | **0.35** |
| `bookDecreasing`, tightened exit (r2) | 9 | 34 | 9.444 | 10.70 | 1.19 |

On the governing corners of every preset except `bookDecreasing`'s tightened exit
the reserve-lean circle is **11–35 % tighter than the road** (ratios `0.65–0.89`;
`bookDoubleApex`'s opening middle corner is tighter still — `0.35`, an even safer
margin, in the same direction). The safety-relevant fact is the one-sided bound `R_res / R_road < 1`:
only `bookDecreasing`'s `1.19` exit is *above* it (reserve circle wider than the
road), and it is the single flagged exception. The break-even entry speed on a
12 m arc is `sqrt(8.3385 · 12) = 10.00 m/s = 36.0 km/h`, above every book figure's
entry. So
from *inside* the corridor this rider does not return the line — it drives the
line across the **inside** edge, and the inside departure is one the design
explicitly refuses to call a save (§4a.2). §4a is safe today only because §4a.2
gates the shot behind an *outward* `run_wide_detect` crossing, where exactly that
over-tightening is what gets consumed getting back. `bookDecreasing` r2 = 9 is the
one corner where added lean is a genuine save on its own — and it is the fig 8.4
corner, i.e. the corner the policy was derived from. **The policy is correct for
precisely the case it was derived from, and is a departure everywhere else.**
That sentence is the whole content of this law.

**Why the horizon route is a genuine discharge and not a loophole.** The defect
above is that an in-corridor launch closes on the inside edge and is nevertheless
scored a save. Under `horizon_bounded_return` that scoring is impossible: the
predicate requires the shadow to be *inside the corridor at a station at or
beyond the main line's `s_detect`*, and a shadow that has departed the inside
edge before `s_detect` has terminated `off_road` and scores `false` (§4b.3). The
horizon is what does the work the launch-state guard does on the strict route,
which is why the design admits two routes rather than one rule with an exception.
`P-SAVEWIN-INSIDE-NOT-A-SAVE` is the mechanical form of this argument and is the
regression test that fails if anyone weakens the horizon.

A violated obligation is a design bug, never a user input error. The harness
returns `Err(CfRefusal)`; any leak of a `CfRefusal` to a CLI surface maps to
exit-4 `INTERNAL` (`08-…md` §7.2), consistent with D11's ruling on runtime spec
errors.

```
CfRefusal.reason  (closed set, D8)
  = "not_outside_corridor"         // f(x0) ≤ F_DETECT + eps_f_detect, strict route
  | "not_drifting_outward"         // df/ds (x0) ≤ 0, strict route
  | "no_turn_in_before_x0"         // detect guard of §4a.2 unmet, strict route
  | "horizon_not_from_main_line"   // horizon route, s_h absent or s_h < s_detect
  | "plan_not_literalised"         // §4c.5 violated: x0's plan carries unresolved anchors
  | "unknown_rider"                // an id outside CounterfactualRider reached the harness
```

`escape_status: "probe_outside_reserve_at_entry"` (`03-…md` §7a.7) is **not** a
`CfRefusal`: it is a per-probe status of a *successful* harness call under
`reserve_bounded_run`, and it is D45's business, not this section's.

Every consumer that could otherwise violate its obligation is already constrained
so that it cannot: §4b binds the horizon route and derives its horizon from the
main line by construction, and D43 deletes the standing ladder's out probe
outright rather than launching a rider from a contained line. The law's value is
that those three violations — each an independently confirmed pressure-test
finding — become **unrepresentable** rather than merely absent.

### 4c.5 The literalise-first rule

**Normative.** Every counterfactual takes its plan from
`LineResult.resolved_scenario.rider.plan` (`05-…md` §7), never from the authored
scenario.

Plans are id-addressed and D21-corner-relative (`00-…md` §5). A counterfactual
world is either the actual road — where the authored plan resolves — or a
generated member road (D45), where the ordinary parser rule re-mints
`c1, c2, …` from the member's own geometry (`03-…md` §2). A corner-relative
anchor resolved against re-minted corner ids means something different on the
member than it meant on the road ridden, and nothing in the design says which
meaning is intended, because neither is. The literalised plan has no such
freedom: every action carries an absolute station, so it means the same thing on
every world.

This is also why `latency` is well-defined: during the latency window the
counterfactual rides the **literalised** plan unchanged, then the rider takes
over. `x0 = stateAt(lineResult, selector)` reads the already-computed line
document and adds zero engine runs — `stateAt`'s purity (`05-…md` §4,
`A-STATE-VERB`) is preserved because the counterfactual is a consumer of the line
result, not a producer of one.

### 4c.6 Packs may reference a rider; packs may never define one

**Normative, and the D12 line applied to controllers.** A doctrine pack
(`01-…md` §A.6) or a continuation pack (`03-…md` §7a.2) may carry a
`CounterfactualRider` id as a declared string, and may carry declared **scalar
bounds** such as `escape_decel_mss` or `escape_ellipse_max`. A pack may not carry
a target-lean expression, a roll rate, a commanded-acceleration *law*, a
predicate, or any other expression.

The seam is **expression versus scalar**, not kinematic versus kinetic, and it is
drawn there deliberately: a bound is a number a reviewer can argue about; an
expression is arithmetic that runs inside the integrator. Admitting a
pack-defined rider would let a data file change what a `runoff` is, which is
exactly the authority D11 reserves for physics and D12 withholds from packs. A
pack carrying an id outside `CounterfactualRider` is rejected `UNKNOWN_ID` at
pack load, naming the id and this section; a pack spelling a policy inline is
rejected `SCHEMA/pack_defines_rider`. Adding a third rider is a design-set edit to
this section with a decision-log entry — not a pack, not a flag, not a config key.

### 4c.7 Disclosure: every emitting surface names its rider

**Normative.** Every surface that emits an escape verdict, an out verdict, or a
save-window scalar carries a machine-readable `rider: CounterfactualRider` **and**
names that rider's `short_name` in its rendered prose. The obligation is on the
*surface*, not on the scalar: a `SaveWindow` that refuses to report a closing
instant still carries its rider (§4b.5).

The complete emitter list, closed, with its hash siting stated because the siting
is load-bearing:

| Emitter | Owner | `rider` field | Hash siting |
|---|---|---|---|
| `correctiveShot(lineResult).shadow` document | §4a.7 | `shadow.rider` | Out-of-hash — the shadow trajectory is in no envelope, no CSV and no hash |
| `verdict.corners[].corrective` | `05-…md` §6.3 | **none — by decision** | In-hash. Adding a field would move `result_hash` on every committed scene |
| `SaveWindow` | §4b.7 | `rider` | Out-of-hash, off by default, absent from every committed book scene |
| `CommitmentReport` | `03-…md` §7a.7 | `rider` | Out-of-hash forever — the Tier B promotion is struck by decision (D45) |

The standing ladder (`05-…md` §6.4) is **not** an emitter: D43 deleted its only
probe, so it runs no counterfactual and asserts no escape verdict. Its own
disclosure obligation names the rubric pack and `checks_version`, not a rider.

**The in-hash exception is deliberate and is the reason D42 costs no re-bless.**
`verdict.corners[].corrective` is classification-bearing and inside
`result_hash`; its rider is fixed by §4a.4 for all time and is therefore *known
from the design of record*, not from the record. The obligation on that surface is
discharged in **prose only** — `explain`, the corrective ghost's legend, the
stepper's `correction` bookmark text and the HUD chip must each carry the
substring `lean-only rider`. `A-CORR-EXPLAIN` is extended to assert it
(`09-…md` §3.6). No field is added, no hash moves, G7 holds byte-for-byte.

Ratified disclosure sentences — these are the exact strings, golden-pinned. The
first is carried **by corrective surfaces**; the second **by continuation
surfaces**. Save-window surfaces discharge the obligation through §4b.7's
placard, whose opening clause carries the `short_name`, so no surface prints two
disclosure strings.

> *"The save is probed by the lean-only rider: an immediate roll to `phiReserve`,
> throttle closed, no brake. It forgoes the trail-brake line-tightening the engine
> models, so it is conservative on that axis, and it is only defined against an
> outward drift — there is no inside save."*

> *"Refutation is by the lean-and-brake rider: an escape that tracks the revealed
> road, rolls to at most `phiReserve` and brakes at up to `escape_decel_mss`,
> graded inside reserve rather than at the friction ceiling. A different escape
> may survive where this one does not."*

### 4c.8 What §4c deliberately does not change

- **§4a.4 is unamended.** Its control law is the normative statement; §4c.2
  declares it under an id.
- **The classification shadow stays in-hash, stays unsearched, stays
  `lean_only_reserve`.** D18 is narrowed by §4c.4's precondition, not re-derived.
- **The hash surface is untouched by D42.** D29's exclusion set is unchanged by
  this section; every field it adds lives on an out-of-hash analysis document.
- **No new physical constant.** §4c introduces ids, a predicate-keyed
  precondition, a rule, and two prose strings.

---

## 4d. The commitment escape (`E_c`) — D45, gated on `S-CONT-SEPARATION-v2`

`E_c` is not `correctiveShot`. It has no `run_wide_detect` trigger (undefined on
a counterfactual road where no drift has begun), and it **brakes**, because the
book's answer to an unknown continuation is significantly lower speed, not added
lean alone. `E_c` is a **named thin wrapper over `counterfactual`** (§4c.1) and
declares its binding here: `rider = "brake_reserve_escape"`,
`predicate = "reserve_bounded_run"`. Under that predicate the rider carries **no**
precondition (§4c.4); the escape's own entry condition is the span split below,
which is a different obligation and is discharged differently.

```
E_c( member m, probe state x_probe at (s_probe, t_probe) ):
  phase 0 — latency: literalise the ridden plan via LineResult.resolved_scenario (§4c.5's
                     literalise-first rule), then integrate it unchanged on m for t_react_s
  phase 1 — escape:  the rider brake_reserve_escape, per §4c.3, to termination
```

The control law — target lean, roll rate, `a_cmd` — is §4c.3's and is not
restated here. Same pure stepper, same `dt_s`, run-wide slice active.
Corner-relative plan actions are resolved **before** the member road exists;
nothing resolves a corner-relative anchor against member geometry.

**Phase 0 is determinate but line-dependent, and the escape's reach is therefore
not a constant.** "Integrate it unchanged" means the rider keeps doing whatever
the ridden plan commanded — which at a probe near turn-in may be trailing brake,
coast, or roll-on depending on the line. The resulting *reach* — the station at
which the escape terminates on `v < v_floor_ms` — moves accordingly. On
`bookBlind` at 34 km/h the span across plausible phase-0 commands is
**20.2 m (plan braking at −1.0) to 27.5 m (plan on throttle at +1.0)**, against a
coasting reach of 23.6 m — all three terminating at `v_floor_ms = 2.0`
(`02-…md` §7), not at `v = 0`. That is a ±15 % band on the single quantity that decides
whether the divergent span is non-empty at all (§4d's span split), so:

**Normative:** *no document may quote an escape reach without naming the line and
the probe it was computed at. `03 §7a` and `09 §3.4a` state reach only alongside
`sight_ride_m` at the same station, never as a fixture-level constant.*

**Grading is split by span, and this is the whole of the repair.**

```
Shared span    := escape samples with s ≤ s_L      (identical across all members)
                  s_L is the sight-limit station, 03-roads-… §7a.3
Divergent span := escape samples with s >  s_L

start_ok(probe) :⇔ over the shared span: no off_road, no crash,
                   |phi| ≤ phiReserve + eps_deg_report,
                   ellipseMag ≤ escape_ellipse_max, f ≤ F_SAVE + eps_f_save

if ¬start_ok:  probe.escape_status := "probe_outside_reserve_at_entry"
               every Member.escaped := null, refute_reason := null
               probe.k_refuted := null; the probe is excluded from every count, every
               golden and every monotonicity property; the fan is drawn with the placard
               "at this station the ridden line is already outside the escape corridor;
                no continuation-dependent refutation is available here"

escaped(m) :⇔ start_ok ∧ the escape reaches member road end or v < v_floor_ms, with the four
              conditions holding at every sample of the DIVERGENT span
refuted(m) :⇔ admissible(m) ∧ ¬escaped(m)
```

A universal predicate over *all* samples fails whenever the initial condition
already violates it — and the initial condition is the ridden line's state at the
probe, identical across every member while `s ≤ s_L`. That version prints *"N of
N continuations could not be escaped"* as a restatement of the ridden line's
instantaneous state, and it is reachable today: `03-…md` §7a.6's
`PROBE_BACK_MIN_M` clamp puts a chained corner's early probes inside the previous
corner, where `F-ORACLE-CHAIN` pins rising peak `f`. The span split is exact,
needs no settling window, and has the further consequence that every refutation
station lies at `s > s_L` — so a rendered cross-tick can only land inside the fan.

`v < v_floor_ms` is a legitimate termination for this rider, unlike for
`lean_only_reserve` (§4a.5, where it is provably unreachable): this rider brakes.
The two policies must not share a termination-vocabulary derivation.

`f` is well defined throughout: the escape runs on `compose(m)` and uses **the
member's own** corridor algebra and lane fraction. No cross-centreline
reprojection exists anywhere.

**Grading is reserve-bounded, not survival-bounded.** Grading a counterfactual at
the friction ellipse would certify lines saved only by an emergency at the
limit — the racing instinct street doctrine exists to suppress.

---

## 5. Chained-corner solving (`chainedSolve`)

Carried shape: linked sequences are solved corner-by-corner,
latest-contained-turn-in first, each corner **seeded by the bike's real emergent
state from the corner before**, across an ascending decel scan — the gentlest
fully-contained decel wins (doctrinal slow-in without over-slowing). Coarse
per-corner search, full-resolution re-verify; per-corner candidate evaluation
always re-integrates the plan-so-far from road start at coarse resolution (no
state stitching — determinism preserved), and the final chain re-verifies once
at full resolution.

**Chains are the default invocation.** `solve`/`ride` on a multi-corner road
chains across each maximal linked run of corners (`linked_next`, stamped at
`compose` — `03-…md` §2); `corner=<id>` restricts to one corner; unlinked
corners on one road solve independently in sequence.

**Chained corners inherit the derived-station table.** Each corner computes
§4.1a with `L_app(n) = gap(n−1)`. When `gap < brake_gap(n) + BRAKE_RUN_MIN_M`,
corner n gets **no per-corner brake action**: speed for the whole linked group
is set by the single chain-entry brake — which is what the ascending
gentlest-decel scan scans. Interior braking is generated only where the gap
affords it.

**Linked exit targets.** For a linked interior corner the exit bisection's
target is not `exit_target = 0.85` but the next corner's doctrinal entry,
expressed in corner n's own hand-resolved `f` frame:

```
exit_f_target(n) = LINKED_EXIT_F_OPP  = 0.15   if hand(n+1) ≠ hand(n)   (TUNING)
                 = LINKED_EXIT_F_SAME = 0.90   if hand(n+1) = hand(n)   (TUNING)
```

Kissing a left-hander's inside late *is* the following right-hander's wide entry
— "sacrificing each open exit to set up the next turn-in" made mechanical.

**Supersession.** Chained turn-ins interact by supersession in the steering
machine (`02-…md` §3.1 — a superseding `turn_in` ends the previous commitment);
the solver may place `turn_in(n+1)` inside corner n by writing `hand`
explicitly, and the binding rule carries it past the intervening corner.

**The hand-flip budget.** Between opposite-hand corners the bike must roll from
`+φ_n` through upright to `−φ_{n+1}`, consuming
`d_flip(v) = v · (φ_n + φ_{n+1}) / roll_rate` metres at speed `v` (≈ 9.0 m at
28.7 km/h, street profile, R 12 both sides — why `bookEsses` carries `S 6`
links, `LINK_GAP_M = 6`, TUNING). Part of `d_flip` is absorbed inside the arcs
(the unwind may begin before the geometric corner end; the next turn-in sits
past the geometric start). Authored zero-gap chains stay **legal grammar**: an
infeasible flip manifests as lost containment at the head of corner n+1, which
the ascending scan answers by slowing — and slowing shrinks *both* factors of
`d_flip`. The floor: when the scan reaches the model-validity boundary
(`v_valid_min_ms = 7.0 m/s`, `02-…md` §7) without containment, `chainedSolve`
returns `NO_SOLUTION`/`link_flip_infeasible` carrying `{link: "c2->c3",
d_flip_m, window_m, v_floor_kmh}` — the formula *diagnoses* (names the link and
the shortfall), never generates; physics stays the validator. Turn-in anchors
for chain corners may range across the link and into the previous arc's tail
(§4.1a's sweep lower clamp).

**The chain verdict.** A correctly ridden linked line grades outcome
`contained` with zero applicable check fails — the derived `clean` predicate
holds: on linked interior corners the open-exit checks (`out_in_out`,
exit-wide) read `na` and the chain checks (`link_continuity`,
`chain_containment`, `chain_flow` — `01-…md` Appendix A) apply instead, keyed
off the road's `linked_next` **and** the ridden-linked rule read off the line's
own trajectory (same applicability *rule* for every line, so the verdict stays a
property of the trajectory, and a mistaken chain line still fails honestly under
the identical rubric). Under the quality law it is `good`, hence **green** —
no carve-out, no new vocabulary — and a correct chain exits 0 from `solve`
(`08-…md` §3.1; there is no chain-specific exit tier).

### 5.1 Chained-mistake seeding

`compileMistake(kind, params, ctx)` with a scope covering corners `c₁ … c_N`
compiles **sequentially, corner by corner, in station order**:

1. **Reference stations come from the good line; divergence enters through
   state, never through re-solving.** For each scoped corner n, the perturbation
   offsets the *good line's* per-corner control (e.g. `premature`:
   `s_ti_mistake(n) = s_ti_good(n) − early_by_m`, same `early_by_m` every
   corner). Unscoped corners keep the good line's actions verbatim.
2. After rewriting corner n's action(s), the partial mistaken plan is integrated
   forward (from road start, coarse resolution) to obtain the **real arriving
   state** at corner n+1's perturbed station — the seeding is the trajectory
   itself, exactly as `chainedSolve` seeds its corners.
3. **Lean derivation via engine probes.** Where the kind commits an explicit
   lean (`premature`'s "largest inside-kissing lean") it is derived against the
   *mistaken* arriving state: bisect lean over `(0, phiReserve]` with at most
   `N_PROBE = 8` (TUNING) forward engine shots from the perturbed turn-in; each
   probe holds the candidate lean through the corner and measures `min f`; the
   committed lean is the one with `min f ∈ [0, KISS_TOL_F = 0.05]` (TUNING).
   Monotone in lean, so bisection is sound. If even `phiReserve` cannot reach
   the inside, commit `phiReserve` (the rider leans all they dare — the honest
   reading of a committed early apex). **Boundary rule, normative: compile-time
   probes are bounded engine shots; the compiler never calls a solver.** Probe
   count is fixed, so compilation stays deterministic and hash-stable.
4. **Out-of-corridor mid-chain.** If the mistaken line is still on the
   carriageway but outside the usable corridor at a scoped corner's perturbed
   station, the perturbation **still applies** (turning in early from the
   oncoming lane is precisely the fig 8.6 compounding story); the kiss probes
   measure against the usable corridor as always. If the trajectory has
   *terminated* before the station (off-road, crash, stop), compilation stops
   there: later corners are unreached and unperturbed.
5. The compiled result records `applied_corners: [ids]` (in
   `source.mistakeSpec`'s resolved form) — which scoped corners actually
   received the perturbation — so a truncated chain is legible, not mysterious.

**The one-perturbation rule under N corners:** one perturbation *kind* with one
parameter set, applied per scoped corner — the shareable spec stays
`{kind, params, scope}` (D6: inputs travel, consumers recompute). The plan diff
between good and mistaken lines shows exactly one changed-or-rewritten control
per applied corner, all instances sharing the same kind and params.

The named chained oracle fixture `F-ORACLE-CHAIN` (`bookEsses` → `chainedSolve`
at 32 km/h → `compileMistake("premature", {early_by_m: 4},
{scope: "all_corners"})`) pins, via `O-CHAIN-PREMATURE` (`09-…md` §4): the final
outcome class, `applied_corners`, and the compounding property — per-corner peak
`f` strictly increases across consecutive applied corners while the line is live.
"Each corner wider", fig 8.6's device, finally a test rather than a sentence.

---

## 6. The visibility-governed mode (new, D4)

A ride spec may set `vis=cautious` (default `vis=none`), switching on two solver
rules that generate the doctrinally cautious blind-corner line. The mode's
governing quantities are **authorable knobs (D10)** — fields on the ride spec
with `TUNING` defaults, not internal constants:

| Field | Default (TUNING) | Meaning |
|---|---|---|
| `vis_hold_f` | `0.9` | the lane fraction V2 holds until release |
| `vis_margin` | `1.0` | sight-margin factor: every sight test in the mode reads `vis_margin · ssd(v, phi) ≤ sight_ride_m` |

`vis_margin > 1` buys standoff (require seeing 1.5× the stopping distance before
committing); a higher `vis_hold_f` hugs the outside harder — together they span
a graded family of caution levels rather than one canned strategy. Scene and CLI
spellings (`visHold=` / `--vis-hold`, `visMargin=` / `--vis-margin`) live in §7
and `08-cli-and-agent-interface.md`. Per D8 the knobs are accepted only when
`vis=cautious`; with `vis=none` they are rejected at validation (`INEFFECTUAL`,
`vis_knob_without_vis_mode`).

**V1 — stop-within-sight speed governor.** At every station, speed must satisfy
`vis_margin · ssd(v, phi) ≤ sight_ride_m` for the configured stopping model —
`ssd` is the lean-aware two-phase closed form of `03-…md` §5.2, evaluated with
the sample's own lean, and `sight_ride_m` is the recorded rider-path lookahead,
the sole basis for every sight-vs-stopping judgment (`sight_m` keeps its
centreline basis for cross-line comparability and rendering): never ride faster
than you can stop — with the authored standoff factor — within what you can
currently see. The governor caps entry speed (upright, `phi = 0`) and holds
maintenance throttle (no roll-on) while the limit point is closing (the recorded
per-sample `sight_trend`, defined once in `05-…md` §4). The iteration re-runs
the engine per candidate, so the trajectory the lookahead needs exists at every
iteration.

**V2 — hold wide until release.** For each blind corner, V2 emits at most one
**ordinary generated `position` action** into the solved plan — same wire
shape, same validation as an authored one, no solver exemptions (the solver
guarantees validity by construction, using the same reachability formula the
validator uses — `02-…md` §3.1, `03-…md` §6.1):

1. Candidate window: from the earliest legal station (road start, or the
   previous corner's static commitment end) to the corner's intended turn-in;
   `over_m = "auto"`.
2. Compute, under the **V1-governed** speed (the iteration applies V1 before
   placing holds — governing is what makes holding reachable), the reachable
   displacement `dd_max` from the declared `f_from`.
3. If `vis_hold_f` is fully reachable → emit
   `position {f: vis_hold_f, over_m: "auto"}` — the position that maximizes
   `sight_ride_m` around a lateral occluder.
4. Else **clip**: `f_hold_clipped = f_from ± dd_max / W_corr` toward
   `vis_hold_f` (sideSign-resolved). If the clipped displacement is below
   `MIN_POS_DD_M` (`02-…md` §3.1) → **emit no action at all**; the line holds
   whatever `f` the exit left it at (the `track` state's snapshot semantics make
   this well-defined).
5. The **release station** is the first station where `sight_trend = opening`
   **and** `sight_ride_m ≥ vis_margin · ssd_m` at governed speed — evaluated
   from the **actual** per-sample `f`, never an unreached target. Turn-in is
   placed at or after release, and roll-on is gated on release rather than on
   the geometric exit alone.

**Mechanics — a bounded heuristic verified by self-check.**

1. **Iteration:** solve → read the emergent sight channel → regenerate V1 speed
   caps and V2 holds → re-solve. **No convergence is claimed** (widening can
   shorten sight under outside/oncoming occluders; on alternating esses, corner
   n+1's outside is corner n's inside). Iterations are bounded by
   `vis_max_iterations = 4` (TUNING, carried).
2. **Acceptance is decided only by the terminal self-check.** After each
   iteration the candidate is self-verified (full engine re-run) and the mode's
   acceptance predicate is evaluated **on that run**: V1 at every station, V2's
   hold ahead of each blind corner under the actual-position rule, and all
   authored constraints. The first iterate whose self-check passes is returned;
   iteration stops there.
3. **V2's hold target is the authored `vis_hold_f`, not a computed argmax.** The
   mode encodes the inside-occluder doctrine it exists to teach; when an
   outside/oncoming occluder makes wide genuinely worse, the self-check reports
   it honestly and the author's move is `vis=none` plus constraints (§4.5) —
   placard policy, not cleverness.
4. **Failure surface (typed, closed — registry §4.10):**
   `NO_SOLUTION`/`vis_unsatisfiable_within_bound` — no iterate passed within the
   bound, with `detail.iterations = [{min_margin_m, worst_s, hold_met}]` per
   iterate so an agent can see oscillation (alternating margins) vs a genuine
   deficit (plateaued negative margin); and
   `NO_SOLUTION`/`vis_speed_below_model_floor` — V1 governs speed below
   `v_floor_ms` somewhere: the corner cannot be ridden within sight at this
   margin inside the model's validity. Honest refusal, never a fabricated crawl.

Every line returned under `vis=cautious`, single or chained, satisfies the
mode's acceptance predicate on its self-verified run (`09-…md`:
`P-VIS-SELFCHECK`, `P-VIS-BOUNDED`) — the output is what is verified, never the
iteration.

**Composition with `chainedSolve` (D10).** `vis=cautious` on a linked sequence
is specified, not left to chance. The V1 governor caps speed at **every station
of the chain**; V2 runs **per corner** — ahead of each blind corner's turn-in
the hold is generated in the inter-corner span by the V2 mechanism above (fully
reachable, clipped, or no action at all on short links, with release always
evaluated from the actual per-sample `f`). Release stations are computed per
corner from the emergent line, and the iteration runs chain-wide — solve the
chain, read the sight channel, apply V1/V2 at every corner, re-solve — under the
same bounded self-check contract and the same `vis_max_iterations` bound. The
result is graded by the chain-aware check set (§5) plus the sight checks.

The canonical blind-corner figure is the comparison this mode exists for: the
same corner ridden `vis=none` (geometry-optimal, sight-indifferent) against
`vis=cautious`, with per-sample sight distances readable off both lines — the
agent-visible, physics-measured version of "the wide entry sees further."

---

## 7. The scene text format

One figure per `.scene` file; the declarative source an author or agent edits
(baked outputs are never hand-edited). Scene text is **sugar over FigureSpec
JSON** — `lowerScene(sceneText)` is a pure, total, deterministic lowering, the
`figure` verb accepts either spelling, and `spec_hash` is computed on the
lowered form, so a figure's identity is spelling-independent (D30;
`08-…md` §3). Top-level keys at column 0; `lines:` and `labels:` entries
indented; `#` comments outside double quotes; typed errors carry the offending
token and 1-based line number.

```
road:      <road-DSL line> | preset <name> [hand=L|R]   # required, exactly one (road-ref token)
lines:                                              # required, 1..N entries: "name: kind args"
  good:    ride entry=34 turnIn=auto
  bad:     mistake premature:early_by_m=6
  wide:    ride entry=34 vis=cautious role=alternative
occluders: hedge inside c1 -6x36 margin=1.2         # optional, one per line (bare id = entry: sugar, 03 §4)
hazards:   gravel outside c1 +8x3 mu=0.4            # optional, one per line
marks:     auto                                     # optional MarkSpec (default auto: ideal-line marks)
labels:                                             # optional callouts, road + event-feature anchors
  apex:c1   "late apex — sight traded for exit"
  entry:c1  "turn in late"
view:      mode=diagram window=auto                 # optional; vocabulary owned by 06
note:      "caption text"                           # optional
```

- **`road:`** takes the shared **road-ref token** — a road DSL one-liner or
  `preset <name> [hand=L|R]` (`hand=` with the DSL form is rejected `SCHEMA`;
  the DSL already says it) — plus optional trailing road options
  `fullWidth=true` / `bikeMargin=<m>`, stripped by the scene parser before DSL
  parse (round-trip identity untouched). Unknown or duplicate option keys →
  `SCHEMA` naming the token and 1-based line. The same token spells `--road`
  (`08-…md` §4.1); semantics in `03-…md` §2/§6.

Line kinds (closed set): `ride | mistake | naive | plan`.

- `ride`: `entry=<kmh>` (required), `turnIn=auto|<m>` (default auto),
  `style=single|double_apex|geometric` (default single),
  `corner=<id>|<a>..<b>` (default: chain across each linked run — §5; a single
  id restricts to one corner; a span targets a compound window — §4.6),
  `vis=none|cautious` (default none), `visHold=<f>` / `visMargin=<×>` (the D10
  knobs; valid only with `vis=cautious`, else rejected `INEFFECTUAL`),
  `believeRoad="<dsl|preset>"` (§4.7), `accept=clean|best_failing` (§4.8),
  `startF=<f>` (exposes `rider.start.f` — mid-road entries),
  `constraints="<token>[; <token>…]"` (the compact grammar of §4.5),
  `role=<role>`, `label="…"`, `marks=<MarkSpec>`.
- `mistake <token>` — the one composed mistake grammar
  `kind[:k=v,...][@scope]`, e.g. `premature:early_by_m=6@c1,c2` or
  `underread:r_believed=16` (`@all` ↔ wire `scope: "all_corners"`); the entry
  name supplies the line id, so a `lineId=` prefix is `SCHEMA` here. Kinds and
  per-kind defaults from `03-…md` §7.1; compiled against the figure's **first**
  `ride` line — the reference every mistake is measured against. The old
  space-separated `key=val … scope=…` spelling is rejected with a typed `SCHEMA`
  error whose message prints the equivalent token.
- `naive`: the fixed generic-rider baseline at the good line's turn-in.
- `plan <file.json>`: an explicit wire scenario included as a line.

**At least one `ride` line is required** — the first is the reference; a
zero-ride scene (only `mistake`/`naive`/`plan` entries) is rejected with a typed
`SCHEMA` error ("no reference line; a mistake needs a first `ride` entry to
compile against").

Role defaults: first `ride` → `ideal`, subsequent `ride` → `alternative`,
`mistake` → `mistake`, `naive`/`plan` → `reference`. Any entry may override with
`role=`. **No count caps and no exclusivity rules** — D9 removed the prior
one-amber-slot and `alt`-XOR-`naive` constraints; colour comes from each line's
own verdict.

`marks:` takes a **MarkSpec** — `auto | all | none | <class-list>` over the
closed marker classes `turn_point | apex | exit | release` — at figure level,
overridable per line with `marks=`; `auto` (default) draws all classes on
`ideal`-role lines only. Value language and validation owned by `03-…md` §8.

Names must be unique (results and receipts are keyed by them). Label anchors:
road anchors (`entry|mid:<id>[ ±m]`, and `exit:<id>` without `@`) resolve on the
road; line anchors `feature[:corner][#n]@line [±m]` over the closed feature set
(`turn_point | apex | exit | release | correction | run_wide_detect | end |
sight_ray`) resolve post-run against the named line's recorded events — never
before the engine runs. A feature anchor with no `@line` resolves against the
first `ideal`-role line, preserving the carried `apex:<id>` sugar. Grammar, wire
shapes, and the typed `anchor_no_match`/`anchor_ambiguous` errors are owned by
`03-…md` §8. `view:` speaks the projection vocabulary of
`06-rendering-and-projection.md` (`mode=`, `window=`, `orient=`, `look=`, …).

Baking is pure and deterministic: identical scene text produces identical
artifacts (`09-verification-and-testing.md` owns the round-trip gates). A
`--check` lint mode validates scene syntax and placements without solving
(`08-cli-and-agent-interface.md`) — closing the prior asymmetry where scene
errors surfaced only during a full bake.

The six-line bar, demonstrated: `road:` + `lines:` + two line entries + `view:` +
`note:` is a complete good-vs-mistake teaching figure.

---

## 8. Agent workflows

The canonical recipes, at API level (CLI spellings in
`08-cli-and-agent-interface.md`). Each step names the contract it returns.

**R1 — Ideal line on a fresh corner.**
`parseRoadDSL("lane 3.5 | S 12 | R 12 ^90 | S 16")` → `solve({road, entry_kmh: 34})`
→ verified result: solved plan (explicit signed turn-in `{lean_deg, hand}`),
trajectory, verdict (`contained`, quality `good`, apex ≈ late), every sample
inspectable via `stateAt`.

**R2 — Mistake overlay.** R1's solved context → `compileMistake("premature",
{early_by_m: 6}, ctx)` → failed line with engine-emergent `runoff` outcome +
diagnosis (and the corrective verdict block deciding it was not a save —
§4a); figure = both lines; diff of the two plans shows exactly one changed
control.

**R3 — Blind-corner visibility compare.** `preset bookBlind` → `solve({road,
entry_kmh: 34})` (vis=none) and `solve({road, entry_kmh: 34, vis: "cautious"})` →
two lines whose per-sample sight channels (`sight_m` for cross-line
comparability, `sight_ride_m` against `ssd_m` for the safety judgment) quantify
the hold-wide teaching; figure renders both with sight rays and the occluded
region.

**R4 — Linked chain with compounding mistake.** `preset bookEsses` (four
alternating corners) → `chainedSolve` (green chained line — outcome `contained`,
quality `good`) → `compileMistake("premature", {}, {scope: "all_corners"})` →
the corner-over-corner amplification figure (fig 8.6 equivalent): per-corner
peak `f` strictly increases across applied corners (§5.1).

**R5 — Book-figure recreation.** A `.scene` file: preset road + `ride` +
`mistake` lines + corner-relative labels + `view: mode=diagram` → bake → static
SVG through the diagram projection plus the same figure loadable in the viewer
for stepping (`07-viewer-animation-and-pov.md`).

**R6 — Constraint-shaped custom line.** R1's road → `solve({road, entry_kmh: 34,
constraints: [{id: "hold", span: {from: "entry:c1", to: "mid:c1"}, bound:
"f_min", value: 0.6}]})` → a solved line that stays outside lane fraction 0.6
until mid-corner, its verdict recording each bound's remaining margin — or a
typed `NO_SOLUTION` (`constraint_unmet`) naming the worst station. Compare
against R1's unconstrained line to quantify what the bound cost in exit speed.

**R7 — Planned double apex.** `preset bookDoubleApex` → `solve({road,
entry_kmh: 30, style: "double_apex"})` → green two-touch line (outcome
`contained`, quality `good`), verdict carrying both touches in
`corners[].apexes[]` → companion red line via believed-road (§4.7) or
`accept=best_failing` (§4.8) → two-line figure = fig 8.5. On `bookDecreasing`
the same call refuses `NO_SOLUTION`/`no_two_touch_line` — the fig 8.4 taper
does not reward two touches, and the refusal teaches that.

**R8 — Misjudged corner end-to-end.** `preset bookDecreasing` → `solve` the
reference line → `compileMistake("underread", {}, ctx)` (taper default:
`r_believed = r1` — "believed the entry radius holds") → the believed world
solves clean; the literalized plan executes on the actual road; samples are
byte-identical to the believed run until `s_divergence_m`, then the tightening
bites — `run_wide_detect`, the corrective shadow, outcome `runoff` → red.
`verdict.misjudgment` carries `s_divergence_m`, `kappa_gap`, and the
believed-world hashes; `explain` composes the intent-level and physical stories.
`sweep` over `scenario.entry_kmh` reads the teaching window off one table
(`08-…md` §6 recipe (h)).

The bar these recipes are tested against (`09-verification-and-testing.md`): an
agent starting from `schema` + `explain` output alone completes each recipe
correctly on the first try.

---

## 9. Relation to the prior design

**Carried:** physics-as-validator with mandatory self-verification (now
verifying through the released, unwound exit); the
feasibility-probe-then-two-bisections solve with its decoupling justification
and the carried decel bracket; coarse-then-fine search discipline with its typed
disagreement error; `suggestTurnIn`'s sweep/rank/verify shape; separate
specialized solvers rather than a weakened main gate; `chainedSolve`'s seeded
corner-by-corner ascending-decel scan; the **first-ride-is-reference** scene
rule; the ≤6-line ergonomic bar; corner-relative label anchors with post-solve
`apex:` sugar (now the default-line case of `03-…md` §8's event-feature
grammar); the fixed-policy corrective shot and its `phiReserve` target, unchanged
in substance; the branched-shadow discipline.

**Changed:** every solver station constant is corner-relative (§4.1a —
fractions of `L_app/L_arc/L_exit` with the typed `road_too_short` refusal; the
carried absolute metres provably emptied the search domain on the book-scale
presets); apex targeting is corner-type-aware (§3); `solveDoubleApex` is a full
mechanism (§4.6) rather than a parenthetical, and under Tier 1R the mid-corner
drift between touches is representable; the corrective shot is specified here
(§4a) as a fixed-policy branched shadow — never a search, never inside the main
integration; a correctly ridden linked line grades green because it is *clean*
under road-derived check applicability (§5) — outcome `contained`, quality
`good` — not by carve-out; the visibility fixpoint is demoted from a
falsely-monotone iteration to a bounded heuristic verified by self-check (§6),
its sight tests re-based on the rider-path `sight_ride_m` and the lean-aware
`ssd`; the solved plan carries an explicit signed turn-in `{lean_deg, hand}`
(§4.2); scene grammar drops the one-amber-slot and exclusivity rules and the
one-ride-line cap ("at least one", §7), adds `role=`, `vis=`, `plan` lines,
preset roads with `hand=` and road options, the occluder/hazard split, the
composed mistake token, corner spans, MarkSpec, and a no-solve `--check` lint;
`view:` speaks the projection vocabulary of `06-rendering-and-projection.md`
(+ `look=`, `orient=`) instead of a lateral `exag` knob; the shot's controller is
now a registered rider under a declared predicate with a stated precondition,
rather than an inline policy; `shadow_stopped` is retired as an unreachable fail
reason.

**New:** the visibility-governed mode with authorable knobs (`vis_hold_f`,
`vis_margin`) and specified chained composition; believed-road solving (§4.7)
with the `underread`/`overread` misjudgment kinds — one control **or** one
belief, never both; `accept=best_failing` (§4.8) with always-present
`acceptance {policy, met}` provenance; the authored-plan merge contract (§4.9);
the closed `NO_SOLUTION` sub-reason registry (§4.10); chained-mistake seeding
(§5.1), which turns fig 8.6's compounding into a test; recipes R7/R8; and
constraint-targeted solving (§4.5, D10) — together they make "choose different
paths based on visibility", "ride the corner you believed", and "show me your
best failing attempt" authorable, comparable, first-class capabilities: the
solver chases authored intent without ever accepting an authored path. Also new:
the counterfactual registry and one-signature harness (§4c), the
literalise-first rule, the packs-may-not-define-a-rider line, the reserve-lean
save window (§4b), and the commitment escape (§4d, gated).

---

## 10. Deferred: the fit front door (post-v1)

`fit(trace)` is the "grade MY line" door — an authoring solver (rung (e) of the
ladder when promoted). This section is a scoped sketch, normative at promotion:
the Trace wire schema then moves to `03-…md`, the verb
`linelab fit <trace.json> --road <dsl|preset>` enters `08-…md`'s table, and
`NO_FIT` enters `08-…md` §7.2's closed error vocabulary — flagged now as a
designed future addition so the vocabulary's closedness is not silently broken
later.

**Signature and semantics.**

```
fit(trace, {road, profile?}) → Result<{plan, residual, result}>
```

Search plan-action space — entry speed, turn-in station, decel, roll-on onset,
plus the mistake vocabulary's perturbation axes (roll-rate factor, facet count,
chop offset) — for the plan whose **engine-integrated** line best explains the
observed trace; then grade the fitted plan exactly like any authored plan
(verdict, checks, colour per D9). Objective: station-wise lateral RMS between
the fitted line and the map-matched trace, plus a speed-profile term weighted
`W_FIT_V = 0.3` (TUNING) when a speed channel is present and a lean term
`W_FIT_PHI = 0.2` (TUNING) when a lean channel is present. Search shape: coarse
grid over (turn-in × entry) with nested bisection on decel/roll-on — the same
coarse-then-fine discipline §3 already makes normative.

**Input format** (`linelab-trace/1`):

```
Trace = { format: "linelab-trace/1", source?: "gps"|"logger"|"other",
          samples: [ { t_s,                       // required, strictly monotone
                       lat, lon | x_m, y_m,       // one positional pair required
                       v_ms?, phi_deg? } ] }      // optional logger channels
```

GPS coordinates convert to local metres via a local tangent plane at the first
sample. The **author supplies the road** (DSL or preset): linelab never infers
road geometry from a trace — roads remain authored one-liners, and map-matching
projects each trace point to its nearest centreline station. Typed refusals: any
point farther than `FIT_OFFROAD_M = 10 m` (TUNING) from the centreline →
`NO_FIT` (`trace_off_road`, worst point cited); non-monotone `t_s` → `SCHEMA`.

**Residual semantics — the teaching output:**

```
residual = { rms_lateral_m, max_lateral_m, at_s,
             quality: "tight" | "loose",            // ≤ FIT_TOL vs ≤ FIT_MAX_RMS
             deltas: [ { action_id, field, fitted, vs_ideal, description } ] }
```

`FIT_TOL = 0.5 m`, `FIT_MAX_RMS = 1.5 m` (both TUNING). Above `FIT_MAX_RMS` the
result is a typed `NO_FIT` (`unexplained`): the tool refuses to pretend a ride
was a plan its vocabulary can express. Between the two, the fit returns with
`quality: "loose"` and a rendered placard. `deltas` is what `explain` narrates
against the same road's ideal solve — *"your ride is best explained by a turn-in
6 m early and a roll rate 40 % below profile"* — the residual, not the verdict,
is the coaching payload.

**The drawn line is always the fitted plan's engine-integrated trajectory** —
never the raw trace. The trace may render as *evidence*: a dotted neutral-grey
"observed" underlay with no verdict, no colour, no Sample contract, and no
`stateAt` surface — an explicitly non-line draw element. This is the
load-bearing D7 distinction, restated at promotion over the three input classes
— **worlds** (roads, believed roads), **commands** (plans, solve intent,
constraints), **evidence** (traces): evidence input is admissible, never drawn
as a line, never enters a plan schema; every drawn line stays engine-integrated
(D39, `00-README.md` §2).

Acceptance is pre-written and runs at promotion (`09-…md`): `A-FIT-ROUNDTRIP`
(a synthetic oracle — a downsampled, seeded-noise `premature` trajectory fits
back to a turn-in ≈ 6 m early), `A-FIT-REFUSE` (a trace outside the vocabulary,
e.g. a U-turn, refuses `NO_FIT` — never a forced bad fit), and
`P-FIT-LINE-PROVENANCE` (the rendered line's samples are byte-identical to
running the fitted plan as an ordinary scenario).
