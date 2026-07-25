// test/cli/compare.test.ts — the `compare` verb (design/08 §3.5, §6(c);
// design/07 §4). The headline gate is C-COMPARE (design/09 L2005): "in compare
// mode, each line's ghost state equals its own `stateAt`; lines never share or
// leak state." The verb's station-aligned metric diff is exactly that — one
// `stateAt(THAT line, {s|t})` per (line, lock-position) — so the gate is
// verifiable by recomputing the inputs INDEPENDENTLY and asserting every metric
// cell equals this test's own `stateAt` call on the matching line (and equals
// NOTHING from the other line: no leakage).
//
// The verb is a pure consumer of the one engine (C-ONE-CORE): it recomputes its
// inputs through `run()` and reads `stateAt`; it steps no physics of its own.
// These tests call the pure `compareVerb` directly (fast, and lets the C-COMPARE
// assertion reach `stateAt` on the same recomputed lines), plus one end-to-end
// leg through the built CLI (`dist/cli/main.js`) for the IO shell.

import { describe, it, expect, beforeAll } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { compareVerb } from "../../src/cli/verbs/compare.js";
import { run, ENGINE_SEMVER } from "../../src/solve/run.js";
import { solveVerb } from "../../src/cli/verbs/solve.js";
import { roadWireSpec } from "../../src/cli/verbs/shared.js";
import { stateAt, type StateAtInput } from "../../src/core/stateAt.js";
import { sightTrendAt } from "../../src/sight/analyze.js";
import { LINELAB_SPEC, type FigureResult, type LineResult } from "../../src/solve/types.js";
import type { InstantState, RoadModel } from "../../src/core/types.js";
import {
  DEFERRED_TABLE,
  DEFERRED_VERBS,
  SHIPPED_VERBS,
  deferredFor,
  isShippedVerb
} from "../../src/cli/deferred.js";
import { VERB_SCOPED_FLAGS, ineffectualFlagFor, parseZeroFileFlags, type ParsedInvocation } from "../../src/cli/args.js";

// ---------------------------------------------------------------------------
// Helpers — build real envelopes in-process, and mirror compare's display
// rounding + metric extraction so the C-COMPARE assertion is byte-exact.

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "../..");
const mainJs = join(repoRoot, "dist/cli/main.js");

function r2(x: number): number {
  return Number(x.toFixed(2));
}
function r3(x: number): number {
  return Number(x.toFixed(3));
}
/** the same shape compare emits per member per lock position (its `metricsOf`). */
function metricsOf(st: InstantState): Record<string, number> {
  return {
    s: r2(st.sample.s),
    t: r2(st.sample.t),
    v_kmh: r2(st.derived.v_kmh),
    phi_deg: r2(st.sample.phi),
    grip: r3(st.sample.grip),
    sight_ride_m: r2(st.sample.sight_ride_m),
    ssd_m: r2(st.sample.ssd_m),
    sight_margin_m: r2(st.derived.sight_margin_m),
    d: r3(st.sample.d),
    f: r3(st.sample.f)
  };
}

/** an envelope produced by the `solve` verb (the `--out` file recipe (c) writes). */
function solveEnvelope(args: readonly string[]): string {
  const out = solveVerb({ loadedText: undefined, argv: args });
  const doc = out.stdout as { ok: boolean; value?: FigureResult };
  if (!doc.ok) throw new Error(`solve failed: ${JSON.stringify(out.stdout)}`);
  return JSON.stringify(doc.value);
}

/**
 * Reproduce compare's OWN recompute of one envelope line INDEPENDENTLY (the same
 * A-RESOLVED-RERUN move `compare` makes: re-run the line's `resolved_scenario`),
 * so a `stateAt` here is over the exact recomputed line compare read. If compare
 * ever shared or leaked state, these values would diverge — the C-COMPARE gate.
 */
function recompute(envelopeText: string, lineId: string): { input: StateAtInput; line: LineResult } {
  const env = JSON.parse(envelopeText) as { lines: LineResult[] };
  const line = env.lines.find((l) => l.line_id === lineId);
  if (line === undefined) throw new Error(`no line ${lineId}`);
  const rs = line.resolved_scenario;
  const roadSpec = roadWireSpec(rs.road);
  if (!roadSpec.ok) throw new Error("roadWireSpec failed");
  const wire = { ...rs, spec: LINELAB_SPEC, id: line.line_id, road: roadSpec.value };
  const fr = run(wire, { engine_semver: ENGINE_SEMVER });
  if (!fr.ok) throw new Error(`recompute run failed: ${JSON.stringify(fr.error)}`);
  const rl = fr.value.lines[0] as LineResult;
  const road: RoadModel = fr.value.road;
  return {
    input: { trajectory: rl.trajectory, road, plan: rl.resolved_scenario.rider.plan, sightTrendAt },
    line: rl
  };
}

