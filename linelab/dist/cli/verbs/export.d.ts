import { type VerbOutcome } from "./shared.js";
export interface ExportVerbInput {
    readonly loadedText: string;
    readonly argv: readonly string[];
    readonly engineSemver: string;
}
export declare function exportVerb(input: ExportVerbInput): VerbOutcome;
export declare function base64Utf8(s: string): string;
