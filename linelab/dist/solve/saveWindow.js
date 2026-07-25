// solve/saveWindow.ts — the reserve-lean save window (D44; design/04 §4b).
//
// §4a evaluates ONE deterministic shadow from ONE instant and keeps one bit,
// `corrective.feasible`. That bit is a single sample of a function of the start
// instant. This module parameterises the start instant and reports the last
// instant at which the function still held. It owns one concept §4a does not
// have — a STATION HORIZON carried from the main line — and no new physics:
// `saveAt` is a named thin wrapper over the ONE counterfactual harness
// (04 §4c.1) and declares its binding here, at its definition site:
// (rider = "lean_only_reserve", predicate = "horizon_bounded_return").
//
// Phase law (00 §3, D44): everything in this file is OUT-OF-HASH, off by
// default, computed on demand, and absent from every committed book scene. No
// verdict member, no check, no exported ink (C-SAVEWIN-NO-INK). The CLI verb
// `save-window` and the `--scan-ds` flag stay in cli/deferred.ts until the
// v0.2 verb wiring ships; this module is the pure library surface beneath them
// (the A-SAVEWIN-VERB pattern).
//
// Vocabulary law (00 §6, D44): the object is the RESERVE-LEAN SAVE WINDOW.
// "Point of no return" appears nowhere in *Total Control* and names nothing
// here; the placard's closing sentence explicitly disclaims it.
import { ok, err } from "../core/result.js";
import { RIDER_PROFILES } from "../core/constants.js";
import { handSign, radToDeg } from "../core/units.js";
import { muUse, phiReserve } from "../core/slice.js";
import { compose } from "../road/compose.js";
import { counterfactual, recordedStateAt } from "./counterfactual.js";
import { HORIZON_BISECT_MAX, HORIZON_DISPLAY_DP, HORIZON_EPS_S, HORIZON_SCAN_DS_M, HORIZON_TAU_QUANTUM_S, TAU_TAIL_S } from "./constants.js";
// ---------------------------------------------------------------------------
// The declared binding (04 §4b.2/§4c.1: named entry points are thin wrappers,
// and each declares its (rider, predicate) binding AT ITS DEFINITION SITE;
// P-COUNTERFACTUAL-CLOSED enumerates through the wrappers, so a wrapper cannot
// smuggle in an unregistered controller).
export const SAVEAT_BINDING = Object.freeze({
    rider: "lean_only_reserve",
    predicate: "horizon_bounded_return"
});
// ---------------------------------------------------------------------------
// The closed five-value status set (04 §4b.5 — copied VERBATIM; drift risk #12).
// `intermittent` is a REFUSAL, not a caveat: no scalar, no glyph, no HUD row.
export const SAVE_WINDOW_STATUSES = [
    "resolved",
    "open_at_end",
    "never_open",
    "intermittent",
    "not_applicable"
];
// ---------------------------------------------------------------------------
// The placard (04 §4b.7 — normative, VERBATIM, always present, always rendered
// beside any displayed scalar). Its opening clause carries the registered
// short_name "lean-only rider", which is how this surface discharges §4c.7's
// disclosure obligation without printing a second string (A-SAVEWIN-PLACARD).
export const SAVE_WINDOW_PLACARD = "Reserve-lean save window, probed by the lean-only rider: the last instant " +
    "from which a rider rolling immediately to `phiReserve` with the throttle closed " +
    "still gets back inside the corridor by the station where this line ran wide. " +
    "Assumes instantaneous, perfect initiation. The save commands zero longitudinal " +
    "acceleration, so it forgoes the line-tightening that sub-threshold braking " +
    "would give (bounded by the friction ellipse, `f_long ≤ √(1 − f_lat²)` ≈ " +
    "5.2 m/s² at `phiReserve`, and by `a_widen`); `tau_close_s` is early on that " +
    "axis. The save may cut inside the corridor; inside excursions are graded by the " +
    "checks, not by this number. Not a general point of no return.";
/**
 * One sentence per `status` (04 §4b.7: "`intermittent` and `never_open` are
 * first-class results with their own sentences, not error states"). The
 * `intermittent` sentence is 04 §4b.5's own stepper wording verbatim, with `N`
 * substituted; the rest are composed from §4b.5/§4b.6 and 07 §3.6. Declared
 * HERE, once, so the HUD row, the CLI human summary and `explain` all print the
 * SAME sentence — the drift `A-SAVEWIN-PLACARD` exists to forbid.
 */
