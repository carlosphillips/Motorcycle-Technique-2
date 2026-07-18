# Scope & Doctrine — What linelab Teaches and What "Correct" Means

## 1. What this document covers

This document defines linelab's goals as testable product requirements, restates
the book-as-doctrine principle for the new tool, and specifies the line-selection
doctrine itself: the ideal line, the canonical mistakes, the special-case corners,
and the visibility rules. It also records the failed-lines-first-class doctrine
reversal (D6) and the scope boundary with its honest-limitation placard policy.
Physics is specified in `02-physics-model.md`; schemas and the mistake compiler in
`03-roads-scenarios-and-visibility.md`; checks and the verdict shape in
`05-result-contract-and-inspection.md`.

---

## 2. Goals, as testable requirements

linelab exists to make road-speed line-selection doctrine **causal, inspectable,
and easy to author**. Each goal below is phrased so that its satisfaction is a
checkable property, not a mood.

- **G1 — Every drawn line is a ridden line.** No path geometry is ever authored;
  every line in every view is an integrated trajectory from `core/`. *Test:* no
  input surface accepts path points, radii-of-line, or an apex (D7); a grep for an
  `apex` input field across `plan/` schemas finds nothing.
- **G2 — Full state at any point.** Any physical or control quantity the model
  computes is recoverable at any station or time on any line via `stateAt`
  (contract in `05-result-contract-and-inspection.md`). *Test:* the HUD can be
  populated entirely from one `stateAt` call.
- **G3 — Steppable animation.** The viewer scrubs a timeline over every line in a
  scenario, with named jump points (turn-in, apex, crash instant). *Test:* the
  stepper in `07-viewer-animation-and-pov.md` renders any sample index without
  re-running the solver.
- **G4 — Agent-first authoring.** An AI agent can set up a *new* scenario
  correctly on the first try from `schema` + `explain` output alone; a compound
  figure (road + good line + mistake line + markers) takes ≤ 6 lines of scene text
  or one CLI command. *Test:* the recipes in `08-cli-and-agent-interface.md` run
  from a clean checkout with no other documentation.
- **G5 — Failed lines are first-class.** A mistake line is a one-liner to author,
  and is shareable, loadable, and per-instant inspectable exactly like a good
  line (D6). *Test:* the viewer can scrub a mistake line's trajectory and HUD.
- **G6 — Roads are one-liners.** A road, including occluders, is expressible in
  a single DSL line for every corner archetype in scope. *Test:* every archetype
  in §5 has a worked DSL example in `03-roads-scenarios-and-visibility.md`.
- **G7 — Book-figure parity.** For each line diagram in *Total Control* Chapter 8
  (figs 8.1–8.6), linelab produces an equivalent figure from a scene file. *Test:*
  the per-figure mapping in §4–§6 is covered by shipped example scenes.
- **G8 — Book-compact diagrams.** Exported top-down figures land inside the
  measured book proportion band (road-width:radius ≈ 0.55–0.9 as drawn, straights
  cropped) via the diagram projection (D2). *Test:* the proportion gate in
  `06-rendering-and-projection.md` passes on every shipped figure.
- **G9 — Rider's-eye view.** Every scenario renders a first-person POV at any
  sample, with the limit point marked and occlusion visible. *Test:* the POV
  contract in `07-viewer-animation-and-pov.md`.

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
  each trajectory against the tenets in §4–§6 (check ids and arithmetic live with
  the verdict contract in `05-result-contract-and-inspection.md`). The verdict is
  a property of the trajectory, computed identically no matter who authored the
  inputs.
- **Legibility and book-likeness** — formerly a cosmetic report category — gain a
  mechanical instrument: the proportion gate (`06-rendering-and-projection.md`)
  measures what the prior regime could only eyeball, and the render-then-judge
  loop (`09-verification-and-testing.md`) covers what remains judgment.

Colour is still a hard doctrinal signal, now under **colour law v2 (D9)**: green
= good, amber = middling/contained, red = failing — derived from each line's own
emergent verdict, with the line's authored *role* (`ideal`, `alternative`,
`mistake`, `reference`) carried as a label, never as a colour override. A figure
may carry any number of lines. This preserves the prior rule that a
correctly-shaped line in the wrong colour is a failure, while fixing its two
defects: the single-amber-slot cap and the "contained linked good line renders
red" bug — under v2 a contained-but-sound chained line renders amber or green per
its verdict, and a *legitimately failing* second strategy (fig 8.4's double-apex
companion) renders red because its verdict is red, not because someone painted it.

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
  road's exit heading.
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

The mistake kinds are the closed set from `00-README.md` §4. Each is a **named
one-line perturbation** of a solved good line, compiled by the mistake compiler
(`03-roads-scenarios-and-visibility.md`) and forward-run through the real engine;
the outcome is the engine's, never asserted. Under Tier 1R
(`02-physics-model.md` §5) the expected outcome classes are:

| Kind | The rider's error | Causal chain | Emergent outcome (Tier 1R) | Book mapping |
|---|---|---|---|---|
| `premature` | Turns in too soon, keeps lean modest | early apex → exit drifts outward, absorbed by remaining lane | `violation` (contained; fails `late_apex`, `out_in_out`) | fig 8.1 premature turn point (contained variant) |
| `early_apex` | Turns in too soon, commits lean to kiss the inside early | early apex → geometry points the exit at the outside → forced wide | `wide`/`runoff` | figs 8.1–8.2 teaching: the canonical *turned in too soon, ran wide* |
| `slow_steer` | Takes too long from upright to full lean | long roll-in eats corner angle → line runs deep and wide; long danger-zone dwell | `wide`/`runoff` | fig 8.2 Slow Steering |
| `fifty_pence` | Multiple partial steering corrections | faceted line, several lean humps; usually from eyes not through the turn | `wide`/`runoff` (always fails `single_input`) | fig 8.3 Fifty-Pencing |
| `chop` | Abruptly cuts throttle (or grabs brake) mid-corner | stand-up effect sheds lean; rider freezes; line straightens outward | `wide`/`runoff` — **changed from the prior design's `violation`** per the run-wide slice (D3) | Ch. 9 throttle doctrine; the mechanism behind fig 8.5's failed line |
| `overspeed` | Enters faster than the line supports | required lean exceeds reserve/ceiling; corrective may be infeasible | `wide`/`runoff` or `crash` | the *slow in, fast out* rule, violated |

