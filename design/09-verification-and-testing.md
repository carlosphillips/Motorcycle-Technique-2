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
the analytic-acceptance layer that gates every bless, golden numerics, hashing,
re-bless, property tests, the gated continuation-envelope suite (§3.4a),
solver-intent and visibility tests, and CLI/cold-start acceptance (§3); the mistake oracle and the doctrine-rubric acceptance suite (§4);
projection verification, the proportion gate, and annotation verification (§5);
contract tests for the result contract, stepper, POV, share-URL skew, and the
recompute budgets (§6); the adapted render-then-vision-judge loop and its
committed-record machinery (§7); the testing philosophy and the D8 effectuality
harness (§8); the relation to the prior regime (§9); and the phase gates (§10).

Contracts referenced here are owned elsewhere: the physics model, its canonical
scenarios, and the generated blessed-values block by `02-physics-model.md` (§8.1);
the scenario schema and the single normative outcome-pin table by
`03-roads-scenarios-and-visibility.md` (§7.1); the result contract, `stateAt`, the
hash law, and the FigureSpec stamps and skew tiers by
`05-result-contract-and-inspection.md` (§8.3, §8.1, §8.4); the projection, colour
law, and proportion bands by `06-rendering-and-projection.md`; the viewer and POV
by `07-viewer-animation-and-pov.md`; CLI verbs, exit tiers, and recipes (a)–(j) by
`08-cli-and-agent-interface.md`; the doctrine rubric and the 16-check catalogue by
`01-scope-and-doctrine.md` (Appendix A); build phasing by `00-README.md`. This
document defines only how each of those is *verified*.

---

## 2. Verification philosophy: three layers, three mechanisms

| Layer | Surface | Mechanism | Catches |
|---|---|---|---|
| **Engine** | `core/`, `road/`, `sight/`, `plan/`, `solve/` | Analytic-acceptance layer + golden numerics with tolerances + property tests + determinism hashing | Physics drift, invariant violations, nondeterminism — and, via the analytic layer, incorrectness at first bless |
| **Static artifacts** | Exported figures (`topdown` in `diagram`/`true` mode, `controls`) | Mechanical gates (render gate, proportion gate) + a vision-judge subagent gated in CI by committed judge records | Renders that fail; pictures that read wrong |
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
formal re-bless discipline; the mistake oracle; the vision-judge rule
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

**New:** the analytic-acceptance layer that anchors correctness outside the engine
(§3.2a, D35); projection property tests and the proportion gate (§5); annotation
and ink verification (§5.4); interactive-surface and result-contract tests (§6);
the committed-record discipline for nondeterministic judges (§7, D36); the
decidable D8 effectuality harness (§8.1); CLI and cold-start acceptance (§3.6);
solver-intent and visibility tests (§3.5); and the phase gates (§10, D37).

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
  the pinned runtime (`P-EXPORT-DETERMINISM`). Quantifier: the committed scene
  corpus plus fuzzed scenes, on the pinned runtime and tool version. Cache
  independence: warm-cache and cold-solve exports of the same figure are
  byte-identical — the SVG embeds no timings and no solve-path provenance
  (enforced alongside `C-CACHE-HONEST`, §6).

### 3.2a The analytic-acceptance layer (pre-bless)

A closed set of tests whose expectations are **closed-form, hand-computed, and
normative** — the single designed exception to "goldens are blessed, never
hand-computed" (the rule inverts here because the ground truth is arithmetic, not
the engine). All `A-AN-*` tests read **raw pre-emission samples**, ignore verdicts
and doctrine checks entirely, and must be green before any bless is permitted.
Without this layer the first bless would certify nothing — the engine would grade
its own homework, and the suite would thereafter detect only drift, never
correctness.

Analytic fixtures (committed under `verify/analytic/`; all `profile: street`,
`mu: 1.0`; the point-mass fixtures use `use_full_width: true` and a wide carriageway
`lane 8` so containment and off-road termination never interfere with the physics
under test. The **one exception is `A-AN-SOLVER-KISS`** below, deliberately
corridor-mode on `C30`'s own `lane 3.5` road, because its purpose is to exercise the
corridor / lane-fraction search that `use_full_width` would switch off):

| Test | Fixture | Road / plan | Closed-form expectation | Tolerance |
|---|---|---|---|---|
| `A-AN-RADIUS` | `F-AN-CIRCLE` | `lane 8 \| S 10 \| R 30 ^270 \| S 10`, start `d=0`, entry `42.17 km/h` (= `sqrt(G·30·tan 25°)` = 11.715 m/s), plan: `turn_in {lean_deg: 25}` at `entry:c1`, `throttle accel=0` at `entry:c1` | On the steady span (from `turn_in + 2·(25°/roll_rate)` to arc end): `kappa = G·tan(phi)/v²` per sample; path radius `1/kappa = 30.000 m`; a circle fitted to `(x, y)` samples has `r = 30.00 m` | identity ≤ 1e-9 relative; `1/kappa` ± 0.001 m; fitted radius ± 0.01 m |
| `A-AN-BRAKE` | `F-AN-BRAKE` | `lane 8 \| S 400`, entry `100 km/h` (27.778 m/s), plan: `brake decel=3.0` at `at_s=50`, held (default `slew_mss = A_SLEW_DEFAULT = 6.0`) | the brake command is **slew-limited** (`02-…md` §3), so the closed form carries the ramp term: from brake onset `t_b` it ramps `0 → −3.0` over `t_r = 3.0/slew = 0.5 s`; during the ramp `v(t) = v0 − (slew/2)·(t − t_b)²`, and after it `v(t) = v1 − 3.0·(t − t_b − t_r)` with `v1 = v0 − 3.0²/(2·slew) = 27.028 m/s`; `stopped` termination at `s* = 50 + [v0·t_r − slew·t_r³/6] + (v1² − v_floor²)/(2·3.0) = 50 + 13.764 + 121.083 = 184.85 m`. (The pre-amendment form `s* = 177.93 m`, `v(t) = v0 − 3.0·t` omitted the default slew and was **unsatisfiable** by a correct engine — off by 6.91 m on `s*` alone; `review/verify/fixture_geometry.py` check 6.) | `s*` ± 0.01 m; `v(t)` ≤ 1e-9 relative |
| `A-AN-ROLL` | `F-AN-ROLL` | `lane 8 \| S 200`, entry `54 km/h` (15 m/s), plan: `turn_in {lean_deg: 30}` at `at_s=20` | ramp duration `30°/roll_rate = 0.600 s`; interior ramp slope = `roll_rate` (50°/s street); zero overshoot; `phi` holds at 30° after arrival; `\|phi_dot\| ≤ roll_rate` throughout (stand-up inactive: `a_cmd = 0`) | duration ± 2·dt (± 0.010 s); slope ± 0.5 °/s; overshoot ≤ 0.01° |
| `A-AN-RK4` | `F-AN-ACCEL` | `lane 8 \| S 400`, entry `36 km/h` (10 m/s), plan: `throttle accel=2.0` at `at_s=0` (default `slew_mss = A_SLEW_DEFAULT = 6.0`) | the throttle command is **slew-limited** (`02-…md` §3): it ramps `0 → 2.0` over `t_r = 2.0/slew = 0.3333 s`. During the ramp `a(t) = slew·t`, `v(t) = 10 + (slew/2)·t² = 10 + 3t²`, `x(t) = 10t + (slew/6)·t³ = 10t + t³`; after it (`t > t_r`) `v1 = 10 + (slew/2)·t_r² = 10.3333 m/s`, `v(t) = v1 + 2.0·(t − t_r)`, `x(t) = x(t_r) + v1·(t − t_r) + (t − t_r)²`, and `v(s)` follows from the piecewise `x(t)`. RK4 is exact on each polynomial arc (cubic-in-`t` during the ramp, quadratic after) — any deviation is a stage-weight/dt wiring bug. (The pre-amendment forms `v(t) = 10 + 2t`, `x(t) = 10t + t²` assumed constant `a = 2.0` from `t = 0` and ignored the same default slew — **unsatisfiable**, ~3.2e7× the 1e-9 band; `fixture_geometry.py` check 6.) | ≤ 1e-9 relative, all limbs |

Four further analytic entries attach to the counterfactual layer and the
continuation envelope. The first ships with the corrective shot; the last three
are **gated** (D45) and run only at promotion (§3.4a):

- **`A-AN-SAVE-POLICY`** on `F-AN-SAVE` (`lane 8 | S 40 | R 60 ^90 | S 60`,
  `use_full_width`, street, `mu 1.0`, entry 43.2 km/h). With `a_cmd = 0` and no
  drag in Tier 1R, `v` is exactly constant through the shadow, so two closed
  forms are hand-computable and asserted on the shadow's raw pre-emission
  samples: the heading turned during the roll ramp equals
  `(G / (v · roll_rate)) · ln(sec φ_res)` (the closed form the release predicate
  uses, `02-physics-model.md` §3.1) to ≤ 1e-6 rad, and the post-ramp path is a
  circle of radius `v² / (G · tan φ_res)` to ±0.01 m by circle fit. At street /
  `mu 1.0`: `φ_res = atan(0.85) = 40.364°`, `roll_rate = 0.87266 rad/s`, ramp
  `t_r = 0.807 s`; at `v = 12 m/s`, ramp heading `= 14.605°` and `R = 17.27 m`.
  This is a legal hand-computed expectation under D35.
- **`A-AN-TRUNCATE`** (D45, gated) — `truncateAt` on
  `lane 8 | S 10 | R 30 ^270 | S 10` **and on `bookDecreasing`'s road** (whose
  `R 16>9 ^130` clothoid carries a real taper token) at 20 stations each: composed
  length equals the requested `s` to ≤ 1e-9 relative; the truncated road's dense
  lookup is byte-identical to the parent's on `[0, s]`; the taper split matches the
  closed-form quadratic of `03-roads-scenarios-and-visibility.md` §7a.4 to ≤ 1e-9.
  **The taper-split limb (iii) is empty on `R 30 ^270`, which is a pure arc with no
  taper token — it needs `bookDecreasing`'s clothoid, where a split lands inside a
  taper.**
- **`A-AN-MEMBER-KAPPA`** (D45, gated) — for every `σ` on every preset, the
  composed member's `κ(u)` matches `03-…md` §7a.4's `κ_m(u)` to ≤ 1e-6 1/m
  except inside `R_FLAT_M` clamping spans, which are asserted to be exactly the
  declared spans.
- **`A-AN-SWEEP-BUDGET`** (D45, gated) — for every `σ` on every preset, the
  composed member's accumulated sweep over the curved tail equals
  `min(member_sweep_max_deg, ∫|κ_m|)` to ≤ 1e-6 deg, and is strictly below
  `SWEEP_UTURN_MIN` (`03-…md` §2).

**The bootstrap procedure (normative order):**

1. `A-AN-*` green.
2. `D-BOUNDS` green — the a-priori doctrinal bound assertions
   `02-physics-model.md` §8 states for `C30`, promoted to named tests: outcome
   `contained` with quality `good` (the derived `clean` predicate);
   `apex_pct ∈ (50, 90)`; `phi_max ≤ 40.36°` (the street reserve);
   `ellipseMag ≤ 1` at every sample. These are design pins, not goldens: they
   exist before the engine does.
3. Only then is `bless` permitted: **the bless script mechanically refuses
   (exit 3) unless steps 1–2 are green in the same invocation.** This is
   enforcement, not procedure.
4. The bless writes the golden fixtures (raw full-precision f64, captured by a
   bless-only tap *before* emission rounding) **and writes the blessed values
   back into `02-physics-model.md` §8.1** (below).

**The write-back format.** `02-physics-model.md` §8.1 ("Blessed values
(generated)") holds a generated block:

```
<!-- BLESSED:BEGIN engine=<semver> date=<YYYY-MM-DD> -->
| fixture | quantity | value | unit | tol |
|---|---|---|---|---|
| C30 | turn_in_s | … | m | ±0.01 |
| C30 | apex_pct | … | % | ±0.1 |
| … (exactly the quantities 02 §8 enumerates, for C30, C30-chop, C30-trailbrake, C30-DR) |
<!-- BLESSED:END -->
```

Written only by `linelab-bless --write-docs`; hand edits between the markers are
forbidden; named test `T-BLESSED-DOC-SYNC` regenerates the block from the
committed fixtures and asserts byte equality (it runs in the normal suite, so 02
can never claim numbers the fixtures don't hold). Correctness is anchored outside
the engine (analytic layer + design-pin bounds), and 02's worked-numbers claim is
*true by generation*.

**The analytic layer must touch the solver at least once.** The five `A-AN-*`
fixtures above all carry authored plans (`use_full_width`, `d = 0`) that invoke
the solver **zero times** — no corridor, lane-fraction, turn-in or apex search
runs — so on the analytic layer alone a solver that produces a systematically
wrong *line* still passes the green-gate that precedes the first bless. One
closed-form **solver** assertion closes this:

- **`A-AN-SOLVER-KISS`** — `C30` (`R 30 ^90`) solved with the default out-in-out
  solver in **corridor mode** (**not** `use_full_width`; the header exception): the
  apex sample kisses the corridor's inner edge — `f_apex ≤ KISS_TOL_F` (`= 0.05`,
  the doctrinal kiss band) — a geometric ground truth re-derived from the road DSL,
  **not** a value read back from `solved.plan`. The bound is the kiss *band*, not a
  tighter `eps_f`: a correct clean apex lands anywhere in `[0, KISS_TOL_F]`, so
  pinning `f_apex = 0 ± 0.01` would make this gate itself **unsatisfiable** — the
  very failure class §3.2a's analytic layer exists to catch. This is the one
  pre-bless assertion that actually exercises corridor + lane-fraction + turn-in +
  apex search; a solver whose apex falls short of the inside (`f_apex > KISS_TOL_F`)
  or reads its own stored constant back fails here before it can be blessed. Read on
  the raw pre-emission samples, like every `A-AN-*`.

**The bless refusal is a named test with a negative arm, not prose.** Step 3's
mechanical refusal is *verified*, not merely stated:

- **`A-BLESS-REFUSES`** — with a deliberately reddened analytic layer (one
  `A-AN-*` expectation or one `D-BOUNDS` pin forced to fail in a throwaway
  fixture), `bless` exits `3` and writes **no** golden fixture and **no**
  `02 §8.1` block; with the layer green it exits `0` and writes them. The
  negative arm is what proves the green-gate cannot be routed around — the
  bootstrap procedure's step-3 mechanical refusal (above) is otherwise a claim no
  test exercises.

### 3.2 Golden numerics

`02-physics-model.md` defines the canonical scenarios (the canonical corner and
its companions) and the pinned quantity list; the *values* are produced by the
first bless and written back into 02 §8.1's generated block (§3.2a). The suite
pins, for each golden scenario: apex station and lane fraction, exit lane
fraction, peak lean, minimum speed, event stations, and the verdict's outcome and
check results — each compared under explicit numeric tolerances (positions
±0.01 m, angles ±0.01°, speeds ±0.01 m/s — TUNING; the tolerance table lives
beside the fixtures, in one place). The tolerance table carries a category row
for **discrete grid-derived quantities** (coarse-sweep turn-in station,
resample-grid apex argmin): exact equality on the pinned runtime; ± one grid
quantum (2 m coarse step / `ds_m`) wherever a cross-runtime comparison is made —
tolerance category must match quantity category.

Golden values are produced by the engine and *blessed*, never hand-computed into
the fixtures — hand-editing a golden to make a test pass is forbidden — with one
designed exception: the analytic-acceptance fixtures (§3.2a), whose expectations
are closed-form and normative. Golden fixtures store raw doubles; golden
comparisons run raw against the tolerance table; the emission-rounding policy
(05 §8.3) is verified by a separate 05 contract test and never entangled with
goldens. Independent cross-checks (a separate script re-deriving a golden
quantity from the equations in `02-physics-model.md`) are welcome as *additional*
tests but never replace the blessed fixture.

**The golden roster.**

*The canonical corner and its perturbations:*

- `C30` (extended) — the canonical golden additionally pins: the `release` event
  station; at the `exit` event `|heading_err_deg| ≤ 1.0`; at `road_end`
  `|phi| ≤ 0.25°` and `f` inside the usable corridor; outcome `contained`,
  quality `good` (the derived `clean` predicate). The exit straightens by
  construction, and this golden asserts it.
- `C30-LR` — two-corner alternating-hand golden: road
  `lane 3.5 | S 35 | R 30 ^70 | S 10 | L 30 ^70 | S 25`, street profile, entry
  70 km/h, authored as an explicit wire plan with two `turn_in`s, `hand` omitted
  on both (pure inference, isolated from `chainedSolve`). Pins: governing corners
  resolve to `c1`(R)/`c2`(L); `phi` crosses zero exactly once between the corners
  (sign sequence + → 0 → −, monotone through the flip); a `release` event exists
  for the final commitment; corner 2's exit straightens under `C30`'s three exit
  assertions.
- `C30-chop` (updated) — default chop (`slew 40`, `freeze_s 1.0`, `roll_cmd = 0`
  during the freeze): outcome pinned `runoff` (the fixture pin, 03 §7.1); asserts
  ≥ 1 sample with `|phi_dot| > roll_rate` and `phi_dot_su ≠ 0` (exercises
  `P-ROLLRATE-EXCESS`); passes `P-ROLLRATE` by design after its tracker rescope.
- `C30-trailbrake` (updated) — 2.0 m/s² taper past turn-in at default slew: still
  tightens; asserts `phi_dot_su = 0` at every sample (the recorded-channel
  replacement for any slice-off comparison).
- `C30-squeeze` — mid-corner brake to 2.0 m/s² at `slew 4`: `phi_dot_su ≡ 0`, the
  line tightens — "gently squeezing on the brake mid-corner" pinned as
  expressible.
- `C30-heldbrake` — **explicit-plan fixture in the clipped-widening regime** (the
  sustained-hold twin of `C30-deeplean`): onset lean 40° (R30 steady at
  `v ≈ 15.7 m/s`, so `a_long_avail ≈ 5.3 m/s²`), start `f = 0` (inside, so the
  widening has corridor to run into), commanded `−8.0 m/s²` at default slew **held
  to termination** — above `a_long_avail`, so the command clips throughout and
  `b_dem > b_del`. Asserts: the clipped-regime predicate (W) becomes true and
  **stays** true over the whole hold; `kappa` non-increasing while it holds; **lane
  fraction moves *outward* across the entire hold**; outcome in the run-wide class;
  no crash. (The prior fixture commanded `−8.0` from the ordinary C30 corner speed,
  where the lean was too shallow to clip: the line moved *inward* and terminated
  `off_road`, so the outward excursion the doctrine's sustained-hold half depends on
  was identically zero at every cell of the `f₀ × onset-lean` sweep. Widening in
  this regime is engine-blessed like every golden; if it does not appear it is an
  engine/doctrine finding under the oracle's iron rule, never an edited pin.)
- `C30-deeplean` — explicit-plan fixture: `lean 40°`, `v ≈ 15.7 m/s` (R30 steady
  state), commanded −9.0 m/s² held: asserts `clipped = true`,
  `b_dem − b_del ≈ 3.7 m/s²`, sustained `phi_dot_su < 0`, the path widens, no
  crash.
- `C30-stop` — straight-line hard brake to zero: `terminated.reason = "stopped"`
  with the bracketed crossing at `v_floor_ms`, outcome `stopped`, no
  `below_validity` flags (upright).
- `C30-chop-sweep` — fixture family: chop at `slew ∈ {10, 20, 40, 80}` — the
  `P-RUNWIDE-MONOTONE` instantiation.
- `book90-ideal` — solved turn-in station, `apex_pct`, and roll-on onset on the
  `book90` preset (the road the first three book figures stand on gets its own
  golden, not only C30).

*Corrective shot and termination:*

- `G-CORR-RUNOFF` — `book90` (left-hand default) + `premature` (= the oracle
  fixture `F-ORACLE-90`): outcome `runoff`; `corrective.feasible = false`;
  `terminated.reason = "off_road"`; the terminal sample satisfies
  `|d| = lane_width_m ± 0.05 m` — the endpoint is *on* the edge.
- `G-CORR-WIDE` — `book90 hand=R` (the mirrored twin) + `premature`: outcome
  `wide`; `corrective.feasible = true`; `returned.s` recorded and pinned with
  tolerance; the drawn line still carries its own (uncorrected) endpoint.
- `G-OFFROAD-BRACKET` — extends `P-EVENT-BRACKET`: the `off_road` crossing lies
  between the last on-road and first off-road integrator step, within one step.
- `G-STOPPED` — a straight-road hard-brake-to-floor scenario:
  `terminated.reason = "stopped"`, outcome `stopped`, exit tier 0, quality
  `caution` (amber).

*Position channel:*

- `G-POS-REACH` — `FX-POS-STRAIGHT` (§8.1) at 28/34/50 km/h variants: the
  soundness link between the reachability predicate and the tracker law — every
  variant the validator *accepts* has `requested Δd ≤ dd_max` (the move is within
  the window's physical capacity) and completes (`position_complete` fires inside
  the window) with achieved displacement `≥ requested Δd − eps_m`; and a variant
  the validator *rejects* emits `position_shortfall`, never a silent under-move.
  The lower bound is the *requested* move the predicate admitted — **not**
  `dd_max/K_REACH`, which is the reachability *ceiling* (`≈ 21.89 m` at 34 km/h,
  `8×` the `2.70 m` corridor and `12×` the `1.89 m` request) and can never be a
  lower bound on any in-corridor line. The reachability formula is thereby pinned
  to the engine — a move the predicate calls reachable is delivered, one it calls
  unreachable is typed — not asserted against an unsatisfiable bound.

*Misjudgment and double apex:*

- `G-MISJUDGE-DR` — `bookDecreasing` + `mistake underread` (zero params →
  `r_believed = 16`): believed-world clean; executed outcome `runoff`;
  `misjudgment.s_divergence_m` inside the taper; hashes pinned.
- `G-8.5-RED` / `G-8.4-COMPANION` — the two shipped misjudgment scenes bake;
  per-line pinned outcomes, apex counts (`double`: 2 in the taper corner; `good`:
  1 in c1 + 1 in c3), check verdicts (including the `wrong_strategy_for_corner`
  fail on `double` and the double-apex `na` carve-outs on `good`), colours per
  06 §5.1.
- `G-APEXLIST` — `bookDoubleApex` + `style=double_apex`: `apexes` lists
  `[1, 0, 1]` across c1..c3 under the one hysteresis detector; `late_apex` reads
  the final apex; `apex` events carry `detail.index`.

*Presets, sight basis, checks, POV:*

- `G-PRESET-HANDS` — each shipped preset's resolved expansion and hand default
  match 03 §3.1's table (book presets default to their figure's ink hand;
  `book90` is a left-hander); `schema road-dsl` output carries the disclosure
  columns.
- `G-SIGHT-BASIS` — R12 inside-offset fixture: `sight_ride_m / sight_m` matches
  the geometric ratio within tolerance (the rider-path basis, D16, is measured,
  not assumed).
- `G-C30-CHECKVECTOR` — C30's clean run pins the full 16-id check vector (13–15
  `na` on a single corner; 11 `na` non-blind; 16 `na` non-decreasing; the rest
  pass).
