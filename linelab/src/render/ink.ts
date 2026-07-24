// render/ink.ts — the ink grammar table (design/06 §5.2, D28) and the terminal
// glyph vocabulary (§3.1 stage 8). Colour is NEVER derived here — every line's
// stroke colour is its own `Verdict.quality` (plan/doctrine/quality.ts) read
// off `QUALITY_COLOUR` (render/constants.ts) — the one colour law is imported,
// never re-derived (ARCHITECTURE drift risk #3).
//
// D28 supersedes 06 §5.2's original "role = dash tier" law: dash is reserved
// for the `reference` role and non-trajectory ink (sight rays); every OTHER
// trajectory (ideal/alternative/mistake) is solid with an arrowhead, and role
// reads from stroke-width tier + the legend, never from dashing a mistake/
// alternative line.

import type { FigureRole } from "../plan/types.js";
import type { TerminatedReason } from "../core/types.js";
import { W_IDEAL, W_LINE, W_REF, DOT_REF, W_RAY, DASH_SIGHT, RAY_ALPHA, W_LEADER } from "./constants.js";

/** design/06 §3.1 stage 8: draw order `reference → alternative → mistake → ideal` (ideal on top). */
export const ROLE_DRAW_ORDER = ["reference", "alternative", "mistake", "ideal"] as const satisfies readonly FigureRole[];

/** Sort key for role draw order; also the tie-break rule for marker collapse (§3.1 stage 9: "ideal wins ties"). */
export function roleRank(role: FigureRole): number {
  return ROLE_DRAW_ORDER.indexOf(role);
}

export interface TrajectoryInk {
  readonly width: number;
  readonly dash: string | null;
  readonly arrowhead: true; // design/06 §5.2: "every trajectory ends in an arrowhead" — always true here
}

/**
 * design/06 §5.2 verbatim ink table's trajectory rows (D28). `reference` is the
 * only dashed (dotted) trajectory role; `ideal` gets the widest stroke;
 * `alternative`/`mistake` share the plain line width. Colour is never a
 * function of role (D9) — callers stroke with `QUALITY_COLOUR[line.quality]`.
 */
export function trajectoryInk(role: FigureRole): TrajectoryInk {
  if (role === "ideal") return { width: W_IDEAL, dash: null, arrowhead: true };
  if (role === "reference") return { width: W_REF, dash: DOT_REF, arrowhead: true };
  return { width: W_LINE, dash: null, arrowhead: true }; // alternative | mistake
}

/** design/06 §5.2 — the ONE dashed, no-arrowhead ink: sight rays, verdict-coloured, semi-opaque. */
export const SIGHT_RAY_INK = Object.freeze({ width: W_RAY, dash: DASH_SIGHT, opacity: RAY_ALPHA, arrowhead: false });

/** design/06 §5.2 — label leaders: solid, neutral (never a verdict colour), no arrowhead. */
export const LEADER_INK = Object.freeze({ width: W_LEADER, colour: "#4a4a4a", arrowhead: false });

// ---------------------------------------------------------------------------
// §3.1 stage 8 — terminal glyph vocabulary (presentation-only; sizes TUNING,
// no named size constants given in 06, so none are minted here).

export type TerminalGlyphKind = "arrow" | "arrow_tick" | "burst" | "bar";

/** design/06 §3.1 stage 8 terminal-glyph table, verbatim reason→treatment map. */
export function terminalGlyphFor(reason: TerminatedReason): TerminalGlyphKind {
  switch (reason) {
    case "off_road":
      return "arrow_tick"; // arrowhead on the edge crossing + a short edge tick
    case "crash":
      return "burst"; // ×-burst REPLACES the arrowhead
    case "stopped":
      return "bar"; // transverse "full stop" tick REPLACES the arrowhead
    case "road_end":
    case "max_time":
    case "max_dist":
      return "arrow"; // plain arrowhead — the natural/guarded exit, no extra glyph
  }
}

/** Whether the terminal glyph still carries the trajectory's own arrowhead (burst/bar replace it). */
export function glyphKeepsArrowhead(glyph: TerminalGlyphKind): boolean {
  return glyph === "arrow" || glyph === "arrow_tick";
}
