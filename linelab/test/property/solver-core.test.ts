// test/property/solver-core.test.ts — WP-10 gates (ARCHITECTURE §7):
// derived-station worked numbers (design/04 §4.1a, quoted), the solve
// pipeline's clean verdicts on C30 and book90, P-CONSTRAINT-BINDING (R6),
// P-ACCEPT-MONOTONE / P-ACCEPT-GRADE / P-ACCEPT-CONSTRAINT (F-CONSTRAINT-HARD),
// P-APEX-TARGET-TYPED, A-SOLVER-FIT, A-SOLVED-PLAN-VALIDATES, and the §4.9
// merge-contract arms.
//
// Assertion discipline: error code + detail.reason / detail.sub_reason, never
// message text (ARCHITECTURE §4). Engine-emergent values are pinned as
// INVARIANTS (containment, kiss band, check verdicts, bands), not as fragile
// floats, except where the design gives worked numbers.

import { describe, expect, it } from "vitest";
import { compose } from "../../src/road/compose.js";
import { PRESETS, PRESET_NAMES } from "../../src/road/presets.js";
import { validate } from "../../src/plan/validate.js";
import { RIDER_PROFILES } from "../../src/core/constants.js";
import { muUse, phiReserve, speedForLean } from "../../src/core/slice.js";
import {
  decelBracketAt,
  deriveStations,
  rollOnBracketAt,
  vTargetMs
} from "../../src/solve/stations.js";
import { KISS_TOL_F, lean_frac, SUGGEST_TOPN, N_SWEEP } from "../../src/solve/constants.js";
import {
  buildSolveContext,
  executeLine,
  fullSolveAtStation,
  solve,
  type SolveInput
} from "../../src/solve/solve.js";
import { suggestTurnIn } from "../../src/solve/suggest.js";
import { mergeAuthoredPlan } from "../../src/solve/merge.js";
import type { LineResult } from "../../src/solve/types.js";
import type { RoadModel } from "../../src/core/types.js";

const C30_DSL = "lane 3.5 | S 35 | R 30 ^90 | S 25";
const R6_DSL = "lane 3.5 | S 12 | R 12 ^90 | S 16"; // 09 §3.5's R6 spelling (see hand note below)
// F-CONSTRAINT-HARD (`R 25 ^90 @55`): the COMMITTED design/08 §6(f) spelling —
// `S 20` approach, `S 25` exit, and the authored bound is the recipe's own
// stay-wide token `f>=0.6@entry:c1..mid:c1` (fixture_geometry.py check 16: the
// inside line needs 47.37° > phiMax 45°, so the line that fails on lean is the
// natural best-failing case and the f_min bound is what must stay hard).
const FCH_DSL = "lane 3.5 | S 20 | R 25 ^90 | S 25";
const FCH_CONSTRAINTS = [
  { id: "staywide", span: { from: "entry:c1", to: "mid:c1" }, bound: "f_min" as const, value: 0.6 }
];

function composed(dsl: string): RoadModel {
  const r = compose({ dsl });
  if (!r.ok) throw new Error(`compose failed: ${r.error.message}`);
  return r.value;
}

function solved(spec: SolveInput): LineResult {
  const r = solve(spec);
  if (!r.ok) {
    throw new Error(`solve refused: ${r.error.code} ${JSON.stringify(r.error.detail)}`);
  }
  return r.value;
}

function refusal(spec: SolveInput): { code: string; detail: Record<string, unknown> } {
  const r = solve(spec);
  if (r.ok) throw new Error("expected a refusal, got a line");
  return { code: r.error.code, detail: (r.error.detail ?? {}) as Record<string, unknown> };
}

/** Rebuild the wire scenario a LineResult's resolved_scenario denotes (dsl road form). */
function wireOf(line: LineResult): Record<string, unknown> {
  const rs = line.resolved_scenario;
  return {
    spec: "linelab/1",
    id: rs.id,
    road: { dsl: rs.road.dsl, bike_margin_m: rs.road.bike_margin_m, use_full_width: rs.road.use_full_width },
    rider: {
      profile: rs.rider.profile,
      start: rs.rider.start,
      plan: rs.rider.plan.map((a) => ({ ...a }))
    },
    config: { mu: rs.config.mu }
  };
}

// ---------------------------------------------------------------------------
// Derived stations — the §4.1a worked numbers, quoted from design/04:
//
//   "book90 (`lane 3.5 | S 12 | L 12 ^90 | S 16`: L_app 12, L_arc 18.85,
//    L_exit 16), entry 34 km/h: sweep `[6.0, 16.71]` (12 candidates ≈ 0.97 m
//    apart …), brake_gap 3.0 m, crack_gap 4.71 m, roll-on bracket at
//    `s_ti = 13` `[18.7, 30.85]`"                                (lines 170–175)
//
//   "C30 (L_app 35, L_arc 47.12, L_exit 25), entry 70 km/h: sweep
//    `[18.5, 46.78]`, brake_gap clamps to 6.0 m with the fit clip raising the
//    decel bracket to `[3.67, 3.8]` (narrow but valid), roll-on bracket
//    `[45.4, 80.8]`."                                            (lines 175–177)
//
//   "at a true zero-gap link the backward sweep term vanishes with `L_app = 0`
//    — turn-in candidates start at the hand-flip boundary"       (lines 179–181)

