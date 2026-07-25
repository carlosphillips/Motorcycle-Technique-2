// viewer/page.ts — the workstation page (design/07 §6.1), as a pure string.
//
// The layout, verbatim from §6.1:
//   Left:   topdown with its mode toggle
//   Right:  pov (immersion, v0.3) with its `look` toggle (heading | limit point)
//   Bottom: the controls strip with the linked cursor, the timeline scrubber,
//           and the named-event ticks
//   Side:   the HUD panel, the line legend (role, verdict colour, focus
//           control), and the lock toggle
//
// NO BUNDLER, NO FRAMEWORK, NO RUNTIME DEPENDENCY (D1). The page loads
// `<module-root>/viewer/boot.js` as a native ES module; that module's relative
// imports (`../solve/run.js`, `../core/stateAt.js`, …) are the compiled output
// of the SAME source tree the CLI runs — NodeNext's mandatory `.js` extensions
// (ARCHITECTURE §1) are exactly what makes the emitted graph browser-loadable
// with no rewrite step. That is the mechanism behind "the viewer imports the
// same modules the CLI imports" (07 §2.1).
//
// The preloaded payload rides the page as an inert
// `<script type="application/json">` block, so the page issues no network
// request of its own beyond fetching its own modules.

export interface PageOptions {
  /** URL prefix the compiled ES modules are served under, e.g. "/m" */
  readonly moduleRoot: string;
  /** the SPEC document (scenario + line specs) — never a trajectory (07 §2.1) */
  readonly payloadJson: string;
  /** shown in the title bar and the header strip */
  readonly title: string;
  readonly engineSemver: string;
}

/** `</script>` inside JSON text would close the block early — the one escape needed. */
function escapeScriptJson(json: string): string {
  return json.replace(/<\//g, "<\\/");
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

const STYLE = `
:root { color-scheme: light; --ink:#1d1d1f; --muted:#6b6b70; --rule:#d8d8dc; }
* { box-sizing: border-box; }
body { margin:0; font:13px/1.45 ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,sans-serif; color:var(--ink); background:#f6f6f4; }
header { display:flex; gap:12px; align-items:baseline; padding:8px 12px; border-bottom:1px solid var(--rule); background:#fff; }
header h1 { font-size:14px; margin:0; font-weight:600; }
header .sub { color:var(--muted); }
main { display:grid; grid-template-columns:minmax(0,1fr) 320px; gap:12px; padding:12px; align-items:start; }
section { background:#fff; border:1px solid var(--rule); border-radius:6px; padding:8px; min-width:0; }
section h2 { font-size:11px; text-transform:uppercase; letter-spacing:.06em; color:var(--muted); margin:0 0 6px; }
#topdown svg, #controls svg, #pov svg { width:100%; height:auto; display:block; }
footer { padding:0 12px 16px; }
.strip { display:flex; gap:8px; align-items:center; flex-wrap:wrap; margin-top:8px; }
.strip button, .strip select { font:inherit; padding:3px 8px; border:1px solid var(--rule); border-radius:4px; background:#fff; }
#scrubber { flex:1 1 320px; min-width:200px; }
#readout { font-variant-numeric:tabular-nums; color:var(--muted); }
table.hud { width:100%; border-collapse:collapse; font-variant-numeric:tabular-nums; }
table.hud td { padding:2px 4px; border-bottom:1px solid #f0f0f2; vertical-align:top; }
table.hud td.g { color:var(--muted); width:64px; }
table.hud td.k { color:var(--muted); width:110px; }
table.hud td.v { text-align:right; }
table.hud tr[data-badge] td.v { font-weight:600; }
table.hud tr[data-badge="deficit"] td.v { color:#b32e2e; }
table.hud tr[data-badge="clip"] td.v { color:#b07d1e; }
@media (max-width: 900px) { main { grid-template-columns:minmax(0,1fr); } }
`.trim();

/**
 * The complete page. Element ids here are the contract `viewer/app.ts`'s
 * `boot` binds against — one list, in one file, so a renamed pane cannot
 * silently unwire a control.
 */
export function viewerPageHtml(opts: PageOptions): string {
  return [
    "<!doctype html>",
    '<html lang="en"><head><meta charset="utf-8"/>',
    '<meta name="viewport" content="width=device-width,initial-scale=1"/>',
    `<title>${escapeHtml(opts.title)} — linelab</title>`,
    `<style>${STYLE}</style>`,
    "</head><body>",
    `<header><h1>${escapeHtml(opts.title)}</h1>`,
    `<span class="sub">linelab ${escapeHtml(opts.engineSemver)} · stepper (v0.2)</span>`,
    '<span class="sub" id="readout">loading…</span></header>',
    "<main>",
    '<section><h2>topdown</h2><div id="topdown"></div></section>',
    // 07 §6.1's right pane: the pov view with its `look` toggle
    '<section><h2>pov</h2><div id="pov"></div>',
    '<div class="strip"><select id="look"><option value="heading" selected>heading</option>',
    '<option value="limit_point">limit point</option></select></div></section>',
    '<section><h2>hud</h2><div id="hud"></div>',
    '<h2 style="margin-top:10px">lines</h2><select id="legend" size="4" style="width:100%"></select>',
    '<h2 style="margin-top:10px">lock</h2><select id="lock"><option value="station">station</option><option value="time">time</option></select>',
    "</section>",
    "</main>",
    '<footer><section><h2>controls</h2><div id="controls"></div>',
    '<div class="strip">',
    '<button id="play" type="button">play / pause</button>',
    '<button id="axis" type="button">axis: t / s</button>',
    '<button id="frame-back" type="button">−0.1 s</button>',
    '<button id="frame-fwd" type="button">+0.1 s</button>',
    '<button id="sample-back" type="button">− sample</button>',
    '<button id="sample-fwd" type="button">+ sample</button>',
    '<select id="speed"><option value="0.25">0.25×</option><option value="0.5">0.5×</option>',
    '<option value="1" selected>1×</option><option value="2">2×</option></select>',
    '<select id="bookmarks"></select>',
    "</div>",
    // the scrubber rides a 0..1 FRACTION of the cursor domain, so the range
    // control needs no per-line min/max rewrite as focus changes
    '<div class="strip"><input id="scrubber" type="range" min="0" max="1" step="0.0005" value="0"/></div>',
    "</section></footer>",
    `<script type="application/json" id="payload">${escapeScriptJson(opts.payloadJson)}</script>`,
    `<script type="module" src="${escapeHtml(opts.moduleRoot)}/viewer/boot.js"></script>`,
    "</body></html>"
  ].join("");
}
