// test/golden/scenes.test.ts — WP-17: the two shipped misjudgment scene bakes,
// G-8.5-RED (figures/fig-08-05.scene) and G-8.4-COMPANION
// (figures/fig-08-04.scene), design/09 §3.2.
//
// ENGINE-TRUTH STATE (post fix/adjudication phases — the bookDecreasing
// empty-clean-band seam is RESOLVED; the A-DOUBLEAPEX seam still stands):
//   fig-08-04 `good`  → SOLVES: contained/good, ONE late apex (the clean band
//                       at 34 km/h is non-empty on this engine now),
//   fig-08-04 `bad`   → overspeed:by_kmh=2.5 (fig84 amendment): wide/failing —
//                       a marginal overspeed pushed wide off the tightening exit,
//   fig-08-05 `good`  → SOLVES: contained/caution via the CHAINED solver. The
//                       scene no longer asks for `style=double_apex`, which
//                       refuses no_two_touch_line on bookDoubleApex at every
//                       entry probed 18–36 km/h (the A-DOUBLEAPEX SEAM — a
//                       solver capability gap, not an at-this-speed fact). The
//                       `caution` grade is corner-scoped doctrine reading the
//                       linking c2 as its own corner: a late_apex fail at 5% of
//                       c2's sweep. That IS the compound-corner lesson.
//   fig-08-05 `early` → SOLVES runoff/failing: `mistake premature` turns in
//                       10 m early, apexes c1 at 51% of sweep hard on the
//                       inside, then runs wide in c2 and off the outside edge;
//                       corrective infeasible (departed_before_reaction).
// Under design/05 §7 the bake stays TOTAL either way: refusals are first-class
// typed entries, refused lines draw nothing, and the envelope still bakes.
// G-8.4-COMPANION and G-8.5-RED both pin the SOLVED engine truth now.

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

describe("G-8.5-RED (fig-08-05.scene bake — chained good contains; the early apex runs off in c2)", () => {
  it("the bake is total: good rides all three corners contained-but-caution; early apexes c1 at 51% of sweep then departs the outside edge in c2, corrective infeasible (departed_before_reaction)", { timeout: 600_000 }, () => {
    const env = bake("fig-08-05.scene");
    expect(env.lines).toHaveLength(2);

    // `good` is the CHAINED line, not the two-touch one: `style=double_apex`
    // refuses on bookDoubleApex at every entry speed probed 18–36 km/h (the
    // A-DOUBLEAPEX SEAM, solve/doubleApex.ts header — the compound-window
    // drift arithmetic cannot widen back out to c2's inside edge), so the
    // scene asks for the line the engine can actually stand behind.
    const good = lineOf(env, "good");
    expect(good.verdict.outcome).toBe("contained");
    expect(good.trajectory.terminated.reason).toBe("road_end");
    // …and it is graded `caution`, not `good`: the corner-scoped doctrine reads
    // the linking c2 as a corner of its own, so c2's apex at 5% of ITS sweep is
    // a late_apex fail. That grade is the figure's lesson, not a defect —
    // apexing each corner in turn is already compromised on a compound corner.
    expect(good.verdict.quality).toBe("caution");
    const c2 = good.verdict.corners.find((c) => c.id === "c2")!;
    expect(c2.apexes).toHaveLength(1);
    expect(c2.apexes[0]!.pct).toBeCloseTo(5.0, 1);
    expect(good.verdict.corners.every((c) => c.ran_wide === false)).toBe(true);

    // `early` is `mistake premature` — the kind D25 renamed from `early_apex`.
    // It turns in 10 m sooner, touches the inside of c1 at 51% of sweep (an
    // apex barely off the kerb, f ≈ 0.02), and the geometry that hands it into
    // c2 is unrideable: run_wide_detect, then off the outside edge before c3.
    const early = lineOf(env, "early");
    expect(early.verdict.outcome).toBe("runoff");
    expect(early.verdict.quality).toBe("failing");
    expect(early.trajectory.terminated.reason).toBe("off_road");
    expect(early.verdict.diagnosis?.cause).toBe("plan_gap");
    expect(early.verdict.diagnosis?.detail?.["mistake_kind"]).toBe("premature");
    expect(early.verdict.diagnosis?.detail?.["early_by_m"]).toBe(10);

    const ec1 = early.verdict.corners.find((c) => c.id === "c1")!;
    expect(ec1.apexes).toHaveLength(1);
    expect(ec1.apexes[0]!.pct).toBeCloseTo(51.2, 1); // early — the 50% bar is the late_apex boundary
    expect(ec1.apexes[0]!.f).toBeLessThan(0.05); // hard on the inside edge
    // c1 itself still contains; the cost lands one corner later
    expect(ec1.ran_wide).toBe(false);
    const ec2 = early.verdict.corners.find((c) => c.id === "c2")!;
    expect(ec2.ran_wide).toBe(true);

    const corrective = ec2.corrective!;
    expect(corrective.feasible).toBe(false);
    expect(corrective.fail_reason).toBe("departed_before_reaction");
    expect(corrective.detect.s).toBeCloseTo(29.59, 1);
    expect(early.trajectory.events.some((e) => e.kind === "run_wide_detect")).toBe(true);
    expect(early.trajectory.events.some((e) => e.kind === "correction")).toBe(false);
  });

  it.todo("G-8.5-RED with a TWO-TOUCH ideal — 2 apexes across the c1..c3 window, wrong_strategy_for_corner fail on a single-apex alternative — lands if/when the A-DOUBLEAPEX compound-window drift arithmetic is resolved");
});
