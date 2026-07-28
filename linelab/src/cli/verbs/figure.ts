// cli/verbs/figure.ts — the `figure` verb (design/08 §3, D30): bake a figure
// from either spelling (scene text or FigureSpec JSON, sniffed by content —
// leading `{` → JSON, never by extension). Bakes are declaration-gated by
// DEFAULT (§3.1/§3.4 — no `--gate` flag needed). `--check` lints either
// spelling without solving (the same code path as the `check` verb).

import { lowerScene } from "../../plan/scene.js";
import { validateFigureSpec, specHash } from "../../plan/figure.js";
import type { FigureSpec } from "../../plan/types.js";
import { run, expectDeclarationsOf } from "../../solve/run.js";
import { gateFigure } from "../../solve/gate.js";
import { isLineRefusal } from "../../solve/envelope.js";
import type { FigureResult, LineResult } from "../../solve/types.js";
import { renderViews, computeProportionMetrics, gateProportions, buildManifestRecord } from "../../render/index.js";
import type { ComposedRoad } from "../../road/types.js";
import { EXIT } from "../exit.js";
import { parseZeroFileFlags } from "../args.js";
import { errOutcome, okOutcome, lintFigureSpec, looksLikeJson, parseJson, type VerbOutcome, type WriteFile } from "./shared.js";

export interface FigureVerbInput {
  readonly loadedText: string;
  readonly argv: readonly string[];
  readonly engineSemver: string;
}

function straightLenM(road: ComposedRoad): number {
  return road.segments.filter((s) => s.type === "straight").reduce((sum, s) => sum + s.len_m, 0);
}

interface LoweredInput {
  readonly spec: FigureSpec;
  /** the raw parsed JSON, when the input was JSON-spelled — carries `expect` (D30: JSON-only) */
  readonly rawJson?: unknown;
}

function lowerInput(text: string): { ok: true; value: LoweredInput } | { ok: false; error: import("../../core/result.js").LinelabError } {
  if (looksLikeJson(text)) {
    const j = parseJson(text, "input");
    if (!j.ok) return j;
    const spec = validateFigureSpec(j.value);
    if (!spec.ok) return spec;
    return { ok: true, value: { spec: spec.value, rawJson: j.value } };
  }
  const spec = lowerScene(text);
  if (!spec.ok) return spec;
  return { ok: true, value: { spec: spec.value } };
}

export function figureVerb(input: FigureVerbInput): VerbOutcome {
  const parsed = parseZeroFileFlags(input.argv);
  if (!parsed.ok) return errOutcome(parsed.error);

  const lowered = lowerInput(input.loadedText);
  if (!lowered.ok) return errOutcome(lowered.error);
  const spec = lowered.value.spec;

  // `--check` lints without solving — the SAME lint the `check` verb runs
  // (design/08 §3's `check` row: "Same code path as `figure --check`").
  if (parsed.value.check) {
    return lintFigureSpec(spec);
  }

  const figureId = parsed.value.out !== undefined ? parsed.value.out.split("/").filter((s) => s.length > 0).pop() ?? "figure" : "figure";
  const result = run(spec as unknown as Record<string, unknown>, { engine_semver: input.engineSemver, figure_id: figureId });
  if (!result.ok) return errOutcome(result.error);
  const envelope: FigureResult = result.value;

  // declaration-gated by default (§3.1/§3.4): a FigureSpec line's `expect` block
  // rides the RAW json only when the input was JSON-spelled; scene text carries
  // no `expect` (D30 — JSON-only, deliberately).
  const declaredR = lowered.value.rawJson !== undefined ? expectDeclarationsOf(lowered.value.rawJson) : undefined;
  const declared = declaredR?.ok ? declaredR.value : {};
  const report = gateFigure(envelope, { expect: declared });
  let exit: VerbOutcome["exit"] = report.pass ? EXIT.OK : EXIT.DEVIATION;

  const writes: WriteFile[] = [];
  if (parsed.value.out !== undefined) {
    const outDir = parsed.value.out;
    const lines = envelope.lines.filter((l): l is LineResult => !isLineRefusal(l));
    // flag-over-file merge law (08 §4.2), applied to the view surface: `--mode`
    // overrides the spec's own `view.mode` — this is how CI bakes mode=diagram
    // scenes with `--mode true` (ARCHITECTURE §6.5).
    const fileView = typeof spec.view === "object" && spec.view !== null ? (spec.view as Record<string, unknown>) : {};
    const viewSpec = parsed.value.mode !== undefined ? { ...fileView, mode: parsed.value.mode } : spec.view;
    // "the bake stays total ... Refused lines draw nothing" (design/05 §7):
    // a label anchored on a REFUSED line draws nothing with its line — dropped
    // here rather than aborting the whole bake (WP-17 fix). Labels naming a
    // line absent from the figure altogether still reach resolveLabels and
    // fail typed (A-ANCHOR-ERRORS unaffected).
    const refusedIds = new Set(envelope.lines.filter((l) => isLineRefusal(l)).map((l) => l.line_id));
    const drawableLabels = spec.labels?.filter((lb) => !refusedIds.has(lb.line));
    const rendered = renderViews({
      road: envelope.road as unknown as ComposedRoad,
      lines,
      viewSpec,
      ...(drawableLabels !== undefined ? { labels: drawableLabels } : {}),
      // design/06 §3.1 stage 11 — the figure's own placard boxes. Absent unless
      // authored, so a scene without `placards:` renders exactly as before.
      ...(spec.placards !== undefined ? { placards: spec.placards } : {}),
      marks: spec.marks ?? "auto"
    });
    if (!rendered.ok) return errOutcome(rendered.error);
    writes.push({ path: `${outDir}/${envelope.figure_id}.svg`, content: rendered.value.svg });
    writes.push({ path: `${outDir}/${envelope.figure_id}.json`, content: JSON.stringify(envelope, null, 2) });
    const metrics = computeProportionMetrics(rendered.value.scene, envelope.road.corners, straightLenM(envelope.road as ComposedRoad));
    const gate = gateProportions(metrics);
    const manifest = buildManifestRecord(envelope.figure_id, specHash(spec), rendered.value.scene, metrics, gate.verdict);
    writes.push({ path: `${outDir}/manifest.json`, content: JSON.stringify(manifest, null, 2) });
    // NOTE: the render PROPORTION gate (design/06) is a book-figure QA check
    // owned by WP-17's `test/render/gate.test.ts`, not a CLI exit-tier trigger
    // (08 §3.1's table names only declaration-gated/version-skew/NO_SOLUTION
    // triggers) — it rides in the written manifest only, never the exit code.
  }

  return okOutcome(envelope, writes, exit);
}
