// test/render/gate.test.ts — WP-17 gates (design/09 §5.2/§5.3/§7; ARCHITECTURE
// §6.5 + §7):
//
//   proportion gate on ALL SIX baked book scenes in TRUE mode — the v0.1 exit
//   gate (00 §3; ARCHITECTURE §6.5 pins that 00 §3's true-mode line wins over
//   09 §10's diagram-mode line, which lands with the projection):
//     * every scene re-bakes IN-PROCESS through the same pure verb the CLI
//       runs (`figure <scene> --mode true`), byte-identical to the COMMITTED
//       artifacts under linelab/figures/ (bake staleness is a failure);
//     * the manifest sidecar metrics recompute from the DrawnScene AND
//       re-derive from the SVG geometry itself (§5.2 audit mode — the
//       renderer cannot self-certify);
//     * out-of-band in true mode is a WARNING, never a block (§5.2); the
//       in-band metrics carry real teeth (width_ratio bands, road_ink floors,
//       frame_aspect band) and every metric is VALUE-pinned so any drift is a
//       deliberate re-bake.
//   A-ESSES-GATE (true-mode leg) — fig-08-06's manifest records orient: 90
//     (AUTHORED — bookEsses' elongation 1.153 sits under the 1.25 auto
//     threshold, so the scene fixes the heading).
//   A-FIG81-ENDPOINT — the failing line's endpoint sits AT its termination,
//     inside the drawn window — never wandering in the grass, never exiting
//     the frame uncropped (09 §7's standing rubric sentence, mechanical).
//   T-JUDGE-RECORD — committed figures/<id>.judge.json records: structure +
//     spec_hash/svg_fnv1a match + judge identity matches verify/judge.json.
//     D36: real judging landed — `verdicts: "pending"` is no longer
//     tolerated. Each record's `verdicts` carries the full §7.3 shape
//     (3 independent `attempts`, each covering every rubric item once, plus
//     per-item majority `items` with `flaky` on any non-unanimous split,
//     plus the overall `verdict`); the test recomputes the 2-of-3 majority
//     and the fail-iff-any-item-fails overall verdict independently from the
//     raw attempts and asserts they match the recorded values. It does NOT
//     require every item to pass — failed criteria are honest findings and
//     are asserted present, not papered over.
//
// Declaration-gate exits pinned per scene (engine truth after the fix/
// adjudication phases — see test/golden/scenes.test.ts): fig-08-01/02/03/04
// exit 0 (fig-08-02's quick_steer now fails as designed — SEAM-QS-TRUNCATION
// resolved; fig-08-04's lines now solve — the bookDecreasing empty-clean-band
// seam resolved), fig-08-05 exit 3 (refused lines — the A-DOUBLEAPEX and
// believed-band seams stand), fig-08-06 exit 3 (chain quality caution).

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { figureVerb } from "../../src/cli/verbs/figure.js";
import { ENGINE_SEMVER } from "../../src/solve/run.js";
import { isLineRefusal } from "../../src/solve/envelope.js";
import type { FigureResult, LineResult } from "../../src/solve/types.js";
import { lowerScene } from "../../src/plan/scene.js";
import { specHash } from "../../src/plan/figure.js";
import type { FigureSpec } from "../../src/plan/types.js";
import { renderViews, computeProportionMetrics, gateProportions } from "../../src/render/index.js";
import type { ManifestRecord } from "../../src/render/index.js";
import type { DrawnScene } from "../../src/render/scene.js";
import type { ComposedRoad } from "../../src/road/types.js";
import { fnv1a } from "../../src/core/hash.js";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "../..");
const scenesDir = resolve(repoRoot, "../figures"); // scene SOURCES (design of record, read-only)
const bakedDir = join(repoRoot, "figures"); // bake OUTPUTS (WP-17-owned)

const FIGURE_IDS = ["fig-08-01", "fig-08-02", "fig-08-03", "fig-08-04", "fig-08-05", "fig-08-06"] as const;
type FigureId = (typeof FIGURE_IDS)[number];

/** pinned declaration-gate exit per scene (header note). */
const PINNED_EXIT: Record<FigureId, 0 | 3> = {
  "fig-08-01": 0,
  "fig-08-02": 0,
  "fig-08-03": 0,
  "fig-08-04": 0,
  "fig-08-05": 3,
  "fig-08-06": 3
};

