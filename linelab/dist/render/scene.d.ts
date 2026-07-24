import type { FigureRole } from "../plan/types.js";
import type { Outcome, OccluderKind, TerminatedReason } from "../core/types.js";
import type { Quality } from "../plan/doctrine/quality.js";
import type { TerminalGlyphKind } from "./ink.js";
export interface DrawnPoint {
    readonly x: number;
    readonly y: number;
}
/** design/06 §3.1 stages 2–3: the road surface polygon + lane markings, station-ordered, clipped to the window. */
export interface DrawnRoad {
    readonly lane_width_m: number;
    /** true ⇒ suppress the centreline marking, keep edge lines (design/03 §6, stage 3). */
    readonly use_full_width: boolean;
    readonly left: readonly DrawnPoint[];
    readonly right: readonly DrawnPoint[];
    readonly centre: readonly DrawnPoint[];
}
/** design/06 §3.1 stage 5: one schematic glyph per occluder (hedge/wall/bank/vehicle, design/03 §4 vocabulary). */
export interface DrawnOccluder {
    readonly id: string;
    readonly kind: OccluderKind;
    readonly anchor: DrawnPoint;
    readonly footprint: readonly DrawnPoint[];
}
/**
 * design/06 §3.1 stage 4: the gravel hazard's μ-override band, drawn as
 * explicit stippled circles (carried rule: no SVG `<pattern>`). `footprint`
 * is the band's quad-strip polygon (the same lo/hi-in-d geometry
 * `solve/solve.ts`'s `hazardBandMu` uses for physics, recomputed here for
 * drawing — no engine coupling); `stipples` are deterministic circle centres
 * inside it (a fixed grid, never RNG — D29).
 */
export interface DrawnHazard {
    readonly id: string;
    readonly kind: "gravel";
    readonly footprint: readonly DrawnPoint[];
    readonly stipples: readonly DrawnPoint[];
}
/** design/06 §3.1 stage 9: one glyph per enabled-class trajectory event (the marker-from-event law). */
export interface DrawnMarker {
    readonly cls: "turn_point" | "apex" | "exit" | "release";
    readonly at: DrawnPoint;
    /** true station — the §3.1 stage 9 coincidence-collapse key (MARK_COINCIDE_EPS_M). */
    readonly s: number;
    readonly colour: string;
    readonly line_id: string;
}
/**
 * design/06 §3.1 stage 7: one dashed ray per selected `turn_in`, verdict-
 * coloured, terminating at the limit point. `s_limit` is the sight cast's own
 * station (`sight/cast.ts`'s `SightCast.s_limit`, carried on the owning
 * `Sample` as `s + sight_m`) — stage 6's occlusion wash starts there, per
 * §3.1 stage 6 ("the road area beyond the limit point").
 */
export interface DrawnSightRay {
    readonly from: DrawnPoint;
    readonly to: DrawnPoint;
    readonly colour: string;
    readonly s_limit: number;
}
/** design/06 §3.1 stage 8's terminal-glyph selection (design/06 §3.1 table; render/ink.ts owns the reason→glyph map). */
export interface DrawnTerminal {
    readonly reason: TerminatedReason;
    readonly glyph: TerminalGlyphKind;
    readonly at: DrawnPoint;
    /** the line's own final heading (`Sample.psi`, degrees), rotated with the scene — the `stopped` bar is transverse to THIS. */
    readonly heading_deg: number;
    /**
     * the ROAD EDGE's tangent heading at the crossing, degrees, rotated with the
     * scene — `null` on every reason but `off_road`. design/06 §3.1 stage 8
     * spells the `off_road` treatment as "arrowhead on the edge crossing + a
     * short tick **along the road edge** at the crossing"; the edge tangent is
     * road geometry, so only `project()` (which holds `ComposedRoad.worldAt`)
     * can supply it — `renderTopdown` stays projection-agnostic and just draws
     * the heading it is handed.
     */
    readonly edge_heading_deg: number | null;
}
/** One drawn trajectory (design/06 §3.1 stage 8) — every field a projected/derived read of its `LineResult`. */
export interface DrawnLine {
    readonly line_id: string;
    readonly role: FigureRole;
    readonly label: string;
    readonly quality: Quality;
    readonly outcome: Outcome;
    /** `QUALITY_COLOUR[quality]` — colour is never role-derived (D9). */
    readonly colour: string;
    /** station-ordered, clipped to the window; identity on `(x, y)` in v0.1 true mode (ARCHITECTURE §6.5, P6). */
    readonly polyline: readonly DrawnPoint[];
    readonly terminal: DrawnTerminal;
    /** null iff no occluder in the figure, or the line has no `turn_in` event to anchor the default ray (§3.1 stage 7). */
    readonly sightRay: DrawnSightRay | null;
}
export interface LegendSwatch {
    readonly colour: string;
    readonly width: number;
    readonly dash: string | null;
    readonly arrowhead: boolean;
}
/** design/06 §5.3 legend-row grammar: `<swatch> <name> — <role> · <quality> [(<outcome>)]`. */
export interface LegendRow {
    readonly line_id: string;
    readonly name: string;
    readonly role: FigureRole;
    readonly quality: Quality;
    /** appended iff quality !== "good" (§5.3). */
    readonly outcome: Outcome | null;
    readonly swatch: LegendSwatch;
}
/** design/06 §3.1 stage 10: a resolved callout — leader endpoint on the owning line's projected sample. */
export interface DrawnLabel {
    readonly text: string;
    readonly anchor: DrawnPoint;
    /** true station of the anchoring sample — the window-crop key (a label whose anchor is cropped out draws nothing, same rule as every station-indexed glyph). */
    readonly s: number;
}
/**
 * The sole input to `renderTopdown` and the sole output of `project()`
 * (ARCHITECTURE §5). v0.1 scope: `mode: "true"` only — identity ∘ crop, no
 * compression/width_exag/degradation machinery (ARCHITECTURE §6.5), so
 * `degraded` is always `false` and `orient` only ever carries the caller's
 * explicit numeric override or the true-mode default `0` (design/06 §2.1/§2.4).
 */
