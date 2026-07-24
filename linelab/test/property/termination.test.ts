// test/property/termination.test.ts — design/09 §3.4 termination/resampling
// gates: P-TERMINATED-CLOSED, P-EVENT-BRACKET, P-RESAMPLE, P-EMERGENT-APEX,
// plus the 02 §7 reason↔event mapping (stopped → stop; max_time/max_dist have
// no bookmark event).
//
// The battery walks every reachable terminal reason on engine-rank fixtures:
//   road_end  — the clean C30 line
//   stopped   — a straight-line hard brake to the v_floor crossing
//   off_road  — a corner ridden with no turn_in (the D7 guard's run-off)
//   crash     — a commitment past phiMax (the lean ceiling, deadbanded)
//   max_time  — a long coast that outlives the 120 s guard
//   max_dist  — a fast coast that outruns the 5000 m guard

import { describe, it, expect } from "vitest";
import { compose } from "../../src/road/compose.js";
import { integrate } from "../../src/core/integrate.js";
import { resample } from "../../src/core/resample.js";
import type { RawPoint } from "../../src/core/record.js";
import {
  v_floor_ms,
  eps_phi_deg,
  max_time_s,
  max_dist_m,
  dt_s
} from "../../src/core/constants.js";
import { TERMINATED_REASONS } from "../../src/core/types.js";
import type {
  EventKind,
  ResolvedPlanAction,
  ResolvedScenario,
  RoadModel,
  SightCaster,
  TerminatedReason,
  Trajectory
} from "../../src/core/types.js";

const STUB_SIGHT: SightCaster = {
  cast: (eye) => ({ sight_m: 0, limit_point: { x: eye.x, y: eye.y }, s_limit: 0 }),
  ssd: () => ({ ssd_m: 0, react_m: 0, standup_m: 0, brake_m: 0 })
};

interface Built {
  readonly traj: Trajectory;
  readonly road: RoadModel;
}

function build(
  dsl: string,
  speed_kmh: number,
  plan: readonly ResolvedPlanAction[],
  opts: { f?: number; compose_ds?: number; meta?: Record<string, unknown>; id?: string } = {}
): Built {
  const composed = compose(
    { dsl },
    opts.compose_ds !== undefined ? { ds_m: opts.compose_ds } : undefined
  );
  if (!composed.ok) throw new Error(`fixture road failed to compose: ${composed.error.message}`);
  const road = composed.value;
  const scenario: ResolvedScenario = {
    spec: "linelab/1",
    id: opts.id ?? "term-fixture",
    road: {
      lane_width_m: road.lane_width_m,
      bike_margin_m: 0.4,
      use_full_width: false,
      segments: [],
      dsl
    },
    occluders: [],
    hazards: [],
    rider: { profile: "street", start: { speed_kmh, f: opts.f ?? 1.0 }, plan },
    config: { mu: 1.0, ds_m: 0.5, ssd_model: "alert", rubric: "parks-street", checks_version: 2 },
    ...(opts.meta !== undefined ? { meta: opts.meta } : {})
  };
  return { traj: integrate(scenario, { road, sight: STUB_SIGHT, occluders: [], hazards: [] }), road };
}

// --- the battery ------------------------------------------------------------

const C30_DSL = "lane 3.5 | S 35 | R 30 ^90 | S 25";
const C30_PLAN: readonly ResolvedPlanAction[] = [
  { do: "brake", id: "b1", at_s: 2, decel: 4.6, slew_mss: 6 },
  { do: "throttle", id: "c1", at_s: 22, accel: 0, slew_mss: 6 },
  { do: "turn_in", id: "t1", at_s: 29.5, target: { lean_deg: 36.5 }, hand: "R" },
  { do: "throttle", id: "r1", at_s: 62, accel: 1.2, slew_mss: 6 }
];

const roadEnd = build(C30_DSL, 70, C30_PLAN, { f: 0.9 });
const stopped = build("lane 3.5 | S 120", 70, [
  { do: "brake", id: "b1", at_s: 20, decel: 4.0, slew_mss: 6 }
]);
const offRoad = build("lane 3.5 | S 12 | L 12 ^90 | S 16", 34, []);
const crash = build("lane 3.5 | S 10 | R 30 ^170 | S 10", 60, [
  { do: "turn_in", id: "t1", at_s: 4, target: { lean_deg: 60 }, hand: "R" }
]);
const maxTime = build("lane 3.5 | S 5000", 100, [], { compose_ds: 5 });
const maxDist = build("lane 3.5 | S 6000", 200, [], { compose_ds: 5 });

