// viewer/hud.ts — the HUD (design/07 §3.3), and the surface `C-HUD-EQUALS-
// STATEAT` grades.
//
// THE RULE (07 §2.4, same force as the colour law): "every quantity the viewer
// displays is either a recorded field of the result envelope or the return
// value of a pure core function… The viewer performs no arithmetic on physics
// values beyond unit formatting."
//
// So this file computes NOTHING. `hudAt` makes exactly one call —
// `stateAt(input, query)`, `core/stateAt.ts`, the one implementation the
// `state` verb also calls — and every row it emits READS a member of the
// returned `InstantState` and records WHICH member in `row.path`. A test can
// therefore walk the rows and assert `get(instant, row.path) === row.value`
// for all of them, which is `C-HUD-EQUALS-STATEAT` stated mechanically rather
// than by inspection.
//
// Two consequences worth spelling out:
//   · the friction-ellipse widget draws `sample.n_long` / `sample.n_lat` — the
//     RECORDED normalized components (05 §2.1) — "precisely so the viewer does
//     not recompute them" (07 §3.3's parenthetical);
//   · `a_noreturn` shows "—" when `derived.a_noreturn_ms2` is null (07 §3.3's
//     verbatim rule), not a fabricated zero.
//
// Formatting is `toFixed` only. The locale-aware number formatters are
// forbidden in src/ (ARCHITECTURE §6.2's purity lint bans both by name) and
// would make the HUD locale-dependent, which is the exact opposite of the
// determinism law.
import { ok, err } from "../core/result.js";
import { RIDER_PROFILES } from "../core/constants.js";
import { stateAt } from "../core/stateAt.js";
import { stateInputFor } from "./session.js";
// ---------------------------------------------------------------------------
// Unit formatting (the only transformation 07 §2.4 permits)
function fixed(n, dp) {
    // -0 reads as "-0.00" through toFixed; normalize it the way the emission
    // policy does (ARCHITECTURE §6.3) so the HUD never prints a signed zero.
    return (n === 0 ? 0 : n).toFixed(dp);
}
/** Curvature's reciprocal spelling — 07 §3.3 asks for "kappa (1/m) with equivalent radius". */
function radiusText(kappa) {
    return kappa === 0 ? "straight" : `r ${fixed(1 / Math.abs(kappa), 1)} m`;
}
// ---------------------------------------------------------------------------
// Row builders — one per 07 §3.3 group, in the doc's table order
function row(group, label, text, value, path, badge) {
    return Object.freeze({
        group,
        label,
        text,
        value,
        origin: path === null ? "envelope" : "instant",
        path,
        ...(badge !== undefined ? { badge } : {})
    });
}
function profileRow(label, text, value) {
    return Object.freeze({ group: "lean", label, text, value, origin: "profile", path: null });
}
function motionRows(i) {
    return [
        row("motion", "v", `${fixed(i.derived.v_kmh, 1)} km/h`, i.derived.v_kmh, "derived.v_kmh"),
        row("motion", "psi", `${fixed(i.sample.psi, 1)}°`, i.sample.psi, "sample.psi"),
        row("motion", "kappa", `${fixed(i.sample.kappa, 4)} 1/m · ${radiusText(i.sample.kappa)}`, i.sample.kappa, "sample.kappa")
    ];
}
function leanRows(i, line) {
    const rider = line.resolved_scenario.rider;
    const cap = rider.roll_rate_cap_dps;
    const profileRate = RIDER_PROFILES[rider.profile].roll_rate_dps;
    const effective = cap === undefined ? profileRate : Math.min(profileRate, cap);
    const rows = [
        row("lean", "phi", `${fixed(i.sample.phi, 1)}°`, i.sample.phi, "sample.phi"),
        row("lean", "phi max", `${fixed(i.derived.phi_max_deg, 1)}°`, i.derived.phi_max_deg, "derived.phi_max_deg"),
        // "phi vs the rider profile's roll-rate cap" — the cap is CONFIG, not a
        // physics readout, so it carries origin "profile" and no InstantState path.
        profileRow("roll-rate cap", `${fixed(effective, 0)} °/s (${rider.profile})`, effective)
    ];
    // "a stand-up chip showing stand_up_dps, rendered only when nonzero"
    if (i.derived.stand_up_dps !== 0) {
        rows.push(row("lean", "stand up", `${fixed(i.derived.stand_up_dps, 1)} °/s`, i.derived.stand_up_dps, "derived.stand_up_dps", "stand_up"));
    }
    // 07 §3.3 verbatim: `a_noreturn` reads "brake ceiling at lean: 5.4 m/s²",
    // and "—" when upright (a_noreturn_ms2 null).
    const anr = i.derived.a_noreturn_ms2;
    rows.push(row("lean", "a_noreturn", anr === null ? "brake ceiling at lean: —" : `brake ceiling at lean: ${fixed(anr, 1)} m/s²`, anr, "derived.a_noreturn_ms2"));
    // ARCHITECTURE §10.12 pins `a_widen_ms2` as a HUD quantity at c = 1 (the
    // fighting rider). `stateAt` already applies that c — the row READS it, so
    // the pin lives in exactly one place (core/stateAt.ts's C_FIGHTING), never
    // re-applied here. Null (upright, or below the 02 §5.3 existence bound)
    // prints the same em dash `a_noreturn` does.
    const aw = i.derived.a_widen_ms2;
    rows.push(row("lean", "a_widen", aw === null ? "—" : `${fixed(aw, 1)} m/s²`, aw, "derived.a_widen_ms2"));
    return rows;
}
function gripRows(i) {
    return [
        // the ellipse widget's two axes: the RECORDED normalized components
        row("grip", "n_long", fixed(i.sample.n_long, 3), i.sample.n_long, "sample.n_long"),
        row("grip", "n_lat", fixed(i.sample.n_lat, 3), i.sample.n_lat, "sample.n_lat"),
        // "margin number = grip"
        row("grip", "grip", fixed(i.sample.grip, 3), i.sample.grip, "sample.grip"),
        row("grip", "mu", fixed(i.sample.mu, 2), i.sample.mu, "sample.mu")
    ];
}
function controlsRows(i) {
    const action = i.derived.action;
    const rows = [
        // "commanded vs delivered: cmd_a against achieved a_long, with a clip badge
        // when the ellipse limited the command"
        row("controls", "cmd_a → a_long", `${fixed(i.sample.cmd_a, 2)} → ${fixed(i.sample.a_long, 2)} m/s²`, i.sample.a_long, "sample.a_long", i.sample.clipped ? "clip" : undefined),
        row("controls", "cmd_a", `${fixed(i.sample.cmd_a, 2)} m/s²`, i.sample.cmd_a, "sample.cmd_a"),
        row("controls", "cmd_lean → phi", `${fixed(i.sample.cmd_lean, 1)}° → ${fixed(i.sample.phi, 1)}°`, i.sample.cmd_lean, "sample.cmd_lean"),
        row("controls", "roll_rate", `${fixed(i.sample.roll_rate, 1)} °/s`, i.sample.roll_rate, "sample.roll_rate"),
        row("controls", "steer_state", i.sample.steer_state, i.sample.steer_state, "sample.steer_state"),
        // "the action_id / lat_action_id of the active plan action(s), shown by id and kind"
        row("controls", "action", i.sample.action_id === null ? "—" : `${i.sample.action_id}${action === null ? "" : ` (${action.do})`}`, i.sample.action_id, "sample.action_id"),
        row("controls", "lat action", i.sample.lat_action_id ?? "—", i.sample.lat_action_id, "sample.lat_action_id")
    ];
    return rows;
}
function sightRows(i) {
    const deficit = i.sample.ssd_m > i.sample.sight_ride_m;
    return [
        // "the safety compare in rider-path metres (D16): sight_ride_m vs ssd_m"
        row("sight", "sight_ride_m", `${fixed(i.sample.sight_ride_m, 1)} m`, i.sample.sight_ride_m, "sample.sight_ride_m"),
        row("sight", "ssd_m", `${fixed(i.sample.ssd_m, 1)} m`, i.sample.ssd_m, "sample.ssd_m", deficit ? "deficit" : undefined),
        row("sight", "margin", `${fixed(i.derived.sight_margin_m, 1)} m`, i.derived.sight_margin_m, "derived.sight_margin_m"),
        // "sight_m alongside (centreline basis — the cross-line-comparable number
        // and the trend's source)"
        row("sight", "sight_m", `${fixed(i.sample.sight_m, 1)} m`, i.sample.sight_m, "sample.sight_m"),
        row("sight", "trend", i.derived.sight_trend, i.derived.sight_trend, "derived.sight_trend")
    ];
}
function verdictRows(i, line) {
    const rows = [
        row("verdict", "role", line.role, line.role, null),
        row("verdict", "outcome", line.verdict.outcome, line.verdict.outcome, null),
        row("verdict", "phase", i.derived.phase, i.derived.phase, "derived.phase"),
        row("verdict", "corner", i.derived.corner_id ?? "—", i.derived.corner_id, "derived.corner_id")
    ];
    // "when the cursor crosses a check's evidence station — the relevant
    // doctrine check id". The evidence station is the check's own `at_s`
    // (plan/doctrine/types.ts `CheckEvidence`); "crossing" is resolved against
    // the bracket the cursor currently sits in, so the id shows for exactly the
    // one step that contains it.
    const lo = line.trajectory.samples[i.at.i0]?.s ?? i.sample.s;
    const hi = line.trajectory.samples[i.at.i1]?.s ?? i.sample.s;
    for (const c of line.verdict.doctrine.checks) {
        const at = c.evidence.at_s;
        if (at !== undefined && at >= Math.min(lo, hi) && at <= Math.max(lo, hi)) {
            rows.push(row("verdict", "check", `${c.id} · ${c.verdict}`, c.id, null));
        }
    }
    return rows;
}
// ---------------------------------------------------------------------------
// The HUD refresh
/**
 * `hudRowsOf(instant, line)` — 07 §3.3's six groups, in the doc's table order,
 * over an already-queried instant. Split out from `hudAt` so a caller holding
 * an `InstantState` from anywhere (including a `linelab state` document parsed
 * back in) gets byte-identical rows.
 */
