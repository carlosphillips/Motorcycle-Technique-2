# Project Overview & Design Philosophy

## What this project is

This repository is a two-artifact teaching project built from a single
ground-truth source: **Lee Parks, *Total Control: High-Performance Street Riding
Techniques***. Its goal is to teach one specific skill — the book's **cornering
line-selection method** — to street riders, and to do so with enough rigor that
every diagram, number, and claim can be checked against the book rather than
against taste.

The two artifacts are:

1. **`cornering-course/`** — a self-contained, no-build-step HTML course: 15
   numbered chapters plus `index.html` and `glossary.html`, each a standalone
   `.html` file with inline SVG diagrams (108 across the course) and a short
   quiz. It teaches the book's method as a coherent street-first system,
   synthesizing *Total Control* with UK Roadcraft's limit-point method, Keith
   Code's *A Twist of the Wrist II*, Nick Ienatsch's "The Pace," the MSF
   curriculum, and Yamaha Champions Riding School — "all rewritten as one
   coherent street-first system" (per `index.html`).
2. **`simulator/`** (module `moto-sim/1`) — a zero-dependency JavaScript physics
   simulator that integrates a motorcycle through a corner from authored inputs
   and returns a **doctrine verdict**: a grade of the resulting line against the
   book's method. It can also *generate* book-style figures that are guaranteed
   physically plausible by construction.

The unifying idea, and the reason the project is shaped the way it is, is that
**the book is doctrine** — not merely source prose to paraphrase, but the
standard of correctness that every part of the project is measured against.

## The "book is doctrine" principle

The ground-truth object is the book itself, distributed in-repo as a Kindle
`.azw3` file (`Total Control- … Lee Parks … .azw3`, ~25 MB at the repo root,
never edited). The governing rule is stated plainly: **when the course and the
book disagree, the book wins.**

This principle is *operationalized* — turned from a slogan into a working
mechanism — through three moves:

### 1. Extraction, not memory

Two PEP-723 self-contained `uv` scripts pull the book into git-tracked,
human-readable form so that agents and readers never have to re-parse the 25 MB
`.azw3` each session:

