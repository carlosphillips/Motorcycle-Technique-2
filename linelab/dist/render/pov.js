// render/pov.ts — the `pov` RENDER TARGET (design/07 §5, the immersion view;
// design/06 §6's self-contained-SVG law). A PURE, self-contained SVG string
// builder: a flat-world pinhole projection of TRUE geometry (road edges + the
// recorded trajectory) with vertical occluder quads — "on the order of a
// hundred lines of projection math, all of it specified in [07]" (§2.3). No
// DOM, no IO, never throws (catch-all → `fallbackSvg`, the §6 self-contained
// discipline).
//
// C-POV-TRUE-GEOMETRY (design/09 L2027): this file consumes ONLY true geometry
// and MUST NOT import the diagram-projection module (`render/project.ts`). That
// is the structural half of the gate — an import-graph lint (test/render/
// pov.test.ts) fails the moment this file reaches `project.ts`; the behavioural
// half is that POV output is byte-identical across all projection settings,
// which holds by construction because nothing here reads a ViewSpec projection
// field. The limit point is CONSUMED from the recorded Sample (`limit_x`,
// `limit_y`) — the very field the `topdown` sight ray points at — never
// recomputed (C-POV-LIMIT-CONSISTENT, design/09 L2014): "the viewer never
// re-derives physics" (07 §2.4).
//
// Frame (ARCHITECTURE §6.1): world is x-east, y-down; `psi`/`phi` in the Sample
// record are DEGREES; every angle→basis conversion goes through core/units.ts
// (drift risk #1) — never an inline `* Math.PI / 180`.
import { degToRad, radToDeg, msToKmh } from "../core/units.js";
import { footprintsOf } from "../sight/footprints.js";
import { QUALITY_COLOUR } from "./constants.js";
import { POV_EYE_HEIGHT_M, POV_LOOK_MAX_DEG, POV_FOV_DEG, POV_NEAR_M, POV_CHEVRON_INSET_FRAC, POV_ARROW_LEN_RATIO, POV_OCCLUDER_HEIGHT_M } from "./constants.js";
import { roleRank } from "./ink.js";
import { fallbackSvg } from "./fallback.js";
// ---------------------------------------------------------------------------
// Closed sets (design/07 §5.2, §5.3 — copied verbatim, D8; enumeration-tested)
/** design/07 §5.2 — the `look` camera toggle, a closed two-value set. */
export const POV_LOOK_MODES = ["heading", "limit_point"];
/**
 * design/06 §2.1 / design/07 §5.3 — how the frame carries lean.
 *
 * `lean` is the engine default and the design's signature honesty: the whole
 * image rotates with `phi`, so the horizon angle IS the lean readout.
 *
 * `level` keeps the camera upright and moves lean into a HUD dial instead.
 * That is the BOOK's setting, for a reason that is about the reader and not
 * about the physics: a learner reading a still figure has no vestibular sense
 * to cancel the roll with, so a 30° tilt does not read as "I am leaning", it
 * reads as "the road is falling out of the frame". Both modes draw the same
 * lean; they differ only in which channel carries it.
 */
export const POV_ROLL_MODES = ["lean", "level"];
/** design/07 §5.3 item 7 — the limit-point marker's presentation state (closed set; rides the frame draw list). */
export const POV_MARKER_STATES = ["placed", "clamped"];
// ---------------------------------------------------------------------------
// Presentation-only locals (nominal frame + glyph sizes). design/07 gives the
// camera NUMBERS (constants.ts) but not the canvas size or glyph proportions —
// these are local names without TUNING status (ARCHITECTURE §6.6).
const POV_FRAME_W = 1000;
const POV_FRAME_H = 600;
/** chevron glyph half-size (px at the nominal frame); the clamped arrow is POV_ARROW_LEN_RATIO × this (§5.3 item 7). */
const CHEVRON_SIZE_PX = 14;
/** m — how far ahead the road/lane geometry is drawn (visible extent of the LUT; not truncated to sight — occlusion enforces sight, §5.3 item 2). */
const POV_LOOKAHEAD_M = 140;
/** m — station step for road-edge / occluder-face sampling. */
const POV_STEP_M = 2.0;
const POV_SKY = "#aec6de";
const POV_GROUND = "#7f8f63";
const POV_ROAD = "#9a9a9a";
const POV_LANE = "#e8e8e8";
const POV_SIGHT_TINT = "#ffffff";
const POV_OCCLUDER_FILL = Object.freeze({
    hedge: "#4c7a4c",
    wall: "#8a8a8a",
    bank: "#a8875a",
    vehicle: "#6b6b8a"
});
// ---------------------------------------------------------------------------
// Pure vector helpers (all in nominal frame px unless noted)
function rot(v, theta) {
    const c = Math.cos(theta);
    const s = Math.sin(theta);
    return { x: v.x * c - v.y * s, y: v.x * s + v.y * c };
}
function rotAbout(centre, p, theta) {
    const r = rot({ x: p.x - centre.x, y: p.y - centre.y }, theta);
    return { x: centre.x + r.x, y: centre.y + r.y };
}
/** shortest-arc wrap into (−180, 180] (design/07 §5.2's `wrapDeg`). */
function wrapDeg(d) {
    let x = (d + 180) % 360;
    if (x < 0)
        x += 360;
    return x - 180;
}
function clamp(v, lo, hi) {
    return v < lo ? lo : v > hi ? hi : v;
}
/**
 * design/07 §5.2 — the yaw law. `heading`: yaw = psi. `limit_point`:
 * `bearing = atan2(limit_y − y, limit_x − x)`,
 * `yaw = psi + clamp(wrapDeg(bearing − psi), −LOOK_MAX_DEG, +LOOK_MAX_DEG)`.
 * All in degrees (the Sample's own unit); returns degrees.
 */
