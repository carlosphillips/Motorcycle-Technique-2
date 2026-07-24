import type { Corner, RoadModel } from "../core/types.js";
import type { LinelabError, Result } from "../core/result.js";
export type RoadTooShortQuantity = "turn_in_sweep" | "roll_on_bracket" | "brake_run";
export declare function roadTooShort(quantity: RoadTooShortQuantity, corner_id: string, required_m: number, available_m: number): LinelabError;
export interface CornerRefLengths {
    readonly L_arc: number;
    readonly L_app: number;
    readonly L_exit: number;
    readonly gap_next: number | null;
}
export declare function refLengths(road: RoadModel, index: number): CornerRefLengths;
export interface SweepSpan {
    /** m — lower bound, clamped ≥ max(0, s1(n−1)) */
    readonly lo: number;
    /** m — upper bound s0 + SWEEP_FWD_F·L_arc */
    readonly hi: number;
    readonly span_m: number;
    /** N_SWEEP evenly spaced; spacing floored at SWEEP_STEP_MIN_M (drop candidates, keep span) */
    readonly candidates: readonly number[];
}
export interface DerivedStations {
    readonly corner: Corner;
    readonly ref: CornerRefLengths;
    readonly sweep: SweepSpan;
    /** m — clamp(BRAKE_GAP_F·L_app, BRAKE_GAP_MIN_M, BRAKE_GAP_MAX_M) */
    readonly brake_gap_m: number;
    /** m — brake onset: road start, or previous corner's exit + BRAKE_RUN_MIN_M (§4.1a/§5) */
    readonly s_brake_start: number;
    /** m — clamp(CRACK_GAP_F·L_arc, CRACK_GAP_MIN_M, CRACK_GAP_MAX_M) */
    readonly crack_gap_m: number;
}
/**
 * Derive the per-corner stations (§4.1a). Refuses road_too_short/turn_in_sweep
 * when the clamped sweep span falls below SWEEP_SPAN_MIN_M.
 */
export declare function deriveStations(road: RoadModel, index: number): Result<DerivedStations>;
/**
 * v_target for the fit clip (ARCHITECTURE §10 pin 15):
 * speedForLean(r_min(corner), lean_frac·phiReserve(mu_use)) [m/s].
 */
export declare function vTargetMs(corner: Corner, skill: number, mu: number): number;
export interface DecelBracket {
    /** m/s² — max(DECEL_LO, decel_min_fit) */
    readonly lo: number;
    /** m/s² — DECEL_HI */
    readonly hi: number;
    /** m/s² — (v_entry² − v_target²) / (2·(s_ti − brake_gap − s_brake_start)) */
    readonly decel_min_fit: number;
}
/**
 * The fit-clipped decel bracket at candidate `s_ti` (§4.1a). Refuses
 * road_too_short/brake_run when decel_min_fit > DECEL_HI (the entry speed
 * cannot be shed in the available approach at the bracket's hardest decel) or
 * when the braking run itself is non-positive (pin 15).
 */
export declare function decelBracketAt(d: DerivedStations, s_ti: number, v_entry_ms: number, v_target_ms: number): Result<DecelBracket>;
export interface RollOnBracket {
    /** m — max(s_crack + ROLLON_GUARD_M, s_ti + ROLLON_LO_F·L_arc) */
    readonly lo: number;
    /** m — min(s_ti + ROLLON_HI_F·L_arc, s1) */
    readonly hi: number;
}
/**
 * The roll-on bracket (exit-bisection domain) at candidate `s_ti` (§4.1a),
 * with `s_crack = s_ti + crack_gap`. Refuses road_too_short/roll_on_bracket
 * when the clamped width falls below BRACKET_MIN_M.
 */
export declare function rollOnBracketAt(d: DerivedStations, s_ti: number): Result<RollOnBracket>;
