// test/contract/wire.test.ts — WP-09's result-contract gates (ARCHITECTURE §7):
// verdict assembly on HAND-BUILT trajectories and doctrine blocks, the outcome
// precedence table, clean/quality derivation, C-TREND-WINDOW, C-RAW-RETENTION,
// C-COLOUR-DERIVE, C-REFUSAL-ENVELOPE, C-SKEW-DETECT/CLEAN/NEVER-BLOCKS,
// C-SAVEWIN-NO-INK (trivial v0.1 sentinel), and the result_hash exclusion-set
// property (mutating any excluded field never moves the hash; mutating any
// included field does).
//
// Remaining §7 rows of this file's gate list — C-PHASE-TOTAL (fuzzed engine
// scenarios), C-SCENE-MULTIRIDE (scene bake), C-OCC-TOKEN (anchor grammar) —
// need the solver/scene pipeline and land with WP-12/13/15 (see WP-09 report).

import { describe, it, expect } from "vitest";
import type {
  Corner,
  Event,
  ResolvedPlanAction,
  ResolvedScenario,
  RoadModel,
  Sample,
  Terminated,
  Trajectory
} from "../../src/core/types.js";
import { OUTCOMES } from "../../src/core/types.js";
import { buildTrajectory } from "../../src/core/record.js";
import type { CornerRow } from "../../src/core/analyze.js";
import { sightTrendAt } from "../../src/sight/analyze.js";
import type { CheckResult, DoctrineBlock } from "../../src/plan/doctrine/types.js";
import { QUALITIES } from "../../src/plan/doctrine/quality.js";
import { loadRubricPack } from "../../src/plan/doctrine/pack.js";
import parksStreetJson from "../../src/plan/doctrine/packs/parks-street.json" with { type: "json" };
import { assembleVerdict, physicsOutcome } from "../../src/solve/verdict.js";
import type { CornerCorrective, VerdictInput } from "../../src/solve/verdict.js";
import {
  RESULT_HASH_EXCLUSIONS,
  buildFigureResult,
  buildLineRefusal,
  buildLineResult,
  classifySolvedCache,
  evaluateSkew,
  isLineRefusal,
  resultHash,
  sealVerdict,
  stampExpected,
  validateEngineSemver,
  validateExpectedStamp
} from "../../src/solve/envelope.js";
import { emissionDpFor, roundEmission } from "../../src/solve/emit.js";
import type {
  CorrectiveBlock,
  ExpectedStamp,
  LineResult,
  MisjudgmentBlock,
  Verdict
} from "../../src/solve/types.js";
import {
  CACHE_STATES,
  DIAGNOSIS_CAUSES,
  FIGURE_SKEW_TIERS,
  LINE_SKEW_TIERS,
  NO_SOLUTION_SUB_REASONS
} from "../../src/solve/types.js";

// ---------------------------------------------------------------------------
// Fixture helpers — constructed literals (no engine, no validate): the wire
// contract is exercised exactly as a consumer of a finished record sees it.

const packR = loadRubricPack(parksStreetJson);
if (!packR.ok) throw new Error("parks-street pack failed to load for fixtures");
const PACK = packR.value;

function mkSample(over: Partial<Sample> = {}): Sample {
  return {
    s: 0, t: 0, x: 0, y: 0, psi: 0, v: 15, phi: 0, kappa: 0,
    a_long: 0, a_lat: 0, grip: 1, mu: 1, d: 0, f: 0.5,
    cmd_lean: 0, cmd_a: 0, roll_rate: 50, action_id: null, clipped: false,
    n_long: 0, n_lat: 0,
    sight_m: 60, ssd_m: 25, limit_x: 60, limit_y: 0,
    sight_ride_m: 60, steer_state: "track", lat_action_id: null,
    su_sustained: 0, su_transient: 0, a_cmd_rate: 0, below_validity: false,
    ...over
  };
}

/** Straight-line samples every 10 m at v = 15 m/s (t = s/15). */
function baseSamples(over: ReadonlyMap<number, Partial<Sample>> = new Map()): Sample[] {
  const out: Sample[] = [];
  for (let s = 0; s <= 100; s += 10) {
    out.push(mkSample({ s, t: s / 15, x: s, ...(over.get(s) ?? {}) }));
  }
  return out;
}

const T_END = 100 / 15;

function terminated(reason: Terminated["reason"], s = 100): Terminated {
  return { reason, s, t: s / 15, x: s, y: 0 };
}

const cornerC1: Corner = {
  id: "c1", hand: "R", s0: 40, s1: 70, s_mid: 55, r: 30, angle_deg: 57.3,
  type: "constant", r_min: 30, r_max: 30, linked_next: false
};

/** Opposite-hand follow-up corner — the chain-handoff geometry (f flips sides). */
const cornerC2: Corner = {
  id: "c2", hand: "L", s0: 75, s1: 95, s_mid: 85, r: 25, angle_deg: 45.8,
  type: "constant", r_min: 25, r_max: 25, linked_next: false
};

const rowC1: CornerRow = {
  id: "c1", hand: "R", corner_type: "constant",
  apexes: [{ s: 55, pct: 52.31, f: 0.1231, clearance_m: 0.42, v_kmh: 54, lean_deg: 30.12 }],
  lean_max_deg: 31.51, grip_min: 0.4321, danger_dwell_s: 0,
  exit: { s: 70, d: 0, f: 0.5, heading_err_deg: 0.4 }
};

const PLAN: ResolvedPlanAction[] = [
  { do: "brake", id: "b1", at_s: 20, decel: 3, slew_mss: 6 },
  { do: "turn_in", id: "t1", at_s: 42, target: { lean_deg: 28 }, hand: "R" }
];

const EV_TURN_IN: Event = { kind: "turn_in", s: 42, t: 42 / 15, corner_id: "c1", action_id: "t1" };
const EV_RELEASE: Event = { kind: "release", s: 65, t: 65 / 15, corner_id: "c1", action_id: "t1" };
const EV_ROAD_END: Event = { kind: "road_end", s: 100, t: T_END };
const EV_DETECT: Event = { kind: "run_wide_detect", s: 60, t: 4, corner_id: "c1", detail: { f: 1.01 } };

