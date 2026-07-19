## The Misjudgment Mechanism + Two-Strategy Figures

> **EDITORIAL RECONCILIATION (binding) — 2026-07-19 editor pass.** Merged against the
> thirteen sibling amendment sections per the three reconciliation audits. Where the
> body below disagrees with a bullet, the bullet wins.
>
> - **Corrective ridden-in requirement WITHDRAWN** (corrective-offroad's branched-
>   shadow law wins — determinism/result_hash hygiene, the one-perturbation diff
>   property, and figs 8.1–8.3's uncorrected ink are load-bearing): misjudge lines
>   draw the uncorrected consequence; fig 8.5's callouts anchor to the main-line
>   `correction` (shot-start bookmark) / `run_wide_detect` / `end` events, the save
>   is shown via the `correctiveShot` ghost (stepper-only, never exported), and the
>   8.5 ink departure is a disclosed parity note.
> - **Outcome law (Option B, doctrine-catalogue):** `violation` is retired — this
>   section's `violation` pins/cells respell to `contained` (with the failed-check
>   evidence carrying the "got away with it" story); quality words are
>   `good | caution | failing` (the amber tier word is `caution`). best_failing
>   ranking key 1 re-keys to the merged precedence: `contained`=0, `stopped`=1,
>   `wide`=2, `runoff`=3, `crash`=4 (the old clean-vs-violation distinction is
>   subsumed by key 2, failed-check count).
> - **This section WINS the verdict `corners[]` reshape** (`turn_ins[]`/`apexes[]`
>   lists; hysteresis detector `APEX_PROMINENCE_F = 0.08` / `APEX_MIN_SEP_M = 5.0` is
>   THE recorded detector) with two merges: apex element shape
>   `{s, pct, f, clearance_m, v_kmh, lean_deg}`, and corner-exit's `release_s` inside
>   each `turn_ins[]` entry `{s, lean_commit_deg, hand, release_s|null}`.
> - **Severity trio adopted** into doctrine-catalogue's pack schema (`severity ∈
>   advisory|standard|critical`; `wrong_strategy_for_corner` joins the catalogue as
>   check 16, sole v2 critical, contingent U1 = Mechanism A). The double-apex special
>   case is doctrine-catalogue's graded adjusted arithmetic (this section's blanket
>   `na` carve-out loses; the group two-touch criterion is cited by the exemption
>   table).
> - **Gate inputs:** `role` is DROPPED from the gate derivation (roles never gate,
>   D9; agent-interface's expectation law wins — best_failing and source-kind rows
>   already cover the cases).
> - **Sweep grammar (agent-interface wins):** entry speed spells
>   `scenario.entry_kmh` (respelled in place); the closed root set gains `believe.`
>   (r_believed, sweep_believed_deg; re-solve-believed-world-per-cell); the metric
>   vocabulary gains `acceptance_met`, `apex_count`, `s_divergence_m`.
> - **Recipe number:** solver-refit keeps R7 (double-apex); this section's misjudged-
>   corner recipe is **R8** (respelled below).
> - **Corner groups:** `GROUP_GAP_M` is retired — a corner group = a maximal
>   same-hand run of `linked_next` corners (solver-refit's predicate,
>   `LINK_GAP_FRAC = 1.0`), matching the double-apex compound-window rule.
> - **Scene spelling:** mistake tokens use the one composed grammar
>   `[lineId=]kind[:k=v,...][@scope]` (agent-interface); this section's scene lines
>   respell to `mistake underread:r_believed=16`.
> - **Kinds:** the mistake enum merges to `premature, premature_contained,
>   slow_steer, fifty_pence, chop, overspeed` + `underread, overread` (this
>   section's sub-family); one-perturbation merged sentence: exactly one
>   control-channel delta (engine-probed interior values) OR one belief, never both.
> - **Road-option flag spelling (agent-interface wins):** the CLI flag is
>   `--use-full-width` — mirroring the wire field `use_full_width` under the
>   08 §4.1 flag↔field bijection (A-SCHEMA-SHAPE); this section's `--full-width`
>   (its §5 spellings table and road-model interaction row) respells in place;
>   `--bike-margin` is unchanged.

Cluster anchors closed: review §8.1 (the missing misjudgment concept), §1 rows for
figs 8.4 and 8.5, §6 bullet 1 (colour law vs two-strategy figures), the
`use_full_width` gap (fig-8.4 finding [1], fig-8.5 finding [2]), and the fig 8.5
teaching-window gap (fig-8.5 finding [1]). Laws honoured throughout: D7 (the
engine produces every drawn line — in *both* worlds below), D8 (typed errors,
nothing accepted-but-ignored), D9 (colour derives from verdict), D6 (failed lines
first-class; inputs-vs-outputs provenance governs shareability).

The one-mechanism bet, stated up front: **every Chapter-8 red line the current
design cannot author is a belief error — a plan formed for the corner the rider
thought they were in, executed on the corner that exists.** One first-class
mechanism (believed-road solving) plus one solver policy (`accept=best_failing`)
subsumes the fig 8.5 red line, the blind-DR overspeed, the "plausible-but-failing
attempt" class generally, and — together with a two-apex verdict and a colour-law
severity amendment — the fig 8.4 companion.

---

### 1. Believed-road solving (first-class misjudgment)

#### 1.1 Concept and D7 statement

A line spec may declare a **believed road**: the solver solves the rider's plan
against the believed road, then the engine executes that resolved plan — verbatim,
absolute stations, committed leans — on the figure's **actual** road.

**D7 is untouched, and the statement is normative:** there is still no authored
path anywhere. The author writes the geometry of a *world*, never the geometry of
a *line*. The plan is solver-produced in the believed world; the drawn trajectory
is engine-integrated in the actual world. Both worlds' lines are engine output; a
`grep` for path/apex inputs still finds nothing. What changes is only *which road
the plan was optimal for* — which is exactly the book's psychology of error
(anxiety, misread radius, "didn't know it tightens"), previously channel-less.

#### 1.2 Grammar — two layers

**Layer 1 — the general field** (arbitrary misreads, e.g. fig 8.5's "I thought
this was an ordinary 90° corner"):

| Surface | Spelling |
|---|---|
| solve-spec JSON | `believed_road: "<road-DSL string>" \| { preset: "<name>" }` |
| scene text (ride line) | `believeRoad="lane 3.5 \| S 10 \| L 12 ^90 \| S 30"` |
| CLI | `--believe-road "<dsl \| preset name>"` |

`believed_road` is a **solve-layer** field. It never appears in the wire scenario
the engine validates and integrates — the engine sees only (actual road, resolved
plan). This keeps 03 §6's "one road + one plan" engine contract byte-identical.

**Layer 2 — sugar: the misjudgment kinds.** Two new members of the mistake-kind
closed set (00 §4, 03 §7.1), forming the **misjudgment sub-family** (the existing
six are the **execution sub-family**):

| Kind | One-belief perturbation (defaults, TUNING) | Meaning | Tier 1R outcome pin | Book mapping |
|---|---|---|---|---|
| `underread` | exactly one of `r_believed` (m) or `sweep_believed_deg`; target `of=<cornerId>` (default: the figure's teaching corner). On a **taper** corner, `r_believed` defaults to `r1` — "believed the entry radius holds" — the canonical blind-DR misread, zero params. On an **arc** corner there is no default: omitting both params is `SCHEMA` (`misjudge_param_required`). | believed the corner less demanding than it is | `wide`/`runoff` | fig 8.4's DR trap entered on a constant-radius belief; the blind-corner overspeed |
| `overread` | same param surface; believed tighter/longer than actual | believed the corner more demanding than it is | `contained` + failed checks (over-slow, over-cautious; quality `caution`) | the timid line; "expect the unexpected" ridden too literally |

Sugar compiles to Layer 1: `underread r_believed=16 of=c1` rewrites the actual
road's `c1` segment to a constant `arc r=16` (radius misread of a taper) or
rescales its `angle_deg` (sweep misread), leaving every other segment
byte-identical, and proceeds exactly as the general field. The compiled believed
road appears verbatim in provenance (disclosure, like preset expansion).

Scene/CLI spellings for sugar reuse the mistake grammar unchanged:
`bad: mistake underread r_believed=16` in scene text; `--mistake underread:r_believed=16`
on the CLI. **Compile-path difference, stated where the grammar lives:** execution
kinds perturb the base ride's *solved plan*; misjudgment kinds take the base
ride's *ride spec* (entry, profile, style, vis mode), re-solve it on the believed
road, and execute on the actual road. `explain underread` must state this.

#### 1.3 The one-perturbation rule, extended

> A compiled teaching line differs from its reference in **exactly one authored
> respect: one control (execution sub-family) or one belief (misjudgment
> sub-family).** Never both.

- One belief = one geometric parameter of one corner (sugar kinds), or one
  wholesale believed road (general field — the escape hatch for compound
  misreads like fig 8.5, where the single belief "this is a simple 90° corner"
  is not a single-parameter delta; the disclosure is the full believed DSL in
  provenance).
- A line spec carrying both a misjudgment (either layer) and an execution
  mistake kind is rejected `SCHEMA` (`misjudge_with_execution_mistake`).
- The diff property carried from the execution family holds in belief space: the
  believed and actual roads diff in exactly the declared respect (sugar), and
  the executed plan is *byte-identical* to the believed-world plan — the entire
  delta between the misjudged line and the reference line is the world, never
  the inputs.

#### 1.4 Validation rules (typed; all at `validate`/solve entry)

| Rule | Error |
|---|---|
| believed road identical to actual (segment-list equality after normalization) | `INEFFECTUAL` / `believed_road_identical` (D8: a belief that changes nothing does nothing) |
| `lane_width_m`, `bike_margin_m`, `use_full_width` differ between worlds | `SCHEMA` / `believed_lane_geometry_differs` (v1: the rider misjudges curvature, not lane width) |
| the first divergent corner's hand differs | `OUT_OF_SCOPE` / `believed_hand_differs` (wrong-hand belief is a real error but has no Ch-8 figure and no teaching structure at Tier 1R; typed so the cut is explicit and liftable) |
| divergence station `s_div = 0` (worlds differ from the start) | `SCHEMA` / `believed_no_shared_prefix` (the plan's stations must mean the same asphalt in both worlds up to the misread) |
| believed-world solve does not verify clean | `NO_SOLUTION` / `believed_world_not_clean` (see §1.5 — the misjudgment story requires a sound plan in the believed world; a bad plan in a wrong world is two perturbations) |
| `accept=best_failing` combined with a believed road | `SCHEMA` / `accept_policy_incompatible_with_misjudge` (it would relax the believed-world clean bar, forbidden by the row above) |
| an occluder/hazard placement that cannot re-resolve on the believed road (the believed-world solve needs them: `vis=` reads occluders, hazard μ shapes the plan) | `BAD_RANGE` / `believed_placement_unresolvable` (fix: use absolute `at_s` placement; the believed world must be fully well-formed, never partially inherited) |

Believed-road length may differ freely from the actual road: execution and
termination happen entirely on the actual road; plan actions whose stations the
actual run never reaches simply never fire (they are not dead input — they were
effectual in the believed world, which is recorded; this is the one place D8's
"provably reaches the controller" is evaluated against the *believed* run).

**`s_div` — the divergence station, computed exactly** (no epsilon, no sampling):
walk both segment lists pairwise, accumulating length while segments are
identical (type + all params).At the first differing pair: if both are arcs with
equal `r` and `hand` but different `angle_deg`, `s_div` = boundary + arc length
of the smaller sweep; if both are straights of different `len`, `s_div` =
boundary + the smaller `len`; otherwise `s_div` = the boundary station.
Deterministic, unit-testable, and it lands mid-corner where the misread
geometrically bites (fig 8.5: `s_div = 10 + 12·(70°) = 24.66 m`, not the segment
boundary at 10 m).

#### 1.5 Execution semantics (normative pipeline)

1. **Solve in the believed world.** The full ride spec — entry, `turnIn=auto`,
   `style=`, `vis=`, constraints — is solved on the believed road by the
   ordinary pipeline (04 §3–§6), including mandatory self-verification **on the
   believed road**. The believed-world result must be clean (else
   `believed_world_not_clean`); the rider solved the corner they thought they
   were in, correctly.
2. **Literalize the plan.** Every deferred target is replaced by the value the
   believed-world run realized: `tangent_inside` becomes the explicit committed
   `lean_deg` at the believed run's `steering_complete`; all anchors are already
   absolute `at_s` per 03 §6.1; `position` targets stay in `f`, which means the
   same thing in both worlds because lane-geometry equality is validated (§1.4).
   The rule stated generally: **every road-derived quantity in the plan is
   frozen from the believed world.** The literalized plan carries no reference
   to either road. (Without literalization, `tangent_inside` would re-derive
   against actual geometry and erase the misjudgment.)
3. **Execute on the actual road.** The literalized plan runs through the
   unmodified engine on the figure's road — same profile, same integrator, same
   corrective-shot machinery (02/04's §2.2-fix spec applies with **no
   special-casing**: when the divergence manifests as running wide,
   `run_wide_detect` fires and the fixed-policy corrective SHADOW is evaluated,
   with the `correction` shot-start bookmark on the main line).
   **[WITHDRAWN by the merge]** The draft requirement that the corrective be
   ridden into the shipped trajectory is withdrawn — corrective-offroad's
   branched-shadow law wins. The drawn misjudge line is the uncorrected
   consequence; "yikes! braking *and* increasing lean" anchors on the main-line
   `correction`/`run_wide_detect` bookmarks and `end@late`; the save is
   inspectable as the `correctiveShot` ghost (stepper-only, never exported);
   the fig 8.5 ink departure is recorded as a disclosed parity note.
4. **Grade normally.** The line's trajectory, events, verdict, colour are those
   of the actual-road run, computed by the unmodified analyzers. No misjudgment
   discount, no special colour path.

#### 1.6 Provenance (contract impact)

**`LineResult.source` gains a fourth kind** (05 §7):

```
| { kind: "misjudge",
    solve: solveSpec,                       // the ride spec, as solved in the believed world
    believed_road: <dsl-string | {preset}>, // Layer 1 value, or the sugar's compiled expansion
    sugar: null | { kind: "underread"|"overread", params, corner_id } }
