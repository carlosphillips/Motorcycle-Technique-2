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
//      Symmetrically (see rescueCoarseBand): a coarse-stage REFUSAL is not
//      shipped unverified either — an empty survivor set spends the same §3
//      step-3 budget at full resolution before the sweep may blame the
//      road/speed, because the cheap run holds the pipeline's own drive
//      control fixed and that alone empties the band on long sweeps.
//
// The §4.8 best_failing pooling for the auto path also lives here (the pool is
// the full-resolution, self-verified candidates this loop produces).
//
// This module and solve.ts are deliberately co-recursive (the design's own §3
// ⇄ §4 structure: the sweep full-solves via §4; §4's auto turn-in sweeps via
// §3); all cross-calls are runtime-only function calls, so the ESM cycle is
// benign.

import type { LinelabError, Result } from "../core/result.js";
import { err, ok } from "../core/result.js";
import type { AcceptPolicy } from "../plan/types.js";
import { BEST_FAILING_MIN_CANDIDATES, SUGGEST_TOPN } from "./constants.js";
import { pickBestFailing } from "./accept.js";
import type { RankedCandidate } from "./accept.js";
import type { LineResult } from "./types.js";
import {
  buildSolveContext,
  coarseCandidate,
  constraintUnmet,
  constraintsSatisfied,
  fullSolveAtStation,
  noSolution,
  type CoarseCandidate,
  type SolveCtx,
  type SolveInput
} from "./solve.js";
import type { ConstraintRow } from "./types.js";

// ---------------------------------------------------------------------------

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
export function coarseSweep(ctx: SolveCtx): Result<CoarseSweepResult> {
  const candidates = ctx.stations.sweep.candidates.map((s_ti) => coarseCandidate(ctx, s_ti));
  const runnable = candidates.filter((c) => c.error === null);
  if (runnable.length === 0) {
    // all candidates dead: surface the widest (latest) candidate's typed error
    return err(candidates[candidates.length - 1]!.error!);
  }
  const survivors = runnable
    .filter((c) => c.contained && c.in_band && c.constraint_ok)
    .sort((a, b) => (a.rank !== b.rank ? a.rank - b.rank : a.s_ti - b.s_ti));
  return ok({ candidates, survivors });
}

// ---------------------------------------------------------------------------
// The auto pipeline (§3 steps 3–4 + §4.8 pooling)

interface TriedCandidate {
  readonly s_ti: number;
  readonly outcome: string;
  readonly fails: number;
  readonly coarse_apex_pct: number | null;
  readonly fine_apex_pct: number | null;
  readonly disagrees: boolean;
}

export function autoSolve(ctx: SolveCtx): Result<LineResult> {
  const sweepR = coarseSweep(ctx);
  if (!sweepR.ok) return sweepR;
  const { candidates, survivors } = sweepR.value;

  return ctx.policy === "clean" ? cleanLoop(ctx, candidates, survivors) : bestFailingLoop(ctx, candidates, survivors);
}

