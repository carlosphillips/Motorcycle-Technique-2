# Figure Authoring & the Scene-Baking Pipeline

How doctrine-correct course figures are *generated* rather than drawn. This document
covers the v2 authoring contract, the inverse solve that turns a road plus a turn-in
into a validated line, the mistake compiler, the road DSL, the `.scene` source format,
and the bake/stamp workflow that lands a compiled figure inside a chapter's HTML. The
underlying physics engine those tools drive is described in document 09; here the engine
is treated as a black-box **validator**.

---

## 1. The thesis: physics is the validator, not the generator

Every module in the authoring layer (`simulator/author/`) repeats one sentence in its
header: **"physics is the validator, not the generator."** The whole design follows from
it.

An author supplies only *physical inputs*:

- a **road** (geometry — lane width, straights, arcs, tapers),
- a **turn-in station** (where the rider initiates the corner — or `auto`),
- optionally a **brake / throttle intent** or a **mistake perturbation**.

Everything a rider or a diagram actually cares about — the **apex** (station, percentage,
lean), the **exit** (lane fraction, heading), the **run-wide / clean outcome**, the
**speed trace**, the **required lean vs. reserve** — **emerges** from running the real
point-mass simulator on those inputs. None of it is a knob.

### Why no apex input, ever

The course teaches Lee Parks' rule #5: *the turn point is the master decision — apex,
lean, and exit all follow from it.* The authoring layer enforces this **structurally**:
there is **no `apex` field anywhere in the input schema**, and it is grep-provable. The
core engine's `validate` step deliberately **rejects** any `apex:<cornerId>` reference in
a plan, because the apex is unknown until the engine runs. `resolveApexAnchors` in
`solve.mjs` states core "rejects apex refs on purpose."

The payoff: a hand-drawn diagram can place an apex wherever the author *thinks* it should
be, silently mis-teaching the doctrine. A generated diagram cannot — the apex is wherever
physics puts it, so the figure and the doctrine can never disagree.

This replaces the old workflow (hand-drawing SVG paths for cornering diagrams, which
risked geometry/doctrine mismatch) with a compiled pipeline: author writes a `.scene`,
the tool solves it, self-verifies against the engine's own doctrine verdict, and renders
a book-style top-down SVG.

---

## 2. Entry points

### CLI verbs (run from repo root)

`node simulator/cli.mjs` is the single entry point. The authoring-relevant verbs:

| Verb | Purpose |
|---|---|
| `author input.json [--out dir] [--figure path.svg] [--png] [--mistake <spec> …]` | Full pass: solve the line, self-verify, render an SVG figure. |
| `suggest input.json` | Placement-only query — "where should I turn in?" — no figure. |
| `scene file.scene [--out dir] [--stamp chapter.html --fig <id> [--init-guards --replace-svg NN]]` | Bake a `.scene` into SVG artifacts and optionally stamp it into a chapter. |
| `url <file.scene>` (or `--scene <file>`) | Bake and print a live viewer URL carrying the good line's scenario. |

`author` **gates**: a non-clean line exits with code `3`, but it still *draws* the
mistake line so you can see why it failed.

### Library entry points (pure — no fs/process; IO stays at the CLI edge)

```
authorFigure(input) -> { ok, feasible, clean, svg, band, mistakes?, report }   // author.mjs
suggestLine(input)  -> { ok, feasible, clean, band, report }                    // author.mjs
parseScene(text)    -> Result<sceneSpec>                                        // scene.mjs
bakeScene(sceneSpec)-> Result<{ static_svg, animated_svg, receipts, scenario }> // scene.mjs
```

The whole layer bridges into the v1 engine through a **single import** —
`../core/load.mjs` exposing `SIM` — using `SIM.simulate.run`, `SIM.road.compose`,
`SIM.result`, `SIM.scenario.sideSign`, `SIM.config.profiles`, `SIM.physics`. There is
one door into physics, and the author layer never reimplements any of it.

---

## 3. The `author` front-door workflow

`authorFigure(input)` runs the "hand it a road + turn-in, it solves the line and
self-verifies" contract:

1. **`contextOf(input)`** — compose the road (`SIM.road.compose`), resolve the target
   corner, build the rider `profile` (name / entry speed / start lateral offset — the
   sign is resolved automatically via `outerSign`, never hand-computed), and the brake
   start station.
2. **Turn-in resolution** — `input.turn_in === "auto"` (or omitted) calls `suggestTurnIn`
   (place.mjs) to find the latest clean turn-in; otherwise `input.turn_in_m` is used
   directly and passed to `solve()`.
3. **`solve()`** (solve.mjs) — co-solves brake decel + roll-on onset by monotone bisection
   against the real engine, then **re-runs the engine on its own output** to self-verify.
   The `verify` step is always present.
4. **Optional mistakes** — `input.mistakes: [{kind, params}]` are compiled via
   `compileMistake` against the solved good-line context; each is a one-perturbation red
   line.
