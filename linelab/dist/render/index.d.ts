import type { Result } from "../core/result.js";
import type { ComposedRoad } from "../road/types.js";
import type { LineResult } from "../solve/types.js";
import type { FigureLabel, MarkSpec } from "../plan/types.js";
import type { DrawnScene } from "./scene.js";
import type { RenderStyle } from "./topdown.js";
export type { DrawnScene } from "./scene.js";
export { project } from "./project.js";
export type { ViewSpec, StationRef } from "./project.js";
export { renderTopdown } from "./topdown.js";
export { renderControls, phaseBandsOf, lastCornerIdOf, CONTROLS_NEUTRAL_INKS } from "./controls.js";
export type { ControlsWindow, ControlsPanelId, PhaseBand } from "./controls.js";
export { fallbackSvg } from "./fallback.js";
export { gateProportions, computeProportionMetrics } from "./gateProportions.js";
export type { ProportionMetrics, ProportionGateResult, GateVerdict } from "./gateProportions.js";
export { buildManifestRecord } from "./manifest.js";
export type { ManifestRecord } from "./manifest.js";
export type RenderTarget = "topdown" | "pov";
export interface RenderViewsInput {
    readonly road: ComposedRoad;
    readonly lines: readonly LineResult[];
    readonly viewSpec?: unknown;
    readonly labels?: readonly FigureLabel[];
    readonly marks?: MarkSpec;
    readonly target?: RenderTarget;
    readonly style?: RenderStyle;
}
export interface RenderViewsResult {
    readonly scene: DrawnScene;
    readonly svg: string;
}
/**
 * `renderViews(input) → Result<{scene, svg}>` — v0.1: `target: "topdown"`
 * (the default) only. `target: "pov"` is a phase-gated `SCHEMA` rejection
 * (ARCHITECTURE §6.4's table), not a `renderTopdown` failure — `renderTopdown`
 * itself never throws/errors (§3 intro), so only composition-time failures
 * (`project()`'s typed errors, `resolveLabels`'s typed anchor failures)
 * surface through this `Result`.
 */
export declare function renderViews(input: RenderViewsInput): Result<RenderViewsResult>;