/**
 * The coarse band's escape hatch (the other half of §3's coarse/fine
 * discipline).
 *
 * The doc forbids shipping a coarse *promise* unverified — a coarse winner
 * must re-verify at full resolution or the refusal is
 * `coarse_fine_disagreement`. The same discipline binds in the other
 * direction, and was missing: a coarse *refusal* is equally unverified,
 * because the one cheap run per candidate holds two of the pipeline's own
 * search variables FIXED — decel at nominal, and the drive roll-on at the
 * type-aware aim station (`solve.ts`'s `aimStation`, clamped into the §4.1a
 * bracket). §4.2 states what the coarse filter is actually for: the probe
 * asks whether "this *turn-in placement* can work at all", because "a
 * placement problem cannot be braked or throttled away". A candidate that
 * only runs wide because the fixed drive starts too early is the exact
 * complement of that: it IS throttled away, by the §4.2 roll-on bisection
 * that runs next.
 *
 * That gap is sweep-angle-shaped. The aim station sits at
 * `target_apex_pct` of the arc, so the sweep still to be turned after the
 * drive opens is `(1 − target/100) · angle_deg` — 37.8° on a 90° corner,
 * 54.6° on a 130° one. Past roughly 85° the fixed-drive run leaves the
 * corridor on every swept station, the survivor set empties, and the solver
 * refuses `empty_band` — whose own message blames the road and speed.
 * Worked counter-example: `lane 3.5 | S 10 | L 24 ^130 | S 12` at 30 km/h,
 * candidate `s_ti = 6.69` — coarse run `off_road` at s 63.5 with the drive
 * pinned at the aim station 41.58; full solve at the SAME station bisects
 * the drive to 50.76 and self-verifies `contained`, `verdict.ok`.
 *
 * So the sweep spends a bounded full-resolution budget before it may claim
 * the road/speed is at fault: the same `SUGGEST_TOPN` full solves §3 step 3
 * already licenses, walked in STATION order. Station order, not §3.2's
 * `|apex_pct − target|` rank: that rank is read off the very run whose
 * containment verdict we have just established is unrepresentative, so it
 * cannot order the rescue; ascending station is §4.8.4(v)'s own
 * deterministic, hash-stable tie-break and leans on nothing measured by the
 * fixed-drive run.
 *
 * Only a CLEAN self-verified line rescues the sweep — a failing line proves
 * nothing the coarse band did not already say — so every refusal this
 * pipeline made before, it still makes, with the same sub-reason and
 * payload.
 */
function rescueCoarseBand(
  ctx: SolveCtx,
  candidates: readonly CoarseCandidate[]
): LineResult | null {
  const pool = candidates
    .filter((c) => c.error === null && c.constraint_ok)
    .slice(0, SUGGEST_TOPN);

  for (const cand of pool) {
    const r = fullSolveAtStation(ctx, cand.s_ti, { short_circuit_probe: true });
    if (!r.ok) continue; // a typed placement refusal at this station
    const c = r.value;
    if (!constraintsSatisfied(c.constraint_rows)) continue;
    if (c.ranked.line.verdict.ok) return c.ranked.line;
  }
  return null;
}

function cleanLoop(
  ctx: SolveCtx,
  candidates: readonly CoarseCandidate[],
  survivors: readonly CoarseCandidate[]
): Result<LineResult> {
  if (survivors.length === 0) {
    // §4.5: when candidates exist but every one violates an authored bound,
    // the refusal is constraint_unmet — never a silent empty_band
    const constraintKilled = candidates.filter(
      (c) => c.error === null && c.contained && c.in_band && !c.constraint_ok && c.constraint_rows !== null
    );
    if (constraintKilled.length > 0) {
      return err(constraintUnmet(constraintKilled[0]!.constraint_rows!, "solve.suggest"));
    }
    const rescued = rescueCoarseBand(ctx, candidates);
    if (rescued !== null) return ok(rescued);
    return err(
      noSolution("empty_band", "solve.suggest", "no contained candidate with an in-band apex exists — the road/speed combination is the problem", {
        corner_id: ctx.corner.id,
        sweep: [ctx.stations.sweep.lo, ctx.stations.sweep.hi],
        candidates: ctx.stations.sweep.candidates.length
      })
    );
  }

  const tried: TriedCandidate[] = [];
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
    if (c.ranked.line.verdict.ok) return ok(c.ranked.line);
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
    return err(
      noSolution("coarse_fine_disagreement", "solve.suggest", `the coarse winner at s=${disagreement.s_ti.toFixed(2)} did not hold at full resolution`, {
        s_ti: disagreement.s_ti,
        coarse_apex_pct: disagreement.coarse_apex_pct,
        fine_apex_pct: disagreement.fine_apex_pct,
        fine_outcome: disagreement.outcome
      })
    );
  }
  return err(
    noSolution("non_clean_band", "solve.suggest", "contained candidates exist but none verifies clean — solver brackets or profile are the problem", {
      corner_id: ctx.corner.id,
      tried: tried.map((t) => ({ s_ti: t.s_ti, outcome: t.outcome, fails: t.fails }))
    })
  );
}

