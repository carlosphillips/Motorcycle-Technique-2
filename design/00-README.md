# linelab — Design of Record (v1) — Reading Guide & Project Map

This is the index for the design-document set of **linelab** (working name), the
successor to the "Motorcycle Cornering" project whose design record is preserved in
`extract/`. The prior project's code is **not** in this repository; these documents
define a fresh implementation that carries forward what that design got right and
deliberately reverses what it got wrong for the new goals.

> **What these documents are — and are not.** Like the `extract/` set they replace,
> these capture **design intent, physics, contracts, and workflows** — equations,
> named constants (`name = value + units`), grammars, schemas, and API signatures.
> No source-code dumps. Behaviour is described in prose; the implementation is
> judged against these documents, and these documents are judged against the book.

---

## 1. What linelab is

One artifact, not two: an **interactive, physics-grounded riding-line laboratory**
for road-speed cornering. An author — human or AI agent — describes a road and one
or more *line intents* in a few lines of text. linelab simulates each line with real
physics, judges it against line-selection doctrine, and presents the result as:

1. **Book-style top-down diagrams** — compact, annotated figures visually equivalent
   to the line diagrams in Lee Parks' *Total Control* (Chapter 8 especially), drawn
   through a disclosed diagram projection.
2. **A steppable animation** — a timeline the user scrubs, with every physical and
   control quantity (speed, lean, curvature, grip usage, commanded vs. delivered
   brake/throttle, sight distance vs. stopping distance) inspectable at any point on
   any line, good or failed.
3. **A rider's-POV pseudo-simulation** — a first-person view from the rider's actual
   position: the road ahead, the horizon tilting with lean, the limit point, and the
   road visibly disappearing behind occluders on blind corners.

The unifying principles carried from the prior project: **the book is doctrine**
(`book_text/`, `book_images/` are the committed extraction; the book wins disputes),
and **the line is emergent** — the rider commits only inputs; apex, exit, and
run-wide behaviour come out of the physics, never out of the author's pen.

---

## 2. Decision log (normative)

D1–D10 were made 2026-07-18 after a six-lens adversarially-verified review of the
prior design plus a user interview. D11–D41 were added 2026-07-19 after a second
six-lens adversarial review — this time of the present set, simulated as fully
implemented — closing the gap between named intentions and buildable mechanisms. D42–D45 were added
2026-07-19 after three ratification-stage proposals (the counterfactual layer, the standing
ladder, the save window, the continuation envelope) were adversarially pressure-tested and
repaired; each lands out of hash, off by default, and absent from every committed book scene.
Sibling documents must conform to all of them.

- **D1 — Interactive-first architecture.** The primary product is an interactive
  viewer (scrubber, HUD, POV) built as modern TypeScript/ESM; the physics core is a
  pure, dependency-free library that runs identically in CLI and browser; static SVG
  figures are an *export target*, not the product. *Supersedes* the prior no-build /
  `file://` / classic-script / static-artifact doctrine, which made animation and
  POV structurally impossible. *Build order is governed by the phasing section
  below (§3): D1 names the architecture and the destination, not the sequence — the
  viewer is the product linelab becomes, and the figure spine is how it gets there.*

- **D2 — Diagram projection layer.** Simulation always runs on true geometry. The
  top-down *diagram* view renders through a disclosed, topology-preserving
  projection (straights compressed hard, drawn road width raised into the book's
  measured proportion band, frame cropped to the corner window). Physics readouts,
  the animation HUD, and the POV always use true geometry. A mechanical
  **proportion gate** verifies book-likeness. *Supersedes* the lateral-only `exag`
  knob — the confirmed root cause of the prior tool's stretched-out figures was an
  ~8–10× width:radius proportion gap plus roads that were ~60 % braking straight,
  neither of which lateral exaggeration can fix.

- **D3 — Physics tier = Tier 1R (point-mass + run-wide slice).** The prior Tier-1
  model (planar point-mass, lean-driven curvature, friction ellipse, rate-limited
  roll) plus exactly one addition: a longitudinal load-transfer / stand-up effect so
  that braking-at-lean and throttle-chop **widen** the line as the book teaches,
  instead of pinching it inward. No low-speed kinematic steering (the sub-25 km/h
  U-turn regime is out of scope), no handlebar/countersteer channel (line-selection
  doctrine teaches lean, brake, throttle — a derived steering display would be
  fake, and modelling it for real is Tier-3 scope).

- **D4 — Visibility is first-class, lateral-only.** Blind corners are modelled with
  vision-blocking lateral occluders (hedge, wall, bank, vehicle) on a flat world —
  no crests, no vertical geometry (refused with an honest placard). The sight ray is
  cast from the **rider's actual position**, not the road centreline, so "hold wide
  to open the sight line" is visible and measurable. Sight distance, stopping
  distance, and the limit point are recorded per sample, and `position` plan
  actions are effectual, so an agent can author lines that differ in visibility and
  compare them.

- **D5 — Scope: road-speed line selection only.** Single corners (ideal line + the
  canonical mistakes), special-case corners (decreasing/increasing radius, double
  apex, linked sequences, road-speed hairpins), and blind corners. Out of scope:
  the low-speed/U-turn regime, rider body-position teaching, vertical physics,
  tire-slip/suspension dynamics (Tier 3), and the prior project's HTML course.

- **D6 — Failed lines are first-class objects.** Mistake lines are shareable,
  loadable, and per-instant inspectable exactly like good lines. This deliberately
  reverses the prior "mistake overlays are figure-only and never shared" rule. The
  underlying honesty property is preserved differently: what is shared is the
  *scenario + mistake spec*, and every consumer **recomputes** the trajectory with
  the same engine — the system still never ships a trajectory the engine didn't
  produce.

- **D7 — The emergent-line invariant (carried).** There is no `apex` field anywhere
  in any input schema; plans are id-addressed action lists (brake, turn_in,
  throttle, position); apex/exit/run-wide are measured outputs. Structural, not
  conventional.

- **D8 — Schema-valid implies effectual (new).** Every accepted input does
  something; anything unsupported is rejected at validation with a typed reason.
  The prior design accepted `position` actions and silently ignored them — that
  class of behaviour is forbidden.

- **D9 — Colour law v2.** Colour still means doctrinal line quality (green = good,
  amber = middling/contained, red = failing), but it derives from **each line's own
  emergent verdict**, decoupled from the line's authored *role*. Figures may carry
  any number of lines; roles are labels, colours are verdicts. This fixes the prior
  single-amber-slot cap and the "contained linked good line renders red" defect
  while keeping colour a hard doctrinal signal.

- **D10 — Authorable solver intent.** Added after an agent-usability review of
  this set. The solvers accept authored *intent*, never authored *paths*:
  (a) the visibility-governed mode's governing quantities — the hold-wide lane
  fraction `vis_hold_f` and the sight-margin factor `vis_margin` — are
  authorable schema fields with `TUNING` defaults, not internal constants;
  (b) the visibility-governed mode composes with chained-corner solving, so a
  multi-corner blind sequence solves cautiously end to end; (c) solve specs
  accept declarative **constraints** — bounds on emergent quantities (`f_min`,
  `f_max`, `v_max_kmh`, `sight_margin_min_m`) over station spans — that narrow
  which emergent lines the solver may accept, with an unsatisfiable bound
  refused as a typed `NO_SOLUTION`. Constraints are acceptance bounds, not
  waypoints: D7 is untouched — the engine still decides where the line goes;
  constraints only say where it may not. Specified in
  `04-solver-and-authoring.md`.

