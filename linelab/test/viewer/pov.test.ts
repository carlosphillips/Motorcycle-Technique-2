// test/viewer/pov.test.ts — the viewer's POV view (design/07 §5) and the
// per-view boot smoke that now covers three views.
//
// What this file grades, as real usage:
//   · per-view BOOT SMOKE (00 §3 phase table): `topdown`, `controls`, AND now
//     `pov` each render, once, without throwing, over a real recomputed session.
//   · C-POV-TRUE-GEOMETRY at the VIEWER layer (design/09 L2027): the viewer's
//     POV path (`viewer/pov.ts`) must not reach the diagram-projection module
//     (`render/project.ts`) — a structural import-closure scan, the twin of the
//     render-side lint, now covering `viewer/`.
//   · C-POV-LIMIT-CONSISTENT at the viewer layer (design/09 L2014): the POV
//     limit-marker's WORLD point is the cursor instant's recorded
//     `(limit_x, limit_y)` — the SAME source the topdown sight ray points at —
//     in BOTH look modes, never re-derived (07 §2.4).
//   · the `look` closed set (07 §5.2, D8): heading default, unknown → SCHEMA.
//   · frame purity + look-only-touches-pov (07 §5.5, §5.2 c): identical inputs →
//     identical svg; toggling look leaves topdown/controls byte-identical.

import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

import { loadSession, type ViewerSession } from "../../src/viewer/session.js";
import { hudAt } from "../../src/viewer/hud.js";
import { bootViews, renderView } from "../../src/viewer/views.js";
import { renderPovView, parsePovLook } from "../../src/viewer/pov.js";
import { VIEWER_VIEWS } from "../../src/viewer/types.js";
import { povFrame, POV_LOOK_MODES } from "../../src/render/pov.js";
import type { InstantState } from "../../src/core/types.js";

const here = dirname(fileURLToPath(import.meta.url));
const srcRoot = resolve(here, "../../src");

/** book90 solved clean at 34 km/h — one corner, a real limit point at mid-corner. */
const SPEC = { road: { preset: "book90" }, entry_kmh: 34, turn_in: "auto" };

let session: ViewerSession;

beforeAll(() => {
  const loaded = loadSession(SPEC, { engine_semver: "0.1.0" });
  if (!loaded.ok) throw new Error(`book90 session did not load: ${JSON.stringify(loaded.error)}`);
  session = loaded.value;
}, 180_000);

/** the focused line's instant at a station, or throw (the fixture must resolve). */
function instantAt(s: number): InstantState {
  const hud = hudAt(session, session.focus, { s });
  if (!hud.ok) throw new Error(`hudAt refused at s=${s}: ${JSON.stringify(hud.error)}`);
  return hud.value.instant;
}

/** a mid-corner station — where book90 actually has a limit point to point at. */
function midCornerS(): number {
  const c0 = session.road.corners[0]!;
  return c0.s_mid;
}

// ---------------------------------------------------------------------------
// per-view boot smoke — topdown, controls, AND pov (00 §3 phase table)

