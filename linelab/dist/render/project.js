// render/project.ts — `project(road, lines, viewSpec) → Result<DrawnScene>`
// (design/06 §2, ARCHITECTURE §5/§6.5). v0.1 surface exactly: identity
// transform + auto-window (§2.4) + explicit-window crop + orient (auto→0 in
// true mode; explicit 0/90/180/270 honored) + aspect-floor padding — NO
// compression/width_exag/degradation machinery (ARCHITECTURE §6.5). This file
// OWNS ViewSpec validation: values arrive as an opaque `unknown` (plan/'s
// `Figure.view` field is untyped by design — plan never imports render,
// ARCHITECTURE §4) and are typed here, with `SCHEMA`/`deferred` rejections
// exactly where §6.4's phase-gating table says so.
//
// `road` is typed `ComposedRoad` (road/types.ts), not the narrower `RoadModel`
// solve/types.ts pins on `FigureResult.road`: this package needs `worldAt`
// (station+offset → world xy) to place road edges/occluder anchors, which only
// the concrete `compose()` output — always a `ComposedRoad` at runtime —
// carries. Recorded as a deviation (no invariant conflict: same runtime value,
// a more precise parameter type for render's own internal use).
import { ok, err } from "../core/result.js";
import { resolveAnchor } from "../plan/anchors.js";
import { footprintsOf } from "../sight/footprints.js";
import { governingCorner, sideSign, corridorEdgeOffsets, NO_CORNER_FRAME_HAND } from "../road/corridor.js";
import { msToKmh } from "../core/units.js";
import { terminalGlyphFor, roleRank } from "./ink.js";
import { buildLegend } from "./legend.js";
import { QUALITY_COLOUR, WINDOW_LEAD_M, WINDOW_TAIL_M, ASPECT_FLOOR_MIN, ASPECT_FLOOR_MAX, GRAVEL_STIPPLE_SPACING_M } from "./constants.js";
/** `project()`'s optional trailing input: the figure-authoring data (labels/marks) that don't fit the pinned 3-name `(road, lines, viewSpec)` signature — see the file banner + this package's returned deviations. Unused by `project()` itself; threaded through only so callers have one place to reach for it. Reserved for render/index.ts's composition, not consumed here. */
function schemaErr(at, message, reason, extra) {
    return { code: "SCHEMA", at, message, detail: { reason, ...extra } };
}
function deferredErr(at, message, deferred, schema_ref) {
    return { code: "SCHEMA", at, message, schema_ref, deferred, detail: { reason: "deferred" } };
}
function badRange(at, message, reason, extra) {
    return { code: "BAD_RANGE", at, message, detail: { reason, ...extra } };
}
function isObject(v) {
    return typeof v === "object" && v !== null && !Array.isArray(v);
}
function isStationRef(v) {
    if (!isObject(v))
        return false;
    if (typeof v["at_s"] === "number")
        return true;
    if (typeof v["ref"] === "string") {
        return v["offset_m"] === undefined || typeof v["offset_m"] === "number";
    }
    return false;
}
const ORIENT_NUMERIC = new Set([0, 90, 180, 270]);
/** Validates the opaque `view:` value (design/06 §2.1) into the v0.1-legal request, typed-`SCHEMA`/`deferred` per §6.4's table. */
function parseViewSpec(raw) {
    if (raw === undefined || raw === null) {
        return ok({ window: "auto", orient: "auto", rays: "auto", legend: "auto", consequence: false });
    }
    if (!isObject(raw))
        return err(schemaErr("view", "view must be a JSON object", "type_mismatch"));
    if (raw["mode"] !== undefined && raw["mode"] !== "true") {
        if (raw["mode"] === "diagram") {
            return err(deferredErr("view.mode", 'view.mode = "diagram" is not shipped yet', "projection (post-v0.1)", "view"));
        }
        return err(schemaErr("view.mode", 'view.mode must be "true"', "type_mismatch"));
    }
    for (const deferredKey of ["width_exag", "straight_compress", "taper_compress"]) {
        if (raw[deferredKey] !== undefined) {
            return err(deferredErr(`view.${deferredKey}`, `view.${deferredKey} is not shipped yet`, "projection (post-v0.1)", "view"));
        }
    }
    if (raw["fan"] !== undefined) {
        return err(deferredErr("view.fan", "view.fan is not shipped yet", "continuation envelope (D45)", "view"));
    }
    let orient = "auto";
    if (raw["orient"] !== undefined) {
        // scene-lowered `view:` values arrive as OPAQUE STRINGS (ARCHITECTURE §4:
        // plan/scene.ts passes them through; THIS validator owns them) — so the
        // canonical numeric spellings are legal as their exact string forms too
        // (fig-08-06's committed `orient=90` bakes through this arm; WP-17 fix).
        const o = typeof raw["orient"] === "string" && ["0", "90", "180", "270"].includes(raw["orient"]) ? Number(raw["orient"]) : raw["orient"];
        if (o === "auto")
            orient = "auto";
        else if (typeof o === "number" && ORIENT_NUMERIC.has(o))
            orient = o;
        else {
            // design/06 §2.1/D26: orient rotates but never reflects — a mirror/flip
            // request (any other spelling, since the closed set is exactly
            // {auto,0,90,180,270}) is the one named SCHEMA case this doc defines.
            return err(schemaErr("view.orient", `view.orient must be "auto" or one of 0/90/180/270 — mirroring is not a view operation, handedness is set on the road (see "road ... hand=")`, "no_view_mirror"));
        }
    }
    let windowReq = "auto";
    if (raw["window"] !== undefined) {
        const w = raw["window"];
        if (w === "auto" || w === "all")
            windowReq = w;
        else if (isObject(w) && isStationRef(w["from"]) && isStationRef(w["to"])) {
            windowReq = { from: w["from"], to: w["to"] };
        }
        else {
            return err(schemaErr("view.window", 'view.window must be "auto", "all", or {from, to}', "type_mismatch"));
        }
    }
    let rays = "auto";
    if (raw["rays"] !== undefined) {
        const r = raw["rays"];
        if (r !== "auto" && r !== "off" && r !== "all_turn_ins") {
            return err(schemaErr("view.rays", 'view.rays must be "auto", "off", or "all_turn_ins"', "type_mismatch"));
        }
        rays = r;
    }
    let legend = "auto";
    if (raw["legend"] !== undefined) {
        const l = raw["legend"];
        if (l !== "auto" && l !== "on" && l !== "off") {
            return err(schemaErr("view.legend", 'view.legend must be "auto", "on", or "off"', "type_mismatch"));
        }
        legend = l;
    }
    if (raw["look"] !== undefined && raw["look"] !== "heading" && raw["look"] !== "limit_point") {
        return err(schemaErr("view.look", 'view.look must be "heading" or "limit_point"', "type_mismatch"));
    }
    // scene-lowered values arrive as opaque strings, so `on`/`off` are the
    // spelling; booleans are accepted for JSON-spelled FigureSpecs.
    let consequence = false;
    if (raw["consequence"] !== undefined) {
        const c = raw["consequence"];
        if (c === "on" || c === true)
            consequence = true;
        else if (c === "off" || c === false)
            consequence = false;
        else
            return err(schemaErr("view.consequence", 'view.consequence must be "on" or "off"', "type_mismatch"));
    }
    return ok({ window: windowReq, orient, rays, legend, consequence });
}
// ---------------------------------------------------------------------------
// §2.4 step 5 — auto-window (applies in true metres regardless of mode: the
// projection's s′(s) is identity in v0.1, so "true metres" IS drawn space).
function startAnchorS(line) {
    let best = null;
    for (const e of line.trajectory.events) {
        if (e.kind === "turn_in" || e.kind === "brake_start" || e.kind === "position_start") {
            if (best === null || e.s < best)
                best = e.s;
        }
    }
    if (best !== null)
        return best;
    return line.trajectory.samples[0]?.s ?? 0;
}
function endAnchorS(line) {
    let best = null;
    for (const e of line.trajectory.events) {
        if (e.kind === "exit") {
            if (best === null || e.s > best)
                best = e.s;
        }
    }
    // `terminated.s` is always present (every Trajectory ends in one, core/types.ts)
    // and covers both the design's explicit fallback (crash/off_road/stopped) and
    // its "else last sample" arm (road_end/guards land at the same station).
    return best ?? line.trajectory.terminated.s;
}
function autoWindow(lines, roadLen) {
    if (lines.length === 0)
        return { from_s: 0, to_s: roadLen };
    let from = Math.min(...lines.map(startAnchorS)) - WINDOW_LEAD_M;
    let to = Math.max(...lines.map(endAnchorS)) + WINDOW_TAIL_M;
    from = Math.min(Math.max(from, 0), roadLen);
    to = Math.min(Math.max(to, 0), roadLen);
    return { from_s: from, to_s: to };
}
function resolveWindow(req, lines, road) {
    if (req === "auto")
        return ok(autoWindow(lines, road.total_len_m));
    if (req === "all")
        return ok({ from_s: 0, to_s: road.total_len_m });
    const from = resolveAnchor(req.from, road.corners, "view.window.from");
    if (!from.ok)
        return from;
    const to = resolveAnchor(req.to, road.corners, "view.window.to");
    if (!to.ok)
        return to;
    if (!(from.value < to.value)) {
        return err(badRange("view.window", "window.from must be strictly before window.to", "window_empty_or_inverted", {
            from_s: from.value,
            to_s: to.value
        }));
    }
    return ok({ from_s: from.value, to_s: to.value });
}
// ---------------------------------------------------------------------------
// §2.4 step 6 — orient resolution (ARCHITECTURE §6.5: "auto→0 in true mode;
// explicit 0/90/180/270 honored" — no elongation heuristic runs in true mode).
function resolveOrient(req) {
    return req === "auto" ? 0 : req;
}
/** The §2.4 orient rotation — exported so render/index.ts maps marker/label anchor points through the SAME rigid isometry (scene.pivot + scene.orient). */
export function rotatePoint(p, cx, cy, deg) {
    if (deg === 0)
        return p;
    const rad = (deg * Math.PI) / 180;
    const dx = p.x - cx;
    const dy = p.y - cy;
    return {
        x: cx + dx * Math.cos(rad) - dy * Math.sin(rad),
        y: cy + dx * Math.sin(rad) + dy * Math.cos(rad)
    };
}
// ---------------------------------------------------------------------------
// §2.4 step 7 — aspect-floor padding (reuses the proportion gate's own
// frame_aspect band, "no new constants").
function boundingBox(points) {
    if (points.length === 0)
        return { minX: 0, minY: 0, maxX: 1, maxY: 1 };
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const p of points) {
        if (p.x < minX)
            minX = p.x;
        if (p.y < minY)
            minY = p.y;
        if (p.x > maxX)
            maxX = p.x;
        if (p.y > maxY)
            maxY = p.y;
    }
    return { minX, minY, maxX, maxY };
}
function paddedFrame(box) {
    let width = Math.max(box.maxX - box.minX, 1e-6);
    let height = Math.max(box.maxY - box.minY, 1e-6);
    const aspect = width / height;
    if (aspect < ASPECT_FLOOR_MIN) {
        width = height * ASPECT_FLOOR_MIN;
    }
    else if (aspect > ASPECT_FLOOR_MAX) {
        height = width / ASPECT_FLOOR_MAX;
    }
    return { width, height };
}
// ---------------------------------------------------------------------------
// Line / road / occluder geometry builders
const EDGE_STEP_M = 2.0; // local rendering resolution, not a design TUNING literal
function clippedSamples(samples, from_s, to_s) {
    return samples.filter((s) => s.s >= from_s && s.s <= to_s);
}
/** design/06 §3.1 stage 7: the default sight ray anchors at the line's FIRST `turn_in` event (never all of them). */
function defaultSightRay(line, colour) {
    const firstTurnIn = line.trajectory.events.filter((e) => e.kind === "turn_in").sort((a, b) => a.s - b.s)[0];
    if (firstTurnIn === undefined)
        return null;
    const sample = nearestSample(line.trajectory.samples, firstTurnIn.s);
    if (sample === undefined)
        return null;
    // sight/cast.ts's `SightCast.s_limit` recomputed from the recorded per-sample
    // channel (`s + sight_m`, the same reading sight/analyze.ts uses) — stage 6's
    // occlusion wash needs this station, not just the limit point's (x, y).
    return {
        from: { x: sample.x, y: sample.y },
        to: { x: sample.limit_x, y: sample.limit_y },
        colour,
        s_limit: sample.s + sample.sight_m
    };
}
/**
 * design/06 §3.1 stage 6: the occluded-region wash — the road strip from
 * `s_limit` onward, clipped to the drawn window. `null` when the limit point
 * is at or past the window's end (nothing beyond it is drawn, so nothing to
 * wash).
 */
