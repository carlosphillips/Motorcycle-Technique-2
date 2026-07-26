// test/render/controls.test.ts — the v0.2 controls strip (design/06 §4).
//
// What this file demonstrates as real usage:
//   - `renderControls(lineResult, window?, cursor?)` is the whole surface: a
//     finished line goes in, a self-contained SVG string comes out. No DOM, no
//     IO, no engine run.
//   - the strip's phase bands ARE the result's phase partition: at the middle
//     of every band, `stateAt(line, {s})`.derived.phase is that band's token.
//     One partition (05 §4.1, D41), two consumers, zero drift — the substance
//     of `C-STRIP-BANDS`.
//   - the D9/D11 one-outcome law: `quality` is the SOLE colour source and it is
//     READ off the verdict. Exactly one element on the strip carries a verdict
//     colour (the line-identity swatch); every channel is neutral ink.
//   - "never projected" (06 §4): the `window` argument shades, it does not
//     transform — changing it moves the band and leaves every trace byte-identical.

import { describe, it, expect, beforeAll } from "vitest";
import { run } from "../../src/solve/run.js";
import { compose } from "../../src/road/compose.js";
import { isLineRefusal } from "../../src/solve/envelope.js";
import type { LineResult } from "../../src/solve/types.js";
import { stateAt } from "../../src/core/stateAt.js";
import { sightTrendAt } from "../../src/sight/analyze.js";
import { renderControls, phaseBandsOf, lastCornerIdOf } from "../../src/render/controls.js";
import { QUALITY_COLOUR } from "../../src/render/constants.js";
import { PHASES, type Sample } from "../../src/core/types.js";
import { msToKmh } from "../../src/core/units.js";

/** The retired rule, kept HERE (never in src/) so the gate above can prove it differs. */
function nearest(samples: readonly Sample[], s: number): Sample {
  let best = samples[0]!;
  for (const p of samples) if (Math.abs(p.s - s) < Math.abs(best.s - s)) best = p;
  return best;
}

const VERDICT_HEXES = Object.values(QUALITY_COLOUR);

/** book90 solved clean — one corner, every phase reached, ~0.5 s. */
function solveBook90(): LineResult {
  const r = run({ road: { preset: "book90" }, entry_kmh: 34, turn_in: "auto" }, { figure_id: "controls-fixture" });
  if (!r.ok) throw new Error(`fixture solve failed: ${r.error.code} ${r.error.message}`);
  const line = r.value.lines.find((l): l is LineResult => !isLineRefusal(l));
  if (line === undefined) throw new Error("fixture produced no drawn line");
  return line;
}

let line: LineResult;
let svg: string;

beforeAll(() => {
  line = solveBook90();
  svg = renderControls(line);
}, 120_000);

// ---------------------------------------------------------------------------

