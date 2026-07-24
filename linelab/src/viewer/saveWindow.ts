// viewer/saveWindow.ts — the save-window OVERLAY (design/07 §3.6).
//
// "A toggle beside the corrective-ghost toggle, OFF BY DEFAULT, per line. When
// on, the viewer calls the pure core function `saveWindow(lineResult)` (08
// §7.1) ONCE PER TOGGLE — not per frame."
//
// So this file computes nothing and caches everything: `saveWindowOverlay(line)`
// is the once-per-toggle call, and every per-frame function below takes the
// resulting frozen object plus the cursor. No physics, no arithmetic on a
// physics value beyond unit formatting (07 §2.4) — the HUD rows READ members of
// the returned `SaveWindow` and record WHICH member in `path`, exactly as
// viewer/hud.ts does for the `InstantState`, so `C-SAVEWIN-HUD` ("every
// displayed save-window field equals the returned object, precision-clamped to
// HORIZON_DISPLAY_DP") is a walk over the rows rather than an inspection.
//
// What §3.6 draws, and what this file therefore emits, per corner whose
// `corrective ≠ null` and whose `status ∈ {resolved, open_at_end}`:
//   · a neutral save-window glyph at the projected `s_close_m` on that line —
//     an OPEN RING WITH A TICK, "deliberately distinct from the ring apex
//     marker and from the corrective ghost's stroke" — with the one-line
//     neutral leader label `save window closed · s = 34.2 m`;
//   · one timeline tick on the scrubber at `tau_close_s`, in the overlay
//     register and visually distinct from event ticks;
//   · one HUD row in the Verdict group — the countdown — plus the static
//     reaction-budget line;
//   · the 04 §4b.7 placard, beside every displayed scalar, always.
//
// `intermittent` / `never_open` → "the placard and the status sentence replace
// all of the above and NO SCALAR IS DRAWN; the rider id and the policy block
// remain readable in the overlay's detail panel". `not_applicable` → inert.
//
// When the shadow is drawn it is CLIPPED AT s* (§3.6, §3.5, 04 §4b.4) —
// `C-SAVEWIN-CLIP`. `saveAt` already returns a clipped document; this file
// projects its vertices and asserts nothing further, so there is one clip law.
//
// D9/D11: NO LINE INK IS MODULATED. Every colour here is the neutral overlay
// ink; `quality` remains the single total colour function per line, and
// `C-SAVEWIN-NO-INK` holds because nothing in `render/` can reach this module.

import type { Result } from "../core/result.js";
import { ok } from "../core/result.js";
import type { LineResult } from "../solve/types.js";
import {
  SAVE_WINDOW_PLACARD,
  SAVE_WINDOW_STATUS_SENTENCES,
  horizonDisplay,
  saveAt,
  saveWindow,
  type SaveWindow,
  type SaveWindowInput,
  type SaveWindowOptions
} from "../solve/saveWindow.js";
import { rotatePoint } from "../render/project.js";
import type { DrawnScene } from "../render/scene.js";
import type { HudRow } from "./types.js";
import { SAVE_WINDOW_INK, SAVE_WINDOW_RING_R_M, SAVE_WINDOW_TICK_M } from "./constants.js";

/** One world-frame point of a drawn probe (already rotated by the scene's orient). */
export interface OverlayPoint {
  readonly x: number;
  readonly y: number;
}

/** The drawable part of one corner's window — present only for a scalar-bearing status. */
export interface SaveWindowProbe {
  readonly corner_id: string;
  /** = the window's `s_close_m`, verbatim */
  readonly s_close_m: number;
  /** = the window's `tau_close_s`, verbatim */
  readonly tau_close_s: number;
  /** = the window's `s_star_m`, or null on `open_at_end` (no return was observed) */
  readonly s_star_m: number | null;
  /** the CLIPPED probe path in world metres; its LAST vertex is s* (C-SAVEWIN-CLIP) */
  readonly path: readonly OverlayPoint[];
  /** the station the last vertex sits at — what C-SAVEWIN-CLIP compares */
  readonly last_vertex_s: number;
  /** §3.6's leader label, display-clamped */
  readonly label: string;
}

/**
 * The once-per-toggle object. Frozen; every per-frame function below is a pure
 * read of it.
 */
export interface SaveWindowOverlay {
  readonly line_id: string;
  /** every corner's window, INCLUDING the refusing ones — disclosure survives (§4b.5) */
  readonly windows: readonly SaveWindow[];
  /** the drawable subset, in corner order */
  readonly probes: readonly SaveWindowProbe[];
  /** the §4b.7 placard, verbatim — rendered beside every displayed scalar */
  readonly placard: string;
}

