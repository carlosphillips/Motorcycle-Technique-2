// test/plan/line-overrides.test.ts — the PER-LINE half of two keys the design
// of record scopes at two levels.
//
//   design/03 §8: "`marks` is a `MarkSpec` — `auto | all | none | <class-list>`
//   over the closed marker classes ... **at figure and per-line scope**".
//
//   design/04 §7: "`marks:` takes a **MarkSpec** ... at figure level,
//   **overridable per line with `marks=`**" — and the `ride` line-kind's own
//   key list ends "`role=<role>`, `label=\"…\"`, `marks=<MarkSpec>`".
//
// `label` is not decoration either: design/05 §7 types it on the line record as
// "`label,  // legend text`", and design/06 §5.3's legend row is
// `<swatch> SP <name> " — " <role> " · " <quality>` where `<name>` is that
// label. So an authored `label=` has exactly one job — it names the line in the
// legend — and D8 forbids accepting it and ignoring it.
//
// THE STANDING CONSTRAINT this file also gates: both keys are **omitted when
// unused**, never defaulted. `spec_hash` is fnv-1a over the LOWERED form (D30),
// so a line object that always carried `marks: "auto"` would move the identity
// of all six committed figures — the same reason design/03 §8 gives for
// `placards` ("Optional and **omitted when unused**, never `[]`: `spec_hash`
// covers the lowered form (D30), so a defaulted key would move every existing
// figure's identity").
//
// Error assertions ride code + detail.reason, never message text.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { lowerScene } from "../../src/plan/scene.js";
import { specHash, validateFigureSpec, lineMarksOf } from "../../src/plan/figure.js";
import type { FigureSpec } from "../../src/plan/types.js";
import { figureVerb } from "../../src/cli/verbs/figure.js";
import { ENGINE_SEMVER } from "../../src/solve/run.js";
import type { FigureResult, LineResult } from "../../src/solve/types.js";
import type { LinelabError, Result } from "../../src/core/result.js";

const here = dirname(fileURLToPath(import.meta.url));
const scenesDir = resolve(here, "../../../figures");

const FIGURE_IDS = ["fig-08-01", "fig-08-02", "fig-08-03", "fig-08-04", "fig-08-05", "fig-08-06"] as const;

function mustLower(sceneText: string): FigureSpec {
  const r = lowerScene(sceneText);
  if (!r.ok) throw new Error(`expected lowerScene to succeed, got ${r.error.code}/${String(r.error.detail?.["reason"])}: ${r.error.message}`);
  return r.value;
}

function refusalOf<T>(r: Result<T>): LinelabError {
  if (r.ok) throw new Error("expected lowerScene/validateFigureSpec to refuse");
  return r.error;
}

function reasonOf(e: LinelabError): unknown {
  return e.detail?.["reason"];
}

/**
 * A minimal two-ride scene; `rideArgs` is spliced onto the SECOND line only.
 * The two lines enter at DIFFERENT speeds deliberately: two identical rides
 * would put every marker pair at drawn distance 0, and design/06 §3.1 stage
 * 9's coincident collapse would fold them into one glyph — which would mask
 * exactly the per-line enable/disable this file is measuring.
 */
function twoRideScene(rideArgs: string, figureMarks?: string): string {
  return [
    "road:      preset book90",
    "lines:",
    "  good:    ride entry=34 turnIn=auto",
    `  alt:     ride entry=28 turnIn=auto${rideArgs.length > 0 ? " " + rideArgs : ""}`,
    ...(figureMarks !== undefined ? [`marks:     ${figureMarks}`] : [])
  ].join("\n");
}

// ---------------------------------------------------------------------------
// 1. `marks=` as a ride key

describe("scene text: `marks=` is a ride key (design/04 §7), lowered onto the FigureSpec line", () => {
  it("lowers `all` onto the line, leaving the figure-level key untouched", () => {
    const spec = mustLower(twoRideScene("marks=all", "none"));
    expect(spec.marks).toBe("none");
    expect(spec.lines[0]!.marks).toBeUndefined();
    expect(spec.lines[1]!.marks).toBe("all");
  });

  it("lowers `none` — the per-line key can subtract as well as add", () => {
    const spec = mustLower(twoRideScene("marks=none", "all"));
    expect(spec.marks).toBe("all");
    expect(spec.lines[1]!.marks).toBe("none");
  });

  it("lowers a comma-separated class list, exactly as the figure-level key does", () => {
    const spec = mustLower(twoRideScene("marks=turn_point,apex"));
    expect(spec.lines[1]!.marks).toEqual(["turn_point", "apex"]);
  });

  it("an unknown class is rejected SCHEMA/marks_class_unknown — the SAME vocabulary the figure-level key rejects with", () => {
    const e = refusalOf(lowerScene(twoRideScene("marks=braking_point")));
    expect(e.code).toBe("SCHEMA");
    expect(reasonOf(e)).toBe("marks_class_unknown");
  });

  it("an empty value is rejected SCHEMA/marks_malformed (D8: nothing is accepted and ignored)", () => {
    const e = refusalOf(lowerScene(twoRideScene("marks=")));
    expect(e.code).toBe("SCHEMA");
    expect(reasonOf(e)).toBe("marks_malformed");
  });
});