- **D11 — One outcome law: physics decides outcome; the rubric decides doctrine;
  quality composes them.** `outcome` is the physics-only closed set
  `crash > runoff > wide > stopped > contained` (never reads a check;
  `P-OUTCOME-RUBRIC-FREE`). `clean` is a derived predicate (`contained ∧ zero
  applicable check fails`); `violation` is retired as an outcome (the `violation`
  *event* survives as the constraint-breach bookmark); `dnf-spec-error` is deleted
  (refusals are `LineRefusal` entries; runtime spec errors are exit-4 `INTERNAL`).
  `quality ∈ good | caution | failing` is the single total colour function (amber
  word `caution` — the outcome word `contained` may not double as a quality word).
  *Supersedes* 02 §7's "clean = all checks pass" and 06 §5.1's vacuous branch.

- **D12 — The doctrine rubric is a declared data pack; the book wins as the shipped
  default.** Check bindings (ids, thresholds, bands, severity ∈
  advisory|standard|critical, applicability) are data in `parks-street/2`; metrics
  are code versioned by the independent `checks_version`; every verdict carries
  `rubric`. The catalogue (16 checks incl. `wrong_strategy_for_corner`, the sole v2
  critical) is owned by 01 Appendix A; 05 owns only the record shape. Future
  doctrine disputes become packs, not forks.

- **D13 — The steering channel is one four-state machine; commitments end by heading
  capture; direction is a per-corner binding.** `steer_state ∈ track | commit |
  unwind | position`; release ⇔ remaining heading-to-exit ≤
  `(G/(v_eff·roll_rate))·ln(sec|phi|)`; unwind at the profile rate; `turn_in.hand ∈
  L|R` binds to the next matching corner or refuses
  `BAD_RANGE/no_governing_corner`; lean magnitudes stay unsigned (`handSign` the
  single conversion point). Exits become derivable, not asserted. Specified in
  02 §3.1.

- **D14 — Run-wide slice v2: demand-driven stand-up, a_widen threshold, slewed
  commands.** `S_sustained` keys on grip-capped braking demand `b_dem`;
  `a_widen(phi, v; c)` decouples from `a_noreturn` (kept as teaching, disclosed
  bands); longitudinal commands are slew-limited (`slew_mss`, default 6 m/s³),
  making the chop transient a graded dt-invariant impulse (`K_CHOP` = 0.12 rad per
  m/s²) and mid-corner squeezes expressible.

- **D15 — Lean-aware stopping model, one function.** `ssd(v, phi, model, profile,
  mu) → {ssd_m, react_m, standup_m, brake_m}`: stand-up phase at the profile roll
  rate with decel capped at `min(a_ssd, aLongAvail, a_noreturn)`, then upright
  `a_ssd`; reduces to the carried formula upright. One definition for the sample
  channel, `stop_within_sight`, and the V1 governor.

- **D16 — Safety compares in rider-path metres.** The recorded `sight_ride_m`
  (exact trajectory lookahead) is the sole basis for every sight-vs-stopping
  judgment; `sight_m` keeps centreline/lane-centre station basis for cross-line
  comparability and rendering. Removes a ~15% systematic error.

- **D17 — The model-validity band is split from the numeric floor.** `v_floor_ms =
  2` terminates; `v_valid_min_ms = 7.0` (derived from the widening algebra) flags:
  per-sample `below_validity`, verdict `validity` dwell, and the chain-link
  `link_flip_infeasible` floor all cite the one constant.

- **D18 — The corrective shot is a fixed-policy branched shadow.** wide-vs-runoff is
  decided by one deterministic shadow re-integration (react, roll to `phiReserve`,
  `a_cmd = 0`) — never a search, never inside the main integration; the drawn line
  is always the plan's own consequence; the save ships as a stepper-only ghost and
  fig 8.5's ink departure is a disclosed parity note.

- **D19 — The world ends at the road edge.** Lateral departure is a terminal
  `off_road` event with bracketed crossing coordinates; `terminated.reason` is the
  closed six-value set; off-road physics is refused (muAt clamps laterally only to
  keep the crossing step well-defined); `stopped` joins the outcome classes.

- **D20 — The lateral tracker channel.** `position` actions, default lane-keeping,
  V2 holds, and the post-unwind hold share one bounded critically-damped tracker
  writing `target_lean` (authority `PHI_TRACK_AUTH_DEG = 5°` — the D7 guard);
  `turn_in` suspends it; one reachability formula is `over_m="auto"` resolver,
  validation predicate, and V2 clipping rule; the unreachable `over_m = 15` default
  is retired.

- **D21 — Corner-relative solver stations; super-tight refusal measures U-turn
  sweep content.** Station constants become fractions of `L_app/L_arc/L_exit` with
  a typed `road_too_short` refusal; corner-type detection drives per-type
  `target_apex_pct`; refuse `OUT_OF_SCOPE` iff ≥170° of sweep accumulates at
  r ≤ 15 m (decidable on tapers; the fig 8.4 teardrop becomes authorable).

- **D22 — The visibility mode is a bounded heuristic verified by self-check.** The
  monotone-convergence claim is withdrawn; acceptance is decided solely by the
  terminal self-check (`P-VIS-SELFCHECK`), bounded by `vis_max_iterations`, with two
  typed refusal sub-reasons.

- **D23 — Misjudgment is first-class: believed-road solving.** A line may declare a
  believed road — solve on it, literalize the plan, execute on the actual road —
  with `underread`/`overread` sugar, shared-prefix validation, and full provenance;
  D7 intact; the one-perturbation rule reads: exactly one control-channel delta
  (engine-probed interior values) OR one belief, never both.

- **D24 — Solvers return their best failing line on request.** `accept = clean |
  best_failing`; deterministic five-key ranking; authored D10 constraints stay
  hard; `verdict.acceptance {policy, met}` is always present and in-hash; grading
  and colour are policy-independent.

- **D25 — Mistake kinds speak the book's words.** `premature` = the canonical
  runs-wide error (was `early_apex`); `premature_contained` = the eased variant;
  `early_apex` gets an `UNKNOWN_ID/renamed_kind` tombstone; `fifty_pence` gains
  `early_by_m`; the enum closes as the shared-vocabulary list (§5) spells it.

- **D26 — Handedness is physical, not presentational.** Presets take `hand=L|R`
  and default to the book figure's ink hand (book90 becomes a left-hander); the
  mirror is a road-level transform through hand-relative vocabulary; ViewSpec
  rotates but never reflects; G7 parity stays strict. `hand` spells `L|R`;
  `left|right` is exclusively rider-relative.

- **D27 — On-road vehicles are first-class sight objects; chain links carry a flip
  budget.** `vehicle` places via exactly one of `lane=own|oncoming ⊕ f ⊕ side`,
  acts as occluder AND recorded sight target (`hazard_visible`); motion refused.
  Chain links are sized by `d_flip(v) = v·(phi_n + phi_{n+1})/roll_rate`; zero-gap
  chains stay legal, resolved by slowing, floor-refused `link_flip_infeasible`.

- **D28 — Annotations are event-sourced; dash is annotation ink; the legend is the
  role channel.** Markers are glyphs of events; label anchors are one closed
  feature grammar resolved against the same events with typed errors; trajectories
  draw solid with arrowheads; sight rays are the only dashed ink; the legend prints
  `role · quality (outcome)` and defaults auto-on. *Supersedes* 06 §5.2's role-dash
  law.

- **D29 — The envelope records the resolved scenario; the hash covers the plan.**
  Every `LineResult` carries `resolved_scenario` (output provenance, excluded from
  spec_hash); `result_hash = fnv1a(verdict′ + resolved plan)` with exclusions
  `{result_hash, diagnosis, cache, skew}`; Sample appends alone never move hashes;
  all hash-moving changes land in ONE re-bless commit (09 §3.3).

