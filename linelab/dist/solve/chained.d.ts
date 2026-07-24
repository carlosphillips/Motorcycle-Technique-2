import type { Result } from "../core/result.js";
import type { ResolvedPlanAction } from "../core/types.js";
import type { ComposedRoad, RoadSpec } from "../road/types.js";
import type { AcceptPolicy, FigureRole, SolveSpec } from "../plan/types.js";
import { evalConstraints, executeLine, type SolveCtx, type SolveInput } from "./solve.js";
import type { LineResult, LineSource, MisjudgmentBlock, SightHold } from "./types.js";
import type { SolveStyle } from "../plan/types.js";
/** The §2(a) front-door road argument: preset name | DSL string | roadSpec value. */
export declare function wireRoadSpecOf(road: SolveSpec["road"]): RoadSpec;
/** Compose the road a solve spec names (pure; typed compose errors propagate). */
export declare function composeSpecRoad(road: SolveSpec["road"]): Result<ComposedRoad>;
/** A resolved plan re-spelled in wire (validate() input) form. */
export declare function wirePlanFromResolved(resolved: readonly ResolvedPlanAction[]): readonly Record<string, unknown>[];
export interface WireScenarioFields {
    readonly spec: SolveInput;
    readonly wireRoad: RoadSpec;
    /** overrides spec.entry_kmh when the vis governor caps the entry (04 §6 V1) */
    readonly entry_kmh?: number;
}
/** The wire scenario a solved plan rides in (same law as solve.ts's private copy). */
export declare function buildWireScenario(fields: WireScenarioFields, plan: readonly unknown[]): Record<string, unknown>;
export interface ExecuteExtInput {
    readonly spec: SolveInput;
    readonly wireRoad: RoadSpec;
    /** wire-form plan (validate() input) */
    readonly plan: readonly unknown[];
    readonly policy: AcceptPolicy;
    readonly source: LineSource;
    readonly constraints: Parameters<typeof executeLine>[0]["constraints"];
    readonly brake_gap_m: number;
    readonly declared_style?: SolveStyle;
    readonly entry_kmh?: number;
    readonly line_id?: string;
    readonly role?: FigureRole;
    readonly label?: string;
    /** verdict.sight.holds rows (04 §6 V2) — patched in post-execute */
    readonly holds?: readonly SightHold[];
    /** verdict.misjudgment (04 §4.7) — patched in post-execute */
    readonly misjudgment?: MisjudgmentBlock;
}
export declare function executeSolvedPlan(input: ExecuteExtInput): Result<LineResult>;
/** Patch verdict extension members, re-seal (recompute result_hash), rebuild. */
export declare function patchAndReseal(line: LineResult, holds: readonly SightHold[] | undefined, misjudgment: MisjudgmentBlock | undefined): Result<LineResult>;
export interface ChainCtx {
    readonly spec: SolveInput;
    readonly policy: AcceptPolicy;
    readonly wireRoad: RoadSpec;
    readonly road: ComposedRoad;
    /** selected corner indices, in station order */
    readonly indices: readonly number[];
    /** per-selected-corner solve contexts (index-aligned with `indices`) */
    readonly ctxs: readonly SolveCtx[];
}
export declare function buildChainContext(spec: SolveInput): Result<ChainCtx>;
/** d_flip(v) = v·(φ_n + φ_{n+1})/roll_rate — the D27 flip budget, metres. */
export declare function dFlipM(v_ms: number, r_prev_m: number, r_next_m: number, roll_rate_dps: number): number;
/**
 * chainedSolve(spec) → Result<LineResult> (design/04 §5). Multi-corner roads
 * chain (the default invocation); `corner=<id>` restricts to one corner and
 * delegates to the single-corner pipeline; `corner=<a>..<b>` chains the span.
 * The gentlest fully-contained decel wins; the flip floor refuses
 * NO_SOLUTION/link_flip_infeasible.
 */
export declare function chainedSolve(spec: SolveInput): Result<LineResult>;
export { evalConstraints };