export function povYawDeg(sample, look) {
    if (look === "heading")
        return sample.psi;
    const bearing = radToDeg(Math.atan2(sample.limit_y - sample.y, sample.limit_x - sample.x));
    const delta = clamp(wrapDeg(bearing - sample.psi), -POV_LOOK_MAX_DEG, POV_LOOK_MAX_DEG);
    return sample.psi + delta;
}
function buildCamera(sample, look, roll, W, H) {
    const yawDeg = povYawDeg(sample, look);
    const yaw = degToRad(yawDeg);
    const f = W / 2 / Math.tan(degToRad(POV_FOV_DEG) / 2);
    return {
        eye: { x: sample.x, y: sample.y },
        fwd: { x: Math.cos(yaw), y: Math.sin(yaw) },
        lat: { x: -Math.sin(yaw), y: Math.cos(yaw) },
        phiRad: degToRad(sample.phi),
        rollRad: roll === "lean" ? degToRad(sample.phi) : 0,
        f,
        P0: { x: W / 2, y: H / 2 },
        horizonY: H / 2,
        W,
        H,
        yawDeg
    };
}
/** forward distance F of a world ground point from the eye (camera axis component). */
function forwardOf(cam, wx, wy) {
    return (wx - cam.eye.x) * cam.fwd.x + (wy - cam.eye.y) * cam.fwd.y;
}
/**
 * Project a world point at height `z` (m above ground) to the final (rolled)
 * frame, or null if it is at/behind the near plane (`F ≤ near_m`) — the §5.2
 * "drop vertices, do not edge-clip" rule.
 */
function project(cam, wx, wy, z) {
    const dx = wx - cam.eye.x;
    const dy = wy - cam.eye.y;
    const F = dx * cam.fwd.x + dy * cam.fwd.y;
    if (F <= POV_NEAR_M)
        return null;
    const L = dx * cam.lat.x + dy * cam.lat.y;
    const u = (cam.f * L) / F;
    // ground/point vertical: a point at height z sits (eye_height − z) below the
    // eye; v is measured downward from the horizon row (§5.2).
    const v = cam.horizonY + (cam.f * (POV_EYE_HEIGHT_M - z)) / F;
    const preRoll = { x: cam.P0.x + u, y: v };
    // the completed 2-D frame is rotated by −phi about the principal point.
    return rotAbout(cam.P0, preRoll, -cam.rollRad);
}
/** Project a polygon, dropping near-clipped vertices (§5.2); null if fewer than 3 survive. */
function projectPolygon(cam, verts) {
    const out = [];
    for (const v of verts) {
        const p = project(cam, v.x, v.y, v.z ?? 0);
        if (p !== null)
            out.push(p);
    }
    return out.length >= 3 ? out : null;
}
/**
 * Project a polyline as CONTIGUOUS VISIBLE RUNS.
 *
 * §5.2's rule is "drop vertices, do not edge-clip" — but dropping a vertex and
 * then joining its neighbours is not dropping, it is stitching a segment that
 * crosses the dropped ground. On a road that bends back on itself (bookEsses,
 * bookDoubleApex) the far half of a 140 m lookahead passes BEHIND the camera,
 * and the stitched result was a spike of road folded across the sky with the
 * rider's line looping through it. Splitting at the near-plane crossings keeps
 * the rule (no vertex is invented, none is moved) and drops the join as well as
 * the vertex.
 */
