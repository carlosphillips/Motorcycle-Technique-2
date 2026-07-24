// test/analytic/bounds.test.ts — D-BOUNDS (design/09 §3.2a step 2): the
// a-priori doctrinal bound assertions design/02 §8 states for C30, promoted to
// named tests. These are DESIGN PINS, not goldens — they exist before the
// engine does, and the bless script refuses (exit 3) unless they are green.
//
// Pins (02 §8 / 09 §3.2a): outcome contained (with quality `good` via the
// derived clean predicate — see note below); apex_pct ∈ (50, 90);
// phi_max ≤ 40.36° (the street reserve); ellipseMag ≤ 1 at every sample.
// Extended C30 exit pins (09 §3.2): a release event; |heading_err_deg| ≤ 1.0
// at the exit crossing; |phi| ≤ 0.25° at road_end; f inside the usable
// corridor at road_end.
//
// Scope note (recorded WP-04 judgment): the full `quality = good` leg needs
// the doctrine rubric (plan/doctrine, WP-06) and the outcome law assembly
// (solve/verdict, WP-09). At engine rank this file asserts the physics half of
// `clean`: terminated road_end on the carriageway with NO outward corridor
// departure (f never rises through 1 + eps_f_detect after turn-in — the
// run_wide_detect predicate can never fire), which is exactly what makes the
// outcome classify `contained`. The doctrine half attaches downstream.
//
// The authored plan below is a hand-calibrated stand-in for the solved line
// (the solver is WP-10): C30's canonical shape — brake from 70 km/h to
// ~52.7 km/h (≈ "near 50"), released before turn-in, committed turn-in, crack,
// exit roll-on. Calibrating a FIXTURE plan against design-pinned BOUNDS is
// legal; no expectation below is engine-derived.

import { describe, it, expect } from "vitest";
import { compose } from "../../src/road/compose.js";
import { integrate } from "../../src/core/integrate.js";
import { G, eps_f_detect, EPS_EXIT_DEG, EPS_UNWIND_DONE_DEG, eps_mag } from "../../src/core/constants.js";
import { phiReserve, muUse } from "../../src/core/slice.js";
import { wrapToPi } from "../../src/core/steering.js";
import { degToRad, radToDeg } from "../../src/core/units.js";
import type { ResolvedPlanAction, ResolvedScenario, SightCaster, Trajectory } from "../../src/core/types.js";

const STUB_SIGHT: SightCaster = {
  cast: (eye) => ({ sight_m: 0, limit_point: { x: eye.x, y: eye.y }, s_limit: 0 }),
  ssd: () => ({ ssd_m: 0, react_m: 0, standup_m: 0, brake_m: 0 })
};

// ---------------------------------------------------------------------------
// The canonical corner (design/02 §8): two-lane, lane_width_m 3.5,
// bike_margin_m 0.40, constant-radius right-hander R = 30 m, sweep 90°, entry
// straight 35 m, exit straight 25 m; entry 70 km/h, street, mu 1.0.

export const C30_DSL = "lane 3.5 | S 35 | R 30 ^90 | S 25";
const S0 = 35;
const S1 = 35 + 30 * degToRad(90); // 82.12
const SWEEP_DEG = 90;

const C30_PLAN: readonly ResolvedPlanAction[] = [
  { do: "brake", id: "b1", at_s: 2, decel: 4.6, slew_mss: 6 },
  { do: "throttle", id: "c1", at_s: 22, accel: 0, slew_mss: 6 }, // brake release; b_dem < 2.5 before any lean
  { do: "turn_in", id: "t1", at_s: 29.5, target: { lean_deg: 36.5 }, hand: "R" },
  { do: "throttle", id: "r1", at_s: 62, accel: 1.2, slew_mss: 6 } // exit roll-on
];

function runC30(): Trajectory {
  const composed = compose({ dsl: C30_DSL });
  if (!composed.ok) throw new Error(`C30 failed to compose: ${composed.error.message}`);
  const road = composed.value;
  const scenario: ResolvedScenario = {
    spec: "linelab/1",
    id: "C30",
    road: { lane_width_m: 3.5, bike_margin_m: 0.4, use_full_width: false, segments: [], dsl: C30_DSL },
    occluders: [],
    hazards: [],
    rider: { profile: "street", start: { speed_kmh: 70, f: 0.9 }, plan: C30_PLAN },
    config: { mu: 1.0, ds_m: 0.5, ssd_model: "alert", rubric: "parks-street", checks_version: 2 }
  };
  return integrate(scenario, { road, sight: STUB_SIGHT, occluders: [], hazards: [] });
}

