// cli/deferred.ts — THE §6.4 deferred-token table (ARCHITECTURE §6.4, D8/D37),
// the single source for both `schema`'s omission of unshipped sections/tokens
// and the `SCHEMA`+`deferred` rejection of those same tokens — checked at the
// VERB level BEFORE flag parsing (ARCHITECTURE §10 pin #19), so a deferred
// verb's message is reachable even behind malformed trailing flags.
//
// Also THE tombstone table for struck/renamed names (never `deferred` —
// ARCHITECTURE §6.4: "Nothing is ever accepted-and-ignored… never deferred").
export const DEFERRED_TABLE = [
    // The `inspection (v0.2)` row is now EMPTY of tokens: `state`, `save-window`,
    // `--standing`, `--scan-ds`, `serve` and `sweep` have all shipped, and the
    // phase-gating law (D8/D37) says a token leaves the table the MOMENT it
    // ships. The row itself is retired rather than kept with an empty token list,
    // because "The printed `schema` is the phase" — a phase with nothing left to
    // defer prints nothing. `DeferredPhase` keeps the string so goldens and
    // tombstone prose that quote it still typecheck.
    { tokens: ["compare", "pov", "--look"], deferred: "immersion (v0.3)" },
    {
        tokens: ["view.mode=diagram", "width_exag", "straight_compress", "taper_compress"],
        deferred: "projection (post-v0.1)"
    },
    {
        tokens: ["commitment", "--commitment", "--prior", "view.fan", "brake_reserve_escape"],
        deferred: "continuation envelope (D45)"
    },
    { tokens: ["--jitter", "--jitter-seed", "--jitter-spread"], deferred: "ensembles (v2)" },
    { tokens: ["fit"], deferred: "fit (post-v1)" }
];
/**
 * The closed set of shipped verbs: the 9 v0.1 verbs (ARCHITECTURE scope line,
 * §8 WP-15 row) plus the four v0.2 inspection verbs — `state`, `save-window`,
 * `serve`, `sweep` (design/08 §3 verb table; the inspection verbs exit 0/2/4
 * only — no exit-3 tier, "inspection is not a gate").
 */
export const SHIPPED_VERBS = [
    "run",
    "solve",
    "mistake",
    "figure",
    "render",
    "check",
    "state",
    "save-window",
    "serve",
    "sweep",
    "schema",
    "explain",
    "export"
];
export function isShippedVerb(v) {
    return SHIPPED_VERBS.includes(v);
}
/** Deferred verbs named in the design of record but not shipped yet. */
export const DEFERRED_VERBS = Object.freeze({
    commitment: "continuation envelope (D45)",
    compare: "immersion (v0.3)",
    fit: "fit (post-v1)"
});
export function deferredFor(token) {
    for (const row of DEFERRED_TABLE) {
        if (row.tokens.includes(token))
            return row.deferred;
    }
    return undefined;
}
export function deferredError(at, token, deferred, schema_ref) {
    return {
        code: "SCHEMA",
        at,
        message: `"${token}" is not shipped in this phase — deferred to ${deferred}`,
        ...(schema_ref !== undefined ? { schema_ref } : {}),
        deferred,
        detail: { reason: "deferred", token }
    };
}
export const TOMBSTONES = [
    {
        name: "out_available",
        reason: "struck_by_decision",
        successor: "annex.reserve_checks",
        message: '"out_available" was struck by decision — see annex.reserve_checks (design/01 §A.6.1)'
    },
    {
        name: "sight_ok",
        reason: "struck_by_decision",
        successor: "stop_within_sight",
        message: '"sight_ok" was struck by decision — see check 10 (stop_within_sight)'
    },
    {
        name: "SIGHT_MARGIN_ROB",
        reason: "struck_by_decision",
        successor: "annex.reserve_checks",
        message: '"SIGHT_MARGIN_ROB" was struck by decision — see annex.reserve_checks (design/01 §A.6.1)'
    },
    {
        name: "--sight-margin-rob",
        reason: "struck_by_decision",
        successor: "annex.reserve_checks",
        message: '"--sight-margin-rob" was struck by decision — see annex.reserve_checks (design/01 §A.6.1)'
    },
    {
        name: "commit_within_sight",
        reason: "struck_by_decision",
        successor: null,
        message: '"commit_within_sight" was struck by decision — no refutation-only check is ever promoted'
    },
    {
        name: "early_apex",
        reason: "renamed_kind",
        successor: "premature",
        message: '"early_apex" was renamed to "premature"'
    },
    {
        name: "sight_vs_stopping",
        reason: "renamed_check",
        successor: "stop_within_sight",
        message: '"sight_vs_stopping" was renamed to "stop_within_sight"'
    }
];
export function tombstoneFor(name) {
    return TOMBSTONES.find((t) => t.name === name);
}
export function tombstoneError(at, row) {
    return {
        code: "UNKNOWN_ID",
        at,
        message: row.message,
        detail: {
            reason: row.reason,
            ...(row.successor !== null ? { renamed_to: row.successor, successor: row.successor } : {})
        }
    };
}
//# sourceMappingURL=deferred.js.map