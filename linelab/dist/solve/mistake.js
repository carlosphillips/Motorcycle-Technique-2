// solve/mistake.ts — compileMistake (design/03 §7; ARCHITECTURE §5, WP-12):
// the mistake compiler for all 8 kinds — 6 execution (premature,
// premature_contained, slow_steer, fifty_pence, chop, overspeed) + 2
// misjudgment (underread, overread) — each compiled as EXACTLY ONE
// perturbation of the solved baseline (one contiguous replacement in one
// control channel, or one belief — never both, D23), forward-run through the
// same engine, with the outcome read off the engine's verdict (physics is the
// validator).
//
// Chained scope (design/03 §7.2, design/04 §5.1): a corner-id list applies the
// perturbation at exactly those corners; scope "all_corners" applies it at
// every corner, each corner's perturbation seeded by the emergent state of the
// mistaken line through the corner before — reference stations come from the
// good line; divergence enters through STATE, never through re-solving.
// Boundary rule (normative): compile-time probes are bounded engine shots
// (≤ N_PROBE per lean derivation); the compiler never calls a solver.
//
// The kind vocabulary, per-kind params + TUNING defaults, and the ONE
// admissible-outcome pin table are DATA in plan/mistakes.ts (single source —
// ORACLE-PIN-TABLE reads the same rows this file's defaults come from; a
// drifted duplicate is structurally impossible). This file owns only the
// compilation algorithm.
import { err, ok } from "../core/result.js";
import { RIDER_PROFILES, eps_f_detect } from "../core/constants.js";
import { EXECUTION_MISTAKE_KINDS, MISJUDGMENT_MISTAKE_KINDS, MISTAKE_KIND_DEFS, MISTAKE_KINDS, RETIRED_MISTAKE_NAME, printMistakeToken } from "../plan/mistakes.js";
import { KISS_TOL_F, N_PROBE } from "./constants.js";
import { buildSolveContext, measureRun } from "./solve.js";
import { composeSpecRoad, executeSolvedPlan, wirePlanFromResolved, wireRoadSpecOf } from "./chained.js";
import { solveMisjudgeSugar } from "./believed.js";
import { buildLineResult, sealVerdict } from "./envelope.js";
// ---------------------------------------------------------------------------
// Typed error helpers
function schemaErr(at, message, reason, detail) {
    return { code: "SCHEMA", at, message, detail: { reason, ...detail } };
}
function badRange(at, message, reason, detail) {
    return { code: "BAD_RANGE", at, message, detail: { reason, ...detail } };
}
/** Params whose values stay strings (corner-id references). */
const STRING_PARAMS = ["of"];
function coerceParams(kind, params) {
    const def = MISTAKE_KIND_DEFS[kind];
    const known = def.params.map((p) => p.name);
    const nums = {};
    const strs = {};
    for (const [name, value] of Object.entries(params ?? {})) {
        if (!known.includes(name)) {
            return err(schemaErr(`mistake.params.${name}`, `unknown param "${name}" for kind "${kind}" (known: ${known.join(", ")})`, "unknown_mistake_param", { kind, param: name }));
        }
        if (STRING_PARAMS.includes(name)) {
            strs[name] = String(value);
            continue;
        }
        const n = typeof value === "number" ? value : Number(value);
        if (!Number.isFinite(n)) {
            return err(schemaErr(`mistake.params.${name}`, `param "${name}" must be a finite number, got "${String(value)}"`, "mistake_param_malformed"));
        }
        if (n <= 0) {
            return err(badRange(`mistake.params.${name}`, `param "${name}" must be positive`, "mistake_param_nonpositive", { param: name, value: n }));
        }
        nums[name] = n;
    }
    return ok({ nums, strs });
}
/** TUNING default lookup off the pin-table data (single source). */
function defaultOf(kind, name) {
    const p = MISTAKE_KIND_DEFS[kind].params.find((d) => d.name === name);
    if (p === undefined || p.default === undefined) {
        // believed-impossible: every defaulted read below names a defaulted param
        throw new Error(`mistake.ts: no default for ${kind}.${name}`);
    }
    return p.default;
}
// ---------------------------------------------------------------------------
// Per-corner solve contexts (probe/measure harness — mirrors chained.ts's
// stripToChainSpec: the per-corner context must not re-trip solve.ts's
// routing seams, and a mistake line is never constraint-targeted)
function stripToProbeSpec(spec, cornerId) {
    const { vis: _vis, vis_hold_f: _vh, vis_margin: _vm, style: _st, believed_road: _br, mistake: _mk, turn_in: _ti, plan: _pl, constraints: _cs, accept: _ac, ...rest } = spec;
    return { ...rest, corner: cornerId };
}
function buildCornerCtx(spec, cornerId) {
    return buildSolveContext(stripToProbeSpec(spec, cornerId));
}
// ---------------------------------------------------------------------------
// Measurement helpers (local copies of the chained.ts window semantics — those
// helpers are module-private there)
/** min f over the kiss window [min(s_ti, s0), s0 + 0.9·L_arc]. */
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
/** the run is still live at station s (not terminated before it). */
function liveAt(traj, s) {
    return traj.terminated.reason === "road_end" || traj.terminated.s > s + 1e-9;
}
// ---------------------------------------------------------------------------
// The committed-lean probe (design/03 §7.1 premature; design/04 §5.1.3):
// bisect lean over (0, phiReserve] with at most N_PROBE forward engine shots
// from the perturbed turn-in; each probe holds the candidate lean through the
// corner and measures min f; the committed lean is the one with
// min f ∈ [0, KISS_TOL_F]. Monotone in lean (more lean → deeper inside), so
// bisection is sound; the lower bracket edge is the virtual lean 0 (straight
// on — min f stays at the entry fraction, no shot spent). If even phiReserve
// cannot reach the inside, commit phiReserve (the rider leans all they dare).
function probeKissLean(ctx, plan, tiIndex, s_ti) {
    const corner = ctx.corner;
    const measure = (leanDeg) => {
        const ti = {
            do: "turn_in",
            id: plan[tiIndex].id,
            at_s: s_ti,
            target: { lean_deg: leanDeg },
            hand: corner.hand
        };
        const candidate = plan.map((a, i) => (i === tiIndex ? ti : a)).sort((a, b) => a.at_s - b.at_s);
        const m = measureRun(ctx, candidate, true);
        return minFOverCorner(m, corner, s_ti);
    };
    let lo = 0; // virtual: lean 0 rides straight, min f ≈ entry fraction (> KISS_TOL_F)
    let hi = ctx.phi_reserve_deg;
    let best = null;
    let shots = 0;
    const fHi = measure(hi);
    shots += 1;
    if (fHi >= 0 && fHi <= KISS_TOL_F)
        return hi;
    if (fHi > KISS_TOL_F)
        return hi; // even full reserve cannot reach the inside
    // fHi < 0: phiReserve cuts inside — bisect down toward the kiss band
    while (shots < N_PROBE) {
        const mid = (lo + hi) / 2;
        const f = measure(mid);
        shots += 1;
        if (f >= 0 && f <= KISS_TOL_F)
            return mid;
        if (f < 0)
            hi = mid;
        else {
            lo = mid;
            if (best === null || f < best.f)
                best = { lean: mid, f };
        }
    }
    // budget exhausted: the deepest probe that stayed at-or-outside the inside
    // edge (honest commitment), else the bracket's inside edge
    return best !== null ? best.lean : hi;
}
/** whole-run containment (outcome-law proxy): road_end reached, no outward breach. */
function containedMeasure(m) {
    if (m.traj.terminated.reason !== "road_end")
        return false;
    for (const sm of m.traj.samples) {
        if (sm.f > 1 + eps_f_detect)
            return false;
    }
    return true;
}
/**
 * The EASED committed lean (premature_contained; fifty_pence's final facet):
 * the smallest lean at-or-above the kiss lean whose emergent line stays
 * CONTAINED — the early entry a rider gets away with on street reserve
 * (03 §7.1). The kiss lean alone runs the early line off the exit (that IS
 * `premature`); easing means committing a little more and accepting the deep
 * inside line. Bounded ladder: ≤ N_PROBE further coarse shots, deterministic.
 */
