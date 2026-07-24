// render/gateProportions.ts — the proportion gate (design/06 §6). A
// mechanical check that a figure actually lands in the book's measured
// proportion band; exists because "the stretched-figure defect class was
// invisible to a regime that only checked 'renders'" (06 §6 intro).
//
// `gateProportions(metrics) → {verdict, findings}` stays PURE over the four
// metrics (ARCHITECTURE §5's pinned signature) — mode-based exemption
// (`mode: "true"` renders are exempt, §6.2) is therefore a CALLER policy, not
// this function's: v0.1's true-mode exports always compute real (poor)
// metrics here (a true 3.5 m lane on an R45 corner reads far outside
// `width_ratio`'s book band — that IS the ~8–10× gap 06 §1 documents), and
// the exemption is applied wherever the exit-code tier is decided (cli/, 08 —
// not built by this package).
import { WIDTH_RATIO_BAND, STRAIGHT_SHARE_MAX, ROAD_INK_BAND, FRAME_ASPECT_BAND } from "./constants.js";
/**
 * design/06 §6.2: "fail outside hard bounds... warn in the margin zones."
 * §6.1's table gives exactly ONE band per metric (no separate warn/fail
 * thresholds) — the margin-zone width is this package's own judgment call,
 * recorded here and in its returned deviations: a value outside the band by
 * up to `WARN_MARGIN_FRAC` of the band's own span warns; further out fails.
 */
const WARN_MARGIN_FRAC = 0.15;
function twoSided(value, band) {
    if (value >= band.min && value <= band.max)
        return null;
    const span = band.max - band.min;
    const margin = span * WARN_MARGIN_FRAC;
    if (value >= band.min - margin && value <= band.max + margin)
        return { severity: "warn" };
    return { severity: "fail" };
}
function oneSidedMax(value, max) {
    if (value <= max)
        return null;
    const margin = max * WARN_MARGIN_FRAC;
    if (value <= max + margin)
        return { severity: "warn" };
    return { severity: "fail" };
}
const SEVERITY_RANK = { pass: 0, warn: 1, fail: 2 };
/**
 * `gateProportions(metrics) → {verdict, findings}` (design/06 §6.2). Total,
 * pure. `verdict` is the worst-of across all four metrics (any per-corner
 * `width_ratio` miss included); `findings` names every out-of-band metric.
 */
export function gateProportions(metrics) {
    const findings = [];
    for (const row of metrics.width_ratio) {
        const hit = twoSided(row.value, WIDTH_RATIO_BAND);
        if (hit !== null) {
            findings.push({
                metric: "width_ratio",
                corner_id: row.corner_id,
                value: row.value,
                band: WIDTH_RATIO_BAND,
                severity: hit.severity
            });
        }
    }
    const straightHit = oneSidedMax(metrics.straight_share, STRAIGHT_SHARE_MAX);
    if (straightHit !== null) {
        findings.push({
            metric: "straight_share",
            value: metrics.straight_share,
            band: { max: STRAIGHT_SHARE_MAX },
            severity: straightHit.severity
        });
    }
    const roadInkHit = twoSided(metrics.road_ink, ROAD_INK_BAND);
    if (roadInkHit !== null) {
        findings.push({ metric: "road_ink", value: metrics.road_ink, band: ROAD_INK_BAND, severity: roadInkHit.severity });
    }
    const aspectHit = twoSided(metrics.frame_aspect, FRAME_ASPECT_BAND);
    if (aspectHit !== null) {
        findings.push({
            metric: "frame_aspect",
            value: metrics.frame_aspect,
            band: FRAME_ASPECT_BAND,
            severity: aspectHit.severity
        });
    }
    const verdict = findings.reduce((worst, f) => (SEVERITY_RANK[f.severity] > SEVERITY_RANK[worst] ? f.severity : worst), "pass");
    return { verdict, findings };
}
// ---------------------------------------------------------------------------
// Metric computation FROM a DrawnScene (design/06 §6.1's four definitions),
// recomputable from the SVG per §6 — this is the DrawnScene-side computation
// the export/CLI path (not this package) feeds into `gateProportions` above.
function polygonArea(points) {
    let area = 0;
    for (let i = 0; i < points.length; i++) {
        const a = points[i];
        const b = points[(i + 1) % points.length];
        area += a.x * b.y - b.x * a.y;
    }
    return Math.abs(area) / 2;
}
function polylineLength(points) {
    let len = 0;
    for (let i = 1; i < points.length; i++) {
        len += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
    }
    return len;
}
/**
 * `computeProportionMetrics(scene, corners, straightLenInWindow)` — the
 * DrawnScene-side reading of §6.1's four definitions. `corners`/
 * `straightLenInWindow` come from the composed road (not carried on
 * `DrawnScene`, which is drawn-geometry-only) — callers with a `ComposedRoad`
 * pass its `corners` and the summed straight-segment length inside the drawn
 * window directly.
 */
export function computeProportionMetrics(scene, corners, straightLenInWindowM) {
    const roadWidth = 2 * scene.road.lane_width_m; // physical carriageway width, true mode (width_exag = 1)
    const width_ratio = corners.map((c) => ({ corner_id: c.id, value: roadWidth / c.r }));
    const centreLen = polylineLength(scene.road.centre);
    const straight_share = centreLen > 0 ? straightLenInWindowM / centreLen : 0;
    const roadPolygon = [...scene.road.left, ...[...scene.road.right].reverse()];
    const frameArea = scene.frame.width * scene.frame.height;
    const road_ink = frameArea > 0 ? polygonArea(roadPolygon) / frameArea : 0;
    const frame_aspect = scene.frame.height > 0 ? scene.frame.width / scene.frame.height : 0;
    return { width_ratio, straight_share, road_ink, frame_aspect };
}
//# sourceMappingURL=gateProportions.js.map