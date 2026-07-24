import type { Result } from "../core/result.js";
import type { RoadSpec, SegmentsRoadSpec } from "./types.js";
/**
 * truncateAt(roadSpec, s) → Result<roadSpec>. Accepts any member of the road
 * union (presets/DSL are expanded first) and returns the segments-form spec.
 * `s` at/past the road end returns the (normalized) spec unchanged — there is
 * nothing past `s` to drop. `s ≤ 0` (an empty road) rejects BAD_RANGE.
 */
export declare function truncateAt(spec: RoadSpec, s: number): Result<SegmentsRoadSpec>;