function inputOf(line: LineResult): SaveWindowInput {
  return {
    line_id: line.line_id,
    trajectory: line.trajectory,
    resolved_scenario: line.resolved_scenario,
    verdict: { corners: line.verdict.corners }
  };
}

/** §3.6's drawable predicate — the ONLY place the overlay decides to draw. */
function drawsScalars(w: SaveWindow): boolean {
  return w.status === "resolved" || w.status === "open_at_end";
}

/**
 * `saveWindowOverlay(line, scene?)` — the once-per-toggle computation.
 *
 * `scene` is the top-down projection the overlay rides on; when given, each
 * drawable corner's probe path is projected into the same world-metre frame
 * `viewer/glyph.ts` uses (orient applied), so the overlay `<g>` needs no second
 * copy of render/'s frame math. Without it the probe paths are empty and only
 * the HUD/tick surfaces are available — which is what a headless caller wants.
 */
export function saveWindowOverlay(
  line: LineResult,
  scene?: DrawnScene,
  opts?: SaveWindowOptions
): Result<SaveWindowOverlay> {
  const input = inputOf(line);
  const all = saveWindow(input, undefined, opts);
  if (!all.ok) return all as Result<SaveWindowOverlay>;

  const probes: SaveWindowProbe[] = [];
  for (const w of all.value) {
    if (!drawsScalars(w) || w.tau_close_s === undefined || w.s_close_m === undefined) continue;
    // The drawn probe is the SAME document `saveAt` returns at `tau_close_s`,
    // already clipped at s* by 04 §4b.4 — this file re-clips nothing.
    const probe = saveAt(input, w.corner_id, w.tau_close_s);
    if (!probe.ok) continue; // a probe that cannot be re-launched simply draws nothing
    const samples = probe.value.shadow.samples;
    const path: OverlayPoint[] = samples.map((p) => {
      if (scene === undefined) return { x: p.x, y: p.y };
      const r = rotatePoint({ x: p.x, y: p.y }, scene.pivot.x, scene.pivot.y, scene.orient);
      return { x: r.x, y: r.y };
    });
    const last = samples[samples.length - 1];
    probes.push(
      Object.freeze({
        corner_id: w.corner_id,
        s_close_m: w.s_close_m,
        tau_close_s: w.tau_close_s,
        s_star_m: w.s_star_m ?? null,
        path: Object.freeze(path),
        last_vertex_s: last === undefined ? Number.NaN : last.s,
        label: `save window closed · s = ${horizonDisplay(w.s_close_m)} m`
      })
    );
  }

  return ok(
    Object.freeze({
      line_id: line.line_id,
      windows: all.value,
      probes: Object.freeze(probes),
      placard: SAVE_WINDOW_PLACARD
    })
  );
}

// ---------------------------------------------------------------------------
// The HUD rows (07 §3.6's "one HUD row in the Verdict group")

/**
 * `saveWindowHudRows(overlay, cursorT)` — the Verdict-group rows for one
 * cursor instant. Every row's `value` is READ from the returned `SaveWindow`
 * and its `path` names the member it came from, which is what makes
 * `C-SAVEWIN-HUD` a walk rather than an inspection. Every printed number is
 * clamped to HORIZON_DISPLAY_DP (04 §4b.5).
 *
 * §3.6's wording, verbatim:
 *   `save window: closes in 0.4 s` before `tau_close_s`
 *   `save window: closed 0.6 s ago` after
 *   `reaction budget −0.6 s vs react 1.0 s` (static)
 *   `save window: still open at the horizon` on `open_at_end`
 * and, on a refusing status, the placard + the status sentence INSTEAD of all
 * of the above.
 */
