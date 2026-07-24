// solve/suggest.ts — suggestTurnIn (design/04 §3; ARCHITECTURE §5): the
// coarse-sweep-then-full-solve turn-in suggestion.
//
//   1. Coarse sweep — one cheap engine run per candidate (N_SWEEP over the
//      §4.1a span, spacing floored at SWEEP_STEP_MIN_M) at COARSE_DS_M.
//      Filter to contained candidates (no inside cut, no run-off) with an
//      emergent apex in the corner type's plausible band; constraint
//      violators are discarded before ranking (§4.5).
//   2. Rank the surviving band by |apex_pct − target_apex_pct(type)|.
//   3. Full-solve the top SUGGEST_TOPN at full resolution; return the first
//      that verifies clean.
//   4. Typed failure: empty_band (the road/speed combination is the problem)
//      vs non_clean_band (solver brackets or profile are the problem); a
//      coarse-stage promise contradicted at full resolution is
//      coarse_fine_disagreement, never a silently-shipped line.
//
// The §4.8 best_failing pooling for the auto path also lives here (the pool is
// the full-resolution, self-verified candidates this loop produces).
//
// This module and solve.ts are deliberately co-recursive (the design's own §3
// ⇄ §4 structure: the sweep full-solves via §4; §4's auto turn-in sweeps via
// §3); all cross-calls are runtime-only function calls, so the ESM cycle is
// benign.
import { err, ok } from "../core/result.js";
import { BEST_FAILING_MIN_CANDIDATES, SUGGEST_TOPN } from "./constants.js";
import { pickBestFailing } from "./accept.js";
import { buildSolveContext, coarseCandidate, constraintUnmet, constraintsSatisfied, fullSolveAtStation, noSolution } from "./solve.js";
/**
 * The §3.1 coarse sweep. Refuses (propagating the widest candidate's typed
 * road_too_short) only when EVERY candidate's brackets degenerate — §4.1a's
 * per-candidate fit clip legitimately kills early candidates on a fast entry
 * (the doc's own C30 arithmetic) without refusing the corner.
 */
