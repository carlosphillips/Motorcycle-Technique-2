# Scope & Doctrine — What linelab Teaches and What "Correct" Means

## 1. What this document covers

This document defines linelab's goals as testable product requirements, restates
the book-as-doctrine principle for the new tool, and specifies the line-selection
doctrine itself: the ideal line, the canonical mistakes, the special-case corners,
and the visibility rules. It also records the failed-lines-first-class doctrine
reversal (D6) and the scope boundary with its honest-limitation placard policy.
Physics is specified in `02-physics-model.md`; schemas and the mistake compiler in
`03-roads-scenarios-and-visibility.md`; the doctrine check catalogue is Appendix A
of this document, shipped as the `parks-street/2` rubric pack; the check record
shape and the verdict contract live in `05-result-contract-and-inspection.md`.

---

## 2. Goals, as testable requirements

linelab exists to make road-speed line-selection doctrine **causal, inspectable,
and easy to author**. Each goal below is phrased so that its satisfaction is a
checkable property, not a mood. Goals are delivered by phase (`00-README.md`
§Build phasing); a goal's test runs from the phase that delivers it.

- **G1 — Every drawn line is a ridden line** *(phase v0.1)*. No path geometry is
  ever authored; every line in every view is an integrated trajectory from
  `core/`. *Test:* no input surface accepts path points, radii-of-line, or an
  apex (D7); a grep for an `apex` input field across `plan/` schemas finds
  nothing.
- **G2 — Full state at any point** *(phase v0.2)*. Any physical or control
  quantity the model computes is recoverable at any station or time on any line
  via `stateAt` (contract in `05-result-contract-and-inspection.md`). *Test:* the
  HUD can be populated entirely from one `stateAt` call.
- **G3 — Steppable animation** *(phase v0.2)*. The viewer scrubs a timeline over
  every line in a scenario, with named jump points (turn-in, apex, crash
  instant). *Test:* the stepper in `07-viewer-animation-and-pov.md` renders any
  sample index without re-running the solver.
- **G4 — Agent-first authoring** *(phase v0.1)*. An AI agent can set up a *new*
  scenario correctly on the first try from `schema` + `explain` output alone; a
  compound figure (road + good line + mistake line + markers) takes ≤ 6 lines of
  scene text or one CLI command. *Test:* the recipes in
  `08-cli-and-agent-interface.md` run from a clean checkout with no other
  documentation.
- **G5 — Failed lines are first-class** *(authoring/sharing v0.1; inspection
  v0.2)*. A mistake line is a one-liner to author, and is shareable, loadable,
  and per-instant inspectable exactly like a good line (D6). *Test:* the viewer
  can scrub a mistake line's trajectory and HUD.
- **G6 — Roads are one-liners** *(phase v0.1)*. A road, including occluders, is
  expressible in a single DSL line for every corner archetype in scope. *Test:*
  every archetype in §5 has a worked DSL example in
  `03-roads-scenarios-and-visibility.md`.
- **G7 — Book-figure parity** *(phase v0.1)*. For each line diagram in *Total
  Control* Chapter 8 (figs 8.1–8.6), linelab produces an equivalent figure from a
  scene file. *Test:* the per-figure mapping in §4–§6 is covered by shipped
  example scenes.
- **G8 — Book-compact diagrams** *(phase v0.1)*. Exported top-down figures land
  inside the measured book proportion band (road-width:radius ≈ 0.55–0.9 as
  drawn, straights cropped) — via the true-scale presets in `true` mode until the
  diagram projection (D2) ships, and via the projection's declared mode
  thereafter. *Test:* the proportion gate in `06-rendering-and-projection.md`
  passes on every shipped figure in either regime.
- **G9 — Rider's-eye view** *(phase v0.3)*. Every scenario renders a
  first-person POV at any sample, with the limit point marked and occlusion
  visible. *Test:* the POV contract in `07-viewer-animation-and-pov.md`.

---

## 3. Book-as-doctrine

The ground truth is Lee Parks, *Total Control*, committed at the repo root and
extracted into `book_text/` and `book_images/`. The governing rule is unchanged
from the prior project: **when linelab and the book disagree, the book wins.**
Numeric agreement is judged by correct conversion (mph→km/h ×1.609, ft→m ×0.3048),
never by string match, and a discrepancy is a finding only when it changes the
teaching.

The prior project's two-axis judgment carries forward with a changed division of
labour:

- **Axis A — physical plausibility — is true by construction.** Because of G1,
  every line was integrated by the engine; there is nothing to audit. This axis
  moves from "inspect the picture" to "trust the pipeline," and the pipeline is
  what gets tested (`09-verification-and-testing.md`).
- **Axis B — doctrinal correctness — is computed.** A fixed check suite grades
  each trajectory against the tenets in §4–§6 (check ids, arithmetic, and
  thresholds are enumerated in Appendix A; `05-result-contract-and-inspection.md`
  owns only the record shape). The verdict is a property of the trajectory,
  computed identically no matter who authored the inputs.
- **Legibility and book-likeness** — formerly a cosmetic report category — gain a
  mechanical instrument: the proportion gate (`06-rendering-and-projection.md`)
  measures what the prior regime could only eyeball, and the render-then-judge
  loop (`09-verification-and-testing.md`) covers what remains judgment.

Colour is still a hard doctrinal signal, now under **colour law v2 (D9)**.
`outcome` itself is physics-only — the closed set `crash > runoff > wide >
stopped > contained` (`05-result-contract-and-inspection.md` §6.1) — and never
reads a check; the rubric decides doctrine; `quality ∈ good | caution | failing`
composes the two as the single total colour function
(`06-rendering-and-projection.md` §5.1): `failing` iff outcome ∈ {`crash`,
`runoff`, `wide`} or any critical-severity check failed; `good` iff the line is
clean (`contained` with zero applicable check fails); `caution` otherwise
(contained-with-fails, and every `stopped` run). Green = `good`, amber =
`caution`, red = `failing`; the line's authored *role* (`ideal`, `alternative`,
`mistake`, `reference`) is carried as a label — printed in the legend — never as
a colour override. A figure may carry any number of lines. This preserves the
prior rule that a correctly-shaped line in the wrong colour is a failure, while
fixing its two defects: the single-amber-slot cap and the "contained linked good
line renders red" bug — under v2 a contained-but-sound chained line renders green
or amber per its own quality, and fig 8.4's double-apex companion renders red by
mechanism — it fails the critical check `wrong_strategy_for_corner` (Appendix A,
check 16) — not because someone painted it.

---

## 4. The line-selection doctrine

### 4.1 Vocabulary

- **Turn point (turn-in):** the station where steering begins. *"Creating the
  ideal line through a turn starts with the choice of a turning point"* — the
  master decision; everything downstream emerges from it (D7).
- **Apex:** the trajectory's closest approach to the inner usable edge — a
  *measured* minimum of lane fraction, never an input. Apex timing is the
  percentage of the corner's cumulative swept angle consumed at that station.
- **Exit:** the first station at/after the apex where heading has returned to the
  road's exit heading within `EPS_EXIT_DEG = 1.0°` (TUNING).
- **Lane fraction `f`:** hand-independent lateral position; `f = 0` inner usable
  edge, `f = 1` outer usable edge, `f > 1` past it. The primary doctrine-facing
  position coordinate.
- **Danger zone:** the high-lean band (at or beyond the reserve lean) where the
  bike is most vulnerable; doctrine minimizes time spent there and entries into
  it.
- **Reserve:** the gap between current demand and the physical ceiling — lean
  reserve (`phi_reserve` vs `phi_max`) and grip reserve (grip margin). The street
  rider's surplus is banked as hazard reserve, not spent on speed.

