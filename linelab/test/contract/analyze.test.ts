// test/contract/analyze.test.ts — WP-07 gates (ARCHITECTURE §8 row WP-07):
//   · THE apex hysteresis detector (single apex, double-apex two-touch,
//     prominence rejection, min-separation merge) — design/05 §6.3
//   · danger_dwell_s's bracketed-crossing rule — design/01 Appendix A
//   · sight_ride_m vs sight_m divergence on a curved path (the D16 case)
//   · hazard_visible flip when an occluding vehicle is passed — design/03 §5.3, D27
//   · phase openers on a canonical corner record — design/05 §4.1, D41
//
// Error assertions ride code + detail.reason, never message text (ARCHITECTURE §4).

import { describe, it, expect } from "vitest";
import { compose } from "../../src/road/compose.js";
import { analyzeCorners, openerPhaseFor, phaseAt, phaseOpeners } from "../../src/core/analyze.js";
import { analyzeSight, sightTrendAt } from "../../src/sight/analyze.js";
import { phiReserve, muUse } from "../../src/core/slice.js";
import { degToRad, radToDeg } from "../../src/core/units.js";
import { RIDER_PROFILES } from "../../src/core/constants.js";
import type { Corner, Event, Hand, ResolvedOccluder, RoadModel, Sample, Trajectory } from "../../src/core/types.js";
import type { ComposedRoad } from "../../src/road/types.js";

// ---------------------------------------------------------------------------
// Fixture scaffolding

function road(dsl: string): ComposedRoad {
  const r = compose({ dsl });
  if (!r.ok) throw new Error(`test road failed to compose: ${r.error.message}`);
  return r.value;
}

const V_DEFAULT = 15;

function mkSample(s: number, t: number, over: Partial<Sample> = {}): Sample {
  return {
    s,
    t,
    x: s,
    y: 0,
    psi: 0,
    v: V_DEFAULT,
    phi: 20,
    kappa: 0,
    a_long: 0,
    a_lat: 0,
    grip: 0.5,
    mu: 1,
    d: 0,
    f: 0.5,
    cmd_lean: 0,
    cmd_a: 0,
    roll_rate: 50,
    action_id: null,
    clipped: false,
    n_long: 0,
    n_lat: 0,
    sight_m: 200,
    ssd_m: 20,
    limit_x: 0,
    limit_y: 0,
    sight_ride_m: 200,
    steer_state: "track",
    lat_action_id: null,
    su_sustained: 0,
    su_transient: 0,
    a_cmd_rate: 0,
    below_validity: false,
    ...over
  };
}

function traj(samples: readonly Sample[], events: readonly Event[] = []): Trajectory {
  const last = samples[samples.length - 1]!;
  return {
    samples,
    events,
    terminated: { reason: "road_end", s: last.s, t: last.t, x: last.x, y: last.y }
  };
}

// A minimal RoadModel stub for the phase-opener tests, which need only `.corners`.
function stubRoad(corners: readonly Corner[]): RoadModel {
  return {
    lane_width_m: 3.5,
    bike_margin_m: 0.4,
    use_full_width: false,
    total_len_m: 1000,
    corners,
    psi_road: () => 0,
    kappa_road: () => 0,
    dOf: () => 0,
    fOf: () => 0,
    muAt: () => 1,
    project: (x, y) => ({ s: x, d: y })
  };
}

function mkCorner(id: string, over: Partial<Corner> & { hand?: Hand } = {}): Corner {
  return {
    id,
    hand: "R",
    s0: 0,
    s1: 50,
    s_mid: 25,
    r: 30,
    angle_deg: 90,
    type: "constant",
    r_min: 30,
    r_max: 30,
    linked_next: false,
    ...over
  };
}

// ===========================================================================
// THE apex hysteresis detector (design/05 §6.3)

