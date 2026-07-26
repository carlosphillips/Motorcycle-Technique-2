# Rendering & the Diagram Projection

How linelab draws. This document owns the **diagram projection** (the designed fix
for the prior tool's stretched-out figures), the **top-down renderer**, the
**controls strip**, **colour law v2** in detail, the **proportion gate**, and the
**static SVG export**.

It does not own the physics (`02-physics-model.md`), the road/occluder/sight
models (`03-roads-scenarios-and-visibility.md`), the result shapes it consumes
(`05-result-contract-and-inspection.md`), the interactive stepper or the POV view
(`07-viewer-animation-and-pov.md`), or the test harness behind the gates
(`09-verification-and-testing.md`).

---

## 1. What this document covers — and the problem it exists to solve

The prior tool's figures looked **stretched** compared with the book's, and the
review established this was not a renderer bug but the geometric consequence of
drawing physically true geometry at uniform scale:

- Measured from the book art, Parks' line diagrams are drawn at **diagram scale**:
  road width is **≈ 0.55–0.9 ×** the corner's centreline radius, and entry/exit
  straights are cropped to **under one arc length** of visible approach.
- A physically true street corner — 3.5 m lane, R 45–60 m — has width:radius
  **≈ 0.06–0.08**, an **~8–10× proportion gap** no uniform scale can close. And
  because real braking from ~80 km/h takes real distance, the prior canonical
  scenarios were ~60 % straight by length; everything on the road got drawn, so
  every figure carried a long, teaching-dead approach.
- The prior design's only mitigation was a **lateral-only** exaggeration knob
  (`exag`, drawn-offset ×2.5): it cannot compress the long axis, cannot close the
  width gap, and makes the drawn line quietly not-to-scale — in tension with a
  tool whose promise is physical realism.
- The prior verification regime had **no proportion metric**, so the defect class
  was structurally invisible: the render gate proved figures rasterized, and the
  vision judge policed over-exaggeration but never under-reading.

Per **D2**, linelab's answer is architectural: simulation always runs on true
geometry; the top-down *diagram* view renders through a **disclosed,
topology-preserving projection**; a mechanical **proportion gate** verifies the
result actually lands in the book's proportion band. The POV, the HUD, and every
physics readout consume true geometry only — drawn-space exists solely inside
`render/`.

---

## 2. The diagram projection

### 2.1 Modes and the ViewSpec

```
ViewSpec = {
  mode: "true" | "diagram",             // default "diagram" for figures
  window?: {from: StationRef, to: StationRef} | "all",
                                        // crop; default per §2.4; "all" = full extent
  orient?: "auto" | 0 | 90 | 180 | 270, // frame rotation; default "auto" in
                                        // diagram mode, 0 in true mode (§2.4)
  look?: "heading" | "limit_point",     // POV camera aim; default "heading";
                                        // consumed by every renderer that draws
                                        // a POV frame, ignored elsewhere (07 §5.2)
  roll?: "lean" | "level",              // POV frame roll (D48); default "lean" —
                                        // the horizon tilts with phi. "level"
                                        // holds it flat and moves lean to the
                                        // HUD dial (07 §5.3). POV-only
  consequence?: "on" | "off",           // stage 8b's consequence ray (D47);
                                        // default "off". Top-down only
  rays?: "auto" | "off" | "all_turn_ins",
                                        // sight-ray selection; default "auto"
                                        // (§3.1 stage 7)
  legend?: "auto" | "on" | "off",       // default "auto" (§5.3)
  fan?: "auto" | "off" | number,        // continuation fan (D45, gated); default
                                        // "auto"; numeric value selects a probe
                                        // index; resolution semantics owned by
                                        // 07-viewer-animation-and-pov.md §5.3
  width_exag?: number,        // default auto (§2.3)
  straight_compress?: number, // default C_STRAIGHT
  taper_compress?: number     // default C_TAPER
}
```

`mode: "true"` is the identity transform plus optional crop — the debug/inspection
view. `mode: "diagram"` applies the projection below and is the default for every
exported figure.

**ViewSpec never mirrors** (D26). `orient` rotates but deliberately has no
`flip`/mirror value: a drawn reflection would depict a right-hander for a
left-hand simulation — a lie the disclosure footnote (§2.7) cannot cure. A
request for one is rejected `SCHEMA` (`no_view_mirror`, message pointing at
`road … hand=`); handedness changes are physics-level only (03 §3.1).

`fan` is the one ViewSpec key whose resolution is described elsewhere: `fan:
auto` resolves **on iff a `CommitmentReport` is attached to the loaded
envelope**, resolving it never invokes an engine run, and a
requested-but-absent report draws a typed refusal placard — all owned by
`07-viewer-animation-and-pov.md` §5.3 and not restated here. Unlike the
corrective ghost and the save-window overlay, `fan` is persisted and rendered
into exports (§7), because it draws a declared input world rather than a
viewer-local debugging aid.

### 2.2 The transform is defined in station space

The projection maps station coordinates `(s, d)` — arc-length along the true
centreline, signed lateral offset — to drawn station coordinates `(s′, d′)`, and
only then lays out drawn world geometry from the remapped centreline. Working in
station space rather than `x, y` is what makes the invariants (§2.5) provable
rather than hoped-for.

**Longitudinal remap** — per-segment compression of arc length:

```
s′(s) = ∫₀ˢ 1 / c(seg(u)) du          (piecewise; continuous; strictly monotone)

c(straight) = C_STRAIGHT = 5    // TUNING, range 4–8: straights compress hard
c(arc)      = C_ARC      = 1    // corners draw at (near) true arc length
c(taper)    = C_TAPER    = 1.25 // TUNING: transitions compress gently
```

Because `c > 0` everywhere, `s′` is strictly monotone: **nothing indexed by
station can reorder**. Corner sweep angles are preserved exactly (arcs are not
compressed), so the drawn corner is the same 90° or 180° corner — only the
teaching-dead approach shrinks.

**Lateral remap** — width exaggeration:

```
d′ = d × width_exag
```

applied identically to road edges, lane lines, occluder anchors, and every
trajectory's `d`. Since all lateral geometry scales by one factor, a line inside
the lane stays inside the drawn lane, a line touching the outside edge still
touches it, and left-of-centre stays left-of-centre — containment and side
relations are invariant under any `width_exag`.

The drawn centreline of an arc keeps its true radius while the drawn road width
grows — which is precisely how the drawn width:radius ratio is raised into the
book's band without bending the corner's shape.

**Fan ink and the station remap (D45, gated).** The longitudinal remap `s′(s)` is
defined on the road-under-test's own segments. Continuation-fan ink shares the
actual road's remap for `s ≤ s_L`; past `s_L` it is remapped at the frozen
terminal scale `c_end = c(seg(s_L))`. `width_exag` and `straight_compress` are
never re-derived on member geometry.

### 2.3 Auto width_exag

Default `width_exag` is solved, not guessed: pick the smallest factor such that
the **tightest drawn corner** in the window satisfies

```
(road_width × width_exag) / R_corner ≥ WIDTH_RATIO_TARGET = 0.55   // TUNING
```

clamped to `width_exag ≤ WIDTH_EXAG_MAX = 12` (TUNING) and reduced if the drawn
road would self-overlap across adjacent corners (§2.6). For a 7 m two-lane road on
an R 45 corner this yields `width_exag ≈ 3.5`; genuinely tight scenarios
(R 10–15 m) need little or none — a physically compact corner is already
book-proportioned.

### 2.4 The default camera: crop, orientation, padding

**Auto-window.** The default window is computed over **all lines of the
figure**, in true metres:

```
start_anchor(line) = s of first(turn_in, brake_start, position_start)
                     else s of the line's first sample

end_anchor(line)   = s of the line's exit event, if one exists
                     else terminated.s                    // crash, off_road, stopped
                     else s of the line's last sample     // road_end, guards

window.from = min over lines of start_anchor(line) − WINDOW_LEAD_M   (15 m TUNING)
window.to   = max over lines of end_anchor(line)   + WINDOW_TAIL_M   (25 m TUNING)
both clamped to [0, road length]
```

The rule's guarantee, stated as the reason it exists: **every line's terminal
sample — the pedagogically loudest pixel of every red line — is inside the
frame**, for any mix of clean and terminated lines, with no authoring. Lateral
framing needs no special case: off-road runs terminate at the bracketed edge
crossing (02 §7), so no drawn geometry exists outside the road corridor plus the
occluder band. Multi-corner figures need no special case either — the
min/max-over-lines spans every corner's activity; they aim the frame through
`orient` instead.

Geometry outside the window is not drawn; instead the frame edge carries an
**entry annotation** — an inbound arrow with a speed chip
("braking from 82 km/h") — so the off-frame approach is stated, not depicted. The
full-extent view is one flag away (`mode: "true"` or `window: "all"`), keeping the
honest debug view always reachable.

**Orientation.** `orient` resolves post-projection, pure and rigid: compute the
drawn centreline's principal axis (least-squares over drawn samples); if the
tight drawn bounding box's long/short ratio ≥ `ORIENT_ELONGATION_MIN = 1.25`
(TUNING), `"auto"` rotates by the multiple of 90° that brings the principal axis
vertical — chain-shaped scenes go portrait like the book — choosing between the
two aligned rotations the one that puts the line's *start* nearer the frame top
(chained figures read top→bottom). Below the threshold, `"auto"` resolves to 0.
Explicit numeric values override. The resolved value rides the export manifest
(§7); the disclosure footnote is unchanged — rotation is not a scale statement.

**Aspect-floor padding.** After orientation, if the tight frame's aspect falls
outside the proportion gate's band `[0.55, 1.8]` (§6.1), the deficient dimension
is padded symmetrically to the nearest bound — no new constants; the band *is*
the spec. The label-layout pass (§3.1 stage 10) places callout boxes
preferentially in the padding — precisely the book's own layout, callouts
filling the lateral grass. The proportion gate (§6) measures the padded frame.

**The auto-window ignores fan geometry (D45, gated).** The auto-window is
computed on the actual road's lines only and never on continuation-fan geometry.
Fan ink is clipped in projected XY against the frame; the station-based crop of
this section is undefined off the actual road and is never applied to it.

### 2.5 Invariants (normative; property-tested per `09-verification-and-testing.md`)

For every line and every valid `ViewSpec`:

- **P1 — Order.** The station remap is strictly monotone: event order and sample
  order along every line are preserved.
- **P2 — Containment.** A sample is inside the drawn road/lane **iff** it is
  inside the true road/lane (`|d| ≤ w/2 ⇔ |d′| ≤ w′/2`).
- **P3 — Side.** `sign(d′) = sign(d)` at every station; inside/outside and
  oncoming-lane relations are preserved.
- **P4 — Crossings.** Two lines cross between stations in drawn space **iff**
  they cross there in true space (the map is monotone in `s`, linear in `d`).
- **P5 — Corner shape.** Corner hand, sweep angle, and the arc/straight/taper
  segmentation are preserved; apex *ordering* between lines at a corner is
  preserved (a later apex draws later).
- **P6 — Identity.** `mode: "true"` with no window is the identity on `(s, d)`.

P1–P6 are relations stated in `(s, d)`: they are therefore invariant under a
road-level `hand=` mirror (03 §3.1), and unaffected by `orient` (§2.4), which is
a rigid isometry of drawn space applied after projection.

What the projection deliberately does **not** preserve: metric scale along
straights and lateral scale. That is the point, and it is disclosed (§2.7).

### 2.6 Failure and degradation

The projection is a pure `project(road, lines, viewSpec) → Result<DrawnScene>`.
It fails typed (`BAD_RANGE` for an empty or inverted window, `INTERNAL` for a
non-monotone remap — believed impossible) rather than drawing nonsense. If the
exaggerated road would self-intersect across corners (possible on tight linked
esses at high `width_exag`), the projection reduces `width_exag` to the largest
non-overlapping value and records `degraded: true` with the achieved ratio — the
proportion gate (§6) then decides whether the figure is acceptable.

### 2.7 Disclosure

Every diagram-mode figure carries a standard footnote, rendered small in the
frame margin and recorded in the export manifest:

> *diagram scale — straights compressed ×5, road width ×3.5; physics simulated on
> true geometry (R 45 m, entry 82 km/h)*

The numbers are the actual factors used. `mode`, the factors, the window, and
the resolved `orient` also ride the export manifest (§7), so no consumer can
mistake a diagram for a scale drawing. This is the same honesty mechanism the prior design used for `exag`,
applied to a transform that actually closes the gap.

**The continuation placard (D45, gated).** On every fan and every commitment
report, verbatim:

> *"A declared probe set of continuation roads under `street/1` — a
> sample of the possibilities, not the set of them. The road can always be
> tighter than the pack admits."*

Every count renders as **"N of the M continuations still consistent with what you
could see were refuted — under `street/1`, from this station, by the
lean-and-brake rider"**, with `M = k_admissible`, **never** `K_MEMBERS`. The verb
is normative: the count is a refutation count, and a bare noun phrase would read
as the affirmative survivability claim `03-…md` §7a.1 discipline 2 forbids.
The pack string is the prior's own `"<name>/<version>"` identity (`00 §5`,
`CommitmentReport.prior`), so a consumer rendering the count from `report.prior`
reproduces the pinned string byte-for-byte.