### 4.2 The ideal line

The canonical target, verbatim across the project:

> **a single smooth-arc, late-apex, outside–inside–outside path.**

Unpacked: enter wide (`f` high), delay the turn point, steer quickly to the
needed lean in one input, touch the inside *past* the corner's geometric middle,
and drift back out already pointed down the road, rolling on throttle from apex
to exit. The governing physics: a larger-radius line needs less lean at a given
speed (`tan phi = v²/(g·r)`), so the straightest line through a curve maximizes
traction reserve — and sustainable speed grows as `v ∝ √r` (*Arc = Speed*). The
street discipline is *slow in, fast out*: err toward a slower entry and a
stronger exit. The default is **lane-constrained**: the usable corridor is the
rider's own lane minus a bike margin, because the outside of the road is the
oncoming lane. Trail braking is a separately-labelled advanced variant, not the
clean baseline — the baseline is brake-complete-then-quick-steer.

### 4.3 The canonical mistakes catalogue

The mistake kinds are the closed set from `00-README.md` §5, in two sub-families.
The **execution sub-family** (`premature`, `premature_contained`, `slow_steer`,
`fifty_pence`, `chop`, `overspeed`) perturbs how the plan is ridden: each kind is
a named one-line perturbation of a solved good line — **exactly one
control-channel delta** (steering actions, longitudinal actions, position
actions, or a rider rate cap), applied as one contiguous replacement; values
derived *inside* the replacement (a probed committed lean, facet magnitudes) are
engine-probed consequences of the delta, never independent author inputs. The
**misjudgment sub-family** (`underread`, `overread`) perturbs what the rider
believed: the plan is solved on a **believed road** — one geometric parameter of
one corner — verified clean there, literalized, and executed on the actual road
(`03-roads-scenarios-and-visibility.md` §7.4;
`04-solver-and-authoring.md`). The one-perturbation rule spans both: a compiled
teaching line differs from its reference in exactly one control **or** one
belief, never both. Every kind is compiled by the mistake compiler
(`03-roads-scenarios-and-visibility.md`) and forward-run through the real
engine; the outcome is the engine's, never asserted by the compiler.

**Outcome classes are pinned in `03 §7.1` — the single normative,
machine-readable pin table (admissible set plus a single-class fixture pin per
kind), which also feeds `schema mistakes` and the mistake oracle
(`09-verification-and-testing.md` §4). The causal chains here are teaching
prose; the outcome column below is descriptive, restating each kind's fixture
pin on its named oracle fixture.**

| Kind | The rider's error | Causal chain | Outcome (descriptive; pins in 03 §7.1) | Book mapping |
|---|---|---|---|---|
| `premature` | Turns in too soon and commits lean to kiss the inside early (the committed lean is engine-probed for the early station; `early_by_m = 10` default) | early apex → geometry points the exit at the outside → forced wide | `runoff` on `F-ORACLE-90` (the left-hand `book90`; the corrective is infeasible there) | fig 8.1's red line — the book's own words, "premature turn point" |
| `premature_contained` | Turns in too soon with the eased (`tangent_inside`) target | early apex → exit drifts outward, absorbed by remaining lane | `contained`, with a mandatory `late_apex` fail — the error you got away with on street reserve | the early turn-in absorbed by street reserve |
| `slow_steer` | Takes too long from upright to full lean | long roll-in eats corner angle → line runs deep and wide; long danger-zone dwell | `runoff`, with a mandatory `quick_steer` fail | fig 8.2 Slow Steering |
| `fifty_pence` | Multiple partial steering corrections (`facets = 6`; the first facet `early_by_m = 10` early) | faceted line, several lean humps; usually from eyes not through the turn | `wide`, with a mandatory `single_input` fail | fig 8.3 Fifty-Pencing |
| `chop` | Abruptly cuts throttle (or grabs brake) mid-corner | stand-up effect sheds lean; rider freezes; line straightens outward | `runoff`, failing `throttle_rule`'s chop leg | Ch. 9 throttle doctrine |
| `overspeed` | Enters faster than the line supports | required lean exceeds reserve/ceiling; corrective may be infeasible | `runoff` on `F-ORACLE-DR` (admissible {`wide`, `runoff`, `crash`}) | the *slow in, fast out* rule, violated |
| `underread` | Believed the corner less demanding than it is (misread radius or sweep; on a taper, "believed the entry radius holds" is the zero-param default) | plan solved clean for the believed corner → the actual road tightens past the literalized plan → wide and mispointed | `runoff` on the decreasing-radius fixture | the blind decreasing-radius trap entered on a constant-radius belief |
| `overread` | Believed the corner more demanding than it is | over-slow, over-cautious line | `contained` with failed checks (quality `caution`) | the timid line; "expect the unexpected" ridden too literally |

fig 8.1's red line is authored as `premature` — the same words the book prints
beside it; the teaching table above states each kind's pinned outcome. Every
input surface that lists mistake kinds (`schema mistakes`, `explain`) prints the
same normative source — each kind's admissible outcome set and single-class
fixture pin (`08-cli-and-agent-interface.md` §5.1) — so an agent picks correctly
on the first try.

All mistakes share the book's consequence: a forced wide exit, magnified with
speed — and most single-vehicle cornering crashes are exactly that.

---

## 5. Special-case corner doctrine

Each special case shifts a threshold or exempts a check; none introduces new
physics beyond Tier 1R.

- **Decreasing radius** — "the dreaded one." Doctrine: slower entry, deeper and
  later turn point, still a single late apex; the late-apex bar moves later
  (apex past 60 % of swept angle rather than 50 %). Geometry: a `taper`
  (clothoid) segment. The book's fig 8.4 draws the correct single-late-apex line
  green and a double-apex *strategy* line red — that red is computed, not
  painted: the companion records two apexes on a decreasing-radius corner and
  fails `wrong_strategy_for_corner` (Appendix A, check 16, the sole
  critical-severity check), which renders `failing`/red while fully on-road and
  downgrades to `warn` exactly under the book caption's sanction (blind at
  commitment *and* significantly slower entry). Both lines are full solved
  strategies (the companion authored `role=alternative`, with
  `accept=best_failing` where the pinch defeats contained convergence at equal
  entry), not perturbations.
- **Increasing radius** — apex comes *earlier*, throttle earlier and harder;
  late-apex classification is not applicable (`late_apex` reads `na`).
