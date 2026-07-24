// solve/counterfactual.ts — the ONE counterfactual harness (D42; design/04 §4c).
//
// Every what-if in linelab is one call of one signature:
//
//   counterfactual(world, x0, latency, rider, predicate) → Result<{trajectory, verdict}, CfRefusal>
//
// Both `rider` and `predicate` come from CLOSED sets declared HERE — the
// definition site D42's own law names (WP-08 ownership amendment: solve/types.ts
// re-exports these; it never re-declares them). Named entry points are thin
// wrappers that declare their (rider, predicate) binding at their own definition
// sites (`correctiveShot` in solve/corrective.ts); there is no second harness
// and no unregistered controller anywhere.
//
// Phase (v0.1): the registry is closed at two ids from the moment D42 lands, but
// the REACHABLE set is exactly {"lean_only_reserve"} until D45's arithmetic
// spike passes — a call naming `brake_reserve_escape` rejects SCHEMA with
// deferred "continuation envelope (D45)" (phase-gating law, 00 §3). The
// predicate `reserve_bounded_run` (§4d's grading law) is gated with it.
//
// One-stepper note (ARCHITECTURE §2, C-ONE-CORE), recorded judgment: the
// lean-only shadow commands a_cmd = 0 with an empty command-rate history, so on
// design/02's Tier 1R physics BOTH stand-up terms are exactly zero and the
// policy dynamics REDUCE to the design's own closed forms — v exactly constant
// (04 §4a.5, the fact that deleted the stopped-shadow error name), phi a
// rate-limited ramp,
// psi the ln-sec heading law of 02 §3.1, and the post-ramp path an exact circle
// (09 §3.2a's normative A-AN-SAVE-POLICY expectations, asserted to 1e-6 rad).
// This module therefore EVALUATES those closed forms on the engine's dt lattice
// (positions by per-step Simpson quadrature of the known heading law — exact to
// ~1e-12 m) and reuses core's termination vocabulary/precedence, resampler,
// record builder, and event ordering verbatim. No derivative stepping, no
// controller lattice, no second integration scheme exists here; the latency
// window (plan riding) goes through core/integrate itself, from road start,
// with no state stitching. When core/integrate grows a mid-state launch entry,
// this propagator folds into it without moving the API.
import { ok, err } from "../core/result.js";
import { RIDER_PROFILES, G, dt_s, v_floor_ms, v_valid_min_ms, max_time_s, max_dist_m, eps_phi_deg, eps_mag, V_MIN_RHS } from "../core/constants.js";
import { degToRad, handSign } from "../core/units.js";
import { phiReserve, muUse, phiMax, ellipseMag, PHI_VALID_MIN_DEG } from "../core/slice.js";
import { toSample, buildTrajectory } from "../core/record.js";
import { resample } from "../core/resample.js";
import { terminalEventKind, sortEvents } from "../core/events.js";
import { integrate } from "../core/integrate.js";
import { compose } from "../road/compose.js";
import { governingCorner, NO_CORNER_FRAME_HAND, sideSign, withMu } from "../road/corridor.js";
import { castSight } from "../sight/cast.js";
import { footprintsOf } from "../sight/footprints.js";
import { ssd } from "../sight/ssd.js";
import { F_SAVE, eps_f_save } from "./constants.js";
import { F_DETECT, eps_f_detect } from "./constants.js";
// ---------------------------------------------------------------------------
// The closed registries (design/04 §4c.1 — copied VERBATIM; drift risk #12)
export const COUNTERFACTUAL_RIDERS = ["lean_only_reserve", "brake_reserve_escape"];
export const CF_PREDICATES = [
    "return_after_detect",
    "horizon_bounded_return",
    "reserve_bounded_run"
];
/** The D45 phase-gating string (00 §3; cli/deferred.ts holds the CLI table). */
export const CF_DEFERRED_D45 = "continuation envelope (D45)";
/**
 * The counterfactual rider registry — closed at exactly two ids (D42). Adding a
 * third rider is a design-set edit with a decision-log entry, never a pack, a
 * flag, or a config key (§4c.6).
 */
