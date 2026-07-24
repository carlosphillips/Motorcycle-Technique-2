// core/analyze.ts — post-run corner analysis (design/05 §6.3, design/01 Appendix A,
// ARCHITECTURE §8 WP-07). Operates over the RESAMPLED record (the frozen
// Trajectory core/integrate.ts already produced) plus the composed RoadModel.
// Pure; never mutates its input — `Trajectory` is deep-frozen, so every output
// is freshly built.
//
// Owns:
//   - THE one apex hysteresis detector (drift risk #4): a single deterministic
//     pass over each corner's f(s) that feeds BOTH `corners[].apexes[]` rows
//     AND the per-touch `apex` events (05 §6.3).
//   - the post-hoc `exit` event (heading-capture deadband, 02 §3.1/`exit,
//     figure end, and chains`; 01 Appendix A "exit sample").
//   - `danger_dwell_s` (01 Appendix A, the bracketed-crossing dwell rule).
//   - the design/05 §4.1 phase-opener table, computed now so v0.2's
//     `core/stateAt.ts` (RESERVED) can consume it without re-deriving the rule.
//
// `analyzeCorners`'s pinned ARCHITECTURE §5 signature is `(traj, road) →
// CornerRow[]`; this file returns `{ corners, events }` instead of a bare array
// (recorded deviation, see the returned agent report) because 05 §6.3 requires
// the SAME pass to also emit the per-touch `apex`/`exit` events, and an event
// needs a `t` the CornerRow apex shape (`{s, pct, f, clearance_m, v_kmh,
// lean_deg}`, 05 §6.3) does not carry — the caller (solve/verdict.ts, WP-09)
// merges `events` into the line's Trajectory.events via `core/events.ts`'s
// `sortEvents`. `skill` is a third parameter beyond the pinned two because
// `danger_dwell_s`'s formula (01 Appendix A) needs `phiReserve(mu_use)` with
// `mu_use = skill·mu` (02 §4), and skill is a rider-profile scalar no amount of
// Trajectory/RoadModel data can recover (recorded deviation).
import { PHASES } from "./types.js";
import { APEX_PROMINENCE_F, APEX_MIN_SEP_M, EPS_EXIT_DEG } from "./constants.js";
import { degToRad, radToDeg, handSign, msToKmh } from "./units.js";
import { phiReserve, muUse } from "./slice.js";
import { wrapToPi } from "./steering.js";
import { sortEvents } from "./events.js";
// ---------------------------------------------------------------------------
// THE apex hysteresis detector (05 §6.3)
//
// A two-phase (valley/peak) hysteresis walk over the discrete f(s) series —
// NOT a naive "reset candidate to the current point on every accept" scheme,
// which would double-count a single monotonic post-apex rise every time it
// crosses another APEX_PROMINENCE_F multiple. Standard "zigzag" shape:
//   - phase "down": track the running MINIMUM since the last accepted apex
//     ("a new, lower minimum supersedes the pending one"); accept it once f
//     has risen ≥ APEX_PROMINENCE_F off that minimum ("before the corner ends
//     or ... supersedes"), then switch to "up".
//   - phase "up": track the running MAXIMUM (never emitted — not an apex);
//     once f has DROPPED ≥ APEX_PROMINENCE_F off that peak, a genuine new
//     descent has been confirmed, so switch back to "down" and re-arm.
// At the corner's end, a still-pending "down" candidate is accepted outright
// (the "before the corner ends" trigger) even with no confirming rise.
function detectApexSamples(samples) {
    if (samples.length === 0)
        return [];
    const accepted = [];
    let phase = "down";
    let extreme = samples[0];
    for (let i = 1; i < samples.length; i++) {
        const cur = samples[i];
        if (phase === "down") {
            if (cur.f < extreme.f) {
                extreme = cur;
            }
            else if (cur.f - extreme.f >= APEX_PROMINENCE_F) {
                accepted.push(extreme);
                phase = "up";
                extreme = cur;
            }
        }
        else {
            if (cur.f > extreme.f) {
                extreme = cur;
            }
            else if (extreme.f - cur.f >= APEX_PROMINENCE_F) {
                phase = "down";
                extreme = cur;
            }
        }
    }
    if (phase === "down")
        accepted.push(extreme); // corner ended mid-descent — accept the pending min
    return mergeCloseApexes(accepted);
}
/** Post-pass: apexes closer than APEX_MIN_SEP_M merge, keeping the deeper (lower-f) one. */
function mergeCloseApexes(accepted) {
    const out = [];
    for (const cand of accepted) {
        const prev = out[out.length - 1];
        if (prev !== undefined && cand.s - prev.s < APEX_MIN_SEP_M) {
            if (cand.f < prev.f)
                out[out.length - 1] = cand;
        }
        else {
            out.push(cand);
        }
    }
    return out;
}
function toApexPoint(sample, corner, road) {
    const psi0 = road.psi_road(corner.s0);
    const psiApex = road.psi_road(sample.s);
    const swept = handSign(corner.hand) * (psiApex - psi0);
    const pct = corner.angle_deg > 0 ? (100 * radToDeg(swept)) / corner.angle_deg : 0;
    const dInner = road.dOf(0, sample.s);
    return {
        s: sample.s,
        pct,
        f: sample.f,
        clearance_m: Math.abs(sample.d - dInner),
        v_kmh: msToKmh(sample.v),
        lean_deg: sample.phi
    };
}
function headingErrDeg(psiDeg, psiExitRad) {
    return radToDeg(wrapToPi(degToRad(psiDeg) - psiExitRad));
}
function lerp(a, b, alpha) {
    return a + (b - a) * alpha;
}
function findExit(samples, corner, road, searchFromS, searchUntilS) {
    const psiExit = road.psi_road(corner.s1);
    let prev = null;
    for (const sample of samples) {
        if (sample.s < searchFromS - 1e-9)
            continue;
        if (sample.s > searchUntilS + 1e-9)
            break;
        const err = headingErrDeg(sample.psi, psiExit);
        if (prev !== null) {
            const prevErr = headingErrDeg(prev.psi, psiExit);
            const prevAbs = Math.abs(prevErr);
            const curAbs = Math.abs(err);
            if (prevAbs > EPS_EXIT_DEG && curAbs <= EPS_EXIT_DEG) {
                const span = prevAbs - curAbs;
                const alpha = span > 0 ? (prevAbs - EPS_EXIT_DEG) / span : 0;
                const s = lerp(prev.s, sample.s, alpha);
                const t = lerp(prev.t, sample.t, alpha);
                return {
                    s,
                    d: lerp(prev.d, sample.d, alpha),
                    f: lerp(prev.f, sample.f, alpha),
                    heading_err_deg: lerp(prevErr, err, alpha),
                    event: { kind: "exit", s, t, corner_id: corner.id }
                };
            }
        }
        else if (curAbsAtOrBelowEps(err)) {
            return {
                s: sample.s,
                d: sample.d,
                f: sample.f,
                heading_err_deg: err,
                event: { kind: "exit", s: sample.s, t: sample.t, corner_id: corner.id }
            };
        }
        prev = sample;
    }
    // Fallback: corner end (01 Appendix A "for a terminated line with no exit
    // event, corner end") — the last retained sample at/before the bound, which
    // is automatically the trajectory's own end when it terminated early.
    const bound = Math.min(corner.s1, searchUntilS);
    let fallback;
    for (const sample of samples) {
        if (sample.s <= bound + 1e-9)
            fallback = sample;
        else
            break;
    }
    if (fallback === undefined) {
        return { s: corner.s1, d: 0, f: 0, heading_err_deg: 0, event: null };
    }
    return {
        s: fallback.s,
        d: fallback.d,
        f: fallback.f,
        heading_err_deg: headingErrDeg(fallback.psi, psiExit),
        event: null
    };
}
function curAbsAtOrBelowEps(errDeg) {
    return Math.abs(errDeg) <= EPS_EXIT_DEG;
}
// ---------------------------------------------------------------------------
// danger_dwell_s (01 Appendix A): total time within the corner window W_c with
// |phi| > phiReserve(mu_use), mu_use = skill·mu (per-sample, since mu can vary
// under a gravel hazard band). Boundary crossings — both W_c's own s0/s1 clip
// and the reserve-exceedance threshold itself — are linearly interpolated
// between bracketing samples (the standard bracketed-crossing rule).
function exceedRad(sample, skill) {
    return Math.abs(degToRad(sample.phi)) - phiReserve(muUse(skill, sample.mu));
}
/** Danger-zone seconds contributed by one bracket's overlap with [w0, w1]. */
function segmentDangerTime(a, b, w0, w1, skill) {
    const lo = Math.max(a.s, w0);
    const hi = Math.min(b.s, w1);
    const span = b.s - a.s;
    if (hi <= lo || span <= 0)
        return 0;
    const alphaLo = (lo - a.s) / span;
    const alphaHi = (hi - a.s) / span;
    const eA = exceedRad(a, skill);
    const eB = exceedRad(b, skill);
    const eLo = lerp(eA, eB, alphaLo);
    const eHi = lerp(eA, eB, alphaHi);
    const tLo = lerp(a.t, b.t, alphaLo);
    const tHi = lerp(a.t, b.t, alphaHi);
    const dt = tHi - tLo;
    if (dt <= 0)
        return 0;
    if (eLo > 0 && eHi > 0)
        return dt;
    if (eLo <= 0 && eHi <= 0)
        return 0;
    const alphaCross = eLo / (eLo - eHi); // linear zero-crossing of the exceedance function
    const tCross = tLo + alphaCross * dt;
    return eLo > 0 ? tCross - tLo : tHi - tCross;
}
function dangerDwellS(samples, w0, w1, skill) {
    let total = 0;
    for (let i = 0; i + 1 < samples.length; i++) {
        total += segmentDangerTime(samples[i], samples[i + 1], w0, w1, skill);
    }
    return total;
}
// ---------------------------------------------------------------------------
// analyzeCorners — the ONE pass (design names verbatim, ARCHITECTURE §5)
function windowSamples(samples, w0, w1) {
    return samples.filter((s) => s.s >= w0 - 1e-9 && s.s <= w1 + 1e-9);
}
export function analyzeCorners(traj, road, skill) {
    const corners = [];
    const events = [];
    road.corners.forEach((corner, idx) => {
        const spanSamples = traj.samples.filter((s) => s.s >= corner.s0 - 1e-9 && s.s <= corner.s1 + 1e-9);
        if (spanSamples.length === 0)
            return; // the line never reached this corner — no row (judgment call)
        const apexSamples = detectApexSamples(spanSamples);
        apexSamples.forEach((sample, i) => {
            events.push({
                kind: "apex",
                s: sample.s,
                t: sample.t,
                corner_id: corner.id,
                detail: { index: i + 1 }
            });
        });
        const apexes = apexSamples.map((sample) => toApexPoint(sample, corner, road));
        const searchFromS = apexSamples.length > 0 ? apexSamples[apexSamples.length - 1].s : spanSamples[Math.floor(spanSamples.length / 2)].s;
        const next = road.corners[idx + 1];
        const searchUntilS = next !== undefined ? next.s0 : Number.POSITIVE_INFINITY;
        const exitResult = findExit(traj.samples, corner, road, searchFromS, searchUntilS);
        if (exitResult.event !== null)
            events.push(exitResult.event);
        const turnIn = traj.events.find((e) => e.kind === "turn_in" && e.corner_id === corner.id);
        const w0 = turnIn?.s ?? corner.s0;
        const w1 = exitResult.s;
        const wSamples = windowSamples(traj.samples, w0, w1);
        const lean_max_deg = wSamples.reduce((m, s) => Math.max(m, Math.abs(s.phi)), 0);
        const grip_min = wSamples.reduce((m, s) => Math.min(m, s.grip), Number.POSITIVE_INFINITY);
        corners.push({
            id: corner.id,
            hand: corner.hand,
            corner_type: corner.type,
            apexes,
            lean_max_deg,
            grip_min: Number.isFinite(grip_min) ? grip_min : 1,
            danger_dwell_s: dangerDwellS(traj.samples, w0, w1, skill),
            exit: { s: exitResult.s, d: exitResult.d, f: exitResult.f, heading_err_deg: exitResult.heading_err_deg }
        });
    });
    return { corners, events: sortEvents(events) };
}
/**
 * The 05 §4.1 opener table for one event: which phase (if any) this event
 * kind opens. `turn_in`/`steering_complete`/`roll_on` open unconditionally;
 * `exit` opens `done` for the road's last corner, else the next corner's
 * `approach` (phase and `corner_id` are independent fields — 05 §4.1). Every
 * other kind (including `crack`, `release`, all terminal bookmarks) opens no
 * phase.
 */
