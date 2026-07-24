// test/golden/gates.test.ts — WP-17: the non-roster golden gates of design/09
// §3.2 — G-OFFROAD-BRACKET, G-STOPPED, G-POS-REACH, G-PRESET-HANDS,
// G-SIGHT-BASIS, G-POV-CLAMP-MIDCORNER (fixture only in v0.1), G-APEXLIST
// (blocked — pinned engine seam), and the D42 pair G-CORR-RIDER /
// G-CF-PRECONDITION-TABLE.
//
// One shared engine run (book90 + premature = F-ORACLE-90's shape) feeds the
// corrective/off-road/POV gates; everything else is either pure geometry or a
// cheap explicit-plan run.
//
// ENGINE-TRUTH SEAMS carried (PENDING RATIFICATION, pinned upstream):
//   - G-APEXLIST's designed [1, 0, 1] apex list requires the two-touch
//     bookDoubleApex line, which this engine REFUSES (`no_two_touch_line`) —
//     the frozen 02 §3.1 release law cannot carry the commitment across the
//     horseshoe (test/property/solver-ext.test.ts "A-DOUBLEAPEX SEAM").
//     The blocked pin is recorded below as a todo beside the typed-refusal pin.
//   - G-POV-CLAMP-MIDCORNER's design value 36.8° presumes the rider ~1.34 m
//     inside of centre at mid-corner; this engine's solved line sits at
//     ~1.30 m → 37.4° by the same grazing arithmetic. Pinned within ±1.5°.

import { describe, it, expect } from "vitest";

import { run, ENGINE_SEMVER } from "../../src/solve/run.js";
import { runVerb } from "../../src/cli/verbs/run.js";
import { isLineRefusal } from "../../src/solve/envelope.js";
import type { FigureResult, LineResult } from "../../src/solve/types.js";
import { solveDoubleApex } from "../../src/solve/doubleApex.js";
import { correctiveShot, CORRECTIVE_BINDING, CORRECTIVE_DISCLOSURE } from "../../src/solve/corrective.js";
import { compose } from "../../src/road/compose.js";
import { PRESETS, PRESET_NAMES } from "../../src/road/presets.js";
import { sightFrom } from "../../src/sight/cast.js";
import { G } from "../../src/core/constants.js";
import { phiReserve } from "../../src/core/slice.js";
import { buildSchemaDoc } from "../../src/cli/doc/schema.js";

function lineOf(env: FigureResult, id: string): LineResult {
  const line = env.lines.find((l) => l.line_id === id);
  if (line === undefined || isLineRefusal(line)) {
    throw new Error(`line ${id} missing/refused: ${JSON.stringify((line as { error?: unknown } | undefined)?.error ?? null)}`);
  }
  return line;
}

// ---------------------------------------------------------------------------
// The one shared run: book90 + premature (solved + mistake lines)

let oracleCache: FigureResult | null = null;
function oracle90(): FigureResult {
  if (oracleCache !== null) return oracleCache;
  const r = run({ road: "book90", entry_kmh: 34, mistake: { kind: "premature" } }, { engine_semver: ENGINE_SEMVER, figure_id: "F-ORACLE-90" });
  if (!r.ok) throw new Error(`F-ORACLE-90 refused: ${JSON.stringify(r.error)}`);
  oracleCache = r.value;
  return r.value;
}

// ---------------------------------------------------------------------------

describe("G-OFFROAD-BRACKET + the G-CORR-RUNOFF terminal pin (design/09 §3.2)", () => {
  it("the off_road crossing lies within one integrator step of the edge; the terminal sample sits ON the edge (|d| = lane_width ± 0.05)", { timeout: 300_000 }, () => {
    const env = oracle90();
    const prem = lineOf(env, "premature");
    expect(prem.trajectory.terminated.reason).toBe("off_road");
    const laneWidth = env.road.lane_width_m;

    const samples = prem.trajectory.samples;
    const last = samples[samples.length - 1]!;
    // the endpoint is ON the edge, not wandering in the grass
    expect(Math.abs(Math.abs(last.d) - laneWidth)).toBeLessThanOrEqual(0.05);

    // bracketing: every retained sample before the terminal is on-road; the
    // crossing lies between the last on-road station and the terminal, within
    // one resample step of it
    const onRoad = samples.filter((p) => Math.abs(p.d) <= laneWidth + 1e-9);
    const lastOn = onRoad[onRoad.length - 1]!;
    const step = samples.length >= 2 ? samples[samples.length - 1]!.s - samples[samples.length - 2]!.s : 0.5;
    expect(prem.trajectory.terminated.s).toBeGreaterThanOrEqual(lastOn.s - 1e-9);
    expect(prem.trajectory.terminated.s - lastOn.s).toBeLessThanOrEqual(step + 1e-9);
  });
});

