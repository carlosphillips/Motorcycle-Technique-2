// plan/doctrine/pack.ts — rubric pack loader/validator (design/01 §A.6, §A.6.1,
// §A.5) and the D42 mechanical provenance rule shared by every committed pack
// root (rubric AND continuation — the continuation pack additionally gets the
// design/03 §7a.2/§7a.3 DATA-level typed rejections via
// validateContinuationPackData; the full D45 loader/runtime stays deferred).
//
// Provenance law (design/01 §A.6; design/09 §4 A-PACK-PROVENANCE): every
// `source` string is the literal "TUNING" or matches ^book: — no third
// spelling. A book:<cite> must resolve against the committed book_text/
// extraction; src/ is pure (no fs), so the resolvable-citation set is the
// committed registry below, and test/oracle/rubric.test.ts re-verifies that
// registry against book_text/ on disk. Symmetrically, a value the design of
// record marks TUNING may never carry a book: source. Every provenance
// rejection is SCHEMA/source_unresolved (design/09 §4: one reason token for
// every pack root alike).
import { err, ok } from "../../core/result.js";
import { CONFIG_CHECKS_VERSION_DEFAULT, CONFIG_RUBRIC_DEFAULT } from "../constants.js";
import { APPLICABILITY_KEYS, CHECK_SCOPES, SEVERITIES } from "./types.js";
import { CHECK_BANDS, CHECK_IDS, CHECK_METRIC, CHECK_SCOPE, CHECK_THRESHOLDS } from "./checks.js";
import parksStreetJson from "./packs/parks-street.json" with { type: "json" };
// ---------------------------------------------------------------------------
// Registries (design of record, mirrored as code — enumeration-tested)
/**
 * design/01 §A.5 — struck check-id tombstones. Typed UNKNOWN_ID with sub-reason
 * `struck_by_decision`, which is NOT `deferred`: there is no phase in which any
 * of these arrives.
 */
export const STRUCK_CHECK_IDS = Object.freeze({
    out_available: "struck by decision (D43); successor mechanism: annex.reserve_checks",
    sight_ok: "struck by decision (D43); successor mechanism: stop_within_sight",
    commit_within_sight: "struck by decision (D45); no successor"
});
/**
 * The resolvable book citations — verbatim substrings of the committed
 * book_text/ extraction (each `book:` source's cite must be one of these).
 * test/oracle/rubric.test.ts greps book_text/ to keep this registry honest.
 */
export const KNOWN_BOOK_CITES = Object.freeze([
    "With a delayed entry, it can be safely completed with only one turning point",
    "So an early turn point creates an early apex, which forces the line wide or requires a mid-corner steering correction"
]);
/**
 * Threshold/bound names the design of record marks TUNING (design/01 Appendix A
 * constants; design/03 §7a.2 continuation bounds). Binding any of these names
 * with a `book:` source in any pack is the fabrication the D42 provenance rule
 * exists to reject.
 */
