// test/render/pov.test.ts — the `pov` RENDER TARGET gates (design/09 §6):
// C-POV-LIMIT-CONSISTENT (L2014), C-POV-LIMIT-ALWAYS (L2018, D40),
// C-POV-LOOK (L2021), C-POV-TRUE-GEOMETRY (L2027), C-POV-OCCLUDE (L2030),
// plus the closed-set enumeration guards (drift risk #12) and the design/06 §6
// self-contained-SVG law.
//
// Fixtures are real engine runs (book90 = the G-POV-CLAMP-MIDCORNER fixture;
// a wall-blind left corner for C-POV-OCCLUDE), cached once. The POV builder is
// PURE — every frame is a fresh call over frozen recorded state — so iterating
// every sample of a line is cheap.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

import { run, ENGINE_SEMVER } from "../../src/solve/run.js";
import { isLineRefusal } from "../../src/solve/envelope.js";
import type { FigureResult, LineResult } from "../../src/solve/types.js";
import type { Sample } from "../../src/core/types.js";
import { project } from "../../src/render/project.js";
import { renderViews } from "../../src/render/index.js";
import {
  povFrame,
  renderPov,
  renderPovForFigure,
  povYawDeg,
  povFocusLine,
  povDefaultSample,
  POV_LOOK_MODES,
  POV_MARKER_STATES,
  type PovLook,
  type Pt
} from "../../src/render/pov.js";
import {
  POV_EYE_HEIGHT_M,
  POV_OCCLUDE_CLEAR_M,
  POV_OCCLUDER_HEIGHT_M,
  POV_LOOK_MAX_DEG
} from "../../src/render/constants.js";

const here = dirname(fileURLToPath(import.meta.url));
const srcRoot = resolve(here, "../../src");

// ---------------------------------------------------------------------------
// Fixtures (cached engine runs)

function firstLine(env: FigureResult, id?: string): LineResult {
  const line =
    id !== undefined
      ? env.lines.find((l) => l.line_id === id && !isLineRefusal(l))
      : env.lines.find((l) => !isLineRefusal(l));
  if (line === undefined || isLineRefusal(line)) throw new Error(`line ${id ?? "(any)"} missing/refused`);
  return line as LineResult;
}

let book90Cache: FigureResult | null = null;
/** The G-POV-CLAMP-MIDCORNER fixture: book90 @34 + premature mistake (solved + mistake lines). */
function book90(): FigureResult {
  if (book90Cache !== null) return book90Cache;
  const r = run({ road: "book90", entry_kmh: 34, mistake: { kind: "premature" } }, { engine_semver: ENGINE_SEMVER, figure_id: "F-POV-90" });
  if (!r.ok) throw new Error(`book90 refused: ${JSON.stringify(r.error)}`);
  book90Cache = r.value;
  return r.value;
}

let wallCache: FigureResult | null = null;
/** A wall-blind left corner: the inside wall breaks the road at the limit point (C-POV-OCCLUDE golden). */
function wallBlind(): FigureResult {
  if (wallCache !== null) return wallCache;
  const scn = {
    spec: "linelab/1",
    id: "pov-wall",
    road: { dsl: "lane 3.5 | S 25 | L 40 ^90 | S 25" },
    occluders: [{ kind: "wall", side: "inside", at: { ref: "entry:c1" }, span_m: 30 }],
    rider: { profile: "street", start: { speed_kmh: 38, f: 1.0 }, plan: [{ do: "turn_in", id: "t1", at_s: 22, target: { lean_deg: 24 }, hand: "L" }] }
  };
  const r = run(scn, { engine_semver: ENGINE_SEMVER, figure_id: "pov-wall" });
  if (!r.ok) throw new Error(`wallBlind refused: ${JSON.stringify(r.error)}`);
  wallCache = r.value;
  return r.value;
}

function midCornerSample(line: LineResult, s_mid: number): Sample {
  return line.trajectory.samples.reduce((a, b) => (Math.abs(b.s - s_mid) < Math.abs(a.s - s_mid) ? b : a));
}

function wrapDeg(d: number): number {
  let x = (d + 180) % 360;
  if (x < 0) x += 360;
  return x - 180;
}

// ---------------------------------------------------------------------------
// Closed-set enumeration (drift risk #12 — copied verbatim from design/07 §5.2/§5.3)

