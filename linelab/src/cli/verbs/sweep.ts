// cli/verbs/sweep.ts — the `sweep` verb (design/08 §3 verb table + §4.3, the
// v0.2 inspection phase, 00 §3).
//
//   sweep <base> --param <root-path> --range a:b:step [--param2 … --range2 …]
//         [--metric list] [--line <id>] [--format tsv|json] [--out <file>]
//
// "Grid-sweep 1–2 root-qualified paths over any composable base — scenario
// JSON, FigureSpec JSON, `.scene`, stdin, or the full zero-file flag set —
// holding everything else fixed per the root's recompute rule. One JSON table
// of closed-vocabulary metrics per cell; capped grid with an explicit
// `truncated` flag." (§3's verb row.)
//
// The property a shell loop over `run` cannot give is the HOLD-FIXED column of
// §4.3's per-root table, and the one place it is semantically (not merely
// economically) load-bearing is `plan.`: "engine run only — the plan is
// explicit, THE SOLVER IS BYPASSED (base = the line's `resolved_scenario`)".
// So `plan.` solves the base exactly ONCE, then re-runs the resolved wire
// scenario per cell — `run()`'s `rider`-shaped path, which never delegates
// (08 §3.1). Every other root recomputes its own pipeline per cell, which for
// a deterministic engine (§6.2) yields byte-identical held-fixed lines.
//
// D8, and the reason a one-row sweep is a refusal rather than a table: a grid
// with a single cell varies nothing — it is a `run` wearing a sweep's clothes,
// "input that would validate but provably do nothing". It is rejected
// INEFFECTUAL naming the dead range, never silently emitted.
//
// Pure (ARCHITECTURE §2): main.ts hands the already-read text in and turns the
// returned VerbOutcome into stdout bytes, one file write, and an exit code.

import type { LinelabError, Result } from "../../core/result.js";
import { ok, err } from "../../core/result.js";
import { lowerScene } from "../../plan/scene.js";
import type { ResolvedScenario } from "../../core/types.js";
import { emissionDpFor } from "../../solve/emit.js";
import { isLineRefusal } from "../../solve/envelope.js";
import { run, type RunOptions } from "../../solve/run.js";
import type { CornerVerdict, FigureResult, LineEntry, LineResult } from "../../solve/types.js";
import type { ApexPoint } from "../../core/analyze.js";
import { EXIT } from "../exit.js";
import { parseZeroFileFlags, mergeDraftOverLoaded } from "../args.js";
import { errOutcome, okOutcome, isObject, looksLikeJson, parseJson, schemaErr, type VerbOutcome } from "./shared.js";

// ---------------------------------------------------------------------------
// Constants owned by design/08 (§4.3). ARCHITECTURE §6.6 addresses 08's
// constants to `cli/`; this build's `cli/` has no shared constants.ts, so the
// value is declared at its sole consumer with the design citation attached.

/** design/08 §4.3 — TUNING. Grids larger than this are truncated with `truncated: true`. */
export const SWEEP_MAX_CELLS = 2500;

/** design/08 §4.3 — the closed metric vocabulary, copied verbatim in the doc's order. */
export const SWEEP_METRICS = [
  "outcome",
  "apex_pct",
  "apex_f",
  "v_apex_kmh",
  "lean_max_deg",
  "grip_min",
  "exit_f",
  "sight_margin_min_m",
  "end_s",
  "end_reason",
  "acceptance_met",
  "apex_count",
  "s_divergence_m"
] as const;
export type SweepMetric = (typeof SWEEP_METRICS)[number];

/** design/08 §4.3 — "Default `outcome,apex_pct,grip_min`." */
export const SWEEP_DEFAULT_METRICS: readonly SweepMetric[] = ["outcome", "apex_pct", "grip_min"];

/** design/08 §4.3 — the closed root set of the sweep-path grammar (D34). */
export const SWEEP_ROOTS = ["plan", "scenario", "config", "ride", "mistake", "constraint", "believe"] as const;
export type SweepRoot = (typeof SWEEP_ROOTS)[number];

/** `scenario.` addresses exactly the two rider.start scalars. */
const SCENARIO_FIELDS = ["entry_kmh", "start_f"] as const;
/** `config.` addresses exactly the one numeric config field. */
const CONFIG_FIELDS = ["mu"] as const;
/** `ride.` addresses the solve-spec intent scalars. */
const RIDE_FIELDS = ["vis_margin", "vis_hold_f", "turn_in_s"] as const;
/** `mistake.` params (design/08 §4.3's inline list). */
const MISTAKE_PARAMS = ["early_by_m", "roll_rate_factor", "facets", "offset_m", "freeze_s", "by_kmh"] as const;
/** `believe.` belief params (04 §4.6 / 03 §7.4's underread|overread sugar). */
const BELIEVE_FIELDS = ["r_believed", "sweep_believed_deg"] as const;

// ---------------------------------------------------------------------------
// The sweep-path grammar (design/08 §4.3, verbatim production)

