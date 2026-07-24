// solve/believed.ts — believed-road solving (design/04 §4.7, D23;
// ARCHITECTURE §5, WP-11): solve the rider's plan against the BELIEVED road,
// literalize every road-derived quantity from the believed world, execute the
// frozen plan verbatim on the ACTUAL road through the unmodified engine, and
// grade normally. D7 is untouched — the author writes the geometry of a
// WORLD, never the geometry of a line; both worlds' lines are engine output.
//
// The one-perturbation law (D23): exactly one control-channel delta OR one
// belief, never both — a spec carrying both a misjudgment and an execution
// mistake rejects SCHEMA/misjudge_with_execution_mistake.
//
// `s_div` is computed EXACTLY (no epsilon, no sampling): walk both segment
// lists pairwise, accumulating length while segments are identical (type +
// all params); at the first differing pair — both arcs with equal r and hand
// but different angle_deg → boundary + arc length of the smaller sweep; both
// straights of different len → boundary + the smaller len; otherwise the
// boundary station.
//
// The believed-world run is NOT a line in the figure (one road per figure):
// its identity travels as {spec_hash, result_hash} inside the verdict's
// misjudgment block; the executed plan is byte-identical to the believed-world
// plan (the entire delta between the misjudged line and its reference is the
// world, never the inputs).
import { err, ok } from "../core/result.js";
import { canonicalize, fnv1a } from "../core/hash.js";
import { degToRad } from "../core/units.js";
import { compose, normalizeRoadSpec } from "../road/compose.js";
import { validate } from "../plan/validate.js";
import { noSolution, solve } from "./solve.js";
import { deriveStations } from "./stations.js";
import { buildWireScenario, chainedSolve, composeSpecRoad, executeSolvedPlan, patchAndReseal, wirePlanFromResolved, wireRoadSpecOf } from "./chained.js";
import { solveCautious } from "./vis.js";
// ---------------------------------------------------------------------------
// Typed error helpers
function schemaErr(at, message, reason, detail) {
    return { code: "SCHEMA", at, message, detail: { reason, ...detail } };
}
// ---------------------------------------------------------------------------
// s_div — the exact divergence walk (04 §4.7)
function segLen(seg) {
    if (seg.type === "straight")
        return seg.len_m;
    if (seg.type === "arc")
        return seg.r_m * degToRad(seg.angle_deg);
    // taper: r linear in swept angle → length = ∫ r dθ = (r1 + r2)/2 · θ
    return ((seg.r1_m + seg.r2_m) / 2) * degToRad(seg.angle_deg);
}
function sameSegment(a, b) {
    if (a.type !== b.type)
        return false;
    if (a.type === "straight" && b.type === "straight")
        return a.len_m === b.len_m;
    if (a.type === "arc" && b.type === "arc") {
        return a.r_m === b.r_m && a.angle_deg === b.angle_deg && a.hand === b.hand;
    }
    if (a.type === "taper" && b.type === "taper") {
        return a.r1_m === b.r1_m && a.r2_m === b.r2_m && a.angle_deg === b.angle_deg && a.hand === b.hand;
    }
    return false;
}
/** Walk actual vs believed segment lists; null ⇔ identical after normalization. */
export function divergenceOf(actual, believed) {
    let boundary = 0;
    const n = Math.min(actual.length, believed.length);
    for (let i = 0; i < n; i++) {
        const a = actual[i];
        const b = believed[i];
        if (sameSegment(a, b)) {
            boundary += segLen(a);
            continue;
        }
        // first differing pair
        if (a.type === "arc" && b.type === "arc" && a.hand === b.hand && a.r_m === b.r_m && a.angle_deg !== b.angle_deg) {
            const smaller = Math.min(a.angle_deg, b.angle_deg);
            return {
                s_div: boundary + a.r_m * degToRad(smaller),
                kind: "sweep",
                believed: b.angle_deg,
                actual: a.angle_deg,
                seg_index: i,
                hand_differs: false
            };
        }
        if (a.type === "straight" && b.type === "straight") {
            return {
                s_div: boundary + Math.min(a.len_m, b.len_m),
                kind: "structure",
                believed: b.len_m,
                actual: a.len_m,
                seg_index: i,
                hand_differs: false
            };
        }
        const aCurved = a.type !== "straight";
        const bCurved = b.type !== "straight";
        const handDiffers = aCurved && bCurved && a.hand !== b.hand;
        const isRadius = a.type === "arc" && b.type === "arc" && a.hand === b.hand && a.angle_deg === b.angle_deg && a.r_m !== b.r_m;
        return {
            s_div: boundary,
            kind: isRadius ? "radius" : aCurved && bCurved ? "radius" : "structure",
            believed: b.type === "arc" ? b.r_m : b.type === "taper" ? b.r1_m : null,
            actual: a.type === "arc" ? a.r_m : a.type === "taper" ? a.r1_m : null,
            seg_index: i,
            hand_differs: handDiffers
        };
    }
    if (actual.length === believed.length)
        return null; // identical after normalization
    // one list is a prefix of the other: diverges at the shared boundary
    return {
        s_div: boundary,
        kind: "structure",
        believed: null,
        actual: null,
        seg_index: n,
        hand_differs: false
    };
}
// ---------------------------------------------------------------------------
// κ-gap: max |κ_actual − κ_believed| past s_div (quantitative belief error)
function kappaGap(actual, believed, sDiv) {
    const end = Math.min(actual.total_len_m, believed.total_len_m);
    let max = 0;
    let at = sDiv;
    for (let s = sDiv; s <= end; s += 0.5) {
        const gap = Math.abs(actual.kappa_road(s) - believed.kappa_road(s));
        if (gap > max) {
            max = gap;
            at = s;
        }
    }
    return { max_abs_1pm: max, at_s: at };
}
/** Compile the sugar to Layer 1: the believed RoadSpec (disclosed verbatim). */
export function believedRoadFromSugar(actualRoad, sugar) {
    const composed = composeSpecRoad(actualRoad);
    if (!composed.ok)
        return composed;
    const road = composed.value;
    const normalized = normalizeRoadSpec(wireRoadSpecOf(actualRoad));
    if (!normalized.ok)
        return normalized;
    const spec = normalized.value;
    const cornerId = sugar.of ?? road.corners[0]?.id;
    const corner = road.corners.find((c) => c.id === cornerId);
    if (corner === undefined) {
        return err({
            code: "UNKNOWN_ID",
            at: "mistake.of",
            message: `unknown corner id "${String(cornerId)}"`,
            detail: { reason: "unknown_corner_id", corner_id: cornerId ?? null }
        });
    }
    // locate the corner's segment: the Nth curved segment (corners are minted
    // per curved segment in order, 03 §2)
    const cornerIndex = road.corners.findIndex((c) => c.id === corner.id);
    let seen = -1;
    let segIndex = -1;
    for (let i = 0; i < spec.segments.length; i++) {
        if (spec.segments[i].type !== "straight") {
            seen += 1;
            if (seen === cornerIndex) {
                segIndex = i;
                break;
            }
        }
    }
    if (segIndex < 0) {
        return err({
            code: "INTERNAL",
            at: "believedRoadFromSugar",
            message: "corner has no backing segment",
            detail: { reason: "corner_segment_missing" }
        });
    }
    const seg = spec.segments[segIndex];
    const hasR = sugar.r_believed !== undefined;
    const hasSweep = sugar.sweep_believed_deg !== undefined;
    if (hasR && hasSweep) {
        return err(schemaErr("mistake.params", "exactly one of r_believed | sweep_believed_deg (one belief, D23)", "misjudge_param_required"));
    }
    if (!hasR && !hasSweep) {
        // taper default: r_believed = r1 ("believed the entry radius holds") —
        // the zero-param canonical blind-DR misread (03 §7.4)
        if (seg.type === "taper") {
            return believedRoadFromSugar(actualRoad, { ...sugar, r_believed: seg.r1_m });
        }
        return err(schemaErr("mistake.params", "exactly one of r_believed | sweep_believed_deg is required on an arc corner", "misjudge_param_required"));
    }
    let rewritten;
    if (hasR) {
        rewritten = { type: "arc", r_m: sugar.r_believed, angle_deg: corner.angle_deg, hand: corner.hand };
    }
    else if (seg.type === "arc") {
        rewritten = { type: "arc", r_m: seg.r_m, angle_deg: sugar.sweep_believed_deg, hand: seg.hand };
    }
    else if (seg.type === "taper") {
        rewritten = { type: "taper", r1_m: seg.r1_m, r2_m: seg.r2_m, angle_deg: sugar.sweep_believed_deg, hand: seg.hand };
    }
    else {
        return err(schemaErr("mistake.of", "the named corner's segment is a straight", "misjudge_target_not_curved"));
    }
    const segments = spec.segments.map((s, i) => (i === segIndex ? rewritten : s));
    return ok({
        lane_width_m: spec.lane_width_m,
        bike_margin_m: spec.bike_margin_m,
        use_full_width: spec.use_full_width,
        segments
    });
}
/**
 * solveBelieved(spec) → Result<LineResult> (design/04 §4.7). The spec carries
 * `believed_road`; the pipeline solves it clean in the believed world,
 * literalizes, executes on the actual road, grades normally, and attaches the
 * verdict's misjudgment block.
 */
