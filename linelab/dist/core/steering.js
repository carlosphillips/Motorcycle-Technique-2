// core/steering.ts — the four-state steering channel (design/02 §3.1, D13):
// track | commit | unwind | position, the heading-capture release predicate,
// the bounded critically-damped lateral tracker (D20), the unwind, and the
// turn-in supersession/suspension rules. Exactly ONE owner per control step
// (REQ-STEER-OWNERSHIP); never a blended output, never a step with no lateral
// law in force.
import { G, V_MIN_RHS, OMEGA_POS, PHI_TRACK_AUTH_DEG, a_lat_pos_max, EPS_POS_M, EPS_POS_RATE, EPS_UNWIND_DONE_DEG } from "./constants.js";
import { handSign, degToRad } from "./units.js";
/** wrapToPi: normalize an angle to (−π, π]. Shared with the post-hoc exit-event analyzer. */
export function wrapToPi(a) {
    let x = a % (2 * Math.PI);
    if (x <= -Math.PI)
        x += 2 * Math.PI;
    else if (x > Math.PI)
        x -= 2 * Math.PI;
    return x;
}
/**
 * The turn-in's governing corner (02 §3.1, recorded binding re-derived
 * deterministically): the corner with the smallest s1 > at_s whose hand equals
 * the action's (resolved) hand. `undefined` when no such corner exists — the
 * engine then holds the commitment with no release (a validated scenario can
 * never reach this: BAD_RANGE/no_governing_corner at validation; analytic
 * straight-road fixtures use it deliberately to pin a held lean).
 */
export function governingCornerFor(corners, at_s, hand) {
    let best;
    for (const c of corners) {
        if (c.s1 > at_s && c.hand === hand && (best === undefined || c.s1 < best.s1)) {
            best = c;
        }
    }
    return best;
}
/**
 * The heading-capture release predicate (02 §3.1):
 *
 *   psi_exit(c)  = road heading at c.s1
 *   dpsi_rem     = handSign(c.hand) · (psi_exit(c) − psi)
 *   t_unwind     = |phi| / roll_rate
 *   v_eff        = max(V_MIN_RHS, v + 0.5·a_clip·t_unwind)
 *   dpsi_unwind  = (G / (v_eff·roll_rate)) · ln(1/cos|phi|)
 *   RELEASE  ⇔  dpsi_rem ≤ dpsi_unwind
 *
 * `a_clip` is the most recent COMPLETED step's clip (ARCHITECTURE §10.11);
 * `roll_rate` is the effective rate in rad/s. dpsi_rem ≤ 0 (over-rotated)
 * releases immediately.
 *
 * dpsi_rem note (recorded deviation): 02 spells
 * `handSign·wrapToPi(psi_exit − psi)`, but both `psi` and `psi_road` are
 * CONTINUOUS (never wrapped) in this engine, so the plain difference IS the
 * remaining road heading — and wrapping it would fold any remaining sweep
 * > 180° to a negative number, releasing a 270° commitment at its first step
 * and making the normative analytic fixture F-AN-CIRCLE (R 30 ^270, steady
 * 30 m circle through the arc — 09 §3.2a) unsatisfiable. On every sweep
 * < 180° the two spellings agree exactly.
 */
export function releaseFires(corner, road, psi, phi, v, prev_a_clip, roll_rate) {
    const psi_exit = road.psi_road(corner.s1);
    const dpsi_rem = handSign(corner.hand) * (psi_exit - psi);
    const absPhi = Math.abs(phi);
    const t_unwind = absPhi / roll_rate;
    const v_eff = Math.max(V_MIN_RHS, v + 0.5 * prev_a_clip * t_unwind);
    const dpsi_unwind = (G / (v_eff * roll_rate)) * Math.log(1 / Math.cos(absPhi));
    return dpsi_rem <= dpsi_unwind;
}
/**
 * Lateral closure rate in the PINNED frame (recorded deviation, load-bearing):
 * 02 §3.1 spells `d_dot = v·sin(psi − psi_road(s))` — the standard Frenet
 * formula for a frame where the road normal (positive d) points TOWARD the
 * turn centre. Under this project's pinned frame (ARCHITECTURE §6.1: y down,
 * d positive to the rider's LEFT, left normal (sin ψr, −cos ψr)), the closure
 * rate is
 *
 *   d_dot = v_vec · N_left = −v·sin(psi − psi_road(s))
 *
 * Implementing the doc's spelling verbatim flips the sign of the damping term,
 * turning the ζ = 1 critically-damped tracker into an anti-damped oscillator —
 * the position channel then never satisfies its own completion law and the
 * binding §5.4.6 invariants fail. The invariants are the specification
 * (02 §5.4 header); the formula's sign is corrected to the pinned frame.
 */
