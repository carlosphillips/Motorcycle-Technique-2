// viewer/views.ts — per-view rendering (design/07 §2.3, §3.2).
//
// | View       | Technology | Where the drawing comes from                    |
// |------------|------------|-------------------------------------------------|
// | `topdown`  | SVG DOM    | `render/index.ts`'s `renderViews`, VERBATIM,     |
// |            |            | plus viewer/glyph.ts's cursor overlay            |
// | `controls` | SVG DOM    | `render/controls.ts`'s `renderControls`, VERBATIM|
//
// 07 §2.3: "the interactive top-down is the *same picture* as the exported
// figure, plus a glyph layer". That is enforced structurally: the SVG this
// file returns for `topdown` is byte-identical to the export up to the appended
// overlay `<g>`, because the export IS the string it starts from.
//
// `pov` is immersion (v0.3) and is absent from `VIEWER_VIEWS`; asking for it
// by string reaches the same phase-gated `SCHEMA`/`deferred` refusal
// `render/index.ts` already owns, so there is exactly one deferral statement.

import type { InstantState } from "../core/types.js";
import type { Result } from "../core/result.js";
import { ok, err } from "../core/result.js";
import { renderViews } from "../render/index.js";
import { renderControls, type ControlsWindow } from "../render/controls.js";
import type { LineResult } from "../solve/types.js";
import { glyphSvg, placeGlyph, withOverlay } from "./glyph.js";
import { saveWindowOverlaySvg, type SaveWindowOverlay } from "./saveWindow.js";
import { focusedLine, type ViewerSession } from "./session.js";
import { VIEWER_VIEWS, type ViewerView } from "./types.js";

export interface ViewRender {
  readonly view: ViewerView;
  readonly line_id: string;
  readonly svg: string;
}

export interface ViewRequest {
  readonly view: string;
  /** the instant the cursor sits at on the focused line, or null for a static draw */
  readonly instant?: InstantState | null;
  /** the focused line's id; defaults to the session's focus */
  readonly line_id?: string;
  /** `true` (v0.1/v0.2) — `diagram` stays phase-gated inside render/project.ts */
  readonly mode?: string;
  /**
   * design/07 §3.6's save-window toggle — OFF BY DEFAULT, per line. When the
   * caller has already computed the once-per-toggle overlay it passes it here
   * and the top-down gains one extra `<g>`; the exported picture is untouched
   * either way (C-SAVEWIN-NO-INK), because `render/` cannot reach this module.
   */
  readonly saveWindow?: SaveWindowOverlay | null;
}

function unknownView(view: string): Result<ViewRender> {
  return err({
    code: "SCHEMA",
    at: "view",
    message: `unknown view "${view}" — the viewer offers ${VIEWER_VIEWS.join(", ")}`,
    detail: { reason: "unknown_view", view }
  });
}

/**
 * Render one view of one session at the cursor. Pure: it never touches a DOM,
 * a timer, or IO — it returns the SVG string the host writes into the pane.
 */
export function renderView(session: ViewerSession, req: ViewRequest): Result<ViewRender> {
  const line = req.line_id === undefined ? focusedLine(session) : session.lines.find((l) => l.line_id === req.line_id) ?? null;
  if (line === null) {
    return err({
      code: "UNKNOWN_ID",
      at: "line",
      message: `no drawable line "${req.line_id ?? session.focus}" in this envelope`,
      detail: { reason: "unknown_line_id", available: session.lines.map((l) => l.line_id) }
    });
  }
  if (req.view === "topdown") return topdownView(session, line, req);
  if (req.view === "controls") return controlsViewOf(session, line, req);
  if (req.view === "pov") {
    // ONE deferral statement for `pov`, render/index.ts's own — this file
    // does not restate the phase (ARCHITECTURE §6.4: one table, one source).
    const deferred = renderViews({ road: session.road, lines: session.lines, target: "pov" });
    if (!deferred.ok) return deferred;
  }
  return unknownView(req.view);
}

function topdownView(session: ViewerSession, line: LineResult, req: ViewRequest): Result<ViewRender> {
  const rendered = renderViews({
    road: session.road,
    lines: session.lines,
    ...(req.mode !== undefined ? { viewSpec: { mode: req.mode } } : {})
  });
  if (!rendered.ok) return rendered;
  const instant = req.instant ?? null;
  // Overlay layers, in painter's order: the save-window probe/glyph first (it
  // is scene furniture), then the cursor glyph on top. Both are appended to the
  // EXPORTED svg string, so `topdown` remains "the same picture as the exported
  // figure, plus a glyph layer" (07 §2.3) and the export itself never changes.
  const overlays =
    (req.saveWindow === undefined || req.saveWindow === null ? "" : saveWindowOverlaySvg(req.saveWindow)) +
    (instant === null ? "" : glyphSvg(placeGlyph(instant, line, rendered.value.scene)));
  const svg = overlays === "" ? rendered.value.svg : withOverlay(rendered.value.svg, overlays);
  return ok(Object.freeze({ view: "topdown" as const, line_id: line.line_id, svg }));
}

function controlsViewOf(session: ViewerSession, line: LineResult, req: ViewRequest): Result<ViewRender> {
  // The strip shades exactly the span the top-down draws (06 §4) — asked of
  // the projection, never re-derived, the same seam cli/verbs/controls.ts uses.
  const projected = renderViews({
    road: session.road,
    lines: session.lines,
    ...(req.mode !== undefined ? { viewSpec: { mode: req.mode } } : {})
  });
  if (!projected.ok) return projected;
  const window: ControlsWindow = { from: projected.value.scene.window.from_s, to: projected.value.scene.window.to_s };
  // 07 §3.2: the controls cursor is "a vertical cursor line at the current
  // STATION across every channel of the strip" — station basis in both
  // scrubber axes, so the time axis passes its instant's own `sample.s`.
  const cursor = req.instant === null || req.instant === undefined ? undefined : req.instant.sample.s;
  return ok(
    Object.freeze({
      view: "controls" as const,
      line_id: line.line_id,
      svg: renderControls(line, window, cursor)
    })
  );
}

/**
 * The per-view BOOT smoke check (00 §3's phase table): render every view the
 * viewer offers, once, and report which ones came back. A view that throws or
 * refuses shows up as an error entry rather than a crashed page — the viewer's
 * own never-throw stance, matching `renderTopdown`'s (06 §3).
 */
export function bootViews(session: ViewerSession, instant?: InstantState | null): readonly Result<ViewRender>[] {
  return VIEWER_VIEWS.map((view) => renderView(session, { view, instant: instant ?? null }));
}
