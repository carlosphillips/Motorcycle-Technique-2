// road/presets.ts — the book-proportioned road presets (design/03 §3.1 table,
// VERBATIM — the test byte-compares this table against the design doc).
// All geometry is TUNING. Every preset's default hand equals its book figure's
// ink hand (D26), so the shipped book scenes carry zero hand tokens.
//
// Road-ref token (scene `road:` line and `--road` flag, shared verbatim):
// `preset <name> [hand=L|R]`. `hand=` flips every arc/taper segment's hand
// (L↔R) — a road-level mirror through the hand-relative vocabulary; the traffic
// side does NOT flip; the view layer rotates but never reflects (06 §2.1).
// Preset expansion is DISCLOSED: the resolved DSL appears verbatim in every result.

import type { Result } from "../core/result.js";
import { ok, err } from "../core/result.js";
import type { Hand } from "../core/types.js";
import type { Segment, SegmentsRoadSpec } from "./types.js";
import { parseRoadDSL, printRoadDSL } from "./dsl.js";

export const PRESET_NAMES = [
  "book90",
  "bookDecreasing",
  "bookEsses",
  "bookHairpin",
  "bookBlind",
  "bookDoubleApex"
] as const;
export type PresetName = (typeof PRESET_NAMES)[number];

export interface PresetDef {
  /** the §3.1 expansion at the default hand, canonical DSL spelling */
  readonly dsl: string;
  /** default hand = the book figure's ink hand (D26) */
  readonly hand: Hand;
  /** placement tokens, verbatim (§4 grammar; parsed by plan/placements) — byte-identical under any hand flip */
  readonly occluders: readonly string[];
  /** km/h — suggested entry speed */
  readonly suggested_entry_kmh: number;
}

/**
 * design/03 §3.1, verbatim. `bookBlind` is the D46 reshape (`^140`, S 16
 * approach, 34 km/h — no longer book90 geometry; it illustrates Ch. 8's
 * blind-corner ARGUMENT, not fig 8.1's ink). `bookEsses` `S 6` links =
 * LINK_GAP_M (road/constants.ts). `bookDoubleApex` mints c1..c3, one corner group.
 */
export const PRESETS: Readonly<Record<PresetName, PresetDef>> = Object.freeze({
  book90: Object.freeze({
    dsl: "lane 3.5 | S 12 | L 12 ^90 | S 16",
    hand: "L",
    occluders: Object.freeze([]),
    suggested_entry_kmh: 34
  }),
  bookDecreasing: Object.freeze({
    dsl: "lane 3.5 | S 10 | L 16>9 ^130 | S 14",
    hand: "L",
    occluders: Object.freeze([]),
    suggested_entry_kmh: 34
  }),
  bookEsses: Object.freeze({
    dsl: "lane 3.5 | S 8 | R 12 ^75 | S 6 | L 12 ^75 | S 6 | R 12 ^75 | S 6 | L 12 ^75 | S 10",
    hand: "R",
    occluders: Object.freeze([]),
    suggested_entry_kmh: 32
  }),
  bookHairpin: Object.freeze({
    dsl: "lane 3.5 | S 10 | R 10 ^150 | S 12",
    hand: "R",
    occluders: Object.freeze([]),
    suggested_entry_kmh: 28
  }),
  bookBlind: Object.freeze({
    dsl: "lane 3.5 | S 16 | L 12 ^140 | S 16",
    hand: "L",
    occluders: Object.freeze(["hedge inside c1 -6x36 margin=1.2 depth=2.5"]),
    suggested_entry_kmh: 34
  }),
  bookDoubleApex: Object.freeze({
    dsl: "lane 3.5 | S 10 | L 12 ^70 | L 24 ^40 | L 12 ^70 | S 12",
    hand: "L",
    occluders: Object.freeze([]),
    suggested_entry_kmh: 30
  })
} as const);

/** Flip every arc/taper segment's hand L↔R (straights untouched) — the road-level mirror. */
export function flipSegments(segments: readonly Segment[]): readonly Segment[] {
  return Object.freeze(
    segments.map((seg): Segment => {
      if (seg.type === "straight") return seg;
      const hand: Hand = seg.hand === "L" ? "R" : "L";
      return Object.freeze({ ...seg, hand });
    })
  );
}

export interface ResolvedPreset {
  readonly name: PresetName;
  /** the effective lead hand after any flip */
  readonly hand: Hand;
  /** the disclosed DSL: the table string at default hand, printRoadDSL of the flipped spec otherwise */
  readonly dsl: string;
  readonly spec: SegmentsRoadSpec;
  readonly occluders: readonly string[];
  readonly suggested_entry_kmh: number;
}

/**
 * Resolve a preset name (+ optional requested hand) to its disclosed expansion.
 * `hand` equal to the default is a no-op; the other hand flips every arc/taper
 * segment (occluder tokens are hand-relative and ride through byte-identical —
 * design/03 §3.1's live demonstration). Unknown name → UNKNOWN_ID.
 */
export function resolvePreset(name: string, hand?: Hand): Result<ResolvedPreset> {
  const def = (PRESETS as Record<string, PresetDef | undefined>)[name];
  if (def === undefined) {
    return err({
      code: "UNKNOWN_ID",
      at: `road.preset`,
      message: `unknown preset "${name}" (known: ${PRESET_NAMES.join(", ")})`,
      detail: { reason: "unknown_preset", known: [...PRESET_NAMES] }
    });
  }
  const parsed = parseRoadDSL(def.dsl);
  if (!parsed.ok) return parsed; // unreachable: table strings are canonical (tested)

  const effective: Hand = hand ?? def.hand;
  if (effective === def.hand) {
    return ok(
      Object.freeze({
        name: name as PresetName,
        hand: def.hand,
        dsl: def.dsl,
        spec: parsed.value,
        occluders: def.occluders,
        suggested_entry_kmh: def.suggested_entry_kmh
      })
    );
  }
  const flipped: SegmentsRoadSpec = Object.freeze({
    lane_width_m: parsed.value.lane_width_m,
    segments: flipSegments(parsed.value.segments)
  });
  return ok(
    Object.freeze({
      name: name as PresetName,
      hand: effective,
      dsl: printRoadDSL(flipped),
      spec: flipped,
      occluders: def.occluders,
      suggested_entry_kmh: def.suggested_entry_kmh
    })
  );
}
