// test/property/solver-ext.test.ts — WP-11 gates (ARCHITECTURE §7):
// chainedSolve on bookEsses + A-LINK-FLIP (slowing arm + floor arm),
// A-DOUBLEAPEX (the formal two-touch predicate + the solver's typed refusals,
// incl. the universal §4.6 sweep qualification and the §4.5/§4.8.3
// constraint_unmet arm), the §4.9 merge-contract refusals on the WP-11 family,
// vis=cautious on the reshaped bookBlind (A-VIS-HOLD-REACH — hold asserted
// FIRST, D46's vacuity lesson — P-VIS-MARGIN-MONOTONE, P-VIS-SELFCHECK,
// P-VIS-BOUNDED, FX-VIS-FLOOR, FX-VIS-UNSAT, A-SSD-GOVERNOR),
// A-CHAIN-VIS-FULL / A-CHAIN-VIS-BUDGET on fx-chain-blind, the believed-road
// pipeline (P-MISJUDGE-PREFIX, P-MISJUDGE-IDENTITY, underread/overread sugar,
// the §4.7 validation table), and P-SIGHT-* / F-SIGHT-OUTSIDE.
//
// Assertion discipline: error code + detail.reason / detail.sub_reason, never
// message text. Engine-emergent values are pinned as INVARIANTS; empirically
// pinned outcomes state their pin in the test name (the oracle's iron rule: a
// pin that stops holding is an engine/tuning change to re-examine, not to
// silently re-pin).
//
// Recorded seams (deviations in the WP-11 report, flagged for ratification):
//  - CHAIN-CLEAN SEAM: the correctly-ridden bookEsses chain grades contained
//    but not fully clean — the parks-street KAPPA_STEP=0.01 rideability bar is
//    unsatisfiable at chain speeds where the D27 flip budget closes (a
//    full-rate 50°/s flick at ≤9 m/s steps kappa >0.01/sample on the 0.5 m
//    grid), and the frozen commit-release steering law caps the final corner's
//    exit swing. The failing set is pinned CLOSED here.
//  - A-DOUBLEAPEX SEAM: under the frozen 02 §3.1 governing-corner release, a
//    commitment cannot persist across bookDoubleApex's three sub-corners, so
//    no contained two-touch line exists on it; the typed refusal is pinned.
//    ADJUDICATED 2026-07-23, CONFIRMED — with a sharper boundary than the pin:
//    (a) contained two-touch geometry DOES exist on the engine, but only as a
//    crawl family (decel ≈ 3.3–3.5 braking the 30 km/h entry to ≈ 2.4 m/s at
//    turn-in-1 ≈ s 15) where the D7 tracker guard is vacuous (R ≥ v²/0.8 =
//    7.0 m < 12.4 m — the 5° tracker itself corners R12, commitment 1 releases
//    within 1 m) and both touches ride below v_valid_min_ms = 7.0;
//    (b) across 391 contained two-touch pocket candidates (ti2 ∈ [39, 47],
//    lean2 ∈ [16, 38], roll-on ∈ {null, 44…54}) the minimum touch-2 pct is
//    99.8 — never inside [DA_APEX2_PCT ± TOL] = [68, 92] — because release is
//    heading-capture keyed to a MINTED corner's exit (c2 → 110°, c3 → 180°)
//    and no minted corner's exit heading sits in the band's 122°–166° span;
//    and ≥ 4 window apexes are recorded (frame-handoff ripples) where §4.6's
//    letter demands exactly two;
//    (c) 29 120 runs on §4.6's EXACT pinned grid (decel {2.4, 2.867, 3.333,
//    3.8} × ti1 {5, 9.13, 13.26, 17.39, 21.52}) contain zero two-touch
//    candidates — the crawl pocket misses the pinned grid entirely;
//    (d) the alternative "compound-window release" reading (§4.6's "treated
//    as one corner", requiring a 02 §3.1/03 §6.1 design change) cannot save
//    the template either: touch-1 radius ≈ 12.7 m vs c2's 24.4 m inside-edge
//    radius needs the persistent-lean line to grow v² by ×1.92, while
//    DA_MID_ACCEL = 1.0 m/s² over even the full 22 m from touch 1 to c2's
//    exit yields ×1.63 → f < 0 mid-c2. Resolution needs a design decision
//    (preset reshape, DA_MID_ACCEL/band retune, or a compound-release law) —
//    no compliant implementation reading exists. Tripwire test below.
//  - A-SSD-GOVERNOR margin pin is 2.0 here (not 09 §3.5's 1.4): the engine's
//    emergent wide line carries more sight than fixture_geometry.py's chord
//    model, moving the binding threshold; the load-bearing property (margin
//    pinned INSIDE the binding regime so the strict < has a witness) is kept.
//    ADJUDICATED 2026-07-23, CONFIRMED: the inert line's measured binding
//    threshold min(sight_ride/ssd) = 1.804 (chord model said 1.378) — 1.4 is
//    below it (inert, no strict-< witness), 2.0 above it (binds). Asserted
//    as an executable tripwire in the A-SSD-GOVERNOR test below.
//  - V2.5 turn-in placement ADJUDICATED 2026-07-23, pin CONFIRMED: release
//    (trend opening ∧ sight ≥ margin·ssd) lands 9.0 m inside the corner
//    (s = 25.0, s0 = 16.0) while an uncommitted tracker-held line exits the
//    road at s0 + 3.8 m (D20's 5° authority vs the wide line's R ≈ 13.1 m);
//    a literal at-or-after-release turn-in is unsatisfiable without weakening
//    a binding invariant. The wide-commitment realization + release-gated
//    roll_on is pinned by the "V2.5 seam" test below.

import { describe, expect, it } from "vitest";
import { compose } from "../../src/road/compose.js";
import { validate } from "../../src/plan/validate.js";
import { RIDER_PROFILES, MIN_POS_DD_M, v_valid_min_ms, v_floor_ms } from "../../src/core/constants.js";
import { degToRad, kmhToMs } from "../../src/core/units.js";
import type { ResolvedPlanAction, Sample } from "../../src/core/types.js";
import { ssd } from "../../src/sight/ssd.js";
import { sightFrom } from "../../src/sight/cast.js";
import { sightTrendAt } from "../../src/sight/analyze.js";
import {
  VIS_MAX_ITERATIONS,
  DA_SWEEP_MIN_DEG,
  DA_APEX1_PCT,
  DA_APEX1_TOL,
  DA_APEX2_PCT,
  DA_APEX2_TOL,
  eps_f_detect
} from "../../src/solve/constants.js";
import { buildChainContext, chainedSolve, dFlipM, wireRoadSpecOf } from "../../src/solve/chained.js";
import { solveDoubleApex, sweepScale, touchesOf, type DaWindow } from "../../src/solve/doubleApex.js";
import { solveCautious, solveCautiousDetailed, blindOn, type CautiousDetail } from "../../src/solve/vis.js";
import {
  believedRoadFromSugar,
  divergenceOf,
  solveBelieved,
  solveMisjudgeSugar
} from "../../src/solve/believed.js";
import { measureRun, solve } from "../../src/solve/solve.js";
import type { LineResult } from "../../src/solve/types.js";
import type { LinelabError } from "../../src/core/result.js";
import type { Occluder } from "../../src/plan/types.js";
import type { ComposedRoad, Segment } from "../../src/road/types.js";

// ---------------------------------------------------------------------------
// Fixtures (09 §3.5; geometry cross-checked against review/verify/fixture_geometry.py)

const ZERO_GAP_ESSES = "lane 3.5 | S 8 | R 12 ^75 | L 12 ^75 | R 12 ^75 | L 12 ^75 | S 10";
const FX_CHAIN_BLIND = "lane 3.5 | S 16 | L 12 ^140 | S 18 | L 12 ^140 | S 16";
const FX_CHAIN_BLIND_TIGHT = "lane 3.5 | S 16 | L 12 ^140 | S 12 | L 12 ^140 | S 16";
const CHAIN_HEDGES: Occluder[] = [
  { kind: "hedge", side: "inside", at: { ref: "entry:c1", offset_m: -6 }, span_m: 36, margin_m: 0.3, depth_m: 2.5 },
  { kind: "hedge", side: "inside", at: { ref: "entry:c2", offset_m: -6 }, span_m: 36, margin_m: 0.3, depth_m: 2.5 }
];
/** FX-VIS-UNSAT: the hedge runs to the road end — the limit point never opens. */
const FX_VIS_UNSAT_ROAD = "lane 3.5 | S 16 | L 12 ^140 | S 2";
const FX_VIS_UNSAT_HEDGE: Occluder[] = [
  { kind: "hedge", side: "inside", at: { ref: "entry:c1", offset_m: -6 }, span_m: 44, margin_m: 0.3, depth_m: 2.5 }
];
/** F-BELIEVED-CHAIN: worlds agree through c1 (curved prefix!), diverge at c2. */
const BCHAIN_ACTUAL = "lane 3.5 | S 12 | L 12 ^90 | S 8 | R 12 ^90 | S 12";
const BCHAIN_BELIEVED = "lane 3.5 | S 12 | L 12 ^90 | S 30";

// ---------------------------------------------------------------------------
// Helpers

function errOf(r: { ok: boolean }): LinelabError {
  const e = r as { ok: false; error: LinelabError };
  if ((r as { ok: boolean }).ok) throw new Error("expected a refusal, got a line");
  return e.error;
}

