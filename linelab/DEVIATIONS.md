# DEVIATIONS.md — v0.1 ratification queue

This is the design owner's decision queue for linelab v0.1. It compiles every
place the shipped engine (`src/`) reads differently than the design-of-record
letter (`design/00`–`09`), sourced from: the two build-task transcripts
(package `ratification[]` blocks + adversarial `reviews[]`), five later
design-owner adjudications, `PENDING RATIFICATION` code comments still in
`src/`, and the six baked figures' visual-judge records
(`figures/*.judge.json`).

**Status vocabulary:**
- `adjudicated-fixed` — was a deviation; a design-owner adjudication resolved
  it and the fix is in; no longer deviates (kept here as a one-line record).
- `implemented-invariant-first` — the code implements a coherent reading that
  the design text conflicts with; the *design text* is what needs to change,
  not the code. Low-risk amendments.
- `pinned-engine-truth` — a measured fact about this physics/solver tuning
  (a speed, an outcome class) that the design letter got wrong; recorded in
  goldens as truth, not asserted against the letter.
- `needs-decision` — no single reading resolves it; the design owner has to
  pick a direction (retune a constant, reshape a fixture, amend a formula,
  or accept the engine's own answer). Adjudicated items that came back
  "confirmed-pin" also land here — the adjudication established *that* a
  design decision is required, not *what* it is.

Where an item cites a test file, that test is the executable tripwire: if the
engine ever stops producing the described behavior, that test goes red and
this entry is stale.

---

## Adjudicated this cycle (read first)

Five seams were escalated to the design owner and came back with rulings.
Four are `confirmed-pin` (a design decision is still required — filed under
their design doc below with the adjudication arithmetic); one is `mixed`
(two sub-findings fixed, two confirmed as-implemented).

| id | ruling | filed under |
|---|---|---|
| `adj-doubleapex` | confirmed-pin — bookDoubleApex two-touch is unsatisfiable under both the per-corner release reading and the compound-window reading | design/04 §4.6 |
| `adj-feasibility` | confirmed-pin — canonical entry speeds (recipe-a@55, C30@70) have an empty feasible band on the frozen engine | design/02 §8, design/08 §6 |
| `adj-vis` | confirmed-pin — V2.5's letter is jointly unsatisfiable with D20's 5° tracker authority; the 1.4→2.0 margin move is forced | design/04 §6 |
| `adj-corrective` | confirmed-pin — book90's outward-strip geometry makes every design-letter wide/late_apex expectation unattainable on `fifty_pence`/`premature_contained` | design/03 §7.1, design/04 §4c.4 |
| `adj-checks` | mixed — check-12 teleport guard + quick_steer truncation **fixed**; check-10 open-end carve-out + single_input seed **confirmed as-implemented** | design/01 App. A |

No goldens, hashes, or bakes moved as a result of any of the five rulings
(comment/test-only edits); the Rebake step re-blesses nothing from these
seams except where a WP-16/17 item below says otherwise.

---

## design/01 — Scope and Doctrine (checks, quality law)

- **[01 App.A check 12]** KAPPA_STEP/PHI_JUMP speed-blind per-sample
  thresholds failed the profile-rate exit unwind below ~8.3 m/s (esses/
  hairpin/decreasing-radius class). — **adjudicated-fixed**: guards now read
  only Δt→0 retained-sample pairs (teleport regime), matching the check's own
  "no tracker overdrive" intent. Pinned: `test/oracle/rubric.test.ts` check-12
  Δt→0 fail witness + low-speed full-rate-flick pass witness;
  `src/plan/doctrine/metrics.ts` (`[ADJUDICATED, ratification]` comment).

- **[01 App.A, quick_steer]** SEAM-QS-TRUNCATION: a rider who never completes
  roll-in (departs off-road at ~24% of the corner) measured only on the
  ridden extent, so `steer_share` (0.24) stayed under the 0.45 fail bar and
  the mandatory slow-arm gate passed when it should fail. — **adjudicated-fixed**:
  an uncompleted roll-in now grades `eats_corner` directly (evidence:
  `dt_steer_s=null`, `roll_in_completed=false`, share = ridden lower bound).
  Pinned: `test/oracle/oracle.test.ts` SEAM-QS-TRUNCATION → mandatory
  quick_steer fail; `src/plan/doctrine/metrics.ts`.

- **[01 App.A check 10 / 05 §2.1]** `stop_within_sight`'s deficit metric fails
  every finite road's final ssd-shadow under a literal line-end clamp. —
  **adjudicated-fixed** (confirmed as-implemented): the open-end carve-out
  (road_end-terminated lines; casts unblocked to the road end carry no sight
  limit, per 03 §5.1's own rule) stands as ratified. **Still open** (not this
  seam's fix, separate defect): `verdict.sight.margin_min_m` in
  `solve/verdict.ts` still reads the pre-carve-out clamped channel and
  reports a negative minimum on every line — needs its own fix, filed under
  design/05 below. Pinned: `src/plan/doctrine/metrics.ts` (comment at the
  sightDeficit function).

- **[01 App.A, single_input]** Pre-window baseline seed in
  `steeringInputRuns` (the commit step INTO the window counts as the rising
  input) — without it, `single_input` read `no_input`/fail on every engine
  line. — **adjudicated-fixed** (confirmed as-implemented). Pinned:
  `test/golden/*.test.ts` G-C30-CHECKVECTOR.

- **[01 App.A check 13, leg (c)]** Headline ("≤1 local extremum") and
  parenthetical ("alternating: exactly one minimum — the flick; same hand:
  none") genuinely conflict. — **implemented-invariant-first**: parenthetical
  read as the binding refinement, "exactly one minimum" as tolerance not
  mandate (alternating hands pass at 0 or exactly-1-minimum extrema; a lone
  maximum fails; same-hand passes only at 0; ≥2 always fails). Design text
  should state this explicitly. Pinned: `src/plan/doctrine/checks.ts:734-736`
  comment; `test/oracle/rubric.test.ts`.

- **[01 App.A check 1 / 05 §6.3]** The `DoctrineCorner` seam carries no
  total-sweep field, so an arc corner with an empty apex list and no
  completed heading capture had no way to grade `late_apex`. —
  **implemented-invariant-first**: new typed `na` reason
  `sweep_unmeasurable` minted (01 App.A authorizes per-check typed `na`
  reasons; the na table just doesn't enumerate this case). Recommend the
  design seam grow a `Corner.angle_deg`-equivalent field so every terminated
  line grades — that field addition was outside this fix's file grant.
  Pinned: `src/plan/doctrine/metrics.ts`; `test/oracle/rubric.test.ts`.

- **[03 §7a.3 / 01]** The pack-schema check asserts
  `kappa_step_max_1pm >= kappa_max_1pm` but 03 §6.2's reason table mints no
  token for the failure. — **implemented-invariant-first**: minted SCHEMA
  reason `kappa_step_below_kappa_max`. Amend 03 §6.2's reason table.

- **[01 App.A, loader/quality law — rev-doctrine review, now fixed]** Three
  major findings from the adversarial doctrine review, all fixed in
  `plan/doctrine/{metrics,checks,pack}.ts` (no design amendment needed — pure
  bug fixes, letter already correct): (1) `apex_pct`'s empty-apex-list
  fallback fabricated a zero denominator — now resolves via `cornerSweepDeg`
  (exact taper geometry / measured heading capture / typed `na`), never
  fabricates `apex_pct:0`; (2) the pack loader never validated per-check
  threshold-name completeness (NaN could silently pass/fail under a legal
  variant pack) — new `CHECK_THRESHOLDS` registry + `thresholds_incomplete`
  SCHEMA rejection closes it; (3) 01 §A.1's advisory-severity law ("worst =
  warn, never blocks green") was enforced nowhere — `runChecks` now clamps
  advisory-row fails to warn. Five minor findings also fixed: provenance
  errors now carry the check id (§A.6); `single_input` count=0 under declared
  `double_apex` now passes ("≤2" includes 0); `check 16` now reads its pack
  row's declared `corner_trend` binding; link leg (c) extrema classified
  min/max; the continuation pack's load-time schema rejections
  (`ladder_cardinality_mismatch`, the 7a.3 coupling check) now have a real
  loader (`validateContinuationPackData`), not just test assertions. Status:
  resolved, no filler entry needed beyond this line — `test/oracle/rubric.test.ts`.

---

## design/02 — Physics Model

- **[02 §8 canonical entry speeds]** `adj-feasibility` (confirmed-pin): C30's
  70 km/h and recipe-a/b/f's 55 km/h both have an **empty intersection**
  between the §4.1a fit-clip floor and the roll-in containment ceiling — not
  an over-tight solver, a genuine geometric fact of this tuning (exhaustive
  grid-proof at 55 km/h: all 12 coarse candidates die, 5 to the fit clip, 7 to
  containment with f_max 1.46–2.23). C30 solves clean at 63 km/h (first
  candidate past the 63 fit floor of 25.48); recipe-a/b/f solve clean at
  40–50 km/h. **needs-decision**: amend 08 §6's example speed (55→~48) and
  02 §8's C30 entry (70→63), or retune the fit-clip/containment constants.
  Pinned: `test/analytic/bounds.test.ts` (D-BOUNDS), `test/cli/recipes.test.ts`
  A-RECIPE-A/B/F, `review/verify/fixture_geometry.py` check 16 (independent
  corroboration). Files audited untouched: `solve/{solve,stations,constants,
  suggest}.ts`, `road/corridor.ts`.

- **[02 §6 ZOH control vs 09 §3.2a closed forms]** A strict ZOH staircase
  makes `A-AN-BRAKE`/`A-AN-RK4`'s closed forms (`v = v0 − (slew/2)t²`)
  unsatisfiable by ~7.5e-3 m/s. — **implemented-invariant-first**: the RK4
  stage derivative reads an in-stage *linear* command lattice,
  `a(τ) = a_start + rate·τ`, between the step's two lattice values. Control
  consumers (`b_dem`, transient trigger, recorded `cmd_a`/`a_cmd_rate`) stay
  ZOH per ARCHITECTURE §10.10 — only the RK4 stage sampling changed. Amend
  02 §6 to specify the in-stage linear lattice.

- **[02 §3.1 release predicate]** `wrapToPi` in
  `dpsi_rem = handSign(c.hand)·wrapToPi(psi_exit − psi)` folds any remaining
  sweep >180° negative, releasing a 270° commitment (`F-AN-CIRCLE`) at its
  first step via the doc's own "≤0 releases immediately" rule — wrong.
  **implemented-invariant-first**: strike `wrapToPi`; `psi` is continuous in
  the engine. Spellings agree exactly below 180°. Amend 02 §3.1.

- **[02 §3.1 tracker law vs §2 frame]** The doc's tracker spellings presume
  d-toward-centre and anti-damp against the pinned d-positive-LEFT/y-down/
  +kappa-right frame, failing §5.4.6's binding invariants. —
  **implemented-invariant-first**: frame-correcting amendment —
  `d_dot = −v·sin(psi − psi_road)`, `kappa_ff = kappa/(1 + d·kappa)`, and
  `a_track` enters the lean target with a **minus** sign. Amend 02 §3.1.

- **[02 §3.1 transition table]** Missing `position(p) → commit(k')` row
  (turn_in reaching `at_s` supersedes an active position window per
  REQ-STEER-OWNERSHIP precedence (2)>(3)); null-corner-commitment behavior
  unstated. — **implemented-invariant-first**: row added; null-commitment
  pinned as "held with no release, never yields." Amend 02 §3.1's table.

- **[01 §A.2 steering_complete]** Unsigned `|phi| ≥ 0.9·phi_c` misfires at
  the supersession step of every commit→commit flip (esses row, C30-LR),
  collapsing `dt_steer`/`steer_share` for the second corner of every chained
  fixture. — **implemented-invariant-first**: amend to the signed form
  `handSign(hand)·phi ≥ 0.9·phi_c`. Amend 01 §A.2's letter.

- **[02 §4.2 brake tapering]** "Taper to complete `brake_gap` before turn-in"
  read under 02 §3's from-onset taper law sheds only `decel·span` — not
  04 §4.1a's constant-decel arithmetic (and not the ~50 km/h C30 corner
  speed 02 §8 implies). — **implemented-invariant-first**: hold+release
  realization — brake holds, a maintenance crack releases it pre-turn-in at
  `SOLVER_BRAKE_SLEW_MSS = 12`, restoring §4.1a's arithmetic. Pinned:
  `src/solve/solve.ts:658-660` comment. Amend 02 §3/04 §4.2 to spell the
  hold+release shape.

- **[02 §3.1 vs 04 §6 V2.5]** `adj-vis` (confirmed-pin): V2.5's letter
  ("turn-in at or after release") is jointly unsatisfiable with D20's 5°
  tracker authority — a literal post-release turn-in on the blind preset
  lands 9.0 m in-corner, and any uncommitted line exits the road at
  `s0+3.8 m`. **needs-decision**: the blind corner is instead negotiated
  under a wide commitment (PHI_TRACK_AUTH_DEG=5° forbids position
  negotiation at governed speeds) with roll-on release-gated. The
  `A-SSD-GOVERNOR` margin pin move 1.4→2.0 is a forced consequence (measured
  binding threshold 1.804). Alternative readings tried and killed with
  numbers: literal turn-in-at-release (off_road 19.79 < release 25.0 at every
  lean 24–44°), crawl speed (needs v ≤ 3.35 m/s, below the validity floor
  7.0), two-turn_in relabeling (first turn_in still precedes release). Amend
  04 §6 V2.5 or accept the wide-commitment reading; amend 09 §3.5's 1.4
  margin pin to 2.0. Pinned: `src/solve/vis.ts` header;
  `test/property/solver-ext.test.ts` A-SSD-GOVERNOR (1.4-inert arm +
  1.4<1.804<2.0 tripwire) + the "V2.5 seam" test.

---

## design/03 — Roads, Scenarios & Visibility

- **[03 §7.1 fixture pins vs corrective/mistake geometry]** `adj-corrective`
  (confirmed-pin): all four corrective/mistake seams are genuine engine
  truths. book90's outward-strip geometry (0.4 m at 10–42° emergent crossing
  angles) sits far outside the 2.2°/6° recoverability ceilings, so every
  design-letter wide/feasible or `late_apex`-fail expectation is
  unattainable on `fifty_pence` and `premature_contained`:
  - `fifty_pence` (SEAM-FP-PIN): 03 §7.1 pins `wide`; engine emergent class is
    `runoff` (same 0.4 m bike-margin geometry that makes `premature`'s
    corrective infeasible — 03 §7.1's own rule 2). **needs-decision**: 09 §4
    TUNING-PIN re-bless of the `plan/mistakes.ts` row. Pinned:
    `test/oracle/oracle.test.ts` `SEAM_FIXTURE_PIN_OVERRIDES`.
  - `premature_contained` (SEAM-PC-LATE-APEX): 03 §7.1 declares `late_apex`;
    the only contained eased line from the clamped early station has a final
    apex at pct 63.7 > bar 50 → `late_apex` **passes**; the emergent taught
    check is `out_in_out` (the table cell's own parenthesis).
    **needs-decision**: amend the pin-table `expect_fail` cell
    (`plan/mistakes.ts`).
  - The null-shot corrective arm (drift self-recovered before `t_shot` →
    feasible null-save) is the unique compliant completion of §4a.6×§4c.4;
    without it, marginal transient excursions leak `INTERNAL`. Verified
    `integrate.ts` has no edge-accounting bug: `detect` fires at the usable
    edge (|d|=3.1), `off_road` at the physical edge (|d|=3.5); the
    "terminal within ~1 m" read is genuine drift-angle geometry, not a bug.
  - Any future attempt to reach `fifty_pence`→`wide` by param tuning on
    book90-L is provably futile (angle ceilings 2.2°/6° vs emergent 10–42°,
    mirror @32 also fails, measured). The wide class needs a fixture with a
    post-detect runway ≥ `v·t_react·sin(θ)`.

- **[03 §7.1 early-placement clamp]** "Placed `early_by_m` earlier" clamps to
  a 0.5 m road-start floor when the solved turn-in sits closer.
  **implemented-invariant-first** (pin-servant reading); also clamps
  `F-ORACLE-CHAIN` c1 (turn-in at 4.0 → clamped 0.5).

- **[03 §7.1 "target stays tangent_inside"]** `premature_contained`'s
  resolution as the smallest contained committed lean above the kiss — a
  second bounded probe family beside 04 §5.1.3's `N_PROBE` kiss derivation.
  **implemented-invariant-first**.

- **[03 §5.1 target law vs F-SIGHT-OUTSIDE]** No reachable occluder family
  (inside/outside bands, own/oncoming, either hand) makes widening shorten
  sight under the own-lane-centre target law. **pinned-engine-truth**: hosted
  as a no-witness tripwire scan that fails on demand if the target law ever
  changes. Pinned: `test/property/solver-ext.test.ts` F-SIGHT-OUTSIDE.

---

## design/04 — Solver & Authoring

- **[04 §4.6 two-touch / release law]** `adj-doubleapex` (confirmed-pin): the
  two-turn-in double-apex plan cannot persist a commitment across
  bookDoubleApex's three sub-corners under either the per-corner
  heading-capture release (02 §3.1) or the alternative compound-window
  reading — the governing-corner release fires at the FIRST same-hand
  corner's exit heading, so no contained two-touch line exists on the preset
  (existence-scanned). **needs-decision**: requires a compound-window
  release binding or a single-arc bookDoubleApex reshape — a design decision,
  not a search/minting/binding fix. Consequences that stand on this pin:
  `NO_SOLUTION`/`no_two_touch_line` on the plain arm;
  `--accept best_failing` returns the retained best candidate;
  `G-APEXLIST`'s designed `[1,0,1]` apex list is unattainable (hosted as
  `it.todo`); `G-8.5-RED` bakes with all lines refused (goldens pin the
  refusal skeleton, per-line pins are `it.todo`); `A-RECIPE-J` inherits this
  same seam verbatim (not a new finding). Pinned: `test/property/solver-ext.test.ts`
  A-DOUBLEAPEX (tripwire: coarse `measureRun` of the crawl witness — decel
  3.4, ti1 15°/lean 20°, ti2 43°/lean 30° — asserting contained + two_touch +
  band + apex-count + touch speeds; if any assertion flips, re-adjudicate);
  `src/solve/doubleApex.ts` header; `test/oracle/oracle.test.ts`;
  `test/golden/scenes.test.ts` G-8.5-RED; `test/cli/recipes.test.ts` A-RECIPE-J.

- **[04 §5 chain verdict vs 01 App.A check 12]** CHAIN-CLEAN SEAM: "zero
  applicable check fails" on a correctly ridden bookEsses chain is
  unsatisfiable — a full-rate 50°/s flick at chain speeds ≤9 m/s steps
  recorded kappa >0.01/0.5m sample, and rideability's window closes exactly
  where the D27 flip budget opens; the frozen commit-release law also caps
  the final corner's exit swing. **needs-decision**: pinned as
  `outcome=contained` + chain checks pass + failing set CLOSED to
  `{out_in_out, single_input, rideability}` with `max_excess_dps=0`; needs
  `KAPPA_STEP` retuning (pack data) or a grid/metric change. Consequence:
  `A-CHAIN-GREEN` (fig-08-06, "designed good/green") is unsatisfiable on this
  engine and not hosted; `fig-08-06` bakes at declaration-gate exit 3
  (quality caution). Pinned: `test/property/solver-ext.test.ts`.

- **[04 §4.1a / R6]** 09 §3.5's R6 fixture `R 12 ^90 @34` (R-hand own-lane
  corridor, radii [8.9, 11.6]) is not mirror-equivalent to the book90 L-hand
  fixture and does not solve clean at 34. **needs-decision**: hosted
  `P-CONSTRAINT-BINDING` on the L-hand twin instead; needs the fixture
  respecified. Pinned: `test/property/solver-core.test.ts`.

- **[04 §4.8 / 09 P-ACCEPT-MONOTONE]** "Byte-identical" cannot be literal
  while `acceptance{policy}` is in-hash. **implemented-invariant-first**:
  ratify "identical modulo the acceptance stamp."

- **[04 §5 link_flip_infeasible]** The committed reachability witness needs a
  roll-rate-capped rider (cap 30 dps) — at street rate the scan always
  resolves the zero-gap esses by slowing wherever corner 1 is itself
  solvable. **pinned-engine-truth**.

- **[09 §3.5 chain-fixture hold-window arithmetic]** The engine's roll-in
  anticipation (`0.5·v·t_roll`, containment-forced) shrinks the usable hold
  window below the full gap; the governed slow-down re-enlarges T. The S 18
  full-hold claim lands on the inter-corner hold at governed (~33.7 km/h)
  speed; the S 12 budget-limited witness lands on c1's approach hold.
  **implemented-invariant-first**. Pinned: `test/property/solver-ext.test.ts`
  A-CHAIN-VIS-FULL/BUDGET.

- **[04 §4.7 believed-road / P-MISJUDGE-PREFIX]** Byte-identity is scoped to
  the integration channels: the sight-cast family reads geometry beyond
  `s_div` by design (D4 lookahead), and `f` re-frames at the governing-corner
  handoff. **implemented-invariant-first**: both asserted on their own terms.

- **[review, rev-solver, 12 findings — fixed/adjudicated this cycle]**
  The adversarial solver review (design/04 + D10/D21/D22/D23/D24 against
  `solve/{doubleApex,chained,vis,believed,accept}.ts`) found 12 issues after
  verifying every §4.1a worked number and the core bisection/ranking/touch
  algebra correct. **Corrected from an earlier draft of this document**,
  which claimed no fix package ever ran against these — a `fix-solver` pass
  did run this cycle (in `src/solve/{chained,doubleApex,suggest,solve,
  believed}.ts` + both property test files) and resolved 8 of the 12
  outright, with 2 more confirmed-pin by adjudication. Status per finding:
  (1) `solveDoubleApex`'s `best_failing` path returning lines without
  checking authored constraints — **fixed**: the coarse stage now joins
  constraints and `best_failing` walks retained, self-verified candidates,
  never a violator. (2) chained/vis/doubleApex solvers dropping authored
  plan fragments — **fixed**: `buildChainContext` now typed-refuses authored
  fragments/numeric `turn_in` across all three solvers. (3) vis mode's
  turn-in-before-release — **resolved by `adj-vis` above** (confirmed-pin,
  wide-commitment reading ratified). (4) `solveDoubleApex` never emitting
  `constraint_unmet` — **fixed**, typed and ordered alongside (5)
  `coarse_fine_disagreement` — **fixed**, same change. (6) `chainedSolve`
  returning the fewest-doctrine-fails contained chain, not the design
  letter's "gentlest fully-contained decel" — **still needs-decision**
  (confirmed-pin, not code-fixable without a ranking-law choice; matches the
  `PENDING RATIFICATION` comment at `src/solve/chained.ts:795-797`). (7) the
  `P-ACCEPT-MONOTONE` break via probe short-circuit asymmetry — **fixed**:
  `CandidateSolve` gained `probe_infeasible`; `bestFailingLoop` replays
  clean's exact walk (memoized) so monotonicity holds by construction. (8)
  believed-road byte-identity breaking when the believed road outruns the
  actual — **fixed**: the full believed plan is now restored into the record
  and resealed; `brake_gap` is corner-derived. (9) explicit `corner=`
  bypassing the 120° double-apex qualification — **fixed**: sweep
  qualification is now universal. (10) the undesigned in-hash
  `corrective{shot:null}` arm — **confirmed-pin, ratified** by `adj-corrective`
  above as the unique compliant completion of §4a.6×§4c.4 (design/04 §4a.6
  needs its recorded-shape text amended to match, per that adjudication's
  ratification item). (11) `F-CONSTRAINT-HARD` exercising a swapped road and
  an inverted bound vs. the committed fixture — **fixed**: the fixture was
  respelled to 08 §6(f). (12) chained interior exit-targeting/braking
  replaced by ranking proxies — **still open**: outside `fix-solver`'s
  assigned file grant, not attempted this cycle; genuinely recommend a
  dedicated pass before v0.2. No blessed golden or hash moved as a result of
  findings 1/2/4/5/7/8/9/11 (comment/behavior-preserving fixes verified
  against the existing goldens); figures were re-baked only because a
  sibling render fix (see design/06 below) had left committed artifacts
  stale, not because of any solver-fix finding.

---

## design/05 — Result Contract & Inspection

- **[05 §6.1 "contained"]** `max_time`/`max_dist` guard terminations
  classify as `contained` (the closed five-value set forces a value; the
  guard itself stays recorded in `terminated.reason`), but 05 §6.1 defines
  contained as "reached road end." **implemented-invariant-first**: amend the
  contained definition or add a guard clause. Pinned: `test/contract/wire.test.ts`
  (both reasons); `src/solve/verdict.ts:126-128` comment.

- **[05 §8.3 result_hash formula]** `roll_rate_cap_dps` rides as a third
  top-level hash-payload key (`{verdict, plan, roll_rate_cap_dps}`) — the
  pinned two-member formula is literally unimplementable (a scalar can't ride
  in the plan action array). **implemented-invariant-first**: shape kept as
  implemented; amend §8.3's formula to a named third member. Pinned:
  `src/solve/envelope.ts:88-90` comment.

- **[05 §8.3 emission rounding]** `max_abs_1pm` (misjudgment kappa-gap, 1/m)
  rounds at the letter's 2-dp default, collapsing the in-scope range
  0.01–0.07 1/m to one significant digit. **implemented-invariant-first**
  (conformed to the letter, which is what creates the precision loss):
  recommend §8.3 grow a high-resolution curvature bucket — hash-moving but
  free until first bless. Pinned: `src/solve/emit.ts:21-23` comment.

- **[05 §6.1 physicsOutcome, off_road arm — now fixed]** The `off_road` arm
  was unreachable when any detect/corrective existed, so a feasibly-corrected
  wide excursion followed by a terminal inside-side departure in another
  corner classified `wide` where 05 §6.1 precedence demands `runoff`. —
  **fixed** (was a rev-contract major finding): `physicsOutcome` now
  implements 04 §4a.6's per-corner law, clause-2 runoff checked before wide;
  chain-handoff regression tests added.

- **[05 §7 / envelope, corner_id-less run_wide_detect — now fixed]** Failed
  open to `wide` with zero feasible correctives instead of `runoff`/
  `INTERNAL`. — **fixed**: typed `INTERNAL`/`detect_missing_corner_id`.

- **[verdict.sight.margin_min_m clamp — open, not part of the check-10 seam]**
  Reads the pre-carve-out clamped sight channel and reports a negative
  minimum on every line. **needs-decision** — separate small fix in
  `src/solve/verdict.ts`, flagged by both the WP-10 package ratification and
  the `adj-checks` adjudication notes; not yet resolved.

---

## design/06 — Rendering & Projection

- **[review, rev-render, 4 findings — all fixed this cycle]**
  All four were self-disclosed in `render/topdown.ts` source comments; none
  sanctioned by ARCHITECTURE's phase-gating tables the way `mode=diagram`/
  `width_exag`/`fan` are. **Corrected from an earlier draft of this
  document**, which claimed no fix package ever ran against these — a
  `fix-render` pass did run this cycle (`src/render/**` + new tests in
  `test/render/ink.test.ts`) and fixed all 4, no ratification needed (hazard
  geometry was already reachable from `LineResult` without a solve-side
  change). Most severe first:
  1. **critical, fixed** — stages 7/8 drew `scene.lines` in caller-supplied
     order with no role-based sort, so §3.1 stage 8's "ideal on top"
     invariant wasn't actually enforced by the renderer. Fix: `project.ts`
     now sorts drawn lines by `roleRank` (the same helper `legend.ts`/
     `markers.ts` already used) once, before rotation, so every downstream
     reader sees reference→alternative→mistake→ideal regardless of caller
     order.
  2. **major, fixed** — stage 6's occlusion wash shaded the *entire* road
     polygon instead of only the area beyond the sight ray's limit point,
     inverting the visible/occluded contrast fig-8.1's device depends on.
     Fix: `DrawnScene.occlusionWash` is now a precomputed polygon scoped from
     `s_limit` to the window end; `stageOcclusion` just draws it.
  3. **minor, fixed** — stage 4 (gravel stippled circles) was a complete
     no-op even though gravel hazards are a carried (non-deferred) v0.1
     feature per 03 §4. Fix: new stage 4 draws deterministic stipple-circle
     grids (`GRAVEL_STIPPLE_SPACING_M`/`_RADIUS` in `render/constants.ts`) as
     explicit `<circle>` elements, no RNG.
  4. **minor, fixed** — stage 5 occluder glyphs reused the raw physical
     footprint polygon with only a kind-keyed fill colour, not the four
     distinct schematic glyphs (blob/hatched/contoured/windshield) 06 §3.1
     stage 5 specifies. Fix: `occluderGlyphSvg` now adds kind-differentiated
     overlays (hedge bump circles, wall cross-hatch ticks, bank contour
     polylines, vehicle windshield hint) on top of the unchanged base
     footprint.

  This is the fix responsible for the sharp improvement in the figures'
  re-judge results below — fig-08-02's and fig-08-04's previously
  non-rendering mistake lines and fig-08-06's floating markers all trace to
  finding 1 (role-based draw order), confirmed by the before/after judge
  records rather than asserted. No design-doc amendment needed: the
  renderer's behavior now matches the letter; this was a pure implementation
  gap, not a design-text conflict.

- **[06 §2.1 orient — now fixed]** `render/project.ts` originally accepted
  only numeric `orient`; the CLI hands it the string `"0"`/`"90"`/etc.,
  rejecting every legal `--orient` value SCHEMA/`no_view_mirror` (a WP-15↔
  WP-14 seam bug, D8-flagged `KNOWN-INERT`). **fixed** by WP-17:
  `project.ts` now accepts the canonical numeric-string spellings, required
  by ARCHITECTURE §4's opaque-string view law and by the committed
  fig-08-06 scene (`orient=90`).

---

## design/08 — CLI & Agent Interface

- **[08 §6 recipe (a)/(b)/(f) canonical speed]** Same root cause as
  `adj-feasibility` above: the verbatim commands at entry 55 km/h are
  `NO_SOLUTION`/`empty_band` on the current tuning (confirmed by calling
  `chainedSolve`/`solve` directly, bypassing the CLI; independently
  corroborated by the already-shipped `F-CONSTRAINT-HARD` fixture, whose own
  name documents `R 25 ^90` @55 as a deliberately hard/refusing case). The
  same road solves clean at 40–50 km/h. **needs-decision**: retune the
  physics or amend 08 §6's example speeds. Pinned: `test/cli/recipes.test.ts`
  A-RECIPE-A/B/F (both the verbatim command and a nearby feasible speed, to
  prove the CLI composition itself is not at fault).

- **[08 recipe (j), inherited]** A-RECIPE-J surfaces the `adj-doubleapex`
  seam again (bookDoubleApex refuses `no_two_touch_line`) — not a new
  finding, flagged only because the recipe's test necessarily re-exercises
  it.

- **[08 §4 zero-file plan-channel flags]** `--brake`/`--throttle`/
  `--position`'s placeholder `at_s:0` anchor has no design-specified anchor
  for zero-file plan-channel flags absent prior station context.
  **needs-decision** before these three flags can be considered fully
  faithful to the design bar.

- **[08 §3 render on a bare envelope]** `render` on a bare `envelope.json`
  structurally cannot draw FigureSpec-authored labels — 05's
  LineResult/FigureResult envelope carries no `labels`/`marks` field.
  **needs-decision**: either `FigureResult` grows a labels/marks passthrough,
  or `render`'s contract is amended to also accept the originating
  FigureSpec. (Same root cause noted independently by WP-14's ratification
  on the `project(road,lines,viewSpec)` signature vs. FigureResult.road's
  narrower `RoadModel` typing.)

- **[09 §8.1 D8, --line-id — now fixed]** `--line-id` was parsed but had no
  consumer (accepted-and-ignored, a D8 violation). WP-16 encoded it as a
  `KNOWN-INERT` row so CI would flip red once wired; wiring landed and the
  row is now an ordinary effect row.

---

## design/09 — Verification & Testing

- **[09 §3.2a C30-DR]** 02 §8.2's `R40→R25` clothoid letter has an empty
  clean band at every probed entry/sweep/turn-in on this engine. —
  **pinned-engine-truth**: bless roster rides
  `lane 3.5 | S 10 | R 16>9 ^130 | S 14` @34, `accept=best_failing` (the
  bookDecreasing-shaped taper mirrored to C30's right hand). **needs-decision**:
  02 §8.2 needs a ratified replacement letter.

- **[09 §3.2 G-CORR-WIDE]** Design letter: mirrored `premature` → `wide`,
  `corrective.feasible=true`. Engine: mirrored `premature` is `runoff` with
  corrective infeasible (`departed_before_reaction`); the mirror base solves
  clean only at 32 km/h, not 34. **pinned-engine-truth** — roster records
  engine truth at 32.

- **[09 §3.2 C30-chop]** Design pins outcome `runoff`. Engine bakes `wide` at
  default slew 40 (contained at slew 10). **pinned-engine-truth**.

- **[09 §3.2/09 §4 G-8.4-COMPANION / G-8.5-RED]** Both committed scenes bake
  with all lines refused: fig-08-04 (`bookDecreasing`@34, empty clean band —
  **now superseded**, see below) and fig-08-05 (`no_two_touch_line`, the
  `adj-doubleapex` seam). Goldens pin the refusal skeletons under 05 §7's
  bake-total law; per-line outcome/apex-count/check pins are `it.todo`
  pending seam resolution.
  - **fig-08-04 update**: WP-17's re-bake shows fig-08-04's lines now
    **solve** (the bookDecreasing empty-clean-band seam resolved somewhere
    in the WP-16→WP-17 window) — declaration-gate exit is now **0**, not 3;
    `G-8.4-COMPANION`'s refusal skeleton is obsolete and its `it.todo` pins
    are hostable. Pinned: `test/render/gate.test.ts` PINNED_EXIT (0);
    `test/golden/scenes.test.ts`.
  - fig-08-05 stands at declaration-gate exit 3 (the `adj-doubleapex` seam).

- **[09 §4 A-CATALOGUE-EXERCISED]** Cannot pass over the committed corpus:
  `quick_steer`/`traction_ceiling`/`lean_ceiling` never fail anywhere,
  `hold_wide_for_sight` has zero non-na instances, the chain trio is
  one-sided, `wrong_strategy_for_corner` never fails; needs a
  `lean_ceiling`-fail fixture (also required by `A-DANGER-DWELL`'s second arm
  and the D43 rung-0 witness). **needs-decision**: new roster fixtures + a
  re-bless commit.

- **[09 §4 A-RUBRIC-STAMP]** Perturbed-pack arms unhosted; needs the same
  engine-integrated regrade harness / fixture tranche as the item above.

- **[09 §3.2 G-C30-CHECKVECTOR gloss]** C30's committed check vector carries
  `trail_brake_taper: "na"`; the design gloss ("13–15/11/16 na, the rest
  pass") over-counts by one. **pinned-engine-truth** — committed vector is
  pinned verbatim.

- **[09 §3.2 / 07 §5.3 G-POV-CLAMP-MIDCORNER]** Design's 36.8° presumes
  ~1.34 m inside of centre at mid-corner; this engine's solved book90 line
  sits at ~1.30 m → 37.4° by the same grazing arithmetic.
  **pinned-engine-truth** (±1.5° tolerance, fov 60°/half-frame 30 carried as
  the 07 §5.3 literal).

- **[09 §3.2 tolerances table]** `test/fixtures/tolerances.json` adds a
  `fractions ±0.001` TUNING category absent from 09 §3.2's table (needed
  because 02 §8 pins fraction-valued golden quantities). **implemented-invariant-first**:
  09 §3.2 should grow the row.

- **[09 §3.2a blessed-block roster]** `{C30, C30-chop, C30-trailbrake,
  C30-DR}` implements the **09-owned** write-back sketch; 02 §8.1's caption
  ("every fixture in §8.2") is the non-owning doc's looser gloss.
  **implemented-invariant-first** — 09's letter wins per module ownership.

- **[09 §8.1 T-POS-SHORTFALL]** The solve-merge route refuses every
  post-release placement `NO_SOLUTION`/`authored_action_conflict` (the
  solved turn_in's static commitment span covers the exit straight); fixture
  rides the explicit-plan spelling instead (turn_in 37.5°@5.5, which
  validates and emits `position_shortfall`). **implemented-invariant-first**.

- **[09 §8.1 turn_in.hand]** The mandated witness rides a named harness test
  rather than a table row — the printed schema has no `turn_in.hand` path
  and `T-D8-EXHAUSTIVE` requires rows to cover exactly the printed paths.
  **needs-decision**: either the schema grows the path or the named-test
  hosting is ratified.

- **[09 §3.4 P-MISJUDGE-PREFIX / F-SIGHT-OUTSIDE]** See design/04 entries
  above — same underlying findings, filed under both docs since 09 owns the
  gate and 04 owns the mechanism.

---

## Six baked figures — visual-judge results (figures/*.judge.json)

**Re-judged 2026-07-23 (D36 §7.4 ceremony)** after the `fix-render` pass
(role-based draw order, occlusion-wash scoping, gravel stipple patches,
occluder schematic glyphs — see design/06 below) and the resulting figure
rebake. All six figures **still fail** the visual judge's overall verdict (3
independent judge attempts per figure, majority-vote with flaky-item
tracking), but the failure surface shrank substantially — the missing-line
and floating-marker defects that dominated the previous round are gone; what
remains is the disclosure-note gap plus a handful of marker/label/legibility
misses. This is a separate axis from the declaration-gate exit codes above —
a figure can bake and solve cleanly (exit 0) and still fail the rubric that
checks what the SVG actually shows.

| figure | judge verdict | failing items (majority) | flaky items (non-unanimous split) |
|---|---|---|---|
| fig-08-01 | fail | J2 (no turn-point marker glyph rendered), J6 (no diagram-mode disclosure note) | — |
| fig-08-02 | fail | J6 (no disclosure note) | — |
| fig-08-03 | fail | J2 (marker glyph missing), J6 (no disclosure note) | J3 (labels), J5 (mistake legibility) |
| fig-08-04 | fail | J2 (marker glyph missing), J5 (mistake legibility), J6 (no disclosure note) | J2, J3, J7 |
| fig-08-05 | fail | J1 (colour-verdict), J2 (markers), J3 (labels), J5 (mistake legibility), J6 (disclosure), J8 (legibility floor) — entire lines/marks/labels/note layer absent, only the bare road polygon renders (the `adj-doubleapex` all-lines-refused bake) | J6, J7 |
| fig-08-06 | fail | J6 (no disclosure note) | J3 (labels) |

Since the prior round: fig-08-02's `slow_steer` mistake line and fig-08-04's
`overspeed` mistake line now render correctly (J1/J2/J3/J5 flipped to pass or
mostly-pass on both) — this confirms the `fix-render` role-draw-order fix
(rev-render finding 1, design/06 below) was in fact the root cause, not a
separate bug needing its own investigation. fig-08-06's marker-floating
defect (all ~15–20 glyphs scattered in the grass) is likewise gone (J2 now
passes) — the same fix. fig-08-01's turn-point marker glyph and fig-08-03/04's
label/marker misses are narrower, figure-specific residuals, not the
systemic renderer gap the previous round documented.

Common thread across every remaining judge failure: **J6 (diagram-mode
disclosure note) fails on every figure that reaches it** — none of the six
render any compression/projection disclosure text, though the scenes author
`view: mode=diagram` and 06 §2.7 requires "every diagram-mode figure carries
a standard footnote." This is a rendering gap, not scored elsewhere in this
document — **needs-decision**: implement the disclosure-note draw stage (not
currently in `render/topdown.ts`'s 11-stage draw order at all) before v0.1
figures can be considered book-faithful.

---

## Summary for the design owner

**Needs an actual decision** (11 items, roughly in priority order):
1. C30 entry speed: 70→63 km/h (or retune the tuning) — `adj-feasibility`.
2. Recipe-a/b/f canonical speed: 55→~48 km/h (or retune) — `adj-feasibility`.
3. bookDoubleApex two-touch: reshape the fixture or change the release law —
   `adj-doubleapex`.
4. V2.5 "turn-in at or after release" vs. the wide-commitment reading —
   `adj-vis` (lower-urgency: already has a working implemented reading).
5. `fifty_pence`/`premature_contained` pin-table cells — `adj-corrective`.
6. CHAIN-CLEAN rideability seam (KAPPA_STEP retune or grid change).
7. `chainedSolve`'s "fewest-fails" vs. letter's "gentlest" ranking (rev-solver
   #6 — the other 7 fixable rev-solver findings were fixed this cycle; #10 is
   ratified as-implemented via `adj-corrective`; #12 remains open/unattempted).
8. Rendering: diagram-mode disclosure note is entirely unimplemented (all 6
   figure judges still fail on it post-fix — this is a genuine gap, not
   rev-render #1, which **was fixed** this cycle: role-based draw order is
   now enforced in `project.ts`).
9. C30-DR: 02 §8.2's `R40→R25` letter needs a ratified replacement.
10. `--brake`/`--throttle`/`--position` zero-file anchor semantics.
11. `render` on a bare envelope can't draw labels — FigureResult contract gap.

**Design-text amendments only** (code is correct, ~15 items — see design/02,
03, 05 sections above): ZOH-vs-in-stage-linear, wrapToPi release predicate,
tracker frame signs, transition table completeness, signed
`steering_complete`, brake-taper hold+release shape, `contained` definition,
`result_hash` third member, rounding-bucket growth, and several 09-table
gaps.

**Done this cycle**: the `fix-solver` and `fix-render` passes recommended by
an earlier draft of this document have now run, mirroring the
`fix-core`/`fix-doctrine`/`fix-contract` work — all 4 rev-render findings
fixed; 8 of 12 rev-solver findings fixed, 2 confirmed-pin by adjudication
(#6, #10), 1 resolved by `adj-vis` (#3), 1 still open and unattempted (#12,
chained interior exit-targeting/braking ranking proxies — recommend before
v0.2). See design/04 and design/06 above for the per-finding detail.
