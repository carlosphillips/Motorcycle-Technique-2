# figures/SCOPE.md — scope adjudication for the figure corpus

## Read this first: Chapter 8 is the only chapter that contains lines

*Total Control* contains **exactly six line-choice diagrams, and they are all in
Chapter 8** — figures 8.1 through 8.6. Chapter 8's prose references those six and no
others, and no other chapter's prose contains a line-selection diagram. **All six are
built, shipped, graded green and re-bake byte-identical.** That is the whole of the
book's line-selection ink, and linelab covers it 6/6. It is also exactly what
`design/01 §2` G7 asks for: *"For each line diagram in* Total Control *Chapter 8 (figs
8.1–8.6), linelab produces an equivalent figure from a scene file."*

Nothing in the refused set below is a line-choice diagram. The 81 refusals are 39
photographs (body position, gear, fitness, ergonomics), 24 suspension and chassis-setup
diagrams, tyre/contact-patch/gyroscope physics, one shifting sequence and one throttle
timing chart. The nearest misses are the nine Chapter 15 plan-views in §2 bucket I —
fig 15.16 and its family draw an "intended path of travel" against an "actual path of
travel" through a bend, which *looks* like a line diagram. They are refused because the
deviation's cause is a machine fault (tyre leaving the ground, suspension), and because
the intended path is an **authored** ideal, which G1 forbids outright: every line
linelab draws is an integrated trajectory, so it cannot draw a path nobody rode. The
rider's line choice is identical in both curves; the machine changes the outcome.

So the corpus is not missing line-selection work, and the ROADMAP heading this pass ran
under — "extend past Chapter 8" — was misleading. Chapter 8 *is* the line-selection
chapter, and it was already complete at v1.0. What this file actually answers is the
weaker question that heading implied: is there anything **outside** line selection that
linelab can also grade honestly? No.

The live gap is a different one, and it is now the project's stated goal: Chapter 8
teaches doctrine in **prose** that has no printed figure at all — blind corners,
hairpins — and `bookBlind` and `bookHairpin` are shipped presets that no figure uses.
See `ROADMAP.md` for the coverage target.

---

This file decides two questions.

**(a) Can linelab reproduce this printed book figure honestly?** Asked figure by
figure, of every printed figure outside the six Chapter 8 scenes already shipped.

**(b) Which Chapter 8 doctrine that the shipped six never exercise can linelab
draw honestly?** Asked of the two shipped-but-unused presets (`bookBlind`,
`bookHairpin`) and the four shipped-but-undrawn mistake kinds
(`premature_contained`, `chop`, `underread`, `overread`).

Honestly, in both questions, means every claim the figure makes is one the engine
actually computes, and every claim it cannot compute earns a typed `{na: reason}`
or a rendered placard — never a plausible fake (`design/01 §8`, the placard
policy). Question (b) carries one additional requirement, because it is not
anchored to printed ink: the drawn contrast must be one a rider can see, and the
doctrine named must be what causes it.

