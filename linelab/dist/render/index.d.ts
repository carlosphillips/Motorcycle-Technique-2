import type { Result } from "../core/result.js";
import type { ComposedRoad } from "../road/types.js";
import type { LineResult } from "../solve/types.js";
import type { FigureLabel, MarkSpec } from "../plan/types.js";
import type { DrawnScene } from "./scene.js";
import type { RenderStyle } from "./topdown.js";
export type { DrawnScene } from "./scene.js";
export { wrapPlacard, placardBandHeightPx, PLACARD_WRAP_CHARS } from "./placards.js";
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
export type { PovLook, PovRoll, MarkerState, PovFrame, PovFrameInput, PovLimitMarker, Pt } from "./pov.js";
export type RenderTarget = "topdown" | "pov";
export interface RenderViewsInput {
    readonly road: ComposedRoad;
    readonly lines: readonly LineResult[];
    readonly viewSpec?: unknown;
    readonly labels?: readonly FigureLabel[];
    readonly marks?: MarkSpec;
    /**
     * design/06 §3.1 stage 11's figure-level placard boxes, in declared order.
     * FIGURE-level, so `project()` (road, lines, viewSpec) cannot see them —
     * they are attached to the `DrawnScene` here. Absent on every figure that
     * declares none, which is what keeps a placard-free bake byte-identical.
     */
    readonly placards?: readonly string[];
    readonly target?: RenderTarget;
    readonly style?: RenderStyle;
    /**
     * `target: "pov"` only — the true station to put the camera at. Absent, the
     * POV picks its own default cursor (the first corner's midpoint). The book's
     * three-station comparison (turn-in / apex / exit) is exactly this parameter
     * called three times.
     */
    readonly station?: number;
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
