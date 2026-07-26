// render/controls.ts — `renderControls(lineResult, window?, cursor?) → SvgString`
// (design/06 §4; ARCHITECTURE §5's reservation, filled at v0.2 — 00 §3's
// inspection row: "the `controls` strip with linked cursor").
//
// The strip-chart of ONE focused line's control and state channels against
// **true station**. 06 §4's opening sentence is the whole discipline: "the
// strip is never projected; its `s` axis is honest metres with the diagram
// window marked as a shaded band, so the reader can always relate compressed
// drawing to true distance."
//
// "Never projected" is STRUCTURAL here, not a rule this file has to remember:
// every x is `LEFT_MARGIN + (s − s0)·PX_PER_M` read straight off the RECORDED
// sample array, and this file names no projection field anywhere — there is no
// code path that could consult `mode`, `width_exag`, `straight_compress` or
// `taper_compress`. The `window` parameter is a pair of TRUE stations (the
// caller passes the top-down view's resolved window, `DrawnScene.window`), and
// it is drawn as a shading band — never as a transform.
//
// Channels (06 §4, in the doc's own order):
//   1. `v` (km/h)
//   2. `phi` vs `cmd_lean` overlaid   — the stand-up deviation, visible
//   3. `cmd_a` split by sign (brake/throttle) with delivered `a_long`
//      overlaid WHERE CLIPPED
//   4. `grip`
//   5. `sight_ride_m` vs `ssd_m` overlaid, caption disclosing the rider-path
//      basis (D16); the vertical gap IS the sight margin
//   6. stand-up: `su_sustained` + `su_transient` overlaid pair
//
// `k_refuted` (06 §4's seventh, optional channel) is D45-gated and therefore
// ABSENT, not stubbed (phase law, 00 §3): nothing in this file names it.
//
// Phase bands are exactly 05 §4.1's five-token partition (D41). They are not
// re-derived: `openerPhaseFor` (core/analyze.ts — THE opener table, the same
// one `core/stateAt.ts` queries) maps this line's own recorded events to
// openers, so `C-STRIP-BANDS` ("band edges equal the phase-transition stations
// of the same result") holds by construction, not by agreement.
//
// Colour (D9/D11): `quality` is the SOLE colour source, and it is READ off the
// verdict (`lineResult.verdict.quality`), never re-derived. It tints exactly
// one element — the line-identity chip (06 §9's "controls strip's
// line-identifying chrome if any"). Every channel colour is neutral: 06 §4's
// hard rule is that channel colours never reuse the green/amber/red verdict
// palette, so nothing in the strip can be misread as a verdict.
//
// Pure, synchronous, never throws (`try/catch` → `fallbackSvg`, the render/
// house rule, §3 intro).

import type { LineResult } from "../solve/types.js";
import type { Phase, Sample } from "../core/types.js";
import { openerPhaseFor } from "../core/analyze.js";
import type { Segment } from "../road/types.js";
import { compose, cornerIdsOf } from "../road/compose.js";
import { stateAt } from "../core/stateAt.js";
import { sightTrendAt } from "../sight/analyze.js";
import { msToKmh } from "../core/units.js";
import { QUALITY_COLOUR } from "./constants.js";
import { fallbackSvg } from "./fallback.js";

// ---------------------------------------------------------------------------
// Input shapes

/**
 * A TRUE-station window — the caller passes the top-down view's resolved
 * window (`DrawnScene.window` = `{from_s, to_s}`) so the shaded band marks
 * exactly the span the drawing shows (06 §4).
 */
export interface ControlsWindow {
  readonly from: number;
  readonly to: number;
}

// ---------------------------------------------------------------------------
// Layout (local names, no TUNING status — ARCHITECTURE §6.6: design/06 spells
// no controls-strip geometry, so these are this file's own presentation knobs
// and belong to no shared constants table)

