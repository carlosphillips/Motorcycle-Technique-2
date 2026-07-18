# Roads, Scenarios & Visibility

## 1. What this document covers

The three input surfaces of linelab: the **road model and its DSL** (geometry an
author writes in one line), the **scenario wire schema** (the id-addressed plan the
engine integrates), and the **visibility model** (occluders, the rider-eye sight
cast, and stopping distance). It also specifies the **mistake compiler** interface
(the perturbation vocabulary that turns a solved good line into a failed line) and
the **figure** object that binds one road to any number of lines.

Owned elsewhere: the physics that consumes these inputs (`02-physics-model.md`),
the solvers that fill plans in automatically (`04-solver-and-authoring.md`), the
per-sample recording of sight fields (`05-result-contract-and-inspection.md`), how
occluders and sight rays are drawn (`06-rendering-and-projection.md`), and the CLI
verbs that expose all of it (`08-cli-and-agent-interface.md`).

Decision-log anchors: D4 (visibility first-class, lateral-only), D6 (failed lines
shareable), D7 (no apex input), D8 (schema-valid implies effectual).

---

## 2. Road model

A road is a **centerline parameterized by station `s`** (metres from road start),
composed left-to-right from three segment types:

| Type | Parameters | Notes |
|---|---|---|
| `straight` | `len` | |
| `arc` | `r`, `angle_deg`, `hand` | constant radius |
| `taper` | `r1`, `r2`, `angle_deg`, `hand` | clothoid-like radius sweep `r1 → r2`; decreasing (`r1 > r2`) and increasing (`r1 < r2`) radius corners |

`compose(roadSpec) → Result<RoadModel>` produces a frozen model with a dense
station lookup (`{s, x, y, psi, kappa}` at `ds_m` spacing), a `segments` list, and
a derived `corners` list (`{id, hand, s0, s1, s_mid, r, angle_deg}`) — corner ids
`c1, c2, …` minted in segment order. The road starts at the origin heading `+x`.

**Lane width is a single global value in v1.** Per-segment width changes are out
of scope; the DSL grammar reserves the token position (§3) so adding them later is
a grammar extension, not a breaking change. Camber, elevation, and crests do not
exist anywhere in the road model (D4/D5): the world is flat. A scenario that needs
vertical geometry is refused at validation with an honest placard
(`OUT_OF_SCOPE`, reason `vertical_geometry_not_modelled`), never approximated.

**Lane-constrained by default (carried).** The usable corridor is the rider's own
lane inset by `bike_margin_m` on both edges; `use_full_width: true` opts into the
full carriageway (track-day framing). The doctrine-facing lateral coordinate is
the **lane fraction `f`**: `0` = inside usable edge, `1` = outside usable edge,
`> 1` = beyond the corridor (oncoming lane or off-road). `f` — not raw signed `d`
— is what plans target and verdicts report, because `f` is hand-independent: an
agent can compare left- and right-handers without sign bookkeeping. Raw `d`
remains available as an escape hatch everywhere `f` is accepted.

---

## 3. The road DSL

One line, segments separated by `|`, whitespace-tolerant. Carried from the prior
design with its round-trip identity intact.

```
lane <w>              lane width, metres — must appear EXACTLY ONCE and FIRST
S <len>               straight
L <r> ^<deg>          left arc:  radius r, sweep deg
R <r> ^<deg>          right arc
L <r1>><r2> ^<deg>    left taper  (r1 → r2 across the sweep)
R <r1>><r2> ^<deg>    right taper
```

- Numbers are strict positive decimals (regex `^\d*\.?\d+$`): no signs, no bare
  dots, no empties — a malformed token can never silently become `0` or `NaN`.
- Corner ids are minted by the parser in segment order; the text never carries ids.
- `parseRoadDSL(str) → Result<roadSpec>` and `printRoadDSL(spec) → string`
  round-trip exactly over the DSL-expressible subset: `parse ∘ print ∘ parse` is
  an identity. `bike_margin_m`, `use_full_width`, and `ds_m` are deliberately not
  DSL-expressible (they take `compose` defaults) to keep that identity clean.