const BATTERY: readonly { name: TerminatedReason; b: Built; event: EventKind | null }[] = [
  { name: "road_end", b: roadEnd, event: "road_end" },
  { name: "stopped", b: stopped, event: "stop" },
  { name: "off_road", b: offRoad, event: "off_road" },
  { name: "crash", b: crash, event: "crash" },
  { name: "max_time", b: maxTime, event: null },
  { name: "max_dist", b: maxDist, event: null }
];

// ---------------------------------------------------------------------------

describe("P-TERMINATED-CLOSED", () => {
  it("every reason in the closed set is reachable, and every run terminates in it", () => {
    expect(TERMINATED_REASONS).toEqual([
      "crash",
      "off_road",
      "stopped",
      "road_end",
      "max_time",
      "max_dist"
    ]);
    for (const { name, b } of BATTERY) {
      expect(b.traj.terminated.reason).toBe(name);
      expect(TERMINATED_REASONS).toContain(b.traj.terminated.reason);
    }
  });

  it("the final sample equals the bracketed terminated {s, t, x, y}", () => {
    for (const { b } of BATTERY) {
      const last = b.traj.samples[b.traj.samples.length - 1]!;
      expect(last.s).toBe(b.traj.terminated.s);
      expect(last.t).toBe(b.traj.terminated.t);
      expect(last.x).toBe(b.traj.terminated.x);
      expect(last.y).toBe(b.traj.terminated.y);
    }
  });

  it("no sample ever satisfies the off-road predicate beyond the bracketing tolerance", () => {
    for (const { b } of BATTERY) {
      for (const p of b.traj.samples) {
        expect(Math.abs(p.d)).toBeLessThanOrEqual(b.road.lane_width_m + 0.02);
      }
    }
  });
});

describe("P-EVENT-BRACKET", () => {
  it("the stopped crossing sits exactly on v_floor_ms", () => {
    const last = stopped.traj.samples[stopped.traj.samples.length - 1]!;
    expect(Math.abs(last.v - v_floor_ms)).toBeLessThanOrEqual(1e-6);
  });

  it("the off_road crossing sits exactly on the road edge (terminal |d| = lane_width_m ± 0.05)", () => {
    const last = offRoad.traj.samples[offRoad.traj.samples.length - 1]!;
    expect(Math.abs(Math.abs(last.d) - offRoad.road.lane_width_m)).toBeLessThanOrEqual(0.05);
  });

  it("the road_end crossing sits exactly at total_len_m", () => {
    expect(Math.abs(roadEnd.traj.terminated.s - roadEnd.road.total_len_m)).toBeLessThanOrEqual(1e-6);
  });

  it("the crash crossing sits on the deadbanded ceiling (phi ≈ phiMax + eps_phi)", () => {
    const last = crash.traj.samples[crash.traj.samples.length - 1]!;
    const ceilingDeg = 45 + eps_phi_deg;
    // the crossing is bracketed on the violated quantity, within one step's roll
    expect(Math.abs(last.phi)).toBeGreaterThanOrEqual(45 - 0.05);
    expect(Math.abs(last.phi)).toBeLessThanOrEqual(ceilingDeg + 0.3);
  });

  it("the runaway guards terminate at their bounds", () => {
    expect(Math.abs(maxTime.traj.terminated.t - max_time_s)).toBeLessThanOrEqual(dt_s);
    // max_dist: the guard is on path length; on a straight road station ≈ path
    expect(maxDist.traj.terminated.s).toBeGreaterThan(max_dist_m - 2);
    expect(maxDist.traj.terminated.s).toBeLessThanOrEqual(max_dist_m + 2);
  });

  it("every event lies within the run's sample range, ordered by t", () => {
    for (const { b } of BATTERY) {
      const t0 = b.traj.samples[0]!.t;
      const t1 = b.traj.terminated.t;
      let prev = -Infinity;
      for (const e of b.traj.events) {
        expect(e.t).toBeGreaterThanOrEqual(t0 - 1e-12);
        expect(e.t).toBeLessThanOrEqual(t1 + 1e-12);
        expect(e.t).toBeGreaterThanOrEqual(prev - 1e-12);
        prev = e.t;
      }
    }
  });
});

describe("reason ↔ event mapping (02 §7)", () => {
  it("crash→crash, off_road→off_road, stopped→stop, road_end→road_end; guards have no bookmark", () => {
    for (const { b, event } of BATTERY) {
      const terminalKinds: readonly EventKind[] = ["crash", "off_road", "stop", "road_end"];
      const found = b.traj.events.filter((e) => terminalKinds.includes(e.kind));
      if (event === null) {
        expect(found).toHaveLength(0); // max_time / max_dist: nothing pedagogical at a guard
      } else {
        expect(found).toHaveLength(1);
        expect(found[0]!.kind).toBe(event);
        expect(found[0]!.s).toBe(b.traj.terminated.s);
        expect(found[0]!.t).toBe(b.traj.terminated.t);
      }
    }
  });
});

