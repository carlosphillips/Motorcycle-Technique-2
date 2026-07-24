// viewer/types.ts — the viewer's own closed sets and view-state shapes
// (design/07). Everything here is VIEW-LEVEL state (07 §6.3: "the viewer is
// read-mostly: it offers view-level state only — cursor, focus, lock mode,
// view toggles, line visibility"); no physics value is ever declared here.
//
// Phase law (00 §3, ARCHITECTURE §6.4): `pov` is v0.3 (immersion) and is
// therefore ABSENT from `VIEWER_VIEWS`, not stubbed — the same discipline
// `render/index.ts` applies to its own `pov` target. Compare mode (07 §4) is
// v0.3 too, so `LOCK_MODES` ships its closed set (the toggle is spelled in the
// v0.2 layout, 07 §6.1) while multi-line ghost rendering does not.
/**
 * The views the v0.2 viewer offers, in 07 §6.1 layout order (left, bottom).
 * 00 §5's full view vocabulary is `topdown | controls | pov`; `pov` lands with
 * immersion (v0.3) and is absent here.
 */
export const VIEWER_VIEWS = ["topdown", "controls"];
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