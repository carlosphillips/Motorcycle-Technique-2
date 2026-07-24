import type { LineResult } from "../solve/types.js";
import type { Bookmark, CursorAxis, CursorDomain, StepperState } from "./types.js";
/** The scrubber's extent on one axis — exactly `stateAt`'s own `[first, terminated]`. */
export declare function domainOf(line: LineResult, axis: CursorAxis): CursorDomain;
/**
 * design/07 §3.4 — "the cursor remains draggable across the full scenario
 * extent so surviving lines in compare mode keep stepping": the scrubber's
 * extent is the UNION of the loaded lines' domains, not the focused line's.
 * A line that ended early simply freezes at its terminal sample.
 */
export declare function scenarioDomain(lines: readonly LineResult[], axis: CursorAxis): CursorDomain;
export declare function clampTo(value: number, domain: CursorDomain): number;
/** The initial cursor: the start of the run, paused, at 1× (07 §3.1's default speed). */
export declare function initialStepper(domain: CursorDomain): StepperState;
/** Drag: land the cursor anywhere in the domain. */
export declare function scrubTo(state: StepperState, value: number, domain: CursorDomain): StepperState;
export declare function play(state: StepperState): StepperState;
export declare function pause(state: StepperState): StepperState;
/** design/07 §3.1's closed speed set; an unlisted multiplier is not offered. */
export declare function withSpeed(state: StepperState, speed: number): StepperState;
/**
 * Playback = a scheduled scrub. `wallDeltaS` is real elapsed seconds; the
 * cursor moves `speed × wallDeltaS` of RUN time. On the station axis the same
 * schedule advances the station cursor by the run-time equivalent through
 * `stationForTime`, so both axes play at the same real-time rate — one
 * pathway, two spellings. Reaching the end pauses (the run is over; there is
 * no state past the terminal sample, 05 §4).
 */
export declare function advance(state: StepperState, wallDeltaS: number, domain: CursorDomain, line?: LineResult): StepperState;
/** design/07 §3.1 — the frame-step button: one HUD refresh, ±0.1 s. */
export declare function stepFrame(state: StepperState, direction: 1 | -1, domain: CursorDomain, line?: LineResult): StepperState;
/**
 * design/07 §3.1 — the other frame-step button: ± one recorded Sample. Lands
 * exactly ON a sample's coordinate, which is `stateAt`'s endpoint-exact case
 * (the record verbatim, no interpolation).
 */
export declare function stepSample(state: StepperState, direction: 1 | -1, line: LineResult): StepperState;
/**
 * design/07 §3.1 — "clicking a tick lands the scrubber at the event's
 * interpolated `t`". The bookmark carries the event's exact `t`/`s` (05 §5);
 * this copies the axis-matching one through with no arithmetic.
 */
export declare function jumpTo(state: StepperState, bookmark: Bookmark, domain: CursorDomain): StepperState;
/**
 * design/07 §3.1's axis toggle. Flipping the scrubber axis must not move the
 * bike: the new coordinate is the CURRENT instant's dual, read off the
 * recorded samples by the same bracket-and-lerp rule `stateAt` uses, so
 * `t`-axis 1.20 s and `s`-axis 14.7 m are the same instant.
 */
export declare function toggleAxis(state: StepperState, line: LineResult): StepperState;
/** The station this line reaches at run time `t`. */
export declare function stationForTime(line: LineResult, t: number): number;
/** The run time at which this line reaches station `s`. */
export declare function timeForStation(line: LineResult, s: number): number;