function buildOcclusionWash(road, s_limit, from_s, to_s) {
    const start = Math.max(s_limit, from_s);
    if (start >= to_s)
        return null;
    const stations = [];
    for (let s = start; s < to_s; s += EDGE_STEP_M)
        stations.push(s);
    stations.push(to_s);
    const w = road.lane_width_m;
    const left = stations.map((s) => road.worldAt(s, -w));
    const right = stations.map((s) => road.worldAt(s, w)).reverse();
    return [...left, ...right];
}
// ---------------------------------------------------------------------------
// Gravel hazard geometry (design/06 §3.1 stage 4; design/03 §4.2). The band's
// lo/hi in d-space is the SAME formula `solve/solve.ts`'s `hazardBandMu` uses
// for the physics μ-override — recomputed here (render never imports solve/'s
// internals) so the drawn patch matches the physical band exactly.
function hazardDBand(road, h, s) {
    if (h.side === "center") {
        const c = road.dOf(0.5, s);
        return { lo: c - h.width_m / 2, hi: c + h.width_m / 2 };
    }
    const hand = governingCorner(road.corners, s)?.hand ?? NO_CORNER_FRAME_HAND;
    const sigma = sideSign(h.side, hand);
    const d0 = road.dOf(0, s);
    const d1 = road.dOf(1, s);
    const edge = sigma > 0 ? Math.max(d0, d1) : Math.min(d0, d1);
    const other = edge - sigma * h.width_m;
    return { lo: Math.min(edge, other), hi: Math.max(edge, other) };
}
/**
 * One hazard's footprint (band polygon, station-sampled at `EDGE_STEP_M` like
 * the road edges) plus a deterministic grid of stipple-circle centres inside
 * it — no RNG anywhere (D29): the grid is fixed by `span_m`/`width_m`.
 */
