// solve/solve.ts — the main solve pipeline (design/04 §4; ARCHITECTURE §5):
// feasibility probe, two sequential monotone bisections (brake decel → apex
// lean target; roll-on onset → exit lane fraction), and the MANDATORY
// self-verification — the solved plan is rebuilt as a wire scenario, passes
// validate() unchanged (A-SOLVED-PLAN-VALIDATES), and the engine's re-run
// verdict is returned VERBATIM. Physics is the validator, not the generator.
//
// The solver literalizes every turn-in to the explicit signed {lean_deg, hand}
// form — `tangent_inside` NEVER survives into a LineResult (04 §4.2). The lean
// derivation is two-stage: a geometric tangent-construction seed (the arc from
// the rider's position/heading tangent to the inside usable-edge circle),
// then a bounded engine-probe refinement into the kiss band
// (min f ∈ [0, KISS_TOL_F]) — ≤ N_PROBE forward shots, the same bounded-probe
// discipline as 04 §5.1 (fixed probe budget → deterministic, hash-stable).
//
// Scope seams (recorded WP-10 judgment): `believed_road`, `vis=cautious`,
// `style ≠ single`, corner spans, and the multi-corner chain-by-default land
// with WP-11's believed/vis/doubleApex/chained modules; those spec shapes
// refuse OUT_OF_SCOPE here (typed so the cut is explicit and liftable — the
// WP-11 entry points and WP-12's run.ts lift it by routing before this
// pipeline runs). The canonical figure-level World assembly likewise lands in
// run.ts; the assembly here is pipeline-internal (same law as WP-08's
// harness-internal copy in counterfactual.ts).
import { err, ok } from "../core/result.js";
import { RIDER_PROFILES, A_SLEW_DEFAULT, v_floor_ms, G } from "../core/constants.js";
import { degToRad, msToKmh, radToDeg, kmhToMs } from "../core/units.js";
import { muUse, phiMax, phiReserve, aWiden } from "../core/slice.js";
import { integrate } from "../core/integrate.js";
import { analyzeCorners } from "../core/analyze.js";
import { sortEvents } from "../core/events.js";
import { buildTrajectory } from "../core/record.js";
import { canonicalize, fnv1a } from "../core/hash.js";
import { compose } from "../road/compose.js";
import { PRESET_NAMES } from "../road/presets.js";
import { governingCorner, NO_CORNER_FRAME_HAND, sideSign, withMu } from "../road/corridor.js";
import { castSight } from "../sight/cast.js";
import { footprintsOf } from "../sight/footprints.js";
import { ssd } from "../sight/ssd.js";
import { analyzeSight } from "../sight/analyze.js";
import { validate } from "../plan/validate.js";
import { resolveAnchor } from "../plan/anchors.js";
import { START_F_DEFAULT } from "../plan/constants.js";
import { loadShippedRubricPack } from "../plan/doctrine/pack.js";
import { runChecks } from "../plan/doctrine/checks.js";
import { correctiveShot, runWideDetect, runWideDetectEvents } from "./corrective.js";
import { F_SAVE, eps_f_detect, eps_f_save } from "./constants.js";
import { BEST_FAILING_MIN_CANDIDATES, BISECT_ITERS, COARSE_DS_M, KISS_TOL_F, N_PROBE, ROLLON_ACCEL_MS2, SOLVER_BRAKE_SLEW_MSS, TARGET_APEX_TABLE, exit_target, lean_frac } from "./constants.js";
import { decelBracketAt, deriveStations, rollOnBracketAt, vTargetMs } from "./stations.js";
import { constraintWithoutSolver, mergeAuthoredPlan, noSolutionConflict } from "./merge.js";
import { corridorExcessM, pickBestFailing, validateAcceptPolicy } from "./accept.js";
import { assembleVerdict } from "./verdict.js";
import { buildLineResult, sealVerdict } from "./envelope.js";
import { autoSolve } from "./suggest.js";
// ---------------------------------------------------------------------------
// Typed helpers
function schemaErr(at, message, reason, detail) {
    return { code: "SCHEMA", at, message, detail: { reason, ...detail } };
}
function outOfScope(at, message, reason) {
    return { code: "OUT_OF_SCOPE", at, message, detail: { reason } };
}
export function noSolution(sub_reason, at, message, detail) {
    return { code: "NO_SOLUTION", at, message, detail: { sub_reason, ...detail } };
}
// ---------------------------------------------------------------------------
// Constraint resolution (design/04 §4.5 — resolved to absolute stations at
// validation; span outside the road → BAD_RANGE; the bound vocabulary is
// closed).
const CONSTRAINT_BOUNDS = ["f_min", "f_max", "v_max_kmh", "sight_margin_min_m"];
function resolveSpanAnchor(token, corners, at) {
    if (token.startsWith("s:")) {
        const n = Number(token.slice(2));
        if (!Number.isFinite(n))
            return err(schemaErr(at, `malformed station token "${token}"`, "anchor_malformed"));
        return ok(n);
    }
    return resolveAnchor({ ref: token }, corners, at);
}
export function resolveConstraints(constraints, corners, roadEnd) {
    if (constraints === undefined || constraints.length === 0)
        return ok(null);
    const out = [];
    const seen = new Set();
    for (let i = 0; i < constraints.length; i++) {
        const c = constraints[i];
        const at = `constraints[${i}]`;
        if (typeof c.id !== "string" || c.id.length === 0) {
            return err(schemaErr(`${at}.id`, "constraint needs a string id", "constraint_id_missing"));
        }
        if (seen.has(c.id)) {
            return err({ code: "DUP_ID", at: `${at}.id`, message: `duplicate constraint id "${c.id}"`, detail: { reason: "duplicate_constraint_id", id: c.id } });
        }
        seen.add(c.id);
        if (!CONSTRAINT_BOUNDS.includes(c.bound)) {
            return err(schemaErr(`${at}.bound`, `bound must be one of ${CONSTRAINT_BOUNDS.join("|")} (the bound vocabulary is closed)`, "constraint_bound_unknown", { bound: String(c.bound) }));
        }
        if (typeof c.value !== "number" || !Number.isFinite(c.value)) {
            return err(schemaErr(`${at}.value`, "constraint value must be a finite number", "constraint_value_malformed"));
        }
        let s0;
        let s1;
        if ("at" in c.span) {
            const s = resolveSpanAnchor(c.span.at, corners, `${at}.span.at`);
            if (!s.ok)
                return s;
            s0 = s.value;
            s1 = s.value;
        }
        else {
            const a = resolveSpanAnchor(c.span.from, corners, `${at}.span.from`);
            if (!a.ok)
                return a;
            const b = resolveSpanAnchor(c.span.to, corners, `${at}.span.to`);
            if (!b.ok)
                return b;
            s0 = a.value;
            s1 = b.value;
        }
        if (s1 < s0 || s0 < 0 || s1 > roadEnd + 1e-9) {
            return err({
                code: "BAD_RANGE",
                at: `${at}.span`,
                message: `constraint span [${s0.toFixed(2)}, ${s1.toFixed(2)}] must lie within the road [0, ${roadEnd.toFixed(2)}]`,
                detail: { reason: "constraint_span_outside_road", s0, s1, road_end: roadEnd }
            });
        }
        out.push({ id: c.id, bound: c.bound, value: c.value, s0, s1 });
    }
    return ok(out);
}
/** Per-bound evaluation over the retained samples of the span (05 §6.3 rows). */
export function evalConstraints(samples, constraints) {
    return constraints.map((rc) => {
        const span = samples.filter((s) => s.s >= rc.s0 - 1e-9 && s.s <= rc.s1 + 1e-9);
        if (span.length === 0) {
            // the line never rode the span (early termination): vacuously satisfied,
            // margin 0 at the span start (recorded judgment — never NaN, hash-safe)
            return { id: rc.id, bound: rc.bound, value: rc.value, satisfied: true, worst: { s: rc.s0, value: 0, margin: 0 } };
        }
        let worst = span[0];
        let observe;
        let margin;
        switch (rc.bound) {
            case "f_min":
                observe = (s) => s.f;
                margin = (obs) => obs - rc.value;
                break;
            case "f_max":
                observe = (s) => s.f;
                margin = (obs) => rc.value - obs;
                break;
            case "v_max_kmh":
                observe = (s) => msToKmh(s.v);
                margin = (obs) => rc.value - obs;
                break;
            case "sight_margin_min_m":
                observe = (s) => s.sight_ride_m - s.ssd_m;
                margin = (obs) => obs - rc.value;
                break;
        }
        for (const s of span) {
            if (margin(observe(s)) < margin(observe(worst)))
                worst = s;
        }
        const obs = observe(worst);
        const m = margin(obs);
        return {
            id: rc.id,
            bound: rc.bound,
            value: rc.value,
            satisfied: m >= -1e-9,
            worst: { s: worst.s, value: obs, margin: m }
        };
    });
}
export function constraintsSatisfied(rows) {
    return rows === null || rows.every((r) => r.satisfied);
}
/** NO_SOLUTION/constraint_unmet naming the id, worst station, achieved vs required. */
export function constraintUnmet(rows, at) {
    const worst = rows.filter((r) => !r.satisfied).sort((a, b) => a.worst.margin - b.worst.margin)[0];
    return noSolution("constraint_unmet", at, `constraint "${worst.id}" unmet: ${worst.bound} ${worst.value} vs ${worst.worst.value.toFixed(3)} at s=${worst.worst.s.toFixed(2)}`, {
        constraint_id: worst.id,
        bound: worst.bound,
        required: worst.value,
        achieved: worst.worst.value,
        worst_s: worst.worst.s
    });
}
// ---------------------------------------------------------------------------
// World assembly (pipeline-internal; canonical figure-level home is WP-12's
// run.ts — same law as the harness-internal copy in counterfactual.ts:
// corridor.withMu folds config.mu + hazard μ-bands, the sight caster composes
// sight/'s pure pieces, and ssd reads the EFFECTIVE profile — cap pre-min'ed).
function hazardBandMu(road, scenario) {
    const base = scenario.config.mu;
    const hazards = scenario.hazards;
    if (hazards.length === 0)
        return () => base;
    return (s, d) => {
        for (const h of hazards) {
            const s0 = h.at.at_s;
            if (s < s0 || s >= s0 + h.span_m)
                continue;
            const w = h.width_m;
            let lo;
            let hi;
            if (h.side === "center") {
                const c = road.dOf(0.5, s);
                lo = c - w / 2;
                hi = c + w / 2;
            }
            else {
                const hand = governingCorner(road.corners, s)?.hand ?? NO_CORNER_FRAME_HAND;
                const sigma = sideSign(h.side, hand);
                const d0 = road.dOf(0, s);
                const d1 = road.dOf(1, s);
                const edge = sigma > 0 ? Math.max(d0, d1) : Math.min(d0, d1);
                lo = Math.min(edge, edge - sigma * w);
                hi = Math.max(edge, edge - sigma * w);
            }
            if (d >= lo && d <= hi)
                return h.mu;
        }
        return base;
    };
}
function effectiveProfile(scenario) {
    const base = RIDER_PROFILES[scenario.rider.profile];
    const cap = scenario.rider.roll_rate_cap_dps;
    if (cap === undefined || cap >= base.roll_rate_dps)
        return base;
    return { ...base, roll_rate_dps: cap };
}
function assembleWorld(scenario) {
    const rs = scenario.road;
    const spec = {
        lane_width_m: rs.lane_width_m,
        bike_margin_m: rs.bike_margin_m,
        use_full_width: rs.use_full_width,
        segments: rs.segments
    };
    const composed = compose(spec);
    if (!composed.ok)
        return composed;
    const road = withMu(composed.value, hazardBandMu(composed.value, scenario));
    const profile = effectiveProfile(scenario);
    const footprints = footprintsOf(road, scenario.occluders);
    const sight = {
        cast: (eye) => castSight(road, eye, footprints),
        ssd: (v_ms, phi_rad, mu) => ssd(v_ms, phi_rad, scenario.config.ssd_model, profile, mu)
    };
    return ok({
        road,
        world: { road, sight, occluders: scenario.occluders, hazards: scenario.hazards },
        profile
    });
}
function wireRoadOf(road) {
    if (typeof road === "string") {
        return PRESET_NAMES.includes(road) ? { preset: road } : { dsl: road };
    }
    return road;
}
function wireScenario(ctx, plan) {
    const spec = ctx.spec;
    return {
        spec: "linelab/1",
        id: "solve",
        road: ctx.wireRoad,
        ...(spec.occluders !== undefined ? { occluders: spec.occluders } : {}),
        ...(spec.hazards !== undefined ? { hazards: spec.hazards } : {}),
        rider: {
            ...(spec.profile !== undefined ? { profile: spec.profile } : {}),
            ...(spec.roll_rate_cap_dps !== undefined ? { roll_rate_cap_dps: spec.roll_rate_cap_dps } : {}),
            start: { speed_kmh: spec.entry_kmh, ...(spec.start_f !== undefined ? { f: spec.start_f } : {}) },
            plan
        },
        ...(spec.mu !== undefined ? { config: { mu: spec.mu } } : {})
    };
}
export function buildSolveContext(specIn) {
    const spec = specIn;
    // -- scope seams (typed, liftable — see file header) ------------------------
    if (spec.believed_road !== undefined) {
        return err(outOfScope("believed_road", "believed-road solving routes through the misjudge pipeline (WP-11 believed.ts)", "believed_road_routes_to_misjudge_pipeline"));
    }
    if (spec.style !== undefined && spec.style !== "single") {
        return err(outOfScope("style", `style=${spec.style} routes to its specialized solver (WP-11)`, "style_routes_to_specialized_solver"));
    }
    if (spec.vis === "cautious") {
        return err(outOfScope("vis", "vis=cautious routes through the visibility-governed mode (WP-11 vis.ts)", "vis_routes_to_visibility_mode"));
    }
    if (spec.mistake !== undefined) {
        return err(outOfScope("mistake", "mistake compilation routes through compileMistake (WP-12)", "mistake_routes_to_compiler"));
    }
    // vis knobs without the mode are dead input (design/04 §6 — INEFFECTUAL);
    // vis=cautious already routed above, so any knob here rides vis=none
    if (spec.vis_hold_f !== undefined || spec.vis_margin !== undefined) {
        return err({
            code: "INEFFECTUAL",
            at: spec.vis_hold_f !== undefined ? "vis_hold_f" : "vis_margin",
            message: "vis knobs are accepted only with vis=cautious",
            detail: { reason: "vis_knob_without_vis_mode" }
        });
    }
    const acceptErr = validateAcceptPolicy(spec.accept, "accept");
    if (acceptErr !== null)
        return err(acceptErr);
    const policy = spec.accept ?? "clean";
    if (typeof spec.entry_kmh !== "number" || !(spec.entry_kmh > 0)) {
        return err({ code: "BAD_RANGE", at: "entry_kmh", message: "entry_kmh must be a positive number", detail: { reason: "entry_speed_nonpositive" } });
    }
    if (spec.turn_in !== undefined && spec.turn_in !== "auto" && typeof spec.turn_in !== "number") {
        return err(schemaErr("turn_in", 'turn_in must be "auto" or a station in metres', "turn_in_malformed"));
    }
    const directivesR = mergeAuthoredPlan(spec.plan, "plan");
    if (!directivesR.ok)
        return directivesR;
    const directives = directivesR.value;
    if (directives.nothing_to_search && (spec.constraints?.length ?? 0) > 0) {
        return err(constraintWithoutSolver("constraints"));
    }
    const wireRoad = wireRoadOf(spec.road);
    const baseR = validate(wireScenario({ wireRoad, spec }, []));
    if (!baseR.ok)
        return baseR;
    const base = baseR.value; // empty plan: structurally resolved
    const assembled = assembleWorld(base);
    if (!assembled.ok)
        return assembled;
    const { road, world, profile } = assembled.value;
    // -- corner selection -------------------------------------------------------
    if (road.corners.length === 0) {
        return err(noSolution("empty_band", "road", "the road has no corner to solve", { note: "corner-less road" }));
    }
    let cornerIndex;
    if (spec.corner !== undefined) {
        if (spec.corner.includes("..")) {
            return err(outOfScope("corner", "corner spans route to solveDoubleApex/chainedSolve (WP-11)", "corner_span_routes_to_specialized_solver"));
        }
        cornerIndex = road.corners.findIndex((c) => c.id === spec.corner);
        if (cornerIndex < 0) {
            return err({ code: "UNKNOWN_ID", at: "corner", message: `unknown corner id "${spec.corner}"`, detail: { reason: "unknown_corner_id", corner_id: spec.corner } });
        }
    }
    else if (road.corners.length === 1) {
        cornerIndex = 0;
    }
    else {
        return err(outOfScope("corner", "multi-corner roads chain by default — chainedSolve (WP-11) owns the chain; pass corner=<id> to restrict", "multi_corner_chains_by_default"));
    }
    const stationsR = deriveStations(road, cornerIndex);
    if (!stationsR.ok)
        return stationsR;
    const stations = stationsR.value;
    const corner = stations.corner;
    const constraintsR = resolveConstraints(spec.constraints, road.corners, road.total_len_m);
    if (!constraintsR.ok)
        return constraintsR;
    const constraints = constraintsR.value;
    // §4.5: a bisection target conflicting with a bound is clipped to it —
    // the named case: an f bound whose span contains the corner's exit boundary
    // clips exit_target toward the bound.
    let exitTargetEff = exit_target;
    if (constraints !== null) {
        for (const rc of constraints) {
            if (rc.s0 - 1e-9 <= corner.s1 && corner.s1 <= rc.s1 + 1e-9) {
                if (rc.bound === "f_max")
                    exitTargetEff = Math.min(exitTargetEff, rc.value);
                if (rc.bound === "f_min")
                    exitTargetEff = Math.max(exitTargetEff, rc.value);
            }
        }
    }
    const mu = base.config.mu;
    const skill = profile.skill;
    const muU = muUse(skill, mu);
    return ok({
        spec,
        policy,
        wireRoad,
        base,
        road,
        world,
        profile,
        corner,
        cornerIndex,
        stations,
        directives,
        constraints,
        v_entry_ms: kmhToMs(spec.entry_kmh),
        start_f: spec.start_f ?? START_F_DEFAULT,
        mu,
        skill,
        roll_rate_rad: degToRad(profile.roll_rate_dps),
        lean_target_deg: radToDeg(lean_frac * phiReserve(muU)),
        phi_reserve_deg: radToDeg(phiReserve(muU)),
        exit_target_eff: exitTargetEff
    });
}
export function measureRun(ctx, plan, coarse) {
    const scenario = { ...ctx.base, rider: { ...ctx.base.rider, plan } };
    const traj0 = integrate(scenario, ctx.world, coarse ? { ds_m: COARSE_DS_M } : {});
    const traj1 = analyzeSight(traj0, ctx.road, scenario.occluders);
    const analysis = analyzeCorners(traj1, ctx.road, ctx.skill);
    const events = sortEvents([...traj1.events, ...analysis.events]);
    return {
        traj: buildTrajectory([...traj1.samples], events, traj1.terminated),
        rows: analysis.corners,
        scenario
    };
}
/**
 * min f over the kiss window [min(s_ti, s0), s0 + 0.9·L_arc]. The last 10 % of
 * the arc is excluded: the exit unwind grazes low f there on degenerate
 * end-sweeping lines, and a "kiss" at the corner end is not an apex (the §3
 * plausible band would reject it anyway — excluding it keeps the lean
 * bisection aimed at a genuine mid-corner kiss).
 */
