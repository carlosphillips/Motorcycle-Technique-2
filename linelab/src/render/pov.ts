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

import type { ComposedRoad } from "../road/types.js";
import type { LineResult } from "../solve/types.js";
import type { Sample, ResolvedOccluder, OccluderKind, SightTrend } from "../core/types.js";
import { degToRad, radToDeg, msToKmh } from "../core/units.js";
import { footprintsOf } from "../sight/footprints.js";
import type { OpaqueFootprint } from "../sight/footprints.js";
import { QUALITY_COLOUR } from "./constants.js";
import {
  POV_EYE_HEIGHT_M,
  POV_LOOK_MAX_DEG,
  POV_FOV_DEG,
  POV_NEAR_M,
  POV_CHEVRON_INSET_FRAC,
  POV_ARROW_LEN_RATIO,
  POV_OCCLUDER_HEIGHT_M
} from "./constants.js";
import { roleRank } from "./ink.js";
import { fallbackSvg } from "./fallback.js";

// ---------------------------------------------------------------------------
// Closed sets (design/07 §5.2, §5.3 — copied verbatim, D8; enumeration-tested)

/** design/07 §5.2 — the `look` camera toggle, a closed two-value set. */
export const POV_LOOK_MODES = ["heading", "limit_point"] as const;
export type PovLook = (typeof POV_LOOK_MODES)[number];

/** design/07 §5.3 item 7 — the limit-point marker's presentation state (closed set; rides the frame draw list). */
export const POV_MARKER_STATES = ["placed", "clamped"] as const;
export type MarkerState = (typeof POV_MARKER_STATES)[number];

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
const POV_OCCLUDER_FILL: Readonly<Record<OccluderKind, string>> = Object.freeze({
  hedge: "#4c7a4c",
  wall: "#8a8a8a",
  bank: "#a8875a",
  vehicle: "#6b6b8a"
});

// ---------------------------------------------------------------------------
// Draw-list shapes (design/07 §5.5: `frame()` returns a canvas draw list; the
// limit-point entry carries `markerState` and, when clamped, the arrow — "a
// presentation shape, not a wire contract, but pinned so tests can assert it").

export interface Pt {
  readonly x: number;
  readonly y: number;
}

export interface PovLimitMarker {
  /** the recorded limit point's WORLD coordinates — `(Sample.limit_x, Sample.limit_y)`, the SAME source the topdown sight ray points at (C-POV-LIMIT-CONSISTENT). Invariant across both `look` modes. */
  readonly world: Pt;
  readonly markerState: MarkerState;
  /** the on-frame glyph position (chevron centre): the projected point when placed, the R_inset-boundary intersection when clamped. */
  readonly screen: Pt;
  /** the outward gaze-direction arrow — present IFF `markerState === "clamped"` (its presence is the off-frame signal, §5.3 item 7). */
  readonly arrow: { readonly dx: number; readonly dy: number; readonly length: number } | null;
  /** opening / closing / steady badge, from the recorded sight channel (presentation-only). */
  readonly trend: SightTrend;
}

interface PovOccluder {
  readonly id: string;
  readonly kind: OccluderKind;
  /** extruded vertical faces (one quad per footprint edge), already sorted far→near for painter's order. */
  readonly quads: readonly (readonly Pt[])[];
}

