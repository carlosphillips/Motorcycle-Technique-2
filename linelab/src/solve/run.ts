// solve/run.ts — run(input) → Result<FigureResult> (design/08 §3 verb table;
// ARCHITECTURE §5, WP-12): the universal front door. Compose the world, apply
// the delegate-to-solve rule ("run delegates to the solver IFF the composed
// input contains any solver-layer field" — 08 §3.1; the envelope records the
// delegation as source.kind "solve"), run every figure line — refusals stay in
// `lines` as first-class typed LineRefusal entries (D6/D11, 05 §7) — and
// assemble the envelope via solve/envelope.ts.
//
// Solved-plan cache-load semantics (design/05 §8.1, D31): a `solved` stamp is
// valid iff the stamped engine_semver equals the running engine's AND the
// line's spec_hash recomputes equal (classifySolvedCache, envelope.ts) — then
// the search is skipped and the engine runs ONCE on the cached plan with the
// verdict computed fresh (stamped conclusions never skip the engine); if the
// fresh outcome or result_hash diverges from the `expected` stamp, run falls
// back to a full re-solve and the divergence lands in the skew record (a
// placard, never a block — D31). Invalid caches are dropped and re-solved;
// `LineResult.cache` records hit | stale_engine | stale_spec | absent, never
// silence.

import type { LinelabError, Result } from "../core/result.js";
import { err, ok } from "../core/result.js";
import { canonicalize, fnv1a } from "../core/hash.js";
import type {
  Outcome,
  ResolvedHazard,
  ResolvedOccluder,
  ResolvedScenario,
  RoadModel
} from "../core/types.js";
import { OUTCOMES } from "../core/types.js";
import { compose } from "../road/compose.js";
import type { Segment } from "../road/types.js";
import { validate, validateFigureWorld } from "../plan/validate.js";
import { validateFigureSpec } from "../plan/figure.js";
import { loadShippedRubricPack, resolveCheckId } from "../plan/doctrine/pack.js";
import { printMistakeToken, type MistakeKind } from "../plan/mistakes.js";
import { CONFIG_RUBRIC_DEFAULT } from "../plan/constants.js";
import type {
  AcceptPolicy,
  FigureRole,
  FigureSpec,
  MistakeSpec,
  PlanAction,
  Scenario,
  SolveSpec
} from "../plan/types.js";
import { executeLine, solve, type SolveInput } from "./solve.js";
import { chainedSolve, composeSpecRoad, wireRoadSpecOf } from "./chained.js";
import { solveDoubleApex } from "./doubleApex.js";
import { solveCautious } from "./vis.js";
import { solveBelieved } from "./believed.js";
import { compileMistake } from "./mistake.js";
import { deriveStations } from "./stations.js";
import {
  buildFigureResult,
  buildLineRefusal,
  buildLineResult,
  classifySolvedCache,
  evaluateSkew,
  isLineRefusal,
  validateEngineSemver,
  validateExpectedStamp,
  type SkewLineInput
} from "./envelope.js";
import type {
  CacheState,
  ExpectBlock,
  ExpectedStamp,
  FigureResult,
  LineEntry,
  LineResult,
  LineSource,
  SolvedStamp
} from "./types.js";

// ---------------------------------------------------------------------------
// The running engine's semver (design/05 §8.4: "the engine version is the
// package version" — package.json's 0.1.0; cli/, the IO tier, may override
// through RunOptions if the two ever drift, and T-BLESSED-DOC-SYNC (WP-16)
// gates the sync).

export const ENGINE_SEMVER = "0.1.0";

export interface RunOptions {
  /** the running engine's semver; defaults to ENGINE_SEMVER */
  readonly engine_semver?: string;
  /** envelope figure_id when the input names none */
  readonly figure_id?: string;
}

// ---------------------------------------------------------------------------
// Typed helpers