describe("POV closed sets (design/07 §5.2/§5.3, D8)", () => {
  it("`look` is exactly {heading, limit_point} with heading the default", () => {
    expect([...POV_LOOK_MODES]).toEqual(["heading", "limit_point"]);
  });
  it("`markerState` is exactly {placed, clamped}", () => {
    expect([...POV_MARKER_STATES]).toEqual(["placed", "clamped"]);
  });
});

// ---------------------------------------------------------------------------
// C-POV-LIMIT-CONSISTENT (design/09 L2014)

describe("C-POV-LIMIT-CONSISTENT — POV and topdown project the SAME sightFrom result (design/09 L2014)", () => {
  it("the POV limit-marker's WORLD source is the recorded (limit_x, limit_y) in BOTH look modes — never recomputed", { timeout: 300_000 }, () => {
    const env = book90();
    const line = firstLine(env, "solved");
    const road = env.road;
    const sample = midCornerSample(line, road.corners[0]!.s_mid);
    for (const look of POV_LOOK_MODES) {
      const f = povFrame({ road, occluders: line.resolved_scenario.occluders, line, sample, look });
      expect(f.limit.world.x).toBe(sample.limit_x);
      expect(f.limit.world.y).toBe(sample.limit_y);
    }
  });

  it("at a line's first turn_in the POV limit world equals the exact point the topdown sight ray is drawn to — one sightFrom result, two views", { timeout: 300_000 }, () => {
    // Use the OCCLUDER-BEARING fixture (a wall breaks the road): with an occluder
    // present, project() actually draws a topdown sight ray (it is null on an
    // unoccluded road), so the render-layer topdown-ray equality FIRES rather than
    // being skipped — the two-views claim is proven at the render layer, not only
    // the viewer layer.
    const env = wallBlind();
    const line = firstLine(env);
    const road = env.road;
    const turnIn = line.trajectory.events.filter((e) => e.kind === "turn_in").sort((a, b) => a.s - b.s)[0];
    expect(turnIn).toBeDefined();
    const sample = midCornerSample(line, turnIn!.s);

    // topdown reads the SAME recorded limit for its sight ray (project's
    // defaultSightRay anchors at the nearest sample to the first turn_in — the
    // very sample the POV uses here).
    const scene = project(road, [line], { window: "all" });
    expect(scene.ok).toBe(true);
    if (!scene.ok) return;
    const ray = scene.value.lines.find((l) => l.line_id === line.line_id)?.sightRay;
    // the occluder guarantees a drawn ray — this is the non-vacuous half:
    expect(ray, "an occluded road must draw a topdown sight ray").not.toBeNull();
    expect(ray).toBeDefined();

    const f = povFrame({ road, occluders: line.resolved_scenario.occluders, line, sample, look: "heading" });
    // one sightFrom result, two views: the POV limit world AND the topdown ray's
    // `to` are BOTH the recorded (limit_x, limit_y) of that same turn_in sample.
    expect(f.limit.world.x).toBe(sample.limit_x);
    expect(f.limit.world.y).toBe(sample.limit_y);
    expect(ray!.to.x).toBe(sample.limit_x);
    expect(ray!.to.y).toBe(sample.limit_y);
  });
});

// ---------------------------------------------------------------------------
// C-POV-LIMIT-ALWAYS (design/09 L2018, D40)

describe("C-POV-LIMIT-ALWAYS — exactly one limit marker per frame, world = recorded limit, never dropped (design/09 L2018, D40)", () => {
  it("every POV frame of every fixture line carries exactly one marker, markerState ∈ {placed, clamped}, world = (limit_x, limit_y)", { timeout: 300_000 }, () => {
    const env = book90();
    const road = env.road;
    for (const id of ["solved", "premature"]) {
      const line = firstLine(env, id);
      for (const look of POV_LOOK_MODES) {
        for (const sample of line.trajectory.samples) {
          const f = povFrame({ road, occluders: line.resolved_scenario.occluders, line, sample, look });
          // exactly one marker — the draw list carries a single `limit` entry, unconditional
          expect(f.limit).toBeDefined();
          expect(POV_MARKER_STATES).toContain(f.limit.markerState);
          expect(f.limit.world.x).toBe(sample.limit_x);
          expect(f.limit.world.y).toBe(sample.limit_y);
          // the arrow exists IFF clamped (its presence is the off-frame signal, §5.3 item 7)
          expect(f.limit.arrow !== null).toBe(f.limit.markerState === "clamped");
        }
      }
    }
  });

  it("the serialized SVG always contains exactly one limit-point marker group", { timeout: 300_000 }, () => {
    const env = book90();
    const line = firstLine(env, "solved");
    const road = env.road;
    for (const s of [line.trajectory.samples[0]!, midCornerSample(line, road.corners[0]!.s_mid), line.trajectory.samples.at(-1)!]) {
      const svg = renderPov({ road, occluders: line.resolved_scenario.occluders, line, sample: s, look: "heading" });
      const markers = svg.match(/data-marker="limit_point"/g) ?? [];
      expect(markers.length).toBe(1);
    }
  });
});

