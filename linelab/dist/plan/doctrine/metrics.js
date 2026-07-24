// plan/doctrine/metrics.ts — the 14 closed metric implementations,
// `checks_version: 2` (design/01 §A.6: code, versioned independently of the
// pack). Pure functions of (samples, events, analysis) — the finished record
// only (design/01 §A.2); never the road model, never the engine.
//
// The shared measurement definitions (§A.2) live at the top; the metric
// vocabulary is the closed 14-set below. Pack thresholds that parameterize a
// measurement are threaded in as explicit typed arguments (the pack is data;
// the arithmetic here is the code side of the D12 seam).
import { handSign } from "../../core/units.js";
import { SIGHT_TREND_WINDOW_M, SIGHT_TREND_DEADBAND_M } from "../../sight/constants.js";
// ---------------------------------------------------------------------------
// Version + vocabulary
/**
 * design/01 §A.6 — the metric-vocabulary (code) version. Independent of any
 * pack's `version`; a pack binds against it via `requires_checks_version`.
 */
export const CHECKS_VERSION = 2;
/** design/01 §A.6, verbatim — the closed metric vocabulary of checks_version 2. */
export const METRIC_IDS = [
    "apex_pct",
    "oio_fractions",
    "input_count",
    "steer_share",
    "throttle_legs",
    "taper_profile",
    "ellipse_max",
    "lean_max",
    "sight_deficit",
    "hold_wide_legs",
    "tracker_overdrive",
    "link_legs",
    "chain_extent",
    "flow_legs"
];
// ---------------------------------------------------------------------------
// §A.2 measurement-definition constants (code — part of checks_version 2, not
// pack data; this module has no constants.ts of its own, so they are declared
// here, once).
/**
 * 1.5 deg — TUNING (design/01 §A.2). A steering input is a maximal rising run
 * of |cmd_lean| toward the corner's hand with rise > SI_HYST, measured on the
 * COMMANDED channel (stand-up disturbances and the exit unwind never count).
 * Also check 13's leg (c) extremum prominence bar.
 */
export const SI_HYST_DEG = 1.5;
function firstEvent(record, kind, cornerId) {
    for (const e of record.events) {
        if (e.kind === kind && e.corner_id === cornerId)
            return e;
    }
    return null;
}
/** Index of the retained sample nearest station s (ties → earlier). */
export function sampleIndexNearestS(samples, s) {
    if (samples.length === 0)
        return null;
    let best = 0;
    let bestD = Number.POSITIVE_INFINITY;
    for (let i = 0; i < samples.length; i++) {
        const d = Math.abs(samples[i].s - s);
        if (d < bestD) {
            bestD = d;
            best = i;
        }
    }
    return best;
}
/**
 * Resolve W_c (design/01 §A.2). Returns null when the line never rides the
 * corner (zero samples at/past s0 — the corner was not reached).
 * Fallbacks, documented: with no turn_in event the window opens at s0; with no
 * exit event it closes at corner end (or termination, whichever comes first) —
 * §A.2's "for a terminated line with no exit event, corner end".
 */
export function cornerWindow(record, corner) {
    const samples = record.samples;
    if (samples.length === 0)
        return null;
    const turnIn = firstEvent(record, "turn_in", corner.id);
    const exit = firstEvent(record, "exit", corner.id);
    const sLo = turnIn ? turnIn.s : corner.s0;
    const sHi = exit ? exit.s : Math.min(corner.s1, samples[samples.length - 1].s);
    if (sHi < sLo)
        return null;
    let i0 = -1;
    let i1 = -1;
    for (let i = 0; i < samples.length; i++) {
        const s = samples[i].s;
        if (s >= sLo && i0 === -1)
            i0 = i;
        if (s <= sHi)
            i1 = i;
    }
    if (i0 === -1 || i1 < i0)
        return null;
    // The corner counts as ridden only if the line actually reaches it.
    const reached = samples.some((sm) => sm.s >= corner.s0);
    if (!reached)
        return null;
    return {
        corner,
        i0,
        i1,
        s_lo: sLo,
        s_hi: sHi,
        turn_in: turnIn,
        exit,
        L_c: corner.s1 - corner.s0
    };
}
/**
 * §A.2 — steering inputs: maximal rising runs of |cmd_lean| toward the
 * corner's hand with rise > SI_HYST, on the COMMANDED channel. Returns the
 * runs as [startIdx, peakIdx] pairs (in sample-array indices).
 */