function buildDrawnHazard(road, h) {
    const s0 = h.at.at_s;
    const s1 = s0 + h.span_m;
    const stations = [];
    for (let s = s0; s < s1; s += EDGE_STEP_M)
        stations.push(s);
    stations.push(s1);
    const inner = stations.map((s) => road.worldAt(s, hazardDBand(road, h, s).lo));
    const outer = stations.map((s) => road.worldAt(s, hazardDBand(road, h, s).hi)).reverse();
    const footprint = [...inner, ...outer];
    const cols = Math.max(1, Math.round(h.span_m / GRAVEL_STIPPLE_SPACING_M));
    const rows = Math.max(1, Math.round(h.width_m / GRAVEL_STIPPLE_SPACING_M));
    const stipples = [];
    for (let i = 0; i < cols; i++) {
        const s = s0 + ((i + 0.5) * h.span_m) / cols;
        const { lo, hi } = hazardDBand(road, h, s);
        for (let j = 0; j < rows; j++) {
            const frac = (j + 0.5) / rows;
            stipples.push(road.worldAt(s, lo + frac * (hi - lo)));
        }
    }
    return { id: h.id, kind: "gravel", footprint, stipples };
}
function buildDrawnHazards(road, lines) {
    const hazards = lines[0]?.resolved_scenario.hazards ?? [];
    return hazards.map((h) => buildDrawnHazard(road, h));
}
function nearestSample(samples, s) {
    let best;
    let bestGap = Infinity;
    for (const sample of samples) {
        const gap = Math.abs(sample.s - s);
        if (gap < bestGap) {
            bestGap = gap;
            best = sample;
        }
    }
    return best;
}
/** Probe half-span for the road-edge tangent at an `off_road` crossing — a local numeric-differentiation step, not a design literal. */
const EDGE_TANGENT_PROBE_M = 0.5;
/** m — how far stage 8b's consequence ray reaches past a runoff before it is simply cut. Presentation-only. */
const CONSEQUENCE_LEN_M = 8;
/**
 * Stage 8b: where the line was pointing when it left the corridor, cut at the
 * first occluder it runs into (fig 8.1's oncoming vehicle) or at
 * `CONSEQUENCE_LEN_M`. A straight constant-heading ray, never an integration —
 * the whole point is that the engine stopped simulating here.
 */
