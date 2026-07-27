// test/render/placards.test.ts — the S15 placard channel, end to end
// (design/06 §3.1 stage 11, "figure-level placard boxes"; design/01 §8's
// placard policy; the amended design/04 §7 / design/03 §8 authoring surface).
//
// WHY THIS EXISTS. Before this channel, a figure could only SAY something to a
// reader through `labels:` (which must hang off one of eight closed anchors)
// and through the legend. `note:` reaches `meta.caption` in the envelope and
// stops there; `#` comments are stripped before parsing. So a figure whose
// honesty depends on a concession the reader must see — "this reproduces no
// printed figure", "the two strips are auto-scaled independently, compare
// shapes not magnitudes" — could not be shipped honestly at all
// (figures/SCOPE.md §1's standing rule, §4 S15).
//
// The tests below read as the usage documentation for that channel:
//
//   1. author it in `.scene` text → it becomes real `<text>` ink;
//   2. it rides the export manifest, because J7 ("nothing drawn that the
//      manifest doesn't declare") fails ink the manifest omits;
//   3. THE CORPUS REGRESSION: a scene that declares no placards bakes
//      byte-identical SVG and an unchanged `spec_hash`. The channel is
//      additive and opt-in or it is a corpus re-bless event;
//   4. several placards are several boxes, in declared order;
//   5. long text wraps on a pure character rule (no DOM, no font metric —
//      design/06 §3) and XML-escapes without transforming the author's
//      characters;
//   6. the FigureSpec JSON twin accepts the same key (D30: one identity), which
//      matters because the figure that carries SCOPE.md §3's P1–P4 is JSON.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { figureVerb } from "../../src/cli/verbs/figure.js";
import { ENGINE_SEMVER } from "../../src/solve/run.js";
import { lowerScene } from "../../src/plan/scene.js";
import { validateFigureSpec, specHash } from "../../src/plan/figure.js";
import { TOP_LEVEL_KEYS } from "../../src/plan/scene.js";
import { buildSchemaDoc } from "../../src/cli/doc/schema.js";
import { wrapPlacard, placardBandHeightPx, PLACARD_WRAP_CHARS } from "../../src/render/placards.js";
import type { VerbOutcome } from "../../src/cli/verbs/shared.js";
import type { ManifestRecord } from "../../src/render/manifest.js";

const here = dirname(fileURLToPath(import.meta.url));
const scenesDir = resolve(here, "../../../figures"); // ../figures — the design of record, read-only
const bakedDir = resolve(here, "../../figures"); // linelab/figures — the committed bakes

const FIGURE_IDS = ["fig-08-01", "fig-08-02", "fig-08-03", "fig-08-04", "fig-08-05", "fig-08-06"] as const;

// ---------------------------------------------------------------------------
// bake helpers — the `figure` verb IS the bake path (design/08 §3); `--out`
// names the figure (its basename is the figure_id) and produces the writes.

function bake(sceneText: string, id = "fx-placard"): VerbOutcome {
  return figureVerb({ loadedText: sceneText, argv: ["--mode", "true", "--out", `out/${id}`], engineSemver: ENGINE_SEMVER });
}

function svgOf(o: VerbOutcome): string {
  const w = (o.writes ?? []).find((f) => f.path.endsWith(".svg"));
  if (w === undefined) throw new Error(`bake produced no svg (exit ${o.exit}): ${JSON.stringify(o.stdout).slice(0, 400)}`);
  return w.content;
}

function manifestOf(o: VerbOutcome): ManifestRecord {
  const w = (o.writes ?? []).find((f) => f.path.endsWith("manifest.json"));
  if (w === undefined) throw new Error(`bake produced no manifest (exit ${o.exit})`);
  return JSON.parse(w.content) as ManifestRecord;
}

/** Every `<text data-placard="…">` node, as `{placard, line, text}`, in document order. */
function placardTextNodes(svg: string): { placard: number; line: number; text: string }[] {
  const out: { placard: number; line: number; text: string }[] = [];
  const re = /<text([^>]*\sdata-placard="(\d+)"[^>]*)>([\s\S]*?)<\/text>/g;
  for (let m = re.exec(svg); m !== null; m = re.exec(svg)) {
    const lineIdx = /data-placard-line="(\d+)"/.exec(m[1]!);
    out.push({ placard: Number(m[2]!), line: Number(lineIdx?.[1] ?? "-1"), text: m[3]! });
  }
  return out;
}