function projectRuns(cam, verts) {
    const runs = [];
    let current = [];
    for (const v of verts) {
        const p = project(cam, v.x, v.y, v.z ?? 0);
        if (p === null) {
            if (current.length >= 2)
                runs.push(current);
            current = [];
        }
        else {
            current.push(p);
        }
    }
    if (current.length >= 2)
        runs.push(current);
    return runs;
}
// ---------------------------------------------------------------------------
// Stage builders (all return projected primitives — the draw list)
function stationsForward(fromS, toS) {
    const out = [];
    const end = Math.max(fromS, toS);
    for (let s = fromS; s < end; s += POV_STEP_M)
        out.push(s);
    out.push(end);
    return out;
}
/** stage 1 — the ground polygon below the rolled horizon; sky is the frame fill above it. */
function groundPolygon(cam) {
    const BIG = 3 * Math.max(cam.W, cam.H);
    const along = rot({ x: 1, y: 0 }, -cam.rollRad); // horizon direction (rolled)
    const down = rot({ x: 0, y: 1 }, -cam.rollRad); // below-horizon normal (rolled)
    const a = { x: cam.P0.x + BIG * along.x, y: cam.P0.y + BIG * along.y };
    const b = { x: cam.P0.x - BIG * along.x, y: cam.P0.y - BIG * along.y };
    const c = { x: b.x + 2 * BIG * down.x, y: b.y + 2 * BIG * down.y };
    const d = { x: a.x + 2 * BIG * down.x, y: a.y + 2 * BIG * down.y };
    return [a, b, c, d];
}
/**
 * stage 2 — the road surface as a STRIP OF QUADS, one per station step, sorted
 * far→near.
 *
 * The single outer-edge-forward + inner-edge-reversed ring it replaces is only
 * a valid polygon while the whole strip is in front of the camera. Where the
 * road leaves the view and returns (an esses, a double apex), the ring's two
 * chains are stitched across the gap and the surface self-intersects into the
 * bow-tie the judge kept reading as "a mountain". A quad only ever spans two
 * adjacent stations, so a quad that cannot be seen simply is not drawn.
 */
function roadQuads(cam, road, fromS, toS) {
    const stations = stationsForward(fromS, Math.min(toS, road.total_len_m));
    const w = road.lane_width_m;
    const quads = [];
    for (let i = 0; i + 1 < stations.length; i++) {
        const s0 = stations[i];
        const s1 = stations[i + 1];
        const corners = [road.worldAt(s0, -w), road.worldAt(s1, -w), road.worldAt(s1, w), road.worldAt(s0, w)];
        const projected = corners.map((c) => project(cam, c.x, c.y, 0));
        if (projected.some((p) => p === null))
            continue;
        const depth = corners.reduce((acc, c) => acc + forwardOf(cam, c.x, c.y), 0) / corners.length;
        quads.push({ poly: projected, depth });
    }
    quads.sort((a, b) => b.depth - a.depth);
    return quads.map((q) => q.poly);
}
/** stage 3 — centreline (unless use_full_width) + both lane edges, as visible runs. */
function laneLines(cam, road, fromS) {
    const to = Math.min(fromS + POV_LOOKAHEAD_M, road.total_len_m);
    const stations = stationsForward(fromS, to);
    const w = road.lane_width_m;
    const out = [];
    const push = (d) => {
        out.push(...projectRuns(cam, stations.map((s) => road.worldAt(s, d))));
    };
    push(-w);
    push(w);
    if (!road.use_full_width)
        push(0);
    return out;
}
/**
 * stage 4 — one occluder extruded to its kind's presentation height (§5.3
 * item 4). Each footprint edge becomes a vertical quad `[baseA, baseB, topB,
 * topA]`; quads sort far→near (painter's order) so the near face paints over
 * the road, "the road visibly disappears behind the occluder". Height is owned
 * HERE (POV_OCCLUDER_HEIGHT_M).
 */
function extrudeOccluder(cam, fp) {
    const h = POV_OCCLUDER_HEIGHT_M[fp.kind];
    const poly = fp.polygon;
    const n = poly.length;
    const quads = [];
    for (let i = 0; i < n; i++) {
        const a = poly[i];
        const b = poly[(i + 1) % n];
        const midX = (a.x + b.x) / 2;
        const midY = (a.y + b.y) / 2;
        const depthF = forwardOf(cam, midX, midY);
        if (depthF <= POV_NEAR_M)
            continue; // the whole edge is behind the near plane
        const quad = projectPolygon(cam, [
            { x: a.x, y: a.y, z: 0 },
            { x: b.x, y: b.y, z: 0 },
            { x: b.x, y: b.y, z: h },
            { x: a.x, y: a.y, z: h }
        ]);
        if (quad !== null)
            quads.push({ poly: quad, depthF });
    }
    quads.sort((p, q) => q.depthF - p.depthF); // far first
    return { id: fp.id, kind: fp.kind, quads: quads.map((qd) => qd.poly) };
}
/**
 * stage 6 — the focused line's samples ahead of the cursor, projected to ground
 * as visible runs, plus an off-frame flag.
 *
 * A rider looking through the corner (`look: limit_point`) can be looking
 * somewhere their own line does not go — that IS the fig 8.1 mistake — and the
 * path then projects entirely outside the frame. Silently drawing nothing would
 * read as "this rider has no line", so the frame records that it went off, and
 * the serializer marks the edge it left by. Same convention the limit marker
 * already uses when it clamps (§5.3 item 7).
 */