// ---------------------------------------------------------------------------
// 2. `label=` as a ride key

describe("scene text: `label=` is a ride key (design/04 §7) and is the legend text (design/05 §7)", () => {
  it("lowers a double-quoted label onto the FigureSpec line", () => {
    const spec = mustLower(twoRideScene('label="the cautious line"'));
    expect(spec.lines[1]!.label).toBe("the cautious line");
    expect(spec.lines[0]!.label).toBeUndefined();
  });

  it("carries both keys on one line", () => {
    const spec = mustLower(twoRideScene('marks=all label="every glyph"'));
    expect(spec.lines[1]!.marks).toBe("all");
    expect(spec.lines[1]!.label).toBe("every glyph");
  });

  it("an unquoted value is rejected SCHEMA/label_needs_quotes — design/04 §7 spells it `label=\"…\"`", () => {
    const e = refusalOf(lowerScene(twoRideScene("label=cautious")));
    expect(e.code).toBe("SCHEMA");
    expect(reasonOf(e)).toBe("label_needs_quotes");
  });

  it("a blank label is rejected SCHEMA/label_empty — an empty legend row is accepted-and-ignored ink", () => {
    const e = refusalOf(lowerScene(twoRideScene('label="   "')));
    expect(e.code).toBe("SCHEMA");
    expect(reasonOf(e)).toBe("label_empty");
  });
});

// ---------------------------------------------------------------------------
// 3. THE identity law: omitted when unused

describe("both keys are OMITTED when unused — `spec_hash` covers the lowered form (D30)", () => {
  it("a ride line that authors neither key carries neither PROPERTY", () => {
    const spec = mustLower(twoRideScene(""));
    for (const line of spec.lines) {
      expect(Object.prototype.hasOwnProperty.call(line, "marks")).toBe(false);
      expect(Object.prototype.hasOwnProperty.call(line, "label")).toBe(false);
    }
  });

  it("no line of any of the six committed scenes carries either key", () => {
    for (const id of FIGURE_IDS) {
      const spec = mustLower(readFileSync(resolve(scenesDir, `${id}.scene`), "utf8"));
      for (const line of spec.lines) {
        expect(Object.prototype.hasOwnProperty.call(line, "marks"), `${id}/${line.name}`).toBe(false);
        expect(Object.prototype.hasOwnProperty.call(line, "label"), `${id}/${line.name}`).toBe(false);
      }
    }
  });

  it("authoring the DEFAULT explicitly still moves spec_hash — which is exactly why the key may not be defaulted", () => {
    const bare = specHash(mustLower(twoRideScene("")));
    const explicitAuto = specHash(mustLower(twoRideScene("marks=auto")));
    expect(explicitAuto).not.toBe(bare);
  });

  it("`lineMarksOf` reads the per-line overrides and nothing else — an unauthored figure yields an EMPTY map", () => {
    expect(lineMarksOf(mustLower(twoRideScene("", "all"))).size).toBe(0);
    const overrides = lineMarksOf(mustLower(twoRideScene("marks=none", "all")));
    expect([...overrides.entries()]).toEqual([["alt", "none"]]);
  });
});

// ---------------------------------------------------------------------------
// 4. Spelling invariance (D30: scene text is sugar over FigureSpec JSON)

