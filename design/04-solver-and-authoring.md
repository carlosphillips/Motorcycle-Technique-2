# Solver & Authoring

## 1. What this document covers

How authored intent becomes a validated line: the **authoring ladder** (from one
command to scene text), **turn-in suggestion**, the **solve pipeline** and its
self-verification, **chained-corner solving**, the new **visibility-governed
mode**, the **scene text format**, and the canonical **agent workflows**.

The governing thesis is carried verbatim from the prior design: **physics is the
validator, not the generator.** An author supplies only physical inputs — a road,
a turn-in (or `auto`), an entry speed, optionally a mistake perturbation. Apex,
exit, lean, outcome, and diagnosis emerge from running the real engine, and every
solver re-runs the engine on its own output before reporting success.

Owned elsewhere: the wire schema and mistake-kind vocabulary
(`03-roads-scenarios-and-visibility.md`), the physics the solvers shoot through
(`02-physics-model.md`), the result envelope (`05-result-contract-and-inspection.md`),
view/projection details (`06-rendering-and-projection.md`), and the CLI surface
over these functions (`08-cli-and-agent-interface.md`).

---

## 2. The authoring ladder

Four rungs, most-automated first. Every rung compiles down to the same wire
scenario and runs the same engine; the rungs differ only in how much the author
specifies.

**(a) One-command ideal line.** `solve({road, entry_kmh})` — road (DSL string or
preset name) plus entry speed; turn-in defaults to `auto`. Returns the solved,
self-verified late-apex line with its full result. This is the front door and the
agent default.

**(b) Mistake one-liner.** A solved context plus `compileMistake(kind, params?)`
— e.g. `mistake early_apex early_by_m=6` — yields the failed line. No
hand-authoring of bad inputs, ever.

**(c) Explicit plan.** A full scenario JSON (`03-…md` §6) for authors who want
manual control of every action. Same validation, same engine, no privileged path.

**(d) Scene text.** A `.scene` file binding one road to N lines plus labels and a
view spec (§7). **The ergonomic bar, carried:** a compound multi-line teaching
figure in **≤ 6 lines of scene text** plus one bake command.

---

## 3. Turn-in suggestion (`suggestTurnIn`)

Answers "where should I turn in?" without a full solve per candidate — the
coarse-sweep-then-full-solve shape is carried:

1. **Coarse sweep:** one cheap engine run per candidate turn-in station from
   `corner.s0 − 24 m` to `corner.s0 + 8 m` in 2 m steps at coarse resolution
   (`ds_m = 1.0`). Filter to candidates that stay contained (no inside cut, no
   run-off) with an emergent apex in the plausible band (`20 < apex_pct < 90`).
2. **Rank** the surviving band by `|apex_pct − 58|` (`target_apex_pct = 58`,
   TUNING — the doctrinal late apex).
3. **Full-solve the top 4** at full resolution; return the first that verifies
   clean.
4. On failure, return a typed result distinguishing *empty band* (no contained
   candidate exists — the road/speed combination is the problem) from *non-clean
   band* (candidates exist but none verifies — solver brackets or profile are the
   problem).

The coarse/fine discipline is normative: any coarse-stage winner **must** be
re-verified at full resolution, and a coarse/fine disagreement is a typed error,
never a silently-shipped line.

---

## 4. The solve pipeline (`solve`)

### 4.1 What it searches

Two near-independent, monotone controls, each bisected against a target measured
off the engine's own emergent verdict:

| Control | Target (emergent) | Direction |
|---|---|---|
| brake `decel` | apex lean = `lean_frac × reserve` | lean falls as decel rises |
| roll-on onset station | exit lane fraction `exit.f = exit_target` | exit f falls as roll-on moves later |

Defaults (TUNING, carried): `lean_frac 0.70` (slow-in doctrine — apex lean at 70 %
of the street reserve, ≈ 28° with the street profile), `exit_target 0.85`
(driven out to the outside but contained), decel bracket `2.4–3.8 m/s²`, roll-on
bracket `+35 … +90 m` past turn-in, `brake_gap 4 m` (braking completes before
turn-in), `crack_gap 8 m` (maintenance throttle after turn-in), 16 bisection
iterations per control, railing cleanly to a bound when a target is unreachable.

Two sequential bisections instead of a joint optimizer, carried with its
justification: the controls decouple (moving roll-on shifts the apex < 1 %), so
decel sets apex/speed first and roll-on trims the exit independently.

### 4.2 Pipeline order

1. **Feasibility probe first.** One engine run at nominal decel and mid-bracket
   roll-on asks whether this *turn-in placement* can work at all: a line that cuts
   inside means turn-in too early; an apex that never comes inside means turn-in
   too late. Either short-circuits with a typed infeasible reason — a placement
   problem cannot be braked or throttled away, and honest refusal beats a
   degenerate converged line.
2. **Bisect decel**, then **bisect roll-on**.
3. **Self-verify:** re-run the engine on the final plan and return *that* verdict
   verbatim. A non-clean self-verification is reported as such (and still renders,
   so the author can see why); it is never patched.