export const TUNING_MARKED_NAMES = Object.freeze([
    // design/01 Appendix A (rubric thresholds + measurement constants)
    "OIO_OUTSIDE_MIN", "OIO_INSIDE_MAX", "OIO_SWING_MIN",
    "QS_SHARE_FAIL", "QS_SHARE_WARN", "QS_TIME_WARN", "SMALL_LEAN_DEG",
    "THR_EPS", "CRACK_EARLY_FRAC", "ROLLON_LATE_FRAC", "RATE_THRESHOLD", "CHOP_TOL",
    "TB_PHI_MIN", "REDEEPEN_TOL", "RESID_FRAC", "A_SU_ONSET",
    "eps_mag", "BLIND_RESERVE_DEG", "SIGHT_WARN_M",
    "HOLD_WINDOW_FRAC", "RELEASE_TOL_M", "HOLD_F_MIN",
    "RATE_TOL_DPS", "KAPPA_STEP", "PHI_JUMP",
    "LINK_GAP_FRAC", "LINK_BRAKE_RESET", "LINK_ENTRY_OUTER_MIN",
    "EPS_F", "DR_RATIO_MIN", "DR_ALT_SPEED_MARGIN",
    "SI_HYST", "APEX_PROMINENCE_F", "APEX_MIN_SEP_M", "EPS_EXIT_DEG",
    // design/03 §7a.2 (continuation pack bounds; escape_decel_mss is the
    // field the test was written to satisfy)
    "kappa_max_1pm", "dkappa_ds_max_1pm2", "kappa_step_max_1pm",
    "member_sweep_max_deg", "member_curve_max_m", "member_runout_m", "ladder_reach",
    "escape_decel_mss", "escape_ellipse_max"
]);
// ---------------------------------------------------------------------------
// Error helpers
function schemaErr(at, message, reason, detail) {
    return { code: "SCHEMA", at, message, detail: { reason, ...(detail ?? {}) } };
}
function unknownIdErr(at, message, reason, detail) {
    return { code: "UNKNOWN_ID", at, message, detail: { reason, ...(detail ?? {}) } };
}
function isRecord(v) {
    return typeof v === "object" && v !== null && !Array.isArray(v);
}
// ---------------------------------------------------------------------------
// The D42 provenance scan (shared by every pack root)
/**
 * Walk any pack-shaped JSON tree; check every `{value, units, source}` bound.
 * Rules (design/01 §A.6, all rejections SCHEMA/source_unresolved):
 *  (a) `source` is "TUNING" or starts with "book:" — no third spelling;
 *  (b) a book cite must resolve in the committed registry (KNOWN_BOOK_CITES,
 *      itself verified against book_text/ by the test suite);
 *  (c) a name the design of record marks TUNING may never carry a book: source.
 * Every rejection names the CHECK ID and the offending source string
 * (design/01 §A.6: "naming the check id and the string") — the walker tracks
 * the nearest enclosing object carrying a string `id` field; `detail.check_id`
 * is null for pack roots without check rows (the continuation pack).
 * Returns the number of source strings checked.
 */
