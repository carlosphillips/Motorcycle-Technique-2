# Design-Doc Set — Reading Guide & Project Map

This is the index for a set of design documents extracted from the **Motorcycle
Cornering** project. A reader who lands here in a fresh context should be able to
understand what the project is, how its two artifacts relate, and which sibling
document answers which design question — all without opening the codebase.

> **What these documents are — and are not.** This set deliberately captures
> **design intent, physics, workflows, and API surfaces** — the *why* behind
> decisions, the equations and constants the system rests on, the CLI/DSL grammars
> that drive it, and the function signatures that name its contracts. It contains
> **no source-code dumps**. Behaviour is described in prose; code appears only as
> equations, named constants (`name = value + units`), CLI/`.scene` grammar, and API
> signatures, and only where that materially aids understanding. To read the actual
> implementation, go to the repository; to understand the *decisions*, read here.

---

## 1. What this project is

The project is a **two-artifact teaching system built from a single ground-truth
book**: Lee Parks' *Total Control: High-Performance Street Riding Techniques*,
committed at the repo root as an `.azw3` (Kindle) file. Everything else in the repo
is derived from — and judged against — that book. The two artifacts are:

1. **`cornering-course/`** — a self-contained, **no-build-step** HTML course: 15
   numbered chapters plus `index.html` and `glossary.html`, each a standalone `.html`
   file with **inline SVG diagrams** (108 figures across the course) and a short
   inline-scripted quiz. It teaches the book's line-selection method to street
   riders, synthesizing it with UK Roadcraft's limit-point method, Keith Code's *A
   Twist of the Wrist II*, Nick Ienatsch's "The Pace," the MSF curriculum, and Yamaha
   Champions Riding School — "all rewritten as one coherent street-first system." You
   open the HTML directly; there is no framework, bundler, or build.

2. **`simulator/`** (module name `moto-sim/1`) — a dependency-free JavaScript physics
   simulator that integrates a motorcycle through a corner from **authored inputs**
   (a turn-in station, a brake/throttle profile) and returns a **doctrine verdict**.
   Its defining property: the rider commits only inputs, and **apex, exit, run-wide
   behaviour, required lean, and the corrective maneuver all emerge from physics** —
   they are never hand-specified. There is no `apex` field anywhere in the input
   schema; this is enforced structurally, not by convention.

The unifying principle is that **the book is doctrine, not just source prose**. Every
diagram, every numeric claim, and every simulator verdict is judged against it. A
distilled rubric (`STANDARD.md`) exists specifically to make that judgment
*mechanical and reproducible* rather than a matter of taste, and the rule that
settles disputes is blunt: *when course and book disagree, the book wins.* Two
running audit files close the loop as living fix-lists rather than one-off reports:
`line-diagram-audit.md` (SVG geometry/doctrine across all 108 figures) and
`content-fidelity-audit.md` (per-chapter factual/metric claims). The book itself is
extracted into committed, human-readable form (`book_text/`, `book_images/`) so
agents can read the prose and browse the figures without ever re-parsing the 25 MB
`.azw3`.

---

## 2. The sibling documents (01–09)

Each document below answers a distinct set of design questions. Read them in order
for a full tour, or jump directly to the one that matches your question.

### 01 — Project Overview & Doctrine
The "book is doctrine" principle in full: how the ground-truth `.azw3` is extracted
into committed text and images, how `STANDARD.md` distills Chapter 8 ("Line
Selection") plus the supporting physics into a two-purpose rubric (judging a diagram
vs. judging a claim), and the doctrine itself — the ideal outside–inside–outside
late-apex line, the three canonical mistakes (premature initiation, slow steering,
fifty-pencing), and the special-case corners (decreasing/increasing radius, double
apex, linked turns, hairpins, blind bends). Read this first to understand *what
"correct" means* in this project.

### 02 — Conventions: Units, Colour, No-Build
The project-wide conventions restated as rules with rationale: **metric units
throughout** (km/h, m, m/s, degrees) with agreement to the US-units book judged by
*correct conversion* (mph→km/h ×1.609; ft→m ×0.3048), not string-matching; the hard
**colour code** (green = good/ideal line, amber = geometric/middling, red = the
mistake being taught) as a normative doctrinal signal, not decoration; and the
**no-build stance** that forces every SVG to be fully self-contained (inline
`fill`/`stroke`/`<defs>`) so each renders correctly when opened raw. (If a dedicated
conventions document is not broken out separately, these rules are covered inside 01
and 08.)