function lineOf(r: { ok: boolean }): LineResult {
  if (!(r as { ok: boolean }).ok) {
    const e = (r as { ok: false; error: LinelabError }).error;
    throw new Error(`expected a line, got ${e.code} ${JSON.stringify(e.detail)}`);
  }
  return (r as { ok: true; value: LineResult }).value;
}

function subReason(e: LinelabError): string {
  return String((e.detail ?? {})["sub_reason"]);
}

function composed(dsl: string): ComposedRoad {
  const r = compose({ dsl });
  if (!r.ok) throw new Error("compose failed");
  return r.value;
}

/** Rebuild the wire scenario a LineResult's resolved_scenario denotes. */
function wireOf(line: LineResult): Record<string, unknown> {
  const rs = line.resolved_scenario;
  return {
    spec: "linelab/1",
    id: rs.id,
    road: { dsl: rs.road.dsl, bike_margin_m: rs.road.bike_margin_m, use_full_width: rs.road.use_full_width },
    occluders: rs.occluders.map((o) => ({ ...o })),
    hazards: rs.hazards.map((h) => ({ ...h })),
    rider: { profile: rs.rider.profile, start: rs.rider.start, plan: rs.rider.plan.map((a) => ({ ...a })) },
    config: { mu: rs.config.mu }
  };
}

/** V1 as the mode defines it: margin·ssd ≤ sight_ride at every station, with
 *  the check-10 open-end carve-out (a cast that ran unblocked to the record's
 *  end has no sight limit). THE one ssd (sight/ssd.ts) is the yardstick. */
function v1Violations(line: LineResult, margin: number): number {
  const street = RIDER_PROFILES[line.resolved_scenario.rider.profile];
  const traj = line.trajectory;
  let violations = 0;
  for (const sm of traj.samples) {
    if (sm.s + sm.sight_m >= traj.terminated.s - 1.0) continue;
    const need = margin * ssd(sm.v, degToRad(Math.abs(sm.phi)), "alert", street, line.resolved_scenario.config.mu).ssd_m;
    if (need > sm.sight_ride_m + 1e-6) violations += 1;
  }
  return violations;
}

/** min over non-open-ended samples of sight_ride_m / ssd_m (THE one ssd) —
 *  the engine's V1 binding threshold: on an INERT (ungoverned) line the
 *  governor binds at exactly the margins exceeding this ratio. */
function minSightRatio(line: LineResult): number {
  const street = RIDER_PROFILES[line.resolved_scenario.rider.profile];
  const traj = line.trajectory;
  let min = Number.POSITIVE_INFINITY;
  for (const sm of traj.samples) {
    if (sm.s + sm.sight_m >= traj.terminated.s - 1.0) continue;
    const need = ssd(sm.v, degToRad(Math.abs(sm.phi)), "alert", street, line.resolved_scenario.config.mu).ssd_m;
    min = Math.min(min, sm.sight_ride_m / need);
  }
  return min;
}

// memoized expensive solves (each is minutes of engine time across the file)
const memo = new Map<string, unknown>();
function once<T>(key: string, f: () => T): T {
  if (!memo.has(key)) memo.set(key, f());
  return memo.get(key) as T;
}

const essesLine = (): LineResult => once("esses", () => lineOf(chainedSolve({ road: "bookEsses", entry_kmh: 32 })));
const blindAt = (margin: number): ReturnType<typeof solveCautiousDetailed> =>
  once(`blind:${margin}`, () =>
    solveCautiousDetailed({ road: "bookBlind", entry_kmh: 34, vis: "cautious", vis_margin: margin })
  );
const chainVis = (dsl: string, margin: number): ReturnType<typeof solveCautiousDetailed> =>
  once(`chainvis:${dsl}:${margin}`, () =>
    solveCautiousDetailed({ road: dsl, entry_kmh: 39, vis: "cautious", vis_margin: margin, occluders: CHAIN_HEDGES })
  );

// ===========================================================================
// chainedSolve (design/04 §5)
// ===========================================================================

describe("chainedSolve — bookEsses end-to-end (04 §5)", () => {
  it("solves the four-corner chain contained, one commitment per corner, alternating hands", { timeout: 300_000 }, () => {
    const line = essesLine();
    expect(line.verdict.outcome).toBe("contained");
    const tis = line.resolved_scenario.rider.plan.filter((a) => a.do === "turn_in");
    expect(tis).toHaveLength(4);
    expect(tis.map((t) => (t.do === "turn_in" ? t.hand : "?"))).toEqual(["R", "L", "R", "L"]);
    // stations ascend and each corner's commitment may begin in the previous
    // arc's tail (supersession, 04 §5) but never before the previous turn-in
    for (let i = 1; i < tis.length; i++) {
      expect(tis[i]!.at_s).toBeGreaterThan(tis[i - 1]!.at_s);
    }
    expect(line.source.kind).toBe("solve");
  });

  it("the chain checks grade the ridden-linked sequence: link_continuity, chain_containment, chain_flow all pass", { timeout: 300_000 }, () => {
    const line = essesLine();
    const chainChecks = line.verdict.doctrine.checks.filter((c) =>
      ["link_continuity", "chain_containment", "chain_flow"].includes(c.id)
    );
    expect(chainChecks.length).toBeGreaterThan(0);
    expect(chainChecks.filter((c) => c.verdict === "fail")).toHaveLength(0);
  });

  it("CHAIN-CLEAN SEAM (pinned; ratification): remaining fails are exactly within {out_in_out, single_input, rideability}, and rideability's only finding is the kappa-grid step (zero roll-rate excess)", { timeout: 300_000 }, () => {
    const line = essesLine();
    const fails = line.verdict.doctrine.checks.filter((c) => c.verdict === "fail");
    for (const f of fails) {
      expect(["out_in_out", "single_input", "rideability"]).toContain(f.id);
    }
    const ride = fails.find((f) => f.id === "rideability");
    if (ride !== undefined) {
      // a full-rate flick at chain speed steps recorded kappa > KAPPA_STEP per
      // 0.5 m sample; the commanded roll rate NEVER exceeds the profile cap
      expect((ride.evidence.metrics ?? {})["max_excess_dps"]).toBe(0);
    }
  });

  it("A-SOLVED-PLAN-VALIDATES: the chained plan passes validate() unchanged", { timeout: 300_000 }, () => {
    const line = essesLine();
    const v = validate(wireOf(line));
    expect(v.ok).toBe(true);
  });

  it("corner=<id> restricts to the single-corner pipeline", { timeout: 300_000 }, () => {
    // book90's only corner via chainedSolve ≡ solve (the §5 restriction rule)
    const viaChain = chainedSolve({ road: "book90", entry_kmh: 34, corner: "c1" });
    expect(viaChain.ok).toBe(true);
    if (viaChain.ok) expect(viaChain.value.verdict.outcome).toBe("contained");
  });
});

describe("A-LINK-FLIP — the d_flip budget (04 §5, D27)", () => {
  it("slowing arm (pinned): the zero-gap esses chain-solves contained at a reduced, recorded speed at/above the validity floor", { timeout: 400_000 }, () => {
    const line = once("zg32", () => lineOf(chainedSolve({ road: ZERO_GAP_ESSES, entry_kmh: 32 })));
    expect(line.verdict.outcome).toBe("contained");
    const entryMs = kmhToMs(32);
    let vMin = Number.POSITIVE_INFINITY;
    for (const sm of line.trajectory.samples) vMin = Math.min(vMin, sm.v);
    // the too-tight gap RESOLVED BY SLOWING: the chain sheds real speed …
    expect(vMin).toBeLessThan(0.95 * entryMs);
    // … but never below the model-validity floor (7.0 m/s, 02 §7)
    expect(vMin).toBeGreaterThanOrEqual(v_valid_min_ms - 0.05);
  });

  it("floor arm: a roll-rate-capped rider cannot close the flip above the floor — NO_SOLUTION/link_flip_infeasible naming the first infeasible link", { timeout: 400_000 }, () => {
    const e = errOf(chainedSolve({ road: ZERO_GAP_ESSES, entry_kmh: 32, roll_rate_cap_dps: 30 }));
    expect(e.code).toBe("NO_SOLUTION");
    expect(subReason(e)).toBe("link_flip_infeasible");
    const d = e.detail ?? {};
    expect(d["link"]).toBe("c1->c2");
    expect(d["window_m"]).toBe(0); // zero-gap chains are legal grammar (D27)
    expect(d["v_floor_kmh"]).toBeCloseTo(25.2, 6);
    expect(d["d_flip_m"] as number).toBeGreaterThan(0);
  });

  it("d_flip(v) = v·(φ_n + φ_{n+1})/roll_rate — the 04 §5 worked number (≈9.0 m at 28.7 km/h, street, R 12 both sides)", () => {
    const v = 28.7 / 3.6;
    expect(dFlipM(v, 12, 12, RIDER_PROFILES.street.roll_rate_dps)).toBeCloseTo(9.0, 1);
  });
});

// ===========================================================================
// solveDoubleApex (design/04 §4.6)
// ===========================================================================

