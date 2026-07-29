# DEVIATIONS.md — v0.1 → v1.0 ratification queue

**Project status: v1.0 CLOSED (2026-07-24).** All three phases shipped (v0.1 figure
spine, v0.2 inspection, v0.3 immersion); every gate green in two consecutive full runs
(50 files / 1357 pass / 0 fail / 4 documented `it.todo`); G1–G9 all hold. The v0.3
immersion-completion ratification is the **"v1.0 CLOSE" section immediately below** (read
it first — it supersedes any earlier "still deferred" note about `pov`/`--look`/`compare`).

This is the design owner's decision queue. It compiles every place the shipped engine
(`src/`) reads differently than the design-of-record letter (`design/00`–`09`), sourced
from: the two build-task transcripts
(package `ratification[]` blocks + adversarial `reviews[]`), five later
design-owner adjudications, `PENDING RATIFICATION` code comments still in
`src/`, and the six baked figures' visual-judge records
(`figures/*.judge.json`).

**Status vocabulary:**
- `adjudicated-fixed` — was a deviation; a design-owner adjudication resolved
  it and the fix is in; no longer deviates (kept here as a one-line record).
- `implemented-invariant-first` — the code implements a coherent reading that
  the design text conflicts with; the *design text* is what needs to change,
  not the code. Low-risk amendments.
- `pinned-engine-truth` — a measured fact about this physics/solver tuning
  (a speed, an outcome class) that the design letter got wrong; recorded in
  goldens as truth, not asserted against the letter.
- `needs-decision` — no single reading resolves it; the design owner has to
  pick a direction (retune a constant, reshape a fixture, amend a formula,
  or accept the engine's own answer). Adjudicated items that came back
  "confirmed-pin" also land here — the adjudication established *that* a
  design decision is required, not *what* it is.

Where an item cites a test file, that test is the executable tripwire: if the
engine ever stops producing the described behavior, that test goes red and
this entry is stale.

---

## Post-v1.0 — the S37 census (2026-07-29, ROADMAP work order 0b)

**`adjudicated-fixed` (decided 2026-07-29; the build is queued, not done) —
`design/06 §3.1` stage 10's candidate-position scoring pass was never built, and the design
owner has retired the sentence rather than ordering it built.** **D50** replaces it: a
callout is a small numbered **tag** on the diagram plus its sentence in a **callout column**
in the margin band, and **a tag may not sit on other ink** — an obstacle set of *all drawn
ink*, stricter than the retired sentence's two members and satisfiable because the placed
object is one glyph. Stage 10 is therefore a **build item**, not a deviation: until it
lands, `stageLabels` is superseded code rather than non-conformant code. Two docstrings
still cite the retired sentence — `src/render/topdown.ts:683-692` and
`src/render/labels.ts:7-12` — and were deliberately left alone, because the D50 build
rewrites both functions and a comment-only edit now would only muddy that diff. The
statement of the original deviation follows, kept because it is the evidence that made the
decision.

**(original) — `design/06 §3.1` stage 10's candidate-position scoring pass was never
built, and until this entry the deviation was recorded nowhere but a source docstring.**
The letter, inside a stage list whose heading calls the order *fixed*, says *"Label boxes
repel each other and the road ink by a simple candidate-position scoring pass, preferring
the aspect-floor padding (§2.4)."* Nothing answering to that exists.
`src/render/topdown.ts:683-692` says so itself — `stageLabels` is *"a deterministic
one-candidate stand-in for the candidate-scoring box-repel pass (§3.1 stage 10)"* — and the
whole layout is two booleans and one fixed diagonal step (`:699-702`) with **no overlap test
against anything**; `src/render/labels.ts:7-12` disclaims it from the other side, as
*"presentation-only and left to `topdown.ts`'s draw pass"*. Each file defers to the other.

*Measured on committed ink:* clipping every callout box against the stage-2 road-surface
polygon, **9 of 9 callouts overlap the road surface** — 1.0000 / 0.6435 (8-01), 1.0000 /
0.9967 (8-03), 0.5406 / 0.3733 (8-04), 1.0000 / 1.0000 / 0.4719 (8-05). On the letter's own
second obstacle member the engine is at 0 % compliance across every callout-bearing figure.
Box-vs-box is compliant only by accident: six pairs, zero overlaps, minimum clearance 9.02
callout-em.

*Why this is `needs-decision` and not a repair a run may land.* It sits in the
**normative + engine deviates** row, which would authorize a fix — but the letter does not
determine the fix. It names two obstacles and one preference and supplies no candidate set,
no score function or weights, no box geometry, no placement order or tie-break, no
all-candidates-overlap fallback, and **zero TUNING constants**, uniquely among `§3.1`'s
stages. And its one named destination is empty: `frame_aspect` is 0.8716 / 0.8716 / 0.8716 /
0.7720 / 0.7208 / 0.7367, all six inside `§6.1`'s `[0.55, 1.8]` band, so `§2.4`'s
aspect-floor padding exists on no committed figure. Conformance entails the boxes move; it
does not say where they land. Filed in full as `figures/SCOPE.md` §4 **S38**.

**Correction to the section below.** Its S37 paragraph says the letter *"says nothing about
stage-8b line chrome — the letter is silent"*. That reasoning is **wrong**, and the
correction was measured this pass: the buried `30 m` numeral's whole span, and the
anchored end of the callout that buries it, both lie **inside** the stage-2 road-surface
polygon (the callout box straddles the edge, 47–48 % of its area on the road), and
`design/06 §6.1` gives *"road ink"* its only defined referent as that polygon. So the
collision **is** reachable through the letter's own second obstacle member without any
extension to stage-8b chrome. S37 remains a STOP, on the stronger ground that there is no
pass to extend.

**`needs-decision` — a stage-9 marker glyph damages a stage-8b label, and no stage-10
obstacle set can ever reach it.** On `fig-08-06` the `exit` marker disc of the `good` line
(`cx=11.333929 cy=50.959021 r=0.219380`) is painted after the `90 m` ladder label and eats
the unit glyph's arch and stem; the numeral survives, the `m` is damaged and still legible.
`fig-08-06` carries **zero callouts**, so this is a different collision class from S37's,
found by pixels and invisible to any `<text>`-vs-`<text>` census. Recorded inside S37.

---

## Post-v1.0 — the judge loop is closed (2026-07-29, ROADMAP work order 0)

**Supersedes the section immediately below, which was written the day before and is kept
for its measurements.** The rasterizer exists, `fig-08-05` is re-judged on its output, and
the two reds are cleared without restamping anything.

**`adjudicated-fixed` — the rasterizer.** `design/09 §7` step 2 (*"a headless-browser
rasterizer"*) and `§9` L2360 (*"moves from cairosvg to a headless browser"*) both name the
mechanism, so *which rasterizer* was decided by the letter and not by taste — `resvg` and
`sharp` were excluded on precedence, not on merit. `linelab/tools/rasterize-figures.mjs`
drives **puppeteer 25.4.0** (a `devDependency`; `linelab/package.json` has no
`dependencies` key at all, and nothing under `src/` or `dist/` imports it) and its
version-pinned Chrome for Testing, `browser.version()` = `"Chrome/151.0.7922.47"`. All
arithmetic that can be done without a browser lives in `tools/raster-core.mjs` and is
covered by 54 pure tests in `test/tools/raster-core.test.ts`. The driver is invoked by hand
like `tools/restamp-figures.mjs`, **not** from `bake.sh`: Chrome's PNG encoder being
byte-stable is a property this repo had never measured, and hanging the determinism
ceremony on it would weaken that gate. It also takes figure ids as required arguments with
no default list, so a bare invocation cannot destroy the other five figures' judge evidence.

**`adjudicated-fixed` — "2× scale" is a scale, not a pixel width.** The first cut targeted
a fixed 2000 px. On this corpus that *is* 2× (every figure declares the 1000 px nominal
frame), but `src/render/fallback.ts` declares 400×120, which the fixed target would have
enlarged 5× and written out as `.2x.png` — a file name asserting a scale the file does not
have. `RASTER_SCALE = 2` is now the input and 2000 px is the pinned consequence. No pixel
moved: both `fig-08-05` rasters re-render byte-identical across the change.

**`needs-decision` — the committed rasters were never 2× rasters, and J8 was graded at 1×.**
Measured, not inferred: the committed `fig-08-05.2x.png` is a 2000×2774 canvas whose ink
stops at (999, 1386); the new one reaches (1999, 2773). The same holds for `fig-08-01`
(ink stops at 999×1146 of 2000×2294). So the prior, unreproducible step rendered at 1×
onto a 2× canvas, and rubric item J8 — *"lines distinguishable and text readable at the 2×
raster"* — was graded throughout the 2026-07-25 ceremony on an image at half the linear
size the rubric names. **This is a reservation about the old evidence, not a finding
against the other five SVGs**, which are unchanged; and a bigger raster cannot turn a
passing legibility item into a failing one, so it does not by itself invalidate them.
Only `fig-08-05`'s rasters were regenerated — replacing the other five would destroy the
evidence their still-valid records were judged on. *To decide:* whether the other five are
re-judged on true 2× rasters, which is a `§7.4` ceremony and was not in this work order's
scope.

**`needs-decision` — `fig-08-05` now records `verdict: "fail"`, and that is the honest
answer.** The re-judge found a real defect on committed ink: a callout completely swallows
the `30 m` direction-ladder label. Filed as `figures/SCOPE.md` §4 **S37**, as a STOP rather
than a repair, because `design/06 §3.1` stage 10's repulsion rule covers label boxes and
road ink and says nothing about stage-8b line chrome — the letter is silent, so the fix is
the owner's call. **(That reasoning is refuted — see the section above. The collision does
sit on road ink; S37 stays a STOP for a different reason.)** `T-JUDGE-RECORD` permits a failing record by design (*"failed criteria
are honest findings"*), so the suite is green with a failing figure on the record.

**`needs-decision` — two rubric items came back flaky, which `§9 §7.4` makes rubric defects
to tighten.** J5 split pass/pass/`na` — the rubric never says J5 applies to every figure
drawing a mistake-role line, so a pass may decline it without ground. J8 split
pass/fail/fail — the rubric does not say **at what magnification** "readable" is decided,
which is exactly the ambiguity the 1×-ink raster hid.

**`needs-decision` — `fig-08-05`'s scene says one mode and its manifest says another.**
`figures/fig-08-05.scene:26` authors `view: mode=diagram` and the envelope's
`meta.view.mode` carries that verbatim, while `bake.sh` renders `--mode true` and the
manifest declares `"mode": "true"`. A reader of `meta` alone is told the wrong mode. J6 is
`na` only because the manifest and the SVG's `data-mode` agree against `meta`.

**Correction to the section below:** its sentence *"no `sharp`, `resvg`, `puppeteer`,
`playwright` or chromium in `linelab/package.json` or on the box"* was true when written
and is now false.

---

## Post-v1.0 — the judge loop cannot be closed (2026-07-28, found landing work order 1)

**`needs-decision`, and it is why the suite is RED at this commit.** Work order 1 changed
what `fig-08-05` draws — by one glyph, correctly, to match `design/06 §3.1`. That made
`figures/fig-08-05.judge.json` a record of an image that no longer exists, so
`T-JUDGE-RECORD` and `test/hash/tripwire.test.ts` both fail with `expected 'e80e05' to be
'7e1dbd'`. **That red is the tripwire working, not a defect**, and it was left standing
deliberately: `tools/restamp-figures.mjs` would clear both by rewriting `svg_fnv1a` alone,
and its own header says that leaves the record *"structurally valid and semantically stale
on purpose"*. Restamping to go green is the move `design/01 §8` and the roadmap's own
guardrail forbid.

**The honest path is a re-judge, and it is blocked on a step the design specifies and the
repo does not contain.** `design/09 §7` step 2 calls for *"a headless-browser rasterizer
(replacing cairosvg — exported SVG is no longer constrained to cairosvg's feature
subset)"*. There is none: no `sharp`, `resvg`, `puppeteer`, `playwright` or chromium in
`linelab/package.json` or on the box, and `out/chapter-08/bake.sh` emits no PNGs. So
`linelab/figures/png/*.2x.png` and `*.grey.png` — the rasters the 2026-07-25 ceremony
judged and retained as evidence — **are outputs of a step nobody can re-run.**

Checked in the main loop rather than assumed. The pinned judge identity in
`verify/judge.json` is `claude-opus-5`, so the *judge* half is executable today. The
*raster* half is not: the only SVG rasterizer on this machine is macOS `qlmanage`, which
renders the ink faithfully (verified against committed `fig-08-01.2x.png` — same colours,
geometry, labels and chrome) but **force-crops to a square**, cutting off the turn point,
the entry-speed labels and the scale bar — precisely the ink that rubric items J2, J3 and
J8 grade. Judging a cropped raster and recording the verdict as a judgment of the figure
would fabricate a record, which is the one thing this repo must never do. It is also
macOS-only, so enshrining it would trade a portability guarantee for a green tick.

*Consequence, and it generalises well beyond this figure:* **any change to what a figure
draws now leaves the suite red until a rasterizer exists.** That makes the rasterizer a
prerequisite for the whole doctrine-figure programme, not a nicety. *To decide:* which
rasterizer, and whether the committed `png/` rasters stay evidence or become build
outputs. Filed as `SCOPE.md` §4 S36 and set as the top of `ROADMAP.md` `NEXT`.

---

## Post-v1.0 — S11 fix + the minimal-claim round (2026-07-28, ROADMAP "decide S31")

S31 is answered by experiment (`figures/SCOPE.md` §4 S31, §3 "the minimal-claim round"):
the disclosure bar is reachable on a **sentence** and not on a **figure**, because the
failure migrates to surfaces the placard channel cannot reach. Two more candidates
refused, eight reviews total. One engine defect **fixed**; three findings promoted, all
three sitting on committed ink.

- **[08 §3.1 / 01 §8] `check` did not apply the out-of-scope validation that `figure` and
  `run` apply.** **`adjudicated-fixed` 2026-07-28.** Was `needs-decision` in the
  corpus-extension section below; adjudicated a **defect, not a design question**, because
  both cited sentences are unambiguous — `design/01 §8` puts the super-tight regime
  *"rejected `OUT_OF_SCOPE` at validation"* and `design/08` specs `check` as validate-only,
  *"same code path as `figure --check`"*. **No design amendment was needed or made.**

  The divergence was not between two file extensions: the FigureSpec JSON spelling shared
  the weakness, since scene text lowers onto it (D30). It was between the *figure* door and
  the *scenario* door — `validateFigureSpec`/`lowerScene` are shape-level, and only
  `solve/run.ts`'s `composeWorld` ever composed the road, so the lint had no road build of
  its own. The figure-world validation is now **one declaration**, `validateFigureWorld` in
  `plan/validate.ts`, called by the bake (`composeWorld`) and by the lint
  (`lintFigureSpec` in `cli/verbs/shared.ts`, which `check` and `figure --check` now both
  call **and which is the only thing either of them calls**). The bake additionally needs
  the composed value; the lint needs only the verdict; neither owns a second copy of the
  rule. Since `validate()` composes internally, lint refusals are a strict subset of bake
  refusals by construction — the two cannot diverge again.

  Verified rather than asserted: three of the four new tests in `test/cli/schema.test.ts`
  were confirmed **red on a worktree build of `HEAD`** before the fix (`expected +0 to be
  2`), and the fourth is the guard rail — all six committed scenes still lint `valid` **at
  the `spec_hash` their baked manifests carry**, and pre-/post-fix bakes of all six produce
  byte-identical output trees at identical exit codes. The fix only ever refuses more.
  Suite 53 files / 1430 pass (+4) / 4 todo / 0 red.

- **[01 §A.3 check 2] `out_in_out`'s exit leg measures neither "wide" nor "at the exit".**
  **RECLASSIFIED 2026-07-28 → `pinned-engine-truth` on two of three claims; only the bar's
  value remains `needs-decision`.** The entry below was written from measurement without
  checking the letter, and the letter is explicit on both retracted halves: `§A.2` L504-507
  defines the exit sample as *"the sample at the RECORDED exit event"* with `W_c` (L497)
  ending at that event rather than at `s1`, so a station 7–9 m onto the following straight
  is **conformant**; and `f` = 1 sitting 0.4 m inside the physical edge is the bike margin
  per `§4.1` L126-127 / `§4.2` L149-151. `EPS_EXIT_DEG` living outside the pack is likewise
  mandated — `§A.6` requires a pack swap never to move samples, events, `outcome` or
  `spec_hash`. **Live remainder:** whether `OIO_OUTSIDE_MIN` = 0.55 (d = −1.885 m, 53.9% of
  lane width) is the right bar — a threshold in the normative appendix, so the owner's.
  Original text retained below; its numbers are right, its reading was not.
  *(i)* `f` measures across the **usable** corridor (`lane_width_m` 3.5 − 2 × `bike_margin_m`
  0.4 = 2.7 m), so `OIO_OUTSIDE_MIN` = 0.55 lands at **d = −1.885 m** — 13.5 cm past the
  midline of the rider's own lane (−1.75), 1.615 m short of its outer edge, **53.9% of lane
  width**. A line finishing mid-lane satisfies "exit wide". `f` = 1 is 0.4 m short of the
  physical edge, so no drawable line ever reaches the outside of the lane — the committed
  ideal lines exit at d = −2.69.
  *(ii)* The exit fraction is sampled **past the corner**: `exit.s` = 38.28 against corner
  `s1` = 30.85 on figs 8.1–8.3 (**+7.43 m**, on the following straight), +8.81 m on fig 8.4,
  while the mistake lines' exits are sampled *before* it (−3.38 to −14.24 m) because they
  terminate off-road — so the two fractions the check compares can be taken 20 m apart on
  one figure, and the ideal's 0.849 is earned largely on the straight. The station is fixed
  by `EPS_EXIT_DEG` = 1.0° in `core/constants.ts` (`"TUNING. Exit heading-capture
  deadband"`), consumed in `core/analyze.ts` — **outside `packs/parks-street.json`**, so
  S30's proposed remedy (a placard declaring the carrier's provenance) is structurally
  incapable of completeness. See `SCOPE.md` §4 S33.

- **[06 §3.1 stage 9 / 04 §7] The coincident-collapse drawn-position test is 1.0 m where
  the letter says one glyph radius — and it swallows a mistake line's apex on committed
  ink.** `needs-decision` → **authorized as a defect fix; the letter is normative and the
  engine deviates.** `design/06 §3.1` L404-406 requires collapse only when stations are
  within `MARK_COINCIDE_EPS_M` = 1.0 m **and** *"drawn positions overlap within one glyph
  radius"*. `render/markers.ts:110` applies `MARK_COINCIDE_EPS_M` to both tests, and the
  file's own docstring (L76-80) records the substitution: *"v0.1's stand-in for 'one glyph
  radius' — no px scale is threaded to this file by design; recorded as a deviation."*
  Measured and re-verified in the main loop on `out/chapter-08/fig-08-05`: the `early` line
  records apex events at s = 17.5 **and s = 25.0** and only one apex glyph is drawn — the
  s = 25.0 apex collapses into a `good` glyph whose centre is **0.987 m** away against a
  drawn ring radius of **0.2289 m** (4.3 radii, no overlap). The fix does not merge `good`'s
  own apexes at s = 24.5 / 25.5 either: 1.041 m apart, so they clear both the old and the
  new test. **Blast radius: `fig-08-05.svg` gains one apex glyph; no envelope, verdict,
  `result_hash` or `spec_hash` moves.** This is S34's exact complaint — a mistake line's
  recorded apex not drawn — produced by the tolerance rather than by the `auto` default.

  **CLOSED 2026-07-28 — fixed, not amended.** The deviation was not the radius but the
  PLACE: L404 opens "after projection", so the rule belongs to the renderer, and no number
  ever had to be threaded backwards (`pxScale` is born from `boundsOf(scene)`, which reads
  `scene.markers` — asking for it before markers exist is circular). `deriveMarkers` now
  returns the uncollapsed event set and `collapseCoincident(markers, glyphRadiusDrawn,
  rankOfLineId)` — same file, so ARCHITECTURE §6.6's module-map line still holds — runs at
  draw time in `topdown.ts`'s `stageMarkers`, against `pxScale * MARKER_R_PX`: the identical
  expression `markerGlyphSvg` draws with, so predicate and picture cannot drift. No design
  text moved, no constant was invented, and `MARK_COINCIDE_EPS_M` still owns the station
  test at 1.0 m. Measured delta on committed ink: **exactly one `<circle>` appended to
  fig-08-05's stage-9 group** (30 335 → 30 526 bytes, `svg_fnv1a` e80e05 → 7e1dbd); the
  other five figures re-bake byte-identical, and `figures/manifest.json` does not move.
  Two implementation locals recorded per ARCHITECTURE §6.6: "overlap within one glyph
  radius" is read as centre-to-centre ≤ r (the ≤ 2r reading is byte-identical on this
  corpus), and "one glyph radius" is the class's own drawn radius (collapse is intra-class).
  Two further defects fell out with it: the pair test now runs against the cluster SEED
  rather than `some(member)`, which was letting a marker in transitively and made membership
  depend on where the forward scan had reached; and collapse now runs AFTER the window crop,
  so an out-of-window marker can no longer seed a cluster and take in-window glyphs with it.
  **Still open: `figures/fig-08-05.judge.json` is stale** — its `verdicts` describe the
  previous image and its `svg_fnv1a` was deliberately left un-restamped, so `T-JUDGE-RECORD`
  and `test/hash/tripwire.test.ts` are RED on that figure until a vision re-judge lands.

