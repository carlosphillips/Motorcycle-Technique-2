// test/property/road.test.ts — WP-02 gates (ARCHITECTURE §8 row WP-02):
//   · DSL round-trip identity (property over generated specs + all presets)
//   · corner records incl. linked_next on the book presets, numbers cross-checked
//     against review/verify/fixture_geometry.py (the independent Python oracle)
//   · super-tight refusal: bookEsses/bookHairpin pass, `R 10 ^180` refuses
//   · truncateAt split rules (mid-arc, mid-taper, boundary)
//   · preset table byte-comparison against the design/03 §3.1 table
//   · corridor algebra: dOf/fOf, governing corner, sideSign, muAt lateral clamp
//
// Error assertions ride code + detail.reason, never message text (ARCHITECTURE §4).

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { parseRoadDSL, printRoadDSL } from "../../src/road/dsl.js";
import { compose } from "../../src/road/compose.js";
import { truncateAt } from "../../src/road/truncate.js";
import {
  PRESETS,
  PRESET_NAMES,
  resolvePreset,
  type PresetName
} from "../../src/road/presets.js";
import { sideSign, governingCorner, withMu } from "../../src/road/corridor.js";
import {
  R_UTURN_MAX,
  SWEEP_UTURN_MIN,
  MIN_SEG_M,
  LINK_GAP_M
} from "../../src/road/constants.js";
import type { Segment, SegmentsRoadSpec } from "../../src/road/types.js";
import type { LinelabError, Result } from "../../src/core/result.js";

const here = dirname(fileURLToPath(import.meta.url));
const DESIGN_03 = join(here, "../../../design/03-roads-scenarios-and-visibility.md");

function reasonOf(e: LinelabError): unknown {
  return e.detail?.["reason"];
}

function unwrap<T>(r: Result<T>): T {
  if (!r.ok) throw new Error(`expected ok, got ${r.error.code}/${String(reasonOf(r.error))}`);
  return r.value;
}

function unwrapErr<T>(r: Result<T>): LinelabError {
  if (r.ok) throw new Error("expected an error result");
  return r.error;
}

// ---------------------------------------------------------------------------
// 1. DSL round-trip identity: parse ∘ print ∘ parse (design/03 §3)

/** Deterministic LCG so the property run is reproducible (no Math.random). */
function makeRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

/** Positive decimals off a 2-dp grid — exactly the strict lexer's language. */
function gridNum(rng: () => number, lo: number, hi: number): number {
  const cents = Math.max(1, Math.round((lo + (hi - lo) * rng()) * 100));
  return cents / 100;
}

function randomSpec(rng: () => number): SegmentsRoadSpec {
  const n = 1 + Math.floor(rng() * 7);
  const segments: Segment[] = [];
  for (let i = 0; i < n; i++) {
    const kind = rng();
    const hand = rng() < 0.5 ? "L" : "R";
    if (kind < 0.34) {
      segments.push({ type: "straight", len_m: gridNum(rng, 0.5, 400) });
    } else if (kind < 0.67) {
      segments.push({
        type: "arc",
        r_m: gridNum(rng, 16, 300), // r > 15 keeps generated corners out of the super-tight regime
        angle_deg: gridNum(rng, 1, 359),
        hand
      });
    } else {
      segments.push({
        type: "taper",
        r1_m: gridNum(rng, 16, 300),
        r2_m: gridNum(rng, 16, 300),
        angle_deg: gridNum(rng, 1, 359),
        hand
      });
    }
  }
  return { lane_width_m: gridNum(rng, 2, 10), segments };
}

describe("road DSL round-trip identity (design/03 §3)", () => {
  it("parse ∘ print is an identity over 150 generated specs, and print ∘ parse is a fixpoint", () => {
    const rng = makeRng(0xc0ffee);
    for (let i = 0; i < 150; i++) {
      const spec = randomSpec(rng);
      const text = printRoadDSL(spec);
      const parsed = unwrap(parseRoadDSL(text));
      expect(parsed.lane_width_m).toBe(spec.lane_width_m);
      expect(parsed.segments).toEqual(spec.segments);
      expect(printRoadDSL(parsed)).toBe(text);
    }
  });

  it("is whitespace-tolerant: a mangled spelling parses to the same spec", () => {
    const canonical = unwrap(parseRoadDSL("lane 3.5 | S 12 | R 12 ^90 | L 16>9 ^130 | S 16"));
    const mangled = unwrap(
      parseRoadDSL("  lane   3.5|S 12 |  R  12   ^90|L 16>9 ^130 |S 16  ")
    );
    expect(mangled).toEqual(canonical);
  });

  it("every §3.1 preset DSL is already canonical: print(parse(dsl)) === dsl byte-for-byte", () => {
    for (const name of PRESET_NAMES) {
      const dsl = PRESETS[name].dsl;
      expect(printRoadDSL(unwrap(parseRoadDSL(dsl)))).toBe(dsl);
    }
  });

  it("accepts `.5` (the ^\\d*\\.?\\d+$ lexer allows a bare leading dot-fraction)", () => {
    const spec = unwrap(parseRoadDSL("lane 3.5 | S .5"));
    expect(spec.segments[0]).toEqual({ type: "straight", len_m: 0.5 });
    // and it still round-trips through the canonical spelling
    expect(printRoadDSL(unwrap(parseRoadDSL(printRoadDSL(spec))))).toBe(printRoadDSL(spec));
  });
});