export function openerPhaseFor(event, lastCornerId) {
    switch (event.kind) {
        case "turn_in":
            return "turning";
        case "steering_complete":
            return "midcorner";
        case "roll_on":
            return "exiting";
        case "exit":
            return event.corner_id === lastCornerId ? "done" : "approach";
        default:
            return null;
    }
}
/**
 * The ordered opener timeline for a line: the implicit `approach` opener at
 * run start, followed by every opener event's phase, in the events array's
 * pinned order (t, then EVENT_KINDS declaration order — 05 §5). `phaseAt`
 * below resolves a query time against this timeline (05 §4.1's "half-open
 * intervals" rule: latest opener with `t ≤ t(q)`).
 */
export function phaseOpeners(traj, road) {
    const openers = [];
    const first = traj.samples[0];
    if (first !== undefined)
        openers.push({ t: first.t, phase: "approach" });
    const lastCornerId = road.corners.length > 0 ? road.corners[road.corners.length - 1].id : null;
    for (const event of traj.events) {
        const phase = openerPhaseFor(event, lastCornerId);
        if (phase !== null)
            openers.push({ t: event.t, phase });
    }
    return openers;
}
/** Phase at query time `t`: the phase opened by the latest opener with `t' ≤ t` (05 §4.1). */
export function phaseAt(openers, t) {
    let phase = PHASES[0]; // "approach" — totality guard; run start is always an opener
    for (const opener of openers) {
        if (opener.t <= t)
            phase = opener.phase;
        else
            break;
    }
    return phase;
}
//# sourceMappingURL=analyze.js.map