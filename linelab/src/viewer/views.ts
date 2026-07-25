// viewer/views.ts — per-view rendering (design/07 §2.3, §3.2, §5).
//
// | View       | Technology | Where the drawing comes from                    |
// |------------|------------|-------------------------------------------------|
// | `topdown`  | SVG DOM    | `render/index.ts`'s `renderViews`, VERBATIM,     |
// |            |            | plus viewer/glyph.ts's cursor + ghost overlays   |
// | `controls` | SVG DOM    | `render/controls.ts`'s `renderControls`, VERBATIM|
// | `pov`      | SVG        | `render/pov.ts` via `viewer/pov.ts` (TRUE geom)  |
//
// 07 §2.3: "the interactive top-down is the *same picture* as the exported
// figure, plus a glyph layer". That is enforced structurally: the SVG this
// file returns for `topdown` is byte-identical to the export up to the appended
// overlay `<g>`, because the export IS the string it starts from.
//
// `pov` is IMMERSION (v0.3) and now that immersion lands it is a real view: the
// POV path routes through `viewer/pov.ts` → `render/pov.ts`, which never imports
// the diagram-projection module (C-POV-TRUE-GEOMETRY). It is NOT built through
// `renderViews({target:"pov"})` — that would drag `project.ts` onto the viewer's
// POV path; the viewer needs only the pure builder.

import type { InstantState } from "../core/types.js";
import type { Result } from "../core/result.js";
import { ok, err } from "../core/result.js";
import { renderViews } from "../render/index.js";
import { renderControls, type ControlsWindow } from "../render/controls.js";
import type { LineResult } from "../solve/types.js";
import { glyphSvg, placeGlyph, withOverlay } from "./glyph.js";
import { saveWindowOverlaySvg, type SaveWindowOverlay } from "./saveWindow.js";
import { correctiveGhostSvg, type CorrectiveGhostOverlay } from "./correctiveGhost.js";
import { renderPovView, parsePovLook } from "./pov.js";
import { compareGhostsSvg, type CompareModel } from "./compare.js";
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
  /**
   * design/07 §3.5's corrective-ghost toggle — OFF BY DEFAULT, per line, a
   * third overlay class (07 §5.6). Same discipline as `saveWindow`: a
   * once-per-toggle object passed in, one extra `<g>` on the top-down, the
   * exported figure untouched — the ghost is stepper-only (D18).
   */
  readonly correctiveGhost?: CorrectiveGhostOverlay | null;
  /**
   * design/07 §5.2's `look` camera toggle (`heading | limit_point`), consumed by
   * the `pov` view. Default `heading`; an unknown value is `SCHEMA` (closed set,
   * D8). Ignored by `topdown`/`controls`.
   */
  readonly look?: string;
  /**
   * design/07 §4.2's compare model — when present, the top-down draws the
   * NON-focused lines as ghost glyphs (reduced opacity, verdict colour retained)
   * at their own state at the shared lock coordinate. Absent (the v0.2 default)
   * draws no ghosts, so the top-down is byte-identical to the export + cursor.
   */
  readonly compare?: CompareModel | null;
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
  if (req.view === "pov") return povViewOf(session, line, req);
  return unknownView(req.view);
}

/**
 * The `pov` view (design/07 §5): a first-person pinhole projection of TRUE
 * geometry, built by `render/pov.ts` (via `viewer/pov.ts`) — NOT through the
 * diagram-projection path, so C-POV-TRUE-GEOMETRY holds structurally. The camera
 * reads the cursor `instant.sample` verbatim (`limit_x`/`limit_y` consumed, not
 * re-derived — C-POV-LIMIT-CONSISTENT), or a mid-corner default when the cursor
 * is absent. `renderPovView` never throws (renderPov's catch-all).
 */
function povViewOf(session: ViewerSession, line: LineResult, req: ViewRequest): Result<ViewRender> {
  const look = parsePovLook(req.look);
  if (!look.ok) return look;
  const svg = renderPovView(session.road, line, req.instant ?? null, look.value);
  return ok(Object.freeze({ view: "pov" as const, line_id: line.line_id, svg }));
}

function topdownView(session: ViewerSession, line: LineResult, req: ViewRequest): Result<ViewRender> {
  const rendered = renderViews({
    road: session.road,
    lines: session.lines,
    ...(req.mode !== undefined ? { viewSpec: { mode: req.mode } } : {})
  });
  if (!rendered.ok) return rendered;
  const instant = req.instant ?? null;
  // Overlay layers, in painter's order: the counterfactual scene furniture
  // first (the corrective ghost, then the save-window probe/glyph), then the
  // compare-mode ghost glyphs of the OTHER lines (07 §4.2), then the focused
  // line's own cursor glyph on top. All are appended to the EXPORTED svg string,
  // so `topdown` remains "the same picture as the exported figure, plus a glyph
  // layer" (07 §2.3) and the export itself never changes. The corrective/
  // save-window overlays stay the leading substrings they were in v0.2, so their
  // overlay-isolation `replace()` gates are unaffected by the ghost layer.
  const overlays =
    (req.correctiveGhost === undefined || req.correctiveGhost === null ? "" : correctiveGhostSvg(req.correctiveGhost)) +
    (req.saveWindow === undefined || req.saveWindow === null ? "" : saveWindowOverlaySvg(req.saveWindow)) +
    (req.compare === undefined || req.compare === null ? "" : compareGhostsSvg(session, req.compare, rendered.value.scene)) +
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