export function steeringInputRuns(record, w) {
    const h = handSign(w.corner.hand);
    const samples = record.samples;
    const runs = [];
    let runStart = null;
    // Baseline = the last commanded value BEFORE the window (when one exists).
    // The commanded channel is a ZOH setpoint that STEPS at the turn_in
    // activation (core/record: cmd_lean is the setpoint, not the ramped phi), and
    // W_c opens at the turn_in event — so the first in-window sample already
    // carries the committed value, and seeding the baseline from w.i0 itself
    // silently discards every single-commit engine line's ONLY input, grading it
    // "no_input"/fail against the design's own G-C30-CHECKVECTOR pin
    // (single_input passes on the clean canonical line). The step into the
    // window IS the rising input under design/01 §A.2's letter.
    // [WP-10 seam repair — RATIFIED: the input occurs AT s(turn_in), inside the
    // closed window; only its rise magnitude needs the pre-window ZOH baseline.
    // Pre-window runs contribute a flat baseline only, so nothing outside W_c is
    // ever counted as an input.]
    const baseIdx = w.i0 > 0 ? w.i0 - 1 : w.i0;
    let prevU = h * samples[baseIdx].cmd_lean;
    for (let i = w.i0; i <= w.i1; i++) {
        const u = h * samples[i].cmd_lean;
        if (u > prevU) {
            if (runStart === null)
                runStart = i - 1;
        }
        else if (u < prevU) {
            if (runStart !== null) {
                const rise = h * samples[i - 1].cmd_lean -
                    h * samples[runStart].cmd_lean;
                if (rise > SI_HYST_DEG)
                    runs.push([runStart, i - 1]);
                runStart = null;
            }
        }
        prevU = u;
    }
    if (runStart !== null) {
        const rise = h * samples[w.i1].cmd_lean -
            h * samples[runStart].cmd_lean;
        if (rise > SI_HYST_DEG)
            runs.push([runStart, w.i1]);
    }
    return runs;
}
/** §A.2 — phi_c: max |cmd_lean| over the FIRST steering-input run in W_c (0 if none). */
export function committedLeanDeg(record, w) {
    const runs = steeringInputRuns(record, w);
    const first = runs[0];
    if (!first)
        return 0;
    let max = 0;
    for (let i = first[0]; i <= first[1]; i++) {
        const a = Math.abs(record.samples[i].cmd_lean);
        if (a > max)
            max = a;
    }
    return max;
}
/** §A.2 — steering_complete: first sample in W_c with |phi| ≥ 0.9·phi_c (delivered). */
export function steeringCompleteIndex(record, w, phiCDeg) {
    if (phiCDeg <= 0)
        return null;
    for (let i = w.i0; i <= w.i1; i++) {
        if (Math.abs(record.samples[i].phi) >= 0.9 * phiCDeg)
            return i;
    }
    return null;
}
/** Index of the first sample at/after the corner's entry boundary (within W_c). */
function cornerEntryIndex(record, w) {
    for (let i = w.i0; i <= w.i1; i++) {
        if (record.samples[i].s >= w.corner.s0)
            return i;
    }
    return w.i0;
}
/** §A.2 — apex: argmin f over W_c; cum_dpsi_deg = hand-relative net Δψ from the entry boundary. */
export function apexArgmin(record, w) {
    const samples = record.samples;
    let iMin = w.i0;
    for (let i = w.i0; i <= w.i1; i++) {
        if (samples[i].f < samples[iMin].f)
            iMin = i;
    }
    const h = handSign(w.corner.hand);
    const iEntry = cornerEntryIndex(record, w);
    const sweep = h * (samples[iMin].psi - samples[iEntry].psi);
    return {
        i: iMin,
        s: samples[iMin].s,
        f: samples[iMin].f,
        cum_dpsi_deg: Math.max(0, sweep)
    };
}
/**
 * The corner's TOTAL sweep in degrees — §A.2's apex_pct denominator — resolved
 * honestly from the record, or refused (null). Two honest channels:
 *  (a) taper geometry (r1/r2 recorded on the corner row): EXACT — road tapers
 *      are r-linear-in-swept-angle (road/compose.ts closed forms; design/03
 *      §7a.3's dκ/ds derivation assumes the same), so L_c = Θ·(r1+r2)/2 and
 *      Θ = L_c / mean(r1, r2);
 *  (b) a COMPLETED corner (recorded exit event): MEASURED — the exit event is
 *      heading capture within EPS_EXIT_DEG (design/05 §4.1), so the line's own
 *      net Δψ from the entry boundary to the exit sample is road-faithful;
 *  (c) otherwise null — an early-terminated line on an arc measures only part
 *      of the road's sweep, and the DoctrineCorner row carries no angle, so
 *      the §A.2 denominator is not computable from this record. The caller
 *      refuses with a typed na (design/01 §8: refusal over fabrication) —
 *      it never invents a 0 % apex.
 */
