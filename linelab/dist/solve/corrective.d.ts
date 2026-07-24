import type { LinelabError, Result } from "../core/result.js";
import type { Corner, Event, Hand, ResolvedScenario, Trajectory } from "../core/types.js";
import type { CfRefusal, CfShadowDocument } from "./counterfactual.js";
export declare const CORRECTIVE_BINDING: Readonly<{
    readonly rider: "lean_only_reserve";
    readonly predicate: "return_after_detect";
}>;
/** The §4c.7 disclosure sentence corrective surfaces carry (re-exported home). */
export declare const CORRECTIVE_DISCLOSURE: string;
export declare const CORRECTIVE_FAIL_REASONS: readonly ["departed_before_reaction", "shadow_off_road", "shadow_crash", "no_return_before_road_end"];
export type CorrectiveFailReason = (typeof CORRECTIVE_FAIL_REASONS)[number];
export interface CorrectiveBlock {
    readonly feasible: boolean;
    /** the bracketed outward crossing on the MAIN line */
    readonly detect: {
        readonly s: number;
        readonly f: number;
    };
    /**
     * state at t_shot + the policy target. `null` only on the
     * `departed_before_reaction` arm, where the main trajectory ended before
     * t_shot and no shot state exists (recorded WP-08 judgment — §4a.6 spells
     * the member without conditioning it, but the state it names is undefined
     * on that arm).
     */
    readonly shot: {
        readonly s: number;
        readonly v_kmh: number;
        readonly phi_deg: number;
        readonly target_phi_deg: number;
    } | null;
    /** first return station (feasible only) */
    readonly returned: {
        readonly s: number;
        readonly f: number;
    } | null;
    /** set iff !feasible */
    readonly fail_reason: CorrectiveFailReason | null;
}
/** The §4a.6 wide-vs-runoff decision for a ran-wide corner. */
export declare function wideVsRunoff(feasible: boolean): "wide" | "runoff";
export interface CorrectiveShotInput {
    readonly trajectory: Trajectory;
    readonly resolved_scenario: ResolvedScenario;
}
export interface RunWideDetect {
    readonly corner_id: string;
    readonly hand: Hand;
    readonly s: number;
    readonly t: number;
    readonly x: number;
    readonly y: number;
    readonly f: number;
    readonly v: number;
}
/**
 * Scan a recorded line for run_wide_detect crossings (bracketed on the
 * retained record — the raw series is integrator-internal and already
 * discarded, 02 §6). Returns per-corner detects in station order.
 */
export declare function runWideDetect(traj: Trajectory, corners: readonly Corner[]): readonly RunWideDetect[];
/** The main-line event drafts for a detect list (kind run_wide_detect). */
export declare function runWideDetectEvents(detects: readonly RunWideDetect[]): readonly Event[];
export interface CorrectiveShotResult {
    /** null ⇔ never attempted: no outward detect, or the main run crashed */
    readonly corrective: CorrectiveBlock | null;
    /** the branched shadow document (out-of-hash data for the v0.2 ghost) */
    readonly shadow: CfShadowDocument | null;
    /**
     * main-line event drafts this machinery mints (run_wide_detect per detected
     * corner + correction iff the shot launched) — WP-09's verdict assembly
     * merges them into the line's events array (05 §5: one event source)
     */
    readonly events: readonly Event[];
}
/**
 * correctiveShot(lineResult) → Result<{corrective, shadow}> (§4a.7; 08 §7.1
 * pure-API tier). Fixed policy, one deterministic shadow, never a search:
 * react (t_react_s, freeze-clamped), roll to phiReserve at the profile cap,
 * a_cmd = 0 — launched through the ONE counterfactual harness under this
 * file's declared binding. Crash strictly precedes corrective solving.
 */
export declare function correctiveShot(line: CorrectiveShotInput): Result<CorrectiveShotResult, CfRefusal | LinelabError>;
