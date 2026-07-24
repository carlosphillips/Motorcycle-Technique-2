// solve/merge.ts — the authored-plan merge contract (design/04 §4.9;
// ARCHITECTURE §5). When an authored plan fragment rides alongside solver
// delegation, NOTHING is ever silently dropped:
//
//   - an authored numeric brake decel PINS the decel control (bisection
//     skipped; taper placement per brake_gap unchanged);
//   - an authored throttle with an onset station PINS the roll-on control; a
//     bare magnitude pins only the magnitude, onset still bisected;
//   - authored `position` actions are carried VERBATIM into every candidate
//     plan (coarse sweep, both bisections, self-verify);
//   - an authored explicit turn-in station fixes placement;
//   - an authored action the solver cannot honour on any candidate is a typed
//     NO_SOLUTION / authored_action_conflict naming the action id (raised by
//     the pipeline, solve.ts, when every candidate's validate() rejects on it);
//   - a fully explicit plan plus a solver-only field with nothing left to
//     search rejects the dead input: INEFFECTUAL (constraint_without_solver).
//
// The wire spelling of the authored fragment is the plan/types.ts PlanAction
// array; solve-spec plumbing of the fragment (`plan` beside the SolveSpec
// fields) is a WP-10 authority call recorded in plan/types.ts's own header
// ("solve/ is the authority on any field this misses").
import { err, ok } from "../core/result.js";
const EMPTY = {
    decel: { kind: "bisect" },
    roll_on: { kind: "bisect" },
    turn_in: { kind: "auto" },
    positions: [],
    cracks: [],
    nothing_to_search: false
};
function schemaErr(at, message, reason, detail) {
    return { code: "SCHEMA", at, message, detail: { reason, ...detail } };
}
function hasOnset(a) {
    return a.at_s !== undefined || a.at !== undefined;
}
/**
 * Fold an authored plan fragment into merge directives (§4.9). Pure shape
 * analysis — honourability against the road (station reachability, overlap
 * with the searched turn-in) is decided later by validate() on real candidate
 * plans; the pipeline maps a fragment that fails on EVERY candidate to
 * NO_SOLUTION/authored_action_conflict.
 */
export function mergeAuthoredPlan(authored, at = "plan") {
    if (authored === undefined || authored.length === 0)
        return ok(EMPTY);
    let decel = { kind: "bisect" };
    let roll_on = { kind: "bisect" };
    let turn_in = { kind: "auto" };
    const positions = [];
    const cracks = [];
    for (let i = 0; i < authored.length; i++) {
        const action = authored[i];
        const here = `${at}[${i}]`;
        switch (action.do) {
            case "brake": {
                if (decel.kind === "pinned") {
                    return err(noSolutionConflict(here, action.id, "a second authored brake leaves no decel control to search"));
                }
                decel = { kind: "pinned", value: action.decel, action };
                break;
            }
            case "throttle": {
                if (action.accel === 0) {
                    if (!hasOnset(action)) {
                        return err(schemaErr(here, `authored crack "${action.id}" needs an onset station`, "authored_crack_needs_station", { id: action.id }));
                    }
                    cracks.push(action);
                    break;
                }
                if (hasOnset(action)) {
                    if (roll_on.kind !== "bisect") {
                        return err(noSolutionConflict(here, action.id, "a second authored drive throttle leaves no roll-on control to search"));
                    }
                    roll_on = { kind: "pinned", action };
                }
                else {
                    if (roll_on.kind !== "bisect") {
                        return err(noSolutionConflict(here, action.id, "a second authored drive throttle leaves no roll-on control to search"));
                    }
                    roll_on = { kind: "magnitude", accel: action.accel, action };
                }
                break;
            }
            case "turn_in": {
                if (!hasOnset(action)) {
                    return err(schemaErr(here, `authored turn_in "${action.id}" needs a station (use turnIn=auto for delegation)`, "authored_turn_in_needs_station", { id: action.id }));
                }
                if (turn_in.kind === "pinned") {
                    return err(noSolutionConflict(here, action.id, "two authored turn-ins on a single-corner solve"));
                }
                turn_in = { kind: "pinned", action };
                break;
            }
            case "position": {
                positions.push(action);
                break;
            }
        }
    }
    const nothing_to_search = decel.kind === "pinned" && roll_on.kind === "pinned" && turn_in.kind === "pinned";
    return ok({ decel, roll_on, turn_in, positions, cracks, nothing_to_search });
}
/** NO_SOLUTION/authored_action_conflict (§4.9/§4.10) naming the action id. */
export function noSolutionConflict(at, action_id, why) {
    return {
        code: "NO_SOLUTION",
        at,
        message: `authored action "${action_id}" cannot be honoured: ${why}`,
        detail: { sub_reason: "authored_action_conflict", action_id, why }
    };
}
/** INEFFECTUAL/constraint_without_solver (§4.9): a bound on a fully pinned plan. */
export function constraintWithoutSolver(at) {
    return {
        code: "INEFFECTUAL",
        at,
        message: "constraints on a fully explicit plan have no solver search to narrow",
        detail: { reason: "constraint_without_solver" }
    };
}
//# sourceMappingURL=merge.js.map