export function cornerSweepDeg(record, w) {
    const c = w.corner;
    if (c.r1 !== undefined && c.r2 !== undefined && c.r1 > 0 && c.r2 > 0) {
        return ((c.s1 - c.s0) / ((c.r1 + c.r2) / 2)) * (180 / Math.PI);
    }
    if (w.exit) {
        const iExit = sampleIndexNearestS(record.samples, w.exit.s);
        if (iExit !== null) {
            const h = handSign(c.hand);
            const iEntry = cornerEntryIndex(record, w);
            const measured = h *
                (record.samples[iExit].psi -
                    record.samples[iEntry].psi);
            if (measured > 0)
                return measured;
        }
    }
    return null;
}
/**
 * §A.2 — the exit sample: the sample at the RECORDED exit event; for a
 * chain-mode corner the link station (the s1 handoff) instead; for a
 * terminated line with no exit event, corner end.
 */
export function exitSampleIndex(record, w, chainMode) {
    if (chainMode)
        return sampleIndexNearestS(record.samples, w.corner.s1);
    if (w.exit)
        return sampleIndexNearestS(record.samples, w.exit.s);
    const last = record.samples[record.samples.length - 1];
    if (!last)
        return null;
    const sEnd = Math.min(w.corner.s1, last.s);
    return sampleIndexNearestS(record.samples, sEnd);
}
/**
 * §A.2 — blind(c) ⇔ at c's turn_in event, s_limit < s_end(c). Per design/03
 * §5.1, sight_m = s_limit − s_eye, so s_limit = s + sight_m at the turn-in
 * sample. Returns null when the line has no turn_in event for c (the predicate
 * is per-line and undefined without a commitment).
 */
export function blindAtTurnIn(record, corner) {
    const turnIn = firstEvent(record, "turn_in", corner.id);
    if (!turnIn)
        return null;
    const i = sampleIndexNearestS(record.samples, turnIn.s);
    if (i === null)
        return null;
    const sm = record.samples[i];
    return sm.s + sm.sight_m < corner.s1;
}
/**
 * design/05 §4 — sight_trend at sample i, windowed and deadbanded: compare
 * sight_m[i] against sight_m at the sample nearest s_i − SIGHT_TREND_WINDOW_M
 * (clamped to the first sample early on).
 */
export function sightTrendAt(samples, i) {
    const cur = samples[i];
    const target = cur.s - SIGHT_TREND_WINDOW_M;
    let j = 0;
    let bestD = Number.POSITIVE_INFINITY;
    for (let k = 0; k <= i; k++) {
        const d = Math.abs(samples[k].s - target);
        if (d < bestD) {
            bestD = d;
            j = k;
        }
    }
    const delta = cur.sight_m - samples[j].sight_m;
    if (delta > SIGHT_TREND_DEADBAND_M)
        return "opening";
    if (delta < -SIGHT_TREND_DEADBAND_M)
        return "closing";
    return "steady";
}
/**
 * geometric chain pair: the road's linked_next record (design/03 §2 measured
 * geometry). ridden-linked: geometric pair AND peak −cmd_a on the connecting
 * span ≤ link_brake_reset (pack data, threaded).
 */
export function chainStructure(record, linkBrakeReset) {
    const geometric = [];
    const ridden = [];
    const chainIds = new Set();
    for (let i = 0; i + 1 < record.corners.length; i++) {
        const c = record.corners[i];
        if (!c.linked_next)
            continue;
        geometric.push([i, i + 1]);
        const next = record.corners[i + 1];
        const peak = peakBrakeOnSpan(record, c.s1, next.s0);
        if (peak !== null && peak <= linkBrakeReset) {
            ridden.push([i, i + 1]);
            chainIds.add(c.id);
        }
    }
    return { geometricPairs: geometric, riddenPairs: ridden, chainModeCornerIds: chainIds };
}
/** Peak −cmd_a over samples with s ∈ [sFrom, sTo]; null when the span has no samples. */
export function peakBrakeOnSpan(record, sFrom, sTo) {
    let peak = null;
    for (const sm of record.samples) {
        if (sm.s < sFrom || sm.s > sTo)
            continue;
        const b = -sm.cmd_a;
        if (peak === null || b > peak)
            peak = b;
    }
    // A zero-length connecting span (adjacent corners) has no braking by
    // construction — an empty span reads peak 0, never "unknown".
    return peak ?? (sTo >= sFrom ? 0 : null);
}
// ---------------------------------------------------------------------------
// The 14 metrics (closed vocabulary, catalogue order of first use)
/**
 * 1. apex_pct — the recorded apex list + graded pct. `late_apex` reads the
 * FINAL apex's pct (design/05 §6.3), in every declared style; on a record with
 * an empty apex list (e.g. terminated early, or no dip prominent enough for
 * the ONE detector) the §A.2 argmin-f apex is the graded fallback while
 * `count` stays the recorded 0 (check 16's authority). The fallback pct is
 * measured honestly — cumΔψ(apex) over cornerSweepDeg — and is null when the
 * sweep denominator is not measurable from this record (the caller refuses
 * with a typed na; no fabricated 0 %).
 */
