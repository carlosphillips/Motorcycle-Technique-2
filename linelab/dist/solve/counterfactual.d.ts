import type { LinelabError, Result } from "../core/result.js";
import type { Hand, ResolvedScenario, RoadModel, Trajectory } from "../core/types.js";
import type { RoadSpec } from "../road/types.js";
export declare const COUNTERFACTUAL_RIDERS: readonly ["lean_only_reserve", "brake_reserve_escape"];
export type CounterfactualRider = (typeof COUNTERFACTUAL_RIDERS)[number];
export declare const CF_PREDICATES: readonly ["return_after_detect", "horizon_bounded_return", "reserve_bounded_run"];
export type CfPredicate = (typeof CF_PREDICATES)[number];
/** The D45 phase-gating string (00 §3; cli/deferred.ts holds the CLI table). */
export declare const CF_DEFERRED_D45 = "continuation envelope (D45)";
/** One registry row: the declaration of a rider, not its control law (§4c.2/§4c.3). */
export interface CfRiderRecord {
    readonly id: CounterfactualRider;
    /** the exact substring every prose surface must carry (§4c.7) */
    readonly short_name: string;
    /** reachable in the current phase? (v0.1: lean_only_reserve only) */
    readonly reachable: boolean;
    /** phase-gating string when unreachable */
    readonly deferred?: string;
}
/**
 * The counterfactual rider registry — closed at exactly two ids (D42). Adding a
 * third rider is a design-set edit with a decision-log entry, never a pack, a
 * flag, or a config key (§4c.6).
 */
export declare const CF_RIDER_REGISTRY: Readonly<Record<CounterfactualRider, CfRiderRecord>>;
/** One predicate row: the success-axis declaration (§4c.1/§4c.4). */
export interface CfPredicateRecord {
    readonly id: CfPredicate;
    readonly reachable: boolean;
    readonly deferred?: string;
    /** the §4c.4 obligation on the caller, for schema/explain surfaces */
    readonly obligation: string;
}
export declare const CF_PREDICATE_REGISTRY: Readonly<Record<CfPredicate, CfPredicateRecord>>;
/**
 * The ratified §4c.7 disclosure sentence, golden-pinned, carried by corrective
 * surfaces. It contains the registered short_name "lean-only rider" — the
 * machine-checkable substring A-CORR-EXPLAIN asserts.
 */
export declare const CF_DISCLOSURE_LEAN_ONLY: string;
export declare const CF_REFUSAL_REASONS: readonly ["not_outside_corridor", "not_drifting_outward", "no_turn_in_before_x0", "horizon_not_from_main_line", "plan_not_literalised", "unknown_rider"];
export type CfRefusalReason = (typeof CF_REFUSAL_REASONS)[number];
/** Structurally a LinelabError (the one error shape) narrowed to the harness's refusal form. */
export interface CfRefusal extends LinelabError {
    readonly code: "INTERNAL";
    readonly detail: Readonly<Record<string, unknown>> & {
        readonly reason: CfRefusalReason;
    };
}
/** The recorded launch instant — record units (angles in DEGREES, like Sample). */
export interface CfLaunchSample {
    readonly t: number;
    readonly s: number;
    readonly x: number;
    readonly y: number;
    /** deg */
    readonly psi: number;
    /** m/s */
    readonly v: number;
    /** deg */
    readonly phi: number;
    /** corridor lane fraction at the launch */
    readonly f: number;
}
export interface CfLaunchState {
    /** the line's frozen post-validate scenario — the literalise-first source (§4c.5) */
    readonly resolved_scenario: ResolvedScenario;
    /** full recorded state at the launch instant */
    readonly sample: CfLaunchSample;
    /** signed df/ds at the launch (outward-positive) */
    readonly dfds: number;
    /** a turn_in event occurred at or before the launch */
    readonly turn_in_before: boolean;
    /** the attributed corner's hand — the target-lean sign (§4a.4) */
    readonly hand: Hand;
    /** the main line's run_wide_detect station (validates the horizon route) */
    readonly s_detect?: number;
    /** caller-supplied station horizon (horizon_bounded_return route) */
    readonly s_h?: number;
}
/**
 * Interpolate the recorded state of a line at time t (the v0.1 stand-in for
 * stateAt's kinematic slice): numeric channels lerp between the bracketing
 * retained samples; f is RECOMPUTED from the corridor algebra at the lerped
 * (d, s) — never lerped independently (drift risk #9); dfds is the bracket's
 * recorded-f slope. Returns null when t is outside the record.
 */
export declare function recordedStateAt(traj: Trajectory, t: number, road: RoadModel): {
    readonly sample: CfLaunchSample;
    readonly dfds: number;
} | null;
/**
 * The shadow document (§4a.7/§4c.7): a full Trajectory that ALSO carries its
 * machine-readable rider + predicate ids — it is out-of-hash by construction
 * (in no envelope, no CSV, no hash), so the disclosure costs nothing.
 */
export interface CfShadowDocument extends Trajectory {
    readonly rider: CounterfactualRider;
    readonly predicate: CfPredicate;
}
export interface CfVerdict {
    readonly rider: CounterfactualRider;
    readonly predicate: CfPredicate;
    readonly saved: boolean;
    /** first qualifying return station on the shadow, or null */
    readonly returned: {
        readonly s: number;
        readonly f: number;
    } | null;
    /** ratified prose naming the rider — "the lean-only rider" (§4c.7) */
    readonly disclosure: string;
}
export interface CfOutcome {
    readonly trajectory: CfShadowDocument;
    readonly verdict: CfVerdict;
}
/**
 * counterfactual(world, x0, latency, rider, predicate) →
 * Result<{trajectory, verdict}, CfRefusal>  (design/04 §4c.1 — ONE signature).
 *
 * - `world`: the actual road, or a generated continuation member (D45).
 * - `x0`: the recorded launch state on the literalised line (§4c.5).
 * - `latency_s`: 0 or the profile's t_react_s; during the window the
 *   counterfactual rides the LITERALISED plan unchanged (re-integrated from
 *   road start through core/integrate — no state stitching), then the rider
 *   takes over.
 * - `rider` / `predicate`: the closed sets above. The v0.1 reachable rider set
 *   is exactly {"lean_only_reserve"}; `brake_reserve_escape` and §4d's
 *   `reserve_bounded_run` reject SCHEMA + deferred (phase-gating law).
 *
 * The §4c.4 precondition is discharged THROUGH THE PREDICATE: under
 * `return_after_detect` the launch must be OUTSIDE_DRIFTING_OUT or the call
 * refuses; under `horizon_bounded_return` there is no launch condition and the
 * caller must supply a main-line station horizon `s_h >= s_detect`.
 */
export declare function counterfactual(world: RoadSpec, x0: CfLaunchState, latency_s: number, rider: CounterfactualRider, predicate: CfPredicate): Result<CfOutcome, CfRefusal | LinelabError>;
