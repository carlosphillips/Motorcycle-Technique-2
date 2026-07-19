## Lifecycle: Phasing, Sharing, Variability, Fit-My-Line

> **EDITORIAL RECONCILIATION (binding) — 2026-07-19 editor pass.** Merged against the
> thirteen sibling amendment sections per the three reconciliation audits. Where the
> body below disagrees with a bullet, the bullet wins.
>
> - **This section WINS:** the line-level `expected: {outcome, result_hash}` exporter
>   stamp (ONE home — verification's `solved.expected` embedded copy folds into it;
>   agent-interface's authored `expect` block stays a SEPARATE field, both defined
>   once in 05 §8.1); the figure-level `engine_semver` stamp; the `skew` member
>   (EXCLUDED from `result_hash`, like diagnosis and cache); the closed tier enum
>   `match|unstamped|detail|story`; the phase-gating law with the `deferred:
>   "<phase>"` SCHEMA member; the D1 clarifying-amendment reading (D1a drafted as
>   fallback only).
> - **Adopted into the ONE exit table (08 §3.1, agent-interface's frame):** this
>   section's UD3 — figure-level story-tier skew exits 3 under `--gate` — is a gate
>   row, not a separate law.
> - **Outcome words:** Option B — `expected.outcome` and the jitter histogram use
>   `crash|runoff|wide|stopped|contained`; `clean` is the derived predicate
>   (respelled in place); any outcome-class additions flow into stamp validation
>   automatically.
> - **Cached plans:** adopted (verification owns the mechanism); stamps are the
>   mandatory safety net exactly as this section conditions; `source.resolved_plan`
>   as a third home is REJECTED — one home (`solved.plan`).
> - Kinds respelled in place (`premature` nee `early_apex`); C-SKEW-*/P-JITTER-*/
>   A-FIT-* ids stand.

Cluster anchors: review §8.3 (phasing + the D1 tension + the related projection-defer
finding), §8.5 (share-URL version skew), §8.7 (variability/`--jitter`), §8.4
(fit-my-line), plus the P3 items in §11 and the stated dependency on §7's
C-RECOMPUTE-BUDGET cached-plans option. Laws honoured throughout: D6 (inputs vs
outputs provenance governs shareability), D7 (engine produces every drawn line),
D8 (typed errors, nothing accepted-but-ignored), D9 (colour from verdict).

---

### 1. Build phasing (normative section for 00)

#### 1.1 Placement

Insert as a new top-level section of `design/00-README.md`, immediately after §2
(the decision log); the editor renumbers §3–§5 down. One cross-reference sentence
is appended to D1 in §2 (text in §1.3 below). It **contradicts and replaces**
nothing in 00 — it adds the build order the review confirmed exists nowhere — but
it forces two amendments in sibling docs (§1.4).

#### 1.2 Exact section text for 00

> ## Build phasing (normative)
>
> The design of record describes the finished tool; this section fixes the order
> in which it is built and what each phase must prove before the next phase
> begins. It was added after the 2026-07-18 adversarial review: the six
> Chapter-8 figures — the deliverable that anchors the project (G7) — need only
> the figure spine, while the three least-precedented subsystems (POV, stepper,
> diagram projection) carry most of the schedule risk and contribute nothing to
> the six figures.
>
> **D1 is unchanged by this section.** D1 fixes the *architecture* — a pure,
> dependency-free TS/ESM core that runs identically in CLI and browser — and the
> *destination*: the interactive viewer is what linelab becomes. It does not fix
> the build order. Every phase builds on the D1 architecture from the first
> commit: the core is browser-capable from v0.1 even though no browser surface
> ships until v0.2, and nothing v0.1 builds is anything D1 superseded (no
> `file://` doctrine, no classic scripts, no second physics). The static SVG
> figures v0.1 delivers are the *deliverable of that phase*, not a reversal of
> "static figures are an export target": they are exports of the same engine the
> viewer later animates, produced through the same `render/` modules the viewer
> imports.
>
> | Phase | Ships | Goals delivered | Exit gates (`09` §phase-gates) |
> |---|---|---|---|
> | **v0.1 — the figure spine** | `core/`, `road/`, `sight/`, `plan/` (validation + controller), `solve/` (solve, suggestTurnIn, chainedSolve, mistake compiler), `render/` top-down in `true` mode, the true-scale book presets, `cli/` verbs `run solve mistake scene render check schema explain export` | G1, G4, G6, G7, G8 (via true-scale presets), and G5's authoring/sharing half | analytic-acceptance layer green, then first bless; golden numerics; mistake oracle; `P-DETERMINISM` / `P-EXPORT-DETERMINISM`; all six book-figure scenes bake, pass the proportion gate in `true` mode, and pass the vision judge; CLI recipes (a), (b), (e), (f) as acceptance tests; the D8 effectuality suite over the v0.1 schema |
> | **v0.2 — inspection** | viewer app with stepper + HUD, the `state` CLI verb (`stateAt`), `serve`, the `controls` strip with linked cursor, `sweep` | G2, G3, and G5's inspection half | `C-STATEAT-LAWS`; `C-HUD-EQUALS-STATEAT`; `C-BOOKMARKS`; `C-ONE-CORE`; `C-RECOMPUTE-BUDGET` (as re-scoped by 09); recipe (c) end to end including `serve` |
> | **v0.3 — immersion** | POV view + `pov` render target, compare mode + `compare` verb | G9 | `C-POV-LIMIT-CONSISTENT`; `C-POV-TRUE-GEOMETRY`; `C-COMPARE`; per-view boot smoke tests |
> | **deferred, design kept** | the diagram projection *implementation* (design unchanged in 06) — lands when realistic-road figures (roads authored at prose scale rather than from the book presets) actually appear; the `fit` front door (`04` §deferred, post-v1); the `--jitter` ensemble mode (`08` §deferred, v2) | — | each deferred design carries its own gates, pre-written in its owning doc |
>
> **v1.0** is v0.3 complete with every gate green — the point at which G1–G9 all
> hold and D1's destination is reached. Nothing after v0.1 may change the result
> contract retroactively: v0.2 and v0.3 are pure consumers of v0.1's engine and
> envelope, which is exactly the consumption discipline 05 and 07 already
> specify.
>
> **The phase-gating law (D8 under phasing).** Each phase's shipped `schema`
> output covers exactly the vocabulary that phase implements — the printed
> schema *is* the phase. A token that exists in the design of record but not in
> the shipped phase is rejected `SCHEMA` like any unknown token, and the error
> object carries one additional optional member `deferred: "<phase>"` naming
> when it arrives — e.g. `--mode diagram` under v0.1 →
> `{code: "SCHEMA", at: "view.mode", deferred: "projection (post-v0.1)",
> schema_ref: "view"}`. Nothing is ever accepted and ignored; nothing pretends
> to exist before it does. Until the projection lands, `view.mode` has the
> single value `true` and it is the default; when the projection lands, 06
> §2.1's vocabulary and default apply unchanged.

#### 1.3 D1 reconciliation

The reading that survives phasing, appended to D1 in 00 §2 as one sentence:

> *Build order is governed by the phasing section below: D1 names the
> architecture and the destination, not the sequence — the viewer is the product
> linelab becomes, and the figure spine is how it gets there.*

This is a clarifying amendment, not a supersession: nothing in the phased order
builds any artifact D1 deprecated, and the property D1 exists to protect (one
pure core, no drift between CLI and browser physics) is enforced from the first
phase by `C-ONE-CORE` and the import-graph lint.

If the project owner instead reads D1's sentence "static SVG figures are an
*export target*, not the product" as mandating viewer-first delivery, the
amendment is insufficient and a supersession note is required. Drafted for that
case (do not adopt both):

> **D1a — supersession note (draft).** D1's product claim is narrowed in time:
> it holds of the finished tool (v1.0), while during v0.1 the exported
> book-figures are the phase's product. D1's architectural content — TS/ESM,
> one pure core, viewer and CLI importing identical modules — is unchanged and
> binds every phase.

**User decision 1** (§6) records the choice; recommendation: the amendment.

#### 1.4 Consequential amendments in sibling docs

- `01` §2 preamble gains one sentence after "Each goal below is phrased so that
  its satisfaction is a checkable property, not a mood.": *"Goals are delivered
  by phase (`00` §build-phasing); a goal's test runs from the phase that
  delivers it."* G8's test line is amended from "via the diagram projection
  (D2)" to: *"via the true-scale presets in `true` mode until the projection
  ships, and via the projection's declared mode thereafter; the proportion gate
  passes on every shipped figure in either regime."* (This is consistent with
  09 §5.3, which already requires presets to land near the bands in `true`
  mode.)
