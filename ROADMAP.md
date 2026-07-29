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

## CLOSED — S15, the rendered placard channel

**Status: built and landed 2026-07-27, commit `84f2320`.**

S15 was never really a two-way question. `design/06 §3.1` draw-order **stage 11** already
listed "figure-level placard boxes" among the renderer's required margin chrome and closed
with *"Placards are rendered elements, never errors"*; `design/01 §8` makes placards part
of every renderer's contract. The letter outranks `SCOPE.md`, so the "maybe the gallery is
the sanctioned surface" branch was dead on precedence. The stage had been specced and
never built.

An opt-in top-level `placards:` scene key — and its FigureSpec JSON twin, because
`fig-11-TB` is JSON not `.scene` (S28) — now carries an ordered list of author-supplied
strings to wrapped neutral-ink `<text>` boxes at stage 11 **and** to a `placards` array on
the export manifest. The manifest half is not courtesy: `J7` "no fabrication" fails any ink
the manifest does not declare. `note:` is unchanged and stays a caption.

The key is **omitted when absent, never `[]`** — `spec_hash` covers the lowered form, so a
defaulted key would have moved the identity of all six committed figures. It did not: all
six re-bake byte-identical at their committed stamps, and two consecutive `bake:ch8` runs
move zero tracked artefacts. Gates: build ✓ typecheck ✓ 53 files / **1426 pass** (+15) /
4 todo / **0 red**, with no test deleted or loosened. Amended `design/03 §8`, `04 §7`,
`06 §3.1` stage 11 and `06 §7`; author-supplied placard text is a genuinely new category,
every other placard the letter names being a design-owned verbatim string.

---

## CLOSED — the first two doctrine figures. Both refused, on disclosure.

**Status: attempted in full 2026-07-27. `chop` and `overread` do not ship.**

With S15 landed, candidates 1 and 2 were authored, baked, adversarially reviewed, repaired
against every finding, and reviewed again by fresh skeptics — two full rounds, four
independent reviews. **Both cleared merit decisively and both were refused on disclosure.**

| round | `fig-09-D1` (chop) | `fig-08-D2` (overread) |
|---|---|---|
| 1 — merit | **refuted** (tuning rationale; a leg claim the corpus refutes) | **refuted** (named the wrong consequence; hid the direction that matters) |
| 1 — disclosure | cleared | cleared |
| 2 — merit | cleared | cleared |
| 2 — disclosure | **refuted** | **refuted** |

Neither figure was ever weak on the *engine*: G1 holds (every line solved), S27 holds with
room — `throttle_rule` fails across the entire admissible `slew_mss` band 9–100, and
`out_in_out`'s crossing sits at 98/99° with 0.66 m of lane in hand, nothing like the 27 cm
knife-edge that killed `fig-08-D1` — and both fail sets are unique against all twelve
committed lines. What killed them, four times over and never twice on the same sentence,
is one failure mode: **a true number carrying a false implication, stated in the direction
that flatters.** Each repair fixed the named defect and exposed a fresh instance.

The two repairs worth keeping on the record, because they were real improvements that
still did not save the figures:

- **`chop`'s parameter went the other way from the roadmap's advice.** This section
  previously said "admit with `chop:slew_mss=20`". A 40-value sweep refuted that: the
  seam-reduction rationale does not survive (`rideability` is non-monotonic and passes only
  at the very bottom), `wide` occupies ~2 units of an ~84-unit band, and the departure the
  figure draws is what the chop does on ~94% of it. The repaired figure went back to the
  **catalogue default**, which also restores `design/03 §7.1`'s *pinned* outcome
  (`runoff`). Tuning for the picture and disclosing it as tuning for honesty is exactly
  what the first review caught.
- **`overread` named a consequence that moves with an invisible knob.** Its placards said
  the lesson was exit speed, "which a plan view cannot draw". Both halves are false: at
  `r_believed=11` the verdict is identical while the speed delta collapses from 4.36 to
  **0.04 km/h**, and the consequence that *is* invariant — the line never comes back out,
  `exit_f` 0.31 against the 0.55 bar — is precisely what the plan view does draw.

**Three findings outlast both figures**, and are worth more than they would have been.
Full detail in `figures/SCOPE.md` §4 S29–S31 and `linelab/DEVIATIONS.md`:

1. **`out_in_out` advertises four legs and has two live ones on any first corner** (S29).
   `ti_f = 1` *exactly* on all twelve committed `c1` rows — `f = 1.0` is the solver's
   default start state and no `ride`/`mistake` sugar emits a lateral action — and given
   that, the swing leg reduces to `apex_f ≤ 0.60`, strictly weaker than the apex leg's own
   `0.45`, so it can never bind. S27's species, but arithmetic rather than statistical.
2. **`out_in_out`'s three bars are `TUNING`-sourced** while the same pack's `late_apex` bar
   is `book:`-sourced (S30). The check is book-warranted; the number that decides it is
   not. A sharper form of the ground that killed `fig-08-D1`.
3. **`SCOPE.md` §4 S27 contains a factual error, now corrected in place.** Its claim that
   three of `throttle_rule`'s four legs never appeared in `missed[]` is false: `roll_on`
   appears on **nine** committed rows across figs 8.5/8.6, including both ideal lines. A
   figure drafted on the wider claim asserted it *in rendered ink* — the first time the new
   placard channel caught a false claim that scene comments used to hide.

---

## CLOSED — S31 is decided. The bar is reachable on a *sentence*, not on a *figure*.

**Status: settled by experiment, 2026-07-28. The minimal-claim hypothesis was built,
baked and attacked. It does not converge, and the reason is now specific.**

S31 asked whether the doctrine-figure disclosure bar is reachable by iteration at all.
The previous pass ended on a hypothesis rather than an answer — *fewer placards on a
simpler claim* — so this pass built exactly that and attacked it. Two candidates
(`fig-08-D3`, the throttle chop carried by `throttle_rule`; `fig-08-D4`, the timid line
carried by `out_in_out`), authored at 2 and 3 placards against the previous round's five
and six, each with a teaching sentence that is precisely what its carrier grades.
**Neither ships. Eight independent reviews now stand behind that.**

The minimal-claim hypothesis is **half right, and the half it gets wrong is the half that
matters**:

