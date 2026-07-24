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
/** design/03 §5 stopping-sight-distance model names (each carries its own t_react_s). */
export const SSD_MODELS = ["alert", "aashto"];
/** design/02 §3 rider profile names (values live in core/constants.ts, all TUNING). */
export const RIDER_PROFILE_NAMES = ["casual", "street", "trained", "racer"];
// ---------------------------------------------------------------------------
// Steering machine / phase / termination / outcome closed sets
/** design/02 §3.1 — closed enum, four states, one owner per control step. */
export const STEER_STATES = ["track", "commit", "unwind", "position"];
/**
 * design/05 §2 / design/02 §7 — closed six-value set, declared in the per-step
 * termination PRECEDENCE order: crash > off_road > stopped > road_end > max_time > max_dist.
 */
export const TERMINATED_REASONS = [
    "crash", "off_road", "stopped", "road_end", "max_time", "max_dist"
];
/**
 * design/05 §6.1 — closed outcome set, declared in PRECEDENCE order
 * (crash > runoff > wide > stopped > contained). Physics-only: never reads a
 * doctrine check (P-OUTCOME-RUBRIC-FREE). `clean` is a derived predicate, not a value.
 */
export const OUTCOMES = ["crash", "runoff", "wide", "stopped", "contained"];
/** design/05 §4.1 — closed five-token phase set, disjoint from anchors and event kinds. */
export const PHASES = ["approach", "turning", "midcorner", "exiting", "done"];
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
];
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
];
//# sourceMappingURL=types.js.map