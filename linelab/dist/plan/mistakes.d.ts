import type { Result } from "../core/result.js";
import type { Outcome } from "../core/types.js";
import type { MistakeScope } from "./types.js";
export declare const EXECUTION_MISTAKE_KINDS: readonly ["premature", "premature_contained", "slow_steer", "fifty_pence", "chop", "overspeed"];
export type ExecutionMistakeKind = (typeof EXECUTION_MISTAKE_KINDS)[number];
export declare const MISJUDGMENT_MISTAKE_KINDS: readonly ["underread", "overread"];
export type MisjudgmentMistakeKind = (typeof MISJUDGMENT_MISTAKE_KINDS)[number];
export declare const MISTAKE_KINDS: readonly ["premature", "premature_contained", "slow_steer", "fifty_pence", "chop", "overspeed", "underread", "overread"];
export type MistakeKind = (typeof MISTAKE_KINDS)[number];
/** The retired name (D25) — `explain early_apex` prints the rewrite hint. */
export declare const RETIRED_MISTAKE_NAME = "early_apex";
export interface MistakeParamDef {
    readonly name: string;
    /** absent on params with no author-facing default (e.g. underread/overread's r_believed on an arc corner) */
    readonly default?: number;
    readonly units?: string;
    readonly note: string;
}
export interface MistakeKindDef {
    readonly kind: MistakeKind;
    readonly family: "execution" | "misjudgment";
    readonly params: readonly MistakeParamDef[];
    readonly perturbation: string;
    readonly book_mapping: string;
}
export declare const MISTAKE_KIND_DEFS: Readonly<Record<MistakeKind, MistakeKindDef>>;
export type OracleFixture = "F-ORACLE-90" | "F-ORACLE-DR" | "F-ORACLE-CHAIN";
export interface MistakePinRow {
    readonly kind: MistakeKind;
    /** absent = the target corner (default scope); "all_corners" = the fig 8.6 chained-compounding row */
    readonly scope?: "all_corners";
    readonly admissible_outcomes: readonly Outcome[];
    readonly fixture: OracleFixture;
    readonly fixture_pin: Outcome;
    readonly fixture_pin_note?: string;
    /** the mandatory `expect_fail` binding (§7.1 rule/col 5); "applicable_check_fails" = ≥1 applicable check fails (quality caution), no fixed id */
    readonly expect_fail?: readonly string[] | "applicable_check_fails";
    readonly book_figure: string;
    readonly teaches: string;
}
export declare const MISTAKE_PIN_TABLE: readonly MistakePinRow[];
export interface ResolvedMistakeSpec {
    readonly line_id?: string;
    readonly kind: MistakeKind;
    readonly params?: Readonly<Record<string, string>>;
    readonly scope?: MistakeScope;
}
/**
 * `parseMistakeToken(token) → Result<ResolvedMistakeSpec>` (values still raw
 * strings — numeric coercion is compileMistake's job, WP-12, since param
 * meaning is per-kind).
 */
export declare function parseMistakeToken(token: string, at: string): Result<ResolvedMistakeSpec>;
/** `printMistakeToken(spec) → string` — the inverse of parseMistakeToken (token ↔ JSON bijection, D32). */
export declare function printMistakeToken(spec: ResolvedMistakeSpec): string;
