import type { LinelabError, Result } from "../core/result.js";
import type { BrakeAction, PlanAction, PositionAction, ThrottleAction, TurnInAction } from "../plan/types.js";
export type DecelDirective = {
    readonly kind: "bisect";
} | {
    readonly kind: "pinned";
    readonly value: number;
    readonly action: BrakeAction;
};
export type RollOnDirective = {
    readonly kind: "bisect";
} | {
    readonly kind: "pinned";
    readonly action: ThrottleAction;
} | {
    readonly kind: "magnitude";
    readonly accel: number;
    readonly action: ThrottleAction;
};
export type TurnInDirective = {
    readonly kind: "auto";
} | {
    readonly kind: "pinned";
    readonly action: TurnInAction;
};
export interface MergeDirectives {
    readonly decel: DecelDirective;
    readonly roll_on: RollOnDirective;
    readonly turn_in: TurnInDirective;
    /** carried verbatim into EVERY candidate plan the solver runs (§4.9) */
    readonly positions: readonly PositionAction[];
    /** authored maintenance cracks (throttle accel = 0 with onset) — carried verbatim */
    readonly cracks: readonly ThrottleAction[];
    /** decel pinned ∧ roll-on onset pinned ∧ turn-in placement pinned */
    readonly nothing_to_search: boolean;
}
/**
 * Fold an authored plan fragment into merge directives (§4.9). Pure shape
 * analysis — honourability against the road (station reachability, overlap
 * with the searched turn-in) is decided later by validate() on real candidate
 * plans; the pipeline maps a fragment that fails on EVERY candidate to
 * NO_SOLUTION/authored_action_conflict.
 */
export declare function mergeAuthoredPlan(authored: readonly PlanAction[] | undefined, at?: string): Result<MergeDirectives>;
/** NO_SOLUTION/authored_action_conflict (§4.9/§4.10) naming the action id. */
export declare function noSolutionConflict(at: string, action_id: string, why: string): LinelabError;
/** INEFFECTUAL/constraint_without_solver (§4.9): a bound on a fully pinned plan. */
export declare function constraintWithoutSolver(at: string): LinelabError;
