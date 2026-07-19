# Result Contract & Per-Instant Inspection

How a linelab run records what happened, and how any consumer — the stepper HUD,
the POV view, the CLI, an AI agent — asks "what was the full state of the bike at
this exact point?" and gets a complete, typed answer.

This document owns the **Sample contract** (the canonical per-sample record), the
**time-base and interpolation contract**, the **`stateAt` query**, the **events
array**, the **verdict shape**, the **multi-line result envelope**, and the
**sharing/export formats**. It does not own the physics that produces these values
(`02-physics-model.md`), the road/sight/scenario inputs
(`03-roads-scenarios-and-visibility.md`), the drawing of them
(`06-rendering-and-projection.md`, `07-viewer-animation-and-pov.md`), or the
regression gates over them (`09-verification-and-testing.md`).

---

## 1. What this document covers — and the rule it enforces

The prior design's deepest inspection defect was not missing data but missing
*recording*: the controller computed `{target_lean, roll_rate, a_cmd, active}` on
every integration step and then threw them away — only the delivered kinematics
survived into the Sample. "The controls of the bike at any point" was therefore
derivable (by re-running the engine) but not inspectable (by reading the result).
Similarly, sight distance was precomputed per sample but the limit point's world
coordinates were not carried, and the in-memory channel columns were never pinned.

The rule this document enforces, stated once:

> **If the engine knew it during the run, the result records it — commanded and
> delivered, kinematic and doctrinal — in one pinned, frozen, per-sample record.**

Everything downstream (HUD, POV, CSV, `stateAt`, agents) reads the record; nothing
downstream ever re-derives state the engine already had.

---

## 2. The Sample contract

A run produces a deep-frozen `Trajectory`:

```
Trajectory = { samples: [Sample], events: [Event], terminated: {reason, s, t, x, y} }

terminated.reason ∈ "crash" | "off_road" | "stopped" | "road_end" | "max_time" | "max_dist"
```

`terminated.reason` is a closed set; `(x, y)` is the bracketed final position
(for `off_road`, the exact crossing point on the road edge — the drawn-endpoint
rule in `06-rendering-and-projection.md` consumes it). The per-step termination
precedence — `crash > off_road > stopped > road_end > max_time > max_dist` — is
owned by `02-physics-model.md` §7; corners are analysis windows, never
terminators. Reason↔event mapping: `crash`→`crash` event, `off_road`→`off_road`
event, `stopped`→`stop` event, `road_end`→`road_end` event; `max_time`/`max_dist`
are runaway guards with no bookmark event.

`samples` is one flat array of full-precision records — the prior design's split
between raw `samples` and rounded, separately-emitted `channels` (with its
`channels[i].s === samples[i].s` alignment contract) is **collapsed**: there is
one array, it is the channel set, and there is nothing to keep aligned. Rounding
happens only at export boundaries (§8), never in the record.

### 2.1 Field table (pinned; append-only by design change)

**Kinematics & dynamics** — written by `core/` (the integrator):

| Field | Type | Units | Meaning |
|---|---|---|---|
| `s` | number | m | Arc-length station along the road centreline |
| `t` | number | s | Sim time since run start; strictly monotone |
| `x`, `y` | number | m | World position of the bike (point-mass) |
| `psi` | number | deg | Heading (world frame) |
| `v` | number | m/s | Speed |
| `phi` | number | deg | Lean angle, signed: **+ = right-hand lean** (y-down frame, `02` §2) |
| `kappa` | number | 1/m | Path curvature actually ridden (`= g·tan(phi)/v²`) |
| `a_long` | number | m/s² | **Delivered** longitudinal acceleration (post-clip) |
| `a_lat` | number | m/s² | Lateral acceleration (`= v²·kappa`) |
| `grip` | number | 0..1 | Friction-ellipse margin, `1 − ellipseMag` |
| `mu` | number | — | Local friction coefficient at `(s, d)` |
| `d` | number | m | Signed lateral offset from centreline, **positive to the rider's left** (frame owned by `02` §2) |
| `f` | number | — | Lane fraction in the governing corner's frame: 0 = inner usable edge, 1 = outer usable edge, `f > 1` = beyond the corridor. Which of `f < 0` / `f > 1` is the oncoming lane depends on corner hand under right-hand traffic (`03` §2); under `use_full_width` the corridor is the full carriageway and `f > 1` = off-road |

`f`'s **governing corner** is the corner containing `s`; on non-corner stations
the nearest corner downstream; after the last corner, the last corner (`03` §2).
The handoff station is each corner's exit boundary `s1`. At a handoff between
opposite-hand corners the frame flips: `f` re-reads as `1 − f` while `d` is
continuous — the recorded per-sample `f` carries this documented jump (it is a
coordinate re-reading, not motion).

**Commanded controls** — written by `plan/` (the Controller), recorded every
sample. This is the block the prior design computed and dropped:

| Field | Type | Units | Meaning |
|---|---|---|---|
| `cmd_lean` | number | deg | The controller's lean setpoint at this instant; signed like `phi` (+ = right-hand lean) |
| `cmd_a` | number | m/s² | **Commanded** longitudinal accel (brake < 0, drive > 0) |
| `roll_rate` | number | deg/s | The roll-rate cap in force: `roll_rate_eff = min(profile rate, rider.roll_rate_cap_dps when present)` (`02` §3) |
| `action_id` | string \| null | — | `id` of the plan action currently driving control |
| `clipped` | boolean | — | True when the friction ellipse limited `cmd_a` → `a_long` |
| `n_long` | number | −1..1 | Normalised ellipse component `a_long / aLongMax(mu)` |
| `n_lat` | number | −1..1 | Normalised ellipse component `a_lat / aLatMax(mu)` |

The commanded/delivered pair is what makes the HUD honest: "brake `b1` active,
commanded −3.0 m/s², grip-limited to −2.1" is read directly as
`(action_id, cmd_a, a_long)` with `clipped = true`. The clip magnitude is the
derived difference `cmd_a − a_long`; it is not stored separately. `n_long`/`n_lat`
exist so a live friction-circle widget plots one point per sample with no
recomputation.

**Sight** — written by `sight/`, cast from the **rider's actual position** per D4
(never the centreline):

| Field | Type | Units | Meaning |
|---|---|---|---|
| `sight_m` | number | m | Geometric sight distance from eye at `(x, y)`; speed-independent; centreline-station basis — the cross-line-comparable quantity, and the source of `sight_trend` (§4) |
| `ssd_m` | number | m | Stopping sight distance at current `v` **and this sample's own `phi`** — the lean-aware two-phase model of `03` §5.2 |
| `limit_x`, `limit_y` | number | m | World coordinates of the limit point |

The sight margin (`sight_ride_m − ssd_m`, rider-path basis — D16) and the
limit-point *trend* are derived values, computed by `stateAt` (§4), not stored.

**Merged append block** — appended fields, one block, in the pinned CSV order
they take after `limit_y` (§8.2):

