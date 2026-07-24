// render/manifest.ts — the export manifest writer (design/06 §7, verbatim
// shape). Pure: returns a plain object; IO (writing `manifest.json`) is a
// cli/ concern (ARCHITECTURE §2: IO is legal only in cli/main.ts/bless.ts).

import type { FigureRole } from "../plan/types.js";
import type { Outcome } from "../core/types.js";
import type { Quality } from "../plan/doctrine/quality.js";
import type { DrawnScene } from "./scene.js";
import type { GateVerdict, ProportionMetrics } from "./gateProportions.js";

export interface ManifestLegendRow {
  readonly line_id: string;
  readonly role: FigureRole;
  readonly quality: Quality;
  readonly outcome: Outcome;
}

export interface ManifestViewRecord {
  readonly window: { readonly from_s: number; readonly to_s: number };
  /** the RESOLVED orient (design/06 §2.4/§7) — never the requested value. */
  readonly orient: 0 | 90 | 180 | 270;
}

export interface ManifestRecord {
  readonly figure_id: string;
  readonly spec_hash: string;
  readonly mode: "true";
  readonly view: ManifestViewRecord;
  readonly legend: readonly ManifestLegendRow[];
  readonly proportion_metrics: ProportionMetrics;
  readonly gate_verdict: GateVerdict;
  readonly png?: string;
}

/**
 * `buildManifestRecord(...)` (design/06 §7's per-figure record). `legend`
 * mirrors the rendered legend rows exactly (§7: "assertable mechanically in
 * CI, not hoped for in pixels") — sourced from `scene.legend.rows`, not
 * recomputed. `png` is an optional path/data-URI a caller may attach after
 * rasterizing (owned by design/09, not this package).
 */
export function buildManifestRecord(
  figureId: string,
  specHash: string,
  scene: DrawnScene,
  metrics: ProportionMetrics,
  gateVerdict: GateVerdict,
  png?: string
): ManifestRecord {
  return {
    figure_id: figureId,
    spec_hash: specHash,
    mode: scene.mode,
    view: { window: scene.window, orient: scene.orient },
    // legend.ts nulls `outcome` for a "good" row (nothing to append, §5.3); the
    // quality law (plan/doctrine/quality.ts) makes "good" ⇔ outcome="contained"
    // by construction, so the fallback below is exact, not a guess.
    legend: scene.legend.rows.map((r) => ({ line_id: r.line_id, role: r.role, quality: r.quality, outcome: r.outcome ?? "contained" })),
    proportion_metrics: metrics,
    gate_verdict: gateVerdict,
    ...(png !== undefined ? { png } : {})
  };
}
