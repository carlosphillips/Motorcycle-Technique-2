# linelab — what's next

v1.0 is CLOSED (`linelab/README.md`). Everything below is post-v1.0. The design of
record is still `design/*.md` (D1–D46); nothing here overrides it.

---

## CLOSED — extend past Chapter 8

**Status: done, 2026-07-27. The answer is no, and the heading was the wrong question.**
Full record: **`figures/SCOPE.md`**. Deviations found on the way:
`linelab/DEVIATIONS.md` § "Post-v1.0 — corpus-extension pass".

**Chapter 8 is the only chapter in the book that contains lines.** *Total Control* has
exactly six line-choice diagrams — figs 8.1–8.6 — and all six are built, shipped, green
and re-baking byte-identical. Chapter 8's prose references those six and no others; no
other chapter contains a line-selection diagram. So the printed line-selection corpus
was already complete at v1.0, which is precisely what `design/01 §2` G7 asks for. There
was never a seventh line diagram to reach, and "extend past Chapter 8" implied
otherwise.

What this pass actually settled is the weaker question the heading smuggled in: is
there anything **outside** line selection that linelab can grade honestly? No.
**81 figures adjudicated, 0 survive**; every extracted image is reconciled (87 = 6
shipped + 81 adjudicated). None of the 81 is a line diagram — they are 39 photographs,
24 suspension/chassis-setup diagrams, tyre physics, a shifting sequence and a throttle
timing chart. The nearest misses are the nine Chapter 15 plan-views (§2 bucket I):
fig 15.16 draws an "intended path of travel" against an "actual path of travel", which
looks like a line diagram, but the deviation's cause is a machine fault and the
intended path is an **authored** ideal — G1 forbids drawing a path nobody rode.

Three rows of the starting-hypothesis table are overturned:

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

### What blocked the three honest artifacts — and what has since changed

The pass found three artifacts that were honest but unauthorized, and stopped on two
STOPs rather than authoring them.

- **S12 — may linelab author non-parity *doctrine* figures at all?**
  **Since GRANTED**, scoped to Chapter 8 doctrine — see the NEXT section below. At the
  time of the pass the remit read "every other book *figure*", so none was authorized.
- **S15 — nothing renders a placard, so a doctrine figure cannot disclaim parity.**
  **Still open, and now the single gating item.** Verified: the scene `note:` survives
  into `meta.caption` in the envelope but reaches neither the SVG nor the manifest, and
  no committed SVG carries placard ink — while design/06 §11 lists figure-level placard
  boxes and the honest-limitation placards (01 §8) as required margin chrome.

Neither may be worked around by changing engine code to make a figure pass.

### What did not need doing

Phase 3's "generalize `bake.sh` into a per-chapter bake" was **not** done, because no
second chapter exists to bake. Generalizing a working script against a hypothetical
caller is speculative work; the note stays here so the decision is visible rather than
silently skipped. The determinism gate *was* run: two consecutive full Chapter 8 bakes
moved zero tracked artefacts.

### Also worth fixing (found by the corpus pass)

- **`check` doesn't apply the out-of-scope validation** that `figure`/`run` apply, so
  the lint green-lights a super-tight road the bake then refuses. Wrong direction for
  G4. Untested today.
- **`out_in_out` is unbounded above in `exit_f`** — it scores `pass` with
  `exit_f = 1.148` on shipped `fig-08-01` ink, i.e. "exit wide" is satisfied by
  exiting into the oncoming lane. Nothing visible moves, which is why it survived.

Both are written up in `linelab/DEVIATIONS.md` § "Post-v1.0 — corpus-extension pass".

---

## NEXT — a figure for every Chapter 8 doctrine surface, printed or not

**Status: the goal, decided 2026-07-27. Not started.**

The book stops at six line diagrams; linelab's *doctrine* does not. Chapter 8 teaches
blind corners, hairpins and half the mistake catalogue in prose that carries no figure
at all — and `bookBlind` and `bookHairpin` are shipped presets that no scene uses. **The
target is a figure for every Chapter 8 doctrine surface the engine actually computes,
whether or not Parks printed a diagram of it.**

This **grants S12**, which the corpus pass had to leave open: linelab may author
non-parity *doctrine* figures. The grant is scoped — Chapter 8 doctrine only — and
carries one condition, because the reason S12 was open was never bureaucratic:

> **S15 is a hard prerequisite.** A doctrine figure must say, inside the artifact, that
> it illustrates prose rather than reproducing a printed diagram. Today the caption
> reaches `meta.caption` and stops — it is in neither the SVG nor the manifest, and no
> committed figure carries placard ink, though design/06 §11 lists figure-level placard
> boxes as required margin chrome. Land S15 first. A doctrine figure that cannot
> disclaim parity is exactly the "plausible fake" design/01 §8 refuses.