- **Double apex** — the legitimate two-touch line on a corner whose shape rewards
  it (the book's fig 8.5, drawn green there). It requires by definition at least
  one mid-corner correction, and is explicitly distinct from fifty-pencing: a
  declared `style=double_apex` line is permitted exactly two steering inputs —
  three or more always fail `single_input` regardless of any declaration
  (Appendix A). The plan shape is two `turn_in` actions with a drift/roll phase
  between them; the drift back to the outside between touches emerges from
  roll-on widening the arc. The *failed* line of fig 8.5 — a plan solved for the
  ordinary 90° corner the rider *believed* they were in, executed on the
  compound that exists — is authored as a misjudgment (a believed road, §4.3);
  the run-wide slice is the physics that makes the attempted save fail:
  sustained hard braking at lean stands the bike up and forces it wide
  (`02-physics-model.md` §5). *Design requirement:* a solved double-apex plan
  must record **two distinct apexes** — ≥ 2 entries in the corner group's
  recorded `apexes[]` list under the one hysteresis detector (prominence ≥
  `APEX_PROMINENCE_F = 0.08` (TUNING), separation ≥ `APEX_MIN_SEP_M = 5.0 m`
  (TUNING); `05-result-contract-and-inspection.md` §6.3) — a solver acceptance
  predicate (`04-solver-and-authoring.md`), decidable on the verdict record.
- **Linked turns / esses** — think more than one corner ahead: each exit is the
  next entry, and a mistake amplifies through the sequence (fig 8.6 shows an
  early turn point compounding corner after corner). Requirements: chained
  solving with exit-to-entry continuity (`04-solver-and-authoring.md`), and
  per-corner chained mistakes — the same named perturbation applied at every
  corner of the chain — as a first-class mistake mode
  (`03-roads-scenarios-and-visibility.md`). Under colour law v2 a contained,
  flowing chained line renders by its own verdict — graded by the chain-aware
  checks 13–15 (Appendix A) under chain-mode applicability; the prior "lone
  linked line renders red" defect is structurally gone.
- **Hairpins at road speed** — in scope whenever the corner is not in the
  refused super-tight regime (see §8). Doctrine is the standard late-apex method
  with a slower entry; nothing special beyond geometry.

---

## 6. Visibility doctrine

Blind corners are where line selection stops being geometry and becomes risk
management. The doctrine, synthesized from the book's blind-corner guidance and
the limit-point method:

- **The limit point** is the farthest station of road surface the rider can
  actually see — the point where the road visually closes. Its *trend* as the
  rider moves is the speed governor: approaching (sight shrinking) → slow down;
  steady → hold; receding (sight opening) → the corner is releasing and speed
  may build.
- **Ride within your sight:** at every instant, stopping distance must fit
  inside sight distance: `ssd(v, phi) ≤ sight_ride_m` — the lean-aware stopping
  model (`02-physics-model.md`, `03-roads-scenarios-and-visibility.md` §5.2)
  against the sight distance recorded along the rider's own path. Sight distance
  is speed-independent ray-cast geometry; only stopping distance varies with
  speed and lean — the two channels are never conflated. Limited sight therefore
  caps safe entry speed.
- **Hold wide to open the sight line:** on a blind bend, staying wide (high `f`)
  moves the eye laterally and pushes the limit point deeper into the corner —
  the rider literally sees farther. This is *why* the sight ray is cast from the
  **rider's actual position**, not the road centreline (D4): with a centreline
  eye the doctrine's central positioning advice would be invisible to the model.
  The delayed turn-in of the ideal line and the sight-opening wide entry are the
  same manoeuvre — the doctrine's geometry and its risk logic agree.
- **Keep a lean reserve on blind corners:** commit less than the usual reserve
  (a blind-corner lean cap), because the hazard you cannot see yet may demand
  the remainder.
- The book's fig 8.1 encodes this visually: dashed sight lines from each turn
  point, an obstruction (the bush), and an oncoming vehicle. The equivalent
  linelab figure is a one-scene composition: occluder + vehicle + two lines +
  per-line sight rays (`03-roads-scenarios-and-visibility.md`,
  `06-rendering-and-projection.md`) — the on-road vehicle is both an opaque
  occluder and a measured sight target: each line records a `hazard_visible`
  event at the first sample whose eye actually sees it.

Visibility quantities (`sight_m`, `sight_ride_m`, `ssd_m`, limit point, trend)
are recorded per sample so that an agent can *choose between lines on visibility
grounds* — e.g. author a wide-entry and a tight-entry line and compare sight
margins station by station (G5, G2). Position intent is expressed with effectual
`position` plan actions (D8; semantics in
`03-roads-scenarios-and-visibility.md`).

**Variability is the doctrine's actual subject.** The book's argument for the
late apex is probabilistic, not geometric: reserve exists because the corner you
planned is never exactly the corner you get — "expect the unexpected" is a claim
about distributions of entry speed, grip, and placement, not about a single run.
linelab's engine is deliberately deterministic
(`09-verification-and-testing.md` §3.1); a single run therefore shows the
*margin* a line banks, and only an ensemble of perturbed runs can show what that
margin *buys* — how many of the rides you might actually have ridden survive on
each line. That ensemble mode is a deferred design
(`08-cli-and-agent-interface.md` §Deferred design notes, v2); until it ships,
the per-sample reserve channels (grip, lean vs ceiling, sight margin) are the
honest single-run proxy, and no figure claims more than one run's worth of
evidence.

**What lies past the limit point.** This section concedes that a single run shows
the margin a line banks and cannot show what that margin buys. The continuation
envelope (`03-roads-scenarios-and-visibility.md` §7a) is the deterministic,
set-membership answer to that concession: no RNG (D38), no probability model, no
v2 deferral. It does not add a verdict the rubric lacks — `blind(c)`, the
blind-corner lean cap, `hold_wide_for_sight` and `stop_within_sight` already
assert Parks' doctrine. It adds the *explanation*: the roads the corner could
still become, rendered rather than asserted. It is evidence and only evidence; no
doctrine check reads it, now or later (D45).

---

## 7. Failed lines as first-class objects (D6)

The prior design forbade sharing mistake overlays: only the good line travelled;
mistakes existed inside baked figures. linelab deliberately reverses this. A
mistake line is:

- **authored** as a one-line named perturbation, a misjudgment spec (a believed
  road, §4.3), or a full alternative strategy,
- **computed** by the same engine as every other line,
- **shared** as *scenario + mistake spec* — never as trajectory data,
- **recomputed** by every consumer (CLI, viewer, POV) from that spec,
- **inspected** exactly like a good line: scrubbed, HUD'd, queried via `stateAt`.

The prior rule's underlying honesty property — *the system never ships a
trajectory the engine didn't produce* — is preserved by construction: what is
shareable is input, and trajectories exist only as engine output. What changes is
only that failure becomes something you can hold up to the light, which is the
entire pedagogical point of a mistake.

---

## 8. Scope boundaries and honest-limitation placards

**In scope:** road-speed line selection — single corners (ideal + the mistake
catalogue), special-case corners (§5), and blind corners (§6), on flat,
constant-width, two-lane roads with lateral occluders.

**Out of scope, refused honestly (D5):**

- **The low-speed regime.** Below the model-validity band `v_valid_min_ms`
  (7.0 m/s ≈ 25 km/h, `02-physics-model.md` §7) the lean-driven point-mass model
  is untrustworthy while leaned — no commandable brake can even widen the line —
  so leaned samples there carry the `below_validity` flag and the verdict
  records the dwell; below the numerical floor `v_floor_ms` runs terminate
  `stopped`. Scenarios built around super-tight geometry — ≥ 170° of sweep
  accumulated at local radius ≤ 15 m (decidable on tapers) — are rejected
  `OUT_OF_SCOPE` at validation. U-turn and parking-lot technique is a different
  tool.
- **Rider posture and body position.** No rider-body model; the book's
  body-position photographs have no linelab equivalent and none is attempted.
- **Rider gaze and target fixation.** The book attributes the canonical mistakes
  to vision behaviour — looking through the turn, inside-fixation, not looking
  far enough ahead — and linelab does not model it: no gaze state exists, no
  mistake kind perturbs vision, and no check grades where the rider looks. What
  the tool offers instead is the *geometry* of gaze: the recorded limit point on
  every sample, the POV's limit-point marker (never dropped,
  `07-viewer-animation-and-pov.md`), and the `look: limit_point` camera toggle
  that makes "look through the turn" a literal button. Any check or scenario
  feature that would require a gaze *model* answers
  `{na: "rider gaze behaviour not modelled"}` — never a fabricated gaze.
- **Vertical geometry.** No crests, dips, camber, or elevation — in sight *or*
  in physics. A scenario flagged as vertically blind receives
  `{na: "vertical sight geometry not modelled"}`, never an in-plane ray that
  could be mistaken for the real over-the-crest limit point.
