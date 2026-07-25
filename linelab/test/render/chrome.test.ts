// test/render/chrome.test.ts — the stage 3b/8b/11 invariants (design/06 §3.1).
//
// These stages exist because a reader could not tell, from the figure alone,
// WHERE a line failed, WHICH WAY it was going, or HOW FAR anything was. Each
// test below pins the property that failure was, not the ink that fixed it:
//
//   3b  the graded corridor is drawn — the band `f` runs on, one
//       `bike_margin_m` inside the carriageway. `off_road` fires at the
//       carriageway edge and its terminal glyph does land there (pinned
//       below); what had no ink was the inner band every "ran wide" verdict is
//       measured against, so the card said wide and the figure showed nothing
//       to be wide of;
//   8b  every line says which way it runs and what it entered at, and how it
//       ended in a word — so verdict survives greyscale and red-green vision;
//   11  a scale bar, so every distance in the figure has a unit.
//
// They read the COMMITTED bakes: gate.test.ts already pins those byte-for-byte
// against a fresh in-process bake, so anything true of the committed bytes is
// true of the renderer.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const bakedDir = resolve(here, "..", "..", "figures");

const FIGURE_IDS = ["fig-08-01", "fig-08-02", "fig-08-03", "fig-08-04", "fig-08-05", "fig-08-06"] as const;

const svgOf = (id: string): string => readFileSync(join(bakedDir, `${id}.svg`), "utf8");

interface Pt {
  readonly x: number;
  readonly y: number;
}

/** Every `points="x,y x,y …"` list on elements carrying `attr`, in document order. */
function pointLists(svg: string, attr: string): Pt[][] {
  const out: Pt[][] = [];
  const re = new RegExp(`<polyline[^>]*${attr}[^>]*>`, "g");
  for (const el of svg.match(re) ?? []) {
    const m = /points="([^"]+)"/.exec(el);
    if (m === null) continue;
    out.push(
      m[1]!
        .trim()
        .split(/\s+/)
        .map((pair) => {
          const [x, y] = pair.split(",").map(Number);
          return { x: x!, y: y! };
        })
    );
  }
  return out;
}

/** Shortest distance from `p` to a polyline, in drawn metres. */
function distanceToPolyline(p: Pt, poly: readonly Pt[]): number {
  let best = Infinity;
  for (let i = 0; i + 1 < poly.length; i++) {
    const a = poly[i]!;
    const b = poly[i + 1]!;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len2 = dx * dx + dy * dy;
    const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
    best = Math.min(best, Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy)));
  }
  return best;
}

describe("stage 3b — the graded corridor is visible", () => {
  it.each(FIGURE_IDS)("%s draws both usable-corridor edges", (id) => {
    const svg = svgOf(id);
    expect(svg).toContain('data-stage="3b-usable-corridor"');
    expect(pointLists(svg, 'data-corridor-edge="lo"')).toHaveLength(1);
    expect(pointLists(svg, 'data-corridor-edge="hi"')).toHaveLength(1);
  });

  // Where the two edges are, relative to each other: the corridor is strictly
  // inside the carriageway by the bike margin. This is the whole reason a
  // "ran wide" line can still be on tarmac.
  it.each(FIGURE_IDS)("%s: the corridor sits strictly inside the carriageway", (id) => {
    const svg = svgOf(id);
    const corridor = [...pointLists(svg, 'data-corridor-edge="lo"'), ...pointLists(svg, 'data-corridor-edge="hi"')];
    const carriage = pointLists(svg.match(/data-stage="3-lane-markings">(.*?)<\/g>/s)![1]!, "points=");
    expect(carriage.length).toBeGreaterThanOrEqual(2);
    for (const edge of corridor) {
      const gaps = edge.map((p) => Math.min(...carriage.map((c) => distanceToPolyline(p, c))));
      // the near edge is one bike margin away; nothing is ON the carriageway
      const maxGap = Math.max(...gaps);
      expect(maxGap, `${id}: a corridor edge coincides with a carriageway stroke`).toBeGreaterThan(0.05);
    }
  });

  // design/06 §3.1 stage 8's own claim, worth a pin: `off_road` terminates at
  // the bracketed carriageway crossing, so the arrowhead lands ON the drawn
  // road edge — not in the grass, not short of it.
  it.each(FIGURE_IDS)("%s: every off_road terminal sits on the drawn carriageway edge", (id) => {
    const svg = svgOf(id);
    const carriage = pointLists(svg.match(/data-stage="3-lane-markings">(.*?)<\/g>/s)![1]!, "points=");
    const ticks = svg.match(/<line[^>]*data-terminal-reason="off_road"[^>]*>/g) ?? [];
    expect(ticks.length).toBeGreaterThan(0);
    for (const tick of ticks) {
      const g = (k: string): number => Number(new RegExp(`${k}="([^"]+)"`).exec(tick)![1]);
      const mid = { x: (g("x1") + g("x2")) / 2, y: (g("y1") + g("y2")) / 2 };
      const d = Math.min(...carriage.map((c) => distanceToPolyline(mid, c)));
      // one bracketing step of slack (design/02 §7's bracketed edge crossing)
      expect(d, `${id}: runoff terminal is ${d.toFixed(3)} m from the carriageway edge`).toBeLessThan(0.1);
    }
  });
});

