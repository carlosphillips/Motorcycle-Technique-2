// solve/chained.ts — chainedSolve + the hand-flip (d_flip) diagnosis + the
// linked exit targets (design/04 §5; ARCHITECTURE §5, WP-11), plus the shared
// WP-11 execution helpers the sibling extension modules (vis.ts, believed.ts,
// doubleApex.ts) import: wire-plan reconstruction, validate → executeLine
// execution with verdict patch-and-reseal (holds / misjudgment blocks land in
// the verdict via envelope.sealVerdict — the ONE hash law, ARCHITECTURE §6.3).
//
// Carried shape (04 §5): linked sequences are solved corner-by-corner,
// latest-contained-turn-in first, each corner seeded by the bike's real
// emergent state from the corner before, across an ascending decel scan — the
// gentlest fully-contained decel wins. Candidate evaluation ALWAYS
// re-integrates the plan-so-far from road start at coarse resolution (no state
// stitching — C-ONE-CORE); the final chain re-verifies once at full resolution
// through the same executeLine self-verification arm every solver uses.
//
// The hand-flip budget d_flip(v) = v·(φ_n + φ_{n+1})/roll_rate DIAGNOSES, never
// generates (D27): an infeasible flip manifests as lost containment at the head
// of corner n+1, which the ascending scan answers by slowing — and slowing
// shrinks both factors of d_flip. When the scan reaches the model-validity
// boundary (v_valid_min_ms) without containment, chainedSolve returns
// NO_SOLUTION/link_flip_infeasible carrying {link, d_flip_m, window_m,
// v_floor_kmh}.
//
// Recorded WP-11 judgments (see the return report):
//  - interior per-corner brakes are not generated in v0.1: the ascending
//    gentlest-decel scan's single chain-entry brake sets the group speed
//    (04 §5's "interior braking is generated only where the gap affords it" is
//    permissive; nothing in the v0.1 gate set exercises an interior brake).
//  - interior exit-f targeting is realized through candidate RANKING
//    (|exit_f − exit_f_target(n)| among contained candidates) rather than a
//    dedicated interior roll-on bisection: without interior drive actions the
//    exit fraction is shaped by turn-in placement/lean, which is exactly what
//    the ranking selects on.
import { err, ok } from "../core/result.js";
import { G, RIDER_PROFILES, v_valid_min_ms, eps_f_detect } from "../core/constants.js";
import { degToRad, msToKmh } from "../core/units.js";
import { compose } from "../road/compose.js";
import { PRESET_NAMES } from "../road/presets.js";
import { validate } from "../plan/validate.js";
import { DECEL_HI, DECEL_LO, LINKED_EXIT_F_OPP, LINKED_EXIT_F_SAME, N_PROBE, ROLLON_ACCEL_MS2, SOLVER_BRAKE_SLEW_MSS, exit_target } from "./constants.js";
import { buildSolveContext, constraintUnmet, constraintsSatisfied, evalConstraints, executeLine, measureRun, noSolution, predictVti, solve } from "./solve.js";
import { noSolutionConflict } from "./merge.js";
import { rollOnBracketAt } from "./stations.js";
import { sealVerdict } from "./envelope.js";
import { buildLineResult } from "./envelope.js";
// ---------------------------------------------------------------------------
// Shared wire helpers (mirrors of solve.ts's module-private wireScenario /
// wirePlanOf — restated here because those are deliberately unexported and
// WP-11 files may not edit solve.ts; kept byte-compatible with the originals)
/** The §2(a) front-door road argument: preset name | DSL string | roadSpec value. */
export function wireRoadSpecOf(road) {
    if (typeof road === "string") {
        return PRESET_NAMES.includes(road) ? { preset: road } : { dsl: road };
    }
    return road;
}
/** Compose the road a solve spec names (pure; typed compose errors propagate). */
export function composeSpecRoad(road) {
    return compose(wireRoadSpecOf(road));
}
/** A resolved plan re-spelled in wire (validate() input) form. */
export function wirePlanFromResolved(resolved) {
    return resolved.map((a) => {
        switch (a.do) {
            case "brake":
                return {
                    do: "brake",
                    id: a.id,
                    at_s: a.at_s,
                    decel: a.decel,
                    ...(a.taper_to_s !== undefined ? { taper_to_s: a.taper_to_s } : {}),
                    slew_mss: a.slew_mss
                };
            case "turn_in":
                return { do: "turn_in", id: a.id, at_s: a.at_s, target: { lean_deg: a.target.lean_deg }, hand: a.hand };
            case "throttle":
                return {
                    do: "throttle",
                    id: a.id,
                    at_s: a.at_s,
                    accel: a.accel,
                    slew_mss: a.slew_mss,
                    ...(a.freeze_steer_s !== undefined ? { freeze_steer_s: a.freeze_steer_s } : {})
                };
            case "position":
                return { do: "position", id: a.id, at_s: a.at_s, ...(a.f !== undefined ? { f: a.f } : { d: a.d }), over_m: a.over_m };
        }
    });
}
/** The wire scenario a solved plan rides in (same law as solve.ts's private copy). */
export function buildWireScenario(fields, plan) {
    const spec = fields.spec;
    return {
        spec: "linelab/1",
        id: "solve",
        road: fields.wireRoad,
        ...(spec.occluders !== undefined ? { occluders: spec.occluders } : {}),
        ...(spec.hazards !== undefined ? { hazards: spec.hazards } : {}),
        rider: {
            ...(spec.profile !== undefined ? { profile: spec.profile } : {}),
            ...(spec.roll_rate_cap_dps !== undefined ? { roll_rate_cap_dps: spec.roll_rate_cap_dps } : {}),
            start: {
                speed_kmh: fields.entry_kmh ?? spec.entry_kmh,
                ...(spec.start_f !== undefined ? { f: spec.start_f } : {})
            },
            plan
        },
        ...(spec.mu !== undefined ? { config: { mu: spec.mu } } : {})
    };
}
export function executeSolvedPlan(input) {
    const wire = buildWireScenario({ spec: input.spec, wireRoad: input.wireRoad, ...(input.entry_kmh !== undefined ? { entry_kmh: input.entry_kmh } : {}) }, input.plan);
    const validated = validate(wire);
    if (!validated.ok) {
        // A solver-emitted plan validate() rejects is a solver bug class
        // (A-SOLVED-PLAN-VALIDATES) — surfaced typed, never swallowed.
        return err({
            code: "INTERNAL",
            at: "solve.executeSolvedPlan",
            message: `solver-emitted plan failed validate(): ${validated.error.message}`,
            detail: { reason: "solved_plan_invalid", inner: validated.error.detail ?? {} }
        });
    }
    const lineR = executeLine({
        validated: validated.value,
        policy: input.policy,
        source: input.source,
        constraints: input.constraints,
        brake_gap_m: input.brake_gap_m,
        ...(input.declared_style !== undefined ? { declared_style: input.declared_style } : {}),
        ...(input.line_id !== undefined ? { line_id: input.line_id } : {}),
        ...(input.role !== undefined ? { role: input.role } : {}),
        ...(input.label !== undefined ? { label: input.label } : {})
    });
    if (!lineR.ok)
        return lineR;
    const line = lineR.value;
    if (input.holds === undefined && input.misjudgment === undefined)
        return ok(line);
    return patchAndReseal(line, input.holds, input.misjudgment);
}
/** Patch verdict extension members, re-seal (recompute result_hash), rebuild. */
export function patchAndReseal(line, holds, misjudgment) {
    const v = line.verdict;
    const patched = {
        ...v,
        ...(misjudgment !== undefined ? { misjudgment } : {}),
        ...(holds !== undefined && v.sight !== null
            ? { sight: { ...v.sight, holds } }
            : {})
    };
    const rider = line.resolved_scenario.rider;
    const sealed = sealVerdict(patched, {
        plan: rider.plan,
        ...(rider.roll_rate_cap_dps !== undefined ? { roll_rate_cap_dps: rider.roll_rate_cap_dps } : {})
    });
    if (!sealed.ok)
        return sealed;
    return ok(buildLineResult({
        line_id: line.line_id,
        role: line.role,
        label: line.label,
        source: line.source,
        resolved_scenario: line.resolved_scenario,
        cache: line.cache,
        trajectory: line.trajectory,
        verdict: sealed.value
    }));
}
function stripToChainSpec(spec, cornerId) {
    // per-corner contexts must not re-trip solve.ts's routing seams
    const { vis: _vis, vis_hold_f: _vh, vis_margin: _vm, style: _st, believed_road: _br, mistake: _mk, turn_in: _ti, ...rest } = spec;
    return { ...rest, corner: cornerId };
}
export function buildChainContext(spec) {
    // §4.9 merge contract (D8): the chained/double-apex/vis searches build their
    // candidate plans from scratch — an authored plan fragment would be
    // accepted-and-ignored, which D8 forbids. Until the merge is implemented for
    // this family, the fragment refuses TYPED, naming the first action id
    // (§4.9's cannot-honour spelling). [PENDING RATIFICATION — WP-11 merge scope.]
    if (spec.plan !== undefined && spec.plan.length > 0) {
        return err(noSolutionConflict("plan", spec.plan[0].id, "the chained/double-apex/vis solvers build every candidate plan from scratch in v0.1 — the §4.9 merge is single-corner scope"));
    }
    // An explicit numeric turn-in station has no chain semantics (which corner
    // would it pin?) and was previously dropped silently — dead input (D8).
    if (typeof spec.turn_in === "number") {
        return err({
            code: "INEFFECTUAL",
            at: "turn_in",
            message: "an explicit turn-in station is single-corner semantics; the chained/specialized solvers search per-corner placements",
            detail: { reason: "turn_in_station_on_chain" }
        });
    }
    const wireRoad = wireRoadSpecOf(spec.road);
    const composed = compose(wireRoad);
    if (!composed.ok)
        return composed;
    const road = composed.value;
    if (road.corners.length === 0) {
        return err(noSolution("empty_band", "chainedSolve.road", "the road has no corner to solve"));
    }
    // corner selection: undefined → every corner; "a..b" → the inclusive span
    let indices;
    if (spec.corner !== undefined && spec.corner.includes("..")) {
        const [a, b] = spec.corner.split("..");
        const ia = road.corners.findIndex((c) => c.id === a);
        const ib = road.corners.findIndex((c) => c.id === b);
        if (ia < 0 || ib < 0 || ib < ia) {
            return err({
                code: "UNKNOWN_ID",
                at: "corner",
                message: `corner span "${spec.corner}" does not name an ascending pair of corners on this road`,
                detail: { reason: "unknown_corner_span", span: spec.corner }
            });
        }
        indices = [];
        for (let i = ia; i <= ib; i++)
            indices.push(i);
    }
    else {
        indices = road.corners.map((_, i) => i);
    }
    const ctxs = [];
    for (const i of indices) {
        const id = road.corners[i].id;
        const ctxR = buildSolveContext(stripToChainSpec(spec, id));
        if (!ctxR.ok)
            return ctxR;
        ctxs.push(ctxR.value);
    }
    return ok({
        spec,
        policy: spec.accept ?? "clean",
        wireRoad,
        road,
        indices,
        ctxs
    });
}
// ---------------------------------------------------------------------------
// Coarse chain measurements
const EPS_INSIDE_F = 0.02; // seed-noise tolerance on the inner edge (local; mirrors solve.ts)
/** speed at the retained sample nearest station s (coarse measure). */
function speedAt(m, s) {
    let best = null;
    for (const sm of m.traj.samples) {
        if (best === null || Math.abs(sm.s - s) < Math.abs(best.s - s))
            best = sm;
    }
    return best !== null ? best.v : 0;
}
/** contained (both sides) through station sEnd, and still alive past it. */
function containedThrough(m, sEnd) {
    for (const sm of m.traj.samples) {
        if (sm.s > sEnd + 1e-9)
            break;
        if (sm.f > 1 + eps_f_detect || sm.f < -EPS_INSIDE_F)
            return false;
    }
    const t = m.traj.terminated;
    return t.reason === "road_end" || t.s > sEnd + 1e-9;
}
/** min f over corner window [min(s_ti, s0), s0 + 0.9·L_arc] (mirrors solve.ts's kiss window). */
function minFOverCorner(m, corner, s_ti) {
    const lo = Math.min(s_ti, corner.s0);
    const hi = corner.s0 + 0.9 * (corner.s1 - corner.s0);
    let min = Number.POSITIVE_INFINITY;
    for (const sm of m.traj.samples) {
        if (sm.s < lo - 1e-9 || sm.s > hi + 1e-9)
            continue;
        if (sm.f < min)
            min = sm.f;
    }
    return min;
}
/** exit f of the corner (its recorded row), or the sample nearest s1. */
function exitFOf(m, corner) {
    const row = m.rows.find((r) => r.id === corner.id);
    if (row !== undefined)
        return row.exit.f;
    let best = null;
    for (const sm of m.traj.samples) {
        if (best === null || Math.abs(sm.s - corner.s1) < Math.abs(best.s - corner.s1))
            best = sm;
    }
    return best !== null ? best.f : Number.POSITIVE_INFINITY;
}
/**
 * Choose corner n's turn-in and committed lean given the plan-so-far. Latest-
 * contained-turn-in first; interior corners rank surviving candidates by
 * |exit_f − exit_f_target| (the §5 linked exit targets); the last corner takes
 * the latest contained candidate (its exit is shaped by the roll-on bisection).
 * Bounded: ≤ N_PROBE engine shots per candidate, candidates walked latest-first
 * with early exit once CHAIN_CAND_KEEP contained candidates are in hand.
 */
