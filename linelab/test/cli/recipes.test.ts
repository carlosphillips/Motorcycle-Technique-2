// test/cli/recipes.test.ts — WP-15 gate: the agent recipes of design/08 §6,
// extracted VERBATIM and executed against the built CLI (`npm run build`
// first; this file spawns `dist/cli/main.js`).
//
// A-RECIPE-A/B/E/F are this package's mandated gates; D/I/J are authored as
// available (their verbs — `run`/`solve` — ship in v0.1).
//
// RATIFICATION NOTE (recorded here AND in this package's returned
// `ratification_items`): recipes (a), (b), and (f) all compose the SAME road
// (`lane 3.5 | S 20 | R 25 ^90 | S 25`) at 55 km/h. Verified directly against
// the frozen solve/ library (bypassing the CLI entirely — `chainedSolve`/
// `solve` called with identical parameters) this exact geometry+speed
// combination returns `NO_SOLUTION/empty_band` on the CURRENT tuned engine —
// confirmed independently by the already-shipped fixture
// `F-CONSTRAINT-HARD` (`test/property/solver-core.test.ts`), whose own name
// documents that `R 25 ^90` at 55 km/h is a deliberately HARD/refusing
// case for the un-constrained clean bar. The same road solves cleanly for
// entry speeds 40-50 km/h. This is a genuine mismatch between design/08 §6's
// worked narrative (written against an earlier tuning) and the frozen v0.1
// physics tuning (solve/, owned by WP-04/WP-10/WP-11, DONE and out of this
// package's file ownership) — NOT a CLI composition bug (recipe (d), which
// uses different geometry, solves clean; recipe (i) at book90/34 solves
// clean; the CLI's own zero-file composition is exercised identically in
// both). Per ARCHITECTURE's conflict rule ("implement invariant-first...
// return it under ratification_items"), these tests assert the engine's
// ACTUAL reachable behavior for the VERBATIM commands, and recipe (b)'s
// render half is additionally exercised on a solvable substitute so the
// `render` verb itself still gets real coverage.
//
// Recipe (j) inherits an ALREADY-RATIFIED WP-11 finding, visible in the
// existing frozen suite (`test/property/solver-ext.test.ts`, "A-DOUBLEAPEX
// SEAM (pinned; ratification)"): `bookDoubleApex` itself refuses
// `no_two_touch_line` under the frozen release law. This is not a new
// finding — the recipe is tested against the accept=best_failing arm the
// design's own text names as the fallback path.

import { describe, it, expect, beforeAll } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "../.."); // linelab/
const mainJs = join(repoRoot, "dist/cli/main.js");
const figuresDir = resolve(repoRoot, "../figures");

interface CliResult {
  readonly exit: number;
  readonly stdout: unknown;
}

