// road/compose.ts — compose(roadSpec) → Result<RoadModel> (design/03 §2).
//
// Produces a frozen model: dense station lookup {s, x, y, psi, kappa} at ds_m
// spacing, the segments list, and the derived corners list — corner ids
// `c1, c2, …` minted per curved segment in segment order. The road starts at
// the origin heading +x. All corner records are computed here, deterministic —
// road properties, never solver guesses.
//
// This file also holds the OWNING statement of the super-tight refusal (D21;
// 02 §7 restates and defers here): a corner c is refused OUT_OF_SCOPE
// (`super_tight_geometry`) iff the swept angle accumulated over the stations of
// c where the local radius r(s) ≤ R_UTURN_MAX is ≥ SWEEP_UTURN_MIN. The
// quantifier is PER CORNER, never per road (bookEsses' 300° of r=12 sweep must
// pass). Taper r is linear in swept angle for this test, so it is decidable in
// closed form.
//
// Geometry closed forms (r linear in swept angle θ, a = r1, b = (r2−r1)/θm):
//   s(θ)  = a·θ + b·θ²/2                          (arc: b = 0)
//   u(θ)  = (a+bθ)·sinθ + b·cosθ − b              (along entry heading)
//   v(θ)  = sgn·(a − (a+bθ)·cosθ + b·sinθ)        (lateral; sgn = handSign)
//   psi   = psi0 + sgn·θ ;  kappa = sgn / (a+bθ)
// These reduce exactly to the fixture cross-check's road() math
// (review/verify/fixture_geometry.py — its numbers are normative).
import { ok, err } from "../core/result.js";
import { handSign, degToRad } from "../core/units.js";
import { ds_m as DS_M_DEFAULT, BIKE_MARGIN_DEFAULT_M } from "../core/constants.js";
import { isDslSpec, isPresetSpec } from "./types.js";
import { parseRoadDSL, printRoadDSL } from "./dsl.js";
import { resolvePreset } from "./presets.js";
import { TAPER_RATIO_MIN, LINK_GAP_FRAC, R_UTURN_MAX, SWEEP_UTURN_MIN } from "./constants.js";
import { dOf as corridorDOf, fOf as corridorFOf, muAtClamped } from "./corridor.js";
/**
 * Resolve the roadSpec union to segments + disclosed DSL. Preset roads expand
 * through the §3.1 table (hand-flip applied); dsl roads keep the authored
 * string verbatim; segment-authored roads get `dsl` filled by printRoadDSL.
 */
