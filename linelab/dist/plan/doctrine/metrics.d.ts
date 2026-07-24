import type { Event, Sample, SightTrend } from "../../core/types.js";
import type { DoctrineCorner, DoctrineRecord } from "./types.js";
/**
 * design/01 §A.6 — the metric-vocabulary (code) version. Independent of any
 * pack's `version`; a pack binds against it via `requires_checks_version`.
 */
export declare const CHECKS_VERSION: 2;
/** design/01 §A.6, verbatim — the closed metric vocabulary of checks_version 2. */
export declare const METRIC_IDS: readonly ["apex_pct", "oio_fractions", "input_count", "steer_share", "throttle_legs", "taper_profile", "ellipse_max", "lean_max", "sight_deficit", "hold_wide_legs", "tracker_overdrive", "link_legs", "chain_extent", "flow_legs"];
export type MetricId = (typeof METRIC_IDS)[number];
/**
 * 1.5 deg — TUNING (design/01 §A.2). A steering input is a maximal rising run
 * of |cmd_lean| toward the corner's hand with rise > SI_HYST, measured on the
 * COMMANDED channel (stand-up disturbances and the exit unwind never count).
 * Also check 13's leg (c) extremum prominence bar.
 */
export declare const SI_HYST_DEG = 1.5;
/** The resolved corner window W_c and its bracketing events. */
export interface CornerWindow {
    readonly corner: DoctrineCorner;
    /** inclusive sample index range of W_c */
    readonly i0: number;
    readonly i1: number;
    /** m — W_c = [s(turn_in event for c), s(exit event for c, else corner end)] */
    readonly s_lo: number;
    readonly s_hi: number;
    readonly turn_in: Event | null;
    readonly exit: Event | null;
    /** m — centreline arc length L_c = s1 − s0 */
    readonly L_c: number;
}
/** Index of the retained sample nearest station s (ties → earlier). */
export declare function sampleIndexNearestS(samples: readonly Sample[], s: number): number | null;
/**
 * Resolve W_c (design/01 §A.2). Returns null when the line never rides the
 * corner (zero samples at/past s0 — the corner was not reached).
 * Fallbacks, documented: with no turn_in event the window opens at s0; with no
 * exit event it closes at corner end (or termination, whichever comes first) —
 * §A.2's "for a terminated line with no exit event, corner end".
 */
export declare function cornerWindow(record: DoctrineRecord, corner: DoctrineCorner): CornerWindow | null;
/**
 * §A.2 — steering inputs: maximal rising runs of |cmd_lean| toward the
 * corner's hand with rise > SI_HYST, on the COMMANDED channel. Returns the
 * runs as [startIdx, peakIdx] pairs (in sample-array indices).
 */
export declare function steeringInputRuns(record: DoctrineRecord, w: CornerWindow): readonly (readonly [number, number])[];
/** §A.2 — phi_c: max |cmd_lean| over the FIRST steering-input run in W_c (0 if none). */
export declare function committedLeanDeg(record: DoctrineRecord, w: CornerWindow): number;
/** §A.2 — steering_complete: first sample in W_c with |phi| ≥ 0.9·phi_c (delivered). */
export declare function steeringCompleteIndex(record: DoctrineRecord, w: CornerWindow, phiCDeg: number): number | null;
/** §A.2 — apex: argmin f over W_c; cum_dpsi_deg = hand-relative net Δψ from the entry boundary. */
export declare function apexArgmin(record: DoctrineRecord, w: CornerWindow): {
    readonly i: number;
    readonly s: number;
    readonly f: number;
    readonly cum_dpsi_deg: number;
};
/**
 * The corner's TOTAL sweep in degrees — §A.2's apex_pct denominator — resolved
 * honestly from the record, or refused (null). Two honest channels:
 *  (a) taper geometry (r1/r2 recorded on the corner row): EXACT — road tapers
 *      are r-linear-in-swept-angle (road/compose.ts closed forms; design/03
 *      §7a.3's dκ/ds derivation assumes the same), so L_c = Θ·(r1+r2)/2 and
 *      Θ = L_c / mean(r1, r2);
 *  (b) a COMPLETED corner (recorded exit event): MEASURED — the exit event is
 *      heading capture within EPS_EXIT_DEG (design/05 §4.1), so the line's own
 *      net Δψ from the entry boundary to the exit sample is road-faithful;
 *  (c) otherwise null — an early-terminated line on an arc measures only part
 *      of the road's sweep, and the DoctrineCorner row carries no angle, so
 *      the §A.2 denominator is not computable from this record. The caller
 *      refuses with a typed na (design/01 §8: refusal over fabrication) —
 *      it never invents a 0 % apex.
 */
export declare function cornerSweepDeg(record: DoctrineRecord, w: CornerWindow): number | null;
/**
 * §A.2 — the exit sample: the sample at the RECORDED exit event; for a
 * chain-mode corner the link station (the s1 handoff) instead; for a
 * terminated line with no exit event, corner end.
 */
