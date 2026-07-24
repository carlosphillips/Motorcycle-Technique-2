// render/topdown.ts — `renderTopdown(drawnScene, style?) → SvgString`
// (design/06 §3). A pure string builder: no DOM, no IO, never throws
// (try/catch → `fallbackSvg`, carried). Projection-agnostic: every layout
// decision was `project()`'s (§3 intro, §3.2) — this file only draws what a
// `DrawnScene` already carries, in the fixed 11-stage order (§3.1), with
// stage 5b (the D45 continuation fan) ABSENT per the v0.1 phase law (00 §3:
// "permanently evidence-only... absent from every committed book scene" until
// `S-CONT-SEPARATION-v2` lands) — there is no `DrawnScene.fan` field to draw.
//
// Deviation (recorded per this package's return): stage 11's "entry
// annotation" (off-window approach arrow + speed chip) is omitted —
// `footnote` is `null` in v0.1 true mode (§2.7's disclosure footnote is
// diagram-mode-only chrome) so stage 11 only draws the legend.

import type { DrawnScene, DrawnLine, DrawnMarker, DrawnOccluder, DrawnPoint } from "./scene.js";
import { fallbackSvg } from "./fallback.js";
import { QUALITY_COLOUR, OCCLUSION_ALPHA, NOMINAL_FRAME_PX, GRAVEL_STIPPLE_RADIUS } from "./constants.js";
import { SIGHT_RAY_INK, LEADER_INK, trajectoryInk, glyphKeepsArrowhead } from "./ink.js";
import type { Quality } from "../plan/doctrine/quality.js";

export interface RenderStyle {
  readonly backgroundColour?: string;
}

// ---------------------------------------------------------------------------
// Tiny well-formed-SVG string helpers (self-closing leaves, explicit closes)

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
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
function open(tag: string, a: Readonly<Record<string, string | number | undefined>> = {}): string {
  return `<${tag}${attrs(a)}>`;
}
function close(tag: string): string {
  return `</${tag}>`;
}
function textEl(a: Readonly<Record<string, string | number | undefined>>, content: string): string {
  return `${open("text", a)}${esc(content)}${close("text")}`;
}

const QUALITIES: readonly Quality[] = ["good", "caution", "failing"];

function points(pts: readonly { readonly x: number; readonly y: number }[]): string {
  return pts.map((p) => `${p.x},${p.y}`).join(" ");
}

function boundsOf(scene: DrawnScene): { minX: number; minY: number; maxX: number; maxY: number } {
  const all = [
    ...scene.road.left,
    ...scene.road.right,
    ...scene.lines.flatMap((l) => l.polyline),
    ...scene.occluders.flatMap((o) => o.footprint),
    ...scene.hazards.flatMap((h) => h.footprint),
    ...scene.markers.map((m) => m.at),
    ...scene.labels.map((l) => l.anchor)
  ];
  if (all.length === 0) return { minX: 0, minY: 0, maxX: 1, maxY: 1 };
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of all) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return { minX, minY, maxX, maxY };
}

// ---------------------------------------------------------------------------
// Stage builders

function stageBackground(vbX: number, vbY: number, vbW: number, vbH: number, bg: string): string {
  return leaf("rect", { x: vbX, y: vbY, width: vbW, height: vbH, fill: bg, "data-stage": "1-background" });
}

function stageRoadSurface(scene: DrawnScene): string {
  const poly = [...scene.road.left, ...[...scene.road.right].reverse()];
  return leaf("polygon", { points: points(poly), fill: "#c9c9c9", stroke: "none", "data-stage": "2-road-surface" });
}

function stageLaneMarkings(scene: DrawnScene, pxScale: number): string {
  const w = pxScale * 1.0;
  let s = open("g", { "data-stage": "3-lane-markings" });
  s += leaf("polyline", { points: points(scene.road.left), fill: "none", stroke: "#f2f2f2", "stroke-width": w });
  s += leaf("polyline", { points: points(scene.road.right), fill: "none", stroke: "#f2f2f2", "stroke-width": w });
  if (!scene.road.use_full_width) {
    s += leaf("polyline", {
      points: points(scene.road.centre),
      fill: "none",
      stroke: "#f2f2f2",
      "stroke-width": w,
      "stroke-dasharray": `${pxScale * 4} ${pxScale * 3}`
    });
  }
  s += close("g");
  return s;
}

