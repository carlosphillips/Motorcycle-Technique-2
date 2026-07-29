// tools/raster-core.mjs — the PURE half of the design/09 §7 step-2 rasterizer.
//
// design/09 §7 step 2: "A headless-browser rasterizer (replacing cairosvg —
// exported SVG is no longer constrained to cairosvg's feature subset) renders
// every SVG to PNG at 2× scale on a white background, writing a manifest; any
// render failure is a non-zero exit."
//
// This file holds everything in that sentence that is arithmetic or byte-shaping
// rather than a browser: the target-scale derivation from the SVG's own declared
// box, the Rec. 709 luminance transform, a true 8-bit greyscale PNG encoder built
// on node:zlib alone, and the raster manifest's shape. tools/rasterize-figures.mjs
// is the thin driver that supplies the pixels.
//
// What it deliberately does NOT do:
//   * import puppeteer — nothing here knows a browser exists, so the whole file
//     is unit-testable in the ordinary vitest suite without launching Chrome
//     (test/tools/raster-core.test.ts);
//   * touch the filesystem, the clock, the environment or the network. Every
//     export is a pure function of its arguments. The two node builtins it does
//     import (`node:zlib`, `node:crypto`) are used only as deterministic
//     transforms of in-memory bytes — no IO. That is also the D1 answer to "why
//     no image library": a PNG encoder for colour type 0 is a CRC, a deflate and
//     a 13-byte header, and both of those already ship with node;
//   * decide WHICH figures get rasterized, or write anything. That is the
//     driver's job, and the driver is invoked by hand (like restamp-figures.mjs)
//     rather than from bake.sh — see the driver's header for why.
import { deflateSync, constants as zlibConstants } from "node:zlib";
import { createHash } from "node:crypto";

/**
 * The letter's number. design/09 §7 step 2: "renders every SVG to PNG at 2×
 * scale on a white background". The SCALE is the input, not the pixel width —
 * `fallbackSvg` (src/render/fallback.ts) declares a 400×120 box, and a
 * fixed-2000-px target would enlarge it 5× while still writing it out under the
 * name `.2x.png`. A file name that asserts a scale the file does not have is the
 * small end of the fabrication this repo refuses.
 */
export const RASTER_SCALE = 2;

/**
 * What that scale yields for THIS corpus, and nothing more: every committed
 * figure declares the 1000 px nominal frame (`NOMINAL_FRAME_PX`,
 * src/render/topdown.ts), so 2× is 2000 px wide. Pinned by test as a
 * consequence — never passed in as the target.
 */
export const TARGET_WIDTH_PX = 2000;

/** Rec. 709 luma coefficients — the same weights CSS `filter: grayscale()` uses. */
const LUMA_R = 0.2126;
const LUMA_G = 0.7152;
const LUMA_B = 0.0722;

const ok = (value) => ({ ok: true, value });
const fail = (error) => ({ ok: false, error });

// ---------------------------------------------------------------------------
// the declared box

/** Parse an SVG length attribute: a plain number, optionally suffixed `px`. */
function parseLength(raw) {
  if (typeof raw !== "string") return null;
  const m = /^\s*(-?\d+(?:\.\d+)?)\s*(?:px)?\s*$/.exec(raw);
  if (m === null) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
}

/**
 * The box the SVG declares on its ROOT element, as `{ width, height }`.
 *
 * Reading the root and not the first `width=` anywhere matters: every figure in
 * this corpus opens with a `<defs>` full of `<marker markerWidth="6" …>`, and a
 * naive scan would raster a 6 px arrowhead. Percentage and unit-bearing lengths
 * are refused rather than guessed — a rasterizer that guesses its own canvas is
 * a cousin of the defect this module exists to fix.
 */
