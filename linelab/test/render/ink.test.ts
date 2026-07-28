// test/render/ink.test.ts — WP-14 gates (ARCHITECTURE §8 row WP-14 / §7):
//   P-PROJ-IDENTITY (P6), P-MARKS-EVENTS, P-INK-GRAMMAR, A-FIG82-SINGLEMARK,
//   A-FIG83-MARKS/TOPOLOGY precursors, A-LABEL-ANCHORS, A-ANCHOR-ERRORS,
//   A-LEGEND-AMBER, marker-collapse golden, no_view_mirror rejection,
//   gateProportions unit vectors, SVG well-formedness.
//
// Fixtures are HAND-BUILT `LineResult`s (a composed `ComposedRoad` for
// realistic geometry, but samples/events authored directly) — render/ never
// runs the physics engine or the solver; every draw decision is a pure read
// of a `LineResult`'s already-computed `trajectory`/`verdict`, so hand-built
// fixtures exercise the exact same code path a real solve would.
//
// Error assertions ride code + detail.reason, never message text (ARCHITECTURE §4).

import { describe, it, expect } from "vitest";
import { compose } from "../../src/road/compose.js";
import type { ComposedRoad } from "../../src/road/types.js";
import type {
  Event,
  Sample,
  Terminated,
  ResolvedOccluder,
  ResolvedHazard,
  Outcome
} from "../../src/core/types.js";
import type { FigureRole, Scenario, FigureLabel } from "../../src/plan/types.js";
import type { Quality } from "../../src/plan/doctrine/quality.js";
import type { LineResult, Verdict } from "../../src/solve/types.js";
import { ENGINE_ID } from "../../src/solve/types.js";
import { project } from "../../src/render/project.js";
import { deriveMarkers } from "../../src/render/markers.js";
import { resolveLabels } from "../../src/render/labels.js";
import { withLabels, withMarkers } from "../../src/render/scene.js";
import { renderTopdown } from "../../src/render/topdown.js";
import { renderViews } from "../../src/render/index.js";
import { gateProportions, computeProportionMetrics } from "../../src/render/gateProportions.js";
import { trajectoryInk, ROLE_DRAW_ORDER } from "../../src/render/ink.js";
import { QUALITY_COLOUR, MARK_COINCIDE_EPS_M, DOT_REF } from "../../src/render/constants.js";
import type { LinelabError, Result } from "../../src/core/result.js";

function unwrap<T>(r: Result<T>): T {
  if (!r.ok) throw new Error(`expected ok, got ${r.error.code}/${String(r.error.detail?.["reason"])}: ${r.error.message}`);
  return r.value;
}
function unwrapErr<T>(r: Result<T>): LinelabError {
  if (r.ok) throw new Error("expected an error result");
  return r.error;
}
function reasonOf(e: LinelabError): unknown {
  return e.detail?.["reason"];
}

// ---------------------------------------------------------------------------
// Fixture scaffolding

function buildRoad(dsl: string): ComposedRoad {
  const r = compose({ dsl, use_full_width: false });
  if (!r.ok) throw new Error(`fixture road failed to compose: ${r.error.message}`);
  return r.value;
}

const STRAIGHT_ROAD = buildRoad("lane 7 | S 200");
const CORNER_ROAD = buildRoad("lane 7 | S 30 | R 45 ^90 | S 60");

function mkSample(over: Partial<Sample>): Sample {
  const base: Sample = {
    s: 0, t: 0, x: 0, y: 0, psi: 0, v: 20, phi: 0, kappa: 0,
    a_long: 0, a_lat: 0, grip: 0.9, mu: 1, d: 0, f: 0.5,
    cmd_lean: 0, cmd_a: 0, roll_rate: 0, action_id: null, clipped: false,
    n_long: 0, n_lat: 0, sight_m: 100, ssd_m: 50, limit_x: 100, limit_y: 0,
    sight_ride_m: 100, steer_state: "track", lat_action_id: null,
    su_sustained: 0, su_transient: 0, a_cmd_rate: 0, below_validity: false
  };
  return { ...base, ...over };
}

/** Straight-line samples along +x (d=0) at 10 m spacing — `x === s` makes identity assertions exact. */
/**
 * A straight run of samples along +x. `y` offsets the whole run laterally —
 * the only way to build two lines whose events share a STATION but sit at
 * different DRAWN points, which is exactly the pair the §3.1 stage 9 collapse
 * rule has to tell apart (station tolerance vs glyph-radius tolerance).
 */
function straightSamples(from_s: number, to_s: number, step = 10, y = 0): Sample[] {
  const out: Sample[] = [];
  for (let s = from_s; s <= to_s; s += step) {
    out.push(mkSample({ s, t: s / 20, x: s, y, psi: 0, limit_x: s + 50, limit_y: y }));
  }
  return out;
}

function mkResolvedScenario(
  road: ComposedRoad,
  occluders: readonly ResolvedOccluder[] = [],
  hazards: readonly ResolvedHazard[] = []
) {
  return {
    spec: "linelab/1" as const,
    id: "fixture",
    road: {
      lane_width_m: road.lane_width_m,
      bike_margin_m: 0.4,
      use_full_width: road.use_full_width,
      segments: [],
      dsl: road.dsl
    },
    occluders,
    hazards,
    rider: { profile: "street" as const, start: { speed_kmh: 72, d: 0 }, plan: [] },
    config: { mu: 1.0, ds_m: 0.5, ssd_model: "alert" as const, rubric: "parks-street/1", checks_version: 2 as const }
  };
}

const DUMMY_SOURCE_SCENARIO: Scenario = {
  spec: "linelab/1",
  id: "fixture",
  road: { dsl: "lane 7 | S 10" },
  rider: { start: { speed_kmh: 72 }, plan: [] }
};

function mkVerdict(outcome: Outcome, quality: Quality): Verdict {
  return {
    ok: quality === "good",
    spec_hash: "abcdef",
    result_hash: "",
    checks_version: 2,
    rubric: "parks-street/1",
    engine: ENGINE_ID,
    outcome,
    quality,
    headline: "",
    diagnosis: null,
    acceptance: { policy: "clean", met: true },
    misjudgment: null,
    validity: null,
    corners: [],
    sight: null,
    constraints: null,
    doctrine: { pass: 0, fail: quality === "good" ? 0 : 1, warn: 0, na: 0, checks: [] }
  };
}

interface LineOpts {
  readonly id: string;
  readonly role: FigureRole;
  readonly label?: string;
  readonly outcome?: Outcome;
  readonly quality?: Quality;
  readonly samples: readonly Sample[];
  readonly events?: readonly Event[];
  readonly terminated?: Terminated;
  readonly road?: ComposedRoad;
  readonly occluders?: readonly ResolvedOccluder[];
  readonly hazards?: readonly ResolvedHazard[];
}

function mkLine(o: LineOpts): LineResult {
  const road = o.road ?? STRAIGHT_ROAD;
  const last = o.samples[o.samples.length - 1]!;
  const terminated: Terminated = o.terminated ?? { reason: "road_end", s: last.s, t: last.t, x: last.x, y: last.y };
  return {
    line_id: o.id,
    role: o.role,
    label: o.label ?? o.id,
    source: { kind: "scenario", scenario: DUMMY_SOURCE_SCENARIO },
    resolved_scenario: mkResolvedScenario(road, o.occluders ?? [], o.hazards ?? []),
    cache: "absent",
    trajectory: { samples: o.samples, events: o.events ?? [], terminated },
    verdict: mkVerdict(o.outcome ?? "contained", o.quality ?? "good")
  };
}

// ---------------------------------------------------------------------------
// SVG well-formedness: a regex-based tag-balance scanner (test-only tool).

