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
    readonly window: {
        readonly from_s: number;
        readonly to_s: number;
    };
    /** the RESOLVED orient (design/06 §2.4/§7) — never the requested value. */
    readonly orient: 0 | 90 | 180 | 270;
}
export interface ManifestRecord {
    readonly figure_id: string;
    readonly spec_hash: string;
    readonly mode: "true";
    readonly view: ManifestViewRecord;
    readonly legend: readonly ManifestLegendRow[];
    /**
     * design/06 §7 (amended for S15) — the authored stage-11 placard strings,
     * mirrored exactly as `legend` mirrors the rendered rows. OMITTED when the
     * figure carries none, so the committed records stay byte-identical.
     * Mandatory when there IS ink: J7 "no fabrication" fails anything drawn that
     * the manifest does not declare (design/09 §7.2, gated by T-JUDGE-RECORD).
     */
    readonly placards?: readonly string[];
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
export declare function buildManifestRecord(figureId: string, specHash: string, scene: DrawnScene, metrics: ProportionMetrics, gateVerdict: GateVerdict, png?: string): ManifestRecord;