describe("analyzeCorners — apex hysteresis detector", () => {
  // R 30 ^90 with a 5 m approach/exit — corner.s0 ≈ 5, corner.s1 ≈ 5 + 30·(π/2).
  const R30 = road("lane 3.5 | S 5 | R 30 ^90 | S 5");
  const corner = R30.corners[0]!;

  function span(points: ReadonlyArray<readonly [number, number]>): Sample[] {
    return points.map(([s, f]) => mkSample(s, s / 10, { f, psi: 0 }));
  }

  it("a single, unambiguous minimum yields exactly one apex", () => {
    const samples = span([
      [corner.s0, 1.0],
      [corner.s0 + 10, 0.6],
      [corner.s0 + 20, 0.15],
      [corner.s0 + 30, 0.5],
      [corner.s0 + 40, 0.9],
      [corner.s1, 1.0]
    ]);
    const { corners } = analyzeCorners(traj(samples), R30, 0.85);
    expect(corners).toHaveLength(1);
    expect(corners[0]!.apexes.map((a) => a.s)).toEqual([corner.s0 + 20]);
    // the recorded apex point carries finite, sane derived numbers
    const apex = corners[0]!.apexes[0]!;
    expect(apex.f).toBeCloseTo(0.15, 9);
    expect(Number.isFinite(apex.pct)).toBe(true);
    expect(apex.clearance_m).toBeGreaterThanOrEqual(0);
  });

  it("a genuine double-apex shape (dip → rise → dip → rise) yields two well-separated apexes, in station order", () => {
    const samples = span([
      [corner.s0, 1.0],
      [corner.s0 + 10, 0.15], // touch 1
      [corner.s0 + 20, 0.6], // confirming rise (0.45 ≥ prominence)
      [corner.s0 + 25, 0.65], // peak keeps climbing — must NOT double-count
      [corner.s0 + 33, 0.15], // confirmed drop (0.5 ≥ prominence) re-arms — touch 2
      [corner.s0 + 43, 0.7], // confirming rise
      [corner.s1, 0.9]
    ]);
    const { corners, events } = analyzeCorners(traj(samples), R30, 0.85);
    const stations = corners[0]!.apexes.map((a) => a.s);
    expect(stations).toEqual([corner.s0 + 10, corner.s0 + 33]);
    expect(corners[0]!.apexes.map((a) => a.f)).toEqual([0.15, 0.15]);
    // the SAME pass emits one `apex` event per touch, 1-based detail.index (05 §5)
    const apexEvents = events.filter((e) => e.kind === "apex");
    expect(apexEvents).toHaveLength(2);
    expect(apexEvents.map((e) => e.detail?.["index"])).toEqual([1, 2]);
    expect(apexEvents.every((e) => e.corner_id === corner.id)).toBe(true);
  });

  it("a shallow wobble that never rises ≥ APEX_PROMINENCE_F (0.08) is rejected — only the deeper, confirmed minimum survives", () => {
    const samples = span([
      [corner.s0, 1.0],
      [corner.s0 + 10, 0.5], // shallow candidate
      [corner.s0 + 15, 0.55], // rise of only 0.05 — below prominence, no accept
      [corner.s0 + 25, 0.15], // a NEW lower minimum supersedes the pending one
      [corner.s0 + 35, 0.6], // confirming rise off the deeper minimum
      [corner.s1, 0.9]
    ]);
    const { corners } = analyzeCorners(traj(samples), R30, 0.85);
    expect(corners[0]!.apexes.map((a) => a.s)).toEqual([corner.s0 + 25]);
  });

  it("two hysteresis-confirmed touches closer than APEX_MIN_SEP_M (5.0 m) merge, keeping the deeper one", () => {
    const samples = span([
      [corner.s0, 1.0],
      [corner.s0 + 10, 0.2], // touch A
      [corner.s0 + 13, 0.35], // confirms A (rise 0.15)
      [corner.s0 + 14.5, 0.15], // touch B — only 4.5 m from A's station
      [corner.s0 + 25, 0.6], // confirms B
      [corner.s1, 0.9]
    ]);
    const { corners } = analyzeCorners(traj(samples), R30, 0.85);
    // A at s0+10 and B at s0+14.5 are 4.5 m apart (< 5.0 m) — merge to the deeper (B)
    expect(corners[0]!.apexes).toHaveLength(1);
    expect(corners[0]!.apexes[0]!.s).toBeCloseTo(corner.s0 + 14.5, 9);
    expect(corners[0]!.apexes[0]!.f).toBeCloseTo(0.15, 9);
  });

  it("a corner the line never reaches (early termination before corner.s0) contributes no row", () => {
    // Samples stop at s=1, well short of this road's corner.s0 (≈5) — the
    // corner exists in road.corners but spanSamples is empty for it.
    const samples = span([[0, 1.0], [1, 1.0]]);
    expect(samples[samples.length - 1]!.s).toBeLessThan(corner.s0);
    const { corners, events } = analyzeCorners(traj(samples), R30, 0.85);
    expect(corners).toHaveLength(0);
    expect(events).toHaveLength(0);
  });
});

// ===========================================================================
// danger_dwell_s — the bracketed-crossing rule (design/01 Appendix A)