// ---------------------------------------------------------------------------
// C-POV-LOOK (design/09 L2021)

describe("C-POV-LOOK (design/09 L2021)", () => {
  it("(a) the G-POV-CLAMP-MIDCORNER sample under look=limit_point: markerState = placed and yaw = the camera law's worked value", { timeout: 300_000 }, () => {
    const env = book90();
    const line = firstLine(env, "solved");
    const road = env.road;
    const c1 = road.corners[0]!;
    expect(c1.hand).toBe("L");
    const sample = midCornerSample(line, c1.s_mid);

    const f = povFrame({ road, occluders: line.resolved_scenario.occluders, line, sample, look: "limit_point" });
    // under limit_point the camera aims AT the limit point → near frame-centre → placed
    expect(f.limit.markerState).toBe("placed");

    // the worked value, recomputed independently from the camera law (§5.2):
    const bearing = (Math.atan2(sample.limit_y - sample.y, sample.limit_x - sample.x) * 180) / Math.PI;
    const delta = wrapDeg(bearing - sample.psi);
    // the LOOK_MAX_DEG clamp is INACTIVE here (the mid-corner head-turn is under 70°),
    // so yaw resolves to the eye→limit-point bearing exactly.
    expect(Math.abs(delta)).toBeLessThan(POV_LOOK_MAX_DEG);
    const expectedYaw = sample.psi + delta;
    expect(f.yaw_deg).toBeCloseTo(expectedYaw, 9);
    expect(f.yaw_deg).toBeCloseTo(bearing, 9);
    // and it agrees with the public yaw law
    expect(f.yaw_deg).toBe(povYawDeg(sample, "limit_point"));

    // under heading the camera aims along psi (the bike's heading), a different yaw
    const h = povFrame({ road, occluders: line.resolved_scenario.occluders, line, sample, look: "heading" });
    expect(h.yaw_deg).toBe(sample.psi);
    expect(h.yaw_deg).not.toBeCloseTo(f.yaw_deg, 3);
  });

  it("(b) frames are pure: identical (result, sample, look) → byte-identical draw list and SVG", { timeout: 300_000 }, () => {
    const env = book90();
    const line = firstLine(env, "solved");
    const road = env.road;
    const sample = midCornerSample(line, road.corners[0]!.s_mid);
    for (const look of POV_LOOK_MODES) {
      const input = { road, occluders: line.resolved_scenario.occluders, line, sample, look };
      expect(JSON.stringify(povFrame(input))).toBe(JSON.stringify(povFrame(input)));
      expect(renderPov(input)).toBe(renderPov(input));
    }
  });

  it("(c) toggling look changes no recorded state, no verdict, and no hash — the frame is pure presentation over the record", { timeout: 300_000 }, () => {
    const env = book90();
    const line = firstLine(env, "solved");
    const road = env.road;
    const sample = midCornerSample(line, road.corners[0]!.s_mid);
    const hashBefore = line.verdict.result_hash;
    const outcomeBefore = line.verdict.outcome;
    const sampleSnapshot = JSON.stringify(sample);

    renderPov({ road, occluders: line.resolved_scenario.occluders, line, sample, look: "heading" });
    renderPov({ road, occluders: line.resolved_scenario.occluders, line, sample, look: "limit_point" });

    // nothing the frame touches is a recorded field — the verdict/hash/sample are untouched
    expect(line.verdict.result_hash).toBe(hashBefore);
    expect(line.verdict.outcome).toBe(outcomeBefore);
    expect(JSON.stringify(sample)).toBe(sampleSnapshot);
    // no hash lives in the frame at all
    const f = povFrame({ road, occluders: line.resolved_scenario.occluders, line, sample, look: "limit_point" });
    expect(JSON.stringify(f)).not.toContain(hashBefore);
  });
});