5. **Optional naive baseline** — `input.naive` runs the same turn-in with a generic fixed
   brake/roll (bracket midpoint), *not* co-solved — the "before" the co-solve improves on.
6. **`renderAuthorFigure()`** (figure.mjs) draws the composed road + solved line(s) to an
   SVG string.
7. **`verdictReport()`** produces the rounded machine verdict (JSON) alongside the SVG.

`suggestLine` is the same context-building path but calls `suggestTurnIn` directly and
returns only report + band — a cheap placement check with no drawing.

---

## 4. The inverse solve (`solve.mjs`)

### What it searches for

`solve(roadSpec, cornerId, turnIn, profile, opts)` co-solves **two near-independent,
monotone controls against two doctrine targets**, both measured off the engine's *own
emergent verdict*:

| Control (the knob turned) | Target metric (read off the engine) | Direction |
|---|---|---|
| brake `decel` | apex `lean_max_deg` = `leanFrac × RESERVE_DEG` | lean **falls** as decel rises |
| roll-on onset `at_s` | exit lane-fraction `exit.f` = `exitTarget` | exit_f **falls** as roll-on moves later |

### Why two independent bisections instead of a joint optimizer

The two controls **decouple**: moving the roll-on onset shifts the apex by **< 1 %** across
the whole sweep. So decel sets apex/speed *first*, then roll-on trims the exit
*independently*. Two sequential monotone bisections (16 iterations each) are simpler,
cheaper, and provably correct given the measured near-independence — a joint solve would
be more machinery for no benefit.

```
bisect(metricOf, target, lo, hi, decreasing, iters = 16)
```

16-iteration bisection that **rails cleanly to a bound** when the target is unreachable
in-bracket; the `decreasing` flag states whether the metric falls as x rises.

### Feasibility probe first (step 0)

Before bisecting, a cheap probe at nominal `decel = 3.0` and mid-band roll asks: does the
line **cut inside** (min lane-fraction `< insideEdgeF`) or is the emergent
`apex_f > probeFeasApexF`? Either failure returns a **typed infeasible result** with a
human-readable reason (turn-in too early cuts inside / too late never reaches inside).

The rationale is doctrinal: **a turn-in placement problem cannot be fixed by braking or
throttle.** Short-circuiting with an honest diagnostic is better than letting bisection
silently converge to a degenerate, misleading line.

### Re-verify step

After bisection, `solve()` **re-runs the engine** on the final solved plan (`out =
run(plan)`) and returns *that* verdict verbatim — "physics validates its own output," not
the bisection's intermediate estimate.

### The four-action rider plan

`makePlan(turnIn, decel, rollAt, opts)` builds exactly four actions — and **no apex
field**; the turn-in is the sole author input, brake and roll are solved:

```
{ id:"brake", at_s: brakeStart,        do:"brake",    decel, taper_to_s: turnIn - brakeGap }
{ id:"turn",  at_s: turnIn,            do:"turn_in",  target:"tangent_inside" }
{ id:"crack", at_s: turnIn + crackGap, do:"throttle", accel: 0 }          // maintenance crack
{ id:"roll",  at_s: rollAt,            do:"throttle", accel: rollAccel }   // drive-out roll-on
```

### Key constants and defaults

```
RESERVE_DEG = phiReserve(0.85) · 180/π   ≈ 40.36 deg   (street reserve: mu 1.0, skill 0.85)
CEILING_DEG = phiMax(1.0)     · 180/π    = 45.0  deg   (physical lean ceiling at mu 1.0)
```

`DEFAULTS` (units where relevant):

| Name | Value | Meaning |
|---|---|---|
| `leanFrac` | 0.70 | target apex lean as fraction of reserve (slow-in doctrine) |
| `exitTarget` | 0.85 | target exit lane-fraction (outside, contained) |
| `brakeGap` | 4.0 m | braking completes this far before turn-in |
| `crackGap` | 8.0 m | maintenance throttle crack this far after turn-in |
| `rollAccel` | 0.4 m/s² | gentle drive-out roll-on rate |
| `decelLo / decelHi` | 2.4 / 3.8 m/s² | realistic street braking bracket (0.24 g – 0.39 g) |
| `rollSpanLo / rollSpanHi` | 35 / 90 m | roll-on onset bracket, relative to turn-in |
| `brakeStart` | 50 m | where braking begins on the approach straight |
| `insideEdgeF` | 0 | inner usable edge lane-fraction; below = clipped inside |
| `probeFeasApexF` | 0.35 | feasibility probe: apex_f above this = turn-in too late |

### `engineRun` — the one engine call

`engineRun(roadSpec, profile, plan, cornerId, extra)` builds a `scenario`
(`spec:"moto-sim/1"`, `road`, `rider`, `config:{mu:1.0, mode:"street", ds_m:0.5,
checks_version:1}`), runs `SIM.simulate.run`, and derives:

- an `sd` channel array `{s, d, f, v_kmh}` per station (`v_kmh` threaded for animation
  timing; inert for static figures and hashes),
