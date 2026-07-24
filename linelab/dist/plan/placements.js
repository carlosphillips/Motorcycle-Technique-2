// plan/placements.ts — occluder/hazard placement: wire objects AND placement
// TOKEN strings (design/03 §4, verbatim grammar below) → absolute geometry
// (station + validated/defaulted lateral parameters). Vehicle placement is
// exactly one of lane ⊕ f ⊕ side (D27). Token parsing is needed because presets
// carry occluders as tokens (road/presets.ts `bookBlind`), not wire JSON.
//
//   occluder-token := <kind> <side> <anchor> <offset>x<span> [<key>=<val> …]
//   vehicle-token  := vehicle <own|oncoming|inside|outside|left|right|f=<v>>
//                             <anchor> [<offset>] [len=<m>] [w=<m>] [margin=<m>]
//
// `ResolvedOccluder`/`ResolvedHazard` (core/types.ts) carry only a STATION +
// lateral PARAMETERS (side/margin/depth/lane/f) — the actual footprint polygon
// is sight/footprints.ts's job (WP-03); this module never computes x/y or d.
import { ok, err } from "../core/result.js";
import { OCCLUDER_BAND_DEFAULTS, VEHICLE_DEFAULTS, GRAVEL_DEFAULTS } from "../road/constants.js";
import { parseAnchorToken, resolveAnchor } from "./anchors.js";
function schemaErr(at, message, reason, detail) {
    return { code: "SCHEMA", at, message, detail: { reason, ...detail } };
}
function badRange(at, message, reason, detail) {
    return { code: "BAD_RANGE", at, message, detail: { reason, ...detail } };
}
function outOfScope(at, message, reason, detail) {
    return { code: "OUT_OF_SCOPE", at, message, detail: { reason, ...detail } };
}
// ---------------------------------------------------------------------------
// Occluder / hazard resolution (wire JSON → ResolvedOccluder/ResolvedHazard)
const BAND_KINDS = ["hedge", "wall", "bank"];
export function resolveOccluder(raw, corners, id, at) {
    if (raw.height_m !== undefined) {
        return err(outOfScope(at, "vertical geometry (height) is not modelled", "vertical_geometry_not_modelled"));
    }
    const at_s = resolveAnchor(raw.at, corners, `${at}.at`);
    if (!at_s.ok)
        return at_s;
    if (raw.kind === "vehicle") {
        if (raw.speed_kmh !== undefined) {
            return err(outOfScope(at, "vehicles are optical-only in v1 — motion fields are refused", "moving_hazards_not_modelled"));
        }
        const forms = [raw.lane !== undefined, raw.f !== undefined, raw.side !== undefined].filter(Boolean).length;
        if (forms !== 1) {
            return err(schemaErr(at, "a vehicle placement takes exactly one of lane, f, or side (D27)", "vehicle_lane_xor_side"));
        }
        if (raw.span_m !== undefined) {
            return err(schemaErr(`${at}.span_m`, "a vehicle takes no span_m (fixed footprint length)", "vehicle_span_not_allowed"));
        }
        if (raw.margin_m !== undefined && raw.side === undefined) {
            return err(schemaErr(`${at}.margin_m`, "margin_m is only valid with a side placement", "margin_requires_side"));
        }
        return ok({
            id,
            kind: "vehicle",
            ...(raw.side !== undefined ? { side: raw.side } : {}),
            at: { at_s: at_s.value },
            ...(raw.margin_m !== undefined ? { margin_m: raw.margin_m } : raw.side !== undefined ? { margin_m: VEHICLE_DEFAULTS.verge_margin_m } : {}),
            len_m: raw.len_m ?? VEHICLE_DEFAULTS.len_m,
            width_m: raw.width_m ?? VEHICLE_DEFAULTS.width_m,
            ...(raw.lane !== undefined ? { lane: raw.lane } : {}),
            ...(raw.f !== undefined ? { f: raw.f } : {})
        });
    }
    // band kinds: hedge | wall | bank
    if (raw.lane !== undefined) {
        return err(schemaErr(`${at}.lane`, "lane is a vehicle-only field", "lane_requires_vehicle"));
    }
    if (raw.side === undefined) {
        return err(schemaErr(`${at}.side`, `a ${raw.kind} placement requires a side`, "occluder_side_required"));
    }
    if (raw.span_m === undefined || !(raw.span_m > 0)) {
        return err(badRange(`${at}.span_m`, "span_m must be a strictly positive number of metres", "span_nonpositive"));
    }
    const bandDefaults = OCCLUDER_BAND_DEFAULTS[raw.kind];
    return ok({
        id,
        kind: raw.kind,
        side: raw.side,
        at: { at_s: at_s.value },
        span_m: raw.span_m,
        margin_m: raw.margin_m ?? bandDefaults.margin_m,
        depth_m: raw.depth_m ?? bandDefaults.depth_m
    });
}
export function resolveHazard(raw, corners, id, at) {
    const at_s = resolveAnchor(raw.at, corners, `${at}.at`);
    if (!at_s.ok)
        return at_s;
    if (!(raw.span_m > 0)) {
        return err(badRange(`${at}.span_m`, "span_m must be a strictly positive number of metres", "span_nonpositive"));
    }
    const mu = raw.mu ?? GRAVEL_DEFAULTS.mu;
    if (!(mu > 0)) {
        return err(badRange(`${at}.mu`, `hazard mu must be > 0 (got ${mu})`, "hazard_mu_nonpositive"));
    }
    return ok({
        id,
        kind: "gravel",
        side: raw.side,
        at: { at_s: at_s.value },
        span_m: raw.span_m,
        width_m: raw.width_m ?? GRAVEL_DEFAULTS.width_m,
        mu
    });
}
/**
 * design/03 §2: an occluder/hazard placed in the oncoming lane under
 * `use_full_width: true` is refused (track framing and oncoming traffic cannot
 * both be true). `oncomingSide` names which of {inside, outside} reads as
 * oncoming under the placement's governing corner — the caller (validate.ts)
 * already has the hand-aware answer via road/corridor.ts, so this function just
 * takes the pre-computed boolean.
 */