- **Reserved grammar space:** a per-segment width suffix (`S 40 w=4.0`) is
  reserved for a future version. The v1 parser rejects it with a typed error that
  names the reservation — it does not silently ignore it (D8).

Example: `lane 3.5 | S 12 | R 12 ^90 | S 16` — a 3.5 m lane, 12 m approach, a
12 m-radius 90° right-hander (`c1`), 16 m exit.

### 3.1 Book-proportioned road presets

Named presets give authors and agents compact corners that render at **true scale**
already inside the book's measured proportion band (road-width:radius ≈ 0.55–0.9,
entry straights shorter than one arc length — see `06-rendering-and-projection.md`
for the band's derivation). Each preset expands to a road DSL string plus, where
noted, occluders and a suggested entry speed; the expansion is **disclosed** — the
resolved DSL appears verbatim in every result so round-tripping stays honest.

These corners are physically ridable at modest speeds (~25–36 km/h), which is the
point: they are simultaneously true-scale and book-compact. Figures teaching the
book's 45–80 km/h prose speeds use realistic roads plus the diagram projection
(`06-rendering-and-projection.md`) instead. All geometry below is `TUNING`.

| Preset | Expansion | Suggested entry | Teaches |
|---|---|---|---|
| `book90` | `lane 3.5 \| S 12 \| R 12 ^90 \| S 16` | 34 km/h | canonical single 90° corner (figs 8.1–8.3 archetype) |
| `bookDecreasing` | `lane 3.5 \| S 10 \| R 16>9 ^130 \| S 14` | 34 km/h | decreasing-radius trap (fig 8.4) |
| `bookEsses` | `lane 3.5 \| S 8 \| L 12 ^75 \| R 12 ^75 \| L 12 ^75 \| S 10` | 32 km/h | linked turns, zero inter-corner straights (fig 8.6) |
| `bookHairpin` | `lane 3.5 \| S 10 \| R 10 ^150 \| S 12` | 28 km/h | road-speed hairpin |
| `bookBlind` | `book90` geometry + `hedge inside c1 -6x26 margin=1.2 depth=2.5` | 32 km/h | blind corner, limit point, hold-wide |

(`bookHairpin` clears the carried out-of-scope cut — U-turn rejection requires
`angle_deg ≥ 170` **and** `r ≤ 15 m`.)

---

## 4. Occluders and hazards

Two distinct families, both placed with the same station/side grammar. Closed
vocabularies; extending either is a design change (D8 — nothing unknown is
accepted and ignored).

**Occluders** (`blocks: ["vision"]`) — opaque plan-view footprints that sight rays
cannot cross:

| Kind | Footprint | Defaults (TUNING) |
|---|---|---|
| `hedge` | band parallel to the road edge: from `margin_m` outside the edge, extending `depth_m` further out, over a station span | `margin_m 1.0`, `depth_m 2.0` |
| `wall` | thin band, same placement | `margin_m 0.5`, `depth_m 0.3` |
| `bank` | band hugging the road edge (cutting/embankment) | `margin_m 0`, `depth_m 3.0` |
| `vehicle` | discrete rectangle (parked or oncoming-lane vehicle) | `1.8 × 4.5 m` |

**Hazards** (`blocks: ["surface"]`) — surface patches that change local friction:

| Kind | Effect | Defaults |
|---|---|---|
| `gravel` | `mu` override inside a `d`-band over a station span (carried) | `width 1.4 m`, `mu 0.4` |