- `minF` / `minF_s` — the deepest inside excursion. The engine's own run-wide checks
  (`out_in_out`, `exit_containment`, `detectRunWide`) only bound `f > 1` (the *outside*),
  so this local scan is the **inside-cut** flag,
- `cutsInside = minF < insideEdgeF`.

### `resolveApexAnchors(plan, solved)`

Rewrites any `at.ref === "apex:<cornerId>"` anchor to an absolute `at_s` against the
**solved** apex station (`solved.verdict.corners[i].apex_s`), throwing if no solved apex
exists for that corner. It must run **after** `solve()` and **before** core sees the plan
— core rejects apex refs by design, so this author-layer bridge is the *only* place
apex-relative sugar becomes a resolved station, keeping the "no apex input" invariant
intact even as ergonomic sugar is layered on top.

### The specialized solvers (deliberately separate from `solve()`)

`solve()`'s feasibility probe *by design* rejects any turn-in that isn't in the clean
late-apex band. A geometric line is deliberately pre-ideal and a double apex is
deliberately a planned two-touch deviation — both would fight that gate. So each gets its
**own fixed-plan forward search** rather than weakening the feasibility invariant that
protects the main good-line path.

- **`solveGeometric(...)`** — the AMBER "geometric apex" line (largest-radius arc, turn-in
  *earlier* than ideal, apex near the geometric middle ~50 %). A coarse forward search at
  `ds_m: 1.0` scans turn-in earlier-to-earlier (apex % falls monotonically as turn-in
  moves earlier; containment fails monotonically past the largest-radius arc), picks the
  contained candidate whose emergent apex is closest to 50 %, then **re-verifies at full
  engine resolution** — "a coarse/fine disagreement is a typed error, never a silently-wide
  shipped line." Defaults: `targetApex 50`, `apexLo 45`, `apexHi 58`, `decelLo/Hi 2.4/3.8`.
- **`solveDoubleApex(...)`** — the fixed ch14 double-apex plan (turn-in 1 → crack →
  mid-corner ease to a lower explicit lean → turn-in 2 → roll-on), tagging the corner
  `line_type:"double_apex"` so a second `turn_in` passes the `single_input` check. An
  **ascending decel scan** picks the *gentlest* braking that keeps the whole line contained
  (doctrinal slow-in). Remaining shape deviations (`out_in_out`, `late_apex`,
  `throttle_rule`) are **declared** via `expect_fail` so the verdict reports them as
  EXPECTED, not surprises. (Engine-reality note: the point-mass model can't reproduce the
  book's mid-corner stand-up drift-back — a Tier-2 load-transfer effect — so a contained
  double apex renders as one sustained inside pass with two planned inputs, not two
  separated dips.)
- **`naive(...)`** — the "before" tool: moves only the turn point, keeps a generic rider's
  brake/roll fixed. It is literally "the coupling failure the inverse solve exists to fix."

### Why the search can afford dozens of engine re-runs

`solve()`, `solveGeometric()`, and `suggestTurnIn()` each run the full engine many times
(bisection iterations, coarse scans, re-verifies). This is only practical because
`core/integrate.js` uses a **windowed LUT lookup** for its per-step nearest-station
resolution: once a provable forward-window safe-distance guarantee holds, it replaces the
full O(n) scan with a bounded window (`hint` / `road.window_safe_dist`). It is
**byte-identical** to the full scan on every road (verified by fuzzing with **0
mismatches**), and it made the solve **~8.2× faster** (31 s → 3.8 s; a full `author` pass
69 s → 13.4 s). The speedup lives in core, but the authoring layer's many-run search
patterns are what benefit.

---

## 5. Turn-in placement (`place.mjs`)

`suggestTurnIn(roadSpec, corner, cornerId, profile, opts)` answers "where should I turn
in?" without a full solve per candidate:

- Default target apex `targetApex = 58` (doctrinal late apex).
- A **cheap coarse sweep**: one `engineRun` per candidate turn-in from `corner.s0 − 24` to
  `corner.s0 + 8` in 2 m steps at `ds_m: 1.0` (a full ~34-run `solve()` per candidate had
  caused timeouts). Filters to `!cutsInside`, `minF > -0.2`, `20 < apex_pct < 90` → the
  **band**.
- Ranks the band by `|apex_pct − targetApex|`, full-`solve()`s the top 4, and returns the
  first that verifies clean.
- Returns `{ok:false, band, reason}` if none verify clean, with distinct reasons for an
  empty band vs. a non-clean band.

`sideToD({side, margin_m}, corner, road)` resolves a named lateral position
(`inside`/`outside` relative to corner hand, or `left`/`right` absolute) to a signed
offset via `SIM.scenario.sideSign` — sharing the *one* sign rule with core's static
resolution, so "an author never hand-computes the sign."

---

## 6. Mistake-line generation (`mistakes.mjs`)

### Why mistakes are perturbations, not hand-drawn