describe("FigureSpec JSON carries the same two per-line keys (D30: one identity, two spellings)", () => {
  const scene = twoRideScene('marks=turn_point label="the cautious line"', "all");

  it("a hand-written FigureSpec JSON with the per-line keys hashes identically to the scene", () => {
    const lowered = mustLower(scene);
    const json = {
      road: { preset: "book90" },
      lines: [
        { name: "good", role: "ideal", spec: { road: { preset: "book90" }, entry_kmh: 34, turn_in: "auto" } },
        {
          name: "alt",
          role: "alternative",
          marks: ["turn_point"],
          label: "the cautious line",
          spec: { road: { preset: "book90" }, entry_kmh: 28, turn_in: "auto" }
        }
      ],
      marks: "all"
    };
    const validated = validateFigureSpec(json);
    if (!validated.ok) throw new Error(`validateFigureSpec refused: ${JSON.stringify(validated.error)}`);
    expect(validated.value.lines[1]!.marks).toEqual(["turn_point"]);
    expect(validated.value.lines[1]!.label).toBe("the cautious line");
    expect(specHash(validated.value)).toBe(specHash(lowered));
  });

  it("a malformed per-line marks value is rejected SCHEMA/marks_malformed", () => {
    const e = refusalOf(
      validateFigureSpec({
        road: { preset: "book90" },
        lines: [{ name: "good", role: "ideal", marks: "sometimes", spec: { road: { preset: "book90" }, entry_kmh: 34 } }]
      })
    );
    expect(e.code).toBe("SCHEMA");
    expect(reasonOf(e)).toBe("marks_malformed");
  });

  it("a non-string / blank per-line label is rejected SCHEMA/type_mismatch", () => {
    for (const label of [42, ""]) {
      const e = refusalOf(
        validateFigureSpec({
          road: { preset: "book90" },
          lines: [{ name: "good", role: "ideal", label, spec: { road: { preset: "book90" }, entry_kmh: 34 } }]
        })
      );
      expect(e.code).toBe("SCHEMA");
      expect(reasonOf(e)).toBe("type_mismatch");
    }
  });
});

// ---------------------------------------------------------------------------
// 5. The override reaches the INK and the LEGEND (D8: nothing is accepted and
//    ignored). Baked in-process through the same pure verb the CLI runs.

interface Baked {
  readonly svg: string;
  readonly envelope: FigureResult;
}

function bakeScene(sceneText: string): Baked {
  const outcome = figureVerb({
    loadedText: sceneText,
    argv: ["--mode", "true", "--out", "stage/x"],
    engineSemver: ENGINE_SEMVER
  });
  const svg = (outcome.writes ?? []).find((w) => w.path.endsWith(".svg"));
  if (svg === undefined) {
    throw new Error(`bake produced no svg (exit ${outcome.exit}): ${JSON.stringify(outcome.stdout).slice(0, 400)}`);
  }
  return { svg: svg.content, envelope: (outcome.stdout as { value: FigureResult }).value };
}

/** the stage-9 marker group only — `data-line-id` also rides terminals, entry labels and outcome words. */
function markerStage(svg: string): string {
  const open = svg.indexOf('<g data-stage="9-markers">');
  if (open < 0) throw new Error("no stage-9 marker group in the baked SVG");
  const close = svg.indexOf("</g><g", open);
  return svg.slice(open, close < 0 ? undefined : close);
}

function markedLineIds(svg: string): ReadonlySet<string> {
  return new Set([...markerStage(svg).matchAll(/data-line-id="([^"]+)"/g)].map((m) => m[1]!));
}

describe("the per-line override reaches the ink and the legend (D8)", () => {
  it("per-line `marks=none` subtracts one line's glyphs from a figure-level `marks: all`", () => {
    const baked = bakeScene(twoRideScene("marks=none", "all"));
    expect(markedLineIds(baked.svg)).toEqual(new Set(["good"]));
  });

  it("per-line `marks=all` adds glyphs a figure-level `marks: none` withheld", () => {
    const baked = bakeScene(twoRideScene("marks=all", "none"));
    expect(markedLineIds(baked.svg)).toEqual(new Set(["alt"]));
  });

  it("with no per-line key the figure-level spec still governs every line", () => {
    expect(markedLineIds(bakeScene(twoRideScene("", "none")).svg).size).toBe(0);
    expect(markedLineIds(bakeScene(twoRideScene("", "all")).svg)).toEqual(new Set(["good", "alt"]));
  });

  it("an authored `label=` becomes the line's legend row name AND its envelope label (design/05 §7, design/06 §5.3)", () => {
    const baked = bakeScene(twoRideScene('label="the cautious line"'));
    const alt = baked.envelope.lines.find((l) => l.line_id === "alt") as LineResult;
    expect(alt.label).toBe("the cautious line");
    expect(baked.svg).toContain('data-legend-row="alt">the cautious line — alternative');
  });

  it("an unauthored line keeps the solver's own label — the key defaults to nothing, not to the line id", () => {
    const baked = bakeScene(twoRideScene(""));
    const alt = baked.envelope.lines.find((l) => l.line_id === "alt") as LineResult;
    expect(alt.label).not.toBe("alt");
    expect(alt.label.length).toBeGreaterThan(0);
  });
});
