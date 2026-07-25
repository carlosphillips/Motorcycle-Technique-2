// test/property/mistake-facets.test.ts — the fifty_pence facet law
// (design/03 §7.1; design/06 §3.1 stage 9; design/01 §A.2 + §4.3).
//
// design/03 §7.1 pins fifty_pence as "an early first facet (`early_by_m = 10`)
// + `facets − 1` corrections (`facets = 6` — six steering *inputs*)". design/06
// §3.1 stage 9 makes that count visible: "a line with six `turn_in` events
// draws six hourglasses", and "there is deliberately no `facet` class — facets
// ARE `turn_in` events". design/09 §5's A-FIG83-MARKS reads the same count
// ("the fifty_pence line exactly `facets` hourglasses") and A-ANCHOR-ERRORS
// needs `turn_point#7@bad` to miss with six candidates listed.
//
// The count and the doctrine failure pull against each other, which is what
// this file pins. `cmd_lean` is a ZOH setpoint that steps only at a `turn_in`
// activation, and design/01 §A.2 counts a steering input as a maximal RISING
// run of |cmd_lean| — so a monotone facet ladder reads as ONE input and would
// PASS `single_input`, contradicting §7.1's mandatory failure for this kind,
// while spelling the back-offs as extra `turn_in` actions doubles the marker
// count and breaks A-FIG83-MARKS. The resolution is the one design/01 §4.3
// already states for this row: "6 facets → ≥ 3 commanded inputs, the
// always-fail rule" — `facets` actions alternating bite / give-back, three
// maximal rising runs.
//
// Assertion discipline: the emergent OUTCOME is never asserted to a class here
// (the §7.1 pin table and its oracle own that); this file asserts only the
// admissible set, the structural count, and the shape.

import { describe, expect, it } from "vitest";
import { compose } from "../../src/road/compose.js";
import { chainedSolve } from "../../src/solve/chained.js";
import { compileMistake, facetLadder, type MistakeCtx } from "../../src/solve/mistake.js";
import type { SolveInput } from "../../src/solve/solve.js";
import type { LineResult } from "../../src/solve/types.js";
import type { Corner, Sample } from "../../src/core/types.js";
import { MISTAKE_KIND_DEFS } from "../../src/plan/mistakes.js";

const F90: SolveInput = { road: "book90", entry_kmh: 34 };

/** design/03 §7.1's TUNING default, read from the ONE pin table, never retyped. */
const DEFAULT_FACETS = MISTAKE_KIND_DEFS["fifty_pence"].params.find((p) => p.name === "facets")!
  .default as number;

let goodMemo: LineResult | null = null;
function good(): LineResult {
  if (goodMemo !== null) return goodMemo;
  const r = chainedSolve(F90);
  if (!r.ok) throw new Error(`F-ORACLE-90 baseline refused: ${JSON.stringify(r.error)}`);
  goodMemo = r.value;
  return goodMemo;
}

const compiled = new Map<number | "default", LineResult>();
function fiftyPence(facets?: number): LineResult {
  const key = facets ?? "default";
  const hit = compiled.get(key);
  if (hit !== undefined) return hit;
  const ctx: MistakeCtx = { base: good(), spec: F90 };
  const r = compileMistake("fifty_pence", facets === undefined ? undefined : { facets }, ctx);
  if (!r.ok) throw new Error(`fifty_pence refused: ${JSON.stringify(r.error)}`);
  compiled.set(key, r.value.line);
  return r.value.line;
}

function turnInActions(line: LineResult): readonly { at_s: number; lean_deg: number }[] {
  return line.resolved_scenario.rider.plan
    .filter((a): a is Extract<typeof a, { do: "turn_in" }> => a.do === "turn_in")
    .map((a) => ({
      at_s: a.at_s,
      lean_deg: a.target === "tangent_inside" ? Number.NaN : a.target.lean_deg
    }));
}

function turnInEvents(line: LineResult): number {
  return line.trajectory.events.filter((e) => e.kind === "turn_in").length;
}

function corner1(): Corner {
  const r = compose({ preset: "book90" });
  if (!r.ok) throw new Error("compose book90 failed");
  return r.value.corners[0]!;
}

/**
 * The drawn-shape measure: |dpsi/ds| per sample interval inside the corner,
 * up to termination. A smooth arc holds this nearly constant; a faceted line
 * alternates near-straight runs with hard bites, so max/min separates. This is
 * the falsifiable form of "the red line must read as many partial inputs" —
 * the defect it replaces was a fifty_pence line measurably SMOOTHER than the
 * ideal line it is drawn beside.
 */
function turnRateSpread(line: LineResult, c: Corner): { min: number; max: number; ratio: number } {
  const sm: readonly Sample[] = line.trajectory.samples;
  const hi = Math.min(c.s1, line.trajectory.terminated.s);
  const rates: number[] = [];
  for (let i = 1; i < sm.length; i++) {
    const a = sm[i - 1]!;
    const b = sm[i]!;
    const ds = b.s - a.s;
    if (ds <= 0 || b.s < c.s0 || b.s > hi) continue;
    let dpsi = b.psi - a.psi;
    while (dpsi > 180) dpsi -= 360;
    while (dpsi < -180) dpsi += 360;
    rates.push(Math.abs(dpsi) / ds);
  }
  const min = Math.min(...rates);
  const max = Math.max(...rates);
  return { min, max, ratio: max / Math.max(min, 1e-9) };
}

