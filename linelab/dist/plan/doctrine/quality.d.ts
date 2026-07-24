import type { Outcome } from "../../core/types.js";
import type { DoctrineBlock, RubricPack } from "./types.js";
export declare const QUALITIES: readonly ["good", "caution", "failing"];
export type Quality = (typeof QUALITIES)[number];
/**
 * design/05 §6.1 — the derived clean predicate (never an outcome value):
 * `clean(line) ⇔ outcome = "contained" ∧ zero applicable check fails`.
 * `Verdict.ok ≡ clean(line)`. `na` never blocks green.
 */
export declare function clean(outcome: Outcome, doctrine: DoctrineBlock): boolean;
/**
 * True iff any FAILED check in the block is bound `critical` by the pack.
 * Severity is pack data attached to the check id (design/01 §A.1) — the block's
 * pinned wire shape carries none, so the loaded pack is consulted.
 */
export declare function criticalFailed(doctrine: DoctrineBlock, pack: RubricPack): boolean;
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
export declare function quality(outcome: Outcome, doctrine: DoctrineBlock, pack: RubricPack): Quality;
