import type { RiderProfile, RiderProfileName } from "./types.js";
/** 9.81 m/s² — gravitational acceleration (00 §5: g = 9.81 m/s²). */
export declare const G = 9.81;
/** design/02 §3 rider profile table — all values TUNING. Frozen. */
export declare const RIDER_PROFILES: Readonly<Record<RiderProfileName, RiderProfile>>;
/** 2.5 m/s² — TUNING. Demand below this never stands the bike up. */
export declare const A_SU_ONSET = 2.5;
/** 0.30 (rad/s) per (m/s²) — TUNING. Sustained stand-up gain (driver: b_dem). */
export declare const K_SU = 0.3;
/** 0.12 rad per (m/s²) — TUNING. Transient impulse gain (re-derived; the carried 6.0 belonged to a degenerate one-step-impulse regime). */
export declare const K_CHOP = 0.12;
/** 8.0 m/s³ — TUNING. Command-drop rate that reads as a chop (carried; discriminates authored slews). */
export declare const RATE_THRESHOLD = 8;
/** 5.0 deg — TUNING. tanh envelope width (carried); saturated (> 0.96) above 10° lean. */
export declare const PHI0 = 5;
/** 6.0 m/s³ — TUNING. Default slew_mss on brake/throttle (03 §6.1); deliberately BELOW RATE_THRESHOLD. */
export declare const A_SLEW_DEFAULT = 6;
/** 1 m/s³ — schema bound on slew_mss (BAD_RANGE outside [SLEW_MIN, SLEW_MAX]). */
export declare const SLEW_MIN = 1;
/** 100 m/s³ — schema bound on slew_mss (BAD_RANGE outside [SLEW_MIN, SLEW_MAX]). */
export declare const SLEW_MAX = 100;
/** 5.0 s — TUNING. Upper bound on freeze_steer_s (03 §6.1); legal range (0, FREEZE_MAX_S]. */
export declare const FREEZE_MAX_S = 5;
/** 15 deg — TUNING. Invariant-2 domain floor (02 §5.4). */
export declare const PHI_WIDEN_MIN = 15;
/** 7.0 m/s — TUNING. Model-validity band (≈ 25 km/h; derived from the widening algebra, 02 §5.3). A flag (below_validity), never a termination. */
export declare const v_valid_min_ms = 7;
/** 0.25 deg — TUNING. unwind→track handoff (02 §3.1; one step of street roll authority). */
export declare const EPS_UNWIND_DONE_DEG = 0.25;
/** 1.0 deg — TUNING. Exit heading-capture deadband (02 §3.1; shared 01 §4.1). */
export declare const EPS_EXIT_DEG = 1;
/** 2.0 rad/s — TUNING. Lateral-tracker natural frequency (ζ = 1 fixed, not a knob). */
export declare const OMEGA_POS = 2;
/** 5.0 deg — TUNING. Tracker total-lean authority cap; atan(a_lat_pos_max/G) = 4.66° leaves the feedforward ~0.34° headroom. */
export declare const PHI_TRACK_AUTH_DEG = 5;
/** 0.8 m/s² — TUNING. Tracker lateral-accel budget (carried; normative home HERE, 03 references it). */
export declare const a_lat_pos_max = 0.8;
/** 0.05 m — = carried eps_m. Position completion tolerance (02 §3.1). */
export declare const EPS_POS_M = 0.05;
/** 0.05 m/s — TUNING. Position completion closure-rate tolerance (02 §3.1). */
export declare const EPS_POS_RATE = 0.05;
/** 1.2 (—) — TUNING. Position-reachability margin (03 §6.1 validation formula). */
export declare const K_REACH = 1.2;
/** 0.10 m — TUNING. Displacement below which a generated hold emits no wire action (04 §6). */
export declare const MIN_POS_DD_M = 0.1;
/** 0.01 f-units — TUNING. run_wide_detect outward-crossing deadband (02 §7; 04's corrective shot). */
export declare const eps_f_detect = 0.01;
/** 0.03 f-units — TUNING (carried). Corrective return tolerance; wide/runoff classification deadband (04). */
export declare const eps_f_save = 0.03;
/** 0.005 s — TUNING. Fixed integrator step (200 Hz). */
export declare const dt_s = 0.005;
/** 0.01 m/s — low-speed guard flooring v in kappa = G·tan(phi)/v² inside a stage; distinct from v_floor_ms. */
export declare const V_MIN_RHS = 0.01;
/** 0.5 m — resampled arc-grid spacing of the retained record (05 §3.1 marks it TUNING). */
export declare const ds_m = 0.5;
/** 2.0 m/s — NUMERICAL termination floor: below it the run terminates with an honest `stopped`. */
export declare const v_floor_ms = 2;
/** 120 s — runaway guard (no bookmark event). */
export declare const max_time_s = 120;
/** 5000 m — runaway guard (no bookmark event). */
export declare const max_dist_m = 5000;
/** 0.05 ° — carried. Crash deadband on phi > phiMax (cross-runtime verdict stability). */
export declare const eps_phi_deg = 0.05;
/** 1e-3 — carried. Crash deadband on ellipseMag > 1. */
export declare const eps_mag = 0.001;
/** 0.05 m — carried. Reporting tolerance. */
export declare const eps_m = 0.05;
/** 0.1 ° — carried. Reporting tolerance. */
export declare const eps_deg_report = 0.1;
/** 0.40 m — TUNING. Default bike_margin_m corridor inset (03 §2 names 02 as this constant's home). */
export declare const BIKE_MARGIN_DEFAULT_M = 0.4;
/** 0.08 f-fraction — TUNING. Apex hysteresis: a local min is accepted once f rises ≥ this before corner end / a new lower min. */
export declare const APEX_PROMINENCE_F = 0.08;
/** 5.0 m — TUNING. Accepted apexes closer than this merge, keeping the deeper (lower-f) one. */
export declare const APEX_MIN_SEP_M = 5;
