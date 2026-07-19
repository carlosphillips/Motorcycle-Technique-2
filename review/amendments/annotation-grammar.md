## Marker / Label / Dash / Legend Grammar (annotation-grammar)

> **EDITORIAL RECONCILIATION (binding) — 2026-07-19 editor pass.** Merged against the
> thirteen sibling amendment sections per the three reconciliation audits. Where the
> body below disagrees with a bullet, the bullet wins.
>
> - **This section WINS the mistake-kind rename** (its §5 is the definition site;
>   every sibling respelled in place: `premature` = runs-wide nee `early_apex`,
>   `premature_contained` = eased; `early_apex` gets an `UNKNOWN_ID/renamed_kind`
>   tombstone; the merged enum adds misjudgment's `underread`/`overread`; the merged
>   one-perturbation sentence: exactly one control-channel delta with engine-probed
>   interior values OR one belief, never both).
> - **`release` re-keys** to corner-exit's commitment-release event (emitted on every
>   line with a released `turn_in`); `marks_release_without_vis_mode` is DELETED
>   (it would reject provably effectual input — a D8 violation).
> - **Label features gain `correction` and `run_wide_detect`** (the corrective is a
>   branched shadow — corrective-offroad wins; fig 8.5's "Houston" callout anchors
>   `correction@late`; no second main-line `turn_in` event exists).
> - **Legend words:** quality ∈ `good|caution|failing` (amber tier word renamed —
>   editor homonym fix); outcome ∈ the Option B set `crash|runoff|wide|stopped|
>   contained`.
> - **Apex markers/anchors** read the merged per-touch `apex` events with
>   `detail.index` (misjudgment's hysteresis detector is THE recorder).

Closes: review §1 rows fig 8.1 (dashed-collision), fig 8.2/8.3 (marker floor, callouts), fig 8.4/8.5/8.6 label rows; §6 "Marker/label systems are below the figures' floor", "Role dash law vs the book", "Amber conflates two opposite meanings", "`premature`/`early_apex` inverts the book's vocabulary"; §11 P1 "marker/label grammar extensions (per-line marks, line-addressed callouts)". Grounded against the book rasters: figs 8.1–8.6 draw **all trajectories solid with arrowheads**, only sight lines dashed, markers are hourglass (turn point) and ring (apex) only — **no exit dots anywhere in Chapter 8** — and every callout is addressed to a *line's* feature, frequently with two leader arrows from one box.

Design stance: one event-sourced annotation grammar subsumes five review patches (per-facet hourglasses, per-line marks, line-addressed callouts, two-apex anchors, turn-point labels). Markers and label anchors are two spellings of the same closed feature vocabulary, resolved against the same `Trajectory.events` array that already exists in 05 §5. Nothing here adds computation — only addressing.

---

### 1. Markers: event-sourced, per-line, closed classes

#### 1.1 The marker-from-event law (new, normative — 06 §3.1 stage 9)

> **A marker is the glyph of an event.** For each line, the renderer draws one glyph per trajectory event whose kind maps to an enabled marker class. There is no other marker source; a marker with no underlying event cannot exist, and a line with six `turn_in` events draws six hourglasses.

| Marker class | Glyph (carried/new) | Source event kind(s) | Notes |
|---|---|---|---|
| `turn_point` | hourglass (carried) | every `turn_in` event | `fifty_pence` compiles one `turn_in` per facet → one hourglass per steering input (fig 8.3's device) |
| `apex` | ring (carried) | every `apex` event | one per touch once the two-touch verdict extension lands (fig 8.5 cluster) — `apex#2` anchors and second rings come for free |
| `exit` | dot (carried) | the `exit` event | absent when the line never regains exit heading — an empty set is the honest render |
| `release` | outward double-chevron `»`, stroke-only (new; presentational) | the `release` event — MERGED: corner-exit's steering-commitment release, emitted on EVERY line with a released `turn_in` (not a vis-only artifact; the V2 hold-release is the verdict field `sight.holds[].hold_release_s`, never an event) | exists wherever a commitment released; an empty match on an unreleased line is the honest render |

There is deliberately **no `facet` class**: facets *are* `turn_in` events. This resolves the fig 8.3 "per event or per line?" ambiguity and the fig 8.5 "markers: events or verdict?" ambiguity in one sentence (markers are event-sourced, verdicts are never a marker source).

#### 1.2 `MarkSpec` — one value language, three spellings

```
MarkSpec   := "auto" | "all" | "none" | class-list
class-list := <class> ("," <class>)*          # 1..4 distinct classes; the "only" form
class      := turn_point | apex | exit | release
```

| Surface | Spelling | Scope |
|---|---|---|
| Scene text, figure level | `marks: turn_point,apex` (top-level key, carried position) | default for every line |
| Scene text, per line | `marks=turn_point` key on any `lines:` entry | that line only |
| Wire JSON (Figure / FigureSpec) | `"marks": "auto" \| "all" \| "none" \| ["turn_point", …]` on the figure and optionally on each line entry | as above |
| CLI | `--marks "<MarkSpec>"` on `run`, `scene`, `render` (view-affecting; obeys 08 §4.2 flag-over-file precedence) | figure level; per-line values ride scene text or FigureSpec JSON |

**Effective marks per line** = the line's own `marks` if present, else the figure's, else `auto`.

#### 1.3 Semantics (defaults preserve current behaviour)

- `auto` (default, carried): lines with role `ideal` draw **all classes**; every other line draws none — exactly today's "good-line marks".
- `all`: every line draws all classes.
- `none`: no markers on the affected scope.
- class list: the affected scope draws **exactly** those classes, all lines (figure level) or that line (line level). The list is exhaustive over a closed 4-class world, so per-class *off* is omission — no `+`/`-` modifier grammar is needed.

#### 1.4 Coincident-marker collapse (fig 8.2's shared turn point)

After projection, markers of the **same class** whose true stations lie within `MARK_COINCIDE_EPS_M = 1.0 m` (TUNING) and whose drawn positions overlap within one glyph radius collapse to **one glyph**, drawn in the colour of the owning line drawn **last** in the role draw order (`reference → alternative → mistake → ideal`, so ideal wins ties) — deterministic, never a Z-fight. Markers of different classes never collapse. Note for scene authors: the book's fig 8.2 paints the shared turn point **red**; the shipped fig 8.2 scene therefore uses per-line marks (`good: … marks=none`, `slow: … marks=turn_point`) rather than relying on collapse, which would surface green.

#### 1.5 Validation (typed, D8)

- Unknown class, duplicate class in a list → `SCHEMA`, `schema_ref: "scene#marks"`.
- ~~`marks_release_without_vis_mode`~~ **DELETED by the merge**: under corner-exit's definition `release` is emitted on every line with a released commitment (any line with a `turn_in`), so the rejection would refuse provably effectual input — itself a D8 violation. `release` marks are legal on any line; a class that matches zero events at bake draws nothing and is noted in the bake report — data-dependent emptiness is honest, not ineffectual.
- `marks` is otherwise a **presentational field**: it belongs to the declared presentation-exempt category of the D8 conformance table (covered by render-diff effectuality, not physics effectuality — see the lens-verification fix; this section supplies the carve-out list entry).

#### 1.6 Worked figures

Fig 8.3, book-exact (hourglasses on both lines, none else):
```
marks: turn_point
```
Fig 8.3, mistake-line-only variant (the review's literal ask):
```
lines:
  good: ride entry=34 marks=none
  bad:  mistake fifty_pence:facets=6,early_by_m=10 marks=turn_point
```
Fig 8.2 (exactly one red hourglass): per-line form of §1.4. Fig 8.6 (turn points + apexes on both lines, every corner, no dots): `marks: turn_point,apex`. Fig 8.1: `marks: turn_point,apex`.

---

### 2. Labels: one canonical line-addressed anchor grammar

#### 2.1 Grammar (scene text; the single canonical form)

```
label-entry  := anchor-group (" + " anchor-group)* SP quoted-text
anchor-group := anchor [SP ("+"|"-")<metres>]                 # per-anchor offset
anchor       := road-anchor | line-anchor
road-anchor  := ("entry"|"mid"|"exit") ":" <cornerId> ["@" <lineName>]     # carried, + optional line attach
line-anchor  := feature [":" <cornerId>] ["#" <n>] "@" <lineName>
feature      := turn_point | apex | exit | release | correction | run_wide_detect
                | end | sight_ray                                         # closed (merged:
                # correction and run_wide_detect added so fig 8.5's callouts anchor on the
                # main-line corrective bookmarks under the branched-shadow law)
```

- Line names must match `^[A-Za-z_][A-Za-z0-9_-]*$` (`SCHEMA` otherwise) so `#` and `@` never collide with a name.
- **Precedence rule for the one overloaded head:** `exit` **with** `@` is always the event feature (the line's `exit` event); `exit:c1` **without** `@` stays the carried road anchor (corner-end station). `entry`/`mid` are road-only heads; `turn_point`/`apex`/`release`/`end`/`sight_ray` are feature-only heads.
- **Default line:** a feature anchor with no `@lineName` resolves against the figure's **first `ideal`-role line** — this generalises and preserves the carried `apex:<id>` sugar (`apex:c1` ≡ `apex:c1@<first ideal>`); if the figure has no ideal line the anchor is a typed error (§2.4). The canonical, recommendation-level form is always line-qualified.
- Up to `LABEL_MAX_ANCHORS = 3` (TUNING) anchor groups per label, joined by `+` — one label box, N leader lines (fig 8.3 "multiple turn points" and fig 8.4 "double-apex line" both need 2). More → `SCHEMA`.

#### 2.2 Feature → source mapping (same closed world as markers, plus two)

| feature | resolves to |
|---|---|
| `turn_point` | a `turn_in` event on the named line |
| `apex` | an `apex` event (per-touch once the fig 8.5 extension lands) |
| `exit` | the `exit` event |
| `release` | the `release` event (the commitment release — every line whose `turn_in` released) |
| `correction` | the `correction` event (corrective shot-start bookmark on the main line; the main line never bends back) |
| `run_wide_detect` | the `run_wide_detect` event (first bracketed outward f-crossing) |
| `end` | the line's terminal sample (`trajectory.terminated.{s}`) — always exists; the anchor for "runs wide"-style callouts on runoff lines (endpoint semantics owned by the off-road-termination cluster) |
| `sight_ray` | the midpoint of the sight ray drawn for that line (eye→limit-point segment, projected) — makes fig 8.1's "sight lines" callout expressible; no-match when the figure draws no rays (§3.2) |

#### 2.3 Resolution rules

1. **Static pass (`scene --check`, no solving):** syntax, feature spelling, anchor-count cap, known line names, known corner ids. Event existence is *not* checked here — it is emergent.
2. **Post-run pass (bake/render):** collect the named line's events of the mapped kind; if `:cornerId` present, filter to events whose `corner_id` matches; order ascending by `s`; apply `#n` (1-based). No `#n` and exactly one match → resolve; the offset (true path-metres along **that line's own path**, signed) shifts the anchor point; the leader attaches to the line's projected sample at the resolved station. Road anchors without `@` keep the carried behaviour (leader to the road centreline point); with `@lineName` the leader attaches to that line's sample at the anchored road station (`mid:c1 +3 @bad` — arbitrary-station line attachment).
3. Leader endpoints are subject to the same projection guarantee as markers: they land on the owning line's drawn image, never in empty space (`P-PROJ-LEADER`, §8).

#### 2.4 Typed errors (no new top-level codes; sub-reasons, the `NO_SOLUTION`/`constraint_unmet` pattern)

- `UNKNOWN_ID` / sub-reason **`anchor_no_match`** — zero matching events (feature never occurred on that line/corner; `#n` beyond count; `sight_ray` with rays off; feature default used with no ideal line). `detail` lists the line's available features with counts and stations, so the fix is one edit.
- `UNKNOWN_ID` / sub-reason **`anchor_ambiguous`** — more than one match and no `#n`. `detail` lists candidate stations and the `#n` spellings that would select each. Ambiguity is data-dependent (event counts are emergent), which is why it is not `SCHEMA`.
- `UNKNOWN_ID` (plain, existing semantics) — unknown line name or corner id.
- Both sub-reasons surface at bake with exit 2 and a `schema_ref: "scene#labels"`.

#### 2.5 Wire shapes (pinned — closes "labels shape never pinned")

```
Label  = { text: string, anchors: Anchor[] }          # 1..3
Anchor = { kind: "road", ref: "entry"|"mid"|"exit", corner_id: string,
           offset_m?: number, line_id?: string }
       | { kind: "line", feature: "turn_point"|"apex"|"exit"|"release"|"correction"|"run_wide_detect"|"end"|"sight_ray",
           corner_id?: string, n?: integer >= 1, line_id?: string,   # absent ⇒ first ideal line
           offset_m?: number }
```
`Figure.labels?: Label[]` (03 §8) and identically on `FigureSpec` (05 §8.1). Scene text is sugar compiling to this; the FigureSpec JSON door (agent-interface cluster) gets these shapes for free.

#### 2.6 Every book callout, written out

Fig 8.1 (lines `good`, `bad`):
```
labels:
  apex@good         "delayed apex"
  apex@bad          "early apex"
  turn_point@good   "delayed turn point"
  turn_point@bad    "premature turn point"
  sight_ray@good + sight_ray@bad   "sight lines"
```
Fig 8.3 (lines `good`, `bad` = fifty_pence, facets=6) — all four callouts:
```
labels:
  end@bad -4            "fifty-pencing line runs wide"
  end@good -4           "single-steer line exits tight"
  turn_point#3@bad + turn_point#4@bad   "multiple turn points"
  turn_point#1@bad      "fifty pencing is almost always associated with premature initiation"
```
Fig 8.4 (lines `single`, `double`) — all five labels:
```
labels:
  turn_point#1@double   "double-apex turn point 1"
  turn_point#2@double   "double-apex turn point 2"
  turn_point@single     "single-apex turn point"
  apex@single           "single-apex line"
  apex#1@double + apex#2@double   "double-apex line"
```
Fig 8.5 (lines `good`, `late` — the shipped `fig-08-05.scene` roster; the misjudgment cluster's §6.1 is the definition site for the shipped scenes): `apex:c1@good "apex 1"`, `apex:c3@good "apex 2"`, `apex:c1@late "typical late apex"`, `correction@late "Houston, we have a problem"` (MERGED: under the branched-shadow law no second `turn_in` event exists on the main line — the callout anchors on the `correction` shot-start bookmark; an authored `turn_point#2@late` is a typed error, `UNKNOWN_ID`/`anchor_no_match` per §2.4 with `detail` listing the line's one `turn_in` — the label grammar defines no anchor fallback), `correction@late +8 "yikes! braking and increasing lean"` (per-anchor spaced offset, §2.1).
Fig 8.6 per-corner: `turn_point:c1@bad "early turn point"`, `apex:c2@good "delayed apex"`, etc. — the `:cornerId` filter is exactly the multi-corner disambiguator.

---

### 3. The ink grammar (replaces the role dash law)

#### 3.1 The rule (normative; replaces 06 §5.2's dash table)

> **Dash is reserved for non-trajectory ink and the `reference` role. Every trajectory ends in an arrowhead; no annotation stroke carries one.**

| Ink | Stroke | Arrowhead |
|---|---|---|
| trajectory, role `ideal` | solid, `W_IDEAL = 3.0 px` | yes |
| trajectory, role `alternative` / `mistake` | solid, `W_LINE = 2.2 px` | yes |
| trajectory, role `reference` | dotted `DOT_REF = "1.5 3"`, `W_REF = 1.6 px` | yes |
| sight ray | dashed `DASH_SIGHT = "6 4"`, `W_RAY = 1.2 px`, opacity `RAY_ALPHA = 0.45` (subsumes the carried "reduced opacity"), verdict colour of its line | no — terminates at the limit point |
| label leaders | solid `W_LEADER = 0.9 px`, neutral ink (carried neutral-palette rule extended to annotation) | no |

All widths at the nominal 1000 px frame, all TUNING. **Resulting disambiguation rule for fig 8.1** (stated because the review asked for it): solid + arrowhead = a ridden line; dashed + thin + semi-opaque + no arrowhead, ending at a chevron-free limit point = a sight ray; dotted + arrowhead = the demoted reference baseline (not a book device; never appears in book-parity scenes). The red premature path and its red sight ray can no longer be confused, and book parity is the *default* — no toggle.

Role's accessibility channel moves from dash to **legend text + stroke-width tier + marker set** (the review's preferred fix). Colour stays verdict-only (D9 untouched).

**Deviation note:** the review floated an alternative — `dash=off` as a book-parity style toggle. Rejected: a toggle makes the same figure render two ways (two readings to verify, two vision-judge passes), and the dash/ray collision exists in the viewer too, not only in exports. Reserving dash once, unconditionally, is one mechanism instead of a mode.

#### 3.2 Sight-ray trigger (kills the 06 §3.1 vs 08 recipe (e) contradiction)

Normative rule in 06 §3.1 stage 7: **sight rays render iff the figure has ≥ 1 occluder.** Default: one ray per line, anchored at that line's **first** `turn_in` event (pinning the multi-turn_in default the fifty_pence line otherwise explodes). Override: `rays = auto | off | all_turn_ins` — ViewSpec field, scene `view:` key, CLI `--rays`. 08 recipe (e)'s parenthetical becomes a citation of this rule instead of a contradiction of it.

---

### 4. The legend: verdict-word + role (amber disambiguation)

#### 4.1 Exact format (06, new §5.3; rendered by draw stage 11 beside the disclosure footnote)

One row per line, draw order, machine-derivable:

```
legend-row := <swatch> SP <name> " — " <role> " · " <quality> [" (" <outcome> ")"]
quality    := "good" | "caution" | "failing"            # 06 §5.1's merged words (D11)
outcome    := appended iff quality ≠ "good": the verdict outcome word
              (contained | wide | runoff | crash | stopped)  # the Option B set;
                                                             # "contained" appears on
                                                             # contained-with-failed-checks
```

`swatch` = an 18×3 px sample of the line's exact stroke (verdict colour, role width, pattern, arrowhead), so the legend doubles as the style key. Worked example — the two ambers a student must distinguish:

```
▬▶ bad   — mistake · caution (contained)      ← an error you got away with
▬▶ wide  — alternative · caution (contained)  ← a sound strategy, contained by design
▬▶ good  — ideal · good
```

Colour still means exactly one thing (verdict, D9); *role* is now read from the legend, which is precisely where the two meanings of amber separate.

#### 4.2 When it renders

ViewSpec/scene/CLI: `legend = auto | on | off` (default `auto` = render whenever the figure has ≥ 2 lines **or** any line's quality ≠ `good`). Under the ink grammar the legend is the primary role channel, so `auto` keeps it present exactly when role matters.

#### 4.3 Manifest record (mechanical check surface)

The per-figure export manifest record (06 §7) gains `legend: [{line_id, role, quality, outcome}]` — the amber disambiguation becomes assertable in CI (§8), not hoped for in pixels. Book-figure parity language in 06 §7 is amended: *equivalence is judged modulo margin chrome (disclosure footnote, legend) and the reference role's dotting.*

---

### 5. The rename: `premature` / `premature_contained`

**Chosen mechanism: two kinds** (not one kind with a `commit:` parameter). Grounds: the mistake oracle pins **one outcome class per kind** — a commit parameter would make the pin conditional on a param value, complicating the oracle and the teaching table; and the kind *name* is the schema surface agents pick from cold (the review confirmed the teaching table works) — `premature` vs `premature_contained` self-disambiguates without the 01 §4.3 "naming trap" footnote. Judged not genuinely contested: the review's primary direction, the book's own vocabulary, and oracle simplicity all point the same way.

#### 5.1 New kind rows (03 §7.1 table; `early_apex` is removed from the closed set — it never ships)

| Kind | One-channel perturbation (defaults, TUNING) | Tier 1R outcome (pinned per-kind on a named fixture) | Book mapping |
|---|---|---|---|
| `premature` | the solved `turn_in` action is replaced by one placed `early_by_m = 10` earlier whose target is the **committed** lean: the largest inside-kissing lean for that early station, **derived by engine probe** (bisection over lean against the emergent inside clearance — reuses solver machinery; optional author override `lean_deg?`) | `runoff` | fig 8.1's red line — the book's own words, "premature turn point": turned in too soon, runs wide |
| `premature_contained` | same single replacement, target stays `tangent_inside` (`early_by_m = 10`) — the solver-eased early entry | `contained` (+ mandatory `late_apex` fail; `out_in_out` expected in practice, never a pin) | the early turn-in a rider gets away with on street reserve |

#### 5.2 The one-perturbation rule, restated at channel granularity (03 §7, replaces "exactly one control perturbed")

> **A mistake is exactly one control-channel delta:** the compiled plan differs from the base plan in precisely one channel — steering actions, longitudinal actions, position actions, or a rider rate cap (wire field `rider.roll_rate_cap_dps`, 03 §6.1 — `slow_steer`'s compiled form; agent-interface §1's wire-closure rule) — as **one contiguous replacement**. Values *derived inside* the replacement (the probed committed lean; facet magnitudes) are engine-probed consequences of the delta, never independent author inputs. The good/mistake plan diff therefore isolates one channel, which is what the rule existed to guarantee.

This dissolves the "early station + committed lean is two controls" objection (it is one replaced `turn_in` action; the lean is a consequence of *where* the rider committed) and legitimises `fifty_pence` gaining **`early_by_m = 10` (default; TUNING)**: the solved `turn_in` is replaced by the facet sequence — early first facet + `facets − 1` corrections — still one steering-channel replacement (`facets = 6` is pinned to mean six steering *inputs*, i.e. six `turn_in` events). This is the review's own fig 8.3 fix, absorbed by the restated rule, and it makes fig 8.3's red-starts-earlier-crosses-once topology authorable through the compiler instead of a `plan` escape hatch.

#### 5.3 Ripple (every surface that spells a kind)

- 00 §4 shared vocabulary: closed set becomes `premature` (canonical, runs wide), `premature_contained`, `slow_steer`, `fifty_pence`, `chop`, `overspeed`.
- 01 §4.3: table rows swap; the "naming trap, resolved explicitly" paragraph is **deleted**, replaced by one sentence: *fig 8.1's red line is authored as `premature` — the same words the book prints beside it; the teaching table still states each kind's pinned outcome.*
- 03 §7.1 rows per §5.1; the `premature` vs `early_apex` rationale paragraph is deleted.
- 04 R2/R4 and 08 recipes (b), (d), (e): `early_apex` → `premature` (`--mistake premature`, `premature@c1,c2`); recipe (e)'s naming-trap parenthetical deleted.
- 08 §5.1 mistakes teaching table rows renamed; 09 §4 oracle kind list renamed.
- Fig-kind mappings: fig 8.1 red = `premature`; fig 8.2 = `slow_steer` (unchanged); fig 8.3 red = `fifty_pence` with `early_by_m` (§5.2); fig 8.6 chained = `premature@all_corners`.
- Outcome-pin *fixtures* (which named road each pin is asserted on) are owned by the oracle/outcome-reconciliation cluster; this section fixes only names and classes.

---

### 6. Placement map

| Piece | Lands in | Replaces / contradicts |
|---|---|---|
| Marker-from-event law, classes, glyphs, collapse rule | 06 §3.1 stage 9 (rewrite) | "Markers — carried vocabulary: hourglass…ring…dot; each inherits its line's colour" |
| `MarkSpec` + defaults + validation | 03 §8 (new sub-block "Marks") + 04 §7 scene grammar | 03 §8 "`marks` (`auto \| all`) controls turn-point/apex/exit markers"; 04 §7 `marks: auto \| all` line |
| Label grammar, feature vocabulary, resolution, errors, wire shapes | 03 §8 (new sub-block "Labels", owns the shapes) + 04 §7 | 03 §8 "`labels` are corner-relative callouts… always resolves onto the road"; 04 §7 "Label anchors are corner-relative only (…) `apex:<id>` sugar resolved against the good line's solved apex" |
| Ink grammar table + disambiguation law | 06 §5.2 (full replacement) + §3.1 stages 7/8 | the `ideal → solid \| alternative → long dash \| mistake → short dash \| reference → dotted` table; stage 8's per-role dash |
| Sight-ray trigger + `rays=` | 06 §3.1 stage 7 (normative); ViewSpec §2.1; 08 flag list | 06's unconditional "one per selected sample"; 08 recipe (e)'s free-floating condition |
| Legend format, `legend=`, manifest record | 06 new §5.3 + §7 manifest + ViewSpec | 06 §5.2's "legend text" hand-wave; §7 parity sentence amended |
| Rename + one-channel rule + `fifty_pence.early_by_m` | 00 §4, 01 §4.3, 03 §7/§7.1, 04 §8, 08 §5.1/§6, 09 §4 | every `early_apex` occurrence; 03 §7 "exactly one control perturbed" sentence |
| `--marks`, `--rays`, `--legend` flags | 08 §4.1 flag list, `render`/`scene` verb rows, `schema view`/`scene` sections | 08's claim set "every field has a flag" (now true for these) |

### 7. Contract impact (exact shapes)

- `Figure.marks?: MarkSpec`, `Figure.lines[i].marks?: MarkSpec`; `Figure.labels?: Label[]` — shapes in §1.2/§2.5; mirrored on `FigureSpec` (05 §8.1).
- `ViewSpec += { rays?: "auto"|"off"|"all_turn_ins", legend?: "auto"|"on"|"off" }` (06 §2.1).
- Export manifest per-figure += `legend: [{line_id, role, quality, outcome}]` (06 §7).
- Error surface: `UNKNOWN_ID` sub-reasons `anchor_no_match`, `anchor_ambiguous` (the `marks_release_without_vis_mode` sub-reason is DELETED by the merge). No new top-level codes.
- Mistake-kind enum: `early_apex` removed; `premature` re-semanticised; `premature_contained` added. `fifty_pence` gains `early_by_m`.
- No Sample or Verdict field changes. Markers/labels read `trajectory.events` and `terminated` only.

### 8. Acceptance (09 additions)

- `P-MARKS-EVENTS` (property, fuzzed figures): drawn markers ↔ events bijection — every marker corresponds 1:1 to an in-window event of its class's kind on its line; no eventless marker.
- `P-INK-GRAMMAR` (property over rendered SVG): no non-`reference` trajectory carries a dash pattern; every dashed stroke is a sight ray or dotted reference; every trajectory has an arrowhead and no annotation stroke does; no trajectory shares a stroke pattern with any annotation stroke.
- `P-PROJ-LEADER` (extends `P-PROJ-MARKER`): every label leader endpoint lands on its anchored line's projected image (or road centreline for road anchors).
- `A-FIG82-SINGLEMARK`: the fig 8.2 scene renders exactly one hourglass, red, at the shared station.
- `A-FIG83-MARKS`: fig 8.3 scene with `marks: turn_point` — green line exactly 1 hourglass, fifty_pence line exactly `facets` hourglasses, zero rings/dots.
- `A-FIG83-TOPOLOGY` (oracle fixture pin): `bad`'s first `turn_in` station < `good`'s; exactly one crossing inside the corner window (P4 guarantees it survives projection).
- `A-LABEL-ANCHORS`: the §2.6 label sets for figs 8.1/8.3/8.4/8.5 all resolve on their fixtures (8.5 on the shipped `fig-08-05.scene` roster `good`/`late`, including the `correction@late +8` spaced-offset anchor); leader endpoints pass `P-PROJ-LEADER`.
- `A-ANCHOR-ERRORS`: `turn_point#7@bad` (facets=6) → `UNKNOWN_ID`/`anchor_no_match` listing six candidates; `apex@double` on a two-touch line → `anchor_ambiguous` listing both stations with `#n` spellings.
- `A-LEGEND-AMBER`: a fixture with a contained `mistake` line and a contained `alternative` line renders two amber rows whose role words differ; manifest `legend` records match each line's verdict.
- Marker-collapse golden: two lines sharing a turn-in with both marked → one glyph, topmost-draw-order colour.
- Oracle re-pin rows: `premature → runoff`, `premature_contained → contained (+ mandatory late_apex fail)` (per-kind, named fixtures owned by the oracle cluster).

### 9. Decision drafts (editor numbers them)

1. **Mistake kinds speak the book's words.** `premature` is the canonical runs-wide error (replacing `early_apex`); `premature_contained` is the eased variant; the one-perturbation rule is restated as one control-channel delta with engine-probed interior values. Rationale: the book's caption vocabulary is the tool's kind vocabulary; per-kind oracle pins stay one-class-per-kind; the schema teaching table self-disambiguates without a documented trap.
2. **Ink grammar v2: dash is annotation ink; the legend is the role channel.** All non-reference trajectories draw solid with arrowheads; sight rays are the only dashed ink (occluder-triggered); role reads from stroke-width tier + a legend that prints `role · quality (outcome)`, disambiguating amber's two meanings. Supersedes 06 §5.2's role-dash law. Book parity becomes the default rather than a mode.
3. **Annotations are event-sourced and line-addressable.** Markers are glyphs of events (closed classes `turn_point|apex|exit|release`, per-line `MarkSpec`); label anchors are one closed feature grammar (`feature[:corner][#n]@line ±m`, multi-leader) resolved against the same events, with typed `anchor_no_match`/`anchor_ambiguous` failures. One grammar across scene text, CLI, and JSON.

### 10. Interactions (shared surfaces touched — for reconciliation)

- **Mistake-kind enum** (00 §4 / 01 §4.3 / 03 §7.1 / 04 §8 / 08 §5.1+recipes / 09 §4): `early_apex` removed, `premature` re-semanticised, `premature_contained` added, `fifty_pence.early_by_m` added — every cluster that spells a kind must follow.
- **Event kinds as annotation source**: consumes `turn_in`, `apex` (per-touch, detail.index — the merged hysteresis detector), `exit` (lean-unwind cluster makes it reliably exist), `terminated.{s,x,y}` (off-road-termination cluster pins runoff endpoints for `end@`), the `release` event (MERGED: corner-exit's commitment release, emitted on every committed line), and the `correction`/`run_wide_detect` bookmarks (corrective-offroad's shadow law).
- **Corrective-shot cluster** (RESOLVED): the salvage is a branched shadow — no second main-line `turn_in` event exists; fig 8.5's callout anchors `correction@late`, and an authored `turn_point#2@late` errors `UNKNOWN_ID`/`anchor_no_match` (§2.4). The label grammar defines no anchor fallback.
- **Error vocabulary**: sub-reasons `anchor_no_match`, `anchor_ambiguous` (under `UNKNOWN_ID`); `marks_release_without_vis_mode` DELETED by the merge (release exists on every committed line).
- **ViewSpec**: new keys `rays`, `legend` (renderer/projection cluster owns ViewSpec's home).
- **FigureSpec/Figure wire shapes**: `marks`, per-line `marks`, `labels` pinned — the FigureSpec-JSON-door cluster inherits them.
- **Export manifest**: `legend` array added to the per-figure record.
- **CLI flags**: `--marks`, `--rays`, `--legend`; `schema` sections `scene`/`view` updated.
- **D8 conformance table** (verification cluster): `marks`/`labels`/`legend`/`rays` enter the declared presentation-exempt category, covered by render-diff tests.
- **Quality words** — MERGED: `good|caution|failing` (the amber tier word renamed from `contained` to `caution`, the editor's homonym fix, since Option B DID mint the `contained` outcome value); outcome words are the Option B set `crash|runoff|wide|stopped|contained`. Legend rows print quality + outcome independently — e.g. `mistake · caution (contained)`, `mistake · failing (runoff)` — and `A-LEGEND-AMBER` asserts the two amber meanings separate on those words.
- **09 test ids** added: `P-MARKS-EVENTS`, `P-INK-GRAMMAR`, `P-PROJ-LEADER`, `A-FIG82-SINGLEMARK`, `A-FIG83-MARKS`, `A-FIG83-TOPOLOGY`, `A-LABEL-ANCHORS`, `A-ANCHOR-ERRORS`, `A-LEGEND-AMBER`.
