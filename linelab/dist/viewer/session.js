// viewer/session.ts — the RECOMPUTE-IN-VIEWER rule (design/07 §2.1), which is
// D1's whole substance on this side of the seam:
//
//   1. the viewer receives a scenario + line specs — never a shipped trajectory;
//   2. the viewer runs THE engine itself, at load time, to produce the envelope;
//   3. scrubbing/playback reads the finished result; nothing re-integrates.
//
// Step 2 is one call to `solve/run.ts`'s `run(input)` — the SAME function
// `linelab run` calls, imported from the same module (07 §2.1: "there is no
// bundled 'viewer build' of the physics that could drift"). This file adds no
// physics; its whole job is to hold the recomputed envelope and to marshal one
// of its lines into the `StateAtInput` the HUD queries.
import { ok, err } from "../core/result.js";
import { sightTrendAt } from "../sight/analyze.js";
import { run } from "../solve/run.js";
import { isLineRefusal } from "../solve/envelope.js";
/**
 * `loadSession(spec)` — step 2 of the recompute rule. `spec` is the SPEC
 * document (a FigureSpec, a wire Scenario, or a composed solver input), never
 * an envelope: `run`'s own content sniff (08 §3) decides which, so the viewer
 * inherits the CLI's front door verbatim.
 */
export function loadSession(spec, opts) {
    const ran = run(spec, opts?.engine_semver !== undefined ? { engine_semver: opts.engine_semver } : undefined);
    if (!ran.ok)
        return ran;
    return sessionOf(ran.value);
}
/** Build the view-state wrapper around an already-recomputed envelope. */
export function sessionOf(figure) {
    const road = figure.road;
    if (typeof road.dsl !== "string" || typeof road.worldAt !== "function") {
        // believed impossible: `run` composes before it integrates (solve/run.ts)
        return err({
            code: "INTERNAL",
            at: "figure.road",
            message: "the envelope's road is not a composed road — the viewer cannot draw it",
            detail: { reason: "road_not_composed" }
        });
    }
    const entries = figure.lines;
    const lines = entries.filter((l) => !isLineRefusal(l));
    const refusals = entries.filter((l) => isLineRefusal(l));
    // 07 §4.2: one line holds focus. Declaration order is draw order (05 §7), so
    // the first drawable line is the natural focus; an all-refusal envelope
    // focuses its first entry so the legend still names something.
    const focus = lines[0]?.line_id ?? entries[0]?.line_id ?? "";
    return ok(Object.freeze({ figure, road, lines, refusals, focus }));
}
/** Focus switch (07 §4.2: click a glyph/legend entry, or Tab-cycle). */
export function withFocus(session, lineId) {
    return Object.freeze({ ...session, focus: lineId });
}
export function lineOf(session, lineId) {
    return session.lines.find((l) => l.line_id === lineId) ?? null;
}
export function focusedLine(session) {
    return lineOf(session, session.focus);
}
/**
 * The `StateAtInput` for one line — the exact four members `core/stateAt.ts`'s
 * dependency-inversion banner names, assembled the exact same way the `state`
 * verb assembles them (`cli/verbs/state.ts`). One assembly rule, two callers;
 * that identity is what makes `C-HUD-EQUALS-STATEAT` a tautology rather than a
 * coincidence.
 */
export function stateInputFor(session, line) {
    return {
        trajectory: line.trajectory,
        road: session.road,
        plan: line.resolved_scenario.rider.plan,
        sightTrendAt
    };
}
//# sourceMappingURL=session.js.map