// render/markers.ts — the marker-from-event law + coincident collapse
// (design/06 §3.1 stage 9, D28). "A marker is the glyph of an event... a
// marker with no underlying event cannot exist."
//
// TWO functions, and the split is the letter's own:
//
//   `deriveMarkers` is the marker-from-event law. It reads `LineResult`
//   trajectories — station-indexed, view-blind — and yields one provisional
//   marker per enabled-class event. No `DrawnScene`, no `project()`.
//
//   `collapseCoincident` is the coincidence rule, and L404 opens it with the
//   words "AFTER PROJECTION". Its second tolerance is "one glyph radius" — a
//   draw-time quantity that does not exist until the projection has fixed the
//   viewBox — so it is a pure function OF that radius, called by the renderer
//   at stage 9 (render/topdown.ts's `stageMarkers`) where the radius and the
//   drawn positions are both already in scope. Nothing is threaded backwards:
//   the radius is derived from bounds that the marker set cannot move.
//
// Both live here so ARCHITECTURE §6.6's module map line — "markers.ts #
// marker-from-event law + coincident collapse" — stays true.
import { QUALITY_COLOUR, MARK_COINCIDE_EPS_M } from "./constants.js";
/** design/06 §3.1 stage 9's marker class table — source event kind, verbatim. No `facet` class: facets ARE `turn_in` events. */
const CLASS_EVENT = Object.freeze({
    turn_point: "turn_in",
    apex: "apex",
    exit: "exit",
    release: "release"
});
const ALL_CLASSES = ["turn_point", "apex", "exit", "release"];
/**
 * design/03 §8's `MarkSpec` (`auto|all|none|<class-list>`) resolved to the
 * enabled class set FOR ONE LINE. `auto` is not a synonym for `all`:
 * design/04 §7 spells it out — "`auto` (default) draws all classes on
 * `ideal`-role lines only". So a figure that authored no `marks:` at all (fig
 * 8.4 and 8.6) marks its ideal line and leaves every mistake/alternative/
 * reference line unmarked; a figure that authored a class list (fig 8.1–8.3's
 * `marks: turn_point`, fig 8.5's `marks: turn_point,apex`) or `all` marks
 * every line, whatever its role.
 *
 * The earlier reading — `auto` ≡ `all` — is what put a red `apex` ring on
 * fig-08-04's `overspeed` line at its very first metre (the J2 finding); the
 * ring was a real `apex` event, but `auto` never licensed drawing it.
 */
export function enabledClasses(spec, role) {
    if (spec === "none")
        return new Set();
    if (spec === "all")
        return new Set(ALL_CLASSES);
    if (spec === undefined || spec === "auto")
        return new Set(role === "ideal" ? ALL_CLASSES : []);
    return new Set(spec);
}
function nearestPoint(line, s) {
    let best = line.trajectory.samples[0];
    let bestGap = Infinity;
    for (const sample of line.trajectory.samples) {
        const gap = Math.abs(sample.s - s);
        if (gap < bestGap) {
            bestGap = gap;
            best = sample;
        }
    }
    return { x: best?.x ?? 0, y: best?.y ?? 0 };
}
function distance(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
}
/**
 * `deriveMarkers(lines, markSpec, lineMarks?) → DrawnMarker[]` — the
 * marker-from-event law (design/06 §3.1 stage 9, L388-389: "for each line, the
 * renderer draws one glyph per trajectory event whose kind maps to an enabled
 * marker class"). One provisional marker per event whose kind maps to a class
 * enabled for THAT line.
 *
 * TWO SCOPES resolve the enable set, because the design gives the MarkSpec two
 * — design/03 §8: "at figure **and per-line** scope"; design/04 §7: "at figure
 * level, **overridable per line with `marks=`**". `lineMarks` carries the
 * per-line overrides keyed by `line_id` (`plan/figure.ts`'s `lineMarksOf`); a
 * line with no entry falls back to the figure-level `markSpec`, and a figure
 * with neither falls back to `auto`. The override is a full replacement, not a
 * union: `marks=none` on one line of a `marks: all` figure silences exactly
 * that line, which is the whole point of a per-line scope.
 *
 * Role-scoping applies at BOTH levels — a per-line `auto` still means "all
 * classes on `ideal`-role lines only" (`enabledClasses`), so authoring `auto`
 * on a mistake line marks nothing rather than everything.
 *
 * NOT collapsed: coincidence is a post-projection step (`collapseCoincident`),
 * so what comes back here is exactly the event set — which is what makes
 * design/09 §5.4's `P-MARKS-EVENTS` ("drawn markers ↔ events bijection, no
 * eventless marker") hold on `DrawnScene.markers` with nothing subtracted.
 */