export type SweepPath =
  | { readonly root: "plan"; readonly actionId: string; readonly field: string }
  | { readonly root: "scenario"; readonly field: (typeof SCENARIO_FIELDS)[number] }
  | { readonly root: "config"; readonly field: (typeof CONFIG_FIELDS)[number] }
  | { readonly root: "ride"; readonly field: (typeof RIDE_FIELDS)[number] }
  | { readonly root: "mistake"; readonly lineId: string; readonly param: string }
  | { readonly root: "constraint"; readonly constraintId: string }
  | { readonly root: "believe"; readonly field: (typeof BELIEVE_FIELDS)[number] };

function rootUnknown(at: string, root: string): LinelabError {
  return schemaErr(
    at,
    `unknown sweep root "${root}" — the closed set is ${SWEEP_ROOTS.map((r) => `${r}.`).join(" | ")}`,
    "sweep_root_unknown",
    { root, roots: SWEEP_ROOTS }
  );
}

function fieldNotNumeric(at: string, path: string, detail: Record<string, unknown>): LinelabError {
  return schemaErr(at, `"${path}" does not address a numeric, sweepable field`, "sweep_field_not_numeric", detail);
}

function unknownId(at: string, message: string, reason: string, detail?: Record<string, unknown>): LinelabError {
  return { code: "UNKNOWN_ID", at, message, detail: { reason, ...detail } };
}

/** `sweep-path := <root-path>` (design/08 §4.3). Total, typed, no throwing. */
export function parseSweepPath(path: string, at: string): Result<SweepPath> {
  const parts = path.split(".");
  const root = parts[0];
  if (root === undefined || root.length === 0) return err(rootUnknown(at, path));
  if (!(SWEEP_ROOTS as readonly string[]).includes(root)) return err(rootUnknown(at, root));

  switch (root as SweepRoot) {
    case "plan": {
      if (parts.length !== 3 || parts[1]!.length === 0 || parts[2]!.length === 0) {
        return err(fieldNotNumeric(at, path, { form: "plan.<actionId>.<field>" }));
      }
      return ok({ root: "plan", actionId: parts[1]!, field: parts[2]! });
    }
    case "scenario": {
      const f = parts.slice(1).join(".");
      if (!(SCENARIO_FIELDS as readonly string[]).includes(f)) {
        return err(fieldNotNumeric(at, path, { allowed: SCENARIO_FIELDS }));
      }
      return ok({ root: "scenario", field: f as (typeof SCENARIO_FIELDS)[number] });
    }
    case "config": {
      const f = parts.slice(1).join(".");
      if (!(CONFIG_FIELDS as readonly string[]).includes(f)) {
        return err(fieldNotNumeric(at, path, { allowed: CONFIG_FIELDS }));
      }
      return ok({ root: "config", field: f as (typeof CONFIG_FIELDS)[number] });
    }
    case "ride": {
      const f = parts.slice(1).join(".");
      if (!(RIDE_FIELDS as readonly string[]).includes(f)) {
        return err(fieldNotNumeric(at, path, { allowed: RIDE_FIELDS }));
      }
      return ok({ root: "ride", field: f as (typeof RIDE_FIELDS)[number] });
    }
    case "mistake": {
      if (parts.length !== 3 || parts[1]!.length === 0) {
        return err(fieldNotNumeric(at, path, { form: "mistake.<lineId>.<param>" }));
      }
      if (!(MISTAKE_PARAMS as readonly string[]).includes(parts[2]!)) {
        return err(fieldNotNumeric(at, path, { allowed: MISTAKE_PARAMS }));
      }
      return ok({ root: "mistake", lineId: parts[1]!, param: parts[2]! });
    }
    case "constraint": {
      if (parts.length !== 3 || parts[1]!.length === 0) {
        return err(fieldNotNumeric(at, path, { form: "constraint.<constraintId>.value" }));
      }
      if (parts[2] !== "value") return err(fieldNotNumeric(at, path, { allowed: ["value"] }));
      return ok({ root: "constraint", constraintId: parts[1]! });
    }
    case "believe": {
      const f = parts.slice(1).join(".");
      if (!(BELIEVE_FIELDS as readonly string[]).includes(f)) {
        return err(fieldNotNumeric(at, path, { allowed: BELIEVE_FIELDS }));
      }
      return ok({ root: "believe", field: f as (typeof BELIEVE_FIELDS)[number] });
    }
  }
}

// ---------------------------------------------------------------------------
// Ranges

export interface SweepRange {
  readonly from: number;
  readonly to: number;
  readonly step: number;
}

/** `--range a:b:step`. `step ≤ 0` or an inverted range is `BAD_RANGE` (§4.3). */
export function parseSweepRange(text: string, at: string): Result<SweepRange> {
  const parts = text.split(":");
  if (parts.length !== 3) {
    return err(schemaErr(at, `--range must be "a:b:step" (got "${text}")`, "sweep_range_malformed"));
  }
  const nums = parts.map((p) => Number(p));
  if (nums.some((n) => !Number.isFinite(n))) {
    return err(schemaErr(at, `--range "${text}" carries a non-numeric bound`, "sweep_range_malformed"));
  }
  const [from, to, step] = nums as [number, number, number];
  if (!(step > 0)) {
    return err({ code: "BAD_RANGE", at, message: `--range step must be > 0 (got ${step})`, detail: { reason: "sweep_step_nonpositive", step } });
  }
  if (to < from) {
    return err({ code: "BAD_RANGE", at, message: `--range is inverted (${from} > ${to})`, detail: { reason: "sweep_range_inverted", from, to } });
  }
  return ok({ from, to, step });
}

