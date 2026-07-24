import type { Result } from "../core/result.js";
import type { CheckVerdict, RubricPack } from "../plan/doctrine/types.js";
import type { LineEntry } from "./types.js";
export declare const STANDING_RUNGS: readonly ["crash", "failing", "caution", "clean", "reserved"];
export type Standing = (typeof STANDING_RUNGS)[number];
export type StandingRung = 0 | 1 | 2 | 3 | 4;
/**
 * The rung-token gloss every printing surface carries (design/05 §6.4
 * tombstone note; A-LADDER-PROSE). One declaration — surfaces import it,
 * never restate it.
 */
export declare const STANDING_GLOSS: string;
/**
 * The placard, verbatim on every surface that prints a `standing` token
 * (design/05 §6.4). `<rubric>`/`<n>` are the loaded pack identity and its
 * checks_version — the two provenance stamps every emission carries.
 */
export declare function standingPlacard(rubric: string, checksVersion: number): string;
/**
 * One row per declared annex member. `verdict` is the closed per-check verdict
 * set of design/01 §A.1 — zero instances reads verdict "na", instances 0,
 * never a fifth token. A member with multiple graded instances reads its WORST
 * instance verdict (fail > warn > na > pass) — the rung-4 threshold needs
 * every instance `pass`, so any non-pass instance decides the row.
 */
export interface ReserveRow {
    readonly id: string;
    readonly verdict: CheckVerdict;
    readonly instances: number;
}
/** The blocking reasons — recorded, never inferred (design/05 §6.4). */
export type ReserveBlockReason = "warn" | "fail" | "na";
export interface ReserveBlock {
    readonly id: string;
    readonly reason: ReserveBlockReason;
}
/**
 * design/05 §6.4, verbatim shape. `standing`/`rung` are null iff `refused`
 * (a refusal is not a bad line; it is the absence of one — no rung exists,
 * so no reserve row is graded and nothing blocks). `reserved_blocked_by` is
 * empty exactly when the annex's rung-4 conjunct holds: it names the reserve
 * members this line spent (rungs below 3 are additionally capped by their own
 * thresholds, independent of the annex).
 */
export interface StandingReport {
    readonly kind: "standing";
    readonly line_id: string;
    readonly standing: Standing | null;
    readonly rung: StandingRung | null;
    readonly refused: boolean;
    /** pack identity (data), `"<name>/<version>"` — design/05 §6.2 */
    readonly rubric: string;
    /** metric vocabulary (code) — design/05 §6.2 */
    readonly checks_version: number;
    /** echoed from the pack annex, never re-derived */
    readonly reserve_checks: readonly string[];
    readonly reserve: readonly ReserveRow[];
    readonly reserved_blocked_by: readonly ReserveBlock[];
    /** verbatim (standingPlacard) */
    readonly placard: string;
}
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
export declare function standing(entry: LineEntry, pack?: RubricPack): Result<StandingReport>;
/**
 * The `FigureResult.standing` attachment builder (design/05 §7): one row per
 * NON-REFUSED line, in draw order — refused lines get no row (their null
 * report exists only through the pure function itself). Written only when
 * requested (`--standing`), absent otherwise; sits beside `lines`, never
 * inside a LineResult and never inside a Verdict, so it enters no hash and no
 * gate.
 */
export declare function standingAttachment(lines: readonly LineEntry[], pack?: RubricPack): Result<readonly StandingReport[]>;
