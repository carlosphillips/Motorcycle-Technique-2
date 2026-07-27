# figures/SCOPE.md — scope adjudication for the book-figure corpus

This file decides one question, figure by figure: **can linelab reproduce this
printed book figure honestly?** Honestly means every claim the reproduction
makes is one the engine actually computes, and every claim it cannot compute
earns a typed `{na: reason}` or a rendered placard — never a plausible fake
(`design/01 §8`, the placard policy). It does **not** decide what linelab should
model, does not propose engine changes, and does not adjudicate the six Chapter 8
figures already shipped. It supersedes the starting-hypothesis table in
`ROADMAP.md` ("NEXT — extend past Chapter 8"), which that document itself labels
*"a starting hypothesis derived from a skim, not an adjudication"*; three of its
rows are overturned below. `design/*.md` (D1–D46) remains the design of record
and wins over everything here.

**The result: 81 figures adjudicated, 0 survive.** The corpus does not grow.
Phase 2 of the ROADMAP has nothing to author, and Phase 3 has nothing to bake.
That is the finding, not a failure to find one.

---

## 1. The surviving corpus

**New figures surviving this adjudication: none.**

| figure id | book title | verdict | carrying checks | view | placards |
|---|---|---|---|---|---|
| — | — | — | — | — | — |

Every one of the 81 candidate figures is refused in §2. No figure reached IN or
PARTIAL, so there is no per-figure subsection to write: no scene sketch, no
"sentence the figure is entitled to teach", no placard set. Where a candidate
came close, the reason it fell short is recorded in §2 and, where it needs
something that does not exist, in §4.

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

## 2. The refused set

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

---

## 3. Killed on review

**No adjudicator verdict was killed by an attacker, because no adjudicator
verdict reached IN or PARTIAL.** The adversarial lenses (engine-capability and
pedagogy) attack IN and PARTIAL verdicts; all eight groups returned OUT on every
figure, so the attack pass had nothing to fire at and returned empty for all
eight. This section is therefore empty of attacker kills, and that fact is itself
part of the record: **the OUT verdicts in §2 rest on the adjudicators alone and
have not been adversarially stress-tested from the other direction** — nobody was
tasked with arguing that a refused figure is in fact reproducible. Where a
verdict was close, §2 records the evidence that decided it.

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

**S11 — engine/design tension: `check` is weaker on the `.scene` path.**
Observed, reported, not fixed. `check <file>.scene` on a super-tight road returned
`{"ok":true,"value":{"valid":true,"spec_hash":"87402f"}}`, while `check
<scenario>.json` carrying the same road correctly returned
`OUT_OF_SCOPE`/`super_tight_geometry`, as did `run` and `figure` on both.
`design/01 §8` says the regime is *"rejected `OUT_OF_SCOPE` at validation"*, and
`design/08` specs `check` as validate-only, *"same code path as `figure --check`"*.
The scene path appears to defer the road build to `figure`, so the typed rejection
arrives one verb later than the design sentence implies. No fake figure can
escape — `figure` refuses — but the two paths disagree. *To decide:* whether this
is a design clarification or a defect; it is neither authored nor patched here.

**S12 — remit: may linelab author non-parity doctrine figures?** Three honest
artifacts exist that reproduce no printed figure: a trail-brake taper scene
(§2, 11.TB), a Chapter 9 good-vs-`chop` pair, and a Chapter 12 controls strip of
the roll-on. Each teaches something the engine genuinely computes. All three are
OUT here because the ROADMAP's remit is *"every other book **figure** the
doctrine can honestly grade"* and its Phase-2 instruction is *"read that figure's
book text **and image**, then write a `.scene`."* *To decide:* an explicit remit
call. If non-parity figures are authorized, the corpus is not empty; under the
current remit it is.

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

Also noted, and deliberately **not** raised as a STOP: `.scene` files cannot
select the `controls` view. The scene `view:` block passes opaque keys to the
projection (mode/window/orient/rays/legend/look); the view kind is a `render
--views` CLI flag. Any book timing chart would therefore not be a scene in the
Chapter 8 mould even if S13 were resolved.

---

## 5. Method

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
verdict stands. No verdict reached IN or PARTIAL, so no attack ran; §3 records
that, and records that the OUT verdicts consequently carry no adversarial
counter-pressure.

**Accounting.** 87 images in `book_images/by-figure/`. 6 are the shipped Chapter
8 corpus, listed in §1 and not re-adjudicated. **81 adjudicated here; 0 survive.**
Every one of the 81 appears exactly once in a §2 bucket: A 24, B 8, C 5, D 3,
E 20, F 1, G 2, H 1, I 9, J 3, K 5 — 81. Two non-printed proposals (9.1b, 11.TB)
were adjudicated additionally and are also OUT.

**What this file does not claim.** It does not claim the book is wrong anywhere.
Several figures are refused precisely *because* linelab would contradict the book
if it drew them (2.4, 2.5, 9.1) — that is the model's limit, not the book's error,
and `design/01 §3`'s "the book wins" rule governs doctrine disputes, not
physics-tier boundaries that `design/01 §8` already resolves by refusal.