/** The grid values of one param, inclusive of `to` within a step epsilon. */
export function gridValues(range: SweepRange): readonly number[] {
  const out: number[] = [];
  const n = Math.floor((range.to - range.from) / range.step + 1e-9);
  for (let i = 0; i <= n; i++) out.push(Number((range.from + i * range.step).toFixed(9)));
  return out;
}

/**
 * The grid, capped. design/08 §4.3: "grid cells > `sweep_max_cells = 2500`
 * (TUNING) → grid truncated with `truncated: true`". ARCHITECTURE §10 pin #22
 * fixes WHICH cells survive: "the first `sweep_max_cells` cells in row-major
 * (param-1 outer) order". Pure, so the cap is testable without spending 2500
 * engine runs on it.
 */
export function gridCells(
  v1: readonly number[],
  v2: readonly number[] | undefined,
  max: number = SWEEP_MAX_CELLS
): { readonly at: readonly number[][]; readonly truncated: boolean } {
  const at: number[][] = [];
  const total = v1.length * (v2?.length ?? 1);
  outer: for (const a of v1) {
    if (v2 === undefined) {
      if (at.length >= max) break outer;
      at.push([a]);
      continue;
    }
    for (const b of v2) {
      if (at.length >= max) break outer;
      at.push([a, b]);
    }
  }
  return { at, truncated: total > max };
}

// ---------------------------------------------------------------------------
// Metric extraction (design/08 §4.3's sourcing rules)

type MetricValue = string | number | boolean | null;

function finalApex(corners: readonly CornerVerdict[]): ApexPoint | null {
  for (let i = corners.length - 1; i >= 0; i--) {
    const apexes = corners[i]!.apexes;
    if (apexes.length > 0) return apexes[apexes.length - 1]!;
  }
  return null;
}

/** ARCHITECTURE §6.3's emission policy, per metric key (`apex_pct` is the 1-dp pct bucket). */
function roundMetric(name: SweepMetric, x: number): number {
  const dp = name === "apex_pct" ? 1 : emissionDpFor(name);
  const r = Number(x.toFixed(dp));
  return Object.is(r, -0) ? 0 : r;
}

/**
 * One line's metric row. `apex_pct` / `apex_f` / `v_apex_kmh` read the FINAL
 * entry of `corners[].apexes[]` and are `null` when the list is empty
 * (design/08 §4.3, the same final-apex rule `late_apex` uses).
 */
export function metricsOf(line: LineResult, metrics: readonly SweepMetric[]): Readonly<Record<string, MetricValue>> {
  const v = line.verdict;
  const apex = finalApex(v.corners);
  const lastCorner = v.corners[v.corners.length - 1];
  const row: Record<string, MetricValue> = {};
  for (const m of metrics) {
    switch (m) {
      case "outcome":
        row[m] = v.outcome;
        break;
      case "apex_pct":
        row[m] = apex === null ? null : roundMetric(m, apex.pct);
        break;
      case "apex_f":
        row[m] = apex === null ? null : roundMetric(m, apex.f);
        break;
      case "v_apex_kmh":
        row[m] = apex === null ? null : roundMetric(m, apex.v_kmh);
        break;
      case "lean_max_deg":
        row[m] =
          v.corners.length === 0 ? null : roundMetric(m, Math.max(...v.corners.map((c) => c.lean_max_deg)));
        break;
      case "grip_min":
        row[m] = v.corners.length === 0 ? null : roundMetric(m, Math.min(...v.corners.map((c) => c.grip_min)));
        break;
      case "exit_f":
        row[m] = lastCorner === undefined ? null : roundMetric(m, lastCorner.exit.f);
        break;
      case "sight_margin_min_m":
        row[m] = v.sight === null ? null : roundMetric(m, v.sight.margin_min_m);
        break;
      case "end_s":
        row[m] = roundMetric(m, line.trajectory.terminated.s);
        break;
      case "end_reason":
        row[m] = line.trajectory.terminated.reason;
        break;
      case "acceptance_met":
        row[m] = v.acceptance.met;
        break;
      case "apex_count":
        row[m] = v.corners.reduce((sum, c) => sum + c.apexes.length, 0);
        break;
      case "s_divergence_m":
        row[m] = v.misjudgment === null ? null : roundMetric(m, v.misjudgment.s_divergence_m);
        break;
    }
  }
  return row;
}

/**
 * The refusal row: `outcome: "no_solution"` with every other column `null`.
 * design/08 §4.3 spells this for `constraint.`; it is the honest general shape
 * for any cell the solver refused — "never a verb failure".
 */
function refusedRow(metrics: readonly SweepMetric[]): Readonly<Record<string, MetricValue>> {
  const row: Record<string, MetricValue> = {};
  for (const m of metrics) row[m] = m === "outcome" ? "no_solution" : null;
  return row;
}

// ---------------------------------------------------------------------------
// Base shapes

