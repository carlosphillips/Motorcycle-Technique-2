// sight/footprints.ts — occluder → opaque plan-view footprint polygons
// (design/03 §4). GEOMETRY ONLY: wire-schema validation (required fields,
// lane ⊕ f ⊕ side exclusivity, span-on-vehicle rejection, …) is plan/validate's
// job (WP-05); this module consumes the post-validation ResolvedOccluder shape
// and resolves it to world-frame polygons for the ray test in cast.ts.
//
// Frame (ARCHITECTURE §6.1): x east, y down; signed lateral offset d positive to
// the rider's LEFT; physical road edges at |d| = lane_width_m; the rider's own
// lane is d ∈ [−lane_width_m, 0] (right-hand traffic, design/03 §2).
//
// Band kinds (design/03 §4 table): a band parallel to the road edge, from
// `margin_m` outside the edge, extending `depth_m` further out, over the station
// span [at_s, at_s + span_m]. Vehicle (D27): a discrete rectangle len_m × width_m
// whose long axis aligns with the road tangent at the anchor station; the three
// lateral placement forms (lane | f | side) resolve through the same
// sideSign/corridor machinery as the rider's f. Heading is presentation-only —
// the rectangle is symmetric, so the optical footprint never reads it.
import { governingCorner, NO_CORNER_FRAME_HAND, sideSign } from "../road/corridor.js";
import { OCCLUDER_BAND_DEFAULTS, VEHICLE_DEFAULTS } from "../road/constants.js";
import { FOOTPRINT_STEP_M } from "./constants.js";
/**
 * The hand the side vocabulary resolves through: the governing corner at the
 * occluder's anchor station (design/03 §4 resolves `inside|outside` "through the
 * governing corner's hand"; the band keeps one side for its whole span). On a
 * cornerless road the corridor's pinned frame hand applies (road/corridor.ts).
 */
function anchorHand(road, at_s) {
    return governingCorner(road.corners, at_s)?.hand ?? NO_CORNER_FRAME_HAND;
}
/** Band-kind footprint: sampled inner face out, outer face back — one closed quad strip. */
function bandFootprint(road, occ, kind) {
    const defaults = OCCLUDER_BAND_DEFAULTS[kind];
    const margin = occ.margin_m ?? defaults.margin_m;
    const depth = occ.depth_m ?? defaults.depth_m;
    // side is required on band kinds (03 §4.1); validate() enforces it. The
    // fallback below is a totality guard only — unreachable post-validation.
    const side = occ.side ?? "inside";
    const sgn = sideSign(side, anchorHand(road, occ.at.at_s));
    const dInner = sgn * (road.lane_width_m + margin);
    const dOuter = sgn * (road.lane_width_m + margin + depth);
    const s0 = occ.at.at_s;
    const s1 = s0 + (occ.span_m ?? 0);
    const stations = [];
    for (let s = s0; s < s1; s += FOOTPRINT_STEP_M)
        stations.push(s);
    stations.push(s1);
    const inner = stations.map((s) => road.worldAt(s, dInner));
    const outer = stations.map((s) => road.worldAt(s, dOuter)).reverse();
    return Object.freeze({
        id: occ.id,
        kind,
        polygon: Object.freeze([...inner, ...outer]),
        centre: road.worldAt((s0 + s1) / 2, (dInner + dOuter) / 2)
    });
}
/**
 * Vehicle centre offset in d-space (D27, design/03 §4):
 * - on-road `lane` form: the centre of the named lane (own = −W/2, oncoming = +W/2
 *   under right-hand traffic);
 * - on-road `f` escape hatch: the corridor algebra (any real f; f < 0 / f > 1
 *   resolve through the same map, so a vehicle can straddle the centreline);
 * - verge `side` form: margin_m + width_m/2 beyond the road edge on the resolved side.
 */
function vehicleCentreD(road, occ, width_m) {
    if (occ.lane !== undefined) {
        return occ.lane === "own" ? -road.lane_width_m / 2 : road.lane_width_m / 2;
    }
    if (occ.f !== undefined) {
        return road.dOf(occ.f, occ.at.at_s);
    }
    if (occ.side !== undefined) {
        const margin = occ.margin_m ?? VEHICLE_DEFAULTS.verge_margin_m;
        const sgn = sideSign(occ.side, anchorHand(road, occ.at.at_s));
        return sgn * (road.lane_width_m + margin + width_m / 2);
    }
    // exactly one of lane ⊕ f ⊕ side is enforced by validate() (vehicle_lane_xor_side);
    // totality guard only — unreachable post-validation.
    return -road.lane_width_m / 2;
}
/** Vehicle footprint: len_m × width_m rectangle, long axis along the road tangent. */
function vehicleFootprint(road, occ) {
    const len = occ.len_m ?? VEHICLE_DEFAULTS.len_m;
    const width = occ.width_m ?? VEHICLE_DEFAULTS.width_m;
    const at_s = occ.at.at_s;
    const dC = vehicleCentreD(road, occ, width);
    const centre = road.worldAt(at_s, dC);
    const psi = road.psi_road(at_s);
    // tangent and left normal in the y-down frame (same rotation worldAt uses)
    const tx = Math.cos(psi);
    const ty = Math.sin(psi);
    const nx = Math.sin(psi);
    const ny = -Math.cos(psi);
    const a = len / 2;
    const b = width / 2;
    return Object.freeze({
        id: occ.id,
        kind: "vehicle",
        polygon: Object.freeze([
            { x: centre.x + a * tx + b * nx, y: centre.y + a * ty + b * ny },
            { x: centre.x + a * tx - b * nx, y: centre.y + a * ty - b * ny },
            { x: centre.x - a * tx - b * nx, y: centre.y - a * ty - b * ny },
            { x: centre.x - a * tx + b * nx, y: centre.y - a * ty + b * ny }
        ]),
        centre
    });
}
/** Resolve ONE occluder to its opaque footprint (design/03 §4). Pure. */
export function footprintOf(road, occ) {
    return occ.kind === "vehicle"
        ? vehicleFootprint(road, occ)
        : bandFootprint(road, occ, occ.kind);
}
/**
 * Resolve every occluder to the opaque set consumed by the sight cast — "the
 * footprint joins the opaque set consumed by sightFrom — no special casing"
 * (design/03 §4). Order preserved (declaration order; the cast is order-independent).
 */
export function footprintsOf(road, occluders) {
    return Object.freeze(occluders.map((occ) => footprintOf(road, occ)));
}
//# sourceMappingURL=footprints.js.map