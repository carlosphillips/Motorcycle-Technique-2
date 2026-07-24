// cli/verbs/run.ts — the `run` verb (design/08 §3): compose (file, flags, or
// both), simulate every line, emit the result envelope. Thin: the entire
// verb is a marshal onto `run()` (solve/run.js) + `gateFigure()`
// (solve/gate.js) — no business logic lives here (ARCHITECTURE §5, A-STATE-VERB).
import { run } from "../../solve/run.js";
import { expectDeclarationsOf } from "../../solve/run.js";
import { gateFigure } from "../../solve/gate.js";
import { EXIT } from "../exit.js";
import { parseZeroFileFlags, mergeDraftOverLoaded } from "../args.js";
import { errOutcome, okOutcome, parseJson, schemaErr } from "./shared.js";
export function runVerb(input) {
    const parsed = parseZeroFileFlags(input.argv);
    if (!parsed.ok)
        return errOutcome(parsed.error);
    if (parsed.value.draft.mistakes.length > 1) {
        // deviation (recorded): run's zero-file composition supports at most one
        // --mistake; multi-mistake figures are authored via `figure`/scene text.
        return errOutcome(schemaErr("--mistake", "run's zero-file path accepts at most one --mistake in this build — author additional mistake lines via `figure`/scene text", "run_multi_mistake_unsupported"));
    }
    let loaded;
    if (input.loadedText !== undefined) {
        const j = parseJson(input.loadedText, "input");
        if (!j.ok)
            return errOutcome(j.error);
        loaded = j.value;
    }
    const composed = mergeDraftOverLoaded(loaded, parsed.value.draft);
    const opts = { engine_semver: input.engineSemver, ...(input.figureId !== undefined ? { figure_id: input.figureId } : {}) };
    const result = run(composed, opts);
    if (!result.ok)
        return errOutcome(result.error);
    const envelope = result.value;
    let exit = EXIT.OK;
    if (parsed.value.gate) {
        const declared = loaded !== undefined ? expectDeclarationsOf(loaded) : { ok: true, value: {} };
        const report = gateFigure(envelope, declared.ok ? { expect: declared.value } : {});
        if (!report.pass)
            exit = EXIT.DEVIATION;
    }
    const writes = parsed.value.out !== undefined ? [{ path: parsed.value.out, content: JSON.stringify(envelope, null, 2) }] : undefined;
    return okOutcome(envelope, writes, exit);
}
//# sourceMappingURL=run.js.map