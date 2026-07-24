import type { LineResult } from "../solve/types.js";
import type { Phase } from "../core/types.js";
/**
 * A TRUE-station window — the caller passes the top-down view's resolved
 * window (`DrawnScene.window` = `{from_s, to_s}`) so the shaded band marks
 * exactly the span the drawing shows (06 §4).
 */
export interface ControlsWindow {
    readonly from: number;
    readonly to: number;
}
/** the six channel panels of 06 §4, in the doc's order */
declare const PANEL_IDS: readonly ["v", "lean", "commands", "grip", "sight", "standup"];
export type ControlsPanelId = (typeof PANEL_IDS)[number];
/** the neutral inks this file may stroke a CHANNEL with (asserted by the strip tests) */
export declare const CONTROLS_NEUTRAL_INKS: readonly string[];
export interface PhaseBand {
    readonly phase: Phase;
    readonly from_s: number;
    readonly to_s: number;
}
/**
 * The road's last corner id, read through `road/compose.ts`'s OWN minting rule
 * (`cornerIdsOf`) rather than a second copy of it — there is one corner-id
 * grammar in this codebase and this file does not restate it.
 * (`ResolvedRoadSpec.segments` is `unknown[]` at core rank, ARCHITECTURE §4;
 * render/ sits after road/ in the DAG and may name the real union.)
 */
export declare function lastCornerIdOf(segments: readonly unknown[]): string | null;
/**
 * The line's phase spans over TRUE station. One band per phase span, in
 * opener order; the run's first sample opens `approach` (05 §4.1's implicit
 * opener) and each opener event closes the previous band at its own exact
 * station. Adjacent openers that re-open the SAME phase are merged — a band is
 * a span, not an event.
 */
export declare function phaseBandsOf(line: LineResult): readonly PhaseBand[];
/**
 * `renderControls(lineResult, window?, cursor?) → SvgString`.
 *
 * @param lineResult the focused line (06 §4: "at most one focused line")
 * @param window     the TOP-DOWN view's resolved true-station window, drawn as
 *                   a shaded band for cross-reference — never a transform
 * @param cursor     the linked cursor's true station; draws a vertical rule
 *                   plus one value chip per channel (the scrub→cursor linkage
 *                   itself is owned by 07, which re-renders this pure function
 *                   per frame)
 */
export declare function renderControls(lineResult: LineResult, window?: ControlsWindow, cursor?: number): string;
export {};