export function parseSvgSize(svgText) {
  if (typeof svgText !== "string") return fail("parseSvgSize: expected SVG text");
  const open = /<svg\b[^>]*>/i.exec(svgText);
  if (open === null) return fail("parseSvgSize: no <svg> root element found");
  const tag = open[0];
  const attr = (name) => {
    const m = new RegExp(`\\b${name}\\s*=\\s*"([^"]*)"|\\b${name}\\s*=\\s*'([^']*)'`, "i").exec(tag);
    return m === null ? undefined : (m[1] ?? m[2]);
  };
  const width = parseLength(attr("width"));
  const height = parseLength(attr("height"));
  if (width === null || height === null) {
    return fail(
      `parseSvgSize: root <svg> lacks a numeric width/height (got ${attr("width")} × ${attr("height")})`
    );
  }
  if (width <= 0 || height <= 0) {
    return fail(`parseSvgSize: root <svg> box is not positive (${width} × ${height})`);
  }
  return ok({ width, height });
}

// ---------------------------------------------------------------------------
// the target
//
// THE BUG THIS FIXES. The committed rasters are 2× the declared box in CANVAS
// and 1× in INK — the prior step enlarged the page and left the picture where it
// was, so the right half and bottom half of every committed PNG are pure white.
// The cure is to keep the CSS layout at the SVG's own box and let the device
// scale factor do the enlarging: the picture then fills the raster by
// construction, and `pixelWidth` is a consequence of the scale rather than a
// separately-chosen canvas the ink might never reach.

/**
 * `{ scale, cssWidth, cssHeight, pixelWidth, pixelHeight }` for a declared box.
 *
 * `cssWidth`/`cssHeight` are the browser viewport in CSS pixels — the SVG's own
 * box, unchanged. `scale` is the device scale factor. `pixelWidth` is exactly
 * `targetWidthPx`; `pixelHeight` rounds to the nearest whole device pixel, which
 * is the only place aspect can drift and it drifts by at most half a pixel.
 */
export function rasterTarget(box, scale) {
  const width = box?.width;
  const height = box?.height;
  if (!Number.isFinite(width) || width <= 0) return fail(`rasterTarget: bad width ${width}`);
  if (!Number.isFinite(height) || height <= 0) return fail(`rasterTarget: bad height ${height}`);
  if (!Number.isFinite(scale) || scale <= 0) return fail(`rasterTarget: bad scale ${scale}`);
  return ok(
    Object.freeze({
      scale,
      cssWidth: width,
      cssHeight: height,
      pixelWidth: Math.round(width * scale),
      pixelHeight: Math.round(height * scale),
    })
  );
}

// ---------------------------------------------------------------------------
// the greyscale conversion the D47 outcome words exist to survive

const clamp255 = (n) => (n < 0 ? 0 : n > 255 ? 255 : n);

/** One 8-bit sample from an opaque RGB triple: Rec. 709 luma, rounded and clamped. */
export function greyLuminance(r, g, b) {
  return Math.round(clamp255(LUMA_R * clamp255(r) + LUMA_G * clamp255(g) + LUMA_B * clamp255(b)));
}

/**
 * A single channel composited over a WHITE backdrop, per the letter's "on a white
 * background". The screenshot is already opaque, so this is normally the identity
 * — it is here so a stray transparent pixel reads as paper, never as ink.
 */
export function compositeOverWhite(channel, alpha) {
  const a = clamp255(alpha) / 255;
  return Math.round(clamp255(channel) * a + 255 * (1 - a));
}

/** RGBA bytes → one greyscale sample per pixel, composited over white first. */
export function toGreySamples(rgba) {
  if (rgba.length % 4 !== 0) {
    throw new Error(`toGreySamples: ${rgba.length} bytes is not a whole number of RGBA pixels`);
  }
  const out = new Uint8Array(rgba.length / 4);
  for (let i = 0, p = 0; i < rgba.length; i += 4, p++) {
    const a = rgba[i + 3];
    out[p] = greyLuminance(
      compositeOverWhite(rgba[i], a),
      compositeOverWhite(rgba[i + 1], a),
      compositeOverWhite(rgba[i + 2], a)
    );
  }
  return out;
}