const traj = runC30();

describe("D-BOUNDS — the 02 §8 a-priori C30 pins", () => {
  it("terminates at road_end on the carriageway (the contained fate's physics)", () => {
    expect(traj.terminated.reason).toBe("road_end");
  });

  it("no outward corridor departure: f never rises through 1 + eps_f_detect after turn-in", () => {
    const tTi = traj.events.find((e) => e.kind === "turn_in")!.t;
    for (const p of traj.samples.filter((q) => q.t >= tTi)) {
      expect(p.f).toBeLessThanOrEqual(1 + eps_f_detect);
    }
  });

  it("apex_pct ∈ (50, 90) — the late bar (01 §A.2 cumΔψ measure over W_c)", () => {
    const tiEv = traj.events.find((e) => e.kind === "turn_in")!;
    const inWc = traj.samples.filter((p) => p.s >= tiEv.s && p.s < S1);
    const apex = inWc.reduce((a, b) => (b.f < a.f ? b : a));
    const psiAtTi = traj.samples.find((p) => p.s >= tiEv.s)!.psi;
    const apexPct = (100 * (apex.psi - psiAtTi)) / SWEEP_DEG;
    expect(apexPct).toBeGreaterThan(50);
    expect(apexPct).toBeLessThan(90);
  });

  it("phi_max ≤ 40.36° (phiReserve at street skill 0.85, mu 1.0 — never touched)", () => {
    const reserveDeg = radToDeg(phiReserve(muUse(0.85, 1.0)));
    expect(Math.abs(reserveDeg - 40.36)).toBeLessThan(0.01); // the worked number itself
    const phiMaxRidden = Math.max(...traj.samples.map((p) => Math.abs(p.phi)));
    expect(phiMaxRidden).toBeLessThanOrEqual(reserveDeg);
  });

  it("ellipseMag ≤ 1 at every sample (grip ≥ 0 within the crash deadband)", () => {
    for (const p of traj.samples) {
      expect(p.grip).toBeGreaterThanOrEqual(-eps_mag);
    }
  });
});

describe("D-BOUNDS — C30 extended exit pins (09 §3.2)", () => {
  it("a release event exists and precedes road_end", () => {
    const rel = traj.events.find((e) => e.kind === "release");
    expect(rel).toBeDefined();
    expect(rel!.s).toBeLessThan(traj.terminated.s);
    expect(rel!.action_id).toBe("t1");
    expect(rel!.corner_id).toBe("c1");
  });

  it("|heading_err_deg| ≤ 1.0 at the exit crossing (heading capture is derived, not asserted)", () => {
    // exit = first station at/after the apex where |wrapToPi(psi − psi_exit)| ≤ EPS_EXIT_DEG
    const tiEv = traj.events.find((e) => e.kind === "turn_in")!;
    const inWc = traj.samples.filter((p) => p.s >= tiEv.s && p.s < S1);
    const apex = inWc.reduce((a, b) => (b.f < a.f ? b : a));
    const psiExit = degToRad(SWEEP_DEG);
    const exitSample = traj.samples.find(
      (p) => p.s >= apex.s && Math.abs(wrapToPi(degToRad(p.psi) - psiExit)) <= degToRad(EPS_EXIT_DEG)
    );
    expect(exitSample).toBeDefined();
    expect(exitSample!.s).toBeLessThanOrEqual(traj.terminated.s);
  });

  it("|phi| ≤ 0.25° and f inside the usable corridor at road_end", () => {
    const last = traj.samples[traj.samples.length - 1]!;
    expect(Math.abs(last.phi)).toBeLessThanOrEqual(EPS_UNWIND_DONE_DEG);
    expect(last.f).toBeGreaterThanOrEqual(0);
    expect(last.f).toBeLessThanOrEqual(1);
  });

  it("clean lines terminate upright in track (02 §3.1 figure-end guarantee)", () => {
    const last = traj.samples[traj.samples.length - 1]!;
    expect(last.steer_state).toBe("track");
    const psiEndErr = Math.abs(wrapToPi(degToRad(last.psi) - degToRad(SWEEP_DEG)));
    expect(psiEndErr).toBeLessThanOrEqual(degToRad(EPS_EXIT_DEG));
  });

  it("entry speed solves near 50 km/h (the canonical braked entry)", () => {
    const vTi = traj.samples.find((p) => p.s >= 29.5)!.v * 3.6;
    expect(vTi).toBeGreaterThan(45);
    expect(vTi).toBeLessThan(58);
  });
});

// G explicitly referenced so the identity between the fixture's speeds and the
// kappa algebra stays visible to readers of this file.
void G;