When `actual_road_refuted` is true the string appends **"— including
the road you are actually on, under this escape, from this station."** When
`filter_effective` is false the string appends *"consistency filter inactive at
this station (sight fully blocked)"*. The phrase *"the corner is unescapable"* is
forbidden on every surface; `k_refuted = 0` renders as *"not refuted under this
pack"*. Every rendered count also names the escape rider's `short_name`, *the
lean-and-brake rider* (`04-solver-and-authoring.md` §4c.7). `A-COMMIT-PROSE`
asserts all of it.

---

## 3. The top-down renderer

`renderTopdown(drawnScene, style?) → SvgString`. A pure string builder: no DOM, no
IO, never throws (try/catch to a minimal valid `fallbackSvg(msg)` — carried). The
renderer is **projection-agnostic**: it consumes a `DrawnScene` and cannot tell
`true` from `diagram` mode; every layout decision was the projection's.

### 3.1 Draw order (fixed, background → foreground)

1. Background (grass tone).
2. Road surface polygon (from projected edges).
3. Lane markings — centreline and edge lines per the road spec.
   `use_full_width: true` (03 §6) suppresses the centreline marking and keeps
   the edge lines — the book's track-framed roads carry no centreline.

**Stage 3b — the usable corridor (D47).** The two edges of the band `f` runs on:
the rider's lane inset by `bike_margin_m`, from `road/corridor.ts`'s
`corridorEdgeOffsets` (the renderer re-derives no corridor arithmetic). Drawn as
a finely dotted neutral pair — road furniture, never a verdict colour, never
arrowheaded, so it cannot read as a trajectory. Omitted only when the corridor
and the carriageway coincide (`use_full_width` with a zero margin).

