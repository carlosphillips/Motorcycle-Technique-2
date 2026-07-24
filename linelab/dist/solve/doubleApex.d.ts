import type { Result } from "../core/result.js";
import type { Corner, Sample } from "../core/types.js";
import { type SolveInput } from "./solve.js";
import type { LineResult } from "./types.js";
export interface DaWindow {
    /** corner indices on the composed road, consecutive, same-hand */
    readonly indices: readonly number[];
    readonly corners: readonly Corner[];
    readonly s0: number;
    readonly s1: number;
    readonly L_arc: number;
    /** deg — summed sweeps */
    readonly sweep_deg: number;
}
export interface SweepScale {
    readonly pctAt: (s: number) => number;
    readonly sAt: (pct: number) => number;
}
export declare function sweepScale(w: DaWindow): SweepScale;
export interface Touch {
    readonly s: number;
    readonly pct: number;
    readonly f: number;
}
export interface TouchReport {
    readonly touches: readonly Touch[];
    /** true iff exactly two touches under the full predicate */
    readonly two_touch: boolean;
}
/**
 * Evaluate the §4.6 touch predicate: candidate touches are the recorded apexes
 * within the window with depth f ≤ DA_TOUCH_F_MAX; prominence is measured on
 * the sample series between consecutive candidates (max f must exceed the
 * larger minimum by ≥ DA_PROMINENCE_F; below DA_PROMINENCE_NOISE the shallower
 * candidate is noise-merged); separation ≥ DA_TOUCH_SEP_PCT percent of window
 * sweep. Exactly two surviving touches = two_touch.
 */
export declare function touchesOf(apexes: readonly {
    readonly s: number;
    readonly f: number;
}[], samples: readonly Sample[], w: DaWindow, scale: SweepScale): TouchReport;
/**
 * solveDoubleApex({road, entry_kmh, profile?, mu?, constraints?, vis?, corner?})
 * → Result<LineResult> (design/04 §4.6). Two turn-ins, both touches, and the
 * mid-drift are all emergent; the author supplies only the window and speed.
 */
export declare function solveDoubleApex(spec: SolveInput): Result<LineResult>;