const OCCLUDER_FILL: Record<string, string> = { hedge: "#4c7a4c", wall: "#8a8a8a", bank: "#a8875a", vehicle: "#6b6b8a" };

/**
 * design/06 §3.1 stage 5 schematic differentiation: the footprint polygon
 * stays the base geometry (position/extent, unchanged from `sight/
 * footprints.ts`'s own band/rectangle); each kind adds its own glyph read on
 * top — hedge (organic blob: bumps along the band midline), wall (hatched
 * band: cross-ticks inner→outer), bank (contoured band: two offset contour
 * lines), vehicle (rounded rectangle stand-in + a windshield-hint band across
 * the front third — the footprint's own point order is
 * `[frontL, frontR, rearR, rearL]`, `sight/footprints.ts`'s `vehicleFootprint`).
 */
function occluderGlyphSvg(o: DrawnOccluder, pxScale: number): string {
  const common = { "data-occluder-kind": o.kind, "data-occluder-id": o.id };
  const base = leaf("polygon", {
    points: points(o.footprint),
    fill: OCCLUDER_FILL[o.kind] ?? "#888888",
    "fill-opacity": 0.75,
    stroke: "#333333",
    "stroke-width": 0.3,
    ...common
  });

  if (o.kind === "vehicle") {
    const [frontL, frontR, rearR, rearL] = o.footprint;
    if (frontL === undefined || frontR === undefined || rearR === undefined || rearL === undefined) return base;
    const t = 0.28; // windshield band depth, front third of the rectangle
    const wsL = { x: frontL.x + (rearL.x - frontL.x) * t, y: frontL.y + (rearL.y - frontL.y) * t };
    const wsR = { x: frontR.x + (rearR.x - frontR.x) * t, y: frontR.y + (rearR.y - frontR.y) * t };
    return (
      base +
      leaf("polygon", { points: points([frontL, frontR, wsR, wsL]), fill: "#cfd6e6", "fill-opacity": 0.6, stroke: "none", ...common })
    );
  }

  // hedge/wall/bank footprints are `[...inner, ...outer.reverse()]` (band
  // kinds, sight/footprints.ts's `bandFootprint`) — equal-length halves,
  // station-paired: `footprint[i]` (inner) with `footprint[n - 1 - i]` (outer).
  const n = Math.floor(o.footprint.length / 2);
  if (n === 0) return base;
  const inner = o.footprint.slice(0, n);
  const outer = [...o.footprint.slice(n)].reverse();

  if (o.kind === "hedge") {
    let bumps = "";
    for (let i = 0; i < n; i++) {
      const a = inner[i]!;
      const b = outer[i]!;
      bumps += leaf("circle", {
        cx: (a.x + b.x) / 2,
        cy: (a.y + b.y) / 2,
        r: pxScale * 1.4,
        fill: OCCLUDER_FILL.hedge,
        "fill-opacity": 0.85,
        stroke: "#2f4d2f",
        "stroke-width": pxScale * 0.2,
        ...common
      });
    }
    return base + bumps;
  }

  if (o.kind === "wall") {
    let hatch = "";
    for (let i = 0; i < n; i++) {
      const a = inner[i]!;
      const b = outer[i]!;
      hatch += leaf("line", { x1: a.x, y1: a.y, x2: b.x, y2: b.y, stroke: "#4a4a4a", "stroke-width": pxScale * 0.6, ...common });
    }
    return base + hatch;
  }

  // bank: two contour lines between inner/outer, at 1/3 and 2/3 depth.
  let contours = "";
  for (const frac of [0.33, 0.66]) {
    const line = inner.map((a, i) => {
      const b = outer[i]!;
      return { x: a.x + (b.x - a.x) * frac, y: a.y + (b.y - a.y) * frac };
    });
    contours += leaf("polyline", { points: points(line), fill: "none", stroke: "#6b5230", "stroke-width": pxScale * 0.6, ...common });
  }
  return base + contours;
}

function stageOccluders(scene: DrawnScene, pxScale: number): string {
  let s = open("g", { "data-stage": "5-occluders" });
  for (const o of scene.occluders) s += occluderGlyphSvg(o, pxScale);
  s += close("g");
  return s;
}

/**
 * Stage 4 — gravel surface patches (§3.1 stage 4): explicit stippled circles,
 * no SVG `<pattern>` (rasterizes predictably everywhere). Positions/radii are
 * `project()`'s deterministic grid (`DrawnHazard.stipples`) — never generated
 * here.
 */
