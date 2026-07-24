import { type VerbOutcome } from "./shared.js";
export interface MistakeVerbInput {
    /** the loaded `--on` envelope's raw text */
    readonly loadedText?: string;
    readonly argv: readonly string[];
}
export declare function mistakeVerb(input: MistakeVerbInput): VerbOutcome;