export function checkFullWidthOncoming(useFullWidth, placedInOncomingLane, at) {
    if (useFullWidth && placedInOncomingLane) {
        return outOfScope(at, "full_width and an oncoming-lane placement cannot both hold", "full_width_with_oncoming_traffic");
    }
    return undefined;
}
// ---------------------------------------------------------------------------
// Placement TOKEN grammar (design/03 §4, verbatim) — used to fold preset-
// embedded occluder tokens (e.g. bookBlind's hedge) into the wire Occluder form.
const OFFSET_SPAN_RE = /^([+-]?\d+(?:\.\d+)?)x(\d+(?:\.\d+)?)$/;
const KEY_VAL_RE = /^([a-zA-Z_]+)=(.+)$/;
function splitTokens(s) {
    return s.trim().split(/\s+/).filter((t) => t.length > 0);
}
function parseKeyVals(tokens, at) {
    const out = {};
    for (const t of tokens) {
        const m = KEY_VAL_RE.exec(t);
        if (!m) {
            return err(schemaErr(at, `unrecognized placement key=value token "${t}"`, "placement_token_malformed"));
        }
        out[m[1]] = m[2];
    }
    return ok(out);
}
const OCCLUDER_KIND_TOKENS = ["hedge", "wall", "bank", "vehicle"];
const OCCLUDER_SIDE_TOKENS = ["inside", "outside", "left", "right"];
const HAZARD_SIDE_TOKENS = ["inside", "outside", "left", "right", "center"];
const VEHICLE_LATERAL_TOKENS = ["own", "oncoming", "inside", "outside", "left", "right"];
/**
 * Parse an occluder-token OR gravel-token (band-shaped grammar; both share
 * `<kind> <side> <anchor> <offset>x<span> [<key>=<val>…]`) into wire form.
 */