function compareValue(texts: readonly string[], argv: readonly string[] = []): { exit: number; doc: { ok: boolean; value?: any; error?: any } } {
  const outcome = compareVerb({ loadedTexts: texts, argv, engineSemver: ENGINE_SEMVER });
  return { exit: outcome.exit, doc: outcome.stdout as { ok: boolean; value?: any; error?: any } };
}

// Two book90 solves at different entry speeds ride the SAME road with the same
// line_id ("solved"), so they pair — the canonical two-line compare.
let envFast: string; // book90 @ 34
let envSlow: string; // book90 @ 30
let envDslA: string; // a DSL road, no occluder
let envDslB: string; // the SAME DSL road, with a hedge (world_delta)

beforeAll(() => {
  envFast = solveEnvelope(["--road", "preset book90", "--entry", "34", "--turn-in", "auto"]);
  envSlow = solveEnvelope(["--road", "preset book90", "--entry", "30", "--turn-in", "auto"]);
  const DSL = "lane 3.5 | S 20 | R 25 ^90 | S 25";
  envDslA = solveEnvelope(["--road", DSL, "--entry", "45", "--turn-in", "auto"]);
  envDslB = solveEnvelope(["--road", DSL, "--entry", "45", "--turn-in", "auto", "--occluder", "hedge inside entry:c1 -10x15 margin=1.0"]);
}, 120_000);

// ---------------------------------------------------------------------------
// C-COMPARE — the gate (design/09 L2005)

describe("C-COMPARE — each line's state equals its OWN stateAt; no cross-line leakage", () => {
  it("every station-locked metric cell equals this line's own stateAt (and NOTHING from the other line)", () => {
    const { doc } = compareValue([envFast, envSlow], ["--lock", "station"]);
    expect(doc.ok, JSON.stringify(doc.error)).toBe(true);
    const pair = doc.value.pairs.find((p: any) => p.line_id === "solved");
    expect(pair, "the two 'solved' lines must pair").toBeDefined();

    // recompute BOTH inputs independently (compare's own A-RESOLVED-RERUN move)
    const a = recompute(envFast, "solved");
    const b = recompute(envSlow, "solved");
    const byAt = new Map<number, Record<string, Record<string, number>>>(pair.samples.map((sm: any) => [sm.at, sm.per_input]));

    let checkedShared = 0;
    let leakageGuardHit = false;
    // the station grid is line-A's own recorded stations (compare's reference),
    // so query stateAt at those EXACT raw stations and match the payload cell.
    for (const p of a.line.trajectory.samples) {
      const cell = byAt.get(r2(p.s));
      if (cell === undefined) continue; // outside the shared span
      const stA = stateAt(a.input, { s: p.s });
      expect(stA.ok).toBe(true);
      if (!stA.ok) continue;
      // C-COMPARE (input 0): the cell IS this line's own stateAt, field for field
      expect(cell["0"]).toEqual(metricsOf(stA.value));

      const stB = stateAt(b.input, { s: p.s });
      if (stB.ok) {
        // C-COMPARE (input 1): the OTHER cell is the OTHER line's own stateAt
        expect(cell["1"]).toEqual(metricsOf(stB.value));
        checkedShared++;
        // no leakage: where the two lines genuinely differ (different entry
        // speeds), the two cells are NOT equal — neither line wears the other's
        // state.
        if (metricsOf(stA.value)["v_kmh"] !== metricsOf(stB.value)["v_kmh"]) {
          expect(cell["0"]).not.toEqual(cell["1"]);
          leakageGuardHit = true;
        }
      }
    }
    expect(checkedShared, "shared stations were actually compared").toBeGreaterThan(5);
    expect(leakageGuardHit, "the no-leakage guard fired on a genuinely differing station").toBe(true);
  }, 60_000);

  it("time lock aligns by elapsed t (each cell is stateAt({t}) on its own line) while span stays station-based", () => {
    const { doc } = compareValue([envFast, envSlow], ["--lock", "time"]);
    expect(doc.ok).toBe(true);
    const pair = doc.value.pairs.find((p: any) => p.line_id === "solved");
    // span is the STATION intersection regardless of lock (§3.5)
    expect(pair.span.from_s).toBe(0);
    expect(pair.span.to_s).toBeGreaterThan(10);

    const a = recompute(envFast, "solved");
    // under time lock, the grid coordinate `at` is a TIME; stateAt({t}) on line A
    // reproduces the cell exactly (its own state, no leakage)
    let checked = 0;
    const byAt = new Map<number, Record<string, Record<string, number>>>(pair.samples.map((sm: any) => [sm.at, sm.per_input]));
    for (const p of a.line.trajectory.samples) {
      const cell = byAt.get(r2(p.t));
      if (cell === undefined) continue;
      const st = stateAt(a.input, { t: p.t });
      if (!st.ok) continue;
      expect(cell["0"]).toEqual(metricsOf(st.value));
      checked++;
    }
    expect(checked).toBeGreaterThan(5);
  }, 60_000);
});

