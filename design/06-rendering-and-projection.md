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

### 2.1 Modes

```
ViewSpec = {
  mode: "true" | "diagram",                       // default "diagram" for figures
  window?: {from: StationRef, to: StationRef},    // crop, default per §2.4
  width_exag?: number,        // default auto (§2.3)
  straight_compress?: number, // default C_STRAIGHT
  taper_compress?: number     // default C_TAPER
}
```

`mode: "true"` is the identity transform plus optional crop — the debug/inspection
view. `mode: "diagram"` applies the projection below and is the default for every
exported figure.

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

### 2.4 The default camera: crop to the corner window

```
window.from = first(turn_in, brake_start) − WINDOW_LEAD_M   (15 m TUNING, true metres)
window.to   = exit + WINDOW_TAIL_M                          (25 m TUNING)
```

Multi-corner figures take the union from the first corner's lead to the last
corner's tail. Geometry outside the window is not drawn; instead the frame edge
carries an **entry annotation** — an inbound arrow with a speed chip
("braking from 82 km/h") — so the off-frame approach is stated, not depicted. The
full-extent view is one flag away (`mode: "true"` or `window: "all"`), keeping the
honest debug view always reachable.

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

The numbers are the actual factors used. `mode`, the factors, and the window also
ride the export manifest (§7), so no consumer can mistake a diagram for a scale
drawing. This is the same honesty mechanism the prior design used for `exag`,
applied to a transform that actually closes the gap.

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
4. Surface patches — gravel as explicit stippled circles (carried rule: no SVG
   `<pattern>`; explicit elements rasterize predictably everywhere).
5. Occluder glyphs — one schematic glyph per occluder kind from `03`'s
   vocabulary: `hedge` (organic blob), `wall` (hatched band), `bank` (contoured
   band), `vehicle` (rounded rectangle, windshield hint).
6. **Occluded-region shading** — for the figure's designated eye sample, the road
   area beyond the limit point is washed in neutral grey at low opacity
   (`OCCLUSION_ALPHA = 0.35` TUNING): the reader sees *what the rider cannot*.
7. **Sight rays** — dashed rays from the eye position to the limit point (the
   fig 8.1 teaching device), one per selected sample (default: each line's
   `turn_in` event), drawn in the owning line's verdict colour at reduced
   opacity. Ray endpoints are projected like all other station-anchored geometry.
8. Lines, in role order `reference → alternative → mistake → ideal` (ideal on
   top), each with an arrowhead inheriting the line's colour.
9. Markers — carried vocabulary: **hourglass** = turn point, **ring** = apex,
   **dot** = exit; each inherits its line's colour.
10. Callout labels — corner-relative anchors (`entry`, `apex`, `exit`, `±offset`)
    with leader lines; label boxes repel each other and the road ink by a simple
    candidate-position scoring pass.
11. The disclosure footnote (§2.7) and entry annotation (§2.4).

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
  delivered `a_long` overlaid where clipped; `grip`; `sight_m` vs `ssd_m`
  overlaid (the vertical gap is the sight margin; a crossing is a
  `stop_within_sight` failure staring at the reader).
- **Neutral palette** (carried hard rule): channel colours never reuse the
  green/amber/red verdict palette, so nothing in the strip reads as a line
  verdict.
- **Corner-phase bands**: vertical bands derived from events — approach
  (`brake_start→turn_in`), steering (`turn_in→steering_complete`), mid
  (`→roll_on`), exit (`→exit`) — labelled per the book's entry/mid/exit teaching
  vocabulary.
- **Cursor hook**: an optional `cursor` station draws a vertical rule with per-
  channel value chips; the interactive linkage (scrub → cursor) is owned by
  `07-viewer-animation-and-pov.md`, which re-renders this pure function per frame.
- **Compare mode**: at most one focused line plus optional thin ghost traces of
  other lines' `v` and `phi` — full multi-channel overlays of N lines are
  refused; the stepper's side-by-side panes handle that.

---

## 5. Colour law v2 (D9, normative detail)

Colour remains a hard doctrinal signal — but it now derives from **each line's
own emergent verdict**, never from its authored role.

### 5.1 Quality classes and the mapping

```
quality(lineResult) =
    "good"      if outcome = clean  and no doctrine check failed
  | "contained" if outcome = violation, or outcome = clean with failed checks
  | "failing"   if outcome ∈ {wide, runoff, crash}

good      → green  #1f6f43     (carried palette)
contained → amber  #b07d1e
failing   → red    #b32e2e
```

Consequences, stated because each fixes a recorded prior defect:

- A **contained good line renders amber, not red** — the prior "lone linked line
  renders red" defect class is closed by construction.
- A `mistake`-role line that happens to stay contained shows **amber**: the
  picture tells the truth about what the engine found, even when the author
  expected worse. The mistake-preset oracle (`09`) catches the mismatch between
  expectation and outcome; the drawing never lies to protect the lesson.
- A failed `alternative` strategy (e.g. a single-apex line on a double-apex
  corner) renders **red on its own merits** — the book's fig 8.4/8.5 companion
  lines no longer need a special slot. There is no amber-slot cap and no limit on
  lines per figure beyond legibility (the vision judge's axis).

### 5.2 Role is a separate, redundant channel

Roles render as **dash patterns + legend text**, orthogonal to colour:

```
ideal → solid (thickest) | alternative → long dash | mistake → short dash | reference → dotted
```

So a colour-blind reader distinguishes roles by dash and verdicts by legend, and
colour is never the sole carrier of any distinction — an accessibility rule the
prior design implied but never pinned.

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
  records: `{figure_id, spec_hash, mode, view: {window, width_exag,
  straight_compress}, proportion_metrics, gate_verdict, png?}`.
- **Parity requirement (acceptance bar):** an exported diagram-mode figure of a
  book-figure scenario must read as an *equivalent of the book's figure* — same
  compact proportions, same marker/colour vocabulary, same annotation devices
  (sight rays, turn points, apexes) — judged by the proportion gate mechanically
  and the vision loop editorially.
- Rasterization for judging is owned by `09-verification-and-testing.md`; under
  D1 the toolchain is no longer bound to cairosvg, but the SVG conservatism above
  is kept regardless — it is cheap insurance that exports survive any renderer.

---

## 8. Relation to the prior design

**Carried:** pure never-throw renderers with `fallbackSvg`; self-contained SVG
discipline; the draw-order concept; the hourglass/ring/dot marker vocabulary; the
green/amber/red hex palette; the neutral-palette rule for the controls strip;
stippled-circles-not-`<pattern>`; corner-relative label anchoring; the
render-then-judge philosophy ("the geometry math can be exactly right while the
picture reads wrong").

**Changed:** the compactness mechanism — a station-space projection with
per-segment longitudinal compression, auto width exaggeration, and default crop
**replaces** the lateral-only `exag` knob (D2); colour now derives from each
line's own verdict with role as an independent dash channel (D9), removing the
single-amber-slot cap and the contained-renders-red defect; the renderer is
factored to be projection-agnostic; sight rays and occluded-region shading are
promoted from "blocked vocabulary" to first-class draw stages.

**New:** the `ViewSpec` grammar; the projection invariants P1–P6 as testable
properties; the disclosure footnote with actual factors; the proportion gate and
its book-derived bands; the export manifest carrying view and gate records.
