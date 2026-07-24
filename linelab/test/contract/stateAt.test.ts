// test/contract/stateAt.test.ts — the stateAt package's v0.2 gates:
//   · C-STATEAT-LAWS — the 05 §3.2 interpolation laws over hand-built AND
//     engine trajectories: endpoint exactness (a sample's own s or t returns
//     that sample), linear/angle/hold rules, f recomputed from the corridor
//     algebra (ARCHITECTURE drift risk #9), s↔t duals agree, boundary/terminal
//     instants, below_validity's stateAt semantics (hold of i0 — its
//     per-bracket OR happens at RESAMPLING, 05 §3.2), typed Result errors
//     outside the domain.
//   · C-BOOKMARKS — events-as-bookmarks (05 §5): every event of every golden
//     line resolves through stateAt by both {t} and {s}; jumping lands at the
//     event's interpolated t.
//   · C-PHASE-TOTAL — over EVERY golden-roster fixture, every sample's phase
//     is defined, lies in the five-token closed set, and never regresses
//     within a corner (05 §4.1, D41); skipped phases legal; done ⇔ after the
//     road's last-corner exit; early-terminated lines never reach done.
//
// Error assertions ride code + detail.reason, never message text (ARCHITECTURE §4).

import { describe, it, expect, beforeAll } from "vitest";

import { stateAt } from "../../src/core/stateAt.js";
import type { StateAtInput, StateAtQuery } from "../../src/core/stateAt.js";
import { stateAt as rootStateAt } from "../../src/index.js";
import { sightTrendAt } from "../../src/sight/analyze.js";
import { compose } from "../../src/road/compose.js";
import { aNoReturn, aWiden, phiMax, PHI_VALID_MIN_DEG } from "../../src/core/slice.js";
import { degToRad, radToDeg } from "../../src/core/units.js";
import { PHASES } from "../../src/core/types.js";
import type {
  Event,
  InstantState,
  Phase,
  ResolvedPlanAction,
  RoadModel,
  Sample,
  Trajectory
} from "../../src/core/types.js";
import type { Result } from "../../src/core/result.js";
import type { ComposedRoad } from "../../src/road/types.js";

import { BLESS_ROSTER } from "../../src/cli/bless.js";
import { run } from "../../src/solve/run.js";
import { chainedSolve } from "../../src/solve/chained.js";
import { compileMistake } from "../../src/solve/mistake.js";
import { isLineRefusal } from "../../src/solve/envelope.js";
import type { LineResult } from "../../src/solve/types.js";

// ---------------------------------------------------------------------------
// Fixture scaffolding (hand-built trajectories — the analyze.test.ts pattern)

function road(dsl: string): ComposedRoad {
  const r = compose({ dsl });
  if (!r.ok) throw new Error(`test road failed to compose: ${r.error.message}`);
  return r.value;
}

// R 30 ^90 with a 5 m approach/exit — corner c1 spans s0 ≈ 5 .. s1 ≈ 5 + 30·π/2.
const R30 = road("lane 3.5 | S 5 | R 30 ^90 | S 5");

