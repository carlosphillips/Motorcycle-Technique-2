// solve/gate.ts — gateFigure(envelope) → GateReport (design/08 §3.4, D33;
// ARCHITECTURE §5, WP-12): expectation-based gating. Every line is evaluated
// against its OWN expectation E(line), in BOTH directions — a mistake that
// accidentally solves clean gates exactly as a good line that stops being
// clean does. E(line) derives entirely from the line's spec (all inputs, all
// in the envelope's sources, no new computed state), through the five rules in
// order:
//
//   1. explicit `expect` declaration (FigureSpec-level, JSON-only, D30) —
//      E is as declared. Declarations ride gateFigure's options: the envelope
//      never carries them (they are spec metadata, 05 §8.1 — in spec_hash,
//      outside the result).
//   2. source.kind = "mistake" (and "misjudge" with a sugar kind) → E.outcome
//      = the kind's admissible outcome set from THE pin table
//      (plan/mistakes.ts — the pin table IS its declaration; no redundant
//      expect_fail); E.checks_fail = the kind's taught check(s).
//   3. accept = "best_failing" → E = any non-`good` result; the line exists
//      to fail (quality `good` is itself unexpected).
//   4. chained or vis=cautious solve → E.outcome = contained with the
//      chain-aware applicable check set passing (quality `good`).
//   5. default (single-corner solve, explicit plan) → E.outcome = contained;
//      all applicable checks pass except the scenario's expect_fail entries,
//      which MUST fail (the bidirectional rule: failed set == declared set).
//
// Roles appear NOWHERE here (D9) — sources and declared expectations drive
// the gate. Refusals participate: a LineRefusal is an unmet expectation
// (05 §7: "the refusal participates in the expectation-gating law"), and
// figure-level skew tier "story" is the version-skew gate arm (05 §8.4,
// exits 3 under run --gate; the exit-tier mapping itself is cli/'s, 08 §3.1).
import { MISTAKE_PIN_TABLE } from "../plan/mistakes.js";
import { isLineRefusal } from "./envelope.js";
// ---------------------------------------------------------------------------
// Pin-table row selection (rule 2): rows are keyed (kind, scope-class) — the
// `premature @all` chained row is distinct from the base row; a corner-list
// scope reads the base row (the chained row's admissible set is the same
// data-shaped answer either way).
function pinRowFor(kind, scope) {
    const wantChained = scope === "all_corners";
    let base = null;
    for (const row of MISTAKE_PIN_TABLE) {
        if (row.kind !== kind)
            continue;
        if (wantChained && row.scope === "all_corners")
            return row;
        if (row.scope === undefined)
            base = row;
    }
    return base;
}
// ---------------------------------------------------------------------------
// E(line) derivation (the five rules, first match wins)
function deriveExpectation(entry, envelope, declared) {
    // rule 1 — explicit declaration
    if (declared !== undefined) {
        return {
            source: "explicit_expect",
            outcome: declared.outcome ?? null,
            checks_fail: declared.checks_fail ?? [],
            require_quality_good: false,
            require_non_good: false
        };
    }
    if (isLineRefusal(entry)) {
        // a refusal has no source to derive from — the default expectation stands
        // (and is unmet by construction: no outcome was observed)
        return {
            source: "default",
            outcome: ["contained"],
            checks_fail: [],
            require_quality_good: true,
            require_non_good: false
        };
    }
    const line = entry;
    const source = line.source;
    // rule 2 — mistake-sourced lines (incl. misjudge sugar kinds): the pin table
    // is the declaration
    const mistakeKind = source.kind === "mistake"
        ? { kind: source.mistakeSpec.kind, scope: source.mistakeSpec.scope }
        : source.kind === "misjudge" && source.sugar !== null
            ? { kind: source.sugar.kind, scope: undefined }
            : null;
    if (mistakeKind !== null) {
        const row = pinRowFor(mistakeKind.kind, mistakeKind.scope);
        if (row !== null) {
            const taught = row.expect_fail === undefined || row.expect_fail === "applicable_check_fails" ? [] : row.expect_fail;
            return {
                source: "mistake_pin",
                outcome: row.admissible_outcomes,
                checks_fail: taught,
                require_quality_good: false,
                require_non_good: row.expect_fail === "applicable_check_fails"
            };
        }
    }
    // rule 3 — accept=best_failing: the line exists to fail
    if (source.kind === "solve" && source.solveSpec.accept === "best_failing") {
        return {
            source: "best_failing",
            outcome: null,
            checks_fail: [],
            require_quality_good: false,
            require_non_good: true
        };
    }
    // rule 4 — chained or vis=cautious solve
    if (source.kind === "solve") {
        const spec = source.solveSpec;
        const chained = spec.corner?.includes("..") === true ||
            (spec.corner === undefined && envelope.road.corners.length > 1);
        if (spec.vis === "cautious" || chained) {
            return {
                source: "chained_vis",
                outcome: ["contained"],
                checks_fail: [],
                require_quality_good: true,
                require_non_good: false
            };
        }
    }
    // rule 5 — default: contained + the bidirectional expect_fail rule
    const expectFail = !isLineRefusal(entry) ? (line.resolved_scenario.expect_fail ?? []) : [];
    return {
        source: "default",
        outcome: ["contained"],
        checks_fail: expectFail,
        require_quality_good: expectFail.length === 0,
        require_non_good: false
    };
}
// ---------------------------------------------------------------------------
// Observation + met evaluation (both directions)
/** unique check ids with ≥ 1 `fail` instance in the line's doctrine block. */
function failedCheckIds(verdict) {
    const out = new Set();
    for (const c of verdict.doctrine.checks) {
        if (c.verdict === "fail")
            out.add(c.id);
    }
    return [...out].sort();
}
function evaluateLine(entry, expectation) {
    if (isLineRefusal(entry)) {
        return {
            line_id: entry.line_id,
            refused: true,
            expectation,
            observed: null,
            met: false,
            misses: [`line was refused (${entry.error.code}) — no observation to meet the expectation`]
        };
    }
    const line = entry;
    const v = line.verdict;
    const failed = failedCheckIds(v);
    const failedSet = new Set(failed);
    const misses = [];
    if (expectation.outcome !== null && !expectation.outcome.includes(v.outcome)) {
        misses.push(`outcome "${v.outcome}" outside the expected set {${expectation.outcome.join(", ")}}`);
    }
    for (const id of expectation.checks_fail) {
        if (!failedSet.has(id)) {
            misses.push(`expected check "${id}" to fail — it did not (the bidirectional rule)`);
        }
    }
    // undeclared failures gate only where the expectation claims the full
    // applicable set: rules 4/5 (require_quality_good) and rule 5 with declared
    // expect_fail (exact-set semantics); mistake rows are superset-only.
    if (expectation.source === "default" && expectation.checks_fail.length > 0) {
        const declared = new Set(expectation.checks_fail);
        for (const id of failed) {
            if (!declared.has(id)) {
                misses.push(`check "${id}" failed without being declared in expect_fail (the bidirectional rule)`);
            }
        }
    }
    if (expectation.require_quality_good && v.quality !== "good") {
        misses.push(`quality "${v.quality}" — the expectation requires "good" over the applicable set`);
    }
    if (expectation.require_non_good && v.quality === "good") {
        misses.push('quality "good" is itself unexpected for this line (it exists to fail)');
    }
    return {
        line_id: line.line_id,
        refused: false,
        expectation,
        observed: { outcome: v.outcome, quality: v.quality, failed_checks: failed },
        met: misses.length === 0,
        misses
    };
}
// ---------------------------------------------------------------------------
// gateFigure (ARCHITECTURE §5) — pure, total, recomputable by any consumer
// (08 §3.4's output discipline: no CLI-only enrichment).
export function gateFigure(envelope, opts) {
    const lines = envelope.lines.map((entry) => {
        const declared = opts?.expect?.[entry.line_id];
        const expectation = deriveExpectation(entry, envelope, declared);
        return evaluateLine(entry, expectation);
    });
    const skew_story = envelope.skew !== null && envelope.skew.tier === "story";
    return {
        figure_id: envelope.figure_id,
        lines,
        skew_story,
        pass: lines.every((l) => l.met) && !skew_story
    };
}
//# sourceMappingURL=gate.js.map