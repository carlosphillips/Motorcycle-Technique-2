import type { Corner, Outcome, ResolvedPlanAction, Trajectory } from "../core/types.js";
import type { Result } from "../core/result.js";
import type { CornerRow } from "../core/analyze.js";
import type { DoctrineBlock, RubricPack } from "../plan/doctrine/types.js";
import type { AcceptPolicy } from "../plan/types.js";
import type { CorrectiveBlock } from "./corrective.js";
import type { ConstraintRow, DiagnosisBlock, MisjudgmentBlock, SightHold, Verdict } from "./types.js";
/** One corner's corrective shot outcome, keyed to its corner. */
export interface CornerCorrective {
    readonly corner_id: string;
    readonly block: CorrectiveBlock;
}
export interface VerdictInput {
    /** the final merged, deep-frozen record (samples + ALL events + terminated) */
    readonly trajectory: Trajectory;
    /** core/analyze.ts rows (the ONE apex detector's output) */
    readonly corner_rows: readonly CornerRow[];
    /** the composed road's corner records (crash/window attribution geometry) */
    readonly road_corners: readonly Corner[];
    /** the literalised executed plan (turn_in rows read lean/hand off it) */
    readonly resolved_plan: readonly ResolvedPlanAction[];
    /** the doctrine run over the finished record (plan/doctrine/checks.ts) */
    readonly doctrine: DoctrineBlock;
    /** the loaded rubric pack — supplies severity for the colour law + identity */
    readonly pack: RubricPack;
    readonly spec_hash: string;
    /** per-corner corrective blocks (solve/corrective.ts); [] when none attempted */
    readonly correctives?: readonly CornerCorrective[];
    /** accept policy in force (04 §4.8); defaults to "clean" */
    readonly acceptance_policy?: AcceptPolicy;
    /** attributed by the producing pipeline (mistake compile / solver); default null */
    readonly diagnosis?: DiagnosisBlock | null;
    /** WP-11's believed-road pipeline supplies it for misjudge sources; default null */
    readonly misjudgment?: MisjudgmentBlock | null;
    /** per-bound evaluation for constraint-targeted solves (D10); default null */
    readonly constraints?: readonly ConstraintRow[] | null;
    /** per-corner vis-hold records (04 §6); default [] */
    readonly holds?: readonly SightHold[];
}
/**
 * `outcome` from physics alone (P-OUTCOME-RUBRIC-FREE — note the signature:
 * no doctrine input EXISTS, so no rubric pack can move it). Per-corner
 * contribution law verbatim from 04 §4a.6; headline = worst class under
 * 05 §6.1's precedence crash > runoff > wide > stopped > contained:
 *
 *   crash      the run terminated `crash` (grip or lean ceiling, deadbanded)
 *   runoff     an outward crossing (run_wide_detect) with no feasible
 *              corrective, OR terminated off_road in a corner with no outward
 *              detect (inside-side physical departure; corrective null). The
 *              second clause stays reachable when OTHER corners ran wide with
 *              feasible saves — e.g. the opposite-hand f-flip at a chain
 *              handoff — because runoff > wide.
 *   wide       every outward crossing has a feasible corrective returning it
 *              (the wide-vs-runoff split IS the corrective shot, 04 §4a.6)
 *   stopped    v fell below the floor before road end, none of the above
 *   contained  none of the above (road_end on the carriageway; the max_time/
 *              max_dist runaway guards also land here — the closed five-value
 *              set forces a value and the guard itself stays recorded in
 *              terminated.reason; recorded judgment PENDING RATIFICATION:
 *              05 §6.1's letter defines contained as "reached road end")
 *
 * A run_wide_detect event without a corner_id is believed-impossible input
 * (04 §4a.2 attributes every detect; 05 §5 pins "at most one per corner") and
 * mints a typed INTERNAL — never a silent fall-through to a recoverable class.
 */
export declare function physicsOutcome(traj: Trajectory, correctives: readonly CornerCorrective[], roadCorners: readonly Corner[]): Result<Outcome>;
export declare function assembleVerdict(input: VerdictInput): Result<Verdict>;