const PX_PER_M = 4;
const LEFT_MARGIN = 76;
const RIGHT_MARGIN = 18;
const HEADER_HEIGHT = 26;
const BAND_HEIGHT = 16;
const PANEL_HEIGHT = 62;
const PANEL_GAP = 16;
const AXIS_HEIGHT = 30;
const MIN_PLOT_WIDTH = 160;
const CHIP_HEIGHT = 13;
const TITLE_FONT_PX = 9;
/**
 * Width of one character at `TITLE_FONT_PX` in the sans stack, near enough for
 * layout. The strip sized its viewBox from the PLOT alone, so a title longer
 * than the plot ran off the edge of the SVG and was cut mid-word — on a 26 m
 * line every panel caption was truncated. There is no text metric in a pure
 * string builder, so the estimate is the mechanism; it only ever adds width.
 */
const TITLE_CHAR_W_PX = TITLE_FONT_PX * 0.58;

/** the six channel panels of 06 §4, in the doc's order */
const PANEL_IDS = ["v", "lean", "commands", "grip", "sight", "standup"] as const;
export type ControlsPanelId = (typeof PANEL_IDS)[number];

/**
 * Panel titles, in riding words.
 *
 * The strip is the one place a reader can see WHY a line went wrong — and it
 * was captioned `phi vs cmd_lean`, `cmd_a split by sign · a_long overlaid where
 * clipped`, `su_sustained + su_transient`. Those are the engine's own field
 * names: correct, and unreadable to the rider the figures are for. The channel
 * keys at each panel's corner (and every trace's `data-channel`) still carry
 * the field names, so nothing machine-readable was lost.
 */
const PANEL_TITLES: Readonly<Record<ControlsPanelId, string>> = Object.freeze({
  v: "Speed (km/h)",
  lean: "Lean — asked for, and delivered (°)",
  commands: "Brake and throttle — commanded, and what the tyre allowed (m/s²)",
  grip: "Grip in reserve (1 = untouched · 0 = at the limit)",
  // the "same rider-path basis" clause is NORMATIVE (06 §4, D16): sight and
  // stopping distance are only comparable because they are measured along the
  // same path, and the strip has to say so. It rides after the rider's question.
  sight: "Can you stop inside what you can see? (m) — same rider-path basis (05 §2.1)",
  standup: "Stand-up — lean handed back mid-corner (°/s)"
});

/**
 * Panels whose quantity has a fixed, meaningful range get a fixed axis, so the
 * limit is on the page even when the line never approaches it. Auto-scaling
 * `grip` to its own extent hid the only number that matters: a line whose grip
 * never drops below 0.37 was drawn touching the panel floor, exactly like one
 * that ran out of road.
 */
const PANEL_FIXED_EXTENT: Partial<Record<ControlsPanelId, Extent>> = Object.freeze({
  grip: { min: 0, max: 1 }
});

/** Grip below this is the "nearly out" band, shaded so it reads before the numbers do. */
const GRIP_DANGER = 0.15;

// Neutral channel palette. 06 §4's hard rule: never the verdict palette
// (#1f6f43 / #b07d1e / #b32e2e — render/constants.ts QUALITY_COLOUR).
const INK_PRIMARY = "#2f4b7c";
const INK_SECONDARY = "#6b6f76";
const INK_AXIS = "#5a5a5a";
const INK_GRID = "#d8d8d8";
const INK_ZERO = "#a8a8a8";
const INK_BAND_A = "#eeeeee";
const INK_BAND_B = "#e2e2e2";
const INK_WINDOW = "#111111";
const INK_CURSOR = "#3d3d3d";
const INK_CHIP_BG = "#ffffff";

/** the neutral inks this file may stroke a CHANNEL with (asserted by the strip tests) */
export const CONTROLS_NEUTRAL_INKS: readonly string[] = Object.freeze([
  INK_PRIMARY,
  INK_SECONDARY,
  INK_AXIS,
  INK_GRID,
  INK_ZERO,
  INK_BAND_A,
  INK_BAND_B,
  INK_WINDOW,
  INK_CURSOR,
  INK_CHIP_BG
]);