**Why a flat world needs no heights.** Sight casting is a 2-D plan-view ray test
(§5): an opaque footprint either intersects the eye→target segment or it does not.
A binary `is-opaque` flag is therefore the entire optical model. Partial-height
occluders (armco you can see over, a hedge you can see through in winter) are not
representable; a spec that asks for a `height` field is rejected with the
vertical-geometry placard rather than approximated. Renderer treatment of each
kind (glyphs, POV extrusion height) is presentation-only and lives in
`06-rendering-and-projection.md` / `07-viewer-animation-and-pov.md`.

**Placement grammar** (scene text and wire schema alike): `side` ∈
`inside | outside | left | right` (hand-resolved through the single shared
`sideSign` rule — an author never hand-computes a signed offset), a station anchor
(corner-relative `entry|exit|mid:<cornerId> ± offset_m`, or absolute `at_s`), and
a span. Scene token form carried: `<kind> <side> <ref> <offset>x<span> [key=val …]`,
e.g. `hedge inside c1 -6x26 margin=1.2 depth=2.5`. All placements resolve to
absolute geometry at validation.

---

## 5. The sight model

### 5.1 `sightFrom` — the rider-eye cast (D4)

```
sightFrom(road, eye: {x, y}, occluders) → {sight_m, limit_point: {x, y}, s_limit, trend}
```

- **Eye = the rider's actual position.** This is the load-bearing change from the
  prior design, which cast from the road centreline at the rider's station — making
  sight distance invariant to the chosen line, so two lines through the same blind
  corner scored identical sight and the hold-wide lesson was unmeasurable. Under
  linelab, moving the bike ~1.5 m toward the outside of a 12 m corner visibly and
  numerically opens the sight line; that difference is the teaching.