type BaseKind = "figure" | "scenario" | "composed";

function baseKindOf(base: Record<string, unknown>): BaseKind {
  if ("lines" in base) return "figure";
  if ("rider" in base) return "scenario";
  return "composed";
}

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

function isSolveSpecLike(spec: Record<string, unknown>): boolean {
  return "entry_kmh" in spec;
}
function isMistakeSpecLike(spec: Record<string, unknown>): boolean {
  return "kind" in spec && !("entry_kmh" in spec) && !("rider" in spec);
}

/** Every SolveSpec-shaped line spec of a FigureSpec base, with its name. */
function figureRideSpecs(base: Record<string, unknown>): { name: string; spec: Record<string, unknown> }[] {
  const lines = base["lines"];
  if (!Array.isArray(lines)) return [];
  const out: { name: string; spec: Record<string, unknown> }[] = [];
  for (const l of lines) {
    if (!isObject(l) || typeof l["name"] !== "string" || !isObject(l["spec"])) continue;
    if (isSolveSpecLike(l["spec"])) out.push({ name: l["name"], spec: l["spec"] });
  }
  return out;
}

function lineSelectorRequired(at: string, ids: readonly string[]): LinelabError {
  return schemaErr(
    at,
    `this base carries several solver lines — pass --line (available: ${ids.join(", ")})`,
    "line_selector_required",
    { available: ids }
  );
}

/**
 * §4.3's line scoping: `plan.`, `ride.`, `constraint.` and `believe.` resolve
 * against the `--line`-selected line; default = the sole solver line;
 * ambiguous → SCHEMA/line_selector_required.
 */
function selectRideSpec(
  base: Record<string, unknown>,
  requested: string | undefined,
  at: string
): Result<{ readonly name: string; readonly spec: Record<string, unknown> }> {
  if (baseKindOf(base) !== "figure") {
    if (!("entry_kmh" in base)) {
      return err(unknownId(at, "this base carries no solver line to address", "sweep_no_solver_line"));
    }
    if (requested !== undefined) {
      const id = typeof base["line_id"] === "string" ? (base["line_id"] as string) : "solved";
      if (requested !== id) {
        return err(unknownId(at, `unknown line "${requested}" (the composed base's solver line is "${id}")`, "unknown_line_id", { available: [id] }));
      }
    }
    return ok({ name: typeof base["line_id"] === "string" ? (base["line_id"] as string) : "solved", spec: base });
  }
  const rides = figureRideSpecs(base);
  if (rides.length === 0) return err(unknownId(at, "this figure carries no ride line to address", "sweep_no_solver_line"));
  if (requested !== undefined) {
    const found = rides.find((r) => r.name === requested);
    if (found === undefined) {
      return err(unknownId(at, `unknown line "${requested}" (available: ${rides.map((r) => r.name).join(", ")})`, "unknown_line_id", { available: rides.map((r) => r.name) }));
    }
    return ok(found);
  }
  if (rides.length > 1) return err(lineSelectorRequired(at, rides.map((r) => r.name)));
  return ok(rides[0]!);
}

// ---------------------------------------------------------------------------
// Per-root mutation (the "per-cell work" column of §4.3's table)

function setScenarioScalar(base: Record<string, unknown>, field: "entry_kmh" | "start_f", value: number): void {
  const kind = baseKindOf(base);
  if (kind === "scenario") {
    const rider = isObject(base["rider"]) ? (base["rider"] as Record<string, unknown>) : {};
    const start = isObject(rider["start"]) ? (rider["start"] as Record<string, unknown>) : {};
    start[field === "entry_kmh" ? "speed_kmh" : "f"] = value;
    rider["start"] = start;
    base["rider"] = rider;
    return;
  }
  if (kind === "composed") {
    base[field] = value;
    return;
  }
  // FIGURE-WIDE (§4.3: "on a multi-line base they apply to EVERY line")
  const lines = base["lines"] as unknown[];
  for (const l of lines) {
    if (!isObject(l) || !isObject(l["spec"])) continue;
    const spec = l["spec"] as Record<string, unknown>;
    if (isSolveSpecLike(spec)) spec[field] = value;
    else if (isObject(spec["rider"])) {
      const rider = spec["rider"] as Record<string, unknown>;
      const start = isObject(rider["start"]) ? (rider["start"] as Record<string, unknown>) : {};
      start[field === "entry_kmh" ? "speed_kmh" : "f"] = value;
      rider["start"] = start;
    }
  }
}

function setConfigMu(base: Record<string, unknown>, value: number): void {
  const kind = baseKindOf(base);
  if (kind === "scenario") {
    const config = isObject(base["config"]) ? (base["config"] as Record<string, unknown>) : {};
    config["mu"] = value;
    base["config"] = config;
    return;
  }
  if (kind === "composed") {
    base["mu"] = value;
    return;
  }
  for (const l of base["lines"] as unknown[]) {
    if (!isObject(l) || !isObject(l["spec"])) continue;
    const spec = l["spec"] as Record<string, unknown>;
    if (isSolveSpecLike(spec)) spec["mu"] = value;
    else if (isObject(spec["config"])) (spec["config"] as Record<string, unknown>)["mu"] = value;
    else if ("rider" in spec) spec["config"] = { mu: value };
  }
}

