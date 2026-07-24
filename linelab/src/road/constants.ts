// road/constants.ts — every design/03-owned named constant the road layer uses
// (ARCHITECTURE §6.6: one constants.ts per owning module; cross-module use IMPORTS).
// Values copied VERBATIM from design/03; TUNING marks carried exactly as the doc
// gives them. Constants marked TUNING have no book source.

// ---------------------------------------------------------------------------
// §2 — corner record classification & linking

/** 1.15 (ratio) — TUNING. Taper with r1/r2 ≥ this → decreasing; r2/r1 ≥ this → increasing; else constant. */
export const TAPER_RATIO_MIN = 1.15;

/** 1.0 (fraction) — TUNING. linked_next ⇔ gap_to_next_m ≤ LINK_GAP_FRAC · min(L_arc(n), L_arc(n+1)). */
export const LINK_GAP_FRAC = 1.0;

// ---------------------------------------------------------------------------
// §2 — super-tight sweep-content refusal (this module owns the statement; 02 §7 defers)

/** 15 m — local-radius threshold of the U-turn regime. */
export const R_UTURN_MAX = 15;

/** 170 ° — a corner is refused OUT_OF_SCOPE (super_tight_geometry) iff ≥ this much sweep accumulates at r ≤ R_UTURN_MAX. Per corner, never per road (D21). */
export const SWEEP_UTURN_MIN = 170;

// ---------------------------------------------------------------------------
// §3.1 — preset tuning

/** 6 m — preset TUNING. bookEsses' `S 6` links: the hand-flip budget at chain speeds. */
export const LINK_GAP_M = 6;

// ---------------------------------------------------------------------------
// §4 — occluder footprint defaults (all TUNING); consumed by plan/validate
// (default filling) and sight/footprints (band geometry)

/** design/03 §4 band-occluder defaults, per kind: band runs from `margin_m` outside the physical road edge, extending `depth_m` further out. */
export const OCCLUDER_BAND_DEFAULTS = Object.freeze({
  hedge: Object.freeze({ margin_m: 1.0, depth_m: 2.0 }),
  wall: Object.freeze({ margin_m: 0.5, depth_m: 0.3 }),
  bank: Object.freeze({ margin_m: 0, depth_m: 3.0 })
} as const);

/** design/03 §4 vehicle rectangle defaults (len × width), both overridable; `verge_margin_m` is the side-form default margin. */
export const VEHICLE_DEFAULTS = Object.freeze({
  len_m: 4.5,
  width_m: 1.8,
  verge_margin_m: 0.5
} as const);

/** design/03 §4.2 gravel hazard defaults: μ-override band `width_m` wide; `mu > 0` else BAD_RANGE. */
export const GRAVEL_DEFAULTS = Object.freeze({
  width_m: 1.4,
  mu: 0.4
} as const);

// ---------------------------------------------------------------------------
// §7a.2 code-side constant needed by the v0.1 road layer (truncateAt ships in
// v0.1 per §7a.11 — a road-layer primitive, NOT gated behind the D45 spike)

/** 0.05 m — TUNING. truncateAt drops split fragments shorter than this. */
export const MIN_SEG_M = 0.05;