export function normalizeRoadSpec(spec) {
    const bike_margin_m = spec.bike_margin_m ?? BIKE_MARGIN_DEFAULT_M;
    const use_full_width = spec.use_full_width ?? false;
    if (isPresetSpec(spec)) {
        const preset = resolvePreset(spec.preset, spec.hand);
        if (!preset.ok)
            return preset;
        return ok({
            lane_width_m: preset.value.spec.lane_width_m,
            bike_margin_m,
            use_full_width,
            segments: preset.value.spec.segments,
            dsl: preset.value.dsl
        });
    }
    if (isDslSpec(spec)) {
        const parsed = parseRoadDSL(spec.dsl);
        if (!parsed.ok)
            return parsed;
        return ok({
            lane_width_m: parsed.value.lane_width_m,
            bike_margin_m,
            use_full_width,
            segments: parsed.value.segments,
            dsl: spec.dsl // the originating DSL string rides along verbatim (03 §2.1)
        });
    }
    return ok({
        lane_width_m: spec.lane_width_m,
        bike_margin_m,
        use_full_width,
        segments: spec.segments,
        dsl: printRoadDSL(spec)
    });
}
function segmentLength(seg) {
    if (seg.type === "straight")
        return seg.len_m;
    if (seg.type === "arc")
        return seg.r_m * degToRad(seg.angle_deg);
    return (degToRad(seg.angle_deg) * (seg.r1_m + seg.r2_m)) / 2;
}
/** Exact pose at local arc length ℓ ∈ [0, len] into the segment. */
function poseInSegment(g, ell) {
    const { seg, x0, y0, psi0 } = g;
    const cos0 = Math.cos(psi0);
    const sin0 = Math.sin(psi0);
    if (seg.type === "straight") {
        return { x: x0 + ell * cos0, y: y0 + ell * sin0, psi: psi0, kappa: 0 };
    }
    const sgn = handSign(seg.hand);
    const thetaM = degToRad(seg.angle_deg);
    const a = seg.type === "arc" ? seg.r_m : seg.r1_m;
    const b = seg.type === "arc" ? 0 : (seg.r2_m - seg.r1_m) / thetaM;
    // invert s(θ) = a·θ + b·θ²/2 for θ ≥ 0
    const theta = Math.abs(b) < 1e-12
        ? ell / a
        : (-a + Math.sqrt(Math.max(0, a * a + 2 * b * ell))) / b;
    const r = a + b * theta;
    const u = (a + b * theta) * Math.sin(theta) + b * Math.cos(theta) - b;
    const v = sgn * (a - (a + b * theta) * Math.cos(theta) + b * Math.sin(theta));
    return {
        x: x0 + u * cos0 - v * sin0,
        y: y0 + u * sin0 + v * cos0,
        psi: psi0 + sgn * theta,
        kappa: sgn / r
    };
}
// ---------------------------------------------------------------------------
// Super-tight sweep content (closed form; the owning statement)
/** deg of the segment's sweep spent at local radius r ≤ R_UTURN_MAX. */
function sweepBelowRUturn(seg) {
    if (seg.type === "straight")
        return 0;
    if (seg.type === "arc")
        return seg.r_m <= R_UTURN_MAX ? seg.angle_deg : 0;
    const { r1_m: r1, r2_m: r2, angle_deg } = seg;
    if (r1 === r2)
        return r1 <= R_UTURN_MAX ? angle_deg : 0;
    // r(t) = r1 + (r2−r1)·t over sweep fraction t ∈ [0,1] (r linear in swept angle)
    const tStar = (R_UTURN_MAX - r1) / (r2 - r1);
    const clamped = Math.min(1, Math.max(0, tStar));
    const fraction = r2 < r1 ? 1 - clamped : clamped; // decreasing: tail; increasing: head
    return angle_deg * fraction;
}
// ---------------------------------------------------------------------------
// compose
const PROJECT_REFINE_ITERS = 60;
/**
 * compose(roadSpec) → Result<RoadModel> (design/03 §2). The returned value is a
 * frozen ComposedRoad. `opts.ds_m` overrides the dense-lookup spacing (defaults
 * to the core ds_m = 0.5 m); the model's analytic closures are exact regardless.
 * The built-in muAt is the lateral-clamped uniform field μ = 1.0; World
 * assembly rebuilds it with config.mu / hazard bands via corridor.withMu.
 */
/**
 * THE corner-id minting rule: `c1, c2, …`, one per CURVED segment, in segment
 * order. Exported because two other surfaces need to name a corner without
 * composing a road (render/controls.ts's phase partition needs the LAST corner
 * id, and tests assert the mapping) — and a second, hand-rolled copy of the
 * rule is exactly the drift ARCHITECTURE §9 exists to forbid.
 */
