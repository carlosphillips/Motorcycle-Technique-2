// tools/restamp-figures.mjs — re-bake the six committed book figures into
// linelab/figures/ and re-stamp the identity fields that follow from the bytes.
//
//   node tools/restamp-figures.mjs        (after `npm run build`)
//
// What it rewrites:
//   figures/<id>.svg          the committed bake test/render/gate.test.ts pins
//   figures/manifest.json     the six manifest records, in figure order
//   figures/<id>.judge.json   `spec_hash` + `svg_fnv1a` only
//
// What it deliberately does NOT touch: each judge record's `verdicts`. Those
// are vision-judge readings of a specific image (design/09 §7.3) — a script
// cannot re-look at a figure, so re-judging stays a human/agent step. A
// re-stamp without a re-judge leaves the record structurally valid and
// semantically stale ON PURPOSE, and the re-judge is the gate before release.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, copyFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { fnv1a } from '../dist/core/hash.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const LAB = resolve(HERE, '..');
const ROOT = resolve(LAB, '..');
const SCENES = join(ROOT, 'figures');
const BAKED = join(LAB, 'figures');
const CLI = join(LAB, 'dist', 'cli', 'main.js');
const IDS = ['fig-08-01', 'fig-08-02', 'fig-08-03', 'fig-08-04', 'fig-08-05', 'fig-08-06'];

const work = mkdtempSync(join(tmpdir(), 'linelab-restamp-'));
const manifests = [];

for (const id of IDS) {
  const out = join(work, id);
  // exit 3 (DEVIATION) is a legitimate outcome for 8.5/8.6 — the envelope and
  // the SVG are still written, so only a missing artefact is fatal here.
  try {
    execFileSync('node', [CLI, 'figure', join(SCENES, `${id}.scene`), '--mode', 'true', '--out', out], {
      stdio: ['ignore', 'ignore', 'inherit'],
    });
  } catch (e) {
    if (e.status !== 3) throw e;
  }

  copyFileSync(join(out, `${id}.svg`), join(BAKED, `${id}.svg`));
  const manifest = JSON.parse(readFileSync(join(out, 'manifest.json'), 'utf8'));
  manifests.push(manifest);

  const svgBytes = readFileSync(join(BAKED, `${id}.svg`), 'utf8');
  const judgePath = join(BAKED, `${id}.judge.json`);
  const judge = JSON.parse(readFileSync(judgePath, 'utf8'));
  const before = { spec_hash: judge.spec_hash, svg_fnv1a: judge.svg_fnv1a };
  judge.spec_hash = manifest.spec_hash;
  judge.svg_fnv1a = fnv1a(svgBytes);
  writeFileSync(judgePath, `${JSON.stringify(judge, null, 2)}\n`);
  console.log(
    `${id}: spec_hash ${before.spec_hash} -> ${judge.spec_hash}, svg_fnv1a ${before.svg_fnv1a} -> ${judge.svg_fnv1a}`
  );
}

writeFileSync(join(BAKED, 'manifest.json'), `${JSON.stringify(manifests, null, 2)}\n`);
rmSync(work, { recursive: true, force: true });
console.log('re-stamped 6 figures — verdicts left untouched; re-judge before release');
