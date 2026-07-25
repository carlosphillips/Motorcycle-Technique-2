// test/cli/scene.test.ts — WP-13 gate: `lowerScene` pure/total/deterministic on
// all six committed book-figure scenes (design/04 §7; D30), `specHash` on the
// lowered form, the `A-FIGURE-JSON-PARITY` precursor (scene spelling vs a
// hand-lowered FigureSpec JSON → identical spec_hash), and the malformed-scene
// typed-rejection surface.
//
// The six `.scene` files are read from `../figures/` (the design-of-record
// source, `ARCHITECTURE.md` §3: "read-only from here"). Reading them with
// node:fs is legal in tests (only `src/` is IO-pure, ARCHITECTURE §2).

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { lowerScene } from "../../src/plan/scene.js";
import { specHash } from "../../src/plan/figure.js";
import type { FigureSpec } from "../../src/plan/types.js";

const here = dirname(fileURLToPath(import.meta.url));
const figuresDir = resolve(here, "../../../figures");

function readScene(name: string): string {
  return readFileSync(resolve(figuresDir, name), "utf8");
}

function mustLower(sceneText: string): FigureSpec {
  const result = lowerScene(sceneText);
  if (!result.ok) {
    throw new Error(`expected lowerScene to succeed, got ${result.error.code}/${result.error.detail?.["reason"]}: ${result.error.message}`);
  }
  return result.value;
}

// ---------------------------------------------------------------------------
// All six committed scenes lower cleanly, as readable inline-literal snapshots
// (not opaque vitest snapshots — ARCHITECTURE's test-quality bar).

describe("lowerScene — the six committed book-figure scenes lower cleanly", () => {
  it("fig-08-01 (premature turn point): road, lines, occluders, marks, labels, view, note", () => {
    const spec = mustLower(readScene("fig-08-01.scene"));
    expect(spec).toEqual({
      road: { preset: "book90" },
      occluders: [{ kind: "vehicle", at: { ref: "exit:c1", offset_m: 5 }, lane: "oncoming" }],
      lines: [
        { name: "good", role: "ideal", spec: { road: { preset: "book90" }, entry_kmh: 34, turn_in: "auto" } },
        { name: "bad", role: "mistake", spec: { kind: "premature" } }
      ],
      labels: [
        { feature: "turn_point", line: "bad", text: "premature turn point" },
        { feature: "apex", line: "good", text: "late apex — sight and exit" }
      ],
      marks: ["turn_point"],
      view: { mode: "diagram", window: "auto" },
      note: "Turn in too soon and the geometry points the exit wide — toward the oncoming vehicle."
    });
  });

  it("fig-08-02 (slow steering): no occluders/labels, marks + note carried", () => {
    const spec = mustLower(readScene("fig-08-02.scene"));
    expect(spec).toEqual({
      road: { preset: "book90" },
      lines: [
        { name: "good", role: "ideal", spec: { road: { preset: "book90" }, entry_kmh: 34, turn_in: "auto" } },
        { name: "bad", role: "mistake", spec: { kind: "slow_steer" } }
      ],
      marks: ["turn_point"],
      view: { mode: "diagram", window: "auto" },
      note: "Same turn-in point, but the slow roll to full lean eats corner angle — the line runs deep."
    });
  });

  it("fig-08-03 (fifty-pencing): label #n disambiguator carried", () => {
    const spec = mustLower(readScene("fig-08-03.scene"));
    expect(spec).toEqual({
      road: { preset: "book90" },
      lines: [
        { name: "good", role: "ideal", spec: { road: { preset: "book90" }, entry_kmh: 34, turn_in: "auto" } },
        { name: "bad", role: "mistake", spec: { kind: "fifty_pence" } }
      ],
      labels: [
        { feature: "turn_point", n: 1, line: "bad", text: "first of six inputs" },
        { feature: "apex", line: "good", text: "one smooth input" }
      ],
      marks: ["turn_point"],
      view: { mode: "diagram", window: "auto" },
      note: "Six steering inputs where one would do — the faceted line the book calls fifty-pencing."
    });
  });

  it("fig-08-04 (decreasing radius): style=single carried, no marks/occluders", () => {
    const spec = mustLower(readScene("fig-08-04.scene"));
    expect(spec).toEqual({
      road: { preset: "bookDecreasing" },
      lines: [
        {
          name: "good",
          role: "ideal",
          spec: { road: { preset: "bookDecreasing" }, entry_kmh: 34, turn_in: "auto", style: "single" }
        },
        { name: "bad", role: "mistake", spec: { kind: "overspeed", params: { by_kmh: "2.5" } } }
      ],
      labels: [
        { feature: "apex", line: "good", text: "wait for the radius to open" },
        { feature: "run_wide_detect", line: "bad", text: "too fast — pushed wide as it tightens" }
      ],
      view: { mode: "diagram", window: "auto" },
      note: "The radius tightens toward the exit; enter too fast and the late-apex line cannot be held."
    });
  });

  it("fig-08-05 (double apex): a `mistake` line takes role=mistake with no override, and marks: names two classes", () => {
    const spec = mustLower(readScene("fig-08-05.scene"));
    expect(spec).toEqual({
      road: { preset: "bookDoubleApex" },
      lines: [
        { name: "good", role: "ideal", spec: { road: { preset: "bookDoubleApex" }, entry_kmh: 30, turn_in: "auto" } },
        // a `mistake` KIND line is role=mistake by construction — no `role=`
        // token needed, unlike a 2nd `ride` line, which defaults to "alternative"
        { name: "early", role: "mistake", spec: { kind: "premature" } }
      ],
      labels: [
        { feature: "apex", n: 1, line: "good", text: "first touch" },
        { feature: "apex", n: 1, line: "early", text: "early apex - hard on the inside of c1" },
        { feature: "run_wide_detect", line: "early", text: "no geometry left for c2 - off the outside edge" }
      ],
      // `marks: turn_point,apex` — a class LIST, so both classes are drawn on
      // EVERY line's events, not just the ideal's (the `auto` default is
      // ideal-only; render/markers.ts `enabledClasses`)
      marks: ["turn_point", "apex"],
      view: { mode: "diagram", window: "auto" },
      note: "Touch the inside of the first corner too soon and the compound corner takes the exit away."
    });
  });

  it("fig-08-06 (esses): mistake @all scope, orient= view token rides through opaque as a string", () => {
    const spec = mustLower(readScene("fig-08-06.scene"));
    expect(spec).toEqual({
      road: { preset: "bookEsses" },
      lines: [
        { name: "good", role: "ideal", spec: { road: { preset: "bookEsses" }, entry_kmh: 32, turn_in: "auto" } },
        { name: "bad", role: "mistake", spec: { kind: "premature", scope: "all_corners" } }
      ],
      view: { mode: "diagram", orient: "90" },
      note: "Each corner wider than the last — an early turn-in compounds through the sequence."
    });
  });
});

