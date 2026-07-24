// cli/verbs/state.ts — the `state` verb (design/08 §3, §7.1's A-STATE-VERB
// pattern): resolve `stateAt` on one line of an envelope; stdout is exactly
// one `{ok:true, value: InstantState}` document, byte-equal to calling the
// library `stateAt` directly on the same (StateAtInput, query) pair — this
// file's whole job is marshalling an on-disk envelope into that input, never
// re-deriving anything `stateAt` itself computes.
//
// The road is recomposed through `shared.ts`'s ONE recompose rule
// (`recomposeEnvelopeRoad`) because a JSON round-trip strips `RoadModel`'s
// function members — and because the disclosed `dsl` alone omits
// `bike_margin_m`/`use_full_width`, which would silently rebuild a different
// corridor and make every interpolated `sample.f` wrong. `sightTrendAt` is
// threaded in from sight/analyze.ts (its sole producer, 05 §4) exactly as
// `core/stateAt.ts`'s dependency-inversion banner requires.
import { stateAt } from "../../core/stateAt.js";
import { sightTrendAt } from "../../sight/analyze.js";
import { isLineRefusal } from "../../solve/envelope.js";
import { EXIT } from "../exit.js";
import { parseZeroFileFlags } from "../args.js";
import { errOutcome, okOutcome, isObject, parseJson, recomposeEnvelopeRoad, schemaErr } from "./shared.js";
function lineSelectorRequired(at, ids) {
    return schemaErr(at, `multiple lines in this envelope — pass --line (available: ${ids.join(", ")})`, "line_selector_required", { available: ids });
}
/** design/08 §3.3's universal selector, `state`'s row: default to the sole line. */
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
export function stateVerb(input) {
    const parsed = parseZeroFileFlags(input.argv);
    if (!parsed.ok)
        return errOutcome(parsed.error);
    const j = parseJson(input.loadedText, "input");
    if (!j.ok)
        return errOutcome(j.error);
    if (!isObject(j.value) || !Array.isArray(j.value["lines"])) {
        return errOutcome(schemaErr("input", "state input must be an envelope ({figure_id, road, lines, …})", "state_input_not_envelope"));
    }
    const raw = j.value;
    const selected = selectLine(raw.lines, parsed.value.line);
    if (!selected.ok)
        return errOutcome(selected.error);
    const entry = selected.value;
    if (isLineRefusal(entry)) {
        return errOutcome(schemaErr(`lines[${entry.line_id}]`, `line "${entry.line_id}" is a refusal — no trajectory to query`, "state_line_refused", { line_id: entry.line_id }));
    }
    const line = entry;
    const recomposed = recomposeEnvelopeRoad(raw.road);
    if (!recomposed.ok)
        return errOutcome(recomposed.error);
    const s = parsed.value.s;
    const t = parsed.value.t;
    const query = { ...(s !== undefined ? { s } : {}), ...(t !== undefined ? { t } : {}) };
    const stateInput = {
        trajectory: line.trajectory,
        road: recomposed.value,
        plan: line.resolved_scenario.rider.plan,
        sightTrendAt
    };
    const result = stateAt(stateInput, query);
    if (!result.ok)
        return errOutcome(result.error);
    return okOutcome(result.value, undefined, EXIT.OK);
}
//# sourceMappingURL=state.js.map