| Field | Type | Units | Meaning |
|---|---|---|---|
| `sight_ride_m` | number | m | Sight distance re-based in **rider-path metres**: the exact path length along the line's own trajectory from this sample to the station where the centreline distance reaches `s + sight_m` (clamped at line end — conservative). The **sole basis for every sight-vs-stopping judgment** (D16): `stop_within_sight`, hold release, the V1 governor, `verdict.sight.margin_min_m`. `sight_m` keeps its centreline basis for comparability and rendering |
| `steer_state` | `"track"` \| `"commit"` \| `"unwind"` \| `"position"` | — | The steering-machine state (`02` §3.1) — the HUD's exit story ("released here, unwinding") reads straight off it |
| `lat_action_id` | string \| null | — | `id` of the plan action owning the lateral channel: `commit`/`position` name their action; `unwind` carries `null`; `track` carries `null` outside a completed-position hold |
| `su_sustained` | number | deg/s | Signed roll-rate contribution of the sustained stand-up term actually applied this step (`02` §5.2) |
| `su_transient` | number | deg/s | Signed roll-rate contribution of the transient (chop) stand-up term actually applied this step — the *applied disturbance*, the realized `Δphi/dt` of the step it lands in |
| `a_cmd_rate` | number | m/s³ | The step's ZOH commanded-accel rate (audits the transient trigger) |
| `below_validity` | boolean | — | Model-validity flag: `v < v_valid_min_ms` **and** `\|phi\| ≥ 2°` (`02` §7); resampling ORs it per bracket |

Rules on the append block:

- **Identity (normative):** `phi_dot_su ≡ su_sustained + su_transient` at every
  sample — defined notation, never a stored column (same rule as
  `sight_margin_m`).
- **Exact zero when gentle:** under `02` §5.4's bit-identity invariant both su
  fields are exactly `0.0` — a sharp, tolerance-free test hook.
- Sample appends alone move **no hash** (§8.3): `result_hash` covers the verdict
  plus the resolved plan and `spec_hash` covers inputs only; only the CSV/export
  goldens re-bless.

### 2.2 Contract rules

- **Frozen.** The whole `Trajectory` is deep-frozen before it leaves the core
  (children before parents, so no mutability window exists) — carried unchanged.
- **Full precision.** Samples are raw f64. No field is rounded in the record.
- **Pinned and append-only.** This field list is the contract. New fields may be
  *appended* by a design change to this document; no field is renamed, reordered,
  or repurposed. An agent that learned the contract once stays correct.
- **Every line gets the same record.** A mistake line's samples carry every field
  above, identically to the ideal line's (D6). There is no reduced "overlay"
  record anywhere in the system.

---

## 3. The time-base

### 3.1 Dual parameterisation, one grid

The integrator steps at a fixed `dt` (owned by `02-physics-model.md`). Samples are
**retained** on the arc-length doctrine grid: one sample each `ds_m = 0.5 m`
(carried; TUNING), plus a final exact sample at termination. Each retained sample
records its exact `t`, and both `s` and `t` are strictly monotone over the array —
so the trajectory is a bijection between station-space and time-space, and either
may parameterise playback or queries.