export const CF_RIDER_REGISTRY = Object.freeze({
    lean_only_reserve: Object.freeze({
        id: "lean_only_reserve",
        short_name: "lean-only rider",
        reachable: true
    }),
    brake_reserve_escape: Object.freeze({
        id: "brake_reserve_escape",
        short_name: "lean-and-brake rider",
        reachable: false,
        deferred: CF_DEFERRED_D45
    })
});
export const CF_PREDICATE_REGISTRY = Object.freeze({
    return_after_detect: Object.freeze({
        id: "return_after_detect",
        reachable: true,
        obligation: "OUTSIDE_DRIFTING_OUT(x0) must hold: f(x0) > F_DETECT + eps_f_detect, df/ds > 0, and a turn_in event has occurred at or before x0"
    }),
    horizon_bounded_return: Object.freeze({
        id: "horizon_bounded_return",
        reachable: true,
        obligation: "no launch-state condition; the caller MUST supply a station horizon s_h >= s_detect derived from the main line"
    }),
    reserve_bounded_run: Object.freeze({
        id: "reserve_bounded_run",
        reachable: false,
        deferred: CF_DEFERRED_D45,
        obligation: "none — brake_reserve_escape carries no precondition (§4c.4)"
    })
});
/**
 * The ratified §4c.7 disclosure sentence, golden-pinned, carried by corrective
 * surfaces. It contains the registered short_name "lean-only rider" — the
 * machine-checkable substring A-CORR-EXPLAIN asserts.
 */
export const CF_DISCLOSURE_LEAN_ONLY = "The save is probed by the lean-only rider: an immediate roll to `phiReserve`, " +
    "throttle closed, no brake. It forgoes the trail-brake line-tightening the engine " +
    "models, so it is conservative on that axis, and it is only defined against an " +
    "outward drift — there is no inside save.";
// ---------------------------------------------------------------------------
// CfRefusal (§4c.4) — a violated obligation is a design bug, never a user input
// error: code INTERNAL, reason on detail.reason (the one reason-token
// convention), exit-4 at any CLI leak (08 §7.2).
export const CF_REFUSAL_REASONS = [
    "not_outside_corridor",
    "not_drifting_outward",
    "no_turn_in_before_x0",
    "horizon_not_from_main_line",
    "plan_not_literalised",
    "unknown_rider"
];
function refuse(reason, at, message) {
    return { code: "INTERNAL", at, message, detail: { reason } };
}
/**
 * Interpolate the recorded state of a line at time t (the v0.1 stand-in for
 * stateAt's kinematic slice): numeric channels lerp between the bracketing
 * retained samples; f is RECOMPUTED from the corridor algebra at the lerped
 * (d, s) — never lerped independently (drift risk #9); dfds is the bracket's
 * recorded-f slope. Returns null when t is outside the record.
 */
