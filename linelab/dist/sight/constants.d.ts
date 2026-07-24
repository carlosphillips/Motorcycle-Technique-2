import type { SsdModel } from "../core/types.js";
/** 5.0 m — TUNING. Trend derivation window over the recorded sight_m series (design/03 §5.1). */
export declare const SIGHT_TREND_WINDOW_M = 5;
/** 2.0 m — TUNING. Trend deadband: |Δsight| below this reads `steady` (design/03 §5.1). */
export declare const SIGHT_TREND_DEADBAND_M = 2;
/** Per-model ssd parameters (design/03 §5.2). `a_ssd` honestly means UPRIGHT braking. */
export interface SsdModelParams {
    /** m/s² — upright full-rate braking decel */
    readonly a_ssd: number;
    /** s — model reaction time; independent of the rider profile's t_react_s (design/02 §3) */
    readonly t_react_s: number;
}
/**
 * design/03 §5.2, verbatim: `alert {a_ssd: 7.0 m/s², t_react_s: 1.0}` (default,
 * TUNING) and `aashto {a_ssd: 3.4, t_react_s: 2.5}` (the conservative
 * highway-engineering yardstick). Keyed by the closed SsdModel set (core/types.ts).
 */
export declare const SSD_MODEL_TABLE: Readonly<Record<SsdModel, SsdModelParams>>;
/**
 * 0.25 m — station step at which band-occluder faces are sampled into footprint
 * polylines. Chord sag at this step on the tightest preset band face (~7 m
 * radius) is under 2 mm — well inside the sight-cast grid resolution.
 */
export declare const FOOTPRINT_STEP_M = 0.25;