function minFOver(m, ctx, s_ti) {
    const lo = Math.min(s_ti, ctx.corner.s0);
    const hi = ctx.corner.s0 + 0.9 * (ctx.corner.s1 - ctx.corner.s0);
    let min = Number.POSITIVE_INFINITY;
    for (const s of m.traj.samples) {
        if (s.s < lo - 1e-9 || s.s > hi + 1e-9)
            continue;
        if (s.f < min)
            min = s.f;
    }
    return min;
}
/** Station of the min-f sample within the capped kiss window (null if empty). */
function minFStation(m, ctx, s_ti) {
    const lo = Math.min(s_ti, ctx.corner.s0);
    const hi = ctx.corner.s0 + 0.9 * (ctx.corner.s1 - ctx.corner.s0);
    let best = null;
    let bestF = Number.POSITIVE_INFINITY;
    for (const s of m.traj.samples) {
        if (s.s < lo - 1e-9 || s.s > hi + 1e-9)
            continue;
        if (s.f < bestF) {
            bestF = s.f;
            best = s.s;
        }
    }
    return best;
}
/** The deepest recorded apex of the solved corner (null when none). */
function deepestApex(m, cornerId) {
    const row = m.rows.find((r) => r.id === cornerId);
    if (row === undefined || row.apexes.length === 0)
        return null;
    let best = row.apexes[0];
    for (const a of row.apexes)
        if (a.f < best.f)
            best = a;
    return { s: best.s, pct: best.pct, f: best.f, lean_deg: best.lean_deg };
}
/**
 * The decel bisection's emergent measure: the corner's peak |lean| (for a
 * healthy kiss line this IS the apex lean — commit lean held through the
 * apex). Reading the lean at the min-f SAMPLE instead is corrupted by
 * corner-end artifact minima where the bike is already unwinding.
 */
