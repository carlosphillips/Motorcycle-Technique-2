// solve/standing.ts — the D43 standing ladder: `standing(lineResult) →
// Result<StandingReport>`, a PURE lookup over verdicts the rubric already
// computed. Zero engine runs, zero new TUNING constants (design/05 §6.4
// "Cost"); the same class of object as correctiveShot's shadow — a pure
// function of a finished result, recomputable by any consumer, shipped by
// nothing.
//
// Design of record: design/05 §6.4 (the ladder, the wire shape, the placard,
// the tombstone gloss); design/00 D43; design/01 §A.6.1 (the reserve annex —
// validated at pack load, plan/doctrine/pack.ts). The thresholds are
// CUMULATIVE AND MONOTONE, and that is load-bearing: the rung is computed as
// one fold over the four thresholds, so no rung is attainable with a lower
// threshold violated (A-STANDING-LADDER-CUMULATIVE holds by construction).
//
// Out of hash, and off the gate: `standing` appears in no Verdict, Sample,
// result_hash, spec_hash, or E(line); it never affects an exit code
// (G-STANDING-NO-HASH-MOVE). `outcome` remains recomputable identically under
// any rubric pack (P-OUTCOME-RUBRIC-FREE); `standing` is deliberately the
// opposite and says so: every emission carries `rubric` + `checks_version`.
import { err, ok } from "../core/result.js";
import { CONFIG_RUBRIC_DEFAULT } from "../plan/constants.js";
import { loadShippedRubricPack, rubricString } from "../plan/doctrine/pack.js";
import { clean } from "../plan/doctrine/quality.js";
import { isLineRefusal } from "./envelope.js";
// ---------------------------------------------------------------------------
// The closed ordered rung set (design/00 D43, verbatim):
// reserved:4 > clean:3 > caution:2 > failing:1 > crash:0. Index = rung.
// Tombstone gloss (design/05 §6.4): the rung tokens name THE HIGHEST RUNG
// ATTAINED, not the extension of the namesake predicate.
export const STANDING_RUNGS = ["crash", "failing", "caution", "clean", "reserved"];
/**
 * The rung-token gloss every printing surface carries (design/05 §6.4
 * tombstone note; A-LADDER-PROSE). One declaration — surfaces import it,
 * never restate it.
 */
export const STANDING_GLOSS = 'the rung tokens "clean", "caution", "failing", "crash" name the highest rung attained, ' +
    "not the extension of the namesake predicate — a line at rung 3 satisfies clean(line), " +
    "and so does a line at rung 4";
/**
 * The placard, verbatim on every surface that prints a `standing` token
 * (design/05 §6.4). `<rubric>`/`<n>` are the loaded pack identity and its
 * checks_version — the two provenance stamps every emission carries.
 */
export function standingPlacard(rubric, checksVersion) {
    return ("outward mid-corner correction is not modelled (Tier 1R: no countersteer, no rider-input model). " +
        `This rung reports declared reserve only — lean reserve and sight reserve as graded by ${rubric} at checks_version ${checksVersion}.`);
}
// ---------------------------------------------------------------------------
// Internals
/** Worst-first precedence over the closed verdict set (see ReserveRow doc). */
const WORST_FIRST = ["fail", "warn", "na", "pass"];
function aggregateReserve(instances) {
    if (instances.length === 0)
        return "na"; // zero instances is `na`, never a vacuous universal
    for (const v of WORST_FIRST) {
        if (instances.some((c) => c.verdict === v))
            return v;
    }
    /* unreachable — CheckVerdict is closed */
    return "na";
}
function unknownRubricErr(at, message, detail) {
    return { code: "UNKNOWN_ID", at, message, detail: { reason: "unknown_rubric", ...detail } };
}
/**
 * Resolve the pack a report echoes: the verdict's own `rubric` stamp against
 * the shipped registry (`standing` reads pack verdicts, so it is a function of
 * `checks_version` and `rubric` — a stamp the engine cannot resolve is a typed
 * refusal, never a silent re-grade under a different pack).
 */