A red "mistake" line is not drawn to look wrong — it is the **good line's own solved plan
with exactly one control changed**, forward-run through the same engine. The engine's own
outcome/diagnosis is reported; the compiler **never asserts** what should happen. This
gives two properties a hand-drawn mistake can't:

1. A diff between the good line and the mistake **isolates precisely the intended delta**
   — cause and effect are not entangled.
2. The mistake is wrong *because physics says so*, on the same road, at the same speed —
   so the teaching contrast is real, not staged.

The **one-perturbation rule** was designed to fix a historical confound
(`NEEDS_IMPROVEMENT #6`) where an earlier "chop" mistake also moved the entry line,
entangling cause and effect. Each builder now touches exactly one control, verified by
diff-based tests.

### The mistake kinds

`MISTAKE_KINDS = ["premature", "early_apex", "slow_steer", "fifty_pence", "chop",
"overspeed"]`. Outcomes below are **empirically measured** (pinned by
`tests/mistakes.test.mjs` against two gate roads), never asserted:

| kind | STANDARD ref | one-control perturbation (default) | ch5-ideal outcome |
|---|---|---|---|
| `premature` | §2(1) | turn in `early_by_m = 10` m early (steering target stays `tangent_inside`) | violation / plan_gap |
| `early_apex` | §2(1) | turn in `early_by_m = 5` m early **+ commit** an explicit lean (`deriveKissLean` if `lean_deg` omitted) | runoff / plan_gap |
| `slow_steer` | §2(2) | roll rate × `roll_rate_factor = 0.3` → 15 deg/s (base 50) | runoff / roll_rate_limited |
| `fifty_pence` | §2(3) | single turn-in → `facets = 6` alternating full/back-off (`FIFTY_BACKOFF = 0.5`) partial inputs | runoff / roll_rate_limited |
| `chop` | §4 / Ch.9 | one throttle-0 cut, `offset_m = 5` m after the good line's own solved roll-on | violation / plan_gap |
| `overspeed` | §3 Fig 8.4 | entry `+ by_kmh = 26` km/h, everything else byte-identical | runoff / plan_gap |

### Why `early_apex` and `premature` are distinct kinds

Both are STANDARD §2(1) "turned in too soon," but they are **genuinely different failure
modes**. `premature` keeps the solved `tangent_inside` steering target, so the engine
*eases lean in progressively* and stays contained given street reserve. `early_apex`
**commits an explicit tighter lean** at the earlier station — the true doctrinal early
apex, forced wide later. Modeling the doctrinal early apex therefore *requires* perturbing
the steering target, not just the station.

### `deriveKissLean`

For `early_apex` when no `lean_deg` is given: bisects (22 iterations, bracket
`[2, CEILING_DEG]`) on emergent `minF` to find the **largest committed lean that still
just kisses the inside edge** (`KISS_EPS = 0.05`) without clipping past it.

### Honest engine-limitation flags (documented, not hacked)

- **`chop` cannot render "wide."** The book's chop lesson is a Tier-2 chassis
  load-transfer (stand-up-and-run-wide) effect, out of scope for a point-mass model. A
  throttle cut only decelerates and **pinches the line inward** → an `out_in_out`
  violation, not a runoff. The module documents this rather than faking a chassis effect.
- **`overspeed`'s canonical home is the decreasing-radius taper** — constant sweepers with
  reserve need a bigger default entry bump to actually wash wide.

Preserving epistemic honesty over teaching-signal convenience is a stated design value.

### `compileMistake` mechanics

```
solveContext(roadSpec, cornerId, turnIn, profile, opts) -> Result<ctx>
compileMistake(kind, params = {}, ctx)
  -> Result<{ kind, plan, roadSpec, res, outcome, diagnosis, result_hash,
              roll_rate_dps, label }>
```

`compileMistake` validates `ctx.solved.feasible`, dispatches to `BUILDERS[kind]` (each
returns a Result of `{plan, roadSpec, roll_rate_dps?, profile?, label}` and **never runs
the engine itself**), resolves any `apex:<id>` anchor via `resolveApexAnchors`, then does
the **single forward `engineRun` call**, returning outcome / diagnosis / `result_hash`
straight off the verdict.

---

## 7. Figure rendering (`figure.mjs`)

Pure drawing: `(composed road, solve() result) -> SVG string`. No fs / process /
child_process.

- **`makeScene()`** builds a coordinate-transform + drawing API around a station window
  `[S0, S1]`: `draw(s, d) = R.sdToXY(road, s, d × exag)`. The **physics stays on true
  geometry** — only the *drawn* lateral offset is exaggerated by `exag` (default 2.5) for
  legibility, "because the true o-i-o dip on a wide-radius corner barely reads at figure
  scale."
- **Colour code** (`P` palette) is reserved strictly for **line quality**: green good
  `#1f6f43`, amber mid/geometric `#b07d1e`, red mistake `#b32e2e`. `LITE` gives lighter
  twins of mid/bad for per-line markers so the ideal line still leads the eye.
