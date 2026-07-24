import type { Result } from "../core/result.js";
import type { Segment, SegmentsRoadSpec } from "./types.js";
/**
 * parseRoadDSL(str) → Result<roadSpec> (design/03 §3). Returns the segments-form
 * roadSpec: `{ lane_width_m, segments }`. Whitespace-tolerant; grammar strict.
 */
export declare function parseRoadDSL(str: string): Result<SegmentsRoadSpec>;
/**
 * printRoadDSL(spec) → string (design/03 §3): the canonical one-line spelling
 * (` | ` separators, single spaces). `parse ∘ print ∘ parse` is an identity;
 * the §3.1 preset table strings are already in this canonical form.
 */
export declare function printRoadDSL(spec: {
    readonly lane_width_m: number;
    readonly segments: readonly Segment[];
}): string;