### 03 — Simulator Design of Record
The simulator's design-of-record: its purpose (making line-selection doctrine
**causal and inspectable**), the fidelity ladder (v1 = Tier 1 point-mass + friction
ellipse + roll-rate-limited lean; Tier 2/Tier 3 explicitly scoped out), the seven
lead-binding resolutions **[R1]–[R7]** that reshaped the v1 architecture, and the
red-team disposition (33 issues across four lenses, zero rejected). This is where the
big *why* decisions live — one-μ policy, integrated-shot corrective feasibility,
lane-constrained-by-default scenarios, id-addressed plans, and the classic-script /
no-package.json invariants.

### 04 — Simulator Physics & Algorithms
The equations, constants, and pseudocode that make the apex emerge. Covers the state
vector and continuous equations of motion; the emergent-curvature identity
`kappa = g·tan(phi)/v²`; the friction ellipse and its one-μ policy; the violation/
crash policy table with hysteresis deadbands; the stand-up coupling term; the RK4
time-domain integrator with event-bracketed sub-stepping; SSD/sight geometry; the
apex/exit/run-wide measurement definitions; corrective-shot root-finding; and the
worked R60 example. Named golden numerics are quoted verbatim as regression anchors.
This is the physics document — equations and pseudocode are wanted here.

### 05 — Simulator API Spine
The frozen JS API contract (`SIM.*` namespaces): `result`, `units`, `config`,
`physics`, `style`, `geom`, `road`, `plan`, `integrate`, `analyze`, `visibility`,
`scenario`, `doctrine`, plus the Phase-2 solvers (`shoot`, `simulate`, `presets`) and
the ESM author layer (`solve`, `mistakes`, `scene`, `place`). Documents the scenario
wire schema (the id-addressed `PlanAction` list with *no* apex field), the Tier-1
verdict JSON shape, the closed sets for `outcome` and `diagnosis.cause` with their
precedence orders, and the 12 doctrine checks. Signatures only — the contract spine,
not the code.

### 06 — CLI & Read-Only Viewer
The single IO edge (`node simulator/cli.mjs`) and the browser viewer. Covers the full
verb table (`author suggest scene run sweep compare render check schema explain url
decode test`), the shared `--road` DSL grammar and flags, the exit-code semantics
(0 = ran / 2 = bad input / 3 = doctrine-gate fail / 1 = render-write fail), and the
numbers-to-steer / pixels-to-sign-off iteration loop. Also the read-only viewer
split (`index.html` workstation vs. `embed.html` hash-driven iframe shell), the
base64url-over-deflateRaw scenario encoding, and the classic-script `file://`
constraint that forbids ES modules and `fetch()`.

### 07 — Renderers & Diagram Style
How the simulator draws SVG that is indistinguishable from the course's hand-authored
figures: the top-down view (`render/topdown.js`) with its line-quality colour law
(colour keyed to *doctrinal line quality*, not raw outcome), draw-order discipline,
and hazard/sight geometry; the stacked controls strip-chart (`render/controls.js`)
with its deliberately **neutral** channel colours; and the shared frozen `STYLE`
module. Explains why colour is reserved strictly for line quality, why gravel is
stippled circles rather than an SVG `<pattern>`, and why every renderer emits a
self-contained SVG string that drops unmodified into a chapter.

### 08 — Tooling & Render Gates
The four PEP 723 self-contained `uv` Python scripts: the two extractors
(`extract_book.py` → `book_text/`, `extract_images.py` → `book_images/`, each
wipe-and-rebuild) and the two render gates (`render_diagrams.py` for the 108 course
SVGs, `render_sim_views.py` for simulator views). Documents the macOS libcairo
self-re-exec bootstrap, the `{stem}_svgNN` naming convention, the non-zero-exit gate
semantics, and — centrally — the **render-then-vision-judge loop**: rendering to PNG
is necessary but never sufficient; a separate vision subagent must judge the picture
against `STANDARD.md`, because "the geometry math can be exactly right while the
picture reads wrong."

### 09 — Project History, Planning & Verification
Why the codebase looks the way it does: the evolution narrative (course Phases 0–2 →
simulator v1 build → v2 authoring proto→graduation → Scenes phases S0–S6), the
audit-driven working style (each audit doc is a fix list for the next loop), the
Scenes proposal's diagnosis ("three systems and none of them owns the figure") and
its `.scene`-as-single-source-of-truth correction, and the three-pronged verification
philosophy: render-gate + two-axis vision sign-off (diagrams), byte-stability hash
tripwires (engine output), and scene-golden round-trip + idempotent stamping. Also
the `NEEDS_IMPROVEMENT.md` ergonomics ledger and the rejected alternatives (backward
planning as primary generator; widest-arc apex; trail braking as baseline).

