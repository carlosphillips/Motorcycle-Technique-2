import type { ViewLegendMode } from "./project.js";
import type { DrawnLine, LegendRow } from "./scene.js";
/** design/06 §5.3 — build the legend rows (draw order) + the `auto` render trigger. */
export declare function buildLegend(lines: readonly DrawnLine[], mode: ViewLegendMode): {
    visible: boolean;
    rows: LegendRow[];
};