- `08` §7.2's error-object shape gains the optional `deferred` member (one row
  in the table; the closed error vocabulary itself is unchanged — `deferred`
  rides on `SCHEMA`).
- `09` gains a short "phase gates" section (§5 below) hosting the exit-gate
  table's test-name lists, so 00's table can point at one owning location.
- `07` §1's framing sentence ("the design of record for decision D1 … as it
  lands in `viewer/`") is untouched; `07` gains no phase logic — the viewer doc
  describes the v0.2/v0.3 end state and 00 owns when it ships.

Explicitly *not* changed: `06` keeps the diagram projection fully specified with
`diagram` as the eventual default (review §10 says keep the design; §8.3's
related finding says defer the implementation, and the phase-gating law is the
mechanism that defers it without violating D8).

---

### 2. The share-URL version-skew contract

#### 2.1 Mechanism

**Stamps.** `FigureSpec` (05 §8.1) gains two members, written by every exporter
and optional on hand-authored specs:

```
FigureSpec = { spec: "linelab/1", figure_id, road_spec,
               engine_semver?,                    // "1.4.2" — the engine that exported this spec
               lines: [ { line_id, role, label, source,
                          expected?: { outcome,       // closed outcome set (05 §6.1)
                                       result_hash }  // fnv-1a first-6-hex (05 §8.3)
                        } ],
               meta }
```

