// cli/verbs/render.ts — the `render` verb (design/08 §3): write SVG(s) + a
// manifest from an already-computed envelope. `topdown` (default) writes the
// figure SVG + proportion manifest; `pov` (v0.3 immersion, design/07 §5) writes
// the first-person `<figure_id>.pov.svg`, or `<figure_id>.<line_id>.pov.svg`
// when `--line` focuses one line. args.ts parses `pov` as a legal
// `--views` NAME and leaves the phase gate "in exactly one place, the render
// layer" — that gate is now the shipped render. View flags (`--marks`/`--rays`/
// `--legend`/`--orient`/`--look`, the pov camera toggle) override the
// envelope's own view (§4.2 precedence) since the envelope carries no
// authored labels/marks (those are FigureSpec-level input data — `figure`
// bakes render from the spec directly; `render` on a bare envelope draws
// AUTO-derived markers only — recorded as a deviation of this scope).

import type { ComposedRoad } from "../../road/types.js";
import type { LineResult } from "../../solve/types.js";
import type { MarkClass, MarkSpec } from "../../plan/types.js";
import { isLineRefusal } from "../../solve/envelope.js";
import { renderViews, computeProportionMetrics, gateProportions, buildManifestRecord } from "../../render/index.js";
import { canonicalize, fnv1a } from "../../core/hash.js";
import { EXIT } from "../exit.js";
import { parseZeroFileFlags } from "../args.js";
import {
  errOutcome,
  okOutcome,
  parseJson,
  recomposeEnvelopeRoad,
  schemaErr,
  isObject,
  type VerbOutcome,
  type WriteFile
} from "./shared.js";

export interface RenderVerbInput {
  readonly loadedText?: string;
  readonly argv: readonly string[];
}

function straightLenM(road: ComposedRoad): number {
  return road.segments.filter((s) => s.type === "straight").reduce((sum, s) => sum + s.len_m, 0);
}

const MARK_CLASSES: readonly MarkClass[] = ["turn_point", "apex", "exit", "release"];

function parseMarkSpec(v: string): MarkSpec {
  if (v === "auto" || v === "all" || v === "none") return v;
  const classes = v.split(",").map((c) => c.trim()).filter((c): c is MarkClass => (MARK_CLASSES as readonly string[]).includes(c));
  return classes.length > 0 ? classes : "auto";
}

