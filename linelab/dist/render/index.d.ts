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
export { renderPov, povFrame, renderPovForFigure, povFocusLine, povDefaultSample, povYawDeg, POV_LOOK_MODES, POV_MARKER_STATES } from "./pov.js";
export type { PovLook, MarkerState, PovFrame, PovFrameInput, PovLimitMarker, Pt } from "./pov.js";
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
 * `renderViews(input) → Result<{scene, svg}>` — dispatches the render target.
 * `target: "topdown"` (the default) composes a projected `DrawnScene` and draws
 * it; `target: "pov"` (v0.3 immersion) builds the first-person SVG from TRUE
 * geometry (render/pov.ts) and carries the topdown scene alongside for the
 * shared return contract. Neither renderer throws — only composition-time
 * failures (`project()`'s typed errors, `resolveLabels`'s typed anchor
 * failures) surface through this `Result`.
 */
export declare function renderViews(input: RenderViewsInput): Result<RenderViewsResult>;