function pathOverlay(cam, line, fromS) {
    const ahead = line.trajectory.samples.filter((s) => s.s >= fromS);
    const runs = projectRuns(cam, ahead.map((s) => ({ x: s.x, y: s.y })));
    if (runs.length === 0)
        return null;
    const colour = QUALITY_COLOUR[line.verdict.quality];
    const inFrame = (p) => p.x >= 0 && p.x <= cam.W && p.y >= 0 && p.y <= cam.H;
    if (runs.some((r) => r.some(inFrame)))
        return { runs, colour, offFrame: null };
    // nothing on screen: point at the nearest projected sample from the centre
    const all = runs.flat();
    const nearest = all.reduce((a, b) => Math.hypot(b.x - cam.P0.x, b.y - cam.P0.y) < Math.hypot(a.x - cam.P0.x, a.y - cam.P0.y) ? b : a);
    const dir = unit({ x: nearest.x - cam.P0.x, y: nearest.y - cam.P0.y });
    const inset = CHEVRON_SIZE_PX * 2;
    const at = rayToRect(cam.P0, dir, { x0: inset, y0: inset, x1: cam.W - inset, y1: cam.H - inset });
    return { runs, colour, offFrame: { at, dx: dir.x, dy: dir.y } };
}
/**
 * stage 7 — the limit-point marker transform (design/07 §5.3 item 7 / §2.5).
 * The world source is the recorded `(limit_x, limit_y)` — CONSUMED, never
 * recomputed (C-POV-LIMIT-CONSISTENT). Exactly one marker per frame (D40).
 */
