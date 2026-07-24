// render/scene.ts — DrawnScene, the internal type this package designs
// (ARCHITECTURE §4: "DrawnScene is YOURS to design in render/scene.ts — derive
// its fields from what draw stages 1–11 consume; validate your design against
// 06 §3.1"). Not spelled field-by-field by design/06 (brief §10 ambiguity 1);
// the fields below are exactly what topdown.ts's stages 1–11 read, minus
// stage 5b (the D45 fan, absent per phase law) and the fields diagram mode
// alone would need (compression factors, degradation ratio) — v0.1 ships
// `mode: "true"` only (ARCHITECTURE §6.5).
//
// `markers`/`labels` start empty out of `project()` (road/lines/viewSpec alone
// don't carry MarkSpec or the figure's label set — those are FigureSpec-level
// authoring data, not physics) and are attached by markers.ts/labels.ts via
// the `with*` builders below — pure, immutable, new-instance composition
// (never a mutation of the base scene project() returned).
/** Pure attach — a new `DrawnScene`, never a mutation of `scene` (markers.ts's `deriveMarkers` output). */
export function withMarkers(scene, markers) {
    return { ...scene, markers };
}
/** Pure attach — a new `DrawnScene`, never a mutation of `scene` (labels.ts's `resolveLabels` output). */
export function withLabels(scene, labels) {
    return { ...scene, labels };
}
//# sourceMappingURL=scene.js.map