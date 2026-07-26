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
4. The POV view: camera model, the `look` toggle, flat-world pinhole projection,
   draw order, occlusion, the limit-point marker (never dropped), the sight band,
   and honesty placards.
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
a pure core function** (`stateAt`, `sightFrom`, `correctiveShot`, unit conversions
from `core` units helpers). The viewer performs no arithmetic on physics values
beyond unit formatting. One restriction sharpens the `sightFrom` case: the viewer
may call `sightFrom` only for **hypothetical eyes** — positions not on any
recorded line (what-if cursor drags off the path); for any instant on a line, the
recorded per-sample sight is authoritative and re-derivation is forbidden
(**05** §1). This is what makes the HUD trustworthy: a number on screen is the
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
- **Named jump points — events-only.** The stepper's named jump targets are
  exactly the result's `events` array (**05** §5's closed kinds), rendered as
  labelled ticks on the timeline; clicking a tick lands the scrubber at the
  event's interpolated `t`. No other bookmark source exists — plan-action starts
  already surface as events (`brake_start`, `turn_in`, `position_start`, …), so
  "plan stations" would be a redundant second pathway. Ticks worth naming:
  `apex` (emergent, hence a *measured* tick, never an input — one tick per
  recorded apex, labelled `apex#2` on a double-apex corner); **`release`** — the
  heading-capture commitment release (**02** §3.1), carried by every committed
  line, which makes "step to the instant the exit unwind begins" a click;
  **`correction`** — the corrective shot-start bookmark ("step to where the save
  had to start", **04**); `run_wide_detect` — the outward corridor crossing; and
  the terminal events `crash`, `off_road`, `stop`, `road_end` ("run-off" is an
  *outcome* class, never an event). These are free — the engine already emits
  them — and they turn "step to the apex" from a hunt into a click.

**Probe jump targets (D45, gated).** When a `CommitmentReport` is attached, the
stepper offers jump targets `probe#1..#N` per corner, read from the report and
**never** from `events` — the event kind set stays closed and the
marker-from-event law is untouched, because the fan is road ink rather than a
marker. `tau_close_s` (D44) is likewise **not** an event and **not** a named jump
target; events remain the sole jump source and `C-BOOKMARKS` is unaffected.

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
| Lean | `phi` (deg) vs the rider profile's roll-rate cap; a small lean-angle dial; a **stand-up chip** showing `stand_up_dps`, rendered only when nonzero; **`a_noreturn`** ("brake ceiling at lean: 5.4 m/s²"), "—" when upright (`a_noreturn_ms2` null) | Sample + config + derived (**05** §4) |
| Grip | live **friction-ellipse widget**: current `(a_long, a_lat)` normalized against the ellipse at local `mu`; margin number = `grip` | Sample (recorded components, **05**) |
| Controls | commanded vs delivered: `cmd_a` against achieved `a_long`, with a **clip badge** when the ellipse limited the command; `cmd_lean` vs `phi`; `roll_rate` in use; the live `steer_state` (`track \| commit \| unwind \| position`, **02** §3.1); the `action_id` / `lat_action_id` of the active plan action(s), shown by id and kind | Sample |
| Sight | the safety compare in rider-path metres (D16): `sight_ride_m` vs `ssd_m`, margin = `sight_margin_m`; a **deficit badge** (red) when `ssd_m > sight_ride_m`; `sight_m` alongside (centreline basis — the cross-line-comparable number and the trend's source); limit-point trend (opening/closing/steady) | Sample + derived |
| Verdict | line role, outcome, and — when the cursor crosses a check's evidence station — the relevant doctrine check id | envelope |

The "commanded vs delivered" row is the teaching payload of Tier 1R (**02**): at a
throttle chop or an over-ambitious brake the HUD shows the command, the
ellipse-clipped delivery, and the widening line, in one glance.

### 3.4 Terminal states

A line that ends early freezes at its terminal sample with a terminal badge keyed
to `terminated.reason` (**05** §2's closed set: `crash | off_road | stopped |
road_end | max_time | max_dist`); the scrubber region beyond its end is shaded
for that line, keyed to the same reason. The `off_road` badge carries the placard
text *"left the road — off-road behaviour not modelled"* — the trajectory ends at
the bracketed edge crossing (**02** §7, **03** §2), so the frozen glyph sits
exactly on the road edge, never in the grass. The cursor remains draggable across
the full scenario extent so surviving lines in compare mode keep stepping.

### 3.5 The corrective ghost (stepper-only)

For a corner that ran wide, the verdict's `corrective` block (**05** §6.3) records
whether a fixed-policy save was feasible; the shadow trajectory itself is never
shipped (D18). The stepper offers a **corrective ghost** toggle (off by default):
when enabled, the viewer recomputes the shadow via the pure core function
`correctiveShot(lineResult)` (**08** §7.1) — a §2.4-legal call, the engine's own
counterfactual, never a UI reconstruction — and draws it from the `correction`
bookmark onward as a ghost overlay on the topdown and in the POV, at ghost
opacity and visually distinct from compare-mode ghosts (it is a counterfactual,
not a line of the figure; §5.6). On a `wide` corner the ghost is the save —
roll to reserve, back inside the corridor at `corrective.returned.s`; on a
`runoff` corner whose shot integrated, it is the failed attempt run to its own
termination — `fail_reason` made visible. **The ghost is clipped at the shadow's
return station `s*` in both cases** (**04** §4b.4): the shadow is a probe over a
bounded horizon, and the design asserts nothing about the constant-`phiReserve`
arc past the return, so drawing it would be drawing unspecified output. The
ghost's legend carries **04** §4c.7's lean-only disclosure sentence verbatim.
When `corrective` is null, or the shot
never became integrable (`fail_reason = "departed_before_reaction"`), there is
no shadow and the toggle is inert for that line. The recompute is one bounded
extra engine run, inside the recompute budget (**09**). The ghost is
**stepper-only**: it never appears in exported figures — the exported picture is
always the uncorrected consequence, the book's own red ink (D18; **06**).

### 3.6 The save-window overlay (stepper-only)

A toggle beside the corrective-ghost toggle, **off by default**, per line. When
on, the viewer calls the pure core function `saveWindow(lineResult)` (**08**
§7.1) once per toggle — not per frame — and for each corner whose
`corrective ≠ null` and whose `status ∈ {resolved, open_at_end}` draws:

- a neutral **save-window glyph** at the projected `s_close_m` on that line (an
  open ring with a tick, deliberately distinct from the ring apex marker and from
  the corrective ghost's stroke), with a one-line neutral leader label
  `save window closed · s = 34.2 m`;
- one **timeline tick** on the scrubber at `tau_close_s`, in the overlay register
  and visually distinct from event ticks;
- one **HUD row** in the Verdict group: `save window: closes in 0.4 s` before
  `tau_close_s`, `save window: closed 0.6 s ago` after, plus the static line
  `reaction budget −0.6 s vs react 1.0 s`. This is the countdown, and it is where
  the drama lives: a number that ticks as the cursor moves. On `open_at_end` the
  HUD row instead reads `save window: still open at the horizon`, because
  `tau_close_s = τ_last` is the scanned horizon rather than an observed closure
  (**04** §4b.5) and a countdown to it would assert a closure the scan never saw;
- the **04** §4b.7 placard, beside every displayed scalar, always.

`status ∈ {intermittent, never_open}` → the placard and the status sentence
replace all of the above and **no scalar is drawn**; the rider id and the policy
block remain readable in the overlay's detail panel, because a refusal that
concealed which controller refused would be a worse object than the one it
replaced (**04** §4b.5). `status = "not_applicable"` → the toggle is inert for
that corner. When the shadow itself is drawn it is **clipped at `s*`**, exactly
as §3.5's ghost is.

**No line ink is modulated anywhere, in any view** — `quality` remains the single
total colour function per line (D9). **No exported figure changes**: the overlay
is stepper-only, and `C-SAVEWIN-NO-INK` asserts the exported SVG is
byte-identical with the toggle on and off. **No POV representation**: the POV
consumes true geometry and per-sample recorded channels only, and a scalar from
an out-of-line counterfactual has no honest POV form. **No controls-strip
channel**: `t_to_horizon` is by construction slope −1 and carries exactly one
scalar; `renderControls(lineResult, window?, cursor?)` keeps its signature.

All displayed values are precision-clamped to `HORIZON_DISPLAY_DP` (**04**
§4b.5), asserted by `C-SAVEWIN-HUD`.

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
(`ssd_m` vs `sight_ride_m`, the rider-path basis — D16) clears sooner, and the
POV shows the road unrolling from behind the hedge earlier.
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
- sight: `sight_m`, `sight_ride_m`, `ssd_m`, `limit_x, limit_y` — **rider-eye**
  results per D4, recorded on the Sample — plus `stateAt.derived.ssd_station_m`
  for the deficit band (§5.3 item 5).

The POV consumes **true geometry only**. The diagram projection (**06**) never
touches this view — a first-person frame rendered from compressed geometry would
be physically false, and the POV is specified as the one view guaranteed
distortion-free.

### 5.2 Camera model

Per frame, from the focused Sample:

- **Eye** at world `(x, y)` raised to `eye_height_m = 1.4` (TUNING — an eyes-above
  -road height for a seated rider; body position is out of scope per D5, so the
  eye rides the bike's reference point).
- **Yaw** — set by the **`look` mode**, a closed two-value camera toggle, pure
  presentation over recorded per-sample data:

  ```
  look = "heading" (default) | "limit_point"
  ```

  - **`heading`** — yaw = `psi`, the bike's heading. The default, because the
    POV's stated job is "where the rider is pointed" and a mistake line must not
    imply its rider looked through the turn.
  - **`limit_point`** — the yaw law:

    ```
    bearing = atan2(limit_y − y, limit_x − x)   // world bearing, eye → recorded limit point
    yaw     = psi + clamp(wrapDeg(bearing − psi), −LOOK_MAX_DEG, +LOOK_MAX_DEG)
    ```

    with `LOOK_MAX_DEG = 70` (TUNING, range 60–90 — the maximum head-turn from
    the bike's heading) and `wrapDeg` shortest-arc in (−180, 180]. Every input
    (`x, y, psi, limit_x, limit_y`) is a recorded Sample field (**05** §2.1);
    interpolated queries use **05**'s pinned `linear` rule for
    `limit_x`/`limit_y` — no new recording is required. Because the recorded
    limit point can jump between samples (occluder-edge release), the yaw under
    `limit_point` may step visibly. That is honest — the limit point *does*
    jump — and the clamp bounds the swing; no smoothing state is introduced
    (it would break frame purity, §5.5).

  `look` is a **camera control, not a gaze model**: it never enters `sightFrom`
  (the eye is positional only), never touches a verdict, a check, `result_hash`,
  or any recorded field. Gaze *behaviour* is out of scope — a placarded refusal
  (01 §8, typed `na` reason `"rider gaze behaviour not modelled"`); the `look`
  toggle is a camera control over recorded data, not a rider model. Spellings:
  `look?` in the ViewSpec (**06** §2.1), `look=` on the scene `view:` line
  (**04** §7), `--look` on the CLI (**08**), and the viewer toggle (§6.1);
  unknown values are rejected `SCHEMA` (closed set, D8).
- **Roll** = `phi` in **both** `look` modes by default — the head rides the bike:
  the whole image rotates with lean, so the horizon tilts exactly as much as the
  bike leans. This is the POV's signature honesty: the horizon angle *is* the
  lean readout.

  **`roll: lean | level` (D48).** The ViewSpec field (`--roll` on the CLI,
  default `lean`) selects which channel carries the lean. Under `level` the
  frame is *not* rotated and the recorded `phi` is drawn instead as a **lean
  dial** in the HUD — a bike-tail silhouette tilted by `phi` against a fixed
  ground line, with the angle in degrees. Nothing is hidden and nothing is
  invented: both modes draw the same recorded lean.

  Why the option exists, given that `lean` is the honest default: a *moving*
  view is read by a viewer whose own balance cancels the roll, and a **still
  figure in a book is not**. At 30° of lean the rolled frame reads as a road
  falling out of the picture rather than as a rider leaning into it, and the
  road slides into a corner of the frame where the reader cannot see what the
  figure is about. `level` is the book's setting for that reason and that reason
  only; the viewer keeps `lean`.
- **Pinhole projection** with horizontal field of view `fov_deg = 60` (TUNING);
  focal length follows from the canvas width. Near-plane distance
  `near_m = 0.5` (TUNING). Marker inset `CHEVRON_INSET = 0.05 ×
  min(frame_w, frame_h)` (TUNING — the frame-boundary inset that keeps a clamped
  limit-point marker fully visible; §5.3 item 7).

Projection of a ground point `p`: translate by the eye, rotate by `−yaw` (the
active `look` mode's yaw, above) into the camera frame (axes: forward, lateral);
a point at forward distance `F > near_m`
and lateral offset `L` projects to screen position

```
u = f · L / F
v = v_horizon + f · eye_height_m / F
```

(with `v` measured downward from the horizon row — every ground point of a flat
world lands below the horizon, approaching it as `F → ∞`), and the completed 2-D
frame is rotated by `−roll` about the principal point, where `roll = phi` under
`roll: lean` and `0` under `roll: level`. The horizon is the eye-level line
through the principal point, rotated with the frame.

**The road surface is a strip of per-station quads, not one ring (D48).** Drawn
far→near, each quad spanning two adjacent stations, so a span that cannot be
seen is simply not drawn. The single outer-edge-forward + inner-edge-reversed
polygon this replaces is a valid ring only while the whole strip is in front of
the camera: on a road that bends both ways inside the lookahead the two chains
cross and the surface folds through itself — the spike readers of the fig-08-06
POV described as a mountain. Polylines are projected as **contiguous visible
runs**: a vertex behind the near plane drops, *and so does the join across it*,
because joining the survivors stitches a segment over ground that was dropped.

The invariant with teeth, and the one to test: **a flat world never draws above
the horizon.** Every projected ground point satisfies `v > v_horizon` by
construction, so any drawn road pixel in the sky is a projection defect.

### 5.3 Draw order

Painter's algorithm, far to near, fixed:

1. **Sky** above the (rolled) horizon; **ground** below it — flat fills in the
   neutral palette (**06** owns colours).
2. **Road surface** — a strip of per-station quads (§5.2), drawn far→near to the
   visible extent of the road model (the LUT ahead of the current station), not
   merely to `sight_m` — sight is enforced by occlusion, not by truncating the
   world. (Formerly one closed polygon of `roadOuter` ahead + `roadInner`
   reversed; that construction folds through itself wherever the road bends both
   ways inside the lookahead — D48.)
3. **Lane markings** — centreline and lane-edge polylines, projected the same way.
3b. **The continuation fan (D45, gated)** — between lane markings (3) and
   occluders (4). Each admissible member's two road edges are extruded and drawn
   far-to-near at `POV_FAN_ALPHA = 0.12` (TUNING), **before** the occluder quads,
   so the occluder extrusion paints over the fan and the fan disappears behind
   the hedge exactly as the real road does; portions re-emerging past the hedge's
   lateral edge remain visible, which is the point. The limit-point marker (D40,
   stage 7) draws on top, unconditional and unchanged. A neutral chip names the
   pack, the escape rider's `short_name`, and the counts, per **06** §2.7's count
   grammar. Frame purity holds: the fan is a pure function of
   `(result, cursor, prior)` with no smoothing state. Whether the stage draws at
   all is decided by the ViewSpec `fan` key (`auto | off | <probe index>`, owned
   by **06** §2.1): `auto` resolves on **iff** a `CommitmentReport` is attached to
   the loaded envelope, resolving it never invokes an engine run, and a
   requested-but-absent report draws the typed refusal placard, verbatim:
   *"fan requested; this envelope carries no commitment report (re-run with
   `--commitment`)."* This document is the owning declaration of that string
   (**06** §2.1 names §5.3 as owner and does not restate it). Unlike the
   corrective ghost (§3.5) and the save-window overlay (§3.6), which are
   stepper-only, `fan` is persisted and rendered into exports — it is a rendering
   of a declared input world, not a viewer-local aid. Because `auto` resolves off
   with no report attached, and no committed book scene carries one, G7 is
   unaffected.
4. **Occluders** — each footprint polygon extruded vertically to its kind's
   presentation height (owned here, all TUNING: `hedge 1.8 m`, `wall 2.0 m`,
   `bank 1.8 m`, `vehicle 1.8 m`) and drawn as filled quads, sorted far-to-near.
   **Occlusion invariant (normative):** every occluder kind's presentation
   height must exceed `eye_height_m` (1.4 m) by at least
   `POV_OCCLUDE_CLEAR_M = 0.4 m` (TUNING) — a POV in which the eye sees over any
   occluder would contradict **03**'s binary is-opaque optical model; that is a
   spec violation, not a tuning choice. The heights above satisfy it by
   construction (at 1.8 m the `vehicle` reads as a van/SUV — the honest height
   for a footprint the plan-view model says fully occludes; its extrusion faces
   per **03** §4's derived heading, own-lane `+s`, oncoming `−s`). Paint order
   does the doctrinal work: **the road beyond the hedge is painted, then the
   hedge is painted over it** — the road visibly disappears behind the occluder,
   which *is* the blind-corner visual the tool exists to show.
5. **Sight band** — the road surface from the current station to `s + sight_m`
   carries a faint neutral tint ("what you can see" — station basis is correct
   here: the tint paints road surface). The deficit judgment is rider-path-based
   (D16): when `ssd_m > sight_ride_m`, a red band runs from `s + sight_m` to
   `derived.ssd_station_m` — the station the rider's own path reaches after
   `ssd_m` of path length (`stateAt`, **05** §4) — *the road you would need
   to see to stop, and cannot*. Both bands are surface tints, under the path
   overlay.
6. **Path overlay** — the focused line's samples ahead of the cursor, projected
   onto the ground and stroked in the line's verdict colour (D9). Toggleable;
   ghosts of other lines render at ghost opacity (§5.6).
7. **Limit-point marker** — unconditional, with a closed two-state presentation:

   ```
   markerState = "placed" | "clamped"        (closed set; appears in the frame draw list)
   ```

   Per frame, transform the sample's recorded `(limit_x, limit_y, 0)`: translate
   by the eye `(x, y, eye_height_m)`, rotate by `−yaw` (yaw per the active `look`
   mode, §5.2) into camera axes `(F forward, L lateral)`; then:
   - **If `F > near_m`:** project per §5.2 and rotate `(u, v)` by `−phi` about
     the principal point → final frame point `p`. If `p` lies inside the **inset
     rectangle** `R_inset` — the frame rectangle shrunk on all sides by
     `CHEVRON_INSET` (§5.2; the inset keeps the clamped glyph fully visible) —
     then `markerState = "placed"`: a chevron at `p` on the road surface, badged
     with the trend (opening/closing/steady) from the sight channel. When the
     limit point is the far edge of an occluder, the chevron sits at its base —
     visually "the corner of the hedge", which is exactly what a rider's limit
     point is.
   - **Otherwise (`p ∉ R_inset`, or `F ≤ near_m`):** `markerState = "clamped"`.
     The direction ray runs from the principal point `P0` through `p` when the
     projection exists (`F > near_m`); when `F ≤ near_m`, through
     `rotate(−phi)` of the pre-roll direction `(sign(L), 0)` — "the limit point
     is off to the left/right at eye level". Both branches give a unit direction
     `d̂` in final frame coordinates. The **clamped chevron position** is the
     intersection of the ray `P0 + k·d̂ (k > 0)` with the boundary of `R_inset`
     (unique, because `P0` is interior). An **arrowhead** on the chevron's
     outward side points along `d̂` — the direction the gaze must turn to bring
     the true limit point into frame. The arrow exists **iff**
     `markerState = "clamped"`: its presence *is* the off-frame signal (arrow
     length 1.2 × chevron size, a renderer style constant, presentation-only).
     The trend badge stays attached to the chevron in both states — the
     mid-corner "opening" cue is readable even while the point is off-frame.

   **Invariant (normative):** every POV frame of every line contains exactly one
   limit-point marker — there is no sample at which the POV silently drops its
   teaching device. (The rule, not the `fov_deg` constant, is what keeps the cue
   on screen: at `book90` mid-corner the limit-point bearing is 36.8° against a
   30° half-frame, and frame roll only makes it worse; no plausible widening
   fixes that.) Under `look: limit_point` the marker is near frame-centre by
   construction; the clamp rule still covers the residual case where the
   `LOOK_MAX_DEG` clamp leaves it outside.
8. **HUD strip** — a slim neutral-colour overlay repeating the core HUD numbers
   (`v`, `phi`, `sight_ride_m` vs `ssd_m`, clip badge) so a full-screen POV scrub
   needs no side panel. Under `look: limit_point` the strip carries a mode chip
   (`look: limit point`) plus a small **heading tick** on the horizon line
   marking where `psi` points, so the head-turn amount is always disclosed
   in-frame — a rotated camera must not read as a rotated bike.

   **In riding words (D48).** The strip is the one place the frame explains
   itself, so it says `37 km/h · lean 30° left · see 27 m · need 19 m to stop ·
   7 m spare`, in the failing ink when the last figure is a shortfall. Whole
   numbers: a simulated metre to two decimals claims precision the integrator
   does not. `φ`, `ssd` and `▶ deficit` were the engine's spelling of the same
   three facts, and they made the reader do the subtraction that IS the lesson.
   The same values ride the text element as data attributes (`data-v-kmh`,
   `data-lean-deg`, `data-sight-m`, `data-ssd-m`) so a consumer reads numbers
   rather than parsing prose. Under `roll: level` the strip also carries the
   **lean dial** (§5.2).
9. **Rider anchor (D48)** — the rider's own bar ends and mirrors in the near
   corners, drawn in FRAME space (they are where the hands are, so they do not
   roll with the camera under either roll mode). A first-person frame with none
   of the machine in it gives the reader nothing to sit on: it reads as a camera
   hovering beside the bike rather than a view from it.

   **Path off-frame marker (D48).** When the focused line's overlay (stage 6)
   has no run touching the frame at all — a rider looking through the corner
   whose own line goes elsewhere, which is precisely the fig 8.1 mistake — an
   edge marker in the line's verdict colour points the way it went, labelled
   `your line`. Same convention as the clamped limit marker (stage 7): the
   teaching device is never silently dropped, because a frame that draws no line
   reads as a rider who had none.

### 5.4 Honesty placards

The world is flat by design (D4/D5). Scenario vocabulary cannot express crests or
dips — such input is rejected at validation (D8, **03**) — so the POV never
encounters vertical geometry. The placard rule exists for the boundary case where
an author *asks* for a book figure whose subject is vertical (a crest brow): the
correct output is a refusal panel in the POV frame — "vertical sight geometry not
modelled" — never a faked hill. The placard is a rendered element, not an error:
the rest of the scenario remains scrubable. Gaze is the same placard class: any
check or scenario feature that would require a gaze *model* answers with the
typed `na` reason `"rider gaze behaviour not modelled"` (01 §8) — never a
fabricated gaze; the `look` toggle (§5.2) is the honest partial substitute.

### 5.5 Frame stepping and future rasterizers

The POV has no animation loop of its own: it is a pure function
`frame(result, lineId, cursor, look) → canvas draw list`, invoked by the stepper
on every cursor move. The draw list's limit-point entry carries `markerState`
(`"placed" | "clamped"`) and, when clamped, the arrow direction — a presentation
shape, not a wire contract, but pinned so tests can assert it (**09**).
This is what keeps it trivially steppable, and it is the seam
for the future: the same camera model and draw list can target WebGL (or an
offscreen rasterizer for CLI export of POV frame sequences, **08**) without any
change to the state contract or the sight machinery.

### 5.6 Ghost lines in the POV

In compare mode, non-focused lines project as ghost path overlays (their own
verdict colours, ghost opacity) and — under `time` lock — as ghost bike markers at
their own `(x, y)`: the ghost race seen from inside the focused rider's helmet.
Under `station` lock ghost markers are suppressed (two riders at the same station
would overlap absurdly); only the ghost paths draw. The corrective ghost (§3.5)
is a third overlay class — a counterfactual, not a line of the figure — and
renders visually distinct from both.

---

## 6. Viewer surfaces

### 6.1 Layout

One workstation page:

- **Left:** `topdown` with its mode toggle (`true` | `diagram`).
- **Right:** `pov` (expandable to full-width), with its `look` toggle
  (`heading` | `limit_point`, §5.2) beside the path-overlay toggle.
- **Bottom:** `controls` strip with the linked cursor, the timeline scrubber,
  the named-event ticks, the corrective-ghost toggle (§3.5), and the
  save-window overlay toggle beside it (§3.6).
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
lock mode, view toggles (`look`, `fan`, path overlay, the corrective ghost, the
save-window overlay), line
visibility, `true`/`diagram` mode — and no scenario editing. Authoring lives in the CLI, the programmatic API, and scene text
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

**Carried:** one core with no second physics; the viewer as a pure consumer;
lean never hand-drawn; colour reserved for verdict quality; honest refusal
placards instead of faked geometry; the events-only jump-point law, unchanged by
either new overlay.

**Changed:** the corrective ghost is clipped at the shadow's return station `s*`
(§3.5) and its legend carries **04** §4c.7's lean-only disclosure sentence
verbatim.

**New:** the save-window overlay (§3.6) and its clipping rule; POV draw-order
stage 3b, the continuation fan, with `POV_FAN_ALPHA` and the ViewSpec `fan` key
cross-referenced to **06** §2.1; probe jump targets (§3.1). All are out of hash,
off by default, and absent from every committed book scene.
