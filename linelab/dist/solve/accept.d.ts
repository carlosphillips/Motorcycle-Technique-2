import type { Outcome, RoadModel, Sample } from "../core/types.js";
import type { LinelabError } from "../core/result.js";
import type { AcceptPolicy } from "../plan/types.js";
import type { LineResult, Verdict } from "./types.js";
/** design/05 §6.1 outcome precedence as best_failing rank key (i). */
export declare const OUTCOME_SEVERITY: Readonly<Record<Outcome, number>>;
/** Closed accept vocabulary (§4.8) — anything else is SCHEMA. */
export declare const ACCEPT_POLICIES: readonly ["clean", "best_failing"];
export declare function validateAcceptPolicy(value: unknown, at: string): LinelabError | null;
/**
 * Rank key (iii): max over samples of metres beyond the USABLE corridor edge
 * (either side — outside f > 1 and inside f < 0 both leave the corridor);
 * 0 for contained lines. Metres via the local corridor width |dOf(1) − dOf(0)|.
 */
export declare function corridorExcessM(samples: readonly Sample[], road: RoadModel): number;
/** Rank key (iv): |apex_pct_final − target_apex_pct| for the solved corner. */
export declare function apexDistancePct(verdict: Verdict, corner_id: string): number;
/** One ranked pool entry: a full-resolution, self-verified final LineResult. */
export interface RankedCandidate {
    readonly line: LineResult;
    /** m — the candidate's turn-in station (rank key v) */
    readonly turn_in_s: number;
    /** rank key (iii), computed on the self-verified trajectory */
    readonly corridor_excess_m: number;
    /** rank key (iv) */
    readonly apex_distance_pct: number;
}
export declare function compareCandidates(a: RankedCandidate, b: RankedCandidate): number;
/**
 * The best_failing pick: winner with its own VERBATIM verdict; empty pool →
 * NO_SOLUTION/no_rankable_candidate. Never fabricates; never returns an
 * un-self-verified line (the pool is self-verified by construction — the
 * pipeline discards any candidate whose self-verify re-run disagrees with its
 * search-time outcome).
 */
export declare function pickBestFailing(pool: readonly RankedCandidate[]): LineResult | LinelabError;
/** INEFFECTUAL/accept_on_mistake_line (§4.8 guardrail — WP-12's compiler consumes). */
export declare function acceptOnMistakeLine(at: string): LinelabError;
export type { AcceptPolicy };