export function renderVerb(input: RenderVerbInput): VerbOutcome {
  const parsed = parseZeroFileFlags(input.argv);
  if (!parsed.ok) return errOutcome(parsed.error);
  if (input.loadedText === undefined) {
    return errOutcome(schemaErr("render", "render needs an <envelope.json> argument", "render_input_missing"));
  }
  const j = parseJson(input.loadedText, "input");
  if (!j.ok) return errOutcome(j.error);
  if (!isObject(j.value) || !Array.isArray(j.value["lines"])) {
    return errOutcome(schemaErr("input", "render input must be an envelope ({figure_id, road, lines, …})", "render_input_not_envelope"));
  }
  const rawEnvelope = j.value as { figure_id: string; road: ComposedRoad; lines: unknown[] };
  // A JSON round-trip strips a ComposedRoad's function members (worldAt,
  // psi_road, dOf, fOf, muAt — closures cannot survive serialization);
  // RECOMPOSE through shared.ts's ONE rule, which threads the disclosed
  // `bike_margin_m`/`use_full_width` beside the `dsl` — a dsl-only recompose
  // rebuilds a DIFFERENT corridor from the one the engine rode.
  const recomposed = recomposeEnvelopeRoad(rawEnvelope.road);
  if (!recomposed.ok) return errOutcome(recomposed.error);
  const envelope = { ...rawEnvelope, road: recomposed.value };

  // `pov` (the immersion view, design/07 §5) is UN-DEFERRED: `--views pov`
  // now renders the first-person target. args.ts parses `pov` as a legal view
  // NAME and leaves the (former) phase gate "in exactly one place, the render
  // layer" — that gate is now the shipped render itself. The requested-view
  // set is honoured: pov-only draws pov only; the default (no `--views`) stays
  // topdown, so every existing render invocation is unchanged.
  const requested = parsed.value.views ?? ["topdown"];
  const wantPov = requested.includes("pov");
  const wantTopdown = requested.includes("topdown") || !wantPov;

  const lines = (envelope.lines as unknown[]).filter((l): l is LineResult => !isLineRefusal(l as never)) as LineResult[];

  const view: Record<string, string> = { ...(parsed.value.draft.view ?? {}) };
  if (parsed.value.mode !== undefined) view["mode"] = parsed.value.mode;
  const viewSpec = Object.keys(view).length > 0 ? view : undefined;
  const marks = parsed.value.draft.marks !== undefined ? parseMarkSpec(parsed.value.draft.marks) : "auto";

  const writes: WriteFile[] = [];
  const outDir = parsed.value.out ?? ".";
  const report: Record<string, string> = { figure_id: envelope.figure_id };

  if (wantTopdown) {
    const rendered = renderViews({ road: envelope.road, lines, viewSpec, marks });
    if (!rendered.ok) return errOutcome(rendered.error);
    const svgPath = `${outDir}/${envelope.figure_id}.svg`;
    writes.push({ path: svgPath, content: rendered.value.svg });
    const metrics = computeProportionMetrics(rendered.value.scene, envelope.road.corners, straightLenM(envelope.road));
    const gate = gateProportions(metrics);
    const canon = canonicalize(envelope);
    const envelopeHash = canon.ok ? fnv1a(canon.value) : "000000";
    const manifest = buildManifestRecord(envelope.figure_id, envelopeHash, rendered.value.scene, metrics, gate.verdict);
    writes.push({ path: `${outDir}/manifest.json`, content: JSON.stringify(manifest, null, 2) });
    report["svg"] = svgPath;
    report["manifest"] = `${outDir}/manifest.json`;
  }

  if (wantPov) {
    // the POV target: true-geometry first-person SVG (render/pov.ts). No
    // proportion gate/manifest — POV is not a DrawnScene and 06 §6.2's gate is
    // topdown-only ("mode: true renders are exempt"); the pov svg stands alone.
    //
    // `--line <id>` focuses ONE line, exactly as it does on the `controls` view,
    // and names the output `<figure_id>.<line_id>.pov.svg` to match that view's
    // per-line spelling. Without it the focus rule is unchanged
    // (`povFocusLine`: ideal wins) and so is the filename — a bare
    // `render --views pov` still writes `<figure_id>.pov.svg`.
    //
    // Why the flag exists: one POV frame is a picture, not evidence. The
    // camera pose is the LINE's own recorded Sample, so the ideal line's frame
    // and the mistake line's frame at the same corner are the comparison that
    // carries the lesson — what each rider can actually see from where their
    // own line put them. Rendering only the ideal line's frame shows the half
    // that never had the problem.
    const requestedLine = parsed.value.line;
    let focus: readonly LineResult[] = lines;
    let suffix = "";
    if (requestedLine !== undefined) {
      const found = lines.find((l) => l.line_id === requestedLine);
      if (found === undefined) {
        return errOutcome({
          code: "UNKNOWN_ID",
          at: "--line",
          message: `unknown line "${requestedLine}" (available: ${lines.map((l) => l.line_id).join(", ")})`,
          detail: { reason: "unknown_line_id", available: lines.map((l) => l.line_id) }
        });
      }
      focus = [found];
      suffix = `.${found.line_id}`;
    }
    // `--s <m>` puts the camera at a chosen true station instead of the default
    // cursor — the same flag the controls view uses for its cursor, so one
    // station names one moment across both views. The station rides in the
    // filename so three stations of one line can sit side by side.
    const station = parsed.value.s;
    const stationSuffix = station !== undefined && Number.isFinite(station) ? `.s${Math.round(station)}` : "";
    const rendered = renderViews({
      road: envelope.road,
      lines: focus,
      viewSpec,
      marks,
      target: "pov",
      ...(station !== undefined ? { station } : {})
    });
    if (!rendered.ok) return errOutcome(rendered.error);
    const povPath = `${outDir}/${envelope.figure_id}${suffix}${stationSuffix}.pov.svg`;
    writes.push({ path: povPath, content: rendered.value.svg });
    report["pov"] = povPath;
  }

  return okOutcome(report, writes, EXIT.OK);
}