Why it is a stage and not a nicety: `off_road` fires at the CARRIAGEWAY edge and
stage 8's terminal glyph lands there, but every check that grades a line as
running *wide* — `exit_containment`, `chain_containment`, and the apex
percentages, all measured in `f` — grades against this inner band. Without it a
verdict card says "ran wide" and the figure shows nothing to be wide of.
4. Surface patches — gravel as explicit stippled circles (carried rule: no SVG
   `<pattern>`; explicit elements rasterize predictably everywhere).
5. Occluder glyphs — one schematic glyph per occluder kind from `03`'s
   vocabulary: `hedge` (organic blob), `wall` (hatched band), `bank` (contoured
   band), `vehicle` (rounded rectangle, windshield hint).

**Stage 5b — the continuation fan (D45, gated).** A stage of its own, between
stage 5 and stage 6. Drawn only when `view.fan`
resolves on and `envelope_contains_actual` is true. Each **admissible**
member's road polygon past `s_limit` paints as a translucent neutral band at
`FAN_ALPHA = 0.14` (TUNING) hatched `FAN_HATCH = "2 4"`, plus its centreline
at `FAN_ALPHA_LINE = 0.30` (TUNING). Refuted members carry a short hatched
cross-tick at the escape's failure station — the refutation's location, never
a verdict colour. Inadmissible members are not drawn at all: the fan you see
*is* the filtered set. Neutral ink only; the fan is not a trajectory, carries
no arrowhead, is never verdict-coloured, and D9's colour law is untouched
because a road has no quality. The occluded-region wash (stage 6) paints over
the fan, so the fan lives visibly inside the unseen region.