export function cornerIdAtIndex(index) {
    return `c${index + 1}`;
}
/** The corner ids a segment list mints, in order — `compose()`'s own rule, without composing. */
export function cornerIdsOf(segments) {
    const out = [];
    for (const seg of segments) {
        if (seg.type === "straight")
            continue;
        out.push(cornerIdAtIndex(out.length));
    }
    return out;
}
export function compose(spec, opts) {
    const norm = normalizeRoadSpec(spec);
    if (!norm.ok)
        return norm;
    const { lane_width_m, bike_margin_m, use_full_width, segments, dsl } = norm.value;
    if (segments.length === 0) {
        return err({
            code: "BAD_RANGE",
            at: "road.segments",
            message: "a road needs at least one segment",
            detail: { reason: "empty_road" }
        });
    }
    if (!(lane_width_m > 0) || !(bike_margin_m >= 0) || 2 * bike_margin_m >= lane_width_m) {
        return err({
            code: "BAD_RANGE",
            at: "road.lane_width_m",
            message: `lane_width_m must be > 0 and > 2·bike_margin_m (got ${lane_width_m} vs bike_margin_m ${bike_margin_m})`,
            detail: { reason: "corridor_degenerate", lane_width_m, bike_margin_m }
        });
    }
    for (let i = 0; i < segments.length; i++) {
        const seg = segments[i];
        const dims = seg.type === "straight"
            ? [seg.len_m]
            : seg.type === "arc"
                ? [seg.r_m, seg.angle_deg]
                : [seg.r1_m, seg.r2_m, seg.angle_deg];
        if (dims.some((x) => !Number.isFinite(x) || x <= 0)) {
            return err({
                code: "BAD_RANGE",
                at: `road.segments[${i}]`,
                message: "segment dimensions must be finite and strictly positive",
                detail: { reason: "nonpositive_dimension" }
            });
        }
    }
    // -- walk segments: accumulate poses & station bounds ----------------------
    const geoms = [];
    let s = 0;
    let x = 0;
    let y = 0;
    let psi = 0;
    for (const seg of segments) {
        const len = segmentLength(seg);
        const g = { seg, s0: s, len, x0: x, y0: y, psi0: psi };
        geoms.push(g);
        const end = poseInSegment(g, len);
        s += len;
        x = end.x;
        y = end.y;
        psi = end.psi;
    }
    const total_len_m = s;
    const poseAt = (station) => {
        const sc = Math.min(Math.max(station, 0), total_len_m);
        // linear scan — segment counts are tiny; deterministic
        let g = geoms[geoms.length - 1];
        for (const cand of geoms) {
            if (sc < cand.s0 + cand.len) {
                g = cand;
                break;
            }
        }
        return poseInSegment(g, Math.min(sc - g.s0, g.len));
    };
    // -- mint corners (ids c1, c2, … per curved segment, segment order) --------
    const corners = [];
    for (const g of geoms) {
        const seg = g.seg;
        if (seg.type === "straight")
            continue;
        const id = cornerIdAtIndex(corners.length);
        // super-tight refusal — per corner, closed form (D21)
        const below = sweepBelowRUturn(seg);
        if (below >= SWEEP_UTURN_MIN) {
            return err({
                code: "OUT_OF_SCOPE",
                at: id,
                message: `corner ${id} accumulates ${below.toFixed(1)}° of sweep at r ≤ ${R_UTURN_MAX} m ` +
                    `(≥ ${SWEEP_UTURN_MIN}°) — super-tight U-turn geometry is out of scope`,
                detail: {
                    reason: "super_tight_geometry",
                    sweep_below_r_max_deg: below,
                    r_uturn_max_m: R_UTURN_MAX
                }
            });
        }
        let type;
        let r;
        let r1;
        let r2;
        let r_min;
        let r_max;
        if (seg.type === "arc") {
            type = "constant";
            r = seg.r_m;
            r_min = seg.r_m;
            r_max = seg.r_m;
        }
        else {
            r1 = seg.r1_m;
            r2 = seg.r2_m;
            type =
                r1 / r2 >= TAPER_RATIO_MIN
                    ? "decreasing"
                    : r2 / r1 >= TAPER_RATIO_MIN
                        ? "increasing"
                        : "constant";
            r = (r1 + r2) / 2;
            r_min = Math.min(r1, r2);
            r_max = Math.max(r1, r2);
        }
        const s0 = g.s0;
        const s1 = g.s0 + g.len;
        corners.push({
            id,
            hand: seg.hand,
            s0,
            s1,
            s_mid: (s0 + s1) / 2,
            r,
            angle_deg: seg.angle_deg,
            type,
            ...(r1 !== undefined && r2 !== undefined ? { r1, r2 } : {}),
            r_min,
            r_max,
            linked_next: false // filled below
        });
    }
    // gap_to_next_m / linked_next pass (design/03 §2)
    const finalCorners = corners.map((c, i) => {
        const next = corners[i + 1];
        if (next === undefined)
            return Object.freeze({ ...c }); // last: gap absent, linked false
        const gap = next.s0 - c.s1;
        const lArcN = c.s1 - c.s0;
        const lArcNext = next.s1 - next.s0;
        return Object.freeze({
            ...c,
            gap_to_next_m: gap,
            linked_next: gap <= LINK_GAP_FRAC * Math.min(lArcN, lArcNext)
        });
    });
    // -- dense station lookup at ds_m spacing ----------------------------------
    const ds = opts?.ds_m ?? DS_M_DEFAULT;
    const stations = [];
    for (let si = 0; si * ds < total_len_m; si++) {
        const st = si * ds;
        const p = poseAt(st);
        stations.push(Object.freeze({ s: st, x: p.x, y: p.y, psi: p.psi, kappa: p.kappa }));
    }
    {
        const p = poseAt(total_len_m);
        stations.push(Object.freeze({ s: total_len_m, x: p.x, y: p.y, psi: p.psi, kappa: p.kappa }));
    }
    // -- corridor closures -----------------------------------------------------
    const corridor = {
        lane_width_m,
        bike_margin_m,
        use_full_width,
        corners: finalCorners
    };
    /** left normal in the y-down frame: rotate tangent so +d = rider's LEFT. */
    const worldAt = (station, d) => {
        const p = poseAt(station);
        return { x: p.x + d * Math.sin(p.psi), y: p.y - d * Math.cos(p.psi) };
    };
    const project = (px, py) => {
        // coarse: nearest dense station; refine: ternary search on distance²
        let bestI = 0;
        let bestD2 = Infinity;
        for (let i = 0; i < stations.length; i++) {
            const st = stations[i];
            const dx = px - st.x;
            const dy = py - st.y;
            const d2 = dx * dx + dy * dy;
            if (d2 < bestD2) {
                bestD2 = d2;
                bestI = i;
            }
        }
        const sCentre = stations[bestI].s;
        let lo = Math.max(0, sCentre - ds);
        let hi = Math.min(total_len_m, sCentre + ds);
        const dist2 = (st) => {
            const p = poseAt(st);
            const dx = px - p.x;
            const dy = py - p.y;
            return dx * dx + dy * dy;
        };
        for (let i = 0; i < PROJECT_REFINE_ITERS; i++) {
            const m1 = lo + (hi - lo) / 3;
            const m2 = hi - (hi - lo) / 3;
            if (dist2(m1) <= dist2(m2))
                hi = m2;
            else
                lo = m1;
        }
        const sStar = (lo + hi) / 2;
        const p = poseAt(sStar);
        // signed d: projection onto the left normal (sin psi, −cos psi)
        const d = (px - p.x) * Math.sin(p.psi) - (py - p.y) * Math.cos(p.psi);
        return { s: sStar, d };
    };
    const model = Object.freeze({
        lane_width_m,
        bike_margin_m,
        use_full_width,
        total_len_m,
        corners: Object.freeze(finalCorners),
        segments: Object.freeze([...segments]),
        dsl,
        stations: Object.freeze(stations),
        psi_road: (st) => poseAt(st).psi,
        kappa_road: (st) => poseAt(st).kappa,
        dOf: (f, st) => corridorDOf(corridor, f, st),
        fOf: (d, st) => corridorFOf(corridor, d, st),
        muAt: muAtClamped(lane_width_m, () => 1.0),
        worldAt,
        project
    });
    return ok(model);
}
//# sourceMappingURL=compose.js.map