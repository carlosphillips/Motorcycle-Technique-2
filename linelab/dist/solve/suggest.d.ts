import type { Result } from "../core/result.js";
import type { LineResult } from "./types.js";
import { type CoarseCandidate, type SolveCtx, type SolveInput } from "./solve.js";
export interface CoarseSweepResult {
    /** every candidate, in station order */
    readonly candidates: readonly CoarseCandidate[];
    /** contained ∧ in-band ∧ constraint-ok, ranked by |apex_pct − target| then s_ti */
    readonly survivors: readonly CoarseCandidate[];
}
/**
 * The §3.1 coarse sweep. Refuses (propagating the widest candidate's typed
 * road_too_short) only when EVERY candidate's brackets degenerate — §4.1a's
 * per-candidate fit clip legitimately kills early candidates on a fast entry
 * (the doc's own C30 arithmetic) without refusing the corner.
 */
export declare function coarseSweep(ctx: SolveCtx): Result<CoarseSweepResult>;
export declare function autoSolve(ctx: SolveCtx): Result<LineResult>;
/**
 * suggestTurnIn(spec) → Result<LineResult> (design/04 §3): answers "where
 * should I turn in?" — always the auto pipeline. A pinned turn-in station on a
 * *suggestion* call is dead input (nothing is ever accepted-and-ignored).
 */
export declare function suggestTurnIn(spec: SolveInput): Result<LineResult>;