function limitMarker(cam, sample, trend) {
    const world = { x: sample.limit_x, y: sample.limit_y };
    const inset = POV_CHEVRON_INSET_FRAC * Math.min(cam.W, cam.H);
    const R = { x0: inset, y0: inset, x1: cam.W - inset, y1: cam.H - inset };
    const dx = world.x - cam.eye.x;
    const dy = world.y - cam.eye.y;
    const F = dx * cam.fwd.x + dy * cam.fwd.y;
    const arrowLen = POV_ARROW_LEN_RATIO * CHEVRON_SIZE_PX;
    if (F > POV_NEAR_M) {
        const L = dx * cam.lat.x + dy * cam.lat.y;
        const u = (cam.f * L) / F;
        const v = cam.horizonY + (cam.f * POV_EYE_HEIGHT_M) / F; // ground point, z = 0
        const p = rotAbout(cam.P0, { x: cam.P0.x + u, y: v }, -cam.rollRad);
        if (p.x >= R.x0 && p.x <= R.x1 && p.y >= R.y0 && p.y <= R.y1) {
            return { world, markerState: "placed", screen: p, arrow: null, trend };
        }
        const dir = unit({ x: p.x - cam.P0.x, y: p.y - cam.P0.y });
        return { world, markerState: "clamped", screen: rayToRect(cam.P0, dir, R), arrow: { dx: dir.x, dy: dir.y, length: arrowLen }, trend };
    }
    // F ≤ near_m: the limit point is off to the side at eye level (§5.3 item 7).
    const L = dx * cam.lat.x + dy * cam.lat.y;
    const signL = L > 0 ? 1 : L < 0 ? -1 : 1;
    const dir = rot({ x: signL, y: 0 }, -cam.rollRad);
    return { world, markerState: "clamped", screen: rayToRect(cam.P0, dir, R), arrow: { dx: dir.x, dy: dir.y, length: arrowLen }, trend };
}
function unit(v) {
    const m = Math.hypot(v.x, v.y);
    return m < 1e-9 ? { x: 1, y: 0 } : { x: v.x / m, y: v.y / m };
}
/** intersection of ray `P0 + k·dir (k>0)` with the boundary of interior rect R (unique — P0 is interior). */
function rayToRect(P0, dir, R) {
    const EPS = 1e-9;
    const tx = dir.x > EPS ? (R.x1 - P0.x) / dir.x : dir.x < -EPS ? (R.x0 - P0.x) / dir.x : Infinity;
    const ty = dir.y > EPS ? (R.y1 - P0.y) / dir.y : dir.y < -EPS ? (R.y0 - P0.y) / dir.y : Infinity;
    const k = Math.min(tx, ty);
    if (!Number.isFinite(k) || k <= 0)
        return { x: P0.x, y: P0.y };
    return { x: P0.x + k * dir.x, y: P0.y + k * dir.y };
}
/** stage 8 — the heading tick on the horizon, only under `look: limit_point` (disclosing the head-turn). */
function headingTick(cam, sample, look) {
    if (look !== "limit_point")
        return null;
    const az = degToRad(wrapDeg(sample.psi - cam.yawDeg)); // heading azimuth in the camera frame
    if (Math.abs(az) >= Math.PI / 2 - 1e-3)
        return null; // heading behind/beside the camera plane
    const u = cam.f * Math.tan(az);
    return rotAbout(cam.P0, { x: cam.P0.x + u, y: cam.horizonY }, -cam.rollRad);
}
// ---------------------------------------------------------------------------
// povFrame — the pure draw list (design/07 §5.5's `frame()`)
/** Build the POV draw list for one cursor Sample. Pure; the design's `frame(result, lineId, cursor, look)`. */
export function povFrame(input) {
    const W = input.width ?? POV_FRAME_W;
    const H = input.height ?? POV_FRAME_H;
    const { sample, look, road } = input;
    const roll = input.roll ?? "lean";
    const cam = buildCamera(sample, look, roll, W, H);
    const fromS = sample.s;
    const footprints = footprintsOf(road, input.occluders);
    const occluders = footprints.map((fp) => extrudeOccluder(cam, fp)).filter((o) => o.quads.length > 0);
    return {
        width: W,
        height: H,
        look,
        roll,
        yaw_deg: cam.yawDeg,
        phi_deg: sample.phi,
        eye: { x: cam.eye.x, y: cam.eye.y },
        focal_px: cam.f,
        principal: cam.P0,
        ground: groundPolygon(cam),
        road: roadQuads(cam, road, fromS, fromS + POV_LOOKAHEAD_M),
        laneLines: laneLines(cam, road, fromS),
        sightBand: roadQuads(cam, road, fromS, fromS + Math.max(sample.sight_m, 0)),
        occluders,
        path: pathOverlay(cam, input.line, fromS),
        limit: limitMarker(cam, sample, input.trend ?? "steady"),
        headingTick: headingTick(cam, sample, look),
        hud: {
            v_kmh: msToKmh(sample.v), // km/h for HUD display (unit format only, §2.4; core/units.ts is the sole converter)
            phi_deg: sample.phi,
            sight_ride_m: sample.sight_ride_m,
            ssd_m: sample.ssd_m,
            clipped: sample.clipped
        }
    };
}
// ---------------------------------------------------------------------------
// SVG serialization (design/06 §7 — fully self-contained: inline fill/stroke
// only, no external CSS/fonts/url(), no SMIL, no <pattern>)
function esc(s) {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function n(x) {
    const r = Math.round(x * 100) / 100;
    return Object.is(r, -0) ? 0 : r;
}
function attrs(a) {
    return Object.entries(a)
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => ` ${k}="${typeof v === "string" ? esc(v) : v}"`)
        .join("");
}
function leaf(tag, a) {
    return `<${tag}${attrs(a)}/>`;
}
function ptsStr(pts) {
    return pts.map((p) => `${n(p.x)},${n(p.y)}`).join(" ");
}
function serialize(frame) {
    const { width: W, height: H } = frame;
    let svg = `<svg${attrs({ xmlns: "http://www.w3.org/2000/svg", width: W, height: H, viewBox: `0 0 ${W} ${H}`, "data-view": "pov", "data-look": frame.look })}>`;
    // stage 1 — sky fill, then ground below the rolled horizon
    svg += leaf("rect", { x: 0, y: 0, width: W, height: H, fill: POV_SKY, "data-stage": "1-sky" });
    svg += leaf("polygon", { points: ptsStr(frame.ground), fill: POV_GROUND, "data-stage": "1-ground" });
    // stage 2 — road surface, one quad per station step (far→near)
    if (frame.road.length > 0) {
        svg += `<g${attrs({ "data-stage": "2-road-surface" })}>`;
        for (const quad of frame.road) {
            svg += leaf("polygon", { points: ptsStr(quad), fill: POV_ROAD, stroke: POV_ROAD, "stroke-width": 0.5 });
        }
        svg += `</g>`;
    }
    // stage 3 — lane markings
    if (frame.laneLines.length > 0) {
        svg += `<g${attrs({ "data-stage": "3-lane-markings" })}>`;
        for (const line of frame.laneLines) {
            svg += leaf("polyline", { points: ptsStr(line), fill: "none", stroke: POV_LANE, "stroke-width": 2 });
        }
        svg += `</g>`;
    }
    // stage 5 (partial) — sight tint band (drawn under occluders per draw order? design draws
    // sight band at stage 5, AFTER occluders (stage 4). Occlusion wash paints the fan; here the
    // occluder quads must remain visible OVER the tint, so the tint is painted BEFORE occluders.)
    // NB: design order is 4 occluders → 5 sight band, but the sight band is a faint surface tint
    // and the occluders are opaque quads that must occlude; painting the tint first keeps both
    // honest (the tint never washes over an occluder).
    if (frame.sightBand.length > 0) {
        svg += `<g${attrs({ "data-stage": "5-sight-band" })}>`;
        for (const quad of frame.sightBand) {
            svg += leaf("polygon", { points: ptsStr(quad), fill: POV_SIGHT_TINT, "fill-opacity": 0.12, stroke: "none" });
        }
        svg += `</g>`;
    }
    // stage 4 — occluders (far→near), painted OVER the road: the road disappears behind them
    if (frame.occluders.length > 0) {
        svg += `<g${attrs({ "data-stage": "4-occluders" })}>`;
        for (const occ of frame.occluders) {
            for (const quad of occ.quads) {
                svg += leaf("polygon", {
                    points: ptsStr(quad),
                    fill: POV_OCCLUDER_FILL[occ.kind],
                    "fill-opacity": 0.95,
                    stroke: "#2f2f2f",
                    "stroke-width": 0.5,
                    "data-occluder-kind": occ.kind,
                    "data-occluder-id": occ.id
                });
            }
        }
        svg += `</g>`;
    }
    // stage 6 — path overlay (verdict colour), one polyline per visible run
    if (frame.path !== null) {
        svg += `<g${attrs({ "data-stage": "6-path" })}>`;
        for (const run of frame.path.runs) {
            svg += leaf("polyline", {
                points: ptsStr(run),
                fill: "none",
                stroke: frame.path.colour,
                "stroke-width": 3,
                "stroke-opacity": 0.9
            });
        }
        const off = frame.path.offFrame;
        if (off !== null) {
            // "your line went that way, and you are not looking at it"
            const tail = off.at;
            const head = { x: tail.x + off.dx * 26, y: tail.y + off.dy * 26 };
            const back = { x: -off.dx, y: -off.dy };
            const perp = { x: -off.dy, y: off.dx };
            svg +=
                leaf("line", { x1: n(tail.x), y1: n(tail.y), x2: n(head.x), y2: n(head.y), stroke: frame.path.colour, "stroke-width": 4, "data-path-offframe": "true" }) +
                    leaf("polyline", {
                        points: `${n(head.x + (back.x + perp.x) * 8)},${n(head.y + (back.y + perp.y) * 8)} ${n(head.x)},${n(head.y)} ${n(head.x + (back.x - perp.x) * 8)},${n(head.y + (back.y - perp.y) * 8)}`,
                        fill: "none",
                        stroke: frame.path.colour,
                        "stroke-width": 4
                    }) +
                    `<text${attrs({ x: n(tail.x - off.dx * 26), y: n(tail.y - off.dy * 26), "font-family": "sans-serif", "font-size": 14, fill: frame.path.colour, "text-anchor": "middle", "paint-order": "stroke", stroke: "#ffffff", "stroke-width": 3, "stroke-opacity": 0.8 })}>${esc("your line")}</text>`;
        }
        svg += `</g>`;
    }
    // stage 7 — the limit-point marker (unconditional; exactly one)
    svg += serializeLimit(frame);
    // stage 9 — the rider's own bars and mirrors, so the frame reads as a seat
    svg += serializeRiderAnchor(frame);
    // stage 8 — HUD strip + heading tick (limit_point only)
    svg += serializeHud(frame);
    svg += `</svg>`;
    return svg;
}
function serializeLimit(frame) {
    const m = frame.limit;
    const c = m.screen;
    const r = CHEVRON_SIZE_PX;
    const colour = "#111111";
    // an upward chevron `^` centred at the glyph position, on the road surface
    const chevron = leaf("polyline", {
        points: `${n(c.x - r)},${n(c.y + r * 0.6)} ${n(c.x)},${n(c.y - r * 0.6)} ${n(c.x + r)},${n(c.y + r * 0.6)}`,
        fill: "none",
        stroke: colour,
        "stroke-width": 3,
        "stroke-linejoin": "round",
        "data-marker": "limit_point",
        "data-marker-state": m.markerState,
        "data-trend": m.trend
    });
    let arrow = "";
    if (m.arrow !== null) {
        // the outward gaze arrow — present IFF clamped (§5.3 item 7)
        const tail = { x: c.x, y: c.y };
        const head = { x: c.x + m.arrow.dx * m.arrow.length, y: c.y + m.arrow.dy * m.arrow.length };
        // arrowhead barbs
        const back = { x: -m.arrow.dx, y: -m.arrow.dy };
        const perp = { x: -m.arrow.dy, y: m.arrow.dx };
        const b1 = { x: head.x + (back.x + perp.x) * 6, y: head.y + (back.y + perp.y) * 6 };
        const b2 = { x: head.x + (back.x - perp.x) * 6, y: head.y + (back.y - perp.y) * 6 };
        arrow =
            leaf("line", { x1: n(tail.x), y1: n(tail.y), x2: n(head.x), y2: n(head.y), stroke: colour, "stroke-width": 3, "data-marker-arrow": "true" }) +
                leaf("polyline", { points: `${n(b1.x)},${n(b1.y)} ${n(head.x)},${n(head.y)} ${n(b2.x)},${n(b2.y)}`, fill: "none", stroke: colour, "stroke-width": 3 });
    }
    return `<g${attrs({ "data-stage": "7-limit-marker" })}>${chevron}${arrow}</g>`;
}
/**
 * The lean dial — a bike-tail silhouette tilted by `phi` against a fixed
 * ground line, top-right. Under roll `lean` the horizon already carries lean
 * and the dial is a second reading of it; under `level` it is the ONLY reading,
 * which is the trade that mode makes.
 */
