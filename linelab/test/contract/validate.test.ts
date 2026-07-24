// test/contract/validate.test.ts — WP-05 gates (ARCHITECTURE §8 row WP-05):
//   · worked position-reachability numbers (book90: f 0.5→0.9 rejected on a 12 m
//     entry straight, required_over_m ≈ 25.8 m)
//   · every 03 §6.2 reason token THIS package can mint is reachable (enumerated,
//     each with a constructed rejecting input)
//   · tombstone behavior (early_apex → UNKNOWN_ID/renamed_kind)
//   · anchor grammar accept/reject table
//   · hand-word rewrite hints (D26)
//   · effectuality of accepted inputs (precursor of T-D8): a fully-populated
//     scenario validates and every action kind resolves correctly
//
// Error assertions ride code + detail.reason, never message text (ARCHITECTURE §4).

import { describe, it, expect } from "vitest";

import { validate } from "../../src/plan/validate.js";
import { parseAnchorRef, parseAnchorToken, resolveAnchor } from "../../src/plan/anchors.js";
import { parseMistakeToken, RETIRED_MISTAKE_NAME } from "../../src/plan/mistakes.js";
import { compose } from "../../src/road/compose.js";
import type { LinelabError, Result } from "../../src/core/result.js";
import type { ValidatedScenario } from "../../src/plan/types.js";

function reasonOf(e: LinelabError): unknown {
  return e.detail?.["reason"];
}
function unwrap<T>(r: Result<T>): T {
  if (!r.ok) throw new Error(`expected ok, got ${r.error.code}/${String(reasonOf(r.error))}: ${r.error.message}`);
  return r.value;
}
function unwrapErr<T>(r: Result<T>): LinelabError {
  if (r.ok) throw new Error("expected an error result");
  return r.error;
}

/** A minimal legal book90 scenario, JSON.parse'd fresh so tests never share mutable state. */
function book90(overrides?: {
  readonly startSpeedKmh?: number;
  readonly startF?: number;
  readonly plan?: readonly unknown[];
}): unknown {
  return {
    spec: "linelab/1",
    id: "t",
    road: { preset: "book90" },
    rider: {
      profile: "street",
      start: { speed_kmh: overrides?.startSpeedKmh ?? 34, f: overrides?.startF ?? 1.0 },
      plan: overrides?.plan ?? []
    }
  };
}

// ---------------------------------------------------------------------------
// 1. Worked position-reachability numbers (design/03 §6.1, verbatim example)

describe("position reachability — book90 worked numbers", () => {
  it("rejects f 0.5→0.9 on the 12 m entry straight (34 km/h) — required_over_m ≈ 25.8 m", () => {
    const r = validate(
      book90({
        startF: 0.5,
        plan: [{ do: "position", id: "p1", at_s: 0, f: 0.9, over_m: 12 }]
      })
    );
    const e = unwrapErr(r);
    expect(e.code).toBe("INEFFECTUAL");
    expect(reasonOf(e)).toBe("position_target_unreachable");
    const detail = e.detail as { requested_dd_m: number; achievable_dd_m: number; over_m: number; required_over_m: number };
    expect(detail.requested_dd_m).toBeCloseTo(1.08, 2); // Δd on the book90 corridor (03 §6.1 worked example)
    expect(detail.achievable_dd_m).toBeLessThan(detail.requested_dd_m);
    expect(detail.over_m).toBe(12);
    expect(detail.required_over_m).toBeCloseTo(25.8, 1);
  });

  it("accepts the same reposition once the window is wide enough (over_m auto → whole road)", () => {
    const r = validate(
      book90({
        startF: 0.5,
        plan: [{ do: "position", id: "p1", at_s: 0, f: 0.9, over_m: "auto" }]
      })
    );
    unwrap(r);
  });

  it("the canonical visibility hold f 1.0→0.9 (Δd ≈ 0.27 m) is reachable at 34 km/h over a modest window", () => {
    const r = validate(
      book90({
        startF: 1.0,
        plan: [{ do: "position", id: "p1", at_s: 0, f: 0.9, over_m: 14 }]
      })
    );
    unwrap(r);
  });
});

// ---------------------------------------------------------------------------
// 2. Every reason token this package mints — enumerated, each reachable

