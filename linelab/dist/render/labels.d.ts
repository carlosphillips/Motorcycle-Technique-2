import type { Result } from "../core/result.js";
import type { LineResult } from "../solve/types.js";
import type { FigureLabel } from "../plan/types.js";
import type { DrawnLabel } from "./scene.js";
/**
 * `resolveLabels(lines, figureLabels) → Result<DrawnLabel[]>`. Fails on the
 * FIRST unresolved label (typed `UNKNOWN_ID`) — a label set is authored data;
 * a bad reference is a figure-authoring bug, not a per-label degradation.
 */
export declare function resolveLabels(lines: readonly LineResult[], figureLabels: readonly FigureLabel[] | undefined): Result<readonly DrawnLabel[]>;
