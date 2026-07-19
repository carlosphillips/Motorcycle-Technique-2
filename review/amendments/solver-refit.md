## Solver Refit (review §4, all bullets)

> **EDITORIAL RECONCILIATION (binding) — 2026-07-19 editor pass.** Merged against the
> thirteen sibling amendment sections per the three reconciliation audits. Where the
> body below disagrees with a bullet, the bullet wins.
>
> - **Outcome law:** doctrine-catalogue's Option B won the owner-level seam decision;
>   SR-6's applicability MACHINERY survives intact (see the merge note at SR-6);
>   `A-CHAIN-CLEAN` respells `A-CHAIN-GREEN`; "grades clean" reads "outcome
>   `contained`, quality `good` (the derived clean predicate)".
> - **Applicability:** doctrine-catalogue wins the two-level rule — geometric chain
>   from `linked_next` (road) AND `ridden-linked` (per the line's own trajectory);
>   this section's "same applicable set for every line" weakens to "same
>   applicability RULE for every line". `linked_next`/`LINK_GAP_FRAC = 1.0` is the
>   ONE geometric predicate/constant project-wide (doctrine's `CHAIN_GAP_ARC_FRAC`
>   and misjudgment's `GROUP_GAP_M` are deleted; a corner group = a maximal
>   same-hand `linked_next` run).
> - **Two-apex recording:** misjudgment owns the verdict shape
>   (`corners[].apexes[] = [{s, pct, f, clearance_m, v_kmh, lean_deg}]`, hysteresis
>   detector APEX_PROMINENCE_F/APEX_MIN_SEP_M); SR-3.4's touch predicate survives
>   ONLY as the solver-internal candidate-acceptance filter; the `touches` verdict
>   token is retired.
> - **bookEsses:** scene-vocabulary owns preset geometry — four corners, R 12 ^75,
>   S 6 links; SR-1.2's esses arithmetic re-works with gap = 6; the zero-gap
>   variant is a named fixture (A-LINK-FLIP, A-CHAIN-VIS-BUDGET). `bookEsses-early`
>   folds into `F-ORACLE-CHAIN` (verification's roster) with `O-CHAIN-PREMATURE`'s
>   assertions attached (respelled in place).
> - **Kinds:** respelled in place per the rename (`premature` = runs-wide, nee
>   `early_apex`); `compileMistake("premature", {early_by_m: …})`.
> - **A-CHAIN-VIS:** owned by 09 — verification's FULL/BUDGET pair re-based on the
>   new geometry (FULL on `fx-esses-blind`, BUDGET on the zero-gap variant), both
>   asserting this section's reached-f (actual-position) hold rule and
>   scene-vocabulary's `min(vis_hold_f, f_reach)` assertion.
> - **Exit codes:** the merged 08 §3.1 five-tier table stands; this section's
>   surviving requirement is "no chain-specific tier; a correct chain exits 0".
> - **R7 stays this section's** (double-apex recipe); misjudgment's misjudged-corner
>   recipe renumbers to R8.
> - The `NO_SOLUTION` sub-reason registry + `detail:{sub_reason,…}` extension is
>   adopted into 08 §3.2's error shape (agent-interface owns the envelope).
> - **Vis-floor sub-reason spelling:** SR-7's closed registry wins project-wide —
>   the token is `vis_speed_below_model_floor`; verification's
>   `vis_governed_below_v_floor` (its §5.2/§9/§12) respells in place. Same
>   sub-reason, one spelling — a typed-error token in a closed set may not carry
>   two committed forms.

The solve machinery is re-specified so it fits the world it actually runs in: every
station constant becomes corner-relative with a typed refusal when a road is too
short; apex targeting becomes corner-type-aware; `solveDoubleApex` and
chained-mistake seeding get full mechanisms; the vis fixpoint is demoted from a
falsely-monotone iteration to a bounded, self-checked heuristic; and the
"contained, not clean" seam is closed via check applicability (NOTE — merged under
Option B: the applicability machinery below WINS and survives verbatim, but the
"zero new outcome vocabulary" position LOST to doctrine-catalogue's Option B; a
correct chain now grades outcome `contained` + quality `good` = green). All
laws honoured: D7 (nothing below accepts a path — every mechanism is a search over
engine shots), D8 (every new refusal is a typed error), D9/D6 untouched.

Notation used throughout, computed once per corner from the composed `RoadModel`
(all derivable from fields 03 §2 already mints; three new fields are listed in
§SR-7):

```
L_arc(n)  = s1(n) − s0(n)                      // arc length as composed (works for tapers)
L_app(n)  = s0(n) − max(0, s1(n−1))            // approach available to corner n
L_exit(n) = min(road_end, s0(n+1)) − s1(n)     // exit available to corner n
gap(n)    = s0(n+1) − s1(n)                    // inter-corner gap (= L_app(n+1))
```

Worked reference values (verified):
book90 `lane 3.5 | S 12 | R 12 ^90 | S 16`: L_app 12, L_arc 18.85, L_exit 16, road 46.85.
C30 (S 35 | R 30 ^90 | S 25): L_app 35, L_arc 47.12, L_exit 25, road 107.12.
bookEsses (respecified by scene-vocabulary, which owns preset geometry): FOUR
corners, R 12 ^75, L_arc 15.71 each, S 6 links (gaps 6/6/6). SR-1.2's esses
arithmetic re-works once with gap = 6 (the backward term no longer vanishes at
interior corners); the zero-gap case survives as scene-vocabulary's named
zero-gap variant fixture (A-LINK-FLIP / A-CHAIN-VIS-BUDGET), where the
L_app = 0 boundary notes below still apply verbatim.

---

### SR-1 Corner-relative station constants (review §4 bullet 1; §11 P0)

**Replaces:** 04 §3 step 1's "`corner.s0 − 24 m` to `corner.s0 + 8 m` in 2 m
steps"; 04 §4.1's "roll-on bracket `+35 … +90 m` past turn-in, `brake_gap 4 m`,
`crack_gap 8 m`". The decel bracket `2.4–3.8 m/s²` is not a station constant and
is carried (still marked re-tune-under-Tier-1R).

#### SR-1.1 The derived-station table (new 04 §4.1a)

All fractions `TUNING` with the defaults shown. `clamp(x, lo, hi)` is ordinary
clamping; every clamp that degenerates a bracket is a typed error (SR-1.3), never
a silent rail.

| Quantity | Formula | Defaults |
|---|---|---|
| turn-in sweep lower | `s0 − min(SWEEP_BACK_APP_F·L_app, SWEEP_BACK_ARC_F·L_arc)`, clamped ≥ `max(0, s1(n−1))` | `SWEEP_BACK_APP_F = 0.5`, `SWEEP_BACK_ARC_F = 0.35` |
| turn-in sweep upper | `s0 + SWEEP_FWD_F·L_arc` | `SWEEP_FWD_F = 0.25` |
| sweep candidates | `N_SWEEP` evenly spaced over the sweep span; spacing floored at `SWEEP_STEP_MIN_M` (drop candidates, keep span) | `N_SWEEP = 12`, `SWEEP_STEP_MIN_M = 0.5 m` |
| brake_gap | `clamp(BRAKE_GAP_F·L_app, BRAKE_GAP_MIN_M, BRAKE_GAP_MAX_M)` | `0.25 / 1.0 m / 6.0 m` |
| brake onset | earliest available station (road start, or previous corner's exit + `BRAKE_RUN_MIN_M` when `gap` permits — see SR-1.4) | `BRAKE_RUN_MIN_M = 2.0 m` |
| decel bracket lower (fit clip) | `max(DECEL_LO, decel_min_fit)` where `decel_min_fit = (v_entry² − v_target²) / (2·(s_ti − brake_gap − s_brake_start))` [m/s²] | `DECEL_LO = 2.4`, `DECEL_HI = 3.8` (carried) |
| crack_gap | `clamp(CRACK_GAP_F·L_arc, CRACK_GAP_MIN_M, CRACK_GAP_MAX_M)` | `0.25 / 2.0 m / 8.0 m` |
| roll-on bracket (exit-bisection domain) | `[ max(s_crack + 1.0 m, s_ti + ROLLON_LO_F·L_arc), min(s_ti + ROLLON_HI_F·L_arc, s1) ]` | `ROLLON_LO_F = 0.20`, `ROLLON_HI_F = 0.95` |

`s_ti` is the candidate turn-in station under test; `s_crack = s_ti + crack_gap`.
The feasibility probe (04 §4.2 step 1) keeps "nominal decel, mid-bracket roll-on",
now over the derived bracket. Coarse-sweep resolution (`ds_m = 1.0`) is a
resolution, not a station, and is unchanged.

Rationale for the reference lengths: backward turn-in candidates live on the
approach (fraction of `L_app`, capped by a fraction of `L_arc` so a 200 m approach
does not produce a 100 m sweep); forward candidates and all throttle stations live
in the arc (fractions of `L_arc`). The carried absolute values are recovered at
R60 scale (24 m ≈ 0.26·94 m arc; +35…+90 ≈ 0.37–0.96·arc), so this is a
re-parameterisation of the same tuning, not a new tuning.

#### SR-1.2 The arithmetic fits the presets (normative worked table)

book90, entry 34 km/h (9.44 m/s), solved turn-in speed ≈ 7.95 m/s (lean
`0.70 × 40.36° = 28.25°` at R12):

| Quantity | Value | In-road? |
|---|---|---|
| sweep | `[12 − min(6.0, 6.6), 12 + 4.71] = [6.0, 16.71]`, 12 candidates ≈ 0.97 m apart | ✓ (road 0–46.85; old spec started at −12) |
| brake_gap | `clamp(3.0, 1, 6) = 3.0 m`; brake run 3.4–5.4 m into `[0, s_ti − 3.0]` | ✓ |
| crack_gap | `clamp(4.71, 2, 8) = 4.71 m` | ✓ |
| roll-on bracket (s_ti = 13) | `[max(18.7, 16.77), min(30.9, 30.85)] = [18.7, 30.85]`, width 12.1 m | ✓ (old +35…+90 → [48, 103], entirely off-road) |

C30, entry 70 km/h (19.44 m/s), turn-in speed ≈ 12.58 m/s:

| Quantity | Value | In-road? |
|---|---|---|
| sweep | `[35 − min(17.5, 16.5), 35 + 11.78] = [18.5, 46.78]` | ✓ |
| brake_gap | `clamp(8.75, 1, 6) = 6.0 m`; brake run 28.9–45.8 m; fit clip raises the decel bracket to `[3.67, 3.8]` (s_ti = 36) — narrow but valid; bisection proceeds | ✓ |
| roll-on bracket (s_ti = 36) | `[max(45.0, 45.4), min(80.8, 82.12)] = [45.4, 80.8]` | ✓ (old upper bound +90 → 126 > 107.12) |

bookEsses interior corner c2 (gap 0, s_ti ≈ 23.7): sweep `[23.71, 27.64]` (the
backward term vanishes with `L_app = 0` — turn-in candidates start at the
hand-flip boundary, which is geometrically correct for esses); roll-on bracket
`[28.9, 38.9]`. Everything lands inside c2's own span.

#### SR-1.3 The typed refusal: `road_too_short`

After clamping, each derived quantity is checked:

- sweep span < `SWEEP_SPAN_MIN_M = 2.0 m` (TUNING), or
- roll-on bracket width < `BRACKET_MIN_M = 1.0 m` (TUNING), or
- `decel_min_fit > DECEL_HI` (the entry speed cannot be shed in the available
  approach at the bracket's hardest decel).

Any of these → `NO_SOLUTION` with `detail.sub_reason = "road_too_short"`,
`detail.quantity ∈ {"turn_in_sweep", "roll_on_bracket", "brake_run"}`,
`detail.corner_id`, `detail.required_m`, `detail.available_m`. The scenario
itself remains schema-valid (an explicit plan may still ride the road); only the
solver refuses, and the refusal names the arithmetic. This is the D8-honest form
of the old silent bracket overrun.

#### SR-1.4 Chained corners inherit the same table

`chainedSolve` computes the table per corner with `L_app(n) = gap(n−1)`. When
`gap < brake_gap(n) + BRAKE_RUN_MIN_M`, corner n gets **no per-corner brake
action**: speed for the whole linked group is set by the single chain-entry brake,
which is what the ascending gentlest-decel scan (04 §5, carried) scans. Interior
braking is generated only where the gap affords it. This replaces guesswork about
whether chains "inherit" the single-corner constants (the review's verifier
correctly noted the docs never said either way — now they say).

For a linked interior corner the exit bisection's target is no longer
`exit_target = 0.85` but the next corner's doctrinal entry, expressed in corner
n's own hand-resolved `f` frame:

```
exit_f_target(n) = LINKED_EXIT_F_OPP  = 0.15   if hand(n+1) ≠ hand(n)   (TUNING)
                 = LINKED_EXIT_F_SAME = 0.90   if hand(n+1) = hand(n)   (TUNING)
```

(Kissing a left-hander's inside late *is* the following right-hander's wide entry
— "sacrificing each open exit to set up the next turn-in" made mechanical.)
Per-corner candidate evaluation always re-integrates the plan-so-far from road
start at coarse resolution (no state stitching, determinism preserved); the final
chain re-verifies once at full resolution.

**Placement:** new 04 §4.1a (table + refusal), rewritten sentences in 04 §3 and
§4.1; SR-1.4 lands in 04 §5. **Dependency:** turn-in lifetime and signed/
per-corner-inferred steering targets are owned by the lean-unwind fix (review
§2.1); this section assumes that mechanism exists and adds nothing to it.

---

### SR-2 Corner-type-aware apex targeting (review §4 bullet 2)

**Replaces:** 04 §3 step 2's "`target_apex_pct = 58`, TUNING" and step 1's fixed
plausible band "`20 < apex_pct < 90`".

#### SR-2.1 Detection predicate

`compose` stamps each corner record with `type`:

```
type = "decreasing" if segment is taper and r1/r2 ≥ TAPER_RATIO_MIN
     = "increasing" if segment is taper and r2/r1 ≥ TAPER_RATIO_MIN
     = "constant"   otherwise (arcs, and tapers below the ratio, with r = (r1+r2)/2)

TAPER_RATIO_MIN = 1.15   (TUNING)
```

A road property, not a solver guess: every line on the road grades against the
same corner type (verdict stays a property of the trajectory).

#### SR-2.2 The target table (new, TUNING)

| `type` | `target_apex_pct` | plausible band (coarse filter) | note |
|---|---|---|---|
| `constant` | 58 (carried) | 20–90 (carried) | late bar 50 % |
| `decreasing` | 70 | 62–92 | doctrine bar is > 60 % (01 §5); target sits past the bar with margin, so ranking and check agree instead of fighting |
| `increasing` | 40 | 15–85 | `late_apex` reads `na` here (01 §5); the target only orders candidates |

`suggestTurnIn` ranks by `|apex_pct − target_apex_pct(type)|`; the coarse filter
uses the per-type band. On `bookDecreasing` the ranking now prefers candidates
that pass the applicable check, and a genuine failure blames the road/speed, not
the mis-aimed target — closing the "spurious non-clean band" mode.

#### SR-2.3 Which radius the super-tight refusal tests on a taper

**Replaces** 02 §7's "(sweep ≥ 170° **and** r ≤ 15 m)" for taper corners, which
is undecidable as written (which r?). New predicate, applied at validation:

> A corner is refused `OUT_OF_SCOPE` (`super_tight_geometry`) iff the swept angle
> accumulated over the stations where the local radius `r(s) ≤ R_UTURN_MAX = 15 m`
> is ≥ `SWEEP_UTURN_MIN = 170°`.

For constant arcs this reduces exactly to the carried rule. Worked values:
`bookDecreasing` (`R 16>9 ^130`) spends 111.4° at r ≤ 15 → in scope (unchanged).
A faithful fig 8.4 teardrop `R 30>9 ^210` spends 60.0° at r ≤ 15 → **in scope**:
the refusal now measures actual U-turn-regime content instead of headline
numbers, and the book's teardrop becomes authorable without weakening the
U-turn cut (a true `R 10 ^180` hairpin still refuses). The refusal's typed error
carries `detail: {sweep_below_r_max_deg, r_uturn_max_m}` so the boundary is
legible.

**Placement:** SR-2.1/2.2 in 04 §3 (with the detection predicate cross-referenced
to 03 §2's corner record); SR-2.3 amends 02 §7's refusal sentence and 03's
validation — shared surface with the physics cluster, flagged in §SR-10.

---

### SR-3 `solveDoubleApex`, in full (review §4 bullet 3)

**Replaces:** the single parenthetical in 04 §4.4. Lands as new 04 §4.6. The
verdict/colour treatment and the two-apex *recording shape* are owned by the
misjudgment cluster; SR-3.6 states exactly what this solver emits to them.

#### SR-3.1 Parameter surface

```
solveDoubleApex({ road, entry_kmh, profile?, mu?, constraints?, vis?,
                  corner?: "<id>" | "<id>..<id>" })        // span of 1..2+ consecutive corners
```

Scene/CLI spellings: `style=double_apex [corner=c1 | corner=c1..c2]`;
`--style double_apex [--corner c1..c2]`. The `..` span token is new grammar
(shared surface, §SR-10). No other author-facing parameters: the two turn-ins,
both touches, the mid-drift — all emergent. Internal constants are TUNING
(SR-3.3).

#### SR-3.2 Corner targeting (resolving the 04 §7 vs 08 recipe (d) contradiction)

The solver operates on a **compound corner window**: either one corner (`corner=
c1` — two touches inside a single long arc) or a maximal run of *same-hand*
consecutive corners with `linked_next = true` (SR-6.1's predicate) treated as one
corner (`corner=c1..c2` — the two-arc horseshoe composition). When `corner` is
omitted, the solver picks the qualifying window with the largest total sweep;
qualification = total sweep ≥ `DA_SWEEP_MIN_DEG = 120°` (TUNING). No qualifying
window → `NO_SOLUTION`, `sub_reason = "no_double_apex_geometry"`. Window bounds:
`s0 = s0(first)`, `s1 = s1(last)`, `L_arc = s1 − s0`, sweep = summed sweeps;
`pct` below means percent of cumulative swept angle across the window.

#### SR-3.3 Search (two-turn-in placement strategy)

Fixed-plan search, carried style (coarse→fine, ascending gentlest decel):

1. **Outer:** ascending decel scan over the (fit-clipped, SR-1.1) decel bracket,
   `N_DA_DECEL = 4` evenly spaced values, gentlest first.
2. **Placement grid (coarse ds):** turn-in 1 ∈ 5 candidates over the SR-1.1 sweep
   (computed for the compound window); turn-in 2 ∈ 5 candidates over
   `[s(pct = DA_TI2_PCT) − 0.15·L_arc, s(pct = DA_TI2_PCT) + 0.15·L_arc]`,
   `DA_TI2_PCT = 55` (TUNING). Plan per candidate: brake (SR-1.1 stations) →
   `turn_in` #1 `tangent_inside` → crack (crack_gap) → mid-drive `throttle
   accel = DA_MID_ACCEL = 1.0 m/s²` (TUNING; roll-on widening produces the
   drift back out — 02 §2's causal identity, no `position` action anywhere) →
   `turn_in` #2 `tangent_inside` → crack → exit roll-on.
3. **Filter:** contained (`f ∈ [0, 1]` over the window); exactly two touches per
   SR-3.4; touch percents inside `[DA_APEX1_PCT ± 15]` and `[DA_APEX2_PCT ± 12]`
   (`DA_APEX1_PCT = 25`, `DA_APEX2_PCT = 80`, both TUNING); constraints (04 §4.5)
   joined as always.
4. **Rank:** `max(|pct₁ − DA_APEX1_PCT|, |pct₂ − DA_APEX2_PCT|)`, ascending.
5. **Fine:** top `N_DA_FINE = 3` re-solved at full resolution — exit roll-on
   bisected against `exit_target = 0.85` (carried) — then self-verified; the
   first that passes SR-3.5 is returned verbatim. Coarse/fine disagreement is a
   typed error (carried discipline).

#### SR-3.4 "Touch", defined (the acceptance predicate's core)

A **touch** is a local minimum of the resampled lane-fraction series `f(s)` over
the window with:

- **depth** `f_min ≤ DA_TOUCH_F_MAX = 0.25` (TUNING) — it approaches the inside,
- **prominence**: the maximum `f` between two consecutive touches exceeds the
  larger of their minima by ≥ `DA_PROMINENCE_F = 0.25` (TUNING) — the line
  genuinely drifts back out between touches (01 §5's requirement),
- **separation**: consecutive touch stations ≥ `DA_TOUCH_SEP_PCT = 25` (TUNING)
  percent of window sweep apart,
- minima with prominence < 0.05 are noise-ignored.

"Two distinct apex touches" = exactly two touches under this predicate. Three or
more = faceting territory → candidate rejected (distinct from `fifty_pence` by
construction, as 01 §5 demands). This predicate **is** the "two distinct
lane-fraction minima" acceptance criterion 01 §5 deferred to implementation.

#### SR-3.5 Acceptance and NO_SOLUTION conditions

Accepted iff the self-verified run is contained, shows exactly two touches,
satisfies all constraints, and passes the applicable doctrine set (which checks
are `na` for a double-apex line is the misjudgment cluster's call). Typed
failures (`NO_SOLUTION`, closed sub-reasons):

| `sub_reason` | Condition | `detail` payload |
|---|---|---|
| `no_double_apex_geometry` | no qualifying window (SR-3.2) | best window's sweep, required sweep |
| `no_two_touch_line` | scan exhausted with no contained two-touch candidate — the corner does not reward two touches at this entry (the fig 8.4 taper case) | best candidate's touch count, worst `f`, its ranking metrics |
| `road_too_short` | SR-1.3, computed on the window | as SR-1.3 |
| `constraint_unmet` | carried, 04 §4.5 | carried |

The scan **always retains its best failing candidate** (ordering:
contained-two-touch > contained-one-touch > lowest max-`f`; ties by SR-3.3 rank)
so the misjudgment cluster's `accept: "best_failing"` mechanism (review §8.1) can
return that candidate as a normal self-verified LineResult with its non-clean
verdict verbatim instead of the refusal. Default remains `accept: "clean"`; this
solver defines *what* the best failing candidate is, that cluster defines the
accept surface and its verdict/colour law.

#### SR-3.6 Interface to the misjudgment cluster (what the solver emits)

- `LineResult.source.solveSpec` records `style: "double_apex"`, the resolved
  window (`corner_ids`, `s0`, `s1`), and `accept`.
- The solver hands the verdict layer a **touch list**:
  `corners[].apexes[]: [{s, pct, f, clearance_m, v_kmh, lean_deg}]` — the merged recorded shape; misjudgment's hysteresis rule is the recorder (two entries on success; the best
  failing candidate's actual list under `best_failing`). The verdict's recording
  shape for two apexes — and whether the singular `apex_s`/`apex_pct` fields
  alias touch 1, touch 2, or go `null` on multi-touch corners — is that
  cluster's decision; this spec requires only that **both touches be recordable
  and neither be silently dropped** (D8 in spirit: measured ⇒ recorded).

#### SR-3.7 Agent recipe (new 04 §8 R7)

`preset bookDoubleApex` → `solve({road, entry_kmh, style: "double_apex"})` →
green two-touch line, verdict carrying both touches → companion red line via the
misjudgment cluster's believed-road / `accept=best_failing` door → two-line
figure = fig 8.5. Requires: a `bookDoubleApex` preset in 03 §3.1 (the only Ch-8
archetype without one — proposal, geometry TUNING:
`lane 3.5 | S 10 | L 13 ^75 | S 6 | L 13 ^75 | S 12`, suggested entry 30 km/h;
same-hand corners, gap 6 m < min arc → linked → qualifies as one compound
window). Preset ownership: roads cluster (§SR-10). CLI spelling `--style` +
recipe: agent-interface cluster.

---

### SR-4 Chained-mistake seeding, in full (review §4 bullet 4)

**Replaces:** the one sentence at the end of 04 §5 ("Chained mistakes … reuse
this machinery"). Lands as new 04 §5.1. 03 §7.2's deferral now has a target.

#### SR-4.1 The compile loop

`compileMistake(kind, params, ctx)` with `scope` covering corners `c₁ … c_N`
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
3. **Lean derivation via engine probes.** Where the kind commits an explicit lean
   (`premature`'s "largest inside-kissing lean") it is derived against the
   *mistaken* arriving state: bisect lean over `(0, phiReserve]` with at most
   `N_PROBE = 8` (TUNING) forward engine shots from the perturbed turn-in; each
   probe holds the candidate lean through the corner and measures `min f`; the
   committed lean is the one with `min f ∈ [0, KISS_TOL_F = 0.05]` (TUNING).
   Monotone in lean (more lean → deeper inside), so bisection is sound. If even
   `phiReserve` cannot reach the inside, commit `phiReserve` (the rider leans
   all they dare — the honest reading of a committed early apex). **Boundary
   rule, stated normatively: compile-time probes are bounded engine shots; the
   compiler never calls a solver.** Probe count is fixed, so compilation stays
   deterministic and hash-stable.
4. **Out-of-corridor mid-chain.** If the mistaken line is still on the
   carriageway but outside the usable corridor (`f > 1`, oncoming lane) at a
   scoped corner's perturbed station, the perturbation **still applies** (turning
   in early from the oncoming lane is precisely the fig 8.6 compounding story);
   the kiss probes measure against the usable corridor as always. If the
   trajectory has *terminated* before the station (off-road terminal per the
   run-termination fix, review §2.3; crash; stop), compilation stops there: later
   corners are unreached and unperturbed.
5. The compiled result records `applied_corners: [ids]` (in `source.mistakeSpec`'s
   resolved form) — which scoped corners actually received the perturbation — so
   a truncated chain is legible, not mysterious.

#### SR-4.2 The one-perturbation rule under N corners (normative restatement)

The rule is **one perturbation *kind* with one parameter set, applied per scoped
corner** — the shareable spec stays `{kind, params, scope}` (D6: inputs travel,
consumers recompute). The plan diff between good and mistaken lines shows exactly
one changed-or-rewritten control per applied corner, all instances sharing the
same kind and params. This is the reading 03 §7.1's per-kind "one-control
perturbation" phrase takes on a chain.

#### SR-4.3 The named chained oracle fixture

Fixture **`F-ORACLE-CHAIN`**: `preset bookEsses` → `chainedSolve` at 32 km/h →
`compileMistake("premature", {early_by_m: 4}, {scope: "all_corners"})`. Oracle
entry **`O-CHAIN-PREMATURE`** (09 §4 gains it; pins blessed, never asserted):

- final outcome class pinned by bless (expected `wide`/`runoff`);
- `applied_corners` pinned (and, if the line terminates mid-chain, the
  terminating corner pinned with it);
- the compounding property: per-corner peak `f` strictly increases across
  consecutive applied corners while the line is live — "each corner wider",
  fig 8.6's device, finally a test rather than a sentence.

---

### SR-5 The vis fixpoint as a bounded, self-checked heuristic (review §4 bullet 5)

**Replaces:** 04 §6's "Mechanics" paragraph, specifically "convergence is
monotone because slowing and widening can only open the sight margin, never close
it" — false under the design's own vocabulary (outside/oncoming occluders mean
widening can shorten sight; on alternating esses, corner n+1's outside is corner
n's inside). The chained-composition paragraph keeps its V1/V2 content but
inherits the new iteration contract.

New text, mechanism form:

1. **Iteration (unchanged shape, demoted claim):** solve → read the emergent
   sight channel → regenerate V1 speed caps and V2 holds → re-solve. No
   convergence is claimed. Iterations are bounded by `vis_max_iterations = 4`
   (TUNING, carried).
2. **Acceptance is decided only by the terminal self-check.** After each
   iteration the candidate is self-verified (full engine re-run) and the mode's
   acceptance predicate is evaluated **on that run**: V1 at every station
   (`vis_margin · ssd_m ≤ sight_m`; uses the lean-aware `ssd` once the physics
   cluster lands it — dependency, §SR-10), V2's hold ahead of each blind corner
   under the carried *actual-position* rule (budget-limited holds satisfy at the
   reached `f`, never the unreached target), and all authored constraints. **The
   first iterate whose self-check passes is returned; iteration stops there.**
3. **V2's hold target is the authored `vis_hold_f`, not a computed argmax.** The
   mode encodes the inside-occluder doctrine it exists to teach; when an
   outside/oncoming occluder makes wide genuinely worse, the self-check reports
   it honestly and the author's move is `vis=none` plus constraints. 04 gains
   one disclosure sentence saying exactly that (placard policy, not cleverness).
4. **Failure surface (typed, closed):**
   - `NO_SOLUTION` / `sub_reason = "vis_unsatisfiable_within_bound"` — no
     iterate passed within the bound. `detail.iterations = [{min_margin_m,
     worst_s, hold_met}]` per iterate, so an agent can see oscillation
     (alternating margins) vs a genuine deficit (plateaued negative margin).
   - `NO_SOLUTION` / `sub_reason = "vis_speed_below_model_floor"` — V1 governs
     speed below `v_floor_ms` somewhere: the corner cannot be ridden within
     sight at this margin inside the model's validity. Honest refusal, never a
     fabricated crawl (closes the review's `stopped`-edge on
     P-VIS-MARGIN-MONOTONE).

**Requirements to the verification cluster (09 owns wording):**

- `P-SIGHT-EYE` rescoped: quantifier restricted to scenarios whose occluders are
  all `inside` relative to the corner being cast; add `P-SIGHT-PURE`
  (unrestricted purity/determinism of `sightFrom`).
- `P-VIS-MARGIN-MONOTONE` rescoped to the same inside-occluder scope, single
  corner, governed speed above `v_floor_ms`; plus an assertion that the
  below-floor case yields the typed sub-reason above.
- New `P-VIS-SELFCHECK` (unrestricted — true by construction): every line
  returned under `vis=cautious`, single or chained, satisfies the mode's
  acceptance predicate on its self-verified run. This property *replaces* the
  convergence claim as the thing verified.
- New `P-VIS-BOUNDED`: the mode performs ≤ `vis_max_iterations` solve passes and
  terminates in a passing line or a typed refusal — never an unverified line,
  never a loop.
- `A-CHAIN-VIS` restated against the actual-position hold rule (reached `f`),
  removing its contradiction with 04's budget-limited-hold carve-out.
- Engine-run accounting for `C-RECOMPUTE-BUDGET` can now be computed from
  SR-1/SR-3/SR-5 constants (per-solve run count is bounded and enumerable);
  rescoping the budget is that cluster's call.

---

### SR-6 The "contained" seam (review §4 bullet 6) — MERGED RESOLUTION: mechanism kept, vocabulary superseded by Option B

> **Merge note (binding).** The owner-level outcome decision went to
> doctrine-catalogue's Option B (`crash > runoff > wide > stopped > contained`;
> `clean` = derived predicate; `violation` retired) — the only variant under which
> `P-OUTCOME-RUBRIC-FREE` holds. SR-6.1's road-derived applicability machinery
> survives INTACT and is what makes a correct chain grade `contained` with zero
> applicable fails ⇒ quality `good` ⇒ green ⇒ `solve` exit 0. Where SR-6's prose
> below says "outcome set unchanged" or "grades clean", read: outcome `contained`,
> quality `good` (the derived clean predicate). `A-CHAIN-CLEAN` respells to
> doctrine-catalogue's `A-CHAIN-GREEN`. The no-chain-specific-exit-tier requirement
> survives unchanged.

The three irreconcilable statements: 04 §5 "**contained, not clean** … maps to
**green**"; 08 §3.1 "non-clean `solve` exits 3"; 05 §6.1's closed outcome set has
no `contained`. The task offered two fixes (add `contained` to the outcome set,
or route chains through `run`). **This spec deviates and adopts a third
mechanism, because both offered fixes treat the symptom:** the chain-aware
verdict was always reachable through machinery the design already has — check
applicability — and the review's own verifier identified it ("chain-aware checks
all pass ⇒ outcome `clean` per 02 §7"). Adding `contained` would ripple through
the outcome precedence, the colour law (whose amber *class* is already named
"contained" — a guaranteed vocabulary collision), exit codes, and every oracle
pin; routing chains through `run` would leave `solve` broken on chains and the
green claim unexplained. Both add surface; neither fixes the category error.

#### SR-6.1 Mechanism: road-derived check applicability

`compose` stamps each corner with `linked_next`:

```
linked_next(n) = gap(n) ≤ LINK_GAP_FRAC · min(L_arc(n), L_arc(n+1))
LINK_GAP_FRAC = 1.0   (TUNING)
```

A **linked interior corner** is one with `linked_next` (or whose predecessor has
it) that is not the last of its run. The doctrine catalogue (owned by the
check-catalogue cluster) must key per-corner applicability off this road
property: on linked interior corners, the open-exit checks (`out_in_out`,
exit-wide) read `na` and the chain checks (link-continuity, flow — ids theirs to
mint) apply instead. MERGED: doctrine-catalogue layers `ridden-linked` on top (peak
`−cmd_a` on the connecting span ≤ `LINK_BRAKE_RESET`, read off the line's OWN
trajectory), so the claim weakens from "same applicable set for every line" to
"same applicability RULE for every line" — the verdict remains a property
of the trajectory (01 §3 Axis B), and the mistaken chain line still fails
honestly (per-corner `late_apex`, containment) under the identical rubric.

#### SR-6.2 The reconciliation

- **04 §5 rewrite:** delete "contained, not clean". New sentence: *"A correctly
  ridden linked line is `clean` under the applicable check set: on linked
  interior corners the open-exit checks read `na` and the chain checks apply.
  Under colour law v2 it is green because it is clean — no carve-out, no new
  vocabulary."*
- **05 §6.1:** SUPERSEDED by Option B — the closed set is `crash|runoff|wide|
  stopped|contained`; a contained line failing an *applicable* check is
  `contained` + quality `caution` (violation retired).
- **06 §5.1:** the merged quality law fires green because outcome = `contained`
  with no failed applicable checks (the derived clean predicate).
- **08 §3.1:** merged five-tier table (agent-interface owns). Requirement to the agent-interface
  cluster: do **not** add a chain-specific exit tier; a correctly ridden chain
  now exits 0 from `solve` because it is clean, a chain failing an applicable
  check exits 3 exactly like a single corner. Recipe (d)'s use of `run` becomes
  a stylistic choice, not a workaround.
- **Invocation seam (same predicate, for free):** `solve`/`ride` on a
  multi-corner road chains **by default across each linked run of corners**
  (matching 08 recipe (d)'s observed behaviour); `corner=<id>` restricts to one
  corner; unlinked corners on one road solve independently in sequence. This
  replaces 04 §7's "`corner=<id>` (default first)" and closes "chainedSolve is
  uninvocable from scene text" with zero new grammar.

---

### SR-7 Contract impact (exact shapes)

**RoadModel corner record (03 §2) gains** (shared surface):
`{ …, type: "constant"|"decreasing"|"increasing", r1?, r2?, gap_to_next_m,
linked_next: boolean }` — all computed at `compose`, deterministic.

**`NO_SOLUTION` sub-reason registry (new 04 table; closed set, extension is a
design change).** Existing prose reasons get names; new ones join them:

```
sub_reason ∈  turn_in_infeasible_early | turn_in_infeasible_late    (04 §4.2 probe)
            | empty_band | non_clean_band | coarse_fine_disagreement (04 §3)
            | constraint_unmet                                       (04 §4.5, carried)
            | road_too_short                                         (SR-1.3)
            | no_double_apex_geometry | no_two_touch_line            (SR-3.5)
            | vis_unsatisfiable_within_bound | vis_speed_below_model_floor (SR-5)
```

Wire shape: the error object gains a structured member —
`{code: "NO_SOLUTION", at, message, detail: {sub_reason, …per-reason fields}}`.
This extends 08 §3.2's error shape (currently `{code, at, message, schema_ref?}`)
with an optional `detail` object; **shared surface with the agent-interface
cluster**, who own the error envelope.

**LineResult.source.solveSpec gains:** `style: "single"|"double_apex"|"geometric"`
(recorded, closed), resolved window for double-apex, `accept` (misjudgment
cluster's field — hook only). **Resolved mistakeSpec gains:** `applied_corners`.
**Verdict corners entries should gain** `corner_type` (mirror of SR-2.1) —
recommended to the 05 owner; the two-apex recording is the misjudgment
cluster's `corners[].apexes[]` shape per SR-3.6 (`touches` is retired as a
verdict token; SR-3.4's predicate survives ONLY as the double-apex solver's
internal candidate-acceptance filter, evaluated over the recorded apex list —
an accepted two-touch candidate always records exactly two apexes).

Changed by the merge (not by this section): the outcome set and precedence
(Option B), the quality words (`good|caution|failing`), the exit table (08
§3.1 merged five tiers). Unchanged: the Sample contract, the plan-action
vocabulary.

---

### SR-8 Acceptance (what 09 gains — requirements; the verification cluster owns wording)

1. **`A-SOLVER-FIT`** — for every preset in 03 §3.1 (plus `bookDoubleApex`), at
   the suggested entry speed: every SR-1.1 derived station lies within
   `[0, road_end]`, both brackets are non-degenerate *before* search, and the
   solve returns a line or a typed sub-reason — never a rail caused by an
   off-road bracket. (Pins SR-1.2's table mechanically.)
2. **`book90-ideal` golden** — solved turn-in station, `apex_pct`, roll-on onset
   on the fig 8.1–8.3 preset (currently only C30 has goldens; the preset the six
   figures stand on gets its own).
3. **`P-APEX-TARGET-TYPED`** — on `bookDecreasing`, the returned line's
   `apex_pct` exceeds the DR late bar; the ranking never prefers a candidate
   failing the applicable late-apex check (property over fuzzed taper roads).
4. **`A-DOUBLEAPEX` golden** — `bookDoubleApex` solved with `style=double_apex`:
   exactly two SR-3.4 touches, pinned touch stations/percents/f; and on
   `bookDecreasing` the same call yields `NO_SOLUTION` `no_two_touch_line`
   (the fig 8.4 refusal, pinned as a *test*, with the best-failing candidate
   retained for the misjudgment cluster's accept path).
5. **`O-CHAIN-PREMATURE`** on fixture `F-ORACLE-CHAIN` (SR-4.3) — the chained
   oracle entry, including the per-corner monotone-widening property.
6. **`A-CHAIN-GREEN`** (respelled from A-CHAIN-CLEAN; doctrine-catalogue's
   surviving name) — `chainedSolve` on `bookEsses` (no mistake): outcome
   `contained`, zero applicable fails (the derived clean predicate), open-exit
   checks `na` on interior corners, chain checks `pass`, quality `good`, colour
   green, `solve` exit 0 (pins SR-6 end-to-end across 04/05/06/08).
7. The SR-5 property set: rescoped `P-SIGHT-EYE`, `P-SIGHT-PURE`, rescoped
   `P-VIS-MARGIN-MONOTONE`, new `P-VIS-SELFCHECK`, `P-VIS-BOUNDED`, restated
   `A-CHAIN-VIS`.
8. **D8 effectuality rows** for every new author-visible token: `style=`,
   `corner=<id>..<id>`, per SR-7's registry each sub-reason must be reachable by
   a committed fixture (no dead error names).

---

### SR-9 Decision drafts (editor numbers them)

1. **Corner-relative solver stations.** Every solver station constant is a
   fraction of per-corner reference lengths (`L_app`, `L_arc`, `L_exit`), clamped
   with the typed `road_too_short` refusal. Rationale: the carried absolute
   metres encoded the dead R60 world and provably emptied the search domain on
   the presets behind figs 8.1–8.3; fractions preserve the carried tuning at R60
   scale while fitting book-scale roads, and the refusal converts silent bracket
   overrun into a D8-honest error.
2. **Chains grade green via road-derived check applicability.** [Draft merged
   into the Option B outcome decision: the applicability mechanism is the
   surviving content — a correctly ridden linked line grades outcome
   `contained` with zero applicable fails (the derived clean predicate), hence
   quality `good`/green, and `solve` exits 0; the draft's "no contained
   outcome" vocabulary position was superseded. The vocabulary-collision
   concern it raised was honoured by renaming the quality tier word to
   `caution`.]
3. **The super-tight refusal measures U-turn-regime sweep content.** A corner is
   refused iff ≥ 170° of sweep is accumulated at local radius ≤ 15 m. Rationale:
   the carried predicate was undecidable on tapers; the new one reduces to it on
   constant arcs, keeps true hairpin/U-turn geometry refused, and makes the
   book's fig 8.4 teardrop authorable.
4. **The visibility mode is a bounded heuristic verified by self-check.** The
   monotone-convergence claim is withdrawn (false under outside/oncoming
   occluders and alternating esses); acceptance is decided solely by the
   terminal self-check, with two typed refusal sub-reasons. What is verified is
   the output (`P-VIS-SELFCHECK`), never the iteration.

### SR-10 Interfaces to parallel clusters (shared surfaces touched)

- **Agent interface (08):** exit codes now the merged five-tier table (SR-6.2's
  surviving requirement: no chain-specific tier; clean chains exit 0 from
  `solve`); error envelope gains optional `detail` with
  `sub_reason` (SR-7); CLI spellings `--style`, `--corner c1..c2`; R7/recipe
  addition; `schema solve` must print the sub-reason registry and target table.
- **Misjudgment/verdict cluster:** SR-3.5's best-failing retention +
  `accept` hook; SR-3.6 touch-list emission; double-apex `na` exemptions;
  `corner_type` in verdict corners.
- **Doctrine-catalogue cluster (review §2.4):** applicability keyed to
  `linked_next` and `corner_type`; chain check ids; the carried throttle-rule
  check ("roll-on ≤ apex + 12 m") must go corner-relative
  (`≤ apex_s + 0.15·L_arc`, TUNING) or it re-breaks on book-scale roads.
- **Physics cluster (02):** super-tight refusal predicate rewrite (SR-2.3);
  lean-aware `ssd` dependency in SR-5.2; turn-in lifetime dependency (SR-1.4).
- **Roads cluster (03):** corner-record fields (SR-7); `bookDoubleApex` preset;
  `..` span token in the corner-ref grammar.
- **Verification cluster (09):** SR-8 in full; run-count accounting for
  `C-RECOMPUTE-BUDGET`.