// ---------------------------------------------------------------------------
// Purity/totality/determinism: identical scene text lowers to a
// structurally-identical FigureSpec every time (D30's "pure total lowering").

describe("lowerScene is pure, total, and deterministic", () => {
  const SCENE_FILES = [
    "fig-08-01.scene", "fig-08-02.scene", "fig-08-03.scene",
    "fig-08-04.scene", "fig-08-05.scene", "fig-08-06.scene"
  ];

  for (const name of SCENE_FILES) {
    it(`${name}: lowering twice yields the identical FigureSpec`, () => {
      const text = readScene(name);
      const first = mustLower(text);
      const second = mustLower(text);
      expect(second).toEqual(first);
    });

    it(`${name}: specHash is stable across repeated lowerings`, () => {
      const text = readScene(name);
      expect(specHash(mustLower(text))).toBe(specHash(mustLower(text)));
    });
  }

  it("total: malformed input returns Result, never throws", () => {
    for (const bad of ["", "garbage\n", "road: preset\n", "lines:\n  x: y z\n"]) {
      expect(() => lowerScene(bad)).not.toThrow();
    }
  });
});

// ---------------------------------------------------------------------------
// A-FIGURE-JSON-PARITY precursor (design/03 §8, D30): a scene and its
// independently hand-lowered FigureSpec JSON hash identically — spec_hash is
// spelling-independent.

describe("spelling invariance — scene vs hand-lowered FigureSpec JSON", () => {
  it("fig-08-02's scene spelling and a hand-built equivalent FigureSpec hash identically", () => {
    const fromScene = mustLower(readScene("fig-08-02.scene"));

    const handLowered: FigureSpec = {
      road: { preset: "book90" },
      lines: [
        { name: "good", role: "ideal", spec: { road: { preset: "book90" }, entry_kmh: 34, turn_in: "auto" } },
        { name: "bad", role: "mistake", spec: { kind: "slow_steer" } }
      ],
      marks: ["turn_point"],
      view: { mode: "diagram", window: "auto" },
      note: "Same turn-in point, but the slow roll to full lean eats corner angle — the line runs deep."
    };

    expect(specHash(handLowered)).toBe(specHash(fromScene));
  });

  it("key order and object construction order never move the hash (canonicalize sorts keys)", () => {
    const a: FigureSpec = {
      road: { preset: "book90" },
      lines: [{ name: "g", role: "ideal", spec: { road: { preset: "book90" }, entry_kmh: 34 } }]
    };
    const b: FigureSpec = {
      lines: [{ spec: { entry_kmh: 34, road: { preset: "book90" } }, role: "ideal", name: "g" }],
      road: { preset: "book90" }
    };
    expect(specHash(a)).toBe(specHash(b));
  });
});

// ---------------------------------------------------------------------------
// note / labels carried through (design/04 §7) — a focused check beyond the
// full-scene snapshots above, on a scene exercising both the `#n` and the
// omitted-`@line` sugar paths.

