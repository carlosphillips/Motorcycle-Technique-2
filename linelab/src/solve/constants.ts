// solve/constants.ts — design/04-owned named constants (ARCHITECTURE §6.6: one
// constants.ts per owning module; cross-module use IMPORTS, never re-declares).
//
// This file is built in sections by work package. WP-08 owns the corrective/
// counterfactual section below; WP-10 APPENDS the solver-search constants
// (N_SWEEP, SWEEP_*, brackets, lean_frac, exit_target, DA_*, LINKED_EXIT_F_*,
// N_PROBE, KISS_TOL_F, vis defaults, …) in its own marked section.

// ===========================================================================
// WP-08 section — corrective shot + counterfactual layer (design/04 §4a, §4c)
// ===========================================================================

/**
 * 1.0 (f-units) — design/04 §4a.2: the outer usable edge the run_wide_detect
 * predicate fires through ("definitional, not TUNING").
 */
export const F_DETECT = 1.0;

/**
 * 1.0 (f-units) — design/04 §4a.5: back inside the outer usable edge (the
 * corrective shadow's return threshold).
 */
export const F_SAVE = 1.0;

// The companion deadbands eps_f_detect (0.01, TUNING) and eps_f_save (0.03,
// carried TUNING) are 02-OWNED constants (design/02 §5.2 consolidated table
// rows; "margins owned by the corrective shot" cites them there) and are
// declared once in core/constants.ts. They are RE-EXPORTED here — an import,
// not a re-declaration (§6.6) — because design/04 §4a states them beside
// F_DETECT/F_SAVE and solve-rank consumers read them as one family.
export { eps_f_detect, eps_f_save } from "../core/constants.js";

// Reaction/latency defaults: the corrective shot's recognition delay is the
// rider profile's t_react_s (design/02 §3, core/constants.ts RIDER_PROFILES);
// the counterfactual harness's `latency` argument is per-consumer ("0 or the
// profile's t_react_s", design/04 §4c.1). No solve-rank constant exists for
// either — declaring one here would shadow the 02-owned profile table.

// ===========================================================================
// WP-10 section — solver-search constants (design/04 §3–§6) — APPENDED BY WP-10
// ===========================================================================
// Values copied VERBATIM from design/04's constants table (§3, §4.1, §4.1a,
// §4.6, §4.8, §5, §5.1, §6). "TUNING" marks are the doc's own; constants
// without the mark are definitional or carried. Unnamed design literals get
// local names WITHOUT TUNING status (ARCHITECTURE §6.6: SUGGEST_TOPN,
// DA_GRID_N, DA_TI2_HALF_F, ROLLON_GUARD_M).

// --- §3 turn-in suggestion --------------------------------------------------

/** 12 candidates — TUNING. Coarse-sweep candidate count over the §4.1a span. */
export const N_SWEEP = 12;

/** 0.5 m — TUNING. Floor on sweep candidate spacing (drop candidates, keep span). */
export const SWEEP_STEP_MIN_M = 0.5;

/** 1.0 m — coarse-run retained-grid resolution ("a resolution, not a station"). */
export const COARSE_DS_M = 1.0;

/** 4 — unnamed design literal ("full-solve the top 4"), local name per §6.6. */
export const SUGGEST_TOPN = 4;

/**
 * Corner-type-aware apex targeting (design/04 §3 table — ALL values TUNING).
 * `target` is the ranking target `target_apex_pct(type)`; `band` the coarse
 * filter's plausible band [lo, hi] in % of swept angle.
 */
export const TARGET_APEX_TABLE = Object.freeze({
  constant: Object.freeze({ target: 58, band: Object.freeze([20, 90] as const) }),
  decreasing: Object.freeze({ target: 70, band: Object.freeze([62, 92] as const) }),
  increasing: Object.freeze({ target: 40, band: Object.freeze([15, 85] as const) })
} as const);

// --- §4.1 main-solve targets and brackets ------------------------------------

/** 0.70 — TUNING, carried. Apex-lean target = lean_frac × phiReserve(mu_use). */
export const lean_frac = 0.7;

/** 0.85 — TUNING, carried. Exit lane-fraction target `exit.f = exit_target`. */
export const exit_target = 0.85;

/** 2.4 m/s² — carried. Decel bracket lower bound (fit-clipped per §4.1a). */
export const DECEL_LO = 2.4;

