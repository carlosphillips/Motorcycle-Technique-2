import type { LinelabError, Result } from "../core/result.js";
import type { Hand, ResolvedScenario, Trajectory } from "../core/types.js";
import type { CfRefusal, CfShadowDocument } from "./counterfactual.js";
import type { CorrectiveBlock } from "./corrective.js";
export declare const SAVEAT_BINDING: Readonly<{
    readonly rider: "lean_only_reserve";
    readonly predicate: "horizon_bounded_return";
}>;
export declare const SAVE_WINDOW_STATUSES: readonly ["resolved", "open_at_end", "never_open", "intermittent", "not_applicable"];
export type SaveWindowStatus = (typeof SAVE_WINDOW_STATUSES)[number];
export declare const SAVE_WINDOW_PLACARD: string;
/**
 * One sentence per `status` (04 §4b.7: "`intermittent` and `never_open` are
 * first-class results with their own sentences, not error states"). The
 * `intermittent` sentence is 04 §4b.5's own stepper wording verbatim, with `N`
 * substituted; the rest are composed from §4b.5/§4b.6 and 07 §3.6. Declared
 * HERE, once, so the HUD row, the CLI human summary and `explain` all print the
 * SAME sentence — the drift `A-SAVEWIN-PLACARD` exists to forbid.
 */
export declare const SAVE_WINDOW_STATUS_SENTENCES: Readonly<Record<SaveWindowStatus, string>>;
/** Display precision (04 §4b.5): every human-facing string clamps to HORIZON_DISPLAY_DP. */
export declare function horizonDisplay(x: number): string;
/** The §4a.4 policy disclosure block — always present, including on refusals. */
export interface SaveWindowPolicy {
    readonly target_phi_deg: number;
    readonly roll_rate_dps: number;
    readonly a_cmd_ms2: 0;
    readonly basis: "phiReserve(skill·mu)";
}
/**
 * The SaveWindow record (04 §4b.7). Disclosure survives every refusal:
 * `rider`, `predicate`, `policy`, `status`, `transition_count` and `placard`
 * are present on EVERY SaveWindow — only the derived scalars are suppressed
 * (`intermittent` and `never_open` carry none of `tau_close_s`, `s_close_m`,
 * `reaction_budget_s`; P-SAVEWIN-REFUSES asserts the absence structurally).
 */
