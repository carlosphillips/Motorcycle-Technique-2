// cli/doc/explain.ts — explain() (design/08 §5.2; ARCHITECTURE §5): pure,
// exported, byte-equal to `linelab explain` stdout. Disambiguation order,
// pinned: (1) an already-resolved envelope object → narrate the result;
// (2) else exact match against the three REQUIRED-DISJOINT closed
// vocabularies, in order check ids → error codes → mistake kinds;
// (3) else the D42-D45 analysis vocabulary (lean_only_reserve/counterfactual
// ship in v0.1; the D43 standing targets ship with the ladder;
// brake_reserve_escape and the D44/D45 names are deferred);
// (4) else tombstones (UNKNOWN_ID, never deferred);
// (5) else SCHEMA, message listing all three disambiguation vocabularies.
//
// The `-`-or-readable-file DECISION is IO (fs.existsSync) and lives in
// main.ts; by the time this pure function runs, the caller has already
// decided whether `input` is a parsed envelope or a bare vocabulary target.
import { CHECK_IDS } from "../../plan/doctrine/checks.js";
import { loadShippedRubricPack, rubricString } from "../../plan/doctrine/pack.js";
import { CONFIG_RUBRIC_DEFAULT } from "../../plan/constants.js";
import { STANDING_RUNGS, STANDING_GLOSS, standingPlacard } from "../../solve/standing.js";
import { SAVE_WINDOW_PLACARD, SAVE_WINDOW_STATUSES, SAVE_WINDOW_STATUS_SENTENCES } from "../../solve/saveWindow.js";
import { HORIZON_DISPLAY_DP } from "../../solve/constants.js";
import { ERROR_CODES } from "../../core/result.js";
import { MISTAKE_KIND_DEFS, MISTAKE_KINDS, MISTAKE_PIN_TABLE } from "../../plan/mistakes.js";
import { CF_DISCLOSURE_LEAN_ONLY, CF_RIDER_REGISTRY, COUNTERFACTUAL_RIDERS } from "../../solve/counterfactual.js";
import { gateFigure } from "../../solve/gate.js";
import { isLineRefusal } from "../../solve/envelope.js";
import { tombstoneFor, tombstoneError, deferredError } from "../deferred.js";
function isObject(v) {
    return typeof v === "object" && v !== null && !Array.isArray(v);
}
function isEnvelopeShaped(v) {
    return isObject(v) && Array.isArray(v["lines"]) && "figure_id" in v && "road" in v;
}
// ---------------------------------------------------------------------------
// The closed-code narration table (design/08 §7.2, verbatim meanings)
const ERROR_CODE_MESSAGES = {
    SCHEMA: "Malformed input / bad field (carries schema_ref). A phase-gated token also carries deferred: \"<phase>\".",
    DUP_ID: "Duplicate plan-action / segment / occluder / hazard / line id.",
    OUT_OF_SCOPE: "A deliberate scope cut (low-speed U-turn regime, vertical geometry, moving hazards, …) with the placard text.",
    UNKNOWN_ID: "Addressed an id that does not exist — also the tombstone home for struck/renamed names.",
    BAD_RANGE: "Non-physical number (negative radius, mu <= 0, …), or an out-of-domain state query.",
    NO_SOLUTION: "A solver found no feasible target; the typed sub-reason rides in detail.sub_reason. Exits 3 on every verb.",
    INEFFECTUAL: "Input that would validate but provably do nothing — rejected, naming the dead field (D8).",
    INTERNAL: "An invariant believed impossible; exits 4."
};
// ---------------------------------------------------------------------------
// Analysis vocabulary (D42-D45) — additions, not part of the 3 required-disjoint
// disambiguation vocabularies (design/08 §5.2).
const ANALYSIS_SHIPPED = {
    counterfactual: "counterfactual(world, x0, latency, rider, predicate) — the ONE what-if harness (design/04 §4c.1); pure, Result-typed; a violated rider obligation is INTERNAL, never a quiet answer.",
    lean_only_reserve: `${CF_RIDER_REGISTRY.lean_only_reserve.short_name} (reachable in v0.1). ${CF_DISCLOSURE_LEAN_ONLY}`
};
// D44 save-window targets — SHIPPED with the analysis (design/08 §5.2:
// "explain save-window prints all five status values with their sentences and
// the 04 §4b.7 placard"). The `inspection (v0.2)` deferral row is now empty:
// nothing on this vocabulary is unshipped, so the list is gone rather than
// carried empty (the phase-gating law, D8/D37).
const SAVE_WINDOW_TARGETS = {
    "save-window": "saveWindow(lineResult, cornerId?) — the D44 reserve-lean save window (design/04 §4b): the last start instant from which the ONE lean-only counterfactual rider still returns inside the corridor before the station where this line ran wide. Out of hash, off by default, off the gate: no verdict member, no check, no exported ink (C-SAVEWIN-NO-INK).",
    tau_close_s: "tau_close_s — under status \"resolved\", the LAST tau that evaluated saved=true, bisected inside the single (true,false) grid pair to HORIZON_EPS_S (04 §4b.5); the reported window is never longer than the measured one. Under \"open_at_end\" it is the scanned horizon, not an observed closure. Absent on \"never_open\" and \"intermittent\", which are refusals.",
    reaction_budget_s: "reaction_budget_s = tau_close_s − t_earliest_s, where t_earliest_s = max(t_detect_s, t_freeze_end_s) is the earliest instant at which an input was physically possible (04 §4b.6). It answers \"how much of the reaction you needed did you actually have\", and is compared against the rider profile's react_profile_s. Comparable WITHIN a hand, not across one (09's G-SAVEWIN-WIDE limitation)."
};
// D43 standing-ladder targets — SHIPPED with the ladder (design/08 §5.2:
// "explain standing prints the threshold table, the rung-token gloss, the
// loaded pack's reserve_checks, and the 05 §6.4 placard").
const STANDING_TARGETS = {
    standing: "standing(lineResult) — the D43 five-rung ladder over the closed ordered set reserved:4 > clean:3 > caution:2 > failing:1 > crash:0, defined by monotone cumulative thresholds; out of hash, off by default, off the gate: it enters no Verdict, no Sample, no result_hash, no spec_hash, and no exit code.",
    reserved: 'reserved (rung 4) — clean(line) AND every check named in the rubric pack\'s declared annex.reserve_checks returns verdict "pass" on every applicable instance. An "na" or zero-instance member makes reserved unattainable and caps standing at 3 — the ladder never asserts a judgment the rubric refused.',
    reserve_checks: "rubric.annex.reserve_checks — declared pack data, out of hash (design/01 §A.6.1): the check ids whose PASS band (not merely their not-fail band) the standing ladder's top rung requires. Missing annex → SCHEMA/reserve_checks_missing; empty → SCHEMA/reserve_checks_empty; unknown member → UNKNOWN_ID/unknown_reserve_check (renames consulted first → renamed_check)."
};
const STANDING_THRESHOLD_TABLE = [
    'standing >= 1  iff  outcome != "crash"',
    'standing >= 2  iff  quality != "failing"',
    "standing >= 3  iff  clean(line)",
    'standing  = 4  iff  clean(line) and every rubric.annex.reserve_checks member reads "pass" on every applicable instance (an "na" or zero-instance member caps the ladder at 3)',
    "standing := the greatest rung whose threshold holds (reserved:4 > clean:3 > caution:2 > failing:1 > crash:0)"
];
const ANALYSIS_DEFERRED_D45 = ["commitment", "k_refuted", "k_admissible", "escape_status", "filter_effective", "brake_reserve_escape"];
// ---------------------------------------------------------------------------
// Envelope narration
function narrateLine(entry, gate, envelope) {
    if (isLineRefusal(entry)) {
        return { line_id: entry.line_id, refused: true, headline: `refused: ${entry.error.code} — ${entry.error.message}` };
    }
    const line = entry;
    const v = line.verdict;
    const checks = v.doctrine.checks.map((c) => ({ id: c.id, verdict: c.verdict, message: c.evidence.message }));
    let expectation;
    if (gate !== undefined && envelope !== undefined) {
        const report = gateFigure(envelope, gate);
        const row = report.lines.find((l) => l.line_id === line.line_id);
        if (row !== undefined)
            expectation = { met: row.met, misses: row.misses };
    }
    return {
        line_id: line.line_id,
        refused: false,
        headline: v.headline,
        diagnosis: v.diagnosis,
        checks,
        ...(expectation !== undefined ? { expectation } : {})
    };
}
function narrateEnvelope(envelope, opts) {
    const lines = opts?.line !== undefined
        ? envelope.lines.filter((l) => (isLineRefusal(l) ? l.line_id : l.line_id) === opts.line)
        : envelope.lines;
    return {
        kind: "envelope",
        figure_id: envelope.figure_id,
        lines: lines.map((l) => narrateLine(l, opts?.gate, envelope))
    };
}
// ---------------------------------------------------------------------------
// explain — pure, exported (ARCHITECTURE §5)
export function explain(input, opts) {
    if (isEnvelopeShaped(input)) {
        return { ok: true, value: narrateEnvelope(input, opts) };
    }
    if (typeof input !== "string") {
        return {
            ok: false,
            error: {
                code: "SCHEMA",
                at: "explain",
                message: "explain input must be an envelope object, a check id, an error code, or a mistake kind",
                detail: { reason: "explain_target_unrecognized" }
            }
        };
    }
    const target = input;
    // (2a) check ids
    if (CHECK_IDS.includes(target)) {
        const packR = loadShippedRubricPack(CONFIG_RUBRIC_DEFAULT);
        const row = packR.ok ? packR.value.checks.find((c) => c.id === target) : undefined;
        return {
            ok: true,
            value: {
                kind: "check",
                id: target,
                message: row?.teaches ?? target,
                teaches: row?.teaches ?? "",
                book_ref: row?.book_ref ?? "",
                scope: row?.scope ?? "",
                severity: row?.severity ?? ""
            }
        };
    }
    // (2b) error codes
    if (ERROR_CODES.includes(target)) {
        const code = target;
        return { ok: true, value: { kind: "error_code", code, message: ERROR_CODE_MESSAGES[code] } };
    }
    // (2c) mistake kinds
    if (MISTAKE_KINDS.includes(target)) {
        const kind = target;
        const def = MISTAKE_KIND_DEFS[kind];
        const pinRow = MISTAKE_PIN_TABLE.find((r) => r.kind === kind && r.scope === undefined);
        return {
            ok: true,
            value: {
                kind: "mistake_kind",
                mistake_kind: kind,
                message: `${def.book_mapping} — ${def.perturbation}`,
                params: def.params,
                admissible_outcomes: pinRow?.admissible_outcomes ?? [],
                book_figure: def.book_mapping
            }
        };
    }
    // (3) analysis vocabulary (D42-D45) — additions, checked before tombstones
    if (target in ANALYSIS_SHIPPED) {
        return { ok: true, value: { kind: "analysis", target, message: ANALYSIS_SHIPPED[target] } };
    }
    if (target in STANDING_TARGETS) {
        // A-LADDER-PROSE: a surface printing a standing token also prints the
        // pack id, the checks_version, the rung-token gloss, and the placard.
        const packR = loadShippedRubricPack(CONFIG_RUBRIC_DEFAULT);
        if (!packR.ok)
            return { ok: false, error: packR.error };
        const pack = packR.value;
        return {
            ok: true,
            value: {
                kind: "analysis",
                target,
                message: STANDING_TARGETS[target],
                standing: {
                    rungs: STANDING_RUNGS,
                    thresholds: STANDING_THRESHOLD_TABLE,
                    gloss: STANDING_GLOSS,
                    rubric: rubricString(pack),
                    checks_version: pack.requires_checks_version,
                    reserve_checks: pack.annex.reserve_checks,
                    placard: standingPlacard(rubricString(pack), pack.requires_checks_version)
                }
            }
        };
    }
    if (target in SAVE_WINDOW_TARGETS) {
        // A-SAVEWIN-PLACARD: a surface printing a save-window scalar also prints
        // the §4b.7 placard. The five status sentences and the placard both come
        // from solve/saveWindow.ts — one source, three surfaces.
        return {
            ok: true,
            value: {
                kind: "analysis",
                target,
                message: SAVE_WINDOW_TARGETS[target],
                save_window: {
                    statuses: SAVE_WINDOW_STATUSES,
                    sentences: SAVE_WINDOW_STATUS_SENTENCES,
                    display_dp: HORIZON_DISPLAY_DP,
                    placard: SAVE_WINDOW_PLACARD
                }
            }
        };
    }
    if (ANALYSIS_DEFERRED_D45.includes(target) || COUNTERFACTUAL_RIDERS.includes(target)) {
        return { ok: false, error: deferredError("explain", target, "continuation envelope (D45)") };
    }
    // (4) tombstones — UNKNOWN_ID, never deferred
    const tomb = tombstoneFor(target);
    if (tomb !== undefined) {
        return { ok: false, error: tombstoneError("explain", tomb) };
    }
    // (5) SCHEMA — list all three disambiguation vocabularies
    return {
        ok: false,
        error: {
            code: "SCHEMA",
            at: "explain",
            message: `"${target}" matches no check id, error code, or mistake kind (known checks: ${CHECK_IDS.join(", ")}; known error codes: ${ERROR_CODES.join(", ")}; known mistake kinds: ${MISTAKE_KINDS.join(", ")})`,
            detail: { reason: "explain_target_unknown" }
        }
    };
}
//# sourceMappingURL=explain.js.map