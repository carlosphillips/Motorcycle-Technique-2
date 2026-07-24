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
import { ok, err } from "../core/result.js";
import { renderViews } from "../render/index.js";
import { renderControls } from "../render/controls.js";
import { glyphSvg, placeGlyph, withOverlay } from "./glyph.js";
import { saveWindowOverlaySvg } from "./saveWindow.js";
import { focusedLine } from "./session.js";
import { VIEWER_VIEWS } from "./types.js";
function unknownView(view) {
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
export function renderView(session, req) {
    const line = req.line_id === undefined ? focusedLine(session) : session.lines.find((l) => l.line_id === req.line_id) ?? null;
    if (line === null) {
        return err({
            code: "UNKNOWN_ID",
            at: "line",
            message: `no drawable line "${req.line_id ?? session.focus}" in this envelope`,
            detail: { reason: "unknown_line_id", available: session.lines.map((l) => l.line_id) }
        });
    }
    if (req.view === "topdown")
        return topdownView(session, line, req);
    if (req.view === "controls")
        return controlsViewOf(session, line, req);
    if (req.view === "pov") {
        // ONE deferral statement for `pov`, render/index.ts's own — this file
        // does not restate the phase (ARCHITECTURE §6.4: one table, one source).
        const deferred = renderViews({ road: session.road, lines: session.lines, target: "pov" });
        if (!deferred.ok)
            return deferred;
    }
    return unknownView(req.view);
}
function topdownView(session, line, req) {
    const rendered = renderViews({
        road: session.road,
        lines: session.lines,
        ...(req.mode !== undefined ? { viewSpec: { mode: req.mode } } : {})
    });
    if (!rendered.ok)
        return rendered;
    const instant = req.instant ?? null;
    // Overlay layers, in painter's order: the save-window probe/glyph first (it
    // is scene furniture), then the cursor glyph on top. Both are appended to the
    // EXPORTED svg string, so `topdown` remains "the same picture as the exported
    // figure, plus a glyph layer" (07 §2.3) and the export itself never changes.
    const overlays = (req.saveWindow === undefined || req.saveWindow === null ? "" : saveWindowOverlaySvg(req.saveWindow)) +
        (instant === null ? "" : glyphSvg(placeGlyph(instant, line, rendered.value.scene)));
    const svg = overlays === "" ? rendered.value.svg : withOverlay(rendered.value.svg, overlays);
    return ok(Object.freeze({ view: "topdown", line_id: line.line_id, svg }));
}
function controlsViewOf(session, line, req) {
    // The strip shades exactly the span the top-down draws (06 §4) — asked of
    // the projection, never re-derived, the same seam cli/verbs/controls.ts uses.
    const projected = renderViews({
        road: session.road,
        lines: session.lines,
        ...(req.mode !== undefined ? { viewSpec: { mode: req.mode } } : {})
    });
    if (!projected.ok)
        return projected;
    const window = { from: projected.value.scene.window.from_s, to: projected.value.scene.window.to_s };
    // 07 §3.2: the controls cursor is "a vertical cursor line at the current
    // STATION across every channel of the strip" — station basis in both
    // scrubber axes, so the time axis passes its instant's own `sample.s`.
    const cursor = req.instant === null || req.instant === undefined ? undefined : req.instant.sample.s;
    return ok(Object.freeze({
        view: "controls",
        line_id: line.line_id,
        svg: renderControls(line, window, cursor)
    }));
}
/**
 * The per-view BOOT smoke check (00 §3's phase table): render every view the
 * viewer offers, once, and report which ones came back. A view that throws or
 * refuses shows up as an error entry rather than a crashed page — the viewer's
 * own never-throw stance, matching `renderTopdown`'s (06 §3).
 */
export function bootViews(session, instant) {
    return VIEWER_VIEWS.map((view) => renderView(session, { view, instant: instant ?? null }));
}
//# sourceMappingURL=views.js.map