// ---------------------------------------------------------------------------
// C-POV-TRUE-GEOMETRY (design/09 L2027)

describe("C-POV-TRUE-GEOMETRY — POV consumes only true geometry (design/09 L2027)", () => {
  /** transitive relative-import closure of a src file, as src-relative POSIX paths. */
  function closure(entryRel: string): Set<string> {
    const seen = new Set<string>();
    const queue = [entryRel];
    while (queue.length > 0) {
      const rel = queue.pop()!;
      if (seen.has(rel)) continue;
      const abs = resolve(srcRoot, rel);
      let text: string;
      try {
        text = readFileSync(abs, "utf8");
      } catch {
        continue;
      }
      seen.add(rel);
      for (const m of text.matchAll(/\bfrom\s+["']([^"']+)["']/g)) {
        const spec = m[1]!;
        if (!spec.startsWith(".")) continue;
        const t = resolve(dirname(abs), spec);
        const ts = t.endsWith(".js") ? t.slice(0, -3) + ".ts" : t;
        if (!ts.startsWith(srcRoot + sep)) continue;
        queue.push(ts.slice(srcRoot.length + 1).split(sep).join("/"));
      }
    }
    return seen;
  }

  it("structural: render/pov.ts does not import the diagram-projection module (project.ts), directly or transitively", () => {
    const direct = readFileSync(resolve(srcRoot, "render/pov.ts"), "utf8");
    // no direct import of project
    expect(/from\s+["'][^"']*\/project\.js["']/.test(direct)).toBe(false);
    expect(direct.includes("./project.js")).toBe(false);
    // and nothing it reaches transitively pulls project.ts in
    const reached = closure("render/pov.ts");
    expect(reached.has("render/pov.ts")).toBe(true);
    expect(reached.has("render/project.ts"), "POV code reaches the diagram-projection module").toBe(false);
  });

  it("behavioural: POV SVG is byte-identical across every projection setting (orient / window)", { timeout: 300_000 }, () => {
    const env = book90();
    const lines = env.lines.filter((l): l is LineResult => !isLineRefusal(l));
    const base = renderViews({ road: env.road, lines, target: "pov", viewSpec: { orient: 0 } });
    expect(base.ok).toBe(true);
    if (!base.ok) return;
    for (const viewSpec of [{ orient: 90 }, { orient: 180 }, { window: "all" }, { mode: "true", orient: 270 }] as const) {
      const r = renderViews({ road: env.road, lines, target: "pov", viewSpec });
      expect(r.ok, `pov render rejected for ${JSON.stringify(viewSpec)}`).toBe(true);
      if (!r.ok) continue;
      expect(r.value.svg, `pov svg differs under ${JSON.stringify(viewSpec)}`).toBe(base.value.svg);
    }
    // control: the `look` toggle DOES change the frame (it is a camera control, not a projection setting)
    const looked = renderViews({ road: env.road, lines, target: "pov", viewSpec: { look: "limit_point" } });
    expect(looked.ok).toBe(true);
    if (looked.ok) expect(looked.value.svg).not.toBe(base.value.svg);
  });
});

// ---------------------------------------------------------------------------
// C-POV-OCCLUDE (design/09 L2030)