// ---------------------------------------------------------------------------
// The road contract + world_delta + pairing (§3.5)

describe("compare output contract (design/08 §3.5)", () => {
  it("same road → one shared road_hash, lines pair by line_id, world_delta empty", () => {
    const { exit, doc } = compareValue([envFast, envSlow]);
    expect(exit).toBe(0);
    expect(doc.ok).toBe(true);
    expect(doc.value.kind).toBe("compare");
    expect(doc.value.lock).toBe("station"); // the default (07 §4.1)
    expect(typeof doc.value.road_hash).toBe("string");
    expect(doc.value.pairs.map((p: any) => p.line_id)).toEqual(["solved"]);
    expect(doc.value.unpaired).toEqual({ a: [], b: [] });
    expect(doc.value.world_delta.differs).toBe(false);
    // per-line verdict deltas are present, one per input, in input order
    const v = doc.value.pairs[0].verdict;
    expect(v.map((x: any) => x.input)).toEqual([0, 1]);
    expect(v[0].outcome).toBe("contained");
  }, 60_000);

  it("world_delta discloses an occluder present in one input and not the other (same road, different world)", () => {
    const { doc } = compareValue([envDslA, envDslB]);
    expect(doc.ok, JSON.stringify(doc.error)).toBe(true);
    expect(doc.value.world_delta.differs).toBe(true);
    const occ = doc.value.world_delta.occluders;
    expect(occ.length).toBe(1);
    expect(occ[0].present_in).toEqual([1]); // the hedge rides input B only
    expect(occ[0].entry.kind).toBe("hedge");
    // the lines still pair and diff (occluders/hazards differing is defined
    // semantics, never an error, §3.5)
    expect(doc.value.pairs.length).toBe(1);
  }, 60_000);
});

// ---------------------------------------------------------------------------
// Typed refusals (D8, §3.5): "a compare with nothing to compare, or mismatched
// roads, must be a typed refusal, not a degenerate one-line output."

describe("compare typed refusals (D8)", () => {
  it("fewer than two inputs → SCHEMA/nothing_to_compare (never a degenerate one-line output)", () => {
    const one = compareValue([envFast]);
    expect(one.doc.ok).toBe(false);
    expect(one.doc.error.code).toBe("SCHEMA");
    expect(one.doc.error.detail.reason).toBe("nothing_to_compare");
    const none = compareValue([]);
    expect(none.doc.error.detail.reason).toBe("nothing_to_compare");
  });

  it("roads that resolve differently → SCHEMA/road_mismatch, naming both hashes and the first differing segment", () => {
    const { doc } = compareValue([envFast, envDslA]); // book90 ≠ the DSL road
    expect(doc.ok).toBe(false);
    expect(doc.error.code).toBe("SCHEMA"); // the shared road is the input CONTRACT, not a bad number
    expect(doc.error.detail.reason).toBe("road_mismatch");
    expect(doc.error.detail.road_hash_a).not.toBe(doc.error.detail.road_hash_b);
    expect(typeof doc.error.detail.first_differing_segment).toBe("number");
  }, 60_000);

  it("no line_id shared by two inputs → SCHEMA/no_paired_lines (unpaired both-sided)", () => {
    // rename input B's line so nothing pairs
    const env = JSON.parse(envSlow) as { lines: { line_id: string }[] };
    env.lines[0]!.line_id = "renamed";
    const { doc } = compareValue([envFast, JSON.stringify(env)]);
    expect(doc.ok).toBe(false);
    expect(doc.error.detail.reason).toBe("no_paired_lines");
    expect(doc.error.detail.unpaired).toEqual({ a: ["solved"], b: ["renamed"] });
  }, 60_000);
});