describe("road DSL strict lexer & grammar rejections (design/03 §3)", () => {
  const cases: ReadonlyArray<[dsl: string, code: string, reason: string]> = [
    // strict number lexer: no signs, no bare dots, no empties, no exponents
    ["lane 3.5 | S -5", "SCHEMA", "dsl_malformed_number"],
    ["lane 3.5 | S +5", "SCHEMA", "dsl_malformed_number"],
    ["lane 3.5 | S 5.", "SCHEMA", "dsl_malformed_number"],
    ["lane 3.5 | S .", "SCHEMA", "dsl_malformed_number"],
    ["lane 3.5 | S 1e3", "SCHEMA", "dsl_malformed_number"],
    ["lane 3.5 | R 12 ^", "SCHEMA", "dsl_malformed_number"],
    // a token can never silently become 0
    ["lane 3.5 | S 0", "BAD_RANGE", "dsl_nonpositive_number"],
    ["lane 0 | S 12", "BAD_RANGE", "dsl_nonpositive_number"],
    // grammar shape
    ["lane 3.5 | R 12 90", "SCHEMA", "dsl_bad_segment"],
    ["lane 3.5 | R 12", "SCHEMA", "dsl_bad_segment"],
    ["lane 3.5 | Q 12 ^90", "SCHEMA", "dsl_bad_segment"],
    ["lane 3.5 | R 16>9>3 ^90", "SCHEMA", "dsl_bad_segment"],
    ["lane 3.5 | S 12 | | S 4", "SCHEMA", "dsl_bad_segment"],
    // lane exactly once and first
    ["S 12 | lane 3.5", "SCHEMA", "dsl_lane_exactly_once_first"],
    ["lane 3.5 | lane 4 | S 12", "SCHEMA", "dsl_lane_exactly_once_first"],
    ["lane 3.5", "SCHEMA", "dsl_no_segments"],
    // reserved grammar space: per-segment width suffix (D8 — named, never ignored)
    ["lane 3.5 | S 40 w=4.0", "SCHEMA", "segment_width_reserved"]
  ];
  for (const [dsl, code, reason] of cases) {
    it(`rejects ${JSON.stringify(dsl)} with ${code}/${reason}`, () => {
      const e = unwrapErr(parseRoadDSL(dsl));
      expect(e.code).toBe(code);
      expect(reasonOf(e)).toBe(reason);
    });
  }
});

// ---------------------------------------------------------------------------
// 2. Preset table byte-comparison against design/03 §3.1 (drift risk #12)

interface DesignPresetRow {
  name: string;
  hand: string;
  dsl: string;
  occluders: string[];
  entry_kmh: number;
}

