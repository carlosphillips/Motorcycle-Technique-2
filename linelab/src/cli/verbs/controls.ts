// cli/verbs/controls.ts — the `controls` RENDER VIEW (design/08 §3's `render`
// row: `render <envelope.json> --views topdown,controls,pov`; 00 §5's view
// vocabulary: `topdown`, `controls`, `pov`).
//
// `controls` is a VIEW, never a verb — design/08 §3's verb table is closed and
// contains no `controls` row, so this file is reached through `render` when
// `--views` names it, and `main.ts` routes there. It is sited under `verbs/`
// because that is where the CLI's thin marshalling layer lives; the drawing
// itself is `render/controls.ts` (06 §4), and nothing here computes anything a
// renderer or the engine already computed.
//
// Two seams the strip needs, and where each comes from:
//   · the WINDOW — 06 §4 wants "the diagram window marked as a shaded band",
//     i.e. the span the TOP-DOWN view actually draws. That is exactly
//     `project(road, lines, viewSpec).window` (`DrawnScene.window`, 06 §2.4's
//     resolved auto/explicit crop), so this file asks the projection for it
//     rather than inventing a second window rule.
//   · the CURSOR — the linked cursor's true station. Spelled `--s <m>`, the
//     station flag `cli/args.ts` already parses (design/08 §3 spells the
//     station query that way on `state`); `--at` has no parser in this build's
//     flag table, which this file does not own. Absent `--s`, no cursor is
//     drawn (06 §4: the cursor is optional).
//
// One SVG per LINE (the strip is per focused line, 06 §4 — "at most one
// focused line"), named `<figure_id>.<line_id>.controls.svg`. `--line` selects
// one line; without it every non-refused line gets its own strip (a refusal
// draws nothing — 05 §7/06 §5.1).

import type { ComposedRoad } from "../../road/types.js";
import { isLineRefusal } from "../../solve/envelope.js";
import type { LineEntry, LineResult } from "../../solve/types.js";
import { project } from "../../render/project.js";
import { renderControls, type ControlsWindow } from "../../render/controls.js";
import { EXIT } from "../exit.js";
import { parseZeroFileFlags } from "../args.js";
import { renderVerb } from "./render.js";
import {
  errOutcome,
  okOutcome,
  isObject,
  parseJson,
  recomposeEnvelopeRoad,
  schemaErr,
  type DisclosedRoad,
  type VerbOutcome,
  type WriteFile
} from "./shared.js";

export interface ControlsViewInput {
  readonly loadedText?: string;
  readonly argv: readonly string[];
}

interface RawEnvelope {
  readonly figure_id: string;
  readonly road: DisclosedRoad;
  readonly lines: readonly LineEntry[];
}

/**
 * `render … --views controls[,topdown]`. Emits one controls strip per drawn
 * line; when `--views` also names `topdown`, the topdown half is produced by
 * the `render` verb itself (one renderer, no second code path) and both sets of
 * writes ride the same outcome.
 */
