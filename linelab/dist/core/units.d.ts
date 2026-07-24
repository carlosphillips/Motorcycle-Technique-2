import type { Hand } from "./types.js";
/**
 * The single sign-conversion point (design/02 §2): world frame is y-down/x-east,
 * `+kappa` = right-hand turn, `phi`/`cmd_lean` positive = right lean.
 * `handSign("R") = +1`, `handSign("L") = −1`. Occluder `sideSign`
 * (road/corridor.ts) imports this — it is never re-derived.
 */
export declare function handSign(h: Hand): 1 | -1;
/** degrees → radians. */
export declare function degToRad(deg: number): number;
/** radians → degrees. */
export declare function radToDeg(rad: number): number;
/** km/h → m/s (exact: ÷ 3.6). */
export declare function kmhToMs(kmh: number): number;
/** m/s → km/h (exact: × 3.6). */
export declare function msToKmh(ms: number): number;
