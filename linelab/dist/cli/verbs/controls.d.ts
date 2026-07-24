import { type VerbOutcome } from "./shared.js";
export interface ControlsViewInput {
    readonly loadedText?: string;
    readonly argv: readonly string[];
}
/**
 * `render … --views controls[,topdown]`. Emits one controls strip per drawn
 * line; when `--views` also names `topdown`, the topdown half is produced by
 * the `render` verb itself (one renderer, no second code path) and both sets of
 * writes ride the same outcome.
 */
export declare function controlsView(input: ControlsViewInput): VerbOutcome;
