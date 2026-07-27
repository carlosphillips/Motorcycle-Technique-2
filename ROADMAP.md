# linelab — what's next

v1.0 is CLOSED (`linelab/README.md`). Everything below is post-v1.0. The design of
record is still `design/*.md` (D1–D46); nothing here overrides it.

---

## CLOSED — extend past Chapter 8

**Status: done, 2026-07-27. The answer is no, and that is the deliverable.**
Full record: **`figures/SCOPE.md`**. Deviations found on the way:
`linelab/DEVIATIONS.md` § "Post-v1.0 — corpus-extension pass".

The corpus does not grow. **81 book figures adjudicated, 0 survive**; every extracted
image is reconciled (87 = 6 shipped + 81 adjudicated). The starting-hypothesis table
that used to live here was a skim, and three of its rows are overturned:

| chapter | was | is | why |
|---|---|---|---|
| **9 Throttle** | in | **OUT** | fig 9.1 plots brake and throttle as two overlapping 0–100 % channels. linelab has one *signed* `cmd_a` (brake < 0, drive > 0), so the caption's "notice how the throttle is applied before the brakes are released" is structurally unrepresentable. Worse, the exit anticorrelation is **contradicted**, not merely unmodelled: the solved roll-on is a flat 2.2 m/s² held through the entire lean unwind. |
| **11 Braking** | in | **OUT** | conflated a check with a figure. `trail_brake_taper` existing is not the claim that fig 11.1 is reproducible — 11.1 is a body-position photograph, which design/01 §8 refuses by name. |
| **2 Steering** | partial | **OUT** (all nine) | every callout on 2.9 is a handlebar claim (D3). The one Ch 2 sentence linelab models has no figure attached, and `quick_steer`/`single_input` are already carried by figs 8.2 and 8.3. |

Two rows the table was silent on also resolve OUT: Ch 15 (24 figures) and Ch 1 + Ch 4
(9 figures).

**The expected "second Chapter 8 tranche" was scoped too, and also failed** — but on
merit, not on scope. `bookBlind` and `bookHairpin` are shipped presets used by no
committed figure, and four shipped mistake kinds (`premature_contained`, `chop`,
`underread`, `overread`) have never been drawn. Each was authored, baked and attacked:

- **hairpin** — self-refused as redundant: `late_apex` uses the same bar 50 as `book90`,
  `lean_ceiling` is structurally pinned to pass, and every mistake kind's fail set is a
  subset of a shipped figure's.
- **blind corner** (`bookBlind`) — killed by both lenses. Its sole carrying check
  (`lean_ceiling`) has *no visibility content*: both lines peak at 34.00 km/h, so
  `atan(v²/gr)` reproduces 31.45°/35.66° from radius alone, and the pass/warn split is a
  0.66° knife-edge on a TUNING constant across ~27 cm of lane. The line that "held wide"
  fails `hold_wide_for_sight` itself.
- **`chop` / `overread` / `premature_contained` / `underread`** — `chop` and `overread`
  carry a real check differential and are the closest things to honest artifacts this
  pass found; both died on disclosure, not physics (see S12/S15 below).
  `premature_contained`'s design-pinned check is vacuous; `underread`'s fail set is
  byte-identical to fig 8.4's committed red line.

**A steelman pass changed nothing.** Because the adjudicators were told to "prefer OUT
when torn", a defence was run afterwards on the three closest refusals. It moved 0
verdicts: 2.9 conceded on its own analysis, 9.1 conceded parity outright, and 11.TB
stayed OUT while usefully refuting two of its own four grounds.

### What actually blocks the three honest artifacts

Two STOPs, in order. Both are decisions, not bugs, and neither may be worked around by
changing engine code to make a figure pass.

- **S12 — may linelab author non-parity *doctrine* figures at all?** Three independent
  routes converged on the same honest-but-unauthorized artifact: a figure that
  illustrates Chapter 8/9 prose rather than reproducing a printed diagram. Under the
  current remit ("every other book *figure*"), none is authorized.
- **S15 — nothing renders a placard, so a doctrine figure cannot disclaim parity.**
  Verified: the scene `note:` survives into `meta.caption` in the envelope but reaches
  neither the SVG nor the manifest, and no committed SVG carries placard ink — while
  design/06 §11 lists figure-level placard boxes and the honest-limitation placards
  (01 §8) as required margin chrome. **S15 must land before S12 can be answered yes**,
  or the disclaimer lives somewhere the reader of the figure never looks.

The queue if both are granted, in priority order: (1) `good`-vs-`chop` on `book90` →
`fig-08-07`; (2) `fig-11-TB` retitled to the stand-up ceiling; (3) `overread` with
de-claimed labels. `fig-08-07` is deliberately left unclaimed. Full scene text for all
three is preserved in `figures/SCOPE.md` §3 so it need not be re-derived.

### What did not need doing

Phase 3's "generalize `bake.sh` into a per-chapter bake" was **not** done, because no
second chapter exists to bake. Generalizing a working script against a hypothetical
caller is speculative work; the note stays here so the decision is visible rather than
silently skipped. The determinism gate *was* run: two consecutive full Chapter 8 bakes
moved zero tracked artefacts.

### NEXT — decide S12, after landing S15

There is no authoring work to pick up until two decisions are made, in this order.
Both are recorded in full in `figures/SCOPE.md` §4.

**1. Land S15 — give a figure somewhere to state a limitation.** The caption already
survives lowering (`meta.caption`); it simply never reaches the SVG or the manifest,
and no committed figure carries placard ink. design/06 §11 already specifies the
surface (figure-level placard boxes + the 01 §8 honest-limitation placards) — this is
an implementation gap, not a design question. It is also the cheapest item on this
page and it unblocks the next one.

**2. Then decide S12 — may linelab author non-parity doctrine figures?** This one is
the design owner's call and nobody else's, because it changes what the corpus *is*.
If yes, three artifacts are ready to author (scene text preserved in `SCOPE.md` §3)
and each must carry an S15 placard disclaiming book-figure parity. If no, the corpus
is closed at six and this page's figure work is finished permanently.

Do not answer S12 by authoring a figure and seeing whether it looks convincing. That
is the exact failure mode the whole adjudication was built to catch.

### Also worth fixing (found by the corpus pass, independent of S12)

- **`check` doesn't apply the out-of-scope validation** that `figure`/`run` apply, so
  the lint green-lights a super-tight road the bake then refuses. Wrong direction for
  G4. Untested today.
- **`out_in_out` is unbounded above in `exit_f`** — it scores `pass` with
  `exit_f = 1.148` on shipped `fig-08-01` ink, i.e. "exit wide" is satisfied by
  exiting into the oncoming lane. Nothing visible moves, which is why it survived.

Both are written up in `linelab/DEVIATIONS.md` § "Post-v1.0 — corpus-extension pass".

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