export function hudRowsOf(instant, line) {
    return Object.freeze([
        ...motionRows(instant),
        ...leanRows(instant, line),
        ...gripRows(instant),
        ...controlsRows(instant),
        ...sightRows(instant),
        ...verdictRows(instant, line)
    ]);
}
/**
 * `hudAt(session, lineId, query)` — one HUD refresh. Exactly one physics call
 * (`stateAt`), and it is the same call, on the same input, that
 * `linelab state --line <id> --s <m>` makes: `C-HUD-EQUALS-STATEAT`.
 * A beyond-domain query returns `stateAt`'s own `BAD_RANGE` untouched — the
 * viewer never silently clamps (05 §4).
 */
export function hudAt(session, lineId, query) {
    const line = session.lines.find((l) => l.line_id === lineId);
    if (line === undefined) {
        const available = session.lines.map((l) => l.line_id);
        return err({
            code: "UNKNOWN_ID",
            at: "line",
            message: `unknown line "${lineId}" (available: ${available.join(", ")})`,
            detail: { reason: "unknown_line_id", available }
        });
    }
    const resolved = stateAt(stateInputFor(session, line), query);
    if (!resolved.ok)
        return resolved;
    return ok(Object.freeze({ line_id: lineId, instant: resolved.value, rows: hudRowsOf(resolved.value, line) }));
}
/**
 * The `C-HUD-EQUALS-STATEAT` reader: resolve a row's declared `path` against
 * the `InstantState` it claims to have read. Exported so the gate test asserts
 * the law with the viewer's own accessor rather than a second path walker.
 */
export function instantValueAt(instant, path) {
    let cursor = instant;
    for (const key of path.split(".")) {
        if (typeof cursor !== "object" || cursor === null)
            return undefined;
        cursor = cursor[key];
    }
    return cursor;
}
//# sourceMappingURL=hud.js.map