export interface DrawnScene {
    readonly mode: "true";
    /** true-metre station bounds actually drawn (the §2.4 auto-window, or the explicit/`"all"` crop). */
    readonly window: {
        readonly from_s: number;
        readonly to_s: number;
    };
    readonly orient: 0 | 90 | 180 | 270;
    /** tight drawn bounding box in true metres, aspect-floor padded (§2.4) — the proportion gate's `frame_aspect` input. */
    readonly frame: {
        readonly width: number;
        readonly height: number;
    };
    /**
     * the §2.4 orient rotation's pivot, in PRE-rotation world coordinates —
     * exposed so the composition point (render/index.ts) can map station-
     * anchored authoring ink (markers, label anchors — derived in world space
     * by markers.ts/labels.ts) through the SAME rigid rotation project()
     * applied to the road/lines. Without this, an orient≠0 scene draws its
     * markers where the pre-rotation line was — the fig-08-06 "markers
     * scattered in the grass" judge finding.
     */
    readonly pivot: DrawnPoint;
    /** always `false` in v0.1 true mode — no width_exag machinery exists yet to degrade (§2.6). */
    readonly degraded: false;
    readonly road: DrawnRoad;
    readonly occluders: readonly DrawnOccluder[];
    /** design/06 §3.1 stage 4: gravel hazard patches; empty when the figure has none. */
    readonly hazards: readonly DrawnHazard[];
    /**
     * design/06 §3.1 stage 6: the occluded-region wash polygon (road strip from
     * the designated sight ray's `s_limit` onward), or `null` when no line
     * carries a resolved sight ray. Precomputed here (not in topdown.ts) because
     * only `project()` holds `road.worldAt` to place the exact boundary.
     */
    readonly occlusionWash: readonly DrawnPoint[] | null;
    readonly lines: readonly DrawnLine[];
    /** stage 9 output, coincidence-collapsed — empty until markers.ts's `deriveMarkers` attaches them. */
    readonly markers: readonly DrawnMarker[];
    /** stage 10 output — empty until labels.ts's `resolveLabels` attaches them. */
    readonly labels: readonly DrawnLabel[];
    readonly legend: {
        readonly visible: boolean;
        readonly rows: readonly LegendRow[];
    };
    /** null in v0.1 true mode — the disclosure footnote is diagram-mode-only chrome (§2.7). */
    readonly footnote: string | null;
}
/** Pure attach — a new `DrawnScene`, never a mutation of `scene` (markers.ts's `deriveMarkers` output). */
export declare function withMarkers(scene: DrawnScene, markers: readonly DrawnMarker[]): DrawnScene;
/** Pure attach — a new `DrawnScene`, never a mutation of `scene` (labels.ts's `resolveLabels` output). */
export declare function withLabels(scene: DrawnScene, labels: readonly DrawnLabel[]): DrawnScene;
