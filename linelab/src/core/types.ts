// core/types.ts — the engine-facing type vocabulary (ARCHITECTURE §4).
// `core` imports nothing. It defines the interfaces it CONSUMES (`RoadModel`,
// `SightCaster`, `World`) — `road/` and `sight/` produce values satisfying them;
// composition happens in `solve/run.ts`.
//
// Frame and unit laws (§6.1): world frame is x-east, y-down; `+kappa` = right-hand
// turn; `phi`/`cmd_lean` positive = right lean; road offset `d` positive to the
// rider's LEFT. Internal math is SI + radians (`State`); the `Sample` record stores
// angles in DEGREES per design/05 §2.1. The rad→deg conversion happens in exactly
// one file: `core/record.ts`, via the helpers in `core/units.ts`.
//
// Closed sets are copied VERBATIM from the design docs (drift risk #12) into single
// `as const` declarations with double-entry enumeration tests in
// `test/hash/hash.test.ts`.

// ---------------------------------------------------------------------------
// Hands & shared literals

/** Corner / turn-in handedness. `handSign("R") = +1` (core/units.ts). */
export type Hand = "L" | "R";

/** design/03 §2 corner record `type` field. */
export type CornerType = "constant" | "decreasing" | "increasing";

/** design/03 §5 stopping-sight-distance model names (each carries its own t_react_s). */
export const SSD_MODELS = ["alert", "aashto"] as const;
export type SsdModel = (typeof SSD_MODELS)[number];

/** design/02 §3 rider profile names (values live in core/constants.ts, all TUNING). */
export const RIDER_PROFILE_NAMES = ["casual", "street", "trained", "racer"] as const;
export type RiderProfileName = (typeof RIDER_PROFILE_NAMES)[number];

/** design/02 §3 rider profile parameters (table values in core/constants.ts). */
export interface RiderProfile {
  /** deg/s — profile roll-rate; `roll_rate_eff = min(roll_rate_dps, rider.roll_rate_cap_dps)`. */
  readonly roll_rate_dps: number;
  /** — derates RESERVES only (02 §4); never a physical ceiling. */
  readonly skill: number;
  /** s — recognition delay consumed by the corrective shot (04). */
  readonly t_react_s: number;
}

// ---------------------------------------------------------------------------
// Internal state (SI + radians)

/** Integrator state vector (design/02 §2) — INTERNAL, SI units, angles in RADIANS. */
export interface State {
  /** s — time */
  readonly t: number;
  /** m — world x (east) */
  readonly x: number;
  /** m — world y (down) */
  readonly y: number;
  /** rad — heading (world frame) */
  readonly psi: number;
  /** m/s — forward speed */
  readonly v: number;
  /** rad — lean (roll) angle, signed, + = right lean */
  readonly phi: number;
}

// ---------------------------------------------------------------------------
// Steering machine / phase / termination / outcome closed sets

/** design/02 §3.1 — closed enum, four states, one owner per control step. */
export const STEER_STATES = ["track", "commit", "unwind", "position"] as const;
export type SteerState = (typeof STEER_STATES)[number];

/**
 * design/05 §2 / design/02 §7 — closed six-value set, declared in the per-step
 * termination PRECEDENCE order: crash > off_road > stopped > road_end > max_time > max_dist.
 */
export const TERMINATED_REASONS = [
  "crash", "off_road", "stopped", "road_end", "max_time", "max_dist"
] as const;
export type TerminatedReason = (typeof TERMINATED_REASONS)[number];

/** design/05 §2 — `(x, y)` is the bracketed final position (exact road-edge crossing for off_road). */
export interface Terminated {
  readonly reason: TerminatedReason;
  readonly s: number;
  readonly t: number;
  readonly x: number;
  readonly y: number;
}

/**
 * design/05 §6.1 — closed outcome set, declared in PRECEDENCE order
 * (crash > runoff > wide > stopped > contained). Physics-only: never reads a
 * doctrine check (P-OUTCOME-RUBRIC-FREE). `clean` is a derived predicate, not a value.
 */
