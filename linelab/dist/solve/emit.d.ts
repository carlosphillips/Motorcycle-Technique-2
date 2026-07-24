/**
 * The decimal-place bucket for a field name at the emission boundary.
 * Fraction-family keys (exact names above, plus the `*_f` / `f_*` spelling
 * family — target_f, achieved_f, f_min, …) round to 3 dp; `pct` to 1 dp;
 * everything else (metres, km/h, degrees, seconds) to the default 2 dp.
 * Exported so the WP-15 trace-CSV writer applies the SAME policy per column.
 * (ConstraintRow `value`/`worst.*` fields are bound-typed, not key-typed —
 * `roundEmission`'s walk resolves those via F_VALUED_BOUNDS, the same policy.)
 */
export declare function emissionDpFor(key: string): number;
/**
 * Apply the emission-rounding policy to a verdict-shaped tree, returning a NEW
 * (unfrozen) tree — the input, typically deep-frozen, is never mutated.
 * Numbers round per their own key; strings/booleans/null pass through; nested
 * objects and arrays recurse. This is the ONE rounding implementation: the
 * verdict boundary, the hash input (solve/envelope.ts), and the CSV emitter
 * all go through it (directly or via `emissionDpFor`).
 */
export declare function roundEmission<T>(value: T): T;
