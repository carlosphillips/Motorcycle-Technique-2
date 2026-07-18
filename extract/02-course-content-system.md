# The HTML Cornering Course — Content System

The teaching artifact of this project: a self-contained, zero-build HTML course
that explains the book's cornering doctrine in prose, diagrams, and quizzes. It
lives in `cornering-course/` and sits downstream of the doctrine distilled in
`STANDARD.md` and parallel to the physics `simulator/`. Where the simulator later
*grades* a numeric line against the doctrine, the course *teaches* it.

---

## 1. Design stance: no framework, no build step

The course is a set of literal `.html` files you open directly in a browser. There
is deliberately no build pipeline, no JS framework, no bundler, and no external
network call. CLAUDE.md states it plainly: **"No build step, no framework — open
the HTML directly."**

This single choice propagates into every other convention below:

- **Diagrams are inline, fully self-contained SVG.** Because there is no build step
  to inject shared CSS or JS into an SVG at render time, each diagram must be
  independently correct when the raw file is opened. Every `fill`, `stroke`, and
  `<defs>` block lives inside the `<svg>` element itself (see §5).
- **Animation is native SMIL, not JavaScript** (§7), preserving the no-JS-dependency
  property even for moving diagrams.
- **One shared stylesheet, one shared script.** `assets/style.css` and
  `assets/quiz.js` are the only two shared assets, linked/loaded by every page. They
  handle page chrome and the quiz interaction — never diagram colour or geometry.

The payoff of self-containment is verifiability: any diagram can be rendered and
judged in isolation by the render harness (`tools/render_diagrams.py`) without the
rest of the page being present. That workflow is the subject of doc 04.

---

## 2. Course structure — 15 chapters, index, glossary

The course synthesizes Lee Parks' *Total Control* with five other rider-training
sources (Keith Code's *A Twist of the Wrist II*, Nick Ienatsch's *Sport Riding
Techniques* / "The Pace", UK Roadcraft, the MSF curriculum, and Yamaha Champions
Riding School) into, per `index.html`, "one coherent street-first system" for
choosing a cornering line and speed.

### Two-part arc

`index.html` states the structure as two parts:

- **Part I — Modules 1–12: single-corner fundamentals.** Crash diagnosis → physics
  → steering → vision → corner anatomy → the three mistakes → entry speed → throttle
  → braking/trail-braking → corner catalog → special situations → drills.
- **Part II — Modules 13–15: multi-turn line planning.** The framework, an
  11-sequence playbook library, and a terrain/blind-sequence capstone.

### The chapter files

| # | File | Module theme |
|---|------|--------------|
| 1 | `01-why-corners-go-wrong.html` | Crash diagnosis |
| 2 | `02-physics.html` | Physics of lean/speed/radius |
| 3 | `03-steering.html` | Countersteering / quick turn |
| 4 | `04-vision.html` | Where to look |
| 5 | `05-corner-anatomy.html` | Turn point, apex, line parts |
| 6 | `06-three-mistakes.html` | Premature initiation, slow steering, fifty-pencing |
| 7 | `07-entry-speed.html` | Speed selection |
| 8 | `08-throttle.html` | Throttle control |
| 9 | `09-braking-trail-braking.html` | Braking / trail-braking |
| 10 | `10-corner-types.html` | Corner catalog |
| 11 | `11-special-situations.html` | Special situations |
| 12 | `12-drills.html` | Practice drills |
| 13 | `13-line-framework.html` | Multi-turn framework |
| 14 | `14-multi-turn-library.html` | Sequence playbook library |
| 15 | `15-terrain-blind.html` | Terrain / blind-sequence capstone |

### The hub: `index.html`

The sole home page. It renders two `.module-grid`s of `<a class="card">` tiles —
Modules 1–12, then 13–15 — each tile carrying `<span class="num">MODULE N</span>`,
an `<h3>` title, and a one-line teaser. It also contains a "course's spine in one
paragraph" synthesis sentence that chains the modules in teaching order
(7→4→5→3/6→8→9→10→12), and a `<ul class="sources">` listing the six primary
references.

### The reference: `glossary.html`

A single flat `<table>` (columns: Term / Meaning / Module) of ~30 terms, each row
linking to the module of its fullest treatment (some rows link to two modules,
e.g. "Held exit" → 13, 14). Terms include: Apex, Arc = Speed, Commit point,
Connected line, Contact patch, Counterbalancing, Countersteering, Danger zone,
Decision point, Delayed apex, Decreasing-radius corner, Direct steering, Early
apex, Fifty-pencing, Floodlight vision, Held exit, Limit point, Linking position,
Line, Master linking rule, Outside-inside-outside, Position strip, Premature
initiation, Priority corner, Quick turn, Sequential line, Slow steering, Spotlight
vision, Survival reactions, Target fixation, Throttle application point, Traction
budget, Trail braking, Turn point, Two-Step.

