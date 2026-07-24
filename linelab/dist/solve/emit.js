// solve/emit.ts — THE centralized emission-rounding policy (design/05 §8.3;
// ARCHITECTURE §6.3, drift risk #2). ONE function, applied to the verdict at
// the emission boundary AND (crucially) BEFORE hashing: `result_hash` is
// computed over the rounded canonical verdict, so a rounding-policy change
// moves hashes and is a deliberate re-bless event — exactly as 05 §8.3
// requires. Golden fixtures tap raw f64 BEFORE this function, at bless only.
//
// The policy, verbatim from design/05 §8.3:
//   - metres / km/h / degrees (and every other plain quantity): 2 dp
//   - fractions (grip, `f`, `n_*`): 3 dp
//   - apex `pct`: 1 dp
// via `Number(x.toFixed(dp))`, with `-0` normalized to `0`. It is applied ONLY
// at the verdict/CSV boundary — never inside the frozen Sample record.
//
// Rounding is IDEMPOTENT (Number(x.toFixed(dp)) is a fixpoint), so sealing an
// already-rounded verdict is safe by construction.
/**
 * Verdict keys whose values are lane fractions / dimensionless ratios → 3 dp.
 * `max_abs_1pm` (1/m curvature, misjudgment.kappa_gap) is deliberately NOT
 * here: 05 §8.3's letter names only fractions (grip, `f`, `n_*`) at 3 dp and
 * everything else at 2 dp, so it takes the 2-dp default. PENDING RATIFICATION:
 * at 2 dp the in-scope κ-gap range 0.01–0.07 1/m collapses to one significant
 * digit — 05 §8.3 should grow a high-resolution curvature bucket; until the
 * design of record says so, the letter is implemented.
 */
const FRACTION_KEYS = new Set([
    "f",
    "grip",
    "grip_min",
    "n_long",
    "n_lat"
]);
/** Apex `pct` → 1 dp (design/05 §8.3). */
const PCT_KEYS = new Set(["pct"]);
/**
 * ConstraintRow bounds whose `value` / `worst.value` / `worst.margin` are lane
 * fractions (05 §6.3 constraints[]; the bound set is 04 §4.5's closed four).
 * §8.3 assigns fractions 3 dp BY TYPE, not by key spelling — a `value` under
 * an `f_min`/`f_max` row is an `f`, while the same key under `v_max_kmh` /
 * `sight_margin_min_m` is km/h / metres and keeps the 2-dp default.
 */
const F_VALUED_BOUNDS = new Set(["f_min", "f_max"]);
/** The keys of a ConstraintRow (and its `worst`) that carry the bound's quantity. */
const BOUND_VALUED_KEYS = new Set(["value", "margin"]);
/**
 * The decimal-place bucket for a field name at the emission boundary.
 * Fraction-family keys (exact names above, plus the `*_f` / `f_*` spelling
 * family — target_f, achieved_f, f_min, …) round to 3 dp; `pct` to 1 dp;
 * everything else (metres, km/h, degrees, seconds) to the default 2 dp.
 * Exported so the WP-15 trace-CSV writer applies the SAME policy per column.
 * (ConstraintRow `value`/`worst.*` fields are bound-typed, not key-typed —
 * `roundEmission`'s walk resolves those via F_VALUED_BOUNDS, the same policy.)
 */
export function emissionDpFor(key) {
    if (PCT_KEYS.has(key))
        return 1;
    if (FRACTION_KEYS.has(key) || key.endsWith("_f") || key.startsWith("f_"))
        return 3;
    return 2;
}
function roundScalar(x, dp) {
    const r = Number(x.toFixed(dp));
    return Object.is(r, -0) ? 0 : r;
}
/**
 * `fValued` is true inside a ConstraintRow whose bound is f-flavoured (and its
 * nested `worst`): there, `value`/`margin` round as fractions (3 dp) while
 * every other key — `worst.s` is metres — keeps its own bucket.
 */
function walk(value, key, fValued) {
    if (typeof value === "number") {
        const dp = fValued && BOUND_VALUED_KEYS.has(key) ? 3 : emissionDpFor(key);
        return roundScalar(value, dp);
    }
    if (value === null || typeof value !== "object")
        return value;
    if (Array.isArray(value)) {
        // array elements inherit the array's own key (corners[], apexes[], …)
        return value.map((item) => walk(item, key, fValued));
    }
    const obj = value;
    const bound = obj["bound"];
    const rowFValued = fValued || (typeof bound === "string" && F_VALUED_BOUNDS.has(bound));
    const out = {};
    for (const k of Object.keys(obj)) {
        out[k] = walk(obj[k], k, rowFValued);
    }
    return out;
}
/**
 * Apply the emission-rounding policy to a verdict-shaped tree, returning a NEW
 * (unfrozen) tree — the input, typically deep-frozen, is never mutated.
 * Numbers round per their own key; strings/booleans/null pass through; nested
 * objects and arrays recurse. This is the ONE rounding implementation: the
 * verdict boundary, the hash input (solve/envelope.ts), and the CSV emitter
 * all go through it (directly or via `emissionDpFor`).
 */
export function roundEmission(value) {
    return walk(value, "", false);
}
//# sourceMappingURL=emit.js.map