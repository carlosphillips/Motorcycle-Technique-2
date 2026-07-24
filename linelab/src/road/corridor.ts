// road/corridor.ts — the usable corridor and lane-fraction algebra (design/03 §2),
// the governing-corner rule, occluder/hazard `sideSign`, and the muAt lateral
// clamp (D19). ONE implementation — everything reading `f` rescales together
// with the corridor; callers never re-derive it (ARCHITECTURE drift risk #11).
//
// Frame recap (ARCHITECTURE §6.1): x east, y down; `+kappa` = right-hand turn;
// signed offset `d` positive to the rider's LEFT; `handSign("R") = +1`.
// Right-hand traffic is the v1 convention (design/03 §2): the rider's own lane
// lies RIGHT of the centreline in the direction of travel, i.e. d ∈ [−lane_width_m, 0];
// the physical edges sit at |d| = lane_width_m (the carriageway is two lanes wide).

import { handSign } from "../core/units.js";
import type { Corner, Hand, OccluderSide, RoadModel } from "../core/types.js";

/**
 * The governing corner for station s (design/03 §2): the corner containing s;
 * on non-corner stations the nearest corner downstream; after the last corner,
 * the last corner. The handoff station is each corner's exit boundary s1 (a
 * station exactly at s1 already belongs to the next governing corner).
 * `undefined` only on a road with no corners at all.
 */
export function governingCorner(
  corners: readonly Corner[],
  s: number
): Corner | undefined {
  for (const c of corners) {
    if (s < c.s1) return c; // containing (s0 ≤ s < s1) or nearest downstream (s < s0 ≤ s1)
  }
  return corners.length > 0 ? corners[corners.length - 1] : undefined;
}

/**
 * Corner-less roads still record `f` (longitudinal fixtures like `lane 8 | S 400`
 * ride them). The design defines the governing frame only via corners; with none
 * we pin an arbitrary-but-deterministic frame hand.
 */
export const NO_CORNER_FRAME_HAND: Hand = "R";

/** The corridor's geometric parameters the f↔d map runs on. */
export interface CorridorParams {
  readonly lane_width_m: number;
  readonly bike_margin_m: number;
  readonly use_full_width: boolean;
  readonly corners: readonly Corner[];
}

/**
 * Corridor centre `c` and half-width `a` in d-space (design/03 §2):
 * - default: the rider's own lane (d ∈ [−W, 0]) inset bike_margin_m both edges
 *   → centre −W/2, half-width W/2 − bm;
 * - use_full_width: the full carriageway (d ∈ [−W, +W]) inset bike_margin_m at
 *   each OUTER edge → centre 0, half-width W − bm.
 */
function corridorCentreHalf(p: CorridorParams): { c: number; a: number } {
  const W = p.lane_width_m;
  const bm = p.bike_margin_m;
  return p.use_full_width ? { c: 0, a: W - bm } : { c: -W / 2, a: W / 2 - bm };
}

function frameHand(p: CorridorParams, s: number): Hand {
  return governingCorner(p.corners, s)?.hand ?? NO_CORNER_FRAME_HAND;
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
export function dOf(p: CorridorParams, f: number, s: number): number {
  const { c, a } = corridorCentreHalf(p);
  return c - handSign(frameHand(p, s)) * a * (1 - 2 * f);
}

/** fOf: lane fraction for signed offset d at station s — the exact inverse of dOf. */
export function fOf(p: CorridorParams, d: number, s: number): number {
  const { c, a } = corridorCentreHalf(p);
  return (1 + (d - c) / (handSign(frameHand(p, s)) * a)) / 2;
}

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
export function sideSign(side: OccluderSide, hand: Hand): 1 | -1 {
  switch (side) {
    case "left":
      return 1;
    case "right":
      return -1;
    case "inside":
      return handSign(hand) === 1 ? -1 : 1;
    case "outside":
      return handSign(hand) === 1 ? 1 : -1;
  }
}

/**
 * The muAt lateral clamp (design/03 §2, D19): μ is defined only ON the
 * carriageway; for |d| > lane_width_m it returns the value at the laterally
 * clamped point — this exists solely so the integrator's sub-stages of the
 * crossing step are well-defined. No grass physics; no sample beyond the
 * bracketed crossing.
 */
export function clampLateral(lane_width_m: number, d: number): number {
  if (d > lane_width_m) return lane_width_m;
  if (d < -lane_width_m) return -lane_width_m;
  return d;
}

/**
 * Build a muAt from an on-carriageway μ field, applying the lateral clamp.
 * compose() uses the uniform field 1.0; downstream World assembly rebuilds with
 * the scenario's config.mu / hazard bands through this same clamp law.
 */
export function muAtClamped(
  lane_width_m: number,
  muOn: (s: number, dClamped: number) => number
): (s: number, d: number) => number {
  return (s, d) => muOn(s, clampLateral(lane_width_m, d));
}

/**
 * A RoadModel copy whose muAt reads `muOn` (still lateral-clamped). Pure — the
 * input model is untouched. Lets solve/run fold config.mu and hazard μ-bands
 * without re-deriving the clamp law.
 */
export function withMu<M extends RoadModel>(
  model: M,
  muOn: (s: number, dClamped: number) => number
): M {
  return Object.freeze({
    ...model,
    muAt: muAtClamped(model.lane_width_m, muOn)
  });
}