// ---------------------------------------------------------------------------
// SVG string helpers (self-contained output, 06 §7: inline fill/stroke only,
// no external CSS/fonts/url(), no SMIL, no <pattern>)

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

type Attrs = Readonly<Record<string, string | number | undefined>>;

function attrs(a: Attrs): string {
  return Object.entries(a)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => ` ${k}="${typeof v === "string" ? esc(v) : v}"`)
    .join("");
}
function leaf(tag: string, a: Attrs): string {
  return `<${tag}${attrs(a)}/>`;
}
function open(tag: string, a: Attrs = {}): string {
  return `<${tag}${attrs(a)}>`;
}
function textEl(a: Attrs, content: string): string {
  return `<text${attrs(a)}>${esc(content)}</text>`;
}

/** 3 dp, `-0` normalised — keeps the SVG byte-stable across platforms (§6.2). */
function n3(x: number): number {
  const r = Number(x.toFixed(3));
  return Object.is(r, -0) ? 0 : r;
}

// ---------------------------------------------------------------------------
// The phase partition (05 §4.1, D41) — read through THE opener table

export interface PhaseBand {
  readonly phase: Phase;
  readonly from_s: number;
  readonly to_s: number;
}

/**
 * The road's last corner id, read through `road/compose.ts`'s OWN minting rule
 * (`cornerIdsOf`) rather than a second copy of it — there is one corner-id
 * grammar in this codebase and this file does not restate it.
 * (`ResolvedRoadSpec.segments` is `unknown[]` at core rank, ARCHITECTURE §4;
 * render/ sits after road/ in the DAG and may name the real union.)
 */
export function lastCornerIdOf(segments: readonly unknown[]): string | null {
  const ids = cornerIdsOf(segments as readonly Segment[]);
  return ids.length > 0 ? ids[ids.length - 1]! : null;
}

/**
 * The line's phase spans over TRUE station. One band per phase span, in
 * opener order; the run's first sample opens `approach` (05 §4.1's implicit
 * opener) and each opener event closes the previous band at its own exact
 * station. Adjacent openers that re-open the SAME phase are merged — a band is
 * a span, not an event.
 */
export function phaseBandsOf(line: LineResult): readonly PhaseBand[] {
  const samples = line.trajectory.samples;
  const first = samples[0];
  if (first === undefined) return [];
  const endS = line.trajectory.terminated.s;
  const lastCornerId = lastCornerIdOf(line.resolved_scenario.road.segments);

  const openers: { s: number; phase: Phase }[] = [{ s: first.s, phase: "approach" }];
  for (const event of line.trajectory.events) {
    const phase = openerPhaseFor(event, lastCornerId);
    if (phase !== null) openers.push({ s: event.s, phase });
  }

  const bands: PhaseBand[] = [];
  for (let i = 0; i < openers.length; i++) {
    const o = openers[i]!;
    const to = i + 1 < openers.length ? openers[i + 1]!.s : endS;
    if (!(to > o.s)) continue;
    const prev = bands[bands.length - 1];
    if (prev !== undefined && prev.phase === o.phase && Math.abs(prev.to_s - o.s) < 1e-9) {
      bands[bands.length - 1] = { phase: prev.phase, from_s: prev.from_s, to_s: to };
      continue;
    }
    bands.push({ phase: o.phase, from_s: o.s, to_s: to });
  }
  return bands;
}

// ---------------------------------------------------------------------------
// Channel extraction

interface Series {
  readonly label: string;
  readonly values: readonly number[];
  /** draw only over the index runs where this predicate holds (06 §4's "where clipped") */
  readonly gate?: readonly boolean[];
}

interface PanelSeries {
  readonly primary: Series;
  readonly secondary?: Series;
  /** draw a zero rule — the sign split of 06 §4's brake/throttle channel */
  readonly zeroRule: boolean;
}

