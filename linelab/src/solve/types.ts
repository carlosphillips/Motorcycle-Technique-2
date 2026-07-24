// solve/types.ts — ALL output envelope shapes (ARCHITECTURE §4): Verdict,
// CorrectiveBlock (re-export), MisjudgmentBlock, LineResult, LineRefusal,
// FigureResult, GateReport, SkewRecord, the NO_SOLUTION sub-reason registry,
// and the counterfactual types WP-08 declared in counterfactual.ts (re-exported
// here per the WP-09 ownership amendment — never re-declared).
//
// Design of record: design/05 §6 (verdict), §7 (envelope), §8 (identity/skew/
// cache); design/04 §4.10 (NO_SOLUTION registry), §4a.6 (corrective block);
// design/08 §3.4 (gate law). Closed sets are copied VERBATIM into single
// `as const` declarations (drift risk #12).
//
// Phase law (00 §3, ARCHITECTURE §4): the still-unshipped v0.2 shapes —
// SaveWindow, the FigureResult.standing attachment, verdict.commitment — are
// ABSENT here, not stubbed. C-SAVEWIN-NO-INK reads this file's silence as the
// sentinel. StandingReport SHIPPED with the D43 ladder (v0.2 inspection): it is
// declared at its definition site (solve/standing.ts) and re-exported here per
// the §4 type-ownership address — the counterfactual precedent, never
// re-declared. The envelope itself still carries NO standing member: the
// attachment is written only where requested (05 §7) and lands with the
// envelope verbs' wiring.

import type { LinelabError } from "../core/result.js";
import type {
  CornerType,
  Hand,
  Outcome,
  ResolvedHazard,
  ResolvedOccluder,
  ResolvedScenario,
  RoadModel,
  Trajectory
} from "../core/types.js";
import type { ApexPoint, CornerExit } from "../core/analyze.js";
import type { DoctrineBlock } from "../plan/doctrine/types.js";
import type { Quality } from "../plan/doctrine/quality.js";
import type {
  AcceptPolicy,
  ConstraintBound,
  FigureRole,
  MistakeSpec,
  PlanAction,
  Scenario,
  SolveSpec
} from "../plan/types.js";
import type { RoadSpec } from "../road/types.js";
import type { CorrectiveBlock } from "./corrective.js";

// ---------------------------------------------------------------------------
// Re-exports: the D42 counterfactual layer (declared by WP-08 at its D42-named
// definition sites; this file is the §4 type-ownership address for them).

export type {
  CounterfactualRider,
  CfPredicate,
  CfRefusal,
  CfRefusalReason,
  CfRiderRecord,
  CfPredicateRecord,
  CfLaunchSample,
  CfLaunchState,
  CfShadowDocument,
  CfVerdict,
  CfOutcome
} from "./counterfactual.js";
export {
  COUNTERFACTUAL_RIDERS,
  CF_PREDICATES,
  CF_REFUSAL_REASONS,
  CF_RIDER_REGISTRY,
  CF_PREDICATE_REGISTRY,
  CF_DISCLOSURE_LEAN_ONLY,
  CF_DEFERRED_D45
} from "./counterfactual.js";

export type {
  CorrectiveBlock,
  CorrectiveFailReason,
  CorrectiveShotInput,
  CorrectiveShotResult,
  RunWideDetect
} from "./corrective.js";
export {
  CORRECTIVE_FAIL_REASONS,
  CORRECTIVE_BINDING,
  CORRECTIVE_DISCLOSURE
} from "./corrective.js";

// The D43 standing ladder (v0.2 inspection — declared in standing.ts at its
// definition site; this file is the §4 type-ownership address for the shapes).
// TYPE-ONLY re-export, deliberately: standing.ts imports isLineRefusal from
// envelope.ts, and envelope.ts imports this file — a value re-export here
// would close a runtime import cycle. The value surface (STANDING_RUNGS,
// STANDING_GLOSS, standingPlacard, standing, standingAttachment) resolves
// from standing.ts and the package root.
export type {
  Standing,
  StandingRung,
  StandingReport,
  ReserveRow,
  ReserveBlock,
  ReserveBlockReason
} from "./standing.js";

