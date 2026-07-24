import type { RiderProfile, SsdBreakdown, SsdModel } from "../core/types.js";
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
export declare function ssd(v_ms: number, phi_rad: number, model: SsdModel, profile: RiderProfile, mu: number): SsdBreakdown;
