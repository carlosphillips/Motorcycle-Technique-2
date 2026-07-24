import { type VerbOutcome } from "./shared.js";
export interface StateVerbInput {
    readonly loadedText: string;
    readonly argv: readonly string[];
}
export declare function stateVerb(input: StateVerbInput): VerbOutcome;