- **Tier-3 dynamics.** Tire slip, suspension, aerodynamics, gyroscopic and
  countersteer transients, and any handlebar channel (D3). The taught controls
  are lean, brake, throttle.
- **The HTML course.** linelab renders figures; it does not carry curriculum.

**The placard policy.** Wherever the model cannot honestly answer, the answer is
a typed refusal — `{na: reason}` on a check, a validation rejection with a typed
reason on input, an explicit placard in a rendered view, the version-skew
divergence placard on a recomputed shared figure whose stamped story no longer
holds (`05-result-contract-and-inspection.md` §8.4) — never a plausible fake.
A wrong-but-plausible picture a student could believe is strictly worse than an
honest "not modelled." Placards are part of every renderer's contract
(`06-rendering-and-projection.md`, `07-viewer-animation-and-pov.md`).

**Refused claims.** Distinct from the out-of-scope list above: these are sentences
about things linelab *does* model, which linelab nonetheless refuses to say
because the evidence it holds does not support them. Each is refused with a named
placard rather than softened.

| Claim | Disposition |
|---|---|
| *"the corner is escapable / unescapable"* | Refused. The envelope refutes continuations under a named pack from a named station under a named escape rider; it never quantifies over roads the pack does not admit. Placard: *"under `street/1`, from this station, under the lean-and-brake rider."* |

---

## 9. Relation to the prior design

**Carried:** book-as-doctrine and the dispute rule; the ideal-line phrase and its
unpacking; the mistake catalogue's spine and the one-perturbation compile idea;
the special-case doctrine including the decreasing-radius late bar; the
sight-is-geometry / stopping-is-physics separation; lane-constrained-by-default;
the placard stance; metric-by-conversion; the `na`-never-blocks-green rule,
inverted correctly at the standing ladder's top rung so that `na` blocks
`reserved` without blocking green; the honest-placard stance, now mechanised as a
provenance test rather than a convention.

**Changed:** colour law v2 (verdict-derived, role-decoupled, no line cap — D9);
failed lines first-class (D6); `chop`'s canonical outcome becomes run-wide under
Tier 1R (D3); the sight eye moves to the rider's position (D4); Axis A shifts
from audited to true-by-construction with the audit effort redirected to the
pipeline and the proportion gate.

**New:** the goals G1–G9 as testable requirements; per-corner chained mistakes as
doctrine-level requirement; the misjudgment sub-family (believed-road solving,
§4.3) beside the execution mistakes; the two-strategy figure pattern
(fig 8.4/8.5) as first-class authoring; visibility as a per-sample,
position-dependent channel an agent can optimize against; the doctrine check
catalogue as a declared rubric pack (Appendix A);
`RubricPack.annex.reserve_checks` with its typed rejections and its stated
hash-exemption (§A.6.1); the pack-provenance rule; the
packs-may-not-define-a-rider rule; the refused-claims table (§8); the
continuation envelope's placement as evidence past the limit point (§6).

**Struck at ratification:** `out_available` and `sight_ok` (with
`SIGHT_MARGIN_ROB`) — struck by decision under D43 as, respectively, a probe
identically `true` on its whole domain and a strictly weaker restatement of
check 10; `commit_within_sight` — struck by decision under D45, with no
successor, because no refutation-only check is ever promoted. All four are
tombstoned `UNKNOWN_ID/struck_by_decision` (§A.5, and for `SIGHT_MARGIN_ROB`
`08-cli-and-agent-interface.md` §5.1), never deleted silently.

---

## Appendix A — The doctrine check catalogue (`parks-street/2`)

This appendix is the normative home of the doctrine check suite — ids, severity,
scope, applicability, arithmetic, and thresholds.
`05-result-contract-and-inspection.md` §6.2 owns only the record shape
(`CheckResult`, the `doctrine` block); the mistake outcome pins live in
`03-roads-scenarios-and-visibility.md` §7.1 (§A.4 below is a coverage view of
that table). The catalogue ships as the default **rubric pack `parks-street/2`**
(§A.6), bound against metric vocabulary `checks_version: 2`.

The composition law: **physics decides `outcome`; the rubric decides doctrine;
`quality` composes them.** `outcome` is the physics-only closed set
`crash > runoff > wide > stopped > contained`
(`05-result-contract-and-inspection.md` §6.1) and never reads a check — it is
recomputed identically under any rubric pack. `clean` is the derived predicate
`outcome = contained ∧ zero applicable check fails` (`Verdict.ok ≡ clean`).
`quality ∈ good | caution | failing` is the single total colour function
(`06-rendering-and-projection.md` §5.1; restated in §3).

### A.1 Severity, scope, and verdict vocabulary

`severity ∈ advisory | standard | critical` — pack data, per check id:

- `advisory` — worst verdict is `warn`; never blocks green.
- `standard` — a `fail` blocks green (quality `caution` at best) and trips
  exit 3 under `--gate` (`08-cli-and-agent-interface.md` §3.1).
- `critical` — a `fail` additionally renders `failing`/red without physical
  departure. The sole v2 critical is `wrong_strategy_for_corner` (check 16).

Scope is `corner | pair | chain | line`. Per-check verdicts are
`pass | fail | warn | na`; every check may return `na` with a typed reason (the
§8 placard policy at check granularity), and `na` never blocks green.
Applicability keys read *declared style* and *measured geometry* only — never
role, never colour (D9: verdict drives colour, labels drive nothing).

**No check reads `verdict.commitment`.** The catalogue admits no
`refutation_only` verdict vocabulary and no `commitment_refutation` metric. D45
struck the promotion permanently: a check that decides `clean` must run on the
warm-cache recompute path, and the commitment pass cannot
(`03-roads-scenarios-and-visibility.md` §7a.10 records the arithmetic).
`expect_fail: ["commit_within_sight"]` rejects `UNKNOWN_ID` with sub-reason
`struck_by_decision`, never `SCHEMA/deferred` — the name is a tombstone, not a
future.

### A.2 Shared measurement definitions

All checks read only the recorded Sample/Event/analysis record
(`05-result-contract-and-inspection.md` §2–§6) — never the road model directly,
never the engine. Constants are `name = value units`, TUNING unless book-cited.
Station constants are corner-relative: fractions of the corner's centreline arc
length `L_c = r·sweep`.

```
Corner window      W_c = [s(turn_in event for c), s(exit event for c, else corner end)]
Committed lean     phi_c = max |cmd_lean| over the first steering-input run in W_c
steering_complete  first sample with |phi| ≥ 0.9·phi_c        (the 05 §5 event)
apex               argmin f over W_c; apex_pct = 100·cumΔψ(apex)/total sweep of c
apexes             the recorded per-corner apex list corners[].apexes[] — the ONE
                   hysteresis detector (prominence ≥ APEX_PROMINENCE_F = 0.08,
                   separation ≥ APEX_MIN_SEP_M = 5.0 m; 05 §6.3)
exit sample        the sample at the RECORDED exit event (§4.1's heading-capture
                   deadband EPS_EXIT_DEG = 1.0°); for a chained corner (A.3,
                   checks 13–15) the link station instead; for a terminated line
                   with no exit event, corner end
blind(c)           ⇔ at c's turn_in event, s_limit < s_end(c): the rider cannot
                   yet see the corner exit from the turn-in point (rider-eye, D4)
steering input     a maximal rising run of |cmd_lean| toward the corner's hand
                   with rise > SI_HYST = 1.5° (TUNING) — measured on the
                   COMMANDED channel, so stand-up disturbances (su_sustained +
                   su_transient) and roll-on widening never count as rider
                   inputs, and the exit unwind (|cmd_lean| → 0) never counts
danger_dwell_s     per corner, seconds, EVIDENCE ONLY: total time within W_c
                   with |phi| > phiReserve(mu_use) — the §4.1 danger zone,
                   measured (the "long danger-zone dwell" of §4.3's slow_steer
                   row is this quantity). Sum over maximal exceedance runs; each
                   boundary crossing linearly interpolated between its two
                   bracketing samples (the standard bracketed-crossing rule).
                   Recorded in corners[].danger_dwell_s, in-hash like every
                   verdict field; feeds NO parks-street/2 check (lean_ceiling
                   grades the peak; this records the exposure time)
```

