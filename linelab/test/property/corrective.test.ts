// test/property/corrective.test.ts — the D42 counterfactual layer gates
// (ARCHITECTURE §7): P-CF-PRECONDITION, P-CF-LITERALISED,
// P-COUNTERFACTUAL-CLOSED/NAMED, A-CF-REGISTRY-CLOSED, A-CF-DEAD-REASON,
// P-CORR-PURE, P-CORR-SHADOW-HONEST, P-CORR-CONSTANT-SPEED,
// P-ENDPOINT-IN-FRAME.
//
// Teaching notes: the corrective shot is the machinery that decides wide vs
// runoff (design/04 §4a). A line that drifts OUTWARD past the usable corridor
// fires run_wide_detect; one reaction time later a fixed-policy shadow — the
// registered lean-only rider under return_after_detect — asks "could a calm
// roll to phiReserve with the throttle closed have stayed on the road?".
// Feasible → wide; not → runoff. The shadow is branched DATA (the drawn line
// never bends back), its rider is disclosed on every out-of-hash surface, and
// its physics is pinned by P-CORR-CONSTANT-SPEED: with a_cmd = 0 and no drag,
// v is EXACTLY constant — the fact that made `shadow_stopped` a dead error
// name (deleted by D42; A-CF-DEAD-REASON greps for its absence).

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { compose } from "../../src/road/compose.js";
import { integrate } from "../../src/core/integrate.js";
import type {
  ResolvedPlanAction,
  ResolvedScenario,
  SightCaster,
  Trajectory,
  World
} from "../../src/core/types.js";
import type { ComposedRoad } from "../../src/road/types.js";
import {
  COUNTERFACTUAL_RIDERS,
  CF_PREDICATES,
  CF_RIDER_REGISTRY,
  CF_PREDICATE_REGISTRY,
  CF_REFUSAL_REASONS,
  CF_DISCLOSURE_LEAN_ONLY,
  counterfactual
} from "../../src/solve/counterfactual.js";
import type { CfLaunchState } from "../../src/solve/counterfactual.js";
import {
  CORRECTIVE_BINDING,
  CORRECTIVE_FAIL_REASONS,
  correctiveShot,
  runWideDetect,
  wideVsRunoff
} from "../../src/solve/corrective.js";
import { F_DETECT, F_SAVE, eps_f_detect, eps_f_save } from "../../src/solve/constants.js";

// ---------------------------------------------------------------------------
// Fixture scaffolding (engine-rank ResolvedScenario literals — no validate)

const STUB_SIGHT: SightCaster = {
  cast: (eye) => ({ sight_m: 0, limit_point: { x: eye.x, y: eye.y }, s_limit: 0 }),
  ssd: () => ({ ssd_m: 0, react_m: 0, standup_m: 0, brake_m: 0 })
};

function road(dsl: string): ComposedRoad {
  const composed = compose({ dsl });
  if (!composed.ok) throw new Error(`fixture road failed to compose: ${composed.error.message}`);
  return composed.value;
}

function scenario(
  id: string,
  dsl: string,
  speed_kmh: number,
  plan: readonly ResolvedPlanAction[],
  startF = 0.5
): ResolvedScenario {
  return {
    spec: "linelab/1",
    id,
    road: {
      lane_width_m: Number(dsl.match(/lane\s+([\d.]+)/)?.[1] ?? 3.5),
      bike_margin_m: 0.4,
      use_full_width: false,
      segments: [],
      dsl
    },
    occluders: [],
    hazards: [],
    rider: { profile: "street", start: { speed_kmh, f: startF }, plan },
    config: { mu: 1.0, ds_m: 0.5, ssd_model: "alert", rubric: "parks-street", checks_version: 2 }
  };
}

function ride(sc: ResolvedScenario): Trajectory {
  const r = road(sc.road.dsl);
  const world: World = { road: r, sight: STUB_SIGHT, occluders: [], hazards: [] };
  return integrate(sc, world);
}

function unwrap<T, E>(r: { ok: true; value: T } | { ok: false; error: E }): T {
  if (!r.ok) throw new Error(`expected ok, got error: ${JSON.stringify(r.error)}`);
  return r.value;
}

function unwrapErr<T, E>(r: { ok: true; value: T } | { ok: false; error: E }): E {
  if (r.ok) throw new Error("expected an error, got ok");
  return r.error;
}