export declare function exitSampleIndex(record: DoctrineRecord, w: CornerWindow, chainMode: boolean): number | null;
/**
 * §A.2 — blind(c) ⇔ at c's turn_in event, s_limit < s_end(c). Per design/03
 * §5.1, sight_m = s_limit − s_eye, so s_limit = s + sight_m at the turn-in
 * sample. Returns null when the line has no turn_in event for c (the predicate
 * is per-line and undefined without a commitment).
 */
export declare function blindAtTurnIn(record: DoctrineRecord, corner: DoctrineCorner): boolean | null;
/**
 * design/05 §4 — sight_trend at sample i, windowed and deadbanded: compare
 * sight_m[i] against sight_m at the sample nearest s_i − SIGHT_TREND_WINDOW_M
 * (clamped to the first sample early on).
 */
export declare function sightTrendAt(samples: readonly Sample[], i: number): SightTrend;
export interface ChainStructure {
    /** geometric chain pairs, as [cornerIdx, cornerIdx+1] into record.corners */
    readonly geometricPairs: readonly (readonly [number, number])[];
    /** subset of geometricPairs that are ridden-linked */
    readonly riddenPairs: readonly (readonly [number, number])[];
    /** ids of chain-mode corners (a corner with a ridden-linked successor) */
    readonly chainModeCornerIds: ReadonlySet<string>;
}
/**
 * geometric chain pair: the road's linked_next record (design/03 §2 measured
 * geometry). ridden-linked: geometric pair AND peak −cmd_a on the connecting
 * span ≤ link_brake_reset (pack data, threaded).
 */
export declare function chainStructure(record: DoctrineRecord, linkBrakeReset: number): ChainStructure;
/** Peak −cmd_a over samples with s ∈ [sFrom, sTo]; null when the span has no samples. */
export declare function peakBrakeOnSpan(record: DoctrineRecord, sFrom: number, sTo: number): number | null;
/**
 * 1. apex_pct — the recorded apex list + graded pct. `late_apex` reads the
 * FINAL apex's pct (design/05 §6.3), in every declared style; on a record with
 * an empty apex list (e.g. terminated early, or no dip prominent enough for
 * the ONE detector) the §A.2 argmin-f apex is the graded fallback while
 * `count` stays the recorded 0 (check 16's authority). The fallback pct is
 * measured honestly — cumΔψ(apex) over cornerSweepDeg — and is null when the
 * sweep denominator is not measurable from this record (the caller refuses
 * with a typed na; no fabricated 0 %).
 */
export declare function apexPct(record: DoctrineRecord, w: CornerWindow): {
    readonly count: number;
    readonly apexes_s: readonly number[];
    readonly graded_pct: number | null;
    readonly graded_s: number;
};
/** 2. oio_fractions — ti_f, apex_f, exit_f in the corner's hand-relative frame. */
export declare function oioFractions(record: DoctrineRecord, w: CornerWindow, chainMode: boolean, declaredDoubleApex: boolean): {
    readonly ti_f: number | null;
    readonly apex_f: number;
    readonly exit_f: number | null;
    readonly exit_s: number | null;
};
/** 3. input_count — steering inputs (§A.2 definition) in W_c. */
export declare function inputCount(record: DoctrineRecord, w: CornerWindow): number;
/**
 * 4. steer_share — the two-sided quick-steer measurements.
 *
 * When steering never completes inside the record (`sc_s: null`), the
 * returned `steer_share` is the ridden-extent LOWER BOUND — the §A.2 formula's
 * `s(steering_complete)` does not exist, and the record proves the roll-in
 * consumed every ridden metre of the corner and was still incomplete at line
 * end. The check evaluator grades that case `eats_corner` directly
 * [ADJUDICATED, ratification]: §A.3's own worked slow_steer arithmetic
 * (share ≈ 0.74 → fail) is kinematic — committed lean over the capped rate —
 * and §A.4 pins `quick_steer` as slow_steer's MANDATORY fail; a
 * pass-by-truncation would assert "steering completed within the bar" on a
 * record that proves it never completed at all.
 */
