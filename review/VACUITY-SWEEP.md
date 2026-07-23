# Vacuity sweep of `design/09-verification-and-testing.md`

**Dates:** sweep 2026-07-20, adversarial verification + close-out 2026-07-22.
**Scope:** every named gate in `design/09` (`P-*`, `A-*`, `G-*`, `C-*`, `fx-*`, `F-*`,
`J1–J9`, `S-*`) — 255 distinct gate-ids, 349 assessed records.
**Method:** re-derivation from the DSL strings and stated constants, then adversarial
verification. Not from the prose.

A **vacuous gate** is a named test whose fixture does not exercise the predicate it names —
so it passes without testing anything, and would keep passing through the bug it exists to
catch. D46 found three, all in `§3.5`. This sweep asked whether that corner was unlucky or
representative.

**It was representative — but less floridly than a first pass suggested, and the reason why
is itself the headline finding.**

---

## 0. What to trust — two adversarial passes, and what they revealed

This ran in two stages. A **sweep** (2026-07-20) classified all 349 records but its
verification phase died on a spend limit, leaving 81 `VACUOUS` verdicts as single-agent
claims. A **verification pass** (2026-07-22) then re-derived every unverified claim and
attacked each confirmation with independent adversaries on distinct lenses (arithmetic /
quantifier / spec-reading).

The verification pass **overturned 18 of 52 re-checked claims (35%)**, and a follow-up
adversarial recheck of the 14 "decided" claims flipped all 14. That overturn rate is not
noise — it is the finding:

> **For a spec with no engine, a large fraction of "vacuity" verdicts are not robustly
> decidable from the spec. They hinge on (a) the gate's quantifier domain — the shipped
> corpus versus fuzzed/authorable roads — and (b) implementation choices the spec leaves
> open (raw vs resampled samples, a column stored-by-formula vs independently integrated).
> Two competent adversarial passes disagreed on ~⅓ of contested gates.**

So the results are **tiered by how they were reached**, and you should weight them
accordingly:

| tier | how established | count (of the 33) | trust |
|---|---|---|---|
| **A — hand-derived** | re-derived by the orchestrator directly, in `fixture_geometry.py` | 5 | highest |
| **B — adversarially survived** | survived 3-lens refutation *or* re-derive+adversary | 28 | high |

Everything the sweep called vacuous that did **not** survive is in the **retractions**
(§3) — and there are as many of those as there are survivors. The genuinely robust
findings are the ones grounded in **geometry or arithmetic that no implementation choice can
change**; the contested property-tautologies are demoted to `UNDETERMINED` with the
measurement that would settle each.

Two gaps remain, both flagged: the full four-corner `fx-esses-blind` chain is reconstructed
only for c1 standalone, and the **six book-figure scenes (fig 8.1–8.6) are genuinely
undefined in `design/`** (path strings only) — a fixture-layer gap surfaced by the
completeness critic (§4).

---

## 1. Headline

| | |
|---|---|
| Gate records assessed | 349 (255 distinct ids; completeness critic confirms **0 unassessed**) |
| EXERCISED | 175 |
| **VACUOUS / UNSATISFIABLE (adversarially retained)** | **33** (30 + 3) |
| UNDETERMINED (incl. contested, implementation-contingent) | 67 |
| NOT ASSESSABLE from `design/` | 34 |
| Retracted / demoted by verification (sweep over-calls) | 48 |

**The single most consequential finding is the mirror of vacuity:** `A-AN-BRAKE` and
`A-AN-RK4`, two of the five gates in the analytic-acceptance layer that gates the *first
bless*, state closed forms that **cannot be satisfied by any correct engine** (they omit the
default command slew). Under repair pressure an unsatisfiable gate decays into a vacuous one.
See §2.1.

**The scariest candidates were over-calls.** The sweep flagged the **D8 effectuality
harness** (the meta-gate that proves other tests are effectual) and all three **phase gates**
as vacuous; adversarial verification cleared every one. Do not act on those — see §3.

---

## 2. The VACUOUS list, ranked by consequence

Tier letter (A/B/C, per §0) in brackets. Grouped by *why* it is vacuous, because the repair
differs by cause.

### 2.1 `A-AN-BRAKE` / `A-AN-RK4` — the bless gate cannot pass · **SHIPPED-V1** · [A]

`A-AN-BRAKE`: on `F-AN-BRAKE` (`lane 8 | S 400`, entry 100 km/h, `brake decel=3.0` at
`at_s=50`), asserts `s* = 177.93 m` to ±0.01 m and `v(t)=v₀−3.0t` to ≤1e-9. `A-AN-RK4`: on
`F-AN-ACCEL`, asserts `v(t)=10+2t` etc. to ≤1e-9. **Both omit `A_SLEW_DEFAULT = 6.0 m/s³`**
(`02 §3`, `03 §6.1`): the commanded level is slew-limited, so `v` is quadratic during the
ramp, not linear.

`fixture_geometry.py` check 6 (run): stated `s*` 177.9342 vs slewed 184.8474 m — **error
6.91 m = 691× the ±0.01 tolerance**; `v(t)` limb wrong in form by **2.0e7×**; `A-AN-RK4` by
**3.2e7×**. These are exactly the two `A-AN-*` entries with a nonzero longitudinal command —
a systematic omission, not a slip. The bless script *mechanically refuses* unless `A-AN-*` is
green (`09 §3.2a`), so at implementation the tolerance gets widened until the numbers
reconcile — and a tolerance absorbing 3e-2 relative absorbs the stage-weight wiring bug
`A-AN-RK4` exists to catch. **Repair (spec edit):** author `slew_mss: 100` on both plans, or
restate the closed forms with the ramp term.

### 2.2 `A-SSD-GOVERNOR` — the speed governor is unwitnessed · **SHIPPED-V1** · [A]

D46 reshaped `bookBlind` to `^140` @ 34 km/h to make `blind(c1)` true — but "blind" and "the
V1 governor binds" are different predicates. Check 7 (run, lean-aware `ssd` per `03 §5.2`):
min sight 25.00 m vs `1.0·ssd` 16.91 m → **48% headroom; the governor first binds at
`vis_margin ≥ 1.378`.** With it inert, governed = unfettered and the `≤` assertion holds by
equality. The entire stop-within-sight speed governor — "never ride faster than you can stop
within what you can see" — has no witness in the suite. **Repair:** pin `vis_margin ≥ 1.4`
*then* strengthen `≤` to `<`; `09`'s obligation (b) applied alone converts a silent pass to a
silent failure.

### 2.3 `fx-esses-blind` — recorded diagnosis wrong in *kind* · **SHIPPED-V1** · [A]

`09 §3.5` records `blind(c)` false on all four corners, zero blind cells. But `bookEsses`
alternates hands and `03:219` pins that `hand=` does not flip the traffic side — so on its
*right*-handers the `inside` band sits on the rider's own side. Check 8 (run, c1 standalone):
the mirrored right-hander has **6/220 blind cells, min s_limit 22.25 vs s_end 23.71**, all on
the *cut-in* line — the same applicability inversion as D46 exemplar 1. The prescribed repair
(mint a new ≥130° fixture) does not address it. *(The full four-corner chain — the sweep's
45/220-per-corner figure — remains reconstructed only for c1.)*

### 2.4 `A-CHAIN-VIS-FULL` / `A-CHAIN-VIS-BUDGET` — the only chained-visibility gates, no-op · **SHIPPED-V1** · [B]

These are the sole coverage of D10's V1/V2 composition across a linked sequence.
`A-CHAIN-VIS-BUDGET` runs on the zero-gap `bookEsses` variant whose inter-corner spans are
**0 m** — so `T_cmd = 0`, `dd_max` collapses below `MIN_POS_DD_M`, no hold is emitted, and
the "monotone across each span" universal is over the empty set. `A-CHAIN-VIS-FULL`'s three
clauses are each independently no-op on `fx-esses-blind`: V1 inert (min sight 17.25 m vs ssd
15.47 → 11% headroom), the hold band `f ≥ 0.85` satisfied by a line that never leaves
`start.f = 1.0`. **Repair:** re-home the budget gate; pin `vis_margin ≥ 1.2` on the full gate.

### 2.5 `Bless-script refusal` + `Development-phase clause` — the bless certifies nothing about the solver · **SHIPPED-V1** · [B]

`09 §3.2a` promises the analytic-acceptance layer is what makes the first bless mean
something. But re-derivation confirms **all five `A-AN-*` fixtures carry authored plans
(`use_full_width`, `d=0`) that invoke the solver zero times** — no corridor, lane-fraction,
turn-in or apex search runs. The green-gate that precedes first bless therefore delegates to
a layer that never touches the solver, and the "exit 3 unless green" refusal is prose only
(no named test, no negative arm). A solver that produces a systematically wrong line passes
the v0.1 phase exit. **Repair:** add ≥1 closed-form *solver* assertion to §3.2a (e.g. on C30,
assert the apex station a correct bisection lands on, not a solver constant read back to
itself); give the refusal a named test with a negative arm.

### 2.6 `P-VIS-BOUNDED` — two typed refusals with no reachable witness · **SHIPPED-V1** · [B]

Bound is `vis_max_iterations = 4`; expected iteration count on every named fixture is 1.
Both typed refusals in the closed `04 §4.10` registry are unreachable at default knobs
(`vis_speed_below_model_floor` needs `vis_margin > 10.94`). `09 §8`'s own no-dead-error-names
rule forbids this. **Repair:** a committed fixture per refusal (the floor one is a one-liner
at `vis_margin=12`).

### 2.7 `P-ACCEPT-CONSTRAINT` — empty domain · **SHIPPED-V1** · [B]

Quantifies over {returned under `accept=best_failing`} ∩ {source carries an authored
constraint}. R6 is the corpus's only constraint-carrying fixture and it is assigned to
`P-CONSTRAINT-BINDING`; no fixture pairs a constraint with `best_failing`. `best_failing` is
exactly where a near-miss (constraint-violating) line surfaces. **Repair:** name R6 under
`accept=best_failing` (a natural best-failing case). *(Note: the completeness critic found
"R6 fixture family" is not undefined but **double-defined** — see §4.)*

### 2.8 `G-POS-REACH` — asserts a bound 8× above the physical ceiling · **SHIPPED-V1** · [B-3lens]

On `FX-POS-STRAIGHT` asserts achieved displacement ≥ `dd_max/K_REACH = 21.89 m` against a
2.70 m corridor and 1.89 m requested move — **8.1× the physical ceiling** (12× at 28 km/h).
Trivially *un*satisfiable; the natural rewrite (`achieved ≥ requested`) is itself
near-vacuous. On the position channel the whole hold-wide doctrine depends on. **Repair:**
restate as the soundness link: requested `Δd ≤ dd_max` **and** achieved ≥ requested − ε.

### 2.9 `P-RUNWIDE-UPRIGHT` — evaluated where the term is zero by construction · **SHIPPED-V1** · [B-3lens]

On `F-AN-BRAKE`/`F-AN-ACCEL` (φ=0), the stand-up term `phi_dot_su = −sign(φ)·[…]·tanh(0/5)`
is **0 identically** — killed by its tanh envelope, so the assertion holds for any slice
implementation, including one that deleted the slice. The only gate bounding the slice's
contribution outside the leaned regime. **Repair:** an analytic fixture at sustained |φ|=1.9°
(envelope 0.36), asserting path deviation ≤ `eps_m = 0.05`.

### 2.10 `A-LABEL-ANCHORS` / `A-LEGEND-AMBER` — the label/legend grammar's only gates, empty · **SHIPPED-V1** · [B]

`A-LABEL-ANCHORS` asserts the fig 8.1/8.3/8.4/8.5 label sets resolve — a universal over an
empty set: `rg 'labels:'` returns only two format examples, no committed rosters. It is the
only acceptance test on the label/anchor grammar (a closed vocabulary with typed failures
`UNKNOWN_ID`/`anchor_not_found`). `A-LEGEND-AMBER` names no fixture and no committed scene
pairs a contained-mistake line with a caution alternative — amber's two D9 meanings are never
both present. **Repair:** commit the label rosters and an amber-bearing fixture. *(Both are
downstream of the undefined book-figure scenes — §4.)*

### 2.11 More confirmed vacuous, in brief (all [B] unless noted)

- **`A-RUBRIC-STAMP`** [B-3lens] — determinism asserted only under an *unchanged* pack;
  satisfied by an engine that ignores the rubric. `result_hash` is the identity primitive the
  golden suite keys on. *Add:* two packs differing in a hash-bearing field must differ.
- **`G-COMMIT-PREMATURE`** [B-3lens] — pins the commitment discriminator `k_refuted` on
  `book90`, which has **no occluder** (`s_L = 46.85 m = road end`); the premature-vs-good
  contrast is a strict inequality between two zeros. *Re-home* onto an occluder-bearing scene.
- **`C30-heldbrake`** [A] — over a full `f₀×onset-lean` sweep the brake-caused *outward*
  excursion is **exactly 0.0000** at every cell (the line moves inward, terminates off_road).
  The only committed fixture pinning the sustained-hold half of the run-wide doctrine. *Author
  as an explicit plan inside the clipped-widening regime.*
- **`P-MISJUDGE-PREFIX`** — on the only misjudge fixture (`F-BELIEVED-90`) the asserted
  byte-identical prefix contains zero curved stations (believed/actual roads differ from the
  corner onward). Underwrites `s_divergence_m`/`kappa_gap`. *Add* a fixture that agrees
  through one corner and diverges at a later one.
- **`P-SAVEWIN-REFUSES`** — antecedent `transition_count>1` comes only from `intermittent`,
  whose fixture `G-SAVEWIN-INTERMITTENT` is explicitly **unbuilt** (`09:380`). *Block D44
  promotion on it, or restate existentially with a witness.*
- **`P-STANDING-RUBRIC-SENSITIVE`** — a possibility-claim ("results *may* change") that is a
  tautology; the only gate asserting standing reads the rubric at all. *Restate with a named
  variant pack and stated delta.*
- **`C-SKEW-DETECT` / `C-SKEW-CLEAN`** — the `detail` tier (numbers-moved, story-held) is
  masked on the described one-stamp fixture; the clean twin is a spec-forced equality. *Specify
  four stamped lines, one per tier.*