function mkSample(s: number, t: number, over: Partial<Sample> = {}): Sample {
  return {
    s,
    t,
    x: s,
    y: 0,
    psi: 0,
    v: 15,
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

function mkInput(
  trajectory: Trajectory,
  roadModel: RoadModel = R30,
  plan: readonly ResolvedPlanAction[] = []
): StateAtInput {
  return { trajectory, road: roadModel, plan, sightTrendAt };
}

function get(r: Result<InstantState>): InstantState {
  if (!r.ok) throw new Error(`expected ok, got ${JSON.stringify(r.error)}`);
  return r.value;
}

function fail(r: Result<InstantState>): { code: string; at: string; detail?: Record<string, unknown> } {
  if (r.ok) throw new Error("expected err, got ok");
  return r.error;
}

/** The Sample keys that carry numbers (for dual-agreement field sweeps). */
const NUMERIC_SAMPLE_KEYS = [
  "s", "t", "x", "y", "psi", "v", "phi", "kappa", "a_long", "a_lat", "grip", "mu",
  "d", "f", "cmd_lean", "cmd_a", "roll_rate", "n_long", "n_lat",
  "sight_m", "ssd_m", "limit_x", "limit_y", "sight_ride_m",
  "su_sustained", "su_transient", "a_cmd_rate"
] as const;

// ---------------------------------------------------------------------------
// The golden roster, recomputed once for the whole file (the computeOne walk of
// src/cli/bless.ts, kept minimal): every fixture's LineResults + composed road.

interface GoldenLine {
  readonly fixture: string;
  readonly line: LineResult;
  readonly road: RoadModel;
}

let rosterCache: readonly GoldenLine[] | null = null;
function goldenLines(): readonly GoldenLine[] {
  if (rosterCache !== null) return rosterCache;
  const out: GoldenLine[] = [];
  for (const entry of BLESS_ROSTER) {
    if (entry.input.kind === "run") {
      const r = run(entry.input.input);
      if (!r.ok) throw new Error(`${entry.id}: run refused: ${JSON.stringify(r.error)}`);
      for (const l of r.value.lines) {
        if (isLineRefusal(l)) throw new Error(`${entry.id}: unexpected refusal ${l.line_id}`);
        out.push({ fixture: entry.id, line: l, road: r.value.road });
      }
    } else {
      const baseR = chainedSolve({ ...(entry.input.baseSpec as object), accept: entry.input.baseAccept } as never);
      if (!baseR.ok) throw new Error(`${entry.id}: base solve refused: ${JSON.stringify(baseR.error)}`);
      const compiled = compileMistake(entry.input.mistake.kind, entry.input.mistake.params as never, {
        base: baseR.value,
        spec: entry.input.baseSpec as never
      });
      if (!compiled.ok) throw new Error(`${entry.id}: mistake compile refused: ${JSON.stringify(compiled.error)}`);
      const roadR = compose({ dsl: baseR.value.resolved_scenario.road.dsl });
      if (!roadR.ok) throw new Error(`${entry.id}: road failed to compose`);
      out.push({ fixture: entry.id, line: baseR.value, road: roadR.value });
      out.push({ fixture: entry.id, line: compiled.value.line, road: roadR.value });
    }
  }
  rosterCache = out;
  return out;
}

function inputOf(g: GoldenLine): StateAtInput {
  return mkInput(g.line.trajectory, g.road, g.line.resolved_scenario.rider.plan);
}

function firstGolden(fixture: string): GoldenLine {
  const g = goldenLines().find((x) => x.fixture === fixture);
  if (g === undefined) throw new Error(`no golden line for fixture ${fixture}`);
  return g;
}

// Warm the roster cache once, in a hook, before any `it` runs. `goldenLines()`
// solves all ~16 BLESS_ROSTER fixtures (~4s wall-clock — measured, not a
// stateAt cost: the loop below over 216 samples runs in under 1ms). Left
// lazy, that one-time cost lands on whichever `it` happens to touch
// `firstGolden`/`goldenLines` first and can exceed the per-test timeout;
// hoisting it into `beforeAll` keeps every test's assertion-only work
// honestly timed.
beforeAll(() => {
  goldenLines();
});

// ===========================================================================
// C-STATEAT-LAWS — hand-built trajectories

describe("C-STATEAT-LAWS — endpoint exactness", () => {
  // varied per-sample values so verbatim return is falsifiable field by field
  const samples = [0, 10, 20, 30, 40].map((s, i) =>
    mkSample(s, s / 10, {
      v: 10 + i,
      phi: 5 * i,
      psi: 30 * i,
      f: 0.1 * i + 0.2,
      action_id: i % 2 === 0 ? `a${i}` : null,
      mu: 1 - 0.05 * i,
      grip: 0.3 + 0.1 * i
    })
  );
  const input = mkInput(traj(samples));

  it("querying a sample's own s returns that sample verbatim, alpha = 0", () => {
    samples.forEach((p, i) => {
      const st = get(stateAt(input, { s: p.s }));
      expect(st.sample).toEqual(p);
      expect(st.at).toEqual({ i0: i, i1: i, alpha: 0 });
    });
  });

  it("querying a sample's own t returns that sample verbatim, alpha = 0", () => {
    samples.forEach((p, i) => {
      const st = get(stateAt(input, { t: p.t }));
      expect(st.sample).toEqual(p);
      expect(st.at).toEqual({ i0: i, i1: i, alpha: 0 });
    });
  });

  it("an exact hit returns the RECORDED f verbatim (interpolation laws bind only between samples)", () => {
    const st = get(stateAt(input, { s: samples[1]!.s }));
    expect(st.sample.f).toBe(samples[1]!.f); // hand-built f, not fOf(d, s)
  });

  it("the root export is the same function (marked append in src/index.ts)", () => {
    expect(rootStateAt).toBe(stateAt);
  });
});

describe("C-STATEAT-LAWS — the three interpolation rule families (05 §3.2)", () => {
  const a = mkSample(10, 1, {
    x: 10, y: 2, v: 10, kappa: 0.01, a_long: -2, a_lat: 3, grip: 0.6, d: 0.5,
    cmd_a: -3, n_long: -0.4, n_lat: 0.2, sight_m: 100, ssd_m: 30, limit_x: 50,
    limit_y: 5, sight_ride_m: 90, su_sustained: 2, su_transient: -1, a_cmd_rate: -10,
    mu: 1.0, roll_rate: 50, action_id: "b1", clipped: false, steer_state: "commit",
    lat_action_id: "t1", below_validity: false, phi: 10, psi: 350, cmd_lean: 350
  });
  const b = mkSample(20, 2, {
    x: 20, y: 6, v: 14, kappa: 0.03, a_long: 2, a_lat: 5, grip: 0.8, d: -0.5,
    cmd_a: 1, n_long: 0.2, n_lat: 0.6, sight_m: 140, ssd_m: 34, limit_x: 70,
    limit_y: 9, sight_ride_m: 130, su_sustained: 0, su_transient: 1, a_cmd_rate: 10,
    mu: 0.8, roll_rate: 30, action_id: "t9", clipped: true, steer_state: "unwind",
    lat_action_id: null, below_validity: true, phi: 30, psi: 10, cmd_lean: 10
  });
  const input = mkInput(traj([a, b]));

  it("linear fields lerp; the queried coordinate passes through exactly", () => {
    const st = get(stateAt(input, { s: 12.5 })); // alpha = 0.25
    expect(st.at).toEqual({ i0: 0, i1: 1, alpha: 0.25 });
    expect(st.sample.s).toBe(12.5);
    expect(st.sample.t).toBeCloseTo(1.25, 12);
    expect(st.sample.x).toBeCloseTo(12.5, 12);
    expect(st.sample.y).toBeCloseTo(3, 12);
    expect(st.sample.v).toBeCloseTo(11, 12);
    expect(st.sample.kappa).toBeCloseTo(0.015, 12);
    expect(st.sample.a_long).toBeCloseTo(-1, 12);
    expect(st.sample.a_lat).toBeCloseTo(3.5, 12);
    expect(st.sample.grip).toBeCloseTo(0.65, 12);
    expect(st.sample.d).toBeCloseTo(0.25, 12);
    expect(st.sample.cmd_a).toBeCloseTo(-2, 12);
    expect(st.sample.n_long).toBeCloseTo(-0.25, 12);
    expect(st.sample.n_lat).toBeCloseTo(0.3, 12);
    expect(st.sample.sight_m).toBeCloseTo(110, 12);
    expect(st.sample.ssd_m).toBeCloseTo(31, 12);
    expect(st.sample.limit_x).toBeCloseTo(55, 12);
    expect(st.sample.limit_y).toBeCloseTo(6, 12);
    expect(st.sample.sight_ride_m).toBeCloseTo(100, 12);
    expect(st.sample.su_sustained).toBeCloseTo(1.5, 12);
    expect(st.sample.su_transient).toBeCloseTo(-0.5, 12);
    expect(st.sample.a_cmd_rate).toBeCloseTo(-5, 12);
  });

  it("angle fields blend shortest-arc: 350°→10° passes through 0°/360°, never 180°", () => {
    const st = get(stateAt(input, { s: 15 })); // alpha = 0.5
    // psi and cmd_lean: 350 → 10 blends to 360 ≡ 0, NOT 180
    const norm = (deg: number): number => ((deg % 360) + 360) % 360;
    expect(Math.min(norm(st.sample.psi), 360 - norm(st.sample.psi))).toBeCloseTo(0, 9);
    expect(Math.min(norm(st.sample.cmd_lean), 360 - norm(st.sample.cmd_lean))).toBeCloseTo(0, 9);
    // phi 10 → 30 is the plain short way
    expect(st.sample.phi).toBeCloseTo(20, 12);
  });

  it("hold fields take sample i0's value at every interior alpha (below_validity's OR happened at resampling)", () => {
    for (const s of [10.1, 15, 19.9]) {
      const st = get(stateAt(input, { s }));
      expect(st.sample.mu).toBe(a.mu);
      expect(st.sample.roll_rate).toBe(a.roll_rate);
      expect(st.sample.action_id).toBe(a.action_id);
      expect(st.sample.clipped).toBe(a.clipped);
      expect(st.sample.steer_state).toBe(a.steer_state);
      expect(st.sample.lat_action_id).toBe(a.lat_action_id);
      expect(st.sample.below_validity).toBe(a.below_validity); // false — hold, not OR
    }
    // ... and the right endpoint still reads its own recorded values verbatim
    const end = get(stateAt(input, { s: 20 }));
    expect(end.sample.below_validity).toBe(true);
    expect(end.sample.clipped).toBe(true);
  });

  it("hold i0 also when the LEFT sample carries the flags (direction check)", () => {
    const c = { ...a, below_validity: true, clipped: true };
    const d2 = { ...b, below_validity: false, clipped: false };
    const inp = mkInput(traj([c, d2]));
    const st = get(stateAt(inp, { s: 15 }));
    expect(st.sample.below_validity).toBe(true);
    expect(st.sample.clipped).toBe(true);
  });

  it("f is recomputed from the corridor algebra at the interpolated (d, s) — never lerped (drift risk #9)", () => {
    // deliberately WRONG hand-built f: a lerp would return 99
    const c = mkSample(20, 2, { d: 0.5, f: 99 });
    const d2 = mkSample(30, 3, { d: -0.5, f: 99 });
    const inp = mkInput(traj([c, d2]), R30);
    const st = get(stateAt(inp, { s: 25 }));
    expect(st.sample.f).toBe(R30.fOf(0, 25));
    expect(st.sample.f).not.toBe(99);
    // exact hit: recorded value verbatim
    expect(get(stateAt(inp, { s: 20 })).sample.f).toBe(99);
  });
});

describe("C-STATEAT-LAWS — query validation and domain (typed Result errors)", () => {
  const samples = [0, 10, 20, 30, 40].map((s) => mkSample(s, s / 10));
  const input = mkInput(traj(samples));

  it("both s and t → SCHEMA/query_exactly_one; neither → SCHEMA/query_exactly_one", () => {
    for (const q of [{ s: 1, t: 1 }, {}] as unknown as StateAtQuery[]) {
      const e = fail(stateAt(input, q));
      expect(e.code).toBe("SCHEMA");
      expect(e.detail?.["reason"]).toBe("query_exactly_one");
    }
  });

  it("non-finite query values → SCHEMA/query_not_finite", () => {
    for (const q of [{ s: Number.NaN }, { t: Number.POSITIVE_INFINITY }] as StateAtQuery[]) {
      const e = fail(stateAt(input, q));
      expect(e.code).toBe("SCHEMA");
      expect(e.detail?.["reason"]).toBe("query_not_finite");
    }
  });

  it("queries outside [first, terminated] are BAD_RANGE carrying the valid interval — never clamped", () => {
    for (const q of [{ s: -0.001 }, { s: 40.001 }, { t: -1 }, { t: 4.0001 }] as StateAtQuery[]) {
      const e = fail(stateAt(input, q));
      expect(e.code).toBe("BAD_RANGE");
      expect(e.detail?.["reason"]).toBe("query_outside_domain");
      expect(typeof e.detail?.["min"]).toBe("number");
      expect(typeof e.detail?.["max"]).toBe("number");
      expect(e.at.startsWith("[")).toBe(true); // at = the valid interval (05 §4)
    }
  });

  it("boundary instants resolve exactly (first and last sample, both axes)", () => {
    const first = get(stateAt(input, { s: 0 }));
    expect(first.at).toEqual({ i0: 0, i1: 0, alpha: 0 });
    const last = get(stateAt(input, { t: 4 }));
    expect(last.at).toEqual({ i0: 4, i1: 4, alpha: 0 });
  });

  it("the returned InstantState is frozen", () => {
    const st = get(stateAt(input, { s: 15 }));
    expect(Object.isFrozen(st)).toBe(true);
    expect(Object.isFrozen(st.sample)).toBe(true);
    expect(Object.isFrozen(st.derived)).toBe(true);
    expect(Object.isFrozen(st.derived.limit_point)).toBe(true);
    expect(Object.isFrozen(st.at)).toBe(true);
  });
});

describe("C-STATEAT-LAWS — the derived block (05 §4)", () => {
  const brake: ResolvedPlanAction = { do: "brake", id: "b1", at_s: 2, decel: 3, slew_mss: 6 };
  const p = mkSample(25, 2.5, {
    v: 15, phi: 20, roll_rate: 50, mu: 0.9, sight_ride_m: 180, ssd_m: 20,
    su_sustained: 1.5, su_transient: -0.5, limit_x: 3, limit_y: 4, action_id: "b1"
  });
  const input = mkInput(traj([mkSample(0, 0), p]), R30, [brake]);
  const st = get(stateAt(input, { s: 25 }));

  it("v_kmh, sight_margin_m, stand_up_dps, phi_max_deg, limit_point", () => {
    expect(st.derived.v_kmh).toBe(15 * 3.6);
    expect(st.derived.sight_margin_m).toBe(180 - 20);
    expect(st.derived.stand_up_dps).toBe(1.0);
    expect(st.derived.phi_max_deg).toBe(radToDeg(phiMax(0.9)));
    expect(st.derived.limit_point).toEqual({ x: 3, y: 4 });
  });

  it("a_noreturn_ms2 and a_widen_ms2 equal the exported core closed forms; c = 1 pinned (ARCHITECTURE §10.12)", () => {
    expect(st.derived.a_noreturn_ms2).toBe(aNoReturn(degToRad(20), degToRad(50)));
    expect(st.derived.a_widen_ms2).toBe(aWiden(degToRad(20), 15, 1, degToRad(50)));
    expect(st.derived.a_widen_ms2).not.toBeNull();
  });

  it("both crossovers are null inside the upright immunity band (|phi| < 2°)", () => {
    const upright = mkSample(10, 1, { phi: PHI_VALID_MIN_DEG - 0.5 });
    const inp = mkInput(traj([mkSample(0, 0), upright]));
    const u = get(stateAt(inp, { s: 10 }));
    expect(u.derived.a_noreturn_ms2).toBeNull();
    expect(u.derived.a_widen_ms2).toBeNull();
  });

  it("a_widen_ms2 is null below the existence bound (denominator ≤ 0) while a_noreturn_ms2 survives", () => {
    // phi 3° at v = 0.5 m/s: sin(2phi)/v dominates K_SU·tanh(3/5)
    const slow = mkSample(10, 1, { phi: 3, v: 0.5 });
    const inp = mkInput(traj([mkSample(0, 0), slow]));
    const u = get(stateAt(inp, { s: 10 }));
    expect(u.derived.a_widen_ms2).toBeNull();
    expect(u.derived.a_noreturn_ms2).not.toBeNull();
    expect(Number.isFinite(u.derived.a_noreturn_ms2!)).toBe(true);
  });

  it("action resolves against the resolved plan by the sample's action_id, or null", () => {
    expect(st.derived.action).toBe(brake);
    const idle = get(stateAt(input, { s: 0 })); // action_id null
    expect(idle.derived.action).toBeNull();
    const unknown = mkInput(traj([mkSample(0, 0, { action_id: "zz" })]), R30, [brake]);
    expect(get(stateAt(unknown, { s: 0 })).derived.action).toBeNull();
  });

  it("corner_id is the corner containing s, null on straights (independent of phase)", () => {
    const c1 = R30.corners[0]!;
    expect(st.derived.corner_id).toBe(c1.id); // s = 25 is inside the corner
    const before = get(stateAt(input, { s: 0 }));
    expect(before.derived.corner_id).toBeNull();
  });

  it("ssd_station_m walks ssd_m of PATH length forward, clamped at line end", () => {
    // straight-line hand fixture: x = s, y = 0 → path length ≡ Δstation
    const line = [0, 10, 20, 30, 40].map((s) => mkSample(s, s / 10, { ssd_m: 15 }));
    const inp = mkInput(traj(line));
    expect(get(stateAt(inp, { s: 10 })).derived.ssd_station_m).toBeCloseTo(25, 9);
    // interpolated start point
    expect(get(stateAt(inp, { s: 12 })).derived.ssd_station_m).toBeCloseTo(27, 9);
    // clamp: 15 m of ssd from s = 35 runs off the 40 m record → last sample's s
    expect(get(stateAt(inp, { s: 35 })).derived.ssd_station_m).toBe(40);
  });

  it("sight_trend equals the sight/analyze.ts rule at the bracketing sample", () => {
    const rising = [0, 5, 10, 15, 20].map((s) => mkSample(s, s / 10, { sight_m: 100 + 10 * s }));
    const inp = mkInput(traj(rising));
    const st2 = get(stateAt(inp, { s: 12 })); // i0 = 2
    expect(st2.derived.sight_trend).toBe(sightTrendAt(rising, 2));
    expect(st2.derived.sight_trend).toBe("opening");
  });
});

// ===========================================================================
// C-STATEAT-LAWS — engine trajectories (the C30-trailbrake explicit-plan line)

describe("C-STATEAT-LAWS — engine trajectory", () => {
  it("every 10th recorded sample is endpoint-exact via both s and t", () => {
    const g = firstGolden("C30-trailbrake");
    const input = inputOf(g);
    const samples = g.line.trajectory.samples;
    for (let i = 0; i < samples.length; i += 10) {
      const p = samples[i]!;
      const bys = get(stateAt(input, { s: p.s }));
      expect(bys.sample).toEqual(p);
      expect(bys.at.alpha).toBe(0);
      const byt = get(stateAt(input, { t: p.t }));
      expect(byt.sample).toEqual(p);
      expect(byt.at.i0).toBe(i);
    }
  });

  it("s↔t duals agree: stateAt({t}) of an s-query's own t returns the same instant", () => {
    const g = firstGolden("C30-trailbrake");
    const input = inputOf(g);
    const samples = g.line.trajectory.samples;
    for (const k of [3, 40, 111]) {
      const a = samples[k]!;
      const b = samples[k + 1]!;
      for (const frac of [0.1, 0.5, 0.9]) {
        const sQ = a.s + (b.s - a.s) * frac;
        const bys = get(stateAt(input, { s: sQ }));
        const byt = get(stateAt(input, { t: bys.sample.t }));
        expect(byt.at.i0).toBe(bys.at.i0);
        for (const key of NUMERIC_SAMPLE_KEYS) {
          expect(byt.sample[key], `dual mismatch on ${key} @ s=${sQ}`).toBeCloseTo(bys.sample[key], 9);
        }
        expect(byt.sample.action_id).toBe(bys.sample.action_id);
        expect(byt.sample.steer_state).toBe(bys.sample.steer_state);
        expect(byt.derived.phase).toBe(bys.derived.phase);
        expect(byt.derived.corner_id).toBe(bys.derived.corner_id);
      }
    }
  });

  it("the terminal instant resolves exactly; past-termination queries are BAD_RANGE", () => {
    const g = firstGolden("C30-trailbrake");
    const input = inputOf(g);
    const term = g.line.trajectory.terminated;
    const n = g.line.trajectory.samples.length;
    const byT = get(stateAt(input, { t: term.t }));
    expect(byT.at).toEqual({ i0: n - 1, i1: n - 1, alpha: 0 });
    const byS = get(stateAt(input, { s: term.s }));
    expect(byS.at.i0).toBe(n - 1);
    const past = fail(stateAt(input, { t: term.t + 0.001 }));
    expect(past.code).toBe("BAD_RANGE");
    expect(past.detail?.["reason"]).toBe("query_outside_domain");
  });

  it("derived.action addresses the resolved plan on a live engine sample", () => {
    const g = firstGolden("C30-trailbrake");
    const input = inputOf(g);
    const active = g.line.trajectory.samples.find((p) => p.action_id !== null)!;
    const st = get(stateAt(input, { s: active.s }));
    expect(st.derived.action).not.toBeNull();
    expect(st.derived.action!.id).toBe(active.action_id);
  });
});

// ===========================================================================
// C-BOOKMARKS — events as bookmarks (05 §5), over every golden line

describe("C-BOOKMARKS", () => {
  it("every event of every golden line is stateAt-resolvable by {t} and {s}; jumps land at the event's t", () => {
    const kindsSeen = new Set<string>();
    for (const g of goldenLines()) {
      const input = inputOf(g);
      for (const e of g.line.trajectory.events) {
        kindsSeen.add(e.kind);
        const byT = stateAt(input, { t: e.t });
        expect(byT.ok, `${g.fixture}/${g.line.line_id}: event ${e.kind}@t=${e.t} not resolvable by t`).toBe(true);
        if (byT.ok) expect(byT.value.sample.t).toBeCloseTo(e.t, 9);
        const byS = stateAt(input, { s: e.s });
        expect(byS.ok, `${g.fixture}/${g.line.line_id}: event ${e.kind}@s=${e.s} not resolvable by s`).toBe(true);
      }
    }
    // the roster must exercise a healthy spread of the closed kind set
    for (const kind of ["brake_start", "brake_end", "turn_in", "steering_complete", "roll_on", "apex", "exit", "release", "road_end", "stop"]) {
      expect(kindsSeen.has(kind), `no golden line carries event kind "${kind}"`).toBe(true);
    }
  });

  it("querying an opener event's exact t returns the opened phase (half-open intervals, 05 §4.1)", () => {
    const g = firstGolden("C30-trailbrake");
    const input = inputOf(g);
    const events = g.line.trajectory.events;
    const lastCorner = g.road.corners[g.road.corners.length - 1]!;
    const opened: Record<string, Phase> = { turn_in: "turning", steering_complete: "midcorner", roll_on: "exiting" };
    for (const e of events) {
      const phase = opened[e.kind] ?? (e.kind === "exit" && e.corner_id === lastCorner.id ? "done" : null);
      if (phase === null) continue;
      // skip ties: another opener at the identical t would legally win by order
      const atSameT = events.filter((o) => o.t === e.t && (o.kind in opened || o.kind === "exit"));
      if (atSameT.length > 1) continue;
      const st = get(stateAt(input, { t: e.t }));
      expect(st.derived.phase, `${e.kind}@t=${e.t}`).toBe(phase);
    }
  });
});

// ===========================================================================
// C-PHASE-TOTAL — phase totality on EVERY golden fixture (05 §4.1, D41)

const RANK: Readonly<Record<Phase, number>> = { approach: 0, turning: 1, midcorner: 2, exiting: 3, done: 4 };

describe("C-PHASE-TOTAL", () => {
  it("every sample of every golden line has a phase in the closed five-token set", () => {
    for (const g of goldenLines()) {
      const input = inputOf(g);
      for (const p of g.line.trajectory.samples) {
        const st = stateAt(input, { t: p.t });
        expect(st.ok, `${g.fixture}/${g.line.line_id}: no state at t=${p.t}`).toBe(true);
        if (st.ok) {
          expect(PHASES).toContain(st.value.derived.phase);
        }
      }
    }
  });

  it("phase never regresses within a corner (turn_in..exit window of each corner)", () => {
    for (const g of goldenLines()) {
      const input = inputOf(g);
      const events = g.line.trajectory.events;
      for (const c of g.road.corners) {
        const turnIn = events.find((e) => e.kind === "turn_in" && e.corner_id === c.id);
        if (turnIn === undefined) continue;
        const exit = events.find((e) => e.kind === "exit" && e.corner_id === c.id);
        const tEnd = exit?.t ?? Number.POSITIVE_INFINITY;
        let prev = -1;
        for (const p of g.line.trajectory.samples) {
          if (p.t < turnIn.t || p.t > tEnd) continue;
          const st = get(stateAt(input, { t: p.t }));
          const rank = RANK[st.derived.phase];
          expect(
            rank,
            `${g.fixture}/${g.line.line_id}: phase regressed within ${c.id} at t=${p.t} (${st.derived.phase})`
          ).toBeGreaterThanOrEqual(prev);
          prev = rank;
        }
      }
    }
  });

  it("skipped phases are legal: a line with no turn_in stays approach throughout (C30-stop)", () => {
    const g = firstGolden("C30-stop");
    const input = inputOf(g);
    expect(g.line.trajectory.events.some((e) => e.kind === "turn_in")).toBe(false);
    for (const p of g.line.trajectory.samples) {
      expect(get(stateAt(input, { t: p.t })).derived.phase).toBe("approach");
    }
  });

  it("done opens only at/after the road's last-corner exit; early-terminated lines never reach done", () => {
    const OPENER_KINDS = new Set(["turn_in", "steering_complete", "roll_on", "exit"]);
    for (const g of goldenLines()) {
      const input = inputOf(g);
      const lastCorner = g.road.corners[g.road.corners.length - 1];
      const exitLast =
        lastCorner === undefined
          ? undefined
          : g.line.trajectory.events.find((e) => e.kind === "exit" && e.corner_id === lastCorner.id);
      for (const p of g.line.trajectory.samples) {
        const phase = get(stateAt(input, { t: p.t })).derived.phase;
        if (exitLast === undefined) {
          expect(phase, `${g.fixture}/${g.line.line_id}: done without a last-corner exit`).not.toBe("done");
        } else if (phase === "done") {
          expect(p.t).toBeGreaterThanOrEqual(exitLast.t);
        }
      }
      // "done spans last-exit → termination" holds when no LATER opener exists;
      // a plan action past the exit (e.g. C30-LR's r1 roll_on at s=125) legally
      // re-opens its phase — the latest-opener law of 05 §4.1 is normative.
      const laterOpener = g.line.trajectory.events.some((e) => OPENER_KINDS.has(e.kind) && exitLast !== undefined && e.t > exitLast.t);
      if (exitLast !== undefined && !laterOpener) {
        const term = get(stateAt(input, { t: g.line.trajectory.terminated.t }));
        expect(term.derived.phase, `${g.fixture}/${g.line.line_id}: terminal sample after last exit must read done`).toBe("done");
      }
    }
  });
});
