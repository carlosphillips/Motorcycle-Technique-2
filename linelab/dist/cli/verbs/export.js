// cli/verbs/export.ts — the `export` verb (design/08 §3, D31): shareable
// artifacts off an envelope — the canonical envelope/figure-spec/scenario
// JSON, the per-metre trace CSV (SAMPLE_FIELDS column order,
// `<figure_id>.<line_id>.csv` naming), the rendered SVG, and a share-url
// fragment. `--as` is required and closed.
import { SAMPLE_FIELDS } from "../../core/types.js";
import { isLineRefusal } from "../../solve/envelope.js";
import { renderViews } from "../../render/index.js";
import { canonicalize } from "../../core/hash.js";
import { EXIT } from "../exit.js";
import { parseZeroFileFlags } from "../args.js";
import { errOutcome, okOutcome, isObject, parseJson, recomposeEnvelopeRoad, schemaErr } from "./shared.js";
const EXPORT_AS = ["share-url", "trace-csv", "svg", "envelope", "scenario", "figure-spec"];
function csvOf(line) {
    const header = SAMPLE_FIELDS.join(",");
    const rows = line.trajectory.samples.map((s) => SAMPLE_FIELDS.map((f) => {
        const v = s[f];
        if (v === null || v === undefined)
            return "";
        if (typeof v === "number")
            return Number.isFinite(v) ? String(v) : "";
        if (typeof v === "boolean")
            return v ? "true" : "false";
        return String(v);
    }).join(","));
    return [header, ...rows].join("\n");
}
function selectLines(lines, lineId, all) {
    if (all)
        return { ok: true, value: lines };
    if (lineId !== undefined) {
        const found = lines.find((l) => l.line_id === lineId);
        if (found === undefined) {
            return { ok: false, error: schemaErr("--line", `no line "${lineId}" (available: ${lines.map((l) => l.line_id).join(", ")})`, "line_selector_required") };
        }
        return { ok: true, value: [found] };
    }
    if (lines.length === 1)
        return { ok: true, value: lines };
    return { ok: false, error: schemaErr("--line", `ambiguous line — pass --line or --all (available: ${lines.map((l) => l.line_id).join(", ")})`, "line_selector_required") };
}
function figureSpecFromEnvelope(envelope) {
    const linesRaw = envelope["lines"] ?? [];
    const lines = linesRaw
        .filter((l) => !isLineRefusal(l))
        .map((l) => {
        const source = l.source;
        const spec = source.kind === "solve"
            ? source.solveSpec
            : source.kind === "mistake"
                ? { kind: source.mistakeSpec.kind, ...(source.mistakeSpec.params !== undefined ? { params: source.mistakeSpec.params } : {}), ...(source.mistakeSpec.scope !== undefined ? { scope: source.mistakeSpec.scope } : {}) }
                : source.kind === "scenario"
                    ? source.scenario
                    : { kind: "underread" }; // misjudge sugar fallback (best-effort projection)
        return { name: l.line_id, role: l.role, spec };
    });
    return {
        road: envelope["road"]?.dsl !== undefined ? { dsl: envelope["road"].dsl } : envelope["road"],
        lines
    };
}
export function exportVerb(input) {
    const parsed = parseZeroFileFlags(input.argv);
    if (!parsed.ok)
        return errOutcome(parsed.error);
    const as = parsed.value.as;
    if (as === undefined || !EXPORT_AS.includes(as)) {
        return errOutcome(schemaErr("--as", `--as must be one of ${EXPORT_AS.join(", ")}`, "export_as_unknown"));
    }
    const j = parseJson(input.loadedText, "input");
    if (!j.ok)
        return errOutcome(j.error);
    if (!isObject(j.value) || !Array.isArray(j.value["lines"])) {
        return errOutcome(schemaErr("input", "export input must be an envelope ({figure_id, road, lines, …})", "export_input_not_envelope"));
    }
    const envelope = j.value;
    const figureId = typeof envelope["figure_id"] === "string" ? envelope["figure_id"] : "figure";
    const allLines = envelope["lines"].filter((l) => !isLineRefusal(l));
    const asTyped = as;
    if (asTyped === "envelope") {
        return okOutcome(envelope, undefined, EXIT.OK);
    }
    if (asTyped === "figure-spec") {
        const fig = figureSpecFromEnvelope(envelope);
        return okOutcome(fig, undefined, EXIT.OK);
    }
    if (asTyped === "scenario") {
        const sel = selectLines(allLines, parsed.value.line, false);
        if (!sel.ok)
            return errOutcome(sel.error);
        const line = sel.value[0];
        // the wire `road` union takes exactly one of segments|preset|dsl (03 §2.1);
        // `resolved_scenario.road` (ValidatedRoadSpec) always carries BOTH segments
        // AND dsl together — re-emit the disclosed `dsl` alone so the re-run is a
        // valid wire document (09's re-run pin, A-RESOLVED-RERUN).
        const rs = line.resolved_scenario;
        return okOutcome({
            ...rs,
            spec: "linelab/1",
            id: line.line_id,
            road: { dsl: rs.road.dsl, use_full_width: rs.road.use_full_width, bike_margin_m: rs.road.bike_margin_m }
        }, undefined, EXIT.OK);
    }
    if (asTyped === "trace-csv") {
        const sel = selectLines(allLines, parsed.value.line, parsed.value.all);
        if (!sel.ok)
            return errOutcome(sel.error);
        const writes = sel.value.map((l) => ({
            path: (parsed.value.out ?? ".") + `/${figureId}.${l.line_id}.csv`,
            content: csvOf(l)
        }));
        return okOutcome({ written: writes.map((w) => w.path) }, writes, EXIT.OK);
    }
    if (asTyped === "svg") {
        if (parsed.value.out === undefined) {
            return errOutcome(schemaErr("--out", "--as svg needs --out <dir>", "export_svg_needs_out"));
        }
        // recompose through shared.ts's ONE rule — a JSON round-trip strips a
        // ComposedRoad's function members, and the disclosed `dsl` alone omits
        // `bike_margin_m`/`use_full_width` (see render.ts's identical note).
        const recomposed = recomposeEnvelopeRoad(envelope["road"]);
        if (!recomposed.ok)
            return errOutcome(recomposed.error);
        const rendered = renderViews({ road: recomposed.value, lines: allLines });
        if (!rendered.ok)
            return errOutcome(rendered.error);
        const path = `${parsed.value.out}/${figureId}.svg`;
        return okOutcome({ written: [path] }, [{ path, content: rendered.value.svg }], EXIT.OK);
    }
    // share-url (D31/D6): `#f=<base64 canonical FigureSpec>` — full line set, stamped
    const fig = figureSpecFromEnvelope(envelope);
    const stamped = { ...fig, engine_semver: input.engineSemver };
    const canon = canonicalize(stamped);
    const b64 = base64Utf8(canon.ok ? canon.value : JSON.stringify(stamped));
    return okOutcome({ url: `#f=${b64}` }, undefined, EXIT.OK);
}
// ---------------------------------------------------------------------------
// base64 of a UTF-8 string, by hand.
//
// `Buffer` is a NODE global, and ARCHITECTURE §2 confines runtime globals to
// `cli/main.ts` and `cli/bless.ts`; every other file in `src/` — this one
// included — must be pure and platform-free, because the same emitted module
// graph is what the browser loads (D1). The encoder below is byte-identical to
// `Buffer.from(s, "utf8").toString("base64")` and runs anywhere.
//
// DECLARED GAP: design/05 §8.1 specifies `deflateRaw` + base64url for the share
// string. This build emits PLAIN base64 of the canonical FigureSpec with no
// compression — the share door's decoder (07 §6.2 door 2) is not shipped, so
// nothing consumes the encoding yet and settling it is a prerequisite of that
// door, not of this verb. Recorded in DEVIATIONS.md.
const B64_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
/** UTF-8 bytes of a JS string (surrogate pairs folded into 4-byte sequences). */
function utf8Bytes(s) {
    const out = [];
    for (let i = 0; i < s.length; i++) {
        let cp = s.charCodeAt(i);
        if (cp >= 0xd800 && cp <= 0xdbff && i + 1 < s.length) {
            const lo = s.charCodeAt(i + 1);
            if (lo >= 0xdc00 && lo <= 0xdfff) {
                cp = 0x10000 + ((cp - 0xd800) << 10) + (lo - 0xdc00);
                i++;
            }
        }
        if (cp < 0x80)
            out.push(cp);
        else if (cp < 0x800)
            out.push(0xc0 | (cp >> 6), 0x80 | (cp & 0x3f));
        else if (cp < 0x10000)
            out.push(0xe0 | (cp >> 12), 0x80 | ((cp >> 6) & 0x3f), 0x80 | (cp & 0x3f));
        else
            out.push(0xf0 | (cp >> 18), 0x80 | ((cp >> 12) & 0x3f), 0x80 | ((cp >> 6) & 0x3f), 0x80 | (cp & 0x3f));
    }
    return out;
}
export function base64Utf8(s) {
    const bytes = utf8Bytes(s);
    let out = "";
    for (let i = 0; i < bytes.length; i += 3) {
        const b0 = bytes[i];
        const b1 = bytes[i + 1];
        const b2 = bytes[i + 2];
        out += B64_ALPHABET[b0 >> 2];
        out += B64_ALPHABET[((b0 & 0x03) << 4) | ((b1 ?? 0) >> 4)];
        out += b1 === undefined ? "=" : B64_ALPHABET[((b1 & 0x0f) << 2) | ((b2 ?? 0) >> 6)];
        out += b2 === undefined ? "=" : B64_ALPHABET[b2 & 0x3f];
    }
    return out;
}
//# sourceMappingURL=export.js.map