function serializeLeanDial(frame) {
    const cx = frame.width - 54;
    const cy = 54;
    const R = 26;
    const lean = -degToRad(frame.phi_deg); // screen y is down, so a right lean tips clockwise
    const top = { x: cx + Math.sin(lean) * R, y: cy - Math.cos(lean) * R };
    return (`<g${attrs({ "data-lean-dial": n(frame.phi_deg) })}>` +
        // a dark pill behind it: white ink on open sky is unreadable
        leaf("rect", { x: cx - R - 10, y: cy - R - 10, width: 2 * R + 20, height: 2 * R + 34, rx: 10, fill: "#101418", "fill-opacity": 0.55 }) +
        leaf("line", { x1: cx - R, y1: cy, x2: cx + R, y2: cy, stroke: "#e8e8e8", "stroke-width": 2, "stroke-opacity": 0.6 }) +
        leaf("line", { x1: cx, y1: cy, x2: n(top.x), y2: n(top.y), stroke: "#e8e8e8", "stroke-width": 3 }) +
        leaf("circle", { cx, cy, r: 3.5, fill: "#e8e8e8" }) +
        `<text${attrs({ x: cx, y: cy + R + 14, "font-family": "sans-serif", "font-size": 13, fill: "#e8e8e8", "text-anchor": "middle" })}>${esc(`${Math.round(Math.abs(frame.phi_deg))}°`)}</text>` +
        `</g>`);
}
/**
 * The rider's own machine: mirrors and bar ends in the near corners, cut off by
 * the frame. A first-person view with nothing of the bike in it has no anchor —
 * the reader cannot tell whether they are sitting on the motorcycle or hovering
 * beside it. Drawn in the FRAME, never in the world: it is where the rider's
 * hands are, so it does not roll with the camera under either roll mode.
 */