describe("G-CORR-RIDER (D42 — the corrective shot's declared identity, out-of-hash)", () => {
  it("correctiveShot binds (lean_only_reserve, return_after_detect) at its definition site; the runoff shot document is infeasible with a typed fail_reason; calling it moves NO hash", { timeout: 300_000 }, () => {
    expect(CORRECTIVE_BINDING).toEqual({ rider: "lean_only_reserve", predicate: "return_after_detect" });
    // the §4c.7 disclosure names the lean-only rider (A-CORR-EXPLAIN pins the
    // full sentence on every explain surface; here the source constant)
    expect(CORRECTIVE_DISCLOSURE).toContain("lean-only");

    const env = oracle90();
    const prem = lineOf(env, "premature");
    const hashBefore = prem.verdict.result_hash;
    const shot = correctiveShot(prem);
    expect(shot.ok).toBe(true);
    if (!shot.ok) return;
    const doc = shot.value.corrective;
    expect(doc.feasible).toBe(false); // the pinned G-CORR-RUNOFF arm
    expect(doc.fail_reason).not.toBeNull();
    // §4a.6: the block deliberately carries NO rider member — the binding is
    // the wrapper's, declared above (D42 §4c.7)
    expect("rider" in doc).toBe(false);
    // out-of-hash: the shadow document never moves the line's identity
    expect(prem.verdict.result_hash).toBe(hashBefore);
  });
});

describe("G-STOPPED (design/09 §3.2)", () => {
  const scenario = {
    spec: "linelab/1",
    id: "g-stopped",
    road: { dsl: "lane 3.5 | S 120" },
    rider: { profile: "street", start: { speed_kmh: 34, f: 0.5 }, plan: [{ do: "brake", id: "b1", at_s: 5, decel: 7.0 }] }
  };

  it("straight-road hard brake to the floor: terminated stopped, outcome stopped, quality caution, exit tier 0", { timeout: 120_000 }, () => {
    const outcome = runVerb({ loadedText: JSON.stringify(scenario), argv: [], engineSemver: ENGINE_SEMVER });
    expect(outcome.exit).toBe(0); // stopping is a result, not an error (D11)
    const env = (outcome.stdout as { value: FigureResult }).value;
    const line = env.lines.find((l) => !isLineRefusal(l)) as LineResult;
    expect(line.trajectory.terminated.reason).toBe("stopped");
    expect(line.verdict.outcome).toBe("stopped");
    expect(line.verdict.quality).toBe("caution");
    // upright stop: no below_validity flag anywhere (09 §3.2's C30-stop rule)
    expect(line.trajectory.samples.every((p) => p.below_validity !== true)).toBe(true);
  });
});

describe("G-POS-REACH (design/09 §3.2 — the reachability predicate is pinned to the engine)", () => {
  const mk = (kmh: number, over: number | "auto"): Record<string, unknown> => ({
    spec: "linelab/1",
    id: `fx-pos-${kmh}`,
    road: { dsl: "lane 3.5 | S 120" },
    rider: {
      profile: "street",
      start: { speed_kmh: kmh, f: 0.2 },
      plan: [{ do: "position", id: "p1", at_s: 10, f: 0.9, over_m: over }]
    }
  });

  it("every accepted variant (28/34/50 km/h, over_m auto) completes: position_complete fires inside the window and final f = 0.9 ± 0.02", { timeout: 120_000 }, () => {
    for (const kmh of [28, 34, 50]) {
      const r = run(mk(kmh, "auto"), { engine_semver: ENGINE_SEMVER });
      expect(r.ok, `run ${kmh}`).toBe(true);
      if (!r.ok) continue;
      const line = r.value.lines.find((l) => !isLineRefusal(l)) as LineResult;
      expect(line, `line ${kmh}`).toBeDefined();

      const complete = line.trajectory.events.find((e) => e.kind === "position_complete");
      expect(complete, `position_complete @${kmh}`).toBeDefined();
      // inside the RESOLVED window [at_s, at_s + over_m) — the validator
      // accepted the move, so the window's physical capacity covers it
      const resolved = line.resolved_scenario.rider.plan.find((a) => a.do === "position") as { at_s: number; over_m: number };
      expect(complete!.s).toBeGreaterThanOrEqual(resolved.at_s);
      expect(complete!.s).toBeLessThan(resolved.at_s + resolved.over_m);

      const last = line.trajectory.samples[line.trajectory.samples.length - 1]!;
      expect(Math.abs(last.f - 0.9)).toBeLessThanOrEqual(0.02);
    }
  });

  it("a variant the predicate refuses is TYPED — INEFFECTUAL/position_target_unreachable with the reachability payload — never a silent under-move", { timeout: 120_000 }, () => {
    const r = run(mk(34, 6), { engine_semver: ENGINE_SEMVER });
    // the refusal may surface at run level or as a per-line refusal
    const err = r.ok ? (r.value.lines.find((l) => isLineRefusal(l)) as { error: { code: string; detail?: Record<string, unknown> } } | undefined)?.error : r.error;
    expect(err).toBeDefined();
    expect(err!.code).toBe("INEFFECTUAL");
    expect(err!.detail?.["reason"]).toBe("position_target_unreachable");
    const required = err!.detail?.["required_over_m"] as number;
    const achievable = err!.detail?.["achievable_dd_m"] as number;
    const requested = err!.detail?.["requested_dd_m"] as number;
    expect(required).toBeGreaterThan(6);
    expect(achievable).toBeLessThan(requested);
    // (the validating-but-under-delivering arm — position_shortfall with
    // deficit_m — is witnessed by T-POS-SHORTFALL in test/effectuality/d8.test.ts)
  });
});