// ---------------------------------------------------------------------------
// The two teaching fixtures.
//
// WIDE: a right-hander with the rider's own lane as corridor — beyond the
// outer usable edge lies the oncoming lane, ≈ 5.4 m of pavement before the
// physical edge. An under-leaned turn-in drifts outward slowly enough that a
// reaction is possible: the shadow returns → `wide`.
const WIDE_DSL = "lane 5 | S 20 | R 20 ^90 | S 40";
const WIDE_SC = scenario("cf-wide", WIDE_DSL, 34, [
  { do: "turn_in", id: "t1", at_s: 20, target: { lean_deg: 20 }, hand: "R" }
]);

// RUNOFF: the book90-left analog (03 §7.1's premature pin): a LEFT-hander
// whose outward side has only ≈ 0.4 m of pavement beyond the usable edge —
// the line is off the road before a reaction is physically possible
// (`departed_before_reaction`, the normal runoff mechanism of §4a.3).
const RUNOFF_DSL = "lane 3.5 | S 20 | L 12 ^90 | S 16";
const RUNOFF_SC = scenario("cf-runoff", RUNOFF_DSL, 34, [
  { do: "turn_in", id: "t1", at_s: 20, target: { lean_deg: 15 }, hand: "L" }
]);

const WIDE_TRAJ = ride(WIDE_SC);
const RUNOFF_TRAJ = ride(RUNOFF_SC);
const WIDE_ROAD = road(WIDE_DSL);

// a hand-built launch state on the WIDE road (for direct harness calls):
// station 30 (10 m into the corner), lane fraction f, heading tilted OUTWARD
// (toward +d on a right-hander), leaned 15° into the turn, 9.44 m/s
function launchAt(f: number, over: Partial<CfLaunchState> = {}): CfLaunchState {
  const s = 30;
  const d = WIDE_ROAD.dOf(f, s);
  const p = WIDE_ROAD.worldAt(s, d);
  const psiDeg = ((WIDE_ROAD.psi_road(s) - 0.15) * 180) / Math.PI;
  return {
    resolved_scenario: WIDE_SC,
    sample: { t: 2.0, s, x: p.x, y: p.y, psi: psiDeg, v: 9.444, phi: 15, f },
    dfds: 0.05,
    turn_in_before: true,
    hand: "R",
    ...over
  };
}

// ---------------------------------------------------------------------------
// P-CF-PRECONDITION — the §4c.4 law, keyed by predicate, both discharge routes

describe("P-CF-PRECONDITION (04 §4c.4)", () => {
  it("strict route: an outside, outward-drifting, post-turn-in launch is accepted", () => {
    const res = counterfactual(
      { dsl: WIDE_DSL },
      launchAt(1.05, { s_detect: 28 }),
      0,
      "lean_only_reserve",
      "return_after_detect"
    );
    const out = unwrap(res);
    expect(out.verdict.rider).toBe("lean_only_reserve");
    expect(out.verdict.predicate).toBe("return_after_detect");
    expect(out.trajectory.samples.length).toBeGreaterThan(2);
  });

  it("strict route refuses an in-corridor launch: the reserve-lean circle is TIGHTER than every book road, so an inside launch is a self-inflicted inside departure, not a save", () => {
    const res = counterfactual(
      { dsl: WIDE_DSL },
      launchAt(0.9),
      0,
      "lean_only_reserve",
      "return_after_detect"
    );
    const e = unwrapErr(res);
    expect(e.code).toBe("INTERNAL");
    expect(e.detail?.["reason"]).toBe("not_outside_corridor");
  });

  it("strict route refuses when the drift is not outward (df/ds <= 0)", () => {
    const res = counterfactual(
      { dsl: WIDE_DSL },
      launchAt(1.05, { dfds: -0.02 }),
      0,
      "lean_only_reserve",
      "return_after_detect"
    );
    expect(unwrapErr(res).detail?.["reason"]).toBe("not_drifting_outward");
  });

  it("strict route refuses when no turn_in preceded the launch (the §4a.2 guard)", () => {
    const res = counterfactual(
      { dsl: WIDE_DSL },
      launchAt(1.05, { turn_in_before: false }),
      0,
      "lean_only_reserve",
      "return_after_detect"
    );
    expect(unwrapErr(res).detail?.["reason"]).toBe("no_turn_in_before_x0");
  });

  it("horizon route: NO launch condition — an in-corridor launch is admitted when a main-line horizon s_h >= s_detect is supplied", () => {
    const res = counterfactual(
      { dsl: WIDE_DSL },
      launchAt(0.9, { turn_in_before: false, dfds: 0, s_detect: 32, s_h: 32 }),
      0,
      "lean_only_reserve",
      "horizon_bounded_return"
    );
    const out = unwrap(res);
    expect(out.verdict.predicate).toBe("horizon_bounded_return");
  });

  it("horizon route refuses a horizon not derived from the main line (s_h absent, or s_h < s_detect)", () => {
    const noHorizon = counterfactual(
      { dsl: WIDE_DSL },
      launchAt(0.9),
      0,
      "lean_only_reserve",
      "horizon_bounded_return"
    );
    expect(unwrapErr(noHorizon).detail?.["reason"]).toBe("horizon_not_from_main_line");

    const shortHorizon = counterfactual(
      { dsl: WIDE_DSL },
      launchAt(0.9, { s_detect: 32, s_h: 20 }),
      0,
      "lean_only_reserve",
      "horizon_bounded_return"
    );
    expect(unwrapErr(shortHorizon).detail?.["reason"]).toBe("horizon_not_from_main_line");
  });
});