An optional time-uniform series (`record_dt_s`, default unset — TUNING) may
additionally be retained for export convenience (derived from the arc grid at
export; it is never the integrator's raw series), but **no consumer may require
it**: the interpolation contract below must fully define constant-time stepping
from the arc-grid alone.

### 3.2 The interpolation contract

For a query falling between retained samples `i` and `i+1`, the blend factor is

```
alpha = (q − q_i) / (q_{i+1} − q_i)        where q is s or t, per the query
```

and each field interpolates by its declared rule:

| Rule | Fields | Definition |
|---|---|---|
| `linear` | `s, t, x, y, v, kappa, a_long, a_lat, grip, d, f, cmd_a, n_long, n_lat, sight_m, ssd_m, limit_x, limit_y, sight_ride_m, su_sustained, su_transient, a_cmd_rate` | Standard lerp |
| `angle` | `psi, phi, cmd_lean` | Shortest-arc lerp in degrees (wrap-aware, so a 359°→1° step blends through 0°, never through 180°) |
| `hold` | `action_id, clipped, mu, roll_rate, steer_state, lat_action_id, below_validity` | Value of sample `i` (these are step functions; blending them would fabricate states that never existed). `below_validity` additionally ORs per bracket at resampling |

Positional lerp error is bounded by curvature: at `ds_m = 0.5 m` and the tightest
in-scope corner (`kappa ≈ 1/15 m⁻¹`) the chord deviation is `≤ κ·(ds/2)²/8 ≈ 0.5 mm`
— far below drawing resolution. No consumer needs spline reconstruction.

Variable-speed playback is defined entirely on this contract: a playback clock `τ`
at rate `r` queries `stateAt(result, {t: t₀ + r·τ})`. Nothing about playback is
renderer-specific; `07-viewer-animation-and-pov.md` builds on this section without
extending it.

---

## 4. `stateAt(result, {s | t})` — the per-instant query

The single query API for "everything about the bike at this point." Pure,
Result-based, no IO:

```
stateAt(lineResult, {s: number} | {t: number}) -> Result<InstantState>
```

**Semantics.** Exactly one of `s` or `t` must be supplied (both or neither →
`err(SCHEMA)`). The query is resolved against the monotone sample array by binary
search, then interpolated per §3.2. Queries outside `[first, terminated]` return
`err(BAD_RANGE)` with `at` set to the valid interval — the function never clamps
silently; clamping is a caller (viewer) policy. A query beyond a line's early
termination (crash, run-off) is `BAD_RANGE`: state after the end of a trajectory
does not exist, and pretending otherwise would violate the honesty stance.

**Returned shape** (frozen):

```
InstantState = {
  sample,                       // one full interpolated Sample (§2.1, every field)
  derived: {
    v_kmh,                      // display speed
    sight_margin_m,             // sight_ride_m − ssd_m — rider-path basis (D16)
    sight_trend,                // "opening" | "closing" | "steady" — defined below
    ssd_station_m,              // the station the rider's path reaches after ssd_m of
                                // path length (inverse of the sight_ride_m lookahead)
    phi_max_deg,                // atan(mu), the lean ceiling here
    stand_up_dps,               // su_sustained + su_transient — the net stand-up
                                // disturbance, by the §2.1 identity
    a_noreturn_ms2,             // A_SU_ONSET + roll_rate/(K_SU·tanh(|phi|/PHI0)) (02 §5.3),
                                // computed by the same exported pure core function the
                                // engine uses; null when |phi| < 2° (upright immunity band)
    a_widen_ms2,                // a_widen(phi, v; c=1) (02 §run-wide); null when |phi| < 2°,
                                // v below the existence bound, or the denominator ≤ 0
    limit_point: {x, y},        // convenience copy of limit_x/limit_y
    action,                     // the PlanAction in resolved_scenario.rider.plan (§7)
                                // whose id equals the sample's action_id, or null
    corner_id,                  // corner containing s, or null
    phase                       // Phase, §4.1
  },
  at: {i0, i1, alpha}           // bracketing sample indices — viewers highlight the span
}
```

**`sight_trend` — defined here, once, windowed and deadbanded.** At sample `i`,
compare `sight_m[i]` against `sight_m` at the sample nearest
`s_i − SIGHT_TREND_WINDOW_M` (`5.0 m`, TUNING; clamped to the first sample early
on): Δ > `+SIGHT_TREND_DEADBAND_M` (`2.0 m`, TUNING) → `"opening"`;
Δ < −deadband → `"closing"`; else `"steady"`. (2 m of change per 5 m of travel is
a slope threshold of 0.4.) The trend is computed from the recorded `sight_m`
channel — deliberately the centreline-basis quantity, so it stays comparable
across lines — and `03` §5.1's pure `sightFrom` signature carries no trend: a
pure function of `(road, eye, occluders)` has no previous sample. The V1
governor (`04` §6) keys off this per-sample trend.

**`stateAt.derived.commitment_probe` (D45, gated).** One nullable member,
`{ k_admissible: number | null, k_refuted: number | null } | null`, populated only when the cursor is within
`EPS_PROBE_SNAP_M` (`03-…md` §7a.2) of a probe station **and** a
`CommitmentReport` is attached to the loaded envelope. It is read from `probes[]`
on the result document, never recomputed, so `stateAt` stays pure and adds zero
engine runs — the property `A-STATE-VERB` and `C-STATEAT-LAWS` already pin. When
no report is attached the member is `null`, and `null` here means *not computed*,
never *zero*. The two counts are independently nullable for the same reason: a
probe that ran outside the reserve at entry, or a report whose
`envelope_contains_actual` is `false` (`03-…md` §7a.7), carries `null` counts —
again *not computed*, never *zero*.

`stateAt` is exposed identically in the library and as the CLI verb `state`
(`08-cli-and-agent-interface.md` §3), so an agent inspects any instant of any
line — including failed lines — without parsing CSVs or re-running the engine.

### 4.1 The phase machine

`derived.phase` is one closed five-token set, shared verbatim with the controls
strip's bands (`06` §4) — tokens chosen **disjoint from the station anchors
(`entry|mid|exit:<cornerId>`) and the Event kinds**; the book's *entry/mid/exit*
words remain anchor and caption vocabulary, never machine tokens:

```
Phase = "approach" | "turning" | "midcorner" | "exiting" | "done"     (closed set)
```

Phase is a total pure function of the query point and the line's events array:
*phase at query `q` = the phase opened by the latest opener with `t ≤ t(q)`*.
The opener table (the single extension point — new boundaries edit this table,
never add a parallel partition):

| Opener | Opens | Boundary predicate / notes |
|---|---|---|
| run start (first sample) | `approach` | Every line starts in `approach`; totality is guaranteed. `brake_start` **does not** bound a phase (it stays an event tick) — a no-brake line changes nothing |
| `turn_in` (corner c) | `turning` | |
| `steering_complete` (c) | `midcorner` | `crack` opens no phase |
| `roll_on` (c) | `exiting` | |
| `exit` (c), c **not** the road's last corner | `approach` | chain re-entry: between corners the phase is the *next* corner's `approach` while the geometric `corner_id` is `null` — phase and `corner_id` are independent fields |
| `exit` (c), c the road's last corner | `done` | `done` spans last-exit → termination, over live samples; queries past termination remain `BAD_RANGE` |

Rules, normative:

- **Skipped phases are legal.** Missing intermediate events skip their phase: a
  plan with no throttle action has an empty `exiting` (`midcorner` runs to
  `exit(c)`); a line with no `turn_in` stays `approach` throughout.
- **Terminal events open no phase.** A line crashing during `turning` *ends in*
  `turning` — the terminal fact lives in `terminated.reason`, never duplicated
  into phase. Early-terminated lines never reach `done`; `done` means "finished
  the road's corner work". `release` opens no phase.
- **Half-open intervals.** A phase includes its opening instant (the sample at
  `turn_in` reads `turning`); event-time ties resolve by the events array's
  pinned declaration order (§5).
- **Interpolation:** `phase` follows the `hold` rule family — the latest opener
  at `t ≤ t(q)`.

---

## 5. Events as bookmarks

`Trajectory.events` is an ordered array of typed markers:

```
Event = { kind, s, t, line_note?, corner_id?, action_id?, detail? }
```

**Kinds (closed set):** `brake_start`, `brake_end`, `turn_in`,
`steering_complete`, `crack`, `roll_on`, `apex`, `exit`, `release`,
`position_start`, `position_complete`, `position_shortfall`, `sight_min`,
`run_wide_detect`, `correction`, `off_road`, `hazard_visible`, `violation`,
`crash`, `stop`, `road_end`.

Definitions pinned here (arithmetic owned by the named docs):

- `release` — the steering-commitment release: heading capture ends the `commit`
  state (`02` §3.1). Shape `{kind: "release", s, t, corner_id, action_id}` with
  `action_id` = the released `turn_in`. Emitted on **every** line with a
  released commitment.
- `position_shortfall` — emitted at the first sample past a `position` action's
  completion budget if `position_complete` has not fired;
  `detail: {target_f, achieved_f, deficit_m}` (`02` §3.1). Recorded, never
  silent; shortfall alone changes no outcome class.
- `run_wide_detect` — the first bracketed **outward** crossing of `f` through
  `1.0 + eps_f_detect` after turn-in; at most one per corner (predicate owned by
  `04-solver-and-authoring.md` §corrective-shot). No inside-direction detect
  exists.
- `correction` — the corrective **shot-start bookmark**: emitted iff the
  corrective shadow was attempted, at the last moment a save had to begin;
  `detail: {feasible}`. It never implies the main line bends back — the drawn
  line is always the uncorrected consequence.
- `off_road` — the bracketed crossing of `|d| > lane_width_m` (either edge);
  terminal, paired with `terminated.reason = "off_road"`.
- `hazard_visible` — a placed vehicle/hazard becomes visible from the rider's
  eye; `detail: {occluder_id, dist_m}` (`03` §4).
- `violation` — the constraint-breach bookmark (a D10 bound or physical ceiling
  crossed); feeds traction/lean-ceiling evidence and diagnosis. It is an event
  kind only — `violation` is **not** an outcome class (§6.1).
- `apex` — one event per **accepted** apex (the §6.3 hysteresis detector), with
  `detail.index` 1-based per corner.
- `crash`, `stop`, `road_end` — terminal bookmarks, mapped from
  `terminated.reason` per §2.

Rules:

- **Exact crossings.** Event `s`/`t` are computed by linear interpolation between
  the bracketing integrator steps (the event-bracketing machinery is owned by
  `02-physics-model.md` §integrator) — an event's coordinates are exact to the
  bracketing tolerance, not snapped to the 0.5 m grid.
- **Emergent events stay emergent.** `apex` and `exit` are *measured* post-hoc by
  the analyzers and injected into the same array. They are outputs living beside
  the input-driven events — D7 is untouched: no event is ever an input.
- **Bookmarks are events-only.** The stepper's named jump targets — "step to
  turn-in", "step to apex", "step to crash instant" — are exactly `events`
  filtered by `kind`, resolved through `stateAt`; plan stations are not
  bookmarks (plan-action starts already surface as events). `sight_min` (station
  of worst sight margin) gives blind-corner scenarios a canonical "worst moment"
  bookmark. The renderer's markers and label anchors
  (`06-rendering-and-projection.md`) resolve against this same array — one event
  source, every consumer.
- Events are strictly ordered by `t` (ties broken by declaration order), and every
  event of a line lies within that line's sample range, so every bookmark is
  `stateAt`-resolvable by construction.

---

## 6. The verdict

The verdict is the doctrinal judgment of one line.

### 6.1 The outcome law (closed sets)

**Physics decides `outcome`; the rubric decides `doctrine`; `quality` composes
them.**

```
outcome    : "crash" | "runoff" | "wide" | "stopped" | "contained"
precedence : crash > runoff > wide > stopped > contained      (one deterministic headline)

  crash      grip or lean ceiling exceeded (deadbanded, 02 §7)
  runoff     unrecovered departure: crossed the outer usable edge (the
             run_wide_detect event) with no feasible corrective, OR terminated
             off_road with no outward detect (inside-side physical departure;
             corrective null)
  wide       crossed the outer usable edge but a feasible corrective returns it
             (the wide-vs-runoff split is decided by the corrective shot,
             04-solver-and-authoring.md §corrective-shot)
  stopped    v < v_floor_ms before road end and none of the classes above apply
  contained  reached road end on the carriageway, none of the above
```

`outcome` is **physics-only**: it never reads a doctrine check, and is
recomputed identically under any rubric pack (`P-OUTCOME-RUBRIC-FREE`). An
inside-corridor excursion on pavement never moves `outcome` — that is check
territory (`out_in_out`, `chain_containment`).

`clean` is a **derived predicate**, no longer an outcome value:

```
clean(line) ⇔ outcome = "contained" ∧ zero applicable check fails
Verdict.ok  ≡ clean(line)
```

`violation` is retired as an outcome value (it survives only as the
constraint-breach *event* kind, §5). `dnf-spec-error` is deleted: a line that
never runs because its solve was refused is a `LineRefusal` envelope entry (§7);
invalid input surfacing at run time is a linelab bug — typed `INTERNAL`, exit 4
(`08` §3.1).

`quality ∈ "good" | "caution" | "failing"` is the single total colour function,
owned by `06-rendering-and-projection.md` §5.1 and recorded in the verdict
(§6.3): `failing` iff outcome ∈ {crash, runoff, wide} or a critical-severity
check failed; `good` iff clean; `caution` otherwise (contained-with-fails, and
all `stopped`). Colour derives from quality alone (D9 intact).

```
diagnosis.cause : "overspeed_entry" | "grip_exceeded" | "roll_rate_limited"
                | "sight_deficit" | "late_brake" | "plan_gap" | "stand_up"
```

`stand_up` names the run-wide slice (D3, `02-physics-model.md` §run-wide) as the
proximate cause when braking-at-lean or a throttle chop widened the line into
`wide`/`runoff`. Per-kind mistake outcome pins live in the ONE machine-readable
pin table (`03` §7.1) — e.g. `chop` pins `runoff` on its oracle fixture — and a
pin flip is a design change landing through the re-bless discipline
(`09-verification-and-testing.md`), never a patch at the pin.

### 6.2 Doctrine checks — the record shape

The catalogue — ids, tiers, arithmetic, thresholds — is
`01-scope-and-doctrine.md` Appendix A, shipped as the `parks-street/2` rubric
pack; this document pins only the record shape:

```
CheckResult = { id,
                scope: "corner" | "pair" | "chain" | "line",
                corner_id: string | null,       // scope = corner
                pair: [string, string] | null,  // scope = pair
                verdict: "pass" | "fail" | "warn" | "na",
                evidence: { message, at_s?, metrics? } }   // typed; the bare string is retired

doctrine = { pass, fail, warn, na, checks: [CheckResult] }
```

Two identity fields ride every verdict: `rubric` (pack identity — *data*: ids,
thresholds, bands, severities, applicability; default `"parks-street/2"`) and
`checks_version` (the independent *code* version of the metric implementations;
current `2`). Check ids are stable **within** a `checks_version`; a version bump
is where a rename may happen, and the pack records it with a typed tombstone
(e.g. `sight_vs_stopping` → `stop_within_sight`: the old id is rejected
`UNKNOWN_ID` with a message naming the successor — never silently aliased).

### 6.3 Verdict shape (merged)

```
Verdict = { ok,                          // ≡ the derived clean predicate (§6.1)
  spec_hash, result_hash,
  checks_version: 2,                     // metric vocabulary (code) — §6.2
  rubric: "parks-street/2",              // pack identity (data) — §6.2
  engine: "linelab/1",
  outcome,                               // §6.1 closed set
  quality: "good"|"caution"|"failing",   // stored, in-hash; law owned by 06 §5.1
  headline,
  diagnosis: null | {cause, at_s, corner_id, detail},
  acceptance: { policy: "clean" | "best_failing",   // always present, in-hash
                met: boolean },          // true iff the returned line meets the clean bar
  misjudgment: null | {                  // non-null only for source.kind = "misjudge" (§7)
    believed_road_hash,                  // fnv-1a/6-hex over the canonical believed roadSpec
    s_divergence_m,                      // exact divergence station
    divergence: { kind: "radius" | "sweep" | "structure",
                  corner_id | null, believed | null, actual | null },
    kappa_gap: { max_abs_1pm, at_s },    // max |κ_actual − κ_believed| past divergence
    believed: { outcome: "clean", spec_hash, result_hash },  // believed-world self-verify
    actions_unreached: [action_id, …]    // literalized actions the actual run never reached
  },
  validity: { below_validity_s: number } | null,   // total below_validity dwell; null when zero
  corners: [ {
    id, hand,                            // hand ∈ "L" | "R"
    corner_type,                         // "constant" | "decreasing" | "increasing" (03 §2)
    turn_ins: [ { s, lean_commit_deg, hand,
                  release_s | null } ],  // one per turn_in event in span; release_s null =
                                         // the commitment never released (itself diagnostic)
    apexes:   [ { s, pct, f, clearance_m, v_kmh, lean_deg } ],   // ordered by s, 1..N
    lean_max_deg, grip_min,
    danger_dwell_s,                      // reserve-exceedance dwell, seconds: total time in the
                                         // corner window with |phi| > phiReserve(mu_use),
                                         // boundary crossings bracket-interpolated; evidence
                                         // only, feeds no check (arithmetic: 01 Appendix A)
    exit: { s, d, f, heading_err_deg },
    ran_wide,
    corrective: null | {                 // null ⇔ never attempted (no outward departure, or crash)
      feasible: boolean,
      detect:   { s, f },                // bracketed outward crossing, main line
      shot:     { s, v_kmh, phi_deg, target_phi_deg },
      returned: { s, f } | null,         // first return station (feasible only)
      fail_reason: null | "departed_before_reaction" | "shadow_off_road"
                        | "shadow_crash"
                        | "no_return_before_road_end" },   // closed set, 04 §4a.5
    crash?
  } ],
  sight: { margin_min_m,                 // min over samples of sight_ride_m − ssd_m (D16)
           at_s, v_at_s_kmh,
           holds: [ { corner_id, target_f, achieved_f, budget_limited,
                      hold_release_s } ] // per-corner vis-hold record; hold_release_s is
                                         // distinct from turn_ins[].release_s
         } | null,
  constraints: null | [ { id, bound, value, satisfied,
                          worst: {s, value, margin} } ],
  doctrine: { pass, fail, warn, na, checks: [CheckResult] },
}
```

**Apex detection — ONE detector.** Walk `f(s)` over the corner span with
hysteresis: a local minimum is accepted as an apex when `f` subsequently rises
by ≥ `APEX_PROMINENCE_F = 0.08` (TUNING) before the corner ends or a new lower
minimum supersedes it; accepted apexes closer than `APEX_MIN_SEP_M = 5.0 m`
(TUNING) merge, keeping the deeper. One deterministic pass; the same rule emits
the per-touch `apex` events with `detail.index` (§5) — markers, labels, and
checks all read the same list. `late_apex` reads the **final** apex's `pct`.

**Corrective semantics.** The block is classification-bearing (`feasible`
decides the wide-vs-runoff headline) and therefore **inside `result_hash`**. The
shadow *trajectory* is never part of the envelope, the CSV, or any hash — it is
recomputable output, exposed as the pure API
`correctiveShot(lineResult) → Result<{corrective, shadow: Trajectory}>` so a
viewer may draw the save as a stepper-only ghost. Crash strictly precedes
corrective solving: no save is computed for a lowsided trajectory.

`corrective` deliberately carries **no `rider` field**. Its controller is the
registered rider `lean_only_reserve`, fixed by `04-…md` §4a.4 for all time and
therefore known from the design of record rather than from the record; this block
is in-hash, and adding a field would move `result_hash` on every committed scene.
The disclosure obligation is discharged in prose on every rendering surface
(`04-…md` §4c.7), asserted by `A-CORR-EXPLAIN`. The out-of-hash shadow document
returned by `correctiveShot` does carry the id.

`constraints` is the per-bound evaluation of a constraint-targeted solve
(`04-solver-and-authoring.md` §4.5, D10) — `null` unless the line's source
carries constraints. A solver-returned line always has every entry
`satisfied: true` (an unsatisfiable bound is a typed `NO_SOLUTION`, never a
false entry), so the block's value to a reader is the recorded margin: how much
room each bound had left, and where it was tightest.

`acceptance` makes a non-clean return impossible to receive silently: a
policy-`clean` solve reporting a non-clean self-verification carries
`{policy: "clean", met: false}`; a best-failing return that happens to be clean
carries `{policy: "best_failing", met: true}`. Grading is policy-independent —
the accept policy changes what is *returned*, never how it is graded or
coloured (D9).

Rounding at this boundary follows the carried centralized emission policy (§8.3).
The `diagnosis` block reasons on raw full-precision measurements and is excluded
from `result_hash` (full hash law: §8.3) — richer diagnostics must never perturb
regression hashes.

### 6.4 The standing ladder (out-of-hash)

`outcome` is physics-only and `quality` is a three-token colour function; neither
can express the two things the book actually claims a well-chosen line buys —
**information** and **a second input**. `standing` is the finer total order that
can, and it buys both from the rubric rather than from new arithmetic.

```
Standing = "reserved" | "clean" | "caution" | "failing" | "crash"       // closed, ordered 4>3>2>1>0

standing ≥ 1  ⇔  outcome ≠ "crash"
standing ≥ 2  ⇔  quality ≠ "failing"
standing ≥ 3  ⇔  clean(line)                                            // §6.1 verbatim
standing = 4  ⇔  clean(line) ∧ ∀ c ∈ rubric.annex.reserve_checks:
                   every applicable CheckResult with id = c has verdict = "pass"

standing := the greatest rung whose threshold holds.
```

**The thresholds are cumulative and monotone, and that is load-bearing.** Stated
as five biconditionals the ladder is not a function — `crash` and `failing`
overlap, `clean` and `reserved` overlap — and the token `clean` names
*clean-but-not-reserved*, which is not §6.1's `clean(line)`. Under thresholds,
disjointness is automatic, no guard clause is needed on any rung, and every token
is a threshold on its namesake. **Tombstone note, in the `01-…md` §A.5 idiom:**
the rung tokens `clean`, `caution`, `failing`, `crash` name *the highest rung
attained*, not the extension of the namesake predicate — a line at rung 3
satisfies `clean(line)`, and so does a line at rung 4. Every printing surface
carries this gloss (`06-…md` legend rows, `explain standing`, the disclosure
footnote).

**`na` and ungraded members cap the ladder.** If any member of `reserve_checks`
returns `na` on any applicable instance, or has **zero** instances in the line's
`doctrine` block, `reserved` is unattainable and `standing` caps at 3. Zero
instances is treated as `na`, not as a vacuous universal — a check that never ran
is not a check that passed. The blocking members and their reason are recorded,
never inferred.

**Refusals are not a rung.** A `LineRefusal` envelope entry (§7) has no
`standing`: it is its own terminal class, `standing: null`, `refused: true`. A
refusal is not a bad line; it is the absence of one.

**Wire shape** (out-of-hash; returned by the pure exported function
`standing(lineResult)`, never a `Verdict` member):

```
StandingReport = {
  kind: "standing",
  line_id: string,
  standing: Standing | null,               // null iff refused
  rung: 0 | 1 | 2 | 3 | 4 | null,
  refused: boolean,
  rubric: "parks-street/2",                // pack identity (data)  — §6.2
  checks_version: 2,                       // metric vocabulary (code) — §6.2
  reserve_checks: [ checkId, … ],          // echoed from the pack annex, never re-derived
  reserve: [ { id, verdict: "pass"|"fail"|"warn"|"na",
               instances: number } ],      // one row per declared member; the closed
                                           //   per-check verdict set of 01-…md §A.1 —
                                           //   zero instances reads verdict "na",
                                           //   instances 0, never a fifth token
  reserved_blocked_by: [ { id, reason: "warn"|"fail"|"na" } ],   // [] iff rung 4
  placard: string                          // verbatim, below
}
```

`reserved_blocked_by` is empty exactly when `rung = 4`; it is the readable answer
to "what did this line spend", and it is what a consumer quotes instead of
guessing.

**The placard, verbatim on every surface that prints a `standing` token:**

> *outward mid-corner correction is not modelled (Tier 1R: no countersteer, no
> rider-input model). This rung reports declared reserve only — lean reserve and
> sight reserve as graded by `<rubric>` at `checks_version <n>`.*

Parks' sentence is two-sided and names the *outward* correction first. Tier 1R
models no outward corrective authority: the corrective-shot policy is strictly
line-tightening and there is no rider input channel. The honest half ships under
its honest name — declared reserve — and the missing half is placarded rather
than implied. The book warrant for the shipped half is the Chapter-8
lean-reserve clause; the early-apex passage is cited beside it as the situation,
not as a source for either bar.

**Out of hash, and off the gate.** `standing` appears in no `Verdict`, `Sample`,
`result_hash`, `spec_hash`, or `E(line)`; it never affects an exit code. It is
the same class of object as `correctiveShot`'s shadow: a pure function of a
finished result, recomputable by any consumer, shipped by nothing. `outcome`
remains recomputable identically under any rubric pack (`P-OUTCOME-RUBRIC-FREE`);
`standing` is deliberately the opposite and says so.

**Cost.** Zero engine runs, zero new TUNING constants: a verdict lookup and a
threshold fold.

### 6.5 The commitment report (out-of-hash, D45, gated)

`verdict.commitment: CommitmentReport | null` — present only when the analysis
was requested, and excluded from `result_hash` unconditionally and permanently
(§8.3). The shape is owned by `03-…md` §7a.7 and is not restated here; `05` owns
only the siting. No check reads it, now or ever, by decision (`01-…md` §A.1,
`03-…md` §7a.10). No `Sample` field is added: the channel is per-probe, not
per-sample, so §2.1's pinned append-only field table is untouched.

---

## 7. The multi-line result envelope (D6)

The prior design had no result type for a *figure* — mistake overlays were
renderer-internal and unshareable. linelab's top-level result is the envelope:

```
FigureResult = {
  spec: "linelab/1",
  figure_id,
  road,                              // ONE composed RoadModel — all lines share it
  occluders: [Occluder],             // resolved absolute form (03 §4)
  hazards:   [Hazard],               // resolved absolute form — diff consumers locate a
                                     // patch without re-deriving placements
  lines: [ LineResult | LineRefusal ],   // 1..N, order = draw order
  standing?: [StandingReport],       // out-of-hash analysis attachment, one row per
                                     //   non-refused line, present ONLY when requested
                                     //   (`--standing`, 08 §3); §6.4 owns the shape
  skew,                              // null | the version-skew record (§8.4)
  meta: { title?, caption?, view? }  // presentation hints only, never physics
}

LineResult = {
  line_id,                           // stable string
  role: "ideal" | "alternative" | "mistake" | "reference",
  label,                             // legend text
  source:                            // how this line came to be — the shareable part
      { kind: "scenario", scenario }                       // explicit plan
    | { kind: "solve",    solveSpec }                      // solver-authored (04)
    | { kind: "mistake",  base_line_id, mistakeSpec }      // one-perturbation compile (03)
    | { kind: "misjudge",                                  // believed-road line (04 §8)
        solve: solveSpec,                                  //   solved in the believed world
        believed_road,                                     //   DSL string or {preset} value
        sugar: null | { kind: "underread" | "overread", params, corner_id } },
  resolved_scenario,                 // the complete post-validation wire Scenario (03 §6,
                                     // canonical form) the engine integrated for THIS line
  cache: "hit" | "stale_engine" | "stale_spec" | "absent",   // solved-plan cache provenance (§8.1)
  trajectory,                        // full Sample/Event contract, §2–§5
  verdict                            // full Verdict, §6
}

LineRefusal = {
  line_id, role, ok: false,
  error: { code, at, message, schema_ref?, detail? }     // e.g. NO_SOLUTION
}
```

Rules:

- **Identical citizenship.** Every line — role `mistake` included — carries the
  full trajectory and full verdict. `stateAt`, the stepper, the POV, and the CSV
  export accept any `line_id`. There is no lesser record for failed lines.
- **Refusals are first-class entries, not silence.** A line whose solve was
  refused stays in `lines` as a typed `LineRefusal` keyed by `line_id`: the bake
  stays total, nothing is dropped silently, and the refusal participates in the
  expectation-gating law (`08` §3.1). Refused lines draw nothing.
- **`resolved_scenario` is present on every `LineResult`, whatever
  `source.kind`:** for `scenario` sources it is the validated normalization of
  the authored scenario; for `solve` sources, the canonical actions the solver
  produced; for `mistake` sources, the base plan with the one perturbation
  applied (controller-level perturbations included, via the wire fields
  `rider.roll_rate_cap_dps` and the throttle action's `freeze_steer_s`, `03`
  §6.1); for `misjudge` sources, the literalized executed plan. It is
  self-contained (resolved road, occluders, hazards): saving it to a file and
  running it is a complete, legal invocation. It is **output provenance** —
  excluded from `spec_hash` (§8.1) but its plan is covered by `result_hash`
  (§8.3). `stateAt.derived.action`, `explain`, and `sweep`'s `plan.` root all
  address against it.
- **`standing` is an attachment, not a record.** The optional top-level
  `standing` array is the siting for `--standing` on any verb that emits a
  `FigureResult` (`08` §3); it is written only when requested, is absent
  otherwise, and holds exactly what the pure `standing(lineResult)` returns
  (§6.4) — refused lines get no row. It sits **beside** `lines`, never inside a
  `LineResult` and never inside a `Verdict`, so it enters no hash and no gate
  (§8, §8.3). A consumer that drops it loses nothing recomputable.
- **One road per figure.** Lines that need different roads are different
  figures. (A `misjudge` line's believed-world run is *not* a line in the
  figure — its identity travels as the two hashes in `verdict.misjudgment`.)
- **Roles are labels.** Colour derives from each line's own verdict (D9, mapping
  owned by `06-rendering-and-projection.md`); the envelope stores no colour, and
  roles never gate (`08` §3.4).
