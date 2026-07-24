// road/types.ts — Segment, the roadSpec union, CornerRecord, and the composed
// RoadModel implementation type (ARCHITECTURE §4 type-ownership table; design/03 §2.1).
//
// The wire `road` union is copied VERBATIM from design/03 §2.1:
//
//   Segment = { type: "straight", len_m }
//           | { type: "arc",   r_m,        angle_deg, hand: "L"|"R" }
//           | { type: "taper", r1_m, r2_m, angle_deg, hand: "L"|"R" }
//
//   road = { lane_width_m, bike_margin_m?, use_full_width?, segments: [Segment…] }
//        | { preset: "<name>", hand?: "L"|"R", use_full_width?, bike_margin_m? }
//        | { dsl: "<road-DSL line>", use_full_width?, bike_margin_m? }
//
// `hand` beside `segments` or `dsl` is a wire-level SCHEMA rejection
// (`hand_on_explicit_road`) owned by plan/validate.ts — the types here simply do
// not carry it. The reserved `traffic` field is likewise rejected at validation.

import type { Corner, Hand, RoadModel } from "../core/types.js";

// ---------------------------------------------------------------------------
// Segments (design/03 §2.1, verbatim)

export const SEGMENT_TYPES = ["straight", "arc", "taper"] as const;
export type SegmentType = (typeof SEGMENT_TYPES)[number];

export interface StraightSegment {
  readonly type: "straight";
  /** m — length along the centreline */
  readonly len_m: number;
}

export interface ArcSegment {
  readonly type: "arc";
  /** m — constant centreline radius */
  readonly r_m: number;
  /** deg — swept angle */
  readonly angle_deg: number;
  readonly hand: Hand;
}

/** Clothoid-like radius sweep r1 → r2; r is linear in SWEPT ANGLE (design/03 §2, §7a.4). */
export interface TaperSegment {
  readonly type: "taper";
  /** m — entry radius */
  readonly r1_m: number;
  /** m — exit radius */
  readonly r2_m: number;
  /** deg — swept angle */
  readonly angle_deg: number;
  readonly hand: Hand;
}

export type Segment = StraightSegment | ArcSegment | TaperSegment;

// ---------------------------------------------------------------------------
// The roadSpec union (design/03 §2.1)

export interface SegmentsRoadSpec {
  readonly lane_width_m: number;
  readonly bike_margin_m?: number;
  readonly use_full_width?: boolean;
  readonly segments: readonly Segment[];
}

export interface PresetRoadSpec {
  readonly preset: string;
  /** requested lead hand; omitted → the preset's default (book-ink) hand */
  readonly hand?: Hand;
  readonly use_full_width?: boolean;
  readonly bike_margin_m?: number;
}

export interface DslRoadSpec {
  readonly dsl: string;
  readonly use_full_width?: boolean;
  readonly bike_margin_m?: number;
}

export type RoadSpec = SegmentsRoadSpec | PresetRoadSpec | DslRoadSpec;

/** Discriminators for the road union (validate/compose share them). */
export function isSegmentsSpec(spec: RoadSpec): spec is SegmentsRoadSpec {
  return "segments" in spec;
}
export function isPresetSpec(spec: RoadSpec): spec is PresetRoadSpec {
  return "preset" in spec;
}
export function isDslSpec(spec: RoadSpec): spec is DslRoadSpec {
  return "dsl" in spec;
}

// ---------------------------------------------------------------------------
// Corner record (design/03 §2) — the interface itself lives at core rank
// (core/types.ts `Corner`, which the engine consumes); the design-doc name is
// re-exported here per the §4 ownership table. Never re-declared.

export type CornerRecord = Corner;

// ---------------------------------------------------------------------------
// Composed model implementation type

/** One row of the dense station lookup `{s, x, y, psi, kappa}` at ds_m spacing (design/03 §2). */
export interface StationPoint {
  /** m — station */
  readonly s: number;
  /** m — world x (east) */
  readonly x: number;
  /** m — world y (down) */
  readonly y: number;
  /** rad — road heading */
  readonly psi: number;
  /** 1/m — signed local curvature; +kappa = right-hand turn */
  readonly kappa: number;
}

/**
 * The frozen value `compose()` actually returns — the core `RoadModel` interface
 * plus the road-rank extras downstream modules need (segments list, disclosed
 * DSL, dense station table, world-point helper). `sight/` walks `stations` for
 * ride-lane-centre targets; `plan/` reads `segments`/`dsl` for the canonical
 * resolved road form.
 */
export interface ComposedRoad extends RoadModel {
  /** resolved segment list (never hand-expanded by agents — this IS the expansion) */
  readonly segments: readonly Segment[];
  /**
   * The disclosed road DSL (design/03 §3.1: preset expansion is disclosed; the
   * resolved DSL appears verbatim in every result). Preset roads carry the §3.1
   * table string (default hand) or its printRoadDSL re-spelling (flipped hand);
   * dsl-authored roads carry the authored string verbatim; segment-authored
   * roads carry printRoadDSL(spec) (ARCHITECTURE §10.6).
   */
  readonly dsl: string;
  /** dense station lookup at ds_m spacing, last row exactly at total_len_m */
  readonly stations: readonly StationPoint[];
  /** world position of the point at station s, signed lateral offset d (+d = rider's LEFT) */
  readonly worldAt: (s: number, d: number) => { readonly x: number; readonly y: number };
}