function schemaErr(at: string, message: string, reason: string, detail?: Record<string, unknown>): LinelabError {
  return { code: "SCHEMA", at, message, detail: { reason, ...detail } };
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function canonOf(v: unknown): string {
  const c = canonicalize(v);
  return c.ok ? c.value : "";
}

// ---------------------------------------------------------------------------
// The solver router — the delegate-to-solve rule's dispatch half: every
// solver-layer field routes to its owning pipeline (chains are the default
// invocation, 04 §5).

export function routeSolve(spec: SolveInput): Result<LineResult> {
  if (spec.believed_road !== undefined) return solveBelieved(spec);
  if (spec.style === "double_apex") return solveDoubleApex(spec);
  if (spec.vis === "cautious") return solveCautious(spec);
  if (spec.style !== undefined && spec.style !== "single") {
    // style=geometric is design vocabulary without a v0.1 solver — surface the
    // typed seam rather than silently solving single (D8)
    return solve(spec);
  }
  return chainedSolve(spec);
}

/**
 * Rename a line keeping role/label — the `--line-id` consumer's seam
 * (design/08 §4.1: the flag names the primary authored line of a composed
 * input; ids live outside every hash, so a rename is a pure rebuild).
 */
export function relabelLine(line: LineResult, line_id: string): LineResult {
  return relabel(line, line_id, line.role, line.label);
}

/** line_id/role/label live outside every hash — relabel by rebuild. */
function relabel(line: LineResult, line_id: string, role: FigureRole, label?: string): LineResult {
  return buildLineResult({
    line_id,
    role,
    label: label ?? line.label,
    source: line.source,
    resolved_scenario: line.resolved_scenario,
    cache: line.cache,
    trajectory: line.trajectory,
    verdict: line.verdict
  });
}

/** `cache` is provenance outside result_hash — restamp by rebuild. */
function withCache(line: LineResult, cache: CacheState): LineResult {
  return buildLineResult({
    line_id: line.line_id,
    role: line.role,
    label: line.label,
    source: line.source,
    resolved_scenario: line.resolved_scenario,
    cache,
    trajectory: line.trajectory,
    verdict: line.verdict
  });
}

// ---------------------------------------------------------------------------
// expect_fail resolution (design/03 §6: check ids validate against the loaded
// pack — UNKNOWN_ID; renamed ids get the typed tombstone naming the successor,
// A-RENAME-REJECTED; never silently aliased)

function resolveExpectFail(
  expect_fail: readonly string[] | undefined,
  rubric: string | undefined,
  at: string
): LinelabError | null {
  if (expect_fail === undefined || expect_fail.length === 0) return null;
  const packR = loadShippedRubricPack(rubric ?? CONFIG_RUBRIC_DEFAULT);
  if (!packR.ok) return packR.error;
  for (let i = 0; i < expect_fail.length; i++) {
    const r = resolveCheckId(packR.value, expect_fail[i]!);
    if (!r.ok) return { ...r.error, at: `${at}.expect_fail[${i}]` };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Per-line share stamps (design/05 §8.1) — extracted from the RAW FigureSpec
// JSON beside the WP-13 shape validation (plan/figure.ts is deliberately
// stamp-blind in v0.1; the stamps are output-provenance vocabulary owned by
// solve/, ARCHITECTURE §4).

interface LineStamps {
  readonly expect?: ExpectBlock;
  readonly expected?: ExpectedStamp;
  readonly solved?: SolvedStamp;
}

function validateExpectBlock(value: unknown, at: string): Result<ExpectBlock | undefined> {
  if (value === undefined) return ok(undefined);
  if (!isObject(value)) return err(schemaErr(at, "expect must be an object {outcome?, checks_fail?}", "bad_expect_shape"));
  let outcome: readonly Outcome[] | undefined;
  if (value["outcome"] !== undefined) {
    const arr = value["outcome"];
    if (!Array.isArray(arr) || !arr.every((o) => (OUTCOMES as readonly string[]).includes(o as string))) {
      return err(schemaErr(`${at}.outcome`, `expect.outcome must be an array over ${OUTCOMES.join("|")}`, "expect_outcome_not_closed"));
    }
    outcome = arr as readonly Outcome[];
  }
  let checks_fail: readonly string[] | undefined;
  if (value["checks_fail"] !== undefined) {
    const arr = value["checks_fail"];
    if (!Array.isArray(arr) || !arr.every((c) => typeof c === "string")) {
      return err(schemaErr(`${at}.checks_fail`, "expect.checks_fail must be an array of check ids", "type_mismatch"));
    }
    const packR = loadShippedRubricPack(CONFIG_RUBRIC_DEFAULT);
    if (!packR.ok) return packR;
    for (let i = 0; i < arr.length; i++) {
      const r = resolveCheckId(packR.value, arr[i] as string);
      if (!r.ok) return err({ ...r.error, at: `${at}.checks_fail[${i}]` });
    }
    checks_fail = arr as readonly string[];
  }
  return ok({
    ...(outcome !== undefined ? { outcome } : {}),
    ...(checks_fail !== undefined ? { checks_fail } : {})
  });
}

const HASH6_RE = /^[0-9a-f]{6}$/;

function validateSolvedStamp(
  value: unknown,
  hasStamps: boolean,
  at: string
): Result<SolvedStamp | undefined> {
  if (value === undefined) return ok(undefined);
  if (!hasStamps) {
    // 05 §8.1: `solved` must not ship without the stamps (engine_semver + expected)
    return err(schemaErr(at, "a solved cache must not ship without engine_semver + expected stamps", "solved_without_stamps"));
  }
  if (!isObject(value)) return err(schemaErr(at, "solved must be an object {spec_hash, plan}", "bad_solved_shape"));
  const hash = value["spec_hash"];
  if (typeof hash !== "string" || !HASH6_RE.test(hash)) {
    return err(schemaErr(`${at}.spec_hash`, "solved.spec_hash must match ^[0-9a-f]{6}$", "bad_spec_hash_format"));
  }
  if (!Array.isArray(value["plan"])) {
    return err(schemaErr(`${at}.plan`, "solved.plan must be an array of wire plan actions", "type_mismatch"));
  }
  return ok({ spec_hash: hash, plan: value["plan"] as SolvedStamp["plan"] });
}

interface FigureStamps {
  readonly figure_id: string | undefined;
  readonly engine_semver: string | undefined;
  /** keyed by line NAME (raw entries are positional beside the validated lines) */
  readonly byLine: ReadonlyMap<string, LineStamps>;
}

function extractStamps(json: Record<string, unknown>): Result<FigureStamps> {
  const figure_id =
    typeof json["figure_id"] === "string" && json["figure_id"].length > 0 ? json["figure_id"] : undefined;
  const semverR = validateEngineSemver(json["engine_semver"], "engine_semver");
  if (!semverR.ok) return semverR;
  const engine_semver = semverR.value;

  const byLine = new Map<string, LineStamps>();
  const linesRaw = json["lines"];
  if (Array.isArray(linesRaw)) {
    for (let i = 0; i < linesRaw.length; i++) {
      const raw: unknown = linesRaw[i];
      if (!isObject(raw) || typeof raw["name"] !== "string") continue;
      const at = `lines[${i}]`;
      const expectR = validateExpectBlock(raw["expect"], `${at}.expect`);
      if (!expectR.ok) return expectR;
      const expectedR = validateExpectedStamp(raw["expected"], engine_semver !== undefined, `${at}.expected`);
      if (!expectedR.ok) return expectedR;
      const solvedR = validateSolvedStamp(
        raw["solved"],
        engine_semver !== undefined && expectedR.value !== undefined,
        `${at}.solved`
      );
      if (!solvedR.ok) return solvedR;
      if (expectR.value !== undefined || expectedR.value !== undefined || solvedR.value !== undefined) {
        byLine.set(raw["name"], {
          ...(expectR.value !== undefined ? { expect: expectR.value } : {}),
          ...(expectedR.value !== undefined ? { expected: expectedR.value } : {}),
          ...(solvedR.value !== undefined ? { solved: solvedR.value } : {})
        });
      }
    }
  }
  return ok({ figure_id, engine_semver, byLine });
}

/**
 * The explicit gate declarations a FigureSpec carries, keyed by line name
 * (design/08 §3.4 rule 1; JSON-only by design, D30). gateFigure consumes them
 * through its options — the envelope itself never carries them.
 */
export function expectDeclarationsOf(json: unknown): Result<Readonly<Record<string, ExpectBlock>>> {
  if (!isObject(json)) return ok({});
  const stamps = extractStamps(json);
  if (!stamps.ok) return stamps;
  const out: Record<string, ExpectBlock> = {};
  for (const [name, s] of stamps.value.byLine) {
    if (s.expect !== undefined) out[name] = s.expect;
  }
  return ok(out);
}

// ---------------------------------------------------------------------------
// Composed-world skeleton: one validate() pass over the figure's road +
// occluders + hazards yields the resolved absolute forms the envelope carries
// (05 §7) and the resolved road every line's spec_hash recomputation reads.
//
// That pass is `plan/validate.ts`'s `validateFigureWorld` — the SAME call the
// lint makes (`check` / `figure --check`, via cli/verbs/shared.ts's
// `lintFigureSpec`). The bake additionally needs the composed value; the lint
// needs only the verdict; neither owns a second copy of the rule (S11).

interface WorldSkeleton {
  readonly road: RoadModel;
  readonly resolved: ResolvedScenario;
  readonly occluders: readonly ResolvedOccluder[];
  readonly hazards: readonly ResolvedHazard[];
}

function composeWorld(fig: FigureSpec): Result<WorldSkeleton> {
  const composed = compose(fig.road);
  if (!composed.ok) return composed;
  const skeleton = validateFigureWorld(fig);
  if (!skeleton.ok) return skeleton;
  const resolved = skeleton.value as unknown as ResolvedScenario;
  return ok({
    road: composed.value,
    resolved,
    occluders: resolved.occluders,
    hazards: resolved.hazards
  });
}

/** spec_hash recomputation for cache classification (05 §8.1's coverage line). */
function recomputeLineSpecHash(world: WorldSkeleton, source: LineSource): string {
  const canon = canonicalize({
    road_spec: world.resolved.road,
    occluders: world.occluders,
    hazards: world.hazards,
    source
  });
  return canon.ok ? fnv1a(canon.value) : "";
}

/** doctrine check-6 baseline for non-solver lines: the first corner's derived brake_gap. */
function figureBrakeGap(road: RoadModel): number {
  if (road.corners.length === 0) return 0;
  const d = deriveStations(road, 0);
  return d.ok ? d.value.brake_gap_m : 0;
}

// ---------------------------------------------------------------------------
// Cache-aware solve execution (design/05 §8.1 load semantics)

interface CacheRun {
  readonly line: LineResult;
}

function runSolveLine(
  spec: SolveInput,
  world: WorldSkeleton,
  stamps: LineStamps | undefined,
  engine_semver: string,
  spec_engine_semver: string | undefined
): Result<CacheRun> {
  const source: LineSource = { kind: "solve", solveSpec: spec };
  const cache = classifySolvedCache({
    solved: stamps?.solved,
    spec_engine_semver,
    engine_semver,
    recomputed_spec_hash: recomputeLineSpecHash(world, source)
  });

  if (cache === "hit" && stamps?.solved !== undefined && stamps.expected !== undefined) {
    // skip the search: ONE engine run on the cached plan, verdict fresh
    const cachedR = executeCachedPlan(spec, stamps.solved, source, world, spec.accept ?? "clean");
    if (cachedR.ok) {
      const line = cachedR.value;
      const fresh = { outcome: line.verdict.outcome, result_hash: line.verdict.result_hash };
      if (fresh.outcome === stamps.expected.outcome && fresh.result_hash === stamps.expected.result_hash) {
        return ok({ line: withCache(line, "hit") });
      }
      // divergence: fall back to a full re-solve; the placard (skew) records it
    }
    // an unusable cached plan (validate/execute refusal) also falls back
  }

  const solvedR = routeSolve(spec);
  if (!solvedR.ok) return solvedR;
  return ok({ line: withCache(solvedR.value, cache) });
}

function executeCachedPlan(
  spec: SolveInput,
  solved: SolvedStamp,
  source: LineSource,
  world: WorldSkeleton,
  policy: AcceptPolicy
): Result<LineResult> {
  // the cached plan is an INPUT (a wire plan, no trajectory): validate it in
  // the line's own scenario and run the one engine pass
  const wire = {
    spec: "linelab/1",
    id: "solve",
    road: wireRoadSpecOf(spec.road),
    ...(spec.occluders !== undefined ? { occluders: spec.occluders } : {}),
    ...(spec.hazards !== undefined ? { hazards: spec.hazards } : {}),
    rider: {
      ...(spec.profile !== undefined ? { profile: spec.profile } : {}),
      ...(spec.roll_rate_cap_dps !== undefined ? { roll_rate_cap_dps: spec.roll_rate_cap_dps } : {}),
      start: { speed_kmh: spec.entry_kmh, ...(spec.start_f !== undefined ? { f: spec.start_f } : {}) },
      plan: solved.plan
    },
    ...(spec.mu !== undefined ? { config: { mu: spec.mu } } : {})
  };
  const validated = validate(wire);
  if (!validated.ok) return validated;
  return executeLine({
    validated: validated.value,
    policy,
    source,
    constraints: null,
    brake_gap_m: figureBrakeGap(world.road)
  });
}

// ---------------------------------------------------------------------------
// Mistake-line cache-load (design/05 §8.1): the `solved` stamp is written "for
// every `solve`- AND `mistake`-sourced line", so a mistake line's warm path
// MUST honour it too — skip the ~20-integrate compileMistake perturbation and
// run the engine ONCE on the cached plan. `spec_hash` (hence `result_hash`) is
// computed OVER the line's `source` (solve/solve.ts `lineSpecHash`), so the
// mistake `source` must be PRESERVED for the stamp to round-trip — a
// `{kind:"scenario"}` rewrite would move both hashes.
//
// The compiled mistake source (solve/mistake.ts) carries two members the raw
// FigureSpec MistakeSpec omits: resolved (numeric) `params`, and `applied_corners`
// — the scoped corners that actually received the perturbation (04 §5.1.5), a
// set liveness-truncated when the mistaken line departs mid-chain. `applied_corners`
// is recovered here by diffing the cached plan against the base line: a corner
// is applied iff its base turn_in was moved earlier (premature / premature_contained)
// or replaced by facet actions `<id>_f*` (fifty_pence) in the cached plan. That
// covers exactly the turn-in family, whose applied set is truncatable and whose
// warm cache the committed figures exercise (fig-08-06 `premature@all`); the
// whole-line kinds (slow_steer / overspeed / chop) leave the plan's turn_ins
// untouched, so this yields no applied corners, the recomputed spec_hash misses
// the stamp, and the line re-solves through compileMistake. Every path is kept
// honest by TWO guards below — the spec_hash match (classifySolvedCache) AND the
// replayed outcome+result_hash matching `expected` — so the cache only ever
// moves the time, never the answer (D6/D7).

function reconstructMistakeSource(
  spec: MistakeSpec,
  base: LineResult,
  cachedPlan: readonly PlanAction[]
): LineSource {
  const basePlan = base.resolved_scenario.rider.plan;
  const baseTurnInStation = (id: string): number | null => {
    const a = basePlan.find((x) => x.do === "turn_in" && x.id === id);
    return a !== undefined ? a.at_s : null;
  };
  const applied: string[] = [];
  const seen = new Set<string>();
  for (const e of base.trajectory.events) {
    if (e.kind !== "turn_in" || e.corner_id === undefined || e.action_id === undefined) continue;
    if (seen.has(e.corner_id)) continue;
    seen.add(e.corner_id);
    const baseS = baseTurnInStation(e.action_id);
    if (baseS === null) continue;
    const movedEarly = cachedPlan.some(
      (x) => x.do === "turn_in" && x.id === e.action_id && typeof x.at_s === "number" && x.at_s < baseS - 1e-6
    );
    const faceted = cachedPlan.some((x) => x.do === "turn_in" && x.id.startsWith(`${e.action_id}_f`));
    if (movedEarly || faceted) applied.push(e.corner_id);
  }
  // params ride resolved (numeric) in the compiled source (solve/mistake.ts's
  // coerceParams); execution kinds carry no string params (the `of` corner ref
  // belongs to the misjudgment sugar, a `misjudge` source, not this one).
  const params: Record<string, number | string> = {};
  for (const [k, v] of Object.entries(spec.params ?? {})) {
    params[k] = k === "of" ? String(v) : Number(v);
  }
  const mistakeSpec: MistakeSpec & { readonly applied_corners: readonly string[] } = {
    kind: spec.kind,
    params,
    ...(spec.scope !== undefined ? { scope: spec.scope } : {}),
    applied_corners: applied
  };
  return { kind: "mistake", base_line_id: base.line_id, mistakeSpec };
}

/** MistakeSpec params → the printMistakeToken form (all values as strings). */
function stringifyParams(params: Readonly<Record<string, number | string>>): Record<string, string> {
  return Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)]));
}