describe("renderControls — the channel set (design/06 §4)", () => {
  it("draws the six channels 06 §4 names, each over the shared true-station axis", () => {
    for (const panel of ["v", "lean", "commands", "grip", "sight", "standup"]) {
      expect(svg, `panel ${panel} missing`).toContain(`data-panel="${panel}"`);
    }
    // the overlaid pairs are named on their own polylines, so a reader (and a
    // vision judge) can tell which trace is which
    for (const channel of [
      "v",
      "phi",
      "cmd_lean",
      "cmd_a",
      "grip",
      "sight_ride_m",
      "ssd_m",
      "su_sustained",
      "su_transient"
    ]) {
      expect(svg, `channel ${channel} missing`).toContain(`data-channel="${channel}"`);
    }
  });

  it("the delivered a_long overlay is drawn WHERE CLIPPED and nowhere else (06 §4)", () => {
    // the book90 fixture never hits the friction ellipse, so the honest render
    // carries no a_long overlay at all
    expect(line.trajectory.samples.some((p) => p.clipped)).toBe(false);
    expect(svg).not.toContain('data-channel="a_long (clipped)"');

    // clip a contiguous middle run of the SAME record: the overlay appears, as
    // exactly one polyline spanning exactly that run
    const samples = line.trajectory.samples;
    const lo = Math.floor(samples.length * 0.4);
    const hi = Math.floor(samples.length * 0.6);
    const clipped = {
      ...line,
      trajectory: {
        ...line.trajectory,
        samples: samples.map((p, i) => (i >= lo && i < hi ? { ...p, clipped: true } : p))
      }
    } as unknown as LineResult;
    const out = renderControls(clipped);
    const overlay = [...out.matchAll(/<polyline points="([^"]+)"[^>]*data-channel="a_long \(clipped\)"/g)];
    expect(overlay).toHaveLength(1);
    expect(overlay[0]![1]!.split(" ")).toHaveLength(hi - lo);
  });

  it("captions the sight channel with its rider-path basis (06 §4: 'the strip's caption discloses the basis')", () => {
    expect(svg).toContain("same rider-path basis");
  });

  it("the D45-gated k_refuted channel is ABSENT, not stubbed (phase law, 00 §3)", () => {
    expect(svg).not.toContain("k_refuted");
    expect(svg).not.toContain("k_admissible");
  });

  it("emits a fully self-contained SVG (06 §7): no external refs, no <pattern>, no SMIL", () => {
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg.trimEnd().endsWith("</svg>")).toBe(true);
    expect(svg).not.toContain("url(");
    expect(svg).not.toContain("<pattern");
    expect(svg).not.toContain("<animate");
    expect(svg).not.toContain("@import");
    expect(svg).not.toContain("xlink:href");
  });

  it("is pure: the same line renders byte-identically every time", () => {
    expect(renderControls(line)).toBe(svg);
    expect(renderControls(line, { from: 3, to: 20 }, 12)).toBe(renderControls(line, { from: 3, to: 20 }, 12));
  });

  it("never throws — a line with no plottable series degrades to the fallback SVG", () => {
    const empty = {
      ...line,
      trajectory: { ...line.trajectory, samples: [] }
    } as unknown as LineResult;
    const out = renderControls(empty);
    expect(out.startsWith("<svg")).toBe(true);
    expect(out).toContain("render failed");
  });
});

// ---------------------------------------------------------------------------

describe("C-STRIP-BANDS — the strip's bands are the result's phase partition", () => {
  it("every band's token is 05 §4.1's five-token vocabulary, verbatim", () => {
    const bands = phaseBandsOf(line);
    expect(bands.length).toBeGreaterThan(0);
    for (const b of bands) expect(PHASES).toContain(b.phase);
    // labelled verbatim on the strip
    for (const b of bands) expect(svg).toContain(`data-phase="${b.phase}"`);
  });

  it("bands tile the ridden station span, in order, without gaps or overlaps", () => {
    const bands = phaseBandsOf(line);
    expect(bands[0]!.from_s).toBeCloseTo(line.trajectory.samples[0]!.s, 9);
    expect(bands[bands.length - 1]!.to_s).toBeCloseTo(line.trajectory.terminated.s, 9);
    for (let i = 1; i < bands.length; i++) {
      expect(bands[i]!.from_s).toBeCloseTo(bands[i - 1]!.to_s, 9);
    }
  });

  it("at the middle of each band, stateAt reports that band's phase — one partition, two consumers", () => {
    const road = compose({ dsl: line.resolved_scenario.road.dsl });
    expect(road.ok).toBe(true);
    if (!road.ok) return;
    const input = {
      trajectory: line.trajectory,
      road: road.value,
      plan: line.resolved_scenario.rider.plan,
      sightTrendAt
    };
    for (const band of phaseBandsOf(line)) {
      const mid = (band.from_s + band.to_s) / 2;
      const st = stateAt(input, { s: mid });
      expect(st.ok, `stateAt refused at s=${mid}`).toBe(true);
      if (!st.ok) continue;
      expect(st.value.derived.phase, `band ${band.phase} @ s=${mid}`).toBe(band.phase);
    }
  });

  it("the corner-id rule the band machine uses matches road/compose's own minting", () => {
    for (const preset of ["book90", "bookEsses", "bookDoubleApex", "C30"]) {
      const road = compose({ preset });
      if (!road.ok) continue;
      const fromCompose = road.value.corners.length > 0 ? road.value.corners[road.value.corners.length - 1]!.id : null;
      // road/compose mints ids off its own segment walk; lastCornerIdOf reads
      // the resolved segment array. The two must never disagree.
      expect(lastCornerIdOf(road.value.segments), `preset ${preset}`).toBe(fromCompose);
    }
  });
});

// ---------------------------------------------------------------------------

