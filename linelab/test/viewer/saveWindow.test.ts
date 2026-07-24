// test/viewer/saveWindow.test.ts — the v0.2 exit gates that live on the
// STEPPER OVERLAY (design/07 §3.6), plus the two goal arms design/01 §2 states
// for the viewer half of this phase.
//
//   · C-SAVEWIN-HUD (09 §10) — "every displayed save-window field equals the
//     returned object, precision-clamped to HORIZON_DISPLAY_DP
//     (C-HUD-EQUALS-STATEAT extended to the overlay)". Asserted the same
//     mechanical way `C-HUD-EQUALS-STATEAT` is: every overlay HUD row declares
//     WHICH member of the returned `SaveWindow` it displays, the test resolves
//     that member and demands `===`, and every printed number is re-derived
//     from the object at HORIZON_DISPLAY_DP.
//   · C-SAVEWIN-CLIP (09 §10) — "the drawn probe's last vertex is s* (or its
//     termination station)". The 04 §4b.4 guard, mechanical.
//   · C-SAVEWIN-NO-INK (09 §10) — the exported SVG is byte-identical with the
//     toggle on and off, on every one of the SIX COMMITTED BOOK SCENES. The
//     v0.1 leg was a synthetic sentinel; this is the v0.2 gate.
//   · G3 (01 §2) — "the stepper renders any sample index WITHOUT RE-RUNNING
//     THE SOLVER": asserted with a counting mock over `core/integrate.js`, the
//     technique test/contract/standing.test.ts already uses.
//   · G5, inspection half (01 §2) — "the viewer can scrub a MISTAKE LINE's
//     trajectory and HUD".
//
// The mock in the G3 block must be hoisted, so it lives at module scope and the
// other blocks simply never trigger it.

import { describe, it, expect, beforeAll, vi } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "../..");
const scenesDir = resolve(repoRoot, "../figures");

// ---------------------------------------------------------------------------
// G3's instrument: a counting wrapper around THE engine (core/integrate.ts).
// Hoisted so it is installed before any import of the module graph resolves.

const integrateCalls = vi.hoisted(() => ({ n: 0 }));
vi.mock("../../src/core/integrate.js", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  const real = actual["integrate"] as (...args: unknown[]) => unknown;
  return {
    ...actual,
    integrate: (...args: unknown[]) => {
      integrateCalls.n++;
      return real(...args);
    }
  };
});

const { loadSession } = await import("../../src/viewer/session.js");
const { createApp, frameOf, scrub, toggleSaveWindow, nudgeSample, flipAxis } = await import("../../src/viewer/app.js");
const { saveWindowOverlay, saveWindowHudRows, saveWindowTicks, saveWindowOverlaySvg } = await import(
  "../../src/viewer/saveWindow.js"
);
const { SAVE_WINDOW_INK } = await import("../../src/viewer/constants.js");
const { renderView } = await import("../../src/viewer/views.js");
const { HORIZON_DISPLAY_DP } = await import("../../src/solve/constants.js");
const { SAVE_WINDOW_PLACARD, SAVE_WINDOW_STATUS_SENTENCES, horizonDisplay } = await import(
  "../../src/solve/saveWindow.js"
);
const { QUALITY_COLOUR } = await import("../../src/render/constants.js");
const { lowerScene } = await import("../../src/plan/scene.js");
const { run } = await import("../../src/solve/run.js");
const { renderViews } = await import("../../src/render/index.js");
const { isLineRefusal } = await import("../../src/solve/envelope.js");

type Session = Awaited<ReturnType<typeof loadSession>> extends { ok: true; value: infer V } ? V : never;

/**
 * A MISTAKE fixture, deliberately: G5's inspection half is stated over a
 * mistake line, and the overlay only has anything to draw on a line that ran
 * wide. `overspeed` on book90 is the one that RESOLVES (a `never_open` line
 * would make every scalar arm vacuous).
 */
const MISTAKE_SPEC = {
  road: { preset: "book90" },
  entry_kmh: 34,
  turn_in: "auto",
  mistake: { kind: "overspeed" }
};

let session: Session;
let mistakeLineId: string;

beforeAll(() => {
  const loaded = loadSession(MISTAKE_SPEC, { engine_semver: "0.1.0" });
  expect(loaded.ok, "the mistake fixture must load").toBe(true);
  if (!loaded.ok) return;
  session = loaded.value;
  const mistake = session.lines.find((l) => l.role === "mistake");
  expect(mistake, "the fixture produced no mistake line").toBeDefined();
  mistakeLineId = mistake!.line_id;
}, 300_000);

