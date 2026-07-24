// test/oracle/oracle.test.ts — THE mistake oracle (ARCHITECTURE §7, WP-12):
// ORACLE-PIN-TABLE over F-ORACLE-90 / F-ORACLE-DR / F-ORACLE-CHAIN for all 8
// kinds, O-CHAIN-PREMATURE, A-SU-ATTRIBUTION, A-MISTAKE-FAILS-CHECK,
// A-QS-TWOSIDED, A-RENAME-REJECTED, and the D33 gate law (expectation
// deviation in BOTH directions; roles never gate; D31 cache/skew semantics).
//
// The iron rule (design/09 §4): the oracle reads its expected values from THE
// machine-readable pin table (plan/mistakes.ts MISTAKE_PIN_TABLE — the same
// data `schema mistakes` prints), so a drifted duplicate is structurally
// impossible; outcomes are EMPIRICALLY pinned, never asserted — a pin that
// stops holding is an engine bug or a mis-tuned default, never patched here.
//
// Recorded seams on THIS engine (WP-11-style — each is pinned CLOSED below so
// drift re-opens the question):
//  - SEAM-DR-BASE: RESOLVED BY ADJUDICATION. The lone fail was the rideability
//    kappa guard mis-scoped to the 0.5 m grid; the guard reads the Δt→0
//    teleport regime (plan/doctrine/metrics.ts trackerOverdrive), and the DR
//    good line is now the design-letter DEFAULT solve (09 §4), clean.
//  - SEAM-FP-PIN: CONFIRMED BY ADJUDICATION (pin unattainable on this engine;
//    the cell needs a design-change pin flip wide → runoff, 03 §7.1 rule 1's
//    own "a pin flip is a design change"). Arithmetic: book90-L's outward
//    strip beyond f = 1 is bike_margin 0.40 m = 0.138 f-units (f ceiling
//    on-road 1.148). The §4a.3 shadow route needs the strip to survive
//    t_react 1.0 s ≈ 10.5 m of arc → crossing angle ≤ asin(0.4/10.5) ≈ 2.2°;
//    the §4c.4 self-recovery route needs a catch commit absorbing
//    θ ≤ sqrt(2·ω_e·0.373/v) ≈ 6° (ω_e ≈ 0.16 rad/s excess turn rate at 33°
//    lean, v ≈ 11.5), minus 3–4° eaten by the 50°/s roll-up. Emergent
//    crossing angles across every compliant facet family probed are 10–42°:
//    default ladder crosses at ψ deficit ≈ 25° and departs 0.59 m/0.071 s
//    later; final-facet lean 23.31→38° all depart at s ≈ 29.2; uniform
//    ladder lift +0..+3° departs mid-corner, +4° grazes the EXIT straight
//    (maxF 1.048, crossing s = 41.5) with 0.44 s of road left < t_react,
//    +5° never crosses (contained — outside the admissible set); shallow
//    first-facet poke-and-catch (L1 4–12° × top 32–38°) all reach f = 1.148
//    and depart. The wide band is empty in every natural direction — the
//    same 0.4 m arithmetic 03 §7.1 rule 2 uses to pin premature → runoff.
//  - SEAM-PC-LATE-APEX: CONFIRMED BY ADJUDICATION (expect_fail cell should
//    move late_apex → out_in_out, the cell's own parenthesis). Arithmetic:
//    from the clamped early station (s = 0.5) the contained committed-lean
//    band is [23.31°, ~25.3°]; the recorded final apex pct RISES with lean
//    across it (63.7 → 71.6, all > bar 50 — deeper lean digs deeper into the
//    oncoming lane and later). pct < 50 first appears at ≈ 29.3°, whose dive
//    reaches minF = −1.44 = the far physical edge (d = +3.5) → off_road →
//    runoff, breaking the contained pin, which wins by rule 1. late_apex-fail
//    ∧ contained is empty over the whole lean DOF; out_in_out fails (taught).
//  - SEAM-QS-TRUNCATION: RESOLVED BY ADJUDICATION. steering that never
//    completes inside the record grades quick_steer `eats_corner`
//    (plan/doctrine/checks.ts) — §A.4's mandatory slow_steer → quick_steer
//    fail fires on the truncated line; A-QS-TWOSIDED holds from BOTH sides.
//  - overread on the arc fixture takes params from THIS file
//    (sweep_believed_deg = 105): zero-param overread on an arc corner is
//    SCHEMA/misjudge_param_required BY DESIGN (03 §7.4), and the pin-table
//    data carries no per-fixture params member.

