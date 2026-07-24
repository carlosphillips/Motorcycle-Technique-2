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

import type { EventKind } from "../core/types.js";

/**
 * The views the v0.2 viewer offers, in 07 §6.1 layout order (left, bottom).
 * 00 §5's full view vocabulary is `topdown | controls | pov`; `pov` lands with
 * immersion (v0.3) and is absent here.
 */
export const VIEWER_VIEWS = ["topdown", "controls"] as const;
export type ViewerView = (typeof VIEWER_VIEWS)[number];

/** design/07 §4.1 — the compare-mode lock toggle; `station` is the default. */
export const LOCK_MODES = ["station", "time"] as const;
export type LockMode = (typeof LOCK_MODES)[number];

/**
 * design/07 §3.1 — the scrubber axis toggle: the cursor indexes the
 * interpolated TIME base by default ("what happens next"), and flips to the
 * station base ("what happens *here*"). Both spellings are the same `stateAt`
 * contract — `{t}` and `{s}` — so the axis is literally the query key.
 */
export const CURSOR_AXES = ["t", "s"] as const;
export type CursorAxis = (typeof CURSOR_AXES)[number];

/**
 * design/07 §3.1 — one cursor drives every view. `axis` names which `stateAt`
 * query key `value` is; `playing`/`speed` are the playback controls (playback
 * is a scheduled scrub of THIS cursor — there is no second animation pathway).
 */
export interface StepperState {
  readonly axis: CursorAxis;
  readonly value: number;
  readonly playing: boolean;
  /** one of `PLAYBACK_SPEEDS` (07 §3.1) */
  readonly speed: number;
}

/** The `[min, max]` extent of one line on one axis — `stateAt`'s own domain. */
export interface CursorDomain {
  readonly axis: CursorAxis;
  readonly min: number;
  readonly max: number;
}

/**
 * design/07 §3.1's named jump point. **Events are the sole bookmark source**
 * (`C-BOOKMARKS`): one bookmark per entry of the result's `events` array, in
 * that array's order, and nothing else — no plan stations, no probe targets
 * (D45), no `tau_close_s` (D44).
 *
 * `ordinal` is the 1-based count of this kind so far on this line; `label` is
 * the design's own spelling — bare `apex` for the first, `apex#2` for the
 * second ("one tick per recorded apex, labelled `apex#2` on a double-apex
 * corner", 07 §3.1).
 */
export interface Bookmark {
  readonly kind: EventKind;
  /** index into `trajectory.events` — the bookmark's identity within the line */
  readonly index: number;
  readonly ordinal: number;
  readonly label: string;
  /** the event's interpolated time — where clicking the tick lands the scrubber */
  readonly t: number;
  readonly s: number;
  readonly corner_id: string | null;
}

/** Which of 07 §3.3's six HUD groups a row belongs to, in table order. */
export const HUD_GROUPS = ["motion", "lean", "grip", "controls", "sight", "verdict"] as const;
export type HudGroup = (typeof HUD_GROUPS)[number];

/**
 * Where a HUD row's `value` came from. `instant` is the only origin that
 * touches a physics number, and `path` then names the exact member of the
 * `InstantState` it was READ from — the machine-checkable form of
 * `C-HUD-EQUALS-STATEAT` (07 §2.4: "a number on screen is the engine's number,
 * not the UI's reconstruction of it").
 */
export const HUD_ORIGINS = ["instant", "envelope", "profile"] as const;
export type HudOrigin = (typeof HUD_ORIGINS)[number];

export interface HudRow {
  readonly group: HudGroup;
  readonly label: string;
  /** the rendered string; unit formatting only (07 §2.4) */
  readonly text: string;
  /** the raw value, copied verbatim from `path` when `origin = "instant"` */
  readonly value: number | string | boolean | null;
  readonly origin: HudOrigin;
  /** dotted path into the `InstantState`, or null for non-instant origins */
  readonly path: string | null;
  /** 07 §3.3's badges/chips: rendered only when true */
  readonly badge?: "clip" | "deficit" | "stand_up";
}
