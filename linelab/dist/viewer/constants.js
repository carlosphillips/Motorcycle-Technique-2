// viewer/constants.ts — every design/07-owned constant the v0.2 surface needs
// (ARCHITECTURE §6.6: one constants.ts per owning module; 07 → viewer/).
//
// PHASE LAW (00 §3, ARCHITECTURE §6.4): 07's POV constants — `eye_height_m`,
// `LOOK_MAX_DEG`, `fov_deg`, `near_m`, `CHEVRON_INSET`, `POV_FAN_ALPHA`, the
// per-kind occluder presentation heights, `POV_OCCLUDE_CLEAR_M` — belong to
// the POV view (07 §5), which is immersion (v0.3). They are ABSENT here, not
// stubbed, exactly as `core/types.ts` keeps the D45 members absent.
/**
 * design/07 §3.1 — playback speed multipliers, "of real time". Declaration
 * order is the doc's order and is the order the UI offers them in.
 */
export const PLAYBACK_SPEEDS = [0.25, 0.5, 1, 2];
/** design/07 §3.1 — the frame-step button advances one HUD refresh, ±0.1 s. */
export const FRAME_STEP_S = 0.1;
// ---------------------------------------------------------------------------
// Glyph presentation (07 §3.2's top-down bike glyph — "a bike glyph at (x, y)
// rotated to heading psi, with lean phi encoded as a tilt-proportional
// side-bar"). These are the viewer's own presentation-only style constants,
// expressed in TRUE METRES so the overlay self-scales with the drawn scene's
// world-unit viewBox (render/topdown.ts draws in true metres) — no second copy
// of `render/`'s frame/px layout math exists here.
/** m — glyph body length along heading (a motorcycle's wheelbase-ish read). */
export const GLYPH_LENGTH_M = 2.0;
/** m — glyph body half-width across heading. */
export const GLYPH_HALF_WIDTH_M = 0.35;
/** m — the tilt-bar's length at the lean ceiling; scales linearly with |phi| / phi_max. */
export const GLYPH_TILT_BAR_M = 1.2;
// ---------------------------------------------------------------------------
// Save-window overlay presentation (07 §3.6 — "a neutral save-window glyph …
// an OPEN RING WITH A TICK, deliberately distinct from the ring apex marker
// and from the corrective ghost's stroke"). 07 spells the GLYPH but no
// dimension, so these are presentation-only locals with no TUNING status
// (ARCHITECTURE §6.6's rule for unnamed design literals), in true metres like
// the bike glyph above.
//
// The ink is NEUTRAL by law: 07 §3.6 — "No line ink is modulated anywhere, in
// any view — `quality` remains the single total colour function per line (D9)."
// This value is therefore deliberately NOT a member of render/constants.ts's
// QUALITY_COLOUR, and a test asserts it is not.
/** the overlay's one neutral ink */
export const SAVE_WINDOW_INK = "#3d3d3d";
/** m — the open ring's radius at the projected `s_close_m` */
export const SAVE_WINDOW_RING_R_M = 0.55;
/** m — the ring's tick, drawn outward so the glyph cannot read as a closed apex ring */
export const SAVE_WINDOW_TICK_M = 0.45;
//# sourceMappingURL=constants.js.map