- **Targets = road centreline stations.** "Sight distance" means *how far along
  the road* the rider can see: scan target stations forward of the eye's station in
  `ds_m` steps and test the straight segment eye → centreline-point against every
  opaque footprint. Targets stay on the centreline (not on any line's own path) so
  `sight_m` is comparable across lines on the same road — the eye varies per line,
  the thing being seen does not.
- **First-blocked semantics.** `s_limit` is the last visible station before the
  first blocked one; visibility that re-emerges beyond a gap does not count. This
  is conservative and matches limit-point teaching: the limit point is where the
  road *disappears*.
- `sight_m = s_limit − s_eye` (arc distance). With no occluders on a flat world,
  sight runs to the road end — blindness comes only from occluders, by design.
- `trend` ∈ `opening | closing | steady`, from the change in `sight_m` against the
  previous sample with deadband `sight_trend_deadband_m = 2.0` (TUNING). The
  limit point "rushing toward you" (closing) vs "releasing" (opening) is the
  doctrinal speed cue; the solver's visibility-governed mode
  (`04-solver-and-authoring.md`) keys off exactly this field.

`sightFrom` takes no speed parameter — geometric sight is speed-independent.
Speed enters only through stopping distance:

### 5.2 Stopping distance

```
ssd(v_ms, model) → {ssd_m, react_m, brake_m}     // v·t_react + v²/(2·a_ssd)
```

Models carried: `alert {a_ssd: 7.0 m/s², t_react_s: 1.0}` (default, TUNING) and
`aashto {a_ssd: 3.4, t_react_s: 2.5}` (the conservative highway-engineering
yardstick). The per-point safety judgment is the comparison `sight_m ≥ ssd_m`; its
margin is recorded per sample and drives the sight-deficit doctrine check.

### 5.3 Recording contract

Every trajectory sample records `sight_m`, `ssd_m`, and the limit point
(`limit_x`, `limit_y`), computed with the eye at that sample's own `(x, y)`. Field
shapes, precision, and alignment rules are owned by
`05-result-contract-and-inspection.md`. Because sight is per-sample and
eye-accurate, an agent can read "at this station you can see 38 m but need 51 m to
stop" directly off any line — good or failed — without recomputation.

---

## 6. The scenario wire schema

The engine's unit of work: **one road + one rider plan**. Validation
(`validate(json) → Result<Scenario>`) is the sole rejection point; it normalizes,
fills defaults, resolves anchors and placements to absolute stations, and freezes.

```
{ spec: "linelab/1", id,
  road:      { lane_width_m, bike_margin_m?, use_full_width?, segments: […] } | { preset: "<name>" },
  occluders: [Occluder…]?,          // §4
  hazards:   [Hazard…]?,            // §4
  rider:     { profile, start: {speed_kmh, f? | d?}, plan: [PlanAction…] },
  config:    { mu?, mode?, ds_m?, ssd_model?, checks_version },
  expect_fail?: [checkId…],
  meta?: {} }
```

Field notes (defaults in parentheses; every field is typed and rejected on
mismatch with a `SCHEMA` error naming the path):

- `spec` must literally equal `"linelab/1"`.
- `rider.profile` ∈ `casual | street | trained | racer` → `{roll_rate_dps, skill,
  t_react_s}` (constants in `02-physics-model.md`). Default `street`.
- `rider.start.f` (default `1.0` — the outside usable edge, the doctrinal entry
  position). `d` accepted as an escape hatch; exactly one of the two.
- `config.mu` (default `1.0`), `mode` (`street`), `ds_m` (`0.5`), `ssd_model`
  (`alert`).
- `expect_fail` declares doctrine checks a *legitimate* non-clean line is expected
  to fail (e.g. a double-apex line's out-in-out deviation) — the oracle mechanism
  carried from the prior design (`09-verification-and-testing.md`).

### 6.1 Plan actions

An ordered list; every action carries a stable string `id` (addressing is by id,
never array index — inserting an action must not break a saved sweep). Station
anchors: absolute `at_s`, or corner-relative `at: {ref: "entry|exit|mid:<cornerId>",
offset_m?}` — resolved to `at_s` inside `validate`, so the canonical scenario
always carries absolute stations.

| `do` | Fields | Semantics |
|---|---|---|
| `brake` | `decel > 0` (m/s²), `taper_to_s?` | longitudinal deceleration, optionally tapering to zero by a station |
| `turn_in` | `target: "tangent_inside" \| {lean_deg ∈ (0, 90)}` | commit a roll-in; `tangent_inside` defers the magnitude to the solver |
| `throttle` | `accel ≥ 0` (m/s²) | `0.0` = maintenance crack; `> 0` = drive roll-on |
| `position` | `f` (target lane fraction) or `d`, `over_m` (default 15, TUNING) | lateral repositioning — see below |

**The no-apex invariant (D7, carried).** There is no `apex` field and no
`apex:<id>` anchor anywhere in this schema; `validate` rejects `apex:` refs with a
typed error, because the apex does not exist until the engine runs. Apex-relative
*sugar* exists only in the author layer, which solves first and rewrites to
absolute stations before the engine ever sees the plan
(`04-solver-and-authoring.md`).

**Effectual `position` actions (D8 — new).** The prior design accepted `position`
actions and silently ignored them; that is now forbidden. Semantics: from `at_s`
the controller steers a lateral drift that reaches the target `f` by
`at_s + over_m`, bounded by a lateral-repositioning acceleration budget
`a_lat_pos_max = 0.8 m/s²` (TUNING) and always subject to the friction ellipse —
positioning is real riding, not teleportation. A `position` action whose
transition window overlaps an active `turn_in` commitment is **rejected at
validation** with a typed reason (`INEFFECTUAL`, `position_overlaps_turn_in`) rather
than accepted-and-ignored: mid-corner line changes are expressed through steering
actions, not position targets. `position` is the approach/exit tool that makes
hold-wide authoring — and therefore visibility-differentiated lines — possible.

**The D8 rule, stated generally:** every field `validate` accepts must provably
reach the controller or the analyzers; anything else is rejected with a typed
reason. The conformance test that enforces this (schema-field × consumer
enumeration) is specified in `09-verification-and-testing.md`.

### 6.2 Error vocabulary

The closed, greppable `Result` error codes: `SCHEMA`, `DUP_ID`, `OUT_OF_SCOPE`,
`UNKNOWN_ID`, `BAD_RANGE`, `NO_SOLUTION`, `INEFFECTUAL`, `INTERNAL`. All but one
are carried; `INEFFECTUAL` is new with D8 (input that would validate but provably
do nothing — rejected, naming the dead field), and the prior `NOT_IMPLEMENTED` is
retired: a thing is in the schema and effectual, or it is `OUT_OF_SCOPE`/`SCHEMA`
— there is no accepted-but-unbuilt tier (see `08-cli-and-agent-interface.md` §
error vocabulary). Adding a code is a design change. Every rejection carries
`{code, at, message}` where `at` names the offending path or token.

---

## 7. The mistake compiler

A failed line is never drawn and never hand-authored: it is the solved good line's
own plan with **exactly one control perturbed**, forward-run through the same
engine, with the outcome read off the engine's verdict (physics is the validator —
`04-solver-and-authoring.md`). The one-perturbation rule is carried: a diff
between good and mistake lines isolates precisely the intended delta.

```
compileMistake(kind, params, ctx) → Result<{kind, plan, roadSpec, outcome, diagnosis, label}>
```

### 7.1 Kinds

Closed set (shared vocabulary, `00-README.md`): `premature`, `early_apex`,
`slow_steer`, `fifty_pence`, `chop`, `overspeed`. Parameters, defaults, and the
outcome class each kind is **pinned to by test** under Tier 1R physics:

| Kind | One-control perturbation (defaults, TUNING) | Tier 1R outcome class | Book mapping |
|---|---|---|---|
| `premature` | turn in `early_by_m = 10` early; steering target stays `tangent_inside` | contained → `violation` | fig 8.1's contained variant: early turn-in the rider gets away with |
| `early_apex` | turn in `early_by_m = 5` early **and** commit an explicit lean (auto-derived largest inside-kissing lean if `lean_deg` omitted) | `runoff` (runs wide) | fig 8.1/8.2 — the canonical "turned in too soon, runs wide" |
| `slow_steer` | roll rate × `roll_rate_factor = 0.3` | `runoff` / roll-rate-limited | fig 8.2 — slow steering |
| `fifty_pence` | single turn-in → `facets = 6` alternating partial inputs | `wide`/`runoff` (always fails `single_input`) | fig 8.3 — fifty-pencing |
| `chop` | one throttle-cut `offset_m = 5` after the solved roll-on, with the rider frozen for `freeze_s = 1.0 s` (TUNING) — no corrective input during the freeze, the panicked-rider half of the mistake that pairs with the physics stand-up (`02-physics-model.md` §5) | **`wide`/`runoff` — changed by the run-wide slice (D3): the stand-up effect now widens the line as the book teaches, where the prior point-mass could only pinch inward** | Ch.9 throttle-chop lesson; fig 8.5's failure mechanic |
| `overspeed` | entry `+ by_kmh = 26`, all else byte-identical | `runoff` | fig 8.4 — decreasing radius entered too fast |

`premature` vs `early_apex` remain distinct kinds deliberately: both are "turned
in too soon," but only a *committed* early lean produces the doctrinal early apex
that runs wide; an early turn-in that keeps the deferred target eases in and stays
contained. `explain(kind)` must state each kind's pinned outcome and book figure
so an agent picks the right kind for the intended lesson on the first try — the
naming trap is documented at the API surface, not in a doc an agent won't read.

Outcome classes are **empirically pinned, never asserted**: the mistake tests
assert the engine's emergent outcome, and a pin that stops holding is an engine
bug or a mis-tuned default — never patched by editing the pin
(`09-verification-and-testing.md`).

### 7.2 Chained mistakes (new)

A mistake spec carries an optional `scope`:

```
{ kind, params?, scope?: "<cornerId>" | ["<cornerId>", …] | "all_corners" }
                                                  // default: the target corner
```

A corner-id list applies the perturbation at exactly those corners (the CLI's
`<kind>@c1,c2` shorthand in `08-cli-and-agent-interface.md` maps to it).
`scope: "all_corners"` applies the perturbation at **every** corner of a linked
sequence, each corner's perturbation seeded by the emergent state of the mistaken
line through the corner before — the fig 8.6 device, where one early turn-in
compounds corner over corner. This is the capability whose absence blocked the
prior design's linked-turn figures. Per-corner compile order and seeding mechanics
live with `chainedSolve` in `04-solver-and-authoring.md`.

### 7.3 Shareability (D6)

A mistake line's shareable form is its **spec** (`{kind, params, scope}` plus the
base scenario), never a trajectory. Any consumer — viewer, CLI, another agent —
recompiles and re-runs it with the same engine. Failed lines thereby become
first-class objects (loadable, steppable, per-instant inspectable, exactly like
good lines) while preserving the honesty property: linelab never ships a
trajectory the engine didn't produce.

