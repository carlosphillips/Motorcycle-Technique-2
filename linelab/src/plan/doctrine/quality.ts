// plan/doctrine/quality.ts — THE one colour law (design/06 §5.1 ≡ design/05
// §6.1; D11; drift risk #3: this function exists exactly once — solve/ stores
// its result in the verdict and render/ imports it, never re-derives).
//
// Physics decides `outcome`; the rubric decides doctrine; `quality` composes
// them. Total over the closed outcome set and every doctrine block — every
// branch reachable (P-QUALITY-TOTAL).

import type { Outcome } from "../../core/types.js";
import type { DoctrineBlock, RubricPack } from "./types.js";

export const QUALITIES = ["good", "caution", "failing"] as const;
export type Quality = (typeof QUALITIES)[number];

/**
 * design/05 §6.1 — the derived clean predicate (never an outcome value):
 * `clean(line) ⇔ outcome = "contained" ∧ zero applicable check fails`.
 * `Verdict.ok ≡ clean(line)`. `na` never blocks green.
 */
export function clean(outcome: Outcome, doctrine: DoctrineBlock): boolean {
  return outcome === "contained" && doctrine.fail === 0;
}

/**
 * True iff any FAILED check in the block is bound `critical` by the pack.
 * Severity is pack data attached to the check id (design/01 §A.1) — the block's
 * pinned wire shape carries none, so the loaded pack is consulted.
 */
export function criticalFailed(doctrine: DoctrineBlock, pack: RubricPack): boolean {
  for (const r of doctrine.checks) {
    if (r.verdict !== "fail") continue;
    const row = pack.checks.find((c) => c.id === r.id);
    if (row !== undefined && row.severity === "critical") return true;
  }
  return false;
}

/**
 * design/06 §5.1, verbatim:
 *
 * ```
 * quality = "failing"  if outcome ∈ {crash, runoff, wide}
 *                      or any critical-severity check failed
 *         | "good"     if outcome = contained and doctrine.fail = 0   // clean
 *         | "caution"  if outcome = contained and doctrine.fail > 0
 *         | "caution"  if outcome = stopped
 * ```
 *
 * Total on all inputs: the outcome set is closed and every remaining case is
 * caution. The pack argument supplies check severity (data the pinned
 * DoctrineBlock wire shape deliberately does not carry).
 */
export function quality(
  outcome: Outcome,
  doctrine: DoctrineBlock,
  pack: RubricPack
): Quality {
  if (outcome === "crash" || outcome === "runoff" || outcome === "wide") return "failing";
  if (criticalFailed(doctrine, pack)) return "failing";
  if (clean(outcome, doctrine)) return "good";
  return "caution";
}
