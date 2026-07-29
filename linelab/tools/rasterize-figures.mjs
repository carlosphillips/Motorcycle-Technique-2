// tools/rasterize-figures.mjs — the design/09 §7 step-2 rasterizer: render a
// committed figure SVG to PNG at 2× on a white background, plus its greyscale
// companion, plus a manifest naming the engine that produced them.
//
//   node tools/rasterize-figures.mjs fig-08-05             (after `npm run build`)
//   node tools/rasterize-figures.mjs fig-08-05 --out /tmp/x
//
// design/09 §7 step 2: "A headless-browser rasterizer (replacing cairosvg —
// exported SVG is no longer constrained to cairosvg's feature subset) renders
// every SVG to PNG at 2× scale on a white background, writing a manifest; any
// render failure is a non-zero exit." §9 repeats it: "moves from cairosvg to a
// headless browser". The engine is puppeteer, a DEV dependency (D1), driving the
// version-pinned Chrome for Testing it downloads; the pin is what makes the
// choice reproducible rather than "whatever browser this laptop has".
//
// What it writes, per figure id, into --out (default linelab/figures/png/):
//   <id>.2x.png       8-bit RGB, 2000 px wide, aspect preserved
//   <id>.grey.png     8-bit TRUE greyscale (PNG colour type 0), same dimensions
//   <id>.raster.json  the manifest: svg_fnv1a, the rasterizer's self-identification
//                     (puppeteer version + the exact Chrome build string read from
//                     browser.version() at run time), and per output the source
//                     SVG, the output path, the pixel dimensions and a sha256.
//
// What it deliberately does NOT do:
//   * take a default figure list. Every id must be named on the command line.
//     The other five figures' rasters are the evidence their still-valid judge
//     records were judged on; a tool that defaults to "all" can destroy that
//     evidence with a bare invocation, so this one cannot be invoked bare.
//   * run from out/chapter-08/bake.sh. bake.sh's committed artefacts are covered
//     by the "two consecutive bakes move zero tracked artefacts" ceremony
//     (ROADMAP.md). Chrome's PNG encoder being byte-stable run-to-run is a
//     property nothing in this repo has ever measured, and attaching an unmeasured
//     property to the determinism gate would weaken the gate. It is invoked out of
//     band, exactly as tools/restamp-figures.mjs is.
//   * re-stamp, re-bake or re-judge anything. It reads <id>.svg and writes only
//     PNGs and its own manifest; `verdicts` and `svg_fnv1a` in the judge record
//     are somebody else's job, and re-judging is an agent step, not a script step.
//   * hold any of its own arithmetic. Every decision that can be made without a
//     browser lives in ./raster-core.mjs and is unit-tested in
//     test/tools/raster-core.test.ts. This file is the IO edge and nothing else.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import puppeteer from 'puppeteer';

import { fnv1a } from '../dist/core/hash.js';
import {
  RASTER_SCALE,
  contentHash,
  encodeGreyPng,
  inkBounds,
  outputNames,
  parseSvgSize,
  rasterManifest,
  rasterOutputRecord,
  rasterTarget,
  readPngHeader,
  toGreySamples,
} from './raster-core.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const LAB = resolve(HERE, '..');
const BAKED = join(LAB, 'figures');
const PNG_DIR = join(BAKED, 'png');

// Rows of RGBA pulled back from the page at a time. The luminance transform is a
// pure, tested function in node, so the pixels have to cross the CDP boundary;
// 256 rows is ~2 MB, comfortably inside a single evaluate result.
const BAND_ROWS = 256;

// --- arguments ------------------------------------------------------------
const argv = process.argv.slice(2);
const ids = [];
let outDir = PNG_DIR;
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === '--out') {
    outDir = resolve(argv[++i] ?? '');
  } else if (argv[i].startsWith('-')) {
    die(`unknown flag ${argv[i]}`);
  } else {
    ids.push(argv[i]);
  }
}
if (ids.length === 0) {
  die('name at least one figure id, e.g. `node tools/rasterize-figures.mjs fig-08-05`');
}

