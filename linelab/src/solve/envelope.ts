// solve/envelope.ts — the result contract's identity machinery (design/05 §7,
// §8; ARCHITECTURE §5 `resultHash`, `evaluateSkew`; §6.3 hash law):
//
//   - verdict sealing: emission rounding (solve/emit.ts) THEN
//     result_hash = fnv1a(canonicalize({verdict: rounded − exclusions, plan}))
//     — rounding is INSIDE the hash input (drift risk #2).
//   - the FULL exclusion set {result_hash, diagnosis, cache, skew, commitment}
//     (D29 + D45): the first two are verdict members removed before hashing;
//     cache/skew live OUTSIDE the verdict (they describe the relationship
//     between runs) and are stripped defensively; `commitment` is removed
//     unconditionally and permanently (D45 — no phase or Tier ever includes
//     it; until D45 promotes, the member does not even exist to remove).
//   - LineResult / LineRefusal / FigureResult assembly (D6/D11: refusals are
//     first-class entries beside results, never silence).
//   - engine_semver + expected stamp validation and stamping (05 §8.1/§8.4).
//   - version-skew tier evaluation (05 §8.4, D31 — placard DATA: it never
//     blocks, never errors, never changes computation).
//   - solved-plan cache-load classification (05 §8.1 — stamped conclusions;
//     `cache` is provenance, excluded from every hash; the engine-run half of
//     the load flow needs the solver and lands with WP-12's run.ts).

import type { Result } from "../core/result.js";
import { err, ok } from "../core/result.js";
import { canonicalize, fnv1a } from "../core/hash.js";
import type {
  ResolvedHazard,
  ResolvedOccluder,
  ResolvedPlanAction,
  ResolvedScenario,
  RoadModel,
  Trajectory
} from "../core/types.js";
import { OUTCOMES } from "../core/types.js";
import type { FigureRole } from "../plan/types.js";
import type { LinelabError } from "../core/result.js";
import { roundEmission } from "./emit.js";
import { LINELAB_SPEC } from "./types.js";
import type {
  CacheState,
  ExpectedStamp,
  FigureMeta,
  FigureResult,
  FigureSkewTier,
  LineEntry,
  LineRefusal,
  LineResult,
  LineSkewTier,
  LineSource,
  SkewLine,
  SkewRecord,
  SolvedStamp,
  Verdict
} from "./types.js";

// ---------------------------------------------------------------------------
// The result_hash law (design/05 §8.3, verbatim exclusion set)

/** The FULL exclusion set (D29 + D45) — keys stripped from the hashed verdict. */
export const RESULT_HASH_EXCLUSIONS = [
  "result_hash",
  "diagnosis",
  "cache",
  "skew",
  "commitment"
] as const;

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
export function resultHash(verdict: Verdict, rider: HashedRider): Result<string> {
  const rounded = roundEmission(verdict) as unknown as Record<string, unknown>;
  const v: Record<string, unknown> = { ...rounded };
  for (const key of RESULT_HASH_EXCLUSIONS) delete v[key];
  const payload: Record<string, unknown> = { verdict: v, plan: rider.plan };
  if (rider.roll_rate_cap_dps !== undefined) {
    // DELIBERATE DEVIATION from 05 §8.3's two-member {verdict, plan} formula,
    // PENDING RATIFICATION into the design of record: the letter says `plan`
    // "carries rider.roll_rate_cap_dps", but plan is an ARRAY of actions — a
    // scalar cannot ride in it without inventing a synthetic member. The cap
    // therefore rides as a third top-level key of the hash payload. This shape
    // is identity-bearing: amending it later is a re-bless event (hashes are
    // uncommitted pre-bless, which is why the shape is pinned now).
    payload["roll_rate_cap_dps"] = rider.roll_rate_cap_dps;
  }
  const canon = canonicalize(payload);
  if (!canon.ok) return canon;
  return ok(fnv1a(canon.value));
}

/** Deep-freeze (children before parents); functions and already-frozen nodes skipped. */
function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const key of Object.keys(value as object)) {
      deepFreeze((value as Record<string, unknown>)[key]);
    }
    Object.freeze(value);
  }
  return value;
}

/**
 * Seal a verdict for emission: apply THE rounding policy, compute result_hash
 * over the rounded form, stamp it, freeze. The sealed verdict is what the
 * envelope carries and what every export prints; the raw f64 verdict exists
 * only on the bless tap (ARCHITECTURE §6.3).
 */
export function sealVerdict(raw: Verdict, rider: HashedRider): Result<Verdict> {
  const rounded = roundEmission(raw);
  const h = resultHash(rounded, rider);
  if (!h.ok) return h;
  return ok(deepFreeze({ ...rounded, result_hash: h.value }));
}

// ---------------------------------------------------------------------------
// Share stamps (design/05 §8.1 — typed validation, verbatim rules)

const ENGINE_SEMVER_RE = /^\d+\.\d+\.\d+$/;
const HASH6_RE = /^[0-9a-f]{6}$/;

function schemaErr(at: string, message: string, reason: string): LinelabError {
  return { code: "SCHEMA", at, message, detail: { reason } };
}

/**
 * `engine_semver` must match `^\d+\.\d+\.\d+$` (05 §8.1). Absent is legal
 * (an unstamped spec) and returns `ok(undefined)`.
 */
export function validateEngineSemver(
  value: unknown,
  at: string
): Result<string | undefined> {
  if (value === undefined) return ok(undefined);
  if (typeof value !== "string" || !ENGINE_SEMVER_RE.test(value)) {
    return err(
      schemaErr(at, `engine_semver must match ^\\d+\\.\\d+\\.\\d+$, got ${String(value)}`, "bad_engine_semver")
    );
  }
  return ok(value);
}

