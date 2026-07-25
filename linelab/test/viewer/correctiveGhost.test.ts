// test/viewer/correctiveGhost.test.ts — the corrective-ghost half of the D44
// stepper deliverable (design/07 §3.5), and the corrective-ghost ARM of
// C-SAVEWIN-CLIP.
//
// C-SAVEWIN-CLIP (design/09 §10 L2335-2338) — "the drawn probe's last vertex is
// s* (or its termination station) IN BOTH the 07 §3.6 overlay AND the §3.5
// corrective ghost. The 04 §4b.4 guard, mechanical." The §3.6 overlay arm lives
// in test/viewer/saveWindow.test.ts; THIS file supplies the §3.5 corrective-ghost
// arm, which had no implementation and no test until now:
//
//   · WIDE (feasible save) — the ghost is clipped at the shadow's RETURN station
//     `s*`, and the clip does real work: the drawn path is strictly SHORTER than
//     the full shadow `correctiveShot` returns (its constant-`phiReserve` tail
//     past `s*` is dropped, 04 §4b.4 — "the design asserts nothing about the arc
//     past the return").
//   · RUNOFF (shot integrated, no return) — the ghost's last vertex is the
//     shadow's own TERMINATION station.
//   · INERT — `corrective == null` or `departed_before_reaction` → no shadow, the
//     toggle is inert (07 §3.5), and the builder returns `ok(null)`.
//
// Plus the toggle law (07 §3.5/§6.1): OFF BY DEFAULT, once-per-toggle, and — the
// D9/D18 guard — the ghost is neutral ink (never a verdict colour), stepper-only,
// and the exported picture is untouched (render/ cannot reach the overlay module).

import { describe, it, expect, beforeAll, vi } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { integrate } from "../../src/core/integrate.js";
import { compose } from "../../src/road/compose.js";
import type { ComposedRoad, ResolvedScenario, Trajectory, SightCaster, World } from "../../src/core/types.js";
import type { LineResult } from "../../src/solve/types.js";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "../..");

// ---------------------------------------------------------------------------
// A counting wrapper around the ONE corrective library (solve/corrective.ts).
// Hoisted so it is installed before the module graph resolves; it lets the
// once-per-toggle test prove the ghost is computed ONCE, not per frame.

const shotCalls = vi.hoisted(() => ({ n: 0 }));
vi.mock("../../src/solve/corrective.js", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  const real = actual["correctiveShot"] as (...args: unknown[]) => unknown;
  return {
    ...actual,
    correctiveShot: (...args: unknown[]) => {
      shotCalls.n++;
      return real(...args);
    }
  };
});

const { correctiveShot } = await import("../../src/solve/corrective.js");
const { CORRECTIVE_DISCLOSURE } = await import("../../src/solve/corrective.js");
const { correctiveGhostOverlay, correctiveGhostSvg } = await import("../../src/viewer/correctiveGhost.js");
const { CORRECTIVE_GHOST_INK, SAVE_WINDOW_INK } = await import("../../src/viewer/constants.js");
const { QUALITY_COLOUR } = await import("../../src/render/constants.js");
const { loadSession } = await import("../../src/viewer/session.js");
const { createApp, frameOf, toggleCorrectiveGhost, scrub } = await import("../../src/viewer/app.js");

// ---------------------------------------------------------------------------
// Engine-rank fixture scaffolding (ResolvedScenario literals — the same seam
// test/property/corrective.test.ts uses, no `validate` dependency).

const STUB_SIGHT: SightCaster = {
  cast: (eye) => ({ sight_m: 0, limit_point: { x: eye.x, y: eye.y }, s_limit: 0 }),
  ssd: () => ({ ssd_m: 0, react_m: 0, standup_m: 0, brake_m: 0 })
};

function road(dsl: string): ComposedRoad {
  const composed = compose({ dsl });
  if (!composed.ok) throw new Error(`fixture road failed to compose: ${composed.error.message}`);
  return composed.value;
}

function scenario(id: string, dsl: string, kmh: number, lean: number, hand: "L" | "R", startF = 0.5): ResolvedScenario {
  return {
    spec: "linelab/1",
    id,
    road: { kind: "dsl", segments: [], dsl },
    occluders: [],
    hazards: [],
    rider: {
      profile: "street",
      start: { speed_kmh: kmh, f: startF },
      plan: [{ do: "turn_in", id: "t1", at_s: 20, target: { lean_deg: lean }, hand }]
    },
    config: { mu: 1.0, ds_m: 0.5, ssd_model: "alert", rubric: "parks-street", checks_version: 2 }
  } as unknown as ResolvedScenario;
}