function stageGravel(scene: DrawnScene, pxScale: number): string {
  if (scene.hazards.length === 0) return "";
  let s = open("g", { "data-stage": "4-gravel" });
  const r = pxScale * GRAVEL_STIPPLE_RADIUS;
  for (const h of scene.hazards) {
    for (const p of h.stipples) {
      s += leaf("circle", {
        cx: p.x,
        cy: p.y,
        r,
        fill: "#9c8a6b",
        "fill-opacity": 0.8,
        stroke: "#6b5d45",
        "stroke-width": pxScale * 0.3,
        "data-hazard-id": h.id,
        "data-hazard-kind": h.kind
      });
    }
  }
  s += close("g");
  return s;
}

/**
 * Stage 6 — occluded-region shading (§3.1 stage 6): the road strip from the
 * designated sight ray's `s_limit` onward, precomputed by `project()`
 * (`scene.occlusionWash`, `null` when no line carries a resolved ray) — this
 * file only draws the polygon it is handed.
 */
function stageOcclusion(scene: DrawnScene): string {
  if (scene.occlusionWash === null) return "";
  return leaf("polygon", {
    points: points(scene.occlusionWash),
    fill: "#333333",
    "fill-opacity": OCCLUSION_ALPHA,
    "data-stage": "6-occlusion"
  });
}

function stageSightRays(scene: DrawnScene, pxScale: number): string {
  let s = open("g", { "data-stage": "7-sight-rays" });
  for (const line of scene.lines) {
    if (line.sightRay === null) continue;
    s += leaf("line", {
      x1: line.sightRay.from.x,
      y1: line.sightRay.from.y,
      x2: line.sightRay.to.x,
      y2: line.sightRay.to.y,
      stroke: line.sightRay.colour,
      "stroke-width": pxScale * SIGHT_RAY_INK.width,
      "stroke-dasharray": SIGHT_RAY_INK.dash
        .split(" ")
        .map((n) => Number(n) * pxScale)
        .join(" "),
      "stroke-opacity": SIGHT_RAY_INK.opacity,
      "data-ray-line": line.line_id
    });
  }
  s += close("g");
  return s;
}

// Terminal-glyph proportions (design/06 §3.1 stage 8 fixes the vocabulary, and
// marks the sizes TUNING/presentation-only): px at the nominal 1000 px frame.
const TERMINAL_R_PX = 4;
/** `off_road` edge tick: half-length along the road edge. Sized to read beside the arrowhead at raster scale — the 4 px half-length it replaces did not. */
const EDGE_TICK_HALF_LEN_PX = 8;
const EDGE_TICK_WIDTH_PX = 2.6;

function terminalGlyphSvg(line: DrawnLine, pxScale: number): string {
  const t = line.terminal;
  const r = pxScale * TERMINAL_R_PX;
  const common = { "data-terminal-reason": t.reason, "data-line-id": line.line_id };
  if (t.glyph === "burst") {
    return (
      leaf("line", { x1: t.at.x - r, y1: t.at.y - r, x2: t.at.x + r, y2: t.at.y + r, stroke: line.colour, "stroke-width": pxScale * 1.5, ...common }) +
      leaf("line", { x1: t.at.x - r, y1: t.at.y + r, x2: t.at.x + r, y2: t.at.y - r, stroke: line.colour, "stroke-width": pxScale * 1.5, ...common })
    );
  }
  if (t.glyph === "bar") {
    const rad = (t.heading_deg * Math.PI) / 180;
    const nx = -Math.sin(rad);
    const ny = Math.cos(rad);
    return leaf("line", {
      x1: t.at.x - nx * r,
      y1: t.at.y - ny * r,
      x2: t.at.x + nx * r,
      y2: t.at.y + ny * r,
      stroke: line.colour,
      "stroke-width": pxScale * 1.5,
      ...common
    });
  }
  if (t.glyph === "arrow_tick") {
    // design/06 §3.1 stage 8, `off_road`: "arrowhead on the edge crossing + a
    // short tick ALONG THE ROAD EDGE at the crossing". The tick therefore runs
    // parallel to the edge tangent `project()` measured — NOT transverse to
    // the rider's heading, which is what the earlier spelling drew: a 1 px,
    // 8 px-long stroke laid across the road, indistinguishable from the
    // `stopped` bar and invisible at raster scale (every J5 judge read
    // fig-08-04's runoff terminal as "a plain arrowhead"). Falls back to the
    // line's own heading only if no edge tangent was supplied.
    const rad = ((t.edge_heading_deg ?? t.heading_deg) * Math.PI) / 180;
    const ux = Math.cos(rad);
    const uy = Math.sin(rad);
    const half = pxScale * EDGE_TICK_HALF_LEN_PX;
    return leaf("line", {
      x1: t.at.x - ux * half,
      y1: t.at.y - uy * half,
      x2: t.at.x + ux * half,
      y2: t.at.y + uy * half,
      stroke: line.colour,
      "stroke-width": pxScale * EDGE_TICK_WIDTH_PX,
      "stroke-linecap": "butt",
      ...common
    });
  }
  return ""; // plain "arrow" — the polyline's own marker-end arrowhead is the whole glyph
}