- **Fixed paint order** so the ideal always reads on top: road furniture → AMBER
  (naive/geometric) → RED (mistakes) → GREEN (good line) → markers/legend/bikes.
- **Colour logic**: the solved line is green if `clean` or `goodLegit` (a planned
  non-clean legitimate line, e.g. a double apex); otherwise, in single-line non-overlay
  mode, it is drawn **red** to visually flag "not clean."
- **Markers**: hourglass = turn-in; ring = apex (two rings for a `goodTouches` double
  apex); dot + leader = exit. With `perLineMarks`, every overlaid line's own emergent apex
  is ringed in its lighter colour with an "NN%" label — built for Fig 5.3's
  three-ordered-apexes read.
- **Callout labels** (`labels[]`) are corner-relative, drawn at scene-resolved stations
  snapped to the nearest trace `d` — so a callout "can never point at empty space" (a
  named visual-QA failure mode).
- **Caption discipline**: the dev `author` verb keeps a full numeric caption (`Solved:
  brake X m/s², roll-on @ Y m -> clean o-i-o, apex Z%, lean W deg < R deg reserve, v_apex
  V km/h.`). Baked course figures set `sceneChrome`, which shows only **one footnote
  disclosing the lateral exaggeration** — no solver receipts or outcome branding in shipped
  chapter figures.

### Animation (dual-engine SMIL)

A physics-timed SMIL `<animateMotion>` bike glyph per line, constrained by the fact that
**cairosvg** (course rendering) ignores `<animateMotion>` while **browsers** honour it:

- `keyTimes` = cumulative time fraction `t += ds / v_avg` (floored at `BIKE_MIN_V_MS =
  0.5` m/s to avoid divergence near stops), normalized to `[0,1]`; `keyPoints` = cumulative
  drawn-path arc-length fraction (honours the `exag` distortion). Subsample cap
  `BIKE_MAX_KEYFRAMES = 48`.
- The motion path is **rebased to "M 0 0"** so cairosvg's static fallback frame parks the
  bike legibly at the line start, while browsers animate correctly.
- The glyph is **orientation-neutral** (concentric dots, no heading tick) since
  `rotate="auto"` is browser-only and would break the cairosvg static frame — "the
  teaching signal is the speed, not the heading."

---

## 8. The road DSL (`road-dsl.mjs`)

A one-line road grammar; segments separated by `|`, whitespace-tolerant around pipes and
tokens:

```
lane <w>              -- lane width; must appear EXACTLY ONCE and FIRST  -> lane_width_m
S <len>               -- straight            -> { type:"straight", len }
L <r> ^<deg>          -- left arc            -> { type:"arc",   id, r,      angle_deg, hand:"left"  }
R <r> ^<deg>          -- right arc           -> { type:"arc",   id, r,      angle_deg, hand:"right" }
L <r1>><r2> ^<deg>    -- left taper (r1->r2) -> { type:"taper", id, r1, r2, angle_deg, hand:"left"  }
R <r1>><r2> ^<deg>    -- right taper         -> { type:"taper", id, r1, r2, angle_deg, hand:"right" }
```

- Corner ids (`c1`, `c2`, …) are **minted in segment order by the parser** — the DSL text
  carries no id.
- Number lexing is a strict positive-decimal regex `^\d*\.?\d+$`, which rejects signs,
  extra dots, and empties so a malformed token can **never silently become 0 or NaN**.
- `parseRoadDSL(str) -> Result<roadSpec>` and `printRoadDSL(spec) -> string` **round-trip
  exactly** the DSL-expressible subset (`parse ∘ print ∘ parse` is an identity).

The DSL is **deliberately narrow**: `bike_margin_m`, `use_full_width`, `line_type`, and
`ds_m` are *not* expressible and are left to `compose()`'s defaults — specifically so the
round-trip identity holds cleanly over exactly the expressible subset (simplicity over DSL
completeness).

Example: `lane 3.5 | S 45 | R 28 ^90 | S 40` = a 3.5 m lane, 45 m straight, a 28 m-radius
90° right-hander (id `c1`), then a 40 m straight.

---

## 9. The `.scene` format

A `.scene` file (`cornering-course/scenes/*.scene`) is the **declarative source of truth**
for a compiled figure. The author writes only physical inputs; the engine derives
everything else. Implemented in `simulator/author/scene.mjs`.

### Full example — `fig-06-01.scene` (verbatim)

```
road:  lane 3.5 | S 40 | R 45 ^90 | S 40
lines:
  good:  ride entry=48 turnIn=auto
  bad:   mistake premature early_by_m=12
note:  "Same corner, same entry speed - only the turn-in point differs. The green rider waits, turns in late, and carves a single late apex at 65%: the bike is already pointed down the exit with lean in reserve, so it opens the throttle and drives straight out. The red rider turns in early and buys an early apex - kissing the inside while the corner is only half finished, then still leaning and steering through an exit it should already be driving out of. An early apex spends the corner too soon; that is what sets up the wide, lean-exhausted exit where most single-vehicle corner crashes happen, and all three mistakes in this chapter end there. Turning in early also drops the sight line (Fig 6.2), hiding the exit just when it matters most."
view:  exag=1.4
```