function seriesFor(panel: ControlsPanelId, samples: readonly Sample[]): PanelSeries {
  switch (panel) {
    case "v":
      // km/h through core/units.ts's msToKmh — ARCHITECTURE §6.1 names units.ts
      // "the ONLY conversion helpers", and drift risk #1 forbids inline factors.
      return { primary: { label: "v", values: samples.map((p) => msToKmh(p.v)) }, zeroRule: false };
    case "lean":
      return {
        primary: { label: "phi", values: samples.map((p) => p.phi) },
        secondary: { label: "cmd_lean", values: samples.map((p) => p.cmd_lean) },
        zeroRule: true
      };
    case "commands":
      return {
        primary: { label: "cmd_a", values: samples.map((p) => p.cmd_a) },
        secondary: {
          label: "a_long (clipped)",
          values: samples.map((p) => p.a_long),
          gate: samples.map((p) => p.clipped)
        },
        zeroRule: true
      };
    case "grip":
      return { primary: { label: "grip", values: samples.map((p) => p.grip) }, zeroRule: false };
    case "sight":
      return {
        primary: { label: "sight_ride_m", values: samples.map((p) => p.sight_ride_m) },
        secondary: { label: "ssd_m", values: samples.map((p) => p.ssd_m) },
        zeroRule: false
      };
    case "standup":
      return {
        primary: { label: "su_sustained", values: samples.map((p) => p.su_sustained) },
        secondary: { label: "su_transient", values: samples.map((p) => p.su_transient) },
        zeroRule: true
      };
  }
}

// ---------------------------------------------------------------------------
// Scales

interface Extent {
  readonly min: number;
  readonly max: number;
}

function extentOf(values: readonly number[]): Extent {
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  for (const v of values) {
    if (!Number.isFinite(v)) continue;
    if (v < min) min = v;
    if (v > max) max = v;
  }
  if (!Number.isFinite(min) || !Number.isFinite(max)) return { min: 0, max: 1 };
  if (max - min < 1e-9) return { min: min - 1, max: max + 1 };
  return { min, max };
}

function niceStep(range: number, targetTicks: number): number {
  if (!(range > 0)) return 1;
  const raw = range / Math.max(targetTicks, 1);
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;
  return (norm < 1.5 ? 1 : norm < 3.5 ? 2 : norm < 7.5 ? 5 : 10) * mag;
}

// ---------------------------------------------------------------------------
// Drawing

function polylineRuns(
  samples: readonly Sample[],
  values: readonly number[],
  gate: readonly boolean[] | undefined,
  x: (s: number) => number,
  y: (v: number) => number
): readonly string[] {
  const runs: string[] = [];
  let current: string[] = [];
  for (let i = 0; i < samples.length; i++) {
    const on = gate === undefined || gate[i] === true;
    const v = values[i];
    if (!on || v === undefined || !Number.isFinite(v)) {
      if (current.length > 1) runs.push(current.join(" "));
      current = [];
      continue;
    }
    current.push(`${n3(x(samples[i]!.s))},${n3(y(v))}`);
  }
  if (current.length > 1) runs.push(current.join(" "));
  return runs;
}

/**
 * A y-axis extreme, rounded for reading. `53.865 km/h` is three digits of
 * precision the rider has no use for and the integrator does not claim.
 */
function axisLabel(v: number): string {
  const r = Math.abs(v) >= 10 ? Math.round(v) : Math.round(v * 10) / 10;
  return `${Object.is(r, -0) ? 0 : r}`;
}

