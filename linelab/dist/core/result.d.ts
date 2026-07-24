export type Result<T, E = LinelabError> = {
    ok: true;
    value: T;
} | {
    ok: false;
    error: E;
};
export type ErrorCode = "SCHEMA" | "DUP_ID" | "OUT_OF_SCOPE" | "UNKNOWN_ID" | "BAD_RANGE" | "NO_SOLUTION" | "INEFFECTUAL" | "INTERNAL";
/**
 * The closed 8-set as a value, for enumeration tests and the D8 harness.
 * Double-entry with the `ErrorCode` type above — `test/hash/hash.test.ts`
 * retypes the list independently and compares.
 */
export declare const ERROR_CODES: readonly ["SCHEMA", "DUP_ID", "OUT_OF_SCOPE", "UNKNOWN_ID", "BAD_RANGE", "NO_SOLUTION", "INEFFECTUAL", "INTERNAL"];
export interface LinelabError {
    code: ErrorCode;
    at: string;
    message: string;
    schema_ref?: string;
    detail?: Record<string, unknown>;
    deferred?: string;
}
export declare function ok<T>(value: T): Result<T, never>;
export declare function err<E>(error: E): Result<never, E>;