const TAG_RE = /<\/?([a-zA-Z][a-zA-Z0-9:-]*)((?:"[^"]*"|'[^']*'|[^"'>])*?)\/?>/g;

function assertWellFormedSvg(svg: string): void {
  expect(svg.startsWith("<svg")).toBe(true);
  expect(svg.trim().endsWith("</svg>")).toBe(true);
  const stack: string[] = [];
  let m: RegExpExecArray | null;
  TAG_RE.lastIndex = 0;
  while ((m = TAG_RE.exec(svg)) !== null) {
    const whole = m[0];
    const name = m[1]!;
    if (whole.startsWith("</")) {
      const top = stack.pop();
      expect(top, `unbalanced closing tag </${name}> in: ${svg.slice(Math.max(0, m.index - 40), m.index + 40)}`).toBe(name);
    } else if (whole.endsWith("/>")) {
      // self-closing — balanced by construction
    } else {
      stack.push(name);
    }
  }
  expect(stack, `unclosed tags remain: ${stack.join(",")}`).toEqual([]);
}

// ---------------------------------------------------------------------------
// P-PROJ-IDENTITY (P6): true-mode project is identity ∘ crop

describe("P-PROJ-IDENTITY (P6)", () => {
  it("default view: coordinates unchanged for every sample inside the window", () => {
    const samples = straightSamples(0, 190);
    const line = mkLine({ id: "l1", role: "ideal", samples });
    const scene = unwrap(project(STRAIGHT_ROAD, [line], undefined));
    expect(scene.mode).toBe("true");
    expect(scene.orient).toBe(0);
    expect(scene.degraded).toBe(false);
    expect(scene.lines[0]!.polyline).toEqual(samples.map((s) => ({ x: s.x, y: s.y })));
  });

  it("window: 'all' is the identity on every sample, including window bounds", () => {
    const samples = straightSamples(0, 190);
    const line = mkLine({ id: "l1", role: "ideal", samples });
    const scene = unwrap(project(STRAIGHT_ROAD, [line], { window: "all" }));
    expect(scene.window).toEqual({ from_s: 0, to_s: 200 });
    expect(scene.lines[0]!.polyline).toEqual(samples.map((s) => ({ x: s.x, y: s.y })));
  });

  it("explicit window is identity ∘ crop: kept points are unchanged, out-of-window points are dropped", () => {
    const samples = straightSamples(0, 190);
    const line = mkLine({ id: "l1", role: "ideal", samples });
    const scene = unwrap(project(STRAIGHT_ROAD, [line], { window: { from: { at_s: 50 }, to: { at_s: 100 } } }));
    const kept = samples.filter((s) => s.s >= 50 && s.s <= 100);
    expect(scene.lines[0]!.polyline).toEqual(kept.map((s) => ({ x: s.x, y: s.y })));
    expect(scene.lines[0]!.polyline.length).toBeGreaterThan(0);
    expect(scene.lines[0]!.polyline.length).toBeLessThan(samples.length);
  });
});

// ---------------------------------------------------------------------------
// P-MARKS-EVENTS: markers exist iff the underlying event exists

describe("P-MARKS-EVENTS", () => {
  it("a line with turn_in/apex/exit events produces exactly those markers, at the matched sample position", () => {
    const samples = straightSamples(0, 90, 5);
    const events: Event[] = [
      { kind: "turn_in", s: 20, t: 1, corner_id: "c1" },
      { kind: "apex", s: 40, t: 2, corner_id: "c1" },
      { kind: "exit", s: 60, t: 3, corner_id: "c1" }
    ];
    const line = mkLine({ id: "l1", role: "ideal", samples, events });
    const markers = deriveMarkers([line], "auto");
    expect(markers.map((m) => m.cls).sort()).toEqual(["apex", "exit", "turn_point"]);
    const turnPoint = markers.find((m) => m.cls === "turn_point")!;
    expect(turnPoint.at).toEqual({ x: 20, y: 0 });
    expect(turnPoint.colour).toBe(QUALITY_COLOUR.good);
  });

  it("a line with no events produces no markers — the empty set is the honest render", () => {
    const line = mkLine({ id: "l1", role: "ideal", samples: straightSamples(0, 50, 10), events: [] });
    expect(deriveMarkers([line], "auto")).toEqual([]);
  });

  it("marks: 'none' suppresses every class even with events present", () => {
    const events: Event[] = [{ kind: "apex", s: 10, t: 1 }];
    const line = mkLine({ id: "l1", role: "ideal", samples: straightSamples(0, 20, 5), events });
    expect(deriveMarkers([line], "none")).toEqual([]);
  });

  it("marks: an explicit class list only enables the named classes", () => {
    const events: Event[] = [
      { kind: "apex", s: 10, t: 1 },
      { kind: "exit", s: 20, t: 2 }
    ];
    const line = mkLine({ id: "l1", role: "ideal", samples: straightSamples(0, 30, 5), events });
    const markers = deriveMarkers([line], ["apex"]);
    expect(markers.map((m) => m.cls)).toEqual(["apex"]);
  });
});

// ---------------------------------------------------------------------------
// A-FIG82-SINGLEMARK / A-FIG83-MARKS/TOPOLOGY precursors

describe("A-FIG82-SINGLEMARK / A-FIG83-MARKS precursors", () => {
  it("fig 8.2 device: a single turn_in produces exactly one hourglass (turn_point) marker", () => {
    const events: Event[] = [{ kind: "turn_in", s: 15, t: 1, corner_id: "c1" }];
    const line = mkLine({ id: "l1", role: "ideal", samples: straightSamples(0, 30, 5), events });
    const markers = deriveMarkers([line], "auto");
    expect(markers).toHaveLength(1);
    expect(markers[0]!.cls).toBe("turn_point");
  });

  it("fig 8.3 device: a multi-facet line (well-separated turn_ins) draws one hourglass per turn_in", () => {
    const events: Event[] = [
      { kind: "turn_in", s: 10, t: 1, corner_id: "c1" },
      { kind: "turn_in", s: 40, t: 2, corner_id: "c1" },
      { kind: "turn_in", s: 70, t: 3, corner_id: "c1" }
    ];
    const line = mkLine({ id: "l1", role: "ideal", samples: straightSamples(0, 90, 5), events });
    const markers = deriveMarkers([line], "auto");
    expect(markers.filter((m) => m.cls === "turn_point")).toHaveLength(3);
  });
});

// ---------------------------------------------------------------------------
// marker-collapse golden
//
// design/06 §3.1 stage 9, L404-406, verbatim: "**Coincident collapse:** after
// projection, markers of the same class whose true stations lie within
// `MARK_COINCIDE_EPS_M = 1.0 m` (TUNING) **and** whose drawn positions overlap
// within one glyph radius collapse to one glyph, drawn in the colour of the
// owning line drawn last in role order (ideal wins ties) — deterministic,
// never a Z-fight. Markers of different classes never collapse."
//
// TWO tolerances, not one. The station test is 1.0 m; the DRAWN-position test
// is one glyph radius — a draw-time quantity (`pxScale × MARKER_R_PX`) that
// only exists once the projection has fixed the viewBox. So these goldens read
// the RENDERED glyph set, not `deriveMarkers`'s return, which is also how
// design/09 §5.4 states the golden: "two lines sharing a turn-in with both
// marked → **one glyph**, topmost-draw-order colour". The glyph radius is read
// back OFF the artifact (§5.2 audit mode: the renderer cannot self-certify),
// so no test here re-declares the presentation constant.

/** every apex ring the renderer actually drew: centre, radius, owning line. */
function apexRings(svg: string): readonly { cx: number; cy: number; r: number; line_id: string }[] {
  const attr = (el: string, name: string): string => {
    const m = new RegExp(`${name}="([^"]*)"`).exec(el);
    if (m === null) throw new Error(`glyph has no ${name}: ${el}`);
    return m[1]!;
  };
  return [...svg.matchAll(/<circle[^>]*?data-marker-class="apex"[^>]*?\/>/g)].map((m) => ({
    cx: Number(attr(m[0], "cx")),
    cy: Number(attr(m[0], "cy")),
    r: Number(attr(m[0], "r")),
    line_id: attr(m[0], "data-line-id")
  }));
}

describe("marker-collapse golden (design/06 §3.1 stage 9, L404-406)", () => {
  // `all` (not `auto`) — collapse is a cross-LINE rule, so every line has to be
  // marked for it to have anything to collapse; `auto` marks the ideal line
  // only (design/04 §7), which is asserted separately below.
  //
  // Three apexes, all inside the 1.0 m STATION window of each other:
  //   mistake1 @ s = 20    → drawn (20, 0)
  //   ideal1   @ s = 20.4  → drawn (20, 0)    — nearest sample is the same one
  //   alt1     @ s = 20    → drawn (20, 0.9)  — a laterally offset line
  // So the station test cannot separate any of them, and only the drawn-
  // position test can: the first two are the SAME point (they overlap at any
  // radius), the third is 0.9 m away — several glyph radii clear.
  function threeApexes(): readonly LineResult[] {
    const onAxis = straightSamples(0, 40, 5);
    const offAxis = straightSamples(0, 40, 5, 0.9);
    return [
      mkLine({
        id: "mistake1",
        role: "mistake",
        quality: "failing",
        outcome: "runoff",
        samples: onAxis,
        events: [{ kind: "apex", s: 20, t: 1, corner_id: "c1" }]
      }),
      mkLine({
        id: "ideal1",
        role: "ideal",
        quality: "good",
        samples: onAxis,
        events: [{ kind: "apex", s: 20.4, t: 1, corner_id: "c1" }]
      }),
      mkLine({
        id: "alt1",
        role: "alternative",
        quality: "caution",
        samples: offAxis,
        events: [{ kind: "apex", s: 20, t: 1, corner_id: "c1" }]
      })
    ];
  }

  it("two apexes at the SAME drawn point collapse to one glyph — ideal wins the tie", () => {
    expect(MARK_COINCIDE_EPS_M).toBe(1.0);
    const svg = unwrap(renderViews({ road: STRAIGHT_ROAD, lines: threeApexes(), marks: "all" })).svg;
    const onAxis = apexRings(svg).filter((g) => Math.abs(g.cy) < 1e-9);
    expect(onAxis).toHaveLength(1);
    expect(onAxis[0]!.line_id).toBe("ideal1"); // ideal drawn last in role order
    expect(svg).toContain(`stroke="${QUALITY_COLOUR.good}" stroke-width`);
  });

  it("an apex pair inside MARK_COINCIDE_EPS_M but further apart than one glyph radius stays TWO glyphs", () => {
    const svg = unwrap(renderViews({ road: STRAIGHT_ROAD, lines: threeApexes(), marks: "all" })).svg;
    const rings = apexRings(svg);
    // the radius the renderer actually drew with — read back off the artifact,
    // never re-declared here. 0.9 m has to be several radii clear for this
    // fixture to be testing what it claims to test.
    const r = rings[0]!.r;
    expect(r).toBeGreaterThan(0);
    expect(r).toBeLessThan(0.9);
    // |Δs| = 0.0 and 0.4 — both well inside MARK_COINCIDE_EPS_M — so ONLY the
    // drawn-position test can keep `alt1`'s apex alive. Reusing 1.0 m for that
    // test (the pre-fix engine) swallows it and leaves one glyph.
    expect(rings).toHaveLength(2);
    expect(rings.map((g) => g.line_id).sort()).toEqual(["alt1", "ideal1"]);
    const offAxis = rings.find((g) => g.line_id === "alt1")!;
    expect(Math.abs(offAxis.cy - 0.9)).toBeLessThan(1e-9);
  });

  it("a marker never joins a collapse through a THIRD marker it does not itself overlap", () => {
    // L404-406 states a PAIRWISE relation: "markers ... whose drawn positions
    // overlap within one glyph radius collapse to one glyph". A cluster grown
    // against ANY member already absorbed lets a marker in transitively —
    // A swallows C, C then drags in B, and B never overlapped the glyph that
    // remains. Three apexes at the same station, in a chain:
    //   near @ y = 0.0  (the seed)
    //   mid  @ y = 0.3  — overlaps `near`
    //   far  @ y = 0.6  — overlaps `mid`, but NOT `near`
    const at = (y: number): Sample[] => straightSamples(0, 40, 5, y);
    const apexAt20 = [{ kind: "apex" as const, s: 20, t: 1, corner_id: "c1" }];
    const lines = [
      mkLine({ id: "near", role: "ideal", quality: "good", samples: at(0), events: apexAt20 }),
      mkLine({ id: "mid", role: "mistake", quality: "failing", outcome: "runoff", samples: at(0.3), events: apexAt20 }),
      mkLine({ id: "far", role: "alternative", quality: "caution", samples: at(0.6), events: apexAt20 })
    ];
    const rings = apexRings(unwrap(renderViews({ road: STRAIGHT_ROAD, lines, marks: "all" })).svg);
    const r = rings[0]!.r;
    // the fixture only tests what it claims while the radius separates the
    // chain: `mid` inside it, `far` outside it.
    expect(r).toBeGreaterThan(0.3);
    expect(r).toBeLessThan(0.6);
    expect(rings).toHaveLength(2);
    // `near` + `mid` collapse to `near` (ideal is drawn last of the three);
    // `far` keeps its own glyph, because the only glyph it ever overlapped is
    // one that no longer exists.
    expect(rings.map((g) => g.line_id)).toEqual(["near", "far"]);
  });

  it("markers of different classes never collapse, even at the identical station", () => {
    const s0 = straightSamples(0, 20, 5);
    const line = mkLine({
      id: "l1",
      role: "ideal",
      samples: s0,
      events: [
        { kind: "apex", s: 10, t: 1, corner_id: "c1" },
        { kind: "exit", s: 10, t: 1, corner_id: "c1" }
      ]
    });
    const svg = unwrap(renderViews({ road: STRAIGHT_ROAD, lines: [line], marks: "auto" })).svg;
    expect([...svg.matchAll(/data-marker-class="([a-z_]+)"/g)].map((m) => m[1]).sort()).toEqual(["apex", "exit"]);
    // and the enable-set law still resolves them without any draw step
    expect(deriveMarkers([line], "auto").map((m) => m.cls).sort()).toEqual(["apex", "exit"]);
  });
});

// ---------------------------------------------------------------------------
// P-INK-GRAMMAR

describe("P-INK-GRAMMAR", () => {
  it("trajectoryInk: every role is solid + arrowhead except reference, which alone is dotted", () => {
    for (const role of ROLE_DRAW_ORDER) {
      const ink = trajectoryInk(role);
      expect(ink.arrowhead).toBe(true);
      if (role === "reference") expect(ink.dash).toBe(DOT_REF);
      else expect(ink.dash).toBeNull();
    }
  });

  it("colour comes from quality, never role: good/caution/failing lines get exactly QUALITY_COLOUR", () => {
    const good = mkLine({ id: "good", role: "ideal", quality: "good", outcome: "contained", samples: straightSamples(0, 20, 10) });
    const caution = mkLine({ id: "caution", role: "mistake", quality: "caution", outcome: "contained", samples: straightSamples(0, 20, 10) });
    const failing = mkLine({ id: "failing", role: "alternative", quality: "failing", outcome: "crash", samples: straightSamples(0, 20, 10) });
    const scene = unwrap(project(STRAIGHT_ROAD, [good, caution, failing], { window: "all" }));
    const byId = Object.fromEntries(scene.lines.map((l) => [l.line_id, l]));
    expect(byId["good"]!.colour).toBe(QUALITY_COLOUR.good);
    expect(byId["caution"]!.colour).toBe(QUALITY_COLOUR.caution);
    expect(byId["failing"]!.colour).toBe(QUALITY_COLOUR.failing);
  });

  it("SVG: only sight rays are dashed — trajectory lines (incl. reference) carry no stroke-dasharray on the polyline itself, except role=reference's own dotted stroke", () => {
    const occ: ResolvedOccluder = { id: "o1", kind: "hedge", side: "outside", at: { at_s: 40 }, span_m: 10 };
    const idealSamples = straightSamples(0, 60, 5).map((s) => ({ ...s, limit_x: s.x + 30, limit_y: s.y }));
    const ideal = mkLine({
      id: "ideal",
      role: "ideal",
      samples: idealSamples,
      events: [{ kind: "turn_in", s: 20, t: 1, corner_id: "c1" }],
      occluders: [occ]
    });
    const reference = mkLine({ id: "reference", role: "reference", samples: straightSamples(0, 60, 5), occluders: [occ] });
    const scene = unwrap(project(STRAIGHT_ROAD, [ideal, reference], { window: "all" }));
    expect(scene.lines.find((l) => l.line_id === "ideal")!.sightRay).not.toBeNull();
    const svg = renderTopdown(scene);
    assertWellFormedSvg(svg);
    // the ideal line's own polyline element carries no dasharray attribute
    const idealPolylineMatch = svg.match(/<polyline[^>]*data-line-id="ideal"[^>]*\/>/);
    expect(idealPolylineMatch).not.toBeNull();
    expect(idealPolylineMatch![0]).not.toContain("stroke-dasharray");
    // the sight-ray element (dashed, no arrowhead) is present and tagged
    const rayMatch = svg.match(/<line[^>]*data-ray-line="ideal"[^>]*\/>/);
    expect(rayMatch).not.toBeNull();
    expect(rayMatch![0]).toContain("stroke-dasharray");
    expect(rayMatch![0]).not.toContain("marker-end");
  });
});

// ---------------------------------------------------------------------------
// stage 7/8 fixed role draw order (design/06 §3.1 stage 8: "reference →
// alternative → mistake → ideal, ideal on top") — rev-render finding (1).

describe("stage draw order is role-fixed, independent of caller order", () => {
  it("scene.lines is sorted reference → alternative → mistake → ideal regardless of the array project() was called with", () => {
    const samples = straightSamples(0, 20, 10);
    // deliberately shuffled: ideal first, reference last — the OPPOSITE of the pinned order
    const ideal = mkLine({ id: "ideal", role: "ideal", quality: "good", samples });
    const mistake = mkLine({ id: "mistake", role: "mistake", quality: "failing", outcome: "crash", samples });
    const alternative = mkLine({ id: "alternative", role: "alternative", quality: "caution", samples });
    const reference = mkLine({ id: "reference", role: "reference", samples });
    const scene = unwrap(project(STRAIGHT_ROAD, [ideal, mistake, alternative, reference], { window: "all" }));
    expect(scene.lines.map((l) => l.role)).toEqual(["reference", "alternative", "mistake", "ideal"]);
  });

  it("SVG: with occluders (rays render) and a shuffled caller order, the ideal line's polyline AND ray draw after the mistake line's — ideal paints on top", () => {
    const occ: ResolvedOccluder = { id: "o1", kind: "hedge", side: "outside", at: { at_s: 5 }, span_m: 10 };
    const samples = straightSamples(0, 60, 5).map((s) => ({ ...s, limit_x: s.x + 30, limit_y: s.y }));
    const events: Event[] = [{ kind: "turn_in", s: 10, t: 1, corner_id: "c1" }];
    // caller order: mistake AFTER ideal — if the renderer trusted caller order,
    // mistake's (failing/red) ink would land on top of ideal's (good/green)
    const mistake = mkLine({ id: "mistake", role: "mistake", quality: "failing", outcome: "crash", samples, events, occluders: [occ] });
    const ideal = mkLine({ id: "ideal", role: "ideal", quality: "good", samples, events, occluders: [occ] });
    const scene = unwrap(project(STRAIGHT_ROAD, [mistake, ideal], { window: "all" }));
    const svg = renderTopdown(scene);
    assertWellFormedSvg(svg);

    const idealLineIdx = svg.indexOf('data-line-id="ideal"');
    const mistakeLineIdx = svg.indexOf('data-line-id="mistake"');
    expect(idealLineIdx).toBeGreaterThan(-1);
    expect(mistakeLineIdx).toBeGreaterThan(-1);
    expect(idealLineIdx).toBeGreaterThan(mistakeLineIdx); // ideal drawn later == on top

    const idealRayIdx = svg.indexOf('data-ray-line="ideal"');
    const mistakeRayIdx = svg.indexOf('data-ray-line="mistake"');
    expect(idealRayIdx).toBeGreaterThan(-1);
    expect(mistakeRayIdx).toBeGreaterThan(-1);
    expect(idealRayIdx).toBeGreaterThan(mistakeRayIdx);
  });

  it("legend row order matches the same fixed role order, for the same shuffled input", () => {
    const samples = straightSamples(0, 20, 10);
    const ideal = mkLine({ id: "ideal", role: "ideal", quality: "good", samples });
    const alternative = mkLine({ id: "alternative", role: "alternative", quality: "caution", samples });
    const scene = unwrap(project(STRAIGHT_ROAD, [ideal, alternative], { window: "all", legend: "on" }));
    expect(scene.legend.rows.map((r) => r.role)).toEqual(["alternative", "ideal"]);
  });
});

// ---------------------------------------------------------------------------
// stage 6 occlusion wash — scoped to beyond the ray's limit point (design/06
// §3.1 stage 6) — rev-render finding (2).

describe("stage 6 occlusion wash is scoped beyond the sight ray's limit point", () => {
  it("occlusionWash is null when there is no occluder", () => {
    const line = mkLine({ id: "l1", role: "ideal", samples: straightSamples(0, 60, 5) });
    const scene = unwrap(project(STRAIGHT_ROAD, [line], { window: "all" }));
    expect(scene.occlusionWash).toBeNull();
  });

  it("occlusionWash covers only the road strip from s_limit onward — never the full window", () => {
    const occ: ResolvedOccluder = { id: "o1", kind: "hedge", side: "outside", at: { at_s: 5 }, span_m: 10 };
    // x === s on the straight fixture road; sight_m=100 with limit_x = s+50 (mkSample default override below)
    const samples = straightSamples(0, 190, 10).map((s) => ({ ...s, sight_m: 40, limit_x: s.x + 40, limit_y: s.y }));
    const events: Event[] = [{ kind: "turn_in", s: 20, t: 1, corner_id: "c1" }];
    const line = mkLine({ id: "l1", role: "ideal", samples, events, occluders: [occ] });
    const scene = unwrap(project(STRAIGHT_ROAD, [line], { window: "all" }));
    expect(scene.occlusionWash).not.toBeNull();
    const wash = scene.occlusionWash!;
    // the turn_in sample is at s=20, so s_limit = 20 + 40 = 60 — nothing drawn
    // in the wash should sit (in x, since x === s here) meaningfully before 60
    const minWashX = Math.min(...wash.map((p) => p.x));
    expect(minWashX).toBeGreaterThanOrEqual(60 - 1e-6);
    // and it must NOT cover the whole road from station 0 (the pre-fix bug)
    expect(minWashX).toBeGreaterThan(0);
    // the wash reaches to the window end (200, clamped to road length)
    const maxWashX = Math.max(...wash.map((p) => p.x));
    expect(maxWashX).toBeGreaterThan(150);
  });

  it("occlusionWash is null when the limit point is beyond the drawn window (nothing to wash)", () => {
    const occ: ResolvedOccluder = { id: "o1", kind: "hedge", side: "outside", at: { at_s: 5 }, span_m: 10 };
    const samples = straightSamples(0, 60, 5).map((s) => ({ ...s, sight_m: 300, limit_x: s.x + 300, limit_y: s.y }));
    const events: Event[] = [{ kind: "turn_in", s: 10, t: 1, corner_id: "c1" }];
    const line = mkLine({ id: "l1", role: "ideal", samples, events, occluders: [occ] });
    const scene = unwrap(project(STRAIGHT_ROAD, [line], { window: { from: { at_s: 0 }, to: { at_s: 50 } } }));
    expect(scene.occlusionWash).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// stage 4 gravel surface patches (design/06 §3.1 stage 4; design/03 §4.2) —
// rev-render finding (3).

describe("stage 4 — gravel hazard stippled-circle patches", () => {
  const gravel: ResolvedHazard = { id: "h1", kind: "gravel", side: "outside", at: { at_s: 10 }, span_m: 6, width_m: 1.4, mu: 0.4 };

  it("a hazard on the line's resolved_scenario produces a DrawnHazard with a non-empty deterministic stipple grid", () => {
    const line = mkLine({ id: "l1", role: "ideal", samples: straightSamples(0, 60, 5), hazards: [gravel] });
    const scene = unwrap(project(STRAIGHT_ROAD, [line], { window: "all" }));
    expect(scene.hazards).toHaveLength(1);
    expect(scene.hazards[0]!.id).toBe("h1");
    expect(scene.hazards[0]!.stipples.length).toBeGreaterThan(0);
    // determinism: re-running project() on the identical input reproduces the identical grid
    const again = unwrap(project(STRAIGHT_ROAD, [line], { window: "all" }));
    expect(again.hazards[0]!.stipples).toEqual(scene.hazards[0]!.stipples);
  });

  it("no hazards on the figure ⇒ scene.hazards is empty and stage 4 draws nothing", () => {
    const line = mkLine({ id: "l1", role: "ideal", samples: straightSamples(0, 60, 5) });
    const scene = unwrap(project(STRAIGHT_ROAD, [line], { window: "all" }));
    expect(scene.hazards).toEqual([]);
    const svg = renderTopdown(scene);
    expect(svg).not.toContain('data-hazard-kind="gravel"');
  });

  it("SVG: the gravel patch renders as explicit stipple circles (no SVG <pattern>), one per stipple, at stage 4 — before stage 5 occluders", () => {
    const occ: ResolvedOccluder = { id: "o1", kind: "wall", side: "outside", at: { at_s: 30 }, span_m: 5 };
    const line = mkLine({ id: "l1", role: "ideal", samples: straightSamples(0, 60, 5), hazards: [gravel], occluders: [occ] });
    const scene = unwrap(project(STRAIGHT_ROAD, [line], { window: "all" }));
    const svg = renderTopdown(scene);
    assertWellFormedSvg(svg);
    expect(svg).not.toContain("<pattern");
    const circleCount = (svg.match(/data-hazard-kind="gravel"/g) ?? []).length;
    expect(circleCount).toBe(scene.hazards[0]!.stipples.length);
    expect(circleCount).toBeGreaterThan(0);
    const gravelStageIdx = svg.indexOf('data-stage="4-gravel"');
    const occluderStageIdx = svg.indexOf('data-stage="5-occluders"');
    expect(gravelStageIdx).toBeGreaterThan(-1);
    expect(occluderStageIdx).toBeGreaterThan(gravelStageIdx);
  });
});

// ---------------------------------------------------------------------------
// stage 5 occluder schematic glyphs (design/06 §3.1 stage 5) — rev-render
// finding (4): hedge (blob), wall (hatched), bank (contoured), vehicle
// (rounded rect + windshield hint) must read as distinct glyphs, not just a
// differently-coloured copy of the raw footprint polygon.

describe("stage 5 — occluder schematic glyphs are kind-differentiated", () => {
  function sceneWithOccluder(occ: ResolvedOccluder) {
    const samples = straightSamples(0, 60, 5).map((s) => ({ ...s, limit_x: s.x + 30, limit_y: s.y }));
    const line = mkLine({ id: "l1", role: "ideal", samples, events: [{ kind: "turn_in", s: 10, t: 1 }], occluders: [occ] });
    return unwrap(project(STRAIGHT_ROAD, [line], { window: "all" }));
  }

  it("hedge draws its base footprint plus bump circles (organic-blob glyph), distinct from the wall/bank treatments", () => {
    const scene = sceneWithOccluder({ id: "o1", kind: "hedge", side: "outside", at: { at_s: 20 }, span_m: 8 });
    const svg = renderTopdown(scene);
    assertWellFormedSvg(svg);
    expect(svg).toMatch(/<circle[^>]*data-occluder-kind="hedge"/);
    expect(svg).not.toMatch(/<line[^>]*data-occluder-kind="hedge"/);
  });

  it("wall draws its base footprint plus cross-hatch lines, distinct from hedge/bank", () => {
    const scene = sceneWithOccluder({ id: "o1", kind: "wall", side: "outside", at: { at_s: 20 }, span_m: 8 });
    const svg = renderTopdown(scene);
    assertWellFormedSvg(svg);
    expect(svg).toMatch(/<line[^>]*data-occluder-kind="wall"/);
    expect(svg).not.toMatch(/<circle[^>]*data-occluder-kind="wall"/);
  });

  it("bank draws its base footprint plus two contour polylines, distinct from hedge/wall", () => {
    const scene = sceneWithOccluder({ id: "o1", kind: "bank", side: "outside", at: { at_s: 20 }, span_m: 8 });
    const svg = renderTopdown(scene);
    assertWellFormedSvg(svg);
    const contours = svg.match(/<polyline[^>]*data-occluder-kind="bank"/g) ?? [];
    expect(contours.length).toBe(2);
    expect(svg).not.toMatch(/<circle[^>]*data-occluder-kind="bank"/);
  });

  it("vehicle draws its base rectangle plus a lighter windshield-hint polygon", () => {
    const scene = sceneWithOccluder({ id: "o1", kind: "vehicle", lane: "oncoming", at: { at_s: 20 } });
    const svg = renderTopdown(scene);
    assertWellFormedSvg(svg);
    const vehiclePolys = svg.match(/<polygon[^>]*data-occluder-kind="vehicle"[^>]*\/>/g) ?? [];
    // base rectangle + windshield-hint polygon
    expect(vehiclePolys.length).toBe(2);
    expect(vehiclePolys.some((p) => p.includes('fill="#cfd6e6"'))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// A-LABEL-ANCHORS / A-ANCHOR-ERRORS

describe("A-LABEL-ANCHORS", () => {
  it("resolves feature[:corner]@line to the matched event's nearest-sample world position", () => {
    const samples = straightSamples(0, 60, 5);
    const line = mkLine({ id: "l1", role: "ideal", samples, events: [{ kind: "apex", s: 30, t: 1, corner_id: "c1" }] });
    const labels: FigureLabel[] = [{ feature: "apex", corner: "c1", line: "l1" }];
    const resolved = unwrap(resolveLabels([line], labels));
    expect(resolved).toHaveLength(1);
    expect(resolved[0]!.anchor).toEqual({ x: 30, y: 0 });
  });

  it("#n disambiguates multiple matches deterministically, in station order", () => {
    const samples = straightSamples(0, 90, 5);
    const events: Event[] = [
      { kind: "apex", s: 20, t: 1, corner_id: "c1" },
      { kind: "apex", s: 50, t: 2, corner_id: "c2" }
    ];
    const line = mkLine({ id: "l1", role: "ideal", samples, events });
    const first = unwrap(resolveLabels([line], [{ feature: "apex", line: "l1", n: 1 }]));
    const second = unwrap(resolveLabels([line], [{ feature: "apex", line: "l1", n: 2 }]));
    expect(first[0]!.anchor.x).toBe(20);
    expect(second[0]!.anchor.x).toBe(50);
  });

  it("offset_m shifts the leader target along the line", () => {
    const samples = straightSamples(0, 60, 5);
    const line = mkLine({ id: "l1", role: "ideal", samples, events: [{ kind: "exit", s: 30, t: 1, corner_id: "c1" }] });
    const resolved = unwrap(resolveLabels([line], [{ feature: "exit", line: "l1", offset_m: 10 }]));
    expect(resolved[0]!.anchor.x).toBe(40);
  });
});

describe("A-ANCHOR-ERRORS", () => {
  it("an unknown line reference is UNKNOWN_ID/anchor_no_match", () => {
    const line = mkLine({ id: "l1", role: "ideal", samples: straightSamples(0, 20, 5) });
    const r = resolveLabels([line], [{ feature: "apex", line: "nope" }]);
    const e = unwrapErr(r);
    expect(e.code).toBe("UNKNOWN_ID");
    expect(reasonOf(e)).toBe("anchor_no_match");
  });

  it("a feature with zero matching events is UNKNOWN_ID/anchor_no_match", () => {
    const line = mkLine({ id: "l1", role: "ideal", samples: straightSamples(0, 20, 5), events: [] });
    const e = unwrapErr(resolveLabels([line], [{ feature: "apex", line: "l1" }]));
    expect(e.code).toBe("UNKNOWN_ID");
    expect(reasonOf(e)).toBe("anchor_no_match");
  });

  it("a feature with multiple matches and no #n is UNKNOWN_ID/anchor_ambiguous", () => {
    const events: Event[] = [
      { kind: "apex", s: 10, t: 1, corner_id: "c1" },
      { kind: "apex", s: 40, t: 2, corner_id: "c2" }
    ];
    const line = mkLine({ id: "l1", role: "ideal", samples: straightSamples(0, 60, 5), events });
    const e = unwrapErr(resolveLabels([line], [{ feature: "apex", line: "l1" }]));
    expect(e.code).toBe("UNKNOWN_ID");
    expect(reasonOf(e)).toBe("anchor_ambiguous");
  });

  it("an out-of-range #n is UNKNOWN_ID/anchor_no_match", () => {
    const line = mkLine({ id: "l1", role: "ideal", samples: straightSamples(0, 20, 5), events: [{ kind: "apex", s: 10, t: 1 }] });
    const e = unwrapErr(resolveLabels([line], [{ feature: "apex", line: "l1", n: 3 }]));
    expect(e.code).toBe("UNKNOWN_ID");
    expect(reasonOf(e)).toBe("anchor_no_match");
  });
});

// ---------------------------------------------------------------------------
// A-LEGEND-AMBER

describe("A-LEGEND-AMBER", () => {
  it("a caution line renders the amber legend row: role · caution (contained)", () => {
    const good = mkLine({ id: "good", role: "ideal", quality: "good", outcome: "contained", label: "good", samples: straightSamples(0, 20, 10) });
    const caution = mkLine({
      id: "wide1",
      role: "alternative",
      quality: "caution",
      outcome: "contained",
      label: "wide",
      samples: straightSamples(0, 20, 10)
    });
    const scene = unwrap(project(STRAIGHT_ROAD, [good, caution], { window: "all" }));
    expect(scene.legend.visible).toBe(true);
    const row = scene.legend.rows.find((r) => r.line_id === "wide1")!;
    expect(row.quality).toBe("caution");
    expect(row.outcome).toBe("contained");
    expect(row.swatch.colour).toBe(QUALITY_COLOUR.caution);

    const withMarks = withLabels(withMarkers(scene, []), []);
    const svg = renderTopdown(withMarks);
    assertWellFormedSvg(svg);
    expect(svg).toMatch(/data-legend-row="wide1"[^>]*>wide — alternative · caution \(contained\)</);
  });

  it("legend auto-trigger: a single all-good line does NOT render the legend", () => {
    const good = mkLine({ id: "good", role: "ideal", quality: "good", samples: straightSamples(0, 20, 10) });
    const scene = unwrap(project(STRAIGHT_ROAD, [good], { window: "all" }));
    expect(scene.legend.visible).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// no_view_mirror rejection (D26)

describe("no_view_mirror rejection", () => {
  it("a mirror/flip-shaped orient value rejects SCHEMA/no_view_mirror", () => {
    const line = mkLine({ id: "l1", role: "ideal", samples: straightSamples(0, 20, 10) });
    const e = unwrapErr(project(STRAIGHT_ROAD, [line], { orient: "flip" as unknown as 0 }));
    expect(e.code).toBe("SCHEMA");
    expect(reasonOf(e)).toBe("no_view_mirror");
    expect(e.message).toContain("hand=");
  });

  it("explicit numeric orient (0/90/180/270) is honored, not rejected", () => {
    const line = mkLine({ id: "l1", role: "ideal", samples: straightSamples(0, 20, 10) });
    const scene = unwrap(project(STRAIGHT_ROAD, [line], { orient: 90 }));
    expect(scene.orient).toBe(90);
  });
});

// ---------------------------------------------------------------------------
// Phase-gating: deferred tokens (ARCHITECTURE §6.4) — render/project.ts's own
// typed rejections, independent of cli/deferred.ts

describe("phase-gated ViewSpec fields (§6.4)", () => {
  const line = mkLine({ id: "l1", role: "ideal", samples: straightSamples(0, 20, 10) });

  it('mode: "diagram" rejects SCHEMA/deferred "projection (post-v0.1)"', () => {
    const e = unwrapErr(project(STRAIGHT_ROAD, [line], { mode: "diagram" as unknown as "true" }));
    expect(e.code).toBe("SCHEMA");
    expect(e.deferred).toBe("projection (post-v0.1)");
  });

  it("width_exag rejects the same deferred token", () => {
    const e = unwrapErr(project(STRAIGHT_ROAD, [line], { width_exag: 3.5 } as unknown as Record<string, unknown>));
    expect(e.code).toBe("SCHEMA");
    expect(e.deferred).toBe("projection (post-v0.1)");
  });

  it("view.fan rejects SCHEMA/deferred \"continuation envelope (D45)\"", () => {
    const e = unwrapErr(project(STRAIGHT_ROAD, [line], { fan: "auto" } as unknown as Record<string, unknown>));
    expect(e.code).toBe("SCHEMA");
    expect(e.deferred).toBe("continuation envelope (D45)");
  });

  it("render target 'pov' SHIPS in v0.3 immersion — renderViews renders the first-person view, not a deferral", () => {
    const r = renderViews({ road: STRAIGHT_ROAD, lines: [line], target: "pov" });
    expect(r.ok, r.ok ? "" : JSON.stringify(r.error)).toBe(true);
    if (r.ok) expect(r.value.svg).toContain('data-view="pov"');
  });
});

// ---------------------------------------------------------------------------
// BAD_RANGE — empty/inverted window

describe("project() window failures", () => {
  it("an inverted explicit window rejects BAD_RANGE", () => {
    const line = mkLine({ id: "l1", role: "ideal", samples: straightSamples(0, 20, 10) });
    const e = unwrapErr(project(STRAIGHT_ROAD, [line], { window: { from: { at_s: 100 }, to: { at_s: 10 } } }));
    expect(e.code).toBe("BAD_RANGE");
    expect(reasonOf(e)).toBe("window_empty_or_inverted");
  });
});

// ---------------------------------------------------------------------------
// gateProportions unit vectors

describe("gateProportions", () => {
  it("in-band metrics pass with no findings", () => {
    const result = gateProportions({
      width_ratio: [{ corner_id: "c1", value: 0.6 }],
      straight_share: 0.3,
      road_ink: 0.4,
      frame_aspect: 1.0
    });
    expect(result.verdict).toBe("pass");
    expect(result.findings).toEqual([]);
  });

  it("a corner's width_ratio far outside the band fails, named by metric and corner_id", () => {
    const result = gateProportions({
      width_ratio: [{ corner_id: "c1", value: 0.08 }], // v0.1 true-mode reality (06 §1's ~8–10× gap)
      straight_share: 0.3,
      road_ink: 0.4,
      frame_aspect: 1.0
    });
    expect(result.verdict).toBe("fail");
    const finding = result.findings.find((f) => f.metric === "width_ratio")!;
    expect(finding).toBeDefined();
    expect(finding.corner_id).toBe("c1");
    expect(finding.severity).toBe("fail");
  });

  it("straight_share just over the bound warns rather than fails", () => {
    const result = gateProportions({
      width_ratio: [{ corner_id: "c1", value: 0.6 }],
      straight_share: 0.47, // 0.45 * 1.15 ≈ 0.5175 — inside the warn margin
      road_ink: 0.4,
      frame_aspect: 1.0
    });
    expect(result.verdict).toBe("warn");
    expect(result.findings.some((f) => f.metric === "straight_share" && f.severity === "warn")).toBe(true);
  });

  it("computeProportionMetrics reads a real DrawnScene into a real (and, in true mode, expectedly poor) width_ratio", () => {
    const line = mkLine({ id: "l1", role: "ideal", samples: straightSamples(0, 190) });
    const scene = unwrap(project(CORNER_ROAD, [line], { window: "all" }));
    const corner = CORNER_ROAD.corners[0]!;
    const metrics = computeProportionMetrics(scene, [{ id: corner.id, r: corner.r }], 90);
    expect(metrics.width_ratio).toEqual([{ corner_id: corner.id, value: (2 * scene.road.lane_width_m) / corner.r }]);
    expect(metrics.frame_aspect).toBeGreaterThan(0);
    expect(metrics.road_ink).toBeGreaterThan(0);
    // v0.1 true mode never applies width_exag — this IS 06 §1's documented ~8–10× gap.
    const gate = gateProportions(metrics);
    expect(gate.findings.some((f) => f.metric === "width_ratio" && f.severity === "fail")).toBe(true);
  });

  it("frame_aspect and road_ink out of band are named findings", () => {
    const result = gateProportions({
      width_ratio: [],
      straight_share: 0.1,
      road_ink: 0.9,
      frame_aspect: 5.0
    });
    expect(result.verdict).toBe("fail");
    expect(result.findings.map((f) => f.metric).sort()).toEqual(["frame_aspect", "road_ink"]);
  });
});

// ---------------------------------------------------------------------------
// SVG well-formedness (regex-based tag balance) + never-throw

describe("SVG well-formedness", () => {
  it("a full scene (lines, markers, occluders, sight rays, legend, labels) renders well-formed SVG", () => {
    const occ: ResolvedOccluder = { id: "o1", kind: "vehicle", lane: "oncoming", at: { at_s: 45 } };
    const samples = straightSamples(0, 80, 5).map((s) => ({ ...s, limit_x: s.x + 25, limit_y: s.y }));
    const good = mkLine({
      id: "ideal",
      role: "ideal",
      quality: "good",
      samples,
      events: [
        { kind: "turn_in", s: 20, t: 1, corner_id: "c1" },
        { kind: "apex", s: 40, t: 2, corner_id: "c1" },
        { kind: "exit", s: 60, t: 3, corner_id: "c1" },
        { kind: "release", s: 65, t: 3.2, corner_id: "c1" }
      ],
      occluders: [occ]
    });
    const mistake = mkLine({
      id: "mistake1",
      role: "mistake",
      quality: "failing",
      outcome: "runoff",
      samples,
      terminated: { reason: "off_road", s: 55, t: 3, x: 55, y: 3.6 },
      occluders: [occ]
    });
    const scene = unwrap(project(CORNER_ROAD, [good, mistake], { window: "all", legend: "on" }));
    const markers = deriveMarkers([good, mistake], "auto");
    const labels = unwrap(resolveLabels([good], [{ feature: "apex", line: "ideal", corner: "c1" }]));
    const full = withLabels(withMarkers(scene, markers), labels);
    const svg = renderTopdown(full);
    assertWellFormedSvg(svg);
    expect(svg).toContain("<defs>");
    expect(svg).toContain('data-marker-class="apex"');
    expect(svg).toContain('data-occluder-kind="vehicle"');
    expect(svg).toContain('data-terminal-reason="off_road"');
  });

  it("fallbackSvg is itself well-formed", async () => {
    const { fallbackSvg } = await import("../../src/render/fallback.js");
    assertWellFormedSvg(fallbackSvg("boom"));
  });

  it("renderTopdown never throws — a malformed scene degrades to fallbackSvg", () => {
    const svg = renderTopdown(null as never);
    assertWellFormedSvg(svg);
    expect(svg).toContain("render failed");
  });

  it("renderViews end-to-end produces a well-formed SVG", () => {
    const line = mkLine({ id: "l1", role: "ideal", samples: straightSamples(0, 40, 5) });
    const result = unwrap(renderViews({ road: STRAIGHT_ROAD, lines: [line] }));
    assertWellFormedSvg(result.svg);
  });
});

// ---------------------------------------------------------------------------
// markers/labels ride the drawn-space transform (fig-08-06 regression: the
// orient=90 scene drew its markers at UNROTATED world positions — "scattered
// in the grass", every judge attempt) and the window crop (a glyph whose
// station is cropped out draws nothing — it has no drawn geometry to sit on).

describe("markers/labels are mapped through the scene's window + orient transform (renderViews)", () => {
  const samples = straightSamples(0, 190);
  const events: Event[] = [{ kind: "turn_in", s: 20, t: 1, corner_id: "c1" }];
  const labels: FigureLabel[] = [{ feature: "turn_point", line: "l1", text: "here" }];

  it("orient=90: the marker glyph and label anchor land ON the rotated line, not at the pre-rotation world position", () => {
    const line = mkLine({ id: "l1", role: "ideal", samples, events });
    const r = unwrap(renderViews({ road: STRAIGHT_ROAD, lines: [line], viewSpec: { window: "all", orient: 90 }, labels, marks: "auto" }));
    expect(r.scene.orient).toBe(90);
    // the polyline vertex for the s=20 sample (index 2 at 10 m spacing)
    const vertex = r.scene.lines[0]!.polyline[2]!;
    const marker = r.scene.markers.find((m) => m.cls === "turn_point")!;
    expect(marker).toBeDefined();
    expect(marker.at.x).toBeCloseTo(vertex.x, 9);
    expect(marker.at.y).toBeCloseTo(vertex.y, 9);
    // rotation actually happened: the drawn position differs from world (20, 0)
    expect(Math.hypot(marker.at.x - 20, marker.at.y - 0)).toBeGreaterThan(1);
    const label = r.scene.labels[0]!;
    expect(label.anchor.x).toBeCloseTo(vertex.x, 9);
    expect(label.anchor.y).toBeCloseTo(vertex.y, 9);
  });

  it("orient=0 stays the identity on marker/label anchors (P6 unchanged)", () => {
    const line = mkLine({ id: "l1", role: "ideal", samples, events });
    const r = unwrap(renderViews({ road: STRAIGHT_ROAD, lines: [line], viewSpec: { window: "all" }, labels, marks: "auto" }));
    expect(r.scene.markers[0]!.at).toEqual({ x: 20, y: 0 });
    expect(r.scene.labels[0]!.anchor).toEqual({ x: 20, y: 0 });
  });

  it("a marker/label whose station falls outside the drawn window is dropped, not drawn floating", () => {
    const line = mkLine({ id: "l1", role: "ideal", samples, events });
    const view = { window: { from: { at_s: 50 }, to: { at_s: 100 } } };
    const r = unwrap(renderViews({ road: STRAIGHT_ROAD, lines: [line], viewSpec: view, labels, marks: "auto" }));
    expect(r.scene.markers).toEqual([]);
    expect(r.scene.labels).toEqual([]);
    // an in-window event still draws
    const line2 = mkLine({ id: "l1", role: "ideal", samples, events: [{ kind: "turn_in", s: 60, t: 3, corner_id: "c1" }] });
    const r2 = unwrap(renderViews({ road: STRAIGHT_ROAD, lines: [line2], viewSpec: view, labels, marks: "auto" }));
    expect(r2.scene.markers.map((m) => m.cls)).toEqual(["turn_point"]);
    expect(r2.scene.labels).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Marker GLYPH geometry (design/06 §3.1 stage 9's vocabulary table).
//
// These assert the SHAPE the renderer emits, not a byte snapshot: the defect
// they lock out shipped in all six v0.1 bakes and was invisible to every
// existing test, because "one polygon per turn_in event" was satisfied — the
// polygons just weren't an hourglass. `turn_point` was emitted as
// [top,left,bot] + [top,right,bot]: two triangles sharing the WHOLE top→bot
// edge, i.e. a solid rhombus, WIDEST exactly where an hourglass is narrowest.
// Three independent D36 judges zoomed to native pixels and reported the same
// thing — "solid filled diamond/rhombus, no waist/pinch".

interface Poly {
  readonly pts: readonly { readonly x: number; readonly y: number }[];
}

/** Every `<polygon>` carrying `data-marker-class="<cls>"`, parsed back to vertices. */
function markerPolygons(svg: string, cls: string): Poly[] {
  const out: Poly[] = [];
  const re = /<polygon points="([^"]+)"[^>]*?data-marker-class="([a-z_]+)"[^>]*?\/>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(svg)) !== null) {
    if (m[2] !== cls) continue;
    const pts = m[1]!.split(" ").map((pair) => {
      const [x, y] = pair.split(",").map(Number);
      return { x: x!, y: y! };
    });
    out.push({ pts });
  }
  return out;
}

/**
 * Horizontal span of the UNION of `polys` at height `y` (scanline). Works
 * whatever the glyph's polygon decomposition is — which is the point: the old
 * two-triangle rhombus and a one-hexagon hourglass are both measured here on
 * equal terms, and only the hourglass pinches.
 */
function unionWidthAt(polys: readonly Poly[], y: number): number {
  const xs: number[] = [];
  for (const poly of polys) {
    const p = poly.pts;
    for (let i = 0; i < p.length; i++) {
      const a = p[i]!;
      const b = p[(i + 1) % p.length]!;
      if (a.y === b.y) continue;
      const lo = Math.min(a.y, b.y);
      const hi = Math.max(a.y, b.y);
      if (y < lo || y > hi) continue;
      xs.push(a.x + ((b.x - a.x) * (y - a.y)) / (b.y - a.y));
    }
  }
  if (xs.length === 0) return 0;
  return Math.max(...xs) - Math.min(...xs);
}

describe("turn_point is an HOURGLASS, not a rhombus (design/06 §3.1 stage 9)", () => {
  function renderOneTurnPoint(): string {
    const line = mkLine({
      id: "l1",
      role: "ideal",
      samples: straightSamples(0, 40, 5),
      events: [{ kind: "turn_in", s: 20, t: 1, corner_id: "c1" }]
    });
    const scene = unwrap(project(STRAIGHT_ROAD, [line], { window: "all" }));
    return renderTopdown(withMarkers(scene, deriveMarkers([line], ["turn_point"])));
  }

  it("the glyph pinches: its width at mid-height is a small fraction of its width at the ends", () => {
    const polys = markerPolygons(renderOneTurnPoint(), "turn_point");
    expect(polys.length).toBeGreaterThan(0);
    const ys = polys.flatMap((p) => p.pts.map((q) => q.y));
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const cy = (minY + maxY) / 2;
    const r = (maxY - minY) / 2;
    expect(r).toBeGreaterThan(0);

    const waist = unionWidthAt(polys, cy);
    const nearTop = unionWidthAt(polys, cy - 0.95 * r);
    const nearBot = unionWidthAt(polys, cy + 0.95 * r);

    // an hourglass: connected through the waist, but the waist is the NARROWEST
    // horizontal section — under a third of the end bars. A rhombus scores the
    // exact inverse (waist = 2r, ends → 0), so this fails hard on the defect.
    expect(waist).toBeGreaterThan(0);
    expect(nearTop).toBeGreaterThan(0);
    expect(nearBot).toBeGreaterThan(0);
    expect(waist).toBeLessThan(nearTop / 3);
    expect(waist).toBeLessThan(nearBot / 3);
  });

  it("width is monotonically non-increasing from each end toward the waist (no mid-glyph bulge)", () => {
    const polys = markerPolygons(renderOneTurnPoint(), "turn_point");
    const ys = polys.flatMap((p) => p.pts.map((q) => q.y));
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const cy = (minY + maxY) / 2;
    const r = (maxY - minY) / 2;
    for (const sign of [-1, 1]) {
      let prev = Infinity;
      for (const frac of [0.95, 0.75, 0.5, 0.25, 0.0]) {
        const w = unionWidthAt(polys, cy + sign * frac * r);
        expect(w).toBeLessThanOrEqual(prev + 1e-9);
        prev = w;
      }
    }
  });

  it("hourglassPoints itself: 6 vertices, two per row, waist row strictly narrower than the end rows", async () => {
    const { hourglassPoints } = await import("../../src/render/topdown.js");
    const pts = hourglassPoints(0, 0, 10);
    expect(pts).toHaveLength(6);
    const rowAt = (y: number) => pts.filter((p) => Math.abs(p.y - y) < 1e-9);
    expect(rowAt(-10)).toHaveLength(2);
    expect(rowAt(0)).toHaveLength(2);
    expect(rowAt(10)).toHaveLength(2);
    const span = (row: readonly { readonly x: number }[]) => Math.max(...row.map((p) => p.x)) - Math.min(...row.map((p) => p.x));
    expect(span(rowAt(0))).toBeGreaterThan(0);
    expect(span(rowAt(0))).toBeLessThan(span(rowAt(-10)));
    expect(span(rowAt(0))).toBeLessThan(span(rowAt(10)));
  });

  it("apex ring and exit dot stay distinct reads: the ring is stroke-only and strictly larger than the filled dot", () => {
    const line = mkLine({
      id: "l1",
      role: "ideal",
      samples: straightSamples(0, 40, 5),
      events: [
        { kind: "apex", s: 10, t: 1, corner_id: "c1" },
        { kind: "exit", s: 30, t: 2, corner_id: "c1" }
      ]
    });
    const scene = unwrap(project(STRAIGHT_ROAD, [line], { window: "all" }));
    const svg = renderTopdown(withMarkers(scene, deriveMarkers([line], "auto")));
    const circleOf = (cls: string) => {
      const re = new RegExp(`<circle[^>]*?data-marker-class="${cls}"[^>]*?/>`);
      return svg.match(re)?.[0] ?? "";
    };
    const ring = circleOf("apex");
    const dot = circleOf("exit");
    expect(ring).not.toBe("");
    expect(dot).not.toBe("");
    expect(ring).toContain('fill="none"'); // a ring has a hole
    expect(dot).toContain('stroke="none"'); // a dot is solid
    const rOf = (tag: string) => Number(/ r="([-0-9.eE]+)"/.exec(tag)![1]);
    expect(rOf(dot)).toBeLessThan(rOf(ring));
  });
});

// ---------------------------------------------------------------------------
// marks: `auto` is role-scoped (design/04 §7: "`auto` (default) draws all
// classes on `ideal`-role lines only"). fig 8.4 and 8.6 author no `marks:` at
// all, so this is what those two figures actually get — and reading `auto`
// as a synonym for `all` is what put a red `apex` ring on fig-08-04's
// `overspeed` line at its first metre, one of the J2 findings.

describe("MarkSpec `auto` is ideal-only (design/04 §7)", () => {
  const samples = straightSamples(0, 100, 5);
  // stations are deliberately > MARK_COINCIDE_EPS_M apart per line, so the
  // coincident-collapse rule cannot mask a role that failed to be enabled
  const ev = (s0: number): Event[] => [
    { kind: "turn_in", s: s0, t: 1, corner_id: "c1" },
    { kind: "apex", s: s0 + 10, t: 2, corner_id: "c1" }
  ];
  const roster = (): LineResult[] => [
    mkLine({ id: "good", role: "ideal", samples, events: ev(10) }),
    mkLine({ id: "bad", role: "mistake", quality: "failing", outcome: "runoff", samples, events: ev(30) }),
    mkLine({ id: "alt", role: "alternative", quality: "caution", samples, events: ev(50) }),
    mkLine({ id: "ref", role: "reference", samples, events: ev(70) })
  ];

  it("`auto` marks the ideal line and nothing else", () => {
    const markers = deriveMarkers(roster(), "auto");
    expect(new Set(markers.map((m) => m.line_id))).toEqual(new Set(["good"]));
    expect(markers.map((m) => m.cls).sort()).toEqual(["apex", "turn_point"]);
  });

  it("undefined (no `marks:` authored at all) behaves exactly as `auto`", () => {
    expect(deriveMarkers(roster(), undefined)).toEqual(deriveMarkers(roster(), "auto"));
  });

  it("`all` and an explicit class list mark EVERY role — that is how figs 8.1–8.3 get their red hourglasses", () => {
    expect(new Set(deriveMarkers(roster(), "all").map((m) => m.line_id))).toEqual(new Set(["good", "bad", "alt", "ref"]));
    const listed = deriveMarkers(roster(), ["turn_point"]);
    expect(new Set(listed.map((m) => m.line_id))).toEqual(new Set(["good", "bad", "alt", "ref"]));
    expect(new Set(listed.map((m) => m.cls))).toEqual(new Set(["turn_point"]));
  });

  it("`none` marks nothing, whatever the role", () => {
    expect(deriveMarkers(roster(), "none")).toEqual([]);
  });

  // -------------------------------------------------------------------------
  // The MarkSpec is scoped at TWO levels — design/03 §8: "at figure and
  // per-line scope"; design/04 §7: "at figure level, overridable per line with
  // `marks=`". The third argument carries the per-line overrides, keyed by
  // line_id; the figure-level spec is the fallback for every line that
  // authored none.

  describe("per-line MarkSpec overrides the figure-level spec (design/03 §8, design/04 §7)", () => {
    it("an override SUBTRACTS: `none` on one line survives a figure-level `all`", () => {
      const markers = deriveMarkers(roster(), "all", new Map([["bad", "none"]]));
      expect(new Set(markers.map((m) => m.line_id))).toEqual(new Set(["good", "alt", "ref"]));
    });

    it("an override ADDS: `all` on a mistake line survives a figure-level `auto`, which alone marks the ideal line only", () => {
      const markers = deriveMarkers(roster(), "auto", new Map([["bad", "all"]]));
      expect(new Set(markers.map((m) => m.line_id))).toEqual(new Set(["good", "bad"]));
    });

    it("an override NARROWS: a class list on one line coexists with the figure's wider list", () => {
      const markers = deriveMarkers(roster(), "all", new Map([["alt", ["turn_point"]]]));
      expect(new Set(markers.filter((m) => m.line_id === "alt").map((m) => m.cls))).toEqual(new Set(["turn_point"]));
      expect(new Set(markers.filter((m) => m.line_id === "good").map((m) => m.cls))).toEqual(new Set(["turn_point", "apex"]));
    });

    it("a per-line `auto` is role-scoped like the figure-level one — on a mistake line it marks nothing", () => {
      const markers = deriveMarkers(roster(), "all", new Map([["bad", "auto"]]));
      expect(new Set(markers.map((m) => m.line_id))).toEqual(new Set(["good", "alt", "ref"]));
    });

    it("lines absent from the override map fall back to the figure-level spec — an empty map changes nothing", () => {
      expect(deriveMarkers(roster(), "all", new Map())).toEqual(deriveMarkers(roster(), "all"));
      expect(deriveMarkers(roster(), "auto", new Map([["nosuchline", "all"]]))).toEqual(deriveMarkers(roster(), "auto"));
    });
  });
});

// ---------------------------------------------------------------------------
// design/06 §3.1 stage 8's `off_road` terminal: "arrowhead on the edge
// crossing + a short tick ALONG THE ROAD EDGE at the crossing". The tick used
// to be drawn transverse to the rider's heading — across the road, not along
// its edge — which reads as the `stopped` bar and, at 1 px by 8 px, read as
// nothing at all (J5: fig-08-04's runoff "terminates with a plain arrowhead").

describe("off_road terminal tick runs along the road edge (design/06 §3.1 stage 8)", () => {
  const S_TERM = 50; // inside CORNER_ROAD's arc, so the edge is genuinely curved here
  const W = CORNER_ROAD.lane_width_m;

  function offRoadLine(): LineResult {
    const samples = [45, 47, 49, S_TERM].map((s) => {
      const p = CORNER_ROAD.worldAt(s, -W);
      return mkSample({ s, t: s / 20, x: p.x, y: p.y, psi: 10, d: -W });
    });
    return mkLine({
      id: "bad",
      role: "mistake",
      quality: "failing",
      outcome: "runoff",
      samples,
      road: CORNER_ROAD,
      terminated: { reason: "off_road", s: S_TERM, t: 2.5, x: samples[3]!.x, y: samples[3]!.y }
    });
  }

  /** the road edge's own tangent at the crossing, computed independently of project() */
  function trueEdgeDeg(): number {
    const a = CORNER_ROAD.worldAt(S_TERM - 0.5, -W);
    const b = CORNER_ROAD.worldAt(S_TERM + 0.5, -W);
    return (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
  }

  it("project() reports the crossed edge's tangent, not the rider's heading", () => {
    const scene = unwrap(project(CORNER_ROAD, [offRoadLine()], { window: "all" }));
    const term = scene.lines[0]!.terminal;
    expect(term.glyph).toBe("arrow_tick");
    expect(term.edge_heading_deg).not.toBeNull();
    expect(term.edge_heading_deg!).toBeCloseTo(trueEdgeDeg(), 6);
    // the fixture's rider heading is deliberately different, so a fallback to
    // `heading_deg` (or the old transverse construction) cannot pass by luck
    expect(Math.abs(term.edge_heading_deg! - term.heading_deg)).toBeGreaterThan(5);
  });

  it("the emitted tick is PARALLEL to that edge, not transverse to it", () => {
    const line = offRoadLine();
    const scene = unwrap(project(CORNER_ROAD, [line], { window: "all" }));
    const svg = renderTopdown(scene);
    const tag = /<line[^>]*?data-terminal-reason="off_road"[^>]*?\/>/.exec(svg)![0];
    const num = (name: string) => Number(new RegExp(` ${name}="([-0-9.eE]+)"`).exec(tag)![1]);
    const drawnDeg = (Math.atan2(num("y2") - num("y1"), num("x2") - num("x1")) * 180) / Math.PI;
    const delta = Math.abs(((drawnDeg - trueEdgeDeg() + 540) % 360) - 180); // 0 ⇒ parallel, 90 ⇒ the old transverse tick
    expect(delta).toBeLessThan(1e-6);
    // and it is genuinely visible: longer than it is wide, by a wide margin
    const len = Math.hypot(num("x2") - num("x1"), num("y2") - num("y1"));
    expect(len).toBeGreaterThan(num("stroke-width") * 4);
  });

  it("the tick rotates with the scene: orient=90 advances the edge heading by exactly 90°", () => {
    const line = offRoadLine();
    const flat = unwrap(project(CORNER_ROAD, [line], { window: "all" }));
    const turned = unwrap(project(CORNER_ROAD, [line], { window: "all", orient: 90 }));
    expect(turned.lines[0]!.terminal.edge_heading_deg!).toBeCloseTo(flat.lines[0]!.terminal.edge_heading_deg! + 90, 9);
    expect(turned.lines[0]!.terminal.heading_deg).toBeCloseTo(flat.lines[0]!.terminal.heading_deg + 90, 9);
  });

  it("no other termination reason grows an edge tick — road_end stays a plain arrowhead", () => {
    const line = mkLine({ id: "l1", role: "ideal", samples: straightSamples(0, 40, 5) });
    const scene = unwrap(project(STRAIGHT_ROAD, [line], { window: "all" }));
    expect(scene.lines[0]!.terminal.glyph).toBe("arrow");
    expect(scene.lines[0]!.terminal.edge_heading_deg).toBeNull();
    expect(renderTopdown(scene)).not.toContain("data-terminal-reason");
  });
});