```

All members are inputs — the FigureSpec shares them verbatim and every consumer
recomputes both stages (re-solve believed, re-execute actual). D6's honesty
property covers both worlds: no trajectory from either ever rides the wire.

**The verdict gains a `misjudgment` block** (05 §6.3; `null` for all other
lines):

```
misjudgment: null | {
  believed_road_hash,                  // fnv-1a/6-hex over the canonical believed roadSpec
  s_divergence_m,                      // exact, per §1.4's segment-walk rule
  divergence: { kind: "radius" | "sweep" | "structure",
                corner_id | null,      // sugar kinds name the corner; general field: null + "structure"
                believed | null, actual | null },   // numbers for sugar kinds (m or deg)
  kappa_gap: { max_abs_1pm, at_s },    // max |κ_actual(s) − κ_believed(s)| (centreline curvatures)
                                       // over [s_divergence_m, min(len_actual, len_believed)] —
                                       // the quantitative "how wrong was the belief", defined for
                                       // ANY belief incl. the general field's "structure" kind
  believed: { outcome: "clean", spec_hash, result_hash },  // believed-world self-verify summary
  actions_unreached: [action_id, …]    // literalized plan actions whose station the actual run
                                       // never reached (road ended / line departed first) — the
                                       // "roll-on planned for road that wasn't there" evidence
}
```

The believed-world run is **not** a line in the figure (it lives on a different
road; "one road per figure" is untouched) — its identity travels as the two
hashes, and an author who wants it drawn makes a second figure from the same
`solve` spec on the believed road. The block is inside `result_hash` (it is
deterministic provenance, not diagnosis).

`diagnosis.cause` stays **physical** (`stand_up`, `grip_exceeded`, `plan_gap`,
…): the proximate mechanism is whatever the engine found; the misjudgment block
carries the intent-level explanation. Requirement on the agent-interface
cluster: `explain` composes them ("plan solved for r=16 m; road tightens to 9 m
at s=24.7; stood up under braking at s=31.2 → ran off at s=41.0"). The
literalized executed plan must appear in the envelope's `resolved_scenario`
member (that member is the agent-interface cluster's P2 fix; misjudge lines are
an acceptance case for it).

#### 1.7 Colour and outcome behaviour

By design these lines usually grade `wide`/`runoff` → red: **that is the point.**
No new colour machinery: D9 applies verbatim (colour from the actual-road
verdict). An `underread` small enough to be absorbed by street reserve grades
`contained` with failed checks → quality `caution`/amber — honestly, "you got
away with it" (the legend-wording fix for amber's two meanings belongs to the
pedagogy cluster; the misjudgment block gives that legend its data). `overread`
lines are the contained/timid amber teaching object for free.

---

### 2. `accept=best_failing` — return the best self-verified failure

#### 2.1 Field and spellings

Solve-spec field `accept` ∈ `"clean"` (default) | `"best_failing"`. Scene:
`accept=best_failing` on `ride` lines. CLI: `--accept best_failing`. Closed enum;
anything else `SCHEMA`. (If the solver-refit cluster lands `contained` as an
outcome/acceptance tier, it slots into this enum and the §2.2 ranking without
change to this spec's structure.)

#### 2.2 Semantics

Under `accept=clean` nothing changes: the pipeline behaves per 04 §4.2, including
its existing "non-clean self-verification is reported as such" seam — which §2.3
makes explicit in the contract rather than prose.

Under `accept=best_failing`, the solver's *refusal* paths become best-effort
returns:

1. The feasibility probe (04 §4.2 step 1) no longer short-circuits the solve; an
   infeasible placement's candidates stay in the pool.
2. The candidate pool is every **full-resolution, self-verified** final plan the
   pipeline produced; the pipeline must full-solve at least
   `BEST_FAILING_MIN_CANDIDATES = 4` (TUNING) turn-in candidates even when the
   coarse sweep's contained band is empty (take the 4 nearest-to-contained by
   corridor excess). A candidate whose self-verify re-run disagrees with its
   search-time outcome (coarse/fine disagreement) is **discarded**, never ranked.
3. Candidates violating any **authored constraint** (04 §4.5) are discarded
   before ranking: D10 bounds stay hard under every accept policy — the author
   said "never there", and best_failing relaxes the doctrine bar, not authored
   bounds. All candidates constraint-violating → `NO_SOLUTION`/`constraint_unmet`
   exactly as today.
4. **Ranking** — ordered tuple, lexicographic, lower wins:
   1. outcome severity per the merged 05 §6.1 precedence (Option B):
      `contained`=0, `stopped`=1, `wide`=2, `runoff`=3, `crash`=4 (the old
      clean-vs-violation distinction is subsumed by key 2);
   2. count of doctrine checks with verdict `fail` (`warn`/`na` excluded);
   3. corridor excess: `max over samples of max(0, distance beyond the usable
      corridor edge)` in metres (0 for contained lines);
   4. doctrinal apex distance `|apex_pct_final − target_apex_pct|` (final apex;
      corner-type-aware target per the solver-refit cluster);
   5. earlier turn-in station (deterministic final tie-break — hash stability).
5. The winner is returned with its own **verbatim** verdict. Empty pool →
   `NO_SOLUTION` / `no_rankable_candidate`. best_failing never fabricates and
   never returns an un-self-verified line.

**Property (pinned in 09):** if `accept=clean` would have succeeded,
`accept=best_failing` returns the byte-identical line — the policy only matters
when the clean bar is unreachable.

#### 2.3 Provenance — never silent (contract impact)

**The verdict gains an `acceptance` block** (05 §6.3, always present):

```
acceptance: { policy: "clean" | "best_failing",
              met: boolean }        // true iff the returned line meets the clean bar
                                    // (outcome clean, no failed checks, constraints satisfied)