// ---------------------------------------------------------------------------
// P-CF-LITERALISED — the §4c.5 literalise-first rule

describe("P-CF-LITERALISED (04 §4c.5)", () => {
  it("an id-addressed (anchor-form) plan on a counterfactual world refuses: corner-relative anchors mean something different on a re-minted world", () => {
    const authored = {
      ...WIDE_SC,
      rider: {
        ...WIDE_SC.rider,
        plan: [
          { do: "turn_in", id: "t1", at: "entry:c1", target: "tangent_inside" }
        ] as unknown as readonly ResolvedPlanAction[]
      }
    };
    const res = counterfactual(
      { dsl: WIDE_DSL },
      launchAt(1.05, { resolved_scenario: authored, s_detect: 28 }),
      0,
      "lean_only_reserve",
      "return_after_detect"
    );
    const e = unwrapErr(res);
    expect(e.code).toBe("INTERNAL");
    expect(e.detail?.["reason"]).toBe("plan_not_literalised");
  });

  it("a turn_in that still carries the solver's deferred tangent_inside target refuses — literalised plans commit explicit {lean_deg, hand}", () => {
    const halfSolved = {
      ...WIDE_SC,
      rider: {
        ...WIDE_SC.rider,
        plan: [
          { do: "turn_in", id: "t1", at_s: 20, target: "tangent_inside", hand: "R" }
        ] as unknown as readonly ResolvedPlanAction[]
      }
    };
    const res = counterfactual(
      { dsl: WIDE_DSL },
      launchAt(1.05, { resolved_scenario: halfSolved, s_detect: 28 }),
      0,
      "lean_only_reserve",
      "return_after_detect"
    );
    expect(unwrapErr(res).detail?.["reason"]).toBe("plan_not_literalised");
  });
});

// ---------------------------------------------------------------------------
// P-COUNTERFACTUAL-CLOSED / P-COUNTERFACTUAL-NAMED / A-CF-REGISTRY-CLOSED

describe("P-COUNTERFACTUAL-CLOSED (D42): closed sets, v0.1 reachable subset", () => {
  it("the rider set is closed at exactly two ids and the predicate set at three", () => {
    expect([...COUNTERFACTUAL_RIDERS]).toEqual(["lean_only_reserve", "brake_reserve_escape"]);
    expect([...CF_PREDICATES]).toEqual([
      "return_after_detect",
      "horizon_bounded_return",
      "reserve_bounded_run"
    ]);
  });

  it("the v0.1 REACHABLE rider set is exactly {lean_only_reserve} (subset, not equality — D45 unimplemented)", () => {
    const reachable = COUNTERFACTUAL_RIDERS.filter((id) => CF_RIDER_REGISTRY[id].reachable);
    expect(reachable).toEqual(["lean_only_reserve"]);
    for (const id of reachable) {
      expect(COUNTERFACTUAL_RIDERS.includes(id)).toBe(true); // subset of the closed set
    }
  });

  it("brake_reserve_escape rejects SCHEMA with deferred 'continuation envelope (D45)' — declared, not buildable", () => {
    const res = counterfactual(
      { dsl: WIDE_DSL },
      launchAt(1.05, { s_detect: 28 }),
      0,
      "brake_reserve_escape",
      "reserve_bounded_run"
    );
    const e = unwrapErr(res);
    expect(e.code).toBe("SCHEMA");
    expect(e.deferred).toBe("continuation envelope (D45)");
  });

  it("reserve_bounded_run (the §4d grading law) is gated with D45", () => {
    const res = counterfactual(
      { dsl: WIDE_DSL },
      launchAt(1.05, { s_detect: 28 }),
      0,
      "lean_only_reserve",
      "reserve_bounded_run"
    );
    const e = unwrapErr(res);
    expect(e.code).toBe("SCHEMA");
    expect(e.deferred).toBe("continuation envelope (D45)");
  });

  it("an id outside the closed set reaching the harness is the unknown_rider design bug", () => {
    const res = counterfactual(
      { dsl: WIDE_DSL },
      launchAt(1.05, { s_detect: 28 }),
      0,
      "panic_braker" as never,
      "return_after_detect"
    );
    const e = unwrapErr(res);
    expect(e.code).toBe("INTERNAL");
    expect(e.detail?.["reason"]).toBe("unknown_rider");
  });
});

