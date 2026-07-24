// solve/verdict.ts — verdict assembly (design/05 §6; ARCHITECTURE §5
// `assembleVerdict`). Composes what the record already knows into the one
// doctrinal judgment of a line:
//
//   - `outcome` from PHYSICS ALONE (05 §6.1, P-OUTCOME-RUBRIC-FREE): the
//     trajectory's termination + the run_wide_detect record + the corrective
//     shot's feasibility. It never reads a doctrine check.
//   - `clean`/`quality` via plan/doctrine (IMPORTED — drift risk #3: the one
//     colour law lives in plan/doctrine/quality.ts; this file never re-derives).
//   - `corners[]` by merging core/analyze's rows (the ONE apex detector's
//     output, drift risk #4) with the events/plan-derived turn_in rows, the
//     ran-wide record, and the per-corner corrective blocks.
//   - the sight block (rider-path basis, D16), validity dwell (D17), and the
//     always-present acceptance block (D24).
//
// The returned verdict is UNSEALED: `result_hash` is "" until
// solve/envelope.ts's sealVerdict rounds it (solve/emit.ts) and stamps the
// hash — rounding is INSIDE the hash input (ARCHITECTURE §6.3).
import { err, ok } from "../core/result.js";
import { msToKmh } from "../core/units.js";
import { clean, quality } from "../plan/doctrine/quality.js";
import { rubricString } from "../plan/doctrine/pack.js";
import { ENGINE_ID } from "./types.js";
// ---------------------------------------------------------------------------
// The outcome law (design/05 §6.1 — physics only, precedence
// crash > runoff > wide > stopped > contained; one deterministic headline)
function detectEvents(traj) {
    return traj.events.filter((e) => e.kind === "run_wide_detect");
}
/** Last corner whose s0 ≤ s (the corrective.ts attribution rule), or null pre-first-corner. */
function attributeCorner(corners, s) {
    let match = null;
    for (const c of corners) {
        if (c.s0 <= s + 1e-12)
            match = c;
    }
    return match;
}
/**
 * `outcome` from physics alone (P-OUTCOME-RUBRIC-FREE — note the signature:
 * no doctrine input EXISTS, so no rubric pack can move it). Per-corner
 * contribution law verbatim from 04 §4a.6; headline = worst class under
 * 05 §6.1's precedence crash > runoff > wide > stopped > contained:
 *
 *   crash      the run terminated `crash` (grip or lean ceiling, deadbanded)
 *   runoff     an outward crossing (run_wide_detect) with no feasible
 *              corrective, OR terminated off_road in a corner with no outward
 *              detect (inside-side physical departure; corrective null). The
 *              second clause stays reachable when OTHER corners ran wide with
 *              feasible saves — e.g. the opposite-hand f-flip at a chain
 *              handoff — because runoff > wide.
 *   wide       every outward crossing has a feasible corrective returning it
 *              (the wide-vs-runoff split IS the corrective shot, 04 §4a.6)
 *   stopped    v fell below the floor before road end, none of the above
 *   contained  none of the above (road_end on the carriageway; the max_time/
 *              max_dist runaway guards also land here — the closed five-value
 *              set forces a value and the guard itself stays recorded in
 *              terminated.reason; recorded judgment PENDING RATIFICATION:
 *              05 §6.1's letter defines contained as "reached road end")
 *
 * A run_wide_detect event without a corner_id is believed-impossible input
 * (04 §4a.2 attributes every detect; 05 §5 pins "at most one per corner") and
 * mints a typed INTERNAL — never a silent fall-through to a recoverable class.
 */