/** `mistake.<lineId>.<param>` — the addressed mistake line's params. */
function mistakeParamsOf(
  base: Record<string, unknown>,
  lineId: string,
  at: string
): Result<Record<string, unknown>> {
  if (baseKindOf(base) === "figure") {
    for (const l of base["lines"] as unknown[]) {
      if (!isObject(l) || l["name"] !== lineId || !isObject(l["spec"])) continue;
      const spec = l["spec"] as Record<string, unknown>;
      if (!isMistakeSpecLike(spec)) break;
      const params = isObject(spec["params"]) ? (spec["params"] as Record<string, unknown>) : {};
      spec["params"] = params;
      return ok(params);
    }
    return err(unknownId(at, `no mistake line named "${lineId}" in this figure`, "unknown_line_id", { line_id: lineId }));
  }
  const mistake = base["mistake"];
  if (!isObject(mistake)) {
    return err(unknownId(at, "this base carries no mistake line to address", "unknown_line_id", { line_id: lineId }));
  }
  // 08 §4.1's generated-id rule: an unnamed `--mistake` line's id is its kind
  if (mistake["kind"] !== lineId) {
    return err(
      unknownId(at, `unknown mistake line "${lineId}" (this base's mistake line is "${String(mistake["kind"])}")`, "unknown_line_id", {
        available: [String(mistake["kind"])]
      })
    );
  }
  const params = isObject(mistake["params"]) ? (mistake["params"] as Record<string, unknown>) : {};
  mistake["params"] = params;
  return ok(params);
}

/** `believe.<field>` — the belief params of the addressed misjudge (underread|overread) line. */
function beliefParamsOf(base: Record<string, unknown>, at: string): Result<Record<string, unknown>> {
  const isMisjudgeKind = (k: unknown): boolean => k === "underread" || k === "overread";
  if (baseKindOf(base) === "figure") {
    for (const l of base["lines"] as unknown[]) {
      if (!isObject(l) || !isObject(l["spec"])) continue;
      const spec = l["spec"] as Record<string, unknown>;
      if (isMistakeSpecLike(spec) && isMisjudgeKind(spec["kind"])) {
        const params = isObject(spec["params"]) ? (spec["params"] as Record<string, unknown>) : {};
        spec["params"] = params;
        return ok(params);
      }
    }
    return err(unknownId(at, "this figure carries no believed-road (underread|overread) line", "sweep_no_belief_line"));
  }
  const mistake = base["mistake"];
  if (isObject(mistake) && isMisjudgeKind(mistake["kind"])) {
    const params = isObject(mistake["params"]) ? (mistake["params"] as Record<string, unknown>) : {};
    mistake["params"] = params;
    return ok(params);
  }
  return err(unknownId(at, "this base carries no believed-road (underread|overread) line", "sweep_no_belief_line"));
}

// ---------------------------------------------------------------------------
// Cell preparation

interface DirectPrep {
  readonly kind: "direct";
  readonly base: Record<string, unknown>;
}
interface ResolvedPrep {
  readonly kind: "resolved";
  /** the addressed line's `resolved_scenario` — the solver already ran, once */
  readonly scenario: ResolvedScenario;
  readonly lineId: string;
}
type Prep = DirectPrep | ResolvedPrep;

/**
 * A `resolved_scenario` re-emitted as a RUNNABLE wire document: the wire `road`
 * union takes exactly one of segments|preset|dsl (03 §2.1) while a resolved
 * road carries both `segments` and `dsl`, so the disclosed DSL alone is
 * re-emitted. Identical projection to `export --as scenario`
 * (cli/verbs/export.ts), which 09's `A-RESOLVED-RERUN` pins — one shape, two
 * consumers.
 */
function runnableScenario(rs: ResolvedScenario, lineId: string): Record<string, unknown> {
  return clone({
    ...rs,
    spec: "linelab/1",
    id: lineId,
    road: { dsl: rs.road.dsl, use_full_width: rs.road.use_full_width, bike_margin_m: rs.road.bike_margin_m }
  }) as unknown as Record<string, unknown>;
}

function firstLineResult(env: FigureResult, requested: string | undefined): LineResult | null {
  const drawn = env.lines.filter((l): l is LineResult => !isLineRefusal(l));
  if (requested !== undefined) return drawn.find((l) => l.line_id === requested) ?? null;
  return drawn[0] ?? null;
}

// ---------------------------------------------------------------------------
// The verb

export interface SweepVerbInput {
  readonly loadedText?: string;
  readonly argv: readonly string[];
  readonly engineSemver: string;
}

interface CellRow {
  readonly at: readonly number[];
  readonly per_line: Readonly<Record<string, Readonly<Record<string, MetricValue>>>>;
}

