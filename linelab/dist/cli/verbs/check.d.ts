import { type VerbOutcome } from "./shared.js";
export interface CheckVerbInput {
    readonly loadedText: string;
    readonly argv: readonly string[];
}
export declare function checkVerb(input: CheckVerbInput): VerbOutcome;
