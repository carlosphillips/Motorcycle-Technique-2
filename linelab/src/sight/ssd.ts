// sight/ssd.ts — THE one lean-aware stopping-sight-distance definition
// (design/03 §5.2, D15). Every consumer imports THIS function: the per-sample
// ssd_m channel, the stop_within_sight check (check 10), and the V1 visibility
// governor (design/04 §6). Restating it anywhere is drift risk #10.
//
//   react_m  = v · t_react              // model reaction time; no braking
//   t_su     = |phi| / roll_rate        // stand-up: roll to upright at the
//                                       //   EFFECTIVE profile rate (02 §3)
//   a_lean   = min(a_ssd, aLongAvail(G·tan|phi|, mu), a_noreturn(phi))
//   if v ≤ a_lean·t_su:  standup_m = v²/(2·a_lean);  brake_m = 0   // stops mid-roll-up
//   else:                v_up      = v − a_lean·t_su
//                        standup_m = v·t_su − a_lean·t_su²/2
//                        brake_m   = v_up² / (2·a_ssd)             // upright full-rate
//   ssd_m = react_m + standup_m + brake_m
//
// Normative properties (design/03 §5.2):
// - Upright reduction: at phi = 0 this reduces EXACTLY to the carried
//   v·t_react + v²/(2·a_ssd).
// - Conservative: a_lean is evaluated at the INITIAL lean and held for the whole
//   stand-up phase, though availability only grows as the bike rolls up. Disclosed.
// - Monotone: ssd_m non-decreasing in |phi|, continuous at phi = 0.
// - Worked example (street, alert, v = 13 m/s, phi = 28°): a_lean = 5.41 (the
//   a_noreturn cap binds), t_su = 0.56 s, ssd_m ≈ 26.5 m vs 25.1 m upright.

import { G, A_SU_ONSET, K_SU, PHI0 } from "../core/constants.js";
import { degToRad, radToDeg } from "../core/units.js";
import { SSD_MODEL_TABLE } from "./constants.js";
import type { RiderProfile, SsdBreakdown, SsdModel } from "../core/types.js";

// ---------------------------------------------------------------------------
// Private closed forms from design/02 (§5.2 friction ellipse, §5.3 a_noreturn).
// Their canonical EXPORTED home is core/ (WP-04: core/slice.ts and the friction
// family) — which builds AFTER this package (ARCHITECTURE §8 order: WP-03 before
// WP-04). They are kept module-PRIVATE here so exactly one exported definition
// of each will exist once core lands; the constants (A_SU_ONSET, K_SU, PHI0, G)
// are imported from their one home, never re-declared.

/** design/02 §5.2: longitudinal decel available at lateral demand a_lat under friction mu. */
function aLongAvailLocal(a_lat: number, mu: number): number {
  const cap = mu * G;
  const ratio = a_lat / cap;
  return cap * Math.sqrt(Math.max(0, 1 - ratio * ratio));
}

/**
 * design/02 §5.3: the controllable stand-up decel ceiling,
 * A_SU_ONSET + roll_rate / (K_SU · tanh(|phi_deg| / PHI0)). Upright (phi = 0)
 * the tanh envelope vanishes and the cap is +Infinity (no stand-up demand).
 */
function aNoReturnLocal(phi_rad: number, roll_rate_rad_s: number): number {
  const t = Math.tanh(radToDeg(Math.abs(phi_rad)) / PHI0);
  if (t <= 0) return Number.POSITIVE_INFINITY;
  return A_SU_ONSET + roll_rate_rad_s / (K_SU * t);
}

/**
 * ssd(v_ms, phi_rad, model, profile, mu) → {ssd_m, react_m, standup_m, brake_m}
 * (design/03 §5.2, verbatim signature).
 *
 * `profile` is the EFFECTIVE rider profile: everywhere the stand-up phase reads
 * the roll rate it reads roll_rate_eff = min(profile rate, rider.roll_rate_cap_dps)
 * (design/02 §3) — callers with a wire cap pass a profile whose roll_rate_dps
 * already carries the min. Entry-speed capping elsewhere is upright (phi = 0).
 * Preconditions (engine-guaranteed): v_ms ≥ 0, mu > 0, roll_rate_dps > 0.
 */
export function ssd(
  v_ms: number,
  phi_rad: number,
  model: SsdModel,
  profile: RiderProfile,
  mu: number
): SsdBreakdown {
  const { a_ssd, t_react_s } = SSD_MODEL_TABLE[model];
  const react_m = v_ms * t_react_s;

  const absPhi = Math.abs(phi_rad);
  const roll_rate = degToRad(profile.roll_rate_dps);
  const t_su = absPhi === 0 ? 0 : absPhi / roll_rate;
  const a_lean = Math.min(
    a_ssd,
    aLongAvailLocal(G * Math.tan(absPhi), mu),
    aNoReturnLocal(phi_rad, roll_rate)
  );

  let standup_m: number;
  let brake_m: number;
  if (v_ms <= a_lean * t_su) {
    // stops mid-roll-up (a_lean > 0 whenever v_ms > 0 on this branch)
    standup_m = a_lean > 0 ? (v_ms * v_ms) / (2 * a_lean) : 0;
    brake_m = 0;
  } else {
    const v_up = v_ms - a_lean * t_su;
    standup_m = v_ms * t_su - (a_lean * t_su * t_su) / 2;
    brake_m = (v_up * v_up) / (2 * a_ssd);
  }

  return { ssd_m: react_m + standup_m + brake_m, react_m, standup_m, brake_m };
}
