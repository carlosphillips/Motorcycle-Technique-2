// solve/doubleApex.ts — solveDoubleApex + the formal two-touch predicate
// (design/04 §4.6; ARCHITECTURE §5, WP-11).
//
// The planned two-touch line: a fixed-plan search (coarse → fine, ascending
// gentlest decel) over a COMPOUND CORNER WINDOW — one corner, or a maximal run
// of same-hand consecutive `linked_next` corners treated as one. All internal
// constants are 04 §4.6's (declared by WP-10 in solve/constants.ts; imported,
// never re-declared). `pct` means percent of cumulative swept angle across the
// window.
//
// "Touch", defined (the solver-internal candidate-acceptance filter): a local
// minimum of the lane-fraction series over the window with depth
// f_min ≤ DA_TOUCH_F_MAX, prominence ≥ DA_PROMINENCE_F (noise-ignored below
// DA_PROMINENCE_NOISE), separation ≥ DA_TOUCH_SEP_PCT percent of window sweep.
// The predicate is evaluated over the RECORDED apex list (the ONE hysteresis
// detector of core/analyze.ts is the recorder — drift risk #4), so an accepted
// two-touch line always records exactly two apexes across the window.
//
// Recorded WP-11 judgments (see the return report):
//  - acceptance = contained + exactly-two-touch + constraints; a contained
//    two-touch line whose doctrine run is non-clean is RETURNED with
//    acceptance {met:false} per the §4.2.3 non-clean self-verify seam, never
//    refused (the §4.6 "passes the applicable doctrine set" letter yields to
//    the §4.2.3 never-patched seam).
//  - the resolved window rides in source.solveSpec.corner as "<a>..<b>"
//    (LineSource.solveSpec is WP-09's frozen SolveSpec shape; it has no
//    separate corner_ids/s0/s1 members to fill).
//  - A-DOUBLEAPEX SEAM adjudicated 2026-07-23, CONFIRMED: bookDoubleApex's
//    no_two_touch_line refusal is the engine's honest answer — the only
//    contained two-touch family is a below-validity crawl family off the
//    pinned grid whose touch 2 bottoms at the window boundary (pct ≈ 99.8,
//    band [68, 92]) with frame-handoff ripple apexes; and the compound-window
//    release reading fails on arithmetic (touch radius 12.7 m vs c2's 24.4 m
//    inside edge needs v² × 1.92; DA_MID_ACCEL = 1.0 delivers × 1.63). Full
//    argument + executable tripwire: test/property/solver-ext.test.ts
//    ("A-DOUBLEAPEX SEAM"). Resolution is a design decision, not a search or
//    binding fix.
import { err, ok } from "../core/result.js";
import { G, eps_f_detect, v_valid_min_ms } from "../core/constants.js";
import { muUse, phiReserve, speedForLean } from "../core/slice.js";
import { BRAKE_GAP_F, BRAKE_GAP_MAX_M, BRAKE_GAP_MIN_M, DA_APEX1_PCT, DA_APEX1_TOL, DA_APEX2_PCT, DA_APEX2_TOL, DA_GRID_N, DA_MID_ACCEL, DA_PROMINENCE_F, DA_PROMINENCE_NOISE, DA_SWEEP_MIN_DEG, DA_TI2_HALF_F, DA_TI2_PCT, DA_TOUCH_F_MAX, DA_TOUCH_SEP_PCT, DECEL_HI, DECEL_LO, N_DA_DECEL, N_DA_FINE, ROLLON_ACCEL_MS2, SOLVER_BRAKE_SLEW_MSS, SWEEP_BACK_APP_F, SWEEP_BACK_ARC_F, SWEEP_FWD_F, exit_target, lean_frac } from "./constants.js";
import { constraintUnmet, constraintsSatisfied, evalConstraints, measureRun, noSolution, predictVti } from "./solve.js";
import { roadTooShort } from "./stations.js";
import { buildChainContext, composeSpecRoad, executeSolvedPlan, wirePlanFromResolved, wireRoadSpecOf } from "./chained.js";
function windowOf(road, indices) {
    const corners = indices.map((i) => road.corners[i]);
    const first = corners[0];
    const last = corners[corners.length - 1];
    return {
        indices,
        corners,
        s0: first.s0,
        s1: last.s1,
        L_arc: last.s1 - first.s0,
        sweep_deg: corners.reduce((acc, c) => acc + c.angle_deg, 0)
    };
}
/** Maximal same-hand consecutive linked runs (each corner alone is also a window). */
function candidateWindows(road) {
    const out = [];
    let run = [];
    const flush = () => {
        if (run.length > 0)
            out.push(windowOf(road, run));
        run = [];
    };
    for (let i = 0; i < road.corners.length; i++) {
        const c = road.corners[i];
        if (run.length === 0) {
            run = [i];
        }
        else {
            const prev = road.corners[run[run.length - 1]];
            if (prev.linked_next && prev.hand === c.hand)
                run.push(i);
            else {
                flush();
                run = [i];
            }
        }
    }
    flush();
    return out;
}
/** §4.6 qualification — universal, explicit targets included: total sweep ≥ DA_SWEEP_MIN_DEG. */
function qualifyWindow(w) {
    if (w.sweep_deg < DA_SWEEP_MIN_DEG) {
        return err(noSolution("no_double_apex_geometry", "solveDoubleApex", "the targeted window does not reach the double-apex sweep qualification", {
            best_window_sweep_deg: w.sweep_deg,
            required_sweep_deg: DA_SWEEP_MIN_DEG
        }));
    }
    return ok(w);
}
function resolveWindow(road, corner) {
    if (corner !== undefined) {
        if (corner.includes("..")) {
            const [a, b] = corner.split("..");
            const ia = road.corners.findIndex((c) => c.id === a);
            const ib = road.corners.findIndex((c) => c.id === b);
            if (ia < 0 || ib < 0 || ib < ia) {
                return err({
                    code: "UNKNOWN_ID",
                    at: "corner",
                    message: `corner span "${corner}" does not name an ascending pair of corners`,
                    detail: { reason: "unknown_corner_span", span: corner }
                });
            }
            const indices = [];
            for (let i = ia; i <= ib; i++)
                indices.push(i);
            // the compound window must be one same-hand linked run (04 §4.6)
            for (let k = 0; k + 1 < indices.length; k++) {
                const cA = road.corners[indices[k]];
                const cB = road.corners[indices[k + 1]];
                if (!cA.linked_next || cA.hand !== cB.hand) {
                    const w = windowOf(road, indices);
                    return err(noSolution("no_double_apex_geometry", "solveDoubleApex", `corners ${cA.id} and ${cB.id} are not a same-hand linked pair`, {
                        best_window_sweep_deg: w.sweep_deg,
                        required_sweep_deg: DA_SWEEP_MIN_DEG
                    }));
                }
            }
            return qualifyWindow(windowOf(road, indices));
        }
        const i = road.corners.findIndex((c) => c.id === corner);
        if (i < 0) {
            return err({
                code: "UNKNOWN_ID",
                at: "corner",
                message: `unknown corner id "${corner}"`,
                detail: { reason: "unknown_corner_id", corner_id: corner }
            });
        }
        return qualifyWindow(windowOf(road, [i]));
    }
    // omitted: the qualifying window with the largest total sweep
    const windows = candidateWindows(road);
    let best = null;
    for (const w of windows) {
        if (best === null || w.sweep_deg > best.sweep_deg)
            best = w;
    }
    if (best === null || best.sweep_deg < DA_SWEEP_MIN_DEG) {
        return err(noSolution("no_double_apex_geometry", "solveDoubleApex", "no window reaches the double-apex sweep qualification", {
            best_window_sweep_deg: best !== null ? best.sweep_deg : 0,
            required_sweep_deg: DA_SWEEP_MIN_DEG
        }));
    }
    return ok(best);
}
export function sweepScale(w) {
    // piecewise-linear in each corner's arc (constant arcs sweep linearly in s;
    // tapers sweep linearly in swept angle by construction, so per-corner linear
    // interpolation over angle_deg is exact for arcs and first-order for tapers)
    const bounds = [];
    let acc = 0;
    for (const c of w.corners) {
        bounds.push({ s0: c.s0, s1: c.s1, a0: acc, a1: acc + c.angle_deg });
        acc += c.angle_deg;
    }
    const total = acc;
    const pctAt = (s) => {
        if (s <= w.s0)
            return 0;
        if (s >= w.s1)
            return 100;
        for (const b of bounds) {
            if (s <= b.s1 + 1e-9 && s >= b.s0 - 1e-9) {
                const frac = (s - b.s0) / Math.max(1e-9, b.s1 - b.s0);
                return (100 * (b.a0 + frac * (b.a1 - b.a0))) / total;
            }
            // inter-corner gap inside a linked window contributes no sweep
            if (s < b.s0)
                return (100 * b.a0) / total;
        }
        return 100;
    };
    const sAt = (pct) => {
        const angle = (pct / 100) * total;
        for (const b of bounds) {
            if (angle <= b.a1 + 1e-12) {
                const frac = (angle - b.a0) / Math.max(1e-12, b.a1 - b.a0);
                return b.s0 + frac * (b.s1 - b.s0);
            }
        }
        return w.s1;
    };
    return { pctAt, sAt };
}
/**
 * Evaluate the §4.6 touch predicate: candidate touches are the recorded apexes
 * within the window with depth f ≤ DA_TOUCH_F_MAX; prominence is measured on
 * the sample series between consecutive candidates (max f must exceed the
 * larger minimum by ≥ DA_PROMINENCE_F; below DA_PROMINENCE_NOISE the shallower
 * candidate is noise-merged); separation ≥ DA_TOUCH_SEP_PCT percent of window
 * sweep. Exactly two surviving touches = two_touch.
 */
