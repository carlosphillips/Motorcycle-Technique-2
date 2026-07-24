// sight/constants.ts — the design/03 §5-owned sight constants (ARCHITECTURE §6.6:
// one constants.ts per owning module; cross-module use IMPORTS, never re-declares).
// Values copied VERBATIM from design/03 §5; TUNING marks carried exactly as the doc
// gives them. Constants marked TUNING have no book source.
// ---------------------------------------------------------------------------
// §5.1 — limit-point trend (the trend itself is derived downstream over the
// recorded per-sample sight_m series, owned by design/05 §4; the constants are
// declared here because 03 §5.1 owns their values)
/** 5.0 m — TUNING. Trend derivation window over the recorded sight_m series (design/03 §5.1). */
export const SIGHT_TREND_WINDOW_M = 5.0;
/** 2.0 m — TUNING. Trend deadband: |Δsight| below this reads `steady` (design/03 §5.1). */
export const SIGHT_TREND_DEADBAND_M = 2.0;
/**
 * design/03 §5.2, verbatim: `alert {a_ssd: 7.0 m/s², t_react_s: 1.0}` (default,
 * TUNING) and `aashto {a_ssd: 3.4, t_react_s: 2.5}` (the conservative
 * highway-engineering yardstick). Keyed by the closed SsdModel set (core/types.ts).
 */
export const SSD_MODEL_TABLE = Object.freeze({
    alert: Object.freeze({ a_ssd: 7.0, t_react_s: 1.0 }),
    aashto: Object.freeze({ a_ssd: 3.4, t_react_s: 2.5 })
});
// ---------------------------------------------------------------------------
// Footprint sampling fidelity — an unnamed design literal given a local name
// without TUNING status (ARCHITECTURE §6.6 pattern, like SUGGEST_TOPN)
/**
 * 0.25 m — station step at which band-occluder faces are sampled into footprint
 * polylines. Chord sag at this step on the tightest preset band face (~7 m
 * radius) is under 2 mm — well inside the sight-cast grid resolution.
 */
export const FOOTPRINT_STEP_M = 0.25;
//# sourceMappingURL=constants.js.map