---

## 8. Multi-line figures

The **figure** is the authoring and sharing unit that binds one road to any number
of lines:

```
Figure = { road (+ occluders/hazards),
           lines: [ { name, role, spec } … ],     // 1..N, no cap
           labels?, marks?, view?, note? }

role ∈ ideal | alternative | mistake | reference          // labels only (D9)
spec = ride-spec | mistake-spec | explicit plan            // 04 owns ride-spec grammar
```

- **Roles are labels; colours are verdicts (D9).** A line's rendered colour
  derives from its own emergent verdict class (mapping in
  `06-rendering-and-projection.md`), never from its role. The prior design's
  single-amber-slot cap and its `alt`-XOR-`naive` exclusivity are gone: a figure
  may carry a green ideal line, two amber alternatives, and three red mistakes if
  the lesson wants them.
- Each line resolves to a full Scenario (§6) sharing the figure's road; every line
  gets its own complete result (trajectory samples, verdict) in the multi-line
  result envelope (`05-result-contract-and-inspection.md`) — a mistake line is as
  inspectable as the ideal one (D6).
- `labels` are corner-relative callouts (`entry|exit|mid:<id> ± m`, plus
  author-layer `apex:<id>` sugar resolved post-solve); a callout always resolves
  onto the road, never into empty space. `marks` (`auto | all`) controls
  turn-point/apex/exit markers. `view` is the projection hook — mode, window —
  owned by `06-rendering-and-projection.md`.