// ---------------------------------------------------------------------------
// The `--lock` closed set (design/07 §3.7 / design/08 §3.5)

describe("--lock closed set + verb scoping", () => {
  it("--lock accepts only station|time, defaulting to station", () => {
    expect(parseZeroFileFlags(["--lock", "station"]).ok).toBe(true);
    expect(parseZeroFileFlags(["--lock", "time"]).ok).toBe(true);
    const bad = parseZeroFileFlags(["--lock", "corner"]);
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.error.detail?.["reason"]).toBe("lock_unknown");
  });

  it("--lock is compare syntax: it BITES on compare and is INEFFECTUAL elsewhere (D8, never accepted-and-ignored)", () => {
    const row = VERB_SCOPED_FLAGS.find((r) => r.flag === "--lock");
    expect(row?.verbs).toEqual(["compare"]);
    const parsed = { ...(parseZeroFileFlags([]) as { value: ParsedInvocation }).value, lock: "station" } as ParsedInvocation;
    expect(ineffectualFlagFor("compare", parsed)).toBeNull();
    const inert = ineffectualFlagFor("run", parsed);
    expect(inert?.code).toBe("INEFFECTUAL");
    expect(inert?.at).toBe("--lock");
    expect(inert?.detail?.["effectual_on"]).toEqual(["compare"]);
  });
});

// ---------------------------------------------------------------------------
// Un-defer confirmation (the task's deliverable: compare left the deferred table)

describe("compare is shipped, not deferred (ARCHITECTURE §6.4)", () => {
  it("compare is a SHIPPED verb, absent from every deferred surface", () => {
    expect(isShippedVerb("compare")).toBe(true);
    expect((SHIPPED_VERBS as readonly string[]).includes("compare")).toBe(true);
    expect("compare" in DEFERRED_VERBS).toBe(false);
    expect(deferredFor("compare")).toBeUndefined();
    // v0.3 immersion is fully landed: the whole `immersion (v0.3)` row is
    // RETIRED — `compare` (verb), `pov` (render target) and `--look` (its
    // ViewSpec flag) have ALL shipped, so nothing defers to it anymore.
    const immersion = DEFERRED_TABLE.find((r) => r.deferred === "immersion (v0.3)");
    expect(immersion).toBeUndefined();
    expect(deferredFor("pov")).toBeUndefined();
    expect(deferredFor("--look")).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// End-to-end through the built CLI (the IO shell + `--out` overlay)

describe("compare end-to-end (dist/cli/main.js)", () => {
  interface CliResult {
    readonly exit: number;
    readonly stdout: any;
  }
  function cli(args: readonly string[]): CliResult {
    try {
      const out = execFileSync("node", [mainJs, ...args], { cwd: repoRoot, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
      return { exit: 0, stdout: JSON.parse(out) };
    } catch (e) {
      const err = e as { status: number; stdout: string };
      return { exit: err.status, stdout: JSON.parse(err.stdout) };
    }
  }

  let dir: string;
  let aPath: string;
  let bPath: string;
  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), "linelab-compare-"));
    aPath = join(dir, "a.json");
    bPath = join(dir, "b.json");
    writeFileSync(aPath, envFast, "utf8");
    writeFileSync(bPath, envSlow, "utf8");
  });

  it("`compare a.json b.json --lock station --out dir` exits 0 and writes an overlay", () => {
    const r = cli(["compare", aPath, bPath, "--lock", "station", "--out", dir]);
    expect(r.exit).toBe(0);
    expect(r.stdout.ok).toBe(true);
    expect(r.stdout.value.kind).toBe("compare");
    expect(r.stdout.value.lock).toBe("station");
    expect(r.stdout.value.overlay).toBe(join(dir, "compare.svg"));
    expect(r.stdout.value.pairs[0].line_id).toBe("solved");
  }, 60_000);

  it("a degenerate compare (one input) is a typed refusal at exit 2", () => {
    const r = cli(["compare", aPath]);
    expect(r.exit).toBe(2);
    expect(r.stdout.error.code).toBe("SCHEMA");
    expect(r.stdout.error.detail.reason).toBe("nothing_to_compare");
  });
});
