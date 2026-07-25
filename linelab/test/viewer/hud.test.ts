// test/viewer/hud.test.ts — `C-HUD-EQUALS-STATEAT` (design/07 §2.4, §3.3):
// "the HUD numbers are exactly `stateAt` outputs, no UI arithmetic".
//
// The gate is asserted at its strongest available strength: BYTE identity
// between what the HUD holds and what `linelab state --line <id> --s <m>`
// prints, over a real blessed golden (test/fixtures/goldens/C30.json), with
// the CLI spawned as a separate process against the built `dist/`. Nothing is
// mocked — the CLI side genuinely re-runs the engine, parses its own envelope
// off disk, recomposes the road from the disclosed `dsl`, and resolves
// `stateAt`; the viewer side recomputes the same spec in-process. Two
// completely independent paths into ONE implementation (`C-ONE-CORE`), and
// their outputs must agree to the byte.
//
// Then the second half: every HUD row declares WHICH member of that
// `InstantState` it displays (`row.path`), and the test resolves each path and
// demands `===` against the row's value. A row that computed anything — an
// average, a rescale, a re-derivation — cannot pass, because its value would
// not be found anywhere in the instant.

import { describe, it, expect, beforeAll } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { loadSession, type ViewerSession } from "../../src/viewer/session.js";
import { hudAt, hudRowsOf, instantValueAt } from "../../src/viewer/hud.js";
import { HUD_GROUPS } from "../../src/viewer/types.js";
import { boot, createApp, frameOf, jumpToBookmark, nudgeFrame, togglePlay } from "../../src/viewer/app.js";
import type { HostElement, ViewerHost } from "../../src/viewer/host.js";
import { bookmarksOf } from "../../src/viewer/bookmarks.js";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "../..");
const mainJs = join(repoRoot, "dist/cli/main.js");

const golden = JSON.parse(readFileSync(join(repoRoot, "test/fixtures/goldens/C30.json"), "utf8")) as {
  input: { input: unknown };
};
const C30_SPEC = golden.input.input;

let dir = "";
let envelopePath = "";

beforeAll(() => {
  // dist/ is built once by test/globalSetup.ts before the worker pool starts.
  dir = mkdtempSync(join(tmpdir(), "linelab-hud-"));
  const specPath = join(dir, "c30.spec.json");
  writeFileSync(specPath, JSON.stringify(C30_SPEC), "utf8");
  envelopePath = join(dir, "c30.env.json");
  execFileSync("node", [mainJs, "run", specPath, "--out", envelopePath], { cwd: repoRoot, stdio: "ignore" });
}, 180_000);

function cliStateRaw(lineId: string, flag: "--s" | "--t", value: number): string {
  return execFileSync("node", [mainJs, "state", envelopePath, "--line", lineId, flag, String(value)], {
    cwd: repoRoot,
    encoding: "utf8"
  }).trimEnd();
}

function session(): ViewerSession {
  const loaded = loadSession(C30_SPEC);
  if (!loaded.ok) throw new Error(`C30 spec did not load: ${JSON.stringify(loaded.error)}`);
  return loaded.value;
}

// ---------------------------------------------------------------------------