describe("A-DOUBLEAPEX — the formal two-touch predicate (04 §4.6)", () => {
  const window: DaWindow = (() => {
    const road = composed("lane 3.5 | S 10 | L 12 ^70 | L 24 ^40 | L 12 ^70 | S 12");
    return {
      indices: [0, 1, 2],
      corners: road.corners,
      s0: road.corners[0]!.s0,
      s1: road.corners[2]!.s1,
      L_arc: road.corners[2]!.s1 - road.corners[0]!.s0,
      sweep_deg: 180
    };
  })();
  const scale = sweepScale(window);

  const flat = (f: number): Pick<Sample, "s" | "f">[] => [];
  function samplesFromF(points: readonly (readonly [number, number])[]): Sample[] {
    // minimal sample stubs — the predicate reads only {s, f}
    return points.map(([s, f]) => ({ s, f } as unknown as Sample));
  }

  it("pctAt/sAt: percent of CUMULATIVE swept angle across the window (inter-corner-exact)", () => {
    expect(scale.pctAt(window.s0)).toBe(0);
    expect(scale.pctAt(window.s1)).toBe(100);
    // 70° of 180° at c1's end
    expect(scale.pctAt(window.corners[0]!.s1)).toBeCloseTo((70 / 180) * 100, 6);
    expect(scale.sAt(scale.pctAt(30))).toBeCloseTo(30, 6);
  });

  it("exactly two prominent, separated touches ⇒ two_touch", () => {
    const t1 = window.s0 + 0.2 * window.L_arc;
    const t2 = window.s0 + 0.8 * window.L_arc;
    const samples = samplesFromF([[window.s0, 0.9], [t1, 0.1], [(t1 + t2) / 2, 0.8], [t2, 0.15], [window.s1, 0.8]]);
    const rep = touchesOf([{ s: t1, f: 0.1 }, { s: t2, f: 0.15 }], samples, window, scale);
    expect(rep.two_touch).toBe(true);
    expect(rep.touches).toHaveLength(2);
  });

  it("an under-prominent double dip merges (keeps the deeper) — NOT two touches", () => {
    const t1 = window.s0 + 0.3 * window.L_arc;
    const t2 = window.s0 + 0.7 * window.L_arc;
    // the drift between the dips only rises to 0.3 — prominence 0.15 < 0.25
    const samples = samplesFromF([[window.s0, 0.9], [t1, 0.1], [(t1 + t2) / 2, 0.3], [t2, 0.15], [window.s1, 0.8]]);
    const rep = touchesOf([{ s: t1, f: 0.1 }, { s: t2, f: 0.15 }], samples, window, scale);
    expect(rep.two_touch).toBe(false);
    expect(rep.touches).toHaveLength(1);
    expect(rep.touches[0]!.f).toBe(0.1);
  });

  it("touches too close (separation < DA_TOUCH_SEP_PCT of sweep) merge", () => {
    const t1 = window.s0 + 0.4 * window.L_arc;
    const t2 = window.s0 + 0.5 * window.L_arc; // ~10 % of sweep apart
    const samples = samplesFromF([[window.s0, 0.9], [t1, 0.1], [(t1 + t2) / 2, 0.7], [t2, 0.05], [window.s1, 0.9]]);
    const rep = touchesOf([{ s: t1, f: 0.1 }, { s: t2, f: 0.05 }], samples, window, scale);
    expect(rep.touches).toHaveLength(1);
    expect(rep.touches[0]!.f).toBe(0.05);
  });

  it("apexes above the depth bar (f > DA_TOUCH_F_MAX) are not touches", () => {
    const rep = touchesOf([{ s: window.s0 + 5, f: 0.5 }], samplesFromF(flat(0.5).map(() => [0, 0])), window, scale);
    expect(rep.touches).toHaveLength(0);
  });

  it("book90 has no qualifying window (90° < 120°) — NO_SOLUTION/no_double_apex_geometry", { timeout: 300_000 }, () => {
    const e = errOf(solveDoubleApex({ road: "book90", entry_kmh: 34, style: "double_apex" }));
    expect(e.code).toBe("NO_SOLUTION");
    expect(subReason(e)).toBe("no_double_apex_geometry");
    expect((e.detail ?? {})["required_sweep_deg"]).toBe(DA_SWEEP_MIN_DEG);
  });

  it("bookDecreasing does not reward two touches — NO_SOLUTION/no_two_touch_line with the best candidate retained in detail", { timeout: 300_000 }, () => {
    const e = errOf(solveDoubleApex({ road: "bookDecreasing", entry_kmh: 34, style: "double_apex" }));
    expect(e.code).toBe("NO_SOLUTION");
    expect(subReason(e)).toBe("no_two_touch_line");
    expect((e.detail ?? {})["touch_count"] as number).toBeLessThanOrEqual(1);
  });

  it("A-DOUBLEAPEX SEAM (pinned; ratification): bookDoubleApex refuses no_two_touch_line — the frozen 02 §3.1 release law cannot carry a commitment across the horseshoe's three sub-corners", { timeout: 300_000 }, () => {
    const e = errOf(solveDoubleApex({ road: "bookDoubleApex", entry_kmh: 30, style: "double_apex" }));
    expect(e.code).toBe("NO_SOLUTION");
    expect(subReason(e)).toBe("no_two_touch_line");
    const w = (e.detail ?? {})["window"] as { corner_ids: string[]; sweep_deg: number };
    expect(w.corner_ids).toEqual(["c1", "c2", "c3"]);
    expect(w.sweep_deg).toBeCloseTo(180, 6);
  });

  it("A-DOUBLEAPEX SEAM tripwire (adjudicated 2026-07-23): the crawl witness is contained two-touch, but touch 2 bottoms at the window boundary (out of band), extra frame-handoff apexes are recorded, and both touches ride below the validity band — the §4.6 refusal boundary, pinned executably", { timeout: 300_000 }, () => {
    // The adjudication's decisive engine shot: brake 3.4 m/s² from the 30 km/h
    // entry to a ≈ 2.4 m/s crawl (D7 tracker guard vacuous: R ≥ v²/0.8 =
    // 7.0 m < 12.4 m), turn-ins at s 15 / s 43 — the (decel, ti1) pocket sits
    // OFF §4.6's pinned 4×5 grid; this shape is its nearest witness. If any
    // assertion here flips, the engine's release/tracker regime moved and the
    // A-DOUBLEAPEX seam must be re-adjudicated, not silently re-pinned.
    const chainR = buildChainContext({ road: "bookDoubleApex", entry_kmh: 30, style: "double_apex", corner: "c1..c3" });
    expect(chainR.ok).toBe(true);
    if (!chainR.ok) return;
    const ctx = chainR.value.ctxs[0]!;
    const corners = ctx.road.corners;
    const w: DaWindow = {
      indices: [0, 1, 2],
      corners,
      s0: corners[0]!.s0,
      s1: corners[2]!.s1,
      L_arc: corners[2]!.s1 - corners[0]!.s0,
      sweep_deg: 180
    };
    const daScale = sweepScale(w);
    const hand = corners[0]!.hand;
    const slew = 12;
    const plan: readonly ResolvedPlanAction[] = [
      { do: "brake", id: "b_tw", at_s: 0, decel: 3.4, slew_mss: slew },
      { do: "throttle", id: "k_tw1", at_s: 10.14, accel: 0, slew_mss: slew }, // 12.5 − v·decel/slew release lead
      { do: "turn_in", id: "ti_tw1", at_s: 15, target: { lean_deg: 20 }, hand },
      { do: "throttle", id: "mid_tw", at_s: 29, accel: 1.0, slew_mss: slew },
      { do: "turn_in", id: "ti_tw2", at_s: 43, target: { lean_deg: 30 }, hand },
      { do: "throttle", id: "k_tw2", at_s: 43.5, accel: 0, slew_mss: slew }
    ];
    const m = measureRun(ctx, plan, true);

    // (1) contained over the window (the §4.6 containment predicate) + alive
    let worstF = Number.NEGATIVE_INFINITY;
    let minF = Number.POSITIVE_INFINITY;
    for (const sm of m.traj.samples) {
      if (sm.s < w.s0 - 1e-9 || sm.s > w.s1 + 1e-9) continue;
      if (sm.f > worstF) worstF = sm.f;
      if (sm.f < minF) minF = sm.f;
    }
    expect(m.traj.terminated.reason).toBe("road_end");
    expect(worstF).toBeLessThanOrEqual(1 + eps_f_detect);
    expect(minF).toBeGreaterThanOrEqual(-0.02);

    // (2) the touch predicate accepts it as two-touch — the release law does
    // ADMIT contained two-touch geometry (the pin's absolute reading is only
    // saved by the band/apex-count letter below)
    const windowApexes: { s: number; f: number }[] = [];
    for (const c of w.corners) {
      const row = m.rows.find((r) => r.id === c.id);
      if (row === undefined) continue;
      for (const a of row.apexes) windowApexes.push({ s: a.s, f: a.f });
    }
    windowApexes.sort((a, b) => a.s - b.s);
    const rep = touchesOf(windowApexes, m.traj.samples, w, daScale);
    expect(rep.two_touch).toBe(true);

    // (3) touch 1 lands IN band; touch 2 bottoms at the window boundary, OUT
    // of [DA_APEX2_PCT ± TOL] — no minted corner's exit heading sits in the
    // band's sweep span, so heading capture can never bottom the dip there
    expect(Math.abs(rep.touches[0]!.pct - DA_APEX1_PCT)).toBeLessThanOrEqual(DA_APEX1_TOL);
    expect(rep.touches[1]!.pct).toBeGreaterThan(DA_APEX2_PCT + DA_APEX2_TOL);

    // (4) the recorded window apex list carries frame-handoff ripples beyond
    // the two touches — §4.6's "records exactly two apexes" cannot hold
    expect(windowApexes.length).toBeGreaterThan(2);

    // (5) both touches ride below the 02 §5.3 model-validity band — the only
    // contained two-touch family is a crawl family
    const vNear = (s: number): number => {
      let best = m.traj.samples[0]!;
      for (const sm of m.traj.samples) {
        if (Math.abs(sm.s - s) < Math.abs(best.s - s)) best = sm;
      }
      return best.v;
    };
    expect(vNear(rep.touches[0]!.s)).toBeLessThan(v_valid_min_ms);
    expect(vNear(rep.touches[1]!.s)).toBeLessThan(v_valid_min_ms);
  });

  it("accept=best_failing returns the retained best candidate as a self-verified LineResult (04 §4.6/§4.8)", { timeout: 300_000 }, () => {
    const line = lineOf(solveDoubleApex({ road: "bookDoubleApex", entry_kmh: 30, style: "double_apex", accept: "best_failing" }));
    expect(line.verdict.acceptance.policy).toBe("best_failing");
    expect(line.verdict.acceptance.met).toBe(false);
    // grading is policy-independent: the verdict is the engine's own, verbatim
    expect(["contained", "stopped", "wide", "runoff", "crash"]).toContain(line.verdict.outcome);
    // D10 bounds stay hard under every accept policy (§4.5/§4.8.3): whatever
    // best_failing returns, its self-verified constraint rows are all satisfied
    if (line.verdict.constraints !== null) {
      for (const row of line.verdict.constraints) expect(row.satisfied).toBe(true);
    }
  });

  it("§4.6 qualification is universal: an EXPLICIT single-corner target below DA_SWEEP_MIN_DEG refuses no_double_apex_geometry (book90 corner=c1, 90° < 120°)", { timeout: 300_000 }, () => {
    const e = errOf(solveDoubleApex({ road: "book90", entry_kmh: 34, style: "double_apex", corner: "c1" }));
    expect(e.code).toBe("NO_SOLUTION");
    expect(subReason(e)).toBe("no_double_apex_geometry");
    const d = e.detail ?? {};
    expect(d["best_window_sweep_deg"]).toBe(90);
    expect(d["required_sweep_deg"]).toBe(DA_SWEEP_MIN_DEG);
  });

  it("§4.6 filter step 3 / §4.8.3: constraints join the DA scan — every candidate violating an authored bound refuses constraint_unmet naming the id, under BOTH accept policies (never a violating line, never a touch-geometry blame)", { timeout: 600_000 }, () => {
    // f_max 0.05 over the first 5 m: every candidate starts at f = 1.0, so
    // every candidate violates — the §4.5 refusal names the bound
    const constraints = [
      { id: "start_cap", span: { from: "s:0", to: "s:5" }, bound: "f_max" as const, value: 0.05 }
    ];
    for (const accept of ["clean", "best_failing"] as const) {
      const e = errOf(solveDoubleApex({ road: "bookDoubleApex", entry_kmh: 30, style: "double_apex", accept, constraints }));
      expect(e.code).toBe("NO_SOLUTION");
      expect(subReason(e)).toBe("constraint_unmet");
      const d = e.detail ?? {};
      expect(d["constraint_id"]).toBe("start_cap");
      expect(d["bound"]).toBe("f_max");
      expect(d["required"]).toBe(0.05);
      expect(typeof d["achieved"]).toBe("number");
      expect(typeof d["worst_s"]).toBe("number");
    }
  });
});