function panelSvg(
  panel: ControlsPanelId,
  samples: readonly Sample[],
  x: (s: number) => number,
  y0: number,
  plotWidth: number
): string {
  const series = seriesFor(panel, samples);
  const all =
    series.secondary !== undefined ? [...series.primary.values, ...series.secondary.values] : series.primary.values;
  const ext = PANEL_FIXED_EXTENT[panel] ?? extentOf(all);
  const y = (v: number): number => y0 + PANEL_HEIGHT - ((v - ext.min) / (ext.max - ext.min)) * PANEL_HEIGHT;

  let out = open("g", { class: `panel panel-${panel}`, "data-panel": panel });
  if (panel === "grip") {
    // the "nearly out of grip" band — neutral ink, never a verdict colour
    out += leaf("rect", {
      x: LEFT_MARGIN,
      y: n3(y(GRIP_DANGER)),
      width: plotWidth,
      height: n3(y(0) - y(GRIP_DANGER)),
      fill: INK_BAND_B,
      class: "limit-band",
      "data-limit-band": "grip"
    });
    out += leaf("line", {
      x1: LEFT_MARGIN,
      y1: n3(y(GRIP_DANGER)),
      x2: n3(LEFT_MARGIN + plotWidth),
      y2: n3(y(GRIP_DANGER)),
      stroke: INK_ZERO,
      "stroke-width": 0.8,
      "stroke-dasharray": "4 3",
      class: "limit-rule"
    });
  }
  out += leaf("rect", {
    x: LEFT_MARGIN,
    y: y0,
    width: plotWidth,
    height: PANEL_HEIGHT,
    fill: "none",
    stroke: INK_GRID,
    "stroke-width": 1
  });
  out += textEl(
    { x: 6, y: y0 - 3, "font-family": "sans-serif", "font-size": 9, fill: INK_AXIS, class: "panel-title" },
    PANEL_TITLES[panel]
  );
  // y extremes, so the reader can read a number off the trace
  out += textEl(
    { x: LEFT_MARGIN - 5, y: y0 + 8, "font-family": "sans-serif", "font-size": 8, fill: INK_AXIS, "text-anchor": "end" },
    axisLabel(ext.max)
  );
  out += textEl(
    {
      x: LEFT_MARGIN - 5,
      y: y0 + PANEL_HEIGHT,
      "font-family": "sans-serif",
      "font-size": 8,
      fill: INK_AXIS,
      "text-anchor": "end"
    },
    axisLabel(ext.min)
  );

  if (series.zeroRule && ext.min < 0 && ext.max > 0) {
    const yz = n3(y(0));
    out += leaf("line", {
      x1: LEFT_MARGIN,
      y1: yz,
      x2: n3(LEFT_MARGIN + plotWidth),
      y2: yz,
      stroke: INK_ZERO,
      "stroke-width": 0.8,
      class: "zero-rule"
    });
  }

  for (const points of polylineRuns(samples, series.primary.values, series.primary.gate, x, y)) {
    out += leaf("polyline", {
      points,
      fill: "none",
      stroke: INK_PRIMARY,
      "stroke-width": 1.4,
      class: "trace trace-primary",
      "data-channel": series.primary.label
    });
  }
  if (series.secondary !== undefined) {
    for (const points of polylineRuns(samples, series.secondary.values, series.secondary.gate, x, y)) {
      out += leaf("polyline", {
        points,
        fill: "none",
        stroke: INK_SECONDARY,
        "stroke-width": 1.4,
        "stroke-dasharray": "3 2",
        class: "trace trace-secondary",
        "data-channel": series.secondary.label
      });
    }
  }

  const key =
    series.secondary !== undefined
      ? `${series.primary.label} · ${series.secondary.label}`
      : series.primary.label;
  out += textEl(
    {
      x: n3(LEFT_MARGIN + plotWidth - 4),
      y: y0 + PANEL_HEIGHT - 4,
      "font-family": "sans-serif",
      "font-size": 8,
      fill: INK_SECONDARY,
      "text-anchor": "end",
      class: "panel-key"
    },
    key
  );
  out += "</g>";
  return out;
}