export function recordedStateAt(traj, t, road) {
    const samples = traj.samples;
    if (samples.length === 0)
        return null;
    const first = samples[0];
    const last = samples[samples.length - 1];
    if (t < first.t - 1e-12 || t > last.t + 1e-12)
        return null;
    let i = 0;
    while (i + 1 < samples.length && samples[i + 1].t < t)
        i++;
    const a = samples[i];
    const b = samples[Math.min(i + 1, samples.length - 1)];
    const span = b.t - a.t;
    const alpha = span > 0 ? Math.min(1, Math.max(0, (t - a.t) / span)) : 0;
    const lerp = (p, q) => p + (q - p) * alpha;
    const s = lerp(a.s, b.s);
    const d = lerp(a.d, b.d);
    const dfds = b.s - a.s > 1e-12 ? (b.f - a.f) / (b.s - a.s) : 0;
    return {
        sample: {
            t,
            s,
            x: lerp(a.x, b.x),
            y: lerp(a.y, b.y),
            psi: lerp(a.psi, b.psi),
            v: lerp(a.v, b.v),
            phi: lerp(a.phi, b.phi),
            f: road.fOf(d, s)
        },
        dfds
    };
}
// ---------------------------------------------------------------------------
// Literalise-first (§4c.5): every counterfactual takes its plan from
// LineResult.resolved_scenario.rider.plan. Plans are id-addressed and
// corner-relative in the AUTHORED wire form; on a counterfactual world those
// anchors are undefined, so an unliteralised action refuses.
const LITERAL_DOS = new Set(["brake", "turn_in", "throttle", "position"]);
function literalisedRefusal(plan) {
    for (let i = 0; i < plan.length; i++) {
        const at = `rider.plan[${i}]`;
        const a = plan[i];
        if (a === null || typeof a !== "object") {
            return refuse("plan_not_literalised", at, "plan action is not an object");
        }
        if (typeof a["do"] !== "string" || !LITERAL_DOS.has(a["do"])) {
            return refuse("plan_not_literalised", at, `unknown plan action do: ${String(a["do"])}`);
        }
        if ("at" in a || typeof a["at_s"] !== "number" || !Number.isFinite(a["at_s"])) {
            return refuse("plan_not_literalised", at, "plan action is id-addressed (anchor form) — a counterfactual takes the literalised plan (absolute at_s) from LineResult.resolved_scenario (04 §4c.5)");
        }
        if (a["do"] === "turn_in") {
            const target = a["target"];
            const lean = target !== null && typeof target === "object" ? target["lean_deg"] : undefined;
            if (typeof lean !== "number" || !Number.isFinite(lean) || (a["hand"] !== "L" && a["hand"] !== "R")) {
                return refuse("plan_not_literalised", at, "turn_in is not literalised — the executed plan carries explicit {lean_deg, hand}; tangent_inside never survives into it (04 §4.2)");
            }
        }
    }
    return null;
}
// ---------------------------------------------------------------------------
// World assembly (harness-internal; the canonical figure-level assembly lives
// in solve/run.ts, WP-09). Folds config.mu + hazard μ-bands through
// corridor.withMu's one clamp law; composes the per-sample sight caster from
// sight/'s pure pieces.
function hazardBandMu(road, scenario) {
    const base = scenario.config.mu;
    const hazards = scenario.hazards;
    if (hazards.length === 0)
        return () => base;
    return (s, d) => {
        for (const h of hazards) {
            const s0 = h.at.at_s;
            if (s < s0 || s >= s0 + h.span_m)
                continue;
            const w = h.width_m;
            let lo;
            let hi;
            if (h.side === "center") {
                const c = road.dOf(0.5, s);
                lo = c - w / 2;
                hi = c + w / 2;
            }
            else {
                // flush against the named usable edge, hand-resolved through sideSign
                // (design/03 §4.2); the usable edges sit at f = 0 and f = 1.
                const hand = governingCorner(road.corners, s)?.hand ?? NO_CORNER_FRAME_HAND;
                const sigma = sideSign(h.side, hand);
                const d0 = road.dOf(0, s);
                const d1 = road.dOf(1, s);
                const edge = sigma > 0 ? Math.max(d0, d1) : Math.min(d0, d1);
                lo = Math.min(edge, edge - sigma * w);
                hi = Math.max(edge, edge - sigma * w);
            }
            if (d >= lo && d <= hi)
                return h.mu;
        }
        return base;
    };
}
function effectiveProfile(scenario) {
    const base = RIDER_PROFILES[scenario.rider.profile];
    const cap = scenario.rider.roll_rate_cap_dps;
    if (cap === undefined || cap >= base.roll_rate_dps)
        return base;
    return { ...base, roll_rate_dps: cap };
}
function assembleWorld(spec, scenario) {
    const composed = compose(spec);
    if (!composed.ok)
        return composed;
    const road = withMu(composed.value, hazardBandMu(composed.value, scenario));
    const profile = effectiveProfile(scenario);
    const footprints = footprintsOf(road, scenario.occluders);
    const sight = {
        cast: (eye) => castSight(road, eye, footprints),
        ssd: (v_ms, phi_rad, mu) => ssd(v_ms, phi_rad, scenario.config.ssd_model, profile, mu)
    };
    const world = {
        road,
        sight,
        occluders: scenario.occluders,
        hazards: scenario.hazards
    };
    return ok({ road, world, profile });
}
/** Alpha at which q crosses `threshold` between q0 and q1 (clamped to [0, 1]). */
function crossingAlpha(q0, q1, threshold) {
    if (q1 === q0)
        return 1;
    return Math.min(1, Math.max(0, (threshold - q0) / (q1 - q0)));
}
function simpson(g, a, b) {
    const m = (a + b) / 2;
    return ((b - a) / 6) * (g(a) + 4 * g(m) + g(b));
}
function integrateLeanOnlyShadow(road, launch, target_phi, roll_rate, roll_rate_dps, returnHorizonS) {
    const dt = dt_s;
    const v = launch.v;
    const vf = Math.max(v, V_MIN_RHS);
    const thr = F_SAVE + eps_f_save;
    // closed-form controls: phi ramps at the cap toward the constant target
    const dPhi = target_phi - launch.phi;
    const c = dPhi === 0 ? 0 : Math.sign(dPhi) * roll_rate;
    const tauArr = c === 0 ? 0 : dPhi / c;
    const phiOf = (tau) => tau >= tauArr ? target_phi : launch.phi + c * tau;
    const omegaHold = (G * Math.tan(target_phi)) / vf;
    const psiArr = c === 0
        ? launch.psi
        : launch.psi + (G / (vf * c)) * Math.log(Math.cos(launch.phi) / Math.cos(target_phi));
    const psiOf = (tau) => {
        if (tau >= tauArr)
            return psiArr + omegaHold * (tau - tauArr);
        return launch.psi + (G / (vf * c)) * Math.log(Math.cos(launch.phi) / Math.cos(phiOf(tau)));
    };
    const phiValidMin = degToRad(PHI_VALID_MIN_DEG);
    const epsPhiCrash = degToRad(eps_phi_deg);
    const evalAt = (tau, xPrev, yPrev, tauPrev) => {
        // advance the position by quadrature of the known heading law, split at the
        // ramp-arrival kink so each panel integrates a smooth integrand
        let x = xPrev;
        let y = yPrev;
        const cuts = tauArr > tauPrev + 1e-15 && tauArr < tau - 1e-15
            ? [tauPrev, tauArr, tau]
            : [tauPrev, tau];
        for (let i = 0; i + 1 < cuts.length; i++) {
            const a = cuts[i];
            const b = cuts[i + 1];
            x += simpson((u) => v * Math.cos(psiOf(u)), a, b);
            y += simpson((u) => v * Math.sin(psiOf(u)), a, b);
        }
        const proj = road.project(x, y);
        const mu = road.muAt(proj.s, proj.d);
        return {
            tau,
            x,
            y,
            psi: psiOf(tau),
            phi: phiOf(tau),
            s: proj.s,
            d: proj.d,
            mu,
            f: road.fOf(proj.d, proj.s)
        };
    };
    const toRaw = (p) => ({
        t: launch.t0 + p.tau,
        x: p.x,
        y: p.y,
        psi: p.psi,
        v,
        phi: p.phi,
        s: p.s,
        d: p.d,
        mu: p.mu,
        cmd_a: 0,
        a_cmd_rate: 0,
        a_long: 0,
        clipped: false,
        cmd_lean: target_phi,
        roll_rate_dps,
        action_id: null,
        // the corrective-shot policy is the shadow's steering owner (02 §3.1
        // ownership (1)); the recorded steer_state is the closed four-set, and a
        // held constant commitment is `commit` (recorded WP-08 judgment)
        steer_state: "commit",
        lat_action_id: null,
        su_sustained: 0,
        su_transient: 0,
        below_validity: v < v_valid_min_ms && Math.abs(p.phi) >= phiValidMin
    });
    const raw = [];
    let prev = evalAt(0, launch.x, launch.y, 0);
    raw.push(toRaw(prev));
    let returned = null;
    const scanReturn = (a, b) => {
        if (returned !== null)
            return;
        if (b.s <= a.s + 1e-12)
            return; // stalled/regressing projection: no station advance
        const lo = Math.max(a.s, returnHorizonS);
        if (lo > b.s)
            return;
        const fAt = (s) => a.f + ((b.f - a.f) * (s - a.s)) / (b.s - a.s);
        const fLo = fAt(lo);
        if (fLo <= thr) {
            returned = { s: lo, f: fLo };
        }
        else if (b.f <= thr) {
            const alpha = (thr - fLo) / (b.f - fLo);
            returned = { s: lo + alpha * (b.s - lo), f: thr };
        }
    };
    // launch below the numeric floor cannot happen from a live main line (v is
    // constant across the shadow — P-CORR-CONSTANT-SPEED); guard for totality
    if (v < v_floor_ms) {
        const terminated = {
            reason: "stopped",
            s: prev.s,
            t: launch.t0,
            x: prev.x,
            y: prev.y
        };
        return { raw, terminated, returned: null };
    }
    const maxSteps = Math.ceil(max_time_s / dt) + 8;
    let terminated = null;
    for (let k = 0; k < maxSteps && terminated === null; k++) {
        const tauNext = (k + 1) * dt;
        const next = evalAt(tauNext, prev.x, prev.y, prev.tau);
        // termination scan, engine precedence (02 §7): crash > off_road > stopped >
        // road_end > max_time > max_dist; crossings bracketed like the engine's
        let reason = null;
        let alpha = 1;
        const magPrev = ellipseMag(0, G * Math.tan(prev.phi), prev.mu);
        const magNext = ellipseMag(0, G * Math.tan(next.phi), next.mu);
        const phiCeil = phiMax(next.mu) + epsPhiCrash;
        if (Math.abs(next.phi) > phiCeil || magNext > 1 + eps_mag) {
            reason = "crash";
            const aPhi = Math.abs(next.phi) > phiCeil
                ? crossingAlpha(Math.abs(prev.phi), Math.abs(next.phi), phiCeil)
                : 1;
            const aMag = magNext > 1 + eps_mag ? crossingAlpha(magPrev, magNext, 1 + eps_mag) : 1;
            alpha = Math.min(aPhi, aMag);
        }
        else if (Math.abs(next.d) > road.lane_width_m) {
            reason = "off_road";
            alpha = crossingAlpha(Math.abs(prev.d), Math.abs(next.d), road.lane_width_m);
        }
        else if (next.s >= road.total_len_m - 1e-9) {
            reason = "road_end";
            const denom = next.s - prev.s;
            alpha = denom > 0 ? Math.min(1, Math.max(0, (road.total_len_m - prev.s) / denom)) : 1;
        }
        else if (tauNext >= max_time_s - 1e-12) {
            reason = "max_time";
        }
        else if (v * tauNext >= max_dist_m) {
            reason = "max_dist";
            alpha = Math.min(1, Math.max(0, (max_dist_m - v * prev.tau) / (v * dt)));
        }
        if (reason !== null) {
            const tauTerm = prev.tau + alpha * dt;
            const term = evalAt(tauTerm, prev.x, prev.y, prev.tau);
            raw.push(toRaw(term));
            scanReturn(prev, term);
            terminated = {
                reason,
                s: term.s,
                t: launch.t0 + tauTerm,
                x: term.x,
                y: term.y
            };
            break;
        }
        raw.push(toRaw(next));
        scanReturn(prev, next);
        prev = next;
    }
    if (terminated === null) {
        terminated = {
            reason: "max_time",
            s: prev.s,
            t: launch.t0 + prev.tau,
            x: prev.x,
            y: prev.y
        };
    }
    return { raw, terminated, returned };
}
// ---------------------------------------------------------------------------
// Record assembly: the shadow is a run, not a special case — same arc-grid
// retention through core/resample (grid anchored at the launch station), same
// rad→deg conversion through core/record, same event ordering.
function shadowTrajectory(road, sight, run, ds) {
    const s0 = run.raw[0].s;
    const shifted = run.raw.map((p) => ({ ...p, s: p.s - s0 }));
    const shiftedRoad = { ...road, fOf: (d, s) => road.fOf(d, s + s0) };
    const retained = resample(shifted, shiftedRoad, sight, ds).map((p) => ({
        ...p,
        s: p.s + s0
    }));
    const samples = retained.map(toSample);
    const events = [];
    const evKind = terminalEventKind(run.terminated.reason);
    if (evKind !== null) {
        events.push({ kind: evKind, s: run.terminated.s, t: run.terminated.t });
    }
    return buildTrajectory(samples, sortEvents(events), run.terminated);
}
function shadowDocument(traj, rider, predicate) {
    return Object.freeze({
        samples: traj.samples,
        events: traj.events,
        terminated: traj.terminated,
        rider,
        predicate
    });
}
// ---------------------------------------------------------------------------
// The harness
/**
 * counterfactual(world, x0, latency, rider, predicate) →
 * Result<{trajectory, verdict}, CfRefusal>  (design/04 §4c.1 — ONE signature).
 *
 * - `world`: the actual road, or a generated continuation member (D45).
 * - `x0`: the recorded launch state on the literalised line (§4c.5).
 * - `latency_s`: 0 or the profile's t_react_s; during the window the
 *   counterfactual rides the LITERALISED plan unchanged (re-integrated from
 *   road start through core/integrate — no state stitching), then the rider
 *   takes over.
 * - `rider` / `predicate`: the closed sets above. The v0.1 reachable rider set
 *   is exactly {"lean_only_reserve"}; `brake_reserve_escape` and §4d's
 *   `reserve_bounded_run` reject SCHEMA + deferred (phase-gating law).
 *
 * The §4c.4 precondition is discharged THROUGH THE PREDICATE: under
 * `return_after_detect` the launch must be OUTSIDE_DRIFTING_OUT or the call
 * refuses; under `horizon_bounded_return` there is no launch condition and the
 * caller must supply a main-line station horizon `s_h >= s_detect`.
 */
