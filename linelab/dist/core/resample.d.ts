import type { RoadModel, SightCaster } from "./types.js";
import type { RawPoint, RetainedPoint } from "./record.js";
/**
 * Resample the raw series onto the ds_m arc grid, appending the final exact
 * sample at termination (raw's last point — already the bracketed crossing
 * state). `raw` must have ≥ 1 point with strictly non-decreasing t; s is
 * expected monotone over the run (forward riding), and grid stations that can
 * no longer be bracketed are skipped defensively.
 */
export declare function resample(raw: readonly RawPoint[], road: RoadModel, sight: SightCaster, ds: number): RetainedPoint[];