function phaseBandsSvg(bands: readonly PhaseBand[], x: (s: number) => number, top: number): string {
  let out = open("g", { class: "phase-bands", "data-partition": "05-4.1" });
  bands.forEach((band, i) => {
    const x0 = x(band.from_s);
    const w = x(band.to_s) - x0;
    if (!(w > 0)) return;
    out += leaf("rect", {
      x: n3(x0),
      y: top,
      width: n3(w),
      height: BAND_HEIGHT,
      fill: i % 2 === 0 ? INK_BAND_A : INK_BAND_B,
      class: "phase-band",
      "data-phase": band.phase,
      "data-from-s": n3(band.from_s),
      "data-to-s": n3(band.to_s)
    });
    if (w > 34) {
      out += textEl(
        {
          x: n3(x0 + w / 2),
          y: top + 11,
          "font-family": "sans-serif",
          "font-size": 8,
          fill: INK_AXIS,
          "text-anchor": "middle",
          class: "phase-label"
        },
        band.phase
      );
    }
  });
  out += "</g>";
  return out;
}

function windowBandSvg(
  win: ControlsWindow,
  sMin: number,
  sMax: number,
  x: (s: number) => number,
  top: number,
  height: number
): string {
  const from = Math.max(Math.min(win.from, win.to), sMin);
  const to = Math.min(Math.max(win.from, win.to), sMax);
  if (!(to > from)) return "";
  const x0 = x(from);
  return (
    open("g", { class: "window-band", "data-window-from-s": n3(from), "data-window-to-s": n3(to) }) +
    leaf("rect", { x: n3(x0), y: top, width: n3(x(to) - x0), height: n3(height), fill: INK_WINDOW, opacity: 0.06 }) +
    leaf("line", { x1: n3(x0), y1: top, x2: n3(x0), y2: n3(top + height), stroke: INK_WINDOW, opacity: 0.3, "stroke-width": 0.8 }) +
    leaf("line", {
      x1: n3(x(to)),
      y1: top,
      x2: n3(x(to)),
      y2: n3(top + height),
      stroke: INK_WINDOW,
      opacity: 0.3,
      "stroke-width": 0.8
    }) +
    "</g>"
  );
}

function stationAxisSvg(sMin: number, sMax: number, x: (s: number) => number, y: number, plotWidth: number): string {
  let out = open("g", { class: "station-axis", "data-basis": "true-station" });
  out += leaf("line", { x1: LEFT_MARGIN, y1: y, x2: n3(LEFT_MARGIN + plotWidth), y2: y, stroke: INK_AXIS });
  const step = niceStep(sMax - sMin, 8);
  for (let s = Math.ceil(sMin / step) * step; s <= sMax + 1e-9; s += step) {
    const px = n3(x(s));
    out += leaf("line", { x1: px, y1: y, x2: px, y2: y + 4, stroke: INK_AXIS });
    out += textEl(
      { x: px, y: y + 15, "font-family": "sans-serif", "font-size": 8, fill: INK_AXIS, "text-anchor": "middle" },
      `${n3(s)}`
    );
  }
  out += textEl(
    {
      x: n3(LEFT_MARGIN + plotWidth / 2),
      y: y + AXIS_HEIGHT - 2,
      "font-family": "sans-serif",
      "font-size": 8,
      fill: INK_AXIS,
      "text-anchor": "middle",
      class: "axis-caption"
    },
    "station s (m, true — never projected)"
  );
  out += "</g>";
  return out;
}

/**
 * The value the chips report at the cursor. There is ONE value-lookup rule at
 * a cursor in this tool — `core/stateAt.ts` (05 §3.2) — and the HUD (07 §3.3)
 * already uses it, so the strip uses it too: at the same station, on the same
 * screen, the chip and the HUD row cannot disagree.
 *
 * The composed road is rebuilt here from the line's own resolved road spec
 * because `renderControls`'s signature is pinned (07 §3.6: "renderControls
 * (lineResult, window?, cursor?) keeps its signature") and `stateAt` needs a
 * `RoadModel` for the ONE field it recomputes rather than lerps (`f`). If that
 * compose or that query ever fails, the chips fall back to the nearest RECORD
 * row and say so in `data-cursor-source` — a degraded chip is honest, a
 * silently different number is not.
 */
function nearestSample(samples: readonly Sample[], s: number): Sample {
  let best = samples[0]!;
  let bestGap = Math.abs(best.s - s);
  for (const p of samples) {
    const gap = Math.abs(p.s - s);
    if (gap < bestGap) {
      best = p;
      bestGap = gap;
    }
  }
  return best;
}