// ---------------------------------------------------------------------------
// Pinned identity literals (design/05 §6.3, §7): both the envelope's `spec`
// and the verdict's `engine` are the string "linelab/1".

/** design/05 §7/§8.1 — `FigureResult.spec` / `FigureSpec.spec` pinned literal. */
export const LINELAB_SPEC = "linelab/1" as const;

/** design/05 §6.3 — `Verdict.engine` pinned literal. */
export const ENGINE_ID = "linelab/1" as const;

// ---------------------------------------------------------------------------
// The NO_SOLUTION sub-reason registry (design/04 §4.10 — closed set, copied
// VERBATIM in the doc's declaration order; extension is a design change).
// The token rides `detail.sub_reason` (the ONE exception to the detail.reason
// convention, core/result.ts).

export const NO_SOLUTION_SUB_REASONS = [
  "turn_in_infeasible_early",
  "turn_in_infeasible_late",
  "empty_band",
  "non_clean_band",
  "coarse_fine_disagreement",
  "constraint_unmet",
  "road_too_short",
  "no_double_apex_geometry",
  "no_two_touch_line",
  "believed_world_not_clean",
  "no_rankable_candidate",
  "authored_action_conflict",
  "link_flip_infeasible",
  "vis_unsatisfiable_within_bound",
  "vis_speed_below_model_floor"
] as const;
export type NoSolutionSubReason = (typeof NO_SOLUTION_SUB_REASONS)[number];

// ---------------------------------------------------------------------------
// Diagnosis (design/05 §6.1 — closed cause set; the block is excluded from
// result_hash, §8.3: richer diagnostics must never perturb regression hashes).

export const DIAGNOSIS_CAUSES = [
  "overspeed_entry",
  "grip_exceeded",
  "roll_rate_limited",
  "sight_deficit",
  "late_brake",
  "plan_gap",
  "stand_up"
] as const;
export type DiagnosisCause = (typeof DIAGNOSIS_CAUSES)[number];

/** design/05 §6.3 — `diagnosis: null | {cause, at_s, corner_id, detail}`. */
export interface DiagnosisBlock {
  readonly cause: DiagnosisCause;
  readonly at_s: number;
  readonly corner_id: string | null;
  readonly detail: Readonly<Record<string, unknown>>;
}

// ---------------------------------------------------------------------------
// Verdict sub-blocks (design/05 §6.3, field names verbatim)

/**
 * One turn_in commitment row: one per `turn_in` event in the corner's span.
 * `release_s: null` = the commitment never released (itself diagnostic).
 */
export interface TurnInRow {
  readonly s: number;
  readonly lean_commit_deg: number;
  readonly hand: Hand;
  readonly release_s: number | null;
}

/**
 * design/05 §6.3 — `acceptance` is ALWAYS present and in-hash (D24): a
 * non-clean return is impossible to receive silently. Grading is
 * policy-independent — the policy changes what is returned, never how it is
 * graded or coloured (D9).
 */
export interface AcceptanceBlock {
  readonly policy: AcceptPolicy;
  /** true iff the returned line meets the clean bar (§6.1's clean predicate) */
  readonly met: boolean;
}

/** design/05 §6.3 — total below_validity dwell (D17); the verdict member is null when zero. */
export interface ValidityBlock {
  readonly below_validity_s: number;
}

/** design/05 §6.3 misjudgment.divergence.kind — closed set. */
export const MISJUDGE_DIVERGENCE_KINDS = ["radius", "sweep", "structure"] as const;
export type MisjudgeDivergenceKind = (typeof MISJUDGE_DIVERGENCE_KINDS)[number];

/**
 * design/05 §6.3 — non-null only for `source.kind = "misjudge"` (§7). The
 * believed-world run is NOT a line in the figure: its identity travels as the
 * two hashes in `believed`. Arithmetic owned by design/04 §8 (WP-11 computes).
 */