- The scene text format that authors this object in ≤6 lines, and the solver calls
  each `spec` compiles into, are specified in `04-solver-and-authoring.md`.

---

## 9. Relation to the prior design

**Carried:** centerline/station road model with straight/arc/taper segments; the
one-line road DSL with its strict lexing and round-trip identity; lane-constrained
default and the lane-fraction coordinate; the id-addressed, apex-free plan schema
with corner-relative anchors resolved at validation; the closed error vocabulary;
the one-perturbation mistake compiler with its six kinds, pinned outcomes, and the
`premature`/`early_apex` distinction; gravel as a surface-μ hazard; `expect_fail`
as the legitimate-deviation oracle.

**Changed:** the sight cast moves from centreline-eye to **rider-eye** (D4) — the
prior geometry made hold-wide invisible; `position` actions become **effectual or
rejected** (D8) — previously schema-valid and silently inert; `chop`'s pinned
outcome class changes from contained-violation to run-wide under Tier 1R (D3);
mistake specs become shareable, recompute-on-load objects (D6); figures lose the
one-amber-slot and role-colour coupling (D9); the spec string becomes
`"linelab/1"`.

**New:** the occluder vocabulary (`hedge`, `wall`, `bank`, `vehicle`) with
flat-world placement grammar; `sightFrom` with limit point, trend, and per-sample
recording; the stopping-distance comparison as a first-class per-sample field;
book-proportioned road presets; chained mistake scope; the multi-line Figure
object with role/verdict decoupling.