function packFor(entry) {
    if (isLineRefusal(entry))
        return loadShippedRubricPack(CONFIG_RUBRIC_DEFAULT);
    const stamp = entry.verdict.rubric;
    const slash = stamp.lastIndexOf("/");
    const name = slash === -1 ? stamp : stamp.slice(0, slash);
    const loaded = loadShippedRubricPack(name);
    if (!loaded.ok)
        return loaded;
    const shipped = rubricString(loaded.value);
    if (shipped !== stamp || entry.verdict.checks_version !== loaded.value.requires_checks_version) {
        return err(unknownRubricErr("verdict.rubric", `line "${entry.line_id}" was graded under ${stamp} at checks_version ${entry.verdict.checks_version}; this engine ships ${shipped} at checks_version ${loaded.value.requires_checks_version}`, { stamped: stamp, shipped, stamped_checks_version: entry.verdict.checks_version }));
    }
    return loaded;
}
// ---------------------------------------------------------------------------
// The ladder
/**
 * `standing(lineResult) → Result<StandingReport>` (design/05 §6.4, §8; the
 * pure exported function). Total over envelope entries: a `LineRefusal`
 * yields `{standing: null, rung: null, refused: true}` — its own terminal
 * class, never a rung and never an exception.
 *
 * The optional `pack` argument is the P-STANDING-RUBRIC-SENSITIVE seam: a
 * caller may grade under an explicitly loaded pack (`standing` is a function
 * of the pack, and deliberately says so). When absent, the verdict's own
 * `rubric` stamp resolves against the shipped registry.
 *
 * Thresholds (cumulative, monotone — the fold IS the disjointness proof):
 *   >= 1  ⇔  outcome ≠ "crash"
 *   >= 2  ⇔  quality ≠ "failing"
 *   >= 3  ⇔  clean(line)                       // design/05 §6.1 verbatim
 *    = 4  ⇔  clean(line) ∧ every annex reserve check reads `pass` on every
 *            applicable instance (an `na` or zero-instance member caps at 3)
 */
export function standing(entry, pack) {
    const packR = pack !== undefined ? ok(pack) : packFor(entry);
    if (!packR.ok)
        return packR;
    const p = packR.value;
    const rubric = rubricString(p);
    const checksVersion = p.requires_checks_version;
    const reserveChecks = p.annex.reserve_checks;
    const placard = standingPlacard(rubric, checksVersion);
    if (isLineRefusal(entry)) {
        return ok(Object.freeze({
            kind: "standing",
            line_id: entry.line_id,
            standing: null,
            rung: null,
            refused: true,
            rubric,
            checks_version: checksVersion,
            reserve_checks: reserveChecks,
            reserve: [],
            reserved_blocked_by: [],
            placard
        }));
    }
    const v = entry.verdict;
    const reserve = reserveChecks.map((id) => {
        const instances = v.doctrine.checks.filter((c) => c.id === id);
        return Object.freeze({ id, verdict: aggregateReserve(instances), instances: instances.length });
    });
    const isClean = clean(v.outcome, v.doctrine);
    const t1 = v.outcome !== "crash";
    const t2 = v.quality !== "failing";
    const t3 = isClean;
    const t4 = isClean && reserve.every((r) => r.verdict === "pass");
    const rung = !t1 ? 0 : !t2 ? 1 : !t3 ? 2 : !t4 ? 3 : 4;
    const reservedBlockedBy = reserve
        .filter((r) => r.verdict !== "pass")
        .map((r) => Object.freeze({ id: r.id, reason: r.verdict }));
    return ok(Object.freeze({
        kind: "standing",
        line_id: entry.line_id,
        standing: STANDING_RUNGS[rung],
        rung,
        refused: false,
        rubric,
        checks_version: checksVersion,
        reserve_checks: reserveChecks,
        reserve,
        reserved_blocked_by: reservedBlockedBy,
        placard
    }));
}
/**
 * The `FigureResult.standing` attachment builder (design/05 §7): one row per
 * NON-REFUSED line, in draw order — refused lines get no row (their null
 * report exists only through the pure function itself). Written only when
 * requested (`--standing`), absent otherwise; sits beside `lines`, never
 * inside a LineResult and never inside a Verdict, so it enters no hash and no
 * gate.
 */
export function standingAttachment(lines, pack) {
    const rows = [];
    for (const entry of lines) {
        if (isLineRefusal(entry))
            continue;
        const r = standing(entry, pack);
        if (!r.ok)
            return r;
        rows.push(r.value);
    }
    return ok(rows);
}
//# sourceMappingURL=standing.js.map