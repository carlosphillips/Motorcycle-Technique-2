// core/units.ts — the ONLY conversion helpers (ARCHITECTURE §6.1; drift risk #1).
// Any formula touching roll_rate or record angles converts via these — never an
// inline `* Math.PI / 180`. Display units (km/h) are computed only at
// derived/emission/CLI layers, through these same helpers.

import type { Hand } from "./types.js";

/**
 * The single sign-conversion point (design/02 §2): world frame is y-down/x-east,
 * `+kappa` = right-hand turn, `phi`/`cmd_lean` positive = right lean.
 * `handSign("R") = +1`, `handSign("L") = −1`. Occluder `sideSign`
 * (road/corridor.ts) imports this — it is never re-derived.
 */
export function handSign(h: Hand): 1 | -1 {
  return h === "R" ? 1 : -1;
}

/** degrees → radians. */
export function degToRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** radians → degrees. */
export function radToDeg(rad: number): number {
  return (rad * 180) / Math.PI;
}

/** km/h → m/s (exact: ÷ 3.6). */
export function kmhToMs(kmh: number): number {
  return kmh / 3.6;
}

/** m/s → km/h (exact: × 3.6). */
export function msToKmh(ms: number): number {
  return ms * 3.6;
}
