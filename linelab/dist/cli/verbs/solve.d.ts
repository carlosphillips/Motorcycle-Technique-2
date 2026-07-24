import { type VerbOutcome } from "./shared.js";
export interface SolveVerbInput {
    readonly loadedText?: string;
    readonly argv: readonly string[];
    readonly figureId?: string;
}
export declare function solveVerb(input: SolveVerbInput): VerbOutcome;