describe("P-COUNTERFACTUAL-NAMED (D42): wrappers declare their binding at the definition site", () => {
  it("correctiveShot binds (lean_only_reserve, return_after_detect)", () => {
    expect(CORRECTIVE_BINDING).toEqual({
      rider: "lean_only_reserve",
      predicate: "return_after_detect"
    });
  });

  it("the binding is enumerable THROUGH the wrapper: the shadow document carries the declared ids", () => {
    const out = unwrap(correctiveShot({ trajectory: WIDE_TRAJ, resolved_scenario: WIDE_SC }));
    expect(out.shadow).not.toBeNull();
    expect(out.shadow!.rider).toBe(CORRECTIVE_BINDING.rider);
    expect(out.shadow!.predicate).toBe(CORRECTIVE_BINDING.predicate);
  });

  it("every out-of-hash surface names its rider in prose — 'the lean-only rider'", () => {
    expect(CF_RIDER_REGISTRY.lean_only_reserve.short_name).toBe("lean-only rider");
    expect(CF_RIDER_REGISTRY.brake_reserve_escape.short_name).toBe("lean-and-brake rider");
    expect(CF_DISCLOSURE_LEAN_ONLY).toContain("lean-only rider");
    const out = unwrap(correctiveShot({ trajectory: WIDE_TRAJ, resolved_scenario: WIDE_SC }));
    // wrapper verdicts travel with the ratified disclosure sentence
    expect(out.shadow!.rider).toBe("lean_only_reserve");
  });
});

describe("A-CF-REGISTRY-CLOSED: registry enumeration equals the closed sets", () => {
  it("the rider registry holds exactly the two ids", () => {
    expect(Object.keys(CF_RIDER_REGISTRY).sort()).toEqual(
      [...COUNTERFACTUAL_RIDERS].sort()
    );
  });
  it("the predicate registry holds exactly the three ids", () => {
    expect(Object.keys(CF_PREDICATE_REGISTRY).sort()).toEqual([...CF_PREDICATES].sort());
  });
  it("the refusal-reason set is the closed D8 six", () => {
    expect([...CF_REFUSAL_REASONS]).toEqual([
      "not_outside_corridor",
      "not_drifting_outward",
      "no_turn_in_before_x0",
      "horizon_not_from_main_line",
      "plan_not_literalised",
      "unknown_rider"
    ]);
  });
});

// ---------------------------------------------------------------------------
// A-CF-DEAD-REASON — shadow_stopped is deleted, in both directions

describe("A-CF-DEAD-REASON (D42): the dead error name shadow_stopped does not exist", () => {
  it("the token appears nowhere in src/", () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const srcRoot = resolve(here, "../../src");
    const offenders: string[] = [];
    const walk = (dir: string): void => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (entry.isFile() && /shadow_stopped/.test(readFileSync(full, "utf8"))) {
          offenders.push(full);
        }
      }
    };
    walk(srcRoot);
    expect(offenders).toEqual([]);
  });

  it("the closed fail_reason set is exactly §4a.5's four names", () => {
    expect([...CORRECTIVE_FAIL_REASONS]).toEqual([
      "departed_before_reaction",
      "shadow_off_road",
      "shadow_crash",
      "no_return_before_road_end"
    ]);
  });
});

// ---------------------------------------------------------------------------
// The corrective shot end-to-end: wide vs runoff