describe("analyzeCorners — danger_dwell_s bracketing", () => {
  const R30 = road("lane 3.5 | S 5 | R 30 ^90 | S 5");
  const corner = R30.corners[0]!;
  const skill = RIDER_PROFILES.street.skill; // 0.85

  it("sums only the interpolated in-window, above-reserve time — excursions straddling the window boundary contribute nothing", () => {
    const thresholdDeg = radToDeg(phiReserve(muUse(skill, 1.0)));
    const s0 = corner.s0;
    const s1 = corner.s1;
    const b = s0 + 15;
    const c = s0 + 30;

    // psi held far from psi_exit everywhere, so no `exit` event ever fires and
    // W_c falls back cleanly to [corner.s0, corner.s1] (no turn_in event either).
    const samples: Sample[] = [
      mkSample(s0 - 3, (s0 - 3) / 10, { phi: 80, psi: 0 }), // pre-corner excursion — must NOT count
      mkSample(s0, s0 / 10, { phi: 20, psi: 0 }),
      mkSample(b, b / 10, { phi: 60, psi: 0 }),
      mkSample(c, c / 10, { phi: 60, psi: 0 }),
      mkSample(s1, s1 / 10, { phi: 20, psi: 0 }),
      mkSample(s1 + 3, (s1 + 3) / 10, { phi: 80, psi: 0 }) // post-corner excursion — must NOT count
    ];

    const aboveAB = (1 - (thresholdDeg - 20) / (60 - 20)) * (b / 10 - s0 / 10);
    const fullBC = c / 10 - b / 10;
    const aboveCD = ((60 - thresholdDeg) / (60 - 20)) * (s1 / 10 - c / 10);
    const expected = aboveAB + fullBC + aboveCD;

    const { corners } = analyzeCorners(traj(samples), R30, skill);
    expect(corners[0]!.danger_dwell_s).toBeCloseTo(expected, 9);
    expect(corners[0]!.danger_dwell_s).toBeGreaterThan(0);
    expect(corners[0]!.danger_dwell_s).toBeLessThan((s1 - s0) / 10); // never exceeds the window's own duration
  });

  it("a line that never exceeds the reserve records a zero dwell", () => {
    const s0 = corner.s0;
    const s1 = corner.s1;
    const samples: Sample[] = [
      mkSample(s0, s0 / 10, { phi: 10, psi: 0 }),
      mkSample(s0 + 20, (s0 + 20) / 10, { phi: 15, psi: 0 }),
      mkSample(s1, s1 / 10, { phi: 5, psi: 0 })
    ];
    const { corners } = analyzeCorners(traj(samples), R30, skill);
    expect(corners[0]!.danger_dwell_s).toBe(0);
  });
});

// ===========================================================================
// sight_ride_m vs sight_m divergence on a curved path (D16)

describe("analyzeSight — sight_ride_m rider-path rebase (D16)", () => {
  const R30 = road("lane 3.5 | S 5 | R 30 ^90 | S 5");
  const corner = R30.corners[0]!;
  const sweepRad = degToRad(corner.angle_deg);

  /** A constant-offset line's samples across exactly the corner span (0.5 m stations, exact endpoint). */
  function lineSamples(d: number): Sample[] {
    const out: Sample[] = [];
    for (let s = corner.s0; s < corner.s1 - 1e-9; s += 0.5) {
      const p = R30.worldAt(s, d);
      out.push(mkSample(s, s / 15, { x: p.x, y: p.y, d, sight_m: Math.max(0, corner.s1 - s) }));
    }
    const pEnd = R30.worldAt(corner.s1, d);
    out.push(mkSample(corner.s1, corner.s1 / 15, { x: pEnd.x, y: pEnd.y, d, sight_m: 0 }));
    return out;
  }

  it("a wide (outside) line rides visibly MORE metres than a tight (inside) line to reach the SAME forward centreline station", () => {
    const inside = analyzeSight(traj(lineSamples(-2.0)), R30, []);
    const outside = analyzeSight(traj(lineSamples(2.0)), R30, []);

    const insideFirst = inside.samples[0]!;
    const outsideFirst = outside.samples[0]!;

    // both target the SAME centreline station (corner.s1) — the geometric sight_m is identical...
    expect(insideFirst.sight_m).toBeCloseTo(outsideFirst.sight_m, 9);
    // ...but the RIDDEN path length to get there differs with the effective radius (R ± d):
    const expectedInside = (30 - 2.0) * sweepRad;
    const expectedOutside = (30 + 2.0) * sweepRad;
    expect(insideFirst.sight_ride_m).toBeCloseTo(expectedInside, 1);
    expect(outsideFirst.sight_ride_m).toBeCloseTo(expectedOutside, 1);

    // sight_ride_m diverges from the centreline-basis sight_m on BOTH lines...
    expect(Math.abs(insideFirst.sight_ride_m - insideFirst.sight_m)).toBeGreaterThan(1.0);
    expect(Math.abs(outsideFirst.sight_ride_m - outsideFirst.sight_m)).toBeGreaterThan(1.0);
    // ...and the two lines diverge from EACH OTHER by a large, D16-scale fraction.
    const relativeDivergence = (outsideFirst.sight_ride_m - insideFirst.sight_ride_m) / insideFirst.sight_ride_m;
    expect(relativeDivergence).toBeGreaterThan(0.1); // ~14% at R=30, d=±2.0 — the "~15%" D16 case
  });

  it("clamps at line end when the target station lies beyond the last retained sample", () => {
    const samples = lineSamples(0).map((s) => ({ ...s, sight_m: 1000 })); // way past line end
    const out = analyzeSight(traj(samples), R30, []);
    const last = out.samples[out.samples.length - 1]!;
    const total = out.samples.reduce((acc, s, i, arr) => (i === 0 ? 0 : acc + Math.hypot(s.x - arr[i - 1]!.x, s.y - arr[i - 1]!.y)), 0);
    expect(out.samples[0]!.sight_ride_m).toBeCloseTo(total, 6);
    expect(last.sight_ride_m).toBe(0); // already at line end
  });
});