- `uv run tools/extract_book.py` → `book_text/`: `parts/part{NNNN}__{slug}.txt`
  (32 spine parts, non-contiguous numbering), `total-control-fulltext.md` (whole
  book, ~475 KB), and `PARTS.tsv` (index). The core line doctrine lives at
  `book_text/parts/part0014__chapter-8-line-selection.txt` (Chapter 8, "Line
  Selection").
- `uv run tools/extract_images.py` → `book_images/`:
  `by-figure/fig-{CC.NN}[__{slug}].jpeg` (87 numbered figures),
  `images/image{NNNNN}.jpeg` (258 raw extracts), plus `FIGURES.tsv` and
  `figures.json` indices.

Both extractions **wipe and rebuild** their output directory on each run, and —
unusually — both are **committed to git rather than gitignored**. The
`.gitignore` explicitly disables its own ignore rule with a comment to the
effect that the prose and figures are "Now COMMITTED … so [they are]
readable/browsable without regenerating." This is a deliberate
reproducibility-and-ergonomics tradeoff: a larger repository in exchange for
zero-friction reading, so that any agent can `rg` the book's prose or browse a
figure without ever touching the `.azw3` or running an extractor. The `.azw3`
remains the untouchable ground truth; the committed extractions are a convenience
layer over it.

### 2. Distillation into a rubric — `STANDARD.md`

`STANDARD.md` (top-level) distills Chapter 8 "Line Selection" plus the supporting
physics chapters (Section 1 "Chassis Dynamics," Ch. 2 "Steering," Ch. 9 "Throttle
Control," Ch. 11 "Braking") into a concrete rubric that every diagram and every
content claim is checked against. It is explicitly two-purpose:

> Judging a diagram — apply the two-axis test.
> Judging a claim — check it against the doctrine and physics below; a claim that
> contradicts this standard (or the book) is a finding.

`STANDARD.md` is deliberately kept **separate from `CLAUDE.md`**. `CLAUDE.md` is
*process and workflow* (how to build, how to verify, what gates to run);
`STANDARD.md` is the *content rubric* (what "correct" actually means). Keeping
them apart lets the verification workflow cite `STANDARD.md` as an external,
stable acceptance test rather than burying judgment criteria inside code or
inside the build instructions.

### 3. Living audit loops

Two audit documents close the loop, and each is explicitly a **fix list for the
next loop**, not a one-off report:

- `line-diagram-audit.md` — an SVG geometry/doctrine audit of all 108 course
  figures against `STANDARD.md`. Its headline verdict: the diagrams are sound;
  only cosmetic legibility items remain. It also carries a **provenance column**
  distinguishing hand-authored figures (`hand`) from simulator-generated ones
  (`scene:<file>`).
- `content-fidelity-audit.md` — a per-chapter audit of every factual and metric
  claim against the book text and against independent recomputation of the
  physics. Its bottom line: the teaching is trustworthy; remaining fixes are a
  precision pass (the largest cluster being leftover imperial units missed by an
  earlier conversion sweep).

## The two-axis test

The heart of `STANDARD.md` — and the reason the project can judge a figure
mechanically instead of by opinion — is the **two-axis test**, applied to every
rendered figure. A figure passes only if **both** axes pass:

- **Axis A — physical plausibility.** Could a real motorcycle actually follow the
  drawn line? A ridden path must be one continuous curve with no kinks, cusps, or
  sharp vertices (except deliberate "fifty-pencing" faceting, which is itself a
  taught mistake); no discontinuous jumps in radius; and no unintended departure
  off the road surface.
- **Axis B — doctrinal correctness.** Does the figure teach the *right* line? The
  green/good line must be a smooth single-arc, late-apex,
  outside-inside-outside path that exits pointed down the road; each red or amber
  mistake line must correctly depict its named error and run wide at the exit;
  special cases (decreasing/increasing radius, double apex, linked turns,
  hairpins, blind corners) must follow the book; and reference charts (force
  triangle, friction circle, braking-distance parabola, √r speed curve, cone-drill
  layouts) must be numerically correct.

A third category, **legibility** (label overlaps, tangled crossing lines,
over-exaggerated "bad" geometry), is *reported but does not fail* a figure — it
is cosmetic only.

This two-axis frame is why a **separate visual-verification subagent** is
mandatory before any figure change is called done. The rule — born from a real
bug where Figs 5.2/5.4 appeared to "run wide" — is that "the geometry math can be
exactly right while the picture reads wrong": arrows spilling off the asphalt into
the grass, a "good" line that visually appears to run wide, callouts pointing at
empty space. The subagent's visual verdict, judged against the two axes, is the
actual gate for "done" — not the arithmetic.

## The ideal line

The canonical target — the acceptance criterion for any "green"/good line
anywhere in the project, and the line the simulator's authoring layer is meant to
discover and validate against physics — is a single phrase used verbatim
throughout `CLAUDE.md` and `STANDARD.md`:

> **A single smooth-arc, late-apex, outside-inside-outside path of travel.**

Unpacked, per `STANDARD.md`'s reading of Chapter 8:

- **Outside-inside-outside, with a late (delayed) apex** — enter wide, delay the
  turn point, touch the inside *past* the geometric middle, and drift back out
  already pointed down the road.
- **One smooth, continuous arc** — a single steering input, a single radius. "By
  taking the straightest line through a curve, lean angle is reduced and traction
  is maximized."
- **`Arc = Speed`** — the radius of the line is directly proportional to the speed
  that can be carried. The street rider banks the surplus radius as a **hazard
  reserve** rather than spending it on speed, which is the key difference from the
  racer.
- **The turn point is the master decision** — "Creating the ideal line through a
  turn starts with the choice of a turning point." (This principle is what the
  simulator enforces structurally; see below.)
- **Quick steering, then throttle** — delay entry, countersteer to the needed lean
  *quickly*, then roll on the throttle to stabilize the chassis and drive out.
- **Rule of thumb** — "it is always better to err on the side of a slow entry and
  faster exit than vice versa."

An early apex, kinks, or a "good" line that runs wide is, by definition, **wrong**.

`STANDARD.md` also enumerates the three canonical mistakes (each sharing the same
consequence — a forced wide exit, magnified with speed): **premature initiation**
(turning in too soon → early apex), **slow steering** (too long from upright to
full lean, holding the bike in the vulnerable "danger zone"), and
**fifty-pencing** (multiple mid-corner corrections producing a faceted line, named
for the many-sided 50-pence coin). A subtlety recorded on purpose: a faceted
fifty-pencing line is the *correct, intended* illustration of that mistake, not a
rendering bug, and it must be distinguished from a legitimate **double apex**.
Calling this out explicitly is a deliberate design decision to prevent
false-positive audit findings.

## The colour code

Colour is a **hard normative signal**, not decoration — it is part of Axis B of
the two-axis test, meaning a correctly-shaped line drawn in the wrong colour still
fails. The code is:

| Colour | Meaning | Simulator hex |
|---|---|---|
| **Green** | The good / ideal line | `#1f6f43` |
| **Amber** | A geometric / middling line | `#b07d1e` |
| **Red** | The mistake being taught (the bad line) | `#b32e2e` |

Markers and arrowheads share the colour of the line they belong to. In the
simulator, this palette is reserved *strictly* for line quality; the controls-view
data channels use deliberately neutral colours (steel-blue, purple, teal, slate)
so they can never collide with the line-quality code.

## Metric units by correct conversion

The course teaches entirely in **metric units** — km/h, m, m/s, degrees — with no
US units in the teaching material. The book, however, is written in US units. The
project therefore does *not* require verbatim numeric agreement with the book;
instead, agreement is judged by **correct conversion arithmetic**:

- mph → km/h: **× 1.609**
- ft → m: **× 0.3048**

The rule for anyone editing near a number is: "When you touch a number, verify the
conversion arithmetically" — redo the conversion rather than trusting the existing
text. `STANDARD.md` adds a nuance about materiality: a conversion or rounding
difference is only a *finding* if it "changes the teaching." Rounding is
acceptable; doctrine drift is not. The simulator carries the same commitment,
using `g = 9.81 m/s²` throughout and concentrating every unit constant in a single
`units` module precisely because leftover imperial constants are the repository's
"most-audited bug class."

## The "no build step" stance

A deliberate, load-bearing constraint runs through the whole project: **there is
no build step, no framework, and no dependency to install. You open the HTML
directly.**

- Course chapters are literal standalone `.html` files with inline `<svg>`
  diagrams, inline-`<script>`-driven quizzes (`assets/quiz.js`), and one shared
  stylesheet (`assets/style.css`). "No build step, no framework — open the HTML
  directly" (`CLAUDE.md`).
- This is *why* every diagram SVG is fully self-contained, with inline
  `fill`/`stroke`/`<defs>` and no reliance on external CSS for colour or geometry:
  there is no build pipeline to inject shared styles into an SVG at render time,
  so each diagram must be independently correct the instant a raw file is opened
  in a browser.
- The simulator is likewise a "zero-build JS subsystem" run directly via `node`,
  with **no `package.json` and no `node_modules`** — an invariant enforced by a
  gate check.

The rationale becomes concrete in the simulator's most consequential
architecture decision: its physics core is written as **classic scripts attaching
to a frozen global namespace** (`globalThis.SIM`), not as ES modules and not in
TypeScript. Both `<script type="module">` and `fetch()` fail from a `file://`
origin in every major browser, and the project's hard requirement is that
chapters open directly as local files. Reusing the existing `quiz.js` idiom — an
ordered set of `<script src>` tags each attaching to a frozen global — lets one
single physics source of truth run *unchanged* in both the browser and Node (the
latter via side-effect import). TypeScript was rejected outright because it would
reintroduce the build step the whole project is organized to avoid.

## Why two artifacts — course *and* simulator

The two artifacts exist because they solve two different problems, and each
compensates for a weakness of the other.

The **course** is the deliverable: a human-readable, self-contained lesson. But
its 108 diagrams were originally hand-authored polylines with no mechanical link
to any physics — a "good" line was good because a human said so, and a mistake
line was a hand-tuned drawing. That is fragile: a diagram can be geometrically
plausible and doctrinally wrong, or drawn in a way no real motorcycle could ride.

The **simulator** exists to make the doctrine **causal and inspectable**, and to
generate figures that are *provably* correct on Axis A. Its defining design choice
is that the rider commits only **inputs** — where to brake and how hard, where to
turn in and how fast to roll to lean, where to pick up throttle — and everything
that matters for judging the line (**apex, exit, required lean, run-wide outcome,
and any corrective maneuver**) **emerges from physics, never from a knob.** There
is, grep-provably, **no `apex` field anywhere in the input schema.** This
structurally enforces the doctrine's master rule — "the turn point is the master
decision" — because the apex is a *consequence* of the turn point and speed, not
something an author can simply assert.

This inversion also changes the economics of verification. Compiled scenes make
**Axis A true by construction** — a line the engine integrated is, by definition,
one a motorcycle could ride — so the mandatory vision subagent's job shrinks from
auditing 108 figures for physical plausibility to spot-checking Axis B (doctrinal
correctness) and legibility. The design goal recorded for the scene-authoring
workflow sets the ergonomic bar numerically: authoring a full compound figure
(road + good line + mistake line + markers + animation) must take **≤ 6 lines of
scene text and one bake command**, with the wide exit of a mistake line
*emerging* from a named perturbation run through the real engine rather than being
drawn by hand ("physics is the validator, not the generator").

The simulator's figures must be **indistinguishable from the course's
hand-authored inline SVGs** and must pass the same `render_diagrams.py` gate
unmodified — the two artifacts converge on one shared visual standard. Thirteen
course figures are now compiled from `.scene` source files this way (edit the
`.scene`, never the baked SVG); the rest remain hand-authored. Both kinds answer
to the same `STANDARD.md`.

## The rationale, in one sentence

Every structural choice in this project — committing the extracted book, distilling
it into `STANDARD.md`, the two-axis test, the mandatory vision subagent, the
metric-by-conversion rule, the no-build/`file://`-first stance, and the apex-less
simulator input schema — serves a single intent: to teach Lee Parks'
line-selection method in a form where **correctness is something you can prove
against the book, not something you assert.**
