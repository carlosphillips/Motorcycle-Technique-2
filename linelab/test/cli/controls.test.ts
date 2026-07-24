// test/cli/controls.test.ts — the v0.2 `controls` VIEW on the real command
// line (design/08 §3's `render` row: `render <envelope.json> --views
// topdown,controls,pov`; 00 §5's view vocabulary `topdown | controls | pov`).
//
// `controls` is a view, not a verb — design/08 §3's verb table has no
// `controls` row — so every command here goes through `render --views`.
//
// Gates carried by this file:
//   · `C-BOOKMARKS`, the controls half — the strip introduces NO bookmark
//     source of its own. Every band edge it draws is either the run's first
//     station, the terminal station, or an EVENT's station; nothing else can
//     put a mark on the strip's timeline (07 §3.1: "named jump targets are
//     exactly the result's events").
//   · `C-RECOMPUTE-BUDGET` as re-scoped by 09 §6.1 — "largest committed
//     figure (the linked-chain fixture), WARM CACHE: all-lines recompute
//     ≤ 100 ms (× 3 CI machine-variance multiplier)".

import { describe, it, expect, beforeAll } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { lowerScene } from "../../src/plan/scene.js";
import { run } from "../../src/solve/run.js";
import { isLineRefusal } from "../../src/solve/envelope.js";
import type { FigureResult, LineResult } from "../../src/solve/types.js";
import { renderControls, phaseBandsOf } from "../../src/render/controls.js";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "../.."); // linelab/
const mainJs = join(repoRoot, "dist/cli/main.js");
const scenesDir = resolve(repoRoot, "../figures");

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

let dir: string;
let envelopePath: string;

beforeAll(() => {
  execFileSync("npm", ["run", "build"], { cwd: repoRoot, stdio: "ignore" });
  dir = mkdtempSync(join(tmpdir(), "linelab-controls-"));
  envelopePath = join(dir, "env.json");
  const solved = cli([
    "run",
    "--road", "preset book90",
    "--entry", "34",
    "--turn-in", "auto",
    "--mistake", "premature:early_by_m=6",
    "--out", envelopePath
  ]);
  expect(solved.exit).toBe(0);
}, 300_000);

// ---------------------------------------------------------------------------

describe("`render --views controls` — the strip from the command line", () => {
  it("writes one strip per drawn line, named <figure_id>.<line_id>.controls.svg", () => {
    const out = join(dir, "all");
    const r = cli(["render", envelopePath, "--views", "controls", "--mode", "true", "--out", out]);
    expect(r.exit).toBe(0);
    const value = (r.stdout as { value: { views: string[]; controls: string[] } }).value;
    expect(value.views).toEqual(["controls"]);
    const written = readdirSync(out).sort();
    expect(written).toEqual(["run.premature.controls.svg", "run.solved.controls.svg"]);
    for (const f of written) {
      const svg = readFileSync(join(out, f), "utf8");
      expect(svg.startsWith("<svg")).toBe(true);
      expect(svg).toContain('data-projection="none"');
    }
  });

  it("shades exactly the window the TOP-DOWN view resolves — one window, two views", () => {
    const out = join(dir, "linked");
    const r = cli(["render", envelopePath, "--views", "topdown,controls", "--mode", "true", "--out", out]);
    expect(r.exit).toBe(0);
    const value = (r.stdout as { value: { views: string[]; window: { from_s: number; to_s: number } } }).value;
    expect(value.views).toEqual(["topdown", "controls"]);
    // the topdown half still lands (one renderer, no second code path)
    expect(readdirSync(out)).toContain("run.svg");
    const manifest = JSON.parse(readFileSync(join(out, "manifest.json"), "utf8")) as { view: { window: { from_s: number; to_s: number } } };
    expect(value.window.from_s).toBeCloseTo(manifest.view.window.from_s, 9);
    expect(value.window.to_s).toBeCloseTo(manifest.view.window.to_s, 9);
    const svg = readFileSync(join(out, "run.solved.controls.svg"), "utf8");
    expect(svg).toContain(`data-window-to-s="${Number(value.window.to_s.toFixed(3))}"`);
  });

  it("`--line` narrows to one strip; an unknown id is a typed UNKNOWN_ID, exit 2", () => {
    const out = join(dir, "one");
    const r = cli(["render", envelopePath, "--views", "controls", "--mode", "true", "--line", "premature", "--out", out]);
    expect(r.exit).toBe(0);
    expect(readdirSync(out)).toEqual(["run.premature.controls.svg"]);

    const bad = cli(["render", envelopePath, "--views", "controls", "--mode", "true", "--line", "nope"]);
    expect(bad.exit).toBe(2);
    const e = (bad.stdout as { error: { code: string; detail: { reason: string; available: string[] } } }).error;
    expect(e.code).toBe("UNKNOWN_ID");
    expect(e.detail.reason).toBe("unknown_line_id");
    expect(e.detail.available).toEqual(["solved", "premature"]);
  });

  it("`--s <m>` is the linked cursor's station — the strip gains a cursor rule and value chips", () => {
    const bare = join(dir, "bare");
    const cursored = join(dir, "cursored");
    expect(cli(["render", envelopePath, "--views", "controls", "--mode", "true", "--line", "solved", "--out", bare]).exit).toBe(0);
    expect(cli(["render", envelopePath, "--views", "controls", "--mode", "true", "--line", "solved", "--s", "20", "--out", cursored]).exit).toBe(0);
    const a = readFileSync(join(bare, "run.solved.controls.svg"), "utf8");
    const b = readFileSync(join(cursored, "run.solved.controls.svg"), "utf8");
    expect(a).not.toContain('class="cursor-rule"');
    expect(b).toContain('class="cursor-rule"');
    expect(b).toContain('data-cursor-s="20"');
  });

  it("re-rendering the same envelope is byte-identical (P-EXPORT-DETERMINISM's shape)", () => {
    const a = join(dir, "det-a");
    const b = join(dir, "det-b");
    cli(["render", envelopePath, "--views", "controls", "--mode", "true", "--s", "12", "--out", a]);
    cli(["render", envelopePath, "--views", "controls", "--mode", "true", "--s", "12", "--out", b]);
    for (const f of readdirSync(a)) {
      expect(readFileSync(join(a, f), "utf8")).toBe(readFileSync(join(b, f), "utf8"));
    }
  });
});