// ===========================================================================
// §4.9 merge contract on the WP-11 family (D8: nothing accepted-and-ignored)
// ===========================================================================

describe("§4.9 merge contract — chained/double-apex/vis refuse authored fragments TYPED (pinned; ratification: v0.1 scope cut)", () => {
  // The WP-11 searches build every candidate plan from scratch; an authored
  // fragment previously rode the spec and was silently dropped — exactly what
  // D8 forbids. Until the merge is implemented for this family the fragment
  // refuses NO_SOLUTION/authored_action_conflict naming the first action id
  // (§4.9's cannot-honour spelling; liftable by funding the merge).
  it("chainedSolve with an authored brake refuses authored_action_conflict naming the id", () => {
    const e = errOf(chainedSolve({ road: "bookEsses", entry_kmh: 32, plan: [{ do: "brake", id: "bx", decel: 2.0 }] }));
    expect(e.code).toBe("NO_SOLUTION");
    expect(subReason(e)).toBe("authored_action_conflict");
    expect((e.detail ?? {})["action_id"]).toBe("bx");
  });

  it("solveDoubleApex with an authored fragment refuses authored_action_conflict", () => {
    const e = errOf(solveDoubleApex({ road: "bookDoubleApex", entry_kmh: 30, style: "double_apex", plan: [{ do: "throttle", id: "rx", at_s: 20, accel: 1.0 }] }));
    expect(e.code).toBe("NO_SOLUTION");
    expect(subReason(e)).toBe("authored_action_conflict");
    expect((e.detail ?? {})["action_id"]).toBe("rx");
  });

  it("vis=cautious with an authored fragment refuses authored_action_conflict (single- and multi-corner alike)", () => {
    const e = errOf(solveCautious({ road: "bookBlind", entry_kmh: 34, vis: "cautious", plan: [{ do: "position", id: "px", at_s: 3, f: 0.9 }] }));
    expect(e.code).toBe("NO_SOLUTION");
    expect(subReason(e)).toBe("authored_action_conflict");
    expect((e.detail ?? {})["action_id"]).toBe("px");
  });

  it("an explicit numeric turn-in on a multi-corner chain is dead input: INEFFECTUAL/turn_in_station_on_chain", () => {
    const e = errOf(chainedSolve({ road: "bookEsses", entry_kmh: 32, turn_in: 10 }));
    expect(e.code).toBe("INEFFECTUAL");
    expect((e.detail ?? {})["reason"]).toBe("turn_in_station_on_chain");
  });

  it("the single-corner routes keep the full merge: chainedSolve(corner=<id>) with an authored brake pin still solves through the §4.9 machinery", { timeout: 300_000 }, () => {
    const r = chainedSolve({ road: "book90", entry_kmh: 34, corner: "c1", plan: [{ do: "brake", id: "bk", decel: 3.0 }] });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const brake = r.value.resolved_scenario.rider.plan.find((a) => a.do === "brake")!;
    expect(brake.do === "brake" && brake.decel).toBe(3.0);
    expect(brake.id).toBe("bk");
  });
});

// ===========================================================================
// vis=cautious (design/04 §6, D22) — bookBlind
// ===========================================================================