export interface MisjudgmentBlock {
  /** fnv-1a/6-hex over the canonical believed roadSpec */
  readonly believed_road_hash: string;
  /** m — exact divergence station */
  readonly s_divergence_m: number;
  readonly divergence: {
    readonly kind: MisjudgeDivergenceKind;
    readonly corner_id: string | null;
    readonly believed: number | null;
    readonly actual: number | null;
  };
  /** max |κ_actual − κ_believed| past divergence */
  readonly kappa_gap: { readonly max_abs_1pm: number; readonly at_s: number };
  /** believed-world self-verify — "clean" documents the §4.7 invariant (a non-clean believed world is a NO_SOLUTION refusal, never a verdict) */
  readonly believed: {
    readonly outcome: "clean";
    readonly spec_hash: string;
    readonly result_hash: string;
  };
  /** literalized actions the actual run never reached */
  readonly actions_unreached: readonly string[];
}

/** design/05 §6.3 sight.holds[] — per-corner vis-hold record (04 §6 writes it). */
export interface SightHold {
  readonly corner_id: string;
  readonly target_f: number;
  readonly achieved_f: number;
  readonly budget_limited: boolean;
  /** distinct from turn_ins[].release_s */
  readonly hold_release_s: number;
}

/** design/05 §6.3 sight block — rider-path basis (D16). */
export interface SightBlock {
  /** m — min over samples of sight_ride_m − ssd_m */
  readonly margin_min_m: number;
  readonly at_s: number;
  readonly v_at_s_kmh: number;
  readonly holds: readonly SightHold[];
}

/**
 * design/05 §6.3 constraints[] — per-bound evaluation of a constraint-targeted
 * solve (04 §4.5, D10). A solver-returned line always has every entry
 * `satisfied: true` (an unsatisfiable bound is a typed NO_SOLUTION).
 */
export interface ConstraintRow {
  readonly id: string;
  readonly bound: ConstraintBound;
  readonly value: number;
  readonly satisfied: boolean;
  readonly worst: { readonly s: number; readonly value: number; readonly margin: number };
}

/** design/05 §6.3 corners[] row (apex/exit shapes imported from the ONE detector, drift risk #4). */
export interface CornerVerdict {
  readonly id: string;
  readonly hand: Hand;
  readonly corner_type: CornerType;
  readonly turn_ins: readonly TurnInRow[];
  /** ordered by s, 1..N — the ONE hysteresis detector's recorded list */
  readonly apexes: readonly ApexPoint[];
  readonly lean_max_deg: number;
  readonly grip_min: number;
  /** s — reserve-exceedance dwell; evidence only, feeds no check */
  readonly danger_dwell_s: number;
  readonly exit: CornerExit;
  readonly ran_wide: boolean;
  /** null ⇔ never attempted (no outward departure, or crash) */
  readonly corrective: CorrectiveBlock | null;
  /** present (true) iff the line's crash lies in this corner's window (05 §6.3 `crash?`) */
  readonly crash?: boolean;
}

// ---------------------------------------------------------------------------
// The Verdict (design/05 §6.3, merged shape, field names verbatim)

export interface Verdict {
  /** ≡ the derived clean predicate (§6.1): outcome = contained ∧ zero applicable check fails */
  readonly ok: boolean;
  readonly spec_hash: string;
  /** stamped by envelope sealing; "" only on an unsealed in-memory verdict */
  readonly result_hash: string;
  /** metric vocabulary (code) — §6.2 */
  readonly checks_version: 2;
  /** pack identity (data), `"<name>/<version>"` — §6.2 */
  readonly rubric: string;
  readonly engine: typeof ENGINE_ID;
  /** §6.1 closed set — physics-only (P-OUTCOME-RUBRIC-FREE) */
  readonly outcome: Outcome;
  /** stored, in-hash; law owned by plan/doctrine/quality.ts (06 §5.1 ≡ 05 §6.1) */
  readonly quality: Quality;
  readonly headline: string;
  /** excluded from result_hash (§8.3) */
  readonly diagnosis: DiagnosisBlock | null;
  /** always present, in-hash (D24) */
  readonly acceptance: AcceptanceBlock;
  /** non-null only for source.kind = "misjudge" (§7) */
  readonly misjudgment: MisjudgmentBlock | null;
  /** total below_validity dwell (D17); null when zero */
  readonly validity: ValidityBlock | null;
  readonly corners: readonly CornerVerdict[];
  readonly sight: SightBlock | null;
  /** null unless the line's source carries constraints */
  readonly constraints: readonly ConstraintRow[] | null;
  readonly doctrine: DoctrineBlock;
}

