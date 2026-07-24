// core/integrate.ts — THE one stepper (ARCHITECTURE §2: exactly one integrator
// exists; solvers, the corrective shadow, counterfactual riders, and the viewer
// all call it — C-ONE-CORE's substance from commit one).
//
// Classical fixed-step RK4 at dt_s = 0.005 s (design/02 §6). Per step:
// - the controller is read ONCE (ZOH): steering machine → target_lean;
//   roll_cmd = clamp((target_lean − phi_prestep)/dt, ±roll_rate), computed from
//   the pre-step phi and held across all four stages (no stage re-evaluates the
//   clamp — with phi_dot_su = 0 the tracker reaches its target within one step
//   and never overshoots, by construction);
// - the longitudinal command follows the slew lattice (core/controller.ts): the
//   stage derivative reads the linear a(τ) between the step's two lattice
//   values (rate = the active slew during a ramp, 0 settled) — the trajectory
//   design/09 §3.2a's closed forms integrate exactly;
// - friction-ellipse clipping runs INSIDE every stage evaluation: a_lat =
//   G·tan(phi) from the stage's OWN phi, a_clip = clamp(a(τ), ±aLongAvail)
//   drives v_dot — the trajectory can never transiently leave the grip circle
//   mid-step (02 §4). mu is read once per step at the pre-step (s, d) (the
//   lateral clamp keeps it defined through a crossing step);
// - phi_dot_su is evaluated PER STAGE from the stage's own phi; b_dem uses the
//   step's ZOH a_cmd and the step's ZOH a_cmd_rate (ARCHITECTURE §10.10);
// - termination scan per step with precedence crash > off_road > stopped >
//   road_end > max_time > max_dist (02 §7), crossings bracketed by linear
//   interpolation between the last accepted and first violating state (D19) so
//   events and the terminal sample carry exact crossing coordinates;
// - the raw 200 Hz series is resampled onto the ds_m arc grid and discarded
//   (core/resample.ts); the record is deep-frozen in core/record.ts.
import { RIDER_PROFILES, G, dt_s as DT_DEFAULT, ds_m as DS_DEFAULT, v_floor_ms, v_valid_min_ms, max_time_s, max_dist_m, eps_phi_deg, eps_mag, V_MIN_RHS } from "./constants.js";
import { degToRad, kmhToMs } from "./units.js";
import { aLongAvail, phiMax, ellipseMag, phiDotSu, suSustained, suTransient, PHI_VALID_MIN_DEG } from "./slice.js";
import { LONG_STATE_INITIAL, longitudinalActions, stepLongitudinal, freezeWindowOf, isFrozen, EPS_ACTIVATE_M } from "./controller.js";
import { initialMachine, stepSteering } from "./steering.js";
import { longitudinalEventKind, terminalEventKind, sortEvents } from "./events.js";
import { toSample, buildTrajectory } from "./record.js";
import { resample } from "./resample.js";
function lateralActions(scenario) {
    return scenario.rider.plan
        .filter((a) => a.do === "turn_in" || a.do === "position")
        .sort((a, b) => a.at_s - b.at_s);
}
function lerp(a, b, alpha) {
    return a + (b - a) * alpha;
}
/**
 * integrate(scenario, world, cfg) → Trajectory (ARCHITECTURE §5). Pure and
 * total for engine-rank inputs: the runaway guards (max_time/max_dist)
 * guarantee termination; no exception crosses this boundary.
 */
