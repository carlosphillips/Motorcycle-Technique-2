import { type VerbOutcome } from "./shared.js";
export interface RenderVerbInput {
    readonly loadedText?: string;
    readonly argv: readonly string[];
}
export declare function renderVerb(input: RenderVerbInput): VerbOutcome;