export const OUTCOMES = ["crash", "runoff", "wide", "stopped", "contained"] as const;
export type Outcome = (typeof OUTCOMES)[number];

/** design/05 §4.1 — closed five-token phase set, disjoint from anchors and event kinds. */
export const PHASES = ["approach", "turning", "midcorner", "exiting", "done"] as const;
export type Phase = (typeof PHASES)[number];

// ---------------------------------------------------------------------------
// Events (design/05 §5)

/**
 * design/05 §5 — the closed event-kind set, copied VERBATIM in the doc's
 * declaration order (event-time ties resolve by this declaration order).
 */
export const EVENT_KINDS = [
  "brake_start",
  "brake_end",
  "turn_in",
  "steering_complete",
  "crack",
  "roll_on",
  "apex",
  "exit",
  "release",
  "position_start",
  "position_complete",
  "position_shortfall",
  "sight_min",
  "run_wide_detect",
  "correction",
  "off_road",
  "hazard_visible",
  "violation",
  "crash",
  "stop",
  "road_end"
] as const;
export type EventKind = (typeof EVENT_KINDS)[number];

/**
 * design/05 §5 — `Event = { kind, s, t, line_note?, corner_id?, action_id?, detail? }`.
 * Event `s`/`t` are exact bracketed crossings, never snapped to the 0.5 m grid.
 * Events are strictly ordered by `t` (ties by EVENT_KINDS declaration order).
 */
export interface Event {
  readonly kind: EventKind;
  readonly s: number;
  readonly t: number;
  readonly line_note?: string;
  readonly corner_id?: string;
  readonly action_id?: string;
  readonly detail?: Readonly<Record<string, unknown>>;
}

// ---------------------------------------------------------------------------
// The Sample record (design/05 §2.1 — pinned, append-only; angles in DEGREES)

/**
 * design/05 §2.1 / §8.2 — the pinned Sample field order (= the Trace CSV column
 * order). This array is the ONE source for CSV emission and enumeration tests.
 * New fields are APPENDED by design change only; never renamed/reordered/repurposed.
 */
export const SAMPLE_FIELDS = [
  // Kinematics & dynamics — written by core/ (the integrator)
  "s", "t", "x", "y", "psi", "v", "phi", "kappa",
  "a_long", "a_lat", "grip", "mu", "d", "f",
  // Commanded controls — recorded every sample
  "cmd_lean", "cmd_a", "roll_rate", "action_id", "clipped", "n_long", "n_lat",
  // Sight — cast from the rider's ACTUAL position (D4)
  "sight_m", "ssd_m", "limit_x", "limit_y",
  // Merged append block — pinned CSV order after limit_y
  "sight_ride_m", "steer_state", "lat_action_id",
  "su_sustained", "su_transient", "a_cmd_rate", "below_validity"
] as const;
export type SampleField = (typeof SAMPLE_FIELDS)[number];

/**
 * One full-precision record on the `ds_m` arc grid (design/05 §2.1, field order
 * pinned = SAMPLE_FIELDS). Raw f64 — rounding happens only at export boundaries.
 * Angles in DEGREES here (psi, phi, cmd_lean; roll_rate/su_* in deg/s) — the one
 * rad→deg conversion point is core/record.ts.
 */