- **Provenance is causal.** A `mistake` line's `source` names its base line and
  the one perturbation applied; a `misjudge` line's `source` carries one belief
  (never combined with a control-channel delta); a `solve` line's `source`
  records the solver inputs — a `run` that delegated to the solver records
  `source.kind = "solve"`. Given `road` + `source`, the engine reproduces the
  trajectory exactly — which is what makes the envelope shareable (§8).
- `skew` and `cache` describe the *relationship between* runs (stamped vs
  recomputed); both are excluded from `result_hash` (§8.3).

---

## 8. Sharing, export, and identity

**Out-of-hash analysis products.** Three pure functions return documents that are
*about* a result without being *part* of it: `correctiveShot(lineResult)` (the
save shadow, §6.3), `standing(lineResult)` (§6.4), and
`saveWindow(lineResult, cornerId?)` (`04-…md` §4b). All three are recomputable
from a shared envelope by any consumer, all three carry their own provenance
stamps, and none contributes a byte to `spec_hash` or `result_hash`. A consumer
that stores one stores an analysis, not a record. Requesting one may **attach**
it — `FigureResult.standing` (§7) is the declared siting for `--standing` — but
attachment beside `lines` is not membership: the attached document is still
outside every hash and every gate. `verdict.commitment` (§6.5) is
the one analysis document that is sited *inside* the envelope rather than outside
it, and it is therefore the one that needs a hash-exclusion entry (§8.3).

