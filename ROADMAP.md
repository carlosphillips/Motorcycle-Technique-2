# linelab — what's next

v1.0 is CLOSED (`linelab/README.md`). Everything below is post-v1.0. The design of
record is still `design/*.md` (D1–D46); nothing here overrides it.

---

## NEXT — extend past Chapter 8

**Status: next up. Not started.**

Six `.scene` files exist (`figures/fig-08-0{1..6}.scene`), all Chapter 8 "Line
Selection". The engine is generic; the corpus is not. This step grows the corpus to
every other book figure the doctrine can *honestly* grade.

**The hard part is scoping, not authoring.** `design/01-scope-and-doctrine.md §"out of
scope"` already rules out most of the book:

| chapter | figures | verdict |
|---|---|---|
| 2 Steering | 2.1–2.9 | **partial** — `quick_steer` / `single_input` grade steering *outcome*; countersteer transients and any handlebar channel are Tier-3, excluded (D3) |
| 3 Suspension | 3.1–3.10 | out — Tier-3 dynamics |
| 5/6 Concentration, Attitude | — | out — no gaze model; `{na: "rider gaze behaviour not modelled"}` |
| **9 Throttle Control** | 9.1 | **in** — `throttle_rule` check already exists (crack → v_min ≤ apex → roll-on, no chop) |
| 10 Shifting | 10.1, 10.2 | out — no drivetrain model |
| **11 Braking** | 11.1 | **in** — `trail_brake_taper` check already exists |
| 12 Body Positioning | 12.1–12.11 | out — "no rider-body model; the book's body-position photographs have no linelab equivalent and none is attempted" |
| 13 Low-Speed Turns | 13.1 | out — below `v_valid_min_ms` (7.0 m/s); ≥170° sweep at r ≤ 15 m rejects `OUT_OF_SCOPE` |
| 17/18/19 Ergonomics, Aero, Gear | — | out |

That table is a *starting hypothesis derived from a skim, not an adjudication.* The
first phase of the work is to prove or overturn it against the design docs, then
author only what survives.

Likely honest yield: **Ch 9 + Ch 11 + possibly Ch 2's outcome-shaped figures**, plus a
second Chapter 8 tranche of prose-scale roads (which is what forces the deferred
diagram-mode compression, below). A small, defensible corpus beats a large fake one.

### The prompt to run it

Paste this into a fresh Claude Code session in this repo. It explicitly authorizes
workflows.

> Use a workflow. Extend the linelab figure corpus past Chapter 8, and iterate until
> every new figure is green.
>
> Read `ROADMAP.md` first, then `linelab/README.md` and `design/00-README.md`.
> `design/*.md` (D1–D46) is the design of record and it wins over your preference; on
> a genuine conflict, STOP and escalate rather than improvise.
>
> **Phase 1 — scope adjudication (fan out, one agent per candidate chapter).** For
> each of book chapters 2, 9, 10, 11, 12, 13 and the Section-5 figures, decide
> whether linelab can grade its figures *honestly* — meaning every claim the figure
> makes is one the engine actually computes, and anything it can't compute earns a
> typed `{na: reason}` or a placard, never a plausible fake
> (`design/01 §"The placard policy"`). Cite `design/01`'s out-of-scope list and the
> live rubric (`node linelab/dist/cli/main.js schema rubric`) by check id. Output per
> chapter: IN / PARTIAL / OUT, which check ids carry the figure, which claims are
> unmodelled, and the placard text those claims would need. Then have a second agent
> adversarially attack every IN and PARTIAL verdict — the failure mode here is
> authoring a figure that *looks* right and teaches something the engine never
> computed. Kill any verdict that survives on optimism. Write the surviving set to
> `figures/SCOPE.md`.
>
> **Phase 2 — author.** One agent per surviving figure. Read that figure's book text
> (`book_text/parts/`) and image (`book_images/by-figure/`), then write a `.scene`
> in `figures/` following the six Chapter 8 scenes exactly as the model for form.
> Each scene declares an ideal line plus the named mistake the book is actually
> teaching against. Do not invent mistake kinds — the vocabulary is closed
> (`schema mistakes`); if the figure needs one that doesn't exist, that is a design
> question, so STOP and record it rather than inventing.
>
> **Phase 3 — bake and iterate until green.** Extend `out/chapter-08/bake.sh` into a
> per-chapter bake (or generalize it — your call, keep it derived from its own
> location, no absolute paths, no `/tmp` state). Bake, judge, read the failure, fix
> the *scene*, re-bake. Loop until every new figure either exits 0 or exits 3 for a
> declared-and-documented reason the way fig-08-05/06 do. A bake that exits 3 with no
> written justification is a red, not a pass. Then re-bake **twice** and confirm
> byte-identical output; determinism is a hard gate (D1).
>
> **Never change engine code to make a figure pass.** If a figure can only pass with
> an engine change, that is a design amendment: stop, write it up in
> `linelab/DEVIATIONS.md` with the design section it deviates from, and leave the
> figure open. Also confirm the six Chapter 8 figures still re-bake byte-identical at
> the end — they are the regression baseline.
>
> **Phase 4 — publish.** Rebuild the gallery to cover the new chapters, update
> `linelab/README.md`'s figure table and `figures/SCOPE.md`. Report what you left out
> and why, explicitly. Commit per phase.

