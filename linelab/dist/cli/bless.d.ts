#!/usr/bin/env node
import type { RoadModel } from "../core/types.js";
import type { LineResult } from "../solve/types.js";
export type RosterInput = 
/** a wire Scenario (explicit plan) or a composed solver input — both through run() */
{
    readonly kind: "run";
    readonly input: Record<string, unknown>;
}
/** the oracle's misjudge path: best_failing base + compileMistake on the plain spec */
 | {
    readonly kind: "mistake_on_base";
    readonly baseSpec: Record<string, unknown>;
    readonly baseAccept: "clean" | "best_failing";
    readonly mistake: {
        readonly kind: string;
        readonly params?: Record<string, unknown>;
    };
};
export interface RosterEntry {
    readonly id: string;
    readonly input: RosterInput;
    /** line whose quantities feed the 02 §8.1 blessed block (block fixtures only) */
    readonly blessed_line?: string;
}
export declare const BLESS_ROSTER: readonly RosterEntry[];
/** fixtures whose rows feed the 02 §8.1 blessed block (design/09 §3.2a write-back format). */
export declare const BLESSED_BLOCK_FIXTURES: readonly string[];
export interface BlessedRow {
    readonly fixture: string;
    readonly quantity: string;
    /** raw f64 (numbers) or the categorical token */
    readonly value: number | string;
    readonly unit: string;
    /** "±0.01" style label or "exact" — from THE tolerance table */
    readonly tol: string;
}
export interface GoldenEventRecord {
    readonly kind: string;
    readonly s: number;
    readonly t: number;
    readonly corner_id?: string;
    readonly action_id?: string;
}
export interface GoldenLineRecord {
    readonly line_id: string;
    readonly role: string;
    readonly outcome: string;
    readonly quality: string;
    readonly result_hash: string;
    readonly terminated: {
        readonly reason: string;
        readonly s: number;
        readonly t: number;
    };
    readonly events: readonly GoldenEventRecord[];
    /** raw re-analysis (the tap): corners rows straight off analyzeCorners, never the rounded verdict */
    readonly corners: unknown;
    readonly phi_max_deg: number;
    readonly grip_min: number;
    readonly v_min_ms: number;
    readonly checks: readonly {
        readonly id: string;
        readonly verdict: string;
    }[];
}
export interface GoldenRecord {
    readonly fixture: string;
    readonly engine_semver: string;
    readonly input: RosterInput;
    readonly lines: readonly GoldenLineRecord[];
    /** this fixture's contribution to the 02 §8.1 block (empty for non-block fixtures) */
    readonly blessed: readonly BlessedRow[];
}
export interface TolLabels {
    readonly positions: string;
    readonly angles: string;
    readonly speeds: string;
    readonly apex_pct: string;
    readonly fractions: string;
}
export declare function tolLabelsFrom(tolerancesJson: unknown): TolLabels;
/** the 02 §8-enumerated quantities present on this line (raw f64 via the tap). */
export declare function blessedRowsFor(fixture: string, line: LineResult, road: RoadModel, tol: TolLabels): BlessedRow[];
export interface RosterFailure {
    readonly fixture: string;
    readonly error: unknown;
}
export type ComputeResult = {
    readonly ok: true;
    readonly records: readonly GoldenRecord[];
} | {
    readonly ok: false;
    readonly failure: RosterFailure;
};
export declare function computeGoldenRecords(tol: TolLabels): ComputeResult;
export declare const BLESSED_BEGIN_RE: RegExp;
export declare const BLESSED_BLOCK_RE: RegExp;
/** rows in roster order, values printed at full (shortest round-trip) precision. */
export declare function formatBlessedBlock(records: readonly GoldenRecord[], engineSemver: string, dateIso: string): string;
/** replace the marker-delimited block; typed failure when the markers are absent. */
export declare function spliceBlessedBlock(docText: string, block: string): {
    ok: true;
    value: string;
} | {
    ok: false;
    error: string;
};
/** parse the committed block's own header identity (engine, date) for regeneration. */
export declare function parseBlessedHeader(docText: string): {
    engine: string;
    date: string;
} | null;
export interface StampResult {
    readonly file: string;
    readonly stamped: boolean;
    readonly reason?: string;
}