### 8.1 What is shared: specs, never trajectories

The shareable object is the **FigureSpec** — the envelope minus every computed
member; the optional `expected` stamps are falsifiable predictions of
recomputation, never inputs to it:

```
FigureSpec = { spec: "linelab/1", figure_id, road_spec,
               engine_semver?,                 // "1.4.2" — exporter stamp (§8.4); excluded
                                               //   from spec_hash
               lines: [ { line_id, role, label, source,
                          expect?,             // authored gate declaration — IN spec_hash
                          expected?,           // exporter stamp — excluded from spec_hash
                          solved? } ],         // cached solver conclusion — excluded
               meta }

expect   = { outcome?: [<outcomeClass>…], checks_fail?: [checkId…] }
expected = { outcome,                          // member of the §6.1 closed set
             result_hash }                     // fnv-1a first-6-hex (§8.3)
solved   = { spec_hash,                        // fnv-1a over canonical {road_spec, occluders,
                                               //   hazards, this line's source}
             plan: [PlanAction…] }             // resolved wire plan, absolute stations, exactly
                                               //   the 03 §6.1 schema — no apex field, no
                                               //   trajectory; must pass validate()
```

- **`expect`** is the authored expectation the gate law (`08` §3.4) checks a
  line against. It is **deliberately JSON-only** — no scene-text key, no flag:
  gate declarations are share/CI metadata on the canonical spelling (D30 —
  scene text is authoring sugar, not an expectation surface).