// ---------------------------------------------------------------------------

describe("C-BOOKMARKS (controls half) — the strip adds no bookmark source", () => {
  it("every phase-band edge is the run start, the terminal station, or an event's station", () => {
    // `run --out` writes the envelope itself (design/08 §3.2's one-document
    // discipline applies to stdout; the file is the bare envelope)
    const envelope = JSON.parse(readFileSync(envelopePath, "utf8")) as FigureResult;
    const lines = (envelope.lines as unknown[]).filter((l): l is LineResult => !isLineRefusal(l as never));
    expect(lines.length).toBe(2);
    for (const line of lines) {
      const legal = new Set<number>([
        Number(line.trajectory.samples[0]!.s.toFixed(9)),
        Number(line.trajectory.terminated.s.toFixed(9)),
        ...line.trajectory.events.map((e) => Number(e.s.toFixed(9)))
      ]);
      const bands = phaseBandsOf(line);
      expect(bands.length).toBeGreaterThan(0);
      for (const band of bands) {
        expect(legal, `${line.line_id} band start ${band.from_s}`).toContain(Number(band.from_s.toFixed(9)));
        expect(legal, `${line.line_id} band end ${band.to_s}`).toContain(Number(band.to_s.toFixed(9)));
      }
    }
  });

  it("the strip's only other timeline mark is the caller's own cursor — no probe/tau bookmark exists", () => {
    const svg = readFileSync(join(dir, "cursored", "run.solved.controls.svg"), "utf8");
    // 07 §3.5: probe#N and tau_close_s are NOT events and NOT jump targets
    expect(svg).not.toContain("probe#");
    expect(svg).not.toContain("tau_close");
    const rules = [...svg.matchAll(/class="cursor-rule"/g)];
    expect(rules).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------

describe("C-RECOMPUTE-BUDGET (as re-scoped by design/09 §6.1)", () => {
  // 09 §6.1: the honest number. A cold, solve-included recompute of this figure
  // is two orders of magnitude past interactive; shared figures take the
  // CACHED-PLAN path (05 §8.1's `solved` member), and that is the path this
  // budget governs.
  const BUDGET_MS = 100 * 3; // ≤ 100 ms × the 3× CI machine-variance multiplier (TUNING)

  let warmSpec: Record<string, unknown>;

  beforeAll(() => {
    const scene = readFileSync(join(scenesDir, "fig-08-06.scene"), "utf8"); // the linked-chain figure
    const lowered = lowerScene(scene);
    expect(lowered.ok).toBe(true);
    if (!lowered.ok) return;
    const cold = run(lowered.value as unknown as Record<string, unknown>, { engine_semver: "0.1.0", figure_id: "fig-08-06" });
    expect(cold.ok, "the linked-chain figure must bake before its warm path can be measured").toBe(true);
    if (!cold.ok) return;
    warmSpec = {
      ...(lowered.value as unknown as Record<string, unknown>),
      engine_semver: "0.1.0",
      lines: lowered.value.lines.map((l) => {
        const got = cold.value.lines.find((e) => e.line_id === l.name);
        if (got === undefined || isLineRefusal(got)) return l;
        const line = got as LineResult;
        return {
          ...l,
          expected: { outcome: line.verdict.outcome, result_hash: line.verdict.result_hash },
          solved: { spec_hash: line.verdict.spec_hash, plan: line.resolved_scenario.rider.plan }
        };
      })
    };
  }, 300_000);

  it("the warm spec really is warm — the solver line loads its cached plan, never re-searches", () => {
    const warm = run(warmSpec, { engine_semver: "0.1.0", figure_id: "fig-08-06" });
    expect(warm.ok).toBe(true);
    if (!warm.ok) return;
    const byId = new Map(warm.value.lines.map((l) => [l.line_id, l]));
    const good = byId.get("good");
    expect(good).toBeDefined();
    expect(isLineRefusal(good!)).toBe(false);
    expect((good as LineResult).cache).toBe("hit");
    // the mistake line has no cached-plan path by design: `solved` is the
    // SOLVER's conclusion (05 §8.1), and a mistake line is compiled off its
    // base rather than solved — so `absent` here is the honest record.
    expect((byId.get("bad") as LineResult).cache).toBe("absent");
  });

  it(`recomputes every line of the largest committed figure inside ${BUDGET_MS} ms on the warm path`, () => {
    // Measured on the SHIPPED artifact (`dist/`), in a fresh process. Both
    // matter: `dist` is what the viewer and the CLI actually load (D1's one
    // core, C-ONE-CORE), and a fresh V8 keeps the measurement off this
    // worker's heap — the budget is about the engine, not about the harness.
    const specPath = join(dir, "warm-spec.json");
    const probePath = join(dir, "budget-probe.mjs");
    writeFileSync(specPath, JSON.stringify(warmSpec), "utf8");
    writeFileSync(
      probePath,
      [
        `import { readFileSync } from "node:fs";`,
        `import { run } from ${JSON.stringify(join(repoRoot, "dist/solve/run.js"))};`,
        `const spec = JSON.parse(readFileSync(${JSON.stringify(specPath)}, "utf8"));`,
        `const opts = { engine_semver: "0.1.0", figure_id: "fig-08-06" };`,
        `for (let i = 0; i < 3; i++) run(spec, opts);`, // JIT warmup, untimed
        `const samples = [];`,
        `for (let i = 0; i < 5; i++) { const t0 = performance.now(); const r = run(spec, opts); samples.push(performance.now() - t0); if (!r.ok) { console.log(JSON.stringify({ ok: false })); process.exit(0); } }`,
        `console.log(JSON.stringify({ ok: true, samples }));`
      ].join("\n"),
      "utf8"
    );
    const raw = execFileSync("node", [probePath], { cwd: repoRoot, encoding: "utf8" });
    const probe = JSON.parse(raw) as { ok: boolean; samples: number[] };
    expect(probe.ok).toBe(true);
    const best = Math.min(...probe.samples);
    expect(
      best,
      `warm all-lines recompute took ${probe.samples.map((s) => s.toFixed(0)).join("/")} ms`
    ).toBeLessThan(BUDGET_MS);
  }, 120_000);

  it("rendering the controls strip for every line is a rounding error against that budget", () => {
    const warm = run(warmSpec, { engine_semver: "0.1.0", figure_id: "fig-08-06" });
    expect(warm.ok).toBe(true);
    if (!warm.ok) return;
    const lines = warm.value.lines.filter((l): l is LineResult => !isLineRefusal(l));
    renderControls(lines[0]!); // warm the path
    const t0 = performance.now();
    for (const line of lines) renderControls(line, undefined, line.trajectory.terminated.s / 2);
    const ms = performance.now() - t0;
    expect(ms, `strip render for ${lines.length} lines took ${ms.toFixed(1)} ms`).toBeLessThan(BUDGET_MS / 10);
  });
});
