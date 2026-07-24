// render/manifest.ts — the export manifest writer (design/06 §7, verbatim
// shape). Pure: returns a plain object; IO (writing `manifest.json`) is a
// cli/ concern (ARCHITECTURE §2: IO is legal only in cli/main.ts/bless.ts).
/**
 * `buildManifestRecord(...)` (design/06 §7's per-figure record). `legend`
 * mirrors the rendered legend rows exactly (§7: "assertable mechanically in
 * CI, not hoped for in pixels") — sourced from `scene.legend.rows`, not
 * recomputed. `png` is an optional path/data-URI a caller may attach after
 * rasterizing (owned by design/09, not this package).
 */
export function buildManifestRecord(figureId, specHash, scene, metrics, gateVerdict, png) {
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
//# sourceMappingURL=manifest.js.map