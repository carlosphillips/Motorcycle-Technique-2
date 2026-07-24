import type { Result } from "../core/result.js";
import type { RoadSpec, Segment } from "../road/types.js";
import { type SolveInput } from "./solve.js";
import type { LineResult, MisjudgeDivergenceKind } from "./types.js";
export interface Divergence {
    /** m — exact divergence station */
    readonly s_div: number;
    readonly kind: MisjudgeDivergenceKind;
    /** the differing believed/actual parameter (radius m or sweep deg); null for structure */
    readonly believed: number | null;
    readonly actual: number | null;
    /** index of the first differing segment pair; null when the lists are identical */
    readonly seg_index: number | null;
    /** the first differing pair's hands differ (both curved) */
    readonly hand_differs: boolean;
}
/** Walk actual vs believed segment lists; null ⇔ identical after normalization. */
export declare function divergenceOf(actual: readonly Segment[], believed: readonly Segment[]): Divergence | null;
export interface BeliefSugar {
    readonly kind: "underread" | "overread";
    /** exactly one of r_believed | sweep_believed_deg (03 §7.1 table) */
    readonly r_believed?: number;
    readonly sweep_believed_deg?: number;
    /** target corner id (default: the road's first corner) */
    readonly of?: string;
}
/** Compile the sugar to Layer 1: the believed RoadSpec (disclosed verbatim). */
export declare function believedRoadFromSugar(actualRoad: SolveInput["road"], sugar: BeliefSugar): Result<RoadSpec>;
export interface SolveBelievedOptions {
    /** provenance sugar record (WP-12's compiler threads it; null = general field) */
    readonly sugar?: {
        readonly kind: "underread" | "overread";
        readonly params: Readonly<Record<string, number | string>>;
        readonly corner_id: string;
    } | null;
    readonly line_id?: string;
    readonly role?: LineResult["role"];
    readonly label?: string;
}
/**
 * solveBelieved(spec) → Result<LineResult> (design/04 §4.7). The spec carries
 * `believed_road`; the pipeline solves it clean in the believed world,
 * literalizes, executes on the actual road, grades normally, and attaches the
 * verdict's misjudgment block.
 */
export declare function solveBelieved(spec: SolveInput, opts?: SolveBelievedOptions): Result<LineResult>;
export declare function solveMisjudgeSugar(spec: SolveInput, sugar: BeliefSugar): Result<LineResult>;