export declare function steerShare(record: DoctrineRecord, w: CornerWindow): {
    readonly phi_c_deg: number;
    readonly dt_steer_s: number | null;
    readonly steer_share: number;
    readonly sc_s: number | null;
};
/** 5. throttle_legs — the four Keith Code Rule #1 legs, commanded channel. */
export declare function throttleLegs(record: DoctrineRecord, w: CornerWindow, th: {
    readonly thr_eps: number;
    readonly crack_early_frac: number;
    readonly rollon_late_frac: number;
    readonly rate_threshold: number;
    readonly chop_tol: number;
    readonly small_lean_deg: number;
}): {
    readonly crack_ok: boolean;
    readonly vmin_ok: boolean;
    readonly rollon_ok: boolean;
    readonly discipline_ok: boolean;
    readonly detail: Readonly<Record<string, unknown>>;
};
/** 6. taper_profile — the trail-brake taper measurements (delivered −a_long). */
export declare function taperProfile(record: DoctrineRecord, w: CornerWindow, th: {
    readonly tb_phi_min: number;
    readonly redeepen_tol: number;
    readonly resid_frac: number;
    readonly a_su_onset: number;
}): {
    readonly baseline: boolean;
    readonly forced_standup_at_s: number | null;
    readonly redeepened_at_s: number | null;
    readonly resid_exceeded: boolean;
    readonly ate_reserve_at_s: number | null;
};
/** 7. ellipse_max — max ellipseMag over W_c (ellipseMag = 1 − grip) + crash-in-window. */
export declare function ellipseMax(record: DoctrineRecord, w: CornerWindow): {
    readonly max_mag: number;
    readonly at_s: number;
    readonly crash_in_window: boolean;
};
/** 8. lean_max — max |phi| over W_c. */
export declare function leanMax(record: DoctrineRecord, w: CornerWindow): {
    readonly phi_max_deg: number;
    readonly at_s: number;
};
/** 10. sight_deficit — deficit(s) = ssd_m − sight_ride_m at every sample (D16 basis). */
export declare function sightDeficit(record: DoctrineRecord): {
    readonly max_deficit_m: number;
    readonly min_margin_m: number;
    readonly worst: {
        readonly s: number;
        readonly v: number;
        readonly phi: number;
    } | null;
};
/** 11. hold_wide_legs — release station + hold-window wide-line discipline. */
export declare function holdWideLegs(record: DoctrineRecord, w: CornerWindow, th: {
    readonly hold_window_frac: number;
    readonly release_tol_m: number;
}): {
    readonly release_s: number | null;
    readonly turn_in_s: number;
    readonly min_f_nonopening: number | null;
};
/**
 * 12. tracker_overdrive — tracker excess (su-compensated) + teleport guards.
 *
 * The two teleport guards (KAPPA_STEP, PHI_JUMP) read the Δt → 0 regime —
 * adjacent retained samples with (near-)coincident time — and ONLY that regime
 * [ADJUDICATED, ratification]. Design/01 §A.3 check 12 groups them as
 * "(carried teleport guards)" under the claim "no tracker overdrive /
 * kinematic teleport", and the carried v1 text glosses the kappa leg as "a
 * discontinuous path … with near-zero dt". At finite Δt the guards can carry
 * no information the excess leg does not already police: `kappa` is the
 * DERIVED column g·tan(phi)/v² (05 §2.1), so a finite-Δt kappa step is fully
 * determined by the phi step (leg 1's business, su-compensated) and the v step
 * (the slew law's business). Read on the 0.5 m grid instead, KAPPA_STEP = 0.01
 * becomes a speed floor — a profile-rate roll steps Δκ = 0.5·g·ω·sec²φ/v³,
 * i.e. fails below 27.1 km/h upright and 29.9 km/h at 30° lean (street
 * 50°/s) — which the design's own doctrinally-correct fixtures sit under
 * (bookDecreasing's exit unwind ≈ 6.9 m/s → Δκ ≈ 0.017; the bookEsses chain's
 * governed flicks ≤ 9 m/s), making 09 §4's A-CHAIN-GREEN and F-ORACLE-DR's
 * "good line = the default solve" unsatisfiable while check 4 simultaneously
 * mandates the full-rate roll the guard would punish. One reading satisfies
 * every binding surface; the other contradicts the catalogue's own gates.
 */
export declare function trackerOverdrive(record: DoctrineRecord): {
    readonly max_excess_dps: number;
    readonly excess_at_s: number | null;
    readonly max_dkappa: number;
    readonly dkappa_at_s: number | null;
    readonly phi_jump_deg: number;
    readonly phi_jump_at_s: number | null;
};
/** 13. link_legs — the three link-continuity legs for one geometric pair. */
export declare function linkLegs(record: DoctrineRecord, c: DoctrineCorner, next: DoctrineCorner): {
    readonly entry_f: number | null;
    readonly peak_brake: number | null;
    readonly extrema_count: number;
    /** kind of each counted extremum, in span order — leg (c) reads whether the one tolerated extremum is the flick minimum */
    readonly extrema_kinds: readonly ("min" | "max")[];
    readonly hands_alternate: boolean;
};
/** 14. chain_extent — max/min f over the chain span. */
export declare function chainExtent(record: DoctrineRecord, sFrom: number, sTo: number): {
    readonly max_f: number;
    readonly min_f: number;
    readonly worst_s: number;
    readonly worst_side: "outside" | "inside";
};
/** 15. flow_legs — slow-in per chained corner, gap throttle discipline, rhythm. */
export declare function flowLegs(record: DoctrineRecord, chainCorners: readonly CornerWindow[], smallLeanDeg: number): {
    readonly vmin_ok: boolean;
    readonly gap_ok: boolean;
    readonly rhythm_sign_changes: number;
    readonly hand_alternations: number;
};