The commanded-channel rule is the load-bearing Tier-1R re-derivation: v1 counted
humps of delivered `|phi(s)|`, which under the run-wide slice would count a
chop's stand-up as a "steering input". v2 grades *rider intent* on `cmd_lean`
and *physics* on delivered fields, each where it belongs — possible because 05
records commanded controls per sample; the check suite is the first consumer
that needs them.

### A.3 The catalogue — `checks_version: 2`, 16 checks, closed set

| # | id | scope | severity | one-line claim | provenance |
|---|---|---|---|---|---|
| 1 | `late_apex` | corner | standard | apex past the corner-type late bar | carried |
| 2 | `out_in_out` | corner | standard | enter wide, touch inside, exit wide (chain-modified) | carried |
| 3 | `single_input` | corner | standard | one steering input per corner (commanded channel) | carried, re-derived |
| 4 | `quick_steer` | corner | standard | roll-in must not eat the corner (two-sided ladder) | carried, advisory→standard |
| 5 | `throttle_rule` | corner | standard | crack → v_min ≤ apex → roll-on, no chop | carried, chop leg re-keyed |
| 6 | `trail_brake_taper` | corner | standard | brake past turn-in must taper below stand-up authority | carried, re-derived |
| 7 | `traction_ceiling` | corner | standard | never beyond the friction ellipse | carried |
| 8 | `lean_ceiling` | corner | standard | reserve / ceiling three-band ladder | carried |
| 9 | `exit_containment` | corner | standard | exit lane fraction < 1 | carried |
| 10 | `stop_within_sight` | line | standard | ssd(v, phi, …).ssd_m ≤ sight_ride_m at every station | carried, renames `sight_vs_stopping` (§A.5) |
| 11 | `hold_wide_for_sight` | corner | standard | on a blind corner, stay wide until release | new (v2, D4) |
| 12 | `rideability` | line | standard | no tracker overdrive / kinematic teleport | carried, su-compensated |
| 13 | `link_continuity` | pair | standard | each exit sets up the next entry | carried, re-derived |
| 14 | `chain_containment` | chain | standard | the whole chain stays in the corridor | new |
| 15 | `chain_flow` | chain | standard | one rhythm through the sequence | new |
| 16 | `wrong_strategy_for_corner` | corner | **critical** | a double-apex strategy ridden on a decreasing-radius corner (≥ 2 measured apexes); warns under the fig 8.4 caption's sanction | new (v2) |

#### Per-check arithmetic

**1. `late_apex`** — classify `apex_pct` by corner radius trend:
increasing-radius → `na` (book: apex comes earlier); decreasing-radius → pass
iff `apex_pct > 60` (book-cited, §5); constant-radius (incl. hairpin) → pass iff
`apex_pct > 50` (book-cited). Declared `style=double_apex` corners: evaluate the
**final** touch (exit discipline still governs). Fail cites `{apex_pct, bar}`.
Applies per corner in chains — this is how chained `premature` compounds are
caught (fig 8.6).

**2. `out_in_out`** — with `ti_f = f(turn_in)`, `apex_f = f(apex)`, `exit_f =
f(exit sample)` (per-corner hand-relative `f`): pass iff `ti_f ≥
OIO_OUTSIDE_MIN (0.55 TUNING) ∧ apex_f ≤ OIO_INSIDE_MAX (0.45 TUNING) ∧ exit_f ≥
OIO_OUTSIDE_MIN ∧ max(ti_f, exit_f) − apex_f ≥ OIO_SWING_MIN (0.4 TUNING)`.
Declared double-apex: `apex_f` = min over `apexes[]`. **Chain-mode corners: the
two exit legs are waived** — pass iff `ti_f ≥ 0.55 ∧ apex_f ≤ 0.45`, evidence
noting "exit leg waived (chained)". Requires the exit sample to exist, which the
lean-unwind machinery guarantees on completed corners
(`02-physics-model.md` §3.1); until termination, a runoff line grades this check
on the samples that exist and typically fails the exit leg.

**3. `single_input`** — count steering inputs (§A.2 definition) in `W_c`.
Single-apex corner: pass iff count = 1; fail at 2 ("the second bite"); count ≥ 3
always fails as fifty-pencing **regardless of any declaration** (the anti-gaming
rule). Declared `style=double_apex`: pass iff count ≤ 2. Corrective-shot inputs
never appear here: the corrective is a branched shadow
(`04-solver-and-authoring.md`), and shadow inputs never enter the graded line's
commanded channel.

**4. `quick_steer`** — the two-sided re-derivation that makes `slow_steer` fail
a check. v1 measured only ramp seconds and could only warn — geometry-blind. v2
measures **corner real estate eaten by the roll-in**:

```
dt_steer    = t(steering_complete) − t(turn_in)                            [s]
steer_share = max(0, s(steering_complete) − max(s(turn_in), s0_c)) / L_c   [—]

fail  iff steer_share > QS_SHARE_FAIL = 0.45   (TUNING)
warn  iff steer_share > QS_SHARE_WARN = 0.30   (TUNING)
        or dt_steer > QS_TIME_WARN = 1.0 s     (TUNING, carried bar, now warn-only leg)
pass  otherwise
na    iff phi_c < SMALL_LEAN_DEG = 3.0°        (TUNING, carried — no real steering event)
```

*Worked on fig 8.2's parameters (`book90`: R 12 m, sweep 90°, `L_c` = 18.85 m,
entry 34 km/h, solved turn-in speed ≈ 30 km/h = 8.33 m/s, line radius ≈ 15 m →
`phi_c = atan(8.33²/(9.81·15)) ≈ 25.2°`):* good line, `street` 50°/s:
`dt_steer ≈ 0.50 s` → ≈ 4.2 m → `steer_share ≈ 0.22` → **pass** (margin 0.08
below warn); `slow_steer` ×0.3 → 15°/s: `dt ≈ 1.68 s` → ≈ 14.0 m → `share ≈
0.74` → **fail** (0.29 above the bar); even a gentler ×0.45 re-tune → 22.5°/s:
`dt ≈ 1.12 s` → ≈ 9.3 m → `share ≈ 0.50` → **fail**. The check is robust to a
re-tune of `slow_steer`'s roll-rate factor, and a `casual` rider genuinely too
slow for this corner fails it too — which is the doctrine.

