# 07 — Viewer, Animation & the Rider's POV

This document specifies linelab's interactive surface: the viewer application, the
**stepper** (the scrubbable animation that makes every instant of a run
inspectable), **compare mode** (multi-line stepping), and the **POV view** (the
first-person pseudo-simulation). It is the design of record for decision **D1**
(interactive-first architecture) as it lands in `viewer/`, and for the largest
subsystem with no prior equivalent.

Contracts owned elsewhere and consumed here: the Sample record, the
time-base, and `stateAt` (**05**); the diagram projection and the top-down/controls
SVG builders (**06**); the road model, occluders, and rider-eye sight results
(**03**); solver semantics (**04**); doctrine and colour law v2 (**01**, **06**).

---

## 1. What this document covers

1. The viewer architecture: one shared core, TypeScript/ESM, per-view rendering
   technology, and why no 3-D library is used.
2. The stepper: scrubber, playback, named jump points, the HUD, and the rule that
   the viewer never re-derives physics.
3. Compare mode: how N lines step together, station-lock vs time-lock, and the
   blind-corner compare as the canonical use.
4. The POV view: camera model, flat-world pinhole projection, draw order,
   occlusion, the limit-point marker, the sight band, and honesty placards.
5. Viewer surfaces: layout, scenario loading, sharing, and the read-mostly stance.

---

## 2. Architecture

### 2.1 One core, two runtimes (carried, restated for ESM)

The prior design's strongest architectural property — the browser and the CLI run
the *identical* physics — is carried forward, with the mechanism modernized. The
core (`core/`, `road/`, `sight/`, `plan/`, `solve/`) is pure TypeScript/ESM with a
**dependency-free import graph**: no runtime dependency appears anywhere beneath
`viewer/` and `cli/`. The viewer imports the same modules the CLI imports; there is
no bundled "viewer build" of the physics that could drift. **09** specifies the
gate that enforces both properties (an import-graph lint and a CLI-vs-viewer
tolerance-equality test, the successor to the prior "G6′" check).

