// cli/args.ts — the flag table (bijective with `schema cli`, design/08 §4.1,
// §5.1) and the flag-over-file merge law (§4.2): "a flag always overrides the
// same-named field of a loaded file." Pure and synchronous — no IO; main.ts
// reads argv/files and hands the raw string arrays here.
//
// ONE table (`FLAG_TABLE`) is the single source for both the runtime parser
// (`parseZeroFileFlags`) and the printed `schema cli` section
// (`cli/doc/schema.ts` imports `FLAG_TABLE` directly) — the bijection test
// (`A-FLAG-MAP`) holds by construction, not by hand-kept sync.
//
// Deferred flags (`--commitment`, `--prior`, `--jitter*`, `--look`) are
// recognized and rejected the instant they are seen, before any other flag's
// value is parsed or validated (ARCHITECTURE §10 pin #19's verb-level rule,
// extended here to flag-level so a deferred flag's message is reachable even
// behind a malformed later flag). `--standing` SHIPPED with the D43 ladder
// (check --standing), and `--s`/`--t`/`--scan-ds` SHIPPED with the v0.2
// `state`/`save-window` verbs (design/08 §3, §4.1): all parse here as
// verb-shared fields; a verb that doesn't consume one rejects it INEFFECTUAL
// in main.ts — nothing is accepted-and-ignored (D8).
import { ok, err } from "../core/result.js";
import { RIDER_PROFILE_NAMES } from "../core/types.js";
import { parseRoadDSL, printRoadDSL } from "../road/dsl.js";
import { parseMistakeToken } from "../plan/mistakes.js";
import { parseOccluderOrHazardToken } from "../plan/placements.js";
import { SOLVE_STYLES, VIS_MODES, ACCEPT_POLICIES, CONSTRAINT_BOUNDS } from "../plan/figure.js";
import { deferredError, deferredFor, tombstoneError, tombstoneFor } from "./deferred.js";
// ---------------------------------------------------------------------------
// Error builders (this file's own convention, ARCHITECTURE §4)
function schemaErr(at, message, reason, detail) {
    return { code: "SCHEMA", at, message, detail: { reason, ...detail } };
}
function badRange(at, message, reason, detail) {
    return { code: "BAD_RANGE", at, message, detail: { reason, ...detail } };
}
function emptyDraft() {
    return { mistakes: [] };
}
// -- individual flag appliers -------------------------------------------------
function parseNum(value, at) {
    const n = Number(value);
    if (!Number.isFinite(n))
        return err(schemaErr(at, `expected a number, got "${value}"`, "cli_number_malformed"));
    return ok(n);
}
/** `<road DSL> | preset <name> [hand=L|R] | <bare preset name>` (design/08 §4.1). */
function parseRoadRefFlag(value, at) {
    const tokens = value.trim().split(/\s+/).filter((t) => t.length > 0);
    const first = tokens[0];
    if (first === undefined)
        return err(schemaErr(at, "empty road reference", "road_ref_missing"));
    if (first === "preset") {
        const name = tokens[1];
        if (name === undefined)
            return err(schemaErr(at, '"preset" needs a name', "road_ref_preset_name_missing"));
        const hand = tokens[2];
        if (hand !== undefined) {
            const m = /^hand=([LR])$/.exec(hand);
            if (m === null)
                return err(schemaErr(at, `malformed road option "${hand}"`, "road_ref_option_malformed"));
            return ok({ preset: name, hand: m[1] });
        }
        return ok({ preset: name });
    }
    if (tokens.length === 1 && first !== "lane") {
        return ok({ preset: first });
    }
    for (const tok of tokens) {
        if (/^hand=/.test(tok)) {
            return err(schemaErr(at, `hand="${tok.slice(5)}" is rejected with the DSL road form`, "hand_on_explicit_road"));
        }
    }
    const parsed = parseRoadDSL(tokens.join(" "));
    if (!parsed.ok)
        return err({ ...parsed.error, at });
    return ok({ dsl: printRoadDSL(parsed.value) });
}
function parseConstraintFlag(value, at) {
    const TOKEN_RE = /^(f|v_kmh|sight_margin_m)(>=|<=)([^@]+)@(.+)$/;
    const m = TOKEN_RE.exec(value.trim());
    if (m === null)
        return err(schemaErr(at, `malformed constraint token "${value}"`, "constraint_token_malformed"));
    const [, field, op, valueStr, spanStr] = m;
    let bound;
    if (field === "f" && op === ">=")
        bound = "f_min";
    else if (field === "f" && op === "<=")
        bound = "f_max";
    else if (field === "v_kmh" && op === "<=")
        bound = "v_max_kmh";
    else if (field === "sight_margin_m" && op === ">=")
        bound = "sight_margin_min_m";
    else
        return err(schemaErr(at, `"${field}${op}" has no bound in the closed set`, "constraint_bound_unknown"));
    if (!CONSTRAINT_BOUNDS.includes(bound)) {
        return err(schemaErr(at, "unreachable bound", "constraint_bound_unknown"));
    }
    const n = parseNum(valueStr, at);
    if (!n.ok)
        return n;
    const ddIdx = spanStr.indexOf("..");
    const span = ddIdx === -1 ? { at: spanStr } : { from: spanStr.slice(0, ddIdx), to: spanStr.slice(ddIdx + 2) };
    return ok({ id: mintActionId("cli_c"), span, bound, value: n.value });
}
let planActionCounter = 0;
function mintActionId(prefix) {
    planActionCounter += 1;
    return `${prefix}${planActionCounter}`;
}
// ---------------------------------------------------------------------------
// The table
export const FLAG_TABLE = [
    {
        field: "road", scene_key: "road", flag: "--road", arity: "value", group: "Road & world",
        apply: (d, v, at) => {
            const r = parseRoadRefFlag(v, at);
            if (!r.ok)
                return r;
            d.road = r.value;
            return ok(undefined);
        }
    },
    {
        field: "use_full_width", scene_key: "fullWidth", flag: "--use-full-width", arity: "boolean", group: "Road & world",
        apply: (d) => { d.use_full_width = true; return ok(undefined); }
    },
    {
        field: "bike_margin_m", scene_key: "bikeMargin", flag: "--bike-margin", arity: "value", group: "Road & world",
        apply: (d, v, at) => { const n = parseNum(v, at); if (!n.ok)
            return n; d.bike_margin_m = n.value; return ok(undefined); }
    },
    {
        field: "mu", scene_key: "", flag: "--mu", arity: "value", group: "Road & world",
        apply: (d, v, at) => {
            const n = parseNum(v, at);
            if (!n.ok)
                return n;
            if (!(n.value > 0))
                return err(badRange(at, "mu must be positive", "mu_nonpositive"));
            d.mu = n.value;
            return ok(undefined);
        }
    },
    {
        field: "occluders[]", scene_key: "occluders", flag: "--occluder", arity: "repeatable", group: "Road & world",
        apply: (d, v, at) => {
            const p = parseOccluderOrHazardToken(v, at);
            if (!p.ok)
                return p;
            if (p.value.occluder === undefined) {
                return err(schemaErr(at, "a gravel token belongs to --hazard, not --occluder", "occluder_token_kind_mismatch"));
            }
            d.occluders = [...(d.occluders ?? []), p.value.occluder];
            return ok(undefined);
        }
    },
    {
        field: "hazards[]", scene_key: "hazards", flag: "--hazard", arity: "repeatable", group: "Road & world",
        apply: (d, v, at) => {
            const p = parseOccluderOrHazardToken(v, at);
            if (!p.ok)
                return p;
            if (p.value.hazard === undefined) {
                return err(schemaErr(at, "only a gravel token belongs to --hazard", "hazard_token_kind_mismatch"));
            }
            d.hazards = [...(d.hazards ?? []), p.value.hazard];
            return ok(undefined);
        }
    },
    {
        field: "entry_kmh", scene_key: "entry", flag: "--entry", arity: "value", group: "Rider & start",
        apply: (d, v, at) => {
            const n = parseNum(v, at);
            if (!n.ok)
                return n;
            if (!(n.value > 0))
                return err(badRange(at, "entry must be positive", "entry_kmh_nonpositive"));
            d.entry_kmh = n.value;
            return ok(undefined);
        }
    },
    {
        field: "start_f", scene_key: "startF", flag: "--start-f", arity: "value", group: "Rider & start",
        apply: (d, v, at) => { const n = parseNum(v, at); if (!n.ok)
            return n; d.start_f = n.value; return ok(undefined); }
    },
    {
        field: "profile", scene_key: "", flag: "--profile", arity: "value", group: "Rider & start",
        apply: (d, v, at) => {
            if (!RIDER_PROFILE_NAMES.includes(v)) {
                return err(schemaErr(at, `profile must be one of ${RIDER_PROFILE_NAMES.join(", ")}`, "profile_unknown"));
            }
            d.profile = v;
            return ok(undefined);
        }
    },
    {
        field: "roll_rate_cap_dps", scene_key: "", flag: "--roll-rate-cap", arity: "value", group: "Rider & start",
        apply: (d, v, at) => { const n = parseNum(v, at); if (!n.ok)
            return n; d.roll_rate_cap_dps = n.value; return ok(undefined); }
    },
    {
        field: "turn_in", scene_key: "turnIn", flag: "--turn-in", arity: "value", group: "Plan channels",
        apply: (d, v, at) => {
            if (v === "auto") {
                d.turn_in = "auto";
                return ok(undefined);
            }
            const n = parseNum(v, at);
            if (!n.ok)
                return n;
            d.turn_in = n.value;
            return ok(undefined);
        }
    },
    {
        field: "plan[].brake.decel", scene_key: "", flag: "--brake", arity: "value", group: "Plan channels",
        apply: (d, v, at) => {
            if (v === "auto")
                return ok(undefined); // "auto" == no authored pin (the solver's default)
            const n = parseNum(v, at);
            if (!n.ok)
                return n;
            if (!(n.value > 0))
                return err(badRange(at, "brake decel must be positive", "decel_nonpositive"));
            d.plan = [...(d.plan ?? []), { do: "brake", id: mintActionId("b"), decel: n.value, at_s: 0 }];
            return ok(undefined);
        }
    },
    {
        field: "plan[].brake.slew_mss", scene_key: "", flag: "--brake-slew", arity: "value", group: "Plan channels",
        apply: (d, v, at) => {
            const n = parseNum(v, at);
            if (!n.ok)
                return n;
            const plan = d.plan ?? [];
            const idx = plan.findIndex((a) => a.do === "brake");
            if (idx < 0)
                return err(schemaErr(at, "--brake-slew needs a preceding --brake", "brake_slew_without_brake"));
            const b = plan[idx];
            d.plan = plan.map((a, i) => (i === idx ? { ...b, slew_mss: n.value } : a));
            return ok(undefined);
        }
    },
    {
        field: "plan[].throttle.accel", scene_key: "", flag: "--throttle", arity: "value", group: "Plan channels",
        apply: (d, v, at) => {
            const n = parseNum(v, at);
            if (!n.ok)
                return n;
            if (n.value < 0)
                return err(badRange(at, "throttle accel must be >= 0", "accel_negative"));
            d.plan = [...(d.plan ?? []), { do: "throttle", id: mintActionId("t"), accel: n.value, at_s: 0 }];
            return ok(undefined);
        }
    },
    {
        field: "plan[].throttle.slew_mss", scene_key: "", flag: "--throttle-slew", arity: "value", group: "Plan channels",
        apply: (d, v, at) => {
            const n = parseNum(v, at);
            if (!n.ok)
                return n;
            const plan = d.plan ?? [];
            const idx = plan.findIndex((a) => a.do === "throttle");
            if (idx < 0)
                return err(schemaErr(at, "--throttle-slew needs a preceding --throttle", "throttle_slew_without_throttle"));
            const th = plan[idx];
            d.plan = plan.map((a, i) => (i === idx ? { ...th, slew_mss: n.value } : a));
            return ok(undefined);
        }
    },
    {
        field: "plan[].throttle.freeze_steer_s", scene_key: "", flag: "--throttle-freeze", arity: "value", group: "Plan channels",
        apply: (d, v, at) => {
            const n = parseNum(v, at);
            if (!n.ok)
                return n;
            const plan = d.plan ?? [];
            const idx = plan.findIndex((a) => a.do === "throttle");
            if (idx < 0)
                return err(schemaErr(at, "--throttle-freeze needs a preceding --throttle", "throttle_freeze_without_throttle"));
            const th = plan[idx];
            d.plan = plan.map((a, i) => (i === idx ? { ...th, freeze_steer_s: n.value } : a));
            return ok(undefined);
        }
    },
    {
        field: "plan[].position", scene_key: "", flag: "--position", arity: "value", group: "Plan channels",
        apply: (d, v, at) => {
            const kv = {};
            for (const tok of v.split(",").map((t) => t.trim()).filter((t) => t.length > 0)) {
                const eq = tok.indexOf("=");
                if (eq <= 0)
                    return err(schemaErr(at, `malformed --position token "${tok}"`, "position_token_malformed"));
                kv[tok.slice(0, eq)] = tok.slice(eq + 1);
            }
            const f = kv["f"] !== undefined ? Number(kv["f"]) : undefined;
            const dd = kv["d"] !== undefined ? Number(kv["d"]) : undefined;
            const overRaw = kv["over"];
            const over_m = overRaw === undefined ? undefined : overRaw === "auto" ? "auto" : Number(overRaw);
            d.plan = [
                ...(d.plan ?? []),
                {
                    do: "position",
                    id: mintActionId("p"),
                    at_s: 0,
                    ...(f !== undefined ? { f } : {}),
                    ...(dd !== undefined ? { d: dd } : {}),
                    ...(over_m !== undefined ? { over_m } : {})
                }
            ];
            return ok(undefined);
        }
    },
    {
        field: "style", scene_key: "style", flag: "--style", arity: "value", group: "Solver intent",
        apply: (d, v, at) => {
            if (!SOLVE_STYLES.includes(v)) {
                return err(schemaErr(at, `style must be one of ${SOLVE_STYLES.join(", ")}`, "style_unknown"));
            }
            d.style = v;
            return ok(undefined);
        }
    },
    {
        field: "vis", scene_key: "vis", flag: "--vis", sugar: "--visibility-governed", arity: "value", group: "Solver intent",
        apply: (d, v, at) => {
            if (!VIS_MODES.includes(v)) {
                return err(schemaErr(at, `vis must be one of ${VIS_MODES.join(", ")}`, "vis_unknown"));
            }
            d.vis = v;
            return ok(undefined);
        }
    },
    {
        field: "vis_hold_f", scene_key: "visHold", flag: "--vis-hold", arity: "value", group: "Solver intent",
        apply: (d, v, at) => { const n = parseNum(v, at); if (!n.ok)
            return n; d.vis_hold_f = n.value; return ok(undefined); }
    },
    {
        field: "vis_margin", scene_key: "visMargin", flag: "--vis-margin", arity: "value", group: "Solver intent",
        apply: (d, v, at) => { const n = parseNum(v, at); if (!n.ok)
            return n; d.vis_margin = n.value; return ok(undefined); }
    },
    {
        field: "constraints[]", scene_key: "constraints", flag: "--constraint", arity: "repeatable", group: "Solver intent",
        apply: (d, v, at) => {
            const c = parseConstraintFlag(v, at);
            if (!c.ok)
                return c;
            d.constraints = [...(d.constraints ?? []), c.value];
            return ok(undefined);
        }
    },
    {
        field: "believed_road", scene_key: "believeRoad", flag: "--believe-road", arity: "value", group: "Solver intent",
        apply: (d, v, at) => {
            const r = parseRoadRefFlag(v, at);
            if (!r.ok)
                return r;
            d.believed_road = r.value;
            return ok(undefined);
        }
    },
    {
        field: "accept", scene_key: "accept", flag: "--accept", arity: "value", group: "Solver intent",
        apply: (d, v, at) => {
            if (!ACCEPT_POLICIES.includes(v)) {
                return err(schemaErr(at, `accept must be one of ${ACCEPT_POLICIES.join(", ")}`, "accept_unknown"));
            }
            d.accept = v;
            return ok(undefined);
        }
    },
    {
        field: "mistake", scene_key: "", flag: "--mistake", arity: "repeatable", group: "Lines & mistakes",
        apply: (d, v, at) => {
            if (v === "early_apex") {
                const row = tombstoneFor("early_apex");
                return err(tombstoneError(at, row));
            }
            const m = parseMistakeToken(v, at);
            if (!m.ok)
                return m;
            d.mistakes.push(m.value);
            return ok(undefined);
        }
    },
    {
        field: "line_id", scene_key: "", flag: "--line-id", arity: "value", group: "Lines & mistakes",
        apply: (d, v) => { d.line_id = v; return ok(undefined); }
    },
    {
        field: "marks", scene_key: "marks", flag: "--marks", arity: "value", group: "View",
        apply: (d, v) => { d.marks = v; return ok(undefined); }
    },
    {
        field: "view.rays", scene_key: "view.rays", flag: "--rays", arity: "value", group: "View",
        apply: (d, v, at) => {
            if (v !== "auto" && v !== "off" && v !== "all_turn_ins") {
                return err(schemaErr(at, 'rays must be "auto", "off", or "all_turn_ins"', "rays_unknown"));
            }
            d.view = { ...(d.view ?? {}), rays: v };
            return ok(undefined);
        }
    },
    {
        field: "view.legend", scene_key: "view.legend", flag: "--legend", arity: "value", group: "View",
        apply: (d, v, at) => {
            if (v !== "auto" && v !== "on" && v !== "off") {
                return err(schemaErr(at, 'legend must be "auto", "on", or "off"', "legend_unknown"));
            }
            d.view = { ...(d.view ?? {}), legend: v };
            return ok(undefined);
        }
    },
    {
        field: "view.orient", scene_key: "view.orient", flag: "--orient", arity: "value", group: "View",
        apply: (d, v, at) => {
            if (v !== "auto" && v !== "0" && v !== "90" && v !== "180" && v !== "270") {
                return err(schemaErr(at, 'orient must be "auto", 0, 90, 180, or 270', "orient_unknown"));
            }
            d.view = { ...(d.view ?? {}), orient: v };
            return ok(undefined);
        }
    },
    {
        // design/08 §4.1 View flag group + design/06 §2.1: `--look <heading|limit_point>`
        // is the ViewSpec `look` camera toggle for the `pov` render target (design/07
        // §5.2). It SHIPS in v0.3 immersion — a closed-set violation is a plain
        // `SCHEMA`, never a `deferred` (the token left the deferred table when pov
        // shipped). `render/index.ts`'s pov path reads `viewSpec.look`.
        field: "view.look", scene_key: "view.look", flag: "--look", arity: "value", group: "View",
        apply: (d, v, at) => {
            if (v !== "heading" && v !== "limit_point") {
                return err(schemaErr(at, 'look must be "heading" or "limit_point"', "look_unknown"));
            }
            d.view = { ...(d.view ?? {}), look: v };
            return ok(undefined);
        }
    },
    {
        field: "config.rubric", scene_key: "", flag: "--rubric", arity: "value", group: "Config",
        apply: (d, v, at) => {
            if (v !== "parks-street") {
                return err(schemaErr(at, `--rubric's sole legal value is "parks-street" (got "${v}")`, "rubric_unknown_value"));
            }
            d.rubric = v;
            return ok(undefined);
        }
    },
    {
        field: "config.checks_version", scene_key: "", flag: "--checks-version", arity: "value", group: "Config",
        apply: (d, v, at) => {
            if (v !== "2") {
                return err(schemaErr(at, `--checks-version's sole legal value is 2 (got "${v}")`, "checks_version_unknown_value"));
            }
            d.checks_version = 2;
            return ok(undefined);
        }
    }
];
/** `schema cli`'s printed table (design/08 §5.1) — the plain FlagMapping projection. */
export const FLAG_MAPPINGS = FLAG_TABLE.map((f) => ({
    field: f.field,
    scene_key: f.scene_key,
    flag: f.flag,
    ...(f.sugar !== undefined ? { sugar: f.sugar } : {})
}));
const FLAG_BY_NAME = new Map();
for (const f of FLAG_TABLE) {
    FLAG_BY_NAME.set(f.flag, f);
    if (f.sugar !== undefined)
        FLAG_BY_NAME.set(f.sugar, f);
}
// ---------------------------------------------------------------------------
// Deferred / general-purpose flags NOT part of the zero-file composition
// surface (out-of-hash analysis knobs, all deferred in v0.1; view.look is
// immersion-deferred too) — recognized so their rejection carries the right
// `deferred` phase rather than falling through to "unknown flag".
const DEFERRED_FLAG_NAMES = new Set([
    "--commitment", "--prior",
    "--jitter", "--jitter-seed", "--jitter-spread"
]);
/**
 * 00-README §5's CLOSED view vocabulary, as `--views` spells it. `pov` is a
 * legal NAME here and a phase-gated TARGET downstream (render/index.ts's one
 * deferral) — parsing and phase gating stay separate concerns.
 */
