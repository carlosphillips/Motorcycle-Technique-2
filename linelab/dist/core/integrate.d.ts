import type { ResolvedScenario, Trajectory, World } from "./types.js";
/** Optional per-run overrides; defaults are the 02-owned constants. */
export interface EngineConfig {
    readonly dt_s?: number;
    /** retained arc-grid spacing; defaults to scenario.config.ds_m */
    readonly ds_m?: number;
    readonly max_time_s?: number;
    readonly max_dist_m?: number;
}
/**
 * integrate(scenario, world, cfg) → Trajectory (ARCHITECTURE §5). Pure and
 * total for engine-rank inputs: the runaway guards (max_time/max_dist)
 * guarantee termination; no exception crosses this boundary.
 */
export declare function integrate(scenario: ResolvedScenario, world: World, cfg?: EngineConfig): Trajectory;