function die(message) {
  process.stderr.write(`rasterize-figures: ${message}\n`);
  process.exit(1);
}

// --- the page ---------------------------------------------------------------

/**
 * The SVG laid out at its OWN css box, with the enlarging done by the device
 * scale factor. This is the fix for the committed rasters' defect: they were 2×
 * canvases holding 1× ink, because the canvas was scaled and the picture was not.
 */
function pageHtml(svgText, target) {
  return `<!doctype html><meta charset="utf-8"><style>
html,body{margin:0;padding:0;background:#ffffff;}
body{width:${target.cssWidth}px;height:${target.cssHeight}px;overflow:hidden;}
svg{display:block;width:${target.cssWidth}px;height:${target.cssHeight}px;}
</style>${svgText}`;
}

/** Round-trip the produced PNG through a canvas in the page; yield its RGBA bytes. */
async function readRgba(page, pngBytes, width, height) {
  const dataUri = `data:image/png;base64,${pngBytes.toString('base64')}`;
  const decoded = await page.evaluate(async (uri) => {
    const img = new Image();
    img.src = uri;
    await img.decode();
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0);
    globalThis.__rasterCtx = ctx;
    return [canvas.width, canvas.height];
  }, dataUri);
  if (decoded[0] !== width || decoded[1] !== height) {
    throw new Error(`canvas round-trip changed the size: ${decoded[0]}×${decoded[1]} vs ${width}×${height}`);
  }
  const rgba = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y += BAND_ROWS) {
    const rows = Math.min(BAND_ROWS, height - y);
    const b64 = await page.evaluate(
      (y0, n, w) => {
        const data = globalThis.__rasterCtx.getImageData(0, y0, w, n).data;
        let s = '';
        const CHUNK = 0x8000;
        for (let i = 0; i < data.length; i += CHUNK) {
          s += String.fromCharCode.apply(null, data.subarray(i, i + CHUNK));
        }
        return btoa(s);
      },
      y,
      rows,
      width
    );
    const band = Buffer.from(b64, 'base64');
    if (band.length !== rows * width * 4) {
      throw new Error(`band at y=${y} came back ${band.length} bytes, expected ${rows * width * 4}`);
    }
    band.copy(rgba, y * width * 4);
  }
  return rgba;
}

// --- the run ----------------------------------------------------------------

const puppeteerVersion = JSON.parse(
  readFileSync(join(LAB, 'node_modules', 'puppeteer', 'package.json'), 'utf8')
).version;

const browser = await puppeteer.launch({
  headless: true,
  args: [
    '--force-color-profile=srgb', // no display-profile drift between machines
    '--font-render-hinting=none', // hinting is a per-machine font-config decision
    '--disable-lcd-text', // subpixel AA would make the raster display-dependent
    '--disable-gpu', // software raster: the same pixels with or without a GPU
    '--hide-scrollbars',
  ],
});