export interface SaveWindow {
    readonly line_id: string;
    readonly corner_id: string;
    /** 04 §4c registry id — always present */
    readonly rider: typeof SAVEAT_BINDING.rider;
    /** 04 §4c CfPredicate id — always present */
    readonly predicate: typeof SAVEAT_BINDING.predicate;
    readonly status: SaveWindowStatus;
    /** disclosure, always present */
    readonly policy: SaveWindowPolicy;
    readonly tau_close_s?: number;
    readonly s_close_m?: number;
    readonly s_star_m?: number;
    readonly open_at_end?: boolean;
    readonly t_detect_s?: number;
    readonly t_shot_s?: number;
    /** emitted when the line's mistake spec carries a freeze, omitted otherwise */
    readonly t_freeze_end_s?: number;
    readonly t_earliest_s?: number;
    /** = tau_close_s − t_earliest_s; sign is outcome-consistent (§4b.6) */
    readonly reaction_budget_s?: number;
    /** rider profile t_react_s, for the comparison */
    readonly react_profile_s?: number;
    readonly transition_count: number;
    readonly scan_ds_m: number;
    readonly eps_s: number;
    /** shadow runs actually integrated — budget disclosure (C-SAVEWIN-BUDGET) */
    readonly runs: number;
    /** the §4b.7 sentence, verbatim */
    readonly placard: string;
}
/** saveAt's result (04 §4b.2): one probe, one bit, one return station. */
export interface SaveAtResult {
    readonly saved: boolean;
    /**
     * The probe document (rider/predicate-stamped, out-of-hash). A saved probe
     * is clipped at the first retained sample at or past s* — the reserve-lean
     * shadow is a probe over a bounded station horizon, not a trajectory a rider
     * would ride to completion, and the design asserts nothing about it past s*
     * (04 §4b.4; the 07 §3.6 overlay draws its final vertex AT s*,
     * C-SAVEWIN-CLIP).
     */
    readonly shadow: CfShadowDocument;
    readonly s_star_m: number | null;
}
/** The `--scan-ds` hook (v0.2 verb wiring); default = HORIZON_SCAN_DS_M. */
export interface SaveWindowOptions {
    readonly scan_ds_m?: number;
}
export interface SaveWindowCornerRow {
    readonly id: string;
    readonly hand: Hand;
    /** null ⇔ the shot was never attempted for this corner (04 §4a) */
    readonly corrective: CorrectiveBlock | null;
}
export interface SaveWindowInput {
    readonly line_id: string;
    readonly trajectory: Trajectory;
    readonly resolved_scenario: ResolvedScenario;
    readonly verdict: {
        readonly corners: readonly SaveWindowCornerRow[];
    };
}
/**
 * saveAt(line, corner, tau) → Result<{saved, shadow, s_star_m}> (04 §4b.2).
 *
 * A named thin wrapper over `counterfactual` under this file's declared
 * binding — no second harness, no second controller. Controller from §4a.4 BY
 * REFERENCE; success predicate = the §4b.3 station horizon carried from the
 * main line: the first bracketed s* ≥ max(s_detect, s(tau)) back inside the
 * corridor (f ≤ F_SAVE + eps_f_save), with any off_road | crash | stopped at
 * or before s* failing the probe. saved(t_shot) ≡ corrective.feasible holds by
 * construction (P-SAVEWIN-ANCHOR is a regression test, not a premise).
 */
export declare function saveAt(line: SaveWindowInput, cornerId: string, tau_s: number): Result<SaveAtResult, CfRefusal | LinelabError>;
/**
 * saveWindow(lineResult, cornerId?) → Result<SaveWindow | SaveWindow[]>
 * (04 §4b.7). Pure, synchronous, frozen output, Result-typed — the exact shape
 * and API tier correctiveShot(lineResult) already occupies (08 §7.1).
 *
 * Re-runs the §4a.4 fixed policy from other start instants over the §4b.5
 * scan: domain clamped τ ≥ t_freeze_end, grid decimated to scan_ds_m with the
 * mandatory points {t_detect, t_shot, t_freeze_end} and both endpoints, the
 * normative resolution law scan_ds_m / v_max ≤ HORIZON_TAU_QUANTUM_S (refusal
 * SCHEMA/scan_ds_too_coarse), and the closed five-status table, first-match-
 * wins. A non-monotone scan is `intermittent` — a refusal with NO scalar
 * (rider id, policy block and placard survive).
 *
 * Per corner the budget is ⌈domain_len / scan_ds_m⌉ + 5 grid runs plus at most
 * HORIZON_BISECT_MAX bisection runs, every probe horizon-bounded; `runs` is
 * emitted so the claim is auditable from the output (C-SAVEWIN-BUDGET).
 */
export declare function saveWindow(line: SaveWindowInput, cornerId: string, opts?: SaveWindowOptions): Result<SaveWindow, CfRefusal | LinelabError>;
export declare function saveWindow(line: SaveWindowInput, cornerId?: undefined, opts?: SaveWindowOptions): Result<readonly SaveWindow[], CfRefusal | LinelabError>;
/** The scalar lines of one window, display-clamped; empty on a refusing status. */
export declare function saveWindowScalarLines(w: SaveWindow): readonly string[];
/**
 * `saveWindowSummary(w)` — the CLI human summary for ONE window (stderr).
 * Disclosure first (rider / predicate / policy survive every refusal, §4b.5),
 * then the status sentence, then the display-clamped scalars, then the placard
 * verbatim.
 */
export declare function saveWindowSummary(w: SaveWindow): string;
/** The summary for a whole line's window list, one block per corner. */
export declare function saveWindowSummaryAll(ws: readonly SaveWindow[]): string;
