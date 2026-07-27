// plan/types.ts — ALL input wire shapes (ARCHITECTURE §3/§4): Scenario, PlanAction,
// Occluder, Hazard, MistakeSpec, SolveSpec, Constraint, Figure, FigureSpec. Field
// names copied VERBATIM from design/03 (§2.1, §4.1, §4.2, §6, §6.1, §7.2, §8) and
// design/04 (§4.5 Constraint, the `ride` line-kind field surface for SolveSpec).
//
// These are RAW-JSON-shaped (author-facing) types: anchors are unresolved
// (`{ref, offset_m?} | {at_s}`), `turn_in.target` may still be the symbolic
// `"tangent_inside"`, `position.over_m` may still be `"auto"`. `validate()`
// consumes a `Scenario` and produces a `ValidatedScenario` (defined here too —
// see the file-end note on why that is NOT `core.ResolvedScenario`).
//
// road/types.ts already owns the `RoadSpec` union (Segment, roadSpec) — imported,
// never redeclared here (ARCHITECTURE §4 type-ownership law).

import type { Hand, RiderProfileName, SsdModel } from "../core/types.js";
import type {
  ResolvedBrakeAction,
  ResolvedThrottleAction,
  ResolvedPositionAction,
  ResolvedStart,
  ResolvedConfig
} from "../core/types.js";
import type { RoadSpec } from "../road/types.js";

// ---------------------------------------------------------------------------
// The shared anchor grammar (design/03 §4, §6.1; D32) — wire (unresolved) form.
// The token-string grammar (`entry:<id>`, bare `<id>` sugar, `s:<m>`) is parsed
// by plan/anchors.ts; here we type only the two wire alternatives the JSON
// schema itself carries.

export interface RefAnchor {
  /** "entry:<cornerId>" | "exit:<cornerId>" | "mid:<cornerId>" (bare "<cornerId>" sugar accepted) */
  readonly ref: string;
  /** m — signed; offset NEVER rides inside `ref` (SCHEMA/anchor_embedded_offset) */
  readonly offset_m?: number;
}
export interface StationAnchor {
  /** m — absolute station */
  readonly at_s: number;
}
export type WireAnchor = RefAnchor | StationAnchor;

// ---------------------------------------------------------------------------
// Occluder (design/03 §4.1, verbatim)

export type OccluderKind = "hedge" | "wall" | "bank" | "vehicle";
export type OccluderSideToken = "inside" | "outside" | "left" | "right";
export type VehicleLane = "own" | "oncoming";

export interface Occluder {
  /** minted o1, o2… if absent; DUP_ID on collision */
  readonly id?: string;
  readonly kind: OccluderKind;
  /** band kinds: required. vehicle: one of the three lateral forms (lane ⊕ f ⊕ side) */
  readonly side?: OccluderSideToken;
  readonly at: WireAnchor;
  /** band kinds only; on a vehicle → SCHEMA (vehicle_span_not_allowed) */
  readonly span_m?: number;
  /** hedge/wall/bank defaults per §4 table; vehicle: margin_m valid only with side form */
  readonly margin_m?: number;
  readonly depth_m?: number;
  /** vehicle (defaults 4.5, 1.8) */
  readonly len_m?: number;
  readonly width_m?: number;
  /** vehicle only; else SCHEMA (lane_requires_vehicle) */
  readonly lane?: VehicleLane;
  /** vehicle only — the lateral escape hatch */
  readonly f?: number;
  /** reserved-rejected (OUT_OF_SCOPE/moving_hazards_not_modelled) — any motion field */
  readonly speed_kmh?: number;
  /** reserved-rejected (OUT_OF_SCOPE/vertical_geometry_not_modelled) */
  readonly height_m?: number;
}

// ---------------------------------------------------------------------------
// Hazard (design/03 §4.2, verbatim)

export type HazardSideToken = "inside" | "outside" | "left" | "right" | "center";

export interface Hazard {
  readonly id?: string;
  readonly kind: "gravel";
  readonly side: HazardSideToken;
  readonly at: WireAnchor;
  readonly span_m: number;
  /** default 1.4 */
  readonly width_m?: number;
  /** default 0.4; mu > 0 else BAD_RANGE */
  readonly mu?: number;
}

// ---------------------------------------------------------------------------
// Plan actions (design/03 §6.1) — wire (unresolved anchor, unresolved target/over_m)

interface ActionAnchorFields {
  readonly at_s?: number;
  readonly at?: RefAnchor;
}

export interface BrakeAction extends ActionAnchorFields {
  readonly do: "brake";
  readonly id: string;
  /** m/s² — > 0 */
  readonly decel: number;
  readonly taper_to_s?: number;
  readonly slew_mss?: number;
}

/** design/03 §6.1: `tangent_inside` defers the magnitude to the solver — legal wire input. */
export type TurnInTarget = { readonly lean_deg: number } | "tangent_inside";

