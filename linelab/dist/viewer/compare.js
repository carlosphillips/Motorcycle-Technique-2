// viewer/compare.ts — compare-mode multi-line stepping (design/07 §4, §5.6).
//
// A result envelope carries N lines (05 §7); compare mode steps them together.
// Two lock modes govern "together" (07 §4.1):
//   · `station` (default) — all lines share a road station `s`; each line's HUD
//     state is `stateAt(line, {s})`. The doctrinal comparison: at the same
//     station two lines differ in lateral position, lean, speed, grip and sight.
//   · `time` — all lines share an elapsed `t` (a ghost race); the temporal
//     cost/benefit station-lock hides.
//
// C-COMPARE (design/09 L2005): "in compare mode each line's ghost state equals
// its OWN `stateAt`; lines never share or leak state." That holds BY
// CONSTRUCTION here — every ghost's `instant` is `stateAt(THAT line's own input,
// {lock coord})`, the same one arithmetic surface the HUD (viewer/hud.ts) and
// the `compare` verb (cli/verbs/compare.ts) use (07 §2.4, C-ONE-CORE). There is
// no second interpolation rule and no shared cursor: each line is queried
// independently at the shared lock coordinate and each `InstantState` is a fresh
// frozen object, so swapping two lines' states is observable and mutating one
// never moves another. The shared coordinate is the FOCUSED line's own `s`/`t`
// at the cursor; every other line is read at that coordinate, clamped into its
// OWN domain so a line that ended early freezes at its terminal sample
// (07 §3.4), exactly as the focused HUD does.
import { stateAt } from "../core/stateAt.js";
import { stateInputFor } from "./session.js";
import { domainOf } from "./stepper.js";
import { placeGlyph, glyphSvg } from "./glyph.js";
import { COMPARE_GHOST_OPACITY } from "./constants.js";
/** design/07 §4.1 — the shared lock axis: station `s` (default) or elapsed `t`. */
export function lockAxisOf(lock) {
    return lock === "station" ? "s" : "t";
}
function clamp(v, lo, hi) {
    return v < lo ? lo : v > hi ? hi : v;
}
/** THIS line's own instant at the shared lock coordinate, clamped to its domain (07 §3.4). */
function ghostAt(session, line, axis, coord) {
    const own = domainOf(line, axis);
    const at = clamp(coord, own.min, own.max);
    const frozen = coord < own.min || coord > own.max;
    // the ONE arithmetic surface (07 §2.4) — this line's own trajectory/plan/road
    const resolved = stateAt(stateInputFor(session, line), axis === "s" ? { s: at } : { t: at });
    return { instant: resolved.ok ? resolved.value : null, at, frozen };
}
/**
 * `compareModel(session, focusInstant, lock)` — the compare picture at one
 * cursor. `focusInstant` is the FOCUSED line's own instant at the cursor
 * (already domain-clamped by the caller); the shared coordinate is that
 * instant's `s` (station lock) or `t` (time lock). Every line — the focused one
 * included, so the model is a complete picture — is then read at that
 * coordinate through its OWN `stateAt` (C-COMPARE: no shared or leaked state).
 */
export function compareModel(session, focusInstant, lock) {
    const axis = lockAxisOf(lock);
    const lock_coord = axis === "s" ? focusInstant.sample.s : focusInstant.sample.t;
    const ghosts = session.lines.map((line) => {
        const g = ghostAt(session, line, axis, lock_coord);
        return Object.freeze({
            line_id: line.line_id,
            role: line.role,
            quality: line.verdict.quality,
            outcome: line.verdict.outcome,
            focused: line.line_id === session.focus,
            instant: g.instant,
            at: g.at,
            frozen: g.frozen
        });
    });
    return Object.freeze({ lock, lock_axis: axis, lock_coord, ghosts });
}
/**
 * Ghost-glyph overlay for the NON-focused lines (07 §4.2: "ghost glyphs, reduced
 * opacity, verdict colour retained, on the topdown"). The focused line keeps its
 * own full-opacity cursor glyph (viewer/glyph.ts); these are the others, each at
 * its OWN position at the shared lock coordinate. Empty string when the session
 * has one drawable line (no one to compare against) — so a single-line topdown
 * is byte-identical to the v0.2 picture.
 *
 * Colour is `placeGlyph`'s own `QUALITY_COLOUR[verdict.quality]` (D9), reduced
 * only in OPACITY by a wrapping `<g>` — no line ink is modulated (D9 holds).
 */
export function compareGhostsSvg(session, model, scene) {
    let out = "";
    for (const g of model.ghosts) {
        if (g.focused || g.instant === null)
            continue;
        const line = session.lines.find((l) => l.line_id === g.line_id);
        if (line === undefined)
            continue;
        const placement = placeGlyph(g.instant, line, scene);
        out += `<g data-overlay="ghost-glyph" data-line="${g.line_id}" opacity="${COMPARE_GHOST_OPACITY}">${glyphSvg(placement)}</g>`;
    }
    return out;
}
//# sourceMappingURL=compare.js.map