function containedTraj(): Trajectory {
  return buildTrajectory(baseSamples(), [EV_TURN_IN, EV_RELEASE, EV_ROAD_END], terminated("road_end"));
}

function checkRes(id: string, verdict: CheckResult["verdict"]): CheckResult {
  return { id, scope: "corner", corner_id: "c1", pair: null, verdict, evidence: { message: `${id}: ${verdict}` } };
}

function doctrineOf(checks: readonly CheckResult[]): DoctrineBlock {
  const count = (v: CheckResult["verdict"]): number => checks.filter((c) => c.verdict === v).length;
  return { pass: count("pass"), fail: count("fail"), warn: count("warn"), na: count("na"), checks };
}

const ALL_PASS = doctrineOf([
  checkRes("late_apex", "pass"),
  checkRes("lean_ceiling", "pass"),
  checkRes("stop_within_sight", "na") // na is a first-class verdict; never blocks green
]);
const ONE_FAIL = doctrineOf([checkRes("late_apex", "fail"), checkRes("lean_ceiling", "pass")]);
const CRITICAL_FAIL = doctrineOf([
  checkRes("wrong_strategy_for_corner", "fail"), // the pack's sole critical check
  checkRes("late_apex", "pass")
]);

const FEASIBLE: CorrectiveBlock = {
  feasible: true,
  detect: { s: 60, f: 1.01 },
  shot: { s: 66, v_kmh: 54, phi_deg: 28, target_phi_deg: 39.5 },
  returned: { s: 72, f: 1.0 },
  fail_reason: null
};
const INFEASIBLE: CorrectiveBlock = {
  feasible: false,
  detect: { s: 60, f: 1.01 },
  shot: { s: 66, v_kmh: 54, phi_deg: 28, target_phi_deg: 39.5 },
  returned: null,
  fail_reason: "shadow_off_road"
};

function baseInput(over: Partial<VerdictInput> = {}): VerdictInput {
  return {
    trajectory: containedTraj(),
    corner_rows: [rowC1],
    road_corners: [cornerC1],
    resolved_plan: PLAN,
    doctrine: ALL_PASS,
    pack: PACK,
    spec_hash: "aaaaaa",
    ...over
  };
}

const RIDER = { plan: PLAN };

/** Unwrap assembleVerdict (Result since the INTERNAL believed-impossible arm). */
function assembled(over: Partial<VerdictInput> = {}): Verdict {
  const r = assembleVerdict(baseInput(over));
  if (!r.ok) throw new Error(`assembleVerdict refused: ${r.error.message}`);
  return r.value;
}

/** Unwrap physicsOutcome; road corners default to the single-corner fixture. */
function outcomeOf(
  traj: Trajectory,
  correctives: readonly CornerCorrective[],
  roadCorners: readonly Corner[] = [cornerC1]
): string {
  const r = physicsOutcome(traj, correctives, roadCorners);
  if (!r.ok) throw new Error(`physicsOutcome refused: ${r.error.message}`);
  return r.value;
}

function sealed(over: Partial<VerdictInput> = {}): Verdict {
  const r = sealVerdict(assembled(over), RIDER);
  if (!r.ok) throw new Error(`sealVerdict refused: ${r.error.message}`);
  return r.value;
}

function hashOf(v: Verdict): string {
  const r = resultHash(v, RIDER);
  if (!r.ok) throw new Error(`resultHash refused: ${r.error.message}`);
  return r.value;
}

// ---------------------------------------------------------------------------
// The outcome law (design/05 §6.1) — physics only, all five classes, precedence