function consequenceRay(from, heading_deg, occluders) {
    const rad = (heading_deg * Math.PI) / 180;
    const ux = Math.cos(rad);
    const uy = Math.sin(rad);
    let best = CONSEQUENCE_LEN_M;
    for (const o of occluders) {
        const poly = o.footprint;
        for (let i = 0; i < poly.length; i++) {
            const a = poly[i];
            const b = poly[(i + 1) % poly.length];
            const ex = b.x - a.x;
            const ey = b.y - a.y;
            const den = ux * ey - uy * ex;
            if (Math.abs(den) < 1e-9)
                continue;
            const t = ((a.x - from.x) * ey - (a.y - from.y) * ex) / den;
            const u = ((a.x - from.x) * uy - (a.y - from.y) * ux) / den;
            if (t > 0.05 && t < best && u >= 0 && u <= 1)
                best = t;
        }
    }
    return [from, { x: from.x + ux * best, y: from.y + uy * best }];
}
/**
 * The road edge's tangent heading (degrees) at station `s`, on the side the
 * line left by (`dSign`) — design/06 §3.1 stage 8's "a short tick along the
 * road edge at the crossing". Two-point central difference on the edge
 * polyline `road.worldAt(s, ±lane_width_m)`, the same geometry
 * `buildDrawnRoad` strokes.
 */