- **D30 — FigureSpec JSON is the canonical figure spelling; scene text is sugar.**
  The `figure` verb accepts either; `lowerScene` is a pure total lowering;
  `spec_hash` is computed on the lowered form so spelling never changes identity.

- **D31 — Share URLs carry an engine stamp and per-line expectations; caches are
  stamped conclusions.** Figure-level `engine_semver`; per-line `expected {outcome,
  result_hash}` (exporter stamp) beside authored `expect` (gate declaration); story
  divergence renders a first-class placard, never blocks; `solved {spec_hash, plan}`
  makes shared figures load in one engine run, with the stamps as the mandatory
  safety net; re-bless bumps minor and re-stamps fixtures.

- **D32 — One mistake token, one anchor grammar.** `[lineId=]kind[:k=v,...][@scope]`
  across verb/flag/scene; anchors `entry|exit|mid:<id>` with `s:<m>` absolute and
  offsets outside the anchor; deprecated spellings are rejected with typed rewrite
  hints per D8.

- **D33 — Expectation-based gating; five exit tiers.** `E(line)` from explicit
  declarations, pin-table rows, acceptance policy, or the solve bar; deviation in
  either direction exits 3; tier 4 = INTERNAL; roles never gate (D9);
  figure/scene bakes are declaration-gated by default; no chain-specific tier.

- **D34 — Root-qualified sweep.** `sweep` addresses the whole composed input
  through the closed root set (incl. `believe.`) with per-root hold-fixed
  semantics and a closed metric vocabulary; `sweep_max_cells = 2500`.

- **D35 — Analytic-first bless.** Every bless is mechanically gated on the
  closed-form analytic-acceptance layer (the one place hand-computed expectations
  are legal); blessed values are written back into 02 §8.1 by the bless script;
  CI enforces doc-sync.

- **D36 — Nondeterministic judges commit records; CI checks records.** Vision-judge
  and cold-start verdicts run in workflow under pinned model identities with N-of-M
  flake policy; CI gates deterministically on committed record presence and hash
  match.

- **D37 — Phased delivery: the figure spine ships first.** v0.1 spine → v0.2
  inspection → v0.3 immersion; projection deferred; the printed schema is the
  phase; unshipped tokens reject `SCHEMA` with `deferred`. D1 is amended
  (architecture and destination, not sequence); `C-ONE-CORE` enforces D1's
  substance from phase one. The build-phasing section (§3) is normative.

- **D38 — Randomness stays out of the core.** Variability ships as ensembles of
  deterministic runs (v2 `--jitter`): a seeded CLI-layer RNG generates N complete
  shareable scenarios; the band derives from engine-integrated lines only; the
  doctrine acknowledgment lands in 01 now.

- **D39 — Evidence input is admissible; command input stays forbidden (contingent,
  at fit promotion).** D7 restated over worlds / commands / evidence:
  `fit(trace) → {plan, residual}` accepts traces as evidence never drawn as lines;
  every drawn line remains engine-integrated.

- **D40 — The limit point never leaves the POV frame; gaze is a placarded scope
  cut.** Unconditional marker via clamp-with-arrow; `look: heading | limit_point`
  presentation-only toggle (default heading); rider-gaze behaviour joins 01 §8's
  refused list with a typed na placard.

- **D41 — Phase vocabulary v2.** `stateAt.derived.phase` and the controls-strip
  bands share one closed five-token machine (`approach | turning | midcorner |
  exiting | done`) defined by the 05 §4.1 opener-event table; tokens disjoint from
  station anchors, event kinds, and the book's prose (which keeps entry/mid/exit as
  captions and anchors).

- **D42 — Counterfactuals are a closed registry of two named riders, launched under a stated
  precondition, on a literalised plan.** Every counterfactual in linelab is one call of one
  signature — `counterfactual(world, x0, latency, rider, predicate) → Result<{trajectory,
  verdict}>` — and both the `rider` and the `predicate` arguments come from **closed sets declared
  in the design of record** (`04-solver-and-authoring.md` §4c):
  `CounterfactualRider = lean_only_reserve | brake_reserve_escape` and
  `CfPredicate = return_after_detect | horizon_bounded_return | reserve_bounded_run`. Every other
  what-if entry point — `correctiveShot`'s shadow, `saveAt`, `E_c` — is a **named thin wrapper**
  that declares its `(rider, predicate)` binding at its own definition site; there is no second
  harness. A doctrine or continuation pack may *reference* a rider id and may carry declared
  **scalar bounds**; a pack may never carry a target-lean expression, a roll rate, a
  commanded-acceleration law, a predicate, or any other expression — the D12 data-not-arithmetic
  line drawn at *expression versus scalar*, because a controller is arithmetic in its purest form.
  The `lean_only_reserve` rider carries a **precondition that was previously unstated and is now
  normative** (`P-CF-PRECONDITION`), because at street skill on `mu = 1.0` its held radius
  `R_res(v) = v²/8.3385` is 20–35 % *tighter* than every book preset's road at solved turn-in
  speed, so from inside the corridor "roll to `phiReserve` and hold" is not a save but a
  self-inflicted inside departure. The precondition is discharged **through the predicate, not
  through the domain**: under `return_after_detect` the launch state must satisfy
  `OUTSIDE_DRIFTING_OUT` or the call refuses; under `horizon_bounded_return` there is no
  launch-state condition and the consumer must instead grade against a station horizon taken from
  the **main line** at or beyond `s_detect`, which is what makes an in-corridor launch that closes
  on the inside edge score `false`. Every counterfactual resolves its plan through
  `LineResult.resolved_scenario` (`05-…md` §7) **before** integration — id-addressed,
  corner-relative plan actions are undefined on a counterfactual world, so the literalised plan is
  the only legal input (the *literalise-first* rule). Every surface that emits an escape verdict,
  an out verdict, or a save-window scalar carries a machine-readable `rider` id **on out-of-hash
  surfaces only** and names that rider in prose; the in-hash `corrective` block gains no field, so
  no baked hash moves (D29, G7). Folded into the same edit: `04-…md` §4a.5's `shadow_stopped`
  fail_reason is **deleted** as a dead error name — with `a_cmd = 0` and no drag in `02-…md`, `v`
  is exactly constant across the shadow, so `v_floor_ms` can never fire, and `09-…md` §8 forbids
  dead error names — and every pack `source` string is put under a mechanical provenance test so no
  `TUNING` value can ever be dressed as a book citation. *Supersedes* nothing; it states three laws
  the set was relying on without asserting, and retires one unreachable error name.