export function sweepVerb(input: SweepVerbInput): VerbOutcome {
  const parsed = parseZeroFileFlags(input.argv);
  if (!parsed.ok) return errOutcome(parsed.error);
  const flags = parsed.value;

  // -- flag shape -----------------------------------------------------------
  if (flags.param === undefined) {
    return errOutcome(schemaErr("--param", "sweep needs --param <root-path> --range a:b:step", "sweep_param_missing"));
  }
  if (flags.range === undefined) {
    return errOutcome(schemaErr("--range", `--param "${flags.param}" has no --range`, "sweep_range_missing"));
  }
  if (flags.param2 !== undefined && flags.range2 === undefined) {
    return errOutcome(schemaErr("--range2", `--param2 "${flags.param2}" has no --range2`, "sweep_range_missing"));
  }
  if (flags.range2 !== undefined && flags.param2 === undefined) {
    // D8: legal-but-inert — a range with nothing to range over
    return errOutcome({
      code: "INEFFECTUAL",
      at: "--range2",
      message: "--range2 has no --param2 to range over",
      detail: { reason: "sweep_range2_without_param2" }
    });
  }
  if (flags.format === "tsv" && flags.out === undefined) {
    return errOutcome(schemaErr("--format", "--format tsv requires --out (stdout stays the JSON document)", "sweep_tsv_requires_out"));
  }

  // -- metric columns -------------------------------------------------------
  let metrics: readonly SweepMetric[] = SWEEP_DEFAULT_METRICS;
  if (flags.metric !== undefined) {
    const named = flags.metric.split(",").map((m) => m.trim()).filter((m) => m.length > 0);
    const bad = named.find((m) => !(SWEEP_METRICS as readonly string[]).includes(m));
    if (bad !== undefined) {
      return errOutcome(
        schemaErr("--metric", `unknown sweep metric "${bad}" — the closed set is ${SWEEP_METRICS.join(", ")}`, "sweep_metric_unknown", {
          metrics: SWEEP_METRICS
        })
      );
    }
    if (named.length === 0) {
      return errOutcome({
        code: "INEFFECTUAL",
        at: "--metric",
        message: "--metric named no column",
        detail: { reason: "sweep_metric_empty" }
      });
    }
    metrics = named as readonly SweepMetric[];
  }

  // -- paths & ranges -------------------------------------------------------
  const p1 = parseSweepPath(flags.param, "--param");
  if (!p1.ok) return errOutcome(p1.error);
  const r1 = parseSweepRange(flags.range, "--range");
  if (!r1.ok) return errOutcome(r1.error);
  let p2: SweepPath | undefined;
  let r2: SweepRange | undefined;
  if (flags.param2 !== undefined && flags.range2 !== undefined) {
    const pr = parseSweepPath(flags.param2, "--param2");
    if (!pr.ok) return errOutcome(pr.error);
    const rr = parseSweepRange(flags.range2, "--range2");
    if (!rr.ok) return errOutcome(rr.error);
    p2 = pr.value;
    r2 = rr.value;
  }

  const v1 = gridValues(r1.value);
  const v2 = r2 !== undefined ? gridValues(r2) : undefined;
  // D8 — schema-valid implies effectual: a param that takes one value varies
  // nothing, so the whole sweep would be a `run` in disguise.
  if (v1.length < 2) {
    return errOutcome({
      code: "INEFFECTUAL",
      at: "--range",
      message: `--range ${flags.range} yields a single cell — a sweep that cannot vary its parameter is a \`run\``,
      detail: { reason: "sweep_range_ineffectual", path: flags.param, cells: v1.length }
    });
  }
  if (v2 !== undefined && v2.length < 2) {
    return errOutcome({
      code: "INEFFECTUAL",
      at: "--range2",
      message: `--range2 ${flags.range2} yields a single cell — a sweep that cannot vary its parameter is a \`run\``,
      detail: { reason: "sweep_range_ineffectual", path: flags.param2, cells: v2.length }
    });
  }

  // -- the composable base (design/08 §4.2's merge law) ----------------------
  let loaded: unknown;
  if (input.loadedText !== undefined) {
    if (looksLikeJson(input.loadedText)) {
      const j = parseJson(input.loadedText, "input");
      if (!j.ok) return errOutcome(j.error);
      loaded = j.value;
    } else {
      const lowered = lowerScene(input.loadedText);
      if (!lowered.ok) return errOutcome(lowered.error);
      loaded = lowered.value;
    }
  }
  const composedBase = mergeDraftOverLoaded(loaded, flags.draft);
  if (Object.keys(composedBase).length === 0) {
    return errOutcome(schemaErr("input", "sweep needs a base — a file, stdin, or the zero-file flag set", "sweep_base_missing"));
  }

  const runOpts: RunOptions = { engine_semver: input.engineSemver, figure_id: "sweep" };

  // -- prepare (the per-root "held fixed" column of §4.3) --------------------
  const prep = prepare(composedBase, p1.value, p2, flags.line, runOpts);
  if (!prep.ok) return errOutcome(prep.error);

  // -- the grid (row-major, param-1 outer — ARCHITECTURE §10 pin #22) --------
  const grid = gridCells(v1, v2);
  // the line-id set a refused cell must still fill, so every cell of the table
  // carries the same columns (§4.3: "Columns are per line, named
  // `<line_id>.<metric>`" — a rectangular table, not a ragged one)
  const expected = expectedLineIds(composedBase, prep.value);
  const cells: CellRow[] = [];
  const lineIds: string[] = [];

  for (const at of grid.at) {
    const assign: [SweepPath, number][] = [[p1.value, at[0]!]];
    if (p2 !== undefined && at[1] !== undefined) assign.push([p2, at[1]]);
    const cell = runCell(prep.value, assign, flags.line, metrics, runOpts, expected);
    if (!cell.ok) return errOutcome(cell.error);
    for (const id of Object.keys(cell.value)) if (!lineIds.includes(id)) lineIds.push(id);
    cells.push({ at, per_line: cell.value });
  }
  const truncated = grid.truncated;

  const value = {
    kind: "sweep" as const,
    params: [
      { path: flags.param, range: r1.value },
      ...(flags.param2 !== undefined && r2 !== undefined ? [{ path: flags.param2, range: r2 }] : [])
    ],
    metrics,
    lines: lineIds,
    cells,
    truncated
  };

  const writes =
    flags.format === "tsv" && flags.out !== undefined
      ? [{ path: flags.out, content: toTsv(value.params.map((p) => p.path), lineIds, metrics, cells) }]
      : undefined;

  return okOutcome(value, writes, EXIT.OK);
}