- `G-POV-CLAMP-MIDCORNER` — `book90`, mid-corner sample (50 % sweep),
  `look: heading`: `markerState = clamped` and the arrow's horizontal sign points
  into the turn; pins the 36.8°-bearing-vs-30°-half-frame arithmetic so a future
  `fov_deg` re-tune that changes the behaviour is a deliberate re-bless.

*Counterfactual disclosure (D42).* No new fixture road is required; two existing
fixtures gain pinned expectations.

- `G-CORR-RIDER` — on `F-ORACLE-90`, the `correctiveShot()` document for the
  runoff line pins `rider: "lean_only_reserve"`,
  `predicate: "return_after_detect"`, and the rendered `explain` block pins the
  full `04-solver-and-authoring.md` §4c.7 lean-only disclosure sentence. Sited on
  the **out-of-hash** shadow document, so the golden carries no `result_hash` and
  **no re-bless is triggered** — `F-ORACLE-90`'s existing hashed goldens are
  byte-identical before and after D42.
- `G-CF-PRECONDITION-TABLE` — on `F-ORACLE-90` + `F-ORACLE-DR`, the six-row
  `R_res / R_road` table of `04-…md` §4c.4, recomputed from the shipped presets
  rather than transcribed, tolerance ±0.01 on the ratio. It fails the day a
  preset's entry speed or `phiReserve` moves without the law being revisited —
  which is exactly when the law needs revisiting.

*Standing (D43).* `standing` goldens are **categorical rows only** — the rung
token, each reserve row's verdict and instance count, and `reserved_blocked_by` —
under §3.2's discrete-quantity rule. No float is pinned, because `standing` pins
no float. The golden vector for every committed fixture gains one `standing` row,
and `F-STANDING-WARN` (§4) adds a fixture.

*Save window (D44).*

- `G-SAVEWIN-RUNOFF` — on the existing `G-CORR-RUNOFF` fixture (`F-ORACLE-90` =
  `book90` + `premature`): `status`, `tau_close_s`, `s_close_m`, `s_star_m`,
  `reaction_budget_s`, `runs`. Blessed, never hand-computed.
- `G-SAVEWIN-WIDE` — on the mirrored `G-CORR-WIDE` twin (`book90 hand=R`):
  `status: "resolved"`, `reaction_budget_s > 0`. Recorded beside it, as a
  **declared limitation of the scalar's cross-hand comparability**: the
  post-detect domain length is the crossing time of the strip between `f = 1.0`
  and the physical edge, which is `bike_margin_m` on the left-hander and the
  oncoming lane on the mirror. `reaction_budget_s` is comparable *within* a hand,
  not across one; the goldens pin both numbers and the docs do not invite the
  comparison.
- `G-SAVEWIN-GRID` — the `HORIZON_SCAN_DS_M` sensitivity, at **0.25 / 0.5 /
  1.0 m** (all three satisfy the resolution law of `04-…md` §4b.5; the retired
  2.0 / 4.0 m rungs do not and are now refusals, asserted as such). All three
  agree on `status` and on `tau_close_s` within `HORIZON_EPS_S`. Failure is a
  tuning finding, never a licence to widen the tolerance.
- `G-SAVEWIN-INTERMITTENT` — the refusal-branch fixture; §8.1 forbids dead
  branches, and this branch is what keeps D11 closed, so it must be reachable by
  a committed fixture. **The originally proposed mechanism does not exist and is
  not carried**: `04-…md` §4a.4 fixes the policy target as
  `phiReserve(skill · config.mu)`, a scenario scalar computed once, so a `mu`
  patch cannot move the target lean. The flicker must instead be produced through
  the path — a hazard patch under the *probe's* path that bites through the
  friction ellipse for a band of start instants only, so `saved` genuinely
  alternates. Construction is a named deliverable of the D44 work and the fixture
  is not blessed until `transition_count > 1` is observed at all three
  `G-SAVEWIN-GRID` rungs. The golden additionally pins that `rider`, `predicate`,
  `policy` and `placard` are **present** on the refusing object.
- `G-SAVEWIN-NEVER` — an `overspeed` line on `F-ORACLE-DR` where no reserve-lean
  save exists even at the earliest legal `τ`: `status: "never_open"`, no scalar,
  disclosure present.

**Tolerance category (new row in the tolerance table).** `tau_close_s` is a
bisection endpoint at a feasibility discontinuity and is structurally the most
brittle scalar the tool emits: out-of-hash but golden-pinned,
`tau_close_s ±0.05 s`, `s_close_m ±0.5 m`, `s_star_m ±0.5 m`, with `status` and
`transition_count` on **exact equality**. Expect it in the enumerated list of any
re-bless commit that moves the slice, `roll_rate`, `skill`, or `eps_f_save`.

### 3.3 Result hashing and the re-bless procedure

Every registered preset and every committed scenario file gets `spec_hash`
(over the canonicalized input, computed on the lowered form so scene text vs
JSON never changes identity) and `result_hash` (per the hash law in 05 §8.3:
FNV-1a over the canonical verdict minus that section's declared exclusion set,
which is owned there and never restated here, plus the resolved plan — so silent solver drift under an unchanged rounded
verdict is caught, and Sample appends alone move no hash). A tripwire test
recomputes both for the whole set via the same loaders the bless script uses and
asserts equality against the committed fixture — any drift outside a re-bless
commit is a failure. The tripwire also covers the share stamps in committed
FigureSpec fixtures: recomputed `engine_semver` / per-line `expected` stamps must
equal the committed stamps outside a re-bless commit.

Two deliberate decouplings distinguish this from the prior tripwire:

1. **Hashes protect presets and goldens only — never figures.** No exported figure
   is baked into a committed teaching artifact this time (D5), so a physics change
   no longer implies re-rendering and re-judging committed chapters. This removes
   the prior project's most painful coupling ("Do NOT fix casually"). Stamps in
   *shared* figures are not protection — nothing gates on them at share time; they
   are tripwires carried by the artifact, evaluated by whoever loads it, with the
   divergence placard (05 §8.4) as their contract.
2. **A physics change is a migration, not a patch.** The re-bless procedure: one
   dedicated commit that (a) contains the physics change, (b) regenerates all
   hashes and goldens via the bless script — which mechanically refuses unless the
   analytic layer and `D-BOUNDS` (§3.2a) are green in the same invocation — and
   bumps the minor `engine_semver`, (c) enumerates in its message every golden
   whose values moved and why, (d) re-pins the mistake-oracle outcome table (§4)
   if any outcome class changed, (e) triggers a fresh vision judge for any figure
   re-exported afterwards (the re-judge ceremony, §7.4), and (f) regenerates the
   stamps (`engine_semver`, per-line `expected`) in every committed FigureSpec
   fixture via the bless script — committed stamps are goldens and move only in
   re-bless commits. Hashes move in re-bless commits and nowhere else.

**The consolidated migration.** This design revision lands as **one** re-bless
commit, its causes enumerated in the commit message: the Tier 1R run-wide slice
v2 (demand-driven stand-up, `a_widen`, slew-limited commands); the four-state
steering machine with heading-capture release and the default lane-keeping
tracker (curved-approach verdicts change); off-road termination and the `stopped`
outcome; the outcome/quality law (D11) and the verdict reshape (`turn_ins[]` /
`apexes[]` under the one hysteresis apex detector); the extension of
`result_hash` over the resolved plan; the preset hand defaults flipping to book
ink and the `bookEsses` respec; corner-relative solver constants; and the
mistake-kind rename with its pin re-keys (`chop → runoff` among them, §4).

**The rubric-consuming cost, priced here.** A `checks_version` bump, or any
change to a pack's thresholds, bands, severities, or applicability, **re-blesses
every `standing` golden**, because rung 3 reads `clean(line)` and rung 4 reads
pack verdicts (D43; the ladder is owned by
`05-result-contract-and-inspection.md` §6.4). The re-bless commit message
enumerates the moved `standing` rows alongside the moved check vectors. This is a
real recurring cost of a rubric-consuming metric and it is priced here rather
than discovered at the bump. `standing` goldens are categorical, so the moved
rows are readable rather than numeric.

**Development phase.** The ceremony is per-commit, never per-iteration: during a
designed migration's search, constants and expectations co-evolve freely in the
working tree — the 02 §5.4 invariants and the pinned oracle classes are the fixed
points the search serves — and the tripwire binds only committed fixtures.
Batching any number of TUNING moves into one re-bless commit is the designed
procedure; pre-first-bless there is nothing to drift from, and the analytic layer
(§3.2a) is what correctness means until the first bless.

### 3.4 Property tests (named)

Run against fuzzed schema-valid scenarios as well as the fixtures, except where a
test states a narrower quantifier. Each is one sentence here; thresholds and
constants belong to `02-physics-model.md`.

*Grip and curvature:*

- `P-ELLIPSE` — at every emitted sample the friction-ellipse magnitude is ≤ 1 plus
  the deadband; the clip inside every integrator sub-stage never emits a sample
  beyond grip.
- `P-KAPPA` — the emergent-curvature identity `kappa = g·tan(phi)/v²` holds at
  every sample above the low-speed floor, within tolerance.

*Steering channel:*

- `P-UNWIND-CAPTURE` — for every solver-returned clean single-corner line over
  fuzzed in-scope roads and speeds: a `release` event exists; at the `exit` event
  `|heading_err_deg| ≤ EPS_EXIT_DEG`; `|phi| ≤ EPS_UNWIND_DONE_DEG` from unwind
  completion to `road_end` (absent later plan actions).
- `P-UNWIND-NOCROSS` — after release, `sign(phi)` never flips before the
  unwind→`track` handoff: the unwind approaches upright monotonically and never
  steers past it.
- `P-STEER-OWNER` — at every retained sample exactly one steering owner per the
  02 §3.1 transition table; `steer_state` is consistent with `lat_action_id`
  (`commit`/`position` name their owning action; `unwind` carries
  `lat_action_id = null`; `track` carries null outside a completed-position
  hold).
- `P-MIRROR` — for any schema-valid scenario authored without raw world-frame
  values, running the `hand=`-mirrored road with an identical scene yields:
  identical `s, t, v, |phi|, f, grip, sight_m` series; `(x, y)` reflected and
  signed quantities negated; identical events, outcome, verdict, and colours; the
  drawn top-down equal to the reflection of the original.

*Run-wide slice and stopping:*

- `P-ROLLRATE` (rescoped to the tracker) — at every sample
  `|phi_dot − phi_dot_su| ≤ roll_rate + tol` (realized `phi_dot` by finite
  difference; `phi_dot_su ≡ su_sustained + su_transient`).
- `P-ROLLRATE-EXCESS` — realized `|phi_dot| > roll_rate` **only** at samples where
  `phi_dot_su ≠ 0`: the cap is exceeded exactly and only during stand-up events
  (`C30-chop` asserts at least one such sample exists, so the property is
  exercised, not vacuous).
- `P-RUNWIDE-WIDEN` — premise: the clipped-regime predicate (W) sustained,
  `|phi| ≥ 15°`, `v ≥ v_valid_min_ms`; assertion: the line is never tighter than
  the unperturbed twin from onset.
- `P-TRAILBRAKE-TIGHTENS` — with `b_dem ≤ A_SU_ONSET` and slews ≤
  `RATE_THRESHOLD`, at lean: `phi_dot_su ≡ 0` and the line is at-or-tighter than
  the unbraked twin.
- `P-RUNWIDE-UPRIGHT` (restated against the analytic layer) — on `F-AN-BRAKE` and
  `F-AN-ACCEL` (`phi = 0` throughout) every sample matches the closed-form pure
  point-mass prediction to ≤ 1e-9 relative. **But at `phi = 0` the stand-up term
  is killed by its `tanh(|phi|/PHI0)` envelope identically (`phi_dot_su ≡ 0`), so
  this limb alone cannot distinguish a correct slice from one that was deleted.**
  A third analytic fixture `F-AN-NEARUPRIGHT` holds `|phi| = 1.9°` steady — where
  the envelope is `tanh(1.9°/PHI0_DEG) = tanh(1.9/5) = 0.36`, non-zero — and
  asserts the path's lateral deviation from the no-slice point-mass prediction
  stays `≤ eps_m = 0.05 m`: the one gate that actually **exercises** the slice's
  contribution just outside the leaned regime and **bounds** it, rather than
  reading it as zero by construction.
- `P-RUNWIDE-MONOTONE` — at fixed lean and `Δa`, exit lateral deviation is
  monotone non-decreasing in slew `r` over `[10, 80] m/s³`; at fixed `r`,
  monotone in `Δa`. Stated domain: `slew ∈ [SLEW_MIN, SLEW_MAX]`,
  `|phi| ∈ [15°, phiMax − 5°]`, `v ≥ v_valid_min_ms`.
- `P-AWIDEN-SIGN` — at every sample of any fuzzed run (outside a deadband around
  the boundary), the sign of `d(ln kappa)/dt` computed from the recorded series
  matches the sign predicted by the widening algebra from the recorded
  `phi_dot_su`, tracker term, `a_long`, `v`, and `phi` — the slice is
  self-auditing from trajectories alone.
- `P-SLEW` — recorded `|a_cmd_rate|` never exceeds the active action's
  `slew_mss`; the command reaches its target level within `Δa/slew + dt`.
- `P-SSD-LEAN` — `ssd_m` is monotone non-decreasing in `|phi|` at fixed `v`;
  equals the carried upright formula at `phi = 0`; continuous at 0.
- `P-VALIDITY-FLAG` — `below_validity` is set iff
  `v < v_valid_min_ms ∧ |phi| ≥ 2°`, and the verdict's `validity` dwell equals
  the flagged dwell within one resample bracket.
- `A-SU-ZERO-WHEN-GENTLE` — on the clean C30 golden every sample has
  `su_sustained = su_transient = 0.0` exactly (the bit-identity of 02 §5.4's
  gentle-riding invariant, now visible in the record).

*Termination, events, resampling:*

- `P-TERMINATED-CLOSED` — every run (fuzzed scenarios included) terminates with
  `reason` in the closed set
  `crash | off_road | stopped | road_end | max_time | max_dist` and a final
  sample equal to the bracketed `terminated {s, t, x, y}`; no sample ever
  satisfies the off-road predicate by more than the bracketing tolerance.
- `P-EVENT-BRACKET` — every crash/stop/road-end/off-road crossing is located
  between the last conforming and first violating step, within one time step.
- `P-RESAMPLE` — the arc-length grid is strictly monotone in `s`, `t` is
  monotone, and interpolated fields lie between their bracketing raw samples.