// ===========================================================================
// hazard_visible flip when an occluding vehicle is passed (D27)

describe("analyzeSight — hazard_visible flip (D27)", () => {
  // A blind-ish right-hander with an inside hedge, and an on-road vehicle
  // parked in the rider's own lane just past the corner exit.
  const R = road("lane 3.5 | S 8 | R 12 ^100 | S 20");
  const corner = R.corners[0]!;

  const hedge: ResolvedOccluder = {
    id: "hedge1",
    kind: "hedge",
    side: "inside",
    at: { at_s: corner.s0 },
    span_m: corner.s1 - corner.s0,
    margin_m: 0.3,
    depth_m: 3.0
  };
  const vehicleAtS = corner.s1 + 8;
  const vehicle: ResolvedOccluder = {
    id: "car1",
    kind: "vehicle",
    lane: "own",
    at: { at_s: vehicleAtS }
  };
  const occluders = [hedge, vehicle];

  function lineSamples(d: number): Sample[] {
    const out: Sample[] = [];
    for (let s = corner.s0; s <= vehicleAtS + 6; s += 0.5) {
      const p = R.worldAt(s, d);
      out.push(mkSample(s, s / 15, { x: p.x, y: p.y, d, sight_m: 0 }));
    }
    return out;
  }

  function hazardStation(d: number): number | undefined {
    const out = analyzeSight(traj(lineSamples(d)), R, occluders);
    return out.events.find((e) => e.kind === "hazard_visible")?.s;
  }

  it("holding wide around the inside hedge sees the vehicle sooner (smaller s) than cutting in", () => {
    const cutIn = hazardStation(-1.3);
    const holdWide = hazardStation(1.0);
    expect(cutIn).toBeDefined();
    expect(holdWide).toBeDefined();
    expect(holdWide!).toBeLessThan(cutIn!);
  });

  it("emits detail.occluder_id/dist_m and never emits for the hedge itself (only on-road vehicles)", () => {
    const out = analyzeSight(traj(lineSamples(1.0)), R, occluders);
    const hazardEvents = out.events.filter((e) => e.kind === "hazard_visible");
    expect(hazardEvents).toHaveLength(1); // one on-road vehicle, one first-sighting bookmark
    const detail = hazardEvents[0]!.detail as { occluder_id: string; dist_m: number };
    expect(detail.occluder_id).toBe("car1");
    expect(detail.dist_m).toBeGreaterThan(0);
  });

  it("a verge (side-form) vehicle is scenery — it never emits hazard_visible", () => {
    const verge: ResolvedOccluder = { id: "car2", kind: "vehicle", side: "outside", at: { at_s: vehicleAtS } };
    const out = analyzeSight(traj(lineSamples(1.0)), R, [hedge, verge]);
    expect(out.events.some((e) => e.kind === "hazard_visible")).toBe(false);
  });
});

// ===========================================================================
// sightTrendAt (design/05 §4/§5.4) — built now for v0.2's stateAt to consume