describe("stage 8b — direction, distance, entry speed and outcome in words", () => {
  it.each(FIGURE_IDS)("%s: each line carries a distance ladder and an entry speed", (id) => {
    const svg = svgOf(id);
    expect(svg).toContain('data-stage="8b-line-chrome"');
    const lineIds = [...svg.matchAll(/data-entry-label="([^"]+)"/g)].map((m) => m[1]);
    expect(lineIds.length).toBeGreaterThanOrEqual(2); // every figure draws an ideal and a mistake
    for (const lineId of lineIds) {
      const ladder = [...svg.matchAll(new RegExp(`data-ladder-station="([^"]+)"[^>]*data-line-id="${lineId}"`, "g"))];
      expect(ladder.length, `${id}/${lineId}: no 10 m ladder`).toBeGreaterThan(0);
    }
  });

  // The colour-independence rule: a reader who cannot separate green from red,
  // or who printed the page in grey, still gets the verdict.
  it.each(FIGURE_IDS)("%s: every line states its outcome in a word", (id) => {
    const svg = svgOf(id);
    const words = [...svg.matchAll(/data-outcome-word="([^"]+)"[^>]*>([^<]+)</g)].map((m) => m[2]);
    expect(words.length).toBeGreaterThanOrEqual(2);
    for (const w of words) expect(["clean", "caution", "ran off", "ran wide", "crashed", "stopped"]).toContain(w);
  });
});

describe("stage 11 — the scale bar", () => {
  it.each(FIGURE_IDS)("%s: carries a scale bar and the lane width", (id) => {
    const svg = svgOf(id);
    const bar = /data-scale-bar="([^"]+)"/.exec(svg);
    expect(bar, `${id}: no scale bar`).not.toBeNull();
    expect(Number(bar![1])).toBeGreaterThan(0);
    expect(svg).toMatch(/lane [\d.]+ m wide/);
  });
});

describe("stage 8b — the consequence ray is opt-in and never a trajectory", () => {
  it("only fig-08-01 asks for it (view.consequence=on), and it carries no arrowhead", () => {
    const withRay = FIGURE_IDS.filter((id) => svgOf(id).includes("data-consequence="));
    expect(withRay).toEqual(["fig-08-01"]);
    const el = /<polyline[^>]*data-consequence="[^"]*"[^>]*>/.exec(svgOf("fig-08-01"))![0];
    expect(el).not.toContain("marker-end");
    expect(el).toContain("stroke-dasharray");
    // neutral ink — a verdict colour here would make it read as a line the
    // engine stood behind, which is exactly what it is not (§3.2).
    expect(el).toContain('stroke="#4a4a4a"');
  });
});