export interface PovFrame {
  readonly width: number;
  readonly height: number;
  readonly look: PovLook;
  /** the resolved camera yaw (deg) — `psi` under `heading`; `psi + clamp(wrapDeg(bearing−psi), ±LOOK_MAX_DEG)` under `limit_point` (§5.2). */
  readonly yaw_deg: number;
  /** the frame roll (deg) = the recorded lean `phi`, both modes (§5.2 — "the horizon angle IS the lean readout"). */
  readonly phi_deg: number;
  readonly eye: Pt;
  readonly focal_px: number;
  readonly principal: Pt;
  /** stage 1 — the ground polygon below the rolled horizon (sky is the frame fill above it). */
  readonly ground: readonly Pt[];
  /** stage 2 — the road-surface polygon (roadOuter ahead + roadInner reversed), near-clipped; null if fully behind the near plane. */
  readonly road: readonly Pt[] | null;
  /** stage 3 — centreline + lane-edge polylines (near-clipped). */
  readonly laneLines: readonly (readonly Pt[])[];
  /** stage 5 (partial) — the "what you can see" surface tint from the station to `s + sight_m`; null if none projects. */
  readonly sightBand: readonly Pt[] | null;
  /** stage 4 — occluder quads, sorted far→near (occlusion by paint order). */
  readonly occluders: readonly PovOccluder[];
  /** stage 6 — the focused line's path ahead of the cursor, in verdict colour. */
  readonly path: { readonly points: readonly Pt[]; readonly colour: string } | null;
  /** stage 7 — the limit-point marker (unconditional: exactly one per frame, D40). */
  readonly limit: PovLimitMarker;
  /** stage 8 — the heading tick on the horizon (only under `look: limit_point`, disclosing the head-turn), else null. */
  readonly headingTick: Pt | null;
  /** HUD numbers (stage 8 strip) — read straight off the recorded Sample, no UI arithmetic. */
  readonly hud: {
    readonly v_kmh: number;
    readonly phi_deg: number;
    readonly sight_ride_m: number;
    readonly ssd_m: number;
    readonly clipped: boolean;
  };
}

export interface PovFrameInput {
  readonly road: ComposedRoad;
  readonly occluders: readonly ResolvedOccluder[];
  /** the focused line — its verdict colour paints the path overlay (D9). */
  readonly line: LineResult;
  /** the cursor's resolved Sample — the camera pose and the recorded limit point. */
  readonly sample: Sample;
  readonly look: PovLook;
  readonly width?: number;
  readonly height?: number;
  /** presentation trend badge for the limit marker; default "steady". */
  readonly trend?: SightTrend;
}

// ---------------------------------------------------------------------------
// Pure vector helpers (all in nominal frame px unless noted)

function rot(v: Pt, theta: number): Pt {
  const c = Math.cos(theta);
  const s = Math.sin(theta);
  return { x: v.x * c - v.y * s, y: v.x * s + v.y * c };
}

function rotAbout(centre: Pt, p: Pt, theta: number): Pt {
  const r = rot({ x: p.x - centre.x, y: p.y - centre.y }, theta);
  return { x: centre.x + r.x, y: centre.y + r.y };
}