/** The inverse of render/topdown.ts's `esc` — recovers the author's exact characters. */
function unescapeXml(s: string): string {
  return s.replace(/&quot;/g, '"').replace(/&gt;/g, ">").replace(/&lt;/g, "<").replace(/&amp;/g, "&");
}

/** The joined, unescaped text of one placard box — the sentence a reader sees. */
function placardText(svg: string, index: number): string {
  return placardTextNodes(svg)
    .filter((n) => n.placard === index)
    .sort((a, b) => a.line - b.line)
    .map((n) => unescapeXml(n.text))
    .join(" ");
}

// A minimal two-line figure on the book's canonical 90° corner — enough road
// and ink for the renderer to lay out a real frame, small enough to read.
const BASE_SCENE = `road:      preset book90
lines:
  good:    ride entry=34 turnIn=auto
  bad:     mistake premature
`;

const withPlacards = (...texts: readonly string[]): string =>
  `${BASE_SCENE}placards:\n${texts.map((t) => `  "${t}"`).join("\n")}\n`;

// ---------------------------------------------------------------------------

describe("placards: authoring a figure-level placard box (design/06 §3.1 stage 11)", () => {
  it("1. a placard authored in scene text becomes real <text> ink a reader sees", () => {
    // The sentence S15 says is undrawable today: a non-parity provenance
    // statement. Author it at column 0, one double-quoted string per line.
    const scene = withPlacards("DOCTRINE FIGURE - reproduces no printed figure.");
    const svg = svgOf(bake(scene));

    expect(placardText(svg, 0)).toBe("DOCTRINE FIGURE - reproduces no printed figure.");
    // it is chrome, drawn in stage 11, not a grade: neutral ink only (§5.1 —
    // a colour is a verdict, and a placard has no verdict to report).
    const node = /<text[^>]*data-placard="0"[^>]*>/.exec(svg)![0];
    expect(node).toContain('fill="#555555"');
    expect(svg.indexOf('data-stage="11-chrome"')).toBeLessThan(svg.indexOf('data-placard="0"'));
  });

  it("2. the placard rides the export manifest — J7 fails ink the manifest does not declare", () => {
    // design/06 §7 mirrors the legend rows "assertable mechanically in CI, not
    // hoped for in pixels". Placard ink is held to the same bar: the manifest
    // records the AUTHORED strings, so a CI reader can check drawn ⊆ declared
    // without measuring pixels.
    const scene = withPlacards("The two controls strips are auto-scaled independently - compare shapes, not magnitudes.");
    const out = bake(scene);

    expect(manifestOf(out).placards).toEqual(["The two controls strips are auto-scaled independently - compare shapes, not magnitudes."]);
    // every drawn placard box is declared, and nothing else is
    const drawn = new Set(placardTextNodes(svgOf(out)).map((n) => n.placard));
    expect([...drawn].sort()).toEqual([0]);
  });

  it("3a. REGRESSION — the six committed scenes still lower without the key, at their committed spec_hash", () => {
    // The whole corpus rests on this. `placards` is OMITTED from the lowered
    // spec when unset (never `[]`), so `spec_hash = fnv1a(canonicalize(spec))`
    // cannot move — a key defaulted to `[]` would have moved all six stamps and
    // fired design/09 §3.3's tripwire outside a re-bless commit.
    const committed = JSON.parse(readFileSync(join(bakedDir, "manifest.json"), "utf8")) as readonly ManifestRecord[];
    for (const id of FIGURE_IDS) {
      const spec = lowerScene(readFileSync(join(scenesDir, `${id}.scene`), "utf8"));
      expect(spec.ok).toBe(true);
      if (!spec.ok) return;
      expect("placards" in spec.value).toBe(false);

      const row = committed.find((r) => r.figure_id === id)!;
      expect(specHash(spec.value)).toBe(row.spec_hash);
      expect("placards" in row).toBe(false); // the manifest record is unchanged too
      // and no committed bake carries placard ink. (gate.test.ts pins these
      // bytes against a fresh in-process bake, so this IS the renderer's
      // output — the same reasoning chrome.test.ts's banner states.)
      expect(readFileSync(join(bakedDir, `${id}.svg`), "utf8")).not.toContain("data-placard");
    }
  });

  it("3b. REGRESSION — a fresh bake of a placard-free scene is byte-identical to the committed one", { timeout: 30_000 }, () => {
    // 3a's transitive argument, discharged directly on one figure: the renderer
    // as it stands today, with the placard channel in it, reproduces the
    // committed bytes exactly. Additive and opt-in, or this is a corpus
    // re-bless event.
    const id = "fig-08-01";
    const fresh = figureVerb({
      loadedText: readFileSync(join(scenesDir, `${id}.scene`), "utf8"),
      argv: ["--mode", "true", "--out", `out/${id}`],
      engineSemver: ENGINE_SEMVER
    });
    expect(svgOf(fresh)).toBe(readFileSync(join(bakedDir, `${id}.svg`), "utf8"));

    const committed = JSON.parse(readFileSync(join(bakedDir, "manifest.json"), "utf8")) as readonly ManifestRecord[];
    expect(manifestOf(fresh)).toEqual(committed.find((r) => r.figure_id === id));
  });

  it("4. several placards are several boxes, drawn in declared order", () => {
    const svg = svgOf(bake(withPlacards("First.", "Second.", "Third.")));

    expect([placardText(svg, 0), placardText(svg, 1), placardText(svg, 2)]).toEqual(["First.", "Second.", "Third."]);
    // one box outline per placard, and they do not overlap: each box's top edge
    // sits below the previous box's top edge (the band stacks downward).
    const tops = [...svg.matchAll(/<rect[^>]*data-placard-box="(\d+)"[^>]*\/>/g)].map((m) => ({
      i: Number(m[1]),
      y: Number(/\sy="(-?[\d.]+)"/.exec(m[0])![1])
    }));
    expect(tops.map((t) => t.i)).toEqual([0, 1, 2]);
    expect(tops[1]!.y).toBeGreaterThan(tops[0]!.y);
    expect(tops[2]!.y).toBeGreaterThan(tops[1]!.y);
  });

  it("5. long placards wrap on a pure character rule, on whitespace, never mid-word", () => {
    // design/06 §3 forbids DOM and IO and §4 says outright there is no text
    // metric in a pure string builder, so the wrap is a character count — the
    // same honest approximation render/controls.ts already uses for its title.
    // Fed fig-11-TB's P2 verbatim (figures/SCOPE.md §3): 71 words, 4 sentences.
    const P2 =
      "trail_brake_taper: pass means no leaned sample crossed the 2.5 m/s2 onset - it does not mean the trail brake helped. " +
      "Across a 25-cell brake sweep on this road the check returned pass in every cell, including cells that ran off the road, " +
      "and it returns pass for an 8.0 m/s2 brake because the bike never reaches 15 deg of lean. Read the green line's grade, not its tick.";

    const lines = wrapPlacard(P2);
    expect(lines.length).toBeGreaterThan(1);
    for (const l of lines) expect(l.length).toBeLessThanOrEqual(PLACARD_WRAP_CHARS);
    expect(lines.join(" ")).toBe(P2); // no word split, no character invented or dropped
    for (const l of lines) expect(l).toBe(l.trim());

    const svg = svgOf(bake(withPlacards(P2)));
    const nodes = placardTextNodes(svg).filter((n) => n.placard === 0);
    expect(nodes.map((n) => n.line)).toEqual(lines.map((_, i) => i)); // one <text> per wrapped line, indexed
    expect(placardText(svg, 0)).toBe(P2);
  });

  it("5b. XML metacharacters are escaped, and nothing else about the author's text is touched", () => {
    const tricky = `a & b < c > d "quoted" and it's fine`;
    const svg = svgOf(bake(withPlacards(tricky)));

    const raw = /<text[^>]*data-placard="0"[^>]*>([\s\S]*?)<\/text>/.exec(svg)![1]!;
    expect(raw).toContain("&amp;");
    expect(raw).toContain("&lt;");
    expect(raw).toContain("&gt;");
    expect(raw).toContain("it's"); // an apostrophe is legal in XML text — never transformed
    expect(placardText(svg, 0)).toBe(tricky);
  });

  it("6. the FigureSpec JSON twin accepts `placards` and produces the same ink (D30: one identity)", () => {
    // fig-11-TB — the figure that would carry SCOPE.md §3's P1–P4 — is
    // FigureSpec JSON, not a `.scene` (S28). The key has to exist in both
    // spellings or the placard channel does not reach it.
    const text = "This figure makes no claim that trail braking is better.";
    const sceneSpec = lowerScene(withPlacards(text));
    expect(sceneSpec.ok).toBe(true);
    if (!sceneSpec.ok) return;

    const json = validateFigureSpec(JSON.parse(JSON.stringify(sceneSpec.value)));
    expect(json.ok).toBe(true);
    if (!json.ok) return;
    expect(json.value.placards).toEqual([text]);
    // spelling never changes identity (D30) — the lowered forms hash the same
    expect(specHash(json.value)).toBe(specHash(sceneSpec.value));

    const jsonSvg = svgOf(figureVerb({ loadedText: JSON.stringify(json.value), argv: ["--mode", "true", "--out", "out/fx-json"], engineSemver: ENGINE_SEMVER }));
    expect(placardText(jsonSvg, 0)).toBe(text);
  });
});