describe("outcome precedence (05 §6.1: crash > runoff > wide > stopped > contained)", () => {
  it("crash: a crash termination wins even over a feasible corrective", () => {
    const traj = buildTrajectory(
      baseSamples().slice(0, 7),
      [EV_TURN_IN, EV_DETECT, { kind: "crash", s: 62, t: 62 / 15 }],
      terminated("crash", 62)
    );
    expect(outcomeOf(traj, [{ corner_id: "c1", block: FEASIBLE }])).toBe("crash");
  });

  it("runoff: an outward crossing with an infeasible corrective", () => {
    const traj = buildTrajectory(
      baseSamples().slice(0, 8),
      [EV_TURN_IN, EV_DETECT, { kind: "off_road", s: 71, t: 71 / 15 }],
      terminated("off_road", 71)
    );
    expect(outcomeOf(traj, [{ corner_id: "c1", block: INFEASIBLE }])).toBe("runoff");
  });

  it("runoff: off_road with NO outward detect (inside-side departure, corrective null)", () => {
    const traj = buildTrajectory(
      baseSamples().slice(0, 6),
      [EV_TURN_IN, { kind: "off_road", s: 52, t: 52 / 15 }],
      terminated("off_road", 52)
    );
    expect(outcomeOf(traj, [])).toBe("runoff");
  });

  it("wide: an outward crossing a feasible corrective returns — even when the drawn (uncorrected) line ran off", () => {
    const traj = buildTrajectory(
      baseSamples().slice(0, 8),
      [EV_TURN_IN, EV_DETECT, { kind: "off_road", s: 71, t: 71 / 15 }],
      terminated("off_road", 71)
    );
    expect(outcomeOf(traj, [{ corner_id: "c1", block: FEASIBLE }])).toBe("wide");
  });

  it("runoff beats wide when ANY detected corner has no feasible save", () => {
    const detect2: Event = { kind: "run_wide_detect", s: 85, t: 85 / 15, corner_id: "c2", detail: { f: 1.01 } };
    const traj = buildTrajectory(
      baseSamples(),
      [EV_TURN_IN, EV_DETECT, detect2, EV_ROAD_END],
      terminated("road_end")
    );
    const both: CornerCorrective[] = [
      { corner_id: "c1", block: FEASIBLE },
      { corner_id: "c2", block: INFEASIBLE }
    ];
    expect(outcomeOf(traj, both, [cornerC1, cornerC2])).toBe("runoff");
  });

  it("chain handoff: a feasible save in one corner NEVER masks a terminal inside-side departure in another (04 §4a.6 clause 2 stays reachable; runoff > wide)", () => {
    // c1 runs wide outward and the corrective returns it; the line then
    // terminates off_road at s=85 inside c2 — the opposite-hand f-flip at the
    // chain handoff — where NO outward detect exists. Worst class wins.
    const traj = buildTrajectory(
      baseSamples().slice(0, 9),
      [EV_TURN_IN, EV_DETECT, { kind: "off_road", s: 85, t: 85 / 15 }],
      terminated("off_road", 85)
    );
    expect(
      outcomeOf(traj, [{ corner_id: "c1", block: FEASIBLE }], [cornerC1, cornerC2])
    ).toBe("runoff");
  });

  it("chain handoff, pre-first-corner variant: a terminal departure before any corner is equally unrecovered", () => {
    const traj = buildTrajectory(
      baseSamples().slice(0, 3),
      [{ kind: "off_road", s: 20, t: 20 / 15 }],
      terminated("off_road", 20)
    );
    expect(outcomeOf(traj, [], [cornerC1, cornerC2])).toBe("runoff");
  });

  it("a run_wide_detect without corner_id is believed-impossible input → typed INTERNAL, never a silent wide", () => {
    const orphan: Event = { kind: "run_wide_detect", s: 60, t: 4, detail: { f: 1.01 } };
    const traj = buildTrajectory(
      baseSamples(),
      [EV_TURN_IN, orphan, EV_ROAD_END],
      terminated("road_end")
    );
    const r = physicsOutcome(traj, [], [cornerC1]);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.code).toBe("INTERNAL");
      expect(r.error.detail?.["reason"]).toBe("detect_missing_corner_id");
    }
    // the same refusal propagates through assembleVerdict untouched
    const v = assembleVerdict(baseInput({ trajectory: traj }));
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.error.detail?.["reason"]).toBe("detect_missing_corner_id");
  });

  it("stopped: v fell below the floor before road end, nothing above applies", () => {
    const traj = buildTrajectory(
      baseSamples().slice(0, 5),
      [{ kind: "stop", s: 44, t: 44 / 15 }],
      terminated("stopped", 44)
    );
    expect(outcomeOf(traj, [])).toBe("stopped");
  });

  it("contained: reached road end on the carriageway", () => {
    expect(outcomeOf(containedTraj(), [])).toBe("contained");
  });

  it("runaway guards (max_time AND max_dist) read contained — PENDING RATIFICATION into 05 §6.1; the guard stays recorded in terminated.reason", () => {
    for (const reason of ["max_time", "max_dist"] as const) {
      const traj = buildTrajectory(baseSamples(), [], terminated(reason));
      expect(outcomeOf(traj, [])).toBe("contained");
      expect(traj.terminated.reason).toBe(reason);
    }
  });

  it("P-OUTCOME-RUBRIC-FREE: outcome is identical under any doctrine block", () => {
    for (const doctrine of [ALL_PASS, ONE_FAIL, CRITICAL_FAIL]) {
      expect(assembled({ doctrine }).outcome).toBe("contained");
    }
  });
});

// ---------------------------------------------------------------------------
// C-COLOUR-DERIVE — clean/quality derivation table (outcome × checks × severity)

describe("clean/quality derivation (C-COLOUR-DERIVE; law imported from plan/doctrine)", () => {
  it("contained + zero fails (na present) → good, ok=true — na never blocks green", () => {
    const v = assembled({ doctrine: ALL_PASS });
    expect(v.quality).toBe("good");
    expect(v.ok).toBe(true);
    expect(v.doctrine.na).toBe(1);
  });

  it("contained + a standard-severity fail → caution, ok=false", () => {
    const v = assembled({ doctrine: ONE_FAIL });
    expect(v.quality).toBe("caution");
    expect(v.ok).toBe(false);
  });

  it("contained + a critical-severity fail → failing", () => {
    const v = assembled({ doctrine: CRITICAL_FAIL });
    expect(v.quality).toBe("failing");
    expect(v.ok).toBe(false);
  });

  it("stopped → caution even with all checks passing", () => {
    const traj = buildTrajectory(
      baseSamples().slice(0, 5),
      [{ kind: "stop", s: 44, t: 44 / 15 }],
      terminated("stopped", 44)
    );
    const v = assembled({ trajectory: traj });
    expect(v.outcome).toBe("stopped");
    expect(v.quality).toBe("caution");
    expect(v.ok).toBe(false);
  });

  it("wide and runoff and crash → failing regardless of check results", () => {
    const mkWith = (events: Event[], term: Terminated, correctives: CornerCorrective[]): Verdict =>
      assembled({
          trajectory: buildTrajectory(baseSamples().slice(0, 8), events, term),
          correctives,
          doctrine: ALL_PASS
        });
    const wide = mkWith([EV_TURN_IN, EV_DETECT], terminated("road_end", 70), [
      { corner_id: "c1", block: FEASIBLE }
    ]);
    expect(wide.outcome).toBe("wide");
    expect(wide.quality).toBe("failing");
    const runoff = mkWith([EV_TURN_IN, EV_DETECT], terminated("off_road", 71), [
      { corner_id: "c1", block: INFEASIBLE }
    ]);
    expect(runoff.quality).toBe("failing");
    const crash = mkWith([EV_TURN_IN, { kind: "crash", s: 62, t: 62 / 15 }], terminated("crash", 62), []);
    expect(crash.quality).toBe("failing");
  });

  it("totality: every (outcome × doctrine) cell lands in the closed quality set", () => {
    const doctrines = [ALL_PASS, ONE_FAIL, CRITICAL_FAIL];
    const trajFor = (reason: Terminated["reason"], events: Event[]): Trajectory =>
      buildTrajectory(baseSamples().slice(0, 8), events, terminated(reason, 70));
    const cells: Array<{ traj: Trajectory; correctives: CornerCorrective[] }> = [
      { traj: trajFor("crash", [{ kind: "crash", s: 62, t: 62 / 15 }]), correctives: [] },
      { traj: trajFor("off_road", [EV_TURN_IN, EV_DETECT]), correctives: [{ corner_id: "c1", block: INFEASIBLE }] },
      { traj: trajFor("off_road", [EV_TURN_IN, EV_DETECT]), correctives: [{ corner_id: "c1", block: FEASIBLE }] },
      { traj: trajFor("stopped", [{ kind: "stop", s: 44, t: 44 / 15 }]), correctives: [] },
      { traj: containedTraj(), correctives: [] }
    ];
    const seen = new Set<string>();
    for (const cell of cells) {
      for (const doctrine of doctrines) {
        const v = assembled({ trajectory: cell.traj, correctives: cell.correctives, doctrine });
        expect(OUTCOMES).toContain(v.outcome);
        expect(QUALITIES).toContain(v.quality);
        seen.add(v.outcome);
      }
    }
    expect([...seen].sort()).toEqual([...OUTCOMES].sort()); // all five outcomes exercised
  });
});

