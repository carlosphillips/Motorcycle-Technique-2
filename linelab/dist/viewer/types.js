// viewer/types.ts — the viewer's own closed sets and view-state shapes
// (design/07). Everything here is VIEW-LEVEL state (07 §6.3: "the viewer is
// read-mostly: it offers view-level state only — cursor, focus, lock mode,
// view toggles, line visibility"); no physics value is ever declared here.
//
// Phase law (00 §3, ARCHITECTURE §6.4): `pov` is IMMERSION (v0.3) and now that
// immersion lands it JOINS `VIEWER_VIEWS` (its render target un-defers in
// render/index.ts; the viewer's POV view builds on render/pov.ts). Compare mode
// (07 §4) also lands at v0.3 — `LOCK_MODES` was always the closed set (the
// toggle is spelled in the 07 §6.1 layout) and multi-line ghost rendering now
// ships beside it (viewer/compare.ts).
/**
 * The views the viewer offers, in 07 §6.1 layout order (left, right, bottom).
 * 00 §5's full view vocabulary is `topdown | controls | pov`; all three ship
 * once immersion (v0.3) lands — `pov` is a first-person pinhole projection of
 * TRUE geometry (render/pov.ts, design/07 §5).
 */
export const VIEWER_VIEWS = ["topdown", "controls", "pov"];
/** design/07 §4.1 — the compare-mode lock toggle; `station` is the default. */
export const LOCK_MODES = ["station", "time"];
/**
 * design/07 §3.1 — the scrubber axis toggle: the cursor indexes the
 * interpolated TIME base by default ("what happens next"), and flips to the
 * station base ("what happens *here*"). Both spellings are the same `stateAt`
 * contract — `{t}` and `{s}` — so the axis is literally the query key.
 */
export const CURSOR_AXES = ["t", "s"];
/** Which of 07 §3.3's six HUD groups a row belongs to, in table order. */
export const HUD_GROUPS = ["motion", "lean", "grip", "controls", "sight", "verdict"];
/**
 * Where a HUD row's `value` came from. `instant` is the only origin that
 * touches a physics number, and `path` then names the exact member of the
 * `InstantState` it was READ from — the machine-checkable form of
 * `C-HUD-EQUALS-STATEAT` (07 §2.4: "a number on screen is the engine's number,
 * not the UI's reconstruction of it").
 */
export const HUD_ORIGINS = ["instant", "envelope", "profile"];
//# sourceMappingURL=types.js.map