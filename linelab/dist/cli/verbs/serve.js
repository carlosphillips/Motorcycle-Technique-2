// cli/verbs/serve.ts — the `serve` verb (design/08 §3):
//   `serve <scenario|scene|figure.json|envelope> [--port N]`
//   "Launch the viewer (07) with the payload preloaded; print the URL; run
//    until closed."
//
// WHERE THE IO IS. ARCHITECTURE §2 is unambiguous: "IO (fs/process/env/argv)
// is legal ONLY in src/cli/main.ts and src/cli/bless.ts. Every other file in
// src/ (including the rest of cli/) is pure and synchronous over frozen
// inputs" — and `test/meta/imports.test.ts` enforces exactly that, exempting
// those two files and no others. So this file opens no socket and reads no
// file. It computes a `ServePlan`: the port, the URL, the inline documents,
// and the directory the compiled ES modules are served from. `main.ts` — the
// IO shell — turns that plan into a listening server. One law, no exception
// carved for this verb.
//
// WHAT IS SERVED (07 §2.1's recompute-in-viewer rule):
//   `/`             the workstation page, with the payload preloaded inline
//   `/payload.json` the SPEC — scenario + line specs, never a trajectory
//   `<moduleRoot>/…` the compiled ES module graph, read-only, from `dist/`
// The page issues no request to any other origin; nothing here reaches out to
// the network. An envelope argument is projected back to its FigureSpec (D6:
// "envelopes are stripped to their FigureSpec and recomputed") by the ONE
// projection that already exists — `export --as figure-spec` — rather than by
// a second copy of that rule.
import { lowerScene } from "../../plan/scene.js";
import { viewerPageHtml } from "../../viewer/page.js";
import { parseZeroFileFlags } from "../args.js";
import { EXIT } from "../exit.js";
import { exportVerb } from "./export.js";
import { errOutcome, isObject, looksLikeJson, okOutcome, parseJson, schemaErr } from "./shared.js";
/**
 * design/08 §3 pins the flag (`--port N`) but not a default. Named locally
 * without TUNING status, per ARCHITECTURE §6.6's rule for unnamed design
 * literals.
 */
export const SERVE_DEFAULT_PORT = 4173;
/** The URL prefix the compiled module graph is mounted under (see the banner). */
export const SERVE_MODULE_ROOT = "/m";
/** An envelope carries computed lines; a FigureSpec's lines carry only `spec`. */
function looksLikeEnvelope(json) {
    const lines = json["lines"];
    if (!Array.isArray(lines))
        return false;
    return lines.some((l) => isObject(l) && ("trajectory" in l || "verdict" in l || "ok" in l));
}
const DEFAULT_TITLE = "linelab";
function normalizeToSpec(loadedText, engineSemver) {
    if (!looksLikeJson(loadedText)) {
        const lowered = lowerScene(loadedText);
        if (!lowered.ok)
            return { ok: false, outcome: errOutcome(lowered.error) };
        return { ok: true, value: { spec: lowered.value, kind: "scene", title: DEFAULT_TITLE } };
    }
    const j = parseJson(loadedText, "input");
    if (!j.ok)
        return { ok: false, outcome: errOutcome(j.error) };
    if (!isObject(j.value)) {
        return { ok: false, outcome: errOutcome(schemaErr("input", "serve input must be a JSON object or scene text", "serve_input_not_object")) };
    }
    const json = j.value;
    if (!looksLikeEnvelope(json)) {
        // a wire Scenario carries `id`; a FigureSpec carries neither id nor title
        const id = json["id"];
        return { ok: true, value: { spec: json, kind: "spec", title: typeof id === "string" ? id : DEFAULT_TITLE } };
    }
    // D6 / design/08 §3's `compare` rule, reused: strip the envelope to its
    // FigureSpec and let the viewer recompute. `export --as figure-spec` owns
    // that projection ("the envelope minus computed members, a pure
    // projection"); calling it here keeps exactly one implementation of it.
    const projected = exportVerb({ loadedText, argv: ["--as", "figure-spec"], engineSemver });
    const doc = projected.stdout;
    if (doc.ok !== true)
        return { ok: false, outcome: projected };
    const figureId = json["figure_id"];
    return {
        ok: true,
        value: { spec: doc.value, kind: "envelope", title: typeof figureId === "string" ? figureId : DEFAULT_TITLE }
    };
}
/**
 * `serve` — build the plan and the one stdout document (08 §3.2: stdout is
 * exactly one JSON document per invocation; the URL rides its `value`, which
 * is what "print the URL" means for an agent-parseable CLI).
 */
export function serveVerb(input) {
    const parsed = parseZeroFileFlags(input.argv);
    if (!parsed.ok)
        return { outcome: errOutcome(parsed.error), plan: null };
    const port = parsed.value.port ?? SERVE_DEFAULT_PORT;
    if (!Number.isInteger(port) || port < 0 || port > 65535) {
        return {
            outcome: errOutcome({
                code: "BAD_RANGE",
                at: "--port",
                message: `--port must be an integer in [0, 65535], got ${port}`,
                detail: { reason: "port_out_of_range", port }
            }),
            plan: null
        };
    }
    const normalized = normalizeToSpec(input.loadedText, input.engineSemver);
    if (!normalized.ok)
        return { outcome: normalized.outcome, plan: null };
    const payloadJson = JSON.stringify(normalized.value.spec);
    const title = normalized.value.title;
    const url = `http://127.0.0.1:${port}/`;
    const documents = Object.freeze([
        Object.freeze({
            path: "/",
            contentType: "text/html; charset=utf-8",
            body: viewerPageHtml({
                moduleRoot: SERVE_MODULE_ROOT,
                payloadJson,
                title,
                engineSemver: input.engineSemver
            })
        }),
        Object.freeze({ path: "/payload.json", contentType: "application/json; charset=utf-8", body: payloadJson })
    ]);
    return {
        outcome: okOutcome({
            url,
            port,
            source: normalized.value.kind,
            figure_id: title,
            views: ["topdown", "controls"],
            routes: documents.map((d) => d.path).concat(`${SERVE_MODULE_ROOT}/*`)
        }, undefined, EXIT.OK),
        plan: Object.freeze({ port, url, documents, moduleRoot: SERVE_MODULE_ROOT })
    };
}
//# sourceMappingURL=serve.js.map