// viewer/bookmarks.ts — `C-BOOKMARKS` (design/07 §3.1): **named jump points
// are exactly the result's `events` array, and there is no other bookmark
// source.**
//
// The law, verbatim in its consequences:
//   · one bookmark per entry of `trajectory.events`, in that array's order
//     (05 §5 orders events by `t`, ties by EVENT_KINDS declaration order), and
//     no bookmark that is not one;
//   · plan-action starts are already events (`brake_start`, `turn_in`,
//     `position_start`, …) — "plan stations" would be a redundant second
//     pathway and are NOT a source here;
//   · D45 `probe#1..#N` targets are read from a `CommitmentReport`, never from
//     `events` — and the report is deferred, so they do not exist in this
//     phase; D44's `tau_close_s` is "not an event and not a named jump target".
//     Neither can reach this file: its only input is `trajectory.events`.
//
// Clicking a tick "lands the scrubber at the event's interpolated `t`" — so a
// Bookmark carries the event's own exact `t` (05 §5: event `s`/`t` are exact
// bracketed crossings, never snapped to the resample grid), and `jumpTo`
// (viewer/stepper.ts) copies it through without arithmetic.

import type { Event, EventKind } from "../core/types.js";
import { EVENT_KINDS } from "../core/types.js";
import type { Result } from "../core/result.js";
import { ok, err } from "../core/result.js";
import type { LineResult } from "../solve/types.js";
import type { Bookmark } from "./types.js";

/**
 * design/07 §3.1's own spelling: the first tick of a kind is bare (`apex`),
 * repeats carry the 1-based ordinal (`apex#2` "on a double-apex corner").
 * This is also the serialized form — see `printBookmark`.
 */
function labelFor(kind: EventKind, ordinal: number): string {
  return ordinal <= 1 ? kind : `${kind}#${ordinal}`;
}

function bookmarkOf(e: Event, index: number, ordinal: number): Bookmark {
  return Object.freeze({
    kind: e.kind,
    index,
    ordinal,
    label: labelFor(e.kind, ordinal),
    t: e.t,
    s: e.s,
    corner_id: e.corner_id ?? null
  });
}

/**
 * `bookmarksOf(line)` — THE bookmark set of a line: `trajectory.events`,
 * one-for-one, in order. The returned array's length is always exactly
 * `line.trajectory.events.length`; that equality IS `C-BOOKMARKS`.
 */
export function bookmarksOf(line: LineResult): readonly Bookmark[] {
  const seen = new Map<EventKind, number>();
  return Object.freeze(
    line.trajectory.events.map((e, index) => {
      const ordinal = (seen.get(e.kind) ?? 0) + 1;
      seen.set(e.kind, ordinal);
      return bookmarkOf(e, index, ordinal);
    })
  );
}

// ---------------------------------------------------------------------------
// Serialization
//
// A bookmark's serialized form is its LABEL — `<kind>` or `<kind>#<ordinal>`,
// the spelling design/07 §3.1 prints on the timeline. It is view-level state
// (07 §6.3), not a wire contract: it never enters a verdict, a hash, or an
// export. It is line-relative by construction, because the ordinal counts
// occurrences within one line — which is why `parseBookmark` needs the line to
// resolve a token back to an event.

const KIND_BY_NAME = new Map<string, EventKind>(EVENT_KINDS.map((k) => [k, k]));

/** The round-trip's forward half: `Bookmark → token`. Total, never fails. */
export function printBookmark(b: Bookmark): string {
  return b.label;
}

/**
 * The round-trip's reverse half: `token → Bookmark`, resolved against the line
 * the token was printed from. `UNKNOWN_ID` when the kind is not one of 05 §5's
 * closed kinds or the ordinal names an occurrence this line does not have —
 * never a silent nearest-match.
 */
export function parseBookmark(token: string, line: LineResult): Result<Bookmark> {
  const hash = token.indexOf("#");
  const kindText = hash < 0 ? token : token.slice(0, hash);
  const ordinalText = hash < 0 ? "1" : token.slice(hash + 1);

  const kind = KIND_BY_NAME.get(kindText);
  if (kind === undefined) {
    return err({
      code: "UNKNOWN_ID",
      at: "bookmark",
      message: `unknown event kind "${kindText}" — bookmarks name events only (07 §3.1)`,
      detail: { reason: "unknown_event_kind", token }
    });
  }
  if (!/^[1-9][0-9]*$/.test(ordinalText)) {
    return err({
      code: "SCHEMA",
      at: "bookmark",
      message: `bookmark ordinal must be a positive integer, got "${ordinalText}"`,
      detail: { reason: "bookmark_ordinal_not_integer", token }
    });
  }
  const ordinal = Number(ordinalText);

  const found = bookmarksOf(line).find((b) => b.kind === kind && b.ordinal === ordinal);
  if (found === undefined) {
    return err({
      code: "UNKNOWN_ID",
      at: "bookmark",
      message: `line "${line.line_id}" has no "${token}" event`,
      detail: { reason: "bookmark_not_on_line", token, line_id: line.line_id }
    });
  }
  return ok(found);
}