type CursorSource = "stateAt" | "nearest";

function cursorSample(line: LineResult, s: number): { readonly sample: Sample; readonly source: CursorSource } {
  const rs = line.resolved_scenario.road;
  const composed = compose(
    rs.dsl.length > 0
      ? { dsl: rs.dsl, bike_margin_m: rs.bike_margin_m, use_full_width: rs.use_full_width }
      : {
          lane_width_m: rs.lane_width_m,
          bike_margin_m: rs.bike_margin_m,
          use_full_width: rs.use_full_width,
          segments: rs.segments as readonly Segment[]
        }
  );
  if (composed.ok) {
    const at = stateAt(
      {
        trajectory: line.trajectory,
        road: composed.value,
        plan: line.resolved_scenario.rider.plan,
        sightTrendAt
      },
      { s }
    );
    if (at.ok) return { sample: at.value.sample, source: "stateAt" };
  }
  return { sample: nearestSample(line.trajectory.samples, s), source: "nearest" };
}

function chipText(panel: ControlsPanelId, p: Sample): string {
  switch (panel) {
    case "v":
      return `v ${n3(msToKmh(p.v))}`;
    case "lean":
      return `phi ${n3(p.phi)} · cmd ${n3(p.cmd_lean)}`;
    case "commands":
      return `cmd_a ${n3(p.cmd_a)} · a_long ${n3(p.a_long)}${p.clipped ? " (clipped)" : ""}`;
    case "grip":
      return `grip ${n3(p.grip)}`;
    case "sight":
      return `sight ${n3(p.sight_ride_m)} · ssd ${n3(p.ssd_m)}`;
    case "standup":
      return `su_s ${n3(p.su_sustained)} · su_t ${n3(p.su_transient)}`;
  }
}

function cursorSvg(
  cursorS: number,
  line: LineResult,
  x: (s: number) => number,
  panelTop: number,
  bodyBottom: number
): string {
  const px = n3(x(cursorS));
  const resolved = cursorSample(line, cursorS);
  const at = resolved.sample;
  let out = open("g", {
    class: "cursor",
    "data-cursor-s": n3(cursorS),
    "data-sample-s": n3(at.s),
    "data-cursor-source": resolved.source
  });
  out += leaf("line", {
    x1: px,
    y1: panelTop - BAND_HEIGHT,
    x2: px,
    y2: bodyBottom,
    stroke: INK_CURSOR,
    "stroke-width": 1,
    class: "cursor-rule"
  });
  PANEL_IDS.forEach((panel, i) => {
    const y = panelTop + i * (PANEL_HEIGHT + PANEL_GAP) + 2;
    const label = chipText(panel, at);
    const w = 6 + label.length * 4.6;
    out += leaf("rect", {
      x: n3(px + 3),
      y,
      width: n3(w),
      height: CHIP_HEIGHT,
      fill: INK_CHIP_BG,
      stroke: INK_CURSOR,
      "stroke-width": 0.6,
      opacity: 0.92,
      class: "cursor-chip",
      "data-panel": panel
    });
    out += textEl(
      { x: n3(px + 6), y: y + 10, "font-family": "sans-serif", "font-size": 8, fill: INK_CURSOR },
      label
    );
  });
  out += "</g>";
  return out;
}

/**
 * The line-identity chip — the strip's ONE verdict-coloured element (D9/D11:
 * `quality` is the sole colour source, and it is READ off the verdict, never
 * recomputed here). Everything else on the strip is neutral ink.
 */