```

This one field also formalizes the pre-existing 04 §4.2 seam: a policy-`clean`
solve that reports a non-clean self-verification carries
`{policy:"clean", met:false}`. A best_failing return that happens to be clean
carries `{policy:"best_failing", met:true}`. Grading is policy-independent —
the accept policy changes what is *returned*, never how it is *graded* or
coloured (D9).

#### 2.4 Guardrails and cross-cluster requirements

- `accept` on a `mistake`-kind line: `INEFFECTUAL` / `accept_on_mistake_line`
  (mistake lines forward-run a perturbed plan; nothing is being accepted).
- `accept=best_failing` with `believed_road`: `SCHEMA` (§1.4).
- **Requirement on the agent-interface cluster (owns exit codes):** a solve
  returning a ranked line under `policy=best_failing` must exit 0 (non-clean is
  the *requested* result); `--gate` and `expect_fail` wiring must key off
  `acceptance.met` + policy (role DROPPED per the merge — roles never gate, D9;
  agent-interface's expectation rows cover the cases) so intended-fail figures
  gate correctly.
- **Requirement on the solver-refit cluster (owns `solveDoubleApex` +
  `contained`):** solveDoubleApex must emit full-resolution self-verified
  candidates so `accept` composes with `style=double_apex`; its typed refusals
  become rankable pools under best_failing; `contained` (when landed) takes
  severity slot 1 above.

---

### 3. The fig 8.4 decision — two complete mechanisms

**The caption, verbatim (book_text/parts/part0014, Figure 8.4):**

> "The dreaded decreasing radius turn can bite even an experienced rider if he
> didn't have plenty of lean angle in reserve. With a delayed entry, it can be
> safely completed with only one turning point. In the case of blind corners, if
> you don't know if it is a decreasing radius, you can take either path shown
> but at a significantly lower speed."

The book's **ink** draws the double-apex companion red, fully on-road, two
hourglasses, two ring apexes. The book's **caption** conditionally sanctions
that same path (blind + significantly lower speed). The current design text
(01 §3/§5: the companion "renders red because its verdict is red") is an
intention with no mechanism — colour law v2 grants red only to
wide/runoff/crash, and a contained two-touch line grades amber.

#### Mechanism A — `wrong_strategy_for_corner` (red for contained-but-mismatched strategy)

1. **New doctrine check** `wrong_strategy_for_corner` (joins the v2 catalogue;
   integration owned by the doctrine-catalogue cluster; arithmetic defined
   here):
   - **Applicable** iff the line traverses a corner derived from a taper with
     `r1/r2 ≥ DR_RATIO_MIN = 1.25` (TUNING) — the decreasing-radius archetype.
     Else `na` (evidence: `not_a_dr_corner`).
   - **Fail** iff that corner's measured `apexes` list (§4) has length ≥ 2 — the
     ridden strategy is double-apex on a corner whose doctrine is
     single-late-apex.
   - **Warn, not fail** — the caption's carve-out, mechanized line-locally: the
     verdict downgrades to `warn` when (a) the corner was **blind at
     commitment**: `sight_m` at the line's first `turn_in` event for the corner
     < the corner's remaining arc length, **and** (b) the entry was
     **significantly slower**: `v` at that turn-in ≤ `DR_ALT_SPEED_MARGIN = 1.0`
     (TUNING) × `sqrt(g · tan(phi_reserve) · r2)` — slow enough that the
     tightest radius fits inside the street lean reserve without further
     slowing. Both read off the line's own samples and the road; no cross-line
     reference.
   - **Evidence:** `{apex_count, apexes_s, corner_id, blind_at_turn_in,
     v_turn_in_kmh, v_reserve_kmh, book_note}` where `book_note` quotes the
     caption's sanction; `explain wrong_strategy_for_corner` prints the caption
     verbatim.
2. **Check severity classes** (colour law v2.1 — amends D9's mapping, not its
   principle): every check id in the catalogue carries
   `severity ∈ advisory | standard | critical` (advisory can only `warn`;
   standard `fail` ⇒ contained/amber as today; critical `fail` ⇒ failing/red).
   All carried checks are `standard`; `wrong_strategy_for_corner` is the sole
   v2 `critical`. 06 §5.1's mapping becomes:

   ```
   "failing"   if outcome ∈ {wide, runoff, crash}  OR  any critical check failed
   "caution"   if outcome = contained with failed (non-critical) checks, or stopped
   "good"      if outcome = contained and no check failed        (the clean predicate)
   ```
   (merged into doctrine-catalogue's single total quality law, Option B words)

   Colour still derives **solely from the line's own verdict** — severity is a
   property of the check id (rubric-pack data, which hands the review-§8.2
   rubric seam its first concrete field), never of the line's role. D9 holds.
3. Result on fig 8.4: companion solves contained (or best_failing), records two
   apexes, fails the critical check, renders **red — matching the book's ink**;
   on a blind variant of the same scene at reduced entry it reads `warn` →
   amber — matching the caption's sanction. Both book statements are honoured
   by one predicate.

#### Mechanism B — follow the caption; companion ships amber with a disclosed departure

No new check, no severity classes. The companion grades `contained`-with-fails → amber (quality `caution`) on
its own merits. The shipped `fig-08-04.scene` `note:` declares: "book ink: red;
linelab renders amber — the caption sanctions this path at lower speed, and
linelab colours by verdict (D9)." G7's parity criterion gains a per-figure
**disclosed-colour-departure clause**, and the render-then-judge parity leg
consumes an exceptions manifest naming fig 8.4. Cost: the strongest testable
goal (G7) acquires an exception list, and the tool's figure teaches a different
colour lesson than the book's page it reproduces. Benefit: zero new colour
machinery; the caption's sanction honoured literally.

**Recommendation: Mechanism A.** (i) G7 is stated over the *line diagrams*; the
ink is the parity target and the caption qualifies the doctrine, not the
drawing. (ii) The caption's sanction is conditional — blind + significantly
lower speed — and Mechanism A encodes exactly that condition as arithmetic
instead of prose, so the design honours *both* halves of the book instead of
picking one. (iii) Severity classes cost one enum on a catalogue that is being
rebuilt anyway (review §2.4) and give the rubric seam its first data point.
(iv) Mechanism B's exception list erodes G7 for every future figure dispute.
→ **user decision below.**

---

### 4. Two-apex verdict recording (contract impact)

**05 §6.3 `corners[]` is reshaped** (pre-implementation design change; the
scalars it replaces are named so the editor can strike them):

```
corners: [ {
  id, hand,
  turn_ins: [ { s, lean_commit_deg } ],          // one per turn_in event in span; replaces turn_in_s
  apexes:   [ { s, pct, f, clearance_m, v_kmh } ],   // ordered by s, 1..N; replaces
                                                     // apex_s, apex_pct, apex_f, clearance_m, v_apex_kmh
  lean_max_deg, grip_min,
  exit: { s, d, f, heading_err_deg },
  ran_wide, corrective: null | <02's recorded shape>, crash?
} ]
```

**Apex detection arithmetic** (turns 01 §5's "two distinct lane-fraction
minima" from a hope into a predicate): walk `f(s)` over the corner span with
hysteresis — a local minimum is **accepted as an apex** when `f` subsequently
rises by ≥ `APEX_PROMINENCE_F = 0.08` (TUNING) before the corner ends or a new
lower minimum supersedes it; accepted apexes closer than
`APEX_MIN_SEP_M = 5.0 m` (TUNING) merge, keeping the deeper. Single
deterministic pass; same rule feeds the `apex` events (one event per accepted
apex, `detail.index` 1-based per corner — markers and line-qualified labels are
event-sourced, which is the marker cluster's requirement met).

**Corner groups.** Contiguous same-hand corners separated by straights shorter
than `LINK_GAP_FRAC-derived group rule = 6 m` (TUNING) form an addressable **corner group**, grammar
token `corner=c1..c3` (scene + CLI + JSON `corner: "c1..c3"`). `style=double_apex`
targets a group (default: the maximal group containing the first corner); its
**two-touch acceptance criterion** is: the union of `apexes` across the group ≥ 2,
pairwise separation ≥ `APEX_MIN_SEP_M`. Group *solving* internals stay with the
solver-refit cluster; the criterion is verdict-side and defined here so both
clusters converge on one predicate.

**Check consequences** (arithmetic handed to the doctrine-catalogue cluster):
`late_apex` reads the **final** apex's `pct`; `wrong_strategy_for_corner` reads
the count (§3); and — closing review §6 bullet 1's "legitimate double-apex line
plausibly grades amber" — **the double-apex `na` carve-out**: when a line's
source is a solve with `style=double_apex` **and** the two-touch criterion is
met, `single_input` and `out_in_out` read `na` (evidence:
`double_apex_by_design`), the exact analogue of the chain-aware carve-out in
04 §5. Fig 8.5's green line reaches green **on merit**, not by role.

---

### 5. `use_full_width` — semantics, spellings, validation

**What it relaxes — pinned:** the **usable corridor**, and nothing else.

- `false` (default): corridor = the rider's own lane inset `bike_margin_m` both
  edges (width `lane_width_m − 2·bike_margin_m`).
- `true`: corridor = the full carriageway (v1 roads are two-lane: width
  `2·lane_width_m`) inset `bike_margin_m` at each **outer** edge.

`f` remains the one lateral coordinate, rescaled with the corridor: 0 = inner
usable edge, 1 = outer usable edge, **`f > 1` = off-road** (the 05 §2.1 gloss
"`>1` = oncoming" holds only under the default; 05's field table gains that
clause). Everything reading `f` — plan `position` targets, `start.f` (default
1.0 = outer edge of whichever corridor), constraint bounds `f_min`/`f_max`,
verdict fields, the containment predicate — rescales together; no special
cases. Entry lane discipline is therefore *not* separately relaxed: the
doctrinal entry is still `f = 1.0`; the corridor it refers to widened.

**Spellings (all three, closing fig-8.4 [1] / fig-8.5 [2]):**

| Surface | Spelling |
|---|---|
| wire JSON | `road.use_full_width: true` — and the road union type is amended so options compose with presets: `{ preset, use_full_width?, bike_margin_m? }` |
| scene text | trailing options on the `road:` line, stripped by the scene parser **before** DSL parse (DSL round-trip identity untouched): `road: preset bookDecreasing fullWidth=true` · `road: lane 3.5 \| S 10 \| L 16>9 ^130 \| S 14 fullWidth=true bikeMargin=0.4` |
| CLI | `--use-full-width` (boolean), `--bike-margin <m>` |

**Validation:** unknown option key on the `road:` line → `SCHEMA` naming token
and 1-based line; duplicate option → `SCHEMA`. Composition guard (requirement
on the oncoming-vehicle cluster, review §8.6): an occluder/hazard placed in the
oncoming lane composed with `use_full_width: true` is rejected
`OUT_OF_SCOPE` / `full_width_with_oncoming_traffic` — track framing and
oncoming traffic cannot both be true.

**Renderer requirement (renderer cluster, one sentence into 06 §3.1):**
`use_full_width: true` suppresses the centreline marking, keeps edge lines —
fig 8.4/8.5's book roads carry no centreline.

---

### 6. End-to-end authoring paths for the two red lines

#### 6.1 Fig 8.5 — the red "typical late apex" line (mechanism: believed-road)

The book's red line is a plan formed for an ordinary corner, executed on a
~180–200° compound, salvaged by braking-at-lean — the save is drawn ("Houston,
we have a problem" = the forced input; "yikes! braking *and* increasing lean" =
the stand-up). The complete shipped scene (`figures/fig-08-05.scene`):

```
road:      preset bookDoubleApex fullWidth=true
lines:
  good:    ride entry=30 style=double_apex
  late:    ride entry=30 startF=0.6 believeRoad="lane 3.5 | S 10 | L 12 ^90 | S 30" role=mistake label="typical late apex"