function stageLines(scene: DrawnScene, pxScale: number): string {
  let s = open("g", { "data-stage": "8-lines" });
  for (const line of scene.lines) {
    const ink = trajectoryInk(line.role);
    const arrowOn = glyphKeepsArrowhead(line.terminal.glyph);
    s += leaf("polyline", {
      points: points(line.polyline),
      fill: "none",
      stroke: line.colour,
      "stroke-width": pxScale * ink.width,
      ...(ink.dash !== null
        ? {
            "stroke-dasharray": ink.dash
              .split(" ")
              .map((n) => Number(n) * pxScale)
              .join(" ")
          }
        : {}),
      "marker-end": arrowOn ? `url(#arrow-${line.quality})` : undefined,
      "data-line-id": line.line_id,
      "data-role": line.role,
      "data-quality": line.quality,
      "data-outcome": line.outcome
    });
    s += terminalGlyphSvg(line, pxScale);
  }
  s += close("g");
  return s;
}

// Marker-glyph proportions. design/06 §3.1 stage 9 fixes the marker
// VOCABULARY (hourglass / ring / dot / double-chevron) but no sizes — these
// are presentation-only locals at the nominal 1000 px frame, not design
// TUNING constants, so they live here rather than in render/constants.ts
// (ARCHITECTURE §6.6: "unnamed design literals get local names").
const MARKER_R_PX = 6;
/** hourglass end-bar half-width, as a fraction of `MARKER_R_PX` */
const HOURGLASS_END_HALF_W = 0.85;
/** hourglass waist half-width — strictly smaller than the end bars: THIS is the pinch that makes it an hourglass and not a rhombus. */
const HOURGLASS_WAIST_HALF_W = 0.18;
/** `exit` dot radius as a fraction of `MARKER_R_PX` — a filled disc strictly inside the `apex` ring's diameter, so the two never read alike. */
const EXIT_DOT_R = 0.6;
/** `apex` ring stroke width in px at the nominal frame — leaves a visible hole, which is what separates a ring from the `exit` dot. */
const APEX_RING_STROKE_PX = 1.8;

/**
 * The `turn_point` HOURGLASS outline (design/06 §3.1 stage 9), in drawn units:
 * six points, widest at the two ends, pinched at the waist. Exported so the
 * regression gate can assert the waist geometrically (the defect it replaces
 * was a solid rhombus — widest exactly where an hourglass is narrowest).
 */
export function hourglassPoints(cx: number, cy: number, r: number): readonly DrawnPoint[] {
  const halfW = r * HOURGLASS_END_HALF_W;
  const neck = r * HOURGLASS_WAIST_HALF_W;
  return [
    { x: cx - halfW, y: cy - r },
    { x: cx + halfW, y: cy - r },
    { x: cx + neck, y: cy },
    { x: cx + halfW, y: cy + r },
    { x: cx - halfW, y: cy + r },
    { x: cx - neck, y: cy }
  ];
}

