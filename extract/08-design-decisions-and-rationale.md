# Design Decisions & Rationale (ADR-style)

This is the consolidated catalogue of the significant design decisions that shape
the Motorcycle Cornering project — a two-artifact teaching system (a zero-build HTML
course and a physics simulator) built from Lee Parks' *Total Control: High-Performance
Street Riding Techniques*. Each record follows a **Context → Decision → Reasoning →
Alternatives rejected → Consequences** shape. Decisions are grouped by theme; a
summary index sits at the top for navigation.

The through-line to notice while reading: nearly every decision is a variation on one
principle — **make correctness mechanically checkable and let it emerge, rather than
asserting it by hand.** The book is the oracle; physics is the validator; render-then-vision
is the gate; byte-stability tripwires catch drift. Where a "why" is only implied in the
source material, it has been made explicit here.

---

## Index of decisions

| # | Decision | Theme |
|---|---|---|
| D1 | The book is doctrine (single source of truth) | Foundations |
| D2 | Extraction is committed, not regenerated on demand | Foundations |
| D3 | STANDARD.md separate from CLAUDE.md (rubric vs. process) | Foundations |
| D4 | No build step, zero dependencies, open HTML directly | Architecture |
| D5 | Classic-script IIFE + frozen global namespace (not ES modules) | Architecture |
| D6 | Metric-by-correct-conversion, not verbatim | Content |
| D7 | Inline self-contained SVGs | Diagrams |
| D8 | Colour code is doctrine, not decoration | Diagrams |
| D9 | Explicit "synthesis" provenance disclaimers in Part II | Content |
| D10 | Physics emerges the verdict — no apex input anywhere | Simulator core |
| D11 | One-mu policy (physical ceiling vs. soft reserve, named apart) | Simulator core |
| D12 | Result-over-exceptions with IO pushed to the edges | Simulator core |
| D13 | Shooting method over static steady-state geometry | Simulator core |
| D14 | Two-tier stepping: time-domain RK4 + arc-length resample | Simulator core |
| D15 | Deadbands on crash/verdict boundaries (cross-runtime stability) | Simulator core |
| D16 | TUNING-tag quarantine for non-book constants | Provenance |
| D17 | Windowed-LUT solve speedup, provably byte-identical | Performance |
| D18 | v1 simulator is the validator for v2 authoring | Authoring |
| D19 | v2 landed in author/ (ESM), not core/ | Authoring |
| D20 | Physics-is-the-validator-not-the-generator (author layer) | Authoring |
| D21 | Two-target monotone bisection, not joint optimization | Authoring |
| D22 | Separate solvers for geometric / double-apex lines | Authoring |
| D23 | One-perturbation mistake compiler | Authoring |
| D24 | Honest engine-limitation flags over faked effects | Authoring |
| D25 | Scene-baking: generated figures, not hand-drawn | Scenes |
| D26 | Stamp guards + idempotence gate + guard-introduction friction | Scenes |
| D27 | Corner-relative anchors, never raw x/y | Scenes |
| D28 | Preset-hash byte-stability tripwire | Verification |
| D29 | Render-then-vision-judge gate (subagent, not self-eyeball) | Verification |
| D30 | Audit-driven iterative working style | Process |
| D31 | Tests before code; dev-test runner as a separate gate leg | Process |
| D32 | Read-only viewer in v1; editing deferred to v1.5 | Simulator surface |
| D33 | Exit codes encode outcome tiers, not sim success/failure | CLI |
| D34 | Lane-constrained by default; full-width is an opt-in | Simulator core |
| — | Open decisions & known friction | Deferred |

---

## Foundations

### D1 — The book is doctrine (single source of truth)

**Context.** The course teaches a specific line-selection method. Many rider-training
sources exist (Roadcraft, Keith Code, Ienatsch, MSF, Yamaha Champions) and they disagree
in places. Without a designated authority, "correct" becomes a matter of taste and every
review re-litigates first principles.

**Decision.** The `.azw3` copy of *Total Control* at the repo root is the ground-truth
object. The rule is stated flatly: **when course and book disagree, the book wins.** Other
sources are synthesized in, but Parks' line method is the spine.

**Reasoning.** A single named oracle makes every diagram, numeric claim, and simulator
verdict *checkable* against something stable rather than arguable. It converts "is this
right?" into "does this match the book (or the physics the book rests on)?"

**Alternatives rejected.** A blended "best of all sources" doctrine with no tiebreaker —
rejected because it makes conflicts unresolvable and audits non-terminating.

**Consequences.** Everything downstream (STANDARD.md, the audits, the doctrine engine's
12 checks) exists to operationalize this one principle. Core line doctrine is pinned to
`book_text/parts/part0014__chapter-8-line-selection.txt` (Chapter 8, "Line Selection").

### D2 — Extraction is committed to git, not regenerated on demand

**Context.** The book is a 25 MB Kindle `.azw3`. Two PEP-723 `uv` scripts extract it to
readable form: `extract_book.py` → `book_text/` (32 spine parts, a ~475 KB fulltext md,
a `PARTS.tsv` index); `extract_images.py` → `book_images/` (87 named figures, 258 raw
images, `FIGURES.tsv`/`figures.json`). Both **wipe and rebuild** their output dir each run.

**Decision.** Commit the extracted `book_text/` and `book_images/` to the repo. The
`.gitignore` rules for them exist but are deliberately commented out, with the rationale
written inline: "Now COMMITTED ... so the prose/figures [are] readable/browsable without
regenerating."

**Reasoning.** An agent or reader can grep the prose and browse figures without ever
touching the 25 MB binary or running an extractor. A deliberate reproducibility/ergonomics
trade: a bigger repo in exchange for zero-friction reading. The `.azw3` remains the ground
truth; the committed text is a convenience mirror.

**Alternatives rejected.** Regenerate-on-demand (keep outputs gitignored) — rejected
because it forces every fresh context to run tooling before it can read the doctrine.

**Consequences.** The extractors are rarely needed at runtime; they exist to refresh the
mirror when the source changes. Both duplicate their spine/title parsing rather than share
a module — an accepted small redundancy.

### D3 — STANDARD.md is a separate document from CLAUDE.md