export interface TurnInAction extends ActionAnchorFields {
  readonly do: "turn_in";
  readonly id: string;
  readonly target: TurnInTarget;
  readonly hand?: Hand;
}

export interface ThrottleAction extends ActionAnchorFields {
  readonly do: "throttle";
  readonly id: string;
  /** m/s² — ≥ 0; 0.0 = maintenance crack */
  readonly accel: number;
  readonly slew_mss?: number;
  readonly freeze_steer_s?: number;
}

export interface PositionAction extends ActionAnchorFields {
  readonly do: "position";
  readonly id: string;
  readonly f?: number;
  readonly d?: number;
  /** default "auto" */
  readonly over_m?: number | "auto";
}

export type PlanAction = BrakeAction | TurnInAction | ThrottleAction | PositionAction;

// ---------------------------------------------------------------------------
// Scenario (design/03 §6, verbatim)

export interface RiderStart extends ResolvedStart {}

export interface RiderWire {
  readonly profile?: RiderProfileName;
  readonly roll_rate_cap_dps?: number;
  readonly start: RiderStart;
  readonly plan: readonly PlanAction[];
}

export interface ConfigWire {
  readonly mu?: number;
  readonly ds_m?: number;
  readonly ssd_model?: SsdModel;
  readonly rubric?: string;
  readonly checks_version?: number;
}

export interface Scenario {
  readonly spec: "linelab/1";
  readonly id: string;
  readonly road: RoadSpec;
  readonly occluders?: readonly Occluder[];
  readonly hazards?: readonly Hazard[];
  readonly rider: RiderWire;
  readonly config?: ConfigWire;
  readonly expect_fail?: readonly string[];
  readonly meta?: Readonly<Record<string, unknown>>;
}

// ---------------------------------------------------------------------------
// validate()'s output — see the note at file end for why this is NOT literally
// `core.ResolvedScenario`. Every field but `rider.plan`'s turn_in target is
// EXACTLY the core Resolved* shape (imported, never re-declared); only turn_in
// keeps the symbolic `"tangent_inside"` possibility (design/03 §6.1: it "defers
// the magnitude to the solver" — validate() is closed-form and never runs the
// engine/solver, 03 §5.7, so it cannot discharge that deferral itself).

export interface ValidatedTurnInAction {
  readonly do: "turn_in";
  readonly id: string;
  readonly at_s: number;
  readonly target: TurnInTarget;
  readonly hand: Hand;
}

export type ValidatedPlanAction =
  | ResolvedBrakeAction
  | ValidatedTurnInAction
  | ResolvedThrottleAction
  | ResolvedPositionAction;

export interface ValidatedRider {
  readonly profile: RiderProfileName;
  readonly roll_rate_cap_dps?: number;
  readonly start: { readonly speed_kmh: number; readonly f?: number; readonly d?: number };
  readonly plan: readonly ValidatedPlanAction[];
}

export interface ValidatedRoadSpec {
  readonly lane_width_m: number;
  readonly bike_margin_m: number;
  readonly use_full_width: boolean;
  readonly segments: readonly import("../road/types.js").Segment[];
  readonly dsl: string;
}

/**
 * `validate(json) → Result<ValidatedScenario>` (ARCHITECTURE §5 names this
 * return type informally "Scenario"; we use `ValidatedScenario` here to keep it
 * distinct from the raw wire `Scenario` above — see the file-end note).
 */
export interface ValidatedScenario {
  readonly spec: "linelab/1";
  readonly id: string;
  readonly road: ValidatedRoadSpec;
  readonly occluders: readonly import("../core/types.js").ResolvedOccluder[];
  readonly hazards: readonly import("../core/types.js").ResolvedHazard[];
  readonly rider: ValidatedRider;
  readonly config: ResolvedConfig;
  readonly expect_fail?: readonly string[];
  readonly meta?: Readonly<Record<string, unknown>>;
}

// ---------------------------------------------------------------------------
// Mistake spec (design/03 §7.2) — `{kind, params?, scope?}`; the kind enum and
// per-kind param/default table live in plan/mistakes.ts (single source, D25).

export type MistakeScope = readonly string[] | "all_corners";

export interface MistakeSpec {
  /** validated against plan/mistakes.ts MISTAKE_KINDS — not re-typed as a literal union here to avoid a types.ts → mistakes.ts import cycle */
  readonly kind: string;
  readonly params?: Readonly<Record<string, number | string>>;
  readonly scope?: MistakeScope;
}

// ---------------------------------------------------------------------------
// Constraint (design/04 §4.5) — solve-spec acceptance bound. Not this package's
// primary reading (brief 04-solver-authoring), reconstructed here only because
// ARCHITECTURE §4 pins its file home to plan/types.ts; kept to the fields §4.5
// gives verbatim.

export type ConstraintBound = "f_min" | "f_max" | "v_max_kmh" | "sight_margin_min_m";

export type ConstraintSpan =
  | { readonly from: string; readonly to: string }
  | { readonly at: string };

export interface Constraint {
  readonly id: string;
  readonly span: ConstraintSpan;
  readonly bound: ConstraintBound;
  readonly value: number;
}