import { describe, expect, it } from "vitest";
import { compose } from "../../src/road/compose.js";
import {
  MISTAKE_PIN_TABLE,
  parseMistakeToken,
  type MistakePinRow
} from "../../src/plan/mistakes.js";
import { chainedSolve, wirePlanFromResolved } from "../../src/solve/chained.js";
import { compileMistake, type CompiledMistake, type MistakeCtx } from "../../src/solve/mistake.js";
import { run, expectDeclarationsOf, ENGINE_SEMVER } from "../../src/solve/run.js";
import { gateFigure } from "../../src/solve/gate.js";
import { isLineRefusal } from "../../src/solve/envelope.js";
import type { SolveInput } from "../../src/solve/solve.js";
import type { FigureResult, LineRefusal, LineResult } from "../../src/solve/types.js";
import type { LinelabError } from "../../src/core/result.js";
import type { Outcome } from "../../src/core/types.js";

// ---------------------------------------------------------------------------
// Fixtures (design/03 §7.1 / design/09 §4, by name)

const F90: SolveInput = { road: "book90", entry_kmh: 34 }; // street, mu 1.0 defaults
const FDR: SolveInput = { road: "bookDecreasing", entry_kmh: 34 };
const FCHAIN: SolveInput = { road: "bookEsses", entry_kmh: 32 };

/** overread's arc-corner fixture params live in the oracle (see file banner). */
const OVERREAD_FIXTURE_PARAMS = { sweep_believed_deg: 105 } as const;
/** F-ORACLE-CHAIN's params come from the design's own fixture line (04 §5.1). */
const CHAIN_FIXTURE_PARAMS = { early_by_m: 4 } as const;

/** SEAM-FP-PIN: emergent single-class pin on THIS engine (see file banner). */
const SEAM_FIXTURE_PIN_OVERRIDES: Readonly<Record<string, Outcome>> = {
  fifty_pence: "runoff"
};

// lazily-solved, memoized baselines (each an engine-self-verified LineResult)
const baselines = new Map<string, LineResult>();

function baseline(name: "F-ORACLE-90" | "F-ORACLE-DR" | "F-ORACLE-CHAIN"): LineResult {
  const cached = baselines.get(name);
  if (cached !== undefined) return cached;
  const spec = name === "F-ORACLE-90" ? F90 : name === "F-ORACLE-DR" ? FDR : FCHAIN;
  const solved = chainedSolve(spec);
  if (!solved.ok) throw new Error(`${name} baseline refused: ${JSON.stringify(solved.error)}`);
  baselines.set(name, solved.value);
  return solved.value;
}

function specOf(name: "F-ORACLE-90" | "F-ORACLE-DR" | "F-ORACLE-CHAIN"): SolveInput {
  return name === "F-ORACLE-90" ? F90 : name === "F-ORACLE-DR" ? FDR : FCHAIN;
}

// memoized per-row compiles (the pin-table loop and the check-law tests share)
const compiledRows = new Map<number, CompiledMistake>();

function compileRow(index: number): CompiledMistake {
  const cached = compiledRows.get(index);
  if (cached !== undefined) return cached;
  const row = MISTAKE_PIN_TABLE[index]!;
  const ctx: MistakeCtx = {
    base: baseline(row.fixture),
    spec: specOf(row.fixture),
    ...(row.scope !== undefined ? { scope: row.scope } : {})
  };
  const params =
    row.scope === "all_corners"
      ? CHAIN_FIXTURE_PARAMS
      : row.kind === "overread"
        ? OVERREAD_FIXTURE_PARAMS
        : undefined;
  const compiled = compileMistake(row.kind, params, ctx);
  if (!compiled.ok) {
    throw new Error(`row ${index} (${row.kind}${row.scope ? "@all" : ""}) refused: ${JSON.stringify(compiled.error)}`);
  }
  compiledRows.set(index, compiled.value);
  return compiled.value;
}

function rowKey(row: MistakePinRow): string {
  return row.scope === "all_corners" ? `${row.kind}@all` : row.kind;
}

/** unique check ids with ≥ 1 fail instance. */
function failedIds(line: LineResult): readonly string[] {
  const s = new Set<string>();
  for (const c of line.verdict.doctrine.checks) if (c.verdict === "fail") s.add(c.id);
  return [...s].sort();
}

function checkInstances(line: LineResult, id: string) {
  return line.verdict.doctrine.checks.filter((c) => c.id === id);
}

function errOf(r: { ok: boolean }): LinelabError {
  expect(r.ok).toBe(false);
  return (r as { ok: false; error: LinelabError }).error;
}

// ---------------------------------------------------------------------------
// ORACLE-PIN-TABLE — the oracle reads the pin table as DATA (single-sourced
// from plan/mistakes.ts; design/09 §4's structural anti-drift rule)

