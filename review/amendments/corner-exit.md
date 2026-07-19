## ENGINE CORNER EXIT — turn-in lifetime, steering hand, and exit straightening (cluster: corner-exit)

> **EDITORIAL RECONCILIATION (binding) — 2026-07-19 editor pass.** Merged against the
> thirteen sibling amendment sections per the three reconciliation audits (grammar
> surfaces, decision law, result contracts). Where the body below disagrees with a
> bullet, the bullet wins.
>
> - **Merged steering enum.** The four-state machine, transition table, and release law
>   below are normative, with two token renames for homonym hygiene: this section's
>   `track` (the turn-in commitment) is spelled **`commit`**, and `neutral` is spelled
>   **`track`** and takes position-channel's bounded lane-keeping tracker law
>   (`PHI_TRACK_AUTH_DEG = 5.0`) as its guidance law — `target_lean ≈ 0` on straights
>   falls out of the feedforward, so the straight-line goldens are behaviour-identical.
>   Recorded enum: `steer_state ∈ "track"|"commit"|"unwind"|"position"` (05 §2.1), plus
>   `lat_action_id`. `unwind` is unchanged: profile-rate roll toward upright, handing to
>   `track` at `|phi| ≤ EPS_UNWIND_DONE_DEG` with the f-snapshot as `f_hold`. *(Editor
>   override, recorded: one audit proposed the unwind→tracker handoff at
>   `PHI_TRACK_AUTH`; that breaks the ln-sec capture formula's exactness, so the handoff
>   stays at `EPS_UNWIND_DONE_DEG`.)*
> - **Completed `position` holds.** The "position completes → neutral" transition is
>   deleted: on completion the channel hands to `track` with `f_hold` = the achieved `f`
>   (a target-0 state cannot hold a line on curvature; V2 hold-wide depends on holding).
> - **`release` is THE commitment-end event** on every line with a released `turn_in`
>   (this section wins the token). position-channel's `commit_end` is retired; the V2
>   vis-hold release is the verdict field `sight.holds[].hold_release_s`, never an
>   event kind.
> - **`hand` spells `L|R`** on every surface meaning road/corner handedness —
>   `turn_in.hand` included (scene-vocabulary's alphabet). `left|right` remains
>   exclusively the rider-relative occluder-side vocabulary. Full words on a `hand` key
>   reject `SCHEMA` with a rewrite hint. `handSign("R") = +1`.
> - **Verdict placement.** `release_s` lives inside the per-commitment entries
>   `corners[].turn_ins[] = [{s, lean_commit_deg, hand, release_s|null}]` (misjudgment
>   owns the corners[] reshape; the scalar `turn_in_s`/`apex_s` block is deleted).
> - **REQ-STEER-OWNERSHIP slot 1 (corrective)** applies **within the corrective shadow
>   run only** — the corrective is a branched shadow (corrective-offroad wins); the main
>   line's steering channel never sees it.
> - **Controller per-step output** (02 §3 merged sentence): the machine produces
>   `steer_state` + `target_lean`; the controller computes `roll_cmd =
>   clamp((target_lean − phi_prestep)/dt, ±roll_rate)` once per step (ZOH across RK4
>   stages, runwide-physics) and returns `{steer_state, target_lean, roll_cmd, a_cmd,
>   a_cmd_rate}`. Chop freeze overrides `roll_cmd = 0` without changing `steer_state`.
> - **Outcome law (Option B, doctrine-catalogue).** Pinned golden outcomes respell:
>   `clean` reads outcome `contained` + quality `good` (`clean` is the derived
>   predicate: contained ∧ zero applicable check fails).
> - **Mistake kinds respelled** in place per the project rename: `premature` = the
>   canonical runs-wide error (nee `early_apex`); `premature_contained` = the eased
>   contained variant (nee the old `premature`).
> - **Sample/CSV appends** land in 05 §2.1's single merged block; pinned CSV order after
>   `limit_y`: `sight_ride_m, steer_state, lat_action_id, su_sustained, su_transient,
>   a_cmd_rate, below_validity`.

Closes review §2.1 (the engine cannot finish a corner — no lean-unwind exists) and the
§1 fig 8.6 steering-sign gap ("`turn_in` has no sign, so alternating-hand esses cannot
even be commanded"). One mechanism carries all of it: a **steering-channel state
machine** in the controller, with a **heading-capture release** rule ending every
turn-in commitment, and a **per-corner hand binding** rule giving every `turn_in` a
direction. Everything below is engine/controller semantics — no authored path enters
any schema; the drawn exit, like the apex, remains a measured output (D7 intact).

---

### 1. Mechanism A — the steering-channel state machine (02 §3)

The controller currently returns `{ target_lean, roll_rate, a_cmd }` with `target_lean`
set "by the plan" and no rule for when a `turn_in`'s target stops applying. Replace that
with: **the steering channel has exactly one owner per control step**, determined by a
four-state machine evaluated once per step (ZOH, same cadence as the rest of the
controller). The longitudinal channel (`a_cmd` from `brake`/`throttle`) is orthogonal
and never participates — roll-on and unwind compose freely by construction.

```
steer_state ∈ { "track", "commit", "unwind", "position" }     (closed enum, merged)

track     : the bounded lane-keeping tracker (position-channel's law, authority
            PHI_TRACK_AUTH_DEG = 5.0) holding f_hold. target_lean ≈ 0 on straights.
            Initial state; also the terminal state of every clean exit.
commit(k) : target_lean = handSign(k.hand) · k.lean_deg — turn_in k's commitment.
unwind(c) : target_lean = 0, entered by the release predicate (§1.2) from
            commit; c is the released commitment's governing corner.
position(p): the same tracker slewing to an authored position target
            (position-channel owns the law; REQ-STEER-OWNERSHIP, §5).
```

Transitions (complete; anything not listed cannot occur):

| From | To | Trigger |
|---|---|---|
| `track` | `commit(k)` | integration reaches `turn_in` k's `at_s` |
| `commit(k)` | `commit(k')` | next `turn_in` k' reaches its `at_s` — **supersede**: k' takes the channel immediately, whether or not k released; this is the esses flip and the fifty-pence facet chain |
| `commit(k)` | `unwind(c)` | the release predicate fires (§1.2) — once per commitment |
| `unwind(c)` | `track` | `\|phi\| ≤ EPS_UNWIND_DONE_DEG` — `f_hold` := the f-snapshot at handoff |
| `unwind(c)`/`track` | `commit(k')` | a later `turn_in` reaches its `at_s` |
| `unwind(c)`/`track` | `position(p)` | a `position` action reaches its `at_s` (validation guarantees this cannot happen inside a static commitment window, §5) |
| `position(p)` | `track` | position action completes — the tracker **holds** the achieved `f` as `f_hold` (merged: the hand-to-neutral transition is deleted; holding is what makes hold-wide work) |
| `commit(k)` | `position(p)` | only possible when k's governing corner's `s1` has already passed (stale commitment yields; see §5) |

| Constant | Value | Units | Status |
|---|---|---|---|
| `EPS_UNWIND_DONE_DEG` | `0.25` | deg | `TUNING` — one step of street-profile roll authority (50 °/s × 0.005 s); below it the tracker lands exactly on 0 within one step |
| `EPS_EXIT_DEG` | `1.0` | deg | `TUNING` — exit-event heading-capture deadband (§1.3) |

In `unwind` the existing rate-limited tracker does the work — `roll_cmd =
clamp((0 − phi)/dt, −roll_rate, +roll_rate)` — so the unwind rate **is** the profile
roll rate, no new constant. `slow_steer`'s ×0.3 factor derates the whole profile rate,
so a slow-steer line also unwinds slowly — one perturbation, both edges, as the
one-perturbation rule wants. The `phi_dot_su` stand-up term already pushes toward
upright and vanishes at `phi = 0` (tanh envelope), so it can only *speed* an unwind,
never fight it or cross zero.

#### 1.1 Governing corner

Every `turn_in` has a **governing corner**, resolved at `validate` (static, recorded in
the frozen scenario):

- `hand` omitted → the corner with the smallest `s1 > at_s` (the next corner to be
  exited), and the action inherits that corner's hand.
- `hand` explicit → the corner with the smallest `s1 > at_s` **whose hand equals the
  action's hand**.
- No such corner → typed rejection `BAD_RANGE`, reason `no_governing_corner`, `at`
  naming the action id (e.g. "turn_in `t2` hand=R at s=31.4: no right-hand corner
  at or after this station").

This binding rule is why chained solving works at zero-gap esses: `turn_in` for corner
n+1 may legally sit at a station still inside corner n (riders initiate the flip
early); with `hand` explicit it binds past corner n to corner n+1, and its commitment,
release, and exit heading are all keyed to corner n+1. Both `tangent_inside` and
explicit-`lean_deg` targets use the same binding; `tangent_inside` defers only the
magnitude to the solver, never the direction.

#### 1.2 The release predicate (heading capture)

While in `track(k)` with governing corner `c`, at each control step compute:

```
psi_exit(c)      = road heading at c.s1                       [rad]  (from RoadModel)
dpsi_rem         = handSign(c.hand) · wrapToPi(psi_exit(c) − psi)    [rad]
t_unwind         = |phi| / roll_rate                          [s]    (roll_rate in rad/s)
v_eff            = max(V_MIN_RHS, v + 0.5 · a_clip · t_unwind)[m/s]  (first-order speed prediction)
dpsi_unwind      = (G / (v_eff · roll_rate)) · ln(1 / cos(|phi|))    [rad]

RELEASE  ⇔  dpsi_rem ≤ dpsi_unwind
```

`dpsi_unwind` is the closed-form heading accrued during a constant-rate unwind:
`∫ G·tan(phi)/v dt` with `phi(t) = phi₀ − roll_rate·t` gives
`(G/(v·roll_rate))·ln(sec phi₀)` exactly. Release fires when the remaining road heading
to the corner's exit equals what the unwind itself will accrue — so lean reaches zero
just as heading reaches `psi_exit(c)`, and the out-in-out exit is *derived*, not
asserted. `dpsi_rem ≤ 0` (heading already past exit — over-rotated) releases
immediately. The predicate re-evaluates every step until it fires, then is done: one
release per commitment, no re-entry into `track` without a new `turn_in`.

**Worked numbers at book90 scale (verifying the review's arithmetic).** Street profile
(`roll_rate = 50 °/s = 0.8727 rad/s`), solved apex lean ≈ 28°, v ≈ 9 m/s:

- Residual yaw if never released: `psi_dot = G·tan 28°/9 = 33.2 °/s` — the review's
  ~33 °/s is **confirmed**.
- Uncorrected consequence: path radius `v²/(G·tan 28°) = 15.5 m`; the "clean" line
  crosses the half-corridor (1.35 m) just **6.5 m into book90's 16 m exit straight**
  and curls 59° / 7.5 m laterally by road end. Self-verification could never return
  clean; every figure's exit was indeed asserted, not derivable.
- With the release rule: `dpsi_unwind = 8.9°`, `t_unwind = 0.56 s`, ≈ 5.0 m of travel.
  Release fires with 8.9° of heading still to accrue; capture completes on the exit
  straight with lean at zero.
- Prediction error bound: with a 2 m/s² roll-on active through the unwind, the
  constant-v accrual overestimates by 0.52°; the `v_eff` refinement shrinks that to
  ≪ `EPS_EXIT_DEG = 1.0°`. Even an aggressive 5 m/s² drive leaves ≈ 1.2° one-shot
  error, and since the predicate re-evaluates until it fires, only post-release speed
  change contributes. Decel during unwind (brake-at-lean, a mistake regime) makes the
  stand-up term *assist* the unwind — capture is early, never late, and the geometry
  plays out honestly.

**Why not the review's simpler "commitment ends at corner end" (deviation, with
reason).** A release pinned to `c.s1` is a coincidence machine at exactly the scale
that matters: the ideal line's turning extends past `s1` (its path radius 15.5 m >
road's 12 m; heading is still short of `psi_exit` at `s1`), while an early-apex line
over-rotates before `s1`. A station trigger therefore leaves an O(5–10°) heading error
of either sign, which at 9 m/s is an O(1–2.5 m) lateral error on a 16 m exit — the same
defect class §2.1 exists to remove. The heading-capture rule costs one closed-form
formula and is scale-free: no TUNING station, works unchanged on C30, book90, and
esses. "Next steering action" supersession is kept exactly as the review proposed.

**The mistakes fall out unchanged.** `premature`: the committed lean consumes the
heading budget early → release fires *early*, deep inside the corner → the bike
straightens onto exit heading from an inside position while the road still curves away
→ `f` climbs → wide/runoff. That is fig 8.1's red-line geometry, emergent. `premature_contained`
(deferred target, eased lean): captures near the end, stays contained. `slow_steer`:
heading accrues too slowly, release comes late or never — the commitment persists to
termination and the line leaves the road mid-corner still leaned (endpoint semantics
owned by the termination cluster). Double apex: after touch one, `psi_exit` is still
far, so the predicate stays silent and the inter-touch drift remains roll-on widening
per 01 §5; touch two supersedes; release fires once, near the true exit.

#### 1.3 Exit-event and figure-end semantics

- The `exit` event (05 §5, measured post-hoc) gets its arithmetic pinned: first station
  at/after the apex where `|wrapToPi(psi − psi_exit(c))| ≤ EPS_EXIT_DEG`. 01 §4.1's
  prose definition gains the deadband.
- A new event kind **`release`** (kind set in 05 §5 is closed — this is a design-change
  append) marks the release station/time per commitment; the stepper gets a "step to
  release" bookmark for free, and the controls strip can shade the unwind band.
- At figure end, a clean line reaches `road_end` in `track` (lane-keep) with `|phi| ≤
  EPS_UNWIND_DONE_DEG` on the exit straight and heading error ≤ `EPS_EXIT_DEG` — the
  termination cluster may rely on "clean lines terminate upright" (stated here as a
  cross-cluster guarantee).
- At chain boundaries, if `turn_in(n+1)` starts before corner n's release, **no unwind
  occurs** — supersession rolls the tracker continuously through zero toward the
  opposite sign (0.56 s + 0.56 s ≈ 1.1 s, ≈ 10 m of travel for a 28°→−28° street flip;
  the chain cluster's solver must fit flips of that length, and link-continuity checks
  grade the handoff — their surface, not this one).

---

### 2. Mechanism B — signed steering via `hand` (03 §6.1)

Sign convention, stated once and shared system-wide (02 §2 already fixes the frame):
**y-down world frame, `+kappa` = right-hand turn; `phi` and `cmd_lean` are positive
leaning right**. Define `handSign("R") = +1`, `handSign("L") = −1` — the same
resolution family as the occluder `sideSign` rule. Merged vocabulary split: `hand`
spells `L|R` everywhere it means road/corner handedness (road DSL, Segment wire,
preset `hand=`, and this field); `left|right` is exclusively the rider-relative
occluder-side vocabulary.

Wire schema change (03 §6.1 `turn_in` row):

```
| turn_in | target: "tangent_inside" | {lean_deg ∈ (0, 90)};  hand?: "L"|"R" |
```

- `lean_deg` stays a magnitude in `(0, 90)` — authors think "lean into the corner";
  direction never rides in the number. This keeps the hand-independence property that
  made `f` the doctrine coordinate: mirroring a scene stays a one-token road change
  plus (at most) flipped `hand` tokens on explicit plans.
- `hand` omitted → inferred per §1.1 (next corner). Single-corner scenes and every
  solver-authored plan on them need no new syntax; alternating-hand esses are
  commandable the moment each `turn_in` sits before its corner's `s1` — and where the
  chain solver must place a flip *inside* the previous corner, it writes `hand`
  explicitly and the binding rule (§1.1) carries it past the intervening corner.
- Spellings: wire field `hand`; scene-text/CLI plan-action token `hand=L|R`
  (the flags cluster owns the enclosing `--turn-in` spec grammar; this token is the
  reserved name they must use; full words `left|right` on a `hand` key reject
  `SCHEMA` with a rewrite hint). `explain turn_in` must state the inference rule.
- **Contradiction handling (deviation from the review's "validate the contradiction",
  with reason):** once `hand` participates in governing-corner *binding*, a
  contradictory sign is unrepresentable — an explicit hand binds to the next matching
  corner or is rejected `BAD_RANGE / no_governing_corner`. The failure mode is typed
  and the semantics need no arbitration table. A deliberate wrong-way steer (swerve,
  out-flick) is thereby inexpressible in the wire plan for v1 — flagged as a user
  decision below. The `--check` scene lint additionally emits an advisory note when a
  bound `turn_in` skips over an intervening opposite-hand corner (probable authoring
  typo); lint notes are advisory, `validate` stays hard-errors-only (D8 untouched).
- The solved plan (04 §4.2) is rewritten by every solver to the fully explicit form:
  `turn_in` carries `{lean_deg, hand}` after solve — `tangent_inside` never survives
  into a self-verified wire plan. Two implementers reading a solved envelope see the
  same signed commitment.
- D8 effectuality: `hand` is trivially effectual (flipping it changes the governing
  corner or produces a typed rejection); it joins the effectuality enumeration in 09 §8.

---

### 3. Placement (doc-by-doc, with the sentences displaced)

| Doc & section | Change |
|---|---|
| `02 §3` (rider model) | New subsection **3.1 "The steering channel and the turn-in lifetime"**: the state machine (§1), governing-corner reference, release predicate with derivation and the book90 worked numbers. The sentence "The controller … returns `{target_lean, roll_rate, a_cmd}`" becomes the merged output sentence: "… returns `{steer_state, target_lean, roll_cmd, a_cmd, a_cmd_rate}`; `target_lean` is produced by the steering-channel state machine (§3.1), never read raw off the plan; `roll_cmd = clamp((target_lean − phi_prestep)/dt, ±roll_rate)` computed once per step (ZOH across RK4 stages, runwide-physics)." |
| `02 §2` | Append to the frame sentence: "`phi` and `cmd_lean` are positive leaning right (`handSign(right) = +1`)." No EOM change — `psi_dot = G·tan(phi)/v` is already sign-correct for signed `phi`. |
| `02 §8` | C30 pinned-quantity list gains: release station, exit heading error (≤ `EPS_EXIT_DEG`), final lean at road end (≤ `EPS_UNWIND_DONE_DEG`). New companion golden **`C30-LR`** (§4 below). |
| `03 §6.1` | `turn_in` row gains `hand?`; new paragraph "Turn-in lifetime and hand binding" stating §1.1–§1.2 normatively (predicate formula lives in 02; 03 states binding + rejection). **Replaces** the position-overlap sentence: "A `position` action whose transition window overlaps an active `turn_in` commitment is rejected…" → "…overlaps a `turn_in`'s **static commitment window** `[at_s, s1 of its governing corner]` is rejected (`INEFFECTUAL`, `position_overlaps_turn_in`)." Error-reason list gains `BAD_RANGE / no_governing_corner`. |
| `01 §4.1` | Exit definition gains the deadband: "…where heading has returned to the road's exit heading **within `EPS_EXIT_DEG = 1.0°` (TUNING)**." |
| `04 §4.2` | "The solved plan is the canonical four actions — brake…, deferred `tangent_inside` turn-in, …" → "…brake…, an **explicit signed turn-in (`lean_deg` + `hand`, rewritten from `tangent_inside` by the solver)**, maintenance crack, drive roll-on — and self-verification now *includes the exit*: the released, unwound exit straight is part of the verified trajectory." Note added: the roll-on/exit-f bisection target is now a real emergent quantity (the unwind exists); bracket re-tuning stays with the solver-constants cluster. |
| `04 §5` | One sentence: chained turn-ins interact by supersession (§1); the solver may place `turn_in(n+1)` inside corner n by writing `hand` explicitly. |
| `05 §2.1` | `phi` row: "Lean angle, signed by turn direction" → "Lean angle, signed: **+ = right-hand lean (y-down frame)**"; same note on `cmd_lean`. Commanded-controls block **appends** `steer_state: "track"\|"commit"\|"unwind"\|"position"` (interpolation rule `hold`) and `lat_action_id` — the engine knows them every step, so the result records them; the HUD's exit story ("released here, unwinding") reads straight off it. CSV columns land in 05 §2.1's single merged append block (pinned order after `limit_y`). |
| `05 §5` | Event kinds gain `release` (design-change append to the closed set). |
| `05 §6.3` | `release_s` lands **inside** each `corners[].turn_ins[]` entry (`{s, lean_commit_deg, hand, release_s|null}`) — misjudgment owns the corners[] list reshape; release is per-commitment, not per-corner. |
| `09` | §3.4 gains `P-UNWIND-CAPTURE`, `P-UNWIND-NOCROSS`; §3.2 goldens gain the C30 exit assertions and `C30-LR`; §8 effectuality enumeration gains `hand` (§4 below). |

---

### 4. Acceptance (design/09 additions)

**Goldens (blessed numerics, tolerances from the 09 §3 table):**

- **`C30` (extended)** — the existing canonical golden additionally pins: `release`
  event station; at the `exit` event `|heading_err_deg| ≤ 1.0`; at `road_end`
  `|phi| ≤ 0.25°` and `f` inside the usable corridor; outcome `contained`, quality
  `good` (the derived `clean` predicate). This is the review's "golden asserting C30's
  exit straightens".
- **`C30-LR` (new, two-corner alternating hand)** — road
  `lane 3.5 | S 35 | R 30 ^70 | S 10 | L 30 ^70 | S 25`, street profile, entry
  70 km/h, authored as an **explicit wire plan** (rung (c)) with two `turn_in`s —
  `hand` omitted on both, exercising pure inference — so the golden isolates engine
  steering semantics from `chainedSolve` (whose own fixtures belong to the chain
  cluster). Pins: governing corners resolve to `c1`(right)/`c2`(left); `phi` crosses
  zero exactly once between the corners (sign sequence + → 0 → −, monotone through the
  flip); a `release` event exists for the final commitment; corner 2's exit straightens
  under the same three assertions as `C30`.

**Property tests (fuzzed, per 09 §3.4 conventions):**

- `P-UNWIND-CAPTURE` — for every solver-returned clean single-corner line over fuzzed
  in-scope roads/speeds: a `release` event exists; at the `exit` event
  `|heading_err_deg| ≤ EPS_EXIT_DEG`; `|phi| ≤ EPS_UNWIND_DONE_DEG` from unwind
  completion to `road_end` (absent later plan actions).
- `P-UNWIND-NOCROSS` — after release, `sign(phi)` never flips before the unwind→`track`
  handoff: the unwind approaches upright monotonically and never steers past it.
- `P-STEER-OWNER` — at every retained sample exactly one steering owner per the
  transition table; `steer_state` is consistent with `lat_action_id`
  (`commit`/`position` name their owning action; `unwind` carries
  `lat_action_id = null`; `track` carries null outside a completed-position hold).
- Effectuality (09 §8, D8): flipping an explicit `hand` on a two-corner fixture
  observably changes the trajectory (different governing corner) or yields
  `BAD_RANGE / no_governing_corner`; a `turn_in` with no corner ahead is rejected the
  same way, never silently neutral.
- Validation vectors: (i) `hand` omitted infers next corner; (ii) explicit `hand`
  binds past an opposite-hand corner; (iii) no matching corner → typed rejection;
  (iv) `position` overlapping a static commitment window still rejected
  `INEFFECTUAL / position_overlaps_turn_in` under the sharpened window definition.

---

### 5. Cross-cluster requirement (for the editor to reconcile)

**REQ-STEER-OWNERSHIP** — the steering channel has exactly one owner per instant, with
precedence: *(1)* corrective shot when armed — **within the corrective shadow run
only** (the corrective is a branched shadow per corrective-offroad; the main line's
channel never sees it), *(2)* an unreleased `turn_in` commitment whose governing
corner's `s1` has not passed, *(3)* a `position` action inside its window — including
one that starts during an unwind or over a stale (past-`s1`) commitment: **the position
action takes the channel; the unwind, if incomplete, is subsumed by the position
guidance law, which terminates at its target `f` with zero lean commitment and hands
the channel to `track`, holding the achieved `f` as `f_hold`** — *(4)* `unwind`,
*(5)* `track`. Validation guarantees case
(3) never collides with case (2) before `s1` (the static-window rejection). The
position cluster owns the guidance law's internals; this requirement pins only the
handoff points, the starting lean it must accept (whatever `phi` the unwind left), and
the terminal condition. The V2 chained hold-wide ("exit of corner n steers toward the
hold of corner n+1") is exactly case (3) following a release — legal by construction
under the sharpened window.

---

### 6. Contract impact (exact shapes)

- **Sample** (05 §2.1, commanded-controls block, append-only):
  `steer_state: "track" | "commit" | "unwind" | "position"` — interpolation `hold`;
  plus `lat_action_id: string | null` (hold). CSV columns land in the single merged
  post-`limit_y` order pinned in 05 §2.1.
- **Event**: kind set gains `"release"`; shape unchanged
  (`{kind:"release", s, t, corner_id, action_id}` — `action_id` = the released
  `turn_in`). Emitted on **every** line with a released commitment, vis-governed or
  not.
- **Verdict**: each `corners[].turn_ins[]` entry carries `release_s: number | null`
  (null when the commitment never released — itself diagnostic: a persisting
  commitment is the slow-steer/deep signature).
- **Wire plan**: `turn_in.hand?: "L"|"R"`; solved plans always carry it
  explicitly.
- **Errors**: no new codes; `BAD_RANGE` gains reason `no_governing_corner`;
  `INEFFECTUAL / position_overlaps_turn_in` retained with the static-window
  definition.
- **Constants**: `EPS_UNWIND_DONE_DEG = 0.25` (TUNING), `EPS_EXIT_DEG = 1.0` (TUNING).
  No new profile constants — the unwind reuses `roll_rate`.

---

### 7. Decision drafts (editor assigns numbers)

- **Draft: "Turn-in commitments end by heading capture."** A `turn_in`'s lean
  commitment ends at the next steering action or at the heading-capture release —
  the first step where remaining road heading to the governing corner's exit falls to
  the closed-form unwind accrual `(G/(v_eff·roll_rate))·ln(sec|phi|)` — after which
  the tracker unwinds to upright at the profile roll rate. The out-in-out exit, the
  early-apex run-wide, and the esses flip all become derivable outputs of one
  controller law; no station constant, no authored exit. Supersedes the implicit
  "commitment lives forever" of the prior controller text.
- **Draft: "Steering direction is a per-corner binding, not a sign."** `turn_in`
  gains optional `hand ∈ L|R`; direction defaults to the next corner's hand and
  an explicit hand binds to the next matching corner or is refused
  (`BAD_RANGE / no_governing_corner`). Lean magnitudes stay unsigned; `handSign`
  (with `+phi` = right lean in the y-down frame) is the single conversion point,
  shared with the occluder `sideSign` family. Contradictory signs are structurally
  unrepresentable rather than validated case-by-case.

### 8. User decisions

1. **Should a deliberate wrong-way steer be authorable in v1?** The binding rule makes
   a counter-hand `turn_in` inexpressible (it binds forward to a matching corner or is
   refused). Recommendation: keep it inexpressible — Chapter 8 doctrine never steers
   away from the corner, mistakes come from the compiler, and re-admitting it later
   (e.g. a `swerve` action for hazard-avoidance scope) is an additive design change,
   not a breaking one.
2. **Heading-capture release vs the review's corner-end release.** The predictive
   formula puts a small piece of rider "intelligence" in the controller; a purist
   reading might prefer the dumber station trigger. Recommendation: heading capture —
   the arithmetic above shows a corner-end release misses exit heading by O(5–10°) at
   book90 scale (an O(1–2.5 m) lateral error on a 16 m exit), i.e. it fails the very
   defect §2.1 reports, and it needs per-scale tuning the capture rule doesn't. The
   formula is disclosed, deterministic, and no more "authored" than the rate-limited
   tracker itself.
