// test/golden/roster.test.ts — WP-17: the full bless roster recomputed against
// the COMMITTED blessed goldens under THE tolerance table (design/09 §3.2;
// tolerances at test/fixtures/tolerances.json, ARCHITECTURE §10.25).
//
// Discipline (09 §3.2): goldens are BLESSED, never hand-computed — this file
// asserts that the running engine still reproduces the committed records
// (raw pre-emission f64 via the same bless tap, categorical fields exact,
// result_hash exact). A mismatch outside a re-bless commit is a failure; a
// physics change is a MIGRATION (09 §3.3). This recompute-vs-committed leg IS
// the result_hash half of the §3.3 tripwire (test/hash/tripwire.test.ts's
// marked section cross-references it — the spec-identity half lives there).
//
// ENGINE-TRUTH PINS carried from the frozen upstream packages (all PENDING
// RATIFICATION, recorded by WP-10/11/12/16 and re-recorded in WP-17's return):
//   - C30 solves at 63 km/h (not 02 §8's 70).
//   - C30-chop grades outcome "wide" on this engine (03 §7.1's letter says
//     "runoff"; the oracle's book90 chop row DOES grade runoff — the C30-road
//     chop is the seam).
//   - G-CORR-WIDE's premature line grades "runoff" with corrective.feasible
//     false (design letter: "wide"/feasible).
//   - C30's committed check vector has trail_brake_taper "na" (no brake past
//     turn-in on the solved line) — 09 §3.2's gloss "the rest pass" over-counts.
// The oracle iron rule (09 §4): none of these move by editing expectations.

import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  BLESS_ROSTER,
  BLESSED_BLOCK_FIXTURES,
  computeGoldenRecords,
  tolLabelsFrom,
  type GoldenRecord
} from "../../src/cli/bless.js";
import { run, ENGINE_SEMVER } from "../../src/solve/run.js";
import { isLineRefusal } from "../../src/solve/envelope.js";
import type { LineResult } from "../../src/solve/types.js";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "../..");
const goldensDir = join(repoRoot, "test", "fixtures", "goldens");

const tolerances: unknown = JSON.parse(readFileSync(join(repoRoot, "test", "fixtures", "tolerances.json"), "utf8"));

// ---------------------------------------------------------------------------
// The one recompute (the entire roster through the same loaders/tap the bless
// script uses) — computed lazily, once for the whole file.

let recomputedCache: ReadonlyMap<string, GoldenRecord> | null = null;
function recomputed(): ReadonlyMap<string, GoldenRecord> {
  if (recomputedCache !== null) return recomputedCache;
  const r = computeGoldenRecords(tolLabelsFrom(tolerances));
  if (!r.ok) throw new Error(`roster recompute refused at ${r.failure.fixture}: ${JSON.stringify(r.failure.error)}`);
  // JSON round-trip so both sides carry the identical value domain the
  // committed files hold (drops undefined, normalizes -0 the way the bless
  // write did)
  const map = new Map<string, GoldenRecord>();
  for (const rec of r.records) map.set(rec.fixture, JSON.parse(JSON.stringify(rec)) as GoldenRecord);
  recomputedCache = map;
  return map;
}

function committed(id: string): GoldenRecord {
  return JSON.parse(readFileSync(join(goldensDir, `${id}.json`), "utf8")) as GoldenRecord;
}

// ---------------------------------------------------------------------------
// Category-aware deep comparison (09 §3.2: "tolerance category must match
// quantity category"). Key → tolerance mapping, from THE table:
//   positions ±0.01 m   — stations/metres (s, s0/s1, *_s, *_m, x, y, d)
//   angles    ±0.01°    — *_deg keys (record angles are degrees, 05 §2.1)
//   speeds    ±0.01 m/s — *_ms keys; *_kmh compared at 0.01 × 3.6
//   apex_pct  ±0.1      — pct
//   fractions ±0.001    — f, grip, grip_min
//   times ride the positions row (±0.01 s) — a local pin recorded in WP-17's
//   deviations (the table names no time category; on the pinned runtime the
//   recompute is bit-identical anyway, D29).
// Everything non-numeric (ids, verdicts, outcome, quality, result_hash,
// terminated.reason, event kinds) compares EXACT; array lengths exact.