Validation (typed, at the single validation entry point): `engine_semver` must
match `^\d+\.\d+\.\d+$` else `SCHEMA` (`schema_ref: "figure.engine_semver"`);
`expected.outcome` must be a member of the closed outcome set else `SCHEMA`;
`expected.result_hash` must match `^[0-9a-f]{6}$` else `SCHEMA`. An `expected`
block on a line whose spec carries no `engine_semver` is rejected
`SCHEMA` ("expectation without an engine to expect it from"). Cost: ~8 bytes for
the semver plus ~40 bytes per stamped line before deflate — within the review's
estimate.

**Stamping rule.** `export --as share-url|envelope`, `scene` bakes, and the
viewer's "copy share link" always stamp `engine_semver` and per-line `expected`
from the *current* recomputed results — re-sharing re-stamps, so a forwarded URL
always describes the engine that last exported it, and placard chains never
grow stale transitively. The `expected` members are **recorded predictions, not
computed members that ride the wire as truth**: nothing downstream renders from
them; they exist only to be falsified. 05 §8.1's sentence "the envelope minus
every computed member" is amended to "…minus every computed member; the optional
`expected` stamps are falsifiable predictions of recomputation, never inputs to
it" — D6's inputs-vs-outputs provenance line is preserved because no trajectory,
verdict, or drawable quantity ever travels.

**Semver discipline (new, gives the stamp meaning).** The engine version is the
package version. Normative rule: any re-bless commit (09 §3.3) — any commit in
which hashes move — MUST bump minor or major; commits that cannot move any hash
may bump patch. Corollary: equal `engine_semver` on the pinned runtime implies
equal `result_hash` for equal specs; a hash difference at equal semver is either
a cross-runtime tolerance artifact (below) or a determinism bug.

**Divergence evaluation.** Every consumer entry point that loads a FigureSpec
(viewer `#f=`, `run`/`render`/`serve`/`export` given a FigureSpec JSON)
recomputes per D6, then compares. Per line, with `expected` present:

```
story  :=  recomputed.outcome     ≠ expected.outcome        // the figure tells a different story
detail :=  ¬story ∧ recomputed.result_hash ≠ expected.result_hash   // numbers moved, story held
```

Tier enum (closed, ordered): `"match" < "unstamped" < "detail" < "story"`, plus
figure-level `"info"` (defined below). `detail` firing at *equal* semver is
expected across runtimes: 09 §3.1 scopes bit-exactness to the pinned runtime and
guarantees only tolerance-equality (with verdict deadbands) elsewhere — which is
precisely why `story` keys on the discrete outcome, never on the hash, and why
`detail` is the quiet tier.

#### 2.2 Contract impact: the `skew` member of `FigureResult`

