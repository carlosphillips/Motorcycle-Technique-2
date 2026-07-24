import type { LinelabError, Result } from "../core/result.js";
import type { Corner, ResolvedPlanAction, ResolvedScenario, RiderProfile, Sample, Trajectory, World } from "../core/types.js";
import { type CornerRow } from "../core/analyze.js";
import type { ComposedRoad, RoadSpec } from "../road/types.js";
import type { AcceptPolicy, Constraint, ConstraintBound, FigureRole, PlanAction, SolveSpec, SolveStyle, ValidatedScenario } from "../plan/types.js";
import { type DerivedStations } from "./stations.js";
import { type MergeDirectives } from "./merge.js";
import { type RankedCandidate } from "./accept.js";
import type { ConstraintRow, LineResult, LineSource } from "./types.js";
export interface SolveInput extends SolveSpec {
    /** authored plan fragment — §4.9 merge contract */
    readonly plan?: readonly PlanAction[];
}
export declare function noSolution(sub_reason: string, at: string, message: string, detail?: Record<string, unknown>): LinelabError;
export interface ResolvedConstraint {
    readonly id: string;
    readonly bound: ConstraintBound;
    readonly value: number;
    readonly s0: number;
    readonly s1: number;
}
export declare function resolveConstraints(constraints: readonly Constraint[] | undefined, corners: readonly Corner[], roadEnd: number): Result<readonly ResolvedConstraint[] | null>;
/** Per-bound evaluation over the retained samples of the span (05 §6.3 rows). */
export declare function evalConstraints(samples: readonly Sample[], constraints: readonly ResolvedConstraint[]): readonly ConstraintRow[];
export declare function constraintsSatisfied(rows: readonly ConstraintRow[] | null): boolean;
/** NO_SOLUTION/constraint_unmet naming the id, worst station, achieved vs required. */
export declare function constraintUnmet(rows: readonly ConstraintRow[], at: string): LinelabError;
export interface SolveCtx {
    readonly spec: SolveInput;
    readonly policy: AcceptPolicy;
    readonly wireRoad: RoadSpec;
    /** validate() output for the plan-less skeleton — resolved road/occluders/hazards/config */
    readonly base: ResolvedScenario;
    readonly road: ComposedRoad;
    readonly world: World;
    readonly profile: RiderProfile;
    readonly corner: Corner;
    readonly cornerIndex: number;
    readonly stations: DerivedStations;
    readonly directives: MergeDirectives;
    readonly constraints: readonly ResolvedConstraint[] | null;
    readonly v_entry_ms: number;
    readonly start_f: number;
    readonly mu: number;
    readonly skill: number;
    /** rad/s — effective roll rate */
    readonly roll_rate_rad: number;
    /** deg — the decel bisection's emergent target: lean_frac × phiReserve(mu_use) */
    readonly lean_target_deg: number;
    /** deg — phiReserve(mu_use) */
    readonly phi_reserve_deg: number;
    /** exit-f bisection target after §4.5 clipping */
    readonly exit_target_eff: number;
}
export declare function buildSolveContext(specIn: SolveInput): Result<SolveCtx>;
export interface RunMeasure {
    readonly traj: Trajectory;
    readonly rows: readonly CornerRow[];
    readonly scenario: ResolvedScenario;
}
export declare function measureRun(ctx: SolveCtx, plan: readonly ResolvedPlanAction[], coarse: boolean): RunMeasure;
export declare function containedRun(m: RunMeasure): boolean;
/**
 * The search-time OUTCOME-class proxy the self-verify comparison uses (§4.8.2):
 * outward-only — the physics outcome law has no inside-dip arm (a kiss that
 * grazes a centimetre inside the usable edge is doctrine territory, not an
 * outcome change), so the comparison must not read stricter than the verdict.
 */
export declare function outwardCleanRun(m: RunMeasure): boolean;
/**
 * Predicted speed at the turn-in under the hold+release brake profile (seed
 * only — the decel bisection measures the emergent truth). Rectangle over the
 * hold span, minus the slew ramp-in deficit (≈ v₀·decel²/(2·slew) — the real
 * WP-04 slew-chase under-braking effect), plus the release triangle.
 */
