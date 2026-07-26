import type { CheckId } from "./checks.js";
/** One check, for a rider. */
export interface CheckPhrasing {
    /** the check's name in riding words — a noun phrase, not an identifier */
    readonly title: string;
    /** what it is about, and why it matters on a road rather than in a rubric */
    readonly why: string;
    /** what to do differently next time — the sentence the figures were missing */
    readonly fix: string;
}
export declare const CHECK_LEXICON: Readonly<Record<CheckId, CheckPhrasing>>;
/**
 * The check's evidence message, rewritten for a rider where the catalogue's own
 * wording is measured in the engine's units.
 *
 * Returns `null` when the catalogue's message already reads plainly — the
 * caller then shows the original rather than a worse paraphrase. Reads ONLY the
 * recorded metrics (never re-deriving anything), so a rewrite cannot say
 * something the check did not find.
 */
export declare function riderMessage(id: CheckId, metrics: Readonly<Record<string, unknown>> | undefined): string | null;
/** Every check id, with its phrasing — the shape the `explain` verb and the gallery consume. */
export declare function checkLexiconRows(): readonly (CheckPhrasing & {
    readonly id: CheckId;
})[];
