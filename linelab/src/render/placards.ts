// render/placards.ts — the stage-11 placard box layout (design/06 §3.1:
// "figure-level placard boxes"; design/01 §8's placard policy). Pure: text in,
// wrapped lines and a band height out. No DOM, no IO, no host font metric —
// design/06 §3 forbids the first two and §4 says outright that "there is no
// text metric in a pure string builder, so the estimate is the mechanism".
//
// The letter specifies the SLOT (stage 11, drawn last, margin chrome) and says
// nothing about box geometry, wrap width, line breaking or overflow. The
// choices below are this file's, and they are constrained rather than free:
//   - the wrap is a CHARACTER count, because P-EXPORT-DETERMINISM (09 §3.1)
//     needs byte-identical output on the pinned runtime and a measured wrap
//     would depend on the host's fonts. The width estimate reuses
//     render/controls.ts's own ratio (0.58 × font px), the prior art;
//   - a word is never split. A word longer than the column overflows its line
//     rather than being cut, exactly as controls.ts's estimate "only ever adds
//     width" — an honest approximation errs by looking wrong, never by lying;
//   - the band is measured in NOMINAL-FRAME pixels (design/06 §5.2's "at the
//     nominal 1000 px frame"), so callers scale it by `pxScale` like every
//     other chrome constant in render/topdown.ts.

/** design/06 §5.2's neutral annotation ink — the §2.7 footnote's own grey. A placard is chrome, never a grade (§5.1). */
export const PLACARD_INK = "#555555";

export const PLACARD_FONT_PX = 10;
export const PLACARD_LINE_PX = 13;
/** box edge → text, and the same gap under the last line */
export const PLACARD_PAD_PX = 6;
/** between two boxes in the band */
export const PLACARD_GAP_PX = 8;
/** above the first box and below the last */
export const PLACARD_BAND_PAD_PX = 8;
/** the text column, 62% of the nominal 1000 px frame — a measure that reads, not the full width */
export const PLACARD_COLUMN_PX = 620;

/** render/controls.ts:95's estimate, reused: there is no font metric here, so the ratio IS the mechanism. */
const PLACARD_CHAR_W_PX = PLACARD_FONT_PX * 0.58;

/** How many characters fit the column at `PLACARD_FONT_PX`. Deterministic by construction. */
export const PLACARD_WRAP_CHARS = Math.floor(PLACARD_COLUMN_PX / PLACARD_CHAR_W_PX);

/**
 * Greedy whitespace wrap at `maxChars`. Total: every input returns at least one
 * line, words are never split, and `lines.join(" ")` recovers the input with
 * runs of whitespace collapsed to single spaces (the tests assert exactly that
 * — a wrap that dropped or invented a character would be a fabrication).
 */
export function wrapPlacard(text: string, maxChars: number = PLACARD_WRAP_CHARS): readonly string[] {
  const words = text.trim().split(/\s+/).filter((w) => w.length > 0);
  if (words.length === 0) return [""];
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    if (cur.length === 0) cur = w;
    else if (cur.length + 1 + w.length <= maxChars) cur = `${cur} ${w}`;
    else {
      lines.push(cur);
      cur = w;
    }
  }
  lines.push(cur);
  return lines;
}

/** One box's height in nominal-frame px, given its already-wrapped lines. */
export function placardBoxHeightPx(lines: readonly string[]): number {
  return lines.length * PLACARD_LINE_PX + 2 * PLACARD_PAD_PX;
}

/**
 * The height of the whole placard band in nominal-frame px — `0` when the
 * figure declares none, which is what keeps a placard-free figure's viewBox
 * (and therefore its bytes) exactly where it was.
 */
export function placardBandHeightPx(placards: readonly string[], maxChars: number = PLACARD_WRAP_CHARS): number {
  if (placards.length === 0) return 0;
  const boxes = placards.map((p) => placardBoxHeightPx(wrapPlacard(p, maxChars)));
  return 2 * PLACARD_BAND_PAD_PX + boxes.reduce((a, b) => a + b, 0) + PLACARD_GAP_PX * (placards.length - 1);
}