// ---------------------------------------------------------------------------
// One in-process re-bake per scene (memoized) — the same pure verb the CLI
// shell runs, with the same argv the committed bake used.

interface Bake {
  readonly exit: number;
  readonly envelope: FigureResult;
  readonly svg: string;
  readonly manifest: ManifestRecord;
  readonly scene: DrawnScene;
  readonly spec: FigureSpec;
}

const bakes = new Map<FigureId, Bake>();

function bake(id: FigureId): Bake {
  const have = bakes.get(id);
  if (have !== undefined) return have;
  const sceneText = readFileSync(join(scenesDir, `${id}.scene`), "utf8");
  const outcome = figureVerb({
    loadedText: sceneText,
    argv: ["--mode", "true", "--out", `stage/${id}`],
    engineSemver: ENGINE_SEMVER
  });
  const writes = outcome.writes ?? [];
  const svgWrite = writes.find((w) => w.path.endsWith(`${id}.svg`));
  const manifestWrite = writes.find((w) => w.path.endsWith("manifest.json"));
  if (svgWrite === undefined || manifestWrite === undefined) {
    throw new Error(`${id}: bake produced no svg/manifest (exit ${outcome.exit}, stdout ${JSON.stringify(outcome.stdout).slice(0, 300)})`);
  }
  const envelope = (outcome.stdout as { value: FigureResult }).value;

  // mirror the verb's render composition to obtain the DrawnScene (labels on
  // refused lines are dropped — design/05 §7 "refused lines draw nothing")
  const specR = lowerScene(sceneText);
  if (!specR.ok) throw new Error(`${id}: lowerScene refused`);
  const spec = specR.value;
  const fileView = typeof spec.view === "object" && spec.view !== null ? (spec.view as Record<string, unknown>) : {};
  const refusedIds = new Set(envelope.lines.filter((l) => isLineRefusal(l)).map((l) => l.line_id));
  const drawable = spec.labels?.filter((lb) => !refusedIds.has(lb.line));
  const lines = envelope.lines.filter((l): l is LineResult => !isLineRefusal(l));
  const rendered = renderViews({
    road: envelope.road as unknown as ComposedRoad,
    lines,
    viewSpec: { ...fileView, mode: "true" },
    ...(drawable !== undefined ? { labels: drawable } : {}),
    marks: spec.marks ?? "auto"
  });
  if (!rendered.ok) throw new Error(`${id}: mirror render refused: ${JSON.stringify(rendered.error)}`);
  // the mirror must reproduce the verb's own bytes, or the scene below is not
  // the scene that was gated
  if (rendered.value.svg !== svgWrite.content) throw new Error(`${id}: mirror render diverged from the verb's SVG`);

  const result: Bake = {
    exit: outcome.exit,
    envelope,
    svg: svgWrite.content,
    manifest: JSON.parse(manifestWrite.content) as ManifestRecord,
    scene: rendered.value.scene,
    spec
  };
  bakes.set(id, result);
  return result;
}

const committedSvg = (id: FigureId): string => readFileSync(join(bakedDir, `${id}.svg`), "utf8");
const committedManifest = (): readonly ManifestRecord[] =>
  JSON.parse(readFileSync(join(bakedDir, "manifest.json"), "utf8")) as ManifestRecord[];

// ---------------------------------------------------------------------------
// §5.2 audit-mode helpers: re-derive road_ink / frame_aspect from the SVG text
// alone (viewBox + the data-stage="2-road-surface" polygon), independent of
// the sidecar and of the DrawnScene.

function svgViewBox(svg: string): { w: number; h: number } {
  const m = /viewBox="([-\d.e]+) ([-\d.e]+) ([-\d.e]+) ([-\d.e]+)"/.exec(svg);
  if (m === null) throw new Error("no viewBox");
  return { w: Number(m[3]), h: Number(m[4]) };
}

function shoelace(pts: readonly { readonly x: number; readonly y: number }[]): number {
  let area = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i]!;
    const b = pts[(i + 1) % pts.length]!;
    area += a.x * b.y - b.x * a.y;
  }
  return Math.abs(area) / 2;
}

function svgRoadPolygonArea(svg: string): number {
  const m = /<polygon points="([^"]+)"[^>]*data-stage="2-road-surface"/.exec(svg);
  if (m === null) throw new Error("no road-surface polygon");
  const pts = m[1]!.split(" ").map((pair) => {
    const [x, y] = pair.split(",").map(Number);
    return { x: x!, y: y! };
  });
  return shoelace(pts);
}

