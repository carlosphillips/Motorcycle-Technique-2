import type { Result } from "../core/result.js";
import type { LineResult } from "../solve/types.js";
import { type SaveWindow, type SaveWindowOptions } from "../solve/saveWindow.js";
import type { DrawnScene } from "../render/scene.js";
import type { HudRow } from "./types.js";
/** One world-frame point of a drawn probe (already rotated by the scene's orient). */
export interface OverlayPoint {
    readonly x: number;
    readonly y: number;
}
/** The drawable part of one corner's window — present only for a scalar-bearing status. */
export interface SaveWindowProbe {
    readonly corner_id: string;
    /** = the window's `s_close_m`, verbatim */
    readonly s_close_m: number;
    /** = the window's `tau_close_s`, verbatim */
    readonly tau_close_s: number;
    /** = the window's `s_star_m`, or null on `open_at_end` (no return was observed) */
    readonly s_star_m: number | null;
    /** the CLIPPED probe path in world metres; its LAST vertex is s* (C-SAVEWIN-CLIP) */
    readonly path: readonly OverlayPoint[];
    /** the station the last vertex sits at — what C-SAVEWIN-CLIP compares */
    readonly last_vertex_s: number;
    /** §3.6's leader label, display-clamped */
    readonly label: string;
}
/**
 * The once-per-toggle object. Frozen; every per-frame function below is a pure
 * read of it.
 */
export interface SaveWindowOverlay {
    readonly line_id: string;
    /** every corner's window, INCLUDING the refusing ones — disclosure survives (§4b.5) */
    readonly windows: readonly SaveWindow[];
    /** the drawable subset, in corner order */
    readonly probes: readonly SaveWindowProbe[];
    /** the §4b.7 placard, verbatim — rendered beside every displayed scalar */
    readonly placard: string;
}
/**
 * `saveWindowOverlay(line, scene?)` — the once-per-toggle computation.
 *
 * `scene` is the top-down projection the overlay rides on; when given, each
 * drawable corner's probe path is projected into the same world-metre frame
 * `viewer/glyph.ts` uses (orient applied), so the overlay `<g>` needs no second
 * copy of render/'s frame math. Without it the probe paths are empty and only
 * the HUD/tick surfaces are available — which is what a headless caller wants.
 */
export declare function saveWindowOverlay(line: LineResult, scene?: DrawnScene, opts?: SaveWindowOptions): Result<SaveWindowOverlay>;
/**
 * `saveWindowHudRows(overlay, cursorT)` — the Verdict-group rows for one
 * cursor instant. Every row's `value` is READ from the returned `SaveWindow`
 * and its `path` names the member it came from, which is what makes
 * `C-SAVEWIN-HUD` a walk rather than an inspection. Every printed number is
 * clamped to HORIZON_DISPLAY_DP (04 §4b.5).
 *
 * §3.6's wording, verbatim:
 *   `save window: closes in 0.4 s` before `tau_close_s`
 *   `save window: closed 0.6 s ago` after
 *   `reaction budget −0.6 s vs react 1.0 s` (static)
 *   `save window: still open at the horizon` on `open_at_end`
 * and, on a refusing status, the placard + the status sentence INSTEAD of all
 * of the above.
 */
export declare function saveWindowHudRows(overlay: SaveWindowOverlay, cursorT: number): readonly HudRow[];
/** §3.6's scrubber ticks — one per drawable corner, at `tau_close_s`, verbatim. */
export declare function saveWindowTicks(overlay: SaveWindowOverlay): readonly {
    readonly corner_id: string;
    readonly t: number;
}[];
/**
 * The overlay `<g>`: per drawable corner, the clipped probe polyline, the open
 * ring + tick glyph at `s_close_m`, and the leader label. All neutral ink —
 * D9's colour law is untouched (07 §3.6: "No line ink is modulated anywhere").
 */
export declare function saveWindowOverlaySvg(overlay: SaveWindowOverlay): string;
