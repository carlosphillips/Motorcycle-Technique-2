import type { OpaqueFootprint, Vec2 } from "./footprints.js";
import type { ComposedRoad } from "../road/types.js";
import type { ResolvedOccluder, SightCast } from "../core/types.js";
/**
 * The cast against a pre-resolved opaque set. Exposed so per-sample callers
 * (the SightCaster composed in solve/run.ts) can resolve footprints once per
 * scenario instead of once per sample. Semantics identical to sightFrom.
 */
export declare function castSight(road: ComposedRoad, eye: Vec2, footprints: readonly OpaqueFootprint[]): SightCast;
/**
 * sightFrom(road, eye, occluders) — the design/03 §5.1 signature. Pure; returns
 * no trend; takes no speed. `s_limit` falls back to the eye's own station
 * (sight_m = 0) when the very first forward target is blocked, and runs to
 * road end when nothing blocks.
 */
export declare function sightFrom(road: ComposedRoad, eye: {
    readonly x: number;
    readonly y: number;
}, occluders: readonly ResolvedOccluder[]): SightCast;