export function controlsView(input: ControlsViewInput): VerbOutcome {
  const parsed = parseZeroFileFlags(input.argv);
  if (!parsed.ok) return errOutcome(parsed.error);
  if (input.loadedText === undefined) {
    return errOutcome(schemaErr("render", "render needs an <envelope.json> argument", "render_input_missing"));
  }
  // `pov` SHIPS in v0.3 (design/07 §5) — naming it beside `controls` composes
  // the two views: the non-controls half (topdown and/or pov) is produced by
  // the `render` verb itself (one renderer, no second code path), exactly as the
  // topdown half already is, so the phase decision for `pov` stays in ONE place.
  const j = parseJson(input.loadedText, "input");
  if (!j.ok) return errOutcome(j.error);
  if (!isObject(j.value) || !Array.isArray(j.value["lines"]) || !isObject(j.value["road"])) {
    return errOutcome(
      schemaErr("input", "render input must be an envelope ({figure_id, road, lines, …})", "render_input_not_envelope")
    );
  }
  const envelope = j.value as unknown as RawEnvelope;

  // A JSON round-trip strips a ComposedRoad's closures — recompose through
  // shared.ts's ONE rule, which threads `bike_margin_m`/`use_full_width` with
  // the disclosed `dsl` (a dsl-only recompose rebuilds a different corridor).
  const recomposed = recomposeEnvelopeRoad(envelope.road);
  if (!recomposed.ok) return errOutcome(recomposed.error);
  const road: ComposedRoad = recomposed.value;

  const drawn = envelope.lines.filter((l): l is LineResult => !isLineRefusal(l));
  if (drawn.length === 0) {
    return errOutcome(
      schemaErr("input", "no drawable line in this envelope — every line is a refusal (05 §7)", "controls_no_drawn_line")
    );
  }

  const requested = parsed.value.line;
  let selected: readonly LineResult[] = drawn;
  if (requested !== undefined) {
    const found = drawn.find((l) => l.line_id === requested);
    if (found === undefined) {
      return errOutcome({
        code: "UNKNOWN_ID",
        at: "--line",
        message: `unknown line "${requested}" (available: ${drawn.map((l) => l.line_id).join(", ")})`,
        detail: { reason: "unknown_line_id", available: drawn.map((l) => l.line_id) }
      });
    }
    selected = [found];
  }

  // the window the TOP-DOWN view resolves (06 §2.4) — the strip shades exactly
  // the span the drawing shows, so the reader can relate the two
  const view: Record<string, string> = { ...(parsed.value.draft.view ?? {}) };
  if (parsed.value.mode !== undefined) view["mode"] = parsed.value.mode;
  const projected = project(road, drawn, Object.keys(view).length > 0 ? view : undefined);
  if (!projected.ok) return errOutcome(projected.error);
  const strip: ControlsWindow = { from: projected.value.window.from_s, to: projected.value.window.to_s };

  const cursor = parsed.value.s;
  const outDir = parsed.value.out ?? ".";
  const writes: WriteFile[] = [];
  const files: string[] = [];
  for (const line of selected) {
    const path = `${outDir}/${envelope.figure_id}.${line.line_id}.controls.svg`;
    writes.push({ path, content: renderControls(line, strip, cursor) });
    files.push(path);
  }

  // Compose with the other render views: `topdown` and/or `pov`, whichever the
  // `--views` set also names, are produced by the `render` verb itself (it reads
  // the same `--views` from argv and honours the requested subset). `controls`
  // alone → no delegation.
  const requestedViews = parsed.value.views ?? [];
  const alsoRender = requestedViews.includes("topdown") || requestedViews.includes("pov");
  if (!alsoRender) {
    return okOutcome(
      {
        figure_id: envelope.figure_id,
        views: ["controls"],
        window: { from_s: strip.from, to_s: strip.to },
        ...(cursor !== undefined ? { cursor_s: cursor } : {}),
        controls: files
      },
      writes,
      EXIT.OK
    );
  }

  const rendered = renderVerb({ loadedText: input.loadedText, argv: input.argv });
  if (typeof rendered.stdout === "object" && rendered.stdout !== null && (rendered.stdout as { ok?: boolean }).ok === false) {
    return rendered;
  }
  const renderedValue = (rendered.stdout as { value: Record<string, unknown> }).value;
  // report the views actually produced, in layout order (topdown, controls, pov)
  const producedViews = [
    ...(requestedViews.includes("topdown") ? ["topdown"] : []),
    "controls",
    ...(requestedViews.includes("pov") ? ["pov"] : [])
  ];
  return okOutcome(
    {
      ...renderedValue,
      views: producedViews,
      window: { from_s: strip.from, to_s: strip.to },
      ...(cursor !== undefined ? { cursor_s: cursor } : {}),
      controls: files
    },
    [...(rendered.writes ?? []), ...writes],
    rendered.exit
  );
}