function probeEasedLean(ctx, plan, tiIndex, s_ti, kissLean) {
    const EASE_STEP_DEG = 2.2;
    const measure = (leanDeg) => {
        const ti = {
            do: "turn_in",
            id: plan[tiIndex].id,
            at_s: s_ti,
            target: { lean_deg: leanDeg },
            hand: ctx.corner.hand
        };
        const candidate = plan.map((a, i) => (i === tiIndex ? ti : a)).sort((a, b) => a.at_s - b.at_s);
        return containedMeasure(measureRun(ctx, candidate, true));
    };
    for (let k = 1; k <= N_PROBE; k++) {
        const lean = Math.min(kissLean + k * EASE_STEP_DEG, ctx.phi_reserve_deg);
        if (measure(lean))
            return lean;
        if (lean >= ctx.phi_reserve_deg)
            break;
    }
    // no contained ease found inside the budget: commit the kiss lean — the
    // emergent outcome then tells the truth (the oracle pin catches tune drift)
    return kissLean;
}
// ---------------------------------------------------------------------------
// turn_in attribution: the base line's turn_in EVENTS carry corner_id +
// action_id (05 §5) — the robust join between corners and plan actions.
function turnInActionIdFor(events, cornerId) {
    for (const e of events) {
        if (e.kind === "turn_in" && e.corner_id === cornerId && e.action_id !== undefined) {
            return e.action_id;
        }
    }
    return null;
}
/** last corner whose s0 ≤ s (the corrective.ts attribution rule). */
function cornerAt(corners, s) {
    let match = null;
    for (const c of corners) {
        if (c.s0 <= s + 1e-12)
            match = c;
    }
    return match;
}
// ---------------------------------------------------------------------------
// Scope resolution (design/03 §7.2: corner list | "all_corners"; default =
// the kind's target corner)
function resolveScope(scope, corners, defaultCorner) {
    if (scope === undefined)
        return ok([defaultCorner]);
    if (scope === "all_corners")
        return ok(corners);
    if (scope.length === 0) {
        return err(schemaErr("mistake.scope", "an explicit scope needs at least one corner id", "mistake_scope_empty"));
    }
    const out = [];
    for (const id of scope) {
        const c = corners.find((k) => k.id === id);
        if (c === undefined) {
            return err({
                code: "UNKNOWN_ID",
                at: "mistake.scope",
                message: `unknown corner id "${id}" in mistake scope`,
                detail: { reason: "unknown_corner_id", corner_id: id }
            });
        }
        out.push(c);
    }
    return ok(out.sort((a, b) => a.s0 - b.s0));
}
// ---------------------------------------------------------------------------
// Verdict diagnosis patch: `diagnosis` is attributed by the producing pipeline
// (05 §6.3) and EXCLUDED from result_hash (§8.3) — re-sealing after the patch
// therefore reproduces the identical hash.
function withDiagnosis(line, diagnosis) {
    if (diagnosis === null)
        return ok(line);
    const patched = { ...line.verdict, diagnosis };
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
// ---------------------------------------------------------------------------
// The execution-kind spec the perturbed plan executes under (routing fields
// stripped — the compiler never calls a solver)
function execSpecOf(spec) {
    const { vis: _vis, vis_hold_f: _vh, vis_margin: _vm, style: _st, believed_road: _br, mistake: _mk, turn_in: _ti, plan: _pl, constraints: _cs, accept: _ac, corner: _co, ...rest } = spec;
    return rest;
}
// ---------------------------------------------------------------------------
// compileMistake (design/03 §7; ARCHITECTURE §5)
export function compileMistake(kind, params, ctx) {
    // -- kind vocabulary (tombstone before unknown, D25) ------------------------
    if (kind === RETIRED_MISTAKE_NAME) {
        return err({
            code: "UNKNOWN_ID",
            at: "mistake.kind",
            message: `"${RETIRED_MISTAKE_NAME}" was renamed to "premature"`,
            detail: { reason: "renamed_kind", renamed_to: "premature" }
        });
    }
    if (!MISTAKE_KINDS.includes(kind)) {
        return err({
            code: "UNKNOWN_ID",
            at: "mistake.kind",
            message: `unknown mistake kind "${kind}" (known: ${MISTAKE_KINDS.join(", ")})`,
            detail: { reason: "unknown_mistake_kind" }
        });
    }
    const k = kind;
    // -- one control OR one belief, never both (D23) ----------------------------
    const isExecution = EXECUTION_MISTAKE_KINDS.includes(k);
    if (isExecution && ctx.spec.believed_road !== undefined) {
        return err(schemaErr("mistake", "one control or one belief, never both (D23)", "misjudge_with_execution_mistake"));
    }
    if (!isExecution && ctx.spec.mistake !== undefined) {
        return err(schemaErr("mistake", "one control or one belief, never both (D23)", "misjudge_with_execution_mistake"));
    }
    // a sugar misjudgment beside a general believed_road would be TWO beliefs
    if (!isExecution && ctx.spec.believed_road !== undefined) {
        return err(schemaErr("mistake", "a sugar misjudgment beside believed_road is two beliefs — one belief only (D23)", "misjudge_double_belief"));
    }
    // (04 §4.8's accept-on-a-mistake-line INEFFECTUAL guard lives at the
    // authoring surfaces — MistakeSpec itself has no accept field to carry the
    // dead input here; the base ride spec's accept never rides the compiled
    // line: executeSolvedPlan pins the mistake line's policy to "clean".)
    const coerced = coerceParams(k, params);
    if (!coerced.ok)
        return coerced;
    if (!isExecution) {
        return compileMisjudgment(k, coerced.value, ctx);
    }
    return compileExecution(k, coerced.value, ctx);
}
// ---------------------------------------------------------------------------
// Misjudgment kinds (design/03 §7.4) — one belief: re-solve on the believed
// road, literalize, execute on the actual (pipeline owned by believed.ts).
function compileMisjudgment(kind, params, ctx) {
    const sugar = {
        kind,
        ...(params.nums["r_believed"] !== undefined ? { r_believed: params.nums["r_believed"] } : {}),
        ...(params.nums["sweep_believed_deg"] !== undefined
            ? { sweep_believed_deg: params.nums["sweep_believed_deg"] }
            : {}),
        ...(params.strs["of"] !== undefined ? { of: params.strs["of"] } : {})
    };
    const { mistake: _mk, ...spec } = ctx.spec;
    const solved = solveMisjudgeSugar(spec, sugar);
    if (!solved.ok)
        return solved;
    const line0 = solved.value;
    const resolvedParams = {
        ...params.nums,
        ...params.strs
    };
    const label = ctx.label ??
        printMistakeToken({ kind, params: mapToStrings(resolvedParams) });
    const relabeled = relabel(line0, {
        line_id: ctx.line_id ?? kind,
        role: ctx.role ?? "mistake",
        label
    });
    const cornerId = line0.source.kind === "misjudge" && line0.source.sugar !== null
        ? line0.source.sugar.corner_id
        : null;
    return ok({
        kind,
        plan: relabeled.resolved_scenario.rider.plan,
        roadSpec: wireRoadSpecOf(ctx.spec.road),
        outcome: relabeled.verdict.outcome,
        // the misjudgment block IS the attribution for belief errors (05 §6.3)
        diagnosis: null,
        label,
        line: relabeled,
        applied_corners: cornerId !== null ? [cornerId] : []
    });
}
function mapToStrings(params) {
    return Object.fromEntries(Object.entries(params).map(([n, v]) => [n, String(v)]));
}
/** line_id/role/label are envelope labels outside every hash — rebuild only. */
function relabel(line, fields) {
    return buildLineResult({
        line_id: fields.line_id,
        role: fields.role,
        label: fields.label,
        source: line.source,
        resolved_scenario: line.resolved_scenario,
        cache: line.cache,
        trajectory: line.trajectory,
        verdict: line.verdict
    });
}
function compileExecution(kind, params, ctx) {
    const composed = composeSpecRoad(ctx.spec.road);
    if (!composed.ok)
        return composed;
    const road = composed.value;
    const basePlan = ctx.base.resolved_scenario.rider.plan;
    const events = ctx.base.trajectory.events;
    // the whole-line kinds take no per-corner scope: a scope would be
    // accepted-and-ignored, which D8 forbids
    if ((kind === "slow_steer" || kind === "overspeed") && ctx.scope !== undefined) {
        return err({
            code: "INEFFECTUAL",
            at: "mistake.scope",
            message: `a scope on "${kind}" has no per-corner surface to apply to`,
            detail: { reason: "mistake_scope_ineffectual", kind }
        });
    }
    const perturbedR = perturbPlan(kind, params, ctx, road.corners, basePlan, events);
    if (!perturbedR.ok)
        return perturbedR;
    const p = perturbedR.value;
    // resolved mistake spec — the shareable {kind, params, scope} plus the
    // applied_corners record (04 §5.1.5: a truncated chain is legible)
    const resolvedParams = { ...params.nums, ...params.strs };
    const mistakeSpec = {
        kind,
        params: resolvedParams,
        ...(ctx.scope !== undefined ? { scope: ctx.scope } : {}),
        applied_corners: p.applied
    };
    const source = {
        kind: "mistake",
        base_line_id: ctx.base.line_id,
        mistakeSpec
    };
    const label = ctx.label ??
        printMistakeToken({
            kind,
            params: mapToStrings(resolvedParams),
            ...(ctx.scope !== undefined ? { scope: ctx.scope } : {})
        });
    // brake_gap baseline for doctrine check 6: the teaching corner's derived gap
    const teachingCornerId = p.applied[0] ?? road.corners[0].id;
    const teachingCtxR = buildCornerCtx(ctx.spec, teachingCornerId);
    if (!teachingCtxR.ok)
        return teachingCtxR;
    const spec = execSpecOf(ctx.spec);
    const executed = executeSolvedPlan({
        spec: p.roll_rate_cap_dps !== undefined ? { ...spec, roll_rate_cap_dps: p.roll_rate_cap_dps } : spec,
        wireRoad: wireRoadSpecOf(ctx.spec.road),
        plan: wirePlanFromResolved(p.plan),
        policy: "clean",
        source,
        constraints: null,
        brake_gap_m: teachingCtxR.value.stations.brake_gap_m,
        ...(p.entry_kmh !== undefined ? { entry_kmh: p.entry_kmh } : {}),
        line_id: ctx.line_id ?? kind,
        role: ctx.role ?? "mistake",
        label
    });
    if (!executed.ok)
        return executed;
    const diagnosis = buildDiagnosis(p.diagnosisSeed, executed.value.trajectory);
    const lineR = withDiagnosis(executed.value, diagnosis);
    if (!lineR.ok)
        return lineR;
    const line = lineR.value;
    return ok({
        kind,
        plan: line.resolved_scenario.rider.plan,
        roadSpec: wireRoadSpecOf(ctx.spec.road),
        outcome: line.verdict.outcome,
        diagnosis,
        label,
        line,
        applied_corners: p.applied
    });
}
// ---------------------------------------------------------------------------
// The per-kind perturbation builders
function perturbPlan(kind, params, ctx, corners, basePlan, events) {
    switch (kind) {
        case "slow_steer": {
            const factor = params.nums["roll_rate_factor"] ?? defaultOf("slow_steer", "roll_rate_factor");
            const profile = RIDER_PROFILES[ctx.spec.profile ?? "street"];
            const cap = factor * profile.roll_rate_dps;
            const target = defaultTurnInCorner(ctx, corners, events);
            const at_s = target !== null ? turnInStation(basePlan, events, target.id) ?? target.s0 : 0;
            return ok({
                plan: basePlan,
                applied: target !== null ? [target.id] : [],
                roll_rate_cap_dps: cap,
                diagnosisSeed: {
                    kind: "roll_rate_limited",
                    at_s,
                    corner_id: target?.id ?? corners[0].id,
                    detail: { roll_rate_cap_dps: cap, roll_rate_factor: factor }
                }
            });
        }
        case "overspeed": {
            const by = params.nums["by_kmh"] ?? defaultOf("overspeed", "by_kmh");
            const target = defaultTurnInCorner(ctx, corners, events);
            return ok({
                plan: basePlan,
                applied: target !== null ? [target.id] : [],
                entry_kmh: ctx.spec.entry_kmh + by,
                diagnosisSeed: {
                    kind: "overspeed_entry",
                    corner_id: target?.id ?? corners[0].id,
                    detail: { by_kmh: by, entry_kmh: ctx.spec.entry_kmh + by }
                }
            });
        }
        case "chop":
            return perturbChop(params, ctx, corners, basePlan);
        case "premature":
        case "premature_contained":
        case "fifty_pence":
            return perturbTurnIn(kind, params, ctx, corners, basePlan, events);
    }
}
function turnInStation(plan, events, cornerId) {
    const actionId = turnInActionIdFor(events, cornerId);
    if (actionId === null)
        return null;
    const a = plan.find((x) => x.do === "turn_in" && x.id === actionId);
    return a !== undefined ? a.at_s : null;
}
function defaultTurnInCorner(ctx, corners, events) {
    if (ctx.spec.corner !== undefined && !ctx.spec.corner.includes("..")) {
        return corners.find((c) => c.id === ctx.spec.corner) ?? null;
    }
    for (const e of events) {
        if (e.kind === "turn_in" && e.corner_id !== undefined) {
            return corners.find((c) => c.id === e.corner_id) ?? null;
        }
    }
    return corners[0] ?? null;
}
// -- chop (design/03 §7.1): one throttle cut offset_m after the solved
// roll-on, at chop_slew_mss, with freeze_steer_s = freeze_s — during the
// freeze the rider makes no steering input; phi evolves under the stand-up
// disturbance alone (02 §5).
function perturbChop(params, ctx, corners, basePlan) {
    const offset = params.nums["offset_m"] ?? defaultOf("chop", "offset_m");
    const slew = params.nums["slew_mss"] ?? defaultOf("chop", "slew_mss");
    const freeze = params.nums["freeze_s"] ?? defaultOf("chop", "freeze_s");
    // the solved roll-on: the last drive throttle (accel > 0); a scoped corner
    // restricts to roll-ons attributed to it (03 §7.2 scope defaults to the
    // target corner)
    const scopeIds = ctx.scope === undefined ? null : ctx.scope === "all_corners" ? corners.map((c) => c.id) : ctx.scope;
    let rollOn = null;
    for (const a of basePlan) {
        if (a.do !== "throttle" || !(a.accel > 0))
            continue;
        if (scopeIds !== null) {
            const c = cornerAt(corners, a.at_s);
            if (c === null || !scopeIds.includes(c.id))
                continue;
        }
        if (rollOn === null || a.at_s > rollOn.at_s)
            rollOn = a;
    }
    if (rollOn === null) {
        return err(badRange("mistake", "chop needs a solved roll-on (a drive throttle action) to cut", "mistake_no_roll_on", {
            ...(scopeIds !== null ? { scope: scopeIds } : {})
        }));
    }
    const composed = composeSpecRoad(ctx.spec.road);
    if (!composed.ok)
        return composed;
    const roadEnd = composed.value.total_len_m;
    const cutAt = rollOn.at_s + offset;
    if (cutAt >= roadEnd) {
        return err(badRange("mistake.params.offset_m", `the cut at s=${cutAt.toFixed(1)} lies past road end (${roadEnd.toFixed(1)})`, "mistake_cut_past_road_end", { cut_at_s: cutAt, road_end_m: roadEnd }));
    }
    const cut = {
        do: "throttle",
        id: `${rollOn.id}_chop`,
        at_s: cutAt,
        accel: 0,
        slew_mss: slew,
        freeze_steer_s: freeze
    };
    const corner = cornerAt(corners, rollOn.at_s) ?? corners[0];
    return ok({
        plan: [...basePlan, cut].sort((a, b) => a.at_s - b.at_s),
        applied: [corner.id],
        diagnosisSeed: {
            kind: "stand_up",
            cut_at_s: cutAt,
            corner_id: corner.id,
            detail: { offset_m: offset, slew_mss: slew, freeze_s: freeze }
        }
    });
}
// -- the turn-in replacement family (premature / premature_contained /
// fifty_pence), incl. chained seeding (design/04 §5.1): sequential, corner by
// corner, in station order; reference stations from the good line; divergence
// enters through state (the partial mistaken plan is integrated forward to
// seed the next corner's probes); a terminated trajectory stops compilation.
function perturbTurnIn(kind, params, ctx, corners, basePlan, events) {
    const early = params.nums["early_by_m"] ?? defaultOf(kind, "early_by_m");
    const defaultCorner = defaultTurnInCorner(ctx, corners, events);
    if (defaultCorner === null) {
        return err(badRange("mistake", "the road has no corner to perturb", "mistake_no_corner"));
    }
    const scopedR = resolveScope(ctx.scope, corners, defaultCorner);
    if (!scopedR.ok)
        return scopedR;
    const scoped = scopedR.value;
    let plan = [...basePlan];
    const applied = [];
    let firstAt = null;
    let firstClamped = false;
    for (const corner of scoped) {
        const actionId = turnInActionIdFor(events, corner.id);
        if (actionId === null) {
            // a scoped corner the GOOD line never turned into has no solved turn_in
            // to replace — with an explicit scope that is a typed refusal; under
            // "all_corners" the corner simply is not applicable
            if (ctx.scope !== undefined && ctx.scope !== "all_corners") {
                return err(badRange("mistake.scope", `the base line has no turn_in for corner "${corner.id}"`, "mistake_no_turn_in_for_corner", { corner_id: corner.id }));
            }
            continue;
        }
        const tiIndex = plan.findIndex((a) => a.do === "turn_in" && a.id === actionId);
        if (tiIndex < 0)
            continue; // superseded by an earlier facet replacement
        const tiGood = plan[tiIndex];
        // The early placement clamps to the road: the pins are design pins whose
        // TUNING default params are servants (03 §7.1 rule 1) — when the solved
        // turn-in sits closer to road start than early_by_m, the perturbation
        // commits as early as the road physically allows (the honest reading of
        // "turned in too soon"), and the clamp is disclosed in the diagnosis.
        const EARLY_FLOOR_M = 0.5;
        if (tiGood.at_s <= EARLY_FLOOR_M) {
            return err(badRange("mistake.params.early_by_m", `the solved turn-in already sits at road start (s=${tiGood.at_s.toFixed(1)}) — no earlier placement exists`, "mistake_early_before_road_start", { early_by_m: early, s_ti_good: tiGood.at_s }));
        }
        const s_ti = Math.max(EARLY_FLOOR_M, tiGood.at_s - early);
        const cctxR = buildCornerCtx(ctx.spec, corner.id);
        if (!cctxR.ok)
            return cctxR;
        const cctx = cctxR.value;
        // liveness (04 §5.1.4): if the mistaken line has terminated before the
        // perturbed station, later corners are unreached and unperturbed
        const pre = measureRun(cctx, plan, true);
        if (!liveAt(pre.traj, s_ti))
            break;
        if (kind === "premature") {
            const lean = params.nums["lean_deg"] ??
                probeKissLean(cctx, plan, tiIndex, s_ti);
            plan = plan.map((a, i) => i === tiIndex
                ? { do: "turn_in", id: tiGood.id, at_s: s_ti, target: { lean_deg: lean }, hand: corner.hand }
                : a);
        }
        else if (kind === "premature_contained") {
            // target stays tangent_inside in the SPEC; the wire resolution (no plan
            // may carry the deferred token, 04 §4.2) is the solver-EASED entry: the
            // smallest committed lean above the inside-kissing one whose emergent
            // line stays contained — engine-probed consequence, never author input
            const kiss = probeKissLean(cctx, plan, tiIndex, s_ti);
            const eased = probeEasedLean(cctx, plan, tiIndex, s_ti, kiss);
            plan = plan.map((a, i) => i === tiIndex
                ? { do: "turn_in", id: tiGood.id, at_s: s_ti, target: { lean_deg: eased }, hand: corner.hand }
                : a);
        }
        else {
            // fifty_pence: an early shallow first facet + (facets − 1) corrections
            // walking up to the probed EASED lean — the rider under-turns, drifts
            // wide, and catches it in steps; still ONE steering-channel replacement;
            // facet magnitudes are engine-probed consequences of the delta, never
            // author inputs
            const facets = Math.round(params.nums["facets"] ?? defaultOf("fifty_pence", "facets"));
            if (facets < 2) {
                return err(badRange("mistake.params.facets", "facets must be ≥ 2", "mistake_param_nonpositive", { facets }));
            }
            const kiss = probeKissLean(cctx, plan, tiIndex, s_ti);
            const eased = probeEasedLean(cctx, plan, tiIndex, s_ti, kiss);
            // saw-tooth facet ladder kiss → eased: each correction RELAXES a touch
            // before the next add (fifty-pencing's bar-pressure wobble) — the dips
            // are what make each facet a distinct steering input in the commanded
            // channel (metric §A.2: a rising run ends only when cmd_lean falls)
            // saw-tooth facet ladder kiss → eased: each correction RELAXES a touch
            // before the next add (fifty-pencing's bar-pressure wobble) — the dips
            // are what make each facet a distinct steering input in the commanded
            // channel (metric §A.2: a rising run ends only when cmd_lean falls)
            const FACET_DIP_DEG = 3.0;
            const sEnd = Math.min(corner.s0 + 0.65 * (corner.s1 - corner.s0), corner.s1 - 1);
            const gap = Math.max(0.5, (sEnd - s_ti) / (facets - 1));
            const facetActions = [];
            for (let i = 0; i < facets; i++) {
                const lean = kiss + ((eased - kiss) * i) / (facets - 1);
                facetActions.push({
                    do: "turn_in",
                    id: `${tiGood.id}_f${i + 1}`,
                    at_s: s_ti + i * gap,
                    target: { lean_deg: lean },
                    hand: corner.hand
                });
                if (i < facets - 1) {
                    facetActions.push({
                        do: "turn_in",
                        id: `${tiGood.id}_f${i + 1}r`,
                        at_s: s_ti + (i + 0.5) * gap,
                        target: { lean_deg: Math.max(1, lean - FACET_DIP_DEG) },
                        hand: corner.hand
                    });
                }
            }
            plan = [...plan.filter((_, i) => i !== tiIndex), ...facetActions];
        }
        plan.sort((a, b) => a.at_s - b.at_s);
        applied.push(corner.id);
        if (firstAt === null) {
            firstAt = s_ti;
            firstClamped = s_ti > tiGood.at_s - early + 1e-9;
        }
    }
    if (applied.length === 0) {
        return err(badRange("mistake", "no scoped corner received the perturbation (the base line never turned in before terminating)", "mistake_nothing_applied"));
    }
    return ok({
        plan,
        applied,
        diagnosisSeed: {
            kind: "plan_gap",
            at_s: firstAt ?? 0,
            corner_id: applied[0],
            detail: {
                mistake_kind: kind,
                early_by_m: early,
                ...(firstClamped ? { clamped_to_road_start: true } : {}),
                ...(kind === "fifty_pence" ? { facets: Math.round(params.nums["facets"] ?? defaultOf("fifty_pence", "facets")) } : {})
            }
        }
    });
}
// ---------------------------------------------------------------------------
// Diagnosis assembly (05 §6.1/§6.3): the compiler attributes the proximate
// cause it introduced by construction; `stand_up` cites the su channel so the
// diagnosis is auditable from the trace alone (A-SU-ATTRIBUTION).
function buildDiagnosis(seed, traj) {
    switch (seed.kind) {
        case "plan_gap":
            return { cause: "plan_gap", at_s: seed.at_s, corner_id: seed.corner_id, detail: seed.detail };
        case "roll_rate_limited":
            return { cause: "roll_rate_limited", at_s: seed.at_s, corner_id: seed.corner_id, detail: seed.detail };
        case "overspeed_entry":
            return { cause: "overspeed_entry", at_s: 0, corner_id: seed.corner_id, detail: seed.detail };
        case "stand_up": {
            // the su channel evidence: the transient stand-up term the cut fired
            let max = 0;
            let at = seed.cut_at_s;
            for (const sm of traj.samples) {
                if (sm.s < seed.cut_at_s - 1e-9)
                    continue;
                if (Math.abs(sm.su_transient) > max) {
                    max = Math.abs(sm.su_transient);
                    at = sm.s;
                }
            }
            return {
                cause: "stand_up",
                at_s: at,
                corner_id: seed.corner_id,
                detail: { ...seed.detail, channel: "su_transient", su_transient_max_dps: max, cut_at_s: seed.cut_at_s }
            };
        }
    }
}
//# sourceMappingURL=mistake.js.map