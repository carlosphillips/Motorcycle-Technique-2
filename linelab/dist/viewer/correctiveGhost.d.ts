import type { Result } from "../core/result.js";
import type { LineResult } from "../solve/types.js";
import type { DrawnScene } from "../render/scene.js";
import type { OverlayPoint } from "./saveWindow.js";
/** The once-per-toggle object; frozen. `null` from the builder ⇒ toggle inert. */
export interface CorrectiveGhostOverlay {
    readonly line_id: string;
    /** the ran-wide corner the shot was computed for (04 §4a.2 — the first) */
    readonly corner_id: string;
    /** §4a.6's wide-vs-runoff decision — `wide` when the save was feasible */
    readonly kind: "wide" | "runoff";
    /**
     * the clip station: `corrective.returned.s` on a feasible (wide) save, or the
     * shadow's own termination station on a runoff — "s* (or its termination
     * station)" (C-SAVEWIN-CLIP).
     */
    readonly s_star_m: number;
    /** the CLIPPED shadow path in world metres (orient applied); LAST vertex is s* */
    readonly path: readonly OverlayPoint[];
    /** the station the last drawn vertex sits at — what C-SAVEWIN-CLIP compares */
    readonly last_vertex_s: number;
    /** the shadow-start station — the `correction` bookmark the ghost is drawn from */
    readonly from_s: number;
    /** 04 §4c.7's lean-only disclosure sentence, verbatim (07 §3.5's legend rule) */
    readonly disclosure: string;
}
/**
 * `correctiveGhostOverlay(line, scene?)` — the once-per-toggle computation.
 *
 * `scene` is the top-down projection the ghost rides on; when given, each drawn
 * vertex is mapped through the SAME §2.4 rigid rotation (`scene.pivot`,
 * `scene.orient`) the road/lines went through, so the overlay needs no second
 * copy of render/'s frame math (the seam viewer/glyph.ts and viewer/saveWindow.ts
 * already use). Without it the path is raw world metres — what a headless caller
 * asserting the clip wants.
 *
 * Returns `ok(null)` when the toggle is inert for this line (no `corrective`, or
 * the shot departed before reaction so there is no shadow).
 */
export declare function correctiveGhostOverlay(line: LineResult, scene?: DrawnScene): Result<CorrectiveGhostOverlay | null>;
/**
 * The overlay `<g>`: the clipped ghost polyline at ghost opacity, neutral ink.
 * Appended to the top-down exactly as viewer/glyph.ts and viewer/saveWindow.ts
 * are — no road/line/marker is redrawn, D9's colour law is untouched. The
 * disclosure rides in a `<title>` so the legend obligation is discharged on the
 * drawing itself (07 §3.5).
 */
export declare function correctiveGhostSvg(overlay: CorrectiveGhostOverlay | null): string;
