import type { FigureRole } from "../plan/types.js";
import type { TerminatedReason } from "../core/types.js";
/** design/06 §3.1 stage 8: draw order `reference → alternative → mistake → ideal` (ideal on top). */
export declare const ROLE_DRAW_ORDER: readonly ["reference", "alternative", "mistake", "ideal"];
/** Sort key for role draw order; also the tie-break rule for marker collapse (§3.1 stage 9: "ideal wins ties"). */
export declare function roleRank(role: FigureRole): number;
export interface TrajectoryInk {
    readonly width: number;
    readonly dash: string | null;
    readonly arrowhead: true;
}
/**
 * design/06 §5.2 verbatim ink table's trajectory rows (D28). `reference` is the
 * only dashed (dotted) trajectory role; `ideal` gets the widest stroke;
 * `alternative`/`mistake` share the plain line width. Colour is never a
 * function of role (D9) — callers stroke with `QUALITY_COLOUR[line.quality]`.
 */
export declare function trajectoryInk(role: FigureRole): TrajectoryInk;
/** design/06 §5.2 — the ONE dashed, no-arrowhead ink: sight rays, verdict-coloured, semi-opaque. */
export declare const SIGHT_RAY_INK: Readonly<{
    width: 1.2;
    dash: "6 4";
    opacity: 0.45;
    arrowhead: false;
}>;
/** design/06 §5.2 — label leaders: solid, neutral (never a verdict colour), no arrowhead. */
export declare const LEADER_INK: Readonly<{
    width: 0.9;
    colour: "#4a4a4a";
    arrowhead: false;
}>;
export type TerminalGlyphKind = "arrow" | "arrow_tick" | "burst" | "bar";
/** design/06 §3.1 stage 8 terminal-glyph table, verbatim reason→treatment map. */
export declare function terminalGlyphFor(reason: TerminatedReason): TerminalGlyphKind;
/** Whether the terminal glyph still carries the trajectory's own arrowhead (burst/bar replace it). */
export declare function glyphKeepsArrowhead(glyph: TerminalGlyphKind): boolean;
