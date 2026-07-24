// test/property/physics.test.ts — the 02 §5.4 behavioural invariants and the
// design/09 §3.4 grip/steering/run-wide property gates:
//   P-ELLIPSE, P-KAPPA, P-UNWIND-CAPTURE, P-UNWIND-NOCROSS, P-STEER-OWNER,
//   P-MIRROR, P-ROLLRATE (tracker-rescoped), P-ROLLRATE-EXCESS,
//   P-RUNWIDE-WIDEN, P-RUNWIDE-UPRIGHT (record limb; analytic limbs live in
//   test/analytic/an.test.ts), P-RUNWIDE-MONOTONE, P-TRAILBRAKE-TIGHTENS,
//   P-AWIDEN-SIGN, P-SLEW, P-SSD-LEAN, P-VALIDITY-FLAG, A-SU-ZERO-WHEN-GENTLE,
//   P-POS-AUTH, P-POS-NO-CORNER (invariant §5.4.6, the D7 guard).
//
// The invariants are the specification; the constants are servants to them
// (design/02 §5.4). All scenarios are engine-rank ResolvedScenario literals run
// through THE one stepper on composed roads.

import { describe, it, expect } from "vitest";
import { compose } from "../../src/road/compose.js";
import { integrate } from "../../src/core/integrate.js";
import {
  G,
  A_SLEW_DEFAULT,
  A_SU_ONSET,
  RATE_THRESHOLD,
  PHI_WIDEN_MIN,
  v_valid_min_ms,
  v_floor_ms,
  eps_mag,
  eps_f_detect,
  eps_deg_report,
  PHI_TRACK_AUTH_DEG,
  EPS_UNWIND_DONE_DEG,
  EPS_EXIT_DEG,
  RIDER_PROFILES,
  dt_s
} from "../../src/core/constants.js";
import { widensW, bDem, aLongAvail, PHI_VALID_MIN_DEG } from "../../src/core/slice.js";
import { wrapToPi } from "../../src/core/steering.js";
import { degToRad, radToDeg } from "../../src/core/units.js";
import { ssd } from "../../src/sight/ssd.js";
import type {
  ResolvedPlanAction,
  ResolvedScenario,
  Sample,
  SightCaster,
  Trajectory
} from "../../src/core/types.js";

// ---------------------------------------------------------------------------
// Fixture scaffolding

const STUB_SIGHT: SightCaster = {
  cast: (eye) => ({ sight_m: 0, limit_point: { x: eye.x, y: eye.y }, s_limit: 0 }),
  ssd: () => ({ ssd_m: 0, react_m: 0, standup_m: 0, brake_m: 0 })
};

interface RunOpts {
  readonly use_full_width?: boolean;
  readonly start?: { readonly f?: number; readonly d?: number };
  readonly cap_dps?: number;
}

function run(
  dsl: string,
  speed_kmh: number,
  plan: readonly ResolvedPlanAction[],
  opts: RunOpts = {}
): Trajectory {
  const composed = compose({ dsl, use_full_width: opts.use_full_width ?? false });
  if (!composed.ok) throw new Error(`fixture road failed to compose: ${composed.error.message}`);
  const road = composed.value;
  const scenario: ResolvedScenario = {
    spec: "linelab/1",
    id: "phys-fixture",
    road: {
      lane_width_m: road.lane_width_m,
      bike_margin_m: 0.4,
      use_full_width: opts.use_full_width ?? false,
      segments: [],
      dsl
    },
    occluders: [],
    hazards: [],
    rider: {
      profile: "street",
      ...(opts.cap_dps !== undefined ? { roll_rate_cap_dps: opts.cap_dps } : {}),
      start: { speed_kmh, ...(opts.start ?? { f: 1.0 }) },
      plan
    },
    config: { mu: 1.0, ds_m: 0.5, ssd_model: "alert", rubric: "parks-street", checks_version: 2 }
  };
  return integrate(scenario, { road, sight: STUB_SIGHT, occluders: [], hazards: [] });
}

const STREET_RR_DPS = RIDER_PROFILES.street.roll_rate_dps; // 50
const STREET_RR = degToRad(STREET_RR_DPS);

/** kappa of a sample recomputed from its own record (identity form). */
function kappaOfSample(p: Sample): number {
  return (G * Math.tan(degToRad(p.phi))) / Math.max(p.v, 0.01) ** 2;
}