export interface Sample {
  /** m — arc-length station along the road centreline */
  readonly s: number;
  /** s — sim time since run start; strictly monotone */
  readonly t: number;
  /** m — world position of the bike (point-mass) */
  readonly x: number;
  /** m */
  readonly y: number;
  /** deg — heading (world frame) */
  readonly psi: number;
  /** m/s — speed */
  readonly v: number;
  /** deg — lean angle, signed: + = right-hand lean (y-down frame, 02 §2) */
  readonly phi: number;
  /** 1/m — path curvature actually ridden (= g·tan(phi)/v²) */
  readonly kappa: number;
  /** m/s² — DELIVERED longitudinal acceleration (post-clip) */
  readonly a_long: number;
  /** m/s² — lateral acceleration (= v²·kappa) */
  readonly a_lat: number;
  /** 0..1 — friction-ellipse margin, 1 − ellipseMag */
  readonly grip: number;
  /** — local friction coefficient at (s, d) */
  readonly mu: number;
  /** m — signed lateral offset from centreline, positive to the rider's LEFT */
  readonly d: number;
  /** — lane fraction in the governing corner's frame: 0 = inner usable edge, 1 = outer, f > 1 = beyond corridor */
  readonly f: number;
  /** deg — controller's lean setpoint; signed like phi */
  readonly cmd_lean: number;
  /** m/s² — COMMANDED longitudinal accel (brake < 0, drive > 0) */
  readonly cmd_a: number;
  /** deg/s — roll-rate cap in force: roll_rate_eff = min(profile rate, rider.roll_rate_cap_dps when present) */
  readonly roll_rate: number;
  /** id of the plan action currently driving control */
  readonly action_id: string | null;
  /** true when the friction ellipse limited cmd_a → a_long */
  readonly clipped: boolean;
  /** −1..1 — normalised ellipse component a_long / aLongMax(mu) */
  readonly n_long: number;
  /** −1..1 — normalised ellipse component a_lat / aLatMax(mu) */
  readonly n_lat: number;
  /** m — geometric sight distance from eye at (x, y); speed-independent; centreline-station basis */
  readonly sight_m: number;
  /** m — stopping sight distance at current v and this sample's own phi (lean-aware, 03 §5.2) */
  readonly ssd_m: number;
  /** m — world coordinates of the limit point */
  readonly limit_x: number;
  /** m */
  readonly limit_y: number;
  /** m — sight distance re-based in rider-path metres; SOLE basis for sight-vs-stopping judgments (D16) */
  readonly sight_ride_m: number;
  /** steering-machine state (02 §3.1) */
  readonly steer_state: SteerState;
  /** id of plan action owning the lateral channel; unwind carries null; track null outside a completed-position hold */
  readonly lat_action_id: string | null;
  /** deg/s — signed roll-rate contribution of the sustained stand-up term actually applied this step */
  readonly su_sustained: number;
  /** deg/s — signed roll-rate contribution of the transient (chop) stand-up term actually applied this step */
  readonly su_transient: number;
  /** m/s³ — the step's ZOH commanded-accel rate (audits the transient trigger) */
  readonly a_cmd_rate: number;
  /** model-validity flag: v < v_valid_min_ms AND |phi| ≥ 2°; resampling ORs it per bracket */
  readonly below_validity: boolean;
}
// Normative identity (never a stored column): phi_dot_su ≡ su_sustained + su_transient.

/** design/05 §2 — a run's deep-frozen record: samples + events + terminated. */
export interface Trajectory {
  readonly samples: readonly Sample[];
  readonly events: readonly Event[];
  readonly terminated: Terminated;
}

// ---------------------------------------------------------------------------
// Road interfaces core CONSUMES (road/ implements; ARCHITECTURE §2)

/**
 * design/03 §2 corner record — minted per curved segment at compose(), ids
 * `c1, c2, …` in segment order. Road properties, never solver guesses.
 */
export interface Corner {
  readonly id: string;
  readonly hand: Hand;
  /** m — entry boundary station */
  readonly s0: number;
  /** m — exit boundary station (the governing-corner handoff station) */
  readonly s1: number;
  /** m — mid station */
  readonly s_mid: number;
  /** m — representative radius (arcs: the radius; sub-ratio tapers: (r1+r2)/2) */
  readonly r: number;
  /** deg — swept angle */
  readonly angle_deg: number;
  readonly type: CornerType;
  /** m — taper endpoint radii (absent on arcs) */
  readonly r1?: number;
  readonly r2?: number;
  /** m — extremal local radii; equal for arcs */
  readonly r_min: number;
  readonly r_max: number;
  /** m — straight length to next corner's s0 (0 when adjacent; absent on the last corner) */
  readonly gap_to_next_m?: number;
  /** gap_to_next_m ≤ LINK_GAP_FRAC · min(L_arc(n), L_arc(n+1)) */
  readonly linked_next: boolean;
}