function bestFailingLoop(
  ctx: SolveCtx,
  candidates: readonly CoarseCandidate[],
  survivors: readonly CoarseCandidate[]
): Result<LineResult> {
  // §4.8.2: full-solve at least BEST_FAILING_MIN_CANDIDATES turn-in candidates
  // even when the contained band is empty — take the nearest-to-contained by
  // corridor excess.
  const want = Math.max(SUGGEST_TOPN, BEST_FAILING_MIN_CANDIDATES);
  const chosen: CoarseCandidate[] = survivors.slice(0, want);
  if (chosen.length < want) {
    const inChosen = new Set(chosen.map((c) => c.s_ti));
    const fallback = candidates
      .filter((c) => c.error === null && !inChosen.has(c.s_ti) && c.constraint_ok)
      .sort((a, b) =>
        a.corridor_excess_m !== b.corridor_excess_m
          ? a.corridor_excess_m - b.corridor_excess_m
          : a.s_ti - b.s_ti
      );
    for (const c of fallback) {
      if (chosen.length >= want) break;
      chosen.push(c);
    }
  }

  // one full-solve per station (§4.8.1: the probe never short-circuits here);
  // memoized so the monotone emulation below costs no extra engine runs
  const solvedAt = new Map<number, ReturnType<typeof fullSolveAtStation>>();
  const solveAt = (s_ti: number): ReturnType<typeof fullSolveAtStation> => {
    const hit = solvedAt.get(s_ti);
    if (hit !== undefined) return hit;
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
      if (r.error.code === "NO_SOLUTION") continue;
      return r;
    }
    const c = r.value;
    if (c.probe_infeasible) continue; // clean short-circuited this placement
    if (!constraintsSatisfied(c.constraint_rows)) continue;
    if (c.ranked.line.verdict.ok) return ok(c.ranked.line); // clean's own pick
  }

  const pool: RankedCandidate[] = [];
  let violation: readonly ConstraintRow[] | null = null;
  for (const cand of chosen) {
    const r = solveAt(cand.s_ti);
    if (!r.ok) {
      if (r.error.code === "NO_SOLUTION") continue; // this placement refuses; the pool decides
      return r;
    }
    const c = r.value;
    if (!constraintsSatisfied(c.constraint_rows)) {
      violation = c.constraint_rows;
      continue; // D10 bounds stay hard under every accept policy
    }
    if (c.self_verify_disagrees) continue; // discarded, never ranked (§4.8.2)
    pool.push(c.ranked); // clean self-verified lines rank first by §4.8.4 (i)–(ii)
  }

  if (pool.length === 0 && violation !== null) {
    return err(constraintUnmet(violation, "solve.suggest"));
  }
  if (pool.length === 0 && chosen.length === 0) {
    // every candidate fell to the §4.5 filter before full-solving
    const constraintKilled = candidates.filter(
      (c) => c.error === null && !c.constraint_ok && c.constraint_rows !== null
    );
    if (constraintKilled.length > 0) {
      return err(constraintUnmet(constraintKilled[0]!.constraint_rows!, "solve.suggest"));
    }
  }
  const picked = pickBestFailing(pool);
  return "code" in picked ? err(picked as LinelabError) : ok(picked);
}

// ---------------------------------------------------------------------------

/**
 * suggestTurnIn(spec) → Result<LineResult> (design/04 §3): answers "where
 * should I turn in?" — always the auto pipeline. A pinned turn-in station on a
 * *suggestion* call is dead input (nothing is ever accepted-and-ignored).
 */
export function suggestTurnIn(spec: SolveInput): Result<LineResult> {
  if (typeof spec.turn_in === "number") {
    return err({
      code: "INEFFECTUAL",
      at: "turn_in",
      message: "suggestTurnIn searches the turn-in; a pinned station leaves nothing to suggest",
      detail: { reason: "turn_in_pinned_on_suggest" }
    } satisfies LinelabError);
  }
  const ctxR = buildSolveContext(spec);
  if (!ctxR.ok) return ctxR;
  if (ctxR.value.directives.turn_in.kind === "pinned") {
    return err({
      code: "INEFFECTUAL",
      at: "plan.turn_in",
      message: "suggestTurnIn searches the turn-in; an authored turn-in leaves nothing to suggest",
      detail: { reason: "turn_in_pinned_on_suggest" }
    } satisfies LinelabError);
  }
  return autoSolve(ctxR.value);
}