export function touchesOf(apexes, samples, w, scale) {
    const candidates = apexes
        .filter((a) => a.s >= w.s0 - 1e-9 && a.s <= w.s1 + 1e-9 && a.f <= DA_TOUCH_F_MAX)
        .map((a) => ({ s: a.s, pct: scale.pctAt(a.s), f: a.f }))
        .sort((a, b) => a.s - b.s);
    const maxFBetween = (sA, sB) => {
        let max = Number.NEGATIVE_INFINITY;
        for (const sm of samples) {
            if (sm.s <= sA || sm.s >= sB)
                continue;
            if (sm.f > max)
                max = sm.f;
        }
        return max;
    };
    // prominence + noise merge, walked left to right
    const merged = [];
    for (const cand of candidates) {
        if (merged.length === 0) {
            merged.push(cand);
            continue;
        }
        const prev = merged[merged.length - 1];
        const between = maxFBetween(prev.s, cand.s);
        const prominence = between - Math.max(prev.f, cand.f);
        if (prominence < DA_PROMINENCE_NOISE) {
            // noise: keep the deeper of the two
            if (cand.f < prev.f)
                merged[merged.length - 1] = cand;
            continue;
        }
        if (prominence < DA_PROMINENCE_F) {
            // a genuine but under-prominent double-dip: keep the deeper — the pair
            // does NOT count as two touches
            if (cand.f < prev.f)
                merged[merged.length - 1] = cand;
            continue;
        }
        merged.push(cand);
    }
    // separation
    const touches = [];
    for (const t of merged) {
        const prev = touches[touches.length - 1];
        if (prev !== undefined && t.pct - prev.pct < DA_TOUCH_SEP_PCT) {
            if (t.f < prev.f)
                touches[touches.length - 1] = t;
            continue;
        }
        touches.push(t);
    }
    return { touches, two_touch: touches.length === 2 };
}
/** Window apexes from a run measure (per-corner recorded rows, station order). */
function windowApexes(m, w) {
    const out = [];
    for (const c of w.corners) {
        const row = m.rows.find((r) => r.id === c.id);
        if (row === undefined)
            continue;
        for (const a of row.apexes)
            out.push({ s: a.s, f: a.f });
    }
    return out.sort((a, b) => a.s - b.s);
}
function daPlan(shape, w, brakeStart, brakeGap, entryV, firstHand) {
    const actions = [];
    if (shape.decel > 0) {
        const sEnd = shape.ti1 - brakeGap;
        const sRelease = Math.max(brakeStart + 0.5, sEnd - (entryV * shape.decel) / SOLVER_BRAKE_SLEW_MSS);
        actions.push({ do: "brake", id: "b_da", at_s: brakeStart, decel: shape.decel, slew_mss: SOLVER_BRAKE_SLEW_MSS });
        actions.push({ do: "throttle", id: "k_da1", at_s: Math.min(sEnd, sRelease), accel: 0, slew_mss: SOLVER_BRAKE_SLEW_MSS });
    }
    actions.push({ do: "turn_in", id: "ti_da1", at_s: shape.ti1, target: { lean_deg: shape.lean1 }, hand: firstHand });
    // mid-drive: roll-on widening produces the drift back out between the
    // touches (02 §2's causal identity — no position action anywhere)
    const midOn = Math.max(shape.ti1 + 1, Math.min(shape.ti2 - 1, (shape.ti1 + shape.ti2) / 2));
    actions.push({ do: "throttle", id: "mid_da", at_s: midOn, accel: DA_MID_ACCEL, slew_mss: SOLVER_BRAKE_SLEW_MSS });
    actions.push({ do: "turn_in", id: "ti_da2", at_s: shape.ti2, target: { lean_deg: shape.lean2 }, hand: firstHand });
    actions.push({ do: "throttle", id: "k_da2", at_s: shape.ti2 + 0.5, accel: 0, slew_mss: SOLVER_BRAKE_SLEW_MSS });
    if (shape.rollOn !== null) {
        actions.push({ do: "throttle", id: "ro_da", at_s: shape.rollOn, accel: ROLLON_ACCEL_MS2, slew_mss: SOLVER_BRAKE_SLEW_MSS });
    }
    return actions.sort((a, b) => a.at_s - b.at_s);
}
/**
 * solveDoubleApex({road, entry_kmh, profile?, mu?, constraints?, vis?, corner?})
 * → Result<LineResult> (design/04 §4.6). Two turn-ins, both touches, and the
 * mid-drift are all emergent; the author supplies only the window and speed.
 */