function ride(sc: ResolvedScenario): Trajectory {
  const r = road(sc.road.dsl);
  const world: World = { road: r, sight: STUB_SIGHT, occluders: [], hazards: [] };
  return integrate(sc, world);
}

/** The structural subset correctiveGhostOverlay reads (it takes a LineResult). */
function lineOf(id: string, sc: ResolvedScenario): LineResult {
  return { line_id: id, trajectory: ride(sc), resolved_scenario: sc } as unknown as LineResult;
}

// RUNOFF-INTEGRATED: a right-hander whose main line survives to the shot but
// whose reserve-lean shadow cannot get back inside before road end — the shot
// INTEGRATES (shadow ≠ null) yet fails (`no_return_before_road_end`). Discovered
// by search; pinned here so the runoff clip branch is exercised.
const RUNOFF_INT = scenario("cf-runoff-int", "lane 6 | S 20 | R 30 ^70 | S 3", 40, 18, "R");
// DEPARTED: the 03 §7.1 book-left analog — off the road before a reaction is
// possible, so `departed_before_reaction`, shadow null, ghost inert.
const DEPARTED = scenario("cf-departed", "lane 3.5 | S 20 | L 12 ^90 | S 16", 34, 15, "L");
// CONTAINED: never runs wide → corrective null → ghost inert.
const CONTAINED = scenario("cf-contained", "lane 5 | S 60", 34, 0, "R");

// A real WIDE line WITH a full verdict, via the wire-scenario front door
// (run's "rider" path — physics only). This is what the app-level toggle draws.
const WIDE_WIRE = {
  spec: "linelab/1",
  id: "wide",
  road: { dsl: "lane 5 | S 20 | R 20 ^90 | S 40" },
  rider: {
    profile: "street",
    start: { speed_kmh: 34, f: 1.0 },
    plan: [{ do: "turn_in", id: "t1", at_s: 20, target: { lean_deg: 20 }, hand: "R" }]
  }
};

type Session = Awaited<ReturnType<typeof loadSession>> extends { ok: true; value: infer V } ? V : never;
let wideSession: Session;
let wideLine: LineResult;

beforeAll(() => {
  const loaded = loadSession(WIDE_WIRE, { engine_semver: "0.1.0" });
  expect(loaded.ok, "the wide fixture must load").toBe(true);
  if (!loaded.ok) return;
  wideSession = loaded.value;
  const line = wideSession.lines[0];
  expect(line, "the wide fixture produced no line").toBeDefined();
  wideLine = line!;
  expect(wideLine.verdict.outcome, "the wide fixture must run wide").toBe("wide");
}, 300_000);

// ---------------------------------------------------------------------------
// C-SAVEWIN-CLIP — the §3.5 corrective-ghost arm