**Context.** The project needs both a *process* description (how to build and verify) and a
*content rubric* (what "correct" actually means for a diagram or a claim).

**Decision.** Keep them in two files. `CLAUDE.md` is workflow/conventions/gates. `STANDARD.md`
distills Chapter 8 plus supporting physics into the concrete two-purpose rubric: "Judging a
diagram — apply the two-axis test" and "Judging a claim — check it against the doctrine and
physics below."

**Reasoning.** The verifier workflow can cite STANDARD.md as an *external, stable acceptance
test* rather than embedding judgment criteria inside code or process docs. Separation lets the
rubric evolve independently of the build process.

**Consequences.** STANDARD.md defines the ideal line ("single smooth-arc, late-apex,
outside–inside–outside"), the three canonical mistakes (premature initiation, slow steering,
fifty-pencing), the special cases, the physics equations the course rests on, and the two-axis
judging test (physical plausibility + doctrinal correctness). It is the thing subagents judge
rendered PNGs against.

---

## Architecture

### D4 — No build step, zero dependencies, open the HTML directly

**Context.** The course must be trivially portable and long-lived — a teaching artifact that
opens anywhere with no toolchain.

**Decision.** Every chapter is a standalone `.html` file with inline SVG diagrams, one shared
`style.css`, and one shared `quiz.js`. No framework, no bundler, no server, no network calls:
"open the HTML directly." The simulator is likewise a "zero-build JS subsystem" run via `node`
with no `package.json` anywhere — a gate-checked invariant (G0).

**Reasoning.** Zero build means zero bit-rot from a toolchain that ages out, and the course
survives being copied to a USB stick or an offline machine. It also forces each artifact to be
self-correct in isolation (see D5, D7).

**Alternatives rejected.** A `package.json`/npm project structure and TypeScript were both
rejected outright — TS needs a build step for the browser; a `package.json` was deferred to
"if v2 ever needs deps, that is the flagged decision point." Keeping "no package.json anywhere"
is an explicit gate constraint.

**Consequences.** Everything self-contained; the render harness can rasterize any single SVG
without loading the page's CSS. The location of the simulator (top-level `simulator/`, not
inside `cornering-course/` or `tools/`) follows from the same logic: it is an app with a
browser surface, not a teaching page and not a single-purpose script.

### D5 — Classic-script IIFE + frozen global namespace, not ES modules

**Context.** The simulator's physics must run *byte-identically* in two places: a browser
opened from `file://` (for the read-only viewer and chapter iframes) and Node (for the CLI,
tests, and authoring). `<script type="module">` and `fetch()` both fail from a `file://`
origin in every major browser.

**Decision.** Every `core/`, `render/`, and `ui/` file is a classic-script IIFE of the form
`(function (SIM) { ... })(globalThis.SIM ??= {})`, attaching a frozen namespace to a shared
global `SIM`. The one exception is `core/load.mjs`, the single ESM file, whose only job is to
side-effect-import every core/render file in a fixed order and re-export the populated `SIM`.
The browser's `app/index.html` must load the identical file list in the identical order — a
documented two-list invariant kept in sync by hand.

**Reasoning.** The same source file runs unmodified in-browser (`<script src>`) and in Node
(side-effect import), guaranteeing the two surfaces execute the same physics. This reuses the
course's existing `quiz.js` idiom (ordered `<script src>` attaching to a frozen global).

**Alternatives rejected.** ES modules (idiomatic but break from `file://`); TypeScript (needs
a build). Both conflict with D4's hard constraint.

**Consequences.** `core/load.mjs` is the sole ESM/IO seam ("IO pushed to the edges" in the
literal architectural sense — no core file can do file/network IO or throw). The load order
list is a maintenance hazard flagged in comments.

---

## Content conventions

### D6 — Metric by correct conversion, not verbatim

**Context.** The course is metric (km/h, m, m/s, degrees) throughout; the book is US units
(mph, ft). Numbers must agree between them.

**Decision.** Agreement is judged by **correct conversion arithmetic**, not string-matching:
mph → km/h ×1.609; ft → m ×0.3048. The rule for anyone editing near a number: redo the
conversion, don't trust the existing text. A conversion error is only a *finding* if it
"changes the teaching" (rounding is fine; doctrine drift is not).

**Reasoning.** Leftover imperial constants are the project's "most-audited bug class."
Requiring re-derivation on every touch, rather than trusting prior text, is the discipline
that catches them.

**Consequences.** The simulator centralizes every unit constant in one `units` module
(`G = 9.81`, the conversion factors) specifically to guard this bug class; `mph2kmh` is kept
only as a cross-check and is "never used in the engine." The content-fidelity audit's biggest
surviving cluster is still imperial leftovers in quiz text and aria-labels missed by an
earlier sweep.

### D9 — Explicit "synthesis" provenance disclaimers in Part II

**Context.** Part II (Chapters 13–15, multi-turn planning) introduces vocabulary the book
does not use verbatim: priority stack, commit points vs. decision points, segmentation, the
master linking rule, held exit, the four visibility cases.

**Decision.** Chapters 13+ insert explicit `Synthesis: ... treat it as this course's method`
sentences distinguishing course-original vocabulary from verbatim book doctrine.

**Reasoning.** The "book wins" rule (D1) needs to know *which* claims are Parks' and which are
the course authors' extension. The disclaimer is a deliberate provenance signal so a
doctrine-vs-book conflict check can tell them apart.

**Consequences.** A reviewer never mistakenly "corrects" a course-original framework against
the book, and never over-trusts an extension as if it were doctrine.

---

## Diagram conventions

### D7 — Inline, fully self-contained SVGs

**Context.** With no build step (D4), there is no pipeline to inject shared CSS/JS into an SVG
at render time.

**Decision.** Every diagram carries its own `viewBox`, its own `<defs>` (colour-keyed arrow
markers), inline per-SVG `<style>`, and hardcoded `fill`/`stroke` hex values. No external CSS
supplies any diagram colour or geometry. Each SVG also carries `role="img"` + a descriptive
`aria-label` doubling as a terse machine-readable summary.

**Reasoning.** Each diagram must be independently correct when opened raw, and — critically —
must render faithfully in isolation through the `render_diagrams.py` harness *without* the page
context. This is what makes automated render-then-vision verification (D29) possible.