export function counterfactual(world, x0, latency_s, rider, predicate) {
    // --- rider axis (closed; unknown ids are a design bug, gated ids are phase) --
    if (!COUNTERFACTUAL_RIDERS.includes(rider)) {
        return err(refuse("unknown_rider", "rider", `id outside CounterfactualRider reached the harness: ${String(rider)}`));
    }
    const riderRec = CF_RIDER_REGISTRY[rider];
    if (!riderRec.reachable) {
        return err({
            code: "SCHEMA",
            at: "rider",
            message: `counterfactual rider "${rider}" is declared but not buildable in this phase`,
            deferred: riderRec.deferred ?? CF_DEFERRED_D45,
            detail: { reason: "deferred_rider", rider }
        });
    }
    if (!CF_PREDICATES.includes(predicate)) {
        // predicate ids share the closed-set law; an unknown one is the same class
        // of design bug as an unknown rider (recorded WP-08 judgment)
        return err(refuse("unknown_rider", "predicate", `id outside CfPredicate reached the harness: ${String(predicate)}`));
    }
    const predRec = CF_PREDICATE_REGISTRY[predicate];
    if (!predRec.reachable) {
        return err({
            code: "SCHEMA",
            at: "predicate",
            message: `counterfactual predicate "${predicate}" is gated behind D45's grading law (04 §4d)`,
            deferred: predRec.deferred ?? CF_DEFERRED_D45,
            detail: { reason: "deferred_predicate", predicate }
        });
    }
    // --- literalise-first (§4c.5) ---------------------------------------------
    const litRefusal = literalisedRefusal(x0.resolved_scenario.rider.plan);
    if (litRefusal !== null)
        return err(litRefusal);
    // --- the §4c.4 obligation, keyed by predicate ------------------------------
    if (predicate === "return_after_detect") {
        if (!(x0.sample.f > F_DETECT + eps_f_detect)) {
            return err(refuse("not_outside_corridor", "x0", `f(x0) = ${x0.sample.f} <= F_DETECT + eps_f_detect — the return station IS the verdict, so the launch must already be a genuine outward drift (04 §4c.4)`));
        }
        if (!(x0.dfds > 0)) {
            return err(refuse("not_drifting_outward", "x0", `df/ds(x0) = ${x0.dfds} <= 0`));
        }
        if (!x0.turn_in_before) {
            return err(refuse("no_turn_in_before_x0", "x0", "the §4a.2 detect guard is unmet: no turn_in event at or before x0"));
        }
    }
    else {
        // horizon_bounded_return: no launch-state condition; the horizon must come
        // from the main line, at or beyond s_detect
        if (x0.s_h === undefined ||
            x0.s_detect === undefined ||
            !(Number.isFinite(x0.s_h) && Number.isFinite(x0.s_detect)) ||
            x0.s_h < x0.s_detect) {
            return err(refuse("horizon_not_from_main_line", "x0.s_h", "the horizon route requires a station horizon s_h >= s_detect derived from the main line (04 §4c.4)"));
        }
    }
    // --- world -----------------------------------------------------------------
    const scenario = x0.resolved_scenario;
    const assembled = assembleWorld(world, scenario);
    if (!assembled.ok)
        return assembled;
    const { road, world: engineWorld, profile } = assembled.value;
    // --- launch (latency rides the literalised plan through THE stepper) -------
    let launch = {
        t0: x0.sample.t,
        x: x0.sample.x,
        y: x0.sample.y,
        psi: degToRad(x0.sample.psi),
        v: x0.sample.v,
        phi: degToRad(x0.sample.phi)
    };
    let launchS = x0.sample.s;
    if (latency_s > 0) {
        const ride = integrate(scenario, engineWorld);
        const tGo = x0.sample.t + latency_s;
        const at = recordedStateAt(ride, tGo, road);
        if (at === null) {
            // the literalised plan departs this world before the rider can take
            // over: the counterfactual IS the ride's own consequence — no policy
            // segment exists, nothing returned (the wrapper's
            // `departed_before_reaction` arm consumes this)
            const doc = shadowDocument(ride, rider, predicate);
            return ok({
                trajectory: doc,
                verdict: {
                    rider,
                    predicate,
                    saved: false,
                    returned: null,
                    disclosure: CF_DISCLOSURE_LEAN_ONLY
                }
            });
        }
        launch = {
            t0: tGo,
            x: at.sample.x,
            y: at.sample.y,
            psi: degToRad(at.sample.psi),
            v: at.sample.v,
            phi: degToRad(at.sample.phi)
        };
        launchS = at.sample.s;
    }
    // --- the policy (§4a.4 by reference) ---------------------------------------
    const target_phi = handSign(x0.hand) * phiReserve(muUse(profile.skill, scenario.config.mu));
    const roll_rate = degToRad(profile.roll_rate_dps);
    // return horizon: strict route grades the first return strictly PAST the
    // launch station (04 §4a.5: s_shot < s*); the horizon route grades at or
    // beyond max(s_h, s(launch)) (04 §4b.3)
    const horizon = predicate === "return_after_detect"
        ? launchS + 1e-9
        : Math.max(x0.s_h ?? launchS, launchS);
    const run = integrateLeanOnlyShadow(road, launch, target_phi, roll_rate, profile.roll_rate_dps, horizon);
    const traj = shadowTrajectory(road, engineWorld.sight, run, scenario.config.ds_m);
    const doc = shadowDocument(traj, rider, predicate);
    const saved = run.returned !== null;
    return ok({
        trajectory: doc,
        verdict: {
            rider,
            predicate,
            saved,
            returned: run.returned,
            disclosure: CF_DISCLOSURE_LEAN_ONLY
        }
    });
}
//# sourceMappingURL=counterfactual.js.map