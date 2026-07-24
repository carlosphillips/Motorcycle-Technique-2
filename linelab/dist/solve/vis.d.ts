import type { Result } from "../core/result.js";
import type { Corner, Event, Sample } from "../core/types.js";
import { evalConstraints, type SolveInput } from "./solve.js";
import type { LineResult } from "./types.js";
export declare function blindOn(samples: readonly Sample[], events: readonly Event[], corner: Corner): boolean;
export interface CautiousDetail {
    readonly line: LineResult;
    /** candidate solve passes performed (≤ vis_max_iterations — P-VIS-BOUNDED) */
    readonly iterations: number;
    readonly governed_entry_kmh: number;
}
/**
 * The vis=cautious mode (design/04 §6). Returns the first iterate whose
 * terminal self-check passes, or one of the two typed refusals. The governed
 * entry speed rides the returned line's resolved start
 * (`resolved_scenario.rider.start.speed_kmh`).
 */
export declare function solveCautiousDetailed(spec: SolveInput): Result<CautiousDetail>;
/** solveCautious(spec) → Result<LineResult> — the mode's plain entry point. */
export declare function solveCautious(spec: SolveInput): Result<LineResult>;
export { evalConstraints };