describe("derived stations (design/04 §4.1a worked numbers)", () => {
  const street = RIDER_PROFILES.street;

  it("book90: reference lengths, sweep [6.0, 16.71], brake_gap 3.0, crack_gap 4.71", () => {
    const road = composed(PRESETS.book90.dsl);
    const st = deriveStations(road, 0);
    expect(st.ok).toBe(true);
    if (!st.ok) return;
    expect(st.value.ref.L_app).toBeCloseTo(12, 6);
    expect(st.value.ref.L_arc).toBeCloseTo(18.8496, 3);
    expect(st.value.ref.L_exit).toBeCloseTo(16, 6);
    expect(st.value.sweep.lo).toBeCloseTo(6.0, 2);
    expect(st.value.sweep.hi).toBeCloseTo(16.71, 2);
    expect(st.value.sweep.candidates).toHaveLength(N_SWEEP);
    const spacing = st.value.sweep.candidates[1]! - st.value.sweep.candidates[0]!;
    expect(spacing).toBeCloseTo(0.97, 2);
    expect(st.value.brake_gap_m).toBeCloseTo(3.0, 6);
    expect(st.value.s_brake_start).toBe(0);
    expect(st.value.crack_gap_m).toBeCloseTo(4.71, 2);
  });

  it("book90: roll-on bracket at s_ti = 13 is [18.7, 30.85]", () => {
    const road = composed(PRESETS.book90.dsl);
    const st = deriveStations(road, 0);
    if (!st.ok) throw new Error("stations refused");
    const bracket = rollOnBracketAt(st.value, 13);
    expect(bracket.ok).toBe(true);
    if (!bracket.ok) return;
    expect(bracket.value.lo).toBeCloseTo(18.71, 2);
    expect(bracket.value.hi).toBeCloseTo(30.85, 2);
  });

  it("C30: sweep [18.5, 46.78]; brake_gap clamps to 6.0", () => {
    const road = composed(C30_DSL);
    const st = deriveStations(road, 0);
    expect(st.ok).toBe(true);
    if (!st.ok) return;
    expect(st.value.ref.L_app).toBeCloseTo(35, 6);
    expect(st.value.ref.L_arc).toBeCloseTo(47.12, 2);
    expect(st.value.ref.L_exit).toBeCloseTo(25, 6);
    expect(st.value.sweep.lo).toBeCloseTo(18.51, 2);
    expect(st.value.sweep.hi).toBeCloseTo(46.78, 2);
    expect(st.value.brake_gap_m).toBeCloseTo(6.0, 6); // clamps at BRAKE_GAP_MAX_M
  });

  it("C30 @70: the fit clip raises the decel bracket to [3.67, 3.8] (at the doc's example candidate s0 + 1)", () => {
    const road = composed(C30_DSL);
    const st = deriveStations(road, 0);
    if (!st.ok) throw new Error("stations refused");
    // ARCHITECTURE §10 pin 15: v_target = speedForLean(r_min, lean_frac·phiReserve(mu_use))
    const vTarget = vTargetMs(st.value.corner, street.skill, 1.0);
    expect(vTarget).toBeCloseTo(speedForLean(30, lean_frac * phiReserve(muUse(street.skill, 1.0))), 12);
    expect(vTarget).toBeCloseTo(12.58, 2);
    const bracket = decelBracketAt(st.value, 36, 70 / 3.6, vTarget);
    expect(bracket.ok).toBe(true);
    if (!bracket.ok) return;
    expect(bracket.value.lo).toBeCloseTo(3.67, 2);
    expect(bracket.value.hi).toBeCloseTo(3.8, 6);
    expect(bracket.value.decel_min_fit).toBeCloseTo(3.66, 1);
    // and the roll-on bracket at the same candidate is [45.4, 80.8]
    const roll = rollOnBracketAt(st.value, 36);
    expect(roll.ok).toBe(true);
    if (!roll.ok) return;
    expect(roll.value.lo).toBeCloseTo(45.4, 1);
    expect(roll.value.hi).toBeCloseTo(80.8, 1);
  });

  it("zero-gap link: L_app(c2) = 0 and the sweep starts at the hand-flip boundary", () => {
    const road = composed("lane 3.5 | S 8 | R 12 ^75 | L 12 ^75 | S 10");
    const st = deriveStations(road, 1);
    expect(st.ok).toBe(true);
    if (!st.ok) return;
    expect(st.value.ref.L_app).toBeCloseTo(0, 9);
    expect(st.value.sweep.lo).toBeCloseTo(road.corners[0]!.s1, 9);
  });

  it("refuses road_too_short/turn_in_sweep when the clamped span degenerates", () => {
    const road = composed("lane 3.5 | S 1 | R 5 ^30 | S 2");
    const st = deriveStations(road, 0);
    expect(st.ok).toBe(false);
    if (st.ok) return;
    expect(st.error.code).toBe("NO_SOLUTION");
    expect(st.error.detail?.["sub_reason"]).toBe("road_too_short");
    expect(st.error.detail?.["quantity"]).toBe("turn_in_sweep");
    expect(st.error.detail?.["corner_id"]).toBe("c1");
    expect(typeof st.error.detail?.["required_m"]).toBe("number");
    expect(typeof st.error.detail?.["available_m"]).toBe("number");
  });

  it("refuses road_too_short/brake_run when the entry speed cannot be shed (decel_min_fit > DECEL_HI)", () => {
    const road = composed("lane 3.5 | S 8 | R 30 ^90 | S 25");
    const st = deriveStations(road, 0);
    if (!st.ok) throw new Error("stations refused");
    const vTarget = vTargetMs(st.value.corner, street.skill, 1.0);
    const bracket = decelBracketAt(st.value, 9, 70 / 3.6, vTarget);
    expect(bracket.ok).toBe(false);
    if (bracket.ok) return;
    expect(bracket.error.detail?.["sub_reason"]).toBe("road_too_short");
    expect(bracket.error.detail?.["quantity"]).toBe("brake_run");
    // pin 15: a NON-POSITIVE braking run folds into the same refusal
    const degenerate = decelBracketAt(st.value, st.value.brake_gap_m - 0.5, 70 / 3.6, vTarget);
    expect(degenerate.ok).toBe(false);
    if (degenerate.ok) return;
    expect(degenerate.error.detail?.["quantity"]).toBe("brake_run");
  });

  it("refuses road_too_short/roll_on_bracket when the clamped bracket is narrower than BRACKET_MIN_M", () => {
    const road = composed("lane 3.5 | S 10 | R 8 ^30 | S 10");
    const st = deriveStations(road, 0);
    if (!st.ok) throw new Error("stations refused");
    const bracket = rollOnBracketAt(st.value, road.corners[0]!.s0);
    expect(bracket.ok).toBe(false);
    if (bracket.ok) return;
    expect(bracket.error.detail?.["sub_reason"]).toBe("road_too_short");
    expect(bracket.error.detail?.["quantity"]).toBe("roll_on_bracket");
  });
});

