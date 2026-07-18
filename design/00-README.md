# linelab — Design of Record (v1) — Reading Guide & Project Map

This is the index for the design-document set of **linelab** (working name), the
successor to the "Motorcycle Cornering" project whose design record is preserved in
`extract/`. The prior project's code is **not** in this repository; these documents
define a fresh implementation that carries forward what that design got right and
deliberately reverses what it got wrong for the new goals.

> **What these documents are — and are not.** Like the `extract/` set they replace,
> these capture **design intent, physics, contracts, and workflows** — equations,
> named constants (`name = value + units`), grammars, schemas, and API signatures.
> No source-code dumps. Behaviour is described in prose; the implementation is
> judged against these documents, and these documents are judged against the book.

---

## 1. What linelab is

One artifact, not two: an **interactive, physics-grounded riding-line laboratory**
for road-speed cornering. An author — human or AI agent — describes a road and one
or more *line intents* in a few lines of text. linelab simulates each line with real
physics, judges it against line-selection doctrine, and presents the result as:

1. **Book-style top-down diagrams** — compact, annotated figures visually equivalent
   to the line diagrams in Lee Parks' *Total Control* (Chapter 8 especially), drawn
   through a disclosed diagram projection.
2. **A steppable animation** — a timeline the user scrubs, with every physical and
   control quantity (speed, lean, curvature, grip usage, commanded vs. delivered
   brake/throttle, sight distance vs. stopping distance) inspectable at any point on
   any line, good or failed.
3. **A rider's-POV pseudo-simulation** — a first-person view from the rider's actual
   position: the road ahead, the horizon tilting with lean, the limit point, and the
   road visibly disappearing behind occluders on blind corners.

The unifying principles carried from the prior project: **the book is doctrine**
(`book_text/`, `book_images/` are the committed extraction; the book wins disputes),
and **the line is emergent** — the rider commits only inputs; apex, exit, and
run-wide behaviour come out of the physics, never out of the author's pen.

---

## 2. Decision log (normative)

These decisions were made 2026-07-18 after a six-lens adversarially-verified review
of the prior design plus a user interview. Sibling documents must conform to them.

- **D1 — Interactive-first architecture.** The primary product is an interactive
  viewer (scrubber, HUD, POV) built as modern TypeScript/ESM; the physics core is a
  pure, dependency-free library that runs identically in CLI and browser; static SVG
  figures are an *export target*, not the product. *Supersedes* the prior no-build /
  `file://` / classic-script / static-artifact doctrine, which made animation and
  POV structurally impossible.

- **D2 — Diagram projection layer.** Simulation always runs on true geometry. The
  top-down *diagram* view renders through a disclosed, topology-preserving
  projection (straights compressed hard, drawn road width raised into the book's
  measured proportion band, frame cropped to the corner window). Physics readouts,
  the animation HUD, and the POV always use true geometry. A mechanical
  **proportion gate** verifies book-likeness. *Supersedes* the lateral-only `exag`
  knob — the confirmed root cause of the prior tool's stretched-out figures was an
  ~8–10× width:radius proportion gap plus roads that were ~60 % braking straight,
  neither of which lateral exaggeration can fix.

- **D3 — Physics tier = Tier 1R (point-mass + run-wide slice).** The prior Tier-1
  model (planar point-mass, lean-driven curvature, friction ellipse, rate-limited
  roll) plus exactly one addition: a longitudinal load-transfer / stand-up effect so
  that braking-at-lean and throttle-chop **widen** the line as the book teaches,
  instead of pinching it inward. No low-speed kinematic steering (the sub-25 km/h
  U-turn regime is out of scope), no handlebar/countersteer channel (line-selection
  doctrine teaches lean, brake, throttle — a derived steering display would be
  fake, and modelling it for real is Tier-3 scope).

- **D4 — Visibility is first-class, lateral-only.** Blind corners are modelled with
  vision-blocking lateral occluders (hedge, wall, bank, vehicle) on a flat world —
  no crests, no vertical geometry (refused with an honest placard). The sight ray is
  cast from the **rider's actual position**, not the road centreline, so "hold wide
  to open the sight line" is visible and measurable. Sight distance, stopping
  distance, and the limit point are recorded per sample, and `position` plan
  actions are effectual, so an agent can author lines that differ in visibility and
  compare them.

- **D5 — Scope: road-speed line selection only.** Single corners (ideal line + the
  canonical mistakes), special-case corners (decreasing/increasing radius, double
  apex, linked sequences, road-speed hairpins), and blind corners. Out of scope:
  the low-speed/U-turn regime, rider body-position teaching, vertical physics,
  tire-slip/suspension dynamics (Tier 3), and the prior project's HTML course.

- **D6 — Failed lines are first-class objects.** Mistake lines are shareable,
  loadable, and per-instant inspectable exactly like good lines. This deliberately
  reverses the prior "mistake overlays are figure-only and never shared" rule. The
  underlying honesty property is preserved differently: what is shared is the
  *scenario + mistake spec*, and every consumer **recomputes** the trajectory with
  the same engine — the system still never ships a trajectory the engine didn't
  produce.

- **D7 — The emergent-line invariant (carried).** There is no `apex` field anywhere
  in any input schema; plans are id-addressed action lists (brake, turn_in,
  throttle, position); apex/exit/run-wide are measured outputs. Structural, not
  conventional.

- **D8 — Schema-valid implies effectual (new).** Every accepted input does
  something; anything unsupported is rejected at validation with a typed reason.
  The prior design accepted `position` actions and silently ignored them — that
  class of behaviour is forbidden.