describe("ORACLE-PIN-TABLE — every kind × its pinned fixture (03 §7.1 as data)", () => {
  it("every row's emergent outcome lands in the admissible set AND on its single-class pin", { timeout: 900_000 }, () => {
    expect(MISTAKE_PIN_TABLE.length).toBe(9); // 8 kinds + the premature@all chained row
    for (let i = 0; i < MISTAKE_PIN_TABLE.length; i++) {
      const row = MISTAKE_PIN_TABLE[i]!;
      const compiled = compileRow(i);
      // the hard invariant: engine outcome outside the admissible set on a
      // conforming road is a red suite (03 §7.1 rule 3)
      expect(
        row.admissible_outcomes.includes(compiled.outcome),
        `${rowKey(row)}: outcome "${compiled.outcome}" outside {${row.admissible_outcomes.join(",")}}`
      ).toBe(true);
      // the single-class TUNING-PIN (SEAM-FP-PIN override recorded in the banner)
      const pin = SEAM_FIXTURE_PIN_OVERRIDES[rowKey(row)] ?? row.fixture_pin;
      expect(compiled.outcome, `${rowKey(row)}: pin`).toBe(pin);
      // outcome is read off the line's own engine verdict, never asserted
      expect(compiled.outcome).toBe(compiled.line.verdict.outcome);
    }
  });

  it("premature on F-ORACLE-90: runoff via infeasible corrective + off_road termination (09 §4's extra assertions)", { timeout: 300_000 }, () => {
    const i = MISTAKE_PIN_TABLE.findIndex((r) => r.kind === "premature" && r.scope === undefined);
    const compiled = compileRow(i);
    const line = compiled.line;
    expect(line.trajectory.terminated.reason).toBe("off_road");
    const c1 = line.verdict.corners[0]!;
    expect(c1.ran_wide).toBe(true);
    expect(c1.corrective).not.toBeNull();
    expect(c1.corrective!.feasible).toBe(false);
    // and the compiled diagnosis names the plan defect at the early station
    expect(compiled.diagnosis?.cause).toBe("plan_gap");
  });

  it("wire closure (03 §7.1): every compiled perturbation appears in resolved_scenario", { timeout: 300_000 }, () => {
    // slow_steer → the rider rate cap (0.3 × street 50 = 15 °/s)
    const ss = compileRow(MISTAKE_PIN_TABLE.findIndex((r) => r.kind === "slow_steer"));
    expect(ss.line.resolved_scenario.rider.roll_rate_cap_dps).toBe(15);
    // chop → freeze_steer_s = 1.0 on a throttle action at chop_slew_mss = 40
    const chop = compileRow(MISTAKE_PIN_TABLE.findIndex((r) => r.kind === "chop"));
    const cut = chop.line.resolved_scenario.rider.plan.find(
      (a) => a.do === "throttle" && a.freeze_steer_s !== undefined
    );
    expect(cut).toBeDefined();
    expect(cut!.do === "throttle" && cut!.freeze_steer_s).toBe(1.0);
    expect(cut!.do === "throttle" && cut!.slew_mss).toBe(40);
    // overspeed → entry + 26, all else byte-identical
    const ov = compileRow(MISTAKE_PIN_TABLE.findIndex((r) => r.kind === "overspeed"));
    expect(ov.line.resolved_scenario.rider.start.speed_kmh).toBe(34 + 26);
    expect(JSON.stringify(ov.line.resolved_scenario.rider.plan)).toBe(
      JSON.stringify(baseline("F-ORACLE-DR").resolved_scenario.rider.plan)
    );
    // premature → ONE steering-channel replacement: same plan minus its turn_in
    const pm = compileRow(MISTAKE_PIN_TABLE.findIndex((r) => r.kind === "premature" && r.scope === undefined));
    const basePlan = baseline("F-ORACLE-90").resolved_scenario.rider.plan;
    const mistakePlan = pm.line.resolved_scenario.rider.plan;
    expect(JSON.stringify(basePlan.filter((a) => a.do !== "turn_in"))).toBe(
      JSON.stringify(mistakePlan.filter((a) => a.do !== "turn_in"))
    );
    const tiBase = basePlan.find((a) => a.do === "turn_in")!;
    const tiMistake = mistakePlan.find((a) => a.do === "turn_in")!;
    expect(tiMistake.at_s).toBeLessThan(tiBase.at_s);
    // provenance: source records base line + resolved spec incl. applied_corners
    expect(pm.line.source.kind).toBe("mistake");
    if (pm.line.source.kind === "mistake") {
      expect(pm.line.source.base_line_id).toBe(baseline("F-ORACLE-90").line_id);
      expect((pm.line.source.mistakeSpec as { applied_corners?: readonly string[] }).applied_corners).toEqual(["c1"]);
    }
    // misjudgment kind → source.kind misjudge with the sugar recorded
    const or = compileRow(MISTAKE_PIN_TABLE.findIndex((r) => r.kind === "overread"));
    expect(or.line.source.kind).toBe("misjudge");
    if (or.line.source.kind === "misjudge") {
      expect(or.line.source.sugar?.kind).toBe("overread");
    }
    expect(or.line.verdict.misjudgment).not.toBeNull();
  });

  it("F-ORACLE-DR: the good line IS the default solve (09 §4, restored by adjudication) — contained and clean, no rideability grid artifact", { timeout: 300_000 }, () => {
    const dr = baseline("F-ORACLE-DR");
    expect(dr.verdict.outcome).toBe("contained");
    expect(dr.verdict.acceptance.policy).toBe("clean");
    expect(dr.verdict.acceptance.met).toBe(true);
    expect(failedIds(dr)).toEqual([]);
    // the adjudication's witness: the profile-rate exit unwind no longer trips
    // the kappa teleport guard (it reads Δt→0 pairs, not the 0.5 m grid)
    const rb = checkInstances(dr, "rideability")[0]!;
    expect(rb.verdict).toBe("pass");
  });
});