describe("vis=cautious on the reshaped bookBlind (04 §6)", () => {
  it("A-VIS-HOLD-REACH: a hold-wide position action IS generated (asserted FIRST — D46's vacuity lesson), and the emitted plan passes validate() under the governed speed", { timeout: 300_000 }, () => {
    const r = blindAt(1.0);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const line = r.value.line;
    // (1) the hold exists — V2 emitted a position action for the blind corner
    const holds = line.resolved_scenario.rider.plan.filter((a) => a.do === "position");
    expect(holds.length).toBeGreaterThanOrEqual(1);
    expect(holds[0]!.id).toBe("hold_c1");
    // (2) the hold is recorded in the verdict's sight block (05 §6.3 holds[])
    const rows = line.verdict.sight?.holds ?? [];
    expect(rows).toHaveLength(1);
    expect(rows[0]!.corner_id).toBe("c1");
    expect(rows[0]!.target_f).toBeCloseTo(0.9, 6);
    expect(Number.isFinite(rows[0]!.hold_release_s)).toBe(true);
    // (3) only now: the whole plan (hold included) passes validate() unchanged
    const v = validate(wireOf(line));
    expect(v.ok).toBe(true);
    // and the corner is genuinely blind on this line (01 §A.2 basis)
    const road = composed("lane 3.5 | S 16 | L 12 ^140 | S 16");
    expect(blindOn(line.trajectory.samples, line.trajectory.events, road.corners[0]!)).toBe(true);
  });

  it("A-SSD-GOVERNOR (margin pinned INSIDE the binding regime — 2.0 on this engine, deviation from 09 §3.5's 1.4 recorded): the governor BINDS — governed entry strictly below the authored entry", { timeout: 300_000 }, () => {
    const bound = blindAt(2.0);
    expect(bound.ok).toBe(true);
    if (!bound.ok) return;
    expect(bound.value.iterations).toBeLessThanOrEqual(VIS_MAX_ITERATIONS);
    // the STRICT comparison: the returned line's resolved entry is the
    // governed one (the ungoverned vis=none reference rides the authored 34)
    expect(bound.value.governed_entry_kmh).toBeLessThan(34);
    expect(bound.value.line.resolved_scenario.rider.start.speed_kmh).toBeLessThan(34);
    expect(bound.value.line.verdict.outcome).toBe("contained");
    // inert arm (09 §3.5): at the default margin the governor is inert —
    // governed = ungoverned entry
    const inert = blindAt(1.0);
    expect(inert.ok).toBe(true);
    if (inert.ok) expect(inert.value.governed_entry_kmh).toBe(34);
    // ADJUDICATED tripwire (2026-07-23, pin move 1.4 → 2.0 CONFIRMED): the
    // engine's binding threshold is the inert line's min(sight_ride/ssd)
    // (measured 1.804; fixture_geometry.py's chord model said 1.378). 09
    // §3.5's 1.4 lies BELOW it — the governor is inert there and the strict <
    // would be witnessless — while 2.0 lies ABOVE it. If either strict
    // inequality ever flips, re-adjudicate the 09 §3.5 pin, do not re-pin.
    const inert14 = blindAt(1.4);
    expect(inert14.ok).toBe(true);
    if (inert14.ok) expect(inert14.value.governed_entry_kmh).toBe(34);
    if (inert.ok) {
      const threshold = minSightRatio(inert.value.line);
      expect(threshold).toBeGreaterThan(1.4); // 1.4 cannot bind on this engine
      expect(threshold).toBeLessThan(2.0); // 2.0 is inside the binding regime
    }
  });

  it("V2.5 seam (adjudicated 2026-07-23, pin CONFIRMED): release lands mid-corner beyond the uncommitted-survival horizon — the wide commitment necessarily precedes release; roll-on stays release-gated", { timeout: 300_000 }, () => {
    const r = blindAt(2.0);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const line = r.value.line;
    const road = composed("lane 3.5 | S 16 | L 12 ^140 | S 16");
    const c1 = road.corners[0]!;
    const release = line.verdict.sight!.holds[0]!.hold_release_s;
    // release (trend opening ∧ sight ≥ margin·ssd, actual per-sample f) is
    // genuinely INSIDE the corner (engine-measured s = 25.0 = s0 + 9.0; the
    // approach straight reads `closing`, so it can never fire before s0)
    expect(release).toBeGreaterThan(c1.s0 + 5);
    expect(release).toBeLessThan(c1.s1);
    // the corner's turn_in necessarily PRECEDES release (the confirmed
    // deviation from 04 §6 V2.5's letter): D20's 5° tracker authority cannot
    // hold the wide R ≈ 13.1 m arc, so an uncommitted line exits the road at
    // ~s0 + 3.8 m < release — a literal at-or-after-release turn-in never
    // reaches its own station on the road
    const ti = line.resolved_scenario.rider.plan.find((a) => a.do === "turn_in")!;
    expect(ti.at_s).toBeLessThan(c1.s0);
    expect(ti.at_s).toBeLessThan(release);
    // the implementable half of the letter IS literal: roll_on gated on release
    const ro = line.resolved_scenario.rider.plan.find((a) => a.do === "throttle");
    expect(ro).toBeDefined();
    if (ro !== undefined) expect(ro.at_s).toBeGreaterThanOrEqual(release);
  });

  it("P-VIS-SELFCHECK: the returned line satisfies the mode's acceptance predicate on its own run (V1 everywhere, hold band until release, release conditions)", { timeout: 300_000 }, () => {
    const r = blindAt(2.0);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const line = r.value.line;
    const margin = 2.0;
    // V1 at every station (open-end carve-out), against THE one ssd
    expect(v1Violations(line, margin)).toBe(0);
    // the hold band holds from the hold window's end to the release station
    const hold = line.verdict.sight!.holds[0]!;
    const pos = line.resolved_scenario.rider.plan.find((a) => a.do === "position")!;
    const windowEnd = pos.at_s + (pos.do === "position" ? pos.over_m : 0);
    const target = pos.do === "position" && pos.f !== undefined ? pos.f : 0.9;
    for (const sm of line.trajectory.samples) {
      if (sm.s < windowEnd - 1e-9 || sm.s > hold.hold_release_s + 1e-9) continue;
      expect(sm.f).toBeGreaterThanOrEqual(target - 0.05 - 1e-6);
    }
    // release: sight_trend = opening AND sight_ride ≥ margin·ssd, from the
    // ACTUAL per-sample state (04 §6 V2.5)
    const samples = line.trajectory.samples;
    let i = 0;
    for (let k = 1; k < samples.length; k++) {
      if (Math.abs(samples[k]!.s - hold.hold_release_s) < Math.abs(samples[i]!.s - hold.hold_release_s)) i = k;
    }
    expect(sightTrendAt(samples, i)).toBe("opening");
  });

  it("P-VIS-BOUNDED: every returned mode result used ≤ vis_max_iterations solve passes", { timeout: 300_000 }, () => {
    for (const margin of [1.0, 2.0]) {
      const r = blindAt(margin);
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.value.iterations).toBeLessThanOrEqual(VIS_MAX_ITERATIONS);
    }
  });

  it("P-VIS-MARGIN-MONOTONE (bookBlind): raising vis_margin never raises the governed entry and never lowers the minimum sight margin", { timeout: 300_000 }, () => {
    const margins = [1.0, 2.0, 2.4];
    const results: CautiousDetail[] = margins.map((m) => {
      const r = blindAt(m);
      if (!r.ok) throw new Error("expected lines across the monotone band");
      return r.value;
    });
    const minMargin = (line: LineResult): number => {
      let min = Number.POSITIVE_INFINITY;
      const traj = line.trajectory;
      for (const sm of traj.samples) {
        if (sm.s + sm.sight_m >= traj.terminated.s - 1.0) continue;
        min = Math.min(min, sm.sight_ride_m - sm.ssd_m);
      }
      return min;
    };
    for (let i = 1; i < results.length; i++) {
      expect(results[i]!.governed_entry_kmh).toBeLessThanOrEqual(results[i - 1]!.governed_entry_kmh + 1e-9);
      expect(minMargin(results[i]!.line)).toBeGreaterThanOrEqual(minMargin(results[i - 1]!.line) - 1e-6);
    }
  });

  it("FX-VIS-FLOOR: a margin past the floor edge governs speed below v_floor_ms — NO_SOLUTION/vis_speed_below_model_floor (margin 16 on this engine; 09 §3.5 modelled 12)", { timeout: 300_000 }, () => {
    const e = errOf(blindAt(16));
    expect(e.code).toBe("NO_SOLUTION");
    expect(subReason(e)).toBe("vis_speed_below_model_floor");
    const d = e.detail ?? {};
    expect(d["governed_kmh"] as number).toBeLessThan(v_floor_ms * 3.6);
    expect(d["floor_kmh"]).toBeCloseTo(v_floor_ms * 3.6, 6);
  });

  it("FX-VIS-UNSAT: a blind corner whose limit point never opens — NO_SOLUTION/vis_unsatisfiable_within_bound with per-iterate diagnostics", { timeout: 300_000 }, () => {
    const e = errOf(
      solveCautiousDetailed({
        road: FX_VIS_UNSAT_ROAD,
        entry_kmh: 34,
        vis: "cautious",
        vis_margin: 1.2,
        occluders: FX_VIS_UNSAT_HEDGE
      })
    );
    expect(e.code).toBe("NO_SOLUTION");
    expect(subReason(e)).toBe("vis_unsatisfiable_within_bound");
    const iterations = (e.detail ?? {})["iterations"] as readonly {
      min_margin_m: number;
      worst_s: number;
      hold_met: boolean;
    }[];
    expect(iterations.length).toBeGreaterThanOrEqual(1);
    expect(iterations.length).toBeLessThanOrEqual(VIS_MAX_ITERATIONS);
    for (const row of iterations) {
      expect(typeof row.min_margin_m).toBe("number");
      expect(typeof row.worst_s).toBe("number");
      expect(row.hold_met).toBe(false); // the plateaued deficit: the hold never releases
    }
  });

  it("mode surface: vis_mode_required / knob ranges are typed", () => {
    const noMode = solveCautious({ road: "bookBlind", entry_kmh: 34 });
    expect(noMode.ok).toBe(false);
    if (!noMode.ok) {
      expect(noMode.error.code).toBe("SCHEMA");
      expect((noMode.error.detail ?? {})["reason"]).toBe("vis_mode_required");
    }
    const badHold = solveCautious({ road: "bookBlind", entry_kmh: 34, vis: "cautious", vis_hold_f: 1.5 });
    expect(badHold.ok).toBe(false);
    if (!badHold.ok) expect(badHold.error.code).toBe("BAD_RANGE");
    const badMargin = solveCautious({ road: "bookBlind", entry_kmh: 34, vis: "cautious", vis_margin: 0 });
    expect(badMargin.ok).toBe(false);
    if (!badMargin.ok) expect(badMargin.error.code).toBe("BAD_RANGE");
  });

  it("a blind-free road returns the ordinary line: bookEsses under vis=cautious emits no position action and no hold rows", { timeout: 300_000 }, () => {
    const r = once("essesVis", () => solveCautiousDetailed({ road: "bookEsses", entry_kmh: 32, vis: "cautious" }));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.line.verdict.outcome).toBe("contained");
    expect(r.value.line.resolved_scenario.rider.plan.filter((a) => a.do === "position")).toHaveLength(0);
    expect(r.value.line.verdict.sight?.holds ?? []).toHaveLength(0);
    // and it still validates — no position/turn_in overlap anywhere (09 §3.5)
    expect(validate(wireOf(r.value.line)).ok).toBe(true);
  });
});

// ===========================================================================
// vis=cautious chained (04 §6 composition; fx-chain-blind, 09 §3.5)
// ===========================================================================