interface Tol {
  readonly positions: number;
  readonly angles: number;
  readonly speeds: number;
  readonly apex_pct: number;
  readonly fractions: number;
}
const TOL: Tol = (() => {
  const cats = (tolerances as { categories: readonly { category: string; tol?: number }[] }).categories;
  const of = (name: string): number => {
    const row = cats.find((c) => c.category === name);
    if (row?.tol === undefined) throw new Error(`tolerances.json misses category ${name}`);
    return row.tol;
  };
  return { positions: of("positions"), angles: of("angles"), speeds: of("speeds"), apex_pct: of("apex_pct"), fractions: of("fractions") };
})();

function tolForKey(key: string): number {
  if (key === "pct") return TOL.apex_pct;
  if (key === "f" || key === "grip" || key === "grip_min") return TOL.fractions;
  if (key.endsWith("_deg") || key === "psi" || key === "phi") return TOL.angles;
  if (key.endsWith("_kmh")) return TOL.speeds * 3.6;
  if (key.endsWith("_ms") || key === "v") return TOL.speeds;
  // stations, metres, seconds (local pin, see header), coordinates
  return TOL.positions;
}

/** Deep golden comparison: numbers under the key's category, all else exact. */
function compareGolden(path: string, want: unknown, got: unknown, misses: string[]): void {
  if (typeof want === "number" && typeof got === "number") {
    const key = path.split(".").pop() ?? "";
    const tol = tolForKey(key.replace(/\[\d+\]$/, ""));
    if (!(Math.abs(got - want) <= tol)) {
      misses.push(`${path}: committed ${want} vs recomputed ${got} (tol ±${tol})`);
    }
    return;
  }
  if (Array.isArray(want) && Array.isArray(got)) {
    if (want.length !== got.length) {
      misses.push(`${path}: length ${want.length} vs ${got.length}`);
      return;
    }
    want.forEach((w, i) => compareGolden(`${path}[${i}]`, w, got[i], misses));
    return;
  }
  if (want !== null && got !== null && typeof want === "object" && typeof got === "object") {
    const wk = Object.keys(want as Record<string, unknown>).sort();
    const gk = Object.keys(got as Record<string, unknown>).sort();
    if (wk.join(",") !== gk.join(",")) {
      misses.push(`${path}: key sets differ — committed {${wk.join(",")}} vs recomputed {${gk.join(",")}}`);
      return;
    }
    for (const k of wk) {
      compareGolden(`${path}.${k}`, (want as Record<string, unknown>)[k], (got as Record<string, unknown>)[k], misses);
    }
    return;
  }
  if (want !== got) misses.push(`${path}: committed ${JSON.stringify(want)} vs recomputed ${JSON.stringify(got)}`);
}

// ---------------------------------------------------------------------------
// The committed store is roster-complete (and nothing else lives there)

describe("the committed golden store (first bless, WP-17)", () => {
  it("holds exactly one blessed record per roster fixture, stamped with the running engine", () => {
    const files = readdirSync(goldensDir).filter((f) => f.endsWith(".json")).sort();
    expect(files).toEqual(BLESS_ROSTER.map((e) => `${e.id}.json`).sort());
    for (const entry of BLESS_ROSTER) {
      const rec = committed(entry.id);
      expect(rec.fixture).toBe(entry.id);
      expect(rec.engine_semver).toBe(ENGINE_SEMVER);
      expect(rec.lines.length).toBeGreaterThan(0);
    }
  });

  it("exactly the 02 §8.1 block fixtures carry blessed rows (C30, C30-chop, C30-trailbrake, C30-DR)", () => {
    expect([...BLESSED_BLOCK_FIXTURES].sort()).toEqual(["C30", "C30-DR", "C30-chop", "C30-trailbrake"]);
    for (const entry of BLESS_ROSTER) {
      const rec = committed(entry.id);
      if (BLESSED_BLOCK_FIXTURES.includes(entry.id)) expect(rec.blessed.length).toBeGreaterThan(0);
      else expect(rec.blessed).toEqual([]);
    }
  });
});

// ---------------------------------------------------------------------------
// The recompute: every roster fixture vs its committed record

