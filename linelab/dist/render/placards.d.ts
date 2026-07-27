/** design/06 §5.2's neutral annotation ink — the §2.7 footnote's own grey. A placard is chrome, never a grade (§5.1). */
export declare const PLACARD_INK = "#555555";
export declare const PLACARD_FONT_PX = 10;
export declare const PLACARD_LINE_PX = 13;
/** box edge → text, and the same gap under the last line */
export declare const PLACARD_PAD_PX = 6;
/** between two boxes in the band */
export declare const PLACARD_GAP_PX = 8;
/** above the first box and below the last */
export declare const PLACARD_BAND_PAD_PX = 8;
/** the text column, 62% of the nominal 1000 px frame — a measure that reads, not the full width */
export declare const PLACARD_COLUMN_PX = 620;
/** How many characters fit the column at `PLACARD_FONT_PX`. Deterministic by construction. */
export declare const PLACARD_WRAP_CHARS: number;
/**
 * Greedy whitespace wrap at `maxChars`. Total: every input returns at least one
 * line, words are never split, and `lines.join(" ")` recovers the input with
 * runs of whitespace collapsed to single spaces (the tests assert exactly that
 * — a wrap that dropped or invented a character would be a fabrication).
 */
export declare function wrapPlacard(text: string, maxChars?: number): readonly string[];
/** One box's height in nominal-frame px, given its already-wrapped lines. */
export declare function placardBoxHeightPx(lines: readonly string[]): number;
/**
 * The height of the whole placard band in nominal-frame px — `0` when the
 * figure declares none, which is what keeps a placard-free figure's viewBox
 * (and therefore its bytes) exactly where it was.
 */
export declare function placardBandHeightPx(placards: readonly string[], maxChars?: number): number;