describe("per-view boot smoke — topdown, controls, and pov all boot (00 §3, design/09 §6 L1958)", () => {
  it("the viewer now offers exactly {topdown, controls, pov}, in layout order", () => {
    expect([...VIEWER_VIEWS]).toEqual(["topdown", "controls", "pov"]);
  });

  it("every view renders once, without throwing, over a real recomputed session", { timeout: 180_000 }, () => {
    const instant = instantAt(midCornerS());
    const booted = bootViews(session, instant);
    expect(booted.length).toBe(VIEWER_VIEWS.length);
    expect(booted.length).toBe(3);
    for (const [i, r] of booted.entries()) {
      const view = VIEWER_VIEWS[i]!;
      expect(r.ok, `${view} failed to boot: ${r.ok ? "" : JSON.stringify(r.error)}`).toBe(true);
      if (r.ok) {
        expect(r.value.view).toBe(view);
        expect(r.value.svg.startsWith("<svg")).toBe(true);
        expect(r.value.svg.trimEnd().endsWith("</svg>")).toBe(true);
        // never the never-throw fallback card
        expect(r.value.svg).not.toContain("render failed");
      }
    }
  });

  it("pov boots even with NO cursor (a static default frame), and still carries exactly one limit marker", { timeout: 180_000 }, () => {
    const r = renderView(session, { view: "pov", instant: null });
    expect(r.ok, r.ok ? "" : JSON.stringify(r.error)).toBe(true);
    if (!r.ok) return;
    expect(r.value.view).toBe("pov");
    expect(r.value.svg).toContain('data-view="pov"');
    expect((r.value.svg.match(/data-marker="limit_point"/g) ?? []).length).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// C-POV-TRUE-GEOMETRY (viewer layer) — the POV path never reaches project.ts

describe("C-POV-TRUE-GEOMETRY (viewer layer) — the viewer POV path avoids the diagram-projection module (design/09 L2027)", () => {
  /** transitive relative-import closure of a src file, as src-relative POSIX paths. */
  function closure(entryRel: string): Set<string> {
    const seen = new Set<string>();
    const queue = [entryRel];
    while (queue.length > 0) {
      const rel = queue.pop()!;
      if (seen.has(rel)) continue;
      const abs = resolve(srcRoot, rel);
      let text: string;
      try {
        text = readFileSync(abs, "utf8");
      } catch {
        continue;
      }
      seen.add(rel);
      for (const m of text.matchAll(/\bfrom\s+["']([^"']+)["']/g)) {
        const spec = m[1]!;
        if (!spec.startsWith(".")) continue;
        const t = resolve(dirname(abs), spec);
        const ts = t.endsWith(".js") ? t.slice(0, -3) + ".ts" : t;
        if (!ts.startsWith(srcRoot + sep)) continue;
        queue.push(ts.slice(srcRoot.length + 1).split(sep).join("/"));
      }
    }
    return seen;
  }

  it("viewer/pov.ts does not import the diagram-projection module (project.ts), directly or transitively", () => {
    const direct = readFileSync(resolve(srcRoot, "viewer/pov.ts"), "utf8");
    // no direct import of the projection module, and NOT through render/index.ts
    // (which composes a projected DrawnScene and pulls project.ts in)
    expect(direct.includes("./project.js")).toBe(false);
    expect(/from\s+["'][^"']*\/project\.js["']/.test(direct)).toBe(false);
    expect(/from\s+["'][^"']*render\/index\.js["']/.test(direct)).toBe(false);
    // and the closure confirms it: the whole POV path stays clear of project.ts
    const reached = closure("viewer/pov.ts");
    expect(reached.has("viewer/pov.ts")).toBe(true);
    expect(reached.has("render/pov.ts"), "the viewer POV path must reach the pure builder").toBe(true);
    expect(reached.has("render/project.ts"), "the viewer POV path reaches the diagram-projection module").toBe(false);
  });
});

// ---------------------------------------------------------------------------
// C-POV-LIMIT-CONSISTENT (viewer layer) — one recorded limit, two views

describe("C-POV-LIMIT-CONSISTENT (viewer layer) — the POV limit world is the recorded (limit_x, limit_y) (design/09 L2014)", () => {
  it("the viewer's POV limit-marker world equals the cursor instant's recorded limit, in BOTH look modes", { timeout: 180_000 }, () => {
    const instant = instantAt(midCornerS());
    const line = session.lines.find((l) => l.line_id === session.focus)!;
    const occluders = line.resolved_scenario.occluders ?? [];
    // the recorded limit is the topdown sight-ray source AND stateAt's derived
    // limit_point — one number, consumed by both views (07 §2.4, never re-derived)
    expect(instant.derived.limit_point.x).toBe(instant.sample.limit_x);
    expect(instant.derived.limit_point.y).toBe(instant.sample.limit_y);
    for (const look of POV_LOOK_MODES) {
      const f = povFrame({ road: session.road, occluders, line, sample: instant.sample, look });
      expect(f.limit.world.x).toBe(instant.sample.limit_x);
      expect(f.limit.world.y).toBe(instant.sample.limit_y);
      // exactly one marker, in the closed set (D40)
      expect(["placed", "clamped"]).toContain(f.limit.markerState);
      expect(f.limit.arrow !== null).toBe(f.limit.markerState === "clamped");
    }
    // and the viewer-rendered svg carries exactly one marker
    const svg = renderPovView(session.road, line, instant, "heading");
    expect((svg.match(/data-marker="limit_point"/g) ?? []).length).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// the `look` closed set + frame purity (07 §5.2 / §5.5)

describe("the POV `look` toggle (07 §5.2, D8) and frame purity (07 §5.5)", () => {
  it("`look` is exactly {heading, limit_point}; heading is the default; an unknown value is SCHEMA (not deferred)", () => {
    expect([...POV_LOOK_MODES]).toEqual(["heading", "limit_point"]);
    const dflt = parsePovLook(undefined);
    expect(dflt.ok && dflt.value).toBe("heading");
    for (const look of POV_LOOK_MODES) {
      const p = parsePovLook(look);
      expect(p.ok && p.value).toBe(look);
    }
    const bad = parsePovLook("chase");
    expect(bad.ok).toBe(false);
    if (!bad.ok) {
      expect(bad.error.code).toBe("SCHEMA");
      expect(bad.error.deferred).toBeUndefined(); // look SHIPS in v0.3 — a bad value is not a phase gate
      expect(bad.error.detail?.["reason"]).toBe("unknown_look");
    }
  });

  it("frames are pure — identical (line, instant, look) → byte-identical svg", { timeout: 180_000 }, () => {
    const instant = instantAt(midCornerS());
    const line = session.lines.find((l) => l.line_id === session.focus)!;
    for (const look of POV_LOOK_MODES) {
      expect(renderPovView(session.road, line, instant, look)).toBe(renderPovView(session.road, line, instant, look));
    }
    // toggling look changes the POV frame (it is a camera control) …
    const heading = renderPovView(session.road, line, instant, "heading");
    const limit = renderPovView(session.road, line, instant, "limit_point");
    expect(limit).not.toBe(heading);
    expect(limit).toContain('data-look="limit_point"');
    expect(heading).toContain('data-look="heading"');
  });

  it("look is POV-only: it never touches the topdown or controls views (07 §5.2 c)", { timeout: 180_000 }, () => {
    const instant = instantAt(midCornerS());
    for (const view of ["topdown", "controls"] as const) {
      const a = renderView(session, { view, instant, look: "heading" });
      const b = renderView(session, { view, instant, look: "limit_point" });
      expect(a.ok && b.ok).toBe(true);
      if (a.ok && b.ok) expect(a.value.svg).toBe(b.value.svg);
    }
  });
});