export const SAVE_WINDOW_STATUS_SENTENCES = Object.freeze({
    resolved: "the reserve-lean save window opened and closed once over this corner; `tau_close_s` is the last instant from which the probe still returned inside the corridor.",
    open_at_end: "the reserve-lean save window is still open at the scanned horizon — `tau_close_s` is the horizon, not an observed closure, so no countdown to it is drawn.",
    never_open: "no reserve-lean save existed at any legal start instant on this corner: the window never opened, and no closing instant is reported.",
    intermittent: "the reserve-lean save window opened and closed N times over this corner; linelab will not report a single closing instant.",
    not_applicable: "this corner recorded no run-wide detect, so the reserve-lean probe was never attempted and the analysis is inert here."
});
/** Display precision (04 §4b.5): every human-facing string clamps to HORIZON_DISPLAY_DP. */
export function horizonDisplay(x) {
    return (x === 0 ? 0 : x).toFixed(HORIZON_DISPLAY_DP);
}
// ---------------------------------------------------------------------------
// Shared derivations. These mirror solve/corrective.ts's private §4a.3 helpers
// (freezeEndBefore, roadSpecOf) and counterfactual.ts's effectiveProfile —
// cited, not re-owned: the LAW lives at those definition sites; WP file
// ownership keeps the v0.1 modules untouched by this v0.2 package.
function roadSpecOf(scenario) {
    const rs = scenario.road;
    if (rs.dsl.length > 0) {
        return {
            dsl: rs.dsl,
            use_full_width: rs.use_full_width,
            bike_margin_m: rs.bike_margin_m
        };
    }
    return {
        lane_width_m: rs.lane_width_m,
        bike_margin_m: rs.bike_margin_m,
        use_full_width: rs.use_full_width,
        segments: rs.segments
    };
}
function effectiveProfile(scenario) {
    const base = RIDER_PROFILES[scenario.rider.profile];
    const cap = scenario.rider.roll_rate_cap_dps;
    if (cap === undefined || cap >= base.roll_rate_dps)
        return base;
    return { ...base, roll_rate_dps: cap };
}
/**
 * t_freeze_end (04 §4a.3, §4b.5): the line's freeze-window end when its
 * mistake spec carries one (today: chop's freeze_s riding a throttle action's
 * freeze_steer_s, 03 §7.1) and −∞ otherwise. The §4b.5 domain clamp is not
 * conservatism, it is VALIDITY: inside a freeze 02 §3 overrides roll_cmd = 0,
 * so a reserve-lean roll is a command the model forbids, and a tau_close_s
 * drawn from that region would assert an input the engine would have refused
 * to deliver.
 */
