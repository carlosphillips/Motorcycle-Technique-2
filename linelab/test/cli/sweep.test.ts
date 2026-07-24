// test/cli/sweep.test.ts — the v0.2 `sweep` verb (design/08 §3 verb table,
// §4.3), spawned against the built CLI exactly as the other test/cli files do.
//
// What this file demonstrates as real usage:
//   - the shape of the answer: one JSON document, `kind: "sweep"`, with the
//     params/metrics/lines/cells/truncated members §4.3 pins.
//   - every root of the closed grammar addressed on a real base, each one
//     observably moving the thing it names (`A-SWEEP-ROOTS`'s substance).
//   - the per-root hold-fixed rule where it is semantic rather than economic:
//     a `plan.` sweep BYPASSES the solver, so every non-swept plan field is
//     byte-identical across cells.
//   - the typed refusal set: `sweep_root_unknown`, `sweep_field_not_numeric`,
//     `UNKNOWN_ID` on a nonexistent action/line/constraint, `BAD_RANGE` on a
//     non-positive step or an inverted range.
//   - D8, the reason a one-row sweep does not exist: a range that cannot vary
//     is INEFFECTUAL, never a silent single-cell table.
//   - a `NO_SOLUTION` cell is recorded as `outcome: "no_solution"`, never a
//     verb failure — and the table stays rectangular through it.

import { describe, it, expect, beforeAll } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  SWEEP_METRICS,
  SWEEP_MAX_CELLS,
  gridValues,
  gridCells,
  parseSweepPath,
  parseSweepRange
} from "../../src/cli/verbs/sweep.js";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "../..");
const mainJs = join(repoRoot, "dist/cli/main.js");

const BASE = ["--road", "preset book90", "--entry", "34", "--turn-in", "auto"] as const;