**Drawn extent is separate from computed extent.** The fan is drawn to the
lesser of `FAN_DRAW_M = 30.0 m` and `FAN_DRAW_SWEEP_MAX_DEG = 60.0°` past
`s_L` (the sight-limit station, `03-…md` §7a.3; both TUNING, render constants
owned by this section), while refutation
is computed over the full member. A 180 m fan on a 47 m road is a rendering
defect, not evidence. The split is disclosed on the placard: *"drawn to 30 m;
refutation computed over the full 78 m member."* A refuted member whose
failure station lies beyond the drawn extent renders its cross-tick clamped to
the fan's drawn end with the `truncated` hatch.

6. **Occluded-region shading** — for the figure's designated eye sample, the road
   area beyond the limit point is washed in neutral grey at low opacity
   (`OCCLUSION_ALPHA = 0.35` TUNING): the reader sees *what the rider cannot*.
7. **Sight rays** — rays from the eye position to the limit point (the fig 8.1
   teaching device). Normative trigger: **sight rays render iff the figure has
   ≥ 1 occluder.** Default (`rays: "auto"`): one ray per line, anchored at that
   line's **first** `turn_in` event — the pinned default for multi-`turn_in`
   lines (a `fifty_pence` line draws one ray, not six). `rays: "all_turn_ins"`
   draws one per `turn_in` event; `rays: "off"` draws none (ViewSpec field,
   scene `view:` key, CLI `--rays`). Ink per §5.2: dashed, thin, semi-opaque, in
   the owning line's verdict colour, no arrowhead — the ray terminates at the
   limit point. Ray endpoints are projected like all other station-anchored
   geometry.
8. **Lines**, in role order `reference → alternative → mistake → ideal` (ideal
   on top), stroked per the ink grammar (§5.2): every trajectory solid with an
   arrowhead, except the dotted `reference`. **Every line's polyline ends at its
   trajectory's final sample, and the arrowhead sits on that sample, oriented to
   the final heading `psi`.** Because `off_road` terminates at the bracketed
   edge crossing (02 §7, D19), a runoff line's arrowhead lands exactly on the
   road edge, pointing off it — the book's ink: red arrowheads on-pavement at
   the outer edge, aimed at the consequence. Terminal glyph variants keyed by
   `terminated.reason` (presentation-only; sizes TUNING):

   | reason | terminal treatment |
   |---|---|
   | `road_end` | plain arrowhead (the natural exit — no extra glyph) |
   | `off_road` | arrowhead on the edge crossing + a short tick along the road edge at the crossing |
   | `crash` | ×-burst glyph at the final sample (replaces the arrowhead) |
   | `stopped` | transverse bar (a "full stop" tick) at the final sample |
   | `max_time` / `max_dist` | plain arrowhead; the manifest records the guard (a guard ending in ink would be a bug surfaced by the vision judge) |

