// Contract tests for tools/raster-core.mjs — the PURE half of the design/09 §7
// step-2 headless-browser rasterizer.
//
// What this file tests: the arithmetic and the byte-shaping that decide whether a
// raster is correct — the target-scale derivation from an SVG's own width/height
// attributes, the Rec. 709 luminance transform, the 8-bit greyscale PNG encoder,
// and the raster manifest's shape. All of it is a pure function of its inputs.
//
// What this file deliberately does NOT test: the browser. `npm test` never
// launches Chrome — design/09 §7.4 says "CI never invokes the judge", and the
// rasterizer is the judge leg's feeder. Nothing here is `.skip`ped or
// conditionally green; a skipped test that reports green is coverage theatre and
// design/09 §8 rejects it. The launch/screenshot half is IO at the edge and is
// exercised by running `npm run raster` by hand, which is how tools/ is invoked
// in this repo (cf. tools/restamp-figures.mjs, which no test invokes either).
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { inflateSync, crc32 } from "node:zlib";

import {
  RASTER_SCALE,
  TARGET_WIDTH_PX,
  parseSvgSize,
  rasterTarget,
  greyLuminance,
  compositeOverWhite,
  toGreySamples,
  encodeGreyPng,
  contentHash,
  readPngHeader,
  inkBounds,
  rasterOutputRecord,
  rasterManifest,
  outputNames,
  // @ts-expect-error — tools/ is outside the tsc program (tsconfig rootDir/include = "src"),
  // so this plain-ESM module carries no .d.ts. vitest resolves it at runtime.
} from "../../tools/raster-core.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const lab = resolve(here, "../.."); // linelab/
const bakedDir = join(lab, "figures");

const FIGURE_IDS = [
  "fig-08-01",
  "fig-08-02",
  "fig-08-03",
  "fig-08-04",
  "fig-08-05",
  "fig-08-06",
] as const;

/** The width/height attributes the six committed SVGs actually declare, measured. */
const COMMITTED_SVG_BOX: Record<string, { width: number; height: number }> = {
  "fig-08-01": { width: 1000, height: 1147 },
  "fig-08-02": { width: 1000, height: 1147 },
  "fig-08-03": { width: 1000, height: 1147 },
  "fig-08-04": { width: 1000, height: 1295 },
  "fig-08-05": { width: 1000, height: 1387 },
  "fig-08-06": { width: 1000, height: 1357 },
};

// ---------------------------------------------------------------------------
// parseSvgSize — read the declared box off the real committed corpus