---

## Backlog

### 1. Author real roads (prose-scale geometry)
Everything committed is book-preset geometry. Roads authored at prose scale are the
stated trigger for the deferred diagram-mode projection (`design/00 L620`) — this
item and the next are the same item approached from two ends.

### 2. The four deferred design-letter items
From `linelab/DEVIATIONS.md`:
- **diagram-mode compression** + its disclosure note (design unchanged in `06`)
- **POV red deficit band** and **POV ghost paths** — both need `stateAt.derived` wiring
- **static CLI POV `--at` / `--every`** frame selection — the design's own "future
  rasterizer seam" (`07 §5.5`); per-station POV is delivered in the viewer today

### 3. A non-terminal front door
The gallery is static HTML. There is no way to type a corner and see it graded
without a shell. `serve` exists (pure viewer session, no socket) — the missing piece
is a thin UI over it.

### 4. D45 — the continuation envelope
**Designed in full, deliberately not built.** See the explainer below. Build is
authorized *only* by the gate `S-CONT-SEPARATION-v2` (`design/09 §3.4a`) — an
arithmetic spike that must pass before any code is written. D46 confirmed the
deferral stands. Promotion lands in two tranches (report-only, then rendering), each
with its own pre-written gate list in `09 §3.4a`.

### 5. Open items
- 4 `it.todo` — the `adj-doubleapex` two-touch seams (`design/04 §4.6`)
- 2 fixtures still OPEN from the amendment pass

---

## What D45 actually is

Parks' blind-corner argument in Chapter 8 is about **not knowing yet**: *"When
entering a blind turn on the street, there is always the possibility that the turn
will tighten up."*

linelab already computes exactly where knowing stops — `s_limit`, the limit point cast
from the rider's own eye (D4). **D45 asks what lies past that station.**

The mechanism: take the road the rider has actually seen, truncate it at their own
`s_limit`, and graft on a set of hypothetical tails — roads that are byte-identical up
to the limit point and then curve away inside a declared curvature envelope
(|κ| ≤ 1/7 m⁻¹, budgeted in *swept angle*, max 150°). That's the "fan" you'd see
drawn past the limit point. On each hypothetical tail, run a canned escape rider
(`brake_reserve_escape`) and ask: from this station, at this speed, could they have
made it?

**Four disciplines make it honest, and they're the whole point of the decision:**

1. **It is never "every road consistent with the evidence."** It is always "the
   declared probe set of *this pack*" — a committed data file, named in the verdict
   prose, the legend, the placard, the POV chip, and `explain`. It's a chosen set of
   guesses, and it says so everywhere it appears.
2. **It is refutation-only.** There is no affirmative field anywhere — no
   `justified_through_s`, no `robust_feasible`, no survivability score, *forever*. It
   can only ever say "this rider, on this tail, from this station, did not get away
   with it." Members that survive are **"not refuted under this pack"** — never
   "safe," never "survivable."
3. **It is never a check.** It's evidence, out of the hash permanently, off by
   default, and absent from every committed book scene. It cannot change a grade.
4. **The disclosure that costs it its best sentence:** on a *fully* blind corner the
   fan is just the declared ladder drawn in full — the consistency filter discards
   nothing, because a road that tightens into a shadow is invisible by definition.
   Which is Parks' entire argument. So the picture there is a rendering of a tuning
   constant, and the design says so on the record instead of in a footnote.

**Why it's deferred:** the feature's most attractive output — a fan of possible
futures past the limit point — is also its most misreadable. A student sees five
hypothetical roads and reads "here is the space of what could happen." It isn't; it's
five guesses someone typed into a JSON file. The gate `S-CONT-SEPARATION-v2` exists to
prove the members are arithmetically distinguishable from one another before anyone
gets to draw them. Until that spike passes, `commitment` rejects with
`SCHEMA` + `deferred: "continuation envelope (D45)"`.