function apexLeanDeg(m, ctx) {
    const row = m.rows.find((r) => r.id === ctx.corner.id);
    return row !== undefined ? row.lean_max_deg : 0;
}
/**
 * The roll-on bisection's exit measure. A run that leaves the corridor
 * OUTWARD (or terminates off the road) reads +Infinity — the too-much-drive
 * failure mode IS the outward blowup, and the heading-capture fallback of a
 * blown run would otherwise report a spuriously LOW exit f and invert the
 * bisection's monotonicity.
 */
function exitF(m, ctx) {
    if (m.traj.terminated.reason === "off_road" || m.traj.terminated.reason === "crash") {
        return Number.POSITIVE_INFINITY;
    }
    for (const s of m.traj.samples) {
        if (s.f > 1 + eps_f_detect)
            return Number.POSITIVE_INFINITY;
    }
    const row = m.rows.find((r) => r.id === ctx.corner.id);
    return row !== undefined ? row.exit.f : Number.POSITIVE_INFINITY;
}
/** Coarse containment: reached road end inside the corridor (no inside cut, no run-off). */
const EPS_INSIDE_CUT_F = 0.02; // seed-noise tolerance on the inner edge (local, §6.6)
export function containedRun(m) {
    if (m.traj.terminated.reason !== "road_end")
        return false;
    for (const s of m.traj.samples) {
        if (s.f > 1 + eps_f_detect || s.f < -EPS_INSIDE_CUT_F)
            return false;
    }
    return true;
}
/**
 * The search-time OUTCOME-class proxy the self-verify comparison uses (§4.8.2):
 * outward-only — the physics outcome law has no inside-dip arm (a kiss that
 * grazes a centimetre inside the usable edge is doctrine territory, not an
 * outcome change), so the comparison must not read stricter than the verdict.
 */
export function outwardCleanRun(m) {
    if (m.traj.terminated.reason !== "road_end")
        return false;
    for (const s of m.traj.samples) {
        if (s.f > 1 + eps_f_detect)
            return false;
    }
    return true;
}
// ---------------------------------------------------------------------------
// Lean derivation: geometric tangent seed + kiss-band refinement
/** Unit normal from heading toward the turn centre (y-down frame, core/units law). */
function insideNormal(psi, hand) {
    return hand === "L" ? { x: Math.sin(psi), y: -Math.cos(psi) } : { x: -Math.sin(psi), y: Math.cos(psi) };
}
/**
 * The brake-release station: the maintenance crack (throttle 0) supersedes the
 * held brake here, and the slew-governed ramp back to zero COMPLETES ≈
 * brake_gap before the turn-in ("brake tapering to complete brake_gap before
 * turn-in", 04 §4.2). Release ramp length ≈ v·decel/slew; two fixed-point
 * passes settle v at the release (deterministic).
 *
 * The hold+release shape is load-bearing (recorded WP-10 judgment, PENDING
 * RATIFICATION): the frozen 02 §3 taper law declines from ONSET, so a single
 * `taper_to_s` brake sheds only ≈ decel·span — HALF the Δv² that 04 §4.1a's
 * own constant-decel `decel_min_fit` arithmetic and 02 §8's "braking to a
 * solved entry speed near 50 km/h" C30 pin both assume. Under a from-onset
 * taper, C30@70 cannot reach its apex-lean target inside the carried
 * [2.4, 3.8] bracket at all.
 */