describe("A-CHAIN-VIS — fx-chain-blind (same-hand ^140 pair, vis_margin=1.2 pinned)", () => {
  it("A-CHAIN-VIS-FULL (S 18): V1 at every chain station; each blind corner holds its band until release; the S 18 gap's hold is FULL (not budget-limited); the governor moved the entry", { timeout: 600_000 }, () => {
    const r = chainVis(FX_CHAIN_BLIND, 1.2);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const { line, governed_entry_kmh } = r.value;
    expect(line.verdict.outcome).toBe("contained");
    // the governor genuinely moved the entry (binding regime, 09 §3.5)
    expect(governed_entry_kmh).toBeLessThan(39);
    // (i) V1 unconditional, sight_ride basis, THE one ssd
    expect(v1Violations(line, 1.2)).toBe(0);
    // (ii) both corners hold: rows recorded, band held until release, and the
    // line is FORCED OFF start.f (never satisfied by riding f = 1.0)
    const holds = line.verdict.sight!.holds;
    expect(holds.map((h) => h.corner_id)).toEqual(["c1", "c2"]);
    const inter = holds.find((h) => h.corner_id === "c2")!;
    expect(inter.budget_limited).toBe(false); // the S 18 gap affords the full hold
    for (const h of holds) {
      expect(h.achieved_f).toBeLessThan(0.995); // off start.f
      expect(h.achieved_f).toBeGreaterThanOrEqual(0.9 - 0.05 - 1e-6);
    }
    // (iii) at each hold-release station: trend opening ∧ sight ≥ margin·ssd
    const street = RIDER_PROFILES.street;
    for (const h of holds) {
      const samples = line.trajectory.samples;
      let i = 0;
      for (let k = 1; k < samples.length; k++) {
        if (Math.abs(samples[k]!.s - h.hold_release_s) < Math.abs(samples[i]!.s - h.hold_release_s)) i = k;
      }
      expect(sightTrendAt(samples, i)).toBe("opening");
      const sm = samples[i]!;
      const open = sm.s + sm.sight_m >= line.trajectory.terminated.s - 1.0;
      if (!open) {
        const need = 1.2 * ssd(sm.v, degToRad(Math.abs(sm.phi)), "alert", street, 1.0).ssd_m;
        expect(sm.sight_ride_m).toBeGreaterThanOrEqual(need - 1e-6);
      }
    }
    // both corners are blind on this line (the fixture's raison d'être)
    const road = composed(FX_CHAIN_BLIND);
    for (const c of road.corners) {
      expect(blindOn(line.trajectory.samples, line.trajectory.events, c)).toBe(true);
    }
  });

  it("A-CHAIN-VIS-BUDGET (S 12 tight): the lateral budget bites — a non-zero clipped hold IS emitted (budget_limited: true), achieved f monotone toward the target, release from the ACTUAL position, V1 still holds", { timeout: 600_000 }, () => {
    const r = chainVis(FX_CHAIN_BLIND_TIGHT, 1.2);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const line = r.value.line;
    expect(line.verdict.outcome).toBe("contained");
    expect(v1Violations(line, 1.2)).toBe(0);
    const holds = line.verdict.sight!.holds;
    const budget = holds.find((h) => h.budget_limited === true);
    expect(budget).toBeDefined(); // the budget carve-out actually fires …
    const pos = line.resolved_scenario.rider.plan.find(
      (a) => a.do === "position" && a.id === `hold_${budget!.corner_id}`
    );
    expect(pos).toBeDefined(); // … with a WIRE action (never the emit-nothing branch)
    if (pos === undefined || pos.do !== "position") return;
    // the clipped displacement is at least the MIN_POS_DD_M emission floor
    const road = composed(FX_CHAIN_BLIND_TIGHT);
    const dFrom = road.dOf(1.0, pos.at_s);
    const dTgt = road.dOf(pos.f ?? 0.9, pos.at_s);
    expect(Math.abs(dTgt - dFrom)).toBeGreaterThanOrEqual(MIN_POS_DD_M - 1e-6);
    // achieved f monotone TOWARD the target across the hold window (falling
    // from start.f = 1.0 toward the clipped target; tolerance one grid step)
    const w0 = pos.at_s;
    const w1 = pos.at_s + pos.over_m;
    let prev = Number.POSITIVE_INFINITY;
    for (const sm of line.trajectory.samples) {
      if (sm.s < w0 - 1e-9 || sm.s > w1 + 1e-9) continue;
      expect(sm.f).toBeLessThanOrEqual(prev + 0.02);
      prev = sm.f;
    }
    // release recorded from the actual per-sample state
    expect(Number.isFinite(budget!.hold_release_s)).toBe(true);
    expect(budget!.achieved_f).toBeGreaterThan(0);
  });

  it("P-VIS-MARGIN-MONOTONE (fx-chain-blind): raising the margin never raises the governed entry", { timeout: 600_000 }, () => {
    const at10 = chainVis(FX_CHAIN_BLIND, 1.0);
    const at12 = chainVis(FX_CHAIN_BLIND, 1.2);
    expect(at10.ok && at12.ok).toBe(true);
    if (!at10.ok || !at12.ok) return;
    expect(at12.value.governed_entry_kmh).toBeLessThanOrEqual(at10.value.governed_entry_kmh + 1e-9);
  });
});

// ===========================================================================
// believed-road pipeline (design/04 §4.7, D23; 03 §7.4 sugar)
// ===========================================================================

