// cli/verbs/render.ts — the `render` verb (design/08 §3): write SVG(s) + a
// manifest from an already-computed envelope. v0.1 ships `topdown` only
// (ARCHITECTURE §1 scope; `pov` rejects SCHEMA/deferred inside renderViews
// itself). View flags (`--marks`/`--rays`/`--legend`/`--orient`) override the
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

  if (parsed.value.views !== undefined && parsed.value.views.includes("pov")) {
    return errOutcome({
      code: "SCHEMA",
      at: "render.views",
      message: 'render target "pov" is not shipped yet',
      deferred: "immersion (v0.3)",
      detail: { reason: "deferred" }
    });
  }

  const lines = (envelope.lines as unknown[]).filter((l): l is LineResult => !isLineRefusal(l as never)) as LineResult[];

  const view: Record<string, string> = { ...(parsed.value.draft.view ?? {}) };
  if (parsed.value.mode !== undefined) view["mode"] = parsed.value.mode;

  const rendered = renderViews({
    road: envelope.road,
    lines,
    viewSpec: Object.keys(view).length > 0 ? view : undefined,
    marks: parsed.value.draft.marks !== undefined ? parseMarkSpec(parsed.value.draft.marks) : "auto"
  });
  if (!rendered.ok) return errOutcome(rendered.error);

  const writes: WriteFile[] = [];
  const outDir = parsed.value.out ?? ".";
  const svgPath = `${outDir}/${envelope.figure_id}.svg`;
  writes.push({ path: svgPath, content: rendered.value.svg });

  const metrics = computeProportionMetrics(rendered.value.scene, envelope.road.corners, straightLenM(envelope.road));
  const gate = gateProportions(metrics);
  const canon = canonicalize(envelope);
  const envelopeHash = canon.ok ? fnv1a(canon.value) : "000000";
  const manifest = buildManifestRecord(envelope.figure_id, envelopeHash, rendered.value.scene, metrics, gate.verdict);
  writes.push({ path: `${outDir}/manifest.json`, content: JSON.stringify(manifest, null, 2) });

  return okOutcome({ figure_id: envelope.figure_id, svg: svgPath, manifest: `${outDir}/manifest.json` }, writes, EXIT.OK);
}
