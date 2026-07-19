## Cluster: Position-Action Physical Channel (`position-channel`)

> **EDITORIAL RECONCILIATION (binding) — 2026-07-19 editor pass.** Merged against the
> thirteen sibling amendment sections per the three reconciliation audits. Where the
> body below disagrees with a bullet, the bullet wins.
>
> - **Merged steering machine.** This section's two-state `track`/`commit` arbitration
>   is subsumed by the merged four-state machine (corner-exit section, landing in 02
>   §3.1): `steer_state ∈ "track"|"commit"|"unwind"|"position"`. This section's tracker
>   law is the guidance law of `track` (lane-keep / hold `f_hold`) **and** `position`
>   (slewing to an authored target, named by `lat_action_id`); `commit` keeps this
>   section's word for the turn-in commitment; corner-exit's `unwind` remains a
>   **distinct bridge state** — a 5°-capped tracker cannot unwind a 28° commitment at
>   the release law's assumed constant rate — rolling at the profile rate and handing
>   to `track` at `|phi| ≤ EPS_UNWIND_DONE_DEG` with the f-snapshot as `f_hold`.
>   `lat_mode` is **retired** as derivable (`commit` ⇔ `steer_state == "commit"`);
>   `lat_action_id` is kept.
> - **`commit_end` is retired as a token.** The commitment-end event is corner-exit's
>   `release` (or the superseding `turn_in`). The validation-time static span is
>   `[turn_in.at_s, s1 of the governing corner]` — i.e. `s_commit_end_static :=`
>   governing-corner `s1`.
> - **Arbitration precedence** amended per REQ-STEER-OWNERSHIP: `commit` wins until
>   `release` or its governing corner's `s1`; a stale (past-`s1`) commitment yields to
>   `position`.
> - **Hash law.** Appended Sample fields **never** move `result_hash` by themselves
>   (`result_hash` = canonical verdict minus `{result_hash, diagnosis, cache, skew}`
>   plus the resolved plan — agent-interface's formula). The re-bless this section
>   schedules is still required, but because the newly defined lane-keeping default
>   changes verdicts; it lands in the ONE consolidated re-bless commit (09 §3.3).
> - **D8 harness.** verification owns it: one file `verify/effectuality.json` with
>   verification's row schema `{surface, field, fixture, perturbation, effect_class,
>   expect}`; `T-D8-ENUM` retires for `T-D8-EXHAUSTIVE`; this section's `T-POS-*` rows
>   and `FX-POS-*` fixtures migrate as table entries; the `presentation` category maps
>   to effect_class `render`. The `effectAt()` difference predicate stays owned here.
> - **Anchor grammar.** Offsets never ride inside an anchor token (agent-interface's
>   one-anchor-grammar rule); the `--position` example below is respelled accordingly.
> - **Controller output.** The merged per-step shape is `{steer_state, target_lean,
>   roll_cmd, a_cmd, a_cmd_rate}` (runwide-physics); "output shape unchanged" below is
>   superseded — but there is still exactly one lateral channel writing `target_lean`.
> - **Resolved:** U1 stands as recommended (`INEFFECTUAL/position_target_unreachable`).
>   This section **wins** completed-position behaviour: the tracker holds `f_hold`;
>   corner-exit's hand-to-neutral transition is deleted.

Closes review §3 bullet "`position` actions have no physical channel" (CONFIRMED, major), its D8-effectuality corollary in §7 ("the conformance test 03 promises does not exist in 09 and is undecidable as stated"), and — as a consequence of the same mechanism — the lens-wholecloth finding that chained V2 hold-wide contradicts the `position`/`turn_in` overlap rejection on zero-gap esses.

**The one mechanism.** A single bounded **lateral tracker** — a critically-damped lateral-error law that writes the *existing* `target_lean` setpoint through the *existing* rate-limited roll tracker — is the physical channel for four things at once: (a) `position` plan actions, (b) default lane-keeping outside any steering commitment (previously unspecified), (c) V2's hold-wide (which becomes ordinary generated `position` actions, or no action at all, under one shared reachability formula), and (d) — once the corner-exit cluster defines commitment end — the exit-straight lean unwind (the tracker resuming is what levels the bike). One law, one authority cap, one reachability formula reused as validation predicate, `over_m` auto-default, and solver clipping rule. The controller output shape `{target_lean, roll_rate, a_cmd}` is **unchanged** — there is no second steering channel (D3 preserved); arbitration decides which law writes `target_lean`.

---

### 1. Mechanism A — the lateral tracker law (lands in 02 §3.1, new subsection)

#### 1.1 The lateral-channel arbitration state machine

The controller's lateral output `target_lean` has exactly **two** sources — the tracker and the commitment — selected by the merged four-state steering machine (corner-exit section; recorded per sample as `steer_state`; the `lat_mode` enum of the original draft is retired as derivable). Expressed in the merged vocabulary:

| State | Who writes `target_lean` | Entered by |
|---|---|---|
| `track` / `position` | the lateral tracker (this section), holding target `f_hold` (`track`) or slewing to an authored position target (`position`) | run start (`f_hold = rider.start.f`); a `position` action activating (`f_hold = action's f`, state `position`); unwind completing after a released commitment (`f_hold =` the bike's actual `f` at the unwind→`track` handoff, snapshotted — no snap-back) |
| `commit` | the active `turn_in` commitment (law owned by 02 §3.1 / the corner-exit spec; `unwind` bridges from it at `release`) | a `turn_in` action activating |

