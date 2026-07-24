import type { ResolvedBrakeAction, ResolvedPlanAction, ResolvedThrottleAction } from "./types.js";
/** The longitudinal actions of a plan, in at_s order (stable). */
export type LongitudinalAction = ResolvedBrakeAction | ResolvedThrottleAction;
export declare function longitudinalActions(plan: readonly ResolvedPlanAction[]): LongitudinalAction[];
/** Station-crossing epsilon: absorbs f64 accumulation over thousands of steps. */
export declare const EPS_ACTIVATE_M = 1e-9;
/**
 * The active action's declared target level at station s (02 §3):
 * brake → −decel, optionally tapering linearly in station to zero by
 * `taper_to_s` (release-to-zero-by-station); throttle → +accel. The slew
 * limiter below additionally rate-limits ANY change of commanded level; a
 * taper whose implied rate is below the slew is unaffected.
 */
export declare function targetLevel(action: LongitudinalAction | null, s: number): number;
/** Persistent longitudinal state threaded step to step. */
export interface LongState {
    /** commanded level at the CURRENT step boundary (the lattice value at time t) */
    readonly a_cmd: number;
    /** index (into longitudinalActions list) of the last activated action; −1 none */
    readonly active_idx: number;
}
export declare const LONG_STATE_INITIAL: LongState;
/** One step's longitudinal evaluation (read once per step, ZOH). */
export interface LongStepOutput {
    /** lattice value at the step start — the value recorded on the sample at this instant */
    readonly a_start: number;
    /** lattice value at the step end (after the slew update) */
    readonly a_end: number;
    /**
     * the step's ZOH a_cmd_rate [m/s³] — (a_end − a_start)/dt, defined 0 at the
     * first step (02 §6); equals the active slew during a ramp; drives S_transient
     */
    readonly a_cmd_rate: number;
    /** the active action, for action_id / slew attribution (null before the first) */
    readonly action: LongitudinalAction | null;
    /** threaded state for the next step */
    readonly next: LongState;
    /** actions that activated on THIS step, in order (for event emission) */
    readonly activated: readonly LongitudinalAction[];
}
/**
 * Evaluate the longitudinal channel for the step starting at station `s`,
 * pre-step time index `k` (k = 0 is the run's first step).
 */
export declare function stepLongitudinal(state: LongState, actions: readonly LongitudinalAction[], s: number, k: number, dt: number): LongStepOutput;
export interface FreezeWindow {
    readonly t0: number;
    readonly t1: number;
}
export declare function freezeWindowOf(action: LongitudinalAction, t_onset: number): FreezeWindow | null;
/** Is steering frozen at time t? Windows are half-open [t0, t1). */
export declare function isFrozen(windows: readonly FreezeWindow[], t: number): boolean;