- `P-EMERGENT-APEX` — no input field can pin the apex: the schema rejects any
  `apex` field or `apex:<id>` plan anchor at core validation (D7), and fuzzing
  confirms apex station responds only through physics-relevant inputs. Applies to
  cached `solved.plan` blocks (§6) like any other plan.

*Corrective shot:*

- `P-CORR-PURE` — `correctiveShot` is a pure function of the line result: run
  twice → identical `corrective` block and tolerance-equal shadow trajectory
  (subsumed by `P-DETERMINISM`, named so the shadow is explicitly covered).
- `P-CORR-SHADOW-HONEST` — the shadow run obeys every main-run law: `P-ELLIPSE`,
  `P-ROLLRATE`, and the termination vocabulary. A shadow is a run, not a special
  case.
- `P-ENDPOINT-IN-FRAME` — for fuzzed figures under the default window, every
  line's terminal sample projects inside the drawn frame.

*Counterfactuals (D42):*

- `P-CF-PRECONDITION` — fuzzed over the fixture corpus × every
  `(rider, predicate, selector)` triple reachable from any CLI verb, config or
  pack. Under `predicate = "return_after_detect"` with
  `rider = "lean_only_reserve"`, the harness either satisfies
  `OUTSIDE_DRIFTING_OUT(x0)` (`04-solver-and-authoring.md` §4c.4) or returns
  `Err(CfRefusal)` — never a trajectory. Under
  `predicate = "horizon_bounded_return"` the harness either receives a horizon
  `s_h ≥ s_detect` derived from the main line or returns
  `Err(horizon_not_from_main_line)`. Under `predicate = "reserve_bounded_run"` no
  launch-state condition is asserted, and the test asserts that none is
  *imposed* — a future implementation that quietly applied the strict guard to
  `brake_reserve_escape` fails here. The test additionally asserts the arithmetic
  that motivates the law: on every shipped preset at its solved turn-in speed,
  `R_res(v) / R_road < 1` — the reserve-lean circle is tighter than the road, so an
  in-corridor launch provably closes on the inside edge. On the governing corners
  the ratio is `∈ [0.65, 0.90]`, with two known exceptions: `bookDecreasing`'s
  tightened exit (`1.19`, the one case *above* 1 — flagged, not benign) and
  `bookDoubleApex`'s opening middle corner (`0.35`, even tighter — the safe
  direction). Directional, not
  merely defensive: a future consumer that launches the lean-only rider from a
  contained line under the strict predicate fails this test at once.
- `P-CF-LITERALISED` — every counterfactual invocation in the corpus receives a
  plan whose every action carries an absolute station; fuzzing an id-addressed,
  corner-relative plan into the harness yields `Err(plan_not_literalised)`. Pairs
  with `A-RESOLVED-RERUN`.
- `P-COUNTERFACTUAL-CLOSED` — the set of distinct `(rider, predicate)` pairs
  reachable from any pack, any config key, any CLI verb, any scene token, **and
  through every named wrapper** (`correctiveShot`, `saveAt`, `E_c`) is a
  **subset** of `CounterfactualRider × CfPredicate`, and in any phase where D45
  is unimplemented the reachable rider set is exactly `{"lean_only_reserve"}`.
  Generated by enumeration, not by assertion on a hard list: adding a rider or a
  predicate without a `04-…md` §4c entry fails closed. This is the D12 guard that
  stops the registry being routed around by a pack or by a wrapper.
- `P-COUNTERFACTUAL-NAMED` — enumerate every emitter in `04-…md` §4c.7's closed
  table; for each, the machine-readable output carries
  `rider ∈ CounterfactualRider` where the table says it should, and the rendered
  prose for that surface contains that rider's registered `short_name`. Asserted
  on **every** `SaveWindow` including `open_at_end`, `intermittent`,
  `never_open` and `not_applicable`, where the scalars may be absent but the
  disclosure is not. Any
  emitter added without a registry row fails the enumeration.
- `P-CORR-CONSTANT-SPEED` — across every shadow run in the corpus, `v` is
  constant to integrator tolerance from `t_shot` to termination, and no
  `corrective.fail_reason` in any committed fixture, golden or record is the
  string `shadow_stopped`. The property that makes the deleted branch dead,
  pinned so it stays dead.

*Standing ladder (D43):*

- `P-STANDING-TOTAL` — over fuzzed finished `LineResult`s, `standing()` returns
  exactly one rung; the cumulative thresholds are closed downward (rung `k`
  attained ⇒ every threshold below `k` holds); no input yields `undefined`, and
  only a `LineRefusal` yields `null`.
- `P-STANDING-PURE` — `standing()` is pure and deterministic: no clock, no RNG,
  no environment; the same envelope twice yields byte-identical
  `StandingReport`s.
- `P-STANDING-OUT-OF-HASH` — computing `standing` for every line of every
  committed fixture changes no `result_hash`, `spec_hash`, `Verdict` byte, or
  `Sample` byte. The direct analogue of `P-CORR-PURE`.
- `P-STANDING-NA-CAP` — if any member of `reserve_checks` has an `na` or
  zero-instance result, the returned rung is ≤ 3 and `reserved_blocked_by` names
  that member with the matching reason. The refusal-laundering path the struck
  `sight_ok` opened is closed and pinned closed.
- `P-STANDING-RUBRIC-SENSITIVE` — under the **named** variant pack
  `PACK-STANDING-SHIFT` (the shipped pack with the `lean_ceiling` reserve
  threshold **loosened** by a stated delta — `phiReserve` scaled to `0.90·mu`
  from `0.85·mu`), `F-STANDING-WARN`'s `standing` rung **changes from 3 to 4**
  (the reserve is no longer eaten, so `reserved_blocked_by` empties) while
  `outcome` stays byte-identical `contained`. The deliberate mirror of
  `P-OUTCOME-RUBRIC-FREE`, restated as a *witnessed* change on a named fixture
  with a stated pack delta — not the possibility-claim "results **may** change",
  which is a tautology (`∃`-over-packs `∨ True`) that any engine passes,
  including one whose ladder never reads the rubric.
- `P-STANDING-STAMPED` — every emitted `StandingReport` carries a non-empty
  `rubric`, `checks_version`, `reserve_checks` echoed from the loaded pack (never
  re-derived), and the placard string verbatim.
- `P-STANDING-STRICTER-THAN-CLEAN` — over the committed corpus,
  `{rung = 4} ⊊ {clean(line)}`: the inclusion is proven by construction and the
  strictness by witness (`F-STANDING-WARN`). This is the mechanical statement
  that the top rung is non-vacuous, and it is what the struck `out_available`
  probe could never have satisfied.

*Save window (D44):*

- `P-SAVEWIN-ANCHOR` — for every fixture with `corrective ≠ null`:
  `saved(t_shot) ≡ corrective.feasible`. *Regression test, not a premise:*
  `04-…md` §4b.3 makes the identity structural, and this asserts the
  implementation realises the structure. Fuzzed over the committed corner corpus.
- `P-SAVEWIN-HORIZON` — for every evaluated `τ`, the shadow's retained samples
  end at `s*` or at a termination, and `s* ≥ max(s_detect, s(τ))`, with
  `s_detect` read from the **main line's** recorded event. **The predicate is
  horizon-bounded, mechanically**, and this is also the mechanical form of
  `04-…md` §4c.4's horizon discharge: a horizon not derived from the main line
  fails here before it can reach `P-CF-PRECONDITION`.
- `P-SAVEWIN-INSIDE-NOT-A-SAVE` — construct a `τ < t_detect` on `F-ORACLE-90`
  whose shadow departs the inside edge before reaching `s_detect`:
  `saved(τ) = false`. **This is the peak-guard regression** — the test that fails
  if anyone reintroduces `f_peak` — and it is the witness that the horizon
  discharge actually discharges the precondition.
- `P-SAVEWIN-FREEZE` — on every fixture whose mistake spec carries a freeze:
  every evaluated `τ` satisfies `τ ≥ t_freeze_end_s`;
  `tau_close_s ≥ t_freeze_end_s`; and
  `reaction_budget_s ≡ tau_close_s − t_earliest_s` with
  `t_earliest_s = max(t_detect_s, t_freeze_end_s)`. Pinned on `C30-chop`
  (`freeze_s = 1.0`, committed, pinned `runoff`), fuzzed over the corner corpus.
- `P-SAVEWIN-OUTCOME-CONSISTENT` — under `status: "resolved"`:
  `corrective.feasible = false ⇒ reaction_budget_s < react_profile_s` (measured
  against `t_earliest_s`), and `= true ⇒ tau_close_s ≥ t_shot_s`. **The D11
  guard, mechanical, freeze-aware.**
- `P-SAVEWIN-BRACKET` — under `resolved`, direct re-integration at `tau_close_s`
  returns `saved = true` and at `tau_close_s + HORIZON_EPS_S` returns `false`.
  Self-certifying: the reported number is re-verified by running the predicate,
  not by trusting the search.
- `P-SAVEWIN-GRIDLAW` — for every accepted scan,
  `HORIZON_SCAN_DS_M / v_max ≤ HORIZON_TAU_QUANTUM_S` over the scan domain (the
  resolution law, `04-…md` §4b.5); and a `--scan-ds` violating it is refused
  `SCHEMA/scan_ds_too_coarse` rather than run.
- `P-SAVEWIN-REFUSES` — `transition_count > 1 ⇒` the returned object contains
  none of `tau_close_s`, `s_close_m`, `reaction_budget_s`. Asserted structurally
  on field presence. **The antecedent `transition_count > 1` is produced by exactly
  one status, `intermittent`, whose only fixture `G-SAVEWIN-INTERMITTENT` is
  explicitly unbuilt (`09 L380`) — so this implication is vacuously true on the
  committed corpus.** It is therefore restated existentially and **gates D44
  promotion**: the suite must carry ≥ 1 committed witness with `transition_count > 1`
  (i.e. `G-SAVEWIN-INTERMITTENT` must be built) on which the field-absence holds;
  until it does, D44 does not promote on this gate. Complementary to
  `P-COUNTERFACTUAL-NAMED`, which asserts that `rider`, `predicate`, `policy` and
  `placard` **are** present on the same object: the two tests partition the fields
  and neither weakens the other.
- `P-SAVEWIN-DETERMINISM` — same envelope twice → deep-equal `SaveWindow`;
  cross-runtime tolerance-equality with **exact** equality on `status` and
  `transition_count` (discrete fields must not flip). `saveWindow` is
  out-of-hash, so `P-DETERMINISM` does not cover it and this property exists to
  close that gap.
- `P-SAVEWIN-PURE` — no envelope member, no `result_hash`, no `spec_hash`, no CSV
  column, no SVG byte changes when the analysis is computed. Asserted by hashing
  before and after.
- `P-SAVEWIN-SHADOW-HONEST` — every probe obeys `P-ELLIPSE`, `P-ROLLRATE` and the
  closed termination vocabulary, and the `04-…md` §4a.5 `fail_reason` set
  contains no dead member (D42's `shadow_stopped` edit). A shadow is a run, not a
  special case.

*Position channel:*

- `P-POS-AUTH` — at every sample with `steer_state ∈ {track, position}`:
  `|cmd_lean| ≤ PHI_TRACK_AUTH_DEG + eps_deg_report`.
- `P-POS-NO-CORNER` — `book90` at 34 km/h with a plan containing **no**
  `turn_in`: outcome is `runoff` (off-road termination) — the tracker cannot fake
  cornering; the D7 guard is mechanical.

*Outcome and quality law:*

- `P-OUTCOME-RUBRIC-FREE` — on fuzzed scenarios, grading under a
  threshold-perturbed variant rubric pack changes only `doctrine` / `quality` /
  `result_hash`; samples, events, `outcome`, and `spec_hash` are byte-identical.
  Physics decides outcome; the rubric never can.
- `P-QUALITY-TOTAL` — `quality ∈ good | caution | failing` is defined and
  single-valued for every value of the outcome closed set × any doctrine fail
  count.

*Misjudgment:*

- `P-MISJUDGE-PREFIX` — an accepted misjudge line's samples are byte-identical to
  the believed-world run's for `s < s_divergence_m` (same start, same literalized
  plan, same geometry ⇒ same integration). **Hosted on a fixture whose divergence
  falls at a *later* corner** — `F-BELIEVED-CHAIN`, a two-corner road whose believed
  and actual roads agree through `c1` and diverge only at `c2` — so the
  byte-identical prefix contains **curved** stations, not only the straight
  approach. On the single-corner `F-BELIEVED-90` (`book90` + underread
  `r_believed = 16`) the roads differ from the corner onset, so `s_divergence_m`
  sits at the corner start and the prefix has **zero curved stations** — a
  same-straight-integration triviality that never exercises the `s_divergence_m` /
  `kappa_gap` it underwrites.
- `P-MISJUDGE-IDENTITY` — fuzzed believed roads equal to the actual road are
  rejected `INEFFECTUAL`; fuzzed hand-flips are rejected `OUT_OF_SCOPE`.

*Sight:*

- `P-SIGHT-PURE` (full fuzzing) — `sightFrom` is pure and deterministic;
  `sight_m ≥ 0`; `s_limit ∈ [s_eye, road_end]`; first-blocked semantics
  (re-emergent visibility past a gap never counts).
- `P-SIGHT-INSIDE-MONOTONE` (scoped quantifier) — fuzzed over roads whose
  occluders are all `inside`-side relative to the corner containing the eye's
  station, with no `vehicle` footprint in the oncoming lane: moving the eye
  laterally outward never shortens `sight_m`. This is the hold-wide doctrine's
  geometric premise (D4), stated with the hypothesis it actually needs.
- `F-SIGHT-OUTSIDE` (directed educational fixture) — an outside wall past which
  widening *shortens* sight, asserted as such: the non-monotone reality is
  pinned so nobody "fixes" it back into the property.
- `P-SIGHT-BASIS` — on any straight with `d = 0`, `sight_ride_m = sight_m ± eps`;
  the clamp case is pinned on a runoff fixture. (`sight_ride_m` — rider-path
  metres — is the sole basis for every sight-vs-stopping judgment, D16.)

### 3.4a Continuation-envelope tests (D45 — gated on `S-CONT-SEPARATION-v2`)

Every test in this subsection runs **at promotion only**; none gates any shipped
phase.

**`S-CONT-SEPARATION` is retired and replaced by `S-CONT-SEPARATION-v2`.** The
retired spike is recorded here rather than deleted, because *why* it could not
decide the question is the most useful thing the audit produced.

**Why the retired spike could not authorise a build.** It computed `k_refuted` at
`bookBlind`'s commitment probe for a `vis=none` and a `vis=cautious` line, both at
32 km/h, and passed on `k_refuted(none) > k_refuted(cautious)` together with
`0 < k_refuted(none) < k_admissible`. Four independent defects, any one
sufficient:

1. **It ran on a degenerate fan.** `03-…md` §7a.4's pre-amendment ladder keyed its
   headroom branch on `sign(κ_L)`, which collapsed the tightening half to one
   byte-identical road on left-handers (5 distinct rungs of 7) and to a single
   road at `κ_L = 0` (1 of 7). `bookBlind` is a left-hander. The test that catches
   this, `P-CONT-MEMBERS-DISTINCT`, ran **at promotion — after the gate it should
   precede**. Fixed in §7a.4; now asserted at step 0 below.
2. **It ran on a fixture that was not blind.** `bookBlind` was `book90` geometry,
   and no 90° corner in the proportion band is blind on the hold-wide line **at the
   solved (doctrinal) turn-in** (`03-…md` §3.1). That universal holds *only* there:
   `blind(c)` is single-turn-in, and sweeping the turn-in down to `entry−7` at a
   small margin the hold-wide line *can* go blind at the wide band edge (by up to
   ≈ 1.2 m — `review/verify/fixture_geometry.py` check 1), and `§3.1` also records
   the cut-in-line counterexample at `margin ≤ 0.5`. At its solved turn-in
   `blind(c1)` read `false`, so `hold_wide_for_sight` was `na`, the 35° cap never
   applied, and the commitment probe the spike names may not have existed.
   Fixed by the `^140` reshape, which is blind at *every* turn-in ≤ 20.5 m.
3. **The speed limb was dead.** The V1 governor binds only where
   `vis_margin · ssd ≤ sight_ride_m` fails; at 32 km/h on the old fixture that
   needed `sight_ride_m < 14.53 m` against ≥ 24 m of geometry. `vis=cautious` and
   `vis=none` solved to the **same speed**, so `k_refuted(none) > k_refuted(cautious)`
   could only be satisfied by noise, and `A-SSD-GOVERNOR` passed by equality.
4. **Two integers cannot be diagnosed.** The spike recorded no `s_L`, no
   `sight_ride_m`, no `κ_L`, no check verdicts. A "both 0" result is
   uninterpretable between *no signal*, *escape too short to reach `s_L`*, *ladder
   collapsed*, and *`blind(c1)` false* — and the audit's finding is that all four
   were true at once.

Two claims the retired text made are **withdrawn as wrong**, not merely
superseded:

- *"the necessary condition is `1/kappa_max_1pm < R_res` at probe speed."*
  `R_res = 9.4756 m` against 7.00 m is arithmetically right, but it is not the
  binding condition. `04-…md` §4d grades `escaped(m)` over the **divergent span
  `s > s_L` only**; if the escape terminates on `v < v_floor_ms` before reaching
  `s_L`, that span is empty, all four conditions hold vacuously, and every member
  is escaped by construction. The binding condition is therefore
  **reach ≥ `s_L − s_probe`**, and reach is line-dependent (`04-…md` §4d). The
  retired text's "comfortably clear of the escape's own 3.0 m/s²" also compares
  metres against m/s² and derives nothing.
- *"containment pins `kappa_max_1pm` from below … the feature is still not tunable
  into success."* Containment pins it from **below**, at the corpus maximum
  `1/9 = 0.1111`. Buying separation means moving it **up** — tighter members, more
  refutations — and a lower bound never obstructs that, so **containment does not
  fence the constant in the direction that matters**. The anti-tuning argument had
  the sign backwards.

  Two real fences exist, and neither is containment. (i) `E(s_L)` bounds the
  initial step by `kappa_step_max_1pm`, while `03-…md` §7a.4 property 3 proves the
  ladder's step `≤ kappa_max_1pm`; these coincide only because both are `1/7`
  today. Raising `kappa_max_1pm` alone to `1/4` makes the `σ = +1` rung step
  `0.1667` against a `0.1429` step bound and **breaks containment** — the two
  constants must move together, which is now stated normatively in `03-…md`
  §7a.3. (ii) Driving `kappa_max_1pm` up far enough saturates `k_refuted` and
  fails pass condition 1 (`|{k_refuted}| ≥ 3`). So the fence comes from the grid
  and from the step/ceiling coupling, **not** from containment. That the specific
  sequence `1/7, 1/6, 1/5, 1/4` raises `k_refuted` monotonically is asserted, not
  computed; `S-CONT-SEPARATION-v2` measures it rather than assuming it, which is
  why the gate sweeps constants instead of pinning one.