function serializeRiderAnchor(frame) {
    const { width: W, height: H } = frame;
    const y = H - 34; // the HUD strip's top edge — the bars sit on it
    const ink = "#22262b";
    const side = (dir) => {
        const edge = dir < 0 ? 0 : W;
        const inner = dir < 0 ? W * 0.17 : W * 0.83;
        const mirrorX = dir < 0 ? W * 0.09 : W * 0.91;
        const mirrorY = y - 96;
        return (
        // the bar end: a wedge sweeping up out of the bottom corner
        leaf("path", {
            d: `M ${n(edge)},${n(y)} L ${n(edge)},${n(y - 46)} Q ${n(edge + dir * W * 0.06)},${n(y - 30)} ${n(inner)},${n(y - 6)} L ${n(inner)},${n(y)} Z`,
            fill: ink,
            "fill-opacity": 0.9
        }) +
            // stalk, raked outward the way a mirror stem is
            leaf("line", {
                x1: n(edge + dir * W * 0.035),
                y1: n(y - 40),
                x2: n(mirrorX),
                y2: n(mirrorY + 16),
                stroke: ink,
                "stroke-width": 7,
                "stroke-linecap": "round",
                "stroke-opacity": 0.9
            }) +
            // the mirror head: a rounded rectangle canted outward, with a glass face
            // — an ellipse on a stick reads as a signpost, which is exactly what a
            // rider anchor must not look like
            `<g${attrs({ transform: `rotate(${dir * 12} ${n(mirrorX)} ${n(mirrorY)})` })}>` +
            leaf("rect", { x: n(mirrorX - 34), y: n(mirrorY - 19), width: 68, height: 38, rx: 12, fill: ink, "fill-opacity": 0.92 }) +
            leaf("rect", { x: n(mirrorX - 28), y: n(mirrorY - 13), width: 56, height: 26, rx: 9, fill: "#5b6673", "fill-opacity": 0.85 }) +
            `</g>`);
    };
    return `<g${attrs({ "data-stage": "9-rider-anchor" })}>${side(-1)}${side(1)}</g>`;
}
function serializeHud(frame) {
    const { width: W, height: H, hud } = frame;
    const stripY = H - 34;
    let s = `<g${attrs({ "data-stage": "8-hud" })}>`;
    // heading tick on the horizon (limit_point only) — a rotated camera must not read as a rotated bike
    if (frame.headingTick !== null) {
        const t = frame.headingTick;
        const along = rot({ x: 0, y: 1 }, -degToRad(frame.phi_deg)); // tick runs across the rolled horizon
        s += leaf("line", {
            x1: n(t.x - along.x * 10),
            y1: n(t.y - along.y * 10),
            x2: n(t.x + along.x * 10),
            y2: n(t.y + along.y * 10),
            stroke: "#333333",
            "stroke-width": 2,
            "data-heading-tick": "true"
        });
    }
    s += leaf("rect", { x: 0, y: stripY, width: W, height: 34, fill: "#101418", "fill-opacity": 0.72 });
    // The HUD is the one place a learner is told what the frame means, so it says
    // it in riding words. `φ -30.47° / ssd 19.2 m` is engine spelling: the reader
    // has to know that φ is lean, that its sign is a direction, that `ssd` is how
    // far it takes to stop, and then do the subtraction that IS the lesson.
    // Whole numbers, because a simulated metre to two decimals is false precision.
    const lean = Math.round(Math.abs(hud.phi_deg));
    const leanWord = lean === 0 ? "upright" : `lean ${lean}° ${hud.phi_deg < 0 ? "left" : "right"}`;
    const gap = Math.round(hud.sight_ride_m - hud.ssd_m);
    const sightWord = gap >= 0
        ? `see ${Math.round(hud.sight_ride_m)} m · need ${Math.round(hud.ssd_m)} m to stop · ${gap} m spare`
        : `see ${Math.round(hud.sight_ride_m)} m · need ${Math.round(hud.ssd_m)} m to stop · SHORT by ${Math.abs(gap)} m`;
    const text = `${Math.round(hud.v_kmh)} km/h   ${leanWord}   ${sightWord}${hud.clipped ? "   [clip]" : ""}`;
    // The numbers ride as data attributes as well as words: a consumer (the
    // chapter gallery) that needs the value must never have to regex the prose.
    s += `<text${attrs({
        x: 10,
        y: stripY + 22,
        "font-family": "sans-serif",
        "font-size": 15,
        fill: gap >= 0 ? "#e8e8e8" : "#f4b3b0",
        "data-hud": "true",
        "data-v-kmh": n(hud.v_kmh),
        "data-lean-deg": n(hud.phi_deg),
        "data-sight-m": n(hud.sight_ride_m),
        "data-ssd-m": n(hud.ssd_m)
    })}>${esc(text)}</text>`;
    s += serializeLeanDial(frame);
    if (frame.look === "limit_point") {
        s += `<text${attrs({ x: W - 10, y: 22, "font-family": "sans-serif", "font-size": 14, fill: "#e8e8e8", "text-anchor": "end", "data-look-chip": "true" })}>${esc("look: limit point")}</text>`;
    }
    s += `</g>`;
    return s;
}
/**
 * `renderPov(input) → SvgString` (design/06 §6 self-contained SVG law): the
 * pure POV frame as a self-contained SVG string. NEVER throws — any failure is
 * caught and returned as `fallbackSvg(msg)`, exactly as `renderTopdown` does.
 */
