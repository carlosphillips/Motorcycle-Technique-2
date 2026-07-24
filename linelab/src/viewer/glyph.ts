// viewer/glyph.ts — the top-down cursor overlay (design/07 §2.3's "the same
// picture as the exported figure, PLUS a glyph layer", §3.2).
//
// This is the one drawing this module owns. `render/`'s SVG builders are
// reused verbatim (07 §2.3) — nothing here re-draws a road, a line, a marker
// or a label; the overlay is a `<g>` appended to `renderTopdown`'s output,
// in the SAME world-metre coordinate space that output's viewBox already
// establishes, so no second copy of `render/`'s frame/scale math exists.
//
// 07 §3.2's spec, verbatim:
//   "a bike glyph at (x, y) rotated to heading psi, with lean phi encoded as a
//    tilt-proportional side-bar on the glyph (the top-down cannot show roll
//    directly; the bar makes it legible without pretending to). The glyph is
//    drawn in the line's verdict colour per D9."
// Colour therefore comes from `render/constants.ts`'s `QUALITY_COLOUR` keyed
// by the line's STORED `verdict.quality` — the one colour law (D9), never a
// second derivation (ARCHITECTURE drift risk #3).

import type { InstantState } from "../core/types.js";
import type { DrawnScene } from "../render/scene.js";
import { rotatePoint } from "../render/project.js";
import { QUALITY_COLOUR } from "../render/constants.js";
import type { LineResult } from "../solve/types.js";
import { GLYPH_HALF_WIDTH_M, GLYPH_LENGTH_M, GLYPH_TILT_BAR_M } from "./constants.js";

export interface GlyphPlacement {
  readonly line_id: string;
  /** world metres, AFTER the scene's orient rotation */
  readonly x: number;
  readonly y: number;
  /** deg — heading, AFTER the scene's orient rotation */
  readonly heading_deg: number;
  /** deg — recorded lean; sign is the tilt-bar's side */
  readonly phi_deg: number;
  /** −1..1 — |phi| / phi_max, the bar's proportional length */
  readonly tilt_frac: number;
  readonly colour: string;
}

/**
 * Place the glyph for one line at one instant. The instant is `stateAt`'s
 * output — the glyph rides the SAME numbers the HUD shows, so glyph and HUD
 * can never disagree.
 */
export function placeGlyph(instant: InstantState, line: LineResult, scene: DrawnScene): GlyphPlacement {
  const p = rotatePoint({ x: instant.sample.x, y: instant.sample.y }, scene.pivot.x, scene.pivot.y, scene.orient);
  const max = instant.derived.phi_max_deg;
  const frac = max === 0 ? 0 : instant.sample.phi / max;
  return Object.freeze({
    line_id: line.line_id,
    x: p.x,
    y: p.y,
    heading_deg: instant.sample.psi + scene.orient,
    phi_deg: instant.sample.phi,
    tilt_frac: frac < -1 ? -1 : frac > 1 ? 1 : frac,
    colour: QUALITY_COLOUR[line.verdict.quality]
  });
}

function num(n: number): string {
  return String(Number(n.toFixed(4)));
}

/**
 * The overlay `<g>`: an arrowhead body pointing along `psi`, plus the lean
 * tilt-bar across it. Both are sized in TRUE METRES (viewer/constants.ts), so
 * the overlay scales with the drawing instead of re-deriving a pixel scale.
 */
export function glyphSvg(g: GlyphPlacement): string {
  const half = GLYPH_HALF_WIDTH_M;
  const len = GLYPH_LENGTH_M;
  const body = `${num(len / 2)},0 ${num(-len / 2)},${num(half)} ${num(-len / 2)},${num(-half)}`;
  const bar = GLYPH_TILT_BAR_M * g.tilt_frac;
  return (
    `<g data-overlay="glyph" data-line="${g.line_id}" ` +
    `transform="translate(${num(g.x)} ${num(g.y)}) rotate(${num(g.heading_deg)})">` +
    `<polygon points="${body}" fill="${g.colour}" stroke="#ffffff" stroke-width="0.08"/>` +
    `<line x1="0" y1="0" x2="0" y2="${num(bar)}" stroke="${g.colour}" stroke-width="0.16" data-overlay="tilt-bar"/>` +
    `</g>`
  );
}

/**
 * Append overlay markup to a finished SVG string, immediately before the
 * closing tag — the painter's-order position 07 §3.2 implies (the glyph rides
 * on top of the exported picture, changing nothing beneath it). Returns the
 * SVG unchanged when it carries no closing tag (`fallbackSvg` output), because
 * a failed drawing must not be made worse by an overlay.
 */
export function withOverlay(svg: string, overlay: string): string {
  const close = svg.lastIndexOf("</svg>");
  if (close < 0) return svg;
  return svg.slice(0, close) + overlay + svg.slice(close);
}