describe("G-PRESET-HANDS (design/09 §3.2 vs design/03 §3.1's table)", () => {
  // the §3.1 table, transcribed as the EXPECTATION (the preset data itself is
  // single-sourced in road/presets.ts and byte-compared there by WP-02's suite)
  const TABLE: Record<string, { hand: "L" | "R"; entry: number }> = {
    book90: { hand: "L", entry: 34 },
    bookDecreasing: { hand: "L", entry: 34 },
    bookEsses: { hand: "R", entry: 32 },
    bookHairpin: { hand: "R", entry: 28 },
    bookBlind: { hand: "L", entry: 34 },
    bookDoubleApex: { hand: "L", entry: 30 }
  };

  it("every shipped preset's default hand and suggested entry match 03 §3.1; the composed expansion opens on the table's hand", () => {
    expect([...PRESET_NAMES].sort()).toEqual(Object.keys(TABLE).sort());
    for (const name of PRESET_NAMES) {
      const want = TABLE[name]!;
      expect(PRESETS[name].hand, name).toBe(want.hand);
      expect(PRESETS[name].suggested_entry_kmh, name).toBe(want.entry);
      const r = compose({ preset: name });
      expect(r.ok, name).toBe(true);
      if (!r.ok) continue;
      expect(r.value.corners[0]!.hand, name).toBe(want.hand);
    }
  });

  it("book90 is a left-hander whose mirror flips every corner hand (hand=R)", () => {
    const mirrored = compose({ preset: "book90", hand: "R" });
    expect(mirrored.ok).toBe(true);
    if (!mirrored.ok) return;
    expect(mirrored.value.corners[0]!.hand).toBe("R");
  });

  it("`schema road-dsl` carries the disclosure columns: per-preset hand + suggested entry", () => {
    const doc = buildSchemaDoc("road-dsl");
    expect(doc.ok).toBe(true);
    if (!doc.ok) return;
    const section = JSON.stringify(doc.value);
    for (const name of PRESET_NAMES) {
      expect(section).toContain(name);
      expect(section).toContain(`default hand ${PRESETS[name].hand}`);
      expect(section).toContain(`suggested entry ${PRESETS[name].suggested_entry_kmh} km/h`);
    }
  });
});

