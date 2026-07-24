// render/markers.ts — the marker-from-event law + coincident collapse
// (design/06 §3.1 stage 9, D28). "A marker is the glyph of an event... a
// marker with no underlying event cannot exist." Operates directly on
// `LineResult` trajectories: in v0.1 true mode, drawn position IS world
// position (`Sample.x, .y` — the projection is identity, ARCHITECTURE §6.5),
// so this file needs no `DrawnScene` coupling and no `project()` call.
import { QUALITY_COLOUR, MARK_COINCIDE_EPS_M } from "./constants.js";
import { roleRank } from "./ink.js";
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
 * 8.4, 8.5, 8.6) marks its ideal line and leaves every mistake/alternative/
 * reference line unmarked; a figure that authored a class list (fig 8.1–8.3's
 * `marks: turn_point`) or `all` marks every line, whatever its role.
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
 * `deriveMarkers(lines, markSpec) → DrawnMarker[]` (design/06 §3.1 stage 9).
 * One glyph per trajectory event whose kind maps to a class enabled for THAT
 * line (the enable set is per-line — `auto` is role-scoped, see
 * `enabledClasses`); markers
 * of the SAME class whose true stations lie within `MARK_COINCIDE_EPS_M` AND
 * whose drawn positions lie within the same tolerance (v0.1's stand-in for
 * "one glyph radius" — no px scale is threaded to this file by design;
 * recorded as a deviation) collapse to one glyph, coloured by the line drawn
 * LAST in role order (ideal wins ties) — deterministic, never a Z-fight.
 * Markers of different classes never collapse.
 */
export function deriveMarkers(lines, markSpec) {
    const provisional = [];
    for (const line of lines) {
        const enabled = enabledClasses(markSpec, line.role);
        const colour = QUALITY_COLOUR[line.verdict.quality];
        const rank = roleRank(line.role);
        for (const cls of ALL_CLASSES) {
            if (!enabled.has(cls))
                continue;
            const kind = CLASS_EVENT[cls];
            for (const event of line.trajectory.events) {
                if (event.kind !== kind)
                    continue;
                provisional.push({ cls, at: nearestPoint(line, event.s), s: event.s, colour, line_id: line.line_id, rank });
            }
        }
    }
    const collapsed = [];
    const used = new Array(provisional.length).fill(false);
    for (let i = 0; i < provisional.length; i++) {
        if (used[i])
            continue;
        const cluster = [provisional[i]];
        used[i] = true;
        for (let j = i + 1; j < provisional.length; j++) {
            if (used[j])
                continue;
            const cand = provisional[j];
            if (cand.cls !== cluster[0].cls)
                continue;
            const coincides = cluster.some((m) => Math.abs(m.s - cand.s) <= MARK_COINCIDE_EPS_M && distance(m.at, cand.at) <= MARK_COINCIDE_EPS_M);
            if (coincides) {
                cluster.push(cand);
                used[j] = true;
            }
        }
        const winner = cluster.reduce((a, b) => (b.rank >= a.rank ? b : a));
        collapsed.push({ cls: winner.cls, at: winner.at, s: winner.s, colour: winner.colour, line_id: winner.line_id });
    }
    return collapsed;
}
//# sourceMappingURL=markers.js.map