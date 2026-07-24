import type { Event, Sample, Terminated, Trajectory } from "./types.js";
import { G } from "./constants.js";
/**
 * One raw integrator point — INTERNAL working state, radians throughout.
 * Produced per 200 Hz step by core/integrate.ts, consumed by core/resample.ts,
 * and discarded after resampling (02 §6).
 */
export interface RawPoint {
    readonly t: number;
    readonly x: number;
    readonly y: number;
    /** rad — continuous (never wrapped) */
    readonly psi: number;
    readonly v: number;
    /** rad */
    readonly phi: number;
    readonly s: number;
    readonly d: number;
    readonly mu: number;
    /** m/s² — commanded level at this instant (the lattice value) */
    readonly cmd_a: number;
    /** m/s³ — the step's ZOH commanded-accel rate */
    readonly a_cmd_rate: number;
    /** m/s² — delivered (ellipse-clipped) longitudinal accel at this instant */
    readonly a_long: number;
    readonly clipped: boolean;
    /** rad — the controller's lean setpoint */
    readonly cmd_lean: number;
    /** deg/s — roll_rate_eff in force */
    readonly roll_rate_dps: number;
    readonly action_id: string | null;
    readonly steer_state: Sample["steer_state"];
    readonly lat_action_id: string | null;
    /** rad/s — sustained stand-up contribution at this instant */
    readonly su_sustained: number;
    /** rad/s — transient stand-up contribution at this instant */
    readonly su_transient: number;
    readonly below_validity: boolean;
}
/**
 * A retained (resampled) point: RawPoint plus the corridor lane fraction
 * (RECOMPUTED from the corridor algebra at resample — drift risk #9) and the
 * per-sample sight channels.
 */
export interface RetainedPoint extends RawPoint {
    /** lane fraction, recomputed via road.fOf(d, s) at the retained station */
    readonly f: number;
    readonly sight_m: number;
    readonly ssd_m: number;
    readonly limit_x: number;
    readonly limit_y: number;
    /**
     * Provisional at engine rank: recorded = sight_m (centreline basis). The
     * rider-path rebase — the exact path length to where centreline distance
     * reaches s + sight_m, clamped at line end (05 §2.1, D16) — is written by
     * sight/analyze.ts (WP-07) post-run.
     */
    readonly sight_ride_m: number;
}
/**
 * Convert one retained point to the wire Sample (05 §2.1 field order). The
 * derived dynamics channels (kappa, a_lat, grip, n_long, n_lat) are recomputed
 * from the point's own state so the record's identities — kappa =
 * G·tan(phi)/v², a_lat = v²·kappa, grip = 1 − ellipseMag — hold exactly at
 * every sample (P-KAPPA, P-ELLIPSE).
 */
export declare function toSample(p: RetainedPoint): Sample;
/**
 * Assemble the deep-frozen Trajectory (05 §2.2): samples + events + terminated,
 * frozen children-before-parents. The raw series must already be discarded by
 * the caller — this function sees only the retained record.
 */
export declare function buildTrajectory(samples: readonly Sample[], events: readonly Event[], terminated: Terminated): Trajectory;
export { G };
