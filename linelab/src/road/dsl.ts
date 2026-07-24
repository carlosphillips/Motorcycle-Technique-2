// road/dsl.ts — parseRoadDSL / printRoadDSL (design/03 §3).
//
// One line, segments separated by `|`, whitespace-tolerant:
//
//   lane <w>              lane width, metres — must appear EXACTLY ONCE and FIRST
//   S <len>               straight
//   L <r> ^<deg>          left arc:  radius r, sweep deg
//   R <r> ^<deg>          right arc
//   L <r1>><r2> ^<deg>    left taper  (r1 → r2 across the sweep)
//   R <r1>><r2> ^<deg>    right taper
//
// Numbers are strict positive decimals (regex ^\d*\.?\d+$): no signs, no bare
// dots, no empties — a malformed token can never silently become 0 or NaN.
// `parse ∘ print ∘ parse` is an identity over the DSL-expressible subset.
// `bike_margin_m`, `use_full_width`, `ds_m` are deliberately NOT DSL-expressible.
// Reserved grammar space: the per-segment width suffix (`S 40 w=4.0`) rejects
// with a typed error naming the reservation (D8; reason token pinned by
// ARCHITECTURE §10.5: `segment_width_reserved`).
//
// Corner ids are minted by compose() in segment order; the text never carries ids.

import type { Result, LinelabError } from "../core/result.js";
import { ok, err } from "../core/result.js";
import type { Hand } from "../core/types.js";
import type { Segment, SegmentsRoadSpec } from "./types.js";

/** design/03 §3 — THE strict number lexer, verbatim. */
const NUMBER_RE = /^\d*\.?\d+$/;

/** The reserved per-segment width suffix (`w=...`), rejected by name (D8). */
const WIDTH_SUFFIX_RE = /^w=/;

function schemaErr(at: string, message: string, reason: string): LinelabError {
  return { code: "SCHEMA", at, message, detail: { reason } };
}

/**
 * Lex one strict-positive-decimal token. Returns the number, or an error naming
 * the token. Zero (`0`, `0.0`, …) passes the regex but is not a "strict positive
 * decimal" — it rejects BAD_RANGE so a degenerate dimension can never slip in.
 */
function lexNumber(token: string, at: string): Result<number> {
  if (!NUMBER_RE.test(token)) {
    return err({
      code: "SCHEMA",
      at,
      message: `"${token}" is not a strict positive decimal (no signs, no bare dots, no empties)`,
      detail: { reason: "dsl_malformed_number", token }
    });
  }
  const value = Number(token);
  if (value <= 0) {
    return err({
      code: "BAD_RANGE",
      at,
      message: `"${token}" must be a strictly positive number`,
      detail: { reason: "dsl_nonpositive_number", token }
    });
  }
  return ok(value);
}

/** Reject the reserved width suffix anywhere it appears in a segment (design/03 §3). */
function findReservedToken(tokens: readonly string[], at: string): LinelabError | undefined {
  for (const t of tokens) {
    if (WIDTH_SUFFIX_RE.test(t)) {
      return {
        code: "SCHEMA",
        at,
        message:
          `per-segment width ("${t}") is reserved grammar space for a future version — ` +
          `lane width is a single global value in v1`,
        detail: { reason: "segment_width_reserved", token: t }
      };
    }
  }
  return undefined;
}

/**
 * parseRoadDSL(str) → Result<roadSpec> (design/03 §3). Returns the segments-form
 * roadSpec: `{ lane_width_m, segments }`. Whitespace-tolerant; grammar strict.
 */
