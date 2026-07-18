# Verification & Testing

How linelab *proves* work is done rather than asserting it. This document defines
the verification regime for the new architecture: what is tested, by which
mechanism, at which layer, and what "green" is allowed to mean. It adapts the prior
project's regime — whose record is in `extract/07-tooling-and-verification.md` and
`extract/08-design-decisions-and-rationale.md` — to an interactive-first tool (D1),
a diagram projection (D2), the Tier 1R physics slice (D3), and first-class failed
lines (D6).

The prior project's one-sentence philosophy survives unchanged and governs
everything below:

> **"The geometry math can be exactly right while the picture reads wrong."**

What changes is *where* each proof attaches. The prior design had one product
(static SVG artifacts) and could route almost every proof through a raster gate.
linelab has three product surfaces — a pure engine, exported static figures, and a
live viewer — and each gets the verification mechanism suited to it, never a
borrowed one.

---

## 1. What this document covers

The three-layer verification philosophy (§2); engine verification — determinism,
golden numerics, hashing, re-bless, property tests (§3); the mistake oracle (§4);
projection verification and the proportion gate (§5); contract tests for the
stepper and POV (§6); the adapted render-then-vision-judge loop (§7); the testing
philosophy (§8); and the relation to the prior regime (§9).

Contracts referenced here are owned elsewhere: the physics model and its canonical
scenarios by `02-physics-model.md`; the scenario schema by
`03-roads-scenarios-and-visibility.md`; the result contract and `stateAt` by
`05-result-contract-and-inspection.md`; the projection, colour law v2, and
proportion bands by `06-rendering-and-projection.md`; the viewer and POV by
`07-viewer-animation-and-pov.md`; CLI verbs and exit codes by
`08-cli-and-agent-interface.md`; the doctrine rubric by `01-scope-and-doctrine.md`.
This document defines only how each of those is *verified*.

---

## 2. Verification philosophy: three layers, three mechanisms

| Layer | Surface | Mechanism | Catches |
|---|---|---|---|
| **Engine** | `core/`, `road/`, `sight/`, `plan/`, `solve/` | Golden numerics with tolerances + property tests + determinism hashing | Physics drift, invariant violations, nondeterminism |
| **Static artifacts** | Exported figures (`topdown` in `diagram`/`true` mode, `controls`) | Mechanical gates (render gate, proportion gate) + a vision-judge subagent | Renders that fail; pictures that read wrong |
| **Interactive surfaces** | `viewer/` — stepper, HUD, `pov`, compare | Contract tests against the result contract; minimal boot smoke test | The viewer showing anything the engine didn't compute |

The rule that assigns mechanisms: **pixel gates verify artifacts; contract tests
verify behaviour.** An exported figure is a fixed picture, so it can be rasterized
and judged. A live viewer is not a picture — it is a function from (result, scrub
position, settings) to a view — so it is verified the way functions are: by
asserting its outputs equal the contract (`stateAt`, `sightFrom`) it claims to
display. Trying to pixel-gate the viewer, or to contract-test legibility, would
verify the wrong property at the wrong layer.

### 2.1 What survives from the prior regime, what dies, what replaces it

**Survives intact:** the three-independent-legs principle (engine tests, artifact
gates, and drift tripwires are never folded together); golden numerics with a
formal re-bless discipline; the `expect_fail` mistake oracle; the vision-judge rule
("never trust the author's own eyeball"); tolerance-based rather than bit-exact
cross-runtime determinism (deadbands on verdict boundaries, per the prior design's
deadband decision); tests before code; educational tests over coverage theater.

**Dies with the architecture (D1, D5):**

- The **cairosvg raster gate as the product gate.** The product is now the
  interactive viewer, which no raster gate can gate; and exported SVG may use
  features beyond cairosvg's subset. The render gate survives *scoped to static
  exports only* and is reimplemented on a headless-browser rasterizer (§7).
- The **no-`package.json` invariant** (the prior gate G0). D1 adopts a normal
  TS/ESM toolchain. Its replacement discipline: a committed lockfile, a pinned
  runtime version, and a dependency-free `core/` (dependency budget is owned by
  `07-viewer-animation-and-pov.md`).