// ---------------------------------------------------------------------------
// prepare / runCell

function prepare(
  base: Record<string, unknown>,
  path1: SweepPath,
  path2: SweepPath | undefined,
  line: string | undefined,
  runOpts: RunOptions
): Result<Prep> {
  const paths = path2 === undefined ? [path1] : [path1, path2];
  const planPath = paths.find((p): p is Extract<SweepPath, { root: "plan" }> => p.root === "plan");
  if (planPath === undefined) {
    // validate the line-scoped roots resolve on this base before spending cells
    for (const p of paths) {
      if (p.root === "ride" || p.root === "constraint") {
        const sel = selectRideSpec(base, line, `--param (${p.root}.)`);
        if (!sel.ok) return sel;
        if (p.root === "constraint") {
          const cs = sel.value.spec["constraints"];
          const found = Array.isArray(cs) && cs.some((c) => isObject(c) && c["id"] === p.constraintId);
          if (!found) {
            return err(unknownId("--param", `no constraint "${p.constraintId}" on line "${sel.value.name}"`, "unknown_constraint_id", { constraint_id: p.constraintId }));
          }
        }
      }
      if (p.root === "mistake") {
        const probe = mistakeParamsOf(clone(base), p.lineId, "--param");
        if (!probe.ok) return probe;
      }
      if (p.root === "believe") {
        const probe = beliefParamsOf(clone(base), "--param");
        if (!probe.ok) return probe;
      }
    }
    return ok({ kind: "direct", base });
  }
  if (paths.some((p) => p.root !== "plan")) {
    // §4.3: `plan.` is the one root whose per-cell work is "engine run only —
    // the solver is bypassed". Crossing it with a root that re-solves would
    // have to do both at once; that grid has no defined semantics.
    return err(
      schemaErr(
        "--param2",
        "a `plan.` sweep bypasses the solver, so it cannot be crossed with a solver-layer root in one grid",
        "sweep_plan_root_not_crossable"
      )
    );
  }
  // `plan.` — solve the base ONCE, then re-run its resolved wire scenario
  const solved = run(base, runOpts);
  if (!solved.ok) return solved;
  const target = firstLineResult(solved.value, line);
  if (target === null) {
    return err(unknownId("--line", "the base produced no drawable line to take a resolved plan from", "sweep_no_solver_line"));
  }
  const actionIds = target.resolved_scenario.rider.plan.map((a) => a.id);
  for (const p of paths) {
    if (p.root !== "plan") continue;
    const action = target.resolved_scenario.rider.plan.find((a) => a.id === p.actionId);
    if (action === undefined) {
      return err(unknownId("--param", `no plan action "${p.actionId}" on line "${target.line_id}" (available: ${actionIds.join(", ")})`, "unknown_action_id", { available: actionIds }));
    }
    if (typeof (action as unknown as Record<string, unknown>)[p.field] !== "number") {
      return err(fieldNotNumeric("--param", `plan.${p.actionId}.${p.field}`, { action_id: p.actionId, field: p.field }));
    }
  }
  return ok({ kind: "resolved", scenario: target.resolved_scenario, lineId: target.line_id });
}

/**
 * The line ids this base produces, derived from the SAME id rules `solve/run.ts`
 * applies: a FigureSpec's line `name`s; a composed input's `line_id ?? "solved"`
 * plus its mistake line's generated id (its kind, 08 §4.1); a wire scenario's
 * `id`. Used only to keep a refused cell's row rectangular.
 */
function expectedLineIds(base: Record<string, unknown>, prep: Prep): readonly string[] {
  if (prep.kind === "resolved") return [prep.lineId];
  switch (baseKindOf(base)) {
    case "figure": {
      const lines = base["lines"];
      if (!Array.isArray(lines)) return [];
      return lines.filter((l) => isObject(l) && typeof l["name"] === "string").map((l) => (l as { name: string }).name);
    }
    case "scenario":
      return [typeof base["id"] === "string" ? (base["id"] as string) : "scenario"];
    case "composed": {
      const primary = typeof base["line_id"] === "string" ? (base["line_id"] as string) : "solved";
      const mistake = base["mistake"];
      return isObject(mistake) && typeof mistake["kind"] === "string"
        ? [primary, mistake["kind"] as string]
        : [primary];
    }
  }
}

