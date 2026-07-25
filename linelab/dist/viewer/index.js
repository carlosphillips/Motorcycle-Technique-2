// viewer/index.ts — the viewer package's export surface (design/07).
// `src/index.ts` (the library root, ARCHITECTURE §5's A-IMPORT-SURFACE) is
// owned elsewhere and is deliberately NOT touched here; this file is the
// viewer's own front door, imported by `viewer/boot.ts` consumers and by
// tests. `boot.ts` itself is intentionally absent — it carries a top-level
// side effect and must only ever be reached by a `<script type="module">`.
export { CURSOR_AXES, HUD_GROUPS, HUD_ORIGINS, LOCK_MODES, VIEWER_VIEWS } from "./types.js";
export { FRAME_STEP_S, PLAYBACK_SPEEDS, SAVE_WINDOW_INK, CORRECTIVE_GHOST_INK, CORRECTIVE_GHOST_OPACITY, COMPARE_GHOST_OPACITY } from "./constants.js";
export { loadSession, sessionOf, withFocus, lineOf, focusedLine, stateInputFor } from "./session.js";
export { bookmarksOf, printBookmark, parseBookmark } from "./bookmarks.js";
export { hudAt, hudRowsOf, instantValueAt } from "./hud.js";
export { domainOf, scenarioDomain, clampTo, initialStepper, scrubTo, play, pause, withSpeed, advance, stepFrame, stepSample, jumpTo, toggleAxis, stationForTime, timeForStation } from "./stepper.js";
export { renderView, bootViews } from "./views.js";
export { placeGlyph, glyphSvg, withOverlay } from "./glyph.js";
export { saveWindowOverlay, saveWindowHudRows, saveWindowTicks, saveWindowOverlaySvg } from "./saveWindow.js";
export { correctiveGhostOverlay, correctiveGhostSvg } from "./correctiveGhost.js";
// v0.3 (00 §3's immersion row): the pov view + compare mode.
export { renderPovView, parsePovLook, POV_LOOK_MODES } from "./pov.js";
export { compareModel, compareGhostsSvg, lockAxisOf } from "./compare.js";
export { createApp, frameOf, domainFor, scrub, togglePlay, setSpeed, tick, nudgeFrame, nudgeSample, flipAxis, setLock, setLook, focusLine, jumpToBookmark, toggleSaveWindow, toggleCorrectiveGhost, hudHtml, bookmarkOptionsHtml, legendHtml, boot, OFF_ROAD_PLACARD } from "./app.js";
export { viewerPageHtml } from "./page.js";
export { browserHost } from "./host.js";
//# sourceMappingURL=index.js.map