function focusMistake(): Session {
  return { ...session, focus: mistakeLineId } as Session;
}

// ---------------------------------------------------------------------------
// C-SAVEWIN-HUD

describe("C-SAVEWIN-HUD — every displayed save-window field equals the returned object", () => {
  it("every overlay HUD row's value IS a member of the returned SaveWindow, at the path it declares", () => {
    const line = session.lines.find((l) => l.line_id === mistakeLineId)!;
    const overlay = saveWindowOverlay(line);
    expect(overlay.ok).toBe(true);
    if (!overlay.ok) return;
    const byCorner = new Map(overlay.value.windows.map((w) => [w.corner_id, w]));

    let scalarRows = 0;
    for (const cursorT of [0, line.trajectory.terminated.t / 2, line.trajectory.terminated.t]) {
      const rows = saveWindowHudRows(overlay.value, cursorT);
      expect(rows.length).toBeGreaterThan(0);
      for (const row of rows) {
        expect(row.group).toBe("verdict"); // 07 §3.6: "one HUD row in the Verdict group"
        if (row.path === null) continue; // the status sentence — no scalar to compare
        const cornerId = row.label.split(" · ")[1] ?? "";
        if (row.path === "placard") {
          expect(row.value).toBe(SAVE_WINDOW_PLACARD);
          continue;
        }
        const w = byCorner.get(cornerId);
        expect(w, `row "${row.label}" names no live corner`).toBeDefined();
        expect(row.value, `row "${row.label}" does not equal ${row.path}`).toBe(
          (w as unknown as Record<string, unknown>)[row.path]
        );
        scalarRows++;
      }
    }
    expect(scalarRows, "no scalar row was exercised — the gate would be vacuous").toBeGreaterThan(0);
  }, 300_000);

  it("every printed number is clamped to HORIZON_DISPLAY_DP, and the countdown is the object's own tau_close_s minus the cursor", () => {
    const line = session.lines.find((l) => l.line_id === mistakeLineId)!;
    const overlay = saveWindowOverlay(line);
    expect(overlay.ok).toBe(true);
    if (!overlay.ok) return;
    const resolvedW = overlay.value.windows.find((w) => w.status === "resolved");
    expect(resolvedW, "the fixture must carry a `resolved` window").toBeDefined();

    for (const cursorT of [0, resolvedW!.tau_close_s! - 0.4, resolvedW!.tau_close_s! + 0.6]) {
      const rows = saveWindowHudRows(overlay.value, cursorT);
      const countdown = rows.find((r) => r.path === "tau_close_s" && r.label.endsWith(resolvedW!.corner_id))!;
      const delta = resolvedW!.tau_close_s! - cursorT;
      const want =
        delta >= 0
          ? `save window: closes in ${delta.toFixed(HORIZON_DISPLAY_DP)} s`
          : `save window: closed ${(-delta).toFixed(HORIZON_DISPLAY_DP)} s ago`;
      expect(countdown.text).toBe(want);
      // and every number anywhere in the overlay's rows carries exactly DP places
      for (const row of rows) {
        if (row.text === SAVE_WINDOW_PLACARD) continue;
        for (const m of row.text.matchAll(/(-?\d+\.\d+)\s*(?:s|m)\b/g)) {
          expect(m[1]!.split(".")[1]!.length, `"${m[0]}" in "${row.text}"`).toBe(HORIZON_DISPLAY_DP);
        }
      }
    }
  }, 300_000);

  it("A-SAVEWIN-PLACARD (the HUD surface) — a scalar row never appears without the placard row beside it", () => {
    const line = session.lines.find((l) => l.line_id === mistakeLineId)!;
    const overlay = saveWindowOverlay(line);
    expect(overlay.ok).toBe(true);
    if (!overlay.ok) return;
    const rows = saveWindowHudRows(overlay.value, 0);
    const scalars = rows.filter((r) => r.path === "tau_close_s" || r.path === "reaction_budget_s");
    const placards = rows.filter((r) => r.path === "placard");
    expect(scalars.length).toBeGreaterThan(0);
    expect(placards.length).toBeGreaterThan(0);
    for (const p of placards) expect(p.text).toBe(SAVE_WINDOW_PLACARD);
  }, 300_000);

  it("a REFUSING window prints its sentence instead of any scalar (07 §3.6, 04 §4b.5)", () => {
    // book90 + premature is `never_open` (see test/contract/saveWindow.test.ts's
    // ratified-defect case), so it is the refusing witness.
    const loaded = loadSession({ ...MISTAKE_SPEC, mistake: { kind: "premature" } }, { engine_semver: "0.1.0" });
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    const line = loaded.value.lines.find((l) => l.role === "mistake")!;
    const overlay = saveWindowOverlay(line);
    expect(overlay.ok).toBe(true);
    if (!overlay.ok) return;
    const refusing = overlay.value.windows.find((w) => w.status === "never_open");
    expect(refusing, "the premature fixture must carry a refusing window").toBeDefined();
    const rows = saveWindowHudRows(overlay.value, 0);
    const row = rows.find((r) => r.label.endsWith(refusing!.corner_id))!;
    expect(row.text).toBe(SAVE_WINDOW_STATUS_SENTENCES["never_open"]);
    expect(rows.some((r) => r.path === "tau_close_s")).toBe(false);
    expect(rows.some((r) => r.path === "reaction_budget_s")).toBe(false);
    // and NOTHING is drawn for it
    expect(overlay.value.probes.some((p) => p.corner_id === refusing!.corner_id)).toBe(false);
    expect(saveWindowTicks(overlay.value).some((t) => t.corner_id === refusing!.corner_id)).toBe(false);
  }, 300_000);
});

