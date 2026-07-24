import { type VerbOutcome } from "./shared.js";
export interface FigureVerbInput {
    readonly loadedText: string;
    readonly argv: readonly string[];
    readonly engineSemver: string;
}
export declare function figureVerb(input: FigureVerbInput): VerbOutcome;