This file does **not** decide what linelab should model, does not propose engine
changes, and does not re-adjudicate the six shipped Chapter 8 figures. It
supersedes the starting-hypothesis table in `ROADMAP.md` ("NEXT — extend past
Chapter 8"), which that document itself labels *"a starting hypothesis derived
from a skim, not an adjudication"*; three of its rows are overturned in §3.
`design/*.md` (D1–D46) remains the design of record and wins over everything here.

## The headline result

**Question (a) — book-figure parity: 81 figures adjudicated, 0 survive.**
Unchanged by a later steelman pass that defended the three closest refusals at
full strength: 3 targets re-examined, 0 verdicts changed (§2, closing
subsection).

**Question (b) — Chapter 8 doctrine the shipped six never exercise: 6 candidates
adjudicated in 3 groups, 0 survive.** Three were refused by their own proposer on
the merits; three reached PARTIAL and were killed on review (§3).

**The corpus does not grow. It remains the six shipped Chapter 8 scenes.**
Phase 2 of the ROADMAP has nothing to author and Phase 3 has nothing to bake.
That is the finding, not a failure to find one.

Two of the three steelman defences produced artifacts that are honest but
reproduce no printed figure, and one killed tranche candidate is the same
artifact rediscovered independently by a third route. All of them are blocked on
the same unresolved remit question (§4 S12) and degraded by the same missing
capability (§4 S15 — nothing renders a placard). That convergence is the sharpest
input this file has to S12.

---

## 1. The surviving corpus

**New figures surviving this adjudication: none.** No pass added a figure.

| figure id | source | verdict | carrying checks | view | placards |
|---|---|---|---|---|---|
| — | — | — | — | — | — |

Every one of the 81 printed candidates is refused in §2. Every one of the 6
doctrine candidates is refused in §3 — three by their proposer, three on review.
Nothing in any pass reached a surviving IN or PARTIAL, so there is no
per-figure subsection to write: no scene text is authorized, no "sentence the
figure is entitled to teach" is adopted, no placard set is adopted. The full
scene text of the candidates that got closest is preserved in §3, so the work is
auditable and is not re-proposed from scratch.

The next id in the Chapter 8 sequence, `fig-08-07`, is unclaimed. What would
claim it, and on what conditions, is recorded in §3 and in §4 S12.

**Standing rule for anything this file ever admits under question (b).** A
question-(b) candidate is a *doctrine figure*: it illustrates Chapter 8 prose the
shipped six never exercise. It is **not** a reproduction of a printed book
figure, and nothing in this corpus may claim parity with a printed diagram that
does not exist. `bookBlind` and `bookHairpin` are the sharp cases — `design/03
§3.1` records that `bookBlind` is "no longer fig 8.1's geometry, so it
illustrates Ch. 8's blind-corner *argument* rather than a specific figure's ink",
and lists `bookHairpin` as "road-speed hairpin (**no Chapter-8 ink to match**)".
A reader of a baked SVG sees neither a `#` comment nor a `note:` field (§4 S15),
so a parity disclaimer that lives only in scene source is asserted and not
discharged. Any doctrine figure ever admitted here carries its non-parity
statement on a rendered surface, or it does not ship.

### The corpus as it already stands (Phase 0 — not re-adjudicated here)

The six shipped scenes are listed for accounting only, so that all 87 extracted
images are reconciled. They were scoped and baked before this pass and no
verdict here touches them.

| figure id | book figure | carrying checks | view | placards |
|---|---|---|---|---|
| `fig-08-01` | 8.1 premature turn point | outcome `runoff`; `late_apex` / `out_in_out` as coverage evidence (§A.4) | topdown | none |
| `fig-08-02` | 8.2 slow steering | `quick_steer` (§A.4 pin) | topdown | none |
| `fig-08-03` | 8.3 fifty-pencing | `single_input` (§A.4 pin) | topdown | none |
| `fig-08-04` | 8.4 decreasing radius entered too fast | `out_in_out` (§A.4 pin); `wrong_strategy_for_corner` is the fig 8.4 check (§A.3 #16) | topdown | none |
| `fig-08-05` | 8.5 the double apex | `late_apex`, `wrong_strategy_for_corner`; `good` refuses `no_two_touch_line` | topdown | declared bake exit 3 |
| `fig-08-06` | 8.6 the esses | `link_continuity`, `chain_containment`, `chain_flow` | topdown | declared bake exit 3 |

---

## 2. Book-figure parity: the refused set

**87 images extracted to `book_images/by-figure/`. 6 are the shipped Chapter 8
corpus. 81 figures adjudicated in this pass, 0 survive.** Two additional
*non-printed* figure proposals were adjudicated on request and are recorded
separately at the end of this section.

Each figure appears exactly once, in the bucket naming its **primary** refusal.
Where a figure is refused more than once — most are — the additional grounds are
in the last column. Cited sections are `design/01-scope-and-doctrine.md` unless
another document is named.

### A. Tier-3 dynamics — suspension and vertical geometry (24)

Refused by `design/01 §8`, Tier-3 bullet (*"Tire slip, suspension, aerodynamics,
gyroscopic and countersteer transients, and any handlebar channel (D3)"*) and the
vertical-geometry bullet (*"No crests, dips, camber, or elevation — in sight
**or** in physics"*). linelab has no sprung/unsprung split, no spring, no damper,
no ride height, no pitch degree of freedom, and no elevation channel. Every
figure in this bucket is a side elevation of chassis height against wheel height,
or a component force/deflection plot; none contains a road, a line, or a station
axis that any of the 16 checks could read.

| figure | subject | also refused by |
|---|---|---|
| 3.1 | sprung/unsprung mass over a bump | vertical geometry |
| 3.2 | spring rate K = load / deflection | — |
| 3.3 | force–deflection plot, two spring rates | no such view (design/06 §4 channel list is closed) |
| 3.4 | straight / dual-rate / progressive springs | — |
| 3.5 | coil + air spring, combined force | — |
| 3.6 | preload vs rate at a common sag point | — |
| 3.7 | preload reallocating travel above/below the road plane | vertical geometry |
| 3.8 | RaceTech spring-rate selection chart | — |
| 3.9 | rebound damping vs traction / control / plushness | two of three axes are subjective |
| 3.10 | compression damping trade-off + bump deflection | vertical geometry |
| 15.1 | rear sag arithmetic L1 − (L2+L3)/2 | rider-on-bike photograph (§8 body bullet) |
| 15.2 | triple-clamp adjuster identification photo | not a render surface linelab has |
| 15.3 | excess rebound damping over bumps | vertical geometry |
| 15.4 | inadequate rebound / topping out | vertical geometry |
| 15.5 | compression damping, bump deflection | vertical geometry |
| 15.6 | bottoming / harshness | vertical geometry |
| 15.7 | mushy, lacks damping; crest overshoot | vertical geometry |
| 15.8 | too stiff — twitchy; carries a bar-angle trace | handlebar channel (D3); tyre slip |
| 15.12 | dive under braking / chassis pitch | no pitch state; point mass (design/02 §2) |
| 15.14 | fork stiction | vertical geometry |
| 15.18 | excess compression damping — kicking | vertical geometry |
| 15.19 | soft spring/damping — bottoming and kicking | vertical geometry |
| 15.21 | contact-patch pressure over a rise; roost | tyre slip; vertical geometry |
| 15.22 | rear squats under drive | no drivetrain torque; no ride height |

### B. Tier-3 dynamics — tyre, contact patch, gyroscope (8)

Refused by `design/01 §8`, Tier-3 bullet, and by `design/02 §5.5`, which names
the excluded set almost as an index to Chapter 2: *"Fork geometry and trail
torque, tire profile and contact-patch migration, suspension pitch,
engine-braking character, rider body english, and any handlebar/countersteer
state."* linelab's friction model is one scalar μ under the one-μ policy
(§A.3 check 7); its lateral vocabulary is `cmd_lean → phi → kappa = G·tan(phi)/v²`
(`design/02 §2`), a point-mass identity with no tyre in it.

| figure | subject | also refused by |
|---|---|---|
| 1.2 | multi-compound tyre construction cross-section | no component view |
| 1.5 | contact-patch area vs rim width at lean | no contact-patch quantity exists |
| 1.6 | rounded vs triangular profile; grip vs lean | would need lean-dependent μ — an engine change |
| 1.7 | tread displacing water / aquaplaning | the only surface feature is the `gravel` μ patch |
| 2.3 | tyre width as a moment arm on a rock strike | no obstacle-strike event; missing mistake kind (§4, S1) |
| 2.4 | tyre width → 40° vs 45° at equal speed and radius | **the engine would contradict the book** — see note |
| 2.7 | gyroscopic precession triad | excluded **by name** in §8 |
| 2.8 | contact-patch cylinder/cone; the cup analogy | mechanism substitution — see note |

Two of these deserve more than a row.

**2.4 (and its sibling 2.5, bucket K).** `requiredLean(v, kappa) =
atan(v²·kappa/G)` has no tyre-width term and no CG-height term. At equal speed
and equal radius the engine returns the *same* lean for both panels. A
reproduction would print 40° and 40° where the book prints 40° and 45°, and so
would silently assert the book is wrong. `design/01 §3`'s "the book wins" rule
does not license arbitrating this — it governs doctrine disputes, and this is a
physics-tier boundary §8 already resolves by refusal.

**2.8.** linelab does produce curvature from lean — but from lean equilibrium of
a point mass, not from a rolling cone. Reproducing the phenomenon while
substituting a different mechanism is the PARTIAL/OUT test's exact failure mode:
what survives is "leaned bikes turn", which Chapter 8 already carries, and the
mechanism the figure exists to teach is gone.

### C. Tier-3 dynamics — the handlebar and steering-geometry channel, D3 (5)

Refused by `design/01 §8` (*"…and any handlebar channel (D3). The taught controls
are lean, brake, throttle"*) and foreclosed absolutely by `design/02 §2`: *"There
is no roll inertia state and no handlebar state (D3)."*

| figure | subject | also refused by |
|---|---|---|
| 2.1 | castor wheel: trail, lever arm, M = L × F | no road, no line — no check has an instance |
| 2.2 | rake and ground trail on a fork | no bike-geometry parameter on any input surface |
| 2.6 | countersteering vs direct steering (photographs) | rider-body photograph (§8 body bullet); front-wheel out-tracking needs two paths, Tier 1R has one |
| 2.9 | plan-view corner banded green/blue by steering mode | colour law v2 (§3; design/06 §5.1); no phase-banding channel — see note |
| 15.15 | headshake: three bar-angle oscillation traces | the `controls` strip's axes look similar — a lean trace captioned "headshake" is a plausible fake |

**2.9** is the closest a Chapter 2 figure comes, and it fails on three
independent grounds. Its *shape* is computed: on `preset book90` at entry 34 the
solved line rolls in (s 7.0 → 12.0, `turn_in`/`steering_complete`), holds a
constant-lean plateau (12.0 → 33.6, `release`), then unwinds (33.6 → 38.3,
`exit`). But `steer_state` does not partition the way the figure does —
`commit(k)` spans both the roll-in *and* the plateau, because it names which plan
action owns the channel, not which steering mechanism is acting (`design/02
§3.1`). Banding a line by phase would break colour law v2, under which a line's
colour **is** its verdict. And by G1 no path geometry is authorable, so the
reproduction would be the doctrinal late-apex out-in-out (measured on `book90`:
f 1.00 at entry → 0.28 at apex → 0.85 at exit, apex at 66% of sweep) where the
printed 2.9 deliberately draws a near-constant-offset path with no apex, because
Chapter 2 is not about line selection at all.

### D. Tier-3 dynamics — aerodynamics (3)

Refused by `design/01 §8`, Tier-3 bullet, which names aerodynamics. linelab's
point mass has no drag term, no bodywork geometry, and no field quantities of any
kind; its record is per-sample scalars along a trajectory (§A.2).

| figure | subject | also refused by |
|---|---|---|
| 18.1 | laminar flow, turbulence, 7° Kamm tail | no view renders flow |
| 18.2 | CFD velocity field at 100 mph | a result from a different simulator entirely |
| 18.3 | frontal area counted on a grid | rider-body photograph (§8 body bullet) |

### E. No rider-body model (20)

Refused by `design/01 §8`, verbatim: *"Rider posture and body position. No
rider-body model; the book's body-position photographs have no linelab equivalent
and none is attempted."* Every figure here is a photograph of where a body is.
The Sample record carries no body-offset field, and every check reads only that
record (§A.2).

| figure | subject | also refused by |
|---|---|---|
| 11.1 | quick-stop body position, five callouts | gaze (callout a); handlebar (callout b); below validity band — a max-effort stop terminates at v = 0 through `v_valid_min_ms` = 7.0 m/s, and every `stopped` run grades `caution` (§3, §A.1) |
| 12.1 | rider vs bike centreline, arms fighting | gaze; handlebar (D3); missing mistake kind (§4, S6) |
| 12.2 | step 1 — foot on the peg | rider-limb ground clearance is not in the point-mass model |
| 12.3 | head/shoulder/hip axes aimed at the exit | gaze — the head axis |
| 12.4 | step 2/3/4 — the "V", push outside grip | handlebar (D3); the ground-clearance-vs-outside-lean claim needs a rider-CoM term `design/01 §4.2` does not have |
| 12.6 | steps 6/7 — relax outside grip, push inside | handlebar (D3); fork compression is Tier-3 |
| 12.7 | inside arm does all the steering | handlebar (D3); missing mistake kind (§4, S6) |
| 12.8 | step 8 — roll on throttle at full lean | the *content* is graded by `throttle_rule`; the *figure* is a body photograph — see note |
| 12.9 | step 9 — push outside grip, hold the "V" | handlebar (D3); contact-patch loading is Tier-3 |
| 12.10 | step 10 — return to neutral | suspension and rider weight transfer are Tier-3 |
| 17.1 | rider spine curvature on a cruiser | ergonomics — no seat/backrest parameters |
| 17.2 | lever angle and wrist angle | handlebar channel (D3) |
| 19.1 | wall squat, correct form | no motorcycle, road, or trajectory in frame |
| 19.2 | wall squat, incorrect form | as 19.1 |
| 19.3 | forearm plank, correct form | as 19.1 |
| 19.4 | forearm plank, incorrect form | as 19.1 |
| 19.5 | straight-arm plank, correct form | as 19.1 |
| 19.6 | straight-arm plank, incorrect form | as 19.1 |
| 19.7 | pull-up, top position | as 19.1 |
| 19.8 | pull-up, full extension | as 19.1 |

**12.8** is the one Chapter 12 step whose *content* linelab genuinely computes:
`throttle_rule` grades crack → v_min ≤ apex → roll-on → no chop, and the `crack`
and `roll_on` events are recorded (on `book90`: crack s = 1.54, roll_on 15.31,
apex 24.5). But the printed figure is not a throttle-timing diagram; it is a
photograph of a rider hanging off, with the throttle named in one word.
Reproducing it means either reproducing the body (refused) or substituting a
controls strip that teaches Chapter 9's throttle rule — a different figure making
a different point.

### F. No gaze model (1)

Refused by `design/01 §8`: *"no gaze state exists, no mistake kind perturbs
vision, and no check grades where the rider looks."*

| figure | subject | also refused by |
|---|---|---|
| 12.5 | step 5 — look through the turn | the sight rays linelab *does* have are ray-cast visibility geometry to the limit point (§6) — a physically different object from where the rider chooses to look. Drawing one under the caption "look through turn" is the precise failure the placard policy names. |

### G. No drivetrain model (2)

Refused by `design/01 §8`: the taught controls are lean, brake, throttle. A
repo-wide search of `design/*.md` for gear / gearbox / clutch / rpm /
transmission / drivetrain returns zero hits, and the Sample record carries
exactly one signed longitudinal command, `cmd_a`.

| figure | subject | also refused by |
|---|---|---|
| 10.1 | Dynojet speed-vs-time, quick-shifter vs conventional | verified: a straight-only road instantiates only 2 of 16 checks (`stop_within_sight`, `rideability`), both pass; the eleven corner-scoped checks are not instantiated. The point mass has no drag and no torque curve, so both traces would integrate to the same straight ramp. |
| 10.2 | four-channel downshift timing chart | verified structurally unrepresentable: brake and throttle are one signed `cmd_a` (`design/03 §6.1`, `design/05 §2`). On `lane 3.5 \| S 120` a blip during a 3.0 m/s² brake records as a *release* to −1.29 m/s² and back — a 1.71 m/s² re-deepen, past `trail_brake_taper`'s `REDEEPEN_TOL` = 0.3, so at lean ≥ `TB_PHI_MIN` (15°) linelab would **fail a doctrine check on technique the book teaches as correct.** |

### H. Below the validity band; super-tight geometry rejected at validation (1)

| figure | subject | also refused by |
|---|---|---|
| 13.1 | counterbalanced super-tight U-turn (photograph) | rider body model; gaze (the chapter's own make-or-break variable); handlebar channel; gyroscope |

Demonstrated, not asserted. A `fig-13.1` scene in the exact form of the six
Chapter 8 scenes (`road: lane 3.5 | S 6 | R 3 ^180 | S 6`) returns from
`figure`:

```
{"ok":false,"error":{"code":"OUT_OF_SCOPE","at":"c1",
 "message":"corner c1 accumulates 180.0° of sweep at r ≤ 15 m (≥ 170°) —
            super-tight U-turn geometry is out of scope",
 "detail":{"reason":"super_tight_geometry",
           "sweep_below_r_max_deg":180,"r_uturn_max_m":15}}}
```

Identical at `r 4 ^180` and at the exact boundary `r 15 ^170` (`design/01 §8`
bullet 1; `design/03 §2`; `design/02 §7`). Independently, at U-turn speeds the
solver refuses outright: `bookHairpin` at 12 km/h, `R 4 ^160` at 12, `R 16 ^180`
at 10, and `book90` at 21 all return `NO_SOLUTION`/`empty_band`; `book90` solves
at 22 and then self-reports `validity.below_validity_s` = 5.17. Escaping both
cuts requires r > 15 m and entry > 25 km/h — at which point the drawing is an
ordinary road-speed hairpin graded by `late_apex`/`out_in_out`, i.e. Chapter 8's
teaching, which Chapter 13's own prose calls *"the exact opposite technique."*

### I. Plan-view, but forbidden by G1 and needing a machine-fault mistake kind (9)

These are the figures this sweep was hunting: nine genuine plan-view diagrams of
a bike arcing through a corner, the exact shape of a linelab `topdown`. Every one
of them fails, and they are the **most dangerous figures in the corpus** — a
`premature` or `overspeed` line rendered topdown looks very like 15.10 or 15.16
while attributing a cause the engine never computed. That is precisely the
"wrong-but-plausible picture a student could believe" that `design/01 §8` forbids.

Three independent refusals apply to all nine:

1. **G1.** Each draws an authored *"intended path of travel"* against a diverging
   *"actual path"*. `design/01 §2` G1: no path geometry is ever authored — no
   input surface accepts path points, radii-of-line, or an apex. There is no
   intended-path object in linelab and no way to make one.
2. **Tier-3 cause.** The divergence is attributed to front tuck, understeer,
   steering effort, headshake, weave, wheel hop, or a suspension deficit — tyre
   slip, the handlebar channel, and suspension, the three named Tier-3
   exclusions.
3. **Missing mistake kind.** All eight kinds in the closed set (`premature`,
   `premature_contained`, `slow_steer`, `fifty_pence`, `chop`, `overspeed`,
   `underread`, `overread`, confirmed live via `schema mistakes`) perturb a rider
   control channel or a rider belief. None perturbs a machine. See §4, S5.

| figure | subject | the PARTIAL test |
|---|---|---|
| 15.9 | front tuck — "steers too sharply with very little steering input" | strip the tuck and what remains is "one line arcs tighter than another" |
| 15.10 | "doesn't turn" — bars turned in, front keeps drifting out | strip the understeer and what remains is fig 8.1's teaching |
| 15.10b (`fig-15.10__image00367`, p.137) | "steering tracks, but requires excessive effort … may run wide" | steering effort is not a channel the engine has |
| 15.13 | "steering feels vague, loose, wanders" (+ pitch panel) | a felt quality with no engine channel |
| 15.16 | "runs wide because tire is coming off the ground" | strip the cause and what remains is fig 8.1's wide line |
| 15.17 | "runs wide in bumpy turns due to suspension deficit" | the caption names the excluded cause outright |
| 15.20 | "rear trail self-corrects but overshoots" (weave on a straight) | `fifty_pence` would draw a similar weave and fail `single_input` — same picture, opposite lesson |
| 15.23 | "rear feels vague, loose, wanders; front holds a line" | linelab has one point mass, no front/rear axle split |
| 15.24 | "irregular and unpredictable" wander | the engine is deterministic by design (§6) — irregularity would have to be faked |

### J. Not a line diagram — no render surface (3)

linelab renders three views: `topdown`, `controls`, `pov` (`linelab/README.md`).
None of them is a component photograph, a typographic decoder, or a static force
diagram.

| figure | subject | also refused by |
|---|---|---|
| 1.3 | DOT sidewall code decoder | tyre age is not a quantity at any tier |
| 1.4 | tyre size code decoder | — |
| 1.8 | the traction pie — cornering / accel / decel on one budget | see note |

**1.8** is the strongest candidate in Chapter 1 and it still fails. Check 7
`traction_ceiling` is book-sourced to this chapter — `explain traction_ceiling`
prints `book_ref: "Total Control ch. 1, Traction"` — and the engine records the
ellipse decomposition per sample (`design/05 §2`: `n_lat`, `n_long`,
`grip = 1 − ellipseMag`). But no view draws it. The `controls` strip's channel
list is closed and enumerated in `design/06 §4` (v; phi vs cmd_lean; cmd_a with
a_long; grip; sight_ride_m vs ssd_m; stand-up; optional k_refuted) and n_lat /
n_long are not in it. Adding an ellipse view is an engine change. Strip the
undrawable part and what remains is a grip-reserve-vs-station strip for one line,
which teaches "this line banked X margin", not "three forces compete for one pie."

### K. Other — refused on figure-specific grounds (5)

| figure | subject | why |
|---|---|---|
| 2.5 | CG height 45° → 36° at equal speed and radius | `design/02 §2` fixes the vehicle as *"a point mass carving arcs on a flat 2-D road surface"* with state `{t, x, y, psi, v, phi}`. `tan phi = v²/(g·r)` is CG-height-free, so linelab would report 45° in both panels and contradict the book's 36°. The companion hanging-off claim is additionally excluded as rider body position (§8). |
| 4.1 | Fear-to-Confidence flowchart | not motorcycle dynamics; no state, check, or view touches rider mental state. §8 also bars carrying curriculum. |
| 4.2 | sagittal brain section, "reptile brain" | human neuroanatomy — out of scope on every reading. |
| 9.1 | trail-brake timing chart: throttle / brake / lean vs corner phase | three independent refusals — see note |
| 12.11 | the 10 Steps plotted by station on a plan-view corner | eight of the ten steps are refused channels — see note |

**9.1** overturns the ROADMAP's strongest IN. (i) *The overlap is structurally
unrepresentable.* The book's two longitudinal curves are one signed scalar:
`Sample.cmd_a` is *"COMMANDED longitudinal accel (brake < 0, drive > 0)"*, drawn
by `design/06 §4` as one panel, *"brake / throttle as `cmd_a` split by sign"*. A
sample cannot brake and drive at once, so the caption's central "notice how the
throttle is being applied before the brakes are completely released" has no
representation — and that overlap *is* the figure. (ii) *The exit anticorrelation
is contradicted, not merely unmodelled.* Baked on `preset book90` at entry 34,
`cmd_a` reaches 2.2 m/s² at s ≈ 19 and is flat at 2.2 to road end, while `phi`
holds −30.47° to s = 33.6 and only then unwinds. Throttle is constant across the
entire lean unwind — the opposite of the printed green/blue crossing. The cause
is the engine, not the road: `ROLLON_ACCEL_MS2` = 2.2 is fixed, chosen just below
`A_SU_ONSET` = 2.5, and `grip` never falls below 0.37 so the ellipse never binds.
An explicit plan commanding 9.0 m/s² of drive at 30° lean left `clipped` false,
fired the sustained stand-up instead, and ran off. There is no authorable line
whose throttle rises as lean falls. (iii) *The doctrine is already deferred.* The
figure's own caption says *"a high-speed turn where the rider is doing a lot of
trail braking upon entry"*; `design/01 §4.2` makes trail braking *"a
separately-labelled advanced variant, not the clean baseline"*, and §A.6 names
the successor pack `trailbrake-street/1` that does not exist. On the shipped
ideal line `trail_brake_taper` returns `na` with reason `brake_complete_baseline`.

*The ROADMAP hypothesis behind 9.1 was that `throttle_rule` existing makes the
figure reproducible. It does not: `throttle_rule` is a per-corner check that
already runs on all six Chapter 8 figures, and the engine's mistake table maps
`chop` to "Ch.9 throttle doctrine", not to fig 9.1.*

**12.11** is the only line diagram in Chapter 12 and its geometry is squarely in
scope — `book90` is a lane-3.5 / R12 / ^90 constant-radius corner, and a probe of
the ideal line records brake_end 3.06, turn_in 6.97, roll_on 15.31, apex 24.5
(66.3% of sweep), release 33.63, exit 38.28, with `late_apex`, `out_in_out`,
`single_input`, `quick_steer` and `throttle_rule` all passing. But the figure's
teaching, stated in its own caption, is the relative ordering of the ten
body-positioning steps, and eight of the ten are refused channels: steps 1, 2, 10
are posture; steps 3, 6, 7, 9 are handlebar inputs; step 5 and the 5.5 marker and
every orange ray in the legend are gaze. The legend's own second entry —
"body position" — names a channel linelab does not have. Strip the eight and what
remains is a green late-apex line on `book90` with turn-point / apex / exit marks:
the Chapter 8 ideal-line anatomy, already shipped as `fig-08-01…06`.

### Non-printed figure proposals, adjudicated on request (2)

Neither reproduces a printed figure. Both are recorded so the reasoning is not
lost, and both are OUT.

| id | proposal | verdict and why |
|---|---|---|
| 9.1b | "do any quick flicks before getting hard on the gas" — an ideal line whose flick completes before the roll-on, against a line that gets hard on the gas during the flick | OUT. No mistake kind perturbs the throttle before the steering input completes. No check grades it: `throttle_legs` leg (a) bars a too-early *crack* and leg (c) a too-late *roll-on*; nothing bars an early roll-on, and leg (c)'s onset search starts at `crackIdx + 1` (else `scIdx`, else `w.i0`), so a drive command placed before `steering_complete` is not even seen as the onset. The book's stated mechanism — weight transfer to the rear — is Tier-3. See §4, S2. |
| 11.TB | a trail-braked corner, brake carried past the turn point and tapered to the apex, graded by `trail_brake_taper` | OUT, and this one is not a capability refusal — the physics is real and was verified. On `lane 3.5 \| S 35 \| R 30 ^90 \| S 25` at entry 70 with a 1.2 m/s² brake tapering past a turn-in, check 6 returns **pass** ("trail brake tapered below stand-up authority"); at 4.5 m/s² it moves to **warn** ("leaned braking ate the stand-up reserve", `ate_reserve_at_s` 35). It is still OUT on four grounds: it is not a book figure (Chapter 11 prints one numbered figure and it is 11.1); it is not authorable in the sanctioned scene form (`schema scene` exposes `ride` and `mistake` only; `SOLVE_STYLES` is `single \| double_apex \| geometric`; the solver completes braking `brake_gap` *before* turn-in by construction); there is no contrast line, because the closed set has no over-braking-at-lean kind and `chop` is deliberately routed away by `action_id` (§A.3 check 5); and the check does not carry the teaching — the line already runs off at 3.0 m/s² while check 6 still reports `pass`, and at 8.0 and 9.5 it only reaches `warn`, because the ellipse clips delivered `−a_long` before it can exceed `a_widen`. The lesson would be carried by `outcome`/`quality`, not by the named check. See §4, S3 and S12. |

### The steelman — three refusals defended at full strength (0 verdicts changed)

The adjudicators above were instructed to *prefer OUT when torn* (§5). A later
pass tested whether that instruction did too much work. Three defenders were told
to build the strongest honest case **for** the three closest refusals, run it at
the CLI rather than reason about it, and then try to break it themselves.

**No verdict changed.** 2.9 and 9.1 remain OUT as printed-figure reproductions;
11.TB remains OUT. What the defences did produce is recorded here, because two of
them corrected the record, one refuted two grounds of an existing row, and two
ended by proposing *non-parity* artifacts that are honest but that this file's
remit does not authorize (§4 S12).

**2.9 — the counter/direct-steering corner diagram (bucket C). Unchanged: OUT.**

The best case, built and baked before being tested. The refusal over-states its
own ground: of 2.9's eleven claims, two are fully computed (the entry and exit
"upright and traveling straight" callouts), three are half-computed (the
out-tracking, constant-lean and in-tracking bands each have a lean half), and six
are pure D3. The skeleton is reproduced sample by sample on `preset book90` at
entry 34: upright and straight to s 6.97; a linear roll at the street profile's
50 °/s from `turn_in` 6.974 to `steering_complete` 11.987, full −30.474° at
s 12.5; a plateau flat to five decimal places from s 12.5 to 33.5; the unwind
from `release` 33.626 to φ = 0 at s ≈ 42.0. Verdict `contained / good`, 10 pass /
0 fail / 6 na. The plateau even carries a real, non-obvious, fully computed
teaching: across it `kappa` runs −0.0694 → −0.0350 (path radius 14.4 → 28.6 m) as
v rises 32.8 → 46.2 km/h, so constant lean is the *mechanism* by which the
throttle carries the rider from `apex_f` 0.277 to `exit_f` 0.85.

It still fails, on five grounds each established by running the engine.

1. **The partition does not exist.** 2.9's bands are steering-mechanism bands;
   every partition linelab owns is a plan-action partition. `steer_state` is
   `commit` continuously from s 7.0 to 33.5, straight across 2.9's green/blue
   boundary. The five-token phase machine is worse, not better: `exiting` opens
   at `roll_on` s = 15.306 while lean is still pinned at −30.474° for another
   18.3 m, so the band that would have to carry 2.9's constant-lean span is
   labelled `exiting` and starts a third of the way into it.
2. **Two placeable callouts are unplaceable and one would be a lie.** The label
   anchor set is closed (`turn_point | apex | exit | release | correction |
   run_wide_detect | end | sight_ray`). `state --s 38.283`, the `exit` event,
   returns φ = −12.859° and `steer_state` `unwind`, so 2.9's exit-side "upright
   and traveling straight" anchored at `exit` would print over 13° of lean.
   Upright arrives at s ≈ 42.0, where no anchor exists; the entry-side callout
   has no anchor on the approach straight at all.
3. **The nominated checks grade nothing.** `single_input` returned
   `pass {count: 1, allowed: 1}` on all eleven graded lines baked on `book90` —
   the good line at entries 26/30/32/34 and the `slow_steer`, `chop` and
   `premature_contained` lines alike — because a `ride style=single` line has
   exactly one solved turn-in action by construction. `quick_steer` returned
   `steer_share: 0` on every good line at every solvable entry, because
   `steering_complete` lands at 11.987 and the corner starts at s0 = 12.000: the
   roll finishes on the entry straight, at entry 34 by 13 mm. Its printed
   evidence string "roll-in ate 0% of the corner" is not a report that the roll
   was quick. Both checks discriminate against exactly `slow_steer` and
   `fifty_pence` — which are figs 8.2 and 8.3, already shipped.
4. **Failure mode 3 fires on the main claim, and the placard cannot be drawn.**
   The section heading over the figure is "Countersteering vs. Direct Steering";
   the mechanism banding *is* the figure, so a placard conceding the handlebar
   mechanism concedes it entirely. And there is no rendered placard channel at
   all: `view: mode=diagram` is rejected `SCHEMA` (deferred, "projection
   (post-v0.1)"), `render/project.ts` sets `footnote: null` in true mode, and
   `note:` lands in `meta.caption` and never becomes ink — confirmed by dumping
   every `<text>` element of the baked SVG. See §4 S15.
5. **The geometry would misteach.** By G1 linelab draws the doctrinal
   out-in-out (`ti_f` 1.000, `apex_f` 0.277 at 66.3% of sweep, `exit_f` 0.849)
   where printed 2.9 deliberately draws a near-constant-offset path with no apex.

The honest remnant — "on a 12 m / 90° corner entered at 34 km/h the solved line
rolls to 30.5° over about 5 m, holds it for 21 m while the throttle opens the path
radius from 14.4 to 28.6 m, then unwinds over 8 m, and nothing about what the
rider did at the handlebars is modelled" — is not 2.9's sentence. Its one novel
clause *corrects* the printed blue-band caption rather than illustrating it, and
it is a throttle-doctrine claim (Chapter 9) sited on Chapter 8's road. The
defender also recorded, as an honest limit, that no mistake kind, constraint or
second `ride` line produces a lean-phase contrast that is not already fig 8.2 or
8.3: `chop` fails `rideability` at 102.95 °/s, `overread` is rejected `SCHEMA`
without an explicit `r_believed`, and `premature_contained` is a turn-in-station
figure.

**9.1 — the trail-brake / throttle / lean timing chart (bucket K). Parity
unchanged: OUT.**

Both blockers were re-run and conceded by the defender. The live `Sample` field
list is exactly 32 fields with one signed longitudinal command; the rendered
strip has one panel for it. And the exit anticorrelation is contradicted, not
merely unmodelled: on `book90` at entry 34, `cmd_a` reaches 2.200 at s = 19.5 and
is bit-identical 2.200 for the remaining 58 samples to road end, while φ holds
−30.47° to s ≈ 33.6 and only then unwinds — a dead-flat throttle trace across the
entire lean unwind. Max `cmd_a` is 2.200 on `book90`, `bookDecreasing`,
`bookHairpin` and `bookEsses` alike: a fixed constant, not a solved profile.

The defence argued instead for a *different* artifact — a `good` vs `chop` pair
on `book90`, proposed as `fig-09-D1` — and marked it survives **conditional on an
explicit S12 remit call**, stating plainly that it reproduces no printed figure
and must never be numbered 9.1. Its discrimination is real (`throttle_rule` pass
on the ideal line, fail on the chop leg with `discipline: ["chop at s=20.5"]`,
`diagnosis {cause: "stand_up", channel: "su_transient", su_transient_max_dps
220.01, cut_at_s 20.31}`), it is attributable in three independent panels of the
controls strip exactly as `design/06 §4` promises, and no shipped figure has a
longitudinal-channel mistake at all. The same artifact was rediscovered
independently in question (b)'s tranche and is killed there on the same remit
ground (§3). Eight residual dishonesties were recorded; three matter beyond this
row:

- The ideal line's controls strip draws a flat 2.2 m/s² throttle across the whole
  lean unwind, which contradicts Chapter 9's own printed text, and the disclosure
  cannot render inside the SVG (§4 S15). The strip must never ship standalone.
- Three of `throttle_rule`'s four legs are structurally unfailable in the
  sanctioned grammar. `vmin_s` was 3.5/7/7.5/8.5 on every line run — ideal,
  `premature`, `slow_steer`, `fifty_pence`, `overspeed`, `underread`, three
  `chop` variants, an entry sweep and four presets — with the apex always later,
  because the solver completes braking before turn-in by construction. The crack
  leg never once appeared in `missed[]`. Only the chop clause carries. See §4 S27.
- A pre-existing seam that hits all six shipped Chapter 8 strips identically: the
  sight panel draws `ssd_m` overtaking `sight_ride_m` at s ≈ 26 and
  `verdict.sight.margin_min_m` reads −30.95, while `stop_within_sight` passes
  with `max_deficit_m 0 / min_margin_m 33.95`. `design/06 §4` says "a crossing is
  a `stop_within_sight` failure staring at the reader" — here it is not. Cause is
  the open-end carve-out in `linelab/src/plan/doctrine/metrics.ts`. See §4 S24.

**11.TB — the trail-brake taper doctrine figure. Unchanged: OUT — but two of the
four grounds in its row above are refuted on the facts and are corrected here.**

The row is preserved verbatim because the 81-figure reconciliation is
load-bearing. Its grounds (a) *not a book figure* and (b) *`parks-street/2` scores
no benefit for trail braking* were re-verified and are conceded: Chapter 11 prints
exactly one numbered figure, 11.1, a body-position pair for an upright
straight-line quick stop on which check 6 returns `na`; and the solver's own
brake-complete line on the same road at the same entry is `contained/good`, 10
pass / 0 fail / 6 na, so the one extra pass a trail-braked line earns is only the
check ceasing to be `na`.

Ground (c), *"not authorable in the sanctioned scene form"*, is half wrong. It is
true of `.scene` — `tapered: ride entry=60 … brake=3.0` is rejected
`{"code":"SCHEMA","message":"unknown ride field \"brake\"","detail":
{"reason":"ride_unknown_key"}}` — and false of the canonical FigureSpec JSON,
whose `lines[].spec` accepts a wire `Scenario` carrying `rider.plan`
(`design/03 §8` / D30). The defender baked the two-line figure that way and it
produced envelope, SVG, manifest and two controls strips. Whether a corpus whose
six members are all `.scene` may admit a FigureSpec-JSON figure is a corpus
convention question, now recorded as §4 S28.

Ground (d), *"the check does not carry the teaching"*, is false as a general
claim. On `lane 3.5 | S 35 | R 30 ^90 | S 25` at entry 60 km/h, two explicit-plan
lines with **identical** turn-in station (s = 28.788) and **identical** committed
lean (28.825°), differing only in the longitudinal channel:

- `tapered` (3.0 m/s² from s = 1, `taper_to_s` 50) → `contained`, `good`,
  11 pass / 0 fail / 5 na, `trail_brake_taper` **pass**, `su_sustained` = 0.000
  at every station.
- `held` (3.0 m/s² from s = 14, released at s = 38) → `contained`, `caution`,
  `trail_brake_taper` **warn**, "leaned braking ate the stand-up reserve",
  `ate_reserve_at_s` 34, `su_sustained` −8.49 → −8.59 °/s (max 8.594).

8.594 °/s against the street roll budget of 50 °/s is 17.2% of the rider's
steering authority spent holding the bike down, and it matches
`K_SU·(b − A_SU_ONSET)` = 0.30·(3.0 − 2.5) rad/s exactly. The antecedent is
amply live (35 samples at |φ| ≥ 15° with delivered braking), so the pass is not
vacuous. The `fail` band is reachable too: a 7.5 m/s² brake applied at s = 34 with
lean settled at 28.8° returns **fail**, "braking hard enough to force stand-up at
lean", at s = 49.5.

It is nonetheless still OUT, on grounds the original row did not have:

- **The pass band is broad and the green tick over-reads.** A 25-cell sweep
  (decel 2.5–4.5 × `taper_to_s` 34–50) returned `pass` in 25/25, *including cells
  whose outcome was `runoff`*; a held 8.0 m/s² brake also passes, because the bike
  never reaches 15° of lean (φ peaks at ≈ 3.9°) so the leaned legs never fire.
  `pass` means only "no leaned sample crossed the onset". See §4 S27.
- **The contrast line is contaminated.** `held` also fails `out_in_out`
  (`apex_f` −0.029) and `throttle_rule`; the latter is a rubric artefact —
  check 5 exempts the entry-brake `action_id`, but the brake's release ramp is
  attributed to the throttle action that supersedes it, so the release of a trail
  brake is scored as a mid-corner brake at s = 38.5 (§4 S25). A 15-cell search
  found no line that trips `ate_reserve` without also tripping the discipline leg,
  so the figure cannot say "check 6 alone separates these".
- **It needs a bespoke road.** A 24-cell taper grid on `book90` gave `pass` 24/24;
  a 24-cell grid on `bookDecreasing` produced no `ate_reserve` at all. The band
  structure only bites at ≈ 60 km/h on r = 30.
- **The honest placard concedes the main claim.** Chapter 11's four claimed
  benefits — suspension movement, rake and trail, reaction time, and
  suspension-mediated line-tightening — are Tier-3 (`design/01 §8`). A placard
  saying so is a concession of the figure's own subject, which is OUT by the
  PARTIAL/OUT rule, unless the figure is retitled to be about the *ceiling*
  rather than the technique. That retitling is not cosmetic.

The baked artifact is preserved in §3 with its four required placards, so it is
not re-derived.

---

## 3. Killed on review

### Question (b): the doctrine tranche — 6 candidates, 0 survive

Every candidate was baked by its proposer, then attacked from two lenses. A
candidate survives only if **both** attackers leave it standing; where they
disagree the harsher verdict stands and the disagreement is recorded.

| candidate | proposer | lens 1 | lens 2 | final | downgraded by |
|---|---|---|---|---|---|
| `fig-08-D1` blind corner (`bookBlind`) | PARTIAL | OUT | OUT | **OUT** | no visibility content in the carrying check; no drawable contrast |
| the hairpin (`bookHairpin`) | OUT | — | — | **OUT** | self-refused: redundant with figs 8.1–8.4 |
| `chop` (Ch. 9 doctrine on `book90`) | PARTIAL | PARTIAL | OUT | **OUT** | §4 S12 remit; the disclaimers reach nobody |
| `overread` (the timid line) | PARTIAL | PARTIAL | OUT | **OUT** | two of three labels assert what the record refutes |
| `premature_contained` | OUT | — | — | **OUT** | self-refused: pinned check vacuous; line enters the oncoming lane |
| `underread` | OUT | — | — | **OUT** | self-refused: fail set identical to fig 8.4's committed red line |

Attackers fire only at IN and PARTIAL, so the three self-refusals drew no attack;
their grounds are the proposer's own and are recorded below.

#### `fig-08-D1` — the blind corner. PARTIAL → OUT, both lenses.

Two `vis=cautious` lines on `bookBlind` at entry 34 differing only in lane
position: hold wide (`startF` 1.0, `visHold` 0.9) versus cut in (`startF=0.1
visHold=0.1`). One check carried it — `lean_ceiling`, `pass` at φ_max 31.45° on
the hold line and `warn` at 35.66° on the cut line, both with `blind: true` and
`reserve_deg: 35`, the `BLIND_RESERVE_DEG` cap. Non-redundancy was real and
independently re-verified by both attackers: every corner of every line of all
six shipped figures reads `reserve_deg: 40.36, blind: false,
hold_wide_for_sight: na (not_blind)`, so both the blind cap and check 11 are
exercised by nothing in the committed corpus, and `review/verify/
fixture_geometry.py` check 1 discharges §A.2's blind obligation at 187 cells.

```
# the baked candidate — NOT ADOPTED
road:      preset bookBlind
lines:
  hold:    ride entry=34 turnIn=auto vis=cautious
  cut:     ride entry=34 turnIn=auto vis=cautious startF=0.1 visHold=0.1 role=alternative
marks:     turn_point,apex
view:      mode=diagram window=auto rays=all_turn_ins consequence=on
note:      "Blind corner: the lean reserve is capped at 35 deg. Held wide the line
            peaks at 31.5 deg; ridden on the inside it peaks at 35.7 deg and eats
            the reserve."
```

**Lens 1 — the carrying check has no visibility content.** Both lines reach peak
lean at v = 34.00 km/h; the V1 sight governor is inert on both. Path radius is
14.86 m and 12.67 m, and `atan(v²/(g·r))` reproduces 31.45° and 35.66° exactly.
No visibility quantity enters either number. The only thing `blind(c)` does in
the whole figure is move the `lean_ceiling` bar from 40.36° to 35°, so the figure
teaches "a tighter radius at the same speed needs more lean" — Chapter 2 physics
— and borrows the blind cap to manufacture a verdict split. §6's fourth bullet is
nowhere computed: there is no hazard, no demand, no remainder. The split is also
a knife-edge on a TUNING constant: `startF` 0.1 → 35.66° warn, 0.2 → 35.56° warn,
**0.3 → 34.99° pass** — one hundredth of a degree under the bar — 0.4 → 34.44°,
0.7 → 32.87°. Against a 2.7 m usable corridor that is a teaching window of about
27 cm of lane and 0.66° of lean. The proposal's claim that both knobs are
load-bearing is false: at `startF=0.1` the `visHold` sweep runs 35.66° → 35.17°
across 0.1→0.9 with `warn` at every value.

**Lens 2 — the differential is not drawn, and the picture argues the opposite of
the caption.** The baked SVG carries two `#b07d1e` amber trajectories and two
terminal words both reading `caution`; the legend rows differ only in
`ideal`/`alternative`; the engine's own one-line summary is identical on both
(`"contained — 3 check fails"`). Under colour law v2 (`design/06 §5.1`) `quality`
is the total colour function and the terminal word is the redundancy that
survives a greyscale print — both channels report no difference. Searching
`bake.svg` for `reserve`, `Blind corner`, `35 deg`, `35.7` returns nothing: the
teaching sentence lives only in `meta.caption` (§4 S15). The two controls strips
auto-scale independently (lean axes `0.8 … −31` and `0.2 … −36`) and neither
draws the 35° reserve or the 45° ceiling, so the reserve-eating line is visually
indistinguishable from the compliant one. And the "doctrinal" hold line's `f`
runs 1.000 → 0.895 → 1.002: it never comes inside, exits *on* the corridor edge
at `exit_f` 0.998, and is graded broken by the doctrine it is named after —
`hold_wide_for_sight [fail] committed while the sight line was still closing`,
plus `late_apex` and `out_in_out`. `danger_dwell_s` is 0 on both lines, so the
engine's own exposure channel says the reserve-eating line spent zero seconds
exposed; `vis=cautious` is inert (both lines hold 34.0 km/h, `sight_ride_m`
25–37 m against `ssd_m` 15.8–17.0, `stop_within_sight` passing with 13.6 m and
8.1 m spare). A figure titled "the reserve you keep for what you cannot see"
whose record says the rider can stop in half of what they *can* see is not a
repairable caption.

What survives is a verified negative result and four reproducible defects, moved
to §4: check 11 has no positive fixture and cannot get one on the shipped preset
(S16), single-station D10 constraints silently pass contradictory bounds (S21), a
`mistake` line beside a `vis` line returns `INTERNAL` (S22), and `bookBlind` has
no default ideal line (S23).

#### `chop` — Chapter 9 throttle doctrine on Chapter 8's corner. PARTIAL → OUT.

The strongest candidate in either pass, and the only one both lenses agreed is
mechanically honest. `throttle_rule` passes on the ideal line and fails on the
chop line with `discipline: ["chop at s=20.5"]`; the engine names the mechanism,
channel and station (`diagnosis {cause: "stand_up", at_s: 20.5, channel:
"su_transient", su_transient_max_dps: 220.01, cut_at_s: 20.31}`); the consequence
is emergent (`run_wide_detect` 30.93 → `off_road` 32.09 → `runoff`); and the
departure stays inside the rider's own lane (`d_min` −3.5, `d_max` −1.27). No
committed figure teaches a longitudinal-channel mistake: `throttle_rule` fails in
figs 8.5 and 8.6 only as chain collateral, on lines failing eight to eleven other
checks, with no throttle word in any note or label.

```
# the baked candidate — NOT ADOPTED
# Doctrine figure (Ch. 9 throttle rule, drawn on Chapter 8's canonical corner).
# NOT a reproduction of fig 9.1's ink.
# DISCLOSURE: the `chopped` line also records `rideability: fail`
# (max_excess_dps 102.95) — an event-timing seam, not rider behaviour.
road:      preset book90
lines:
  good:    ride entry=34 turnIn=auto
  chopped: mistake chop
marks:     turn_point,apex
labels:
  apex@good               "roll on from the apex"
  run_wide_detect@chopped "throttle chopped - the bike stands up and runs off"
view:      mode=diagram window=auto consequence=on
note:      "Shut the throttle mid-corner and the bike stands up: lean sheds, the
            line straightens, and the exit goes off the outside edge."
```

**Lens 2 (OUT) — governance, and the disclaimers reach nobody.** §4 S12 of this
file, committed at `a06d4a7`, names this exact artifact: *"a Chapter 9
good-vs-`chop` pair … All three are OUT here … an explicit remit call."* The
proposal is that artifact rediscovered, and it cites `design/01` and `design/03`
without citing the document that governs corpus growth and has already refused
its category. `design/01 §4.3`'s "Ch. 9 throttle doctrine" cell maps a *mistake
kind*, not a figure, so it does not override the remit. Separately: every `<text>`
node of the baked SVG is entry speed, outcome word, distance ladder, labels,
legend and scale bar. The "NOT book-figure parity" line and the rideability
disclosure live only in `#` comments in the scene source, which never render
(§4 S15), so a reader of the SVG cannot know it is not a reproduction.

Two supporting deflations, both accepted: the headline rationale ("its geometry
is textbook — `late_apex`, `out_in_out`, `single_input`, `quick_steer`,
`lean_ceiling`, `traction_ceiling` all pass and it still runs off") leans on a
vacuous pass, because `out_in_out` has no upper bound on `exit_f` and the chopped
line's pass at `exit_f` 1.02 is *satisfied by the runoff* (§4 S20), while the
other four are inherited unchanged from the good line by construction — `chop` is
a one-channel longitudinal perturbation. And the rideability disclosure is wrong
on its arithmetic: 102.95 °/s comes from the interval [20.0 → 20.5], not
[20.5 → 21.0] as the scene header states, and re-aligning `su` to the opening
sample still leaves 17.05 and 19.40 °/s against `RATE_TOL_DPS` = 2.0 — about ten
times over, versus 3.65 for shipped figs 8.1 and 8.3. It is a sub-sample
event-timing seam (`crack` fires at s = 20.31, between samples), and it does not
go away (§4 S26).

**Lens 1 (PARTIAL) — the disagreement, recorded.** The first lens verified every
number, agreed the contrast is real and non-vacuous, and would have admitted the
figure with two repairs: strike the "textbook geometry" rationale, and author the
mistake as `chop:slew_mss=20` rather than the default. That variant bakes exit 0
(the figure gate reads `row.admissible_outcomes`, so `wide` passes), keeps the
`throttle_rule` and `exit_containment` fails, drops the spurious
`stop_within_sight` fail, and cuts the rideability excess from 102.95 to 7.36 °/s
— within 2× of the shipped corpus's own 3.65 rather than 28×. The precedent it
cites is real: `fig-08-04.scene` uses `overspeed:by_kmh=2.5` against a TUNING
default of 26. The proposal's refusal of that variant as "tuning-to-look-clean"
is unsound. **The harsher verdict stands** — the repairs are at scene level and
do not touch the remit ground that killed it, so if S12 is ever resolved this
candidate returns with those repairs already argued.

#### `overread` — the timid line. PARTIAL → OUT.

`contained`/`caution` on `book90` against the ideal line, carrying `out_in_out`'s
**exit** leg only (`exit_f` 0.307 against the 0.55 bar, `ti_f` and `apex_f`
passing), with the apex at 87.5% of sweep against the ideal's 66.3%. It would
have been the corpus's first amber mistake line — all six committed mistake lines
grade `failing`. Robust across `sweep_believed_deg` ∈ {100, 110, 120, 130, 150}
and `r_believed` 11; clean at 11.5; `NO_SOLUTION/believed_world_not_clean` at
≤ 10.5, which is an honest typed refusal.

```
# the baked candidate — NOT ADOPTED
road:      preset book90
lines:
  good:    ride entry=34 turnIn=auto
  timid:   mistake overread:sweep_believed_deg=110
marks:     turn_point,apex
labels:
  apex@good   "apex at 66% of sweep - already pointed down the road"
  apex@timid  "apex at 88% of sweep - still hard on the inside"
  exit@timid  "exit at f=0.31: no drive, no room to be wrong"
view:      mode=diagram window=auto
note:      "Ride the corner as if it were tighter than it is and nothing goes
            wrong - except the exit, which is thrown away."
```

**Lens 1 (PARTIAL) — the carrying-check claim is padded and one label asserts
what no check grades.** `late_apex` returns `pass` on both lines (66.31% and
87.54%) and `lean_ceiling` returns `pass` on both (30.47° and 28.08°), so exactly
**one** check carries this figure. The `apex@timid` label asserts that
over-lateness is the fault; no check in the closed sixteen grades over-lateness,
and `late_apex` affirmatively ratifies 87.54% as a pass, "past the 50% bar".
That is a caption-only doctrinal claim the check catalogue actively contradicts.

**Lens 2 (OUT) — the exit label asserts two things the record refutes, in the
figure's own ink.** *"No drive"*: the timid line runs `a_long` = +2.200 m/s² from
apex to road end, bit-identical to the ideal line's, and `throttle_rule` reads
`pass`, "throttle rule held". The genuine consequence is exit speed — 49.5 versus
53.9 km/h at road end — which the scene does not draw and, per §4's closing note,
cannot draw. *"No room to be wrong"*: at exit the timid line sits 1.87 m from the
outer usable edge and 2.27 m from the physical road edge; the ideal line sits
0.40 m and 0.80 m. The timid rider has 4.7× more room toward the outside, where a
run-wide goes, plus more lean reserve (28.1° vs 30.5°) and lower ellipse use
(0.58 vs 0.63). A student with a ruler measures the opposite of the caption. This
is the ensemble claim the proposal's own unmodelled-claims list bans, made in the
opposite direction by the author who wrote the ban. Two lesser corrections: the
scene header presents `source.believed_road` as the DSL string `lane 3.5 | S 12 |
L 12 ^110 | S 16`, but the envelope carries a segments object with no `dsl` field
and `verdict.misjudgment` carries only `believed_road_hash: "e7e66e"`; and the
same governance ground as `chop` applies, since the proposal concedes it is not
parity.

#### Refused by their own proposer (3)

**The hairpin (`bookHairpin`) — OUT for redundancy.** All three candidate
differentiators died with a number. *The late bar:* `design/01 §A.3` check 1 puts
hairpins in `book90`'s bucket verbatim — "constant-radius (**incl. hairpin**) →
pass iff `apex_pct > 50`" — and the bake agrees (hairpin 66.85% at bar 50,
`book90` 66.3% at bar 50). *The slower entry:* it has no carrying check by
explicit design decision (`design/01 §A.4`, "Considered and rejected: a separate
`entry_speed` check"), and the solver's `NO_SOLUTION`/`empty_band` refusal above
30.5 km/h is not distinctive — `book90` refuses identically above 34. *The lean
demand:* real as a number (φ_max 39.17° vs 30.47°, `grip_min` 0.155 vs 0.37,
`ellipse_max` 0.84 vs 0.63) but `lean_ceiling` is structurally pinned to `pass`
on this road, because the solver clamps commanded lean at `phiReserve` and the
maximum observed across the whole entry sweep and all eight mistake kinds is
40.36° = the reserve exactly (§4 S27). Every mistake kind's fail set on the
hairpin is a subset of, or identical to, a shipped figure's — `slow_steer`
reproduces fig 8.2's set exactly, `overspeed:2.5` fig 8.4's. The one apparently
new lesson, `overspeed:by_kmh=1` grading 9 pass / 1 fail ("you did everything
right and you are still in the ditch"), was retracted by its own proposer: it is
`out_in_out`'s off-road arithmetic (§4 S20), already present on shipped fig 8.1's
`bad` line at `exit_f` 1.148. The scene bakes green and deterministic (SVG SHA1
identical on re-bake); it is the claim that fails, not the bake.

```
# the baked candidate — NOT ADOPTED
road:      preset bookHairpin
lines:
  good:    ride entry=30 turnIn=auto
  fast:    mistake overspeed:by_kmh=1
marks:     turn_point,apex
labels:
  apex@good            "late apex — 66.8% of a 150 degree sweep"
  run_wide_detect@fast "+1 km/h — the shape held, the road ran out"
view:      mode=diagram window=auto
note:      "A hairpin is a 90 degree corner with the reserve spent: same
            late-apex method, 39.2 degrees of lean against a 40.4 degree reserve."
```

**`premature_contained` — OUT, and it must not be drawn.** Its design-pinned
mandatory check is vacuous in exactly §A.2's sense: on its own pinned fixture
F-ORACLE-90, `late_apex` **passes** at every `early_by_m` from 1 to 8 (61%–80% of
sweep — *later* than the ideal line's apex), and the engine's own suite ratifies
the pass (`linelab/test/oracle/oracle.test.ts:368`, SEAM-PC-LATE-APEX), while
`linelab/src/plan/mistakes.ts:175` freezes `expect_fail: ["late_apex"]` and
`linelab/src/solve/gate.ts` rule 2 turns it into a hard requirement — so every
bake exits 3, forever (§4 S17). What kills it outright is the surviving check:
`out_in_out` fails only because `apex_f` goes negative — the line crosses the
inner usable edge. With `own = −W/2, oncoming = +W/2`
(`linelab/src/sight/footprints.ts`) and the measured corridor map d = −0.4 −
2.7·f, the default line reaches **d = +2.38 m**, past the centre of the oncoming
lane and through the spot where fig 8.1 parks its oncoming vehicle — and the
engine still grades it `contained`, because `design/05 §6.1` rules that an
inside-corridor excursion on pavement never moves outcome (§4 S19). Amber under a
caption about street reserve would be the most dangerous sentence in the corpus.
The only settings that stay in lane (`early_by_m` 4–5) grade quality **good** — a
mistake figure with no mistake.

**`underread` — OUT for redundancy.** Mechanically fine (exit 0, `runoff`
matching the pin, believed world verified clean and hashed), but on F-ORACLE-DR
it fails exactly `{late_apex, out_in_out, exit_containment, stop_within_sight}` —
the identical set fig 8.4's committed red line fails, on the identical road,
against the identical green line, departing at the identical `exit_f` 1.148.
Moved to `book90` it collides with fig 8.1; moved to `bookHairpin` the same four
fire. The teaching that would make it non-redundant — "your plan was clean in a
world that isn't this one" — is computed in `verdict.misjudgment`, carried by no
check, not named by `verdict.diagnosis` (null on every `underread` line baked),
and has no rendering surface at all (§4 S18). Worse, on this fixture the
divergence block reads `{kind: "radius", believed: 16, actual: 16}` — believed
equals actual, because the taper's entry radius *is* 16 — and cites
`kappa_gap.at_s` 38.5 on a line that terminates off-road at s = 35.87.

### The minimal-claim round (round 3, 2026-07-28) — 2 candidates, 0 survive

Run to settle S31, which had ended the previous pass on a hypothesis rather than
an answer. Both candidates were re-authored from scratch in the untried shape —
**fewer placards on a simpler claim**, a teaching sentence that is exactly what
the carrier grades — at 2 and 3 placards against the previous round's five and
six. Attacked by three lenses, ship requiring all three: **merit + remit**,
**disclosure**, and a new **stranger** lens whose procedure is to read only the
emitted SVG, write down every belief a rider would form from the ink *before*
opening any JSON, and then test each belief against the envelope.

| candidate | carrier | merit | disclosure | stranger | final |
|---|---|---|---|---|---|
| `fig-08-D3` (chop, 2 placards) | `throttle_rule` discipline leg | — | — | — | **OUT** — self-refused on remit (S32) before attack |
| `fig-08-D4` (overread, 3 placards) | `out_in_out` exit leg | **cleared** | OUT | OUT | **OUT** |

**`fig-08-D3` — the disclosure repair worked, and the figure died anyway.** The
sentence both round-2 lenses had killed ("the throttle was shut") was rewritten
once, on the first attempt, into a claim about the *rate* of withdrawal behind the
guard the check actually tests — and it held. That is the first repaired-and-held
disclosure sentence in the project, and it is what answers S31's strong reading.
The figure was then refused by its own author on **remit**: `throttle_rule` is the
pack's only Chapter 9 check, the S12 grant is scoped to Chapter 8, and no filename
for the figure is honest (S32). The author's reasoning is worth preserving:
*"reading a conflicted licence in the direction that authorises one's own artifact
is the flattering direction, and the flattering direction is the exact species that
has killed all six reviews."*

The round's sharpest method finding also came from here: **the repair brief handed
to the author, written from the round-2 attackers' own recommendations, would
itself have been the seventh kill.** It proposed *"drive withdrawn at 40 m/s³
against the 8 m/s³ bar"*. The ideal green line **in the same figure** reaches
`a_cmd_rate` = −12 m/s³ against that 8 m/s³ bar, and `throttle_rule` grades it
*"throttle rule held"*. A student told "40 against the 8 bar" concludes "faster
than 8 fails", and the green line refutes that at 12. The discriminator is the
**guard** (`|phi| >= SMALL_LEAN_DEG`, and the loop starting at
`steering_complete`), not the bar. The author caught it and led with the guard.

**`fig-08-D4` — cleared on merit, killed on ink twice.** The merit lens re-baked
independently and swept **every integer** in the admissible band 99..169: 71/71
`out_in_out` `fail`, the exit clause the sole violated clause at every one,
`ti_f` = 1 throughout, crossing verified at 98/99. It also swept `overread`'s
*other* parameter spelling (`r_believed`, the one that killed `fig-08-D2` in round
1) and found the claim invariant there too. The road is `design/03 §7.1`'s own
`overread` oracle fixture. Nothing on merit; and the S30 provenance placard, the
one clause the previous round had killed, was repaired and **cleared** by the
disclosure lens.

It died on two things that are not sentences:

- **Its teaching sentence names a standard the check does not enforce.** *"Never
  comes back out to the outside of the lane: `out_in_out` grades its shape
  broken"* — true of the amber line, but the colon offers it as the *ground of the
  verdict*, so the reader learns that the check requires returning to the outside
  of the lane. The bar is at 53.9% of lane width, the *ideal* line never reaches
  the outside either, and no drawable line can (S33).
- **The markers teach the reverse of the record.** The stranger lens's belief B11,
  written from the ink alone: *"The amber run carries no turn point, apex, release
  or exit markers. I read that as: it never achieved a clean apex or a clean
  release — it just stayed bent over."* The record: the mistake line apexed at
  **87.5%** of sweep against the ideal's 66.3%, f 0.222 against 0.277 — later and
  deeper — and **passed** `late_apex` (S34).

The stranger lens contradicted four beliefs in total, and two of the four are
about the shipped corpus rather than this candidate: B10 (the two lines are
assumed to diverge only at the exit — they differ from the brake marker onward,
2–5 km/h apart from s ≈ 2) and part of B3 (*"solved 34 km/h"* reads as *the right
speed for this corner*; 34 is an **input**, and the ideal line peaks at
53.86 km/h — the one speed printed beside a moving bike is true only at s = 0).
Neither was raised as a STOP: both are legend/chrome grammar shared by all six
committed figures, and neither was load-bearing for the verdict. They are recorded
here because a future doctrine figure will meet them again.

### Question (a): pass 1 carried no attacker kills

**No pass-1 adjudicator verdict was killed by an attacker, because no pass-1
verdict reached IN or PARTIAL.** The adversarial lenses attack IN and PARTIAL
verdicts; all eight groups returned OUT on every figure, so the attack pass had
nothing to fire at and returned empty for all eight. That fact is part of the
record: **the OUT verdicts in §2 rest on the adjudicators alone**, with one later
exception — the steelman pass tasked three defenders with arguing that a refused
figure is in fact reproducible, and 3 of the 81 (2.9, 9.1, 11.TB) have now been
pressed from the other direction. All three held. The remaining 78 have not been.
Where a verdict was close, §2 records the evidence that decided it.

What *was* killed is the ROADMAP's starting hypothesis. Three rows are overturned:

| ROADMAP row | hypothesis | adjudicated | what killed it |
|---|---|---|---|
| 9 Throttle Control, 9.1 | **in** — `throttle_rule` already exists | **OUT** | The check exists; the figure is not a picture of it. Brake and throttle are one signed `cmd_a`, so the overlap the caption calls out cannot be drawn. Worse, the solved roll-on is flat at 2.2 m/s² through the whole lean unwind, so the engine's own ideal line *contradicts* the printed exit curve. |
| 11 Braking, 11.1 | **in** — `trail_brake_taper` already exists | **OUT** | The row conflates the check with the figure. Fig 11.1 is a body-position photograph of an upright straight-line quick stop, on which check 6 returns `na` (`brake_complete_baseline`) — there is no corner, no turn-in, no lean. The trail-brake doctrine the check anchors to has no printed figure. |
| 2 Steering, 2.1–2.9 | **partial** — `quick_steer` / `single_input` grade steering outcome | **OUT (all nine)** | The two checks are real, but no Chapter 2 figure carries them. The one Chapter 2 sentence linelab genuinely models — quicker input → faster lean, longer pressure → more lean — is printed as prose with no figure attached, and both checks are already carried by figs 8.2 and 8.3. |

Two ROADMAP rows were silent and are now resolved: **15.x Suspension Setup —
OUT** (24 figures, §2 buckets A and I), and **Ch 1 Traction / Ch 4 Fear — OUT**
(9 figures, §2 buckets B, J, K). The rows for 3, 5/6, 10, 12, 13, 17/18/19 are
confirmed as skimmed.

### Disagreements recorded rather than papered over

- **Two independent passes covered Chapters 15, 17, 18 and 19** — the
  "Section 4 + Section 5" group and the "residual sweep" group. Both returned OUT
  on all 37 shared figures, so the verdict is unaffected, but their *descriptions*
  diverge on six images. For 15.5, 15.7, 15.9, 15.21 and 15.23 the first pass
  described the figure from the chapter's numbered symptom prose (e.g. 15.9 =
  "Fork symptom 3, Poor Traction", a side-elevation panel) while the second read
  the image itself (15.9 = a plan-view tuck diagram). **Where they disagree the
  image-derived reading is authoritative** and is what §2 records; 15.9, 15.23 and
  15.21 are filed on that basis. Anyone re-opening these should re-read the images
  before trusting either description.
- The first pass labelled Chapter 19 "Riding Gear" per the group brief and then
  corrected itself: **Chapter 19 is Fitness; Chapter 20, Riding Gear, contributes
  zero figures.** `FIGURES.tsv` ends at 19.8.
- `fig-15.10__image00367.jpeg` (p.137) is filed under a duplicate "15.10" number.
  It is almost certainly the book's fig 15.11, which is absent from `FIGURES.tsv`.
  It is a distinct image, not a duplicate of `fig-15.10.jpeg`, and is adjudicated
  on its own in §2 bucket I as 15.10b.
- **The two lenses split on the `chop` / `overread` tranche: PARTIAL versus OUT.**
  Lens 1 verified every number, found the contrasts non-vacuous, and would have
  admitted both figures with scene-level repairs (`chop:slew_mss=20`; cut
  `overread`'s carrying-check claim to `out_in_out` alone and strip the apex
  labels' implicature). Lens 2 killed both on the §4 S12 remit and on
  `overread`'s exit label. The harsher verdict stands and both are OUT, but the
  disagreement is narrow and worth naming: **lens 1 found no reason to refuse the
  `chop` pair on the merits, and lens 2 refused it on governance rather than on
  the merits.** If S12 is resolved in favour of doctrine figures, that candidate
  re-enters with lens 1's repairs already specified and lens 2's rendered-placard
  requirement (§4 S15) outstanding.
- **The steelman and the tranche converged on the same artifact from two
  directions.** A defender of fig 9.1 and a proposer sweeping the undrawn mistake
  kinds independently arrived at the same `good`-vs-`chop` pair on `book90`, both
  labelled it Chapter 9 doctrine rather than parity, and both were refused under
  the same remit. Three independent passes now agree it is honest and
  unauthorized. That is the strongest single input to S12.

### Steelman artifacts preserved so they are not re-derived

Neither is adopted. Both are recorded because they were baked and verified, and
because re-deriving them costs more than storing them.

**`fig-09-D1` — the Chapter 9 doctrine pair (see §2's steelman, 9.1).** Identical
in structure to the tranche's `chop` candidate above; its note is the fuller
placard and is preserved for that reason:

```
road:      preset book90
lines:
  good:    ride entry=34 turnIn=auto
  chop:    mistake chop
marks:     turn_point,apex
labels:
  apex@good             "roll-on already open — lean held to the apex"
  run_wide_detect@chop  "stood up after the cut — running wide"
view:      mode=diagram window=auto consequence=on
note:      "Cut the throttle once the roll-on has begun and the line does not
            tighten: the bike stands up, hands back lean faster than the rider can
            steer it down, and runs wide. throttle_rule passes on the ideal line
            and fails the chop line on its chop leg (chop at s = 20.5 m; cut at
            20.31, cause stand_up, channel su_transient). Only that one leg
            carries — crack, v_min-at-apex and roll-on-onset pass on every line
            the grammar can author, so this figure claims none of them. NOT book
            fig 9.1: linelab carries one signed longitudinal command, so the
            brake/throttle overlap fig 9.1 is built around cannot be drawn; and
            the solved roll-on is a fixed 2.2 m/s2 constant that stays flat
            through the whole lean unwind, so fig 9.1's exit anticorrelation is
            contradicted, not reproduced. Chapter 9's own reason for the rule
            (ground clearance) is out of scope, design/01 section 8; the run-wide
            consequence linelab models is the book's Chapter 2 and Chapter 11
            sentences, and its magnitude is a calibrated Tier-1R net effect
            (design/02 section 5.1), not a measurement. The two controls strips
            are auto-scaled independently — compare shapes, not magnitudes."
```

Recorded with it: the variant `mistake chop:slew_mss=10` gives the cleanest
doctrine story on paper (`contained`/`caution`, `throttle_rule` the only non-pass
check) but its top-down exits at lane fraction 0.702 against the ideal's 0.849 —
the mistake line draws *tighter* than the ideal, so the picture argues against the
check. It is not to be re-proposed.

**`fig-11-TB` — the trail-brake taper figure (see §2's steelman, 11.TB).** Not a
`.scene`, and that is load-bearing rather than a formatting choice (§4 S28):

```json
{
 "road": {"dsl": "lane 3.5 | S 35 | R 30 ^90 | S 25"},
 "lines": [
  {"name": "tapered", "role": "ideal",
   "spec": {"spec": "linelab/1", "id": "tapered",
     "road": {"dsl": "lane 3.5 | S 35 | R 30 ^90 | S 25"},
     "rider": {"start": {"speed_kmh": 60, "f": 1}, "profile": "street",
       "plan": [
         {"do": "brake",    "id": "b1",    "decel": 3.0, "at_s": 1, "taper_to_s": 50},
         {"do": "turn_in",  "id": "ti_c1", "at_s": 28.788214525856546,
                            "target": {"lean_deg": 28.825203306970423}, "hand": "R"},
         {"do": "throttle", "id": "ro",    "at_s": 53.12328574487435, "accel": 2.2}]}}},
  {"name": "held", "role": "alternative",
   "spec": {"spec": "linelab/1", "id": "held",
     "road": {"dsl": "lane 3.5 | S 35 | R 30 ^90 | S 25"},
     "rider": {"start": {"speed_kmh": 60, "f": 1}, "profile": "street",
       "plan": [
         {"do": "brake",    "id": "b1",    "decel": 3.0, "at_s": 14},
         {"do": "turn_in",  "id": "ti_c1", "at_s": 28.788214525856546,
                            "target": {"lean_deg": 28.825203306970423}, "hand": "R"},
         {"do": "throttle", "id": "k1",    "at_s": 38, "accel": 0},
         {"do": "throttle", "id": "ro",    "at_s": 58, "accel": 2.2}]}}}],
 "marks": ["turn_point", "apex"],
 "labels": [
  {"feature": "apex", "line": "tapered",
   "text": "apex 0.67 m clear - taper already at 1.0 m/s2 when lean passed 15 deg; su_sustained 0.0 deg/s"},
  {"feature": "apex", "line": "held",
   "text": "apex 0.08 m clear - still 3.0 m/s2 at 15 deg lean; su_sustained 8.6 deg/s of a 50 deg/s budget"}],
 "view": {"mode": "true", "window": "auto"},
 "note": "DOCTRINE FIGURE - reproduces no printed figure. Chapter 11's only numbered figure is 11.1, a body-position photo of an upright straight-line quick stop, on which trail_brake_taper returns na. Same road, same 60 km/h entry, same turn-in at s=28.79 and same 28.83 deg commitment; only the brake profile differs."
}
```

Its four required placards, verbatim — the figure over-claims without all four,
and none of them renders today (§4 S15):

> **P1** "This figure makes no claim that trail braking is better. parks-street/2
> grades the brake-complete baseline: the solver's own line on this road at this
> entry is contained/good with trail_brake_taper na (brake_complete_baseline). The
> only thing any shipped check says about a taper is that it did not force
> stand-up."
>
> **P2** "trail_brake_taper: pass means no leaned sample crossed the 2.5 m/s2
> onset - it does not mean the trail brake helped. Across a 25-cell brake sweep on
> this road the check returned pass in every cell, including cells that ran off the
> road, and it returns pass for an 8.0 m/s2 brake because the bike never reaches
> 15 deg of lean. Read the green line's grade, not its tick."
>
> **P3** "Chapter 11's four claimed benefits of trail braking - suspension
> movement, rake and trail, reaction time, and suspension-mediated line-tightening
> - are all Tier-3 and out of scope (design/01 §8). None of them is claimed here."
>
> **P4** "The alternative line also fails out_in_out and throttle_rule. The
> throttle_rule fail is a rubric artefact: check 5 exempts the entry-brake action
> id, but the brake's release ramp belongs to the throttle action that supersedes
> it, so the release is scored as a mid-corner brake at s=38.5."

---

## 4. Open design questions (STOP list)

Nothing here gets authored in Phase 2. Each entry names what it would need and
what it would take to decide it. Per the ROADMAP's own instruction, a figure that
needs a mistake kind, a check, or an engine change that does not exist is a
design question, not a fix.

**S1 — mistake kind: external steering disturbance.** *Needed by:* fig 2.3.
A road obstacle deflecting the bars involuntarily. All eight closed kinds perturb
what the rider commanded or believed; none perturbs what the road did to the
machine. *To decide:* whether the mistake vocabulary may contain non-rider
causes at all, which is a D3 question before it is a vocabulary question.

**S2 — mistake kind: throttle applied before the steering input completes, plus
a check leg that can see it.** *Needed by:* fig 9.1b. `throttle_rule` leg (c)
cannot detect a too-early roll-on: its onset search starts at `crackIdx + 1`
(else `scIdx`, else `w.i0`), so a drive command placed before `steering_complete`
is scanned past, not flagged. *To decide:* whether ordering the roll-on against
`steering_complete` is doctrine `parks-street/2` should grade — and if so, both a
kind and a fifth `throttle_legs` leg are needed.

**S3 — mistake kind: trail-brake-too-hard at lean, owned by the entry-brake
action.** *Needed by:* fig 11.TB. `chop` cannot serve: §A.3 check 5 routes
entry-brake samples away from `throttle_rule` to check 6 by `action_id`, *"the
recorded action_id makes the split mechanical, not heuristic"* — by design.
*To decide:* together with S7, since a kind with no pack to grade it against
teaches nothing.

**S4 — mistake kind: drivetrain downshift error.** *Needed by:* fig 10.2's
failure case (engine speed too low on clutch release, rear wheel hops). Barred
independently as Tier-3 tyre slip, and there is no clutch or gear channel to
perturb. *To decide:* only if D3's control set is ever reopened.

**S5 — mistake kinds: machine faults.** *Needed by:* all nine plan-view Chapter
15 figures (§2 bucket I) — chassis geometry (insufficient trail, excess trail),
suspension deficit, tyre slip, chassis compliance, steering oscillation. *To
decide:* this is the same question as S1 at larger scale — may a linelab mistake
be something other than a rider error? Note that even with such kinds, G1 still
forbids the authored "intended path" every one of these figures draws.

**S6 — mistake kind: rider posture / arm tension.** *Needed by:* figs 12.1,
12.7. Foreclosed by §8's body bullet, which says no equivalent is attempted.
Recorded for completeness, not as a live question.

**S7 — rubric pack: `trailbrake-street/1`.** Named in `design/01 §A.6` and does
not exist. Under the shipped `parks-street/2`, which *"encodes the brake-complete
baseline, `trail_brake_taper`'s `na`-when-baseline"*, a passing taper earns only
"the taper did not force stand-up" — a safety floor, not Chapter 11's argument
that trail braking is *better*. *To decide:* §A.6's own requirement — a versioned
data file with book-resolvable provenance.

**S8 — rubric pack: low-speed / U-turn doctrine.** Chapter 13's central claim is
*"in tight U-turns you purposely want to use up as much lean angle as possible"*,
which inverts check 8 `lean_ceiling` (pass iff `phi_max ≤ phiReserve`). A
correctly-ridden Chapter 13 line grades amber or red under `parks-street/2` by
design, and the special-case `na` table has no low-speed row. *To decide:* moot
while §8 bullet 1 rejects the geometry at validation; it would become live only
if the U-turn regime were ever brought in scope, which §8 says is *"a different
tool."*

**S9 — render surface: the friction-ellipse decomposition.** *Needed by:* fig
1.8. `n_lat`, `n_long` and `grip` are recorded per sample (`design/05 §2`) but no
view plots them; `design/06 §4`'s controls channel list is closed. *To decide:*
whether a grip-decomposition channel or a dedicated ellipse view belongs in the
design. This is the one refused figure whose *quantities* the engine already
holds.

**S10 — render channel: phase banding, versus colour law v2.** *Needed by:* fig
2.9's green/blue steering-mode bands. Colour law v2 (`design/01 §3`,
`design/06 §5.1`) makes a line's colour its verdict, and `design/06 §4` carries a
hard neutral-palette rule so *"nothing in the strip reads as a line verdict."*
Banding a line by phase either breaks that law or needs a channel that does not
exist. *To decide:* not worth deciding for 2.9 alone, which is refused on two
other grounds regardless.

**S11 — engine/design tension: `check` is weaker on the `.scene` path. RESOLVED
— adjudicated a defect, and fixed.** `check <file>.scene` on a super-tight road returned
`{"ok":true,"value":{"valid":true,"spec_hash":"87402f"}}`, while `check
<scenario>.json` carrying the same road correctly returned
`OUT_OF_SCOPE`/`super_tight_geometry`, as did `run` and `figure` on both.
`design/01 §8` says the regime is *"rejected `OUT_OF_SCOPE` at validation"*, and
`design/08` specs `check` as validate-only, *"same code path as `figure --check`"*.
The scene path appears to defer the road build to `figure`, so the typed rejection
arrives one verb later than the design sentence implies. No fake figure can
escape — `figure` refuses — but the two paths disagree.

*Decided: a defect, not a design question.* Both cited sentences are
unambiguous, and the FigureSpec JSON spelling was found to share the weakness
(the scene lowers to it, D30) — so the divergence was between the *figure* door
and the *scenario* door, not between two file extensions. The lint had no road
build of its own: `validateFigureSpec`/`lowerScene` are shape-level, and only
`solve/run.ts`'s `composeWorld` composed the road. The figure world validation
is now one declaration — `validateFigureWorld` in `linelab/src/plan/validate.ts`,
called by the bake (`composeWorld`) and by the lint (`lintFigureSpec` in
`linelab/src/cli/verbs/shared.ts`, which `check` and `figure --check` both call
and which is now the only thing either of them calls). All spellings of the same
super-tight road — `check`/`figure --check`/`figure`/`run`, scene text, FigureSpec
JSON and wire Scenario — now return the identical `OUT_OF_SCOPE`/
`super_tight_geometry` error at exit 2. The fix only ever refuses more: the six
committed scenes still lint valid at their manifest `spec_hash` and re-bake
byte-identical. Regressions live in `linelab/test/cli/schema.test.ts`.

**S12 — remit: may linelab author non-parity doctrine figures?** Three honest
artifacts exist that reproduce no printed figure: a trail-brake taper scene
(§2, 11.TB), a Chapter 9 good-vs-`chop` pair, and a Chapter 12 controls strip of
the roll-on. Each teaches something the engine genuinely computes. All three are
OUT here because the ROADMAP's remit is *"every other book **figure** the
doctrine can honestly grade"* and its Phase-2 instruction is *"read that figure's
book text **and image**, then write a `.scene`."* *To decide:* an explicit remit
call. If non-parity figures are authorized, the corpus is not empty; under the
current remit it is.

*Updated by the steelman and the doctrine tranche.* This is now the load-bearing
STOP in the file. Three independent passes have converged on the same conclusion
from three directions: a defender of fig 9.1 (§2 steelman), a defender of 11.TB
(§2 steelman), and a proposer sweeping the four undrawn mistake kinds (§3) each
produced an honest artifact that reproduces no printed figure, and each was
refused on this remit rather than on the merits. One lens explicitly declined to
refuse the `chop` pair on any other ground. The queue, in order of strength, is:
(1) the `good`-vs-`chop` pair on `book90` — Chapter 9 doctrine on Chapter 8's
road, the only candidate in either pass whose mistake lives in the longitudinal
channel, which would take `fig-08-07`; (2) `fig-11-TB`, conditional on being
retitled to be about the stand-up ceiling rather than the technique, and on S28;
(3) `overread`'s timid line, conditional on its labels being cut back to what is
computed. All three additionally require S15, since each depends on a placard a
reader can see. *To decide, unchanged:* an explicit remit call, which is the
design owner's and not an adjudicator's.

**S13 — phase vocabulary: the book's bands are forbidden as labels, and they
also disagree.** `design/05 §4.1` and `design/06 §4` both state normatively that
*"the book's entry/mid/exit words stay caption and anchor vocabulary, never band
labels."* They also genuinely disagree with linelab's five-token `Phase`
(`approach | turning | midcorner | exiting | done`): on the `book90` ideal line
the bands are approach 0→6.97, turning 6.97→11.99, midcorner 11.99→15.31, exiting
15.31→38.28, done 38.28→46.85 — `midcorner` is 3.3 m of an 18.85 m corner, and the
lean plateau (12→33.6) sits almost entirely inside `exiting`. The book's
Mid-Corner plateau lands inside linelab's Corner Exit. *To decide:* nothing, for
now — it is a hard blocker on reproducing any book timing chart as a controls
strip, and it is already resolved by refusal.

**S14 — extraction: `fig-15.10__image00367.jpeg` is unnumbered.** Filed under a
duplicate "15.10"; almost certainly fig 15.11, which `FIGURES.tsv` omits.
*To decide:* an extraction-hygiene fix, not a design question. Recorded so the
87-image accounting reconciles.

### Added by the steelman and the doctrine tranche (S15–S28)

**S15 — render surface: nothing renders a placard. RESOLVED 2026-07-27, built
(commit `84f2320`).** The two-way question below was settled by precedence, not
by a new decision: `design/06 §3.1` draw-order **stage 11** already listed
"figure-level placard boxes" among the renderer's required margin chrome and
closed with "Placards are rendered elements, never errors", and `design/01 §8`
makes placards part of every renderer's contract. The letter outranks this file,
so the gallery-only branch was never live. An opt-in top-level `placards:` scene
key (and its FigureSpec JSON twin) now carries an ordered list of author-supplied
strings to wrapped neutral-ink `<text>` boxes at stage 11 **and** to a `placards`
array on the export manifest — the manifest half is mandatory, since `J7` "no
fabrication" fails ink the manifest does not declare. The key is omitted when
absent, so all six committed figures still bake byte-identical at their committed
`spec_hash` stamps. Amended `design/03 §8`, `04 §7`, `06 §3.1` and `06 §7`;
author-supplied placard text is a new category, every other placard the letter
names being a design-owned verbatim string. **The original entry is preserved
below, because the corpus pass's reasoning rests on it.** *Needed by:* every
artifact in the S12 queue, the honest refusal form of fig 2.9, and the standing
rule in §1. In the shipped v0.1 build the only rendered free text is `labels:`, which must
hang off one of eight closed anchors. `view: mode=diagram` is rejected `SCHEMA`
(deferred, "projection (post-v0.1)"); `render/project.ts` sets `footnote: null` in
true mode; `note:` lands in `meta.caption` and never becomes ink; `#` comments in
a `.scene` never render. Verified by extracting every `<text>` node from baked
SVGs of both candidates *and* of shipped `fig-08-01` — entry speed, outcome word,
distance ladder, labels, legend, scale bar, nothing else. The Chapter 8 precedent
puts notes in `gallery.html` only. *Consequence:* a figure whose honesty depends
on a concession the student must see is currently undrawable, and the placard
policy's own failure mode — a refusal the student never sees — is the default.
*To decide:* whether a rendered placard/footnote channel belongs in `design/06`
before any doctrine figure is authorized, or whether the gallery page is the
sanctioned placard surface and figures may never ship as standalone SVGs.

**S16 — fixture: check 11 and the blind lean cap have no positive fixture.**
*Needed by:* any blind-corner figure. `hold_wide_for_sight` is `na (not_blind)`
on every line of all six shipped figures, and `lean_ceiling` reads
`reserve_deg: 40.36, blind: false` on all six, so `BLIND_RESERVE_DEG` = 35 is
exercised by nothing committed. On `bookBlind` the check is **structurally
unpassable**: its release leg needs `s(turn_in) ≥ release(c) − 2.0`; measured
`release(c)` is 25.0–27.5 m on every line baked, while the feasible explicit
turn-in band is 11.0–18.0 m (18.5 refuses `turn_in_infeasible_early`, 19.5 and
above `turn_in_infeasible_late`), at every entry 20–36 km/h. The intervals do not
intersect, so check 11 can only ever return `fail` there. The cause is geometric:
the 36 m hedge (`-6x36`) spans the whole 29.3 m arc, and the ^140 reshape that
made `blind(c)` true everywhere is the same reshape that pushed `release` past the
turn-in band. It *is* passable in principle — `blind: true` **and**
`hold_wide_for_sight: pass` were reached at `hedge inside c1 -8x10` (release 14.0,
turn-in 13.02), and at `-8x11`, `-6x8`, `-6x9`, `-10x11`, `-10x12`. *To decide:*
shorten `bookBlind`'s hedge span (it is design of record, but no committed figure
uses the preset, so nothing moves), author a separate doctrine road, or record
that check 11 has no positive fixture and accept it.

**S17 — pin conflict: `premature_contained`'s mandatory check.** `design/01 §A.4`
and `design/03 §7.1` both pin the kind's mandatory failure as `late_apex`. On the
pinned fixture F-ORACLE-90 it **passes** at every `early_by_m` from 1 to 8 that
meets the pinned `contained` outcome (61%–80% of sweep). The engine freezes the
pin at `linelab/src/plan/mistakes.ts:175` (`expect_fail: ["late_apex"]`),
`linelab/src/solve/gate.ts` rule 2 turns it into a hard `checks_fail` requirement,
and `linelab/test/oracle/oracle.test.ts:368` ratifies the pass as SEAM-PC-LATE-APEX
("premature_contained's taught check is out_in_out on this engine"). Every bake of
the kind therefore exits 3 with "expected check `late_apex` to fail — it did not".
Off F-ORACLE-90 the two halves of the pin become mutually exclusive: `bookHairpin`
and `bookDecreasing` at `early_by_m` 10 do fail `late_apex` (24.8% / 29.4%) but
grade `runoff`, outside the kind's admissible set. *To decide:* a pin flip is a
design change (`design/03 §7.1` rule 1, "full stop"), or an engine change. Not
authorable either way until it is decided.

**S18 — render surface: `verdict.misjudgment` has none.** *Needed by:* any figure
whose lesson is the belief — `underread` dies on this, and `overread` survives
only because its lesson is visible in the drawn line without the belief. The
believed road, `s_divergence_m`, `kappa_gap` and `believed.outcome` are computed
and in-hash, but `rg "misjudg|believed" linelab/src/render/` returns nothing
across all render files, `design/06` and `design/07` never mention it, and the
closed label-anchor set has no divergence feature. `verdict.diagnosis` is `null`
on every `underread` line baked, so the diagnosis channel does not name the belief
either. Two lesser defects sit inside the same channel: on F-ORACLE-DR the
divergence block reads `{kind: "radius", believed: 16, actual: 16}` because the
taper's entry radius *is* 16, and it cites `kappa_gap.at_s` 38.5 on a line that
terminates off-road at s = 35.87. *To decide:* whether a believed-road ghost path
or a divergence-station marker belongs in `design/06`.

**S19 — verdict semantics: `contained` does not mean "in your lane".** With
`own = −W/2, oncoming = +W/2` (`linelab/src/sight/footprints.ts`) the oncoming
lane is d ∈ [0, +3.5]; the measured corridor map on `book90` is d = −0.4 − 2.7·f.
A default `premature_contained` line reaches **d = +2.38 m** — past the centre of
the oncoming lane, through the spot where fig 8.1 parks its oncoming vehicle — and
a `bookDecreasing` variant reaches +3.45 m, past its far edge. Both grade
`contained`, correctly per `design/05 §6.1` ("an inside-corridor excursion on
pavement never moves outcome"). *To decide:* whether a figure may draw such a line
at all, and whether the outcome vocabulary needs a term that distinguishes "inside
your own corridor" from "in the oncoming lane". Recorded as a scope-of-drawing
question, not as a request to change the outcome rule.

**S20 — rubric arithmetic: `out_in_out` is unbounded above in `exit_f`.** The
exit leg is `exit_f >= OIO_OUTSIDE_MIN` (0.55) with no upper bound, and the swing
leg is `max(ti_f, exit_f) − apex_f >= 0.4`, so both get *easier* the further past
f = 1 a line terminates. Pre-existing in the shipped corpus, not introduced by any
candidate: fig 8.1's `bad` line is `runoff` with `out_in_out` **pass** at
`exit_f` 1.148, and fig 8.3's likewise. This produced one retracted headline (the
hairpin's "nine checks passed and you're off the road") and one struck rationale
(the `chop` pair's "textbook geometry"). *To decide:* whether an off-road
termination should suppress the check rather than satisfy it. A rubric change, so
a design change.

**S21 — engine defect: single-station D10 constraints are silently vacuous.** On
`preset book90`, `ride entry=34 turnIn=auto constraints="f<=0.05@mid:c1"` returns
a clean line with `constraints: [{bound: "f_max", value: 0.05, satisfied: true,
worst: {s: 21.42, value: 0, margin: 0}}]`; so does the contradictory
`f>=0.95@mid:c1` on the same road, and so does `v_kmh<=10@mid:c1` on a line
running ≈ 30 km/h. `worst.value` is always 0 — the evaluator never reads the
sample. Span constraints work correctly (`f<=0.05@s:24..s:26` → `NO_SOLUTION` /
`constraint_unmet`). This defeats `design/04 §4.5`'s idiom `f>=0.6@entry:c1..mid:c1`
in its point form and is a `satisfied: true` on an unmet bound — the silent-pass
class `design/01 §8` forbids. *To decide:* defect or design clarification; found
incidentally and not fixed here.

**S22 — engine defect: a `mistake` line beside a `vis` line returns `INTERNAL`.**
`lines: hold: ride entry=34 vis=cautious / fast: mistake overspeed:by_kmh=8` on
`bookBlind` returns `INTERNAL` at `solve.executeSolvedPlan`: "solver-emitted plan
failed validate(): position target unreachable in 13.0 m (need ≈ 16.1 m)",
`{reason: "solved_plan_invalid", inner: {reason: "position_target_unreachable"}}`.
The V2-generated `position` action is carried into the perturbed plan without
re-solving its reachability at the raised entry speed. *Consequence:* no
blind-corner figure can put a mistake line beside a vis-governed line.

**S23 — preset hygiene: two shipped presets have unusable defaults.** (i)
`bookHairpin`'s design-suggested entry — 28 km/h, in `design/03 §3.1`'s table and
pinned at `linelab/test/golden/gates.test.ts:183` — produces an ideal line with
`validity.below_validity_s` = 2.17 and 33 of 98 samples flagged, spanning
s = 7.5→23.5, i.e. the whole corner, inside `design/01 §8`'s refused low-speed
regime. Nothing in the pipeline stops it being drawn: the verdict is still
`contained`/`good`, exit 0. The honest authoring window is entry ∈ [29, 30.5]
km/h, 1.5 km/h wide, and it excludes the preset's own suggested entry. (ii)
`bookBlind` has no default ideal line: `ride entry=<any> turnIn=auto` returns
`NO_SOLUTION`/`empty_band` at every entry 20–36 km/h ("no contained candidate with
an in-band apex exists", 12 candidates), while an explicit `turnIn=12` produces a
contained line apexing at 69.9% — so the auto-suggest band search misses lines
that plainly exist. *To decide:* whether `design/03 §3.1`'s suggested-entry column
needs a validity note, and whether (ii) is a solver defect.

**S24 — engine/design seam: the sight-deficit open-end carve-out.** The controls
strip's sight panel draws `ssd_m` overtaking `sight_ride_m` at s ≈ 26 and reaching
a 30.95 m deficit at road end, and `verdict.sight.margin_min_m` reads −30.95,
while `stop_within_sight` passes with `max_deficit_m 0 / min_margin_m 33.95`.
`design/06 §4` says "a crossing is a `stop_within_sight` failure staring at the
reader" — here it is not. The cause is the open-end carve-out in
`linelab/src/plan/doctrine/metrics.ts` (`sightDeficit`, the WP-10 seam repair),
whose own comment records that `verdict.sight.margin_min_m` still reads the
clamped channel and is a "separate ratification". **This hits the six shipped
Chapter 8 controls strips identically**, so it is a corpus-wide disclosure
question, not a candidate defect.

**S25 — rubric artefact: a trail brake's release ramp is scored as a mid-corner
brake.** Check 5 exempts samples whose `action_id` is the entry brake
(`metrics.ts`, `entryBrakeId` = last braking sample at/before turn-in), but the
brake's release *ramp* is attributed to the throttle action that supersedes it, so
the release of a trail brake trips `throttle_rule`'s discipline leg ("mid-corner
brake at s=38.5"). A 15-cell start × release grid found no line that trips
`ate_reserve` without also tripping discipline, so no trail-brake figure can say
"check 6 alone separates these". *To decide:* together with S3 and S7.

**S26 — engine seam: `chop`'s `rideability` excess.** The `chop` line records
`rideability: fail` with `max_excess_dps` 102.95, against 3.65 on shipped figs 8.1
and 8.3 — 28× the corpus's own worst. The two lenses disagree on the diagnosis and
both readings are recorded: the proposer traced it to a one-sample alignment
artefact (`su_transient` recorded as a 220.005 °/s spike at the single sample
s = 20.5 while the 8.335° of lean it sheds lands across s = 20.5→21.0), and the
attacker recomputed it from [20.0 → 20.5] instead, and showed that re-aligning
`su` to the opening sample still leaves 17.05 and 19.40 °/s against
`RATE_TOL_DPS` = 2.0 — about ten times over — making it a **sub-sample
event-timing** seam (`crack` fires at s = 20.31, between samples) that does not
vanish under re-alignment. It scales with the disturbance: `chop:slew_mss=20`
gives 7.36 °/s. *To decide:* whether check 12 should read a rate reconstructed
across the event station rather than sample-to-sample.

**S27 — vacuity law: extend §A.2 to verdict-pinned checks.** `design/01 §A.2`'s
normative rule catches an assertion on an *inapplicable* corner (a `na` that reads
as a pass). Both passes hit the adjacent species repeatedly: a check that fires,
is applicable, and is **structurally incapable of returning more than one
verdict** on the road in question. Measured instances: `single_input` returned
`pass {count: 1, allowed: 1}` on 11 of 11 lines on `book90`, good and mistake
alike, because a `ride style=single` line has one solved turn-in action by
construction; `quick_steer` returned `steer_share: 0` on every good line at every
solvable entry, because the roll finishes on the entry straight (by 13 mm at entry
34); `lean_ceiling` cannot warn or fail anywhere on `bookHairpin`, because the
solver clamps commanded lean at `phiReserve` and the maximum observed across the
whole entry sweep and all eight mistake kinds is 40.36° = the reserve exactly;
three of `throttle_rule`'s four legs never appeared in `missed[]` on any authorable
line **— ERRATUM, 2026-07-27: this clause is wrong, and it is wrong on committed
ink. `roll_on` appears in `missed[]` on nine committed rows — seven `warn`, two
`fail` — across figs 8.5 and 8.6, including *both* of those figures' ideal lines
(`fig-08-05 good` c1/c2, `early` c1/c2; `fig-08-06 good` c1/c2/c3, `bad` c1/c2).
Verified by walking `out/chapter-08/fig-08-0{1..6}.envelope.json`. The true claim
is narrower and road-specific: on `book90` only the discipline leg separates a
good line from a `chop` line, both reading `vmin_s 7` and `onset_s 15.5`. A
doctrine figure drafted on the wider claim was refused for asserting it in ink
(§3, `fig-09-D1`)** —; and `trail_brake_taper` returned `pass` in 25 of 25 sweep cells including
cells that ran off the road, and returns `pass` for an 8.0 m/s² brake because the
bike never reaches 15° of lean. A green tick from any of these reads to a student
as "graded and good". *To decide:* whether §A.2's obligation ("shown to satisfy
the antecedent before a test is hosted on it") should be generalised to "shown to
be capable of a non-pass verdict on this road before a figure names it as a
carrying check". This is the single most reusable finding of either pass.

**S28 — corpus convention: may a figure be a FigureSpec JSON rather than a
`.scene`?** *Needed by:* `fig-11-TB`, and by any figure whose lesson is an
explicit longitudinal plan. `schema scene` exposes exactly two line forms, `ride`
and `mistake`; `plan[].brake.decel` carries `scene_key ""` and
`linelab/src/cli/args.ts:89-95` records this in source as "a deviation, since
design/04 §7's scene grammar genuinely does not carry these keys". The canonical
FigureSpec JSON does carry it (`lines[].spec` accepts a wire `Scenario` with
`rider.plan`, `design/03 §8` / D30) and bakes correctly. Admitting such a figure
means admitting a second authoring form into a corpus whose six members are all
`.scene` derived from presets. *To decide:* a corpus-convention call, not a
physics one. A reviewer could refuse 11.TB on this ground alone and be right.

### Added by the doctrine-figure pass (S29–S31, 2026-07-27)

**S29 — vacuity: `out_in_out` advertises four legs and has two live ones on any
first corner.** *Needed by:* `fig-08-D2`, which was refused partly on this, and by
anything that reads the check's four-leg form as four independent tests. This is
S27's species, but arithmetic rather than statistical, and it sits on shipped ink.
`checks.ts` (~:321-345) tests `ti_f ≥ OIO_OUTSIDE_MIN ∧ apex_f ≤ OIO_INSIDE_MAX ∧
exit_f ≥ OIO_OUTSIDE_MIN ∧ max(ti_f, exit_f) − apex_f ≥ OIO_SWING_MIN`. Two of the
four cannot bind on a first corner:

- **The turn-in leg is structurally pinned.** `ti_f = 1` *exactly* on all twelve
  committed `c1` rows — every line of all six figures, good and mistake alike —
  because `f = 1.0` is the solver's default start state and the plan grammar's only
  lateral action is `position`, which neither `ride` nor any `mistake` sugar emits.
  `ti_f < 1` appears only at `c2`/`c3`/`c4` of multi-corner roads.
- **The swing leg is entailed by the apex leg.** Given `ti_f = 1`, swing reduces to
  `max(1, exit_f) − apex_f`, so for `exit_f ≤ 1` the leg is `apex_f ≤ 1 −
  OIO_SWING_MIN = 0.60`, which is strictly *weaker* than the apex leg's own
  `apex_f ≤ 0.45`. It can never be the binding constraint.

So a single-corner figure naming `out_in_out` is running a two-test check, and a
placard reciting "its other three legs pass" overstates the surgical precision of
the fault by about 3×. *To decide:* whether the check's reported evidence should
mark structurally-pinned legs (an `na`-per-leg, the §8 placard policy at leg
granularity), or whether this is documentation only. Nothing in the shipped corpus
moves either way — `fig-08-02` and `fig-08-04` fail the *apex* leg, which is live.

**S30 — carrier provenance: `out_in_out`'s bars are TUNING, its siblings' are
book-sourced.** *Needed by:* any figure carried by `out_in_out` alone. In
`linelab/src/plan/doctrine/packs/parks-street.json`, `OIO_OUTSIDE_MIN` (0.55),
`OIO_INSIDE_MAX` (0.45) and `OIO_SWING_MIN` (0.4) each carry `"source": "TUNING"`,
inside a pack whose `doctrine_source` reads "Parks, *Total Control*, ch. 8-9" and
whose `late_apex` bar carries a real `"source": "book:…"` quotation. The check
itself carries `book_ref "Total Control ch. 8"`, so the *check* is book-warranted
while the *number that decides it* is not. This is a sharper form of the ground
that killed `fig-08-D1`, whose verdict split rode on a TUNING constant. *To
decide:* whether a figure may rest its sole verdict on a TUNING-sourced bar
provided the placard says so, or whether TUNING-sourced bars are carriers only in
company. Not blocking the shipped corpus, where `out_in_out` never grades alone.

**Narrowed 2026-07-28 — the pack is correct and there is nothing to fix.** The
implied remedy (give the bars a `book:` source, or mark the check as unwarranted)
is **forbidden by the letter**: `design/01 §A.6` L961-963 states that no threshold
whose value is marked `TUNING` anywhere in the design of record may carry a
`book:` source in any pack, and `A-PACK-PROVENANCE` arm (c) mechanizes it. The
three bars are `TUNING` in `§A.3` itself, so the pack is byte-correct;
`book_ref` is declared `explain()` prose and is not a provenance channel. What
remains is **only** the figure-authoring half of the original question — may a
figure rest its sole verdict on a `TUNING` bar, and what must it say — which is
live and unchanged. A run may not touch the pack for this.

**S31 — the doctrine-figure disclosure bar may be unreachable by iteration.
RESOLVED 2026-07-28 by experiment. Answer: reachable on a *sentence*, not on a
*figure*.** The hypothesis this STOP proposed — *fewer placards on a simpler
claim* — was built and attacked. `fig-08-D3` (2 placards, carrier `throttle_rule`)
and `fig-08-D4` (3 placards, carrier `out_in_out`) replaced the previous round's
five and six. Neither ships; eight independent reviews now stand behind that.

The hypothesis is **half right**. A single sentence *can* be repaired and hold:
`fig-08-D3`'s killed sentence was rewritten once and survived the reversal and
student-conclusion tests, and `fig-08-D4`'s S30 provenance placard was rewritten
once and was cleared by the very lens that had killed it. Both firsts. So the
strong reading of this STOP is false — the bar is not unreachable in principle.

But a **figure** does not converge, because the failure is conserved and
migrates. Round 3 produced no fourth instance in the same place; it produced
kills on three surfaces the earlier rounds never reached: the figure's own
`figure_id` (S32), a placard the previous round had already **cleared**, and the
renderer's **marker defaults** (S34). **Two of the eight kills are on surfaces no
placard reaches at all**, which is what ends the iteration argument: a placard
cannot disclaim a filename, and it cannot disclaim a marker the renderer declined
to draw. A third, S33, shows the channel cannot even be made *complete* about the
constants a verdict rests on, because `EPS_EXIT_DEG` lives outside the pack.

*Consequence, adopted:* stop authoring candidates; repair the substrate. Three of
round 3's four kills are engine or renderer defects, not sentences. See `ROADMAP.md`
`NEXT`. One method finding worth carrying: **a repair brief written from adversarial
findings is not evidence.** Round 3's brief proposed *"drive withdrawn at 40 m/s³
against the 8 m/s³ bar"* — which would have been the seventh kill, since the ideal
green line in the same figure reaches −12 m/s³ against that 8 m/s³ bar and
`throttle_rule` grades it *"throttle rule held"*. The bar was never the
discriminator; the guard was. The author caught it; the brief did not.

*The original entry is preserved below, because the round-3 design rests on it.*

**S31 (original) — the doctrine-figure disclosure bar may be unreachable by
iteration.** *Needed by:* the whole `NEXT` goal. Two candidates (`fig-09-D1`, `fig-08-D2`) were
authored, baked, adversarially reviewed, repaired against every finding, and
reviewed again by fresh skeptics. Both cleared **merit** decisively — G1 clean,
S27 satisfied with wide margins, fail sets unique against all twelve committed
lines, no knife-edges. Both were refused on **disclosure**, twice, and never on the
same sentence twice: each repair fixed the named defect and exposed a new one of
the identical species — *a true number carrying a false implication, stated in the
direction that flatters*. Four independent reviews, four distinct instances. The
pattern, not any one instance, is the finding: a figure that needs five or six
placards to be honest has made the placard set itself the artifact, and each added
sentence is new surface for the same failure. *To decide:* whether the bar is
reachable at all for a figure whose lesson is not visible in the ink without prose
— and if so, whether the answer is *fewer* placards on a *simpler* claim rather
than more placards on this one. Full evidence in §3.

### Added by the minimal-claim pass (S32–S34, 2026-07-28)

**S32 — the S12 grant contradicts itself, and `chop` has no honest filename.**
*Needed by:* candidate 1 (`chop`), and by any figure carried by a check outside
Chapter 8. Two independent halves, both fatal to that candidate on their own.

*(i) The grant excludes what its own queue admits.* `ROADMAP.md` scopes the S12
grant to **"Chapter 8 doctrine only"**, and `throttle_rule` is Chapter 9 doctrine
by every declared source: `packs/parks-street.json` gives it
`"book_ref": "Total Control ch. 9, Throttle Control"` — the **only** ch-9
`book_ref` among the pack's sixteen checks, against **twelve** ch-8 ones
(*corrected 2026-07-28 — this entry and `ROADMAP.md` both said eleven*) —
`design/01 §4.3`'s mistakes catalogue maps `chop` to *"Ch. 9 throttle doctrine"*,
and `§A.3` introduces the check as *"(Keith Code Rule #1)"*, the one check in the
catalogue not attributed to Parks at all. Yet the same roadmap section's candidate
table names this exact figure as row 1, twice, and cites the SCOPE.md section that
labels it Chapter 9. *To decide:* whether the grant covers a Chapter 9 carrier drawn
on Chapter 8's road. An author may not resolve it — reading a conflicted licence in
the direction that authorises one's own figure is the flattering direction, which
is the species that has killed every candidate in this file.

*(ii) Neither available name is honest, and no placard reaches a name.*
`fig-08-*` is the corpus convention for Chapter 8 and is the manifest's
`figure_id`; `fig-08-D3` is a true token (it *is* on `book90`) carrying a false
implication (that its doctrine is Chapter 8's). `fig-09-D1` is honest and outside
the grant on its face. The placard channel (S15) reaches the SVG and the manifest
`placards` array — it does not reach `figure_id`. *To decide with (i):* whether
the corpus may hold a `fig-09-*` id at all.

**The decision packet, added 2026-07-28.** Three corrections to this entry as
filed, then the options. The full version with consequences is in `ROADMAP.md`
`NEXT` work order 3; it is not duplicated here.

- **The conflict is 3-vs-1, not 1-vs-1.** Three statements in the grant's own
  section admit `chop` — its rationale (*"Chapter 8 teaches … half the mistake
  catalogue in prose"*), its coverage arithmetic (which counts `chop` among the 47
  Chapter 8 doctrine surfaces and lists it uncovered), and its candidate table —
  against one scope sentence that excludes it.
- **"Exactly one artifact" undercounts.** A carrier-chapter rule also strikes
  candidate 6's `traction_ceiling` (`book_ref` ch. 1) and the parked `fig-11-TB`
  (ch. 11): at least two of seven table rows plus 11.TB.
- **`figure_id` is pure convention, proven empirically.** Baking
  `figures/fig-08-01.scene` into an out directory named `fig-09-D1` yields
  `figure_id: "fig-09-D1"` at the committed `spec_hash` 57e436 with a
  **byte-identical SVG** carrying no id token; the only differing byte range in any
  artifact is the manifest's `figure_id` field. It is derived from the `--out`
  basename (`cli/verbs/figure.ts:63`), is in no hash, is absent from the normative
  `Figure` shape (`design/03 §8`) and from `export --as figure-spec`, and is
  validated by no regex. **Half (ii) is therefore cheap**, which materially lowers
  the stakes of admitting a non-`fig-08-*` id. The real cost of a seventh figure is
  `test/render/gate.test.ts`, which hard-codes the six ids and asserts the baked
  directory holds exactly six SVGs and six judge records.

*Scope options:* **A** — scope by road + doctrine surface (matches three of the
grant's four statements; supported by the fact that `throttle_rule` leg (d)
**already fails twice in committed parity ink**, fig 8.5 `early` c1 and fig 8.6
`bad` c1, so a carrier-chapter rule retroactively indicts two G7-mandated figures).
**B** — scope by carrier chapter widened to the pack's declared "ch. 8–9" (its
warrant is currently false: the pack's sixteen `book_ref`s span ch. 1, 2, 8, 9 and
11, so `doctrine_source` must be corrected before B can even be stated). **C** —
keep carrier-chapter scoping and drop candidate 1 permanently.
*Naming options:* **D** — admit a `fig-09-*` id. **E** — drop chapter numbers from
doctrine ids entirely, reserving numbered ids for the six parity figures.

**The strongest argument against candidate 1 is from the book, not from
governance**, and it survives every scope option: Chapter 8's only sentence about
reducing throttle mid-corner *endorses* it — *"initiating a slight rolling off of
the throttle"*, as a double-apex correction — while the chop prohibition appears
verbatim in Chapter 9 and nowhere in Chapter 8. A Chapter-8-branded chop figure
would teach against the one Chapter 8 sentence on its own subject, which
`design/01 §3` (the book wins) disfavours regardless.

**Where the answer belongs:** the S12 grant exists only in `ROADMAP.md`, whose own
header disclaims authority over `design/*.md`, so the design of record does not
currently authorize doctrine figures at all. Whatever is decided should land in
`design/01` — §8 or a new remit section — and not only in the roadmap.

**S33 — TWO-THIRDS RETRACTED 2026-07-28. It was never a defect; only the bar's
value is still a question.** The entry below was written from measurement without
checking the design letter, and on two of its three claims the letter is explicit
and the engine conforms exactly. That is the same species of error this file
records in figures — a true number carrying a false implication — committed in
the record itself, so it is corrected in place rather than quietly edited.

- *The exit station is not a defect.* `design/01 §A.2` L504-507 defines the exit
  sample as *"the sample at the RECORDED exit event (§4.1's heading-capture
  deadband `EPS_EXIT_DEG` = 1.0°)"*, and the corner window `W_c` (L497) is
  `[s(turn_in), s(exit event for c, else corner end)]` — it ends at the event,
  not at `s1`. A station 7–9 m onto the following straight is **conformant**.
- *The bike margin is not a defect.* `f` = 1 being 0.4 m short of the physical
  edge is `§4.1` L126-127 (*"`f = 1` outer usable edge"*) plus `§4.2` L149-151
  (*"the usable corridor is the rider's own lane minus a bike margin, because the
  outside of the road is the oncoming lane"*). Working as specified.
- *`EPS_EXIT_DEG` living outside the pack is mandated, not sloppy.* `§A.6`
  requires that loading a different pack never move samples, events, `outcome` or
  `spec_hash`; a pack-bound exit deadband would move the recorded exit event. So
  the claim that "a pack-scoped provenance placard can never be complete" is
  true, but it is a consequence of a deliberate design rule, and the fix is for a
  figure to name the constant's owning document — not to move the constant.

**What survives, and it is a real question:** is `OIO_OUTSIDE_MIN` = 0.55 the
right bar? On the book road it lands at **d = −1.885 m** — 13.5 cm past the
midline of the rider's own lane, **53.9% of lane width** — so a line finishing
mid-lane satisfies a leg named "exit wide", and a figure paraphrasing the check's
name teaches a standard the check does not enforce. That is a threshold in the
normative appendix (`§A` L446-447), so it is the design owner's. *To decide, with
S20/S29/S35:* whether the bar is re-based, and what a figure may say about a check
whose name outruns its arithmetic. **Measured consequence of re-basing:** no
committed `exit_f` lies in (0.55, 0.845], so the first bar that changes anything
is above 0.845 — a bar chosen to move the corpus would have to be chosen *because*
it moves the corpus.

*The original entry follows, retained because the measurements in it are correct
and were independently re-verified; it is the interpretation that was wrong.*

**S33 (original) — `out_in_out`'s exit leg measures neither "wide" nor "at the
exit", and both halves sit on committed ink.** *Needed by:* candidate 2, and by the
`out_in_out` adjudication. Verified in the main loop by walking all six committed
envelopes.

*(i) The bar is at 53.9% of lane width — mid-lane, not "wide".* With
`lane_width_m` 3.5, `bike_margin_m` 0.4 and `use_full_width` false, the usable
corridor is 2.7 m and `f` measures across it, so `OIO_OUTSIDE_MIN` = 0.55 lands at
**d = −1.885 m**: **13.5 cm past the middle of the rider's own lane** (midline
−1.75) and 1.615 m short of its outer edge. A line finishing mid-lane satisfies
"exit wide". And `f` = 1 is itself **0.4 m short of the physical edge**, so *no
line linelab can draw ever reaches the outside of the lane* — including the ideal
line, which exits at d = −2.69 on all of figs 8.1/8.2/8.3. A figure whose caption
paraphrases the check's name therefore teaches a standard that does not exist, and
the top-down view hands the reader the ruler to check it with (stroked lane edges,
plus a "lane 3.5 m wide" scale note).

*(ii) The exit fraction is sampled past the corner, and the station is fixed by a
constant the rubric pack does not own.* Measured on committed ink: every
single-corner ideal line's `exit.s` is **+7.43 m** past the corner's end
(38.28 against `s1` 30.85 on figs 8.1–8.3; +8.81 m on fig 8.4), i.e. on the
following straight — while the mistake lines' exits are sampled **before** it
(−3.38, −14.24, −7.02, −10.85 m) because they terminate off-road. So the two
fractions the check compares can be taken more than 20 m apart on the same figure,
and the ideal line's 0.849 is earned largely by drifting down the straight rather
than by exiting wide. The station is set by `EPS_EXIT_DEG` = 1.0° in
`linelab/src/core/constants.ts` ("TUNING. Exit heading-capture deadband"),
consumed in `core/analyze.ts` — **outside `packs/parks-street.json`**, so a
provenance placard scoped to the pack (S30's proposed remedy) is *structurally
incapable* of being complete. *To decide, with S20/S29/S30:* whether the exit leg
should be evaluated at the corner's own exit boundary, whether the bar should be
expressed against something a rider can see, and what a figure owes about tuned
constants the rubric does not own.

**S34 — PREMISE REFUTED 2026-07-28 on both halves, and the real defect is
elsewhere in the same file.** Corrected in place, for the same reason S33 is.

- *The letter is not silent.* `design/04 §7` L1903-1906: *"`marks:` takes a
  MarkSpec — `auto | all | none | <class-list>` … at figure level, overridable per
  line with `marks=`; `auto` (default) draws all classes on `ideal`-role lines
  only."* `render/markers.ts` implements that sentence exactly, and its own
  docstring quotes it. Ideal-only auto marking is a **designed default**;
  redefining it is an amendment, not a defect fix.
- *There is already a scene-level escape, and the corpus uses it.* A figure-level
  `marks: all` or class list enables that class on **every** drawn line regardless
  of role — figs 8.1, 8.3 and 8.5 do exactly this on committed ink (8.3 carries
  six hourglasses on its mistake line). This entry's original closing claim, "a
  renderer default, so an engine/design question and not a scene-level fix", is
  refuted by our own corpus. **S34 is mostly an authoring guideline**, and far
  cheaper than it was filed as.
- *fig 8.2 was a misattribution.* Its `slow_steer` line perturbs roll rate, not
  turn point, so both lines record `turn_in` at s = 6.974 at the identical drawn
  point; `design/06 §3.1`'s coincident collapse fires and "ideal wins ties". It is
  pinned green by `A-FIG82-SINGLEMARK` (`design/09 §5.4`) and stated in the scene's
  own header. Not an instance of anything.

**What survives as an owner question:** should figs 8.4 and 8.6 — and every future
doctrine scene whose lesson is not the apex — be re-authored with an explicit
`marks:`, accepting that `marks` is a `FigureSpec` field and so each edit moves
that figure's `spec_hash`? Or `auto` amended, or a new MarkSpec value added, or the
omission placarded? *To decide:* pick one. The measured trade is that re-authoring
moves `spec_hash` (figure identity) while amending the default moves SVG bytes and
leaves every `spec_hash` alone.

**What does NOT need that decision, and is letter-decisive** — promoted out of this
STOP into `ROADMAP.md` `NEXT` work order 1:

1. `markers.ts:110` uses `MARK_COINCIDE_EPS_M` (1.0 m) for the **drawn-position**
   test, where `design/06 §3.1` L404-406 requires *"drawn positions overlap within
   one glyph radius"*; the file's docstring records the substitution as a
   deviation. On committed `fig-08-05` this swallows the **mistake line's** second
   apex: `early` records apex events at s = 17.5 and s = 25.0 and only one glyph is
   drawn, the s = 25.0 one collapsing into a `good` glyph **0.987 m** away against
   a ring radius of **0.2289 m** (4.3 radii). This is S34's exact complaint — a
   mistake line's recorded apex not drawn — arising from the tolerance rather than
   the default, and the letter already decides it.
2. The per-line `marks=` override is specified in two documents (`design/03 §8`
   L1635, `design/04 §7` L1904-1905, which also lists `label=`) and implemented
   nowhere: `plan/scene.ts:287-290`'s `RIDE_KEYS` has neither key, so a scene using
   it is rejected `SCHEMA`/`ride_unknown_key`. It is the surgical instrument this
   STOP wants — mark the mistake line's apex without putting release chevrons and
   exit dots on every line.

*The original entry follows; its committed-ink measurements are correct and were
re-verified, its reading of the letter was not.*

**S34 (original) — auto `marks:` draws markers on the ideal line only, and the
absence reads as a claim.** *Needed by:* candidate 2; on committed ink already. With `marks:`
unauthored the renderer draws all classes on ideal-role lines only
(`render/markers.ts`), so figs **8.4 and 8.6 carry no marker at all on their
mistake lines** (fig 8.2's mistake line likewise carries none under an explicit
`marks: turn_point`). A reader reads that absence as *"the mistake line never
apexed"*. On figs 8.2 and 8.4 that inference happens to be near enough true — both
red lines fail `late_apex` at 2.7% and 1.4% of sweep. On **fig 8.6 it is false**:
the unmarked red line **passes** `late_apex` at c1, *"apex at 70.0% of sweep, past
the 50% bar"*. And it was maximally false on `fig-08-D4`, whose mistake line
apexed **later and deeper than the ideal's** (87.5% against 66.3%, f 0.222 against
0.277) and passed `late_apex` — so the ink taught the reverse of the record, which
is `design/01 §8`'s plausible fake exactly. *To decide:* whether a drawn line is
entitled to its own recorded events, or whether ideal-only marking is a deliberate
legibility choice that a figure must then disclose. A renderer default, so an
engine/design question and not a scene-level fix.

**S34 — SUPERSEDED IN PART 2026-07-28: the instrument now exists, and the idiom
is verified.** Work order 1 landed the per-line `marks=` override the letter had
specified and nobody had built (`design/03 §8` L1635, `design/04 §7` L1904-1905).
A doctrine figure can now mark **only** its mistake line's apex, in scene text,
today — verified by baking it in the main loop:

```
lines:
  good:    ride entry=34 turnIn=auto marks=none
  bad:     mistake premature:early_by_m=6
marks:     apex
```
→ one glyph, `data-marker-class="apex" data-line-id="bad"`.

The composition is the point, and it is worth stating because a reviewer tested
the wrong idiom and concluded the capability was unreachable: a `mistake` line
takes no `key=value` args in scene text (`design/04 §7` puts `marks=`/`label=`
under the `ride` bullet only), so you do **not** put `marks=` on the mistake line
— you enable the class at figure level and silence it on the ride line. Since the
ideal line of every figure in this corpus is a `ride` line, the key is always
available where it is needed. *Recorded so it is not rediscovered as a blocker.*

What is still open from S34 is only the corpus question: should figs 8.4 and 8.6
be **re-authored** with explicit `marks:` — moving their `spec_hash`, since `marks`
is a `FigureSpec` field — or the `auto` default amended, which moves SVG bytes and
no hash? Note that after S36 the two costs are no longer symmetric: **either
choice now also costs a re-judge**, because both change what those figures draw.

**S36 — RESOLVED IN PART 2026-07-29. The rasterizer is built and the loop is
closed; one sentence of the "to decide" survives.** The half that mattered — *which
rasterizer* — was never really the owner's to decide, because `design/09 §7` step 2
and `§9` L2360 both name the mechanism (*"a headless-browser rasterizer"*), and the
letter outranks convenience. Built as `linelab/tools/rasterize-figures.mjs`:
puppeteer (**dev** dependency, D1) driving the version-pinned Chrome for Testing it
downloads, 2× on white, a manifest naming its own engine, non-zero exit on any
render failure. `fig-08-05` was re-judged on its output and the two reds cleared
honestly — see the 2026-07-29 entry in `verify/judge.json`'s `re_judge_log`.
**Still open, and it is the whole remainder:** does `figures/png/` stay committed
evidence or become a build output? It stayed committed this pass because that
needed no amendment. Note also that the rasters are byte-identical run-to-run *on
one machine with one pinned Chrome*; cross-machine byte-identity is unproven,
because text rasterization depends on the host font stack and the Chrome pin does
not cover it. The original entry follows, unedited.

**S36 (original) — the visual-judge loop cannot be closed: the rasterizer
`design/09 §7` specifies does not exist.** *Needed by:* every future change to what
any figure draws — which now includes the rest of S34, and the whole doctrine-figure
programme. Found landing work order 1, and it is why the suite is red.

`design/09 §7` step 2 calls for *"a headless-browser rasterizer (replacing
cairosvg)"*. The repo contains none, and `out/chapter-08/bake.sh` emits no PNGs,
so `linelab/figures/png/*.2x.png` and `*.grey.png` — the rasters the 2026-07-25
ceremony judged and retained as evidence — are outputs of a step nobody can
re-run. The *judge* half is fine: `verify/judge.json` pins the identity to
`claude-opus-5`, which is available. Only the raster half is missing, and the one
rasterizer on this machine (macOS `qlmanage`) renders faithfully but force-crops
to a square, cutting off the turn point, the entry-speed labels and the scale bar
— exactly what rubric items J2, J3 and J8 grade. Judging a cropped raster would
fabricate a record.

*Consequence:* `fig-08-05`'s record is stale and `T-JUDGE-RECORD` +
`test/hash/tripwire.test.ts` are RED until this is built. **Do not clear them by
restamping** — `tools/restamp-figures.mjs` rewrites `svg_fnv1a` alone and its own
header says that leaves the record *"structurally valid and semantically stale on
purpose"*. *To decide:* which rasterizer (it must be deterministic and portable,
since the corpus's whole value is byte-identical reproducibility, and D1 confines
it to a dev dependency), and whether `figures/png/` stays committed evidence or
becomes a build output.

**S35 — the exit sample is undefined for a line that leaves the road before the
corner ends, and the engine's substitute is what makes S20's headline number.**
*Needed by:* the `out_in_out` adjudication; found 2026-07-28 while checking S20
and S33 against the letter, and it is the better-posed question underneath both.

`design/01 §A.2` L504-507 defines the exit sample as *"the sample at the RECORDED
exit event … for a terminated line with no exit event, corner end"*. For a line
that departs the road **before** `s1`, corner end does not exist on the
trajectory — there is no sample there, because the line stopped first. The letter
does not say what to do, and it is **silent rather than contradicted**, so this is
an amendment gap and not disobedience.

`linelab/src/plan/doctrine/metrics.ts:292` substitutes `Math.min(w.corner.s1,
last.s)` — the off-road departure sample. On committed ink that sample sits at the
outer usable edge, so **every** mistake line of figs 8.1–8.4 reports
`exit_f = 1.148` and satisfies the exit leg. That, and not an oversight in the
predicate, is the mechanism behind S20's *"exit wide is satisfied by leaving the
road"*: the arithmetic is doing exactly what `§A.3` check 2 says, on a sample the
letter never nominated.

*To decide, and it subsumes much of S20:* **what is the exit sample when the line
left the road before the corner ended?** The candidates are the departure sample
(status quo), no exit sample at all — which makes the leg `na` and the check
inapplicable — or the crossing station treated as a failure, which is what
`§A.3` check 9 `exit_containment` already does for the same event (*"If the line
terminates off-road before the exit sample exists … fail citing the crossing
station"*). That check 9 precedent is the strongest single argument available here
and should be in front of the owner: two checks read the same termination and only
one of them has a rule for it. Answering this may make S20 moot without touching
the predicate.

**S37 — a callout completely swallows a direction-ladder label on committed ink,
and the letter's repulsion rule does not reach the collision.** *Needed by:*
`fig-08-05`, whose re-judge this fails; and by every future figure, because the
mechanism is generic. Found 2026-07-29 by the first judging ever performed on a
genuinely 2× raster.

On `figures/fig-08-05.svg` the `30 m` direction-ladder label sits at
`x=23.865 y=-12.881`, and the callout *"no geometry left for c2 - off the outside
edge"* sits at `x=24.735 y=-12.887` with `text-anchor="end"` — the same baseline to
within 0.006 user units, and the callout is long enough to span the label's whole
width. **Zero glyphs of `30 m` survive in the raster**, while `10/20/40/50/60 m` are
all crisply readable. Verified in the main loop by cropping the raster at the
label's own projected pixel position, not inferred from the SVG.

*This is why the rasterizer mattered.* The label is drawn and then buried, so no
element-inventory check can see it — only a picture can, and until 2026-07-29 the
only pictures anyone had were the 1×-ink rasters, on which the ladder numerals are
half-size and the 2026-07-25 ceremony graded J8 `pass`. Two of the three 2026-07-29
passes graded it `fail`; the one that passed it read the ladder at overview scale.

*Why it is a STOP and not a repair.* `design/06 §3.1` stage 10 is normative and
says label boxes *"repel each other and the road ink by a simple candidate-position
scoring pass"*. The `30 m` label is neither: it is **stage 8b line chrome** (D47's
direction ladder), drawn from the line rather than the road, and stage 10's
repulsion pass is not told about it. The letter is therefore **silent on this
collision** — which is the row of the roadmap's authorization table that forbids
touching the renderer on a run's own authority.

*To decide:* does stage 10's repulsion set include stage-8b chrome? The options are
not equal in cost, and none is free: (a) extend the repulsion set — the natural
reading, but it moves callout positions and therefore **SVG bytes on any figure
where a box currently sits near a ladder label**, which is a re-bake plus a re-judge
of every figure that moves; (b) let the ladder suppress a label that a callout
covers — cheaper to implement and it deletes information the figure is supposed to
carry; (c) treat it as an authoring collision and move this one callout, which fixes
one figure and leaves the mechanism live for the next. The blast radius of (a) is
**not yet measured** and should be before the owner answers.

*Meanwhile the honest record stands:* `fig-08-05.judge.json` carries
`verdict: "fail"` on J8. `T-JUDGE-RECORD` permits that by design — its own comment
reads *"Not hard-required to be `pass` — failed criteria are honest findings"* — so
the suite is green with a failing figure on the record, which is the correct shape.

Also noted, and deliberately **not** raised as STOPs:

- `.scene` files cannot select the `controls` view. The scene `view:` block passes
  opaque keys to the projection (mode/window/orient/rays/legend/look); the view
  kind is a `render --views` CLI flag. Any book timing chart would therefore not
  be a scene in the Chapter 8 mould even if S13 were resolved. The doctrine
  tranche hit the same wall from the other side: `overread`'s real consequence is
  exit speed (49.5 vs 53.9 km/h), which lives in the strip and not in the plate.
- Controls strips are auto-scaled per line and per panel — speed 33–54 on one line
  against 33–36 on another, stand-up ±1 against 0–220 — with only `grip` carrying
  a fixed range (`design/06 §4`). Two strips side by side compare shapes, not
  magnitudes, and any figure shipping a pair must say so.
- `marks:` and `labels:` do not survive into envelope `meta`, so `render
  <envelope>` drops authored labels; they appear only in the `figure` verb's own
  SVG. This affects the shipped six equally and is a bake-order fact, not a
  defect claim.
- `manifest.gate_verdict` reads `"fail"` for `--mode true` bakes of the shipped
  figures as well as of every candidate (the book-proportion gate, exempted for
  true mode by `design/06 §6.2`). It is not a discriminator and was not used as
  one.

---

## 5. Method

Three passes produced this file: the book-figure adjudication, the steelman that
tested it, and the doctrine tranche. All three are recorded so the verdicts are
auditable.

### Pass 1 — the book-figure adjudication (question (a))

Eight adjudicator agents were fanned out, one per figure group, covering
Chapters 1, 2, 3, 4, 9, 10, 11, 12, 13, 15, 17, 18 and 19 plus a residual sweep
whose job was exhaustiveness. Each was given `design/*.md` as the design of
record, the live rubric, and the instruction to prefer OUT when torn.

**The test each figure had to pass.** Every claim the reproduction would make
must be one the engine actually computes. Anything it cannot compute earns a
typed `{na: reason}` or a rendered placard, never a plausible fake
(`design/01 §8`). A figure is PARTIAL only if, after stripping every unmodelled
claim and placarding the gaps, what remains still teaches *the printed figure's
point*. If what remains teaches a **different** point — usually Chapter 8's — the
verdict is OUT, not PARTIAL. That test did most of the work in §2, and it is why
figures whose geometry is plainly drawable (2.9, 12.11, 15.10, 15.16, 15.17) are
nonetheless refused.

**Evidence, not assertion.** Verdicts were required to cite a design section by
number, and where a capability claim was in doubt, to demonstrate it at the CLI
rather than assert it. The runs behind §2 include: `schema mistakes` (the closed
8 kinds), `schema envelope` (the Sample field list), `schema scenario` and
`schema scene` (the input surfaces), `explain traction_ceiling` (book provenance),
a `figure` run on a super-tight scene (the `OUT_OF_SCOPE` text quoted in bucket H),
solver refusals at U-turn speeds, a baked `book90` ideal line dumped
sample-by-sample (the flat 2.2 m/s² roll-on in bucket K), a brake→throttle→brake
plan on a straight (the `cmd_a` sign collision in bucket G), a straight-only road
graded to show which checks instantiate (bucket G), a 9.0 m/s² drive command at
30° lean (the sustained stand-up), and a hand-built trail-brake `FigureSpec` swept
across taper decelerations (the check-6 pass/warn boundary in the 11.TB row).

**Resolution rule.** A verdict survives only if it survives both adversarial
lenses — engine capability and pedagogy — and where they disagree the harsher
verdict stands. No pass-1 verdict reached IN or PARTIAL, so no attack ran; §3
records that, and records that the OUT verdicts consequently carry no adversarial
counter-pressure except on the three targets pass A later re-opened.

**Accounting.** 87 images in `book_images/by-figure/`. 6 are the shipped Chapter
8 corpus, listed in §1 and not re-adjudicated. **81 adjudicated here; 0 survive.**
Every one of the 81 appears exactly once in a §2 bucket: A 24, B 8, C 5, D 3,
E 20, F 1, G 2, H 1, I 9, J 3, K 5 — 81. Two non-printed proposals (9.1b, 11.TB)
were adjudicated additionally and are also OUT.

### Pass A — the steelman (question (a), re-opened)

Because pass 1's adjudicators were told to *prefer OUT when torn*, a later pass
tested whether that instruction did the deciding. Three defenders were given the
three closest refusals — 2.9, 9.1 and 11.TB — and instructed to build the
strongest honest case **for** reproduction, state it at full strength before
testing it, run every claim at the CLI rather than reason about it, and then
attempt to break their own case. Each returned a `survives` boolean, the sentence
a student would be entitled to take from the strongest honest remnant, and an
exhaustive list of what would still be faked if the figure were authored anyway.

**Outcome: 3 targets, 0 verdicts changed.** 2.9 returned `survives: false` on its
author's own analysis. 9.1 conceded parity outright — both blockers re-run and
confirmed — and returned `survives: true` only for a *different*, explicitly
non-parity artifact, conditional on an S12 remit call it declined to grant
itself. 11.TB likewise returned `survives: true` conditional on the same remit
call plus a retitling, while refuting two of the four grounds in its own §2 row.
Those refutations are recorded in §2's steelman subsection rather than by editing
the row, because the 81-figure reconciliation is load-bearing and must survive
intact.

### Pass B — the doctrine tranche (question (b))

Scope was set by what the shipped six never touch: two shipped-but-unused presets
(`bookBlind`, `bookHairpin`) and four shipped-but-undrawn mistake kinds
(`premature_contained`, `chop`, `underread`, `overread`). Three proposer agents
each baked their candidates — nothing predicted, everything run — and reported
carrying checks with observed verdicts, the exact sentence the figure would be
entitled to teach, the scene text, unmodelled claims, and a redundancy baseline
obtained by re-baking all six shipped scenes. Every candidate that reached IN or
PARTIAL was then attacked from two lenses, each of which re-baked the proposal
independently in its own scratch directory before arguing.

**The bar, beyond pass 1's.** A doctrine figure is not anchored to printed ink,
so it must clear two further tests: the contrast must be *drawn* — visible in the
plate or the strip, not only in the JSON — and the doctrine named must be what
causes it. Both killed candidates failed at least one: `fig-08-D1` attributes to
blindness a lean split that blindness does not cause and draws two identically
graded amber lines, and `overread`'s labels assert an exit consequence the
drawing contradicts.

**Resolution rule.** A candidate survives only if **both** attackers leave it
standing. Where they disagree, the harsher verdict stands and the disagreement is
recorded (§3): the `chop` and `overread` pair split PARTIAL against OUT, and both
are OUT.

**Accounting.** 6 doctrine candidates in 3 groups; 3 self-refused by their
proposer on the merits, 3 reached PARTIAL and were killed on review. **0 survive.
Nothing was written into the repo by either pass** — all bakes are in
session scratch directories, and this file is the only artifact.

### What this file does not claim

It does not claim the book is wrong anywhere. Several figures are refused
precisely *because* linelab would contradict the book if it drew them (2.4, 2.5,
9.1) — that is the model's limit, not the book's error, and `design/01 §3`'s "the
book wins" rule governs doctrine disputes, not physics-tier boundaries that
`design/01 §8` already resolves by refusal.

It does not claim the refused artifacts are dishonest. Three of them are honest
and were verified as such; they are refused on remit (§4 S12), on a missing
rendered placard (§4 S15), and in one case on corpus convention (§4 S28). Those
are decisions for the design owner, and this file does not make them.

It does not claim exhaustiveness for question (b). The tranche covered what the
shipped six leave untouched in Chapter 8; it did not sweep every road the DSL can
express, and §4 S16 names one road shape — a shorter blind-corner hedge — on which
a check with no positive fixture anywhere in the corpus is known to pass.
