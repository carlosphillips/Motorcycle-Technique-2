// core/record.ts — THE one rad→deg conversion point (ARCHITECTURE §6.1, drift
// risk #1): internal math is SI + radians; the Sample record stores angles in
// DEGREES (psi, phi, cmd_lean deg; roll_rate, su_* deg/s) exactly per design/05
// §2.1. Also the deep-freeze of the Trajectory (children before parents, so no
// mutability window exists — 05 §2.2).
import { radToDeg } from "./units.js";
import { kappa as kappaOf, aLat as aLatOf, ellipseMag, aLongMax, aLatMax } from "./slice.js";
import { G, V_MIN_RHS } from "./constants.js";
/** Normalize −0 to 0 so raw records never carry a negative zero. */
function nz(x) {
    return x === 0 ? 0 : x;
}
/**
 * Convert one retained point to the wire Sample (05 §2.1 field order). The
 * derived dynamics channels (kappa, a_lat, grip, n_long, n_lat) are recomputed
 * from the point's own state so the record's identities — kappa =
 * G·tan(phi)/v², a_lat = v²·kappa, grip = 1 − ellipseMag — hold exactly at
 * every sample (P-KAPPA, P-ELLIPSE).
 */
export function toSample(p) {
    const kap = kappaOf(p.v, p.phi);
    const a_lat = aLatOf(Math.max(p.v, V_MIN_RHS), kap); // ≡ G·tan(phi)
    const mag = ellipseMag(p.a_long, a_lat, p.mu);
    return {
        s: nz(p.s),
        t: nz(p.t),
        x: nz(p.x),
        y: nz(p.y),
        psi: nz(radToDeg(p.psi)),
        v: nz(p.v),
        phi: nz(radToDeg(p.phi)),
        kappa: nz(kap),
        a_long: nz(p.a_long),
        a_lat: nz(a_lat),
        grip: nz(1 - mag),
        mu: p.mu,
        d: nz(p.d),
        f: nz(p.f),
        cmd_lean: nz(radToDeg(p.cmd_lean)),
        cmd_a: nz(p.cmd_a),
        roll_rate: p.roll_rate_dps,
        action_id: p.action_id,
        clipped: p.clipped,
        n_long: nz(p.a_long / aLongMax(p.mu)),
        n_lat: nz(a_lat / aLatMax(p.mu)),
        sight_m: nz(p.sight_m),
        ssd_m: nz(p.ssd_m),
        limit_x: nz(p.limit_x),
        limit_y: nz(p.limit_y),
        sight_ride_m: nz(p.sight_ride_m),
        steer_state: p.steer_state,
        lat_action_id: p.lat_action_id,
        su_sustained: nz(radToDeg(p.su_sustained)),
        su_transient: nz(radToDeg(p.su_transient)),
        a_cmd_rate: nz(p.a_cmd_rate),
        below_validity: p.below_validity
    };
}
/** Deep-freeze helper: freezes plain objects/arrays recursively, children first. */
function deepFreeze(value) {
    if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
        for (const key of Object.keys(value)) {
            deepFreeze(value[key]);
        }
        Object.freeze(value);
    }
    return value;
}
/**
 * Assemble the deep-frozen Trajectory (05 §2.2): samples + events + terminated,
 * frozen children-before-parents. The raw series must already be discarded by
 * the caller — this function sees only the retained record.
 */
export function buildTrajectory(samples, events, terminated) {
    const traj = {
        samples: samples.map((s) => deepFreeze(s)),
        events: events.map((e) => deepFreeze(e)),
        terminated: deepFreeze(terminated)
    };
    Object.freeze(traj.samples);
    Object.freeze(traj.events);
    return Object.freeze(traj);
}
// Re-export the gravity constant consumers of the record identities expect to
// find beside them (kappa identity documentation aid).
export { G };
//# sourceMappingURL=record.js.map