export function apexPct(record, w) {
    const list = w.corner.apexes;
    if (list.length > 0) {
        const graded = list[list.length - 1];
        return {
            count: list.length,
            apexes_s: list.map((a) => a.s),
            graded_pct: graded.pct,
            graded_s: graded.s
        };
    }
    const am = apexArgmin(record, w);
    const sweep = cornerSweepDeg(record, w);
    const pct = sweep !== null && sweep > 0 ? (100 * am.cum_dpsi_deg) / sweep : null;
    return { count: 0, apexes_s: [], graded_pct: pct, graded_s: am.s };
}
/** 2. oio_fractions — ti_f, apex_f, exit_f in the corner's hand-relative frame. */
export function oioFractions(record, w, chainMode, declaredDoubleApex) {
    const tiIdx = w.turn_in ? sampleIndexNearestS(record.samples, w.turn_in.s) : null;
    const tiF = tiIdx !== null ? record.samples[tiIdx].f : null;
    let apexF;
    if (declaredDoubleApex && w.corner.apexes.length > 0) {
        apexF = Math.min(...w.corner.apexes.map((a) => a.f));
    }
    else {
        apexF = apexArgmin(record, w).f;
    }
    const exIdx = exitSampleIndex(record, w, chainMode);
    const exitF = exIdx !== null ? record.samples[exIdx].f : null;
    const exitS = exIdx !== null ? record.samples[exIdx].s : null;
    return { ti_f: tiF, apex_f: apexF, exit_f: exitF, exit_s: exitS };
}
/** 3. input_count — steering inputs (§A.2 definition) in W_c. */
export function inputCount(record, w) {
    return steeringInputRuns(record, w).length;
}
/**
 * 4. steer_share — the two-sided quick-steer measurements.
 *
 * When steering never completes inside the record (`sc_s: null`), the
 * returned `steer_share` is the ridden-extent LOWER BOUND — the §A.2 formula's
 * `s(steering_complete)` does not exist, and the record proves the roll-in
 * consumed every ridden metre of the corner and was still incomplete at line
 * end. The check evaluator grades that case `eats_corner` directly
 * [ADJUDICATED, ratification]: §A.3's own worked slow_steer arithmetic
 * (share ≈ 0.74 → fail) is kinematic — committed lean over the capped rate —
 * and §A.4 pins `quick_steer` as slow_steer's MANDATORY fail; a
 * pass-by-truncation would assert "steering completed within the bar" on a
 * record that proves it never completed at all.
 */