describe("reason-token reachability (design/03 §6.2)", () => {
  it("SCHEMA/anchor_embedded_offset — offset fused into a ref string", () => {
    const s = book90({
      plan: []
    }) as Record<string, unknown>;
    (s as { occluders?: unknown[] }).occluders = [
      { kind: "hedge", side: "outside", at: { ref: "entry:c1-25" }, span_m: 10 }
    ];
    const e = unwrapErr(validate(s));
    expect(e.code).toBe("SCHEMA");
    expect(reasonOf(e)).toBe("anchor_embedded_offset");
  });

  it("SCHEMA/no_apex_anchor — apex: is never an anchor (D7)", () => {
    const s = book90({
      plan: [{ do: "turn_in", id: "ti1", at: { ref: "apex:c1" }, target: { lean_deg: 30 }, hand: "L" }]
    });
    const e = unwrapErr(validate(s));
    expect(e.code).toBe("SCHEMA");
    expect(reasonOf(e)).toBe("no_apex_anchor");
  });

  it("SCHEMA/vehicle_lane_xor_side — both lane and side given", () => {
    const s = book90() as Record<string, unknown>;
    (s as { occluders?: unknown[] }).occluders = [
      { kind: "vehicle", lane: "own", side: "outside", at: { ref: "c1" } }
    ];
    const e = unwrapErr(validate(s));
    expect(e.code).toBe("SCHEMA");
    expect(reasonOf(e)).toBe("vehicle_lane_xor_side");
  });

  it("SCHEMA/vehicle_span_not_allowed — a vehicle takes no span_m", () => {
    const s = book90() as Record<string, unknown>;
    (s as { occluders?: unknown[] }).occluders = [{ kind: "vehicle", lane: "own", at: { ref: "c1" }, span_m: 5 }];
    const e = unwrapErr(validate(s));
    expect(e.code).toBe("SCHEMA");
    expect(reasonOf(e)).toBe("vehicle_span_not_allowed");
  });

  it("SCHEMA/margin_requires_side — margin_m without a side placement", () => {
    const s = book90() as Record<string, unknown>;
    (s as { occluders?: unknown[] }).occluders = [
      { kind: "vehicle", lane: "own", at: { ref: "c1" }, margin_m: 0.5 }
    ];
    const e = unwrapErr(validate(s));
    expect(e.code).toBe("SCHEMA");
    expect(reasonOf(e)).toBe("margin_requires_side");
  });

  it("SCHEMA/lane_requires_vehicle — a band kind carrying a lane field", () => {
    const s = book90() as Record<string, unknown>;
    (s as { occluders?: unknown[] }).occluders = [
      { kind: "hedge", side: "outside", lane: "own", at: { ref: "c1" }, span_m: 10 }
    ];
    const e = unwrapErr(validate(s));
    expect(e.code).toBe("SCHEMA");
    expect(reasonOf(e)).toBe("lane_requires_vehicle");
  });

  it("SCHEMA/hand_on_explicit_road — hand beside segments", () => {
    const s = {
      spec: "linelab/1",
      id: "t",
      road: {
        hand: "L",
        lane_width_m: 3.5,
        segments: [{ type: "straight", len_m: 10 }]
      },
      rider: { start: { speed_kmh: 30 }, plan: [] }
    };
    const e = unwrapErr(validate(s));
    expect(e.code).toBe("SCHEMA");
    expect(reasonOf(e)).toBe("hand_on_explicit_road");
  });

  it("SCHEMA/traffic_reserved — the reserved traffic field", () => {
    const s = book90() as Record<string, unknown>;
    (s.road as Record<string, unknown>)["traffic"] = "left";
    const e = unwrapErr(validate(s));
    expect(e.code).toBe("SCHEMA");
    expect(reasonOf(e)).toBe("traffic_reserved");
  });

  it("SCHEMA/segment_width_reserved — the reserved per-segment width suffix", () => {
    const s = {
      spec: "linelab/1",
      id: "t",
      road: { dsl: "lane 3.5 | S 40 w=4.0" },
      rider: { start: { speed_kmh: 30 }, plan: [] }
    };
    const e = unwrapErr(validate(s));
    expect(e.code).toBe("SCHEMA");
    expect(reasonOf(e)).toBe("segment_width_reserved");
  });

  it("SCHEMA/hand_full_word — the D26 rewrite hint", () => {
    const s = book90() as Record<string, unknown>;
    (s.road as Record<string, unknown>)["hand"] = "left";
    const e = unwrapErr(validate(s));
    expect(e.code).toBe("SCHEMA");
    expect(reasonOf(e)).toBe("hand_full_word");
    expect(e.detail?.["rewrite"]).toBe("L");
  });

  it("OUT_OF_SCOPE/vertical_geometry_not_modelled — a height field", () => {
    const s = book90() as Record<string, unknown>;
    (s as { occluders?: unknown[] }).occluders = [
      { kind: "hedge", side: "outside", at: { ref: "c1" }, span_m: 10, height_m: 2 }
    ];
    const e = unwrapErr(validate(s));
    expect(e.code).toBe("OUT_OF_SCOPE");
    expect(reasonOf(e)).toBe("vertical_geometry_not_modelled");
  });

  it("OUT_OF_SCOPE/super_tight_geometry — a true U-turn hairpin", () => {
    const s = {
      spec: "linelab/1",
      id: "t",
      road: {
        lane_width_m: 3.5,
        segments: [
          { type: "straight", len_m: 10 },
          { type: "arc", r_m: 10, angle_deg: 180, hand: "R" },
          { type: "straight", len_m: 10 }
        ]
      },
      rider: { start: { speed_kmh: 30 }, plan: [] }
    };
    const e = unwrapErr(validate(s));
    expect(e.code).toBe("OUT_OF_SCOPE");
    expect(reasonOf(e)).toBe("super_tight_geometry");
  });

  it("OUT_OF_SCOPE/full_width_with_oncoming_traffic — vehicle in the oncoming lane under full width", () => {
    const s = book90() as Record<string, unknown>;
    (s.road as Record<string, unknown>)["use_full_width"] = true;
    (s as { occluders?: unknown[] }).occluders = [{ kind: "vehicle", lane: "oncoming", at: { ref: "c1" } }];
    const e = unwrapErr(validate(s));
    expect(e.code).toBe("OUT_OF_SCOPE");
    expect(reasonOf(e)).toBe("full_width_with_oncoming_traffic");
  });

  it("OUT_OF_SCOPE/moving_hazards_not_modelled — a vehicle with a motion field", () => {
    const s = book90() as Record<string, unknown>;
    (s as { occluders?: unknown[] }).occluders = [
      { kind: "vehicle", lane: "own", at: { ref: "c1" }, speed_kmh: 40 }
    ];
    const e = unwrapErr(validate(s));
    expect(e.code).toBe("OUT_OF_SCOPE");
    expect(reasonOf(e)).toBe("moving_hazards_not_modelled");
  });

  it("BAD_RANGE/no_governing_corner — turn_in hand with no matching corner downstream", () => {
    const s = book90({
      plan: [{ do: "turn_in", id: "ti1", at_s: 0, target: { lean_deg: 30 }, hand: "R" }]
    });
    const e = unwrapErr(validate(s));
    expect(e.code).toBe("BAD_RANGE");
    expect(reasonOf(e)).toBe("no_governing_corner");
  });

  it("BAD_RANGE/position_target_outside_corridor — f outside [0,1]", () => {
    const s = book90({ plan: [{ do: "position", id: "p1", at_s: 0, f: 1.5, over_m: 5 }] });
    const e = unwrapErr(validate(s));
    expect(e.code).toBe("BAD_RANGE");
    expect(reasonOf(e)).toBe("position_target_outside_corridor");
  });

  it("BAD_RANGE — slew_mss out of [1,100]", () => {
    const s = book90({ plan: [{ do: "brake", id: "b1", at_s: 0, decel: 3, slew_mss: 500 }] });
    const e = unwrapErr(validate(s));
    expect(e.code).toBe("BAD_RANGE");
    expect(reasonOf(e)).toBe("slew_out_of_range");
  });

  it("BAD_RANGE — gravel mu ≤ 0", () => {
    const s = book90() as Record<string, unknown>;
    (s as { hazards?: unknown[] }).hazards = [{ kind: "gravel", side: "outside", at: { ref: "c1" }, span_m: 3, mu: 0 }];
    const e = unwrapErr(validate(s));
    expect(e.code).toBe("BAD_RANGE");
    expect(reasonOf(e)).toBe("hazard_mu_nonpositive");
  });

  it("INEFFECTUAL/position_overlaps_turn_in — a position window over a turn_in's commitment", () => {
    const s = book90({
      plan: [
        { do: "turn_in", id: "ti1", at_s: 5, target: { lean_deg: 30 }, hand: "L" },
        { do: "position", id: "p1", at_s: 3, f: 0.6, over_m: 4 }
      ]
    });
    const e = unwrapErr(validate(s));
    expect(e.code).toBe("INEFFECTUAL");
    expect(reasonOf(e)).toBe("position_overlaps_turn_in");
  });

  it("INEFFECTUAL/position_overlaps_position — two overlapping position windows", () => {
    const s = book90({
      plan: [
        { do: "position", id: "p1", at_s: 0, f: 0.6, over_m: 6 },
        { do: "position", id: "p2", at_s: 3, f: 0.8, over_m: 6 }
      ]
    });
    const e = unwrapErr(validate(s));
    expect(e.code).toBe("INEFFECTUAL");
    expect(reasonOf(e)).toBe("position_overlaps_position");
  });

  it("INEFFECTUAL/roll_rate_cap_not_binding — a cap ≥ the profile rate", () => {
    const s = book90() as Record<string, unknown>;
    (s.rider as Record<string, unknown>)["roll_rate_cap_dps"] = 60; // street profile rate is 50
    const e = unwrapErr(validate(s));
    expect(e.code).toBe("INEFFECTUAL");
    expect(reasonOf(e)).toBe("roll_rate_cap_not_binding");
  });

  it("INEFFECTUAL/turn_in_during_freeze — a turn_in inside a throttle freeze window", () => {
    const s = book90({
      plan: [
        { do: "throttle", id: "th1", at_s: 0, accel: 1, freeze_steer_s: 3 },
        { do: "turn_in", id: "ti1", at_s: 1, target: { lean_deg: 30 }, hand: "L" }
      ]
    });
    const e = unwrapErr(validate(s));
    expect(e.code).toBe("INEFFECTUAL");
    expect(reasonOf(e)).toBe("turn_in_during_freeze");
  });

  it("UNKNOWN_ID — unknown corner id in an anchor", () => {
    const s = book90({
      plan: [{ do: "turn_in", id: "ti1", at: { ref: "entry:c99" }, target: { lean_deg: 30 } }]
    });
    const e = unwrapErr(validate(s));
    expect(e.code).toBe("UNKNOWN_ID");
    expect(reasonOf(e)).toBe("unknown_corner_id");
  });

  it("UNKNOWN_ID — unknown rubric name", () => {
    const s = book90() as Record<string, unknown>;
    s["config"] = { rubric: "nonexistent-pack" };
    const e = unwrapErr(validate(s));
    expect(e.code).toBe("UNKNOWN_ID");
    expect(reasonOf(e)).toBe("unknown_rubric");
  });

  it("DUP_ID — an explicit occluder id collides with a minted one", () => {
    const s = book90() as Record<string, unknown>;
    (s as { occluders?: unknown[] }).occluders = [
      { kind: "hedge", side: "outside", at: { ref: "c1" }, span_m: 5 }, // mints "o1"
      { id: "o1", kind: "hedge", side: "outside", at: { ref: "s:20" }, span_m: 5 }
    ];
    const e = unwrapErr(validate(s));
    expect(e.code).toBe("DUP_ID");
  });
});