---

**`S-CONT-SEPARATION-v2` — the replacement gate.** No implementation of
`03-…md` §7a, `04-…md` §4d or the fan begins until this passes. Three steps; the
first two are arithmetic and cost hours, not days.

**Step 0 — prerequisites, no engine code.** Each is a spec obligation already
discharged in this amendment, re-asserted here as a gate:

- the amended hand-frame ladder (`03-…md` §7a.4) yields 7 distinct `road_dsl` on
  every corpus corner and on a limit point falling on a straight, and every rung
  lies inside `E(s_L)`'s step bound;
- all three envelope bounds dominate the corpus (`03-…md` §7a.3);
- `blind(c)` holds at the solved turn-in on every fixture that hosts a visibility
  test — which `fx-esses-blind` currently **fails** (see §3.5);
- `fx-hedge-gap` is authored with explicit geometry, or deleted and its three
  predicates re-homed.

`review/verify/fixture_geometry.py` computes all of these from the DSL strings.

**Step 1 — the sight measurement, which nothing else can substitute for.** Run
`compose` + `sightFrom` **on all three step-2 fixtures (`bookBlind`,
`bookDecreasing`, `bookHairpin`)** and print `s_ti`, `s_limit`, `sight_ride_m`,
`κ_L` and `blind(c1)` at all five probe stations, for `f = 0.0` and `f = 1.0`, on
both the `vis=none` and `vis=cautious` solves. No member generator, no escape, no
pack. **Every remaining question is downstream of where `s_L` lands**, so this runs
first and may terminate the effort on its own: if `s_L` falls past the corner exit,
`κ_L = 0` and there is nothing left to spike. **Run on `bookBlind` alone this
kill-switch has an empty failure domain** — `s_L` lands at most 41.00 m against
`s_end = 45.32 m`, a 4.32 m margin at every cell, so it can never fire; the other
two step-2 fixtures are what give it a domain (the flaw that made the retired spike
undecidable, inherited if step 1 stays single-fixture).

**Step 2 — the grid.** Report `k_refuted(none)`, `k_refuted(cautious)`,
`k_admissible`, the reachable `σ` set, and the verdicts of checks 2, 8, 9 and 10
**per cell**, over `escape_decel_mss ∈ {2.5, 3.0, 4.0}` × the full probe ladder ×
both lines, on `bookBlind`, `bookDecreasing` and `bookHairpin`.

**Pass condition — all three required:**

1. **More than one bit.** `|{k_refuted}| ≥ 3` over the `escape_decel_mss = 3.0`
   grid. A metric taking two values is a boolean wearing an integer's clothes.
2. **A non-collinearity witness.** At least two cells with **identical**
   check-verdict tuples for checks 2, 8, 9, 10 and **different** `k_refuted`.
   This is the condition the retired spike never tested and the one that decides
   whether the channel is a measurement or a picture — `03-…md` §7a.10 reason 3
   shows `{k_refuted > 0} ⊆ {reach@3.0 > sight} ⊇ {check 10 fails}` — so `k_refuted`
   *can* fire where check 10 passes, over a band ≈ 49 % of `ssd` wide at 34 km/h,
   and whether the corpus actually populates that band is the open question.
3. **Sign stability under the pin.** `sign(k_refuted(none) − k_refuted(cautious))`
   is constant across the three `escape_decel_mss` cells. A difference that
   inverts with a TUNING constant is an artifact of that constant.

**Fail includes:** `k_refuted` constant across the grid; `k_refuted` a function of
the check-verdict tuple; a sign that flips with the pin; and any cell reporting
`k_refuted := null` from `¬start_ok` that the pass condition would otherwise have
counted — a case the retired condition failed to enumerate at all.

**The expected result, recorded in advance: most likely fail at step 1;
genuinely undetermined on condition 2.** Step 1 is the confident half — if `s_L`
lands past the corner exit the fan has nothing to work with, and that was true of
the fixture before the reshape. Condition 2 is the honest half, and an earlier
draft of this section was **wrong to predict it would fail**. That draft reasoned
that `k_refuted > 0` lives inside the gap between `a_ssd = 7.0` and
`escape_decel_mss = 3.0` and called the gap thin. It is not thin: at 34 km/h it
spans `sight ∈ (15.82, 23.64) m`, a width of **≈ 49 % of `ssd@7.0`**
(`03-…md` §7a.10 reason 3). A direction-(A) witness is therefore not excluded by
the arithmetic, and whether one exists on the corpus is exactly what condition 2
measures. What remains true regardless is the *interpretation*: a witness found
inside that band demonstrates independence from the rubric, but independence
purchased by a TUNING constant rather than by physics — so passing condition 2
authorises the build while still obliging the placard to describe `k_refuted` as
a property of a declared escape policy. **The cost side of the retired text's "one day answers a
question worth twelve to fourteen" is withdrawn as unsourced** — no estimation
basis for either figure exists in `design/` or `review/`, and step 3 of the
retired method excluded only render, schema and CLI, leaving the ladder, the
speller, the probe ladder, `E_c` and the grading law all to be prototyped. Steps 0
and 1 above are hours; step 2 is the only part that needs engine surface.

**Property tests.**

- **`P-CONT-ENVELOPE-CONTAINS-ACTUAL`** — fuzzed roads and stations: the actual
  road's curvature profile past `s_limit(s)` lies in `E(s_limit)` with
  `EPS_KAPPA_ENV_1PM` slack, provided every downstream segment satisfies
  `|κ| ≤ kappa_max_1pm` and every downstream interior boundary step satisfies
  `|Δκ| ≤ kappa_step_max_1pm`. A road violating it is not a bug: the report sets
  `envelope_contains_actual: false`, the fan is not drawn, and every count reads
  `null` under the placard *"road geometry outside the declared continuation
  envelope"*. Honest refusal, never a silent fan. **This test runs before a line
  of render code.**
- **`P-CONT-TIGHTENING-ADMISSIBLE`** — **re-homed onto a dedicated tight-radius
  fixture (`r ≤ 7.8 m`, i.e. `|κ_L| ≥ 0.9·κ_max`)** and **strengthened to "the
  tightening member survives the filter"**: at every commitment probe, the
  tightening member (`σ = +1`, whose `κ₀ = κ_max` by construction) **survives the
  consistency filter** and satisfies `|κ_m(u)| > |κ_L|` over its whole curved tail.
  On the shipped corpus (max `|κ_L| = 0.111 < κ_max = 0.143`) the bare existential
  is witnessed *unconditionally* by that pinned `σ = +1` rung, under total
  occlusion where `admissible ≡ true` — so it keeps passing through a filter that
  wrongly discarded every *other* member, and discriminates only at `r ≤ 7.8 m`,
  which no preset reaches. Making the filter actually *act* on the member is what
  turns the thesis into a measurement. Without it the feature cannot state its own
  thesis.
- **`P-CONT-MEMBERS-DISTINCT`** — `|{distinct Member.road_dsl}| = k_probed` at
  every probe on every committed fixture. **Promoted: this also runs as a step-0
  arithmetic check in `S-CONT-SEPARATION-v2` (§3.4a), on the seven spelled strings
  and no engine.** It is the test that would have caught the pre-amendment
  ladder's sign bug, and running it only at promotion meant it sat downstream of
  the gate it should have guarded. (Note for the record: tightening members
  re-converge on the `r = 1/kappa_max_1pm` arc within roughly
  `headroom / dkappa_ds_max_1pm2` metres — at `κ_L = 1/12` that is ≤ 0.0595 of
  headroom against a rate of 0.005, so ~12 m; distinctness is concentrated in the
  leading span and the 150° cap truncates most of the converged tail. On a limit
  point falling on a straight the `σ < 0` rungs share `κ₀ = 0` and are distinct
  **only** through their ramp rates — which is why this predicate is asserted on
  `road_dsl` and never on `κ₀`.)
- **`P-CONT-FILTER-TWO-SIDED`** — on `fx-hedge-gap`, at the commitment probe,
  ≥ 1 member with `σ < 0` **and** ≥ 1 with `σ > 0` are inadmissible. The filter is
  proven two-sided where it can act at all.
- **`P-CONT-CONSISTENT`** — every admissible member re-cast through `sightFrom`
  reproduces `s_L` within `EPS_SLIMIT_M` and every discarded member does not.
  **Non-vacuity guard sits on `fx-hedge-gap`**, never on the occluder-free case,
  where the fan is empty and the test proves nothing.
- **`P-CONT-MONOTONE-SIGHT`** — restated over `fx-hedge-gap`, where it is not
  constant: as `s_limit` grows, `k_admissible` is non-increasing.
  `F-SIGHT-OUTSIDE`'s counterexample is pinned as such, never "fixed".
- **`P-COMMIT-MEMBER-DEPENDENT`** — at every probe with `escape_status = "ok"`
  and `k_refuted ≥ 1`, not all members share an identical
  `(refute_reason, at_s)`. This is the test that would have caught grading on
  member-independent state.
- **`P-COMMIT-MONOTONE-V`** — at fixed turn-in station, `k_refuted` is
  non-decreasing in entry speed. **`P-COMMIT-MONOTONE-TI`** — at fixed entry
  speed, `k_refuted` is non-increasing as the turn-in station moves later. Parks'
  two remedies, mechanically pinned. Probes with `escape_status ≠ "ok"` are
  excluded from both.
- **`P-ESCAPE-HONEST`** — `E_c`'s runs obey `P-ELLIPSE`, `P-ROLLRATE` and the
  closed termination vocabulary (the `P-CORR-SHADOW-HONEST` precedent): a shadow
  is a run, not a special case. Unlike the lean-only shadow, `v < v_floor_ms` is
  a **reachable** termination here and is asserted reachable on a committed
  fixture — the two policies do not share a termination-vocabulary derivation.
- **`P-COMMIT-DETERMINISM`** — identical report bytes across repeat runs and
  across the pinned runtime and browser; tolerance-equal on continuous fields,
  **exact** on `k_admissible`, `k_refuted`, `refuted_sigmas`, `refute_reason`,
  `escape_status`, `filter_effective`. Exactness rests on the same fixture
  discipline that already carries `stop_within_sight`, the hold-release rule and
  the V1 governor — probe fixtures are authored clear of occluder near-tangency,
  the only real flip vector — with `C-CACHE-HONEST`'s "identical check verdicts"
  as the standing precedent. `EPS_SLIMIT_M` is a threshold and not a deadband,
  and stays on the 0.5 m lattice: `Δ = s_limit(m) − s_L` is an exact multiple of
  `ds_m`, exactly representable in binary64, and a one-quantum drift crosses 1.25
  exactly as it crosses 1.0.
- **`P-COMMIT-OUT-OF-HASH`** — attaching, changing or removing the report leaves
  `result_hash`, `outcome`, `samples` and `events` byte-identical; changing the
  prior name changes **no** hash — the prior name is not a `spec_hash` input
  (`05-…md` §8.1) — and changes only `CommitmentReport.prior`; and on a
  committed `misjudge`
  fixture, `verdict.misjudgment` serialises byte-identically with and without
  `--commitment`.
- **`P-COMMIT-ID-FREE`** — member roads are re-minted with different corner ids
  on a committed fixture and the report is unchanged; a mutation that makes `E_c`
  read a member corner id fails.

**Acceptance tests.**

- **`A-CONT-PACK-DATA-ONLY`** — the pack schema admits scalars, a numeric ladder,
  one registry id, and provenance strings only: no expressions, no predicates, no
  policies (D12). A pack spelling a policy inline is rejected
  `SCHEMA/pack_defines_rider`, asserted on its typed reason.
- **`A-COMMIT-PROSE`** — string test over verdict prose, legend, placard, POV chip
  and `explain`: no surface emits
  `justified|provable|guaranteed|safe|will make it|unescapable`; every rendered
  count carries **a refutation verb** — the count sentence states what the N
  members *did* (`were refuted`), never a bare noun phrase, because a verbless
  count reads as an affirmative survivability claim and is exactly what
  `03-…md` §7a.1 discipline 2 forbids; every rendered count carries the pack
  name **spelled as the `prior` string**, `<name>/<version>` (e.g. `street/1`,
  `00-…md` §5), byte-equal to `CommitmentReport.prior` so a consumer rendering
  the count from the report reproduces the pinned string exactly; every rendered
  count carries the escape rider's registered `short_name` and
  the standing placard; when `actual_road_refuted`, the "including the road you
  are actually on" clause is present; when `filter_effective = false`, the
  inactive-filter clause is present.
- **`A-COMMIT-VERB`** — `linelab commitment` stdout byte-equals the library
  `commitmentEnvelope` output (the `A-STATE-VERB` pattern).
- **`A-RECIPE-K`** — `08-cli-and-agent-interface.md` §6 recipe (k) executed
  verbatim. `T-COLDSTART` gains one goal-phrased task for it.

**Golden fixtures.**

