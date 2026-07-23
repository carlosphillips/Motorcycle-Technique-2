# Roads, Scenarios & Visibility

## 1. What this document covers

The three input surfaces of linelab: the **road model and its DSL** (geometry an
author writes in one line), the **scenario wire schema** (the id-addressed plan the
engine integrates), and the **visibility model** (occluders, the rider-eye sight
cast, and stopping distance). It also specifies the **mistake compiler** interface
(the perturbation vocabulary that turns a solved good line into a failed line),
including the **one normative outcome-pin table** (§7.1), and the **figure** object
that binds one road to any number of lines.

Owned elsewhere: the physics that consumes these inputs (`02-physics-model.md`),
the solvers that fill plans in automatically — including believed-road solving and
the acceptance policy (`04-solver-and-authoring.md`), the doctrine check catalogue
(`01-scope-and-doctrine.md` Appendix A), the per-sample recording of sight fields
(`05-result-contract-and-inspection.md`), how occluders and sight rays are drawn
(`06-rendering-and-projection.md`), and the CLI verbs that expose all of it
(`08-cli-and-agent-interface.md`).

Decision-log anchors: D4 (visibility first-class, lateral-only), D6 (failed lines
shareable), D7 (no apex input), D8 (schema-valid implies effectual), D11 (outcome
law), D13 (steering channel, hand binding), D16 (safety compares in rider-path
metres), D19 (the world ends at the road edge), D20 (the lateral tracker channel),
D23 (misjudgment first-class), D25 (mistake kinds speak the book's words), D26
(handedness is physical), D27 (on-road vehicles are sight objects), D45 (the
continuation envelope — designed, evidence-only, gated; §7a).

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
a derived `corners` list — corner ids `c1, c2, …` minted in segment order. The
road starts at the origin heading `+x`. Each corner record carries:

```
{ id, hand, s0, s1, s_mid, r, angle_deg,
  type: "constant" | "decreasing" | "increasing",
                     // taper with r1/r2 ≥ TAPER_RATIO_MIN → decreasing;
                     // r2/r1 ≥ TAPER_RATIO_MIN → increasing; else constant
                     // (arcs, and sub-ratio tapers with r = (r1+r2)/2).
                     // TAPER_RATIO_MIN = 1.15 (TUNING)
  r1?, r2?,          // taper endpoint radii (absent on arcs)
  r_min, r_max,      // extremal local radii; equal for arcs — one answer to
                     // "which radius a taper is tested on"
  gap_to_next_m,     // straight length between this corner's s1 and the next
                     // corner's s0 (0 when adjacent; absent on the last corner)
  linked_next }      // gap_to_next_m ≤ LINK_GAP_FRAC · min(L_arc(n), L_arc(n+1));
                     // LINK_GAP_FRAC = 1.0 (TUNING)
```

All computed at `compose`, deterministic — road properties, never solver guesses:
every line on the road grades against the same corner type, the chain machinery
(`04-solver-and-authoring.md` §5) and per-corner check applicability
(`01-scope-and-doctrine.md` Appendix A) key off `linked_next`, and the per-type
apex targets key off `type`.

**The carriageway, pinned.** The parameterized centreline is the **carriageway
centre** (the lane divider); the rider's own lane is the hand-of-travel side; the
**physical edges** sit at `d = ±lane_width_m`. **Right-hand traffic is the v1
convention: the rider's own lane lies right of the centreline in the direction of
travel.** The wire road object reserves a `traffic` field (future `"left"`); v1
`validate` rejects it with a typed error naming the reservation — reserved, never
silently ignored (D8). Crossing a physical edge is terminal (D19): `off_road`
fires at the bracketed crossing of `|d| > lane_width_m` with exact edge
coordinates recorded (termination precedence in `02-physics-model.md` §7).
`muAt(s, d)` is defined **only on the carriageway**; for `|d| > lane_width_m` it
returns the value at the laterally clamped point `muAt(s, clamp(d))` — this
definition exists solely so the RK4 sub-stages of the crossing step are
well-defined. No grass physics is modelled and no trajectory sample is ever
emitted beyond the bracketed crossing.

**Lane width is a single global value in v1.** Per-segment width changes are out
of scope; the DSL grammar reserves the token position (§3) so adding them later is
a grammar extension, not a breaking change. Camber, elevation, and crests do not
exist anywhere in the road model (D4/D5): the world is flat. A scenario that needs
vertical geometry is refused at validation with an honest placard
(`OUT_OF_SCOPE`, reason `vertical_geometry_not_modelled`), never approximated.

**Super-tight geometry is refused by sweep content.** A corner `c` is refused
`OUT_OF_SCOPE` (`super_tight_geometry`) iff the swept angle accumulated **over the
stations of `c`** where the local radius `r(s) ≤ R_UTURN_MAX = 15 m` is itself
`≥ SWEEP_UTURN_MIN = 170°`. **The quantifier is per corner, never per road** —
corners are minted per curved segment (above), so a road may carry far more than
170° of tight sweep in total without any one corner doing so. `bookEsses` is the
corpus's own witness: four `R 12 ^75` corners is **300° of sweep, every metre of
it at `r = 12 ≤ R_UTURN_MAX`**, so a road-level reading would refuse a committed
book figure (8.6) at validation. `02-physics-model.md` §7 restates this rule and
defers to this sentence as the owning statement (taper `r` linear in swept angle for this test). On
constant arcs this reduces exactly to the carried rule (`angle_deg ≥ 170°` and
`r ≤ 15 m`); on tapers it measures actual U-turn-regime content — `R 16>9 ^130`
spends 111.4° at `r ≤ 15` (in scope), a book-faithful teardrop `R 30>9 ^210`
spends 60° (in scope), a true `R 10 ^180` hairpin still refuses. The typed error
carries `detail: {sweep_below_r_max_deg, r_uturn_max_m}` so the boundary is
legible.

**The usable corridor and the lane fraction `f`.** The usable corridor defaults
to the rider's own lane inset by `bike_margin_m` (default `0.40 m`, TUNING —
constant home `02-physics-model.md`) on both edges: width
`lane_width_m − 2·bike_margin_m`. `use_full_width: true` relaxes **the corridor,
and nothing else** (track-day framing): the corridor becomes the full carriageway
(v1 roads are two-lane: width `2·lane_width_m`) inset `bike_margin_m` at each
**outer** edge. The doctrine-facing lateral coordinate is the **lane fraction
`f`**: `0` = inner usable edge, `1` = outer usable edge. Everything reading `f` —
plan `position` targets, `rider.start.f` (default `1.0` = the outer edge of
whichever corridor), constraint bounds `f_min`/`f_max`, verdict fields, the
containment predicate — rescales together with the corridor; no special cases.
Under the default corridor, which of `f < 0` / `f > 1` is the oncoming lane
depends on the corner's hand under the traffic convention (on a left-hander the
rider's lane is the outside lane, so `f > 1` is off-road; on a right-hander
`f > 1` is the oncoming lane); under `use_full_width`, `f > 1` = off-road, full
stop. An occluder or hazard placed in the oncoming lane composed with
`use_full_width: true` is rejected `OUT_OF_SCOPE`
(`full_width_with_oncoming_traffic`) — track framing and oncoming traffic cannot
both be true. The renderer suppresses the centreline marking under full width
(`06-rendering-and-projection.md` §3.1).

**The governing corner for `f`.** `f` at station `s` is measured in the frame of
the **governing corner**: the corner containing `s`; on non-corner stations the
nearest corner downstream; after the last corner, the last corner. The handoff
station is each corner's exit boundary `s1`. At a handoff between opposite-hand
corners the frame flips: `f` re-reads as `1 − f` while `d` is continuous — the
recorded per-sample `f` carries this documented jump (a coordinate re-reading,
not motion; noted in `05-result-contract-and-inspection.md` §2.1).
`rider.start.f` on an entry straight thereby has a defined meaning: measured
against the first corner.

`f` — not raw signed `d` — is what plans target and verdicts report, because `f`
is hand-independent: an agent can compare left- and right-handers without sign
bookkeeping. Raw `d` remains available as an escape hatch everywhere `f` is
accepted.

### 2.1 Road and segment wire shapes

```
Segment = { type: "straight", len_m }
        | { type: "arc",   r_m,        angle_deg, hand: "L"|"R" }
        | { type: "taper", r1_m, r2_m, angle_deg, hand: "L"|"R" }

road = { lane_width_m, bike_margin_m?, use_full_width?, segments: [Segment…] }
     | { preset: "<name>", hand?: "L"|"R", use_full_width?, bike_margin_m? }
     | { dsl: "<road-DSL line>", use_full_width?, bike_margin_m? }
```