interface CliResult {
  readonly exit: number;
  readonly stdout: unknown;
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

type MetricRow = Record<string, string | number | boolean | null>;
interface SweepDoc {
  readonly kind: "sweep";
  readonly params: readonly { readonly path: string; readonly range: { from: number; to: number; step: number } }[];
  readonly metrics: readonly string[];
  readonly lines: readonly string[];
  readonly cells: readonly { readonly at: readonly number[]; readonly per_line: Record<string, MetricRow> }[];
  readonly truncated: boolean;
}

function sweep(args: readonly string[]): { exit: number; doc: SweepDoc } {
  const r = cli(["sweep", ...BASE, ...args]);
  const body = r.stdout as { ok: boolean; value?: SweepDoc; error?: unknown };
  expect(body.ok, `sweep failed: ${JSON.stringify(body.error)}`).toBe(true);
  return { exit: r.exit, doc: body.value as SweepDoc };
}

function errorOf(args: readonly string[]): { exit: number; code: string; reason: string; at: string } {
  const r = cli(["sweep", ...BASE, ...args]);
  const body = r.stdout as { ok: boolean; error: { code: string; at: string; detail?: { reason?: string } } };
  expect(body.ok, `expected a refusal from: sweep ${args.join(" ")}`).toBe(false);
  return { exit: r.exit, code: body.error.code, reason: body.error.detail?.reason ?? "", at: body.error.at };
}

let dir: string;

beforeAll(() => {
  execFileSync("npm", ["run", "build"], { cwd: repoRoot, stdio: "ignore" });
  dir = mkdtempSync(join(tmpdir(), "linelab-sweep-"));
}, 300_000);

// ---------------------------------------------------------------------------

describe("the sweep table's shape (design/08 §4.3)", () => {
  it("emits one JSON document with the pinned members and the default column set", () => {
    const { exit, doc } = sweep(["--param", "scenario.entry_kmh", "--range", "30:34:2"]);
    expect(exit).toBe(0);
    expect(doc.kind).toBe("sweep");
    expect(doc.params).toEqual([{ path: "scenario.entry_kmh", range: { from: 30, to: 34, step: 2 } }]);
    // "Default `outcome,apex_pct,grip_min`."
    expect(doc.metrics).toEqual(["outcome", "apex_pct", "grip_min"]);
    expect(doc.lines).toEqual(["solved"]);
    expect(doc.cells.map((c) => c.at)).toEqual([[30], [32], [34]]);
    expect(doc.truncated).toBe(false);
    for (const cell of doc.cells) {
      expect(Object.keys(cell.per_line)).toEqual(["solved"]);
      expect(Object.keys(cell.per_line["solved"]!).sort()).toEqual(["apex_pct", "grip_min", "outcome"]);
    }
  });

  it("`--metric` selects from the closed vocabulary; an unknown name refuses typed", () => {
    const { doc } = sweep(["--param", "scenario.entry_kmh", "--range", "30:34:2", "--metric", "outcome,end_s,end_reason,apex_count"]);
    expect(doc.metrics).toEqual(["outcome", "end_s", "end_reason", "apex_count"]);
    const row = doc.cells[0]!.per_line["solved"]!;
    expect(typeof row["end_s"]).toBe("number");
    expect(typeof row["end_reason"]).toBe("string");
    expect(row["apex_count"]).toBe(1);

    const e = errorOf(["--param", "scenario.entry_kmh", "--range", "30:34:2", "--metric", "lean_max"]);
    expect(e.code).toBe("SCHEMA");
    expect(e.reason).toBe("sweep_metric_unknown");
  });

  it("a 2-param grid is emitted row-major with param-1 outer (ARCHITECTURE §10 pin #22)", () => {
    const { doc } = sweep([
      "--param", "scenario.entry_kmh", "--range", "30:32:2",
      "--param2", "config.mu", "--range2", "0.9:1.0:0.1",
      "--metric", "outcome"
    ]);
    expect(doc.cells.map((c) => c.at)).toEqual([[30, 0.9], [30, 1], [32, 0.9], [32, 1]]);
  });

  it("`--format tsv` writes one file at --out and leaves stdout the JSON document (pin #23)", () => {
    const out = join(dir, "sweep.tsv");
    const { doc } = sweep([
      "--param", "scenario.entry_kmh", "--range", "30:32:2",
      "--param2", "config.mu", "--range2", "0.9:1.0:0.1",
      "--metric", "outcome,grip_min",
      "--format", "tsv", "--out", out
    ]);
    expect(doc.cells).toHaveLength(4); // stdout is still the table
    const tsv = readFileSync(out, "utf8").trimEnd().split("\n");
    expect(tsv[0]).toBe("scenario.entry_kmh\tconfig.mu\tsolved.outcome\tsolved.grip_min");
    expect(tsv).toHaveLength(5);
    expect(tsv[1]!.split("\t")[0]).toBe("30");

    const e = errorOf(["--param", "scenario.entry_kmh", "--range", "30:34:2", "--format", "tsv"]);
    expect(e.code).toBe("SCHEMA");
    expect(e.reason).toBe("sweep_tsv_requires_out");
  });
});

// ---------------------------------------------------------------------------

describe("A-SWEEP-ROOTS — every root of the closed set moves what it names", () => {
  it("scenario.entry_kmh recomputes the whole pipeline per cell", () => {
    const { doc } = sweep(["--param", "scenario.entry_kmh", "--range", "28:34:3", "--metric", "outcome,grip_min"]);
    const grips = doc.cells.map((c) => c.per_line["solved"]!["grip_min"] as number);
    expect(new Set(grips).size).toBe(grips.length);
    // faster entry, less grip margin — monotone, the physics saying so
    expect(grips[0]!).toBeGreaterThan(grips[grips.length - 1]!);
  });

  it("config.mu recomputes the whole pipeline per cell", () => {
    const { doc } = sweep(["--param", "config.mu", "--range", "0.8:1.0:0.1", "--metric", "grip_min"]);
    const grips = doc.cells.map((c) => c.per_line["solved"]!["grip_min"] as number);
    expect(new Set(grips).size).toBe(3);
    expect(grips[0]!).toBeLessThan(grips[2]!);
  });

  it("ride.turn_in_s re-solves the addressed line per cell", () => {
    const { doc } = sweep(["--param", "ride.turn_in_s", "--range", "8:12:2", "--metric", "outcome,apex_pct"]);
    const pcts = doc.cells.map((c) => c.per_line["solved"]!["apex_pct"] as number);
    expect(new Set(pcts).size).toBe(3);
    // turning in later moves the apex later round the corner
    expect(pcts[0]!).toBeLessThan(pcts[2]!);
    // and far enough out, the line stops being contained
    expect(doc.cells.map((c) => c.per_line["solved"]!["outcome"])).toContain("wide");
  });

  it("plan.<actionId>.<field> BYPASSES the solver — every other plan field is frozen across cells", () => {
    const { doc } = sweep(["--param", "plan.ro_c1.accel", "--range", "0:3:1", "--metric", "outcome,exit_f,lean_max_deg"]);
    const exits = doc.cells.map((c) => c.per_line["solved"]!["exit_f"] as number);
    expect(new Set(exits).size).toBe(4);
    // the turn-in the solver chose is PINNED: the peak lean is a plan property
    // here, not a re-solved one, so it cannot move
    const leans = doc.cells.map((c) => c.per_line["solved"]!["lean_max_deg"]);
    expect(new Set(leans).size).toBe(1);
    // more roll-on, wider exit, and eventually off the corridor
    expect(exits[0]!).toBeLessThan(exits[3]!);
    expect(doc.cells[3]!.per_line["solved"]!["outcome"]).toBe("runoff");
  });

  it("mistake.<lineId>.<param> recompiles the mistake line while the base line is held solved once", () => {
    const { doc } = sweep([
      "--mistake", "premature",
      "--param", "mistake.premature.early_by_m", "--range", "2:6:2",
      "--metric", "outcome,apex_pct"
    ]);
    expect(doc.lines).toEqual(["solved", "premature"]);
    const base = doc.cells.map((c) => JSON.stringify(c.per_line["solved"]));
    expect(new Set(base).size).toBe(1); // "the base line, solved once"
    const apexes = doc.cells.map((c) => c.per_line["premature"]!["apex_pct"] as number);
    expect(new Set(apexes).size).toBe(3);
    expect(apexes[0]!).toBeGreaterThan(apexes[2]!); // earlier turn-in, earlier apex
  });

  it("constraint.<id>.value re-solves per cell, and a refused cell is a ROW, not a verb failure", () => {
    const { exit, doc } = sweep([
      "--constraint", "f>=0.2@entry:c1..exit:c1",
      "--param", "constraint.cli_c2.value", "--range", "0.2:0.5:0.15",
      "--metric", "outcome,apex_f"
    ]);
    expect(exit).toBe(0); // "never a verb failure"
    const outcomes = doc.cells.map((c) => c.per_line["solved"]!["outcome"]);
    expect(outcomes[0]).toBe("contained");
    expect(outcomes.slice(1)).toEqual(["no_solution", "no_solution"]);
    // the table stays rectangular through the refusals
    for (const cell of doc.cells) expect(Object.keys(cell.per_line)).toEqual(["solved"]);
    expect(doc.cells[1]!.per_line["solved"]!["apex_f"]).toBeNull();
  });

  it("believe.<param> re-solves the believed world per cell and executes it on the actual road", () => {
    const { doc } = sweep([
      "--mistake", "underread:r_believed=20",
      "--param", "believe.r_believed", "--range", "14:20:3",
      "--metric", "outcome,s_divergence_m,apex_f"
    ]);
    expect(doc.lines).toEqual(["solved", "underread"]);
    for (const cell of doc.cells) {
      const row = cell.per_line["underread"]!;
      // the believed world is the misjudged one — divergence is recorded, and
      // the line is executed on the ACTUAL road, so it does not stay clean
      expect(row["s_divergence_m"]).not.toBeNull();
      expect(row["outcome"]).not.toBe("contained");
    }
    const apexes = doc.cells.map((c) => c.per_line["underread"]!["apex_f"]);
    expect(new Set(apexes.map((a) => JSON.stringify(a))).size).toBeGreaterThan(1);
  });
});

// ---------------------------------------------------------------------------

describe("the sweep's typed refusals (design/08 §4.3)", () => {
  it("an unknown root is SCHEMA/sweep_root_unknown, exit 2, naming the closed set", () => {
    const e = errorOf(["--param", "bogus.field", "--range", "1:3:1"]);
    expect(e.exit).toBe(2);
    expect(e.code).toBe("SCHEMA");
    expect(e.reason).toBe("sweep_root_unknown");
  });

  it("a non-sweepable field is SCHEMA/sweep_field_not_numeric", () => {
    for (const path of ["ride.bogus", "scenario.mu", "config.entry_kmh", "constraint.c1.bound", "believe.radius"]) {
      const e = errorOf(["--param", path, "--range", "1:3:1"]);
      expect(e.code, path).toBe("SCHEMA");
      expect(e.reason, path).toBe("sweep_field_not_numeric");
    }
  });

  it("a nonexistent action / line / constraint id is UNKNOWN_ID", () => {
    for (const path of ["plan.nope.decel", "mistake.nope.early_by_m", "constraint.nope.value"]) {
      const e = errorOf(["--param", path, "--range", "1:3:1"]);
      expect(e.code, path).toBe("UNKNOWN_ID");
      expect(e.exit, path).toBe(2);
    }
  });

  it("a non-positive step or an inverted range is BAD_RANGE", () => {
    const zero = errorOf(["--param", "scenario.entry_kmh", "--range", "30:34:0"]);
    expect(zero.code).toBe("BAD_RANGE");
    expect(zero.reason).toBe("sweep_step_nonpositive");
    const inverted = errorOf(["--param", "scenario.entry_kmh", "--range", "34:30:1"]);
    expect(inverted.code).toBe("BAD_RANGE");
    expect(inverted.reason).toBe("sweep_range_inverted");
  });

  it("a `plan.` root cannot be crossed with a solver-layer root — that grid has no semantics", () => {
    const e = errorOf([
      "--param", "plan.ro_c1.accel", "--range", "0:2:1",
      "--param2", "scenario.entry_kmh", "--range2", "30:32:2"
    ]);
    expect(e.code).toBe("SCHEMA");
    expect(e.reason).toBe("sweep_plan_root_not_crossable");
  });
});

// ---------------------------------------------------------------------------

describe("D8 — schema-valid implies effectual: a sweep that varies nothing is refused", () => {
  it("a single-cell range is INEFFECTUAL, naming the dead range — never a one-row table", () => {
    const e = errorOf(["--param", "scenario.entry_kmh", "--range", "30:30:1"]);
    expect(e.code).toBe("INEFFECTUAL");
    expect(e.at).toBe("--range");
    expect(e.reason).toBe("sweep_range_ineffectual");
  });

  it("a step wider than the span is the same refusal — the grid, not the spelling, decides", () => {
    const e = errorOf(["--param", "scenario.entry_kmh", "--range", "30:34:9"]);
    expect(e.code).toBe("INEFFECTUAL");
    expect(e.reason).toBe("sweep_range_ineffectual");
  });

  it("a second range with no second param is INEFFECTUAL — a dead flag, not an ignored one", () => {
    const e = errorOf(["--param", "scenario.entry_kmh", "--range", "30:34:2", "--range2", "1:2:1"]);
    expect(e.code).toBe("INEFFECTUAL");
    expect(e.reason).toBe("sweep_range2_without_param2");
  });

  it("a second param with no second range is a SCHEMA refusal, not a silent 1-D sweep", () => {
    const e = errorOf(["--param", "scenario.entry_kmh", "--range", "30:34:2", "--param2", "config.mu"]);
    expect(e.code).toBe("SCHEMA");
    expect(e.reason).toBe("sweep_range_missing");
  });
});

// ---------------------------------------------------------------------------
// The grid arithmetic is pure, so the 2500-cell cap is testable without
// spending 2500 engine runs on it.

describe("the grid cap (sweep_max_cells = 2500, design/08 §4.3)", () => {
  it("keeps the first sweep_max_cells cells in row-major order and flags truncated", () => {
    const v1 = gridValues({ from: 0, to: 59, step: 1 }); // 60
    const v2 = gridValues({ from: 0, to: 59, step: 1 }); // 60 → 3600 > 2500
    const grid = gridCells(v1, v2);
    expect(v1).toHaveLength(60);
    expect(grid.truncated).toBe(true);
    expect(grid.at).toHaveLength(SWEEP_MAX_CELLS);
    expect(grid.at[0]).toEqual([0, 0]);
    expect(grid.at[1]).toEqual([0, 1]); // param-1 outer
    expect(grid.at[60]).toEqual([1, 0]);
    expect(grid.at[SWEEP_MAX_CELLS - 1]).toEqual([41, 39]);
  });

  it("a grid at the cap is not truncated", () => {
    const grid = gridCells(gridValues({ from: 1, to: 2500, step: 1 }), undefined);
    expect(grid.at).toHaveLength(SWEEP_MAX_CELLS);
    expect(grid.truncated).toBe(false);
  });
});

// ---------------------------------------------------------------------------

describe("the sweep-path grammar is closed and total (design/08 §4.3, D34)", () => {
  it("parses every production of the grammar", () => {
    expect(parseSweepPath("plan.b1.decel", "at")).toEqual({ ok: true, value: { root: "plan", actionId: "b1", field: "decel" } });
    expect(parseSweepPath("scenario.start_f", "at")).toEqual({ ok: true, value: { root: "scenario", field: "start_f" } });
    expect(parseSweepPath("config.mu", "at")).toEqual({ ok: true, value: { root: "config", field: "mu" } });
    expect(parseSweepPath("ride.vis_margin", "at")).toEqual({ ok: true, value: { root: "ride", field: "vis_margin" } });
    expect(parseSweepPath("mistake.bad.offset_m", "at")).toEqual({ ok: true, value: { root: "mistake", lineId: "bad", param: "offset_m" } });
    expect(parseSweepPath("constraint.k1.value", "at")).toEqual({ ok: true, value: { root: "constraint", constraintId: "k1" } });
    expect(parseSweepPath("believe.sweep_believed_deg", "at")).toEqual({ ok: true, value: { root: "believe", field: "sweep_believed_deg" } });
  });

  it("refuses every non-production without throwing", () => {
    for (const bad of ["", ".", "plan", "plan.b1", "plan.b1.decel.extra", "mistake.bad", "constraint.k1.bound", "scenario"]) {
      const r = parseSweepPath(bad, "at");
      expect(r.ok, `"${bad}" parsed`).toBe(false);
    }
  });

  it("the metric vocabulary is exactly design/08 §4.3's closed list, in the doc's order", () => {
    expect([...SWEEP_METRICS]).toEqual([
      "outcome", "apex_pct", "apex_f", "v_apex_kmh", "lean_max_deg", "grip_min",
      "exit_f", "sight_margin_min_m", "end_s", "end_reason", "acceptance_met",
      "apex_count", "s_divergence_m"
    ]);
  });

  it("a malformed range refuses SCHEMA rather than producing NaN cells", () => {
    expect(parseSweepRange("1:2", "at").ok).toBe(false);
    expect(parseSweepRange("a:b:c", "at").ok).toBe(false);
    expect(parseSweepRange("1:3:1", "at")).toEqual({ ok: true, value: { from: 1, to: 3, step: 1 } });
  });
});
