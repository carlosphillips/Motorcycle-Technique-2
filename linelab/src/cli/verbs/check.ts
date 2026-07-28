// cli/verbs/check.ts — the `check` verb (design/08 §3): validate only, no
// simulation. Exit 0 valid / 2 invalid, schema_refs on every error. Shares
// the figure verb's content sniff + code path for FigureSpec/scene input
// (shared.ts's `lintFigureSpec`, the ONE lint `figure --check` also calls);
// wire Scenario input goes through plan/validate.ts's `validate()` — the sole
// rejection point (ARCHITECTURE §5). Both arms end in that same `validate()`:
// the figure arm through `validateFigureWorld`, so a road refused at one door
// is refused at the other, at this verb (figures/SCOPE.md §4, S11).
//
// `--standing` (D43, v0.2 inspection): additionally emits the StandingReport
// for each non-refused line under `value.standing[]` (design/08 §3 / §4.1;
// siting law design/05 §7). Grading is a pure verdict lookup — zero engine
// runs, so "no simulation" holds — which is only possible on an input that
// already CARRIES verdicts: a result envelope. On a scenario / FigureSpec /
// scene input no finished line exists, no StandingReport can be emitted, and
// the flag is rejected INEFFECTUAL (the --scan-ds pattern; D8: nothing is
// accepted-and-ignored). Analysis is not a gate: on an envelope, `--standing`
// never changes the exit code (exit 0 whatever the rungs say).

import { validate } from "../../plan/validate.js";
import { validateFigureSpec } from "../../plan/figure.js";
import { lowerScene } from "../../plan/scene.js";
import { standingAttachment, STANDING_GLOSS } from "../../solve/standing.js";
import type { LineEntry } from "../../solve/types.js";
import { EXIT } from "../exit.js";
import { parseZeroFileFlags, mergeDraftOverLoaded } from "../args.js";
import { errOutcome, okOutcome, isObject, lintFigureSpec, looksLikeJson, parseJson, schemaErr, type VerbOutcome } from "./shared.js";
import type { LinelabError } from "../../core/result.js";

export interface CheckVerbInput {
  readonly loadedText: string;
  readonly argv: readonly string[];
}

// ---------------------------------------------------------------------------
// `--standing` input guards (structural sniff BEFORE the cast — disk JSON is
// untrusted; a malformed envelope is a typed SCHEMA rejection, never a throw)

function ineffectualStanding(): LinelabError {
  return {
    code: "INEFFECTUAL",
    at: "--standing",
    message:
      "check --standing grades finished lines, and this input carries no verdicts — pass a result envelope (the output of run/solve/figure)",
    detail: { reason: "standing_without_finished_lines" }
  };
}

function isEnvelopeShaped(v: unknown): v is Record<string, unknown> {
  return isObject(v) && typeof v["figure_id"] === "string" && "road" in v && Array.isArray(v["lines"]);
}

/** Each entry must be a refusal (`ok: false` + error) or carry the verdict members standing() reads. */
function sniffEnvelopeLines(lines: readonly unknown[]): LinelabError | null {
  for (let i = 0; i < lines.length; i++) {
    const at = `lines[${i}]`;
    const entry = lines[i];
    if (!isObject(entry) || typeof entry["line_id"] !== "string") {
      return schemaErr(at, "envelope line must be an object with a line_id", "envelope_line_malformed");
    }
    if (entry["ok"] === false) {
      if (!isObject(entry["error"])) {
        return schemaErr(at, "a refused line must carry its typed error", "envelope_line_malformed");
      }
      continue;
    }
    const verdict = entry["verdict"];
    if (!isObject(verdict)) {
      return schemaErr(`${at}.verdict`, "envelope line carries no verdict", "envelope_line_malformed");
    }
    const doctrine = verdict["doctrine"];
    if (
      typeof verdict["outcome"] !== "string" ||
      typeof verdict["quality"] !== "string" ||
      typeof verdict["rubric"] !== "string" ||
      typeof verdict["checks_version"] !== "number" ||
      !isObject(doctrine) ||
      !Array.isArray(doctrine["checks"])
    ) {
      return schemaErr(
        `${at}.verdict`,
        "envelope verdict must carry outcome, quality, rubric, checks_version, and a doctrine block",
        "envelope_line_malformed"
      );
    }
  }
  return null;
}

function standingOutcome(envelope: Record<string, unknown>): VerbOutcome {
  const lines = envelope["lines"] as readonly unknown[];
  const sniffed = sniffEnvelopeLines(lines);
  if (sniffed !== null) return errOutcome(sniffed);
  const rows = standingAttachment(lines as readonly LineEntry[]);
  if (!rows.ok) return errOutcome(rows.error);
  return okOutcome(
    {
      valid: true,
      figure_id: envelope["figure_id"],
      // the siting of design/08 §3: value.standing[] on check; each row
      // carries its own rubric/checks_version/placard, and the surface prints
      // the rung-token gloss beside them (A-LADDER-PROSE).
      standing: rows.value,
      standing_gloss: STANDING_GLOSS
    },
    undefined,
    EXIT.OK
  );
}

// ---------------------------------------------------------------------------

export function checkVerb(input: CheckVerbInput): VerbOutcome {
  const parsed = parseZeroFileFlags(input.argv);
  if (!parsed.ok) return errOutcome(parsed.error);
  const wantStanding = parsed.value.standing;

  if (!looksLikeJson(input.loadedText)) {
    if (wantStanding) return errOutcome(ineffectualStanding());
    const lowered = lowerScene(input.loadedText);
    if (!lowered.ok) return errOutcome(lowered.error, EXIT.BAD_INPUT);
    return lintFigureSpec(lowered.value);
  }

  const j = parseJson(input.loadedText, "input");
  if (!j.ok) return errOutcome(j.error);
  if (!isObject(j.value)) {
    return errOutcome(schemaErr("input", "check input must be a JSON object", "check_input_not_object"));
  }

  if (wantStanding) {
    if (!isEnvelopeShaped(j.value)) return errOutcome(ineffectualStanding());
    return standingOutcome(j.value);
  }

  if ("lines" in j.value) {
    const fig = validateFigureSpec(j.value);
    if (!fig.ok) return errOutcome(fig.error);
    return lintFigureSpec(fig.value);
  }

  const merged = mergeDraftOverLoaded(j.value, parsed.value.draft);
  const validated = validate(merged);
  if (!validated.ok) return errOutcome(validated.error);
  return okOutcome({ valid: true, id: validated.value.id }, undefined, EXIT.OK);
}
