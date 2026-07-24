// core/controller.ts — the per-step ZOH longitudinal control evaluation
// (design/02 §3): slew-limited approach to the active brake/throttle action's
// target level, `taper_to_s` release-to-zero-by-station, the a_cmd_rate ZOH
// definition, and the steering-freeze windows a throttle's `freeze_steer_s`
// opens (02 §3: `roll_cmd = 0` for its window WITHOUT changing steer_state).
//
// Command lattice (normative reconciliation, recorded as a WP-04 judgment
// call): the slew law is the per-step update
//
//   a_cmd_k = a_cmd_{k−1} + clamp(target_level − a_cmd_{k−1}, −slew·dt, +slew·dt)
//
// (02 §3, verbatim). Across a step the commanded level is the LINEAR
// interpolation between the two lattice values a_cmd_{k−1} → a_cmd_k (rate =
// the active slew during a ramp, 0 when settled — exactly the trajectory 02 §3
// declares dt-invariant). The integrator's stage derivative reads this linear
// ramp, which is what makes design/09 §3.2a's A-AN-BRAKE and stage-weight
// closed forms (v quadratic, x cubic through a slew ramp, integrated exactly
// by the stepper) satisfiable: a constant-per-step staircase misses them by
// O(slew·dt·t_r/2) ≈ 7.5e-3 m/s — far outside the fixture tolerances. All
// CONTROL consumers stay ZOH per 02 §6: `b_dem` and the transient trigger read
// the step's single a_cmd / a_cmd_rate, held across all four stages
// (ARCHITECTURE §10.10).

import type { ResolvedBrakeAction, ResolvedPlanAction, ResolvedThrottleAction } from "./types.js";
import { A_SLEW_DEFAULT } from "./constants.js";

/** The longitudinal actions of a plan, in at_s order (stable). */
export type LongitudinalAction = ResolvedBrakeAction | ResolvedThrottleAction;

export function longitudinalActions(plan: readonly ResolvedPlanAction[]): LongitudinalAction[] {
  return plan
    .filter((a): a is LongitudinalAction => a.do === "brake" || a.do === "throttle")
    .sort((a, b) => a.at_s - b.at_s);
}

/** Station-crossing epsilon: absorbs f64 accumulation over thousands of steps. */
export const EPS_ACTIVATE_M = 1e-9;

/**
 * The active action's declared target level at station s (02 §3):
 * brake → −decel, optionally tapering linearly in station to zero by
 * `taper_to_s` (release-to-zero-by-station); throttle → +accel. The slew
 * limiter below additionally rate-limits ANY change of commanded level; a
 * taper whose implied rate is below the slew is unaffected.
 */
export function targetLevel(action: LongitudinalAction | null, s: number): number {
  if (action === null) return 0;
  if (action.do === "throttle") return action.accel;
  const base = -action.decel;
  const taper = action.taper_to_s;
  if (taper === undefined || taper <= action.at_s) return base;
  const frac = Math.min(1, Math.max(0, (taper - s) / (taper - action.at_s)));
  return base * frac;
}

/** Persistent longitudinal state threaded step to step. */
export interface LongState {
  /** commanded level at the CURRENT step boundary (the lattice value at time t) */
  readonly a_cmd: number;
  /** index (into longitudinalActions list) of the last activated action; −1 none */
  readonly active_idx: number;
}

export const LONG_STATE_INITIAL: LongState = { a_cmd: 0, active_idx: -1 };

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
export function stepLongitudinal(
  state: LongState,
  actions: readonly LongitudinalAction[],
  s: number,
  k: number,
  dt: number
): LongStepOutput {
  // activation sweep: every not-yet-active action whose at_s has been reached
  let idx = state.active_idx;
  const activated: LongitudinalAction[] = [];
  while (idx + 1 < actions.length && actions[idx + 1]!.at_s <= s + EPS_ACTIVATE_M) {
    idx += 1;
    activated.push(actions[idx]!);
  }
  const action = idx >= 0 ? actions[idx]! : null;

  const target = targetLevel(action, s);
  const slew = action?.slew_mss ?? A_SLEW_DEFAULT;
  const a_start = state.a_cmd;
  const delta = Math.min(Math.max(target - a_start, -slew * dt), slew * dt);
  const a_end = a_start + delta;
  const a_cmd_rate = k === 0 ? 0 : delta / dt;

  return {
    a_start,
    a_end,
    a_cmd_rate,
    action,
    next: { a_cmd: a_end, active_idx: idx },
    activated
  };
}

// ---------------------------------------------------------------------------
// Steering-freeze windows (02 §3): a throttle action carrying freeze_steer_s
// overrides roll_cmd = 0 from its onset TIME for freeze_steer_s seconds,
// without changing steer_state — the c = 0 column of the widening algebra.
// Windows accumulate per activation and persist across longitudinal
// supersession (the freeze is a steering-channel override, orthogonal to which
// action owns the longitudinal target).

export interface FreezeWindow {
  readonly t0: number;
  readonly t1: number;
}

export function freezeWindowOf(action: LongitudinalAction, t_onset: number): FreezeWindow | null {
  if (action.do !== "throttle" || action.freeze_steer_s === undefined) return null;
  return { t0: t_onset, t1: t_onset + action.freeze_steer_s };
}

/** Is steering frozen at time t? Windows are half-open [t0, t1). */
export function isFrozen(windows: readonly FreezeWindow[], t: number): boolean {
  return windows.some((w) => t >= w.t0 - 1e-12 && t < w.t1 - 1e-12);
}
