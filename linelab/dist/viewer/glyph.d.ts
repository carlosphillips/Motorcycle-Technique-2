import type { InstantState } from "../core/types.js";
import type { DrawnScene } from "../render/scene.js";
import type { LineResult } from "../solve/types.js";
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
export declare function placeGlyph(instant: InstantState, line: LineResult, scene: DrawnScene): GlyphPlacement;
/**
 * The overlay `<g>`: an arrowhead body pointing along `psi`, plus the lean
 * tilt-bar across it. Both are sized in TRUE METRES (viewer/constants.ts), so
 * the overlay scales with the drawing instead of re-deriving a pixel scale.
 */
export declare function glyphSvg(g: GlyphPlacement): string;
/**
 * Append overlay markup to a finished SVG string, immediately before the
 * closing tag — the painter's-order position 07 §3.2 implies (the glyph rides
 * on top of the exported picture, changing nothing beneath it). Returns the
 * SVG unchanged when it carries no closing tag (`fallbackSvg` output), because
 * a failed drawing must not be made worse by an overlay.
 */
export declare function withOverlay(svg: string, overlay: string): string;