// ---------------------------------------------------------------------------

describe("fifty_pence — the facet COUNT is the pin (design/03 §7.1, design/06 §3.1)", () => {
  it("the default compiles exactly `facets` turn_in actions and exactly `facets` turn_in events", { timeout: 300_000 }, () => {
    expect(DEFAULT_FACETS).toBe(6);
    const line = fiftyPence();
    expect(turnInActions(line)).toHaveLength(DEFAULT_FACETS);
    // every facet must actually reach the controller: a marker is the glyph of
    // an EVENT (design/06 §3.1 stage 9), so an action the line never reaches
    // draws nothing and A-FIG83-MARKS would count short.
    expect(turnInEvents(line)).toBe(DEFAULT_FACETS);
  });

  it("an authored `facets` moves both counts together (3 and 8)", { timeout: 300_000 }, () => {
    for (const facets of [3, 8]) {
      const line = fiftyPence(facets);
      expect(turnInActions(line), `facets=${facets} actions`).toHaveLength(facets);
      expect(turnInEvents(line), `facets=${facets} events`).toBe(facets);
    }
  });

  it("A-ANCHOR-ERRORS' precondition: there is no seventh turn_point on the default line", { timeout: 300_000 }, () => {
    expect(turnInEvents(fiftyPence())).toBeLessThan(7);
  });

  it("the good line it is drawn beside carries exactly one turn_in (the A-FIG83-MARKS contrast)", () => {
    expect(turnInEvents(good())).toBe(1);
  });
});

describe("fifty_pence — the ladder alternates so `single_input` can fail (design/01 §A.2, §4.3)", () => {
  it("facetLadder walks kiss→eased with a give-back between every bite", () => {
    const l = facetLadder(10, 30, 6);
    expect(l).toHaveLength(6);
    // bites rise across the probed band; the ladder's peaks are its anchors
    expect(l[0]).toBeCloseTo(10, 9);
    expect(l[4]).toBeCloseTo(30, 9);
    // and every bite is followed by a strictly lower command — without that
    // fall the whole ladder is ONE rising run under §A.2
    const descents = l.filter((v, i) => i > 0 && v < l[i - 1]!).length;
    expect(descents).toBe(3);
    // total for the general case: ⌊facets/2⌋ give-backs, any facets ≥ 2
    for (const n of [2, 3, 4, 5, 7, 8]) {
      const ln = facetLadder(10, 30, n);
      expect(ln).toHaveLength(n);
      expect(ln.filter((v, i) => i > 0 && v < ln[i - 1]!).length).toBe(Math.floor(n / 2));
      expect(Math.min(...ln)).toBeGreaterThan(0); // wire floor: lean_deg ∈ (0, 90)
    }
  });

  it("the compiled plan's commanded targets really do fall between bites", { timeout: 300_000 }, () => {
    const leans = turnInActions(fiftyPence()).map((a) => a.lean_deg);
    const descents = leans.filter((v, i) => i > 0 && v < leans[i - 1]! - 1e-9).length;
    expect(descents).toBeGreaterThanOrEqual(Math.floor(DEFAULT_FACETS / 2));
  });

  it("`single_input` fails with the always-fail count — design/01 §4.3's '6 facets → ≥ 3 commanded inputs'", { timeout: 300_000 }, () => {
    const check = fiftyPence().verdict.doctrine.checks.find((c) => c.id === "single_input");
    expect(check).toBeDefined();
    expect(check!.verdict).toBe("fail");
    const count = (check!.evidence as { metrics?: { count?: number } } | undefined)?.metrics?.count;
    expect(typeof count).toBe("number");
    expect(count).toBeGreaterThanOrEqual(3);
  });
});

describe("fifty_pence — the drawn line reads as facets, not as a smoother arc", () => {
  it("the in-corner turn-rate contrast is far larger than the ideal line's", { timeout: 300_000 }, () => {
    const c = corner1();
    const bad = turnRateSpread(fiftyPence(), c);
    const ideal = turnRateSpread(good(), c);
    // the ideal line is one commitment held through the corner: near-constant
    // curvature. The mistake alternates near-straight drift with hard bites.
    expect(bad.ratio).toBeGreaterThan(3);
    expect(bad.ratio).toBeGreaterThan(2 * ideal.ratio);
    // and the near-straight half is genuinely near-straight relative to the
    // ideal line's gentlest turning
    expect(bad.min).toBeLessThan(0.5 * ideal.min);
  });

  it("the perturbation stays in ONE channel: every non-steering action is the good line's, byte-for-byte", { timeout: 300_000 }, () => {
    const strip = (l: LineResult): unknown[] =>
      l.resolved_scenario.rider.plan.filter((a) => a.do !== "turn_in");
    expect(strip(fiftyPence())).toEqual(strip(good()));
  });

  it("the emergent outcome stays inside design/03 §7.1's admissible set for the kind", { timeout: 300_000 }, () => {
    expect(["wide", "runoff"]).toContain(fiftyPence().verdict.outcome);
  });
});
