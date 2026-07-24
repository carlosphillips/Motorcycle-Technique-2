import type { LineResult } from "../solve/types.js";
import type { FigureRole, MarkClass, MarkSpec } from "../plan/types.js";
import type { DrawnMarker } from "./scene.js";
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
export declare function enabledClasses(spec: MarkSpec | undefined, role: FigureRole): ReadonlySet<MarkClass>;
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
export declare function deriveMarkers(lines: readonly LineResult[], markSpec: MarkSpec | undefined): readonly DrawnMarker[];
