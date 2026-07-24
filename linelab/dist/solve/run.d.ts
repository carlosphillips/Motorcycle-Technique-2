import type { Result } from "../core/result.js";
import { type SolveInput } from "./solve.js";
import type { ExpectBlock, FigureResult, LineResult } from "./types.js";
export declare const ENGINE_SEMVER = "0.1.0";
export interface RunOptions {
    /** the running engine's semver; defaults to ENGINE_SEMVER */
    readonly engine_semver?: string;
    /** envelope figure_id when the input names none */
    readonly figure_id?: string;
}
export declare function routeSolve(spec: SolveInput): Result<LineResult>;
/**
 * Rename a line keeping role/label — the `--line-id` consumer's seam
 * (design/08 §4.1: the flag names the primary authored line of a composed
 * input; ids live outside every hash, so a rename is a pure rebuild).
 */
export declare function relabelLine(line: LineResult, line_id: string): LineResult;
/**
 * The explicit gate declarations a FigureSpec carries, keyed by line name
 * (design/08 §3.4 rule 1; JSON-only by design, D30). gateFigure consumes them
 * through its options — the envelope itself never carries them.
 */
export declare function expectDeclarationsOf(json: unknown): Result<Readonly<Record<string, ExpectBlock>>>;
export declare function run(input: unknown, opts?: RunOptions): Result<FigureResult>;
