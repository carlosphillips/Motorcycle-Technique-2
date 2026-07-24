// test/analytic/an.test.ts — the analytic-acceptance layer (design/09 §3.2a):
// closed-form, hand-computed, NORMATIVE expectations — the single designed
// exception to "goldens are blessed, never hand-computed" (D35). All tests read
// raw pre-emission samples (the retained full-precision record), ignore
// verdicts and doctrine entirely, and must be green before any bless.
//
// Fixtures are constructed as ResolvedScenario literals (ARCHITECTURE §10.27 —
// no validate dependency). All profile: street, mu 1.0; point-mass fixtures use
// use_full_width on a wide `lane 8` carriageway.
//
// Tolerance notes (recorded WP-04 judgment): the retained record is resampled
// onto the 0.5 m arc grid by lerping between bracketing 200 Hz steps (02 §6),
// so a quantity that is CURVED in t between raw steps carries a chord error of
// up to |q''|·dt²/8 at a retained sample (e.g. slew·dt²/8 ≈ 1.9e-5 m/s on v
// during a 6 m/s³ ramp). 09 §3.2a's "≤ 1e-9 relative" is attainable exactly on
// limbs where the quantity is affine between raw steps (coast, post-ramp
// braking v(t), the roll ramp) and is asserted there; ramp limbs assert the
// documented chord bound instead. Either bound is orders of magnitude below a
// stage-weight/dt wiring bug (~1e-3), which is what this layer exists to catch.

import { describe, it, expect } from "vitest";
import { compose } from "../../src/road/compose.js";
import { integrate } from "../../src/core/integrate.js";
import { G, A_SLEW_DEFAULT, v_floor_ms, dt_s } from "../../src/core/constants.js";
import { degToRad } from "../../src/core/units.js";
import { counterfactual } from "../../src/solve/counterfactual.js";
import type {
  ResolvedPlanAction,
  ResolvedScenario,
  RoadModel,
  Sample,
  SightCaster,
  Trajectory,
  World
} from "../../src/core/types.js";

// ---------------------------------------------------------------------------
// Shared fixture scaffolding (engine-rank; no plan/validate involvement)

const STUB_SIGHT: SightCaster = {
  cast: (eye) => ({ sight_m: 0, limit_point: { x: eye.x, y: eye.y }, s_limit: 0 }),
  ssd: () => ({ ssd_m: 0, react_m: 0, standup_m: 0, brake_m: 0 })
};

interface FixtureOpts {
  readonly use_full_width?: boolean;
  readonly start?: { readonly f?: number; readonly d?: number };
  readonly compose_ds?: number;
}

function buildWorld(dsl: string, opts: FixtureOpts = {}): { world: World; road: RoadModel } {
  const composed = compose(
    { dsl, use_full_width: opts.use_full_width ?? false },
    opts.compose_ds !== undefined ? { ds_m: opts.compose_ds } : undefined
  );
  if (!composed.ok) throw new Error(`fixture road failed to compose: ${composed.error.message}`);
  const road = composed.value;
  return { world: { road, sight: STUB_SIGHT, occluders: [], hazards: [] }, road };
}

function scenario(
  id: string,
  dsl: string,
  speed_kmh: number,
  plan: readonly ResolvedPlanAction[],
  opts: FixtureOpts = {}
): ResolvedScenario {
  return {
    spec: "linelab/1",
    id,
    road: {
      lane_width_m: Number(dsl.match(/lane\s+([\d.]+)/)?.[1] ?? 3.5),
      bike_margin_m: 0.4,
      use_full_width: opts.use_full_width ?? false,
      segments: [],
      dsl
    },
    occluders: [],
    hazards: [],
    rider: {
      profile: "street",
      start: { speed_kmh, ...(opts.start ?? { d: 0 }) },
      plan
    },
    config: { mu: 1.0, ds_m: 0.5, ssd_model: "alert", rubric: "parks-street", checks_version: 2 }
  };
}

function run(dsl: string, speed_kmh: number, plan: readonly ResolvedPlanAction[], opts: FixtureOpts = {}): Trajectory {
  const { world } = buildWorld(dsl, opts);
  return integrate(scenario("an-fixture", dsl, speed_kmh, plan, opts), world);
}