`FigureResult` (05 §7) gains one appended top-level member:

```
skew: null                                     // spec carried no engine_semver
    | { spec_semver, engine_semver,            // stamped vs current
        same_engine,                           // boolean, semver equality
        lines: [ { line_id,
                   tier: "match"|"unstamped"|"detail"|"story",
                   expected: {outcome, result_hash} | null,
                   got:      {outcome, result_hash} } ],
        tier: "match"|"info"|"detail"|"story" }
```

Figure tier = max of line tiers, except: when the semvers differ and no line
exceeds `match`/`unstamped`, figure tier is `"info"` ("shared from an older
engine; outcomes not stamped or all matching — differences may be
undetectable"). `skew` is excluded from `result_hash` like `diagnosis` (it
describes the *relationship between* runs, not this run) — 05 §8.3's exclusion
list gains one word.

#### 2.3 The divergence placard

When it fires: figure tier `story` renders the full placard; `detail` and
`info` render a one-line badge. Where: the viewer renders it as a banner above
the figure on load; `render` of a stamped stale spec draws it as a figure-level
annotation box in the exported SVG (same placard element class 06 already owns
for honest-limitation placards; draw-order slot to be reconciled with the
annotation-grammar cluster). The placard is a **rendered element, never an
error** (07 §5.4's rule verbatim): the figure always recomputes, renders, and
stays fully inspectable — D6's failed-lines-first-class stance extends to
stale-figures-first-class.

Wording (exact, `{}` substituted):

- `story`: **"Recomputed by engine {engine_semver}. This figure was shared from
  engine {spec_semver}: line '{label}' was {expected.outcome}, now
  {got.outcome}. Captions and labels were written for the original
  behaviour."** (One clause per story-tier line.)
- `detail` badge: *"recomputed under {engine_semver}: numeric details differ
  from the shared version (same outcomes)."*
- `info` badge: *"shared from engine {spec_semver}, recomputed under
  {engine_semver}."*

CLI behaviour: exit code unaffected by skew (tier rides in the envelope's
`skew` member; exit 0 — a stale figure is a valid, interesting run). Proposed
gate wiring, **shared surface with the exit-code/`expect_fail` cluster**: under
`run --gate`, figure tier `story` exits 3 — a teaching artifact that no longer
teaches what it claims is a doctrine-tier failure. Recorded as user decision 3.

#### 2.4 Relationship to the re-bless procedure (09 §3.3)

The re-bless procedure gains step **(f)**: *"regenerate the stamps
(`engine_semver`, per-line `expected`) in every committed FigureSpec fixture
(shipped example scenes, `figures/`) via the bless script — committed stamps are
goldens and move only in re-bless commits; stamps in the wild are un-regenerable
by us, and the divergence placard (05 §8.4) is their contract."* 09 §3.3's
decoupling claim "hashes protect presets and goldens only — never figures"
stays true and gains a clarifying clause: stamps in shared figures are not
*protection* (nothing gates on them at share time); they are *tripwires carried
by the artifact*, evaluated by whoever loads it. The review's observation that
the re-bless discipline "says nothing about the artifact class the design is
proudest of making shareable" is closed by exactly this step.

#### 2.5 Dependency with the verification cluster's cached-plans option — both ways

09 §6's `C-RECOMPUTE-BUDGET` finding offers option (b): cache solved plans in
the FigureSpec so consumers replay integration (~1 engine run/line) instead of
re-solving (~34–600 runs). The dependency runs both directions:

- **Sharing → verification.** The skew stamps are the safety net that makes
  cached plans honest. Load procedure when a line's source carries a cached
  resolved plan: (1) integrate the cached plan (cheap); (2) compare
  outcome/result_hash against `expected`; (3) on `story`-tier mismatch, fall
  back to a full re-solve from the solve spec and placard the divergence
  (*"the shared plan no longer solves this corner under engine X; re-solved"*).
  Without stamps, a cached plan drifts silently across re-blesses — the exact
  defect class §8.5 names. The stamp is therefore the *trigger* that decides
  cheap-replay vs full-resolve, and the cached-plans option must not ship
  without it.
- **Verification → sharing.** If cached plans are adopted, `expected.result_hash`
  is computed over the verdict of the *integrated cached plan* (the thing
  consumers actually run), the FigureSpec grows by the resolved plans
  (~10²  bytes/line; the ~40-byte claim covers stamps only), and D6 survives
  because plans are inputs — 05 §7 already says "Given `road` + `source`, the
  engine reproduces the trajectory exactly". If cached plans are rejected, the
  skew contract above still stands alone; only the load cost stays at
  C-RECOMPUTE-BUDGET's honest arithmetic. Recorded as user decision 4;
  recommendation: adopt, as an optional `source.resolved_plan` member stamped
  by the same exporters that stamp `expected` (this also converges with the
  agent-UX cluster's `resolved_scenario`-in-envelope fix — one object, two
  consumers).

#### 2.6 Placement

- 05 §8.1: FigureSpec shape (as above) + the amended "minus every computed
  member" sentence; new **05 §8.4 "Version skew and the divergence placard"**
  owning the tier algebra, the placard wording, and the stamping rule.
- 05 §7: `skew` member appended to FigureResult (append-only, per 05 §2.2's
  own rule).
- 09 §3.3: step (f); 09 new tests (§5 below).
- 08 §3 verb table, `export` row: "always stamps `engine_semver` + per-line
  `expected`" (one clause). 08 §7.2: no new error codes.
- 01 §8 placard policy: the divergence placard joins the enumerated examples
  (one line; shared surface with the POV cluster's gaze-placard addition).
- 07 §6.2: loading step gains "…recomputed on entry, then compared against the
  spec's stamps; divergence renders the 05 §8.4 placard" (one clause).

---

### 3. `--jitter` — the ensemble mode (scoped v2 design note)

#### 3.1 Where it lives

A new final section of `design/08-cli-and-agent-interface.md` — **"Deferred
design notes (non-normative except the layering law)"** — hosting this note; 08
owns it because the RNG lives at the CLI layer. `design/01` gains the doctrine
paragraph (§3.4 below) in §6. `06` gains nothing until promotion (the band is
specified here and moves to 06 when the mode is scheduled). The phasing table
(§1) lists it under *deferred, v2*.

#### 3.2 The layering law (normative even while deferred)

> **Randomness never enters `core/`.** The engine remains a pure function of a
> fully-resolved scenario (09 §3.1 unchanged). An ensemble is N ordinary
> deterministic runs of N recorded scenarios; the RNG that generates the N
> perturbations lives in `cli/` (later `viewer/`), is seeded, and every jittered
> scenario is itself a complete, shareable input. D7 is untouched (every band
> edge is derived from engine-integrated lines, never drawn), and D6 is
> untouched (what would be shared is the base spec + `{seed, n, spreads}` —
> inputs — from which any consumer regenerates the identical ensemble).

#### 3.3 Sketch (v2, TUNING throughout)

- **Invocation:** `linelab run … --jitter [N]` with `--jitter-seed <uint64>`
  (default `1`) and `--jitter-spread "<param=spread,…>"` overrides. `N` default
  `JITTER_N = 32` (TUNING). `--jitter` composed with `--gate` is rejected
  `SCHEMA` until gating semantics over ensembles are designed.
- **Perturbation set** (closed at v2 launch; uniform draws on `[−1, +1]·spread`):
  - entry speed, multiplicative: `JITTER_ENTRY_FRAC = 0.05` (TUNING) — ±5 %;
  - `mu`, absolute: `JITTER_MU = 0.08` (TUNING), clamped to `(0, mu_max]`;
  - turn-in station, absolute: `JITTER_TURNIN_M = 2.0 m` (TUNING) — rider
    placement noise.
- **RNG:** splitmix64. Run `k` (0-based) derives `seed_k = splitmix64(seed ⊕ k)`
  and draws in the fixed order *entry, mu, turn-in* — two independent
  implementations produce byte-identical ensembles.
- **Result:** an `EnsembleResult` per jittered line, appended beside (never
  replacing) the base `LineResult`:

  ```
  EnsembleResult = { base_line_id, seed, n, spreads,
                     runs: [ { deltas: {entry_frac, mu, turn_in_m},
                               outcome, terminated: {reason, s},
                               result_hash } ],          // no trajectories retained
                     outcome_histogram: { contained, stopped, wide, runoff, crash },   // Option B words
                     survival,                            // clean-predicate count / n (contained ∧ zero fails)
                     band: [ { s, d_lo, d_hi, alive } ] } // per retained station
  ```

- **Band rendering:** at each retained station `s`, `d_lo/d_hi` = min/max
  lateral offset over runs still alive at `s`; drawn as one neutral-grey
  low-opacity polygon *beneath* all lines. The band is deliberately **not**
  verdict-coloured — it is not a line and D9 stays untouched; the base line
  keeps its verdict colour on top. Terminated runs drop out (the band narrows
  to survivors — honest), and each non-clean run's termination point draws as a
  small neutral mark: the "where the unlucky ones ended" scatter, which is the
  pedagogically loudest pixel of the mode. The legend carries the histogram:
  *"27/32 clean · 5/32 runoff"*.
- **Acceptance (pre-written, run at promotion):** `P-JITTER-DETERMINISM` (same
  seed/N/spreads → identical `EnsembleResult` hash); `P-JITTER-PURITY` (the
  existing import-graph lint extended: no RNG import beneath `cli/`/`viewer/`);
  `A-JITTER-LATE-APEX` — on the canonical corner, the solved late-apex line's
  `survival` ≥ that of a contained early-turn-in line under identical jitter:
  **the book's probabilistic late-apex argument, mechanically pinned.**

#### 3.4 The doctrine acknowledgment (exact paragraph for 01 §6)

> **Variability is the doctrine's actual subject.** The book's argument for the
> late apex is probabilistic, not geometric: reserve exists because the corner
> you planned is never exactly the corner you get — "expect the unexpected" is
> a claim about distributions of entry speed, grip, and placement, not about a
> single run. linelab's engine is deliberately deterministic (09 §3.1); a
> single run therefore shows the *margin* a line banks, and only an ensemble of
> perturbed runs can show what that margin *buys* — how many of the rides you
> might actually have ridden survive on each line. That ensemble mode is a
> deferred design (`08` §deferred, v2); until it ships, the per-sample reserve
> channels (`grip`, lean vs ceiling, sight margin) are the honest single-run
> proxy, and no figure claims more than one run's worth of evidence.

---

### 4. `fit(trace)` — the front door for "grade MY line" (scoped sketch, post-v1)

#### 4.1 Where it lives

A new final section of `design/04-solver-and-authoring.md` — **"Deferred: the
fit front door (post-v1)"** — because fit is an authoring solver (rung (e) of
the ladder when promoted). On promotion: the Trace wire schema moves to 03, the
verb `linelab fit <trace.json> --road <dsl|preset>` enters 08's table, and
`NO_FIT` enters 08 §7.2's closed error vocabulary (flagged now as a designed
future addition so the vocabulary's closedness is not silently broken later).

#### 4.2 Signature and semantics

```
fit(trace, {road, profile?}) → Result<{plan, residual, result}>
```

Search plan-action space — entry speed, turn-in station, decel, roll-on onset,
plus the mistake vocabulary's perturbation axes (roll-rate factor, facet count,
chop offset) — for the plan whose **engine-integrated** line best explains the
observed trace; then grade the fitted plan exactly like any authored plan
(verdict, checks, colour per D9). Objective: station-wise lateral RMS between
the fitted line and the map-matched trace, plus a speed-profile term weighted
`W_FIT_V = 0.3` (TUNING) when a speed channel is present and a lean term
`W_FIT_PHI = 0.2` (TUNING) when a lean channel is present. Search shape: coarse
grid over (turn-in × entry) with nested bisection on decel/roll-on — the same
coarse-then-fine discipline 04 §3 already makes normative.

