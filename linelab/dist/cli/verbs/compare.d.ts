import { type VerbOutcome } from "./shared.js";
export interface CompareVerbInput {
    /** one already-loaded input text per positional argument (A, B, …) */
    readonly loadedTexts: readonly string[];
    readonly argv: readonly string[];
    readonly engineSemver: string;
}
export declare function compareVerb(input: CompareVerbInput): VerbOutcome;
