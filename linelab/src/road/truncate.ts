// road/truncate.ts — truncateAt(roadSpec, s) → Result<roadSpec> (design/03 §7a.4).
// Built in v0.1: §7a.11 names it "a road-layer primitive", explicitly NOT gated
// behind the D45 spike (ARCHITECTURE §10.7).
//
// Walk segments accumulating length, drop everything past s, split the segment
// containing s at local length ℓ = s − s0_seg:
//
//   straight len            len := ℓ
//   arc r ^θ  (L = r·θ_rad) θ := θ · ℓ/L
//   taper r1>r2 ^θ          r linear in swept angle: r(t) = r1 + (r2−r1)t,
//                           L(t) = θ_rad·t·(r1 + r(t))/2. Solve
//                           (r2−r1)·θ_rad·t²/2 + r1·θ_rad·t − ℓ = 0 for t ∈ (0,1],
//                           then θ := θ·t, r2 := r(t)
//
// `hand` and `lane_width_m` carry through unchanged; fragments shorter than
// MIN_SEG_M are dropped. The spliced result is an ordinary roadSpec: composing
// it re-runs TAPER_RATIO_MIN classification and the super-tight refusal on the
// fragments (the §7a.4 edge surface).

import type { Result } from "../core/result.js";
import { ok, err } from "../core/result.js";
import { degToRad, radToDeg } from "../core/units.js";
import type { RoadSpec, Segment, SegmentsRoadSpec } from "./types.js";
import { normalizeRoadSpec } from "./compose.js";
import { MIN_SEG_M } from "./constants.js";

function segLen(seg: Segment): number {
  if (seg.type === "straight") return seg.len_m;
  if (seg.type === "arc") return seg.r_m * degToRad(seg.angle_deg);
  return (degToRad(seg.angle_deg) * (seg.r1_m + seg.r2_m)) / 2;
}

/** Split one segment at local arc length ℓ ∈ (0, len), per the §7a.4 table. */
function splitSegment(seg: Segment, ell: number): Segment {
  if (seg.type === "straight") {
    return { type: "straight", len_m: ell };
  }
  if (seg.type === "arc") {
    const L = seg.r_m * degToRad(seg.angle_deg);
    return { ...seg, angle_deg: seg.angle_deg * (ell / L) };
  }
  const thetaRad = degToRad(seg.angle_deg);
  const { r1_m: r1, r2_m: r2 } = seg;
  if (r1 === r2) {
    // degenerate taper is an arc: θ := θ·ℓ/L
    const L = r1 * thetaRad;
    return { ...seg, angle_deg: seg.angle_deg * (ell / L) };
  }
  // (r2−r1)·θ_rad·t²/2 + r1·θ_rad·t − ℓ = 0, t ∈ (0,1]
  const b = (r2 - r1) * thetaRad;
  const t = (-r1 * thetaRad + Math.sqrt(r1 * r1 * thetaRad * thetaRad + 2 * b * ell)) / b;
  const rT = r1 + (r2 - r1) * t;
  return {
    type: "taper",
    r1_m: r1,
    r2_m: rT,
    angle_deg: radToDeg(thetaRad * t),
    hand: seg.hand
  };
}

/**
 * truncateAt(roadSpec, s) → Result<roadSpec>. Accepts any member of the road
 * union (presets/DSL are expanded first) and returns the segments-form spec.
 * `s` at/past the road end returns the (normalized) spec unchanged — there is
 * nothing past `s` to drop. `s ≤ 0` (an empty road) rejects BAD_RANGE.
 */
export function truncateAt(spec: RoadSpec, s: number): Result<SegmentsRoadSpec> {
  const norm = normalizeRoadSpec(spec);
  if (!norm.ok) return norm;
  const { lane_width_m, segments } = norm.value;
  // carry through exactly what the author spelled (defaults stay implicit)
  const bike_margin_m = spec.bike_margin_m;
  const use_full_width = spec.use_full_width;

  if (!Number.isFinite(s) || s <= 0) {
    return err({
      code: "BAD_RANGE",
      at: "truncateAt.s",
      message: `truncation station must be > 0 (got ${s})`,
      detail: { reason: "truncate_outside_road", s }
    });
  }

  const kept: Segment[] = [];
  let acc = 0;
  for (const seg of segments) {
    const len = segLen(seg);
    if (s >= acc + len) {
      kept.push(seg); // wholly before (or ending exactly at) s
      acc += len;
      continue;
    }
    const ell = s - acc; // s strictly inside this segment: 0 ≤ ℓ < len
    if (ell >= MIN_SEG_M) kept.push(splitSegment(seg, ell));
    break; // everything past s drops
  }

  if (kept.length === 0) {
    return err({
      code: "BAD_RANGE",
      at: "truncateAt.s",
      message: `truncating at s = ${s} leaves no road (first fragment < MIN_SEG_M = ${MIN_SEG_M} m)`,
      detail: { reason: "truncate_outside_road", s }
    });
  }

  return ok(
    Object.freeze({
      lane_width_m,
      ...(bike_margin_m !== undefined ? { bike_margin_m } : {}),
      ...(use_full_width !== undefined ? { use_full_width } : {}),
      segments: Object.freeze(kept)
    })
  );
}