**Input format** (`linelab-trace/1`):

```
Trace = { format: "linelab-trace/1", source?: "gps"|"logger"|"other",
          samples: [ { t_s,                       // required, strictly monotone
                       lat, lon | x_m, y_m,       // one positional pair required
                       v_ms?, phi_deg? } ] }      // optional logger channels
```

GPS coordinates convert to local metres via a local tangent plane at the first
sample. The **author supplies the road** (DSL or preset): linelab never infers
road geometry from a trace — roads remain authored one-liners, and map-matching
projects each trace point to its nearest centreline station. Typed refusals:
any point farther than `FIT_OFFROAD_M = 10 m` (TUNING) from the centreline →
`NO_FIT` (`trace_off_road`, worst point cited); non-monotone `t_s` → `SCHEMA`.

**Residual semantics — the teaching output:**

```
residual = { rms_lateral_m, max_lateral_m, at_s,
             quality: "tight" | "loose",            // ≤ FIT_TOL vs ≤ FIT_MAX_RMS
             deltas: [ { action_id, field, fitted, vs_ideal, description } ] }
```

`FIT_TOL = 0.5 m`, `FIT_MAX_RMS = 1.5 m` (both TUNING). Above `FIT_MAX_RMS` the
result is a typed `NO_FIT` (`unexplained`): the tool refuses to pretend a ride
was a plan its vocabulary can express. Between the two, the fit returns with
`quality: "loose"` and a rendered placard. `deltas` is what `explain` narrates
against the same road's ideal solve: *"your ride is best explained by a turn-in
6 m early and a roll rate 40 % below profile"* — the residual, not the verdict,
is the coaching payload.