/** §5.2 true-mode policy: out-of-band is a WARNING — nothing blocks. */
function trueModeVerdict(raw: "pass" | "warn" | "fail"): "pass" | "warn" {
  return raw === "pass" ? "pass" : "warn";
}

function straightLenM(road: ComposedRoad): number {
  return road.segments.filter((s) => s.type === "straight").reduce((sum, s) => sum + s.len_m, 0);
}

// ---------------------------------------------------------------------------
// Value pins (true-scale measured values of the committed presets under this
// renderer — any drift is a deliberate re-bake; ±0.005)

interface MetricPins {
  readonly width_ratio: readonly number[];
  readonly straight_share: number;
  readonly road_ink: number;
  readonly frame_aspect: number;
  readonly verdict: "pass" | "warn" | "fail";
  readonly orient: 0 | 90 | 180 | 270;
}

const PINS: Record<FigureId, MetricPins> = {
  "fig-08-01": { width_ratio: [0.583], straight_share: 0.598, road_ink: 0.377, frame_aspect: 0.872, verdict: "fail", orient: 0 },
  "fig-08-02": { width_ratio: [0.583], straight_share: 0.598, road_ink: 0.377, frame_aspect: 0.872, verdict: "fail", orient: 0 },
  "fig-08-03": { width_ratio: [0.583], straight_share: 0.598, road_ink: 0.377, frame_aspect: 0.872, verdict: "fail", orient: 0 },
  "fig-08-04": { width_ratio: [0.56], straight_share: 0.459, road_ink: 0.368, frame_aspect: 0.772, verdict: "warn", orient: 0 },
  "fig-08-05": { width_ratio: [0.583, 0.292, 0.583], straight_share: 0.323, road_ink: 0.43, frame_aspect: 0.719, verdict: "fail", orient: 0 },
  "fig-08-06": { width_ratio: [0.583, 0.583, 0.583, 0.583], straight_share: 0.365, road_ink: 0.173, frame_aspect: 0.737, verdict: "fail", orient: 90 }
};

// ---------------------------------------------------------------------------

describe("the six book-figure bakes (ARCHITECTURE §6.5 — `figure <scene> --mode true`)", () => {
  for (const id of FIGURE_IDS) {
    it(`${id}: re-bake is byte-identical to the committed artifacts; declaration-gate exit pinned`, { timeout: 600_000 }, () => {
      const b = bake(id);
      expect(b.exit, `${id} exit`).toBe(PINNED_EXIT[id]);
      // Staleness tripwire. This is the ONE assertion that goes red the moment
      // the renderer changes and the committed artifacts have not been
      // re-baked. Clearing it is a single atomic operation — re-bake the six
      // SVGs + manifest AND re-run the D36 judge, because `T-JUDGE-RECORD`
      // below pins each judge record's `svg_fnv1a` to the COMMITTED SVG's
      // bytes; re-baking without re-judging just moves the red.
      expect(b.svg, `${id}: baked SVG differs from figures/${id}.svg — the committed bake is stale (re-bake + re-judge)`).toBe(
        committedSvg(id)
      );
      const record = committedManifest().find((r) => r.figure_id === id);
      expect(record).toBeDefined();
      expect(b.manifest).toEqual(record);
      // identity: the manifest's spec_hash is the lowered scene's spec_hash
      expect(b.manifest.spec_hash).toBe(specHash(b.spec));
      expect(b.manifest.mode).toBe("true");
    });
  }

  it("the committed bake directory holds exactly the six SVGs + manifest.json + six judge records (+ the png/ raster dir the D36 judge consumes)", () => {
    const files = readdirSync(bakedDir).sort();
    expect(files).toEqual(
      [...FIGURE_IDS.map((id) => `${id}.svg`), ...FIGURE_IDS.map((id) => `${id}.judge.json`), "manifest.json", "png"].sort()
    );
  });
});

