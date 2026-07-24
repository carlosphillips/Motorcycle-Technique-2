// core/resample.ts — the two-tier stepping handoff (design/02 §6, design/05
// §3): physics integrates in time; the RETAINED record is the resampled
// arc-grid series (one point each ds_m along the centreline, plus the final
// exact sample at termination). The raw 200 Hz series is integrator-internal
// working state — callers discard it after this pass.
//
// Per-field rules (02 §6, 05 §3.2):
// - numeric fields lerp between the two raw points bracketing the grid station;
// - angles (psi, phi, cmd_lean) are continuous internal radians, so plain lerp
//   IS shortest-arc lerp at raw-step granularity;
// - hold fields (mu, roll_rate, action_id, steer_state, lat_action_id) take the
//   left bracket's value;
// - boolean flags (below_validity, clipped) OR over the whole span of raw
//   points consumed since the previous retained point — a flag set anywhere in
//   the span survives retention (the dwell rule of 05 §6.3 relies on this);
// - lane fraction f is RECOMPUTED from the corridor algebra (road.fOf) at the
//   retained (d, s) — never lerped independently (drift risk #9);
// - the sight channels are cast fresh from the retained point's own (x, y)
//   (D4: the rider's actual position), not lerped.

import type { RoadModel, SightCaster } from "./types.js";
import type { RawPoint, RetainedPoint } from "./record.js";

function lerp(a: number, b: number, alpha: number): number {
  return a + (b - a) * alpha;
}

/** Attach the sight channels to one point (cast from its own eye position). */
function withSight(
  p: RawPoint & { readonly f: number },
  road: RoadModel,
  sight: SightCaster
): RetainedPoint {
  const cast = sight.cast({ x: p.x, y: p.y });
  const ssd = sight.ssd(p.v, p.phi, p.mu);
  return {
    ...p,
    sight_m: cast.sight_m,
    ssd_m: ssd.ssd_m,
    limit_x: cast.limit_point.x,
    limit_y: cast.limit_point.y,
    // provisional centreline-basis value; sight/analyze.ts (WP-07) rebases to
    // rider-path metres post-run (05 §2.1, D16)
    sight_ride_m: cast.sight_m
  };
}

/** Interpolate one retained point at grid station g from bracket [i, i+1]. */
function interpolate(
  raw: readonly RawPoint[],
  i: number,
  g: number,
  orClipped: boolean,
  orBelow: boolean,
  road: RoadModel
): RawPoint & { readonly f: number } {
  const a = raw[i]!;
  const b = raw[i + 1]!;
  const span = b.s - a.s;
  const alpha = span > 0 ? (g - a.s) / span : 0;
  const d = lerp(a.d, b.d, alpha);
  return {
    t: lerp(a.t, b.t, alpha),
    x: lerp(a.x, b.x, alpha),
    y: lerp(a.y, b.y, alpha),
    psi: lerp(a.psi, b.psi, alpha),
    v: lerp(a.v, b.v, alpha),
    phi: lerp(a.phi, b.phi, alpha),
    s: g,
    d,
    mu: a.mu,
    cmd_a: lerp(a.cmd_a, b.cmd_a, alpha),
    a_cmd_rate: lerp(a.a_cmd_rate, b.a_cmd_rate, alpha),
    a_long: lerp(a.a_long, b.a_long, alpha),
    clipped: orClipped,
    cmd_lean: lerp(a.cmd_lean, b.cmd_lean, alpha),
    roll_rate_dps: a.roll_rate_dps,
    action_id: a.action_id,
    steer_state: a.steer_state,
    lat_action_id: a.lat_action_id,
    su_sustained: lerp(a.su_sustained, b.su_sustained, alpha),
    su_transient: lerp(a.su_transient, b.su_transient, alpha),
    below_validity: orBelow,
    f: road.fOf(d, g)
  };
}

/**
 * Resample the raw series onto the ds_m arc grid, appending the final exact
 * sample at termination (raw's last point — already the bracketed crossing
 * state). `raw` must have ≥ 1 point with strictly non-decreasing t; s is
 * expected monotone over the run (forward riding), and grid stations that can
 * no longer be bracketed are skipped defensively.
 */
export function resample(
  raw: readonly RawPoint[],
  road: RoadModel,
  sight: SightCaster,
  ds: number
): RetainedPoint[] {
  if (raw.length === 0) return [];
  const out: RetainedPoint[] = [];
  const last = raw[raw.length - 1]!;

  let i = 0; // left bracket index, advances monotonically
  let spanStart = 0; // first raw index in the current retention span (for OR flags)
  for (let gi = 0; ; gi++) {
    const g = gi * ds;
    if (g > last.s + 1e-12) break;
    // advance the bracket so raw[i].s ≤ g < raw[i+1].s (or i is the last index)
    while (i + 1 < raw.length && raw[i + 1]!.s <= g) i++;
    let point: RawPoint & { readonly f: number };
    let consumedTo: number;
    if (i + 1 >= raw.length) {
      // grid station at/past the last raw point (termination) — take it
      // exactly, but still OR the boolean flags over the whole span consumed
      // since the previous retained point (02 §6: flags are OR-ed per bracket
      // in EVERY retention path; a blip strictly inside the final sub-bracket
      // must survive even when the terminal point coincides with the grid).
      const orFlags = orOver(raw, spanStart, raw.length - 1);
      point = {
        ...last,
        clipped: last.clipped || orFlags.clipped,
        below_validity: last.below_validity || orFlags.below,
        f: road.fOf(last.d, last.s),
        s: last.s
      };
      consumedTo = raw.length - 1;
    } else {
      const orFlags = orOver(raw, spanStart, i + 1);
      point = interpolate(raw, i, g, orFlags.clipped, orFlags.below, road);
      consumedTo = i;
    }
    out.push(withSight(point, road, sight));
    spanStart = consumedTo;
    if (i + 1 >= raw.length) break;
  }

  // final exact sample at termination (05 §3.1) — skip if the last grid point
  // already sits on it
  const lastRetained = out[out.length - 1];
  if (lastRetained === undefined || Math.abs(lastRetained.s - last.s) > 1e-12) {
    const orFlags = orOver(raw, spanStart, raw.length - 1);
    const terminal: RawPoint & { readonly f: number } = {
      ...last,
      clipped: last.clipped || orFlags.clipped,
      below_validity: last.below_validity || orFlags.below,
      f: road.fOf(last.d, last.s)
    };
    out.push(withSight(terminal, road, sight));
  }
  return out;
}

function orOver(
  raw: readonly RawPoint[],
  from: number,
  to: number
): { clipped: boolean; below: boolean } {
  let clipped = false;
  let below = false;
  for (let k = from; k <= to && k < raw.length; k++) {
    clipped = clipped || raw[k]!.clipped;
    below = below || raw[k]!.below_validity;
  }
  return { clipped, below };
}