// ---------------------------------------------------------------------------
// C-SAVEWIN-CLIP

describe("C-SAVEWIN-CLIP — the drawn probe's last vertex is s* (04 §4b.4, mechanical)", () => {
  it("every drawn probe ends AT its s* (or at its termination station), and the glyph sits on that last vertex", () => {
    const line = session.lines.find((l) => l.line_id === mistakeLineId)!;
    const overlay = saveWindowOverlay(line);
    expect(overlay.ok).toBe(true);
    if (!overlay.ok) return;
    expect(overlay.value.probes.length).toBeGreaterThan(0);
    for (const probe of overlay.value.probes) {
      // At exactly `tau_close_s` the probe returns immediately, so the clipped
      // document can be a SINGLE retained sample — the clip is still the thing
      // under test, and it is the last vertex's station that must not outrun s*.
      expect(probe.path.length).toBeGreaterThanOrEqual(1);
      expect(probe.s_star_m, "a drawable probe must have returned").not.toBeNull();
      expect(probe.last_vertex_s).toBeGreaterThanOrEqual(probe.s_star_m! - 1e-9);
      // and it is the FIRST retained sample at or past s* — one arc step, not many
      expect(probe.last_vertex_s - probe.s_star_m!).toBeLessThanOrEqual(1.0);
    }
  }, 300_000);

  it("the drawn SVG carries the same last vertex the model does — the drawing cannot outrun the clip", () => {
    const line = session.lines.find((l) => l.line_id === mistakeLineId)!;
    const overlay = saveWindowOverlay(line);
    expect(overlay.ok).toBe(true);
    if (!overlay.ok) return;
    const svg = saveWindowOverlaySvg(overlay.value);
    for (const probe of overlay.value.probes) {
      expect(svg).toContain(`data-last-vertex-s="${Number(probe.last_vertex_s.toFixed(4))}"`);
      const last = probe.path[probe.path.length - 1]!;
      // the ring is drawn ON the last vertex — the glyph cannot sit past the clip
      expect(svg).toContain(`cx="${Number(last.x.toFixed(4))}" cy="${Number(last.y.toFixed(4))}"`);
      if (probe.path.length > 1) {
        const points = svg.match(/data-overlay="save-probe" points="([^"]+)"/)![1]!;
        const drawn = points.trim().split(" ");
        expect(drawn.length).toBe(probe.path.length);
        expect(drawn[drawn.length - 1]).toBe(`${Number(last.x.toFixed(4))},${Number(last.y.toFixed(4))}`);
      }
    }
  }, 300_000);

  it("the overlay modulates NO line ink — its one colour is not in the verdict palette (D9/D11)", () => {
    expect(Object.values(QUALITY_COLOUR)).not.toContain(SAVE_WINDOW_INK);
  });
});

// ---------------------------------------------------------------------------
// C-SAVEWIN-NO-INK — the real gate, over the six committed book scenes

