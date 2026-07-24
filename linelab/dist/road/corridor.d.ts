import type { Corner, Hand, OccluderSide, RoadModel } from "../core/types.js";
/**
 * The governing corner for station s (design/03 §2): the corner containing s;
 * on non-corner stations the nearest corner downstream; after the last corner,
 * the last corner. The handoff station is each corner's exit boundary s1 (a
 * station exactly at s1 already belongs to the next governing corner).
 * `undefined` only on a road with no corners at all.
 */
export declare function governingCorner(corners: readonly Corner[], s: number): Corner | undefined;
/**
 * Corner-less roads still record `f` (longitudinal fixtures like `lane 8 | S 400`
 * ride them). The design defines the governing frame only via corners; with none
 * we pin an arbitrary-but-deterministic frame hand.
 */
export declare const NO_CORNER_FRAME_HAND: Hand;
/** The corridor's geometric parameters the f↔d map runs on. */
export interface CorridorParams {
    readonly lane_width_m: number;
    readonly bike_margin_m: number;
    readonly use_full_width: boolean;
    readonly corners: readonly Corner[];
}
/**
 * dOf: signed offset d for lane fraction f at station s, in the governing
 * corner's frame. f = 0 is the INNER usable edge, f = 1 the OUTER. The inside
 * of the corner lies toward −handSign(hand) in d-space (a right-hander's inside
 * is the rider's right = −d; a left-hander's inside is toward/across the
 * centreline = +d), so:
 *
 *   d(f) = c − handSign(hand) · a · (1 − 2f)
 *
 * At an opposite-hand handoff (station s1) the frame flips: the same d re-reads
 * as 1 − f — a coordinate re-reading, not motion (recorded per-sample jump,
 * design/05 §2.1). That flip falls out of this formula; nothing special-cases it.
 */
export declare function dOf(p: CorridorParams, f: number, s: number): number;
/** fOf: lane fraction for signed offset d at station s — the exact inverse of dOf. */
export declare function fOf(p: CorridorParams, d: number, s: number): number;
/**
 * sideSign (design/03 §4): resolve the rider-relative / corner-relative side
 * vocabulary to a signed lateral DIRECTION in d-space (+1 = +d = rider's left,
 * −1 = −d = rider's right). `left|right` are rider-relative and hand-free;
 * `inside|outside` resolve through the governing corner's hand. Imports
 * handSign — the sign family is defined once (ARCHITECTURE §6.1).
 *
 * Consequences the fixture cross-check pins (fixture_geometry.py check 8): on a
 * LEFT-hander `inside` lies across the centreline from the rider (+d); on a
 * RIGHT-hander it lies just beyond the rider's OWN lane edge (−d).
 */
export declare function sideSign(side: OccluderSide, hand: Hand): 1 | -1;
/**
 * The muAt lateral clamp (design/03 §2, D19): μ is defined only ON the
 * carriageway; for |d| > lane_width_m it returns the value at the laterally
 * clamped point — this exists solely so the integrator's sub-stages of the
 * crossing step are well-defined. No grass physics; no sample beyond the
 * bracketed crossing.
 */
export declare function clampLateral(lane_width_m: number, d: number): number;
/**
 * Build a muAt from an on-carriageway μ field, applying the lateral clamp.
 * compose() uses the uniform field 1.0; downstream World assembly rebuilds with
 * the scenario's config.mu / hazard bands through this same clamp law.
 */
export declare function muAtClamped(lane_width_m: number, muOn: (s: number, dClamped: number) => number): (s: number, d: number) => number;
/**
 * A RoadModel copy whose muAt reads `muOn` (still lateral-clamped). Pure — the
 * input model is untouched. Lets solve/run fold config.mu and hazard μ-bands
 * without re-deriving the clamp law.
 */
export declare function withMu<M extends RoadModel>(model: M, muOn: (s: number, dClamped: number) => number): M;