**Stage 8b — line chrome (D47).** Presentation ink derived from the drawn
polyline and its true stations — deliberately NOT stage 9, which is the
marker-from-event law and admits no glyph without an event behind it. Four
elements, none of which invents geometry (every one sits on a drawn sample):

   | element | rule |
   |---|---|
   | direction chevron | one every `LADDER_EVERY_M = 10.0 m` of true station, in the line's colour, pointing along travel; numbered **on the ideal line only**, so one figure carries one distance scale |
   | entry annotation | a filled cap at the line's first drawn sample plus its entry speed in km/h; lines sharing an entry split across the line so two stamps never collide |
   | outcome word | `clean` / `caution` / `ran wide` / `ran off` / `crashed` / `stopped`, beside the terminal glyph, in the line's colour with a halo. **This is the redundancy that makes a verdict survive a greyscale print or a red-green reader** — §5's palette is untouched, a second channel is added |
   | consequence ray | gated on `view.consequence` (§2.1, default off). Past an `off_road` terminal only: the final heading extrapolated at constant heading, cut at the first occluder it meets or at `CONSEQUENCE_LEN_M = 8.0 m` (TUNING). **Neutral hatched ink, no arrowhead, never a verdict colour** — the engine did not integrate it, so §3.2's "no line the engine did not produce" is honoured by making it visibly not a line |

