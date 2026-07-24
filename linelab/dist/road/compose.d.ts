import type { Result } from "../core/result.js";
import type { ComposedRoad, RoadSpec, Segment } from "./types.js";
export interface NormalizedRoadSpec {
    readonly lane_width_m: number;
    readonly bike_margin_m: number;
    readonly use_full_width: boolean;
    readonly segments: readonly Segment[];
    /** the disclosed DSL (design/03 §3.1 disclosure rule; ARCHITECTURE §10.6) */
    readonly dsl: string;
}
/**
 * Resolve the roadSpec union to segments + disclosed DSL. Preset roads expand
 * through the §3.1 table (hand-flip applied); dsl roads keep the authored
 * string verbatim; segment-authored roads get `dsl` filled by printRoadDSL.
 */
export declare function normalizeRoadSpec(spec: RoadSpec): Result<NormalizedRoadSpec>;
/**
 * compose(roadSpec) → Result<RoadModel> (design/03 §2). The returned value is a
 * frozen ComposedRoad. `opts.ds_m` overrides the dense-lookup spacing (defaults
 * to the core ds_m = 0.5 m); the model's analytic closures are exact regardless.
 * The built-in muAt is the lateral-clamped uniform field μ = 1.0; World
 * assembly rebuilds it with config.mu / hazard bands via corridor.withMu.
 */
/**
 * THE corner-id minting rule: `c1, c2, …`, one per CURVED segment, in segment
 * order. Exported because two other surfaces need to name a corner without
 * composing a road (render/controls.ts's phase partition needs the LAST corner
 * id, and tests assert the mapping) — and a second, hand-rolled copy of the
 * rule is exactly the drift ARCHITECTURE §9 exists to forbid.
 */
export declare function cornerIdAtIndex(index: number): string;
/** The corner ids a segment list mints, in order — `compose()`'s own rule, without composing. */
export declare function cornerIdsOf(segments: readonly Segment[]): readonly string[];
export declare function compose(spec: RoadSpec, opts?: {
    readonly ds_m?: number;
}): Result<ComposedRoad>;
