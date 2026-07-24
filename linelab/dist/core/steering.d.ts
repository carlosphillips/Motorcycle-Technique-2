import type { Corner, EventKind, Hand, ResolvedPositionAction, ResolvedTurnInAction, RoadModel, SteerState } from "./types.js";
/** wrapToPi: normalize an angle to (−π, π]. Shared with the post-hoc exit-event analyzer. */
export declare function wrapToPi(a: number): number;
/**
 * The turn-in's governing corner (02 §3.1, recorded binding re-derived
 * deterministically): the corner with the smallest s1 > at_s whose hand equals
 * the action's (resolved) hand. `undefined` when no such corner exists — the
 * engine then holds the commitment with no release (a validated scenario can
 * never reach this: BAD_RANGE/no_governing_corner at validation; analytic
 * straight-road fixtures use it deliberately to pin a held lean).
 */
export declare function governingCornerFor(corners: readonly Corner[], at_s: number, hand: Hand): Corner | undefined;
/**
 * The heading-capture release predicate (02 §3.1):
 *
 *   psi_exit(c)  = road heading at c.s1
 *   dpsi_rem     = handSign(c.hand) · (psi_exit(c) − psi)
 *   t_unwind     = |phi| / roll_rate
 *   v_eff        = max(V_MIN_RHS, v + 0.5·a_clip·t_unwind)
 *   dpsi_unwind  = (G / (v_eff·roll_rate)) · ln(1/cos|phi|)
 *   RELEASE  ⇔  dpsi_rem ≤ dpsi_unwind
 *
 * `a_clip` is the most recent COMPLETED step's clip (ARCHITECTURE §10.11);
 * `roll_rate` is the effective rate in rad/s. dpsi_rem ≤ 0 (over-rotated)
 * releases immediately.
 *
 * dpsi_rem note (recorded deviation): 02 spells
 * `handSign·wrapToPi(psi_exit − psi)`, but both `psi` and `psi_road` are
 * CONTINUOUS (never wrapped) in this engine, so the plain difference IS the
 * remaining road heading — and wrapping it would fold any remaining sweep
 * > 180° to a negative number, releasing a 270° commitment at its first step
 * and making the normative analytic fixture F-AN-CIRCLE (R 30 ^270, steady
 * 30 m circle through the arc — 09 §3.2a) unsatisfiable. On every sweep
 * < 180° the two spellings agree exactly.
 */
export declare function releaseFires(corner: Corner, road: RoadModel, psi: number, phi: number, v: number, prev_a_clip: number, roll_rate: number): boolean;
/**
 * Lateral closure rate in the PINNED frame (recorded deviation, load-bearing):
 * 02 §3.1 spells `d_dot = v·sin(psi − psi_road(s))` — the standard Frenet
 * formula for a frame where the road normal (positive d) points TOWARD the
 * turn centre. Under this project's pinned frame (ARCHITECTURE §6.1: y down,
 * d positive to the rider's LEFT, left normal (sin ψr, −cos ψr)), the closure
 * rate is
 *
 *   d_dot = v_vec · N_left = −v·sin(psi − psi_road(s))
 *
 * Implementing the doc's spelling verbatim flips the sign of the damping term,
 * turning the ζ = 1 critically-damped tracker into an anti-damped oscillator —
 * the position channel then never satisfies its own completion law and the
 * binding §5.4.6 invariants fail. The invariants are the specification
 * (02 §5.4 header); the formula's sign is corrected to the pinned frame.
 */
export declare function dDotOf(road: RoadModel, s: number, psi: number, v: number): number;
/**
 * The tracker law (02 §3.1; `track` and `position` share it):
 *
 *   d_tgt       = dOf(f_target)
 *   e           = d_tgt − d
 *   d_dot       = lateral closure rate (see dDotOf — pinned-frame sign)
 *   a_track     = clamp(OMEGA_POS²·e − 2·OMEGA_POS·d_dot, ±a_lat_pos_max)   (ζ = 1)
 *   kappa_ff    = kappa_road(s) / (1 + d·kappa_road(s))
 *   target_lean = clamp(atan((v²·kappa_ff + a_track_d)/G), ±PHI_TRACK_AUTH)
 *
 * Frame notes (recorded deviations, same root cause as dDotOf):
 * - the feedforward that holds the d-offset line has radius R + d in the
 *   pinned d-positive-LEFT frame (verified against road/compose's own arc
 *   geometry), so kappa_ff = κ/(1 + d·κ); 02's `1 − d·κ` presumes d toward
 *   the centre;
 * - a_track is a demand along +d (leftward); the lean that produces a leftward
 *   lateral acceleration is NEGATIVE phi (+phi = right lean = +kappa = rightward
 *   centripetal demand), so the tracker's e/d_dot demand enters with sign
 *   flipped when converted to a lean target.
 * (v²·kappa_cmd = v²·kappa_ff + a_track exactly — computed in that form so the
 * law is total at v → 0.) The 5° authority cap is the D7 guard: cornering is
 * possible only through a committed turn_in.
 */
export declare function trackerTargetLean(f_target: number, road: RoadModel, s: number, d: number, psi: number, v: number): number;
export type SteerMachine = {
    readonly kind: "track";
    readonly f_hold: number;
    /** the completed-position action id held by the tracker, else null (05 §2.1 lat_action_id rule) */
    readonly hold_action_id: string | null;
} | {
    readonly kind: "commit";
    readonly action: ResolvedTurnInAction;
    readonly corner: Corner | null;
    /** steering_complete emitted for this commitment */
    readonly steered: boolean;
} | {
    readonly kind: "unwind";
    readonly corner_id: string | null;
    /** the released turn_in's id (event payload; lat_action_id stays null) */
    readonly released_action_id: string;
} | {
    readonly kind: "position";
    readonly action: ResolvedPositionAction;
    readonly target_f: number;
    readonly shortfall_emitted: boolean;
};
export declare function initialMachine(f_start: number): SteerMachine;
/** A lateral activation delivered to this step, with its bracketed crossing time. */
export interface LateralActivation {
    readonly action: ResolvedTurnInAction | ResolvedPositionAction;
    /** exact station crossing (= at_s) */
    readonly s_cross: number;
    /** bracketed crossing time */
    readonly t_cross: number;
}
/** An event minted by the machine this step (kind ∈ the 05 §5 closed set). */
export interface SteerEventDraft {
    readonly kind: EventKind;
    readonly s: number;
    readonly t: number;
    readonly corner_id?: string;
    readonly action_id?: string;
    readonly detail?: Readonly<Record<string, unknown>>;
}
export interface SteerStepInput {
    readonly s: number;
    readonly d: number;
    readonly f: number;
    readonly psi: number;
    readonly v: number;
    readonly phi: number;
    readonly t: number;
}
export interface SteerStepResult {
    readonly machine: SteerMachine;
    /** rad — the setpoint fed to the rate-limited tracker of 02 §3 */
    readonly target_lean: number;
    readonly steer_state: SteerState;
    readonly lat_action_id: string | null;
    readonly events: readonly SteerEventDraft[];
}
/**
 * One ZOH control-step evaluation of the steering channel (02 §3.1).
 * `activations` are the turn_in/position actions whose at_s was crossed by
 * this step, in at_s order; `roll_rate` in rad/s; `prev_a_clip` per
 * ARCHITECTURE §10.11.
 */
export declare function stepSteering(machine: SteerMachine, activations: readonly LateralActivation[], input: SteerStepInput, road: RoadModel, roll_rate: number, prev_a_clip: number): SteerStepResult;