/**
 * Per-line `expected` stamp validation (05 §8.1): outcome must be a member of
 * the closed outcome set; result_hash must match `^[0-9a-f]{6}$`; and an
 * `expected` block on a spec carrying no `engine_semver` is rejected SCHEMA —
 * "expectation without an engine to expect it from".
 */
export function validateExpectedStamp(
  value: unknown,
  hasEngineSemver: boolean,
  at: string
): Result<ExpectedStamp | undefined> {
  if (value === undefined) return ok(undefined);
  if (!hasEngineSemver) {
    return err(
      schemaErr(at, "expectation without an engine to expect it from", "expectation_without_engine")
    );
  }
  if (value === null || typeof value !== "object") {
    return err(schemaErr(at, "expected must be an object {outcome, result_hash}", "bad_expected_shape"));
  }
  const obj = value as Record<string, unknown>;
  const outcome = obj["outcome"];
  if (typeof outcome !== "string" || !(OUTCOMES as readonly string[]).includes(outcome)) {
    return err(
      schemaErr(
        `${at}.outcome`,
        `expected.outcome must be one of ${OUTCOMES.join("|")}`,
        "expected_outcome_not_closed"
      )
    );
  }
  const hash = obj["result_hash"];
  if (typeof hash !== "string" || !HASH6_RE.test(hash)) {
    return err(
      schemaErr(`${at}.result_hash`, "expected.result_hash must match ^[0-9a-f]{6}$", "bad_result_hash_format")
    );
  }
  return ok({ outcome: outcome as ExpectedStamp["outcome"], result_hash: hash });
}

/**
 * The §8.4 stamping rule's per-line payload: exporters stamp `expected` from
 * the CURRENT recomputed sealed verdict (re-sharing re-stamps — placard chains
 * never grow stale transitively). Pure data lift; the caller supplies the
 * engine_semver beside it (the package version, read by cli/ — the only IO
 * tier).
 */
export function stampExpected(sealed: Verdict): ExpectedStamp {
  return { outcome: sealed.outcome, result_hash: sealed.result_hash };
}

// ---------------------------------------------------------------------------
// Version skew (design/05 §8.4 — evaluation only; the record is placard data
// and NEVER blocks: this function is total, returns no Result, and computes
// nothing about the lines themselves, D31)

const LINE_TIER_RANK: Readonly<Record<LineSkewTier, number>> = {
  match: 0,
  unstamped: 1,
  detail: 2,
  story: 3
};

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
export function evaluateSkew(
  spec_semver: string | undefined,
  engine_semver: string,
  lines: readonly SkewLineInput[]
): SkewRecord | null {
  if (spec_semver === undefined) return null;
  const same_engine = spec_semver === engine_semver;

  const lineRecords: SkewLine[] = lines.map((l) => {
    if (l.expected === undefined) {
      return { line_id: l.line_id, tier: "unstamped", expected: null, got: l.got };
    }
    const story = l.got.outcome !== l.expected.outcome;
    const detail = !story && l.got.result_hash !== l.expected.result_hash;
    const tier: LineSkewTier = story ? "story" : detail ? "detail" : "match";
    return { line_id: l.line_id, tier, expected: l.expected, got: l.got };
  });

  const maxTier = lineRecords.reduce<LineSkewTier>(
    (acc, l) => (LINE_TIER_RANK[l.tier] > LINE_TIER_RANK[acc] ? l.tier : acc),
    "match"
  );
  const tier: FigureSkewTier =
    maxTier === "story" || maxTier === "detail"
      ? maxTier
      : same_engine
        ? "match"
        : "info";

  return deepFreeze({ spec_semver, engine_semver, same_engine, lines: lineRecords, tier });
}

// ---------------------------------------------------------------------------
// Solved-plan cache classification (design/05 §8.1 — never silent)

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
export function classifySolvedCache(input: SolvedCacheInput): CacheState {
  if (input.solved === undefined) return "absent";
  if (
    input.spec_engine_semver === undefined ||
    input.spec_engine_semver !== input.engine_semver
  ) {
    return "stale_engine";
  }
  if (input.solved.spec_hash !== input.recomputed_spec_hash) return "stale_spec";
  return "hit";
}

// ---------------------------------------------------------------------------
// Envelope assembly (design/05 §7 — D6 identical citizenship; refusals are
// first-class typed entries beside results)

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

export function buildLineResult(fields: LineResultFields): LineResult {
  return deepFreeze({
    line_id: fields.line_id,
    role: fields.role,
    label: fields.label,
    source: fields.source,
    resolved_scenario: fields.resolved_scenario,
    cache: fields.cache,
    trajectory: fields.trajectory,
    verdict: fields.verdict
  });
}

/**
 * A refused line stays in `lines` as a typed first-class entry keyed by
 * line_id (D6/D11): the bake stays total, nothing is dropped silently, and
 * the refusal participates in the expectation-gating law (08 §3.1). Refused
 * lines draw nothing.
 */
export function buildLineRefusal(
  line_id: string,
  role: FigureRole,
  error: LinelabError
): LineRefusal {
  return deepFreeze({ line_id, role, ok: false as const, error });
}

/** The LineResult/LineRefusal discriminant: refusals carry `ok: false`. */
export function isLineRefusal(entry: LineEntry): entry is LineRefusal {
  return "ok" in entry && entry.ok === false;
}

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

export function buildFigureResult(fields: FigureResultFields): FigureResult {
  return deepFreeze({
    spec: LINELAB_SPEC,
    figure_id: fields.figure_id,
    road: fields.road,
    occluders: fields.occluders,
    hazards: fields.hazards,
    lines: fields.lines,
    skew: fields.skew ?? null,
    meta: fields.meta ?? {}
  });
}