- **A single sentence *can* be repaired to survive.** `fig-08-D3`'s killed sentence was
  rewritten once, on the first attempt, and held against the reversal test and the
  student-conclusion test. `fig-08-D4`'s S30 provenance placard was rewritten once and was
  explicitly cleared by the lens that had killed it. That had never happened before, and it
  disposes of the strong reading of S31: the bar is not unreachable in principle.
- **A whole figure cannot be, because the failure is conserved and migrates.** Round 3 did
  not produce a fourth instance of the same defect in the same place. It produced kills on
  three surfaces the previous rounds never reached: the figure's **own filename**, a
  sentence the previous round had already **cleared**, and the **renderer's marker
  defaults**. Fixing the surface you are iterating on relocates the defect rather than
  removing it.

| | round 1 | round 2 | round 3 (minimal claim) |
|---|---|---|---|
| `chop` / `fig-08-D3` | merit ✗ | disclosure ✗ | disclosure **repaired ✓** — killed on **remit**, in the figure_id |
| `overread` / `fig-08-D4` | merit ✗ | disclosure ✗ | merit ✓✓, S30 repair ✓ — killed on a **previously-cleared** placard, and on **ink the placards cannot reach** |

**Two of the eight kills are on surfaces no placard reaches at all**, which is the
finding that ends the iteration argument. A placard channel cannot disclaim a filename,
and it cannot disclaim a marker the renderer declined to draw.

### What killed round 3, specifically

**`fig-08-D3` — refused on remit, by its own author, and it exposed a contradiction in
the granting instrument.** `throttle_rule`'s `book_ref` is `"Total Control ch. 9, Throttle
Control"` — the **only** ch-9 `book_ref` among the pack's sixteen checks; twelve are ch. 8.
`design/01 §4.3` maps `chop` to "Ch. 9 throttle doctrine", and `§A.3` introduces the check
as *"(Keith Code Rule #1)"*, the one check in the catalogue not attributed to Parks. So
S12's grant — *"Chapter 8 doctrine only"* — excludes it. **But this roadmap's own candidate
table admits it by name, twice, as row 1.** The grant's scope sentence and the grant's queue
disagree about exactly one artifact. Recorded as **S32**; it is the design owner's to
resolve, and the author was right to refuse rather than read his own licence in the
direction that authorises his own figure.

