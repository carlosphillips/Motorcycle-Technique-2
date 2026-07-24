// cli/verbs/mistake.ts — the `mistake` verb (design/08 §3): compile a mistake
// line off an existing solved line, appended to its envelope. Base-line
// selection follows the universal `--line` selector (§3.3): defaults to the
// unique line with role "ideal"; zero or several → `SCHEMA/line_selector_required`.

import { compileMistake } from "../../solve/mistake.js";
import type { SolveInput } from "../../solve/solve.js";
import { buildFigureResult, isLineRefusal } from "../../solve/envelope.js";
import type { FigureResult, LineResult } from "../../solve/types.js";
import { parseMistakeToken } from "../../plan/mistakes.js";
import { EXIT } from "../exit.js";
import { parseZeroFileFlags } from "../args.js";
import { errOutcome, okOutcome, parseJson, schemaErr, type VerbOutcome } from "./shared.js";

export interface MistakeVerbInput {
  /** the loaded `--on` envelope's raw text */
  readonly loadedText?: string;
  readonly argv: readonly string[];
}

function isEnvelope(v: unknown): v is FigureResult {
  return typeof v === "object" && v !== null && Array.isArray((v as Record<string, unknown>)["lines"]);
}

export function mistakeVerb(input: MistakeVerbInput): VerbOutcome {
  const parsed = parseZeroFileFlags(input.argv);
  if (!parsed.ok) return errOutcome(parsed.error);
  const token = parsed.value.positional[0];
  if (token === undefined) {
    return errOutcome(schemaErr("mistake", "mistake needs a <token> positional argument", "mistake_token_missing"));
  }
  if (input.loadedText === undefined) {
    return errOutcome(schemaErr("--on", "mistake needs --on <solved.json>", "mistake_on_missing"));
  }
  const parsedTok = parseMistakeToken(token, "mistake.token");
  if (!parsedTok.ok) return errOutcome(parsedTok.error);

  const j = parseJson(input.loadedText, "--on");
  if (!j.ok) return errOutcome(j.error);
  if (!isEnvelope(j.value)) {
    return errOutcome(schemaErr("--on", "--on must name an envelope (a run/solve/figure result)", "mistake_on_not_envelope"));
  }
  const envelope = j.value;

  const candidates = envelope.lines.filter((l): l is LineResult => !isLineRefusal(l));
  let base: LineResult | undefined;
  if (parsed.value.line !== undefined) {
    base = candidates.find((l) => l.line_id === parsed.value.line);
    if (base === undefined) {
      return errOutcome(
        schemaErr("--line", `no line "${parsed.value.line}" (available: ${candidates.map((l) => l.line_id).join(", ")})`, "line_selector_required")
      );
    }
  } else if (candidates.length === 1) {
    base = candidates[0]!;
  } else {
    const ideals = candidates.filter((l) => l.role === "ideal");
    if (ideals.length === 1) base = ideals[0]!;
    else {
      return errOutcome(
        schemaErr("--line", `ambiguous base line — pass --line (available: ${candidates.map((l) => l.line_id).join(", ")})`, "line_selector_required")
      );
    }
  }
  const baseLine: LineResult = base;

  if (baseLine.source.kind !== "solve") {
    return errOutcome(
      schemaErr("--on", `line "${baseLine.line_id}" was not produced by the solver — a mistake needs a solved base line`, "mistake_base_not_solved")
    );
  }
  const spec = baseLine.source.solveSpec as SolveInput;

  const compiled = compileMistake(parsedTok.value.kind, parsedTok.value.params, {
    base: baseLine,
    spec,
    ...(parsedTok.value.scope !== undefined ? { scope: parsedTok.value.scope } : {}),
    line_id: parsedTok.value.line_id ?? parsedTok.value.kind
  });
  if (!compiled.ok) return errOutcome(compiled.error);

  const newEnvelope = buildFigureResult({
    figure_id: envelope.figure_id,
    road: envelope.road,
    occluders: envelope.occluders,
    hazards: envelope.hazards,
    lines: [...envelope.lines, compiled.value.line],
    skew: envelope.skew,
    meta: envelope.meta
  });

  const writes = parsed.value.out !== undefined ? [{ path: parsed.value.out, content: JSON.stringify(newEnvelope, null, 2) }] : undefined;
  return okOutcome(newEnvelope, writes, EXIT.OK);
}