/** 3.8 m/s² — carried. Decel bracket upper bound. */
export const DECEL_HI = 3.8;

/** 16 — bisection iterations per control (§4.1). */
export const BISECT_ITERS = 16;

// --- §4.1a derived stations (all fractions TUNING with these defaults) --------

/** 0.5 — TUNING. Backward turn-in sweep as a fraction of L_app. */
export const SWEEP_BACK_APP_F = 0.5;

/** 0.35 — TUNING. Backward turn-in sweep cap as a fraction of L_arc. */
export const SWEEP_BACK_ARC_F = 0.35;

/** 0.25 — TUNING. Forward turn-in sweep as a fraction of L_arc. */
export const SWEEP_FWD_F = 0.25;

/** 0.25 / 1.0 m / 6.0 m — TUNING. brake_gap = clamp(F·L_app, MIN, MAX). */
export const BRAKE_GAP_F = 0.25;
export const BRAKE_GAP_MIN_M = 1.0;
export const BRAKE_GAP_MAX_M = 6.0;

/** 2.0 m — TUNING. Minimum brake run after a previous corner's exit (§4.1a/§5). */
export const BRAKE_RUN_MIN_M = 2.0;

/** 0.25 / 2.0 m / 8.0 m — TUNING. crack_gap = clamp(F·L_arc, MIN, MAX). */
export const CRACK_GAP_F = 0.25;
export const CRACK_GAP_MIN_M = 2.0;
export const CRACK_GAP_MAX_M = 8.0;

/** 0.20 / 0.95 — TUNING. Roll-on bracket fractions of L_arc past s_ti. */
export const ROLLON_LO_F = 0.2;
export const ROLLON_HI_F = 0.95;

/** 1.0 m — unnamed design literal (`s_crack + 1.0 m` roll-on guard), local name per §6.6. */
export const ROLLON_GUARD_M = 1.0;

/** 2.0 m — TUNING. Sweep span below this after clamping → road_too_short. */
export const SWEEP_SPAN_MIN_M = 2.0;

/** 1.0 m — TUNING. Roll-on bracket width below this → road_too_short. */
export const BRACKET_MIN_M = 1.0;

/**
 * 2.2 m/s² — the solved plan's exit roll-on drive magnitude. The design leaves
 * the magnitude unstated (the CONTROL is the onset station, §4.1); local name
 * without TUNING status per §6.6. Chosen just below A_SU_ONSET (2.5, core) so
 * the sustained stand-up term is structurally inert on the solved exit drive,
 * yet strong enough that a post-apex onset can still swing the exit out to the
 * out-in-out shape on the wide canonical corner (C30) before the release
 * freezes the lane position.
 */
export const ROLLON_ACCEL_MS2 = 2.2;

/**
 * 12 m/s³ — the slew the solver authors on its canonical brake (and on the
 * maintenance crack that releases it). Local name without TUNING status (§6.6):
 * the §4.1a fit clip's constant-decel arithmetic assumes negligible ramp
 * losses, but at A_SLEW_DEFAULT (6) the slew-chase ramp-in deficit
 * ≈ v₀·decel²/slew wipes ~20 % of C30's braking budget — the canonical corner
 * could not brake "to a solved entry speed near 50 km/h" (02 §8) inside the
 * carried [2.4, 3.8] bracket at all. 12 is the gentlest round value whose
 * losses keep the §4.1a arithmetic satisfiable there; both brake ramps run
 * upright (tanh envelope 0), so the transient stand-up term stays inert, and
 * the release ramp is a POSITIVE rate the chop trigger ignores.
 */
export const SOLVER_BRAKE_SLEW_MSS = 12;

// --- §4.6 solveDoubleApex (declared here — 04-owned; WP-11 consumes) ----------

/** 120° — TUNING. Window qualification: total sweep ≥ this. */
export const DA_SWEEP_MIN_DEG = 120;

/** 4 — TUNING. Ascending decel scan values. */
export const N_DA_DECEL = 4;

/** 5 — unnamed design literal (both placement grids), local name per §6.6. */
export const DA_GRID_N = 5;

/** 55 — TUNING. TI2 grid centre, % of cumulative window sweep. */
export const DA_TI2_PCT = 55;