function identityChipSvg(line: LineResult): string {
  const q = line.verdict.quality;
  const outcome = line.verdict.outcome;
  const text =
    `${line.label} — ${line.role} · ${q}` + (q !== "good" ? ` (${outcome})` : "");
  return (
    open("g", { class: "line-identity", "data-line-id": line.line_id, "data-quality": q }) +
    leaf("rect", { x: 6, y: 7, width: 18, height: 3, fill: QUALITY_COLOUR[q], class: "quality-swatch" }) +
    // The header used to carry a right-anchored "controls strip · true station"
    // caption as well. On any line whose identity ran long the two texts
    // overlapped into an unreadable smear — and the caption was already spelled
    // out under the axis, where the station numbers it describes actually are.
    textEl({ x: 30, y: 12, "font-family": "sans-serif", "font-size": 10, fill: INK_AXIS }, text) +
    "</g>"
  );
}

// ---------------------------------------------------------------------------
// renderControls (design/06 §4)

/**
 * `renderControls(lineResult, window?, cursor?) → SvgString`.
 *
 * @param lineResult the focused line (06 §4: "at most one focused line")
 * @param window     the TOP-DOWN view's resolved true-station window, drawn as
 *                   a shaded band for cross-reference — never a transform
 * @param cursor     the linked cursor's true station; draws a vertical rule
 *                   plus one value chip per channel (the scrub→cursor linkage
 *                   itself is owned by 07, which re-renders this pure function
 *                   per frame)
 */
export function renderControls(lineResult: LineResult, window?: ControlsWindow, cursor?: number): string {
  try {
    const samples = lineResult.trajectory.samples;
    if (samples.length < 2) return fallbackSvg("controls: the line has no plottable sample series");
    const sMin = samples[0]!.s;
    const sMax = Math.max(samples[samples.length - 1]!.s, lineResult.trajectory.terminated.s);
    const span = Math.max(sMax - sMin, 1e-9);
    // the plot is at least as wide as the widest thing written across it: the
    // panel titles start at x=6 and must end inside the frame
    const titleWidth = Math.max(...PANEL_IDS.map((p) => PANEL_TITLES[p].length * TITLE_CHAR_W_PX)) + 12;
    const plotWidth = Math.max(MIN_PLOT_WIDTH, span * PX_PER_M, titleWidth - LEFT_MARGIN - RIGHT_MARGIN);
    const x = (s: number): number => LEFT_MARGIN + ((s - sMin) / span) * plotWidth;

    const width = LEFT_MARGIN + plotWidth + RIGHT_MARGIN;
    const panelTop = HEADER_HEIGHT + BAND_HEIGHT + 10;
    const bodyHeight = PANEL_IDS.length * PANEL_HEIGHT + (PANEL_IDS.length - 1) * PANEL_GAP;
    const axisY = panelTop + bodyHeight + 6;
    const height = axisY + AXIS_HEIGHT;

    let out = open("svg", {
      xmlns: "http://www.w3.org/2000/svg",
      width: n3(width),
      height: n3(height),
      viewBox: `0 0 ${n3(width)} ${n3(height)}`,
      role: "img",
      "aria-label": `controls strip for line ${lineResult.line_id}`,
      class: "controls-strip",
      "data-projection": "none",
      "data-line-id": lineResult.line_id
    });
    out += leaf("rect", { x: 0, y: 0, width: n3(width), height: n3(height), fill: "#ffffff" });
    out += identityChipSvg(lineResult);
    out += phaseBandsSvg(phaseBandsOf(lineResult), x, HEADER_HEIGHT);
    if (window !== undefined) {
      out += windowBandSvg(window, sMin, sMax, x, panelTop, bodyHeight);
    }
    PANEL_IDS.forEach((panel, i) => {
      out += panelSvg(panel, samples, x, panelTop + i * (PANEL_HEIGHT + PANEL_GAP), plotWidth);
    });
    out += stationAxisSvg(sMin, sMax, x, axisY, plotWidth);
    if (cursor !== undefined && Number.isFinite(cursor)) {
      const clamped = Math.min(Math.max(cursor, sMin), sMax);
      out += cursorSvg(clamped, lineResult, x, panelTop, panelTop + bodyHeight);
    }
    out += "</svg>";
    return out;
  } catch (e) {
    return fallbackSvg(`controls: ${e instanceof Error ? e.message : String(e)}`);
  }
}