export function integrate(scenario, world, cfg = {}) {
    const road = world.road;
    const profile = RIDER_PROFILES[scenario.rider.profile];
    const cap = scenario.rider.roll_rate_cap_dps;
    const roll_rate_dps = cap !== undefined ? Math.min(profile.roll_rate_dps, cap) : profile.roll_rate_dps;
    const roll_rate = degToRad(roll_rate_dps); // rad/s, the effective rate (02 §3)
    const dt = cfg.dt_s ?? DT_DEFAULT;
    const ds = cfg.ds_m ?? scenario.config.ds_m ?? DS_DEFAULT;
    const maxT = cfg.max_time_s ?? max_time_s;
    const maxD = cfg.max_dist_m ?? max_dist_m;
    const longActs = longitudinalActions(scenario.rider.plan);
    const latActs = lateralActions(scenario);
    // --- start state (03 §2: the road starts at the origin heading +x) --------
    const start = scenario.rider.start;
    const f0 = start.f ?? (start.d !== undefined ? road.fOf(start.d, 0) : 1.0);
    const d0 = start.d ?? road.dOf(f0, 0);
    const psi0 = road.psi_road(0);
    // left normal in the y-down frame: (sin psi, −cos psi)
    let state = {
        x: d0 * Math.sin(psi0),
        y: -d0 * Math.cos(psi0),
        psi: psi0,
        v: kmhToMs(start.speed_kmh),
        phi: 0
    };
    let longState = LONG_STATE_INITIAL;
    let machine = initialMachine(f0);
    let prevAClip = 0; // most recent completed step's a_clip (ARCHITECTURE §10.11)
    let latIdx = 0; // next lateral action to activate
    const freezes = [];
    const brakeEnded = new Set(); // brake ids whose brake_end already fired
    let lastBrakeId = null; // most recent brake activation (brake_end attribution)
    const raw = [];
    const events = [];
    const phiValidMin = degToRad(PHI_VALID_MIN_DEG);
    const epsPhiCrash = degToRad(eps_phi_deg);
    let t = 0;
    let path = 0;
    let proj = { s: 0, d: d0 }; // pre-step road-frame position
    let terminated = null;
    const maxSteps = Math.ceil(maxT / dt) + 8;
    for (let k = 0; k <= maxSteps && terminated === null; k++) {
        const s = proj.s;
        const d = proj.d;
        const f = road.fOf(d, s);
        const mu = road.muAt(s, d);
        // --- longitudinal channel (ZOH read, slew lattice) ----------------------
        const long = stepLongitudinal(longState, longActs, s, k, dt);
        for (const act of long.activated) {
            const tCross = activationTime(raw, act.at_s, s, t, dt, state.v);
            events.push({ kind: longitudinalEventKind(act), s: act.at_s, t: tCross, action_id: act.id });
            const fw = freezeWindowOf(act, tCross);
            if (fw !== null)
                freezes.push(fw);
        }
        // brake_end: the commanded level returns to zero after a braking phase —
        // attributed to the most recent brake action, once per activation, whether
        // the release came from its own taper or a superseding throttle's ramp.
        if (long.action !== null && long.action.do === "brake")
            lastBrakeId = long.action.id;
        if (lastBrakeId !== null &&
            !brakeEnded.has(lastBrakeId) &&
            long.a_start < 0 &&
            long.a_end >= -1e-12) {
            const alpha = long.a_end > long.a_start ? -long.a_start / (long.a_end - long.a_start) : 1;
            events.push({
                kind: "brake_end",
                s: s + state.v * alpha * dt,
                t: t + alpha * dt,
                action_id: lastBrakeId
            });
            brakeEnded.add(lastBrakeId);
        }
        longState = long.next;
        // --- lateral activations + steering machine (ZOH read) ------------------
        const activations = [];
        while (latIdx < latActs.length && latActs[latIdx].at_s <= s + EPS_ACTIVATE_M) {
            const a = latActs[latIdx];
            activations.push({ action: a, s_cross: a.at_s, t_cross: activationTime(raw, a.at_s, s, t, dt, state.v) });
            latIdx++;
        }
        const steer = stepSteering(machine, activations, { s, d, f, psi: state.psi, v: state.v, phi: state.phi, t }, road, roll_rate, prevAClip);
        machine = steer.machine;
        for (const ev of steer.events)
            events.push({ ...ev });
        // --- roll command (ZOH; freeze overrides to 0 without changing state) ---
        const frozen = isFrozen(freezes, t);
        const roll_cmd = frozen
            ? 0
            : Math.min(Math.max((steer.target_lean - state.phi) / dt, -roll_rate), roll_rate);
        // --- record the raw point at this instant -------------------------------
        const aLatNow = G * Math.tan(state.phi);
        const availNow = aLongAvail(aLatNow, mu);
        const aClipNow = Math.min(Math.max(long.a_start, -availNow), availNow);
        raw.push({
            t,
            x: state.x,
            y: state.y,
            psi: state.psi,
            v: state.v,
            phi: state.phi,
            s,
            d,
            mu,
            cmd_a: long.a_start,
            a_cmd_rate: long.a_cmd_rate,
            a_long: aClipNow,
            clipped: Math.abs(long.a_start - aClipNow) > 1e-12,
            cmd_lean: steer.target_lean,
            roll_rate_dps,
            action_id: long.action?.id ?? null,
            steer_state: steer.steer_state,
            lat_action_id: steer.lat_action_id,
            su_sustained: suSustained(state.phi, long.a_start, mu),
            su_transient: suTransient(state.phi, long.a_cmd_rate),
            below_validity: state.v < v_valid_min_ms && Math.abs(state.phi) >= phiValidMin
        });
        // --- one RK4 step -------------------------------------------------------
        const latticeRate = (long.a_end - long.a_start) / dt;
        const deriv = (st, tau) => {
            const vf = Math.max(st.v, V_MIN_RHS);
            const aLatStage = G * Math.tan(st.phi);
            const avail = aLongAvail(aLatStage, mu);
            const aCmdTau = long.a_start + latticeRate * tau;
            const a_clip = Math.min(Math.max(aCmdTau, -avail), avail);
            const su = phiDotSu(st.phi, long.a_start, long.a_cmd_rate, mu);
            return {
                x: st.v * Math.cos(st.psi),
                y: st.v * Math.sin(st.psi),
                psi: (G * Math.tan(st.phi)) / vf,
                v: a_clip,
                phi: roll_cmd + su,
                a_clip
            };
        };
        const advance = (st, h, dv) => ({
            x: st.x + h * dv.x,
            y: st.y + h * dv.y,
            psi: st.psi + h * dv.psi,
            v: st.v + h * dv.v,
            phi: st.phi + h * dv.phi
        });
        const k1 = deriv(state, 0);
        const sA = advance(state, dt / 2, k1);
        const k2 = deriv(sA, dt / 2);
        const sB = advance(state, dt / 2, k2);
        const k3 = deriv(sB, dt / 2);
        const sC = advance(state, dt, k3);
        const k4 = deriv(sC, dt);
        const next = {
            x: state.x + (dt / 6) * (k1.x + 2 * k2.x + 2 * k3.x + k4.x),
            y: state.y + (dt / 6) * (k1.y + 2 * k2.y + 2 * k3.y + k4.y),
            psi: state.psi + (dt / 6) * (k1.psi + 2 * k2.psi + 2 * k3.psi + k4.psi),
            v: state.v + (dt / 6) * (k1.v + 2 * k2.v + 2 * k3.v + k4.v),
            phi: state.phi + (dt / 6) * (k1.phi + 2 * k2.phi + 2 * k3.phi + k4.phi)
        };
        const stepPath = (dt / 6) * (state.v + 2 * sA.v + 2 * sB.v + sC.v);
        const tNext = (k + 1) * dt;
        const pathNext = path + stepPath;
        prevAClip = k1.a_clip; // the completed step's clip (stage-1 value)
        // --- termination scan (precedence; bracketed crossing, D19) -------------
        const projNext = road.project(next.x, next.y);
        const muNext = road.muAt(projNext.s, projNext.d);
        const aLatNext = G * Math.tan(next.phi);
        const availNext = aLongAvail(aLatNext, muNext);
        const aClipNext = Math.min(Math.max(long.a_end, -availNext), availNext);
        const magNext = ellipseMag(aClipNext, aLatNext, muNext);
        const magPrev = ellipseMag(aClipNow, aLatNow, mu);
        let reason = null;
        let alpha = 1;
        const phiCeil = phiMax(muNext) + epsPhiCrash;
        if (Math.abs(next.phi) > phiCeil || magNext > 1 + eps_mag) {
            reason = "crash";
            const aPhi = Math.abs(next.phi) > phiCeil
                ? crossingAlpha(Math.abs(state.phi), Math.abs(next.phi), phiCeil)
                : 1;
            const aMag = magNext > 1 + eps_mag ? crossingAlpha(magPrev, magNext, 1 + eps_mag) : 1;
            alpha = Math.min(aPhi, aMag);
        }
        else if (Math.abs(projNext.d) > road.lane_width_m) {
            reason = "off_road";
            alpha = crossingAlpha(Math.abs(d), Math.abs(projNext.d), road.lane_width_m);
        }
        else if (next.v < v_floor_ms) {
            reason = "stopped";
            alpha = crossingAlpha(state.v, next.v, v_floor_ms);
        }
        else if (projNext.s >= road.total_len_m - 1e-9) {
            reason = "road_end";
            const denom = projNext.s > s + 1e-12 && projNext.s < road.total_len_m ? projNext.s - s : stepPath;
            alpha = denom > 0 ? Math.min(1, Math.max(0, (road.total_len_m - s) / denom)) : 1;
        }
        else if (tNext >= maxT - 1e-12) {
            reason = "max_time";
            alpha = Math.min(1, Math.max(0, (maxT - t) / dt));
        }
        else if (pathNext >= maxD) {
            reason = "max_dist";
            alpha = stepPath > 0 ? Math.min(1, Math.max(0, (maxD - path) / stepPath)) : 1;
        }
        if (reason !== null) {
            // terminal state: lerp between last accepted and first violating state
            const term = {
                x: lerp(state.x, next.x, alpha),
                y: lerp(state.y, next.y, alpha),
                psi: lerp(state.psi, next.psi, alpha),
                v: lerp(state.v, next.v, alpha),
                phi: lerp(state.phi, next.phi, alpha)
            };
            const tTerm = t + alpha * dt;
            const projTerm = road.project(term.x, term.y);
            const muTerm = road.muAt(projTerm.s, projTerm.d);
            const aCmdTerm = long.a_start + latticeRate * alpha * dt;
            const availTerm = aLongAvail(G * Math.tan(term.phi), muTerm);
            const aClipTerm = Math.min(Math.max(aCmdTerm, -availTerm), availTerm);
            raw.push({
                t: tTerm,
                x: term.x,
                y: term.y,
                psi: term.psi,
                v: term.v,
                phi: term.phi,
                s: projTerm.s,
                d: projTerm.d,
                mu: muTerm,
                cmd_a: aCmdTerm,
                a_cmd_rate: long.a_cmd_rate,
                a_long: aClipTerm,
                clipped: Math.abs(aCmdTerm - aClipTerm) > 1e-12,
                cmd_lean: steer.target_lean,
                roll_rate_dps,
                action_id: long.action?.id ?? null,
                steer_state: steer.steer_state,
                lat_action_id: steer.lat_action_id,
                su_sustained: suSustained(term.phi, aCmdTerm, muTerm),
                su_transient: suTransient(term.phi, long.a_cmd_rate),
                below_validity: term.v < v_valid_min_ms && Math.abs(term.phi) >= phiValidMin
            });
            terminated = { reason, s: projTerm.s, t: tTerm, x: term.x, y: term.y };
            const evKind = terminalEventKind(reason);
            if (evKind !== null) {
                events.push({ kind: evKind, s: projTerm.s, t: tTerm });
            }
            break;
        }
        state = next;
        t = tNext;
        path = pathNext;
        proj = projNext;
    }
    // The loop is guaranteed to terminate by the max_time guard; the guard above
    // (maxSteps) is a believed-impossible backstop.
    if (terminated === null) {
        const projFin = road.project(state.x, state.y);
        terminated = { reason: "max_time", s: projFin.s, t, x: state.x, y: state.y };
    }
    const retained = resample(raw, road, world.sight, ds);
    const samples = retained.map(toSample);
    return buildTrajectory(samples, sortEvents(events), terminated);
}
/** Alpha at which q crosses `threshold` between q0 and q1 (clamped to [0, 1]). */
function crossingAlpha(q0, q1, threshold) {
    if (q1 === q0)
        return 1;
    return Math.min(1, Math.max(0, (threshold - q0) / (q1 - q0)));
}
/**
 * Bracketed activation time for an at_s crossing: lerp between the previous
 * raw point and the current one; before the first step (or when stationary)
 * the current time is exact.
 */
function activationTime(raw, at_s, s_now, t_now, dt, v_now) {
    const prev = raw[raw.length - 1];
    if (prev === undefined || s_now <= prev.s)
        return t_now;
    if (at_s >= s_now)
        return t_now;
    if (at_s <= prev.s) {
        // crossed in an earlier step but only actionable now (epsilon effects)
        return t_now;
    }
    const alpha = (at_s - prev.s) / (s_now - prev.s);
    return prev.t + alpha * (t_now - prev.t);
}
//# sourceMappingURL=integrate.js.map