**Alternatives rejected.** CSS-class-styled SVG (smaller markup) — rejected because it couples
the diagram to `style.css` being present, breaking standalone rasterization.

**Consequences.** Diagrams are portable and verifiable one at a time. The same discipline is
enforced in the simulator's renderers ("inline fill/stroke/defs only, never a CSS class ...
no `<style>`/`<link>`/external `url()`"), even down to drawing gravel as explicit stippled
`<circle>`s rather than an SVG `<pattern>` — because a `<pattern>` "is not guaranteed to
rasterise" under cairosvg.

### D8 — Colour code is doctrine, not decoration

**Context.** A reader (and an automated judge) needs to identify "the mistake" in a figure
before reading the caption.

**Decision.** A hard normative colour code: **green = good/ideal line, amber =
geometric/middling, red = the mistake being taught.** Markers and arrowheads inherit their
line's colour. Applied identically across all 108 course figures and reserved *exclusively*
for line quality.

**Reasoning.** Colour becomes a second notation system carrying doctrinal meaning. It is part
of the doctrinal-correctness axis of the judging test — a correctly-shaped line drawn in the
wrong colour still fails Axis B.

**Consequences.** The reservation is strict enough that the simulator's strip-chart channels
(speed, brake, throttle, lean) are deliberately painted *neutral* colours (steel-blue, purple,
teal, slate) so they never collide with the line-quality code. The top-down renderer keys line
colour to doctrinal *line quality* (via `qualityForVerdict`), not raw outcome: a violation whose
only failures are sight-vs-stopping or a longitudinal grip clip stays **green**, with the sight
deficit flagged by a separate red chip — because the ridden geometry was fine and conflating a
road-visibility fact with a line flaw would mislead the reader.

---

## Simulator core

### D10 — Physics emerges the verdict; no apex input anywhere

**Context.** The simulator exists to make the book's line doctrine *causal and inspectable*.
The book's rule #5 is "the turn point is the master decision" — apex, exit, and lean are
consequences of it.

**Decision.** The author supplies only **inputs**: a road, a rider start state, and a timed
plan of brake/turn-in/throttle/position actions. Apex, exit, run-wide/no-run-wide, required
lean, and the corrective maneuver **all emerge from re-integrating the physics**. There is no
`apex` field anywhere in the input schema — grep-provably. Core's `scenario.validate` even
*rejects* an `apex:<cornerId>` plan anchor, because the apex is unknown until the engine runs.

**Reasoning.** This structurally enforces the book's doctrine rather than letting a hand-placed
apex fake it. A verdict you can't hand-tune is a verdict you can trust to grade a line.

**Alternatives rejected.** An apex knob or hand-placed apex station — rejected as the exact
thing that would let the tool lie about doctrine.

**Consequences.** `apex:<id>` anchors are ergonomic sugar resolvable only in the author layer
(`resolveApexAnchors`), which runs the engine first and rewrites the anchor to an absolute
station before core ever sees it — keeping the "no apex input" invariant intact even as
convenience was added on top.

### D11 — One-mu policy: physical ceiling vs. soft reserve, named apart

**Context.** An early draft used a skill-derated coefficient of friction (μ) in *both* the
friction ellipse/hard ceilings *and* the soft reserve thresholds. This produced a self-
contradictory 40.4°–45° band that was simultaneously NaN, WARN, and CRASH. This is labelled
"the single most important physics correction" (resolution **[R1]**).

**Decision.** There is exactly one physical grip ceiling, computed only from the surface's true
physical μ. Hard ceilings and the ellipse always use physical μ:

```
a_lat_max    = mu * g
a_long_max   = mu * g
phi_max      = atan(mu)                 # = 45.0° at mu = 1.0
ellipse_mag  = sqrt((a_long/a_long_max)^2 + (a_lat/a_lat_max)^2)     # > 1 => beyond grip
a_long_avail = a_long_max * sqrt(max(0, 1 - (a_lat/a_lat_max)^2))    # real & >=0 for all phi<=phi_max
```

Skill-derated `mu_use = skill * mu` (skill 0.85 street / 0.95 expert) sets **only** the
separately-named soft reserve thresholds:

```
a_lat_reserve = mu_use * g              # = 8.34 m/s^2 at skill .85, mu 1
phi_reserve   = atan(mu_use)            # = 40.36° at skill .85, mu 1
```

**Reasoning.** The naming *is* the guard rail: no code path can silently substitute a soft
advisory threshold where a hard physical ceiling belongs, or vice versa. All this math lives in
one file (`physics.js`) so "no module re-derives (or re-derates) them."

**Consequences.** The friction-ellipse math has a proof attached (`a_long_avail` is real and
≥0 for every φ ≤ phi_max, the "one-mu policy proof," with an explicit `max(0, ·)` guard against
last-ULP negativity exactly at phi_max). Frozen golden: `a_long_avail(40.4°)=5.15`,
`a_long_avail(45°)=0`.

### D12 — Result-over-exceptions, IO pushed to the edges

**Context.** The core must be pure and testable, and every fallible operation must surface
cleanly to an agent caller as data rather than a stack trace.

**Decision.** Every fallible core operation returns `{ok:true, value}` or
`{ok:false, error:{code, at, message}}`. **No thrown exception escapes `core/`.** IO and
throwing exist only in `cli.mjs`, the test suite, and the `ui/` layer. The error-code
vocabulary is a closed set kept greppable: `SCHEMA, DUP_ID, OUT_OF_SCOPE, UNKNOWN_ID,
BAD_RANGE, NO_SOLUTION, NOT_IMPLEMENTED, INTERNAL`.

**Reasoning.** Matches the project's global "Results over exceptions" and "IO at the edges"
preferences. A closed, greppable error vocabulary means "an agent can `rg` a whole session's
failures." Doctrine checks are wrapped so any thrown error degrades to a `na` verdict rather
than crashing the grader.

