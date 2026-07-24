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