- **`fx-hedge-gap`** — NEW committed fixture, **unconstructible as previously
  specified and blocking `S-CONT-SEPARATION-v2` step 0.** The whole definition was
  "`bookBlind` with the hedge shortened so road re-emerges past its lateral
  edge" — no span, margin, depth or offset. Shortening a band's *span*
  monotonically **removes** blocking rather than creating a re-emergence gap; a
  54-cell sweep over the shortened-span family found zero cells in which road
  re-emerges past the lateral edge. Since this is "the only fixture on which the
  consistency filter is non-vacuous", three predicates
  (`P-CONT-FILTER-TWO-SIDED`, `P-CONT-CONSISTENT`'s non-vacuity guard,
  `P-CONT-MONOTONE-SIGHT`) currently rest on a fixture that does not exist.

  Re-emergence needs a **gap in the band**, not a shorter band: two `hedge`
  segments with clear station between them. **Now authored** (threading verified by
  `review/verify/fixture_geometry.py` check 13): on `bookBlind`'s road
  (`lane 3.5 | S 16 | L 12 ^140 | S 16`, entry 34 km/h), the shipped `-6x36` band
  split by a 4 m **entrance** gap over stations 14–18 —

  ```
  hedge inside c1 -6x4  margin=1.2 depth=2.5    # stations 10–14
  hedge inside c1 +2x28 margin=1.2 depth=2.5    # stations 18–46
  ```

  This threads: `blind(c1)` still holds (`s_L = 39.5 m < s_end = 45.32 m`) while the
  road **re-emerges past the lateral edge** over ≈ 53.5–61.0 m, so the consistency
  filter finally has a re-emergence to act on. The gap must be at the **entrance**:
  a mid-corner gap (centre ≥ 24 m) is geometrically inert — the 140° wrap holds far
  targets behind the band — and shortening a single band's span never opens a gap
  (it only moves first-blocked later; the design's 0-of-54-cell result). With this
  authored, `P-CONT-FILTER-TWO-SIDED`, `P-CONT-CONSISTENT`'s non-vacuity guard and
  `P-CONT-MONOTONE-SIGHT` are hosted on a fixture that exists.
- **`G-COMMIT-BLIND`** — `bookBlind` at 34 km/h, `vis=none` geometric line vs
  `vis=cautious`: pins `k_admissible`, `k_refuted`, `filter_effective` and
  `escape_status` at each of the `PROBE_LADDER_N` probes on both lines, plus the
  worst member's `σ` and `refute_reason`. Design pin: the governed line's
  `k_refuted` at its commitment probe is strictly lower, **and**
  `k_refuted < k_admissible` on that line — at least one admissible member
  survives, rather than the admissible set having merely emptied. If either stops
  holding it is an engine or tuning bug, never a patched pin.
- **`G-COMMIT-PREMATURE`** — **`bookBlind`** (occluder-bearing, the reshaped D46
  fixture) good vs `premature`: pins `k_refuted(premature) > k_refuted(good)` at the
  commitment probe and that the good line's worst member is refuted for
  `member_corridor_exceeded` rather than `member_crash`. **Re-homed off the
  occluder-free `F-ORACLE-90`** (`book90`, `s_L = 46.85 m = road end`), where the
  commitment channel has literally nothing to grade and the contrast was a strict
  inequality between two zeros. On `bookBlind`, `blind(c1)` holds and `s_L` lands
  inside the corner; whether `k_refuted` then fires (the escape reaching past `s_L`)
  is the open question `S-CONT-SEPARATION-v2` measures, so this gate — like the rest
  of the commitment channel — reaches non-vacuity only where that spike passes.
- **`G-COMMIT-ESSES`** — `fx-esses-blind`: ≥ 1 admissible member with **opposite
  hand** to the actual continuation at corner 1's probe — the hand-reversal
  representability a `hand_continues` lock would have destroyed.
- **`G-COMMIT-ENTRY`** — a chained fixture whose early probes fall inside the
  previous corner: pins at least one probe with
  `escape_status = "probe_outside_reserve_at_entry"`, `k_refuted: null`, every
  `Member.escaped: null`, and the escape-precondition placard. The D8 witness row
  for the non-`ok` value.
- **`G-TRUNCATE`** — `truncateAt` splits inside arcs and tapers on all six
  presets, with `super_tight_geometry` re-evaluation pinned on the spliced
  members. Member drops are pinned as a `bookHairpin` edge case; the baseline is
  the swept-angle budget's, not the retired arc-length version's.
- **`G-COMMIT-GRID`** — sweep `ds_m ∈ {0.25, 0.5, 1.0}` ×
  `EPS_SLIMIT_M ∈ {0.5, 1.0, 2.0}` on `bookBlind` and `fx-hedge-gap`, asserting
  `k_admissible` / `k_refuted` stability. A failure is a tuning finding, never a
  licence to widen tolerance.

**Gates.**

- **`C-COMMIT-BUDGET`** — two halves. (i) With the report not requested,
  warm-cache all-lines recompute on the largest committed figure is unchanged and
  `C-RECOMPUTE-BUDGET` does not move. (ii) One on-demand probe (8 members) on
  `bookBlind` ≤ 40 ms on the pinned runtime.
- **`C-COMMIT-BAKE-BUDGET`** — the full ladder on `fx-esses-blind` ≤ 25 s cold: a
  regression tripwire, not an interactivity promise, with the honest "roughly
  doubles the largest bake" recorded in the manifest.
- **`A-FAN-NO-ENGINE`** — loading and rendering a scene with `fan: auto` performs
  zero engine runs, counted on an instrumented stepper.
- **`C-COMMIT-NO-CHECK`** — a lint over the rubric pack and the checks module: no
  check id, metric, or applicability predicate reads `verdict.commitment`, and
  the string `commit_within_sight` appears nowhere outside the
  `UNKNOWN_ID/struck_by_decision` tombstone table. D45's permanence, made
  mechanical.
- **`J9 fan disclosure`** (vision judge, `na` unless the fan is drawn) — the
  standing placard is present; the fan is neutral ink; no fan band carries an
  arrowhead or a verdict colour; refuted cross-ticks sit on member geometry and
  not in empty space; **no cross-tick lies at or before `s_limit`**; **no fan edge
  is visible above an occluder silhouette**; a cross-tick beyond `FAN_DRAW_M`
  renders clamped with the `truncated` hatch.
- **D8 witness rows** in `verify/effectuality.json` for `config.prior`,
  `--commitment`, `--prior`, `view.fan`, `--at`, `escape_status`,
  `filter_effective`, and each `refute_reason` — every reason reachable by a
  committed fixture, no dead error names. Effect classes: `analysis` for the
  report, `render` for the fan.

### 3.5 Solver-intent and visibility tests (D10, D22)

Every test below states its quantifier. `P-CONSTRAINT-BINDING` runs on the R6
fixture family with fuzzed *constraint values* (road fixed); all others are
fixtures-only — each evaluation is a full solve, and several of the properties
are false under adversarial outside/oncoming occluders, so fixture scoping is the
honest quantifier.

- `P-CONSTRAINT-BINDING` — every line a constraint-carrying solve returns
  satisfies every constraint at every retained sample of its span, re-checked on
  the self-verified final run (never only on the search's last candidate); an
  unsatisfiable bound yields a typed `NO_SOLUTION` (`constraint_unmet`), never a
  near-miss line.
- `P-ACCEPT-MONOTONE` — whenever `accept=clean` succeeds, `accept=best_failing`
  returns the byte-identical line.
- `P-ACCEPT-GRADE` — a best_failing-returned plan re-run via `run` yields the
  identical verdict: acceptance policy never touches grading.
- `P-ACCEPT-CONSTRAINT` — **run on the R6 fixture family under
  `accept=best_failing`** (the corpus's only constraint-carrying fixture; run with a
  hard-binding constraint while the line *fails on other criteria*, so
  `best_failing` returns a failing line whose constraint-satisfaction is exactly
  what must be checked): no best_failing return ever violates an authored constraint
  — a relaxed accept policy must not quietly surface a constraint *violator*
  (`04 §4.8` keeps violators as `NO_SOLUTION`, never a returned line), which extends
  `P-CONSTRAINT-BINDING` to the relaxed policy. Without this explicit R6 × `best_failing` pairing the quantifier —
  `{lines returned under best_failing}` ∩ `{sources carrying an authored
  constraint}` — is **empty**, since R6 was otherwise exercised only by
  `P-CONSTRAINT-BINDING` under `accept=clean`. *(R6's road is double-defined across
  `04 §5` and `08 §6(f)` — see the note at §5.1 / the census; this gate uses the
  `04 §5` constraint fixture `P-CONSTRAINT-BINDING` runs on.)*
- `P-VIS-MARGIN-MONOTONE` — **named fixtures only** (`bookBlind`,
  `fx-esses-blind`), never fuzzed: raising `vis_margin` (all else fixed) never
  lowers the solved line's minimum sight margin and never raises its governed
  entry speed. Edge pin: where a raised `vis_margin` governs speed below
  `v_floor`, the expected result is a typed `NO_SOLUTION` with sub-reason
  `vis_speed_below_model_floor`, never a `stopped` run.
- `P-VIS-SELFCHECK` — every line returned under `vis=cautious`, single or
  chained, satisfies the mode's acceptance predicate on its self-verified run
  (this property, not any convergence claim, is what the visibility mode
  guarantees).
- `P-VIS-BOUNDED` — the visibility mode performs ≤ `vis_max_iterations` (4) solve
  passes and terminates in a passing line or a typed refusal — never an
  unverified line, never a loop. Both refusal arms of the closed `04 §4.10`
  registry carry a **committed witness fixture**, because the passing arm reaches
  exactly 1 iteration on every named fixture, so without these the refusal arm is
  a dead branch the `§8` no-dead-error-names rule forbids: `FX-VIS-FLOOR` =
  `bookBlind` + `vis=cautious` at `vis_margin = 12` (> the 10.94 edge threshold,
  `fixture_geometry.py` check 7 basis), whose governed speed falls below `v_floor`
  → `NO_SOLUTION`/`vis_speed_below_model_floor`; and `FX-VIS-UNSAT`, a blind
  fixture whose `vis_margin` is raised until no iterate passes within
  `vis_max_iterations` → `NO_SOLUTION`/`vis_unsatisfiable_within_bound`.
- `P-APEX-TARGET-TYPED` — on `bookDecreasing`, the returned line's `apex_pct`
  exceeds the decreasing-radius late bar; the ranking never prefers a candidate
  failing the applicable late-apex check (property over fuzzed taper roads).
- `A-SOLVER-FIT` — for every preset in 03 §3.1 (plus `bookDoubleApex`), at the
  suggested entry speed: every derived corner-relative station lies within
  `[0, road_end]`, both search brackets are non-degenerate *before* search, and
  the solve returns a line or a typed sub-reason — never a rail caused by an
  off-road bracket.
- `A-DOUBLEAPEX` — `bookDoubleApex` solved with `style=double_apex`: exactly two
  touches, pinned touch stations/percents/f; on `bookDecreasing` the same call
  yields `NO_SOLUTION`/`no_two_touch_line` (with the best-failing candidate
  retained for `accept=best_failing`).
- `A-SSD-GOVERNOR` — `bookBlind` solved `vis=cautious` **with `vis_margin = 1.4`**
  (pinned on the scenario) under the lean-aware `ssd` converges within
  `vis_max_iterations`, and its governed entry speed is **strictly less than** the
  ungoverned (`vis=none`) solve's. **The `vis_margin` pin is load-bearing and must
  precede the strict comparison.** The reshaped `bookBlind` at 34 km/h carries as
  little as `≈ 23.5 m` of sight against a lean-aware `ssd` of `≈ 17.0 m` on the
  binding (cut-in) line, so the V1 governor first binds at `vis_margin ≥ 1.378`
  (min sight / max `ssd` across the solved lines; `review/verify/fixture_geometry.py`
  check 7); at the default `vis_margin = 1.0` it is **inert** — governed = ungoverned
  — and a strict `<` there would convert a silent pass into a silent *failure*.
  Pinning `vis_margin = 1.4` puts the scenario just inside the binding regime, so
  the governed solve is genuinely constrained and the strict inequality has a
  witness. This resolves the prior OPEN obligations, neither covered by
  `S-CONT-SEPARATION-v2` (promotion-only, while this is a shipped-phase gate):
  (a) the governor does **not** bind on the reshaped fixture at the default margin
  — hence the pin; (b) with it binding, the governed speed is strictly less than
  the ungoverned solve's, the same repair `A-RECIPE-K` received (`08-…md` §6(k)).
- `A-VIS-HOLD-REACH` — on `bookBlind` + `vis=cautious`, the generated hold's
  `position` action passes validation under the governed `v_cmd`. **OPEN — same
  vacuity defect as `A-SSD-GOVERNOR`, for a different reason.** V2 emits a hold
  **for each blind corner** (`04-…md` §6), so on the pre-reshape `bookBlind`,
  where `blind(c1)` was false, V2 emitted **no hold at all** and "the generated
  hold passes validation" was vacuously true. After the reshape `blind(c1)` holds,
  so the assertion should now bite — but it must first assert that a hold **was
  generated**, before asserting anything about it validating; on `bookEsses`
  + `vis=cautious`, the emitted wire plans contain **no** position/turn_in
  overlap and still validate (the zero-gap branch emits no wire action below
  `MIN_POS_DD_M`).

*The chained-visibility pair.* Fixture `fx-esses-blind` := `bookEsses` +
`hedge inside cN 0x12 margin=1.5 depth=4` for N = 1..4, entry 32 km/h (geometry
TUNING; gaps sized so `vis_hold_f` is reachable under the 03 §6.1 lateral
budget).

> **OPEN — `fx-esses-blind`'s recorded diagnosis was wrong in *kind*, and it
> still cannot be repaired the way `bookBlind` was.** The prior reading — `blind(c)`
> false on all four corners, zero blind cells — holds only for the *left*-handed
> legs. `bookEsses` alternates hands, and `03:219` pins that `hand=` does **not**
> move the traffic side, so on its *right*-handed legs (`c1`, `c3`) the `inside`
> band lands on the rider's **own** side of the centreline. Re-derived on `c1`
> standalone (`review/verify/fixture_geometry.py` check 8), the right-handed leg
> has **6/220 blind cells** (min `s_limit` 22.25 m vs `s_end` 23.71 m) — every one
> on the **cut-in** line, none on the hold-wide line. That is an *applicability
> inversion* (`blind(c)` true for the bad line and false for the doctrinal one —
> the same failure as the D46 exemplar-1 inversion), **not** the clean not-blind
> the record claimed, and the prescribed repair (mint a new ≥ 130° fixture) does
> not address it. Swept angle still governs — `R 12 ^75` is far below the ≈ 115°
> half-crossing threshold and no `margin`/`depth`/`span` compensates on the
> *left*-handers, where moving a roadside band only ever *reduces* blocking — but
> the honest reading is that the fixture is blind **on the wrong line**, not
> sighted. *(The mechanism is reconstructed for `c1` standalone; the sweep's
> 45/220-per-corner four-corner figure remains prose-only.)*
>
> This is not a D45 problem: `P-VIS-MARGIN-MONOTONE` and `A-CHAIN-VIS-FULL`
> currently run on corners where `blind(c)` is false, so anything they assert
> about `hold_wide_for_sight` or the blind lean cap is `na`-driven.
>
> **The governor is a separate question and must not be folded into this one.**
> V1 evaluates `vis_margin · ssd ≤ sight_ride_m` **unconditionally**
> (`04-…md` §6) — it does not read `blind(c)`. Whether it binds on
> `fx-esses-blind` depends only on whether `sight_ride_m` falls below
> `vis_margin · ssd` somewhere on the chain, which has not been computed and is
> **open**. The old `bookBlind`'s governor inertness had this second cause
> (≥ 24 m of sight against 14.53 m of `ssd`), not the `blind(c)` one, and
> conflating the two is how `A-SSD-GOVERNOR` came to look adequately witnessed.
> After the reshape, `P-VIS-MARGIN-MONOTONE`'s two named fixtures differ:
> `bookBlind` now satisfies `blind(c)`, `fx-esses-blind` does not.
>
> **`bookEsses` must not be reshaped**: it is committed ink (fig 8.6, `A-ESSES-GATE`),
> and its `S 6` links are pinned to the hand-flip budget. The repair is therefore
> a **new chained fixture**, not an edit to this one — a linked pair of ≥ 130°
> same-or-alternating-hand corners carrying the hedges, hosting the chained
> visibility assertions, with `bookEsses` retained unchanged for the figure and
> for the flip-budget tests. Sizing it is an open decision recorded here rather
> than resolved silently; `review/verify/fixture_geometry.py` is the check any
> candidate must pass.

- `A-CHAIN-VIS-FULL` — on the new ≥ 130° chained blind fixture (the
  `fx-esses-blind` replacement, sized per the OPEN block above and
  `fixture_geometry.py`), **not** the current `fx-esses-blind`, and **with
  `vis_margin = 1.2` pinned** so V1 actually binds (at the default `1.0` the
  governor is inert — `≈ 11 %` headroom — and each of the three clauses is
  independently no-op): `chainedSolve` with `vis=cautious` returns a line that
  (i) passes `stop_within_sight` at every station of the chain — V1
  (`vis_margin · ssd(v, phi).ssd_m ≤ sight_ride_m`) is unconditional, and every
  sight-vs-ssd comparison reads `sight_ride_m`; (ii) over each corner's hold
  window holds `f ≥ vis_hold_f − f_tol` (`f_tol = 0.05`, TUNING) until that
  corner's release station — the fixture's gaps are sized so the full hold is
  reachable **and the line is forced off `start.f`, so the band clause is not
  satisfied by a line that never leaves `f = 1.0`** — and the recorded hold equals
  the computed value, never silently less; (iii) at each hold-release station
  satisfies `trend = opening ∧ sight_ride_m ≥ vis_margin · ssd_m`.
- `A-CHAIN-VIS-BUDGET` — re-homed **off** the zero-gap `bookEsses` variant
  (`A-LINK-FLIP`'s fixture): there the inter-corner spans are **0 m**, so
  `T_cmd = 0`, `dd_max` collapses below `MIN_POS_DD_M`, **no hold is emitted**, and
  the "monotone across each span" universal quantifies over the empty set — the
  budget carve-out it exists to test never fires. Its correct home is a chained
  blind fixture whose inter-corner spans are **short enough that the 03 §6.1
  lateral budget binds** (`budget_limited: true`) **but non-zero so a hold is
  emitted** (a tight-gap variant of the new ≥ 130° chained fixture above; sizing
  recorded there, checked by `fixture_geometry.py`). On it the gate asserts the
  budget carve-out itself — the solver report marks each hold `budget_limited:
  true`; achieved `f` is monotone toward the target across each inter-corner span;
  the release condition is evaluated from the **actual** position (the reached
  `f`, never the unreached target); V1 still holds at every station. Consumes the
  per-corner record `verdict.sight.holds: [{corner_id, target_f, achieved_f,
  budget_limited, hold_release_s}]` (05 §6.3; the field spells `hold_release_s` —
  `release_s` is the per-commitment member of `corners[].turn_ins[]`).
- `A-LINK-FLIP` — the zero-gap `bookEsses` variant either chain-solves
  `contained` at a reduced, recorded speed ≥ the validity floor, or returns
  `NO_SOLUTION`/`link_flip_infeasible` naming the first infeasible link;
  asserted on the named fixture, outcome empirically pinned.
- `A-FIG81-VEHICLE` — on the shipped fig-8.1 scene: both lines emit
  `hazard_visible` for the oncoming vehicle or the mistake line emits none;
  where both fire, `s_good < s_bad`; and at least one retained sample per line
  has its limit point on the vehicle footprint. (Empirically pinned; a pin that
  stops holding is an engine/tuning bug per the oracle's iron rule.)
- `A-SOLVED-PLAN-VALIDATES` — every solver-emitted plan — `solve`,
  `chainedSolve`, the visibility mode, `solveDoubleApex`, mistake compiles, and
  every cached `solved.plan` — passes `validate` unchanged (zero-length-span
  position/turn_in overlaps are a solver bug class, whatever the emitter).

The D8 effectuality rule for the solver's author-visible surfaces (`vis_hold_f`,
`vis_margin`, `hand`, `style=`, `corner=<id>..<id>`, every constraint bound, and
each refusal sub-reason's reachability) is owned by the witness-table harness
(§8.1) — it is not restated per-field here.

### 3.6 CLI and cold-start acceptance

The tests `08-cli-and-agent-interface.md` §2 and §6 delegate to this document.

**The cold-start test (`T-COLDSTART`).** Operationalizes G4.

- **Context:** a fresh agent context (identity pinned in `verify/coldstart.json`
  — `{agent_model, agent_model_version, attempts: 3}`, the same pattern as the
  vision judge) containing the complete `linelab schema` output plus the
  `explain` outputs for the closed vocabularies. During the attempt the agent may
  freely invoke `schema`, `explain`, and `check`; it may not read design docs,
  examples, source, or the book.
- **Battery:** one task per recipe (a)–(j), phrased as *goals* (never commands),
  plus one novel-scenario task per input surface (road-dsl, plan, occluder,
  hazard, mistake, constraint, figure).
- **First-try, defined:** the first non-lint invocation (`run` / `solve` /
  `figure` / `sweep` / `compare`) must satisfy the task's mechanical acceptance
  predicate. `schema`/`explain`/`check` calls are free — self-documentation is
  the designed path; trial-and-error against the engine is what the bar forbids.
- **Pass bar:** 3 attempts per task; release bar = 3/3. A 2/3 is recorded
  `flaky` and is a **schema-text defect** (the `schema` output is the artifact
  under test) — fixed there, never by loosening the bar.
- **Trigger:** at release, and whenever the hash of the full `schema` output
  changes. Never per-commit. Deterministic CI leg: `T-COLDSTART-RECORD` asserts
  a committed record exists whose `schema_output_hash` matches the current
  binary's output **and whose recorded per-task pass rate is `3/3` on every
  battery task** — the hash alone is invariant under the cold-start pass rate the
  gate exists to guard, so a `3/3 → 0/3` regression with unchanged `schema` text
  would otherwise pass silently. (Same committed-record pattern as
  `T-JUDGE-RECORD`, §7.4.)

**Per-recipe acceptance tests (`A-RECIPE-*`).** Deterministic, agent-free. The
harness **extracts the command blocks from 08 §6 verbatim and executes them** —
the doc text is the test input, so a recipe edit that breaks behaviour fails CI
and recipe rot is structurally impossible. Each is also written as the narrated
walk-through the educational-test rule (§8) demands:

- `A-RECIPE-A` (ideal line): exit 0; one `ideal` line; outcome `contained`,
  quality `good`; `apex_pct ∈ (50, 90)`; events include brake, turn-in, apex.
- `A-RECIPE-B` (ideal + mistake overlay): exit 0 (the pin table is the mistake
  line's declaration); two lines; mistake-line outcome = the `premature` fixture
  pin (`runoff`); render exit 0; proportion gate passes.
- `A-RECIPE-C` (blind compare): both solves succeed; over the shared approach
  span, `min(sight_ride_m − ssd_m)` is strictly larger on the governed line; governed
  entry speed is lower; both verdicts present in the compare output.
- `A-RECIPE-D` (linked chain + per-corner mistake): the chained ideal line
  grades by the chain-aware check set to green (outcome `contained`, quality
  `good`); the mistake line's per-corner deviation **increases**
  corner-over-corner (compounding, measured by the per-corner peak-`f` metric of
  `O-CHAIN-PREMATURE`).
- `A-RECIPE-E` (named book figure): figure bake exit 0; two lines; SVG written;
  proportion gate passes; manifest shows hourglass/ring/dot markers and per-line
  sight rays (occluder present); `T-JUDGE-RECORD` satisfied for the exported
  figure.
- `A-RECIPE-F` (constraint recipe, R6): satisfiable arm — verdict `constraints`
  block records `satisfied: true`, non-negative margin, tightest station;
  refusal arm (a tightened variant fixture) — exit 3,
  `NO_SOLUTION`/`constraint_unmet` naming the constraint id and worst station.
- `A-RECIPE-G` (tipping-point sweep): the outcome column exhibits the monotone
  flip; `truncated: false`; `chop.end_s` marches backward (the departure station
  receding) as entry rises; a full re-solve per cell, the `scenario.entry_kmh`
  root recomputing the whole pipeline.
- `A-RECIPE-H` (fig 8.5 entry-window sweep; also named `A-8.5-WINDOW`): sweeping
  `scenario.entry_kmh` 26→44 on the shipped scene's `late` line yields the three
  bands (contained ▸ wide/runoff ▸ refusal-or-crash) with monotone boundaries
  and a non-empty teaching window containing 30 km/h in which `good.outcome =
  contained` and `late.outcome ∈ {wide, runoff}`.
- `A-RECIPE-I` (believed road, fixture `F-BELIEVED-90`): the executed line
  grades a failing class; the envelope carries believed-vs-actual provenance
  (`verdict.misjudgment`, `source.kind = "misjudge"`).
- `A-RECIPE-J` (double apex, preset `bookDoubleApex`): two recorded apexes
  (lane-fraction minima); green under the double-apex `na` carve-out.

**CLI-verb acceptance tests:**

- `A-STATE-VERB` — `state` on a two-line envelope: missing `--line` exits 2
  listing line ids; a valid query's stdout equals the library `stateAt` result
  byte-for-byte; a beyond-termination query is a typed `BAD_RANGE` with the
  valid interval (no silent clamp).
- `A-RESOLVED-RERUN` — `export --as scenario --line <id>`, re-run the document:
  trajectory tolerance-equal to the original line and `result_hash` reproduced —
  per mistake kind, explicitly including the two controller-level kinds:
  `slow_steer` (the exported document carries `rider.roll_rate_cap_dps = 15` on
  the street fixture) and `chop` (the exported throttle-cut action carries
  `slew_mss` + `freeze_steer_s`). Extends §4's share round-trip.
- `A-FIGURE-JSON-PARITY` — scene text vs `lowerScene` output: byte-identical
  envelopes, equal `spec_hash` (spelling never changes identity, D30).
- `A-MISTAKE-GRAMMAR` — one parameterized scoped token
  (`[lineId=]kind[:k=v,...][@scope]`) through verb, sugar flag, and scene lowers
  to the identical MistakeSpec JSON; the legacy scene `scope=` spelling and
  `--corners` are rejected with typed rewrite hints.
- `A-MISTAKE-SUGAR` — `--mistake "premature:early_by_m=6@c1,c2"` round-trips to
  `{kind: "premature", params: {early_by_m: 6}, scope: ["c1","c2"]}`.
- `A-SWEEP-ROOTS` — every root in the closed set (`plan. | scenario. | config. |
  ride. | mistake. | constraint. | believe.`) observably changes the addressed
  value per cell; unknown root / non-numeric field / bad range produce their
  named typed errors; the `sweep_max_cells` cap sets `truncated`.
- `A-COMPARE-ROADS` — differing roads → `SCHEMA`/`road_mismatch` exit 2; same
  road with differing occluders → success with `world_delta` populated; unpaired
  lines listed.
- `A-MERGE-PIN` — authored `--brake 3.0` with `--turn-in auto`: the emitted
  plan's decel equals 3.0 (bisection skipped); an authored `--position` is
  present in the final plan and in every self-verified candidate; an impossible
  position → `NO_SOLUTION`/`authored_action_conflict`.
- `A-EXPLAIN-KIND` (**extended** — the vocabulary-disjointness test) — `explain
  premature` returns the teaching-table row plus the naming-trap note
  (`early_apex` tombstone); the three explain vocabularies are disjoint.
  Extended to cover `Standing`: the five rung tokens are disjoint from check ids,
  error codes, mistake kinds and event kinds, and each token reused from the
  outcome or quality vocabularies (`crash`, `caution`, `failing`, `clean`) is
  asserted to be a threshold on its namesake predicate rather than a second sense
  of the word (D43; D11's `contained` prohibition is thereby honoured rather than
  routed around). Extended further to cover `CounterfactualRider`, `CfPredicate`,
  `SaveWindow.status`, `refute_reason` and `escape_status`.
- `A-CORR-EXPLAIN` (**extended**) — `explain` on `G-CORR-WIDE`'s envelope
  narrates the save ("recoverable: reserve-lean save from s=…, returned at s=…"),
  and on `G-CORR-RUNOFF` names the `fail_reason` — the corrective block is
  legible, not just recorded. In addition, every rendered corrective surface
  (`explain`, the ghost legend, the `correction` bookmark text, the stepper HUD
  chip, `state --line` output when a corrective exists) contains the literal
  substring `lean-only rider` and, on the long surfaces (`explain`, legend), the
  full `04-solver-and-authoring.md` §4c.7 lean-only disclosure sentence
  byte-for-byte. A corrective surface that names the outcome but not the rider
  fails.
- `A-CF-REGISTRY-CLOSED` — `schema` prints the `CounterfactualRider` and
  `CfPredicate` sets; a config, pack or CLI token naming an unregistered id is
  rejected `UNKNOWN_ID` naming `04-…md` §4c; a token naming
  `brake_reserve_escape` before D45 ships is rejected `SCHEMA` with
  `deferred: "continuation envelope (D45)"`. Every rejection is asserted on its
  typed reason, never on message text.
- `A-CF-DEAD-REASON` (a §8 clause given an id) — the union of `fail_reason`
  strings emitted anywhere in the fixture corpus, plus the union of the closed
  sets printed by `schema`, contains no name absent from the design of record and
  no name the design of record declares and no fixture can produce.
  `shadow_stopped` appears in neither, in either direction.
- `A-SAVEWIN-VERB` — `linelab save-window` stdout byte-equals the library
  `saveWindow` output (the `A-STATE-VERB` pattern).
- `A-SAVEWIN-PLACARD` — the `04-…md` §4b.7 placard string is present,
  byte-identical, on **every** surface that prints a save-window scalar: HUD, CLI
  human summary, `explain`. A scalar printed without its placard fails.
- `A-STANDING-TOMBSTONE` — `out_available`, `sight_ok`, `SIGHT_MARGIN_ROB` and
  `commit_within_sight` each reject `UNKNOWN_ID` with reason
  `struck_by_decision`; the first three name their successor mechanism and the
  fourth names none; `"sight_vs_stopping"` in a rubric annex rejects
  `renamed_check` naming `stop_within_sight`. Asserted on typed reasons only.
- `A-SCHEMA-SHAPE` — the full `schema` output parses; every section validates
  against the Section meta-shape; the cli flag table is bijective with 08 §4.1
  (the mechanical form of "every field has a flag", FigureSpec-only members
  exempted as declared).
- `A-SCHEMA-JSON` — every `schema <section>` output `JSON.parse`s and validates
  against `SchemaDoc`; the cold-start test consumes only `SchemaDoc` content.
- `A-FLAG-MAP` — every wire field appears exactly once as a non-sugar row in
  `schema cli`.
- `A-IMPORT-SURFACE` — every API name any design doc requires resolves from the
  package root; `schema config` shows `checks_version` optional-with-default and
  no `mode`.
- `A-HAZARD-FLAG` — `--hazard` changes per-sample `mu` on a reference scenario;
  same for `--use-full-width` and `--bike-margin` (the flag-level D8 twins of
  their §8.1 witness rows).
- `A-FULLWIDTH` — one scenario authored three ways (JSON flag, scene road
  option, CLI flag) composes to the identical corridor; a line contained under
  `fullWidth=true` at `f = 1.3` maps to `f > 1` (off-road gloss) under the same
  geometry with `false`.
- `A-EXIT-DECLARED` — three-case script over the 08 §3.1 exit law: an
  intended-fail scene exits 0; `--gate` with an undeclared check failure exits
  3; a declared failure that unexpectedly passes exits 3 (deviation in either
  direction).
- `A-GATE-FIGURE` — recipe (b)'s figure under `--gate` exits 0; a fixture whose
  mistake line comes out clean exits 3; a `best_failing` line that comes out
  clean exits 3; roles permuted → gate result unchanged (roles never gate, D9).

---

## 4. The mistake oracle (carried) and the rubric acceptance suite

Every mistake preset — one per kind in the closed set `premature`,
`premature_contained`, `slow_steer`, `fifty_pence`, `chop`, `overspeed`,
`underread`, `overread`, compiled by `compileMistake` (`early_apex` survives only
as an `UNKNOWN_ID`/`renamed_kind` tombstone) — is forward-run through the real
engine on its named base fixture. The suite asserts the declared check
**actually fails**, the outcome lies in the kind's **admissible set**, and on the
named fixture equals the **fixture pin**. Reconciled both ways: an expected
failure that doesn't occur, or an unexpected one that does, is a red suite.

**Named base fixtures (committed; this section and 03 §7.1 reference them by
name):**

- `F-ORACLE-90` — preset `book90` (left-hand default), entry 34 km/h, profile
  `street`, `mu 1.0`; good line = the default `solve`. Base for
  `premature_contained`, `premature`, `slow_steer`, `fifty_pence`, `chop`,
  `overread`.
- `F-ORACLE-DR` — preset `bookDecreasing`, entry 34 km/h, `street`. Base for
  `overspeed` and `underread`.
- `F-ORACLE-CHAIN` — preset `bookEsses`, entry 32 km/h, `street`; chained
  `premature` with `scope: "all_corners"`.

**The pinned table.** The normative, machine-readable home is 03 §7.1 — one
table holding each kind's admissible outcome set and its single-class fixture pin
(`TUNING-PIN` marked: blessed by the oracle's first green run, then frozen under
the iron rule below). The view here is informative; `ORACLE-PIN-TABLE` asserts
the single-sourcing structurally — the oracle's expected values are read from the
same machine-readable source that feeds `schema mistakes`
(`{admissible_outcomes, fixture_pin}` rows), so a drifted duplicate is
structurally impossible.

| Kind | Fixture | Fixture pin (TUNING-PIN) | Mandatory check failure (`expect_fail`) |
|---|---|---|---|
| `premature_contained` | `F-ORACLE-90` | `contained` | `late_apex` (+ `out_in_out`) |
| `premature` | `F-ORACLE-90` | `runoff` | — (the outcome *is* the lesson; the oracle additionally asserts `corrective.feasible = false` and `terminated.reason = "off_road"`) |
| `slow_steer` | `F-ORACLE-90` | `runoff` | `quick_steer` |
| `fifty_pence` | `F-ORACLE-90` | `wide` | `single_input` |
| `chop` | `F-ORACLE-90` | `runoff` | `throttle_rule` (the chop leg) |
| `overspeed` | `F-ORACLE-DR` | `runoff` | — |
| `underread` | `F-ORACLE-DR` | `runoff` | as declared by the kind |
| `overread` | `F-ORACLE-90` | `contained` | its mandatory failed checks |
| `premature` @ `all_corners` | `F-ORACLE-CHAIN` | `runoff` at the final corner | — (see `O-CHAIN-PREMATURE`) |

Admissible sets (03 §7.1): the run-wide kinds admit `{wide, runoff}`;
`overspeed` admits `{wide, runoff, crash}`; the contained kinds admit
`{contained}` with their mandatory fails. Engine outcome outside the admissible
set on any conforming road is a red suite. Rules attached to the table: pins are
design pins in the invariant-first style of 02 §5.4 — each kind's TUNING default
params are *servants to the pin*: if the defaults stop producing the pinned class
on the named fixture, the params move (a TUNING re-tune landing via §3.3's
re-bless), never the pin; `premature → runoff` on `F-ORACLE-90` is a stated
requirement on the corrective-shot spec (the corrective must be infeasible there
— the oracle is what makes that spec falsifiable); a pin flip is a design change,
full stop.

The oracle's iron rule is carried verbatim: **a mismatch is an engine, compiler,
or doctrine bug — never fixed by editing the expectation.** The single legitimate
occasion to edit the pinned outcome table is a designed physics migration landing
through §3.3's re-bless procedure — the consolidated migration of §3.3 is the
known first instance: it re-keys `chop`'s outcome class to the book's run-wide
(`runoff` fixture pin) deliberately, in that one commit, with the change called
out in the migration notes and the affected doctrine checks re-verified.

**Oracle extension tests:**

- `O-CHAIN-PREMATURE` — on `F-ORACLE-CHAIN` (pins blessed, never asserted): the
  final outcome class (`runoff` at the final corner); `applied_corners` pinned
  (and, if the line terminates mid-chain, the terminating corner with it); the
  compounding property — per-corner peak `f` strictly increases across
  consecutive applied corners while the line is live. Fig 8.6's "each corner
  wider" device, finally a test rather than a sentence.
- `A-SU-ATTRIBUTION` — rides the oracle fixtures: on the chop fixture,
  `max |su_transient| > 0` and the `stand_up` diagnosis' evidence cites the su
  channel; on the sustained-brake fixture (the fig 8.5 failed line),
  `max |su_sustained| > 0`. The `stand_up` diagnosis is auditable from the trace
  alone.
- `A-MISTAKE-FAILS-CHECK` — for every mistake kind on its named fixture, the
  compiled line's failed-check set ⊇ its `expect_fail` pin and the outcome
  matches the pin (where the mandatory cell is empty the ⊇ clause holds
  vacuously and the row asserts outcome only); explicitly includes
  `slow_steer` → `quick_steer` FAIL on `book90`.
- `A-QS-TWOSIDED` — the `book90` good line passes `quick_steer` with
  `steer_share ≤ 0.30`; the `slow_steer` compile fails it — the two-sided
  geometry-normalized gate pinned from both sides.
- `A-RENAME-REJECTED` — `expect_fail: ["sight_vs_stopping"]` → `UNKNOWN_ID`
  naming `stop_within_sight` (typed tombstones, never silent aliases).

**The rubric leg (01 Appendix A's catalogue, verified here):**

- `A-CATALOGUE-RESOLVES` — every check id referenced anywhere in the repo
  (fixture `expect_fail`s, oracle pins, goldens' check vectors, the `explain`
  registry, docs' fenced id mentions collected in one committed list) resolves
  against the shipped pack; the pack's id set equals Appendix A's 16 exactly.
- `A-CATALOGUE-EXERCISED` — every one of the 16 ids has ≥ 1 committed fixture
  where it *fails* and ≥ 1 where it *passes* — a check that cannot fail is dead
  doctrine (D8's spirit at the catalogue level).
- `A-CHAIN-GREEN` — the `bookEsses` `chainedSolve` line grades
  `outcome = contained`, the chain checks pass, per-corner checks pass under
  chain-mode applicability (open-exit checks `na` on interior corners),
  `quality = good`, colour green, `solve` exit 0.
- `A-RUBRIC-STAMP` — every verdict carries `rubric`; recompute under the **same**
  pack reproduces `result_hash`; **and recompute under a pack whose perturbed
  grading threshold is decisive on the fixture produces *different graded values*
  (`doctrine` and/or `quality`) — not merely a different `result_hash`.** The third
  arm must bite on the *grade*, not the hash: the `rubric` pack-id stamp is itself
  **inside** `result_hash` (it is not on the `05 §8.3` exclusion list), so two
  distinct packs already differ in `result_hash` from the stamp change alone — an
  engine that stamps the pack but ignores it in grading would still pass a
  "`result_hash` differs" arm, exactly the vacuity the arm exists to close.
  Asserting that the graded `doctrine`/`quality` values move is what shows the
  rubric *feeds* the grade (the mechanical mirror of `P-OUTCOME-RUBRIC-FREE`, which
  pins that a rubric change moves exactly `doctrine`/`quality`/`result_hash`), which
  field-presence and same-pack determinism both leave open.
- `A-DANGER-DWELL` — the `lean_ceiling`-fail fixture required by
  `A-CATALOGUE-EXERCISED` pins `corners[].danger_dwell_s` to the
  bracketed-interpolated reserve-exceedance time (arithmetic owned by 01
  Appendix A) within numeric tolerance; C30's clean run records `0.0` on every
  corner.

**The standing leg (D43's ladder, verified here).**

**`F-STANDING-WARN` (new committed fixture).** Preset `book90` (left-hand
default), profile `street`, `mu 1.0`, default `solve`,
`entry_kmh = F_STANDING_WARN_ENTRY_KMH = 38 km/h` (TUNING-PIN).

The arithmetic that makes 38 the starting point, stated so the calibration is
auditable: check 8 passes iff `phi_max ≤ phiReserve(0.85 · 1.0) = atan(0.85) =
40.36°`. On `book90`'s corridor radius `R = 12 m`, the entry speed at which a
steady-state line first demands exactly that lean is
`v = sqrt(g · R · tan phi_res) = sqrt(9.81 · 12 · 0.850) = 10.003 m/s =
36.01 km/h`, against the preset's 34. A doctrinally correct out-in-out line rides
a **larger** radius than the corridor centreline, so 36.01 km/h is a **floor** on
the entry that reaches the warn band, not the value. The pin is therefore
calibrated within `[36, 44] km/h`, and the pin is:

```
outcome = "contained"  ∧  clean(line) = true
  ∧  lean_ceiling verdict = "warn"        ("ate the reserve")
  ∧  standing = "clean" (rung 3), reserved_blocked_by = [ {lean_ceiling, "warn"} ]
```

`entry_kmh` is a **servant to the pin**, in the idiom this section already uses
for mistake-preset params: if 38 km/h stops producing `contained ∧ warn`, the
entry moves within the band under the §3.3 re-bless discipline; the pin never
moves. If no entry in the band yields `contained ∧ warn`, that is an engine or
doctrine finding reported under the oracle's iron rule — never an edited
expectation.

- `A-STANDING-WARN-BAND` — `F-STANDING-WARN` matches the pin above, in full.
- `A-STANDING-RESERVED` — on `F-ORACLE-90`, the good `book90` line grades
  `standing = "reserved"`, both reserve rows `pass`, `reserved_blocked_by = []`.
- `A-STANDING-LADDER-CUMULATIVE` — a table-driven test over synthesised
  `(outcome, quality, clean, reserve verdicts)` tuples spanning the full product,
  asserting the returned rung equals the greatest satisfied threshold.
  Educational: the table *is* the readable definition.
- `A-STANDING-REFUSAL` — a `NO_SOLUTION` envelope entry yields
  `standing: null, refused: true`, never a rung and never an exception.
- `A-RESERVE-CHECKS-RESOLVE` — every member of `parks-street/2`'s annex resolves
  in that pack's check id set; a synthetic pack with a missing / empty / unknown
  / tombstoned annex produces exactly the four typed errors of
  `01-scope-and-doctrine.md` §A.6.1, each asserted by code **and** reason.
- `A-LADDER-PROSE` — every surface that prints a `standing` token (CLI JSON,
  `explain standing`, `check --standing` prose, the `06-rendering-and-projection.md`
  legend row, the margin card) also prints the pack id, the `checks_version`, the
  rung-token gloss, and the `05-result-contract-and-inspection.md` §6.4 placard
  verbatim. The disclosure obligation is enforced, not documented. *(This id is
  owned here. The ratification-stage test of the same name — a rider-disclosure
  test for the standing ladder's out probe — is void: D43 deleted the probe, and
  the ladder emits no counterfactual verdict and names no rider.)*
- `A-PACK-PROVENANCE` — over every committed pack under `plan/doctrine/packs/`
  **and** `plan/continuations/packs/`: (a) every `source` string is `"TUNING"` or
  matches `^book:`; (b) every `book:<cite>` resolves to a line present in the
  committed `book_text/` extraction; (c) the cross-check — for every constant the
  design of record marks `TUNING`, no pack anywhere binds that constant's name
  with a `book:` source. Every rejection is asserted **on its typed reason**, and
  that reason is `SCHEMA/source_unresolved` (`01-…md` §A.6) for every pack root
  alike — continuation packs raise the same reason as rubric packs, and a test
  that accepts any other reason token fails. Failure prints the pack, the check or field id, the name
  and both provenances. This is the test that makes "never claim a book source
  for a `TUNING` value" mechanical rather than cultural, and it is the test
  `escape_decel_mss` was written to satisfy.

Because failed lines are first-class objects (D6), the oracle extends one step
beyond the prior design: for every mistake kind, a round-trip test shares the
scenario + mistake spec through the export path defined in
`05-result-contract-and-inspection.md`, recomputes it as a consumer would, and
asserts the recomputed trajectory is tolerance-equal to the original
(`A-RESOLVED-RERUN`, §3.6, is the per-kind mechanical form, covering the
controller-level kinds explicitly). What is shared is inputs; what is displayed
is always recomputed.

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
- `P-PROJ-IDENTITY` — `mode=true` with **no window** is the identity projection on
  `(s, d)`, byte-exactly; `mode=true` **with an explicit window** is the identity
  composed with a pure **crop** — the window bounds the drawn extent but never
  rescales `(s, d)`. This pins the precedence 06's `mode:"true"` definition ("the
  identity transform plus optional crop") otherwise leaves open: an explicit window
  crops, it does **not** make the mode yield to a stretching transform.
- `P-PROJ-MARKER` — every marker and callout anchor (corner-relative, per the
  scheme in `03-roads-scenarios-and-visibility.md`) lands on its line's projected
  image, never in empty space.
- `P-PROJ-LEADER` — extends `P-PROJ-MARKER`: every label leader endpoint lands on
  its anchored line's projected image (or the road centreline, for road anchors).

These run on fuzzed roads and line sets, not only fixtures — the projection must
hold its invariants for anything the road DSL can express.

**Five of these eight are algebraic identities of the projection, not independent
tests, and are labelled as such.** `06 §2.2` defines the transform as
`s'(s) = ∫ 1/c(seg) du` with `c > 0` everywhere (so `s'` is strictly monotone) and
`d' = d · width_exag` with `width_exag > 0` (clamped `≤ WIDTH_EXAG_MAX`, `06 §2.2`)
— from which
`P-PROJ-ORDER` (`s'` monotone ⇒ station order preserved), `P-PROJ-SIDE`
(`sign(d') = sign(d)` because `width_exag > 0`), `P-PROJ-APEX-REL`, `P-PROJ-CROSS`
and `P-PROJ-IDENTITY` follow from the definition before the engine runs. They are
kept as **XY-space regression guards** — they catch a transform that stops being
positively-scaled and monotone-in-station — but they do **not** test the one thing
the projection actually *decides*: which `width_exag` / orientation / window it
picks. That is covered by a property over parameter *selection*, not just the
transform's algebra:

- `P-PROJ-PARAM-SELECTION` — over fuzzed roads and line sets, the `width_exag`,
  orientation and window the projection **selects** for a `diagram`-mode figure are
  the ones that put the sidecar metrics inside `§5.2`'s bands; where no legal
  parameter does, the figure is **refused** (out-of-band failure per `§5.2`), never
  drawn stretched. This is the decision the five identities cannot fail on, and
  where a real projection bug would live.

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

The round-trip includes the portrait chain numerically: `A-ESSES-GATE` — the
shipped fig-8.6 scene exports in diagram mode with gate verdict `pass`; the
manifest records `orient: 90`; `road_ink ≥ 0.25`; and the same scene in `true`
mode still lands near the bands. Portrait multi-corner figures pass via 06's
auto-orientation and aspect-floor padding — the gate itself never moves, and a
stretched figure is never "disclosed" into acceptability.

### 5.4 Annotation and ink verification

Annotations are event-sourced (markers are glyphs of trajectory events; label
anchors resolve against the same events — grammar owned by
`06-rendering-and-projection.md`), so they are verified against events, never
against pixels:

- `P-MARKS-EVENTS` (property, fuzzed figures) — drawn markers ↔ events
  bijection: every marker corresponds 1:1 to an in-window event of its class's
  kind on its line; no eventless marker.
- `P-INK-GRAMMAR` (property over rendered SVG) — no non-`reference` trajectory
  carries a dash pattern; every dashed stroke is a sight ray or dotted
  reference; every trajectory has an arrowhead and no annotation stroke does; no
  trajectory shares a stroke pattern with any annotation stroke.
- `A-FIG82-SINGLEMARK` — the fig 8.2 scene renders exactly one hourglass,
  **green**, at the shared station (coincident-marker collapse). The collapse
  takes the colour of the owning line **drawn last in role order — `ideal` wins
  ties** (06's coincident-collapse rule), and the ideal line is green; a `red`
  assertion here **contradicts the colour law** and is unsatisfiable (the
  marker-collapse golden below agrees: "topmost-draw-order colour"). *(The fig-8.2
  scene roster itself is still undefined in `design/` — see the book-figure-scene
  gap, §10 / §4-of-the-sweep.)*
- `A-FIG83-MARKS` — the fig 8.3 scene with `marks: turn_point`: the green line
  carries exactly 1 hourglass, the fifty_pence line exactly `facets`
  hourglasses, zero rings/dots.
- `A-FIG83-TOPOLOGY` — `bad`'s first `turn_in` station < `good`'s; exactly one
  crossing inside the corner window (`P-PROJ-CROSS` guarantees it survives
  projection).
- `A-LABEL-ANCHORS` — the shipped label sets for figs 8.1/8.3/8.4/8.5 all
  resolve on their fixtures (8.5 on the shipped scene's `good`/`late` roster,
  including the `correction@late +8` spaced-offset anchor); leader endpoints
  pass `P-PROJ-LEADER`.
- `A-ANCHOR-ERRORS` — `turn_point#7@bad` (facets=6) → `UNKNOWN_ID`/
  `anchor_no_match` listing six candidates; `apex@double` on a two-touch line →
  `anchor_ambiguous` listing both stations with `#n` spellings.
- `A-LEGEND-AMBER` — a fixture with a contained `mistake` line and a contained
  `alternative` line renders two amber rows whose role words differ (legend
  prints `role · quality (outcome)`, e.g. `mistake · caution (contained)` — the
  two meanings of amber separate on those words); manifest `legend` records
  match each line's verdict.
- Marker-collapse golden — two lines sharing a turn-in with both marked → one
  glyph, topmost-draw-order colour.

---

## 6. Interactive-surface and result-contract tests (new)

The viewer is verified as a pure view-model, headlessly, against the result
contract; the result contract and wire shapes are verified by the same mechanism,
so every `C-*` contract test lives here. Pixel testing of the viewer is limited to
one boot smoke test per view (`topdown`, `controls`, `pov`): it renders without
error on a fixture scenario. Everything of substance is a contract test.

*Result contract and wire shapes:*

- `C-STATEAT-LAWS` — the interpolation laws pinned in
  `05-result-contract-and-inspection.md` hold: endpoint exactness (querying a
  sample's own `s` or `t` returns that sample), monotone `s`↔`t` mapping,
  angle-aware interpolation for `psi` and `phi` (no wraparound smear), and typed
  Result errors outside the trajectory's domain.
- `C-TREND-WINDOW` — a synthetic sight-profile golden pins the
  `opening`/`closing`/`steady` transitions of `sight_trend` exactly at the
  window+deadband boundaries defined in 05 §4.
- `C-RAW-RETENTION` — schema-level: `Trajectory` has exactly one sample array
  (the resampled record); an envelope round-trip contains no second series (the
  raw 200 Hz series is integrator-internal scratch, never retained).
- `C-PHASE-TOTAL` (property) — over fuzzed scenarios, every sample's phase is
  defined, lies in the five-token closed set
  `approach | turning | midcorner | exiting | done`, and never regresses within
  a corner.
- `C-COLOUR-DERIVE` — table test over (outcome × check results × severity) →
  `quality`, including the chained-green fixture; asserts quality is total and
  no input reaches a dead branch.
- `C-SCENE-MULTIRIDE` — 04 §7's worked example (with `good:` and `wide:` rides
  plus `bad:` mistake) bakes; the mistake compiled against `good` (the first
  ride line is the reference); `wide` carries role `alternative`; a zero-ride
  scene fails typed `SCHEMA`.
- `C-REFUSAL-ENVELOPE` — a scene with one unsatisfiable `vis=cautious` line
  bakes the others and carries exactly one typed `LineRefusal` envelope entry
  (keyed by `line_id`); refusals never abort the figure.
- `C-OCC-TOKEN` — the occluder/vehicle anchor grammar: bare `c1` parses as
  `entry:c1` sugar; canonical `entry|exit|mid:<id>`; absolute `s:<m>`; the
  vehicle's spaced offset form (`vehicle oncoming exit:c1 +8`) parses to
  `at.offset_m` while the embedded form is rejected
  `SCHEMA`/`anchor_embedded_offset`.

*Viewer, HUD, and POV:*

- `C-HUD-EQUALS-STATEAT` — at any scrub position, every HUD field equals the
  corresponding field of `stateAt(result, {t})`. **The viewer never re-derives
  physics**; this test is the enforcement.
- `C-HUD-ANORETURN` — extends `C-HUD-EQUALS-STATEAT`: the HUD's `a_noreturn` and
  stand-up chips equal `stateAt.derived.a_noreturn_ms2` / `.stand_up_dps`; the
  derived value equals the closed form over the recorded `phi`/`roll_rate`;
  `null`/"—" upright.
- `C-BOOKMARKS` — the stepper's named jump targets are exactly the result's
  events; jumping lands the scrubber at the event's interpolated `t`.
- `C-COMPARE` — in compare mode, each line's ghost state equals its own `stateAt`;
  lines never share or leak state.
- `C-PHASE-MACHINE` — per fixture, the distinct-phase sequence over `t` equals a
  pinned expectation (C30 clean: `approach…done`; chop: ends in its pre-terminal
  phase, never `done`; `bookEsses`: contains the chain re-entry
  `…exiting|midcorner → approach → turning…`); phase changes occur only at
  opener events; querying an opener's exact `t` returns the opened phase.
- `C-STRIP-BANDS` — `renderControls` band edges equal the phase-transition
  stations of the same result: one partition, two consumers, zero drift.
- `C-POV-LIMIT-CONSISTENT` — at any sample, the POV's limit-point marker and the
  `topdown` view's limit point are projections of the *same* `sightFrom` result —
  identical world coordinates before view projection — and this holds in **both**
  `look` modes.
- `C-POV-LIMIT-ALWAYS` — extends `C-POV-LIMIT-CONSISTENT`: every POV frame of
  every fixture line contains exactly one limit-point marker,
  `markerState ∈ {placed, clamped}`, whose world source equals the sample's
  `(limit_x, limit_y)` — the limit point never leaves the frame (D40).
- `C-POV-LOOK` — (a) the `G-POV-CLAMP-MIDCORNER` sample under
  `look: limit_point`: `markerState = placed` and yaw equals the camera law's
  worked value; (b) frames are pure: identical result → byte-identical draw
  lists per mode; (c) toggling `look` changes no `stateAt` output, no verdict,
  no hash.
- `C-POV-TRUE-GEOMETRY` — the POV consumes only true-geometry trajectories and
  road edges. Enforced structurally (the projection module is imported only by the
  diagram-mode render path, never by `viewer/` POV code — an import-graph lint)
  and behaviourally (POV output is byte-identical across all projection settings).
- `C-POV-OCCLUDE` — static config test: `min(occluder-kind heights) ≥
  eye_height_m + POV_OCCLUDE_CLEAR_M`; plus one POV render golden with a `wall`
  fully breaking the road at the limit point.
- `C-ONE-CORE` — **a bundle-graph lint**: the viewer's recompute path and the
  CLI's solve path resolve to **one** `engine/` module — a single entry imported by
  both `viewer/` and `cli/`, with no second copy of the engine in either bundle.
  This is what has teeth. Recomputing a trajectory and comparing it to the CLI's is
  a **tautology** when (D1) the two are literally the same ESM module imported twice
  (`09 L1739`), so that recompute-equality is kept only as a cheap sentinel; the
  lint is the guarantee that makes viewer-side recomputation of shared scenarios
  (D6) honest — it goes red the moment a build duplicates the core.

*Share-URL skew (05 §8.4):*

- `C-SKEW-DETECT` — a committed FigureSpec fixture with **four lines, one per
  tier**, so every `skew` tier carries a witness rather than the `detail` tier
  being masked: `match` (stamp reproduces exactly), `unstamped` (no stamp), `detail`
  (stamp's `outcome` reproduces but `result_hash` differs — numbers moved, story
  held), and `story` (stamp's `outcome` no longer reproduces). Recompute yields the
  figure-level `skew.tier: "story"` (the max over lines) with the correct per-line
  tiers (`match | unstamped | detail | story`), and the placard string renders in
  both the viewer view-model and the SVG export. On the prior one-stamp fixture the
  `detail` tier — `NOT story ∧ result_hash differs` (05 §8.4) — is unreachable, so
  the gate never exercised it.
- `C-SKEW-CLEAN` — `export --as share-url` → decode → recompute on the same
  engine/runtime → every line `tier: "match"`, `skew.tier: "match"`, no placard
  (one fixture with §4's round-trip, one more assertion).
- `C-SKEW-NEVER-BLOCKS` — for any valid stamps, loading yields a complete
  FigureResult with every line's full trajectory and verdict; skew influences
  only the `skew` member and rendering, never computation.

### 6.1 The recompute budget (honest arithmetic)

One auto-solved line = `suggestTurnIn` (17 coarse runs) + up to 4 candidates ×
full solve (1 probe + 16 decel + 16 roll-on + 1 self-verify = 34 runs) ≈ up to
153 engine runs. `chainedSolve` multiplies per corner plus its ascending decel
scan; `vis=cautious` wraps the whole chain in up to `vis_max_iterations = 4`
fixpoint passes. The blind-esses figure lands at order **600 engine runs**, each
~2,000 RK4 steps plus `sightFrom`'s O(stations × occluders) scan per resampled
sample; a "coarse" run at `ds_m = 1.0` costs the same integration as a full run
(dt is fixed at 0.005 s); the corrective adds one shadow run per ran-wide corner.
A solve-included 100 ms interactive budget is therefore off by roughly two orders
of magnitude — the honest number, not defended.

Shared figures take the cached-plan path instead (05 §8.1's `solved` member: the
solver's *conclusion* as a stamped wire plan). Load semantics: valid iff
`engine_semver` equals the running engine's **and** `spec_hash` recomputes equal;
valid → skip the search, run the engine **once** on the cached plan, compute the
verdict fresh; a fresh outcome ≠ `expected.outcome` or hash ≠
`expected.result_hash` renders the divergence placard; invalid → drop the cache
and re-solve. Never silent (D8): `LineResult.cache ∈ hit | stale_engine |
stale_spec | absent`, and a dropped cache always produces that provenance record
plus a viewer placard. A cached plan is an *input*: a wire plan with no
trajectory and no apex field that must pass `validate` unchanged
(`P-EMERGENT-APEX` and `A-SOLVED-PLAN-VALIDATES` apply) — consumers still
recompute every drawn line, so D6 and D7 are intact.

Budget tests:

- `C-RECOMPUTE-BUDGET` — largest committed figure (the linked-chain fixture),
  **warm cache**: all-lines recompute ≤ 100 ms (× 3 CI machine-variance
  multiplier, TUNING). The D6 share-and-recompute tripwire, honestly scoped to
  the path shared figures actually take; if the engine ever grows past
  interactive recompute here, D6's share-and-recompute story needs a redesign,
  and this test is where that surfaces first.
- `C-COLDSOLVE-BUDGET` — same figure, cache dropped: full re-solve ≤ 10 s
  (TUNING) wall clock. A regression tripwire, not an interactivity promise; the
  viewer must show progress on this path (07's contract, referenced not
  respecified).
- `C-CACHE-HONEST` — for every committed figure, warm and cold paths produce
  tolerance-equal trajectories and **identical** outcome classes and check
  verdicts — the cache may change the time, never the answer. Runs on every
  re-bless.

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
   plausibility and doctrinal correctness. The rule is carried with one scoping
   clause: **the editing agent never trusts its own eyeball; the subagent's visual
   verdict — not the arithmetic — is the gate** *for done in the authoring
   workflow*; in CI, the deterministic `T-JUDGE-RECORD` check (§7.4) stands in
   for it.

Axis A remains largely true by construction — every line is engine-produced, so
the judge's attention goes to Axis B and legibility. One judging duty exists
under D2: in `diagram` mode, confirm the projection disclosure note is present and
the picture still *reads* physically sensible after compression — the projection
invariants (§5.1) prove ordering and containment, but only eyes can confirm the
compressed figure doesn't visually lie.

### 7.1 Judge identity

Committed `verify/judge.json`:
`{ judge_model, judge_model_version, rubric_version, temperature: 0, attempts: 3 }`.
A judge record produced under any other identity is invalid.

### 7.2 The operationalized rubric

A closed checklist; each item `pass | fail | na` + one line of evidence. The
judge receives the PNG *and* the figure's manifest (view spec, per-line verdict
classes, marks setting, occluder presence) — it confirms the picture against
declared facts, it never re-derives physics:

- `J1 colour-verdict` — every line's rendered colour matches its
  manifest-declared verdict class under the D9 mapping.
- `J2 markers` — hourglass turn-point / ring apex / dot exit present per the
  `marks` setting, each on its line, none floating.
- `J3 labels` — every callout anchored at its declared anchor; none floating,
  clipped, or swallowed.
- `J4 sight grammar` — when occluders are present: dashed rays from each line's
  eye to its limit point; occluded region shaded.
- `J5 mistake legibility` — each mistake-role line visually reads as the error
  it teaches (the one genuinely judgmental item).
- `J6 projection disclosure` — `diagram` mode only: disclosure note present; the
  compressed figure still reads physically sensible.
- `J7 no fabrication` — nothing drawn that the manifest doesn't declare.
- `J8 legibility floor` — lines distinguishable and text readable at the 2×
  raster.

Overall `verdict: "fail"` iff any item fails; `na` items never fail a figure.
One standing rubric sentence from the termination contract: *a failing line's
endpoint must sit at its termination — never wandering in the grass, never
exiting the frame uncropped.* `A-FIG81-ENDPOINT` pins it mechanically on the
fig-8.1 scene (clean + `premature` on the left-hand road): the red line's
arrowhead lies on the outer road edge, inside the frame.

### 7.3 The record schema

Committed as `figures/<figure_id>.judge.json`:

```
{ judge:  { judge_model, judge_model_version, rubric_version },
  figure: { path, spec_hash, result_hash },
  attempts: [ { attempt, items: [{ id, verdict: "pass"|"fail"|"na", evidence }] } ],
  items:   [ { id, verdict, flaky? } ],      // per-item majority over attempts
  verdict: "pass" | "fail" }
```

### 7.4 Flake policy and the deterministic CI gate

Three independent attempts; per-item verdict = 2-of-3 majority; any split item is
marked `flaky: true` and is a **rubric defect** to tighten (a checklist item that
flakes is under-operationalized). CI never invokes the judge: the deterministic
gate is `T-JUDGE-RECORD` — every committed/exported figure has a committed judge
record whose `spec_hash`/`result_hash` match the current figure and whose judge
identity matches `verify/judge.json`; missing or stale → exit 3 (the test/gate
tier). Judging runs in the authoring and re-bless workflows; its record is
committed like a golden (D36).

**Judge-version bump.** Editing `verify/judge.json` invalidates every record → a
**re-judge ceremony** mirroring §3.3's re-bless: one dedicated commit re-judging
all figures and enumerating every verdict flip; a pass→fail flip on an unchanged
figure is a finding (figure or rubric) resolved by human arbiter before the
commit lands.

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
- **Silent-failure coverage — the D8 effectuality harness (§8.1).** The prior
  design's cautionary tale: `position` plan actions validated and then silently
  did nothing. Under D8 that class is a standing, *decidable* test target — every
  schema-accepted input surface has a committed witness row proving an observable
  effect, or a typed rejection. An input with no witness row does not ship.
- **No coverage theater.** A test must either teach usage or trap a failure that
  would otherwise be silent. Tests written to move a coverage number are rejected
  in review.
- The test runner is the standard TS/ESM toolchain runner, exposed through the CLI
  with gate-friendly JSON output and the exit-code tiers owned by
  `08-cli-and-agent-interface.md` (0 all-green; the test/gate tier on any
  failure).

### 8.1 The D8 effectuality harness

The obligation "every schema-accepted input has an observable effect" is made
decidable by inverting the quantifier: not "effectual on all scenarios" but
"demonstrably effectual on a *named witness*", exhaustively over the closed field
enumeration.

Committed witness table `verify/effectuality.json`, one row per schema-accepted
field:

```
rows: [{ id,
         surface: "scenario"|"plan"|"road-dsl"|"occluders"|"hazards"|"mistakes"|"solve"|"scene"|"view"|"cli",
         field,                                  // schema path, e.g. "rider.plan[].over_m"
         fixture,                                // named witness fixture
         perturbation: { from, to } | "presence",
         effect_class: "trajectory"|"verdict"|"sight"|"render"|"envelope"|"analysis",
         expect: "effect" | "reject:<CODE>/<reason>" }]
```

Harness semantics: for `expect: "effect"`, run the witness fixture with and
without the perturbation and assert an observable difference per `effect_class`;
for `reject`, assert `validate` returns exactly the typed code + reason. The
per-class difference predicate `effectAt(class, before, after)` is defined once
beside the table, thresholds included: `trajectory` = an engine-output change
outside tolerance (hash or named field); `verdict` = a solved-plan or verdict
change; `sight` = a change in the recorded sight channel; `render` = a drawn
diff of the artifact; `envelope` = the value carried verbatim into the output
(`meta`, labels, `note`). The `render` and `envelope` classes make passthrough
and presentation *declared* observable effects with their own detectors — the
presentation fields (`marks`, `labels`, `legend`, `rays`, `view:` keys) sit in a
visible presentation-exempt category of the table, never a silent carve-out. A
surface that can support no row in any category is, by D8, not accepted input —
it gets rejected at validation instead. The table is the standing proof.

**`effect_class` gains one value with a detector, not a carve-out:** `analysis` —
*"the recomputable analysis document returned by the named pure API function
changes."* `effectAt("analysis", before, after)` = deep-inequality of that document
**minus its declared echo fields** (`reserve_checks`, `rubric`, `checks_version` —
the fields `P-STANDING-STAMPED` pins as *echoed from the loaded pack, never
re-derived*). Without that subtraction the detector fires on the pack echo passing
through — any recompute under a changed pack trips it regardless of whether the
*re-derived* content moved, masking whether the analysis itself is effectual — so
it is diffed over the re-derived body only. It is the effect class for all three out-of-hash analysis products —
`StandingReport`, `SaveWindow` and `CommitmentReport` — because all three are
recomputable documents outside the hashed record, and classifying them as
`envelope` would assert a movement in an object they are deliberately not part
of. The continuation fan keeps `render`. `T-D8-EXHAUSTIVE` then covers the new
fields like any other.

New witness rows: `--standing`; `--line`, `--corner` and `--scan-ds` on
`save-window`; the viewer's save-window overlay toggle; and the D45 rows listed
in §3.4a. One further witness row for the rubric annex: removing `"lean_ceiling"`
from a synthetic pack's annex changes the `StandingReport` of `F-STANDING-WARN`
from rung 3 to rung 4 — `effect_class: "analysis"`, with the observable named as
the `StandingReport` rather than the `Verdict`, because the annex is out-of-hash
by construction and must not be asserted to move one. Plus the typed rejection
rows of `01-scope-and-doctrine.md` §A.6.1.

**Exhaustiveness:** `T-D8-EXHAUSTIVE` — every field path the `schema` verb
prints appears in exactly one row of the witness table (schema-driven
enumeration: adding a schema field without a witness fails CI; a row naming a
surface the schema no longer has also fails). Together with the harness this is
the conformance mechanism D8 advertises: finite fixtures, closed field set,
decidable verdicts.

**Named witness rows with dedicated fixtures** (representative; the table is the
complete enumeration):

| Test | Fixture | Asserts |
|---|---|---|
| `T-POS-EFFECT` | `FX-POS-STRAIGHT` = `lane 3.5 \| S 120`, street, entry 34 km/h, `start.f = 0.2`, plan: one `position {f: 0.9, at_s: 10, over_m: "auto"}` | `position_start` and `position_complete` both present; `f` at completion `= 0.9 ± 0.02`; probe `absence`: deleting the action leaves final `f = 0.2 ± 0.02` and changes `result_hash` |
| `T-POS-INEFFECTUAL` | `FX-POS-SHORTWIN` = same, but `over_m: 6` explicit | `validate()` → `INEFFECTUAL`/`position_target_unreachable`; payload `required_over_m ≥ 33.5` and `achievable_dd_m < 1.89` |
| `T-POS-OVERLAP` | `FX-POS-OVERLAP` = `book90` + a `position` window intersecting the `turn_in` static commitment span | `INEFFECTUAL`/`position_overlaps_turn_in` (decidable via the static span) |
| `T-POS-SHORTFALL` | `FX-POS-POSTCOMMIT` = `book90` solved line + authored post-`release` `position {f: 0.1, over_m: 8}` on the 16 m exit straight | validates (post-commit leniency), runs, emits `position_shortfall` with `deficit_m > 0`; outcome class unchanged |

Further rows the table must carry (owning contracts named): `turn_in.hand` —
flipping an explicit `hand` on a two-corner fixture observably changes the
trajectory (different governing corner) or yields
`BAD_RANGE`/`no_governing_corner`, and a `turn_in` with no corner ahead is
rejected the same way, never silently neutral; `vis_hold_f` and `vis_margin` —
observably change the solved line under `vis=cautious` and are rejected
`INEFFECTUAL` under `vis=none`; every bound in the constraint vocabulary changes
the solved line on a reference scenario; `style=` and `corner=<id>..<id>`; every
solver refusal sub-reason reachable by a committed fixture (no dead error
names); the vehicle occluder, `hazards`, `use_full_width`/`bike_margin_m`, and
`startF` rows (their flag-level twins are `A-HAZARD-FLAG`/`A-FULLWIDTH`, §3.6).

---

## 9. Relation to the prior design

**Carried:** the three-legs principle; golden numerics with bless-never-hand-edit;
the byte-stability tripwire and its one-commit re-bless discipline; the mistake
oracle and its never-edit-the-expectation rule; the render-then-vision-judge loop
with mandatory subagent judging; tolerance-based cross-runtime determinism with
deadbands; tests-before-code and educational-test philosophy
(`extract/07-tooling-and-verification.md` §§1, 5, 6, 8;
`extract/08-design-decisions-and-rationale.md`, verification and process
decisions).

**Changed:** the raster gate shrinks from product gate to static-export gate and
moves from cairosvg to a headless browser; result hashing decouples from figures
(no committed teaching artifact depends on engine bytes, dissolving the prior
"Do NOT fix casually" coupling); physics changes become first-class migrations
with a defined procedure; the first bless is anchored outside the engine by the
analytic-acceptance layer instead of grading its own homework (D35); the vision
judge becomes a pinned-identity workflow gated in CI by committed records (D36);
the mistake oracle gains fixture-pinned outcomes single-sourced from 03 §7.1 and
the D6 share-and-recompute round-trip.

**Dropped:** the no-`package.json` gate, the hand-synced load-order invariant, and
the scene→chapter stamp idempotence gate — each died with the architectural
decision (D1, D5) that made it meaningful. Their replacement disciplines: lockfile
plus pinned runtime; the ESM import graph; export determinism (§3.1).

**New:** projection invariant properties and the proportion gate — the mechanism
that makes the stretched-paths defect class detectable, which the prior regime
never could; annotation and ink verification (§5.4); interactive-surface and
result-contract tests including `C-HUD-EQUALS-STATEAT`, `C-POV-TRUE-GEOMETRY`,
and `C-ONE-CORE`; the witness-table effectuality harness that makes
"schema-valid implies effectual" mechanically decidable rather than
aspirational (§8.1); the solver-intent and visibility tests (§3.5) with explicit
quantifiers; CLI and cold-start acceptance (§3.6); and the phase gates (§10).
Added by the D42–D45 amendment: the counterfactual property block (§3.4) and its
disclosure tests; the standing-ladder suite and `F-STANDING-WARN` (§4); the
save-window suite and the `tau_close_s` tolerance row (§3.2); §3.4a and the
`S-CONT-SEPARATION-v2` spike; the `analysis` effect class (§8.1);
`A-PACK-PROVENANCE`.

**Struck at ratification (tombstoned, never shipped):** `out_available` and its
out probe — identically `true` on its whole domain, at one engine run per corner;
`sight_ok` — a strictly weaker restatement of check 10 at the same coefficient;
`SIGHT_MARGIN_ROB = 1.0`; `commit_within_sight` and every refutation-only check.
Each is tombstoned `UNKNOWN_ID/struck_by_decision` and asserted as such by
`A-STANDING-TOMBSTONE`; none is a deferred design, so none appears in §10's
promotion gates.

---

## 10. Phase gates

Build phasing is owned by `00-README.md` (D37); this section owns the per-phase
exit-gate lists — each named test is defined in an earlier section of this
document, and this section adds only the grouping and one rule: **a phase is
exited by one green run of its full gate list on CI, recorded in the phase-exit
commit message.** Goals are delivered by phase; a goal's test runs from the phase
that delivers it, and unshipped vocabulary rejects `SCHEMA` with a `deferred`
member until its phase arrives (the phase-gating law).

| Phase | Exit gates |
|---|---|
| **v0.1 — the figure spine** | Analytic-acceptance layer green, then first bless (§3.2a); golden numerics (§3.2); the mistake oracle (§4); `P-DETERMINISM` / `P-EXPORT-DETERMINISM`; all six book-figure scenes bake, pass the proportion gate in `diagram` mode (`A-ESSES-GATE`), land near the bands in `true` mode, and carry green judge records (`T-JUDGE-RECORD`); recipes (a), (b), (e), (f) as acceptance tests (`A-RECIPE-A/B/E/F`); the D8 effectuality suite over the v0.1 schema (§8.1); the D42 counterfactual layer: `P-CF-PRECONDITION`, `P-CF-LITERALISED`, `P-COUNTERFACTUAL-CLOSED`, `P-COUNTERFACTUAL-NAMED`, `P-CORR-CONSTANT-SPEED`, `A-CORR-EXPLAIN` (extended), `A-CF-REGISTRY-CLOSED`, `A-CF-DEAD-REASON`, `A-PACK-PROVENANCE`, `G-CORR-RIDER`, `G-CF-PRECONDITION-TABLE`; and `C-SAVEWIN-NO-INK` as a regression sentinel against the six baked book figures, where it passes trivially because the `save-window` verb does not yet exist. |
| **v0.2 — inspection** | `C-STATEAT-LAWS`; `C-HUD-EQUALS-STATEAT`; `C-BOOKMARKS`; `C-ONE-CORE`; `C-RECOMPUTE-BUDGET` (as scoped in §6.1); recipe (c) end to end including `serve` (`A-RECIPE-C`); `G-STANDING-BITES`; `G-STANDING-NO-HASH-MOVE`; `A-STANDING-WARN-BAND`; `A-STANDING-RESERVED`; `A-STANDING-LADDER-CUMULATIVE`; `A-STANDING-REFUSAL`; `A-RESERVE-CHECKS-RESOLVE`; `A-LADDER-PROSE`; `A-STANDING-TOMBSTONE`; `C-SAVEWIN-HUD`; `C-SAVEWIN-CLIP`; `C-SAVEWIN-NO-INK`; `C-SAVEWIN-REFUSE-COARSE`; `C-SAVEWIN-BUDGET`; `G-SAVEWIN-GRID`; `A-SAVEWIN-PLACARD`; `A-SAVEWIN-VERB`. |
| **v0.3 — immersion** | `C-POV-LIMIT-CONSISTENT`; `C-POV-TRUE-GEOMETRY`; `C-COMPARE`; per-view boot smoke tests (§6). |
| **deferred, design kept** | Each deferred design carries its own gates, pre-written below and run at promotion; the diagram projection's gates (§5) run when its implementation lands. The continuation envelope (D45) is gated on `S-CONT-SEPARATION-v2` (§3.4a); its full gate list is §3.4a and runs at promotion, in two tranches: `A-AN-TRUNCATE`, `A-AN-MEMBER-KAPPA`, `A-AN-SWEEP-BUDGET`, `P-CONT-*`, `P-COMMIT-*`, `P-ESCAPE-HONEST`, `A-CONT-PACK-DATA-ONLY`, `A-COMMIT-VERB`, `G-TRUNCATE`, `G-COMMIT-*`, `C-COMMIT-BUDGET`, `C-COMMIT-BAKE-BUDGET`, `C-COMMIT-NO-CHECK` at report-only promotion; `A-COMMIT-PROSE`, `J9`, `A-FAN-NO-ENGINE`, `A-RECIPE-K`, `T-COLDSTART` at render promotion. |

D42 is a v0.1 gate because its sole reachable rider ships in v0.1: the corrective
shot is v0.1 machinery, so the registry, the precondition and the disclosure
obligation must be green before the first bless. D44 and D45 inherit the layer;
neither re-litigates it.

**Gates defined in this section** (D43 and D44; the tests they group are defined
in §§3.2–3.6 and §4):

- **`G-STANDING-BITES`** — the ship condition for D43. Every rung of `standing`
  is attained by at least one committed fixture, and specifically there exists a
  committed fixture with `clean(line) = true ∧ standing = "clean"` (rung 3, not
  reserved). Declared witness map, asserted as a set-equality over the corpus,
  not a spot check:

  | rung | witness |
  |---|---|
  | 4 `reserved` | `F-ORACLE-90` good line (`A-STANDING-RESERVED`) |
  | 3 `clean` | `F-STANDING-WARN` (`A-STANDING-WARN-BAND`) |
  | 2 `caution` | `F-ORACLE-90` + `premature_contained` (contained, `late_apex` fails) |
  | 1 `failing` | `F-ORACLE-90` + `premature` (`runoff`, not `crash`) |
  | 0 `crash` | the `lean_ceiling`-fail fixture required by `A-CATALOGUE-EXERCISED` and cited by `A-DANGER-DWELL` |

  A rung with no witness is dead doctrine — `A-CATALOGUE-EXERCISED`'s discipline
  at the ladder level.
- **`G-STANDING-NO-HASH-MOVE`** — adding `annex.reserve_checks` to
  `parks-street/2` moves no `result_hash` and no `spec_hash`; the six Chapter-8
  book figures and every committed book scene bake **byte-identical** before and
  after. G7, asserted rather than assumed.
- **`C-SAVEWIN-HUD`** — every displayed save-window field equals the returned
  object, precision-clamped to `HORIZON_DISPLAY_DP` (`C-HUD-EQUALS-STATEAT`
  extended to the overlay).
- **`C-SAVEWIN-CLIP`** — the drawn probe's last vertex is `s*` (or its
  termination station) in both the `07-viewer-animation-and-pov.md` §3.6 overlay
  and the §3.5 corrective ghost. **The `04-solver-and-authoring.md` §4b.4 guard,
  mechanical.**
- **`C-SAVEWIN-NO-INK`** — the exported SVG is byte-identical with the
  save-window toggle on and off, on every one of the six committed book scenes.
  **The D9 / D18 / G7 guard, mechanical.** Runs in the v0.1 leg as a sentinel and
  in the v0.2 leg as a gate.
- **`C-SAVEWIN-BUDGET`** — ≤ 400 ms per corner on the largest committed figure, ×
  the standard 3× CI-variance multiplier; `runs` is asserted against the
  `⌈domain_len / scan_ds⌉ + 5 + ≤ 8` bound so the budget claim is auditable, not
  merely timed.
- **`C-SAVEWIN-REFUSE-COARSE`** — `--scan-ds 2.0` on `F-ORACLE-90` exits with
  `SCHEMA/scan_ds_too_coarse` and a populated
  `{scan_ds_m, v_max_ms, step_s, bound_s}`, and produces no `SaveWindow`.

**Pre-written promotion gates** (defined here, run only when their deferred
design is promoted):

- `P-JITTER-DETERMINISM` — same seed/N/spreads → identical `EnsembleResult`
  hash.
- `P-JITTER-PURITY` — the import-graph lint extended: no RNG import beneath
  `cli/`/`viewer/`; every jittered scenario is a complete, shareable input and
  the ensemble is N ordinary deterministic runs.
- `A-JITTER-LATE-APEX` — on the canonical corner, the solved late-apex line's
  `survival` ≥ that of a contained early-turn-in line under identical jitter:
  the book's probabilistic late-apex argument, mechanically pinned.
- `A-FIT-ROUNDTRIP` — a synthetic oracle: take a known compiled mistake's own
  trajectory, downsample and perturb with seeded test-layer noise, feed to
  `fit`; the fitted plan recovers the perturbation within tolerance (a
  `premature` trace reports turn-in ≈ 6 m early).
- `A-FIT-REFUSE` — a trace outside the vocabulary (a U-turn) → `NO_FIT`, never a
  forced bad fit.
- `P-FIT-LINE-PROVENANCE` — the rendered line's samples are byte-identical to
  running the fitted plan as an ordinary scenario (evidence is displayed as
  evidence; only engine output is ever displayed as a line).
