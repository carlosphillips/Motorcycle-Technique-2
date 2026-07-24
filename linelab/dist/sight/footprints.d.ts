import type { ComposedRoad } from "../road/types.js";
import type { OccluderKind, ResolvedOccluder } from "../core/types.js";
/** A world-frame point (x east, y down). */
export interface Vec2 {
    readonly x: number;
    readonly y: number;
}
/**
 * One opaque plan-view footprint: a simple closed polygon (last vertex joins the
 * first) that sight rays cannot cross. `centre` is the footprint's reference
 * centre — for vehicles this is the D27 eye→footprint-centre target the
 * `hazard_visible` analyzer (sight/analyze.ts, WP-07) tests against.
 */
export interface OpaqueFootprint {
    readonly id: string;
    readonly kind: OccluderKind;
    readonly polygon: readonly Vec2[];
    readonly centre: Vec2;
}
/** Resolve ONE occluder to its opaque footprint (design/03 §4). Pure. */
export declare function footprintOf(road: ComposedRoad, occ: ResolvedOccluder): OpaqueFootprint;
/**
 * Resolve every occluder to the opaque set consumed by the sight cast — "the
 * footprint joins the opaque set consumed by sightFrom — no special casing"
 * (design/03 §4). Order preserved (declaration order; the cast is order-independent).
 */
export declare function footprintsOf(road: ComposedRoad, occluders: readonly ResolvedOccluder[]): readonly OpaqueFootprint[];
