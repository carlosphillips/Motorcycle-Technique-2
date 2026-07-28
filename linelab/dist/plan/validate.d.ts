import type { Result } from "../core/result.js";
import type { RoadSpec } from "../road/types.js";
import type { Occluder, Hazard, ValidatedScenario } from "./types.js";
export declare function validate(json: unknown): Result<ValidatedScenario>;
/**
 * The world half of a `FigureSpec` (design/03 §8): everything a figure declares
 * that is decidable before a single line is solved. A structural subset, so
 * both a whole `Figure` and a bare `{road}` satisfy it.
 */
export interface FigureWorldSpec {
    readonly road: RoadSpec;
    readonly occluders?: readonly Occluder[];
    readonly hazards?: readonly Hazard[];
}
/**
 * `validate()` applied to a figure's world: its road, its occluders and its
 * hazards, under a rider that rides nothing. Returns the same
 * `ValidatedScenario` — resolved occluders/hazards at absolute stations — that
 * the bake's composed skeleton is built from, and the same typed error the bake
 * would have raised, at whichever verb asks first.
 */
export declare function validateFigureWorld(fig: FigureWorldSpec): Result<ValidatedScenario>;