// ---------------------------------------------------------------------------
// The pipeline solves book90 and C30 to clean verdicts (§8 DONE row).
//
// ENGINE-TRUTH NOTE (ratification pointer, see the WP-10 report): C30's
// canonical 02 §8 entry of 70 km/h is jointly infeasible under the frozen
// physics — braking to the §4.1a fit-clipped corner speed and completing the
// 50°/s commit ramp cannot both fit the 35 m approach, so every 70 km/h line
// breaches the own-lane corridor during the roll-in. The clean band tops out
// near 63 km/h; 70 is pinned below as a TYPED refusal so the truth is a test,
// not a surprise.

describe("solve — clean verdicts on the canonical corners", () => {
  it("book90 @34 solves clean: contained, quality good, canonical four actions", { timeout: 300_000 }, () => {
    const line = solved({ road: "book90", entry_kmh: 34 });
    const v = line.verdict;
    expect(v.ok).toBe(true);
    expect(v.outcome).toBe("contained");
    expect(v.quality).toBe("good");
    expect(v.acceptance).toEqual({ policy: "clean", met: true });
    expect(v.doctrine.fail).toBe(0);
    // canonical four actions: brake, maintenance crack (throttle 0), explicit
    // signed turn-in, drive roll-on — tangent_inside literalized away
    const plan = line.resolved_scenario.rider.plan;
    expect(plan.filter((a) => a.do === "brake")).toHaveLength(1);
    expect(plan.filter((a) => a.do === "turn_in")).toHaveLength(1);
    expect(plan.filter((a) => a.do === "throttle" && a.accel === 0)).toHaveLength(1);
    expect(plan.filter((a) => a.do === "throttle" && a.accel > 0)).toHaveLength(1);
    const ti = plan.find((a) => a.do === "turn_in")!;
    expect(ti.do === "turn_in" && typeof ti.target.lean_deg).toBe("number");
    expect(ti.do === "turn_in" && ti.hand).toBe("L");
    // the emergent apex is a late apex past the constant-radius bar
    const corner = v.corners[0]!;
    expect(corner.apexes.length).toBeGreaterThan(0);
    expect(corner.apexes[corner.apexes.length - 1]!.pct).toBeGreaterThan(50);
  });

  it("C30 @63 solves clean and the apex KISSES the inner edge (raw samples)", { timeout: 300_000 }, () => {
    const line = solved({ road: C30_DSL, entry_kmh: 63 });
    const v = line.verdict;
    expect(v.ok).toBe(true);
    expect(v.outcome).toBe("contained");
    expect(v.quality).toBe("good");
    // kiss band from RAW pre-emission samples, window re-derived from the DSL
    const road = composed(C30_DSL);
    const c1 = road.corners[0]!;
    let minF = Number.POSITIVE_INFINITY;
    for (const s of line.trajectory.samples) {
      if (s.s >= c1.s0 && s.s <= c1.s1 && s.f < minF) minF = s.f;
    }
    expect(minF).toBeLessThanOrEqual(KISS_TOL_F);
    expect(minF).toBeGreaterThanOrEqual(-0.02);
  });

  it("C30 @70 (the 02 §8 canonical entry) refuses TYPED — engine truth, pending ratification", { timeout: 300_000 }, () => {
    const r = refusal({ road: C30_DSL, entry_kmh: 70 });
    expect(r.code).toBe("NO_SOLUTION");
    expect(r.detail["sub_reason"]).toBe("empty_band");
  });

  it("A-SOLVED-PLAN-VALIDATES: solver-emitted plans pass validate() unchanged", { timeout: 300_000 }, () => {
    for (const line of [solved({ road: "book90", entry_kmh: 34 }), solved({ road: C30_DSL, entry_kmh: 63 })]) {
      const again = validate(wireOf(line));
      expect(again.ok).toBe(true);
      if (!again.ok) continue;
      expect(again.value.rider.plan).toEqual(line.resolved_scenario.rider.plan);
    }
  });

  it("suggestTurnIn is the auto pipeline: identical line to solve(turn_in: auto)", { timeout: 300_000 }, () => {
    const a = solved({ road: "book90", entry_kmh: 34 });
    const b = suggestTurnIn({ road: "book90", entry_kmh: 34 });
    expect(b.ok).toBe(true);
    if (!b.ok) return;
    expect(b.value.verdict.result_hash).toBe(a.verdict.result_hash);
    // a pinned turn-in on a *suggestion* call is dead input
    const pinned = suggestTurnIn({ road: "book90", entry_kmh: 34, turn_in: 8 });
    expect(pinned.ok).toBe(false);
    if (pinned.ok) return;
    expect(pinned.error.code).toBe("INEFFECTUAL");
    expect(pinned.error.detail?.["reason"]).toBe("turn_in_pinned_on_suggest");
  });
});

