import type { Result } from "../core/result.js";
import type { FigureSpec, MarkSpec } from "./types.js";
export declare const FIGURE_ROLES: readonly ["ideal", "alternative", "mistake", "reference"];
export declare const LABEL_FEATURES: readonly ["turn_point", "apex", "exit", "release", "correction", "run_wide_detect", "end", "sight_ray"];
export declare const MARK_CLASSES: readonly ["turn_point", "apex", "exit", "release"];
export declare const SOLVE_STYLES: readonly ["single", "double_apex", "geometric"];
export declare const VIS_MODES: readonly ["none", "cautious"];
export declare const ACCEPT_POLICIES: readonly ["clean", "best_failing"];
export declare const CONSTRAINT_BOUNDS: readonly ["f_min", "f_max", "v_max_kmh", "sight_margin_min_m"];
/**
 * `validateFigureSpec(json) → Result<FigureSpec>` — shape-level validation of a
 * hand-authored FigureSpec JSON document (design/03 §8; D30's canonical
 * spelling). Never runs the engine, never resolves an anchor to a station
 * (that needs a composed road); see the file banner for the exact scope line.
 */
export declare function validateFigureSpec(json: unknown): Result<FigureSpec>;
/**
 * `lineMarksOf(fig) → ReadonlyMap<line name, MarkSpec>` — the figure's PER-LINE
 * MarkSpec overrides, and only those (design/03 §8: the MarkSpec is scoped "at
 * figure and per-line"; design/04 §7: "at figure level, overridable per line
 * with `marks=`").
 *
 * A line that authored no `marks` contributes NO entry, so the renderer's
 * lookup misses and falls back to the figure-level spec — the fallback is the
 * absence itself, never a synthesized `"auto"`. A figure with no per-line
 * override yields an empty map, which is exactly a no-op at the render seam.
 *
 * The one place this mapping is spelled: `cli/verbs/figure.ts` (the bake) and
 * the gate's mirror render both call it, so the two cannot drift.
 */
export declare function lineMarksOf(fig: FigureSpec): ReadonlyMap<string, MarkSpec>;
export declare function specHash(spec: FigureSpec): string;
