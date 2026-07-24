import { type VerbOutcome } from "./shared.js";
export interface ExplainVerbInput {
    readonly loadedText?: string;
    readonly target?: string;
    readonly argv: readonly string[];
}
export declare function explainVerb(input: ExplainVerbInput): VerbOutcome;