labels:
  apex:c1@good   "apex 1"
  apex:c3@good   "apex 2"
  apex:c1@late   "typical late apex"
  correction@late      "Houston, we have a problem"
  correction@late +8   "yikes! braking and increasing lean"
view:      mode=diagram window=auto
note:      "Double Apex Turn — pick your turn points before necessity forces them on you (fig 8.5)"
```

Trace of the `late` line: believed world (`S 10 | L 12 ^90 | S 30`) solves
clean — one late apex, roll-on placed for a 90° exit. `s_div = 24.66 m`
(mid-arc, per §1.4). Executed on `bookDoubleApex`: through c1 the worlds agree
(P-MISJUDGE-PREFIX: byte-identical samples to `s_div`); at the R24 bulge the
believed plan rolls on ("corner's over"); c3 tightens to R12; the line is wide
and mispointed; `run_wide_detect` fires; after `t_react_s` the corrective SHADOW
evaluates — roll toward reserve at `a_cmd = 0` — and the Tier 1R stand-up makes
the save marginal: outcome `wide`/`runoff` → red, drawn uncorrected, with the
`correction`/`run_wide_detect` bookmarks anchoring both callouts (merged: the
shadow law; the save itself is the stepper-only ghost).
Both lines engine-produced end to end (D7); one belief is the only authored
delta (§1.3). New small grammar completion used above: `startF=<f>` on ride
lines (scene) / `--start-f` (CLI) exposing the existing `rider.start.f` — the
book's red line enters mid-road.

**Finding the teaching window.** Defined: `W(line) = { entry :
believed-world solve clean ∧ executed outcome ∈ {wide, runoff} }` — below `W`
the corrective is feasible (`contained`/`wide` with `corrective.feasible = true`, no drama); above it the believed world
itself refuses (`believed_world_not_clean` — the rider wouldn't have planned
it) or the executed run crashes. **Requirement on the agent-interface cluster
(owns the sweep extension):** `sweep` must accept solve-spec axes — at minimum
`scenario.entry_kmh` and misjudgment params (`believe.r_believed`,
`believe.sweep_believed_deg`) — and report per-cell
`{outcome, acceptance.met, apex_count, misjudgment.s_divergence_m}` so `W`'s
endpoints are read straight off one table:
`linelab sweep fig-08-05.scene --line late --param scenario.entry_kmh --range 24:40:2`.
The 30 km/h in the shipped scene is the window's midpoint on the preset
(TUNING; pinned by acceptance test A-8.5-WINDOW).

#### 6.2 Fig 8.4 — the red double-apex companion (mechanism: two-strategy solve + best_failing + §3)

Not a misjudgment: the caption frames it as a path you might *choose* under
uncertainty. It is a deliberate second strategy, solved on the actual road. The
complete shipped scene (`figures/fig-08-04.scene`):

```
road:      preset bookDecreasing fullWidth=true
lines:
  single:  ride entry=30 label="single-apex line"
  double:  ride entry=30 style=double_apex accept=best_failing role=alternative label="double-apex line"
