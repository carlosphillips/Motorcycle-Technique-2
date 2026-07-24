import type { Result } from "../../core/result.js";
import type { LineResult } from "../../solve/types.js";
import { type VerbOutcome } from "./shared.js";
/** design/08 §4.3 — TUNING. Grids larger than this are truncated with `truncated: true`. */
export declare const SWEEP_MAX_CELLS = 2500;
/** design/08 §4.3 — the closed metric vocabulary, copied verbatim in the doc's order. */
export declare const SWEEP_METRICS: readonly ["outcome", "apex_pct", "apex_f", "v_apex_kmh", "lean_max_deg", "grip_min", "exit_f", "sight_margin_min_m", "end_s", "end_reason", "acceptance_met", "apex_count", "s_divergence_m"];
export type SweepMetric = (typeof SWEEP_METRICS)[number];
/** design/08 §4.3 — "Default `outcome,apex_pct,grip_min`." */
export declare const SWEEP_DEFAULT_METRICS: readonly SweepMetric[];
/** design/08 §4.3 — the closed root set of the sweep-path grammar (D34). */
export declare const SWEEP_ROOTS: readonly ["plan", "scenario", "config", "ride", "mistake", "constraint", "believe"];
export type SweepRoot = (typeof SWEEP_ROOTS)[number];
/** `scenario.` addresses exactly the two rider.start scalars. */
declare const SCENARIO_FIELDS: readonly ["entry_kmh", "start_f"];
/** `config.` addresses exactly the one numeric config field. */
declare const CONFIG_FIELDS: readonly ["mu"];
/** `ride.` addresses the solve-spec intent scalars. */
declare const RIDE_FIELDS: readonly ["vis_margin", "vis_hold_f", "turn_in_s"];
/** `believe.` belief params (04 §4.6 / 03 §7.4's underread|overread sugar). */
declare const BELIEVE_FIELDS: readonly ["r_believed", "sweep_believed_deg"];
export type SweepPath = {
    readonly root: "plan";
    readonly actionId: string;
    readonly field: string;
} | {
    readonly root: "scenario";
    readonly field: (typeof SCENARIO_FIELDS)[number];
} | {
    readonly root: "config";
    readonly field: (typeof CONFIG_FIELDS)[number];
} | {
    readonly root: "ride";
    readonly field: (typeof RIDE_FIELDS)[number];
} | {
    readonly root: "mistake";
    readonly lineId: string;
    readonly param: string;
} | {
    readonly root: "constraint";
    readonly constraintId: string;
} | {
    readonly root: "believe";
    readonly field: (typeof BELIEVE_FIELDS)[number];
};
/** `sweep-path := <root-path>` (design/08 §4.3). Total, typed, no throwing. */
export declare function parseSweepPath(path: string, at: string): Result<SweepPath>;
export interface SweepRange {
    readonly from: number;
    readonly to: number;
    readonly step: number;
}
/** `--range a:b:step`. `step ≤ 0` or an inverted range is `BAD_RANGE` (§4.3). */
export declare function parseSweepRange(text: string, at: string): Result<SweepRange>;
/** The grid values of one param, inclusive of `to` within a step epsilon. */
export declare function gridValues(range: SweepRange): readonly number[];
/**
 * The grid, capped. design/08 §4.3: "grid cells > `sweep_max_cells = 2500`
 * (TUNING) → grid truncated with `truncated: true`". ARCHITECTURE §10 pin #22
 * fixes WHICH cells survive: "the first `sweep_max_cells` cells in row-major
 * (param-1 outer) order". Pure, so the cap is testable without spending 2500
 * engine runs on it.
 */
export declare function gridCells(v1: readonly number[], v2: readonly number[] | undefined, max?: number): {
    readonly at: readonly number[][];
    readonly truncated: boolean;
};
type MetricValue = string | number | boolean | null;
/**
 * One line's metric row. `apex_pct` / `apex_f` / `v_apex_kmh` read the FINAL
 * entry of `corners[].apexes[]` and are `null` when the list is empty
 * (design/08 §4.3, the same final-apex rule `late_apex` uses).
 */
export declare function metricsOf(line: LineResult, metrics: readonly SweepMetric[]): Readonly<Record<string, MetricValue>>;
export interface SweepVerbInput {
    readonly loadedText?: string;
    readonly argv: readonly string[];
    readonly engineSemver: string;
}
export declare function sweepVerb(input: SweepVerbInput): VerbOutcome;
export {};
