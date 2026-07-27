import type { Result } from "../core/result.js";
import type { FigureSpec } from "./types.js";
export declare const TOP_LEVEL_KEYS: readonly ["road", "lines", "occluders", "hazards", "marks", "labels", "view", "note", "placards"];
/**
 * `lowerScene(sceneText) → Result<FigureSpec>` (design/04 §7; D30). Pure,
 * total, deterministic: identical scene text always lowers to a
 * structurally-identical `FigureSpec` (`P-…` determinism precursor; see
 * `test/cli/scene.test.ts`'s "twice → identical" case).
 */
export declare function lowerScene(sceneText: string): Result<FigureSpec>;
