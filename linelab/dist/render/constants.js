// render/constants.ts — every render-owned constant, copied VERBATIM from
// design/06's tables (§2.2, §2.3, §2.4, §3.1 stage 5b/6/9, §5.2, §6.1) per
// ARCHITECTURE §6.6 ("one constants.ts per owning module; check-threshold data
// lives in the rubric pack, never here"). Cross-module use imports these —
// never re-declares (drift risk #8).
//
// Phase note (ARCHITECTURE §6.5, 00 §3): the diagram projection (mode=
// "diagram") and the D45 continuation fan are DESIGN-COMPLETE but BUILD-
// DEFERRED past v0.1 — "design unchanged, build deferred" (00 §3's phase
// table). The constants below that only matter once those land
// (C_STRAIGHT..WIDTH_EXAG_MAX, FAN_*) are declared now, per this doc's own
// table, but are unreachable from any v0.1 code path: render/project.ts
// rejects `mode: "diagram"` and `view.fan` typed `SCHEMA`/`deferred` before
// any of them could be consulted.
// ---------------------------------------------------------------------------
// §2.2 — the diagram projection's per-segment longitudinal/lateral remap
// (deferred past v0.1; declared for when the projection lands)
/** TUNING, range 4–8 — straights compress hard. */
export const C_STRAIGHT = 5;
/** not TUNING — corners draw at (near) true arc length. */
export const C_ARC = 1;
/** TUNING — transitions compress gently. */
export const C_TAPER = 1.25;
// ---------------------------------------------------------------------------
// §2.3 — auto width_exag solve (deferred past v0.1)
/** TUNING — target drawn width:radius ratio the auto-solve aims for. */
export const WIDTH_RATIO_TARGET = 0.55;
/** TUNING — the auto-solved width_exag clamp ceiling. */
export const WIDTH_EXAG_MAX = 12;
// ---------------------------------------------------------------------------
// §2.4 — the default camera: auto-window, orientation, aspect-floor padding
// (window computation + orient rotation + padding SHIP in v0.1, ARCHITECTURE
// §6.5 — only the projection's compression/width_exag stay deferred)
/** m, TUNING — auto-window lead distance before the first commitment anchor. */
export const WINDOW_LEAD_M = 15;
/** m, TUNING — auto-window tail distance past the last exit/terminal anchor. */
export const WINDOW_TAIL_M = 25;
/** TUNING — long/short drawn-bbox ratio above which diagram-mode "auto" orient rotates (unreachable in v0.1 true mode, where orient defaults to 0 outright, §2.1/§2.4). */
export const ORIENT_ELONGATION_MIN = 1.25;
/** the aspect-floor padding band IS the proportion gate's frame_aspect band — "no new constants" (§2.4). */
export const ASPECT_FLOOR_MIN = 0.55;
export const ASPECT_FLOOR_MAX = 1.8;
// ---------------------------------------------------------------------------
// §3.1 stage 5b — the continuation fan (D45, gated; unreachable in v0.1 —
// no ViewSpec.fan surface, no CommitmentReport consumer exists yet)
export const FAN_ALPHA = 0.14;
export const FAN_HATCH = "2 4";
export const FAN_ALPHA_LINE = 0.3;
export const FAN_DRAW_M = 30.0;
export const FAN_DRAW_SWEEP_MAX_DEG = 60.0;
// ---------------------------------------------------------------------------
// §3.1 stage 4 — gravel surface patches (explicit stippled circles, no SVG
// `<pattern>`). Not spelled numerically by 06 (brief silence) — local names,
// no TUNING status (ARCHITECTURE §6.6).
/** m — stipple grid spacing, both along the band's span and across its width. */
export const GRAVEL_STIPPLE_SPACING_M = 1.2;
/** nominal px at the 1000 px frame (§5.2's convention) — each stipple circle's radius. */
export const GRAVEL_STIPPLE_RADIUS = 1.4;
// ---------------------------------------------------------------------------
// §3.1 stage 6 — occluded-region shading
export const OCCLUSION_ALPHA = 0.35;
// ---------------------------------------------------------------------------
// §3.1 stage 9 — marker coincidence collapse
/** m, TUNING — same-class markers within this true-station gap (AND overlapping drawn glyphs) collapse to one. */
export const MARK_COINCIDE_EPS_M = 1.0;
// ---------------------------------------------------------------------------
// §5.2 — ink grammar (stroke widths/dashes at "the nominal 1000 px frame", all TUNING)
/** local name, not itself a design-doc TUNING literal (ARCHITECTURE §6.6: "unnamed design literals get local names without TUNING status") — the frame width the §5.2 widths are nominal against. */
export const NOMINAL_FRAME_PX = 1000;
export const W_IDEAL = 3.0;
export const W_LINE = 2.2;
export const W_REF = 1.6;
export const DOT_REF = "1.5 3";
export const W_RAY = 1.2;
export const DASH_SIGHT = "6 4";
export const RAY_ALPHA = 0.45;
export const W_LEADER = 0.9;
// ---------------------------------------------------------------------------
// §5.1 — colour law v2 palette (carried, NOT TUNING)
export const QUALITY_COLOUR = Object.freeze({
    good: "#1f6f43",
    caution: "#b07d1e",
    failing: "#b32e2e"
});
// ---------------------------------------------------------------------------
// §6.1 — proportion gate metric bands (TUNING)
export const WIDTH_RATIO_BAND = Object.freeze({ min: 0.45, max: 0.95 });
export const STRAIGHT_SHARE_MAX = 0.45;
export const ROAD_INK_BAND = Object.freeze({ min: 0.25, max: 0.6 });
export const FRAME_ASPECT_BAND = Object.freeze({ min: ASPECT_FLOOR_MIN, max: ASPECT_FLOOR_MAX });
//# sourceMappingURL=constants.js.map