describe("G-SIGHT-BASIS (design/09 §3.2, D16 — the rider-path basis is measured, not assumed)", () => {
  it("R12 inside-offset fixture: sight_ride_m/sight_m equals the road-algebra re-derivation from the recorded d-profile (±0.01), and the inside line rides SHORT (ratio < 1)", { timeout: 120_000 }, () => {
    const scenario = {
      spec: "linelab/1",
      id: "g-sight-basis",
      road: { dsl: "lane 3.5 | S 16 | L 12 ^140 | S 16" },
      occluders: [{ kind: "hedge", id: "h1", side: "inside", at: { ref: "mid:c1" }, span_m: 28, margin_m: 0.5, depth_m: 2.5 }],
      rider: {
        profile: "street",
        start: { speed_kmh: 25, f: 0.5 },
        plan: [{ do: "turn_in", id: "t1", at_s: 14, target: { lean_deg: 24 } }]
      }
    };
    const r = run(scenario as unknown as Record<string, unknown>, { engine_semver: ENGINE_SEMVER });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const env = r.value;
    const line = env.lines.find((l) => !isLineRefusal(l)) as LineResult;
    const road = env.road;
    const c1 = road.corners[0]!;

    // pick mid-arc samples whose whole sight span stays inside the trajectory
    const samples = line.trajectory.samples;
    const probes = samples.filter((p) => p.s > c1.s0 + 2 && p.s < c1.s_mid + 6 && p.sight_m > 5);
    expect(probes.length).toBeGreaterThan(10);

    const dAt = (s: number): number => {
      // recorded d-profile, linearly interpolated
      let lo = 0;
      let hi = samples.length - 1;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (samples[mid]!.s >= s) hi = mid;
        else lo = mid + 1;
      }
      const b = samples[lo]!;
      const a = samples[Math.max(0, lo - 1)]!;
      const span = b.s - a.s;
      const alpha = span > 0 ? (s - a.s) / span : 0;
      return a.d + alpha * (b.d - a.d);
    };

    for (const p of probes.filter((_, i) => i % 7 === 0)) {
      // independent re-derivation: integrate the ridden-offset path length
      // over the centreline span [s, s + sight_m] from ROAD algebra alone
      // (worldAt + the recorded d-profile) — never from the recorded x/y
      const target = Math.min(p.s + p.sight_m, samples[samples.length - 1]!.s);
      const steps = 200;
      let length = 0;
      let prev = road.worldAt(p.s, dAt(p.s));
      for (let k = 1; k <= steps; k++) {
        const s = p.s + ((target - p.s) * k) / steps;
        const w = road.worldAt(s, dAt(s));
        length += Math.hypot(w.x - prev.x, w.y - prev.y);
        prev = w;
      }
      const expected = length / p.sight_m;
      const measured = p.sight_ride_m / p.sight_m;
      expect(Math.abs(measured - expected), `s=${p.s.toFixed(1)}`).toBeLessThanOrEqual(0.01);
    }

    // the D16 teaching: an inside line rides a SHORTER path to the same
    // centreline lookahead — the ratio sits below 1 on the inside samples
    const inside = probes.filter((p) => p.s < c1.s_mid);
    expect(inside.length).toBeGreaterThan(0);
    for (const p of inside) expect(p.sight_ride_m / p.sight_m).toBeLessThan(1);
  });
});

describe("G-POV-CLAMP-MIDCORNER (design/09 §3.2 — fixture only in v0.1; POV consumption is v0.3)", () => {
  // design/07 §5.3: pinhole POV with fov_deg = 60 (TUNING, 07-owned — no v0.1
  // code constant exists yet; the literal is this fixture's whole point: a
  // future re-tune that changes the clamp behaviour must move THIS pin in a
  // deliberate re-bless).
  const FOV_DEG = 60;

  it("book90 mid-corner (50% sweep): the inside-edge grazing bearing ≈ 36.8° (±1.5° — engine d ≈ 1.30 m vs the design's 1.34 m) exceeds the 30° half-frame → markerState clamps, arrow into the turn", { timeout: 300_000 }, () => {
    const env = oracle90();
    const solved = lineOf(env, "solved");
    const road = env.road;
    const c1 = road.corners[0]!;
    expect(c1.hand).toBe("L");

    // the mid-corner sample of the ridden line
    const sample = solved.trajectory.samples.reduce((a, b) => (Math.abs(b.s - c1.s_mid) < Math.abs(a.s - c1.s_mid) ? b : a));
    // the rider rides INSIDE of centre at mid-corner (the late-apex shape)
    const dInside = Math.abs(sample.d);
    expect(dInside).toBeGreaterThan(0.5);

    // the 07 §5.3 arithmetic: eye on the ridden circle (R − d_inside), limit
    // point grazing the inside road edge (R − lane_width); bearing between
    // heading (tangent) and the grazing ray = 90° − asin(Ri/Re)
    const Re = c1.r - dInside;
    const Ri = c1.r - road.lane_width_m;
    const bearingDeg = 90 - (Math.asin(Ri / Re) * 180) / Math.PI;
    expect(Math.abs(bearingDeg - 36.8)).toBeLessThanOrEqual(1.5);

    // the clamp inequality the invariant rests on — with real headroom, so
    // "frame roll only makes it worse" stays true
    const halfFrame = FOV_DEG / 2;
    expect(bearingDeg).toBeGreaterThan(halfFrame + 5);

    // the arrow's horizontal sign points INTO the turn: on this left-hander
    // the recorded lean is negative through the corner (handSign("R") = +1)
    expect(sample.phi).toBeLessThan(0);
  });
});