labels:
  turn_point@single    "single-apex turn point"
  turn_point#1@double  "double-apex turn point 1"
  turn_point#2@double  "double-apex turn point 2"
view:      mode=diagram window=auto
note:      "Decreasing Radius Turn — with a delayed entry it can be completed with only one turning point (fig 8.4)"
```

`single` solves clean with the DR late bar (requirement on the solver-refit
cluster: corner-type-aware `target_apex_pct`, >60 % on DR corners — their §4
fix). `double` runs `solveDoubleApex` on the taper group; if it converges
contained it records two apexes in the one taper corner (§4's list — this
figure is why the list is per-corner, not per-group) and fails
`wrong_strategy_for_corner` → **red while fully on-road, matching the ink**
(Mechanism A; under Mechanism B it ships amber with the disclosed note). If
the DR pinch defeats contained convergence at equal entry, `accept=best_failing`
returns the best self-verified two-touch attempt — `wide` → red honestly, and
`acceptance: {policy:"best_failing", met:false}` discloses it. Equal entry
speeds are deliberate: the caption's "significantly lower speed" sanction is
demonstrated by the check's `warn` branch on the blind variant scene
(`bookDecreasing` + hedge + reduced entry), which the 09 oracle also pins.

Line-qualified label anchors (`turn_point#2@double`, `apex:c1@late`,
`correction@late`) are the marker/label cluster's grammar; these two scenes are
its acceptance fixtures. Preset handedness (figs 8.4/8.5 are left-handers) is
the handedness cluster's `hand=` token; `bookDoubleApex` below is defined
left-hand natively per the book's ink.

