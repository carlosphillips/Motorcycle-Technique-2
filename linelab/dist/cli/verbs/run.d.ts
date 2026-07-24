import { type VerbOutcome } from "./shared.js";
export interface RunVerbInput {
    readonly loadedText?: string;
    readonly argv: readonly string[];
    readonly engineSemver: string;
    readonly figureId?: string;
}
export declare function runVerb(input: RunVerbInput): VerbOutcome;