function runCell(
  prep: Prep,
  assign: readonly (readonly [SweepPath, number])[],
  line: string | undefined,
  metrics: readonly SweepMetric[],
  runOpts: RunOptions,
  expected: readonly string[]
): Result<Readonly<Record<string, Readonly<Record<string, MetricValue>>>>> {
  let input: Record<string, unknown>;
  let keyOverride: string | undefined;

  if (prep.kind === "resolved") {
    const scenario = runnableScenario(prep.scenario, prep.lineId);
    const rider = scenario["rider"] as Record<string, unknown>;
    const plan = rider["plan"] as Record<string, unknown>[];
    for (const [p, value] of assign) {
      if (p.root !== "plan") continue;
      const action = plan.find((a) => a["id"] === p.actionId);
      if (action === undefined) {
        return err(unknownId("--param", `plan action "${p.actionId}" vanished from the resolved plan`, "unknown_action_id"));
      }
      action[p.field] = value;
    }
    input = scenario;
    keyOverride = prep.lineId;
  } else {
    const base = clone(prep.base);
    for (const [p, value] of assign) {
      switch (p.root) {
        case "scenario":
          setScenarioScalar(base, p.field, value);
          break;
        case "config":
          setConfigMu(base, value);
          break;
        case "ride": {
          const sel = selectRideSpec(base, line, "--param");
          if (!sel.ok) return sel;
          sel.value.spec[p.field === "turn_in_s" ? "turn_in" : p.field] = value;
          break;
        }
        case "mistake": {
          const params = mistakeParamsOf(base, p.lineId, "--param");
          if (!params.ok) return params;
          params.value[p.param] = value;
          break;
        }
        case "constraint": {
          const sel = selectRideSpec(base, line, "--param");
          if (!sel.ok) return sel;
          const cs = sel.value.spec["constraints"];
          if (!Array.isArray(cs)) {
            return err(unknownId("--param", `no constraint "${p.constraintId}" on line "${sel.value.name}"`, "unknown_constraint_id"));
          }
          const row = cs.find((c) => isObject(c) && c["id"] === p.constraintId);
          if (!isObject(row)) {
            return err(unknownId("--param", `no constraint "${p.constraintId}" on line "${sel.value.name}"`, "unknown_constraint_id"));
          }
          (row as Record<string, unknown>)["value"] = value;
          break;
        }
        case "believe": {
          const params = beliefParamsOf(base, "--param");
          if (!params.ok) return params;
          // one belief per line (D23): setting one clears the other
          for (const f of BELIEVE_FIELDS) delete params.value[f];
          params.value[p.field] = value;
          break;
        }
        case "plan":
          return err(schemaErr("--param", "a plan. root reaches this branch only through the resolved-scenario prep", "sweep_internal_plan_route"));
      }
    }
    input = base;
  }

  const result = run(input, runOpts);
  if (!result.ok) {
    // §4.3: a refused cell is recorded, never a verb failure — but only a
    // SOLVER refusal. Bad input stays bad input (08 §3.1's exit-2 tier).
    if (result.error.code !== "NO_SOLUTION") return result;
    const row = refusedRow(metrics);
    const out: Record<string, Readonly<Record<string, MetricValue>>> = {};
    for (const id of expected) {
      if (line !== undefined && id !== line) continue;
      out[id] = row;
    }
    return ok(out);
  }
  return ok(perLineRows(result.value.lines, metrics, line, keyOverride));
}

function perLineRows(
  lines: readonly LineEntry[],
  metrics: readonly SweepMetric[],
  filter: string | undefined,
  keyOverride: string | undefined
): Readonly<Record<string, Readonly<Record<string, MetricValue>>>> {
  const out: Record<string, Readonly<Record<string, MetricValue>>> = {};
  for (const entry of lines) {
    const key = keyOverride !== undefined && lines.length === 1 ? keyOverride : entry.line_id;
    if (filter !== undefined && key !== filter && entry.line_id !== filter) continue;
    out[key] = isLineRefusal(entry) ? refusedRow(metrics) : metricsOf(entry as LineResult, metrics);
  }
  return out;
}

// ---------------------------------------------------------------------------
// TSV (ARCHITECTURE §10 pin #23: one file at --out; stdout stays the JSON doc)

function toTsv(
  paths: readonly string[],
  lineIds: readonly string[],
  metrics: readonly SweepMetric[],
  cells: readonly CellRow[]
): string {
  const cols: string[] = [...paths];
  for (const id of lineIds) for (const m of metrics) cols.push(`${id}.${m}`);
  const rows = [cols.join("\t")];
  for (const cell of cells) {
    const row: string[] = cell.at.map((v) => String(v));
    for (const id of lineIds) {
      const per = cell.per_line[id];
      for (const m of metrics) {
        const v = per?.[m];
        row.push(v === undefined || v === null ? "" : String(v));
      }
    }
    rows.push(row.join("\t"));
  }
  return rows.join("\n") + "\n";
}