export function coarseSweep(ctx) {
    const candidates = ctx.stations.sweep.candidates.map((s_ti) => coarseCandidate(ctx, s_ti));
    const runnable = candidates.filter((c) => c.error === null);
    if (runnable.length === 0) {
        // all candidates dead: surface the widest (latest) candidate's typed error
        return err(candidates[candidates.length - 1].error);
    }
    const survivors = runnable
        .filter((c) => c.contained && c.in_band && c.constraint_ok)
        .sort((a, b) => (a.rank !== b.rank ? a.rank - b.rank : a.s_ti - b.s_ti));
    return ok({ candidates, survivors });
}
export function autoSolve(ctx) {
    const sweepR = coarseSweep(ctx);
    if (!sweepR.ok)
        return sweepR;
    const { candidates, survivors } = sweepR.value;
    return ctx.policy === "clean" ? cleanLoop(ctx, candidates, survivors) : bestFailingLoop(ctx, candidates, survivors);
}
function cleanLoop(ctx, candidates, survivors) {
    if (survivors.length === 0) {
        // §4.5: when candidates exist but every one violates an authored bound,
        // the refusal is constraint_unmet — never a silent empty_band
        const constraintKilled = candidates.filter((c) => c.error === null && c.contained && c.in_band && !c.constraint_ok && c.constraint_rows !== null);
        if (constraintKilled.length > 0) {
            return err(constraintUnmet(constraintKilled[0].constraint_rows, "solve.suggest"));
        }
        return err(noSolution("empty_band", "solve.suggest", "no contained candidate with an in-band apex exists — the road/speed combination is the problem", {
            corner_id: ctx.corner.id,
            sweep: [ctx.stations.sweep.lo, ctx.stations.sweep.hi],
            candidates: ctx.stations.sweep.candidates.length
        }));
    }
    const tried = [];
    for (const cand of survivors.slice(0, SUGGEST_TOPN)) {
        const r = fullSolveAtStation(ctx, cand.s_ti, { short_circuit_probe: true });
        if (!r.ok) {
            if (r.error.code === "NO_SOLUTION") {
                tried.push({
                    s_ti: cand.s_ti,
                    outcome: `refused:${String((r.error.detail ?? {})["sub_reason"])}`,
                    fails: 0,
                    coarse_apex_pct: cand.apex_pct,
                    fine_apex_pct: null,
                    disagrees: false
                });
                continue;
            }
            return r;
        }
        const c = r.value;
        if (!constraintsSatisfied(c.constraint_rows)) {
            tried.push({
                s_ti: cand.s_ti,
                outcome: "constraint_violated",
                fails: c.ranked.line.verdict.doctrine.fail,
                coarse_apex_pct: cand.apex_pct,
                fine_apex_pct: c.fine_apex_pct,
                disagrees: false
            });
            continue;
        }
        if (c.ranked.line.verdict.ok)
            return ok(c.ranked.line);
        // fine run contradicts the coarse promise? (containment or plausible band)
        const disagrees = c.self_verify_disagrees || c.ranked.line.verdict.outcome !== "contained";
        tried.push({
            s_ti: cand.s_ti,
            outcome: c.ranked.line.verdict.outcome,
            fails: c.ranked.line.verdict.doctrine.fail,
            coarse_apex_pct: cand.apex_pct,
            fine_apex_pct: c.fine_apex_pct,
            disagrees
        });
    }
    const disagreement = tried.find((t) => t.disagrees);
    if (disagreement !== undefined) {
        return err(noSolution("coarse_fine_disagreement", "solve.suggest", `the coarse winner at s=${disagreement.s_ti.toFixed(2)} did not hold at full resolution`, {
            s_ti: disagreement.s_ti,
            coarse_apex_pct: disagreement.coarse_apex_pct,
            fine_apex_pct: disagreement.fine_apex_pct,
            fine_outcome: disagreement.outcome
        }));
    }
    return err(noSolution("non_clean_band", "solve.suggest", "contained candidates exist but none verifies clean — solver brackets or profile are the problem", {
        corner_id: ctx.corner.id,
        tried: tried.map((t) => ({ s_ti: t.s_ti, outcome: t.outcome, fails: t.fails }))
    }));
}
function bestFailingLoop(ctx, candidates, survivors) {
    // §4.8.2: full-solve at least BEST_FAILING_MIN_CANDIDATES turn-in candidates
    // even when the contained band is empty — take the nearest-to-contained by
    // corridor excess.
    const want = Math.max(SUGGEST_TOPN, BEST_FAILING_MIN_CANDIDATES);
    const chosen = survivors.slice(0, want);
    if (chosen.length < want) {
        const inChosen = new Set(chosen.map((c) => c.s_ti));
        const fallback = candidates
            .filter((c) => c.error === null && !inChosen.has(c.s_ti) && c.constraint_ok)
            .sort((a, b) => a.corridor_excess_m !== b.corridor_excess_m
            ? a.corridor_excess_m - b.corridor_excess_m
            : a.s_ti - b.s_ti);
        for (const c of fallback) {
            if (chosen.length >= want)
                break;
            chosen.push(c);
        }
    }
    // one full-solve per station (§4.8.1: the probe never short-circuits here);
    // memoized so the monotone emulation below costs no extra engine runs
    const solvedAt = new Map();
    const solveAt = (s_ti) => {
        const hit = solvedAt.get(s_ti);
        if (hit !== undefined)
            return hit;
        const r = fullSolveAtStation(ctx, s_ti, { short_circuit_probe: false });
        solvedAt.set(s_ti, r);
        return r;
    };
    // P-ACCEPT-MONOTONE (§4.8.5): when accept=clean would have succeeded,
    // best_failing must return the byte-identical line. cleanLoop walks the
    // first SUGGEST_TOPN survivors with the probe short-circuiting — replay that
    // walk here (a probe-infeasible placement is one clean REFUSED, so a clean
    // self-verified line from it must never displace clean's own pick).
    for (const cand of survivors.slice(0, SUGGEST_TOPN)) {
        const r = solveAt(cand.s_ti);
        if (!r.ok) {
            if (r.error.code === "NO_SOLUTION")
                continue;
            return r;
        }
        const c = r.value;
        if (c.probe_infeasible)
            continue; // clean short-circuited this placement
        if (!constraintsSatisfied(c.constraint_rows))
            continue;
        if (c.ranked.line.verdict.ok)
            return ok(c.ranked.line); // clean's own pick
    }
    const pool = [];
    let violation = null;
    for (const cand of chosen) {
        const r = solveAt(cand.s_ti);
        if (!r.ok) {
            if (r.error.code === "NO_SOLUTION")
                continue; // this placement refuses; the pool decides
            return r;
        }
        const c = r.value;
        if (!constraintsSatisfied(c.constraint_rows)) {
            violation = c.constraint_rows;
            continue; // D10 bounds stay hard under every accept policy
        }
        if (c.self_verify_disagrees)
            continue; // discarded, never ranked (§4.8.2)
        pool.push(c.ranked); // clean self-verified lines rank first by §4.8.4 (i)–(ii)
    }
    if (pool.length === 0 && violation !== null) {
        return err(constraintUnmet(violation, "solve.suggest"));
    }
    if (pool.length === 0 && chosen.length === 0) {
        // every candidate fell to the §4.5 filter before full-solving
        const constraintKilled = candidates.filter((c) => c.error === null && !c.constraint_ok && c.constraint_rows !== null);
        if (constraintKilled.length > 0) {
            return err(constraintUnmet(constraintKilled[0].constraint_rows, "solve.suggest"));
        }
    }
    const picked = pickBestFailing(pool);
    return "code" in picked ? err(picked) : ok(picked);
}
// ---------------------------------------------------------------------------
/**
 * suggestTurnIn(spec) → Result<LineResult> (design/04 §3): answers "where
 * should I turn in?" — always the auto pipeline. A pinned turn-in station on a
 * *suggestion* call is dead input (nothing is ever accepted-and-ignored).
 */
export function suggestTurnIn(spec) {
    if (typeof spec.turn_in === "number") {
        return err({
            code: "INEFFECTUAL",
            at: "turn_in",
            message: "suggestTurnIn searches the turn-in; a pinned station leaves nothing to suggest",
            detail: { reason: "turn_in_pinned_on_suggest" }
        });
    }
    const ctxR = buildSolveContext(spec);
    if (!ctxR.ok)
        return ctxR;
    if (ctxR.value.directives.turn_in.kind === "pinned") {
        return err({
            code: "INEFFECTUAL",
            at: "plan.turn_in",
            message: "suggestTurnIn searches the turn-in; an authored turn-in leaves nothing to suggest",
            detail: { reason: "turn_in_pinned_on_suggest" }
        });
    }
    return autoSolve(ctxR.value);
}
//# sourceMappingURL=suggest.js.map