// ---------------------------------------------------------------------------
// run(input) — the universal front door (design/08 §3). Content-sniffed:
// `lines` → FigureSpec; `rider` → wire Scenario (no delegation — physics
// only); `entry_kmh` → a solver-layer composed input (delegates, 08 §3.1).

export function run(input: unknown, opts?: RunOptions): Result<FigureResult> {
  const engine_semver = opts?.engine_semver ?? ENGINE_SEMVER;
  if (!isObject(input)) {
    return err(schemaErr("", "run input must be a JSON object (scenario or FigureSpec)", "run_input_not_object"));
  }
  if ("lines" in input) {
    if (input["line_id"] !== undefined) {
      // never accepted-and-ignored (D8): figure lines are named in the spec —
      // `line_id` (the --line-id spelling) belongs to composed inputs only.
      return err(
        schemaErr("line_id", "--line-id names the primary line of a composed input — figure lines are named by their own `name` fields (08 §4.1)", "line_id_on_figure")
      );
    }
    return runFigure(input, engine_semver, opts);
  }
  if ("rider" in input) return runScenario(input, opts);
  if ("entry_kmh" in input) return runComposed(input as unknown as SolveInput & { line_id?: string }, opts);
  return err(
    schemaErr("", "run input must be a FigureSpec ({lines,…}), a wire Scenario ({rider,…}), or a composed solver input ({entry_kmh,…})", "run_input_unrecognized")
  );
}