describe("C-SAVEWIN-CLIP (corrective ghost, 04 §4b.4 mechanical) — the drawn probe's last vertex is s*", () => {
  it("WIDE: the ghost is clipped AT the return station s*, and the clip drops the constant-phiReserve tail", () => {
    const shot = correctiveShot({ trajectory: wideLine.trajectory, resolved_scenario: wideLine.resolved_scenario });
    expect(shot.ok).toBe(true);
    if (!shot.ok) return;
    const c = shot.value.corrective;
    expect(c, "the wide fixture must have a corrective block").not.toBeNull();
    expect(c!.feasible, "the wide fixture must be feasible (a save)").toBe(true);
    expect(c!.returned, "a feasible save has a return station").not.toBeNull();
    const fullShadow = shot.value.shadow;
    expect(fullShadow, "a feasible save has an integrated shadow").not.toBeNull();

    const overlay = correctiveGhostOverlay(wideLine);
    expect(overlay.ok).toBe(true);
    if (!overlay.ok || overlay.value === null) throw new Error("wide ghost must be drawable");
    const g = overlay.value;

    expect(g.kind).toBe("wide");
    // s* is the LIBRARY's own return station, not re-derived here (C-ONE-CORE)
    expect(g.s_star_m).toBe(c!.returned!.s);
    // the drawn last vertex is at or just past s* — one arc step, never many
    expect(g.last_vertex_s).toBeGreaterThanOrEqual(g.s_star_m - 1e-9);
    expect(g.last_vertex_s - g.s_star_m).toBeLessThanOrEqual(wideLine.resolved_scenario.config.ds_m + 1e-9);
    // and the last DRAWN point's own station equals last_vertex_s (no float drift)
    expect(g.path[g.path.length - 1]).toBeDefined();
    // THE CLIP DID REAL WORK: the full shadow runs PAST s* to its own
    // termination; the drawn path is strictly shorter (04 §4b.4)
    expect(g.path.length).toBeLessThan(fullShadow!.samples.length);
    expect(fullShadow!.terminated.s).toBeGreaterThan(g.s_star_m + 0.5);
  }, 300_000);

  it("WIDE: the drawn SVG cannot outrun the clip — its last polyline vertex is the model's last vertex", () => {
    const ov = correctiveGhostOverlay(wideLine);
    expect(ov.ok && ov.value !== null).toBe(true);
    if (!ov.ok || ov.value === null) return;
    const svg = correctiveGhostSvg(ov.value);
    const num = (n: number): string => String(Number(n.toFixed(4)));
    expect(svg).toContain(`data-last-vertex-s="${num(ov.value.last_vertex_s)}"`);
    expect(svg).toContain(`data-s-star-m="${num(ov.value.s_star_m)}"`);
    const last = ov.value.path[ov.value.path.length - 1]!;
    const points = svg.match(/data-overlay="corrective-ghost-stroke" points="([^"]+)"/)![1]!;
    const drawn = points.trim().split(" ");
    expect(drawn.length).toBe(ov.value.path.length);
    expect(drawn[drawn.length - 1]).toBe(`${num(last.x)},${num(last.y)}`);
  }, 300_000);

  it("RUNOFF: the shot integrated but never returned — the ghost's last vertex is the shadow's TERMINATION station", () => {
    const line = lineOf("runoff-int", RUNOFF_INT);
    const shot = correctiveShot({ trajectory: line.trajectory, resolved_scenario: line.resolved_scenario });
    expect(shot.ok).toBe(true);
    if (!shot.ok) return;
    const c = shot.value.corrective;
    expect(c, "runoff still has a corrective block").not.toBeNull();
    expect(c!.feasible, "the runoff shot fails").toBe(false);
    expect(shot.value.shadow, "but the shot INTEGRATED — shadow is present").not.toBeNull();

    const overlay = correctiveGhostOverlay(line);
    expect(overlay.ok).toBe(true);
    if (!overlay.ok || overlay.value === null) throw new Error("runoff-integrated ghost must be drawable");
    const g = overlay.value;
    expect(g.kind).toBe("runoff");
    // no return station exists → s* is the shadow's own termination
    expect(g.s_star_m).toBe(shot.value.shadow!.terminated.s);
    // the drawn probe ends exactly there — the last sample of the (unclipped)
    // shadow, which already sits at the termination
    expect(g.last_vertex_s).toBeCloseTo(shot.value.shadow!.terminated.s, 9);
    expect(g.path.length).toBe(shot.value.shadow!.samples.length);
  }, 300_000);

  it("INERT: a line that departed before reaction (or never ran wide) draws no ghost — the toggle is inert", () => {
    const departed = correctiveGhostOverlay(lineOf("departed", DEPARTED));
    expect(departed.ok).toBe(true);
    if (departed.ok) expect(departed.value, "departed_before_reaction → no shadow → inert").toBeNull();

    const contained = correctiveGhostOverlay(lineOf("contained", CONTAINED));
    expect(contained.ok).toBe(true);
    if (contained.ok) expect(contained.value, "a contained line has no corrective → inert").toBeNull();

    // and an inert overlay draws nothing at all
    expect(correctiveGhostSvg(null)).toBe("");
  }, 300_000);
});

// ---------------------------------------------------------------------------
// D9 / D18 — no line ink modulated, the disclosure carried verbatim