### Field grammar (from the `scene.mjs` header)

```
road:   lane 3.5 | S 45 | R 28 ^90 | S 40      # required — ONE road-DSL line (road-dsl.mjs)
lines:                                         # required — 1..N indented "name: kind args"
  good:  ride entry=82 turnIn=auto             #   solved good line; turnIn=auto | <metres>;
                                               #     style=single (default) | double_apex
  bad:   mistake premature early_by_m=18       #   compiled mistake (kinds/params: mistakes.mjs)
  geo:   naive                                 #   optional amber geometric baseline (raw "before")
  alt:   alt entry=54 style=geometric          #   optional amber LEGITIMATE alternative line;
                                               #     style=single | double_apex | geometric.
                                               #     `alt` and `naive` are EXCLUSIVE (one amber/scene)
marks: auto                                    # optional — auto = good-line marks (default);
                                               #   "all" marks EVERY line's turn-in + apex (+"NN%")
obstacles: gravel outside c1 +8x3              # optional — surface mu-patch: <kind> <side> <ref>
                                               #   <offset>x<span> [width=<m>] [mu=<f>]
labels:                                        # optional — indented "anchor  text" callouts
  apex:c1   "late apex - trade sight for exit" #   anchor = entry|exit|mid|apex:<cornerId>[+/-off_m]
  entry:c1  "turn in late"
  exit:c1+8 "opens onto the straight"
note:  "The late apex trades early sight..."   # optional — feeds the figcaption at stamp time
view:  exag=2.5                                # optional — the lateral-exaggeration knob
```

### Grammar rules

- Top-level keys (`road`, `lines`, `marks`, `labels`, `obstacles`, `note`, `view`) sit at
  column 0; `lines:` / `labels:` entries are indented.
- `#` opens a comment **only outside double quotes** — a note like `"corner #1 vs the #2
  line"` keeps its hashes.
