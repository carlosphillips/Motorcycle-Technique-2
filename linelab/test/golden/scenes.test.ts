// test/golden/scenes.test.ts — WP-17: the two shipped misjudgment scene bakes,
// G-8.5-RED (figures/fig-08-05.scene) and G-8.4-COMPANION
// (figures/fig-08-04.scene), design/09 §3.2.
//
// ENGINE-TRUTH STATE (post fix/adjudication phases — the bookDecreasing
// empty-clean-band seam is RESOLVED; the A-DOUBLEAPEX and believed-band seams
// still stand):
//   fig-08-04 `good`  → SOLVES: contained/good, ONE late apex (the clean band
//                       at 34 km/h is non-empty on this engine now),
//   fig-08-04 `bad`   → overspeed:by_kmh=2.5 (fig84 amendment): wide/failing —
//                       a marginal overspeed pushed wide off the tightening exit,
//   fig-08-05 `good`  → NO_SOLUTION/no_two_touch_line (the pinned
//                       A-DOUBLEAPEX SEAM),
//   fig-08-05 `late`  → SOLVES runoff/failing (adj-fig-08-05): the believed
//                       single-R24 world under-reads the tightening R12 touches,
//                       so the line runs off before it can react —
//                       run_wide_detect at s≈15.81, then off_road; corrective
//                       infeasible (departed_before_reaction), no correction.
// Under design/05 §7 the bake stays TOTAL either way: refusals are first-class
// typed entries, refused lines draw nothing, and the envelope still bakes.
// G-8.4-COMPANION and G-8.5-RED both pin the SOLVED engine truth now:
// fig-08-05 `good` still refuses no_two_touch_line (the A-DOUBLEAPEX seam; its
// per-line double-apex pins remain it.todo), `late` solves the runoff above.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { figureVerb } from "../../src/cli/verbs/figure.js";
import { ENGINE_SEMVER } from "../../src/solve/run.js";
import { isLineRefusal } from "../../src/solve/envelope.js";
import type { FigureResult, LineRefusal, LineResult } from "../../src/solve/types.js";

const here = dirname(fileURLToPath(import.meta.url));
const scenesDir = resolve(here, "../../../figures"); // ../figures — design of record, read-only

function bake(sceneFile: string): FigureResult {
  const text = readFileSync(join(scenesDir, sceneFile), "utf8");
  const outcome = figureVerb({ loadedText: text, argv: ["--mode", "true"], engineSemver: ENGINE_SEMVER });
  // exit 3 = declaration-gate deviation (the refusals are unmet expectations —
  // that is the gate doing its job); the bake itself is total
  expect([0, 3]).toContain(outcome.exit);
  const doc = (outcome.stdout as { ok: boolean; value: FigureResult }).value;
  expect(Array.isArray(doc.lines)).toBe(true);
  return doc;
}

function refusalOf(env: FigureResult, id: string): LineRefusal {
  const line = env.lines.find((l) => l.line_id === id);
  if (line === undefined || !isLineRefusal(line)) throw new Error(`expected ${id} to be a refusal`);
  return line;
}

function lineOf(env: FigureResult, id: string): LineResult {
  const line = env.lines.find((l) => l.line_id === id);
  if (line === undefined || isLineRefusal(line)) throw new Error(`expected ${id} to be a solved line`);
  return line;
}