describe("golden roster recompute vs committed fixtures (09 §3.2/§3.3)", () => {
  it("every fixture recomputes inside THE tolerance table — categoricals and result_hash exact", { timeout: 900_000 }, () => {
    const got = recomputed();
    const misses: string[] = [];
    for (const entry of BLESS_ROSTER) {
      const want = committed(entry.id);
      const have = got.get(entry.id);
      if (have === undefined) {
        misses.push(`${entry.id}: missing from recompute`);
        continue;
      }
      compareGolden(entry.id, want, have, misses);
    }
    expect(misses, misses.join("\n")).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Design-pinned per-fixture assertions readable off the COMMITTED records
// (samples-level pins — phi_dot_su ≡ 0, the (W) predicate, clip margins — are
// hosted by test/property/physics.test.ts on the same scenario shapes)

describe("C30 (extended — design/09 §3.2 pins on the committed record)", () => {
  const rec = committed("C30");
  const line = rec.lines[0]!;

  it("release event pinned; exit straightens: |heading_err| ≤ 1.0°, road_end |phi| ≤ 0.25°, f inside the usable corridor", () => {
    expect(line.events.some((e) => e.kind === "release")).toBe(true);
    const row = (q: string): number | string => {
      const r = rec.blessed.find((b) => b.quantity === q);
      if (r === undefined) throw new Error(`blessed row ${q} missing`);
      return r.value;
    };
    expect(Math.abs(row("exit_heading_err_deg") as number)).toBeLessThanOrEqual(1.0 + 1e-9);
    expect(Math.abs(row("road_end_phi_deg") as number)).toBeLessThanOrEqual(0.25);
    const f = row("road_end_f") as number;
    expect(f).toBeGreaterThanOrEqual(0);
    expect(f).toBeLessThanOrEqual(1);
    expect(row("outcome")).toBe("contained");
    expect(row("quality")).toBe("good");
    expect(line.terminated.reason).toBe("road_end");
  });

  it("G-C30-CHECKVECTOR — the full 16-id check vector, pinned verbatim (chain trio + hold_wide + wrong_strategy na; trail_brake_taper na — engine truth, see header)", () => {
    expect(line.checks).toEqual([
      { id: "late_apex", verdict: "pass" },
      { id: "out_in_out", verdict: "pass" },
      { id: "single_input", verdict: "pass" },
      { id: "quick_steer", verdict: "pass" },
      { id: "throttle_rule", verdict: "pass" },
      { id: "trail_brake_taper", verdict: "na" },
      { id: "traction_ceiling", verdict: "pass" },
      { id: "lean_ceiling", verdict: "pass" },
      { id: "exit_containment", verdict: "pass" },
      { id: "stop_within_sight", verdict: "pass" },
      { id: "hold_wide_for_sight", verdict: "na" },
      { id: "rideability", verdict: "pass" },
      { id: "link_continuity", verdict: "na" },
      { id: "chain_containment", verdict: "na" },
      { id: "chain_flow", verdict: "na" },
      { id: "wrong_strategy_for_corner", verdict: "na" }
    ]);
  });

  it("A-DANGER-DWELL (clean arm): C30's clean run records danger_dwell_s = 0.0 on every corner", () => {
    const corners = line.corners as readonly { danger_dwell_s: number }[];
    expect(corners.length).toBeGreaterThan(0);
    for (const c of corners) expect(c.danger_dwell_s).toBe(0);
  });
});

describe("C30 family + companions (categorical pins off the committed records; engine-truth seams in the header)", () => {
  it("C30-chop: run-wide class outcome, quality failing (pinned engine truth: 'wide' on the C30 road)", () => {
    const rec = committed("C30-chop");
    const chop = rec.lines.find((l) => l.line_id === "chop")!;
    expect(["wide", "runoff"]).toContain(chop.outcome);
    expect(chop.outcome).toBe("wide"); // the blessed engine-truth pin
    expect(chop.quality).toBe("failing");
  });

  it("C30-chop-sweep: all four slew rungs {10,20,40,80} blessed, each with a chop line", () => {
    for (const slew of [10, 20, 40, 80]) {
      const rec = committed(`C30-chop-sweep-${slew}`);
      expect(rec.lines.some((l) => l.line_id === "chop")).toBe(true);
    }
  });

  it("C30-stop: terminated stopped, outcome stopped, quality caution", () => {
    const rec = committed("C30-stop");
    const line = rec.lines[0]!;
    expect(line.terminated.reason).toBe("stopped");
    expect(line.outcome).toBe("stopped");
    expect(line.quality).toBe("caution");
  });

  it("C30-heldbrake / C30-deeplean: run-wide class, no crash (the clipped-widening regime's record-level face)", () => {
    for (const id of ["C30-heldbrake", "C30-deeplean"]) {
      const rec = committed(id);
      const line = rec.lines[0]!;
      expect(["wide", "runoff"]).toContain(line.outcome);
      expect(line.terminated.reason).not.toBe("crash");
    }
  });

  it("book90-ideal: solved line contained/good with turn_in, apex and roll_on events recorded", () => {
    const rec = committed("book90-ideal");
    const line = rec.lines[0]!;
    expect(line.outcome).toBe("contained");
    expect(line.quality).toBe("good");
    for (const kind of ["turn_in", "apex", "roll_on"]) {
      expect(line.events.some((e) => e.kind === kind), kind).toBe(true);
    }
  });

  it("G-CORR-RUNOFF: premature line runoff/off_road; G-CORR-WIDE (mirrored twin): runoff — the pinned engine-truth seam vs the design's 'wide'", () => {
    const runoff = committed("G-CORR-RUNOFF").lines.find((l) => l.line_id === "premature")!;
    expect(runoff.outcome).toBe("runoff");
    expect(runoff.terminated.reason).toBe("off_road");
    const wide = committed("G-CORR-WIDE").lines.find((l) => l.line_id === "premature")!;
    expect(wide.outcome).toBe("runoff"); // PENDING RATIFICATION (header)
  });

  it("G-MISJUDGE-DR: believed-clean base (best_failing), executed underread line runoff/off_road", () => {
    const rec = committed("G-MISJUDGE-DR");
    const base = rec.lines[0]!;
    const executed = rec.lines[1]!;
    expect(base.outcome).toBe("contained");
    expect(executed.outcome).toBe("runoff");
    expect(executed.terminated.reason).toBe("off_road");
  });
});

// ---------------------------------------------------------------------------
// C30-LR sample-level pin (design/09 §3.2): needs phi samples, so this one
// fixture re-runs its explicit wire plan directly (cheap — no solver).

describe("C30-LR (two-corner alternating-hand golden — sample-level pins)", () => {
  it("phi crosses zero exactly once between the corners (+ → 0 → −, monotone through the flip); release exists; hands infer R then L", { timeout: 120_000 }, () => {
    const entry = BLESS_ROSTER.find((e) => e.id === "C30-LR")!;
    if (entry.input.kind !== "run") throw new Error("C30-LR roster shape changed");
    const r = run(entry.input.input, { engine_semver: ENGINE_SEMVER, figure_id: "C30-LR" });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const line = r.value.lines.find((l) => !isLineRefusal(l)) as LineResult;
    const road = r.value.road;
    expect(road.corners.map((c) => c.hand)).toEqual(["R", "L"]);

    const c1 = road.corners[0]!;
    const c2 = road.corners[1]!;
    // between the corners: phi sign sequence + → (0) → − with exactly one crossing
    const between = line.trajectory.samples.filter((p) => p.s >= c1.s1 - 1 && p.s <= c2.s0 + 3);
    let crossings = 0;
    for (let i = 1; i < between.length; i++) {
      const a = between[i - 1]!.phi;
      const b = between[i]!.phi;
      if ((a > 0 && b < 0) || (a < 0 && b > 0)) crossings++;
    }
    expect(crossings).toBe(1);
    // handSign("R") = +1: the R-corner phase leans positive, the L negative
    const inC1 = line.trajectory.samples.filter((p) => p.s > c1.s_mid - 2 && p.s < c1.s_mid + 2);
    const inC2 = line.trajectory.samples.filter((p) => p.s > c2.s_mid - 2 && p.s < c2.s_mid + 2);
    expect(Math.min(...inC1.map((p) => p.phi))).toBeGreaterThan(0);
    expect(Math.max(...inC2.map((p) => p.phi))).toBeLessThan(0);
    // a release exists for the final commitment
    expect(line.trajectory.events.filter((e) => e.kind === "release").length).toBeGreaterThanOrEqual(1);
  });
});