function freezeEndBefore(scenario, events, t_detect) {
    let end = Number.NEGATIVE_INFINITY;
    for (const action of scenario.rider.plan) {
        if (action.do !== "throttle" || action.freeze_steer_s === undefined)
            continue;
        const onset = events.find((e) => (e.kind === "crack" || e.kind === "roll_on") && e.action_id === action.id);
        if (onset === undefined || onset.t > t_detect)
            continue;
        end = Math.max(end, onset.t + action.freeze_steer_s);
    }
    return end;
}
function internal(at, message, reason, extra = {}) {
    return { code: "INTERNAL", at, message, detail: { reason, ...extra } };
}
// ---------------------------------------------------------------------------
// saveAt (04 §4b.2) — the parameterised shadow
/** Clip a SAVED probe document at the first retained sample at or past s* (§4b.4). */
function clipAtStar(doc, s_star) {
    if (s_star === null)
        return doc;
    let cut = doc.samples.length;
    for (let i = 0; i < doc.samples.length; i++) {
        if (doc.samples[i].s >= s_star - 1e-9) {
            cut = i + 1;
            break;
        }
    }
    if (cut >= doc.samples.length)
        return doc;
    const lastS = doc.samples[cut - 1].s;
    return Object.freeze({
        samples: Object.freeze(doc.samples.slice(0, cut)),
        events: Object.freeze(doc.events.filter((e) => e.s <= lastS + 1e-9)),
        terminated: doc.terminated,
        rider: doc.rider,
        predicate: doc.predicate
    });
}
function cornerContext(line, cornerId) {
    const row = line.verdict.corners.find((c) => c.id === cornerId);
    if (row === undefined) {
        return err({
            code: "UNKNOWN_ID",
            at: "corner_id",
            message: `unknown corner "${cornerId}" — this line's corners are [${line.verdict.corners
                .map((c) => c.id)
                .join(", ")}]`,
            detail: { reason: "unknown_corner_id", corner_id: cornerId }
        });
    }
    const spec = roadSpecOf(line.resolved_scenario);
    const composed = compose(spec);
    if (!composed.ok)
        return composed;
    const ev = line.trajectory.events.find((e) => e.kind === "run_wide_detect" && e.corner_id === cornerId);
    return ok({
        road: composed.value,
        spec,
        hand: row.hand,
        detect: ev === undefined ? null : { s: ev.s, t: ev.t },
        row
    });
}
function saveAtInner(line, ctx, tau_s) {
    // Initial state = the full recorded state at t = tau, no re-derivation —
    // the same restart §4a.3 already performs at t_shot (recordedStateAt is the
    // v0.1 stand-in for stateAt's kinematic slice; it folds into core/stateAt.ts
    // when that lands, without moving this API).
    const at = recordedStateAt(line.trajectory, tau_s, ctx.road);
    if (at === null) {
        return err(internal("saveAt", "launch instant outside the recorded line", "save_launch_unresolvable", {
            tau_s
        }));
    }
    const turn_in_before = line.trajectory.events.some((e) => e.kind === "turn_in" && e.t <= tau_s + 1e-12);
    // The station horizon carried from the main line (§4b.3): s_h =
    // max(s_detect, s(tau)) keeps the horizon ahead of the restart for late tau,
    // so the predicate never degenerates to a backward-looking test. When the
    // corner has no recorded detect, no main-line horizon exists and the harness
    // refuses Err(horizon_not_from_main_line) — §4c.4's discharge is declared,
    // not inferred.
    const cf = counterfactual(ctx.spec, {
        resolved_scenario: line.resolved_scenario,
        sample: at.sample,
        dfds: at.dfds,
        turn_in_before,
        hand: ctx.hand,
        ...(ctx.detect !== null
            ? { s_detect: ctx.detect.s, s_h: Math.max(ctx.detect.s, at.sample.s) }
            : {})
    }, 0, // the scan owns the start instant; no latency window rides on top of tau
    SAVEAT_BINDING.rider, SAVEAT_BINDING.predicate);
    if (!cf.ok)
        return cf;
    const { trajectory, verdict } = cf.value;
    const s_star_m = verdict.returned === null ? null : verdict.returned.s;
    return ok(Object.freeze({
        saved: verdict.saved,
        shadow: verdict.saved ? clipAtStar(trajectory, s_star_m) : trajectory,
        s_star_m
    }));
}
/**
 * saveAt(line, corner, tau) → Result<{saved, shadow, s_star_m}> (04 §4b.2).
 *
 * A named thin wrapper over `counterfactual` under this file's declared
 * binding — no second harness, no second controller. Controller from §4a.4 BY
 * REFERENCE; success predicate = the §4b.3 station horizon carried from the
 * main line: the first bracketed s* ≥ max(s_detect, s(tau)) back inside the
 * corridor (f ≤ F_SAVE + eps_f_save), with any off_road | crash | stopped at
 * or before s* failing the probe. saved(t_shot) ≡ corrective.feasible holds by
 * construction (P-SAVEWIN-ANCHOR is a regression test, not a premise).
 */