// ---------------------------------------------------------------------------
// P-CONSTRAINT-BINDING (design/09 §3.5) — R6's `R 12 ^90 @34` geometry.
// Hand note (recorded deviation): the own-lane corridor is NOT mirror-
// symmetric — an R-hand `R 12` puts the usable corridor at radii [8.9, 11.6],
// which does not solve clean at 34 km/h under the frozen roll-rate physics.
// The L-hand twin (the book90 preset, same `R 12 ^90 @34` arithmetic) is the
// "comfortable" fixture the design describes, and hosts the property.

describe("P-CONSTRAINT-BINDING (R6)", () => {
  const road = "book90";
  const spanFrom = "mid:c1";
  const spanTo = "exit:c1";

  it("every returned line satisfies every constraint at every retained sample of its span", { timeout: 300_000 }, () => {
    const baseline = solved({ road, entry_kmh: 34 });
    // deterministic value sweep (the 09 fuzz axis, listed so the suite is replayable)
    for (const value of [0.6, 0.7, 0.8]) {
      const line = solved({
        road,
        entry_kmh: 34,
        constraints: [{ id: "cap", span: { from: spanFrom, to: spanTo }, bound: "f_max", value }]
      });
      const model = composed(PRESETS.book90.dsl);
      const c1 = model.corners[0]!;
      for (const s of line.trajectory.samples) {
        if (s.s >= c1.s_mid - 1e-9 && s.s <= c1.s1 + 1e-9) {
          expect(s.f).toBeLessThanOrEqual(value + 1e-6);
        }
      }
      // per-bound evaluation recorded in the verdict, all satisfied (05 §6.3)
      expect(line.verdict.constraints).not.toBeNull();
      const row = line.verdict.constraints!.find((r) => r.id === "cap")!;
      expect(row.satisfied).toBe(true);
      expect(row.bound).toBe("f_max");
      expect(row.worst.margin).toBeGreaterThanOrEqual(-1e-9);
      // a BINDING bound changes the accepted line (the exit target clips 0.85 → value)
      if (value < 0.8) {
        expect(line.verdict.result_hash).not.toBe(baseline.verdict.result_hash);
      }
    }
  });

  it("an unsatisfiable bound refuses NO_SOLUTION/constraint_unmet naming the id and worst station", { timeout: 300_000 }, () => {
    const r = refusal({
      road,
      entry_kmh: 34,
      constraints: [{ id: "hold", span: { from: "entry:c1", to: "exit:c1" }, bound: "f_min", value: 0.9 }]
    });
    expect(r.code).toBe("NO_SOLUTION");
    expect(r.detail["sub_reason"]).toBe("constraint_unmet");
    expect(r.detail["constraint_id"]).toBe("hold");
    expect(typeof r.detail["worst_s"]).toBe("number");
    expect(typeof r.detail["achieved"]).toBe("number");
    expect(r.detail["required"]).toBe(0.9);
  });

  it("the bound vocabulary is closed: an unknown bound rejects SCHEMA", () => {
    const r = refusal({
      road,
      entry_kmh: 34,
      constraints: [{ id: "x", span: { at: "mid:c1" }, bound: "v_min_kmh" as never, value: 10 }]
    });
    expect(r.code).toBe("SCHEMA");
    expect(r.detail["reason"]).toBe("constraint_bound_unknown");
  });
});

// ---------------------------------------------------------------------------
// Acceptance policy (design/04 §4.8, D24)