// ---------------------------------------------------------------------------
// Verdict assembly detail (05 §6.3 blocks)

describe("verdict assembly on hand-built records (05 §6.3)", () => {
  it("stamps the pinned identities: engine linelab/1, rubric parks-street/2, checks_version 2", () => {
    const v = assembled();
    expect(v.engine).toBe("linelab/1");
    expect(v.rubric).toBe("parks-street/2");
    expect(v.checks_version).toBe(2);
    expect(v.spec_hash).toBe("aaaaaa");
  });

  it("turn_ins: one row per turn_in event, lean/hand from the resolved plan, release_s from the release event", () => {
    const v = assembled();
    expect(v.corners).toHaveLength(1);
    expect(v.corners[0]!.turn_ins).toEqual([
      { s: 42, lean_commit_deg: 28, hand: "R", release_s: 65 }
    ]);
  });

  it("turn_ins: a never-released commitment carries release_s null (itself diagnostic)", () => {
    const traj = buildTrajectory(baseSamples(), [EV_TURN_IN, EV_ROAD_END], terminated("road_end"));
    const v = assembled({ trajectory: traj });
    expect(v.corners[0]!.turn_ins[0]!.release_s).toBeNull();
  });

  it("validity dwell (D17): flagged brackets sum in seconds; zero dwell reads null", () => {
    const flagged = baseSamples(
      new Map([[30, { below_validity: true }], [40, { below_validity: true }]])
    );
    const traj = buildTrajectory(flagged, [EV_ROAD_END], terminated("road_end"));
    const v = assembled({ trajectory: traj });
    // hold rule: brackets [30,40) and [40,50) contribute (50−30)/15 s
    expect(v.validity).not.toBeNull();
    expect(v.validity!.below_validity_s).toBeCloseTo(20 / 15, 12);
    expect(assembled().validity).toBeNull();
  });

  it("sight block (D16, rider-path basis): the worst sight_ride_m − ssd_m sample", () => {
    const dipped = baseSamples(new Map([[50, { sight_ride_m: 18, ssd_m: 25 }]]));
    const traj = buildTrajectory(dipped, [EV_ROAD_END], terminated("road_end"));
    const v = assembled({ trajectory: traj });
    expect(v.sight).not.toBeNull();
    expect(v.sight!.margin_min_m).toBe(18 - 25);
    expect(v.sight!.at_s).toBe(50);
    expect(v.sight!.v_at_s_kmh).toBeCloseTo(54, 12);
    expect(v.sight!.holds).toEqual([]);
  });

  it("acceptance (D24): always present; policy defaults clean; met ≡ the clean bar; best_failing passes through", () => {
    const good = assembled();
    expect(good.acceptance).toEqual({ policy: "clean", met: true });
    const failing = assembled({ doctrine: ONE_FAIL, acceptance_policy: "best_failing" });
    expect(failing.acceptance).toEqual({ policy: "best_failing", met: false });
  });

  it("ran_wide + per-corner corrective wiring; wide headline names the corner", () => {
    const traj = buildTrajectory(
      baseSamples(),
      [EV_TURN_IN, EV_DETECT, EV_ROAD_END],
      terminated("road_end")
    );
    const v = assembled({ trajectory: traj, correctives: [{ corner_id: "c1", block: FEASIBLE }] });
    expect(v.outcome).toBe("wide");
    expect(v.corners[0]!.ran_wide).toBe(true);
    expect(v.corners[0]!.corrective).toEqual(FEASIBLE);
    expect(v.headline).toBe("ran wide in c1 — recoverable within reserve");
  });

  it("chain-handoff runoff: the headline names the terminal-departure corner, not the saved one", () => {
    const rowC2: CornerRow = {
      id: "c2", hand: "L", corner_type: "constant",
      apexes: [], lean_max_deg: 20.5, grip_min: 0.61, danger_dwell_s: 0,
      exit: { s: 95, d: 0, f: 0.5, heading_err_deg: 0.2 }
    };
    const traj = buildTrajectory(
      baseSamples().slice(0, 9),
      [EV_TURN_IN, EV_DETECT, { kind: "off_road", s: 85, t: 85 / 15 }],
      terminated("off_road", 85)
    );
    const v = assembled({
      trajectory: traj,
      corner_rows: [rowC1, rowC2],
      road_corners: [cornerC1, cornerC2],
      correctives: [{ corner_id: "c1", block: FEASIBLE }]
    });
    expect(v.outcome).toBe("runoff");
    expect(v.headline).toBe("ran off in c2");
    // the saved corner keeps its feasible block; the departure corner never ran wide
    expect(v.corners[0]!.ran_wide).toBe(true);
    expect(v.corners[0]!.corrective).toEqual(FEASIBLE);
    expect(v.corners[1]!.ran_wide).toBe(false);
    expect(v.corners[1]!.corrective).toBeNull();
  });

  it("crash attribution: the corner containing the crash station carries crash: true; clean lines carry no crash key", () => {
    const traj = buildTrajectory(
      baseSamples().slice(0, 7),
      [EV_TURN_IN, { kind: "crash", s: 62, t: 62 / 15 }],
      terminated("crash", 62)
    );
    const crashed = assembled({ trajectory: traj });
    expect(crashed.corners[0]!.crash).toBe(true);
    const cleanLine = assembled();
    expect("crash" in cleanLine.corners[0]!).toBe(false);
  });

  it("misjudgment/constraints/diagnosis default null and pass through when supplied", () => {
    const v = assembled();
    expect(v.misjudgment).toBeNull();
    expect(v.constraints).toBeNull();
    expect(v.diagnosis).toBeNull();
    const withDiag = assembled({ diagnosis: { cause: "stand_up", at_s: 61.2, corner_id: "c1", detail: {} } });
    expect(withDiag.diagnosis!.cause).toBe("stand_up");
  });
});