// ---------------------------------------------------------------------------
// 3. Tombstone behavior

describe("tombstones", () => {
  it("early_apex → UNKNOWN_ID/renamed_kind naming premature", () => {
    expect(RETIRED_MISTAKE_NAME).toBe("early_apex");
    const e = unwrapErr(parseMistakeToken("early_apex", "mistake"));
    expect(e.code).toBe("UNKNOWN_ID");
    expect(reasonOf(e)).toBe("renamed_kind");
    expect(e.detail?.["renamed_to"]).toBe("premature");
  });
});

// ---------------------------------------------------------------------------
// 4. Anchor grammar accept/reject table (D32)

describe("anchor grammar", () => {
  const road = unwrap(compose({ preset: "book90" } as never));
  const corners = road.corners;

  const acceptTable: ReadonlyArray<[string, "entry" | "exit" | "mid", string]> = [
    ["c1", "entry", "c1"],
    ["entry:c1", "entry", "c1"],
    ["exit:c1", "exit", "c1"],
    ["mid:c1", "mid", "c1"]
  ];
  for (const [input, kind, corner_id] of acceptTable) {
    it(`accepts "${input}"`, () => {
      const parsed = unwrap(parseAnchorRef(input, "at"));
      expect(parsed.kind).toBe(kind);
      expect(parsed.corner_id).toBe(corner_id);
    });
  }

  it('accepts the absolute-station token form "s:12"', () => {
    const parsed = unwrap(parseAnchorToken("s:12", "at"));
    expect(parsed).toEqual({ at_s: 12 });
  });

  it("resolves entry/exit/mid against the composed road", () => {
    const c1 = corners.find((c) => c.id === "c1")!;
    expect(unwrap(resolveAnchor({ ref: "entry:c1" }, corners, "at"))).toBeCloseTo(c1.s0, 6);
    expect(unwrap(resolveAnchor({ ref: "exit:c1" }, corners, "at"))).toBeCloseTo(c1.s1, 6);
    expect(unwrap(resolveAnchor({ ref: "mid:c1" }, corners, "at"))).toBeCloseTo(c1.s_mid, 6);
    expect(unwrap(resolveAnchor({ ref: "entry:c1", offset_m: 5 }, corners, "at"))).toBeCloseTo(c1.s0 + 5, 6);
  });

  const rejectTable: ReadonlyArray<[string, string]> = [
    ["entry:c1-25", "anchor_embedded_offset"],
    ["entry:c1+25", "anchor_embedded_offset"],
    ["apex:c1", "no_apex_anchor"],
    ["", "anchor_malformed"]
  ];
  for (const [input, reason] of rejectTable) {
    it(`rejects "${input}" with ${reason}`, () => {
      const e = unwrapErr(parseAnchorRef(input, "at"));
      expect(e.code).toBe("SCHEMA");
      expect(reasonOf(e)).toBe(reason);
    });
  }

  it("rejects an unknown corner id with UNKNOWN_ID", () => {
    const e = unwrapErr(resolveAnchor({ ref: "entry:c99" }, corners, "at"));
    expect(e.code).toBe("UNKNOWN_ID");
    expect(reasonOf(e)).toBe("unknown_corner_id");
  });
});