export function parseRoadDSL(str: string): Result<SegmentsRoadSpec> {
  const parts = str.split("|").map((p) => p.trim());
  const first = parts[0];
  if (first === undefined || parts.length === 0) {
    return err(schemaErr("dsl", "empty road DSL", "dsl_no_segments"));
  }

  // `lane <w>` — exactly once, first.
  const laneTokens = first.split(/\s+/).filter((t) => t.length > 0);
  if (laneTokens[0] !== "lane" || laneTokens.length !== 2) {
    return err(
      schemaErr(
        "dsl[0]",
        `road DSL must begin "lane <w>" (got "${first}")`,
        "dsl_lane_exactly_once_first"
      )
    );
  }
  const laneTok = laneTokens[1];
  const lane = lexNumber(laneTok ?? "", "dsl[0]");
  if (!lane.ok) return lane;

  const segments: Segment[] = [];
  for (let i = 1; i < parts.length; i++) {
    const at = `dsl[${i}]`;
    const raw = parts[i] ?? "";
    const tokens = raw.split(/\s+/).filter((t) => t.length > 0);
    const head = tokens[0];
    if (head === undefined) {
      return err(schemaErr(at, "empty segment between separators", "dsl_bad_segment"));
    }
    if (head === "lane") {
      return err(
        schemaErr(at, `"lane" must appear exactly once and first`, "dsl_lane_exactly_once_first")
      );
    }
    const reserved = findReservedToken(tokens, at);
    if (reserved !== undefined) return err(reserved);

    if (head === "S") {
      if (tokens.length !== 2) {
        return err(schemaErr(at, `straight is "S <len>" (got "${raw}")`, "dsl_bad_segment"));
      }
      const len = lexNumber(tokens[1] ?? "", at);
      if (!len.ok) return len;
      segments.push({ type: "straight", len_m: len.value });
      continue;
    }

    if (head === "L" || head === "R") {
      const hand: Hand = head;
      if (tokens.length !== 3) {
        return err(
          schemaErr(at, `arc/taper is "${head} <r>[><r2>] ^<deg>" (got "${raw}")`, "dsl_bad_segment")
        );
      }
      const radiusTok = tokens[1] ?? "";
      const sweepTok = tokens[2] ?? "";
      if (!sweepTok.startsWith("^")) {
        return err(
          schemaErr(at, `sweep must be spelled "^<deg>" (got "${sweepTok}")`, "dsl_bad_segment")
        );
      }
      const angle = lexNumber(sweepTok.slice(1), at);
      if (!angle.ok) return angle;

      if (radiusTok.includes(">")) {
        const radii = radiusTok.split(">");
        if (radii.length !== 2) {
          return err(
            schemaErr(at, `taper radii are "<r1>><r2>" (got "${radiusTok}")`, "dsl_bad_segment")
          );
        }
        const r1 = lexNumber(radii[0] ?? "", at);
        if (!r1.ok) return r1;
        const r2 = lexNumber(radii[1] ?? "", at);
        if (!r2.ok) return r2;
        segments.push({
          type: "taper",
          r1_m: r1.value,
          r2_m: r2.value,
          angle_deg: angle.value,
          hand
        });
      } else {
        const r = lexNumber(radiusTok, at);
        if (!r.ok) return r;
        segments.push({ type: "arc", r_m: r.value, angle_deg: angle.value, hand });
      }
      continue;
    }

    return err(
      schemaErr(at, `unknown segment head "${head}" (expected S, L, or R)`, "dsl_bad_segment")
    );
  }

  if (segments.length === 0) {
    return err(schemaErr("dsl", "road DSL carries no segments", "dsl_no_segments"));
  }

  return ok(
    Object.freeze({
      lane_width_m: lane.value,
      segments: Object.freeze(segments)
    })
  );
}

/**
 * Format a positive finite number as a plain decimal literal the strict lexer
 * re-parses — ECMAScript shortest form, with exponent notation expanded (so the
 * round-trip identity survives extreme magnitudes).
 */
function fmtNum(n: number): string {
  const s = String(n);
  if (!/[eE]/.test(s)) return s;
  const [coeff = "", expPart = "0"] = s.split(/[eE]/);
  const exp = Number(expPart);
  const [intPart = "0", fracPart = ""] = coeff.split(".");
  const digits = intPart + fracPart;
  const pointAt = intPart.length + exp; // decimal point position within `digits`
  if (pointAt <= 0) return "0." + "0".repeat(-pointAt) + digits;
  if (pointAt >= digits.length) return digits + "0".repeat(pointAt - digits.length);
  return digits.slice(0, pointAt) + "." + digits.slice(pointAt);
}

/**
 * printRoadDSL(spec) → string (design/03 §3): the canonical one-line spelling
 * (` | ` separators, single spaces). `parse ∘ print ∘ parse` is an identity;
 * the §3.1 preset table strings are already in this canonical form.
 */
export function printRoadDSL(spec: {
  readonly lane_width_m: number;
  readonly segments: readonly Segment[];
}): string {
  const parts: string[] = [`lane ${fmtNum(spec.lane_width_m)}`];
  for (const seg of spec.segments) {
    if (seg.type === "straight") {
      parts.push(`S ${fmtNum(seg.len_m)}`);
    } else if (seg.type === "arc") {
      parts.push(`${seg.hand} ${fmtNum(seg.r_m)} ^${fmtNum(seg.angle_deg)}`);
    } else {
      parts.push(`${seg.hand} ${fmtNum(seg.r1_m)}>${fmtNum(seg.r2_m)} ^${fmtNum(seg.angle_deg)}`);
    }
  }
  return parts.join(" | ");
}