describe("parseSvgSize: the declared box comes off the SVG's own root attributes", () => {
  for (const id of FIGURE_IDS) {
    it(`${id}: reads the width/height the committed SVG declares`, () => {
      const svg = readFileSync(join(bakedDir, `${id}.svg`), "utf8");
      const got = parseSvgSize(svg);
      expect(got.ok, `parseSvgSize(${id}) failed: ${got.ok ? "" : got.error}`).toBe(true);
      expect(got.value).toEqual(COMMITTED_SVG_BOX[id]);
    });
  }

  it("accepts px-suffixed and decimal lengths", () => {
    expect(parseSvgSize(`<svg width="800px" height="600px"></svg>`).value).toEqual({
      width: 800,
      height: 600,
    });
    expect(parseSvgSize(`<svg width="1000.5" height="1387.25"></svg>`).value).toEqual({
      width: 1000.5,
      height: 1387.25,
    });
  });

  it("reads the ROOT element, not a nested <svg> or a marker's width", () => {
    const nested = `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="1387"><defs><marker id="a" markerWidth="6" markerHeight="6"/></defs><svg width="10" height="10"></svg></svg>`;
    expect(parseSvgSize(nested).value).toEqual({ width: 1000, height: 1387 });
  });

  it("is a Result, not a throw: a missing or non-numeric box is an error value", () => {
    for (const bad of [
      `<svg xmlns="http://www.w3.org/2000/svg"></svg>`,
      `<svg width="1000"></svg>`,
      `<svg width="100%" height="100%"></svg>`,
      `<svg width="0" height="1387"></svg>`,
      `<svg width="-10" height="10"></svg>`,
      `not an svg at all`,
    ]) {
      const got = parseSvgSize(bad);
      expect(got.ok, `expected a failure for: ${bad}`).toBe(false);
      expect(typeof got.error).toBe("string");
      expect(got.error.length).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// rasterTarget — the arithmetic the committed rasters got wrong
//
// The committed rasters are 2× the declared box in CANVAS but 1× in INK: the
// prior step rendered at 1× onto a 2× canvas. These assertions pin both halves —
// the device-pixel size AND the CSS viewport the ink must fill at that scale.

describe("rasterTarget: 2× scale, aspect preserved, ink filling the canvas", () => {
  it("the scale is the letter's number, and 2000 px is what it yields HERE", () => {
    // design/09 §7 step 2 says "at 2× scale". The 2000 px width is not an input:
    // it is 2 × the 1000 px nominal frame every committed figure declares.
    expect(RASTER_SCALE).toBe(2);
    expect(TARGET_WIDTH_PX).toBe(2000);
    for (const id of FIGURE_IDS) expect(COMMITTED_SVG_BOX[id]!.width).toBe(1000);
  });

  for (const id of FIGURE_IDS) {
    it(`${id}: 2× the committed box, and the CSS viewport equals the declared box`, () => {
      const box = COMMITTED_SVG_BOX[id]!;
      const got = rasterTarget(box, RASTER_SCALE);
      expect(got.ok).toBe(true);
      expect(got.value.scale).toBe(2);
      expect(got.value.pixelWidth).toBe(TARGET_WIDTH_PX);
      expect(got.value.pixelHeight).toBe(box.height * 2);
      // The fix for the 1×-on-2×-canvas defect: the page is laid out at the SVG's
      // own CSS box and the SCALE does the enlarging, so the ink fills the raster.
      expect(got.value.cssWidth).toBe(box.width);
      expect(got.value.cssHeight).toBe(box.height);
    });
  }

  it("a box that is NOT the 1000 px frame still renders at 2×, and so is not 2000 px wide", () => {
    // src/render/fallback.ts declares 400×120 — the SVG renderTopdown returns
    // instead of throwing. Scaling it to a fixed 2000 px would be 5× enlargement
    // written out under the name `.2x.png`, i.e. a file name asserting a scale
    // the file does not have. This is the case that pins the difference.
    expect(rasterTarget({ width: 400, height: 120 }, RASTER_SCALE).value).toEqual({
      scale: 2,
      cssWidth: 400,
      cssHeight: 120,
      pixelWidth: 800,
      pixelHeight: 240,
    });
    expect(rasterTarget({ width: 800, height: 600 }, RASTER_SCALE).value.pixelWidth).toBe(1600);
  });

  it("both device dimensions round to whole pixels; the CSS box keeps its fraction", () => {
    const got = rasterTarget({ width: 3.3, height: 7.15 }, RASTER_SCALE).value;
    expect(got.pixelWidth).toBe(7); // 6.6 → 7
    expect(got.pixelHeight).toBe(14); // 14.3 → 14
    expect(got.cssWidth).toBe(3.3);
  });

  it("a non-positive box or scale is an error value, never a NaN raster", () => {
    expect(rasterTarget({ width: 0, height: 10 }, RASTER_SCALE).ok).toBe(false);
    expect(rasterTarget({ width: 10, height: 0 }, RASTER_SCALE).ok).toBe(false);
    expect(rasterTarget({ width: 10, height: 10 }, 0).ok).toBe(false);
    expect(rasterTarget({ width: 10, height: 10 }, Number.NaN).ok).toBe(false);
    expect(rasterTarget({ width: Number.NaN, height: 10 }, RASTER_SCALE).ok).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// the greyscale transform — what the D47 outcome words exist to survive

describe("greyLuminance: Rec. 709 luma, integer, clamped", () => {
  it("maps the achromatic endpoints exactly", () => {
    expect(greyLuminance(255, 255, 255)).toBe(255);
    expect(greyLuminance(0, 0, 0)).toBe(0);
    expect(greyLuminance(128, 128, 128)).toBe(128);
  });

  it("uses the Rec. 709 coefficients (0.2126 / 0.7152 / 0.0722)", () => {
    expect(greyLuminance(255, 0, 0)).toBe(Math.round(0.2126 * 255)); // 54
    expect(greyLuminance(0, 255, 0)).toBe(Math.round(0.7152 * 255)); // 182
    expect(greyLuminance(0, 0, 255)).toBe(Math.round(0.0722 * 255)); // 18
  });

  it("separates the D9 verdict colours — the property the greyscale pass grades", () => {
    const good = greyLuminance(0x1f, 0x6f, 0x43); // #1f6f43 ideal/green
    const caution = greyLuminance(0xb8, 0x7d, 0x1f); // amber
    const failing = greyLuminance(0xb3, 0x26, 0x1a); // red
    for (const v of [good, caution, failing]) {
      expect(Number.isInteger(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(255);
    }
    expect(Math.abs(good - failing)).toBeGreaterThan(3);
    expect(Math.abs(caution - failing)).toBeGreaterThan(3);
  });

  it("stays in range for out-of-gamut inputs rather than emitting a bad sample", () => {
    expect(greyLuminance(300, 300, 300)).toBe(255);
    expect(greyLuminance(-5, -5, -5)).toBe(0);
  });
});

describe("compositeOverWhite: the white background the letter requires", () => {
  it("an opaque sample passes through", () => {
    expect(compositeOverWhite(31, 255)).toBe(31);
  });
  it("a fully transparent sample becomes white", () => {
    expect(compositeOverWhite(0, 0)).toBe(255);
  });
  it("a half-transparent black is mid grey", () => {
    expect(compositeOverWhite(0, 128)).toBe(Math.round(255 * (1 - 128 / 255)));
  });
});

describe("toGreySamples: RGBA → one 8-bit sample per pixel", () => {
  it("collapses 4 bytes per pixel to 1", () => {
    const rgba = Uint8Array.from([255, 255, 255, 255, 0, 0, 0, 255, 255, 0, 0, 255]);
    const grey = toGreySamples(rgba);
    expect(grey).toBeInstanceOf(Uint8Array);
    expect(grey.length).toBe(3);
    expect(Array.from(grey)).toEqual([255, 0, Math.round(0.2126 * 255)]);
  });

  it("composites over white before measuring luminance", () => {
    // fully transparent black must read as white, not as black
    const rgba = Uint8Array.from([0, 0, 0, 0]);
    expect(Array.from(toGreySamples(rgba))).toEqual([255]);
  });

  it("rejects a buffer that is not a whole number of RGBA pixels", () => {
    expect(() => toGreySamples(Uint8Array.from([1, 2, 3]))).toThrow();
  });
});

// ---------------------------------------------------------------------------
// the encoder — a TRUE 8-bit greyscale PNG, no image library (D1)

describe("encodeGreyPng: a true 8-bit greyscale PNG built on node:zlib alone", () => {
  const samples = Uint8Array.from([0, 128, 255, 10, 20, 30]); // 3 wide, 2 tall
  const png = encodeGreyPng(3, 2, samples);

  /** Walk the chunk stream: [{type, data, crcOk}] */
  function chunks(buf: Buffer): { type: string; data: Buffer; crcOk: boolean }[] {
    const out: { type: string; data: Buffer; crcOk: boolean }[] = [];
    let off = 8;
    while (off < buf.length) {
      const len = buf.readUInt32BE(off);
      const type = buf.subarray(off + 4, off + 8).toString("latin1");
      const data = buf.subarray(off + 8, off + 8 + len);
      const stored = buf.readUInt32BE(off + 8 + len);
      const computed = crc32(buf.subarray(off + 4, off + 8 + len)) >>> 0;
      out.push({ type, data, crcOk: stored === computed });
      off += 12 + len;
    }
    return out;
  }

  it("carries the PNG signature", () => {
    expect(Array.from(png.subarray(0, 8))).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
  });

  it("declares bit depth 8, colour type 0 (greyscale), no interlace", () => {
    const ihdr = chunks(png)[0]!;
    expect(ihdr.type).toBe("IHDR");
    expect(ihdr.data.length).toBe(13);
    expect(ihdr.data.readUInt32BE(0)).toBe(3); // width
    expect(ihdr.data.readUInt32BE(4)).toBe(2); // height
    expect(ihdr.data[8]).toBe(8); // bit depth
    expect(ihdr.data[9]).toBe(0); // colour type 0 = greyscale
    expect(ihdr.data[10]).toBe(0); // deflate
    expect(ihdr.data[11]).toBe(0); // adaptive filtering
    expect(ihdr.data[12]).toBe(0); // no interlace
  });

  it("has the chunk order IHDR … IDAT … IEND and every CRC is correct", () => {
    const cs = chunks(png);
    expect(cs.map((c) => c.type)).toEqual(["IHDR", "IDAT", "IEND"]);
    for (const c of cs) expect(c.crcOk, `${c.type} CRC`).toBe(true);
    expect(cs[2]!.data.length).toBe(0);
  });

  it("the IDAT inflates to filter-0 scanlines carrying the samples verbatim", () => {
    const idat = chunks(png).find((c) => c.type === "IDAT")!;
    const raw = inflateSync(idat.data);
    expect(Array.from(raw)).toEqual([0, 0, 128, 255, 0, 10, 20, 30]);
  });

  it("is deterministic — the same samples give byte-identical output", () => {
    expect(encodeGreyPng(3, 2, samples).equals(png)).toBe(true);
  });

  it("refuses a sample count that does not match width × height", () => {
    expect(() => encodeGreyPng(3, 2, Uint8Array.from([1, 2, 3]))).toThrow();
    expect(() => encodeGreyPng(0, 2, Uint8Array.from([]))).toThrow();
  });
});

// ---------------------------------------------------------------------------
// content hash + manifest shape

describe("contentHash: a stable digest of the produced bytes", () => {
  it("is sha256 hex over the exact bytes", () => {
    expect(contentHash(Buffer.alloc(0))).toBe(
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
    );
    expect(contentHash(Buffer.from("abc"))).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
    );
  });
  it("distinguishes a one-byte difference", () => {
    expect(contentHash(Buffer.from("abc"))).not.toBe(contentHash(Buffer.from("abd")));
  });
});

// ---------------------------------------------------------------------------
// the two guards behind "any render failure is a non-zero exit" (design/09 §7 step 2)

describe("readPngHeader: what the browser actually handed back", () => {
  it("reads dimensions and colour type off a PNG this module made", () => {
    const png = encodeGreyPng(3, 2, Uint8Array.from([1, 2, 3, 4, 5, 6]));
    expect(readPngHeader(png)).toEqual({
      width: 3,
      height: 2,
      bitDepth: 8,
      colourType: 0,
      interlace: 0,
    });
  });

  it("reads the SIX committed rasters — the evidence the ceremony judged", () => {
    // Measured facts about the committed corpus. The `.2x.png` files are RGB
    // (colour type 2) and the `.grey.png` files are true greyscale (colour type 0);
    // every canvas is exactly 2× the SVG's declared box. What the committed files
    // get WRONG is the ink, not the header — which is why the header is a
    // necessary but not sufficient guard, and why inkBounds exists below.
    const expected: Record<string, number> = {
      "fig-08-01": 2294,
      "fig-08-02": 2294,
      "fig-08-03": 2294,
      "fig-08-04": 2590,
      "fig-08-05": 2774,
      "fig-08-06": 2714,
    };
    for (const id of FIGURE_IDS) {
      const colour = readPngHeader(readFileSync(join(bakedDir, "png", `${id}.2x.png`)));
      expect(colour.width, `${id}.2x.png width`).toBe(2000);
      expect(colour.height, `${id}.2x.png height`).toBe(expected[id]);
      expect(colour.bitDepth).toBe(8);
      const grey = readPngHeader(readFileSync(join(bakedDir, "png", `${id}.grey.png`)));
      expect(grey.width, `${id}.grey.png width`).toBe(2000);
      expect(grey.height, `${id}.grey.png height`).toBe(expected[id]);
      expect(grey.colourType, `${id}.grey.png must be true 8-bit greyscale`).toBe(0);
      expect(grey.bitDepth).toBe(8);
    }
  });

  it("throws on bytes that are not a PNG rather than reporting a fake size", () => {
    expect(() => readPngHeader(Buffer.from("<svg/>"))).toThrow();
    expect(() => readPngHeader(Buffer.alloc(4))).toThrow();
  });
});

describe("inkBounds: proof the drawn figure FILLS the raster", () => {
  // 4 wide, 4 tall. Ink only in the top-left 2×2 — the exact shape of the
  // committed rasters' defect (1× ink on a 2× canvas).
  const W = 255;
  const topLeftOnly = Uint8Array.from([
    0, 0, W, W,
    0, 0, W, W,
    W, W, W, W,
    W, W, W, W,
  ]);

  it("finds the bounding box of non-background samples", () => {
    expect(inkBounds(topLeftOnly, 4, 4)).toEqual({
      minX: 0,
      minY: 0,
      maxX: 1,
      maxY: 1,
      empty: false,
    });
  });

  it("reports the 1×-on-2×-canvas defect: ink reaches neither half", () => {
    const b = inkBounds(topLeftOnly, 4, 4);
    expect(b.maxX).toBeLessThan(4 / 2);
    expect(b.maxY).toBeLessThan(4 / 2);
  });

  it("a full-bleed figure reaches the far edges", () => {
    const full = Uint8Array.from([
      0, W, W, 0,
      W, W, W, W,
      W, W, W, W,
      0, W, W, 0,
    ]);
    expect(inkBounds(full, 4, 4)).toEqual({ minX: 0, minY: 0, maxX: 3, maxY: 3, empty: false });
  });

  it("an all-white raster is empty, not a zero-sized box pretending to be ink", () => {
    const blank = new Uint8Array(16).fill(255);
    expect(inkBounds(blank, 4, 4).empty).toBe(true);
  });

  it("refuses a sample count that does not match the stated dimensions", () => {
    expect(() => inkBounds(new Uint8Array(15), 4, 4)).toThrow();
  });
});

describe("outputNames: the committed file-name convention", () => {
  it("is <id>.2x.png + <id>.grey.png + <id>.raster.json", () => {
    expect(outputNames("fig-08-05")).toEqual({
      colour: "fig-08-05.2x.png",
      grey: "fig-08-05.grey.png",
      manifest: "fig-08-05.raster.json",
    });
  });
});

describe("rasterManifest: names WHICH rasterizer produced the images", () => {
  const rasterizer = {
    engine: "puppeteer",
    puppeteer_version: "25.4.0",
    chrome_version: "Chrome/151.0.7922.47",
    scale: RASTER_SCALE,
    background: "#ffffff",
    greyscale: "rec709-luma",
  };
  const outputs = [
    rasterOutputRecord({
      kind: "colour",
      svg: "figures/fig-08-05.svg",
      path: "figures/png/fig-08-05.2x.png",
      width: 2000,
      height: 2774,
      colour_type: "rgb8",
      sha256: "a".repeat(64),
    }),
    rasterOutputRecord({
      kind: "grey",
      svg: "figures/fig-08-05.svg",
      path: "figures/png/fig-08-05.grey.png",
      width: 2000,
      height: 2774,
      colour_type: "grey8",
      sha256: "b".repeat(64),
    }),
  ];

  it("has exactly the declared top-level keys — figure_id, svg_fnv1a, rasterizer, outputs", () => {
    const m = rasterManifest({
      figure_id: "fig-08-05",
      svg_fnv1a: "7e1dbd",
      rasterizer,
      outputs,
    });
    expect(Object.keys(m).sort()).toEqual(
      ["figure_id", "outputs", "rasterizer", "svg_fnv1a"].sort()
    );
    expect(m.figure_id).toBe("fig-08-05");
    expect(m.svg_fnv1a).toBe("7e1dbd");
  });

  it("records the puppeteer version AND the exact runtime Chrome build string", () => {
    const m = rasterManifest({
      figure_id: "fig-08-05",
      svg_fnv1a: "7e1dbd",
      rasterizer,
      outputs,
    });
    expect(m.rasterizer.puppeteer_version).toBe("25.4.0");
    expect(m.rasterizer.chrome_version).toBe("Chrome/151.0.7922.47");
    expect(m.rasterizer.scale).toBe(2);
    expect(m.rasterizer.background).toBe("#ffffff");
  });

  it("each output records source svg, output path, pixel dimensions and a content hash", () => {
    for (const o of outputs) {
      expect(Object.keys(o).sort()).toEqual(
        ["colour_type", "height", "kind", "path", "sha256", "svg", "width"].sort()
      );
      expect(o.width).toBe(2000);
      expect(typeof o.sha256).toBe("string");
      expect(o.sha256).toHaveLength(64);
    }
  });

  it("rasterOutputRecord normalizes: unknown keys are dropped, key order is fixed", () => {
    const o = rasterOutputRecord({
      sha256: "c".repeat(64),
      width: 2000,
      height: 100,
      path: "p",
      svg: "s",
      kind: "colour",
      colour_type: "rgb8",
      scratch_note: "not part of the record",
      device_scale_factor: 2,
    });
    expect(Object.keys(o)).toEqual([
      "kind",
      "svg",
      "path",
      "width",
      "height",
      "colour_type",
      "sha256",
    ]);
  });

  it("rasterOutputRecord refuses an incomplete or nonsense record rather than recording a lie", () => {
    const good = {
      kind: "colour",
      svg: "s",
      path: "p",
      width: 2000,
      height: 100,
      colour_type: "rgb8",
      sha256: "d".repeat(64),
    };
    expect(() => rasterOutputRecord({ ...good, sha256: undefined })).toThrow();
    expect(() => rasterOutputRecord({ ...good, sha256: "short" })).toThrow();
    expect(() => rasterOutputRecord({ ...good, width: 0 })).toThrow();
    expect(() => rasterOutputRecord({ ...good, height: 12.5 })).toThrow();
    expect(() => rasterOutputRecord({ ...good, kind: "thumbnail" })).toThrow();
    expect(() => rasterOutputRecord({ ...good, colour_type: "cmyk" })).toThrow();
  });

  it("rasterManifest refuses a rasterizer that does not name itself — the whole point of the record", () => {
    for (const key of ["engine", "puppeteer_version", "chrome_version"]) {
      const crippled = { ...rasterizer, [key]: undefined };
      expect(
        () =>
          rasterManifest({
            figure_id: "fig-08-05",
            svg_fnv1a: "7e1dbd",
            rasterizer: crippled,
            outputs,
          }),
        `expected a throw when rasterizer.${key} is missing`
      ).toThrow();
    }
    expect(() =>
      rasterManifest({ figure_id: "fig-08-05", svg_fnv1a: "7e1dbd", rasterizer, outputs: [] })
    ).toThrow();
  });

  it("carries no clock — two manifests built from the same facts are identical", () => {
    const a = rasterManifest({ figure_id: "f", svg_fnv1a: "0", rasterizer, outputs });
    const b = rasterManifest({ figure_id: "f", svg_fnv1a: "0", rasterizer, outputs });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(JSON.stringify(a)).not.toMatch(/\d{4}-\d{2}-\d{2}T/);
  });

  it("is frozen — the manifest is a value, not a mutable accumulator", () => {
    const m = rasterManifest({ figure_id: "f", svg_fnv1a: "0", rasterizer, outputs });
    expect(Object.isFrozen(m)).toBe(true);
    expect(Object.isFrozen(m.outputs)).toBe(true);
  });
});