export function dDotOf(road, s, psi, v) {
    return -v * Math.sin(psi - road.psi_road(s));
}
/**
 * The tracker law (02 §3.1; `track` and `position` share it):
 *
 *   d_tgt       = dOf(f_target)
 *   e           = d_tgt − d
 *   d_dot       = lateral closure rate (see dDotOf — pinned-frame sign)
 *   a_track     = clamp(OMEGA_POS²·e − 2·OMEGA_POS·d_dot, ±a_lat_pos_max)   (ζ = 1)
 *   kappa_ff    = kappa_road(s) / (1 + d·kappa_road(s))
 *   target_lean = clamp(atan((v²·kappa_ff + a_track_d)/G), ±PHI_TRACK_AUTH)
 *
 * Frame notes (recorded deviations, same root cause as dDotOf):
 * - the feedforward that holds the d-offset line has radius R + d in the
 *   pinned d-positive-LEFT frame (verified against road/compose's own arc
 *   geometry), so kappa_ff = κ/(1 + d·κ); 02's `1 − d·κ` presumes d toward
 *   the centre;
 * - a_track is a demand along +d (leftward); the lean that produces a leftward
 *   lateral acceleration is NEGATIVE phi (+phi = right lean = +kappa = rightward
 *   centripetal demand), so the tracker's e/d_dot demand enters with sign
 *   flipped when converted to a lean target.
 * (v²·kappa_cmd = v²·kappa_ff + a_track exactly — computed in that form so the
 * law is total at v → 0.) The 5° authority cap is the D7 guard: cornering is
 * possible only through a committed turn_in.
 */
export function trackerTargetLean(f_target, road, s, d, psi, v) {
    const d_tgt = road.dOf(f_target, s);
    const e = d_tgt - d;
    const d_dot = dDotOf(road, s, psi, v);
    const a_track_raw = OMEGA_POS * OMEGA_POS * e - 2 * OMEGA_POS * d_dot;
    const a_track = Math.min(Math.max(a_track_raw, -a_lat_pos_max), a_lat_pos_max);
    const kap = road.kappa_road(s);
    const den = 1 + d * kap;
    const kappa_ff = den !== 0 ? kap / den : kap / (den >= 0 ? 1e-9 : -1e-9);
    const auth = degToRad(PHI_TRACK_AUTH_DEG);
    // +a_track (leftward, +d) requires a LEFT lean = negative phi: subtract.
    const target = Math.atan((v * v * kappa_ff - a_track) / G);
    return Math.min(Math.max(target, -auth), auth);
}
export function initialMachine(f_start) {
    return { kind: "track", f_hold: f_start, hold_action_id: null };
}
/**
 * One ZOH control-step evaluation of the steering channel (02 §3.1).
 * `activations` are the turn_in/position actions whose at_s was crossed by
 * this step, in at_s order; `roll_rate` in rad/s; `prev_a_clip` per
 * ARCHITECTURE §10.11.
 */
