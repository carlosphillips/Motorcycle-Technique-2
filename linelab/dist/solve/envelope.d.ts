import type { Result } from "../core/result.js";
import type { ResolvedHazard, ResolvedOccluder, ResolvedPlanAction, ResolvedScenario, RoadModel, Trajectory } from "../core/types.js";
import type { FigureRole } from "../plan/types.js";
import type { LinelabError } from "../core/result.js";
import type { CacheState, ExpectedStamp, FigureMeta, FigureResult, LineEntry, LineRefusal, LineResult, LineSource, SkewRecord, SolvedStamp, Verdict } from "./types.js";
/** The FULL exclusion set (D29 + D45) — keys stripped from the hashed verdict. */
export declare const RESULT_HASH_EXCLUSIONS: readonly ["result_hash", "diagnosis", "cache", "skew", "commitment"];
/** The rider slice result_hash covers beside the verdict (05 §8.3). */
export interface HashedRider {
    readonly plan: readonly ResolvedPlanAction[];
    readonly roll_rate_cap_dps?: number;
}
/**
 * `result_hash = fnv1a(canonicalize({verdict: V′, plan}))`, first 6 hex, where
 * V′ = the EMISSION-ROUNDED verdict minus the exclusion set and `plan` is the
 * resolved plan, carrying `rider.roll_rate_cap_dps` when present (D29 — a
 * solver converging to a different plan under an unchanged rounded verdict is
 * a caught regression). Rounding is applied HERE, inside the hash input
 * (idempotent, so sealing twice cannot move the hash). Canonicalization
 * failure (non-finite number in a verdict) is a believed-impossible INTERNAL.
 */
export declare function resultHash(verdict: Verdict, rider: HashedRider): Result<string>;
/**
 * Seal a verdict for emission: apply THE rounding policy, compute result_hash
 * over the rounded form, stamp it, freeze. The sealed verdict is what the
 * envelope carries and what every export prints; the raw f64 verdict exists
 * only on the bless tap (ARCHITECTURE §6.3).
 */
export declare function sealVerdict(raw: Verdict, rider: HashedRider): Result<Verdict>;
/**
 * `engine_semver` must match `^\d+\.\d+\.\d+$` (05 §8.1). Absent is legal
 * (an unstamped spec) and returns `ok(undefined)`.
 */
export declare function validateEngineSemver(value: unknown, at: string): Result<string | undefined>;
/**
 * Per-line `expected` stamp validation (05 §8.1): outcome must be a member of
 * the closed outcome set; result_hash must match `^[0-9a-f]{6}$`; and an
 * `expected` block on a spec carrying no `engine_semver` is rejected SCHEMA —
 * "expectation without an engine to expect it from".
 */
export declare function validateExpectedStamp(value: unknown, hasEngineSemver: boolean, at: string): Result<ExpectedStamp | undefined>;
/**
 * The §8.4 stamping rule's per-line payload: exporters stamp `expected` from
 * the CURRENT recomputed sealed verdict (re-sharing re-stamps — placard chains
 * never grow stale transitively). Pure data lift; the caller supplies the
 * engine_semver beside it (the package version, read by cli/ — the only IO
 * tier).
 */
export declare function stampExpected(sealed: Verdict): ExpectedStamp;
/** One line's recomputation vs its stamp, as the skew evaluator consumes it. */
export interface SkewLineInput {
    readonly line_id: string;
    /** undefined = the line carried no `expected` stamp */
    readonly expected: ExpectedStamp | undefined;
    /** the CURRENT recomputed {outcome, result_hash} */
    readonly got: ExpectedStamp;
}
/**
 * Evaluate the skew record for a loaded FigureSpec (05 §8.4):
 *
 *   story  := recomputed.outcome ≠ expected.outcome        (a different story)
 *   detail := ¬story ∧ recomputed.result_hash ≠ expected.result_hash
 *
 * Figure tier = max of line tiers, except: when the semvers differ and no
 * line exceeds match/unstamped, figure tier is "info". (When the semvers are
 * EQUAL and no line exceeds match/unstamped, the figure tier reads "match" —
 * the figure-level enum has no "unstamped"; recorded judgment.)
 * Returns null when the spec carried no engine_semver.
 */
export declare function evaluateSkew(spec_semver: string | undefined, engine_semver: string, lines: readonly SkewLineInput[]): SkewRecord | null;
export interface SolvedCacheInput {
    /** the spec line's `solved` block, if any */
    readonly solved: SolvedStamp | undefined;
    /** the spec's `engine_semver` stamp (solved must not ship without it) */
    readonly spec_engine_semver: string | undefined;
    /** the RUNNING engine's semver */
    readonly engine_semver: string;
    /** `spec_hash` recomputed over canonical {road_spec, occluders, hazards, this line's source} */
    readonly recomputed_spec_hash: string;
}
/**
 * The load-validity classification (05 §8.1): valid — `cache: "hit"` — iff the
 * stamped engine_semver equals the running engine's AND spec_hash recomputes
 * equal; then the loader skips the search and runs the engine ONCE on the
 * cached plan (that engine run, plus the expected-divergence fallback to a
 * full re-solve, lands with WP-12's run.ts — the cache may change the time,
 * never the answer). Invalid → drop the cache and re-solve, recording why.
 */
export declare function classifySolvedCache(input: SolvedCacheInput): CacheState;
export interface LineResultFields {
    readonly line_id: string;
    readonly role: FigureRole;
    readonly label: string;
    readonly source: LineSource;
    readonly resolved_scenario: ResolvedScenario;
    readonly cache: CacheState;
    readonly trajectory: Trajectory;
    /** a SEALED verdict (result_hash stamped) — seal before building */
    readonly verdict: Verdict;
}
export declare function buildLineResult(fields: LineResultFields): LineResult;
/**
 * A refused line stays in `lines` as a typed first-class entry keyed by
 * line_id (D6/D11): the bake stays total, nothing is dropped silently, and
 * the refusal participates in the expectation-gating law (08 §3.1). Refused
 * lines draw nothing.
 */
export declare function buildLineRefusal(line_id: string, role: FigureRole, error: LinelabError): LineRefusal;
/** The LineResult/LineRefusal discriminant: refusals carry `ok: false`. */
export declare function isLineRefusal(entry: LineEntry): entry is LineRefusal;
export interface FigureResultFields {
    readonly figure_id: string;
    readonly road: RoadModel;
    readonly occluders: readonly ResolvedOccluder[];
    readonly hazards: readonly ResolvedHazard[];
    /** 1..N, order = draw order */
    readonly lines: readonly LineEntry[];
    /** null | the §8.4 record — placard data, excluded from every hash */
    readonly skew?: SkewRecord | null;
    readonly meta?: FigureMeta;
}
export declare function buildFigureResult(fields: FigureResultFields): FigureResult;