- **[03 §8 / 04 §7] The per-line `marks=` (and `label=`) override is specified in two
  documents and implemented nowhere.** `needs-decision` → **authorized as a defect fix.**
  `design/03 §8` L1635 says the MarkSpec applies *"at figure and per-line"* scope, and
  `design/04 §7` L1904-1905 says *"at figure level, overridable per line with `marks=`"*,
  listing `marks=` and `label=` among the ride keys. `plan/scene.ts:287-290`'s `RIDE_KEYS`
  carries neither, so a scene writing `marks=all` on a ride line is rejected
  `SCHEMA`/`ride_unknown_key`, and `deriveMarkers(lines, markSpec)` threads a single
  figure-level spec. Moves no committed byte until a scene uses it. It is the surgical
  answer to S34: mark the mistake line's apex without also putting release chevrons and
  exit dots on every line, which a figure-level `marks: all` would.

  **CLOSED 2026-07-28 — implemented as written, no design text moved.** Both keys are now
  `RIDE_KEYS` (`plan/scene.ts`), lowered onto `FigureLine.marks?` / `FigureLine.label?`
  (`plan/types.ts`), accepted in the JSON spelling too (`plan/figure.ts` — D30: one
  identity, two spellings), and honoured where each one means something: `marks` by
  `deriveMarkers(lines, markSpec, lineMarks)`, whose third argument carries the per-line
  overrides keyed by `line_id` (built once by `plan/figure.ts`'s `lineMarksOf`, so the bake
  and the gate's mirror render cannot drift), with the figure-level spec as the fallback
  for every line that authored none; `label` by `solve/run.ts`'s `runFigure`, since
  `design/05 §7` types the per-line label as *"legend text"* and `design/06 §5.3`'s legend
  row draws it as `<name>` — and `relabel`'s own note records that `line_id`/`role`/`label`
  live outside every hash, so an authored label moves no `result_hash`. `auto` stays
  role-scoped at BOTH levels: a per-line `auto` on a mistake line marks nothing, exactly as
  the figure-level one does. Typed rejections reuse the figure-level vocabulary
  (`marks_class_unknown`, `marks_malformed`) and add two for the quoted-prose key
  (`label_needs_quotes`, `label_empty`) — D8: nothing is accepted and ignored, which is
  also why both keys now carry `verify/effectuality.json` witness rows (`scene:lines[].marks`
  → render, `scene:lines[].label` → envelope) and appear in the `schema` verb's printed
  input surface. **Both keys are OMITTED when unauthored, never defaulted** — the reason
  `design/03 §8` states verbatim for `placards`: `spec_hash` covers the lowered form (D30),
  so a defaulted key would move the identity of every figure that never asked for one.
  Measured: all six committed figures re-bake byte-identical and all six `spec_hash`
  stamps (57e436 / 1bc028 / 09875f / 30fcb5 / 37e73d / 40ae19) are unmoved.

- **[06 §3.1 stage 9] Auto `marks:` draws markers on the ideal line only, and the absence
  reads as a claim.** **PREMISE REFUTED 2026-07-28 → `pinned-engine-truth`.** The letter is
  not silent: `design/04 §7` L1903-1906 says *"`auto` (default) draws all classes on
  `ideal`-role lines only"*, which `render/markers.ts` implements exactly. And an author can
  already mark a mistake line in scene text alone — a figure-level `marks: all` or class
  list enables that class on every drawn line regardless of role, as figs 8.1, 8.3 and 8.5
  do on committed ink. The fig 8.2 case was a misattribution: both its lines record
  `turn_in` at s = 6.974 at the identical drawn point, so the documented coincident collapse
  fires and "ideal wins ties" — pinned green by `A-FIG82-SINGLEMARK` (`design/09 §5.4`).
  What survives is an **authoring** question (re-author figs 8.4/8.6 with explicit `marks:`,
  moving their `spec_hash`, versus amending the default, which moves SVG bytes and no hash).
  Also stale, and fixable without the owner: `markers.ts:29-30` names fig **8.5** among the
  figures authoring no `marks:`; `figures/fig-08-05.scene:21` authors
  `marks: turn_point,apex`. Original text retained below.

- **[01 §A.2] The exit sample is undefined for a line that leaves the road before the corner
  ends, and the engine's substitute is what produces S20's `exit_f` = 1.148.**
  `needs-decision` — a **letter gap**, not a deviation. `§A.2` L504-507 says the fallback for
  a terminated line with no exit event is *"corner end"*, but a line that departs before
  `s1` has no sample there. `plan/doctrine/metrics.ts:292` substitutes
  `Math.min(w.corner.s1, last.s)` — the off-road departure sample, which on committed ink
  sits at the outer usable edge, so every mistake line of figs 8.1–8.4 reports
  `exit_f = 1.148` and satisfies the exit leg. `§A.3` check 9 `exit_containment` **does**
  have a rule for the same event (*"If the line terminates off-road before the exit sample
  exists … fail citing the crossing station"*), so two checks read one termination and only
  one of them is specified. Answering this may retire S20 without touching the predicate.
  Filed as `SCOPE.md` §4 S35.

- **[01 §A.3 check 2, S30] The pack is correct; the implied remedy is forbidden.**
  `adjudicated-fixed` as a record correction. `design/01 §A.6` L961-963 forbids any
  threshold marked `TUNING` in the design of record from carrying a `book:` source in any
  pack, mechanized by `A-PACK-PROVENANCE` arm (c). The three `out_in_out` bars are `TUNING`
  in `§A.3` itself, so `packs/parks-street.json` is byte-correct and no engine or pack
  change is warranted. Only the figure-authoring half of S30 remains live.
  classes on ideal-role lines only when `marks:` is unauthored, so figs **8.4 and 8.6 carry
  no marker at all on their mistake lines** (fig 8.2's likewise, under an explicit
  `marks: turn_point`). A reader reads that as *"the mistake never apexed"*. On figs 8.2 and
  8.4 the inference is near enough true (`late_apex` fails at 2.7% and 1.4% of sweep); on
  **fig 8.6 it is false** — the unmarked red line **passes** `late_apex` at c1, *"apex at
  70.0% of sweep, past the 50% bar"*. On the refused `fig-08-D4` it was maximally false: the
  mistake line apexed later and deeper than the ideal (87.5% vs 66.3%) and passed the check.
  See `SCOPE.md` §4 S34.

- **[infra] The suite is flaky under worker-pool contention.** Not a design deviation;
  recorded because it will otherwise be misread as a regression. Two of four full `npm test`
  runs this session went red — 1 and 3 failures — always `Error: Test timed out in 5000ms`
  on CLI-spawning tests (`A-RECIPE-J` in `test/cli/recipes.test.ts`, `A-EXIT-DECLARED` in
  `test/cli/schema.test.ts`), always green in isolation and on re-run, and never touching
  the code under change. The S11 work reduced its own added CLI spawns from ~21 to 2 for
  this reason (2655 ms → 336 ms), calling the pure `checkVerb`/`figureVerb` in-process
  wherever the process boundary was not the point. The underlying tests are unchanged and
  still spawn. *To decide:* whether the 5 s per-test wall is right for tests that spawn a
  solve, or whether those tests should carry an explicit longer timeout.

---

## Post-v1.0 — S15 + doctrine-figure pass (2026-07-27, ROADMAP "a figure for every Chapter 8 doctrine surface")

S15 landed (see the `[06 §11 / 01 §8]` entry below, now `adjudicated-fixed`). Two
doctrine figures were then authored onto it, adversarially reviewed, repaired and
reviewed again; **both were refused**, and the refusals produced three findings about the
check catalogue that outlast them. Full narrative in `figures/SCOPE.md` §3–§4 (S29–S31).

- **[01 §A.3 check 2] `out_in_out` has two live legs, not four, on any first corner.**
  `needs-decision`, and it sits on shipped ink. `checks.ts` (~:321-345) requires
  `ti_f ≥ 0.55 ∧ apex_f ≤ 0.45 ∧ exit_f ≥ 0.55 ∧ max(ti_f, exit_f) − apex_f ≥ 0.40`.
  **`ti_f = 1` exactly on all twelve committed `c1` rows** (every line of all six
  figures), because `f = 1.0` is the solver's default start state and the plan grammar's
  only lateral action is `position`, which neither `ride` nor any `mistake` sugar emits —
  `ti_f < 1` occurs only at `c2`/`c3`/`c4`. And given `ti_f = 1` the swing leg reduces to
  `apex_f ≤ 0.60`, strictly weaker than the apex leg's own `apex_f ≤ 0.45`, so it can
  never bind. Verified by walking all six committed envelopes. Nothing in the corpus
  moves — figs 8.2 and 8.4 fail the *apex* leg, which is live — but a figure reciting
  "its other three legs pass" overstates its own precision ~3×. See `SCOPE.md` §4 S29.

- **[01 §A.3 check 2] `out_in_out`'s three bars are `TUNING`-sourced while its siblings
  are book-sourced.** `needs-decision`. `packs/parks-street.json` gives
  `OIO_OUTSIDE_MIN` 0.55, `OIO_INSIDE_MAX` 0.45 and `OIO_SWING_MIN` 0.4 each
  `"source": "TUNING"`, inside a pack whose `doctrine_source` is "Parks, *Total Control*,
  ch. 8-9" and whose `late_apex` bar carries a real `"source": "book:…"`. The check
  carries `book_ref "Total Control ch. 8"`, so the check is book-warranted while the
  number that decides it is not. See `SCOPE.md` §4 S30.

- **[record erratum, `figures/SCOPE.md` §4 S27] "three of `throttle_rule`'s four legs
  never appeared in `missed[]`" is false on committed ink.** `adjudicated-fixed` (the
  erratum is now recorded in SCOPE.md itself). `roll_on` appears in `missed[]` on **nine**
  committed rows — seven `warn`, two `fail` — across figs 8.5 and 8.6, including *both*
  ideal lines: `fig-08-05 good` c1/c2, `early` c1/c2; `fig-08-06 good` c1/c2/c3, `bad`
  c1/c2. The true claim is road-specific, not catalogue-wide. A doctrine figure drafted
  on the wider claim asserted it in rendered ink and was refused for it — which is the
  first time the placard channel has caught a false claim that scene comments used to
  hide, and is a point in S15's favour rather than against it.

---

## Post-v1.0 — corpus-extension pass (2026-07-27, ROADMAP "extend past Chapter 8")

This pass attempted to grow the figure corpus past Chapter 8. **It did not: 81 book
figures were adjudicated and 0 survive** (`figures/SCOPE.md` is the record, with a
28-entry STOP list). No engine code was changed and no figure moved — the six Chapter 8
bakes were re-run twice end to end and every tracked artefact is byte-identical, so the
regression baseline holds.

Three deviations were found *while* adjudicating, each verified by hand against the
shipped build rather than taken from an agent report. They are recorded here because the
ROADMAP's rule is that a figure blocked by an engine behaviour is a design amendment, not
a fix: none of these was worked around.

- **[08 §3.1 / 01 §8] `check` does not apply the out-of-scope validation that `figure`
  and `run` apply.** **`adjudicated-fixed` 2026-07-28 — see the S11 entry at the top of
  this file; the original observation is preserved below.** On the scene
  `road: lane 3.5 | S 10 | R 10 ^180 | S 12` (180° of sweep at r = 10 m — the §8
  super-tight regime), `check <scene>` returns `{"ok":true,"value":{"valid":true,
  "spec_hash":"7e6441"}}` and exits 0, while `figure` on that same scene and `run` on
  that same road both return `OUT_OF_SCOPE` / `super_tight_geometry` and exit 2. design/01
  §8 says such scenarios are *"rejected `OUT_OF_SCOPE` at validation"*, and design/08
  documents `check` as the verb that lints *"without solving"* — so the scope test belongs
  on the lint path, not only past it. The failure direction is the damaging one for G4
  (agent-first authoring): the lint green-lights a road the bake then refuses. No test
  pins this today.

- **[06 §11 / 01 §8] The figure caption reaches the data but never the ink, and no
  placard box is rendered on any committed figure.** **`adjudicated-fixed` 2026-07-27
  (commit `84f2320`) — the *placard* half. The *caption* half stands as designed.**
  Resolved by precedence rather than by a new decision: the "§11" this entry cites is
  draw-order **stage 11 of design/06 §3.1** (design/06 has no §11 — the doc ends at §8),
  and stage 11 already required figure-level placard boxes. The channel was specced and
  unbuilt, so building it was plumbing, not an amendment. What shipped: an opt-in
  top-level `placards:` scene key + FigureSpec JSON twin → an ordered frozen list on
  `DrawnScene` → wrapped neutral-ink `<text>` boxes drawn at stage 11 in the **viewBox
  margin** (never `scene.frame`, so `gateProportions` is untouched) → a `placards` array
  on the manifest record. Four minimal amendments to the letter: `design/03 §8` (the
  `Figure` wire shape), `04 §7` (the scene grammar's key list), `06 §3.1` stage 11
  (author-supplied placard text is a new category — every other placard the letter names
  is a design-owned verbatim string), `06 §7` (the manifest record). `note:` semantics are
  **unchanged** and deliberately so: it remains a caption reaching `meta.caption` only,
  because all six committed scenes carry one and routing it to ink would have moved all
  six SVGs. Omit-when-absent (never `placards: []`) keeps the six `spec_hash` stamps at
  rest; verified by fresh bakes of all six against committed bytes, and by two
  consecutive `bake:ch8` runs moving zero tracked artefacts. Wrapping is a pure
  character-count rule reusing `render/controls.ts`'s own 0.58 ratio — design/06 §3
  forbids DOM and IO and §4 states there is no text metric in a pure string builder, so
  the estimate *is* the mechanism, and it errs by looking wrong rather than by lying.
  **Known knock-on, `needs-decision`:** `J6` is scored `na` on true-mode bakes because it
  is defined as the *diagram-mode* disclosure note; a true-mode placard re-opens J6's
  scoping, and any figure that opts in needs a re-judge. The scene `note:`
  survives lowering — `fig-08-01.envelope.json` carries
  `meta.caption: "Turn in too soon and the geometry points the exit wide …"` — but that
  string appears in neither `fig-08-01.svg` nor `fig-08-01.manifest.json`, and no
  committed SVG in `out/chapter-08/` or `figures/` contains placard ink. `labels:` and the
  legend do render, so this is specific to the caption/placard surface. design/06 §11
  lists *"figure-level placard boxes"* and the *"honest-limitation placards (01 §8)"*
  among the renderer's required margin chrome. **This is the pass's load-bearing
  blocker**, and it is why the STOP list's S12 could not simply be answered "yes": a
  doctrine figure that illustrates Chapter 8 prose rather than reproducing a printed
  diagram *must* disclaim parity inside the artefact, and there is currently nowhere in
  the SVG for that disclaimer to go — a reader of the SVG alone would never see it.

- **[01 §A.3 check 2] `out_in_out` is unbounded above in `exit_f`, so "exit wide" is
  satisfied by exiting off the road — and this already sits on committed ink.**
  `needs-decision`. **One of four `out_in_out` defects now recorded (S20 here, plus S29,
  S30 above and S33 at the top of this file); the ROADMAP calls for them to be adjudicated
  as one.** Check 2 passes iff
  `ti_f ≥ 0.55 ∧ apex_f ≤ 0.45 ∧ exit_f ≥ 0.55 ∧ swing ≥ 0.4`; nothing caps `exit_f`.
  On the shipped `fig-08-01` the `bad` line — the book's own premature-turn-point red
  line — records `out_in_out: pass` with `exit_f = 1.148` while its `outcome` is
  `runoff`: the exit is past the outer usable edge, in the oncoming lane, and the
  out-in-out check calls that shape met. §A.3's own commentary expects the opposite
  (*"until termination, a runoff line grades this check on the samples that exist and
  typically fails the exit leg"*). Nothing visible moves — the line is already
  `failing`/red by outcome and `exit_containment` fails separately — which is why it has
  gone unnoticed; but the check does not measure the claim it advertises.

Two further candidate findings were **not** promoted, deliberately:

- `premature_contained`'s missing `late_apex` fail is **already recorded** — it is
  `adj-corrective` / `SEAM-PC-LATE-APEX` (design/03 §7.1 row below), pinned by
  `test/oracle/oracle.test.ts`. Re-confirmed this pass (`late_apex` passes at 63.7 %,
  `out_in_out` and `rideability` fail instead) but it is not a new deviation.
- A reported `INTERNAL` from `mistake` beside `vis=cautious` **did not reproduce** on the
  shipped build; the scene bakes clean at exit 0. Recorded as unreproduced rather than
  filed.

---

## v1.0 CLOSE — immersion completion + ratification merge (2026-07-24, READ FIRST)

This pass completed v0.3 immersion and closed v1.0. The gate auditor + adversarial review
found the immersion code coherent on the merits but **incomplete at the CLI seam**
(`pov`/`--look` half-shipped). This pass finished the un-deferral, re-pinned four stale
phase tests, strengthened two weak gate clauses, and merged every ratification item below.
**No `src/` engine changed; no golden, `result_hash`, or baked figure moved** (verified:
`test/golden/**`, `test/hash/**`, `test/render/gate.test.ts` all green — v0.3 is a pure
consumer of the v0.1 engine). Full suite: **50 files / 1357 pass / 0 fail / 4 `it.todo`**,
run twice, deterministic; typecheck exit 0.

### Landed this pass (code — all `adjudicated-fixed`, no design conflict)

- **`pov`/`--look` un-deferral COMPLETED (the split-brain fix).** design/08 §3 line 83
  (`render … --views topdown,controls,pov`) and §4.1's View flag group (`--look
  <heading|limit_point>`, "all ViewSpec fields, 06 §2.1") already ship both in v0.3, so
  this is a pure implementation gap, not a design conflict. The whole `immersion (v0.3)`
  deferred row is **retired** (`compare`+`pov`+`--look` all shipped; the same phase-gating
  law that retired the empty `inspection (v0.2)` row: a phase with nothing left to defer
  prints nothing). `cli/verbs/controls.ts`'s pov guard is deleted — `controls` now composes
  `topdown`/`pov` through the one `render` verb, so the phase decision for `pov` lives in
  exactly one place (C-ONE-CORE-style single seam). Files: `cli/deferred.ts`,
  `cli/verbs/controls.ts`, `cli/verbs/render.ts`. Tripwires: `test/cli/compare.test.ts`
  (immersion row absent; `deferredFor("pov"|"--look")` undefined), `test/cli/schema.test.ts`
  (`DEFERRED_TABLE` length 4; roster includes `compare`).
- **`--look` shipped as the `view.look` ViewSpec field.** Un-deferred in `cli/args.ts`
  (dropped from `DEFERRED_FLAG_NAMES`) and added as a `FLAG_TABLE` row mirroring
  `--orient` (`field:"view.look"`, closed set `heading|limit_point`, group View); the
  `schema view` section grows a `look` field; two D8 effectuality witnesses added
  (`view:look`, `cli:--look`) in `verify/effectuality.json` + `test/effectuality/d8.test.ts`.
  `render/index.ts` already read `viewSpec.look`; `project.ts` already validated it. An
  unknown `--look` is a plain closed-set `SCHEMA`/`look_unknown` (never `deferred` — the
  token left the table when pov shipped). Tripwire: `test/cli/schema.test.ts` (`--look`
  renders pov; `chase` → SCHEMA, not deferred).
- **Four stale phase-pins re-pinned** to the shipped v0.3 phase: `test/cli/schema.test.ts`
  (roster+`compare`, table length 4), `test/cli/serve.test.ts` (recipe-c leg 3 → shipped
  `compare`: exit 0, one pair, two verdicts, `world_delta.differs:false`),
  `test/effectuality/d8.test.ts` (`--lock` sample-map entry), `test/render/ink.test.ts`
  (pov render target renders, not deferred).
- **Two weak gate clauses strengthened.** C-POV-LIMIT-CONSISTENT's render-layer "two views"
  clause now runs on the occluder-bearing `wallBlind` fixture so `project()` actually draws
  the topdown sight ray (it is `null` on an unoccluded road) — the `ray != null` +
  `ray.to == POV limit world == recorded (limit_x, limit_y)` equality now FIRES.
  C-POV-OCCLUDE's wall golden now asserts `f.limit.markerState === "clamped"` (verified at
  `s0+2`). Both in `test/render/pov.test.ts`.
- **`serve` now advertises the views it actually offers.** `cli/verbs/serve.ts`'s serve-plan
  metadata was a hand-kept `["topdown", "controls"]` while the viewer's `VIEWER_VIEWS` grew
  `pov` with immersion — a client reading the plan would miss `pov`. Fixed to source the ONE
  set (`views: [...VIEWER_VIEWS]`; `cli`→`viewer/types` is a same-rank import the DAG already
  permits, and `serve.ts` already imports `viewer/page.js`). Tripwire re-pinned:
  `test/cli/serve.test.ts` (serve offers `["topdown", "controls", "pov"]`).

### design/07 — Viewer & POV (immersion deviations recorded)

- **[07 §5.3 item 5 — red DEFICIT band]** *declared deviation, faithful subset.* The POV
  draws the white "what-you-can-see" sight tint from the recorded `Sample.sight_m`, but
  OMITS the red deficit band (`s + sight_m → derived.ssd_station_m`) the letter specifies
  when `ssd_m > sight_ride_m`. The Sample-only `renderPov` builder carries no
  `derived.ssd_station_m`; drawing the band needs `core/stateAt.derived` threaded into the
  pure builder — a future stateAt-wiring pass. No C-POV gate requires it; the HUD "▶
  deficit" text is present. **needs-decision** (wire `stateAt.derived.ssd_station_m` into
  the POV frame, or amend 07 §5.3 to the tint-only subset). `src/render/pov.ts`.
- **[07 §5.3 draw order — sight tint vs occluders]** *implemented-invariant-first.* The
  letter pins 4 occluders → 5 sight band. The code paints the 12%-opacity sight tint BEFORE
  the opaque occluder quads on purpose: a translucent tint painted OVER an opaque occluder
  would wash the occluder that must read as solid, contradicting the occlusion invariant
  the stage exists to show (occluders still paint over the road surface — C-POV-OCCLUDE's
  paint-order golden asserts stage 4 after stage 2). Amend 07 §5.3's order or ratify the
  tint-first realization. `src/render/pov.ts` `serialize()`.
- **[07 §5.5 static CLI POV frame selection — `--at`/`--every`]** *declared deviation
  (design-letter tension), needs-decision.* design/08 §3 line 83 lists `[--at <s> | --every
  <m>]` on the render verb ("pov renders frames at `--at`/`--every` stations"), but design/07
  §5.5 scopes the STATIC CLI POV as `frame(result, lineId, cursor, look)` and calls CLI
  frame-SEQUENCE export "a future rasterizer seam" (it pins no default cursor for the static
  target). The shipped `render --views pov` emits ONE default frame (focused line = highest
  role rank; cursor = nearest the first corner's `s_mid`, else mid sample — a recorded
  judgment call). Per-station POV is fully delivered TODAY in the interactive viewer
  (`serve` → step to any station → `pov` view). Not implemented as CLI flags this pass to
  respect 07 §5.5's future-seam scoping (avoid gold-plating a future rasterizer); recorded
  under design/08 too. **needs-decision**: implement `--at`/`--every` as render frame
  selectors, or amend 08 §3 to defer them to the rasterizer per 07 §5.5. (Also filed under
  design/08 below.)
- **[07 §5.2/§5.3 — POV presentation constants]** *implemented (ratified, ARCHITECTURE
  §6.6).* 07 §5.2/§5.3 fix the camera NUMBERS (fov 60, near 0.5, eye 1.4, look-max 70,
  inset frac 0.05) and occluder heights but not the canvas dimensions, glyph pixel sizes,
  lookahead, or neutral palette tones. Those are declared as LOCAL presentation constants
  in `render/constants.ts` (1000×600 canvas, 14 px chevron, 140 m lookahead, neutral
  sky/ground/road/occluder tones) without TUNING status, per ARCHITECTURE §6.6 (unnamed
  design literals get local names). Every design-owned number is imported verbatim; the
  path overlay's verdict colour is D9's `QUALITY_COLOUR`.
- **[07 §5.5 — static render target's `scene` fill]** *implemented (ratified).*
  `renderViews`'s shared return type is `{scene: DrawnScene; svg}`. For `target:"pov"` the
  `scene` is filled with the `project()` topdown scene purely to hold that contract without
  cascading an optional-scene type change into non-owned files; the pov SVG itself is
  project-free (`render/pov.ts` never imports `project.ts` — C-POV-TRUE-GEOMETRY's
  structural lint), and byte-identity is asserted on `.svg` (invariant to the `project()`
  scene). 07 §5.5 says "there is no DrawnScene in the POV pipeline" — true of the SVG; the
  `scene` is a contract placeholder, not consumed by the pov drawing.
- **[07 §4.2/§5.6 — POV ghost overlays]** *declared deviation (presentation gap).*
  Compare-mode ghosts are drawn on the TOP-DOWN (glyphs, reduced opacity, verdict colour
  retained — 07 §4.2, delivered via `viewer/compare.ts`). The POV view renders only the
  FOCUSED line's path: `render/pov.ts`'s `PovFrame` exposes a single path + one camera with
  no multi-line/ghost-path API, so POV ghost PATHS and time-lock ghost bike markers are not
  yet drawn. Needs a `render/pov.ts` ghost-lines extension. C-COMPARE state correctness is
  fully green (`test/viewer/compare.test.ts`); the gap is presentation-only.
- **[07 §5.2 — `look` closed set vs the viewer UI toggle]** *implemented (ratified).* The
  closed 2-value set `{heading, limit_point}` is enforced at every input boundary crossing
  into the POV: `parsePovLook` returns `SCHEMA`/`unknown_look` (NOT `deferred` — look ships
  in v0.3), and the CLI `--look` flag validates `heading|limit_point` (SCHEMA/`look_unknown`).
  The viewer's `setLook` transition soft-coerces an out-of-set value to a no-op (the toggle
  structurally cannot emit an invalid value), mirroring the v0.2 `setLock` pattern; the
  SCHEMA refusal still fires wherever an arbitrary string enters (CLI/scene/ViewSpec door,
  `renderView`).

### design/08 — CLI & Agent Interface (immersion)

- **[08 §3 line 83 — `--at`/`--every` static POV frames]** *needs-decision* — see the
  design/07 §5.5 entry above (design-letter tension 08 §3 ↔ 07 §5.5; the interactive viewer
  is the shipped per-station POV surface).
- **[08 §3.5 — `compare` recompute path]** *implemented (ratified, D6).* For envelope
  inputs, `compare.ts` recomputes each line by re-running its `resolved_scenario` through
  `run()` (A-RESOLVED-RERUN), NOT via the literal `export --as figure-spec` projection —
  that projection spells a figure road as `{dsl}` while a preset line spec spells `{preset}`
  (→ `run()` refuses `line_road_differs`) and drops non-DSL-expressible
  `bike_margin_m`/`use_full_width`. Re-running `resolved_scenario` is the SAME one engine,
  recomputes trajectory+verdict from the spec (never trusts shipped samples — D6's
  substance), and is robust to presets/non-default corridors. Verified end-to-end;
  C-COMPARE reproduces the same re-run byte-for-byte. Scene/scenario/FigureSpec/composed
  inputs `run()` directly.
- **[08 §3.5 — N>2 unpaired shape]** *implemented (ratified, extension flagged).* §3.5
  defines `unpaired` two-sided as `{a, b}` (the canonical two-input case). The impl supports
  N≥2 (road/world/pairing generalize; each pair discloses its full member set via
  `inputs:[…]`) but folds `unpaired` as a = line_ids only in input 0, b = line_ids unique to
  any later input. **needs-decision** if the design owner wants a fully N-way unpaired shape
  (a small extension; the letter only specifies the two-sided form).
- **[08 §5.2/§5.9 — `explain compare`]** *no change (correct as-is).* `explain compare` →
  `SCHEMA`/`explain_target_unknown` is CORRECT and UNCHANGED by shipping `compare`: `compare`
  is a VERB, and explain's disambiguation covers check ids / error codes / mistake kinds
  (§5.2) plus analysis tokens (§5.9) — a verb is not an explain vocabulary token, and §5.9
  mandates no `explain <verb>` placard. Not a deviation; flagged only because the review
  phrasing ("`explain compare` returns its real placard") is not achievable within the
  design contract.

### ARCHITECTURE / design/09 — infra

- **[ARCHITECTURE §1 — `vitest.config.ts` pinned shape]** *implemented-invariant-first,
  needs-decision.* §1 pins the config verbatim without a `globalSetup` key. The shipped
  config adds `globalSetup: ["./test/globalSetup.ts"]` (→ `ensureBuilt`) so `dist/` builds
  exactly once, single-threaded, before the worker pool — the structural cure for the
  in-`beforeAll` build race. The pinned `include`/`pool`/`isolate` keys are unchanged;
  `globalSetup` is purely additive. Verified: two consecutive full runs byte-identical
  green, zero empty-stdout reds. Recommend ARCHITECTURE §1's snippet grow the `globalSetup`
  key so the pin matches the shipped config.
- **[09 §8.1 — `view.look` / D8 exhaustiveness]** *implemented (ratified).* Shipping
  `--look` adds `view.look` to the printed schema and `cli:--look` to `FLAG_MAPPINGS`;
  `T-D8-EXHAUSTIVE`'s set-equality is kept by adding matching witness rows
  (`view:look`, `cli:--look`, both `effect_class:"render"`, `expect:"effect"`) to
  `verify/effectuality.json` with observation builders in `test/effectuality/d8.test.ts`
  (pov render under `look:heading` vs `limit_point` on the occluder fixture → distinct SVG).
  `--look` is NOT verb-scoped (a general ViewSpec composition flag like `--orient`);
  `--at`/`--every` were not added, so no new `VERB_SCOPED_FLAGS` rows beyond the v0.3
  `--lock`.

### Cross-references (unchanged, still open — surfaced again by compare)

- **[05 — `VerdictDelta.sight_margin_min_m` negative on clean lines]** compare only ECHOES
  `verdict.sight.margin_min_m`, the pre-carve-out clamped channel already flagged under
  design/05 below (`solve/verdict.ts`). The fix belongs to the `solve/verdict.ts` owner;
  compare is not the cause. **needs-decision** (unchanged from v0.2).

---

## Post-run — judge records committed + definitive v0.2 sweep (2026-07-24, read first)

This run committed fresh D36 §7.4 judge records for the three re-baked figures
(`fig-08-03/04/05`), ran the full suite ONCE, and produced the definitive v0.2
gate table (`V02-GATES.md`). **No `src/` changed and no golden/hash moved as a
result of this run's work.**

**Judge records (this run).** `figures/fig-08-03/04/05.judge.json` rewritten with
fresh `svg_fnv1a` (recomputed from the CURRENT SVGs via the shipped
`core/hash.ts` `fnv1a`, not reimplemented: 03=`e9dcd6`, 04=`08163c`, 05=`49fd70`),
`spec_hash` from `figures/manifest.json` (03=`09875f`, 04=`30fcb5`, 05=`2e21e4`,
each verified `== specHash(lowerScene(scene))`), and the pinned `verify/judge.json`
identity (`claude` / `claude-sonnet-5` / rubric `1`). **All six figures now grade
overall `pass`** and all six `T-JUDGE-RECORD` arms are GREEN. Flip table (majority
verdict changes vs the previous committed records — design/09 §7.4 enumeration):
- **fig-08-03**: J2 fail→pass, J3 fail→pass, overall fail→pass — the fifty_pence
  facet-ladder re-bake draws 6 hourglasses (was 10/11) and the apex@good leader no
  longer collides with a crossing red marker.
- **fig-08-04**: J5 fail→pass, overall fail→pass — `adj-fig84`'s
  `overspeed:by_kmh=2.5` makes `bad` diverge progressively wide through the
  tightening (was a ~475 px near-tangent stub).
- **fig-08-05**: J1 fail→pass, J2 fail→na, J3 fail→pass, J5 fail→pass, J6 fail→na,
  J8 fail→pass, overall fail→pass — the re-baked scene now DRAWS the `late` line
  (was road-only, all lines refused); J6→na is true-mode; J2→na is the split below.
- **fig-08-05 J2 is FLAKY** (non-unanimous three-way split `na / fail / pass`;
  majority `na` by the stable-sort tie-break the `T-JUDGE-RECORD` recompute uses).
  **RATIFICATION (rubric tightening):** J2 ("markers … per the marks setting … none
  floating") is underspecified for a line whose `.scene` declares NO `marks:` field
  — one judge read the empty `9-markers` stage as `na` (nothing requested), one as
  `fail` (a turn_point *should* exist per the marker-from-event law), one as `pass`
  (zero marks is correct for "ran off before reacting"). Propose: **J2 resolves `na`
  when the manifest/scene declares no `marks:` setting** (no marker obligation), and
  scores presence/floating only against a declared marks setting — closing the split.

**`run.ts` warm-cache stamp fix — LANDED (`C-RECOMPUTE-BUDGET` → GREEN).** The
warm-cache gap recorded below ("Still red after this run", and the v0.2-builder
ratification item) is FIXED in `src/solve/run.ts`: `runFigure` now honours a
mistake line's `solved` stamp on the warm path (reconstructs the compiled mistake
`source`, routes it through `classifySolvedCache` + `executeCachedPlan`,
double-guarded by `spec_hash` match AND replayed `outcome`/`result_hash ==
expected`). Measured: fig-08-06 `premature@all` warm → `bad.cache="hit"`,
`result_hash f5fbeb` / `spec_hash ef0884` byte-identical to cold; the warm
all-lines recompute meets the 300 ms budget and `test/cli/controls.test.ts` is
10/10 in the full suite. (Provenance-only note: the design-cleaner fix would
exclude the solver-output `applied_corners` from the hashed `source` so the raw
`MistakeSpec` reconstructs the cache key trivially, but that edit lives in
`solve/mistake.ts` and would move every mistake-sourced golden — a re-bless event,
flagged for the design owner.)

**`A-RECIPE-C` clauses 2/3 — NEW design-letter deviation (needs-decision).** The
two clauses design/09 L1435-1437 states ("min(sight_ride_m−ssd_m) strictly larger
on the governed line; governed entry speed lower") are asserted VERBATIM and
unweakened in `test/cli/serve.test.ts` and MEASURE A CONTRADICTION on the recipe's
own fixture: geom (ungoverned) approach-span min ≈ 18.84 m > vis (governed) ≈ 12.61
m, and geom corner-threshold speed ≈ 49.26 km/h < vis 60.00 — reproduced across the
ENTIRE feasible `--vis-margin` range (1.0–1.30). ROOT CAUSE: the same `adj-vis`
mechanism (design/02 §3.1 vs 04 §6 V2.5) — V1's speed governor never binds here;
the sight requirement is met entirely by V2's hold-wide lateral positioning, while
the ungoverned line independently brakes hard for its own tight-apex line, so both
directions invert. Held green via `it.fails` (the codebase's KNOWN_INERT idiom),
unweakened, so it reddens the day the engine satisfies the letter. **needs-decision**:
amend 09 L1435-1437 / 08 §6(c) to the V2-hold mechanism (as `adj-vis` already amended
04 §6 V2.5), OR reshape recipe (c)'s road/occluder so a margin regime exists where V1's
speed cap binds (like bookBlind's `A-SSD-GOVERNOR`). Consequence: `A-RECIPE-C` is
**AMBER** (passes on a documented deviation), not fully GREEN. Also filed under
design/09 below.

**UPDATE (2026-07-24, amend-design APPLIED — `adj-recipe-c`, following `adj-vis`).**
RESOLVED; `A-RECIPE-C` is now genuinely **GREEN**, not AMBER. The first branch was
taken: design/09's A-RECIPE-C bullet (§3.6) and design/08 §6(c)'s Expect prose are
restated to the ratified `adj-vis` HOLD-WIDE signature (the same amend-design move
`adj-vis` made on 04 §6 V2.5, and `adj-feasibility` made on 02 §8 / 08 §6 speeds),
and `test/cli/serve.test.ts`'s two stale `it.fails` clauses are rewritten as real,
green tripwires asserting THAT signature end-to-end through `serveVerb →
/payload.json → loadSession` (the D1 recompute path a browser takes). The
speed-governed clauses are gone; the `it.fails` wrappers are removed. Measured
signature (recipe (c)'s own fixture — road `lane 3.5 | S 30 | L 30 ^100 | S 30`,
occluder `hedge inside entry:c1 -25x30 margin=1.0`, both legs `--entry 60`, governed
leg `--vis cautious --vis-margin 1.2`, shared corner c1 `s0=30`/`s1=82.36`):
- **the wide commitment / hold event** — the governed line carries a vis-hold at c1
  (`target_f 0.9`, `achieved_f 0.888`, `budget_limited true`, `hold_release_s 30`);
  the ungoverned geometry-optimal line carries none (`verdict.sight.holds == []`).
  Tripwire: reddens if the governed line stops generating a hold.
- **holds wide vs. the tight-apex racing line** — over the shared corner span
  `[s0, s1]` the governed line's minimum ridden corridor fraction is `f = 0.817`
  (never leaves the outer band); the ungoverned line dives to a tight apex,
  min `f = 0.038` (apex pct 69.7). The 0.817-vs-0.038 separation is the hold-wide
  tripwire (asserted `visMinF > 0.5`, `geomMinF < 0.3`, `visMinF > geomMinF`).
- **corroborating (recorded, not asserted — why the letter's own two clauses
  inverted)**: the governed line enters at the authored 60.00 km/h with NO brake
  event (V1's cap never binds); the ungoverned line brakes `s ∈ [0, 16.76]` down to
  49.26 km/h for its tight-apex line. So the letter's raw approach
  `min(sight_ride_m − ssd_m)` (geom 18.84 m > vis 12.61 m) and corner-threshold speed
  (geom 49.26 < vis 60.00 km/h) both point OPPOSITE to the stale letter — a
  consequence of the hold-wide mechanism, exactly as `adj-vis` predicts. The two
  rewritten `it`s carry explicit 120 s per-test timeouts (each does two ~3.7 s
  serve+loadSession recomputes; the default 5 s times out under full-suite load).

**`fig-08-04` spec_hash arrow — CORRECTED.** The "Still red after this run" bullet
below (and `V02-GATES.md`) stated fig-08-04's `spec_hash` "moved (30fcb5 → 1a9dd5)".
That is BACKWARDS. Recomputed on this run's engine: the CURRENT scene (the adj-fig84
edit) → **`30fcb5`** (matches `manifest.json` + this run's re-committed judge record);
the pre-edit scene → **`1a9dd5`** (the stale value the old judge.json carried before I
rewrote it). The move is **`1a9dd5 → 30fcb5`**. Corrected in `V02-GATES.md`; the
in-place bullet below is annotated.

**Full-suite reality (this run): 4 failed / 1307 passed / 4 todo (1315); typecheck
exit 0; 171 s.** None is a v0.2-gate regression: 1 is the `A-RECIPE-C` clause-1
load-timeout flake (serve.test.ts:467 carries no explicit timeout; **24/24 in
isolation**), and 3 are `fig-08-05` v0.1 test-lag reds newly surfaced by the re-bake +
`adj-fig-08-05` amendment landing, all out of this task's file grant:
- `test/cli/scene.test.ts` fig-08-05 lowerScene pins the pre-amendment scene text
  (`correction@late` / "corrects late") → WP-13 owner re-pin to `run_wide_detect@late`
  / "ran off before reacting".
- `test/golden/scenes.test.ts` G-8.5-RED pins `late` as a refusal → golden owner
  re-pin to solved `runoff` (the design letter is already amended by `adj-fig-08-05`).
- `test/render/gate.test.ts` fig-08-05 PROPORTION pins the OLD road-only bake
  (straight_share 0.323 / road_ink 0.43 / frame_aspect 0.719) → WP-17 owner re-pin to
  the re-baked manifest (0.516 / 0.373 / 0.860). fig-08-05 byte-identity +
  T-JUDGE-RECORD both PASS; only the value pins are stale.

**Definitive v0.2 tally: 25 GREEN / 1 AMBER (`A-RECIPE-C`) / 0 RED.** No v0.2 exit
gate is RED; the v0.2 exit-gate SET is met on the merits. A single fully-green CI run
awaits the three out-of-grant test re-pins above + the one-line serve.test.ts timeout.

---

## Adjudicated — `adj-fig-08-05` fig-08-05 `late` seam (applied; re-baked + judged in the post-run above)

**Ruling: BOTH.** The DESIGN LETTER was wrong (G-8.5-RED's refusal skeleton,
the `correction@late` label, and §4a.3's unconditional "emitted iff attempted");
the IMPLEMENTATION is correct. The fig-08-05 `late` line resolves to **Option (2)
ACCEPT RUNOFF**: on `bookDoubleApex` no believed-road under-read at any entry
speed produces a visible correction — the hard outer edge forces
`departed_before_reaction` at every solvable point, so "corrects late" does not
survive the true physics. Status `adjudicated-fixed`. **No `src/` change was
required** — `corrective.ts`/`verdict.ts` already publish the correct block (see
below). This resolves the prior-run "Still red / needs-decision item 0" fig-8.5
conflict recorded further down this file.

**Alternative attempted (the adj-fig84 pattern — find a milder mistake that
teaches "corrects late" honestly), and why it fails.** The adjudicator swept the
believed-road under-read severity × entry speed × believed sweep angle
exhaustively on the true `bookDoubleApex` road (`lane 3.5 | S 10 | L 12 ^70 |
L 24 ^40 | L 12 ^70 | S 12`), seeking a `late` line that fires a `correction`
event and ideally grades `wide`:
- believed radius {12.5..24} at entry 30 / sweep 130 → EVERY case runoff /
  off_road / `departed_before_reaction`, NO correction event (even r=12.5, a bare
  under-read of the true R12, departs at off_road s=35.68);
- entry {14..30} at r∈{24,20,16} → entries <22 REFUSE `believed_world_not_clean`/
  `empty_band` (the believed single-R24 corner can't solve clean at low speed);
  entries ≥22 all runoff / `departed_before_reaction`, no correction;
- sweep {80..180} at r=16 e=22 → refuse or runoff/departed; never a correction.
  The mechanism is geometric and decisive: the outer runout strip is f 1.0→1.148
  (~0.6 m), crossed in **0.098–0.452 s**, while `t_react ≥ 0.7 s` (racer) — the
  reaction budget is short by **2.317×–10.249×** at every solvable point, so
  `departed_before_reaction` is forced and no shot ever launches; `f_max` never
  peaks-and-returns below the physical edge, so `wide` is unreachable. This is the
  same hard-outer-edge geometry that forced `adj-corrective` (book90, 0.4 m strip)
  and `adj-fig84` (knife-edge outer edge). Option (1) is physically impossible
  here; Option (2) ACCEPT RUNOFF is forced.

**Design/scene edits applied (anchor → arithmetic).**

| file | anchor | what changed | arithmetic / why |
|---|---|---|---|
| `figures/fig-08-05.scene` | header comment (the `late` teaching sentence) | "corrects late …" → "runs off before it can react … corrective infeasible, `departed_before_reaction`" | the engine departs the outer edge 0.098–0.452 s after run-wide while `t_react ≥ 0.7 s`; `late` never corrects |
| `figures/fig-08-05.scene` | `labels:` mistake-line label | `correction@late +8` → `run_wide_detect@late +8` | `correction@late` → `UNKNOWN_ID/anchor_no_match` (no correction event on `departed_before_reaction`, verified). `run_wide_detect` is a first-class label feature (design/03 §8 grammar, `FEATURE_EVENT`, `LABEL_FEATURES`); it resolves on the departed line (`late` fires `run_wide_detect` at s≈15.81, verified bake) |
| `figures/fig-08-05.scene` | `note:` line | "corrects too late" → "runs off before a reaction is possible" | match the engine truth |
| `design/04-solver-and-authoring.md` | §4a.3 `correction` event definition paragraph | carve the correction event out of the `departed_before_reaction` arm (`t_shot > t_terminated`, no on-line shot instant); state the block still publishes `{feasible:false, fail_reason:departed_before_reaction}` (§4a.6) and `run_wide_detect` is the on-line anchor | ratifies shipped `corrective.ts:283-297` (emits no correction event when `traj.terminated.t < t_shot`); the old unconditional "emitted iff attempted" contradicts the same paragraph's "at (s_shot, t_shot) on the main line" |
| `design/09-verification-and-testing.md` | §4 A-LABEL-ANCHORS bullet | `correction@late +8` → `run_wide_detect@late +8`; note `apex#1/#2@good` stay gated by `adj-doubleapex` until `good` solves two touches | the label the letter names must be the one that resolves on the departed line |
| `design/09-verification-and-testing.md` | §3.2 golden roster G-8.5-RED bullet | re-pin `fig-08-05` `late` from a refusal to solved `runoff`: `run_wide_detect` at s≈15.81 (f≈1.01, `s_divergence_m=10`, `kappa_gap.max≈0.04 1/m`) then departs outer edge, `corrective.feasible=false`, `fail_reason=departed_before_reaction`; agrees with A-RECIPE-H `late.outcome ∈ {wide, runoff}` @30; `good` two-touch pins stay `it.todo` | the unamended refusal skeleton was written to the pre-`rescueCoarseBand` engine and contradicts §4's own A-RECIPE-H |

**Code: NO CHANGE REQUIRED (verified on the built engine).**
- `src/solve/corrective.ts` already publishes `{feasible:false, detect,
  shot:null, returned:null, fail_reason:'departed_before_reaction'}` on the
  `traj.terminated.t < t_shot` arm (lines 283-297) and correctly omits the
  `correction` event there (ratified by the §4a.3 amendment). Problem [B] does
  NOT reproduce: the block rides `verdict.corners[c1].corrective`; the `Verdict`
  type has no top-level `corrective` (the "verdict.corrective===undefined"
  reading was a per-corner-vs-top-level misread).
- `src/solve/verdict.ts` `assembleVerdict` wires the block via
  `byCorner.get(row.id) ?? null` (line 304) and `physicsOutcome` maps
  `ran_wide ∧ ¬feasible → runoff` (lines 161-164). Verified end-to-end on the
  scene bake: `late` → `verdict.corners[c1].corrective = {feasible:false, …,
  departed_before_reaction}`, `outcome=runoff`.

**Test added (in ownership).** `test/property/corrective-verdict-wiring.test.ts`
(NEW) locks the Problem [B] invariant that wire.test.ts leaves untested: a
`departed_before_reaction` block (shot:null) is PUBLISHED onto
`verdict.corners[c].corrective` (not `undefined`/`null`), the `Verdict` has no
top-level `corrective`, and a never-ran-wide corner keeps `corrective:null` (the
"only publish where attempted" half of the in-hash rule).

**Hashes.**
- **No `result_hash` moved.** `late`'s `result_hash` is `1a5294` on the post-edit
  bake — identical to the adjudicator's pre-edit baseline. The corrective block
  was already in-hash and already published; nothing in `solve/` changed, so no
  line's `result_hash` moved and no golden roster fixture moved (`late` is not a
  blessed golden — `test/fixtures/goldens/` has no fig-08-05/`late` fixture; the
  roster is C30-family + book90-ideal + G-CORR-RUNOFF/WIDE + G-MISJUDGE-DR).
- **`spec_hash` moved (FIGURE stamp only): `4744ed → 2e21e4`** from the scene
  label + note edits (measured via `specHash(lowerScene(scene))`; `4744ed` matches
  the committed `figures/fig-08-05.judge.json` and `figures/manifest.json`
  stamps). This is a `figures/*` stamp, NOT a `test/fixtures/goldens/*` roster
  move. Re-baking `figures/fig-08-05.svg` + re-stamping `figures/fig-08-05.judge.json`
  / `manifest.json`, and the `test/render/gate.test.ts` fig-08-05 byte-identity /
  proportion / `T-JUDGE-RECORD` arms + the `test/hash/tripwire.test.ts`
  figure-stamp arm, are the documented DEFERRED re-bake (V02-GATES) — left red
  here by task instruction ("Do NOT re-bake or re-judge").

**Bake proof.** `linelab figure ../figures/fig-08-05.scene --mode true` →
**exit 3** (the pinned `test/render/gate.test.ts` fig-08-05 code, line 74 —
`good` refuses `NO_SOLUTION/no_two_touch_line` under `adj-doubleapex`, a tier-3
declaration deviation). Draws `late` alone (runoff, mistake/failing) with the
`run_wide_detect@late` label "ran off before reacting" resolved at the
departure; `good` is absent (refused) so its `apex#1/#2@good` labels are filtered
and no longer block the bake. This is the honest render the ruling expects.

**Out of my ownership — flagged for the owning agent.** The adjudicator's
`code_changes_required` items 1–2 re-pin `test/golden/scenes.test.ts` G-8.5-RED
(`late` refusal → solved runoff) and its file-header comment. `scenes.test.ts` is
NOT in this task's file grant (grant = `corrective.ts`, `verdict.ts`,
`emit.ts` [if a bookmark is needed — none was], `test/property/corrective.test.ts`
+ NEW tests, `figures/fig-08-05.scene`, the named `design/**` sections, this
file). Per the hard "stay inside assigned files" rule, that re-pin is left to the
`scenes.test.ts` owner; the exact verified values are in this session's
open_questions. Until it lands, G-8.5-RED stays red on the `late` arm (asserts the
old refusal) while `good` legitimately refuses `no_two_touch_line`.

---

## Adjudicated — v0.2 save-window / warn-band / fig-8.4 (this run, read first)

Four seams from the v0.2 save-window and standing work were escalated and came
back **AMEND-DESIGN** — each adjudicator built a design-compliant implementation
first and proved the design *letter* unsatisfiable on the frozen engine. All four
amendment arrays are APPLIED to `design/` (one to `figures/`), and every tied
code change is in. Status `adjudicated-fixed`.

| id | ruling (why the letter was unsatisfiable) | design edits |
|---|---|---|
| `adj-savewin-table` | §4b.5's status table keyed `never_open` on `saved(τ₀)=false`, so F-ORACLE-90 — whose scan is F…T…F (a §4b.3 inside-curl `false` prefix, one save band, a too-late `false` tail) — was reported `never_open`, suppressing the five scalars `G-SAVEWIN-RUNOFF` blesses on that very fixture. Re-keyed on `open_count` (number of `saved=true` bands): 0→never_open, 1→resolved, ≥2→intermittent. | 04 §4b.5 (count defs, status table, first-match prose, resolved bisect), 04 §4b.6, 09 §3.2 (G-SAVEWIN-RUNOFF, G-SAVEWIN-INTERMITTENT), 09 §5 (P-SAVEWIN-REFUSES) |
| `adj-tshot-grid` | (S4) §4b.6's proof premise "`t_shot` is a mandatory grid point" is false on `departed_before_reaction` (`t_shot > t_terminated`), where `saveAt(t_shot)` is `INTERNAL/save_launch_unresolvable`; the bound `tau_close < t_shot` still holds but only via a two-case argument. (S11) §3.2's blanket "all three rungs satisfy the resolution law" contradicts §4b.5's own worked `book90` v_max 9.44 (`1.0/9.44 = 0.106 > 0.1`); the 1.0 m rung is legal only where v_max ≥ 10 m/s. No src change. | 04 §4b.3, 04 §4b.6, 09 §3.2 (G-SAVEWIN-GRID), 09 §7 (P-SAVEWIN-ANCHOR) |
| `adj-fig84` | fig 8.4's `overspeed` (+26 km/h → 60) departs bookDecreasing at s=13.48 (12% of the corner, a 475 px near-tangent stub) before any tightening shows — the good line at 34 km/h rides at f≈0.999 entering 0.4 m from the outer edge, a knife-edge, so any overspeed ≥ +4 departs in the first 28%. Only a marginal `overspeed:by_kmh=2.5` marches monotonically wide off the outer edge through the tightening (outcome `wide`). | figures/fig-08-04.scene (bad line + header comment) |
| `adj-warn-band` | A-STANDING-WARN-BAND's `F-STANDING-WARN` witness (contained ∧ clean ∧ `lean_ceiling=warn`) is STRUCTURALLY unreachable: the §4.1 solver clean door caps a clean line's peak lean at `phiReserve(mu_use)`, the SAME quantity as check-8's non-blind reserve, so a clean line's peak sits AT the reserve and never eats it; the `BLIND_RESERVE_DEG` cap is gated by `blind(c)`, false for every hold-wide (clean) line. Gate redirected to the reachable na-cap rung-3 witness (`fx-standing-straight`). No src change. | 01 §A.6.1, 09 §4 (F-STANDING-WARN lead-in, A-STANDING-WARN-BAND), 09 §10 (witness map rung 3) |

**§4b.6 merge note (judgment call).** `adj-savewin-table` and `adj-tshot-grid`
independently amended the SAME §4b.6 opening sentence with overlapping `old_text`
and different replacements. Applied as ONE reconciled paragraph carrying both:
the "single contiguous band" framing (open_count) AND the two-case
`tau_close < t_shot` argument ((i) `departed_before_reaction`, (ii)
integrable-but-no-return). Neither adjudicator's verbatim text could express the
merge alone; recorded here as the reconciliation.

**Code applied.** `src/solve/saveWindow.ts` (open_count classification + band
closing-edge bisect, with a defensive open_at_end fallback for the theoretical
single-band-reaches-horizon case the adjudicator's snippet omitted);
`test/contract/saveWindow.test.ts`, `test/viewer/saveWindow.test.ts`,
`test/contract/standing.test.ts` (it.todo → real A-STANDING-WARN-BAND, three
arms), `test/golden/scenes.test.ts` G-8.4-COMPANION (runoff→wide, drop
quick_steer). Verified on the built engine: premature→`resolved` tau_close 3.038,
reaction_budget 0.006 < react_profile 1.0; slow_steer refuses 1.0 m; fig-8.4 bad
→ `wide`/off_road/[exit_containment,late_apex,out_in_out,stop_within_sight].

**No `test/fixtures/goldens/*` moved.** save-window is out-of-hash (D44);
standing and stateAt are out-of-hash. The fig-8.4 SVG bake moves (`bad`
result_hash: runoff→wide) but is DELIBERATELY NOT re-baked this run (a later run
re-bakes + re-judges all six figures once the solver changes settle).

**Also fixed this run (open-question sweep).**
- `src/core/stateAt.ts` `lerpAngleDeg` was wrap-direction-aware but NOT
  range-normalised: the 05 §3.2 worked example (psi 359°→1°) blended
  359.5/360/360.5 (out of the record's range) then jumped to the `b=1` endpoint
  the record returns verbatim — a −359.5° discontinuity as a query neared `b`.
  Fixed by snapping the shortest-arc sweep to the 360-representative nearest the
  linear chord: lands EXACTLY on both recorded endpoints (no endpoint
  discontinuity), blends through 0/360, and is a no-op for a signed sub-180°
  bracket (`phi`/`cmd_lean`), which must keep its own representative. Latent
  before (core/integrate.ts integrates psi unwrapped, so no shipped record
  crosses the seam). Pinned: `test/contract/stateAt.test.ts` (the 05 §3.2 psi
  359→1 worked example + a signed-`phi` no-op guard).
- `test/contract/stateAt.test.ts` `beforeAll` given an explicit 60 s budget: its
  ~4 s roster solve can exceed vitest's 10 s default under concurrent suite load,
  which reports every case as skipped — a phantom failure the task warned about.

**Still red after this run (reported, not fixed — outside the adjudicated scope).**
*(SUPERSEDED by the "Post-run" section at the top of this file: the figures were
re-baked + re-judged and `C-RECOMPUTE-BUDGET` was fixed. The list is kept for
provenance; each item's current status is noted inline below.)*
- `test/golden/scenes.test.ts` G-8.5-RED and `test/render/gate.test.ts`'s
  fig-08-05 arms: the solver run's C2 fix (`suggest.ts` rescueCoarseBand) made
  fig-8.5's `late` line SOLVE (runoff) instead of refusing
  `believed_world_not_clean`, which contradicts design/09 §5's unamended
  refusal-skeleton expectation, and the shipped `correction@late` label then
  cannot anchor (the `departed_before_reaction` corrective emits no `correction`
  event). **RESOLVED (this run) by `adj-fig-08-05`** (see the top-of-doc section):
  the design letter is amended (scene label `correction@late`→`run_wide_detect@late`,
  §4a.3 correction-event carve-out, A-LABEL-ANCHORS + G-8.5-RED re-pinned to the
  solved runoff truth) and the scene now bakes exit 3 drawing `late` alone with its
  `run_wide_detect` label. **UPDATE (post-run):** the figure re-bake LANDED
  (spec_hash `4744ed → 2e21e4`), so fig-08-05's byte-identity + `T-JUDGE-RECORD` arms
  are now GREEN; the residual reds are (a) `test/render/gate.test.ts` fig-08-05
  PROPORTION (stale value pins → WP-17 re-pin), (b) `test/golden/scenes.test.ts`
  G-8.5-RED `late` refusal→runoff re-pin, and (c) `test/cli/scene.test.ts` fig-08-05
  lowered-spec text re-pin to the amended scene (WP-13) — all out of grant, flagged
  for the `scenes.test.ts` / WP-13 / WP-17 owners.
- `test/render/gate.test.ts` fig-08-03 (solver C1, fifty_pence facet ladder moved
  the `bad` bake) and fig-08-04 (this run's `adj-fig84` scene edit moved the
  `bad` bake) byte-identity arms: red because the committed SVGs are stale and
  re-baking is deliberately deferred. **RESOLVED this run**: fig-08-03/04/05 were
  re-baked; all six `re-bake is byte-identical` arms are GREEN.
- `test/render/gate.test.ts` `T-JUDGE-RECORD` fig-08-04 and `test/hash/tripwire.test.ts`
  figure-stamp arm: both recompute `specHash(lowerScene(fig-08-04.scene))`, which
  moved **`1a9dd5 → 30fcb5`** (ARROW CORRECTED — the original text said "30fcb5→1a9dd5",
  which is backwards; the current scene hashes `30fcb5`, the pre-edit scene `1a9dd5`)
  because `adj-fig84` edited the scene text. This is a FIGURE stamp
  (`figures/*.judge.json` / manifest), NOT a `test/fixtures/goldens/*` roster move — no
  golden roster fixture moved. **RESOLVED this run**: both arms GREEN after the re-bake +
  re-stamp (`30fcb5`).
- `test/cli/controls.test.ts` C-RECOMPUTE-BUDGET "warm spec really is warm": the
  `run.ts` mistake-line warm-cache gap (see the ratification section). **RESOLVED this
  run**: the `run.ts` stamp fix landed → `bad.cache="hit"`, `C-RECOMPUTE-BUDGET` GREEN.

---

## Adjudicated — v0.1 seams (prior cycle)

Five seams were escalated to the design owner and came back with rulings.
Four are `confirmed-pin` (a design decision is still required — filed under
their design doc below with the adjudication arithmetic); one is `mixed`
(two sub-findings fixed, two confirmed as-implemented).

| id | ruling | filed under |
|---|---|---|
| `adj-doubleapex` | confirmed-pin — bookDoubleApex two-touch is unsatisfiable under both the per-corner release reading and the compound-window reading | design/04 §4.6 |
| `adj-feasibility` | confirmed-pin — canonical entry speeds (recipe-a@55, C30@70) have an empty feasible band on the frozen engine | design/02 §8, design/08 §6 |
| `adj-vis` | confirmed-pin — V2.5's letter is jointly unsatisfiable with D20's 5° tracker authority; the 1.4→2.0 margin move is forced | design/04 §6 |
| `adj-corrective` | confirmed-pin — book90's outward-strip geometry makes every design-letter wide/late_apex expectation unattainable on `fifty_pence`/`premature_contained` | design/03 §7.1, design/04 §4c.4 |
| `adj-checks` | mixed — check-12 teleport guard + quick_steer truncation **fixed**; check-10 open-end carve-out + single_input seed **confirmed as-implemented** | design/01 App. A |

No goldens, hashes, or bakes moved as a result of any of the five rulings
(comment/test-only edits); the Rebake step re-blesses nothing from these
seams except where a WP-16/17 item below says otherwise.

---

## design/01 — Scope and Doctrine (checks, quality law)

- **[01 §A.6.1 reserve-annex "why pass rather than not-fail"]** `adj-warn-band`
  (AMEND-DESIGN, applied, no src change): the false premise "the [lean_ceiling]
  warn band is a `clean ∧ ¬reserved` witness class **that exists by
  construction**, on a population the catalogue already produces" is corrected.
  The `clean ∧ ¬reserved` class the catalogue actually produces is the **`na`
  cap** (a corner-less clean line whose `lean_ceiling` has zero instances); the
  warn band is NOT such a class because the §4.1 clean door caps clean lines at
  `phiReserve(mu_use)` — the same quantity as this check's non-blind reserve — so
  no clean line eats the reserve, and the `BLIND_RESERVE_DEG` cap only opens a
  warn window where `blind(c)` holds (excluding the hold-wide clean line). The
  broader point survives (`reserved` is a proper refinement of `clean`). Filed
  with the 09 §4/§10 amendments above.

- **[01 App.A check 12]** KAPPA_STEP/PHI_JUMP speed-blind per-sample
  thresholds failed the profile-rate exit unwind below ~8.3 m/s (esses/
  hairpin/decreasing-radius class). — **adjudicated-fixed**: guards now read
  only Δt→0 retained-sample pairs (teleport regime), matching the check's own
  "no tracker overdrive" intent. Pinned: `test/oracle/rubric.test.ts` check-12
  Δt→0 fail witness + low-speed full-rate-flick pass witness;
  `src/plan/doctrine/metrics.ts` (`[ADJUDICATED, ratification]` comment).

- **[01 App.A, quick_steer]** SEAM-QS-TRUNCATION: a rider who never completes
  roll-in (departs off-road at ~24% of the corner) measured only on the
  ridden extent, so `steer_share` (0.24) stayed under the 0.45 fail bar and
  the mandatory slow-arm gate passed when it should fail. — **adjudicated-fixed**:
  an uncompleted roll-in now grades `eats_corner` directly (evidence:
  `dt_steer_s=null`, `roll_in_completed=false`, share = ridden lower bound).
  Pinned: `test/oracle/oracle.test.ts` SEAM-QS-TRUNCATION → mandatory
  quick_steer fail; `src/plan/doctrine/metrics.ts`.

- **[01 App.A check 10 / 05 §2.1]** `stop_within_sight`'s deficit metric fails
  every finite road's final ssd-shadow under a literal line-end clamp. —
  **adjudicated-fixed** (confirmed as-implemented): the open-end carve-out
  (road_end-terminated lines; casts unblocked to the road end carry no sight
  limit, per 03 §5.1's own rule) stands as ratified. **Still open** (not this
  seam's fix, separate defect): `verdict.sight.margin_min_m` in
  `solve/verdict.ts` still reads the pre-carve-out clamped channel and
  reports a negative minimum on every line — needs its own fix, filed under
  design/05 below. Pinned: `src/plan/doctrine/metrics.ts` (comment at the
  sightDeficit function).

- **[01 App.A, single_input]** Pre-window baseline seed in
  `steeringInputRuns` (the commit step INTO the window counts as the rising
  input) — without it, `single_input` read `no_input`/fail on every engine
  line. — **adjudicated-fixed** (confirmed as-implemented). Pinned:
  `test/golden/*.test.ts` G-C30-CHECKVECTOR.

- **[01 App.A check 13, leg (c)]** Headline ("≤1 local extremum") and
  parenthetical ("alternating: exactly one minimum — the flick; same hand:
  none") genuinely conflict. — **implemented-invariant-first**: parenthetical
  read as the binding refinement, "exactly one minimum" as tolerance not
  mandate (alternating hands pass at 0 or exactly-1-minimum extrema; a lone
  maximum fails; same-hand passes only at 0; ≥2 always fails). Design text
  should state this explicitly. Pinned: `src/plan/doctrine/checks.ts:734-736`
  comment; `test/oracle/rubric.test.ts`.

- **[01 App.A check 1 / 05 §6.3]** The `DoctrineCorner` seam carries no
  total-sweep field, so an arc corner with an empty apex list and no
  completed heading capture had no way to grade `late_apex`. —
  **implemented-invariant-first**: new typed `na` reason
  `sweep_unmeasurable` minted (01 App.A authorizes per-check typed `na`
  reasons; the na table just doesn't enumerate this case). Recommend the
  design seam grow a `Corner.angle_deg`-equivalent field so every terminated
  line grades — that field addition was outside this fix's file grant.
  Pinned: `src/plan/doctrine/metrics.ts`; `test/oracle/rubric.test.ts`.

- **[03 §7a.3 / 01]** The pack-schema check asserts
  `kappa_step_max_1pm >= kappa_max_1pm` but 03 §6.2's reason table mints no
  token for the failure. — **implemented-invariant-first**: minted SCHEMA
  reason `kappa_step_below_kappa_max`. Amend 03 §6.2's reason table.

- **[01 App.A, loader/quality law — rev-doctrine review, now fixed]** Three
  major findings from the adversarial doctrine review, all fixed in
  `plan/doctrine/{metrics,checks,pack}.ts` (no design amendment needed — pure
  bug fixes, letter already correct): (1) `apex_pct`'s empty-apex-list
  fallback fabricated a zero denominator — now resolves via `cornerSweepDeg`
  (exact taper geometry / measured heading capture / typed `na`), never
  fabricates `apex_pct:0`; (2) the pack loader never validated per-check
  threshold-name completeness (NaN could silently pass/fail under a legal
  variant pack) — new `CHECK_THRESHOLDS` registry + `thresholds_incomplete`
  SCHEMA rejection closes it; (3) 01 §A.1's advisory-severity law ("worst =
  warn, never blocks green") was enforced nowhere — `runChecks` now clamps
  advisory-row fails to warn. Five minor findings also fixed: provenance
  errors now carry the check id (§A.6); `single_input` count=0 under declared
  `double_apex` now passes ("≤2" includes 0); `check 16` now reads its pack
  row's declared `corner_trend` binding; link leg (c) extrema classified
  min/max; the continuation pack's load-time schema rejections
  (`ladder_cardinality_mismatch`, the 7a.3 coupling check) now have a real
  loader (`validateContinuationPackData`), not just test assertions. Status:
  resolved, no filler entry needed beyond this line — `test/oracle/rubric.test.ts`.

---

## design/02 — Physics Model

- **[02 §8 canonical entry speeds]** `adj-feasibility` (confirmed-pin): C30's
  70 km/h and recipe-a/b/f's 55 km/h both have an **empty intersection**
  between the §4.1a fit-clip floor and the roll-in containment ceiling — not
  an over-tight solver, a genuine geometric fact of this tuning (exhaustive
  grid-proof at 55 km/h: all 12 coarse candidates die, 5 to the fit clip, 7 to
  containment with f_max 1.46–2.23). C30 solves clean at 63 km/h (first
  candidate past the 63 fit floor of 25.48); recipe-a/b/f solve clean at
  40–50 km/h. **needs-decision**: amend 08 §6's example speed (55→~48) and
  02 §8's C30 entry (70→63), or retune the fit-clip/containment constants.
  Pinned: `test/analytic/bounds.test.ts` (D-BOUNDS), `test/cli/recipes.test.ts`
  A-RECIPE-A/B/F, `review/verify/fixture_geometry.py` check 16 (independent
  corroboration). Files audited untouched: `solve/{solve,stations,constants,
  suggest}.ts`, `road/corridor.ts`.

- **[02 §6 ZOH control vs 09 §3.2a closed forms]** A strict ZOH staircase
  makes `A-AN-BRAKE`/`A-AN-RK4`'s closed forms (`v = v0 − (slew/2)t²`)
  unsatisfiable by ~7.5e-3 m/s. — **implemented-invariant-first**: the RK4
  stage derivative reads an in-stage *linear* command lattice,
  `a(τ) = a_start + rate·τ`, between the step's two lattice values. Control
  consumers (`b_dem`, transient trigger, recorded `cmd_a`/`a_cmd_rate`) stay
  ZOH per ARCHITECTURE §10.10 — only the RK4 stage sampling changed. Amend
  02 §6 to specify the in-stage linear lattice.

- **[02 §3.1 release predicate]** `wrapToPi` in
  `dpsi_rem = handSign(c.hand)·wrapToPi(psi_exit − psi)` folds any remaining
  sweep >180° negative, releasing a 270° commitment (`F-AN-CIRCLE`) at its
  first step via the doc's own "≤0 releases immediately" rule — wrong.
  **implemented-invariant-first**: strike `wrapToPi`; `psi` is continuous in
  the engine. Spellings agree exactly below 180°. Amend 02 §3.1.

- **[02 §3.1 tracker law vs §2 frame]** The doc's tracker spellings presume
  d-toward-centre and anti-damp against the pinned d-positive-LEFT/y-down/
  +kappa-right frame, failing §5.4.6's binding invariants. —
  **implemented-invariant-first**: frame-correcting amendment —
  `d_dot = −v·sin(psi − psi_road)`, `kappa_ff = kappa/(1 + d·kappa)`, and
  `a_track` enters the lean target with a **minus** sign. Amend 02 §3.1.

- **[02 §3.1 transition table]** Missing `position(p) → commit(k')` row
  (turn_in reaching `at_s` supersedes an active position window per
  REQ-STEER-OWNERSHIP precedence (2)>(3)); null-corner-commitment behavior
  unstated. — **implemented-invariant-first**: row added; null-commitment
  pinned as "held with no release, never yields." Amend 02 §3.1's table.

- **[01 §A.2 steering_complete]** Unsigned `|phi| ≥ 0.9·phi_c` misfires at
  the supersession step of every commit→commit flip (esses row, C30-LR),
  collapsing `dt_steer`/`steer_share` for the second corner of every chained
  fixture. — **implemented-invariant-first**: amend to the signed form
  `handSign(hand)·phi ≥ 0.9·phi_c`. Amend 01 §A.2's letter.

- **[02 §4.2 brake tapering]** "Taper to complete `brake_gap` before turn-in"
  read under 02 §3's from-onset taper law sheds only `decel·span` — not
  04 §4.1a's constant-decel arithmetic (and not the ~50 km/h C30 corner
  speed 02 §8 implies). — **implemented-invariant-first**: hold+release
  realization — brake holds, a maintenance crack releases it pre-turn-in at
  `SOLVER_BRAKE_SLEW_MSS = 12`, restoring §4.1a's arithmetic. Pinned:
  `src/solve/solve.ts:658-660` comment. Amend 02 §3/04 §4.2 to spell the
  hold+release shape.

- **[02 §3.1 vs 04 §6 V2.5]** `adj-vis` (confirmed-pin): V2.5's letter
  ("turn-in at or after release") is jointly unsatisfiable with D20's 5°
  tracker authority — a literal post-release turn-in on the blind preset
  lands 9.0 m in-corner, and any uncommitted line exits the road at
  `s0+3.8 m`. **needs-decision**: the blind corner is instead negotiated
  under a wide commitment (PHI_TRACK_AUTH_DEG=5° forbids position
  negotiation at governed speeds) with roll-on release-gated. The
  `A-SSD-GOVERNOR` margin pin move 1.4→2.0 is a forced consequence (measured
  binding threshold 1.804). Alternative readings tried and killed with
  numbers: literal turn-in-at-release (off_road 19.79 < release 25.0 at every
  lean 24–44°), crawl speed (needs v ≤ 3.35 m/s, below the validity floor
  7.0), two-turn_in relabeling (first turn_in still precedes release). Amend
  04 §6 V2.5 or accept the wide-commitment reading; amend 09 §3.5's 1.4
  margin pin to 2.0. Pinned: `src/solve/vis.ts` header;
  `test/property/solver-ext.test.ts` A-SSD-GOVERNOR (1.4-inert arm +
  1.4<1.804<2.0 tripwire) + the "V2.5 seam" test.

---

## design/03 — Roads, Scenarios & Visibility

- **[03 §7.1 fixture pins vs corrective/mistake geometry]** `adj-corrective`
  (confirmed-pin): all four corrective/mistake seams are genuine engine
  truths. book90's outward-strip geometry (0.4 m at 10–42° emergent crossing
  angles) sits far outside the 2.2°/6° recoverability ceilings, so every
  design-letter wide/feasible or `late_apex`-fail expectation is
  unattainable on `fifty_pence` and `premature_contained`:
  - `fifty_pence` (SEAM-FP-PIN): 03 §7.1 pins `wide`; engine emergent class is
    `runoff` (same 0.4 m bike-margin geometry that makes `premature`'s
    corrective infeasible — 03 §7.1's own rule 2). **needs-decision**: 09 §4
    TUNING-PIN re-bless of the `plan/mistakes.ts` row. Pinned:
    `test/oracle/oracle.test.ts` `SEAM_FIXTURE_PIN_OVERRIDES`.
  - `premature_contained` (SEAM-PC-LATE-APEX): 03 §7.1 declares `late_apex`;
    the only contained eased line from the clamped early station has a final
    apex at pct 63.7 > bar 50 → `late_apex` **passes**; the emergent taught
    check is `out_in_out` (the table cell's own parenthesis).
    **needs-decision**: amend the pin-table `expect_fail` cell
    (`plan/mistakes.ts`).
  - The null-shot corrective arm (drift self-recovered before `t_shot` →
    feasible null-save) is the unique compliant completion of §4a.6×§4c.4;
    without it, marginal transient excursions leak `INTERNAL`. Verified
    `integrate.ts` has no edge-accounting bug: `detect` fires at the usable
    edge (|d|=3.1), `off_road` at the physical edge (|d|=3.5); the
    "terminal within ~1 m" read is genuine drift-angle geometry, not a bug.
  - Any future attempt to reach `fifty_pence`→`wide` by param tuning on
    book90-L is provably futile (angle ceilings 2.2°/6° vs emergent 10–42°,
    mirror @32 also fails, measured). The wide class needs a fixture with a
    post-detect runway ≥ `v·t_react·sin(θ)`.

- **[03 §7.1 early-placement clamp]** "Placed `early_by_m` earlier" clamps to
  a 0.5 m road-start floor when the solved turn-in sits closer.
  **implemented-invariant-first** (pin-servant reading); also clamps
  `F-ORACLE-CHAIN` c1 (turn-in at 4.0 → clamped 0.5).

- **[03 §7.1 "target stays tangent_inside"]** `premature_contained`'s
  resolution as the smallest contained committed lean above the kiss — a
  second bounded probe family beside 04 §5.1.3's `N_PROBE` kiss derivation.
  **implemented-invariant-first**.

- **[03 §5.1 target law vs F-SIGHT-OUTSIDE]** No reachable occluder family
  (inside/outside bands, own/oncoming, either hand) makes widening shorten
  sight under the own-lane-centre target law. **pinned-engine-truth**: hosted
  as a no-witness tripwire scan that fails on demand if the target law ever
  changes. Pinned: `test/property/solver-ext.test.ts` F-SIGHT-OUTSIDE.

---

## design/04 — Solver & Authoring

- **[04 §4b.5 save-window status table]** `adj-savewin-table` (AMEND-DESIGN,
  applied): the status table now keys on `open_count` (number of maximal
  `saved=true` bands), not `saved(τ₀)`. `never_open` ⟺ 0 bands, `resolved` ⟺ 1
  band (its trailing edge is `tau_close_s`, tolerating a §4b.3 inside-curl `false`
  prefix and a too-late `false` tail), `intermittent` ⟺ ≥2 bands. The resolved
  bisect now targets the band's closing edge (last `true` → first `false`), not a
  forward scan from k=0 (which bisected between two `false` points on an F…T…F
  scan). Code: `src/solve/saveWindow.ts`. Pinned:
  `test/contract/saveWindow.test.ts`.
- **[04 §4b.3 / §4b.6 save-window anchor & reaction budget]** `adj-tshot-grid`
  (AMEND-DESIGN, applied, no src change): §4b.3 now states the `t_shot` anchor
  identity's unstated premise (the main line reached `t_shot`) and defines the
  extended `saved(t_shot) := false` on `departed_before_reaction`; §4b.6's
  consistency argument runs over two cases ((i) departed-before-reaction, (ii)
  integrable-but-no-return) because `t_shot` is not always an in-domain grid
  point. The §4b.6 opening paragraph is the RECONCILED merge of this amendment and
  `adj-savewin-table`'s overlapping edit (see the top-of-doc merge note).
- **[04 §4.6 two-touch / release law]** `adj-doubleapex` (confirmed-pin): the
  two-turn-in double-apex plan cannot persist a commitment across
  bookDoubleApex's three sub-corners under either the per-corner
  heading-capture release (02 §3.1) or the alternative compound-window
  reading — the governing-corner release fires at the FIRST same-hand
  corner's exit heading, so no contained two-touch line exists on the preset
  (existence-scanned). **needs-decision**: requires a compound-window
  release binding or a single-arc bookDoubleApex reshape — a design decision,
  not a search/minting/binding fix. Consequences that stand on this pin:
  `NO_SOLUTION`/`no_two_touch_line` on the plain arm;
  `--accept best_failing` returns the retained best candidate;
  `G-APEXLIST`'s designed `[1,0,1]` apex list is unattainable (hosted as
  `it.todo`); `G-8.5-RED` bakes with all lines refused (goldens pin the
  refusal skeleton, per-line pins are `it.todo`); `A-RECIPE-J` inherits this
  same seam verbatim (not a new finding). Pinned: `test/property/solver-ext.test.ts`
  A-DOUBLEAPEX (tripwire: coarse `measureRun` of the crawl witness — decel
  3.4, ti1 15°/lean 20°, ti2 43°/lean 30° — asserting contained + two_touch +
  band + apex-count + touch speeds; if any assertion flips, re-adjudicate);
  `src/solve/doubleApex.ts` header; `test/oracle/oracle.test.ts`;
  `test/golden/scenes.test.ts` G-8.5-RED; `test/cli/recipes.test.ts` A-RECIPE-J.

- **[04 §5 chain verdict vs 01 App.A check 12]** CHAIN-CLEAN SEAM: "zero
  applicable check fails" on a correctly ridden bookEsses chain is
  unsatisfiable — a full-rate 50°/s flick at chain speeds ≤9 m/s steps
  recorded kappa >0.01/0.5m sample, and rideability's window closes exactly
  where the D27 flip budget opens; the frozen commit-release law also caps
  the final corner's exit swing. **needs-decision**: pinned as
  `outcome=contained` + chain checks pass + failing set CLOSED to
  `{out_in_out, single_input, rideability}` with `max_excess_dps=0`; needs
  `KAPPA_STEP` retuning (pack data) or a grid/metric change. Consequence:
  `A-CHAIN-GREEN` (fig-08-06, "designed good/green") is unsatisfiable on this
  engine and not hosted; `fig-08-06` bakes at declaration-gate exit 3
  (quality caution). Pinned: `test/property/solver-ext.test.ts`.

- **[04 §4.1a / R6]** 09 §3.5's R6 fixture `R 12 ^90 @34` (R-hand own-lane
  corridor, radii [8.9, 11.6]) is not mirror-equivalent to the book90 L-hand
  fixture and does not solve clean at 34. **needs-decision**: hosted
  `P-CONSTRAINT-BINDING` on the L-hand twin instead; needs the fixture
  respecified. Pinned: `test/property/solver-core.test.ts`.

- **[04 §4.8 / 09 P-ACCEPT-MONOTONE]** "Byte-identical" cannot be literal
  while `acceptance{policy}` is in-hash. **implemented-invariant-first**:
  ratify "identical modulo the acceptance stamp."

- **[04 §5 link_flip_infeasible]** The committed reachability witness needs a
  roll-rate-capped rider (cap 30 dps) — at street rate the scan always
  resolves the zero-gap esses by slowing wherever corner 1 is itself
  solvable. **pinned-engine-truth**.

- **[09 §3.5 chain-fixture hold-window arithmetic]** The engine's roll-in
  anticipation (`0.5·v·t_roll`, containment-forced) shrinks the usable hold
  window below the full gap; the governed slow-down re-enlarges T. The S 18
  full-hold claim lands on the inter-corner hold at governed (~33.7 km/h)
  speed; the S 12 budget-limited witness lands on c1's approach hold.
  **implemented-invariant-first**. Pinned: `test/property/solver-ext.test.ts`
  A-CHAIN-VIS-FULL/BUDGET.

- **[04 §4.7 believed-road / P-MISJUDGE-PREFIX]** Byte-identity is scoped to
  the integration channels: the sight-cast family reads geometry beyond
  `s_div` by design (D4 lookahead), and `f` re-frames at the governing-corner
  handoff. **implemented-invariant-first**: both asserted on their own terms.

- **[review, rev-solver, 12 findings — fixed/adjudicated this cycle]**
  The adversarial solver review (design/04 + D10/D21/D22/D23/D24 against
  `solve/{doubleApex,chained,vis,believed,accept}.ts`) found 12 issues after
  verifying every §4.1a worked number and the core bisection/ranking/touch
  algebra correct. **Corrected from an earlier draft of this document**,
  which claimed no fix package ever ran against these — a `fix-solver` pass
  did run this cycle (in `src/solve/{chained,doubleApex,suggest,solve,
  believed}.ts` + both property test files) and resolved 8 of the 12
  outright, with 2 more confirmed-pin by adjudication. Status per finding:
  (1) `solveDoubleApex`'s `best_failing` path returning lines without
  checking authored constraints — **fixed**: the coarse stage now joins
  constraints and `best_failing` walks retained, self-verified candidates,
  never a violator. (2) chained/vis/doubleApex solvers dropping authored
  plan fragments — **fixed**: `buildChainContext` now typed-refuses authored
  fragments/numeric `turn_in` across all three solvers. (3) vis mode's
  turn-in-before-release — **resolved by `adj-vis` above** (confirmed-pin,
  wide-commitment reading ratified). (4) `solveDoubleApex` never emitting
  `constraint_unmet` — **fixed**, typed and ordered alongside (5)
  `coarse_fine_disagreement` — **fixed**, same change. (6) `chainedSolve`
  returning the fewest-doctrine-fails contained chain, not the design
  letter's "gentlest fully-contained decel" — **still needs-decision**
  (confirmed-pin, not code-fixable without a ranking-law choice; matches the
  `PENDING RATIFICATION` comment at `src/solve/chained.ts:795-797`). (7) the
  `P-ACCEPT-MONOTONE` break via probe short-circuit asymmetry — **fixed**:
  `CandidateSolve` gained `probe_infeasible`; `bestFailingLoop` replays
  clean's exact walk (memoized) so monotonicity holds by construction. (8)
  believed-road byte-identity breaking when the believed road outruns the
  actual — **fixed**: the full believed plan is now restored into the record
  and resealed; `brake_gap` is corner-derived. (9) explicit `corner=`
  bypassing the 120° double-apex qualification — **fixed**: sweep
  qualification is now universal. (10) the undesigned in-hash
  `corrective{shot:null}` arm — **confirmed-pin, ratified** by `adj-corrective`
  above as the unique compliant completion of §4a.6×§4c.4 (design/04 §4a.6
  needs its recorded-shape text amended to match, per that adjudication's
  ratification item). (11) `F-CONSTRAINT-HARD` exercising a swapped road and
  an inverted bound vs. the committed fixture — **fixed**: the fixture was
  respelled to 08 §6(f). (12) chained interior exit-targeting/braking
  replaced by ranking proxies — **still open**: outside `fix-solver`'s
  assigned file grant, not attempted this cycle; genuinely recommend a
  dedicated pass before v0.2. No blessed golden or hash moved as a result of
  findings 1/2/4/5/7/8/9/11 (comment/behavior-preserving fixes verified
  against the existing goldens); figures were re-baked only because a
  sibling render fix (see design/06 below) had left committed artifacts
  stale, not because of any solver-fix finding.

---

## design/05 — Result Contract & Inspection

- **[05 §6.1 "contained"]** `max_time`/`max_dist` guard terminations
  classify as `contained` (the closed five-value set forces a value; the
  guard itself stays recorded in `terminated.reason`), but 05 §6.1 defines
  contained as "reached road end." **implemented-invariant-first**: amend the
  contained definition or add a guard clause. Pinned: `test/contract/wire.test.ts`
  (both reasons); `src/solve/verdict.ts:126-128` comment.

- **[05 §8.3 result_hash formula]** `roll_rate_cap_dps` rides as a third
  top-level hash-payload key (`{verdict, plan, roll_rate_cap_dps}`) — the
  pinned two-member formula is literally unimplementable (a scalar can't ride
  in the plan action array). **implemented-invariant-first**: shape kept as
  implemented; amend §8.3's formula to a named third member. Pinned:
  `src/solve/envelope.ts:88-90` comment.

- **[05 §8.3 emission rounding]** `max_abs_1pm` (misjudgment kappa-gap, 1/m)
  rounds at the letter's 2-dp default, collapsing the in-scope range
  0.01–0.07 1/m to one significant digit. **implemented-invariant-first**
  (conformed to the letter, which is what creates the precision loss):
  recommend §8.3 grow a high-resolution curvature bucket — hash-moving but
  free until first bless. Pinned: `src/solve/emit.ts:21-23` comment.

- **[05 §6.1 physicsOutcome, off_road arm — now fixed]** The `off_road` arm
  was unreachable when any detect/corrective existed, so a feasibly-corrected
  wide excursion followed by a terminal inside-side departure in another
  corner classified `wide` where 05 §6.1 precedence demands `runoff`. —
  **fixed** (was a rev-contract major finding): `physicsOutcome` now
  implements 04 §4a.6's per-corner law, clause-2 runoff checked before wide;
  chain-handoff regression tests added.

- **[05 §7 / envelope, corner_id-less run_wide_detect — now fixed]** Failed
  open to `wide` with zero feasible correctives instead of `runoff`/
  `INTERNAL`. — **fixed**: typed `INTERNAL`/`detect_missing_corner_id`.

- **[verdict.sight.margin_min_m clamp — open, not part of the check-10 seam]**
  Reads the pre-carve-out clamped sight channel and reports a negative
  minimum on every line. **needs-decision** — separate small fix in
  `src/solve/verdict.ts`, flagged by both the WP-10 package ratification and
  the `adj-checks` adjudication notes; not yet resolved.

---

## design/06 — Rendering & Projection

- **[review, rev-render, 4 findings — all fixed this cycle]**
  All four were self-disclosed in `render/topdown.ts` source comments; none
  sanctioned by ARCHITECTURE's phase-gating tables the way `mode=diagram`/
  `width_exag`/`fan` are. **Corrected from an earlier draft of this
  document**, which claimed no fix package ever ran against these — a
  `fix-render` pass did run this cycle (`src/render/**` + new tests in
  `test/render/ink.test.ts`) and fixed all 4, no ratification needed (hazard
  geometry was already reachable from `LineResult` without a solve-side
  change). Most severe first:
  1. **critical, fixed** — stages 7/8 drew `scene.lines` in caller-supplied
     order with no role-based sort, so §3.1 stage 8's "ideal on top"
     invariant wasn't actually enforced by the renderer. Fix: `project.ts`
     now sorts drawn lines by `roleRank` (the same helper `legend.ts`/
     `markers.ts` already used) once, before rotation, so every downstream
     reader sees reference→alternative→mistake→ideal regardless of caller
     order.
  2. **major, fixed** — stage 6's occlusion wash shaded the *entire* road
     polygon instead of only the area beyond the sight ray's limit point,
     inverting the visible/occluded contrast fig-8.1's device depends on.
     Fix: `DrawnScene.occlusionWash` is now a precomputed polygon scoped from
     `s_limit` to the window end; `stageOcclusion` just draws it.
  3. **minor, fixed** — stage 4 (gravel stippled circles) was a complete
     no-op even though gravel hazards are a carried (non-deferred) v0.1
     feature per 03 §4. Fix: new stage 4 draws deterministic stipple-circle
     grids (`GRAVEL_STIPPLE_SPACING_M`/`_RADIUS` in `render/constants.ts`) as
     explicit `<circle>` elements, no RNG.
  4. **minor, fixed** — stage 5 occluder glyphs reused the raw physical
     footprint polygon with only a kind-keyed fill colour, not the four
     distinct schematic glyphs (blob/hatched/contoured/windshield) 06 §3.1
     stage 5 specifies. Fix: `occluderGlyphSvg` now adds kind-differentiated
     overlays (hedge bump circles, wall cross-hatch ticks, bank contour
     polylines, vehicle windshield hint) on top of the unchanged base
     footprint.

  This is the fix responsible for the sharp improvement in the figures'
  re-judge results below — fig-08-02's and fig-08-04's previously
  non-rendering mistake lines and fig-08-06's floating markers all trace to
  finding 1 (role-based draw order), confirmed by the before/after judge
  records rather than asserted. No design-doc amendment needed: the
  renderer's behavior now matches the letter; this was a pure implementation
  gap, not a design-text conflict.

- **[06 §2.1 orient — now fixed]** `render/project.ts` originally accepted
  only numeric `orient`; the CLI hands it the string `"0"`/`"90"`/etc.,
  rejecting every legal `--orient` value SCHEMA/`no_view_mirror` (a WP-15↔
  WP-14 seam bug, D8-flagged `KNOWN-INERT`). **fixed** by WP-17:
  `project.ts` now accepts the canonical numeric-string spellings, required
  by ARCHITECTURE §4's opaque-string view law and by the committed
  fig-08-06 scene (`orient=90`).

---

## design/08 — CLI & Agent Interface

- **[08 §6 recipe (a)/(b)/(f) canonical speed]** Same root cause as
  `adj-feasibility` above: the verbatim commands at entry 55 km/h are
  `NO_SOLUTION`/`empty_band` on the current tuning (confirmed by calling
  `chainedSolve`/`solve` directly, bypassing the CLI; independently
  corroborated by the already-shipped `F-CONSTRAINT-HARD` fixture, whose own
  name documents `R 25 ^90` @55 as a deliberately hard/refusing case). The
  same road solves clean at 40–50 km/h. **needs-decision**: retune the
  physics or amend 08 §6's example speeds. Pinned: `test/cli/recipes.test.ts`
  A-RECIPE-A/B/F (both the verbatim command and a nearby feasible speed, to
  prove the CLI composition itself is not at fault).

- **[08 recipe (j), inherited]** A-RECIPE-J surfaces the `adj-doubleapex`
  seam again (bookDoubleApex refuses `no_two_touch_line`) — not a new
  finding, flagged only because the recipe's test necessarily re-exercises
  it.

- **[08 §4 zero-file plan-channel flags]** `--brake`/`--throttle`/
  `--position`'s placeholder `at_s:0` anchor has no design-specified anchor
  for zero-file plan-channel flags absent prior station context.
  **needs-decision** before these three flags can be considered fully
  faithful to the design bar.

- **[08 §3 render on a bare envelope]** `render` on a bare `envelope.json`
  structurally cannot draw FigureSpec-authored labels — 05's
  LineResult/FigureResult envelope carries no `labels`/`marks` field.
  **needs-decision**: either `FigureResult` grows a labels/marks passthrough,
  or `render`'s contract is amended to also accept the originating
  FigureSpec. (Same root cause noted independently by WP-14's ratification
  on the `project(road,lines,viewSpec)` signature vs. FigureResult.road's
  narrower `RoadModel` typing.)

- **[09 §8.1 D8, --line-id — now fixed]** `--line-id` was parsed but had no
  consumer (accepted-and-ignored, a D8 violation). WP-16 encoded it as a
  `KNOWN-INERT` row so CI would flip red once wired; wiring landed and the
  row is now an ordinary effect row.

---

## design/09 — Verification & Testing

- **[09 §3.2 / §5 G-SAVEWIN-RUNOFF, P-SAVEWIN-REFUSES]** `adj-savewin-table`
  (AMEND-DESIGN, applied): G-SAVEWIN-RUNOFF now pins `status:"resolved"` on
  F-ORACLE-90 (its F…T…F scan is `open_count==1`), so the five scalars are
  producible; P-SAVEWIN-REFUSES is re-keyed on `status=="intermittent"`
  (`open_count ≥ 2`), NOT `transition_count > 1` — an inside-curl F…T…F scan has
  `transition_count==2` yet emits the scalars. G-SAVEWIN-INTERMITTENT acceptance
  keys on `intermittent`/open_count≥2. Pinned: `test/contract/saveWindow.test.ts`.
- **[09 §3.2 / §7 G-SAVEWIN-GRID, P-SAVEWIN-ANCHOR]** `adj-tshot-grid`
  (AMEND-DESIGN, applied): G-SAVEWIN-GRID's 1.0 m rung is scoped to in-domain
  `v_max ≥ 10 m/s` (the resolution law is `scan_ds/v_max ≤ 0.1 s`); the three-rung
  agreement runs on overspeed/chop/F-ORACLE-90, and `slow_steer` (v_max 9.44)
  refuses 1.0 m while resolving at 0.25/0.5 m. P-SAVEWIN-ANCHOR takes the extended
  `saved(t_shot):=false` on `departed_before_reaction` (asserts
  `corrective.feasible=false ∧ fail_reason=departed_before_reaction`, not a live
  `saveAt` probe that would return `INTERNAL`). Pinned:
  `test/contract/saveWindow.test.ts`.
- **[09 §4 / §10 A-STANDING-WARN-BAND, witness map]** `adj-warn-band`
  (AMEND-DESIGN, applied, no src change): A-STANDING-WARN-BAND redefined to the
  reachable engine truth — the `contained ∧ clean ∧ warn` intersection is
  STRUCTURALLY empty (the §4.1 clean door caps clean lines at `phiReserve`, the
  same quantity as check-8's non-blind reserve), so the gate asserts three arms
  (na-cap rung-3 witness, blind-corner warn band ¬clean at rung 2, book90@38
  `empty_band` pin). §10's rung-3 witness is now NAMED as `fx-standing-straight`,
  so `G-STANDING-BITES` is a genuine set-equality (was AMBER for the deviation).
  `F-STANDING-WARN` retained only as the emergent-refusal pin. Pinned:
  `test/contract/standing.test.ts` (it.todo replaced by a real gate assertion).
- **[09 §3.6 A-RECIPE-C / 08 §6(c)]** `adj-recipe-c` (AMEND-DESIGN, applied, no src
  change) — the stale speed-governed compare clauses restated to the ratified
  `adj-vis` hold-wide signature. The letter's two measurable clauses
  ("`min(sight_ride_m − ssd_m)` strictly larger on the governed line; governed entry
  speed lower") MEASURE the reverse on recipe (c)'s own fixture across the whole
  feasible `--vis-margin` range, because V1's entry-speed cap never binds on this
  class of blind corner (`adj-vis`) and the sight standoff is bought by V2's hold-wide
  lateral positioning while the ungoverned line independently brakes for a tight apex.
  A-RECIPE-C's bullet and 08 §6(c)'s Expect prose now describe the hold-wide trait
  the physics actually produces (the governed line carries a vis-hold with a held wide
  `target_f` and holds `f ≥ ~0.82` through the corner; the ungoverned line carries no
  hold and dives to `f ≈ 0.04`). `test/cli/serve.test.ts`'s two `it.fails` clauses
  are rewritten as real green tripwires on that signature (removed the `it.fails`
  wrappers); the honest measured numbers are in the top-of-doc `adj-recipe-c` UPDATE.
  Same class as `adj-vis`/`adj-feasibility`. Pinned: `test/cli/serve.test.ts`
  A-RECIPE-C (the two hold-wide clauses + the ratified 1.5-margin `NO_SOLUTION` arm).

- **[09 §3.2a C30-DR]** 02 §8.2's `R40→R25` clothoid letter has an empty
  clean band at every probed entry/sweep/turn-in on this engine. —
  **pinned-engine-truth**: bless roster rides
  `lane 3.5 | S 10 | R 16>9 ^130 | S 14` @34, `accept=best_failing` (the
  bookDecreasing-shaped taper mirrored to C30's right hand). **needs-decision**:
  02 §8.2 needs a ratified replacement letter.

- **[09 §3.2 G-CORR-WIDE]** Design letter: mirrored `premature` → `wide`,
  `corrective.feasible=true`. Engine: mirrored `premature` is `runoff` with
  corrective infeasible (`departed_before_reaction`); the mirror base solves
  clean only at 32 km/h, not 34. **pinned-engine-truth** — roster records
  engine truth at 32.

- **[09 §3.2 C30-chop]** Design pins outcome `runoff`. Engine bakes `wide` at
  default slew 40 (contained at slew 10). **pinned-engine-truth**.

- **[09 §3.2/09 §4 G-8.4-COMPANION / G-8.5-RED]** (updated this run)
  - **fig-08-04 / G-8.4-COMPANION**: both lines SOLVE. `good` is
    contained/good with one late apex; `bad` is now **`wide`/failing** under the
    `adj-fig84` amendment (`overspeed:by_kmh=2.5`, was runoff at the +26 default).
    `G-8.4-COMPANION` pins `bad` outcome `wide`, terminated `off_road`, fail-set
    `[exit_containment,late_apex,out_in_out,stop_within_sight]` (drops
    `quick_steer`). GREEN. The committed `figures/fig-08-04.svg` bake is STALE
    (bad: runoff→wide) — deliberately not re-baked this run;
    `test/render/gate.test.ts` fig-08-04 byte-identity is RED until the deferred
    re-bake.
  - **fig-08-05 / G-8.5-RED**: `good` still refuses `no_two_touch_line` (the
    `adj-doubleapex` seam). `late` was `NO_SOLUTION/believed_world_not_clean`,
    but the solver run's C2 fix (`suggest.ts` rescueCoarseBand — a real false
    `empty_band` repair) made it SOLVE (runoff/1a5294). G-8.5-RED (which pins
    `late` as a refusal, per unamended design/09 §5) is therefore RED, and the
    shipped `correction@late` label cannot anchor (the `departed_before_reaction`
    corrective emits no `correction` event). **adjudicated-fixed** by
    `adj-fig-08-05` (this run, top of doc): fig-8.5 `late` SOLVES `runoff` (Option
    (2) ACCEPT RUNOFF — "corrects late" is physically impossible on `bookDoubleApex`,
    reaction budget short 2.3×–10.2×); design letter amended (G-8.5-RED re-pinned to
    solved runoff, A-LABEL-ANCHORS + §4a.3 carve-out, scene label
    `correction@late`→`run_wide_detect@late`). The `test/golden/scenes.test.ts`
    G-8.5-RED `late` re-pin is out of the fig-08-05 task's grant (flagged for the
    `scenes.test.ts` owner); the figure re-bake (spec_hash 4744ed→2e21e4) is DEFERRED.

- **[09 §4 A-CATALOGUE-EXERCISED]** Cannot pass over the committed corpus:
  `quick_steer`/`traction_ceiling`/`lean_ceiling` never fail anywhere,
  `hold_wide_for_sight` has zero non-na instances, the chain trio is
  one-sided, `wrong_strategy_for_corner` never fails; needs a
  `lean_ceiling`-fail fixture (also required by `A-DANGER-DWELL`'s second arm
  and the D43 rung-0 witness). **needs-decision**: new roster fixtures + a
  re-bless commit.

- **[09 §4 A-RUBRIC-STAMP]** Perturbed-pack arms unhosted; needs the same
  engine-integrated regrade harness / fixture tranche as the item above.

- **[09 §3.2 G-C30-CHECKVECTOR gloss]** C30's committed check vector carries
  `trail_brake_taper: "na"`; the design gloss ("13–15/11/16 na, the rest
  pass") over-counts by one. **pinned-engine-truth** — committed vector is
  pinned verbatim.

- **[09 §3.2 / 07 §5.3 G-POV-CLAMP-MIDCORNER]** Design's 36.8° presumes
  ~1.34 m inside of centre at mid-corner; this engine's solved book90 line
  sits at ~1.30 m → 37.4° by the same grazing arithmetic.
  **pinned-engine-truth** (±1.5° tolerance, fov 60°/half-frame 30 carried as
  the 07 §5.3 literal).

- **[09 §3.2 tolerances table]** `test/fixtures/tolerances.json` adds a
  `fractions ±0.001` TUNING category absent from 09 §3.2's table (needed
  because 02 §8 pins fraction-valued golden quantities). **implemented-invariant-first**:
  09 §3.2 should grow the row.

- **[09 §3.2a blessed-block roster]** `{C30, C30-chop, C30-trailbrake,
  C30-DR}` implements the **09-owned** write-back sketch; 02 §8.1's caption
  ("every fixture in §8.2") is the non-owning doc's looser gloss.
  **implemented-invariant-first** — 09's letter wins per module ownership.

- **[09 §8.1 T-POS-SHORTFALL]** The solve-merge route refuses every
  post-release placement `NO_SOLUTION`/`authored_action_conflict` (the
  solved turn_in's static commitment span covers the exit straight); fixture
  rides the explicit-plan spelling instead (turn_in 37.5°@5.5, which
  validates and emits `position_shortfall`). **implemented-invariant-first**.

- **[09 §8.1 turn_in.hand]** The mandated witness rides a named harness test
  rather than a table row — the printed schema has no `turn_in.hand` path
  and `T-D8-EXHAUSTIVE` requires rows to cover exactly the printed paths.
  **needs-decision**: either the schema grows the path or the named-test
  hosting is ratified.

- **[09 §3.4 P-MISJUDGE-PREFIX / F-SIGHT-OUTSIDE]** See design/04 entries
  above — same underlying findings, filed under both docs since 09 owns the
  gate and 04 owns the mechanism.

---

## Six baked figures — visual-judge results (figures/*.judge.json)

**CURRENT (post-run 2026-07-24) — all six committed judge records grade overall
`pass`.** fig-08-01/02/06 were re-judged GREEN in a 2026-07-24 round (the
J6-projection-disclosure item is `na` on every true-mode bake, and the render fix
cleared the marker/label misses); fig-08-03/04/05 were re-baked and their fresh
records were committed THIS run (see the top-of-file "Post-run" section). Every
`T-JUDGE-RECORD` arm is GREEN. Current committed per-figure verdict + flaky items:

| figure | judge verdict | flaky items (non-unanimous split, marked `flaky:true`) |
|---|---|---|
| fig-08-01 | **pass** | J4 |
| fig-08-02 | **pass** | J3 |
| fig-08-03 | **pass** | — |
| fig-08-04 | **pass** | — |
| fig-08-05 | **pass** | J2 (na/fail/pass three-way split — rubric-tightening item, top of file) |
| fig-08-06 | **pass** | J2, J3, J5 |

The 2026-07-23 table below (all six `fail`) is SUPERSEDED — it predates the
2026-07-24 re-judge and this run's re-bake; kept for provenance. Note: the
"J6 disclosure-note gap" it flagged is **na** on true-mode bakes (J6 applies to
diagram mode only), so it never fails a v0.1 figure; the diagram-mode disclosure
note remains a genuine future gap for the deferred diagram projection, not a v0.1
judge failure.

---

**Re-judged 2026-07-23 (D36 §7.4 ceremony — SUPERSEDED, see the CURRENT block above)** after the `fix-render` pass
(role-based draw order, occlusion-wash scoping, gravel stipple patches,
occluder schematic glyphs — see design/06 below) and the resulting figure
rebake. All six figures **still fail** the visual judge's overall verdict (3
independent judge attempts per figure, majority-vote with flaky-item
tracking), but the failure surface shrank substantially — the missing-line
and floating-marker defects that dominated the previous round are gone; what
remains is the disclosure-note gap plus a handful of marker/label/legibility
misses. This is a separate axis from the declaration-gate exit codes above —
a figure can bake and solve cleanly (exit 0) and still fail the rubric that
checks what the SVG actually shows.

| figure | judge verdict | failing items (majority) | flaky items (non-unanimous split) |
|---|---|---|---|
| fig-08-01 | fail | J2 (no turn-point marker glyph rendered), J6 (no diagram-mode disclosure note) | — |
| fig-08-02 | fail | J6 (no disclosure note) | — |
| fig-08-03 | fail | J2 (marker glyph missing), J6 (no disclosure note) | J3 (labels), J5 (mistake legibility) |
| fig-08-04 | fail | J2 (marker glyph missing), J5 (mistake legibility), J6 (no disclosure note) | J2, J3, J7 |
| fig-08-05 | fail | J1 (colour-verdict), J2 (markers), J3 (labels), J5 (mistake legibility), J6 (disclosure), J8 (legibility floor) — entire lines/marks/labels/note layer absent, only the bare road polygon renders (the `adj-doubleapex` all-lines-refused bake) | J6, J7 |
| fig-08-06 | fail | J6 (no disclosure note) | J3 (labels) |

Since the prior round: fig-08-02's `slow_steer` mistake line and fig-08-04's
`overspeed` mistake line now render correctly (J1/J2/J3/J5 flipped to pass or
mostly-pass on both) — this confirms the `fix-render` role-draw-order fix
(rev-render finding 1, design/06 below) was in fact the root cause, not a
separate bug needing its own investigation. fig-08-06's marker-floating
defect (all ~15–20 glyphs scattered in the grass) is likewise gone (J2 now
passes) — the same fix. fig-08-01's turn-point marker glyph and fig-08-03/04's
label/marker misses are narrower, figure-specific residuals, not the
systemic renderer gap the previous round documented.

Common thread across every remaining judge failure: **J6 (diagram-mode
disclosure note) fails on every figure that reaches it** — none of the six
render any compression/projection disclosure text, though the scenes author
`view: mode=diagram` and 06 §2.7 requires "every diagram-mode figure carries
a standard footnote." This is a rendering gap, not scored elsewhere in this
document — **needs-decision**: implement the disclosure-note draw stage (not
currently in `render/topdown.ts`'s 11-stage draw order at all) before v0.1
figures can be considered book-faithful.

**STALE after this run (deliberately not re-baked / re-judged).** *(RESOLVED in the
2026-07-24 post-run: fig-08-03/04/05 WERE re-baked + re-judged — SVGs current, fresh
judge records committed, all six overall `pass`. Kept for provenance.)* Two of the six
scenes changed that run, so the table above no longer describes their current bakes:
- **fig-08-04** — the `adj-fig84` scene edit changes `bad` from `overspeed`
  (+26 → runoff) to `overspeed:by_kmh=2.5` (→ `wide`). The adjudicator's own
  re-bake at +2.5 renders the red line 1055 px wide through the tightening
  (was a 475 px stub) and flips J5 to pass. `figures/fig-08-04.svg` /
  `.judge.json` are stale until the re-bake.
- **fig-08-05** — the solver run's C2 fix made `late` SOLVE (runoff) instead of
  refusing, so the "entire lines/marks/labels absent" note no longer holds; but
  the bake is now blocked at the `correction@late` label anchor (see the design/09
  G-8.5-RED entry). Stale until the fig-8.5 conflict is adjudicated and re-baked.
- **fig-08-03** — unchanged scene, but the solver run's C1 fifty_pence facet-ladder
  fix moved its `bad` bake (11→7 hourglasses); `figures/fig-08-03.svg` is stale.

---

## Ratification items — v0.2 builders (this run)

Collected from the v0.2 builders' `ratification_items`. Most are implemented
decisions recorded for the owner's ratification (`done`); two are declared
deviations left deliberately unrepaired.

- **[05 §7 / 05 §8.1 export figure-spec corridor drop]** *declared deviation,
  deliberately not repaired.* `src/cli/verbs/export.ts` `figureSpecFromEnvelope`
  projects `road: {dsl}` only, so `--as figure-spec` / `--as share-url` / `serve`
  drop `use_full_width` / `bike_margin_m`; feeding that projection back through
  `run` yields `SCHEMA/line_road_differs` (a typed refusal, not a silently wrong
  corridor — pinned in `test/cli/road-marshalling.test.ts`). The repair moves
  `spec_hash`/`result_hash` (measured ac968b→120886 / b8471c→3794aa on the serve
  fixture) so it belongs to `solve/` (run.ts:720's canonical-JSON road equality)
  under a re-bless. **needs-decision.**
- **[05 §7 envelope→corridor marshalling]** *done.* The envelope→corridor rule is
  declared ONCE in `src/cli/verbs/shared.ts` (`roadWireSpec`), and all four
  envelope readers (state/controls/render/export-svg) plus export's `--as
  scenario` branch route through it. No contract defect (no disclosed field is
  missing).
- **[ARCHITECTURE §6.1 inline unit conversions]** *shrink-only ratchet.* Six
  pre-existing sites inline a factor `core/units.ts` should own (solve/chained.ts,
  solve/doubleApex.ts, solve/vis.ts ×2, plan/doctrine/metrics.ts — all
  `(180/π)·atan(...)`; cli/bless.ts — `v_kmh/3.6`), held as
  `INLINE_CONVERSION_KNOWN` in `test/meta/imports.test.ts` with a no-new-offenders
  lint (render/ and viewer/ carry none). Each fix is a one-line import; not taken
  this run (minimal-impact). **needs-decision** (or just clean up).
- **[05 §8.1 / 09 §6.1 warm-cache recompute of mistake lines]** *DONE (landed —
  was "blocked, declared").* `src/solve/run.ts` `runFigure` now honours a
  mistake-sourced line's stamped `solved` plan on the warm path (reconstructs the
  compiled mistake `source` — `kind:mistake`, `base_line_id`, mistakeSpec incl.
  `applied_corners` recovered by a plan-diff of the cached plan vs the base line —
  and routes it through `classifySolvedCache` + `executeCachedPlan`, PRESERVED so
  `spec_hash`/`result_hash` round-trip; double-guarded by `spec_hash` match AND
  replayed `outcome`/`result_hash == expected`, any miss re-solving via
  `compileMistake`). Measured: fig-08-06 `premature@all` warm → `bad.cache="hit"`,
  `result_hash f5fbeb` / `spec_hash ef0884` byte-identical to cold, warm recompute
  238→30 ms; `test/cli/controls.test.ts` 10/10, `C-RECOMPUTE-BUDGET` GREEN, no golden
  roster moved. Provenance caveat for the design owner: the plan-diff reconstruction
  is faithful for the turn-in family (premature / premature_contained / fifty_pence —
  the only warm mistake cache the committed figures exercise); whole-line kinds
  (slow_steer / overspeed / chop) leave the plan's turn_ins untouched, so the
  reconstruction under-determines the source and the line correctly re-solves through
  `compileMistake` (recording its native `cache="absent"`) — unobserved on any
  committed figure, and the double guard keeps every path correct regardless. The
  cleaner design fix (exclude the solver-output `applied_corners` from the hashed
  `source` in `solve/mistake.ts` so the raw `MistakeSpec` reconstructs the key
  trivially) would move every mistake-sourced golden — a re-bless event, flagged.
- **[05 §4 / 07 §3.4 domain-end policy]** *done.* The choice is made once: `stateAt`
  / `dualAt` REFUSE `BAD_RANGE`, the viewer stepper CLAMPS (through the one
  `clampTo`). Pinned in `test/viewer/onecore.test.ts`.
- **[07 §3.1 / §6.2 viewer purity exemptions]** *done.* `src/viewer/host.ts`
  (performance.now + timers, per 07 §3.1 playback) and `src/viewer/boot.ts`
  (top-level `bootFromPage`) are declared, self-documenting purity/side-effect
  exemptions, fenced and asserted as exact sets in `test/meta/imports.test.ts`.
- **[TASK ownership] no `src/render/saveWindow.ts`.** The save-window overlay
  correctly lives under `src/viewer/` (stepper-only, out of the exported picture);
  a `src/render/saveWindow.ts` would fail `C-SAVEWIN-NO-INK`'s structural arm. The
  original task line naming that file was stale relative to the shipped tree.

---

## Summary for the design owner

**Resolved this run** (four AMEND-DESIGN adjudications applied + open-question
sweep — see the top-of-doc section): `adj-savewin-table` (open_count status
table), `adj-tshot-grid` (two-case reaction-budget proof + v_max-scoped
G-SAVEWIN-GRID), `adj-warn-band` (structural clean∧warn emptiness → na-cap rung-3
witness; `G-STANDING-BITES` AMBER→GREEN), `adj-fig84` (fig-8.4 bad → marginal
overspeed → `wide`); plus the `core/stateAt.ts` angle-lerp range-normalisation
fix. No goldens/hashes moved.

**Needs an actual decision** (roughly in priority order):
0. ~~fig-8.5 `late`: refuse or solve?~~ **RESOLVED (this run) by `adj-fig-08-05`**
   — `late` SOLVES `runoff` (Option (2) ACCEPT RUNOFF); design letter amended, no
   src change (the block was already published, no bookmark on
   `departed_before_reaction` — `run_wide_detect` is the on-line anchor). Residual:
   the `test/golden/scenes.test.ts` G-8.5-RED re-pin (out of that task's grant) and
   the DEFERRED fig-08-05 re-bake (spec_hash 4744ed→2e21e4).
1. C30 entry speed: 70→63 km/h (or retune the tuning) — `adj-feasibility`.
2. Recipe-a/b/f canonical speed: 55→~48 km/h (or retune) — `adj-feasibility`.
3. bookDoubleApex two-touch: reshape the fixture or change the release law —
   `adj-doubleapex`.
4. V2.5 "turn-in at or after release" vs. the wide-commitment reading —
   `adj-vis` (lower-urgency: already has a working implemented reading).
5. `fifty_pence`/`premature_contained` pin-table cells — `adj-corrective`.
6. CHAIN-CLEAN rideability seam (KAPPA_STEP retune or grid change).
7. `chainedSolve`'s "fewest-fails" vs. letter's "gentlest" ranking (rev-solver
   #6 — the other 7 fixable rev-solver findings were fixed this cycle; #10 is
   ratified as-implemented via `adj-corrective`; #12 remains open/unattempted).
8. Rendering: the diagram-mode disclosure note is unimplemented — a genuine
   FUTURE gap for the deferred diagram projection, but NOT a v0.1 judge failure:
   the committed bakes are true-mode, where J6 (projection disclosure) is `na`
   (it applies to diagram mode only), so all six current judge records grade
   `pass`. (Corrected from an earlier claim that "all 6 figure judges still fail
   on it"; that was the 2026-07-23 round's mis-scoring of J6 as `fail` on
   true-mode figures — the 2026-07-24 re-judge scores it `na`.) The note lands
   with the diagram projection implementation.
9. C30-DR: 02 §8.2's `R40→R25` letter needs a ratified replacement.
10. `--brake`/`--throttle`/`--position` zero-file anchor semantics.
11. `render` on a bare envelope can't draw labels — FigureResult contract gap.

**Design-text amendments only** (code is correct, ~15 items — see design/02,
03, 05 sections above): ZOH-vs-in-stage-linear, wrapToPi release predicate,
tracker frame signs, transition table completeness, signed
`steering_complete`, brake-taper hold+release shape, `contained` definition,
`result_hash` third member, rounding-bucket growth, and several 09-table
gaps.

**Done this cycle**: the `fix-solver` and `fix-render` passes recommended by
an earlier draft of this document have now run, mirroring the
`fix-core`/`fix-doctrine`/`fix-contract` work — all 4 rev-render findings
fixed; 8 of 12 rev-solver findings fixed, 2 confirmed-pin by adjudication
(#6, #10), 1 resolved by `adj-vis` (#3), 1 still open and unattempted (#12,
chained interior exit-targeting/braking ranking proxies — recommend before
v0.2). See design/04 and design/06 above for the per-finding detail.