// ---------------------------------------------------------------------------
// O-CHAIN-PREMATURE (design/04 §5.1, design/09 §4)

describe("O-CHAIN-PREMATURE — chained premature@all on F-ORACLE-CHAIN (bookEsses, 32 km/h)", () => {
  it("final outcome runoff; applied_corners pinned [c1,c2,c3] with the terminating corner; per-corner peak f strictly increases while live", { timeout: 900_000 }, () => {
    const i = MISTAKE_PIN_TABLE.findIndex((r) => r.scope === "all_corners");
    const row = MISTAKE_PIN_TABLE[i]!;
    const compiled = compileRow(i);
    const line = compiled.line;

    // outcome class from the pin row (data), single-class pin "runoff"
    expect(row.admissible_outcomes.includes(compiled.outcome)).toBe(true);
    expect(compiled.outcome).toBe(row.fixture_pin);

    // applied_corners: pinned — the line terminates mid-chain (off_road inside
    // c3), so c4 is unreached and unperturbed (04 §5.1.4)
    expect(compiled.applied_corners).toEqual(["c1", "c2", "c3"]);
    expect(line.trajectory.terminated.reason).toBe("off_road");

    const composed = compose({ preset: "bookEsses" });
    if (!composed.ok) throw new Error("bookEsses compose failed");
    const corners = composed.value.corners;
    expect(corners.map((c) => c.id)).toEqual(["c1", "c2", "c3", "c4"]);

    // the terminating corner is the last applied one
    const term = line.trajectory.terminated.s;
    const c3 = corners.find((c) => c.id === "c3")!;
    expect(term).toBeGreaterThanOrEqual(c3.s0);
    expect(term).toBeLessThanOrEqual(c3.s1);

    // fig 8.6's compounding device: per-corner peak f STRICTLY increases
    // across consecutive applied corners while the line is live
    const peaks = compiled.applied_corners.map((cid) => {
      const c = corners.find((k) => k.id === cid)!;
      let peak = Number.NEGATIVE_INFINITY;
      for (const sm of line.trajectory.samples) {
        if (sm.s >= c.s0 && sm.s <= c.s1 && sm.f > peak) peak = sm.f;
      }
      return peak;
    });
    for (let k = 1; k < peaks.length; k++) {
      expect(peaks[k]!, `peak f must compound: corner ${k}`).toBeGreaterThan(peaks[k - 1]!);
    }

    // one-perturbation under N corners: same kind+params per applied corner —
    // every applied corner's turn_in moved earlier vs the good line's
    const basePlan = baseline("F-ORACLE-CHAIN").resolved_scenario.rider.plan;
    for (const cid of compiled.applied_corners) {
      const tiBase = basePlan.find((a) => a.do === "turn_in" && a.id === `ti_${cid}`)!;
      const tiMist = line.resolved_scenario.rider.plan.find((a) => a.do === "turn_in" && a.id === `ti_${cid}`)!;
      // the placement clamps at the road-start floor (0.5 m) when the good
      // turn-in sits closer than early_by_m — the pin-servant clamp
      expect(tiMist.at_s).toBeCloseTo(Math.max(0.5, tiBase.at_s - CHAIN_FIXTURE_PARAMS.early_by_m), 6);
      expect(tiMist.at_s).toBeLessThan(tiBase.at_s);
    }
  });
});

// ---------------------------------------------------------------------------
// A-SU-ATTRIBUTION (design/09 §4) — the stand_up diagnosis is auditable from
// the trace alone

