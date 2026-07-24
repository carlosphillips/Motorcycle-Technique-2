import type { Event, Hand, CornerType, Sample, Terminated } from "../../core/types.js";
import type { SolveStyle } from "../types.js";
/** design/01 §A.1 — pack data, per check id. `critical`'s sole v2 member is check 16. */
export declare const SEVERITIES: readonly ["advisory", "standard", "critical"];
export type Severity = (typeof SEVERITIES)[number];
/** design/01 §A.1 / design/05 §6.2 — the closed check scope set. */
export declare const CHECK_SCOPES: readonly ["corner", "pair", "chain", "line"];
export type CheckScope = (typeof CHECK_SCOPES)[number];
/**
 * design/01 §A.1 — per-check verdicts. `na` is a first-class verdict carrying a
 * typed reason (the §8 placard policy at check granularity); it never blocks green.
 */
export declare const CHECK_VERDICTS: readonly ["pass", "fail", "warn", "na"];
export type CheckVerdict = (typeof CHECK_VERDICTS)[number];
/**
 * design/05 §6.2 — typed evidence; the bare string is retired. `metrics` carries
 * machine-readable measurements; an `na` verdict carries its typed reason at
 * `metrics.reason`.
 */
export interface CheckEvidence {
    readonly message: string;
    readonly at_s?: number;
    readonly metrics?: Readonly<Record<string, unknown>>;
}
/** design/05 §6.2, verbatim shape. One result per graded instance. */
export interface CheckResult {
    readonly id: string;
    readonly scope: CheckScope;
    /** scope = corner: the graded corner's id; null otherwise */
    readonly corner_id: string | null;
    /** scope = pair: the graded [c, c+1] pair; null otherwise */
    readonly pair: readonly [string, string] | null;
    readonly verdict: CheckVerdict;
    readonly evidence: CheckEvidence;
}
/** design/05 §6.2 — `doctrine = { pass, fail, warn, na, checks: [CheckResult] }`. */
export interface DoctrineBlock {
    readonly pass: number;
    readonly fail: number;
    readonly warn: number;
    readonly na: number;
    readonly checks: readonly CheckResult[];
}
/**
 * design/01 §A.6 — one threshold binding. `source` is mechanically
 * provenance-constrained: the literal "TUNING" or `^book:` — no third spelling
 * (loader + A-PACK-PROVENANCE, both directions).
 */
export interface ThresholdEntry {
    readonly value: number;
    readonly units: string;
    readonly source: string;
}
/**
 * design/01 §A.6 — the closed applicability KEY set is code; the values bound in
 * a pack are data.
 */
export declare const APPLICABILITY_KEYS: readonly ["corner_trend", "requires_blind", "declared_style", "chain_mode"];
export type ApplicabilityKey = (typeof APPLICABILITY_KEYS)[number];
/** Applicability values a pack may bind (design/01 §A.6; keys closed, values data). */
export interface Applicability {
    /** corner trend filter — corners whose type is absent read `na` */
    readonly corner_trend?: readonly CornerType[];
    /** true → applicable only where blind(c) holds (design/01 §A.2) */
    readonly requires_blind?: boolean;
    /** declared-style filter (unused by parks-street/2; key exists in code) */
    readonly declared_style?: readonly SolveStyle[];
    /** chain applicability: "geometric" = per geometric pair; "ridden" = needs ≥ 1 chain-mode corner */
    readonly chain_mode?: "geometric" | "ridden";
}
/** design/01 §A.6 — one check binding row (data; the arithmetic is code). */
export interface RubricCheck {
    readonly id: string;
    /** one of the engine's closed metric ids (code, metrics.ts METRIC_IDS) */
    readonly metric: string;
    readonly scope: CheckScope;
    readonly severity: Severity;
    readonly applicability: Applicability;
    readonly thresholds: Readonly<Record<string, ThresholdEntry>>;
    /** metric-band token (code) → verdict (data) */
    readonly bands: Readonly<Record<string, "pass" | "warn" | "fail">>;
    readonly teaches: string;
    readonly book_ref: string;
}
/** design/01 §A.6.1 — declared data, outside the hash-bearing binding set. */
export interface RubricAnnex {
    /** non-empty; every member ∈ this pack's check id set */
    readonly reserve_checks: readonly string[];
}
/** design/01 §A.6, verbatim. `rubric` string = `"<name>/<version>"`. */
export interface RubricPack {
    readonly pack: "linelab-rubric/1";
    readonly name: string;
    readonly version: number;
    readonly requires_checks_version: number;
    readonly doctrine_source: string;
    readonly checks: readonly RubricCheck[];
    /** tombstones (design/01 §A.5): old_id → new_id */
    readonly renames: Readonly<Record<string, string>>;
    readonly annex: RubricAnnex;
}
/** One recorded apex touch (the ONE hysteresis detector, design/05 §6.3). */
export interface DoctrineApex {
    /** m — station of the touch */
    readonly s: number;
    /** % — 100·cumΔψ(apex)/total sweep of the corner */
    readonly pct: number;
    /** — lane fraction at the touch */
    readonly f: number;
}
/**
 * Per-corner analysis row the checks read: the road's measured corner record
 * (design/03 §2 — road properties, never solver guesses) plus the recorded
 * apex list from the ONE detector.
 */
export interface DoctrineCorner {
    readonly id: string;
    readonly hand: Hand;
    /** m — entry boundary station */
    readonly s0: number;
    /** m — exit boundary station (the link/handoff station on chained corners) */
    readonly s1: number;
    readonly type: CornerType;
    /** m — taper endpoint radii (absent on arcs); check 16's DR predicate reads r1/r2 */
    readonly r1?: number;
    readonly r2?: number;
    /** geometric chain pair with the next corner (road record, design/03 §2) */
    readonly linked_next: boolean;
    /** recorded per-corner apex list (design/05 §6.3) — ordered by s */
    readonly apexes: readonly DoctrineApex[];
}
/**
 * Named physics quantities the catalogue consumes BY NAME and must not restate
 * (design/01 §A.3 checks 6/8/16). Evaluated/threaded by the caller from the one
 * core implementation (02 §4/§5.4) — the checks never re-derive them.
 */
export interface DoctrinePhysics {
    /** deg — phiReserve(mu_use), the derated street reserve (02 §4) */
    readonly phi_reserve_deg: number;
    /** deg — phiMax(mu), the physical lean ceiling */
    readonly phi_max_deg: number;
    /**
     * m/s² — a_widen(phi, v) (02 §5.4, run-wide slice), consumed by name in
     * check 6; null where undefined (upright / below existence bound).
     */
    readonly a_widen_ms2: (phi_deg: number, v_ms: number) => number | null;
    /** m — 04's brake_gap constant (check 6's baseline), threaded by the caller */
    readonly brake_gap_m: number;
}
/** The finished record `runChecks` grades. Frozen input; grading never mutates. */
export interface DoctrineRecord {
    readonly samples: readonly Sample[];
    readonly events: readonly Event[];
    readonly terminated: Terminated;
    readonly corners: readonly DoctrineCorner[];
    /** declared solve style (design/03 §6); absent reads "single" */
    readonly declared_style?: SolveStyle;
    /** the design/01 §8 vertical-blindness placard (checks 10/11 → na) */
    readonly vertically_blind?: boolean;
    readonly physics: DoctrinePhysics;
}