// -- wire Scenario: physics only, no delegation ------------------------------

function runScenario(json: Record<string, unknown>, opts?: RunOptions): Result<FigureResult> {
  const scenario = json as unknown as Scenario;
  const config = isObject(json["config"]) ? (json["config"] as Record<string, unknown>) : {};
  const expectErr = resolveExpectFail(
    scenario.expect_fail,
    typeof config["rubric"] === "string" ? (config["rubric"] as string) : undefined,
    "scenario"
  );
  if (expectErr !== null) return err(expectErr);

  const validated = validate(json);
  if (!validated.ok) return validated;
  const resolved = validated.value as unknown as ResolvedScenario;
  const composed = compose({
    lane_width_m: resolved.road.lane_width_m,
    bike_margin_m: resolved.road.bike_margin_m,
    use_full_width: resolved.road.use_full_width,
    // ResolvedRoadSpec.segments is opaque at core rank (ARCHITECTURE §4);
    // validate() built it from road/'s own Segment union
    segments: resolved.road.segments as readonly Segment[]
  });
  if (!composed.ok) return composed;

  const lineR = executeLine({
    validated: validated.value,
    policy: "clean",
    source: { kind: "scenario", scenario },
    constraints: null,
    brake_gap_m: figureBrakeGap(composed.value)
  });
  if (!lineR.ok) return lineR;
  const line = relabel(lineR.value, resolved.id, "ideal", resolved.id);

  return ok(
    buildFigureResult({
      figure_id: opts?.figure_id ?? resolved.id,
      road: composed.value,
      occluders: resolved.occluders,
      hazards: resolved.hazards,
      lines: [line],
      skew: null
    })
  );
}

