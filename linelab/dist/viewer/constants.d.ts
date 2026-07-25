/**
 * design/07 §3.1 — playback speed multipliers, "of real time". Declaration
 * order is the doc's order and is the order the UI offers them in.
 */
export declare const PLAYBACK_SPEEDS: readonly [0.25, 0.5, 1, 2];
export type PlaybackSpeed = (typeof PLAYBACK_SPEEDS)[number];
/** design/07 §3.1 — the frame-step button advances one HUD refresh, ±0.1 s. */
export declare const FRAME_STEP_S = 0.1;
/** m — glyph body length along heading (a motorcycle's wheelbase-ish read). */
export declare const GLYPH_LENGTH_M = 2;
/** m — glyph body half-width across heading. */
export declare const GLYPH_HALF_WIDTH_M = 0.35;
/** m — the tilt-bar's length at the lean ceiling; scales linearly with |phi| / phi_max. */
export declare const GLYPH_TILT_BAR_M = 1.2;
/** the overlay's one neutral ink */
export declare const SAVE_WINDOW_INK = "#3d3d3d";
/** m — the open ring's radius at the projected `s_close_m` */
export declare const SAVE_WINDOW_RING_R_M = 0.55;
/** m — the ring's tick, drawn outward so the glyph cannot read as a closed apex ring */
export declare const SAVE_WINDOW_TICK_M = 0.45;
/** the corrective ghost's one neutral ink — not a verdict colour, not the save ink */
export declare const CORRECTIVE_GHOST_INK = "#4a5a6a";
/** ghost opacity (07 §3.5) — a counterfactual overlay reads under the figure */
export declare const CORRECTIVE_GHOST_OPACITY = 0.5;
/** the opacity a non-focused line's ghost glyph draws at (07 §4.2 "reduced opacity") */
export declare const COMPARE_GHOST_OPACITY = 0.4;
