// cli/verbs/shared.ts — common types + helpers every verb module uses. Pure
// (ARCHITECTURE §2: only cli/main.ts and cli/bless.ts do IO) — verbs never
// touch fs/argv/stdout directly; they take already-loaded text and return a
// `VerbOutcome` main.ts turns into stdout bytes, file writes, and an exit code.
import { compose } from "../../road/compose.js";
import { exitForErrorCode, EXIT } from "../exit.js";
export function okOutcome(value, writes, exit = EXIT.OK) {
    return { stdout: { ok: true, value }, exit, ...(writes !== undefined ? { writes } : {}) };
}
export function errOutcome(error, exitOverride) {
    return { stdout: { ok: false, error }, exit: exitOverride ?? exitForErrorCode(error.code) };
}
export function parseJson(text, at = "input") {
    try {
        return { ok: true, value: JSON.parse(text) };
    }
    catch (e) {
        return {
            ok: false,
            error: {
                code: "SCHEMA",
                at,
                message: `invalid JSON: ${e instanceof Error ? e.message : String(e)}`,
                detail: { reason: "json_parse_error" }
            }
        };
    }
}
export function isObject(v) {
    return typeof v === "object" && v !== null && !Array.isArray(v);
}
/** design/08 §3's content sniff: leading `{` after trimming → JSON; else scene text (D30). */
export function looksLikeJson(text) {
    return text.trimStart().startsWith("{");
}
export function schemaErr(at, message, reason, detail) {
    return { code: "SCHEMA", at, message, detail: { reason, ...detail } };
}
/** THE projection: disclosed road → the wire spec that rebuilds its corridor. */
export function roadWireSpec(road, at = "input.road") {
    const dsl = road?.dsl;
    if (typeof dsl !== "string" || dsl.length === 0) {
        return {
            ok: false,
            error: schemaErr(at, "envelope carries no road.dsl to recompose", "envelope_road_undisclosed")
        };
    }
    return {
        ok: true,
        value: {
            dsl,
            ...(typeof road?.use_full_width === "boolean" ? { use_full_width: road.use_full_width } : {}),
            ...(typeof road?.bike_margin_m === "number" ? { bike_margin_m: road.bike_margin_m } : {})
        }
    };
}
/** THE recompose: the same projection, handed straight to `compose()`. */
export function recomposeEnvelopeRoad(road, at = "input.road") {
    const spec = roadWireSpec(road, at);
    if (!spec.ok)
        return spec;
    return compose(spec.value);
}
//# sourceMappingURL=shared.js.map