- **`C-ONE-CORE`** — spec-self-conceded tautology (`09:1739`: "the same ESM module imported
  twice"). *Convert to a bundle-graph lint.*
- **`effect_class "analysis" detector`** — `effectAt` deep-inequality flags the
  `reserve_checks`/`rubric`/`checks_version` fields the wire shape marks "echoed, never
  re-derived", so any recompute trips it. *Diff the document minus its declared-echo fields.*
- **`T-COLDSTART-RECORD`** — reads only `schema_output_hash`, invariant under the cold-start
  pass-rate it is supposed to guard; a 3/3→0/3 regression with unchanged schema text is missed.
- **`A-FIG82-SINGLEMARK`** [B, UNSAT] — asserts the collapsed glyph is RED, but `06:376` makes
  it the topmost (ideal, GREEN) line's colour and the companion golden `09:1651` agrees GREEN —
  the assertion **contradicts the colour law** and is unsatisfiable as written, on an undefined
  scene. *Fix the asserted colour and pin the fig-8.2 scene roster.*
- **The projection family `P-PROJ-CROSS` / `P-PROJ-IDENTITY` / `P-PROJ-ORDER,SIDE,APEX-REL`**
  — **5 of the 8 `§5.1` projection invariants are algebraic identities** of the
  positively-scaled, monotone-in-station transform, proven in `06`'s own prose before `09`
  names them as tests (`s'` monotone because `c>0`; `sign(d')=sign(d)` because
  `width_exag>0`). Worthwhile as XY-space regression guards, but as written they restate the
  spec. `P-PROJ-IDENTITY` also hides a real spec hole (precedence of `mode:"true"` vs an
  explicit window). *Keep as regression tests but say so; add properties over parameter
  selection.*

### 2.12 Deferred surface (D45 continuation envelope) · lower consequence

- **`A-AN-TRUNCATE`** [B-3lens] — limb (iii) checks the taper split; fixture `R 30 ^270` has
  **no taper token**. *Add `bookDecreasing`'s road.*
- **`P-CONT-TIGHTENING-ADMISSIBLE`** [B-3lens] — the σ=+1 rung is pinned at `κ_max` by
  construction (corpus max `|κ_L| = 0.111 < 0.143`), so the existential is witnessed
  unconditionally. *Re-home onto r ≤ 7.8 m and strengthen to "the tightening member survives
  the filter."*
- **`S-CONT-SEPARATION-v2` step 1** [B] — the spike meant to terminate the whole D45 effort
  has an **empty failure domain** on its only fixture (`bookBlind` max s_limit 41.00 vs s_end
  45.32 — 4.32 m margin at all 10 cells). D46 retired the original spike as undecidable; the
  replacement inherits the flaw. *Run step 1 on all three step-2 fixtures.*
- **`C-SAVEWIN-NO-INK`** (v0.1 sentinel) [B] — the save-window verb ships in v0.2; the v0.1
  instance is disclosed-inert. Low harm, list inflation only.
- **`fx-hedge-gap`** → **four continuation gates blocked** (`P-CONT-FILTER-TWO-SIDED`,
  `P-CONT-CONSISTENT`, `P-CONT-MONOTONE-SIGHT`, half of `G-COMMIT-GRID`) — the fixture is
  unconstructible as specified (design-acknowledged, `09:981`). Check 13 confirms: the base is
  total occlusion (filter vacuous), a shortened span never threads, but an **entrance gap
  does** (road re-emerges 53.5–61.0 m while blind holds) — so the repair is real. *Author the
  two-segment entrance geometry.*

---

## 3. Retractions — what the sweep over-called (and why)

Adversarial verification demoted **32 gates the sweep had called vacuous**. This is the
correction that matters most: acting on the raw sweep would have chased dozens of phantom
defects. The two headline reversals:

- **`D8-HARNESS-effectAt` (the effectuality harness) — EXERCISED.** The meta-gate that proves
  other tests are effectual is *not* itself vacuous; its witness rows (`turn_in.hand`,
  `vis_margin`) genuinely mutate recorded outputs.
- **All three `PHASE-GATE-v0.1/0.2/0.3` — EXERCISED.** A vacuous phase gate would ship a whole
  phase; none is.

The full demotion list (32), with why the sweep over-called:

| gate | sweep said | now | why the sweep over-called |
|---|---|---|---|
| `A-AN-ROLL` | VACUOUS | **UNDETERMINED** (contested (single-agent flip, no tiebreak)) | sweep said VACUOUS; single-agent recheck said EXERCISED; no adversarial tiebreak. Verdict hinges on quantifier domain (fuzzed vs corpus) or unpinned implementation. |
| `A-FAN-NO-ENGINE` | VACUOUS | **UNDETERMINED** (contested (single-agent flip, no tiebreak)) | sweep said VACUOUS; single-agent recheck said EXERCISED; no adversarial tiebreak. Verdict hinges on quantifier domain (fuzzed vs corpus) or unpinned implementation. |
| `A-FIG81-ENDPOINT` | VACUOUS | **EXERCISED** (re-derive+adversary overturned) | Re-derived on the verifier's own book90(L)+premature construction with a finer turn-in sweep (/tmp/fig81_contingency.py). Conjunct (a) 'arrowhead on the outer road edge' is NOT an invariant restatement — its truth is contingent on fixture geometry. At turn-in… |
| `A-FIGURE-JSON-PARITY` | VACUOUS | **UNDETERMINED** (contested (single-agent flip, no tiebreak)) | sweep said VACUOUS; single-agent recheck said EXERCISED; no adversarial tiebreak. Verdict hinges on quantifier domain (fuzzed vs corpus) or unpinned implementation. |
| `A-PACK-PROVENANCE` | VACUOUS | **EXERCISED** (re-derive+adversary overturned) | OVERTURNED. The verifier's pivot -- 'the ^book: branch is never reached' and 'limb (b) quantifies over the empty set on both roots' -- is false on the rubric root. A-PACK-PROVENANCE (09:1527-1538, 01:957-960) asserts over 'every committed pack under plan/doct… |
| `A-RECIPE-H` | VACUOUS | **UNDETERMINED** (contested (single-agent flip, no tiebreak)) | sweep said VACUOUS; single-agent recheck said EXERCISED; no adversarial tiebreak. Verdict hinges on quantifier domain (fuzzed vs corpus) or unpinned implementation. |
| `A-SAVEWIN-PLACARD` | VACUOUS | **UNDETERMINED** (contested (single-agent flip, no tiebreak)) | sweep said VACUOUS; single-agent recheck said EXERCISED; no adversarial tiebreak. Verdict hinges on quantifier domain (fuzzed vs corpus) or unpinned implementation. |
| `C-COMPARE` | VACUOUS | **EXERCISED** (re-derive+adversary overturned) | The verifier's load-bearing evidence — 'on 04 §7's scene the wide line is byte-identical to good for its ENTIRE length ... A leak between good and wide is invisible at every sample' — is FALSE. As derived for C-SCENE-MULTIRIDE, vis=cautious's V2 rule (04 §6) … |
| `C-POV-LOOK` | VACUOUS | **EXERCISED** (re-derive+adversary overturned) | The verifier refuted only HALF of limb (a). Limb (a) asserts TWO things (09:1700): 'markerState = placed AND yaw equals the camera law's worked value.' The verifier correctly showed markerState='placed' is forced (\|bearing-psi\|=36.10 deg < LOOK_MAX_DEG=70, … |
| `C-REFUSAL-ENVELOPE` | VACUOUS | **EXERCISED** (re-derive+adversary overturned) | The verifier mis-swept the quantifier exactly as the brief warns. Its sweep held vis_margin fixed at 1.0 across shipped fixtures, but vis_margin is an AUTHORABLE ride-spec knob (04 §6, D10 — 'authorable knobs...fields on the ride spec with TUNING defaults'), … |
| `C-SCENE-MULTIRIDE` | VACUOUS | **EXERCISED** (re-derive+adversary overturned) | The verifier reduced vis=cautious to the V1 speed governor and missed V2. 04 §6 states vis=cautious switches on TWO solver rules. V2 ('hold wide until release') fires 'for each BLIND corner' INDEPENDENT of whether V1 binds: it (i) emits an ordinary generated … |
| `C-STATEAT-LAWS` | VACUOUS | **EXERCISED** (re-derive+adversary overturned) | The verifier scoped 'reachable' to the shipped ROAD corpus (max cumulative psi 180), but the angle rule (limb c) is a pure INTERPOLATION-FUNCTION law. 05 §3.2 defines it on the abstract sample array with its own canonical wrap example: 'Shortest-arc lerp in d… |
| `D8-HARNESS-effectAt (§8.1, unnamed mechanism)` | VACUOUS | **EXERCISED** (re-derive+adversary overturned) | The re-derivation is wrong: it measures D8 against an obligation D8 does not state. D8's operationalized obligation (09:1908) is that every schema-accepted field has a witness proving 'an observable effect, or a typed rejection' — FIELD-effectuality (exists a… |
| `G-SAVEWIN-WIDE` | VACUOUS | **UNDETERMINED** (contested (single-agent flip, no tiebreak)) | sweep said VACUOUS; single-agent recheck said EXERCISED; no adversarial tiebreak. Verdict hinges on quantifier domain (fuzzed vs corpus) or unpinned implementation. |
| `P-AWIDEN-SIGN` | VACUOUS | **UNDETERMINED** (contested (single-agent flip, no tiebreak)) | sweep said VACUOUS; single-agent recheck said EXERCISED; no adversarial tiebreak. Verdict hinges on quantifier domain (fuzzed vs corpus) or unpinned implementation. |
| `P-COMMIT-MEMBER-DEPENDENT` | VACUOUS | **NOT_ASSESSABLE** (reclassified) |  |
| `P-CONT-ENVELOPE-CONTAINS-ACTUAL` | VACUOUS | **EXERCISED** (reclassified) | EXERCISED over its fuzzed-road domain: quantifier critic Q6 shows the fig-8.4 teardrop R30>9^210 breaches the rate leg (0.00786 vs 0.005), so the gate fires. Magnitude leg still needs fuzzer to reach R<7. |
| `P-EMERGENT-APEX` | VACUOUS | **UNDETERMINED** (contested (single-agent flip, no tiebreak)) | sweep said VACUOUS; single-agent recheck said EXERCISED; no adversarial tiebreak. Verdict hinges on quantifier domain (fuzzed vs corpus) or unpinned implementation. |
| `P-ESCAPE-HONEST` | VACUOUS | **EXERCISED** (re-derive+adversary overturned) | The verifier misidentified what P-ESCAPE-HONEST asserts. Its literal assertion (design 09:927-931, templated on P-CORR-SHADOW-HONEST 09:559 and P-SAVEWIN-SHADOW-HONEST 09:688) is: E_c's runs obey P-ELLIPSE, P-ROLLRATE, and the closed termination vocabulary, P… |
| `P-KAPPA` | VACUOUS | **UNDETERMINED** (contested (single-agent flip, no tiebreak)) | sweep said VACUOUS; single-agent recheck said EXERCISED; no adversarial tiebreak. Verdict hinges on quantifier domain (fuzzed vs corpus) or unpinned implementation. |
| `P-SAVEWIN-BRACKET` | VACUOUS | **EXERCISED** (re-derive+adversary overturned) | OVERTURNED. The verifier conflates a finite-precision self-check with a vacuous one. Its own arithmetic (which I reproduced: final_bracket <= EPS=0.02s across 5..200 km/h, max exactly 0.02) shows the false-side probe sits at tau_close+EPS. But EPS is the TEST… |
| `P-SAVEWIN-HORIZON` | VACUOUS | **EXERCISED** (re-derive+adversary overturned) | OVERTURNED on a spec-misread plus a missed failure mode. The verifier reads the inequality as using the implementation's own s_detect ('a shadow-derived s_detect also satisfies s* >= max(s_detect_shadow, s(tau))'), but 09:646 pins the assertion's s_detect to … |
| `P-SIGHT-BASIS` | VACUOUS | **EXERCISED** (re-derive+adversary overturned) | OVERTURNED on a missed clause. The verifier analyzed only the first conjunct ('on any straight with d=0, sight_ride_m = sight_m') and correctly found the ratio is identically 1 on straights -- but the assertion has a second, load-bearing clause it ignored: '.… |
| `P-UNWIND-NOCROSS` | VACUOUS | **UNDETERMINED** (contested (single-agent flip, no tiebreak)) | sweep said VACUOUS; single-agent recheck said EXERCISED; no adversarial tiebreak. Verdict hinges on quantifier domain (fuzzed vs corpus) or unpinned implementation. |
| `T-JUDGE-RECORD` | VACUOUS | **EXERCISED** (re-derive+adversary overturned) | By the task's own definition a vacuous gate 'passes without testing anything.' T-JUDGE-RECORD (L1880-82) names three falsifiable predicates — record existence, spec_hash/result_hash freshness against the CURRENT figure, and judge-identity match — every one of… |
| `T-POS-SHORTFALL` | VACUOUS | **EXERCISED** (re-derive+adversary overturned) | The re-derivation is wrong. The gate asserts 'emits position_shortfall with deficit_m>0', and per 03:703-706 / 03:761-764 the position_shortfall event IS the anti-silence backstop ('a miss is typed and recorded, never silent'; 'the honesty backstop is the run… |
| `turn_in.hand witness row (§8.1, unnamed)` | VACUOUS | **EXERCISED** (re-derive+adversary overturned) | The re-derivation misreads the mechanization. The harness is differential (09:1939 'assert an observable difference') and the row's own text (09:1993) explicitly forbids 'never silently neutral'. Read faithfully, 'flipping an explicit hand ... changes the tra… |
| `vis_margin witness row (§8.1, unnamed)` | VACUOUS | **EXERCISED** (re-derive+adversary overturned) | The re-derivation is wrong on the row's obligation. The row's named predicate (09:1993-94) is 'vis_margin observably changes the solved line under vis=cautious, and is rejected INEFFECTUAL under vis=none' — field-effectuality, not default-effectuality. Under … |
| `§5.2 AUDIT-MODE RE-DERIVATION` | VACUOUS | **UNDETERMINED** (contested (single-agent flip, no tiebreak)) | sweep VACUOUS; recheck EXERCISED; no tiebreak; implementation-contingent (renderer audit mode). |
| `§5.2 PROPORTION GATE — straight_share` | VACUOUS | **EXERCISED** (reclassified) | regression guard: a C_STRAIGHT remap regression raises book90 to 0.598>0.45 and the gate fires (quantifier Q7). Headroom in the passing case is not vacuity. |
| `§7.1 judge-identity validity rule` | VACUOUS | **EXERCISED** (re-derive+adversary overturned) | The rule 'any other identity is invalid' is exercised: T-JUDGE-RECORD rejects a record whose judge_model / judge_model_version / rubric_version differ from judge.json — three real, falsifiable identity dimensions — so it does not 'pass without testing anythin… |
| `§7.4 flake policy (3 attempts, 2-of-3 majority,…` | VACUOUS | **EXERCISED** (re-derive+adversary overturned) | The re-derivation's central quantity — flake firing rate '~0 independent of rubric quality' — is wrong. It rests on modeling temperature:0 vision-judge inference as a strict point mass (entropy exactly 0). Real vision-model serving is not bit-reproducible at … |

**The systematic over-call pattern.** Most retractions are one of two errors: (1) the
**circular-test fallacy** — "no implementation computing X by its own definition can fail
this," when the test exists to verify the implementation *matches* the definition and a naive
one fails it (`P-SAVEWIN-BRACKET`, `P-SAVEWIN-HORIZON`, `P-SIGHT-BASIS`, `C-STATEAT-LAWS`);
and (2) **assuming the shipped corpus** for a gate that quantifies over **fuzzed/authorable
roads** (`P-CONT-ENVELOPE-CONTAINS-ACTUAL`, the `straight_share` proportion gate). The
"contested" demotions are gates where the two passes disagreed and the verdict hinges on an
unpinned implementation choice — see §5.

---

## 4. Systematic patterns

**P1 — The real gap is one layer down: undefined fixtures/scenes** (completeness critic;
coverage at the gate-id level is complete, 255/255). The load-bearing finding:

- **The six book-figure scenes (fig 8.1–8.6) are genuinely undefined** — `design/` holds only
  CLI path strings (`figures/fig-08-01.scene`), no FigureSpec DSL, no scene file in the repo.
  This blocks 15+ gates (`A-FIG81-*`, `A-FIG82-*`, `A-FIG83-*`, `A-LABEL-ANCHORS`,
  `A-ESSES-GATE`, `A-RECIPE-E/H`, `C-SAVEWIN-NO-INK`), `J5`, `J9`, and the entire v0.1
  phase-exit ("all six book-figure scenes bake").
- **"R6 fixture family" is double-defined**, not undefined: `P-CONSTRAINT-BINDING` uses `04 §5`
  R6 (`R 12 ^90` @34), `A-RECIPE-F` uses `08 §6(f)` (`R 25 ^90` @55) — same name, two
  incompatible roads.
- Further unconstructed referents: `fx-hedge-gap`, `F-SIGHT-OUTSIDE` (a pinned counterexample
  with no geometry), `G-SIGHT-BASIS`'s R12 fixture, the zero-gap `bookEsses` variant, the
  `lean_ceiling`-fail fixture, `C30-DR` (blessed row, no DSL), and **17 gates that name no
  fixture at all**.

This is distinct from vacuity proper: a vacuous gate *runs and passes* through its bug; an
undefined-fixture gate *cannot run yet*. The former is dangerous (silent), the latter is a
spec-completeness debt (loud). Both need authoring; only the first can hide a regression.

**P2 — Assertion forms structurally hard to fail.** `≤`/`≥` where equality is expected
(`A-SSD-GOVERNOR`); "passes validation" as a field-presence check (`A-RUBRIC-STAMP`);
"converges within N" where N=4 and the expected count is 1 (`P-VIS-BOUNDED`); "is
deterministic" under *unchanged* input (`A-RUBRIC-STAMP`, `C-SKEW-CLEAN`); possibility-claims
that are tautologies (`P-STANDING-RUBRIC-SENSITIVE`). **But note the mirror error:** a budget
with headroom is *not* vacuous if a plausible regression breaches it — `straight_share`
(0.229 vs 0.45) is a working regression guard because a `C_STRAIGHT` remap regression raises
`book90` to 0.598. Distinguish "has headroom" from "cannot fire."

**P3 — Universals over empty domains** (the D46-exemplar-3 shape): `A-AN-TRUNCATE` (no taper),
`A-CHAIN-VIS-BUDGET` (0 m spans), `G-COMMIT-PREMATURE` (no occluder), `P-ACCEPT-CONSTRAINT`
(no constraint×best_failing fixture), `A-LABEL-ANCHORS` (no rosters), `S-CONT-SEPARATION-v2`
(empty failure domain). *Diagnostic: how many elements does the quantified set have on the
named fixture?*

**P4 — Two new D46-class quantifier defects** (quantifier critic — universals true of the
shipped config, false over the quantified space):

- **Q1/Q2** — the claim "no 90° corner is blind on the hold-wide line at any legal margin"
  (`09 L757`, `01 L538`, `00-README L463`) is **overstated**. Sweeping turn-in down to
  entry−7 (the sweep floored at entry−4), the hold-wide line is blind at the wide band edge —
  `fixture_geometry.py` check 1 now shows **blind by up to 1.20 m at R=12.7, margin=0,
  turn-in=5 m**, inside the design's own r-sample. The 140° reshape is unaffected (blind at
  *all* turn-ins ≤ 20.5 m); the **justification prose is what is wrong**. This corrects the
  prior harness, which asserted the overstated universal.
- **Q3** — the `R_res/R_road ∈ [0.65, 0.90]` band, claimed over "every shipped preset except
  bookDecreasing," is **false over its own quantifier**: the proving table omits
  `bookDoubleApex`, whose c2 (R24) leg = **0.347**. Benign safety direction; fix the band.

**P5 — Every shipped preset is a left-hander**, which is why side-dependent predicates
(`fx-esses-blind`) were untested in one configuration, and why the reconstruction had to gain
`road(hand='R')` / `hedge_polygon(side=+1)`.

**P6 — The unsatisfiable mirror.** `A-AN-BRAKE`, `A-AN-RK4`, `G-POS-REACH` (and
`A-SSD-GOVERNOR` if obligation (b) is applied alone) are impossible, not vacuous — and an
impossible gate decays into a vacuous one under repair pressure.

---

## 5. Contested / implementation-contingent — `UNDETERMINED`, with the deciding measurement

These the sweep called vacuous and the recheck called exercised, with **no adversarial
tiebreak** — because the verdict genuinely depends on something `design/` does not pin. This
is the honest resting state; each names what would settle it.

- **`P-KAPPA` / `P-AWIDEN-SIGN`** — vacuous (algebraic identity) **iff** `kappa` is the `05:75`
  formula-column computed from recorded φ,v and the property runs on **raw** samples; exercised
  iff it runs on **resampled** samples or an independently-integrated column. *Measure: does the
  engine store `kappa` via `g·tan(φ)/v²`, and does the property iterate raw or resampled arrays?*
- **`P-UNWIND-NOCROSS`** — the "never steers past upright" limb is exercised iff the integrator
  can overshoot past the 0.25° done-band. *Measure: can the tracker overshoot at the fixed dt?*
- **`P-EMERGENT-APEX`** — the schema-rejection half is clearly exercised; the "apex responds
  only to physics inputs" half is solver-dependent. *Measure: solver apex sensitivity.*
- **`A-AN-ROLL`, `G-SAVEWIN-WIDE`, `A-RECIPE-H`, `A-SAVEWIN-PLACARD`, `A-FIGURE-JSON-PARITY`,
  `A-FAN-NO-ENGINE`, `§5.2 audit-mode`** — recheck gave regime-reached derivations, but each
  turns on a fixture-specification or renderer detail `design/` leaves open. Classified
  `UNDETERMINED` pending the fixture roster or the implementation choice.
- **`P-CONT-ENVELOPE-CONTAINS-ACTUAL` → EXERCISED** (accepted): corroborated independently by
  quantifier Q6 — the fig-8.4 teardrop `R 30>9 ^210` breaches the rate leg (0.00786 > 0.005),
  so the gate fires over its fuzzed-road domain. (Magnitude leg still needs the fuzzer to reach
  R<7.)

---

## 6. Additions to `review/verify/fixture_geometry.py`

Additive and green (exit 0, "all assertions hold"). Following the file's convention, a
**defect is stated as a PASSING check** — a green run is the evidence the regime is unreached.

| check | proves | verdict |
|---|---|---|
| **1 (corrected)** | Q1/Q2 turn-in-floor fix: hold-wide blind by 1.20 m at early turn-in; not blind at doctrinal | corrects a prior over-claim |
| **6** analytic-layer slew | `A-AN-BRAKE` 691×, `A-AN-RK4` 3.2e7× over tolerance | vacuity finding |
| **7** SSD governor | inert on reshaped bookBlind (38–48% headroom); binds at `vis_margin ≥ 1.378` | vacuity finding |
| **8** right-hand inside band | 75° left 0/220 blind, right 6/220 — the inversion | vacuity finding |
| **9** tightening identity | σ=+1 rung margin +0.0317; discriminates only at r ≤ 7.8 m | vacuity finding |
| **10** C30-DR taper | dk/ds 0.000917 vs 0.005 bound — design number **CORRECT** | confirms design |
| **11** R_res at cap | matches design; **fragile** — 34 km/h clears break-even by only 0.78 km/h | confirms + fragility |
| **12** L_req | every stated L_req reproduces to ≤0.05 m; kills 3 mutants — **CORRECT** | confirms design |
| **13** fx-hedge-gap | base = total occlusion; entrance gap threads; 4 gates blocked | confirms 09's verdict |

Checks 10–13 are the four quantities the file long warned were prose-only. Three
(`C30-DR` taper, `R_res`, `L_req`) confirm the design's numbers are **correct** and now fail
loudly if a future implementation drifts. Still prose-only: the full four-corner
`fx-esses-blind` chain and the six book-figure scenes.

---

## 7. Corrections to D46 and prior conclusions

1. **D46 did not fix `A-SSD-GOVERNOR`** — the reshape made `blind` true but left the governor
   inert (§2.2). Verified.
2. **D46's `fx-esses-blind` diagnosis is wrong in kind** — blind on the right-handers, on the
   wrong line (§2.3). Mechanism verified for c1.
3. **`S-CONT-SEPARATION-v2` inherits the undecidability D46 retired the original spike for**
   (§2.12). Verified.
4. **The `check-1` universal in D46/09/01 is overstated** (Q1/Q2) — and the prior harness
   encoded the overstatement; check 1 is now corrected.
5. **The prior sweep over-called vacuity by ~40%** — of 81 raw candidates, 33 survived
   adversarial verification. The over-call pattern (circular-test fallacy, shipped-corpus
   assumption) is documented so future passes avoid it.

---

## 8. Gate census

Verdicts are post-verification. `VAC`/`UNSAT` = the 33 retained (see §2 for tier and
detail); `undet` includes the contested set (§5); `n/a-design` needs an engine/renderer.


**§1–2 + §3.2a analytic-acceptance**

| gate | verdict | evidence |
|---|---|---|
| `A-AN-TRUNCATE` | **VAC** | Limb (iii) has an empty domain: `R 30 ^270` carries no `>` taper token, so the fixture contains ZERO taper segments and there is no taper split to check at any of the 20 stations. |
| `A-AN-MEMBER-KAPPA` | n/a-design | Both limbs depend on the continuation generator's output — which σ values it emits per preset, and where it splices tapers at κ zero-crossings — and none of that is derivable from design/ alone. |
| `A-AN-RADIUS` | exer | The corner sweeps 270°; 02 §3.1's release predicate uses wrapToPi, and wrapToPi(psi_exit − psi) = wrapToPi(−270°) = +90°, so dpsi_rem = handSign(R)·(+90°) = −90° ≤ 0 → release fires at the turn-in in… |
| `A-AN-ROLL` | undet | sweep said VACUOUS; single-agent recheck said EXERCISED; no adversarial tiebreak. Verdict hinges on quantifier domain (fuzzed vs corpus) or unpinned implementation. |
| `A-AN-SAVE-POLICY` | undet | The corrective shadow's precondition (04 §4a.1/§4a.2) is run_wide_detect: f rising through F_DETECT=1.0 outward AND a turn_in event having occurred. On R60 at 12 m/s the bike needs 13.75° of lean (gr… |
| `A-AN-SWEEP-BUDGET` | exer | Limb (ii) is implied by limb (i) for ALL inputs: member_sweep_max_deg = 150.0° (03:1057) and SWEEP_UTURN_MIN = 170.0° (03:94), and limb (i) pins the sweep to min(150, ·) ≤ 150 < 170. Limb (ii) cannot… |
| `D-BOUNDS` | exer | The `ellipseMag ≤ 1` limb is an algebraic identity of the integrator: 02 §5 clips a_clip = clamp(a_cmd, −aLongAvail, +aLongAvail) inside EVERY RK sub-stage, with aLongAvail = aLongMax·sqrt(1 − (a_lat… |
| `P-EXPORT-DETERMINISM` | exer | Unlike P-DETERMINISM, the cache-independence limb is genuinely falsifiable by construction: warm and cold paths are DIFFERENT code paths, so byte-identity between them is not implied by purity and do… |
| `T-BLESSED-DOC-SYNC` | exer | Generator-versus-its-own-output: both sides of the byte comparison are produced by the same `linelab-bless --write-docs` code path from the same fixtures, so the assertion cannot detect a wrong value… |

**§3.2 goldens**

| gate | verdict | evidence |
|---|---|---|
| `G-POS-REACH` | **VAC** | dd_max/K_REACH = 21.891 m at 34 km/h against a 2.70 m corridor and a 1.890 m requested move -- the asserted lower bound exceeds the physical ceiling by 8.1x (and by 12.0x at 28 km/h). |
| `C30 (extended)` | exer | exit-event assertion bar == EPS_EXIT_DEG == 1.0 deg exactly (02:350 vs 09:242); road-end lean bar == EPS_UNWIND_DONE_DEG == 0.25 deg exactly; quality `good` requires doctrine.fail=0 but ssd_upright(5… |
| `C30-LR` | exer | flip needs 18.47 m of travel at 50 km/h; the gap is 10.00 m, so 4.23 m of the roll must occur inside each arc for the crossing to land in the gap at all. |
| `C30-chop-sweep` | exer | Delta_phi(r) at Delta_a = 3: 4.13 / 12.38 / 16.50 / 18.56 deg for r = 10/20/40/80 -- strictly monotone, but the top rung adds only 12.5% over the third. |
| `C30-squeeze` | exer | S_sustained = 0.30*relu(2.0-2.5) = 0 and S_transient = 0.12*relu(4.0-8.0) = 0; phi_dot_su == 0 by constants. |
| `C30-stop` | exer | below_validity requires \|phi\| >= 2 deg; an upright straight-line brake has phi == 0 at every sample, so the flag's domain is empty while v sweeps 7.0 -> 2.0 m/s straight through the band. |
| `C30-trailbrake` | exer | b_dem = 2.0 < A_SU_ONSET = 2.5 (relu -> 0) AND slew 6.0 < RATE_THRESHOLD = 8.0 (relu -> 0): phi_dot_su == 0 by arithmetic on constants, independent of the fixture. |
| `G-8.5-RED / G-8.4-COMPANION` | exer | bookDoubleApex contains zero taper segments, so check 16 is `na` (not_a_dr_corner) on c1..c3 and the pinned FAIL is unreachable; and 01:821's double_apex row produces no `na` at all, so the 'na carve… |
| `G-APEXLIST` | n/a-design | c2's curvature is exactly half its neighbours' (1/24 vs 1/12) and 2*lane/r = 0.292 vs 0.583 -- geometrically an opening -- but the apex detector's hysteresis width is never given a value in design/. |
| `G-C30-CHECKVECTOR` | exer | ssd_upright(50 km/h) = 27.67 m vs sight_ride_m = road_end - s -> 0: check 10 fails over the last 27.67 m of a 107.124 m road, so 'the rest pass' is false and quality `good` is unreachable. |
| `G-CORR-RIDER` | exer | 04:1249 and 04:1216 make `lean_only_reserve` / `return_after_detect` the only possible values -- the pins are equality against constants and vary with nothing in the fixture; meanwhile R_res/R_road =… |
| `G-CORR-RUNOFF` | exer | 02:753 states the terminal sample sits exactly on the edge by construction; the golden's +/-0.05 m band cannot be violated by any implementation that terminates at all. |
| `G-CORR-WIDE` | exer | Post-detect lateral domain is 0.40 m on the L-hander (f=1.0 at d=3.10 to the edge at 3.50) vs 3.10 m on the R-hander (d=0.40 to d=-3.50 crossing the centreline at 0) -- a 8.75x asymmetry that the out… |
| `G-MISJUDGE-DR` | exer | Taper spans s in [10.000, 38.362] and believed-vs-actual radius diverges at s = 10+ -- the divergence station cannot fall outside the taper; and 'believed-world clean' fails on the ssd tail (15.82 m … |
| `G-OFFROAD-BRACKET` | exer | Verbatim restatement of P-EVENT-BRACKET (09:545) with strictly less domain (one unnamed scene vs the fuzzed corpus), and confinement-to-bracket is a construction property of bisection. |
| `G-POV-CLAMP-MIDCORNER` | exer | Relative bearing 33.63 to 38.43 deg across the full corridor vs a 30 deg half-frame -- worst-case margin 3.63 deg, and the inset only widens it. The doc's quoted 36.8 deg is within the swept range (3… |
| `G-PRESET-HANDS` | exer | Hand distribution across the six presets is 4L/2R, so the hand clause discriminates; but no document states whether the expected DSL expansions are literals or registry reads. |
| `G-SAVEWIN-INTERMITTENT` | n/a-design | The fixture does not exist (09:381-388 says the mechanism 'does not exist and is not carried'), and its blessing precondition -- transition_count > 1 at all three grid rungs -- is itself unreachable … |
| `G-SAVEWIN-NEVER` | n/a-design | R_res/R_road on bookDecreasing r2 = 10.697/9 = 1.1886 at 34 km/h -- the one preset 04:1315 names as savable by lean alone -- and the overspeed multiplier that is supposed to push it past never_open i… |
| `G-SAVEWIN-RUNOFF` | n/a-design | Scan-grid legality confirmed (0.5/9.4444 = 0.0529 s <= 0.1 s, 1.9x margin), but tau_close_s, s_close_m, s_star_m and reaction_budget_s are bisection outputs at a feasibility discontinuity with no clo… |
| `G-SAVEWIN-WIDE` | undet | sweep said VACUOUS; single-agent recheck said EXERCISED; no adversarial tiebreak. Verdict hinges on quantifier domain (fuzzed vs corpus) or unpinned implementation. |
| `G-SIGHT-BASIS` | exer | The ratio's deviation from 1.0 spans 3.3% to 25.8% as the unstated offset moves across the corridor, and is exactly 0% on straights -- so the fixture's discriminating power is entirely determined by … |
| `G-STOPPED` | exer | 05:433 'caution otherwise (contained-with-fails, and all stopped)' makes `quality: caution` unfalsifiable for a stopped run; 05:407 makes outcome and reason one fact; 05:586 puts a caution line at st… |
| `book90-ideal` | exer | Three pinned quantities, zero attached bounds; contrast C30 which attaches four independent bounds to its blessed values. |
| `standing golden rows (D43)` | exer | standing >= 3 <=> clean(line); clean requires doctrine.fail = 0; check 10 fails over the last ssd_upright metres of every finite occluder-free road (15.82 m on book90, 27.67 m on C30) -- so rungs 3 a… |

**§3.3 hashing**

| gate | verdict | evidence |
|---|---|---|
| `Bless-script mechanical refusal (09 L426-427)` | exer | C30 entry at 70 km/h implies 52.10° steady lean vs the 40.36° D-BOUNDS pin — 11.74° of margin the solver must actually earn by shedding 1.828 m/s². |
| `Standing re-bless obligation (09 L447-455)` | n/a-design | StandingReport is out-of-hash by 05 §8.3, so the §3.3 tripwire cannot observe it; the clause names no test id and the r0 witness fixture does not exist. |
| `T-HASH-TRIPWIRE (unnamed in 09 §3.3)` | exer | Hash sensitivity derived: 0.018 % relative physics drift already moves lean_max_deg past the 2-dp quantum; hash-blind band is 1.35 mm of lateral position. |
| `T-STAMP-TRIPWIRE (unnamed in 09 §3.3)` | exer | Zero committed FigureSpec fixtures are enumerated in design/; the single named .figure.json path is an 08 §6 CLI example, and C-SKEW-DETECT's stale-stamp fixture is a standing counterexample to the u… |
| `T-STAMP-TRIPWIRE, semver clause` | exer | Patch bumps are explicitly permitted outside re-bless commits (05 L924) yet would break this equality — the clause is only green today because it has no fixtures. |

**§3.4 properties (1)**

| gate | verdict | evidence |
|---|---|---|
| `P-RUNWIDE-UPRIGHT` | **VAC** | At phi = 0 the stand-up term is killed by its tanh ENVELOPE, not by any threshold: phi_dot_su = -sign(phi)*[S_sus + S_tr]*tanh(0/5) = 0 identically. 02 §5.4.4 states the same invariant at \|phi\| <= … |
| `A-SU-ZERO-WHEN-GENTLE` | exer | 04:226 states normatively that on the SOLVED path 'doctrine braking completes before turn-in, so the stand-up term is inactive'. So b_dem > 0 only where phi = 0, and the term is zeroed by the tanh EN… |
| `P-AWIDEN-SIGN` | undet | sweep said VACUOUS; single-agent recheck said EXERCISED; no adversarial tiebreak. Verdict hinges on quantifier domain (fuzzed vs corpus) or unpinned implementation. |
| `P-CF-LITERALISED` | exer | Both halves have non-empty domains: the positive half over >= 4 pinned-runoff fixtures that must produce a counterfactual invocation, the negative half over a tester-constructed corner-relative plan. |
| `P-CF-PRECONDITION` | exer | Sub-assertion (iv) is FALSE as written: bookDoubleApex's middle corner (R = 24) gives R_res/R_road = 0.347 at the preset's own entry speed, far outside [0.65, 0.90], and bookDoubleApex is absent from… |
| `P-CORR-SHADOW-HONEST` | exer | With zero longitudinal input the shadow has b_dem = 0 and a_cmd_rate = 0, so phi_dot_su ≡ 0 on EVERY shadow; and its ellipseMag is pinned to exactly 0.85 — 15% below the clip it is being tested again… |
| `P-COUNTERFACTUAL-CLOSED` | exer | The SUBSET clause alone would be near-trivial (2 reachable pairs inside a 6-pair target), but the second clause is an EQUALITY on the reachable rider set, which is falsifiable in both directions and … |
| `P-ELLIPSE` | exer | C30-deeplean sits EXACTLY on the boundary: ellipseMag = 1.000000000 (clipped regime), vs the crash deadband eps_mag = 1e-3. |
| `P-EMERGENT-APEX` | undet | sweep said VACUOUS; single-agent recheck said EXERCISED; no adversarial tiebreak. Verdict hinges on quantifier domain (fuzzed vs corpus) or unpinned implementation. |
| `P-ENDPOINT-IN-FRAME` | exer | The longitudinal axis is tautological — WINDOW_TAIL_M = 25 m places the frame edge 25 m PAST the last line's end anchor by construction — so all content lives on the lateral axis, and there it is gen… |
| `P-EVENT-BRACKET` | exer | The bracketing regime is genuinely reached, and F-AN-BRAKE supplies a closed-form crossing station (177.93 m) against which the bracket can be checked to analytic precision rather than against itself. |
| `P-KAPPA` | undet | sweep said VACUOUS; single-agent recheck said EXERCISED; no adversarial tiebreak. Verdict hinges on quantifier domain (fuzzed vs corpus) or unpinned implementation. |
| `P-MIRROR` | exer | The asserted identity is FALSE by 7.04 degrees of lean on book90: hand= mirrors the road but 03:219 says 'the traffic side does not flip', so the rider's corridor moves from the OUTSIDE of the turn t… |
| `P-RESAMPLE` | exer | 'Interpolated fields lie between their bracketing raw samples' is the definition of every one of the three interpolation rules; and the one real resampling hazard in this system — a transient shorter… |
| `P-ROLLRATE` | exer | The regime is richly reached — S_transient at slew 40 is 220.0 deg/s, 4.40x roll_rate — but the same arithmetic shows a derived FALSE-FAIL: the disturbance can fall entirely between two retained stat… |
| `P-ROLLRATE-EXCESS` | exer | The chop's station span at the documented mid roll-on level is 0.348 m on C30 and 0.236 m on F-ORACLE-90 — both SHORTER than the 0.5 m retention grid, so the existential premise the design cites as p… |
| `P-RUNWIDE-MONOTONE` | exer | On the named fixture the property discriminates by 4.5x (sheds 1.38 / 4.13 / 5.50 / 6.19 deg at da = 1.0), but the STATED domain contradicts the assertion's band and 45.4% of the stated (phi, da, r) … |
| `P-RUNWIDE-WIDEN` | exer | (W) holds on C30-deeplean with 3.07x margin (LHS 1.0773 vs RHS 0.3504) and on C30-heldbrake with ~1.6x margin across the entire plausible solved-speed range 40-70 km/h. |
| `P-SLEW` | exer | Domain is non-empty and spans 4 to 80 m/s^3, but at the high end the ramp is sub-grid: at slew 40 with da = 1.0 the whole ramp occupies 0.348 m against a 0.5 m retained spacing, so the recorded a_cmd… |
| `P-SSD-LEAN` | exer | 0 monotonicity violations over phi 0..45 deg at 0.01 deg resolution for v in {7,9,11,13,15,18,20,25}; the lean premium at street lean is 6.9% (15.815 -> 16.911 m at 34 km/h), well outside any plausib… |
| `P-STEER-OWNER` | exer | All four steer_states have a hosting fixture; the position state, the only one that is not automatic, is hosted by four dedicated FX-POS-* fixtures. |
| `P-TERMINATED-CLOSED` | exer | 4 of the 6 closed-set members have a hosting fixture; the two runaway guards (max_time, max_dist) have none, but the assertion is a membership test that cannot fail through non-coverage. |
| `P-TRAILBRAKE-TIGHTENS` | exer | The tightening half has content (2*b_del/v = 0.2878 /s at C30 corner speed), but the phi_dot_su ≡ 0 half is a relu identity, and no fixture anywhere in the corpus sits ABOVE the A_SU_ONSET boundary a… |
| `P-UNWIND-CAPTURE` | exer | The third clause bounds post-unwind \|phi\| at 0.25 deg while PHI_TRACK_AUTH_DEG grants the `track` tracker 5.0 deg of lean authority — 20x the bound — over the same 25 m of exit straight. |
| `P-UNWIND-NOCROSS` | undet | sweep said VACUOUS; single-agent recheck said EXERCISED; no adversarial tiebreak. Verdict hinges on quantifier domain (fuzzed vs corpus) or unpinned implementation. |
| `P-VALIDITY-FLAG` | exer | The flag band is geometrically wide open on every corpus radius — on R = 12 it spans v in [2.028, 7.0) m/s, and at v = 7.0 the lean is already 22.6 deg — yet the ONE fixture pinned to reach the low-s… |

**§3.4 properties (2)**

| gate | verdict | evidence |
|---|---|---|
| `P-MISJUDGE-PREFIX` | **VAC** | On the only committed misjudge fixture the asserted byte-identity prefix contains zero curved stations. F-BELIEVED-90 = book90 + underread r_believed=16: actual `S 12 \| L 12 ^90 \| S 16`, believed `… |
| `P-SAVEWIN-REFUSES` | **VAC** | Antecedent transition_count>1 is produced by exactly one status, `intermittent` (04:1021). The only fixture that produces it, G-SAVEWIN-INTERMITTENT, is explicitly UNBUILT: 09:380-387 says 'The origi… |
| `P-STANDING-RUBRIC-SENSITIVE` | **VAC** | The assertion is a possibility claim -- 'standing results MAY change while outcome is byte-identical' (09:626-629) -- which is a tautology: forall line (standing'(line) != standing(line)) OR True is … |
| `F-SIGHT-OUTSIDE` | n/a-design | A counterexample with no geometry cannot be shown to be one; and a coarse constructive search over the natural reading (outside band on a left-hander, d > +3.5) found ZERO non-monotone cells, so the … |
| `P-CORR-CONSTANT-SPEED` | exer | Both conjuncts are unfalsifiable by construction. 04:724-727: "The shadow commands a_cmd = 0 (§4a.4) and 02 models no aerodynamic or rolling drag and no grade, so a_long = 0 at every shadow sample an… |
| `P-COUNTERFACTUAL-NAMED` | exer | Four of the five status arms are populated, so the enumeration has a real domain — but the `intermittent` arm named explicitly at 09:600 is empty, and the rider set the enumeration ranges over has ex… |
| `P-MISJUDGE-IDENTITY` | exer | Both antecedents are trivially constructible by the fuzzer (copy the roadSpec; flip the hand token) and both consequents are distinct typed refusals, so the gate has a populated domain and a two-valu… |
| `P-OUTCOME-RUBRIC-FREE` | exer | The load-bearing half is a strict byte-identity invariance (samples, events, outcome, spec_hash), which one counterexample kills regardless of whether the perturbation changes any grade — so unlike i… |
| `P-POS-AUTH` | exer | On book90's arc in `track` state the feedforward alone demands 31.05°, 6.21× the 5.0° cap, so the clamp is a live branch — but the assertion is a restatement of that clamp's own output, so it can onl… |
| `P-POS-NO-CORNER` | exer | The saturated tracker can only hold R = 103.93 m against a corridor of 12.40–15.10 m — a 6.9× lateral-authority deficit — and the line crosses the physical outer edge after 3.78 m of a 18.85 m arc fr… |
| `P-QUALITY-TOTAL` | exer | Fully enumerable domain of ≥ 6 × 17 = 102 cells, all constructible without an engine because quality's law is a pure function of (outcome, doctrine fail count) owned by 06 §5.1. |
| `P-SAVEWIN-ANCHOR` | exer | Domain is non-empty (C30-chop is committed and pinned `runoff`, i.e. it departed outward ⇒ corrective ≠ null), and the identity is a genuine cross-check between two code paths — but 04:1062 states it… |
| `P-SAVEWIN-BRACKET` | exer | Domain is non-empty (resolved pins G-SAVEWIN-RUNOFF/WIDE exist) and the re-integration actually runs, but both probes are re-reads of the search's own last two evaluations, so the discriminating regi… |
| `P-SAVEWIN-DETERMINISM` | exer | Determinism is genuinely falsifiable and the domain is non-empty, but the exact-equality clause covers a reduced value space: only 4 of 5 status values and only transition_count ∈ {0, 1} are reachabl… |
| `P-SAVEWIN-FREEZE` | undet | Clauses (i)-(iii) all restate definitions from 04 §4b.5/§4b.6 verbatim; the only substantive question — whether the freeze actually BINDS (t_freeze_end > t_detect) — is solver-dependent and unpinned … |
| `P-SAVEWIN-GRIDLAW` | exer | Conjunct 2 (the refusal branch) is reachable and derivably so; conjunct 1 is unfalsifiable at the shipped default. AND the derived refusal threshold CONTRADICTS G-SAVEWIN-GRID (09:373-375), which ass… |
| `P-SAVEWIN-HORIZON` | exer | The asserted inequality is a verbatim restatement of the definition of s*. 04:883 DEFINES s* as '(a) the first bracketed station s* >= max(s_detect, s(tau)) with f(s*) <= F_SAVE + eps_f_save'; 09:646… |
| `P-SAVEWIN-INSIDE-NOT-A-SAVE` | exer | The construction is geometrically forced, not merely possible: the reserve-lean shadow radius is 10.697 m, which is 1.30 m TIGHTER than book90's physical inner edge (12.00 m), so any shadow held at r… |
| `P-SAVEWIN-OUTCOME-CONSISTENT` | exer | Domain non-empty (two committed `resolved` goldens), but 04:1059-1068 DERIVES the implication as a theorem from t_shot = t_earliest + t_react, monotonicity of the resolved scan, and P-SAVEWIN-ANCHOR … |
| `P-SAVEWIN-PURE` | exer | Hash-before/hash-after across four independent surfaces (envelope, hashes, CSV, SVG) over a non-empty corpus; unconditionally falsifiable with no undefined cases. |
| `P-SAVEWIN-SHADOW-HONEST` | undet | The first clause (probes obey the same ellipse/roll-rate/termination laws as a main run) is substantive and reachable; the second clause — "the fail_reason set contains NO DEAD MEMBER" — requires a w… |
| `P-SIGHT-BASIS` | exer | The predicate is sited on 'any straight with d=0', which is the one domain where the quantity it pins is definitionally trivial. On a straight the rider path at constant offset is parallel to the cen… |
| `P-SIGHT-INSIDE-MONOTONE` | exer | 576 fuzz cells: sight_m actually VARIES with f in 302 of them (52.4 %) and the monotonicity is violated in 0 — the domain is non-empty, the predicate discriminates on half of it, and it holds. |
| `P-SIGHT-PURE` | exer | Two of the four clauses are structurally tautological (sight_m ≥ 0 and the s_limit range both follow from the target enumeration being exactly the forward stations in [s_eye, road_end]), but the firs… |
| `P-STANDING-NA-CAP` | exer | The zero-instance arm has a non-empty domain by construction: four committed roads have zero corners, so lean_ceiling (corner scope) has zero instances on them, which 05:606-609 defines as `na` and w… |
| `P-STANDING-OUT-OF-HASH` | exer | Hash-before/hash-after over the whole committed corpus is unconditionally falsifiable, and the specific hazard it guards is live: 01:993-998 grants the reserve_checks annex an EXEMPTION from the vers… |
| `P-STANDING-PURE` | exer | Byte-identity of two runs over the same input is unconditionally falsifiable and the domain is every committed line — no regime to miss. |
| `P-STANDING-STAMPED` | exer | Field-presence and verbatim-string equality over every report — non-empty domain, no undefined cases — but the "echoed from the loaded pack, never re-derived" clause is asserted as a value comparison… |
| `P-STANDING-STRICTER-THAN-CLEAN` | undet | The strictness witness requires the solved line to ride within the INNER 0.962 m of the 2.70 m corridor (35.6 %); the doctrinal out-in-out line through that corridor has R_eff = 33.95 m and leans onl… |
| `P-STANDING-TOTAL` | exer | Totality and downward closure are falsifiable over a synthesisable product space, and 05:594-599 identifies the exact failure mode the gate guards ("Stated as five biconditionals the ladder is not a … |

**§3.4a continuation (1)**

| gate | verdict | evidence |
|---|---|---|
| `P-CONT-TIGHTENING-ADMISSIBLE` | **VAC** | sigma=+1 gives k~0 = kappa_max exactly on every corpus corner (margin over \|kappa_L\| from +0.031746 at r=9 to +0.142857 on a straight), and admissible == true identically under total occlusion. |
| `A-CONT-PACK-DATA-ONLY` | n/a-design | Schema-shaped assertion with no numeric regime; the adjacent derivable obligation (kappa_step_max >= kappa_max, whose violation I derived at 0.1667 vs 0.1429) is not covered by it. |
| `P-COMMIT-MEMBER-DEPENDENT` | n/a-design | reach@3.0 = 23.644 m (upper bound) vs sight_ride_m 31.458 m hold-wide / 24.283 m cut-in — divergent span empty, k_refuted = 0, guard never fires. |
| `P-CONT-CONSISTENT` | exer | s_limit(m) = s_L exactly under total occlusion (03 §7a.5), 0 discarded members on all 10 bookBlind probe cells, and 0 of 150 two-band bookBlind configs produce any re-emergence. |
| `P-CONT-ENVELOPE-CONTAINS-ACTUAL` | exer | EXERCISED over its fuzzed-road domain: quantifier critic Q6 shows the fig-8.4 teardrop R30>9^210 breaches the rate leg (0.00786 vs 0.005), so the gate fires. Magnitude leg still needs fuzzer to reach… |
| `P-CONT-FILTER-TWO-SIDED` | n/a-design | 0 of 150 two-band cells on bookBlind geometry re-emerge; 847 of 3600 cells on bookEsses geometry do, with both sigma signs displaced 3.77 m / 5.27 m against a 1.0 m bar. |
| `P-CONT-MONOTONE-SIGHT` | n/a-design | k_admissible = 8 (= K_MEMBERS + 1) constant at all 10 bookBlind probe cells under total occlusion; both the host fixture and the pinned counterexample have no authored geometry. |
| `S-CONT-SEPARATION (retired)` | n/a-design | min s_limit 32.50 m vs s_end 30.85 m; ssd 14.53 m vs sight >= 24 m; ladder_old collapses 7 rungs to 5 (left-hander) and to 1 (straight). |

**§3.4a continuation (2)**

| gate | verdict | evidence |
|---|---|---|
| `G-COMMIT-PREMATURE` | **VAC** | s_L = 46.850 m = the road end on an occluder-free fixture, 11.21 m beyond the escape's coasting reach from the commitment probe — the commitment channel has literally nothing to grade on book90. |
| `A-COMMIT-PROSE` | exer | filter_effective is provably false at every probe on every corpus fixture, so exactly one branch of the disclosure-clause assertion is ever taken. |
| `A-COMMIT-VERB` | n/a-design | no fixture named; if it inherits bookBlind the compared payload is constant. |
| `A-FAN-NO-ENGINE` | undet | sweep said VACUOUS; single-agent recheck said EXERCISED; no adversarial tiebreak. Verdict hinges on quantifier domain (fuzzed vs corpus) or unpinned implementation. |
| `A-RECIPE-K` | n/a-design | 09 does not name the recipe's road; regime is inherited. |
| `C-COMMIT-BAKE-BUDGET` | exer | min s_limit at geometric corner entry on the esses legs is 25.75 m (R corners) and 31.00 m (L corners) against s_end = 23.708 — no corner is blind, so the 25 s ladder bake has nothing to bake. |
| `C-COMMIT-BUDGET` | n/a-design | the timed probe on bookBlind has an empty divergent span at every station, so the budget times the degenerate path. |
| `C-COMMIT-NO-CHECK` | exer | static lint over a non-empty source corpus with no geometric precondition — the only gate in lines 895–1060 that is fully exercised today. |
| `D8 witness rows (commitment)` | undet | zero refute_reason values are reachable on the committed corpus (k_refuted = 0 everywhere) and filter_effective is constant false — the D8 table would record the absence of the very effects it exists… |
| `G-COMMIT-BLIND` | n/a-design | s_L at the commitment probe is 41.00 m on BOTH the vis=none and vis=cautious lines (Δ = 0.00 m) and the governor needs vis_margin ≥ 1.486 against a default of 1.0 — the two lines being compared are t… |
| `G-COMMIT-ENTRY` | n/a-design | bookEsses' earliest probe lands at 24.708 m against c1's end at 23.708 m — the regime is missed by exactly 1.000 m, purely because PROBE_BACK_MIN_M = 5.0 is 1 m shorter than the 6 m link straight. |
| `G-COMMIT-ESSES` | exer | min s_limit on the correctly-handed R 12 ^75 leg = 22.25 m at turn-in 4.0 m; at geometric entry (8.0 m) min s_limit = 25.75 m against s_end = 23.708 — not blind, by 2.04 m, on the line the doctrine r… |
| `G-COMMIT-GRID` | exer | \|s_limit(m) − s_L\| = 0.00 m for all 7 members by the design's own §7a.5 statement — the EPS_SLIMIT_M axis, the whole point of the grid, compares 4× of tolerance against zero. |
| `G-TRUNCATE` | exer | bookHairpin's swept angle is 150.00°, exactly equal to member_sweep_max_deg = 150.0 — the named edge case sits on a tie the spec never breaks. |
| `J9 fan disclosure` | undet | cross-tick count = 0 on the only fan-bearing figure in the corpus, because k_refuted = 0 at every probe — three of J9's seven items have an empty domain and the other four return na on five of six fi… |
| `P-COMMIT-DETERMINISM` | exer | filter_effective ≡ false and k_refuted ≡ 0 on every probe of every committed fixture — the 'exact' half of the determinism assertion compares constants to constants. |
| `P-COMMIT-ID-FREE` | exer | per-member payload on bookBlind is 7 copies of (escaped: true, refute_reason: null) — an id-reading mutant has no observable to corrupt. |
| `P-COMMIT-MONOTONE-TI` | undet | sight at the commitment probe is 25.00 m at s_ti = 16, 17 AND 18 — moving turn-in 2 m later changes it by 0.00 m, because the hedge is arc-following. The independent variable does not move the depend… |
| `P-COMMIT-MONOTONE-V` | n/a-design | reach(30 km/h) = 19.24 m and reach(34 km/h) = 23.64 m, both below the minimum hold-wide sight of 25.00 m ⇒ k_refuted ≡ 0 across the swept range. |
| `P-COMMIT-OUT-OF-HASH` | exer | no fixture in the registry is simultaneously occluder-bearing and misjudgment-carrying; on the misjudge presets s_L = 46.850 m = the road end and κ_L = 0. |
| `fx-hedge-gap` | undet | 09's own text plus my mechanism check: span truncation moves the first-blocked station later or removes it, and only `margin` is optically decisive — so no member of the shortened-span family can pro… |

**§3.5 solver & visibility**

| gate | verdict | evidence |
|---|---|---|
| `A-CHAIN-VIS-BUDGET` | **VAC** | The gate exists to test the 03 §6.1 lateral-budget carve-out across INTER-CORNER SPANS. On its own fixture (zero-gap bookEsses, S-links removed; legal grammar per 03:246 'Authored zero-gap chains rem… |
| `A-CHAIN-VIS-FULL` | **VAC** | All three clauses are no-op-satisfiable on fx-esses-blind (bookEsses + hedge inside cN 0x12 margin=1.5 depth=4, 32 km/h). (i) 'passes stop_within_sight at every station': V1 is inert -- min occluder-… |
| `A-SSD-GOVERNOR` | **VAC** | min sight_ride_m 25.00 m vs vis_margin*ssd = 1.0*16.912 = 16.912 m -> 48% headroom; governor first binds only at vis_margin >= 1.478. |
| `P-ACCEPT-CONSTRAINT` | **VAC** | The property ('no best_failing return ever violates an authored constraint') quantifies over the intersection {lines returned under accept=best_failing} INTERSECT {sources carrying an authored constr… |
| `P-VIS-BOUNDED` | **VAC** | The property is '<= vis_max_iterations (4) passes AND terminates in a passing line or a typed refusal'. Its discriminating content lives where iteration >1 occurs (first self-check fails) or a refusa… |
| `fx-esses-blind` | **VAC** | c1 and c3 have 45/220 blind cells each (min s_limit 21.00 vs s_end 23.708) against a documented claim of ZERO; and every blind cell sits on the cut-in edge, not the hold-wide edge. |
| `A-DOUBLEAPEX` | undet | bookDecreasing sweeps 130 deg against DA_SWEEP_MIN_DEG = 120, so its NO_SOLUTION must come from no_two_touch_line and not from the qualifying-window gate. |
| `A-FIG81-VEHICLE` | n/a-design | Grep confirms design/'s ONLY two spellings of the fig-8.1 scene both omit a vehicle: 08 §6(e) lines 614-625 name 'the book90 road preset (a left-hander), an ideal line, a premature mistake line, and … |
| `A-LINK-FLIP` | undet | three consecutive hand flips with 0.000 m of link straight against a 6 m designed flip budget — the regime is maximally stressed — but the assertion is a disjunction with no arm pinned, so any outcom… |
| `A-SOLVED-PLAN-VALIDATES` | n/a-design | the corpus's only zero-length-span generator (the zero-gap variant's 0.000 m links) is pre-empted by MIN_POS_DD_M = 0.10 before any action is emitted, so the named bug class has no fixture that reach… |
| `A-SOLVER-FIT` | exer | The HEADLINE off-road clause ('never a rail caused by an off-road bracket') IS tautological on the corpus -- reproduced -- but the GATE AS A WHOLE exercises real content, so the whole-gate VACUOUS cl… |
| `A-VIS-HOLD-REACH` | undet | the usable turn-in band is (13.78, 20.4) m, i.e. 6.6 m of the solver's own 15.33 m bracket — 43%; the other 57% makes the gate vacuous or failing. |
| `P-ACCEPT-GRADE` | n/a-design | tightest preset sweep span 3.67 m / SWEEP_STEP_MIN_M 0.5 m = 7 candidate slots against BEST_FAILING_MIN_CANDIDATES = 4, so the best_failing domain is non-empty corpus-wide. |
| `P-ACCEPT-MONOTONE` | n/a-design | under the literal 03:491 reading, check 10 fails on the terminal 12.1-15.8 m of every preset (sight_ride_m -> 0 vs ssd 12.099-15.816 m), so clean(line) is never true and the property's guard has an e… |
| `P-APEX-TARGET-TYPED` | n/a-design | r1/r2 = 1.78 clears DR_RATIO_MIN = 1.25 by 42%, so late_apex applies at the 60% bar; turn-in bracket span 12.09 m, so the ranking clause has a non-empty candidate domain. |
| `P-CONSTRAINT-BINDING` | exer | 55 km/h needs 47.37 deg of lean at f=0 against phiMax 45 deg, so the R6 corner is unridable as authored and the constraint search is genuinely bound; and the fuzz sweeps constraint values, so both th… |
| `P-VIS-MARGIN-MONOTONE` | undet | governor binding thresholds vis_margin >= 1.478 (bookBlind) and >= 1.115 (fx-esses-blind); edge-pin thresholds >= 10.94 and >= 7.44. |
| `P-VIS-SELFCHECK` | n/a-design | 2 of 3 acceptance conjuncts are inert or empty-domain on every named vis=cautious fixture (V1 headroom 48% / 11%; zero authored constraints). |

**§3.6 CLI/cold-start**

| gate | verdict | evidence |
|---|---|---|
| `A-CF-DEAD-REASON` | exer | Direction (ii) has no machine-readable domain; and if honestly implemented it should already fail — the corpus's only occluder-bearing fixtures are bookBlind (governor inert: 23.50 m sight vs 15.82 m… |
| `A-CF-REGISTRY-CLOSED` | exer | Both arms have concrete witnesses (any unregistered string; the named token brake_reserve_escape) and assert on typed reasons, not text. |
| `A-COMPARE-ROADS` | exer | Recipe (c)'s hedge occludes 28 of 78 approach stations (min sight 40.50 m), so a with/without pair on that road makes arm 2 real — but the gate names no fixture and recipe (c) itself uses identical w… |
| `A-EXIT-DECLARED` | exer | Case 3 ('a declared failure that unexpectedly passes') has no committed witness, because the §4 oracle pins every committed mistake to actually fail. |
| `A-EXPLAIN-KIND` | exer | 4 of the 5 Standing tokens (clean, caution, failing, crash) collide with outcome/quality; the disjointness quantifier names four other vocabularies and omits both colliding ones. |
| `A-FIGURE-JSON-PARITY` | undet | sweep said VACUOUS; single-agent recheck said EXERCISED; no adversarial tiebreak. Verdict hinges on quantifier domain (fuzzed vs corpus) or unpinned implementation. |
| `A-FLAG-MAP` | exer | Counting assertion ('exactly once', 'non-sugar') over two machine-enumerable sets — no empty domain, no na. |
| `A-FULLWIDTH` | undet | Left-hander: f_default > 1 <=> d > 3.10 m <=> f_full > 1.0000 — the corridors share the outer edge, so no contained full-width line maps to f_default > 1. Right-hander: f_default = 1.3 <=> f_full = 0… |
| `A-GATE-FIGURE` | exer | Arms 2-3 need a mistake line that comes out clean, which the §4 oracle forbids on every committed fixture; `premature:early_by_m=1` (~2.5 apex points vs the ~8 needed) would construct one but is name… |
| `A-HAZARD-FLAG` | exer | A default gravel band is 1.4 m in a 2.70 m corridor (52%); on a straight the line sits at rider.start.f = 1.0, so band placement decides whether any sample's mu changes. |
| `A-IMPORT-SURFACE` | exer | Enumerable domain = 22 names (08 §7.1 L718-721); prose-required set includes at least `solveDoubleApex` (04 §4.6, shipped v1) and `truncateAt` (03 §7a.4, D45) — neither exported. |
| `A-MERGE-PIN` | exer | On the recipe (a)/(f) road the bisector needs -0.97 m/s^2 and on recipe (g)'s road 1.82 m/s^2 — both distinguishable from an authored 3.0, but the gate names neither, so equality-collapse is not excl… |
| `A-MISTAKE-GRAMMAR` | exer | Three-way JSON identity is total; the token is required to carry params and scope, leaving only the optional lineId position unexercised. |
| `A-MISTAKE-SUGAR` | exer | Both sides are literals; early_by_m = 6 is deliberately off the 03 §7.1 default of 10, so a param-dropping parser cannot pass. |
| `A-RECIPE-A` | exer | Required lateral accel at 55 km/h on the apex-58 line = 7.15 m/s^2 vs the 8.3372 m/s^2 reserve; brake demand over S 20 = -0.97 m/s^2 (none required). |
| `A-RECIPE-C` | exer | 1.5 * ssd@60 = 54.76 m against min sight_ride_m = 40.50 m -> governor binds, governed entry 49.2 km/h vs 60 (a 10.8 km/h separation). |
| `A-RECIPE-D` | exer | Two corners only, and c2 is intrinsically harder: reserve ceiling 61.7 vs 68.6 km/h (entry is 89% vs 80% of ceiling) off a 5 m link vs a 15 m approach. |
| `A-RECIPE-E` | n/a-design | The fig-8.1 hedge's anchor/offset/span/margin/depth are unspecified in design/, and those five values alone determine whether any sight ray exists. |
| `A-RECIPE-F` | exer | Unconstrained doctrinal line reaches f = 0.019 at mid:c1 against the f >= 0.6 bound — a 1.57 m violation, so the constraint materially reshapes the line. |
| `A-RECIPE-G` | exer | 15 cells vs sweep_max_cells = 2500 (166x margin) makes `truncated: false` unfailable; corner-speed ceiling 46.3-50.7 km/h leaves 3-5 of 15 cells speed-saturated, where chop.end_s cannot move. |
| `A-RECIPE-H` | undet | sweep said VACUOUS; single-agent recheck said EXERCISED; no adversarial tiebreak. Verdict hinges on quantifier domain (fuzzed vs corpus) or unpinned implementation. |
| `A-RECIPE-I` | exer | Believed R16 vs actual R12: a 4.0 m radial error against a 2.70 m corridor (1.48 corridor widths) — the line cannot stay contained. |
| `A-RECIPE-J` | exer | At 30 km/h the tightest element needs 2.71 m/s^2 = 33% of the 8.3372 m/s^2 reserve (phi = 15.5 deg vs 40.36 deg) — no physics check can bind. |
| `A-RESOLVED-RERUN` | exer | Closed domain of 8 kinds each with a named base fixture, and the two controller-level kinds are called out by the exact field names (roll_rate_cap_dps = 15; slew_mss + freeze_steer_s) that a lossy ex… |
| `A-SAVEWIN-PLACARD` | undet | sweep said VACUOUS; single-agent recheck said EXERCISED; no adversarial tiebreak. Verdict hinges on quantifier domain (fuzzed vs corpus) or unpinned implementation. |
| `A-SCHEMA-JSON` | exer | Parse + schema-validate over the binary's enumerated section list is total; clause 2 is a harness rule with no detector. |
| `A-SCHEMA-SHAPE` | exer | Bijection between two enumerated tables (schema cli output vs 08 §4.1) — total and falsifiable in both directions. |
| `A-STANDING-TOMBSTONE` | exer | Five named tokens, five named expected reasons, three named successors and one explicit no-successor — fully enumerated, no open quantifier. |
| `A-STATE-VERB` | exer | All three arms are total assertions over discrete outputs (exit code, byte equality, typed error) with the degenerate alternative explicitly excluded. |
| `A-SWEEP-ROOTS` | n/a-design | 7 roots, 0 named witness fixtures; 3 of them (mistake., constraint., believe.) require scenario features a default fixture lacks. |
| `T-COLDSTART` | n/a-design | Pass depends on agent behaviour, not on spec-derivable numbers; the one derivable defect is the (a)-(j) vs (a)-(k) battery contradiction between 09 L1211 and 08 L565/L693. |

**§4 mistake oracle**

| gate | verdict | evidence |
|---|---|---|
| `A-RUBRIC-STAMP` | **VAC** | Both limbs are satisfiable by an engine that ignores the rubric entirely: a presence check on a field, plus determinism under an UNCHANGED pack. |
| `A-CATALOGUE-EXERCISED` | exer | At least three of the 32 required witnesses are derivably absent from the corpus: check 8's fail witness, check 10's pass witness (literal reading) or fail witness (carve-out reading), and check 11's… |
| `A-CHAIN-GREEN` | exer | `quality = good` requires clean(line), which requires ZERO applicable check failures; under the literal sight spec check 10 fails over the last 14.53 m, which begins at s = 84.30 -- inside corner 4's… |
| `A-DANGER-DWELL` | exer | The only arm with content names a fixture that exists solely as a forward reference from a test that itself specifies no fixtures; and the negative arm's 0.0 is guaranteed by 14.0 deg of margin. |
| `A-LADDER-PROSE` | exer | The quantifier's domain is explicitly enumerated (five named surfaces) and the required content is four specific items including one verbatim string, so neither the domain nor the assertion can be em… |
| `A-MISTAKE-FAILS-CHECK` | exer | 5 of 9 rows do NOT identify which check fails: 3 rows have an empty cell (the gate text admits the superset clause 'holds vacuously'), `underread`'s cell is empty in the normative source, and `overre… |
| `A-QS-TWOSIDED` | exer | Fail side is decisive (share 0.55-0.99 vs a 0.45 bar). Pass side is real but is carried mostly by the `max(0, ...)` clamp: at the derived turn-in (s_ti ~ 7-9 m) the good line's share is 0.000-0.138, … |
| `A-RENAME-REJECTED` | exer | The mechanism it tests is concretely specified: 01 s A.5 lines 855-864 give the pack manifest `renames: {"sight_vs_stopping": ...}` and the exact message 'sight_vs_stopping was renamed to stop_within… |
| `A-RESERVE-CHECKS-RESOLVE` | exer | Positive arm is trivially true by inspection (a 2-element subset of a 16-element set defined in the same document); the negative arm is four distinct constructible failures asserted on BOTH code and … |
| `A-RESOLVED-RERUN (as invoked at 1545)` | exer | The round-trip's domain is non-empty and the tolerance-equality assertion is two-sided, but it inherits the MISTAKE-ORACLE-SUITE defect: if the premature-family compile clamps a negative turn-in stat… |
| `A-STANDING-LADDER-CUMULATIVE` | exer | Spanning the full product makes the domain non-empty and non-degenerate, but the gate is a tautology risk (the table both defines and verifies), and its synthetic domain includes tuples the engine ca… |
| `A-STANDING-REFUSAL` | undet | The domain is constructible (04 s3 step 4 mints `empty_band` and `non_clean_band`; 04 s6 mints `vis_unsatisfiable_within_bound` and `vis_speed_below_model_floor`), but the assertion is a null plus a … |
| `A-STANDING-WARN-BAND` | n/a-design | Both the `lean_ceiling = warn` conjunct and the `standing = clean` conjunct are unreachable at 38 km/h (phi_max 27.05 deg vs a 40.365 deg reserve), and the `reserved_blocked_by` singleton is separate… |
| `A-SU-ATTRIBUTION` | exer | The chop arm's regime is reached by construction (40 m/s^3 vs RATE_THRESHOLD = 8.0), but the assertion bar is `> 0`; the sustained arm's fixture does not exist, and a misjudgment line carries no auth… |
| `F-ORACLE-90 / F-ORACLE-DR / F-ORACLE-CHAIN (the thr…` | exer | All three are fully DEFINED (DSL, hand, entry speed, profile, mu all recoverable) -- verified by independent re-derivation of every arc length, corner station and total length. |
| `F-STANDING-WARN (fixture + its calibration)` | exer | At the pinned 38 km/h the derived corner speed is 34.57 km/h and phi_max ~= 27.05 deg against a 40.365 deg reserve -- 13.3 deg BELOW the warn band. The entry needed to reach warn is 46.2-48.4 km/h, a… |
| `MISTAKE-ORACLE-SUITE (the 9-row pin table, unnamed …` | exer | 3 of 9 kinds (premature, premature_contained, fifty_pence) use `early_by_m = 10`; on both single-corner base fixtures a doctrinally clean turn-in station is <= 8.97 m (book90) / <= 4.28 m (bookEsses … |
| `O-CHAIN-PREMATURE` | exer | Corner 1's premature turn-in station is NEGATIVE for every apex in the solver's plausible band, so the chain's first term cannot be applied; and corners 2-4's premature stations fall INSIDE the previ… |
| `ORACLE-PIN-TABLE` | exer | The 09 s4 'informative view' has ALREADY drifted from 03 s7.1 in three of nine rows, while the gate claims drift is structurally impossible. |

**§5 projection**

| gate | verdict | evidence |
|---|---|---|
| `A-FIG82-SINGLEMARK` | **UNSAT** | the gate asserts the collapsed glyph is RED, but the ideal line is GREEN by the colour law (06:376) and the companion golden 09:1651 agrees GREEN — the assertion contradicts the law, so it is unsatis… |
| `A-LABEL-ANCHORS` | **VAC** | The assertion 'the shipped label sets for figs 8.1/8.3/8.4/8.5 all resolve on their fixtures' is a UNIVERSAL over an EMPTY SET. Exhaustive grep of design/*.md for 'labels:' returns exactly two hits (… |
| `A-LEGEND-AMBER` | **VAC** | Vacuous on two independent grounds. (1) EMPTY DOMAIN: the gate names no fixture ('a fixture with a contained mistake line and a contained alternative line') and no committed scene pairs both — fig 8.… |
| `P-PROJ-CROSS` | **VAC** | 06 §2.2 defines the projection PURELY in station space: s'(s)=∫ 1/c(seg) du with c>0 everywhere (strictly monotone, 06:105-112) and d'=d×width_exag with width_exag∈[1,WIDTH_EXAG_MAX=12]>0 (06:120,148… |
| `P-PROJ-IDENTITY` | **VAC** | 06:75 DEFINES the term: 'mode: "true" is the identity transform plus optional crop'; §2.5 P6 restates it ('mode:"true" with no window is the identity on (s,d)'). The 09 property asserts exactly this … |
| `P-PROJ-ORDER / P-PROJ-SIDE / P-PROJ-APEX-REL` | **VAC** | All three are algebraic identities of the same positively-scaled, monotone-in-station transform, proven in 06's own prose before 09 names them as tests. ORDER: s' strictly monotone because c>0 (06:11… |
| `A-ANCHOR-ERRORS` | exer | Half 1 discriminates at the exact boundary (#7 against 6 candidates) and is collapse-immune because anchors resolve against events, not glyphs. Half 2 names a fixture (`double`) that exists nowhere i… |
| `A-ESSES-GATE` | exer | road_ink = 0.2109 (max 0.2346 over all headings) vs the asserted floor 0.25; orient resolves to 0 at psi0=north (elongation 1.153 < 1.25) against the asserted 90. |
| `A-FIG83-MARKS` | exer | 6 facets over a 28.85 m window ⇒ ~5.77 m mean spacing vs the 1.0 m collapse epsilon (5.8x margin); but the facet schedule is solver-owned and unspecified, so the count is not derivable. |
| `A-FIG83-TOPOLOGY` | undet | Clause 1's margin is exactly `early_by_m = 10 m` — the fixture constant it purports to test; clause 2 is solver-owned and not derivable. |
| `G-MARK-COLLAPSE (unnamed marker-collapse golden)` | exer | Two gates on the same rule, four lines apart in the same section, assert different collapse colours; neither names a fixture. |
| `P-INK-GRAMMAR` | exer | 06's terminal-glyph table says a crash 'replaces the arrowhead'; P-INK-GRAMMAR asserts 'every trajectory has an arrowhead'. Both are shipped-V1 normative text. |
| `P-MARKS-EVENTS` | exer | 09:1624 asserts a 1:1 marker↔event map; 06:376 collapses N same-class events within 1.0 m to one glyph; 09:1631 asserts that collapse occurs on the fig-8.2 scene. Two of the three are unsatisfiable t… |
| `P-PROJ-CONTAIN` | exer | The only regime that can falsify P-PROJ-CONTAIN is lane_width·width_exag ≥ R (reachable at explicit width_exag ≥ 3.43 on book90's R12, and at ≥ 12 everywhere); the stated fuzz corpus varies roads and… |
| `P-PROJ-MARKER / P-PROJ-LEADER` | exer | MARKER reduces to the station-space identity (vacuous); LEADER is genuine but quantifies over a label set that design/ never commits for any figure. |
| `§5.2 AUDIT-MODE RE-DERIVATION` | undet | sweep VACUOUS; recheck EXERCISED; no tiebreak; implementation-contingent (renderer audit mode). |
| `§5.2 PROPORTION GATE — width_ratio` | exer | 3 of 4 shipped diagram-mode scenes fail the gate; only book90 (figs 8.1–8.3) passes. bookDoubleApex's feasible width_exag window [1.543,1.629] is disjoint from every value 06 §2.3 can produce. |
| `§5.3 PRESET-MILDNESS ROUND-TRIP` | exer | All four true-mode scenes are out of band; worst margin bookDoubleApex width_ratio 0.2917 vs floor 0.45 (35% below). The gate has no threshold and therefore cannot fail. |

**§6 interactive/budgets**

| gate | verdict | evidence |
|---|---|---|
| `C-ONE-CORE` | **VAC** | Spec-self-conceded HARD tautology. 09 §6 line 1739 states 'Under D1 this is the same ESM module imported twice, so the test is cheap.' ES module resolution is idempotent per realm: the viewer path an… |
| `C-SKEW-CLEAN` | **VAC** | Spec-forced equality (honest negative control). The gate stipulates the SAME engine AND SAME runtime; 05 §8.4's normative semver corollary ('equal engine_semver on the pinned runtime IMPLIES equal re… |
| `C-SKEW-DETECT` | **VAC** | The `detail` tier is masked by construction on the described fixture. Per 05 §8.4: story := recomputed.outcome != expected.outcome; detail := NOT story AND result_hash differs. The fixture is describ… |
| `C-BOOKMARKS` | n/a-design | SOFT identity-by-construction. Limb 1 'jump targets are EXACTLY result.events' is set(E)==set(E) if the stepper enumerates result.events — power only against a stepper that hardcodes a kind allowlist… |
| `C-CACHE-HONEST` | n/a-design | The 2-dp wire rounding the warm path introduces is <=0.005 m/station vs the wide<->runoff deadband 0.081 m (16.2x) and the class-flip scale 10 m (2000x), so the outcome-class limb is provably immovab… |
| `C-COLDSOLVE-BUDGET` | undet | The budget implies a required throughput of only 133 k RK4 steps/s (7.49 microseconds per step), which is 2-3 orders of magnitude below what the described integrator should achieve — but I cannot clo… |
| `C-COLOUR-DERIVE` | undet | The entire non-trivial content of the "no dead branch" claim reduces to ONE cell, hosted by ONE check on ONE preset: check 16 wrong_strategy_for_corner is the sole critical-severity check in the ship… |
| `C-COMPARE` | exer | On 04 §7's worked scene — the multi-line fixture design actually writes — `wide`==`good` at EVERY sample (governor inert, same derivation as C-SCENE-MULTIRIDE), so a ghost-state leak between them is … |
| `C-HUD-ANORETURN` | n/a-design | The closed form for a_noreturn is not restated anywhere in design/ in a form that can be evaluated — 03 §5.2 consumes it as a_lean = min(a_ssd, aLongAvail(...), a_noreturn(phi)) without giving a_nore… |
| `C-HUD-EQUALS-STATEAT` | n/a-design | SOFT identity-by-construction, not an empty-domain fixture defect. 07 §5 mandates the HUD read fields 'straight off' the InstantState (H := project(S)); under that mandate the gate's H(t)==S(t) is x=… |
| `C-OCC-TOKEN` | exer | Both arms of the discriminating pair are spelled out with concrete strings — the accepted spaced form `vehicle oncoming exit:c1 +8` and the rejected embedded form with its typed error id — so the tes… |
| `C-PHASE-MACHINE` | undet | The bookEsses chain-re-entry limb — the only limb testing the multi-corner branch of the opener table — depends on an `approach` band that is at most 3.000 m wide (6 resampled samples, 337 ms of scru… |
| `C-PHASE-TOTAL` | undet | Two of three limbs are guaranteed by 05 §4.1's own normative text and by the type; only the non-regression limb has independent content, and its reachability depends entirely on an unspecified fuzzer. |
| `C-POV-LIMIT-ALWAYS` | exer | Both markerStates are genuinely reached on the base fixture: at ds = 0.5 on book90, look: heading clamps 47-53 of 94 samples (crossover at s ~ 22.5-24.5 m depending on f) and places the rest. |
| `C-POV-LIMIT-CONSISTENT` | exer | Both `look` modes put the marker in genuinely different frame positions on the base fixture — look: heading clamps ~50 % of samples while look: limit_point places 100 % — so the "holds in both look m… |
| `C-POV-LOOK` | exer | Limb (a) 'markerState=placed under look:limit_point' is forced by the camera law and cannot fail. Under look:limit_point the camera aims AT the limit point, so the residual after clamp = max(0,\|bear… |
| `C-POV-OCCLUDE` | exer | The inequality holds by EXACT EQUALITY with zero margin — min height 1.8 m against a bar of 1.4 + 0.4 = 1.8 m — and three of the four occluder kinds sit precisely on the bar. |
| `C-POV-TRUE-GEOMETRY` | exer | The structural limb is a genuine import-graph lint that can fail and cannot be satisfied by equality — it is the one gate in this section that solves the identity-by-construction problem correctly, a… |
| `C-RAW-RETENTION` | exer | The predicate is a decidable structural property of a concrete artifact (count the sample arrays in a serialised envelope) with a definite falsifier, and the quantity it guards has a real magnitude: … |
| `C-RECOMPUTE-BUDGET` | undet | The warm gate is DOMINATED by C-COLDSOLVE-BUDGET by 9x: it can only fire first if the figure carries >18 lines; fig 8.6 carries 2. |
| `C-REFUSAL-ENVELOPE` | exer | The V1 governor never binds at the default vis_margin=1.0 on ANY shipped fixture (independently reproduced: on the only occluder-bearing fixture bookBlind, min sight_ride_m 23.50 m vs lean-aware ssd … |
| `C-SCENE-MULTIRIDE` | exer | `wide` and `good` are the SAME line: they differ only by vis=cautious, which is inert at vis_margin=1.0 on every shipped road (including one carrying bookBlind's hedge — governor binds only at 1.486/… |
| `C-SKEW-NEVER-BLOCKS` | exer | The stamp space is small and fully enumerable (4 per-line tiers x 5 figure tiers), and the ordering of operations makes the property falsifiable: 05 §8.4 computes skew AFTER the recompute, so a real … |
| `C-STATEAT-LAWS` | exer | Limb (c) angle-aware interpolation is the only limb with independent content and it cannot be discriminated on the named corpus. phi is bounded by phiMax=atan(mu): 45.0 deg at mu=1.0, 50.2 deg even a… |
| `C-STRIP-BANDS` | n/a-design | SOFT identity-by-construction. 05 §4.1 declares derived.phase 'one closed five-token set, SHARED VERBATIM with the controls strip's bands (06 §4)' and the opener table 'the single extension point — N… |
| `C-TREND-WINDOW` | undet | The `opening` token is emitted on ZERO samples of every occluder-free fixture, and no committed book scene carries an occluder — so on the whole committed corpus sight_trend is a two-valued channel (… |

**§7 vision-judge**

| gate | verdict | evidence |
|---|---|---|
| `A-FIG81-ENDPOINT` | exer | DERIVED the endpoint on the real geometry (constant-curvature committed-lean, inside-kiss min d==0.40, turn-in swept over the early band). Conjunct (b) is a pure tautology of the 06 §2.4 auto-window:… |
| `J1 colour-verdict` | exer | >= 12 scored line-colour pairs across 6 figures with 0 `na` escapes; J1 is one of only 3 of 8 rubric items with no `na` condition. |
| `J2 markers` | undet | `marks` is the only figure-level knob in design/ with no stated default (1 grep hit, value set only), and it is exactly the knob that sends J2 to `na`. |
| `J3 labels` | undet | Domain = callouts declared by six scenes, none of which is defined in design/; and 2 of J3's 3 named failure modes are already closed by 03 L1636's typed anchor failures and 06 L199-201's padding lay… |
| `J4 sight grammar` | exer | 21/21 station x lane-position cells and 5/5 lateral-offset cells occlude — the regime is reached for every legal placement of the vehicle in the opposing lane, not just one. |
| `J5 mistake legibility` | undet | Domain is 6/6 figures (never `na`), but the predicate has no threshold and its only under-operationalization safeguard (`flaky`) has an expected firing rate of ~0 at temperature 0. |
| `J6 projection disclosure` | undet | CHECKED the empty-domain premise against design/ and found a HARD, UNRESOLVED CONTRADICTION, so the domain is NOT decidably empty. FOR emptiness: 00-README L546 (v0.1 Ships 'render/ top-down in `true… |
| `J7 no fabrication` | undet | >= 6 ink classes are drawn on every conforming figure but appear in none of the 4 manifest facts §7.2 lists, so the predicate is violated by construction under its literal reading. |
| `J8 legibility floor` | undet | Minimum ink at 2x is 1.8 px and tier separation is 1.2 px — the 'lines distinguishable' clause cannot fail; the 'text readable' clause measures a font size that appears nowhere in design/06 (0 grep h… |
| `T-JUDGE-RECORD` | exer | grep of all of design/ for a gate asserting record.verdict=='pass' returns 0 hits. L1856 defines the overall verdict, L1872 is the schema field, L1888 is the re-judge-ceremony flip enumeration -- non… |
| `§7 step 2 mechanical leg (rasterizer + proportion g…` | undet | The proportion-gate half rides the SAME unresolved mode contradiction as J6. Under 00-README L546/L551 + 09 L2068 (true mode ships, diagram deferred), every v0.1 figure is exempt (06 L590) -> 'both g… |
| `§7.1 judge-identity validity rule` | exer | Field-set difference read directly from the two schemas: judge.json \|5\| minus record.judge \|3\| = {temperature, attempts} unrecorded. `temperature` is unrecoverable from the record entirely; `atte… |
| `§7.4 flake policy (3 attempts, 2-of-3 majority, `fl…` | exer | The majority rule itself is SOUND -- it is symmetric, so fail/fail/pass yields `fail`; it is NOT retry-until-pass and does NOT let a persistently-failing judge pass. The vacuity is in the `flaky` det… |
| `§7.4 re-judge ceremony (judge-version bump)` | undet | 3 of 5 `judge.json` fields are detectable by any gate; and the arbiter trigger covers pass->fail flips only, leaving fail->pass (loosening) flips unreviewed. |

**§8 philosophy / D8**

| gate | verdict | evidence |
|---|---|---|
| `effect_class "analysis" detector (effectAt deep-ine…` | **VAC** | 09:1956 defines effectAt('analysis',before,after)=deep-inequality of the recomputable analysis document. StandingReport wire shape read at 05:621-637 includes `reserve_checks:[checkId,…] // echoed fr… |
| `D8-HARNESS-effectAt (§8.1, unnamed mechanism)` | exer | Row schema 09:1929-1935 = {id,surface,field,fixture,perturbation:{from,to}\|'presence',effect_class,expect}; fixture and perturbation are author-free. grep of design/09 and design/01 finds NO rule fo… |
| `F-STANDING-WARN annex witness row (§8.1, unnamed)` | undet | The rung-3 pin holds only if the solved line radius lands in [12.40, 13.362) — a 0.96 m slice of the 2.70 m corridor — and the solver is not pinned; separately the detector (above) makes the row pass… |
| `New witness rows: --standing, --line, --corner, --s…` | n/a-design | No fixture, no perturbation values, and no effect_class assignment is given for any of the six; the D45 subset is additionally gated behind a spike that cannot currently run. |
| `T-D8-EXHAUSTIVE` | exer | The set-equality genuinely bites on schema drift in both directions — but its 'exactly one row' cardinality is contradicted by three multi-row obligations stated 20 lines below it. |
| `T-POS-EFFECT` | exer | The absence probe is a real differential (0.2 vs 0.9 = 1.89 m of lateral displacement); validation accepts with 11.6× margin and the move completes in 20.5 m of a 110 m window. |
| `T-POS-INEFFECTUAL` | exer | Rule 5 is genuinely the first failing rule (rules 1-4 all pass by construction) and required_over_m = 33.5653 m against the ≥33.5 bar kills all three L_req mutants; but achievable_dd_m has 46.9× slac… |
| `T-POS-OVERLAP` | undet | Rule 3 is genuinely reachable and cannot be pre-empted (rules 1-2 are satisfiable, rule 5 comes after), but neither turn_in.at_s nor the window bounds are pinned anywhere in design/, so the regime is… |
| `T-POS-SHORTFALL` | exer | Assertion is deficit_m>0 (one-sided, unbounded above) + 'outcome class unchanged' (affirmatively asserts NON-effect). On FX-POS-POSTCOMMIT (book90 solved + post-release position{f:0.1,over_m:8} on th… |
| `turn_in.hand witness row (§8.1, unnamed)` | exer | The row (09:1989-1992) asserts a DISJUNCTION: flipping an explicit hand 'observably changes the trajectory (different governing corner) OR yields BAD_RANGE/no_governing_corner'. Let E=trajectory-chan… |
| `vis_hold_f witness row (§8.1, unnamed)` | undet | V2's clip rule makes vis_hold_f inert over [0, 0.8316] — 83.2% of its [0,1] domain — on the shipped fixture; whether the row is green is entirely an artefact of the author's unspecified {from,to}. |
| `vis_margin witness row (§8.1, unnamed)` | exer | Row asserts 'vis_margin observably changes the solved line under vis=cautious, rejected INEFFECTUAL under vis=none'. The only D46-locked fixture hosting the visibility mode is bookBlind, where blind(… |

**§9–10 phase gates**

| gate | verdict | evidence |
|---|---|---|
| `C-SAVEWIN-NO-INK (v0.1 sentinel instance)` | **VAC** | Empty-domain vacuity confirmed from the spec. The save-window verb ships in v0.2: A-SAVEWIN-VERB (defined 09:1330) is listed only in the v0.2 row (09:2066), alongside the whole C-SAVEWIN-* suite; 09:… |
| `A-FIT-REFUSE` | undet | The refusal regime is 'outside the vocabulary', and the road DSL's sweep bound is what decides it — but the fixture states only 'a U-turn'. `F-AN-CIRCLE` is `R 30 ^270` (270° sweep) and is a COMMITTE… |
| `A-FIT-ROUNDTRIP` | undet | The gate's own worked number contradicts the preset it cites: `premature` has `early_by_m = 10` by default (03:862), so its trace reports turn-in 10 m early, not '≈ 6 m'. And 'within tolerance' names… |
| `A-JITTER-LATE-APEX` | undet | `≥` between two survival fractions with no spread vector, no N, and no non-degeneracy clause. If the jitter is small enough that both lines stay contained on every sample, `survival = 1.0 ≥ 1.0` and … |
| `A-STANDING-RESERVED` | exer | φ = 36.25° at the TIGHTEST rideable radius (12.40 m) vs `phiReserve` = 40.365° — a 4.11° pass margin that holds for every line the solver could choose; and check 10 passes because `book90` carries no… |
| `A-STANDING-WARN-BAND / G-STANDING-BITES rung 3` | undet | At 38 km/h, `warn` requires the solved line's tightest radius ∈ [11.358, 13.362] m — the inner 36 % of a 2.70 m corridor. The doc's own premise ('a doctrinally correct out-in-out line rides a LARGER … |
| `C-SAVEWIN-BUDGET` | undet | The `runs` half is structurally exact (the +5 is the 5 mandatory grid points, the ≤8 is `HORIZON_BISECT_MAX`), and reproduces 04:1139's '≈ 80 runs on book90 at 0.5 m'. But the fixture is unnamed and … |
| `C-SAVEWIN-CLIP` | undet | Two conjuncts over two different surfaces, neither with a fixture. The corrective-ghost limb requires `corrective ≠ null`; `P-SAVEWIN-ANCHOR` (09:641) scopes itself to 'every fixture with `corrective… |
| `C-SAVEWIN-HUD` | undet | The universal ranges over 'every displayed save-window field'. Two of the five `G-SAVEWIN-*` goldens return objects with no scalars at all — `G-SAVEWIN-NEVER` (`status: "never_open"`, 'no scalar', 09… |
| `C-SAVEWIN-REFUSE-COARSE` | exer | Resolution law `scan_ds/v_max ≤ HORIZON_TAU_QUANTUM_S = 0.1 s` ⇒ 2.0 m needs `v_max ≥ 20.0 m/s = 72 km/h`. The fixture enters at 9.444 m/s and terminates in-corner; the refusal bites with a factor of… |
| `G-SAVEWIN-GRID` | undet | The 1.0 m rung requires `v_max ≥ 1.0/0.1 = 10.00 m/s = 36.00 km/h`. Every preset in the corpus enters BELOW that — max entry is 34 km/h = 9.444 m/s — and the τ-domain opens at turn-in, where speed is… |
| `G-STANDING-BITES` | exer | Set-equality over a declared witness map is the correct anti-vacuity form — it goes RED when a rung is unwitnessed, it cannot pass over an empty domain. Two of its five witnesses are however derivabl… |
| `G-STANDING-NO-HASH-MOVE` | exer | `spec_hash` = fnv-1a over canonical `{road_spec, occluders, hazards, this line's source}` (05:804) — the doctrine pack is not an input, so the spec_hash half is true by construction. But `result_hash… |
| `P-FIT-LINE-PROVENANCE` | exer | Byte-identity between two sample arrays is the strongest available assertion form and admits no `na`, no equality-by-degeneracy and no dead branch; its domain is non-empty exactly when `A-FIT-ROUNDTR… |
| `P-JITTER-DETERMINISM` | exer | A determinism property over a generated input space with its three free parameters explicitly named; it has the same shape as `P-DETERMINISM`/`P-EXPORT-DETERMINISM`, which are v0.1 gates. |
| `P-JITTER-PURITY` | exer | An import-graph lint over a non-empty module set, at the moment the jitter code exists (promotion time) — the negative conjunct ('no RNG import') is decidable and the positive conjunct ('every jitter… |
| `PHASE-GATE-v0.1 (composite)` | exer | The prior finding's enumeration is TRUE but its VACUOUS classification is not. Independently confirmed: all 8 of §5.1's P-PROJ-* projection invariants (ORDER, CONTAIN, SIDE, APEX-REL, CROSS, IDENTITY… |
| `PHASE-GATE-v0.2 (composite)` | exer | Enumeration TRUE, VACUOUS classification not. Independently confirmed: 7 P-STANDING-* (TOTAL, PURE, OUT-OF-HASH, NA-CAP, RUBRIC-SENSITIVE, STAMPED, STRICTER-THAN-CLEAN) and 11 P-SAVEWIN-* (ANCHOR, HO… |
| `PHASE-GATE-v0.3 (composite)` | exer | Enumeration TRUE, VACUOUS classification not. Independently confirmed: §6 defines 26 test ids; only 8 appear anywhere in §10; 18 are absent. Of the absent, 3 are POV tests — C-POV-LIMIT-ALWAYS (09:17… |
| `§9 tombstone claim / A-STANDING-TOMBSTONE placement` | exer | I verified the §9 closure claim mechanically: none of the four struck ids appears anywhere in §10 (lines 2053-2136). The claim is true. |

**false-negative hunt (1-213)**

| gate | verdict | evidence |
|---|---|---|
| `A-AN-BRAKE` | **UNSAT** | Asserted stop s*=177.9342 m (tol +/-0.01). F-AN-BRAKE gives NO slew_mss, so A_SLEW_DEFAULT=6.0 m/s^3 (02 sec5.2) applies: the brake command ramps 0 -> -3.0 over 0.5 s, losing only 0.75 of the 1.50 m/… |
| `A-AN-RK4` | **UNSAT** | Closed forms v(t)=10+2t, x(t)=10t+t^2, v(s)=sqrt(100+4s) at <=1e-9 rel assume constant a=2.0 from t=0. F-AN-ACCEL gives NO slew_mss, so the 0->2.0 command ramps at 6.0 m/s^3 over 0.3333 s, accruing a… |
| `P-DETERMINISM` | undet | On a warm `solved` cache the second run 'skip[s] the search, run[s] the engine once on the cached plan' (05 §8.1 L826-828), so run 2 never executes `solve/` — one of the five modules 09 §3.1 quantifi… |

**false-negative hunt (1199-1370)**

| gate | verdict | evidence |
|---|---|---|
| `T-COLDSTART-RECORD` | **VAC** | The discriminating variable is the cold-start pass rate (3/3 bar); the assertion reads only schema_output_hash, which is invariant under that variable. 0 of the record's specified fields carry the 3/… |
| `A-CORR-EXPLAIN` | undet | Swept every admissible premature turn-in station on the hand=R mirror: the detect->physical-edge strip peaks at 0.886 s of travel, against the 1.000 s the corrective shot needs to fire. If that holds… |
| `A-RECIPE-B` | undet | On a right-hander the pavement between f=1 and the off_road trigger is 3.90 m; on the left-hander the pin was blessed on it is 0.40 m — 9.75x. The auditor's clearing number (apex shifted 25.5 pts vs … |
| `A-SAVEWIN-VERB` | undet | 3 of the 5 values in SaveWindow.status's closed set emit no derived scalar at all, so on those the byte-equality compares two identical refusal stubs and exercises zero save-window arithmetic — and t… |

**false-negative hunt (1368-1555)**

| gate | verdict | evidence |
|---|---|---|
| `A-CATALOGUE-RESOLVES` | undet | The stated domain provably contains non-resolving ids by design: at least two shipped fixtures put a tombstone in an expect_fail on purpose -- `expect_fail: ["sight_vs_stopping"]` (09:1453, A-RENAME-… |
| `A-PACK-PROVENANCE` | exer | The discriminating branch is ^book: -> resolve against book_text/ -> SCHEMA/source_unresolved (01:951-957). It is never reached. Continuation pack: 9 threshold sources, ALL literally 'TUNING', 0 book… |

**false-negative hunt (1551-1660)**

| gate | verdict | evidence |
|---|---|---|
| `A-ESSES-GATE (conjunct 4: true-mode)` | undet | True-mode bookEsses: road_ink = 0.1738 against the band floor 0.25 — 30.5% below it. Whether that counts as "near the bands" is undefined: no tolerance for "near" exists anywhere in design/06 or desi… |
| `§5.2 PROPORTION GATE — frame_aspect` | exer | frame_aspect is out of band on 0 of 4004 figures — including bookDoubleApex, whose tight drawn frame is genuinely 2.105:1 stretched. 06 §2.4 pads it to exactly 0.5500, the gate's own bound, before 06… |
| `§5.2 PROPORTION GATE — straight_share` | exer | regression guard: a C_STRAIGHT remap regression raises book90 to 0.598>0.45 and the gate fires (quantifier Q7). Headroom in the passing case is not vacuity. |

**false-negative hunt (214-400)**

| gate | verdict | evidence |
|---|---|---|
| `C30-heldbrake` | **VAC** | Over a full (f0 ∈ [0,1] × onset-lean ∈ [20°,36°]) sweep the brake-caused OUTWARD excursion is 0.0000 lane fractions — exactly zero, at every cell. The line moves INWARD and terminates `off_road` on t… |
| `C30-chop` | undet | A throttle cut keeps a_cmd ≥ 0, so b_dem = clamp(−a_cmd, 0, mu·G) ≡ 0 and su_sustained ≡ 0 for the entire mistake. The ONLY window with phi_dot_su ≠ 0 is the transient ramp, of duration Δa/40 s. At Δ… |
| `C30-deeplean` | undet | Under the inherited A_SLEW_DEFAULT = 6.0, b_dem reaches 9.0 only at t = 1.500 s; at f0 = 0 the run terminates off-road at t = 1.139 s, so b_dem − b_del peaks at 6.83 − 5.336 = 1.50 m/s², not the pinn… |
| `G-CF-PRECONDITION-TABLE` | undet | All six ratios reproduce exactly (0.8914 / 0.6940 / 0.8914 / 0.7896 / 0.7255 / 1.1886 vs the doc's 0.89 / 0.69 / 0.89 / 0.79 / 0.73 / 1.19), and ±0.01 is discriminating (catches a 0.19 km/h entry mov… |

**false-negative hunt (401-465)**

| gate | verdict | evidence |
|---|---|---|
| `Bless-script mechanical refusal (09 L426-427, resta…` | **VAC** | The refusal (exit 3 unless A-AN-* AND D-BOUNDS green in the same invocation) is PROSE ONLY -- 09 L187-189 and L426-427 -- with no named test, no fixture, no red-layer invocation. rg over design/*.md … |
| `Development-phase / pre-first-bless clause (09 L457…` | **VAC** | Central question answered by derivation: the analytic fixtures do NOT exercise the solver at all. All five A-AN-* fixtures (F-AN-CIRCLE turn_in lean_deg=25 + throttle accel=0; F-AN-BRAKE brake decel=… |
| `T-HASH-TRIPWIRE, plan half (D29 extension, 09 L407)` | undet | The auditor's decisive number is wrong by 5.48e14x on the quantity it names. turn_in_s is not a continuous f64 with a 1.776e-15 m ULP — it is one of N_SWEEP = 12 grid points spaced 0.97385 m apart, w… |

**false-negative hunt (465-605)**

| gate | verdict | evidence |
|---|---|---|
| `P-CORR-PURE` | undet | On every one of the five fixtures the auditor named as the domain, correctiveShot returns fail_reason = `departed_before_reaction` and NO shadow trajectory is ever integrated: on the left-hand book90… |

**false-negative hunt (735-900)**

| gate | verdict | evidence |
|---|---|---|
| `S-CONT-SEPARATION-v2 step 1 (the sight measurement)` | **VAC** | Re-derived via fg.sight_from: s_limit f=0.0 = {34.0,35.0,36.25,37.75,39.5}; f=1.0 = {36.0,37.0,38.25,39.5,41.0}. MAX s_limit = 41.000 < s_end 45.3215 -> 4.3215 m of margin INSIDE the corner at every … |
| `S-CONT-SEPARATION-v2 pass condition 1 (\|{k_refuted…` | undet | 25 of the 30 cells are pinned at k_refuted = 0 by arithmetic that no free parameter in the grid can move; the entire question rides on 5 cells (bookBlind cut-in), and those flip on the phase-0 comman… |
| `S-CONT-SEPARATION-v2 pass condition 2 (non-collinea…` | undet | The clearance's decisive claim — 'every grid cell's sight_ride_m is 24.28-42.36 m, i.e. entirely outside the band (15.82, 23.64)' — is true only at a0 = 0. The corpus minimum, 24.283 m at the bookBli… |
| `S-CONT-SEPARATION-v2 pass condition 3 (sign stabili…` | undet | On 20 of 30 cells k_refuted(none) = k_refuted(cautious) = 0 at every one of the three escape_decel values, so sign(0-0) = 0 is trivially constant and the condition PASSES on those cells while measuri… |
| `S-CONT-SEPARATION-v2 step 0 (prerequisites)` | undet | Clause (a)'s step-bound half is an algebraic identity with ZERO slack, not a measurement: max over all 49 (kappa_L, sigma) pairs of \|sigma\|*h(sigma) = 0.142857143, exactly equal to kappa_step_max_1… |

**false-negative hunt (895-1060)**

| gate | verdict | evidence |
|---|---|---|
| `P-CONT-MEMBERS-DISTINCT` | undet | `k_probed` is never defined anywhere in design/ or review/ -- 3 occurrences total (09:895 asserting on it, 03:1087 saying K_MEMBERS bounds it, 03:1432 declaring it a Probe field), 0 definitions. If i… |
| `P-ESCAPE-HONEST` | exer | Escape reach (phase 0 = ridden plan unchanged for t_react, phase 1 = brake at escape_decel to v_floor): coast a0=0 -> 23.6440 m; brake a0=-1 -> 20.1626 m; throttle a0=+1 -> 27.4588 m -- reproduces 04… |

---

## 9. Undetermined & not-assessable

**UNDETERMINED** (67) includes the contested set in §5 plus gates decided-only in the sweep
that were never re-derived; the measurement that settles each is in §5 or the sweep record.
**NOT ASSESSABLE from design/** (34) need an engine, solver, or renderer to decide.

A compact list of the not-assessable set (needs runtime):

`A-AN-MEMBER-KAPPA`, `A-COMMIT-VERB`, `A-CONT-PACK-DATA-ONLY`, `A-FIG81-VEHICLE`, `A-RECIPE-E`, `A-RECIPE-K`, `A-SOLVED-PLAN-VALIDATES`, `A-STANDING-WARN-BAND`, `A-SWEEP-ROOTS`, `C-BOOKMARKS`, `C-CACHE-HONEST`, `C-COMMIT-BUDGET`, `C-HUD-ANORETURN`, `C-HUD-EQUALS-STATEAT`, `C-STRIP-BANDS`, `F-SIGHT-OUTSIDE`, `G-APEXLIST`, `G-COMMIT-BLIND`, `G-COMMIT-ENTRY`, `G-SAVEWIN-INTERMITTENT`, `G-SAVEWIN-NEVER`, `G-SAVEWIN-RUNOFF`, `New witness rows: --standing, --line, --corner, --scan-ds, …`, `P-ACCEPT-GRADE`, `P-ACCEPT-MONOTONE`, `P-APEX-TARGET-TYPED`, `P-COMMIT-MEMBER-DEPENDENT`, `P-COMMIT-MONOTONE-V`, `P-CONT-FILTER-TWO-SIDED`, `P-CONT-MONOTONE-SIGHT`, `P-VIS-SELFCHECK`, `S-CONT-SEPARATION (retired)`, `Standing re-bless obligation (09 L447-455)`, `T-COLDSTART`