The identity problem is independent and sharper: `fig-08-*` is the corpus convention for
Chapter 8, and it is the manifest's `figure_id`. `fig-08-D3` is a true token (it *is* on
`book90`) carrying a false implication (that its doctrine is Chapter 8's). `fig-09-D1` is
honest and outside the grant on its face. **Neither name is available, and no placard
reaches a filename.**

**A repair brief written from adversarial findings would itself have been the seventh
kill.** The attackers' proposed wording — *"drive withdrawn at 40 m/s³ against the 8 m/s³
bar"* — is the same species it was meant to cure: the **ideal green line in the same
figure** reaches `a_cmd_rate` = −12 m/s³ against that 8 m/s³ bar and `throttle_rule` grades
it *"throttle rule held"*. A student told "40 against the 8 bar" concludes "faster than 8
fails", and the green line beside it refutes that at 12. The bar is not the discriminator;
the **guard** is (`|phi| >= SMALL_LEAN_DEG` *and* the loop starting at `steering_complete`).
The author caught this and led with the guard clause instead. Two lessons: the discriminator
of a check is often not its bar, and a repair brief is not evidence.

**`fig-08-D4` — cleared on merit twice, killed on ink.** Its merit lens swept every integer
in the admissible band 99..169 (71/71 `fail`, exit clause the sole violated clause at every
one, `ti_f` = 1 throughout) and cleared it; the road is `design/03 §7.1`'s own `overread`
oracle fixture. It died on two grounds that are both about **what the picture says without
sentences**:

1. **"Never comes back out to the outside of the lane" teaches a standard that does not
   exist.** The colon offers the sentence as the ground of the verdict, so the reader learns
   that `out_in_out` requires returning to the outside of the lane. It does not — and this
   is now measured on committed ink (see S33): `OIO_OUTSIDE_MIN` = 0.55 lands at
   **d = −1.885 m, 13.5 cm past the middle of the rider's own lane** and 1.615 m short of
   its outer edge, i.e. **53.9% of lane width**. A line finishing mid-lane passes "exit
   wide". Worse for the figure: the *ideal* line it holds up also never reaches the outside
   of the lane (exit d = −2.69, 0.81 m short), and `f` = 1 is itself 0.4 m short of the edge
   — **no line linelab can draw ever reaches the standard the sentence names.** And the
   figure hands the reader the ruler: the scale bar prints "lane 3.5 m wide" and both lane
   edges are stroked.
2. **The markers teach the reverse of the record.** With `marks:` unauthored the renderer
   draws turn point, apex, release and exit on the **ideal line only**. A rider reads that
   absence as *"the mistake line never apexed"*. The record says its apex was **later and
   deeper** than the ideal's — 87.5% of sweep against 66.3% — and that it **passed**
   `late_apex`. This sits on committed ink too (**S34**): figs 8.4 and 8.6 draw no marker at
   all on their mistake lines, and fig 8.6's unmarked red line *passes* `late_apex` at c1.

### What this run says to do instead

Stop authoring candidates and **repair the substrate**. Every round-3 kill was a real
defect, and three of the four are in the engine and the renderer rather than in any
sentence. The `out_in_out` cluster is now **four** defects, not the three the previous
NEXT listed, and it is the carrier of two of the seven candidates.

---

## CLOSED — S11: the lint now refuses what the bake refuses

**Status: built and landed 2026-07-28.**

`check <file>.scene` returned `{"valid":true}` on a super-tight road while `check
<scenario>.json`, `run` and `figure` all returned `OUT_OF_SCOPE`/`super_tight_geometry` —
the lint green-lighting a road the bake then refused, which is the damaging direction for
G4. `design/01 §8` puts that regime *"rejected `OUT_OF_SCOPE` at validation"* and
`design/08` specs `check` as validate-only, *"same code path as `figure --check`"*, so this
was adjudicated a **defect, not a design question**: no amendment was needed.

The divergence turned out not to be between two file extensions but between the *figure*
door and the *scenario* door — the FigureSpec JSON spelling shared the weakness, since the
scene lowers onto it (D30). The lint had no road build of its own. The world validation is
now **one declaration** — `validateFigureWorld` in `plan/validate.ts`, called by the bake
(`composeWorld`) and by the lint (`lintFigureSpec`, the only thing `check` and
`figure --check` now call) — so the two cannot diverge again. Every spelling of the same
super-tight road now returns the byte-identical typed error at exit 2.

The fix only ever refuses **more**, and that is pinned rather than asserted: the four new
tests include a guard rail asserting all six committed scenes still lint `valid` **at the
`spec_hash` their baked manifests carry**, and three of the four were confirmed red on a
worktree build of `HEAD` before the fix. Gates: build ✓ typecheck ✓ 53 files /
**1430 pass** (+4) / 4 todo / 0 red; two consecutive `bake:ch8` runs moved zero artefacts.

---

## CLOSED — work order 1: the marker defects. Both landed; the suite is red on purpose.

**Status: shipped 2026-07-28.** *The red this section describes was cleared on 2026-07-29
by work order 0's re-judge — see the CLOSED section above. Everything below is left as
written, including its closing instruction, because its reasoning is why the red was allowed
to stand for a day rather than be restamped away.*

Both defects were letter-decisive and both are fixed, with no design text moved and no
constant invented.

**The collapse test was in the wrong place, not carrying the wrong number.** The letter's
sentence opens *"after projection"* (`design/06 §3.1` L404), so the rule belongs to the
renderer — and `pxScale` is born from `boundsOf(scene)`, which reads `scene.markers`, so
asking for it during derivation is **circular**. `deriveMarkers` now returns the
uncollapsed event set, and a new pure `collapseCoincident(markers, glyphRadiusDrawn,
rankOfLineId)` runs at draw time against `pxScale * MARKER_R_PX` — *the identical
expression `markerGlyphSvg` draws with*, so the predicate and the picture cannot drift.
`MARK_COINCIDE_EPS_M` still owns the station test at 1.0 m, untouched.

Measured delta on committed ink: **exactly one `<circle>` appended to `fig-08-05`'s
stage-9 group** — the `early` line's apex at s = 25.0, which the engine had recorded and
declined to draw. The other five figures re-bake byte-identical; `manifest.json` and every
`spec_hash` are unmoved. **Two further defects fell out of the same repair**, neither
suspected when the work order was written: the pair test now runs against the cluster
*seed* rather than `some(member)`, which had been admitting markers transitively through
members they never overlapped; and collapse now runs *after* the window crop, so an
out-of-window marker can no longer seed a cluster and delete in-window glyphs with it.

**The per-line `marks=` / `label=` override now exists**, exactly as `design/03 §8` and
`design/04 §7` specify and as nothing implemented. Both keys are omitted when unauthored —
never defaulted — so all six `spec_hash` stamps are unmoved, on the `placards` precedent.
And the instrument S34 actually wanted works today, verified by baking it:

```
lines:
  good:    ride entry=34 turnIn=auto marks=none
  bad:     mistake premature:early_by_m=6
marks:     apex
```

→ one glyph, on the mistake line. You do *not* write `marks=` on the mistake line — scene
text puts `key=value` args on `ride` entries only — you enable the class at figure level
and silence it on the ride line. A reviewer tested the wrong idiom and reported the
capability unreachable; it is reachable, and this is how.

**Gates: build ✓ typecheck ✓ 54 files / 1460 pass (+30) / 4 todo / 2 red · bake ×2
byte-identical ✓.** The two reds are one fact, and they are the tripwire working:
`fig-08-05`'s picture changed by one glyph, so `figures/fig-08-05.judge.json` is now a
record of an image that no longer exists. It was left un-restamped **deliberately** —
`tools/restamp-figures.mjs` would clear both by rewriting `svg_fnv1a` alone, and its own
header says that leaves the record *"structurally valid and semantically stale on
purpose"*. Going green that way is the move the guardrails forbid. Clearing it honestly
needs a re-judge, which is blocked on **S36** — the new top of `NEXT`.

---

## CLOSED — work order 0: the rasterizer is built and the judge loop is closed.

**Status: shipped 2026-07-29. The suite is green — and `fig-08-05` now records a
`fail`. Those two facts are the same fact, and the second is the point.**

`design/09 §7` step 2's headless-browser rasterizer existed in the design and nowhere
else. It exists now: `linelab/tools/rasterize-figures.mjs`, **puppeteer 25.4.0** driving
the version-pinned Chrome for Testing it downloads (`browser.version()` =
`"Chrome/151.0.7922.47"`), 2× on white, a manifest that names its own engine, non-zero
exit on any render failure. **Which rasterizer was never the owner's call** — §7 step 2
and `§9` L2360 both say *headless browser*, and the letter outranks convenience, so
`resvg` and `sharp` were excluded on precedence rather than on taste. D1 holds: it is a
`devDependency`, `linelab/package.json` has no `dependencies` key at all, and nothing
under `src/` or `dist/` imports it. Everything decidable without a browser lives in
`tools/raster-core.mjs` behind 54 pure tests; the driver is invoked by hand like
`restamp-figures.mjs` rather than from `bake.sh`, because Chrome's PNG encoder being
byte-stable is a property this repo had never measured and the determinism ceremony must
not come to depend on it.

**The rasterizer's first act was to indict its own predecessor.** Measured, not inferred:
the committed `fig-08-05.2x.png` is a 2000×2774 canvas whose ink stops at (999, 1386);
`fig-08-01`'s stops at (999, 1146) of 2000×2294. The prior, unreproducible step rendered
at **1× onto a 2× canvas**, so rubric item J8 — *"lines distinguishable and text readable
at the 2× raster"* — was graded throughout the 2026-07-25 ceremony on an image at half the
linear size the rubric names. Only `fig-08-05`'s rasters were regenerated; replacing the
other five would destroy the evidence their still-valid records were judged on.

**And judging a real 2× raster immediately found a defect three days of green had hidden.**
`fig-08-05`'s `30 m` direction-ladder label is **completely swallowed** by the callout *"no
geometry left for c2 - off the outside edge"* — same baseline to within 0.006 user units,
`text-anchor="end"`, zero glyphs surviving, while `10/20/40/50/60 m` are all crisp.
Confirmed in the main loop by cropping the raster at the label's own projected pixel
position. The label is *drawn and then buried*, so no element-inventory check could ever
have seen it; only a picture can. Two of three passes graded J8 `fail`, so the record
carries `verdict: "fail"` — which `T-JUDGE-RECORD` permits by design (*"failed criteria are
honest findings"*). **Filed as S37, as a STOP and not a repair**, because `design/06 §3.1`
stage 10 makes label boxes repel *"each other and the road ink"* and says nothing about
stage-8b line chrome: the letter is silent, which is the row of the authorization table
that forbids touching the renderer.

Two rubric items came back **flaky**, which `§7.4` makes rubric defects rather than figure
defects: J5 (pass/pass/`na` — the rubric never says J5 applies to every figure drawing a
mistake line) and J8 (pass/fail/fail — the rubric never says *at what magnification*
"readable" is decided, which is exactly the ambiguity the 1× raster hid). Both are
recorded rather than smoothed.

One further defect was caught and fixed inside this work order: "2×" had been implemented
as a fixed 2000 px target. On this corpus that *is* 2×, but `src/render/fallback.ts`
declares 400×120, which the fixed target would enlarge 5× and write out as `.2x.png` — a
file name asserting a scale the file does not have. `RASTER_SCALE = 2` is the input now and
2000 px the pinned consequence; both rasters re-render byte-identical across the change.

**Gates: build ✓ typecheck ✓ · `T-JUDGE-RECORD` green on all six · `tripwire` green ·
`test/tools/raster-core.test.ts` 54/54 · bake ×2 byte-identical ✓** (zero moved artefacts
under `out/chapter-08/` and `linelab/figures/`). Nothing was restamped, and no test,
threshold or golden was weakened. **Read the flakiness note below before you believe any
red**: this pass hit 600 s timeouts on the two heaviest CLI bakes at a load average of 23,
with two unrelated macOS daemons pegged near 100 % — the same class the note describes, an
order of magnitude worse. The bake itself then ran clean twice.

---

## CLOSED — work orders 0b, 2 and 3. Three packets landed; nothing was built, and that was the job.

**Status: done, 2026-07-29.** All three items were measure-and-record items whose
authorization row forbade an engine change, and none was taken. **No file under
`linelab/src`, `linelab/test`, `linelab/verify`, `figures/*.scene` or any committed
SVG / envelope / judge record was touched, and nothing was re-baked or re-judged.**
The deliverables are `figures/SCOPE.md` §4 (S20, S29, S32, S37 re-stated; S38 and S39
new) and a new `linelab/DEVIATIONS.md` section.

### 0b — the S37 census. One collision in eighty pairs, and the entry's own reason was wrong.

The census the roadmap asked for exists. All six committed SVGs, stage-8b chrome
(`data-ladder-label` / `data-entry-label` / `data-outcome-word`) against stage-10
callouts: **56 chrome texts, 32 ladder numerals, 9 callouts, 80 pairs → 1 buried, 0
grazed, 0 near, 79 clear.** Measured four times independently — two census agents, an
adversarial recount that re-derived the box model from scratch, and a main-loop script —
with every per-figure bucket matching. The one burial is the filed one. **`fig-08-02` and
`fig-08-06` emit `<g data-stage="10-labels"></g>` empty**, so two of the six zeros are
arithmetic rather than evidence that the placer succeeded.

Three findings outrank the count:

1. **S37's stated reason is refuted.** The entry said the letter is *silent* because a
   ladder label is stage-8b chrome and not in stage 10's obstacle set. But the buried
   numeral's whole span and the burying callout's anchored end both sit **inside the
   stage-2 road-surface polygon**, and `design/06 §6.1` gives *"road ink"* its only defined
   referent as that polygon. The collision is reachable through the letter's **own** second
   obstacle member. It is still a STOP — for a stronger reason.
2. **There is no repulsion pass to extend.** `render/topdown.ts:683-692` says so in its own
   docstring; the entire layout is two booleans and one fixed diagonal step with no overlap
   test against anything, and `render/labels.ts:7-12` disclaims it from the other side. Each
   file defers to the other. Measured consequence: **9 of 9 committed callouts overlap the
   road surface**, five of them at ≥ 99.67 %. On the letter's stated obstacle set the engine
   is at 0 % compliance. Filed as **S38**, `needs-decision` in `DEVIATIONS.md` — and *not*
   fixed, because the letter names no candidate set, no score, no weights, no order, no
   tie-break, no fallback and **zero TUNING constants**, and its one named destination
   (`§2.4` aspect-floor padding) exists on **no committed figure** — all six `frame_aspect`
   values sit inside `§6.1`'s band. Conformance entails the boxes move; it does not say
   where they land.
3. **The class is wider than the question.** On `fig-08-06` the `90 m` label's unit glyph is
   half-eaten by a **stage-9 marker disc**, on a figure with **zero callouts**. Found in
   pixels, confirmed by a marker-aware probe, invisible to any `<text>`-vs-`<text>` census
   and unreachable by *any* stage-10 obstacle set. Option (a) fixes one of the two observed
   cases.

Cost per option, measured: **(a)** ceiling 4 of 6 figures, 0–4 re-bakes + 0–4 re-judges, 0
`spec_hash` moves, exact count **unmeasurable** because the letter does not determine the
pass; **(b)** deletes exactly 1 of 32 numerals, 1 re-bake + 1 re-judge, breaks nothing
mechanical, but punches a hole in the figure's single distance scale; **(c)** one scene
token (`-2` offset — the grammar already supports it, the burial is exactly one sample
wide), and it is the **only** option that moves a `spec_hash` (37e73d → bcec5c) and
`figures/manifest.json`. A run may not pick one.

The J8 magnification flake is filed as **S39** with the batching recommendation: tightening
it bumps `rubric_version`, invalidates every record and triggers a full `§7.4` six-figure
ceremony — which the five 1×-ink figures already need for an unrelated reason, so the two
should ride one commit instead of paying the six-figure price twice. A free result fell out
of the raster cross-check: `fig-08-05`'s two committed PNGs are **SHA-256 identical** to a
fresh rasterizer run, so that output is byte-stable on this machine.

### 2 — the `out_in_out` cluster. S20 and S29 brought to the same bar as S30/S33/S35.

Both are now three-part entries — what the letter says, the live remainder, the options
with their measured consequence — and both were **re-classified by checking the letter**,
which is the point of the exercise:

- **S20 is not a defect.** `§A.3` check 2's predicate (L613-616) has no upper bound on
  `exit_f` and `checks.ts:338-343` implements it term for term. Its own prose four lines
  later (L619-622, *"typically fails the exit leg"*) predicts the opposite — so **check 2
  contradicts itself**, and the engine follows the arithmetic half, which `§A` L446-447 calls
  the appendix's normative content. The owner picks a half. Corrected reach: **all four**
  mistake lines of figs 8.1–8.4 carry `exit_f = 1.148`, not the two the entry named. And
  **answer S35 first** — it is the cause, and it resolves the headline number without
  touching the predicate.
- **S29 is not vacuity.** `§A.2` L538-539 pins the doctrinal turn-in at `rider.start.f =
  1.0`, so `ti_f = 1` on a first corner is the letter's own picture, and the dead legs are a
  **redundancy the letter authored**. Two supports: check 2 waives legs where it means to
  (L617-619, chain mode) and does not waive this one; and `A-CATALOGUE-EXERCISED` is scoped
  per check **id**, which `out_in_out` satisfies. Nothing mechanical is broken. What survives
  is the **placard** question, which is S30's and S33's surviving half too — the three should
  be answered together.

### 3 — S32. The packet is complete and the decision is recorded pending.

Audited clause by clause against the "Done when". Four gaps closed: option **A** now carries
its operative defining sentence (*a figure is Chapter 8 doctrine iff its road and teaching
sit inside `design/01 §4`–§6*) — which is also what would land in `design/01`; **C** and **E**
carried no consequence at all and now do (E is the only option that answers half (ii) without
admitting a `fig-09-*` token); **D**'s consequence was displaced into a corrections bullet.
The deferral sentence pointing the reader at `ROADMAP.md` for the consequences is deleted —
that was the Done-when's specific complaint, and it pointed at a file whose own header
disclaims authority. All three load-bearing empirical claims were re-verified: `throttle_rule`
is the only ch-9 `book_ref`, exactly **twelve** of sixteen are ch. 8, and `gate.test.ts`
hard-codes the six ids — in **four** places, not one (`:66`, `:236-240`, `:71-76`, `:203-208`).

---

## NEXT — the owner's desk, then the ceremony

**Status: open, 2026-07-29.** Everything below needs a decision this project's runs are
not authorized to make. **Nothing in `NEXT` is buildable by a run today** — that is the
honest state, not an oversight, and it is what three measured packets bought.

1. **S38 — is stage 10's pass built, amended, or retired?** The prior question to all of
   S37. Three answers are on the table: amend `design/06 §3.1` to specify a buildable pass
   (candidate set, score, weights, order, tie-break, fallback, constants); retire the
   sentence in favour of the one-candidate placement the engine ships, which makes
   `stageLabels` conformant and closes S37 option (a) outright; or keep the sentence and pin
   the property mechanically, which needs the export manifest to record callout boxes first.
2. **S37 — then the mechanism, (a) / (b) / (c),** with the costs above. Note that no option
   reaches the `fig-08-06` marker-over-chrome case.
3. **S39 + the five-figure 2×-raster re-judge as one `§7.4` ceremony.** A human arbiter is
   required on any pass→fail flip, so a run cannot perform it.
4. **S35 — what is the exit sample when the line left the road before the corner ended?**
   Answer this before S20; it subsumes most of it. Check 9 `exit_containment` already has a
   rule for the same termination, which is the strongest argument available.
5. **The figure-authoring placard rule** shared by S29, S30 and S33: may a figure rest its
   verdict on a `TUNING` bar, what must it say, and may it recite leg counts it did not
   measure?
6. **S32 — the grant's scope (A/B/C) and naming (D/E),** and it must land in `design/01`,
   not only here.

If the owner is not answering yet, the unblocked work is in `Backlog` — item 1 (author real
roads) and item 2 (the four deferred design-letter items) are both buildable without any of
the above.

---

## The three items above, as they were specified before they closed

**Status: superseded 2026-07-29 by the CLOSED section above.** Kept for the authorization
rule, which still governs, and for the specification each item was executed against.
Each item says what it is, what the design letter permits,
what a run may do without asking, and what "done" looks like. **Work orders 0 and 1 have
both shipped — the judge loop is closed, so changing what a figure draws is no longer
blocked.** What replaced work order 0 at the top is the defect that closing the loop
found: S37, which is a genuine owner decision and whose blast radius nobody has measured.

### Read this before touching any of them: the authorization rule

These three items are the shape where doing the work correctly can turn **committed,
shipped, green** ink red. The ordinary guardrail ("never weaken a check to turn something
green") points the other way and does not cover it. The test is the precedence order:

| the design letter | what you may do |
|---|---|
| **decides it normatively**, and the engine deviates | it is a **defect** — fix it, even if figures re-bake and goldens move. `design/00`–`09` outranks the corpus. |
| **decides it normatively**, and the engine conforms | there is nothing to fix. If you dislike the behaviour, that is a **STOP**, not a bug. |
| is **silent**, or the sentence you are leaning on is hedged commentary | **STOP.** Land the measurement, not a change. |

*Normative versus descriptive is the whole call, and it is the easiest thing to get wrong
in the direction that authorizes your own work.* Classify from the letter **before** you
measure a blast radius — a big blast radius makes a defect feel important, and that is not
evidence about what the letter says. Template 4 in the `next-steps` skill's
`references/workflow-templates.md` encodes the procedure.

### ~~Work order 0b — S37, the swallowed ladder label.~~ DONE 2026-07-29 — census landed; see the CLOSED section above.

**Authorization: none to touch the renderer.** `design/06 §3.1` stage 10 says label boxes
*"repel each other and the road ink by a simple candidate-position scoring pass"*. The
buried `30 m` label is neither: it is **stage-8b line chrome** (D47's direction ladder),
drawn from the line rather than the road. The letter is **silent on this collision**, which
is the third row of the table above. The deliverable is a measured packet, and a measured
packet attached to a STOP is a result.

Full statement in `figures/SCOPE.md` §4 S37. What a run may land:

- **The measurement, which is the missing piece.** For each of the three options S37
  names — (a) extend stage 10's repulsion set to stage-8b chrome, (b) let the ladder
  suppress a label a callout covers, (c) treat it as an authoring collision and move this
  one callout — how many committed figures move an SVG byte? Recompute by hand from the
  committed SVGs: for every ladder label on all six, does any callout box overlap it?
  `fig-08-05` is known; **the other five are unmeasured**, and that number is what decides
  whether (a) is a one-figure fix or a corpus event. Remember what a move costs now: an SVG
  byte moving means a re-bake **and** a re-judge of that figure.
- **Do NOT pick an option, and do not edit `render/` to try one.** If you find yourself
  changing the label-layout pass, stop.
- **Done when:** S37 carries the per-figure overlap census and a cost per option, and this
  roadmap records the cluster as an owner decision.

**A cheaper question worth answering in the same pass, because it is the same census:** the
rubric flake on J8 is that *"readable"* names no magnification. `§7.4` calls a flaky item a
rubric defect to tighten. Tightening it is a `verify/judge.json` edit, which invalidates
every record and triggers a **full `§7.4` six-figure ceremony** — so it should be batched
with the other five figures' re-judge on true 2× rasters (see the CLOSED section), not done
alone. Say so explicitly when you file it; the batching *is* the recommendation.

### Corrections first — three things this roadmap asserted on 2026-07-27 and got wrong

They were written from measurement without checking the letter, which is the same species
of error this project keeps catching in figures: a true number carrying a false
implication. Corrected here so nobody executes on them.

- **S33 is two-thirds retracted, and was never a defect.** The exit station sampled 7–9 m
  past the corner is exactly what `design/01 §A.2` L504-507 defines — *"the sample at the
  RECORDED exit event (§4.1's heading-capture deadband `EPS_EXIT_DEG` = 1.0°)"* — and the
  corner window `W_c` (L497) ends at that event, not at `s1`. And `f` = 1 falling 0.4 m
  short of the physical edge is the bike margin working as specified (`§4.1` L126-127,
  `§4.2` L149-151: *"the usable corridor is the rider's own lane minus a bike margin,
  because the outside of the road is the oncoming lane"*). `EPS_EXIT_DEG` living outside
  the pack is likewise **mandated**, not sloppy: `§A.6` requires that loading a different
  pack never move samples, events, `outcome` or `spec_hash`, which a pack-bound exit
  deadband would. **Live remainder: only whether `OIO_OUTSIDE_MIN` = 0.55 is the right
  bar.** That is a threshold in the normative appendix — a STOP, not a repair.
- **S34's premise is refuted by our own corpus.** The letter is not silent: `design/04 §7`
  L1903-1906 says *"`auto` (default) draws all classes on `ideal`-role lines only"*, and
  `render/markers.ts` implements exactly that. And **an author can already mark a mistake
  line today, in scene text alone** — a figure-level `marks: all` or class list enables
  that class on *every* line regardless of role, which is what figs 8.1, 8.3 and 8.5 do on
  committed ink. This roadmap's "a renderer default, so an engine/design question, not a
  scene fix" was wrong. S34 is mostly an **authoring guideline**.
- **fig 8.2 is not an S34 instance at all.** Its `slow_steer` line perturbs roll rate, not
  turn point, so both lines record `turn_in` at s = 6.974 at the identical drawn point; the
  documented coincident collapse fires and "ideal wins ties". It is pinned green by
  `A-FIG82-SINGLEMARK` (`design/09 §5.4`). The parenthetical filing it under S34 was a
  misattribution.
- **S30 is resolved against the finding.** `design/01 §A.6` L961-963 forbids the remedy
  outright: *no threshold marked `TUNING` anywhere in the design of record may carry a
  `book:` source in any pack.* The pack is byte-correct and there is nothing to fix. What
  survives is a figure-authoring policy question, folded into work order 2.

---

### ~~Work order 1 — the marker defects.~~ SHIPPED 2026-07-28 — see the CLOSED section above.

*Kept for its evidence, which the CLOSED section does not repeat. The measurements below
were all confirmed on committed ink before the fix.*

**Why first:** it is the only item here where the letter is normative *and* the engine
deviates, so it is the only one a run may land. It is also the surgical answer to what
actually killed `fig-08-D4`.

**1a — the coincident-collapse drawn-position test is wrong, and it swallows a mistake
line's apex on committed ink.** `design/06 §3.1` L404-406 requires markers to collapse only
when their stations are within `MARK_COINCIDE_EPS_M` = 1.0 m **and** *"whose drawn positions
overlap within one glyph radius"*. `linelab/src/render/markers.ts:110` uses
`MARK_COINCIDE_EPS_M` for **both** tests, and the file's own docstring (L76-80) records the
substitution as a deviation — *"v0.1's stand-in for 'one glyph radius' — no px scale is
threaded to this file by design"*.

Measured on committed ink, and verified in the main loop: `fig-08-05`'s `early` line
records **two** apex events (s = 17.5 and s = 25.0) and only **one** apex glyph is drawn.
The s = 25.0 apex is collapsed into a `good` glyph whose centre is **0.987 m** away, against
a drawn ring radius of **0.2289 m** — 4.3 radii, nowhere near overlapping. Under the
letter's rule they do not collapse. Note the fix does *not* merge `good`'s own apexes at
s = 24.5 and 25.5 either: their centres are 1.041 m apart, so they already survive the 1.0 m
test and survive a tighter one.

- **Blast radius, exact:** `out/chapter-08/fig-08-05.svg` gains one apex glyph. No other
  committed SVG changes. No envelope, no verdict, no `result_hash`, no `spec_hash` — this is
  stage-9 rendering only.
- **Done when:** the drawn-position test uses a glyph radius in world units; the letter's
  sentence is quoted at the call site; the docstring's deviation note is removed because it
  is no longer true; a test pins that `early`'s s = 25.0 apex is drawn and that `good`'s two
  apexes stay separate; `fig-08-05.svg` is re-baked and the one-glyph delta is stated in the
  commit. **Do not** widen `MARK_COINCIDE_EPS_M` to make anything pass.

**1b — the per-line `marks=` override is specified in two documents and implemented
nowhere.** `design/03 §8` L1635 (*"at figure and per-line"*) and `design/04 §7` L1904-1905
(*"overridable per line with `marks=`"*, listed as a ride key) both specify it;
`RIDE_KEYS` in `linelab/src/plan/scene.ts:287-290` carries neither `marks` nor `label`, so a
scene writing `marks=all` on a ride line is rejected `SCHEMA`/`ride_unknown_key`.
Letter-decisive, and it moves **no committed byte** until a scene uses it.

This is the precise instrument S34 wants: it marks the mistake line's apex *without* also
putting release chevrons and exit dots on every line, which `marks: all` would.

- **Done when:** `marks=` (and `label=`, specified in the same sentence) parse as ride keys,
  thread to a per-line `MarkSpec`, and are covered by tests; all six committed figures
  re-bake byte-identical; `spec_hash` unmoved on all six.

**1c — a stale docstring.** `markers.ts:29-30` names figs 8.4, **8.5** and 8.6 as authoring
no `marks:`. `figures/fig-08-05.scene:21` authors `marks: turn_point,apex`. Comment-only.

---

### ~~Work order 2 — the `out_in_out` cluster.~~ DONE 2026-07-29 — S20/S29 packets landed; see the CLOSED section above.

**Authorization: you may not change the engine or the pack for any of S20, S29, S30 or
S33.** On every one of them the engine matches the letter exactly. The deliverable is the
decision packet, and a measured packet attached to a STOP is a *result*, not a failure —
it is what lets the owner answer in one sitting.

What the letter actually says, per defect:

| | status after checking the letter | what remains |
|---|---|---|
| **S20** | `§A.3` check 2's predicate has no upper bound and `checks.ts` L338-343 implements it exactly. The DEVIATIONS quotation is **real** (`§A.3` L619-622, *"typically fails the exit leg"*) but it is **hedged and descriptive**, and `§A.4` L845 says of the same class of prose *"coverage evidence, never a pin"*. So `§A.3` check 2 **contradicts itself**; the engine follows the arithmetic half. | owner picks a side. Capping `exit_f` is new arithmetic → `§A.6` `checks_version` bump + re-bless. |
| **S29** | `ti_f` = 1 on a first corner is the letter's **own** doctrine — `§A.2` L538-539 pins the doctrinal turn-in at `rider.start.f = 1.0`. The dead legs are a redundancy the letter authored. `A-CATALOGUE-EXERCISED` is deliberately scoped per check id, not per leg. | owner decides whether leg-level `na` evidence is wanted (in-hash → six-figure re-bless). Note a bar re-tune only moves *which* leg is dead. |
| **S30** | **Resolved against the finding** — see the corrections above. | figure-authoring policy only: may a figure rest its sole verdict on a `TUNING` bar, and what must it say? |
| **S33** | **Two-thirds retracted** — see the corrections above. | is `OIO_OUTSIDE_MIN` = 0.55 (d = −1.885 m, 53.9% of lane width) the right bar? |

**Plus one genuine letter gap, and it is the root of S20's headline number — new, filed as
S35.** `§A.2` L504-507 says the exit sample for a terminated line with no exit event is
*"corner end"*. For a line that departs the road **before** `s1`, corner end does not exist
on the trajectory. `metrics.ts:292` substitutes `Math.min(w.corner.s1, last.s)` — the
off-road departure sample, at `f` = 1.148. The letter is **silent**, so this is an
amendment gap rather than disobedience, and it is a far better-posed question than
"should the check be capped": *what is the exit sample when the line left the road first?*
Answer that and S20's 1.148 pass resolves as a consequence.

**The blast radius is already measured — do not re-derive it.** Independently recomputed
twice, the second time by reimplementing the predicate from scratch over the raw samples,
with zero mismatches against all 19 graded instances:

| repair | committed lines that flip | consequence |
|---|---|---|
| **R2** — evaluate the exit fraction at `s1` instead of the exit event | **exactly one of twelve**: `fig-08-04` good c1 `pass → fail`, on the exit leg alone | quality `good → caution`, `verdict.ok true → false`, the drawn line turns amber (18 colour tokens), the legend text changes, the figure gate goes exit 0 → 3, and `result_hash` moves on 5 of 12 lines. Golden `G-CORR-WIDE solved` also flips `good → caution`. **A corpus event.** |
| | **figs 8.1/8.2/8.3 ideal SURVIVE** — `f` at `s1` is 0.5764 (nearest sample) / 0.5627 (interpolated) against the 0.55 bar, a margin of 7.13 cm / 3.42 cm | the earlier worry that repairing the station would fail the book's own good line is **false** — but it is true of fig 8.4, which misses by 35 cm |
| **R1** — suppress or fail the exit leg on off-road termination | 2 lines (8.1 bad, 8.3 bad) `pass → fail`; 8.2 bad and 8.4 bad already fail | no SVG change — those lines are already red by outcome — but `result_hash` moves |
| **R3** — re-base the bar | **dead zone**: no committed `exit_f` lies in (0.55, 0.845], so the first bar that changes anything is > 0.845 | a bar chosen to move the corpus would have to be chosen *because* it moves the corpus |
| **R4** — mark pinned legs `na` in evidence | 0 verdicts | evidence-only, but evidence is in-hash |

- **Done when:** `figures/SCOPE.md` §4's S20/S29/S30/S33/S35 entries each carry the letter's
  actual position, the live remainder, and the options with their measured consequence — and
  `ROADMAP.md` records that the cluster is now an owner decision, not a repair. **No engine
  or pack change is in scope.** If you find yourself editing `checks.ts`, stop.

---

### ~~Work order 3 — S32, the grant.~~ DONE 2026-07-29 — packet completed, decision recorded pending; see the CLOSED section above.

**Authorization: none needed to write the packet; the decision itself is the owner's.**
Note the structural point, which is new: the S12 grant exists only in `ROADMAP.md`, whose
own header disclaims authority over `design/*.md`. **Whatever is chosen should land in
`design/01`** (§8 or a new remit section), not only here.

**The conflict is 3-vs-1, not 1-vs-1**, which S32 as originally filed understated. Three
statements in the grant's own section admit `chop` — the rationale (*"Chapter 8 teaches …
half the mistake catalogue in prose"*), the coverage arithmetic (which counts `chop` among
the 47 Chapter 8 doctrine surfaces and lists it uncovered), and the candidate table — while
one, the scope sentence, excludes it.

**Two independent questions.** Scope: does *"Chapter 8 doctrine only"* mean the chapter of
the **carrying check's** `book_ref`, or of the **doctrine surface and road** the figure
teaches? Naming: may the corpus hold an id that is not `fig-08-*`?

| scope option | consequence |
|---|---|
| **A — scope by road + doctrine surface** (add one defining sentence; a figure is Chapter 8 doctrine iff its road and teaching sit inside `design/01 §4`–§6) | matches three of the grant's four statements. Strongest supporting fact: `throttle_rule` leg (d) **already fails twice in committed parity ink** (fig 8.5 `early` c1, fig 8.6 `bad` c1), so a carrier-chapter rule retroactively indicts two G7-mandated figures. |
| **B — scope by carrier chapter, widened to the pack's declared "ch. 8–9"** | its warrant is currently false and must be fixed first: the pack's `doctrine_source` says ch. 8–9, but its sixteen `book_ref`s span ch. 1, 2, 8 (twelve), 9 and 11. |
| **C — keep carrier-chapter scoping; drop candidate 1 permanently** | cheapest to state, and what the round-3 author defaulted to. Also strikes candidate 6's `traction_ceiling` (ch. 1) and `fig-11-TB` — at least **two** of seven rows plus 11.TB, not the "exactly one artifact" S32 claimed. |

| naming option | consequence |
|---|---|
| **D — admit a `fig-09-*` id** | proven near-free: baking `fig-08-01.scene` into an out dir named `fig-09-D1` yields the committed `spec_hash` 57e436 with a **byte-identical SVG**; `figure_id` is derived from the `--out` basename, is in no hash, and appears in no normative shape. |
| **E — drop chapter numbers from doctrine ids entirely** (e.g. `doctrine-chop-book90`) | removes the half of S32 a placard provably cannot reach, and makes chapter-numbered ids *reserved* for the six parity figures. |
| either | the real cost of a seventh figure is `gate.test.ts`, which hard-codes the six ids and asserts the baked directory holds exactly six SVGs and six judge records. |

**The strongest argument against candidate 1 is from the book, not from governance**, and
it should be in front of the owner: Chapter 8's only sentence about reducing throttle
mid-corner *endorses* it — *"initiating a slight rolling off of the throttle"* as a
double-apex correction — while the chop prohibition appears verbatim in Chapter 9 and
nowhere in Chapter 8. So a Chapter-8-branded chop figure teaches against the one Chapter 8
sentence on its own subject, which `design/01 §3` (the book wins) disfavours regardless of
how the scope question is answered.

- **Done when:** the packet above is in `figures/SCOPE.md` §4 S32 and the decision is
  recorded as pending. A run may **not** pick an option.

### Two record errata, found while specifying the above

- The pack has **twelve** ch-8 `book_ref`s, not eleven. Corrected in this file and in
  `SCOPE.md` §4 S32.
- `A-FIG82-SINGLEMARK` (`design/09 §5.4`) already pins fig 8.2's single turn-point glyph, so
  that figure was never evidence of anything.

### Not blocking, but read it before you believe a red gate

**The suite is flaky under load.** Two of four full runs on 2026-07-28 went red — 1 and 3
failures — always `Error: Test timed out in 5000ms` on CLI-spawning tests (`A-RECIPE-J`,
`A-EXIT-DECLARED`), always green in isolation and on re-run, and never touching the code
under change. Re-run the file alone, then the suite, before reporting a regression. Do not
"fix" it by widening a timeout you have not diagnosed. Recorded in `DEVIATIONS.md`.

### The original goal, still standing — this is what the substrate work unblocks

**Status: the goal, decided 2026-07-27. Three rounds attempted; see above.** The three
sections that follow — the goal, the coverage arithmetic and the candidate table — are
unchanged in substance and are kept here because items 1–3 above exist to serve them.
Nothing in them should be started before its blocker is cleared.

The book stops at six line diagrams; linelab's *doctrine* does not. Chapter 8 teaches
blind corners, hairpins and half the mistake catalogue in prose that carries no figure
at all — and `bookBlind` and `bookHairpin` are shipped presets that no scene uses. **The
target is a figure for every Chapter 8 doctrine surface the engine actually computes,
whether or not Parks printed a diagram of it.**

This **grants S12**, which the corpus pass had to leave open: linelab may author
non-parity *doctrine* figures. The grant is scoped — Chapter 8 doctrine only — and
carries one condition, because the reason S12 was open was never bureaucratic:

> **S15 is a hard prerequisite. — MET 2026-07-27, commit `84f2320`; see the CLOSED
> section above.** A doctrine figure must say, inside the artifact, that it illustrates
> prose rather than reproducing a printed diagram. The condition is now satisfiable: a
> scene may carry `placards:`, and the strings reach both the SVG and the manifest.
> **What four refused candidates showed is that satisfying it is necessary and nowhere
> near sufficient** — all four carried their non-parity statement in ink, and all four
> were refused anyway. A doctrine figure that cannot disclaim parity is the "plausible
> fake" design/01 §8 refuses; one that disclaims parity and then over-claims elsewhere is
> the same fake with a disclaimer.
>
> **And round 3 found the ceiling on the channel itself.** A placard reaches the SVG and
> the manifest. It does not reach the `figure_id` (S32), it does not reach a marker the
> renderer declined to draw (S34), and — because `EPS_EXIT_DEG` lives outside the rubric
> pack — it cannot be made complete about the constants a verdict rests on (S33). Two of
> the eight kills landed on exactly those surfaces. **The scope of what a placard can
> honestly promise is now itself a known-bounded thing**, which is a better-posed
> question than S15 started from.

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
| 1 | `chop` on `book90` — the throttle chop | `throttle_rule` leg (d) | **S32, and it is not a wording problem.** Three rounds; merit never in doubt (carrier fails across `slew_mss` 9–100 of an admissible 1–100, boundary at the `RATE_THRESHOLD` bar). Round 3 repaired its disclosure defect successfully and was then refused **on remit** by its own author: the carrier is the pack's only Chapter 9 check, and no filename for it is honest. `slew_mss=20` is **retracted**; the catalogue default is correct. Do not re-author until S32 is answered. |
| 2 | `overread` — the timid line | `out_in_out` exit leg | **Blocked on the `out_in_out` cluster (S20/S29/S30/S33), not on wording.** Round 3 cleared merit twice on a full 71-value band sweep, and its S30 placard repair held. It died because its teaching sentence names a standard the check does not enforce (the bar is at 53.9% of lane width — S33) and because the renderer marks only the ideal line (S34). Both are substrate. |
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

~~Start at 1 and 2. They are blocked on nothing but S15.~~ ~~**Superseded 2026-07-27.**~~
**Superseded again, 2026-07-28, and this time with the loop closed.** Rows 1 and 2 have
now had three rounds and eight independent reviews. Their carriers held every time; not
one of the eight kills was on the physics. Their obstacle is no longer S15, and no longer
S31 — **S31 is answered** (the section above). Row 1 is blocked on **S32**, row 2 on the
**`out_in_out` cluster** and **S34**. Both obstacles are now in the engine, the renderer
or the grant — none of them is in a sentence, and none is repairable by another authoring
pass. **Do not open a fourth round on either.** The substrate items in `NEXT` are what
unblocks them, in that order.

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
