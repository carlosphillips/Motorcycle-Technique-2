import type { Result } from "../core/result.js";
import type { Outcome, ResolvedPlanAction } from "../core/types.js";
import type { RoadSpec } from "../road/types.js";
import type { FigureRole, MistakeScope } from "../plan/types.js";
import { type MistakeKind } from "../plan/mistakes.js";
import { type SolveInput } from "./solve.js";
import type { DiagnosisBlock, LineResult } from "./types.js";
export interface MistakeCtx {
    /** the solved good line the perturbation applies to (self-verified baseline) */
    readonly base: LineResult;
    /** the base ride spec (road, entry_kmh, profile, mu, …) the good line was solved from */
    readonly spec: SolveInput;
    /** design/03 §7.2 scope; default = the kind's target corner */
    readonly scope?: MistakeScope;
    readonly line_id?: string;
    readonly role?: FigureRole;
    readonly label?: string;
}
export interface CompiledMistake {
    readonly kind: MistakeKind;
    /** the executed (perturbed, literalised) plan */
    readonly plan: readonly ResolvedPlanAction[];
    /** the ACTUAL road the mistake ran on (for misjudge kinds the believed road rides in `line.source`) */
    readonly roadSpec: RoadSpec;
    /** the engine's emergent outcome — never asserted, always read off the verdict */
    readonly outcome: Outcome;
    readonly diagnosis: DiagnosisBlock | null;
    readonly label: string;
    /** the full first-class mistake line (D6 — identical citizenship) */
    readonly line: LineResult;
    /** which scoped corners actually received the perturbation (04 §5.1.5) */
    readonly applied_corners: readonly string[];
}
type RawParams = Readonly<Record<string, number | string>> | undefined;
/**
 * `facets` commanded leans, alternating bite / give-back, walking the probed
 * [kiss, eased] band upward. Deterministic and total for any `facets ≥ 2`.
 */
export declare function facetLadder(kiss: number, eased: number, facets: number): readonly number[];
export declare function compileMistake(kind: string, params: RawParams, ctx: MistakeCtx): Result<CompiledMistake>;
export {};
