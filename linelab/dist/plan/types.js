// plan/types.ts — ALL input wire shapes (ARCHITECTURE §3/§4): Scenario, PlanAction,
// Occluder, Hazard, MistakeSpec, SolveSpec, Constraint, Figure, FigureSpec. Field
// names copied VERBATIM from design/03 (§2.1, §4.1, §4.2, §6, §6.1, §7.2, §8) and
// design/04 (§4.5 Constraint, the `ride` line-kind field surface for SolveSpec).
//
// These are RAW-JSON-shaped (author-facing) types: anchors are unresolved
// (`{ref, offset_m?} | {at_s}`), `turn_in.target` may still be the symbolic
// `"tangent_inside"`, `position.over_m` may still be `"auto"`. `validate()`
// consumes a `Scenario` and produces a `ValidatedScenario` (defined here too —
// see the file-end note on why that is NOT `core.ResolvedScenario`).
//
// road/types.ts already owns the `RoadSpec` union (Segment, roadSpec) — imported,
// never redeclared here (ARCHITECTURE §4 type-ownership law).
export {};
// ---------------------------------------------------------------------------
// DEVIATION NOTE (recorded in the WP-05 return too): ARCHITECTURE §5 phrases
// the interface as `validate(json) → Result<Scenario>`, and §4's type-ownership
// table separately files `ResolvedScenario` at core/types.ts as "frozen
// post-validate form the engine consumes". The two cannot be the same value
// when `turn_in.target === "tangent_inside"`: design/03 §6.1 keeps that value
// legal wire input ("defers the magnitude to the solver"), but
// `core.ResolvedTurnInAction.target` (WP-01, frozen, not owned by this
// package) is `{lean_deg: number}` only — no symbolic slot. `validate()` is
// explicitly closed-form and never runs the engine or solver (03 §5.7), so it
// cannot discharge that deferral itself. Resolution taken here: `validate()`
// returns `Result<ValidatedScenario>` (this file) — identical to
// `core.ResolvedScenario` in every field except `rider.plan`'s turn_in variant,
// which keeps the `TurnInTarget` union. Once a solver has rewritten every
// `tangent_inside` to an explicit lean (the "literalize" step, 03 §7.4;
// "solvers rewrite every solved turn_in to the fully explicit form", 03 §6.1),
// a `ValidatedScenario` value is structurally a `core.ResolvedScenario` and
// downstream packages (solve/) may narrow it as such.
//# sourceMappingURL=types.js.map