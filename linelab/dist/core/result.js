// core/result.ts — THE one error shape (D8; 08 §3.2; ARCHITECTURE §4).
// Defined ONCE here; every module imports it. No API function throws across its
// boundary; `INTERNAL` is minted only for believed-impossible states.
/**
 * The closed 8-set as a value, for enumeration tests and the D8 harness.
 * Double-entry with the `ErrorCode` type above — `test/hash/hash.test.ts`
 * retypes the list independently and compares.
 */
export const ERROR_CODES = [
    "SCHEMA", "DUP_ID", "OUT_OF_SCOPE", "UNKNOWN_ID",
    "BAD_RANGE", "NO_SOLUTION", "INEFFECTUAL", "INTERNAL"
];
// Reason-token convention (binding): reason tokens ride `detail.reason: string`,
// EXCEPT `NO_SOLUTION`, whose registry token rides `detail.sub_reason` (04 §4.10).
// Tests assert on code + reason, never message text.
export function ok(value) {
    return { ok: true, value };
}
export function err(error) {
    return { ok: false, error };
}
//# sourceMappingURL=result.js.map