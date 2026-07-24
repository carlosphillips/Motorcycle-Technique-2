/** 1.15 (ratio) — TUNING. Taper with r1/r2 ≥ this → decreasing; r2/r1 ≥ this → increasing; else constant. */
export declare const TAPER_RATIO_MIN = 1.15;
/** 1.0 (fraction) — TUNING. linked_next ⇔ gap_to_next_m ≤ LINK_GAP_FRAC · min(L_arc(n), L_arc(n+1)). */
export declare const LINK_GAP_FRAC = 1;
/** 15 m — local-radius threshold of the U-turn regime. */
export declare const R_UTURN_MAX = 15;
/** 170 ° — a corner is refused OUT_OF_SCOPE (super_tight_geometry) iff ≥ this much sweep accumulates at r ≤ R_UTURN_MAX. Per corner, never per road (D21). */
export declare const SWEEP_UTURN_MIN = 170;
/** 6 m — preset TUNING. bookEsses' `S 6` links: the hand-flip budget at chain speeds. */
export declare const LINK_GAP_M = 6;
/** design/03 §4 band-occluder defaults, per kind: band runs from `margin_m` outside the physical road edge, extending `depth_m` further out. */
export declare const OCCLUDER_BAND_DEFAULTS: Readonly<{
    readonly hedge: Readonly<{
        margin_m: 1;
        depth_m: 2;
    }>;
    readonly wall: Readonly<{
        margin_m: 0.5;
        depth_m: 0.3;
    }>;
    readonly bank: Readonly<{
        margin_m: 0;
        depth_m: 3;
    }>;
}>;
/** design/03 §4 vehicle rectangle defaults (len × width), both overridable; `verge_margin_m` is the side-form default margin. */
export declare const VEHICLE_DEFAULTS: Readonly<{
    readonly len_m: 4.5;
    readonly width_m: 1.8;
    readonly verge_margin_m: 0.5;
}>;
/** design/03 §4.2 gravel hazard defaults: μ-override band `width_m` wide; `mu > 0` else BAD_RANGE. */
export declare const GRAVEL_DEFAULTS: Readonly<{
    readonly width_m: 1.4;
    readonly mu: 0.4;
}>;
/** 0.05 m — TUNING. truncateAt drops split fragments shorter than this. */
export declare const MIN_SEG_M = 0.05;