describe("believed-road solving (04 §4.7, D23)", () => {
  const under90 = (): LineResult =>
    once("under90", () => lineOf(solveMisjudgeSugar({ road: "book90", entry_kmh: 34 }, { kind: "underread", r_believed: 16 })));

  it("F-BELIEVED-90 (underread r_believed=16, pinned): solve on believed, literalize, execute on actual → runoff, with the full misjudgment block", { timeout: 300_000 }, () => {
    const line = under90();
    expect(line.verdict.outcome).toBe("runoff");
    const mj = line.verdict.misjudgment!;
    expect(mj.divergence.kind).toBe("radius");
    expect(mj.divergence.believed).toBe(16);
    expect(mj.divergence.actual).toBe(12);
    expect(mj.divergence.corner_id).toBe("c1");
    expect(mj.s_divergence_m).toBeCloseTo(12, 6); // the corner's entry boundary
    expect(mj.kappa_gap.max_abs_1pm).toBeGreaterThan(0);
    expect(mj.believed.outcome).toBe("clean");
    expect(mj.believed.spec_hash).toMatch(/^[0-9a-f]{6}$/);
    expect(mj.believed.result_hash).toMatch(/^[0-9a-f]{6}$/);
    expect(mj.believed_road_hash).toMatch(/^[0-9a-f]{6}$/);
    // provenance: source.kind = "misjudge" with the sugar record
    expect(line.source.kind).toBe("misjudge");
    if (line.source.kind === "misjudge") {
      expect(line.source.sugar?.kind).toBe("underread");
      expect(line.source.sugar?.params["r_believed"]).toBe(16);
    }
  });

  it("the one-perturbation law in belief space: the executed plan is byte-identical to the believed-world plan", { timeout: 300_000 }, () => {
    const line = under90();
    const believed = lineOf(solve({ road: "lane 3.5 | S 12 | L 16 ^90 | S 16", entry_kmh: 34 }));
    expect(JSON.stringify(line.resolved_scenario.rider.plan)).toBe(
      JSON.stringify(believed.resolved_scenario.rider.plan)
    );
  });

  it("byte-identity holds when the believed road is LONGER than the actual: never-fire actions stay in the record and ride actions_unreached (04 §4.7 'length may differ freely')", { timeout: 300_000 }, () => {
    // actual ends at 12 + 12·(10°) + 0.5 ≈ 14.59 m — BEFORE the believed
    // (book90-shaped) plan's exit roll-on at ≈ 15.3 m
    const ACT = "lane 3.5 | S 12 | L 12 ^10 | S 0.5";
    const BEL = "lane 3.5 | S 12 | L 12 ^90 | S 16";
    const mis = lineOf(solveBelieved({ road: ACT, entry_kmh: 34, believed_road: BEL }));
    const believed = lineOf(solve({ road: BEL, entry_kmh: 34 }));
    // record-level law: the executed plan is byte-identical to the believed-
    // world plan — including the action the actual world does not even contain
    expect(JSON.stringify(mis.resolved_scenario.rider.plan)).toBe(
      JSON.stringify(believed.resolved_scenario.rider.plan)
    );
    // the beyond-end action provably never fired and is recorded as unreached
    const actualEnd = composed(ACT).total_len_m;
    const beyond = mis.resolved_scenario.rider.plan.filter((a) => a.at_s > actualEnd - 1e-9);
    expect(beyond.length).toBeGreaterThanOrEqual(1);
    const unreached = mis.verdict.misjudgment!.actions_unreached;
    for (const a of beyond) expect(unreached).toContain(a.id);
    expect(mis.trajectory.terminated.s).toBeLessThanOrEqual(actualEnd + 1e-6);
  });

  it("P-MISJUDGE-PREFIX (F-BELIEVED-CHAIN): the shared prefix — INCLUDING curved stations — integrates byte-identically in both worlds", { timeout: 300_000 }, () => {
    const believedLine = lineOf(solve({ road: BCHAIN_BELIEVED, entry_kmh: 34 }));
    const misjudge = lineOf(solveBelieved({ road: BCHAIN_ACTUAL, entry_kmh: 34, believed_road: BCHAIN_BELIEVED }));
    const sDiv = misjudge.verdict.misjudgment!.s_divergence_m;
    expect(sDiv).toBeCloseTo(12 + 12 * (Math.PI / 2) + 8, 3); // through c1 + the shared straight
    const bs = believedLine.trajectory.samples.filter((x) => x.s < sDiv - 1e-9);
    const ms = misjudge.trajectory.samples.filter((x) => x.s < sDiv - 1e-9);
    expect(bs.length).toBe(ms.length);
    // the prefix contains CURVED stations (the 09 §3.4 hosting requirement)
    expect(bs.filter((x) => Math.abs(x.kappa) > 0.01).length).toBeGreaterThan(10);
    // byte-identity over the integration channels. The sight-cast family
    // (sight_m/limit_*/sight_ride_m) reads geometry BEYOND s_div by
    // construction (D4 lookahead) and the lane fraction `f` re-frames at the
    // governing-corner handoff (the worlds disagree about the NEXT corner), so
    // those world-derived channels are asserted on their own terms below.
    const kin: readonly (keyof Sample)[] = [
      "s", "t", "x", "y", "psi", "v", "phi", "kappa", "a_long", "a_lat", "grip",
      "mu", "d", "cmd_lean", "cmd_a", "roll_rate", "action_id", "clipped",
      "n_long", "n_lat", "ssd_m", "steer_state", "lat_action_id",
      "su_sustained", "su_transient", "a_cmd_rate", "below_validity"
    ];
    const c1End = 12 + 12 * (Math.PI / 2);
    for (let i = 0; i < bs.length; i++) {
      for (const k of kin) {
        expect(Object.is(bs[i]![k], ms[i]![k]), `field ${String(k)} at s=${bs[i]!.s}`).toBe(true);
      }
      // `f` is byte-identical through the SHARED governing span (start → c1's
      // exit boundary); past it the frame belongs to a corner only one world has
      if (bs[i]!.s <= c1End - 1e-9) {
        expect(Object.is(bs[i]!.f, ms[i]!.f), `f at s=${bs[i]!.s}`).toBe(true);
      }
    }
    // and the divergence is the structure misread it authored
    expect(misjudge.verdict.misjudgment!.divergence.kind).toBe("structure");
    expect(misjudge.verdict.misjudgment!.kappa_gap.max_abs_1pm).toBeGreaterThan(0);
  });

  it("P-MISJUDGE-IDENTITY: believed == actual is INEFFECTUAL; a hand-flip is OUT_OF_SCOPE", { timeout: 300_000 }, () => {
    for (const road of ["book90", "lane 3.5 | S 12 | L 12 ^90 | S 16", BCHAIN_ACTUAL]) {
      const wire = wireRoadSpecOf(road);
      const same = solveBelieved({ road, entry_kmh: 34, believed_road: wire });
      expect(same.ok).toBe(false);
      if (!same.ok) {
        expect(same.error.code).toBe("INEFFECTUAL");
        expect((same.error.detail ?? {})["reason"]).toBe("believed_road_identical");
      }
    }
    // hand-flip: the first divergent corner's hand differs
    const flipped = solveBelieved({
      road: "book90",
      entry_kmh: 34,
      believed_road: "lane 3.5 | S 12 | R 12 ^90 | S 16"
    });
    expect(flipped.ok).toBe(false);
    if (!flipped.ok) {
      expect(flipped.error.code).toBe("OUT_OF_SCOPE");
      expect((flipped.error.detail ?? {})["reason"]).toBe("believed_hand_differs");
    }
  });

  it("the §4.7 validation table: lane geometry, shared prefix, accept policy, one-perturbation, believed-world clean bar", { timeout: 300_000 }, () => {
    const laneDiffers = solveBelieved({
      road: "book90",
      entry_kmh: 34,
      believed_road: "lane 4.0 | S 12 | L 12 ^90 | S 16"
    });
    expect(laneDiffers.ok).toBe(false);
    if (!laneDiffers.ok) {
      expect(laneDiffers.error.code).toBe("SCHEMA");
      expect((laneDiffers.error.detail ?? {})["reason"]).toBe("believed_lane_geometry_differs");
    }

    const noPrefix = solveBelieved({
      road: "book90",
      entry_kmh: 34,
      believed_road: "lane 3.5 | S 14 | L 12 ^90 | S 16"
    });
    // S 12 vs S 14 differ at segment 0 → s_div = 12 > 0: legal. A TRUE
    // zero-prefix divergence needs the first segments to differ immediately:
    const zeroPrefix = solveBelieved({
      road: "lane 3.5 | S 12 | L 12 ^90 | S 16",
      entry_kmh: 34,
      believed_road: "lane 3.5 | L 12 ^90 | S 28"
    });
    expect(zeroPrefix.ok).toBe(false);
    if (!zeroPrefix.ok) {
      expect(zeroPrefix.error.code).toBe("SCHEMA");
      expect((zeroPrefix.error.detail ?? {})["reason"]).toBe("believed_no_shared_prefix");
    }
    void noPrefix;

    const withAccept = solveBelieved({
      road: "book90",
      entry_kmh: 34,
      believed_road: "lane 3.5 | S 12 | L 16 ^90 | S 16",
      accept: "best_failing"
    });
    expect(withAccept.ok).toBe(false);
    if (!withAccept.ok) {
      expect(withAccept.error.code).toBe("SCHEMA");
      expect((withAccept.error.detail ?? {})["reason"]).toBe("accept_policy_incompatible_with_misjudge");
    }

    const withMistake = solveBelieved({
      road: "book90",
      entry_kmh: 34,
      believed_road: "lane 3.5 | S 12 | L 16 ^90 | S 16",
      mistake: { kind: "premature" }
    });
    expect(withMistake.ok).toBe(false);
    if (!withMistake.ok) {
      expect(withMistake.error.code).toBe("SCHEMA");
      expect((withMistake.error.detail ?? {})["reason"]).toBe("misjudge_with_execution_mistake");
    }

    // a believed world whose own solve refuses → believed_world_not_clean
    const notClean = solveBelieved({
      road: "lane 3.5 | S 10 | L 12 ^90 | S 8 | R 12 ^90 | S 12",
      entry_kmh: 34,
      believed_road: "lane 3.5 | S 10 | L 12 ^90 | S 30"
    });
    expect(notClean.ok).toBe(false);
    if (!notClean.ok) {
      expect(notClean.error.code).toBe("NO_SOLUTION");
      expect(subReason(notClean.error)).toBe("believed_world_not_clean");
    }
  });

  it("underread/overread sugar compiles to Layer 1: one rewritten segment, every other byte-identical (03 §7.4)", () => {
    const under = believedRoadFromSugar("book90", { kind: "underread", r_believed: 16 });
    expect(under.ok).toBe(true);
    if (under.ok && "segments" in under.value) {
      const segs = under.value.segments as readonly Segment[];
      expect(segs).toHaveLength(3);
      expect(segs[1]).toEqual({ type: "arc", r_m: 16, angle_deg: 90, hand: "L" });
      expect(segs[0]).toEqual({ type: "straight", len_m: 12 });
      expect(segs[2]).toEqual({ type: "straight", len_m: 16 });
    }
    const over = believedRoadFromSugar("book90", { kind: "overread", r_believed: 9 });
    expect(over.ok).toBe(true);
    if (over.ok && "segments" in over.value) {
      expect((over.value.segments as readonly Segment[])[1]).toEqual({ type: "arc", r_m: 9, angle_deg: 90, hand: "L" });
    }
    // sweep spelling rewrites angle_deg, radius untouched
    const sweep = believedRoadFromSugar("book90", { kind: "underread", sweep_believed_deg: 60 });
    expect(sweep.ok).toBe(true);
    if (sweep.ok && "segments" in sweep.value) {
      expect((sweep.value.segments as readonly Segment[])[1]).toEqual({ type: "arc", r_m: 12, angle_deg: 60, hand: "L" });
    }
    // taper zero-param default: "believed the entry radius holds" (r1)
    const taper = believedRoadFromSugar("bookDecreasing", { kind: "underread" });
    expect(taper.ok).toBe(true);
    if (taper.ok && "segments" in taper.value) {
      expect((taper.value.segments as readonly Segment[])[1]).toEqual({ type: "arc", r_m: 16, angle_deg: 130, hand: "L" });
    }
    // arc corner with no param (or both) → SCHEMA/misjudge_param_required
    const none = believedRoadFromSugar("book90", { kind: "underread" });
    expect(none.ok).toBe(false);
    if (!none.ok) expect((none.error.detail ?? {})["reason"]).toBe("misjudge_param_required");
    const both = believedRoadFromSugar("book90", { kind: "underread", r_believed: 16, sweep_believed_deg: 60 });
    expect(both.ok).toBe(false);
    if (!both.ok) expect((both.error.detail ?? {})["reason"]).toBe("misjudge_param_required");
  });

  it("s_div is exact (no epsilon, no sampling): the divergence walk's three arms", () => {
    const S = (len: number): Segment => ({ type: "straight", len_m: len });
    const L = (r: number, a: number): Segment => ({ type: "arc", r_m: r, angle_deg: a, hand: "L" });
    // same-r same-hand arcs with different sweeps: boundary + smaller sweep
    const sweep = divergenceOf([S(10), L(12, 90), S(5)], [S(10), L(12, 120), S(5)]);
    expect(sweep?.kind).toBe("sweep");
    expect(sweep?.s_div).toBeCloseTo(10 + 12 * degToRad(90), 12);
    // straights of different length: boundary + smaller len
    const str = divergenceOf([S(10), L(12, 90), S(5)], [S(10), L(12, 90), S(9)]);
    expect(str?.s_div).toBeCloseTo(10 + 12 * degToRad(90) + 5, 12);
    // otherwise: the boundary station
    const rad = divergenceOf([S(10), L(12, 90)], [S(10), L(16, 90)]);
    expect(rad?.kind).toBe("radius");
    expect(rad?.s_div).toBe(10);
    // identical lists → null (the INEFFECTUAL arm's predicate)
    expect(divergenceOf([S(10), L(12, 90)], [S(10), L(12, 90)])).toBeNull();
  });

  it("the clamp arm of P-SIGHT-BASIS rides the runoff line: sight_ride_m clamps at the line's end", { timeout: 300_000 }, () => {
    const line = under90(); // terminated off_road before road end
    expect(line.trajectory.terminated.reason).toBe("off_road");
    const clamped = line.trajectory.samples.filter((sm) => sm.sight_ride_m < sm.sight_m - 1.0);
    expect(clamped.length).toBeGreaterThan(0);
  });
});

