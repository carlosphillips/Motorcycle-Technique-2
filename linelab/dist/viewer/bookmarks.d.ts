import type { Result } from "../core/result.js";
import type { LineResult } from "../solve/types.js";
import type { Bookmark } from "./types.js";
/**
 * `bookmarksOf(line)` — THE bookmark set of a line: `trajectory.events`,
 * one-for-one, in order. The returned array's length is always exactly
 * `line.trajectory.events.length`; that equality IS `C-BOOKMARKS`.
 */
export declare function bookmarksOf(line: LineResult): readonly Bookmark[];
/** The round-trip's forward half: `Bookmark → token`. Total, never fails. */
export declare function printBookmark(b: Bookmark): string;
/**
 * The round-trip's reverse half: `token → Bookmark`, resolved against the line
 * the token was printed from. `UNKNOWN_ID` when the kind is not one of 05 §5's
 * closed kinds or the ordinal names an occurrence this line does not have —
 * never a silent nearest-match.
 */
export declare function parseBookmark(token: string, line: LineResult): Result<Bookmark>;