export function scanPackProvenance(json, atPrefix = "pack") {
    let count = 0;
    const walk = (node, path, parentKey, checkId) => {
        if (Array.isArray(node)) {
            for (let i = 0; i < node.length; i++) {
                const e = walk(node[i], `${path}[${i}]`, parentKey, checkId);
                if (e)
                    return e;
            }
            return null;
        }
        if (!isRecord(node))
            return null;
        const idField = node["id"];
        const owner = typeof idField === "string" ? idField : checkId;
        const inCheck = owner !== null ? `in check ${owner}, ` : "";
        const src = node["source"];
        if (src !== undefined) {
            count++;
            if (typeof src !== "string" || (src !== "TUNING" && !src.startsWith("book:"))) {
                return schemaErr(`${path}.source`, `${inCheck}source must be "TUNING" or "book:<cite>" — got ${JSON.stringify(src)}`, "source_unresolved", { check_id: owner, name: parentKey, source: src });
            }
            if (src.startsWith("book:")) {
                const cite = src.slice("book:".length);
                if (!KNOWN_BOOK_CITES.includes(cite)) {
                    return schemaErr(`${path}.source`, `${inCheck}book citation does not resolve in the committed book_text/ extraction: ${cite}`, "source_unresolved", { check_id: owner, name: parentKey, source: src, cite });
                }
                if (parentKey !== null && TUNING_MARKED_NAMES.includes(parentKey)) {
                    return schemaErr(`${path}.source`, `${inCheck}${parentKey} is marked TUNING in the design of record and may never carry a book: source`, "source_unresolved", { check_id: owner, name: parentKey, source: src, cite });
                }
            }
        }
        for (const [k, v] of Object.entries(node)) {
            if (k === "source")
                continue;
            const e = walk(v, `${path}.${k}`, k, owner);
            if (e)
                return e;
        }
        return null;
    };
    const e = walk(json, atPrefix, null, null);
    return e ? err(e) : ok(count);
}
// ---------------------------------------------------------------------------
// Rubric pack loader (design/01 §A.6 / §A.6.1)
const PACK_TOP_KEYS = new Set([
    "pack", "name", "version", "requires_checks_version", "doctrine_source",
    "checks", "renames", "annex"
]);
const CHECK_ROW_KEYS = new Set([
    "id", "metric", "scope", "severity", "applicability", "thresholds", "bands",
    "teaches", "book_ref"
]);
/** `loadRubricPack(json) → Result<RubricPack>` — the sole rubric-pack entry point. */
export function loadRubricPack(json) {
    if (!isRecord(json)) {
        return err(schemaErr("rubric", "pack must be an object", "type_mismatch"));
    }
    for (const k of Object.keys(json)) {
        if (!PACK_TOP_KEYS.has(k)) {
            return err(schemaErr(`rubric.${k}`, `unknown pack field: ${k}`, "unknown_field"));
        }
    }
    if (json["pack"] !== "linelab-rubric/1") {
        return err(schemaErr("rubric.pack", 'pack wire-format must be "linelab-rubric/1"', "bad_pack_literal"));
    }
    const name = json["name"];
    if (typeof name !== "string" || name.length === 0) {
        return err(schemaErr("rubric.name", "name must be a non-empty string", "type_mismatch"));
    }
    const version = json["version"];
    if (typeof version !== "number" || !Number.isInteger(version)) {
        return err(schemaErr("rubric.version", "version must be an integer", "type_mismatch"));
    }
    const rcv = json["requires_checks_version"];
    if (typeof rcv !== "number" || !Number.isInteger(rcv)) {
        return err(schemaErr("rubric.requires_checks_version", "requires_checks_version must be an integer", "type_mismatch"));
    }
    if (rcv !== CONFIG_CHECKS_VERSION_DEFAULT) {
        return err(schemaErr("rubric.requires_checks_version", `pack requires checks_version ${rcv} but this engine implements checks_version ${CONFIG_CHECKS_VERSION_DEFAULT}`, "checks_version_mismatch", { pack_requires: rcv, engine_implements: CONFIG_CHECKS_VERSION_DEFAULT }));
    }
    const doctrineSource = json["doctrine_source"];
    if (typeof doctrineSource !== "string") {
        return err(schemaErr("rubric.doctrine_source", "doctrine_source must be a string", "type_mismatch"));
    }
    // Provenance before structure-deep checks: a pack that cannot cite honestly
    // does not load, whatever else is wrong with it.
    const prov = scanPackProvenance(json, "rubric");
    if (!prov.ok)
        return prov;
    const checksJson = json["checks"];
    if (!Array.isArray(checksJson) || checksJson.length === 0) {
        return err(schemaErr("rubric.checks", "checks must be a non-empty array", "type_mismatch"));
    }
    const checks = [];
    const seen = new Set();
    for (let i = 0; i < checksJson.length; i++) {
        const rowPath = `rubric.checks[${i}]`;
        const row = checksJson[i];
        if (!isRecord(row)) {
            return err(schemaErr(rowPath, "check row must be an object", "type_mismatch"));
        }
        for (const k of Object.keys(row)) {
            if (!CHECK_ROW_KEYS.has(k)) {
                return err(schemaErr(`${rowPath}.${k}`, `unknown check field: ${k}`, "unknown_field"));
            }
        }
        const id = row["id"];
        if (typeof id !== "string") {
            return err(schemaErr(`${rowPath}.id`, "check id must be a string", "type_mismatch"));
        }
        if (seen.has(id)) {
            return err({
                code: "DUP_ID",
                at: `${rowPath}.id`,
                message: `duplicate check id: ${id}`,
                detail: { reason: "duplicate_check_id", id }
            });
        }
        seen.add(id);
        if (!CHECK_IDS.includes(id)) {
            // A pack cannot introduce arithmetic (design/01 §A.6): an id with no
            // shipped evaluator has no arithmetic to bind.
            return err(unknownIdErr(`${rowPath}.id`, `unknown check id: ${id} (no evaluator in checks_version ${CONFIG_CHECKS_VERSION_DEFAULT})`, "unknown_check_id", { id }));
        }
        const checkId = id;
        const metric = row["metric"];
        if (metric !== CHECK_METRIC[checkId]) {
            return err(schemaErr(`${rowPath}.metric`, `check ${id} binds metric ${String(metric)}; checks_version ${CONFIG_CHECKS_VERSION_DEFAULT} computes it from ${CHECK_METRIC[checkId]}`, "metric_binding_mismatch", { id, bound: metric, expected: CHECK_METRIC[checkId] }));
        }
        const scope = row["scope"];
        if (typeof scope !== "string" || !CHECK_SCOPES.includes(scope)) {
            return err(schemaErr(`${rowPath}.scope`, `bad scope: ${String(scope)}`, "type_mismatch"));
        }
        if (scope !== CHECK_SCOPE[checkId]) {
            return err(schemaErr(`${rowPath}.scope`, `check ${id} is ${CHECK_SCOPE[checkId]}-scope in checks_version ${CONFIG_CHECKS_VERSION_DEFAULT}`, "scope_mismatch", { id, bound: scope, expected: CHECK_SCOPE[checkId] }));
        }
        const severity = row["severity"];
        if (typeof severity !== "string" || !SEVERITIES.includes(severity)) {
            return err(schemaErr(`${rowPath}.severity`, `bad severity: ${String(severity)}`, "type_mismatch"));
        }
        const applicability = row["applicability"];
        if (!isRecord(applicability)) {
            return err(schemaErr(`${rowPath}.applicability`, "applicability must be an object", "type_mismatch"));
        }
        for (const k of Object.keys(applicability)) {
            if (!APPLICABILITY_KEYS.includes(k)) {
                return err(schemaErr(`${rowPath}.applicability.${k}`, `unknown applicability key: ${k}`, "unknown_applicability_key", { key: k }));
            }
        }
        const thresholds = row["thresholds"];
        if (!isRecord(thresholds)) {
            return err(schemaErr(`${rowPath}.thresholds`, "thresholds must be an object", "type_mismatch"));
        }
        for (const [tName, tEntry] of Object.entries(thresholds)) {
            if (!isRecord(tEntry)) {
                return err(schemaErr(`${rowPath}.thresholds.${tName}`, "threshold must be {value, units, source}", "type_mismatch"));
            }
            const value = tEntry["value"];
            if (typeof value !== "number" || !Number.isFinite(value)) {
                // The D12 seam is expression versus scalar: anything but a finite
                // scalar where a bound belongs is a pack trying to carry policy.
                return err(schemaErr(`${rowPath}.thresholds.${tName}.value`, `threshold ${tName} must bind a finite scalar, not an expression`, "pack_defines_rider", { name: tName }));
            }
            if (typeof tEntry["units"] !== "string" || typeof tEntry["source"] !== "string") {
                return err(schemaErr(`${rowPath}.thresholds.${tName}`, "threshold must carry units and source strings", "type_mismatch"));
            }
        }
        // Completeness (symmetric with bands): the row must bind every threshold
        // name its checks_version arithmetic consumes — a loadable pack can
        // re-bind a value but never silently omit one (the NaN fallback would
        // otherwise misgrade silently, violating §A.6's convergence claim).
        for (const tName of CHECK_THRESHOLDS[checkId]) {
            if (!(tName in thresholds)) {
                return err(schemaErr(`${rowPath}.thresholds`, `check ${id} must bind threshold ${tName} — checks_version ${CONFIG_CHECKS_VERSION_DEFAULT} arithmetic consumes it`, "thresholds_incomplete", { id, missing: tName }));
            }
        }
        const bands = row["bands"];
        if (!isRecord(bands)) {
            return err(schemaErr(`${rowPath}.bands`, "bands must be an object", "type_mismatch"));
        }
        for (const [bName, bVerdict] of Object.entries(bands)) {
            if (bVerdict !== "pass" && bVerdict !== "warn" && bVerdict !== "fail") {
                return err(schemaErr(`${rowPath}.bands.${bName}`, `band verdict must be pass|warn|fail, got ${String(bVerdict)}`, "bad_band_verdict"));
            }
        }
        for (const token of CHECK_BANDS[checkId]) {
            if (!(token in bands)) {
                return err(schemaErr(`${rowPath}.bands`, `bands must map every ${id} band token; missing "${token}"`, "bands_incomplete", { id, missing: token }));
            }
        }
        const teaches = row["teaches"];
        const bookRef = row["book_ref"];
        if (typeof teaches !== "string" || typeof bookRef !== "string") {
            return err(schemaErr(`${rowPath}.teaches`, "teaches/book_ref must be strings", "type_mismatch"));
        }
        checks.push({
            id: checkId,
            metric: CHECK_METRIC[checkId],
            scope: scope,
            severity: severity,
            applicability: applicability,
            thresholds: thresholds,
            bands: bands,
            teaches,
            book_ref: bookRef
        });
    }
    // renames (design/01 §A.5): old_id → new_id; every successor must ship
    const renamesJson = json["renames"] ?? {};
    if (!isRecord(renamesJson)) {
        return err(schemaErr("rubric.renames", "renames must be an object", "type_mismatch"));
    }
    const checkIds = new Set(checks.map((c) => c.id));
    for (const [oldId, newId] of Object.entries(renamesJson)) {
        if (typeof newId !== "string" || !checkIds.has(newId)) {
            return err(unknownIdErr(`rubric.renames.${oldId}`, `rename successor ${String(newId)} is not a shipped check id`, "unknown_check", { old_id: oldId, new_id: newId }));
        }
    }
    const renames = renamesJson;
    // annex (design/01 §A.6.1) — typed validation, renames consulted FIRST
    const annexJson = json["annex"];
    const reserveJson = isRecord(annexJson) ? annexJson["reserve_checks"] : undefined;
    if (annexJson === undefined || reserveJson === undefined) {
        return err(schemaErr("rubric.annex.reserve_checks", "a pack without the reserve annex cannot be asked for a standing; it is refused, never defaulted", "reserve_checks_missing"));
    }
    if (!Array.isArray(reserveJson) || !reserveJson.every((x) => typeof x === "string")) {
        return err(schemaErr("rubric.annex.reserve_checks", "reserve_checks must be an array of check ids", "type_mismatch"));
    }
    if (reserveJson.length === 0) {
        return err(schemaErr("rubric.annex.reserve_checks", "an empty reserve annex would make the top rung vacuous; it is rejected rather than shipped", "reserve_checks_empty"));
    }
    for (const member of reserveJson) {
        const successor = renames[member];
        if (successor !== undefined) {
            return err(unknownIdErr("rubric.annex.reserve_checks", `${member} was renamed to ${successor} in checks_version ${CONFIG_CHECKS_VERSION_DEFAULT}`, "renamed_check", { id: member, successor }));
        }
        if (!checkIds.has(member)) {
            return err(unknownIdErr("rubric.annex.reserve_checks", `pack ${name}/${version} declares reserve check ${member}, which is not in its check id set`, "unknown_reserve_check", { pack: `${name}/${version}`, id: member }));
        }
    }
    const pack = {
        pack: "linelab-rubric/1",
        name,
        version,
        requires_checks_version: rcv,
        doctrine_source: doctrineSource,
        checks,
        renames,
        annex: { reserve_checks: reserveJson }
    };
    return ok(Object.freeze(pack));
}
// ---------------------------------------------------------------------------
// Shipped-pack resolution + id resolution surfaces
/** `rubric` identity string every Verdict carries: `"<name>/<version>"`. */
export function rubricString(pack) {
    return `${pack.name}/${pack.version}`;
}
/**
 * Resolve a rubric NAME to the single pack version the engine ships
 * (design/01 §A.6: version is not author-selectable). Unknown name → UNKNOWN_ID.
 */