function markerGlyphSvg(m: DrawnMarker, pxScale: number): string {
  // glyph radius: 6 px at the nominal 1000 px frame — presentation-only
  // (design/06 gives the marker VOCABULARY, not sizes; the earlier 3 px
  // radius rendered invisibly at raster scale — the all-six J2 judge fail).
  const r = pxScale * MARKER_R_PX;
  const common = { "data-marker-class": m.cls, "data-line-id": m.line_id };
  switch (m.cls) {
    case "apex":
      return leaf("circle", {
        cx: m.at.x,
        cy: m.at.y,
        r,
        fill: "none",
        stroke: m.colour,
        "stroke-width": pxScale * APEX_RING_STROKE_PX,
        ...common
      });
    case "exit":
      return leaf("circle", { cx: m.at.x, cy: m.at.y, r: r * EXIT_DOT_R, fill: m.colour, stroke: "none", ...common });
    case "turn_point": {
      // design/06 §3.1 stage 9: `turn_point` is an HOURGLASS — two triangles
      // meeting at a waist. The earlier spelling emitted [top,left,bot] +
      // [top,right,bot]: two triangles sharing the WHOLE top→bot edge, whose
      // union is a solid rhombus with its WIDEST point at the centre — the
      // exact inverse of an hourglass, and the "solid filled diamond, no
      // waist" every J2 judge reported. One hexagon, pinched at the middle:
      // widest at the two ends, narrowest at the waist.
      return leaf("polygon", { points: points(hourglassPoints(m.at.x, m.at.y, r)), fill: m.colour, "fill-opacity": 0.85, ...common });
    }
    case "release":
      return (
        leaf("line", { x1: m.at.x - r, y1: m.at.y - r, x2: m.at.x, y2: m.at.y, stroke: m.colour, "stroke-width": pxScale * 1.8, ...common }) +
        leaf("line", { x1: m.at.x - r, y1: m.at.y + r, x2: m.at.x, y2: m.at.y, stroke: m.colour, "stroke-width": pxScale * 1.8, ...common }) +
        leaf("line", { x1: m.at.x, y1: m.at.y - r, x2: m.at.x + r, y2: m.at.y, stroke: m.colour, "stroke-width": pxScale * 1.8, ...common }) +
        leaf("line", { x1: m.at.x, y1: m.at.y + r, x2: m.at.x + r, y2: m.at.y, stroke: m.colour, "stroke-width": pxScale * 1.8, ...common })
      );
  }
}

function stageMarkers(scene: DrawnScene, pxScale: number): string {
  let s = open("g", { "data-stage": "9-markers" });
  for (const m of scene.markers) s += markerGlyphSvg(m, pxScale);
  s += close("g");
  return s;
}

/**
 * Stage 10 (design/06 §3.1): each resolved callout draws a leader (solid,
 * neutral, `W_LEADER` — §5.2's ink row) from the anchor sample to a text box
 * placed toward the FRAME INTERIOR — a deterministic one-candidate stand-in
 * for the candidate-scoring box-repel pass (§3.1 stage 10), which keeps text
 * off the viewBox edges (the "clipped/swallowed" J3 judge fail: text placed
 * blindly rightward ran off the right frame edge). Sizes are presentation
 * constants at the nominal 1000 px frame; the white paint-order halo keeps
 * text readable over road/line ink without occluding geometry.
 */
function stageLabels(scene: DrawnScene, pxScale: number, vbX: number, vbY: number, vbW: number, vbH: number): string {
  const LABEL_FONT_PX = 15;
  const LEADER_LEN_PX = 22;
  const TEXT_GAP_PX = 4;
  let s = open("g", { "data-stage": "10-labels" });
  for (const label of scene.labels) {
    const rightHalf = label.anchor.x > vbX + vbW / 2;
    const topQuarter = label.anchor.y < vbY + vbH * 0.25;
    const boxX = label.anchor.x + (rightHalf ? -1 : 1) * pxScale * LEADER_LEN_PX;
    const boxY = label.anchor.y + (topQuarter ? 1 : -1) * pxScale * LEADER_LEN_PX;
    s += leaf("line", {
      x1: label.anchor.x,
      y1: label.anchor.y,
      x2: boxX,
      y2: boxY,
      stroke: LEADER_INK.colour,
      "stroke-width": pxScale * LEADER_INK.width
    });
    s += textEl(
      {
        x: boxX + (rightHalf ? -1 : 1) * pxScale * TEXT_GAP_PX,
        y: boxY + (topQuarter ? pxScale * LABEL_FONT_PX : -pxScale * 3),
        "font-size": pxScale * LABEL_FONT_PX,
        "font-family": "sans-serif",
        fill: "#222222",
        "text-anchor": rightHalf ? "end" : "start",
        "paint-order": "stroke",
        stroke: "#ffffff",
        "stroke-width": pxScale * 3,
        "stroke-opacity": 0.85,
        "stroke-linejoin": "round"
      },
      label.text
    );
  }
  s += close("g");
  return s;
}

