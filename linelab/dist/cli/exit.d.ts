import type { ErrorCode } from "../core/result.js";
export type ExitCode = 0 | 1 | 2 | 3 | 4;
export declare const EXIT: {
    readonly OK: 0;
    readonly WRITE_FAILED: 1;
    readonly BAD_INPUT: 2;
    readonly DEVIATION: 3;
    readonly INTERNAL: 4;
};
/**
 * design/08 §3.1 — the typed-error → exit-tier map. Every code in the closed
 * 8-set maps to exactly one of {2, 3, 4}; `NO_SOLUTION` is ALWAYS tier 3 (the
 * authoring tier, on every verb — "a valid input the solver refused"),
 * `INTERNAL` is always tier 4, and everything else (`SCHEMA`, `DUP_ID`,
 * `OUT_OF_SCOPE`, `UNKNOWN_ID`, `BAD_RANGE`, `INEFFECTUAL`) is tier 2.
 */
export declare function exitForErrorCode(code: ErrorCode): 2 | 3 | 4;