function releaseStation(ctx, s_ti, decel) {
    const s_end = s_ti - ctx.stations.brake_gap_m;
    const v0 = ctx.v_entry_ms;
    let vRel = v0;
    let s_k = s_end;
    for (let i = 0; i < 2; i++) {
        s_k = s_end - (vRel * decel) / SOLVER_BRAKE_SLEW_MSS;
        const hold = Math.max(0, s_k - ctx.stations.s_brake_start);
        vRel = Math.sqrt(Math.max(v_floor_ms * v_floor_ms, v0 * v0 - 2 * decel * hold));
    }
    return Math.min(s_end, Math.max(ctx.stations.s_brake_start + 0.5, s_k));
}
/**
 * Predicted speed at the turn-in under the hold+release brake profile (seed
 * only — the decel bisection measures the emergent truth). Rectangle over the
 * hold span, minus the slew ramp-in deficit (≈ v₀·decel²/(2·slew) — the real
 * WP-04 slew-chase under-braking effect), plus the release triangle.
 */
export function predictVti(ctx, s_ti, decel) {
    const s_end = s_ti - ctx.stations.brake_gap_m;
    const s_k = releaseStation(ctx, s_ti, decel);
    const hold = Math.max(0, s_k - ctx.stations.s_brake_start);
    const rampDeficit = (ctx.v_entry_ms * decel * decel) / SOLVER_BRAKE_SLEW_MSS;
    const releaseShed = decel * Math.max(0, s_end - s_k);
    const shed = Math.max(0, 2 * decel * hold - rampDeficit + releaseShed);
    const v2 = ctx.v_entry_ms * ctx.v_entry_ms - shed;
    return Math.sqrt(Math.max(v_floor_ms * v_floor_ms, v2));
}
const MIN_LEAN_DEG = 2;
/** The type-aware aim station: target_apex_pct of the arc (§3's target table). */
function aimStation(ctx) {
    const c = ctx.corner;
    return c.s0 + (TARGET_APEX_TABLE[c.type].target / 100) * (c.s1 - c.s0);
}
/**
 * The geometric tangent-inside construction (the lean seed the kiss probes
 * refine): integrate the roll-in RAMP kinematically (constant v, φ(t) = ρ·t —
 * the transient both delays the arc and drifts the bike outward, and at road
 * speed the accumulated heading debt is what decides containment), then solve
 * the circle through the post-ramp state tangent to its heading and internally
 * tangent to the inside usable-edge circle around the corner's local centre at
 * the type-aware aim station. Fixed-point over the lean (the ramp length
 * depends on it) — fixed iteration/step counts, deterministic.
 */
export function tangentLeanDeg(ctx, s_ti, v_ti) {
    const road = ctx.road;
    const corner = ctx.corner;
    const aimFrac = TARGET_APEX_TABLE[corner.type].target / 100;
    const s_aim = corner.s0 + aimFrac * (corner.s1 - corner.s0);
    const kappaAim = Math.abs(road.kappa_road(s_aim));
    if (!(kappaAim > 0))
        return { lean_deg: MIN_LEAN_DEG, capped: false };
    const rAim = 1 / kappaAim;
    const psiAim = road.psi_road(s_aim);
    const cAim = road.worldAt(s_aim, 0);
    const nAim = insideNormal(psiAim, corner.hand);
    const O = { x: cAim.x + rAim * nAim.x, y: cAim.y + rAim * nAim.y };
    const E = road.worldAt(s_aim, road.dOf(0, s_aim));
    const r_i = Math.hypot(O.x - E.x, O.y - E.y);
    const sign = corner.hand === "R" ? 1 : -1; // +kappa = right-hand turn (§6.1)
    const P0 = road.worldAt(s_ti, road.dOf(ctx.start_f, s_ti));
    const h0 = road.psi_road(s_ti);
    // clearance(L): shoot the roll ramp at lean L (constant v), then the
    // constant-lean circle, SAMPLED along the ridden path bounded by the
    // corner's remaining length; signed closest approach to the inside
    // usable-edge circle (0 = kiss, > 0 = falls short, < 0 = cuts inside).
    // Sampling (rather than circle-tangency algebra) keeps the tangency point
    // inside the actually-ridden sector. Monotone decreasing in L → bisection.
    const E_out = road.worldAt(s_aim, road.dOf(1, s_aim));
    const r_o = Math.hypot(O.x - E_out.x, O.y - E_out.y);
    const RAMP_STEPS = 16;
    const SHOT_DS = 1.0;
    const shotLen = Math.max(5, corner.s1 - s_ti + 5);
    const clearance = (leanDeg) => {
        let x = P0.x;
        let y = P0.y;
        let psi = h0;
        const t_ramp = degToRad(leanDeg) / ctx.roll_rate_rad;
        const dt = t_ramp / RAMP_STEPS;
        let min = Number.POSITIVE_INFINITY;
        for (let k = 0; k < RAMP_STEPS; k++) {
            const phi = ctx.roll_rate_rad * (k + 0.5) * dt;
            psi += ((sign * (G * Math.tan(phi))) / v_ti) * dt;
            x += v_ti * Math.cos(psi) * dt;
            y += v_ti * Math.sin(psi) * dt;
            const c = Math.hypot(x - O.x, y - O.y) - r_i;
            if (c < min)
                min = c;
        }
        const kappaBike = (G * Math.tan(degToRad(leanDeg))) / (v_ti * v_ti);
        const steps = Math.ceil((shotLen - v_ti * t_ramp) / SHOT_DS);
        for (let k = 0; k < steps; k++) {
            psi += sign * kappaBike * SHOT_DS;
            x += SHOT_DS * Math.cos(psi);
            y += SHOT_DS * Math.sin(psi);
            const dist = Math.hypot(x - O.x, y - O.y);
            const c = dist - r_i;
            if (c < min)
                min = c;
            if (dist > r_o + 3)
                break; // blown out of the corridor — no later kiss counts
        }
        return min;
    };
    const cHi = clearance(ctx.phi_reserve_deg);
    if (cHi > 0)
        return { lean_deg: ctx.phi_reserve_deg, capped: true };
    let lo = MIN_LEAN_DEG;
    let hi = ctx.phi_reserve_deg;
    if (clearance(lo) <= 0)
        return { lean_deg: MIN_LEAN_DEG, capped: false };
    for (let i = 0; i < 24 && hi - lo > 0.01; i++) {
        const mid = (lo + hi) / 2;
        const c = clearance(mid);
        if (Math.abs(c) < 0.005)
            return { lean_deg: mid, capped: false };
        if (c > 0)
            lo = mid;
        else
            hi = mid;
    }
    return { lean_deg: (lo + hi) / 2, capped: false };
}
/**
 * Kiss-band literalization: choose the committed lean whose min f over the
 * (capped) corner window lands in the kiss band [0, KISS_TOL_F]. The min-f
 * response to lean is NOT globally monotone once the aim-station exit drive
 * participates (more lean dives earlier, where the drive rescues the arc), so
 * the search is a fixed deterministic lean LADDER across (MIN_LEAN, phiReserve]
 * followed by a local bisection between the band-straddling neighbours —
 * bounded by the same per-control budget as the §4.1 bisections.
 */