export function loadShippedRubricPack(name) {
    if (name !== CONFIG_RUBRIC_DEFAULT) {
        return err(unknownIdErr("config.rubric", `unknown rubric: ${name} (v0.1 ships exactly "${CONFIG_RUBRIC_DEFAULT}")`, "unknown_rubric", { name }));
    }
    return loadRubricPack(parksStreetJson);
}
// ---------------------------------------------------------------------------
// Continuation-pack DATA validation (design/03 §7a.2/§7a.3 — the load-time
// typed rejections; DATA-LEVEL ONLY. v0.1 ships no D45 runtime: the full
// continuation loader (requires_continuations_version, escape-rider registry
// resolution, envelope typing) lands with the continuation envelope and will
// call this gate first. Exercised now by test/oracle/rubric.test.ts over the
// committed plan/continuations/packs/street.json.)
/**
 * design/03 §7a.2 — the code-side probe budget (7, TUNING) the pack ladder's
 * cardinality is bound to by typed rejection. 03-owned constant; declared here
 * because the doctrine/continuation data layer has no constants.ts of its own
 * in v0.1 (same placement rule as metrics.ts SI_HYST_DEG).
 */
export const K_MEMBERS = 7;
/**
 * Data-level validation of a continuation pack (design/03 §7a.2/§7a.3):
 *  (a) the D42 provenance scan every committed pack root gets;
 *  (b) `len(ladder) ≠ K_MEMBERS` → SCHEMA/ladder_cardinality_mismatch at
 *      `prior.ladder` — the ladder is pack data but K_MEMBERS is code, and a
 *      ladder of any other length silently breaks the §7a.6 k-bounds;
 *  (c) the §7a.3 coupled-constants schema check: `kappa_step_max_1pm ≥
 *      kappa_max_1pm` — the constants move together or the generator emits
 *      members outside the envelope the placard names.
 * Returns the provenance-checked source count on success.
 */
