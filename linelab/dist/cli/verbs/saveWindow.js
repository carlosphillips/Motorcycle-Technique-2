// cli/verbs/saveWindow.ts — the `save-window` verb (design/08 §3, §7.1's
// A-SAVEWIN-VERB pattern): the reserve-lean save window per ran-wide corner
// (design/04 §4b), byte-equal to calling the library `saveWindow` directly.
// Inspection tier: exits 0/2/4 only (never 3 — analysis is not a gate; the
// library's own error codes never mint NO_SOLUTION, so tier 3 never arises
// here by construction, not by a special case).
import { saveWindow, saveWindowSummary, saveWindowSummaryAll } from "../../solve/saveWindow.js";
import { isLineRefusal } from "../../solve/envelope.js";
import { EXIT } from "../exit.js";
import { parseZeroFileFlags } from "../args.js";
import { errOutcome, okOutcome, isObject, parseJson, schemaErr } from "./shared.js";
function lineSelectorRequired(at, ids) {
    return schemaErr(at, `multiple lines in this envelope — pass --line (available: ${ids.join(", ")})`, "line_selector_required", { available: ids });
}
function selectLine(lines, requested) {
    const ids = lines.map((l) => l.line_id);
    if (requested !== undefined) {
        const found = lines.find((l) => l.line_id === requested);
        if (found === undefined) {
            return {
                ok: false,
                error: { code: "UNKNOWN_ID", at: "--line", message: `unknown line "${requested}" (available: ${ids.join(", ")})`, detail: { reason: "unknown_line_id", available: ids } }
            };
        }
        return { ok: true, value: found };
    }
    if (lines.length === 1)
        return { ok: true, value: lines[0] };
    return { ok: false, error: lineSelectorRequired("--line", ids) };
}
export function saveWindowVerb(input) {
    const parsed = parseZeroFileFlags(input.argv);
    if (!parsed.ok)
        return errOutcome(parsed.error);
    const j = parseJson(input.loadedText, "input");
    if (!j.ok)
        return errOutcome(j.error);
    if (!isObject(j.value) || !Array.isArray(j.value["lines"])) {
        return errOutcome(schemaErr("input", "save-window input must be an envelope ({figure_id, road, lines, …})", "save_window_input_not_envelope"));
    }
    const raw = j.value;
    const selected = selectLine(raw.lines, parsed.value.line);
    if (!selected.ok)
        return errOutcome(selected.error);
    const entry = selected.value;
    if (isLineRefusal(entry)) {
        return errOutcome(schemaErr(`lines[${entry.line_id}]`, `line "${entry.line_id}" is a refusal — no trajectory to probe`, "save_window_line_refused", { line_id: entry.line_id }));
    }
    const line = entry;
    const scanDs = parsed.value.scanDs;
    const opts = scanDs !== undefined ? { scan_ds_m: scanDs } : undefined;
    const lineInput = {
        line_id: line.line_id,
        trajectory: line.trajectory,
        resolved_scenario: line.resolved_scenario,
        verdict: { corners: line.verdict.corners }
    };
    const corner = parsed.value.corner;
    const result = corner !== undefined ? saveWindow(lineInput, corner, opts) : saveWindow(lineInput, undefined, opts);
    if (!result.ok)
        return errOutcome(result.error);
    // design/08 §7.1: "stdout is exactly one JSON document … the human summary
    // goes to stderr, precision-clamped where 04 §4b.5 requires it." The summary
    // is built by solve/saveWindow.ts's own printer, so the §4b.7 placard rides
    // beside every scalar it prints by construction (A-SAVEWIN-PLACARD).
    const summary = Array.isArray(result.value)
        ? saveWindowSummaryAll(result.value)
        : saveWindowSummary(result.value);
    return { ...okOutcome(result.value, undefined, EXIT.OK), stderr: summary + "\n" };
}
//# sourceMappingURL=saveWindow.js.map