describe("C-HUD-EQUALS-STATEAT — the HUD's numbers ARE `linelab state`'s numbers", () => {
  it("byte-identical at every probed station, including exact sample hits and interpolated points", () => {
    const s = session();
    const line = s.lines[0]!;
    const lineId = line.line_id;
    // a spread: the first sample, exact grid hits, off-grid interpolations,
    // an event station, and the terminal sample
    const exactHit = line.trajectory.samples[137]!.s;
    const apex = bookmarksOf(line).find((b) => b.kind === "apex");
    const stations = [
      line.trajectory.samples[0]!.s,
      3.25,
      exactHit,
      20,
      41.5,
      ...(apex === undefined ? [] : [apex.s]),
      line.trajectory.samples[line.trajectory.samples.length - 1]!.s
    ];

    for (const station of stations) {
      const viewer = hudAt(s, lineId, { s: station });
      expect(viewer.ok, `viewer HUD at s=${station}`).toBe(true);
      if (!viewer.ok) continue;
      const cli = cliStateRaw(lineId, "--s", station);
      expect(JSON.stringify({ ok: true, value: viewer.value.instant }), `s = ${station}`).toBe(cli);
    }
  }, 120_000);

  it("byte-identical on the time axis too — the scrubber's other spelling", () => {
    const s = session();
    const lineId = s.lines[0]!.line_id;
    for (const t of [0, 0.5, 1.27653830036868, 3.3]) {
      const viewer = hudAt(s, lineId, { t });
      expect(viewer.ok, `viewer HUD at t=${t}`).toBe(true);
      if (!viewer.ok) continue;
      expect(JSON.stringify({ ok: true, value: viewer.value.instant }), `t = ${t}`).toBe(cliStateRaw(lineId, "--t", t));
    }
  }, 120_000);

  it("every displayed physics value is READ from the instant — no UI arithmetic anywhere (07 §2.4)", () => {
    const s = session();
    const line = s.lines[0]!;
    for (const station of [5, 20, 44.4, 70]) {
      const hud = hudAt(s, line.line_id, { s: station });
      expect(hud.ok).toBe(true);
      if (!hud.ok) continue;
      const instant = hud.value.instant;
      expect(hud.value.rows.length).toBeGreaterThan(15);
      for (const row of hud.value.rows) {
        if (row.origin !== "instant") continue;
        expect(row.path, `row "${row.label}" claims origin "instant" with no path`).not.toBeNull();
        expect(instantValueAt(instant, row.path!), `row "${row.label}" (path ${row.path})`).toBe(row.value);
      }
    }
  });

  it("all six of 07 §3.3's HUD groups are populated, and no row sits outside them", () => {
    const s = session();
    const hud = hudAt(s, s.focus, { s: 44.4 });
    expect(hud.ok).toBe(true);
    if (!hud.ok) return;
    const groups = new Set(hud.value.rows.map((r) => r.group));
    for (const g of HUD_GROUPS) expect(groups, `group "${g}" has no rows`).toContain(g);
    for (const r of hud.value.rows) expect(HUD_GROUPS).toContain(r.group);
  });

  it("`a_noreturn` reads the doc's own sentence, and shows — when upright", () => {
    const s = session();
    const line = s.lines[0]!;

    const upright = hudAt(s, line.line_id, { s: 5 }); // straight approach, phi ≈ 0
    expect(upright.ok).toBe(true);
    if (upright.ok) {
      const rowU = upright.value.rows.find((r) => r.label === "a_noreturn")!;
      expect(upright.value.instant.derived.a_noreturn_ms2).toBeNull();
      expect(rowU.text).toBe("brake ceiling at lean: —");
      expect(rowU.value).toBeNull();
    }

    const leaned = hudAt(s, line.line_id, { s: 55 }); // mid-corner
    expect(leaned.ok).toBe(true);
    if (leaned.ok) {
      const anr = leaned.value.instant.derived.a_noreturn_ms2;
      expect(anr).not.toBeNull();
      const rowL = leaned.value.rows.find((r) => r.label === "a_noreturn")!;
      expect(rowL.value).toBe(anr);
      expect(rowL.text.startsWith("brake ceiling at lean: ")).toBe(true);
      expect(rowL.text).not.toContain("—");
    }
  });

  it("`a_widen` rides the ARCHITECTURE §10.12 c = 1 pin — read from the instant, never re-applied here", () => {
    const s = session();
    const leaned = hudAt(s, s.focus, { s: 55 });
    expect(leaned.ok).toBe(true);
    if (!leaned.ok) return;
    const rowW = leaned.value.rows.find((r) => r.label === "a_widen")!;
    expect(rowW.path).toBe("derived.a_widen_ms2");
    expect(rowW.value).toBe(leaned.value.instant.derived.a_widen_ms2);

    const upright = hudAt(s, s.focus, { s: 5 });
    expect(upright.ok).toBe(true);
    if (upright.ok) {
      expect(upright.value.instant.derived.a_widen_ms2).toBeNull();
      expect(upright.value.rows.find((r) => r.label === "a_widen")!.text).toBe("—");
    }
  });

  it("the friction-ellipse widget draws the RECORDED normalized components, never a recomputation", () => {
    const s = session();
    const hud = hudAt(s, s.focus, { s: 44.4 });
    expect(hud.ok).toBe(true);
    if (!hud.ok) return;
    const nLong = hud.value.rows.find((r) => r.label === "n_long")!;
    const nLat = hud.value.rows.find((r) => r.label === "n_lat")!;
    expect(nLong.value).toBe(hud.value.instant.sample.n_long);
    expect(nLat.value).toBe(hud.value.instant.sample.n_lat);
    expect(nLong.path).toBe("sample.n_long");
    expect(nLat.path).toBe("sample.n_lat");
  });

  it("`hudRowsOf` over a `linelab state` document parsed back in produces the identical rows", () => {
    // the HUD is a pure function of the instant: feeding it the CLI's own
    // JSON (round-tripped through the wire) reproduces the panel exactly
    const s = session();
    const line = s.lines[0]!;
    const fromCli = JSON.parse(cliStateRaw(line.line_id, "--s", 30)) as { value: Parameters<typeof hudRowsOf>[0] };
    const inProcess = hudAt(s, line.line_id, { s: 30 });
    expect(inProcess.ok).toBe(true);
    if (!inProcess.ok) return;
    expect(hudRowsOf(fromCli.value, line)).toEqual(inProcess.value.rows);
  }, 60_000);
});

