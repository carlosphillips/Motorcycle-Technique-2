import type { InstantState, ResolvedPlanAction, RoadModel, Sample, SightTrend, Trajectory } from "./types.js";
import type { Result } from "./result.js";
/** The 05 §4 sight-trend rule (implemented by sight/analyze.ts `sightTrendAt`). */
export type SightTrendRule = (samples: readonly Sample[], index: number) => SightTrend;
/**
 * The core-consumable slice of one line of an envelope (see the file banner):
 * the line's own `trajectory` and resolved `plan`, plus the figure's ONE
 * composed road and the sight-trend rule as injected values.
 */
export interface StateAtInput {
    /** the line's recorded trajectory (05 §2–§5) */
    readonly trajectory: Trajectory;
    /** the figure's ONE composed road (`FigureResult.road`) — corridor algebra + corner records */
    readonly road: RoadModel;
    /** `resolved_scenario.rider.plan` — `derived.action` addresses against it (05 §7) */
    readonly plan: readonly ResolvedPlanAction[];
    /** the 05 §4 windowed+deadbanded trend rule over the recorded `sight_m` channel */
    readonly sightTrendAt: SightTrendRule;
}
/** Exactly one of `s` or `t` (both or neither → err(SCHEMA), 05 §4). */
export type StateAtQuery = {
    readonly s: number;
} | {
    readonly t: number;
};
/**
 * `dualAt(trajectory, {s} | {t})` — the OTHER coordinate of the same instant,
 * under 05 §3.2's `linear` rule (both `s` and `t` are on its field list). The
 * viewer's axis toggle and playback schedule call this instead of carrying
 * their own bracket-and-lerp; `stateAt` and `dualAt` cannot disagree because
 * they share `locate`.
 *
 * Like `stateAt` it never clamps: a query outside `[first, terminated]` is
 * `BAD_RANGE`, and clamping stays a caller (viewer) policy (05 §4).
 */
export declare function dualAt(trajectory: Trajectory, query: StateAtQuery): Result<number>;
/**
 * `stateAt(line, {s | t})` — everything about the bike at this point (05 §4).
 * Pure, Result-based, no IO; the returned InstantState is frozen.
 */
export declare function stateAt(input: StateAtInput, query: StateAtQuery): Result<InstantState>;