// ---------------------------------------------------------------------------
// the encoder: PNG colour type 0, bit depth 8

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const typed = Buffer.concat([Buffer.from(type, "latin1"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typed), 0);
  return Buffer.concat([length, typed, crc]);
}

/**
 * A true 8-bit greyscale PNG (colour type 0) from one sample per pixel.
 *
 * Every scanline uses filter type 0 (None). A per-line filter heuristic would
 * shrink the file and would make the bytes a function of the encoder's taste; the
 * corpus rests on byte-identical reproducibility, so the encoder has no taste.
 * `deflate` runs at a pinned level, strategy, memLevel and windowBits for the
 * same reason — every zlib knob that could drift is nailed down here.
 */
export function encodeGreyPng(width, height, samples) {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
    throw new Error(`encodeGreyPng: bad dimensions ${width} × ${height}`);
  }
  if (samples.length !== width * height) {
    throw new Error(
      `encodeGreyPng: ${samples.length} samples for a ${width} × ${height} image (expected ${width * height})`
    );
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 0; // colour type 0 = greyscale
  ihdr[10] = 0; // compression: deflate
  ihdr[11] = 0; // filter: adaptive
  ihdr[12] = 0; // interlace: none

  const raw = Buffer.alloc((width + 1) * height);
  const view = Buffer.from(samples.buffer, samples.byteOffset, samples.length);
  for (let y = 0; y < height; y++) {
    raw[y * (width + 1)] = 0; // filter type None
    view.copy(raw, y * (width + 1) + 1, y * width, (y + 1) * width);
  }
  const idat = deflateSync(raw, {
    level: 9,
    strategy: zlibConstants.Z_DEFAULT_STRATEGY,
    memLevel: 8,
    windowBits: 15,
  });

  return Buffer.concat([
    PNG_SIGNATURE,
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ---------------------------------------------------------------------------
// the manifest

/** sha256 hex of the exact bytes written to disk. */
export function contentHash(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

// ---------------------------------------------------------------------------
// the two guards behind "any render failure is a non-zero exit"

/**
 * `{ width, height, bitDepth, colourType, interlace }` from a PNG's IHDR.
 *
 * The driver runs this on the bytes the BROWSER handed back, not on the bytes it
 * asked for. A screenshot that silently came back at the wrong size is exactly
 * the failure that produced the committed rasters, and it is invisible unless
 * something reads the header of the thing actually written.
 */
export function readPngHeader(bytes) {
  if (bytes.length < 33 || !PNG_SIGNATURE.equals(bytes.subarray(0, 8))) {
    throw new Error("readPngHeader: not a PNG (bad signature)");
  }
  const buf = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
  if (buf.subarray(12, 16).toString("latin1") !== "IHDR") {
    throw new Error("readPngHeader: first chunk is not IHDR");
  }
  return {
    width: buf.readUInt32BE(16),
    height: buf.readUInt32BE(20),
    bitDepth: buf[24],
    colourType: buf[25],
    interlace: buf[28],
  };
}

/**
 * The bounding box of non-white samples in a greyscale buffer.
 *
 * This is the assertion the committed rasters would fail. They are 2000 px wide
 * canvases whose ink stops at x = 999 — the right half and the bottom half are
 * pure white. `empty: true` means the raster carries no ink at all, which is a
 * different failure (a blank page) and is reported as such rather than as a
 * degenerate box at the origin.
 */
export function inkBounds(samples, width, height, background = 255) {
  if (samples.length !== width * height) {
    throw new Error(
      `inkBounds: ${samples.length} samples for a ${width} × ${height} image (expected ${width * height})`
    );
  }
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y++) {
    const row = y * width;
    for (let x = 0; x < width; x++) {
      if (samples[row + x] === background) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  const empty = maxX < 0;
  return Object.freeze(
    empty
      ? { minX: 0, minY: 0, maxX: -1, maxY: -1, empty: true }
      : { minX, minY, maxX, maxY, empty: false }
  );
}

/** The committed file-name convention for one figure's rasters. */
export function outputNames(figureId) {
  return Object.freeze({
    colour: `${figureId}.2x.png`,
    grey: `${figureId}.grey.png`,
    manifest: `${figureId}.raster.json`,
  });
}

const OUTPUT_KEYS = ["kind", "svg", "path", "width", "height", "colour_type", "sha256"];
const KINDS = new Set(["colour", "grey"]);
const COLOUR_TYPES = new Set(["rgb8", "grey8"]);

/**
 * One raster output, normalized to a fixed key order and validated.
 *
 * Validation throws rather than returning a Result because a malformed output
 * record is a driver bug, not a user input — and the letter's "any render failure
 * is a non-zero exit" wants the process dead, not a soft record on disk.
 */
export function rasterOutputRecord(fields) {
  const { kind, svg, path, width, height, colour_type, sha256 } = fields ?? {};
  if (!KINDS.has(kind)) throw new Error(`rasterOutputRecord: unknown kind ${String(kind)}`);
  if (!COLOUR_TYPES.has(colour_type)) {
    throw new Error(`rasterOutputRecord: unknown colour_type ${String(colour_type)}`);
  }
  for (const [name, value] of [
    ["svg", svg],
    ["path", path],
  ]) {
    if (typeof value !== "string" || value.length === 0) {
      throw new Error(`rasterOutputRecord: ${name} must be a non-empty string`);
    }
  }
  for (const [name, value] of [
    ["width", width],
    ["height", height],
  ]) {
    if (!Number.isInteger(value) || value <= 0) {
      throw new Error(
        `rasterOutputRecord: ${name} must be a positive integer (got ${String(value)})`
      );
    }
  }
  if (typeof sha256 !== "string" || !/^[0-9a-f]{64}$/.test(sha256)) {
    throw new Error("rasterOutputRecord: sha256 must be 64 lowercase hex chars");
  }
  const record = {};
  for (const key of OUTPUT_KEYS) record[key] = fields[key];
  return Object.freeze(record);
}

const RASTERIZER_KEYS = [
  "engine",
  "puppeteer_version",
  "chrome_version",
  "scale",
  "background",
  "greyscale",
];

/**
 * The manifest for one figure's rasters.
 *
 * `rasterizer` is the load-bearing field and the reason this manifest exists at
 * all: ROADMAP work order 0 requires the re-judge entry to name WHICH rasterizer
 * produced the images, because the 2026-07-25 ceremony could take that for
 * granted and its successor cannot. `chrome_version` is therefore read from the
 * live browser at run time, never hard-coded, and a manifest that cannot name its
 * own engine is refused rather than written.
 *
 * There is no timestamp anywhere in the record. A clock would make two runs of a
 * deterministic step differ, which is exactly the property under test.
 */
export function rasterManifest({ figure_id, svg_fnv1a, rasterizer, outputs }) {
  if (typeof figure_id !== "string" || figure_id.length === 0) {
    throw new Error("rasterManifest: figure_id must be a non-empty string");
  }
  if (typeof svg_fnv1a !== "string" || svg_fnv1a.length === 0) {
    throw new Error("rasterManifest: svg_fnv1a must be a non-empty string");
  }
  for (const key of ["engine", "puppeteer_version", "chrome_version"]) {
    const value = rasterizer?.[key];
    if (typeof value !== "string" || value.length === 0) {
      throw new Error(`rasterManifest: rasterizer.${key} must name itself (got ${String(value)})`);
    }
  }
  if (!Array.isArray(outputs) || outputs.length === 0) {
    throw new Error("rasterManifest: outputs must be a non-empty array");
  }
  const engine = {};
  for (const key of RASTERIZER_KEYS) engine[key] = rasterizer[key];
  return Object.freeze({
    figure_id,
    svg_fnv1a,
    rasterizer: Object.freeze(engine),
    outputs: Object.freeze(outputs.map((o) => Object.freeze({ ...o }))),
  });
}