---

### 7. The `bookDoubleApex` preset

Fig 8.5 is **the only Chapter-8 archetype with no preset today** (book90 covers
8.1–8.3, bookDecreasing 8.4, bookEsses 8.6). New row for 03 §3.1 (all geometry
TUNING):

| Preset | Expansion | Suggested entry | Teaches |
|---|---|---|---|
| `bookDoubleApex` | `lane 3.5 \| S 10 \| L 12 ^70 \| L 24 ^40 \| L 12 ^70 \| S 12` | 30 km/h | double-apex compound (fig 8.5): two touch corners bridged by an opening — the shape that rewards two apexes |

Design notes: left-hand natively (the book's ink; the one preset that needs no
mirroring for parity). Corners mint `c1, c2, c3`; they form one corner group
under §4's rule (zero-length gaps < `LINK_GAP_FRAC-derived group rule`), so `style=double_apex`
targets `c1..c3` by default. Total sweep 180°; per-segment sweeps ≤ 70° with
r ≥ 12 m — clears the super-tight refusal with margin. Full-width figure: 7 m
carriageway / R12 touch corners = 0.58, inside the book proportion band at true
scale; entry straight (10 m) shorter than one touch-arc length (14.7 m). 30 km/h
≈ 8.3 m/s at the R12 touches ≈ 27–28° lean with full width — at the street
profile's 70 %-reserve doctrine point. The green two-touch line and the §6.1
believed-road red line are both solved on this one preset.

**Companion recommendation (fig 8.4 geometry, same table):** pin the super-tight
refusal for tapers — refuse when the sweep accumulated while `r(θ) ≤ 15 m`
(taper `r` linear in swept angle for this test) is itself ≥ 170°, and add
`r_min`/`r_max` to the derived corner record (equal for arcs) so "which radius a
taper is tested on" has one answer (shared surface with the road-model cluster).
Under that predicate the book-faithful teardrop `L 24>12 ^210` becomes legal;
whether `bookDecreasing` is revised to it is a user decision below.

---

### 8. Placement map (doc, section, replaced text)