/** 0.15 — unnamed design literal (`± 0.15·L_arc` TI2 half-width), local name per §6.6. */
export const DA_TI2_HALF_F = 0.15;

/** 1.0 m/s² — TUNING. Mid-drive throttle between the touches. */
export const DA_MID_ACCEL = 1.0;

/** 25 / 80 — TUNING. Touch-percent targets; filter bands ± 15 / ± 12. */
export const DA_APEX1_PCT = 25;
export const DA_APEX2_PCT = 80;
export const DA_APEX1_TOL = 15;
export const DA_APEX2_TOL = 12;

/** 3 — TUNING. Fine re-solve count. */
export const N_DA_FINE = 3;

/** 0.25 — TUNING. Touch depth: local minimum with f_min ≤ this. */
export const DA_TOUCH_F_MAX = 0.25;

/** 0.25 — TUNING. Touch prominence; minima with prominence < 0.05 noise-ignored. */
export const DA_PROMINENCE_F = 0.25;
export const DA_PROMINENCE_NOISE = 0.05;

/** 25 % — TUNING. Touch separation as a percent of window sweep. */
export const DA_TOUCH_SEP_PCT = 25;

// --- §4.8 acceptance ----------------------------------------------------------

/** 4 — TUNING. best_failing must full-solve at least this many turn-in candidates. */
export const BEST_FAILING_MIN_CANDIDATES = 4;

// --- §5 chained solving (declared here — 04-owned; WP-11 consumes) ------------

/** 0.15 — TUNING. Linked exit target when the next corner's hand differs. */
export const LINKED_EXIT_F_OPP = 0.15;

/** 0.90 — TUNING. Linked exit target when the next corner's hand matches. */
export const LINKED_EXIT_F_SAME = 0.9;

// --- §5.1 compile-time lean probes -------------------------------------------

/** 8 — TUNING. Max forward engine shots for a lean derivation. */
export const N_PROBE = 8;

/** 0.05 — TUNING. The kiss band: committed lean has min f ∈ [0, KISS_TOL_F]. */
export const KISS_TOL_F = 0.05;

// --- §6 visibility-governed mode knobs (authorable; WP-11 consumes) -----------

/** 0.9 — TUNING (authorable). Lane fraction V2 holds until release. */
export const VIS_HOLD_F_DEFAULT = 0.9;

/** 1.0 — TUNING (authorable). Sight-margin factor: vis_margin·ssd ≤ sight_ride_m. */
export const VIS_MARGIN_DEFAULT = 1.0;

/** 4 — TUNING, carried. Visibility-mode solve-pass bound. */
export const VIS_MAX_ITERATIONS = 4;

// ===========================================================================
// WP-22 section — reserve-lean save window (design/04 §4b, D44) — APPENDED BY
// WP-22. Values copied VERBATIM from design/04 §4b.5's constants block.
// Everything the family governs is out-of-hash, off by default, and enters no
// verdict, no check, no figure (§4b's own phase law).
// ===========================================================================

/**
 * 2.0 s — TUNING. Scan-domain tail past the corner's exit event, so an
 * exit-straight departure attributed to that corner stays in domain (§4b.5).
 */
export const TAU_TAIL_S = 2.0;

/**
 * 0.5 m — TUNING. Save-window scan resolution over the retained arc grid.
 * Bound by the §4b.5 resolution law: HORIZON_SCAN_DS_M / v_max must not exceed
 * HORIZON_TAU_QUANTUM_S over the scan domain (the retired 2.0 m violated it).
 */
export const HORIZON_SCAN_DS_M = 0.5;

/** 0.02 s — TUNING. Bisection stop tolerance (JSON precision) for tau_close_s. */
export const HORIZON_EPS_S = 0.02;

/** 1 — decimal places; clamps every human-facing save-window string. */
export const HORIZON_DISPLAY_DP = 1;

/**
 * 0.1 s — definitional: 10^(−HORIZON_DISPLAY_DP) seconds. Kept separate from
 * HORIZON_DISPLAY_DP because one is a count and the other a duration —
 * comparing a step in seconds against a count of decimal places is the type
 * error this pair exists to prevent (§4b.5).
 */
export const HORIZON_TAU_QUANTUM_S = 0.1;

/** 8 — iterations, hard cap on the resolved-status bisection (deterministic termination). */
export const HORIZON_BISECT_MAX = 8;
