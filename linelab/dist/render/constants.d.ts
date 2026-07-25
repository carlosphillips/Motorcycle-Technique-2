import type { Quality } from "../plan/doctrine/quality.js";
/** TUNING, range 4–8 — straights compress hard. */
export declare const C_STRAIGHT = 5;
/** not TUNING — corners draw at (near) true arc length. */
export declare const C_ARC = 1;
/** TUNING — transitions compress gently. */
export declare const C_TAPER = 1.25;
/** TUNING — target drawn width:radius ratio the auto-solve aims for. */
export declare const WIDTH_RATIO_TARGET = 0.55;
/** TUNING — the auto-solved width_exag clamp ceiling. */
export declare const WIDTH_EXAG_MAX = 12;
/** m, TUNING — auto-window lead distance before the first commitment anchor. */
export declare const WINDOW_LEAD_M = 15;
/** m, TUNING — auto-window tail distance past the last exit/terminal anchor. */
export declare const WINDOW_TAIL_M = 25;
/** TUNING — long/short drawn-bbox ratio above which diagram-mode "auto" orient rotates (unreachable in v0.1 true mode, where orient defaults to 0 outright, §2.1/§2.4). */
export declare const ORIENT_ELONGATION_MIN = 1.25;
/** the aspect-floor padding band IS the proportion gate's frame_aspect band — "no new constants" (§2.4). */
export declare const ASPECT_FLOOR_MIN = 0.55;
export declare const ASPECT_FLOOR_MAX = 1.8;
export declare const FAN_ALPHA = 0.14;
export declare const FAN_HATCH = "2 4";
export declare const FAN_ALPHA_LINE = 0.3;
export declare const FAN_DRAW_M = 30;
export declare const FAN_DRAW_SWEEP_MAX_DEG = 60;
/** m — stipple grid spacing, both along the band's span and across its width. */
export declare const GRAVEL_STIPPLE_SPACING_M = 1.2;
/** nominal px at the 1000 px frame (§5.2's convention) — each stipple circle's radius. */
export declare const GRAVEL_STIPPLE_RADIUS = 1.4;
export declare const OCCLUSION_ALPHA = 0.35;
/** m, TUNING — same-class markers within this true-station gap (AND overlapping drawn glyphs) collapse to one. */
export declare const MARK_COINCIDE_EPS_M = 1;
/** local name, not itself a design-doc TUNING literal (ARCHITECTURE §6.6: "unnamed design literals get local names without TUNING status") — the frame width the §5.2 widths are nominal against. */
export declare const NOMINAL_FRAME_PX = 1000;
export declare const W_IDEAL = 3;
export declare const W_LINE = 2.2;
export declare const W_REF = 1.6;
export declare const DOT_REF = "1.5 3";
export declare const W_RAY = 1.2;
export declare const DASH_SIGHT = "6 4";
export declare const RAY_ALPHA = 0.45;
export declare const W_LEADER = 0.9;
export declare const QUALITY_COLOUR: Readonly<Record<Quality, string>>;
export declare const WIDTH_RATIO_BAND: Readonly<{
    min: 0.45;
    max: 0.95;
}>;
export declare const STRAIGHT_SHARE_MAX = 0.45;
export declare const ROAD_INK_BAND: Readonly<{
    min: 0.25;
    max: 0.6;
}>;
export declare const FRAME_ASPECT_BAND: Readonly<{
    min: 0.55;
    max: 1.8;
}>;
/** m, TUNING (§5.2) — eyes-above-road height for a seated rider; the eye rides the bike's reference point (body position out of scope, D5). */
export declare const POV_EYE_HEIGHT_M = 1.4;
/** deg, TUNING (range 60–90, §5.2) — the maximum head-turn from the bike's heading under `look: limit_point`. */
export declare const POV_LOOK_MAX_DEG = 70;
/** deg, TUNING (§5.2) — the pinhole camera's horizontal field of view; focal length follows from the canvas width. */
export declare const POV_FOV_DEG = 60;
/** m, TUNING (§5.2) — near-plane distance; ground vertices with forward distance ≤ this are dropped before projection. */
export declare const POV_NEAR_M = 0.5;
/** fraction of min(frame_w, frame_h), TUNING (§5.2) — the frame-boundary inset R_inset that keeps a clamped limit-point marker fully visible (§5.3 item 7). */
export declare const POV_CHEVRON_INSET_FRAC = 0.05;
/** ratio, presentation-only style constant (§5.3 item 7) — a clamped chevron's arrowhead length as a multiple of the chevron glyph size. */
export declare const POV_ARROW_LEN_RATIO = 1.2;
/** opacity, TUNING (§5.3 item 3b) — continuation-fan road-edge opacity; the fan is D45-gated/deferred, so this is unreachable from any v0.3 code path (declared for when the fan lands). */
export declare const POV_FAN_ALPHA = 0.12;
/**
 * Occluder presentation heights (metres) — owned HERE (design/07 §5.3 item 4:
 * "heights are presentation-only and owned *here*"; 03 owns kind/placement).
 * All TUNING. Every kind satisfies the occlusion invariant by construction (see
 * `POV_OCCLUDE_CLEAR_M`): a vehicle at 1.8 m reads as a van/SUV — the honest
 * height for a footprint the plan-view model says fully occludes.
 */
export declare const POV_OCCLUDER_HEIGHT_M: Readonly<Record<"hedge" | "wall" | "bank" | "vehicle", number>>;
/**
 * m, TUNING (§5.3 item 4) — the occlusion invariant clearance: every occluder
 * kind's presentation height must exceed `POV_EYE_HEIGHT_M` by at least this,
 * or the eye would see over an occluder the plan-view model calls opaque — "a
 * spec violation, not a tuning choice" (C-POV-OCCLUDE's static config arm).
 */
export declare const POV_OCCLUDE_CLEAR_M = 0.4;