function kissRefine(ctx, planFor, s_ti, seed) {
    const LADDER_N = 9;
    let budget = BISECT_ITERS;
    const probe = (lean) => {
        budget -= 1;
        const measure = measureRun(ctx, planFor(lean), false);
        return { lean_deg: lean, min_f: minFOver(measure, ctx, s_ti), capped: false, measure };
    };
    const inBand = (k) => k.min_f >= 0 && k.min_f <= KISS_TOL_F;
    // fallback preference: smallest non-negative min f; a cutting line never wins
    const better = (a, b) => {
        const ka = a.min_f >= 0 ? a.min_f : Number.POSITIVE_INFINITY;
        const kb = b.min_f >= 0 ? b.min_f : Number.POSITIVE_INFINITY;
        if (ka !== kb)
            return ka < kb ? a : b;
        return a.min_f >= b.min_f ? a : b; // both cut: the shallower cut
    };
    // seed first — the tangent construction is usually close
    const seedProbe = probe(seed.lean_deg);
    if (inBand(seedProbe))
        return seedProbe;
    let best = seedProbe;
    const lo = MIN_LEAN_DEG;
    const hi = ctx.phi_reserve_deg;
    const rungs = [];
    for (let k = 0; k < LADDER_N && budget > 0; k++) {
        const lean = lo + ((hi - lo) * k) / (LADDER_N - 1);
        const r = probe(lean);
        rungs.push(r);
        if (inBand(r))
            return r;
        best = better(best, r);
    }
    // local refine between adjacent rungs straddling the band from above/below
    for (let i = 0; i + 1 < rungs.length && budget > 0; i++) {
        const a = rungs[i];
        const b = rungs[i + 1];
        const straddles = (a.min_f > KISS_TOL_F && b.min_f < 0) || (a.min_f < 0 && b.min_f > KISS_TOL_F);
        if (!straddles)
            continue;
        let leanA = a.lean_deg;
        let leanB = b.lean_deg;
        let fA = a.min_f;
        while (budget > 0 && Math.abs(leanB - leanA) > 0.02) {
            const mid = (leanA + leanB) / 2;
            const r = probe(mid);
            if (inBand(r))
                return r;
            best = better(best, r);
            // keep the sub-interval whose endpoints still straddle the band
            if ((fA > KISS_TOL_F && r.min_f < 0) || (fA < 0 && r.min_f > KISS_TOL_F)) {
                leanB = mid;
            }
            else {
                leanA = mid;
                fA = r.min_f;
            }
        }
    }
    // nothing lands in-band: the best rung, capped-flagged when even the reserve
    // rung fell short of the inside
    const reserveRung = rungs[rungs.length - 1];
    const capped = reserveRung !== undefined && reserveRung.min_f > KISS_TOL_F && best.min_f > KISS_TOL_F;
    return { ...best, capped };
}
// ---------------------------------------------------------------------------
// Candidate plan construction
function resolveAuthoredStation(a, corners, at) {
    if (a.at_s !== undefined)
        return ok(a.at_s);
    if (a.at !== undefined)
        return resolveAnchor(a.at, corners, at);
    return err(schemaErr(at, `authored action "${a.id}" needs a station`, "authored_action_needs_station", { id: a.id }));
}
/**
 * Build the canonical solved plan — brake (held, releasing to complete
 * brake_gap before turn-in), explicit signed turn-in, maintenance crack, drive
 * roll-on (§4.2) — plus carried authored actions, RESOLVED form.
 *
 * The maintenance crack doubles as the brake RELEASE: the frozen 02 §3 taper
 * law declines from onset (see releaseStation's rationale), so "tapering to
 * complete brake_gap before turn-in" is realized as brake-hold → crack at the
 * release station → slew-governed ramp to zero. The crack therefore sits
 * PRE-turn-in rather than at s_ti + crack_gap; the §4.1a crack_gap keeps its
 * role in the roll-on bracket arithmetic. [PENDING RATIFICATION — WP-10.]
 */
function buildResolvedPlan(ctx, shape) {
    const sc = ctx.stations;
    const corner = ctx.corner;
    const d = ctx.directives;
    const actions = [];
    // brake — value possibly pinned; hold + crack-release (authored taper wins)
    const authoredBrake = d.decel.kind === "pinned" ? d.decel.action : null;
    let brakeStart = sc.s_brake_start;
    if (authoredBrake !== null && (authoredBrake.at_s !== undefined || authoredBrake.at !== undefined)) {
        const s = resolveAuthoredStation(authoredBrake, ctx.road.corners, "plan.brake");
        if (!s.ok)
            return s;
        brakeStart = s.value;
    }
    const authoredTaper = authoredBrake?.taper_to_s;
    actions.push({
        do: "brake",
        id: authoredBrake?.id ?? `b_${corner.id}`,
        at_s: brakeStart,
        decel: shape.decel,
        ...(authoredTaper !== undefined ? { taper_to_s: authoredTaper } : {}),
        slew_mss: authoredBrake?.slew_mss ?? SOLVER_BRAKE_SLEW_MSS
    });
    // explicit signed turn-in — tangent_inside literalized, never survives
    const authoredTi = d.turn_in.kind === "pinned" ? d.turn_in.action : null;
    actions.push({
        do: "turn_in",
        id: authoredTi?.id ?? `ti_${corner.id}`,
        at_s: shape.s_ti,
        target: { lean_deg: shape.lean_deg },
        hand: authoredTi?.hand ?? corner.hand
    });
    // maintenance crack = the brake release (solver's own, unless the author
    // supplied cracks or an authored taper already ends the brake)
    if (d.cracks.length === 0) {
        const s_k = authoredTaper !== undefined
            ? shape.s_ti + sc.crack_gap_m // authored taper releases the brake; crack sits per §4.1a
            : releaseStation(ctx, shape.s_ti, shape.decel);
        actions.push({
            do: "throttle",
            id: `k_${corner.id}`,
            at_s: s_k,
            accel: 0,
            slew_mss: SOLVER_BRAKE_SLEW_MSS // governs the brake-release ramp (positive rate — chop-inert)
        });
    }
    else {
        for (const crack of d.cracks) {
            const s = resolveAuthoredStation(crack, ctx.road.corners, "plan.crack");
            if (!s.ok)
                return s;
            actions.push({ do: "throttle", id: crack.id, at_s: s.value, accel: 0, slew_mss: crack.slew_mss ?? A_SLEW_DEFAULT });
        }
    }
    // drive roll-on — onset possibly pinned
    const authoredRo = d.roll_on.kind === "pinned" ? d.roll_on.action : null;
    actions.push({
        do: "throttle",
        id: authoredRo?.id ?? `ro_${corner.id}`,
        at_s: shape.roll_on_s,
        accel: shape.roll_on_accel,
        slew_mss: authoredRo?.slew_mss ?? A_SLEW_DEFAULT
    });
    // authored position actions — carried VERBATIM into every candidate (§4.9)
    for (const p of d.positions) {
        const s = resolveAuthoredStation(p, ctx.road.corners, "plan.position");
        if (!s.ok)
            return s;
        if (s.value >= shape.s_ti - 1e-9) {
            return err(noSolutionConflict("plan.position", p.id, "position window overlaps the turn-in commitment at this placement"));
        }
        const over = p.over_m !== undefined && p.over_m !== "auto" ? p.over_m : Math.min(ctx.road.total_len_m, shape.s_ti) - s.value;
        const resolved = {
            do: "position",
            id: p.id,
            at_s: s.value,
            ...(p.f !== undefined ? { f: p.f } : { d: p.d }),
            over_m: over
        };
        actions.push(resolved);
    }
    return ok(actions.sort((a, b) => a.at_s - b.at_s));
}
/** The same plan in WIRE form (validate() input) — over_m "auto" and defaults ride through. */
function wirePlanOf(resolved) {
    return resolved.map((a) => {
        switch (a.do) {
            case "brake":
                return { do: "brake", id: a.id, at_s: a.at_s, decel: a.decel, ...(a.taper_to_s !== undefined ? { taper_to_s: a.taper_to_s } : {}), slew_mss: a.slew_mss };
            case "turn_in":
                return { do: "turn_in", id: a.id, at_s: a.at_s, target: { lean_deg: a.target.lean_deg }, hand: a.hand };
            case "throttle":
                return { do: "throttle", id: a.id, at_s: a.at_s, accel: a.accel, slew_mss: a.slew_mss, ...(a.freeze_steer_s !== undefined ? { freeze_steer_s: a.freeze_steer_s } : {}) };
            case "position":
                return { do: "position", id: a.id, at_s: a.at_s, ...(a.f !== undefined ? { f: a.f } : { d: a.d }), over_m: a.over_m };
        }
    });
}
// ---------------------------------------------------------------------------
// The full verdict pipeline for one validated line (self-verify + envelope)
function narrowValidated(v, at) {
    for (const a of v.rider.plan) {
        if (a.do === "turn_in" && a.target === "tangent_inside") {
            return err({
                code: "INTERNAL",
                at,
                message: "tangent_inside survived into a solver-emitted plan (04 §4.2 forbids it)",
                detail: { reason: "tangent_inside_survived", action_id: a.id }
            });
        }
    }
    return ok(v);
}
function lineSpecHash(resolved, source) {
    const canon = canonicalize({
        road_spec: resolved.road,
        occluders: resolved.occluders,
        hazards: resolved.hazards,
        source
    });
    if (!canon.ok)
        return canon;
    return ok(fnv1a(canon.value));
}
/**
 * Execute a validated scenario through the FULL pipeline: integrate →
 * analyzeSight → analyzeCorners → corrective shot → doctrine → verdict →
 * seal → LineResult. This is the self-verification arm: the verdict returned
 * is the engine's own re-run, verbatim, including the released, unwound exit
 * straight (02 §3.1).
 */