- **D43 — The standing ladder: a five-rung total order, cumulative, rubric-consuming, out of
  hash.** `standing(lineResult)` is a total function into the closed ordered set
  `reserved:4 > clean:3 > caution:2 > failing:1 > crash:0`, defined by **monotone cumulative
  thresholds** — `≥ 1 ⇔ outcome ≠ crash`; `≥ 2 ⇔ quality ≠ failing`; `≥ 3 ⇔ clean(line)`
  (`05-result-contract-and-inspection.md` §6.1 verbatim); `= 4 ⇔ clean(line)` ∧ every check named
  in the rubric pack's declared `reserve_checks` annex returns verdict `pass` on every applicable
  instance — and `standing` is the greatest rung whose threshold holds. `reserve_checks` is
  **declared pack data, never arithmetic** (D12): `parks-street/2` declares
  `["lean_ceiling", "stop_within_sight"]`, so `reserved` means *contained, no failed check, you did
  not eat your lean reserve, and you never came within `SIGHT_WARN_M` of outrunning your sight
  line*. The top rung costs **zero engine runs** and introduces **zero TUNING constants**: it is a
  lookup over verdicts the rubric already computes. An `na` or ungraded member makes `reserved`
  unattainable — the ladder never asserts a judgment the rubric refused. The rung tokens name **the
  highest rung attained**, not the extension of the namesake predicate; a line at rung 3 and a line
  at rung 4 both satisfy `clean(line)`, and every printing surface carries that gloss. The ladder
  is out-of-hash, off by default, and absent from every committed book scene; it enters no
  `Verdict`, no `Sample`, no `result_hash`, no `spec_hash`, and no `--gate` exit code, exactly as
  `correctiveShot`'s shadow does not. Because `standing` reads pack verdicts it is a function of
  `checks_version` and `rubric`: every emission carries both, and a `checks_version` bump
  re-blesses every `standing` golden (priced in `09` §3.3, not discovered later). *Supersedes* the
  ratification-stage brief form of the ladder: the five biconditionals are replaced by cumulative
  thresholds (under biconditionals the token `clean` did not name `clean(line)`, and `standing` was
  not a function); the `out_available` out probe is **struck** — on its entire evaluation domain
  `clean ⇒ contained ⇒ f ≤ F_DETECT + eps_f_detect = 1.01 < 1.03 = F_SAVE + eps_f_save`, so the
  predicate was satisfied at the probe's first retained sample and returned `true` identically, at
  one engine run per corner; and `sight_ok`/`SIGHT_MARGIN_ROB = 1.0` are **struck** as a strictly
  weaker restatement of shipped check 10 at the same coefficient over a subset of samples
  (`clean ⇒ check 10 ≠ fail ⇒ sight_ok`, so the conjunct was dead, and where check 10 returned `na`
  under the vertical-blindness placard it laundered a refusal into the top rung). All three struck
  names are tombstoned `UNKNOWN_ID/struck_by_decision`, never deleted silently.

- **D44 — The corrective shot's start instant is a parameter; the search over it is
  horizon-bounded, freeze-clamped, and lives outside the classification path.** D18's "never a
  search" is hereby scoped: the wide-vs-runoff classification remains **one fixed-policy shadow at
  `t_shot`, unsearched, in-hash, byte-stable**; separately the same `04 §4a.4` policy may be re-run
  from other start instants by the pure, out-of-hash analysis function `saveWindow`, whose output
  enters no verdict, no hash, no check, no exported figure, and no committed book scene. The
  success predicate is **not** `04 §4a.5` lifted to an arbitrary start instant — that predicate is
  vacuously true for every `τ < t_detect`, and its peak-guarded repair is worse, because `f` is
  outward-signed and an inside departure therefore scores as a save. `saveWindow` instead
  integrates to a **station horizon carried from the main line**: the first bracketed
  `s* ≥ max(s_detect, s(τ))` at which the shadow is back inside the corridor, with any
  `off_road | crash | stopped` at or before `s*` scoring failure. That horizon is also what
  discharges D42's `P-CF-PRECONDITION` for this consumer — `saveAt` binds the predicate
  `horizon_bounded_return`, so an in-corridor launch is admitted to the domain and refused a save
  by the horizon rather than by the harness. The anchor identity
  `saved(t_shot) ≡ corrective.feasible` then holds **by construction**, not by assertion. The scan
  domain is clamped to `τ ≥ t_freeze_end` (a reserve-lean roll inside a freeze is a command `02 §3`
  forbids), the reaction budget is measured against `t_earliest = max(t_detect, t_freeze_end)` —
  the exact quantity `04 §4a.3` already computes — and the D11 consistency argument is restated
  over `t_earliest`, since the original inference was invalid whenever `t_freeze_end > t_detect`.
  Scan resolution is bound to displayed precision by a normative law
  (`HORIZON_SCAN_DS_M / v_max ≤ HORIZON_TAU_QUANTUM_S`), a violating `--scan-ds` is refused
  `SCHEMA/scan_ds_too_coarse` rather than silently under-triggering `intermittent`, and the
  residual sub-grid flicker blindness is declared rather than papered over. A scan that is not
  monotone in the start instant is **refused outright** (`status: "intermittent"`, no scalar), never
  smoothed and never reported as "the last one"; the rider id, the policy block and the placard
  survive that refusal, because disclosure is not a scalar. Because the reported instant is a
  property of one canned controller and not of the world, it is named the **reserve-lean save
  window** and never a point of no return. *Supersedes* nothing; *scopes* D18's third rationale
  (hash sensitivity to iteration internals) by placement and D18's second (the doctrinal question
  is binary) on the record — the *classification* question is binary, the *teaching* question is
  continuous. Specified in `04-solver-and-authoring.md` §4b.

- **D45 — The continuation envelope is declared, evidence-only, never a check, and gated on an
  arithmetic spike.** At a corner-relative probe ladder on each line, a line's commitment may be
  probed against a **declared probe set of continuation roads**: roads byte-identical to the actual
  road up to the rider's own `s_limit` via `truncateAt`, then a tail inside a curvature envelope
  (`|κ| ≤ envelope.kappa_max_1pm = 1/7 1/m`, `|dκ/ds| ≤ dkappa_ds_max`, one boundary step at full
  envelope width so the actual road is provably contained) declared by a committed
  `linelab-continuations/1` pack, spelled in the ordinary DSL and composed by the ordinary
  `compose`. The curved tail is budgeted in **swept angle** (`member_sweep_max_deg = 150°`,
  strictly below `SWEEP_UTURN_MIN = 170°`, `03 §2`), never in arc length, because an arc-length
  budget refuses every tightening member `OUT_OF_SCOPE/super_tight_geometry` under D21 and leaves a
  fan that cannot state its own thesis; the ladder is parameterised as a fraction of **remaining
  curvature headroom**, distinct from the containment step bound, so no two rungs are the same
  road. On each admissible member one registered counterfactual rider (`brake_reserve_escape`,
  `04 §4c`) runs on the same stepper under the predicate `reserve_bounded_run`, graded **only over
  stations past `s_L`** — a violation on the shared span is a member-independent
  escape-precondition error reported as `escape_status: "probe_outside_reserve_at_entry"` with
  `k_refuted: null`, never as a refutation. The product is `k_refuted` of `k_admissible`: a
  refutation, never a certificate, always named to its pack, always beside the standing placard
  *"a sample of the possibilities, not the set of them"*, and always disclosing whether the road the
  rider is actually on is among the refuted. `verdict.commitment` — including `belief_admissible`
  and `actual_road_refuted` — is excluded from `result_hash` **unconditionally and permanently**,
  never consulted by `outcome` or `quality`, never run on the warm-cache recompute path, and off in
  every committed book scene. **No refutation-only doctrine check is ever promoted from this
  report**: `commit_within_sight` is struck by decision, not deferred, and is tombstoned
  `UNKNOWN_ID/struck_by_decision`. The observation-consistency filter is retained with its claim
  reduced to what it can prove — it prunes continuations the rider would have seen *further*, or
  seen *displaced where road re-emerged past an occluder's lateral edge*, and it is provably inert
  under total occlusion, which the report discloses per probe (`filter_effective`) and the placard
  states. The design of record is complete and normative now; **implementation is authorised only
  by `S-CONT-SEPARATION-v2`** (`09 §3.4a`) — see D46, which retires the original spike and its
  pass condition. Specified in `03 §7a`, `04 §4c`/`§4d`, `05 §6.5`,
  `06 §2.2`/`§2.4`/`§2.7`/`§3.1`, `07 §5.3`, `08 §3`/`§4`/`§5`, `09 §3.4a`. *Supersedes* the briefed
  "refutation-only checks and the `commit_within_sight` independence gate", which is withdrawn in
  full; and *supersedes* D29's `result_hash` exclusion list, which gains `commitment`
  (`{result_hash, diagnosis, cache, skew, commitment}`, `05` §8.3).