describe("acceptance policy", () => {
  it("accept outside the closed enum rejects SCHEMA", () => {
    const r = refusal({ road: "book90", entry_kmh: 34, accept: "sloppy" as never });
    expect(r.code).toBe("SCHEMA");
    expect(r.detail["reason"]).toBe("accept_policy_unknown");
  });

  it("P-ACCEPT-MONOTONE: when clean succeeds, best_failing returns the identical line (modulo the acceptance stamp)", { timeout: 300_000 }, () => {
    const clean = solved({ road: "book90", entry_kmh: 34 });
    const bf = solved({ road: "book90", entry_kmh: 34, accept: "best_failing" });
    expect(bf.verdict.acceptance).toEqual({ policy: "best_failing", met: true });
    expect(JSON.stringify(bf.resolved_scenario.rider.plan)).toBe(
      JSON.stringify(clean.resolved_scenario.rider.plan)
    );
    expect(bf.verdict.outcome).toBe(clean.verdict.outcome);
    expect(bf.verdict.doctrine).toEqual(clean.verdict.doctrine);
    expect(bf.trajectory.terminated).toEqual(clean.trajectory.terminated);
    // the acceptance block is IN-hash, so the stamped policy is the only
    // legitimate hash difference between the two returns
    expect(bf.verdict.spec_hash).not.toBe(clean.verdict.spec_hash); // source differs (accept field)
  });

  it("P-ACCEPT-CONSTRAINT (F-CONSTRAINT-HARD @55, the committed 08 §6(f) fixture): best_failing returns a FAILING line that still satisfies the authored stay-wide bound", { timeout: 300_000 }, () => {
    // clean arm: typed refusal, never a near-miss line
    const cleanArm = refusal({ road: FCH_DSL, entry_kmh: 55, constraints: FCH_CONSTRAINTS });
    expect(cleanArm.code).toBe("NO_SOLUTION");
    // best_failing arm: a ranked, self-verified line with its verbatim verdict
    const line = solved({ road: FCH_DSL, entry_kmh: 55, accept: "best_failing", constraints: FCH_CONSTRAINTS });
    expect(line.verdict.acceptance.policy).toBe("best_failing");
    expect(line.verdict.acceptance.met).toBe(false);
    expect(line.verdict.ok).toBe(false); // the requested result IS non-clean
    // D10 bounds stay hard under every accept policy: the returned line satisfies them
    expect(line.verdict.constraints).not.toBeNull();
    const row = line.verdict.constraints!.find((r) => r.id === "staywide")!;
    expect(row.satisfied).toBe(true);
    expect(row.bound).toBe("f_min");
    // and at the sample level: f >= 0.6 over entry:c1..mid:c1 (stay wide)
    const model = composed(FCH_DSL);
    const c1 = model.corners[0]!;
    let sampled = 0;
    for (const s of line.trajectory.samples) {
      if (s.s >= c1.s0 - 1e-9 && s.s <= c1.s_mid + 1e-9) {
        expect(s.f).toBeGreaterThanOrEqual(0.6 - 1e-6);
        sampled += 1;
      }
    }
    expect(sampled).toBeGreaterThan(0); // the bound was exercised, not vacuous
  });

  it("P-ACCEPT-GRADE: re-running the best_failing plan grades identically (policy never touches grading)", { timeout: 300_000 }, () => {
    const line = solved({ road: FCH_DSL, entry_kmh: 55, accept: "best_failing", constraints: FCH_CONSTRAINTS });
    const again = validate(wireOf(line));
    expect(again.ok).toBe(true);
    if (!again.ok) return;
    const road = composed(FCH_DSL);
    const st = deriveStations(road, 0);
    if (!st.ok) throw new Error("stations refused");
    const rerun = executeLine({
      validated: again.value,
      policy: "clean",
      source: { kind: "scenario", scenario: wireOf(line) as never },
      constraints: null,
      brake_gap_m: st.value.brake_gap_m
    });
    expect(rerun.ok).toBe(true);
    if (!rerun.ok) return;
    expect(rerun.value.verdict.outcome).toBe(line.verdict.outcome);
    expect(rerun.value.verdict.quality).toBe(line.verdict.quality);
    expect(rerun.value.verdict.doctrine.fail).toBe(line.verdict.doctrine.fail);
    expect(rerun.value.verdict.doctrine.checks.map((c) => [c.id, c.verdict])).toEqual(
      line.verdict.doctrine.checks.map((c) => [c.id, c.verdict])
    );
  });

  it("§4.8.1 probe symmetry: under clean the probe short-circuits TYPED; under best_failing the same placement stays in the pool, flagged probe_infeasible (the P-ACCEPT-MONOTONE anchor)", { timeout: 300_000 }, () => {
    const ctxR = buildSolveContext({ road: "book90", entry_kmh: 34 });
    expect(ctxR.ok).toBe(true);
    if (!ctxR.ok) return;
    const ctx = ctxR.value;
    // s_ti = 18 is past the sweep band: the apex never comes inside even at
    // phiReserve — the §4.2 probe refuses it
    const strict = fullSolveAtStation(ctx, 18, { short_circuit_probe: true });
    expect(strict.ok).toBe(false);
    if (!strict.ok) {
      expect(strict.error.code).toBe("NO_SOLUTION");
      expect(strict.error.detail?.["sub_reason"]).toBe("turn_in_infeasible_late");
    }
    // §4.8.1: an infeasible placement's candidate stays in the pool — full-
    // solved, self-verified, and FLAGGED so the pooling loop can replay
    // exactly which candidate accept=clean would have returned
    const loose = fullSolveAtStation(ctx, 18, { short_circuit_probe: false });
    expect(loose.ok).toBe(true);
    if (!loose.ok) return;
    expect(loose.value.probe_infeasible).toBe(true);
    // a feasible placement carries no flag under either policy
    const feasible = fullSolveAtStation(ctx, 13, { short_circuit_probe: false });
    expect(feasible.ok).toBe(true);
    if (feasible.ok) expect(feasible.value.probe_infeasible).toBe(false);
  });

  it("P-ACCEPT-MONOTONE composes with a binding constraint: clean succeeds under f_max 0.7, best_failing returns the identical plan and verdict content", { timeout: 300_000 }, () => {
    const constraints = [
      { id: "cap", span: { from: "mid:c1", to: "exit:c1" }, bound: "f_max" as const, value: 0.7 }
    ];
    const clean = solved({ road: "book90", entry_kmh: 34, constraints });
    expect(clean.verdict.ok).toBe(true);
    const bf = solved({ road: "book90", entry_kmh: 34, accept: "best_failing", constraints });
    expect(bf.verdict.acceptance).toEqual({ policy: "best_failing", met: true });
    expect(JSON.stringify(bf.resolved_scenario.rider.plan)).toBe(
      JSON.stringify(clean.resolved_scenario.rider.plan)
    );
    expect(bf.verdict.outcome).toBe(clean.verdict.outcome);
    expect(bf.verdict.doctrine).toEqual(clean.verdict.doctrine);
    expect(bf.verdict.constraints).toEqual(clean.verdict.constraints);
  });
});

// ---------------------------------------------------------------------------
// The self-recovery corrective arm (design/04 §4a.6 vs §4c.4 — PINNED, PENDING
// RATIFICATION, recorded by WP-10): an outward drift that HEALS inside the
// rider's reaction time reaches the shot instant no longer outside/drifting,
// so the §4c.4 harness rightly refuses to launch a lean-only shadow — but for
// the LINE this is the trivially-feasible save. §4a.6's recorded shape has no
// arm for it; the implementation records {feasible: true, shot: null,
// fail_reason: null} (the same shot: null spelling as the recorded
// departed_before_reaction arm). The block is IN result_hash, so this pin is
// re-bless-relevant: if the ratification lands a different shape, this test
// and the goldens move together.

