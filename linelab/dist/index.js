// src/index.ts — the root export surface (A-IMPORT-SURFACE, ARCHITECTURE §5).
// The v0.1 surface named there plus the v0.2 names whose packages have SHIPPED
// (see the marked v0.2 append at the bottom). Unshipped v0.3/D45 names
// (compare, commitmentEnvelope) are ABSENT — not stubbed (phase law, §9.2).
// `sweep` is design/08 §7.1's one importable name this build does not carry as
// a library function: it exists only as the argv-shaped CLI verb
// (cli/verbs/sweep.ts `sweepVerb`). Recorded in DEVIATIONS.md rather than
// re-exported under a signature no design doc gives it.
// This file's whole job is aggregation: it is exempt from the module-DAG's
// outgoing-import rule (test/meta/imports.test.ts) precisely so it may reach
// into every rank.
// -- solve ---------------------------------------------------------------
export { run } from "./solve/run.js";
export { solve } from "./solve/solve.js";
export { suggestTurnIn } from "./solve/suggest.js";
export { chainedSolve } from "./solve/chained.js";
export { solveDoubleApex } from "./solve/doubleApex.js";
export { compileMistake } from "./solve/mistake.js";
export { correctiveShot } from "./solve/corrective.js";
export { counterfactual } from "./solve/counterfactual.js";
export { gateFigure } from "./solve/gate.js";
// -- plan ------------------------------------------------------------------
export { validate } from "./plan/validate.js";
export { lowerScene } from "./plan/scene.js";
// -- road --------------------------------------------------------------------
export { compose } from "./road/compose.js";
export { parseRoadDSL, printRoadDSL } from "./road/dsl.js";
export { truncateAt } from "./road/truncate.js";
// -- sight ---------------------------------------------------------------------
export { sightFrom } from "./sight/cast.js";
export { ssd } from "./sight/ssd.js";
// -- render --------------------------------------------------------------------
export { project } from "./render/project.js";
export { renderTopdown } from "./render/topdown.js";
export { renderViews } from "./render/index.js";
export { gateProportions } from "./render/gateProportions.js";
// -- cli self-documentation ------------------------------------------------------
export { explain } from "./cli/doc/explain.js";
export { buildSchemaDoc } from "./cli/doc/schema.js";
// ---------------------------------------------------------------------------
// v0.2 — inspection surface (MARKED APPEND; a name lands here exactly when its
// work package ships it — coordinate here, do not reorder the block above).
//   · stateAt package (this block): the per-instant query + phase machine.
//   · WP-23 (state/sweep verbs) and WP-24 (serve) append below this line.
export { stateAt } from "./core/stateAt.js";
//   · standing package (D43): the ladder + its printing-surface strings.
export { standing, standingAttachment, standingPlacard, STANDING_RUNGS, STANDING_GLOSS } from "./solve/standing.js";
//   · save-window package (D44): the reserve-lean save window and its one probe.
//     Both sit at the `correctiveShot` tier (design/08 §7.1): pure, synchronous,
//     frozen in and out, Result-typed, out of hash.
export { saveWindow, saveAt, SAVE_WINDOW_PLACARD, SAVE_WINDOW_STATUSES } from "./solve/saveWindow.js";
//   · controls strip (design/06 §4): the v0.2 render view.
export { renderControls } from "./render/controls.js";
//# sourceMappingURL=index.js.map