/** shortest-arc wrap into (−180, 180] (design/07 §5.2's `wrapDeg`). */
function wrapDeg(d: number): number {
  let x = (d + 180) % 360;
  if (x < 0) x += 360;
  return x - 180;
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

// ---------------------------------------------------------------------------
// The camera (design/07 §5.2)

interface Camera {
  readonly eye: Pt;
  readonly fwd: Pt; // unit forward, at yaw
  readonly lat: Pt; // unit lateral (rider's right = world +y when heading +x)
  readonly phiRad: number;
  readonly f: number; // focal length px
  readonly P0: Pt; // principal point
  readonly horizonY: number;
  readonly W: number;
  readonly H: number;
  readonly yawDeg: number;
}

/**
 * design/07 §5.2 — the yaw law. `heading`: yaw = psi. `limit_point`:
 * `bearing = atan2(limit_y − y, limit_x − x)`,
 * `yaw = psi + clamp(wrapDeg(bearing − psi), −LOOK_MAX_DEG, +LOOK_MAX_DEG)`.
 * All in degrees (the Sample's own unit); returns degrees.
 */
export function povYawDeg(sample: Sample, look: PovLook): number {
  if (look === "heading") return sample.psi;
  const bearing = radToDeg(Math.atan2(sample.limit_y - sample.y, sample.limit_x - sample.x));
  const delta = clamp(wrapDeg(bearing - sample.psi), -POV_LOOK_MAX_DEG, POV_LOOK_MAX_DEG);
  return sample.psi + delta;
}

function buildCamera(sample: Sample, look: PovLook, W: number, H: number): Camera {
  const yawDeg = povYawDeg(sample, look);
  const yaw = degToRad(yawDeg);
  const f = W / 2 / Math.tan(degToRad(POV_FOV_DEG) / 2);
  return {
    eye: { x: sample.x, y: sample.y },
    fwd: { x: Math.cos(yaw), y: Math.sin(yaw) },
    lat: { x: -Math.sin(yaw), y: Math.cos(yaw) },
    phiRad: degToRad(sample.phi),
    f,
    P0: { x: W / 2, y: H / 2 },
    horizonY: H / 2,
    W,
    H,
    yawDeg
  };
}

/** forward distance F of a world ground point from the eye (camera axis component). */
function forwardOf(cam: Camera, wx: number, wy: number): number {
  return (wx - cam.eye.x) * cam.fwd.x + (wy - cam.eye.y) * cam.fwd.y;
}

/**
 * Project a world point at height `z` (m above ground) to the final (rolled)
 * frame, or null if it is at/behind the near plane (`F ≤ near_m`) — the §5.2
 * "drop vertices, do not edge-clip" rule.
 */
function project(cam: Camera, wx: number, wy: number, z: number): Pt | null {
  const dx = wx - cam.eye.x;
  const dy = wy - cam.eye.y;
  const F = dx * cam.fwd.x + dy * cam.fwd.y;
  if (F <= POV_NEAR_M) return null;
  const L = dx * cam.lat.x + dy * cam.lat.y;
  const u = (cam.f * L) / F;
  // ground/point vertical: a point at height z sits (eye_height − z) below the
  // eye; v is measured downward from the horizon row (§5.2).
  const v = cam.horizonY + (cam.f * (POV_EYE_HEIGHT_M - z)) / F;
  const preRoll = { x: cam.P0.x + u, y: v };
  // the completed 2-D frame is rotated by −phi about the principal point.
  return rotAbout(cam.P0, preRoll, -cam.phiRad);
}

/** Project a polygon, dropping near-clipped vertices (§5.2); null if fewer than 3 survive. */
function projectPolygon(cam: Camera, verts: readonly { x: number; y: number; z?: number }[]): readonly Pt[] | null {
  const out: Pt[] = [];
  for (const v of verts) {
    const p = project(cam, v.x, v.y, v.z ?? 0);
    if (p !== null) out.push(p);
  }
  return out.length >= 3 ? out : null;
}

/** Project a polyline, dropping near-clipped vertices; null if fewer than 2 survive. */
function projectPolyline(cam: Camera, verts: readonly { x: number; y: number; z?: number }[]): readonly Pt[] | null {
  const out: Pt[] = [];
  for (const v of verts) {
    const p = project(cam, v.x, v.y, v.z ?? 0);
    if (p !== null) out.push(p);
  }
  return out.length >= 2 ? out : null;
}

// ---------------------------------------------------------------------------
// Stage builders (all return projected primitives — the draw list)

function stationsForward(fromS: number, toS: number): number[] {
  const out: number[] = [];
  const end = Math.max(fromS, toS);
  for (let s = fromS; s < end; s += POV_STEP_M) out.push(s);
  out.push(end);
  return out;
}

/** stage 1 — the ground polygon below the rolled horizon; sky is the frame fill above it. */
function groundPolygon(cam: Camera): readonly Pt[] {
  const BIG = 3 * Math.max(cam.W, cam.H);
  const along = rot({ x: 1, y: 0 }, -cam.phiRad); // horizon direction (rolled)
  const down = rot({ x: 0, y: 1 }, -cam.phiRad); // below-horizon normal (rolled)
  const a = { x: cam.P0.x + BIG * along.x, y: cam.P0.y + BIG * along.y };
  const b = { x: cam.P0.x - BIG * along.x, y: cam.P0.y - BIG * along.y };
  const c = { x: b.x + 2 * BIG * down.x, y: b.y + 2 * BIG * down.y };
  const d = { x: a.x + 2 * BIG * down.x, y: a.y + 2 * BIG * down.y };
  return [a, b, c, d];
}

/** stage 2 — the road surface polygon (outer edge ahead + inner edge reversed). */
function roadPolygon(cam: Camera, road: ComposedRoad, fromS: number): readonly Pt[] | null {
  const to = Math.min(fromS + POV_LOOKAHEAD_M, road.total_len_m);
  const stations = stationsForward(fromS, to);
  const w = road.lane_width_m;
  const left = stations.map((s) => road.worldAt(s, -w));
  const right = stations.map((s) => road.worldAt(s, w)).reverse();
  return projectPolygon(cam, [...left, ...right]);
}

/** stage 5 (partial) — the sight tint band: road surface from the station to s + sight_m. */
function sightBandPolygon(cam: Camera, road: ComposedRoad, fromS: number, sight_m: number): readonly Pt[] | null {
  const to = Math.min(fromS + Math.max(sight_m, 0), road.total_len_m);
  if (to <= fromS) return null;
  const stations = stationsForward(fromS, to);
  const w = road.lane_width_m;
  const left = stations.map((s) => road.worldAt(s, -w));
  const right = stations.map((s) => road.worldAt(s, w)).reverse();
  return projectPolygon(cam, [...left, ...right]);
}

/** stage 3 — centreline (unless use_full_width) + both lane edges. */
function laneLines(cam: Camera, road: ComposedRoad, fromS: number): readonly (readonly Pt[])[] {
  const to = Math.min(fromS + POV_LOOKAHEAD_M, road.total_len_m);
  const stations = stationsForward(fromS, to);
  const w = road.lane_width_m;
  const out: (readonly Pt[])[] = [];
  const push = (d: number): void => {
    const line = projectPolyline(cam, stations.map((s) => road.worldAt(s, d)));
    if (line !== null) out.push(line);
  };
  push(-w);
  push(w);
  if (!road.use_full_width) push(0);
  return out;
}

/**
 * stage 4 — one occluder extruded to its kind's presentation height (§5.3
 * item 4). Each footprint edge becomes a vertical quad `[baseA, baseB, topB,
 * topA]`; quads sort far→near (painter's order) so the near face paints over
 * the road, "the road visibly disappears behind the occluder". Height is owned
 * HERE (POV_OCCLUDER_HEIGHT_M).
 */
function extrudeOccluder(cam: Camera, fp: OpaqueFootprint): PovOccluder {
  const h = POV_OCCLUDER_HEIGHT_M[fp.kind];
  const poly = fp.polygon;
  const n = poly.length;
  const quads: { poly: readonly Pt[]; depthF: number }[] = [];
  for (let i = 0; i < n; i++) {
    const a = poly[i]!;
    const b = poly[(i + 1) % n]!;
    const midX = (a.x + b.x) / 2;
    const midY = (a.y + b.y) / 2;
    const depthF = forwardOf(cam, midX, midY);
    if (depthF <= POV_NEAR_M) continue; // the whole edge is behind the near plane
    const quad = projectPolygon(cam, [
      { x: a.x, y: a.y, z: 0 },
      { x: b.x, y: b.y, z: 0 },
      { x: b.x, y: b.y, z: h },
      { x: a.x, y: a.y, z: h }
    ]);
    if (quad !== null) quads.push({ poly: quad, depthF });
  }
  quads.sort((p, q) => q.depthF - p.depthF); // far first
  return { id: fp.id, kind: fp.kind, quads: quads.map((qd) => qd.poly) };
}

/** stage 6 — the focused line's samples ahead of the cursor, projected to ground. */
function pathOverlay(cam: Camera, line: LineResult, fromS: number): { points: readonly Pt[]; colour: string } | null {
  const ahead = line.trajectory.samples.filter((s) => s.s >= fromS);
  const pts = projectPolyline(cam, ahead.map((s) => ({ x: s.x, y: s.y })));
  if (pts === null) return null;
  return { points: pts, colour: QUALITY_COLOUR[line.verdict.quality] };
}

/**
 * stage 7 — the limit-point marker transform (design/07 §5.3 item 7 / §2.5).
 * The world source is the recorded `(limit_x, limit_y)` — CONSUMED, never
 * recomputed (C-POV-LIMIT-CONSISTENT). Exactly one marker per frame (D40).
 */
function limitMarker(cam: Camera, sample: Sample, trend: SightTrend): PovLimitMarker {
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
    const p = rotAbout(cam.P0, { x: cam.P0.x + u, y: v }, -cam.phiRad);
    if (p.x >= R.x0 && p.x <= R.x1 && p.y >= R.y0 && p.y <= R.y1) {
      return { world, markerState: "placed", screen: p, arrow: null, trend };
    }
    const dir = unit({ x: p.x - cam.P0.x, y: p.y - cam.P0.y });
    return { world, markerState: "clamped", screen: rayToRect(cam.P0, dir, R), arrow: { dx: dir.x, dy: dir.y, length: arrowLen }, trend };
  }

  // F ≤ near_m: the limit point is off to the side at eye level (§5.3 item 7).
  const L = dx * cam.lat.x + dy * cam.lat.y;
  const signL = L > 0 ? 1 : L < 0 ? -1 : 1;
  const dir = rot({ x: signL, y: 0 }, -cam.phiRad);
  return { world, markerState: "clamped", screen: rayToRect(cam.P0, dir, R), arrow: { dx: dir.x, dy: dir.y, length: arrowLen }, trend };
}