- **D46 — The visibility corpus was inert, the D45 ladder was sign-broken, and the spike that
  gated D45 could not have decided anything. All three are repaired; D45 stays deferred.**
  An adversarial audit (2026-07-19) re-derived the geometric claims in `design/` from the DSL
  strings rather than reading them, and found the load-bearing ones false. **(1) `bookBlind` was
  not blind.** It was `book90` geometry, and `blind(c)` (`01 §A.2`) is `s_limit < s_end(c)`; the
  minimum achievable `s_limit` was 32.50 m against `s_end = 30.85 m` (swept over turn-in `entry−4 … s_end` × the corridor). Widening the turn-in sweep further *does* reach
  blind on a cut-in line — 30.00 m from `entry−8`, 28.75 m from station 0 — and, **at a small
  margin (`≤ ~0.2`), on the hold-wide line too** (blind by up to ≈ 1.2 m at the wide band edge
  from `entry−7`, since `blind(c)` is single-turn-in). Blindness under a roadside
  band occluder rises steeply with **swept angle** (half-crossing ≈ 115° at book proportions), so
  **no 90° corner in the band is blind on the hold-wide line at the doctrinal turn-in
  (`rider.start.f = 1.0`, turning in at `s0`)** — an earlier draft's "at any legal hedge margin"
  overstated it — and at
  `margin ≤ 0.5` a 90° corner *is* blind on a **cut-in** line — marginally at 0.5 (0.10 m), by
  1.35 m at `margin = 0` — which would make
  `blind(c)` true for the bad line and false for the good one and invert
  `hold_wide_for_sight`'s applicability. Avoiding that knife edge, not merely reaching blindness,
  is what forces the reshape. With `blind(c1)` false,
  `hold_wide_for_sight` returned `na`, the `BLIND_RESERVE_DEG` cap never applied (it needed
  `R = 11.503 m` inside a 12.40 m corridor floor), and **V2 emitted no hold-wide `position` action
  at all** — it generates one per *blind* corner (`04 §6`), so the mechanism the whole fixture
  exists to demonstrate was absent. That third consequence also made `A-VIS-HOLD-REACH` vacuous,
  now recorded OPEN alongside `A-SSD-GOVERNOR` (`09 §3.5`). Separately — and *not* via `blind(c)`, which the
  V1 governor does not read — the governor never bound either, because the fixture had more sight
  (≥ 24 m) than stopping distance (14.53 m), so `A-SSD-GOVERNOR` passed by equality. `bookBlind` is reshaped to
  `lane 3.5 | S 16 | L 12 ^140 | S 16` at 34 km/h with `hedge inside c1 -6x36`; it no longer
  inherits `book90`, which is unchanged and keeps figs 8.1–8.3. **No committed book-figure scene
  used `bookBlind`, so no baked figure moves.** `fx-esses-blind` had the same defect; `09 §3.5`
  retires it for `fx-chain-blind` (a new same-hand ≥130° chained fixture, sized against
  `fixture_geometry.py`), leaving `bookEsses` — committed ink — untouched. **(2) The §7a.4 ladder branched on
  `sign(κ_L)`**, which flipped its semantics with hand: on left-handers three rungs clamped onto
  one byte-identical road (the exact collapse the headroom ladder was introduced to prevent), on
  right-handers two rungs stepped outside the pack's own `kappa_step_max_1pm`, and at `κ_L = 0` all
  seven collapsed to one. Every *left-hand* preset was hit — `book90`, `bookBlind`, `bookDecreasing`, `bookDoubleApex` — including
  `bookBlind`, the fixture the gate runs on; `bookEsses` and `bookHairpin` are right-handers and took
  the other half of the bug (two rungs stepping outside `kappa_step_max_1pm`). The ladder is re-expressed in the
  **hand frame** — `σ = +1` tightens to the ceiling, `σ = −1` straightens, hand reversal reachable
  only through the rate clause — which restores hand symmetry, definedness on a straight, and
  containment of every rung. **(3) `dkappa_ds_max_1pm2 = 0.0025` excluded `bookDecreasing`**, whose
  own taper runs `0.004232` (1.69×), so `P-CONT-ENVELOPE-CONTAINS-ACTUAL` would have failed on the
  decreasing-radius trap itself; raised to `0.005`, and all three envelope bounds are now normatively
  lower bounds set by the corpus. **(4) `S-CONT-SEPARATION` is retired** and replaced by
  `S-CONT-SEPARATION-v2`: a step-0 arithmetic gate, a sight measurement that may terminate the
  effort on its own, and a grid over `escape_decel_mss` whose decisive condition is a
  **non-collinearity witness** — two cells with identical check-verdict tuples and different
  `k_refuted`. Two claims in the retired text are withdrawn as **wrong**, not superseded: the
  necessary condition was reach-vs-`s_L`, not `1/kappa_max < R_res`; and the argument that
  containment made the feature untunable had the **sign backwards** — containment is a lower bound, so raising
  `kappa_max_1pm` buys separation — subject to the step/ceiling coupling now normative in `03 §7a.3`
  and to the grid's saturation fence, which are the two real limits (`09 §3.4a`). `§7a.10`'s collinearity reasons 2 and 3 are
  likewise retracted and restated: `k_refuted > 0` requires the escape to reach past `s_limit`,
  which is close to `stop_within_sight` re-evaluated at 3.0 m/s² instead of 7.0. The set relation
  runs `{check 10 fails} ⊆ {reach@3.0 > sight} ⊇ {k_refuted > 0}` — so `k_refuted` sits inside a
  **superset** of check-10 failure, not a subset of it, and it therefore **can** fire where check 10
  passes cleanly, over a band ≈ 49 % of `ssd` wide at 34 km/h. An intermediate draft of this entry
  claimed the reverse and called the band thin; both are withdrawn. What survives is the
  *interpretation*: that band is bounded by two TUNING constants, so any independence it shows is
  purchased by a choice rather than by physics. **D45's deferral is unchanged; its expected outcome
  is "likely fail at step 1, genuinely undetermined on the non-collinearity witness"** — firmer than
  the retired "undetermined" on the sight measurement, and honestly open on the question that
  decides the feature. The "one day answers a question worth twelve to fourteen" cost claim is withdrawn
  as unsourced. The load-bearing geometric assertions above are executable: `review/verify/fixture_geometry.py`
  re-derives the blindness sweep, the envelope bounds, the ladder and the reach band from the DSL and
  fails on drift. It does **not** yet cover `fx-hedge-gap`, `C30-DR`, `L_req`, or `R_res`, which remain
  prose-only — the standing obligation being that a visibility
  assertion on a corner where `blind(c)` is false does not fail, it passes vacuously.
  *Supersedes* D45's spike and pass condition, `03 §3.1`'s `bookBlind` row and `book90`
  inheritance, `03 §7a.2`'s rate bound, and `03 §7a.4`'s ladder.