describe("proportion gate on the six true-mode bakes (design/09 §5.2/§5.3; 00 §3's v0.1 exit gate)", () => {
  for (const id of FIGURE_IDS) {
    it(`${id}: sidecar metrics recompute from the scene AND audit from the SVG; values pinned; out-of-band never blocks in true mode`, { timeout: 600_000 }, () => {
      const b = bake(id);
      const road = b.envelope.road as unknown as ComposedRoad;

      // sidecar recompute (scene → metrics → verdict must equal the manifest)
      const metrics = computeProportionMetrics(b.scene, road.corners, straightLenM(road));
      expect(metrics).toEqual(b.manifest.proportion_metrics);
      const gate = gateProportions(metrics);
      expect(gate.verdict).toBe(b.manifest.gate_verdict);

      // §5.2 audit mode: re-derive from the SVG text, independent of the
      // sidecar. The renderer's viewBox is the frame × its 1.08 presentation
      // margin (render/topdown.ts's local `pad`), except where rotated
      // content exceeds the pre-rotation frame (fig-08-06's orient-90 regime
      // — recorded deviation: scene.frame is pre-rotation, the viewBox holds
      // the rotated content; both aspects sit inside the 06 §6.1 band).
      const vb = svgViewBox(b.svg);
      const auditRoadArea = svgRoadPolygonArea(b.svg);
      // (1) the DRAWN road area equals the measured road polygon's area — the
      // ink numerator audited from the artifact bytes alone
      const sceneRoadArea = shoelace([...b.scene.road.left, ...[...b.scene.road.right].reverse()]);
      expect(Math.abs(auditRoadArea - sceneRoadArea)).toBeLessThanOrEqual(1e-6 * Math.max(1, sceneRoadArea));
      // (2) frame honesty
      const PAD = 1.08; // render/topdown.ts's own presentation constant
      if (id !== "fig-08-06") {
        expect(Math.abs(vb.w / vb.h - metrics.frame_aspect)).toBeLessThanOrEqual(0.001);
        const auditInk = (auditRoadArea / (vb.w * vb.h)) * PAD * PAD;
        expect(Math.abs(auditInk - metrics.road_ink)).toBeLessThanOrEqual(0.001);
      } else {
        // rotated-content regime: the viewBox strictly contains the frame, so
        // the drawn ink can only be SPARSER than the sidecar claims
        expect(auditRoadArea / (vb.w * vb.h)).toBeLessThanOrEqual(metrics.road_ink);
        expect(vb.w / vb.h).toBeGreaterThanOrEqual(0.55);
        expect(vb.w / vb.h).toBeLessThanOrEqual(1.8);
      }

      // value pins (±0.005 — drift is a deliberate re-bake)
      const pins = PINS[id];
      expect(metrics.width_ratio.map((w) => w.value).length).toBe(pins.width_ratio.length);
      metrics.width_ratio.forEach((w, i) => expect(Math.abs(w.value - pins.width_ratio[i]!), `${id} width_ratio[${i}]`).toBeLessThanOrEqual(0.005));
      expect(Math.abs(metrics.straight_share - pins.straight_share)).toBeLessThanOrEqual(0.005);
      expect(Math.abs(metrics.road_ink - pins.road_ink)).toBeLessThanOrEqual(0.005);
      expect(Math.abs(metrics.frame_aspect - pins.frame_aspect)).toBeLessThanOrEqual(0.005);
      expect(b.manifest.gate_verdict).toBe(pins.verdict);
      expect(b.manifest.view.orient).toBe(pins.orient);

      // the true-mode law (§5.2): out-of-band is a warning, never a block
      expect(["pass", "warn"]).toContain(trueModeVerdict(gate.verdict));

      // band teeth that DO hold at true scale (§5.3 "the presets keep the
      // projection mild" — a preset needing violent compression is wrong):
      //   frame_aspect in band on every figure
      expect(metrics.frame_aspect).toBeGreaterThanOrEqual(0.55);
      expect(metrics.frame_aspect).toBeLessThanOrEqual(1.8);
      //   width_ratio in the 06 band on every R≤16 teaching corner (the ONE
      //   exception: fig-08-05's R24 opening middle — honest true scale,
      //   asserted against its own geometry below)
      metrics.width_ratio.forEach((w, i) => {
        if (id === "fig-08-05" && i === 1) {
          expect(Math.abs(w.value - (2 * road.lane_width_m) / 24)).toBeLessThanOrEqual(0.001);
        } else {
          expect(w.value, `${id} width_ratio[${i}]`).toBeGreaterThanOrEqual(0.45);
          expect(w.value, `${id} width_ratio[${i}]`).toBeLessThanOrEqual(0.95);
        }
      });
      //   road-ink floors: single-corner 0.25; multi-corner 0.20; the
      //   portrait four-corner ess is genuinely sparse at TRUE scale
      //   (0.173) — its 0.20 floor is the DIAGRAM-mode A-ESSES-GATE leg,
      //   deferred with the projection (ARCHITECTURE §6.5); the true-mode
      //   nearness floor applied here is 0.15 (recorded WP-17 judgment).
      const floor = id === "fig-08-06" ? 0.15 : road.corners.length > 1 ? 0.2 : 0.25;
      expect(metrics.road_ink, `${id} road_ink`).toBeGreaterThanOrEqual(floor);
    });
  }
});

