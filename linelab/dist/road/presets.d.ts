import type { Result } from "../core/result.js";
import type { Hand } from "../core/types.js";
import type { Segment, SegmentsRoadSpec } from "./types.js";
export declare const PRESET_NAMES: readonly ["book90", "bookDecreasing", "bookEsses", "bookHairpin", "bookBlind", "bookDoubleApex"];
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
export declare const PRESETS: Readonly<Record<PresetName, PresetDef>>;
/** Flip every arc/taper segment's hand L↔R (straights untouched) — the road-level mirror. */
export declare function flipSegments(segments: readonly Segment[]): readonly Segment[];
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
export declare function resolvePreset(name: string, hand?: Hand): Result<ResolvedPreset>;