- **D47 — A figure must show what its own verdict is measured against, which way the line runs,
  and how far anything is.** A learner's reading of the six Chapter-8 plates (2026-07-25) found
  three things absent from every one of them. **(1) The graded corridor had no ink.** `off_road`
  fires at the carriageway edge, and stage 8's terminal glyph does land there (measured: 2–4 cm on
  all six figures). But every check that grades a line as running *wide* — `exit_containment`,
  `chain_containment`, and the apex percentages, all measured in `f` — is graded against the
  rider's lane inset by `bike_margin_m`, and that band was drawn nowhere: the verdict card said
  "ran wide" and the figure showed nothing to be wide *of*. **(2) Direction, distance and entry
  speed were absent**, so a reader could not tell which way a line ran without hunting for the
  arrowhead, and no distance in the figure had a unit. **(3) Verdict rode on hue alone** — the
  whole semantic axis was green/amber/red, which is exactly the axis ~8% of male readers cannot
  separate, and which a greyscale print destroys. Three stages are added to `06 §3.1`: **3b** the
  usable-corridor edges (neutral, finely dotted, from `road/corridor.ts`'s own `corridorEdgeOffsets`
  — the renderer re-derives nothing); **8b** line chrome (a direction chevron every 10 true metres,
  numbered on the ideal line only; the entry speed at each line's first drawn sample; and the
  outcome **in a word** — `clean` / `caution` / `ran wide` / `ran off` / `crashed` / `stopped` —
  beside the terminal glyph, which is the redundant channel that makes a verdict survive hue-blind
  or greyscale reading); and **11** a scale bar in metres and feet with the lane width. The colour
  law of `06 §5` is **untouched**: redundancy is added, no palette is changed. `DrawnLine` gains
  `stations` (the true station of every drawn point, also emitted as `data-stations`) and
  `entry_kmh`. Stage **8b** additionally carries a **consequence ray**, gated on a new ViewSpec
  field `consequence: on | off` (default **off**, `06 §2.1`): past an `off_road` terminal, the
  heading the line left with, extrapolated at constant heading and cut at the first occluder it
  meets. It is not a trajectory and `06 §3.2`'s "no line the engine did not produce" stands — it is
  drawn in neutral hatched ink with no arrowhead and never a verdict colour, the same treatment
  D45's fan takes for the same reason. Only `fig-08-01` asks for it, because only that figure's
  lesson is about what the runoff was pointing *at*. Specified in `06 §2.1`, `06 §3.1`.

- **D48 — The POV frame may be held level, and says its numbers in riding words.** Three defects,
  same reading. **(1) The road surface was one polygon** — outer edge forward, inner edge reversed —
  which is a valid ring only while the whole strip is in front of the camera. On `bookEsses` and
  `bookDoubleApex` the 140 m lookahead bends both ways, the two chains cross, and the surface
  folded into a spike with the rider's line looping through it. The surface is now a **strip of
  per-station quads sorted far→near**; polylines split at the near plane into contiguous runs,
  because dropping a vertex and joining its neighbours (`07 §5.2`'s "drop vertices, do not
  edge-clip") stitches a segment across ground that was dropped. Pinned by an invariant with teeth:
  **a flat road never draws above the horizon**. **(2) Roll.** `07 §5.3`'s "the horizon angle IS
  the lean" remains the engine default and the honest one — but a reader of a *still* figure has no
  vestibular sense to cancel a 30° roll with, so the tilt reads as a road falling out of frame
  rather than a bike leaning. A new ViewSpec field **`roll: lean | level`** (CLI `--roll`, default
  `lean`) holds the camera upright and moves lean to a HUD dial; the book bakes `level`. Lean is
  never lost, only carried on another channel. **(3) The HUD spoke engine**: `φ -14.51° … ssd
  18.29 m ▶ deficit` became `lean 15° left · see 7 m · need 18 m to stop · SHORT by 11 m`, whole
  numbers, red when short — and the values also ride as data attributes so a consumer never regexes
  prose. Two additions of the same kind: the rider's own bar ends and mirrors in the near corners
  (a first-person frame with none of the machine in it gives the reader nothing to sit on), and,
  when the focused line projects entirely off-frame — a rider looking where their line does not go,
  which *is* the fig 8.1 mistake — an edge marker naming it, rather than a frame that silently
  draws no line. `render --views pov` gains `--s <m>`: the camera at a chosen true station, at the
  nearest **recorded** sample, never an interpolated pose. Specified in `06 §2.1`, `07 §5.2`,
  `07 §5.3`.

- **D49 — Findings are named for the rider; the rubric is not renamed.** The verdict cards handed a
  reader `late_apex`, `out_in_out`, `single_input`, `stop_within_sight`, `rideability: tracker
  overdrive` — identifiers for the engine's own use — and never once said what to do differently.
  `plan/doctrine/lexicon.ts` gives each of the sixteen a title, a *why* and a **fix**, and rewrites
  a finding's evidence from **only** the metrics that check recorded (returning nothing, so the
  caller shows the original, when it cannot). It grades nothing: a lexicon that could disagree with
  the catalogue would be a second rubric, and `01 §A.3` admits one. Surfaced through
  `explain <check-id>`'s new `rider` block and consumed by the chapter gallery. Related finding,
  settled and **not** a defect: a fifty-pencing line draws six turn-point markers (the
  marker-from-event law is record-wide) while `single_input` reports three (it counts inside the
  corner window, and the line left the road at 23.8 m of a corner spanning 12–30.9 m). Both numbers
  are right; the scope is named in the lexicon rather than in the check's `message`, because that
  message rides inside the hashed verdict and rewording it moved every committed `result_hash` in
  the golden roster. **Evidence text is not the place to fix a reading problem.** Specified in
  `01 §A.3` (unchanged, cited), `08 §5.2`.

---

## 3. Build phasing (normative)

The design of record describes the finished tool; this section fixes the order
in which it is built and what each phase must prove before the next phase
begins. It was added after the 2026-07-18 adversarial review: the six
Chapter-8 figures — the deliverable that anchors the project (G7) — need only
the figure spine, while the three least-precedented subsystems (POV, stepper,
diagram projection) carry most of the schedule risk and contribute nothing to
the six figures.

**D1 is unchanged by this section.** D1 fixes the *architecture* — a pure,
dependency-free TS/ESM core that runs identically in CLI and browser — and the
*destination*: the interactive viewer is what linelab becomes. It does not fix
the build order. Every phase builds on the D1 architecture from the first
commit: the core is browser-capable from v0.1 even though no browser surface
ships until v0.2, and nothing v0.1 builds is anything D1 superseded (no
`file://` doctrine, no classic scripts, no second physics). The static SVG
figures v0.1 delivers are the *deliverable of that phase*, not a reversal of
"static figures are an export target": they are exports of the same engine the
viewer later animates, produced through the same `render/` modules the viewer
imports.