**The drawn line is always the fitted plan's engine-integrated trajectory** —
never the raw trace. The trace may render as *evidence*: a dotted neutral-grey
"observed" underlay with no verdict, no colour, no Sample contract, and no
`stateAt` surface — a new, explicitly non-line draw element. This is the load-
bearing D7 distinction: evidence is displayed as evidence; only engine output is
ever displayed as a line.

**Acceptance (pre-written, run at promotion):** `A-FIT-ROUNDTRIP` — a synthetic
oracle: take a known compiled mistake's own trajectory, downsample and perturb
with seeded test-layer noise, feed to `fit`; the fitted plan recovers the
perturbation within tolerance (fit of an `premature` trace reports turn-in
≈ 6 m early). `A-FIT-REFUSE` — a trace outside the vocabulary (a U-turn) →
`NO_FIT`, never a forced bad fit. `P-FIT-LINE-PROVENANCE` — the rendered line's
samples are byte-identical to running the fitted plan as an ordinary scenario.

#### 4.3 The D7 wording question — both readings drafted

D7 currently: *"no authored paths, the engine produces every drawn line …
There is no `apex` field anywhere in any input schema; plans are id-addressed
action lists …"* and G1's test: *"no input surface accepts path points."* A
trace is path-shaped input, and G1's grep-style test would fail on the Trace
schema. Two readings:

