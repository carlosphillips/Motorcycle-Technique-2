// solve/types.ts — ALL output envelope shapes (ARCHITECTURE §4): Verdict,
// CorrectiveBlock (re-export), MisjudgmentBlock, LineResult, LineRefusal,
// FigureResult, GateReport, SkewRecord, the NO_SOLUTION sub-reason registry,
// and the counterfactual types WP-08 declared in counterfactual.ts (re-exported
// here per the WP-09 ownership amendment — never re-declared).
//
// Design of record: design/05 §6 (verdict), §7 (envelope), §8 (identity/skew/
// cache); design/04 §4.10 (NO_SOLUTION registry), §4a.6 (corrective block);
// design/08 §3.4 (gate law). Closed sets are copied VERBATIM into single
// `as const` declarations (drift risk #12).
//
// Phase law (00 §3, ARCHITECTURE §4): the still-unshipped v0.2 shapes —
// SaveWindow, the FigureResult.standing attachment, verdict.commitment — are
// ABSENT here, not stubbed. C-SAVEWIN-NO-INK reads this file's silence as the
// sentinel. StandingReport SHIPPED with the D43 ladder (v0.2 inspection): it is
// declared at its definition site (solve/standing.ts) and re-exported here per
// the §4 type-ownership address — the counterfactual precedent, never
// re-declared. The envelope itself still carries NO standing member: the
// attachment is written only where requested (05 §7) and lands with the
// envelope verbs' wiring.
export { COUNTERFACTUAL_RIDERS, CF_PREDICATES, CF_REFUSAL_REASONS, CF_RIDER_REGISTRY, CF_PREDICATE_REGISTRY, CF_DISCLOSURE_LEAN_ONLY, CF_DEFERRED_D45 } from "./counterfactual.js";
export { CORRECTIVE_FAIL_REASONS, CORRECTIVE_BINDING, CORRECTIVE_DISCLOSURE } from "./corrective.js";
// ---------------------------------------------------------------------------
// Pinned identity literals (design/05 §6.3, §7): both the envelope's `spec`
// and the verdict's `engine` are the string "linelab/1".
/** design/05 §7/§8.1 — `FigureResult.spec` / `FigureSpec.spec` pinned literal. */
export const LINELAB_SPEC = "linelab/1";
/** design/05 §6.3 — `Verdict.engine` pinned literal. */
export const ENGINE_ID = "linelab/1";
// ---------------------------------------------------------------------------
// The NO_SOLUTION sub-reason registry (design/04 §4.10 — closed set, copied
// VERBATIM in the doc's declaration order; extension is a design change).
// The token rides `detail.sub_reason` (the ONE exception to the detail.reason
// convention, core/result.ts).
export const NO_SOLUTION_SUB_REASONS = [
    "turn_in_infeasible_early",
    "turn_in_infeasible_late",
    "empty_band",
    "non_clean_band",
    "coarse_fine_disagreement",
    "constraint_unmet",
    "road_too_short",
    "no_double_apex_geometry",
    "no_two_touch_line",
    "believed_world_not_clean",
    "no_rankable_candidate",
    "authored_action_conflict",
    "link_flip_infeasible",
    "vis_unsatisfiable_within_bound",
    "vis_speed_below_model_floor"
];
// ---------------------------------------------------------------------------
// Diagnosis (design/05 §6.1 — closed cause set; the block is excluded from
// result_hash, §8.3: richer diagnostics must never perturb regression hashes).
export const DIAGNOSIS_CAUSES = [
    "overspeed_entry",
    "grip_exceeded",
    "roll_rate_limited",
    "sight_deficit",
    "late_brake",
    "plan_gap",
    "stand_up"
];
/** design/05 §6.3 misjudgment.divergence.kind — closed set. */
export const MISJUDGE_DIVERGENCE_KINDS = ["radius", "sweep", "structure"];
// ---------------------------------------------------------------------------
// Solved-plan cache provenance (design/05 §7/§8.1 — never silent)
export const CACHE_STATES = ["hit", "stale_engine", "stale_spec", "absent"];
// ---------------------------------------------------------------------------
// Version skew (design/05 §8.4 — closed, ordered tier vocabulary; the record
// is placard DATA: it never blocks and never changes computation, D31)
/** Per-line tiers, ordered `match < unstamped < detail < story`. */
export const LINE_SKEW_TIERS = ["match", "unstamped", "detail", "story"];
/** Figure-level tiers (the figure never reads "unstamped"; "info" is figure-only). */
export const FIGURE_SKEW_TIERS = ["match", "info", "detail", "story"];
// ---------------------------------------------------------------------------
// GateReport (design/08 §3.4; TYPE ONLY here — gateFigure lands with WP-12's
// solve/gate.ts). The design pins the gate LAW (the five E(line) derivation
// rules and the bidirectional met/missed evaluation) but no wire shape; this
// shape is the minimal record of that law: which rule derived E, what E was,
// what was observed, and whether it was met in both directions.
/** Which §3.4 rule derived E(line): rules 1–5 in order. */
export const GATE_EXPECT_SOURCES = [
    "explicit_expect",
    "mistake_pin",
    "best_failing",
    "chained_vis",
    "default"
];
//# sourceMappingURL=types.js.map