// ---------------------------------------------------------------------------
// FigureSpec share stamps (design/05 §8.1 — the members envelope/skew/cache
// machinery reads; declared here because they are output-provenance vocabulary:
// `expect` is the authored gate declaration (IN spec_hash), `expected`/`solved`
// are exporter stamps (excluded from spec_hash), and plan/types.ts (WP-05,
// frozen) does not carry them).

/** Authored gate declaration — IN spec_hash; JSON-only by design (D30). */
export interface ExpectBlock {
  readonly outcome?: readonly Outcome[];
  readonly checks_fail?: readonly string[];
}

/** Exporter stamp — a falsifiable prediction of recomputation, never an input. */
export interface ExpectedStamp {
  readonly outcome: Outcome;
  /** fnv-1a first-6-hex */
  readonly result_hash: string;
}

/**
 * The solver's cached conclusion (design/05 §8.1): a resolved wire plan with
 * absolute stations, exactly the 03 §6.1 schema — no apex field, no
 * trajectory; must pass validate(). A cached plan is an INPUT — it may change
 * the time, never the answer (D6/D7).
 */
export interface SolvedStamp {
  /** fnv-1a over canonical {road_spec, occluders, hazards, this line's source} */
  readonly spec_hash: string;
  readonly plan: readonly PlanAction[];
}

// ---------------------------------------------------------------------------
// Solved-plan cache provenance (design/05 §7/§8.1 — never silent)

export const CACHE_STATES = ["hit", "stale_engine", "stale_spec", "absent"] as const;
export type CacheState = (typeof CACHE_STATES)[number];

// ---------------------------------------------------------------------------
// Version skew (design/05 §8.4 — closed, ordered tier vocabulary; the record
// is placard DATA: it never blocks and never changes computation, D31)

/** Per-line tiers, ordered `match < unstamped < detail < story`. */
export const LINE_SKEW_TIERS = ["match", "unstamped", "detail", "story"] as const;
export type LineSkewTier = (typeof LINE_SKEW_TIERS)[number];

/** Figure-level tiers (the figure never reads "unstamped"; "info" is figure-only). */
export const FIGURE_SKEW_TIERS = ["match", "info", "detail", "story"] as const;
export type FigureSkewTier = (typeof FIGURE_SKEW_TIERS)[number];

export interface SkewLine {
  readonly line_id: string;
  readonly tier: LineSkewTier;
  readonly expected: ExpectedStamp | null;
  readonly got: ExpectedStamp;
}

/** design/05 §8.4, verbatim shape. `FigureResult.skew` is null when the spec carried no engine_semver. */
export interface SkewRecord {
  readonly spec_semver: string;
  readonly engine_semver: string;
  /** semver equality */
  readonly same_engine: boolean;
  readonly lines: readonly SkewLine[];
  readonly tier: FigureSkewTier;
}

// ---------------------------------------------------------------------------
// Line provenance (design/05 §7 — `source` is the shareable, causal part)

export type LineSource =
  | { readonly kind: "scenario"; readonly scenario: Scenario }
  | { readonly kind: "solve"; readonly solveSpec: SolveSpec }
  | { readonly kind: "mistake"; readonly base_line_id: string; readonly mistakeSpec: MistakeSpec }
  | {
      readonly kind: "misjudge";
      /** solved in the believed world */
      readonly solve: SolveSpec;
      /** DSL string or roadSpec value */
      readonly believed_road: RoadSpec | string;
      readonly sugar:
        | null
        | {
            readonly kind: "underread" | "overread";
            readonly params: Readonly<Record<string, number | string>>;
            readonly corner_id: string;
          };
    };