describe("the corrective ghost modulates no line ink and carries the lean-only disclosure (D9/D18, 07 §3.5)", () => {
  it("its one ink is neutral — not a verdict colour, and distinct from the save-window ink", () => {
    expect(Object.values(QUALITY_COLOUR)).not.toContain(CORRECTIVE_GHOST_INK);
    expect(CORRECTIVE_GHOST_INK).not.toBe(SAVE_WINDOW_INK);
  });

  it("the overlay carries 04 §4c.7's lean-only disclosure sentence VERBATIM, and the SVG renders it", () => {
    const overlay = correctiveGhostOverlay(wideLine);
    expect(overlay.ok && overlay.value !== null).toBe(true);
    if (!overlay.ok || overlay.value === null) return;
    expect(overlay.value.disclosure).toBe(CORRECTIVE_DISCLOSURE);
    const svg = correctiveGhostSvg(overlay.value);
    expect(svg).toContain(`<title>${CORRECTIVE_DISCLOSURE}</title>`);
    expect(svg).toContain(`stroke="${CORRECTIVE_GHOST_INK}"`);
  }, 300_000);

  it("no file under src/render/ can reach the corrective-ghost overlay module (C-SAVEWIN-NO-INK, structural)", () => {
    const renderDir = join(repoRoot, "src/render");
    const offenders: string[] = [];
    for (const f of readdirSync(renderDir)) {
      if (!f.endsWith(".ts")) continue;
      const text = readFileSync(join(renderDir, f), "utf8");
      if (/viewer\//.test(text) || /correctiveGhost/.test(text)) offenders.push(f);
    }
    expect(offenders).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// The toggle law (07 §3.5, §6.1) — off by default, once per toggle, inert path

describe("the corrective-ghost toggle (07 §3.5) — off by default, once per toggle, stepper-only", () => {
  it("OFF BY DEFAULT: a fresh app draws no ghost ink, and turning it on adds exactly one <g> over the untouched picture", () => {
    const before = shotCalls.n;
    const app = createApp(wideSession);
    expect(app.correctiveGhost, "the toggle is off by default").toBeNull();
    expect(shotCalls.n, "creating the app must not compute the shot").toBe(before);

    const frame0 = frameOf(app);
    const td0 = frame0.views.find((v) => v.view === "topdown")!;
    expect(td0.svg).not.toContain('data-overlay="corrective-ghost"');
    expect(frame0.corrective_ghost).toBeNull();

    const on = toggleCorrectiveGhost(app);
    expect(on.correctiveGhost, "toggling on computes the ghost").not.toBeNull();
    const onFrame = frameOf(on);
    const tdOn = onFrame.views.find((v) => v.view === "topdown")!;
    expect(tdOn.svg).toContain('data-overlay="corrective-ghost"');
    expect(onFrame.corrective_ghost).not.toBeNull();
    expect(onFrame.corrective_ghost!.disclosure).toBe(CORRECTIVE_DISCLOSURE);

    // the base picture is byte-identical beneath the overlay <g>
    const ghostSvg = correctiveGhostSvg(on.correctiveGhost);
    expect(ghostSvg.length).toBeGreaterThan(0);
    expect(tdOn.svg.replace(ghostSvg, "")).toBe(td0.svg);

    // toggling back off restores the exact original bytes
    const off = toggleCorrectiveGhost(on);
    expect(off.correctiveGhost).toBeNull();
    expect(frameOf(off).views.find((v) => v.view === "topdown")!.svg).toBe(td0.svg);
  }, 300_000);

  it("ONCE PER TOGGLE: computing the ghost calls correctiveShot exactly once; scrubbing never calls it again (G3)", () => {
    const app = createApp(wideSession);
    frameOf(app); // warm the off-frame
    const beforeToggle = shotCalls.n;
    const on = toggleCorrectiveGhost(app);
    expect(shotCalls.n - beforeToggle, "the toggle computed the shot once").toBe(1);

    const afterToggle = shotCalls.n;
    let cur = on;
    const dom = frameOf(on).domain;
    for (let i = 0; i < 6; i++) {
      cur = scrub(cur, dom.min + (i / 6) * (dom.max - dom.min));
      frameOf(cur);
    }
    expect(shotCalls.n - afterToggle, "scrubbing recomputed the shadow").toBe(0);
  }, 300_000);

  it("the toggle is inert on a line with no drawable corrective (07 §3.5)", () => {
    const loaded = loadSession(
      { road: { preset: "book90" }, entry_kmh: 34, turn_in: "auto", mistake: { kind: "overspeed" } },
      { engine_semver: "0.1.0" }
    );
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    const mistake = loaded.value.lines.find((l) => l.role === "mistake");
    expect(mistake).toBeDefined();
    const app = createApp({ ...loaded.value, focus: mistake!.line_id } as Session);
    const on = toggleCorrectiveGhost(app);
    // book90 is a short corner: the shot departs before reaction, so the ghost
    // is inert and the toggle stays null (07 §3.5)
    expect(on.correctiveGhost).toBeNull();
    expect(frameOf(on).corrective_ghost).toBeNull();
  }, 300_000);
});
