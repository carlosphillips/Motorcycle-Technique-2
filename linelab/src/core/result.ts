// core/result.ts — THE one error shape (D8; 08 §3.2; ARCHITECTURE §4).
// Defined ONCE here; every module imports it. No API function throws across its
// boundary; `INTERNAL` is minted only for believed-impossible states.

export type Result<T, E = LinelabError> =
  | { ok: true; value: T }
  | { ok: false; error: E };

export type ErrorCode =
  | "SCHEMA" | "DUP_ID" | "OUT_OF_SCOPE" | "UNKNOWN_ID"
  | "BAD_RANGE" | "NO_SOLUTION" | "INEFFECTUAL" | "INTERNAL";   // closed; adding = design change

/**
 * The closed 8-set as a value, for enumeration tests and the D8 harness.
 * Double-entry with the `ErrorCode` type above — `test/hash/hash.test.ts`
 * retypes the list independently and compares.
 */
export const ERROR_CODES = [
  "SCHEMA", "DUP_ID", "OUT_OF_SCOPE", "UNKNOWN_ID",
  "BAD_RANGE", "NO_SOLUTION", "INEFFECTUAL", "INTERNAL"
] as const satisfies readonly ErrorCode[];

export interface LinelabError {
  code: ErrorCode;
  at: string;                       // offending path or token
  message: string;
  schema_ref?: string;
  detail?: Record<string, unknown>; // machine-readable payload
  deferred?: string;                // ONLY on SCHEMA, phase-gating law
}

// Reason-token convention (binding): reason tokens ride `detail.reason: string`,
// EXCEPT `NO_SOLUTION`, whose registry token rides `detail.sub_reason` (04 §4.10).
// Tests assert on code + reason, never message text.

export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

export function err<E>(error: E): Result<never, E> {
  return { ok: false, error };
}
