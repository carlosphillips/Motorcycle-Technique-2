## SCENE / ROAD VOCABULARY + PRESETS (scene-vocabulary)

> **EDITORIAL RECONCILIATION (binding) — 2026-07-19 editor pass.** Merged against the
> thirteen sibling amendment sections per the three reconciliation audits. Where the
> body below disagrees with a bullet, the bullet wins.
>
> - **This section WINS:** preset hand defaults flip to book ink (`book90` = left);
>   the `hand=L|R` alphabet project-wide (including `turn_in.hand` — corner-exit's
>   `left|right` spelling respelled; `left|right` stays exclusively the
>   rider-relative occluder-side vocabulary); the vehicle occluder's exclusive-union
>   wire shape (`lane: own|oncoming ⊕ f ⊕ side(+margin_m)`, `len_m` spelling, typed
>   reasons — agent-interface's `verge` lane value and `length_m` spelling are
>   re-pinned to this); bookEsses = 4 corners R 12 ^75 with S 6 links (solver-refit's
>   esses arithmetic re-works; the zero-gap case becomes this section's named
>   variant fixture).
> - **Superseded here:** `SPEED_VALID_MIN_KMH` (runwide-physics' `v_valid_min_ms =
>   7.0` is the one validity constant); `A-CHAIN-VIS` single-test replacement (09
>   owns the merged `A-CHAIN-VIS-FULL`/`-BUDGET` pair — FULL subsumes
>   `fx-esses-blind` as its fixture, `F-CHAIN-VIS-GAPPED` is retired).
> - **Consequences consumed by siblings:** corrective-offroad's oracle row and
>   `G-CORR-RUNOFF` run on plain `book90` (left); `G-CORR-WIDE` on `book90 hand=R`;
>   the `book90L` name is unspellable by design. Kinds respelled in place
>   (`mistake premature`).
> - `hazard_visible` joins the merged closed event set; the sample `f`
>   governing-corner semantics and rider-left-positive `d` note land in 05 §2.1's
>   merged field-note block (one paired convention with the y-down frame in 02 §2).

Closes review §8.6 (oncoming vehicle), §8.8 (handedness), and the fig 8.6 row of §1
(bookEsses 3-vs-4 corners; zero-gap esses vs the inter-corner budget; portrait
road_ink/aspect gates), folding in three findings-full items surfaced under the
same anchors: the traffic-side convention is never stated (fig-8.2), `f` is
undefined on straights and flips at hand changes (fig-8.6), and `book90`/recipe (e)
produce a mirror image of fig 8.1 (fig-8.1). Laws honoured throughout: D7 (nothing
here authors a path — vehicles, hands, presets, and view rotation are scene
vocabulary; every drawn line still comes out of the engine), D8 (every new token is
effectual or rejected typed), D9 (nothing here touches colour), D6 (the new event
is recorded output; shareable forms stay inputs-only).

---

### 1. On-road vehicle placement (review §8.6)

#### 1.1 Mechanism

`vehicle` gains a **lateral placement channel on the carriageway**, resolved
through the same sideSign/corridor machinery the rider's `f` already uses. A
vehicle is placed in exactly one of two forms:

- **On-road form:** `lane ∈ own | oncoming`. The footprint centre sits at the
  centre of the named lane at the anchored station:
  `d_centre = sideSign_own · lane_width_m / 2` for `own`,
  `d_centre = −sideSign_own · lane_width_m / 2` for `oncoming`, where
  `sideSign_own` is the sign of the rider's own-lane offset from the centreline
  under the traffic-side convention (§2.4). An explicit `f=<number>` is accepted
  as the escape hatch in place of `lane` (any real value; `f < 0` and `f > 1`
  resolve through the same corridor algebra that defines the rider's `f`, so an
  author can place a vehicle straddling the centreline).
- **Verge form (carried, now pinned):** `side ∈ inside|outside|left|right` +
  `margin_m` (default `0.5`, TUNING) — the footprint centre sits `margin_m +
  width_m/2` beyond the road edge on the resolved side. This is the parked-on-
  the-verge reading the current §4 table implies but never specifies.

Exactly one of `lane` / `f` / `side` — more than one, or none, is rejected
`SCHEMA` with reason token `vehicle_lane_xor_side` naming the path.

**Footprint semantics.** The footprint is a rectangle `len_m × width_m`
(defaults `4.5 × 1.8`, TUNING; both overridable), centred at (anchor station,
lateral centre), long axis aligned with the road tangent at the anchor station.
The rectangle joins the opaque set consumed by `sightFrom` — no special casing:
an eye→target segment that intersects it is blocked, exactly like a hedge.
**Heading** is derived, presentation-only (POV extrusion, windshield-hint glyph
orientation): `lane=own` and verge vehicles face `+s`; `lane=oncoming` faces
`−s`. The physics never reads heading.

**Vehicles are optical-only in v1.** A trajectory crossing a vehicle footprint
triggers no physics event and no termination — collision modelling is out of
scope. A vehicle spec carrying `speed_kmh` (or any motion field) is rejected
`OUT_OF_SCOPE` with placard reason `moving_hazards_not_modelled` — the honest
refusal, and the reserved seam for a future traffic model. (Whether a doctrine
check should flag a line that intersects an own-lane vehicle footprint belongs to
the check-catalogue cluster; the geometry to compute it is fully recorded.)

#### 1.2 Grammar — all spellings

- **Scene / `--occluder` token** (extends the 03 §4 canonical form; the `<side>`
  slot accepts the two lane tokens for `vehicle` only):

  ```
  vehicle <own|oncoming|inside|outside|left|right|f=<v>> <anchor> [<offset>] [len=<m>] [w=<m>] [margin=<m>]
  ```

  e.g. `vehicle oncoming exit:c1 +8`. `<offset>` is a **separate,
  space-delimited signed station-metres token** (`+8`, `-4`) after the anchor —
  the offset half of the general occluder token's `<offset>x<span>`, with the
  span half dropped, and the same spaced-offset spelling the label grammar
  uses; it maps to wire `at.offset_m`. Per the one-anchor-grammar rule an
  offset never rides inside the anchor: the fused spelling (`+8` glued onto
  `exit:c1` as one token) is rejected `SCHEMA`
  (`anchor_embedded_offset`, with the rewrite hint). Vehicles take **no
  `x<span>` token** (the footprint has fixed length); a span token on a vehicle
  is rejected `SCHEMA` (`vehicle_span_not_allowed`). `margin=` is valid only
  with a side token (`SCHEMA`, `margin_requires_side` otherwise). Band kinds (`hedge`/`wall`/
  `bank`) reject the lane tokens (`SCHEMA`, `lane_requires_vehicle`) —
  vision-blocking bands live off the carriageway by design.
- **Wire JSON** (this pins the vehicle member of the occluder wire shape — the
  full occluder wire-shape audit is owned by the agent-interface cluster):

  ```
  { id?, kind: "vehicle",
    at: { ref: "entry|exit|mid:<cornerId>", offset_m? } | { at_s },
    lane: "own"|"oncoming" | f: number | side: "...", margin_m?,
    len_m?: 4.5, width_m?: 1.8 }
  ```

- **CLI:** the same token via the existing repeatable `--occluder "<token>"`; no
  new flag.

#### 1.3 Dual role: occluder and sight target

The occluder role is automatic (§1.1: footprint joins the opaque set). The
**sight-target role** is a new recorded output: for every **on-road** vehicle
(`lane` or `f` form), each line's analyzer emits one event

```
{ kind: "hazard_visible", s, t, detail: { occluder_id, dist_m } }
```

at the first retained sample whose eye→footprint-centre segment is unobstructed
by every *other* opaque footprint (a vehicle never hides itself). `dist_m` is the
euclidean eye→centre distance at that sample. If no sample sees the vehicle
before termination, no event is emitted — absence is the recorded fact. This fits
05 §5's `Event` shape and its bookmark contract unchanged (one new `kind` in the
closed event vocabulary — shared surface). Verge vehicles emit no
`hazard_visible` (they are scenery; on-road vehicles are the book's
hazard-you-must-see). Per-sample recording is deliberately *not* added — the
event is the teaching quantity ("the good line sees the car at s=X, N metres
sooner"), and `sight_m`/`limit_x/y` already carry the continuous channel.

#### 1.4 Fig 8.1 worked end-to-end

Book ink (viewed raster): left-hand ~90°, two-lane road, double-yellow
centreline; green delayed-turn line and red premature line both apexing on the
centreline; a bush inside the bend; dashed sight lines from both turn points
across the inside; an SUV **in the oncoming lane of the exit leg, facing the
corner**.

```
road:      preset book90            # resolves lane 3.5 | S 12 | L 12 ^90 | S 16  (hand default L, §2)
lines:
  good:    ride entry=34
  bad:     mistake premature
occluders: hedge inside c1 -4x18 margin=1.5 depth=5     # the bush
           vehicle oncoming exit:c1 +8                  # the SUV
view:      mode=diagram window=auto
note:      "Premature Initiation"
```

Resolution walk-through (station numbers indicative, pinned by test not prose):
`c1` spans s = 12 → 30.85 (arc 18.85 m). Under right-hand traffic on a
left-hander the rider's own lane is the **outside** lane, so `f = 0` (inside
usable edge) lies against the centreline — both lines' emergent apexes draw on
the double-yellow exactly as the book's rings do. The oncoming lane is the inside
half of the carriageway; `vehicle oncoming exit:c1 +8` puts the SUV footprint
centre ≈ 1.75 m across the centreline at s ≈ 38.9 — on the exit leg, facing
`−s`. The hedge blocks turn-in-station rays across the inside; as each line's eye
advances, the ray clears the hedge and the SUV footprint becomes the blocking (or
first-seen) object. Expected recorded story: `bad`'s early turn-in (≈ 10 m early — the kind's
`early_by_m` default)
yields `hazard_visible` at a later station than `good`'s (or not at all before
its runoff), and `bad` runs wide across the **outer** edge (`f > 1` = off-road on
a left-hander) — the book's red line, not an oncoming-lane excursion. The figure
needs zero placement arithmetic from the author: two occluder tokens, both
hand-relative.

#### 1.5 Placement

- 03 §4: replace the `vehicle` table row ("discrete rectangle (parked or
  oncoming-lane vehicle)" → the two placement forms, defaults, optical-only
  note); extend the placement-grammar paragraph with the vehicle token above;
  add the `hazard_visible` paragraph to §5.3's recording contract.
  Contradicted sentence: none — this fills the lateral-placement hole the review
  confirmed (the grammar "gives the vehicle rectangle no lateral placement rule
  at all").
- 05 §5: add `hazard_visible` to the event-kind vocabulary.
- 01 §6: the fig 8.1 equivalence sentence regains the vehicle ("occluder +
  vehicle + two lines + per-line sight rays") — it currently drops it silently.

---

### 2. Handedness (review §8.8)

#### 2.1 The decision

**Adopt `hand=L|R` on preset invocation, set every preset's default hand to its
book figure's ink, and keep G7's parity criterion strict (no mirrored-parity
carve-out).** The review offers three routes (mirror the presets / add `hand=` /
relax G7); this takes the first two together and rejects the third, because the
machinery the review itself celebrates ("hand-independent `f` + hand-resolved
occluder sides: mirroring a whole scene is a one-token change", §10) makes strict
parity *free* — a relaxed G7 would spend design honesty to save one table column.
Corollary, stated here and enforced in §4: **ViewSpec never mirrors.** A drawn
reflection would depict a right-hander for a left-hand simulation — a lie the
disclosure footnote cannot cure. Handedness changes are physics-level only.

#### 2.2 The mirror transform, precisely

`mirror(roadSpec)` flips every `arc`/`taper` segment's `hand` (L↔R); lengths,
radii, sweeps, lane width, segment order, corner ids, and all station values are
unchanged. Because the road starts at the origin heading `+x`, the world-frame
effect is exactly the reflection across the start axis:

```
x′ = x,  y′ = −y,  psi′ = −psi,  kappa′ = −kappa      (signed quantities negate)
s, t, v, |phi|, f, grip, sight_m, ssd_m               (invariant)
```

What flips and what does not, per vocabulary class:

| Vocabulary | Frame | Under `hand=` mirror |
|---|---|---|
| segment `hand` tokens | — | L↔R (this *is* the transform) |
| occluder `side` `inside`/`outside` | corner-relative | unchanged text, correct placement (sideSign re-resolves) |
| occluder `side` `left`/`right` | rider-relative (rider's left/right in direction of travel — pinned here) | unchanged text, correct placement |
| vehicle `lane` `own`/`oncoming` | traffic-relative | unchanged text, correct placement |
| lane fraction `f` (plans, constraints, `vis_hold_f`) | corridor-relative | invariant |
| raw `d` | rider-relative: **`d > 0` = rider's left of centreline** (pinned here; shared surface with the sample-contract cluster — if they pin the opposite sign the mirror rule follows their convention) | invariant as authored |
| steering direction | per-corner-inferred (dependency: the signed/lifetimed `turn_in` of review §2.1, owned by the corner-exit cluster) | inferred sign follows the corner hand; no plan edit |
| traffic side (§2.4) | global | **does not flip** — `hand=` mirrors the bend, not the traffic law |

Net: a scene authored in the default vocabulary mirrors with **one token and zero
rewrites**. Verdicts, checks, outcomes, and colours are all `f`-domain and
therefore hand-invariant by construction.

#### 2.3 Grammar — all spellings

One **road-ref token** shared verbatim by the scene `road:` line and the `--road`
flag; JSON spells it structured:

```
road-ref  =  "<road DSL>"  |  preset <name> [hand=L|R]
wire      =  { segments: […], … }  |  { preset: "<name>", hand?: "L"|"R" }
```

- `hand` values are exactly `L` or `R` (the DSL's own tokens; case-sensitive).
- `hand=` with the DSL form is rejected `SCHEMA` (`hand_on_explicit_road`,
  message: "spell hands per segment") — the DSL already says it, and a second
  spelling would create a merge rule (the accepted-but-ambiguous class D8
  abolishes). Same rejection for `hand` beside `segments` in the wire object.
- No separate `--hand` flag: the road-ref token *is* the flag spelling. This
  removes a spelling-drift opportunity rather than adding one.
- `schema road-dsl` prints, per preset: the full expansion **at its default
  hand**, the hand default, the suggested entry, and the book figure it matches —
  closing the cold-start gap where mirroring was discoverable only after
  rendering (preset expansions are currently disclosed only in results).

#### 2.4 Traffic side, and `f` on straights and hand flips (folded findings)

Two holes the handedness work exposes, closed here:

- **Traffic side (new normative sentence in 03 §2):** *Right-hand traffic is the
  v1 convention: the rider's own lane lies right of the centreline in the
  direction of travel.* The wire road object reserves a `traffic` field
  (future `"left"`); v1 `validate` rejects it with a typed error naming the
  reservation, exactly like the reserved per-segment width suffix (D8: reserved,
  never silently ignored). Everything downstream (own/oncoming lane resolution,
  `sideSign_own`, P3's "oncoming-lane relations") hangs off this one sentence.
- **Governing corner for `f` (new paragraph in 03 §2, note in 05 §2.1):** `f` at
  station `s` is measured in the frame of the **governing corner**: the corner
  containing `s`; on non-corner stations the nearest corner downstream; after
  the last corner, the last corner. The handoff station is each corner's exit
  boundary `s1`. At a handoff between opposite-hand corners the frame flips:
  `f` re-reads as `1 − f` while `d` is continuous — the recorded per-sample `f`
  carries this documented jump (it is a coordinate re-reading, not motion).
  `rider.start.f` on an entry straight thereby has a defined meaning: measured
  against the first corner.

#### 2.5 Figs 8.1–8.3 resolve book-faithful

With the hand column of §5: `preset book90` expands
`lane 3.5 | S 12 | L 12 ^90 | S 16` — a left-hander. Under right-hand traffic
the rider's lane is the outside lane; apexes (`f≈0`) land on the centreline;
running wide (`f>1`) exits over the **outer** edge into the verge — all three
placements now match figs 8.1–8.3's ink, where the current right-hand preset
mirrored every one of them (and turned run-wide into an oncoming-lane excursion —
a different lesson). Recipe (e), R1–R5, and the shipped fig-08-0x scenes need
**zero new tokens**. `bookBlind`'s occluder line — `hedge inside c1 …` — is
byte-identical before and after the hand flip: the live demonstration that the
side vocabulary is hand-relative.

#### 2.6 Placement

- 03 §2: traffic-side sentence + governing-corner paragraph (replaces the bare
  "`>1` = beyond the corridor (oncoming lane or off-road)" with the resolved
  which-is-which rule: which of `f<0`/`f>1` is oncoming depends on corner hand
  under the traffic convention).
- 03 §3.1: `hand` column added to the preset table (values in §5); grammar note
  for `preset <name> [hand=]`.
- 03 §6: wire road union gains `hand?` on the preset form; `traffic` reserved.
- 04 §7: `road:` key documents the road-ref token.
- 08 §4.1: `--road` documents the road-ref token; `schema road-dsl` content rule.
- 06 §2.5: one sentence noting P1–P6 are stated in `(s,d)` and are therefore
  hand-invariant; no doc changes to colour law.

---

### 3. bookEsses: four corners, link gaps, zero-gap semantics (fig 8.6 row)

#### 3.1 The respecified preset

```
bookEsses = lane 3.5 | S 8 | R 12 ^75 | S 6 | L 12 ^75 | S 6 | R 12 ^75 | S 6 | L 12 ^75 | S 10
            suggested entry 32 km/h · hand default R (first corner — fig 8.6 ink)
            teaches: four linked alternating turns, link straights sized to the
            hand-flip budget (fig 8.6)
```

Changes vs the current row: **3 → 4 corners** (the book draws four alternating
bends; the shipped parity artifact currently drops one full compounding step of
the amplification lesson), **first corner L → R** (the book's first annotated
bend is a right-hander), and **zero-gap → `S 6` links** (§3.2). Radius/sweep stay
`R 12 ^75` (TUNING): width_ratio 7/12 = 0.58 sits inside the book band, and chain
corner speeds (≈ 28–29 km/h, §3.2) stay above the 25 km/h validity floor. The
fig-8.6 simulation agent read the art as ≈ `R 14 ^80`; either is defensible — the
choice is logged as a user decision below. Total length 98.8 m; straight share
36/98.8 = 0.36 ≤ 0.45. The preset table's "zero inter-corner straights" claim is
deleted (it was the feature that contradicted the solver's own budget). The book
road is also full-width with no centreline; whether presets may carry
`use_full_width` rides the road-options mechanism owned by the fig-8.4/8.5
cluster — flagged as an interaction, not resolved here.

#### 3.2 The hand-flip arithmetic (why `S 6`)

Between opposite-hand corners the bike must roll from `+φ_n` through upright to
`−φ_{n+1}`. Distance consumed at speed `v` under the profile roll rate:

```
d_flip(v) = v · (φ_n + φ_{n+1}) / roll_rate        φ_i = atan(v² / (g · r_i))
```

Worked at street profile (`roll_rate = 50 °/s = 0.873 rad/s`), R 12 both sides:

| v | φ each side | flip angle | t_flip | d_flip |
|---|---|---|---|---|
| 7.97 m/s (28.7 km/h — the chain's ≈ 0.70 · reserve target lean, 28.3°) | 28.3° | 56.6° | 1.13 s | **9.0 m** |
| 7.0 m/s (25.2 km/h) | 22.6° | 45.2° | 0.90 s | 6.3 m |
| 6.0 m/s (21.6 km/h) | 17.0° | 34.0° | 0.68 s | 4.1 m |

Part of `d_flip` is absorbed inside the arcs: corner *n*'s unwind may begin
before its geometric end and corner *n+1*'s doctrinally delayed turn-in sits
past its geometric start — **dependency: the unwind-onset and turn-in-lifetime
semantics are owned by the corner-exit cluster (review §2.1); this section
assumes ≥ 3–4 m of in-arc absorption at chain speeds and uses their profile roll
rate for all arithmetic.** Residual needing road ≈ 5–6 m ⇒ `LINK_GAP_M = 6`
(TUNING; re-tune when the unwind semantics land). In diagram mode `C_STRAIGHT`
compresses each 6 m link to 1.2 m drawn — the figure still *reads* as continuous
esses, the book's ink, while the physics gets honest transition length. A second
benefit: with `S 6` links the chain solves at ≈ 28–29 km/h, clear of the D3
sub-25 km/h validity boundary that true zero-gap forces speeds toward.

#### 3.3 Zero-gap semantics (authored roads keep the right)

Adjacent opposite-hand arcs remain **legal grammar** — the preset moves, the
capability stays. Handling is by the existing chain machinery, not a new
predicate: an infeasible flip manifests as lost containment at the head of
corner *n+1*, which the ascending decel scan answers by slowing — and slowing
shrinks *both* factors of `d_flip` (lower `v` directly, lower `φ` through
`v²/gr`), so a contained solution always exists at *some* speed. The new
specification is the floor: when the scan reaches the validity boundary
(`v_valid_min_ms = 7.0` ≈ 25 km/h — MERGED: runwide-physics' derivation-backed constant is the single validity boundary; `SPEED_VALID_MIN_KMH` is deleted) without containment,
`chainedSolve` returns `NO_SOLUTION` with sub-reason **`link_flip_infeasible`**
carrying `{link: "c2->c3", d_flip_m, window_m, v_floor_kmh}` — the formula above
is used to *diagnose* (name the link and the shortfall), never to generate;
physics stays the validator. Turn-in anchors for chain corners must be allowed
to range across the link and into the previous arc's tail (dependency on the
solver cluster's corner-relative bracket respec).

#### 3.4 A-CHAIN-VIS reconciled

The current test text ("holds `vis_hold_f` ahead of each blind corner") contradicts
04 §6's own budget-limited-hold carve-out on short links. MERGED OWNERSHIP: 09 owns
the final test pair — verification's `A-CHAIN-VIS-FULL` (runs on `fx-esses-blind`
below, which subsumes and retires `F-CHAIN-VIS-GAPPED`) and `A-CHAIN-VIS-BUDGET`
(runs on the named ZERO-GAP bookEsses variant this section defines for
`A-LINK-FLIP`, since the preset itself is now gapped) — both asserting
solver-refit's reached-f (actual-position) hold rule and the assertion below.
This section's replacement text survives as the FULL member's body:

> `A-CHAIN-VIS-FULL` (acceptance) — on the named blind-esses fixture
> **`fx-esses-blind`** (`bookEsses` + `hedge inside cN 0x12 margin=1.5 depth=4`
> for N = 1..4), `chainedSolve` with `vis=cautious` returns a line that
> (i) passes `stop_within_sight` at every station of the chain — V1 is
> unconditional; and (ii) ahead of each blind corner holds lane fraction
> `min(vis_hold_f, f_reach(link_n))` until that corner's release station, where
> `f_reach` is the budget-limited achievable hold of 04 §6's carve-out — and the
> *recorded* hold equals the carve-out's computed value, never silently less.

Two notes for neighbouring clusters: on alternating esses the geometry itself
does most of V2's work (corner *n*'s inside ≈ corner *n+1*'s outside — the
apex-to-hold flow *is* the book's "flows smoothly from turn to turn"), and the
vis-fixpoint oscillation risk on exactly this fixture is the solver cluster's
review-§4 item — the fixture named here is the one their bounded-heuristic
reframe should be verified against.

#### 3.5 Placement

- 03 §3.1: the preset row (§3.1 above); delete "zero inter-corner straights".
- 04 §5: add the flip-budget paragraph (§3.2 formula + `LINK_GAP_M`) and the
  `link_flip_infeasible` floor rule (§3.3); this augments — does not replace —
  the ascending-decel-scan text.
- 09 §3.5: A-CHAIN-VIS replacement (§3.4) + the `fx-esses-blind` fixture
  definition; R4's prose gains the 4-corner road.

---

### 4. Portrait multi-corner figures vs the road_ink/aspect gates

#### 4.1 The chosen lever: auto-orientation + aspect-floor padding — the gate itself does not move

Rejected: per-figure gate relaxation with a disclosure placard (it makes the
parity bar configurable — a stretched chain could ship "disclosed", exactly what
06 §6 exists to forbid: "a stretched figure cannot be called done") and cropping
(dropping corners deletes the compounding lesson). Chosen: the projection learns
to *aim the frame*, which is presentation-pure and book-faithful — the book's
chain figure is portrait.

```
ViewSpec.orient?: "auto" | 0 | 90 | 180 | 270     // default "auto" in diagram mode, 0 in true mode
```

- **Mechanism (pure, post-projection, rigid).** Compute the drawn centreline's
  principal axis (least-squares over drawn samples). If the tight drawn bbox's
  long/short ratio ≥ `ORIENT_ELONGATION_MIN = 1.25` (TUNING), `auto` rotates by
  the multiple of 90° that brings the principal axis vertical — chain-shaped
  scenes go portrait like the book — choosing between the two aligned rotations
  the one that puts the line's *start* nearer the frame top (fig 8.6 reads
  top→bottom). Below the elongation threshold, `orient` resolves to 0. Explicit
  numeric values override.
- **No mirror.** There is deliberately no `flip` value: reflection would draw a
  hand the physics didn't ride (§2.1). A request for one is rejected `SCHEMA`
  (`no_view_mirror`, message pointing at `road … hand=`).
- **Invariants.** Rotation is a rigid isometry of drawn space; P1–P6 are
  relations in `(s, d)` and are unaffected — one sentence added to 06 §2.5, no
  new property needed.
- **Aspect-floor padding.** After orientation, if the tight frame's aspect falls
  outside the gate band `[0.55, 1.8]`, the deficient dimension is padded
  symmetrically to the nearest bound (no new constants — the band *is* the
  spec). The label-layout pass places callout boxes preferentially in the
  padding — which is precisely the book's own layout, callouts filling the
  lateral grass. The gate measures the padded frame.
- **Disclosure.** `view.orient`'s resolved value rides the export manifest
  beside `width_exag` etc.; the footnote is unchanged (rotation is not a scale
  statement).

#### 4.2 Worked numbers — the respecified bookEsses passes

Diagram mode, defaults: drawn straights (÷5) 1.6 + 3×1.2 + 2.0 = 7.2 m; arcs
uncompressed 62.8 m; drawn centreline ≈ 70 m. Auto `width_exag` ≈ 1.0–1.1
(width_ratio already 0.58) ⇒ drawn road width ≈ 7.4 m. Tight bbox ≈ 60 × 20 m,
elongation 3.0 ≥ 1.25 ⇒ `orient` = 90° (portrait, entry at top). Aspect 20/60 =
0.33 < 0.55 ⇒ pad width to 0.55 × 60 = 33 m. Gate metrics on the padded frame:
`road_ink` ≈ (70 × 7.4)/(33 × 60) = **0.26** (floor 0.25 — pass);
`straight_share` 7.2/70 = 0.10 (pass); `width_ratio` 0.62 (pass); `frame_aspect`
0.55 (at the floor — pass). Without orientation the same scene lays out
diagonally at road_ink ≈ 0.14 — the confirmed gate failure. Knife-edge margins
are TUNING facts pinned by `A-ESSES-GATE` (§6), not prose.

#### 4.3 Placement

- 06 §2.1: `orient` joins ViewSpec (grammar above).
- 06 §2.4: the padding rule joins the default-camera section; note that
  multi-corner windows aim through `orient`.
- 06 §2.5: the rigid-isometry sentence.
- 06 §2.7 / §7: manifest records `orient`.
- 08 §4.1: `--orient <auto|0|90|180|270>` joins the flag list (view-affecting;
  08 §4.2 flag-over-file precedence), and the scene `view:` key gains `orient=`
  — the standard three spellings of one ViewSpec field (field / scene key /
  flag), keeping bug-sheet 9.8's field↔flag bijection and `A-SCHEMA-SHAPE`
  total over ViewSpec.
- Contradicted text: none deleted; this fills "no authorable lever" with a
  default that needs no authoring at all.

---

### 5. Preset roster for figs 8.1–8.6 (the new `hand` column)

| Preset | Default hand | Expansion at default hand | Book ink |
|---|---|---|---|
| `book90` | **L** | `lane 3.5 \| S 12 \| L 12 ^90 \| S 16` | figs 8.1–8.3 (left-handers) |
| `bookBlind` | **L** (inherits `book90`) | + `hedge inside c1 -6x26 margin=1.2 depth=2.5` — occluder text unchanged | fig 8.1's blind variant |
| `bookDecreasing` | **L** | geometry revision (teardrop sweep, taper-refusal radius) owned by the fig-8.4 work — only the hand default is set here | fig 8.4 (left) |
| `bookEsses` | **R** (first corner) | §3.1 | fig 8.6 (four bends, first right) |
| `bookHairpin` | R (unchanged) | unchanged — no Chapter 8 ink to match; noted in the table | — |
| `bookDoubleApex` | per fig 8.5 ink | **owned by the misjudgment cluster** — referenced here only for the rule: every preset carries a hand default equal to its book figure's ink | fig 8.5 |

No `book90L`-style name variants anywhere: `hand=` subsumes them, and the
default-hand rule means the shipped scenes carry zero hand tokens. These are the
only presets figs 8.1–8.6 need from this cluster.

---

### 6. Contract impact (exact shapes)

- Wire road: `{ preset: "<name>", hand?: "L"|"R" }`; `traffic` reserved-rejected.
- Occluder wire (vehicle member): §1.2 shape; `lane ⊕ f ⊕ side` exclusivity.
- Event vocabulary: + `{ kind: "hazard_visible", s, t, detail: { occluder_id,
  dist_m } }` (05 §5 closed set).
- ViewSpec: + `orient?: "auto"|0|90|180|270`; export manifest `view` record
  gains resolved `orient`; spellings: scene `view:` key `orient=`, CLI
  `--orient` (08 §4.1, §4.3 above).
- `NO_SOLUTION` sub-reasons: + `link_flip_infeasible` `{link, d_flip_m,
  window_m, v_floor_kmh}`.
- Typed rejection reasons added (all under existing codes): `SCHEMA/`
  `vehicle_lane_xor_side`, `vehicle_span_not_allowed`, `margin_requires_side`,
  `lane_requires_vehicle`, `hand_on_explicit_road`, `no_view_mirror`, traffic
  reservation; `OUT_OF_SCOPE/moving_hazards_not_modelled`.
- Sample contract: no new field; `f`'s governing-corner semantics documented
  (05 §2.1 note), `d`'s sign pinned rider-left-positive (proposal — sample
  cluster owns the final say).
- Constants: `LINK_GAP_M = 6 m` (preset TUNING), `ORIENT_ELONGATION_MIN = 1.25`
  (TUNING); ~~`SPEED_VALID_MIN_KMH`~~ DELETED by the merge — the single validity
  boundary is runwide-physics' `v_valid_min_ms = 7.0` (displayed ≈ 25 km/h);
  vehicle `margin_m 0.5` / `len_m 4.5` / `width_m 1.8` (TUNING).

---

### 7. Acceptance for design/09

- **`A-FIG81-VEHICLE`** — on the shipped fig-08-01 scene: both lines emit
  `hazard_visible` for the oncoming vehicle or the mistake line emits none;
  where both fire, `s_good < s_bad`; and at least one retained sample per line
  has its limit point on the vehicle footprint. (Empirically pinned; a pin that
  stops holding is an engine/tuning bug per the oracle's iron rule.)
- **`P-MIRROR`** (property) — for any schema-valid scenario authored without raw
  world-frame values, running `hand=`-mirrored road + identical scene yields:
  identical `s, t, v, |phi|, f, grip, sight_m` series; `(x, y)` reflected,
  signed quantities negated; identical events, outcome, verdict, and colours;
  the drawn top-down equal to the reflection of the original.
- **`G-PRESET-HANDS`** (golden) — each shipped preset's resolved expansion and
  hand default match the §5 table; `schema road-dsl` output carries all three
  disclosure columns.
- **`A-ESSES-GATE`** — the shipped fig-08-06 scene exports diagram-mode with
  gate verdict `pass`; manifest records `orient: 90`; `road_ink ≥ 0.25`; and
  the same scene in `mode: "true"` still lands near the bands (09 §5.3's
  preset round-trip now includes `bookEsses` numerically).
- **`A-LINK-FLIP`** — a zero-gap variant of `bookEsses` (links removed) either
  chain-solves contained at a reduced, recorded speed ≥ the validity floor, or
  returns `NO_SOLUTION`/`link_flip_infeasible` naming the first infeasible
  link; asserted on the named fixture, outcome empirically pinned.
- **`A-CHAIN-VIS-FULL` / `A-CHAIN-VIS-BUDGET`** — the merged pair per §3.4 (09 owns; FULL on `fx-esses-blind`, BUDGET on the zero-gap variant fixture).

---

### 8. Decision drafts (editor numbers them)

1. **Handedness is physical, not presentational.** Presets accept `hand=L|R`
   and default to their book figure's ink hand; the mirror is a road-level
   transform through the existing hand-relative vocabulary (`f`,
   `inside/outside`, `own/oncoming`), so a scene mirrors with one token and
   zero rewrites; ViewSpec offers rotation only, never reflection; G7 parity
   stays strict. *Rationale:* the drawn figure must never depict a hand the
   physics didn't ride, and strict parity costs one table column.
2. **On-road vehicles are first-class sight objects.** `vehicle` gains
   `lane=own|oncoming` (or `f=`) carriageway placement through the shared
   sideSign machinery; the footprint is simultaneously an occluder and a
   recorded sight target (`hazard_visible` event); motion is refused typed
   (`OUT_OF_SCOPE`). *Rationale:* fig 8.1's payoff — the delayed line sees the
   oncoming car sooner — becomes a measured, per-line quantity instead of an
   unplaceable prop.
3. **Chain links carry a physical flip budget.** `bookEsses` becomes four
   corners with `S 6` links sized by `d_flip(v) = v·(φ_n+φ_{n+1})/roll_rate`;
   authored zero-gap chains stay legal, resolved by the decel scan slowing, and
   refused typed (`link_flip_infeasible`) only at the validity floor.
   *Rationale:* the preset stops contradicting the solver's own budget while
   diagram compression keeps the book's continuous-esses ink.

---

### 9. User decisions

| # | Question | Recommendation |
|---|---|---|
| 1 | Flip preset **default** hands to book ink (`book90` becomes a left-hander), or keep current right-hand expansions and require `hand=L` in every book scene? | Flip the defaults. Pre-implementation there is no compatibility cost, G7 parity then holds with zero tokens, and `hand=R` remains one token away. |
| 2 | `bookEsses` links: `S 6` connectors (physics-honest, drawn ≈ 1.2 m under compression) vs a literal zero-gap preset (book-literal geometry, solves ~4–6 km/h slower, brushing the 25 km/h validity floor)? | `S 6`. The book raster itself shows short connecting sections; the drawn result is near-indistinguishable; and the preset should demonstrate the solver's sweet spot, not its floor. |
| 3 | `bookEsses` corner geometry: keep `R 12 ^75` (blessed proportions, in-band width_ratio 0.58) or re-measure to the fig-8.6 agent's `≈ R 14 ^80` art reading (width_ratio 0.5, needs exag ≈ 1.1)? | Keep `R 12 ^75`; both are TUNING, and the blessed arithmetic (§3.2, §4.2) is already worked at 12. Revisit only if the vision judge flags sweep fidelity. |

---

### 10. Shared surfaces touched (for reconciliation)

Occluder wire shape (vehicle member pinned; full audit owned by agent-interface
cluster) · occluder scene-token `<side>` slot (+`own|oncoming` — interacts with
the §9.3 ref-token reconciliation) · event `kind` vocabulary (+`hazard_visible`)
· `NO_SOLUTION` sub-reasons (+`link_flip_infeasible`) · ViewSpec grammar
(+`orient`; explicit **no-flip** rule; CLI `--orient` + scene `view:` `orient=`
— the CLI cluster's 08 §4.1 flag table and `schema view`/`cli` rows follow)
· wire road object (+`hand?` on preset
form; `traffic` reserved) · road-ref token shared by scene `road:` and `--road`
· preset table geometry (affects solver corner-relative constants and 09 §5.3
preset checks) · sample `f` governing-corner semantics and proposed `d` sign
(sample-contract cluster) · A-CHAIN-VIS text + `fx-esses-blind` fixture
(verification and solver clusters) · unwind/turn-in-lifetime dependency
(corner-exit cluster — all flip arithmetic uses their profile roll rate) ·
`use_full_width`-on-presets interaction (fig-8.4/8.5 road-options cluster) ·
`bookDoubleApex` hand-default rule (misjudgment cluster) · `schema road-dsl`
disclosure content (CLI cluster) · 01 §6 fig-8.1 equivalence sentence.