### Coverage today: 20 of 47

Derived twice independently — once from the doctrine text, once from the baked
envelopes — and reconciled: **47 distinct Chapter 8 doctrine surfaces, 20 covered by the
six figures, 27 uncovered.** The corpus is strong on cornering *geometry* (checks 1, 2,
3, 4, 9, 13, 14) and on four of eight mistake kinds. It is **completely dark** on:

- **all of §6 visibility doctrine** — `hold_wide_for_sight` is `na` on 22 of 22 rows;
  no committed line has ever ridden a blind corner, and `blind:false` everywhere
- **both misjudgment kinds** (`underread`, `overread`) and `premature_contained`, `chop`
- **almost every `warn` band** — exactly one of the sixteen checks ever warns
  (`throttle_rule`'s roll-on leg, 7 rows on figs 8.5/8.6, and only as unlabelled chain
  collateral). The warn bands of `quick_steer`, `lean_ceiling`, `stop_within_sight`,
  `trail_brake_taper` and `wrong_strategy_for_corner` are all unwitnessed
- **the sole critical check's fail arm** — `wrong_strategy_for_corner` is 20 `na` /
  2 `pass` / **0 `fail`**, so fig 8.4's stated reason for existing (design/01 §5: a
  double-apex *strategy* line that fails check 16) is not what the shipped scene draws;
  it draws `overspeed` instead, per `adj-fig84`

This is not a new discovery so much as a quantification of one: `A-CATALOGUE-EXERCISED`
(design/09 §4) is already recorded `needs-decision` in `DEVIATIONS.md` for exactly this
— *"cannot pass over the committed corpus"*. **Authoring these figures is that item's
resolution path**, which makes the goal worth more than corpus size: it turns a test
that cannot currently pass into one that can.

### The candidate list, with what already blocks each

Ordered by value-per-obstacle. Several were already attempted in the corpus pass and hit
real problems — those are carried forward here so nobody re-derives them. Full detail in
`figures/SCOPE.md` §3–§4.

| # | figure | carrier | known obstacle |
|---|---|---|---|
| 1 | `chop` on `book90` — the throttle chop | `throttle_rule` leg (d) | **None on merit.** Killed only on S12 governance, which this section grants. Admit with `chop:slew_mss=20` (cuts the S26 `rideability` excess 102.95 → 7.36 °/s). Needs S15. Baked scene text already in `SCOPE.md` §3. |
| 2 | `overread` — the timid line | `out_in_out` exit leg | De-claim the labels: the drafted `exit@timid` asserted "no drive" when `throttle_rule` passes and `a_long` is identical to the ideal's. Needs S15. |
| 3 | check 16 fail — double-apex strategy on a DR corner | `wrong_strategy_for_corner` | **S28**: §5 wants two *full solved strategies* (`role=alternative`, `accept=best_failing`), and the scene grammar exposes only `ride`/`mistake`. Needs FigureSpec JSON as a corpus convention. `fx-wrong-strategy-dr.json` already produces the fail. |
| 4 | hairpin at road speed | `late_apex`, `out_in_out` | Redundant as drafted — same bar 50 as `book90`, `lean_ceiling` structurally pinned to pass. Needs a teaching that `book90` doesn't already carry. |
| 5 | blind corner — hold wide | `hold_wide_for_sight`, `lean_ceiling` | **Hardest.** `fig-08-D1` was killed by both lenses: the carrying check has no visibility content (the 31.45°/35.66° split is `atan(v²/gr)` from radius alone), the split is a 0.66° knife-edge across 27 cm of lane, and check 11's *pass* arm is **engine-unattainable** — S16 shows `release(c)` at 25.0–27.5 m against a feasible turn-in band of 11.0–18.0 m; the intervals never intersect. Also S22, S23(ii). Do not re-bake `fig-08-D1` blind. |
| 6 | `lean_ceiling` / `traction_ceiling` fail bands | checks 7, 8 | **S27**, the most reusable finding of the pass: the solver clamps commanded lean at `phiReserve`, so a solved line *cannot* warn on check 8. Reachable only at `mu 0.4`, and the scene grammar has no `mu` vocabulary. |
| 7 | increasing radius (`late_apex` → `na`) | none | **Nothing can host it.** Every preset is a constant arc or the one closing taper. Needs a new preset (`L 9>16 ^130`) — an amendment to design/03 §3.1. |

**The rule that governs all of them**, adopted from S27 and design/01 §A.2: *a check may
not be named as a figure's carrier until it has been shown capable of a non-`pass`
verdict on that road.* A check that grades `na`, or passes on every line drawn, teaches
nothing — and a visibility assertion on a non-blind corner does not fail, it passes
vacuously, which is worse.

Start at 1 and 2. They are blocked on nothing but S15.

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
