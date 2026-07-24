import { type VerbOutcome } from "./shared.js";
export interface SaveWindowVerbInput {
    readonly loadedText: string;
    readonly argv: readonly string[];
}
export declare function saveWindowVerb(input: SaveWindowVerbInput): VerbOutcome;