function cli(args: readonly string[], cwd = repoRoot): CliResult {
  try {
    const out = execFileSync("node", [mainJs, ...args], { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    return { exit: 0, stdout: JSON.parse(out) };
  } catch (e) {
    const err = e as { status: number; stdout: string };
    return { exit: err.status, stdout: JSON.parse(err.stdout) };
  }
}

beforeAll(() => {
  // dist/ is built once by test/globalSetup.ts before the worker pool starts;
  // this only asserts that build produced the CLI binary this file spawns.
  if (!existsSync(mainJs)) throw new Error(`test/globalSetup.ts did not produce ${mainJs}`);
}, 120_000);

// ---------------------------------------------------------------------------
// (a) Ideal line on a small road — VERBATIM command from design/08 §6.
//   linelab run --road "lane 3.5 | S 20 | R 25 ^90 | S 25" --entry 55 --turn-in auto

describe("A-RECIPE-A — ideal line on a small road", () => {
  it("the verbatim command: engine refuses NO_SOLUTION/empty_band at 55 km/h (ratified — see file banner)", () => {
    const r = cli(["run", "--road", "lane 3.5 | S 20 | R 25 ^90 | S 25", "--entry", "55", "--turn-in", "auto"]);
    expect(r.exit).toBe(3);
    const doc = r.stdout as { ok: boolean; error: { code: string; detail: { sub_reason: string } } };
    expect(doc.ok).toBe(false);
    expect(doc.error.code).toBe("NO_SOLUTION");
    expect(doc.error.detail.sub_reason).toBe("empty_band");
  });

  it("the same road solves clean at a nearby speed within its actual feasible band (demonstrates the CLI composition is not the fault)", () => {
    const r = cli(["run", "--road", "lane 3.5 | S 20 | R 25 ^90 | S 25", "--entry", "48", "--turn-in", "auto"]);
    expect(r.exit).toBe(0);
    const doc = r.stdout as { ok: true; value: { lines: [{ ok?: boolean; verdict: { outcome: string; quality: string } }] } };
    expect(doc.ok).toBe(true);
    const line = doc.value.lines[0]!;
    expect(line.verdict.outcome).toBe("contained");
    expect(line.verdict.quality).toBe("good");
  });
});

// ---------------------------------------------------------------------------
// (b) Ideal + mistake overlay figure — VERBATIM commands.
//   linelab run  --road "..." --entry 55 --turn-in auto --mistake premature --out out/fig81.json
//   linelab render out/fig81.json --views topdown --mode diagram --out out/

describe("A-RECIPE-B — ideal + mistake overlay figure", () => {
  it("the verbatim `run` step: refuses for the same reason as recipe (a) (the mistake never gets a base line to compile against)", () => {
    const dir = mkdtempSync(join(tmpdir(), "linelab-b-"));
    const r = cli([
      "run", "--road", "lane 3.5 | S 20 | R 25 ^90 | S 25", "--entry", "55", "--profile", "street",
      "--turn-in", "auto", "--mistake", "premature", "--out", join(dir, "fig81.json")
    ]);
    expect(r.exit).toBe(3);
    const doc = r.stdout as { ok: boolean; error: { code: string } };
    expect(doc.ok).toBe(false);
    expect(doc.error.code).toBe("NO_SOLUTION");
    rmSync(dir, { recursive: true, force: true });
  });

  it("run+render on a solvable substitute (48 km/h): two-line envelope (ideal green, premature red/runoff), SVG written and passes the proportion gate", () => {
    const dir = mkdtempSync(join(tmpdir(), "linelab-b2-"));
    const runR = cli([
      "run", "--road", "lane 3.5 | S 20 | R 25 ^90 | S 25", "--entry", "48", "--profile", "street",
      "--turn-in", "auto", "--mistake", "premature", "--out", join(dir, "fig81.json")
    ]);
    expect(runR.exit).toBe(0);
    const runDoc = runR.stdout as { ok: true; value: { lines: readonly { line_id: string; verdict?: { outcome: string } }[] } };
    expect(runDoc.value.lines).toHaveLength(2);
    expect(runDoc.value.lines[0]!.verdict?.outcome).toBe("contained");
    expect(["wide", "runoff"]).toContain(runDoc.value.lines[1]!.verdict?.outcome);

    // `--mode true`, not the recipe's literal `--mode diagram` (ARCHITECTURE
    // §6.5's already-established v0.1 rule: `mode=diagram` is phase-gated
    // post-v0.1; the binding bake spelling overrides with `--mode true`,
    // exactly as it does for the committed book scenes).
    const renderR = cli(["render", join(dir, "fig81.json"), "--views", "topdown", "--mode", "true", "--out", dir]);
    expect(renderR.exit).toBe(0);
    const svgPath = join(dir, "run.svg");
    expect(existsSync(svgPath)).toBe(true);
    const svg = readFileSync(svgPath, "utf8");
    expect(svg.startsWith("<svg")).toBe(true);
    const manifest = JSON.parse(readFileSync(join(dir, "manifest.json"), "utf8")) as { legend: readonly unknown[] };
    expect(manifest.legend).toHaveLength(2);
    rmSync(dir, { recursive: true, force: true });
  });
});

// ---------------------------------------------------------------------------
// (e) A named book figure — VERBATIM base command, with ARCHITECTURE §6.5's
// bake override applied (`--mode true`): the committed scene authors
// `view: mode=diagram`, which is a phase-gated token in v0.1; ARCHITECTURE
// §6.5 pins the actual v0.1 bake invocation as `figure <scene> --mode true`
// (the flag-over-file merge law) — this is the documented, binding spelling,
// not a deviation from design/08's bare example.

describe("A-RECIPE-E — a named book figure (fig-08-01)", () => {
  it("bakes fig-08-01.scene: green ideal + red premature line, hourglass turn markers, legend, proportion-gated manifest", () => {
    const dir = mkdtempSync(join(tmpdir(), "linelab-e-"));
    const r = cli(["figure", join(figuresDir, "fig-08-01.scene"), "--mode", "true", "--out", dir]);
    expect(r.exit).toBe(0);
    const doc = r.stdout as { ok: true; value: { figure_id: string; lines: readonly { line_id: string; verdict: { outcome: string; quality: string } }[] } };
    expect(doc.ok).toBe(true);
    const good = doc.value.lines.find((l) => l.line_id === "good")!;
    const bad = doc.value.lines.find((l) => l.line_id === "bad")!;
    expect(good.verdict.outcome).toBe("contained");
    expect(good.verdict.quality).toBe("good");
    expect(["wide", "runoff"]).toContain(bad.verdict.outcome);

    const svgPath = join(dir, `${doc.value.figure_id}.svg`);
    expect(existsSync(svgPath)).toBe(true);
    const svg = readFileSync(svgPath, "utf8");
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg).toContain("<");

    const manifest = JSON.parse(readFileSync(join(dir, "manifest.json"), "utf8")) as {
      legend: readonly { line_id: string; role: string; outcome: string }[];
      mode: string;
    };
    expect(manifest.mode).toBe("true");
    expect(manifest.legend.map((l) => l.line_id).sort()).toEqual(["bad", "good"]);
    rmSync(dir, { recursive: true, force: true });
  });

  it("--check lints without solving: exit 0, no writes needed", () => {
    const r = cli(["figure", join(figuresDir, "fig-08-01.scene"), "--check"]);
    expect(r.exit).toBe(0);
    const doc = r.stdout as { ok: true; value: { valid: boolean; spec_hash: string } };
    expect(doc.value.valid).toBe(true);
    expect(doc.value.spec_hash).toMatch(/^[0-9a-f]{6}$/);
  });
});

// ---------------------------------------------------------------------------
// (f) Constraint-shaped custom line — VERBATIM command. The design text
// itself anticipates a possible refusal arm ("or exits 3 with a typed
// NO_SOLUTION"); the actual refusal reason is `empty_band` (the road/speed
// pair is infeasible before the constraint is even evaluated — see the file
// banner), not the design's named `constraint_unmet` — asserted leniently
// per the recipe's own dual-outcome wording.

describe("A-RECIPE-F — constraint-shaped custom line", () => {
  it("the verbatim command: exit 0 with all samples respecting the bound, OR exit 3 NO_SOLUTION (either arm the recipe itself allows)", () => {
    const r = cli([
      "solve", "--road", "lane 3.5 | S 20 | R 25 ^90 | S 25", "--entry", "55", "--turn-in", "auto",
      "--constraint", "f>=0.6@entry:c1..mid:c1"
    ]);
    expect([0, 3]).toContain(r.exit);
    const doc = r.stdout as { ok: boolean; value?: { lines: readonly { verdict: { constraints: readonly { satisfied: boolean }[] | null } }[] }; error?: { code: string } };
    if (r.exit === 0) {
      expect(doc.ok).toBe(true);
      const line = doc.value!.lines[0]!;
      for (const c of line.verdict.constraints ?? []) expect(c.satisfied).toBe(true);
    } else {
      expect(doc.ok).toBe(false);
      expect(doc.error!.code).toBe("NO_SOLUTION");
    }
  });

  it("a looser bound on the same token grammar, within the road's actual feasible band, solves clean and honours the bound throughout (the mechanism genuinely enforces — f>=0.6 is itself infeasible at 48 km/h, confirmed NO_SOLUTION/non_clean_band, a real bound-violation refusal rather than the geometry-infeasible empty_band above)", () => {
    const r = cli([
      "solve", "--road", "lane 3.5 | S 20 | R 25 ^90 | S 25", "--entry", "48", "--turn-in", "auto",
      "--constraint", "f>=0.3@entry:c1..mid:c1"
    ]);
    expect(r.exit).toBe(0);
    const doc = r.stdout as { ok: true; value: { lines: readonly { verdict: { constraints: readonly { satisfied: boolean; id: string }[] | null } }[] } };
    const line = doc.value.lines[0]!;
    expect(line.verdict.constraints).not.toBeNull();
    expect(line.verdict.constraints!.length).toBeGreaterThan(0);
    for (const c of line.verdict.constraints!) expect(c.satisfied).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// (d) Linked chain with a per-corner mistake — authored as available.

describe("A-RECIPE-D — linked chain with a per-corner mistake (authored as available)", () => {
  it("chains solve contained; the scoped mistake compounds at both corners", { timeout: 120_000 }, () => {
    const r = cli([
      "run", "--road", "lane 3.5 | S 15 | R 30 ^70 | S 5 | L 25 ^80 | S 20",
      "--entry", "55", "--turn-in", "auto", "--mistake", "premature@c1,c2"
    ]);
    expect(r.exit).toBe(0);
    const doc = r.stdout as { ok: true; value: { lines: readonly { line_id: string; verdict: { outcome: string } }[] } };
    expect(doc.value.lines).toHaveLength(2);
    expect(doc.value.lines[0]!.line_id).not.toBe(doc.value.lines[1]!.line_id);
  });
});

// ---------------------------------------------------------------------------
// (i) A believed road: the misjudged corner — authored as available.

describe("A-RECIPE-I — a believed road: the misjudged corner (authored as available)", () => {
  it("the ideal line beside an underread misjudge line; the misjudge carries a believed-vs-actual divergence", () => {
    const r = cli(["run", "--road", "preset book90", "--entry", "34", "--turn-in", "auto", "--mistake", "underread:r_believed=16"]);
    expect(r.exit).toBe(0);
    const doc = r.stdout as { ok: true; value: { lines: readonly { line_id: string; verdict: { misjudgment: unknown; outcome: string } }[] } };
    expect(doc.value.lines).toHaveLength(2);
    const misjudge = doc.value.lines.find((l) => l.verdict.misjudgment !== null);
    expect(misjudge).toBeDefined();
    expect(misjudge!.verdict.misjudgment).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// (j) The double apex — authored as available. bookDoubleApex itself refuses
// `no_two_touch_line` under the ALREADY-RATIFIED WP-11 finding (see file
// banner); the design's own `--accept best_failing` fallback path is what's
// asserted here.

describe("A-RECIPE-J — the double apex (authored as available; inherits the WP-11 A-DOUBLEAPEX SEAM ratification)", () => {
  it("bookDoubleApex under style=double_apex refuses no_two_touch_line on the plain arm", () => {
    const r = cli(["solve", "--road", "preset bookDoubleApex", "--entry", "30", "--style", "double_apex"]);
    expect(r.exit).toBe(3);
    const doc = r.stdout as { ok: boolean; error: { code: string; detail: { sub_reason: string } } };
    expect(doc.ok).toBe(false);
    expect(doc.error.code).toBe("NO_SOLUTION");
    expect(doc.error.detail.sub_reason).toBe("no_two_touch_line");
  });

  it("...and returns the retained best-failing candidate under --accept best_failing (the design text's own named fallback)", () => {
    const r = cli(["solve", "--road", "preset bookDoubleApex", "--entry", "30", "--style", "double_apex", "--accept", "best_failing"]);
    const doc = r.stdout as { ok: true; value: { lines: [{ verdict: { acceptance: { policy: string; met: boolean } } }] } };
    expect(doc.ok).toBe(true);
    expect(doc.value.lines[0]!.verdict.acceptance.policy).toBe("best_failing");
  });

  it("bookDecreasing under double_apex also refuses no_two_touch_line, exactly as design/08's recipe text predicts", () => {
    const r = cli(["solve", "--road", "preset bookDecreasing", "--entry", "30", "--style", "double_apex"]);
    expect(r.exit).toBe(3);
    const doc = r.stdout as { ok: boolean; error: { code: string; detail: { sub_reason: string } } };
    expect(doc.error.code).toBe("NO_SOLUTION");
    expect(doc.error.detail.sub_reason).toBe("no_two_touch_line");
  });
});
