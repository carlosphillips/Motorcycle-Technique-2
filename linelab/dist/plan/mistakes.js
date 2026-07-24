// plan/mistakes.ts — THE design/03 §7.1 pin table (kinds, params+defaults,
// admissible outcomes, fixture pins, book-figure mapping) as DATA, plus the
// mistake-token grammar parse/print (D32). `compileMistake` itself is WP-12's
// (solve/mistake.ts); this file is the single source `schema mistakes`, the
// oracle (test/oracle/oracle.test.ts), and the gate all read.
//
// Closed kind set (design/03 §7.1, shared vocabulary design/00 §5): the
// execution sub-family `premature | premature_contained | slow_steer |
// fifty_pence | chop | overspeed`, the misjudgment sub-family
// `underread | overread` (design/03 §7.4). `early_apex` is a tombstone
// (D25): `UNKNOWN_ID/renamed_kind` naming `premature`.
import { ok, err } from "../core/result.js";
// ---------------------------------------------------------------------------
// The closed kind set
export const EXECUTION_MISTAKE_KINDS = [
    "premature",
    "premature_contained",
    "slow_steer",
    "fifty_pence",
    "chop",
    "overspeed"
];
export const MISJUDGMENT_MISTAKE_KINDS = ["underread", "overread"];
export const MISTAKE_KINDS = [...EXECUTION_MISTAKE_KINDS, ...MISJUDGMENT_MISTAKE_KINDS];
/** The retired name (D25) — `explain early_apex` prints the rewrite hint. */
export const RETIRED_MISTAKE_NAME = "early_apex";
export const MISTAKE_KIND_DEFS = Object.freeze({
    premature: Object.freeze({
        kind: "premature",
        family: "execution",
        params: Object.freeze([
            Object.freeze({ name: "early_by_m", default: 10, units: "m", note: "how much earlier than the solved turn_in" }),
            Object.freeze({ name: "lean_deg", note: "optional author override of the engine-probed committed lean" })
        ]),
        perturbation: "solved turn_in replaced by one placed early_by_m earlier, target = the committed (largest inside-kissing) lean, derived by engine probe",
        book_mapping: 'fig 8.1\'s red line — "premature turn point": turned in too soon, runs wide'
    }),
    premature_contained: Object.freeze({
        kind: "premature_contained",
        family: "execution",
        params: Object.freeze([Object.freeze({ name: "early_by_m", default: 10, units: "m", note: "same early placement" })]),
        perturbation: "same single replacement, target stays tangent_inside (the solver-eased early entry)",
        book_mapping: "the early turn-in a rider gets away with on street reserve"
    }),
    slow_steer: Object.freeze({
        kind: "slow_steer",
        family: "execution",
        params: Object.freeze([
            Object.freeze({ name: "roll_rate_factor", default: 0.3, note: "compiles to rider.roll_rate_cap_dps = roll_rate_factor · profile rate" })
        ]),
        perturbation: "rider rate cap: rider.roll_rate_cap_dps = roll_rate_factor · profile rate (street 0.3·50 = 15°/s)",
        book_mapping: "fig 8.2 — slow steering"
    }),
    fifty_pence: Object.freeze({
        kind: "fifty_pence",
        family: "execution",
        params: Object.freeze([
            Object.freeze({ name: "early_by_m", default: 10, units: "m", note: "the early first facet" }),
            Object.freeze({ name: "facets", default: 6, note: "early first facet + facets-1 corrections" })
        ]),
        perturbation: "solved turn_in replaced by an early first facet plus facets-1 corrections — still one steering-channel replacement",
        book_mapping: "fig 8.3 — fifty-pencing"
    }),
    chop: Object.freeze({
        kind: "chop",
        family: "execution",
        params: Object.freeze([
            Object.freeze({ name: "offset_m", default: 5, units: "m", note: "station after the solved roll-on" }),
            Object.freeze({ name: "slew_mss", default: 40, units: "m/s^3", note: "chop_slew_mss; authorable" }),
            Object.freeze({ name: "freeze_s", default: 1.0, units: "s", note: "compiles to the throttle action's freeze_steer_s" })
        ]),
        perturbation: "one throttle cut offset_m after the solved roll-on, at chop_slew_mss with freeze_steer_s = freeze_s",
        book_mapping: "Ch.9 throttle doctrine"
    }),
    overspeed: Object.freeze({
        kind: "overspeed",
        family: "execution",
        params: Object.freeze([Object.freeze({ name: "by_kmh", default: 26, units: "km/h", note: "entry speed delta" })]),
        perturbation: "entry + by_kmh, all else byte-identical",
        book_mapping: "fig 8.4 — decreasing radius entered too fast"
    }),
    underread: Object.freeze({
        kind: "underread",
        family: "misjudgment",
        params: Object.freeze([
            Object.freeze({ name: "r_believed", units: "m", note: "exactly one of r_believed | sweep_believed_deg; taper corner defaults to r1" }),
            Object.freeze({ name: "sweep_believed_deg", units: "deg", note: "exactly one of r_believed | sweep_believed_deg" }),
            Object.freeze({ name: "of", note: "target cornerId; default: the figure's teaching corner" })
        ]),
        perturbation: "re-solve on the believed road (target corner rewritten), literalize, execute on the actual road",
        book_mapping: "believed the corner less demanding than it is"
    }),
    overread: Object.freeze({
        kind: "overread",
        family: "misjudgment",
        params: Object.freeze([
            Object.freeze({ name: "r_believed", units: "m", note: "exactly one of r_believed | sweep_believed_deg" }),
            Object.freeze({ name: "sweep_believed_deg", units: "deg", note: "exactly one of r_believed | sweep_believed_deg" }),
            Object.freeze({ name: "of", note: "target cornerId; default: the figure's teaching corner" })
        ]),
        perturbation: "same param surface as underread; believed tighter/longer than actual",
        book_mapping: "believed the corner more demanding than it is — the timid line"
    })
});
export const MISTAKE_PIN_TABLE = Object.freeze([
    Object.freeze({
        kind: "premature",
        admissible_outcomes: Object.freeze(["wide", "runoff"]),
        fixture: "F-ORACLE-90",
        fixture_pin: "runoff",
        book_figure: "fig 8.1",
        teaches: "the outcome IS the lesson"
    }),
    Object.freeze({
        kind: "premature_contained",
        admissible_outcomes: Object.freeze(["contained"]),
        fixture: "F-ORACLE-90",
        fixture_pin: "contained",
        expect_fail: Object.freeze(["late_apex"]),
        book_figure: "fig 8.1 (contained variant)",
        teaches: "out_in_out expected in practice, never a pin"
    }),
    Object.freeze({
        kind: "slow_steer",
        admissible_outcomes: Object.freeze(["wide", "runoff"]),
        fixture: "F-ORACLE-90",
        fixture_pin: "runoff",
        expect_fail: Object.freeze(["quick_steer"]),
        book_figure: "fig 8.2",
        teaches: "slow steering"
    }),
    Object.freeze({
        kind: "fifty_pence",
        admissible_outcomes: Object.freeze(["wide", "runoff"]),
        fixture: "F-ORACLE-90",
        fixture_pin: "wide",
        expect_fail: Object.freeze(["single_input"]),
        book_figure: "fig 8.3",
        teaches: "fifty-pencing"
    }),
    Object.freeze({
        kind: "chop",
        admissible_outcomes: Object.freeze(["wide", "runoff"]),
        fixture: "F-ORACLE-90",
        fixture_pin: "runoff",
        expect_fail: Object.freeze(["throttle_rule"]),
        book_figure: "Ch.9 throttle doctrine",
        teaches: "the panicked-rider half of the mistake"
    }),
    Object.freeze({
        kind: "overspeed",
        admissible_outcomes: Object.freeze(["wide", "runoff", "crash"]),
        fixture: "F-ORACLE-DR",
        fixture_pin: "runoff",
        book_figure: "fig 8.4",
        teaches: "decreasing radius entered too fast"
    }),
    Object.freeze({
        kind: "underread",
        admissible_outcomes: Object.freeze(["wide", "runoff"]),
        fixture: "F-ORACLE-DR",
        fixture_pin: "runoff",
        book_figure: "fig 8.4/8.5 blind-DR misread",
        teaches: "believed the corner less demanding than it is"
    }),
    Object.freeze({
        kind: "overread",
        admissible_outcomes: Object.freeze(["contained"]),
        fixture: "F-ORACLE-90",
        fixture_pin: "contained",
        expect_fail: "applicable_check_fails",
        book_figure: "the over-cautious line",
        teaches: "the over-cautious evidence; quality caution"
    }),
    Object.freeze({
        kind: "premature",
        scope: "all_corners",
        admissible_outcomes: Object.freeze(["wide", "runoff"]),
        fixture: "F-ORACLE-CHAIN",
        fixture_pin: "runoff",
        fixture_pin_note: "at the final corner",
        book_figure: "fig 8.6",
        teaches: "per-corner compounding metric: slot reserved"
    })
]);
function schemaErr(at, message, reason, detail) {
    return { code: "SCHEMA", at, message, detail: { reason, ...detail } };
}
function printCompactToken(kind, params, scope) {
    let s = kind;
    if (params !== undefined && Object.keys(params).length > 0) {
        s += ":" + Object.entries(params).map(([k, v]) => `${k}=${v}`).join(",");
    }
    if (scope !== undefined)
        s += `@${scope}`;
    return s;
}
// ---------------------------------------------------------------------------
// Token grammar (D32) — verbatim across the CLI verb, `--mistake`, and scene text:
//
//   mistake-token := [<line_id> "="] <kind> [":" params] ["@" scope]
//   params        := <key> "=" <value> ("," <key> "=" <value>)*
//   scope         := <cornerId> ("," <cornerId>)* | "all"
const TOKEN_RE = /^(?:([A-Za-z_][A-Za-z0-9_]*)=)?([A-Za-z_]+)(?::([^@]+))?(?:@(.+))?$/;
/**
 * Parse the legacy space-separated `key=val … scope=…` scene spelling into the
 * equivalent compact token, for the rewrite-hint message only (D8 — nothing
 * deprecated is silently accepted). Best-effort: `<kind> k=v k=v ... [scope=...]`.
 */