function edgeTangentDeg(road, s, dSign) {
    const d = road.lane_width_m * dSign;
    const s0 = Math.max(0, s - EDGE_TANGENT_PROBE_M);
    const s1 = Math.min(road.total_len_m, s + EDGE_TANGENT_PROBE_M);
    const p0 = road.worldAt(s0, d);
    const p1 = road.worldAt(s1, d);
    return (Math.atan2(p1.y - p0.y, p1.x - p0.x) * 180) / Math.PI;
}
function buildDrawnLine(road, line, hasOccluders, rays, from_s, to_s, occluders, consequence) {
    const colour = QUALITY_COLOUR[line.verdict.quality];
    const kept = clippedSamples(line.trajectory.samples, from_s, to_s);
    const polyline = kept.map((s) => ({ x: s.x, y: s.y }));
    const stations = kept.map((s) => s.s);
    const last = line.trajectory.samples[line.trajectory.samples.length - 1];
    const t = line.trajectory.terminated;
    const glyph = terminalGlyphFor(t.reason);
    const terminal = {
        reason: t.reason,
        glyph,
        at: { x: t.x, y: t.y },
        heading_deg: last?.psi ?? 0,
        // only `off_road` carries an edge tick; the crossed edge is the one the
        // final sample's signed offset `d` points at (design/02 §7's bracketed
        // edge crossing lands the last sample exactly on |d| = lane_width_m).
        edge_heading_deg: glyph === "arrow_tick" ? edgeTangentDeg(road, t.s, (last?.d ?? 0) < 0 ? -1 : 1) : null
    };
    let sightRay = null;
    if (hasOccluders && rays !== "off") {
        sightRay = defaultSightRay(line, colour);
    }
    return {
        line_id: line.line_id,
        role: line.role,
        label: line.label,
        quality: line.verdict.quality,
        outcome: line.verdict.outcome,
        colour,
        polyline,
        stations,
        entry_kmh: msToKmh(line.trajectory.samples[0]?.v ?? 0),
        terminal,
        consequence: consequence && t.reason === "off_road" ? consequenceRay(terminal.at, terminal.heading_deg, occluders) : null,
        sightRay
    };
}
function buildDrawnRoad(road, from_s, to_s) {
    const stations = [];
    for (let s = from_s; s < to_s; s += EDGE_STEP_M)
        stations.push(s);
    stations.push(to_s);
    const w = road.lane_width_m;
    // stage 3b: the graded band. `corridorEdgeOffsets` is the SAME arithmetic the
    // f↔d map runs on (road/corridor.ts) — the renderer re-derives nothing.
    const edges = corridorEdgeOffsets({
        lane_width_m: w,
        bike_margin_m: road.bike_margin_m,
        use_full_width: road.use_full_width,
        corners: road.corners
    });
    const coincident = edges.d_lo <= -w && edges.d_hi >= w;
    return {
        lane_width_m: w,
        use_full_width: road.use_full_width,
        left: stations.map((s) => road.worldAt(s, -w)),
        right: stations.map((s) => road.worldAt(s, w)),
        centre: stations.map((s) => road.worldAt(s, 0)),
        usable: coincident
            ? null
            : {
                lo: stations.map((s) => road.worldAt(s, edges.d_lo)),
                hi: stations.map((s) => road.worldAt(s, edges.d_hi))
            }
    };
}
function buildDrawnOccluders(road, lines) {
    const occluders = lines[0]?.resolved_scenario.occluders ?? [];
    return footprintsOf(road, occluders).map((fp) => ({
        id: fp.id,
        kind: fp.kind,
        anchor: fp.centre,
        footprint: fp.polygon
    }));
}
// ---------------------------------------------------------------------------
// project()
/**
 * `project(road, lines, viewSpec) → Result<DrawnScene>` (design/06 §2,
 * ARCHITECTURE §5). Pure; fails typed (`SCHEMA`/`BAD_RANGE`) rather than
 * drawing nonsense (§2.6). `INTERNAL`'s non-monotone-remap arm is unreachable
 * in v0.1: `s′(s)` is the identity, always monotone.
 */