- The **hand-synced two-list load-order invariant.** ESM imports make load order
  structural; there is nothing left to keep in sync by hand, hence nothing to gate.
- The **scene→chapter stamp idempotence gate.** There is no HTML course in scope
  (D5). Its spirit — regeneration must be a no-op when nothing changed — survives
  as export determinism: the same scenario, settings, and tool version produce a
  byte-identical SVG export on the pinned runtime (§3.1).

**New:** projection property tests and the proportion gate (§5); interactive-surface
contract tests (§6); schema-effectuality tests enforcing D8 (§8).

---

## 3. Engine verification

### 3.1 Determinism as a contract

The engine is a pure function of its inputs. Enforced properties:

- No wall-clock, no randomness, no locale-dependent formatting anywhere in
  `core/`, `road/`, `sight/`, `plan/`, or `solve/`. IO lives only in `cli/` and
  `viewer/`.
- Stable ordering everywhere results are assembled (sorted keys in canonical JSON;
  arrays ordered by `s` or by declaration order, never by map iteration).
- One float-emission rounding policy applied only at the result boundary (owned by
  `05-result-contract-and-inspection.md`); raw samples are never rounded.
- **Bit-exact goldens are scoped to the pinned runtime** (the Node version in the
  repo's toolchain config). Across runtimes — including the browser — results are
  **tolerance-equal**, with discrete-verdict flips prevented by the deadbands
  specified in `02-physics-model.md`, not by chasing cross-engine bit equality.
- Same scenario run twice → identical `result_hash` (named test `P-DETERMINISM`).
- Same scenario + render settings + tool version → byte-identical SVG export on
  the pinned runtime (`P-EXPORT-DETERMINISM`).

### 3.2 Golden numerics

`02-physics-model.md` defines the canonical scenarios (the canonical corner and its
companions) and their worked numbers. The suite pins, for each golden scenario:
apex station and lane fraction, exit lane fraction, peak lean, minimum speed, event
stations, and the verdict's outcome and check results — each compared under
explicit numeric tolerances (positions ±0.01 m, angles ±0.01°, speeds ±0.01 m/s —
TUNING; the tolerance table lives beside the fixtures, in one place).

Golden values are produced by the engine and *blessed*, never hand-computed into
the fixtures — hand-editing a golden to make a test pass is forbidden. Independent
cross-checks (a separate script re-deriving a golden quantity from the equations in
`02-physics-model.md`, e.g. steady-state lean from radius and speed) are welcome as
*additional* tests but never replace the blessed fixture.

### 3.3 Result hashing and the re-bless procedure

Every registered preset and every committed scenario file gets `spec_hash` (over
the canonicalized input) and `result_hash` (over the canonicalized verdict and
resampled trajectory, excluding free-text diagnosis fields so diagnostics can grow
without perturbing hashes). A tripwire test recomputes both for the whole set via
the same loaders the bless script uses and asserts equality against the committed
fixture — any drift outside a re-bless commit is a failure.

Two deliberate decouplings distinguish this from the prior tripwire:

1. **Hashes protect presets and goldens only — never figures.** No exported figure
   is baked into a committed teaching artifact this time (D5), so a physics change
   no longer implies re-rendering and re-judging committed chapters. This removes
   the prior project's most painful coupling ("Do NOT fix casually").
2. **A physics change is a migration, not a patch.** The re-bless procedure: one
   dedicated commit that (a) contains the physics change, (b) regenerates all
   hashes and goldens via the bless script, (c) enumerates in its message every
   golden whose values moved and why, (d) re-pins the mistake-oracle outcome table
   (§4) if any outcome class changed, and (e) triggers a fresh vision judge for any
   figure re-exported afterwards. Hashes move in re-bless commits and nowhere else.

The Tier 1R run-wide slice itself lands through exactly this procedure.

### 3.4 Property tests (named)

Run against fuzzed schema-valid scenarios as well as the fixtures. Each is one
sentence here; thresholds and constants belong to `02-physics-model.md`.

- `P-ELLIPSE` — at every emitted sample the friction-ellipse magnitude is ≤ 1 plus
  the deadband; the clip inside every integrator sub-stage never emits a sample
  beyond grip.
- `P-KAPPA` — the emergent-curvature identity `kappa = g·tan(phi)/v²` holds at
  every sample above the low-speed floor, within tolerance.
- `P-ROLLRATE` — the realized roll rate never exceeds the rider profile's cap.
- `P-RUNWIDE-WIDEN` — a `chop` or brake applied at lean produces a line at or wider
  than the unperturbed line from the perturbation station on; never tighter.
- `P-RUNWIDE-UPRIGHT` — the run-wide term contributes nothing at zero lean:
  straight-line braking is byte-identical with the slice on or off.
- `P-RUNWIDE-MONOTONE` — within the model's stated validity range, a harder chop at
  the same lean widens the line monotonically.
- `P-EMERGENT-APEX` — no input field can pin the apex: the schema rejects any
  `apex` field or `apex:<id>` plan anchor at core validation (D7), and fuzzing
  confirms apex station responds only through physics-relevant inputs.
- `P-EVENT-BRACKET` — every crash/stop/road-end crossing is located between the
  last conforming and first violating step, within one time step.
- `P-RESAMPLE` — the arc-length grid is strictly monotone in `s`, `t` is monotone,
  and interpolated fields lie between their bracketing raw samples.
- `P-SIGHT-EYE` — `sightFrom` is a pure function of (road, eye, occluders); moving
  the eye laterally toward the outside of a blind corner never *shortens*
  `sight_m` (the hold-wide doctrine's geometric premise, per D4).

---

## 4. The mistake oracle (carried)

Every mistake preset — one per kind in the closed set `premature`, `early_apex`,
`slow_steer`, `fifty_pence`, `chop`, `overspeed`, compiled by `compileMistake` —
declares via `expect_fail` which doctrinal check it exists to teach. The suite
forward-runs each compiled mistake through the real engine and asserts the declared
check **actually fails** and the outcome class matches the pinned table. Reconciled
both ways: an expected failure that doesn't occur, or an unexpected one that does,
is a red suite.

The oracle's iron rule is carried verbatim: **a mismatch is an engine, compiler, or
doctrine bug — never fixed by editing the expectation.** The single legitimate
occasion to edit the pinned outcome table is a designed physics migration landing
through §3.3's re-bless procedure. The known first instance: when the Tier 1R
run-wide slice lands, `chop`'s outcome class changes from the prior inward-pinch
violation to the book's run-wide — deliberately, in that one commit, with the
change called out in the migration notes and the affected doctrine checks
re-verified.

Because failed lines are first-class objects (D6), the oracle extends one step
beyond the prior design: for every mistake kind, a round-trip test shares the
scenario + mistake spec through the export path defined in
`05-result-contract-and-inspection.md`, recomputes it as a consumer would, and
asserts the recomputed trajectory is tolerance-equal to the original. What is
shared is inputs; what is displayed is always recomputed — this test is the
mechanical form of that honesty rule.

---

## 5. Projection verification (new)

The diagram projection (owned by `06-rendering-and-projection.md`) is the one place
linelab deliberately draws something other than true geometry. It is therefore the
most heavily property-tested rendering component: a projection bug would produce
figures that are *plausible and wrong*, the exact failure class this project
exists to eliminate.

### 5.1 Projection invariants (named property tests)

For every line in a figure, comparing true-geometry samples with their projected
images:

- `P-PROJ-ORDER` — the arc-order of stations and events (turn-in before apex
  before exit; every event's ordering) is preserved.
- `P-PROJ-CONTAIN` — a sample on the road surface in true geometry projects inside
  the projected road polygon; off-road stays off-road.
- `P-PROJ-SIDE` — side-of-centreline sign is preserved at every sample.
- `P-PROJ-APEX-REL` — between any two lines, relative apex relationships (earlier/
  later station, tighter/wider lane fraction) are preserved.
- `P-PROJ-CROSS` — two lines cross in projection exactly as often, and in the same
  station order, as in true geometry.
- `P-PROJ-IDENTITY` — `mode=true` is the identity projection, byte-exactly.
- `P-PROJ-MARKER` — every marker and callout anchor (corner-relative, per the
  scheme in `03-roads-scenarios-and-visibility.md`) lands on its line's projected
  image, never in empty space.

These run on fuzzed roads and line sets, not only fixtures — the projection must
hold its invariants for anything the road DSL can express.

### 5.2 The proportion gate (mechanical)

The gate that makes the stretched-paths defect class *detectable*, which the prior
regime structurally could not (its audits never measured framing, so an 8–10×
proportion gap shipped invisibly). For every exported `topdown` figure the
renderer emits a sidecar metrics record; the gate validates, against book-derived
target bands owned by `06-rendering-and-projection.md`:

- drawn road-width : centreline-radius ratio (book band ≈ 0.55–0.9 — TUNING,
  measured from the book's figures);
- straight : arc share of the drawn frame;
- road-ink coverage of the frame (the road must dominate the figure, not the
  margins).

Out-of-band in `diagram` mode is a **failure**; in `true` mode it is a warning
(true-scale figures are allowed to be honest rather than compact). An audit mode
re-derives the metrics from the SVG geometry independently of the sidecar, so the
renderer cannot self-certify.

### 5.3 The presets keep the projection mild

The book-proportioned road presets (owned by `03-roads-scenarios-and-visibility.md`
and `06-rendering-and-projection.md`) exist so that `diagram` mode is a gentle
correction, not a rescue. Round-trip test: each book preset rendered in **`true`
mode** must already land near the proportion bands. If a preset needs violent
compression to pass the gate, the preset is wrong, not the projection.

---

## 6. Interactive-surface contract tests (new)

The viewer is verified as a pure view-model, headlessly, against the result
contract. Pixel testing of the viewer is limited to one boot smoke test per view
(`topdown`, `controls`, `pov`): it renders without error on a fixture scenario.
Everything of substance is a contract test:

- `C-STATEAT-LAWS` — the interpolation laws pinned in
  `05-result-contract-and-inspection.md` hold: endpoint exactness (querying a
  sample's own `s` or `t` returns that sample), monotone `s`↔`t` mapping,
  angle-aware interpolation for `psi` and `phi` (no wraparound smear), and typed
  Result errors outside the trajectory's domain.
- `C-HUD-EQUALS-STATEAT` — at any scrub position, every HUD field equals the
  corresponding field of `stateAt(result, {t})`. **The viewer never re-derives
  physics**; this test is the enforcement.
- `C-BOOKMARKS` — the stepper's named jump targets are exactly the result's events
  and plan stations; jumping lands the scrubber at the event's interpolated `t`.
- `C-COMPARE` — in compare mode, each line's ghost state equals its own `stateAt`;
  lines never share or leak state.
- `C-POV-LIMIT-CONSISTENT` — at any sample, the POV's limit-point marker and the
  `topdown` view's limit point are projections of the *same* `sightFrom` result —
  identical world coordinates before view projection.
- `C-POV-TRUE-GEOMETRY` — the POV consumes only true-geometry trajectories and
  road edges. Enforced structurally (the projection module is imported only by the
  diagram-mode render path, never by `viewer/` POV code — an import-graph lint)
  and behaviourally (POV output is byte-identical across all projection settings).
- `C-ONE-CORE` — a scenario loaded in the viewer recomputes a trajectory
  tolerance-equal to the CLI's for the same scenario and version. Under D1 this is
  the same ESM module imported twice, so the test is cheap — but it stays, because
  it is the guarantee that makes viewer-side recomputation of shared scenarios
  (D6) honest.
- `C-RECOMPUTE-BUDGET` — recomputing a loaded figure (all lines, solve included)
  completes within the ≤ 100 ms budget `07-viewer-animation-and-pov.md` §2.1
  promises, measured on the largest committed preset figure (the linked-chain
  fixture) in CI with a generous machine-variance multiplier (×3 TUNING). This is
  a regression tripwire for the recompute-in-viewer doctrine, not a benchmark: if
  the engine ever grows past interactive recompute, D6's share-and-recompute story
  needs a redesign, and this test is where that surfaces first.

---

## 7. The render-then-vision-judge loop (adapted)

Scope: **static exported figures only.** The loop does not apply to the live
viewer (§6 covers it).

1. Export the figure (`render` via the CLI, per `08-cli-and-agent-interface.md`).
2. **Mechanical leg.** A headless-browser rasterizer (replacing cairosvg — exported
   SVG is no longer constrained to cairosvg's feature subset) renders every SVG to
   PNG at 2× scale on a white background, writing a manifest; any render failure is
   a non-zero exit. The proportion gate (§5.2) runs on the same artifacts. Both
   gates must be green before judging.
3. **Judge leg.** A separate vision-capable subagent reads the PNGs and judges
   them against the rubric in `01-scope-and-doctrine.md` on the two axes: physical
   plausibility and doctrinal correctness (colour-by-verdict per D9, marker
   vocabulary, labels anchored on-line, mistakes reading as the mistakes they
   teach). The rule is carried verbatim: **the editing agent never trusts its own
   eyeball; the subagent's visual verdict — not the arithmetic — is the gate.**

Axis A remains largely true by construction — every line is engine-produced, so
the judge's attention goes to Axis B and legibility. One new judging duty exists
under D2: in `diagram` mode, confirm the projection disclosure note is present and
the picture still *reads* physically sensible after compression — the projection
invariants (§5.1) prove ordering and containment, but only eyes can confirm the
compressed figure doesn't visually lie.

---

## 8. Testing philosophy

Carried from the house rules, with the prior project's hard-won additions:

- **Tests before code** for every published contract: the scenario schema,
  `stateAt`, `sightFrom`, the projection, the CLI verb table. The contract test is
  written from the design doc, then the implementation is written to it.
- **Educational tests.** The suite doubles as usage documentation: a reader should
  learn how to author a scenario, compile a mistake, and query a result by reading
  the tests. Test names state behaviour, fixtures are realistic scenarios, and at
  least one test file per subsystem is written as a narrated walk-through.
- **Silent-failure coverage — the D8 effectuality tests.** The prior design's
  cautionary tale: `position` plan actions validated and then silently did
  nothing. Under D8 that class is a standing test target: **for every
  schema-accepted input surface, a test asserts an observable effect** — every
  plan action type changes the trajectory of a reference scenario, every road DSL
  construct changes the road, every mistake kind changes the outcome or line,
  every `view:` control changes the render. An input with no effect test does not
  ship.
- **No coverage theater.** A test must either teach usage or trap a failure that
  would otherwise be silent. Tests written to move a coverage number are rejected
  in review.
- The test runner is the standard TS/ESM toolchain runner, exposed through the CLI
  with gate-friendly JSON output and the exit-code tiers owned by
  `08-cli-and-agent-interface.md` (0 all-green; the doctrine-gate tier on any
  failure).

---

## 9. Relation to the prior design

**Carried:** the three-legs principle; golden numerics with bless-never-hand-edit;
the byte-stability tripwire and its one-commit re-bless discipline; the
`expect_fail` mistake oracle and its never-edit-the-expectation rule; the
render-then-vision-judge loop with mandatory subagent judging; tolerance-based
cross-runtime determinism with deadbands; tests-before-code and educational-test
philosophy (`extract/07-tooling-and-verification.md` §§1, 5, 6, 8;
`extract/08-design-decisions-and-rationale.md`, verification and process
decisions).

**Changed:** the raster gate shrinks from product gate to static-export gate and
moves from cairosvg to a headless browser; result hashing decouples from figures
(no committed teaching artifact depends on engine bytes, dissolving the prior
"Do NOT fix casually" coupling); physics changes become first-class migrations
with a defined procedure; the mistake oracle gains the D6 share-and-recompute
round-trip.

**Dropped:** the no-`package.json` gate, the hand-synced load-order invariant, and
the scene→chapter stamp idempotence gate — each died with the architectural
decision (D1, D5) that made it meaningful. Their replacement disciplines: lockfile
plus pinned runtime; the ESM import graph; export determinism (§3.1).

**New:** projection invariant properties and the proportion gate — the mechanism
that makes the stretched-paths defect class detectable, which the prior regime
never could; interactive-surface contract tests including `C-HUD-EQUALS-STATEAT`,
`C-POV-TRUE-GEOMETRY`, and `C-ONE-CORE`; and the D8 effectuality tests that make
"schema-valid implies effectual" mechanically enforced rather than aspirational.