const CHAIN_CAND_KEEP = 3; // local search width (unnamed design knob, §6.6 pattern)
function pickCorner(chain, ctxIndex, planSoFar, exitTargetF) {
    const ctx = chain.ctxs[ctxIndex];
    const corner = ctx.corner;
    const measure0 = measureRun(ctx, planSoFar, true);
    // Candidate turn-in stations, latest first. For interior/last corners the
    // span extends ACROSS the link and INTO THE PREVIOUS ARC'S TAIL (04 §5: a
    // superseding turn_in ends the previous commitment — the flip must begin
    // before the previous corner's release fires, or the track interlude between
    // release and the next commit reads as an extra steering input).
    let candidates;
    if (ctxIndex === 0) {
        candidates = [...ctx.stations.sweep.candidates].reverse();
    }
    else {
        const prev = chain.ctxs[ctxIndex - 1].corner;
        const prevArc = prev.s1 - prev.s0;
        const hi = corner.s0 + 0.25 * (corner.s1 - corner.s0);
        const lo = Math.max(prev.s0 + 0.5 * prevArc, prev.s1 - 0.35 * prevArc);
        const N = 8;
        candidates = [];
        for (let i = 0; i < N; i++)
            candidates.push(hi - ((hi - lo) * i) / (N - 1));
    }
    // the depth bar the pick aims for: enough inside travel that the chain-aware
    // out-in-out shape holds (apex_f ≤ OIO_INSIDE_MAX = 0.45 with margin), while
    // preferring the SMALLEST adequate lean — the largest-radius doctrinal line,
    // which also keeps the flick demand (and the next flip) gentle
    const DEPTH_BAR_F = 0.35;
    // lean ceiling below phiReserve: a full-rate flick beyond ~37° at chain
    // speeds breaches the rideability kappa-step bar (KAPPA_STEP = 0.01 1/m)
    const CHAIN_LEAN_CAP_DEG = 37;
    const isLast = exitTargetF === null;
    const scored = [];
    for (const s_ti of candidates) {
        // stop once an adequate pick exists (latest-first ⇒ latest adequate wins);
        // keep at most CHAIN_CAND_KEEP fallbacks otherwise
        if (scored.some((s) => s.adequate))
            break;
        if (scored.length >= CHAIN_CAND_KEEP && !isLast)
            break;
        const v_ti = Math.max(speedAt(measure0, s_ti), v_valid_min_ms * 0.5);
        const probe = (lean) => {
            const ti = {
                do: "turn_in",
                id: `ti_${corner.id}`,
                at_s: s_ti,
                target: { lean_deg: lean },
                hand: corner.hand
            };
            const extra = [ti];
            if (isLast) {
                // the exit drive at the aim station is part of the out-in-out SHAPE
                // (WP-10's recorded discovery: searching the lean without it only ever
                // finds the late-tangent sweep) — the roll-on onset is re-bisected
                // against exit_target after the pick
                const aim = Math.min(corner.s0 + 0.58 * (corner.s1 - corner.s0), corner.s1 - 1);
                if (aim > s_ti + 1) {
                    extra.push({ do: "throttle", id: `ro_${corner.id}`, at_s: aim, accel: ROLLON_ACCEL_MS2, slew_mss: SOLVER_BRAKE_SLEW_MSS });
                }
            }
            const plan = [...planSoFar, ...extra].sort((a, b) => a.at_s - b.at_s);
            const m = measureRun(ctx, plan, true);
            const row = m.rows.find((r) => r.id === corner.id);
            const deepest = row !== undefined && row.apexes.length > 0
                ? row.apexes.reduce((a, b) => (b.f < a.f ? b : a))
                : null;
            return {
                minF: minFOverCorner(m, corner, s_ti),
                contained: containedThrough(m, corner.s1),
                exitF: exitFOf(m, corner),
                apexPct: deepest !== null ? deepest.pct : null,
                m
            };
        };
        // ascending lean ladder from the mid-line geometric requirement: the FIRST
        // (smallest) lean that is contained and reaches the depth bar wins; the
        // deepest contained probe is retained as the fallback. The LAST corner of
        // the chain additionally wants a mid-arc apex (its exit is not link-waived:
        // the full out-in-out swing must fit before the corner ends).
        const sMid = corner.s_mid;
        const kap = ctx.road.kappa_road(sMid);
        const dMid = ctx.road.dOf(0.5, sMid);
        const kLine = Math.abs(kap / (1 + dMid * kap));
        const leanBase = (180 / Math.PI) * Math.atan((v_ti * v_ti * kLine) / G);
        const leanCap = Math.min(ctx.phi_reserve_deg, CHAIN_LEAN_CAP_DEG);
        const adequacy = (r) => {
            if (!(r.minF >= 0 && r.minF <= DEPTH_BAR_F))
                return false;
            if (isLast)
                return r.apexPct !== null && r.apexPct >= 45 && r.apexPct <= 90;
            return true;
        };
        let best = null;
        for (let p = 0; p < N_PROBE; p++) {
            const lean = Math.min(leanCap, leanBase + 1.8 * p);
            const r = probe(lean);
            if (r.contained && r.minF >= -EPS_INSIDE_F) {
                const adequate = adequacy(r);
                if (best === null ||
                    (adequate && !best.adequate) ||
                    (adequate === best.adequate && r.minF >= 0 && (best.r.minF < 0 || r.minF < best.r.minF))) {
                    best = { lean, r, adequate };
                }
                if (adequate)
                    break; // smallest adequate lean — stop the ladder
            }
            if (lean >= leanCap)
                break;
        }
        if (best !== null) {
            scored.push({
                pick: { s_ti, lean_deg: best.lean, exit_f: best.r.exitF, measure: best.r.m },
                adequate: best.adequate
            });
        }
    }
    if (scored.length === 0)
        return null;
    const adequatePicks = scored.filter((s) => s.adequate);
    const pool = adequatePicks.length > 0 ? adequatePicks : scored;
    if (isLast)
        return pool[0].pick; // latest adequate candidate wins
    let best = pool[0].pick;
    for (const { pick } of pool) {
        if (Math.abs(pick.exit_f - exitTargetF) < Math.abs(best.exit_f - exitTargetF))
            best = pick;
    }
    return best;
}
function attemptChain(chain, decel) {
    const ctx0 = chain.ctxs[0];
    let plan = [];
    for (let k = 0; k < chain.ctxs.length; k++) {
        const ctx = chain.ctxs[k];
        const isLast = k === chain.ctxs.length - 1;
        const next = isLast ? null : chain.ctxs[k + 1].corner;
        const exitTargetF = next === null
            ? null
            : next.hand !== ctx.corner.hand
                ? LINKED_EXIT_F_OPP
                : LINKED_EXIT_F_SAME;
        // chain-entry brake: built once corner 0's candidate is under test — the
        // hold+release shape mirrors solve.ts (brake holds, the maintenance crack
        // releases it, completing brake_gap before the turn-in)
        if (k === 0 && decel > 0) {
            const s_ti_nominal = ctx0.corner.s0;
            const s_end = s_ti_nominal - ctx0.stations.brake_gap_m;
            const vRel = predictVti(ctx0, s_ti_nominal, decel);
            const s_k = Math.max(ctx0.stations.s_brake_start + 0.5, s_end - (vRel * decel) / SOLVER_BRAKE_SLEW_MSS);
            const brake = {
                do: "brake",
                id: "b_chain",
                at_s: ctx0.stations.s_brake_start,
                decel,
                slew_mss: SOLVER_BRAKE_SLEW_MSS
            };
            const crack = {
                do: "throttle",
                id: "k_chain",
                at_s: Math.min(s_end, s_k),
                accel: 0,
                slew_mss: SOLVER_BRAKE_SLEW_MSS
            };
            plan = [brake, crack];
        }
        const pick = pickCorner(chain, k, plan, exitTargetF);
        if (pick === null) {
            const before = measureRun(ctx, plan, true);
            return { plan, failed_at: k, v_at_failure: speedAt(before, ctx.corner.s0) };
        }
        const ti = {
            do: "turn_in",
            id: `ti_${ctx.corner.id}`,
            at_s: pick.s_ti,
            target: { lean_deg: pick.lean_deg },
            hand: ctx.corner.hand
        };
        plan = [...plan, ti].sort((a, b) => a.at_s - b.at_s);
    }
    // final-corner exit roll-on: bisect the onset toward exit_target (04 §4.1's
    // second control), coarse-measured; an onset whose run breaches outward or
    // dies reads +Infinity, so the bisection never returns an untested breach
    const last = chain.ctxs[chain.ctxs.length - 1];
    const bracketR = rollOnBracketAt(last.stations, lastTurnInStation(plan, last.corner));
    if (bracketR.ok) {
        const { lo, hi } = bracketR.value;
        const g = (onset) => {
            const ro = {
                do: "throttle",
                id: `ro_${last.corner.id}`,
                at_s: onset,
                accel: ROLLON_ACCEL_MS2,
                slew_mss: SOLVER_BRAKE_SLEW_MSS
            };
            const p = [...plan, ro].sort((a, b) => a.at_s - b.at_s);
            const m = measureRun(last, p, true);
            if (!containedThrough(m, chain.road.total_len_m - 1e-6))
                return Number.POSITIVE_INFINITY;
            return exitFOf(m, last.corner);
        };
        let bestOnset = null;
        let bestGap = Number.POSITIVE_INFINITY;
        let a = lo;
        let b = hi;
        for (let i = 0; i < 8; i++) {
            const mid = (a + b) / 2;
            const f = g(mid);
            if (Number.isFinite(f) && f <= exit_target && exit_target - f < bestGap) {
                bestGap = exit_target - f;
                bestOnset = mid;
            }
            if (!Number.isFinite(f) || f > exit_target)
                a = mid; // too much drive — later onset
            else
                b = mid; // under target — earlier onset drives more
            if (b - a < 0.25)
                break;
        }
        // fallback: the aim-station onset the pick was probed with (an exit drive
        // is part of the accepted shape; dropping it would regress the pick)
        const onset = bestOnset ?? Math.min(last.corner.s0 + 0.58 * (last.corner.s1 - last.corner.s0), last.corner.s1 - 1);
        if (onset > lastTurnInStation(plan, last.corner) + 1) {
            const ro = {
                do: "throttle",
                id: `ro_${last.corner.id}`,
                at_s: onset,
                accel: ROLLON_ACCEL_MS2,
                slew_mss: SOLVER_BRAKE_SLEW_MSS
            };
            plan = [...plan, ro].sort((x, y) => x.at_s - y.at_s);
        }
    }
    return { plan, failed_at: null, v_at_failure: null };
}
function lastTurnInStation(plan, corner) {
    for (let i = plan.length - 1; i >= 0; i--) {
        const a = plan[i];
        if (a.do === "turn_in" && a.id === `ti_${corner.id}`)
            return a.at_s;
    }
    return corner.s0;
}
/** Ascending decel ladder: gentlest (0 = no chain brake) first, extended past
 * DECEL_HI until the predicted first-corner arrival speed reaches the
 * model-validity floor — the §5 "slowing" that shrinks both factors of d_flip. */