/** Lerp a series field at station s (for matched-station twin comparisons). */
function fieldAtS(traj: Trajectory, s: number, field: "f" | "kappa" | "v"): number | null {
  const smp = traj.samples;
  for (let i = 1; i < smp.length; i++) {
    if (smp[i]!.s >= s) {
      const a = smp[i - 1]!;
      const b = smp[i]!;
      const alpha = b.s > a.s ? (s - a.s) / (b.s - a.s) : 0;
      return a[field] + (b[field] - a[field]) * alpha;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// The clean C30 (same authored fixture as test/analytic/bounds.test.ts)

const C30_DSL = "lane 3.5 | S 35 | R 30 ^90 | S 25";
const C30_PLAN: readonly ResolvedPlanAction[] = [
  { do: "brake", id: "b1", at_s: 2, decel: 4.6, slew_mss: 6 },
  { do: "throttle", id: "c1", at_s: 22, accel: 0, slew_mss: 6 },
  { do: "turn_in", id: "t1", at_s: 29.5, target: { lean_deg: 36.5 }, hand: "R" },
  { do: "throttle", id: "r1", at_s: 62, accel: 1.2, slew_mss: 6 }
];
const cleanC30 = run(C30_DSL, 70, C30_PLAN, { start: { f: 0.9 } });

// Deep-lean clipped-regime fixture (02 §5.3 headline / C30-deeplean shape):
// R30 steady state at 40° (v ≈ 15.7 m/s), commanded −9.0 held, rider fighting.
const DEEP_DSL = "lane 3.5 | S 20 | R 30 ^140 | S 30";
const DEEP_V = Math.sqrt(G * 30 * Math.tan(degToRad(40))) * 3.6; // ≈ 56.6 km/h
const DEEP_PLAN: readonly ResolvedPlanAction[] = [
  { do: "turn_in", id: "t1", at_s: 12, target: { lean_deg: 40 }, hand: "R" },
  { do: "brake", id: "b1", at_s: 45, decel: 9.0, slew_mss: 6 }
];
const deeplean = run(DEEP_DSL, DEEP_V, DEEP_PLAN, { start: { f: 0.5 } });
const deepleanTwin = run(DEEP_DSL, DEEP_V, DEEP_PLAN.filter((a) => a.do !== "brake"), {
  start: { f: 0.5 }
});

// c = 0 column: the same held brake under a steering freeze (02 §3 freeze law).
const DEEP_PLAN_FROZEN: readonly ResolvedPlanAction[] = [
  { do: "turn_in", id: "t1", at_s: 12, target: { lean_deg: 40 }, hand: "R" },
  { do: "throttle", id: "fz", at_s: 44, accel: 0, slew_mss: 6, freeze_steer_s: 3.0 },
  { do: "brake", id: "b1", at_s: 45, decel: 9.0, slew_mss: 6 }
];
const deepleanFrozen = run(DEEP_DSL, DEEP_V, DEEP_PLAN_FROZEN, { start: { f: 0.5 } });

// Chop family (invariant §5.4.3 / P-RUNWIDE-MONOTONE): steady 30° with drive,
// then a throttle cut at slew r with a 1.0 s steering freeze.
const CHOP_DSL = "lane 3.5 | S 15 | R 30 ^150 | S 30";
const CHOP_V = Math.sqrt(G * 30 * Math.tan(degToRad(30))) * 3.6; // ≈ 46.9 km/h
function chopPlan(slew: number): readonly ResolvedPlanAction[] {
  return [
    { do: "turn_in", id: "t1", at_s: 9, target: { lean_deg: 30 }, hand: "R" },
    { do: "throttle", id: "d1", at_s: 34, accel: 1.5, slew_mss: 6 },
    { do: "throttle", id: "chop", at_s: 44, accel: 0, slew_mss: slew, freeze_steer_s: 1.0 }
  ];
}
const CHOP_SLEWS = [10, 20, 40, 80] as const;
const chopRuns = new Map(CHOP_SLEWS.map((r) => [r, run(CHOP_DSL, CHOP_V, chopPlan(r), { start: { f: 0.5 } })]));
const chopTwin = run(CHOP_DSL, CHOP_V, chopPlan(10).slice(0, 2), { start: { f: 0.5 } });

// Trail-brake fixture (invariant §5.4.1): a light 1.5 m/s² taper carried past
// turn-in on the clean C30 line.
const TRAIL_PLAN: readonly ResolvedPlanAction[] = [
  { do: "brake", id: "b1", at_s: 2, decel: 4.6, slew_mss: 6 },
  { do: "throttle", id: "c1", at_s: 22, accel: 0, slew_mss: 6 },
  { do: "brake", id: "b2", at_s: 26, decel: 1.2, taper_to_s: 52, slew_mss: 6 },
  { do: "turn_in", id: "t1", at_s: 29.5, target: { lean_deg: 36.5 }, hand: "R" },
  { do: "throttle", id: "r1", at_s: 62, accel: 1.2, slew_mss: 6 }
];
const trailbrake = run(C30_DSL, 70, TRAIL_PLAN, { start: { f: 0.9 } });

// Position-channel fixture (FX-POS-STRAIGHT shape, 09 §8.1): straight road,
// 34 km/h, start f 0.2 → position to f 0.9.
const POS_DSL = "lane 3.5 | S 120";
const posRun = run(
  POS_DSL,
  34,
  [{ do: "position", id: "p1", at_s: 10, f: 0.9, over_m: 60 }],
  { start: { f: 0.2 } }
);
const posShort = run(
  POS_DSL,
  34,
  [{ do: "position", id: "p1", at_s: 10, f: 0.9, over_m: 6 }],
  { start: { f: 0.2 } }
);

// Straight-line hard stop (C30-stop shape): upright braking to the floor.
const stopRun = run("lane 3.5 | S 120", 70, [
  { do: "brake", id: "b1", at_s: 20, decel: 4.0, slew_mss: 6 }
]);

const ALL_RUNS: readonly Trajectory[] = [
  cleanC30,
  deeplean,
  deepleanTwin,
  deepleanFrozen,
  ...chopRuns.values(),
  chopTwin,
  trailbrake,
  posRun,
  posShort,
  stopRun
];

// ---------------------------------------------------------------------------
// Grip and curvature

describe("P-ELLIPSE", () => {
  it("friction-ellipse magnitude ≤ 1 + deadband at every emitted sample of every run", () => {
    for (const traj of ALL_RUNS) {
      for (const p of traj.samples) {
        expect(p.grip).toBeGreaterThanOrEqual(-eps_mag);
        // and the normalized components agree with the recorded margin
        const mag = Math.hypot(p.n_long, p.n_lat);
        expect(Math.abs(1 - mag - p.grip)).toBeLessThanOrEqual(1e-9);
      }
    }
  });
});

describe("P-KAPPA", () => {
  it("kappa = G·tan(phi)/v² at every sample above the low-speed floor", () => {
    for (const traj of ALL_RUNS) {
      for (const p of traj.samples) {
        if (p.v < v_floor_ms) continue;
        const expected = kappaOfSample(p);
        expect(Math.abs(p.kappa - expected)).toBeLessThanOrEqual(
          1e-9 * Math.max(1, Math.abs(expected))
        );
        expect(Math.abs(p.a_lat - p.v * p.v * p.kappa)).toBeLessThanOrEqual(1e-9);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Steering channel

describe("P-UNWIND-CAPTURE", () => {
  it("clean single-corner lines: release exists, exit heading captured, upright to road_end", () => {
    // engine-rank quantifier: the committed clean lines (the solver arrives at WP-10)
    for (const traj of [cleanC30, trailbrake]) {
      expect(traj.terminated.reason).toBe("road_end");
      const release = traj.events.find((e) => e.kind === "release");
      expect(release).toBeDefined();
      // exit crossing: |wrapToPi(psi − psi_exit)| ≤ EPS_EXIT_DEG at/after the apex
      const psiExit = degToRad(90);
      const exitSample = traj.samples.find(
        (p) =>
          p.s >= release!.s &&
          Math.abs(wrapToPi(degToRad(p.psi) - psiExit)) <= degToRad(EPS_EXIT_DEG)
      );
      expect(exitSample).toBeDefined();
      // After the unwind→track handoff the tracker levels the last fraction of
      // a degree WITHIN ITS AUTHORITY (02 §3.1: "the tracker levels the last
      // fraction of a degree and holds") — so post-handoff lean stays under the
      // tracker cap, and the figure-end guarantee |phi| ≤ EPS_UNWIND_DONE_DEG
      // is asserted over the final approach to road_end.
      const firstTrack = traj.samples.findIndex(
        (p) => p.t > release!.t && p.steer_state === "track"
      );
      expect(firstTrack).toBeGreaterThan(0);
      for (const p of traj.samples.slice(firstTrack)) {
        expect(Math.abs(p.phi)).toBeLessThanOrEqual(PHI_TRACK_AUTH_DEG + eps_deg_report);
      }
      const tail = traj.samples.filter((p) => p.s >= traj.terminated.s - 5);
      expect(tail.length).toBeGreaterThan(2);
      for (const p of tail) {
        expect(Math.abs(p.phi)).toBeLessThanOrEqual(EPS_UNWIND_DONE_DEG + eps_deg_report);
      }
    }
  });
});

describe("P-UNWIND-NOCROSS", () => {
  it("after release, sign(phi) never flips before the unwind→track handoff", () => {
    for (const traj of [cleanC30, trailbrake]) {
      const unwinding = traj.samples.filter((p) => p.steer_state === "unwind");
      expect(unwinding.length).toBeGreaterThan(0);
      for (const p of unwinding) {
        expect(p.phi).toBeGreaterThanOrEqual(-eps_deg_report); // right-hander: phi ≥ 0 through unwind
      }
      // monotone approach to upright
      for (let i = 1; i < unwinding.length; i++) {
        expect(unwinding[i]!.phi).toBeLessThanOrEqual(unwinding[i - 1]!.phi + 1e-6);
      }
    }
  });
});

describe("P-STEER-OWNER", () => {
  it("exactly one steering owner per sample; steer_state consistent with lat_action_id", () => {
    for (const traj of ALL_RUNS) {
      // position_complete → the completed-position hold carries the action id in track
      const completeT = traj.events.find((e) => e.kind === "position_complete")?.t;
      for (const p of traj.samples) {
        expect(["track", "commit", "unwind", "position"]).toContain(p.steer_state);
        if (p.steer_state === "commit") {
          expect(p.lat_action_id).not.toBeNull();
        } else if (p.steer_state === "position") {
          expect(p.lat_action_id).not.toBeNull();
        } else if (p.steer_state === "unwind") {
          expect(p.lat_action_id).toBeNull();
        } else {
          // track: null outside a completed-position hold
          if (completeT === undefined || p.t < completeT) {
            expect(p.lat_action_id).toBeNull();
          } else {
            expect(p.lat_action_id).not.toBeNull();
          }
        }
      }
    }
  });
});

describe("P-MIRROR", () => {
  it("the hand-mirrored world rides the reflected trajectory exactly", () => {
    // authored without raw world-frame values, symmetric corridor (use_full_width)
    const dslR = "lane 8 | S 10 | R 30 ^90 | S 20";
    const dslL = "lane 8 | S 10 | L 30 ^90 | S 20";
    const planOf = (hand: "L" | "R"): readonly ResolvedPlanAction[] => [
      { do: "brake", id: "b1", at_s: 2, decel: 2.0, slew_mss: 6 },
      { do: "throttle", id: "c1", at_s: 6, accel: 0, slew_mss: 6 },
      { do: "turn_in", id: "t1", at_s: 8, target: { lean_deg: 28 }, hand },
      { do: "throttle", id: "r1", at_s: 40, accel: 1.0, slew_mss: 6 }
    ];
    const right = run(dslR, 48, planOf("R"), { use_full_width: true, start: { f: 0.5 } });
    const left = run(dslL, 48, planOf("L"), { use_full_width: true, start: { f: 0.5 } });

    // IEEE equality (0 === −0) — the record normalizes −0 to 0, so a mirrored
    // zero must not be compared with Object.is.
    const eq = (a: number, b: number): void => {
      if (!(a === b)) expect(a).toBe(b);
    };
    expect(left.samples.length).toBe(right.samples.length);
    for (let i = 0; i < right.samples.length; i++) {
      const r = right.samples[i]!;
      const l = left.samples[i]!;
      eq(l.s, r.s);
      eq(l.t, r.t);
      eq(l.v, r.v);
      eq(l.f, r.f);
      eq(l.grip, r.grip);
      eq(l.x, r.x);
      eq(l.y, -r.y);
      eq(l.phi, -r.phi);
      eq(l.psi, -r.psi);
      eq(l.d, -r.d);
      expect(l.steer_state).toBe(r.steer_state);
    }
    expect(left.events.map((e) => [e.kind, e.s, e.t])).toEqual(
      right.events.map((e) => [e.kind, e.s, e.t])
    );
    expect(left.terminated.reason).toBe(right.terminated.reason);
    eq(left.terminated.x, right.terminated.x);
    eq(left.terminated.y, -right.terminated.y);
  });
});

// ---------------------------------------------------------------------------
// Run-wide slice

/** Realized phi_dot between adjacent samples, deg/s, with the bracket pair. */
function phiDotPairs(traj: Trajectory): { fd: number; a: Sample; b: Sample }[] {
  const out: { fd: number; a: Sample; b: Sample }[] = [];
  for (let i = 1; i < traj.samples.length; i++) {
    const a = traj.samples[i - 1]!;
    const b = traj.samples[i]!;
    if (b.t - a.t < 1e-9) continue;
    out.push({ fd: (b.phi - a.phi) / (b.t - a.t), a, b });
  }
  return out;
}

describe("P-ROLLRATE (tracker-rescoped)", () => {
  it("|phi_dot − phi_dot_su| ≤ roll_rate + tol at every non-transient bracket", () => {
    // The design rescopes the cap property to the tracker component (09 §3.2:
    // C30-chop "passes P-ROLLRATE by design — the cap property is scoped to the
    // tracker component"): brackets containing a super-threshold command drop
    // carry the transient impulse, whose sub-bracket time profile the 0.5 m
    // record cannot reconstruct — those brackets belong to P-ROLLRATE-EXCESS.
    for (const traj of ALL_RUNS) {
      for (const { fd, a, b } of phiDotPairs(traj)) {
        const bracketRate = (b.cmd_a - a.cmd_a) / (b.t - a.t);
        const transient =
          bracketRate < -RATE_THRESHOLD ||
          -a.a_cmd_rate > RATE_THRESHOLD ||
          -b.a_cmd_rate > RATE_THRESHOLD;
        if (transient) continue;
        const suAvg = (a.su_sustained + a.su_transient + b.su_sustained + b.su_transient) / 2;
        const tol = 3 + 0.15 * Math.abs(suAvg); // discretization slack on the recorded channel
        expect(Math.abs(fd - suAvg)).toBeLessThanOrEqual(STREET_RR_DPS + tol);
      }
    }
  });
});

describe("P-ROLLRATE-EXCESS", () => {
  it("the cap is exceeded only during stand-up events — and the chop exercises it", () => {
    let witnessed = false;
    for (const traj of ALL_RUNS) {
      for (const { fd, a, b } of phiDotPairs(traj)) {
        if (Math.abs(fd) > STREET_RR_DPS + 4) {
          const suActive =
            a.su_sustained !== 0 || a.su_transient !== 0 || b.su_sustained !== 0 || b.su_transient !== 0;
          expect(suActive).toBe(true);
          witnessed = true;
        }
      }
    }
    // ≥ 1 such sample exists (C30-chop shape) — the property is exercised, not vacuous
    expect(witnessed).toBe(true);
  });

  it("the r = 40 chop sheds lean faster than the roll-rate cap with su ≠ 0", () => {
    const traj = chopRuns.get(40)!;
    const excess = phiDotPairs(traj).filter(
      ({ fd, a, b }) =>
        Math.abs(fd) > STREET_RR_DPS + 4 &&
        (a.su_transient !== 0 || b.su_transient !== 0)
    );
    expect(excess.length).toBeGreaterThan(0);
  });
});

describe("P-RUNWIDE-WIDEN (invariant §5.4.2, clipped regime, c = 1 and c = 0)", () => {
  function widenAssertions(traj: Trajectory, c: 0 | 1): void {
    // premise: (W) holds, |phi| ≥ PHI_WIDEN_MIN, v ≥ v_valid_min_ms
    const window = traj.samples.filter(
      (p) =>
        Math.abs(p.phi) >= PHI_WIDEN_MIN &&
        p.v >= v_valid_min_ms &&
        widensW(degToRad(p.phi), p.v, bDem(p.cmd_a, p.mu), c, STREET_RR, p.mu)
    );
    expect(window.length).toBeGreaterThan(5); // premise reachable — not vacuous
    // d|kappa|/dt ≤ 0 within tolerance while (W) holds — the path itself opens
    for (let i = 1; i < window.length; i++) {
      const prev = Math.abs(window[i - 1]!.kappa);
      const cur = Math.abs(window[i]!.kappa);
      expect(cur).toBeLessThanOrEqual(prev * (1 + 1e-3) + 1e-5);
    }
    // no crash (ellipseMag rides ≤ 1)
    expect(traj.terminated.reason).not.toBe("crash");
  }

  it("held −9.0 at 40°/15.7 m/s (fighting rider, c = 1): the path opens, no crash", () => {
    widenAssertions(deeplean, 1);
    // the clipped deep-lean regime is real: clipped = true at |phi| ≥ 30 with a
    // positive refused-demand gap, and the sustained term pushes toward upright
    const clipped = deeplean.samples.filter((p) => p.clipped && Math.abs(p.phi) >= 30);
    expect(clipped.length).toBeGreaterThan(3);
    for (const p of clipped) {
      expect(bDem(p.cmd_a, p.mu)).toBeGreaterThan(Math.abs(p.a_long));
      expect(p.su_sustained).toBeLessThan(0); // right lean: pushes toward upright
    }
    // the stand-up produces an outward excursion after onset (run-wide mechanism)
    const onset = deeplean.events.find((e) => e.kind === "brake_start")!;
    const post = deeplean.samples.filter((p) => p.s >= onset.s);
    const fMaxPost = Math.max(...post.map((p) => p.f));
    expect(fMaxPost).toBeGreaterThan(post[0]!.f + 0.05);
  });

  it("the frozen rider (c = 0) widens under the same hold", () => {
    widenAssertions(deepleanFrozen, 0);
  });

  it("path-level: never tighter than the unperturbed (no-slice) twin from onset", () => {
    // "Unperturbed twin" = the same braked run WITHOUT the slice perturbation
    // (phi_dot_su ≡ 0): a fighting rider then simply HOLDS 40° while the clip
    // delivers the constant aLongAvail(40°) decel — closed-form, no slice-off
    // engine needed (the §5.4.4 pattern). The slice can only stand the bike up,
    // so from the (W) onset the ridden curvature never exceeds the no-slice
    // twin's G·tan(40°)/v_twin(t)².
    const window = deeplean.samples.filter(
      (p) =>
        Math.abs(p.phi) >= PHI_WIDEN_MIN &&
        p.v >= v_valid_min_ms &&
        widensW(degToRad(p.phi), p.v, bDem(p.cmd_a, p.mu), 1, STREET_RR, p.mu)
    );
    expect(window.length).toBeGreaterThan(5);
    const t0 = window[0]!.t;
    const v0 = window[0]!.v;
    const phi40 = degToRad(40);
    const bDel40 = aLongAvail(G * Math.tan(phi40), 1.0); // ≈ 5.34 m/s² (clipped)
    for (const p of window) {
      const vTwin = Math.max(v0 - bDel40 * (p.t - t0), v_floor_ms);
      const kappaTwin = (G * Math.tan(phi40)) / (vTwin * vTwin);
      expect(Math.abs(p.kappa)).toBeLessThanOrEqual(kappaTwin * (1 + 1e-2) + 1e-4);
    }
    // sanity on the unbraked twin fixture: it rides the steady 40° circle at
    // the fixture's entry speed through the window's stations (slice dormant)
    const steadyKappa = fieldAtS(deepleanTwin, window[0]!.s, "kappa");
    expect(steadyKappa).not.toBeNull();
    const vSteady = DEEP_V / 3.6;
    const kappaSteady = (G * Math.tan(phi40)) / (vSteady * vSteady);
    expect(Math.abs(steadyKappa! - kappaSteady)).toBeLessThanOrEqual(0.05 * kappaSteady);
  });
});

describe("P-TRAILBRAKE-TIGHTENS (invariant §5.4.1)", () => {
  it("light trail braking at lean: phi_dot_su ≡ 0 and the line is at-or-tighter than the unbraked twin", () => {
    // sub-threshold AT LEAN: b_dem ≤ A_SU_ONSET wherever phi ≠ 0 (the upright
    // entry brake may demand more — upright immunity keeps su exactly 0 there)
    for (const p of trailbrake.samples) {
      if (p.phi !== 0) expect(bDem(p.cmd_a, p.mu)).toBeLessThanOrEqual(A_SU_ONSET + 1e-9);
      expect(p.su_sustained).toBe(0);
      expect(p.su_transient).toBe(0);
    }
    // tightens: within the trail-braked corner span the braked line's curvature
    // is at-or-above the clean line's at matched stations
    const span = trailbrake.samples.filter(
      (p) => p.s > 36 && p.s < 55 && p.cmd_a < -0.5 && Math.abs(p.phi) > PHI_WIDEN_MIN
    );
    expect(span.length).toBeGreaterThan(5);
    for (const p of span) {
      const cleanKappa = fieldAtS(cleanC30, p.s, "kappa");
      if (cleanKappa === null) continue;
      expect(Math.abs(p.kappa)).toBeGreaterThanOrEqual(Math.abs(cleanKappa) - 1e-4);
    }
  });
});

describe("P-RUNWIDE-UPRIGHT (record limb)", () => {
  it("upright braking: phi ≡ 0 and both su channels exactly 0.0 (analytic path limbs in an.test.ts)", () => {
    for (const p of stopRun.samples) {
      expect(p.phi).toBe(0);
      expect(p.su_sustained).toBe(0);
      expect(p.su_transient).toBe(0);
    }
    expect(stopRun.terminated.reason).toBe("stopped");
  });
});

describe("P-RUNWIDE-MONOTONE", () => {
  it("lean shed and lateral deviation are monotone non-decreasing in chop slew r ∈ {10, 20, 40, 80}", () => {
    const shed: number[] = [];
    const dev: number[] = [];
    const terminal: number[] = [];
    // common measurement station: before the earliest termination
    const sStar = Math.min(...[...chopRuns.values(), chopTwin].map((t) => t.terminated.s)) - 2;
    for (const r of CHOP_SLEWS) {
      const traj = chopRuns.get(r)!;
      const chopEv = traj.events.filter((e) => e.kind === "crack");
      expect(chopEv.length).toBeGreaterThan(0); // the cut activated
      const t0 = chopEv[chopEv.length - 1]!.t;
      const windowSamples = traj.samples.filter((p) => p.t >= t0 && p.t <= t0 + 1.0);
      const pre = traj.samples.filter((p) => p.t < t0);
      expect(pre.length).toBeGreaterThan(0);
      const phiAtChop = pre[pre.length - 1]!.phi;
      const minPhi = Math.min(...windowSamples.map((p) => p.phi));
      shed.push(phiAtChop - minPhi);
      const fHere = fieldAtS(traj, sStar, "f");
      const fTwin = fieldAtS(chopTwin, sStar, "f");
      expect(fHere).not.toBeNull();
      expect(fTwin).not.toBeNull();
      dev.push(fHere! - fTwin!);
      terminal.push(traj.terminated.s);
    }
    for (let i = 1; i < shed.length; i++) {
      expect(shed[i]!).toBeGreaterThanOrEqual(shed[i - 1]! - 0.05);
      expect(shed[i]!).toBeGreaterThan(0);
      expect(dev[i]!).toBeGreaterThanOrEqual(dev[i - 1]! - 0.005);
      // harder chop departs the road no later (the run-wide class arrives sooner)
      expect(terminal[i]!).toBeLessThanOrEqual(terminal[i - 1]! + 0.5);
    }
    // severity is graded, not binary: the r = 80 shed is materially larger than r = 10's
    expect(shed[shed.length - 1]!).toBeGreaterThan(shed[0]! + 1.0);
  });
});

describe("P-AWIDEN-SIGN", () => {
  it("the sign of d(ln kappa)/dt matches the widening algebra from the recorded series", () => {
    for (const traj of [deeplean, deepleanFrozen, trailbrake, ...chopRuns.values()]) {
      for (let i = 1; i < traj.samples.length; i++) {
        const a = traj.samples[i - 1]!;
        const b = traj.samples[i]!;
        const dt = b.t - a.t;
        if (dt < 1e-9) continue;
        const phiMid = degToRad((a.phi + b.phi) / 2);
        const vMid = (a.v + b.v) / 2;
        if (Math.abs(radToDeg(phiMid)) < 5 || vMid < v_floor_ms) continue;
        if (Math.abs(a.kappa) < 1e-6 || Math.abs(b.kappa) < 1e-6) continue;
        const lhs = (Math.log(Math.abs(b.kappa)) - Math.log(Math.abs(a.kappa))) / dt;
        const phiDot = degToRad((b.phi - a.phi) / dt);
        const aLongMid = (a.a_long + b.a_long) / 2;
        const rhs =
          (phiDot * Math.sign(phiMid)) / (Math.sin(Math.abs(phiMid)) * Math.cos(phiMid)) -
          (2 * aLongMid) / vMid;
        if (Math.abs(rhs) < 0.05) continue; // deadband around the boundary
        expect(Math.sign(lhs)).toBe(Math.sign(rhs));
      }
    }
  });
});

describe("P-SLEW", () => {
  it("recorded |a_cmd_rate| never exceeds the active action's slew_mss", () => {
    const slewOf = new Map<string, number>();
    for (const plan of [C30_PLAN, DEEP_PLAN, DEEP_PLAN_FROZEN, TRAIL_PLAN, chopPlan(10), chopPlan(20), chopPlan(40), chopPlan(80)]) {
      for (const a of plan) {
        if (a.do === "brake" || a.do === "throttle") slewOf.set(a.id, a.slew_mss);
      }
    }
    for (const traj of ALL_RUNS) {
      for (let i = 0; i < traj.samples.length; i++) {
        const p = traj.samples[i]!;
        // activation brackets smear rate/action attribution across the handoff
        // (action_id holds the left value while the rate lerps into the new
        // action's ramp) — the cap in force is the larger of the neighbours'.
        const capOf = (q: Sample | undefined): number =>
          q !== undefined && q.action_id !== null
            ? slewOf.get(q.action_id) ?? A_SLEW_DEFAULT
            : A_SLEW_DEFAULT;
        const cap = Math.max(capOf(p), capOf(traj.samples[i - 1]), capOf(traj.samples[i + 1]));
        expect(Math.abs(p.a_cmd_rate)).toBeLessThanOrEqual(cap + 1e-9);
      }
    }
  });

  it("the command reaches its target level within Δa/slew + dt", () => {
    const onset = cleanC30.events.find((e) => e.kind === "brake_start")!;
    const reached = cleanC30.samples.find((p) => p.t > onset.t && Math.abs(p.cmd_a - -4.6) < 1e-9);
    expect(reached).toBeDefined();
    expect(reached!.t - onset.t).toBeLessThanOrEqual(4.6 / 6 + dt_s + 0.04 /* one retained bracket */);
  });

  it("brake_end bookmarks the command's return to zero (release via the crack)", () => {
    const end = cleanC30.events.find((e) => e.kind === "brake_end");
    expect(end).toBeDefined();
    expect(end!.action_id).toBe("b1");
    // release starts at the crack (s = 22); the slew ramp closes the 4.6 m/s²
    // gap over ≈ 0.77 s ≈ 12 m — sub-threshold (< A_SU_ONSET) before turn-in,
    // fully zero early in the corner
    expect(end!.s).toBeGreaterThan(22);
    expect(end!.s).toBeLessThan(40);
    // a held-to-termination brake has NO brake_end (nothing ever releases)
    expect(stopRun.events.some((e) => e.kind === "brake_end")).toBe(false);
  });
});

describe("P-SSD-LEAN", () => {
  const street = RIDER_PROFILES.street;
  it("ssd_m is monotone non-decreasing in |phi| at fixed v; upright equals the carried formula; continuous at 0", () => {
    const v = 13;
    let prev = -Infinity;
    for (const phiDeg of [0, 2, 5, 10, 15, 20, 25, 28, 32, 36, 40]) {
      const { ssd_m } = ssd(v, degToRad(phiDeg), "alert", street, 1.0);
      expect(ssd_m).toBeGreaterThanOrEqual(prev - 1e-12);
      prev = ssd_m;
    }
    // upright reduction: react + v²/(2·a_ssd), alert model
    const upright = ssd(v, 0, "alert", street, 1.0);
    expect(upright.standup_m).toBe(0);
    expect(Math.abs(upright.ssd_m - (upright.react_m + upright.brake_m))).toBeLessThanOrEqual(1e-12);
    // continuity at 0
    const near = ssd(v, degToRad(0.01), "alert", street, 1.0);
    expect(Math.abs(near.ssd_m - upright.ssd_m)).toBeLessThanOrEqual(0.05);
  });
});

describe("P-VALIDITY-FLAG", () => {
  it("below_validity ⇔ v < v_valid_min_ms ∧ |phi| ≥ 2°, up to one resample bracket", () => {
    let flagged = 0;
    for (const traj of ALL_RUNS) {
      for (let i = 0; i < traj.samples.length; i++) {
        const p = traj.samples[i]!;
        if (p.below_validity) {
          flagged++;
          // flag ⇒ the predicate held within the bracket (lerp slack on v/phi)
          expect(p.v).toBeLessThanOrEqual(v_valid_min_ms + 0.5);
          expect(Math.abs(p.phi)).toBeGreaterThanOrEqual(PHI_VALID_MIN_DEG - 0.5);
        } else {
          // strict interior counterexample: predicate deep-true at BOTH neighbours ⇒ must flag
          const prev = traj.samples[i - 1];
          const next = traj.samples[i + 1];
          const deepTrue = (q: Sample | undefined): boolean =>
            q !== undefined && q.v < v_valid_min_ms - 0.3 && Math.abs(q.phi) >= PHI_VALID_MIN_DEG + 0.3;
          if (deepTrue(prev) && deepTrue(p) && deepTrue(next)) {
            expect.fail(`sample at s=${p.s} deep inside the validity band is unflagged`);
          }
        }
      }
    }
    // the band is exercised (deep-lean decay passes through it leaned)
    expect(flagged).toBeGreaterThan(0);
    // straight-line stops never flag (upright immunity of the band)
    for (const p of stopRun.samples) expect(p.below_validity).toBe(false);
  });
});

describe("A-SU-ZERO-WHEN-GENTLE", () => {
  it("the clean C30 records su_sustained = su_transient = 0.0 exactly at every sample", () => {
    for (const p of cleanC30.samples) {
      expect(p.su_sustained).toBe(0);
      expect(p.su_transient).toBe(0);
      expect(Object.is(p.su_sustained, -0)).toBe(false);
      expect(Object.is(p.su_transient, -0)).toBe(false);
    }
    // the invariant's premise is real: gentle means sub-threshold everywhere
    for (const p of cleanC30.samples) {
      expect(bDem(p.cmd_a, p.mu) <= A_SU_ONSET || Math.abs(p.phi) === 0).toBe(true);
      expect(-p.a_cmd_rate).toBeLessThanOrEqual(RATE_THRESHOLD);
    }
  });
});

// ---------------------------------------------------------------------------
// The D7 guard (invariant §5.4.6) and the position channel

describe("P-POS-AUTH", () => {
  it("|cmd_lean| ≤ PHI_TRACK_AUTH_DEG + eps_deg_report whenever track/position owns the channel", () => {
    for (const traj of ALL_RUNS) {
      for (let i = 0; i < traj.samples.length; i++) {
        const p = traj.samples[i]!;
        if (p.steer_state !== "track" && p.steer_state !== "position") continue;
        // skip owner-transition brackets: cmd_lean lerps across the bracket
        // (05 §3.2 angle rule) while steer_state holds the left value, so a
        // sample straddling a track→commit handoff carries a smeared setpoint
        const prev = traj.samples[i - 1];
        const next = traj.samples[i + 1];
        if (prev !== undefined && prev.steer_state !== p.steer_state) continue;
        if (next !== undefined && next.steer_state !== p.steer_state) continue;
        expect(Math.abs(p.cmd_lean)).toBeLessThanOrEqual(PHI_TRACK_AUTH_DEG + eps_deg_report);
      }
    }
  });
});

describe("P-POS-NO-CORNER", () => {
  it("a plan with no turn_in cannot corner: the tracker saturates and the bike runs off", () => {
    const traj = run("lane 3.5 | S 12 | L 12 ^90 | S 16", 34, []);
    expect(traj.terminated.reason).toBe("off_road");
    // the run-off happens at/after the corner, not on the approach
    expect(traj.terminated.s).toBeGreaterThan(12 - 1);
    // and the tracker's authority stayed capped the whole way (D7: no hidden path-follower)
    for (const p of traj.samples) {
      expect(Math.abs(p.cmd_lean)).toBeLessThanOrEqual(PHI_TRACK_AUTH_DEG + eps_deg_report);
    }
  });
});

describe("position channel (02 §3.1 completion law)", () => {
  it("position_start and position_complete fire; the tracker converges and then HOLDS f", () => {
    const start = posRun.events.find((e) => e.kind === "position_start");
    const complete = posRun.events.find((e) => e.kind === "position_complete");
    expect(start?.action_id).toBe("p1");
    expect(complete?.action_id).toBe("p1");
    expect(complete!.t).toBeGreaterThan(start!.t);
    // completion: within the window, converged to the target
    expect(complete!.s).toBeLessThanOrEqual(10 + 60);
    const after = posRun.samples.filter((p) => p.t >= complete!.t);
    expect(after.length).toBeGreaterThan(3);
    for (const p of after) {
      expect(Math.abs(p.f - 0.9)).toBeLessThanOrEqual(0.05);
      expect(p.steer_state).toBe("track");
      expect(p.lat_action_id).toBe("p1"); // the completed-position hold
    }
    expect(posRun.events.some((e) => e.kind === "position_shortfall")).toBe(false);
  });

  it("an unreachable completion budget emits position_shortfall (typed, never silent) and keeps converging", () => {
    const shortfall = posShort.events.find((e) => e.kind === "position_shortfall");
    expect(shortfall).toBeDefined();
    expect(shortfall!.action_id).toBe("p1");
    const detail = shortfall!.detail as { target_f: number; achieved_f: number; deficit_m: number };
    expect(detail.target_f).toBe(0.9);
    expect(detail.deficit_m).toBeGreaterThan(0);
    // the tracker keeps converging after the budget (over_m is not a switch-off)
    const last = posShort.samples[posShort.samples.length - 1]!;
    expect(Math.abs(last.f - 0.9)).toBeLessThanOrEqual(0.05);
  });
});

describe("steering_complete on a commit→commit supersession flip (signed measure)", () => {
  // Zero-gap R→L esses at the F-AN-CIRCLE steady lean/speed pairing: t2
  // supersedes t1 mid-corner while the bike still carries the full +25° right
  // lean. 01 §A.2's UNSIGNED letter (`|phi| ≥ 0.9·phi_c`) would fire t2's
  // steering_complete at the supersession step itself — leaned the WRONG way —
  // corrupting dt_steer/steer_share for the second corner of every chained
  // fixture. The engine's recorded deviation measures progress SIGNED toward
  // the NEW commitment's hand: handSign(hand)·phi ≥ 0.9·phi_c.
  const ESSES_DSL = "lane 8 | S 30 | R 30 ^60 | L 30 ^60 | S 30";
  const ESSES_V = Math.sqrt(G * 30 * Math.tan(degToRad(25))) * 3.6; // ≈ 42.17 km/h
  const ESSES_PLAN: readonly ResolvedPlanAction[] = [
    { do: "turn_in", id: "t1", at_s: 24, target: { lean_deg: 25 }, hand: "R" },
    { do: "turn_in", id: "t2", at_s: 48, target: { lean_deg: 25 }, hand: "L" }
  ];
  const flip = run(ESSES_DSL, ESSES_V, ESSES_PLAN, { use_full_width: true, start: { d: 0 } });

  it("t2 supersedes t1 while the bike still carries the OLD hand's lean", () => {
    const ti2 = flip.events.find((e) => e.kind === "turn_in" && e.action_id === "t2");
    expect(ti2).toBeDefined();
    // t1 never released before the flip — supersession, not release+re-commit
    const release1 = flip.events.find((e) => e.kind === "release" && e.action_id === "t1");
    expect(release1).toBeUndefined();
    // at the supersession step the bike is still leaned ~+25° (the old hand)
    const atFlip = flip.samples.find((p) => p.t >= ti2!.t)!;
    expect(atFlip.phi).toBeGreaterThan(20);
  });

  it("t2's steering_complete waits for 0.9·phi_c of NEW-hand lean, not the instant |phi| misfire", () => {
    const ti2 = flip.events.find((e) => e.kind === "turn_in" && e.action_id === "t2")!;
    const sc2 = flip.events.find((e) => e.kind === "steering_complete" && e.action_id === "t2");
    expect(sc2).toBeDefined();
    const dt_steer = sc2!.t - ti2.t;
    // roll +25° → −22.5° at the street 50°/s rate ≈ 0.95 s; the unsigned
    // measure fires within one control step (≤ dt_s) of the supersession
    expect(dt_steer).toBeGreaterThan(0.8);
    expect(dt_steer).toBeLessThan(1.2);
    // and at the event the bike is genuinely leaned the NEW hand's way
    const atSc = flip.samples.find((p) => p.t >= sc2!.t)!;
    expect(atSc.phi).toBeLessThanOrEqual(-0.9 * 25 + 0.5);
  });

  it("the signed and unsigned measures agree on the non-flip first commitment", () => {
    const ti1 = flip.events.find((e) => e.kind === "turn_in" && e.action_id === "t1")!;
    const sc1 = flip.events.find((e) => e.kind === "steering_complete" && e.action_id === "t1");
    expect(sc1).toBeDefined();
    // roll 0 → +22.5° at 50°/s ≈ 0.45 s (small tracker pre-lean tolerated)
    const dt_steer = sc1!.t - ti1.t;
    expect(dt_steer).toBeGreaterThan(0.3);
    expect(dt_steer).toBeLessThan(0.6);
  });
});
