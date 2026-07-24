import type { DoctrineBlock, DoctrineRecord, RubricPack } from "./types.js";
import type { MetricId } from "./metrics.js";
export declare const CHECK_IDS: readonly ["late_apex", "out_in_out", "single_input", "quick_steer", "throttle_rule", "trail_brake_taper", "traction_ceiling", "lean_ceiling", "exit_containment", "stop_within_sight", "hold_wide_for_sight", "rideability", "link_continuity", "chain_containment", "chain_flow", "wrong_strategy_for_corner"];
export type CheckId = (typeof CHECK_IDS)[number];
/**
 * The metric each shipped check id consumes (code — a pack row binding a
 * different metric to one of these ids would be smuggling arithmetic and is
 * rejected at pack load). 16 checks over 14 metrics: checks 9 and 16 share
 * `oio_fractions` and `apex_pct` respectively.
 */
export declare const CHECK_METRIC: Readonly<Record<CheckId, MetricId>>;
/**
 * The scope of each shipped check id (design/01 §A.3 table, verbatim — code:
 * the evaluators emit instances of exactly this scope).
 */
export declare const CHECK_SCOPE: Readonly<Record<CheckId, "corner" | "pair" | "chain" | "line">>;
/**
 * The band tokens each evaluator can produce (code). A loaded pack's `bands`
 * table must cover its check's tokens (validated at pack load; asserted by
 * A-CATALOGUE-RESOLVES).
 */
export declare const CHECK_BANDS: Readonly<Record<CheckId, readonly string[]>>;
/**
 * The threshold NAMES each check's checks_version-2 arithmetic consumes (code
 * — the data side is the values a pack binds to them). The loader validates
 * every row binds every name listed here (SCHEMA/thresholds_incomplete),
 * symmetric with band-token completeness: a legal variant pack can re-bind a
 * threshold but can never silently omit one — thresholdValue's NaN fallback is
 * unreachable through loadRubricPack.
 */
export declare const CHECK_THRESHOLDS: Readonly<Record<CheckId, readonly string[]>>;
/**
 * Grade one finished record under one loaded pack. Pure and total: it never
 * throws, never mutates the record, and asserts nothing the rubric refused
 * (`na` is first-class). Pack rows ride in pack order; per-row instances in
 * corner/pair order.
 */
export declare function runChecks(record: DoctrineRecord, pack: RubricPack): DoctrineBlock;
