// summarize.mjs — reduce the six baked figure envelopes to the compact per-line
// record the gallery builder reads (`verdicts.json` / `summary.json`).
//
// Usage: node summarize.mjs <bake-dir>          (default: ./.bake beside this file)
//
// Lives in the repo rather than the bake directory: the gallery is only
// reproducible if every step of the bake is committed.
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const BAKE = resolve(process.argv[2] ?? process.env['CH8_BAKE_DIR'] ?? join(HERE, '.bake'));

const ids = ['01', '02', '03', '04', '05', '06'];
const out = [];

for (const f of ids) {
  const raw = JSON.parse(readFileSync(join(BAKE, `fig-08-${f}`, `fig-08-${f}.json`), 'utf8'));
  const v = raw.value ?? raw;
  const lines = v.lines ?? [];
  const rec = { figure: `fig-08-${f}`, lines: [] };
  for (const L of lines) {
    const vd = L.verdict ?? {};
    const doc = vd.doctrine ?? {};
    const bad = (doc.checks ?? []).filter((c) => c.verdict === 'fail' || c.verdict === 'warn');
    rec.lines.push({
      id: L.line_id,
      ok: vd.ok,
      outcome: vd.outcome,
      quality: vd.quality,
      headline: vd.headline,
      diagnosis: vd.diagnosis,
      tally: { pass: doc.pass, fail: doc.fail, warn: doc.warn, na: doc.na },
      corners: (vd.corners ?? []).map((c) => ({
        id: c.id,
        lean_max_deg: c.lean_max_deg,
        grip_min: c.grip_min,
        apex_pct: c.apexes?.[0]?.pct,
        ran_wide: c.ran_wide,
      })),
      sight_margin_min_m: vd.sight?.margin_min_m,
      flags: bad.map((c) => ({
        v: c.verdict,
        id: c.id,
        corner: c.corner_id,
        msg: c.evidence?.message,
        // the check's own recorded metrics ride along: the gallery re-says the
        // finding in riding words through the engine's lexicon, and that
        // rewrite is allowed to read ONLY what the check actually measured
        metrics: c.evidence?.metrics,
      })),
    });
  }
  out.push(rec);
}
console.log(JSON.stringify(out, null, 1));
