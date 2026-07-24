// plan/doctrine/types.ts — the doctrine type vocabulary (ARCHITECTURE §4).
// Owns: CheckResult, DoctrineBlock, RubricPack, Severity, CheckVerdict, and the
// input record shape the check evaluators read.
//
// Design of record: design/01 Appendix A (catalogue, RubricPack, annex);
// design/05 §6.2 (CheckResult / doctrine block record shapes — pinned there,
// copied verbatim here). Closed sets are single `as const` declarations
// (drift risk #12); enumeration tests live in test/oracle/rubric.test.ts.
// ---------------------------------------------------------------------------
// Severity / scope / verdict vocabulary (design/01 §A.1, verbatim)
/** design/01 §A.1 — pack data, per check id. `critical`'s sole v2 member is check 16. */
export const SEVERITIES = ["advisory", "standard", "critical"];
/** design/01 §A.1 / design/05 §6.2 — the closed check scope set. */
export const CHECK_SCOPES = ["corner", "pair", "chain", "line"];
/**
 * design/01 §A.1 — per-check verdicts. `na` is a first-class verdict carrying a
 * typed reason (the §8 placard policy at check granularity); it never blocks green.
 */
export const CHECK_VERDICTS = ["pass", "fail", "warn", "na"];
/**
 * design/01 §A.6 — the closed applicability KEY set is code; the values bound in
 * a pack are data.
 */
export const APPLICABILITY_KEYS = [
    "corner_trend",
    "requires_blind",
    "declared_style",
    "chain_mode"
];
//# sourceMappingURL=types.js.map