- **D9 — Colour law v2.** Colour still means doctrinal line quality (green = good,
  amber = middling/contained, red = failing), but it derives from **each line's own
  emergent verdict**, decoupled from the line's authored *role*. Figures may carry
  any number of lines; roles are labels, colours are verdicts. This fixes the prior
  single-amber-slot cap and the "contained linked good line renders red" defect
  while keeping colour a hard doctrinal signal.

---

## 3. The sibling documents (01–09)

| Doc | Subject |
|---|---|
| `01-scope-and-doctrine.md` | Goals; book-as-doctrine; the line-selection doctrine (ideal line, canonical mistakes, special-case corners, limit-point/visibility rules); the failed-lines-first-class reversal; scope boundaries and honest-limitation placards. |
| `02-physics-model.md` | State vector, equations of motion, emergent curvature, friction ellipse, rate-limited roll, **the run-wide slice**, integrator, events, violation/crash policy, determinism, golden numerics. |
| `03-roads-scenarios-and-visibility.md` | Road model and DSL; occluder vocabulary; the rider-eye sight model; the scenario wire schema (id-addressed plan actions, effectual `position`); the mistake compiler (kinds, params, book-figure mapping, per-corner chaining); multi-line figures. |
| `04-solver-and-authoring.md` | Turn-in suggestion; bisection solving; chained-corner solving; the visibility-governed mode (stop-within-sight, hold-wide); authoring layers from one-command to scene text; agent workflows. |
| `05-result-contract-and-inspection.md` | The Sample contract (including commanded controls and per-sample sight); the time-base; `stateAt`; events-as-bookmarks; the verdict JSON; multi-line result envelope; export and sharing formats. |
| `06-rendering-and-projection.md` | The diagram projection (modes, compression, width band, crop, invariants, disclosure); the top-down renderer (markers, sight rays, occluded-region shading); the controls strip; colour law v2 in detail; the proportion gate. |
| `07-viewer-animation-and-pov.md` | Viewer architecture; the stepper (scrubber, HUD, named jump points, compare mode); the POV view (camera model, projection, draw order, limit-point marker, placards). |
| `08-cli-and-agent-interface.md` | Verb table and exit codes; machine-JSON output; schema discoverability ("first try from `schema` + `explain` alone"); the zero-file one-command path; agent recipes. |
| `09-verification-and-testing.md` | Golden numerics and tolerances; property tests for projection invariants; the proportion gate; mistake-preset oracle; POV/stepper contract tests; the adapted render-then-judge loop; testing philosophy. |

---

## 4. Shared vocabulary (normative — use these names verbatim)

- **Views:** `topdown`, `controls`, `pov`. Top-down render **modes:** `true` |
  `diagram` (D2). The POV and all state readouts are always true-geometry.
- **Line roles:** `ideal` | `alternative` | `mistake` | `reference` (labels only;
  colour comes from the verdict per D9).
- **Mistake kinds (closed set, extensible by design change):** `premature`
  (early turn-in that stays contained), `early_apex` (turned in too soon, runs
  wide — the book's canonical Fig 8.1/8.2 error), `slow_steer`, `fifty_pence`,
  `chop` (throttle chop; under Tier 1R its outcome becomes run-wide), `overspeed`.
  Each kind's canonical outcome and book-figure mapping is part of its schema.
- **Plan action types:** `brake`, `turn_in`, `throttle`, `position` — id-addressed,
  anchored corner-relative (`entry`, `exit`, `mid`, `±offset`). No `apex` anchor.
- **Core per-sample fields (canonical minimum, detailed in 05):** `s, t, x, y, psi,
  v, phi, kappa, a_long, a_lat, grip, mu, d, f` plus commanded controls (`cmd_lean`,
  `cmd_a`, `roll_rate`, `action_id`) plus sight (`sight_m`, `ssd_m`, `limit_x`,
  `limit_y`).
- **Key API names:** `stateAt(result, {s|t})`, `sightFrom(road, eye, occluders)`,
  `solve`, `suggestTurnIn`, `compileMistake`.
- **Module map (target):** `core/` (physics, pure), `road/` (geometry + DSL),
  `sight/` (visibility), `plan/` (schema + validation), `solve/` (authoring
  solvers), `render/` (topdown, controls, projection), `viewer/` (app: stepper,
  POV), `cli/`.
- **Units:** metric everywhere — m, m/s, km/h for display, degrees for lean/sweep;
  `g = 9.81 m/s²`. Book (US-unit) claims are judged by correct conversion
  (mph→km/h ×1.609, ft→m ×0.3048), never string match.
- Uncertain constants are written with a `TUNING` mark and a plausible default.

---

## 5. Relation to `extract/` (the prior design)

**Carried forward essentially intact:** the physics spine (RK4 integration,
`kappa = g·tan(phi)/v²`, friction ellipse, rate-limited roll, emergent apex), the
solver approach (feasibility probe + monotone bisection + self-verifying re-run),
the mistake compiler (one-perturbation compiles with pinned outcomes), the one-line
road DSL, the marker vocabulary (hourglass turn-point / ring apex / dot exit), the
lane-constrained-by-default rule, metric units, and the honesty stance (honest
limitation placards; never ship a trajectory the engine didn't produce).

**Deliberately changed:** the architecture (D1), the compactness mechanism (D2),
the physics ceiling (D3), the sight-cast eye (D4), mistake-line shareability (D6),
input effectuality (D8), and the colour law (D9).

**New subsystems with no prior equivalent:** the diagram projection and proportion
gate, the stepper/HUD, the POV renderer, `stateAt`, and the visibility-governed
solver mode.

`extract/` remains in the repository as the historical design record; where a
sibling document is silent, the prior design's choice is a reasonable default, but
on any conflict **this set wins**.