export function renderPov(input) {
    try {
        return serialize(povFrame(input));
    }
    catch (e) {
        return fallbackSvg(e instanceof Error ? e.message : String(e));
    }
}
// ---------------------------------------------------------------------------
// Figure-level convenience — pick a focused line + a default cursor and render.
// This is what render/index.ts's `renderViews({target:"pov"})` calls: the
// static POV render target (a future rasterizer emits sequences, §5.5).
/** The focused line: ideal wins, else the highest-priority role in draw order, else the first. */
export function povFocusLine(lines) {
    if (lines.length === 0)
        return undefined;
    return [...lines].sort((a, b) => roleRank(b.role) - roleRank(a.role))[0];
}
/** A deterministic default cursor sample: nearest the first corner's mid-station, else the mid sample. */
export function povDefaultSample(road, line) {
    const samples = line.trajectory.samples;
    if (samples.length === 0)
        return undefined;
    const c0 = road.corners[0];
    const targetS = c0 !== undefined ? c0.s_mid : samples[Math.floor(samples.length / 2)].s;
    return samples.reduce((a, b) => (Math.abs(b.s - targetS) < Math.abs(a.s - targetS) ? b : a));
}
/** presentation trend from the neighbouring recorded sight_m (opening/closing/steady). */
function trendAt(line, sample) {
    const samples = line.trajectory.samples;
    const i = samples.indexOf(sample);
    const next = i >= 0 && i + 1 < samples.length ? samples[i + 1] : undefined;
    if (next === undefined)
        return "steady";
    const d = next.sight_m - sample.sight_m;
    if (d > 0.5)
        return "opening";
    if (d < -0.5)
        return "closing";
    return "steady";
}
/**
 * The static POV render target: pick the focused line + default cursor and
 * emit a self-contained SVG. `null`-safe — an empty/sampleless line yields a
 * `fallbackSvg` (never throws).
 */
export function renderPovForFigure(road, lines, look, roll = "lean") {
    const line = povFocusLine(lines);
    if (line === undefined)
        return fallbackSvg("pov: no drawable line");
    const sample = povDefaultSample(road, line);
    if (sample === undefined)
        return fallbackSvg("pov: focused line has no samples");
    const occluders = line.resolved_scenario.occluders ?? [];
    return renderPov({ road, occluders, line, sample, look, roll, trend: trendAt(line, sample) });
}
//# sourceMappingURL=pov.js.map