The solved plan is the canonical four actions — brake (tapering to complete
`brake_gap` before turn-in), deferred `tangent_inside` turn-in, maintenance
crack, drive roll-on — with no apex field anywhere (D7).

### 4.3 Under Tier 1R (the run-wide slice)

The good-line solve is structurally unchanged by D3: doctrine braking completes
before turn-in, so the stand-up term is inactive on the solved path, and roll-on's
widening keeps its sign (acceleration at lean still widens the arc; the slice
strengthens the transient). Consequences that **are** new:

- Both bisection brackets are re-tuned under Tier 1R (marked TUNING); the
  monotonicity assumptions behind `bisect` must be re-validated empirically as an
  implementation gate (`09-verification-and-testing.md`) before the brackets are
  trusted.
- Any plan that carries brake past turn-in (trail-braking analyses, the `chop`
  and brake-at-lean mistakes) now widens instead of pinching inward — the mistake
  outcome pins in `03-…md` §7.1 reflect this.
- The corrective-action solver (the "can this run-wide be saved?" shot,
  `02-physics-model.md`) must model the save under the same stand-up coupling —
  adding lean while still decelerating is exactly where the slice bites.

### 4.4 Specialized solvers

Deliberately separate fixed-plan searches, carried, so the main solve's
feasibility gate stays strict: `solveGeometric` (the mid-apex largest-radius
alternative line, coarse forward search re-verified fine), `solveDoubleApex` (the
planned two-touch line with its ascending gentlest-decel scan; under Tier 1R the
mid-corner stand-up drift between touches — previously impossible for the
point-mass — becomes representable, and the solver's `expect_fail` declarations
shrink accordingly), and `naive` (the fixed generic-rider baseline; role
`reference`).

---

## 5. Chained-corner solving (`chainedSolve`)

Carried shape: linked sequences are solved corner-by-corner,
latest-contained-turn-in first, each corner **seeded by the bike's real emergent
state from the corner before**, across an ascending decel scan — the gentlest
fully-contained decel wins (doctrinal slow-in without over-slowing). Coarse per-
corner search, full-resolution re-verify.

A linked line is **contained, not clean**: sacrificing each open exit to set up
the next turn-in is doctrinally correct there, and the verdict for a
linked-sequence line is graded by a chain-aware check set (containment +
link-continuity + flow) rather than the single-corner clean bar. Under colour law
v2 (D9) that chain-aware verdict maps to **green** — resolving the prior defect
in which a lone, correctly-ridden linked line rendered red because "clean" was the
only path to green.

Chained **mistakes** (`scope: "all_corners"`, `03-…md` §7.2) reuse this machinery:
the perturbation is applied at each corner in sequence, each seeded by the
mistaken line's own emergent state, so the error compounds corner-over-corner
exactly as fig 8.6 teaches.

---

## 6. The visibility-governed mode (new, D4)

A ride spec may set `vis=cautious` (default `vis=none`), switching on two solver
rules that generate the doctrinally cautious blind-corner line:

**V1 — stop-within-sight speed governor.** At every station, speed must satisfy
`ssd(v) ≤ sight_m` for the configured stopping model: never ride faster than you
can stop within what you can currently see. The governor caps entry speed and
holds maintenance throttle (no roll-on) while the limit point is closing.

**V2 — hold wide until release.** Before turn-in, a generated `position` action
holds the outside of the corridor (`f = 0.9`, TUNING) — the position that
maximizes `sight_m` around a lateral occluder. The **release station** is the
first station where `trend = opening` **and** `sight_m ≥ ssd_m` at governed
speed; turn-in is placed at or after release, and roll-on is gated on release
rather than on the geometric exit alone.

Mechanics: solve normally, read the resulting per-sample sight channel, apply
V1/V2 constraints, re-solve, and iterate to fixpoint — convergence is monotone
because slowing and widening can only open the sight margin, never close it
(bounded by `vis_max_iterations = 4`, TUNING; failure to converge is a typed
`NO_SOLUTION`). The result self-verifies like every solved line, and its verdict
must pass the sight-deficit check by construction.

The canonical blind-corner figure is the comparison this mode exists for: the
same corner ridden `vis=none` (geometry-optimal, sight-indifferent) against
`vis=cautious`, with per-sample sight distances readable off both lines — the
agent-visible, physics-measured version of "the wide entry sees further."

---

## 7. The scene text format

One figure per `.scene` file; the declarative source of truth an author or agent
edits (baked outputs are never hand-edited). Top-level keys at column 0; `lines:`
and `labels:` entries indented; `#` comments outside double quotes; typed errors
carry the offending token and 1-based line number.

```
road:      <road-DSL line> | preset <name>          # required, exactly one
lines:                                              # required, 1..N entries: "name: kind args"
  good:    ride entry=34 turnIn=auto
  bad:     mistake early_apex early_by_m=6
  wide:    ride entry=34 vis=cautious role=alternative
occluders: hedge inside c1 -6x26 margin=1.2         # optional, one per line
hazards:   gravel outside c1 +8x3 mu=0.4            # optional, one per line
marks:     auto | all                               # optional (default auto: good-line marks)
labels:                                             # optional callouts, corner-relative anchors
  apex:c1   "late apex — sight traded for exit"
  entry:c1  "turn in late"
view:      mode=diagram window=auto                 # optional; vocabulary owned by 06
note:      "caption text"                           # optional
```

