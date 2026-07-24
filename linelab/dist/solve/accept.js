// solve/accept.ts — the acceptance policy (design/04 §4.8, D24; ARCHITECTURE
// §5): accept = clean (default) | best_failing, and the five-key deterministic
// best_failing ranking. Grading is policy-independent (D9): the policy changes
// what is RETURNED, never how it is graded or coloured. Authored D10
// constraints stay HARD under every policy (violators are discarded before
// ranking — a relaxed accept policy must never quietly surface a constraint
// violator).
//
// Ranking — ordered tuple, lexicographic, lower wins (§4.8, verbatim):
//   (i)   outcome severity per 05 §6.1 precedence
//         (contained 0 / stopped 1 / wide 2 / runoff 3 / crash 4)
//   (ii)  count of doctrine checks with verdict "fail" (warn/na excluded)
//   (iii) corridor excess — max over samples of metres beyond the usable
//         corridor edge (0 for contained lines)
//   (iv)  doctrinal apex distance |apex_pct_final − target_apex_pct|
//         (final apex; corner-type-aware target, §3)
//   (v)   earlier turn-in station (deterministic final tie-break — hash
//         stability)
import { TARGET_APEX_TABLE } from "./constants.js";
// ---------------------------------------------------------------------------
/** design/05 §6.1 outcome precedence as best_failing rank key (i). */
export const OUTCOME_SEVERITY = Object.freeze({
    contained: 0,
    stopped: 1,
    wide: 2,
    runoff: 3,
    crash: 4
});
/** Closed accept vocabulary (§4.8) — anything else is SCHEMA. */
export const ACCEPT_POLICIES = ["clean", "best_failing"];
export function validateAcceptPolicy(value, at) {
    if (value === undefined)
        return null;
    if (value === "clean" || value === "best_failing")
        return null;
    return {
        code: "SCHEMA",
        at,
        message: `accept must be one of ${ACCEPT_POLICIES.join("|")} (got ${JSON.stringify(value)})`,
        detail: { reason: "accept_policy_unknown" }
    };
}
/**
 * Rank key (iii): max over samples of metres beyond the USABLE corridor edge
 * (either side — outside f > 1 and inside f < 0 both leave the corridor);
 * 0 for contained lines. Metres via the local corridor width |dOf(1) − dOf(0)|.
 */
export function corridorExcessM(samples, road) {
    let worst = 0;
    for (const sm of samples) {
        const over = Math.max(sm.f - 1, -sm.f, 0);
        if (over <= 0)
            continue;
        const width = Math.abs(road.dOf(1, sm.s) - road.dOf(0, sm.s));
        const m = over * width;
        if (m > worst)
            worst = m;
    }
    return worst;
}
/** Rank key (iv): |apex_pct_final − target_apex_pct| for the solved corner. */
export function apexDistancePct(verdict, corner_id) {
    const row = verdict.corners.find((c) => c.id === corner_id);
    if (row === undefined || row.apexes.length === 0)
        return Number.POSITIVE_INFINITY;
    const finalApex = row.apexes[row.apexes.length - 1];
    const target = TARGET_APEX_TABLE[row.corner_type].target;
    return Math.abs(finalApex.pct - target);
}
export function compareCandidates(a, b) {
    const sevA = OUTCOME_SEVERITY[a.line.verdict.outcome];
    const sevB = OUTCOME_SEVERITY[b.line.verdict.outcome];
    if (sevA !== sevB)
        return sevA - sevB;
    if (a.line.verdict.doctrine.fail !== b.line.verdict.doctrine.fail) {
        return a.line.verdict.doctrine.fail - b.line.verdict.doctrine.fail;
    }
    if (a.corridor_excess_m !== b.corridor_excess_m)
        return a.corridor_excess_m - b.corridor_excess_m;
    if (a.apex_distance_pct !== b.apex_distance_pct)
        return a.apex_distance_pct - b.apex_distance_pct;
    return a.turn_in_s - b.turn_in_s;
}
/**
 * The best_failing pick: winner with its own VERBATIM verdict; empty pool →
 * NO_SOLUTION/no_rankable_candidate. Never fabricates; never returns an
 * un-self-verified line (the pool is self-verified by construction — the
 * pipeline discards any candidate whose self-verify re-run disagrees with its
 * search-time outcome).
 */
export function pickBestFailing(pool) {
    if (pool.length === 0) {
        return {
            code: "NO_SOLUTION",
            at: "solve.accept",
            message: "best_failing found no rankable candidate",
            detail: { sub_reason: "no_rankable_candidate" }
        };
    }
    const sorted = [...pool].sort(compareCandidates);
    return sorted[0].line;
}
/** INEFFECTUAL/accept_on_mistake_line (§4.8 guardrail — WP-12's compiler consumes). */
export function acceptOnMistakeLine(at) {
    return {
        code: "INEFFECTUAL",
        at,
        message: "accept on a mistake-kind line: a mistake forward-runs a perturbed plan; nothing is being accepted",
        detail: { reason: "accept_on_mistake_line" }
    };
}
//# sourceMappingURL=accept.js.map