describe("G-8.4-COMPANION (fig-08-04.scene bake — solved engine truth, design/09 §3.2)", () => {
  it("good rides bookDecreasing@34 clean with ONE late apex (waits for the radius to open); bad (overspeed) runs off failing with the closed check-fail set", { timeout: 600_000 }, () => {
    const env = bake("fig-08-04.scene");
    expect(env.lines).toHaveLength(2);

    const good = lineOf(env, "good");
    expect(good.verdict.outcome).toBe("contained");
    expect(good.verdict.quality).toBe("good");
    expect(good.verdict.corners).toHaveLength(1);
    const gc = good.verdict.corners[0]!;
    expect(gc.id).toBe("c1");
    // single LATE apex — the line waits for the radius to open (scene's own caption)
    expect(gc.apexes).toHaveLength(1);
    expect(gc.apexes[0]!.pct).toBeGreaterThan(50);
    expect(good.verdict.doctrine.checks.filter((c) => c.verdict === "fail")).toEqual([]);

    const bad = lineOf(env, "bad");
    // AMENDED (fig84 adjudication): the scene now authors `overspeed:by_kmh=2.5`
    // — a marginal overspeed. bookDecreasing's good line rides at f≈0.999 entering
    // 0.4 m from the outer edge, so the +26 default departed at 12% of the corner
    // (a 475 px stub); +2.5 marches monotonically wide off the outer edge as the
    // radius tightens and grades `wide` (admissible for overspeed, 03 §7.1;
    // quality failing/red, 05 §6.1). off_road terminal unchanged.
    expect(bad.verdict.outcome).toBe("wide");
    expect(bad.verdict.quality).toBe("failing");
    expect(bad.trajectory.terminated.reason).toBe("off_road");
    // closed engine-truth fail set — at +2.5 the marginal overspeed drops
    // `quick_steer` from the +26 set (the line is not a hard early stab)
    expect(
      bad.verdict.doctrine.checks
        .filter((c) => c.verdict === "fail")
        .map((c) => c.id)
        .sort()
    ).toEqual(["exit_containment", "late_apex", "out_in_out", "stop_within_sight"]);

    // the figure's road is the bookDecreasing expansion (one taper corner)
    expect(env.road.corners).toHaveLength(1);
    expect(env.road.corners[0]!.r_min).toBeCloseTo(9, 6);
  });
});

describe("G-8.5-RED (fig-08-05.scene bake — good refuses; late solves the runoff, engine truth)", () => {
  it("the bake is total: good refuses (no_two_touch_line); late solves runoff — run_wide_detect then off_road, corrective infeasible (departed_before_reaction)", { timeout: 600_000 }, () => {
    const env = bake("fig-08-05.scene");
    expect(env.lines).toHaveLength(2);

    // good still refuses under adj-doubleapex (the per-line good pins are it.todo)
    const good = refusalOf(env, "good");
    expect(good.error.code).toBe("NO_SOLUTION");
    expect(good.error.detail?.["sub_reason"]).toBe("no_two_touch_line");
    const window = good.error.detail?.["window"] as { corner_ids: string[] };
    expect(window.corner_ids).toEqual(["c1", "c2", "c3"]);

    // late now SOLVES the runoff (adj-fig-08-05): the under-read believed world
    // leaves no reaction time, so the line departs the outer edge before a
    // corrective shot can launch — its run-wide bookmark carries the mistake.
    const late = lineOf(env, "late");
    expect(late.verdict.outcome).toBe("runoff");
    expect(late.verdict.quality).toBe("failing");
    expect(late.trajectory.terminated.reason).toBe("off_road");
    expect(late.verdict.misjudgment?.s_divergence_m).toBe(10);
    const lc = late.verdict.corners.find((c) => c.corrective != null)!.corrective!;
    expect(lc.feasible).toBe(false);
    expect(lc.fail_reason).toBe("departed_before_reaction");
    expect(lc.detect.s).toBeCloseTo(15.81, 1);
    expect(late.trajectory.events.some((e) => e.kind === "run_wide_detect")).toBe(true);
    expect(late.trajectory.events.some((e) => e.kind === "correction")).toBe(false);
  });

  it.todo("G-8.5-RED as designed — double: 2 apexes in the taper corner; good: 1 in c1 + 1 in c3; wrong_strategy_for_corner fail on double; colours per 06 §5.1 — lands when the A-DOUBLEAPEX and believed-band seams are ratified/resolved");
});
