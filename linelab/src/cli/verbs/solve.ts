// cli/verbs/solve.ts — the `solve` verb (design/08 §3): the explicit
// authoring door. Wraps the returned `LineResult` into a single-line envelope
// (the same `FigureResult` shape `run` emits) so downstream verbs (`mistake
// --on`, `render`, `export`) consume one uniform document — the `--line`
// selector's "defaults to the sole line" rule (§3.3) then applies uniformly.
// Exit tier: `acceptance.met` false → tier 3 (04 §4.7 — the solve verb's own
// authoring bar; `--accept best_failing` changes WHAT is returned, never the
// tier rule).

import type { SolveInput } from "../../solve/solve.js";
import { suggestTurnIn } from "../../solve/suggest.js";
import { composeSpecRoad } from "../../solve/chained.js";
import { relabelLine, routeSolve } from "../../solve/run.js";
import { buildFigureResult } from "../../solve/envelope.js";
import type { LineResult } from "../../solve/types.js";
import { EXIT } from "../exit.js";
import { parseZeroFileFlags, mergeDraftOverLoaded } from "../args.js";
import { errOutcome, okOutcome, parseJson, schemaErr, type VerbOutcome } from "./shared.js";

export interface SolveVerbInput {
  readonly loadedText?: string;
  readonly argv: readonly string[];
  readonly figureId?: string;
}

export function solveVerb(input: SolveVerbInput): VerbOutcome {
  const parsed = parseZeroFileFlags(input.argv);
  if (!parsed.ok) return errOutcome(parsed.error);
  if (parsed.value.draft.mistakes.length > 0) {
    return errOutcome(
      schemaErr("--mistake", "solve returns one authored line — compile a mistake onto it with the `mistake` verb instead", "solve_mistake_use_mistake_verb")
    );
  }

  let loaded: unknown;
  if (input.loadedText !== undefined) {
    const j = parseJson(input.loadedText, "input");
    if (!j.ok) return errOutcome(j.error);
    loaded = j.value;
  }

  // `line_id` (--line-id, 08 §4.1) is stripped BEFORE the solver so it never
  // rides source.solveSpec (ids live outside every hash); the returned line is
  // renamed by rebuild.
  const { line_id: lineId, ...composedSpec } = mergeDraftOverLoaded(loaded, parsed.value.draft) as unknown as SolveInput & { line_id?: string };
  const composed = composedSpec as SolveInput;
  if (composed.entry_kmh === undefined || composed.road === undefined) {
    return errOutcome(schemaErr("solve", "solve needs a road and an entry speed (--road/--entry or a loaded SolveSpec)", "solve_input_incomplete"));
  }

  const result = parsed.value.suggest ? suggestTurnIn(composed) : routeSolve(composed);
  if (!result.ok) return errOutcome(result.error);
  const line: LineResult = lineId !== undefined ? relabelLine(result.value, lineId) : result.value;

  const roadR = composeSpecRoad(composed.road);
  if (!roadR.ok) return errOutcome(roadR.error);

  const envelope = buildFigureResult({
    figure_id: input.figureId ?? "solve",
    road: roadR.value,
    occluders: line.resolved_scenario.occluders,
    hazards: line.resolved_scenario.hazards,
    lines: [line],
    skew: null
  });

  const exit = line.verdict.acceptance.met ? EXIT.OK : EXIT.DEVIATION;
  const writes = parsed.value.out !== undefined ? [{ path: parsed.value.out, content: JSON.stringify(envelope, null, 2) }] : undefined;
  return okOutcome(envelope, writes, exit);
}