describe("D9/D11 — quality is the strip's SOLE colour source", () => {
  it("exactly one element carries a verdict colour, and it is the line's own recorded quality", () => {
    const hits = VERDICT_HEXES.flatMap((hex) => svg.match(new RegExp(hex, "g")) ?? []);
    expect(hits).toHaveLength(1);
    expect(hits[0]).toBe(QUALITY_COLOUR[line.verdict.quality]);
    expect(svg).toContain(`fill="${QUALITY_COLOUR[line.verdict.quality]}" class="quality-swatch"`);
    // the swatch is READ off the verdict, never re-derived here
    expect(svg).toContain(`data-quality="${line.verdict.quality}"`);
  });

  it("no channel trace is stroked in the verdict palette (06 §4's neutral-palette hard rule)", () => {
    const traceStrokes = [...svg.matchAll(/<polyline[^>]*stroke="([^"]+)"/g)].map((m) => m[1]!);
    expect(traceStrokes.length).toBeGreaterThan(5);
    for (const stroke of traceStrokes) expect(VERDICT_HEXES).not.toContain(stroke);
  });

  it("the identity chip appends the outcome word exactly when quality is not good (06 §5.3's grammar)", () => {
    const good = svg.includes(`— ${line.role} · good`);
    expect(good).toBe(line.verdict.quality === "good");
    if (!good) expect(svg).toContain(`(${line.verdict.outcome})`);
  });
});

// ---------------------------------------------------------------------------

describe("never projected (design/06 §4) — the window shades, it does not transform", () => {
  const traces = (s: string): string[] => [...s.matchAll(/<polyline[^>]*points="([^"]+)"/g)].map((m) => m[1]!);

  it("two different windows leave every channel trace byte-identical", () => {
    const a = renderControls(line, { from: 0, to: 10 });
    const b = renderControls(line, { from: 20, to: 40 });
    expect(traces(a)).toEqual(traces(b));
    expect(traces(a)).toEqual(traces(svg));
    expect(a).not.toBe(b); // only the band moved
    expect(a).toContain('data-window-from-s="0"');
    expect(b).toContain('data-window-from-s="20"');
  });

  it("the station→x map is linear in TRUE metres (no compression anywhere)", () => {
    const pts = traces(svg)[0]!.split(" ").map((p) => Number(p.split(",")[0]));
    const samples = line.trajectory.samples;
    const i = 0;
    const j = Math.floor(samples.length / 2);
    const k = samples.length - 1;
    const slopeIJ = (pts[j]! - pts[i]!) / (samples[j]!.s - samples[i]!.s);
    const slopeJK = (pts[k]! - pts[j]!) / (samples[k]!.s - samples[j]!.s);
    expect(slopeIJ).toBeCloseTo(slopeJK, 3);
  });
});

// ---------------------------------------------------------------------------

