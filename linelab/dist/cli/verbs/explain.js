// cli/verbs/explain.ts — the `explain` verb (design/08 §5.2). The IO-bearing
// half of the disambiguation order ("`-` or an existing readable file →
// envelope") lives in main.ts (fs.existsSync is IO); by the time this thin
// verb runs, main.ts has already decided whether `loadedText` (an envelope
// document) or `target` (a bare vocabulary string) applies.
import { explain } from "../doc/explain.js";
import { EXIT } from "../exit.js";
import { parseZeroFileFlags } from "../args.js";
import { errOutcome, okOutcome, parseJson, schemaErr } from "./shared.js";
export function explainVerb(input) {
    const parsed = parseZeroFileFlags(input.argv);
    if (!parsed.ok)
        return errOutcome(parsed.error);
    if (input.loadedText !== undefined) {
        const j = parseJson(input.loadedText, "input");
        if (!j.ok)
            return errOutcome(j.error);
        const result = explain(j.value, {
            ...(parsed.value.line !== undefined ? { line: parsed.value.line } : {}),
            ...(parsed.value.gate ? { gate: {} } : {})
        });
        if (!result.ok)
            return errOutcome(result.error);
        return okOutcome(result.value, undefined, EXIT.OK);
    }
    if (input.target === undefined) {
        return errOutcome(schemaErr("explain", "explain needs an envelope, \"-\", or a checkId/errorCode/mistakeKind target", "explain_target_missing"));
    }
    const result = explain(input.target);
    if (!result.ok)
        return errOutcome(result.error);
    return okOutcome(result.value, undefined, EXIT.OK);
}
//# sourceMappingURL=explain.js.map