export function steerShare(record, w) {
    const phiC = committedLeanDeg(record, w);
    const scIdx = steeringCompleteIndex(record, w, phiC);
    const tiS = w.turn_in ? w.turn_in.s : w.s_lo;
    const tiT = w.turn_in ? w.turn_in.t : record.samples[w.i0].t;
    if (scIdx === null) {
        const share = w.L_c > 0 ? Math.max(0, w.s_hi - Math.max(tiS, w.corner.s0)) / w.L_c : 0;
        return { phi_c_deg: phiC, dt_steer_s: null, steer_share: share, sc_s: null };
    }
    const sc = record.samples[scIdx];
    const share = w.L_c > 0 ? Math.max(0, sc.s - Math.max(tiS, w.corner.s0)) / w.L_c : 0;
    return {
        phi_c_deg: phiC,
        dt_steer_s: sc.t - tiT,
        steer_share: share,
        sc_s: sc.s
    };
}
/** 5. throttle_legs — the four Keith Code Rule #1 legs, commanded channel. */
export function throttleLegs(record, w, th) {
    const samples = record.samples;
    const apex = apexArgmin(record, w);
    const phiC = committedLeanDeg(record, w);
    const scIdx = steeringCompleteIndex(record, w, phiC);
    const scS = scIdx !== null ? samples[scIdx].s : null;
    // (a) crack: cmd_a ∈ [0, THR_EPS] at/before apex, not earlier than
    //     s(steering_complete) − CRACK_EARLY_FRAC·L_c   (miss = warn)
    let crackIdx = null;
    const crackFloor = scS !== null ? scS - th.crack_early_frac * w.L_c : null;
    for (let i = w.i0; i <= w.i1; i++) {
        const sm = samples[i];
        if (sm.s > apex.s)
            break;
        if (sm.cmd_a >= 0 && sm.cmd_a <= th.thr_eps) {
            if (crackFloor === null || sm.s >= crackFloor) {
                crackIdx = i;
                break;
            }
        }
    }
    const crackOk = crackIdx !== null;
    // (b) v_min at/before apex (miss = fail)
    let iVmin = w.i0;
    for (let i = w.i0; i <= w.i1; i++) {
        if (samples[i].v < samples[iVmin].v)
            iVmin = i;
    }
    const vminOk = samples[iVmin].s <= apex.s;
    // (c) roll-on onset ≤ s(apex) + ROLLON_LATE_FRAC·L_c (miss = warn)
    let onsetIdx = null;
    const searchFrom = crackIdx !== null ? crackIdx + 1 : scIdx !== null ? scIdx : w.i0;
    for (let i = searchFrom; i <= w.i1; i++) {
        if (samples[i].cmd_a > th.thr_eps) {
            onsetIdx = i;
            break;
        }
    }
    const rollonOk = onsetIdx !== null &&
        samples[onsetIdx].s <= apex.s + th.rollon_late_frac * w.L_c;
    // (d) post-onset discipline (miss = fail):
    //     dv/ds ≥ ROLLON_DVDS_MIN from onset to exit; no chop; no sustained
    //     mid-corner brake except the entry brake action's own samples.
    const ROLLON_DVDS_MIN = -0.1; // (m/s)/m — unnamed design literal, local name (§6.6)
    let disciplineOk = true;
    const disciplineWhy = [];
    if (onsetIdx !== null) {
        for (let i = onsetIdx; i < w.i1; i++) {
            const a = samples[i];
            const b = samples[i + 1];
            const ds = b.s - a.s;
            if (ds > 0 && (b.v - a.v) / ds < ROLLON_DVDS_MIN) {
                disciplineOk = false;
                disciplineWhy.push(`dv/ds below ${ROLLON_DVDS_MIN} at s=${b.s}`);
                break;
            }
        }
    }
    // entry brake action id: last braking sample at/before the turn-in station
    let entryBrakeId = null;
    const tiS = w.turn_in ? w.turn_in.s : w.s_lo;
    for (const sm of samples) {
        if (sm.s > tiS)
            break;
        if (sm.cmd_a < 0 && sm.action_id !== null)
            entryBrakeId = sm.action_id;
    }
    if (scIdx !== null) {
        for (let i = scIdx; i <= w.i1; i++) {
            const sm = samples[i];
            if (Math.abs(sm.phi) >= th.small_lean_deg && -sm.a_cmd_rate > th.rate_threshold) {
                disciplineOk = false;
                disciplineWhy.push(`chop at s=${sm.s}`);
                break;
            }
        }
        for (let i = scIdx; i <= w.i1; i++) {
            const sm = samples[i];
            if (sm.cmd_a < -th.chop_tol && sm.action_id !== entryBrakeId) {
                disciplineOk = false;
                disciplineWhy.push(`mid-corner brake at s=${sm.s}`);
                break;
            }
        }
    }
    return {
        crack_ok: crackOk,
        vmin_ok: vminOk,
        rollon_ok: rollonOk,
        discipline_ok: disciplineOk,
        detail: {
            apex_s: apex.s,
            vmin_s: samples[iVmin].s,
            onset_s: onsetIdx !== null ? samples[onsetIdx].s : null,
            discipline: disciplineWhy
        }
    };
}
/** 6. taper_profile — the trail-brake taper measurements (delivered −a_long). */
export function taperProfile(record, w, th) {
    const samples = record.samples;
    const tiS = w.turn_in ? w.turn_in.s : w.s_lo;
    // Baseline (na): entry braking completes ≥ brake_gap before turn_in — i.e.
    // the last commanded-brake sample at/before the corner window's end sits at
    // least brake_gap_m before the turn-in station. A no-brake line is trivially
    // baseline (nothing to taper).
    let lastBrakeS = null;
    for (const sm of samples) {
        if (sm.s > w.s_hi)
            break;
        if (sm.cmd_a < 0)
            lastBrakeS = sm.s;
    }
    const baseline = lastBrakeS === null || tiS - lastBrakeS >= record.physics.brake_gap_m;
    if (baseline) {
        return {
            baseline: true,
            forced_standup_at_s: null,
            redeepened_at_s: null,
            resid_exceeded: false,
            ate_reserve_at_s: null
        };
    }
    let forcedAt = null;
    let ateAt = null;
    let peak = 0;
    let peakSeen = false;
    let runMinAfterPeak = Number.POSITIVE_INFINITY;
    let redeepenAt = null;
    for (let i = w.i0; i <= w.i1; i++) {
        const sm = samples[i];
        const decel = -sm.a_long;
        if (decel > peak) {
            peak = decel;
            peakSeen = decel > 0;
            runMinAfterPeak = decel;
        }
        else if (peakSeen) {
            if (decel < runMinAfterPeak)
                runMinAfterPeak = decel;
            if (decel > runMinAfterPeak + th.redeepen_tol && redeepenAt === null) {
                redeepenAt = sm.s;
            }
        }
        if (Math.abs(sm.phi) >= th.tb_phi_min && decel > 0) {
            const aw = record.physics.a_widen_ms2(sm.phi, sm.v);
            if (aw !== null && decel > aw && forcedAt === null)
                forcedAt = sm.s;
            if (aw !== null &&
                decel > th.a_su_onset &&
                decel <= aw &&
                ateAt === null) {
                ateAt = sm.s;
            }
        }
    }
    const apex = apexArgmin(record, w);
    const residDecel = -samples[apex.i].a_long;
    const residExceeded = peak > 0 && residDecel > th.resid_frac * peak;
    return {
        baseline: false,
        forced_standup_at_s: forcedAt,
        redeepened_at_s: redeepenAt,
        resid_exceeded: residExceeded,
        ate_reserve_at_s: ateAt
    };
}
/** 7. ellipse_max — max ellipseMag over W_c (ellipseMag = 1 − grip) + crash-in-window. */
export function ellipseMax(record, w) {
    let max = 0;
    let atS = w.s_lo;
    for (let i = w.i0; i <= w.i1; i++) {
        const sm = record.samples[i];
        const mag = 1 - sm.grip;
        if (mag > max) {
            max = mag;
            atS = sm.s;
        }
    }
    const crash = record.events.some((e) => e.kind === "crash" && e.s >= w.s_lo && e.s <= w.s_hi);
    return { max_mag: max, at_s: atS, crash_in_window: crash };
}
/** 8. lean_max — max |phi| over W_c. */
export function leanMax(record, w) {
    let max = 0;
    let atS = w.s_lo;
    for (let i = w.i0; i <= w.i1; i++) {
        const sm = record.samples[i];
        if (Math.abs(sm.phi) > max) {
            max = Math.abs(sm.phi);
            atS = sm.s;
        }
    }
    return { phi_max_deg: max, at_s: atS };
}
/** 10. sight_deficit — deficit(s) = ssd_m − sight_ride_m at every sample (D16 basis). */
export function sightDeficit(record) {
    // Open-end carve-out: on a line that rode out the whole road
    // (terminated road_end, so terminated.s IS the road end), a sample whose
    // cast ran UNBLOCKED to the road end has no sight limit — "blindness comes
    // only from occluders, by design" (design/03 §5.1). The D16 line-end clamp
    // otherwise drives sight_ride_m → 0 over the final ssd-shadow of EVERY
    // finite road, failing check 10 on every clean line — against the design's
    // own G-C30-CHECKVECTOR pin (stop_within_sight passes on the clean
    // canonical line, which carries no occluder at all). Occluder-limited casts
    // are measured unchanged; early-terminated lines keep the strict scan (the
    // record cannot know the road end there).
    // [WP-10 seam repair — RATIFIED: 03 §5.1's own rule decides it. The clamped
    // "deficit" on an unblocked cast is the D16 line-end clamp (05 §2.1) meeting
    // a finite world, not a sight limit; the strict reading fails every finite
    // road's final ssd-shadow against G-C30-CHECKVECTOR's stop_within_sight
    // pass. NOTE (out of this module's reach): verdict.sight.margin_min_m in
    // solve/verdict.ts still reads the clamped channel — separate ratification.]
    const EPS_OPEN_END_M = 1.0; // station-grid tolerance on "reached the end"
    const openEligible = record.terminated.reason === "road_end";
    const sEnd = record.terminated.s;
    let maxDef = Number.NEGATIVE_INFINITY;
    let minMargin = Number.POSITIVE_INFINITY;
    let worst = null;
    let bestOpenMargin = 0;
    for (const sm of record.samples) {
        if (openEligible && sm.s + sm.sight_m >= sEnd - EPS_OPEN_END_M) {
            const open = sm.sight_ride_m - sm.ssd_m;
            if (open > bestOpenMargin)
                bestOpenMargin = open;
            continue;
        }
        const deficit = sm.ssd_m - sm.sight_ride_m;
        if (deficit > maxDef) {
            maxDef = deficit;
            worst = { s: sm.s, v: sm.v, phi: sm.phi };
        }
        const margin = sm.sight_ride_m - sm.ssd_m;
        if (margin < minMargin)
            minMargin = margin;
    }
    if (worst === null) {
        // every cast ran open to the road end: no sight limit existed anywhere;
        // report the best real margin as the representative (finite, hash-safe)
        return { max_deficit_m: 0, min_margin_m: bestOpenMargin, worst: null };
    }
    return { max_deficit_m: maxDef, min_margin_m: minMargin, worst };
}
/** 11. hold_wide_legs — release station + hold-window wide-line discipline. */
export function holdWideLegs(record, w, th) {
    const samples = record.samples;
    const tiS = w.turn_in ? w.turn_in.s : w.s_lo;
    // release(c): first station where trend = "opening" ∧ sight_ride_m ≥ ssd_m.
    // Scan domain: approach + corner (from record start to corner end) — the
    // release is a station property of this line's ride toward c.
    let releaseS = null;
    for (let i = 0; i < samples.length; i++) {
        const sm = samples[i];
        if (sm.s > w.corner.s1)
            break;
        if (sightTrendAt(samples, i) === "opening" && sm.sight_ride_m >= sm.ssd_m) {
            releaseS = sm.s;
            break;
        }
    }
    const winLo = tiS - th.hold_window_frac * w.L_c;
    let minF = null;
    for (let i = 0; i < samples.length; i++) {
        const sm = samples[i];
        if (sm.s < winLo || sm.s > tiS)
            continue;
        if (sightTrendAt(samples, i) === "opening")
            continue;
        if (minF === null || sm.f < minF)
            minF = sm.f;
    }
    return { release_s: releaseS, turn_in_s: tiS, min_f_nonopening: minF };
}
/**
 * 12. tracker_overdrive — tracker excess (su-compensated) + teleport guards.
 *
 * The two teleport guards (KAPPA_STEP, PHI_JUMP) read the Δt → 0 regime —
 * adjacent retained samples with (near-)coincident time — and ONLY that regime
 * [ADJUDICATED, ratification]. Design/01 §A.3 check 12 groups them as
 * "(carried teleport guards)" under the claim "no tracker overdrive /
 * kinematic teleport", and the carried v1 text glosses the kappa leg as "a
 * discontinuous path … with near-zero dt". At finite Δt the guards can carry
 * no information the excess leg does not already police: `kappa` is the
 * DERIVED column g·tan(phi)/v² (05 §2.1), so a finite-Δt kappa step is fully
 * determined by the phi step (leg 1's business, su-compensated) and the v step
 * (the slew law's business). Read on the 0.5 m grid instead, KAPPA_STEP = 0.01
 * becomes a speed floor — a profile-rate roll steps Δκ = 0.5·g·ω·sec²φ/v³,
 * i.e. fails below 27.1 km/h upright and 29.9 km/h at 30° lean (street
 * 50°/s) — which the design's own doctrinally-correct fixtures sit under
 * (bookDecreasing's exit unwind ≈ 6.9 m/s → Δκ ≈ 0.017; the bookEsses chain's
 * governed flicks ≤ 9 m/s), making 09 §4's A-CHAIN-GREEN and F-ORACLE-DR's
 * "good line = the default solve" unsatisfiable while check 4 simultaneously
 * mandates the full-rate roll the guard would punish. One reading satisfies
 * every binding surface; the other contradicts the catalogue's own gates.
 */