export function saveAt(line, cornerId, tau_s) {
    const ctx = cornerContext(line, cornerId);
    if (!ctx.ok)
        return ctx;
    return saveAtInner(line, ctx.value, tau_s);
}
// ---------------------------------------------------------------------------
// saveWindow (04 §4b.5–§4b.7) — domain, grid, scan, refusal, budget
function policyOf(line, hand) {
    const scenario = line.resolved_scenario;
    const profile = effectiveProfile(scenario);
    return Object.freeze({
        target_phi_deg: radToDeg(handSign(hand) * phiReserve(muUse(profile.skill, scenario.config.mu))),
        roll_rate_dps: profile.roll_rate_dps,
        a_cmd_ms2: 0,
        basis: "phiReserve(skill·mu)"
    });
}
function windowBase(line, cornerId, hand, scan_ds_m) {
    return {
        line_id: line.line_id,
        corner_id: cornerId,
        rider: SAVEAT_BINDING.rider,
        predicate: SAVEAT_BINDING.predicate,
        policy: policyOf(line, hand),
        scan_ds_m,
        eps_s: HORIZON_EPS_S,
        placard: SAVE_WINDOW_PLACARD
    };
}
function seal(w) {
    return Object.freeze(w);
}
function computeWindow(line, cornerId, scan_ds_m) {
    const ctxR = cornerContext(line, cornerId);
    if (!ctxR.ok)
        return ctxR;
    const ctx = ctxR.value;
    const base = windowBase(line, cornerId, ctx.hand, scan_ds_m);
    // §4b.5 status table, FIRST-MATCH-WINS in table order. Row 1: the whole
    // computation is gated on corrective ≠ null for this corner.
    if (ctx.row.corrective === null) {
        return ok(seal({ ...base, status: "not_applicable", transition_count: 0, runs: 0 }));
    }
    if (ctx.detect === null) {
        // corrective ≠ null guarantees a recorded detect (§4b.3); its absence is a
        // believed-impossible envelope, not a user input error
        return err(internal("saveWindow", "corner carries a corrective block but no run_wide_detect event", "savewin_detect_event_missing", { corner_id: cornerId }));
    }
    const traj = line.trajectory;
    const events = traj.events;
    const samples = traj.samples;
    const first = samples[0];
    const last = samples[samples.length - 1];
    if (first === undefined || last === undefined) {
        return err(internal("saveWindow", "line has no retained samples", "savewin_empty_record"));
    }
    const t_detect = ctx.detect.t;
    const t_freeze_end = freezeEndBefore(line.resolved_scenario, events, t_detect);
    const hasFreeze = Number.isFinite(t_freeze_end);
    const react_profile_s = RIDER_PROFILES[line.resolved_scenario.rider.profile].t_react_s;
    // §4a.3's own quantities, restated freeze-aware (§4b.6)
    const t_earliest = Math.max(t_detect, t_freeze_end);
    const t_shot = t_earliest + react_profile_s;
    // --- domain (§4b.5): τ ∈ [max(t(turn_in of corner), t_freeze_end),
    //                          min(t_terminated, t(exit of corner) + TAU_TAIL_S)]
    const turnIn = events.find((e) => e.kind === "turn_in" && e.corner_id === cornerId) ??
        // a detect's corner may have been entered under an earlier corner's
        // commitment (chained lines): fall back to the last turn_in at or before
        // the detect — the same event runWideDetect's guard consumed
        [...events].reverse().find((e) => e.kind === "turn_in" && e.t <= t_detect + 1e-12);
    if (turnIn === undefined) {
        return err(internal("saveWindow", "corner carries a detect but the line records no turn_in event", "savewin_turn_in_missing", { corner_id: cornerId }));
    }
    const exitEv = events.find((e) => e.kind === "exit" && e.corner_id === cornerId);
    const lo = Math.max(turnIn.t, t_freeze_end, first.t);
    const hi = Math.min(traj.terminated.t, exitEv === undefined ? Number.POSITIVE_INFINITY : exitEv.t + TAU_TAIL_S, last.t);
    if (!(lo <= hi)) {
        // the entire scan region is forbidden (e.g. a freeze outlasting the
        // record): no legal start instant exists — the window never opened
        return ok(seal({ ...base, status: "never_open", transition_count: 0, runs: 0 }));
    }
    // --- grid (§4b.5): retained arc-grid stations inside the domain decimated
    // to scan_ds_m, plus the mandatory points {t_detect, t_shot, t_freeze_end}
    // (each when it lies in domain), plus both domain endpoints. Derived from
    // the recorded sample array in station order: no ordering freedom, no RNG,
    // no wall-clock (D38).
    const inDomain = samples.filter((p) => p.t >= lo - 1e-9 && p.t <= hi + 1e-9);
    let v_max = 0;
    for (const p of inDomain)
        v_max = Math.max(v_max, p.v);
    for (const t of [lo, hi]) {
        const at = recordedStateAt(traj, t, ctx.road);
        if (at !== null)
            v_max = Math.max(v_max, at.sample.v);
    }
    if (!(v_max > 0)) {
        return err(internal("saveWindow", "no recorded speed in the scan domain", "savewin_empty_domain"));
    }
    // --- the resolution law (§4b.5, NORMATIVE): the monotonicity guard is never
    // coarser than the precision the tool displays. Refuse rather than silently
    // under-trigger `intermittent` (C-SAVEWIN-REFUSE-COARSE).
    const step_s = scan_ds_m / v_max;
    if (step_s > HORIZON_TAU_QUANTUM_S + 1e-12) {
        return err({
            code: "SCHEMA",
            at: "scan_ds_m",
            message: `scan step ${scan_ds_m} m is ${step_s.toFixed(3)} s at the domain's fastest station ` +
                `(v_max = ${v_max.toFixed(2)} m/s) — coarser than the displayed precision quantum ` +
                `${HORIZON_TAU_QUANTUM_S} s (04 §4b.5 resolution law)`,
            detail: {
                reason: "scan_ds_too_coarse",
                scan_ds_m,
                v_max_ms: v_max,
                step_s,
                bound_s: HORIZON_TAU_QUANTUM_S
            }
        });
    }
    const taus = [lo, hi];
    let lastKeptS = Number.NEGATIVE_INFINITY;
    for (const p of inDomain) {
        if (p.s - lastKeptS >= scan_ds_m - 1e-9) {
            taus.push(p.t);
            lastKeptS = p.s;
        }
    }
    for (const t of [t_detect, t_shot, t_freeze_end]) {
        if (t >= lo - 1e-12 && t <= hi + 1e-12)
            taus.push(t);
    }
    taus.sort((a, b) => a - b);
    const grid = [];
    for (const t of taus) {
        if (grid.length === 0 || t - grid[grid.length - 1] > 1e-9)
            grid.push(t);
    }
    // --- the scan: evaluate saved at every grid point in ascending τ
    let runs = 0;
    const verdicts = [];
    const stars = [];
    for (const tau of grid) {
        const r = saveAtInner(line, ctx, tau);
        if (!r.ok)
            return r;
        runs++;
        verdicts.push(r.value.saved);
        stars.push(r.value.s_star_m);
    }
    let transition_count = 0;
    for (let i = 0; i + 1 < verdicts.length; i++) {
        if (verdicts[i] !== verdicts[i + 1])
            transition_count++;
    }
    const scalars = {
        t_detect_s: t_detect,
        t_shot_s: t_shot,
        ...(hasFreeze ? { t_freeze_end_s: t_freeze_end } : {}),
        t_earliest_s: t_earliest,
        react_profile_s
    };
    // --- §4b.5 status rows, keyed on open_count = the number of maximal
    // contiguous runs of `saved = true` (the save *bands*). A leading `false` run
    // is the §4b.3 inside-curl, not a closed window, so it no longer masks a real
    // window: never_open ⟺ zero bands. never_open is tested before the band rows
    // so the resolved branch can assume the scan opens.
    let open_count = 0;
    for (let i = 0; i < verdicts.length; i++) {
        if (verdicts[i] && (i === 0 || !verdicts[i - 1]))
            open_count++;
    }
    if (open_count === 0) {
        return ok(seal({ ...base, status: "never_open", transition_count, runs }));
    }
    if (verdicts.every((v) => v)) {
        return ok(seal({
            ...base,
            status: "open_at_end",
            tau_close_s: grid[grid.length - 1],
            open_at_end: true,
            transition_count,
            runs
        }));
    }
    if (open_count >= 2) {
        // a refusal, not a caveat: no tau_close_s, no s_close_m, no
        // reaction_budget_s — the disclosure block still rides (§4b.5, D11)
        return ok(seal({ ...base, status: "intermittent", transition_count, runs }));
    }
    // --- resolved: exactly one save band. Bisect its CLOSING edge — the band's
    // last `true` → first `false` grid pair (never the leading `false → true` of a
    // §4b.3 inside-curl prefix). For a scan that opens at τ₀ the closing edge is
    // the sole transition; the reported window is never longer than the measured
    // one (04 §4b.5).
    let k = verdicts.length - 1;
    while (k >= 0 && verdicts[k] !== true)
        k--; // band's trailing (last-true) index
    if (k + 1 >= verdicts.length) {
        // single band that reaches the horizon with no trailing `false` (an
        // inside-curl prefix followed by open-to-horizon): open_at_end in substance.
        return ok(seal({
            ...base,
            status: "open_at_end",
            tau_close_s: grid[grid.length - 1],
            open_at_end: true,
            transition_count,
            runs
        }));
    }
    let tLo = grid[k];
    let tHi = grid[k + 1];
    let s_star = stars[k] ?? null;
    for (let iter = 0; iter < HORIZON_BISECT_MAX && tHi - tLo > HORIZON_EPS_S; iter++) {
        const mid = (tLo + tHi) / 2;
        const r = saveAtInner(line, ctx, mid);
        if (!r.ok)
            return r;
        runs++;
        if (r.value.saved) {
            tLo = mid;
            s_star = r.value.s_star_m;
        }
        else {
            tHi = mid;
        }
    }
    const tau_close_s = tLo;
    const close = recordedStateAt(traj, tau_close_s, ctx.road);
    if (close === null) {
        return err(internal("saveWindow", "tau_close_s fell outside the recorded line", "savewin_close_unresolvable", {
            tau_close_s
        }));
    }
    return ok(seal({
        ...base,
        status: "resolved",
        tau_close_s,
        s_close_m: close.sample.s,
        ...(s_star !== null ? { s_star_m: s_star } : {}),
        ...scalars,
        reaction_budget_s: tau_close_s - t_earliest,
        transition_count,
        runs
    }));
}
export function saveWindow(line, cornerId, opts) {
    const scan_ds_m = opts?.scan_ds_m ?? HORIZON_SCAN_DS_M;
    if (!Number.isFinite(scan_ds_m) || scan_ds_m <= 0) {
        return err({
            code: "BAD_RANGE",
            at: "scan_ds_m",
            message: `scan_ds_m must be a positive finite length in metres, got ${String(scan_ds_m)}`,
            detail: { reason: "scan_ds_not_positive", scan_ds_m }
        });
    }
    if (cornerId !== undefined)
        return computeWindow(line, cornerId, scan_ds_m);
    const out = [];
    for (const row of line.verdict.corners) {
        const w = computeWindow(line, row.id, scan_ds_m);
        if (!w.ok)
            return w;
        out.push(w.value);
    }
    return ok(Object.freeze(out));
}
// ---------------------------------------------------------------------------
// The human summary (04 §4b.7; design/08 §7.1: "the human summary goes to
// stderr, precision-clamped where 04 §4b.5 requires it").
//
// A-SAVEWIN-PLACARD: "the placard string is present, byte-identical, on EVERY
// surface that prints a save-window scalar: HUD, CLI human summary, explain. A
// scalar printed without its placard fails." That is enforced STRUCTURALLY
// here — the placard is appended by the same function that prints the scalars,
// so no caller can print one without the other.
/** The scalar lines of one window, display-clamped; empty on a refusing status. */
export function saveWindowScalarLines(w) {
    const rows = [];
    if (w.tau_close_s !== undefined)
        rows.push(`tau_close_s ${horizonDisplay(w.tau_close_s)} s`);
    if (w.s_close_m !== undefined)
        rows.push(`s_close_m ${horizonDisplay(w.s_close_m)} m`);
    if (w.s_star_m !== undefined)
        rows.push(`s_star_m ${horizonDisplay(w.s_star_m)} m`);
    if (w.reaction_budget_s !== undefined && w.react_profile_s !== undefined) {
        rows.push(`reaction budget ${horizonDisplay(w.reaction_budget_s)} s vs react ${horizonDisplay(w.react_profile_s)} s`);
    }
    return rows;
}
/**
 * `saveWindowSummary(w)` — the CLI human summary for ONE window (stderr).
 * Disclosure first (rider / predicate / policy survive every refusal, §4b.5),
 * then the status sentence, then the display-clamped scalars, then the placard
 * verbatim.
 */
export function saveWindowSummary(w) {
    const sentence = SAVE_WINDOW_STATUS_SENTENCES[w.status].replace("N times", `${w.transition_count} times`);
    const head = `${w.line_id} · ${w.corner_id} · ${w.status} — ${sentence}`;
    const disclosure = `rider ${w.rider} · predicate ${w.predicate} · policy target_phi ${horizonDisplay(w.policy.target_phi_deg)}° ` +
        `roll ${horizonDisplay(w.policy.roll_rate_dps)}°/s a_cmd ${w.policy.a_cmd_ms2.toFixed(1)} m/s² · basis ${w.policy.basis}`;
    const scalars = saveWindowScalarLines(w);
    return [head, disclosure, ...scalars, w.placard].join("\n");
}
/** The summary for a whole line's window list, one block per corner. */
export function saveWindowSummaryAll(ws) {
    return ws.map(saveWindowSummary).join("\n\n");
}
//# sourceMappingURL=saveWindow.js.map