describe("A-ESSES-GATE — true-mode leg (design/09 §5.3)", () => {
  it("fig-08-06's manifest records orient: 90 — AUTHORED by the scene, not auto-orientation — and the lowered spec carries the pin", { timeout: 600_000 }, () => {
    const b = bake("fig-08-06");
    expect(b.manifest.view.orient).toBe(90);
    const view = b.spec.view as Record<string, unknown>;
    expect(String(view["orient"])).toBe("90");
    // the four esses corners all drawn; the committed record agrees
    const record = committedManifest().find((r) => r.figure_id === "fig-08-06")!;
    expect(record.view.orient).toBe(90);
    expect(b.manifest.proportion_metrics.width_ratio).toHaveLength(4);
  });
});

describe("A-FIG81-ENDPOINT (design/09 §7 — the standing rubric sentence, mechanical)", () => {
  it("fig-08-01's failing line ends AT its termination, inside the drawn window and inside the drawn geometry — never in the grass, never uncropped", { timeout: 600_000 }, () => {
    const b = bake("fig-08-01");
    const bad = b.scene.lines.find((l) => l.line_id === "bad");
    expect(bad).toBeDefined();
    expect(bad!.outcome).toBe("runoff");

    const lastVertex = bad!.polyline[bad!.polyline.length - 1]!;
    // the drawn endpoint IS the terminal glyph's anchor
    expect(Math.abs(lastVertex.x - bad!.terminal.at.x)).toBeLessThanOrEqual(1e-6);
    expect(Math.abs(lastVertex.y - bad!.terminal.at.y)).toBeLessThanOrEqual(1e-6);

    // the termination station is inside the drawn window (not cropped away)
    const badLine = b.envelope.lines.find((l) => l.line_id === "bad") as LineResult;
    expect(badLine.trajectory.terminated.reason).toBe("off_road");
    expect(badLine.trajectory.terminated.s).toBeGreaterThanOrEqual(b.scene.window.from_s);
    expect(badLine.trajectory.terminated.s).toBeLessThanOrEqual(b.scene.window.to_s);

    // and the endpoint sits within the drawn frame's geometry envelope: the
    // road bbox padded by one lane width bounds it (ON the edge, not off in
    // the grass)
    const xs = [...b.scene.road.left, ...b.scene.road.right].map((p) => p.x);
    const ys = [...b.scene.road.left, ...b.scene.road.right].map((p) => p.y);
    const pad = b.scene.road.lane_width_m;
    expect(lastVertex.x).toBeGreaterThanOrEqual(Math.min(...xs) - pad);
    expect(lastVertex.x).toBeLessThanOrEqual(Math.max(...xs) + pad);
    expect(lastVertex.y).toBeGreaterThanOrEqual(Math.min(...ys) - pad);
    expect(lastVertex.y).toBeLessThanOrEqual(Math.max(...ys) + pad);
  });
});