**5. `throttle_rule`** (Keith Code Rule #1) — four legs over `W_c`, graded on
the *commanded* channel where intent matters:
(a) *crack*: some sample with `cmd_a ∈ [0, THR_EPS = 0.05 m/s²]` at/before apex
and not earlier than `s(steering_complete) − CRACK_EARLY_FRAC·L_c`
(`CRACK_EARLY_FRAC = 0.6` TUNING) → miss = warn;
(b) *v_min at/before apex* → miss = fail;
(c) *roll-on onset* ≤ `s(apex) + ROLLON_LATE_FRAC·L_c` (`ROLLON_LATE_FRAC = 0.6`
TUNING) → miss = warn;
(d) *post-onset discipline* → miss = fail: from onset to exit `dv/ds ≥ −0.1
(m/s)/m`; **no chop** — no sample after `steering_complete` with `|phi| ≥
SMALL_LEAN_DEG` and `−cmd_a_rate > RATE_THRESHOLD = 8.0 m/s³` (the SAME constant
that fires `02-physics-model.md` §5.2's transient stand-up: check and physics
key on one trigger, so the check fails exactly when the slice fires); no
sustained mid-corner brake `cmd_a < −CHOP_TOL = −0.5 m/s²` after
`steering_complete` **except** samples whose `action_id` is the entry brake
action (those are trail-brake territory, graded by check 6 — the recorded
`action_id` makes the split mechanical, not heuristic).

**6. `trail_brake_taper`** — the Tier-1R re-derivation:

```
na    iff entry braking completes ≥ brake_gap (4 m, 04's constant) before turn_in (the baseline)
fail  iff at any sample with |phi| ≥ TB_PHI_MIN = 15° (TUNING):
          −a_long > a_widen(phi, v)        — braking hard enough to FORCE stand-up
      or  brake re-deepens after its peak by > REDEEPEN_TOL = 0.3 m/s² (TUNING, carried)
warn  iff residual decel at apex > RESID_FRAC = 0.35 (TUNING, carried) × peak decel
      or  any leaned sample has −a_long ∈ (A_SU_ONSET = 2.5 m/s², a_widen(phi, v)]
          — legal but eating roll authority ("ate the stand-up reserve")
pass  otherwise — the taper is exactly the advanced skill the book photographs
```

`a_widen(phi, v)` is the geometric widening threshold of the run-wide slice —
**owned by `02-physics-model.md` §5.4**; this check consumes it by name and must
not restate its formula. Delivered `−a_long` is used (load transfer follows what
the tire does); commanded rate is check 5's business.

**7. `traction_ceiling`** — fail iff `ellipseMag > 1 + eps_mag (1e-3)` at any
sample of `W_c`, or a `crash` event lies in `W_c`. Physical μ only (one-μ
policy, carried verbatim).

**8. `lean_ceiling`** — with `reserve = phiReserve(mu_use)` capped at
`BLIND_RESERVE_DEG = 35°` (TUNING, carried) when `blind(c)`; `ceiling =
phiMax(mu)`: pass iff `phi_max ≤ reserve`; warn iff `≤ ceiling` ("ate the
reserve"); fail beyond (lowside; a crash outcome will co-occur). Carried
three-band ladder.

**9. `exit_containment`** — pass iff `f(exit sample) < 1.0`. Chain-mode corner:
evaluated at the link station. If the line terminates off-road before the exit
sample exists (`off_road` termination), fail citing the crossing station.
Carried.

**10. `stop_within_sight`** (line scope; id resolution §A.5) — at every sample:

```
deficit(s) = ssd(v, phi, model, profile, mu).ssd_m − sight_ride_m          [m]
fail  iff max deficit > 0            (cites worst station, v, phi there)
warn  iff min margin < SIGHT_WARN_M = 5 m (TUNING)
pass  otherwise
na    iff the scenario carries the vertical-blindness placard (§8)
```

`ssd` (four-part return; the check reads `.ssd_m` with the sample's own `phi`)
is the lean-aware stopping model — owned by `02-physics-model.md` /
`03-roads-scenarios-and-visibility.md` §5.2; this check consumes it by name.
The comparison basis is the recorded `sight_ride_m` (rider-path lookahead);
`sight_m` remains the comparability/render channel.

**11. `hold_wide_for_sight`** (new, D4) — the doctrine "hold wide to open the
sight line", with arithmetic:

```
na unless blind(c).
release(c) = first station where trend = "opening" ∧ sight_ride_m ≥ ssd(v, phi, model, profile, mu).ssd_m
window(c)  = [ s(turn_in) − HOLD_WINDOW_FRAC·L_c , s(turn_in) ]   (HOLD_WINDOW_FRAC = 0.75 TUNING)
fail iff  s(turn_in) < release(c) − RELEASE_TOL_M (2.0 m TUNING)      — committed while closing
      or  min f over {samples in window with trend ≠ "opening"} < HOLD_F_MIN (0.7 TUNING)
warn iff  that min f ∈ [HOLD_F_MIN − 0.15, HOLD_F_MIN)                — drifted in early
pass otherwise
```

The check bar (0.7) is deliberately looser than the solver knob default
(`vis_hold_f = 0.9`): the solver aims high; doctrine enforces a floor. Grades
any line — solver-authored, explicit-plan, or mistake — from recorded
per-sample fields only.

**12. `rideability`** — Tier-1R re-scope: fail iff
`|phi_dot − (su_sustained + su_transient)| > roll_rate + RATE_TOL_DPS (2.0°/s
TUNING, carried)` anywhere — the **tracker component** may never exceed its cap;
the stand-up disturbance is physics and is subtracted before judging. Also fail
on `|Δkappa| > KAPPA_STEP (0.01 1/m)` between adjacent retained samples or
`|Δphi| > PHI_JUMP (3.0°)` at `Δt → 0` (carried teleport guards).

#### The chain-aware set (13–15)

**Applicability — ONE rule, emergent, answering "which lines are graded
chain-aware":**

```
geometric chain pair (c, c+1):  connecting straight ≤ LINK_GAP_FRAC ×
                                min(L_c, L_{c+1})       (LINK_GAP_FRAC = 1.0, TUNING;
                                                         the road's linked_next record, 03 §2)
ridden-linked pair:             geometric pair AND peak −cmd_a on the connecting span
                                ≤ LINK_BRAKE_RESET = 1.0 m/s² (TUNING, carried)
chain-mode corner:              a corner with a ridden-linked successor
```

By road *measured geometry* plus the line's *own riding* — never by solver
kind, role, or corner count. An explicit-plan line on `bookEsses` is graded
chain-aware iff it actually rides the corners linked; a rider who brake-resets a
zero-gap ess loses the exemptions AND fails `link_continuity`. Chain-mode
consequences on per-corner checks: `out_in_out` exit legs waived (check 2);
`exit_containment` at the link station (check 9); `late_apex`, `single_input`,
`quick_steer` unchanged per corner.

**13. `link_continuity`** (per geometric pair; `na` if the road has none) —
three legs, fail if any:
(a) *entry side*: corner c+1 entered from its outer half — `f(entry of c+1) ≥
LINK_ENTRY_OUTER_MIN = 0.5` (TUNING, carried) in c+1's hand-relative frame;
(b) *no brake reset*: peak `−cmd_a` on the connecting span ≤ `LINK_BRAKE_RESET`
(a reset on a geometric pair is a flow failure — "think more than one corner
ahead");
(c) *one flick*: the `|cmd_lean|` series over the connecting span has ≤ 1 local
extremum beyond `SI_HYST` (alternating hands: exactly one minimum — the flick;
same hand: none). ≥ 2 extrema = inter-corner fifty-pencing.
The trajectory is one integration, so d/heading "gap" continuity is true by
construction and needs no leg — these legs grade what can actually vary.

**14. `chain_containment`** (chain scope; `na` unless the line has ≥ 1
chain-mode corner) — over the chain span (first chained corner's turn-in to
last corner's exit sample): pass iff `max f ≤ 1 + EPS_F` and `min f ≥ −EPS_F`
(`EPS_F = 0.02` TUNING). Fail cites the worst station and side. This is the
"contained" half of `04-solver-and-authoring.md` §5's "containment +
link-continuity + flow", as a check with teeth.

**15. `chain_flow`** (chain scope; same applicability) — three legs, fail if
any:
(a) *slow-in per corner carried through the chain*: each chained corner's
`v_min` at/before its apex station;
(b) *gap throttle discipline*: on each connecting span, `cmd_a` crosses zero at
most once (no roll-on-then-grab);
(c) *rhythm*: the number of sign changes of `cmd_lean` (with `|cmd_lean| ≥
SMALL_LEAN_DEG` on both sides) over the chain span equals the number of hand
alternations in the ridden corner sequence — exactly the flicks the road
demands, no extra wobbles.

**16. `wrong_strategy_for_corner`** (the fig 8.4 check; the sole v2 critical):

- **Applicable** iff the line traverses a corner derived from a taper with
  `r1/r2 ≥ DR_RATIO_MIN = 1.25` (TUNING) — the decreasing-radius archetype.
  Else `na` (evidence: `not_a_dr_corner`).
- **Fail** iff that corner's measured `apexes[]` list has length ≥ 2 — the
  ridden strategy is double-apex on a corner whose doctrine is
  single-late-apex.
- **Warn, not fail** — the book caption's carve-out, mechanized line-locally:
  the verdict downgrades to `warn` when (a) the corner was **blind at
  commitment** — `sight_m` at the line's first `turn_in` event for the corner
  < the corner's remaining arc length — **and** (b) the entry was
  **significantly slower** — `v` at that turn-in ≤ `DR_ALT_SPEED_MARGIN = 1.0`
  (TUNING) × `sqrt(g · tan(phi_reserve) · r2)`, slow enough that the tightest
  radius fits inside the street lean reserve without further slowing. Both read
  off the line's own samples and the road; no cross-line reference.
- **Evidence:** `{apex_count, apexes_s, corner_id, blind_at_turn_in,
  v_turn_in_kmh, v_reserve_kmh, book_note}` where `book_note` quotes the
  caption's sanction; `explain wrong_strategy_for_corner` prints the caption
  verbatim.

#### Special-case `na`/exemption table (one place, normative)

| Special case | Effect on catalogue |
|---|---|
| increasing radius | `late_apex` → `na` (carried) |
| decreasing radius | `late_apex` bar 60 % (carried, book-cited) |
| declared `style=double_apex` | `single_input` tolerates 2; `late_apex` grades final touch; `out_in_out` uses min-touch `apex_f`; ≥ 3 inputs still always fail |
| blind corner (`blind(c)` predicate) | `lean_ceiling` reserve capped 35°; `hold_wide_for_sight` becomes applicable |
| chain-mode corner | `out_in_out` exit legs waived; `exit_containment` at link station |
| vertically-blind scenario | `stop_within_sight`, `hold_wide_for_sight` → `na` with placard reason |
| non-chain road | 13–15 → `na` ("no linked pair on road") |

### A.4 Coverage: every mistake kind fails at least one check

Normative single-class pins and fixtures live in
`03-roads-scenarios-and-visibility.md` §7.1 — one machine-readable table
feeding `schema mistakes` and the `09-verification-and-testing.md` §4 oracle.
The view below is the coverage proof, on the named oracle fixtures:

| kind | fixture | outcome pin | mandatory check fail | why it fails (mechanism) |
|---|---|---|---|---|
| `premature_contained` | `F-ORACLE-90` (`book90`) | `contained` | `late_apex` | early turn-in, eased target → apex_pct ≪ 50; kisses inside so `out_in_out` may pass — the pin is the one check that IS the lesson |
| `premature` | `F-ORACLE-90` | `runoff` | — (the outcome IS the lesson) | committed early lean → early apex, never re-enters the out-in-out shape; `late_apex`/`out_in_out` fail in practice (coverage evidence, never a pin) |
| `slow_steer` | `F-ORACLE-90` | `runoff` | `quick_steer` | steer_share ≈ 0.74 > 0.45 (check 4's worked arithmetic) |
| `fifty_pence` | `F-ORACLE-90` | `wide` | `single_input` | 6 facets → ≥ 3 commanded inputs, the always-fail rule |
| `chop` | `F-ORACLE-90` | `runoff` | `throttle_rule` | the commanded-rate chop leg keys on `RATE_THRESHOLD` — the same trigger as the physics stand-up |
| `overspeed` | `F-ORACLE-DR` (`bookDecreasing`) | `runoff` (admissible {`wide`, `runoff`, `crash`}) | `out_in_out` | same committed lean at higher entry → larger radius → never reaches the inside (`apex_f > 0.45`); `a_lat = G·tanφ` is speed-free, so traction/lean checks correctly do NOT fire — the `diagnosis` channel (`overspeed_entry`) names the cause; checks grade the ridden line |
| `underread` | `F-ORACLE-DR` | `runoff` | per `03 §7.1` | believed the entry radius holds; the taper tightens past the literalized plan |
| `overread` | `F-ORACLE-90` | `contained` (+ mandatory check fails) | per `03 §7.1` | over-slow, over-cautious — the timid amber line |
| chained variants (`@all_corners`) | `F-ORACLE-CHAIN` (`bookEsses`) | per kind (`premature`: `runoff` at the final corner) | per-kind pin + `link_continuity` where the compound breaks the entry side | the fig 8.6 device |

Considered and rejected: a separate `entry_speed` check. Cause attribution is
the `diagnosis` channel's job (`overspeed_entry` exists); a check would need a
counterfactual solve to know "too fast", violating the
checks-read-the-record rule. Recorded here so the question stays answered.

### A.5 The id rename

The v2 id is **`stop_within_sight`**; the v1 spelling `sight_vs_stopping` is
retired with a typed tombstone. Check ids are stable **within** a
`checks_version`; v1→v2 is precisely where a rename may happen, and the pack
records it:

- The pack manifest carries `renames: { "sight_vs_stopping":
  "stop_within_sight" }`.
- `validate` rejects `expect_fail: ["sight_vs_stopping"]` (and `explain
  sight_vs_stopping`) with `UNKNOWN_ID` whose message names the successor:
  `"sight_vs_stopping was renamed to stop_within_sight in checks_version 2"` —
  loud, typed, D8-conformant; never silently aliased.

**The struck-name tombstones.** A rename has a successor id; a *strike* may or may
not. Both are typed `UNKNOWN_ID`, and neither is ever silently deleted — a name
the design once printed must keep answering for itself. Struck names reject with
sub-reason `struck_by_decision`, which is not `deferred`: there is no phase in
which any of these arrives.

| Struck id | Disposition |
|---|---|
| `out_available` | struck by decision (D43); successor mechanism: `annex.reserve_checks` (§A.6.1) |
| `sight_ok` | struck by decision (D43); successor mechanism: check 10 `stop_within_sight`, which it restated weakly |
| `commit_within_sight` | struck by decision (D45); **no successor** — no refutation-only check is ever promoted |

`SIGHT_MARGIN_ROB` is a constant name, not a check id: it is tombstoned at the
flag/`explain` surface (`08-cli-and-agent-interface.md` §5.1), not in this table.

### A.6 Rubric identity: the catalogue as a declared data pack

Every `Verdict` carries `rubric: "<name>/<version>"` — shipped default
`"parks-street/2"`. `checks_version` versions the *metric vocabulary* (the
code); `rubric` versions the *bindings* (the data). The two answer different
questions: "which measurements exist" vs "which thresholds/severities/
applicability grade them".

```
RubricPack = {
  pack: "linelab-rubric/1",              // pack wire-format version
  name: "parks-street",                  // identity; rubric string = "<name>/<version>"
  version: 2,                            // integer; bump on ANY binding change
  requires_checks_version: 2,            // metric vocabulary this pack binds against
  doctrine_source: "Parks, Total Control, ch. 8–9",
  checks: [ {
    id,                                  // closed id set OF THE PACK
    metric,                              // one of the engine's closed metric ids (code)
    scope: "corner"|"pair"|"chain"|"line",
    severity: "advisory"|"standard"|"critical",
    applicability: { … },                // declarative keys: corner_trend, requires_blind,
                                         //   declared_style, chain_mode — the closed key
                                         //   set is code; the values bound here are data
    thresholds: { NAME: {value, units, source: "book:<cite>"|"TUNING"} … },
    bands: { … },                        // metric-band → pass|warn|fail mapping
    teaches, book_ref                    // explain() text
  } ],
  renames: { old_id: new_id }            // tombstones (§A.5)
}
```

**Code (versioned by `checks_version`):** the metric implementations —
`apex_pct`, `oio_fractions`, `input_count`, `steer_share`, `throttle_legs`,
`taper_profile`, `ellipse_max`, `lean_max`, `sight_deficit`, `hold_wide_legs`,
`tracker_overdrive`, `link_legs`, `chain_extent`, `flow_legs` — a closed metric
vocabulary, pure functions of (samples, events, analysis).
**Data (versioned by the pack):** which ids exist, which metric each binds,
thresholds, bands, severity, applicability values, prose. A pack **cannot
introduce arithmetic**; wanting a new metric = a `checks_version` bump (a code
change with a re-bless migration). This is what makes the seam safe: two
implementers loading the same pack against the same `checks_version` must
converge, because everything interpretive is data and everything computational
is pinned code.

Selection, validation, and consequences:

- Packs are committed data files (`plan/doctrine/packs/parks-street.json`),
  hashed like fixtures. v1 ships exactly one.
- Selection surface: `config.rubric?: "<name>"` (scenario wire schema, default
  `"parks-street"`), CLI `--rubric <name>`, scene key `rubric: <name>`. Version
  is not author-selectable: the engine resolves a name to the single version it
  ships (skew across engine versions is the share-URL stamp's business,
  `05-result-contract-and-inspection.md` §8.4). Unknown name → `UNKNOWN_ID`;
  `requires_checks_version` mismatch → `SCHEMA` (message naming both versions).
  One rubric per figure (like one road): lines disagreeing → `SCHEMA`
  (`rubric_mismatch`); the FigureSpec carries the figure's rubric string as an
  *input* (shareable; consumers regrade under the same pack).
- **When a different pack loads, exactly this changes:** the `doctrine` block,
  `quality`/colour, gate/exit-3 behaviour, `expect_fail` id resolution,
  `explain <checkId>` content, and `result_hash` (verdict content changed, and
  `rubric` is inside the hash). **Never changes:** samples, events,
  `terminated`, `outcome`, `spec_hash` — pinned by `P-OUTCOME-RUBRIC-FREE`
  (`09-verification-and-testing.md`).
- **"The book wins" stays the shipped default:** `parks-street/2` encodes the
  brake-complete baseline, `trail_brake_taper`'s `na`-when-baseline, and the
  book-cited bars. A Ch. 9 trail-braking doctrine dispute becomes a future
  `trailbrake-street/1` pack — a data file, not a fork; nothing in the default
  pack paints a competent taper red.
- **Every `source` string is mechanically provenance-checked.** A
  `thresholds.NAME.source` is either the literal `"TUNING"` or matches `^book:` —
  there is no third spelling and no free prose. A `book:<cite>` source must
  resolve to a citation that exists in the committed `book_text/` extraction; a
  citation that does not resolve is rejected `SCHEMA` (`source_unresolved`) at
  pack load, naming the check id and the string. Symmetrically, no threshold
  whose value is marked `TUNING` anywhere in the design of record may carry a
  `book:` source in any pack. `A-PACK-PROVENANCE`
  (`09-verification-and-testing.md` §4) asserts both directions over every
  committed pack, rubric and continuation alike. The rule exists because the
  failure it prevents is the project's worst failure mode: a tuned number wearing
  a book citation is indistinguishable from doctrine at the point of use, and the
  whole grading seam rests on that distinction. Refusals over fabrications — a
  pack that cannot cite honestly does not load.
- **A pack may reference a counterfactual rider and may never define one.** A
  pack may carry a `CounterfactualRider` id (`04-solver-and-authoring.md` §4c) as
  a declared string, and may carry declared **scalar bounds** such as a decel cap
  or an ellipse cap. It may never carry a target-lean expression, a roll rate, a
  commanded-acceleration law, a predicate, or any other expression. The D12 seam
  is *expression versus scalar*: a controller is arithmetic that runs inside the
  integrator, and admitting a pack-defined rider would let a data file change what
  a `runoff` is. A pack naming an id outside the registry is rejected
  `UNKNOWN_ID`; a pack spelling a policy inline is rejected
  `SCHEMA/pack_defines_rider`.

### A.6.1 The reserve annex (`reserve_checks`) — declared data, out of hash

A rubric pack carries one member outside its hash-bearing binding set:

```
RubricPack.annex = {
  reserve_checks: [ checkId, … ]        // non-empty; every member ∈ this pack's check id set
}
parks-street/2:  annex.reserve_checks = [ "lean_ceiling", "stop_within_sight" ]
```

The annex names the checks whose **`pass` band** — not merely their not-`fail`
band — the `standing` ladder's top rung requires
(`05-result-contract-and-inspection.md` §6.4). It is data in the D12 sense: a
list of ids the pack already declares. It introduces no metric, binds no
threshold, and changes no verdict, no `quality`, no colour, and no `result_hash`
byte.

**The annex is exempt from the version-bump rule stated above**, and the
exemption is stated here rather than inferred: §A.6's rule is *bump on any
binding change*, and the annex binds nothing that grades a line. Adding it to
`parks-street/2` therefore moves no baked hash and leaves the six Chapter-8
figures byte-identical — which is a claim, so it is tested
(`G-STANDING-NO-HASH-MOVE`, `09-verification-and-testing.md` §10). Any pack that
*does* change a threshold, band, severity, or applicability bumps its version as
before.

Validation at pack load, typed:

- `annex` absent, or `annex.reserve_checks` absent → `SCHEMA`,
  `at: "rubric.annex.reserve_checks"`, reason `reserve_checks_missing`. A pack
  without the annex cannot be asked for a `standing`; it is refused, never
  defaulted.
- `annex.reserve_checks` empty → `SCHEMA`, reason `reserve_checks_empty`. An
  empty list would make rung 4 identical in extension to rung 3 — a vacuous top
  rung is exactly the defect the ladder was repaired to remove, so it is rejected
  rather than shipped.
- a member not in `checks[].id` → `UNKNOWN_ID`, reason `unknown_reserve_check`,
  message naming the pack and the offending id; the `renames` tombstone table
  (§A.5) is consulted first, so `"sight_vs_stopping"` in the annex is rejected
  `renamed_check` with a message naming `stop_within_sight`.

**Why these two ids, and why `pass` rather than not-`fail`.** Check 8
`lean_ceiling` is a three-band ladder — `pass iff phi_max ≤ reserve`, `warn iff ≤
ceiling` ("ate the reserve"), `fail` beyond — and `clean` keys on fails only. The
warn band is therefore a `clean ∧ ¬reserved` witness class **that exists by
construction**: requiring `pass` is strictly stronger than `clean`, on a
population the catalogue already produces. Check 10 `stop_within_sight` is the
same shape: `pass` requires `max deficit ≤ 0` **and** `min margin ≥
SIGHT_WARN_M` (§A.3 check 10), strictly above the bar `clean` enforces, which
tolerates the warn band. Both conjuncts bite, at zero engine runs, on quantities
already inside the verdict. Check 8 additionally caps its reserve at
`BLIND_RESERVE_DEG` when `blind(c)` (§A.3 check 8), so the top rung is
**stricter on blind corners** — the direction doctrine wants, and the direction
the struck `out_available` probe had backwards.
