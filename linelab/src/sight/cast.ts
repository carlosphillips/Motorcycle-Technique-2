// sight/cast.ts — the rider-eye sight cast (design/03 §5.1, D4).
//
// sightFrom(road, eye, occluders) → { sight_m, limit_point, s_limit }
//
// - Eye = the rider's ACTUAL position (D4 — the load-bearing change from the
//   prior design's centreline eye; moving the bike toward the outside of a
//   corner visibly opens the sight line, which is the hold-wide teaching).
// - Targets = the ride-lane centre polyline: stations forward of the eye's
//   station in ds_m steps (the composed road's dense grid) along the centre of
//   the rider's own lane (d = −lane_width_m/2 under right-hand traffic).
//   Targets are line-independent, so sight_m is comparable across lines.
// - First-blocked semantics: s_limit is the last visible station before the
//   first blocked one; visibility that re-emerges beyond a gap does NOT count
//   (conservative; the limit point is where the road *disappears*).
// - sight_m = s_limit − s_eye (arc distance). With no occluders sight runs to
//   the road end — blindness comes only from occluders, by design.
// - Pure function of (road, eye, occluders); no trend (a pure cast has no
//   previous sample — the trend is derived downstream, design/05 §4); no speed
//   parameter (geometric sight is speed-independent; speed enters via ssd).
//
// The independent cross-check is review/verify/fixture_geometry.py sight_from();
// test/property/sight-unit.test.ts pins this cast against its published numbers.

import { footprintsOf } from "./footprints.js";
import type { OpaqueFootprint, Vec2 } from "./footprints.js";
import type { ComposedRoad } from "../road/types.js";
import type { ResolvedOccluder, SightCast } from "../core/types.js";

// Numeric guards of the segment-intersection predicate — matched to the
// independent cross-check (fixture_geometry.py _crosses) so the two
// implementations agree on grazing rays.
const EPS_PARALLEL = 1e-12;
const EPS_PARAM = 1e-9;

/**
 * Proper (open-interval) segment intersection: true iff segments p→q and a→b
 * cross strictly between their endpoints. Endpoint touches and collinear
 * overlaps do not count — deterministic, and identical to the fixture's law.
 */
function segmentsCross(p: Vec2, q: Vec2, a: Vec2, b: Vec2): boolean {
  const d1x = q.x - p.x;
  const d1y = q.y - p.y;
  const d2x = b.x - a.x;
  const d2y = b.y - a.y;
  const den = d1x * d2y - d1y * d2x;
  if (Math.abs(den) < EPS_PARALLEL) return false;
  const t = ((a.x - p.x) * d2y - (a.y - p.y) * d2x) / den;
  const u = ((a.x - p.x) * d1y - (a.y - p.y) * d1x) / den;
  return t > EPS_PARAM && t < 1 - EPS_PARAM && u > EPS_PARAM && u < 1 - EPS_PARAM;
}

/** True iff the straight segment eye→target crosses any opaque footprint edge. */
function rayBlocked(eye: Vec2, target: Vec2, footprints: readonly OpaqueFootprint[]): boolean {
  for (const fp of footprints) {
    const poly = fp.polygon;
    const n = poly.length;
    for (let i = 0; i < n; i++) {
      const a = poly[i]!;
      const b = poly[(i + 1) % n]!;
      if (segmentsCross(eye, target, a, b)) return true;
    }
  }
  return false;
}

/**
 * The cast against a pre-resolved opaque set. Exposed so per-sample callers
 * (the SightCaster composed in solve/run.ts) can resolve footprints once per
 * scenario instead of once per sample. Semantics identical to sightFrom.
 */
export function castSight(
  road: ComposedRoad,
  eye: Vec2,
  footprints: readonly OpaqueFootprint[]
): SightCast {
  const sEye = road.project(eye.x, eye.y).s;
  const dCentre = -road.lane_width_m / 2; // own-lane centre (d ∈ [−W, 0] is the ride lane)

  let lastVisible = sEye;
  for (const st of road.stations) {
    if (st.s <= sEye + EPS_PARAM) continue; // targets strictly forward of the eye's station
    const target = road.worldAt(st.s, dCentre);
    if (rayBlocked(eye, target, footprints)) break; // first blocked — stop; re-emergence never counts
    lastVisible = st.s;
  }

  return {
    sight_m: lastVisible - sEye,
    limit_point: road.worldAt(lastVisible, dCentre),
    s_limit: lastVisible
  };
}

/**
 * sightFrom(road, eye, occluders) — the design/03 §5.1 signature. Pure; returns
 * no trend; takes no speed. `s_limit` falls back to the eye's own station
 * (sight_m = 0) when the very first forward target is blocked, and runs to
 * road end when nothing blocks.
 */
export function sightFrom(
  road: ComposedRoad,
  eye: { readonly x: number; readonly y: number },
  occluders: readonly ResolvedOccluder[]
): SightCast {
  return castSight(road, eye, footprintsOf(road, occluders));
}