export declare function predictVti(ctx: SolveCtx, s_ti: number, decel: number): number;
export interface TangentLean {
    readonly lean_deg: number;
    /** the construction demanded more than phiReserve — the inside is unreachable */
    readonly capped: boolean;
}
/**
 * The geometric tangent-inside construction (the lean seed the kiss probes
 * refine): integrate the roll-in RAMP kinematically (constant v, φ(t) = ρ·t —
 * the transient both delays the arc and drifts the bike outward, and at road
 * speed the accumulated heading debt is what decides containment), then solve
 * the circle through the post-ramp state tangent to its heading and internally
 * tangent to the inside usable-edge circle around the corner's local centre at
 * the type-aware aim station. Fixed-point over the lean (the ramp length
 * depends on it) — fixed iteration/step counts, deterministic.
 */
export declare function tangentLeanDeg(ctx: SolveCtx, s_ti: number, v_ti: number): TangentLean;
export interface ExecuteInput {
    readonly validated: ValidatedScenario;
    readonly policy: AcceptPolicy;
    readonly source: LineSource;
    readonly constraints: readonly ResolvedConstraint[] | null;
    /** m — the solved corner's brake_gap, threaded to DoctrinePhysics (check 6 baseline) */
    readonly brake_gap_m: number;
    readonly declared_style?: SolveStyle;
    readonly line_id?: string;
    readonly role?: FigureRole;
    readonly label?: string;
}
/**
 * Execute a validated scenario through the FULL pipeline: integrate →
 * analyzeSight → analyzeCorners → corrective shot → doctrine → verdict →
 * seal → LineResult. This is the self-verification arm: the verdict returned
 * is the engine's own re-run, verbatim, including the released, unwound exit
 * straight (02 §3.1).
 */
export declare function executeLine(input: ExecuteInput): Result<LineResult>;
export interface CandidateSolve {
    readonly ranked: RankedCandidate;
    /** the search-final containment class vs the self-verified outcome disagree */
    readonly self_verify_disagrees: boolean;
    /** constraint rows on the self-verified run */
    readonly constraint_rows: readonly ConstraintRow[] | null;
    readonly fine_apex_pct: number | null;
    /**
     * The §4.2 feasibility probe refused this placement. Under accept=clean the
     * probe short-circuits (the candidate is a typed refusal); under
     * best_failing (§4.8.1) the candidate stays in the pool, but the flag lets
     * the pooling loop reconstruct exactly which candidate accept=clean would
     * have returned — the P-ACCEPT-MONOTONE anchor.
     */
    readonly probe_infeasible: boolean;
}
export interface FullSolveOptions {
    /** clean policy: the probe short-circuits on an infeasible placement (§4.2) */
    readonly short_circuit_probe: boolean;
}
export declare function fullSolveAtStation(ctx: SolveCtx, s_ti: number, opts: FullSolveOptions): Result<CandidateSolve>;
/**
 * solve(spec) → Result<LineResult> (ARCHITECTURE §5). turnIn defaults to auto
 * (the §3 coarse-sweep-then-full-solve pipeline); an explicit turn-in runs the
 * §4.2 pipeline at that placement. `accept` per §4.8. WP-11 modules lift the
 * OUT_OF_SCOPE seams (chained/double-apex/vis/believed).
 */
export declare function solve(spec: SolveInput): Result<LineResult>;
export interface CoarseCandidate {
    readonly s_ti: number;
    /** bracket degeneration / authored-fragment conflict at this placement */
    readonly error: LinelabError | null;
    readonly contained: boolean;
    readonly apex_pct: number | null;
    /** emergent apex inside the corner type's plausible band */
    readonly in_band: boolean;
    readonly constraint_ok: boolean;
    /** per-bound evaluation on the coarse run (null without constraints) */
    readonly constraint_rows: readonly ConstraintRow[] | null;
    readonly corridor_excess_m: number;
    /** |apex_pct − target_apex_pct(type)| — the §3.2 rank key */
    readonly rank: number;
}
export declare function coarseCandidate(ctx: SolveCtx, s_ti: number): CoarseCandidate;