Cross-linking throughout the course is purely relative `<a href="NN-slug.html">`
plus in-prose module callouts (e.g. "the full mechanism is in Module 8"). Links are
hand-authored to match filenames; there is no build-time link validation.

---

## 3. Anatomy of a chapter

Every chapter follows an identical skeleton (confirmed against chapters 2, 8, 13):

1. **`<head>`** — charset, viewport meta, `<title>{Chapter title} — Cornering
   Mastery</title>`, and the single stylesheet link
   `<link rel="stylesheet" href="assets/style.css">`.
2. **`<header class="site">`** — sticky nav bar: brand link to `index.html`, plus nav
   links to `index.html` and `glossary.html`; the current page is marked
   `class="current"`.
3. **`<main><article class="lesson">`** — the body:
   - `<p class="kicker">Module N · {theme}</p>` (e.g. "Module 8 · Speed Management").
   - `<h1>` chapter title, then `<p class="lede">` — a one-sentence hook.
   - Sectioned prose in `<h2>`/`<h3>`, with:
     - `<div class="formula-block">` for standalone equations, inline `<code>` for
       formula fragments.
     - `<kbd class="term">` for newly-coined vocabulary (e.g. "maintenance
       throttle", "commit points").
     - `<div class="callout">` / `.warning` / `.tip` boxes for crash-mechanism
       warnings and rules of thumb.
     - `<table>` for worked-example data.
   - **5–14 `<figure class="diagram">` blocks** interleaved through the prose, each
     wrapping an inline `<svg>` and a `<figcaption>` (see §4, §5).
   - A `<div class="quiz">` block near the end (see §6).
   - `<h2>Sources & further reading</h2><ul class="sources">` — a per-chapter
     citation list (book chapter + external URLs), sometimes carrying an explicit
     *synthesis* disclaimer (see §8).
4. **`<nav class="pager">`** — Previous / Next module links.
5. **`<footer class="site">`** — disclaimer.
6. **`<script src="assets/quiz.js"></script>`** — loaded at the very end of `<body>`.

---

## 4. The ~108-diagram scale and the Fig naming rule

The course carries **108 inline SVG diagrams** total. Per-file counts (all confirmed):

| Ch | SVGs | Ch | SVGs | Ch | SVGs |
|----|------|----|------|----|------|
| 01 | 4 | 06 | 7 | 11 | 6 |
| 02 | 6 | 07 | 5 | 12 | 6 |
| 03 | 5 | 08 | 6 | 13 | 8 |
| 04 | 6 | 09 | 6 | 14 | 12 |
| 05 | 7 | 10 | 10 | 15 | 14 |

### The positional naming rule (load-bearing)

CLAUDE.md fixes the naming convention: **the *N*-th `<svg>` element in a file is Fig
*chapter*.*N***. So the 4th `<svg>` in `08-throttle.html` is Fig 8.4; captions in
`02-physics.html` run Fig 2.1 → 2.6 in document order, matching positional index.

This positional index also derives the **render id**: Fig *C.N* renders to
`{file-stem}_svg{NN}` (zero-padded), e.g. Fig 5.6 → `05-corner-anatomy_svg06`.

**The naming is derived, not embedded.** No `id="…svgNN"` attributes exist in the
HTML source; the file-stem-plus-positional-index mapping is computed by the render
harness (`tools/render_diagrams.py`), which matches each `<svg>…</svg>`
non-greedily and numbers them 1-based per file. The `<figcaption>` carries the
human-facing label as `<strong>Fig C.N — Title.</strong>` followed by 1–3 sentences
interpreting the diagram and tying it back to the rule it illustrates.

---

## 5. Inline SVG diagram conventions

Every diagram is a **fully self-contained inline SVG**. Each `<svg>` carries its own:

- `viewBox`;
- `<defs>` with arrow `<marker>`s keyed by colour (e.g. `id="ag"` = green
  arrowhead `fill="#1f6f43"`, `id="ar"` = red `#b32e2e`, `id="ao"` = amber
  `#b07d1e`);
- an inline `<style>text{font-family:…}</style>` scoped to that one SVG;
- a `role="img"` root with a descriptive `aria-label` that doubles as a terse
  machine-readable summary of the diagram (used for accessibility and as a
  first-pass judging check without rendering).

No external CSS class supplies any diagram colour or geometry — every `fill`/`stroke`
is a hardcoded hex literal in the markup. The `<figure class="diagram">` wrapper
(white paper background, border, shadow) comes from `style.css`, but the drawing
itself does not depend on the stylesheet loading.

### The colour code — doctrine, not decoration

Colour is applied so consistently across all 108 diagrams that it functions as a
second notation system: a reader can spot "the mistake" by colour alone before
reading the caption. It is a **hard normative signal** — a correctly-shaped line
drawn in the wrong colour fails the doctrinal-correctness axis of the render-time
judging test (doc 04).

| Meaning | Colour | Hex values |
|---------|--------|------------|
| Good / ideal line, correct behavior | **Green** | `#1f6f43`, `#1c4732` |
| Geometric / middling / mistake-in-progress / "tight line" contrast | **Amber** | `#b07d1e`, `#e8c832` |
| The mistake / crash outcome / danger | **Red** | `#b32e2e`, `#7a2222` |
| Road surface | Dark gray | `#3a3d40` |
| Grass / verge | Pale green | `#dce8d0` |
| Lane-edge lines | White | `#ffffff` |
| Lane-divider dashes | Amber | `#e8c832` |

The ideal ("green") line the diagrams target is the doctrine's canonical shorthand:
a **single smooth-arc, late-apex, outside–inside–outside** path.

### The on-road constraint

Diagrams are built road-first: road polygons drawn first (`fill="#3a3d40"`) with
inset lane-divider dashes, then the line-of-travel paths layered on top as dense
point-by-point `L`/`C` polylines (evidently machine-generated coordinate sequences,
not hand-drawn), terminating in a colour-coded arrowhead marker. **Every drawn line
must stay on the modeled road surface** — a line spilling into the grass is a defect
*unless* "running wide" is the mistake being taught.

### Annotation and marker vocabulary

- **Plan-view callouts:** overhead figures annotate lane bands with translucent
  callout boxes (`fill="#ffffff" stroke="#9db3c8"`) and leader lines rather than
  bare text — keeping all annotation inside the SVG.
- **Reused markers with unique local ids:** when a figure needs distinct arrowheads
  of the same colour across side-by-side scaled sub-panels, markers get per-panel
  ids (e.g. Ch.13's Fig 13.6/13.7 use `ag6a`/`ag6b`, `ag7a`/`ag7b` for two scaled
  copies of one road inside a single `<svg>`).
- **Position-strip charts** (new in Part II): a second chart embedded beneath the
  overhead road view plots lane band (Outside/Middle/Inside, y-axis) vs. distance
  (x-axis), using the same green "good line" polyline style to show band holds and
  transitions over distance. This was added specifically because a single overhead
  view can't show lane-band *history* across a multi-turn sequence — a purpose-built
  second chart type rather than overloading the plan view.
- **New markers introduced in Ch.13** (caption calls it "New marker convention for
  this and later modules"): a **blue diamond** (`fill="#3b6ea5"`, 14×14 square
  rotated 45°, white center dot) = **decision point** (where new information
  arrives), distinct from the pre-existing **circled-X** marker (dark circle + white
  X) = **commit point** (turn point, where options are spent).

---

## 6. The quiz subsystem — `assets/quiz.js`

Each chapter ends with a `<div class="quiz">` block (typically 5–6 multiple-choice
questions). The behavior is driven entirely by one shared script, `assets/quiz.js`,
with **zero external dependencies** and no exported API — it is a single
self-invoking DOM script.

### Markup contract

Documented verbatim as a comment at the top of `quiz.js`:

```html
<div class="quiz">
  <h2>Check your understanding</h2>
  <fieldset>
    <legend>1. Question text?</legend>
    <label><input type="radio" name="q1" value="a"> Option A</label>
    <label><input type="radio" name="q1" value="b" data-correct> Option B</label>
    <p class="explain">Why B is right.</p>
  </fieldset>
  ... more fieldsets ...
  <button type="button" class="check">Check answers</button><span class="score"></span>
</div>
```

Data shape, restated: each `<fieldset>` is one question with 3 `<label>` options,
**exactly one** input marked with the `data-correct` attribute, and **one**
`<p class="explain">` per fieldset (not per option) giving the doctrinal
justification — the explanation quotes and reinforces the equation or rule taught in
the prose just above.

### Behavior

A single `DOMContentLoaded` listener finds every `.quiz` block on the page and wires
its `button.check` click handler. On click, for that block:

1. Iterate every `fieldset` (one per question); strip any prior
   `correct`/`incorrect` classes.
2. Read `input:checked`. If none, skip the question (left unanswered).
3. If the chosen input carries `data-correct` → add `.correct` to the fieldset and
   increment the `right` count; otherwise add `.incorrect`.
4. Write to the `.score` span:
   - if `answered < sets.length` → `"Answer all N questions (X answered)."`;
   - else → `"{right} / {N} correct"`, suffixed `" — nice line!"` on a perfect
     score or `" — review the explanations above."` otherwise.

CSS in `style.css` completes the feedback loop: it reveals `.explain` only on a
`fieldset.correct`/`.incorrect` (with a green/red left-border tint) and appends a
`✓`/`✗` glyph via `legend::after`.

Because each chapter carries its own independent `.quiz` block and the script simply
re-queries the DOM, the same file works unchanged on every page.

### Rationale: one explanation per question, not per wrong answer

Attaching a single `.explain` to the correct answer (rather than one per wrong
option) keeps the DOM and JS deliberately simple — a single reveal element per
question. The stated tradeoff: the quiz does not individually explain *why* each
wrong option is wrong.

---

## 7. SMIL animation

A minority of figures animate using **native SVG `<animate>` elements — not
JavaScript**. `<animate…>` tags appear in 5 of the 15 chapters:
`01-why-corners-go-wrong.html`, `05-corner-anatomy.html`, `06-three-mistakes.html`,
`10-corner-types.html`, and `14-multi-turn-library.html`. Per project memory these
were delivered as part of the scene-baking work (Phases S0–S5) — e.g. animating a
dot along a path to show a moving reference point.

Using SMIL rather than a JS animation library is a direct consequence of the
no-framework stance (§1): the animated diagrams remain self-contained and render
without any script dependency. Most of the 108 diagrams are static; this is the
exception, not the rule.

---

## 8. Provenance signalling: synthesis disclaimers

The course teaches Parks' method but extends it — especially in Part II, which
introduces original vocabulary (commit point, decision point, segment, linking
position, held exit, the four-case knowledge/visibility framework). Because the
project rule is "when course and book disagree, the book wins," the course marks
which claims are Parks' doctrine and which are its own extension.

Chapters 13+ repeatedly insert an explicit `<em>Synthesis: … treat it as this
course's method.</em>` sentence (e.g. Ch.13: *"Synthesis: this framework extends the
sources' principles … treat it as this course's method."*). This is a deliberate
provenance signal so a later doctrine-vs-book conflict check can tell an authored
extension apart from a verbatim book claim.

---

## 9. How figures get onto the page — hand-authored vs. scene-baked

The 108 diagrams reach the page by two distinct routes. This section is a
forward-reference; the scene-baking pipeline is documented fully in **doc 06**.

- **Hand-authored figures** — the SVG is written and edited directly in the chapter
  HTML. Most diagrams are of this kind.
- **Scene-baked figures** — thirteen course figures are *compiled* from `.scene`
  source files in `cornering-course/scenes/` by the simulator's authoring layer and
  stamped into the chapter HTML between guard comments. For these, you **edit the
  `.scene`, never the stamped SVG**; a re-bake would silently overwrite any hand
  edit. Provenance for each figure (`hand` vs. `scene:<file>`) is recorded in the
  audit records.

Both routes produce the same self-contained inline SVG described in §5, so the page
and the render harness treat them identically once stamped. The difference is only
in how they are edited and regenerated.

---

## 10. Design decisions with stated rationale

- **No framework / no build step** — chapters are literal standalone HTML so they
  open directly and each diagram is portable and verifiable in isolation.
- **Self-contained SVG over CSS-styled SVG** — chosen precisely because there is no
  build pipeline to inject shared CSS/JS into a diagram; each SVG must be correct
  when opened raw, which is what makes the automated render-and-vision-judge
  workflow possible.
- **Colour-as-doctrine** — green/amber/red is a normative notation system, not
  styling; wrong colour = doctrinal failure.
- **One quiz explanation per question** — a single `.explain` reveal keeps the JS
  trivial, at the cost of not refuting each wrong option individually.
- **Explicit synthesis disclaimers in Part II** — a provenance signal that lets the
  "book wins" conflict check distinguish authored extensions from Parks' doctrine.
- **Position-strip charts introduced only in Part II** — a purpose-built second
  chart type for multi-turn lane-band history, rather than overloading the overhead
  plan view.
- **Metric-only prose from imperial sources** — the course states values in
  km/h / m / m/s / degrees while its cited American sources are in US units;
  agreement is by verified arithmetic conversion (mph→km/h ×1.609; ft→m ×0.3048),
  not verbatim copying. (The physics content itself is covered in doc 03.)

---

## Key file paths

- `cornering-course/index.html` — course hub
- `cornering-course/glossary.html` — flat term table
- `cornering-course/01-…html` … `cornering-course/15-terrain-blind.html` — the 15 chapters
- `cornering-course/assets/style.css` — single shared stylesheet
- `cornering-course/assets/quiz.js` — single shared quiz script
- `cornering-course/scenes/` — `.scene` sources for the 13 scene-baked figures (doc 06)
