import type { DrawnScene, DrawnPoint } from "./scene.js";
export interface RenderStyle {
    readonly backgroundColour?: string;
}
/**
 * The `turn_point` HOURGLASS outline (design/06 §3.1 stage 9), in drawn units:
 * six points, widest at the two ends, pinched at the waist. Exported so the
 * regression gate can assert the waist geometrically (the defect it replaces
 * was a solid rhombus — widest exactly where an hourglass is narrowest).
 */
export declare function hourglassPoints(cx: number, cy: number, r: number): readonly DrawnPoint[];
/**
 * `renderTopdown(drawnScene, style?) → SvgString` (design/06 §3). Projection-
 * agnostic: consumes only `drawnScene`; every layout decision (window, orient,
 * frame) was `project()`'s. Never throws — any failure is caught and returned
 * as `fallbackSvg(msg)` (carried, §3 intro).
 */
export declare function renderTopdown(drawnScene: DrawnScene, style?: RenderStyle): string;
