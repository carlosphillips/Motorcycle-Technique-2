import { type CheckId } from "../../plan/doctrine/checks.js";
import { type ErrorCode } from "../../core/result.js";
import { type MistakeKind } from "../../plan/mistakes.js";
import { type GateOptions } from "../../solve/gate.js";
import type { LinelabError } from "../../core/result.js";
export interface ExplainCheckDoc {
    readonly kind: "check";
    readonly id: CheckId;
    readonly message: string;
    readonly teaches: string;
    readonly book_ref: string;
    readonly scope: string;
    readonly severity: string;
    /**
     * The same check said to a rider (plan/doctrine/lexicon.ts): what it is
     * about, why it matters on a road, and what to do differently. `teaches` is
     * the rubric pack's own sentence about the CHECK; `rider.fix` is the only
     * field that tells someone what to change.
     */
    readonly rider: {
        readonly title: string;
        readonly why: string;
        readonly fix: string;
    };
}
export interface ExplainErrorCodeDoc {
    readonly kind: "error_code";
    readonly code: ErrorCode;
    readonly message: string;
}
export interface ExplainMistakeKindDoc {
    readonly kind: "mistake_kind";
    readonly mistake_kind: MistakeKind;
    readonly message: string;
    readonly params: readonly {
        readonly name: string;
        readonly default?: number;
        readonly units?: string;
        readonly note: string;
    }[];
    readonly admissible_outcomes: readonly string[];
    readonly book_figure: string;
}
export interface ExplainAnalysisDoc {
    readonly kind: "analysis";
    readonly target: string;
    readonly message: string;
    /**
     * D43: present on the standing-ladder targets (`standing`, `reserved`,
     * `reserve_checks`) — the threshold table, the rung-token gloss, the loaded
     * pack identity + annex, and the design/05 §6.4 placard verbatim
     * (design/08 §5.2; A-LADDER-PROSE).
     */
    readonly standing?: {
        /** index = rung: crash:0 … reserved:4 */
        readonly rungs: readonly string[];
        readonly thresholds: readonly string[];
        readonly gloss: string;
        readonly rubric: string;
        readonly checks_version: number;
        readonly reserve_checks: readonly string[];
        readonly placard: string;
    };
    /**
     * D44: present on the save-window targets (`save-window`, `tau_close_s`,
     * `reaction_budget_s`) — "all five `status` values with their sentences and
     * the 04 §4b.7 placard" (design/08 §5.2; A-SAVEWIN-PLACARD).
     */
    readonly save_window?: {
        readonly statuses: readonly string[];
        readonly sentences: Readonly<Record<string, string>>;
        /** HORIZON_DISPLAY_DP — every human-facing string clamps to it (04 §4b.5) */
        readonly display_dp: number;
        readonly placard: string;
    };
}
export interface ExplainLineNarration {
    readonly line_id: string;
    readonly refused: boolean;
    readonly headline?: string;
    readonly diagnosis?: unknown;
    readonly checks?: readonly {
        readonly id: string;
        readonly verdict: string;
        readonly message: string;
    }[];
    readonly expectation?: {
        readonly met: boolean;
        readonly misses: readonly string[];
    };
}
export interface ExplainEnvelopeDoc {
    readonly kind: "envelope";
    readonly figure_id: string;
    readonly lines: readonly ExplainLineNarration[];
}
export type ExplainDoc = ExplainCheckDoc | ExplainErrorCodeDoc | ExplainMistakeKindDoc | ExplainAnalysisDoc | ExplainEnvelopeDoc;
export interface ExplainOptions {
    readonly line?: string;
    /** present iff the caller narrates under --gate (design/08 §3.4's expectation member) */
    readonly gate?: GateOptions;
}
export declare function explain(input: unknown, opts?: ExplainOptions): {
    ok: true;
    value: ExplainDoc;
} | {
    ok: false;
    error: LinelabError;
};
