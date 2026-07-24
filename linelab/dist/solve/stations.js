// solve/stations.ts — derived stations per corner + the `road_too_short`
// refusal (design/04 §4.1a; ARCHITECTURE §5). Every solver station constant is
// a fraction of per-corner reference lengths computed once per corner from the
// composed RoadModel; a bracket that DEGENERATES after clamping is the typed
// NO_SOLUTION/road_too_short refusal, never a silent rail.
//
// Quantities that depend on the candidate turn-in under test (`s_ti`) — the
// fit-clipped decel bracket and the roll-on bracket — are exposed as per-
// candidate functions (the design's own worked numbers evaluate them at an
// example candidate: book90's roll-on bracket "at s_ti = 13", C30's decel
// bracket at the analogous s0 + 1).
//
// ARCHITECTURE §10 pin 15: v_target in decel_min_fit =
// speedForLean(r_min(corner), lean_frac·phiReserve(mu_use)); a non-positive
// denominator folds into road_too_short/brake_run.
import { err, ok } from "../core/result.js";
import { muUse, phiReserve, speedForLean } from "../core/slice.js";
import { BRAKE_GAP_F, BRAKE_GAP_MAX_M, BRAKE_GAP_MIN_M, BRAKE_RUN_MIN_M, BRACKET_MIN_M, CRACK_GAP_F, CRACK_GAP_MAX_M, CRACK_GAP_MIN_M, DECEL_HI, DECEL_LO, N_SWEEP, ROLLON_GUARD_M, ROLLON_HI_F, ROLLON_LO_F, SWEEP_BACK_APP_F, SWEEP_BACK_ARC_F, SWEEP_FWD_F, SWEEP_SPAN_MIN_M, SWEEP_STEP_MIN_M, lean_frac } from "./constants.js";
export function roadTooShort(quantity, corner_id, required_m, available_m) {
    return {
        code: "NO_SOLUTION",
        at: `solve.stations.${corner_id}`,
        message: `road too short for ${quantity} on ${corner_id}: need ${required_m.toFixed(2)} m, have ${available_m.toFixed(2)} m`,
        detail: { sub_reason: "road_too_short", quantity, corner_id, required_m, available_m }
    };
}
export function refLengths(road, index) {
    const corner = road.corners[index];
    const prev = road.corners[index - 1];
    const next = road.corners[index + 1];
    return {
        L_arc: corner.s1 - corner.s0,
        L_app: corner.s0 - Math.max(0, prev?.s1 ?? 0),
        L_exit: Math.min(road.total_len_m, next?.s0 ?? road.total_len_m) - corner.s1,
        gap_next: next !== undefined ? next.s0 - corner.s1 : null
    };
}
function clamp(x, lo, hi) {
    return Math.min(hi, Math.max(lo, x));
}
/** Candidate list: N_SWEEP evenly spaced, spacing floored (drop candidates, keep span). */
function sweepCandidates(lo, hi) {
    const span = hi - lo;
    const evenSpacing = span / (N_SWEEP - 1);
    const count = evenSpacing >= SWEEP_STEP_MIN_M
        ? N_SWEEP
        : Math.max(2, Math.floor(span / SWEEP_STEP_MIN_M) + 1);
    const out = [];
    for (let i = 0; i < count; i++)
        out.push(lo + (span * i) / (count - 1));
    return out;
}
/**
 * Derive the per-corner stations (§4.1a). Refuses road_too_short/turn_in_sweep
 * when the clamped sweep span falls below SWEEP_SPAN_MIN_M.
 */
export function deriveStations(road, index) {
    const corner = road.corners[index];
    if (corner === undefined) {
        return err({
            code: "INTERNAL",
            at: "solve.stations",
            message: `no corner at index ${index}`,
            detail: { reason: "corner_index_out_of_range", index }
        });
    }
    const ref = refLengths(road, index);
    const prevS1 = Math.max(0, road.corners[index - 1]?.s1 ?? 0);
    const back = Math.min(SWEEP_BACK_APP_F * ref.L_app, SWEEP_BACK_ARC_F * ref.L_arc);
    const lo = Math.max(corner.s0 - back, prevS1);
    const hi = corner.s0 + SWEEP_FWD_F * ref.L_arc;
    const span_m = hi - lo;
    if (span_m < SWEEP_SPAN_MIN_M) {
        return err(roadTooShort("turn_in_sweep", corner.id, SWEEP_SPAN_MIN_M, span_m));
    }
    const brake_gap_m = clamp(BRAKE_GAP_F * ref.L_app, BRAKE_GAP_MIN_M, BRAKE_GAP_MAX_M);
    const s_brake_start = index === 0 ? 0 : prevS1 + BRAKE_RUN_MIN_M;
    const crack_gap_m = clamp(CRACK_GAP_F * ref.L_arc, CRACK_GAP_MIN_M, CRACK_GAP_MAX_M);
    return ok({
        corner,
        ref,
        sweep: { lo, hi, span_m, candidates: sweepCandidates(lo, hi) },
        brake_gap_m,
        s_brake_start,
        crack_gap_m
    });
}
// ---------------------------------------------------------------------------
// Per-candidate brackets
/**
 * v_target for the fit clip (ARCHITECTURE §10 pin 15):
 * speedForLean(r_min(corner), lean_frac·phiReserve(mu_use)) [m/s].
 */
export function vTargetMs(corner, skill, mu) {
    return speedForLean(corner.r_min, lean_frac * phiReserve(muUse(skill, mu)));
}
/**
 * The fit-clipped decel bracket at candidate `s_ti` (§4.1a). Refuses
 * road_too_short/brake_run when decel_min_fit > DECEL_HI (the entry speed
 * cannot be shed in the available approach at the bracket's hardest decel) or
 * when the braking run itself is non-positive (pin 15).
 */
export function decelBracketAt(d, s_ti, v_entry_ms, v_target_ms) {
    const run_m = s_ti - d.brake_gap_m - d.s_brake_start;
    const dv2 = Math.max(0, v_entry_ms * v_entry_ms - v_target_ms * v_target_ms);
    const required_m = dv2 / (2 * DECEL_HI);
    if (run_m <= 0) {
        return err(roadTooShort("brake_run", d.corner.id, required_m, run_m));
    }
    const decel_min_fit = dv2 / (2 * run_m);
    if (decel_min_fit > DECEL_HI) {
        return err(roadTooShort("brake_run", d.corner.id, required_m, run_m));
    }
    return ok({ lo: Math.max(DECEL_LO, decel_min_fit), hi: DECEL_HI, decel_min_fit });
}
/**
 * The roll-on bracket (exit-bisection domain) at candidate `s_ti` (§4.1a),
 * with `s_crack = s_ti + crack_gap`. Refuses road_too_short/roll_on_bracket
 * when the clamped width falls below BRACKET_MIN_M.
 */
export function rollOnBracketAt(d, s_ti) {
    const s_crack = s_ti + d.crack_gap_m;
    const lo = Math.max(s_crack + ROLLON_GUARD_M, s_ti + ROLLON_LO_F * d.ref.L_arc);
    const hi = Math.min(s_ti + ROLLON_HI_F * d.ref.L_arc, d.corner.s1);
    const width = hi - lo;
    if (width < BRACKET_MIN_M) {
        return err(roadTooShort("roll_on_bracket", d.corner.id, BRACKET_MIN_M, width));
    }
    return ok({ lo, hi });
}
//# sourceMappingURL=stations.js.map