describe("C-POV-OCCLUDE — the occlusion invariant + a wall breaking the road (design/09 L2030)", () => {
  it("static config: min(occluder-kind heights) ≥ eye_height_m + POV_OCCLUDE_CLEAR_M", () => {
    const heights = Object.values(POV_OCCLUDER_HEIGHT_M);
    expect(Math.min(...heights)).toBeGreaterThanOrEqual(POV_EYE_HEIGHT_M + POV_OCCLUDE_CLEAR_M);
    // every kind individually satisfies "exceeds eye by at least the clearance"
    for (const h of heights) expect(h - POV_EYE_HEIGHT_M).toBeGreaterThanOrEqual(POV_OCCLUDE_CLEAR_M);
  });

  it("golden: a wall at the limit point is extruded and painted OVER the road — the road disappears behind it", { timeout: 300_000 }, () => {
    const env = wallBlind();
    const line = firstLine(env);
    const road = env.road;
    // the sample where the wall breaks the sightline (the limit point is clamped there)
    const sample = midCornerSample(line, road.corners[0]!.s0 + 2);
    const f = povFrame({ road, occluders: line.resolved_scenario.occluders, line, sample, look: "heading" });

    // the wall breaks the sightline HERE — the limit point is clamped (the
    // marker's own witness that the road is fully occluded at this station).
    expect(f.limit.markerState).toBe("clamped");

    const wall = f.occluders.find((o) => o.kind === "wall");
    expect(wall, "the wall occluder is extruded into the frame").toBeDefined();
    expect(wall!.quads.length).toBeGreaterThan(0);

    const svg = renderPov({ road, occluders: line.resolved_scenario.occluders, line, sample, look: "heading" });
    // exactly one limit marker (the invariant holds with an occluder present)
    expect((svg.match(/data-marker="limit_point"/g) ?? []).length).toBe(1);
    // paint order: the road surface (stage 2) is drawn BEFORE the occluders (stage 4),
    // so the wall paints over it — the road visibly disappears behind the wall.
    const roadIdx = svg.indexOf('data-stage="2-road-surface"');
    const occIdx = svg.indexOf('data-stage="4-occluders"');
    const wallIdx = svg.indexOf('data-occluder-kind="wall"');
    expect(roadIdx).toBeGreaterThanOrEqual(0);
    expect(occIdx).toBeGreaterThan(roadIdx);
    expect(wallIdx).toBeGreaterThan(roadIdx);
  });
});

// ---------------------------------------------------------------------------
// design/06 §6 — the self-contained-SVG law (a POV render is a static export)