describe("A-SU-ATTRIBUTION — the su channels attribute the stand-up story", () => {
  it("chop: max |su_transient| > 0 and the stand_up diagnosis cites the su channel", { timeout: 300_000 }, () => {
    const compiled = compileRow(MISTAKE_PIN_TABLE.findIndex((r) => r.kind === "chop"));
    const line = compiled.line;
    let maxSu = 0;
    for (const sm of line.trajectory.samples) maxSu = Math.max(maxSu, Math.abs(sm.su_transient));
    expect(maxSu).toBeGreaterThan(0);
    expect(compiled.diagnosis).not.toBeNull();
    expect(compiled.diagnosis!.cause).toBe("stand_up");
    expect(compiled.diagnosis!.detail["channel"]).toBe("su_transient");
    expect(compiled.diagnosis!.detail["su_transient_max_dps"] as number).toBeGreaterThan(0);
    // the diagnosis rides the sealed verdict but is excluded from result_hash
    expect(line.verdict.diagnosis?.cause).toBe("stand_up");
  });

  it("sustained-brake line (braking at lean): max |su_sustained| > 0", { timeout: 300_000 }, () => {
    // b_dem must exceed A_SU_ONSET = 2.5 m/s² while leaned (02 §5.2)
    const r = run({
      spec: "linelab/1",
      id: "trailbrake",
      road: { preset: "book90" },
      rider: {
        start: { speed_kmh: 34 },
        plan: [
          { do: "turn_in", id: "ti", at_s: 10, target: { lean_deg: 26 }, hand: "L" },
          { do: "brake", id: "b", at_s: 12, decel: 3.5, slew_mss: 60 }
        ]
      }
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const line = r.value.lines[0] as LineResult;
    let maxSu = 0;
    for (const sm of line.trajectory.samples) maxSu = Math.max(maxSu, Math.abs(sm.su_sustained));
    expect(maxSu).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// A-MISTAKE-FAILS-CHECK (design/09 §4) — failed-check set ⊇ the expect_fail
// pin, outcome matching asserted by ORACLE-PIN-TABLE above

describe("A-MISTAKE-FAILS-CHECK — each execution mistake trips its paired check", () => {
  it("chop fails throttle_rule; fifty_pence fails single_input (count ≥ 3)", { timeout: 300_000 }, () => {
    const chop = compileRow(MISTAKE_PIN_TABLE.findIndex((r) => r.kind === "chop"));
    expect(failedIds(chop.line)).toContain("throttle_rule");
    const fp = compileRow(MISTAKE_PIN_TABLE.findIndex((r) => r.kind === "fifty_pence"));
    expect(failedIds(fp.line)).toContain("single_input");
    const si = checkInstances(fp.line, "single_input").find((c) => c.verdict === "fail")!;
    expect((si.evidence.metrics?.["count"] as number) >= 3).toBe(true);
    // and the polygon apexes early — late_apex fails alongside
    expect(failedIds(fp.line)).toContain("late_apex");
  });

  it("overread: contained with ≥ 1 applicable check failing — quality caution (the over-cautious evidence)", { timeout: 300_000 }, () => {
    const or = compileRow(MISTAKE_PIN_TABLE.findIndex((r) => r.kind === "overread"));
    expect(or.line.verdict.outcome).toBe("contained");
    expect(or.line.verdict.doctrine.fail).toBeGreaterThanOrEqual(1);
    expect(or.line.verdict.quality).toBe("caution");
  });

  it("SEAM-PC-LATE-APEX (pinned; ratification): premature_contained's taught check is out_in_out on this engine — late_apex PASSES past the bar", { timeout: 300_000 }, () => {
    const pc = compileRow(MISTAKE_PIN_TABLE.findIndex((r) => r.kind === "premature_contained"));
    // the pin-table cell declares late_apex; the emergent contained eased line
    // is the deep inside cut whose FINAL recorded apex grades late
    expect(failedIds(pc.line)).toContain("out_in_out");
    const la = checkInstances(pc.line, "late_apex")[0]!;
    expect(la.verdict).toBe("pass");
    expect((la.evidence.metrics?.["apex_pct"] as number)).toBeGreaterThan(50);
  });

  it("slow_steer → quick_steer FAIL on book90 (09 §4's explicit inclusion; A-QS-TWOSIDED's slow side, restored by adjudication)", { timeout: 300_000 }, () => {
    const ss = compileRow(MISTAKE_PIN_TABLE.findIndex((r) => r.kind === "slow_steer"));
    expect(failedIds(ss.line)).toContain("quick_steer");
    // the mechanism, witnessed: the capped rider departs off-road with the
    // roll-in still incomplete — steering_complete never exists in the record,
    // so the roll-in ate every ridden metre of the corner (§A.4's mandatory
    // fail; §A.3's own worked arithmetic grades the full roll at share ≈ 0.74)
    expect(ss.line.trajectory.terminated.reason).toBe("off_road");
    const qs = checkInstances(ss.line, "quick_steer").find((c) => c.verdict === "fail")!;
    expect(qs.evidence.metrics?.["dt_steer_s"]).toBeNull();
    expect(qs.evidence.metrics?.["roll_in_completed"]).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// A-QS-TWOSIDED (design/09 §4) — the good side of the two-sided gate

describe("A-QS-TWOSIDED — quick_steer pinned from the good side", () => {
  it("the book90 good line passes quick_steer with steer_share ≤ 0.30", { timeout: 300_000 }, () => {
    const good = baseline("F-ORACLE-90");
    const qs = checkInstances(good, "quick_steer")[0]!;
    expect(qs.verdict).toBe("pass");
    expect((qs.evidence.metrics?.["steer_share"] as number)).toBeLessThanOrEqual(0.3);
    // (the slow side is SEAM-QS-TRUNCATION above — pinned, ratification)
  });
});

// ---------------------------------------------------------------------------
// A-RENAME-REJECTED (design/09 §4; D25) — typed tombstones, never silent aliases

describe("A-RENAME-REJECTED — renames tombstone with the successor's name", () => {
  it('expect_fail: ["sight_vs_stopping"] → UNKNOWN_ID/renamed_check naming stop_within_sight', () => {
    const r = run({
      spec: "linelab/1",
      id: "renamed",
      road: { preset: "book90" },
      rider: { start: { speed_kmh: 30 }, plan: [] },
      expect_fail: ["sight_vs_stopping"]
    });
    const e = errOf(r);
    expect(e.code).toBe("UNKNOWN_ID");
    expect(e.detail?.["reason"]).toBe("renamed_check");
    expect(e.detail?.["successor"]).toBe("stop_within_sight");
  });

  it('the retired kind "early_apex" tombstones to premature — token parse AND compiler', { timeout: 300_000 }, () => {
    const tok = parseMistakeToken("early_apex", "mistake");
    const te = errOf(tok);
    expect(te.code).toBe("UNKNOWN_ID");
    expect(te.detail?.["reason"]).toBe("renamed_kind");
    expect(te.detail?.["renamed_to"]).toBe("premature");

    const compiled = compileMistake("early_apex", undefined, { base: baseline("F-ORACLE-90"), spec: F90 });
    const ce = errOf(compiled);
    expect(ce.code).toBe("UNKNOWN_ID");
    expect(ce.detail?.["reason"]).toBe("renamed_kind");
  });
});

// ---------------------------------------------------------------------------
// Compiler guard rails (D23; D8 — nothing accepted-and-ignored)

describe("compileMistake guards — one control or one belief, never both; no dead input", () => {
  it("an execution kind beside believed_road → SCHEMA/misjudge_with_execution_mistake", { timeout: 300_000 }, () => {
    const e = errOf(
      compileMistake("premature", undefined, {
        base: baseline("F-ORACLE-90"),
        spec: { ...F90, believed_road: "lane 3.5 | S 12 | L 16 ^90 | S 16" }
      })
    );
    expect(e.code).toBe("SCHEMA");
    expect(e.detail?.["reason"]).toBe("misjudge_with_execution_mistake");
  });

  it("a misjudgment kind beside an execution mistake spec → SCHEMA/misjudge_with_execution_mistake", { timeout: 300_000 }, () => {
    const e = errOf(
      compileMistake("underread", { r_believed: 16 }, {
        base: baseline("F-ORACLE-90"),
        spec: { ...F90, mistake: { kind: "chop" } }
      })
    );
    expect(e.code).toBe("SCHEMA");
    expect(e.detail?.["reason"]).toBe("misjudge_with_execution_mistake");
  });

  it("a scope on a whole-line kind is dead input → INEFFECTUAL/mistake_scope_ineffectual", { timeout: 300_000 }, () => {
    const e = errOf(
      compileMistake("overspeed", undefined, { base: baseline("F-ORACLE-90"), spec: F90, scope: ["c1"] })
    );
    expect(e.code).toBe("INEFFECTUAL");
    expect(e.detail?.["reason"]).toBe("mistake_scope_ineffectual");
  });

  it("an unknown param → SCHEMA/unknown_mistake_param; an unknown kind → UNKNOWN_ID", { timeout: 300_000 }, () => {
    const e1 = errOf(
      compileMistake("chop", { chop_hard: 1 }, { base: baseline("F-ORACLE-90"), spec: F90 })
    );
    expect(e1.code).toBe("SCHEMA");
    expect(e1.detail?.["reason"]).toBe("unknown_mistake_param");

    const e2 = errOf(compileMistake("wheelie", undefined, { base: baseline("F-ORACLE-90"), spec: F90 }));
    expect(e2.code).toBe("UNKNOWN_ID");
    expect(e2.detail?.["reason"]).toBe("unknown_mistake_kind");
  });

  it("zero-param overread on an arc corner → SCHEMA/misjudge_param_required (03 §7.4 — no default exists)", { timeout: 300_000 }, () => {
    const e = errOf(compileMistake("overread", undefined, { base: baseline("F-ORACLE-90"), spec: F90 }));
    expect(e.code).toBe("SCHEMA");
    expect(e.detail?.["reason"]).toBe("misjudge_param_required");
  });
});

// ---------------------------------------------------------------------------
// run + gate (design/08 §3; D31/D33) — the assembly half of WP-12

const GATE_FIG = {
  figure_id: "fig-oracle-gate",
  road: { preset: "book90" },
  lines: [
    { name: "good", role: "ideal", spec: { road: { preset: "book90" }, entry_kmh: 34 } },
    { name: "bad", role: "mistake", spec: { kind: "premature" } }
  ]
};

let gateEnvelope: FigureResult | null = null;

function runGateFigure(): FigureResult {
  if (gateEnvelope !== null) return gateEnvelope;
  const r = run(GATE_FIG);
  if (!r.ok) throw new Error(`gate figure refused: ${JSON.stringify(r.error)}`);
  gateEnvelope = r.value;
  return r.value;
}

describe("run — the universal front door (08 §3)", () => {
  it("delegate-to-solve rule: a composed solver input delegates and records source.kind = solve; a wire scenario never delegates", { timeout: 300_000 }, () => {
    const solved = run({ road: "book90", entry_kmh: 34 } as SolveInput);
    expect(solved.ok).toBe(true);
    if (!solved.ok) return;
    const line = solved.value.lines[0] as LineResult;
    expect(line.source.kind).toBe("solve");
    expect(line.line_id).toBe("solved");

    const scenario = run({
      spec: "linelab/1",
      id: "explicit",
      road: { preset: "book90" },
      rider: { start: { speed_kmh: 30 }, plan: [] }
    });
    expect(scenario.ok).toBe(true);
    if (!scenario.ok) return;
    const sline = scenario.value.lines[0] as LineResult;
    expect(sline.source.kind).toBe("scenario");
    expect(sline.cache).toBe("absent");
  });

  it("a figure runs every line: the mistake line compiles against the first ride line; refusals stay in `lines` as typed entries", { timeout: 300_000 }, () => {
    const env = runGateFigure();
    expect(env.lines).toHaveLength(2);
    const good = env.lines[0] as LineResult;
    const bad = env.lines[1] as LineResult;
    expect(isLineRefusal(good)).toBe(false);
    expect(isLineRefusal(bad)).toBe(false);
    expect(good.verdict.outcome).toBe("contained");
    expect(bad.source.kind).toBe("mistake");
    if (bad.source.kind === "mistake") expect(bad.source.base_line_id).toBe("good");
    expect(bad.verdict.outcome).toBe("runoff");

    // a refused line is a first-class envelope entry, never a silent drop
    const withRefusal = run({
      ...GATE_FIG,
      lines: [
        ...GATE_FIG.lines,
        { name: "broken", role: "alternative", spec: { road: { preset: "book90" }, entry_kmh: 34, corner: "c9" } }
      ]
    });
    expect(withRefusal.ok).toBe(true);
    if (!withRefusal.ok) return;
    const entry = withRefusal.value.lines[2]!;
    expect(isLineRefusal(entry)).toBe(true);
    expect((entry as LineRefusal).error.code).toBe("UNKNOWN_ID");
    // and the refusal participates in the gate law (unmet by construction)
    const gate = gateFigure(withRefusal.value);
    expect(gate.pass).toBe(false);
    expect(gate.lines[2]!.refused).toBe(true);
    expect(gate.lines[2]!.met).toBe(false);
  });

  it("D31 cache-load semantics: a valid solved stamp skips the search but NEVER the engine; divergence falls back and renders as skew, never blocks", { timeout: 300_000 }, () => {
    const env = runGateFigure();
    const good = env.lines[0] as LineResult;
    const stamp = (expected: { outcome: string; result_hash: string }) => ({
      ...GATE_FIG,
      engine_semver: ENGINE_SEMVER,
      lines: [
        {
          ...GATE_FIG.lines[0]!,
          expected,
          solved: {
            spec_hash: good.verdict.spec_hash,
            plan: wirePlanFromResolved(good.resolved_scenario.rider.plan)
          }
        }
      ]
    });

    // hit: engine ran once on the cached plan — the verdict is byte-fresh
    const hit = run(stamp({ outcome: good.verdict.outcome, result_hash: good.verdict.result_hash }));
    expect(hit.ok).toBe(true);
    if (!hit.ok) return;
    const hitLine = hit.value.lines[0] as LineResult;
    expect(hitLine.cache).toBe("hit");
    expect(hitLine.verdict.result_hash).toBe(good.verdict.result_hash);
    expect(hit.value.skew?.tier).toBe("match");

    // stale engine: stamped semver ≠ running semver → drop + full re-solve
    const stale = run(stamp({ outcome: good.verdict.outcome, result_hash: good.verdict.result_hash }), {
      engine_semver: "9.9.9"
    });
    expect(stale.ok).toBe(true);
    if (!stale.ok) return;
    expect((stale.value.lines[0] as LineResult).cache).toBe("stale_engine");

    // story divergence: the stamped conclusion lied about the outcome — run
    // falls back to a full re-solve; the placard (skew story) records it and
    // the envelope stays complete (never blocks)
    const divergent = run(stamp({ outcome: "crash", result_hash: good.verdict.result_hash }));
    expect(divergent.ok).toBe(true);
    if (!divergent.ok) return;
    expect(divergent.value.skew?.tier).toBe("story");
    expect((divergent.value.lines[0] as LineResult).verdict.outcome).toBe(good.verdict.outcome);
    // …and under the gate, figure-level story skew is the exit-3 arm (08 §3.1)
    expect(gateFigure(divergent.value).skew_story).toBe(true);
    expect(gateFigure(divergent.value).pass).toBe(false);
  });
});

describe("gateFigure — expectation-based gating (D33; 08 §3.4)", () => {
  it("the fig-8.1 figure passes: the mistake's pin-table row IS its declaration (no redundant expect_fail)", { timeout: 300_000 }, () => {
    const gate = gateFigure(runGateFigure());
    expect(gate.pass).toBe(true);
    expect(gate.lines[0]!.expectation.source).toBe("default");
    expect(gate.lines[1]!.expectation.source).toBe("mistake_pin");
    expect(gate.lines[1]!.expectation.outcome).toEqual(["wide", "runoff"]);
    expect(gate.lines.every((l) => l.met)).toBe(true);
  });

  it("deviation gates in BOTH directions: a good line declared runoff misses; a mistake declared contained misses", { timeout: 300_000 }, () => {
    const env = runGateFigure();
    const expectsDown = expectDeclarationsOf({
      ...GATE_FIG,
      lines: [{ ...GATE_FIG.lines[0]!, expect: { outcome: ["runoff"] } }, GATE_FIG.lines[1]!]
    });
    expect(expectsDown.ok).toBe(true);
    if (!expectsDown.ok) return;
    const down = gateFigure(env, { expect: expectsDown.value });
    expect(down.pass).toBe(false);
    expect(down.lines[0]!.expectation.source).toBe("explicit_expect");
    expect(down.lines[0]!.met).toBe(false); // TOO GOOD is a miss

    const expectsUp = expectDeclarationsOf({
      ...GATE_FIG,
      lines: [GATE_FIG.lines[0]!, { ...GATE_FIG.lines[1]!, expect: { outcome: ["contained"] } }]
    });
    expect(expectsUp.ok).toBe(true);
    if (!expectsUp.ok) return;
    const up = gateFigure(env, { expect: expectsUp.value });
    expect(up.pass).toBe(false);
    expect(up.lines[1]!.met).toBe(false); // too bad is equally a miss
  });

  it("roles never gate (D9): the same lines under different role labels gate identically", { timeout: 300_000 }, () => {
    const relabeled = run({
      ...GATE_FIG,
      lines: [GATE_FIG.lines[0]!, { ...GATE_FIG.lines[1]!, role: "ideal" }]
    });
    expect(relabeled.ok).toBe(true);
    if (!relabeled.ok) return;
    const gate = gateFigure(relabeled.value);
    expect(gate.pass).toBe(true);
    // the mistake-sourced line still gates by its SOURCE, not its role label
    expect(gate.lines[1]!.expectation.source).toBe("mistake_pin");
  });

  it("the bidirectional check rule: a DECLARED fail that passes is a miss (the exempt-check-passes direction)", { timeout: 300_000 }, () => {
    const env = runGateFigure();
    // the clean good line declared to fail late_apex — it passes it, so the
    // expectation is missed in the "too good" direction
    const expects = expectDeclarationsOf({
      ...GATE_FIG,
      lines: [
        { ...GATE_FIG.lines[0]!, expect: { outcome: ["contained"], checks_fail: ["late_apex"] } },
        GATE_FIG.lines[1]!
      ]
    });
    expect(expects.ok).toBe(true);
    if (!expects.ok) return;
    const gate = gateFigure(env, { expect: expects.value });
    const line = gate.lines[0]!;
    expect(line.expectation.source).toBe("explicit_expect");
    expect(line.met).toBe(false);
    expect(line.misses.some((m) => m.includes("late_apex"))).toBe(true);
    // …while the scenario-level expect_fail surface derives through rule 5:
    // the wire scenario's declaration rides resolved_scenario.expect_fail
    const declared = run({
      spec: "linelab/1",
      id: "declared",
      road: { preset: "book90" },
      rider: { start: { speed_kmh: 30 }, plan: [] },
      expect_fail: ["late_apex"]
    });
    expect(declared.ok).toBe(true);
    if (!declared.ok) return;
    const g2 = gateFigure(declared.value);
    expect(g2.lines[0]!.expectation.source).toBe("default");
    expect(g2.lines[0]!.expectation.checks_fail).toEqual(["late_apex"]);
    expect(g2.lines[0]!.met).toBe(false); // plan-less line: outcome ≠ contained
  });
});