export function solveDoubleApex(spec) {
    const composed = composeSpecRoad(spec.road);
    if (!composed.ok)
        return composed;
    const road = composed.value;
    const windowR = resolveWindow(road, spec.corner);
    if (!windowR.ok)
        return windowR;
    const w = windowR.value;
    const scale = sweepScale(w);
    const policy = spec.accept ?? "clean";
    // per-corner contexts: first corner (brake/turn-in-1 frame), last corner
    // (turn-in-2 frame); buildChainContext validates the shared spec surface
    const chainR = buildChainContext({ ...spec, corner: `${w.corners[0].id}..${w.corners[w.corners.length - 1].id}` });
    if (!chainR.ok)
        return chainR;
    const chain = chainR.value;
    const ctxFirst = chain.ctxs[0];
    const ctxLast = chain.ctxs[chain.ctxs.length - 1];
    // §4.1a on the window: approach + sweep spans and the fit-clipped decel scan
    const prevS1 = (() => {
        const firstIdx = chain.indices[0];
        const prev = road.corners[firstIdx - 1];
        return Math.max(0, prev !== undefined ? prev.s1 : 0);
    })();
    const L_app = w.s0 - prevS1;
    const brakeGap = Math.min(BRAKE_GAP_MAX_M, Math.max(BRAKE_GAP_MIN_M, BRAKE_GAP_F * L_app));
    const brakeStart = ctxFirst.stations.s_brake_start;
    const sweepLo = Math.max(prevS1, w.s0 - Math.min(SWEEP_BACK_APP_F * L_app, SWEEP_BACK_ARC_F * w.L_arc));
    const sweepHi = w.s0 + SWEEP_FWD_F * w.L_arc;
    const entryV = ctxFirst.v_entry_ms;
    const rMin = Math.min(...w.corners.map((c) => c.r_min));
    const vTarget = speedForLean(rMin, lean_frac * phiReserve(muUse(ctxFirst.skill, ctxFirst.mu)));
    const run = w.s0 - brakeGap - brakeStart;
    const dv2 = Math.max(0, entryV * entryV - vTarget * vTarget);
    if (run <= 0 || dv2 / (2 * Math.max(run, 1e-9)) > DECEL_HI) {
        return err(roadTooShort("brake_run", w.corners[0].id, dv2 / (2 * DECEL_HI), Math.max(0, run)));
    }
    const decelFit = dv2 / (2 * run);
    const decelLoEff = Math.max(DECEL_LO, decelFit);
    // grids
    const decels = [];
    for (let i = 0; i < N_DA_DECEL; i++)
        decels.push(decelLoEff + ((DECEL_HI - decelLoEff) * i) / Math.max(1, N_DA_DECEL - 1));
    const ti1s = [];
    for (let i = 0; i < DA_GRID_N; i++)
        ti1s.push(sweepLo + ((sweepHi - sweepLo) * i) / (DA_GRID_N - 1));
    const ti2Centre = scale.sAt(DA_TI2_PCT);
    const ti2Lo = ti2Centre - DA_TI2_HALF_F * w.L_arc;
    const ti2Hi = ti2Centre + DA_TI2_HALF_F * w.L_arc;
    const ti2s = [];
    for (let i = 0; i < DA_GRID_N; i++)
        ti2s.push(ti2Lo + ((ti2Hi - ti2Lo) * i) / (DA_GRID_N - 1));
    const speedNear = (m, s) => {
        let best = null;
        for (const sm of m.traj.samples) {
            if (best === null || Math.abs(sm.s - s) < Math.abs(best.s - s))
                best = sm;
        }
        return best !== null ? Math.max(best.v, v_valid_min_ms * 0.5) : entryV;
    };
    const coarse = [];
    let searchRank = 0;
    // geometric lean seed for a corner: the f=0.5 line's required lean via the
    // corridor identity κ/(1 + d·κ) (the same algebra the tracker feedforward
    // uses); the mini-ladders below refine with bounded engine probes — the
    // 04 §5.1 discipline (fixed probe budgets, deterministic, hash-stable)
    const leanSeed = (ctx, v) => {
        const c = ctx.corner;
        const kap = ctx.road.kappa_road(c.s_mid);
        const d = ctx.road.dOf(0.5, c.s_mid);
        const kLine = Math.abs(kap / (1 + d * kap));
        return (180 / Math.PI) * Math.atan((v * v * kLine) / G);
    };
    for (const decel of decels) {
        for (const ti1 of ti1s) {
            const vTi1 = decel > 0 ? predictVti(ctxFirst, ti1, decel) : entryV;
            // lean #1 mini-ladder: deepest contained first-corner touch (probed with
            // ti2 absent — the drift back out past the first corner is emergent)
            const seed1 = leanSeed(ctxFirst, vTi1);
            let lean1 = seed1;
            let bestDepth = Number.POSITIVE_INFINITY;
            for (let p = 0; p < 4; p++) {
                const cand = seed1 - 4 + 4 * p; // seed−4 … seed+8
                const probePlan = daPlan({ decel, ti1, lean1: cand, ti2: w.s1 + 1, lean2: 0, rollOn: null }, w, brakeStart, brakeGap, entryV, w.corners[0].hand)
                    .filter((a) => a.id !== "ti_da2" && a.id !== "k_da2");
                const m = measureRun(ctxFirst, probePlan, true);
                let minF = Number.POSITIVE_INFINITY;
                for (const sm of m.traj.samples) {
                    if (sm.s < w.s0 - 1e-9 || sm.s > scale.sAt(50))
                        continue;
                    if (sm.f < minF)
                        minF = sm.f;
                }
                if (minF >= 0 && minF <= DA_TOUCH_F_MAX && minF < bestDepth) {
                    bestDepth = minF;
                    lean1 = cand;
                }
            }
            // one pre-run per (decel, ti1) to read the speed arriving at each ti2
            const preRun = measureRun(ctxFirst, daPlan({ decel, ti1, lean1, ti2: w.s1 + 1, lean2: 0, rollOn: null }, w, brakeStart, brakeGap, entryV, w.corners[0].hand)
                .filter((a) => a.id !== "ti_da2" && a.id !== "k_da2"), true);
            for (const ti2 of ti2s) {
                if (ti2 <= ti1 + 2)
                    continue;
                searchRank += 1;
                const seed2 = leanSeed(ctxLast, speedNear(preRun, ti2));
                // lean #2 mini-ladder: first contained two-touch wins, else best effort
                let chosen = null;
                for (let p = 0; p < 3; p++) {
                    const lean2 = seed2 + 4 * p; // seed … seed+8
                    const shape = { decel, ti1, lean1, ti2, lean2, rollOn: null };
                    const m = measureRun(ctxFirst, daPlan(shape, w, brakeStart, brakeGap, entryV, w.corners[0].hand), true);
                    let insideCut = false;
                    let worstF = Number.NEGATIVE_INFINITY;
                    for (const sm of m.traj.samples) {
                        if (sm.s < w.s0 - 1e-9 || sm.s > w.s1 + 1e-9)
                            continue;
                        if (sm.f > worstF)
                            worstF = sm.f;
                        if (sm.f < -0.02)
                            insideCut = true;
                    }
                    const alive = m.traj.terminated.reason === "road_end" || m.traj.terminated.s > w.s1;
                    if (chosen === null)
                        chosen = { shape, m };
                    if (!insideCut && worstF <= 1 + eps_f_detect && alive) {
                        chosen = { shape, m };
                        const rep = touchesOf(windowApexes(m, w), m.traj.samples, w, scale);
                        if (rep.two_touch)
                            break;
                    }
                }
                const m = chosen.m;
                const shape = chosen.shape;
                let worstF = Number.NEGATIVE_INFINITY;
                let insideCut = false;
                for (const sm of m.traj.samples) {
                    if (sm.s < w.s0 - 1e-9 || sm.s > w.s1 + 1e-9)
                        continue;
                    if (sm.f > worstF)
                        worstF = sm.f;
                    if (sm.f < -0.02)
                        insideCut = true;
                }
                const contained = !insideCut &&
                    worstF <= 1 + eps_f_detect &&
                    (m.traj.terminated.reason === "road_end" || m.traj.terminated.s > w.s1);
                const report = touchesOf(windowApexes(m, w), m.traj.samples, w, scale);
                const inBands = report.two_touch &&
                    Math.abs(report.touches[0].pct - DA_APEX1_PCT) <= DA_APEX1_TOL &&
                    Math.abs(report.touches[1].pct - DA_APEX2_PCT) <= DA_APEX2_TOL;
                // §4.6 filter step 3: constraints (§4.5) joined as always — evaluated
                // on the coarse run's retained samples, violators discarded before rank
                const constraintRows = ctxFirst.constraints !== null ? evalConstraints(m.traj.samples, ctxFirst.constraints) : null;
                const constraintOk = constraintsSatisfied(constraintRows);
                const rank = report.two_touch
                    ? Math.max(Math.abs(report.touches[0].pct - DA_APEX1_PCT), Math.abs(report.touches[1].pct - DA_APEX2_PCT))
                    : Number.POSITIVE_INFINITY;
                coarse.push({
                    shape,
                    rank: contained && inBands && constraintOk ? rank : Number.POSITIVE_INFINITY,
                    report,
                    contained,
                    worst_f: worstF,
                    searchRank,
                    constraint_ok: constraintOk,
                    constraint_rows: constraintRows
                });
            }
        }
    }
    // rank the passing filter ascending; retain the best failing candidates.
    // D10 bounds stay hard under every accept policy (§4.5/§4.8.3): coarse
    // constraint violators are discarded before ranking here too.
    const passing = coarse.filter((c) => Number.isFinite(c.rank)).sort((a, b) => a.rank - b.rank || a.searchRank - b.searchRank);
    const bestFailingOrder = coarse.filter((c) => c.constraint_ok).sort((a, b) => {
        const cls = (c) => c.contained && c.report.two_touch ? 0 : c.contained && c.report.touches.length >= 1 ? 1 : 2;
        if (cls(a) !== cls(b))
            return cls(a) - cls(b);
        if (a.worst_f !== b.worst_f)
            return a.worst_f - b.worst_f;
        return a.searchRank - b.searchRank;
    });
    const executeShape = (shape) => {
        // fine: exit roll-on bisected against exit_target over [ti2+2, s1]
        let rollOn = null;
        {
            const lo = shape.ti2 + 2;
            const hi = Math.max(lo + 1, w.s1);
            let a = lo;
            let b = hi;
            let best = null;
            for (let i = 0; i < 8; i++) {
                const mid = (a + b) / 2;
                const m = measureRun(ctxFirst, daPlan({ ...shape, rollOn: mid }, w, brakeStart, brakeGap, entryV, w.corners[0].hand), true);
                let breach = false;
                for (const sm of m.traj.samples) {
                    if (sm.f > 1 + eps_f_detect)
                        breach = true;
                }
                const row = m.rows.find((r) => r.id === w.corners[w.corners.length - 1].id);
                const exitF = breach || m.traj.terminated.reason !== "road_end" ? Number.POSITIVE_INFINITY : row?.exit.f ?? Number.POSITIVE_INFINITY;
                if (Number.isFinite(exitF) && exitF <= exit_target) {
                    const gap = exit_target - exitF;
                    if (best === null || gap < best.gap)
                        best = { onset: mid, gap };
                }
                if (!Number.isFinite(exitF) || exitF > exit_target)
                    a = mid;
                else
                    b = mid;
                if (b - a < 0.25)
                    break;
            }
            rollOn = best !== null ? best.onset : null;
        }
        const daSpec = { ...spec, style: "double_apex", corner: `${w.corners[0].id}..${w.corners[w.corners.length - 1].id}` };
        return executeSolvedPlan({
            spec,
            wireRoad: wireRoadSpecOf(spec.road),
            plan: wirePlanFromResolved(daPlan({ ...shape, rollOn }, w, brakeStart, brakeGap, entryV, w.corners[0].hand)),
            policy,
            source: { kind: "solve", solveSpec: daSpec },
            constraints: ctxFirst.constraints,
            brake_gap_m: brakeGap,
            declared_style: "double_apex",
            label: `double apex ${spec.entry_kmh} km/h`
        });
    };
    // fine stage: top N_DA_FINE re-solved at full resolution, first acceptance wins
    let fineViolation = null;
    let disagreement = null;
    for (const cand of passing.slice(0, N_DA_FINE)) {
        const lineR = executeShape(cand.shape);
        if (!lineR.ok)
            return lineR;
        const line = lineR.value;
        if (!constraintsSatisfied(line.verdict.constraints)) {
            // §4.5: a violation at self-verify is a typed error, never a shipped line
            fineViolation = line.verdict.constraints;
            continue;
        }
        // re-evaluate the touch predicate on the RECORDED (self-verified) apex list
        const apexes = line.verdict.corners
            .filter((c) => w.corners.some((wc) => wc.id === c.id))
            .flatMap((c) => c.apexes.map((a) => ({ s: a.s, f: a.f })));
        const report = touchesOf(apexes, line.trajectory.samples, w, scale);
        if (line.verdict.outcome === "contained" && report.two_touch)
            return ok(line);
        // the coarse filter promised a contained two-touch line; the full-
        // resolution self-verified run contradicts it (§4.6 step 5)
        if (disagreement === null) {
            disagreement = { shape: cand.shape, fine_outcome: line.verdict.outcome, fine_touches: report.touches.length };
        }
    }
    // no passing candidate: best_failing returns the retained best candidate as
    // a normal self-verified LineResult with its non-clean verdict verbatim.
    // D10 bounds stay hard (§4.8.3): a retained candidate whose SELF-VERIFIED
    // run violates an authored constraint is skipped, never returned.
    if (policy === "best_failing") {
        for (const cand of bestFailingOrder.slice(0, N_DA_FINE)) {
            const lineR = executeShape(cand.shape);
            if (!lineR.ok)
                return lineR;
            const line = lineR.value;
            if (!constraintsSatisfied(line.verdict.constraints)) {
                fineViolation = line.verdict.constraints;
                continue;
            }
            return ok(line);
        }
    }
    // typed refusals, most legible first (§4.5's agent-legibility contract):
    // 1. constraints were the killer — name the bound, worst station, values
    if (fineViolation !== null) {
        return err(constraintUnmet(fineViolation, "solveDoubleApex"));
    }
    const coarseKilled = coarse.filter((c) => c.contained && c.report.two_touch && !c.constraint_ok);
    if (coarseKilled.length > 0 && passing.length === 0) {
        return err(constraintUnmet(coarseKilled[0].constraint_rows, "solveDoubleApex"));
    }
    if (ctxFirst.constraints !== null && coarse.length > 0 && coarse.every((c) => !c.constraint_ok)) {
        // §4.5/§4.8.3: EVERY candidate violates an authored bound — the refusal
        // names the bound, never blames touch geometry
        return err(constraintUnmet(coarse[0].constraint_rows, "solveDoubleApex"));
    }
    // 2. coarse/fine disagreement is a typed error (§4.6 step 5, carried discipline)
    if (disagreement !== null) {
        return err(noSolution("coarse_fine_disagreement", "solveDoubleApex", "a coarse two-touch candidate did not hold at full resolution", {
            decel: disagreement.shape.decel,
            ti1: disagreement.shape.ti1,
            ti2: disagreement.shape.ti2,
            coarse_touches: 2,
            fine_touches: disagreement.fine_touches,
            fine_outcome: disagreement.fine_outcome
        }));
    }
    // 3. the corner does not reward two touches at this entry
    const best = bestFailingOrder[0] ?? coarse[0];
    return err(noSolution("no_two_touch_line", "solveDoubleApex", "the scan exhausted with no contained two-touch candidate at this entry", {
        touch_count: best !== undefined ? best.report.touches.length : 0,
        worst_f: best !== undefined ? best.worst_f : null,
        rank: best !== undefined && Number.isFinite(best.rank) ? best.rank : null,
        window: { corner_ids: w.corners.map((c) => c.id), s0: w.s0, s1: w.s1, sweep_deg: w.sweep_deg }
    }));
}
//# sourceMappingURL=doubleApex.js.map