9. **Markers — the marker-from-event law.** A marker is the glyph of an event:
   for each line, the renderer draws one glyph per trajectory event whose kind
   maps to an enabled marker class (per the line's effective `MarkSpec`, owned
   by 03 §8). There is no other marker source — a marker with no underlying
   event cannot exist, and a line with six `turn_in` events draws six
   hourglasses. Each glyph inherits its line's colour.

   | Marker class | Glyph | Source event kind |
   |---|---|---|
   | `turn_point` | hourglass (carried) | every `turn_in` event — one per steering input (fig 8.3's per-facet device) |
   | `apex` | ring (carried) | every `apex` event — one per touch (a double-apex line's second ring comes for free) |
   | `exit` | dot (carried) | the `exit` event — absent when the line never regains exit heading; an empty set is the honest render |
   | `release` | outward double-chevron `»`, stroke-only | the `release` event — exists wherever a commitment released; an empty match on an unreleased line is the honest render |

   There is deliberately no `facet` class: facets *are* `turn_in` events —
   markers are event-sourced, and verdicts are never a marker source.
   **Coincident collapse:** after projection, markers of the same class whose
   true stations lie within `MARK_COINCIDE_EPS_M = 1.0 m` (TUNING) and whose
   drawn positions overlap within one glyph radius collapse to one glyph, drawn
   in the colour of the owning line drawn last in role order (ideal wins ties)
   — deterministic, never a Z-fight. Markers of different classes never
   collapse.
10. **Callout labels** — resolved from the figure's label set (grammar, feature
    vocabulary, and wire shapes owned by 03 §8): road anchors
    (`entry|mid|exit:<id>`) and line-addressed feature anchors
    (`feature[:corner][#n]@line ±m`), up to three leader lines per box. Leader
    endpoints attach to the owning line's projected sample at the resolved
    station (road anchors without `@` lead to the road centreline point) —
    never to empty space. Label boxes repel each other and the road ink by a
    simple candidate-position scoring pass, preferring the aspect-floor padding
    (§2.4). Leader ink per §5.2.
11. **Margin chrome and placards** — the disclosure footnote (§2.7), the entry
    annotation (§2.4), the legend (§5.3), figure-level placard boxes, and the
    **scale bar (D47)**: a round distance (5/10/20/25/50/100 m, the one nearest
    a fifth of the frame) captioned in metres AND feet, plus the lane width.
    Drawn space is true metres in v0.1, so the bar is literal. Without it no
    distance in the figure — how early the turn-in was, how much road the
    mistake ate — carries a unit. This stage is the single slot for
    honest-limitation placards (01 §8) and the version-skew divergence placard
    (05 §8.4). Placards are rendered elements, never errors.

### 3.2 What the renderer refuses

- It draws no line the engine did not produce (every path comes from a
  `LineResult.trajectory`) — carried honesty stance.
- It invents no colour: colour comes from the verdict mapping (§5) only.
- It performs no geometry transforms: a renderer that also projects would make
  the invariants untestable in isolation.

---

## 4. The controls strip

`renderControls(lineResult, window?, cursor?) → SvgString`. The strip-chart of the
focused line's control and state channels against **true station** — the strip is
never projected; its `s` axis is honest metres with the diagram window marked as a
shaded band, so the reader can always relate compressed drawing to true distance.

- **Channels** (stacked, shared `s` axis): `v` (km/h); `phi` vs `cmd_lean`
  overlaid (delivered vs commanded lean — the run-wide slice's stand-up deviation
  is *visible* here); brake / throttle as `cmd_a` split by sign with the
  delivered `a_long` overlaid where clipped; `grip`; `sight_ride_m` vs `ssd_m`
  overlaid (same rider-path basis, 05 §2.1; the strip's caption discloses the
  basis; the vertical gap is the sight margin; a crossing is a
  `stop_within_sight` failure staring at the reader).
- **Stand-up** (`deg/s`): `su_sustained` and `su_transient` drawn as an overlaid
  pair (neutral palette) — nonzero exactly while the slice is acting. The `phi`
  vs `cmd_lean` divergence above it becomes *attributable*: rate-railing shows
  the tracker pinned at `roll_rate` with `su ≈ 0`; stand-up shows `su ≠ 0`.
- **Neutral palette** (carried hard rule): channel colours never reuse the
  green/amber/red verdict palette, so nothing in the strip reads as a line
  verdict.
- **Captions are riding words, channel keys are field names (D47).** A panel is
  titled for the rider — *Speed*, *Lean — asked for, and delivered*, *Brake and
  throttle — commanded, and what the tyre allowed*, *Grip in reserve*, *Can you
  stop inside what you can see?*, *Stand-up* — while each trace keeps its engine
  channel name in the panel key and in `data-channel`, so nothing
  machine-readable is traded for readability. The sight panel's rider-path basis
  disclosure (D16) is normative and rides in the title.
- **The strip is sized around its captions, not only its plot.** Plot width is
  `max(MIN_PLOT_WIDTH, span × PX_PER_M, widest title)`: a strip that sizes itself
  from the plot alone clips every caption on a short line. Channels with a fixed
  meaningful range (`grip`, 0…1) are drawn against that range with the
  out-of-range band shaded, never auto-scaled to their own extent — a line that
  kept a third of its grip in reserve otherwise draws exactly like one that ran
  out of road.
- **Phase bands:** the vertical bands are exactly `05` §4.1's phase partition
  (`approach | turning | midcorner | exiting | done`, D41) — one band per phase
  span, labelled with the phase token verbatim. The strip defines no partition
  of its own; `brake_start` remains an event tick, not a band edge. The book's
  entry/mid/exit words stay caption and anchor vocabulary, never band labels.
- **`k_refuted`** (optional, off by default, D45, gated): a step plot against
  honest station metres with `k_admissible` as its ceiling — the fan collapse as
  a graph, with the probe stations as ticks. Neutral palette, unprojected like
  the rest. Probes with `escape_status = "probe_outside_reserve_at_entry"` draw
  as a **gap**, never as zero: the escape could not be evaluated there, which is
  not the same as nothing being refuted.
- **Cursor hook**: an optional `cursor` station draws a vertical rule with per-
  channel value chips; the interactive linkage (scrub → cursor) is owned by
  `07-viewer-animation-and-pov.md`, which re-renders this pure function per frame.
- **Compare mode**: at most one focused line plus optional thin ghost traces of
  other lines' `v` and `phi` — full multi-channel overlays of N lines are
  refused; the stepper's side-by-side panes handle that.

---

## 5. Colour law v2 (D9 · D11, normative detail)

Colour remains a hard doctrinal signal — but it now derives from **each line's
own emergent verdict**, never from its authored role.

### 5.1 Quality: the single total colour function

Per D11, `outcome` is physics-only (05 §6.1) and the check vector is graded by
the loaded rubric pack (01 Appendix A); `quality` composes the two:

```
quality(verdict) =
    "failing"  if outcome ∈ {crash, runoff, wide}
               or any critical-severity check failed
  | "good"     if outcome = contained and doctrine.fail = 0    // the `clean` predicate
  | "caution"  if outcome = contained and doctrine.fail > 0
  | "caution"  if outcome = stopped

good      → green  #1f6f43     (carried palette)
caution   → amber  #b07d1e
failing   → red    #b32e2e
```

The function is total over the closed outcome set and every branch is reachable
(`P-QUALITY-TOTAL`, 09-verification-and-testing.md). Check severity
(`advisory | standard | critical`) is rubric-pack data attached to the check id
(01 Appendix A) — never a property of the line's role — so colour still derives
solely from the line's own emergent verdict; D9 holds. Refused lines draw
nothing: they are `LineRefusal` envelope entries (05 §7), not rendered geometry.

Consequences, stated because each fixes a recorded prior defect:

- A **contained line with failed non-critical checks renders amber (`caution`),
  not red** — the prior "lone linked line renders red" defect class is closed by
  construction: a correctly-ridden chained line passes its chain-aware checks,
  is `clean`, and renders green with no carve-out.
- A `mistake`-role line that happens to stay contained shows **amber**: the
  picture tells the truth about what the engine found, even when the author
  expected worse. The mistake-preset oracle (`09` §4) catches the mismatch
  between expectation and outcome; the drawing never lies to protect the lesson.
- A failed `alternative` strategy renders **red on its own merits**: a
  single-apex line on a double-apex corner fails the sole critical check
  (`wrong_strategy_for_corner`, 01 Appendix A) and reads red without physical
  departure — the book's fig 8.4/8.5 companion lines no longer need a special
  slot. There is no amber-slot cap and no limit on lines per figure beyond
  legibility (the vision judge's axis).
- A `stopped` line reads **amber**: it stayed on the pavement and broke no
  ceiling, but a line that halts before road end is not a demonstrated line.

**`standing` is not a colour (D43).** `quality` remains the single total colour
function (D9). A `standing` token may be printed as a **word** — legend row,
margin card, HUD caption — and is never mapped to a fill, a stroke, or a palette
entry. Rungs 4 and 3 are both green lines; the difference between them is a
sentence, not a hue, because the difference is doctrinal reserve and the colour
law grades quality. The same rule binds `k_refuted`: a count is never a colour.

### 5.2 Ink grammar v2 (D28)

> **Dash is reserved for non-trajectory ink and the `reference` role. Every
> trajectory ends in an arrowhead; no annotation stroke carries one.**

| Ink | Stroke | Arrowhead |
|---|---|---|
| trajectory, role `ideal` | solid, `W_IDEAL = 3.0 px` | yes |
| trajectory, role `alternative` / `mistake` | solid, `W_LINE = 2.2 px` | yes |
| trajectory, role `reference` | dotted `DOT_REF = "1.5 3"`, `W_REF = 1.6 px` | yes |
| sight ray | dashed `DASH_SIGHT = "6 4"`, `W_RAY = 1.2 px`, opacity `RAY_ALPHA = 0.45`, verdict colour of its owning line | no — terminates at the limit point |
| label leaders | solid `W_LEADER = 0.9 px`, neutral ink (the carried neutral-palette rule extended to annotation) | no |

All widths at the nominal 1000 px frame; all TUNING. The resulting
disambiguation rule: **solid + arrowhead = a ridden line; dashed + thin +
semi-opaque + no arrowhead, ending at the limit point = a sight ray; dotted +
arrowhead = the demoted reference baseline** (not a book device; never appears
in book-parity scenes). A red mistake path and its red sight ray cannot be
confused, and book parity is the *default*, not a mode — the book draws all
trajectories solid with arrowheads and only sight lines dashed.

Role's accessibility channel is **legend text (§5.3) + stroke-width tier +
marker set**, never dash on a non-reference trajectory; colour stays
verdict-only (D9) and is never the sole carrier of any distinction.

### 5.3 The legend (the role channel)

One row per line, in draw order, machine-derivable; rendered by draw stage 11
(§3.1) beside the disclosure footnote:

```
legend-row := <swatch> SP <name> " — " <role> " · " <quality> [" (" <outcome> ")"]
quality    := "good" | "caution" | "failing"        # §5.1's words
outcome    := appended iff quality ≠ "good": the verdict outcome word
              (contained | wide | runoff | crash | stopped)
```

`swatch` is an 18 × 3 px sample of the line's exact stroke (verdict colour, role
width, pattern, arrowhead), so the legend doubles as the style key. Worked
example — the two ambers a student must distinguish:

```
▬▶ bad   — mistake · caution (contained)      ← an error you got away with
▬▶ wide  — alternative · caution (contained)  ← a sound strategy, contained by design
▬▶ good  — ideal · good
```

Colour still means exactly one thing (verdict, D9); *role* is read from the
legend, which is precisely where the two meanings of amber separate.

**When it renders:** `legend = auto | on | off` (ViewSpec §2.1, scene `view:`
key, CLI `--legend`); default `auto` renders the legend whenever the figure has
≥ 2 lines **or** any line's quality ≠ `good`. Under the ink grammar the legend
is the primary role channel, so `auto` keeps it present exactly when role
matters. Each figure's legend rows also ride the export manifest (§7).

---

## 6. The proportion gate

A mechanical gate computed from the `DrawnScene` (and recomputable from the SVG),
run on every diagram-mode export. It exists because the stretched-figure defect
class was invisible to a regime that only checked "renders" and "reads correctly
up close" — nobody measured *proportions*.

### 6.1 Metrics

| Metric | Definition | Target band (TUNING) |
|---|---|---|
| `width_ratio` (per corner) | drawn road width / drawn centreline radius | 0.45 – 0.95 |
| `straight_share` | straight length / total drawn centreline length in frame | ≤ 0.45 |
| `road_ink` | road surface area / frame area | 0.25 – 0.60 |
| `frame_aspect` | frame width / height | 0.55 – 1.8 |

Bands are derived from measuring the book's Chapter 8 figures (width:radius
0.55–0.9; straights well under one arc length; road ink dominant in frame) with
margin; they are TUNING constants blessed in one place and cited by
`09-verification-and-testing.md`.

