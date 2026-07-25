// viewer/correctiveGhost.ts — the corrective ghost OVERLAY (design/07 §3.5).
//
// "The stepper offers a corrective ghost TOGGLE (off by default): when enabled,
// the viewer recomputes the shadow via the pure core function
// `correctiveShot(lineResult)` (08 §7.1) — a §2.4-legal call, the engine's own
// counterfactual, never a UI reconstruction — and draws it from the
// `correction` bookmark onward as a ghost overlay … at ghost opacity and
// visually distinct from compare-mode ghosts (it is a counterfactual, not a
// line of the figure)."
//
// This file is a pure READER of the one corrective library (solve/corrective.ts,
// the SAME function verdict assembly and the CLI use — C-ONE-CORE): it never
// steps physics and never re-derives the shadow, it computes the once-per-toggle
// object and projects its vertices. There is exactly one shadow harness in the
// tree (core/integrate via counterfactual); nothing here adds a second.
//
//   · On a `wide` corner the ghost is the SAVE — roll to reserve, back inside
//     the corridor at `corrective.returned.s`.
//   · On a `runoff` corner whose shot integrated, it is the FAILED ATTEMPT run
//     to its own termination — `fail_reason` made visible.
//   · When `corrective` is null, or the shot never became integrable
//     (`fail_reason = "departed_before_reaction"`, so `shadow` is null), there
//     is no shadow and the toggle is INERT for that line — this reader returns
//     `ok(null)`.
//
// THE GHOST IS CLIPPED AT THE SHADOW'S RETURN STATION s* IN BOTH CASES (07 §3.5,
// 04 §4b.4): "the shadow is a probe over a bounded horizon, and the design
// asserts nothing about the constant-`phiReserve` arc past the return, so
// drawing it would be drawing unspecified output." `correctiveShot` returns the
// shadow UNCLIPPED (it runs to its own termination so the runoff case can be
// drawn); this file clips the saved case at s* and leaves the runoff case at its
// termination station. `C-SAVEWIN-CLIP` is a walk over the drawn vertices: the
// last one is s* (or the termination station), never past it.
//
// "The ghost's legend carries 04 §4c.7's lean-only disclosure sentence
// verbatim." That is `CORRECTIVE_DISCLOSURE` (= `CF_DISCLOSURE_LEAN_ONLY`),
// re-exported from solve/corrective.ts and carried on the overlay object here.
//
// D9/D18: NO LINE INK IS MODULATED and NO EXPORTED FIGURE CHANGES — the ghost is
// stepper-only, neutral ink at ghost opacity, and `render/` has no import path
// to this module (C-SAVEWIN-NO-INK's structural arm).
import { ok } from "../core/result.js";
import { CORRECTIVE_DISCLOSURE, correctiveShot, wideVsRunoff } from "../solve/corrective.js";
import { rotatePoint } from "../render/project.js";
import { CORRECTIVE_GHOST_INK, CORRECTIVE_GHOST_OPACITY } from "./constants.js";
function inputOf(line) {
    return { trajectory: line.trajectory, resolved_scenario: line.resolved_scenario };
}
/**
 * Clip a shadow document at the first retained sample at or past `s_star`
 * (04 §4b.4 — the identical rule solve/saveWindow.ts's clipAtStar applies to the
 * save-window probe; the corrective shadow arrives here UNCLIPPED because the
 * runoff branch needs the full run to its termination). At exactly the launch
 * station the clip can leave a single retained sample — the clip is still the
 * thing under test.
 */
function clipAtStar(samples, s_star) {
    for (let i = 0; i < samples.length; i++) {
        if (samples[i].s >= s_star - 1e-9)
            return samples.slice(0, i + 1);
    }
    return samples;
}
/**
 * `correctiveGhostOverlay(line, scene?)` — the once-per-toggle computation.
 *
 * `scene` is the top-down projection the ghost rides on; when given, each drawn
 * vertex is mapped through the SAME §2.4 rigid rotation (`scene.pivot`,
 * `scene.orient`) the road/lines went through, so the overlay needs no second
 * copy of render/'s frame math (the seam viewer/glyph.ts and viewer/saveWindow.ts
 * already use). Without it the path is raw world metres — what a headless caller
 * asserting the clip wants.
 *
 * Returns `ok(null)` when the toggle is inert for this line (no `corrective`, or
 * the shot departed before reaction so there is no shadow).
 */
export function correctiveGhostOverlay(line, scene) {
    const shot = correctiveShot(inputOf(line));
    if (!shot.ok)
        return shot;
    const { corrective, shadow } = shot.value;
    // toggle inert: no corner ran wide, or the shot never became integrable
    if (corrective === null || shadow === null)
        return ok(null);
    // s* : the return station on a feasible save, else the shadow's own
    // termination — "s* (or its termination station)" (C-SAVEWIN-CLIP)
    const s_star_m = corrective.feasible && corrective.returned !== null ? corrective.returned.s : shadow.terminated.s;
    const clipped = clipAtStar(shadow.samples, s_star_m);
    const path = clipped.map((p) => {
        if (scene === undefined)
            return { x: p.x, y: p.y };
        const r = rotatePoint({ x: p.x, y: p.y }, scene.pivot.x, scene.pivot.y, scene.orient);
        return { x: r.x, y: r.y };
    });
    const first = clipped[0];
    const last = clipped[clipped.length - 1];
    // the corner the shot was attributed to — the `correction` event's corner_id
    // (04 §4a.2's attribution, minted by correctiveShot; one event source, 05 §5)
    const correction = shot.value.events.find((e) => e.kind === "correction");
    return ok(Object.freeze({
        line_id: line.line_id,
        corner_id: correction?.corner_id ?? "",
        kind: wideVsRunoff(corrective.feasible),
        s_star_m,
        path: Object.freeze(path),
        last_vertex_s: last === undefined ? Number.NaN : last.s,
        from_s: first === undefined ? Number.NaN : first.s,
        disclosure: CORRECTIVE_DISCLOSURE
    }));
}
/**
 * The overlay `<g>`: the clipped ghost polyline at ghost opacity, neutral ink.
 * Appended to the top-down exactly as viewer/glyph.ts and viewer/saveWindow.ts
 * are — no road/line/marker is redrawn, D9's colour law is untouched. The
 * disclosure rides in a `<title>` so the legend obligation is discharged on the
 * drawing itself (07 §3.5).
 */
export function correctiveGhostSvg(overlay) {
    if (overlay === null || overlay.path.length === 0)
        return "";
    const num = (n) => String(Number(n.toFixed(4)));
    let out = `<g data-overlay="corrective-ghost" data-line="${overlay.line_id}" ` +
        `data-corner="${overlay.corner_id}" data-kind="${overlay.kind}" ` +
        `data-s-star-m="${num(overlay.s_star_m)}" data-last-vertex-s="${num(overlay.last_vertex_s)}" ` +
        `opacity="${CORRECTIVE_GHOST_OPACITY}">`;
    out += `<title>${overlay.disclosure}</title>`;
    if (overlay.path.length > 1) {
        out +=
            `<polyline data-overlay="corrective-ghost-stroke" ` +
                `points="${overlay.path.map((p) => `${num(p.x)},${num(p.y)}`).join(" ")}" ` +
                // dashed + neutral: distinct from the verdict-coloured line stroke AND from
                // the save-window overlay's dash; a counterfactual, not a line of the figure
                `fill="none" stroke="${CORRECTIVE_GHOST_INK}" stroke-width="0.14" stroke-dasharray="0.9 0.6"/>`;
    }
    out += "</g>";
    return out;
}
//# sourceMappingURL=correctiveGhost.js.map