/**
 * The composed-road interface the engine consumes (design/03 §2). `road/compose`
 * produces a frozen value satisfying it (its impl may carry more — segments,
 * dense station table — typed in road/types.ts).
 *
 * Conventions: stations `s` in metres from road start; road starts at the origin
 * heading +x; physical edges at `|d| = lane_width_m`; the corridor algebra
 * (governing-corner rule, hand-aware f↔d mapping, opposite-hand `f`-flip at s1
 * handoffs) lives INSIDE dOf/fOf — callers never re-derive it.
 */
export interface RoadModel {
  /** m — half carriageway width; off_road fires at |d| > lane_width_m */
  readonly lane_width_m: number;
  /** m — usable-corridor inset (default home: core/constants BIKE_MARGIN_DEFAULT_M) */
  readonly bike_margin_m: number;
  /** true → corridor is the full carriageway inset at outer edges only (03 §2) */
  readonly use_full_width: boolean;
  /** m — total centreline length; the road_end station */
  readonly total_len_m: number;
  /** corner records, in station order */
  readonly corners: readonly Corner[];
  /** rad — road heading at station s (psi_exit(c) = psi_road(c.s1)) */
  readonly psi_road: (s: number) => number;
  /** 1/m — signed road curvature at s; +kappa = right-hand turn */
  readonly kappa_road: (s: number) => number;
  /** m — signed offset d for lane fraction f at station s (governing-corner frame) */
  readonly dOf: (f: number, s: number) => number;
  /** — lane fraction f for signed offset d at station s (governing-corner frame) */
  readonly fOf: (d: number, s: number) => number;
  /** — local friction at (s, d); defined on the carriageway, laterally clamped beyond it (03 §2) */
  readonly muAt: (s: number, d: number) => number;
  /** world position → road frame: nearest-centreline projection to {s, d} */
  readonly project: (x: number, y: number) => { readonly s: number; readonly d: number };
}

// ---------------------------------------------------------------------------
// Sight interface core CONSUMES (sight/ implements; composed in solve/run.ts)

/** Return shape of a single cast — matches sightFrom (design/03 §5.1). */
export interface SightCast {
  /** m — geometric sight distance (centreline-station basis) */
  readonly sight_m: number;
  /** world coordinates of the limit point */
  readonly limit_point: { readonly x: number; readonly y: number };
  /** m — centreline station of the limit point */
  readonly s_limit: number;
}

/** Return shape of the ONE ssd definition (design/03 §5.2, sight/ssd.ts). */
export interface SsdBreakdown {
  readonly ssd_m: number;
  readonly react_m: number;
  readonly standup_m: number;
  readonly brake_m: number;
}

/**
 * Per-sample sight services the integrator invokes. `solve/run.ts` composes it
 * from sight/'s pure `sightFrom` and `ssd`, closing over the scenario's
 * occluders, ssd model, and rider profile.
 */
export interface SightCaster {
  /** cast from the rider's ACTUAL eye position (D4) */
  readonly cast: (eye: { readonly x: number; readonly y: number }) => SightCast;
  /** lean-aware stopping sight distance at (v, phi, mu); model/profile closed over */
  readonly ssd: (v_ms: number, phi_rad: number, mu: number) => SsdBreakdown;
}

/** The composed environment one line integrates in (assembled in solve/run.ts). */
export interface World {
  readonly road: RoadModel;
  readonly sight: SightCaster;
  readonly occluders: readonly ResolvedOccluder[];
  readonly hazards: readonly ResolvedHazard[];
}

// ---------------------------------------------------------------------------
// Resolved scenario (frozen post-validate wire form the engine consumes)
//
// `plan/validate.ts` is the sole producer. It stays EXACTLY within the 03 §6
// wire-Scenario schema (canonical form): anchors resolved to absolute stations,
// defaults filled, ids minted — so `resolved_scenario` rides the envelope
// verbatim and `solved.plan` still passes validate() (design/05 §7, §8.1).