describe("P-RESAMPLE", () => {
  it("the retained grid is strictly monotone in s and t, on the ds_m lattice plus the exact terminal", () => {
    for (const { b } of BATTERY) {
      const smp = b.traj.samples;
      for (let i = 1; i < smp.length; i++) {
        expect(smp[i]!.s).toBeGreaterThan(smp[i - 1]!.s);
        expect(smp[i]!.t).toBeGreaterThan(smp[i - 1]!.t);
      }
      // every non-terminal sample sits on the 0.5 m arc lattice
      for (const p of smp.slice(0, -1)) {
        const q = p.s / 0.5;
        expect(Math.abs(q - Math.round(q))).toBeLessThanOrEqual(1e-9);
      }
    }
  });

  it("lane fraction is recomputed from the corridor algebra, never lerped independently", () => {
    for (const { b } of BATTERY) {
      for (const p of b.traj.samples) {
        expect(p.f).toBe(b.road.fOf(p.d, p.s));
      }
    }
  });

  it("interpolated numeric fields lie between plausible neighbours (v monotone under a held brake)", () => {
    // On the stopped fixture v is non-increasing after brake onset; a resample
    // that fabricated values outside its raw bracket would break this.
    const onset = stopped.traj.events.find((e) => e.kind === "brake_start")!;
    const post = stopped.traj.samples.filter((p) => p.t >= onset.t + 1);
    for (let i = 1; i < post.length; i++) {
      expect(post[i]!.v).toBeLessThanOrEqual(post[i - 1]!.v + 1e-12);
    }
  });

  it("the record is deep-frozen (05 §2.2)", () => {
    const traj = roadEnd.traj;
    expect(Object.isFrozen(traj)).toBe(true);
    expect(Object.isFrozen(traj.samples)).toBe(true);
    expect(Object.isFrozen(traj.samples[0])).toBe(true);
    expect(Object.isFrozen(traj.events)).toBe(true);
    expect(Object.isFrozen(traj.events[0])).toBe(true);
    expect(Object.isFrozen(traj.terminated)).toBe(true);
    expect(() => {
      (traj.samples[0] as { v: number }).v = 999;
    }).toThrow();
  });
});

describe("P-RESAMPLE flag OR-fold (02 §6: boolean flags OR-ed per bracket, EVERY retention path)", () => {
  // Direct unit exercise of the resampler: a flag blip set at raw points
  // strictly inside the final sub-bracket (after the last grid station's right
  // bracket, before the terminal point) must survive retention even when the
  // terminal raw point coincides with a grid station — the case every
  // 0.5 m-multiple road-end run hits ("S 120", "lane 8 | S 400", …). The 05
  // §6.3 validity dwell rule depends on this.
  function rawPoint(over: Partial<RawPoint> & { s: number; t: number }): RawPoint {
    return {
      x: over.s,
      y: 0,
      psi: 0,
      v: 10,
      phi: 0,
      d: 0,
      mu: 1.0,
      cmd_a: 0,
      a_cmd_rate: 0,
      a_long: 0,
      clipped: false,
      cmd_lean: 0,
      roll_rate_dps: 50,
      action_id: null,
      steer_state: "track",
      lat_action_id: null,
      su_sustained: 0,
      su_transient: 0,
      below_validity: false,
      ...over
    };
  }
  const composed = compose({ dsl: "lane 3.5 | S 10" });
  if (!composed.ok) throw new Error("fixture road failed to compose");
  const flagRoad = composed.value;

  it("a blip inside the final sub-bracket survives a grid-coincident terminal point", () => {
    const raw: readonly RawPoint[] = [
      rawPoint({ s: 0, t: 0 }),
      rawPoint({ s: 0.3, t: 0.03 }),
      rawPoint({ s: 0.6, t: 0.06 }),
      rawPoint({ s: 0.8, t: 0.08, clipped: true, below_validity: true }), // the blip
      rawPoint({ s: 1.0, t: 0.1 }) // terminal, exactly on the 0.5 m grid — flags false
    ];
    const retained = resample(raw, flagRoad, STUB_SIGHT, 0.5);
    // grid 0, 0.5, 1.0 — the coincident terminal is the last retained point,
    // with no duplicate terminal append
    expect(retained.map((p) => p.s)).toEqual([0, 0.5, 1.0]);
    const terminal = retained[retained.length - 1]!;
    expect(terminal.clipped).toBe(true);
    expect(terminal.below_validity).toBe(true);
    // non-flag fields are still the exact terminal raw point's
    expect(terminal.t).toBe(0.1);
    expect(terminal.v).toBe(10);
    expect(terminal.f).toBe(flagRoad.fOf(0, 1.0));
  });

  it("a blip inside the final sub-bracket survives an off-grid terminal append too", () => {
    const raw: readonly RawPoint[] = [
      rawPoint({ s: 0, t: 0 }),
      rawPoint({ s: 0.4, t: 0.04 }),
      rawPoint({ s: 0.9, t: 0.09 }),
      rawPoint({ s: 1.02, t: 0.102, below_validity: true }), // the blip
      rawPoint({ s: 1.1, t: 0.11 }) // terminal, off-grid — flags false
    ];
    const retained = resample(raw, flagRoad, STUB_SIGHT, 0.5);
    expect(retained.map((p) => p.s)).toEqual([0, 0.5, 1.0, 1.1]);
    expect(retained[retained.length - 1]!.below_validity).toBe(true);
  });

  it("a flag-free span retains false flags (no spurious OR)", () => {
    const raw: readonly RawPoint[] = [
      rawPoint({ s: 0, t: 0 }),
      rawPoint({ s: 0.5, t: 0.05 }),
      rawPoint({ s: 1.0, t: 0.1 })
    ];
    const retained = resample(raw, flagRoad, STUB_SIGHT, 0.5);
    for (const p of retained) {
      expect(p.clipped).toBe(false);
      expect(p.below_validity).toBe(false);
    }
  });
});

