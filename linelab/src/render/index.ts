// render/index.ts — `renderViews` dispatch (design/06, ARCHITECTURE §5: "v0.1:
// topdown only"). The one composition point that turns a figure's road/lines
// plus its AUTHORING data (labels, marks — FigureSpec-level, not physics, so
// absent from `LineResult`/`FigureResult`, ARCHITECTURE §4) into a rendered
// `DrawnScene` + SVG: `project()` builds the base scene from
// `(road, lines, viewSpec)` per its pinned 3-name signature; this file attaches
// markers (markers.ts) and labels (labels.ts) — both pure, immutable
// `with*` composition (render/scene.ts) — before handing the finished scene to
// `renderTopdown`.
//
// `target: "pov"` rejects typed `SCHEMA`/`deferred: "immersion (v0.3)"`
// (00 §3/ARCHITECTURE §6.4's table) — the POV render target doesn't exist
// until v0.3; only `topdown` ships in v0.1.

import type { Result } from "../core/result.js";
import { ok, err } from "../core/result.js";
import type { ComposedRoad } from "../road/types.js";
import type { LineResult } from "../solve/types.js";
import type { FigureLabel, MarkSpec } from "../plan/types.js";
import { project, rotatePoint } from "./project.js";
import { deriveMarkers } from "./markers.js";
import { resolveLabels } from "./labels.js";
import { withMarkers, withLabels } from "./scene.js";
import type { DrawnScene, DrawnMarker, DrawnLabel } from "./scene.js";
import { renderTopdown } from "./topdown.js";
import type { RenderStyle } from "./topdown.js";

export type { DrawnScene } from "./scene.js";
export { project } from "./project.js";
export type { ViewSpec, StationRef } from "./project.js";
export { renderTopdown } from "./topdown.js";
// v0.2 (00 §3's inspection row): the controls strip with its linked cursor.
// `renderControls` draws against TRUE station only — it is deliberately NOT a
// `renderViews` target, because `renderViews` composes a PROJECTED DrawnScene
// and the strip is never projected (06 §4).
export { renderControls, phaseBandsOf, lastCornerIdOf, CONTROLS_NEUTRAL_INKS } from "./controls.js";
export type { ControlsWindow, ControlsPanelId, PhaseBand } from "./controls.js";
export { fallbackSvg } from "./fallback.js";
export { gateProportions, computeProportionMetrics } from "./gateProportions.js";
export type { ProportionMetrics, ProportionGateResult, GateVerdict } from "./gateProportions.js";
export { buildManifestRecord } from "./manifest.js";
export type { ManifestRecord } from "./manifest.js";

export type RenderTarget = "topdown" | "pov";

export interface RenderViewsInput {
  readonly road: ComposedRoad;
  readonly lines: readonly LineResult[];
  readonly viewSpec?: unknown;
  readonly labels?: readonly FigureLabel[];
  readonly marks?: MarkSpec;
  readonly target?: RenderTarget;
  readonly style?: RenderStyle;
}

export interface RenderViewsResult {
  readonly scene: DrawnScene;
  readonly svg: string;
}

/**
 * `renderViews(input) → Result<{scene, svg}>` — v0.1: `target: "topdown"`
 * (the default) only. `target: "pov"` is a phase-gated `SCHEMA` rejection
 * (ARCHITECTURE §6.4's table), not a `renderTopdown` failure — `renderTopdown`
 * itself never throws/errors (§3 intro), so only composition-time failures
 * (`project()`'s typed errors, `resolveLabels`'s typed anchor failures)
 * surface through this `Result`.
 */
export function renderViews(input: RenderViewsInput): Result<RenderViewsResult> {
  if (input.target === "pov") {
    return err({
      code: "SCHEMA",
      at: "render.target",
      message: 'render target "pov" is not shipped yet',
      schema_ref: "render.target",
      deferred: "immersion (v0.3)",
      detail: { reason: "deferred" }
    });
  }

  const base = project(input.road, input.lines, input.viewSpec);
  if (!base.ok) return base;

  const markers = deriveMarkers(input.lines, input.marks);
  const labels = resolveLabels(input.lines, input.labels);
  if (!labels.ok) return labels;

  // markers.ts/labels.ts resolve in WORLD space over the full trajectory (the
  // marker-from-event law is station-indexed, not view-indexed). The drawn
  // scene, however, is window-cropped and orient-rotated by project() — so
  // before attaching, (1) drop any glyph whose true station lies outside the
  // drawn window (its geometry isn't drawn; a glyph there would float), and
  // (2) map the surviving anchor points through the SAME §2.4 rigid rotation
  // (scene.pivot + scene.orient) the road/lines went through. Skipping (2) is
  // the fig-08-06 orient=90 "markers scattered in the grass" judge finding.
  const { window, pivot, orient } = base.value;
  const inWindow = (s: number): boolean => s >= window.from_s && s <= window.to_s;
  const place = (p: { readonly x: number; readonly y: number }): { x: number; y: number } =>
    rotatePoint(p, pivot.x, pivot.y, orient);
  const drawnMarkers: readonly DrawnMarker[] = markers
    .filter((m) => inWindow(m.s))
    .map((m) => ({ ...m, at: place(m.at) }));
  const drawnLabels: readonly DrawnLabel[] = labels.value
    .filter((l) => inWindow(l.s))
    .map((l) => ({ ...l, anchor: place(l.anchor) }));

  const scene = withLabels(withMarkers(base.value, drawnMarkers), drawnLabels);
  const svg = renderTopdown(scene, input.style);
  return ok({ scene, svg });
}