/** Extract the §3.1 preset table rows from the design doc itself. */
function readDesignPresetTable(): DesignPresetRow[] {
  const text = readFileSync(DESIGN_03, "utf8");
  const lines = text.split("\n");
  const headerIdx = lines.findIndex((l) =>
    l.startsWith("| Preset | Hand | Expansion (at default hand) | Suggested entry |")
  );
  expect(headerIdx).toBeGreaterThan(-1);
  const rows: DesignPresetRow[] = [];
  for (let i = headerIdx + 2; i < lines.length; i++) {
    const line = lines[i] ?? "";
    if (!line.startsWith("|")) break;
    const cells = line.split(/(?<!\\)\|/).map((c) => c.trim());
    // cells: ["", name, hand, expansion, entry, teaches, ""]
    const name = /`(\w+)`/.exec(cells[1] ?? "")?.[1] ?? "";
    const hand = (cells[2] ?? "").replace(/\*/g, "").trim();
    const expansion = cells[3] ?? "";
    const ticks = [...expansion.matchAll(/`([^`]+)`/g)].map((m) =>
      (m[1] ?? "").replace(/\\\|/g, "|")
    );
    const entry = Number(/(\d+(?:\.\d+)?)\s*km\/h/.exec(cells[4] ?? "")?.[1]);
    rows.push({
      name,
      hand,
      dsl: ticks[0] ?? "",
      occluders: ticks.slice(1),
      entry_kmh: entry
    });
  }
  return rows;
}

describe("preset table matches design/03 §3.1 byte-for-byte", () => {
  const rows = readDesignPresetTable();

  it("carries exactly the six design presets, in table order", () => {
    expect(rows.map((r) => r.name)).toEqual([...PRESET_NAMES]);
  });

  for (const row of rows) {
    it(`${row.name}: dsl, hand, occluders, suggested entry`, () => {
      const def = PRESETS[row.name as PresetName];
      expect(def).toBeDefined();
      expect(def.dsl).toBe(row.dsl); // byte comparison
      expect(def.hand).toBe(row.hand);
      expect([...def.occluders]).toEqual(row.occluders);
      expect(def.suggested_entry_kmh).toBe(row.entry_kmh);
    });
  }

  it("bookBlind is the D46 reshape: ^140, S 16 approach, hedge inside c1 -6x36", () => {
    expect(PRESETS.bookBlind.dsl).toBe("lane 3.5 | S 16 | L 12 ^140 | S 16");
    expect(PRESETS.bookBlind.suggested_entry_kmh).toBe(34);
    expect(PRESETS.bookBlind.occluders).toEqual([
      "hedge inside c1 -6x36 margin=1.2 depth=2.5"
    ]);
  });
});

describe("preset resolution and the hand-flip mirror (design/03 §3.1, D26)", () => {
  it("default hand is the table hand; explicit same hand is a no-op", () => {
    expect(unwrap(resolvePreset("book90")).dsl).toBe(PRESETS.book90.dsl);
    expect(unwrap(resolvePreset("book90", "L")).dsl).toBe(PRESETS.book90.dsl);
  });

  it("hand= flips every arc/taper segment L↔R (a road-level mirror)", () => {
    expect(unwrap(resolvePreset("book90", "R")).dsl).toBe("lane 3.5 | S 12 | R 12 ^90 | S 16");
    expect(unwrap(resolvePreset("bookEsses", "L")).dsl).toBe(
      "lane 3.5 | S 8 | L 12 ^75 | S 6 | R 12 ^75 | S 6 | L 12 ^75 | S 6 | R 12 ^75 | S 10"
    );
    expect(unwrap(resolvePreset("bookDecreasing", "R")).dsl).toBe(
      "lane 3.5 | S 10 | R 16>9 ^130 | S 14"
    );
  });

  it("bookBlind's occluder line is byte-identical under any hand flip (hand-relative vocabulary)", () => {
    const l = unwrap(resolvePreset("bookBlind"));
    const r = unwrap(resolvePreset("bookBlind", "R"));
    expect(r.occluders).toEqual(l.occluders);
  });

  it("unknown preset name → UNKNOWN_ID/unknown_preset", () => {
    const e = unwrapErr(resolvePreset("bookNope"));
    expect(e.code).toBe("UNKNOWN_ID");
    expect(reasonOf(e)).toBe("unknown_preset");
  });
});

// ---------------------------------------------------------------------------
// 3. Corner records on the book presets (design/03 §2), numbers cross-checked
// against review/verify/fixture_geometry.py's road() closed forms:
//   book90    s_end = 12 + 12·(π/2)      = 30.849555921538759  (fixture: "s_end 30.85 m")
//   bookBlind s_end = 16 + 12·(140π/180) = 45.321531433504736  (fixture: "s_end 45.32 m",
//             arc 29.321531433504736 — design/03 §4's "29.32 m arc")
//   bookEsses L_arc = 12·(75π/180)       = 15.707963267948966 per leg, links S 6

describe("corner records on the book presets (design/03 §2 / fixture_geometry.py)", () => {
  it("book90: one constant L corner, stations to the fixture's numbers", () => {
    const road = unwrap(compose({ preset: "book90" }));
    expect(road.corners).toHaveLength(1);
    const c1 = road.corners[0]!;
    expect(c1.id).toBe("c1");
    expect(c1.hand).toBe("L");
    expect(c1.type).toBe("constant");
    expect(c1.r).toBe(12);
    expect(c1.r_min).toBe(12);
    expect(c1.r_max).toBe(12);
    expect(c1.r1).toBeUndefined();
    expect(c1.r2).toBeUndefined();
    expect(c1.angle_deg).toBe(90);
    expect(c1.s0).toBe(12);
    expect(c1.s1).toBeCloseTo(30.849555921538759, 10); // fixture s_end 30.85
    expect(c1.s_mid).toBeCloseTo((12 + 30.849555921538759) / 2, 10);
    expect(c1.gap_to_next_m).toBeUndefined(); // absent on the last corner
    expect(c1.linked_next).toBe(false);
    expect(road.total_len_m).toBeCloseTo(46.849555921538759, 10);
  });

  it("bookBlind (D46 reshape): 140° arc of 29.32 m, s_end 45.32", () => {
    const road = unwrap(compose({ preset: "bookBlind" }));
    const c1 = road.corners[0]!;
    expect(c1.s0).toBe(16);
    expect(c1.s1).toBeCloseTo(45.321531433504736, 10); // fixture s_end 45.32
    expect(c1.s1 - c1.s0).toBeCloseTo(29.321531433504736, 10); // the 29.32 m arc
    expect(road.total_len_m).toBeCloseTo(61.321531433504736, 10);
  });

  it("bookEsses: four alternating corners, S 6 links, every link within the flip budget", () => {
    const road = unwrap(compose({ preset: "bookEsses" }));
    expect(road.corners.map((c) => c.id)).toEqual(["c1", "c2", "c3", "c4"]);
    expect(road.corners.map((c) => c.hand)).toEqual(["R", "L", "R", "L"]);
    const L_arc = 15.707963267948966; // 12·(75π/180)
    const c1 = road.corners[0]!;
    expect(c1.s0).toBe(8);
    expect(c1.s1).toBeCloseTo(8 + L_arc, 10);
    for (const c of road.corners.slice(0, 3)) {
      expect(c.gap_to_next_m).toBeCloseTo(LINK_GAP_M, 10); // the S 6 links
      // linked_next ⇔ gap ≤ LINK_GAP_FRAC·min(L_arc, L_arc) = 15.708 — true
      expect(c.linked_next).toBe(true);
    }
    expect(road.corners[3]!.linked_next).toBe(false);
    expect(road.corners[3]!.gap_to_next_m).toBeUndefined();
    expect(road.total_len_m).toBeCloseTo(98.831853071795865, 9); // 8+4·L_arc+3·6+10
  });

  it("bookDecreasing: a decreasing taper — r 16→9, r_min/r_max the extremal radii", () => {
    const road = unwrap(compose({ preset: "bookDecreasing" }));
    const c1 = road.corners[0]!;
    expect(c1.type).toBe("decreasing"); // 16/9 = 1.78 ≥ TAPER_RATIO_MIN
    expect(c1.r1).toBe(16);
    expect(c1.r2).toBe(9);
    expect(c1.r_min).toBe(9);
    expect(c1.r_max).toBe(16);
    expect(c1.r).toBeCloseTo(12.5, 12); // representative mean
    // taper length θ_rad·(r1+r2)/2 = (130π/180)·12.5 = 28.361600344907856
    expect(c1.s1).toBeCloseTo(10 + 28.361600344907856, 10);
  });

  it("bookDoubleApex: c1..c3 form one linked same-hand group, 180° total sweep", () => {
    const road = unwrap(compose({ preset: "bookDoubleApex" }));
    expect(road.corners.map((c) => c.id)).toEqual(["c1", "c2", "c3"]);
    expect(road.corners.every((c) => c.hand === "L")).toBe(true);
    expect(road.corners.reduce((acc, c) => acc + c.angle_deg, 0)).toBe(180);
    // adjacent segments: zero gaps, linked chain
    expect(road.corners[0]!.gap_to_next_m).toBeCloseTo(0, 10);
    expect(road.corners[1]!.gap_to_next_m).toBeCloseTo(0, 10);
    expect(road.corners[0]!.linked_next).toBe(true);
    expect(road.corners[1]!.linked_next).toBe(true);
    expect(road.corners[2]!.linked_next).toBe(false);
    expect(road.corners[1]!.s1).toBeCloseTo(41.415926535897931, 10); // 10 + 12·70° + 24·40° rad
  });

  it("sub-ratio tapers classify constant with r = (r1+r2)/2", () => {
    const road = unwrap(compose({ dsl: "lane 3.5 | S 10 | L 20>19 ^60 | S 10" }));
    const c1 = road.corners[0]!;
    expect(c1.type).toBe("constant"); // 20/19 = 1.053 < 1.15
    expect(c1.r).toBeCloseTo(19.5, 12);
    expect(c1.r_min).toBe(19);
    expect(c1.r_max).toBe(20);
  });

  it("compose discloses the resolved DSL verbatim (preset expansion, authored dsl, printed segments)", () => {
    expect(unwrap(compose({ preset: "bookBlind" })).dsl).toBe(PRESETS.bookBlind.dsl);
    const authored = "  lane 3.5|S 12 | L 12 ^90 |S 16"; // non-canonical spelling rides verbatim
    expect(unwrap(compose({ dsl: authored })).dsl).toBe(authored);
    const spec = unwrap(parseRoadDSL("lane 3.5 | S 12 | R 12 ^90 | S 16"));
    expect(unwrap(compose(spec)).dsl).toBe("lane 3.5 | S 12 | R 12 ^90 | S 16");
  });
});

// ---------------------------------------------------------------------------
// 4. Super-tight refusal — the OWNING statement (design/03 §2, D21):
// refuse OUT_OF_SCOPE iff ≥ 170° of sweep accumulates at r ≤ 15 m, PER CORNER.

describe("super-tight sweep-content refusal (design/03 §2, D21)", () => {
  it("bookEsses passes: 300° of r=12 sweep road-wide, but no corner exceeds 75°", () => {
    expect(compose({ preset: "bookEsses" }).ok).toBe(true);
  });

  it("bookHairpin passes: 150° at r = 10 ≤ 15 is under the 170° cut", () => {
    expect(compose({ preset: "bookHairpin" }).ok).toBe(true);
  });

  it("`R 10 ^180` refuses OUT_OF_SCOPE/super_tight_geometry with the legible detail payload", () => {
    const e = unwrapErr(compose({ dsl: "lane 3.5 | S 10 | R 10 ^180 | S 10" }));
    expect(e.code).toBe("OUT_OF_SCOPE");
    expect(reasonOf(e)).toBe("super_tight_geometry");
    expect(e.detail?.["sweep_below_r_max_deg"]).toBe(180);
    expect(e.detail?.["r_uturn_max_m"]).toBe(R_UTURN_MAX);
  });

  it("`R 16>9 ^130` is in scope: only 111.4° of its sweep sits at r ≤ 15 (design's own number)", () => {
    // r(t) = 16 − 7t ≤ 15 for t ≥ 1/7 → 130·(6/7) = 111.42857142857143°
    expect(compose({ dsl: "lane 3.5 | S 10 | R 16>9 ^130 | S 10" }).ok).toBe(true);
  });

  it("the book-faithful teardrop `R 30>9 ^210` is in scope: 60° at r ≤ 15", () => {
    // r(t) = 30 − 21t ≤ 15 for t ≥ 5/7 → 210·(2/7) = 60°
    expect(compose({ dsl: "lane 3.5 | S 10 | R 30>9 ^210 | S 10" }).ok).toBe(true);
  });

  it("boundary is inclusive on both thresholds: R 15 ^170 refuses; R 15 ^169.9 and R 15.1 ^170 pass", () => {
    const boundary = unwrapErr(compose({ dsl: "lane 3.5 | S 10 | R 15 ^170 | S 10" }));
    expect(boundary.code).toBe("OUT_OF_SCOPE");
    expect(reasonOf(boundary)).toBe("super_tight_geometry");
    expect(compose({ dsl: "lane 3.5 | S 10 | R 15 ^169.9 | S 10" }).ok).toBe(true);
    expect(compose({ dsl: "lane 3.5 | S 10 | R 15.1 ^170 | S 10" }).ok).toBe(true);
    expect(SWEEP_UTURN_MIN).toBe(170);
    expect(R_UTURN_MAX).toBe(15);
  });

  it("the quantifier is per corner: two 90° hairpin-radius corners refuse neither", () => {
    expect(
      compose({ dsl: "lane 3.5 | S 10 | R 10 ^90 | S 8 | R 10 ^90 | S 10" }).ok
    ).toBe(true);
  });

  it("`at` names the offending corner id", () => {
    const e = unwrapErr(
      compose({ dsl: "lane 3.5 | S 10 | R 20 ^45 | S 8 | R 10 ^180 | S 10" })
    );
    expect(e.at).toBe("c2");
  });
});

// ---------------------------------------------------------------------------
// 5. Corridor algebra: dOf/fOf, governing corner, sideSign, muAt clamp
// (design/03 §2; frame per ARCHITECTURE §6.1: d positive = rider's LEFT, own
// lane = d ∈ [−lane_width_m, 0] under right-hand traffic)

describe("corridor and lane fraction f (design/03 §2)", () => {
  it("book90 (left-hander): f = 0 hugs the centreline side, f = 1 the outer own-lane edge", () => {
    // fixture_geometry.py eye offsets: BIKE_MARGIN + f·(3.5 − 2·0.4) → 0.4 / 1.75 / 3.1
    // to the RIGHT of travel; our d is positive-left, so the mirror: −0.4 / −1.75 / −3.1
    const road = unwrap(compose({ preset: "book90" }));
    expect(road.dOf(0, 20)).toBeCloseTo(-0.4, 12); // cut-in radius 12.40 (fixture check 11)
    expect(road.dOf(0.5, 20)).toBeCloseTo(-1.75, 12);
    expect(road.dOf(1, 20)).toBeCloseTo(-3.1, 12); // hold-wide radius 15.10
  });

  it("a right-hander mirrors the map: f = 0 sits at the own-lane outer edge", () => {
    const road = unwrap(compose({ preset: "bookHairpin" }));
    expect(road.dOf(0, 15)).toBeCloseTo(-3.1, 12); // inside of an R corner = rider's right
    expect(road.dOf(1, 15)).toBeCloseTo(-0.4, 12);
  });

  it("fOf is the exact inverse of dOf everywhere f is accepted", () => {
    const road = unwrap(compose({ preset: "bookEsses" }));
    for (const s of [0, 10, 25, 40, 60, 95]) {
      for (const f of [-0.25, 0, 0.3, 0.5, 1, 1.4]) {
        expect(road.fOf(road.dOf(f, s), s)).toBeCloseTo(f, 10);
      }
    }
  });

  it("opposite-hand handoff at s1: d is continuous while f re-reads as 1 − f", () => {
    const road = unwrap(compose({ preset: "bookEsses" }));
    const c1 = road.corners[0]!; // R, s1 = 23.708
    const d = road.dOf(0.3, c1.s1 - 1); // measured in c1's frame
    expect(road.fOf(d, c1.s1 + 1)).toBeCloseTo(0.7, 10); // same d in c2's (L) frame
    expect(road.fOf(d, c1.s1)).toBeCloseTo(0.7, 10); // handoff is AT s1
  });

  it("use_full_width rescales the corridor to the whole carriageway inset at the outer edges", () => {
    const road = unwrap(compose({ preset: "book90", use_full_width: true }));
    // left-hander: inside edge (f=0) is across the centreline at +3.1; outer at −3.1
    expect(road.dOf(0, 20)).toBeCloseTo(3.1, 12);
    expect(road.dOf(1, 20)).toBeCloseTo(-3.1, 12);
    expect(road.fOf(road.dOf(0.25, 20), 20)).toBeCloseTo(0.25, 10);
  });

  it("governing corner: containing corner, else nearest downstream, else the last", () => {
    const road = unwrap(compose({ preset: "bookEsses" }));
    const [c1, c2, , c4] = road.corners;
    expect(governingCorner(road.corners, 0)?.id).toBe("c1"); // entry straight → downstream
    expect(governingCorner(road.corners, 10)?.id).toBe("c1"); // containing
    expect(governingCorner(road.corners, c1!.s1)?.id).toBe("c2"); // handoff at s1 exactly
    expect(governingCorner(road.corners, c2!.s1 + 3)?.id).toBe("c3"); // link straight → downstream
    expect(governingCorner(road.corners, road.total_len_m)?.id).toBe(c4!.id); // after the last
  });

  it("a corner-less road still carries a defined, deterministic f frame", () => {
    const road = unwrap(compose({ dsl: "lane 8 | S 400" })); // the F-AN-* fixture road
    expect(road.corners).toHaveLength(0);
    expect(Number.isFinite(road.dOf(1, 200))).toBe(true);
    expect(road.fOf(road.dOf(0.25, 200), 200)).toBeCloseTo(0.25, 10);
  });

  it("sideSign: left/right are rider-relative; inside/outside resolve through the hand", () => {
    // fixture_geometry.py check 8: on a LEFT-hander `inside` lies across the
    // centreline (+d, rider's left); on a RIGHT-hander it lies just beyond the
    // rider's OWN lane edge (−d).
    expect(sideSign("left", "L")).toBe(1);
    expect(sideSign("left", "R")).toBe(1);
    expect(sideSign("right", "L")).toBe(-1);
    expect(sideSign("right", "R")).toBe(-1);
    expect(sideSign("inside", "L")).toBe(1);
    expect(sideSign("inside", "R")).toBe(-1);
    expect(sideSign("outside", "L")).toBe(-1);
    expect(sideSign("outside", "R")).toBe(1);
  });

  it("muAt clamps laterally beyond the carriageway ONLY (D19) — no grass physics", () => {
    const road = unwrap(compose({ preset: "book90" }));
    expect(road.muAt(20, 0)).toBe(1);
    expect(road.muAt(20, 99)).toBe(road.muAt(20, road.lane_width_m));
    expect(road.muAt(20, -99)).toBe(road.muAt(20, -road.lane_width_m));
    // the clamp law survives a rebuilt μ field (withMu is how World assembly folds config.mu)
    const dReader = withMu(road, (_s, dClamped) => dClamped);
    expect(dReader.muAt(20, 99)).toBe(road.lane_width_m);
    expect(dReader.muAt(20, -99)).toBe(-road.lane_width_m);
    expect(dReader.muAt(20, 1.2)).toBe(1.2);
  });
});

// ---------------------------------------------------------------------------
// 6. Composed geometry: the dense station lookup, world mapping, projection

describe("composed geometry (design/03 §2: origin start, +x heading, ds_m lookup)", () => {
  it("book90 runs east, then arcs left (y-down frame: left = −y), fixture road() mirrored", () => {
    const road = unwrap(compose({ preset: "book90" }));
    expect(road.psi_road(6)).toBe(0);
    expect(road.kappa_road(6)).toBe(0);
    // mid-arc (θ = 45°): fixture pt = (12 + 12·sin45, +(12 − 12·cos45)) with y-up left-hand
    // convention; our y-down frame mirrors y. kappa = handSign(L)/12 = −1/12.
    const sMid = 12 + 18.849555921538759 / 2;
    const p = road.worldAt(sMid, 0);
    expect(p.x).toBeCloseTo(12 + 12 * Math.SQRT1_2, 9);
    expect(p.y).toBeCloseTo(-(12 - 12 * Math.SQRT1_2), 9);
    expect(road.kappa_road(sMid)).toBeCloseTo(-1 / 12, 12);
    expect(road.psi_road(road.corners[0]!.s1 + 1)).toBeCloseTo(-Math.PI / 2, 9);
  });

  it("taper curvature runs r1 → r2 linear in swept angle (design/03 §2, §7a.4)", () => {
    const road = unwrap(compose({ preset: "bookDecreasing" }));
    expect(road.kappa_road(10.001)).toBeCloseTo(-1 / 16, 4);
    // half sweep (t = 0.5): local ℓ = θ_rad·0.5·(16 + 12.5)/2 = 16.166112196597478, r = 12.5
    expect(road.kappa_road(10 + 16.166112196597478)).toBeCloseTo(-1 / 12.5, 9);
    expect(road.kappa_road(38.3)).toBeCloseTo(-1 / 9, 3);
  });

  it("taper world positions match the closed form (verified against numeric integration)", () => {
    // bookDecreasing's taper starts at (10, 0) heading +x; the closed-form end
    // point (u, v integrals of r(θ)·{cos, sin}θ) was cross-checked against a
    // 2·10⁶-step numeric integration: (21.962658270, −19.421720837), psi = −130°.
    const road = unwrap(compose({ preset: "bookDecreasing" }));
    const c1 = road.corners[0]!;
    const end = road.worldAt(c1.s1, 0);
    expect(end.x).toBeCloseTo(21.962658270, 7);
    expect(end.y).toBeCloseTo(-19.421720837, 7);
    expect(road.psi_road(c1.s1)).toBeCloseTo((-130 * Math.PI) / 180, 9);
    // dense stations advance by ~ds_m of ARC length: consecutive chords never
    // exceed ds and stay close to it (a wrong u/v would break this immediately)
    for (let i = 1; i < road.stations.length - 1; i++) {
      const p = road.stations[i - 1]!;
      const q = road.stations[i]!;
      const chord = Math.hypot(q.x - p.x, q.y - p.y);
      expect(chord).toBeLessThanOrEqual(0.5 + 1e-9);
      expect(chord).toBeGreaterThan(0.49);
    }
  });

  it("dense stations run 0 → total_len_m at ds_m spacing with an exact final row", () => {
    const road = unwrap(compose({ preset: "book90" }));
    expect(road.stations[0]).toMatchObject({ s: 0, x: 0, y: 0, psi: 0 });
    expect(road.stations[1]!.s).toBeCloseTo(0.5, 12);
    expect(road.stations[road.stations.length - 1]!.s).toBeCloseTo(road.total_len_m, 12);
  });

  it("project inverts worldAt: world position → {s, d} within tolerance", () => {
    const road = unwrap(compose({ preset: "bookEsses" }));
    for (const [s, d] of [
      [4, 0],
      [15, -1.2],
      [27, 0.8],
      [55, -3.0],
      [90, 2.0]
    ] as const) {
      const p = road.worldAt(s, d);
      const back = road.project(p.x, p.y);
      expect(back.s).toBeCloseTo(s, 5);
      expect(back.d).toBeCloseTo(d, 5);
    }
  });

  it("the composed model is frozen — road properties, never solver guesses", () => {
    const road = unwrap(compose({ preset: "book90" }));
    expect(Object.isFrozen(road)).toBe(true);
    expect(Object.isFrozen(road.corners)).toBe(true);
    expect(Object.isFrozen(road.corners[0])).toBe(true);
    expect(Object.isFrozen(road.segments)).toBe(true);
  });

  it("degenerate specs refuse BAD_RANGE, never NaN geometry", () => {
    const empty = unwrapErr(compose({ lane_width_m: 3.5, segments: [] }));
    expect(empty.code).toBe("BAD_RANGE");
    expect(reasonOf(empty)).toBe("empty_road");
    const corridor = unwrapErr(
      compose({ dsl: "lane 3.5 | S 10", bike_margin_m: 1.75 }) // 2·bm = lane width
    );
    expect(corridor.code).toBe("BAD_RANGE");
    expect(reasonOf(corridor)).toBe("corridor_degenerate");
  });
});

// ---------------------------------------------------------------------------
// 7. truncateAt split rules (design/03 §7a.4; v0.1 road-layer primitive, §7a.11)

describe("truncateAt (design/03 §7a.4)", () => {
  const BOOK90 = { dsl: "lane 3.5 | S 12 | L 12 ^90 | S 16" } as const;

  it("mid-straight: len := ℓ", () => {
    const spec = unwrap(truncateAt(BOOK90, 6));
    expect(spec.lane_width_m).toBe(3.5);
    expect(spec.segments).toEqual([{ type: "straight", len_m: 6 }]);
  });

  it("mid-arc: θ := θ·ℓ/L (half the arc keeps half the sweep)", () => {
    const halfArc = 18.849555921538759 / 2;
    const spec = unwrap(truncateAt(BOOK90, 12 + halfArc));
    expect(spec.segments).toHaveLength(2);
    const arc = spec.segments[1]!;
    expect(arc.type).toBe("arc");
    if (arc.type === "arc") {
      expect(arc.r_m).toBe(12);
      expect(arc.angle_deg).toBeCloseTo(45, 9);
      expect(arc.hand).toBe("L"); // hand carries through
    }
    // the truncated road composes and ends exactly at the cut station
    expect(unwrap(compose(spec)).total_len_m).toBeCloseTo(12 + halfArc, 9);
  });

  it("mid-taper: solve the quadratic — θ := θ·t, r2 := r(t) (bookDecreasing at t = 0.5)", () => {
    // L(t=0.5) = θ_rad·0.5·(16 + 12.5)/2 = 16.166112196597478 → s = 26.166112196597478
    const s = 10 + 16.166112196597478;
    const spec = unwrap(truncateAt({ preset: "bookDecreasing" }, s));
    expect(spec.segments).toHaveLength(2);
    const taper = spec.segments[1]!;
    expect(taper.type).toBe("taper");
    if (taper.type === "taper") {
      expect(taper.r1_m).toBe(16);
      expect(taper.r2_m).toBeCloseTo(12.5, 9); // r(0.5) = 16 + (9−16)·0.5
      expect(taper.angle_deg).toBeCloseTo(65, 9); // 130·0.5
      expect(taper.hand).toBe("L");
    }
    expect(unwrap(compose(spec)).total_len_m).toBeCloseTo(s, 9);
    // spliced fragments re-classify on compose (§7a.4 edge surface): 16→12.5 is
    // still ≥ TAPER_RATIO_MIN, so the fragment stays a decreasing corner
    expect(unwrap(compose(spec)).corners[0]!.type).toBe("decreasing");
  });

  it("a cut exactly on a segment boundary keeps the segment whole and splits nothing", () => {
    const spec = unwrap(truncateAt(BOOK90, 12));
    expect(spec.segments).toEqual([{ type: "straight", len_m: 12 }]);
  });

  it("fragments shorter than MIN_SEG_M are dropped", () => {
    const spec = unwrap(truncateAt(BOOK90, 12 + MIN_SEG_M / 2));
    expect(spec.segments).toEqual([{ type: "straight", len_m: 12 }]);
  });

  it("a cut at/past the road end is the identity — nothing past s to drop", () => {
    const full = unwrap(truncateAt(BOOK90, 1000));
    expect(full.segments).toEqual([...unwrap(parseRoadDSL(BOOK90.dsl)).segments]);
  });

  it("s ≤ 0 rejects BAD_RANGE/truncate_outside_road", () => {
    const e = unwrapErr(truncateAt(BOOK90, 0));
    expect(e.code).toBe("BAD_RANGE");
    expect(reasonOf(e)).toBe("truncate_outside_road");
  });

  it("the result is an ordinary roadSpec: it prints, re-parses, and re-composes", () => {
    const spec = unwrap(truncateAt({ preset: "bookDecreasing" }, 26.166112196597478 + 10));
    const text = printRoadDSL(spec);
    expect(unwrap(parseRoadDSL(text)).segments).toEqual([...spec.segments]);
    expect(compose(spec).ok).toBe(true);
  });

  it("bike_margin_m / use_full_width carry through exactly as authored", () => {
    const withOpts = unwrap(
      truncateAt({ dsl: "lane 3.5 | S 12 | L 12 ^90 | S 16", use_full_width: true }, 6)
    );
    expect(withOpts.use_full_width).toBe(true);
    expect(withOpts.bike_margin_m).toBeUndefined(); // unauthored stays implicit
  });
});