- `hand` spells `L|R` wherever it means road/corner handedness (segments,
  presets, `turn_in.hand`, the DSL's own tokens; case-sensitive); `left|right`
  is exclusively the rider-relative occluder-side vocabulary (§4).
- `hand` beside `segments` or beside `dsl` is rejected `SCHEMA`
  (`hand_on_explicit_road`, message: "spell hands per segment") — the explicit
  form already says it, and a second spelling would create a merge rule (the
  accepted-but-ambiguous class D8 abolishes).
- The canonical resolved form (what `resolved_scenario` and the envelope carry,
  `05-result-contract-and-inspection.md` §7) is
  `{ lane_width_m, bike_margin_m, use_full_width, segments: […], dsl }` — the
  originating DSL string rides along verbatim (the preset-disclosure rule of
  §3.1, generalized). Agents never hand-expand segments.
- `traffic` is reserved-rejected (§2).

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
  DSL-expressible (they take `compose` defaults) to keep that identity clean. In
  scene text they ride as trailing options on the `road:` line, stripped by the
  scene parser **before** DSL parse (`fullWidth=`, `bikeMargin=` —
  `04-solver-and-authoring.md` §7); on the CLI: `--use-full-width`,
  `--bike-margin` (`08-cli-and-agent-interface.md` §4.1). The DSL round-trip
  identity is untouched.
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

Presets are invoked with the **road-ref token**, shared verbatim by the scene
`road:` line and the `--road` flag: `preset <name> [hand=L|R]`. Every preset
carries a **default hand equal to its book figure's ink** (D26), so the shipped
book scenes carry zero hand tokens. `hand=` flips every arc/taper segment's hand
(L↔R) — a road-level mirror through the hand-relative vocabulary (`f`,
`inside`/`outside`, `own`/`oncoming` all re-resolve; the traffic side does not
flip), so a scene mirrors with one token and zero rewrites. The view layer
rotates but never reflects (`06-rendering-and-projection.md` §2.1;
`SCHEMA/no_view_mirror`): a drawn reflection would depict a hand the physics
didn't ride.

These corners are physically ridable at modest speeds (~25–36 km/h), which is the
point: they are simultaneously true-scale and book-compact. Figures teaching the
book's 45–80 km/h prose speeds use realistic roads plus the diagram projection
(`06-rendering-and-projection.md`) instead. All geometry below is `TUNING`.

| Preset | Hand | Expansion (at default hand) | Suggested entry | Teaches |
|---|---|---|---|---|
| `book90` | **L** | `lane 3.5 \| S 12 \| L 12 ^90 \| S 16` | 34 km/h | canonical single 90° corner (figs 8.1–8.3 archetype — left-handers) |
| `bookDecreasing` | **L** | `lane 3.5 \| S 10 \| L 16>9 ^130 \| S 14` | 34 km/h | decreasing-radius trap (fig 8.4) |
| `bookEsses` | **R** | `lane 3.5 \| S 8 \| R 12 ^75 \| S 6 \| L 12 ^75 \| S 6 \| R 12 ^75 \| S 6 \| L 12 ^75 \| S 10` | 32 km/h | four linked alternating turns, link straights sized to the hand-flip budget (fig 8.6) |
| `bookHairpin` | R | `lane 3.5 \| S 10 \| R 10 ^150 \| S 12` | 28 km/h | road-speed hairpin (no Chapter-8 ink to match) |
| `bookBlind` | **L** | `lane 3.5 \| S 16 \| L 12 ^140 \| S 16` + `hedge inside c1 -6x36 margin=1.2 depth=2.5` | 34 km/h | blind corner, limit point, hold-wide (Ch. 8's blind-corner argument; **not** fig 8.1's geometry — see the note below) |
| `bookDoubleApex` | **L** | `lane 3.5 \| S 10 \| L 12 ^70 \| L 24 ^40 \| L 12 ^70 \| S 12` | 30 km/h | double-apex compound (fig 8.5): two touch corners bridged by an opening — the shape that rewards two apexes |

Notes:

- **bookEsses.** The `S 6` links are the hand-flip budget: `LINK_GAP_M = 6 m`
  (preset TUNING) — the residual roll-flip distance after in-arc absorption at
  chain speeds; the `d_flip(v)` formula and the `link_flip_infeasible` floor rule
  live in `04-solver-and-authoring.md` §5. In diagram mode the links compress to
  ≈ 1.2 m drawn, so the figure still reads as continuous esses — the book's ink —
  while the physics gets honest transition length. Authored zero-gap chains
  remain legal grammar: an infeasible flip is resolved by the decel scan slowing,
  and floor-refused (`NO_SOLUTION`/`link_flip_infeasible`) only at the model
  validity boundary.
- **bookDoubleApex.** Mints `c1, c2, c3`, which form one corner group (a maximal
  same-hand run of `linked_next` corners), so `style=double_apex` targets
  `c1..c3` by default (`04-solver-and-authoring.md`). Total sweep 180°;
  per-segment sweeps ≤ 70° with `r ≥ 12 m` — clears the super-tight refusal with
  margin. Its book figure (8.5) is a full-width road: 7 m carriageway / R12
  touch corners = 0.58, inside the proportion band at true scale. (fig 8.4 is the
  decreasing-radius `bookDecreasing`, a different preset.)
- **bookHairpin** clears the sweep-content cut (§2): 150° of sweep at
  `r ≤ 15 m` < 170°.
- `bookBlind`'s occluder line is byte-identical under any hand flip — the live
  demonstration that the side vocabulary is hand-relative.
- **bookBlind stopped inheriting `book90`, and the reason is a fact about
  `blind(c)` rather than a tuning preference.** `blind(c)` is
  `s_limit < s_end(c)` at the corner's `turn_in`
  (`01-scope-and-doctrine.md` §A.2). Because the eye is the rider's own position
  (§5.1), **`blind(c)` is a per-line predicate** despite being written as a
  function of the corner: the same corner can be blind for one line and not for
  another. Both readings matter below and are reported separately.

  For a band occluder sitting outside the road edge, whether the limit point falls
  short of the corner exit rises steeply with the corner's **swept angle**. At
  `r = 12` with `bookBlind`'s hedge, the fraction of (turn-in × lane-position)
  cells satisfying `blind(c)` is:

  | sweep | 90° | 100° | 110° | 120° | 130° | 140° |
  |---|---|---|---|---|---|---|
  | cells blind | 0 % | 4 % | 33 % | 59 % | 81 % | **100 %** |

  (Computed at `r = 12`, not across the band — radius moves this far less than
  sweep does. It is a steep curve rather than a threshold; "≈ 115°" below names
  where it crosses half, not a cliff.)

  **On the hold-wide line — the doctrinal line, and `rider.start.f`'s default of
  `1.0` — no 90° corner is blind at any legal hedge margin *at the doctrinal
  turn-in***, across `margin ∈ [0, 1.2]` and `r ∈ {9, 12, 12.7}`. That is the claim
  that forces the reshape, and it is narrower than "no 90° corner can be blind",
  which is **false** on two counts: at `margin ≤ 0.5` a 90° corner at `r = 12` *is*
  blind on a **cut-in** line — by 0.10 m at `margin = 0.5`, rising to **1.35 m at
  `margin = 0`** (1.70 m at `r = 12.7`); and because `blind(c)` is single-turn-in,
  sweeping the turn-in down to `entry−7` at a small margin the **hold-wide** line
  too can go blind at the wide band edge, by up to ≈ 1.2 m at `r = 12.7,
  margin = 0` (`review/verify/fixture_geometry.py` check 1). Neither touches the
  `^140` reshape, which is blind on both lines at every turn-in ≤ 20.5 m.

  That near-miss is worth stating rather than burying, because it is the exact
  pathology the fixture must avoid. Holding wide *opens* the sight line, so on a
  marginal corner `blind(c)` comes out **true for the bad line and false for the
  good one** — and since `hold_wide_for_sight` is `na` unless `blind(c)`
  (`01-…md` §A.3 check 11), the check that exists to reward holding wide would go
  `na` precisely when the rider holds wide. A fixture tuned to that knife edge
  would grade the doctrine backwards. `^140` puts every cell on both lines well
  inside blind, which is why the sweep and not the hedge had to move.

  The old `book90`-derived `bookBlind` was not blind on either line: `blind(c1)`
  read `false`, `hold_wide_for_sight` returned `na`, and the `BLIND_RESERVE_DEG`
  cap never applied. The approach straight lengthens `12 → 16 m`
  because the hold-wide `position` action needs `L_req = 13.8 m` at 34 km/h, and
  the entry rises `32 → 34 km/h` (matching `book90`) because at 32 km/h the 35°
  blind cap is unreachable inside the corridor: it needs `R = 11.503 m` against a
  corridor floor of `12.40 m`, so the maximum in-corridor lean is 33.0° and check
  8 could never fire. At 34 km/h the cut-in line leans 36.3° and fails while the
  hold-wide line leans 31.1° and passes — which is the teaching.

  The cost is honest and is recorded rather than hidden: `bookBlind` is no longer
  fig 8.1's geometry, so it illustrates Ch. 8's blind-corner *argument* rather
  than a specific figure's ink. `book90` is unchanged and keeps figs 8.1–8.3.
  None of the six committed book-figure scenes used `bookBlind`, so no baked
  figure moves.

  **`fx-esses-blind` (`09-verification-and-testing.md` §3.5) had the same defect
  and could not be repaired the same way.** Its base was `bookEsses`, whose legs are
  `R 12 ^75` — far below the threshold — and `bookEsses` is committed ink
  (fig 8.6) that must not be reshaped. It is **retired** and replaced by
  `fx-chain-blind` — a new same-hand pair of `L 12 ^140` corners (`09-…md` §3.5) that
  is blind on the doctrinal hold-wide line — with `P-VIS-MARGIN-MONOTONE` and
  `A-CHAIN-VIS-FULL` re-homed onto it; `bookEsses` is left untouched.

  Both facts are executable: `review/verify/fixture_geometry.py` re-derives them
  from the DSL strings and fails if the design's numbers drift.

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
| `vehicle` | discrete rectangle `len_m × width_m` on or beside the carriageway (two placement forms, below) | `len_m 4.5`, `width_m 1.8` (both overridable) |

**Vehicle placement (D27) — exactly one of `lane` ⊕ `f` ⊕ `side`:**

- **On-road form:** `lane ∈ own | oncoming` — the footprint centre sits at the
  centre of the named lane at the anchored station, resolved through the same
  `sideSign`/corridor machinery as the rider's `f` under the traffic convention
  (§2). An explicit `f=<number>` is accepted as the escape hatch in place of
  `lane` (any real value; `f < 0` and `f > 1` resolve through the same corridor
  algebra, so a vehicle can straddle the centreline).
- **Verge form:** `side ∈ inside | outside | left | right` + `margin_m` (default
  `0.5`, TUNING) — the footprint centre sits `margin_m + width_m/2` beyond the
  road edge on the resolved side (the parked-on-the-verge reading).
- More than one of `lane`/`f`/`side`, or none, is rejected `SCHEMA`
  (`vehicle_lane_xor_side`).

The rectangle's long axis aligns with the road tangent at the anchor station, and
the footprint joins the opaque set consumed by `sightFrom` — no special casing.
**Heading** is derived and presentation-only (`own`/verge vehicles face `+s`,
`oncoming` faces `−s`); the physics never reads it. **Vehicles are optical-only
in v1:** a trajectory crossing a vehicle footprint triggers no physics event and
no termination — collision modelling is out of scope, and a vehicle spec carrying
`speed_kmh` (or any motion field) is rejected `OUT_OF_SCOPE`
(`moving_hazards_not_modelled`) — the honest refusal, and the reserved seam for a
future traffic model. On-road vehicles are additionally **recorded sight
targets**: the `hazard_visible` event (§5.3).

**Hazards** (`blocks: ["surface"]`) — surface patches that change local friction:

| Kind | Effect | Defaults |
|---|---|---|
| `gravel` | `mu` override inside a lateral band over a station span (carried) | `width_m 1.4`, `mu 0.4` |

Hazard lateral semantics, pinned: `side ∈ inside | outside | left | right |
center`; the μ-override band occupies `width_m` of lateral extent flush against
the named usable edge (hand-resolved through `sideSign`), or centred on `f = 0.5`
for `center`. `mu > 0`, else `BAD_RANGE`.

**Why a flat world needs no heights.** Sight casting is a 2-D plan-view ray test
(§5): an opaque footprint either intersects the eye→target segment or it does not.
A binary `is-opaque` flag is therefore the entire optical model. Partial-height
occluders (armco you can see over, a hedge you can see through in winter) are not
representable; a spec that asks for a `height` field is rejected with the
vertical-geometry placard rather than approximated. Renderer treatment of each
kind (glyphs, POV extrusion height) is presentation-only and lives in
`06-rendering-and-projection.md` / `07-viewer-animation-and-pov.md`.

**Placement grammar** (scene text, `--occluder`/`--hazard`, and wire schema
alike). One anchor grammar serves the whole design — plan actions (§6.1),
occluders, and hazards share it verbatim:

```
occluder-token := <kind> <side> <anchor> <offset>x<span> [<key>=<val> …]
vehicle-token  := vehicle <own|oncoming|inside|outside|left|right|f=<v>>
                          <anchor> [<offset>] [len=<m>] [w=<m>] [margin=<m>]

anchor  := <cornerId>                              # sugar for entry:<cornerId>
         | entry:<cornerId> | mid:<cornerId> | exit:<cornerId>
         | s:<metres>                              # absolute station
offset  := signed station metres from the anchor (start of the span)
span    := strictly positive length in station metres, extending in +s
key=val := lateral/kind params only (margin=, depth=, mu=, width=…)
```

- **The anchor never carries an offset**: `entry:c1-25` is rejected `SCHEMA`
  (`anchor_embedded_offset`) with the rewrite hint "station offset belongs in the
  `<offset>x<span>` token". An unknown corner id in an anchor rejects on the
  carried `UNKNOWN_ID` path.
- `<offset>` is always a *station* offset — lateral placement is only ever
  `margin=`/`side`/`lane`/`f`.
- **Vehicle token:** `<offset>` is a separate, space-delimited signed
  station-metres token after the anchor (e.g. `vehicle oncoming exit:c1 +8`),
  mapping to wire `at.offset_m`; the fused spelling (`+8` glued onto the anchor)
  is rejected `SCHEMA` (`anchor_embedded_offset`). Vehicles take **no** `x<span>`
  token — the footprint has fixed length; a span on a vehicle is `SCHEMA`
  (`vehicle_span_not_allowed`). `margin=` is valid only with a side token
  (`SCHEMA`, `margin_requires_side`). Band kinds reject the lane tokens
  (`SCHEMA`, `lane_requires_vehicle`) — vision-blocking bands live off the
  carriageway by design.

So `hedge inside c1 -6x36 margin=1.2 depth=2.5` (bookBlind) ≡
`hedge inside entry:c1 -6x36 margin=1.2 depth=2.5`, spanning entry−6 m →
entry+30 m — which covers the whole 29.32 m arc of `bookBlind`'s `^140` corner
plus 6 m of approach. All placements resolve to absolute geometry at validation.

### 4.1 Occluder wire shape

```
Occluder = { id?: string,                  // minted o1, o2… if absent; DUP_ID on collision
             kind: "hedge"|"wall"|"bank"|"vehicle",
             side?: "inside"|"outside"|"left"|"right",   // band kinds: required.
                                           // vehicle: one of the three lateral forms
             at:   { ref: "entry|exit|mid:<cornerId>", offset_m?: number }
                 | { at_s: number },       // no offset inside ref strings — ever
             span_m: number,               // band kinds only; on a vehicle → SCHEMA
                                           //   (vehicle_span_not_allowed)
             margin_m?: number, depth_m?: number,   // hedge/wall/bank (defaults per §4);
                                           //   vehicle: margin_m with side form only
             len_m?: number, width_m?: number,      // vehicle (defaults 4.5, 1.8)
             lane?: "own"|"oncoming",      // vehicle only; else SCHEMA (lane_requires_vehicle)
             f?: number }                  // vehicle only — the lateral escape hatch
```

On a `vehicle`, exactly one of `lane` ⊕ `f` ⊕ `side` (`SCHEMA`,
`vehicle_lane_xor_side`).

### 4.2 Hazard wire shape

```
Hazard = { id?: string, kind: "gravel",
           side: "inside"|"outside"|"left"|"right"|"center",
           at: <same anchor object as §4.1>, span_m: number,
           width_m?: number,               // default 1.4
           mu?: number }                   // default 0.4; mu > 0 else BAD_RANGE
```

The result envelope carries `occluders` and `hazards` back in resolved absolute
form (`05-result-contract-and-inspection.md` §7), so a diff consumer can locate a
placement without re-deriving it.

---

## 5. The sight model

### 5.1 `sightFrom` — the rider-eye cast (D4)

```
sightFrom(road, eye: {x, y}, occluders) → {sight_m, limit_point: {x, y}, s_limit}
```

- **Eye = the rider's actual position.** This is the load-bearing change from the
  prior design, which cast from the road centreline at the rider's station — making
  sight distance invariant to the chosen line, so two lines through the same blind
  corner scored identical sight and the hold-wide lesson was unmeasurable. Under
  linelab, moving the bike ~1.5 m toward the outside of a 12 m corner visibly and
  numerically opens the sight line; that difference is the teaching.
- **Targets = the ride-lane centre polyline.** "Sight distance" means *how far
  along the road* the rider can see: scan target stations forward of the eye's
  station in `ds_m` steps along the centre of the rider's own lane and test the
  straight segment eye → target point against every opaque footprint. Targets are
  line-independent, so `sight_m` is comparable across lines on the same road —
  the eye varies per line, the thing being seen does not. Disclosed limitation:
  sight is measured to lane-centre targets; visibility of the corridor's inner
  edge is not modelled — lane-centre fidelity is traded for cross-line
  comparability.
- **First-blocked semantics.** `s_limit` is the last visible station before the
  first blocked one; visibility that re-emerges beyond a gap does not count. This
  is conservative and matches limit-point teaching: the limit point is where the
  road *disappears*.
- `sight_m = s_limit − s_eye` (arc distance). With no occluders on a flat world,
  sight runs to the road end — blindness comes only from occluders, by design.
- `sightFrom` is a **pure function** of `(road, eye, occluders)` and returns no
  trend — a pure cast has no previous sample. The limit-point **trend**
  (`opening | closing | steady`) is derived downstream, defined once over the
  recorded per-sample `sight_m` series — windowed
  (`SIGHT_TREND_WINDOW_M = 5.0 m`, TUNING) and deadbanded
  (`SIGHT_TREND_DEADBAND_M = 2.0 m`, TUNING) — in
  `05-result-contract-and-inspection.md` §4. The limit point "rushing toward you"
  (closing) vs "releasing" (opening) is the doctrinal speed cue; the solver's
  visibility-governed mode (`04-solver-and-authoring.md` §6) keys off the
  recorded per-sample trend, never off `sightFrom`.

`sightFrom` takes no speed parameter — geometric sight is speed-independent.
Speed enters only through stopping distance:

### 5.2 Stopping distance (lean-aware)

```
ssd(v_ms, phi_rad, model, profile, mu) → {ssd_m, react_m, standup_m, brake_m}

react_m  = v · t_react                       // model reaction time; no braking
t_su     = |phi| / roll_rate                 // stand-up phase: roll to upright at the
                                             //   profile rate (roll_rate_eff, §6)
a_lean   = min(a_ssd, aLongAvail(G·tan|phi|, mu), a_noreturn(phi))
                                             // decel usable while any lean remains:
                                             //   never beyond grip at lean, never beyond
                                             //   the controllable stand-up demand (02 §5)
if v ≤ a_lean·t_su:  standup_m = v²/(2·a_lean);  brake_m = 0   // stops mid-roll-up
else:                v_up      = v − a_lean·t_su
                     standup_m = v·t_su − a_lean·t_su²/2
                     brake_m   = v_up² / (2·a_ssd)             // upright full-rate phase

ssd_m = react_m + standup_m + brake_m
```

Models carried: `alert {a_ssd: 7.0 m/s², t_react_s: 1.0}` (default, TUNING) and
`aashto {a_ssd: 3.4, t_react_s: 2.5}` (the conservative highway-engineering
yardstick) — their `a_ssd` now honestly meaning *upright* braking. Properties of
the definition (normative):

- **Upright reduction:** at `phi = 0`, `t_su = 0` and the formula reduces exactly
  to the carried `v·t_react + v²/(2·a_ssd)`.
- **Conservative:** `a_lean` is evaluated at the *initial* lean and held for the
  whole stand-up phase, though availability only grows as the bike rolls up.
  Disclosed as such.
- **Monotone:** `ssd_m` is non-decreasing in `|phi|` and continuous at `phi = 0`.
- Worked example (street, `alert`, `v = 13 m/s`, `phi = 28°`): `a_lean = 5.41`
  (the `a_noreturn` cap binds), `t_su = 0.56 s`, `ssd_m ≈ 26.5 m` vs 25.1 m
  upright — modest at street lean, large at deep lean, zero upright.

One definition for every consumer: the per-sample `ssd_m` field is computed with
**that sample's own `phi`** and the scenario's profile/mu; the per-point safety
judgment is the comparison **`sight_ride_m ≥ ssd_m`** — rider-path metres on both
sides (D16); the `stop_within_sight` check (`01-scope-and-doctrine.md` Appendix
A) and the V1 governor (`04-solver-and-authoring.md` §6) evaluate
`vis_margin · ssd(v, phi) ≤ sight_ride_m` on exactly this definition. Entry-speed
capping is upright (`phi = 0`), unchanged. The judgment's margin is recorded per
sample and drives the sight-deficit doctrine check.

### 5.3 Recording contract

Every trajectory sample records `sight_m`, `sight_ride_m`, `ssd_m`, and the limit
point (`limit_x`, `limit_y`), computed with the eye at that sample's own
`(x, y)`. `sight_ride_m` — the exact lookahead along the line's **own trajectory**
to the limit station, written by the same post-run analyzer pass — is the **sole
basis for every sight-vs-stopping judgment**; `sight_m` keeps its lane-centre
station basis as the cross-line-comparable quantity, the limit-point/ray anchor,
and the trend's source. Field shapes, precision, and alignment rules are owned by
`05-result-contract-and-inspection.md`. Because sight is per-sample and
eye-accurate, an agent can read "at this station you can see 38 m but need 51 m to
stop" directly off any line — good or failed — without recomputation.

**`hazard_visible` (D27).** For every **on-road** vehicle (`lane` or `f` form),
each line's analyzer emits one event

```
{ kind: "hazard_visible", s, t, detail: { occluder_id, dist_m } }
```

at the first retained sample whose eye→footprint-centre segment is unobstructed
by every *other* opaque footprint (a vehicle never hides itself); `dist_m` is the
euclidean eye→centre distance at that sample. If no sample sees the vehicle
before termination, no event is emitted — absence is the recorded fact. Verge
vehicles emit no `hazard_visible` (they are scenery; on-road vehicles are the
book's hazard-you-must-see). Per-sample recording is deliberately *not* added:
the event is the teaching quantity ("the good line sees the car at s=X, N metres
sooner"), and `sight_m`/`limit_x/y` already carry the continuous channel. Event
shape and the closed kind set: `05-result-contract-and-inspection.md` §5.

---

## 6. The scenario wire schema

The engine's unit of work: **one road + one rider plan**. Validation
(`validate(json) → Result<Scenario>`) is the sole rejection point; it normalizes,
fills defaults, resolves anchors and placements to absolute stations, and freezes.

```
{ spec: "linelab/1", id,
  road:      <road union, §2.1>,
  occluders: [Occluder…]?,          // §4.1
  hazards:   [Hazard…]?,            // §4.2
  rider:     { profile, roll_rate_cap_dps?,
               start: {speed_kmh, f? | d?}, plan: [PlanAction…] },
  config:    { mu?, ds_m?, ssd_model?, rubric?, checks_version? },
  expect_fail?: [checkId…],
  meta?: {} }
```

Field notes (defaults in parentheses; every field is typed and rejected on
mismatch with a `SCHEMA` error naming the path):

- `spec` must literally equal `"linelab/1"`.
- `rider.profile` ∈ `casual | street | trained | racer` → `{roll_rate_dps, skill,
  t_react_s}` (constants in `02-physics-model.md`). Default `street`.
- `rider.roll_rate_cap_dps?` — effective steering-rate cap: the controller reads
  `roll_rate_eff = min(profile.roll_rate_dps, cap)` everywhere it reads the
  profile rate — commit ramp, heading-capture release accrual, unwind, tracker
  cap, `d_flip` link budget, the lean-aware `ssd` stand-up phase
  (`02-physics-model.md` §3). Validation: `cap ≤ 0` → `BAD_RANGE`;
  `cap ≥ profile rate` → `INEFFECTUAL` (`roll_rate_cap_not_binding` — a
  non-binding cap is a dead field, D8). `slow_steer` compiles to
  `cap = roll_rate_factor · profile rate` (§7.1). Spellings: scene
  `rollRateCap=` (ride-line option), CLI `--roll-rate-cap`.
- `rider.start.f` (default `1.0` — the outer usable edge, the doctrinal entry
  position; on an entry straight, measured against the first corner, §2). `d`
  accepted as an escape hatch; exactly one of the two. Spellings: scene
  `startF=` (ride line), CLI `--start-f`.
- `config.mu` (default `1.0`), `ds_m` (`0.5`), `ssd_model` (`alert`).
- `config.rubric?` — the active doctrine pack, by name (default
  `"parks-street"`; the engine resolves a name to the single pack version it
  ships — `01-scope-and-doctrine.md` Appendix A). Unknown name → `UNKNOWN_ID`.
  There is no `mode` field: `rider.profile` already selects the behaviour table,
  and D8 forbids accepted-but-unwired fields.
- `config.checks_version?` (default `2`) — the independent metric-code version
  (`01-scope-and-doctrine.md` Appendix A); the effective value is echoed in
  `Verdict.checks_version`.
- `expect_fail` declares doctrine checks a *legitimate* non-clean line is expected
  to fail (e.g. a double-apex line's out-in-out deviation) — the oracle mechanism
  carried from the prior design (`09-verification-and-testing.md`). The
  declaration is **bidirectional**: a declared check must actually fail, and an
  undeclared failure is equally a deviation (the gate reconciles both ways,
  `08-cli-and-agent-interface.md` §3.1). Check ids are validated against the
  loaded pack (`UNKNOWN_ID` otherwise).

### 6.1 Plan actions

An ordered list; every action carries a stable string `id` (addressing is by id,
never array index — inserting an action must not break a saved sweep). Station
anchors: absolute `at_s`, or corner-relative `at: {ref: "entry|exit|mid:<cornerId>",
offset_m?}` — the same one anchor grammar as occluders and hazards (§4): in token
surfaces a bare `<cornerId>` is sugar for `entry:<cornerId>`, `s:<m>` spells an
absolute station, and an offset never rides inside the anchor
(`SCHEMA`/`anchor_embedded_offset`). All anchors resolve to `at_s` inside
`validate`, so the canonical scenario always carries absolute stations.

| `do` | Fields | Semantics |
|---|---|---|
| `brake` | `decel > 0` (m/s²), `taper_to_s?`, `slew_mss?` | longitudinal deceleration, optionally tapering to zero by a station; onset and every level change slew-limited |
| `turn_in` | `target: "tangent_inside" \| {lean_deg ∈ (0, 90)}`, `hand?: "L"\|"R"` | commit a roll-in; `tangent_inside` defers the magnitude to the solver; `hand` binds the governing corner (below) |
| `throttle` | `accel ≥ 0` (m/s²), `slew_mss?`, `freeze_steer_s?` | `0.0` = maintenance crack; `> 0` = drive roll-on; optional steering freeze (below) |
| `position` | `f` (target lane fraction) or `d`, `over_m?: number \| "auto"` (default `"auto"`) | lateral repositioning — see below |

**Slewed longitudinal commands.** `slew_mss` ∈ `[SLEW_MIN, SLEW_MAX] =
[1, 100] m/s³`, else `BAD_RANGE`; default `A_SLEW_DEFAULT = 6.0 m/s³` (TUNING) —
deliberately below `RATE_THRESHOLD = 8.0 m/s³` (`02-physics-model.md` §5.2), so a
default-authored brake is a firm squeeze that never fires the chop transient;
a grab is authored intent. `slew_mss` on a `position` or `turn_in` action is
`SCHEMA` (field unknown there). Controller semantics (slew-limited approach to
the target level) live in `02-physics-model.md` §3. Spellings: scene `slew=`,
CLI `--brake-slew` / `--throttle-slew`.

**Steering freeze.** `freeze_steer_s` (throttle actions only; `SCHEMA` on any
other kind): from the action's onset station the rider makes **no steering
input** — `roll_cmd = 0` for `freeze_steer_s` seconds; `phi` evolves under the
stand-up disturbance alone (`02-physics-model.md` §5). Range
`(0, FREEZE_MAX_S = 5.0 s]` (TUNING), else `BAD_RANGE`. A `turn_in` stationed
inside a freeze window is `INEFFECTUAL` (`turn_in_during_freeze`) — it would be
accepted-but-ignored. `chop` compiles its cut with `freeze_steer_s = freeze_s`
(§7.1), so an exported chop line round-trips. Spellings: scene `freeze=`
(throttle action, beside `slew=`), CLI `--throttle-freeze`.

**Turn-in lifetime and hand binding (D13).** A `turn_in` is a commitment with a
lifetime: it begins at `at_s`, its **static commitment window** is
`[at_s, s1 of its governing corner]`, and it ends at the heading-capture
`release` event (or a superseding `turn_in`) — the release predicate and the
unwind semantics live in `02-physics-model.md` §3.1. `lean_deg` stays a magnitude
in `(0, 90)`: direction never rides in the number (the same hand-independence
that made `f` the doctrine coordinate). With `hand` omitted, the commitment binds
to the next corner downstream of `at_s`; an explicit `hand` binds to the next
**matching** corner or is rejected `BAD_RANGE` (`no_governing_corner`) — a
contradictory sign is unrepresentable, and alternating-hand esses are commandable
(the chain solver writes `hand` explicitly where it places a flip inside the
previous corner's tail). Token spelling `hand=L|R`; full words `left|right` on a
`hand` key reject `SCHEMA` with a rewrite hint. `explain turn_in` states the
inference rule. Solvers rewrite every solved `turn_in` to the fully explicit
`{lean_deg, hand}` form (`04-solver-and-authoring.md` §4.2) — `tangent_inside`
never survives into a self-verified wire plan.

**The no-apex invariant (D7, carried).** There is no `apex` field and no
`apex:<id>` anchor anywhere in this schema; `validate` rejects `apex:` refs with a
typed error, because the apex does not exist until the engine runs. Apex-relative
*sugar* exists only in the author layer, which solves first and rewrites to
absolute stations before the engine ever sees the plan
(`04-solver-and-authoring.md`).

**`position` — the physical lateral channel (D8/D20).** `position` actions are
executed by the bounded lateral tracker (`02-physics-model.md` §3.1): a
critically-damped guidance law writing `target_lean` under the authority cap
`PHI_TRACK_AUTH_DEG = 5.0°` and the repositioning budget
`a_lat_pos_max = 0.8 m/s²` (both normative in `02-physics-model.md`), always
subject to the friction ellipse — positioning is real riding, not teleportation.
`over_m` is a **completion budget**, not a switch-off: the tracker keeps
converging after the window, and the `position_complete` / `position_shortfall`
events record the honest result (`05-result-contract-and-inspection.md` §5) — a
miss is typed and recorded, never silent. `over_m: "auto"` (the default) resolves
at validation to the whole legal window: from `at_s` to the nearest of the next
`position` action's `at_s`, the next `turn_in`'s static commitment start, or road
end. A numeric `over_m` remains authorable as a completion assertion ("I need to
be there *by* here").

Validation is closed-form over the plan's **own longitudinal claim** — the
validator never runs the engine (D8 stays a *validation* property). `v_cmd(s)` =
the speed profile obtained by integrating the plan's commanded `brake`/`throttle`
accelerations kinematically from `start.speed_kmh` (piecewise
`v² = v₀² ± 2·a·Δs`, friction ellipse ignored); `T_cmd(s₀, s₁)` = the traversal
time of `[s₀, s₁]` under `v_cmd` (if `v_cmd` reaches 0 inside the window,
`T_cmd = ∞` — the bike parks in the window). The shared reachability formula
(also the visibility mode's hold-clipping rule, `04-solver-and-authoring.md` §6):

```
phi_auth     = atan(a_lat_pos_max / G)                          // 4.66°
t_roll       = phi_auth / roll_rate                             // street 0.093 s
dd_max       = a_lat_pos_max · max(0, T_cmd/2 − t_roll)²        // achievable displacement
L_req(Δd, v) = 2·v·( sqrt(K_REACH·Δd / a_lat_pos_max) + t_roll )

K_REACH = 1.2 (TUNING)  ·  MIN_POS_DD_M = 0.10 m (TUNING)
```

Rules, in order, per action (first failure wins; every error carries
`{code, at, message, detail?}` with `at` = the action id). `f_from(p)` is the
**declared lateral history**: the latest lateral action before `p` — none →
`rider.start.f`; a `position` action `q` → `f_tgt(q)`; a `turn_in` → undefined
(post-commitment: position is emergent).

1. **Target domain.** `f_tgt ∈ [0, 1]` (the corridor; under `use_full_width` the
   rescaled full-carriageway range) else `BAD_RANGE`
   (`position_target_outside_corridor`).
2. **Window on the road.** `W(p) = [at_s, at_s + over_m] ⊆ [0, road_end]` else
   `BAD_RANGE` (carried anchor rules).
3. **Commitment overlap.** `W(p)` must not intersect any `turn_in`'s static
   commitment window `[at_s, s1 of its governing corner]` else `INEFFECTUAL`
   (`position_overlaps_turn_in`) — mid-corner line changes are expressed through
   steering actions, not position targets.
4. **Position–position overlap.** Windows of two `position` actions must not
   intersect (the earlier assertion would be silently superseded — the
   accepted-but-meaningless class D8 forbids) else `INEFFECTUAL`
   (`position_overlaps_position`, naming both ids).
5. **Reachability** (only when `f_from(p)` is defined — approach-phase and
   consecutive-position cases, which includes every solver-generated hold):

   ```
   REJECT  iff  K_REACH · |dOf(f_tgt) − dOf(f_from)|
                >  a_lat_pos_max · max(0, T_cmd(W(p))/2 − t_roll)²
   ```

   `INEFFECTUAL` (`position_target_unreachable`) with the machine-readable
   payload `{requested_dd_m, achievable_dd_m, over_m, required_over_m}`
   (`required_over_m` from `L_req` under `v_cmd`) — the author's next move is
   legible from the error: widen the window, slow the plan, or shrink the move.
   When `f_from` is undefined (post-commitment) validation **accepts** —
   rejecting would require guessing emergent state and would ban legitimate
   short exit repositions; the honesty backstop is the runtime
   `position_shortfall` event.

Worked (normative examples): on `book90` at 34 km/h, a reposition `f 0.5 → 0.9`
(Δd = 1.08 m) needs `L_req = 25.8 m` — not reachable on the 12 m entry straight
at that speed; the honest answer is the typed rejection naming 25.8 m (the prior
fixed `over_m` default of 15 m was fantasy and is deleted). The canonical
visibility hold `f 1.0 → 0.9` (Δd = 0.27 m) needs 11.3–13.8 m across 28–34 km/h —
reachable exactly once the V1 governor has brought the speed down, which is why
the visibility mode's fixpoint order (govern speed, then place holds) is
load-bearing physics. `position` is the approach/exit tool that makes hold-wide
authoring — and therefore visibility-differentiated lines — possible.

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
error vocabulary). Adding a **code** is a design change. Every rejection carries
`{code, at, message}` — plus, where a rule defines one, a machine-readable
`detail` payload (e.g. `position_target_unreachable`'s
`{requested_dd_m, achievable_dd_m, over_m, required_over_m}`;
`super_tight_geometry`'s `{sweep_below_r_max_deg, r_uturn_max_m}`) — where `at`
names the offending path or token.

Under the closed codes, typed **reason tokens** are minted per mechanism, each
defined at its rule and enumerated by `schema`
(`08-cli-and-agent-interface.md` §5.1). Reasons defined in this document:

| Code | Reasons (defining rule) |
|---|---|
| `SCHEMA` | `anchor_embedded_offset`, `vehicle_lane_xor_side`, `vehicle_span_not_allowed`, `margin_requires_side`, `lane_requires_vehicle`, `hand_on_explicit_road`, `no_view_mirror` (§2–§4); `misjudge_param_required`, `misjudge_with_execution_mistake` (§7.4); the `traffic` and per-segment-width reservations (§2/§3) |
| `OUT_OF_SCOPE` | `vertical_geometry_not_modelled`, `super_tight_geometry`, `full_width_with_oncoming_traffic` (§2); `moving_hazards_not_modelled` (§4) |
| `BAD_RANGE` | `no_governing_corner` (§6.1); `position_target_outside_corridor` (§6.1); slew/freeze/rate-cap range violations (§6.1, §6) |
| `INEFFECTUAL` | `position_overlaps_turn_in`, `position_overlaps_position`, `position_target_unreachable` (§6.1); `roll_rate_cap_not_binding`, `turn_in_during_freeze` (§6/§6.1) |
| `UNKNOWN_ID` | `renamed_kind` (the `early_apex` tombstone, §7.1); unknown check ids in `expect_fail` against the loaded pack (§6); unknown corner ids in anchors (§4) |

The continuation envelope (§7a, D45 — designed, gated) mints five further reasons
under the same closed codes. They are listed separately only because each names
its own defining rule; `schema` enumerates them in the same flat set:

| Code | Reason | Defining rule |
|---|---|---|
| `UNKNOWN_ID` | `unknown_prior` | `--prior` / `prior:` names no committed continuation pack |
| `UNKNOWN_ID` | `struck_by_decision` | any surface names `commit_within_sight` (D45) |
| `SCHEMA` | `continuations_version_mismatch` | pack `requires_continuations_version` ≠ the engine's |
| `SCHEMA` | `pack_defines_rider` | a pack spells a control policy instead of referencing a `04-solver-and-authoring.md` §4c rider id |
| `SCHEMA` | `ladder_cardinality_mismatch` | pack `ladder` length ≠ the code-side `K_MEMBERS` (§7a.2) |

A continuation pack's `source` strings are governed by the single provenance rule
of `01-scope-and-doctrine.md` §A.6 and reject `SCHEMA/source_unresolved` like any
other committed pack; that rule is stated once and is not re-minted here.

Reasons minted by the solver and believed-road layers (`road_too_short`,
`link_flip_infeasible`, `believed_world_not_clean`, …) are defined with their
rules in `04-solver-and-authoring.md`.

---

## 7. The mistake compiler

A failed line is never drawn and never hand-authored: it is the solved good line's
own plan with **exactly one perturbation** — one control-channel delta (execution
kinds) or one belief (misjudgment kinds, §7.4), never both — forward-run through
the same engine, with the outcome read off the engine's verdict (physics is the
validator — `04-solver-and-authoring.md`). A control-channel delta is **one
contiguous replacement in exactly one channel**: steering actions, longitudinal
actions, position actions, or the rider rate cap (`rider.roll_rate_cap_dps`,
§6.1). Values *derived inside* the replacement (the probed committed lean; facet
magnitudes) are engine-probed consequences of the delta, never independent author
inputs. The good/mistake diff therefore isolates precisely the intended delta.

```
compileMistake(kind, params, ctx) → Result<{kind, plan, roadSpec, outcome, diagnosis, label}>
```

### 7.1 Kinds and the one pin table

Closed set (shared vocabulary, `00-README.md` §5): `premature`,
`premature_contained`, `slow_steer`, `fifty_pence`, `chop`, `overspeed` (the
**execution sub-family**) and `underread`, `overread` (the **misjudgment
sub-family**, §7.4). The retired name `early_apex` is rejected with a typed
tombstone — `UNKNOWN_ID` (`renamed_kind`) naming `premature` — and `explain
early_apex` prints the rewrite hint. `explain(kind)` states each kind's
perturbation, pinned outcome, and book figure; for the misjudgment kinds it
states the compile-path difference (§7.4).

Execution sub-family definitions (defaults TUNING):

| Kind | One-channel perturbation (defaults, TUNING) | Book mapping |
|---|---|---|
| `premature` | the solved `turn_in` is replaced by one placed `early_by_m = 10` earlier whose target is the **committed** lean: the largest inside-kissing lean for that early station, derived by engine probe (bisection over lean against the emergent inside clearance; optional author override `lean_deg?`) | fig 8.1's red line — the book's own words, "premature turn point": turned in too soon, runs wide |
| `premature_contained` | the same single replacement, target stays `tangent_inside` (`early_by_m = 10`) — the solver-eased early entry | the early turn-in a rider gets away with on street reserve |
| `slow_steer` | rider rate cap: compiles to `rider.roll_rate_cap_dps = roll_rate_factor · profile rate` (`roll_rate_factor = 0.3`; street 0.3 · 50 = 15 °/s) | fig 8.2 — slow steering |
| `fifty_pence` | the solved `turn_in` is replaced by the facet sequence: an early first facet (`early_by_m = 10`) + `facets − 1` corrections (`facets = 6` — six steering *inputs*); still one steering-channel replacement | fig 8.3 — fifty-pencing |
| `chop` | one throttle cut `offset_m = 5` after the solved roll-on, compiled at `chop_slew_mss = 40 m/s³` (TUNING; authorable via mistake param `slew_mss`) with `freeze_steer_s = freeze_s = 1.0 s` (TUNING) — during the freeze the rider makes **no steering input** (`roll_cmd = 0`; `phi` evolves under the stand-up disturbance alone, `02-physics-model.md` §5): the panicked-rider half of the mistake that pairs with the physics stand-up | Ch.9 throttle doctrine |
| `overspeed` | entry `+ by_kmh = 26`, all else byte-identical | fig 8.4 — decreasing radius entered too fast |

**Wire closure (normative):** *a mistake kind may compile only to surfaces the
wire Scenario can spell; minting a kind whose perturbation has no schema home is
a design error.* Every compiled perturbation appears in the line's
`resolved_scenario` (`05-result-contract-and-inspection.md` §7) — `slow_steer` as
the rider rate cap, `chop`'s freeze as `freeze_steer_s` on its throttle action —
so `export --as scenario` round-trips over the whole kind enum.

**The pin table.** This is the **ONE normative outcome table**
(`01-scope-and-doctrine.md` §4.3 points here; `schema mistakes` prints this same
machine-readable source — rows `{kind, params, admissible_outcomes, fixture_pin,
book_figure, teaches}` — and the `09-verification-and-testing.md` §4 oracle reads
it; a drifted duplicate is structurally impossible). Outcomes are pinned per
(kind, fixture), because outcomes are road-dependent: an **admissible set** over
the closed outcome enum (`crash > runoff > wide > stopped > contained`,
`05-result-contract-and-inspection.md` §6.1) plus a single-class **fixture pin**,
`TUNING-PIN` marked. Named base fixtures (committed;
`09-verification-and-testing.md` §4 references them by name):

- `F-ORACLE-90` — preset `book90` (left-hand default), entry 34 km/h, profile
  `street`, `mu 1.0`; good line = default `solve`.
- `F-ORACLE-DR` — preset `bookDecreasing`, entry 34 km/h, `street`.
- `F-ORACLE-CHAIN` — preset `bookEsses` (four corners), entry 32 km/h, `street`.

| Kind | Admissible outcomes | Fixture | Fixture pin (TUNING-PIN) | Mandatory check failure (`expect_fail`) |
|---|---|---|---|---|
| `premature` | {`wide`, `runoff`} | `F-ORACLE-90` | `runoff` | — (the outcome IS the lesson) |
| `premature_contained` | {`contained`} | `F-ORACLE-90` | `contained` | `late_apex` (`out_in_out` expected in practice, never a pin) |
| `slow_steer` | {`wide`, `runoff`} | `F-ORACLE-90` | `runoff` | `quick_steer` |
| `fifty_pence` | {`wide`, `runoff`} | `F-ORACLE-90` | `wide` | `single_input` |
| `chop` | {`wide`, `runoff`} | `F-ORACLE-90` | `runoff` | `throttle_rule` |
| `overspeed` | {`wide`, `runoff`, `crash`} | `F-ORACLE-DR` | `runoff` | — |
| `underread` | {`wide`, `runoff`} | `F-ORACLE-DR` | `runoff` | — |
| `overread` | {`contained`} | `F-ORACLE-90` | `contained` | ≥ 1 applicable check fails (the over-cautious evidence; quality `caution`) |
| `premature` `@all` | {`wide`, `runoff`} | `F-ORACLE-CHAIN` | `runoff` at the final corner | — (per-corner compounding metric: slot reserved) |

Rules attached to the table:

1. Pins are **design pins** in the invariant-first style of `02-physics-model.md`
   §5.4 — each kind's TUNING default params are *servants to the pin*: if the
   defaults stop producing the pinned class on the named fixture, the params move
   (a TUNING re-tune landing via the `09-verification-and-testing.md` §3.3
   re-bless), never the pin. A pin flip is a design change, full stop.
2. `premature → runoff` on `F-ORACLE-90` is a stated requirement on the
   corrective-shot spec (`04-solver-and-authoring.md`): the corrective must be
   infeasible there — on `book90` (left) the compiled early-turn line departs
   with 0.4 m of pavement margin against a ≈ 3.9 m recovery need. The oracle is
   what makes that spec falsifiable.
3. Engine outcome outside the admissible set on any conforming road is a red
   suite.
4. Outcome classes are **empirically pinned, never asserted**: the mistake tests
   assert the engine's emergent outcome, and a pin that stops holding is an
   engine bug or a mis-tuned default — never patched by editing the pin
   (`09-verification-and-testing.md`).

### 7.2 Chained mistakes and the composed token

A mistake spec is JSON `{kind, params?, scope?}`; its one composed token — the
same grammar across the CLI verb, the `--mistake` flag, and scene text:

```
mistake-token := [<line_id> "="] <kind> [":" params] ["@" scope]
params        := <key> "=" <value> ("," <key> "=" <value>)*
scope         := <cornerId> ("," <cornerId>)* | "all"
```

Examples: `premature` · `premature:early_by_m=6` ·
`chop:offset_m=8,freeze_s=1.5@c2` · `bad2=premature@all`.

Token ↔ JSON is a bijection: `@all` ↔ `scope: "all_corners"`, a corner list ↔ the
array form; scope defaults to the target corner. In scene text the entry name
supplies `line_id`, so a `<line_id>=` prefix there is `SCHEMA`; the legacy
space-separated `key=val … scope=…` scene spelling is rejected `SCHEMA` with a
rewrite hint printing the equivalent token (D8 — nothing deprecated is silently
accepted).

A corner-id list applies the perturbation at exactly those corners.
`scope: "all_corners"` applies the perturbation at **every** corner of a linked
sequence, each corner's perturbation seeded by the emergent state of the mistaken
line through the corner before — the fig 8.6 device, where one early turn-in
compounds corner over corner. This is the capability whose absence blocked the
prior design's linked-turn figures. Per-corner compile order and seeding mechanics
live with `chainedSolve` in `04-solver-and-authoring.md`.

### 7.3 Shareability (D6)

A mistake line's shareable form is its **spec** (`{kind, params, scope}` plus the
base scenario — for misjudgment kinds this includes the believed-road
declaration), never a trajectory. Any consumer — viewer, CLI, another agent —
recompiles and re-runs it with the same engine (for misjudgment kinds: re-solves
the believed world, re-executes the actual, §7.4). Failed lines thereby become
first-class objects (loadable, steppable, per-instant inspectable, exactly like
good lines) while preserving the honesty property: linelab never ships a
trajectory the engine didn't produce.

### 7.4 Misjudgment kinds (D23)

Every Chapter-8 error the execution sub-family cannot author is a **belief
error**: a plan formed for the corner the rider thought they were in, executed on
the corner that exists. Two kinds:

| Kind | One-belief perturbation (defaults, TUNING) | Meaning |
|---|---|---|
| `underread` | exactly one of `r_believed` (m) or `sweep_believed_deg`; target `of=<cornerId>` (default: the figure's teaching corner). On a **taper** corner `r_believed` defaults to `r1` — "believed the entry radius holds", the canonical blind-DR misread, zero params. On an **arc** corner there is no default: omitting both params is `SCHEMA` (`misjudge_param_required`) | believed the corner less demanding than it is |
| `overread` | same param surface; believed tighter/longer than actual | believed the corner more demanding than it is — the timid line |

**Compile path, stated where the grammar lives:** execution kinds perturb the
base ride's *solved plan*; misjudgment kinds take the base ride's *ride spec*
(entry, profile, style, vis mode), **re-solve it on the believed road** — the
sugar rewrites the target corner (constant `arc r=r_believed`, or rescaled
`angle_deg`), leaving every other segment byte-identical — **literalize** the
plan (frozen committed leans, absolute stations, `f` targets), and execute it on
the **actual** road. The believed-road pipeline, its typed validation table, and
the exact divergence-station rule are `04-solver-and-authoring.md` §4.6's;
provenance (`source.kind = "misjudge"`, the verdict `misjudgment` block) is
`05-result-contract-and-inspection.md` §6.3/§7's. The compiled believed road
appears verbatim in provenance — disclosure, like a preset expansion. D7 is
untouched: the author writes worlds, never lines; the engine produces the line in
both worlds.

One belief = one geometric parameter of one corner (the sugar kinds), or one
wholesale believed road (the general `believed_road` solve field,
`04-solver-and-authoring.md` §4.6 — the escape hatch for compound misreads). A
line spec carrying both a misjudgment (either layer) and an execution mistake
kind is rejected `SCHEMA` (`misjudge_with_execution_mistake`) — one control or
one belief, never both.

**The `underread` payoff, precisely.** The continuation envelope (§7a) does not
make `underread` unauthored. It makes the authored belief **auditable**: given a
`misjudge` line, `belief_admissible` reports whether the believed road's
continuation was admissible at the rider's commitment probe, run through the same
consistency filter. When it was, the figure may say *"the belief you rode was one
the visible arc permitted"*; when it was not, the belief was contradicted by
evidence already in view. One boolean, inside `verdict.commitment`, out of hash,
computed only when the commitment pass runs.

---

## 7a. The continuation envelope (D45 — designed, gated on `S-CONT-SEPARATION-v2`)

### 7a.1 What it is, and what is not claimed

The book's blind-corner argument is about *not knowing yet*: *"When entering a
blind turn on the street, there is **always** the possibility that the turn will
tighten up"* (Ch. 8). linelab already computes per sample exactly where knowing
stops — `s_limit`, cast from the rider's own eye (D4). The continuation envelope
asks what lies past that station, and answers with a **declared, ordered probe
set** of continuation roads rather than with a distribution.

Three naming disciplines are normative and enforced by `A-COMMIT-PROSE`
(`09-verification-and-testing.md` §3.4a):

1. The probe set is **never** "every road consistent with the evidence". It is
   **"the declared probe set of `<pack>`"**, named in verdict prose, legend,
   placard, POV chip and `explain`.
2. The report is **refutation-only**. There is no affirmative field at report or
   verdict level: no `justified_through_s`, no `robust_feasible`, no aggregate
   survivability scalar, forever. `Member.escaped` (§7a.7) is the per-member
   primitive from which `refuted(m) := admissible(m) ∧ ¬escaped(m)` is derived;
   it claims nothing beyond "this rider, on this member, from this station".
3. Members that survive are **"not refuted under this pack"**, never
   "survivable".

And one disclosure obligation that costs the feature its most attractive
sentence: **wherever the fan is drawn on a fully blind corner, the fan is the
declared ladder in full.** The consistency filter (§7a.5) discards nothing there,
and no repair changes that, because it is a fact about the world rather than
about the code: a road that tightens into a shadow is invisible by definition,
which is Parks' whole point. The picture on `bookBlind` is a rendering of a
tuning constant, kept honest by the placard and not by the mechanism. The design
states this on the record rather than in a footnote.

### 7a.2 The continuation pack (data)

Committed at `plan/continuations/packs/street.json`, hashed like fixtures and
like rubric packs.

```
ContinuationPack = {
  pack:    "linelab-continuations/1",       // wire-format version
  name:    "street",                        // prior string = "<name>/<version>"
  version: 1,
  requires_continuations_version: 1,        // generator + escape CODE version
  doctrine_source: "Parks, Total Control, ch. 8 (blind corners)",
  escape_rider: "brake_reserve_escape",     // MUST name a 04 §4c registry id; never defines one
  envelope: {
    kappa_max_1pm:        { value: 0.14285714285714285, units: "1/m",   source: "TUNING" },
    dkappa_ds_max_1pm2:   { value: 0.005,               units: "1/m^2", source: "TUNING" },
    kappa_step_max_1pm:   { value: 0.14285714285714285, units: "1/m",   source: "TUNING" },
    member_sweep_max_deg: { value: 150.0,               units: "deg",   source: "TUNING" },
    member_curve_max_m:   { value: 120.0,               units: "m",     source: "TUNING" },
    member_runout_m:      { value: 60.0,                units: "m",     source: "TUNING" },
    ladder_reach:         { value: 1.0,                 units: "-",     source: "TUNING" }
  },
  ladder: [-1, -0.6667, -0.3333, 0, 0.3333, 0.6667, 1],   // sigma, fixed order, K_MEMBERS = 7
  escape: {
    escape_decel_mss:   { value: 3.0,  units: "m/s^2", source: "TUNING" },
    escape_ellipse_max: { value: 0.95, units: "-",     source: "TUNING" }
  }
}
```

**This section is the owning declaration of `escape_decel_mss` and
`escape_ellipse_max`.** They are declared *scalar bounds*, which a pack may
carry; `04-solver-and-authoring.md` §4c.3 cites them by path and owns the control
law that consumes them. `escape_decel_mss.source` is **TUNING**: the fig-8.4
caption warrants an entry speed and a path choice, not a mid-corner deceleration
rate, and `01-scope-and-doctrine.md` §A.6's two-valued provenance discipline
admits only `book:<cite>` or `TUNING`. A book citation here would be a
fabrication. `A-PACK-PROVENANCE` covers this field like every other.

**The pack carries bounds, a ladder, and one rider id. It carries no arithmetic**
(D12): the generator, the DSL spelling rule, the consistency filter and the
escape integrator are code under the independent `continuations_version`.
`escape_rider` is a *reference* into the closed `04-solver-and-authoring.md` §4c
registry; a pack that spells a policy inline rejects `SCHEMA/pack_defines_rider`.

**The ladder's cardinality is bound to the code-side `K_MEMBERS` by a typed
rejection.** `ladder` is pack data; `K_MEMBERS` is code, and it is what bounds
`k_admissible ∈ [1, K_MEMBERS + 1]` (§7a.6) and `k_probed` in
`09-verification-and-testing.md` §3.4a. A pack shipping a ladder of any other
length would silently break both bounds, so `len(ladder) ≠ K_MEMBERS` rejects
`SCHEMA`, reason `ladder_cardinality_mismatch`, at path `prior.ladder` — the same
discipline every other pack-vs-code mismatch gets (§6.2).

Code-side constants (generator and filter, not pack data; every one **TUNING**):

```
K_MEMBERS            = 7      -            probe budget, never a denominator
R_FLAT_M             = 2000.0 m            zero-crossing radius clamp
MIN_SEG_M            = 0.05   m            degenerate split fragment drop
EPS_SLIMIT_M         = 1.0    m            two ds_m quanta at ds_m = 0.5
EPS_LAT_SEEN_M       = 1.0    m            re-emerged lateral displacement bar
EPS_KAPPA_ENV_1PM    = 1e-6   1/m          containment comparison slack
PROBE_LADDER_N       = 5      -            probe stations per corner
PROBE_BACK_MIN_M     = 5.0    m            probe ladder lower clamp
PROBE_BACK_MAX_M     = 30.0   m            probe ladder upper clamp
EPS_PROBE_SNAP_M     = 0.25   m            stateAt probe snap radius
```

### 7a.3 The envelope, and why the actual road is inside it

The family is parameterised in **curvature** `κ = 1/r` (signed, `+` = right-hand
turn, the `02-physics-model.md` §2 convention), never radius. Radius rate cannot
represent a straight, cannot reach `r_min` from a straight in finite distance, and
cannot pass through a hand reversal; curvature is finite at zero, signed through
it, and is the variable the physics already uses (`κ = G·tan φ / v²`).

```
E(s_L) = { κ(·) on (s_L, s_end] :
             |κ(s_L⁺) − κ(s_L⁻)| ≤ kappa_step_max_1pm + EPS_KAPPA_ENV_1PM ,
             |dκ/du| ≤ dkappa_ds_max_1pm2 ,
             |κ(u)|  ≤ kappa_max_1pm + EPS_KAPPA_ENV_1PM }
```

The initial step is admitted at full envelope width
(`kappa_step_max_1pm = kappa_max_1pm`) precisely so that `E(s_L)` contains the
actual road's own continuation: linelab roads compose `straight | arc | taper`,
whose curvature is piecewise-linear with **step discontinuities at segment
boundaries**. A rate-only family would exclude the true road at every boundary
past the limit point.

**`EPS_KAPPA_ENV_1PM` is load-bearing, not decoration.** Containment is a
comparison between a geometric curvature and a decimal shipped in a JSON file.
`bookDecreasing`'s taper ends at `r₂ = 9` → `κ = 0.1111…` repeating; a four-digit
pack literal `0.1111` is *less* than it and the containment gate fails on the very
road the taper was tuned to admit. Envelope bounds are therefore shipped at
binary64 precision and compared with `EPS_KAPPA_ENV_1PM` of slack.

**All three envelope bounds are pinned from below by the corpus, and the rate
bound was the one that was wrong.** For a `taper r1>r2 ^θ`, `r` is linear in swept
angle (§7a.4's split rule), so

```
dκ/ds = (r1 − r2) / (θ_rad · r³)      — maximised at the tight end, r = r2
```

`bookDecreasing`'s own `L 16>9 ^130` therefore runs
`7 / (2.26893 · 729) = 0.004232 1/m²` over the last 5.52 m of its 28.36 m taper
(the bound is crossed at `r = 10.726 m`) — **1.69× the `0.0025` this pack shipped
before this amendment**. `P-CONT-ENVELOPE-CONTAINS-ACTUAL` would have failed on a
committed preset, and the honest-refusal path would have fired
(`envelope_contains_actual: false`, no fan, every count `null`) on precisely the
decreasing-radius trap that best exemplifies the feature's own thesis. The bound
is raised to **`0.005`**, which dominates the corpus maximum with 18 % of margin;
`C30-DR`'s `R 40>25` taper is nowhere near it either — its tight end runs
`15/(θ_rad·25³) ≤ 0.001` for any sweep at or above 60°, and `02-…md` §8 does not
pin its sweep, so no exact figure is quotable here.

**Normative:** *every envelope bound is a lower bound set by the corpus, never a
free constant. Adding or reshaping a preset obliges a re-check of all three —
`|κ|`, the interior boundary step, and `dκ/ds` — against every road the corpus
contains. `review/verify/fixture_geometry.py` computes all three from the DSL
strings and is the executable form of this obligation.*

**Normative — `kappa_step_max_1pm` and `kappa_max_1pm` are coupled and move
together.** `E(s_L)` bounds the initial step by `kappa_step_max_1pm`, while
§7a.4's ladder produces a step of at most `kappa_max_1pm`. Those are different
constants that happen to be equal today, and the containment proof depends on the
equality: raising `kappa_max_1pm` alone to `1/4` makes the `σ = +1` rung step
`0.1667` against an unchanged `0.1429` bound, so the generator would emit members
outside the envelope the placard names — the exact defect the hand-frame ladder
was introduced to remove. *Any change to `kappa_max_1pm` must raise
`kappa_step_max_1pm` to at least match it, and the pack schema check asserts
`kappa_step_max_1pm ≥ kappa_max_1pm`.* This matters because `kappa_max_1pm` is
**not** fenced from above by containment (`09-…md` §3.4a): containment is a lower
bound, so the constant can be raised to buy refutations, and the only real fences
are this coupling and the grid's `|{k_refuted}| ≥ 3` condition.

**Consequence, stated plainly:** past a totally blind limit point the envelope is
wide and the fan opens hard. That is not over-fanning; it is the epistemic state
of a rider who genuinely cannot see. The fan narrows for exactly two reasons: the
limit point moves out, and — only where road re-emerges past an occluder —
members are filtered.

### 7a.4 Member generation — `truncateAt`, the headroom ladder, the swept-angle budget

**`truncateAt(roadSpec, s) → Result<roadSpec>`** — walk segments accumulating
length, drop everything past `s`, split the segment containing `s` at local length
`ℓ = s − s0_seg`:

| segment | split rule |
|---|---|
| `straight len` | `len := ℓ` |
| `arc r ^θ` (`L = r·θ_rad`) | `θ := θ · ℓ/L` |
| `taper r1>r2 ^θ` | `r` is linear in swept angle: `r(t) = r1 + (r2−r1)t`, `L(t) = θ_rad·t·(r1 + r(t))/2`. Solve `(r2−r1)θ_rad t²/2 + r1 θ_rad t − ℓ = 0` for `t ∈ (0,1]`, then `θ := θ·t`, `r2 := r(t)` |

`hand` and `lane_width_m` carry through unchanged; fragments shorter than
`MIN_SEG_M` are dropped.

**The ladder is a fraction of remaining headroom, and it is a different quantity
from the containment step bound.** Conflating them collapses the tightening half
of the ladder onto one byte-identical road (every rung clamps at
`±kappa_max_1pm`) and, on `bookDecreasing` past its taper where
`κ_L = kappa_max_1pm` exactly, makes *"the turn may tighten"* literally
inexpressible.

**The ladder is evaluated in the hand frame, not against `sign(κ_L)`.** Let
`hand ∈ {+1, −1}` be the **governing corner's hand** (§2's governing-corner rule:
the corner containing `s_L`, else the nearest corner downstream, else the last
corner) — `+1` for a right-hander under `02-physics-model.md` §2's curvature sign convention. Everything below is
computed on the hand-framed curvature `κ̃ := κ·hand`, which is `≥ 0` through the
corner and, crucially, is **defined when `κ_L = 0`**:

```
hand     = governing corner's hand ∈ {+1, −1}        // never sign(κ_L)
κ̃_L      = κ_L · hand                                // ≥ 0 in the corner, 0 on a straight
h(σ)     = σ > 0 ? kappa_max_1pm − κ̃_L               // headroom toward the envelope ceiling
                 : κ̃_L                               // headroom back to straight
κ̃0(σ)    = κ̃_L + σ·ladder_reach·h(σ)
κ̃_m(u)   = clamp( κ̃0(σ) + σ·dkappa_ds_max_1pm2·(u − s_L),
                  −kappa_max_1pm, +kappa_max_1pm )
κ_m(u)   = κ̃_m(u) · hand
```

`σ = +1` is *"it tightens to the envelope ceiling"*; `σ = −1` is *"it
straightens"*; hand reversal past the limit point is reachable, but only through
the **rate** clause over distance — never as a step at `s_L`, because no real road
snaps from one hand to the other at a point.

Three properties hold by construction, and each replaces a defect the earlier
`sign(κ_L)` formulation carried:

1. **Hand symmetry.** `{κ₀(σ)}` on a left-hander is exactly `−{κ₀(σ)}` on its
   mirror. The earlier form keyed the `h_toward`/`h_away` branch on
   `σ·sign(κ_L) > 0`, which silently swapped the branches with hand: on a
   left-hander `σ > 0` selected the *opposite-ceiling* headroom — `−0.226190`
   against the intended `−0.059524`, **3.80×** the right magnitude — so `σ = +1/3, +2/3, +1` all clamped to `−kappa_max_1pm` and collapsed
   onto **one byte-identical road** — the exact failure this paragraph opens by
   promising to prevent. Every book preset except `bookEsses` and `bookHairpin`
   is a left-hander, so the collapse hit `bookBlind`, the fixture the D45 spike
   is gated on.
2. **Definedness on a straight.** `sign(0) = 0` made `h_toward = h_away = 0`, so
   at a limit point on a straight *all seven* rungs returned `κ₀ = 0` and the fan
   was a single road. In the hand frame `κ̃_L = 0` still gives a spread over
   `σ > 0`, and the `σ < 0` rungs remain distinct through their ramp rates.
3. **Every rung lies inside `E(s_L)`.** The step is
   `|κ̃0(σ) − κ̃_L| = |σ|·h(σ) ≤ max(kappa_max_1pm − κ̃_L, κ̃_L) ≤ kappa_max_1pm`,
   so the members the fan draws are members of the envelope the placard names.
   The earlier form's `h_away` branch reached `−kappa_max_1pm·sign(κ_L)`, a step
   of `|κ_L| + kappa_max_1pm` — `0.2262` against a `0.1429` bound on a right-hand
   `r = 12` corner. Two of seven rungs were **outside the declared envelope**, and
   they were the two that refuted unconditionally (an instantaneous hand reversal
   at street speed leaves the corridor whatever the rider does), so the count the
   report headlines was floored by roads that were not in the probe set.

`P-CONT-MEMBERS-DISTINCT` is asserted on `road_dsl`, not on `κ₀`: on a straight
the `σ < 0` rungs share `κ₀ = 0` but differ in ramp rate, hence in spelled taper,
hence in `road_dsl`.

`kappa_step_max_1pm` is read by §7a.3 **only**; the generator never reads it.
`kappa_max_1pm` is `1/7`, not `1/9`: `1/9` is `bookDecreasing`'s own minimum
radius (§3.1), so at `1/9` the preset sits on the ceiling and the tightening
headroom `h(σ>0)` is zero.

**The curved tail is budgeted in swept angle.** Integrate `|κ_m|` from `s_L` and
terminate the curved tail at the **first** of
`∫|κ_m| du = member_sweep_max_deg` or `u − s_L = member_curve_max_m`; then append
`straight member_runout_m`.

This replaces an arc-length budget, and the arithmetic that killed the arc-length
version is recorded because it is the cautionary case: at a `1/9` ceiling with a
120 m tail, a member holding `r = 9` sweeps **764°**, and even `σ = 0` on
`book90` sweeps **573°** — all refused `OUT_OF_SCOPE/super_tight_geometry` by §2
under D21's `≥ SWEEP_UTURN_MIN at r ≤ 15 m` rule. Six of seven rungs vanished and
the drawn fan contained the actual road plus one road that got *easier*: the
exact negation of the feature's thesis — which is on its own sufficient to kill
the arc-length budget. A second reason once given here — that honouring the
curvature ceiling caps the tail at 26.7 m, "below what the escape needs" — is
**withdrawn as false**: 26.7 m is *above* what the escape needs at every speed the
corpus rides (21.4 m at 32 km/h, 23.6 m at 34), so it never argued against
retuning the length. Budgeting the angle and letting the runout carry the distance repairs both ends at
once: at `r = 7 m`, 150° is 18.3 m curved plus 60 m straight, i.e. 78.3 m of
member. Against that, a coasting escape needs 23.6 m from `bookBlind`'s 34 km/h
and 53.5 m from 55 km/h (both to `v_floor_ms`, `02-…md` §7) — comfortably inside
78 m, which is the only thing this budget argument needs. Those two figures are
**illustrative sizing, not a fixture reach**: per `04-…md` §4d a reach quote is
meaningful only alongside a named line and probe, and neither is named here.

**Spelling** (ordinary DSL, no special composer path):

- `κ_m` affine in `u` ⇒ one `taper` per monotone single-sign span
  (`r1 = 1/|κ0|`, `r2 = 1/|κ|` at span end, `angle_deg = ∫|κ| du` in degrees,
  `hand` = sign).
- a clamp at `±kappa_max_1pm` ends the taper and appends
  `arc r = 1/kappa_max_1pm`.
- a zero crossing: the DSL cannot spell infinite radius inside a taper, so the
  generator clamps `|κ| ≥ 1/R_FLAT_M`, splices two tapers at the crossing, and
  records `flat_clamped: true`. (`R_FLAT_M` over 40 m of station is 0.4 m of
  lateral offset — disclosed, not hidden.)
- the tail closes with `straight member_runout_m`.

**Normative:** *Members are probe worlds, not authored roads. The curved tail is
budgeted in swept angle strictly below `SWEEP_UTURN_MIN` (§2); a member that
still trips `super_tight_geometry` after the cap is dropped, counted in
`members_out_of_scope`, and named in the report.*

**`members_out_of_scope` is always zero *under §2's per-corner quantifier*, and
that quantifier is the load-bearing assumption.** §2 refuses a corner whose swept
angle accumulated where `r ≤ R_UTURN_MAX` reaches `SWEEP_UTURN_MIN = 170°`, and
corners are minted **per curved segment** (§2). A member's curved tail is capped
at `member_sweep_max_deg = 150°` and its clamped-arc continuation mints its own
corner, so no member corner reaches 170° at any value of `kappa_max_1pm` — the
truncated actual corner does not merge with the tail.

**Under a road-level reading the conclusion inverts, which is why the quantifier
had to be pinned.** A `bookBlind` member is a truncated `^140` corner at `r = 12`
(itself `≤ R_UTURN_MAX`) plus a 150° tail at `r ≤ 7`; summed over the road that is
178°/206°/234° for a limit point 20/40/60 % through the corner — refused
near-universally, and `members_out_of_scope` would be near-total on the flagship
fixture. `02-physics-model.md` §7 previously stated the rule without scoping and
has been aligned to §2, which is the owning statement. Note that
`bookDoubleApex` does **not** discriminate between the two readings and must not
be cited as if it did: its middle segment is `r = 24 > R_UTURN_MAX`, so the
`r ≤ 15` filter already drops it and the remaining `70 + 70 = 140° < 170°` clears
under both. `kappa_max_1pm` is therefore not bounded from above by
§2 at all. The drop path stays in the spec so that a future change to either
constant fails loudly instead of silently drawing a refused road, but it must be
asserted unreachable (`A-AN-SWEEP-BUDGET`) rather than exercised by a golden.

Members are addressed **by index `σ`, never by corner id** — member roads re-mint
`c1, c2, …` under the ordinary parser rule (§2), and nothing downstream reads a
member corner id; handedness inside the escape is read from the sign of local `κ`
on the member. Occluders and hazards are carried onto members **in their
already-resolved absolute world form** (§4.2), so the hedge stays where the hedge
is and the fan cannot be drawn through it. **Member `m0` is the actual road,
untruncated**: trivially admissible, guaranteeing `k_admissible ≥ 1`, and not
cheating because the report reads the *worst* member and never the best.

### 7a.5 The observation-consistency filter — what it can and cannot do

```
Grid  U     = { s_L + n·ds_m : n ≥ 1 } ∩ (s_L, s_L + member curved span]
vis(road,u) :⇔ segment(eye → p_road(u)) meets no occluder     // RAW, not first-blocked

admissible(m) :⇔ |sightFrom(compose(m)).s_limit − s_L| ≤ EPS_SLIMIT_M
               ∧ ∀u ∈ U: vis(m,u) = vis(actual,u)
               ∧ ∀u ∈ U with vis(actual,u): |p_m(u) − p_actual(u)|_lat ≤ EPS_LAT_SEEN_M
```

§5.1's first-blocked rule deliberately excludes re-emerged road from
`sight_ride_m`, but the rider *does see* that patch of tarmac past the hedge's
lateral edge. The second and third clauses read exactly that channel, and are
silent under total occlusion — correctly.

**The filter prunes continuations that would have been seen further, or seen
displaced where the rider actually saw road past the occluder's edge. It cannot
prune a continuation that tightens into the shadow — tightening is invisible past
the limit point by definition, which is the book's whole point. Under total
occlusion the filter discards nothing and the fan is the declared ladder in
full.**

The claim that this mechanises Parks' edge-convergence cue is **deleted, not
softened**. It was false: members share position and heading with the actual road
at `s_L` but step in curvature, so centrelines separate as `½·Δκ·d²`. For the
`σ = +1` member on a `κ_L = 1/12` corner, `Δκ = kappa_max_1pm − κ_L = 0.0595`,
giving **0.74 cm at one 0.5 m sample step and 6.7 cm at `s_L + 1.5 m`**; taking
`Δκ` at its widest (`kappa_max_1pm` itself, i.e. a limit point on a straight)
gives **1.79 cm and 16.07 cm**. Both bracket the same conclusion, and neither is
the pair this paragraph carried before (1.4 cm / 12.5 cm), which back-solves
exactly to the **retired** `kappa_max_1pm = 1/9` and survived the amendment that
replaced it. Against those, shadow depth grows linearly at `sin θ` per metre;
`θ ≈ 24°` is reproducible at exactly one probe cell — the widest line at the last
probe, i.e. the *least* blind cell on the fixture — while the median across the
probe ladder is 36–44°, so `24°` is a real number carrying a false adjective and
is restated here as the **best case for the filter**, not the representative one.

Under first-blocked semantics every member is blocked at the same station as the
actual road, so `s_limit(m) = s_L` exactly and `admissible ≡ true` on the whole
domain where the fan is drawn. A test whose non-vacuity guard sits on the
occluder-free case proves nothing, because there the fan is empty.

**The re-emergence channel is weaker than `EPS_LAT_SEEN_M` admits.** The filter's
third clause discards a member whose lateral displacement exceeds
`EPS_LAT_SEEN_M = 1.0 m` where the rider actually saw road. At the divergence rate
above, the `σ = +1` member does not reach 1.0 m of separation until ≈ 3.7 m past
`s_L` (and ≈ 5.8 m at the `κ_L = 1/12` rate). Re-emerged tarmac appearing closer
than that is inside the tolerance and prunes nothing, so the channel is narrower
than "wherever road re-emerges" — it is "wherever road re-emerges more than about
four metres past the limit point" on a straight, and about 5.8 m at the
`κ_L = 1/12` rate that actually obtains mid-corner.

Cardinality is therefore variable per station and both counts are recorded:
`k_admissible(s) ∈ [1, K_MEMBERS + 1]`, `k_refuted(s) ∈ [0, k_admissible]`.
`K_MEMBERS` is a probe budget and never a denominator in any predicate or any
rendered string.

**Disclosure.** `Probe.filter_effective: boolean` is true iff ≥ 1 member was
discarded at that probe. When false, every printing surface appends *"consistency
filter inactive at this station (sight fully blocked)"*.

### 7a.6 Probe stations

```
s_back         = clamp( 0.5 · L_app(c), PROBE_BACK_MIN_M, PROBE_BACK_MAX_M )
probe_stations = PROBE_LADDER_N stations evenly spaced on [ s_ti − s_back , s_ti ]
```

`s_ti` is the corner's first `turn_in` event station, inclusive endpoint (D21
corner-relative discipline). The last probe is **the commitment probe** — the one
every headline reads. The four earlier probes exist for the collapse story and for
the controls-strip trace.

### 7a.7 Report shapes

```
CommitmentReport = {
  spec: "linelab/1",
  line_id, prior: "street/1", continuations_version: 1,
  rider: "brake_reserve_escape",              // 04 §4c id; echoes the pack's escape_rider
  predicate: "reserve_bounded_run",           // 04 §4c CfPredicate id
  envelope_contains_actual: boolean,          // §7a.3 gate; false ⇒ no fan, no counts
  belief_admissible: boolean | null,          // null on non-misjudge lines (D23 / §7.4)
  actual_road_refuted: boolean | null,        // null iff no probe has escape_status "ok"
  probes: [ Probe ],
  corners: [ { corner_id, blind, commit_probe_index,
               k_admissible: number | null,     // null = not computed, never zero
               k_refuted:    number | null,     // null = not computed, never zero
               refuted_sigmas: [number],
               worst: { sigma, refute_reason, at_s, phi_deg, ellipse_mag } | null,
               first_refuted_s: number | null } ],
  placard: string                             // 06-…md §2.7 continuation placard, verbatim
}

Probe = { s, t, k_probed,
          k_admissible: number | null,        // null = not computed, never zero
          k_refuted:    number | null,        // null = not computed, never zero
          members_out_of_scope,
          filter_effective: boolean,
          escape_status: "ok" | "probe_outside_reserve_at_entry",
          members: [ Member ] }

Member = { sigma, admissible, s_limit_member_m, flat_clamped,
           road_dsl,                          // the composed member, disclosed verbatim
           escaped: boolean | null,           // null iff !admissible or escape_status ≠ "ok"
           refute_reason: null | <closed set>,
           escape: { s_end, v_end_kmh, phi_max_deg, ellipse_max, f_max } | null }
```

Closed `refute_reason` set (D8 / D19 discipline): `member_off_road |
member_crash | member_reserve_exceeded | member_ellipse_exceeded |
member_corridor_exceeded | member_no_room_before_road_end`.

Closed `escape_status` set: `ok | probe_outside_reserve_at_entry`.
**`escape_status` is a status, not a refusal**: it is a per-probe property of a
successful `counterfactual` call and is not a member of `CfRefusal.reason`
(`04-solver-and-authoring.md` §4c.4).

The typed refusals this section adds are listed in §6.2.

### 7a.8 Verdict siting

`verdict.commitment: CommitmentReport | null`, present only when the analysis was
requested, and listed in `05-result-contract-and-inspection.md` §8.3's
hash-exclusion set. The exclusion is **unconditional and permanent** — there is no
Tier at which it changes, because D45 struck the promotion. `belief_admissible`
and `actual_road_refuted` ride *inside* `CommitmentReport` and are therefore
covered by that single exclusion; `verdict.misjudgment` is not modified by the
commitment pass under any configuration. Precedent: `danger_dwell_s`
(`01-scope-and-doctrine.md` §A.2 — recorded, feeds no check) and
`correctiveShot`'s shadow (`05-result-contract-and-inspection.md` §6.3).

No `Sample` field is added: the channel is per-probe, not per-sample, so the
pinned 32-field append-only contract is untouched. `stateAt.derived` gains one
nullable member `commitment_probe: {k_admissible, k_refuted} | null`, populated
only when the cursor is within `EPS_PROBE_SNAP_M` of a probe station and the
report is loaded — read from `probes[]` on the result document, so `stateAt` stays
pure and adds zero engine runs.

### 7a.9 Honest weaknesses

1. **The filter is inert wherever the fan is most wanted.** Restated from §7a.5
   because it is the feature's central concession: on a fully blind corner the fan
   is the declared ladder in full. The over-fanning objection is answered by the
   placard, not by the mechanism. A reviewer whose standard is *"the picture must
   be epistemically earned rather than declared"* should reject the feature; that
   position is coherent and is recorded here rather than argued away.
2. **`escape_decel_mss` is a band-sensitive constant near a documented cliff.**
   3.0 m/s² sits 0.5 above `A_SU_ONSET` and 2.41 below `a_noreturn` at reserve
   lean, i.e. in `02-physics-model.md` §5.3's band 1. The briefed claim that
   *"braking at lean fights itself"* is **false by that algebra and is deleted**:
   at 3.0 m/s² the brake **tightens** the escape line and sheds lean toward
   reserve, so the escape is mildly optimistic — which, for a refutation-only
   report, is the conservative direction. Any move to `≥ a_noreturn` silently
   inverts the rider's character from line-tightening to lean-shedding and moves
   `k_refuted` hard.
3. **`k_refuted` is a small integer over TUNING constants.** Counts are pinned
   empirically like every other outcome class and moved only through re-bless.
4. **`truncateAt` is new engine surface** with a real edge surface (splits inside
   tapers, `TAPER_RATIO_MIN` re-classification on spliced fragments,
   `super_tight_geometry` re-evaluation, `R_FLAT_M` clamping). Closed-form and
   testable, but not free.
5. **The bake roughly doubles the largest committed figure.** Mitigated entirely
   by siting (out of hash, off the warm path, off by default), never by pretending
   otherwise.

### 7a.10 Why no check is promoted

`commit_within_sight` is struck permanently, for three independent reasons, any
one of which is sufficient:

1. **Budget.** A check that decides `clean` is on the warm-cache recompute path by
   definition. The commitment pass is `8 members × PROBE_LADDER_N probes ×
   4 corners × 3 lines` — an order of magnitude past `C-RECOMPUTE-BUDGET`'s
   100 ms. `na`-when-not-computed is forbidden, because `ok`, `quality` and
   `result_hash` may not depend on a viewer toggle (D38, G6).
2. **Collinearity in the fail direction — the *stated* theorem is invalid, and
   the true relation is stronger.** The version this section carried argued that
   on `bookBlind` a `lean_ceiling` fail implies `φ > BLIND_RESERVE_DEG`, hence
   `v² > 6.87·R_line`, hence the `σ = +1` member at `r = 7` demands 12.76 m/s² at
   `R_line = 13` against `aLatMax = 9.81`, hence **check 8 fail ⇒
   `k_refuted ≥ 1`** unconditionally. That derivation fails three ways and is
   retracted: it uses `G·tan 35° = 6.869` (the *cap*) as the fail bar when the
   fail bar is `phiMax`; it is conditional on `R_line > 9.997 m` rather than
   unconditional; and a check-8 fail *at the probe* means the ridden line is
   already outside the escape corridor, so `04 §4d`'s `start_ok` is false and the
   probe reports `k_refuted := null` — not `≥ 1`. The correct statement is
   narrower and points the other way: check-8 failure suppresses the count
   entirely rather than forcing it positive.
3. **Collinearity with `stop_within_sight`, which is the binding relation.**
   `k_refuted > 0` requires the escape to *reach past* `s_limit` — `04 §4d` grades
   `escaped(m)` over the divergent span `s > s_L` only, so if the escape
   terminates on `v < v_floor_ms` before `s_L` the divergent span is empty, all
   four conditions hold vacuously, and every member is escaped by construction.
   That reachability condition is
   `v·t_react_s + v²/(2·escape_decel_mss) > sight_ride_m` — which is exactly
   `stop_within_sight` (§5.2) re-evaluated with `a_ssd` swapped from the `alert`
   model's **7.0 m/s²** to `escape_decel_mss = **3.0 m/s²**` — modulo two caveats
   that keep the two from being the same function: `ssd` assumes constant speed
   through the reaction then constant deceleration, whereas §4d phase 0 integrates
   the *ridden plan*, so reach is line-dependent; and reach terminates at
   `v_floor_ms`, not at zero.

   The set relation runs the **opposite** way from a first reading, and the
   direction matters:

   ```
   {check 10 fails} = {ssd@7.0 > sight}  ⊆  {reach@3.0 > sight}  ⊇  {k_refuted > 0}
   ```

   `k_refuted > 0` is therefore *not* a subset of check-10 failure — it is
   contained in a **superset** of it, which is exactly why it **can** fire in a
   band where check 10 passes cleanly. That band is not narrow: at 34 km/h it runs
   from `sight = 15.82 m` (where check 10 starts failing) out to `23.64 m` (where
   the escape stops reaching), a width of **7.8 m ≈ 49 % of `ssd@7.0`**; at 32 and
   28 km/h it is **47 %** and **42 %**. All three are computed with reach
   terminating at `v_floor_ms` (`02-…md` §7); a reach computed to `v = 0` gives
   systematically larger figures and must not be mixed with these. Set `escape_decel_mss = 7.0` and the channel collapses
   into check 10 outright. The
   earlier numbers offered here (`clean-pass v ≤ ~6.5 m/s`, `refutation ~7.2 m/s`)
   are retracted: they back-solve to `sight_ride_m ≈ 14.5–15.2 m` against ≥ 24 m
   of actual fixture geometry, and are wrong by roughly 60 %. The one channel not
   gated by that constant is lane-position margin at the limit point, which
   duplicates `out_in_out` and `exit_containment` — not the visibility triad the
   check was justified against.

   **Consequence for the feature, not just the check.** Two things are true at
   once and neither should be dropped. *Against* the feature: the band in which
   `k_refuted` can say anything check 10 does not is bounded by the distance
   between two TUNING constants (7.0 and 3.0), neither of which the book warrants,
   so the channel's independence is a **tuning artifact rather than a physical
   fact** — it exists because someone chose 3.0. *For* the feature: that band is
   wide (≈ 49 % of `ssd`), not the sliver an earlier draft of this section
   asserted, so a direction-(A) witness — `k_refuted > 0` with checks 2, 8, 9 and
   10 all passing cleanly — is **not** ruled out by the arithmetic and may well
   exist.

   No such witness has yet been constructed. Until one is, the channel should be
   read as a picture rather than a measurement; if one is, the honest description
   is "a measurement of a declared escape policy", never "a measurement of the
   road". Constructing it, or failing to, is condition 2 of
   `S-CONT-SEPARATION-v2` (`09 §3.4a`) and the single question the gate exists to
   answer.

Striking it is a simplification, not a concession: it retires the
pack-family-reaches-grading objection, the D12 tension, and the
`spec_hash`/`result_hash` prior-stamping question in one edit, and lets
`verdict.commitment` stay out of hash forever.

### 7a.11 What survives regardless of the spike

`S-CONT-SEPARATION-v2` (`09-verification-and-testing.md` §3.4a) gates the build of
this section, and its expected result is recorded there, in advance, with the
arithmetic that supports it. That expectation is owned by §3.4a and is not
restated here.
Three things are not gated behind it, because they are worth having either way:
`truncateAt` as a road-layer primitive (with `A-AN-TRUNCATE` and `G-TRUNCATE`);
the **refutation-only discipline** — pack always named, survivors "not refuted
under this pack", no affirmative field at report or verdict level — which
`04-solver-and-authoring.md` §4c.7 copies to every counterfactual surface; and the
**honest filter**, the idea of re-casting `sightFrom` on a counterfactual world
and keeping only what the rider's own observation admits. That idea is the
strongest single move in the three briefs. It simply cannot carry the weight the
original design put on it, and this document says so on the record.

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
- `marks` is a `MarkSpec` — `auto | all | none | <class-list>` over the closed
  marker classes `turn_point | apex | exit | release` — at figure and per-line
  scope; markers are glyphs of recorded trajectory events, never invented
  (`06-rendering-and-projection.md` §3.1). `labels` anchor on the closed
  line-addressable feature grammar `feature[:corner][#n]@line ±m` (features
  `turn_point | apex | exit | release | correction | run_wide_detect | end |
  sight_ray`), resolved post-run against the line's recorded events, with typed
  failures (`UNKNOWN_ID`: `anchor_no_match`, `anchor_ambiguous`); author-layer
  `apex:<id>` sugar resolves post-solve (`04-solver-and-authoring.md`). `view` is
  the projection hook — mode, window, orientation — owned by
  `06-rendering-and-projection.md`.
- The scene text format that authors this object in ≤6 lines, and the solver calls
  each `spec` compiles into, are specified in `04-solver-and-authoring.md`.

---

## 9. Relation to the prior design

**Carried:** centerline/station road model with straight/arc/taper segments; the
one-line road DSL with its strict lexing and round-trip identity; lane-constrained
default and the lane-fraction coordinate; the id-addressed, apex-free plan schema
with anchors resolved at validation; the closed error-code vocabulary; the
one-perturbation mistake compiler; gravel as a surface-μ hazard; `expect_fail`
as the legitimate-deviation oracle.

**Changed:** the sight cast moves from centreline-eye to **rider-eye** (D4) with
targets pinned to the ride-lane centre polyline, and the trend leaves
`sightFrom`'s pure signature (defined once over the recorded series,
`05-result-contract-and-inspection.md` §4); every sight-vs-stopping judgment
moves to rider-path metres via `sight_ride_m` (D16); `ssd` becomes the lean-aware
two-phase closed form; `position` actions become **effectual or rejected** (D8)
with a decidable closed-form reachability predicate and `over_m: "auto"` (D20) —
the fantasy fixed default is deleted; the mistake kinds speak the book's words —
`premature`/`premature_contained` replace `early_apex` (tombstoned, D25) — and
outcome cells become admissible sets plus single-class fixture pins in the ONE
machine-readable table (§7.1), `chop` pinned `runoff` with graded slew/freeze
mechanics; presets default to their book figures' ink hands (`book90` becomes a
left-hander, D26) and `bookEsses` is respecified to four corners with flip-budget
links; mistake specs stay shareable, recompute-on-load objects (D6); figures lose
the one-amber-slot and role-colour coupling (D9); the spec string becomes
`"linelab/1"`.

**New:** the occluder vocabulary (`hedge`, `wall`, `bank`, `vehicle`) with
flat-world placement grammar, carriageway vehicle placement, and the
`hazard_visible` sight-target event (D27); pinned wire shapes for segments,
roads (incl. the `{dsl:}` door), occluders, and hazards (§2.1/§4.1/§4.2); the
derived corner record with `type`, `r1`/`r2`, `r_min`/`r_max`, `gap_to_next_m`,
`linked_next`; physical road edges with terminal `off_road` crossing and the
`muAt` lateral clamp (D19); `turn_in.hand` with governing-corner binding (D13);
the wire-closure fields `slew_mss`, `freeze_steer_s`, and
`rider.roll_rate_cap_dps`; the misjudgment sub-family `underread`/`overread`
(D23); the one composed mistake token and chained scope; `use_full_width` /
`bike_margin_m` road options with the corridor-rescaling rule; the
`bookDoubleApex` preset; the rubric selector (`config.rubric`); the stopping-
distance comparison as a first-class per-sample field; the multi-line Figure
object with role/verdict decoupling; the continuation envelope (§7a) as design of
record, gated on `S-CONT-SEPARATION-v2`; `truncateAt` as a road-layer primitive; the
continuation pack format and its five typed refusals.