describe("POV self-contained SVG law (design/06 §6)", () => {
  it("renderPov emits a well-formed SVG with no external references (no url()/href/image/pattern/style/script/use)", { timeout: 300_000 }, () => {
    const env = book90();
    const line = firstLine(env, "solved");
    const road = env.road;
    const sample = midCornerSample(line, road.corners[0]!.s_mid);
    const svg = renderPov({ road, occluders: line.resolved_scenario.occluders, line, sample, look: "limit_point" });
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg.trimEnd().endsWith("</svg>")).toBe(true);
    for (const banned of ["url(", "href", "<image", "<pattern", "<style", "@import", "<script", "xlink", "<use"]) {
      expect(svg.includes(banned), `self-contained SVG must not contain "${banned}"`).toBe(false);
    }
  });

  it("renderPovForFigure picks a focused line + default cursor and yields a self-contained pov SVG", { timeout: 300_000 }, () => {
    const env = book90();
    const lines = env.lines.filter((l): l is LineResult => !isLineRefusal(l));
    const focus = povFocusLine(lines);
    expect(focus).toBeDefined();
    expect(povDefaultSample(env.road, focus!)).toBeDefined();
    const svg = renderPovForFigure(env.road, lines, "heading" as PovLook);
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg).toContain('data-view="pov"');
    expect((svg.match(/data-marker="limit_point"/g) ?? []).length).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// The near-plane split (§5.2) and the roll toggle (design/07 §5.3)

/**
 * bookEsses is the road that broke the old projector: at any mid-chain station,
 * the 140 m lookahead runs out of sight and back again, and vertices dropped at
 * the near plane were being rejoined across the gap — the road folded into a
 * spike and the rider's line looped back through it (the fig-08-06 POV).
 */
function esses(): FigureResult {
  const r = run(
    { road: "bookEsses", entry_kmh: 32, mistake: { kind: "premature", at: "all" } },
    { engine_semver: ENGINE_SEMVER, figure_id: "F-POV-ESSES" }
  );
  if (!r.ok) throw new Error("bookEsses fixture failed to solve");
  return r.value;
}

describe("the road surface: per-station quads, never one folded ring (§5.2)", () => {
  const segmentsCross = (a: Pt, b: Pt, c: Pt, d: Pt): boolean => {
    const side = (p: Pt, q: Pt, r: Pt): number => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
    const d1 = side(a, b, c);
    const d2 = side(a, b, d);
    const d3 = side(c, d, a);
    const d4 = side(c, d, b);
    return d1 * d2 < 0 && d3 * d4 < 0;
  };
  /** A closed polygon crosses itself iff some pair of non-adjacent edges intersects. */
  const selfIntersects = (poly: readonly Pt[]): boolean => {
    const n = poly.length;
    for (let i = 0; i < n; i++) {
      for (let j = i + 2; j < n; j++) {
        if (i === 0 && j === n - 1) continue; // adjacent through the closing edge
        if (segmentsCross(poly[i]!, poly[(i + 1) % n]!, poly[j]!, poly[(j + 1) % n]!)) return true;
      }
    }
    return false;
  };

  it("the surface is per-station quads, and not one ring that folds through itself", { timeout: 600_000 }, () => {
    const env = esses();
    const line = firstLine(env, "solved");

    for (const sample of line.trajectory.samples.filter((_, i) => i % 7 === 0)) {
      const frame = povFrame({
        road: env.road,
        occluders: line.resolved_scenario.occluders,
        line,
        sample,
        look: "limit_point"
      });

      // (a) what ships now: every quad is a simple four-corner patch
      for (const quad of frame.road) {
        expect(quad).toHaveLength(4);
        expect(selfIntersects(quad), `a road quad folds through itself at s=${sample.s.toFixed(1)}`).toBe(false);
      }
      // a run is a drawable piece, never a stranded point
      for (const runPts of [...frame.laneLines, ...(frame.path?.runs ?? [])]) {
        expect(runPts.length).toBeGreaterThanOrEqual(2);
      }

      // (b) the mechanical signature of the defect: a FLAT road cannot appear
      // above eye level, so every drawn ground point must sit below the
      // horizon. The folded ring rose into the sky — that spike is what every
      // reader of the old fig-08-06 POV described as a mountain.
      const levelFrame = povFrame({
        road: env.road,
        occluders: line.resolved_scenario.occluders,
        line,
        sample,
        look: "limit_point",
        roll: "level"
      });
      const horizonY = levelFrame.height / 2;
      for (const quad of levelFrame.road) {
        for (const p of quad) {
          expect(p.y, `road drawn ${(horizonY - p.y).toFixed(1)} px above the horizon at s=${sample.s.toFixed(1)}`).toBeGreaterThan(horizonY);
        }
      }
      for (const runPts of levelFrame.laneLines) {
        for (const p of runPts) expect(p.y).toBeGreaterThan(horizonY);
      }
    }
  });
});

describe("roll: the frame carries lean, or the dial does (design/07 §5.3)", () => {
  it("roll=lean tilts the horizon by phi; roll=level holds it flat and still reports the lean", { timeout: 300_000 }, () => {
    const env = book90();
    const line = firstLine(env, "solved");
    const sample = midCornerSample(line, env.road.corners[0]!.s_mid);
    expect(Math.abs(sample.phi)).toBeGreaterThan(5); // a pose with real lean to see

    const leaned = povFrame({ road: env.road, occluders: [], line, sample, look: "heading", roll: "lean" });
    const level = povFrame({ road: env.road, occluders: [], line, sample, look: "heading", roll: "level" });

    // the ground polygon's first edge IS the horizon
    const horizonDeg = (f: typeof leaned): number => {
      const [a, b] = [f.ground[0]!, f.ground[1]!];
      return (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
    };
    expect(Math.abs(horizonDeg(level) % 180)).toBeLessThan(1e-6);
    expect(Math.abs(horizonDeg(leaned) % 180)).toBeGreaterThan(1);
    // lean is never lost — only moved to another channel
    expect(level.phi_deg).toBe(sample.phi);
    expect(level.roll).toBe("level");
  });

  it("the level frame still draws a lean dial, and the HUD carries its numbers as data", { timeout: 300_000 }, () => {
    const env = book90();
    const line = firstLine(env, "solved");
    const sample = midCornerSample(line, env.road.corners[0]!.s_mid);
    const svg = renderPov({ road: env.road, occluders: [], line, sample, look: "heading", roll: "level" });
    expect(svg).toContain("data-lean-dial=");
    expect(svg).toMatch(/data-sight-m="[-\d.]+"/);
    expect(svg).toMatch(/data-ssd-m="[-\d.]+"/);
    // rider words, not engine spelling
    expect(svg).toMatch(/lean \d+° (left|right)|upright/);
    expect(svg).toContain("to stop");
    expect(svg).not.toContain("ssd ");
  });
});
