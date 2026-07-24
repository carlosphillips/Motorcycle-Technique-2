import type { Hand, RiderProfileName, SsdModel } from "../core/types.js";
import type { ResolvedBrakeAction, ResolvedThrottleAction, ResolvedPositionAction, ResolvedStart, ResolvedConfig } from "../core/types.js";
import type { RoadSpec } from "../road/types.js";
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
export type TurnInTarget = {
    readonly lean_deg: number;
} | "tangent_inside";
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
export interface RiderStart extends ResolvedStart {
}
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
export interface ValidatedTurnInAction {
    readonly do: "turn_in";
    readonly id: string;
    readonly at_s: number;
    readonly target: TurnInTarget;
    readonly hand: Hand;
}
export type ValidatedPlanAction = ResolvedBrakeAction | ValidatedTurnInAction | ResolvedThrottleAction | ResolvedPositionAction;
export interface ValidatedRider {
    readonly profile: RiderProfileName;
    readonly roll_rate_cap_dps?: number;
    readonly start: {
        readonly speed_kmh: number;
        readonly f?: number;
        readonly d?: number;
    };
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
export type MistakeScope = readonly string[] | "all_corners";
export interface MistakeSpec {
    /** validated against plan/mistakes.ts MISTAKE_KINDS — not re-typed as a literal union here to avoid a types.ts → mistakes.ts import cycle */
    readonly kind: string;
    readonly params?: Readonly<Record<string, number | string>>;
    readonly scope?: MistakeScope;
}
export type ConstraintBound = "f_min" | "f_max" | "v_max_kmh" | "sight_margin_min_m";
export type ConstraintSpan = {
    readonly from: string;
    readonly to: string;
} | {
    readonly at: string;
};
export interface Constraint {
    readonly id: string;
    readonly span: ConstraintSpan;
    readonly bound: ConstraintBound;
    readonly value: number;
}
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
export type FigureRole = "ideal" | "alternative" | "mistake" | "reference";
export type LineSpecKind = SolveSpec | MistakeSpec | Scenario;
export interface FigureLine {
    readonly name: string;
    readonly role: FigureRole;
    readonly spec: LineSpecKind;
}
/** design/03 §8: `feature[:corner][#n]@line ±m`, closed feature set. */
export type LabelFeature = "turn_point" | "apex" | "exit" | "release" | "correction" | "run_wide_detect" | "end" | "sight_ray";
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
}
/** D30: FigureSpec JSON is the canonical figure spelling; scene text is sugar. */
export type FigureSpec = Figure;
export {};