- **Reading A — D7 text untouched.** D7 constrains *plan/scenario schemas*; a
  Trace is not a plan, never enters one, and is consumed upstream by `fit`,
  which *emits* a plan. "Every drawn line is engine-integrated" holds. Cost:
  G1's test wording still contradicts the Trace schema on a literal reading,
  and the invariant's force starts depending on an unstated schema taxonomy —
  the exact "quietly renegotiated" drift the review flagged in D10's wake.
- **Reading B — amend D7 when fit is promoted (recommended).** Append to D7:
  *"D7 constrains **command** input: nothing an author writes may pin where a
  drawn line goes. **Evidence** input — an observed trace submitted for
  explanation through `fit` — is admissible: it is never drawn as a line,
  never enters a plan schema, and the fitted plan it yields is graded like any
  other. The engine still produces every drawn line."* And amend G1's test:
  *"no **plan** surface accepts path points, radii-of-line, or an apex; the
  `fit` door accepts an observed trace as evidence, rendered only as a
  non-line underlay."*

Reading B changes no behaviour before fit ships and is the honest wording after
it does. The misjudgment cluster's believed-road mechanism needs neither
reading (a believed road is *world* input, not path input) — the three input
classes line up cleanly: **worlds** (roads, believed roads), **commands**
(plans, solve intent, constraints), **evidence** (traces). Recorded as user
decision 2.

---

### 5. Acceptance: additions to design/09