export function trackerOverdrive(record) {
    const samples = record.samples;
    let maxExcess = Number.NEGATIVE_INFINITY;
    let excessAt = null;
    let maxDk = 0;
    let dkAt = null;
    let phiJump = 0;
    let phiJumpAt = null;
    for (let i = 0; i + 1 < samples.length; i++) {
        const a = samples[i];
        const b = samples[i + 1];
        const dt = b.t - a.t;
        if (dt > 1e-9) {
            const phiDot = (b.phi - a.phi) / dt;
            const su = b.su_sustained + b.su_transient;
            const excess = Math.abs(phiDot - su) - b.roll_rate;
            if (excess > maxExcess) {
                maxExcess = excess;
                excessAt = b.s;
            }
        }
        else {
            // Δt → 0: the teleport regime. Both guards measure here (see above).
            if (Math.abs(b.phi - a.phi) > phiJump) {
                phiJump = Math.abs(b.phi - a.phi);
                phiJumpAt = b.s;
            }
            const dk = Math.abs(b.kappa - a.kappa);
            if (dk > maxDk) {
                maxDk = dk;
                dkAt = b.s;
            }
        }
    }
    return {
        max_excess_dps: maxExcess === Number.NEGATIVE_INFINITY ? 0 : maxExcess,
        excess_at_s: excessAt,
        max_dkappa: maxDk,
        dkappa_at_s: dkAt,
        phi_jump_deg: phiJump,
        phi_jump_at_s: phiJumpAt
    };
}
/** 13. link_legs — the three link-continuity legs for one geometric pair. */
export function linkLegs(record, c, next) {
    const samples = record.samples;
    // (a) entry side of c+1 — first sample at/after c+1's entry boundary (the
    //     station where c+1's hand-relative frame governs)
    let entryF = null;
    for (const sm of samples) {
        if (sm.s >= next.s0) {
            entryF = sm.f;
            break;
        }
    }
    // (b) peak −cmd_a on the connecting span
    const peak = peakBrakeOnSpan(record, c.s1, next.s0);
    // (c) local extrema of |cmd_lean| beyond SI_HYST over the connecting span
    const span = [];
    for (const sm of samples) {
        if (sm.s >= c.s1 && sm.s <= next.s0)
            span.push(Math.abs(sm.cmd_lean));
    }
    const extrema = [];
    for (let i = 1; i + 1 < span.length; i++) {
        const prev = span[i - 1];
        const cur = span[i];
        const nxt = span[i + 1];
        const isMin = cur < prev && cur < nxt;
        const isMax = cur > prev && cur > nxt;
        if (!isMin && !isMax)
            continue;
        // prominence: nearest rise/fall on both sides beyond SI_HYST
        let left = 0;
        for (let j = i - 1; j >= 0; j--)
            left = Math.max(left, Math.abs(span[j] - cur));
        let right = 0;
        for (let j = i + 1; j < span.length; j++)
            right = Math.max(right, Math.abs(span[j] - cur));
        if (Math.min(left, right) > SI_HYST_DEG)
            extrema.push(isMin ? "min" : "max");
    }
    return {
        entry_f: entryF,
        peak_brake: peak,
        extrema_count: extrema.length,
        extrema_kinds: extrema,
        hands_alternate: c.hand !== next.hand
    };
}
/** 14. chain_extent — max/min f over the chain span. */
export function chainExtent(record, sFrom, sTo) {
    let maxF = Number.NEGATIVE_INFINITY;
    let minF = Number.POSITIVE_INFINITY;
    let maxAt = sFrom;
    let minAt = sFrom;
    for (const sm of record.samples) {
        if (sm.s < sFrom || sm.s > sTo)
            continue;
        if (sm.f > maxF) {
            maxF = sm.f;
            maxAt = sm.s;
        }
        if (sm.f < minF) {
            minF = sm.f;
            minAt = sm.s;
        }
    }
    const outsideExcess = maxF - 1;
    const insideExcess = -minF;
    const outsideWorse = outsideExcess >= insideExcess;
    return {
        max_f: maxF,
        min_f: minF,
        worst_s: outsideWorse ? maxAt : minAt,
        worst_side: outsideWorse ? "outside" : "inside"
    };
}
/** 15. flow_legs — slow-in per chained corner, gap throttle discipline, rhythm. */
export function flowLegs(record, chainCorners, smallLeanDeg) {
    const samples = record.samples;
    // (a) each chained corner's v_min at/before its apex station
    let vminOk = true;
    for (const w of chainCorners) {
        const apex = apexArgmin(record, w);
        let iVmin = w.i0;
        for (let i = w.i0; i <= w.i1; i++) {
            if (samples[i].v < samples[iVmin].v)
                iVmin = i;
        }
        if (samples[iVmin].s > apex.s) {
            vminOk = false;
            break;
        }
    }
    // (b) on each connecting span, cmd_a crosses zero at most once
    let gapOk = true;
    for (let k = 0; k + 1 < chainCorners.length; k++) {
        const a = chainCorners[k].corner;
        const b = chainCorners[k + 1].corner;
        let crossings = 0;
        let prevSign = 0;
        for (const sm of samples) {
            if (sm.s < a.s1 || sm.s > b.s0)
                continue;
            const sign = sm.cmd_a > 0 ? 1 : sm.cmd_a < 0 ? -1 : 0;
            if (sign !== 0 && prevSign !== 0 && sign !== prevSign)
                crossings++;
            if (sign !== 0)
                prevSign = sign;
        }
        if (crossings > 1) {
            gapOk = false;
            break;
        }
    }
    // (c) rhythm over the chain span
    const first = chainCorners[0];
    const last = chainCorners[chainCorners.length - 1];
    let signChanges = 0;
    if (first && last) {
        const sFrom = first.s_lo;
        const sTo = last.s_hi;
        let prevSign = 0;
        for (const sm of samples) {
            if (sm.s < sFrom || sm.s > sTo)
                continue;
            if (Math.abs(sm.cmd_lean) < smallLeanDeg)
                continue;
            const sign = sm.cmd_lean > 0 ? 1 : -1;
            if (prevSign !== 0 && sign !== prevSign)
                signChanges++;
            prevSign = sign;
        }
    }
    let alternations = 0;
    for (let k = 0; k + 1 < chainCorners.length; k++) {
        const a = chainCorners[k].corner;
        const b = chainCorners[k + 1].corner;
        if (a.hand !== b.hand)
            alternations++;
    }
    return {
        vmin_ok: vminOk,
        gap_ok: gapOk,
        rhythm_sign_changes: signChanges,
        hand_alternations: alternations
    };
}
//# sourceMappingURL=metrics.js.map