| Piece | Lands in | Replaces / amends |
|---|---|---|
| Misjudgment concept + D7 statement + one-perturbation extension | 01 §4.3 (new sub-family paragraph + two table rows); 01 §7 gains "or a misjudgment spec" in the authored-as list | 01 §5 double-apex bullet's sentence "The *failed* line of fig 8.5 … now fails honestly via the run-wide slice" → rewritten: believed-road is the authoring mechanism; the run-wide slice is the physics that makes the save fail. 03 §7.1 chop row's "fig 8.5's failure mechanic" mapping → "Ch.9 throttle doctrine" only. |
| `underread`/`overread` kinds, params, pins, compile path | 03 §7.1 table + new 03 §7.4 "Misjudgment kinds"; 00 §4 mistake-kind closed set | 03 §7 intro "exactly one control perturbed" → "exactly one perturbation: one control (execution kinds) or one belief (misjudgment kinds)" |
| `believed_road` solve field, validation table, `s_div` rule, execution pipeline | 04 new §4.6 "Believed-road solving" | — |
| `accept` policy, ranking, guardrails | 04 new §4.7 "Acceptance policy"; 04 §4.2 self-verify paragraph gains the `acceptance.met` cross-ref | — |
| Scene grammar: `believeRoad=`, `accept=`, `startF=`, `corner=<a>..<b>`, road-line options `fullWidth=`/`bikeMargin=` | 04 §7 | "exactly one `ride` line is required" → "at least one `ride` line; mistakes compile against the first" (also consistency bug 9.1) |
| Recipe R8 (misjudged corner end-to-end; R7 = solver-refit's double-apex) | 04 §8 | coordinate count/wording with agent-interface cluster |
| `misjudgment` + `acceptance` verdict blocks; `corners[]` reshape; `source` kind `misjudge`; `f>1` gloss | 05 §6.3, §7, §2.1 | strikes `turn_in_s, apex_s, apex_pct, apex_f, clearance_m, v_apex_kmh` scalars |
| `wrong_strategy_for_corner` + severity classes + double-apex `na` carve-out | 01 §3 colour-law paragraph; catalogue integration with doctrine-catalogue cluster; 06 §5.1 mapping | 01 §3 "renders red because its verdict is red, not because someone painted it" → mechanism sentence; 01 §5 DR bullet's colour claim → cites the check; 06 §5.1 quality() → v2.1 form (§3 above) |
| `use_full_width` spellings + corridor pin + centreline suppression | 03 §2/§6 (semantics, union type), 04 §7 (scene), 08 §4.1 (flags), 06 §3.1 (renderer, one sentence) | 05 §2.1 `f` row's "`>1` = oncoming" gains the full-width clause |
| `bookDoubleApex` + refusal predicate + `r_min`/`r_max` | 03 §3.1 preset table; 01 §8 / 03 §2 refusal wording | "(sweep ≥ 170° **and** radius ≤ 15 m)" → the accumulated-sweep predicate |
| Goldens/properties/oracle rows | 09 §3.4, §3.5, §4 (below) | — |

### 9. Acceptance (design/09 additions)

- **G-MISJUDGE-DR** (golden): `bookDecreasing` + `mistake underread` (zero
  params → `r_believed = 16`): believed-world clean; executed outcome
  `runoff`; `misjudgment.s_divergence_m` inside the taper; hashes pinned.
- **G-8.5-RED / G-8.4-COMPANION** (goldens): the two shipped scenes of §6 bake;
  per-line pinned outcomes, apex counts (`double`: 2 in the taper corner;
  `good`: 1 in c1 + 1 in c3), check verdicts (incl. `wrong_strategy_for_corner`
  fail on `double`, `na`-carve-outs on `good`), colours per 06 §5.1 v2.1.
- **P-MISJUDGE-PREFIX** (property): an accepted misjudge line's samples are
  byte-identical to the believed-world run's for `s < s_divergence_m` (same
  start, same literalized plan, same geometry ⇒ same integration).
- **P-MISJUDGE-IDENTITY** (property): fuzzed believed roads equal to the actual
  road are rejected `INEFFECTUAL`; fuzzed hand-flips rejected `OUT_OF_SCOPE`.
- **P-ACCEPT-MONOTONE** (property): whenever `accept=clean` succeeds,
  `accept=best_failing` returns the byte-identical line.
- **P-ACCEPT-GRADE** (property): a best_failing-returned plan re-run via `run`
  yields the identical verdict — acceptance policy never touches grading.
- **P-ACCEPT-CONSTRAINT** (property): no best_failing return ever violates an
  authored constraint (extends P-CONSTRAINT-BINDING to the relaxed policy).
- **G-APEXLIST** (golden): `bookDoubleApex` + `style=double_apex`: apexes lists
  `[1, 0, 1]` across c1..c3 under the hysteresis rule; `late_apex` reads the
  final apex; `apex` events carry `detail.index`.
- **A-FULLWIDTH** (acceptance): one scenario authored three ways (JSON flag,
  scene road-option, CLI flag) composes to the identical corridor (D8
  conformance row); a line contained under `fullWidth=true` at `f = 1.3` maps
  to `f > 1` (off-road gloss) under the same geometry with `false`.
- **A-8.5-WINDOW** (acceptance): sweeping `scenario.entry_kmh` 24→40 on the §6.1
  scene's `late` line yields the three bands (contained ▸ wide/runoff ▸
  refusal-or-crash) with monotone boundaries and a non-empty teaching window
  containing 30 km/h.
- **Oracle rows** (09 §4): `underread` pinned on the `bookDecreasing` fixture
  (outcome `runoff`, expect_fail as declared); `overread` pinned on `book90`
  (outcome `contained` + mandatory failed checks); the same iron rule — a pin
  that stops holding is never patched at the pin.

### 10. Decision drafts (editor numbers them)

1. **Misjudgment is first-class: believed-road solving.** Every Chapter-8 error
   is a belief error; linelab therefore accepts a believed road per line —
   solve on the believed road, execute the literalized plan on the actual road
   — with `underread`/`overread` sugar, a shared-prefix validation rule, and
   full provenance (`source.kind = "misjudge"`, verdict `misjudgment` block).
   D7 intact: the author writes worlds, never lines; the engine produces the
   line in both worlds. The one-perturbation rule extends to belief-space: one
   control or one belief, never both.
2. **Solvers return their best failing line on request.**
   `accept = clean | best_failing` on solve specs; best_failing returns the
   highest-ranked *self-verified* candidate (severity → failed-check count →
   corridor excess → apex distance → deterministic tie-break) instead of
   refusing; authored constraints stay hard; provenance
   (`verdict.acceptance {policy, met}`) makes it impossible to receive a
   non-clean line silently; grading and colour are policy-independent.
3. *(contingent on user decision U1 = Mechanism A)* **Check severity classes;
   critical doctrine failures render red.** Amends D9's mapping, not its
   principle: colour still derives solely from the line's own verdict; each
   check id carries `advisory | standard | critical`; `wrong_strategy_for_corner`
   (DR corner ridden with ≥2 measured apexes; `warn` when blind-at-commitment
   and significantly slower per the fig 8.4 caption) is the sole v2 critical —
   restoring fig 8.4 ink parity without painting by role.