// ---------------------------------------------------------------------------
// SolveSpec (design/04 §2, §4.5, §7 `ride` line-kind field surface) — the input
// to `solve`/`chainedSolve`. Best-effort reconstruction from the fields 04
// states verbatim outside this package's required reading (brief 03); solve/
// (WP-10/11) is the authority on any field this misses — see deviations.

export type SolveStyle = "single" | "double_apex" | "geometric";
export type VisMode = "none" | "cautious";
export type AcceptPolicy = "clean" | "best_failing";

export interface SolveSpec {
  readonly road: RoadSpec | string;
  readonly entry_kmh: number;
  readonly profile?: RiderProfileName;
  readonly mu?: number;
  readonly turn_in?: "auto" | number;
  readonly style?: SolveStyle;
  readonly corner?: string;
  readonly vis?: VisMode;
  readonly vis_hold_f?: number;
  readonly vis_margin?: number;
  readonly believed_road?: RoadSpec | string;
  readonly accept?: AcceptPolicy;
  readonly start_f?: number;
  readonly roll_rate_cap_dps?: number;
  readonly constraints?: readonly Constraint[];
  readonly occluders?: readonly Occluder[];
  readonly hazards?: readonly Hazard[];
  readonly mistake?: MistakeSpec;
}

// ---------------------------------------------------------------------------
// Figure (design/03 §8, verbatim) — D30's canonical FigureSpec is the SAME
// shape (a scene-text-lowered Figure IS a Figure, D30: "lowerScene is a pure
// total lowering" onto this schema); `FigureSpec` is aliased, not re-declared.

export type FigureRole = "ideal" | "alternative" | "mistake" | "reference";

export type LineSpecKind = SolveSpec | MistakeSpec | Scenario;

export interface FigureLine {
  readonly name: string;
  readonly role: FigureRole;
  readonly spec: LineSpecKind;
}

/** design/03 §8: `feature[:corner][#n]@line ±m`, closed feature set. */
export type LabelFeature =
  | "turn_point" | "apex" | "exit" | "release"
  | "correction" | "run_wide_detect" | "end" | "sight_ray";

export interface FigureLabel {
  readonly feature: LabelFeature;
  readonly corner?: string;
  readonly n?: number;
  readonly line: string;
  readonly offset_m?: number;
  readonly text?: string;
}

/** closed marker classes (design/03 §8); `auto|all|none` or an explicit class list. */
export type MarkClass = "turn_point" | "apex" | "exit" | "release";
export type MarkSpec = "auto" | "all" | "none" | readonly MarkClass[];

export interface Figure {
  readonly road: RoadSpec;
  readonly occluders?: readonly Occluder[];
  readonly hazards?: readonly Hazard[];
  readonly lines: readonly FigureLine[];
  readonly labels?: readonly FigureLabel[];
  readonly marks?: MarkSpec;
  /** projection hook — vocabulary owned by render/ (opaque here, ARCHITECTURE §4) */
  readonly view?: unknown;
  readonly note?: string;
  /**
   * design/06 §3.1 stage 11's figure-level placard boxes — an ORDERED list of
   * author-supplied strings, each drawn as its own box in the margin band.
   * OMITTED (never `[]`) when the figure declares none: `spec_hash` is fnv-1a
   * over the lowered form, so a defaulted key would move every committed stamp.
   * Distinct from `note?`, which is a caption (05 §7 `meta`) and never ink.
   */
  readonly placards?: readonly string[];
}

/** D30: FigureSpec JSON is the canonical figure spelling; scene text is sugar. */
export type FigureSpec = Figure;

// ---------------------------------------------------------------------------
// DEVIATION NOTE (recorded in the WP-05 return too): ARCHITECTURE §5 phrases
// the interface as `validate(json) → Result<Scenario>`, and §4's type-ownership
// table separately files `ResolvedScenario` at core/types.ts as "frozen
// post-validate form the engine consumes". The two cannot be the same value
// when `turn_in.target === "tangent_inside"`: design/03 §6.1 keeps that value
// legal wire input ("defers the magnitude to the solver"), but
// `core.ResolvedTurnInAction.target` (WP-01, frozen, not owned by this
// package) is `{lean_deg: number}` only — no symbolic slot. `validate()` is
// explicitly closed-form and never runs the engine or solver (03 §5.7), so it
// cannot discharge that deferral itself. Resolution taken here: `validate()`
// returns `Result<ValidatedScenario>` (this file) — identical to
// `core.ResolvedScenario` in every field except `rider.plan`'s turn_in variant,
// which keeps the `TurnInTarget` union. Once a solver has rewritten every
// `tangent_inside` to an explicit lean (the "literalize" step, 03 §7.4;
// "solvers rewrite every solved turn_in to the fully explicit form", 03 §6.1),
// a `ValidatedScenario` value is structurally a `core.ResolvedScenario` and
// downstream packages (solve/) may narrow it as such.