export function validateContinuationPackData(json) {
    if (!isRecord(json)) {
        return err(schemaErr("prior", "continuation pack must be an object", "type_mismatch"));
    }
    // Provenance before structure (§A.6: a pack that cannot cite honestly does
    // not load, whatever else is wrong with it).
    const prov = scanPackProvenance(json, "prior");
    if (!prov.ok)
        return prov;
    const ladder = json["ladder"];
    if (!Array.isArray(ladder) || ladder.length !== K_MEMBERS) {
        return err(schemaErr("prior.ladder", `ladder must carry exactly K_MEMBERS = ${K_MEMBERS} rungs, got ${Array.isArray(ladder) ? ladder.length : String(typeof ladder)}`, "ladder_cardinality_mismatch", { expected: K_MEMBERS, got: Array.isArray(ladder) ? ladder.length : null }));
    }
    const env = json["envelope"];
    const kMaxEntry = isRecord(env) ? env["kappa_max_1pm"] : undefined;
    const kStepEntry = isRecord(env) ? env["kappa_step_max_1pm"] : undefined;
    const kMax = isRecord(kMaxEntry) ? kMaxEntry["value"] : undefined;
    const kStep = isRecord(kStepEntry) ? kStepEntry["value"] : undefined;
    if (typeof kMax !== "number" || typeof kStep !== "number") {
        return err(schemaErr("prior.envelope", "envelope must bind kappa_max_1pm and kappa_step_max_1pm scalar values", "type_mismatch"));
    }
    if (kStep < kMax) {
        return err(schemaErr("prior.envelope.kappa_step_max_1pm", `kappa_step_max_1pm (${kStep}) must be >= kappa_max_1pm (${kMax}) — the coupled constants move together (design/03 §7a.3)`, "kappa_step_below_kappa_max", { kappa_step_max_1pm: kStep, kappa_max_1pm: kMax }));
    }
    return prov;
}
/**
 * Resolve a check id against a loaded pack: shipped id → ok; renamed id →
 * UNKNOWN_ID/renamed_check naming the successor (design/01 §A.5, never silently
 * aliased); struck id → UNKNOWN_ID/struck_by_decision (never `deferred`);
 * anything else → UNKNOWN_ID/unknown_check.
 */
export function resolveCheckId(pack, id) {
    if (pack.checks.some((c) => c.id === id))
        return ok(id);
    const successor = pack.renames[id];
    if (successor !== undefined) {
        return err(unknownIdErr(id, `${id} was renamed to ${successor} in checks_version ${pack.requires_checks_version}`, "renamed_check", { id, successor }));
    }
    const struck = STRUCK_CHECK_IDS[id];
    if (struck !== undefined) {
        return err(unknownIdErr(id, `${id}: ${struck}`, "struck_by_decision", { id }));
    }
    return err(unknownIdErr(id, `unknown check id: ${id}`, "unknown_check", { id }));
}
//# sourceMappingURL=pack.js.map