export const CLI_VIEWS = ["topdown", "controls", "pov"];
/**
 * design/08 §3's per-verb syntax, machine-readable: which verb(s) each
 * VERB-SCOPED flag is effectual on. ARCHITECTURE §6.4: "Nothing is ever
 * accepted-and-ignored" — a flag named on a verb that does not consume it is
 * `INEFFECTUAL`, naming the dead field (D8), exactly as `--standing` and
 * `--scan-ds` already are. Verb-agnostic controls (`--out`, `--line`,
 * `--pretty`, …) are deliberately absent: they are effectual everywhere they
 * parse.
 */
export const VERB_SCOPED_FLAGS = [
    { flag: "--s", verbs: ["state", "render"] }, // `state` query; `render --views controls` cursor
    { flag: "--t", verbs: ["state"] },
    { flag: "--corner", verbs: ["save-window"] },
    { flag: "--scan-ds", verbs: ["save-window"] },
    { flag: "--standing", verbs: ["check"] },
    { flag: "--port", verbs: ["serve"] },
    { flag: "--views", verbs: ["render"] },
    { flag: "--param", verbs: ["sweep"] },
    { flag: "--param2", verbs: ["sweep"] },
    { flag: "--range", verbs: ["sweep"] },
    { flag: "--range2", verbs: ["sweep"] },
    { flag: "--metric", verbs: ["sweep"] },
    { flag: "--format", verbs: ["sweep"] },
    { flag: "--lock", verbs: ["compare"] }
];
/**
 * `ineffectualFlagFor(verb, parsed)` — the D8 verb-scope check, pure so the
 * effectuality harness can enumerate it without spawning a process. Returns the
 * typed `INEFFECTUAL` error for the FIRST verb-scoped flag the invocation named
 * that this verb does not consume, or null when every named flag bites.
 *
 * The two long-standing reason spellings (`standing_without_check`,
 * `scan_ds_without_save_window`) are preserved; every other flag reports
 * `flag_not_effectual_on_verb` with `effectual_on` naming the live verb set.
 */