export function solveBelieved(spec, opts) {
    if (spec.believed_road === undefined) {
        return err(schemaErr("believed_road", "solveBelieved requires a believed_road", "believed_road_required"));
    }
    if (spec.mistake !== undefined) {
        return err(schemaErr("mistake", "one control or one belief, never both (D23)", "misjudge_with_execution_mistake"));
    }
    if (spec.accept === "best_failing") {
        return err(schemaErr("accept", "best_failing would relax the believed-world clean bar", "accept_policy_incompatible_with_misjudge"));
    }
    // -- normalize both worlds ---------------------------------------------------
    const actualWire = wireRoadSpecOf(spec.road);
    const believedWire = wireRoadSpecOf(spec.believed_road);
    const actualNorm = normalizeRoadSpec(actualWire);
    if (!actualNorm.ok)
        return actualNorm;
    const believedNorm = normalizeRoadSpec(believedWire);
    if (!believedNorm.ok)
        return believedNorm;
    // lane geometry must match (v1: the rider misjudges curvature, not lane width)
    if (actualNorm.value.lane_width_m !== believedNorm.value.lane_width_m ||
        actualNorm.value.bike_margin_m !== believedNorm.value.bike_margin_m ||
        actualNorm.value.use_full_width !== believedNorm.value.use_full_width) {
        return err(schemaErr("believed_road", "believed and actual lane geometry differ", "believed_lane_geometry_differs", {
            actual: { lane_width_m: actualNorm.value.lane_width_m, bike_margin_m: actualNorm.value.bike_margin_m, use_full_width: actualNorm.value.use_full_width },
            believed: { lane_width_m: believedNorm.value.lane_width_m, bike_margin_m: believedNorm.value.bike_margin_m, use_full_width: believedNorm.value.use_full_width }
        }));
    }
    const divergence = divergenceOf(actualNorm.value.segments, believedNorm.value.segments);
    if (divergence === null) {
        return err({
            code: "INEFFECTUAL",
            at: "believed_road",
            message: "the believed road is identical to the actual road — nothing is misjudged",
            detail: { reason: "believed_road_identical" }
        });
    }
    if (divergence.hand_differs) {
        return err({
            code: "OUT_OF_SCOPE",
            at: "believed_road",
            message: "the first divergent corner's hand differs between worlds (typed so the cut is explicit and liftable)",
            detail: { reason: "believed_hand_differs" }
        });
    }
    if (divergence.s_div <= 0) {
        return err(schemaErr("believed_road", "the worlds differ from the start — the plan's stations must mean the same asphalt in both worlds up to the misread", "believed_no_shared_prefix", { s_div: divergence.s_div }));
    }
    // placements must re-resolve on the believed world (fully well-formed, never
    // partially inherited): validate a plan-less believed skeleton
    {
        const skeleton = buildWireScenario({ spec: { ...spec, road: spec.believed_road }, wireRoad: believedWire }, []);
        const v = validate(skeleton);
        if (!v.ok) {
            const at = v.error.at;
            if (at.startsWith("occluders") || at.startsWith("hazards") || at.startsWith("road.preset.occluders")) {
                return err({
                    code: "BAD_RANGE",
                    at,
                    message: `a placement cannot re-resolve on the believed road (fix: absolute at_s placement): ${v.error.message}`,
                    detail: { reason: "believed_placement_unresolvable", inner: v.error.detail ?? {} }
                });
            }
            return v;
        }
    }
    // -- 1. solve in the believed world (ordinary pipeline, must be clean) -------
    const { believed_road: _br, ...rideSpec } = spec;
    const believedSpec = { ...rideSpec, road: believedWire };
    const believedComposed = compose(believedWire);
    if (!believedComposed.ok)
        return believedComposed;
    const believedR = spec.vis === "cautious"
        ? solveCautious(believedSpec)
        : believedComposed.value.corners.length > 1
            ? chainedSolve(believedSpec)
            : solve(believedSpec);
    if (!believedR.ok) {
        if (believedR.error.code === "NO_SOLUTION") {
            return err(noSolution("believed_world_not_clean", "solveBelieved", "the believed-world solve did not produce a clean line — a bad plan in a wrong world is two perturbations", { inner: believedR.error.detail ?? {}, inner_message: believedR.error.message }));
        }
        return believedR;
    }
    const believedLine = believedR.value;
    if (!believedLine.verdict.ok) {
        return err(noSolution("believed_world_not_clean", "solveBelieved", "the believed-world line does not verify clean", {
            believed_outcome: believedLine.verdict.outcome,
            believed_fails: believedLine.verdict.doctrine.fail
        }));
    }
    // -- 2. literalize -----------------------------------------------------------
    // Solver output is already literal (explicit signed leans, absolute at_s,
    // resolved over_m; tangent_inside never survives a self-verified plan) —
    // every road-derived quantity below is frozen FROM THE BELIEVED WORLD.
    const literalized = believedLine.resolved_scenario.rider.plan;
    // -- 3. execute on the actual road (unmodified engine) -----------------------
    const actualComposed = compose(actualWire);
    if (!actualComposed.ok)
        return actualComposed;
    const actualEnd = actualComposed.value.total_len_m;
    // stations the actual world does not even contain can never fire; they were
    // effectual in the believed world, which is recorded (D8's "provably reaches
    // the controller" is evaluated against the believed run). The engine wire
    // plan carries only the reachable prefix (validate() is the actual-world
    // gate); the RECORD is restored to the full believed plan below — §4.7's
    // byte-identity law is a record-level law.
    const executable = literalized.filter((a) => a.at_s <= actualEnd - 1e-9);
    const beyondEnd = literalized.filter((a) => a.at_s > actualEnd - 1e-9).map((a) => a.id);
    const source = {
        kind: "misjudge",
        solve: rideSpec,
        believed_road: typeof spec.believed_road === "string" ? spec.believed_road : believedWire,
        sugar: opts?.sugar ?? null
    };
    // §4.7 step 4 "grade normally … unmodified analyzers": the check-6 baseline
    // reads the corner-derived brake_gap exactly as an ordinary line's grading
    // does (threaded from the ACTUAL road's first corner, the same station an
    // ordinary single/chained solve threads) — never a zeroed stand-in.
    const actualStations = deriveStations(actualComposed.value, 0);
    const brakeGapM = actualStations.ok ? actualStations.value.brake_gap_m : 0;
    const lineR = executeSolvedPlan({
        spec,
        wireRoad: actualWire,
        plan: wirePlanFromResolved(executable),
        policy: "clean",
        source,
        constraints: null,
        brake_gap_m: brakeGapM,
        declared_style: spec.style ?? "single",
        ...(opts?.line_id !== undefined ? { line_id: opts.line_id } : {}),
        ...(opts?.role !== undefined ? { role: opts.role } : {}),
        label: opts?.label ?? `misjudge ${spec.entry_kmh} km/h`
    });
    if (!lineR.ok)
        return lineR;
    let line = lineR.value;
    // §4.7 one-perturbation rule: "the executed plan is byte-identical to the
    // believed-world plan". Actions past the actual road's end can never fire
    // (integration terminates at road_end at the latest), so restoring them into
    // the record changes no sample and no event — only the recorded plan (and
    // therefore result_hash's plan member) — and preserves the law when the
    // believed road is LONGER than the actual. never-fire semantics recorded in
    // actions_unreached.
    if (beyondEnd.length > 0) {
        line = {
            ...line,
            resolved_scenario: {
                ...line.resolved_scenario,
                rider: { ...line.resolved_scenario.rider, plan: literalized }
            }
        };
    }
    // -- 4. the misjudgment block (grade already happened, unmodified) -----------
    const canonBelieved = canonicalize({
        lane_width_m: believedNorm.value.lane_width_m,
        bike_margin_m: believedNorm.value.bike_margin_m,
        use_full_width: believedNorm.value.use_full_width,
        segments: believedNorm.value.segments
    });
    if (!canonBelieved.ok)
        return canonBelieved;
    const divergedCorner = actualComposed.value.corners.find((c) => c.s0 <= divergence.s_div + 1e-6 && divergence.s_div < c.s1 + 1e-6) ??
        actualComposed.value.corners.find((c) => c.s0 >= divergence.s_div - 1e-6) ??
        null;
    const reached = line.trajectory.terminated.s;
    const unreached = [
        ...executable.filter((a) => a.at_s > reached + 1e-9).map((a) => a.id),
        ...beyondEnd
    ];
    const block = {
        believed_road_hash: fnv1a(canonBelieved.value),
        s_divergence_m: divergence.s_div,
        divergence: {
            kind: divergence.kind,
            corner_id: divergedCorner !== null ? divergedCorner.id : null,
            believed: divergence.believed,
            actual: divergence.actual
        },
        kappa_gap: kappaGap(actualComposed.value, believedComposed.value, divergence.s_div),
        believed: {
            outcome: "clean",
            spec_hash: believedLine.verdict.spec_hash,
            result_hash: believedLine.verdict.result_hash
        },
        actions_unreached: unreached
    };
    return patchAndReseal(line, undefined, block);
}
// convenience: the sugar front door (WP-12's compiler and the tests share it)
export function solveMisjudgeSugar(spec, sugar) {
    const believedRoadR = believedRoadFromSugar(spec.road, sugar);
    if (!believedRoadR.ok)
        return believedRoadR;
    const road = believedRoadR.value;
    const composed = composeSpecRoad(spec.road);
    const cornerId = sugar.of ?? (composed.ok ? composed.value.corners[0]?.id ?? "c1" : "c1");
    const params = {};
    if (sugar.r_believed !== undefined)
        params["r_believed"] = sugar.r_believed;
    if (sugar.sweep_believed_deg !== undefined)
        params["sweep_believed_deg"] = sugar.sweep_believed_deg;
    return solveBelieved({ ...spec, believed_road: road }, { sugar: { kind: sugar.kind, params, corner_id: cornerId } });
}
//# sourceMappingURL=believed.js.map