| Phase | Ships | Goals delivered | Exit gates (`09` §phase-gates) |
|---|---|---|---|
| **v0.1 — the figure spine** | `core/`, `road/`, `sight/`, `plan/` (validation + controller), `solve/` (solve, suggestTurnIn, chainedSolve, mistake compiler), `render/` top-down in `true` mode, the true-scale book presets, `cli/` verbs `run solve mistake figure render check schema explain export` | G1, G4, G6, G7, G8 (via true-scale presets), and G5's authoring/sharing half | analytic-acceptance layer green, then first bless; golden numerics; mistake oracle; `P-DETERMINISM` / `P-EXPORT-DETERMINISM`; all six book-figure scenes bake, pass the proportion gate in `true` mode, and pass the vision judge; CLI recipes (a), (b), (e), (f) as acceptance tests; the D8 effectuality suite over the v0.1 schema; the D42 counterfactual layer (`04` §4c) — registry closedness, the rider precondition and its two discharge routes, literalise-first, disclosure prose, and the pack-provenance test (`P-CF-PRECONDITION`, `P-CF-LITERALISED`, `P-COUNTERFACTUAL-CLOSED`, `P-COUNTERFACTUAL-NAMED`, `P-CORR-CONSTANT-SPEED`, `A-CORR-EXPLAIN`, `A-CF-REGISTRY-CLOSED`, `A-CF-DEAD-REASON`, `A-PACK-PROVENANCE`, `G-CORR-RIDER`, `G-CF-PRECONDITION-TABLE`); `C-SAVEWIN-NO-INK` as a regression sentinel against the six baked book figures, where it passes trivially because the `save-window` verb does not yet exist |
| **v0.2 — inspection** | viewer app with stepper + HUD, the `state` CLI verb (`stateAt`), `serve`, the `controls` strip with linked cursor, `sweep`; the `standing` ladder (`05` §6.4) as a pure exported function plus `check --standing`; the save-window analysis (`04` §4b) — the `save-window` CLI verb and the stepper overlay, both off by default and out of hash | G2, G3, and G5's inspection half | `C-STATEAT-LAWS`; `C-HUD-EQUALS-STATEAT`; `C-BOOKMARKS`; `C-ONE-CORE`; `C-RECOMPUTE-BUDGET` (as re-scoped by 09); recipe (c) end to end including `serve`; `G-STANDING-BITES`; `G-STANDING-NO-HASH-MOVE`; `A-STANDING-WARN-BAND`; `A-STANDING-RESERVED`; `A-STANDING-LADDER-CUMULATIVE`; `A-STANDING-REFUSAL`; `A-RESERVE-CHECKS-RESOLVE`; `A-LADDER-PROSE`; `A-STANDING-TOMBSTONE`; `C-SAVEWIN-HUD`; `C-SAVEWIN-CLIP`; `C-SAVEWIN-NO-INK`; `C-SAVEWIN-REFUSE-COARSE`; `C-SAVEWIN-BUDGET`; `G-SAVEWIN-GRID`; `A-SAVEWIN-PLACARD`; `A-SAVEWIN-VERB` |
| **v0.3 — immersion** | POV view + `pov` render target, compare mode + `compare` verb | G9 | `C-POV-LIMIT-CONSISTENT`; `C-POV-TRUE-GEOMETRY`; `C-COMPARE`; per-view boot smoke tests |
| **deferred, design kept** | the diagram projection *implementation* (design unchanged in 06) — lands when realistic-road figures (roads authored at prose scale rather than from the book presets) actually appear; the `fit` front door (`04` §deferred, post-v1); the `--jitter` ensemble mode (`08` §deferred, v2); **the continuation envelope (D45)** — design of record complete in `03` §7a / `04` §4d, build authorised only by the gate `S-CONT-SEPARATION-v2` (`09` §3.4a), then landing report-only in an inspection phase and rendering in an immersion phase; permanently evidence-only, out of hash, off by default, and absent from every committed book scene | — | each deferred design carries its own gates, pre-written in its owning doc |

**v1.0** is v0.3 complete with every gate green — the point at which G1–G9 all
hold and D1's destination is reached. Nothing after v0.1 may change the result
contract retroactively: v0.2 and v0.3 are pure consumers of v0.1's engine and
envelope, which is exactly the consumption discipline 05 and 07 already
specify.

**The phase-gating law (D8 under phasing).** Each phase's shipped `schema`
output covers exactly the vocabulary that phase implements — the printed
schema *is* the phase. A token that exists in the design of record but not in
the shipped phase is rejected `SCHEMA` like any unknown token, and the error
object carries one additional optional member `deferred: "<phase>"` naming
when it arrives — e.g. `--mode diagram` under v0.1 →
`{code: "SCHEMA", at: "view.mode", deferred: "projection (post-v0.1)",
schema_ref: "view"}`. Nothing is ever accepted and ignored; nothing pretends
to exist before it does. Until the projection lands, `view.mode` has the
single value `true` and it is the default; when the projection lands, 06
§2.1's vocabulary and default apply unchanged.

---

## 4. The sibling documents (01–09)

| Doc | Subject |
|---|---|
| `01-scope-and-doctrine.md` | Goals; book-as-doctrine; the line-selection doctrine (ideal line, canonical mistakes, special-case corners, limit-point/visibility rules); the failed-lines-first-class reversal; scope boundaries and honest-limitation placards; **Appendix A: the 16-check doctrine catalogue** (the shipped rubric pack, D12). |
| `02-physics-model.md` | State vector, equations of motion, emergent curvature, friction ellipse, rate-limited roll, **the steering-state machine (§3.1, D13)**, **the run-wide slice (v2)**, integrator, events, termination and fate precedence, determinism, golden numerics. |
| `03-roads-scenarios-and-visibility.md` | Road model and DSL; occluder vocabulary; the rider-eye sight model; the scenario wire schema (id-addressed plan actions, effectual `position`); the mistake compiler (kinds, params, the one pin table §7.1, per-corner chaining); multi-line figures. |
| `04-solver-and-authoring.md` | Turn-in suggestion; bisection solving; constraint-targeted solving; chained-corner solving; the visibility-governed mode (stop-within-sight, hold-wide, authorable knobs) and its chained composition; **the corrective-shot policy (D18)**; **the `fit(trace)` front door (sketch, D39)**; authoring layers from one-command to scene text; agent workflows. |
| `05-result-contract-and-inspection.md` | The Sample contract (including commanded controls and per-sample sight); the time-base; `stateAt`; the phase machine (§4.1); events-as-bookmarks; the verdict JSON; multi-line result envelope; export and sharing formats. |
| `06-rendering-and-projection.md` | The diagram projection (modes, compression, width band, crop, invariants, disclosure); the top-down renderer (markers, sight rays, occluded-region shading); the controls strip; colour law v2 in detail; the proportion gate. |
| `07-viewer-animation-and-pov.md` | Viewer architecture; the stepper (scrubber, HUD, named jump points, compare mode); the POV view (camera model, projection, draw order, limit-point marker, placards). |
| `08-cli-and-agent-interface.md` | Verb table and exit codes; machine-JSON output; schema discoverability ("first try from `schema` + `explain` alone"); the zero-file one-command path; agent recipes. |
| `09-verification-and-testing.md` | Golden numerics and tolerances; property tests for projection invariants; the proportion gate; mistake-preset oracle; POV/stepper contract tests; the adapted render-then-judge loop; phase gates; testing philosophy. |

---

## 5. Shared vocabulary (normative — use these names verbatim)

- **Views:** `topdown`, `controls`, `pov`. Top-down render **modes:** `true` |
  `diagram` (D2). The POV and all state readouts are always true-geometry. The top-down ViewSpec
  additionally carries `fan: auto | off | <probe index>` (D45), which resolves on only when a
  `CommitmentReport` is attached to the loaded envelope and never invokes an engine run.
- **Line roles:** `ideal` | `alternative` | `mistake` | `reference` (labels only;
  colour comes from the verdict per D9).
- **Outcomes (closed set, physics-only, D11):** `crash` > `runoff` > `wide` >
  `stopped` > `contained`, in severity order; outcome never reads a doctrine
  check. `clean` is a derived predicate: `contained` ∧ zero applicable check
  fails. **Quality (total, D11):** `good` | `caution` | `failing` — the sole
  colour source (green/amber/red per D9); the outcome word `contained` never
  doubles as a quality word.
- **Standing (closed, ordered, out-of-hash, D43):** `reserved:4 > clean:3 > caution:2 >
  failing:1 > crash:0` — the finer total order over a finished line, defined by cumulative
  monotone thresholds on `outcome`, `quality`, `clean(line)`, and the rubric pack's declared
  `reserve_checks` annex (`05` §6.4, `01` §A.6.1). The rung tokens name **the highest rung
  attained**, not the extension of the namesake predicate: a line at rung 3 and a line at rung 4
  both satisfy `clean(line)`. `standing` is never a colour source — `quality` remains the sole
  colour function (D9) — never enters a hash or a gate, and is `null` on a refusal.
