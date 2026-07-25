// viewer/pov.ts — the viewer's POV view (design/07 §5), a THIN consumer of the
// pure POV builder in render/pov.ts.
//
// C-POV-TRUE-GEOMETRY (design/09 L2027): the POV frame is a projection of TRUE
// geometry only, and the viewer's POV path MUST NOT reach the diagram-projection
// module (render/project.ts). This file imports `render/pov.js` DIRECTLY — never
// `render/index.js`, which composes a PROJECTED DrawnScene and pulls in
// `project.ts` — so this file's transitive import closure never touches
// `project.ts`. That is the structural half of the gate (asserted by
// test/viewer/pov.test.ts's closure scan); the behavioural half — the POV SVG is
// byte-identical across every projection setting — holds by construction because
// nothing on this path reads a ViewSpec projection field.
//
// C-POV-LIMIT-CONSISTENT (design/09 L2014): the camera reads `instant.sample`
// VERBATIM (the interpolated Sample `stateAt` returns), so the recorded
// `(limit_x, limit_y)` the topdown sight ray is drawn to is the SAME world point
// the POV limit marker consumes — never re-derived (07 §2.4, "the viewer never
// re-derives physics"). The trend badge is the recorded `sight_trend`.
import { ok, err } from "../core/result.js";
import { renderPov, renderPovForFigure, POV_LOOK_MODES } from "../render/pov.js";
export { POV_LOOK_MODES } from "../render/pov.js";
/**
 * Parse a `look` request value against the closed set (design/07 §5.2, D8):
 * `heading` is the default; an unknown value is `SCHEMA` (NOT `deferred` — the
 * `look` toggle SHIPS in v0.3, so its violation is a plain closed-set refusal).
 */
export function parsePovLook(look) {
    if (look === undefined)
        return ok("heading");
    if (POV_LOOK_MODES.includes(look))
        return ok(look);
    return err({
        code: "SCHEMA",
        at: "look",
        message: `unknown look "${look}" — the POV camera offers ${POV_LOOK_MODES.join(", ")}`,
        detail: { reason: "unknown_look", look }
    });
}
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
export function renderPovView(road, line, instant, look) {
    if (instant === null)
        return renderPovForFigure(road, [line], look);
    const occluders = line.resolved_scenario.occluders ?? [];
    return renderPov({ road, occluders, line, sample: instant.sample, look, trend: instant.derived.sight_trend });
}
//# sourceMappingURL=pov.js.map