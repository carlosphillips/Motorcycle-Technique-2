import type { LineResult } from "../solve/types.js";
import type { FigureRole, MarkClass, MarkSpec } from "../plan/types.js";
import type { DrawnMarker } from "./scene.js";
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
export declare function enabledClasses(spec: MarkSpec | undefined, role: FigureRole): ReadonlySet<MarkClass>;
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
export declare function deriveMarkers(lines: readonly LineResult[], markSpec: MarkSpec | undefined, lineMarks?: ReadonlyMap<string, MarkSpec>): readonly DrawnMarker[];
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
export declare function collapseCoincident(markers: readonly DrawnMarker[], glyphRadiusDrawn: number, rankOfLineId: (line_id: string) => number): readonly DrawnMarker[];