/**
 * Canonical resolved road form (design/03 §2.1): the originating DSL rides along
 * verbatim; agents never hand-expand segments. `segments` is left structurally
 * opaque here because the `Segment` union is owned by road/types.ts
 * (ARCHITECTURE §4) and core imports nothing.
 */
export interface ResolvedRoadSpec {
  readonly lane_width_m: number;
  readonly bike_margin_m: number;
  readonly use_full_width: boolean;
  /** road/types.ts `Segment[]` — opaque at core rank */
  readonly segments: readonly unknown[];
  readonly dsl: string;
}

export type OccluderKind = "hedge" | "wall" | "bank" | "vehicle";
export type OccluderSide = "inside" | "outside" | "left" | "right";
export type VehicleLane = "own" | "oncoming";

/**
 * design/03 §4.1 Occluder, post-validation: id minted (`o1, o2, …`), anchor
 * resolved to the absolute-station member of the wire union, defaults filled
 * (vehicle len_m/width_m — values owned by road/constants.ts).
 * Band kinds (hedge/wall/bank): side + span_m required, margin_m/depth_m optional.
 * Vehicles: exactly one of lane ⊕ f ⊕ side; no span_m.
 */
export interface ResolvedOccluder {
  readonly id: string;
  readonly kind: OccluderKind;
  readonly side?: OccluderSide;
  readonly at: { readonly at_s: number };
  /** m — band kinds only, extends in +s */
  readonly span_m?: number;
  /** m — lateral margin from the usable edge */
  readonly margin_m?: number;
  /** m — band depth (hedge/wall/bank) */
  readonly depth_m?: number;
  /** m — vehicle length (default filled at validation) */
  readonly len_m?: number;
  /** m — vehicle width (default filled at validation) */
  readonly width_m?: number;
  readonly lane?: VehicleLane;
  /** vehicle lateral escape hatch — lane fraction */
  readonly f?: number;
}

export type HazardSide = "inside" | "outside" | "left" | "right" | "center";

/**
 * design/03 §4.2 Hazard, post-validation: id minted, anchor absolute, defaults
 * filled (width_m, mu — values owned by road/constants.ts). μ-override band
 * flush against the named usable edge, or centred on f = 0.5 for "center".
 */
export interface ResolvedHazard {
  readonly id: string;
  readonly kind: "gravel";
  readonly side: HazardSide;
  readonly at: { readonly at_s: number };
  /** m — extends in +s */
  readonly span_m: number;
  /** m */
  readonly width_m: number;
  /** — mu > 0 */
  readonly mu: number;
}

/**
 * design/03 §6.1 plan actions, post-validation: absolute `at_s` (the canonical
 * scenario always carries absolute stations), defaults filled, `turn_in`
 * rewritten to the fully explicit `{lean_deg, hand}` form. The governing-corner
 * binding (02 §3.1) is thereby RECORDED as the explicit `hand`: the corner is
 * re-derived deterministically as the one with the smallest `s1 > at_s` whose
 * hand equals the action's hand (one rule, one implementation, road-rank).
 */
export type ResolvedPlanAction =
  | ResolvedBrakeAction
  | ResolvedTurnInAction
  | ResolvedThrottleAction
  | ResolvedPositionAction;

export interface ResolvedBrakeAction {
  readonly do: "brake";
  readonly id: string;
  readonly at_s: number;
  /** m/s² — > 0 */
  readonly decel: number;
  /** m — optional taper-to-zero-by station */
  readonly taper_to_s?: number;
  /** m/s³ — filled with A_SLEW_DEFAULT when unauthored */
  readonly slew_mss: number;
}

export interface ResolvedTurnInAction {
  readonly do: "turn_in";
  readonly id: string;
  readonly at_s: number;
  /** fully explicit post-validate/solve — `tangent_inside` never survives here */
  readonly target: { readonly lean_deg: number };
  /** explicit hand — the recorded governing-corner binding */
  readonly hand: Hand;
}