- **New §"Phase gates"** (referenced by 00's phasing table): the per-phase exit
  gate lists exactly as tabulated in §1.2, each named test already owned by an
  existing 09 section; the section adds only the *grouping* and the rule that a
  phase is exited by one green run of its full gate list on CI, recorded in the
  phase-exit commit message.
- `C-SKEW-DETECT` (contract) — a committed FigureSpec fixture with deliberately
  stale stamps (an old outcome and hash) recomputes to `skew.tier: "story"`
  with the correct per-line tiers, and the placard string renders in both the
  viewer view-model and the SVG export.
- `C-SKEW-CLEAN` (round-trip) — `export --as share-url` → decode → recompute on
  the same engine/runtime → every line `tier: "match"`, `skew.tier: "match"`,
  no placard. This extends the existing D6 share round-trip in 09 §4 rather
  than duplicating it (one fixture, one more assertion).
- `C-SKEW-NEVER-BLOCKS` (property) — for any valid stamps, loading yields a
  complete FigureResult with every line's full trajectory and verdict; skew
  influences only `skew` and rendering, never computation.
- Bless-script extension test — the tripwire of 09 §3.3 covers the stamps in
  committed figure fixtures: recomputed stamps must equal committed stamps
  outside a re-bless commit.
- Deferred (pre-written, run at each promotion): `P-JITTER-DETERMINISM`,
  `P-JITTER-PURITY`, `A-JITTER-LATE-APEX` (§3.3); `A-FIT-ROUNDTRIP`,
  `A-FIT-REFUSE`, `P-FIT-LINE-PROVENANCE` (§4.2).

---

### 6. Decision drafts and user decisions

**Decision drafts** (editor numbers):

1. **Phased delivery: the figure spine ships first.** Build order is normative
   in 00: v0.1 = core/road/sight/plan/solve/mistake/render-topdown(true)/CLI +
   true-scale presets (G1, G4, G6, G7, G8); v0.2 = stepper + `stateAt` +
   `serve`; v0.3 = POV + compare; the diagram projection implementation is
   deferred until realistic-road figures appear (design kept). D1 names
   architecture and destination, not sequence. The phase-gating law keeps D8
   airtight across phases: the printed schema is the phase, and design-of-
   record tokens not yet shipped reject `SCHEMA` with a `deferred` pointer.
2. **Share URLs carry an engine stamp and per-line expectations; divergence
   renders a placard.** Exporters stamp `engine_semver` + per-line
   `{outcome, result_hash}` into FigureSpec (~40 bytes/line); consumers
   recompute per D6, compare, and render a first-class placard on story-tier
   divergence — never an error, never a block. Re-bless commits bump minor and
   re-stamp committed fixtures (step (f)). Stamps are falsifiable predictions,
   not computed members: D6's inputs-only wire is intact.
3. **Randomness stays out of the core; variability ships as ensembles of
   deterministic runs (v2).** The `--jitter` mode is a seeded CLI-layer RNG
   producing N complete scenarios, each an ordinary deterministic engine run;
   the rendered band is derived from engine-integrated lines only. Doctrine
   acknowledgment lands in 01 now; the mechanism is a deferred design note in
   08 with its acceptance tests pre-written.
4. *(contingent on user decision 2 = Reading B, adopted only when fit is
   promoted)* **Evidence input is admissible; command input stays forbidden.**
   D7 is restated over three input classes — worlds, commands, evidence — with
   traces admissible as evidence through `fit(trace) → {plan, residual}`,
   never drawn as lines; every drawn line remains engine-integrated.

**User decisions** (with recommendations — also returned in the structured
summary):

1. **D1 reconciliation:** clarifying amendment (recommended) or the drafted D1a
   supersession note. Amendment preferred: nothing v0.1 builds is anything D1
   superseded, and `C-ONE-CORE` enforces D1's substance from phase one.
2. **D7 wording:** Reading A (text untouched, taxonomy implicit) or Reading B
   (amend D7 + G1 at fit promotion). Recommend B — it is the honest wording
   and prevents the "quietly renegotiated invariant" drift the review already
   caught once with D10.
3. **`run --gate` on story-tier skew:** exit 3 (recommended — a teaching
   artifact that no longer teaches its captions is a doctrine-tier failure in
   CI) or exit 0 with `skew` only. Shared surface: must be reconciled with the
   exit-code/`expect_fail` cluster's rework of `--gate`.
4. **Cached resolved plans in FigureSpec** (C-RECOMPUTE-BUDGET option (b)):
   adopt (recommended) with the skew stamps as the mandatory safety net
   (stamp-mismatch triggers re-solve + placard), or reject and keep full
   re-solve on load. Final ownership of the budget re-scope stays with the
   verification cluster; this cluster's requirement is only conditional — *if*
   plans are cached, stamps are mandatory.