export function executeLine(input) {
    const narrowed = narrowValidated(input.validated, "solve.executeLine");
    if (!narrowed.ok)
        return narrowed;
    const resolved = narrowed.value;
    const assembled = assembleWorld(resolved);
    if (!assembled.ok)
        return assembled;
    const { road, world, profile } = assembled.value;
    const traj0 = integrate(resolved, world);
    const traj1 = analyzeSight(traj0, road, resolved.occluders);
    const analysis = analyzeCorners(traj1, road, profile.skill);
    const merged = buildTrajectory([...traj1.samples], sortEvents([...traj1.events, ...analysis.events]), traj1.terminated);
    const shot = correctiveShot({ trajectory: merged, resolved_scenario: resolved });
    const correctives = [];
    let final = merged;
    if (shot.ok) {
        if (shot.value.events.length > 0) {
            final = buildTrajectory([...merged.samples], sortEvents([...merged.events, ...shot.value.events]), merged.terminated);
        }
        if (shot.value.corrective !== null) {
            const detectEvent = shot.value.events.find((e) => e.kind === "run_wide_detect");
            correctives.push({
                corner_id: detectEvent?.corner_id ?? road.corners[0].id,
                block: shot.value.corrective
            });
        }
    }
    else {
        const reason = (shot.error.detail ?? {})["reason"];
        if (reason !== "not_outside_corridor" && reason !== "not_drifting_outward") {
            return err(shot.error);
        }
        // The outward drift RECOVERED before the shot instant (the excursion healed
        // inside the rider's reaction time): the harness rightly refuses to launch
        // a lean-only shadow from an inside state (§4c.4), but for the LINE this is
        // the trivially-feasible save — no corrective action was even needed. The
        // detect events stay on the line; the block records the self-recovery.
        // [Recorded WP-10 judgment: a second null-shot arm beside
        // departed_before_reaction — see the report.]
        const detects = runWideDetect(merged, road.corners);
        if (detects.length > 0) {
            final = buildTrajectory([...merged.samples], sortEvents([...merged.events, ...runWideDetectEvents(detects)]), merged.terminated);
            const first = detects[0];
            const thr = F_SAVE + eps_f_save;
            let returned = null;
            const samples = merged.samples;
            for (let i = 0; i + 1 < samples.length; i++) {
                const a = samples[i];
                const b = samples[i + 1];
                if (a.t < first.t)
                    continue;
                if (a.f > thr && b.f <= thr) {
                    const alpha = (a.f - thr) / (a.f - b.f);
                    returned = { s: a.s + alpha * (b.s - a.s), f: thr };
                    break;
                }
            }
            correctives.push({
                corner_id: first.corner_id,
                block: {
                    feasible: true,
                    detect: { s: first.s, f: first.f },
                    shot: null,
                    returned,
                    fail_reason: null
                }
            });
        }
    }
    const packR = loadShippedRubricPack(resolved.config.rubric);
    if (!packR.ok)
        return packR;
    const pack = packR.value;
    const rollRateRad = degToRad(profile.roll_rate_dps);
    const doctrineCorners = road.corners.map((c) => {
        const row = analysis.corners.find((r) => r.id === c.id);
        return {
            id: c.id,
            hand: c.hand,
            s0: c.s0,
            s1: c.s1,
            type: c.type,
            ...(c.r1 !== undefined ? { r1: c.r1 } : {}),
            ...(c.r2 !== undefined ? { r2: c.r2 } : {}),
            linked_next: c.linked_next,
            apexes: (row?.apexes ?? []).map((a) => ({ s: a.s, pct: a.pct, f: a.f }))
        };
    });
    const record = {
        samples: final.samples,
        events: final.events,
        terminated: final.terminated,
        corners: doctrineCorners,
        ...(input.declared_style !== undefined ? { declared_style: input.declared_style } : {}),
        physics: {
            phi_reserve_deg: radToDeg(phiReserve(muUse(profile.skill, resolved.config.mu))),
            phi_max_deg: radToDeg(phiMax(resolved.config.mu)),
            a_widen_ms2: (phi_deg, v_ms) => aWiden(degToRad(phi_deg), v_ms, 1, rollRateRad),
            brake_gap_m: input.brake_gap_m
        }
    };
    const doctrine = runChecks(record, pack);
    const constraintRows = input.constraints !== null ? evalConstraints(final.samples, input.constraints) : null;
    const specHashR = lineSpecHash(resolved, input.source);
    if (!specHashR.ok)
        return specHashR;
    const verdictR = assembleVerdict({
        trajectory: final,
        corner_rows: analysis.corners,
        road_corners: road.corners,
        resolved_plan: resolved.rider.plan,
        doctrine,
        pack,
        spec_hash: specHashR.value,
        correctives,
        acceptance_policy: input.policy,
        constraints: constraintRows
    });
    if (!verdictR.ok)
        return verdictR;
    const sealedR = sealVerdict(verdictR.value, {
        plan: resolved.rider.plan,
        ...(resolved.rider.roll_rate_cap_dps !== undefined ? { roll_rate_cap_dps: resolved.rider.roll_rate_cap_dps } : {})
    });
    if (!sealedR.ok)
        return sealedR;
    return ok(buildLineResult({
        line_id: input.line_id ?? "solved",
        role: input.role ?? "ideal",
        label: input.label ?? "solved line",
        source: input.source,
        resolved_scenario: resolved,
        cache: "absent",
        trajectory: final,
        verdict: sealedR.value
    }));
}
export function fullSolveAtStation(ctx, s_ti, opts) {
    const sc = ctx.stations;
    const d = ctx.directives;
    // --- brackets (per candidate; typed road_too_short on degeneration) --------
    const vTarget = vTargetMs(ctx.corner, ctx.skill, ctx.mu);
    let decelLo;
    let decelHi;
    if (d.decel.kind === "pinned") {
        decelLo = d.decel.value;
        decelHi = d.decel.value;
    }
    else {
        const bracket = decelBracketAt(sc, s_ti, ctx.v_entry_ms, vTarget);
        if (!bracket.ok)
            return bracket;
        decelLo = bracket.value.lo;
        decelHi = bracket.value.hi;
    }
    let rollLo;
    let rollHi;
    let rollAccel = ROLLON_ACCEL_MS2;
    if (d.roll_on.kind === "pinned") {
        const s = resolveAuthoredStation(d.roll_on.action, ctx.road.corners, "plan.throttle");
        if (!s.ok)
            return s;
        rollLo = s.value;
        rollHi = s.value;
        rollAccel = d.roll_on.action.accel;
    }
    else {
        const bracket = rollOnBracketAt(sc, s_ti);
        if (!bracket.ok)
            return bracket;
        rollLo = bracket.value.lo;
        rollHi = bracket.value.hi;
        if (d.roll_on.kind === "magnitude")
            rollAccel = d.roll_on.accel;
    }
    const rollMid = (rollLo + rollHi) / 2;
    // The decel/kiss stages run with the roll-on at the type-aware AIM station:
    // the exit drive launched at the intended apex is part of the out-in-out
    // SHAPE (it swings the line back out after the kiss); searching the lean
    // without it would only ever find the late-tangent sweep.
    const rollAim = Math.min(Math.max(aimStation(ctx), rollLo), rollHi);
    const authoredLean = d.turn_in.kind === "pinned" && d.turn_in.action.target !== "tangent_inside"
        ? d.turn_in.action.target.lean_deg
        : null;
    const planFor = (decel, lean, rollOn) => buildResolvedPlan(ctx, { s_ti, decel, lean_deg: lean, roll_on_s: rollOn, roll_on_accel: rollAccel });
    const runShape = (decel, lean, rollOn) => {
        const plan = planFor(decel, lean, rollOn);
        if (!plan.ok)
            return plan;
        return ok(measureRun(ctx, plan.value, false));
    };
    // --- 1. feasibility probe (§4.2) -------------------------------------------
    const nominalDecel = (decelLo + decelHi) / 2;
    const seedProbe = tangentLeanDeg(ctx, s_ti, predictVti(ctx, s_ti, nominalDecel));
    const probeLean = authoredLean ?? seedProbe.lean_deg;
    const probeRunR = runShape(nominalDecel, probeLean, rollMid);
    if (!probeRunR.ok)
        return probeRunR;
    const probeRun = probeRunR.value;
    const probeMinF = minFOver(probeRun, ctx, s_ti);
    const probeApex = deepestApex(probeRun, ctx.corner.id);
    let probeInfeasible = null;
    if (seedProbe.capped && authoredLean === null && probeMinF > KISS_TOL_F) {
        probeInfeasible = noSolution("turn_in_infeasible_late", "solve.probe", `turn-in at s=${s_ti.toFixed(2)} is too late: the apex never comes inside (min f ${probeMinF.toFixed(3)} even at phiReserve)`, { s_ti, min_f: probeMinF });
    }
    else if (probeMinF < -EPS_INSIDE_CUT_F || (probeApex !== null && probeApex.s < ctx.corner.s0 - 1e-6)) {
        probeInfeasible = noSolution("turn_in_infeasible_early", "solve.probe", `turn-in at s=${s_ti.toFixed(2)} is too early: the line cuts inside`, { s_ti, min_f: probeMinF, ...(probeApex !== null ? { apex_s: probeApex.s } : {}) });
    }
    if (probeInfeasible !== null && opts.short_circuit_probe)
        return err(probeInfeasible);
    // --- 2a. bisect decel against the emergent apex-lean target ----------------
    let decel = decelLo;
    if (d.decel.kind !== "pinned" && authoredLean === null) {
        const g = (dec) => {
            const seed = tangentLeanDeg(ctx, s_ti, predictVti(ctx, s_ti, dec));
            const r = runShape(dec, seed.lean_deg, rollAim);
            if (!r.ok)
                return r;
            return ok(apexLeanDeg(r.value, ctx));
        };
        const target = ctx.lean_target_deg;
        const gLoR = g(decelLo);
        if (!gLoR.ok)
            return gLoR;
        if (gLoR.value <= target) {
            decel = decelLo; // rail: even the gentlest decel leaves lean at/below target
        }
        else {
            const gHiR = g(decelHi);
            if (!gHiR.ok)
                return gHiR;
            if (gHiR.value >= target) {
                decel = decelHi; // rail: even the hardest decel leaves lean above target
            }
            else {
                let lo = decelLo; // lean(lo) > target
                let hi = decelHi; // lean(hi) < target
                for (let i = 0; i < BISECT_ITERS && hi - lo > 0.005; i++) {
                    const mid = (lo + hi) / 2;
                    const gm = g(mid);
                    if (!gm.ok)
                        return gm;
                    if (Math.abs(gm.value - target) < 0.1) {
                        lo = mid;
                        hi = mid;
                        break;
                    }
                    if (gm.value > target)
                        lo = mid;
                    else
                        hi = mid;
                }
                decel = (lo + hi) / 2;
            }
        }
    }
    else if (d.decel.kind === "pinned") {
        decel = d.decel.value;
    }
    // --- 2b. literalize the lean into the kiss band ----------------------------
    let lean;
    let aimMeasure;
    if (authoredLean !== null) {
        lean = authoredLean;
        const r = runShape(decel, lean, rollAim);
        if (!r.ok)
            return r;
        aimMeasure = r.value;
    }
    else {
        const seed = tangentLeanDeg(ctx, s_ti, predictVti(ctx, s_ti, decel));
        const kiss = kissRefine(ctx, (l) => {
            const p = planFor(decel, l, rollAim);
            // planFor can only fail on authored-fragment stations, already resolved above
            if (!p.ok)
                throw new Error(p.error.message);
            return p.value;
        }, s_ti, seed);
        lean = kiss.lean_deg;
        aimMeasure = kiss.measure;
    }
    // --- 2c. bisect roll-on onset against exit.f = exit_target (clipped, §4.5) --
    // Plain §4.1a bracket [rollLo, rollHi], monotone in the onset (earlier onset
    // → more exit swing). Guards: an onset whose run breaches the corridor
    // outward reads +Infinity (too much drive); one whose run cuts inside reads
    // −Infinity (the drive no longer rescues the committed lean). The returned
    // onset is always a TESTED one — an untested midpoint can transiently breach
    // on the exit unwind and flip the verdict. Unreachable targets rail cleanly
    // (§4.1). Note the acknowledged coupling: a pre-apex onset erodes the
    // literalized kiss (min f rises toward ~0.3 at the exit target) — under the
    // frozen release-freeze steering semantics the kiss and the driven exit
    // cannot coexist in one line (see the WP-10 report; the §4.9 merge contract
    // lets an author pin a post-apex onset to keep the kiss instead).
    let rollOn = rollAim;
    if (d.roll_on.kind !== "pinned") {
        const target = ctx.exit_target_eff;
        const g = (onset) => {
            const r = runShape(decel, lean, onset);
            if (!r.ok)
                return r;
            const m = r.value;
            for (const sm of m.traj.samples) {
                if (sm.f < -EPS_INSIDE_CUT_F)
                    return ok(Number.NEGATIVE_INFINITY);
            }
            return ok(exitF(m, ctx));
        };
        const gLoR = g(rollLo);
        if (!gLoR.ok)
            return gLoR;
        const gHiR = g(rollHi);
        if (!gHiR.ok)
            return gHiR;
        let best = null;
        const consider = (prev, onset, value) => {
            if (Number.isFinite(value) && value <= target) {
                const gap = target - value;
                if (prev === null || gap < prev.gap)
                    return { onset, gap };
            }
            return prev;
        };
        best = consider(best, rollLo, gLoR.value);
        best = consider(best, rollHi, gHiR.value);
        if (gLoR.value <= target && Number.isFinite(gLoR.value)) {
            rollOn = rollLo; // rail: even the earliest onset reaches at most the target
        }
        else if (gHiR.value >= target && Number.isFinite(gHiR.value)) {
            rollOn = rollHi; // rail: even the latest onset exits above target
        }
        else {
            let lo = rollLo; // toward more drive (or breach)
            let hi = rollHi; // toward less drive (or inside cut)
            for (let i = 0; i < BISECT_ITERS && hi - lo > 0.02; i++) {
                const mid = (lo + hi) / 2;
                const gm = g(mid);
                if (!gm.ok)
                    return gm;
                best = consider(best, mid, gm.value);
                if (Math.abs(gm.value - target) < 0.005)
                    break;
                if (gm.value > target)
                    lo = mid;
                else
                    hi = mid;
            }
            rollOn = best !== null ? best.onset : rollAim;
        }
    }
    // --- search-final run (the search-time outcome record, §4.8.2) --------------
    const finalPlanR = planFor(decel, lean, rollOn);
    if (!finalPlanR.ok)
        return finalPlanR;
    const searchFinal = measureRun(ctx, finalPlanR.value, false);
    const searchContained = outwardCleanRun(searchFinal);
    // --- 3. self-verify: wire → validate → engine re-run, verbatim -------------
    const wire = wireScenario(ctx, wirePlanOf(finalPlanR.value));
    const validated = validate(wire);
    if (!validated.ok) {
        // the solver emitted a plan validate() rejects — an authored fragment the
        // search could not honour at this placement, or a solver bug (INTERNAL)
        const authoredIds = new Set([
            ...(ctx.spec.plan ?? []).map((a) => a.id)
        ]);
        const atPath = validated.error.at;
        const hit = [...authoredIds].find((id) => JSON.stringify(validated.error.detail ?? {}).includes(id) || atPath.includes(id));
        if (hit !== undefined)
            return err(noSolutionConflict(atPath, hit, validated.error.message));
        return err({
            code: "INTERNAL",
            at: "solve.selfVerify",
            message: `solver-emitted plan failed validate(): ${validated.error.message}`,
            detail: { reason: "solved_plan_invalid", inner: validated.error.detail ?? {} }
        });
    }
    const source = { kind: "solve", solveSpec: ctx.spec };
    const lineR = executeLine({
        validated: validated.value,
        policy: ctx.policy,
        source,
        constraints: ctx.constraints,
        brake_gap_m: ctx.stations.brake_gap_m,
        declared_style: "single",
        label: `solved ${ctx.spec.entry_kmh} km/h`
    });
    if (!lineR.ok)
        return lineR;
    const line = lineR.value;
    const fineApex = line.verdict.corners.find((c) => c.id === ctx.corner.id);
    const fineApexPct = fineApex !== undefined && fineApex.apexes.length > 0
        ? fineApex.apexes[fineApex.apexes.length - 1].pct
        : null;
    const constraintRows = line.verdict.constraints;
    return ok({
        ranked: {
            line,
            turn_in_s: s_ti,
            corridor_excess_m: corridorExcessM(line.trajectory.samples, ctx.road),
            apex_distance_pct: fineApexPct !== null
                ? Math.abs(fineApexPct - TARGET_APEX_TABLE[ctx.corner.type].target)
                : Number.POSITIVE_INFINITY
        },
        self_verify_disagrees: searchContained !== (line.verdict.outcome === "contained"),
        constraint_rows: constraintRows,
        fine_apex_pct: fineApexPct,
        probe_infeasible: probeInfeasible !== null
    });
}
// ---------------------------------------------------------------------------
// The public solve (§2(a) front door for the WP-10 scope)
/**
 * solve(spec) → Result<LineResult> (ARCHITECTURE §5). turnIn defaults to auto
 * (the §3 coarse-sweep-then-full-solve pipeline); an explicit turn-in runs the
 * §4.2 pipeline at that placement. `accept` per §4.8. WP-11 modules lift the
 * OUT_OF_SCOPE seams (chained/double-apex/vis/believed).
 */
