// test/property/corrective-verdict-wiring.test.ts — the `departed_before_reaction`
// verdict-wiring lock (design/04 §4a.6; the fig-08-05 `late` seam).
//
// Teaching note: when a misjudged line runs wide into a hard outer edge, the
// corrective shot may be attempted but INFEASIBLE because the line departs the
// physical edge before a reaction is even possible (`departed_before_reaction`,
// 04 §4a.3). On that arm there is no on-line shot instant, so the `correction`
// event is NOT emitted — but the corrective block IS still published, carrying
// `{feasible: false, shot: null, fail_reason: "departed_before_reaction"}`
// (04 §4a.6). That block is IN-HASH, so it must reach `verdict.corners[c].corrective`
// as a real object — never dropped to `undefined`, never fabricated on a corner
// that never ran wide.
//
// This is the invariant the fig-08-05 adjudication calls "Problem [B]": the
// block lives PER-CORNER (`verdict.corners[c1].corrective`); the `Verdict` type
// has no top-level `corrective`. wire.test.ts exercises the FEASIBLE block and a
// non-attempted `null`, and it feeds an INFEASIBLE `shadow_off_road` block only
// to check the resulting quality — it never asserts a `departed_before_reaction`
// block (shot:null) is PUBLISHED into the corner row. That publication is what
// this file pins.

import { describe, it, expect } from "vitest";

import type {
  Corner,
  Event,
  ResolvedPlanAction,
  Sample,
  Terminated,
  Trajectory
} from "../../src/core/types.js";
import { buildTrajectory } from "../../src/core/record.js";
import type { CornerRow } from "../../src/core/analyze.js";
import { loadRubricPack } from "../../src/plan/doctrine/pack.js";
import type { CheckResult, DoctrineBlock } from "../../src/plan/doctrine/types.js";
import parksStreetJson from "../../src/plan/doctrine/packs/parks-street.json" with { type: "json" };
import { assembleVerdict } from "../../src/solve/verdict.js";
import type { VerdictInput } from "../../src/solve/verdict.js";
import type { CorrectiveBlock } from "../../src/solve/corrective.js";

// ---------------------------------------------------------------------------
// Minimal hand-built fixtures (no engine, no validate): the verdict-assembly
// wiring is exercised exactly as WP-09's pipeline hands it in.

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

/** Samples every 5 m up to s=20 (t = s/15); the line departs the outer edge at s≈18. */
function ranWideSamples(): Sample[] {
  const out: Sample[] = [];
  for (let s = 0; s <= 20; s += 5) out.push(mkSample({ s, t: s / 15, x: s }));
  return out;
}

function terminated(reason: Terminated["reason"], s: number): Terminated {
  return { reason, s, t: s / 15, x: s, y: 0 };
}

const cornerC1: Corner = {
  id: "c1", hand: "L", s0: 10, s1: 18, s_mid: 14, r: 12, angle_deg: 38.2,
  type: "constant", r_min: 12, r_max: 12, linked_next: false
};

const rowC1: CornerRow = {
  id: "c1", hand: "L", corner_type: "constant",
  apexes: [], lean_max_deg: 20.4, grip_min: 0.71, danger_dwell_s: 0,
  exit: { s: 18, d: 0, f: 1.15, heading_err_deg: 1.0 }
};

const PLAN: ResolvedPlanAction[] = [
  { do: "turn_in", id: "t1", at_s: 10, target: { lean_deg: 15 }, hand: "L" }
];

const EV_TURN_IN: Event = { kind: "turn_in", s: 10, t: 10 / 15, corner_id: "c1", action_id: "t1" };
// the run_wide_detect the corrective machinery mints on the main line (§4a.2):
const EV_DETECT: Event = { kind: "run_wide_detect", s: 15.81, t: 2.26, corner_id: "c1", detail: { f: 1.01 } };

// the exact block corrective.ts publishes on the departed_before_reaction arm
// (04 §4a.6): shot null (no on-line instant), returned null, feasible false.
const DEPARTED: CorrectiveBlock = {
  feasible: false,
  detect: { s: 15.81, f: 1.01 },
  shot: null,
  returned: null,
  fail_reason: "departed_before_reaction"
};

function checkRes(id: string, verdict: CheckResult["verdict"]): CheckResult {
  return { id, scope: "corner", corner_id: "c1", pair: null, verdict, evidence: { message: `${id}: ${verdict}` } };
}
function doctrineOf(checks: readonly CheckResult[]): DoctrineBlock {
  const count = (v: CheckResult["verdict"]): number => checks.filter((c) => c.verdict === v).length;
  return { pass: count("pass"), fail: count("fail"), warn: count("warn"), na: count("na"), checks };
}
const ONE_FAIL = doctrineOf([checkRes("late_apex", "fail"), checkRes("lean_ceiling", "pass")]);

function assembled(over: Partial<VerdictInput>): VerdictInput {
  return {
    trajectory: buildTrajectory(ranWideSamples(), [EV_TURN_IN, EV_DETECT], terminated("off_road", 18)),
    corner_rows: [rowC1],
    road_corners: [cornerC1],
    resolved_plan: PLAN,
    doctrine: ONE_FAIL,
    pack: PACK,
    spec_hash: "aaaaaa",
    ...over
  };
}

// ---------------------------------------------------------------------------

describe("departed_before_reaction: the {feasible:false} block is PUBLISHED into verdict.corners[c].corrective (04 §4a.6; fig-08-05 Problem [B])", () => {
  it("an attempted-but-infeasible corrective (shot null) rides corners[c1].corrective — not undefined, not null — and grades runoff", () => {
    const r = assembleVerdict(assembled({ correctives: [{ corner_id: "c1", block: DEPARTED }] }));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const v = r.value;

    expect(v.outcome).toBe("runoff");

    const c1 = v.corners.find((c) => c.id === "c1")!;
    expect(c1.ran_wide).toBe(true);
    // the block is a REAL published object — the whole point of Problem [B]
    expect("corrective" in c1).toBe(true);
    expect(c1.corrective).not.toBeUndefined();
    expect(c1.corrective).not.toBeNull();
    expect(c1.corrective).toEqual(DEPARTED);
    // and its infeasible shape survives verbatim (in-hash, ARCHITECTURE §6.3)
    expect(c1.corrective!.feasible).toBe(false);
    expect(c1.corrective!.shot).toBeNull();
    expect(c1.corrective!.fail_reason).toBe("departed_before_reaction");
  });

  it("the Verdict carries NO top-level `corrective` — the block lives per-corner (the [B] misread)", () => {
    const r = assembleVerdict(assembled({ correctives: [{ corner_id: "c1", block: DEPARTED }] }));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect("corrective" in (r.value as Record<string, unknown>)).toBe(false);
  });

  it("hash discipline: a corner that never ran wide gets corrective: null — never a fabricated {feasible:false} block", () => {
    // no detect event, no corrective supplied → the corner never attempted a shot
    const r = assembleVerdict({
      trajectory: buildTrajectory(ranWideSamples(), [EV_TURN_IN], terminated("road_end", 20)),
      corner_rows: [rowC1],
      road_corners: [cornerC1],
      resolved_plan: PLAN,
      doctrine: ONE_FAIL,
      pack: PACK,
      spec_hash: "aaaaaa"
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const c1 = r.value.corners.find((c) => c.id === "c1")!;
    expect(c1.ran_wide).toBe(false);
    expect(c1.corrective).toBeNull();
  });
});