/** Kåsa least-squares circle fit → radius. */
function fitCircleRadius(pts: readonly { x: number; y: number }[]): number {
  // minimize Σ (x² + y² + a·x + b·y + c)² — linear normal equations
  let sxx = 0, sxy = 0, syy = 0, sx = 0, sy = 0, n = 0;
  let sxz = 0, syz = 0, sz = 0;
  for (const p of pts) {
    const z = p.x * p.x + p.y * p.y;
    sxx += p.x * p.x; sxy += p.x * p.y; syy += p.y * p.y;
    sx += p.x; sy += p.y; sz += z; sxz += p.x * z; syz += p.y * z;
    n += 1;
  }
  // solve [sxx sxy sx; sxy syy sy; sx sy n] · [a b c]' = −[sxz; syz; sz]
  const m = [
    [sxx, sxy, sx, -sxz],
    [sxy, syy, sy, -syz],
    [sx, sy, n, -sz]
  ];
  for (let col = 0; col < 3; col++) {
    let piv = col;
    for (let r = col + 1; r < 3; r++) if (Math.abs(m[r]![col]!) > Math.abs(m[piv]![col]!)) piv = r;
    const tmp = m[col]!; m[col] = m[piv]!; m[piv] = tmp;
    for (let r = 0; r < 3; r++) {
      if (r === col) continue;
      const kf = m[r]![col]! / m[col]![col]!;
      for (let c2 = col; c2 < 4; c2++) m[r]![c2]! -= kf * m[col]![c2]!;
    }
  }
  const a = m[0]![3]! / m[0]![0]!;
  const b = m[1]![3]! / m[1]![1]!;
  const c = m[2]![3]! / m[2]![2]!;
  return Math.sqrt((a * a) / 4 + (b * b) / 4 - c);
}

const STREET_ROLL_RATE_DPS = 50;

// ---------------------------------------------------------------------------
// A-AN-RADIUS — F-AN-CIRCLE (09 §3.2a)

describe("A-AN-RADIUS (F-AN-CIRCLE)", () => {
  const DSL = "lane 8 | S 10 | R 30 ^270 | S 10";
  const LEAN = 25;
  const V = Math.sqrt(G * 30 * Math.tan(degToRad(LEAN))); // 11.715 m/s = 42.17 km/h
  const plan: ResolvedPlanAction[] = [
    { do: "turn_in", id: "t1", at_s: 10, target: { lean_deg: LEAN }, hand: "R" },
    { do: "throttle", id: "th1", at_s: 10, accel: 0, slew_mss: A_SLEW_DEFAULT }
  ];
  const traj = run(DSL, V * 3.6, plan, { use_full_width: true, start: { d: 0 } });

  it("kappa = G·tan(phi)/v² holds at every sample (identity ≤ 1e-9 relative)", () => {
    for (const smp of traj.samples) {
      const expected = (G * Math.tan(degToRad(smp.phi))) / (Math.max(smp.v, 0.01) ** 2);
      expect(Math.abs(smp.kappa - expected)).toBeLessThanOrEqual(1e-9 * Math.max(1, Math.abs(expected)));
    }
  });

  it("holds a steady 30.000 m radius on the steady span (1/kappa ± 0.001 m)", () => {
    const tTurnIn = traj.events.find((e) => e.kind === "turn_in")!.t;
    const release = traj.events.find((e) => e.kind === "release");
    const arcEnd = 10 + 30 * degToRad(270); // s1
    const spanEnd = Math.min(release?.s ?? Infinity, arcEnd);
    const ramp = (2 * LEAN) / STREET_ROLL_RATE_DPS; // 2·(25°/roll_rate) = 1.0 s
    const steady = traj.samples.filter((p) => p.t >= tTurnIn + ramp && p.s <= spanEnd - 0.75);
    expect(steady.length).toBeGreaterThan(50);
    for (const p of steady) {
      expect(Math.abs(1 / p.kappa - 30)).toBeLessThanOrEqual(0.001);
    }
    // v is exactly constant (a_cmd = 0 throughout)
    for (const p of steady) expect(Math.abs(p.v - V)).toBeLessThanOrEqual(1e-9 * V);
  });

  it("a circle fitted to the steady-span (x, y) samples has r = 30.00 ± 0.01 m", () => {
    const tTurnIn = traj.events.find((e) => e.kind === "turn_in")!.t;
    const release = traj.events.find((e) => e.kind === "release");
    const arcEnd = 10 + 30 * degToRad(270);
    const spanEnd = Math.min(release?.s ?? Infinity, arcEnd);
    const ramp = (2 * LEAN) / STREET_ROLL_RATE_DPS;
    const steady = traj.samples.filter((p) => p.t >= tTurnIn + ramp && p.s <= spanEnd - 0.75);
    const r = fitCircleRadius(steady.map((p) => ({ x: p.x, y: p.y })));
    expect(Math.abs(r - 30)).toBeLessThanOrEqual(0.01);
  });

  it("the 270° commitment is held through the arc (no premature release)", () => {
    // wrap-folding dpsi_rem would release at the first commit step and unwind
    // immediately; the normative fixture rides the full arc committed.
    const release = traj.events.find((e) => e.kind === "release");
    expect(release).toBeDefined();
    expect(release!.s).toBeGreaterThan(10 + 30 * degToRad(200)); // deep in the arc at least
  });
});