### 6.2 Semantics

```
gateProportions(metrics) → {verdict: "pass" | "warn" | "fail", findings: [...]}
```

- **fail** outside hard bounds → the export command exits non-zero (gate tier,
  `08-cli-and-agent-interface.md`); a stretched figure cannot be called done.
- **warn** in the margin zones → export succeeds; the finding rides the manifest
  so the vision judge is pointed at it.
- `mode: "true"` renders are **exempt** — they are honest debug views, expected
  to look stretched.
- A `degraded: true` projection (§2.6) is judged by its achieved metrics like any
  other figure — degradation is not an exemption.

The gate is necessary-not-sufficient in the carried sense: it proves proportions;
the vision judge still owns legibility and doctrinal reading
(`09-verification-and-testing.md` §render-then-judge).

---

## 7. Static export

- Every renderer emits a **fully self-contained SVG string** — inline
  `fill`/`stroke`/`<defs>` only; no external CSS, fonts, or `url()` references;
  no SMIL, no `<pattern>` (carried conservatism: an exported figure must render
  identically dropped into any host page or rasterizer).
- One file per figure; an export batch writes a `manifest.json` of per-figure
  records: `{figure_id, spec_hash, mode, view: {window, orient, width_exag,
  straight_compress}, legend: [{line_id, role, quality, outcome}],
  proportion_metrics, gate_verdict, png?}`. `view.orient` is the resolved value
  (§2.4), and the `legend` records mirror the rendered legend rows (§5.3) — the
  amber disambiguation is assertable mechanically in CI, not hoped for in
  pixels.