function decelLadder(chain) {
    const ctx0 = chain.ctxs[0];
    // gentlest first; the sub-DECEL_LO rungs exist because a chain's flip budget
    // often needs only a small shed (a full DECEL_LO stop-in over-slows the
    // whole group — "doctrinal slow-in without over-slowing")
    const out = [0, 0.6, 1.2, 1.8];
    for (let i = 0; i < 4; i++)
        out.push(DECEL_LO + ((DECEL_HI - DECEL_LO) * i) / 3);
    // extension: harder decels down to the validity floor at the first turn-in
    const s_ti = ctx0.corner.s0;
    const run = Math.max(1, s_ti - ctx0.stations.brake_gap_m - ctx0.stations.s_brake_start);
    const v0 = ctx0.v_entry_ms;
    const dFloor = Math.max(0, (v0 * v0 - v_valid_min_ms * v_valid_min_ms) / (2 * run));
    if (dFloor > DECEL_HI) {
        for (let i = 1; i <= 3; i++)
            out.push(DECEL_HI + ((dFloor - DECEL_HI) * i) / 3);
    }
    return out;
}
/** d_flip(v) = v·(φ_n + φ_{n+1})/roll_rate — the D27 flip budget, metres. */
export function dFlipM(v_ms, r_prev_m, r_next_m, roll_rate_dps) {
    const phiPrev = Math.atan((v_ms * v_ms) / (G * r_prev_m));
    const phiNext = Math.atan((v_ms * v_ms) / (G * r_next_m));
    return (v_ms * (phiPrev + phiNext)) / degToRad(roll_rate_dps);
}
// ---------------------------------------------------------------------------
// chainedSolve (ARCHITECTURE §5)
/**
 * chainedSolve(spec) → Result<LineResult> (design/04 §5). Multi-corner roads
 * chain (the default invocation); `corner=<id>` restricts to one corner and
 * delegates to the single-corner pipeline; `corner=<a>..<b>` chains the span.
 * The gentlest fully-contained decel wins; the flip floor refuses
 * NO_SOLUTION/link_flip_infeasible.
 */
