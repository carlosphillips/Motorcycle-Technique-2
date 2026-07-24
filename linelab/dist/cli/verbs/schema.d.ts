import { type VerbOutcome } from "./shared.js";
export interface SchemaVerbInput {
    readonly argv: readonly string[];
}
export declare function schemaVerb(input: SchemaVerbInput): VerbOutcome;