describe("placards: the layout rule, chosen here because the letter is silent on box geometry", () => {
  it("draws in a band BELOW the content viewBox — scene.frame and the proportion metrics never move", () => {
    // design/06 §6.2's exemption list has exactly two entries and margin chrome
    // is not one of them, so a placard that grew `scene.frame` would move
    // `road_ink` and `frame_aspect` on every figure carrying one. The band is
    // viewBox-only: the frame, and therefore every gated metric, is identical.
    const plain = bake(BASE_SCENE);
    const withOne = bake(withPlacards("A placard adds a band, never a metric."));

    expect(manifestOf(withOne).proportion_metrics).toEqual(manifestOf(plain).proportion_metrics);
    expect(manifestOf(withOne).gate_verdict).toBe(manifestOf(plain).gate_verdict);

    const vb = (svg: string): number[] => /viewBox="([^"]+)"/.exec(svg)![1]!.split(" ").map(Number);
    const [x0, y0, w0, h0] = vb(svgOf(plain));
    const [x1, y1, w1, h1] = vb(svgOf(withOne));
    expect([x1, y1, w1]).toEqual([x0, y0, w0]); // origin and width untouched
    expect(h1!).toBeGreaterThan(h0!); // grew downward only, to make room for the band

    // and the band it grew by is exactly the height the pure layout function
    // predicts from the text alone (no measurement, no host font)
    const pxScale = w0! / 1000; // NOMINAL_FRAME_PX
    expect(h1! - h0!).toBeCloseTo(placardBandHeightPx(["A placard adds a band, never a metric."]) * pxScale, 9);
  });

  it("a figure with no placards reserves no band at all", () => {
    expect(placardBandHeightPx([])).toBe(0);
  });
});