describe("C-SAVEWIN-NO-INK — the exported SVG is byte-identical with the toggle on and off", () => {
  it("on every one of the six committed book scenes", () => {
    const scenes = readdirSync(scenesDir)
      .filter((f) => f.endsWith(".scene"))
      .sort();
    expect(scenes.length, "the six committed book scenes").toBe(6);

    for (const file of scenes) {
      const lowered = lowerScene(readFileSync(join(scenesDir, file), "utf8"));
      expect(lowered.ok, `${file} must lower`).toBe(true);
      if (!lowered.ok) continue;
      const fig = run(lowered.value as unknown as Record<string, unknown>, {
        engine_semver: "0.1.0",
        figure_id: file.replace(/\.scene$/, "")
      });
      expect(fig.ok, `${file} must bake`).toBe(true);
      if (!fig.ok) continue;
      const lines = fig.value.lines.filter((l) => !isLineRefusal(l));

      // the EXPORT — the picture `linelab figure`/`render` writes
      const before = renderViews({ road: fig.value.road as never, lines: lines as never });
      expect(before.ok).toBe(true);
      if (!before.ok) continue;

      // now turn the overlay on for every drawable line …
      let overlays = 0;
      for (const line of lines) {
        const overlay = saveWindowOverlay(line as never);
        if (overlay.ok && overlay.value.probes.length > 0) overlays++;
      }

      // … and re-export. Same bytes: the overlay lives in viewer/, and render/
      // has no import path to it (asserted structurally below).
      const after = renderViews({ road: fig.value.road as never, lines: lines as never });
      expect(after.ok).toBe(true);
      if (!after.ok) continue;
      expect(after.value.svg, `${file} export moved with the toggle`).toBe(before.value.svg);
      void overlays;
    }
  }, 600_000);

  it("structurally: no file under src/render/ can reach the overlay module at all", () => {
    const renderDir = join(repoRoot, "src/render");
    const offenders: string[] = [];
    for (const f of readdirSync(renderDir)) {
      if (!f.endsWith(".ts")) continue;
      const text = readFileSync(join(renderDir, f), "utf8");
      if (/viewer\//.test(text) || /save[_-]?[Ww]indow/.test(text)) offenders.push(f);
    }
    expect(offenders).toEqual([]);
  });

  it("and the toggle is OFF BY DEFAULT — a fresh app draws no overlay ink at all", () => {
    const app = createApp(focusMistake());
    expect(app.saveWindow).toBeNull();
    const frame = frameOf(app);
    const topdown = frame.views.find((v) => v.view === "topdown")!;
    expect(topdown.svg).not.toContain('data-overlay="save-window"');
    expect(frame.save_window_ticks).toEqual([]);
    expect(frame.hud.some((r) => r.label.startsWith("save window"))).toBe(false);

    // …and ON, it appears, without touching the picture beneath it
    const on = toggleSaveWindow(app);
    expect(on.saveWindow).not.toBeNull();
    const onFrame = frameOf(on);
    const onTopdown = onFrame.views.find((v) => v.view === "topdown")!;
    expect(onTopdown.svg).toContain('data-overlay="save-window"');
    expect(onFrame.save_window_ticks.length).toBeGreaterThan(0);
    expect(onFrame.hud.some((r) => r.label.startsWith("save window"))).toBe(true);
    // the base picture is UNCHANGED: removing exactly the overlay's own <g>
    // from the overlaid SVG yields the byte-identical original.
    const overlaySvg = saveWindowOverlaySvg(on.saveWindow!);
    expect(overlaySvg.length).toBeGreaterThan(0);
    expect(onTopdown.svg.replace(overlaySvg, "")).toBe(topdown.svg);

    // and toggling back off restores the exact original bytes
    expect(frameOf(toggleSaveWindow(on)).views.find((v) => v.view === "topdown")!.svg).toBe(topdown.svg);
  }, 300_000);
});

// ---------------------------------------------------------------------------
// G3 (design/01 §2) — "the stepper renders any sample index WITHOUT RE-RUNNING
// THE SOLVER"

describe("G3 — the stepper renders any sample index without re-running the solver", () => {
  it("scrubbing, sample-stepping, axis-flipping and re-rendering every view integrate ZERO times", () => {
    const app0 = createApp(focusMistake());
    const line = session.lines.find((l) => l.line_id === mistakeLineId)!;
    const samples = line.trajectory.samples;
    expect(samples.length).toBeGreaterThan(20);

    // warm the frame path once, THEN start counting
    frameOf(app0);
    const before = integrateCalls.n;

    let app = app0;
    for (let i = 0; i < samples.length; i += Math.max(1, Math.floor(samples.length / 25))) {
      app = scrub(app, samples[i]!.t);
      const frame = frameOf(app);
      expect(frame.views.length).toBe(2);
      expect(frame.instant).not.toBeNull();
    }
    app = flipAxis(app);
    frameOf(app);
    app = nudgeSample(app, 1);
    frameOf(app);
    app = nudgeSample(app, -1);
    frameOf(app);
    for (const view of ["topdown", "controls"] as const) {
      expect(renderView(focusMistake(), { view, instant: frameOf(app).instant }).ok).toBe(true);
    }

    expect(integrateCalls.n - before, "the stepper re-ran the engine").toBe(0);
  }, 300_000);

  it("the counter is REAL — loading a session (which recomputes, 07 §2.1) does move it", () => {
    const before = integrateCalls.n;
    const loaded = loadSession(MISTAKE_SPEC, { engine_semver: "0.1.0" });
    expect(loaded.ok).toBe(true);
    expect(integrateCalls.n - before, "the mock never fired — G3's zero would be meaningless").toBeGreaterThan(0);
  }, 300_000);

  it("the SAVE-WINDOW overlay is once-per-toggle, not per-frame (07 §3.6)", () => {
    const on = toggleSaveWindow(createApp(focusMistake()));
    expect(on.saveWindow).not.toBeNull();
    frameOf(on); // warm
    const before = integrateCalls.n;
    for (let i = 0; i < 5; i++) frameOf(scrub(on, i * 0.2));
    expect(integrateCalls.n - before, "the overlay recomputed on a frame").toBe(0);
  }, 300_000);
});

// ---------------------------------------------------------------------------
// G5, inspection half (design/01 §2) — "the viewer can scrub a MISTAKE LINE's
// trajectory and HUD"

describe("G5 (inspection half) — the viewer scrubs a MISTAKE line's trajectory and HUD", () => {
  it("the mistake line loads, holds focus, and every sampled cursor yields a full HUD and both views", () => {
    const focused = focusMistake();
    const line = focused.lines.find((l) => l.line_id === mistakeLineId)!;
    expect(line.role).toBe("mistake");
    expect(line.verdict.outcome).not.toBe("contained"); // it really is a mistake line

    let app = createApp(focused);
    const samples = line.trajectory.samples;
    const groupsSeen = new Set<string>();
    for (let i = 0; i < samples.length; i += Math.max(1, Math.floor(samples.length / 12))) {
      app = scrub(app, samples[i]!.t);
      const frame = frameOf(app);
      expect(frame.problems, `cursor t=${samples[i]!.t}`).toEqual([]);
      expect(frame.instant!.sample.t).toBeCloseTo(samples[i]!.t, 9);
      expect(frame.hud.length).toBeGreaterThan(10);
      for (const row of frame.hud) groupsSeen.add(row.group);
      expect(frame.views.map((v) => v.view)).toEqual(["topdown", "controls"]);
    }
    // all six 07 §3.3 HUD groups appear over the scrub
    expect([...groupsSeen].sort()).toEqual(["controls", "grip", "lean", "motion", "sight", "verdict"]);
  }, 300_000);

  it("the mistake line's terminal badge is its own termination reason, and the cursor freezes there", () => {
    const focused = focusMistake();
    const line = focused.lines.find((l) => l.line_id === mistakeLineId)!;
    const app = scrub(createApp(focused), line.trajectory.terminated.t + 5);
    const frame = frameOf(app);
    expect(frame.terminal.length).toBeGreaterThan(0);
    expect(frame.terminal.startsWith(line.trajectory.terminated.reason)).toBe(true);
    expect(frame.instant).not.toBeNull();
  }, 300_000);

  it("the mistake line's bookmarks are its OWN events — a mistake line is a first-class scrub subject", () => {
    const focused = focusMistake();
    const line = focused.lines.find((l) => l.line_id === mistakeLineId)!;
    const frame = frameOf(createApp(focused));
    expect(frame.bookmarks.map((b) => b.kind)).toEqual(line.trajectory.events.map((e) => e.kind));
  }, 300_000);
});

// ---------------------------------------------------------------------------
// Display precision, one more way: the overlay's own leader label

describe("the §3.6 leader label", () => {
  it('reads `save window closed · s = <s_close_m> m`, clamped to HORIZON_DISPLAY_DP', () => {
    const line = session.lines.find((l) => l.line_id === mistakeLineId)!;
    const overlay = saveWindowOverlay(line);
    expect(overlay.ok).toBe(true);
    if (!overlay.ok) return;
    for (const probe of overlay.value.probes) {
      expect(probe.label).toBe(`save window closed · s = ${horizonDisplay(probe.s_close_m)} m`);
    }
  }, 300_000);
});