The consequence for animation is the **recompute-in-viewer rule**: the viewer
never loads a shipped trajectory. What travels — as a file, a share string, or a
CLI handoff — is the *scenario plus line specs* (per **D6**), and the viewer runs
the engine itself. This preserves the honesty property ("never ship a trajectory
the engine didn't produce") while making failed lines exactly as loadable and
inspectable as good ones.

Performance makes this comfortable rather than heroic: a canonical ~250 m scenario
is roughly 3–4 × 10³ fixed RK4 steps per line; a full multi-line recompute is
targeted at **≤ 100 ms** on a mid-range laptop (budget, verified in **09**), which
is a one-off cost at load time, not a per-frame cost. Scrubbing reads the finished
result; nothing re-integrates during playback.

### 2.2 Application shell

- **Language/build:** TypeScript, ESM throughout. The viewer app is built with a
  standard dev-server/bundler — **Vite** is the recommended default — because D1
  removed the `file://` constraint that forced classic scripts. The build ships as
  a static bundle; `linelab serve` (see **08**) opens it on a local port with a
  scenario preloaded.
- **Dependency policy:** dependencies are permitted in `viewer/` and `cli/` only,
  and sparingly; the core import graph stays dependency-free. This keeps the
  no-dependency ethos exactly where it buys determinism and portability, without
  re-fighting the browser platform in the UI layer.

### 2.3 Rendering technology per view

| View | Technology | Why |
|---|---|---|
| `topdown` | SVG DOM | Reuses the pure SVG builders in `render/` (**06**) verbatim — the interactive top-down is the *same picture* as the exported figure, plus a glyph layer. SVG keeps markers, labels, and hit-areas addressable. |
| `controls` | SVG DOM | Same builders as the exported strip; the linked cursor is one overlay line moved per frame. |
| `pov` | 2-D canvas | Redrawn fully every frame while scrubbing; a painter's-order polygon fill loop suits canvas, and no retained scene graph is needed. |

**No 3-D library.** The POV is a flat-world pinhole projection of ground-plane
polylines plus vertical occluder quads — on the order of a hundred lines of
projection math (§5), all of it specified in this document. A general 3-D engine
would import a scene-graph, an asset pipeline, and a camera abstraction to draw
what is essentially one textured ground plane; it would also be the project's
largest dependency by an order of magnitude. If a later version wants lighting or
mesh terrain, the camera model in §5 transfers to WebGL unchanged — the state
contract does not name the rasterizer.

### 2.4 The viewer never re-derives physics

A hard rule with the same force as the colour law: **every quantity the viewer
displays is either a recorded field of the result envelope or the return value of
a pure core function** (`stateAt`, `sightFrom`, unit conversions from
`core` units helpers). The viewer performs no arithmetic on physics values beyond
unit formatting. This is what makes the HUD trustworthy: a number on screen is the
engine's number, not the UI's reconstruction of it. (The one apparent exception,
the friction-ellipse widget, draws the *recorded* normalized components from the
Sample record — **05** — precisely so the viewer does not recompute them.)

---

## 3. The stepper

The stepper is the central interactive surface: a timeline that makes "examine the
physics and controls at any point" a literal drag of a slider.

### 3.1 Scrubber and playback

- The scrubber indexes the **interpolated time-base** defined in **05**: dragging
  to time `t` displays `stateAt(result, {t})`; a station read-out shows the
  corresponding `s`. A toggle switches the scrubber axis to station `s` (same
  contract, `stateAt(result, {s})`) — time-axis for "what happens next", station
  axis for "what happens *here*".
- **Playback:** play/pause; speed multipliers 0.25× / 0.5× / 1× / 2× of real time;
  frame-step buttons advance one HUD refresh (±0.1 s) and one recorded sample
  (± one Sample) respectively. Playback is a scheduled scrub — it moves the same
  cursor the drag moves; there is no second animation pathway.
- **Named jump points.** The events array of the result envelope (**05**) is
  rendered as labelled ticks on the timeline: brake onset, turn-in, steering
  complete, apex (emergent, hence a *measured* tick, never an input), roll-on,
  exit, and terminal events — crash instant, stop, and the run-wide/road-end
  pair (`run_wide_detect`, `road_end` in **05**'s closed Event kinds; "run-off"
  is an *outcome* class, not an event). Clicking a tick jumps
  the cursor there. These are free — the engine already emits them — and they turn
  "step to the apex" from a hunt into a click.

### 3.2 Linked views

One cursor drives every view:

- **topdown** — a bike glyph at `(x, y)` rotated to heading `psi`, with lean `phi`
  encoded as a tilt-proportional side-bar on the glyph (the top-down cannot show
  roll directly; the bar makes it legible without pretending to). The glyph is
  drawn in the line's verdict colour per **D9**. In `diagram` mode the glyph rides
  the *projected* path position (**06** owns the mapping); in `true` mode, the true
  one. The HUD numbers are identical in both modes — projection never touches
  readouts (D2).
- **controls** — a vertical cursor line at the current station across every
  channel of the strip; the strip's channel colours stay neutral (**06**) so the
  cursor and the verdict colours never collide.
- **pov** — the frame rendered for the current sample (§5).

### 3.3 The HUD

A persistent panel, refreshed per cursor move, in neutral (non-verdict) colours:

| Group | Read-out | Source |
|---|---|---|
| Motion | `v` (km/h), heading `psi` (deg), curvature `kappa` (1/m) with equivalent radius | Sample |
| Lean | `phi` (deg) vs the rider profile's roll-rate cap; a small lean-angle dial | Sample + config |
| Grip | live **friction-ellipse widget**: current `(a_long, a_lat)` normalized against the ellipse at local `mu`; margin number = `grip` | Sample (recorded components, **05**) |
| Controls | commanded vs delivered: `cmd_a` against achieved `a_long`, with a **clip badge** when the ellipse limited the command; `cmd_lean` vs `phi`; `roll_rate` in use; the `action_id` of the active plan action, shown by its id and kind | Sample |
| Sight | `sight_m` vs `ssd_m`, margin in metres; a **deficit badge** (red) when `ssd_m > sight_m`; limit-point trend (opening/closing) | Sample |
| Verdict | line role, outcome, and — when the cursor crosses a check's evidence station — the relevant doctrine check id | envelope |

The "commanded vs delivered" row is the teaching payload of Tier 1R (**02**): at a
throttle chop or an over-ambitious brake the HUD shows the command, the
ellipse-clipped delivery, and the widening line, in one glance.

### 3.4 Terminal states

A line that ends early (crash, road-end/run-off, stop) freezes at its terminal sample with
a terminal badge; the scrubber region beyond its end is shaded for that line. The
cursor remains draggable across the full scenario extent so surviving lines in
compare mode keep stepping.

---

## 4. Compare mode — multi-line stepping

A result envelope carries N lines (**05**); compare mode steps them together.

### 4.1 Station-lock is the default

Two lock modes govern what "together" means:

- **`station` lock (default).** All glyphs sit at the same road station `s`;
  each line's HUD state is `stateAt(line, {s})`. This is the doctrinal
  comparison: line selection is about *where you are placed and what state you
  are in at each point of the road*. At the same station, two lines differ in
  lateral position, lean, speed, grip, and — decisively for blind corners —
  sight distance. "The wide entry sees 12 m further *at this station*" is a
  station-locked sentence.
- **`time` lock.** All glyphs sit at the same elapsed `t` — a ghost race. This
  shows the temporal cost/benefit that station-lock hides: the cautious line
  arriving at the exit a beat later, the mistake line arriving at the hedge
  sooner. Secondary, but it is the honest answer to "what does the safer line
  cost?"

The lock toggle is a view control; both modes read the same recorded results.

### 4.2 Focus and ghosts

One line holds **focus**: it owns the HUD, the POV camera, and full-opacity
rendering. Non-focused lines draw as **ghost glyphs** (reduced opacity, verdict
colour retained) on the topdown and as ghost path overlays in the POV (§5.6).
Focus switches by clicking a glyph/legend entry or cycling with Tab. The controls
strip shows the focused line's channels; a thin overlay trace of one other line
can be pinned for A/B reading.

### 4.3 The canonical use: the blind-corner compare

The workflow this mode exists for (**04** builds it, **08** scripts it): solve the
same blind corner twice — geometry-optimal vs **visibility-governed** (hold wide,
speed capped to stop-within-sight) — load both lines in one envelope, station-lock,
and scrub the approach. The HUD sight row and the POV limit point tell the story
sample by sample: the wide line's `sight_m` opens earlier, its deficit badge
clears sooner, and the POV shows the road unrolling from behind the hedge earlier.
No prose in the course made this argument as directly as thirty seconds of this
scrub.

---

## 5. The POV view

The rider's-eye pseudo-simulation. This view is new — nothing in the prior design
renders any camera but top-down — and it is deliberately *pseudo*: a flat-world
perspective projection of the true geometry, not a game engine. Its job is to make
three things visceral: where the rider is pointed, how far they can see, and what
lean feels like as horizon tilt.

### 5.1 Inputs

Everything the POV needs is already per-sample state (**05**) and road/sight
geometry (**03**):

- camera pose: `x, y, psi, phi` from the focused line's Sample;
- road shape: the edge polylines from the road model (`roadOuter`, `roadInner`,
  lane edges, centreline);
- occluders: footprint polygons (**03** owns kinds and placement; heights are
  presentation-only and owned *here* — see the per-kind table in §5.3);
- sight: `sight_m`, `ssd_m`, `limit_x, limit_y` — **rider-eye** results per D4,
  recorded on the Sample.

The POV consumes **true geometry only**. The diagram projection (**06**) never
touches this view — a first-person frame rendered from compressed geometry would
be physically false, and the POV is specified as the one view guaranteed
distortion-free.

### 5.2 Camera model

Per frame, from the focused Sample:

- **Eye** at world `(x, y)` raised to `eye_height_m = 1.4` (TUNING — an eyes-above
  -road height for a seated rider; body position is out of scope per D5, so the
  eye rides the bike's reference point).
- **Yaw** = `psi` (the bike's heading; target fixation and head-turn modelling are
  out of scope).
- **Roll** = `phi` — the whole image rotates with lean, so the horizon tilts
  exactly as much as the bike leans. This is the POV's signature honesty: the
  horizon angle *is* the lean readout.
- **Pinhole projection** with horizontal field of view `fov_deg = 60` (TUNING);
  focal length follows from the canvas width. Near-plane distance
  `near_m = 0.5` (TUNING).

Projection of a ground point `p`: translate by the eye, rotate by `−psi` into the
camera frame (axes: forward, lateral); a point at forward distance `F > near_m`
and lateral offset `L` projects to screen position

```
u = f · L / F
v = v_horizon + f · eye_height_m / F
```

(with `v` measured downward from the horizon row — every ground point of a flat
world lands below the horizon, approaching it as `F → ∞`), and the completed 2-D
frame is rotated by `−phi` about the principal point. The horizon is the eye-level
line through the principal point, rotated with the frame. Polygons are **clipped**
against the near plane before projection (dropping vertices instead of clipping
produces spray artifacts at the frame edges).

### 5.3 Draw order

Painter's algorithm, far to near, fixed:

1. **Sky** above the (rolled) horizon; **ground** below it — flat fills in the
   neutral palette (**06** owns colours).
2. **Road surface** — the closed polygon formed by projecting `roadOuter` ahead of
   the camera and `roadInner` reversed; drawn to the visible extent of the road
   model (the LUT ahead of the current station), not merely to `sight_m` — sight
   is enforced by occlusion, not by truncating the world.
3. **Lane markings** — centreline and lane-edge polylines, projected the same way.
4. **Occluders** — each footprint polygon extruded vertically to its kind's
   presentation height (owned here, all TUNING: `hedge 1.8 m`, `wall 1.2 m`,
   `bank 1.5 m`, `vehicle 1.5 m` — tall enough that every kind fully occludes the
   1.4 m eye, consistent with **03**'s binary is-opaque optical model)
   and drawn as filled quads, sorted far-to-near. Paint order does the doctrinal
   work: **the road beyond the hedge is painted, then the hedge is painted over
   it** — the road visibly disappears behind the occluder, which *is* the
   blind-corner visual the tool exists to show.
5. **Sight band** — the road surface from the current station to `s + sight_m`
   carries a faint neutral tint ("what you can see"); when `ssd_m > sight_m`, the
   band from `s + sight_m` to `s + ssd_m` is tinted red — *the road you would need
   to see to stop, and cannot*. Both bands are surface tints, under the path
   overlay.
6. **Path overlay** — the focused line's samples ahead of the cursor, projected
   onto the ground and stroked in the line's verdict colour (D9). Toggleable;
   ghosts of other lines render at ghost opacity (§5.6).
7. **Limit-point marker** — the projected `(limit_x, limit_y)` drawn as a chevron
   on the road surface, badged with the trend (opening/closing) from the sight
   channel. When the limit point is the far edge of an occluder, the chevron sits
   at its base — visually "the corner of the hedge", which is exactly what a
   rider's limit point is.
8. **HUD strip** — a slim neutral-colour overlay repeating the core HUD numbers
   (`v`, `phi`, `sight_m` vs `ssd_m`, clip badge) so a full-screen POV scrub needs
   no side panel.

### 5.4 Honesty placards

The world is flat by design (D4/D5). Scenario vocabulary cannot express crests or
dips — such input is rejected at validation (D8, **03**) — so the POV never
encounters vertical geometry. The placard rule exists for the boundary case where
an author *asks* for a book figure whose subject is vertical (a crest brow): the
correct output is a refusal panel in the POV frame — "vertical sight geometry not
modelled" — never a faked hill. The placard is a rendered element, not an error:
the rest of the scenario remains scrubable.

### 5.5 Frame stepping and future rasterizers

The POV has no animation loop of its own: it is a pure function
`frame(result, lineId, cursor) → canvas draw list`, invoked by the stepper on
every cursor move. This is what keeps it trivially steppable, and it is the seam
for the future: the same camera model and draw list can target WebGL (or an
offscreen rasterizer for CLI export of POV frame sequences, **08**) without any
change to the state contract or the sight machinery.

### 5.6 Ghost lines in the POV

In compare mode, non-focused lines project as ghost path overlays (their own
verdict colours, ghost opacity) and — under `time` lock — as ghost bike markers at
their own `(x, y)`: the ghost race seen from inside the focused rider's helmet.
Under `station` lock ghost markers are suppressed (two riders at the same station
would overlap absurdly); only the ghost paths draw.

---

## 6. Viewer surfaces

### 6.1 Layout

One workstation page:

- **Left:** `topdown` with its mode toggle (`true` | `diagram`).
- **Right:** `pov` (expandable to full-width).
- **Bottom:** `controls` strip with the linked cursor, the timeline scrubber, and
  the named-event ticks.
- **Side:** the HUD panel, the line legend (role, verdict colour, focus control),
  and the lock toggle (`station` | `time`).

On narrow viewports the three views collapse to tabs over a persistent scrubber —
the cursor state survives tab switches.

### 6.2 Loading a scenario

Three doors, one contract — everything loads as *scenario + line specs* and is
recomputed on entry (§2.1):

1. **File** — open or drag-drop a scenario JSON or scene text file (**03** owns
   both grammars).
2. **Share string** — a URL fragment carrying **05**'s share payload: `#f=` with a
   FigureSpec (the normal, multi-line case) or `#s=` with a single bare scenario
   (the trivial case); encoding per **05** §8.1 (deflateRaw + base64url), specs
   only, never trajectories. Per **D6** the `#f=` payload carries the full line
   set, mistakes included — the prior one-good-line-only restriction is
   deliberately gone.
3. **CLI handoff** — `linelab serve <scenario|scene>` (**08**) starts the viewer
   with the payload preloaded.

### 6.3 Read-mostly, and why

The viewer is **read-mostly**: it offers view-level state only — cursor, focus,
lock mode, view toggles, line visibility, `true`/`diagram` mode — and no scenario
editing. Authoring lives in the CLI, the programmatic API, and scene text
(**04**, **08**).

Rationale, carried from the prior design and still sound: a second authoring
surface inevitably drifts from the solver's validation and defaults; keeping one
authoring path keeps **D8** ("schema-valid implies effectual") enforceable in one
place. The steepest version of the rule is permanent regardless of future
editors: **the lean/steering channel is never hand-editable** — lean emerges from
a turn-in event and a roll-rate limit, and letting a user sculpt the lean curve
would contradict the doctrine the tool teaches. A future "v2 editor" may add
road/plan *parameter* editing over the same `plan/` validation the CLI uses; it
must not add a second physics or a drawn line.

---

## 7. Relation to the prior design

| Prior | This design |
|---|---|
| Read-only two-pane viewer (`index.html` + `embed.html`) over classic scripts from `file://`; no interaction beyond preset choice | Interactive workstation: scrubber, HUD, compare mode, POV; ESM + Vite dev/build (D1) |
| Fire-and-forget SMIL dot animation, ≤ 48 keyframes, orientation-neutral glyph (drops heading and lean), no pause/step | The stepper: sample-accurate scrub over the recorded result via `stateAt`; play/pause/speeds; named jump points; glyph carries heading and lean |
| `#s=` hash carries exactly one trajectory — the good line; mistake overlays unshareable by design | Share payload = scenario + full line set, recomputed on load (D6); failed lines load and step like good lines |
| "Chase view" named once, deferred, zero spec; no first-person anything | The POV view fully specified: camera model, projection, draw order, occlusion, sight band, limit-point marker, placards |
| Viewer proven tolerance-equal to CLI (G6′) via one shared classic-script core | Same guarantee, ESM mechanism; import-graph lint + tolerance test in **09** |
| Static SVG as the product | Static SVG as an export (**06**, **08**); the interactive surface is the product |

What is deliberately preserved: one core with no second physics; the viewer as a
pure consumer; lean never hand-drawn; colour reserved for verdict quality; honest
refusal placards instead of faked geometry.