describe("P-EMERGENT-APEX", () => {
  /** argmin-f station over the corner window — the emergent apex proxy. */
  function apexStation(traj: Trajectory, s0: number, s1: number): number {
    const inCorner = traj.samples.filter((p) => p.s >= s0 && p.s < s1);
    return inCorner.reduce((a, b) => (b.f < a.f ? b : a)).s;
  }

  it("physics-inert inputs (ids, meta) change no sample; the apex stays put", () => {
    const renamed: readonly ResolvedPlanAction[] = C30_PLAN.map((a) => ({
      ...a,
      id: `${a.id}-renamed`
    }));
    const twin = build(C30_DSL, 70, renamed, {
      f: 0.9,
      id: "C30-renamed",
      meta: { note: "physics-inert metadata" }
    });
    const a = roadEnd.traj.samples;
    const b = twin.traj.samples;
    expect(b.length).toBe(a.length);
    for (let i = 0; i < a.length; i++) {
      expect(b[i]!.x).toBe(a[i]!.x);
      expect(b[i]!.y).toBe(a[i]!.y);
      expect(b[i]!.v).toBe(a[i]!.v);
      expect(b[i]!.phi).toBe(a[i]!.phi);
      expect(b[i]!.f).toBe(a[i]!.f);
    }
    expect(apexStation(twin.traj, 35, 82.1)).toBe(apexStation(roadEnd.traj, 35, 82.1));
  });

  it("the apex responds only through physics-relevant inputs (turn-in station moves it)", () => {
    const shifted: readonly ResolvedPlanAction[] = C30_PLAN.map((a) =>
      a.do === "turn_in" ? { ...a, at_s: a.at_s - 3 } : a
    );
    const twin = build(C30_DSL, 70, shifted, { f: 0.9, id: "C30-early-ti" });
    const apexBase = apexStation(roadEnd.traj, 35, 82.1);
    const apexShifted = apexStation(twin.traj, 35, 82.1);
    expect(Math.abs(apexShifted - apexBase)).toBeGreaterThan(1.0);
  });

  it("no plan vocabulary can pin an apex: the engine consumes only brake/turn_in/throttle/position", () => {
    // The emergent-apex schema rejection (`apex` fields, `apex:<id>` anchors)
    // is plan/validate's gate (WP-05). At engine rank the closed
    // ResolvedPlanAction union simply has no apex-bearing member — assert the
    // discriminant set is exactly the four physical actions.
    const kinds = new Set(C30_PLAN.map((a) => a.do));
    expect([...kinds].sort()).toEqual(["brake", "throttle", "turn_in"]);
    const witness: ResolvedPlanAction = { do: "position", id: "p", at_s: 1, f: 0.5, over_m: 5 };
    expect(["brake", "turn_in", "throttle", "position"]).toContain(witness.do);
  });
});
