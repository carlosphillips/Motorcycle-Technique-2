import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Paths derive from this file's location: the gallery has to rebuild on any
// clone, not only on the machine that first baked it.
const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../..');
const BAKE = resolve(process.env['CH8_BAKE_DIR'] ?? join(HERE, '.bake'));
const SCENES = join(ROOT, 'figures');
const GALLERY_OUT = join(HERE, 'gallery.html');
const summary = JSON.parse(readFileSync(`${BAKE}/summary.json`, 'utf8'));

const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Six inline SVGs share ids like "arrow-good" — namespace per embed so url(#…) resolves locally.
// The renderer also reuses a line id as an element id on every element of that line
// (id="good" x8 in one file) — invalid in an HTML document. Nothing points at those via
// url(), so make repeats unique; referenced ids (markers, clips) are left alone.
const dedupeUnreferenced = (svg, prefix) => {
  const referenced = new Set([...svg.matchAll(/url\(#([^)]+)\)/g)].map((m) => m[1]));
  const seen = new Map();
  return svg.replace(/\bid="([^"]+)"/g, (_m, id) => {
    const bare = id.startsWith(`${prefix}__`) ? id.slice(prefix.length + 2) : id;
    if (referenced.has(id) || referenced.has(bare)) return `id="${id}"`;
    const n = (seen.get(id) ?? 0) + 1;
    seen.set(id, n);
    return n === 1 ? `id="${id}"` : `id="${id}-${n}"`;
  });
};

// Every class name appearing inside an embedded SVG, collected as we embed.
const svgClassNames = new Set();

const namespace = (svg, prefix) => {
  for (const m of svg.matchAll(/\bclass="([^"]+)"/g)) {
    for (const c of m[1].split(/\s+/)) if (c) svgClassNames.add(c);
  }
  return dedupeUnreferenced(svg, prefix)
    .replace(/\bid="([^"]+)"/g, (_m, id) => `id="${prefix}__${id}"`)
    .replace(/url\(#([^)]+)\)/g, (_m, id) => `url(#${prefix}__${id})`)
    .replace(/\b(xlink:href|href)="#([^"]+)"/g, (_m, a, id) => `${a}="#${prefix}__${id}"`)
    // The bake sets explicit px width/height; let the container drive size instead.
    .replace(/^<svg([^>]*)>/, (m, attrs) => {
      const cleaned = attrs.replace(/\s(width|height)="[^"]*"/g, '');
      return `<svg${cleaned} class="plate-svg">`;
    });
};

// ---------------------------------------------------------------------------
// The symbol legend. Every swatch below is drawn with the SAME geometry the
// renderer uses (render/topdown.ts's markerGlyphSvg / terminalGlyphSvg and
// render/ink.ts's ink table), at glyph radius 7 in a 26x26 box — so what the
// legend shows is what the figures draw, not an artist's impression of it.

const QC = { good: '#1f6f43', caution: '#b07d1e', failing: '#b32e2e' };
const NEUTRAL = '#4a4a4a';

/** render/topdown.ts hourglassPoints, verbatim proportions (end 0.85r, waist 0.18r). */
const hourglass = (cx, cy, r) => {
  const w = r * 0.85;
  const neck = r * 0.18;
  return `${cx - w},${cy - r} ${cx + w},${cy - r} ${cx + neck},${cy} ${cx + w},${cy + r} ${cx - w},${cy + r} ${cx - neck},${cy}`;
};

const swatch = (body, w = 26, h = 26) =>
  `<svg class="lg-svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" aria-hidden="true">${body}</svg>`;

const R = 7;
const C = 13;

const LEGEND_GROUPS = [
  {
    title: 'The lines',
    note: 'Colour is the verdict, never the role — a line is drawn in the colour of how it turned out, and its stroke weight says what part it plays.',
    rows: [
      {
        art: swatch(`<line x1="1" y1="13" x2="21" y2="13" stroke="${QC.good}" stroke-width="3" stroke-linecap="butt"/><polygon points="19,9 25,13 19,17" fill="${QC.good}"/>`, 26, 26),
        term: 'ideal line',
        desc: 'The widest stroke. The line the solver stands behind for this road and entry speed.',
      },
      {
        art: swatch(`<line x1="1" y1="13" x2="21" y2="13" stroke="${QC.failing}" stroke-width="2.2" stroke-linecap="butt"/><polygon points="19,9.5 25,13 19,16.5" fill="${QC.failing}"/>`, 26, 26),
        term: 'mistake line',
        desc: 'A narrower stroke, same solid ink. Never dashed — dashing is reserved for reference lines and sight rays.',
      },
      {
        art: swatch(
          `<rect x="7" y="2" width="12" height="6" rx="1" fill="${QC.good}"/>` +
            `<rect x="7" y="10" width="12" height="6" rx="1" fill="${QC.caution}"/>` +
            `<rect x="7" y="18" width="12" height="6" rx="1" fill="${QC.failing}"/>`
        ),
        term: 'verdict colour',
        desc:
          `<span class="lg-keys">` +
          `<span><i style="background:${QC.good}"></i>good — passed every check it was in scope for</span>` +
          `<span><i style="background:${QC.caution}"></i>caution — stayed on the road, broke a shape rule</span>` +
          `<span><i style="background:${QC.failing}"></i>failing — left the road, or the rubric</span>` +
          `</span>`,
      },
    ],
  },
  {
    title: 'Event markers',
    note: 'A marker is the glyph of an event the engine actually recorded. A marker with no underlying event cannot exist — so an unmarked line is a line where nothing of that kind happened, never a drawing that forgot.',
    rows: [
      {
        art: swatch(`<polygon points="${hourglass(C, C, R)}" fill="${QC.good}" fill-opacity="0.85"/>`),
        term: 'turn point',
        desc: 'Hourglass — pinched at the waist. Where the rider committed the steering input.',
      },
      {
        art: swatch(`<circle cx="${C}" cy="${C}" r="${R}" fill="none" stroke="${QC.good}" stroke-width="2.1"/>`),
        term: 'apex',
        desc: 'Open ring. The closest point of approach to the inside edge.',
      },
      {
        art: swatch(`<circle cx="${C}" cy="${C}" r="${R * 0.6}" fill="${QC.good}"/>`),
        term: 'exit',
        desc: 'Filled dot, strictly inside the apex ring so the two never read alike.',
      },
      {
        art: swatch(
          `<g stroke="${QC.good}" stroke-width="2.1" fill="none">` +
            `<polyline points="${C - R},${C - R} ${C},${C} ${C - R},${C + R}"/>` +
            `<polyline points="${C},${C - R} ${C + R},${C} ${C},${C + R}"/></g>`
        ),
        term: 'release',
        desc: 'Double chevron. Where brake or throttle came off.',
      },
    ],
  },
  {
    title: 'How a line ends',
    note: 'Every trajectory ends in a glyph that says why it stopped. A failing line’s endpoint always sits at its termination — never wandering into the grass, never running off the frame uncropped.',
    rows: [
      {
        art: swatch(`<line x1="1" y1="13" x2="17" y2="13" stroke="${QC.good}" stroke-width="3"/><polygon points="15,9 23,13 15,17" fill="${QC.good}"/>`, 26, 26),
        term: 'reached the road end',
        desc: 'A plain arrowhead and nothing else. The line rode out the whole drawn window.',
      },
      {
        art: swatch(
          `<line x1="1" y1="17" x2="15" y2="10" stroke="${QC.failing}" stroke-width="2.4"/>` +
            `<polygon points="13,6 21,9 14,14" fill="${QC.failing}"/>` +
            `<line x1="17" y1="1" x2="20" y2="20" stroke="${QC.failing}" stroke-width="2.8" stroke-linecap="butt"/>`,
          26,
          26
        ),
        term: 'ran off the road',
        desc: 'Arrowhead at the crossing plus a short thick tick lying ALONG the road edge. All six mistake lines end this way.',
      },
      {
        art: swatch(`<line x1="1" y1="13" x2="16" y2="13" stroke="${QC.failing}" stroke-width="2.4"/><line x1="17" y1="4" x2="17" y2="22" stroke="${QC.failing}" stroke-width="2.8"/>`, 26, 26),
        term: 'stopped',
        desc: 'A transverse bar replaces the arrowhead. The line came to rest before the road ended.',
      },
      {
        art: swatch(
          `<line x1="1" y1="13" x2="14" y2="13" stroke="${QC.failing}" stroke-width="2.4"/>` +
            `<g stroke="${QC.failing}" stroke-width="2.4"><line x1="13" y1="7" x2="23" y2="19"/><line x1="13" y1="19" x2="23" y2="7"/></g>`,
          26,
          26
        ),
        term: 'crashed',
        desc: 'An ×-burst replaces the arrowhead. None of these six figures reaches one.',
      },
    ],
  },
  {
    title: 'Everything else on the page',
    note: 'The road, the sight geometry and the callouts each have exactly one ink, and none of them can be confused with a trajectory.',
    rows: [
      {
        art: swatch(`<rect x="1" y="5" width="24" height="16" fill="#c9c9c9"/><line x1="1" y1="13" x2="25" y2="13" stroke="#f2f2f2" stroke-width="1.6" stroke-dasharray="3 3"/>`, 26, 26),
        term: 'road corridor',
        desc: 'Flat grey surface with a dashed white lane divider. The rider’s usable width is the lane, inset by the bike’s own margin.',
      },
      {
        art: swatch(`<rect x="1" y="5" width="12" height="16" fill="#c9c9c9"/><rect x="13" y="5" width="12" height="16" fill="#9d9d9d"/>`, 26, 26),
        term: 'what the rider cannot see',
        desc: 'A darker wash over the road beyond an occluder. Blindness comes only from occluders, never from distance.',
      },
      {
        art: swatch(`<rect x="6" y="3" width="14" height="20" fill="#6b6b8a" stroke="#2f2f2f" stroke-width="1"/>`, 26, 26),
        term: 'occluder',
        desc: 'A schematic solid — hedge, wall, bank, or (in figure 8.1) an oncoming vehicle, drawn where it actually blocks the view.',
      },
      {
        art: swatch(`<line x1="1" y1="21" x2="25" y2="5" stroke="${QC.good}" stroke-width="1.6" stroke-dasharray="5 3.5" stroke-opacity="0.45"/>`, 26, 26),
        term: 'sight ray',
        desc: 'The one dashed, arrowhead-free ink: from the rider’s eye to the furthest point they can see. Coloured by that line’s verdict.',
      },
      {
        art: swatch(`<line x1="2" y1="8" x2="24" y2="19" stroke="${NEUTRAL}" stroke-width="1.2"/>`, 26, 26),
        term: 'callout leader',
        desc: 'Thin, solid, neutral grey — never a verdict colour, so a leader can never be mistaken for a line.',
      },
    ],
  },
];

const legendSection = `<section class="legend-block">
  <div class="inner">
    <span class="kicker">Reading the drawings</span>
    <h2 class="section-h">Every symbol on the plates, and what puts it there.</h2>
    <p class="section-lede">
      The figures use one closed vocabulary. Nothing below is decoration: each glyph is emitted by a
      specific rule in the renderer, and the swatches here are drawn with that rule&rsquo;s own geometry.
    </p>
    <div class="legend-grid">
      ${LEGEND_GROUPS.map(
        (g) => `<div class="lg-group">
          <h3 class="lg-title">${esc(g.title)}</h3>
          <p class="lg-note">${g.note}</p>
          <dl class="lg-rows">
            ${g.rows
              .map(
                (r) => `<div class="lg-row">
                  <dt class="lg-art">${r.art}</dt>
                  <dd class="lg-def"><span class="lg-term">${esc(r.term)}</span><span class="lg-desc">${r.desc}</span></dd>
                </div>`
              )
              .join('')}
          </dl>
        </div>`
      ).join('')}
    </div>
  </div>
</section>`;

const META = {
  'fig-08-01': {
    n: '8.1',
    title: 'The premature turn point',
    lesson:
      'Turn in before the geometry is ready and the exit points wide — here, straight at an oncoming vehicle the rider cannot yet see.',
  },
  'fig-08-02': {
    n: '8.2',
    title: 'Slow steering',
    lesson:
      'The same turn point, steered lazily. The roll-in never finishes inside the corner, so the bike is still leaning when it needs to be tracking.',
  },
  'fig-08-03': {
    n: '8.3',
    title: 'Fifty-pencing',
    lesson:
      'Six small steering inputs instead of one. Each correction resets the arc, and the line becomes a polygon rather than a curve.',
  },
  'fig-08-04': {
    n: '8.4',
    title: 'Decreasing radius, entered too fast',
    lesson:
      'Only 2.5 km/h over, but the radius tightens after the turn point — the error compounds where the road gives least room.',
  },
  'fig-08-05': {
    n: '8.5',
    title: 'The double apex, and the cost of an early one',
    lesson:
      'Three linked corners taken as one. Touch the inside of the first too soon and there is no geometry left for the second — the early-apex line is off the outside edge before the third corner exists.',
  },
  'fig-08-06': {
    n: '8.6',
    title: 'The esses',
    lesson:
      'One early turn-in at the first corner, then error amplification: each corner is entered worse than the last until the chain leaves the road.',
  },
};

const QUALITY_LABEL = { good: 'good', caution: 'caution', failing: 'failing' };

const viewFile = (id, dir, suffix) => {
  const p = `${BAKE}/${dir}/${id}${suffix}`;
  return existsSync(p) ? readFileSync(p, 'utf8') : null;
};

const plates = summary.map((rec) => {
  const id = rec.figure;
  const short = id.slice(-2);
  const meta = META[id];
  const scene = readFileSync(`${SCENES}/${id}.scene`, 'utf8').trimEnd();
  const manifest = JSON.parse(readFileSync(`${BAKE}/${id}/manifest.json`, 'utf8'));
  const dir = `views-${short}`;

  // Topdown comes from the `figure` bake, not `render`: the scene's labels: and marks:
  // are figure-spec data that the envelope does not carry, so the render-verb topdown
  // silently drops the book callouts. The figure bake is the committed, blessed artifact.
  const topdown = namespace(readFileSync(`${BAKE}/${id}/${id}.svg`, 'utf8'), `${id}-top`);

  // One POV per LINE (`render --views pov --line <id>`). A single frame is a
  // picture; the pair is the evidence — the camera pose is each line's OWN
  // recorded Sample, so these two frames are what the two riders see from where
  // their own line put them at the same corner.
  // ideal first, then the mistakes — the reader needs the reference frame before
  // the one they are being asked to find fault with.
  const roleOrder = (f) => (f.includes('.good.') ? 0 : 1);
  const povFiles = readdirSync(`${BAKE}/${dir}`)
    .filter((f) => f.endsWith('.pov.svg'))
    .sort((a, b) => roleOrder(a) - roleOrder(b) || a.localeCompare(b));
  const povs = povFiles.map((f) => {
    const raw = readFileSync(`${BAKE}/${dir}/${f}`, 'utf8');
    const lineId = f.replace(`${id}.`, '').replace('.pov.svg', '');
    const hudMatch = raw.match(/<text[^>]*>([^<]*km\/h[^<]*)<\/text>/);
    return {
      line: lineId,
      hud: hudMatch ? hudMatch[1].replace(/\s+/g, ' ').trim() : null,
      svg: namespace(raw, `${id}-pov-${lineId}`),
    };
  });

  const controlFiles = readdirSync(`${BAKE}/${dir}`)
    .filter((f) => f.endsWith('.controls.svg'))
    .sort();
  const controls = controlFiles.map((f) => ({
    line: f.replace(`${id}.`, '').replace('.controls.svg', ''),
    svg: namespace(readFileSync(`${BAKE}/${dir}/${f}`, 'utf8'), `${id}-ctl-${f.length}`),
  }));

  // Refused lines carry a typed error instead of a verdict — read them off the envelope.
  const env = JSON.parse(readFileSync(`${BAKE}/${id}/${id}.json`, 'utf8'));
  const envLines = (env.value ?? env).lines ?? [];
  const refusals = envLines
    .filter((L) => L.ok === false && L.error)
    .map((L) => ({ line: L.line_id, code: L.error.code, message: L.error.message, sub: L.error.detail?.sub_reason }));

  const lineCards = rec.lines
    .filter((L) => L.tally.pass !== undefined)
    .map((L) => {
      const q = QUALITY_LABEL[L.quality] ?? 'failing';
      const corners = L.corners
        .map(
          (c) => `<tr>
            <td class="mono">${esc(c.id)}</td>
            <td class="mono num">${c.lean_max_deg?.toFixed(1) ?? '—'}°</td>
            <td class="mono num">${c.grip_min?.toFixed(2) ?? '—'}</td>
            <td class="mono num">${c.apex_pct?.toFixed(1) ?? '—'}%</td>
            <td class="mono">${c.ran_wide ? '<span class="wide-yes">wide</span>' : '<span class="wide-no">held</span>'}</td>
          </tr>`
        )
        .join('');

      const flags = L.flags.length
        ? `<ul class="flags">${L.flags
            .map(
              (f) =>
                `<li class="flag flag--${f.v}"><span class="flag-v">${esc(f.v)}</span><span class="flag-id mono">${esc(
                  f.id
                )}${f.corner ? `<span class="flag-corner">@${esc(f.corner)}</span>` : ''}</span><span class="flag-msg">${esc(
                  f.msg ?? ''
                )}</span></li>`
            )
            .join('')}</ul>`
        : `<p class="clean-note">No check failures. Every rubric item this line is in scope for passed.</p>`;

      return `<article class="linecard linecard--${q}">
        <header class="linecard-head">
          <span class="pill pill--${q}">${esc(L.quality)}</span>
          <span class="linecard-id mono">${esc(L.id)}</span>
          <span class="linecard-outcome">${esc(L.outcome)}</span>
        </header>
        <p class="headline">${esc(L.headline)}</p>
        ${
          L.diagnosis
            ? `<p class="diagnosis"><span class="diagnosis-label">cause</span> <span class="mono">${esc(
                L.diagnosis.cause
              )}</span>${
                L.diagnosis.at_s !== undefined ? ` <span class="diagnosis-at">at s=${esc(L.diagnosis.at_s)} m</span>` : ''
              }</p>`
            : ''
        }
        <div class="tally">
          <span class="tally-item tally-pass">${L.tally.pass} pass</span>
          <span class="tally-item tally-fail">${L.tally.fail} fail</span>
          <span class="tally-item tally-warn">${L.tally.warn} warn</span>
          <span class="tally-item tally-na">${L.tally.na} n/a</span>
        </div>
        <div class="table-scroll">
          <table class="corner-table">
            <thead><tr><th>corner</th><th class="num">peak lean</th><th class="num">grip min</th><th class="num">apex</th><th>exit</th></tr></thead>
            <tbody>${corners}</tbody>
          </table>
        </div>
        ${flags}
      </article>`;
    })
    .join('');

  const refusalCards = refusals
    .map(
      (r) => `<article class="linecard linecard--refused">
        <header class="linecard-head">
          <span class="pill pill--refused">refused</span>
          <span class="linecard-id mono">${esc(r.line)}</span>
          <span class="linecard-outcome mono">${esc(r.code)}</span>
        </header>
        <p class="headline">${esc(r.message)}</p>
        ${r.sub ? `<p class="diagnosis"><span class="diagnosis-label">reason</span> <span class="mono">${esc(r.sub)}</span></p>` : ''}
        <p class="clean-note">The solver exhausted its scan and returned a typed refusal rather than a line it could not justify.</p>
      </article>`
    )
    .join('');

  const qualityOf = (lineId) => rec.lines.find((L) => L.id === lineId)?.quality ?? 'failing';

  const views = [
    { key: 'top', label: 'Top-down', body: `<div class="viewbox">${topdown}</div>` },
    povs.length
      ? {
          key: 'pov',
          label: povs.length > 1 ? `Rider POV ×${povs.length}` : 'Rider POV',
          body:
            `<p class="pov-lede">Both frames are the same corner, same instant of the road. The camera is each
             line&rsquo;s own recorded position and lean, so the difference between them is the difference the
             mistake makes to what the rider can see.</p>` +
            `<div class="pov-row">${povs
              .map((p) => {
                const q = QUALITY_LABEL[qualityOf(p.line)] ?? 'failing';
                return `<figure class="pov"><div class="viewbox viewbox--pov">${p.svg}</div>
                  <figcaption>
                    <span class="pov-line"><span class="dot dot--${q}"></span><span class="mono">${esc(p.line)}</span></span>
                    ${p.hud ? `<span class="pov-hud mono">${esc(p.hud)}</span>` : ''}
                  </figcaption></figure>`;
              })
              .join('')}</div>`,
        }
      : null,
    controls.length
      ? {
          key: 'ctl',
          label: 'Controls',
          body: `<div class="controls-row">${controls
            .map(
              (c) =>
                `<figure class="ctl"><div class="viewbox viewbox--ctl">${c.svg}</div><figcaption class="mono">${esc(
                  c.line
                )}</figcaption></figure>`
            )
            .join('')}</div>`,
        }
      : null,
  ].filter(Boolean);

  const tabs = views
    .map(
      (v, i) =>
        `<button class="tab${i === 0 ? ' is-active' : ''}" data-fig="${id}" data-view="${v.key}" type="button" role="tab" aria-selected="${
          i === 0 ? 'true' : 'false'
        }">${v.label}</button>`
    )
    .join('');

  const panels = views
    .map(
      (v, i) =>
        `<div class="viewpane${i === 0 ? ' is-active' : ''}" data-fig="${id}" data-view="${v.key}" role="tabpanel">${v.body}</div>`
    )
    .join('');

  const gate = manifest.gate_verdict;

  return `<section class="plate" id="${id}">
    <div class="plate-head">
      <div class="plate-title">
        <span class="eyebrow">Figure ${meta.n}</span>
        <h2>${esc(meta.title)}</h2>
        <p class="lesson">${esc(meta.lesson)}</p>
      </div>
      <dl class="plate-meta">
        <div><dt>spec hash</dt><dd class="mono">${esc(manifest.spec_hash)}</dd></div>
        <div><dt>road window</dt><dd class="mono num">${manifest.view.window.to_s.toFixed(1)} m</dd></div>
        <div><dt>orient</dt><dd class="mono num">${manifest.view.orient}°</dd></div>
        <div><dt>proportion gate</dt><dd><span class="gate gate--${gate}">${esc(gate)}</span></dd></div>
      </dl>
    </div>

    <div class="plate-body">
      <div class="plate-render">
        <div class="tabs" role="tablist">${tabs}</div>
        ${panels}
      </div>
      <div class="plate-side">
        <div class="source">
          <div class="source-head"><span class="source-label">input</span><span class="source-path mono">figures/${id}.scene</span></div>
          <pre class="mono"><code>${esc(scene)}</code></pre>
        </div>
        <div class="verdicts">
          <div class="source-head"><span class="source-label">output</span><span class="source-path">graded lines</span></div>
          ${lineCards}${refusalCards}
        </div>
      </div>
    </div>
  </section>`;
});

// ---------------------------------------------------------------------------
// The analysis. Every number below is READ OFF summary.json, never typed in —
// if a re-bake moves a value, the prose moves with it or the build throws.

const fig = (n) => summary.find((r) => r.figure === `fig-08-0${n}`);
const lineOf = (n, id) => fig(n).lines.find((L) => L.id === id);
const ideal = (n) => fig(n).lines.find((L) => L.id === 'good');
const mistake = (n) => fig(n).lines.find((L) => L.id !== 'good' && L.tally.pass !== undefined);

const NN = [1, 2, 3, 4, 5, 6];

/** the corner where a line actually lost the road — the first `ran_wide`, else the last corner ridden */
const decisiveCorner = (L) => L.corners.find((c) => c.ran_wide) ?? L.corners[L.corners.length - 1];
/** the ideal's decisive corner: the one carrying its committed, latest apex */
const idealCorner = (L) => L.corners.reduce((a, b) => ((b.apex_pct ?? 0) > (a.apex_pct ?? 0) ? b : a));

const num = (x, d = 2) => (x === undefined || x === null ? '—' : x.toFixed(d));

// Finding 1 — every mistake line leaves the road, and every one of them does it
// with grip in hand. `grip_min` is the friction-ellipse MARGIN (1 − ellipse
// magnitude), so a HIGHER number is further from the limit.
const gripRows = NN.map((n) => {
  const g = ideal(n);
  const m = mistake(n);
  return {
    n,
    idealGrip: idealCorner(g).grip_min,
    idealLean: idealCorner(g).lean_max_deg,
    mistakeId: m.id,
    mistakeGrip: decisiveCorner(m).grip_min,
    mistakeLean: decisiveCorner(m).lean_max_deg,
  };
});
const gripHeadroomEverywhere = gripRows.every((r) => r.mistakeGrip > r.idealGrip);
const leanLowerOrEqual = gripRows.every((r) => r.mistakeLean <= r.idealLean + 1e-9);

// Finding 2 — the apex bar. Every ideal commits its apex past the 50 % mark of
// the corner's swept angle; every mistake's decisive corner is apexed before it.
const apexRows = NN.map((n) => ({
  n,
  idealPct: idealCorner(ideal(n)).apex_pct,
  mistakeId: mistake(n).id,
  mistakePct: decisiveCorner(mistake(n)).apex_pct,
  mistakeCorner: decisiveCorner(mistake(n)).id,
}));
const apexSplitClean = apexRows.every((r) => r.idealPct > 50 && r.mistakePct < 50);

// Finding 3 — what the checks actually catch, counted across all twelve lines.
const failCounts = new Map();
for (const rec of summary) {
  for (const L of rec.lines) {
    for (const f of L.flags ?? []) {
      if (f.v !== 'fail') continue;
      failCounts.set(f.id, (failCounts.get(f.id) ?? 0) + 1);
    }
  }
}
const topFails = [...failCounts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

// Finding 4 — the two ideals graded `caution`, and exactly why.
const cautionIdeals = NN.filter((n) => ideal(n).quality === 'caution');
const cleanIdeals = NN.filter((n) => ideal(n).tally.fail === 0);
const cautionDetail = cautionIdeals.map((n) => ({
  n,
  fails: ideal(n).flags.filter((f) => f.v === 'fail'),
  corners: ideal(n).corners.length,
}));
const noCautionContainmentFail = cautionDetail.every((d) =>
  d.fails.every((f) => !/containment/.test(f.id))
);

// Finding 5 — the sight cost of the premature turn point, straight off the two
// POV frames of figure 8.1 (the only figure with an occluder).
const povHud = (n, line) => {
  const p = `${BAKE}/views-0${n}/fig-08-0${n}.${line}.pov.svg`;
  if (!existsSync(p)) return null;
  // read the HUD's data attributes, never its prose — the words are written for
  // a rider and are free to change; the numbers are the contract
  const m = readFileSync(p, 'utf8').match(/data-sight-m="([-\d.]+)" data-ssd-m="([-\d.]+)"/);
  return m ? { sight: Number(m[1]), ssd: Number(m[2]) } : null;
};
const sightGood = povHud(1, 'good');
const sightBad = povHud(1, 'bad');

// The prose below asserts these five shapes. If a re-bake breaks one, the build
// stops rather than shipping a sentence the data no longer supports.
const CLAIMS = [
  [gripHeadroomEverywhere, 'every mistake line has MORE grip margin than its ideal at the decisive corner'],
  [leanLowerOrEqual, 'no mistake line out-leans its ideal'],
  [apexSplitClean, 'every ideal apexes past 50 % and every mistake apexes before it'],
  [noCautionContainmentFail, 'neither caution-graded ideal fails a containment check'],
  [sightGood !== null && sightBad !== null && sightBad.sight < sightGood.sight, 'fig 8.1: the mistake POV sees less than the ideal POV'],
];
for (const [held, what] of CLAIMS) {
  if (!held) throw new Error(`the analysis section asserts something the bake no longer shows: ${what}`);
}

const analysisSection = `<section class="analysis">
  <div class="inner">
    <span class="kicker">Analysis</span>
    <h2 class="section-h">What twelve graded lines actually say.</h2>
    <p class="section-lede">
      Six ideal lines, six mistakes, one rubric of sixteen checks. Read across all of them rather than
      one plate at a time and five things fall out — and the first is not what riders usually blame.
    </p>

    <article class="finding">
      <h3><span class="finding-n">01</span><span class="finding-t">Not one of these six is a grip failure.</span></h3>
      <p>
        Every mistake line ends off the road. Every one of them gets there with more friction in reserve
        than the ideal line it is drawn against, and none of them out-leans it. The failure is geometric —
        the rider spends the corner&rsquo;s width in the wrong order and runs out of road, at a lean angle
        and a grip margin the tyres never noticed. <code>grip_min</code> is the friction-ellipse
        <em>margin</em>, so a bigger number is further from the limit.
      </p>
      <div class="table-scroll">
        <table class="an-table">
          <thead><tr>
            <th>figure</th>
            <th class="num">ideal peak lean</th><th class="num">ideal grip margin</th>
            <th>mistake</th><th class="num">peak lean</th><th class="num">grip margin</th>
          </tr></thead>
          <tbody>${gripRows
            .map(
              (r) => `<tr>
                <td class="mono">8.${r.n}</td>
                <td class="mono num">${num(r.idealLean, 1)}&deg;</td>
                <td class="mono num">${num(r.idealGrip)}</td>
                <td class="mono">${esc(r.mistakeId)}</td>
                <td class="mono num">${num(r.mistakeLean, 1)}&deg;</td>
                <td class="mono num an-good">${num(r.mistakeGrip)}</td>
              </tr>`
            )
            .join('')}</tbody>
        </table>
      </div>
    </article>

    <article class="finding">
      <h3><span class="finding-n">02</span><span class="finding-t">The whole thing turns on one number: where the apex lands.</span></h3>
      <p>
        Apex position is measured as a percentage of the corner&rsquo;s swept angle, and the doctrine puts the
        bar at 50 %. The split is total: all six ideal lines commit their apex past the bar, and in all six
        mistakes the corner that loses the road is apexed before it. ${apexRows.filter((r) => r.mistakePct < 5).length}
        of the six are already at the inside edge before the corner is a twentieth of the way through — the
        line was pointed at the exit before the corner had shown the rider what the exit was.
      </p>
      <div class="table-scroll">
        <table class="an-table">
          <thead><tr><th>figure</th><th class="num">ideal apex</th><th>mistake</th><th class="num">apex at the corner it loses</th><th>corner</th></tr></thead>
          <tbody>${apexRows
            .map(
              (r) => `<tr>
                <td class="mono">8.${r.n}</td>
                <td class="mono num an-good">${num(r.idealPct, 1)}%</td>
                <td class="mono">${esc(r.mistakeId)}</td>
                <td class="mono num an-bad">${num(r.mistakePct, 1)}%</td>
                <td class="mono">${esc(r.mistakeCorner)}</td>
              </tr>`
            )
            .join('')}</tbody>
        </table>
      </div>
    </article>

    <article class="finding">
      <h3><span class="finding-n">03</span><span class="finding-t">The check that fires most is not the one about apexes.</span></h3>
      <p>
        Counted across all twelve lines, ${esc(topFails[0][0])} is the most-failed check
        (${topFails[0][1]} failures), ahead of <code>late_apex</code> at ${esc(String(failCounts.get('late_apex') ?? 0))}.
        That ordering is the point: a bad apex is one symptom, but the shape of the whole
        corner — out, in, out — is what actually breaks, and it breaks in corners whose apex the rubric
        was willing to accept.
      </p>
      <ul class="fail-bars">
        ${topFails
          .map(
            ([cid, count]) => `<li>
              <span class="fb-id mono">${esc(cid)}</span>
              <span class="fb-track"><span class="fb-fill" style="width:${(100 * count) / topFails[0][1]}%"></span></span>
              <span class="fb-n mono num">${count}</span>
            </li>`
          )
          .join('')}
      </ul>
    </article>

    <article class="finding">
      <h3><span class="finding-n">04</span><span class="finding-t">Two of the six ideal lines are only graded <em>caution</em> — and both for the same structural reason.</span></h3>
      <p>
        ${cleanIdeals.length} of the 6 ideal lines pass every check they are in scope for. The
        ${cautionIdeals.length} that do not are ${cautionIdeals.map((n) => `figure&nbsp;8.${n}`).join(' and ')} —
        the only two figures whose road is a <em>chain</em> of linked corners rather than a single one. Both
        stay inside the corridor from end to end; neither fails a containment check. What they fail is
        corner-scoped shape rules applied to corners that are not really separate corners.
      </p>
      ${cautionDetail
        .map(
          (d) => `<div class="caution-card">
            <div class="cc-head"><span class="mono">figure 8.${d.n}</span><span class="cc-note">${d.corners} linked corners · contained end to end</span></div>
            <ul class="cc-fails">${d.fails
              .map((f) => `<li><span class="mono cc-id">${esc(f.id)}${f.corner ? `<span class="cc-corner">@${esc(f.corner)}</span>` : ''}</span><span class="cc-msg">${esc(f.msg ?? '')}</span></li>`)
              .join('')}</ul>
          </div>`
        )
        .join('')}
      <p class="finding-tail">
        On figure 8.5 that is the lesson rather than a defect. The rubric reads the linking corner as a
        corner in its own right and marks its apex early — which is exactly what a compound corner does to
        a rider who takes each corner in turn instead of planning the pair.
      </p>
    </article>

    <article class="finding">
      <h3><span class="finding-n">05</span><span class="finding-t">The one figure with something to see behind proves the cost in metres.</span></h3>
      <p>
        Figure 8.1 is the only scene that declares an occluder. Its two rider-eye frames are taken at the
        same point of the same corner, and the numbers on them are read straight off each line&rsquo;s
        recorded samples. The premature turn point costs
        <strong>${num(sightGood.sight - sightBad.sight, 1)} m of sight</strong> — and turns a comfortable
        margin into a deficit, meaning the rider is travelling faster than they can stop in what they can see.
      </p>
      <div class="table-scroll">
        <table class="an-table">
          <thead><tr><th>figure 8.1, same station</th><th class="num">can see</th><th class="num">needs to stop</th><th class="num">margin</th></tr></thead>
          <tbody>
            <tr><td class="mono">good &mdash; ideal turn point</td><td class="mono num">${num(sightGood.sight, 1)} m</td><td class="mono num">${num(sightGood.ssd, 1)} m</td><td class="mono num an-good">+${num(sightGood.sight - sightGood.ssd, 1)} m</td></tr>
            <tr><td class="mono">bad &mdash; premature turn point</td><td class="mono num">${num(sightBad.sight, 1)} m</td><td class="mono num">${num(sightBad.ssd, 1)} m</td><td class="mono num an-bad">&minus;${num(sightBad.ssd - sightBad.sight, 1)} m</td></tr>
          </tbody>
        </table>
      </div>
    </article>
  </div>
</section>`;

const html = `<title>linelab — Chapter 8 figure bake</title>
<style>
  :root {
    --ground: #f4f5ee;
    --panel: #fffffc;
    --panel-2: #eceee2;
    --ink: #1b2016;
    --ink-2: #4a5142;
    --ink-3: #767c6d;
    --rule: #d3d7c6;
    --rule-2: #e3e6d8;
    --accent: #1f6f3f;
    --accent-soft: #e0ebe0;
    --fail: #a8232a;
    --fail-soft: #f6e2e1;
    --warn: #96701a;
    --warn-soft: #f4ecd8;
    --na: #8b9182;
    --serif: 'Iowan Old Style', 'Palatino Linotype', Palatino, Georgia, ui-serif, serif;
    --sans: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    --mono: ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --ground: #14170f;
      --panel: #1c2016;
      --panel-2: #23281c;
      --ink: #eaece0;
      --ink-2: #b6bcaa;
      --ink-3: #8a9080;
      --rule: #333a28;
      --rule-2: #2a3020;
      --accent: #6fbe84;
      --accent-soft: #1e3226;
      --fail: #e8837f;
      --fail-soft: #37211f;
      --warn: #d6ac52;
      --warn-soft: #33291432;
      --na: #79806e;
    }
  }
  :root[data-theme='dark'] {
    --ground: #14170f;
    --panel: #1c2016;
    --panel-2: #23281c;
    --ink: #eaece0;
    --ink-2: #b6bcaa;
    --ink-3: #8a9080;
    --rule: #333a28;
    --rule-2: #2a3020;
    --accent: #6fbe84;
    --accent-soft: #1e3226;
    --fail: #e8837f;
    --fail-soft: #37211f;
    --warn: #d6ac52;
    --warn-soft: #332914;
    --na: #79806e;
  }
  :root[data-theme='light'] {
    --ground: #f4f5ee;
    --panel: #fffffc;
    --panel-2: #eceee2;
    --ink: #1b2016;
    --ink-2: #4a5142;
    --ink-3: #767c6d;
    --rule: #d3d7c6;
    --rule-2: #e3e6d8;
    --accent: #1f6f3f;
    --accent-soft: #e0ebe0;
    --fail: #a8232a;
    --fail-soft: #f6e2e1;
    --warn: #96701a;
    --warn-soft: #f4ecd8;
    --na: #8b9182;
  }

  .wrap { background: var(--ground); color: var(--ink); font-family: var(--sans); line-height: 1.55; }
  .mono { font-family: var(--mono); }
  .num { font-variant-numeric: tabular-nums; }
  .inner { max-width: 1180px; margin: 0 auto; padding: 0 clamp(16px, 4vw, 40px); }

  /* ---- masthead ---- */
  .masthead { border-bottom: 1px solid var(--rule); padding: clamp(40px, 7vw, 84px) 0 clamp(28px, 4vw, 44px); }
  .kicker { font-family: var(--mono); font-size: 11px; letter-spacing: 0.16em; text-transform: uppercase; color: var(--ink-3); }
  .masthead h1 {
    font-family: var(--serif); font-weight: 600; text-wrap: balance;
    font-size: clamp(34px, 6vw, 62px); line-height: 1.04; letter-spacing: -0.015em;
    margin: 14px 0 0;
  }
  .standfirst {
    font-family: var(--serif); font-size: clamp(17px, 2vw, 21px); color: var(--ink-2);
    max-width: 62ch; margin: 18px 0 0;
  }
  .receipts { display: flex; flex-wrap: wrap; gap: 0 32px; margin: 30px 0 0; padding: 0; list-style: none; }
  .receipts div { display: flex; flex-direction: column; gap: 3px; padding: 10px 0; }
  .receipts dt { font-family: var(--mono); font-size: 10px; letter-spacing: 0.13em; text-transform: uppercase; color: var(--ink-3); }
  .receipts dd { margin: 0; font-family: var(--serif); font-size: 22px; font-variant-numeric: tabular-nums; }
  .receipts dd small { font-family: var(--sans); font-size: 12px; color: var(--ink-3); }

  .howto { border-bottom: 1px solid var(--rule); padding: 26px 0 30px; }
  .howto p { margin: 0; max-width: 74ch; color: var(--ink-2); font-size: 15px; }
  .howto pre {
    margin: 16px 0 0; padding: 14px 16px; background: var(--panel-2); border: 1px solid var(--rule-2);
    border-radius: 3px; overflow-x: auto; font-size: 12.5px; color: var(--ink);
  }
  .howto pre code { white-space: pre; }

  /* ---- plates ---- */
  .plate { border-bottom: 1px solid var(--rule); padding: clamp(34px, 5vw, 58px) 0; }
  .plate-head { display: flex; flex-wrap: wrap; gap: 24px 40px; align-items: flex-start; justify-content: space-between; }
  .plate-title { flex: 1 1 440px; }
  .eyebrow {
    font-family: var(--mono); font-size: 10.5px; letter-spacing: 0.18em; text-transform: uppercase;
    color: var(--accent); display: block;
  }
  .plate-title h2 {
    font-family: var(--serif); font-weight: 600; font-size: clamp(24px, 3.4vw, 35px);
    line-height: 1.12; margin: 8px 0 0; text-wrap: balance; letter-spacing: -0.01em;
  }
  .lesson { margin: 10px 0 0; color: var(--ink-2); max-width: 60ch; font-size: 15px; }
  .plate-meta { display: grid; grid-template-columns: repeat(2, minmax(94px, auto)); gap: 12px 26px; margin: 4px 0 0; }
  .plate-meta div { display: flex; flex-direction: column; gap: 2px; }
  .plate-meta dt { font-family: var(--mono); font-size: 9.5px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--ink-3); }
  .plate-meta dd { margin: 0; font-size: 13.5px; }

  .gate { font-family: var(--mono); font-size: 11.5px; padding: 2px 7px; border-radius: 2px; border: 1px solid; }
  .gate--pass { color: var(--accent); border-color: var(--accent); background: var(--accent-soft); }
  .gate--warn { color: var(--warn); border-color: var(--warn); background: var(--warn-soft); }
  .gate--fail { color: var(--fail); border-color: var(--fail); background: var(--fail-soft); }

  .plate-body { display: grid; grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr); gap: clamp(20px, 3vw, 38px); margin-top: 28px; align-items: start; }
  @media (max-width: 900px) { .plate-body { grid-template-columns: minmax(0, 1fr); } }

  .tabs { display: flex; gap: 2px; margin-bottom: 10px; }
  .tab {
    font-family: var(--mono); font-size: 11px; letter-spacing: 0.06em; text-transform: uppercase;
    padding: 7px 12px; background: transparent; color: var(--ink-3);
    border: 1px solid var(--rule); border-radius: 2px; cursor: pointer;
  }
  .tab:hover { color: var(--ink); border-color: var(--ink-3); }
  .tab:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
  .tab.is-active { color: var(--panel); background: var(--ink); border-color: var(--ink); }

  /* Named .viewpane, not .panel — the controls strips contain <g class="panel panel-v">,
     and a bare .panel rule here sets display:none on every trace panel inside them. */
  .viewpane { display: none; }
  .viewpane.is-active { display: block; }
  .viewbox {
    background: var(--panel); border: 1px solid var(--rule); border-radius: 3px;
    padding: 8px; overflow-x: auto;
  }
  .plate-svg { display: block; width: 100%; height: auto; max-width: 100%; }
  .viewbox--ctl { padding: 6px; }
  .controls-row { display: flex; flex-wrap: wrap; gap: 14px; }
  .ctl { margin: 0; flex: 0 1 190px; }
  .ctl figcaption { font-size: 11px; color: var(--ink-3); margin-top: 6px; text-align: center; }

  /* ---- side column ---- */
  .plate-side { display: flex; flex-direction: column; gap: 22px; }
  .source-head { display: flex; align-items: baseline; gap: 10px; margin-bottom: 8px; }
  .source-label {
    font-family: var(--mono); font-size: 9.5px; letter-spacing: 0.16em; text-transform: uppercase;
    color: var(--panel); background: var(--ink-2); padding: 2px 6px; border-radius: 2px;
  }
  .source-path { font-size: 11.5px; color: var(--ink-3); }
  .source pre {
    margin: 0; padding: 14px; background: var(--panel-2); border: 1px solid var(--rule-2);
    border-radius: 3px; overflow-x: auto; font-size: 12px; line-height: 1.6; color: var(--ink);
  }
  .source pre code { white-space: pre; }

  .verdicts { display: flex; flex-direction: column; gap: 12px; }
  .linecard {
    background: var(--panel); border: 1px solid var(--rule); border-radius: 3px;
    padding: 14px 15px; border-left-width: 3px;
  }
  .linecard--good { border-left-color: var(--accent); }
  .linecard--caution { border-left-color: var(--warn); }
  .linecard--failing { border-left-color: var(--fail); }
  .linecard--refused { border-left-color: var(--ink-3); border-left-style: dashed; }

  .linecard-head { display: flex; align-items: center; gap: 9px; flex-wrap: wrap; }
  .pill {
    font-family: var(--mono); font-size: 10px; letter-spacing: 0.1em; text-transform: uppercase;
    padding: 2.5px 7px; border-radius: 2px;
  }
  .pill--good { color: var(--accent); background: var(--accent-soft); }
  .pill--caution { color: var(--warn); background: var(--warn-soft); }
  .pill--failing { color: var(--fail); background: var(--fail-soft); }
  .pill--refused { color: var(--ink-2); background: var(--panel-2); }
  .linecard-id { font-size: 13px; font-weight: 600; }
  .linecard-outcome { font-size: 12px; color: var(--ink-3); margin-left: auto; }
  .headline { margin: 9px 0 0; font-family: var(--serif); font-size: 15.5px; }
  .diagnosis { margin: 7px 0 0; font-size: 12.5px; color: var(--ink-2); }
  .diagnosis-label {
    font-family: var(--mono); font-size: 9.5px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--ink-3);
  }
  .diagnosis-at { color: var(--ink-3); font-variant-numeric: tabular-nums; }

  .tally { display: flex; flex-wrap: wrap; gap: 6px; margin: 11px 0 0; }
  .tally-item { font-family: var(--mono); font-size: 10.5px; padding: 2px 6px; border-radius: 2px; background: var(--panel-2); color: var(--ink-2); }
  .tally-pass { color: var(--accent); }
  .tally-fail { color: var(--fail); }
  .tally-warn { color: var(--warn); }
  .tally-na { color: var(--na); }

  .table-scroll { overflow-x: auto; margin: 12px 0 0; }
  .corner-table { border-collapse: collapse; width: 100%; font-size: 12px; }
  .corner-table th {
    text-align: left; font-family: var(--mono); font-weight: 400; font-size: 9.5px;
    letter-spacing: 0.1em; text-transform: uppercase; color: var(--ink-3);
    padding: 0 10px 5px 0; border-bottom: 1px solid var(--rule);
  }
  .corner-table th.num, .corner-table td.num { text-align: right; }
  .corner-table td { padding: 5px 10px 5px 0; border-bottom: 1px solid var(--rule-2); }
  .corner-table tr:last-child td { border-bottom: none; }
  .wide-yes { color: var(--fail); }
  .wide-no { color: var(--accent); }

  .flags { list-style: none; margin: 12px 0 0; padding: 0; display: flex; flex-direction: column; gap: 7px; }
  .flag { display: grid; grid-template-columns: auto 1fr; gap: 3px 8px; font-size: 12px; align-items: baseline; }
  .flag-v {
    font-family: var(--mono); font-size: 9px; letter-spacing: 0.08em; text-transform: uppercase;
    padding: 2px 5px; border-radius: 2px; align-self: start;
  }
  .flag--fail .flag-v { color: var(--fail); background: var(--fail-soft); }
  .flag--warn .flag-v { color: var(--warn); background: var(--warn-soft); }
  .flag-id { font-size: 12px; font-weight: 600; }
  .flag-corner { color: var(--ink-3); font-weight: 400; }
  .flag-msg { grid-column: 2; color: var(--ink-2); }
  .clean-note { margin: 11px 0 0; font-size: 12.5px; color: var(--ink-3); font-style: italic; }

  /* ---- shared section furniture (legend + analysis) ---- */
  .section-h {
    font-family: var(--serif); font-weight: 600; font-size: clamp(24px, 3.6vw, 38px);
    line-height: 1.1; letter-spacing: -0.012em; margin: 12px 0 0; text-wrap: balance; max-width: 22ch;
  }
  .section-lede { font-family: var(--serif); font-size: clamp(16px, 1.7vw, 19px); color: var(--ink-2); max-width: 66ch; margin: 14px 0 0; }

  /* ---- legend ---- */
  .legend-block { border-bottom: 1px solid var(--rule); padding: clamp(38px, 5vw, 64px) 0; background: var(--panel-2); }
  .legend-grid {
    display: grid; grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: clamp(18px, 2.4vw, 30px); margin-top: clamp(26px, 3.5vw, 40px); align-items: start;
  }
  @media (max-width: 780px) { .legend-grid { grid-template-columns: minmax(0, 1fr); } }
  .lg-group { background: var(--panel); border: 1px solid var(--rule); border-radius: 3px; padding: 18px 18px 8px; }
  .lg-title {
    font-family: var(--mono); font-size: 10.5px; letter-spacing: 0.16em; text-transform: uppercase;
    color: var(--accent); margin: 0;
  }
  .lg-note { margin: 9px 0 0; font-size: 12.5px; color: var(--ink-3); line-height: 1.5; }
  .lg-rows { margin: 14px 0 0; display: flex; flex-direction: column; }
  .lg-row { display: grid; grid-template-columns: 32px minmax(0, 1fr); gap: 14px; align-items: start; padding: 10px 0; border-top: 1px solid var(--rule-2); }
  /* The glyph colours are the renderer's own literals, so the swatches sit on the
     figures' own #e7ecd8 background rather than the page's — the same ink on the
     same ground, in either theme. */
  .lg-art { margin: 0; display: flex; align-items: center; justify-content: center; }
  .lg-svg { display: block; background: #e7ecd8; border-radius: 2px; padding: 2px; }
  .lg-def { margin: 0; display: flex; flex-direction: column; gap: 3px; }
  .lg-term { font-size: 13px; font-weight: 600; }
  .lg-desc { font-size: 12.5px; color: var(--ink-2); line-height: 1.5; }
  .lg-keys { display: flex; flex-direction: column; gap: 4px; }
  .lg-keys span { display: flex; align-items: center; gap: 7px; }
  .lg-keys i { width: 11px; height: 11px; border-radius: 2px; display: block; flex: none; }

  /* ---- POV pair ---- */
  .pov-lede { margin: 0 0 10px; font-size: 12.5px; color: var(--ink-3); line-height: 1.55; max-width: 68ch; }
  /* A 1000x600 frame at 300 px wide is unreadable; stack until there is real room. */
  .pov-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(380px, 1fr)); gap: 16px; }
  .pov { margin: 0; }
  .pov figcaption { margin-top: 7px; display: flex; flex-direction: column; gap: 3px; }
  .pov-line { display: flex; align-items: center; gap: 6px; font-size: 12.5px; font-weight: 600; }
  .pov-hud { font-size: 11px; color: var(--ink-3); }
  .dot { width: 9px; height: 9px; border-radius: 50%; display: inline-block; flex: none; }
  .dot--good { background: var(--accent); }
  .dot--caution { background: var(--warn); }
  .dot--failing { background: var(--fail); }

  /* ---- analysis ---- */
  .analysis { border-top: 1px solid var(--rule); padding: clamp(40px, 6vw, 72px) 0 clamp(30px, 4vw, 48px); }
  .finding { margin-top: clamp(30px, 4vw, 46px); padding-top: clamp(24px, 3vw, 34px); border-top: 1px solid var(--rule-2); }
  .finding h3 {
    font-family: var(--serif); font-weight: 600; font-size: clamp(19px, 2.3vw, 25px); line-height: 1.2;
    margin: 0; display: flex; gap: 14px; align-items: baseline;
  }
  .finding-n { font-family: var(--mono); font-size: 12px; color: var(--accent); letter-spacing: 0.06em; flex: none; }
  .finding-t { text-wrap: balance; max-width: 42ch; }
  .finding p { margin: 12px 0 0 0; color: var(--ink-2); font-size: 15px; max-width: 72ch; }
  .finding p code { font-family: var(--mono); font-size: 12.5px; background: var(--panel-2); padding: 1px 5px; border-radius: 2px; }
  .finding-tail { font-style: italic; }
  .an-table { border-collapse: collapse; width: 100%; max-width: 820px; font-size: 12.5px; margin-top: 16px; min-width: 480px; }
  .an-table th {
    text-align: left; font-family: var(--mono); font-weight: 400; font-size: 9.5px; letter-spacing: 0.1em;
    text-transform: uppercase; color: var(--ink-3); padding: 0 14px 6px 0; border-bottom: 1px solid var(--rule);
  }
  .an-table th.num, .an-table td.num { text-align: right; }
  .an-table td { padding: 7px 14px 7px 0; border-bottom: 1px solid var(--rule-2); }
  .an-table tr:last-child td { border-bottom: none; }
  .an-good { color: var(--accent); }
  .an-bad { color: var(--fail); }

  .fail-bars { list-style: none; margin: 18px 0 0; padding: 0; display: flex; flex-direction: column; gap: 6px; max-width: 620px; }
  .fail-bars li { display: grid; grid-template-columns: 150px minmax(0, 1fr) 28px; gap: 10px; align-items: center; }
  .fb-id { font-size: 11.5px; color: var(--ink-2); }
  .fb-track { background: var(--panel-2); border: 1px solid var(--rule-2); border-radius: 2px; height: 12px; overflow: hidden; }
  .fb-fill { display: block; height: 100%; background: var(--fail); opacity: 0.72; }
  .fb-n { font-size: 11.5px; color: var(--ink-3); text-align: right; }

  .caution-card { margin-top: 14px; background: var(--panel); border: 1px solid var(--rule); border-left: 3px solid var(--warn); border-radius: 3px; padding: 13px 15px; }
  .cc-head { display: flex; flex-wrap: wrap; gap: 10px; align-items: baseline; }
  .cc-head .mono { font-size: 13px; font-weight: 600; }
  .cc-note { font-size: 12px; color: var(--ink-3); }
  .cc-fails { list-style: none; margin: 10px 0 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
  .cc-fails li { display: grid; grid-template-columns: minmax(150px, auto) minmax(0, 1fr); gap: 4px 12px; font-size: 12.5px; align-items: baseline; }
  .cc-id { font-weight: 600; }
  .cc-corner { color: var(--ink-3); font-weight: 400; }
  .cc-msg { color: var(--ink-2); }
  @media (max-width: 560px) { .cc-fails li { grid-template-columns: minmax(0, 1fr); } }

  /* ---- footer ---- */
  .colophon { padding: clamp(34px, 5vw, 56px) 0 clamp(48px, 7vw, 80px); }
  .colophon h2 { font-family: var(--serif); font-size: 22px; margin: 0 0 14px; font-weight: 600; }
  .colophon p { margin: 0 0 12px; color: var(--ink-2); font-size: 14.5px; max-width: 74ch; }
  .colophon code { font-family: var(--mono); font-size: 12.5px; background: var(--panel-2); padding: 1px 5px; border-radius: 2px; }
</style>

<div class="wrap">
  <header class="masthead">
    <div class="inner">
      <span class="kicker">linelab · deterministic line-analysis engine</span>
      <h1>Six figures from Chapter&nbsp;8, drawn by physics rather than by hand.</h1>
      <p class="standfirst">
        Each plate below started as a few lines of scene text. linelab composed the road, integrated a
        single-track motorcycle over it with RK4, graded the resulting line against sixteen
        <em>Total Control</em> riding checks, and drew what it found — top-down, from the rider's eye, and
        as a strip of control inputs.
      </p>
      <dl class="receipts">
        <div><dt>figures baked</dt><dd>6</dd></div>
        <div><dt>lines graded</dt><dd>12 <small>6 ideal · 6 mistakes</small></dd></div>
        <div><dt>re-bake drift</dt><dd>0 bytes <small>all six byte-identical</small></dd></div>
        <div><dt>views per figure</dt><dd>5 <small>1 top-down, 2 POV, 2 control strips</small></dd></div>
        <div><dt>riding checks</dt><dd>16</dd></div>
        <div><dt>runtime deps</dt><dd>0</dd></div>
      </dl>
    </div>
  </header>

  <section class="howto">
    <div class="inner">
      <p>
        Everything here came out of one command per figure. The engine is the only source of truth —
        the renderers never re-derive physics, they only draw what the solver already computed.
      </p>
      <pre class="mono"><code>node dist/cli/main.js figure figures/fig-08-01.scene --mode true --out out/fig-08-01
node dist/cli/main.js render out/fig-08-01/fig-08-01.json --views topdown,controls --mode true --out views-01
node dist/cli/main.js render out/fig-08-01/fig-08-01.json --views pov --line good --mode true --out views-01
node dist/cli/main.js render out/fig-08-01/fig-08-01.json --views pov --line bad  --mode true --out views-01</code></pre>
    </div>
  </section>

  ${legendSection}

  <main class="inner">
    ${plates.join('\n')}
  </main>

  ${analysisSection}

  <footer class="colophon">
    <div class="inner">
      <h2>Three caveats worth stating plainly</h2>
      <p>
        <strong>The proportion gate is not a physics verdict.</strong> It checks whether the drawing is
        honest about scale, and these bakes ran in <code>--mode true</code>, the identity transform: literal
        metric proportion, no frame rotation. That makes the gate report <code>fail</code> or
        <code>warn</code> on the tighter figures, and it means figure 8.6's authored <code>orient=90</code>
        is recorded in the manifest but not applied. Diagram-mode compression, which is what would satisfy
        the gate, is deferred past v1.0 and recorded in the project's deviations log. The geometry is
        correct; the gate is measuring page composition.
      </p>
      <p>
        <strong>Figure 8.5's ideal line is the chained one, not a two-touch one.</strong> The double-apex
        solver refuses on this road — <code>NO_SOLUTION / no_two_touch_line</code> — and it refuses at every
        entry speed probed from 18 to 36 km/h, so this is a solver capability gap rather than a fact about
        30 km/h: the compound-window drift arithmetic cannot widen the line back out to the middle corner's
        inside edge. Rather than draw a line the engine cannot justify, the scene asks for the chained line
        it can. That line is graded <code>caution</code>, and finding 04 above explains why that grade is
        the figure's lesson rather than its defect.
      </p>
      <p>
        <strong>The rider-POV pairs are two cameras, not two roads.</strong> Both frames in a plate are the
        same corner at the same point of the road. What differs is where each line put its own rider, so
        the pose, the lean that rolls the horizon, and every number in the strip are that line's own
        recorded samples. Nothing in the POV is re-derived: the limit-point chevron consumes the very same
        field the top-down sight ray points at.
      </p>
    </div>
  </footer>
</div>

<script>
  document.querySelectorAll('.tab').forEach(function (tab) {
    tab.addEventListener('click', function () {
      var fig = tab.dataset.fig;
      var view = tab.dataset.view;
      document.querySelectorAll('.tab[data-fig="' + fig + '"]').forEach(function (t) {
        var on = t === tab;
        t.classList.toggle('is-active', on);
        t.setAttribute('aria-selected', on ? 'true' : 'false');
      });
      document.querySelectorAll('.viewpane[data-fig="' + fig + '"]').forEach(function (p) {
        p.classList.toggle('is-active', p.dataset.view === view);
      });
    });
  });
</script>
`;

// The embedded SVGs carry their own class names (panel, trace, exit, apex, …). Any page
// class that collides with one of them silently restyles the figures — a bare `.panel`
// rule once set display:none on every trace panel in the controls strips. Fail the build
// instead of shipping an invisible regression.
const pageClasses = new Set([...html.matchAll(/^\s*\.([a-zA-Z][\w-]*)/gm)].map((m) => m[1]));
// .plate-svg is deliberately stamped onto the SVG roots by namespace(); it is ours.
const collisions = [...pageClasses].filter((c) => svgClassNames.has(c) && c !== 'plate-svg');
if (collisions.length) {
  throw new Error(
    `page CSS classes collide with classes inside the embedded SVGs: ${collisions.join(', ')}`
  );
}

// The bake writes real UTF-8 (em dashes, degree signs, middle dots) into SVG text nodes.
// Inlined into HTML those bytes are at the mercy of the document's charset, and a
// Latin-1 fallback renders them as mojibake. Numeric character references are
// encoding-independent, so the page reads correctly however it is served.
const asciiSafe = [...html]
  .map((ch) => (ch.codePointAt(0) > 127 ? `&#${ch.codePointAt(0)};` : ch))
  .join('');

writeFileSync(GALLERY_OUT, asciiSafe);
const nonAscii = [...html].filter((c) => c.codePointAt(0) > 127).length;
console.log(`wrote gallery.html ${asciiSafe.length} bytes (escaped ${nonAscii} non-ASCII chars)`);
