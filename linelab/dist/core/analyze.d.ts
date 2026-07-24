import type { CornerType, Event, Hand, RoadModel, Trajectory } from "./types.js";
import type { Phase } from "./types.js";
/** One accepted apex touch (05 §6.3 hysteresis detector output). */
export interface ApexPoint {
    /** m — station of the accepted local minimum of f */
    readonly s: number;
    /** % — 100·(swept heading to this station)/(corner's total swept angle), 01 Appendix A */
    readonly pct: number;
    /** lane fraction at the apex (0 = inner usable edge) */
    readonly f: number;
    /** m — physical distance from the apex position to the inner usable edge */
    readonly clearance_m: number;
    readonly v_kmh: number;
    readonly lean_deg: number;
}
/** design/05 §6.3 corners[].exit shape. */
export interface CornerExit {
    readonly s: number;
    readonly d: number;
    readonly f: number;
    readonly heading_err_deg: number;
}
/** The subset of design/05 §6.3's corners[] row this pure pass produces. */
export interface CornerRow {
    readonly id: string;
    readonly hand: Hand;
    readonly corner_type: CornerType;
    /** ordered by s, 1..N (05 §6.3) */
    readonly apexes: readonly ApexPoint[];
    readonly lean_max_deg: number;
    readonly grip_min: number;
    /** s — reserve-exceedance dwell over the corner window W_c (01 Appendix A) */
    readonly danger_dwell_s: number;
    readonly exit: CornerExit;
}
export interface CornerAnalysis {
    readonly corners: readonly CornerRow[];
    /** `apex` (detail.index 1-based per corner) + `exit` events from this SAME pass. */
    readonly events: readonly Event[];
}
export declare function analyzeCorners(traj: Trajectory, road: RoadModel, skill: number): CornerAnalysis;
export interface PhaseOpener {
    readonly t: number;
    readonly phase: Phase;
}
/**
 * The 05 §4.1 opener table for one event: which phase (if any) this event
 * kind opens. `turn_in`/`steering_complete`/`roll_on` open unconditionally;
 * `exit` opens `done` for the road's last corner, else the next corner's
 * `approach` (phase and `corner_id` are independent fields — 05 §4.1). Every
 * other kind (including `crack`, `release`, all terminal bookmarks) opens no
 * phase.
 */
export declare function openerPhaseFor(event: Pick<Event, "kind" | "corner_id">, lastCornerId: string | null): Phase | null;
/**
 * The ordered opener timeline for a line: the implicit `approach` opener at
 * run start, followed by every opener event's phase, in the events array's
 * pinned order (t, then EVENT_KINDS declaration order — 05 §5). `phaseAt`
 * below resolves a query time against this timeline (05 §4.1's "half-open
 * intervals" rule: latest opener with `t ≤ t(q)`).
 */
export declare function phaseOpeners(traj: Trajectory, road: RoadModel): readonly PhaseOpener[];
/** Phase at query time `t`: the phase opened by the latest opener with `t' ≤ t` (05 §4.1). */
export declare function phaseAt(openers: readonly PhaseOpener[], t: number): Phase;