- **Parity requirement (acceptance bar):** an exported diagram-mode figure of a
  book-figure scenario must read as an *equivalent of the book's figure* — same
  compact proportions, same marker/colour vocabulary, same annotation devices
  (sight rays, turn points, apexes) — judged by the proportion gate mechanically
  and the vision loop editorially. Equivalence is judged **modulo margin
  chrome** (the disclosure footnote, the legend) **and the reference role's
  dotting** — the book's pages carry none of the three.
- Rasterization for judging is owned by `09-verification-and-testing.md`; under
  D1 the toolchain is no longer bound to cairosvg, but the SVG conservatism above
  is kept regardless — it is cheap insurance that exports survive any renderer.

---

## 8. Relation to the prior design

**Carried:** pure never-throw renderers with `fallbackSvg`; self-contained SVG
discipline; the draw-order concept; the hourglass/ring/dot marker vocabulary; the
green/amber/red hex palette; the neutral-palette rule for the controls strip;
stippled-circles-not-`<pattern>`; corner-relative road anchors for labels (now
one arm of 03 §8's line-addressed label grammar); the
render-then-judge philosophy ("the geometry math can be exactly right while the
picture reads wrong").

**Changed:** the compactness mechanism — a station-space projection with
per-segment longitudinal compression, auto width exaggeration, and default crop
**replaces** the lateral-only `exag` knob (D2); colour now derives from each
line's own verdict quality (D9 · D11), removing the single-amber-slot cap and
the contained-renders-red defect; dash is reserved for annotation ink, with role
read from stroke-width tier and the legend (D28); the renderer is factored to be
projection-agnostic; sight rays and occluded-region shading are promoted from
"blocked vocabulary" to first-class draw stages.

**New:** the `ViewSpec` grammar (window, orientation, POV look, rays, legend);
the projection invariants P1–P6 as testable properties; the disclosure footnote
with actual factors; auto-orientation with aspect-floor padding; the
marker-from-event law, terminal glyphs, and the legend; the proportion gate and
its book-derived bands; the export manifest carrying view, legend, and gate
records; draw-order stage 5b (the continuation fan) and its render constants
(`FAN_ALPHA`, `FAN_ALPHA_LINE`, `FAN_HATCH`, `FAN_DRAW_M`,
`FAN_DRAW_SWEEP_MAX_DEG`); the continuation placard and count grammar (§2.7);
the ViewSpec `fan` key (§2.1, resolution owned by
`07-viewer-animation-and-pov.md` §5.3) with the fan's remap and auto-window rules
(§2.2, §2.4); the `k_refuted` controls channel; the `standing`-is-not-a-colour
rule.