describe("self-recovery corrective arm (pinned; ratification)", () => {
  it("a transient outward excursion that heals within t_react records {feasible: true, shot: null, fail_reason: null} with a returned station — outcome wide, detect on the line", { timeout: 300_000 }, () => {
    const road = { dsl: "lane 3.5 | S 20 | R 30 ^90 | S 20" };
    const wire = {
      spec: "linelab/1",
      id: "selfrec",
      road,
      rider: {
        start: { speed_kmh: 42 },
        // a slightly-late single commit: the roll-in transient pokes past the
        // usable edge (run_wide_detect fires), then the committed 38° arc
        // pulls the line back inside before the reaction-delayed shot instant
        plan: [{ do: "turn_in", id: "t1", at_s: 21, target: { lean_deg: 38 } }]
      }
    };
    const v = validate(wire);
    expect(v.ok).toBe(true);
    if (!v.ok) return;
    const r = executeLine({
      validated: v.value,
      policy: "clean",
      source: { kind: "scenario", scenario: wire as never },
      constraints: null,
      brake_gap_m: 3
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const line = r.value;
    const detects = line.trajectory.events.filter((e) => e.kind === "run_wide_detect");
    expect(detects.length).toBeGreaterThanOrEqual(1);
    const corrective = line.verdict.corners[0]!.corrective;
    expect(corrective).not.toBeNull();
    expect(corrective!.feasible).toBe(true);
    expect(corrective!.shot).toBeNull();
    expect(corrective!.fail_reason).toBeNull();
    expect(corrective!.returned).not.toBeNull();
    expect(corrective!.detect.f).toBeGreaterThan(1);
    // ran_wide ∧ feasible → wide (§4a.6's outcome contribution)
    expect(line.verdict.outcome).toBe("wide");
  });
});

// ---------------------------------------------------------------------------
// P-APEX-TARGET-TYPED (design/09 §3.5) — bookDecreasing's corner-type-aware
// target: the returned line's apex exceeds the decreasing-radius late bar and
// the ranking never prefers a candidate failing the applicable late-apex
// check. (The WP-10 rideability finding was ADJUDICATED: check 12's teleport
// guards read the Δt→0 regime, not the 0.5 m grid — the profile-rate exit
// unwind no longer misreads as a kappa teleport, so the line grades clean;
// accept=best_failing is kept as the fixture spelling and now returns the
// clean line with the acceptance met.)

describe("P-APEX-TARGET-TYPED (bookDecreasing)", () => {
  it("the returned line's apex_pct exceeds the decreasing late bar and late_apex passes", { timeout: 300_000 }, () => {
    const line = solved({ road: "bookDecreasing", entry_kmh: 34, accept: "best_failing" });
    const corner = line.verdict.corners[0]!;
    expect(corner.corner_type).toBe("decreasing");
    expect(corner.apexes.length).toBeGreaterThan(0);
    expect(corner.apexes[corner.apexes.length - 1]!.pct).toBeGreaterThan(60);
    const late = line.verdict.doctrine.checks.find((c) => c.id === "late_apex")!;
    expect(late.verdict).toBe("pass");
    const fails = line.verdict.doctrine.checks.filter((c) => c.verdict === "fail").map((c) => c.id);
    expect(fails).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// A-SOLVER-FIT (design/09 §3.5) — for every preset at the suggested entry:
// every derived corner-relative station lies within [0, road_end], both search
// brackets are non-degenerate before search at the doc's own example candidate
// (s0 + 1), and the solve returns a line or a TYPED sub-reason — never a rail
// caused by an off-road bracket.

describe("A-SOLVER-FIT (every 03 §3.1 preset)", () => {
  const SUB_REASONS = [
    "turn_in_infeasible_early", "turn_in_infeasible_late", "empty_band", "non_clean_band",
    "coarse_fine_disagreement", "constraint_unmet", "road_too_short", "no_double_apex_geometry",
    "no_two_touch_line", "believed_world_not_clean", "no_rankable_candidate",
    "authored_action_conflict", "link_flip_infeasible", "vis_unsatisfiable_within_bound",
    "vis_speed_below_model_floor"
  ];

  for (const name of PRESET_NAMES) {
    it(`${name}: stations in range and a line-or-typed-refusal`, { timeout: 300_000 }, () => {
      const preset = PRESETS[name];
      const road = composed(preset.dsl);
      const vEntry = preset.suggested_entry_kmh / 3.6;
      for (let i = 0; i < road.corners.length; i++) {
        const st = deriveStations(road, i);
        expect(st.ok).toBe(true);
        if (!st.ok) continue;
        expect(st.value.sweep.lo).toBeGreaterThanOrEqual(0);
        expect(st.value.sweep.hi).toBeLessThanOrEqual(road.total_len_m);
        for (const c of st.value.sweep.candidates) {
          expect(c).toBeGreaterThanOrEqual(st.value.sweep.lo - 1e-9);
          expect(c).toBeLessThanOrEqual(st.value.sweep.hi + 1e-9);
        }
        expect(st.value.s_brake_start).toBeGreaterThanOrEqual(0);
        // both brackets non-degenerate BEFORE search at the doc's s0 + 1 example.
        // Interior corners whose gap is below brake_gap + BRAKE_RUN_MIN_M get
        // NO per-corner brake by design (§5: the chain-entry brake sets speed
        // for the whole group) — their decel bracket legitimately refuses.
        const sTi = st.value.corner.s0 + 1;
        const vTarget = vTargetMs(st.value.corner, RIDER_PROFILES.street.skill, 1.0);
        const chainFed = i > 0 && st.value.ref.L_app < st.value.brake_gap_m + 2.0;
        const decelBr = decelBracketAt(st.value, sTi, vEntry, vTarget);
        if (!chainFed) {
          expect(decelBr.ok).toBe(true);
          if (decelBr.ok) {
            expect(decelBr.value.hi).toBeGreaterThanOrEqual(decelBr.value.lo);
          }
        } else if (!decelBr.ok) {
          expect(decelBr.error.detail?.["sub_reason"]).toBe("road_too_short");
        }
        const rollBr = rollOnBracketAt(st.value, sTi);
        expect(rollBr.ok).toBe(true);
        if (rollBr.ok) {
          expect(rollBr.value.hi - rollBr.value.lo).toBeGreaterThanOrEqual(1.0);
          expect(rollBr.value.hi).toBeLessThanOrEqual(road.total_len_m);
        }
      }
      // the solve returns a line or a typed sub-reason (multi-corner presets
      // restricted to c1 — the chain default lands with WP-11's chainedSolve)
      const spec: SolveInput = {
        road: name,
        entry_kmh: preset.suggested_entry_kmh,
        ...(road.corners.length > 1 ? { corner: "c1" } : {})
      };
      const r = solve(spec);
      if (!r.ok) {
        expect(r.error.code).toBe("NO_SOLUTION");
        expect(SUB_REASONS).toContain(r.error.detail?.["sub_reason"]);
      } else {
        expect(r.value.verdict.outcome).toBeDefined();
      }
    });
  }
});

// ---------------------------------------------------------------------------
// The §4.9 merge contract

describe("merge contract (design/04 §4.9)", () => {
  it("an authored numeric brake decel pins the decel control (bisection skipped)", { timeout: 300_000 }, () => {
    const line = solved({
      road: "book90",
      entry_kmh: 34,
      plan: [{ do: "brake", id: "bk", decel: 3.0 }]
    });
    const brake = line.resolved_scenario.rider.plan.find((a) => a.do === "brake")!;
    expect(brake.do === "brake" && brake.decel).toBe(3.0);
    expect(brake.id).toBe("bk"); // nothing is dropped: the authored action rides through
  });

  it("an unhonourable authored action is NO_SOLUTION/authored_action_conflict naming the id", { timeout: 300_000 }, () => {
    // a position window that overlaps the turn-in commitment at every feasible placement
    const r = refusal({
      road: "book90",
      entry_kmh: 34,
      plan: [{ do: "position", id: "px", at_s: 20, f: 0.5 }]
    });
    expect(r.code).toBe("NO_SOLUTION");
    expect(r.detail["sub_reason"]).toBe("authored_action_conflict");
    expect(r.detail["action_id"]).toBe("px");
  });

  it("a fully explicit plan plus constraints is INEFFECTUAL/constraint_without_solver", () => {
    const r = refusal({
      road: "book90",
      entry_kmh: 34,
      constraints: [{ id: "c", span: { at: "mid:c1" }, bound: "f_max", value: 0.9 }],
      plan: [
        { do: "brake", id: "b", at_s: 0, decel: 2.5 },
        { do: "turn_in", id: "t", at_s: 8, target: { lean_deg: 28 } },
        { do: "throttle", id: "r", at_s: 20, accel: 1.0 }
      ]
    });
    expect(r.code).toBe("INEFFECTUAL");
    expect(r.detail["reason"]).toBe("constraint_without_solver");
  });

  it("mergeAuthoredPlan classifies the §4.9 directives", () => {
    const d = mergeAuthoredPlan([
      { do: "brake", id: "b", decel: 3.1 },
      { do: "throttle", id: "r", at_s: 20, accel: 1.2 },
      { do: "position", id: "p", at_s: 3, f: 0.9 }
    ]);
    expect(d.ok).toBe(true);
    if (!d.ok) return;
    expect(d.value.decel.kind).toBe("pinned");
    expect(d.value.roll_on.kind).toBe("pinned");
    expect(d.value.turn_in.kind).toBe("auto");
    expect(d.value.positions).toHaveLength(1);
    expect(d.value.nothing_to_search).toBe(false);
  });

  it("vis knobs without vis=cautious are dead input (INEFFECTUAL/vis_knob_without_vis_mode)", () => {
    const r = refusal({ road: "book90", entry_kmh: 34, vis_margin: 1.2 });
    expect(r.code).toBe("INEFFECTUAL");
    expect(r.detail["reason"]).toBe("vis_knob_without_vis_mode");
  });

  it("WP-11 seams are typed OUT_OF_SCOPE (liftable), never silent", () => {
    for (const spec of [
      { road: "book90", entry_kmh: 34, vis: "cautious" },
      { road: "book90", entry_kmh: 34, style: "double_apex" },
      { road: "book90", entry_kmh: 34, believed_road: "lane 3.5 | S 12 | L 16 ^90 | S 16" },
      { road: "bookEsses", entry_kmh: 32 } // multi-corner chains by default → chainedSolve
    ] as SolveInput[]) {
      const r = refusal(spec);
      expect(r.code).toBe("OUT_OF_SCOPE");
    }
  });
});

// ---------------------------------------------------------------------------
// The coarse band's sweep-angle hole (design/04 §3 step 1 vs §4.2).
//
// The coarse sweep runs ONE cheap engine run per candidate with two of the
// pipeline's own search variables held fixed — decel at nominal, drive roll-on
// at the type-aware aim station. §4.2 says what the placement filter is for:
// "a placement problem cannot be braked or throttled away". A candidate that
// only runs wide because the fixed drive opens too early is the complement of
// that — the §4.2 roll-on bisection contains it — so refusing the road on that
// evidence is a false `empty_band`, and the size of the un-turned sweep after
// the aim station makes the gap sweep-angle-shaped.
//
// These gates are the regression: an ordinary corner must solve, and every
// refusal the pipeline made before the repair it must still make.

describe("coarse-band rescue — the sweep-angle hole (design/04 §3 / §4.2)", () => {
  const HOLE_DSL = (deg: number): string => `lane 3.5 | S 10 | L 24 ^${deg} | S 12`;

  it("a 130° R24 corner at 30 km/h solves clean — the fig-8.5 believed road", { timeout: 300_000 }, () => {
    const line = solved({ road: HOLE_DSL(130), entry_kmh: 30 });
    expect(line.verdict.outcome).toBe("contained");
    expect(line.verdict.ok).toBe(true);
    // the returned line is a SWEPT station, self-verified — never fabricated
    const ctxR = buildSolveContext({ road: HOLE_DSL(130), entry_kmh: 30 });
    expect(ctxR.ok).toBe(true);
    if (!ctxR.ok) return;
    const ti = line.resolved_scenario.rider.plan.find((a) => a.do === "turn_in");
    expect(ti).toBeDefined();
    const swept = ctxR.value.stations.sweep.candidates;
    expect(swept.some((s) => Math.abs(s - (ti as { at_s: number }).at_s) < 1e-9)).toBe(true);
    // and the drive really is what the coarse run got wrong: the solved onset
    // sits LATER than the aim station the coarse run pinned it to
    const c1 = ctxR.value.corner;
    const aim = c1.s0 + 0.58 * (c1.s1 - c1.s0); // constant-type target_apex_pct
    const rollOn = line.resolved_scenario.rider.plan.filter((a) => a.do === "throttle" && a.accel > 0).at(-1);
    expect(rollOn).toBeDefined();
    expect((rollOn as { at_s: number }).at_s).toBeGreaterThan(aim);
  });

  it("the hole is closed across the whole sweep band, not patched at one angle", { timeout: 600_000 }, () => {
    for (const deg of [45, 70, 90, 110, 120, 130, 150, 170]) {
      const r = solve({ road: HOLE_DSL(deg), entry_kmh: 30 });
      expect(r.ok, `^${deg} refused: ${r.ok ? "" : JSON.stringify(r.error.detail)}`).toBe(true);
      if (!r.ok) continue;
      expect(r.value.verdict.ok).toBe(true);
    }
  });

  it("entry speed is not the variable: the same road solves clean at 25–40 km/h", { timeout: 600_000 }, () => {
    for (const entry_kmh of [25, 28, 30, 32, 35, 40]) {
      const r = solve({ road: HOLE_DSL(130), entry_kmh });
      expect(r.ok, `${entry_kmh} km/h refused`).toBe(true);
      if (!r.ok) continue;
      expect(r.value.verdict.outcome).toBe("contained");
    }
  });

  it("the rescue only ever returns a CLEAN self-verified line — a genuinely empty band still refuses empty_band", { timeout: 600_000 }, () => {
    // ≤ 43° of R24 does not demand the doctrinal apex lean
    // (lean_frac · phiReserve = 28.25°, which R24 asks for only above
    // 40.5 km/h), so the decel bisection rails, the emergent lean stays under
    // ~16°, and the near-straight chord ends on the INSIDE — out_in_out's exit
    // leg fails at every swept station. No clean line exists, and the refusal
    // is the road/speed one.
    for (const spec of [
      { road: HOLE_DSL(40), entry_kmh: 30 },
      { road: C30_DSL, entry_kmh: 70 }
    ] as SolveInput[]) {
      const r = refusal(spec);
      expect(r.code).toBe("NO_SOLUTION");
      expect(r.detail["sub_reason"]).toBe("empty_band");
    }
    // and the claim underneath: nothing in the ^40 sweep verifies clean
    const ctxR = buildSolveContext({ road: HOLE_DSL(40), entry_kmh: 30 });
    expect(ctxR.ok).toBe(true);
    if (!ctxR.ok) return;
    for (const s_ti of ctxR.value.stations.sweep.candidates) {
      const r = fullSolveAtStation(ctxR.value, s_ti, { short_circuit_probe: true });
      if (!r.ok) continue;
      expect(r.value.ranked.line.verdict.ok).toBe(false);
    }
  });

  it("the rescue spends the §3 budget and no more (SUGGEST_TOPN full solves, station order)", { timeout: 300_000 }, () => {
    // the ^120 case: only the FIRST swept station verifies clean, so a rescue
    // ordered by the coarse |apex_pct − target| rank (the key measured on the
    // very run that is unrepresentative) would spend all four solves elsewhere
    // and refuse. Station order finds it inside the same budget.
    const ctxR = buildSolveContext({ road: HOLE_DSL(120), entry_kmh: 30 });
    expect(ctxR.ok).toBe(true);
    if (!ctxR.ok) return;
    const swept = ctxR.value.stations.sweep.candidates;
    const clean: number[] = [];
    for (const s_ti of swept.slice(0, SUGGEST_TOPN)) {
      const r = fullSolveAtStation(ctxR.value, s_ti, { short_circuit_probe: true });
      if (r.ok && r.value.ranked.line.verdict.ok) clean.push(s_ti);
    }
    expect(clean.length).toBeGreaterThan(0);
    const line = solved({ road: HOLE_DSL(120), entry_kmh: 30 });
    const ti = line.resolved_scenario.rider.plan.find((a) => a.do === "turn_in") as { at_s: number };
    expect(ti.at_s).toBeCloseTo(clean[0]!, 9);
  });
});