- `lines:` entries read `name: kind rest`; names must be **unique** ("receipts are keyed
  by it").
- **Exactly one `ride` line is required** ("the good line every mistake is measured
  against").
- **`alt` and `naive` are mutually exclusive** — `figure.mjs` has exactly one amber slot.
- `ride`: `entry=<kmh>` (required, positive), `turnIn=auto|<m>` (default auto),
  `style=single|double_apex`, `corner=<id>` (default first), `label="..."`.
- `mistake <kind> [key=val …]`: kind must be in `MISTAKE_KINDS`; omitted params fall back
  to that kind's `MISTAKE_DEFAULTS`.
- `naive`: no args except optional `corner=<id>` — the geometric "before" at the good
  line's turn-in.
- **Label anchors are corner-relative, never raw x/y** — `entry:<id>` / `exit:<id>` /
  `mid:<id>` are static road geometry; `apex:<id>` is the good line's *emergent* apex,
  resolved in the author layer. Optional `±<m>` offset. Regex:
  `/^(entry|exit|mid|apex):([A-Za-z0-9_]+)([+-][0-9]+(?:\.[0-9]+)?)?$/`.
- **Obstacle** placement token `<offset>x<span>` (regex
  `/^([+-]?[0-9]+(?:\.[0-9]+)?)x([0-9]+(?:\.[0-9]+)?)$/`): offset signed from corner entry,
  span along road, defaults `width = 1.4 m`, `mu = 0.4`. `side ∈
  {inside, outside, left, right}`, hand-resolved through `SIM.scenario.sideSign`.
- Errors are **typed Results** carrying the offending token + 1-based line number, e.g.
  `bad scene at line 4: unknown mistake kind "wheelie"`.

Closed sets: `RIDE_STYLES = ["single","double_apex"]`, `ALT_STYLES =
["single","double_apex","geometric"]`, `LINE_KINDS = ["ride","mistake","naive","alt"]`,
`OBSTACLE_KINDS = ["gravel"]`, `OBSTACLE_SIDES = ["inside","outside","left","right"]`.

### The signature multi-line figure — Fig 5.3

`fig-05-03.scene` shows **three fates from one corner**: a red early-apex mistake, an
amber geometric alternative (`alt entry=48 turnIn=auto style=geometric`), and the green
delayed/ideal line, with `marks: all` so each line's turn-in and emergent apex ("NN%") are
ringed. It took four attempts and drove the construction of the `geometric`,
`early_apex`, and `marks: all` vocabulary primitives.

### The 13 scene-baked course figures

| Figure | Scene file | Figure | Scene file |
|---|---|---|---|
| 1.2 | `fig-01-02.scene` | 10.2 | `fig-10-02.scene` |
| 5.1 | `fig-05-01.scene` | 10.4 | `fig-10-04.scene` |
| 5.3 | `fig-05-03.scene` (signature) | 10.5 | `fig-10-05.scene` |
| 6.1 | `fig-06-01.scene` | 10.6 | `fig-10-06.scene` |
| 6.3 | `fig-06-03.scene` | 10.8 | `fig-10-08.scene` |
| 6.4 | `fig-06-04.scene` | 14.5 | `fig-14-05.scene` |
| 6.7 | `fig-06-07.scene` | | |

---

## 10. The baking pipeline (`bakeScene`)

`bakeScene(sceneSpec) -> Result<{ static_svg, animated_svg, receipts, scenario }>` is
**pure and deterministic** — the same `.scene` text always produces byte-identical output.
Steps:

1. `SIM.road.compose(roadSpec)` — compose the DSL into station geometry + corners.
2. Resolve `obstacles:` to core objects (`resolveObstacle`) — corner-hand → signed `d`
   band via `SIM.scenario.sideSign` (single sign source, never author-computed).
3. Build `rideContext` (start `d = ±(lane_width/2 − bike_margin)` by corner hand, brake
   start).
4. Solve the **good line**: single-corner via `solveRideShaped` (front door
   `solve` / `solveDoubleApex` / `suggestTurnIn`), or **`chainedSolve`** for a
   multi-corner (linked) road.
5. Compile each `mistake:` via `compileMistake` against the good line's context; detect
   "correction chains" (fifty-pence-style multi-turn-in mistakes) by diffing turn-in counts.
6. Solve `alt:` (via `solveRideShaped`, or `solveGeometric` against the good line's turn-in
   for `style=geometric`) **or** `naive:` — the one amber line.
7. Resolve every `labels:` anchor to an absolute station (`resolveLabelStation`, clamped to
   `[0, road.length]` — "a callout is always on the road, never off it").
8. Render **two SVG variants from one `makeScene`** via `renderAuthorFigure`:
   `static_svg` (book-ready still) and `animated_svg` (adds the physics-timed SMIL bikes;
   also static-correct under cairosvg). Two variants from one render pass avoids
   double-solving — "identical geometry, same makeScene."
9. Build the `scenario` object (`spec:"moto-sim/1"`) mirroring `engineRun`'s exact spec, so
   the read-only viewer can re-run the good line byte-for-byte via `cli url`.
10. Return `{ static_svg, animated_svg, receipts, scenario }`.

### Receipts

The per-line audit trail: `{ name, kind, outcome, diagnosis, result_hash, label, … }` read
**straight off each engine verdict**, never re-derived. Legitimate deviations are framed
as expected, not as mistakes: `doubleApexFraming` / `geometricFraming` mark an expected
`out_in_out` as EXPECTED (via `doctrine.expected_fail_present` / `unexpected_fail`) — "a
double-apex or geometric line is a legitimate deviation, not a mistake, and never uses
mistake vocabulary."

### `chainedSolve` (linked corners)

The single-corner `solve()` front door cannot reach a clean line across *linked* corners,
so `chainedSolve` is a separate path: it places turn-ins corner-by-corner
(latest-contained-station-first), each seeded by the bike's real emergent state from the
corner before, across an ascending decel scan (`decelLo → decelHi` step 0.2 m/s²) — the
gentlest fully-contained decel wins (doctrinal slow-in, not over-slowing). A linked line
is explicitly **contained, not clean** — an `out_in_out` there is doctrinally correct
(linked turns sacrifice open exits), not a bug. Its per-corner search runs coarse
(`ds_m: 1.0`) then re-verifies at full resolution — "the speedup can never ship a wide
line."

### ASCII-folding (`asciiFold`)

Aria-labels and the SVG-embedded note are folded to ASCII (em-dash, curly quotes, degree
symbol, ellipsis, …) to satisfy the "no-tofu" invariant that scans every byte of the baked
SVG. The **visible figcaption keeps the note verbatim** — only the SVG-embedded copy is
folded.

---

## 11. The bake → stamp → verify workflow

The mandatory loop (per CLAUDE.md):

1. **Edit the `.scene` file** — never the SVG.
2. **Bake + stamp**:
   `node simulator/cli.mjs scene <file> --stamp <chapter.html> --fig <id>`.
3. **Idempotence gate**: re-run the identical bake+stamp; the diff against the chapter HTML
   **must be empty**. Enforced by `scene-stamp.test.mjs` ("re-stamping the same baked scene
   is byte-identical").
4. **Re-render**: `uv run tools/render_diagrams.py <chapter.html>` and **vision-judge** the
   PNG against `STANDARD.md`'s two-axis test — a subagent must judge it (no self-eyeballing).
5. **Round-trip gate**: every committed golden SVG under
   `simulator/tests/fixtures/scenes/` must re-bake byte-for-byte identical
   (`scene.test.mjs`, using `bless-scene-goldens.mjs`).

### Stamping mechanics and the guards

The baked SVG + a regenerated `<figcaption>` are stamped into the chapter HTML **between
guard comments**:

```
GUARD_NS = "scene"
guardStart(id) = "<!-- scene:<id>:start -->"
guardEnd(id)   = "<!-- scene:<id>:end -->"
```

- `stampBetweenGuards(html, guardId, animatedSvg, note)` replaces content **strictly
  between** the guard pair; it refuses (typed error) if guards are absent, duplicated, or
  end-precedes-start. The guards themselves never move; content outside the span is never
  touched.
- `buildFigcaption(...)` preserves the `<strong>Fig N.N —Title.</strong>` lead-in verbatim
  from the prior span (so re-stamps stay byte-stable), or synthesizes `"Fig N.N."` from the
  guard id via `figLabelFromGuardId` (regex `/^fig-(\d{1,2})-(\d{1,2})$/`, matching
  `render_diagrams.py`'s `{stem}_svgNN` numbering); the body is the scene `note:`
  (HTML-escaped) when present.
- `initGuards(html, guardId, svgIndex)` is the **one-time** guard-introduction operation:
  it wraps the `svgIndex`-th (1-based) `<svg>…</svg>` and its following `<figcaption>` in
  fresh guards at the SVG's own indentation, and **refuses if the guard id already exists**.

### The asymmetric friction (deliberate)

- `initGuards` is **non-idempotent** and refuses if the guard exists ("init-guards is a
  one-time operation").
- plain `--stamp` refuses if guards are **absent**.

This asymmetry is intentional: guards can never be *silently* introduced or *silently*
re-introduced.

### Why hand-editing a stamped SVG is forbidden

The span between `<!-- scene:fig-CC-NN:start -->` and `<!-- scene:fig-CC-NN:end -->` is
**machine-owned**. The *next* re-bake — triggered by any future `.scene` edit or golden
refresh — replaces everything strictly between the guards **unconditionally**, with no
warning. Any hand edit made there is silently overwritten. So a stamped SVG is *output*,
not *source*; the `.scene` is the only place to make a change stick.

### Provenance: `hand` vs `scene:<file>`

`line-diagram-audit.md` carries a provenance column for all 108 figures:

- **`hand`** — a hand-authored SVG, edited normally in the chapter HTML.
- **`scene:<file>`** — a machine-generated figure; edit the `.scene`, never the SVG.

This column is the single lookup that tells an editor which discipline a given figure is
under.

### Golden-regeneration discipline

`bless-scene-goldens.mjs` regenerates the committed golden SVGs. It is explicitly commented
"Run deliberately, only after confirming a baker change is INTENDED" and "Never hand-edit a
golden to make the test pass." The golden round-trip is a **byte-stability tripwire**: any
unintended change to the baker (physics, rendering, or formatting) is caught immediately.
Goldens are output, not spec.

---

## 12. Design decisions, in brief

- **Physics-as-validator, never generator** — every module forbids drawing a line or
  asserting an outcome; everything is read off `SIM.simulate.run`'s emergent verdict.
  Rejected alternative: hand-computing/asserting expected outcomes, which would let author
  and engine silently disagree.
- **No apex input, ever** — enforced structurally (no schema field; core rejects `apex:`
  refs; `resolveApexAnchors` bridges the sugar only *after* solving).
- **Two-target bisection over joint optimization** — justified by the measured
  near-independence of the two controls (roll-on shifts apex < 1 %).
- **Feasibility probe before bisecting** — a placement problem can't be braked or
  throttled away, so short-circuit honestly.
- **Separate solvers for geometric / double-apex / chained lines** — extending `solve()`'s
  bisection to accept pre-ideal or two-touch turn-ins would weaken the feasibility
  invariant that protects the good-line path.
- **`expect_fail` for legitimate non-clean lines** — declared in the scenario rather than
  special-cased in core, keeping the doctrine checks generic and shared.
- **Coarse-then-fine two-stage search** — a coarse `ds_m: 1.0` sweep locates the region
  cheaply; the winner is re-verified at full resolution so "a coarse/fine disagreement is a
  typed error, never a silently-wide shipped line."
- **One-perturbation mistakes** — fixes a real historical confound; a diff isolates the
  intended delta.
- **Honest engine-limitation flags** (`chop`, `overspeed`) — the point-mass model's limits
  are documented, not faked around.
- **Narrow road DSL** — only lane + straight/arc/taper, so `print(parse(s))` is a clean
  round-trip identity.
- **Guard-introduction asymmetry** — deliberate friction so machine-owned figure spans are
  never silently created or clobbered.

---

## 13. Forward reference

The engine those tools drive — the point-mass model, the friction ellipse and one-μ
policy, the roll-rate-limited lean, the RK4 integrator, the doctrine checks, and the
verdict schema whose emergent fields (`apex_s`, `apex_pct`, `exit.f`, `lean_max_deg`,
`ran_wide`, `outcome`, `diagnosis`) every solver in this document reads back — is
documented in **09 (the simulator physics & doctrine engine)**.
