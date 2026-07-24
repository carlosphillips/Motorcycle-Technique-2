import type { Result } from "../../core/result.js";
import { type RubricPack } from "./types.js";
/**
 * design/01 §A.5 — struck check-id tombstones. Typed UNKNOWN_ID with sub-reason
 * `struck_by_decision`, which is NOT `deferred`: there is no phase in which any
 * of these arrives.
 */
export declare const STRUCK_CHECK_IDS: Readonly<Record<string, string>>;
/**
 * The resolvable book citations — verbatim substrings of the committed
 * book_text/ extraction (each `book:` source's cite must be one of these).
 * test/oracle/rubric.test.ts greps book_text/ to keep this registry honest.
 */
export declare const KNOWN_BOOK_CITES: readonly string[];
/**
 * Threshold/bound names the design of record marks TUNING (design/01 Appendix A
 * constants; design/03 §7a.2 continuation bounds). Binding any of these names
 * with a `book:` source in any pack is the fabrication the D42 provenance rule
 * exists to reject.
 */
export declare const TUNING_MARKED_NAMES: readonly string[];
/**
 * Walk any pack-shaped JSON tree; check every `{value, units, source}` bound.
 * Rules (design/01 §A.6, all rejections SCHEMA/source_unresolved):
 *  (a) `source` is "TUNING" or starts with "book:" — no third spelling;
 *  (b) a book cite must resolve in the committed registry (KNOWN_BOOK_CITES,
 *      itself verified against book_text/ by the test suite);
 *  (c) a name the design of record marks TUNING may never carry a book: source.
 * Every rejection names the CHECK ID and the offending source string
 * (design/01 §A.6: "naming the check id and the string") — the walker tracks
 * the nearest enclosing object carrying a string `id` field; `detail.check_id`
 * is null for pack roots without check rows (the continuation pack).
 * Returns the number of source strings checked.
 */
export declare function scanPackProvenance(json: unknown, atPrefix?: string): Result<number>;
/** `loadRubricPack(json) → Result<RubricPack>` — the sole rubric-pack entry point. */
export declare function loadRubricPack(json: unknown): Result<RubricPack>;
/** `rubric` identity string every Verdict carries: `"<name>/<version>"`. */
export declare function rubricString(pack: RubricPack): string;
/**
 * Resolve a rubric NAME to the single pack version the engine ships
 * (design/01 §A.6: version is not author-selectable). Unknown name → UNKNOWN_ID.
 */
export declare function loadShippedRubricPack(name: string): Result<RubricPack>;
/**
 * design/03 §7a.2 — the code-side probe budget (7, TUNING) the pack ladder's
 * cardinality is bound to by typed rejection. 03-owned constant; declared here
 * because the doctrine/continuation data layer has no constants.ts of its own
 * in v0.1 (same placement rule as metrics.ts SI_HYST_DEG).
 */
export declare const K_MEMBERS = 7;
/**
 * Data-level validation of a continuation pack (design/03 §7a.2/§7a.3):
 *  (a) the D42 provenance scan every committed pack root gets;
 *  (b) `len(ladder) ≠ K_MEMBERS` → SCHEMA/ladder_cardinality_mismatch at
 *      `prior.ladder` — the ladder is pack data but K_MEMBERS is code, and a
 *      ladder of any other length silently breaks the §7a.6 k-bounds;
 *  (c) the §7a.3 coupled-constants schema check: `kappa_step_max_1pm ≥
 *      kappa_max_1pm` — the constants move together or the generator emits
 *      members outside the envelope the placard names.
 * Returns the provenance-checked source count on success.
 */
export declare function validateContinuationPackData(json: unknown): Result<number>;
/**
 * Resolve a check id against a loaded pack: shipped id → ok; renamed id →
 * UNKNOWN_ID/renamed_check naming the successor (design/01 §A.5, never silently
 * aliased); struck id → UNKNOWN_ID/struck_by_decision (never `deferred`);
 * anything else → UNKNOWN_ID/unknown_check.
 */
export declare function resolveCheckId(pack: RubricPack, id: string): Result<string>;