### 11. Shared surfaces touched (for cross-cluster reconciliation)

- **Mistake-kind closed enum** (00 §4, 03 §7.1): += `underread`, `overread`
  (misjudgment sub-family — compile to believed roads, never to plan edits).
- **`LineResult.source`**: new kind `misjudge` (05 §7).
- **Verdict shape** (05 §6.3): new `misjudgment` and `acceptance` blocks;
  `corners[]` reshaped — `turn_ins: []` and `apexes: []` lists replace the
  `turn_in_s / apex_s / apex_pct / apex_f / clearance_m / v_apex_kmh` scalars.
- **Check ids & classes** (doctrine-catalogue cluster): new id
  `wrong_strategy_for_corner` with its arithmetic and `warn` branch; per-check
  `severity ∈ advisory | standard | critical`; the double-apex `na` carve-out
  for `single_input` / `out_in_out` (evidence `double_apex_by_design`);
  `late_apex` reads the **final** apex.
- **Colour law** (06 §5.1, renderer cluster): v2.1 mapping — red iff
  `outcome ∈ {wide, runoff, crash}` OR any critical check failed (Mechanism A
  only); centreline suppression under `use_full_width`; legend discloses
  `acceptance.policy` (with the pedagogy cluster's verdict-word+role legend).
- **Typed-error sub-reasons** (existing closed codes, new reasons):
  `SCHEMA`/{`misjudge_param_required`, `misjudge_with_execution_mistake`,
  `believed_lane_geometry_differs`, `believed_no_shared_prefix`,
  `accept_policy_incompatible_with_misjudge`},
  `INEFFECTUAL`/{`believed_road_identical`, `accept_on_mistake_line`},
  `OUT_OF_SCOPE`/{`believed_hand_differs`, `full_width_with_oncoming_traffic`},
  `BAD_RANGE`/`believed_placement_unresolvable`,
  `NO_SOLUTION`/{`believed_world_not_clean`, `no_rankable_candidate`}.
- **Events** (05 §5): one `apex` event per accepted apex with `detail.index`
  (markers/labels are event-sourced — the marker cluster's line-qualified
  anchors `apex:c1@late`, `turn_point#2@double`, `correction@late` consume them).
- **Exit codes / `--gate`** (agent-interface cluster): must key off
  `acceptance.{policy, met}` + `expect_fail` (role DROPPED — roles never gate,
  D9); a `best_failing` return exits 0.
- **`sweep`** (agent-interface cluster): solve-spec axes (`scenario.entry_kmh`,
  `believe.r_believed`, `believe.sweep_believed_deg`) + per-cell
  `{outcome, acceptance.met, apex_count, misjudgment.s_divergence_m}`.
- **`resolved_scenario` envelope member** (agent-interface cluster): the
  literalized executed plan of a misjudge line is an acceptance case.
- **Corrective shot** (corrective/off-road cluster): requirement WITHDRAWN by
  the merge — the branched-shadow law stands; fig 8.5's callouts anchor on the
  main-line `correction`/`run_wide_detect`/`end` bookmarks, the save ships as
  the stepper-only ghost, and the ink departure is a disclosed parity note.
- **`solveDoubleApex` / `contained` outcome / DR apex target** (solver-refit
  cluster): full-resolution self-verified candidates so `accept` composes;
  `contained` slots at severity rank 1 in the best_failing ranking;
  corner-type-aware `target_apex_pct` (>60 % on DR); the corner-group token
  `corner=c1..c3` and the group-level two-touch criterion defined here.
- **Road model** (road/DSL cluster): `road:`-line options `fullWidth=` /
  `bikeMargin=` (+ `--use-full-width` / `--bike-margin`); road union
  `{preset, use_full_width?, bike_margin_m?}`; `r_min`/`r_max` on the derived
  corner record; the accumulated-sweep super-tight predicate for tapers;
  `startF=` / `--start-f` exposing `rider.start.f`.
- **Presets** (03 §3.1): += `bookDoubleApex` (left-hand natively); handedness
  interplay with the review-§8.8 `hand=` fix.
- **09**: goldens/properties/oracle rows of §9; the two shipped scenes are
  acceptance fixtures for the marker/label cluster's grammar.

### User decisions

- **U1 — fig 8.4's red line.** Mechanism A (`wrong_strategy_for_corner` as the
  sole *critical* check: red for a contained double-apex strategy on a
  decreasing-radius corner, downgraded to `warn`/amber exactly when the caption's
  sanction applies — blind at commitment AND significantly slower) **vs**
  Mechanism B (companion ships amber; the figure carries a first-class disclosed
  departure from the book's ink; G7 gains an exceptions clause). The caption's
  exact words: *"In the case of blind corners, if you don't know if it is a
  decreasing radius, you can take either path shown but at a significantly lower
  speed."* **Recommendation: A** — it reproduces the ink G7 promises while
  encoding the caption's conditional as arithmetic, keeps colour fully
  verdict-derived (D9), and avoids a permanent parity asterisk on one of six
  flagship figures. B is smaller and never risks red-inflation; choose it only
  if minting "red without physical departure" is unacceptable on principle.
- **U2 — the super-tight refusal vs the fig 8.4 teardrop.** Adopt the
  accumulated-sweep predicate (refuse when the sweep accumulated while
  `r(θ) ≤ 15 m` is itself ≥ 170°), which legalizes the book-faithful
  `L 24>12 ^210` teardrop — and then decide whether `bookDecreasing` is revised
  to that geometry or stays at `R 16>9 ^130`. **Recommendation:** adopt the
  predicate now; keep `bookDecreasing` at 130° for v1 goldens and ship the
  teardrop as the fig-8.4 parity scene's road only after the projection cluster
  confirms the proportion gate passes on it (the review found `C_TAPER`
  compresses exactly this corner).
- **U3 — believed-world ghost line.** Should the believed-world trajectory be
  renderable/inspectable in v1 (a ghost overlay, `stateAt` access), or
  provenance-only (the two hashes + summary; recompute on demand by re-solving
  the shared spec)? **Recommendation: provenance-only in v1** — a ghost drawn on
  a road it wasn't ridden on would be the one drawn line that is not a ridden
  line on that figure's road, and it needs new renderer honesty rules; an author
  who wants it draws a second figure from the same solve spec on the believed
  road (§1.6), which the mechanism already supports.