export function solve(spec) {
    const ctxR = buildSolveContext(spec);
    if (!ctxR.ok)
        return ctxR;
    const ctx = ctxR.value;
    // explicit placement: spec.turn_in number, or an authored pinned turn-in
    let explicit = null;
    if (typeof spec.turn_in === "number")
        explicit = spec.turn_in;
    if (ctx.directives.turn_in.kind === "pinned") {
        const s = resolveAuthoredStation(ctx.directives.turn_in.action, ctx.road.corners, "plan.turn_in");
        if (!s.ok)
            return s;
        if (explicit !== null && Math.abs(explicit - s.value) > 1e-9) {
            return err(noSolutionConflict("plan.turn_in", ctx.directives.turn_in.action.id, `authored turn-in at s=${s.value.toFixed(2)} conflicts with turnIn=${explicit}`));
        }
        explicit = s.value;
    }
    if (explicit === null)
        return autoSolve(ctx);
    // --- explicit-placement path ------------------------------------------------
    const solved = fullSolveAtStation(ctx, explicit, { short_circuit_probe: ctx.policy === "clean" });
    if (!solved.ok)
        return solved;
    const cand = solved.value;
    if (!constraintsSatisfied(cand.constraint_rows)) {
        return err(constraintUnmet(cand.constraint_rows, "solve"));
    }
    if (ctx.policy === "best_failing" && cand.self_verify_disagrees) {
        return err(noSolution("no_rankable_candidate", "solve", "the only candidate's self-verify re-run disagreed with its search-time outcome"));
    }
    if (ctx.policy === "best_failing" && !cand.ranked.line.verdict.ok) {
        const picked = pickBestFailing([cand.ranked]);
        return "code" in picked ? err(picked) : ok(picked);
    }
    // clean policy: the self-verified verdict is returned VERBATIM — a non-clean
    // self-verification reports acceptance {policy: "clean", met: false} (§4.2.3)
    return ok(cand.ranked.line);
}
export function coarseCandidate(ctx, s_ti) {
    const dead = (error) => ({
        s_ti,
        error,
        contained: false,
        apex_pct: null,
        in_band: false,
        constraint_ok: false,
        constraint_rows: null,
        corridor_excess_m: Number.POSITIVE_INFINITY,
        rank: Number.POSITIVE_INFINITY
    });
    const d = ctx.directives;
    const vTarget = vTargetMs(ctx.corner, ctx.skill, ctx.mu);
    let decelLo;
    let decelHi;
    if (d.decel.kind === "pinned") {
        decelLo = d.decel.value;
        decelHi = d.decel.value;
    }
    else {
        const bracket = decelBracketAt(ctx.stations, s_ti, ctx.v_entry_ms, vTarget);
        if (!bracket.ok)
            return dead(bracket.error);
        decelLo = bracket.value.lo;
        decelHi = bracket.value.hi;
    }
    let rollMid;
    let rollAccel = ROLLON_ACCEL_MS2;
    if (d.roll_on.kind === "pinned") {
        const s = resolveAuthoredStation(d.roll_on.action, ctx.road.corners, "plan.throttle");
        if (!s.ok)
            return dead(s.error);
        rollMid = s.value;
        rollAccel = d.roll_on.action.accel;
    }
    else {
        const bracket = rollOnBracketAt(ctx.stations, s_ti);
        if (!bracket.ok)
            return dead(bracket.error);
        rollMid = Math.min(Math.max(aimStation(ctx), bracket.value.lo), bracket.value.hi);
        if (d.roll_on.kind === "magnitude")
            rollAccel = d.roll_on.accel;
    }
    const nominal = (decelLo + decelHi) / 2;
    const seed = tangentLeanDeg(ctx, s_ti, predictVti(ctx, s_ti, nominal));
    const planR = buildResolvedPlan(ctx, {
        s_ti,
        decel: nominal,
        lean_deg: seed.lean_deg,
        roll_on_s: rollMid,
        roll_on_accel: rollAccel
    });
    if (!planR.ok)
        return dead(planR.error);
    const m = measureRun(ctx, planR.value, true);
    const apex = deepestApex(m, ctx.corner.id);
    const band = TARGET_APEX_TABLE[ctx.corner.type].band;
    const target = TARGET_APEX_TABLE[ctx.corner.type].target;
    const in_band = apex !== null && apex.pct >= band[0] && apex.pct <= band[1];
    const constraint_rows = ctx.constraints !== null ? evalConstraints(m.traj.samples, ctx.constraints) : null;
    return {
        s_ti,
        error: null,
        contained: containedRun(m),
        apex_pct: apex !== null ? apex.pct : null,
        in_band,
        constraint_ok: constraintsSatisfied(constraint_rows),
        constraint_rows,
        corridor_excess_m: corridorExcessM(m.traj.samples, ctx.road),
        rank: apex !== null ? Math.abs(apex.pct - target) : Number.POSITIVE_INFINITY
    };
}
//# sourceMappingURL=solve.js.map