export function deriveMarkers(lines, markSpec, lineMarks) {
    const markers = [];
    for (const line of lines) {
        const enabled = enabledClasses(lineMarks?.get(line.line_id) ?? markSpec, line.role);
        const colour = QUALITY_COLOUR[line.verdict.quality];
        for (const cls of ALL_CLASSES) {
            if (!enabled.has(cls))
                continue;
            const kind = CLASS_EVENT[cls];
            for (const event of line.trajectory.events) {
                if (event.kind !== kind)
                    continue;
                markers.push({ cls, at: nearestPoint(line, event.s), s: event.s, colour, line_id: line.line_id });
            }
        }
    }
    return markers;
}
/**
 * `collapseCoincident(markers, glyphRadiusDrawn, rankOfLineId) → DrawnMarker[]`
 * — design/06 §3.1 stage 9, L404-406, verbatim:
 *
 *   "**Coincident collapse:** after projection, markers of the same class
 *    whose true stations lie within `MARK_COINCIDE_EPS_M = 1.0 m` (TUNING)
 *    **and** whose drawn positions overlap within one glyph radius collapse to
 *    one glyph, drawn in the colour of the owning line drawn last in role
 *    order (ideal wins ties) — deterministic, never a Z-fight. Markers of
 *    different classes never collapse."
 *
 * TWO tolerances, and only the first is `MARK_COINCIDE_EPS_M`. The second is
 * the glyph's own DRAWN radius, which is why the whole rule is scoped "after
 * projection": the radius is `pxScale × MARKER_R_PX` and exists only once the
 * viewBox is fixed. Callers pass it in rather than this file reaching for it —
 * `markers` are already drawn positions by then, and there is nothing here to
 * transform (design/06 §3.2's refusal list is about geometry transforms;
 * comparing two drawn distances is measurement).
 *
 * `rankOfLineId` is `roleRank` resolved through the drawn line roster, so the
 * tie-break reads the SAME draw order stage 8 used. An unknown `line_id`
 * ranks below every role rather than throwing — the renderer never throws.
 *
 * The pair test is evaluated against the SEED, not against any member already
 * absorbed: L404 states a pairwise relation between two markers, so a marker
 * that overlaps only some third marker must keep its own glyph. Growing the
 * cluster against `some(member)` instead let a marker in transitively, and
 * whether it got in depended on where the forward scan happened to be.
 */
export function collapseCoincident(markers, glyphRadiusDrawn, rankOfLineId) {
    const kept = [];
    const used = new Array(markers.length).fill(false);
    for (let i = 0; i < markers.length; i++) {
        if (used[i])
            continue;
        const seed = markers[i];
        used[i] = true;
        let winner = seed;
        for (let j = i + 1; j < markers.length; j++) {
            if (used[j])
                continue;
            const cand = markers[j];
            if (cand.cls !== seed.cls)
                continue; // "markers of different classes never collapse"
            if (Math.abs(seed.s - cand.s) > MARK_COINCIDE_EPS_M)
                continue; // true-station test
            if (distance(seed.at, cand.at) > glyphRadiusDrawn)
                continue; // drawn-position test
            used[j] = true;
            // "the colour of the owning line drawn last in role order (ideal wins
            // ties)" — `>=` keeps the LAST maximal rank, which is the one drawn last.
            if (rankOfLineId(cand.line_id) >= rankOfLineId(winner.line_id))
                winner = cand;
        }
        kept.push(winner);
    }
    return kept;
}
//# sourceMappingURL=markers.js.map