export function parseOccluderOrHazardToken(token, at) {
    const tokens = splitTokens(token);
    const kind = tokens[0];
    if (kind === undefined) {
        return err(schemaErr(at, "empty placement token", "placement_token_malformed"));
    }
    if (kind === "vehicle") {
        const parsed = parseVehicleToken(tokens, at);
        if (!parsed.ok)
            return parsed;
        return ok({ occluder: parsed.value.occluder });
    }
    const isGravel = kind === "gravel";
    if (!isGravel && !OCCLUDER_KIND_TOKENS.includes(kind)) {
        return err(schemaErr(at, `unknown placement kind "${kind}"`, "placement_kind_unknown"));
    }
    const side = tokens[1];
    const validSides = isGravel ? HAZARD_SIDE_TOKENS : OCCLUDER_SIDE_TOKENS;
    if (side === undefined || !validSides.includes(side)) {
        return err(schemaErr(at, `"${kind}" needs a side ∈ ${validSides.join("|")} (got "${side}")`, "placement_side_missing"));
    }
    const anchorTok = tokens[2];
    if (anchorTok === undefined) {
        return err(schemaErr(at, `"${kind}" needs an anchor token`, "placement_anchor_missing"));
    }
    const anchor = parseAnchorToken(anchorTok, at);
    if (!anchor.ok)
        return anchor;
    const spanTok = tokens[3];
    const m = spanTok === undefined ? null : OFFSET_SPAN_RE.exec(spanTok);
    if (m === null) {
        return err(schemaErr(at, `"${kind}" needs an <offset>x<span> token (got "${spanTok ?? ""}")`, "placement_offset_span_missing"));
    }
    const offset = Number(m[1]);
    const span = Number(m[2]);
    const kv = parseKeyVals(tokens.slice(4), at);
    if (!kv.ok)
        return kv;
    const anchorWithOffset = "at_s" in anchor.value ? { at_s: anchor.value.at_s + offset } : { ref: anchor.value.ref, offset_m: offset };
    if (isGravel) {
        const hazard = {
            kind: "gravel",
            side: side,
            at: anchorWithOffset,
            span_m: span,
            ...(kv.value["width"] !== undefined ? { width_m: Number(kv.value["width"]) } : {}),
            ...(kv.value["mu"] !== undefined ? { mu: Number(kv.value["mu"]) } : {})
        };
        return ok({ hazard });
    }
    const occluder = {
        kind: kind,
        side: side,
        at: anchorWithOffset,
        span_m: span,
        ...(kv.value["margin"] !== undefined ? { margin_m: Number(kv.value["margin"]) } : {}),
        ...(kv.value["depth"] !== undefined ? { depth_m: Number(kv.value["depth"]) } : {})
    };
    return ok({ occluder });
}
function parseVehicleToken(tokens, at) {
    const lateral = tokens[1];
    if (lateral === undefined) {
        return err(schemaErr(at, "vehicle needs a lateral placement token", "placement_token_malformed"));
    }
    const fMatch = /^f=(.+)$/.exec(lateral);
    const laneOrSide = fMatch === null ? lateral : undefined;
    if (fMatch === null && !VEHICLE_LATERAL_TOKENS.includes(lateral)) {
        return err(schemaErr(at, `unknown vehicle lateral token "${lateral}"`, "placement_token_malformed"));
    }
    const anchorTok = tokens[2];
    if (anchorTok === undefined) {
        return err(schemaErr(at, "vehicle needs an anchor token", "placement_anchor_missing"));
    }
    const anchor = parseAnchorToken(anchorTok, at);
    if (!anchor.ok)
        return anchor;
    let idx = 3;
    let offset = 0;
    const maybeOffset = tokens[idx];
    if (maybeOffset !== undefined && /^[+-]?\d+(\.\d+)?$/.test(maybeOffset)) {
        offset = Number(maybeOffset);
        idx += 1;
    }
    const kv = parseKeyVals(tokens.slice(idx), at);
    if (!kv.ok)
        return kv;
    const anchorWithOffset = "at_s" in anchor.value ? { at_s: anchor.value.at_s + offset } : { ref: anchor.value.ref, offset_m: offset };
    const occluder = {
        kind: "vehicle",
        at: anchorWithOffset,
        ...(laneOrSide === "own" || laneOrSide === "oncoming" ? { lane: laneOrSide } : {}),
        ...(laneOrSide === "inside" || laneOrSide === "outside" || laneOrSide === "left" || laneOrSide === "right"
            ? { side: laneOrSide }
            : {}),
        ...(fMatch !== null ? { f: Number(fMatch[1]) } : {}),
        ...(kv.value["len"] !== undefined ? { len_m: Number(kv.value["len"]) } : {}),
        ...(kv.value["w"] !== undefined ? { width_m: Number(kv.value["w"]) } : {}),
        ...(kv.value["margin"] !== undefined ? { margin_m: Number(kv.value["margin"]) } : {})
    };
    return ok({ occluder });
}
//# sourceMappingURL=placements.js.map