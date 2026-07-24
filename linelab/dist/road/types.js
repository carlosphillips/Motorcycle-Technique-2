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
// ---------------------------------------------------------------------------
// Segments (design/03 §2.1, verbatim)
export const SEGMENT_TYPES = ["straight", "arc", "taper"];
/** Discriminators for the road union (validate/compose share them). */
export function isSegmentsSpec(spec) {
    return "segments" in spec;
}
export function isPresetSpec(spec) {
    return "preset" in spec;
}
export function isDslSpec(spec) {
    return "dsl" in spec;
}
//# sourceMappingURL=types.js.map