function unit(v: Pt): Pt {
  const m = Math.hypot(v.x, v.y);
  return m < 1e-9 ? { x: 1, y: 0 } : { x: v.x / m, y: v.y / m };
}

/** intersection of ray `P0 + k·dir (k>0)` with the boundary of interior rect R (unique — P0 is interior). */
function rayToRect(P0: Pt, dir: Pt, R: { x0: number; y0: number; x1: number; y1: number }): Pt {
  const EPS = 1e-9;
  const tx = dir.x > EPS ? (R.x1 - P0.x) / dir.x : dir.x < -EPS ? (R.x0 - P0.x) / dir.x : Infinity;
  const ty = dir.y > EPS ? (R.y1 - P0.y) / dir.y : dir.y < -EPS ? (R.y0 - P0.y) / dir.y : Infinity;
  const k = Math.min(tx, ty);
  if (!Number.isFinite(k) || k <= 0) return { x: P0.x, y: P0.y };
  return { x: P0.x + k * dir.x, y: P0.y + k * dir.y };
}

/** stage 8 — the heading tick on the horizon, only under `look: limit_point` (disclosing the head-turn). */
function headingTick(cam: Camera, sample: Sample, look: PovLook): Pt | null {
  if (look !== "limit_point") return null;
  const az = degToRad(wrapDeg(sample.psi - cam.yawDeg)); // heading azimuth in the camera frame
  if (Math.abs(az) >= Math.PI / 2 - 1e-3) return null; // heading behind/beside the camera plane
  const u = cam.f * Math.tan(az);
  return rotAbout(cam.P0, { x: cam.P0.x + u, y: cam.horizonY }, -cam.phiRad);
}