// ---------------------------------------------------------------------------
// The app: one pure frame function, and a headless boot through the real host
// interface. `browserHost()` returns null under Node, so the boot path is
// exercised here with a plain-object host — the same interface the browser
// adapter satisfies (viewer/host.ts), no DOM emulation involved.

interface FakeElement extends HostElement {
  html: string;
  text: string;
  val: string;
  handlers: Map<string, () => void>;
}

function fakeHost(): { host: ViewerHost; els: Map<string, FakeElement>; fire(id: string, ev: string): void } {
  const els = new Map<string, FakeElement>();
  const make = (): FakeElement => {
    const e: FakeElement = {
      html: "",
      text: "",
      val: "",
      handlers: new Map(),
      setHtml(h) {
        e.html = h;
      },
      setText(t) {
        e.text = t;
      },
      getText() {
        return e.text;
      },
      getValue() {
        return e.val;
      },
      setValue(v) {
        e.val = v;
      },
      on(ev, fn) {
        e.handlers.set(ev, fn);
      }
    };
    return e;
  };
  const host: ViewerHost = {
    byId(id) {
      let el = els.get(id);
      if (el === undefined) {
        el = make();
        els.set(id, el);
      }
      return el;
    },
    every: () => () => undefined,
    nowS: () => 0
  };
  return {
    host,
    els,
    fire(id, ev) {
      els.get(id)?.handlers.get(ev)?.();
    }
  };
}

describe("the workstation app (07 §6.1) boots headlessly and stays pure", () => {
  it("`frameOf` returns both view SVGs, the HUD, the bookmarks and the legend, with no problems", () => {
    const app = createApp(session());
    const f = frameOf(app);
    expect(f.problems).toEqual([]);
    expect(f.views.map((v) => v.view)).toEqual(["topdown", "controls"]);
    expect(f.hud.length).toBeGreaterThan(15);
    expect(f.bookmarks.length).toBeGreaterThan(3);
    expect(f.legend[0]!.focused).toBe(true);
    expect(f.instant).not.toBeNull();
  });

  it("boot paints the page through the host interface, then the controls drive the same cursor", () => {
    const { host, els, fire } = fakeHost();
    const payload = JSON.stringify(C30_SPEC);
    // the page hands the viewer its preloaded payload through the JSON block
    host.byId("payload")!.setText(payload);

    const started = boot(host, payload);
    expect(started.ok, started.ok ? "" : JSON.stringify(started.error)).toBe(true);
    if (!started.ok) return;

    expect(els.get("topdown")!.html.startsWith("<svg")).toBe(true);
    expect(els.get("controls")!.html.startsWith("<svg")).toBe(true);
    expect(els.get("hud")!.html).toContain("<table class=\"hud\"");
    expect(els.get("legend")!.html).toContain("<option");
    expect(els.get("bookmarks")!.html).toContain("<option");
    expect(els.get("readout")!.text).toContain("t = 0.00");

    // a scrubber drag moves the cursor and repaints
    els.get("scrubber")!.val = "0.5";
    fire("scrubber", "input");
    const midway = started.value.state().stepper.value;
    expect(midway).toBeGreaterThan(0);
    expect(els.get("readout")!.text).toContain(`t = ${midway.toFixed(2)}`);

    // a bookmark jump lands on the event's own time
    const line = started.value.state().session.lines[0]!;
    const turnIn = bookmarksOf(line).find((b) => b.kind === "turn_in")!;
    els.get("bookmarks")!.val = turnIn.label;
    fire("bookmarks", "change");
    expect(started.value.state().stepper.value).toBe(turnIn.t);

    started.value.dispose();
  }, 60_000);

  it("a malformed payload paints a typed message instead of throwing", () => {
    const { host } = fakeHost();
    const bad = boot(host, "{not json");
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.error.detail?.["reason"]).toBe("json_parse_error");
  });

  it("pure transitions never mutate: play, frame-step and jump each return a NEW state", () => {
    const app = createApp(session());
    const played = togglePlay(app);
    expect(app.stepper.playing).toBe(false);
    expect(played.stepper.playing).toBe(true);

    const nudged = nudgeFrame(app, 1);
    expect(app.stepper.value).toBe(0);
    expect(nudged.stepper.value).toBeCloseTo(0.1, 10);

    const line = app.session.lines[0]!;
    const apexOrFirst = bookmarksOf(line)[1]!;
    const jumped = jumpToBookmark(app, apexOrFirst.label);
    expect(jumped.stepper.value).toBe(apexOrFirst.t);
    expect(app.stepper.value).toBe(0);
  });
});