export function physicsOutcome(traj, correctives, roadCorners) {
    if (traj.terminated.reason === "crash")
        return ok("crash");
    // ran_wide(corner) := a run_wide_detect event attributed to that corner
    // exists (04 §4a.6); a corrective block implies its detect.
    const ranWide = new Set();
    for (const d of detectEvents(traj)) {
        if (d.corner_id === undefined) {
            return err({
                code: "INTERNAL",
                at: "physicsOutcome",
                message: "run_wide_detect event carries no corner_id — 04 §4a.2 attributes every detect to a corner",
                detail: { reason: "detect_missing_corner_id" }
            });
        }
        ranWide.add(d.corner_id);
    }
    for (const c of correctives)
        ranWide.add(c.corner_id);
    // runoff, clause 1: an outward crossing whose corrective is missing or
    // infeasible (ran_wide ∧ ¬feasible → runoff).
    const byCorner = new Map(correctives.map((c) => [c.corner_id, c.block]));
    for (const cornerId of ranWide) {
        const block = byCorner.get(cornerId);
        if (block === undefined || !block.feasible)
            return ok("runoff");
    }
    // runoff, clause 2: terminated off_road ∧ ¬ran_wide(terminal corner) —
    // the inside-side physical departure (corrective null). Attribution = the
    // last corner whose s0 ≤ s (the corrective.ts rule); a pre-first-corner
    // departure is equally unrecovered. Checked BEFORE the wide arm so it stays
    // reachable when other corners ran wide with feasible saves (runoff > wide).
    if (traj.terminated.reason === "off_road") {
        const terminal = attributeCorner(roadCorners, traj.terminated.s);
        if (terminal === null || !ranWide.has(terminal.id))
            return ok("runoff");
    }
    if (ranWide.size > 0)
        return ok("wide");
    if (traj.terminated.reason === "stopped")
        return ok("stopped");
    return ok("contained");
}
// ---------------------------------------------------------------------------
// The headline — deterministic and NUMBER-FREE by design: a float rendered
// into a string would smuggle unrounded digits past the emission-rounding
// policy and into result_hash (recorded judgment; integers are safe).
function headlineFor(outcome, doctrine, runoffCornerId, wideCornerId) {
    switch (outcome) {
        case "crash":
            return "crash";
        case "runoff":
            return runoffCornerId !== null ? `ran off in ${runoffCornerId}` : "ran off the road";
        case "wide":
            return wideCornerId !== null
                ? `ran wide in ${wideCornerId} — recoverable within reserve`
                : "ran wide — recoverable within reserve";
        case "stopped":
            return "stopped before road end";
        case "contained":
            return doctrine.fail === 0
                ? "contained — clean"
                : `contained — ${doctrine.fail} check fail${doctrine.fail === 1 ? "" : "s"}`;
    }
}
// ---------------------------------------------------------------------------
// Verdict sub-block assembly
/** turn_in rows for one corner: events joined to the resolved plan by action_id. */
function turnInRows(traj, cornerId, plan) {
    const rows = [];
    for (const e of traj.events) {
        if (e.kind !== "turn_in" || e.corner_id !== cornerId)
            continue;
        const action = plan.find((a) => a.do === "turn_in" && a.id === e.action_id);
        const release = traj.events.find((r) => r.kind === "release" && r.action_id === e.action_id);
        rows.push({
            s: e.s,
            lean_commit_deg: action !== undefined && action.do === "turn_in" ? action.target.lean_deg : 0,
            hand: action !== undefined && action.do === "turn_in"
                ? action.hand
                : "R", // defensive only: a turn_in event always names a plan action
            release_s: release !== undefined ? release.s : null
        });
    }
    return rows;
}
/**
 * Total below-validity dwell (D17): the recorded per-sample flag is a step
 * function (`hold` interpolation family), so each bracket contributes its full
 * duration when its LEFT sample is flagged. Returns null when zero (05 §6.3).
 */
