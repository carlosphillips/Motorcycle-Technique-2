import type { ResolvedOccluder, Sample, SightTrend, Trajectory } from "../core/types.js";
import type { ComposedRoad } from "../road/types.js";
/**
 * `analyzeSight(traj, road, occluders)`: rebases `sight_ride_m`, injects
 * `hazard_visible` + `sight_min` events, and returns a freshly-frozen
 * Trajectory (the input is immutable; nothing here mutates it).
 */
export declare function analyzeSight(traj: Trajectory, road: ComposedRoad, occluders: readonly ResolvedOccluder[]): Trajectory;
/**
 * `sight_trend` at sample `index` (05 §4, exact): compare `sight_m[index]`
 * against `sight_m` at the sample nearest `s − SIGHT_TREND_WINDOW_M`, clamped
 * to the first sample early in the line; `Δ > +DEADBAND` → "opening",
 * `Δ < −DEADBAND` → "closing", else "steady".
 */
export declare function sightTrendAt(samples: readonly Sample[], index: number): SightTrend;