// ---------------------------------------------------------------------------
// C-TREND-WINDOW — sight_trend transitions exactly at window + deadband
// boundaries (05 §4: window 5.0 m lookback, deadband 2.0 m, STRICT >)

describe("C-TREND-WINDOW (05 §4: 5 m window, 2 m deadband)", () => {
  /** 1 m grid; sight_m steps from `before` to `after` for s > 10. */
  function stepProfile(before: number, after: number): Sample[] {
    const out: Sample[] = [];
    for (let s = 0; s <= 20; s += 1) {
      out.push(mkSample({ s, t: s / 15, x: s, sight_m: s <= 10 ? before : after }));
    }
    return out;
  }

  it("a step of exactly +deadband (2.0 m) inside the window reads steady — strict inequality", () => {
    const samples = stepProfile(20, 22);
    // s = 12: ref is the sample nearest 12 − 5 = 7 (sight 20); Δ = 2.0 exactly
    expect(sightTrendAt(samples, 12)).toBe("steady");
  });

  it("a step past the deadband reads opening while — and only while — it lies inside the 5 m window", () => {
    const samples = stepProfile(20, 22.25);
    expect(sightTrendAt(samples, 12)).toBe("opening"); // Δ = 2.25 > 2.0, step at s=10 within [7, 12]
    expect(sightTrendAt(samples, 15)).toBe("opening"); // ref s=10 (20) — the last index still spanning the step
    expect(sightTrendAt(samples, 16)).toBe("steady");  // ref s=11 (22.25) — the step left the window
  });

  it("the closing side mirrors: past-deadband drops read closing, exact-deadband drops steady", () => {
    expect(sightTrendAt(stepProfile(22.25, 20), 12)).toBe("closing"); // Δ = −2.25
    expect(sightTrendAt(stepProfile(22, 20), 12)).toBe("steady");     // Δ = −2.0 exactly
  });

  it("early clamp: with no 5 m of history the reference clamps to the first sample", () => {
    const samples = stepProfile(20, 30);
    expect(sightTrendAt(samples, 0)).toBe("steady"); // ref = itself
  });
});

// ---------------------------------------------------------------------------
// Envelope fixtures for the C-* wire gates

const fakeRoad: RoadModel = {
  lane_width_m: 3.6, bike_margin_m: 0.4, use_full_width: false, total_len_m: 100,
  corners: [cornerC1],
  psi_road: () => 0, kappa_road: () => 0,
  dOf: () => 0, fOf: () => 0.5, muAt: () => 1,
  project: (x: number, y: number) => ({ s: x, d: y })
};

const resolvedScenario: ResolvedScenario = {
  spec: "linelab/1",
  id: "wire-fixture",
  road: { lane_width_m: 3.6, bike_margin_m: 0.4, use_full_width: false, segments: [], dsl: "S 40 R 30 ^57 S 30" },
  occluders: [],
  hazards: [],
  rider: { profile: "street", start: { speed_kmh: 54, f: 1.0 }, plan: PLAN },
  config: { mu: 1, ds_m: 0.5, ssd_model: "alert", rubric: "parks-street", checks_version: 2 }
};

function mkLineResult(line_id = "ideal"): LineResult {
  return buildLineResult({
    line_id,
    role: "ideal",
    label: "the ideal line",
    source: { kind: "solve", solveSpec: { road: "S 40 R 30 ^57 S 30", entry_kmh: 54 } },
    resolved_scenario: resolvedScenario,
    cache: "absent",
    trajectory: containedTraj(),
    verdict: sealed()
  });
}

// ---------------------------------------------------------------------------
// C-RAW-RETENTION — exactly ONE sample array; no second series anywhere

describe("C-RAW-RETENTION (05 §2: one flat sample array, no channels split)", () => {
  it("Trajectory is exactly {samples, events, terminated}", () => {
    const traj = containedTraj();
    expect(Object.keys(traj).sort()).toEqual(["events", "samples", "terminated"]);
  });

  it("an envelope round-trip carries one sample series per line and no channels key", () => {
    const fig = buildFigureResult({
      figure_id: "fig-raw",
      road: fakeRoad,
      occluders: [],
      hazards: [],
      lines: [mkLineResult()]
    });
    const json = JSON.stringify(fig);
    expect(json.split("\"samples\":").length - 1).toBe(1);
    expect(json.includes("\"channels\"")).toBe(false);
    const back = JSON.parse(json) as { lines: Array<{ trajectory: Record<string, unknown> }> };
    expect(Object.keys(back.lines[0]!.trajectory).sort()).toEqual(["events", "samples", "terminated"]);
  });
});

// ---------------------------------------------------------------------------
// C-REFUSAL-ENVELOPE — refusals are first-class typed entries beside results

describe("C-REFUSAL-ENVELOPE (D6/D11: refusals never abort the figure)", () => {
  const refusal = buildLineRefusal("blind", "alternative", {
    code: "NO_SOLUTION",
    at: "lines[1]",
    message: "vis=cautious found no speed satisfying the margin within bounds",
    detail: { sub_reason: "vis_unsatisfiable_within_bound" }
  });
  const fig = buildFigureResult({
    figure_id: "fig-refusal",
    road: fakeRoad,
    occluders: [],
    hazards: [],
    lines: [mkLineResult(), refusal]
  });

  it("the figure carries both entries in draw order; the refusal is keyed by line_id", () => {
    expect(fig.lines).toHaveLength(2);
    expect(fig.lines[1]!.line_id).toBe("blind");
  });

  it("the refusal is typed: ok false, closed error code, registry sub_reason", () => {
    const entry = fig.lines[1]!;
    expect(isLineRefusal(entry)).toBe(true);
    if (!isLineRefusal(entry)) return;
    expect(entry.ok).toBe(false);
    expect(entry.error.code).toBe("NO_SOLUTION");
    expect(NO_SOLUTION_SUB_REASONS).toContain(entry.error.detail?.["sub_reason"]);
  });

  it("the surviving line keeps identical citizenship: full trajectory and verdict", () => {
    const entry = fig.lines[0]!;
    expect(isLineRefusal(entry)).toBe(false);
    if (isLineRefusal(entry)) return;
    expect(entry.trajectory.samples.length).toBeGreaterThan(0);
    expect(entry.verdict.outcome).toBe("contained");
    expect(entry.verdict.result_hash).toMatch(/^[0-9a-f]{6}$/);
  });
});