let failure = null;
try {
  const chromeVersion = await browser.version();
  mkdirSync(outDir, { recursive: true });

  for (const id of ids) {
    const svgPath = join(BAKED, `${id}.svg`);
    const svgText = readFileSync(svgPath, 'utf8');

    const box = parseSvgSize(svgText);
    if (!box.ok) throw new Error(`${id}: ${box.error}`);
    const target = rasterTarget(box.value, RASTER_SCALE);
    if (!target.ok) throw new Error(`${id}: ${target.error}`);
    const t = target.value;

    const page = await browser.newPage();
    let colourPng;
    let rgba;
    try {
      await page.setViewport({
        width: t.cssWidth,
        height: t.cssHeight,
        deviceScaleFactor: t.scale,
      });
      await page.setContent(pageHtml(svgText, t), { waitUntil: 'load' });
      await page.evaluate(() => document.fonts.ready);
      colourPng = await page.screenshot({
        type: 'png',
        captureBeyondViewport: false,
        optimizeForSpeed: false,
      });
      colourPng = Buffer.from(colourPng);

      // any render failure is a non-zero exit — starting with "it is not the
      // size we asked for", the failure that produced the committed rasters.
      const header = readPngHeader(colourPng);
      if (header.width !== t.pixelWidth || header.height !== t.pixelHeight) {
        throw new Error(
          `${id}: browser returned ${header.width}×${header.height}, expected ${t.pixelWidth}×${t.pixelHeight}`
        );
      }
      rgba = await readRgba(page, colourPng, header.width, header.height);
    } finally {
      await page.close();
    }

    const header = readPngHeader(colourPng);
    const grey = toGreySamples(rgba);
    const greyPng = encodeGreyPng(header.width, header.height, grey);

    // The second guard: the drawn figure must FILL the raster. A rasterizer that
    // reproduced the committed defect would pass every dimension check above and
    // still be wrong, because the canvas was the right size and the picture was
    // not. What makes this discriminating on THIS corpus is the paper tint —
    // every figure paints a full-bleed background rect, so "drawn region" and
    // "canvas" coincide exactly when the scale was applied to the picture rather
    // than to the page. Measured: the committed fig-08-05.2x.png stops at
    // (999, 1386) of 2000×2774; a correct render reaches (1999, 2773). On a
    // figure that did NOT paint its background this would be a weaker check —
    // it would then only catch an under-filled render, not a mis-scaled one.
    const ink = inkBounds(grey, header.width, header.height);
    if (ink.empty) throw new Error(`${id}: raster carries no ink at all`);
    if (ink.maxX < header.width / 2 || ink.maxY < header.height / 2) {
      throw new Error(
        `${id}: ink stops at (${ink.maxX}, ${ink.maxY}) in a ${header.width}×${header.height} raster — ` +
          `this is the 1x-ink-on-2x-canvas defect, not a raster`
      );
    }

    const names = outputNames(id);
    const colourPath = join(outDir, names.colour);
    const greyPath = join(outDir, names.grey);
    writeFileSync(colourPath, colourPng);
    writeFileSync(greyPath, greyPng);

    const rel = (p) => relative(LAB, p).split('\\').join('/');
    const manifest = rasterManifest({
      figure_id: id,
      svg_fnv1a: fnv1a(svgText),
      rasterizer: {
        engine: 'puppeteer',
        puppeteer_version: puppeteerVersion,
        chrome_version: chromeVersion,
        scale: RASTER_SCALE,
        background: '#ffffff',
        greyscale: 'rec709-luma',
      },
      outputs: [
        rasterOutputRecord({
          kind: 'colour',
          svg: rel(svgPath),
          path: rel(colourPath),
          width: header.width,
          height: header.height,
          colour_type: 'rgb8',
          sha256: contentHash(colourPng),
        }),
        rasterOutputRecord({
          kind: 'grey',
          svg: rel(svgPath),
          path: rel(greyPath),
          width: header.width,
          height: header.height,
          colour_type: 'grey8',
          sha256: contentHash(greyPng),
        }),
      ],
    });
    writeFileSync(join(outDir, names.manifest), `${JSON.stringify(manifest, null, 2)}\n`);

    console.log(
      `${id}: ${header.width}x${header.height} @ ${t.scale}x — ink [${ink.minX},${ink.minY}]..[${ink.maxX},${ink.maxY}] — ` +
        `${names.colour} ${colourPng.length} B, ${names.grey} ${greyPng.length} B`
    );
  }
} catch (e) {
  failure = e;
} finally {
  await browser.close();
}

if (failure !== null) die(failure.stack ?? String(failure));
console.log(`rasterized ${ids.length} figure(s) into ${outDir} — puppeteer ${puppeteerVersion}`);