// ---------------------------------------------------------------------------
// 5. Effectuality of accepted inputs (precursor of T-D8): every accepted field
// actually reaches the resolved output.

describe("effectuality of a fully-populated scenario", () => {
  it("resolves brake, turn_in, throttle, and position together, each field intact", () => {
    const road = unwrap(compose({ preset: "book90" } as never));
    const c1 = road.corners.find((c) => c.id === "c1")!;
    const s = book90({
      startF: 1.0,
      plan: [
        { do: "brake", id: "b1", at_s: 0, decel: 3.0, taper_to_s: 8 },
        { do: "turn_in", id: "ti1", at_s: 10, target: { lean_deg: 35 }, hand: "L" },
        { do: "throttle", id: "th1", at_s: 25, accel: 1.5, freeze_steer_s: 0.5 },
        { do: "position", id: "p1", at_s: c1.s1 + 1, f: 0.7, over_m: 10 }
      ]
    });
    const result: ValidatedScenario = unwrap(validate(s));

    expect(result.road.dsl).toContain("lane 3.5");
    expect(result.rider.plan).toHaveLength(4);

    const brake = result.rider.plan.find((a) => a.id === "b1");
    expect(brake).toMatchObject({ do: "brake", at_s: 0, decel: 3.0, taper_to_s: 8, slew_mss: 6.0 });

    const turnIn = result.rider.plan.find((a) => a.id === "ti1");
    expect(turnIn).toMatchObject({ do: "turn_in", at_s: 10, hand: "L", target: { lean_deg: 35 } });

    const throttle = result.rider.plan.find((a) => a.id === "th1");
    expect(throttle).toMatchObject({ do: "throttle", at_s: 25, accel: 1.5, freeze_steer_s: 0.5 });

    const position = result.rider.plan.find((a) => a.id === "p1");
    expect(position).toMatchObject({ do: "position", f: 0.7, over_m: 10 });

    expect(result.config).toEqual({ mu: 1.0, ds_m: 0.5, ssd_model: "alert", rubric: "parks-street", checks_version: 2 });
  });

  it("folds bookBlind's preset-embedded occluder token into resolved occluders", () => {
    const s = {
      spec: "linelab/1",
      id: "t",
      road: { preset: "bookBlind" },
      rider: { start: { speed_kmh: 34 }, plan: [] }
    };
    const result = unwrap(validate(s));
    expect(result.occluders).toHaveLength(1);
    expect(result.occluders[0]).toMatchObject({ kind: "hedge", side: "inside", margin_m: 1.2, depth_m: 2.5, span_m: 36 });
  });

  it("rejects a required field's absence honestly (speed_kmh has no default, ARCHITECTURE §10 pin #8)", () => {
    const s = { spec: "linelab/1", id: "t", road: { preset: "book90" }, rider: { start: {}, plan: [] } };
    const e = unwrapErr(validate(s));
    expect(e.code).toBe("SCHEMA");
    expect(reasonOf(e)).toBe("speed_kmh_required");
  });
});