describe("note and labels are carried through unchanged", () => {
  it("note text is byte-identical to the quoted scene value", () => {
    const spec = mustLower(readScene("fig-08-01.scene"));
    expect(spec.note).toBe("Turn in too soon and the geometry points the exit wide — toward the oncoming vehicle.");
  });

  it("an omitted @line resolves to the first ideal-role line (apex:<id> / bare-feature sugar)", () => {
    const spec = mustLower(
      [
        "road:      preset book90",
        "lines:",
        "  good:    ride entry=34 turnIn=auto",
        "  bad:     mistake premature",
        "labels:",
        "  apex \"the sugar-resolved label\"",
        'note:      "n/a"'
      ].join("\n")
    );
    expect(spec.labels).toEqual([{ feature: "apex", line: "good", text: "the sugar-resolved label" }]);
  });
});

// ---------------------------------------------------------------------------
// Malformed-scene rejections — typed errors, asserted on code + detail.reason
// (never message text, per ARCHITECTURE §4).

describe("malformed scenes are rejected with typed errors", () => {
  const MINIMAL_GOOD_LINE = "road:      preset book90\nlines:\n  good:    ride entry=34 turnIn=auto\n";

  it("unknown ride field → SCHEMA/ride_unknown_key", () => {
    const text = "road: preset book90\nlines:\n  good: ride entry=34 frobnicate=1\n";
    const result = lowerScene(text);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("SCHEMA");
      expect(result.error.detail?.["reason"]).toBe("ride_unknown_key");
    }
  });

  it("unknown top-level key → SCHEMA/scene_unknown_key", () => {
    const text = MINIMAL_GOOD_LINE + "wibble: nonsense\n";
    const result = lowerScene(text);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("SCHEMA");
      expect(result.error.detail?.["reason"]).toBe("scene_unknown_key");
    }
  });

  it("bad line spec (unrecognized kind) → SCHEMA/scene_line_kind_unknown", () => {
    const text = "road: preset book90\nlines:\n  good: ride entry=34 turnIn=auto\n  bad: bogus foo\n";
    const result = lowerScene(text);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("SCHEMA");
      expect(result.error.detail?.["reason"]).toBe("scene_line_kind_unknown");
    }
  });

  it("occluder anchor with an embedded offset → SCHEMA/anchor_embedded_offset (delegates to plan/anchors.ts)", () => {
    const text = MINIMAL_GOOD_LINE + "occluders: hedge inside c1-6 -6x36 margin=1.2\n";
    const result = lowerScene(text);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("SCHEMA");
      expect(result.error.detail?.["reason"]).toBe("anchor_embedded_offset");
    }
  });

  it("a zero-ride scene (mistake with no reference line) → SCHEMA/scene_no_reference_line", () => {
    const text = "road: preset book90\nlines:\n  bad: mistake premature\n";
    const result = lowerScene(text);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("SCHEMA");
      expect(result.error.detail?.["reason"]).toBe("scene_no_reference_line");
    }
  });

  it("missing road: → SCHEMA/scene_road_missing", () => {
    const result = lowerScene("lines:\n  good: ride entry=34 turnIn=auto\n");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("SCHEMA");
      expect(result.error.detail?.["reason"]).toBe("scene_road_missing");
    }
  });

  it("a mistake token with a lineId= prefix inside a scene entry is rejected (the entry name IS the id)", () => {
    const scene = "road: preset book90\nlines:\n  good: ride entry=34 turnIn=auto\n  bad: mistake other=premature\n";
    const result = lowerScene(scene);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("SCHEMA");
      expect(result.error.detail?.["reason"]).toBe("mistake_lineid_not_allowed_in_scene");
    }
  });

  it("naive/plan line kinds are recognized but rejected as unsupported in the v0.1 build", () => {
    const naive = "road: preset book90\nlines:\n  good: ride entry=34 turnIn=auto\n  n: naive\n";
    const r1 = lowerScene(naive);
    expect(r1.ok).toBe(false);
    if (!r1.ok) expect(r1.error.detail?.["reason"]).toBe("scene_line_kind_unsupported_v0_1");

    const plan = "road: preset book90\nlines:\n  good: ride entry=34 turnIn=auto\n  p: plan foo.json\n";
    const r2 = lowerScene(plan);
    expect(r2.ok).toBe(false);
    if (!r2.ok) expect(r2.error.detail?.["reason"]).toBe("scene_line_kind_unsupported_v0_1");
  });

  it("a road-anchor label spelling (entry:/mid:) is a typed rejection, not a silent misparse", () => {
    const text = MINIMAL_GOOD_LINE + 'labels:\n  entry:c1 "turn in late"\n';
    const result = lowerScene(text);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("SCHEMA");
      expect(result.error.detail?.["reason"]).toBe("label_road_anchor_unsupported");
    }
  });
});
