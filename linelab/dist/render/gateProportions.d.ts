import type { DrawnScene } from "./scene.js";
export type GateVerdict = "pass" | "warn" | "fail";
export interface GateFinding {
    readonly metric: "width_ratio" | "straight_share" | "road_ink" | "frame_aspect";
    readonly corner_id?: string;
    readonly value: number;
    readonly band: {
        readonly min?: number;
        readonly max?: number;
    };
    readonly severity: "warn" | "fail";
}
export interface ProportionMetrics {
    readonly width_ratio: readonly {
        readonly corner_id: string;
        readonly value: number;
    }[];
    readonly straight_share: number;
    readonly road_ink: number;
    readonly frame_aspect: number;
}
export interface ProportionGateResult {
    readonly verdict: GateVerdict;
    readonly findings: readonly GateFinding[];
}
/**
 * `gateProportions(metrics) → {verdict, findings}` (design/06 §6.2). Total,
 * pure. `verdict` is the worst-of across all four metrics (any per-corner
 * `width_ratio` miss included); `findings` names every out-of-band metric.
 */
export declare function gateProportions(metrics: ProportionMetrics): ProportionGateResult;
/**
 * `computeProportionMetrics(scene, corners, straightLenInWindow)` — the
 * DrawnScene-side reading of §6.1's four definitions. `corners`/
 * `straightLenInWindow` come from the composed road (not carried on
 * `DrawnScene`, which is drawn-geometry-only) — callers with a `ComposedRoad`
 * pass its `corners` and the summed straight-segment length inside the drawn
 * window directly.
 */
export declare function computeProportionMetrics(scene: DrawnScene, corners: readonly {
    readonly id: string;
    readonly r: number;
}[], straightLenInWindowM: number): ProportionMetrics;