describe("correctiveShot decides wide vs runoff (04 §4a, D18)", () => {
  it("WIDE: detect fires, the shot launches one reaction later, the lean-only shadow returns — feasible", () => {
    const out = unwrap(correctiveShot({ trajectory: WIDE_TRAJ, resolved_scenario: WIDE_SC }));
    const c = out.corrective;
    expect(c).not.toBeNull();
    expect(c!.feasible).toBe(true);
    expect(wideVsRunoff(c!.feasible)).toBe("wide");
    expect(c!.detect.f).toBeCloseTo(F_DETECT + eps_f_detect, 9);
    expect(c!.fail_reason).toBeNull();
    expect(c!.returned).not.toBeNull();
    expect(c!.returned!.f).toBeLessThanOrEqual(F_SAVE + eps_f_save + 1e-9);
    expect(c!.returned!.s).toBeGreaterThan(c!.detect.s);
    // shot block: state at t_shot + the policy target (street reserve, signed +R)
    expect(c!.shot).not.toBeNull();
    expect(c!.shot!.v_kmh).toBeCloseTo(34, 6); // no longitudinal action: v constant
    expect(c!.shot!.target_phi_deg).toBeCloseTo(40.3645, 2);
  });

  it("WIDE: the events member carries run_wide_detect and the correction bookmark (detail.feasible)", () => {
    const out = unwrap(correctiveShot({ trajectory: WIDE_TRAJ, resolved_scenario: WIDE_SC }));
    const detect = out.events.find((e) => e.kind === "run_wide_detect");
    const correction = out.events.find((e) => e.kind === "correction");
    expect(detect).toBeDefined();
    expect(detect!.corner_id).toBe("c1");
    expect(correction).toBeDefined();
    expect(correction!.detail?.["feasible"]).toBe(true);
    // t_shot = t_detect + t_react_s (street 1.0 s; no freeze on this plan)
    expect(correction!.t).toBeCloseTo(detect!.t + 1.0, 9);
  });

  it("WIDE: the in-hash corrective block gains NO rider field (D42 §4c.7 — by decision)", () => {
    const out = unwrap(correctiveShot({ trajectory: WIDE_TRAJ, resolved_scenario: WIDE_SC }));
    const c = out.corrective!;
    expect("rider" in c).toBe(false);
    expect(Object.keys(c).sort()).toEqual(
      ["detect", "fail_reason", "feasible", "returned", "shot"].sort()
    );
  });

  it("RUNOFF: 0.4 m of pavement beyond the usable edge — off the road before a reaction was possible", () => {
    const out = unwrap(
      correctiveShot({ trajectory: RUNOFF_TRAJ, resolved_scenario: RUNOFF_SC })
    );
    const c = out.corrective;
    expect(c).not.toBeNull();
    expect(c!.feasible).toBe(false);
    expect(c!.fail_reason).toBe("departed_before_reaction");
    expect(wideVsRunoff(c!.feasible)).toBe("runoff");
    expect(c!.shot).toBeNull(); // no shot state exists — the line ended first
    expect(c!.returned).toBeNull();
    expect(out.shadow).toBeNull();
    // detect IS on record; the correction bookmark is not (nothing launched)
    expect(out.events.some((e) => e.kind === "run_wide_detect")).toBe(true);
    expect(out.events.some((e) => e.kind === "correction")).toBe(false);
  });

  it("a contained line never attempts a corrective (null block, no events)", () => {
    const sc = scenario("cf-contained", "lane 5 | S 60", 34, []);
    const traj = ride(sc);
    const out = unwrap(correctiveShot({ trajectory: traj, resolved_scenario: sc }));
    expect(out.corrective).toBeNull();
    expect(out.shadow).toBeNull();
    expect(out.events).toEqual([]);
  });

  it("run_wide_detect is outward-only and turn_in-guarded: at most one per corner, attributed to the last corner whose s0 <= s_detect", () => {
    const detects = runWideDetect(WIDE_TRAJ, WIDE_ROAD.corners);
    expect(detects.length).toBe(1);
    expect(detects[0]!.corner_id).toBe("c1");
    expect(detects[0]!.s).toBeGreaterThan(20); // after the turn-in station
    // an all-straight line has no turn_in, so no detect can ever fire
    const straight = ride(scenario("cf-straight", "lane 5 | S 60", 34, []));
    expect(runWideDetect(straight, [])).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// P-CORR-PURE / P-CORR-SHADOW-HONEST / P-CORR-CONSTANT-SPEED / P-ENDPOINT-IN-FRAME

describe("P-CORR-PURE: same inputs → byte-identical shadow", () => {
  it("two calls on the same line produce identical blocks, shadows, and events", () => {
    const a = unwrap(correctiveShot({ trajectory: WIDE_TRAJ, resolved_scenario: WIDE_SC }));
    const b = unwrap(correctiveShot({ trajectory: WIDE_TRAJ, resolved_scenario: WIDE_SC }));
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});

describe("P-CORR-SHADOW-HONEST: the branched shadow never mutates the main record", () => {
  it("the main trajectory is byte-identical before and after the shot, and stays frozen", () => {
    const before = JSON.stringify(WIDE_TRAJ);
    const out = unwrap(correctiveShot({ trajectory: WIDE_TRAJ, resolved_scenario: WIDE_SC }));
    expect(JSON.stringify(WIDE_TRAJ)).toBe(before);
    expect(Object.isFrozen(WIDE_TRAJ)).toBe(true);
    expect(Object.isFrozen(WIDE_TRAJ.samples)).toBe(true);
    expect(Object.isFrozen(WIDE_TRAJ.terminated)).toBe(true);
    // the shot's events are DRAFTS for the envelope assembler — none were
    // injected into the main line's own array
    expect(WIDE_TRAJ.events.some((e) => e.kind === "run_wide_detect")).toBe(false);
    expect(WIDE_TRAJ.events.some((e) => e.kind === "correction")).toBe(false);
    expect(out.shadow).not.toBe(WIDE_TRAJ);
  });
});

describe("P-CORR-CONSTANT-SPEED: v is EXACTLY constant across the shadow (a_cmd = 0, no drag)", () => {
  it("every shadow sample carries the identical v, zero commanded and delivered accel", () => {
    const out = unwrap(correctiveShot({ trajectory: WIDE_TRAJ, resolved_scenario: WIDE_SC }));
    const samples = out.shadow!.samples;
    expect(samples.length).toBeGreaterThan(3);
    const v0 = samples[0]!.v;
    for (const p of samples) {
      expect(p.v).toBe(v0); // exact — the fact that deleted shadow_stopped
      expect(p.cmd_a).toBe(0);
      expect(p.a_long).toBe(0);
      expect(p.a_cmd_rate).toBe(0); // empty command-rate history (§4a.4)
      expect(p.su_transient).toBe(0); // the chop transient cannot fire off the shot start
      expect(p.su_sustained).toBe(0); // slice active but dormant with a_cmd = 0
    }
  });
});

describe("P-ENDPOINT-IN-FRAME: the shadow lives in the main line's world frame", () => {
  it("the shadow's first sample coincides with the recorded state at t_shot", () => {
    const out = unwrap(correctiveShot({ trajectory: WIDE_TRAJ, resolved_scenario: WIDE_SC }));
    const correction = out.events.find((e) => e.kind === "correction")!;
    const tShot = correction.t;
    const first = out.shadow!.samples[0]!;
    expect(first.t).toBeCloseTo(tShot, 9);
    // interpolate the main record at t_shot in-test (independent of the impl)
    const s = WIDE_TRAJ.samples;
    let i = 0;
    while (i + 1 < s.length && s[i + 1]!.t < tShot) i++;
    const a = s[i]!;
    const b = s[Math.min(i + 1, s.length - 1)]!;
    const alpha = b.t > a.t ? (tShot - a.t) / (b.t - a.t) : 0;
    expect(first.x).toBeCloseTo(a.x + (b.x - a.x) * alpha, 6);
    expect(first.y).toBeCloseTo(a.y + (b.y - a.y) * alpha, 6);
    expect(first.psi).toBeCloseTo(a.psi + (b.psi - a.psi) * alpha, 6);
    expect(first.phi).toBeCloseTo(a.phi + (b.phi - a.phi) * alpha, 6);
    expect(first.v).toBeCloseTo(a.v + (b.v - a.v) * alpha, 9);
  });

  it("the shadow's endpoint is frame-consistent: terminated coordinates reproject onto the road at the terminated station", () => {
    const out = unwrap(correctiveShot({ trajectory: WIDE_TRAJ, resolved_scenario: WIDE_SC }));
    const term = out.shadow!.terminated;
    const last = out.shadow!.samples[out.shadow!.samples.length - 1]!;
    expect(last.s).toBeCloseTo(term.s, 9);
    expect(last.t).toBeCloseTo(term.t, 9);
    const proj = WIDE_ROAD.project(term.x, term.y);
    expect(proj.s).toBeCloseTo(term.s, 6);
  });
});