export function project(road, lines, viewSpec) {
    const view = parseViewSpec(viewSpec);
    if (!view.ok)
        return view;
    const window = resolveWindow(view.value.window, lines, road);
    if (!window.ok)
        return window;
    const { from_s, to_s } = window.value;
    const occluders = buildDrawnOccluders(road, lines);
    const hazards = buildDrawnHazards(road, lines);
    // design/06 §3.1 stage 8: fixed draw order `reference → alternative →
    // mistake → ideal` (ideal on top) — the renderer's own invariant, never the
    // caller's array order. Sorted HERE, once, so every downstream consumer of
    // `scene.lines` (stage 7 rays, stage 8 lines, legend) reads it pre-ordered.
    const drawnLines = lines
        .map((l) => buildDrawnLine(road, l, occluders.length > 0, view.value.rays, from_s, to_s, occluders, view.value.consequence))
        .sort((a, b) => roleRank(a.role) - roleRank(b.role));
    const drawnRoad = buildDrawnRoad(road, from_s, to_s);
    const orient = resolveOrient(view.value.orient);
    // design/06 §3.1 stage 6: the wash is anchored on "the figure's designated
    // eye sample" — the first line, IN DRAW ORDER, that carries a resolved
    // sight ray (same selection the old whole-road wash used, now scoped to
    // the ray's own `s_limit`).
    const rayLine = drawnLines.find((l) => l.sightRay !== null);
    const rawWash = rayLine?.sightRay !== null && rayLine?.sightRay !== undefined
        ? buildOcclusionWash(road, rayLine.sightRay.s_limit, from_s, to_s)
        : null;
    const allPoints = [
        ...drawnRoad.left,
        ...drawnRoad.right,
        ...drawnLines.flatMap((l) => l.polyline)
    ];
    const preRotateBox = boundingBox(allPoints);
    const cx = (preRotateBox.minX + preRotateBox.maxX) / 2;
    const cy = (preRotateBox.minY + preRotateBox.maxY) / 2;
    const rotate = (p) => rotatePoint(p, cx, cy, orient);
    const rotatedRoad = {
        ...drawnRoad,
        left: drawnRoad.left.map(rotate),
        right: drawnRoad.right.map(rotate),
        centre: drawnRoad.centre.map(rotate),
        usable: drawnRoad.usable === null
            ? null
            : { lo: drawnRoad.usable.lo.map(rotate), hi: drawnRoad.usable.hi.map(rotate) }
    };
    // `rotatePoint` is a rotation by +orient about the pivot, so every HEADING
    // it carries rotates by +orient too — the terminal glyphs (`bar` transverse
    // to `heading_deg`, `arrow_tick` along `edge_heading_deg`) are drawn in
    // scene space and would otherwise point where the pre-rotation geometry was.
    const rotatedLines = drawnLines.map((l) => ({
        ...l,
        polyline: l.polyline.map(rotate),
        consequence: l.consequence === null ? null : l.consequence.map(rotate),
        terminal: {
            ...l.terminal,
            at: rotate(l.terminal.at),
            heading_deg: l.terminal.heading_deg + orient,
            edge_heading_deg: l.terminal.edge_heading_deg === null ? null : l.terminal.edge_heading_deg + orient
        },
        sightRay: l.sightRay ? { ...l.sightRay, from: rotate(l.sightRay.from), to: rotate(l.sightRay.to) } : null
    }));
    const rotatedOccluders = occluders.map((o) => ({
        ...o,
        anchor: rotate(o.anchor),
        footprint: o.footprint.map(rotate)
    }));
    const rotatedHazards = hazards.map((h) => ({
        ...h,
        footprint: h.footprint.map(rotate),
        stipples: h.stipples.map(rotate)
    }));
    const rotatedWash = rawWash ? rawWash.map(rotate) : null;
    const finalBox = boundingBox([...rotatedRoad.left, ...rotatedRoad.right, ...rotatedLines.flatMap((l) => l.polyline)]);
    const frame = paddedFrame(finalBox);
    const legend = buildLegend(rotatedLines, view.value.legend);
    const scene = {
        mode: "true",
        window: { from_s, to_s },
        orient,
        frame,
        pivot: { x: cx, y: cy },
        degraded: false,
        road: rotatedRoad,
        occluders: rotatedOccluders,
        hazards: rotatedHazards,
        occlusionWash: rotatedWash,
        lines: rotatedLines,
        markers: [],
        labels: [],
        legend,
        footnote: null,
        // stage 11's placard boxes are FIGURE-level, and `project()` is given only
        // (road, lines, viewSpec) — renderViews attaches them (`withPlacards`).
        placards: []
    };
    return ok(scene);
}
//# sourceMappingURL=project.js.map