// -- composed solver input: the delegate-to-solve rule -----------------------

function runComposed(
  spec: SolveInput & { readonly line_id?: string },
  opts?: RunOptions
): Result<FigureResult> {
  // `line_id` (--line-id, design/08 §4.1) names the primary authored line; it
  // is stripped BEFORE the solver so it never rides source.solveSpec (ids live
  // outside every hash, 05 §8.3). Engine-truth default stays "solved" (the
  // blessed goldens' id; 08 §4.1's letter says "ideal" — that spelling is this
  // envelope's ROLE).
  const { mistake, line_id, ...baseSpec } = spec;
  const primaryId = line_id ?? "solved";
  if (mistake !== undefined && primaryId === mistake.kind) {
    // 08 §4.1: generated mistake ids are predictable; a remaining collision is
    // DUP_ID with the rename hint.
    return err({
      code: "DUP_ID",
      at: "line_id",
      message: `--line-id "${primaryId}" collides with the mistake line's generated id — name lines explicitly via the token's <line_id>= prefix`,
      detail: { reason: "line_id_collides_with_mistake", line_id: primaryId }
    });
  }
  const solvedR = routeSolve(baseSpec);
  if (!solvedR.ok) return solvedR;
  const base = relabel(solvedR.value, primaryId, "ideal");

  const lines: LineEntry[] = [base];
  if (mistake !== undefined) {
    const compiled = compileMistake(mistake.kind, mistake.params, {
      base,
      spec: baseSpec,
      ...(mistake.scope !== undefined ? { scope: mistake.scope } : {}),
      line_id: mistake.kind
    });
    if (compiled.ok) lines.push(compiled.value.line);
    else lines.push(buildLineRefusal(mistake.kind, "mistake", compiled.error));
  }

  const composed = composeSpecRoad(spec.road);
  if (!composed.ok) return composed;
  return ok(
    buildFigureResult({
      figure_id: opts?.figure_id ?? "run",
      road: composed.value,
      occluders: base.resolved_scenario.occluders,
      hazards: base.resolved_scenario.hazards,
      lines,
      skew: null
    })
  );
}

