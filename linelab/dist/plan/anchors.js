// plan/anchors.ts — THE anchor grammar (D32; design/03 §4, §6.1), shared
// verbatim by plan actions, occluders, and hazards:
//
//   entry:<cornerId> | exit:<cornerId> | mid:<cornerId>   — corner-relative
//   <cornerId>                                            — bare sugar for entry:<cornerId>
//   s:<metres>                                            — absolute station (token form)
//   { at_s: <metres> }                                    — absolute station (wire form)
//
// An anchor never carries an offset (`entry:c1-25` → SCHEMA/anchor_embedded_offset,
// rewrite hint: "station offset belongs in the <offset>x<span> token"). `apex:`
// refs are rejected by name (D7 — the apex is measured, never authored).
//
// Two responsibilities: (1) parse the ref STRING (wire `at.ref`, or a bare
// placement-token anchor sub-token) into a typed `CornerAnchor`; (2) resolve a
// `WireAnchor` against a composed road's corners into an absolute station.
import { ok, err } from "../core/result.js";
function schemaErr(at, message, reason, detail) {
    return { code: "SCHEMA", at, message, detail: { reason, ...detail } };
}
const PREFIXED_RE = /^(entry|exit|mid|apex):(.*)$/;
/** corner ids look like `c1`, `c12`, … — never contain `+`/`-` (that is what flags an embedded offset). */
const EMBEDDED_OFFSET_RE = /[+-]/;
/**
 * Parse a ref STRING (wire `at.ref`, or the bare anchor sub-token of a
 * placement/CLI token) into a `CornerAnchor`. Never resolves against a road —
 * that is `resolveAnchor`'s job, which also needs `UNKNOWN_ID` on a missing
 * corner id.
 */
export function parseAnchorRef(ref, at) {
    const m = PREFIXED_RE.exec(ref);
    let kind;
    let idPart;
    if (m) {
        kind = m[1];
        idPart = m[2];
    }
    else {
        kind = "entry"; // bare sugar
        idPart = ref;
    }
    if (kind === "apex") {
        return err(schemaErr(at, `"${ref}": there is no apex anchor — the apex is measured, never authored (D7)`, "no_apex_anchor"));
    }
    if (idPart.length === 0) {
        return err(schemaErr(at, `"${ref}": empty anchor`, "anchor_malformed"));
    }
    if (EMBEDDED_OFFSET_RE.test(idPart)) {
        return err(schemaErr(at, `"${ref}": station offset belongs in the <offset>x<span> token, not inside the anchor`, "anchor_embedded_offset"));
    }
    return ok({ kind: kind, corner_id: idPart });
}
/**
 * Parse a full anchor TOKEN (`s:<m>` absolute-station spelling, or any ref
 * form) into a `WireAnchor`. Used for placement tokens (preset-embedded
 * occluders, scene/CLI) — never for JSON `at.ref`, which is already split into
 * `{ref, offset_m?}` at the wire level.
 */
export function parseAnchorToken(token, at) {
    if (token.startsWith("s:")) {
        const numStr = token.slice(2);
        const n = Number(numStr);
        if (numStr.length === 0 || !Number.isFinite(n)) {
            return err(schemaErr(at, `"${token}": malformed absolute station`, "anchor_malformed"));
        }
        return ok({ at_s: n });
    }
    const parsed = parseAnchorRef(token, at);
    if (!parsed.ok)
        return parsed;
    return ok({ ref: `${parsed.value.kind}:${parsed.value.corner_id}` });
}
/** Resolve a corner-relative CornerAnchor to its base station (entry=s0, exit=s1, mid=s_mid). */
function baseStation(kind, corner) {
    return kind === "entry" ? corner.s0 : kind === "exit" ? corner.s1 : corner.s_mid;
}
/**
 * Resolve a `WireAnchor` against the composed road's corners into an absolute
 * station. `UNKNOWN_ID` on a corner id that doesn't exist.
 */
export function resolveAnchor(anchor, corners, at) {
    // A raw non-object spelling (e.g. `at: "mid:c1"` instead of `at: {ref:
    // "mid:c1"}`) must reject TYPED, never throw — "no API function throws
    // across its boundary" (ARCHITECTURE §4). Found by WP-17's gate work: the
    // bare-string form crashed `"at_s" in anchor` with a TypeError.
    if (typeof anchor !== "object" || anchor === null) {
        return err(schemaErr(at, `anchor must be an object — {at_s: <m>} or {ref: "entry|exit|mid:<cornerId>"}`, "anchor_malformed"));
    }
    if ("at_s" in anchor)
        return ok(anchor.at_s);
    const parsed = parseAnchorRef(anchor.ref, at);
    if (!parsed.ok)
        return parsed;
    const { kind, corner_id } = parsed.value;
    const corner = corners.find((c) => c.id === corner_id);
    if (corner === undefined) {
        return err({
            code: "UNKNOWN_ID",
            at,
            message: `unknown corner id "${corner_id}" in anchor "${anchor.ref}"`,
            detail: { reason: "unknown_corner_id", corner_id }
        });
    }
    return ok(baseStation(kind, corner) + (anchor.offset_m ?? 0));
}
//# sourceMappingURL=anchors.js.map