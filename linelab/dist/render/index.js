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
// `target: "pov"` is the IMMERSION view (v0.3): a first-person pinhole
// projection of TRUE geometry (render/pov.ts, design/07 §5). It is UN-DEFERRED
// here — the phase-gate that once rejected it (`SCHEMA`/`deferred: "immersion
// (v0.3)"`) is retired now that the target ships. The pov SVG is built by
// render/pov.ts, which NEVER imports render/project.ts (C-POV-TRUE-GEOMETRY's
// structural lint); `project()` runs on the pov path only to validate the
// ViewSpec once and to fill the shared `RenderViewsResult.scene`.
import { ok } from "../core/result.js";
import { project, rotatePoint } from "./project.js";
import { deriveMarkers } from "./markers.js";
import { resolveLabels } from "./labels.js";
import { withMarkers, withLabels, withPlacards } from "./scene.js";
import { renderTopdown } from "./topdown.js";
import { renderPovForFigure } from "./pov.js";
export { wrapPlacard, placardBandHeightPx, PLACARD_WRAP_CHARS } from "./placards.js";
export { project } from "./project.js";
export { renderTopdown } from "./topdown.js";
// v0.2 (00 §3's inspection row): the controls strip with its linked cursor.
// `renderControls` draws against TRUE station only — it is deliberately NOT a
// `renderViews` target, because `renderViews` composes a PROJECTED DrawnScene
// and the strip is never projected (06 §4).
export { renderControls, phaseBandsOf, lastCornerIdOf, CONTROLS_NEUTRAL_INKS } from "./controls.js";
export { fallbackSvg } from "./fallback.js";
export { gateProportions, computeProportionMetrics } from "./gateProportions.js";
export { buildManifestRecord } from "./manifest.js";
// v0.3 (00 §3's immersion row): the POV render target. `render/pov.ts` owns the
// camera/projection/draw-list; these are its public surface (the viewer consumes
// `povFrame`/`renderPov` for the canvas view; 09 asserts the draw list).
export { renderPov, povFrame, renderPovForFigure, povFocusLine, povDefaultSample, povYawDeg, POV_LOOK_MODES, POV_MARKER_STATES } from "./pov.js";
function isRecord(v) {
    return typeof v === "object" && v !== null && !Array.isArray(v);
}
/**
 * `renderViews(input) → Result<{scene, svg}>` — dispatches the render target.
 * `target: "topdown"` (the default) composes a projected `DrawnScene` and draws
 * it; `target: "pov"` (v0.3 immersion) builds the first-person SVG from TRUE
 * geometry (render/pov.ts) and carries the topdown scene alongside for the
 * shared return contract. Neither renderer throws — only composition-time
 * failures (`project()`'s typed errors, `resolveLabels`'s typed anchor
 * failures) surface through this `Result`.
 */
export function renderViews(input) {
    if (input.target === "pov") {
        // C-POV-TRUE-GEOMETRY: the pov SVG is built by renderPovForFigure from TRUE
        // geometry only (render/pov.ts never imports project.ts). project() runs
        // here solely to (a) validate the ViewSpec once — including the `look`
        // closed set — and (b) fill the shared RenderViewsResult.scene contract.
        // The pov svg is INVARIANT to every projection setting project() resolves
        // (orient/window/…), which is the behavioural half of the gate.
        const base = project(input.road, input.lines, input.viewSpec);
        if (!base.ok)
            return base;
        const look = isRecord(input.viewSpec) && input.viewSpec["look"] === "limit_point" ? "limit_point" : "heading";
        const roll = isRecord(input.viewSpec) && input.viewSpec["roll"] === "level" ? "level" : "lean";
        const svg = renderPovForFigure(input.road, input.lines, look, roll, input.station);
        return ok({ scene: base.value, svg });
    }
    const base = project(input.road, input.lines, input.viewSpec);
    if (!base.ok)
        return base;
    const withChrome = input.placards !== undefined ? withPlacards(base.value, input.placards) : base.value;
    const markers = deriveMarkers(input.lines, input.marks, input.lineMarks);
    const labels = resolveLabels(input.lines, input.labels);
    if (!labels.ok)
        return labels;
    // markers.ts/labels.ts resolve in WORLD space over the full trajectory (the
    // marker-from-event law is station-indexed, not view-indexed). The drawn
    // scene, however, is window-cropped and orient-rotated by project() — so
    // before attaching, (1) drop any glyph whose true station lies outside the
    // drawn window (its geometry isn't drawn; a glyph there would float), and
    // (2) map the surviving anchor points through the SAME §2.4 rigid rotation
    // (scene.pivot + scene.orient) the road/lines went through. Skipping (2) is
    // the fig-08-06 orient=90 "markers scattered in the grass" judge finding.
    const { window, pivot, orient } = withChrome;
    const inWindow = (s) => s >= window.from_s && s <= window.to_s;
    const place = (p) => rotatePoint(p, pivot.x, pivot.y, orient);
    const drawnMarkers = markers
        .filter((m) => inWindow(m.s))
        .map((m) => ({ ...m, at: place(m.at) }));
    const drawnLabels = labels.value
        .filter((l) => inWindow(l.s))
        .map((l) => ({ ...l, anchor: place(l.anchor) }));
    const scene = withLabels(withMarkers(withChrome, drawnMarkers), drawnLabels);
    const svg = renderTopdown(scene, input.style);
    return ok({ scene, svg });
}
//# sourceMappingURL=index.js.map