**The naming trap, resolved explicitly.** The book's fig 8.1 contrasts a
*premature* turn point (red) with a *delayed* turn point (green). An author who
wants the book's canonical "turned in too soon and ran wide" figure must use
`early_apex`, whose compiled lean actually commits to the early inside kiss and
therefore runs wide; `premature` is the contained variant that stays in-lane on
street reserve and fails only the doctrine checks. Every input surface that lists
mistake kinds (`schema`, `explain`) must state each kind's canonical outcome
class and book-figure mapping so an agent picks correctly on the first try
(`08-cli-and-agent-interface.md`).

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
  green and a double-apex *strategy* line red — under colour law v2 that red is
  simply the second strategy's own failing verdict on this corner (role
  `alternative`, verdict red). Both lines are full solved strategies, not
  perturbations.
- **Increasing radius** — apex comes *earlier*, throttle earlier and harder;
  late-apex classification is not applicable (`late_apex` reads `na`).
- **Double apex** — the legitimate two-touch line on a corner whose shape rewards
  it (the book's fig 8.5, drawn green there). It requires by definition at least
  one mid-corner correction, and is explicitly distinct from fifty-pencing. The
  plan shape is two `turn_in` actions with a drift/roll phase between them; the
  drift back to the outside between touches emerges from roll-on widening the
  arc. The *failed* line of fig 8.5 — a single late apex attempted on this
  corner, salvaged by braking while leaned — now fails honestly via the run-wide
  slice: sustained hard braking at lean stands the bike up and forces it wide
  (`02-physics-model.md` §5). *Design requirement:* a solved double-apex plan
  must produce two distinct lane-fraction minima; this is a solver acceptance
  criterion (`04-solver-and-authoring.md`), to be validated in implementation,
  not assumed.
- **Linked turns / esses** — think more than one corner ahead: each exit is the
  next entry, and a mistake amplifies through the sequence (fig 8.6 shows an
  early turn point compounding corner after corner). Requirements: chained
  solving with exit-to-entry continuity (`04-solver-and-authoring.md`), and
  per-corner chained mistakes — the same named perturbation applied at every
  corner of the chain — as a first-class mistake mode
  (`03-roads-scenarios-and-visibility.md`). Under colour law v2 a contained,
  flowing chained line renders by its own verdict; the prior "lone linked line
  renders red" defect is structurally gone.
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
  inside sight distance: `ssd(v) ≤ sight`. Sight distance is speed-independent
  ray-cast geometry; only stopping distance varies with speed — the two channels
  are never conflated. Limited sight therefore caps safe entry speed.
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
  linelab figure is a one-scene composition: occluder + two lines + per-line
  sight rays (`03-roads-scenarios-and-visibility.md`,
  `06-rendering-and-projection.md`).

Visibility quantities (`sight_m`, `ssd_m`, limit point, trend) are recorded per
sample so that an agent can *choose between lines on visibility grounds* — e.g.
author a wide-entry and a tight-entry line and compare sight margins station by
station (G5, G2). Position intent is expressed with effectual `position` plan
actions (D8; semantics in `03-roads-scenarios-and-visibility.md`).

---

## 7. Failed lines as first-class objects (D6)

The prior design forbade sharing mistake overlays: only the good line travelled;
mistakes existed inside baked figures. linelab deliberately reverses this. A
mistake line is:

- **authored** as a one-line named perturbation (or a full alternative strategy),
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

- **The low-speed regime.** Below `v_floor` (`02-physics-model.md` §7) the
  lean-driven point-mass model is invalid; runs terminate there, and scenarios
  built around super-tight geometry (sweep ≥ 170° *and* radius ≤ 15 m) are
  rejected at validation as out of scope. U-turn and parking-lot technique is a
  different tool.
- **Rider posture and body position.** No rider-body model; the book's
  body-position photographs have no linelab equivalent and none is attempted.
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
reason on input, an explicit placard in a rendered view — never a plausible fake.
A wrong-but-plausible picture a student could believe is strictly worse than an
honest "not modelled." Placards are part of every renderer's contract
(`06-rendering-and-projection.md`, `07-viewer-animation-and-pov.md`).

---

## 9. Relation to the prior design

**Carried:** book-as-doctrine and the dispute rule; the ideal-line phrase and its
unpacking; the mistake catalogue's spine and the one-perturbation compile idea;
the special-case doctrine including the decreasing-radius late bar; the
sight-is-geometry / stopping-is-physics separation; lane-constrained-by-default;
the placard stance; metric-by-conversion.

**Changed:** colour law v2 (verdict-derived, role-decoupled, no line cap — D9);
failed lines first-class (D6); `chop`'s canonical outcome becomes run-wide under
Tier 1R (D3); the sight eye moves to the rider's position (D4); Axis A shifts
from audited to true-by-construction with the audit effort redirected to the
pipeline and the proportion gate.

**New:** the goals G1–G9 as testable requirements; per-corner chained mistakes as
doctrine-level requirement; the two-strategy figure pattern (fig 8.4/8.5) as
first-class authoring; visibility as a per-sample, position-dependent channel an
agent can optimize against.