- **Mistake kinds (closed set, extensible by design change):** `premature` (the
  book's canonical "premature turn point" — turned in too soon, runs wide),
  `premature_contained` (the eased early turn-in that stays contained),
  `slow_steer`, `fifty_pence`, `chop`, `overspeed`, and the misjudgment kinds
  `underread`, `overread` (D23). The retired name `early_apex` is rejected with an
  `UNKNOWN_ID/renamed_kind` tombstone naming `premature`. One composed token
  spells a mistake everywhere: `[lineId=]kind[:k=v,...][@scope]` (D32). Each
  kind's admissible outcomes, fixture pin, and book-figure mapping live in the one
  pin table (03 §7.1).
- **Plan action types:** `brake`, `turn_in`, `throttle`, `position` —
  id-addressed. **One anchor grammar (D32, shared with occluders and hazards):**
  `entry|exit|mid:<id>` (bare `<id>` = `entry:<id>` sugar) or absolute `s:<m>`;
  offsets are separate signed metres, never embedded inside the anchor (embedded
  forms reject `SCHEMA/anchor_embedded_offset`). No `apex` anchor.
- **Hand alphabet (D26):** `hand` spells `L` | `R` on every surface that means
  road/corner handedness (road DSL, preset `hand=`, `turn_in.hand`); `left` |
  `right` is exclusively rider-relative (occluder `side`). Full words on a `hand`
  key reject `SCHEMA` with a rewrite hint. `handSign("R") = +1` (y-down frame) is
  the single sign-conversion point.
- **Constraint bounds (closed set, D10):** `f_min` | `f_max` | `v_max_kmh` |
  `sight_margin_min_m`, over corner-relative station spans. Solver-layer only —
  a constraint never appears in the wire plan and the engine never sees one.
- **Counterfactual riders (closed set, D42):** `lean_only_reserve` (prose: *the lean-only rider*)
  | `brake_reserve_escape` (prose: *the lean-and-brake rider*). **Counterfactual predicates
  (closed set):** `return_after_detect` | `horizon_bounded_return` | `reserve_bounded_run`. Both
  sets are declared in `04-solver-and-authoring.md` §4c. A pack may reference a rider id and may
  carry declared scalar bounds; a pack may never define a rider. Every named what-if entry point
  (`correctiveShot`'s shadow, `saveAt`, `E_c`) is a thin wrapper that declares its
  `(rider, predicate)` binding at its own definition site. Every surface emitting an escape
  verdict, an out verdict, or a save-window scalar carries the `rider` id on its out-of-hash
  record and names that rider in prose.
- **Phases (closed set, 05 §4.1):** `approach` | `turning` | `midcorner` |
  `exiting` | `done` — disjoint by design from station anchors and event kinds.
- **Save-window vocabulary (D44).** The object is the **reserve-lean save window** — never a
  "point of no return", never a "save horizon", and never a "commitment point"; the HUD already
  reads `a_noreturn` as *brake ceiling at lean*, and the three closed vocabularies (check ids,
  error codes, mistake kinds) gain no name from this feature, so `explain`'s disambiguation stays
  collision-free. Names, verbatim: `saveWindow`, `saveAt`, `tau_close_s`, `s_close_m`,
  `s_star_m`, `t_earliest_s`, `reaction_budget_s`, `react_profile_s`. **Save-window status
  (closed set, `04` §4b.5):** `resolved` | `open_at_end` | `never_open` | `intermittent` |
  `not_applicable`. Prose form: *"the save window closed at s = 34.2 m"*. The shadow it integrates
  is a **probe**, not a trajectory — the word *trajectory* is reserved for engine output a rider
  is shown as a line.
- **Continuation vocabulary (closed sets, D45).** A **continuation pack** is a committed
  `linelab-continuations/1` data file naming a **prior** (`"<name>/<version>"`, e.g. `street/1`);
  a **member** is one generated continuation road addressed by its ladder index `σ`, never by a
  corner id; **`m0`** is the actual road and is always member index 0; a **probe** is one station
  on the corner-relative probe ladder, and the last probe of a corner is the **commitment
  probe**. `escape_status ∈ ok | probe_outside_reserve_at_entry`. `refute_reason ∈
  member_off_road | member_crash | member_reserve_exceeded | member_ellipse_exceeded |
  member_corridor_exceeded | member_no_room_before_road_end`. A member is **refuted** or **not
  refuted under this pack**; it is never *survivable*, never *safe*, and a corner is never
  *escapable* or *unescapable*.
- **Struck names (tombstones, not vocabulary).** `out_available`, `sight_ok` and
  `SIGHT_MARGIN_ROB` (D43) and `commit_within_sight` (D45) are rejected
  `UNKNOWN_ID/struck_by_decision`, each naming its successor mechanism or, for
  `commit_within_sight`, naming no successor. `struck_by_decision` is not `deferred`: there is no
  phase in which any of these arrives.
- **Core per-sample fields** (a **declared minimum** — 05 §2.1's pinned table is
  normative and append-only; new fields land there first, and the Trace CSV column
  order follows it): `s, t, x, y, psi, v, phi, kappa, a_long, a_lat, grip, mu, d,
  f` plus commanded controls (`cmd_lean`, `cmd_a`, `roll_rate`, `action_id`,
  `clipped`, `n_long`, `n_lat`) plus sight (`sight_m`, `ssd_m`, `limit_x`,
  `limit_y`) plus the appended block (CSV order pinned after `limit_y`):
  `sight_ride_m`, `steer_state`, `lat_action_id`, `su_sustained`, `su_transient`,
  `a_cmd_rate`, `below_validity`.
- **Key API names:** `stateAt(result, {s|t})`, `sightFrom(road, eye, occluders)`, `solve`,
  `suggestTurnIn`, `compileMistake`, `counterfactual(world, x0, latency, rider, predicate)`,
  `standing(lineResult)`, `saveWindow(lineResult, cornerId?)`, `commitmentEnvelope(lineResult,
  opts)`.
- **Module map (target):** `core/` (physics, pure), `road/` (geometry + DSL),
  `sight/` (visibility), `plan/` (schema + validation), `solve/` (authoring
  solvers), `render/` (topdown, controls, projection), `viewer/` (app: stepper,
  POV), `cli/`.
- **Units:** metric everywhere — m, m/s, km/h for display, degrees for lean/sweep;
  `g = 9.81 m/s²`. Book (US-unit) claims are judged by correct conversion
  (mph→km/h ×1.609, ft→m ×0.3048), never string match.
- Uncertain constants are written with a `TUNING` mark and a plausible default.

---

## 6. Relation to `extract/` (the prior design)

**Carried forward essentially intact:** the physics spine (RK4 integration,
`kappa = g·tan(phi)/v²`, friction ellipse, rate-limited roll, emergent apex), the
solver approach (feasibility probe + monotone bisection + self-verifying re-run),
the mistake compiler (one-perturbation compiles with pinned outcomes), the one-line
road DSL, the marker vocabulary (hourglass turn-point / ring apex / dot exit), the
lane-constrained-by-default rule, metric units, and the honesty stance (honest
limitation placards; never ship a trajectory the engine didn't produce).

**Deliberately changed:** the architecture (D1), the compactness mechanism (D2),
the physics ceiling (D3), the sight-cast eye (D4), mistake-line shareability (D6),
input effectuality (D8), and the colour law (D9).

**New subsystems with no prior equivalent:** the diagram projection and proportion
gate, the stepper/HUD, the POV renderer, `stateAt`, and the visibility-governed
solver mode; and, from D42–D45, the closed counterfactual registry with its stated
precondition and literalise-first rule (`04` §4c), the `standing` ladder over a
finished line (`05` §6.4), the out-of-hash reserve-lean save window (`04` §4b), and
the continuation envelope (`03` §7a / `04` §4d), which is designed in full here and
gated on the gate `S-CONT-SEPARATION-v2` before any of it is built.

`extract/` remains in the repository as the historical design record; where a
sibling document is silent, the prior design's choice is a reasonable default, but
on any conflict **this set wins**.