export function saveWindowHudRows(overlay: SaveWindowOverlay, cursorT: number): readonly HudRow[] {
  const rows: HudRow[] = [];
  for (const w of overlay.windows) {
    if (w.status === "not_applicable") continue; // the toggle is inert for that corner
    const label = `save window · ${w.corner_id}`;
    if (!drawsScalars(w)) {
      // a refusal: the SENTENCE replaces the scalars, and no scalar is emitted
      rows.push(
        Object.freeze({
          group: "verdict" as const,
          label,
          text: SAVE_WINDOW_STATUS_SENTENCES[w.status].replace("N times", `${w.transition_count} times`),
          value: w.status,
          origin: "envelope" as const,
          path: null
        })
      );
      continue;
    }
    if (w.status === "open_at_end") {
      rows.push(
        Object.freeze({
          group: "verdict" as const,
          label,
          text: "save window: still open at the horizon",
          value: w.status,
          origin: "envelope" as const,
          path: null
        })
      );
    } else {
      const delta = w.tau_close_s! - cursorT;
      rows.push(
        Object.freeze({
          group: "verdict" as const,
          label,
          text:
            delta >= 0
              ? `save window: closes in ${horizonDisplay(delta)} s`
              : `save window: closed ${horizonDisplay(-delta)} s ago`,
          value: w.tau_close_s!,
          origin: "envelope" as const,
          path: "tau_close_s"
        })
      );
    }
    if (w.reaction_budget_s !== undefined && w.react_profile_s !== undefined) {
      rows.push(
        Object.freeze({
          group: "verdict" as const,
          label: `reaction budget · ${w.corner_id}`,
          text: `reaction budget ${horizonDisplay(w.reaction_budget_s)} s vs react ${horizonDisplay(w.react_profile_s)} s`,
          value: w.reaction_budget_s,
          origin: "envelope" as const,
          path: "reaction_budget_s"
        })
      );
    }
    // "the 04 §4b.7 placard, beside every displayed scalar, always" — emitted by
    // the same function that emitted the scalars, so it cannot be dropped.
    rows.push(
      Object.freeze({
        group: "verdict" as const,
        label: "save window placard",
        text: overlay.placard,
        value: overlay.placard,
        origin: "envelope" as const,
        path: "placard"
      })
    );
  }
  return Object.freeze(rows);
}

/** §3.6's scrubber ticks — one per drawable corner, at `tau_close_s`, verbatim. */
export function saveWindowTicks(overlay: SaveWindowOverlay): readonly { readonly corner_id: string; readonly t: number }[] {
  return Object.freeze(overlay.probes.map((p) => Object.freeze({ corner_id: p.corner_id, t: p.tau_close_s })));
}

// ---------------------------------------------------------------------------
// The drawing (a `<g>` appended to the top-down, exactly as viewer/glyph.ts is)

function num(n: number): string {
  return String(Number(n.toFixed(4)));
}

/**
 * The overlay `<g>`: per drawable corner, the clipped probe polyline, the open
 * ring + tick glyph at `s_close_m`, and the leader label. All neutral ink —
 * D9's colour law is untouched (07 §3.6: "No line ink is modulated anywhere").
 */
export function saveWindowOverlaySvg(overlay: SaveWindowOverlay): string {
  if (overlay.probes.length === 0) return "";
  let out = `<g data-overlay="save-window" data-line="${overlay.line_id}">`;
  for (const probe of overlay.probes) {
    // One group per corner, stamped with the CLIP's own station so
    // C-SAVEWIN-CLIP is readable off the drawing even when the clipped probe
    // degenerates to a single retained sample (which it does at exactly
    // `tau_close_s`, where s* sits at the launch station).
    out +=
      `<g data-overlay="save-window-corner" data-corner="${probe.corner_id}" ` +
      `data-last-vertex-s="${num(probe.last_vertex_s)}" ` +
      `data-s-close-m="${num(probe.s_close_m)}" data-tau-close-s="${num(probe.tau_close_s)}">`;
    if (probe.path.length > 1) {
      out +=
        `<polyline data-overlay="save-probe" ` +
        `points="${probe.path.map((p) => `${num(p.x)},${num(p.y)}`).join(" ")}" ` +
        `fill="none" stroke="${SAVE_WINDOW_INK}" stroke-width="0.10" stroke-dasharray="0.5 0.35"/>`;
    }
    const head = probe.path[probe.path.length - 1];
    if (head !== undefined) {
      // the open ring with a tick — deliberately unlike the apex ring (solid
      // stroke, no tick) and unlike the corrective ghost's stroke
      out +=
        `<g data-overlay="save-glyph">` +
        `<circle cx="${num(head.x)}" cy="${num(head.y)}" r="${num(SAVE_WINDOW_RING_R_M)}" ` +
        `fill="none" stroke="${SAVE_WINDOW_INK}" stroke-width="0.09"/>` +
        `<line x1="${num(head.x)}" y1="${num(head.y - SAVE_WINDOW_RING_R_M)}" ` +
        `x2="${num(head.x)}" y2="${num(head.y - SAVE_WINDOW_RING_R_M - SAVE_WINDOW_TICK_M)}" ` +
        `stroke="${SAVE_WINDOW_INK}" stroke-width="0.09"/>` +
        `<text x="${num(head.x + SAVE_WINDOW_RING_R_M + 0.3)}" y="${num(head.y)}" ` +
        `font-family="sans-serif" font-size="0.6" fill="${SAVE_WINDOW_INK}">${probe.label}</text>` +
        `</g>`;
    }
    out += "</g>";
  }
  out += "</g>";
  return out;
}