function rewriteLegacySpelling(token) {
    const parts = token.trim().split(/\s+/).filter((t) => t.length > 0);
    const kind = parts[0];
    if (kind === undefined)
        return undefined;
    const kv = [];
    let scope;
    for (const part of parts.slice(1)) {
        const m = /^([a-zA-Z_]+)=(.+)$/.exec(part);
        if (!m)
            return undefined;
        if (m[1] === "scope")
            scope = m[2];
        else
            kv.push(`${m[1]}=${m[2]}`);
    }
    return printCompactToken(kind, kv.length > 0 ? Object.fromEntries(kv.map((p) => p.split("="))) : undefined, scope);
}
/**
 * `parseMistakeToken(token) → Result<ResolvedMistakeSpec>` (values still raw
 * strings — numeric coercion is compileMistake's job, WP-12, since param
 * meaning is per-kind).
 */
export function parseMistakeToken(token, at) {
    if (/\s/.test(token)) {
        const rewrite = rewriteLegacySpelling(token);
        return err(schemaErr(at, `the legacy space-separated mistake spelling is rejected` + (rewrite !== undefined ? ` — use "${rewrite}"` : ""), "mistake_token_legacy_spelling", rewrite !== undefined ? { rewrite } : undefined));
    }
    const m = TOKEN_RE.exec(token);
    if (m === null) {
        return err(schemaErr(at, `malformed mistake token "${token}"`, "mistake_token_malformed"));
    }
    const [, line_id, kind, paramsStr, scopeStr] = m;
    if (kind === RETIRED_MISTAKE_NAME) {
        return err({
            code: "UNKNOWN_ID",
            at,
            message: `"${RETIRED_MISTAKE_NAME}" was renamed to "premature"`,
            detail: { reason: "renamed_kind", renamed_to: "premature" }
        });
    }
    if (kind === undefined || !MISTAKE_KINDS.includes(kind)) {
        return err({
            code: "UNKNOWN_ID",
            at,
            message: `unknown mistake kind "${String(kind)}" (known: ${MISTAKE_KINDS.join(", ")})`,
            detail: { reason: "unknown_mistake_kind" }
        });
    }
    let params;
    if (paramsStr !== undefined) {
        params = {};
        for (const pair of paramsStr.split(",")) {
            const eq = pair.indexOf("=");
            if (eq <= 0) {
                return err(schemaErr(at, `malformed mistake param "${pair}"`, "mistake_token_malformed"));
            }
            params[pair.slice(0, eq)] = pair.slice(eq + 1);
        }
    }
    let scope;
    if (scopeStr !== undefined) {
        scope = scopeStr === "all" ? "all_corners" : scopeStr.split(",");
    }
    return ok({
        ...(line_id !== undefined ? { line_id } : {}),
        kind: kind,
        ...(params !== undefined ? { params } : {}),
        ...(scope !== undefined ? { scope } : {})
    });
}
/** `printMistakeToken(spec) → string` — the inverse of parseMistakeToken (token ↔ JSON bijection, D32). */
export function printMistakeToken(spec) {
    const scopeStr = spec.scope === undefined ? undefined : spec.scope === "all_corners" ? "all" : spec.scope.join(",");
    const body = printCompactToken(spec.kind, spec.params, scopeStr);
    return spec.line_id !== undefined ? `${spec.line_id}=${body}` : body;
}
//# sourceMappingURL=mistakes.js.map