*(Where the numbering above maps to more or fewer physical files than 01–09, treat
the section titles as the authoritative subject index; if a specific document is
absent, its subject is folded into the nearest neighbour as noted.)*

---

## 3. Top-level repository map

For orientation without the code. Paths are relative to the repo root.

| Path | Role |
|---|---|
| `Total Control- … Lee Parks … .azw3` | **Ground-truth book source** (Kindle, ~25 MB). Never edited; the book wins all disputes. |
| `STANDARD.md` | The distilled doctrine/rubric — the two-axis test every diagram and content claim is judged against. |
| `CLAUDE.md` | Project-level agent instructions: workflow, conventions, verification gates. |
| `book_text/` | **Committed** book extraction: `parts/part{NNNN}__{slug}.txt` (32 non-contiguous spine parts), `total-control-fulltext.md`, `PARTS.tsv`. Core doctrine at `parts/part0014__chapter-8-line-selection.txt`. |
| `book_images/` | **Committed** figure extraction: `by-figure/` (87 named figures), `images/` (258 raw), `FIGURES.tsv`, `figures.json`. |
| `cornering-course/` | The HTML course: `01-…html` … `15-…html`, `index.html`, `glossary.html`, `assets/` (`style.css`, `quiz.js`), `scenes/` (13 `.scene` source files for scene-baked figures). No build step. |
| `simulator/` | The `moto-sim/1` subsystem: `cli.mjs` (single entry point), `core/` (pure v1 physics, Result-based, classic-script frozen namespaces), `author/` (v2 authoring ESM), `render/` (SVG views), `app/`+`ui/` (read-only viewer), `scenarios/`+`examples/` (saved inputs), `tests/`, `out/` (git-ignored), plus docs `AGENT.md`, `CONTRACT.md`, `DESIGN.md`, `NEEDS_IMPROVEMENT.md`. |
| `tools/` | Four PEP 723 `uv` scripts: `extract_book.py`, `extract_images.py`, `render_diagrams.py`, `render_sim_views.py`. |
| `line-diagram-audit.md` | Living fix-list: SVG geometry/doctrine audit of all 108 figures (incl. the `hand` vs `scene:<file>` provenance column). |
| `content-fidelity-audit.md` | Living fix-list: per-chapter factual/metric claims verified against the book. |
| `PROPOSAL-scenes.md`, `PLAN-scenes.md`, `ROADMAP.md` | Planning/history docs for the scene-authoring feature line (phases S0–S5 complete). |
| `rendered/` | Git-ignored PNG output of `render_diagrams.py` + `manifest.json`. |

---

## 4. Conventions in brief

Three conventions are load-bearing across the whole project and are assumed by every
sibling document:

- **Metric units throughout.** All course content is in km/h, m, m/s, and degrees.
  The book is in US units, so numeric agreement is judged by *correct conversion
  arithmetic* — **mph → km/h ×1.609**, **ft → m ×0.3048** — not verbatim string
  match. A conversion error is only a finding when it "changes the teaching." The
  simulator uses **g = 9.81 m/s²** and keeps every unit constant in one `units`
  module to guard against the repo's most-audited bug class: leftover imperial
  constants.

- **The colour code is a hard doctrinal signal.** **Green = good/ideal line, amber =
  geometric/middling, red = the mistake being taught.** Markers and arrowheads
  inherit their line's colour. Colour is reserved *strictly* for line quality — the
  controls strip-chart uses deliberately neutral channel colours so nothing collides
  with this code. A correctly-shaped line drawn in the wrong colour still fails the
  doctrinal-correctness axis.

- **No build step.** Course chapters are literal standalone `.html` files opened
  directly; there is no framework or bundler. Consequently every SVG must be
  **fully self-contained** (inline `fill`/`stroke`/`<defs>`, no external CSS supplying
  diagram colour/geometry) so it renders faithfully in isolation. The simulator is
  likewise a **zero-build** JS subsystem — classic scripts attaching to a frozen
  `globalThis.SIM`, ordered `<script src>` load, **no `package.json` anywhere** (a
  gate-checked invariant) — precisely so the viewer runs from a `file://` origin
  where ES modules and `fetch()` fail.

The canonical shorthand for the target line, used identically across `CLAUDE.md`,
`STANDARD.md`, and the simulator's `author` verb, is: **a single smooth-arc,
late-apex, outside–inside–outside path.** That phrase is the acceptance criterion for
any "green"/good line — the thing the diagrams must draw and the thing the simulator
must discover from physics.