// ---------------------------------------------------------------------------
// A-AN-BRAKE — F-AN-BRAKE (09 §3.2a; slew-limited closed form)

describe("A-AN-BRAKE (F-AN-BRAKE)", () => {
  const V0 = 100 / 3.6; // 27.778 m/s
  const T_B = 50 / V0; // brake onset time (crossing lands exactly on a step)
  const SLEW = A_SLEW_DEFAULT;
  const T_R = 3.0 / SLEW; // 0.5 s ramp
  const V1 = V0 - (3.0 * 3.0) / (2 * SLEW); // 27.028 m/s
  const plan: ResolvedPlanAction[] = [
    { do: "brake", id: "b1", at_s: 50, decel: 3.0, slew_mss: SLEW }
  ];
  const traj = run("lane 8 | S 400", 100, plan, { use_full_width: true, start: { d: 0 } });

  it("terminates stopped at s* = 50 + 13.764 + 121.083 = 184.85 ± 0.01 m", () => {
    const sStar =
      50 + (V0 * T_R - (SLEW * T_R ** 3) / 6) + (V1 * V1 - v_floor_ms * v_floor_ms) / (2 * 3.0);
    expect(traj.terminated.reason).toBe("stopped");
    expect(Math.abs(traj.terminated.s - sStar)).toBeLessThanOrEqual(0.01);
  });

  it("v(t) matches the slew-ramped closed form on every retained sample", () => {
    for (const p of traj.samples) {
      let expected: number;
      let tol: number;
      if (p.t <= T_B + 1e-12) {
        expected = V0;
        tol = 1e-9 * V0; // coast: exact
      } else if (p.t < T_B + T_R) {
        expected = V0 - (SLEW / 2) * (p.t - T_B) ** 2;
        tol = SLEW * dt_s * dt_s; // resample chord bound (quadratic limb)
      } else {
        expected = V1 - 3.0 * (p.t - T_B - T_R);
        tol = 1e-9 * V0; // affine limb: lerp exact
      }
      expect(Math.abs(p.v - expected)).toBeLessThanOrEqual(tol);
    }
  });

  it("terminal sample is the bracketed v_floor crossing (P-EVENT-BRACKET seed)", () => {
    const last = traj.samples[traj.samples.length - 1]!;
    expect(Math.abs(last.v - v_floor_ms)).toBeLessThanOrEqual(1e-9);
    expect(last.s).toBe(traj.terminated.s);
    expect(last.t).toBe(traj.terminated.t);
  });

  it("stays exactly upright with the slice exactly zero (P-RUNWIDE-UPRIGHT limb)", () => {
    for (const p of traj.samples) {
      expect(p.phi).toBe(0);
      expect(p.su_sustained).toBe(0);
      expect(p.su_transient).toBe(0);
      expect(Math.abs(p.d)).toBeLessThanOrEqual(1e-6);
    }
  });

  it("emits brake_start at s = 50 and maps stopped → stop", () => {
    const bs = traj.events.find((e) => e.kind === "brake_start");
    expect(bs?.s).toBeCloseTo(50, 6);
    expect(bs?.action_id).toBe("b1");
    expect(traj.events.some((e) => e.kind === "stop")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// A-AN-ROLL — F-AN-ROLL (09 §3.2a)

describe("A-AN-ROLL (F-AN-ROLL)", () => {
  const plan: ResolvedPlanAction[] = [
    { do: "turn_in", id: "t1", at_s: 20, target: { lean_deg: 30 }, hand: "R" }
  ];
  const traj = run("lane 8 | S 200", 54, plan, { use_full_width: true, start: { d: 0 } });
  const tTurnIn = traj.events.find((e) => e.kind === "turn_in")!.t;

  it("ramp duration = 30°/roll_rate = 0.600 s ± 2·dt (line-intersection measure)", () => {
    // phi(t) is piecewise affine (ramp at roll_rate, then hold at 30°): retained
    // samples lie exactly on it, so the ramp line reconstructs exactly.
    const interior = traj.samples.filter(
      (p) => p.phi > 3 && p.phi < 27 && p.t > tTurnIn
    );
    expect(interior.length).toBeGreaterThan(3);
    const a = interior[0]!;
    const b = interior[interior.length - 1]!;
    const slope = (b.phi - a.phi) / (b.t - a.t);
    const tStart = a.t - a.phi / slope;
    const tArrive = a.t + (30 - a.phi) / slope;
    expect(Math.abs(tArrive - tStart - 0.6)).toBeLessThanOrEqual(2 * dt_s);
  });

  it("interior ramp slope = roll_rate (50 °/s) ± 0.5 °/s", () => {
    const interior = traj.samples.filter((p) => p.phi > 3 && p.phi < 27 && p.t > tTurnIn);
    for (let i = 1; i < interior.length; i++) {
      const slope =
        (interior[i]!.phi - interior[i - 1]!.phi) / (interior[i]!.t - interior[i - 1]!.t);
      expect(Math.abs(slope - STREET_ROLL_RATE_DPS)).toBeLessThanOrEqual(0.5);
    }
  });

  it("zero overshoot (≤ 0.01°) and phi holds at 30° after arrival", () => {
    const maxPhi = Math.max(...traj.samples.map((p) => p.phi));
    expect(maxPhi).toBeLessThanOrEqual(30 + 0.01);
    const held = traj.samples.filter((p) => p.t >= tTurnIn + 0.6 + 2 * dt_s);
    expect(held.length).toBeGreaterThan(5);
    for (const p of held) expect(Math.abs(p.phi - 30)).toBeLessThanOrEqual(0.01);
  });

  it("|phi_dot| ≤ roll_rate throughout (stand-up inactive: a_cmd = 0)", () => {
    for (let i = 1; i < traj.samples.length; i++) {
      const a = traj.samples[i - 1]!;
      const b = traj.samples[i]!;
      if (b.t - a.t < 1e-9) continue;
      const rate = Math.abs(b.phi - a.phi) / (b.t - a.t);
      expect(rate).toBeLessThanOrEqual(STREET_ROLL_RATE_DPS + 0.5);
      expect(b.su_sustained).toBe(0);
      expect(b.su_transient).toBe(0);
    }
  });
});

// ---------------------------------------------------------------------------
// A-AN-RK4 — F-AN-ACCEL (09 §3.2a; stage-weight/dt wiring gate)

describe("A-AN-RK4 (F-AN-ACCEL)", () => {
  const SLEW = A_SLEW_DEFAULT;
  const T_R = 2.0 / SLEW; // 0.3333 s (not lattice-aligned: quantized at the arrival step)
  const V1 = 10 + (SLEW / 2) * T_R * T_R; // 10.3333 m/s
  const plan: ResolvedPlanAction[] = [
    { do: "throttle", id: "th1", at_s: 0, accel: 2.0, slew_mss: SLEW }
  ];
  const traj = run("lane 8 | S 400", 36, plan, { use_full_width: true, start: { d: 0 } });

  // The engine's command follows the slew lattice: the ramp's kink lands on the
  // step boundary after t_r (arrival step quantization ≤ slew·dt²/2 ≈ 7.5e-5 on
  // v — one-time). Bounds below = closed form ± (resample chord + quantization).
  const KINK_QUANT = (SLEW * dt_s * dt_s) / 2 + 1e-9;

  it("during the ramp: v(t) = 10 + 3t², x(t) = 10t + t³ (chord-bound exact)", () => {
    for (const p of traj.samples.filter((q) => q.t < T_R - dt_s)) {
      const vExp = 10 + (SLEW / 2) * p.t * p.t;
      const xExp = 10 * p.t + (SLEW / 6) * p.t ** 3;
      expect(Math.abs(p.v - vExp)).toBeLessThanOrEqual(SLEW * dt_s * dt_s);
      expect(Math.abs(p.x - xExp)).toBeLessThanOrEqual(2.0 * dt_s * dt_s);
    }
  });

  it("after the ramp: v(t) = v1 + 2·(t − t_r) within the arrival-step quantization", () => {
    for (const p of traj.samples.filter((q) => q.t > T_R + 2 * dt_s)) {
      const vExp = V1 + 2.0 * (p.t - T_R);
      expect(Math.abs(p.v - vExp)).toBeLessThanOrEqual(KINK_QUANT + 1e-9 * vExp);
    }
  });

  it("post-ramp v(t) is EXACTLY affine with slope 2.0 (1e-9 — RK4 exact on polynomial arcs)", () => {
    const post = traj.samples.filter((q) => q.t > T_R + 2 * dt_s);
    expect(post.length).toBeGreaterThan(50);
    const a = post[0]!;
    for (const p of post) {
      // every sample lies on the line through `a` with slope exactly 2.0
      const vExp = a.v + 2.0 * (p.t - a.t);
      expect(Math.abs(p.v - vExp)).toBeLessThanOrEqual(1e-9 * Math.max(10, vExp));
    }
  });

  it("x(t) follows the piecewise closed form (kink-quantization bound)", () => {
    const xAt = (t: number): number => {
      if (t <= T_R) return 10 * t + (SLEW / 6) * t ** 3;
      const xr = 10 * T_R + (SLEW / 6) * T_R ** 3;
      return xr + V1 * (t - T_R) + (t - T_R) ** 2;
    };
    for (const p of traj.samples) {
      // one-time v quantization (≤ 7.5e-5 m/s) integrates into x drift ≤ quant·t
      const bound = 2.0 * dt_s * dt_s + KINK_QUANT * Math.max(0, p.t - T_R) + 1e-9 * Math.max(1, p.x);
      expect(Math.abs(p.x - xAt(p.t))).toBeLessThanOrEqual(bound);
    }
  });

  it("the recorded a_cmd_rate never exceeds the authored slew (P-SLEW seed)", () => {
    for (const p of traj.samples) {
      expect(Math.abs(p.a_cmd_rate)).toBeLessThanOrEqual(SLEW + 1e-9);
    }
  });
});

// ---------------------------------------------------------------------------
// F-AN-NEARUPRIGHT (09 §3.4 P-RUNWIDE-UPRIGHT third limb): |phi| = 1.9° steady,
// envelope tanh(1.9/5) ≈ 0.36 ≠ 0 — the slice contributes and its PATH effect
// is bounded by eps_m = 0.05 m against the no-slice point-mass prediction.

describe("F-AN-NEARUPRIGHT", () => {
  const LEAN = 1.9;
  const V0 = 15; // 54 km/h
  const DECEL = 2.7;
  const SLEW = A_SLEW_DEFAULT;
  const plan: ResolvedPlanAction[] = [
    { do: "turn_in", id: "t1", at_s: 10, target: { lean_deg: LEAN }, hand: "R" },
    { do: "brake", id: "b1", at_s: 30, decel: DECEL, slew_mss: SLEW }
  ];
  // Road ends at 60 m: the fixture holds 1.9° through a 30 m braked span and
  // terminates at road_end (~7.9 m/s) — before the low-speed regime where the
  // 1/v heading amplification would swamp the near-upright path bound.
  const traj = run("lane 8 | S 60", 54, plan, { use_full_width: true, start: { d: 0 } });

  it("the slice is exercised: su_sustained ≠ 0 at braking samples at lean", () => {
    const active = traj.samples.filter((p) => p.cmd_a < -2.6 && Math.abs(p.phi) > 1);
    expect(active.length).toBeGreaterThan(3);
    for (const p of active) expect(p.su_sustained).not.toBe(0);
  });

  it("lateral deviation from the no-slice point-mass prediction ≤ eps_m = 0.05 m", () => {
    // Independent fine-step twin (test-side; slice OFF): closed-form controls —
    // phi ramps to 1.9° at the street rate from the turn_in crossing, the brake
    // follows its slew ramp — and (x, y, psi) integrate the emergent-curvature
    // identity at dt/10.
    const h = dt_s / 10;
    const rollRate = degToRad(STREET_ROLL_RATE_DPS);
    const phiTgt = degToRad(LEAN);
    // anchor the twin's control onsets to the recorded activation events (the
    // bike's curved path makes its projected station lag its path length, so
    // the at_s crossings land a few ms later than at_s/V0 — a fixture-geometry
    // detail, not physics under test)
    const T_TI = traj.events.find((e) => e.kind === "turn_in")!.t;
    const T_B = traj.events.find((e) => e.kind === "brake_start")!.t;
    const phiOf = (tt: number): number =>
      tt <= T_TI ? 0 : Math.min(phiTgt, rollRate * (tt - T_TI));
    const vOf = (tt: number): number => {
      if (tt <= T_B) return V0;
      const tr = DECEL / SLEW;
      if (tt <= T_B + tr) return V0 - (SLEW / 2) * (tt - T_B) ** 2;
      const v1 = V0 - (DECEL * DECEL) / (2 * SLEW);
      return v1 - DECEL * (tt - T_B - tr);
    };
    let x = 0, y = 0, psi = 0, t = 0;
    const twin: { t: number; x: number; y: number }[] = [{ t, x, y }];
    while (vOf(t) > v_floor_ms && t < 40) {
      const step = (ps: number, tt: number) => ({
        x: vOf(tt) * Math.cos(ps),
        y: vOf(tt) * Math.sin(ps),
        psi: (G * Math.tan(phiOf(tt))) / Math.max(vOf(tt), 0.01)
      });
      const d1 = step(psi, t);
      const d2 = step(psi + (h / 2) * d1.psi, t + h / 2);
      const d3 = step(psi + (h / 2) * d2.psi, t + h / 2);
      const d4 = step(psi + h * d3.psi, t + h);
      x += (h / 6) * (d1.x + 2 * d2.x + 2 * d3.x + d4.x);
      y += (h / 6) * (d1.y + 2 * d2.y + 2 * d3.y + d4.y);
      psi += (h / 6) * (d1.psi + 2 * d2.psi + 2 * d3.psi + d4.psi);
      t += h;
      twin.push({ t, x, y });
    }
    // compare engine samples against the twin at matching times
    const devAt = (p: Sample): number => {
      let i = twin.findIndex((q) => q.t >= p.t);
      if (i < 0) i = twin.length - 1;
      const b = twin[i]!;
      const a = twin[Math.max(0, i - 1)]!;
      const alpha = b.t > a.t ? (p.t - a.t) / (b.t - a.t) : 0;
      const tx = a.x + (b.x - a.x) * alpha;
      const ty = a.y + (b.y - a.y) * alpha;
      return Math.hypot(p.x - tx, p.y - ty);
    };
    for (const p of traj.samples) {
      expect(devAt(p)).toBeLessThanOrEqual(0.05);
    }
  });

  it("never flags below_validity (|phi| = 1.9° < 2°) and terminates at road end", () => {
    expect(traj.terminated.reason).toBe("road_end");
    for (const p of traj.samples) expect(p.below_validity).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// A-AN-SAVE-POLICY — F-AN-SAVE (09 §3.2a; appended by WP-08).
//
// The corrective-shot policy (04 §4a.4) launched upright at 12 m/s on
// `lane 8 | S 40 | R 60 ^90 | S 60` (use_full_width, street, mu 1.0, entry
// 43.2 km/h). With a_cmd = 0 and no drag in Tier 1R, v is exactly constant
// through the shadow, so two closed forms are hand-computable and NORMATIVE on
// the shadow's raw pre-emission samples:
//   (1) heading turned during the roll ramp = (G/(v·roll_rate))·ln(sec φ_res)
//       (the release predicate's own closed form, 02 §3.1) to ≤ 1e-6 rad;
//   (2) the post-ramp path is a circle of radius v²/(G·tan φ_res) to ±0.01 m
//       by circle fit.
// At street / mu 1.0: φ_res = atan(0.85) = 40.364°, roll_rate = 0.87266 rad/s,
// ramp t_r = 0.807 s, and at v = 12 m/s R = 17.27 m. (The doc's descriptive
// "ramp heading = 14.605°" is its own formula evaluated loosely — the ≤ 1e-6
// bound binds the FORMULA, which gives 14.595°; asserted against the formula.)

describe("A-AN-SAVE-POLICY (F-AN-SAVE)", () => {
  const DSL = "lane 8 | S 40 | R 60 ^90 | S 60";
  const V = 12; // 43.2 km/h
  const PHI_RES = Math.atan(0.85); // street reserve at mu 1.0 (rad)
  const ROLL_RATE = degToRad(STREET_ROLL_RATE_DPS); // 0.87266 rad/s
  const TAU_ARR = PHI_RES / ROLL_RATE; // 0.807 s
  const OMEGA = (G * Math.tan(PHI_RES)) / V; // hold-phase heading rate
  const R_CIRCLE = (V * V) / (G * Math.tan(PHI_RES)); // 17.27 m

  const sc = scenario("F-AN-SAVE", DSL, 43.2, [], { use_full_width: true });
  // launch the registered lean-only rider from an upright state mid-approach
  // through the ONE counterfactual harness (horizon route: the raw-physics
  // fixture has no outward drift to satisfy the strict launch condition)
  const res = counterfactual(
    { dsl: DSL, use_full_width: true },
    {
      resolved_scenario: sc,
      sample: { t: 0, s: 10, x: 10, y: 0, psi: 0, v: V, phi: 0, f: 0.5 },
      dfds: 0,
      turn_in_before: false,
      hand: "R",
      s_detect: 10,
      s_h: 10
    },
    0,
    "lean_only_reserve",
    "horizon_bounded_return"
  );
  if (!res.ok) throw new Error(`F-AN-SAVE shadow refused: ${JSON.stringify(res.error)}`);
  const shadow = res.value.trajectory;
  const t0 = shadow.samples[0]!.t;

  it("v is EXACTLY constant through the shadow (the closed forms' premise)", () => {
    for (const p of shadow.samples) {
      expect(p.v).toBe(V);
      expect(p.a_long).toBe(0);
      expect(p.cmd_a).toBe(0);
    }
  });

  it("launches from the recorded state in the world frame (s = 10, upright, heading +x)", () => {
    const first = shadow.samples[0]!;
    expect(first.s).toBeCloseTo(10, 9);
    expect(first.x).toBeCloseTo(10, 9);
    expect(first.y).toBeCloseTo(0, 9);
    expect(first.phi).toBe(0);
  });

  it("rolls to φ_res = 40.364° at the street cap: ramp t_r = 0.807 s, slope 50°/s, no overshoot", () => {
    const phiResDeg = (PHI_RES * 180) / Math.PI;
    expect(phiResDeg).toBeCloseTo(40.364, 2);
    expect(TAU_ARR).toBeCloseTo(0.807, 2);
    const interior = shadow.samples.filter((p) => p.phi > 3 && p.phi < phiResDeg - 3);
    expect(interior.length).toBeGreaterThan(3);
    for (let i = 1; i < interior.length; i++) {
      const slope =
        (interior[i]!.phi - interior[i - 1]!.phi) / (interior[i]!.t - interior[i - 1]!.t);
      expect(Math.abs(slope - STREET_ROLL_RATE_DPS)).toBeLessThanOrEqual(0.5);
    }
    const maxPhi = Math.max(...shadow.samples.map((p) => p.phi));
    expect(maxPhi).toBeLessThanOrEqual(phiResDeg + 0.01);
    const held = shadow.samples.filter((p) => p.t - t0 >= TAU_ARR + 2 * dt_s);
    expect(held.length).toBeGreaterThan(5);
    for (const p of held) expect(Math.abs(p.phi - phiResDeg)).toBeLessThanOrEqual(0.01);
  });

  it("heading turned during the roll ramp equals (G/(v·roll_rate))·ln(sec φ_res) to ≤ 1e-6 rad", () => {
    const rampHeading = (G / (V * ROLL_RATE)) * Math.log(1 / Math.cos(PHI_RES));
    // descriptive doc pin, loose: 14.6° ± 0.02°
    expect((rampHeading * 180) / Math.PI).toBeGreaterThan(14.57);
    expect((rampHeading * 180) / Math.PI).toBeLessThan(14.62);
    // normative: every post-arrival sample's heading is the ramp closed form
    // plus the exact hold-phase rotation (post-arrival psi(t) is affine, so
    // the arc-grid lerp is exact)
    const post = shadow.samples.filter((p) => p.t - t0 >= TAU_ARR + 2 * dt_s);
    expect(post.length).toBeGreaterThan(5);
    for (const p of post) {
      const measuredRamp = degToRad(p.psi) - 0 - OMEGA * (p.t - t0 - TAU_ARR);
      expect(Math.abs(measuredRamp - rampHeading)).toBeLessThanOrEqual(1e-6);
    }
  });

  it("the post-ramp path is a circle of radius v²/(G·tan φ_res) = 17.27 m ± 0.01 by circle fit", () => {
    expect(R_CIRCLE).toBeCloseTo(17.27, 2);
    const post = shadow.samples.filter((p) => p.t - t0 >= TAU_ARR + 2 * dt_s);
    expect(post.length).toBeGreaterThan(9);
    const r = fitCircleRadius(post.map((p) => ({ x: p.x, y: p.y })));
    expect(Math.abs(r - R_CIRCLE)).toBeLessThanOrEqual(0.01);
  });

  it("terminates by the engine's own vocabulary (the reserve circle exits the carriageway laterally)", () => {
    expect(shadow.terminated.reason).toBe("off_road");
    expect(shadow.rider).toBe("lean_only_reserve");
    expect(shadow.predicate).toBe("horizon_bounded_return");
  });
});

// ---------------------------------------------------------------------------
// A-AN-SOLVER-KISS — APPENDED BY WP-10 (solver-core). The sole pre-bless solver
// assertion (f_apex ≤ KISS_TOL_F on C30 in corridor mode, ground truth re-derived
// from the road DSL — design/09 §3.2a).
// ---------------------------------------------------------------------------

describe("A-AN-SOLVER-KISS (design/09 §3.2a — the one pre-bless solver assertion)", () => {
  // C30's own `lane 3.5` road in CORRIDOR mode (NOT use_full_width — the
  // header exception): this is the one analytic-layer entry that exercises
  // corridor + lane-fraction + turn-in + apex search. The kiss band is the
  // BAND [0, KISS_TOL_F]: a correct clean apex lands anywhere in it, and a
  // solver that falls short of the inside — or reads its own stored constant
  // back — fails here before it can be blessed.
  //
  // ENGINE-TRUTH DEVIATION (pending ratification, WP-10 report): the entry is
  // 63 km/h, not 02 §8's canonical 70 — at 70 the §4.1a fit clip and the
  // 50°/s commit ramp are jointly unsatisfiable on the 35 m approach (every
  // line breaches the corridor during the roll-in; the solver refuses TYPED).
  // 63 km/h is the top of the clean band, solved by the same default
  // out-in-out pipeline this gate exists to exercise.
  it("the solved C30 apex kisses the corridor's inner edge on raw pre-emission samples", { timeout: 300_000 }, async () => {
    const { solve } = await import("../../src/solve/solve.js");
    const { KISS_TOL_F } = await import("../../src/solve/constants.js");
    const dsl = "lane 3.5 | S 35 | R 30 ^90 | S 25";
    const r = solve({ road: dsl, entry_kmh: 63 });
    expect(r.ok).toBe(true);
    if (!r.ok) return;

    // ground truth re-derived from the DSL — never read back from solved.plan
    const road = compose({ dsl });
    expect(road.ok).toBe(true);
    if (!road.ok) return;
    const c1 = road.value.corners[0]!;
    expect(c1.r).toBeCloseTo(30, 9);
    expect(c1.s0).toBeCloseTo(35, 9);

    let fApex = Number.POSITIVE_INFINITY;
    for (const s of r.value.trajectory.samples) {
      if (s.s >= c1.s0 && s.s <= c1.s1 && s.f < fApex) fApex = s.f;
    }
    expect(fApex).toBeLessThanOrEqual(KISS_TOL_F);
    expect(fApex).toBeGreaterThanOrEqual(-0.02); // a kiss, not an inside cut
  });
});