describe("the cursor hook (design/06 §4)", () => {
  it("is optional — absent by default, and draws a rule plus one chip per channel when given", () => {
    expect(svg).not.toContain('class="cursor-rule"');
    const withCursor = renderControls(line, undefined, 15);
    expect(withCursor).toContain('class="cursor-rule"');
    const chips = [...withCursor.matchAll(/class="cursor-chip" data-panel="([a-z]+)"/g)].map((m) => m[1]!);
    expect(chips.sort()).toEqual(["commands", "grip", "lean", "sight", "standup", "v"]);
  });

  it("on an exact sample station the chips read that record verbatim", () => {
    const target = line.trajectory.samples[Math.floor(line.trajectory.samples.length / 2)]!;
    const withCursor = renderControls(line, undefined, target.s);
    expect(withCursor).toContain(`data-sample-s="${Number(target.s.toFixed(3))}"`);
    expect(withCursor).toContain(`v ${Number(msToKmh(target.v).toFixed(3))}`);
  });

  it("C-ONE-CORE (the cursor half) — BETWEEN samples the chips are `stateAt`'s instant, the same number the HUD shows", () => {
    // The defect this pins: the chips used to report the NEAREST RECORDED
    // sample while the HUD reported `stateAt`'s interpolated instant, so at one
    // cursor, on one screen, two different numbers appeared for one channel.
    // There is ONE value-lookup rule at a cursor (05 §3.2) and both surfaces
    // now use it.
    const road = compose({ preset: "book90" });
    expect(road.ok).toBe(true);
    if (!road.ok) return;
    const input = {
      trajectory: line.trajectory,
      road: road.value,
      plan: line.resolved_scenario.rider.plan,
      sightTrendAt
    };
    const samples = line.trajectory.samples;

    let worstGap = 0;
    let checked = 0;
    for (let i = 0; i + 1 < samples.length; i++) {
      const mid = (samples[i]!.s + samples[i + 1]!.s) / 2;
      if (!(mid > samples[i]!.s && mid < samples[i + 1]!.s)) continue;
      const instant = stateAt(input, { s: mid });
      expect(instant.ok).toBe(true);
      if (!instant.ok) continue;
      const svgAt = renderControls(line, undefined, mid);
      // the chip prints the INSTANT's value, 3 dp, not the neighbouring record's
      expect(svgAt, `cursor ${mid}`).toContain(`v ${Number(msToKmh(instant.value.sample.v).toFixed(3))}`);
      expect(svgAt).toContain(`grip ${Number(instant.value.sample.grip.toFixed(3))}`);
      expect(svgAt).toContain('data-cursor-source="stateAt"');
      worstGap = Math.max(worstGap, Math.abs(msToKmh(instant.value.sample.v) - msToKmh(nearest(samples, mid).v)));
      checked++;
    }
    expect(checked, "no interior bracket midpoints were exercised").toBeGreaterThan(10);
    // and the OLD rule really was different — otherwise this gate is vacuous
    expect(worstGap, "nearest-sample and stateAt agree everywhere; the gate proves nothing").toBeGreaterThan(0.01);
  });

  it("a cursor outside the ridden span clamps into it rather than drawing off the axis", () => {
    const out = renderControls(line, undefined, 1e6);
    expect(out).toContain('class="cursor-rule"');
    const xs = [...out.matchAll(/<line[^>]*class="cursor-rule"/g)];
    expect(xs.length).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Layout: the strip has to fit what it writes on itself

describe("the strip sizes itself around its captions, not only its plot", () => {
  it("every panel title ends inside the viewBox", () => {
    const width = Number(/viewBox="0 0 ([\d.]+) [\d.]+"/.exec(svg)![1]);
    const titles = [...svg.matchAll(/<text[^>]*class="panel-title"[^>]*>([^<]*)</g)].map((m) => m[1]!);
    expect(titles).toHaveLength(6);
    for (const t of titles) {
      // the same estimate the renderer lays out with, plus the x=6 origin
      const end = 6 + t.length * 9 * 0.58;
      expect(end, `panel title "${t.slice(0, 40)}…" runs past the ${width} px frame`).toBeLessThan(width);
    }
  });

  it("the header carries the line identity and nothing that can collide with it", () => {
    const header = /<g class="line-identity"[\s\S]*?<\/g>/.exec(svg)![0];
    expect((header.match(/<text/g) ?? []).length).toBe(1);
    // the axis, not the header, is where the station basis is disclosed
    expect(svg).toContain("station s (m, true");
  });

  it("grip is drawn against its own fixed 0..1 range, with the out-of-grip band shaded", () => {
    // a line that keeps 0.37 in reserve must NOT be drawn touching the floor
    expect(svg).toContain('data-limit-band="grip"');
    const grip = /<g class="panel panel-grip"[\s\S]*?<\/g>\s*(?=<g class="panel|<g class="axis|<\/svg>)/.exec(svg)?.[0] ?? "";
    expect(grip).toContain(">1<");
    expect(grip).toContain(">0<");
  });
});

// Riding words, not field names — the reader of a figure is a rider.
describe("panel titles read as riding, and keep the machine names on the traces", () => {
  it("no panel title is an engine identifier", () => {
    const titles = [...svg.matchAll(/<text[^>]*class="panel-title"[^>]*>([^<]*)</g)].map((m) => m[1]!);
    for (const banned of ["phi vs cmd_lean", "cmd_a split by sign", "su_sustained + su_transient"]) {
      expect(titles.join(" | ")).not.toContain(banned);
    }
    expect(titles.join(" | ")).toContain("Speed (km/h)");
    expect(titles.join(" | ")).toContain("Grip in reserve");
  });

  it("the engine's own channel names still ride on every trace", () => {
    for (const channel of ["v", "phi", "cmd_lean", "cmd_a", "grip", "sight_ride_m", "ssd_m", "su_sustained"]) {
      expect(svg, `channel ${channel} lost its machine name`).toContain(`data-channel="${channel}"`);
    }
  });
});