// ---------------------------------------------------------------------------
// The multi-line envelope (design/05 §7, D6 — identical citizenship for every
// line; refusals are first-class typed entries, never silence)

export interface LineResult {
  readonly line_id: string;
  readonly role: FigureRole;
  /** legend text */
  readonly label: string;
  readonly source: LineSource;
  /** the complete post-validation wire Scenario the engine integrated for THIS line (03 §6, canonical form) */
  readonly resolved_scenario: ResolvedScenario;
  /** solved-plan cache provenance (§8.1) — excluded from result_hash */
  readonly cache: CacheState;
  /** full Sample/Event contract, §2–§5 */
  readonly trajectory: Trajectory;
  /** full Verdict, §6 */
  readonly verdict: Verdict;
}

/** design/05 §7 — a refused line stays in `lines`, keyed by line_id; draws nothing. */
export interface LineRefusal {
  readonly line_id: string;
  readonly role: FigureRole;
  readonly ok: false;
  readonly error: LinelabError;
}

export type LineEntry = LineResult | LineRefusal;

/** design/05 §7 meta — presentation hints only, never physics. */
export interface FigureMeta {
  readonly title?: string;
  readonly caption?: string;
  readonly view?: unknown;
}

export interface FigureResult {
  readonly spec: typeof LINELAB_SPEC;
  readonly figure_id: string;
  /** ONE composed RoadModel — all lines share it (lines needing different roads are different figures) */
  readonly road: RoadModel;
  /** resolved absolute form (03 §4) */
  readonly occluders: readonly ResolvedOccluder[];
  /** resolved absolute form — diff consumers locate a patch without re-deriving placements */
  readonly hazards: readonly ResolvedHazard[];
  /** 1..N, order = draw order */
  readonly lines: readonly LineEntry[];
  /** null | the version-skew record (§8.4) — excluded from result_hash */
  readonly skew: SkewRecord | null;
  readonly meta: FigureMeta;
}

// ---------------------------------------------------------------------------
// GateReport (design/08 §3.4; TYPE ONLY here — gateFigure lands with WP-12's
// solve/gate.ts). The design pins the gate LAW (the five E(line) derivation
// rules and the bidirectional met/missed evaluation) but no wire shape; this
// shape is the minimal record of that law: which rule derived E, what E was,
// what was observed, and whether it was met in both directions.

/** Which §3.4 rule derived E(line): rules 1–5 in order. */
export const GATE_EXPECT_SOURCES = [
  "explicit_expect",
  "mistake_pin",
  "best_failing",
  "chained_vis",
  "default"
] as const;
export type GateExpectSource = (typeof GATE_EXPECT_SOURCES)[number];

/** The derived per-line expectation E(line) — all inputs, no computed state. */
export interface GateExpectation {
  readonly source: GateExpectSource;
  /** admissible outcome set; null = any outcome admissible */
  readonly outcome: readonly Outcome[] | null;
  /** check ids that MUST fail (the bidirectional rule: an exempt check passing is a miss) */
  readonly checks_fail: readonly string[];
  /** rows 1/2/5: the line must grade quality "good" over the applicable set */
  readonly require_quality_good: boolean;
  /** the best_failing row: any "good" result is itself unexpected */
  readonly require_non_good: boolean;
}

export interface GateLineReport {
  readonly line_id: string;
  /** the line is a LineRefusal envelope entry */
  readonly refused: boolean;
  readonly expectation: GateExpectation;
  /** null for refusals (no verdict exists) */
  readonly observed: {
    readonly outcome: Outcome;
    readonly quality: Quality;
    readonly failed_checks: readonly string[];
  } | null;
  readonly met: boolean;
  /** human-readable miss statements; [] iff met */
  readonly misses: readonly string[];
}

/** `gateFigure(envelope) → GateReport` (08 §3.4/§7.1) — recomputable by any consumer. */
export interface GateReport {
  readonly figure_id: string;
  readonly lines: readonly GateLineReport[];
  /** figure-level skew tier "story" — exits 3 under `run --gate` (08 §3.1) */
  readonly skew_story: boolean;
  /** every line met ∧ ¬skew_story */
  readonly pass: boolean;
}