function stageChrome(scene: DrawnScene, pxScale: number, vbX: number, vbY: number): string {
  let s = open("g", { "data-stage": "11-chrome" });
  if (scene.legend.visible) {
    const lineH = pxScale * 16;
    let y = vbY + pxScale * 14;
    const x = vbX + pxScale * 6;
    s += open("g", { "data-legend": "true" });
    for (const row of scene.legend.rows) {
      s += leaf("rect", {
        x,
        y: y - pxScale * 8,
        width: pxScale * 18,
        height: pxScale * 3,
        fill: row.swatch.colour,
        "data-legend-swatch": row.line_id
      });
      const text = `${row.name} — ${row.role} · ${row.quality}${row.outcome !== null ? ` (${row.outcome})` : ""}`;
      s += textEl(
        { x: x + pxScale * 22, y, "font-size": pxScale * 11, "font-family": "sans-serif", fill: "#222222", "data-legend-row": row.line_id },
        text
      );
      y += lineH;
    }
    s += close("g");
  }
  if (scene.footnote !== null) {
    s += textEl(
      { x: vbX + pxScale * 6, y: vbY + pxScale * 6, "font-size": pxScale * 9, "font-family": "sans-serif", fill: "#555555", "data-footnote": "true" },
      scene.footnote
    );
  }
  s += close("g");
  return s;
}

function defsArrowMarkers(): string {
  let s = open("defs");
  for (const q of QUALITIES) {
    s += open("marker", {
      id: `arrow-${q}`,
      viewBox: "0 0 10 10",
      refX: 8,
      refY: 5,
      markerWidth: 6,
      markerHeight: 6,
      orient: "auto-start-reverse"
    });
    s += leaf("path", { d: "M0,0 L10,5 L0,10 z", fill: QUALITY_COLOUR[q] });
    s += close("marker");
  }
  s += close("defs");
  return s;
}

// ---------------------------------------------------------------------------
// renderTopdown

function renderInner(scene: DrawnScene, style: RenderStyle | undefined): string {
  const box = boundsOf(scene);
  const pad = 1.08; // 8% content margin, local presentation constant (not a design TUNING literal)
  const contentW = Math.max(box.maxX - box.minX, 1e-3);
  const contentH = Math.max(box.maxY - box.minY, 1e-3);
  const vbW = Math.max(scene.frame.width, contentW) * pad;
  const vbH = Math.max(scene.frame.height, contentH) * pad;
  const cx = (box.minX + box.maxX) / 2;
  const cy = (box.minY + box.maxY) / 2;
  const vbX = cx - vbW / 2;
  const vbY = cy - vbH / 2;
  const pxScale = vbW / NOMINAL_FRAME_PX; // "at the nominal 1000 px frame" (design/06 §5.2) → user-unit conversion
  const pxHeight = Math.round(NOMINAL_FRAME_PX * (vbH / vbW));

  let svg = open("svg", {
    xmlns: "http://www.w3.org/2000/svg",
    width: NOMINAL_FRAME_PX,
    height: pxHeight,
    viewBox: `${vbX} ${vbY} ${vbW} ${vbH}`,
    "data-mode": scene.mode
  });
  svg += defsArrowMarkers();
  svg += stageBackground(vbX, vbY, vbW, vbH, style?.backgroundColour ?? "#e7ecd8");
  svg += stageRoadSurface(scene);
  svg += stageLaneMarkings(scene, pxScale);
  svg += stageGravel(scene, pxScale);
  svg += stageOccluders(scene, pxScale);
  // stage 5b (D45 continuation fan) — ABSENT per phase law (00 §3).
  svg += stageOcclusion(scene);
  svg += stageSightRays(scene, pxScale);
  svg += stageLines(scene, pxScale);
  svg += stageMarkers(scene, pxScale);
  svg += stageLabels(scene, pxScale, vbX, vbY, vbW, vbH);
  svg += stageChrome(scene, pxScale, vbX, vbY);
  svg += close("svg");
  return svg;
}

/**
 * `renderTopdown(drawnScene, style?) → SvgString` (design/06 §3). Projection-
 * agnostic: consumes only `drawnScene`; every layout decision (window, orient,
 * frame) was `project()`'s. Never throws — any failure is caught and returned
 * as `fallbackSvg(msg)` (carried, §3 intro).
 */
export function renderTopdown(drawnScene: DrawnScene, style?: RenderStyle): string {
  try {
    return renderInner(drawnScene, style);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return fallbackSvg(msg);
  }
}