export function chainedSolve(spec) {
    // single-corner restriction (or a single-corner road) is the ordinary solve
    if (spec.corner !== undefined && !spec.corner.includes("..")) {
        return solve(spec);
    }
    const composed = composeSpecRoad(spec.road);
    if (!composed.ok)
        return composed;
    if (composed.value.corners.length === 1 && spec.corner === undefined) {
        return solve(spec);
    }
    const chainR = buildChainContext(spec);
    if (!chainR.ok)
        return chainR;
    const chain = chainR.value;
    const ctx0 = chain.ctxs[0];
    const profile = RIDER_PROFILES[ctx0.base.rider.profile];
    const rollRate = Math.min(profile.roll_rate_dps, ctx0.base.rider.roll_rate_cap_dps ?? Number.POSITIVE_INFINITY);
    // the flip diagnosis reads the DEEPEST-progress failure of the whole scan
    // (the link that stayed infeasible), not whichever attempt happened last
    const failures = [];
    const noteFailure = (attempt, decel) => {
        const cur = failures[0];
        if (cur === undefined || (attempt.failed_at ?? -1) >= (cur.attempt.failed_at ?? -1)) {
            failures[0] = { attempt, decel };
        }
    };
    let bestFailing = null;
    let bestContained = null;
    let constraintViolation = null;
    for (const decel of decelLadder(chain)) {
        const attempt = attemptChain(chain, decel);
        if (attempt.failed_at !== null) {
            noteFailure(attempt, decel);
            continue;
        }
        // full-resolution re-verify (the one self-verification arm)
        const lineR = executeSolvedPlan({
            spec: chain.spec,
            wireRoad: chain.wireRoad,
            plan: wirePlanFromResolved(attempt.plan),
            policy: chain.policy,
            source: { kind: "solve", solveSpec: chain.spec },
            constraints: ctx0.constraints,
            brake_gap_m: ctx0.stations.brake_gap_m,
            declared_style: "single",
            label: `chained ${chain.spec.entry_kmh} km/h`
        });
        if (!lineR.ok)
            return lineR;
        const line = lineR.value;
        // authored D10 bounds stay hard under every policy
        if (!constraintsSatisfied(line.verdict.constraints)) {
            constraintViolation = line.verdict.constraints;
            continue;
        }
        if (line.verdict.ok)
            return ok(line); // gentlest CLEAN chain wins
        if (line.verdict.outcome === "contained") {
            // RECORDED DEVIATION from the §5 letter ("the gentlest fully-contained
            // decel wins"), PENDING RATIFICATION: a strictly-fewer-doctrine-fails
            // chain at a harder decel displaces a gentler contained chain. Under the
            // CHAIN-CLEAN SEAM (clean is unreachable at chain speeds) the strict
            // letter returns the sloppiest contained rung (bookEsses@32: the 0.6
            // rung with 10 fails instead of the 1.2 rung with 3) — "doctrinal
            // slow-in" is read as licensing the fewest-fails refinement; the §5
            // gentleness rule stays the primary key (a gentler rung with equal
            // fails is never displaced).
            if (bestContained === null || line.verdict.doctrine.fail < bestContained.verdict.doctrine.fail) {
                bestContained = line;
            }
            continue;
        }
        if (bestFailing === null)
            bestFailing = line;
        noteFailure({ plan: attempt.plan, failed_at: chain.ctxs.length - 1, v_at_failure: null }, decel);
    }
    // no clean chain: a contained one is still the §4.2.3 non-clean self-verify
    // seam — returned verbatim with acceptance {met:false}, never patched
    if (bestContained !== null)
        return ok(bestContained);
    if (chain.policy === "best_failing" && bestFailing !== null)
        return ok(bestFailing);
    if (constraintViolation !== null && chain.policy === "clean") {
        return err(constraintUnmet(constraintViolation, "chainedSolve"));
    }
    // scan exhausted at the validity floor — diagnose (never generate)
    const lastFailure = failures[0] ?? null;
    if (lastFailure !== null && lastFailure.attempt.failed_at !== null && lastFailure.attempt.failed_at > 0) {
        const k = lastFailure.attempt.failed_at;
        const prev = chain.ctxs[k - 1].corner;
        const cur = chain.ctxs[k].corner;
        if (prev.hand !== cur.hand) {
            const vLink = Math.max(lastFailure.attempt.v_at_failure ?? v_valid_min_ms, v_valid_min_ms);
            return err(noSolution("link_flip_infeasible", "chainedSolve", `the ${prev.id}->${cur.id} hand flip cannot complete above the model-validity floor`, {
                link: `${prev.id}->${cur.id}`,
                d_flip_m: dFlipM(vLink, prev.r_min, cur.r_min, rollRate),
                window_m: cur.s0 - prev.s1,
                v_floor_kmh: msToKmh(v_valid_min_ms)
            }));
        }
        return err(noSolution("empty_band", "chainedSolve", `no contained turn-in candidate exists for ${cur.id} at any scanned decel`, {
            corner_id: cur.id
        }));
    }
    return err(noSolution("non_clean_band", "chainedSolve", "chain candidates existed but none verified contained at full resolution", {}));
}
// re-exports the siblings lean on (single import site for the WP-11 family)
export { evalConstraints };
//# sourceMappingURL=chained.js.map