// -- FigureSpec: the multi-line bake path ------------------------------------

function runFigure(
  json: Record<string, unknown>,
  engine_semver: string,
  opts?: RunOptions
): Result<FigureResult> {
  const stampsR = extractStamps(json);
  if (!stampsR.ok) return stampsR;
  const stamps = stampsR.value;

  const figR = validateFigureSpec(json);
  if (!figR.ok) return figR;
  const fig = figR.value;

  const worldR = composeWorld(fig);
  if (!worldR.ok) return worldR;
  const world = worldR.value;
  const figRoadCanon = canonOf(fig.road);

  // the reference line a MistakeSpec entry compiles against: the figure's
  // first ride (SolveSpec) line (design/04 §7)
  const firstRideIndex = fig.lines.findIndex((l) => isSolveSpec(l.spec));
  if (fig.lines.some((l) => isMistakeSpec(l.spec)) && firstRideIndex < 0) {
    return err(
      schemaErr("lines", 'no reference line; a mistake needs a first "ride" entry to compile against', "figure_no_reference_line")
    );
  }

  const entries: LineEntry[] = [];
  let firstRideResult: LineResult | null = null;
  let firstRideSpec: SolveInput | null = null;

  for (const line of fig.lines) {
    const lineStamps = stamps.byLine.get(line.name);

    if (isSolveSpec(line.spec)) {
      const specR = figureLineSolveSpec(line.spec, fig, figRoadCanon, line.name);
      if (!specR.ok) {
        entries.push(buildLineRefusal(line.name, line.role, specR.error));
        continue;
      }
      const ran = runSolveLine(specR.value, world, lineStamps, engine_semver, stamps.engine_semver);
      if (!ran.ok) {
        entries.push(buildLineRefusal(line.name, line.role, ran.error));
        continue;
      }
      const relabeled = relabel(ran.value.line, line.name, line.role);
      entries.push(relabeled);
      if (firstRideResult === null) {
        firstRideResult = relabeled;
        firstRideSpec = specR.value;
      }
      continue;
    }

    if (isMistakeSpec(line.spec)) {
      if (firstRideResult === null || firstRideSpec === null) {
        entries.push(
          buildLineRefusal(
            line.name,
            line.role,
            schemaErr(`lines.${line.name}`, "the figure's first ride line was refused — nothing to compile the mistake against", "mistake_base_refused")
          )
        );
        continue;
      }
      // warm-cache fast path (05 §8.1): honour a valid `solved` stamp — run the
      // engine ONCE on the cached plan with the mistake `source` PRESERVED
      // (reconstructMistakeSource) instead of re-running the search. Guarded by
      // classifySolvedCache (spec_hash match) AND the replayed outcome+result_hash
      // matching `expected`; either miss falls through to a full compile.
      if (lineStamps?.solved !== undefined && lineStamps.expected !== undefined) {
        const source = reconstructMistakeSource(line.spec, firstRideResult, lineStamps.solved.plan);
        const cache = classifySolvedCache({
          solved: lineStamps.solved,
          spec_engine_semver: stamps.engine_semver,
          engine_semver,
          recomputed_spec_hash: recomputeLineSpecHash(world, source)
        });
        if (cache === "hit") {
          const cachedR = executeCachedPlan(firstRideSpec, lineStamps.solved, source, world, "clean");
          if (
            cachedR.ok &&
            cachedR.value.verdict.outcome === lineStamps.expected.outcome &&
            cachedR.value.verdict.result_hash === lineStamps.expected.result_hash
          ) {
            const label = printMistakeToken({
              // the stamp round-tripped, so the kind is a validated MistakeKind
              // (MistakeSpec.kind stays `string` to avoid a types.ts→mistakes.ts cycle)
              kind: line.spec.kind as MistakeKind,
              ...(line.spec.params !== undefined ? { params: stringifyParams(line.spec.params) } : {}),
              ...(line.spec.scope !== undefined ? { scope: line.spec.scope } : {})
            });
            entries.push(relabel(withCache(cachedR.value, "hit"), line.name, line.role, label));
            continue;
          }
        }
        // spec_hash miss or divergence → fall through to the full compile below
      }
      const compiled = compileMistake(line.spec.kind, line.spec.params, {
        base: firstRideResult,
        spec: firstRideSpec,
        ...(line.spec.scope !== undefined ? { scope: line.spec.scope } : {}),
        line_id: line.name,
        role: line.role
      });
      if (compiled.ok) entries.push(compiled.value.line);
      else entries.push(buildLineRefusal(line.name, line.role, compiled.error));
      continue;
    }

    // explicit wire Scenario line ("plan" kind)
    const scenario = line.spec as Scenario;
    if (canonOf(scenario.road) !== figRoadCanon) {
      entries.push(
        buildLineRefusal(
          line.name,
          line.role,
          schemaErr(`lines.${line.name}.road`, "one road per figure — a scenario line must share the figure's road (05 §7)", "line_road_differs")
        )
      );
      continue;
    }
    const config = scenario.config;
    const expectErr = resolveExpectFail(scenario.expect_fail, config?.rubric, `lines.${line.name}`);
    if (expectErr !== null) {
      entries.push(buildLineRefusal(line.name, line.role, expectErr));
      continue;
    }
    const validated = validate(scenario as unknown as Record<string, unknown>);
    if (!validated.ok) {
      entries.push(buildLineRefusal(line.name, line.role, validated.error));
      continue;
    }
    const executed = executeLine({
      validated: validated.value,
      policy: "clean",
      source: { kind: "scenario", scenario },
      constraints: null,
      brake_gap_m: figureBrakeGap(world.road)
    });
    if (!executed.ok) {
      entries.push(buildLineRefusal(line.name, line.role, executed.error));
      continue;
    }
    entries.push(relabel(executed.value, line.name, line.role));
  }

  // version skew (05 §8.4) — refusals carry no recomputed identity to compare
  const skewInputs: SkewLineInput[] = entries.filter((e) => !isLineRefusal(e)).map((e) => {
    const lr = e as LineResult;
    return {
      line_id: lr.line_id,
      expected: stamps.byLine.get(lr.line_id)?.expected,
      got: { outcome: lr.verdict.outcome, result_hash: lr.verdict.result_hash }
    };
  });
  const skew = evaluateSkew(stamps.engine_semver, engine_semver, skewInputs);

  return ok(
    buildFigureResult({
      figure_id: stamps.figure_id ?? opts?.figure_id ?? "figure",
      road: world.road,
      occluders: world.occluders,
      hazards: world.hazards,
      lines: entries,
      skew,
      meta: {
        ...(fig.note !== undefined ? { caption: fig.note } : {}),
        ...(fig.view !== undefined ? { view: fig.view } : {})
      }
    })
  );
}