Line kinds (closed set): `ride | mistake | naive | plan`.

- `ride`: `entry=<kmh>` (required), `turnIn=auto|<m>` (default auto),
  `style=single|double_apex|geometric` (default single), `vis=none|cautious`
  (default none), `corner=<id>` (default first), `role=<role>`,
  `label="…"`.
- `mistake <kind> [key=val …] [scope=<cornerId>|all_corners]`: kinds and
  per-kind defaults from `03-…md` §7; compiled against the figure's first `ride`
  line (exactly one `ride` line is required — the reference every mistake is
  measured against).
- `naive`: the fixed generic-rider baseline at the good line's turn-in.
- `plan <file.json>`: an explicit wire scenario included as a line.

Role defaults: first `ride` → `ideal`, subsequent `ride` → `alternative`,
`mistake` → `mistake`, `naive`/`plan` → `reference`. Any entry may override with
`role=`. **No count caps and no exclusivity rules** — D9 removed the prior
one-amber-slot and `alt`-XOR-`naive` constraints; colour comes from each line's
own verdict.

Names must be unique (results and receipts are keyed by them). Label anchors are
corner-relative only (`entry|exit|mid:<id>[±m]`, plus `apex:<id>` sugar resolved
against the good line's *solved* apex after the engine runs — never before).
Baking is pure and deterministic: identical scene text produces identical
artifacts (`09-verification-and-testing.md` owns the round-trip gates). A
`--check` lint mode validates scene syntax and placements without solving
(`08-cli-and-agent-interface.md`) — closing the prior asymmetry where scene errors
surfaced only during a full bake.

The six-line bar, demonstrated: `road:` + `lines:` + two line entries + `view:` +
`note:` is a complete good-vs-mistake teaching figure.

---

## 8. Agent workflows

The canonical recipes, at API level (CLI spellings in
`08-cli-and-agent-interface.md`). Each step names the contract it returns.

**R1 — Ideal line on a fresh corner.**
`parseRoadDSL("lane 3.5 | S 12 | R 12 ^90 | S 16")` → `solve({road, entry_kmh: 34})`
→ verified result: solved plan, trajectory, verdict (`clean`, apex ≈ late), every
sample inspectable via `stateAt`.

**R2 — Mistake overlay.** R1's solved context → `compileMistake("early_apex",
{early_by_m: 6}, ctx)` → failed line with engine-emergent `runoff` outcome +
diagnosis; figure = both lines; diff of the two plans shows exactly one changed
control.

**R3 — Blind-corner visibility compare.** `preset bookBlind` → `solve({road,
entry_kmh: 32})` (vis=none) and `solve({road, entry_kmh: 32, vis: "cautious"})` →
two lines whose per-sample `sight_m`/`ssd_m` channels quantify the hold-wide
teaching; figure renders both with sight rays and the occluded region.

**R4 — Linked chain with compounding mistake.** `preset bookEsses` →
`chainedSolve` (green contained line) → `compileMistake("early_apex", {},
{scope: "all_corners"})` → the corner-over-corner amplification figure (fig 8.6
equivalent).

**R5 — Book-figure recreation.** A `.scene` file: preset road + `ride` +
`mistake` lines + corner-relative labels + `view: mode=diagram` → bake → static
SVG through the diagram projection plus the same figure loadable in the viewer
for stepping (`07-viewer-animation-and-pov.md`).

The bar these recipes are tested against (`09-verification-and-testing.md`): an
agent starting from `schema` + `explain` output alone completes each recipe
correctly on the first try.

---

## 9. Relation to the prior design

**Carried:** physics-as-validator with mandatory self-verification; the
feasibility-probe-then-two-bisections solve with its decoupling justification and
constants; coarse-then-fine search discipline; `suggestTurnIn`'s sweep/rank/
verify shape; separate specialized solvers rather than a weakened main gate;
`chainedSolve`'s seeded corner-by-corner scan; the one-`ride`-line scene rule; the
≤6-line ergonomic bar; corner-relative label anchors with post-solve `apex:` sugar.

**Changed:** solver brackets and the corrective shot re-validated under Tier 1R;
`solveDoubleApex` gains the real two-touch shape the point-mass couldn't produce;
linked lines grade green via the chain-aware verdict (D9); scene grammar drops the
one-amber-slot and exclusivity rules, adds `role=`, `vis=`, `plan` lines, preset
roads, occluder/hazard split, and a no-solve `--check` lint; `view:` speaks the
projection vocabulary of `06-rendering-and-projection.md` instead of a lateral
`exag` knob.

**New:** the visibility-governed mode (V1 stop-within-sight, V2 hold-wide-until-
release, fixpoint iteration) and chained mistake scope — together they make
"choose different paths based on visibility" an authorable, comparable,
first-class capability rather than a rendering afterthought.