export function stepSteering(machine, activations, input, road, roll_rate, prev_a_clip) {
    const events = [];
    let m = machine;
    // --- activation transitions (transition table rows for at_s triggers) -----
    for (const act of activations) {
        if (act.action.do === "turn_in") {
            // supersede from ANY state: track/unwind → commit; commit → commit (the
            // esses flip); position → commit per ownership precedence (2) > (3).
            // Recorded deviation: 02 §3.1's transition table claims completeness
            // ("anything not listed cannot occur") yet has NO position→commit row,
            // while REQ-STEER-OWNERSHIP's precedence — an unreleased commitment (2)
            // outranks a position (3) — requires a turn_in reaching its at_s to take
            // the channel from an active position window. Precedence wins here; the
            // table needs the position→commit row added by design amendment.
            const corner = governingCornerFor(road.corners, act.action.at_s, act.action.hand) ?? null;
            m = { kind: "commit", action: act.action, corner, steered: false };
            events.push({
                kind: "turn_in",
                s: act.s_cross,
                t: act.t_cross,
                ...(corner !== null ? { corner_id: corner.id } : {}),
                action_id: act.action.id
            });
        }
        else {
            // position: legal from track/unwind, and from commit ONLY when the
            // governing corner's s1 has already passed (a stale commitment yields).
            // An unreleased pre-s1 commitment keeps the channel (precedence 2) — a
            // validated scenario can never reach that arm (03 §6.1 static-window
            // rejection), so the activation is consumed with no effect. A null-corner
            // commitment is held with no release (governingCornerFor's contract), so
            // it never goes stale and never yields either.
            const yields = m.kind !== "commit" || (m.corner !== null && input.s >= m.corner.s1 - 1e-9);
            if (!yields)
                continue;
            const target_f = act.action.f ?? (act.action.d !== undefined ? road.fOf(act.action.d, act.action.at_s) : 0);
            m = { kind: "position", action: act.action, target_f, shortfall_emitted: false };
            events.push({
                kind: "position_start",
                s: act.s_cross,
                t: act.t_cross,
                action_id: act.action.id
            });
        }
    }
    // --- internal transitions (release / unwind-done / position completion) ---
    // Cascade at most a few times: e.g. a release into an already-upright bike
    // hands to track in the same step.
    const epsUnwind = degToRad(EPS_UNWIND_DONE_DEG);
    for (let guard = 0; guard < 3; guard++) {
        if (m.kind === "commit" && m.corner !== null) {
            if (releaseFires(m.corner, road, input.psi, input.phi, input.v, prev_a_clip, roll_rate)) {
                events.push({
                    kind: "release",
                    s: input.s,
                    t: input.t,
                    corner_id: m.corner.id,
                    action_id: m.action.id
                });
                m = { kind: "unwind", corner_id: m.corner.id, released_action_id: m.action.id };
                continue;
            }
        }
        else if (m.kind === "unwind") {
            if (Math.abs(input.phi) <= epsUnwind) {
                // handoff: f_hold := the f-snapshot (no snap-back)
                m = { kind: "track", f_hold: input.f, hold_action_id: null };
                continue;
            }
        }
        else if (m.kind === "position") {
            const d_tgt = road.dOf(m.target_f, input.s);
            const e = d_tgt - input.d;
            const d_dot = dDotOf(road, input.s, input.psi, input.v);
            if (Math.abs(e) <= EPS_POS_M && Math.abs(d_dot) <= EPS_POS_RATE) {
                events.push({
                    kind: "position_complete",
                    s: input.s,
                    t: input.t,
                    action_id: m.action.id
                });
                // the tracker HOLDS the achieved f as f_hold (hold-wide law)
                m = {
                    kind: "track",
                    f_hold: road.fOf(input.d, input.s),
                    hold_action_id: m.action.id
                };
                continue;
            }
            if (!m.shortfall_emitted && input.s > m.action.at_s + m.action.over_m) {
                events.push({
                    kind: "position_shortfall",
                    s: input.s,
                    t: input.t,
                    action_id: m.action.id,
                    detail: {
                        target_f: m.target_f,
                        achieved_f: input.f,
                        deficit_m: Math.abs(e)
                    }
                });
                m = { ...m, shortfall_emitted: true };
                // the tracker keeps converging — over_m is a budget, not a switch-off
            }
        }
        break;
    }
    // --- steering_complete (01 §A.2) ------------------------------------------
    // 01 §A.2's letter spells the measure UNSIGNED (`first sample with |phi| ≥
    // 0.9·phi_c`). Recorded deviation: the measure here is SIGNED — progress
    // toward the NEW commitment's hand, handSign(hand)·phi ≥ 0.9·phi_c — because
    // on a commit→commit supersession flip (02 §3.1's esses row; the C30-LR
    // family) the bike still carries the OLD hand's lean at the new commitment's
    // first step, so |phi| ≥ 0.9·phi_c fires instantly while leaned the WRONG
    // way, corrupting dt_steer = t(steering_complete) − t(turn_in) and
    // steer_share (01 §A.2) for the second corner of every chained fixture. The
    // two spellings agree exactly on every non-flip commitment (phi never
    // reaches 0.9·phi_c opposite the hand under the tracker's 5° authority).
    // 01 §A.2 needs a design amendment to the signed form.
    if (m.kind === "commit" && !m.steered) {
        const tgt = degToRad(m.action.target.lean_deg);
        if (handSign(m.action.hand) * input.phi >= 0.9 * tgt) {
            events.push({
                kind: "steering_complete",
                s: input.s,
                t: input.t,
                ...(m.corner !== null ? { corner_id: m.corner.id } : {}),
                action_id: m.action.id
            });
            m = { ...m, steered: true };
        }
    }
    // --- the one owner's target_lean ------------------------------------------
    let target_lean;
    let lat_action_id;
    switch (m.kind) {
        case "commit":
            target_lean = handSign(m.action.hand) * degToRad(m.action.target.lean_deg);
            lat_action_id = m.action.id;
            break;
        case "unwind":
            target_lean = 0;
            lat_action_id = null;
            break;
        case "position":
            target_lean = trackerTargetLean(m.target_f, road, input.s, input.d, input.psi, input.v);
            lat_action_id = m.action.id;
            break;
        case "track":
            target_lean = trackerTargetLean(m.f_hold, road, input.s, input.d, input.psi, input.v);
            lat_action_id = m.hold_action_id;
            break;
    }
    return { machine: m, target_lean, steer_state: m.kind, lat_action_id, events };
}
//# sourceMappingURL=steering.js.map