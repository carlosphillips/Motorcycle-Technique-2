// cli/exit.ts — the five exit tiers (design/08 §3.1, verbatim table;
// ARCHITECTURE §5/§8 WP-15). Exit codes encode DEVIATION FROM DECLARATION, not
// simulation success: a crash is a valid, interesting run (tier 0); a write
// failure never masks a tier-3 deviation (tier 1 is checked LAST, after the
// verb's own document is already decided); tier 2 is every typed rejection
// except NO_SOLUTION/INTERNAL; tier 3 is NO_SOLUTION on any verb, plus a
// missed --gate/figure-bake expectation, plus a solve whose line misses its
// applicable bar; tier 4 is INTERNAL.
//
// Pure and total — no IO. main.ts is the only caller that turns an ExitCode
// into the runtime's exit status.

import type { ErrorCode } from "../core/result.js";

export type ExitCode = 0 | 1 | 2 | 3 | 4;

export const EXIT = {
  OK: 0,
  WRITE_FAILED: 1,
  BAD_INPUT: 2,
  DEVIATION: 3,
  INTERNAL: 4
} as const satisfies Record<string, ExitCode>;

/**
 * design/08 §3.1 — the typed-error → exit-tier map. Every code in the closed
 * 8-set maps to exactly one of {2, 3, 4}; `NO_SOLUTION` is ALWAYS tier 3 (the
 * authoring tier, on every verb — "a valid input the solver refused"),
 * `INTERNAL` is always tier 4, and everything else (`SCHEMA`, `DUP_ID`,
 * `OUT_OF_SCOPE`, `UNKNOWN_ID`, `BAD_RANGE`, `INEFFECTUAL`) is tier 2.
 */
export function exitForErrorCode(code: ErrorCode): 2 | 3 | 4 {
  if (code === "INTERNAL") return EXIT.INTERNAL;
  if (code === "NO_SOLUTION") return EXIT.DEVIATION;
  return EXIT.BAD_INPUT;
}