export interface ResolvedThrottleAction {
  readonly do: "throttle";
  readonly id: string;
  readonly at_s: number;
  /** m/s² — ≥ 0; 0.0 = maintenance crack */
  readonly accel: number;
  /** m/s³ — filled with A_SLEW_DEFAULT when unauthored */
  readonly slew_mss: number;
  /** s — steering freeze window (0, FREEZE_MAX_S]; roll_cmd = 0, steer_state unchanged */
  readonly freeze_steer_s?: number;
}

export interface ResolvedPositionAction {
  readonly do: "position";
  readonly id: string;
  readonly at_s: number;
  /** exactly one of f | d after validation */
  readonly f?: number;
  readonly d?: number;
  /** m — completion budget; "auto" resolved to metres at validation */
  readonly over_m: number;
}

/** Post-validation start state: defaults filled (f = 1.0 when neither authored). */
export interface ResolvedStart {
  readonly speed_kmh: number;
  /** exactly one of f | d after validation */
  readonly f?: number;
  readonly d?: number;
}

export interface ResolvedRider {
  readonly profile: RiderProfileName;
  /** deg/s — optional wire cap; roll_rate_eff = min(profile rate, cap) */
  readonly roll_rate_cap_dps?: number;
  readonly start: ResolvedStart;
  readonly plan: readonly ResolvedPlanAction[];
}

/** Post-validation config: every default filled (default values owned by plan/constants.ts). */
export interface ResolvedConfig {
  readonly mu: number;
  readonly ds_m: number;
  readonly ssd_model: SsdModel;
  readonly rubric: string;
  readonly checks_version: 2;
}

/**
 * The frozen post-validate Scenario the engine consumes — also exactly what
 * `LineResult.resolved_scenario` carries (design/05 §7: "the complete
 * post-validation wire Scenario (03 §6, canonical form)"). Self-contained:
 * saving it to a file and running it is a complete, legal invocation.
 * `result_hash` covers `rider.plan` (+ `rider.roll_rate_cap_dps` when present).
 */
export interface ResolvedScenario {
  readonly spec: "linelab/1";
  readonly id: string;
  readonly road: ResolvedRoadSpec;
  readonly occluders: readonly ResolvedOccluder[];
  readonly hazards: readonly ResolvedHazard[];
  readonly rider: ResolvedRider;
  readonly config: ResolvedConfig;
  readonly expect_fail?: readonly string[];
  readonly meta?: Readonly<Record<string, unknown>>;
}

// ---------------------------------------------------------------------------
// InstantState (design/05 §4) — TYPE ONLY in v0.1. The `stateAt` query and the
// phase machine land in core/stateAt.ts at v0.2; nothing here may be consumed
// before then. The D45-gated `derived.commitment_probe` member is deliberately
// ABSENT (phase law: absent, not stubbed).

export type SightTrend = "opening" | "closing" | "steady";

export interface InstantState {
  /** one full interpolated Sample (§2.1, every field) */
  readonly sample: Sample;
  readonly derived: {
    readonly v_kmh: number;
    /** m — sight_ride_m − ssd_m, rider-path basis (D16) */
    readonly sight_margin_m: number;
    readonly sight_trend: SightTrend;
    /** m — station reached after ssd_m of path length */
    readonly ssd_station_m: number;
    /** deg — atan(mu), the lean ceiling here */
    readonly phi_max_deg: number;
    /** deg/s — su_sustained + su_transient (the §2.1 identity) */
    readonly stand_up_dps: number;
    /** m/s² — null when |phi| < 2° (upright immunity band) */
    readonly a_noreturn_ms2: number | null;
    /** m/s² — a_widen(phi, v; c=1); null when |phi| < 2°, v below existence bound, or denominator ≤ 0 */
    readonly a_widen_ms2: number | null;
    readonly limit_point: { readonly x: number; readonly y: number };
    /** the ResolvedPlanAction whose id equals the sample's action_id, or null */
    readonly action: ResolvedPlanAction | null;
    /** corner containing s, or null */
    readonly corner_id: string | null;
    readonly phase: Phase;
  };
  /** bracketing sample indices */
  readonly at: { readonly i0: number; readonly i1: number; readonly alpha: number };
}
