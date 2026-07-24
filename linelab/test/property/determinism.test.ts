// test/property/determinism.test.ts — WP-17 gates (design/09 §3.1, D29/D38):
//
//   P-DETERMINISM        — identical scenario JSON → byte-identical envelope,
//                          twice in-process AND across process isolation (two
//                          independent `node dist/cli/main.js run` children —
//                          stronger than vitest worker isolation: nothing is
//                          shared but the input bytes).
//   P-EXPORT-DETERMINISM — byte-identical SVG and trace CSV on re-export, and
//                          the warm-vs-cold cache-independence leg: a solved
//                          line re-run through the 05 §8.1 cache-hit path
//                          renders the byte-identical SVG and carries the
//                          identical result_hash — only the disclosed
//                          `cache` provenance tier differs.
//
// Assertion discipline: byte equality on the exact strings the tool emits —
// the CLI's own JSON.stringify spelling — never a paraphrased re-encoding.
// The cross-process leg spawns the BUILT CLI (dist/); the phase-exit CI run
// builds before testing (package.json `bless`/`cli` both require it, and
// test/analytic/bless.test.ts builds in its beforeAll).

import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { run, ENGINE_SEMVER } from "../../src/solve/run.js";
import { isLineRefusal, stampExpected } from "../../src/solve/envelope.js";
import type { LineResult } from "../../src/solve/types.js";
import { canonicalize, fnv1a } from "../../src/core/hash.js";
import { renderViews } from "../../src/render/index.js";
import type { ComposedRoad } from "../../src/road/types.js";
import { runVerb } from "../../src/cli/verbs/run.js";
import { exportVerb } from "../../src/cli/verbs/export.js";
import { renderVerb } from "../../src/cli/verbs/render.js";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "../.."); // linelab/
const mainJs = join(repoRoot, "dist/cli/main.js");

// The determinism witness: an explicit-plan wire scenario (no solver in the
// loop — the solver's own determinism rides the golden roster recompute in
// test/golden/roster.test.ts). Same fixture family as the blessed
// C30-trailbrake golden.
const SCENARIO = {
  spec: "linelab/1",
  id: "det-witness",
  road: { dsl: "lane 3.5 | S 35 | R 30 ^90 | S 25" },
  rider: {
    profile: "street",
    start: { speed_kmh: 55, f: 0.9 },
    plan: [
      { do: "brake", id: "b1", at_s: 2, decel: 2.0 },
      { do: "turn_in", id: "t1", at_s: 29.5, target: { lean_deg: 19.5 } },
      { do: "throttle", id: "r0", at_s: 36, accel: 0 },
      { do: "throttle", id: "r1", at_s: 65, accel: 1.0 }
    ]
  }
} as const;

const scenarioJson = (): string => JSON.stringify(SCENARIO);

function inProcessEnvelopeBytes(): string {
  // the CLI's own spelling: runVerb → outcome.stdout → JSON.stringify
  const outcome = runVerb({ loadedText: scenarioJson(), argv: [], engineSemver: ENGINE_SEMVER });
  expect(outcome.exit).toBe(0);
  return JSON.stringify(outcome.stdout);
}

function childEnvelopeBytes(inputPath: string): string {
  return execFileSync("node", [mainJs, "run", inputPath], {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });
}

