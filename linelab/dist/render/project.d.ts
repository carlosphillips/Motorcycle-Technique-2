import type { Result } from "../core/result.js";
import type { ComposedRoad } from "../road/types.js";
import type { WireAnchor } from "../plan/types.js";
import type { LineResult } from "../solve/types.js";
import type { DrawnScene, DrawnPoint } from "./scene.js";
/** design/06 §2.1's `window?: {from: StationRef, to: StationRef} | "all"` — `StationRef` (undefined by 06, brief §10 ambiguity 2) is the D32 anchor grammar (plan/anchors.ts) already shared by every other station-referencing wire field. */
export type StationRef = WireAnchor;
export type ViewOrient = "auto" | 0 | 90 | 180 | 270;
export type ViewRays = "auto" | "off" | "all_turn_ins";
export type ViewLegendMode = "auto" | "on" | "off";
export type ViewWindow = "auto" | "all" | {
    readonly from: StationRef;
    readonly to: StationRef;
};
export interface ViewSpec {
    readonly mode?: "true";
    readonly window?: ViewWindow;
    readonly orient?: ViewOrient;
    readonly look?: "heading" | "limit_point";
    readonly rays?: ViewRays;
    readonly legend?: ViewLegendMode;
}
/** The §2.4 orient rotation — exported so render/index.ts maps marker/label anchor points through the SAME rigid isometry (scene.pivot + scene.orient). */
export declare function rotatePoint(p: DrawnPoint, cx: number, cy: number, deg: 0 | 90 | 180 | 270): DrawnPoint;
/**
 * `project(road, lines, viewSpec) → Result<DrawnScene>` (design/06 §2,
 * ARCHITECTURE §5). Pure; fails typed (`SCHEMA`/`BAD_RANGE`) rather than
 * drawing nonsense (§2.6). `INTERNAL`'s non-monotone-remap arm is unreachable
 * in v0.1: `s′(s)` is the identity, always monotone.
 */
export declare function project(road: ComposedRoad, lines: readonly LineResult[], viewSpec: unknown): Result<DrawnScene>;