Transitions:

- **run start** → `track`, `f_hold = rider.start.f`, `lat_action_id = null`.
- **`position` action `p` activates** (first integrator step with `s ≥ p.at_s`, only ever reachable in `track` — validation guarantees no activation inside a static commitment window, §2.4) → `position`, `f_hold = f_tgt(p)`, `lat_action_id = p.id`; emit event `position_start`; on completion → `track`, holding the achieved `f`.
- **`turn_in` activates** → `commit`, `lat_action_id = turn_in.id`; the tracker's state is abandoned (no memory).
- **commitment ends** — the `release` event fires (corner-exit's heading capture) → `unwind` rolls to `|phi| ≤ EPS_UNWIND_DONE_DEG` at the profile rate → `track`, `f_hold = f` at the handoff sample (snapshot), `lat_action_id = null` until the next `position` action.

Arbitration is therefore trivial and total: **`commit` wins until `release` or its governing corner's `s1` (a stale past-`s1` commitment yields to `position`, per REQ-STEER-OWNERSHIP); the tracker owns everything else.** There is never a blended output and never a step with no lateral law in force.

#### 1.2 The tracker law (exact, deterministic)

Evaluated once per integrator step (ZOH, like every controller output). All symbols are existing state/road quantities; `dOf(f)` / the corridor algebra are owned by `road/` (03 §2) and shared with the resampler.

```
d_tgt      = dOf(f_hold)                                  [m]   corridor algebra
e          = d_tgt − d                                    [m]   lateral error, signed in d-space
d_dot      = v · sin(psi − psi_road(s))                   [m/s] lateral closure rate
a_track    = clamp( OMEGA_POS² · e  −  2 · OMEGA_POS · d_dot,
                    −a_lat_pos_max, +a_lat_pos_max )      [m/s²]  (ζ = 1, critical damping, fixed)
kappa_ff   = kappa_road(s) / (1 − d · kappa_road(s))      [1/m] feedforward: hold the offset line
kappa_cmd  = kappa_ff + a_track / v²                      [1/m]
target_lean = clamp( atan(v² · kappa_cmd / G),
                     −PHI_TRACK_AUTH, +PHI_TRACK_AUTH )   [rad]
```

`target_lean` then feeds the **same** rate-limited setpoint tracker of 02 §3 (`roll_cmd = clamp((target_lean − phi)/dt, ±roll_rate)`), and the run-wide disturbance `phi_dot_su` still adds after it. Position never bypasses lean, roll rate, or the friction ellipse.

| Name | Value | Units | Status |
|---|---|---|---|
| `a_lat_pos_max` | `0.8` | m/s² | TUNING, **carried** from 03 §6.1 — the error-correction acceleration budget; also the saturation limit that makes the reachability formula (§2.2) exact |
| `OMEGA_POS` | `2.0` | rad/s | TUNING — tracker natural frequency; ζ fixed at 1 (critical damping, not a knob) |
| `PHI_TRACK_AUTH_DEG` | `5.0` | deg | TUNING — hard authority cap on the tracker's *total* lean (feedforward + correction). `atan(a_lat_pos_max/G) = 4.66°`, so the cap gives the feedforward ~0.34° of headroom on near-straight geometry |
| `EPS_POS_M` | `0.05` | m | = carried `eps_m` — completion position tolerance |
| `EPS_POS_RATE` | `0.05` | m/s | TUNING — completion closure-rate tolerance |

**The D7 guard (normative invariant, joins 02 §5.4-style invariants).** `PHI_TRACK_AUTH_DEG` is what keeps the tracker from becoming a hidden path-follower: at 4.66° of correction authority the tracker can hold a line only where the road demands `a_lat ≲ 0.8 m/s²` (R ≥ v²/0.8 — at 34 km/h, R ≥ 111 m). Entering a real corner (`book90`'s R12 needs 7.4 m/s² at 34 km/h) without a `turn_in`, the tracker saturates at ~4.7° and the bike **runs off** — cornering is possible only through a committed `turn_in`, so apex/exit/run-wide remain emergent and a plan with no `turn_in` still fails honestly. Pinned by property `P-POS-NO-CORNER` (§7). Positioning is an approach/exit, near-straight-domain tool by *physics*, not by prose.

**Interaction with the run-wide slice.** `phi_dot_su` perturbs `phi`; the tracker is feedback, so it counteracts within its authority and no special coupling is specified. A stand-up event stronger than the tracker's authority wins — which is the honest outcome.

**Completion and events.**

- `position_start` — at activation (exact station crossing via the event-bracketing machinery).
- `position_complete` — first sample in `track` for action `p` where `|e| ≤ EPS_POS_M` **and** `|d_dot| ≤ EPS_POS_RATE`. Detail: `{target_f, achieved_f}`.
- `position_shortfall` — **new event kind** (05 §5): emitted at the first sample with `s > p.at_s + over_m` if `position_complete` has not fired for `p`. Detail: `{target_f, achieved_f, deficit_m}`. The tracker *keeps converging* afterward — `over_m` is the declared completion budget, not a switch-off; the shortfall is recorded, never silent. Shortfall alone changes no outcome class.
- After completion the tracker **holds** `f_hold` until the next transition — "hold wide until release" is the law's natural behaviour, not a special mode.

**Determinism and hash consequences.** Every term above is a pure function of `(state, road, plan, constants)`; two implementers converge from the formulas alone. Consequences: (i) approach-phase behaviour is now *defined* (previously unspecified) — on straight approaches with `start.f` default the tracker output is exactly `target_lean = 0`, so existing straight-approach goldens are behaviour-identical; (ii) appended Sample fields alone move **no** `result_hash` (the hash covers verdict + resolved plan, not samples), but the newly defined lane-keeping default changes verdicts on curved approaches — landing this spec therefore joins the ONE consolidated **re-bless migration** per 09 §3.3, enumerated as a cause.

---

### 2. Mechanism B — reachability honesty and validation (lands in 03 §6.1, replacing the "Effectual `position` actions" paragraph)

#### 2.1 The commanded-speed profile `v_cmd(s)` (validation-time, closed form)

Reachability depends on time-in-window, which depends on speed — which is emergent. Validation therefore evaluates the plan's **own longitudinal claim**: `v_cmd(s)` = the speed profile obtained by integrating the plan's commanded `brake`/`throttle` accelerations kinematically along the centreline from `start.speed_kmh`, ignoring the friction ellipse and lateral state. This is deterministic, closed-form (piecewise `v² = v₀² ± 2·a·Δs`), computable from inputs alone — the validator never runs the engine (D8 stays a *validation* property). Define `T_cmd(s₀, s₁)` = the traversal time of `[s₀, s₁]` under `v_cmd` (closed form per piece; if `v_cmd` hits 0 inside the window, `T_cmd = ∞` and the action is trivially reachable-if-anything-else-passes — the bike parks in the window).

#### 2.2 The reachability formula (the single shared formula)

Bang-bang lateral acceleration at `±a_lat_pos_max` with roll transitions paid at the profile roll rate:

```
phi_auth   = atan(a_lat_pos_max / G)                    = 0.0814 rad (4.66°)
t_roll     = phi_auth / roll_rate                       [s]  (profile roll_rate in rad/s)
dd_max     = a_lat_pos_max · max(0, T_cmd/2 − t_roll)²  [m]  achievable lateral displacement
L_req(Δd,v)= 2·v·( sqrt(K_REACH·Δd / a_lat_pos_max) + t_roll )   [m]  (constant-speed closed form;
                                                        under braking, invert T_cmd piecewise)
```

| Name | Value | Status |
|---|---|---|
| `K_REACH` | `1.2` | TUNING — margin covering the tracker's linear settling tail beyond the bang-bang bound |
| `MIN_POS_DD_M` | `0.10 m` | TUNING — displacement below which a generated hold is not worth a wire action (§3) |

`t_roll` (street) `= 0.093 s`; casual `0.233 s`; racer `0.055 s`.

**Worked arithmetic (normative examples, land beside the formula):**

| Case | v | Δd | Result |
|---|---|---|---|
| `book90`, old default `over_m = 15` | 34 km/h (9.44 m/s) | — | `dd_max = 0.8·(0.794 − 0.093)² = 0.39 m` (the review's 0.51 m was the ideal bang-bang without roll losses; either way…) |
| `book90`, reposition `f 0.5 → 0.9` (corridor `3.5 − 2·0.40 = 2.70 m`, Δd = 1.08 m) | 34 km/h | 1.08 m | needs `L_req = 25.8 m` — **not reachable in 15 m**, and not reachable on `book90`'s 12 m entry straight at all at this speed. The old default was fantasy; the honest answer is a typed rejection naming 25.8 m |
| `book90`, canonical V2 hold `f 1.0 → 0.9` (start default is already the doctrinal outside) | 34 / 32 / 28 km/h | 0.27 m | `L_req = 13.8 / 13.0 / 11.3 m` vs the 12 m approach — **reachable only once V1 has governed the speed down** (≤ ~29 km/h). V1-slowing is what makes V2-holding physically possible; the mode's fixpoint order (govern speed, then place the hold) is load-bearing physics, not an implementation detail |
| `C30`, reposition `f 1.0 → 0.5` | 50 / 70 km/h | 1.35 m | `L_req = 42.1 / 59.0 m` vs a 35 m entry straight — unreachable at constant speed; with the canonical 70→50 braking through the straight, `T_cmd = 2.16 s` gives `dd_max = 0.78 m`, still short. C30's canonical goldens carry no `position` action, correctly |

#### 2.3 Schema change: `over_m` defaults to `"auto"`

Plan-action row (03 §6.1 table) becomes:

```
position | f (target lane fraction) or d, over_m?: number | "auto" (default "auto") | lateral repositioning — §6.1
```

`"auto"` resolves at validation to the **whole legal window**: from `at_s` to the nearest of (next `position` action's `at_s`, next `turn_in`'s static commitment start `s_commit_begin`, road end). Because the tracker is feedback (converges as fast as authority allows regardless of window length), a maximal window costs nothing and is maximally reachable — no speed-dependent constant to mis-tune. A numeric `over_m` remains authorable as a completion assertion ("I need to be there *by here*"). The old `default 15` is deleted.

#### 2.4 The validation rules (exact predicates, evaluation order)

Let `p` be a `position` action; window `W(p) = [p.at_s, p.at_s + over_m]` after auto-resolution. Let `f_from(p)` be the **declared lateral history**: walk plan actions by `at_s`; the latest lateral action before `p` is — none → `f_from = rider.start.f`; a `position` action `q` → `f_from = f_tgt(q)`; a `turn_in` → `f_from = undefined` (post-commitment: the bike's position is emergent).

In order, per action (first failure wins; all errors carry `{code, at, message}` with `at` = the action id):

1. **Target domain.** `f_tgt ∈ [0, 1]` (corridor), unless `use_full_width` (then the full-carriageway fraction range). Else `BAD_RANGE`, reason `position_target_outside_corridor`.
2. **Window on the road.** `W(p)` inside `[0, road_end]` else `BAD_RANGE` (carried anchor rules).
3. **Commitment overlap (carried, now decidable).** `W(p)` must not intersect any `turn_in`'s **static commitment span** `[turn_in.at_s, s_commit_end_static]` (requirement on the corner-exit cluster, §8: this span must be a pure function of road + plan). Else `INEFFECTUAL`, reason `position_overlaps_turn_in`.
4. **Position–position overlap (new).** Windows of two `position` actions must not intersect (the earlier action's assertion would be silently superseded — the accepted-but-meaningless class D8 forbids). Else `INEFFECTUAL`, reason `position_overlaps_position`, naming both ids.
5. **Reachability (new — the D8-mandated predicate).** Only when `f_from(p)` is defined (approach-phase and consecutive-position cases — which includes every V2-generated hold):

   ```
   REJECT  iff  K_REACH · |dOf(f_tgt) − dOf(f_from)|  >  a_lat_pos_max · max(0, T_cmd(W(p))/2 − t_roll)²
   ```

   Code `INEFFECTUAL`, reason `position_target_unreachable`; message payload (machine-readable): `{requested_dd_m, achievable_dd_m, over_m, required_over_m}` with `required_over_m` from `L_req` under `v_cmd` — the author's next move is legible from the error (widen the window, slow the plan, or shrink the move).

   When `f_from` is undefined (post-commitment), validation **accepts** — rejecting would require guessing emergent state, and worst-case-corridor rejection would ban legitimate short exit repositions. The honesty backstop is the runtime `position_shortfall` event (§1.2): the miss is typed, recorded, and inspectable, never silent. (User decision U3 confirms this split.)

**Error-taxonomy note.** `position_target_unreachable` sits under `INEFFECTUAL` per this cluster's task direction ("input that would validate but provably do nothing" reads naturally as "provably cannot do what it says"). If the agent-interface cluster's 08 §7.2 decision rule lands `physically-impossible-request → BAD_RANGE`, only the code letter moves; the reason strings and payload specified here are stable either way. Flagged in `user_decisions`.

---

### 3. Mechanism C — V2 hold-wide restated on the channel (lands in 04 §6, replacing the V2 paragraph and the parenthetical in the chained-composition paragraph)

**V2 — hold wide until release (restated).** For each blind corner, V2 emits at most one **ordinary generated `position` action** into the solved plan — same wire shape, same validation, no solver exemptions (D8 uniformity: a solver-emitted plan must validate exactly as an authored one; the solver guarantees this *by construction*, using the same shared formula the validator uses):

1. Candidate window: from the earliest legal station (`max(road start, previous corner's s_commit_end_static)`) to the corner's intended turn-in; `over_m = "auto"`.
2. Compute, with §2.2's formula under the **V1-governed** `v_cmd` (the fixpoint applies V1 before placing holds — the arithmetic in §2.2 shows governing is what makes holding reachable), the reachable displacement `dd_max` from the declared `f_from`.
3. If `vis_hold_f` is fully reachable → emit `position {f: vis_hold_f, over_m: "auto"}`.
4. Else **clip**: `f_hold_clipped = f_from ± dd_max / W_corr` toward `vis_hold_f` (sideSign-resolved). If the clipped displacement `< MIN_POS_DD_M` → **emit no action at all**; the line holds whatever `f` the exit left it at (the `track` state's snapshot semantics make this well-defined), and the release condition is evaluated from the **actual** per-sample `f` — which 04 §6 already promised in prose and now has a mechanism.
5. The release station and roll-on gating are unchanged (V2's release logic is untouched; only the hold's *realization* is respecified).

**Chained composition / zero-gap esses (the wholecloth contradiction, resolved).** On `bookEsses` there is no inter-corner span, so step 4's no-action branch fires: no `position` action exists to collide with any `turn_in` commitment, the wire plan validates, and "holds as wide as the budget reaches" degenerates honestly to "holds where the previous exit put it". The budget-limited-hold carve-out that `A-CHAIN-VIS` must respect (review §7) is now the *specified* step 4, not a contradiction.

The knobs `vis_hold_f` / `vis_margin`, their D10 authorability, and their `INEFFECTUAL`-without-`vis=cautious` rule are unchanged.

---

### 4. Placement (which sentences change where)

| Doc | Section | Change |
|---|---|---|
| `02` | §3 | New subsection **§3.1 "The lateral channel: tracker and commitment"** = §1 above (state machine, law, constants, D7 guard, run-wide interaction). The existing sentence "The controller … returns `{target_lean, roll_rate, a_cmd}`" stands unchanged — §3.1 defines *where `target_lean` comes from*, which no sentence currently does. |
| `02` | §5.4 | Append invariant 6: the tracker-authority invariant (`P-POS-AUTH`/`P-POS-NO-CORNER` prose form). |
| `03` | §6.1 plan-action table | `position` row: `over_m (default 15, TUNING)` → `over_m?: number \| "auto" (default "auto")`. |
| `03` | §6.1 | The paragraph "**Effectual `position` actions (D8 — new).** … possible." is **replaced wholesale** by §2 above (the sentence "steers a lateral drift that reaches the target `f` by `at_s + over_m`" is superseded — `over_m` is now a completion budget, and the drift law lives in 02 §3.1; the `a_lat_pos_max = 0.8` constant moves its normative home to 02 §3.1's table, referenced from 03). The overlap-rejection sentence is subsumed by §2.4 rule 3 (now decidable via the static span). |
| `04` | §6 | The V2 paragraph and the chained parenthetical "(the exit of corner n steers toward … never the unreached target)" are **replaced** by §3 above. |
| `05` | §2.1, §3.2, §5, §8.2 | Contract impact per §5 below. |
| `08` | §4.1 | `--position <spec>` gains a grammar (ratified by agent-interface's one-anchor rule — offsets never ride inside the anchor): token `f=<val> at=<anchor> [offset=<±m>] [over=<m>\|auto]`, e.g. `--position "f=0.9 at=entry:c1 offset=-14 over=auto"`; mirrors wire `{do:"position", id, f\|d, at\|at_s, over_m}`. |
| `09` | §3.4, §8 (+fixtures) | Per §6–§7 below. |

---

### 5. Contract impact (05 — exact shapes)

- **Sample contract, one appended field from this section** (append-only rule honoured; `hold` interpolation) — `steer_state` itself is corner-exit's row in the merged block:

  | Field | Type | Meaning |
  |---|---|---|
  | `lat_action_id` | `string \| null` | id of the `position`/`turn_in` action owning the lateral channel (`position`/`commit` states); `null` in `unwind`, and in `track` outside a completed-position hold |

  (`lat_mode` is retired — derivable from `steer_state`. `f_hold` is *not* recorded: it is recoverable as `lat_action_id`'s target, `start.f`, or the unwind-handoff snapshot — readable off the `release` event's sample. Keeps the record lean.)
- **CSV export**: `lat_action_id` lands in 05 §2.1's single merged post-`limit_y` column order (`sight_ride_m, steer_state, lat_action_id, su_sustained, su_transient, a_cmd_rate, below_validity`).
- **Interpolation table** (05 §3.2): add `steer_state`, `lat_action_id` to the `hold` row.
- **Events** (05 §5): `position_start` / `position_complete` keep their names, gain pinned trigger predicates and `detail` shapes (§1.2); **new kind `position_shortfall`** with `detail: {target_f, achieved_f, deficit_m}` joins the closed set.
- **Errors** (03 §6.2 / 08 §7): no new *codes*; new typed reasons `position_target_unreachable`, `position_overlaps_position`, `position_target_outside_corridor` (under `BAD_RANGE`), plus the machine-readable unreachable payload `{requested_dd_m, achievable_dd_m, over_m, required_over_m}`.
- **Verdict**: no shape change (deliberate — shortfall is an event, not an outcome class; the doctrine-catalogue cluster may key a check off `position_shortfall` if it wants one).
- **Hashes**: appended fields alone move nothing (hash = verdict + resolved plan); the newly-defined approach behaviour changes verdicts ⇒ joins the ONE consolidated re-bless migration commit (09 §3.3), enumerating this spec as a cause.

---

### 6. Acceptance — the D8 effectuality conformance test, made decidable (lands in 09 §8, replacing the aspiration paragraph)

**The mechanism: a committed witness table.** Merged home: `verify/effectuality.json` with verification's row schema (`{surface, field, fixture, perturbation, effect_class, expect}` — its rows can also express expected typed rejections); this section's rows migrate into it. Original row sketch, retained for the probe/channel vocabulary the migration maps from:

```
{ surface: "<schema path or action/DSL construct>",
  category: "physics" | "solver" | "presentation",   → effect_class: trajectory|verdict|sight|render|envelope
  fixture:  "<named fixture id>",
  channel:  "result_hash" | "trajectory_field:<name>" | "solved_plan" | "verdict_field:<path>" | "render_diff",
  probe:    "absence" | {field, from, to} }           → perturbation
```

- **Quantifier**: for every leaf surface enumerated from the schema, **there exists ≥ 1 row**; the meta-test `T-D8-EXHAUSTIVE` (verification's name; `T-D8-ENUM` is retired) walks the schema and fails CI on any surface with no row and on any row naming a surface the schema no longer has. This is what makes D8 *decidable*: effectuality is asserted per named fixture and named channel, never "on a reference scenario" in the abstract.
- **Categories** (closes the review's meta/labels objection): `physics` rows assert an engine-output change (hash or field, outside tolerance) between probe and baseline; `solver` rows assert a solved-plan or verdict change (e.g. `vis_hold_f`, constraint values); `presentation` rows (labels, `note`, `meta`, `view`) map to effect_class `render` and are **exempt from physics effectuality by declaration** — the exemption is a visible table entry, not a silent carve-out (annotation-grammar's marks/labels/legend/rays fields land there too).
- A surface that can support no row in any category is, by D8, not accepted input — it gets rejected at validation instead. The table is the standing proof.

**The position channel's rows and fixtures (named, committed):**

| Test | Fixture | Asserts |
|---|---|---|
| `T-POS-EFFECT` | `FX-POS-STRAIGHT` = `lane 3.5 \| S 120`, street, entry 34 km/h, `start.f = 0.2`, plan: one `position {f: 0.9, at_s: 10, over_m: "auto"}` | `position_start` and `position_complete` both present; `f` at completion `= 0.9 ± 0.02`; probe `absence`: deleting the action leaves final `f = 0.2 ± 0.02` and changes `result_hash` |
| `T-POS-INEFFECTUAL` | `FX-POS-SHORTWIN` = same, but `over_m: 6` explicit | `validate()` → `INEFFECTUAL` / `position_target_unreachable`; payload `required_over_m ≥ 33.5` (analytic: `L_req(1.89 m, 9.44 m/s) = 33.6 m`) and `achievable_dd_m < 1.89` |
| `T-POS-OVERLAP` | `FX-POS-OVERLAP` = `book90` + a `position` window intersecting the `turn_in` static span | `INEFFECTUAL` / `position_overlaps_turn_in` (now decidable via the static span) |
| `T-POS-SHORTFALL` | `FX-POS-POSTCOMMIT` = `book90` solved line + authored post-`release` `position {f: 0.1, over_m: 8}` on the 16 m exit straight | validates (post-commit leniency), runs, emits `position_shortfall` with `deficit_m > 0`; outcome class unchanged vs. the same plan without the action's window assertion |
| `G-POS-REACH` (golden + analytic acceptance) | `FX-POS-STRAIGHT` at 28/34/50 km/h variants | **soundness link between predicate and law**: every variant the validator *accepts* completes (`position_complete` fires inside the window); the achieved displacement at window end ≥ `dd_max/K_REACH` prediction. The formula is thereby pinned to the engine, not asserted |
| `P-POS-AUTH` (property, 09 §3.4) | fuzzed schema-valid scenarios | at every sample with `steer_state ∈ {"track","position"}`: `\|cmd_lean\| ≤ PHI_TRACK_AUTH_DEG + eps_deg_report` |
| `P-POS-NO-CORNER` (property) | `book90`, entry 34 km/h, plan with **no** `turn_in` | outcome is `runoff` (off-road termination per the §2.3-cluster's `off_road` event) — the tracker cannot fake cornering; the D7 guard is mechanical |
| `A-VIS-HOLD-REACH` (acceptance) | `bookBlind`, `vis=cautious` | the generated hold's `position` action passes validation under the governed `v_cmd` (the §2.2 arithmetic: governed speed ≤ ~29 km/h makes the 0.27 m hold fit the 12 m approach); on `bookEsses` + `vis=cautious`, the emitted wire plans contain **no** position/turn_in overlap and still validate (zero-gap branch) |

09 §3.4 additionally gains: `P-POS-AUTH`, `P-POS-NO-CORNER` in the named property list (`P-POS-AUTH` reads `steer_state ∈ {"track","position"}` samples); 09 §3.5's existing D8 sentence now points at `verify/effectuality.json` + `T-D8-EXHAUSTIVE` instead of restating the aspiration.

---

### 7. Requirements on other clusters (stated, not owned)

1. **Corner-exit cluster (commitment lifetime) — SATISFIED by the merge:** (a) the commitment-end event is corner-exit's `release` (this draft's `commit_end` token is retired); the exit unwind is corner-exit's distinct `unwind` state (the 5°-capped tracker cannot unwind a 28° commitment), which hands to `track` at `EPS_UNWIND_DONE_DEG` — the tracker then levels the last fraction of a degree and holds; (b) the **validation-time static commitment span** is `[turn_in.at_s, s_commit_end_static := governing-corner s1]`, a pure function of road + plan (my overlap predicate §2.4-3 and V2's window start §3-1 both consume it); (c) the resume target is the actual `f` snapshot at the unwind→`track` handoff, per §1.1.
2. **Error-taxonomy / agent-interface cluster:** the `INEFFECTUAL` vs `BAD_RANGE` homing of `position_target_unreachable` (U1); the final `--position` token grammar (my §4 row is a proposal).
3. **Off-road-termination cluster (§2.3):** `P-POS-NO-CORNER` asserts `runoff` via your `off_road` terminal event.
4. **Verification cluster — RECONCILED:** the general D8 mechanism is verification's (`verify/effectuality.json`, `T-D8-EXHAUSTIVE`); this section's rows/fixtures migrate into it and the `effectAt()` difference predicate stays owned here.
5. **Doctrine-catalogue cluster:** `hold_wide_for_sight` unchanged; `position_shortfall` is available as check evidence if wanted.

### Deviations from the review's fix direction (and why)

- The review's physics-lens fix suggested a **time-optimal S-curve in `d(t)`** (open-loop profile). I chose the closed-loop tracker: an open-loop profile must be re-planned at activation from emergent state *and* still needs a feedback law to survive ellipse clipping and `phi_dot_su` disturbances — two mechanisms where one suffices. The tracker's saturation limit *is* the bang-bang bound, so the reachability formula stays exact for both.
- The review offered "reject `BAD_RANGE` **or** accept with declared partial-reach semantics". I do both, split by decidability: reject (typed, `INEFFECTUAL` per task direction) where the declared history makes the predicate exact; accept-with-typed-shortfall where rejection would require guessing emergent state.

### Decision drafts (editor numbers them)

- **D-draft: The lateral tracker channel.** `position` actions, default lane-keeping, V2 holds, and post-commitment exit unwind share one bounded, critically-damped lateral-error tracker that writes the existing `target_lean` through the existing roll tracker; `turn_in` commitments suspend it; its authority cap (`PHI_TRACK_AUTH_DEG = 5°`) makes cornering-without-`turn_in` physically impossible, preserving D7; controller output shape is unchanged. One reachability formula serves as `over_m`-auto resolver, validation predicate (`INEFFECTUAL position_target_unreachable`), and V2 clipping rule; `over_m` defaults to `"auto"`, retiring the unreachable 15 m constant.

### User decisions (genuine judgment calls)

- **U1 — Error code family for unreachable position targets.** `INEFFECTUAL`/`position_target_unreachable` (as specced, per task direction) vs `BAD_RANGE` under 08 §7.2's proposed taxonomy ("physically impossible request"). *Recommendation:* keep `INEFFECTUAL` — the action would validate and silently under-deliver, which is exactly the class D8 was minted for; the reason string is stable either way.
- **U2 — Lane-keeping as the default lateral behaviour outside commitments.** This *defines* previously-unspecified approach behaviour and re-blesses every golden (straight-approach fixtures are behaviour-identical; curved approaches change from "runs straight off" to "lane-keeps within 4.7°"). *Recommendation:* yes — it is the only way `position` can hold a target at all, and the D7 guard keeps it honest.
- **U3 — Post-commitment position actions: lenient validation + runtime `position_shortfall`, vs conservative worst-case-corridor rejection.** Worst-case rejection would ban legitimate short exit repositions (`book90`'s 16 m exit straight fails worst-case at any preset speed). *Recommendation:* lenient + typed shortfall, as specced.
- **U4 — Preset geometry left untouched.** The arithmetic shows `book90`'s 12 m approach makes even the canonical 0.27 m hold marginal at 34 km/h; an alternative fix was lengthening `book90` to `S 16` (still inside the proportion band, entry < one arc length = 18.85 m). I did not touch presets (other clusters own them; V1 governance resolves the canonical case). *Recommendation:* keep presets as-is unless the preset/handedness cluster is already reshaping them, in which case `S 14–16` buys hold-wide headroom cheaply.