describe("T-JUDGE-RECORD (design/09 §7.4's deterministic CI stand-in)", () => {
  const identity = JSON.parse(readFileSync(join(repoRoot, "verify", "judge.json"), "utf8")) as {
    judge_model: string;
    judge_model_version: string;
    rubric_version: string;
    rubric: ReadonlyArray<{ id: string }>;
  };
  const rubricIds = identity.rubric.map((r) => r.id);
  const VERDICT_VALUES = ["pass", "fail", "na"] as const;
  type Verdict = (typeof VERDICT_VALUES)[number];

  interface AttemptItem {
    readonly id: string;
    readonly verdict: Verdict;
  }
  interface Attempt {
    readonly attempt: number;
    readonly items: ReadonlyArray<AttemptItem>;
    readonly evidence: string;
  }
  interface MajorityItem {
    readonly id: string;
    readonly verdict: Verdict;
    readonly flaky?: boolean;
  }
  interface Verdicts {
    readonly attempts: ReadonlyArray<Attempt>;
    readonly items: ReadonlyArray<MajorityItem>;
    readonly verdict: "pass" | "fail";
  }

  /** independent 2-of-3 majority recompute (design/09 §7.4): any non-unanimous split is flaky. */
  function recomputeMajority(votes: ReadonlyArray<Verdict>): { verdict: Verdict; flaky: boolean } {
    const counts = new Map<Verdict, number>();
    for (const v of votes) counts.set(v, (counts.get(v) ?? 0) + 1);
    const [winner] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
    const flaky = !(votes[0] === votes[1] && votes[1] === votes[2]);
    return { verdict: winner, flaky };
  }

  for (const id of FIGURE_IDS) {
    it(`${id}: judge record present; spec_hash + svg_fnv1a match the committed artifacts; identity matches verify/judge.json; verdicts recorded (no pending) with a self-consistent 2-of-3 majority`, () => {
      const record = JSON.parse(readFileSync(join(bakedDir, `${id}.judge.json`), "utf8")) as Record<string, unknown>;
      expect(Object.keys(record).sort()).toEqual(["figure_id", "judge_identity", "spec_hash", "svg_fnv1a", "verdicts"]);
      expect(record["figure_id"]).toBe(id);

      // spec_hash: recomputed via the same loader the bless/bake path uses
      const sceneText = readFileSync(join(scenesDir, `${id}.scene`), "utf8");
      const spec = lowerScene(sceneText);
      expect(spec.ok).toBe(true);
      if (spec.ok) expect(record["spec_hash"]).toBe(specHash(spec.value));

      // svg_fnv1a: the committed SVG's own bytes
      expect(record["svg_fnv1a"]).toBe(fnv1a(committedSvg(id)));

      // judge identity: exactly the pinned identity fields (D36 — a record
      // under any other identity is invalid)
      expect(record["judge_identity"]).toEqual({
        judge_model: identity.judge_model,
        judge_model_version: identity.judge_model_version,
        rubric_version: identity.rubric_version
      });

      // verdicts: real judging landed — "pending" is no longer a valid value.
      expect(record["verdicts"]).not.toBe("pending");
      expect(typeof record["verdicts"]).toBe("object");
      const verdicts = record["verdicts"] as Verdicts;

      // three independent attempts, each covering every rubric item exactly
      // once (in rubric order) with a valid verdict and non-empty evidence.
      expect(verdicts.attempts).toHaveLength(3);
      verdicts.attempts.forEach((attempt, idx) => {
        expect(attempt.attempt).toBe(idx + 1);
        expect(attempt.items.map((i) => i.id)).toEqual(rubricIds);
        for (const item of attempt.items) expect(VERDICT_VALUES).toContain(item.verdict);
        expect(typeof attempt.evidence).toBe("string");
        expect(attempt.evidence.length).toBeGreaterThan(0);
      });

      // per-item majority: covers every rubric item exactly once, and its
      // verdict/flaky are exactly the 2-of-3 majority recomputed from the
      // raw attempt votes — this is the check that keeps the recorded
      // majority honest against the underlying votes, not just self-declared.
      expect(verdicts.items.map((i) => i.id)).toEqual(rubricIds);
      for (const itemId of rubricIds) {
        const votes = verdicts.attempts.map(
          (a) => a.items.find((i) => i.id === itemId)!.verdict
        );
        const { verdict: expectedVerdict, flaky: expectedFlaky } = recomputeMajority(votes);
        const recorded = verdicts.items.find((i) => i.id === itemId)!;
        expect(recorded.verdict).toBe(expectedVerdict);
        expect(recorded.flaky ?? false).toBe(expectedFlaky);
      }

      // overall verdict (§7.2): "fail" iff any item fails; "na" never fails
      // a figure. Not hard-required to be "pass" — failed criteria are
      // honest findings, this only checks the aggregation is computed
      // correctly from what was recorded.
      const expectedOverall = verdicts.items.some((i) => i.verdict === "fail") ? "fail" : "pass";
      expect(verdicts.verdict).toBe(expectedOverall);
    });
  }
});