describe("P-DETERMINISM (design/09 §3.1; D29/D38)", () => {
  it("same scenario JSON → byte-identical envelope, twice in-process", { timeout: 120_000 }, () => {
    const a = inProcessEnvelopeBytes();
    const b = inProcessEnvelopeBytes();
    expect(b).toBe(a);
    // and the canonical hash of the envelope is stable (the result_hash law's
    // substrate: canonicalize is key-order-blind and -0-normalizing)
    const ca = canonicalize(JSON.parse(a));
    const cb = canonicalize(JSON.parse(b));
    expect(ca.ok && cb.ok).toBe(true);
    if (ca.ok && cb.ok) expect(fnv1a(ca.value)).toBe(fnv1a(cb.value));
  });

  it("same scenario JSON → byte-identical envelope across process isolation (two independent CLI children), and identical to the in-process bytes", { timeout: 120_000 }, () => {
    expect(existsSync(mainJs)).toBe(true);
    const dir = mkdtempSync(join(tmpdir(), "linelab-det-"));
    try {
      const inputPath = join(dir, "scenario.json");
      writeFileSync(inputPath, scenarioJson());
      const child1 = childEnvelopeBytes(inputPath);
      const child2 = childEnvelopeBytes(inputPath);
      expect(child2).toBe(child1);
      // the CLI child's stdout is the same JSON document the library emits
      // (A-STATE-VERB pattern: verb ≡ library, byte-for-byte modulo the
      // trailing newline main.ts appends)
      expect(child1).toBe(inProcessEnvelopeBytes() + "\n");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("P-EXPORT-DETERMINISM (design/09 §3.4 — byte-identical artifacts on re-export)", () => {
  // one envelope, computed once, exported repeatedly
  const envelope = (() => {
    const r = run(SCENARIO as unknown as Record<string, unknown>, { engine_semver: ENGINE_SEMVER, figure_id: "det-witness" });
    if (!r.ok) throw new Error(`witness run refused: ${JSON.stringify(r.error)}`);
    return r.value;
  })();
  const envelopeJson = JSON.stringify(envelope);

  it("trace CSV re-export is byte-identical (same envelope in, same bytes out)", () => {
    const csvOf = (): string => {
      const outcome = exportVerb({ loadedText: envelopeJson, argv: ["--as", "trace-csv", "--all", "--out", "x"], engineSemver: ENGINE_SEMVER });
      expect(outcome.exit).toBe(0);
      const writes = outcome.writes ?? [];
      expect(writes.length).toBeGreaterThan(0);
      return writes.map((w) => `${w.path}\n${w.content}`).join("\n---\n");
    };
    expect(csvOf()).toBe(csvOf());
  });

  it("SVG re-render is byte-identical — renderViews and the render verb agree with themselves run-over-run", () => {
    const road = envelope.road as unknown as ComposedRoad;
    const lines = envelope.lines.filter((l): l is LineResult => !isLineRefusal(l));
    const a = renderViews({ road, lines });
    const b = renderViews({ road, lines });
    expect(a.ok && b.ok).toBe(true);
    if (a.ok && b.ok) expect(b.value.svg).toBe(a.value.svg);

    const verbSvg = (): string => {
      const outcome = renderVerb({ loadedText: envelopeJson, argv: ["--out", "x"] });
      expect(outcome.exit).toBe(0);
      const svg = (outcome.writes ?? []).find((w) => w.path.endsWith(".svg"));
      expect(svg).toBeDefined();
      return svg!.content;
    };
    expect(verbSvg()).toBe(verbSvg());
  });

  it("warm-vs-cold cache independence (05 §8.1): a cache-hit re-run renders the byte-identical SVG and result_hash; only the disclosed cache tier differs", { timeout: 300_000 }, () => {
    const lineSpec = { entry_kmh: 63, road: { dsl: "lane 3.5 | S 35 | R 30 ^90 | S 25" } };
    const fig = {
      road: { dsl: "lane 3.5 | S 35 | R 30 ^90 | S 25" },
      lines: [{ name: "l1", role: "ideal", spec: lineSpec }]
    };
    const cold = run(fig as unknown as Record<string, unknown>, { engine_semver: ENGINE_SEMVER, figure_id: "cachefig" });
    expect(cold.ok).toBe(true);
    if (!cold.ok) return;
    const coldLine = cold.value.lines[0] as LineResult;
    expect(isLineRefusal(coldLine)).toBe(false);
    expect(coldLine.cache).toBe("absent");

    // reconstruct the solved stamp exactly as run.ts's cache classifier
    // recomputes it: canonicalize({road_spec, occluders, hazards, source})
    const source = { kind: "solve", solveSpec: (coldLine.source as { solveSpec: unknown }).solveSpec };
    const canon = canonicalize({
      road_spec: coldLine.resolved_scenario.road,
      occluders: cold.value.occluders,
      hazards: cold.value.hazards,
      source
    });
    expect(canon.ok).toBe(true);
    if (!canon.ok) return;
    const warmFig = {
      ...fig,
      engine_semver: ENGINE_SEMVER,
      lines: [
        {
          name: "l1",
          role: "ideal",
          spec: lineSpec,
          expected: stampExpected(coldLine.verdict),
          solved: { spec_hash: fnv1a(canon.value), plan: coldLine.resolved_scenario.rider.plan }
        }
      ]
    };
    const warm = run(warmFig as unknown as Record<string, unknown>, { engine_semver: ENGINE_SEMVER, figure_id: "cachefig" });
    expect(warm.ok).toBe(true);
    if (!warm.ok) return;
    const warmLine = warm.value.lines[0] as LineResult;
    expect(isLineRefusal(warmLine)).toBe(false);
    // the cache tier is the ONLY divergence — disclosed, never silent
    expect(warmLine.cache).toBe("hit");
    expect(warmLine.verdict.result_hash).toBe(coldLine.verdict.result_hash);
    expect(warmLine.verdict.outcome).toBe(coldLine.verdict.outcome);

    const road = cold.value.road as unknown as ComposedRoad;
    const coldSvg = renderViews({ road, lines: [coldLine] });
    const warmSvg = renderViews({ road, lines: [warmLine] });
    expect(coldSvg.ok && warmSvg.ok).toBe(true);
    if (coldSvg.ok && warmSvg.ok) expect(warmSvg.value.svg).toBe(coldSvg.value.svg);
  });
});
