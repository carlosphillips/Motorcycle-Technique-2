import type { ComposedRoad } from "../road/types.js";
import type { LineResult } from "../solve/types.js";
import type { InstantState } from "../core/types.js";
import type { Result } from "../core/result.js";
import { type PovLook } from "../render/pov.js";
export type { PovLook } from "../render/pov.js";
export { POV_LOOK_MODES } from "../render/pov.js";
/**
 * Parse a `look` request value against the closed set (design/07 §5.2, D8):
 * `heading` is the default; an unknown value is `SCHEMA` (NOT `deferred` — the
 * `look` toggle SHIPS in v0.3, so its violation is a plain closed-set refusal).
 */
export declare function parsePovLook(look: string | undefined): Result<PovLook>;
/**
 * The POV SVG for one focused line at one cursor instant.
 *
 * - `instant` present → the camera pose and the recorded limit point come from
 *   `instant.sample` (the `stateAt` output the HUD also reads); the trend badge
 *   is `instant.derived.sight_trend`.
 * - `instant` null (a static boot with no cursor) → render/pov.ts's own
 *   figure-level default (focus line + mid-corner cursor) is used.
 *
 * Never throws — `renderPov`'s catch-all returns a `fallbackSvg` on any failure.
 */
export declare function renderPovView(road: ComposedRoad, line: LineResult, instant: InstantState | null, look: PovLook): string;