// ---------------------------------------------------------------------------
// Version skew (05 §8.4) — C-SKEW-DETECT / C-SKEW-CLEAN / C-SKEW-NEVER-BLOCKS

describe("version skew tiers (05 §8.4, D31)", () => {
  const got = (outcome: ExpectedStamp["outcome"], hash: string): ExpectedStamp => ({
    outcome, result_hash: hash
  });

  it("C-SKEW-DETECT: four lines, one per tier — figure tier is the max (story)", () => {
    const skew = evaluateSkew("0.1.0", "0.2.0", [
      { line_id: "a", expected: got("contained", "aaaaaa"), got: got("contained", "aaaaaa") }, // match
      { line_id: "b", expected: undefined, got: got("contained", "bbbbbb") },                  // unstamped
      { line_id: "c", expected: got("contained", "cccccc"), got: got("contained", "ffffff") }, // detail
      { line_id: "d", expected: got("contained", "dddddd"), got: got("runoff", "eeeeee") }     // story
    ]);
    expect(skew).not.toBeNull();
    expect(skew!.same_engine).toBe(false);
    expect(skew!.lines.map((l) => l.tier)).toEqual(["match", "unstamped", "detail", "story"]);
    expect(skew!.tier).toBe("story");
    expect(skew!.lines[1]!.expected).toBeNull(); // unstamped carries no expected
  });

  it("C-SKEW-CLEAN: same engine, stamps reproduce → every line match, figure match, no placard tier", () => {
    const skew = evaluateSkew("0.1.0", "0.1.0", [
      { line_id: "a", expected: got("contained", "aaaaaa"), got: got("contained", "aaaaaa") }
    ]);
    expect(skew!.same_engine).toBe(true);
    expect(skew!.lines.every((l) => l.tier === "match")).toBe(true);
    expect(skew!.tier).toBe("match");
  });

  it("info: differing semvers with no line beyond match/unstamped", () => {
    const skew = evaluateSkew("0.1.0", "0.2.0", [
      { line_id: "a", expected: got("contained", "aaaaaa"), got: got("contained", "aaaaaa") },
      { line_id: "b", expected: undefined, got: got("contained", "bbbbbb") }
    ]);
    expect(skew!.tier).toBe("info");
  });

  it("a spec carrying no engine_semver has no skew record at all (null)", () => {
    expect(evaluateSkew(undefined, "0.1.0", [])).toBeNull();
  });

  it("C-SKEW-NEVER-BLOCKS: a story-tier record rides the envelope; every line stays complete and unchanged", () => {
    const line = mkLineResult();
    const skew = evaluateSkew("0.0.1", "0.1.0", [
      { line_id: line.line_id, expected: got("crash", "000000"), got: stampExpected(line.verdict) }
    ]);
    expect(skew!.tier).toBe("story");
    const fig = buildFigureResult({
      figure_id: "fig-skew",
      road: fakeRoad,
      occluders: [],
      hazards: [],
      lines: [line],
      skew
    });
    const entry = fig.lines[0]!;
    expect(isLineRefusal(entry)).toBe(false);
    if (isLineRefusal(entry)) return;
    // skew influenced only the skew member — the verdict's hash is untouched
    expect(entry.verdict.result_hash).toBe(hashOf(entry.verdict));
    expect(entry.trajectory.samples.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Solved-plan cache classification (05 §8.1) + share-stamp validation

describe("solved-plan cache-load semantics (05 §8.1 — never silent)", () => {
  const solvedBlock = { spec_hash: "abc123", plan: [] };

  it("classifies hit / stale_engine / stale_spec / absent", () => {
    const base = {
      solved: solvedBlock,
      spec_engine_semver: "0.1.0",
      engine_semver: "0.1.0",
      recomputed_spec_hash: "abc123"
    };
    expect(classifySolvedCache(base)).toBe("hit");
    expect(classifySolvedCache({ ...base, spec_engine_semver: "0.0.9" })).toBe("stale_engine");
    expect(classifySolvedCache({ ...base, spec_engine_semver: undefined })).toBe("stale_engine");
    expect(classifySolvedCache({ ...base, recomputed_spec_hash: "zzzzzz" })).toBe("stale_spec");
    expect(classifySolvedCache({ ...base, solved: undefined })).toBe("absent");
  });
});

describe("share stamps (05 §8.1 — typed validation, verbatim rules)", () => {
  it("engine_semver: absent is legal; the pinned regex rejects everything else", () => {
    expect(validateEngineSemver(undefined, "engine_semver")).toEqual({ ok: true, value: undefined });
    expect(validateEngineSemver("1.4.2", "engine_semver")).toEqual({ ok: true, value: "1.4.2" });
    const bad = validateEngineSemver("1.4", "engine_semver");
    expect(bad.ok).toBe(false);
    if (!bad.ok) {
      expect(bad.error.code).toBe("SCHEMA");
      expect(bad.error.detail?.["reason"]).toBe("bad_engine_semver");
    }
  });

  it("expected without an engine_semver is rejected — expectation without an engine to expect it from", () => {
    const r = validateExpectedStamp({ outcome: "contained", result_hash: "abc123" }, false, "expected");
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.code).toBe("SCHEMA");
      expect(r.error.detail?.["reason"]).toBe("expectation_without_engine");
    }
  });

  it("expected.outcome must be a member of the closed outcome set (clean is NOT an outcome)", () => {
    const r = validateExpectedStamp({ outcome: "clean", result_hash: "abc123" }, true, "expected");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.detail?.["reason"]).toBe("expected_outcome_not_closed");
  });

  it("expected.result_hash must be 6 lowercase hex chars", () => {
    const r = validateExpectedStamp({ outcome: "contained", result_hash: "ABC123" }, true, "expected");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.detail?.["reason"]).toBe("bad_result_hash_format");
  });

  it("a well-formed stamp parses; stampExpected lifts exactly {outcome, result_hash} off a sealed verdict", () => {
    const v = sealed();
    const stamp = stampExpected(v);
    expect(stamp).toEqual({ outcome: "contained", result_hash: v.result_hash });
    const r = validateExpectedStamp(stamp, true, "expected");
    expect(r).toEqual({ ok: true, value: stamp });
  });
});

// ---------------------------------------------------------------------------
// The result_hash exclusion-set property (05 §8.3; ARCHITECTURE §6.3)

describe("result_hash exclusion set (D29 + D45: {result_hash, diagnosis, cache, skew, commitment})", () => {
  const base = sealed();
  const baseHash = base.result_hash;

  it("a sealed verdict's stamp recomputes over itself (rounding is idempotent, exclusions strip the stamp)", () => {
    expect(baseHash).toMatch(/^[0-9a-f]{6}$/);
    expect(hashOf(base)).toBe(baseHash);
  });

  it("determinism: two independent assemblies of the same record hash identically", () => {
    expect(sealed().result_hash).toBe(baseHash);
  });

  it("mutating ANY excluded field never moves the hash", () => {
    const withDiagnosis: Verdict = {
      ...base,
      diagnosis: { cause: "stand_up", at_s: 61.234567, corner_id: "c1", detail: { note: "chop" } }
    };
    expect(hashOf(withDiagnosis)).toBe(baseHash);
    const withStamp: Verdict = { ...base, result_hash: "000000" };
    expect(hashOf(withStamp)).toBe(baseHash);
    // cache/skew/commitment are not verdict members; if one ever leaks in, the
    // exclusion set still strips it (defensive arm of the same law)
    const withJunk = {
      ...base,
      cache: "hit",
      skew: { tier: "story" },
      commitment: { probes: [] }
    } as unknown as Verdict;
    expect(hashOf(withJunk)).toBe(baseHash);
  });

  it("mutating EVERY included top-level field moves the hash (completeness-guarded)", () => {
    const mj: MisjudgmentBlock = {
      believed_road_hash: "abc123",
      s_divergence_m: 30,
      divergence: { kind: "radius", corner_id: "c1", believed: 27, actual: 15 },
      kappa_gap: { max_abs_1pm: 0.029, at_s: 45 },
      believed: { outcome: "clean", spec_hash: "abc123", result_hash: "def456" },
      actions_unreached: ["t2"]
    };
    const mutations: Record<string, (v: Verdict) => Verdict> = {
      ok: (v) => ({ ...v, ok: !v.ok }),
      spec_hash: (v) => ({ ...v, spec_hash: "ffffff" }),
      checks_version: (v) => ({ ...v, checks_version: 3 as unknown as 2 }),
      rubric: (v) => ({ ...v, rubric: "other/9" }),
      engine: (v) => ({ ...v, engine: "linelab/9" as typeof v.engine }),
      outcome: (v) => ({ ...v, outcome: "stopped" }),
      quality: (v) => ({ ...v, quality: "caution" }),
      headline: (v) => ({ ...v, headline: `${v.headline} (edited)` }),
      acceptance: (v) => ({ ...v, acceptance: { ...v.acceptance, policy: "best_failing" } }),
      misjudgment: (v) => ({ ...v, misjudgment: mj }),
      validity: (v) => ({ ...v, validity: { below_validity_s: 1.25 } }),
      corners: (v) => ({
        ...v,
        corners: v.corners.map((c) => ({ ...c, lean_max_deg: c.lean_max_deg + 1 }))
      }),
      sight: (v) => ({
        ...v,
        sight: v.sight === null ? null : { ...v.sight, margin_min_m: v.sight.margin_min_m + 1 }
      }),
      constraints: (v) => ({
        ...v,
        constraints: [
          { id: "k1", bound: "v_max_kmh", value: 60, satisfied: true, worst: { s: 50, value: 55, margin: 5 } }
        ]
      }),
      doctrine: (v) => ({ ...v, doctrine: { ...v.doctrine, fail: v.doctrine.fail + 1 } })
    };
    // completeness guard: a future verdict field must be added to this table
    const included = Object.keys(base).filter(
      (k) => !(RESULT_HASH_EXCLUSIONS as readonly string[]).includes(k)
    );
    expect(included.sort()).toEqual(Object.keys(mutations).sort());
    for (const [key, mutate] of Object.entries(mutations)) {
      expect(hashOf(mutate(base)), `mutating "${key}" must move result_hash`).not.toBe(baseHash);
    }
  });

  it("rounding is INSIDE the hash input: sub-resolution wiggles never move the hash, visible ones do", () => {
    const bumpLean = (v: Verdict, d: number): Verdict => ({
      ...v,
      corners: v.corners.map((c) => ({ ...c, lean_max_deg: c.lean_max_deg + d }))
    });
    const bumpApexF = (v: Verdict, d: number): Verdict => ({
      ...v,
      corners: v.corners.map((c) => ({
        ...c,
        apexes: c.apexes.map((a) => ({ ...a, f: a.f + d }))
      }))
    });
    expect(hashOf(bumpLean(base, 0.002))).toBe(baseHash);   // 2 dp: 31.512 → 31.51
    expect(hashOf(bumpLean(base, 0.02))).not.toBe(baseHash); // 31.53 ≠ 31.51
    expect(hashOf(bumpApexF(base, 0.0002))).toBe(baseHash);   // 3 dp: 0.1233 → 0.123
    expect(hashOf(bumpApexF(base, 0.002))).not.toBe(baseHash); // 0.1251 → 0.125
  });

  it("result_hash covers the resolved plan (D29) and the roll_rate cap when present", () => {
    const otherPlan = resultHash(base, {
      plan: [{ do: "turn_in", id: "t1", at_s: 44, target: { lean_deg: 28 }, hand: "R" }]
    });
    if (!otherPlan.ok) throw new Error("hash refused");
    expect(otherPlan.value).not.toBe(baseHash);
    const withCap = resultHash(base, { plan: PLAN, roll_rate_cap_dps: 30 });
    if (!withCap.ok) throw new Error("hash refused");
    expect(withCap.value).not.toBe(baseHash);
  });
});

// ---------------------------------------------------------------------------
// Emission rounding (05 §8.3 — the ONE policy, solve/emit.ts)

describe("emission rounding policy (2 dp default, 3 dp fractions, 1 dp pct)", () => {
  it("classifies keys per the pinned buckets", () => {
    expect(emissionDpFor("s")).toBe(2);
    expect(emissionDpFor("lean_max_deg")).toBe(2);
    expect(emissionDpFor("v_kmh")).toBe(2);
    expect(emissionDpFor("f")).toBe(3);
    expect(emissionDpFor("grip")).toBe(3);
    expect(emissionDpFor("grip_min")).toBe(3);
    expect(emissionDpFor("n_long")).toBe(3);
    expect(emissionDpFor("n_lat")).toBe(3);
    expect(emissionDpFor("target_f")).toBe(3);
    expect(emissionDpFor("achieved_f")).toBe(3);
    expect(emissionDpFor("pct")).toBe(1);
  });

  it("max_abs_1pm (1/m curvature) is NOT a fraction: 05 §8.3's letter gives it the 2-dp default (PENDING RATIFICATION of a curvature bucket)", () => {
    expect(emissionDpFor("max_abs_1pm")).toBe(2);
    const out = roundEmission({ kappa_gap: { max_abs_1pm: 0.0291, at_s: 45.123 } }) as {
      kappa_gap: { max_abs_1pm: number; at_s: number };
    };
    expect(out.kappa_gap.max_abs_1pm).toBe(0.03);
    expect(out.kappa_gap.at_s).toBe(45.12);
  });

  it("ConstraintRow value/worst round by the BOUND's type: f bounds are fractions (3 dp), km/h and metre bounds default (2 dp), worst.s is always metres", () => {
    const rows = [
      {
        id: "k1", bound: "f_max", value: 0.85149, satisfied: true,
        worst: { s: 51.23456, value: 0.84912, margin: 0.00237 }
      },
      {
        id: "k2", bound: "v_max_kmh", value: 60.12345, satisfied: true,
        worst: { s: 44.5678, value: 55.5555, margin: 4.5679 }
      }
    ];
    const out = roundEmission(rows) as typeof rows;
    // f_max: fraction-typed per 05 §8.3 (fractions → 3 dp)
    expect(out[0]!.value).toBe(0.851);
    expect(out[0]!.worst.value).toBe(0.849);
    expect(out[0]!.worst.margin).toBe(0.002);
    expect(out[0]!.worst.s).toBe(51.23); // metres, 2 dp — never inherits the f bucket
    // v_max_kmh: km/h-typed → 2-dp default throughout
    expect(out[1]!.value).toBe(60.12);
    expect(out[1]!.worst.value).toBe(55.56);
    expect(out[1]!.worst.margin).toBe(4.57);
    expect(out[1]!.worst.s).toBe(44.57);
  });

  it("rounds via Number(x.toFixed(dp)) and normalizes -0 to 0", () => {
    const out = roundEmission({ s: 12.345678, f: 0.123456, pct: 52.34, d: -0.0001 }) as {
      s: number; f: number; pct: number; d: number;
    };
    expect(out.s).toBe(12.35);
    expect(out.f).toBe(0.123);
    expect(out.pct).toBe(52.3);
    expect(Object.is(out.d, 0)).toBe(true); // never -0
  });

  it("passes strings/booleans/null through and never mutates its (frozen) input", () => {
    const input = Object.freeze({ outcome: "contained", ok: true, diagnosis: null, s: 1.005 });
    const out = roundEmission(input) as typeof input;
    expect(out.outcome).toBe("contained");
    expect(out.ok).toBe(true);
    expect(out.diagnosis).toBeNull();
    expect(input.s).toBe(1.005);
  });
});

// ---------------------------------------------------------------------------
// C-SAVEWIN-NO-INK — the trivial v0.1 sentinel: no save-window (or any other
// v0.2/D45) surface exists anywhere in the envelope. The full gate (SVG
// byte-identity with the overlay off) arrives with the save-window feature.

describe("C-SAVEWIN-NO-INK (v0.1 trivial sentinel — the phase law: absent, not stubbed)", () => {
  it("the envelope carries no save-window, standing, or commitment members", () => {
    const fig = buildFigureResult({
      figure_id: "fig-sentinel",
      road: fakeRoad,
      occluders: [],
      hazards: [],
      lines: [mkLineResult()]
    });
    const json = JSON.stringify(fig);
    for (const token of ["save_window", "saveWindow", "standing", "commitment"]) {
      expect(json.includes(token), `"${token}" must not exist in a v0.1 envelope`).toBe(false);
    }
    expect(Object.keys(fig).sort()).toEqual(
      ["figure_id", "hazards", "lines", "meta", "occluders", "road", "skew", "spec"]
    );
    expect("commitment" in sealed()).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Closed-set double entry (drift risk #12): the wire vocabulary this package
// declares, retyped independently here and compared.

describe("closed-set enumerations (solve/types.ts)", () => {
  it("NO_SOLUTION sub-reason registry is exactly 04 §4.10's 15 names, in order", () => {
    expect(NO_SOLUTION_SUB_REASONS).toEqual([
      "turn_in_infeasible_early",
      "turn_in_infeasible_late",
      "empty_band",
      "non_clean_band",
      "coarse_fine_disagreement",
      "constraint_unmet",
      "road_too_short",
      "no_double_apex_geometry",
      "no_two_touch_line",
      "believed_world_not_clean",
      "no_rankable_candidate",
      "authored_action_conflict",
      "link_flip_infeasible",
      "vis_unsatisfiable_within_bound",
      "vis_speed_below_model_floor"
    ]);
  });

  it("cache states, skew tiers, and diagnosis causes are the pinned closed sets", () => {
    expect(CACHE_STATES).toEqual(["hit", "stale_engine", "stale_spec", "absent"]);
    expect(LINE_SKEW_TIERS).toEqual(["match", "unstamped", "detail", "story"]);
    expect(FIGURE_SKEW_TIERS).toEqual(["match", "info", "detail", "story"]);
    expect(DIAGNOSIS_CAUSES).toEqual([
      "overspeed_entry", "grip_exceeded", "roll_rate_limited",
      "sight_deficit", "late_brake", "plan_gap", "stand_up"
    ]);
  });
});