- **`expected`** is written by exporters (§8.4's stamping rule), never by
  authors as truth: nothing downstream renders from it; it exists only to be
  falsified. Validation (typed): `engine_semver` must match `^\d+\.\d+\.\d+$`
  else `SCHEMA`; `expected.outcome` must be a member of the closed outcome set
  else `SCHEMA`; `expected.result_hash` must match `^[0-9a-f]{6}$` else
  `SCHEMA`; an `expected` block on a spec carrying no `engine_semver` is
  rejected `SCHEMA` ("expectation without an engine to expect it from").
- **`solved`** is the solver's cached conclusion, written automatically by
  `scene` bakes and `export --as share-url|envelope` for every `solve`- and
  `mistake`-sourced line; it **must not ship without the stamps**
  (`engine_semver` + `expected`). Load semantics: valid iff `engine_semver`
  equals the running engine's **and** `spec_hash` recomputes equal — then skip
  the search, run the engine **once** on the cached plan, and compute the
  verdict fresh; if the fresh outcome or hash diverges from `expected`, fall
  back to a full re-solve and render the divergence placard (§8.4). Invalid →
  drop the cache and re-solve. Never silent: `LineResult.cache` (§7) records
  `hit | stale_engine | stale_spec | absent`. A cached plan is an *input* — a
  wire plan carrying no trajectory — so D6/D7 hold: the cache may change the
  time, never the answer.
- `resolved_scenario` is engine output; it never rides the share URL and is
  excluded from `spec_hash`.

Every consumer **recomputes** trajectories and verdicts from the spec with the
same engine (D6). The prior "one trajectory per URL, good line only" constraint is
gone because trajectories never ride the wire at all — the honesty property
("never ship a trajectory the engine didn't produce") is preserved by
construction, now covering N lines instead of restricting to one.

**URL form (carried mechanism, new payload):**
`#f=<base64url(deflateRaw(canonicalize(FigureSpec)))>` — deflate-raw compressed,
base64url-encoded (`+`→`-`, `/`→`_`, padding stripped). A single-line scenario may
still ride `#s=<…scenario…>` for the trivial case. Share URLs carry the `solved`
cache by default (opt-out: `08` §4.1's `--no-cache`).

### 8.2 Export formats

| Format | Contents |
|---|---|
| **Result JSON** | The full `FigureResult`, canonical key order, frozen shape of §7. The complete machine-readable record. |
| **Trace CSV** (per line) | One row per sample. **Pinned column order:** `s, t, x, y, psi, v, phi, kappa, a_long, a_lat, grip, mu, d, f, cmd_lean, cmd_a, roll_rate, action_id, clipped, n_long, n_lat, sight_m, ssd_m, limit_x, limit_y, sight_ride_m, steer_state, lat_action_id, su_sustained, su_transient, a_cmd_rate, below_validity` — the Sample contract in declaration order, append-only like it. |
| **Static SVG** | Rendered figures via `06-rendering-and-projection.md`; the export manifest records the view spec, mode, and proportion-gate metrics. |

### 8.3 Identity and determinism

Carried intact: `canonicalize` = JSON of recursively key-sorted objects (arrays
keep order); `spec_hash` = fnv-1a over the canonical spec, first 6 hex. Pure
fnv-1a, no crypto dependency, byte-identical in Node and browser.

**`spec_hash` is computed on the lowered form.** Scene text lowers through the
pure, total `lowerScene` to FigureSpec JSON before hashing, so scene text vs
JSON never changes identity. The hash covers `road_spec`, every line's `source`,
and authored `expect` blocks; the exporter stamps (`engine_semver`, `expected`,
`solved`) and all computed members are excluded. A `FigureSpec` hashes as one
identity covering all line sources.

**The `result_hash` law:**

```
result_hash = fnv1a( canonicalize({ verdict: V′, plan }) ), first 6 hex
  V′   = the canonical verdict minus {result_hash, diagnosis}
  plan = resolved_scenario.rider.plan, carrying rider.roll_rate_cap_dps when present
```

The full exclusion list is `{result_hash, diagnosis, cache, skew, commitment}`:
the first two are verdict members removed before hashing; `cache` (§7) and `skew`
(§7, §8.4) live outside the verdict and never enter it — they describe the
relationship between runs, not this run; and `commitment` (§6.5) is a verdict
member that is removed before hashing **unconditionally and permanently** (D45).
No configuration, phase or Tier moves `commitment` into `result_hash`, and no
check reads it — the Tier B promotion that would have required otherwise is
struck by decision, not deferred. `belief_admissible` and `actual_road_refuted`
ride *inside* `CommitmentReport` and are covered by that single exclusion rather
than by nested ones. Until D45 is promoted the shipped `schema` omits
`commitment` entirely, per the phase-gating law (`00-…md` §3); the exclusion is
written into the design of record now because the siting is what makes the
feature affordable.

The out-of-hash analysis documents `StandingReport` (§6.4) and `SaveWindow`
(`04-…md` §4b) need **no** exclusion entry: `result_hash` is computed over the
verdict and the resolved plan, and neither document is a `Verdict` member. The
optional `FigureResult.standing` attachment (§7) sits above that boundary
entirely — it changes no verdict, so it moves no `result_hash`, and it is not a
`FigureSpec` member, so it moves no `spec_hash` (§8.1). There is nothing to
exclude because there is nothing inside.

`result_hash` covers the resolved plan (D29). Covering it makes a
solver that converges to a different plan under an unchanged rounded verdict a
caught regression, not an invisible one. Sample appends alone move **no hash**.
Every hash-moving change lands in ONE re-bless commit with its causes
enumerated (`09-verification-and-testing.md` §3.3).

The centralized emission-rounding policy is carried: metres / km/h / degrees to
2 dp, fractions (grip, `f`, `n_*`) to 3 dp, apex `pct` to 1 dp — applied **only**
at the verdict/CSV boundary, never inside samples, and any change to it is a
deliberate re-bless event. The engine is deterministic (no wall clock, no RNG,
fixed stepping); the regression gates built on these hashes are owned by
`09-verification-and-testing.md`.

### 8.4 Version skew and the divergence placard

**Stamping rule.** `export --as share-url|envelope`, `scene` bakes, and the
viewer's "copy share link" always stamp `engine_semver` and per-line `expected`
from the *current* recomputed results — re-sharing re-stamps, so a forwarded URL
always describes the engine that last exported it, and placard chains never grow
stale transitively. Cost: ~8 bytes for the semver plus ~40 bytes per stamped
line before deflate.

**Semver discipline.** The engine version is the package version. Any re-bless
commit — any commit in which hashes move — MUST bump minor or major; commits
that cannot move any hash may bump patch. Corollary: equal `engine_semver` on
the pinned runtime implies equal `result_hash` for equal specs; a hash
difference at equal semver is either a cross-runtime tolerance artifact or a
determinism bug.

**Divergence evaluation.** Every consumer entry point that loads a FigureSpec
(viewer `#f=`, `run`/`render`/`serve`/`export` given FigureSpec JSON) recomputes
per D6, then compares. Per line, with `expected` present:

```
story  :=  recomputed.outcome ≠ expected.outcome                     // a different story
detail :=  ¬story ∧ recomputed.result_hash ≠ expected.result_hash    // numbers moved, story held
```

Tier enum (closed, ordered): `"match" < "unstamped" < "detail" < "story"`, plus
the figure-level `"info"`. The record lands in `FigureResult.skew` (§7):

```
skew: null                                     // spec carried no engine_semver
    | { spec_semver, engine_semver,            // stamped vs current
        same_engine,                           // boolean, semver equality
        lines: [ { line_id,
                   tier: "match" | "unstamped" | "detail" | "story",
                   expected: {outcome, result_hash} | null,
                   got:      {outcome, result_hash} } ],
        tier: "match" | "info" | "detail" | "story" }
```

Figure tier = max of line tiers, except: when the semvers differ and no line
exceeds `match`/`unstamped`, figure tier is `"info"`. `detail` firing at *equal*
semver is expected across runtimes (bit-exactness is scoped to the pinned
runtime) — which is why `story` keys on the discrete outcome, never the hash,
and why `detail` is the quiet tier.

**The placard.** Figure tier `story` renders the full placard; `detail` and
`info` render a one-line badge. The viewer renders it as a banner on load;
`render` of a stamped stale spec draws it as a figure-level annotation box in
the exported SVG. The placard is a **rendered element, never an error**: the
figure always recomputes, renders, and stays fully inspectable —
stale-figures-first-class, exactly as failed lines are. Wording (exact, `{}`
substituted):

- `story`: **"Recomputed by engine {engine_semver}. This figure was shared from
  engine {spec_semver}: line '{label}' was {expected.outcome}, now
  {got.outcome}. Captions and labels were written for the original behaviour."**
  (One clause per story-tier line.)
- `detail` badge: *"recomputed under {engine_semver}: numeric details differ
  from the shared version (same outcomes)."*
- `info` badge: *"shared from engine {spec_semver}, recomputed under
  {engine_semver}."*

CLI behaviour: skew never blocks and never changes an exit code by itself — the
tier rides in the envelope's `skew` member — except under `run --gate`, where
figure tier `story` exits 3 (`08` §3.1): a teaching artifact whose captions no
longer match its recomputation is a doctrine-tier CI failure.

---

## 9. Relation to the prior design

**Carried:** the Sample spine and its field meanings; the frozen/never-throw
Result discipline; strict outcome precedence as one deterministic headline; the
closed error vocabulary; event bracketing with exact crossings; fnv-1a canonical
hashing and the emission-rounding policy; `f` (lane fraction) as the
doctrine-facing lateral coordinate; the `diagnosis`-excluded-from-hash rule.

**Changed:** commanded controls (`cmd_lean, cmd_a, roll_rate, action_id, clipped,
n_long, n_lat`) are now *recorded* per sample instead of computed-and-dropped;
sight is per-sample from the rider's eye with the limit point's world coordinates
carried (D4), and every safety judgment compares in rider-path metres via
`sight_ride_m` (D16); the samples/channels split is collapsed into one pinned
array; the outcome vocabulary is the physics-only
`crash > runoff > wide > stopped > contained` with `clean` a derived predicate
and `violation`/`dnf-spec-error` retired (D11); `terminated` carries the closed
six-reason set and the bracketed final `(x, y)` (D19); the result's top level is
a multi-line `FigureResult` with identical citizenship for failed lines and
typed `LineRefusal` entries for refused ones (D6); sharing carries N line
*specs* instead of one trajectory; `checks_version` bumps to 2 with the rubric
pack identity recorded per verdict (D12); `stand_up` joins the diagnosis
vocabulary (D3); `result_hash` extends over the resolved plan (D29); the phase
vocabulary is the five-token machine of §4.1 (D41); `corrective.fail_reason`
loses `shadow_stopped`, which was unreachable on its whole domain and is deleted
rather than documented (D42, `04-…md` §4a.5).

**New:** `stateAt` — the per-instant query that turns this contract into an
inspection surface; the interpolation contract that makes time-stepping
well-defined; events-as-bookmarks as a named API concept; the verdict's
per-constraint evaluation block (D10); `resolved_scenario` in every `LineResult`
(D29); the corrective, misjudgment, acceptance, and validity verdict blocks; the
share-URL skew stamps, the `solved` plan cache, and the divergence placard
(D31); `standing(lineResult)`, `StandingReport` and the out-of-hash
`FigureResult.standing` attachment (§6.4, §7); the `commitment`
verdict member and its permanent hash exclusion (§6.5, §8.3);
`stateAt.derived.commitment_probe` (§4).

**Defects this contract closes:** controls derivable-but-not-inspectable; the
one-trajectory-per-URL cap; unpinned channel columns; mistake lines as
second-class unshareable overlays.