// ---------------------------------------------------------------------------
// Figure-line spec shaping

function isSolveSpec(spec: SolveSpec | MistakeSpec | Scenario): spec is SolveSpec {
  return "entry_kmh" in spec;
}

function isMistakeSpec(spec: SolveSpec | MistakeSpec | Scenario): spec is MistakeSpec {
  return "kind" in spec && !("entry_kmh" in spec) && !("rider" in spec);
}

/**
 * One road per figure (05 §7): the line's own road must equal the figure's
 * (lowerScene injects it, so scene-lowered specs match by construction); the
 * figure's occluders/hazards ride every line that names none of its own.
 */
function figureLineSolveSpec(
  spec: SolveSpec,
  fig: FigureSpec,
  figRoadCanon: string,
  name: string
): Result<SolveInput> {
  if (canonOf(wireRoadSpecOf(spec.road)) !== canonOf(fig.road) && canonOf(spec.road) !== figRoadCanon) {
    return err(
      schemaErr(`lines.${name}.road`, "one road per figure — a line's road must equal the figure's (05 §7)", "line_road_differs")
    );
  }
  if (spec.mistake !== undefined) {
    return err(
      schemaErr(`lines.${name}.mistake`, "inside a figure a mistake rides its own line entry, never a ride line's field", "mistake_rides_its_own_line")
    );
  }
  return ok({
    ...spec,
    road: fig.road,
    ...(spec.occluders === undefined && fig.occluders !== undefined ? { occluders: fig.occluders } : {}),
    ...(spec.hazards === undefined && fig.hazards !== undefined ? { hazards: fig.hazards } : {})
  });
}