// ---------------------------------------------------------------------------
// povFrame — the pure draw list (design/07 §5.5's `frame()`)

/** Build the POV draw list for one cursor Sample. Pure; the design's `frame(result, lineId, cursor, look)`. */
export function povFrame(input: PovFrameInput): PovFrame {
  const W = input.width ?? POV_FRAME_W;
  const H = input.height ?? POV_FRAME_H;
  const { sample, look, road } = input;
  const cam = buildCamera(sample, look, W, H);
  const fromS = sample.s;

  const footprints = footprintsOf(road, input.occluders);
  const occluders = footprints.map((fp) => extrudeOccluder(cam, fp)).filter((o) => o.quads.length > 0);

  return {
    width: W,
    height: H,
    look,
    yaw_deg: cam.yawDeg,
    phi_deg: sample.phi,
    eye: { x: cam.eye.x, y: cam.eye.y },
    focal_px: cam.f,
    principal: cam.P0,
    ground: groundPolygon(cam),
    road: roadPolygon(cam, road, fromS),
    laneLines: laneLines(cam, road, fromS),
    sightBand: sightBandPolygon(cam, road, fromS, sample.sight_m),
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

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function n(x: number): number {
  const r = Math.round(x * 100) / 100;
  return Object.is(r, -0) ? 0 : r;
}
function attrs(a: Readonly<Record<string, string | number | undefined>>): string {
  return Object.entries(a)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => ` ${k}="${typeof v === "string" ? esc(v) : v}"`)
    .join("");
}
function leaf(tag: string, a: Readonly<Record<string, string | number | undefined>>): string {
  return `<${tag}${attrs(a)}/>`;
}
function ptsStr(pts: readonly Pt[]): string {
  return pts.map((p) => `${n(p.x)},${n(p.y)}`).join(" ");
}

function serialize(frame: PovFrame): string {
  const { width: W, height: H } = frame;
  let svg = `<svg${attrs({ xmlns: "http://www.w3.org/2000/svg", width: W, height: H, viewBox: `0 0 ${W} ${H}`, "data-view": "pov", "data-look": frame.look })}>`;

  // stage 1 — sky fill, then ground below the rolled horizon
  svg += leaf("rect", { x: 0, y: 0, width: W, height: H, fill: POV_SKY, "data-stage": "1-sky" });
  svg += leaf("polygon", { points: ptsStr(frame.ground), fill: POV_GROUND, "data-stage": "1-ground" });

  // stage 2 — road surface
  if (frame.road !== null) {
    svg += leaf("polygon", { points: ptsStr(frame.road), fill: POV_ROAD, stroke: "none", "data-stage": "2-road-surface" });
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
  if (frame.sightBand !== null) {
    svg += leaf("polygon", { points: ptsStr(frame.sightBand), fill: POV_SIGHT_TINT, "fill-opacity": 0.12, "data-stage": "5-sight-band" });
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

  // stage 6 — path overlay (verdict colour)
  if (frame.path !== null) {
    svg += leaf("polyline", {
      points: ptsStr(frame.path.points),
      fill: "none",
      stroke: frame.path.colour,
      "stroke-width": 3,
      "stroke-opacity": 0.9,
      "data-stage": "6-path"
    });
  }

  // stage 7 — the limit-point marker (unconditional; exactly one)
  svg += serializeLimit(frame);

  // stage 8 — HUD strip + heading tick (limit_point only)
  svg += serializeHud(frame);

  svg += `</svg>`;
  return svg;
}

function serializeLimit(frame: PovFrame): string {
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

function serializeHud(frame: PovFrame): string {
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
  const deficit = hud.ssd_m > hud.sight_ride_m;
  const text =
    `v ${n(hud.v_kmh)} km/h   φ ${n(hud.phi_deg)}°   ` +
    `sight ${n(hud.sight_ride_m)} m / ssd ${n(hud.ssd_m)} m${deficit ? "  ▶ deficit" : ""}${hud.clipped ? "   [clip]" : ""}`;
  s += `<text${attrs({ x: 10, y: stripY + 22, "font-family": "sans-serif", "font-size": 15, fill: "#e8e8e8" })}>${esc(text)}</text>`;
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
export function renderPov(input: PovFrameInput): string {
  try {
    return serialize(povFrame(input));
  } catch (e) {
    return fallbackSvg(e instanceof Error ? e.message : String(e));
  }
}

// ---------------------------------------------------------------------------
// Figure-level convenience — pick a focused line + a default cursor and render.
// This is what render/index.ts's `renderViews({target:"pov"})` calls: the
// static POV render target (a future rasterizer emits sequences, §5.5).

/** The focused line: ideal wins, else the highest-priority role in draw order, else the first. */
export function povFocusLine(lines: readonly LineResult[]): LineResult | undefined {
  if (lines.length === 0) return undefined;
  return [...lines].sort((a, b) => roleRank(b.role) - roleRank(a.role))[0];
}

/** A deterministic default cursor sample: nearest the first corner's mid-station, else the mid sample. */
export function povDefaultSample(road: ComposedRoad, line: LineResult): Sample | undefined {
  const samples = line.trajectory.samples;
  if (samples.length === 0) return undefined;
  const c0 = road.corners[0];
  const targetS = c0 !== undefined ? c0.s_mid : samples[Math.floor(samples.length / 2)]!.s;
  return samples.reduce((a, b) => (Math.abs(b.s - targetS) < Math.abs(a.s - targetS) ? b : a));
}

/** presentation trend from the neighbouring recorded sight_m (opening/closing/steady). */
function trendAt(line: LineResult, sample: Sample): SightTrend {
  const samples = line.trajectory.samples;
  const i = samples.indexOf(sample);
  const next = i >= 0 && i + 1 < samples.length ? samples[i + 1] : undefined;
  if (next === undefined) return "steady";
  const d = next.sight_m - sample.sight_m;
  if (d > 0.5) return "opening";
  if (d < -0.5) return "closing";
  return "steady";
}

/**
 * The static POV render target: pick the focused line + default cursor and
 * emit a self-contained SVG. `null`-safe — an empty/sampleless line yields a
 * `fallbackSvg` (never throws).
 */
export function renderPovForFigure(road: ComposedRoad, lines: readonly LineResult[], look: PovLook): string {
  const line = povFocusLine(lines);
  if (line === undefined) return fallbackSvg("pov: no drawable line");
  const sample = povDefaultSample(road, line);
  if (sample === undefined) return fallbackSvg("pov: focused line has no samples");
  const occluders = line.resolved_scenario.occluders ?? [];
  return renderPov({ road, occluders, line, sample, look, trend: trendAt(line, sample) });
}