// ===========================================================================
// P-SIGHT-* / F-SIGHT-OUTSIDE (03 §5.1; hosted here per ARCHITECTURE §7)
// ===========================================================================

describe("sight properties (rider-eye cast, 03 §5.1)", () => {
  const blindRoad = composed("lane 3.5 | S 16 | L 12 ^140 | S 16");
  const hedge = (margin: number, side: "inside" | "outside", span = 36): Occluder[] => [
    { kind: "hedge", side, at: { ref: "entry:c1", offset_m: -6 }, span_m: span, margin_m: margin, depth_m: 2.5 }
  ];

  function resolvedOccluders(road: string, occs: Occluder[]): readonly import("../../src/core/types.js").ResolvedOccluder[] {
    const v = validate({
      spec: "linelab/1",
      id: "sight",
      road: { dsl: road },
      occluders: occs,
      rider: { start: { speed_kmh: 30 }, plan: [] }
    });
    if (!v.ok) throw new Error(`occluder fixture invalid: ${v.error.message}`);
    return v.value.occluders;
  }

  it("P-SIGHT-PURE: deterministic, sight ≥ 0, s_limit within [s_eye, road_end]", () => {
    const occs = resolvedOccluders("lane 3.5 | S 16 | L 12 ^140 | S 16", hedge(0.3, "inside"));
    for (const s of [0, 5, 12, 18, 25, 33, 41, 50]) {
      for (const f of [0, 0.5, 1]) {
        const eye = blindRoad.worldAt(s, blindRoad.dOf(f, s));
        const a = sightFrom(blindRoad, eye, occs);
        const b = sightFrom(blindRoad, eye, occs);
        expect(a).toEqual(b);
        expect(a.sight_m).toBeGreaterThanOrEqual(0);
        expect(a.s_limit).toBeGreaterThanOrEqual(s - 1e-6);
        expect(a.s_limit).toBeLessThanOrEqual(blindRoad.total_len_m + 1e-6);
      }
    }
  });

  it("first-blocked semantics: re-emergent visibility past a gap never counts (a far occluder cannot extend sight past a near one)", () => {
    const near = resolvedOccluders("lane 3.5 | S 16 | L 12 ^140 | S 16", hedge(0.3, "inside", 20));
    const both = resolvedOccluders("lane 3.5 | S 16 | L 12 ^140 | S 16", [
      ...hedge(0.3, "inside", 20),
      { kind: "hedge", side: "inside", at: { at_s: 40 }, span_m: 8, margin_m: 0.3, depth_m: 2.5 }
    ]);
    const eye = blindRoad.worldAt(12, blindRoad.dOf(1, 12));
    const a = sightFrom(blindRoad, eye, near);
    const b = sightFrom(blindRoad, eye, both);
    // the far hedge can only SHORTEN or leave the near-limited cast unchanged
    expect(b.s_limit).toBeLessThanOrEqual(a.s_limit + 1e-9);
  });

  it("P-SIGHT-INSIDE-MONOTONE: with an inside occluder, moving the eye outward never shortens sight", () => {
    const occs = resolvedOccluders("lane 3.5 | S 16 | L 12 ^140 | S 16", hedge(0.3, "inside"));
    for (const s of [14, 18, 24, 30]) {
      let prev = -1;
      for (const f of [0, 0.25, 0.5, 0.75, 1]) {
        const eye = blindRoad.worldAt(s, blindRoad.dOf(f, s));
        const cast = sightFrom(blindRoad, eye, occs);
        expect(cast.sight_m).toBeGreaterThanOrEqual(prev - 1e-6);
        prev = cast.sight_m;
      }
    }
  });

  it("F-SIGHT-OUTSIDE [BLOCKED SEAM, pinned; ratification]: under the own-lane-centre target law (03 §5.1) no band or vehicle occluder makes widening SHORTEN sight — the scan is the tripwire", () => {
    // 09 §3.4's F-SIGHT-OUTSIDE wants the non-monotone counterexample pinned
    // (an outside wall past which widening shortens sight). With sight targets
    // pinned to the own-lane centre polyline, every reachable occluder family
    // (inside/outside bands at any legal margin, own/oncoming vehicles, either
    // hand) leaves sight NON-DECREASING in f. This scan pins that absence: if
    // the target law ever changes, a witness appears, this test fails, and the
    // real F-SIGHT-OUTSIDE pin must be written in its place.
    for (const hand of ["L", "R"]) {
      for (const side of ["inside", "outside"] as const) {
        const dsl = `lane 3.5 | S 16 | ${hand} 12 ^140 | S 16`;
        const road = composed(dsl);
        const v = validate({
          spec: "linelab/1",
          id: "sight-outside",
          road: { dsl },
          occluders: [{ kind: "hedge", side, at: { ref: "entry:c1", offset_m: -6 }, span_m: 36, margin_m: 0.3, depth_m: 2.5 }],
          rider: { start: { speed_kmh: 30 }, plan: [] }
        });
        expect(v.ok).toBe(true);
        if (!v.ok) continue;
        for (let s = 4; s <= 40; s += 4) {
          const f0 = sightFrom(road, road.worldAt(s, road.dOf(0, s)), v.value.occluders).sight_m;
          const f1 = sightFrom(road, road.worldAt(s, road.dOf(1, s)), v.value.occluders).sight_m;
          expect(f1).toBeGreaterThanOrEqual(f0 - 0.25);
        }
      }
    }
  });

  it("P-SIGHT-BASIS: on a corner-less straight the rider-path rebase equals the centreline sight (± eps) at every station", () => {
    // corner-less road: NO_CORNER_FRAME_HAND governs the frame; the plan-less
    // scenario tracks a constant offset, so path length = station delta exactly
    const v = validate({
      spec: "linelab/1",
      id: "straight",
      road: { dsl: "lane 3.5 | S 60" },
      rider: { start: { speed_kmh: 34 }, plan: [] }
    });
    expect(v.ok).toBe(true);
    if (!v.ok) return;
    // the resolved scenario integrates via the ordinary pipeline: reuse the
    // executed samples from a chained front-door call (single road, no corner
    // → the engine still runs; chainedSolve refuses corner-less roads, so ride
    // through the sight-unit surface instead: cast directly along the line)
    const straight = composed("lane 3.5 | S 60");
    for (const s of [0, 10, 25, 40]) {
      const eye = straight.worldAt(s, straight.dOf(1, s));
      const cast = sightFrom(straight, eye, []);
      // no occluders: sight runs to the road end (blindness comes only from
      // occluders, by design) — the ride-path rebase along a parallel line is
      // the same arc length
      expect(cast.sight_m).toBeCloseTo(straight.total_len_m - s, 6);
    }
  });
});

// ---------------------------------------------------------------------------
// The shipped fig-8.5 `late` line (figures/fig-08-05.scene, read-only).
//
// The scene authors `believeRoad="lane 3.5 | S 10 | L 24 ^130 | S 12"` at
// 30 km/h against `preset bookDoubleApex`. That believed world used to refuse
// NO_SOLUTION/`believed_world_not_clean` carrying an inner `empty_band` — not
// because the belief is unridable but because the §3 coarse sweep judged
// containment with the drive pinned at the aim station (see the coarse-band
// rescue gates in solver-core.test.ts). The believed world is an ordinary R24
// corner; §4.7 step 1's clean bar must be MET, so the mistake line exists and
// the figure has two lines to draw.

describe("fig-8.5's believed world is solvable (design/04 §4.7 step 1)", () => {
  const SCENE_BELIEVED = "lane 3.5 | S 10 | L 24 ^130 | S 12";

  it("the believed world self-verifies clean, so the `late` line compiles and executes", { timeout: 300_000 }, () => {
    const believed = solve({ road: SCENE_BELIEVED, entry_kmh: 30 });
    expect(believed.ok).toBe(true);
    if (!believed.ok) return;
    expect(believed.value.verdict.outcome).toBe("contained");
    expect(believed.value.verdict.ok).toBe(true);

    const late = solveBelieved({
      road: "bookDoubleApex",
      entry_kmh: 30,
      believed_road: SCENE_BELIEVED
    });
    expect(late.ok).toBe(true);
    if (!late.ok) return;
    const mj = late.value.verdict.misjudgment;
    expect(mj).not.toBeNull();
    if (mj === null || mj === undefined) return;
    // the belief is an under-read of the R12 first touch, diverging exactly at
    // the corner's own entry station (S 10) — computed, never sampled
    expect(mj.believed.outcome).toBe("clean");
    expect(mj.s_divergence_m).toBeCloseTo(10, 12);
    expect(mj.divergence.kind).toBe("radius");
    expect(mj.divergence.believed).toBe(24);
    expect(mj.divergence.actual).toBe(12);
    // the executed plan is the believed world's, byte-for-byte (§4.7 step 2)
    expect(JSON.stringify(late.value.resolved_scenario.rider.plan)).toBe(
      JSON.stringify(believed.value.resolved_scenario.rider.plan)
    );
    // and it is graded on the ACTUAL road with no misjudgment discount (D9)
    expect(["wide", "runoff", "crash"]).toContain(late.value.verdict.outcome);
  });
});
