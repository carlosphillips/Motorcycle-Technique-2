// render/legend.ts — the legend, "the role channel" (design/06 §5.3, D28).
// One row per line, in DRAW order (`reference → alternative → mistake →
// ideal`), grammar `<swatch> <name> — <role> · <quality> [(<outcome>)]`; the
// `auto` trigger renders whenever the figure has ≥ 2 lines OR any line's
// quality ≠ "good".
import { roleRank, trajectoryInk } from "./ink.js";
/** design/06 §5.3 — build the legend rows (draw order) + the `auto` render trigger. */
export function buildLegend(lines, mode) {
    const rows = [...lines]
        .sort((a, b) => roleRank(a.role) - roleRank(b.role))
        .map((l) => {
        const ink = trajectoryInk(l.role);
        return {
            line_id: l.line_id,
            name: l.label,
            role: l.role,
            quality: l.quality,
            // design/06 §5.3: outcome word appended iff quality !== "good"
            outcome: l.quality === "good" ? null : l.outcome,
            swatch: { colour: l.colour, width: ink.width, dash: ink.dash, arrowhead: ink.arrowhead }
        };
    });
    const auto = lines.length >= 2 || lines.some((l) => l.quality !== "good");
    const visible = mode === "on" ? true : mode === "off" ? false : auto;
    return { visible, rows };
}
//# sourceMappingURL=legend.js.map