describe("G-APEXLIST (design/09 §3.2 — BLOCKED by the pinned A-DOUBLEAPEX SEAM)", () => {
  it("the designed two-touch line does not exist on this engine: solveDoubleApex(bookDoubleApex) refuses NO_SOLUTION/no_two_touch_line over the c1..c3 window", { timeout: 300_000 }, () => {
    const r = solveDoubleApex({ road: "bookDoubleApex", entry_kmh: 30, style: "double_apex" });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.code).toBe("NO_SOLUTION");
    expect(r.error.detail?.["sub_reason"]).toBe("no_two_touch_line");
    const window = r.error.detail?.["window"] as { corner_ids: string[] };
    expect(window.corner_ids).toEqual(["c1", "c2", "c3"]);
  });

  it.todo("G-APEXLIST as designed — apexes [1, 0, 1] across c1..c3, late_apex reads the final apex, apex events carry detail.index — lands when the A-DOUBLEAPEX SEAM is ratified/resolved (the two-touch line must first exist)");
});

describe("G-CF-PRECONDITION-TABLE (D42 — design/04 §4c.4's table recomputed from the shipped presets, ±0.01)", () => {
  // R_res(v) = v²/(G·tan(phiReserve(skill·mu))) — street skill 0.85, mu 1.0.
  // Rows: the §4c.4 table verbatim (preset, corner radius source, entry km/h,
  // expected ratio). Radii are READ from the composed presets, never inlined.
  interface Row {
    readonly label: string;
    readonly preset: "book90" | "bookBlind" | "bookEsses" | "bookHairpin" | "bookDoubleApex" | "bookDecreasing";
    readonly corner: (radii: readonly number[], rMin: readonly number[]) => number;
    readonly entry_kmh: number;
    readonly want: number;
  }
  const ROWS: readonly Row[] = [
    { label: "book90 @ entry", preset: "book90", corner: (r) => r[0]!, entry_kmh: 34, want: 0.89 },
    { label: "book90 @ solved turn-in (01 A.3)", preset: "book90", corner: (r) => r[0]!, entry_kmh: 30, want: 0.69 },
    { label: "bookBlind @ entry", preset: "bookBlind", corner: (r) => r[0]!, entry_kmh: 34, want: 0.89 },
    { label: "bookEsses @ entry", preset: "bookEsses", corner: (r) => r[0]!, entry_kmh: 32, want: 0.79 },
    { label: "bookHairpin @ entry", preset: "bookHairpin", corner: (r) => r[0]!, entry_kmh: 28, want: 0.73 },
    { label: "bookDoubleApex c1/c3", preset: "bookDoubleApex", corner: (r) => r[0]!, entry_kmh: 30, want: 0.69 },
    { label: "bookDoubleApex c2 (opening middle)", preset: "bookDoubleApex", corner: (r) => r[1]!, entry_kmh: 30, want: 0.35 },
    { label: "bookDecreasing tightened exit (r2)", preset: "bookDecreasing", corner: (_, rMin) => rMin[0]!, entry_kmh: 34, want: 1.19 }
  ];

  it("all rows reproduce within ±0.01; every governing ratio < 1 except the flagged bookDecreasing exit", () => {
    const tanRes = Math.tan(phiReserve(0.85 * 1.0));
    for (const row of ROWS) {
      const composed = compose({ preset: row.preset });
      expect(composed.ok, row.preset).toBe(true);
      if (!composed.ok) continue;
      const radii = composed.value.corners.map((c) => c.r);
      const rMin = composed.value.corners.map((c) => c.r_min);
      const rRoad = row.corner(radii, rMin);
      const v = row.entry_kmh / 3.6;
      const rRes = (v * v) / (G * tanRes);
      const ratio = rRes / rRoad;
      expect(Math.abs(ratio - row.want), `${row.label}: ${ratio.toFixed(4)} vs ${row.want}`).toBeLessThanOrEqual(0.01);
      if (row.label.includes("tightened exit")) expect(ratio).toBeGreaterThan(1);
      else expect(ratio).toBeLessThan(1);
    }
    // and the denominator itself is the design's 8.3385 (D42)
    expect(G * tanRes).toBeCloseTo(8.3385, 3);
  });
});