function validityDwell(samples) {
    let dwell = 0;
    for (let i = 0; i + 1 < samples.length; i++) {
        if (samples[i].below_validity)
            dwell += samples[i + 1].t - samples[i].t;
    }
    return dwell > 0 ? { below_validity_s: dwell } : null;
}
/** The sight block (rider-path basis, D16): the worst sight_ride_m − ssd_m sample. */
function sightBlock(samples, holds) {
    if (samples.length === 0)
        return null;
    let bestI = 0;
    let bestMargin = Number.POSITIVE_INFINITY;
    for (let i = 0; i < samples.length; i++) {
        const margin = samples[i].sight_ride_m - samples[i].ssd_m;
        if (margin < bestMargin) {
            bestMargin = margin;
            bestI = i;
        }
    }
    const at = samples[bestI];
    return {
        margin_min_m: bestMargin,
        at_s: at.s,
        v_at_s_kmh: msToKmh(at.v),
        holds
    };
}
// ---------------------------------------------------------------------------
// assembleVerdict — the one assembly (ARCHITECTURE §5). Returns Result: the
// only refusal arm is physicsOutcome's believed-impossible INTERNAL.
export function assembleVerdict(input) {
    const traj = input.trajectory;
    const correctives = input.correctives ?? [];
    const byCorner = new Map(correctives.map((c) => [c.corner_id, c.block]));
    const outcomeR = physicsOutcome(traj, correctives, input.road_corners);
    if (!outcomeR.ok)
        return outcomeR;
    const outcome = outcomeR.value;
    const isClean = clean(outcome, input.doctrine);
    const q = quality(outcome, input.doctrine, input.pack);
    const ranWideCorners = new Set();
    for (const e of detectEvents(traj)) {
        if (e.corner_id !== undefined)
            ranWideCorners.add(e.corner_id);
    }
    for (const c of correctives)
        ranWideCorners.add(c.corner_id);
    const crashCorner = traj.terminated.reason === "crash"
        ? attributeCorner(input.road_corners, traj.terminated.s)
        : null;
    const corners = input.corner_rows.map((row) => {
        const corrective = byCorner.get(row.id) ?? null;
        const crashed = crashCorner !== null && crashCorner.id === row.id;
        const base = {
            id: row.id,
            hand: row.hand,
            corner_type: row.corner_type,
            turn_ins: turnInRows(traj, row.id, input.resolved_plan),
            apexes: row.apexes,
            lean_max_deg: row.lean_max_deg,
            grip_min: row.grip_min,
            danger_dwell_s: row.danger_dwell_s,
            exit: row.exit,
            ran_wide: ranWideCorners.has(row.id),
            corrective
        };
        return crashed ? { ...base, crash: true } : base;
    });
    // runoff headline attribution: the first ran-wide corner without a feasible
    // save (clause 1), else — clause-2 runoff, where no ran-wide corner is
    // infeasible — the corner containing the terminal off_road departure itself.
    const firstRunoff = outcome === "runoff"
        ? corners.find((c) => c.ran_wide && (c.corrective === null || !c.corrective.feasible))
        : undefined;
    const runoffCornerId = outcome !== "runoff"
        ? null
        : firstRunoff?.id ??
            (traj.terminated.reason === "off_road"
                ? attributeCorner(input.road_corners, traj.terminated.s)?.id ?? null
                : null);
    const firstWide = outcome === "wide"
        ? corners.find((c) => c.ran_wide && c.corrective !== null && c.corrective.feasible)
        : undefined;
    const acceptance = {
        policy: input.acceptance_policy ?? "clean",
        met: isClean
    };
    return ok({
        ok: isClean,
        spec_hash: input.spec_hash,
        result_hash: "", // unsealed — envelope.ts's sealVerdict rounds + stamps
        checks_version: 2,
        rubric: rubricString(input.pack),
        engine: ENGINE_ID,
        outcome,
        quality: q,
        headline: headlineFor(outcome, input.doctrine, runoffCornerId, firstWide?.id ?? null),
        diagnosis: input.diagnosis ?? null,
        acceptance,
        misjudgment: input.misjudgment ?? null,
        validity: validityDwell(traj.samples),
        corners,
        sight: sightBlock(traj.samples, input.holds ?? []),
        constraints: input.constraints ?? null,
        doctrine: input.doctrine
    });
}
//# sourceMappingURL=verdict.js.map