describe("sightTrendAt", () => {
  function series(sightAt: (s: number) => number): Sample[] {
    const out: Sample[] = [];
    for (let s = 0; s <= 30; s += 1) out.push(mkSample(s, s / 10, { sight_m: sightAt(s) }));
    return out;
  }

  it("opening: sight_m rises well past the deadband over the trend window", () => {
    const samples = series((s) => s * 3); // +15 m over the 5 m window — well past +2 m
    expect(sightTrendAt(samples, 20)).toBe("opening");
  });

  it("closing: sight_m falls well past the deadband", () => {
    const samples = series((s) => 200 - s * 3);
    expect(sightTrendAt(samples, 20)).toBe("closing");
  });

  it("steady: change within the deadband reads steady, even with a clamp at the line start", () => {
    const flat = series(() => 50);
    expect(sightTrendAt(flat, 20)).toBe("steady");
    expect(sightTrendAt(flat, 0)).toBe("steady"); // clamped to the first sample
  });
});

// ===========================================================================
// Phase openers on a canonical corner record (design/05 §4.1, D41)

describe("phaseOpeners / openerPhaseFor / phaseAt", () => {
  it("openerPhaseFor implements the 05 §4.1 table exactly, including the exit/last-corner branch", () => {
    expect(openerPhaseFor({ kind: "turn_in", corner_id: "c1" }, null)).toBe("turning");
    expect(openerPhaseFor({ kind: "steering_complete", corner_id: "c1" }, null)).toBe("midcorner");
    expect(openerPhaseFor({ kind: "roll_on", corner_id: "c1" }, null)).toBe("exiting");
    expect(openerPhaseFor({ kind: "exit", corner_id: "c1" }, "c1")).toBe("done");
    expect(openerPhaseFor({ kind: "exit", corner_id: "c1" }, "c2")).toBe("approach"); // chain re-entry
    // non-openers: crack, release, and terminal bookmarks open no phase
    expect(openerPhaseFor({ kind: "crack", corner_id: "c1" }, null)).toBeNull();
    expect(openerPhaseFor({ kind: "release", corner_id: "c1" }, null)).toBeNull();
    expect(openerPhaseFor({ kind: "brake_start" }, null)).toBeNull();
  });

  it("a canonical single-corner run produces the full approach→turning→midcorner→exiting→done timeline", () => {
    const events: Event[] = [
      { kind: "turn_in", s: 10, t: 1.0, corner_id: "c1", action_id: "t1" },
      { kind: "steering_complete", s: 15, t: 1.6, corner_id: "c1", action_id: "t1" },
      { kind: "roll_on", s: 25, t: 2.6, corner_id: "c1", action_id: "r1" },
      { kind: "exit", s: 35, t: 3.6, corner_id: "c1" }
    ];
    const line = traj([mkSample(0, 0)], events);
    const r = stubRoad([mkCorner("c1")]);

    const openers = phaseOpeners(line, r);
    expect(openers).toEqual([
      { t: 0, phase: "approach" },
      { t: 1.0, phase: "turning" },
      { t: 1.6, phase: "midcorner" },
      { t: 2.6, phase: "exiting" },
      { t: 3.6, phase: "done" }
    ]);

    // half-open intervals: the opening instant belongs to the new phase
    expect(phaseAt(openers, 0)).toBe("approach");
    expect(phaseAt(openers, 0.999)).toBe("approach");
    expect(phaseAt(openers, 1.0)).toBe("turning");
    expect(phaseAt(openers, 2.0)).toBe("midcorner");
    expect(phaseAt(openers, 2.6)).toBe("exiting");
    expect(phaseAt(openers, 10)).toBe("done"); // holds at the latest opener
  });

  it("a skipped phase is legal: no turn_in means the line stays in approach throughout", () => {
    const events: Event[] = [{ kind: "brake_start", s: 2, t: 0.2 }];
    const line = traj([mkSample(0, 0)], events);
    const openers = phaseOpeners(line, stubRoad([mkCorner("c1")]));
    expect(openers).toEqual([{ t: 0, phase: "approach" }]);
    expect(phaseAt(openers, 100)).toBe("approach");
  });

  it("chain re-entry: exit(c1) (not the last corner) opens approach again, distinct corner_id from phase", () => {
    const events: Event[] = [
      { kind: "turn_in", s: 10, t: 1.0, corner_id: "c1", action_id: "t1" },
      { kind: "exit", s: 20, t: 2.0, corner_id: "c1" },
      { kind: "turn_in", s: 30, t: 3.0, corner_id: "c2", action_id: "t2" },
      { kind: "exit", s: 40, t: 4.0, corner_id: "c2" }
    ];
    const line = traj([mkSample(0, 0)], events);
    const openers = phaseOpeners(line, stubRoad([mkCorner("c1"), mkCorner("c2")]));
    expect(openers.map((o) => o.phase)).toEqual(["approach", "turning", "approach", "turning", "done"]);
  });
});