**Consequences.** `deepFreeze` is applied recursively (children before parents, "so no window
of mutability exists on a frozen parent"). Geometry (`geom.js`) is the deliberate exception:
its header states "geom has no fallible ops → no Result here" — pure vector math cannot fail, so
wrapping it in Result would be noise. This is a scoped decision, not an oversight.

### D13 — Shooting method over static steady-state geometry

**Context.** Two hard questions — "what committed lean makes the line just kiss the inside
edge?" (`solveTangentInside`) and "can a wider-running corner be saved, and how?"
(`solveCorrection`) — could be answered by a closed-form lean formula.

**Decision.** Both are decided by **re-integrating through the same pure stepper**
(`SIM.integrate.run`), root-found by bisection, never by a closed-form lean. Static readouts
like `phi_req = atan(v²/(g·R_req))` and `R_req` are computed but explicitly marked "a READOUT
only; the shot is the verdict" (resolution **[R2]**).

**Reasoning.** Geometry math can look right while the physical path — with roll-rate limits,
grip, and drag — diverges from it. The worked golden "static-says-correctable-but-shot-runs-off"
pins a case a naive static check calls correctable that the actual rate-limited shot proves runs
off, because detection is late and lean can't build fast enough.

**Alternatives rejected.** Unconstrained root-finding over the whole feasible-lean range —
rejected because bisecting `f_apex` freely finds the *tightest* root, which spirals off-road.
The fix constrains the search to a doctrinal band `[lean_geo, lean_forRc]` (apex radius between
Rc and the ideal line radius R_line) — "the fix for the spiral bug." Seeding `v_apex` from entry
speed is also rejected (it over-leans the first shot into collapse, "the hard-brake trap"); a
gentle `PROBE_DEG = 12` seed is used instead.

**Consequences.** The corrective object leads with the *doctrinal* remedy (lower entry speed,
`v_ok = sqrt(g·R_req·tan(phi_ok))`, phi_ok ≈ 36°) before listing the emergency add-lean save,
and never marks a fix "clean" if it consumes all reserve. Crash detection strictly precedes
corrective solving, so no nonsensical "save" is computed for an already-lowsided trajectory.

### D14 — Two-tier stepping: time-domain RK4, then arc-length resample

**Context.** The physics naturally integrates in time, but doctrine/verdict analysis wants
uniform *spatial* samples. An arc-length integrator divides by zero as v→0.

**Decision.** Run classical fixed-step RK4 in the time domain at **dt = 0.005 s (200 Hz)**,
then resample the raw series onto a fixed **ds = 0.5 m** arc-length grid (lerping numeric
fields, OR-ing boolean flags) for all analysis. The controller is evaluated once per step and
held constant across the four RK4 sub-stages (zero-order hold).

**Reasoning.** Keeps the integrator simple and standard while giving analysis a convenient
fixed spatial grid. ZOH keeps "commanded" quantities (notably `a_cmd_rate` for the stand-up
term) well-defined per discrete step rather than smeared across sub-stages, and avoids extra
controller calls.

**Alternatives rejected.** A native arc-length integrator (blows up at v→0). An earlier
"<1% accuracy via 4th-order RK4" claim was explicitly *withdrawn* — the RHS is piecewise-smooth
(clamp/sqrt-clip/relu reduce RK4 order at saturation), so the honest claim is RK4-in-smooth-
regions **plus linear event-bracketing** at every saturation/crash/inflection boundary.

**Consequences.** Crash/stop/end crossings are found by linear interpolation between the last
good state and the first violating state. The friction ellipse is clipped inside *every* RK4
sub-stage using local physical μ, not just at the outer step boundary. Guard limits
(`max_time_s = 120`, `max_dist_m = 5000`) prevent runaway sims.

### D15 — Deadbands on crash/verdict boundaries

**Context.** IEEE-754 does not mandate correctly-rounded transcendental functions across JS
engines. A verdict that flips at exactly `phi_max` or `ellipse_mag == 1` would differ between
runtimes.

**Decision.** Bake small tolerance bands into the crash condition itself: crash fires only when
`phi > phi_max + eps_phi` (eps_phi = 0.05°) or `ellipse_mag > 1 + eps_mag` (eps_mag = 1e-3);
inside the band the state is `marginal`/WARN with a signed margin.

**Reasoning.** Cross-engine determinism is deliberately *tolerance-based, not bit-exact*.
Bit-identical goldens are scoped to a single pinned runtime; discrete-verdict flips are prevented
by documented deadbands rather than by chasing an unachievable cross-engine bit-equality.

**Consequences.** The same discipline extends to reporting epsilons (`eps_deg_report`, `eps_m`)
used for tolerance-equal verdict comparisons, and underpins the one-core gate G6′ which asserts
CLI and viewer are *tolerance-equal*, not byte-equal.

### D34 — Lane-constrained by default; full road width is opt-in

**Context.** On a right-hander the geometric "outside" of the road is the oncoming lane. Using
the full road width would compute a line the rider isn't legally or safely allowed to take
(resolution **[R3]**).

**Decision.** Street scenarios use the rider's own lane minus a bike half-width margin
(`bike_margin_m = 0.40`) by default. A `road.use_full_width:true` opt-in exists for
track/closed-road demos and marks the scenario `lane_legal:false`.

**Reasoning.** The ideal line and all doctrine checks must reflect the space the rider is
actually allowed to use. This changes the worked-example ideal-line radius from a rejected
full-road 80.4 m down to the lane-legal **67.9 m** — "the number the tool is actually allowed to
draw."

**Consequences.** Lane fraction `f` (0 = inner usable edge, 1 = outer usable edge, >1 =
oncoming) is the primary doctrine-facing position, because raw signed `d` is doctrine-ambiguous
(rider's-left is the outside edge on a right-hander but the inside edge on a left-hander). `f` is
hand-independent, so agents compare mixed L/R corners directly.

---

## Provenance & performance

### D16 — TUNING-tag quarantine for non-book constants

**Context.** The simulator has two kinds of constant: values derived from the book (apex bars,
reserve angles) and engineering tuning knobs with no book source (stand-up gains, deadbands,
the U-turn scope cut at 170°/15 m).

**Decision.** Every constant with no book citation is commented `// TUNING` in the single frozen
`config.js`, and the module header states these "must never be attributed to Parks/Code in any
output." Book-derived values cite their DESIGN §-section source instead.

**Reasoning.** A provenance discipline enforced structurally: ALL config lives in exactly one
frozen file, so a provenance audit has a single place to check. The system must never present a
tuning heuristic as if it were Lee Parks' doctrine.

**Consequences.** Doctrine-check tuning constants (the `OIO`/`THR`/`TRAIL`/`LINK`/`RIDE` bands
in `doctrine.js`) carry the same "NEVER attributed to Parks/Code" annotation. Book-sourced bars
(`apex_late_pct = 50`, `apex_late_pct_decreasing = 60`, `blind_reserve_deg = 35`) live in
`config.js` and are marked as doctrine, not tuning.

### D17 — Windowed-LUT solve speedup, provably byte-identical

**Context.** The inverse solver and coarse scans re-run the full engine dozens of times per
figure. The per-step nearest-station lookup was an O(n) scan over the road's centreline LUT.
(Memory: an 8.2× speedup, solve 31→3.8 s, author 69→13.4 s.)

**Decision.** `nearestLutIndex` takes an O(1) forward `±24`-index window around a previous hint
*only when a formally provable condition holds* (`2·dist(query, hint) < road.window_safe_dist`,
where `window_safe_dist` is precomputed by `road.js` as a lower bound on how close the road's LUT
ever comes to itself across a >window index gap). Otherwise it falls back to a full scan.

**Reasoning.** A "provable, not merely tested" performance ethos: the result is *always
byte-identical* to a naive full scan — verified by 0-mismatch fuzzing — so the speedup is purely
a performance change with a proven correctness bound, never a behavior change. The window radius
`W = 24` must match `road.js`'s `WINDOW_RADIUS`, a cross-file invariant.

**Alternatives rejected.** An approximate/heuristic windowed search — rejected because it would
be a silent behavior change and would break the byte-stability tripwires (D28).

**Consequences.** This is what makes the author layer's many-engine-run search patterns
(bisection, coarse-then-fine scans) practical enough to be the primary authoring mode.

---

## Authoring (v2)

### D18 — The v1 simulator is the validator for v2 authoring

**Context.** v2 adds *authoring* — turning "a road + a turn-in" into a finished, doctrine-
correct figure. It could re-derive lines geometrically.

**Decision.** v1 is reused wholesale as the **validator**. The authoring layer generates only
inputs and reads every doctrine-relevant output off `SIM.simulate.run`'s emergent verdict. The
design-of-record for the shift supersedes nothing in v1.

**Reasoning.** A prototype caught the danger directly: a naive control-point spline came out
~2× too tight at the apex (r 37 vs. physical 66 m) — visible *only because the physics validator
ran against it*. This cemented the rule "physical lines from the engine / a max-radius arc;
control-point splines only for the exaggerated illustration layer."

**Consequences.** The whole author layer's thesis becomes D20; the rejected "backward-planning
as primary generator" alternative is documented (see Open decisions).

### D19 — v2 landed in author/ (ESM), not core/

**Context.** After prototyping in `simulator/proto/`, the v2 inverse solver and authoring front
door needed a permanent home. Core is classic-script frozen-namespace (D5); the browser viewer
loads core.

**Decision.** The authoring layer graduated to ESM modules in `simulator/author/`
(`solve.mjs`, `place.mjs`, `figure.mjs`, `author.mjs`, `mistakes.mjs`, `scene.mjs`,
`road-dsl.mjs`), exposed as CLI verbs `author` and `suggest`. It imports core via `load.mjs`
(the one ESM seam). It was deliberately **not** ported into `core/`. `proto/author.mjs` was
retired.

**Reasoning.** The authoring solver *drives* the engine the way the CLI does, but is **not
loaded by the browser viewer**. Forcing it into the classic-script frozen-namespace load order
(duplicated in `load.mjs` and `app/index.html`) would be wrong — it would inflate the browser's
load list with code the browser never runs.

**Consequences.** Clean separation: `core/` is pure physics loadable by both surfaces;
`author/` is Node-only ESM tooling. The single CLI entry point (`cli.mjs`) routes both v1 sim
verbs and v2 authoring verbs.

### D20 — Physics is the validator, not the generator

**Context.** The historical workflow hand-drew SVG paths for cornering diagrams, risking silent
geometry/doctrine mismatch.

**Decision.** Every author module's header repeats: "PHYSICS IS THE VALIDATOR, NOT THE
GENERATOR." An author supplies a road + a turn-in (plus optional brake/throttle or mistake
specs); apex, exit, run-wide, lean, and speed all *emerge* from running the real point-mass
simulator. `solve()` and `mistakes.mjs` explicitly forbid drawing a line or asserting an
outcome. After solving, `solve()` **re-runs the engine on its own output to self-verify** and
returns that verdict verbatim.

**Reasoning.** Hand-computing or asserting expected outcomes would let author and engine
silently disagree. Reading everything off the emergent verdict makes that disagreement
impossible.

**Consequences.** A feasibility probe runs *before* bisecting: a turn-in placement problem
(too early cuts inside; too late never reaches inside) can't be fixed by braking or throttle, so
`solve()` short-circuits with an honest typed diagnostic rather than converging to a degenerate
result.

### D21 — Two-target monotone bisection, not joint optimization

**Context.** The inverse solve must fill two controls (brake decel, roll-on onset) to hit two
doctrine targets (apex lean = `leanFrac * RESERVE_DEG`; exit lane-fraction = `exitTarget`).

**Decision.** Two sequential 16-iteration monotone bisections against the engine's own emergent
metrics — decel sets apex/speed first (lean falls monotonically as decel rises), then roll-on
trims the exit independently (exit_f falls monotonically as roll-on moves later).

**Reasoning.** The two controls are empirically *near-independent* — moving the roll-on shifts
the apex by <1% across the whole sweep — so sequential bisections are simpler and cheaper than a
joint solve while being provably correct given the measured near-independence.

**Consequences.** `bisect(metricOf, target, lo, hi, decreasing, iters=16)` rails cleanly to a
bound when the target is unreachable in-bracket, giving honest "capped" results instead of
garbage.

### D22 — Separate solvers for geometric and double-apex lines

**Context.** The course needs an amber "geometric apex" line (largest-radius arc, apex at ~50%,
turn-in *earlier* than ideal) and a legitimate green double-apex line (a planned two-touch
deviation). Neither is reachable through `solve()`.

**Decision.** `solveGeometric` and `solveDoubleApex` are separate fixed-plan forward searches,
not extensions of `solve()`. Both re-verify at full engine resolution after a coarse search.
Their doctrinally-correct deviations (`out_in_out`, `late_apex`, `throttle_rule`) are declared
via the scenario's `expect_fail` field so the verdict reports them as EXPECTED, not surprises.

**Reasoning.** `solve()`'s feasibility probe by design rejects any turn-in that isn't in the
clean late-apex band — the geometric line is deliberately pre-ideal and the double apex is
deliberately a two-touch deviation. Extending `solve()`'s bisection to accept them would weaken
the core feasibility invariant that protects the main "good line" path.

**Alternatives rejected.** Special-casing "acceptable violations" inside core's doctrine checks
— rejected in favour of `expect_fail` declaration so core's doctrine logic stays generic and
shared. Documented engine-reality limit: the point-mass model can't reproduce the book's
mid-corner stand-up drift-back, so a contained double apex renders as one sustained inside pass
with two planned inputs rather than two separated dips — named honestly, not faked.

### D23 — One-perturbation mistake compiler

**Context.** Each teaching "mistake" figure should isolate exactly one error. An earlier "chop"
mistake also moved the entry line, entangling cause and effect (NEEDS_IMPROVEMENT #6).

**Decision.** Each mistake builder changes **exactly one control** relative to the good line's
solved plan, forward-runs the real engine once, and reports the engine's own outcome/diagnosis
— never asserted by the compiler. Kinds: `premature`, `early_apex`, `slow_steer`, `fifty_pence`,
`chop`, `overspeed`. The empirical outcome table is pinned by diff-based tests against two gate
roads, not asserted.

**Reasoning.** A single-control diff isolates precisely the intended delta, so the figure
teaches one lesson cleanly.

**Consequences.** `early_apex` and `premature` are kept as *distinct* kinds despite both being
STANDARD §2(1) "turned in too soon": `premature` keeps the `tangent_inside` steering target
(the engine eases lean progressively and stays contained given street reserve), while
`early_apex` *commits* an explicit tighter lean at the earlier station (the true doctrinal early
apex, forced wide later) — a genuinely different failure mode.

### D24 — Honest engine-limitation flags over faked effects

**Context.** The point-mass model (Tier 1) lacks the Tier-2 chassis load-transfer physics behind
the book's throttle-chop "stand up and run wide" lesson.

**Decision.** Document the mismatch rather than hack around it. A `chop` mistake reads as an
inward pinch (`out_in_out` violation), not the book's run-wide, and the module states so plainly
and notes what would change "if/when Tier-2 lands." `overspeed`'s canonical home is moved to the
decreasing-radius taper where the physics genuinely washes wide.

**Reasoning.** Epistemic honesty over teaching-signal convenience: faking a chassis-standup
effect the engine doesn't model would be a lie about the physics. The fidelity ladder is
explicit — Tier 1 (v1) = point-mass + friction ellipse + roll-rate-limited lean; Tier 2 (v1.5) =
load transfer + low-speed kinematic steer; Tier 3 = full multibody, "zero pedagogical value for
line selection," out of scope forever.

**Consequences.** Sight geometry gets the same honesty: vertical-blind scenarios (crests/dips)
*refuse* a sight verdict (`na: true`) rather than draw an in-plane 2-D ray, because "a student
could mistake [the wrong ray] for the real over-the-top limit point" — a wrong-but-plausible
answer is judged worse than an honest "not modeled."

---

## Scenes

### D25 — Scene-baking: generated figures, not hand-drawn

**Context.** Before scenes, "three systems and none of them owns the figure": the 108 course
diagrams were frozen hand-pasted polylines with zero cross-reference to the simulator (an `rg`
found 0 hits between `cornering-course/` and `simulator/`); the simulator only solved the good
line (mistake lines needed hand-tuned ~66-line plans); animation was trapped in the read-only
viewer with no exportable artifact.

**Decision.** A `.scene` text file becomes the **single source of truth** for a subset of
figures. An author writes only physical inputs (a road DSL line, an entry speed, mistake
perturbations, optional labels/obstacles); `bakeScene` compiles out a static SVG, an animated
SVG, a verdict receipt, and a URL-embeddable scenario. 13 course figures are scene-baked. Edit
the `.scene`, never the SVG.

**Reasoning.** This makes Axis A (physical plausibility) *true by construction* — the vision
subagent's job shrinks to Axis B spot-checks and legibility, "minutes instead of the 108-figure
audit treadmill." The ergonomics bar was set numerically: a full compound figure (road + good +
mistake + markers + animation) must be ≤ 6 lines of scene text and one bake command.

**Consequences.** The `.scene` grammar keeps the road as one DSL line, strategies as doctrine
words (`ride`, `mistake premature`, `alt style=geometric`, `naive`), and every callout as a
corner-relative anchor. Two SVG variants come from one render pass (avoids double-solving). The
animation is physics-timed SMIL `<animateMotion>`, path-rebased to origin so cairosvg's static
fallback frame stays legible while browsers animate, with an orientation-neutral dot glyph
(because `rotate="auto"` is browser-only) — the taught signal is speed, not heading.

### D26 — Stamp guards + idempotence gate + guard-introduction friction

**Context.** A baked scene SVG must be injected into a course chapter's HTML and safely
re-injected when the `.scene` changes — without a human accidentally hand-editing machine-owned
markup.

**Decision.** Baked SVGs live between `<!-- scene:fig-CC-NN:start -->` / `:end` guard comments.
`stampBetweenGuards` replaces content *strictly between* the guards and is required to be
**byte-idempotent** (re-bake + re-stamp must diff empty — the tested idempotence gate). Guards
are introduced once, explicitly, via `--init-guards --replace-svg <NN>`, which refuses if the
guard id already exists; plain `--stamp` refuses if guards are absent.

**Reasoning.** The between-guard span is machine-owned — the next re-bake replaces it
unconditionally, so any hand edit there is silently overwritten. The asymmetric friction (init
refuses if guards exist; stamp refuses if guards absent) is deliberate so guards can never be
silently created or silently skipped.

**Consequences.** Regenerated `<figcaption>`s preserve the hand-authored `<strong>Fig N.N —
Title.</strong>` lead-in verbatim (so re-stamps stay byte-stable) while the scene's `note:`
drives the caption body. Scene bakes are pure/deterministic: the same `.scene` text always
produces byte-identical SVG + receipts, pinned by golden round-trip fixtures and
`bless-scene-goldens.mjs` ("Never hand-edit a golden to make the test pass").

### D27 — Corner-relative anchors, never raw x/y

**Context.** Callouts pointing at empty space are a recurring visual-QA failure mode named in
CLAUDE.md's verification section.

**Decision.** Every label anchor is corner-relative (`entry:<id>`, `exit:<id>`, `mid:<id>`,
`apex:<id>`, each with an optional ±offset), resolved to an absolute station at bake time and
clamped to `[0, road.length]`. Never a raw x/y coordinate. `entry/exit/mid` are static road
geometry; `apex` is the good line's emergent apex.

**Reasoning.** A station-resolved anchor drawn at the nearest trace `d` "can never point at
empty space." Station coordinates (s, t) are the uniform addressing scheme across the whole
authoring system for exactly this reason.

**Consequences.** The same one sign rule (`SIM.scenario.sideSign`) resolves named lateral
positions everywhere (core static resolution, `place.sideToD`, obstacle placement), so "an
author never hand-computes a signed d again" (fixes NEEDS_IMPROVEMENT #12).

---

## Verification

### D28 — Preset-hash byte-stability tripwire

**Context.** Engine changes (a rounding tweak, a new segment type, a speedup) could silently
perturb the graded output of existing teaching scenarios.

**Decision.** `tests/preset-hashes.test.mjs` recomputes `spec_hash` + `result_hash` for every
registered preset and every `scenarios/*.json` via the same loaders the blesser uses, and
asserts equality against the committed `tests/fixtures/preset-hashes.json`. Any drift is a test
failure. A deliberate change requires re-running `bless-preset-hashes.mjs` — a dedicated,
reviewed re-bless commit. `result_hash` is fnv-1a over the canonicalized verdict (no
`node:crypto`, so it runs identically from `file://` and Node), and it **excludes** the
`diagnosis` field and itself.

**Reasoning.** Silent hash drift is treated as a caught regression, not something to patch
around. Excluding `diagnosis` from the hash is "a CRITICAL byte-stability rule" so that adding
new diagnostic fields never perturbs existing presets' bytes. This is the mechanism that made the
S0 float-rounding change, the S1 taper-segment addition, and the LUT speedup all *provably*
non-regressive.

**Consequences.** One central float-emission rounding policy is applied only at the
verdict/channel boundary (metres/km-h/deg → 2 dp, grip/lane-fraction → 3 dp, apex_pct → 1 dp,
channels 3 dp except raw `s` at full precision, raw samples never rounded). It is kept separate
from the CLI's display rounding precisely because it feeds `result_hash`. Trajectory samples and
the diagnosis block stay full precision so root-cause analysis reasons on raw measurements.

### D29 — Render-then-vision-judge gate (subagent, not self-eyeball)

**Context.** Geometry math can be exactly right while the picture reads wrong: arrows spilling
off the asphalt into the grass, a "good" line that visually appears to run wide, callouts
pointing at empty space. This rule entered CLAUDE.md from a real fix (commit `c256940`, Fig
5.2/5.4 "runs wide").

**Decision.** A two-step gate. First a mechanical render gate: `render_diagrams.py` (108 course
SVGs) and `render_sim_views.py` (simulator views) rasterize every SVG to PNG and **exit
non-zero on any render failure**. Passing that is necessary but never sufficient — a **separate
subagent** must then read the PNG with vision tools and judge it against STANDARD.md's two-axis
test (physical plausibility + doctrinal correctness). The editing agent must *never* trust its
own eyeball.

**Reasoning.** Numeric/geometric correctness cannot catch layout/legibility/doctrinal-reading
failures; only rendering to a raster and having a vision judge look at it can. The subagent's
visual verdict — not the arithmetic — is the actual gate for "done."

**Consequences.** Both render tools share one libcairo bootstrap (a macOS self-re-exec that
finds Homebrew's `libcairo.2.dylib` and sets `DYLD_FALLBACK_LIBRARY_PATH`), one 2× scale
convention, one namespace-fix, and one exit-code contract — `render_sim_views.py` imports
`render_diagrams` purely for that side effect. Scene compilation (D25) shrinks this gate's scope
by making Axis A true by construction.

---

## Process

### D30 — Audit-driven iterative working style

**Context.** The project runs on a loop, not a one-shot build. Correctness must be tracked and
burned down over time.

**Decision.** Each audit document is explicitly "a fix list for the next loop," not a static
report. `line-diagram-audit.md` audits all 108 SVGs (now carrying a provenance column: `hand`
vs. `scene:<file>`). `content-fidelity-audit.md` verifies per-chapter claims against the book.
`simulator/NEEDS_IMPROVEMENT.md` is an ergonomics friction list ordered by iteration cost.

**Reasoning.** Living fix-lists let the project converge: the content-fidelity audit fanned out
16 agents over 362 checkable claims, adversarially re-checked every flag (half the first-pass
flags were refuted), and the verification pass itself caught 6 more audit-missed "cross-chapter
twin" errors — surfacing a standing "audit completeness — cross-chapter twins" follow-up now
baked into the loop.

**Consequences.** The audits double as a provenance ledger and a scoping-reality record — e.g.
the scenes work landed an honest "13 baked, 17 evaluated-and-blocked" outcome (against an
original "~60" estimate that had ignored multi-panel layouts, sight rays, chained mistakes, and
unrideable tapers), each block recorded with its specific physics-grounded gap reason.

### D31 — Tests before code; dev-test runner as a separate gate leg

**Context.** The house rule is write tests before code, and gates must be scriptable by an
agent.

**Decision.** Tests are written first. The simulator's own dev runner `node simulator/cli.mjs
test` spawns `node --test`, summarizes TAP into gate-friendly JSON (`{ok, tests, pass, fail,
duration_ms}`), and exits 0 all-green / 3 on any failure. It is kept a *separate leg* from the
render/vision check rather than folded together. Doctrine "mistake" presets are *required* to
actually fail the doctrinal check they claim to teach (reconciled via `expect_fail`), not merely
asserted to.

**Reasoning.** Educational, usage-conveying tests over coverage theater. Keeping the test gate
and the vision gate separate keeps each one's failure mode legible. A preset that claims to teach
"premature initiation" but doesn't actually trip `late_apex`/`out_in_out` is a bug in the preset
or the engine — never patched by editing `expect`.

**Consequences.** Test count grew with the phases (243 v1 → 489 across 36 files at S5 final),
including the preset-hash tripwire and scene-golden round-trip fixtures. The `test` verb strips
`NODE_TEST_CONTEXT` from the child env so a `node --test` spawned from inside a test run still
emits its own TAP.

### D33 — Exit codes encode outcome tiers, not simulation success/failure

**Context.** An agent driving the CLI must distinguish "the sim ran and reported a bad line"
from "your input was malformed" from "you asked for a clean figure and didn't get one."

**Decision.** A uniform exit-code contract: `0` = the sim ran (ANY outcome — clean, wide,
runoff, violation, crash — is exit 0); `2` = spec/input invalid (stdout still JSON with typed
errors + a `road_summary`); `3` = doctrine-gate failure under `--gate` or a non-clean `author`;
`1` = a render/figure view failed to write.

**Reasoning.** A crash *scenario* is a successful *simulation* — conflating the two would make
the exit code useless for scripting. The CLI is the sole IO edge, translating typed Result errors
into machine-readable JSON on stdout with human diagnostics on stderr.

**Consequences.** PNG export in `author` is best-effort — a cairosvg/uv hiccup warns and nulls
`png` but never masks the doctrine gate (only a failed *SVG* write is exit 1). The
`DYLD_FALLBACK_LIBRARY_PATH` for the PNG shell-out is set *inline* in the shell string, not via
`execSync`'s `env:` option, because macOS SIP strips `DYLD_*` across the `/bin/sh` exec —
documented so it isn't "fixed" back to the idiomatic form.

---

## Simulator surface

### D32 — Read-only viewer in v1; editing deferred to v1.5

**Context.** A scenario viewer could offer drag-to-edit affordances. v1 had a one-shot build
budget (resolution **[R6]** cut the scope to functional core + full CLI + two SVG renderers + a
read-only viewer).

**Decision.** The viewer (`app/index.html`, `app/embed.html`, `ui/*`) is deliberately read-only
— no drag/edit/hit-testing. The draggable editor, chase view, and the DOM round-trip gate (G6)
move to v1.5. This was explicitly confirmed by the user.

**Reasoning.** Keeps the viewer a *pure consumer* of the same `SIM.simulate.run` pipeline the
CLI drives (the "G6′ one-core guarantee"), avoiding a second authoring surface that could diverge
from `author/`'s v2 solver.

**Consequences.** `index.html` is the full workstation (presets, import/export) and its `#s=`
hash handling is inert; `embed.html` is the slim iframe-able shell that actually parses the
`#s=<compressed-json>` hash, so a chapter can embed a specific scenario with no server. The
steering/lean channel is read-only *even in the future editor* — "letting users sculpt the lean
curve would contradict the doctrine" (lean must emerge from a turn-in + roll-rate). `ui/view.js`
mirrors renderer geometry constants rather than editing the frozen renderers — an accepted
coupling risk covered by render tests.

---

## Open decisions & known friction

These are recorded as live items, not settled ADRs — the "roads not yet taken."

- **NEEDS_IMPROVEMENT #14 (OPEN, S6-candidate) — lone non-clean good line renders RED.** The
  figure colour rule escapes to green only via `clean` or `goodLegit`, so a legitimately
  *contained* single linked line (not tagged `double_apex`) reads as a mistake. This blocks
  figs 13.5/14.7 from scene migration. Flagged **"Do NOT fix casually"** — `figure.mjs` output
  is baked into 13 committed course SVGs, so any colour-rule change requires a deliberate
  re-bless commit re-rendering and re-vision-judging every affected figure.

- **Backward-planning as the *primary* line generator — considered and rejected.** Demoted to a
  secondary, labelled mode because a real rider cannot plan backward from a corner they haven't
  seen; Parks' method is forward-executable, and the late apex is "the substitute for knowing the
  future." The chosen primary generator is forward + sight-limited (limit-point turn-in
  placement, late apex emerges). Graduating sight-limited placement and backward planning out of
  proto remains open.

- **Illustration-spline curve primitive — still open.** The exaggerated illustration layer's
  curve primitive (clothoid / biarc / monotone-cubic) is an unresolved design choice in the v2
  authoring design-of-record.

- **Genuine 2-arc stepped-radius geometry cannot be ridden clean by the current controller** (a
  single committed lean can't tighten across a same-direction arc boundary), verified across ~40
  tuning attempts. The decreasing-radius "trap" keeps the 2-arc geometry to *teach the run-off*,
  while a separate `taper`-segment "true-taper" twin demonstrates the same lesson on a
  continuously-tightening clothoid the engine *can* grade.

- **`file://` headless testability (#10)** — only partly de-risked (localhost equivalence + a
  `#s=` proof); a structural guarantee that the viewer works headlessly from `file://` is still
  open.

- **The `deflate` vs `deflate-raw` decode asymmetry** in `embed.html` — the CLI always encodes
  raw deflate; the embed's first decode attempt at plain `"deflate"` fails and falls through to
  `"deflate-raw"`. Functionally fine, cosmetically asymmetric — flagged for a future synthesis
  pass.

- **Deferred S6 vocabulary follow-on.** Phases S0–S5 are complete (13 scene-baked figures, 17
  honest skips, suite 248→489, byte-stability held throughout, SMIL animation live in chapters).
  S6 — a further vocabulary/primitive follow-on to unblock more of the 17 blocked figures
  (multi-panel layouts, timeline strips, concentric-arc primitives, the red-line colour rule) —
  is proposed in PLAN/ROADMAP but **not started**; Carlos decides whether and when.

- **Tier-2 physics (load transfer, low-speed kinematic steer) is deferred to v1.5.** Its absence
  is why `chop` reads as an inward pinch rather than a run-wide (D24) and why the double apex
  renders as one sustained pass rather than two dips (D22). Tier-3 multibody is out of scope
  forever ("zero pedagogical value for line selection").