describe("placards: the D8 surface — nothing is accepted-and-ignored", () => {
  it("an empty `placards:` block is rejected, not silently dropped", () => {
    const r = lowerScene(`${BASE_SCENE}placards:\n`);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.code).toBe("SCHEMA");
    expect(r.error.detail?.["reason"]).toBe("scene_placard_empty");
  });

  it("an unquoted or blank placard entry is rejected with the offending line number", () => {
    const r = lowerScene(`${BASE_SCENE}placards:\n  not quoted\n`);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.code).toBe("SCHEMA");
    expect(r.error.detail?.["reason"]).toBe("scene_placard_malformed");
    expect(r.error.at).toContain("line 6"); // `placards:` is line 5; the offending entry is line 6
  });

  it("the JSON twin rejects a non-string placard", () => {
    const r = validateFigureSpec({
      road: { preset: "book90" },
      lines: [{ name: "a", role: "ideal", spec: { entry_kmh: 34, road: { preset: "book90" } } }],
      placards: [7]
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.at).toBe("placards[0]");
  });

  it("the printed `schema scene` prose enumerates every top-level key the parser accepts", () => {
    // The key list in cli/doc/schema.ts is prose, not derived — so it can drift
    // away from the parser silently. This is the tripwire that stops it.
    const doc = buildSchemaDoc();
    expect(doc.ok).toBe(true);
    if (!doc.ok) return;
    const prose = doc.value.sections["scene"]!.prose;
    for (const key of TOP_LEVEL_KEYS) expect(prose).toContain(key);
  });
});