export function ineffectualFlagFor(verb, parsed) {
    const named = {
        "--s": parsed.s,
        "--t": parsed.t,
        "--corner": parsed.corner,
        "--scan-ds": parsed.scanDs,
        "--standing": parsed.standing ? true : undefined,
        "--port": parsed.port,
        "--views": parsed.views,
        "--param": parsed.param,
        "--param2": parsed.param2,
        "--range": parsed.range,
        "--range2": parsed.range2,
        "--metric": parsed.metric,
        "--format": parsed.format,
        "--lock": parsed.lock
    };
    const legacyReason = {
        "--standing": "standing_without_check",
        "--scan-ds": "scan_ds_without_save_window"
    };
    for (const row of VERB_SCOPED_FLAGS) {
        if (named[row.flag] === undefined)
            continue;
        if (row.verbs.includes(verb))
            continue;
        return {
            code: "INEFFECTUAL",
            at: row.flag,
            message: `${row.flag} does nothing on "${verb}" — it is ${row.verbs.map((v) => `\`${v}\``).join(" / ")} syntax (design/08 §3)`,
            detail: {
                reason: legacyReason[row.flag] ?? "flag_not_effectual_on_verb",
                verb,
                effectual_on: row.verbs
            }
        };
    }
    return null;
}
const VALUE_ONLY_FLAGS = new Set([
    "--out", "--trace", "--views", "--mode", "--as", "--line", "--on", "--corner",
    "--s", "--t", "--scan-ds", "--lock",
    "--param", "--param2", "--range", "--range2", "--metric", "--format", "--port"
]);
const BOOLEAN_ONLY_FLAGS = new Set(["--gate", "--suggest", "--check", "--all", "--no-cache", "--pretty", "--quiet", "--standing"]);
/**
 * Parses one verb's remaining argv into a `ComposeDraft` plus the
 * verb-agnostic controls every verb may accept. Deferred flags reject
 * immediately, before any other flag's value is inspected (see file banner).
 */
export function parseZeroFileFlags(argv) {
    const draft = emptyDraft();
    const positional = [];
    let gate = false;
    let out;
    let trace;
    let suggest = false;
    let check = false;
    let views;
    let mode;
    let as;
    let all = false;
    let noCache = false;
    let line;
    let pretty = false;
    let quiet = false;
    let standing = false;
    let on;
    let corner;
    let s;
    let t;
    let scanDs;
    let param;
    let param2;
    let range;
    let range2;
    let metric;
    let format;
    let port;
    let lock;
    // pass 1: reject any deferred flag on sight, wherever it lands (§10 pin #19 extended)
    for (const tok of argv) {
        if (DEFERRED_FLAG_NAMES.has(tok)) {
            const deferred = deferredFor(tok);
            if (deferred !== undefined)
                return err(deferredError("cli", tok, deferred));
        }
    }
    for (let i = 0; i < argv.length; i++) {
        const tok = argv[i];
        if (!tok.startsWith("--")) {
            // "-" (stdin sentinel) and any other non-flag token are both positional.
            positional.push(tok);
            continue;
        }
        if (tok === "--gate") {
            gate = true;
            continue;
        }
        if (tok === "--suggest") {
            suggest = true;
            continue;
        }
        if (tok === "--check") {
            check = true;
            continue;
        }
        if (tok === "--all") {
            all = true;
            continue;
        }
        if (tok === "--no-cache") {
            noCache = true;
            continue;
        }
        if (tok === "--pretty") {
            pretty = true;
            continue;
        }
        if (tok === "--quiet") {
            quiet = true;
            continue;
        }
        if (tok === "--standing") {
            standing = true;
            continue;
        }
        if (VALUE_ONLY_FLAGS.has(tok)) {
            const v = argv[++i];
            if (v === undefined)
                return err(schemaErr(tok, `${tok} needs a value`, "flag_value_missing"));
            if (tok === "--out")
                out = v;
            else if (tok === "--trace")
                trace = v;
            else if (tok === "--views") {
                // 00 §5's view vocabulary is CLOSED — `topdown | controls | pov`.
                // Before this check an unknown token was accepted and silently dropped,
                // which is exactly the accepted-and-ignored shape ARCHITECTURE §6.4
                // forbids. `pov` parses here and is refused (deferred) by the render
                // layer, so the phase gate stays in exactly one place.
                const named = v.split(",").map((x) => x.trim()).filter((x) => x.length > 0);
                const bad = named.find((x) => !CLI_VIEWS.includes(x));
                if (bad !== undefined) {
                    return err(schemaErr(tok, `unknown view "${bad}" — the closed set is ${CLI_VIEWS.join(" | ")}`, "view_unknown", {
                        views: CLI_VIEWS
                    }));
                }
                if (named.length === 0) {
                    return err({
                        code: "INEFFECTUAL",
                        at: tok,
                        message: "--views named no view",
                        detail: { reason: "views_empty" }
                    });
                }
                views = named;
            }
            else if (tok === "--mode") {
                if (v !== "true" && v !== "diagram")
                    return err(schemaErr(tok, '--mode must be "true" or "diagram"', "mode_unknown"));
                mode = v;
            }
            else if (tok === "--as")
                as = v;
            else if (tok === "--line")
                line = v;
            else if (tok === "--on")
                on = v;
            else if (tok === "--corner")
                corner = v;
            else if (tok === "--s") {
                const n = parseNum(v, tok);
                if (!n.ok)
                    return n;
                s = n.value;
            }
            else if (tok === "--t") {
                const n = parseNum(v, tok);
                if (!n.ok)
                    return n;
                t = n.value;
            }
            else if (tok === "--scan-ds") {
                const n = parseNum(v, tok);
                if (!n.ok)
                    return n;
                scanDs = n.value;
            }
            else if (tok === "--param")
                param = v;
            else if (tok === "--param2")
                param2 = v;
            else if (tok === "--range")
                range = v;
            else if (tok === "--range2")
                range2 = v;
            else if (tok === "--metric")
                metric = v;
            else if (tok === "--format") {
                if (v !== "tsv" && v !== "json")
                    return err(schemaErr(tok, '--format must be "tsv" or "json"', "format_unknown"));
                format = v;
            }
            else if (tok === "--port") {
                const n = parseNum(v, tok);
                if (!n.ok)
                    return n;
                port = n.value;
            }
            else if (tok === "--lock") {
                // design/07 §3.7 / design/08 §3.5 — closed 2-value set, `station` default
                if (v !== "station" && v !== "time")
                    return err(schemaErr(tok, '--lock must be "station" or "time"', "lock_unknown"));
                lock = v;
            }
            continue;
        }
        const spec = FLAG_BY_NAME.get(tok);
        if (spec === undefined) {
            return err(schemaErr(tok, `unknown flag "${tok}"`, "unknown_flag", { flag: tok }));
        }
        if (spec.arity === "boolean") {
            const r = spec.apply(draft, "true", tok);
            if (!r.ok)
                return r;
            continue;
        }
        const v = argv[++i];
        if (v === undefined)
            return err(schemaErr(tok, `${tok} needs a value`, "flag_value_missing"));
        const r = spec.apply(draft, v, tok);
        if (!r.ok)
            return r;
    }
    return ok({
        draft, positional, gate, suggest, check, all, noCache, pretty, quiet, standing,
        ...(out !== undefined ? { out } : {}),
        ...(trace !== undefined ? { trace } : {}),
        ...(views !== undefined ? { views } : {}),
        ...(mode !== undefined ? { mode } : {}),
        ...(as !== undefined ? { as } : {}),
        ...(line !== undefined ? { line } : {}),
        ...(on !== undefined ? { on } : {}),
        ...(corner !== undefined ? { corner } : {}),
        ...(s !== undefined ? { s } : {}),
        ...(t !== undefined ? { t } : {}),
        ...(scanDs !== undefined ? { scanDs } : {}),
        ...(param !== undefined ? { param } : {}),
        ...(param2 !== undefined ? { param2 } : {}),
        ...(range !== undefined ? { range } : {}),
        ...(range2 !== undefined ? { range2 } : {}),
        ...(metric !== undefined ? { metric } : {}),
        ...(format !== undefined ? { format } : {}),
        ...(port !== undefined ? { port } : {}),
        ...(lock !== undefined ? { lock } : {})
    });
}
// ---------------------------------------------------------------------------
// Draft → wire composition (design/08 §4.2's precedence: start from file/empty,
// flags override same-named fields, validate the composed whole downstream).
/** Builds the zero-file `SolveInput`-shaped object `run()`/`solve()` sniff on `entry_kmh`. */
export function draftToComposedInput(draft) {
    const mistake = draft.mistakes.length === 1
        ? {
            kind: draft.mistakes[0].kind,
            ...(draft.mistakes[0].params !== undefined ? { params: draft.mistakes[0].params } : {}),
            ...(draft.mistakes[0].scope !== undefined ? { scope: draft.mistakes[0].scope } : {})
        }
        : undefined;
    return {
        ...(draft.road !== undefined ? { road: withRoadOptions(draft) } : {}),
        ...(draft.entry_kmh !== undefined ? { entry_kmh: draft.entry_kmh } : {}),
        ...(draft.profile !== undefined ? { profile: draft.profile } : {}),
        ...(draft.mu !== undefined ? { mu: draft.mu } : {}),
        ...(draft.turn_in !== undefined ? { turn_in: draft.turn_in } : {}),
        ...(draft.style !== undefined ? { style: draft.style } : {}),
        ...(draft.vis !== undefined ? { vis: draft.vis } : {}),
        ...(draft.vis_hold_f !== undefined ? { vis_hold_f: draft.vis_hold_f } : {}),
        ...(draft.vis_margin !== undefined ? { vis_margin: draft.vis_margin } : {}),
        ...(draft.believed_road !== undefined ? { believed_road: draft.believed_road } : {}),
        ...(draft.accept !== undefined ? { accept: draft.accept } : {}),
        ...(draft.start_f !== undefined ? { start_f: draft.start_f } : {}),
        ...(draft.roll_rate_cap_dps !== undefined ? { roll_rate_cap_dps: draft.roll_rate_cap_dps } : {}),
        ...(draft.constraints !== undefined ? { constraints: draft.constraints } : {}),
        ...(draft.occluders !== undefined ? { occluders: draft.occluders } : {}),
        ...(draft.hazards !== undefined ? { hazards: draft.hazards } : {}),
        ...(draft.plan !== undefined ? { plan: draft.plan } : {}),
        ...(mistake !== undefined ? { mistake } : {}),
        // --line-id names the primary authored line of a composed input
        // (design/08 §4.1); solve/run.ts's composed path consumes it OUTSIDE the
        // solver spec (line_id lives outside every hash, 05 §8.3).
        ...(draft.line_id !== undefined ? { line_id: draft.line_id } : {})
    };
}
function withRoadOptions(draft) {
    const road = draft.road;
    const tail = {
        ...(draft.use_full_width !== undefined ? { use_full_width: draft.use_full_width } : {}),
        ...(draft.bike_margin_m !== undefined ? { bike_margin_m: draft.bike_margin_m } : {})
    };
    return { ...road, ...tail };
}
/**
 * The flag-over-file merge law (design/08 §4.2): shallow-merges the draft's
 * SET fields on top of an already-loaded JSON object, field by field —
 * "a flag always overrides the corresponding loaded field." When no file was
 * loaded, this degrades to `draftToComposedInput`.
 */
export function mergeDraftOverLoaded(loaded, draft) {
    const composed = draftToComposedInput(draft);
    if (loaded === undefined || loaded === null || typeof loaded !== "object" || Array.isArray(loaded)) {
        return composed;
    }
    const base = loaded;
    // Scenario file: flags land inside rider.start / rider / config / road.
    if ("rider" in base) {
        const rider = base["rider"] ?? {};
        const start = rider["start"] ?? {};
        const config = base["config"] ?? {};
        // `--use-full-width`/`--bike-margin` override the loaded road's own
        // fields even when `--road` itself is absent (§4.2: a flag always
        // overrides the SAME-NAMED field, independently of sibling fields).
        const loadedRoad = base["road"] ?? {};
        const roadOverride = draft.road !== undefined
            ? withRoadOptions(draft)
            : draft.use_full_width !== undefined || draft.bike_margin_m !== undefined
                ? {
                    ...loadedRoad,
                    ...(draft.use_full_width !== undefined ? { use_full_width: draft.use_full_width } : {}),
                    ...(draft.bike_margin_m !== undefined ? { bike_margin_m: draft.bike_margin_m } : {})
                }
                : undefined;
        return {
            ...base,
            ...(roadOverride !== undefined ? { road: roadOverride } : {}),
            ...(draft.occluders !== undefined ? { occluders: draft.occluders } : {}),
            ...(draft.hazards !== undefined ? { hazards: draft.hazards } : {}),
            rider: {
                ...rider,
                ...(draft.profile !== undefined ? { profile: draft.profile } : {}),
                ...(draft.roll_rate_cap_dps !== undefined ? { roll_rate_cap_dps: draft.roll_rate_cap_dps } : {}),
                start: {
                    ...start,
                    ...(draft.entry_kmh !== undefined ? { speed_kmh: draft.entry_kmh } : {}),
                    ...(draft.start_f !== undefined ? { f: draft.start_f } : {})
                }
            },
            config: {
                ...config,
                ...(draft.mu !== undefined ? { mu: draft.mu } : {}),
                ...(draft.rubric !== undefined ? { rubric: draft.rubric } : {}),
                ...(draft.checks_version !== undefined ? { checks_version: draft.checks_version } : {})
            }
        };
    }
    // FigureSpec / composed-input / envelope: shallow field override, plus the
    // composed-input's flag-derived fields layered on top field by field.
    return { ...base, ...composed };
}
//# sourceMappingURL=args.js.map