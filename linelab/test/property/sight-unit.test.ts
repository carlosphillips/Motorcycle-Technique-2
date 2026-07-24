// WP-03 sight unit gates: sightFrom first-blocked semantics, footprint geometry,
// and the ONE lean-aware ssd definition (design/03 §5; D4, D15, D16 precursor).
//
// The independent cross-check is review/verify/fixture_geometry.py (its
// sight_from(), hedge_polygon(), ssd() re-derive design/03 §5 standalone). Every
// pinned number below is cited from a run of that file's functions (2026-07-23).
// Discretization note: the fixture returns the FIRST-BLOCKED target station u
// (scanning from s_eye + 0.5 in 0.25 m steps over an n=500-vertex band); this
// implementation returns the LAST-VISIBLE station on the road's 0.5 m ds grid
// (design/03 §5.1: "s_limit is the last visible station before the first
// blocked one"), so ours ≈ u − 0.5 with up to ±0.25 m of grid/facet slack —
// hence the ±0.75 m comparison band on absolute stations. Qualitative verdicts
// (blind vs not blind) sit metres from the boundary and must match exactly.

import { describe, it, expect } from "vitest";
import { compose } from "../../src/road/compose.js";
import { sightFrom, castSight } from "../../src/sight/cast.js";
import { footprintsOf, footprintOf } from "../../src/sight/footprints.js";
import { ssd } from "../../src/sight/ssd.js";
import {
  SSD_MODEL_TABLE,
  SIGHT_TREND_WINDOW_M,
  SIGHT_TREND_DEADBAND_M
} from "../../src/sight/constants.js";
import { RIDER_PROFILES, G } from "../../src/core/constants.js";
import { degToRad, kmhToMs } from "../../src/core/units.js";
import type { ComposedRoad } from "../../src/road/types.js";
import type { ResolvedOccluder, RiderProfile } from "../../src/core/types.js";

// ---------------------------------------------------------------------------
// helpers

function road(dsl: string): ComposedRoad {
  const r = compose({ dsl });
  if (!r.ok) throw new Error(`test road failed to compose: ${r.error.message}`);
  return r.value;
}

/**
 * Eye at station s, lateral offset given in the FIXTURE's convention (metres
 * right of the centreline: 0.4 = corridor edge nearest the centreline, 3.1 =
 * nearest the rider's own outer edge). Our d is positive-LEFT, so d = −dFix.
 * Spelling eyes in raw d (not f) keeps the cells hand-unambiguous: the fixture's
 * check-8 sweep holds the physical lateral positions fixed when it mirrors the
 * road, while f re-parameterizes per hand.
 */
function eyeAt(r: ComposedRoad, s: number, dFix: number): { x: number; y: number } {
  return r.worldAt(s, -dFix);
}

let nextId = 0;
function hedge(
  at_s: number,
  span_m: number,
  margin_m: number,
  depth_m: number
): ResolvedOccluder {
  return {
    id: `o${++nextId}`,
    kind: "hedge",
    side: "inside",
    at: { at_s },
    span_m,
    margin_m,
    depth_m
  };
}

function vehicle(at_s: number, extra: Partial<ResolvedOccluder> = {}): ResolvedOccluder {
  return { id: `o${++nextId}`, kind: "vehicle", at: { at_s }, ...extra };
}

const street = RIDER_PROFILES.street;

// ---------------------------------------------------------------------------
// ssd — model table (design/03 §5.2, verbatim values)

describe("ssd model table (design/03 §5.2)", () => {
  it("carries alert {a_ssd: 7.0, t_react_s: 1.0} and aashto {a_ssd: 3.4, t_react_s: 2.5}", () => {
    expect(SSD_MODEL_TABLE.alert).toEqual({ a_ssd: 7.0, t_react_s: 1.0 });
    expect(SSD_MODEL_TABLE.aashto).toEqual({ a_ssd: 3.4, t_react_s: 2.5 });
  });

  it("trend constants carry 03 §5.1's values (window 5.0 m, deadband 2.0 m)", () => {
    expect(SIGHT_TREND_WINDOW_M).toBe(5.0);
    expect(SIGHT_TREND_DEADBAND_M).toBe(2.0);
  });
});

// ---------------------------------------------------------------------------
// ssd — upright reduction identity (D15)

describe("ssd upright reduction (design/03 §5.2, D15)", () => {
  it("at phi = 0 reduces exactly to v·t_react + v²/(2·a_ssd), both models", () => {
    for (const model of ["alert", "aashto"] as const) {
      const { a_ssd, t_react_s } = SSD_MODEL_TABLE[model];
      for (const v of [5, kmhToMs(34), 13, 20]) {
        const out = ssd(v, 0, model, street, 1.0);
        expect(out.ssd_m).toBeCloseTo(v * t_react_s + (v * v) / (2 * a_ssd), 12);
        expect(out.react_m).toBeCloseTo(v * t_react_s, 12);
        expect(out.standup_m).toBe(0); // t_su = 0: no stand-up phase upright
      }
    }
  });

  it("fixture cross-check: ssd(13, 0, alert) = 25.0714 m, ssd(13, 0, aashto) = 57.3529 m", () => {
    // fixture_geometry.py ssd(): 25.0714 / 57.3529 (design/03 §5.2 quotes 25.1 upright)
    expect(ssd(13, 0, "alert", street, 1.0).ssd_m).toBeCloseTo(25.0714, 3);
    expect(ssd(13, 0, "aashto", street, 1.0).ssd_m).toBeCloseTo(57.3529, 3);
  });
});

// ---------------------------------------------------------------------------
// ssd — the worked example (design/03 §5.2; fixture E block)

describe("ssd worked example: street, alert, v = 13 m/s, phi = 28°", () => {
  const out = ssd(13, degToRad(28), "alert", street, 1.0);

  it("ssd_m ≈ 26.5333 m (fixture: 26.5333; design quotes ≈ 26.5 vs 25.1 upright)", () => {
    expect(out.ssd_m).toBeCloseTo(26.5333, 3);
  });

  it("breakdown: react 13.0, standup ≈ 6.4318, brake ≈ 7.1015; parts sum to ssd_m", () => {
    // a_lean = 5.4090 (the a_noreturn cap binds — fixture E), t_su = 0.56 s:
    //   standup = 13·0.56 − 5.4090·0.56²/2 = 6.4318;  v_up = 9.9710 → brake = 7.1015
    expect(out.react_m).toBeCloseTo(13.0, 12);
    expect(out.standup_m).toBeCloseTo(6.4318, 3);
    expect(out.brake_m).toBeCloseTo(7.1015, 3);
    expect(out.react_m + out.standup_m + out.brake_m).toBeCloseTo(out.ssd_m, 12);
  });

  it("fixture check-7 leans on the reshaped bookBlind: ssd(9.4444, 31.05°) = 16.9119, ssd(9.4444, 36.25°) = 17.0490", () => {
    const v = kmhToMs(34);
    const phiWide = Math.atan((v * v) / (G * 15.1)); // hold-wide line radius 12 + 3.1
    const phiCut = Math.atan((v * v) / (G * 12.4)); // cut-in line radius 12 + 0.4
    expect((phiWide * 180) / Math.PI).toBeCloseTo(31.0544, 3);
    expect((phiCut * 180) / Math.PI).toBeCloseTo(36.2514, 3);
    expect(ssd(v, phiWide, "alert", street, 1.0).ssd_m).toBeCloseTo(16.9119, 3);
    expect(ssd(v, phiCut, "alert", street, 1.0).ssd_m).toBeCloseTo(17.049, 3);
  });
});

// ---------------------------------------------------------------------------
// ssd — lean monotonicity + continuity (P-SSD-LEAN precursor)

describe("ssd lean monotonicity (P-SSD-LEAN precursor)", () => {
  it("ssd_m is non-decreasing in |phi| (0..45° at v = 13, both models)", () => {
    for (const model of ["alert", "aashto"] as const) {
      let prev = -Infinity;
      for (let deg = 0; deg <= 45; deg += 0.5) {
        const cur = ssd(13, degToRad(deg), model, street, 1.0).ssd_m;
        expect(cur).toBeGreaterThanOrEqual(prev - 1e-9);
        prev = cur;
      }
    }
  });

  it("is continuous at phi = 0 and even in phi (sign never matters)", () => {
    const upright = ssd(13, 0, "alert", street, 1.0).ssd_m;
    expect(ssd(13, degToRad(1e-4), "alert", street, 1.0).ssd_m).toBeCloseTo(upright, 2);
    const l = ssd(13, degToRad(-28), "alert", street, 1.0);
    const r = ssd(13, degToRad(28), "alert", street, 1.0);
    expect(l.ssd_m).toBe(r.ssd_m);
  });

  it("lean costs distance: 28° of lean adds ≈ 1.46 m over upright at 13 m/s", () => {
    const upright = ssd(13, 0, "alert", street, 1.0).ssd_m;
    const leaned = ssd(13, degToRad(28), "alert", street, 1.0).ssd_m;
    expect(leaned).toBeGreaterThan(upright);
    expect(leaned - upright).toBeCloseTo(26.5333 - 25.0714, 2);
  });
});

// ---------------------------------------------------------------------------
// ssd — branch, roll-rate, and mu behavior

describe("ssd stand-up phase mechanics", () => {
  it("stops mid-roll-up when v ≤ a_lean·t_su: brake_m = 0, standup = v²/(2·a_lean)", () => {
    // v = 1.5 ≤ a_lean·t_su = 5.4090·0.56 = 3.029 → the mid-roll-up branch
    const out = ssd(1.5, degToRad(28), "alert", street, 1.0);
    expect(out.brake_m).toBe(0);
    expect(out.standup_m).toBeCloseTo((1.5 * 1.5) / (2 * 5.409), 3);
    expect(out.ssd_m).toBeCloseTo(1.5 + out.standup_m, 12);
  });

  it("a slower roll rate lengthens the stand-up phase: casual (20°/s) > street (50°/s) at lean", () => {
    const slow = ssd(13, degToRad(28), "alert", RIDER_PROFILES.casual, 1.0).ssd_m;
    const fast = ssd(13, degToRad(28), "alert", street, 1.0).ssd_m;
    expect(slow).toBeGreaterThan(fast);
  });

  it("callers pass the EFFECTIVE profile (roll_rate_eff pre-min'ed, design/02 §3): a capped rate raises ssd", () => {
    // slow_steer-class cap: 0.3 × street = 15 °/s, passed as the effective profile
    const capped: RiderProfile = { roll_rate_dps: 15, skill: 0.85, t_react_s: 1.0 };
    expect(ssd(13, degToRad(28), "alert", capped, 1.0).ssd_m).toBeGreaterThan(
      ssd(13, degToRad(28), "alert", street, 1.0).ssd_m
    );
  });

  it("lower mu shrinks a_lean through aLongAvail: ssd(mu 0.9) > ssd(mu 1.0) at 40° lean", () => {
    // at 40°, a_lat = G·tan40° = 8.23 m/s²: mu 1.0 → a_lean = 5.34 (grip cap
    // binds); mu 0.9 → 3.19 — the stand-up phase sheds far less speed
    const lo = ssd(13, degToRad(40), "alert", street, 0.9).ssd_m;
    const hi = ssd(13, degToRad(40), "alert", street, 1.0).ssd_m;
    expect(lo).toBeGreaterThan(hi);
    expect(Number.isFinite(lo)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// sightFrom — no occluders: sight runs to the road end (design/03 §5.1)

// The D46-reshaped bookBlind geometry (design/03 §3.1): s_end(c1) = 45.3215,
// road end = 61.3215; hedge inside c1 -6x36 margin=1.2 depth=2.5 → band [10, 46].
const BLIND_DSL = "lane 3.5 | S 16 | L 12 ^140 | S 16";
const BLIND_S_END = 16 + 12 * degToRad(140); // 45.3215
const blindHedge = (): ResolvedOccluder => hedge(10, 36, 1.2, 2.5);

describe("sightFrom with no occluders (design/03 §5.1)", () => {
  it("sight runs to the road end — blindness comes only from occluders", () => {
    const r = road(BLIND_DSL);
    const cast = sightFrom(r, eyeAt(r, 12, 3.1), []);
    expect(cast.s_limit).toBe(r.total_len_m);
    expect(cast.sight_m).toBeCloseTo(r.total_len_m - 12, 6);
  });

  it("sight_m = s_limit − s_eye (arc distance), limit point on the ride-lane centre", () => {
    const r = road(BLIND_DSL);
    const cast = sightFrom(r, eyeAt(r, 12, 3.1), [blindHedge()]);
    expect(cast.sight_m).toBeCloseTo(cast.s_limit - 12, 6);
    const lp = r.worldAt(cast.s_limit, -r.lane_width_m / 2);
    expect(cast.limit_point.x).toBeCloseTo(lp.x, 9);
    expect(cast.limit_point.y).toBeCloseTo(lp.y, 9);
  });
});

// ---------------------------------------------------------------------------
// sightFrom — bookBlind-class first-blocked numbers vs fixture_geometry.py

describe("reshaped bookBlind is blind at every sampled cell (fixture check 1, LOCKED)", () => {
  // fixture sight_from() first-blocked u (run 2026-07-23), eyes at the fixture's
  // lateral offsets 0.4 + f·2.7 m right of centreline:
  //   eye s=12: f=0 → 36.25   f=0.5 → 37.25   f=1 → 38.25
  //   eye s=16: f=0 → 39.50   f=0.5 → 40.50   f=1 → 41.00
  //   eye s=20: f=0 → 43.50   f=0.5 → 44.50   f=1 → 45.00
  const cells: ReadonlyArray<readonly [number, number, number]> = [
    [12, 0.0, 36.25],
    [12, 0.5, 37.25],
    [12, 1.0, 38.25],
    [16, 0.0, 39.5],
    [16, 0.5, 40.5],
    [16, 1.0, 41.0],
    [20, 0.0, 43.5],
    [20, 0.5, 44.5],
    [20, 1.0, 45.0]
  ];

  const r = road(BLIND_DSL);
  const occ = [blindHedge()];

  it.each(cells)("eye s=%d, fixture f=%f: s_limit ≈ fixture u=%f − 0.5, and < s_end", (s, f, u) => {
    const cast = sightFrom(r, eyeAt(r, s, 0.4 + f * 2.7), occ);
    expect(Math.abs(cast.s_limit - (u - 0.5))).toBeLessThanOrEqual(0.75);
    expect(cast.s_limit).toBeLessThan(BLIND_S_END); // blind(c1): limit before corner end
  });

  it("hold-wide opens the sight line over cut-in at the same station (the D4 teaching)", () => {
    const cut = sightFrom(r, eyeAt(r, 12, 0.4), occ).sight_m;
    const wide = sightFrom(r, eyeAt(r, 12, 3.1), occ).sight_m;
    expect(wide).toBeGreaterThan(cut); // fixture: 38.25 vs 36.25 first-blocked
  });
});

describe("90° corner with the same hedge is NOT blind (fixture check 1, D46 rationale)", () => {
  // book90-class: lane 3.5 | S 12 | L 12 ^90 | S 16 → s_end = 30.8496; hedge
  // [6, 32.35] margin 1.2 depth 2.5. Fixture first-blocked u: (12, f=0) → 37.50,
  // (12, f=1) → 40.75, (16, f=0.5) → None (nothing blocks to s_max).
  const dsl = "lane 3.5 | S 12 | L 12 ^90 | S 16";
  const sEnd = 12 + 12 * degToRad(90); // 30.8496
  const r = road(dsl);
  const occ = [hedge(6, sEnd + 1.5 - 6, 1.2, 2.5)];

  it("eye (12, cut-in): s_limit ≈ 37.0 — PAST the corner end: not blind", () => {
    const cast = sightFrom(r, eyeAt(r, 12, 0.4), occ);
    expect(Math.abs(cast.s_limit - 37.0)).toBeLessThanOrEqual(0.75);
    expect(cast.s_limit).toBeGreaterThan(sEnd);
  });

  it("eye (12, hold-wide): s_limit ≈ 40.25, also past the corner end", () => {
    const cast = sightFrom(r, eyeAt(r, 12, 3.1), occ);
    expect(Math.abs(cast.s_limit - 40.25)).toBeLessThanOrEqual(0.75);
    expect(cast.s_limit).toBeGreaterThan(sEnd);
  });

  it("eye (16, lane centre): nothing blocks — sight runs to the road end", () => {
    const cast = sightFrom(r, eyeAt(r, 16, 1.75), occ);
    expect(cast.s_limit).toBe(r.total_len_m);
  });

  it("margin is the decisive lateral knob: margin 0 blocks earlier than margin 1.2", () => {
    const tight = sightFrom(r, eyeAt(r, 12, 0.4), [hedge(6, sEnd + 1.5 - 6, 0, 2.5)]);
    const loose = sightFrom(r, eyeAt(r, 12, 0.4), occ);
    expect(tight.s_limit).toBeLessThan(loose.s_limit);
  });

  it("depth is inert: only the band's inner face can block (fixture: identical s_limit across depth 1–25)", () => {
    const shallow = sightFrom(r, eyeAt(r, 10, 1.75), [hedge(6, sEnd + 1.5 - 6, 0, 1.0)]);
    const deep = sightFrom(r, eyeAt(r, 10, 1.75), [hedge(6, sEnd + 1.5 - 6, 0, 25.0)]);
    expect(shallow.s_limit).toBe(deep.s_limit);
    expect(shallow.s_limit).toBeLessThan(r.total_len_m); // and it does block at margin 0
  });
});

// ---------------------------------------------------------------------------
// sightFrom — first-blocked semantics with vehicles on a straight

describe("first-blocked semantics: vehicles as occluders (D27, optical-only)", () => {
  const r = road("lane 3.5 | S 100");
  const eye = eyeAt(r, 10, 1.75); // on the own-lane centre polyline

  it("an own-lane vehicle at s=50 blocks at its near edge: s_limit ≈ 47.5 (edge at 47.75)", () => {
    const cast = sightFrom(r, eye, [vehicle(50, { lane: "own" })]);
    expect(Math.abs(cast.s_limit - 47.5)).toBeLessThanOrEqual(0.5);
    expect(cast.sight_m).toBeCloseTo(cast.s_limit - 10, 6);
  });

  it("the EARLIEST blocker governs, in either occluder order (first-blocked, not nearest-declared)", () => {
    const near = vehicle(30, { lane: "own" });
    const far = vehicle(50, { lane: "own" });
    const a = sightFrom(r, eye, [near, far]);
    const b = sightFrom(r, eye, [far, near]);
    expect(a.s_limit).toBe(b.s_limit);
    expect(Math.abs(a.s_limit - 27.5)).toBeLessThanOrEqual(0.5); // near edge 27.75
  });

  it("an occluder beyond the limit point changes nothing", () => {
    const withFar = sightFrom(r, eye, [vehicle(30, { lane: "own" }), vehicle(50, { lane: "own" })]);
    const withoutFar = sightFrom(r, eye, [vehicle(30, { lane: "own" })]);
    expect(withFar.s_limit).toBe(withoutFar.s_limit);
  });

  it("an occluder behind the eye changes nothing: sight runs to the road end", () => {
    const cast = sightFrom(r, eye, [vehicle(5, { lane: "own" })]);
    expect(cast.s_limit).toBe(r.total_len_m);
  });

  it("a verge vehicle (side form) is scenery — off the carriageway, it never crosses the ride-lane rays", () => {
    for (const side of ["left", "right"] as const) {
      const cast = sightFrom(r, eye, [vehicle(50, { side })]);
      expect(cast.s_limit).toBe(r.total_len_m);
    }
  });

  it("an oncoming-lane vehicle does not block the own-lane polyline on a straight", () => {
    const cast = sightFrom(r, eye, [vehicle(50, { lane: "oncoming" })]);
    expect(cast.s_limit).toBe(r.total_len_m);
  });
});

// ---------------------------------------------------------------------------
// sightFrom — re-emerged visibility beyond a gap does not count

describe("re-emergence does not count (design/03 §5.1 first-blocked law)", () => {
  it("fx-hedge-gap geometry: s_limit stays at the first block even though far road re-emerges", () => {
    // bookBlind with the entrance gap [14, 18] (hedge -6x4 + +2x28, fixture
    // check 13 APPLIED): from eye (12, lane centre) the fixture's raw cast
    // first-blocks at u = 37.5 while stations 49.5..50.5 are geometrically
    // visible again through the gap. First-blocked semantics must return ≈ 37,
    // never the re-emerged 49.5+.
    const r = road(BLIND_DSL);
    const occ = [hedge(10, 4, 1.2, 2.5), hedge(18, 28, 1.2, 2.5)];
    const cast = sightFrom(r, eyeAt(r, 12, 1.75), occ);
    expect(Math.abs(cast.s_limit - 37.0)).toBeLessThanOrEqual(0.75);
    expect(cast.s_limit).toBeLessThan(45); // far below the re-emerged 49.5..50.5 window
  });
});

// ---------------------------------------------------------------------------
// sightFrom — the `inside` band lands per hand (fixture check 8; sideSign wiring)

describe("hand mirror: `inside` band vs corner hand (fixture check 8)", () => {
  // fx-esses-blind base: entry 8, R12 ^75, hedge inside margin 1.5 depth 4.0
  // over [2, 25.208]; s_end = 23.708. Fixture (220-cell sweep, eyes 4..23 × 11
  // lateral offsets): hand L → 0 blind cells, min first-blocked 31.0;
  // hand R → 6 blind cells, min first-blocked 22.25.
  const S_END = 8 + 12 * degToRad(75); // 23.7080
  const SPAN = S_END + 1.5 - 2; // 23.2080

  function sweep(r: ComposedRoad): { blind: number; minLimit: number } {
    const occ = [hedge(2, SPAN, 1.5, 4.0)];
    const fps = footprintsOf(r, occ);
    let blind = 0;
    let minLimit = Infinity;
    for (let s = 4; s < S_END; s += 1) {
      for (let j = 0; j <= 10; j++) {
        const cast = castSight(r, eyeAt(r, s, 0.4 + 0.27 * j), fps);
        minLimit = Math.min(minLimit, cast.s_limit);
        if (cast.s_limit < S_END) blind++;
      }
    }
    return { blind, minLimit };
  }

  it("on the LEFT-hander the inside band sits across the centreline: zero blind cells", () => {
    const { blind, minLimit } = sweep(road("lane 3.5 | S 8 | L 12 ^75 | S 18"));
    expect(blind).toBe(0);
    expect(minLimit).toBeGreaterThanOrEqual(29.0); // fixture min first-blocked 31.0
  });

  it("mirrored to a RIGHT-hander the same token lands on the rider's own side: blindness appears", () => {
    const { blind, minLimit } = sweep(road("lane 3.5 | S 8 | R 12 ^75 | S 18"));
    expect(blind).toBeGreaterThan(0); // fixture: 6 of 220 cells
    expect(minLimit).toBeLessThan(S_END);
    expect(Math.abs(minLimit - 21.75)).toBeLessThanOrEqual(0.75); // fixture min u 22.25
  });

  it.each([
    [8, 0.4, 30.5], // fixture eye offsets are centreline-relative; hand-R f flips, d does not
    [8, 1.75, 28.25],
    [10, 0.4, 37.75]
  ] as const)("hand R pinned cell: eye s=%d, offset %f m → s_limit ≈ %f − 0.5", (s, dFix, u) => {
    const r = road("lane 3.5 | S 8 | R 12 ^75 | S 18");
    const cast = sightFrom(r, eyeAt(r, s, dFix), [hedge(2, SPAN, 1.5, 4.0)]);
    expect(Math.abs(cast.s_limit - (u - 0.5))).toBeLessThanOrEqual(0.75);
  });
});

// ---------------------------------------------------------------------------
// footprints — resolved geometry (design/03 §4)

describe("footprint geometry (design/03 §4)", () => {
  const r = road("lane 3.5 | S 100");

  it("own-lane vehicle: 4.5 × 1.8 rectangle centred on the own-lane centre, axis along the road", () => {
    const fp = footprintOf(r, vehicle(50, { lane: "own" }));
    expect(fp.kind).toBe("vehicle");
    expect(fp.polygon).toHaveLength(4);
    // own lane centre d = −1.75 → world y = +1.75 (y-down, d positive-left)
    expect(fp.centre.x).toBeCloseTo(50, 9);
    expect(fp.centre.y).toBeCloseTo(1.75, 9);
    const xs = fp.polygon.map((p) => p.x).sort((a, b) => a - b);
    const ys = fp.polygon.map((p) => p.y).sort((a, b) => a - b);
    expect(xs[0]).toBeCloseTo(47.75, 9); // 50 − 4.5/2
    expect(xs[3]).toBeCloseTo(52.25, 9);
    expect(ys[0]).toBeCloseTo(0.85, 9); // 1.75 − 1.8/2
    expect(ys[3]).toBeCloseTo(2.65, 9);
  });

  it("vehicle f escape hatch resolves through the corridor algebra (f=0 on a straight = inner usable edge)", () => {
    // cornerless road: pinned frame hand R (road/corridor.ts); f=0 → d = −3.1 → y = +3.1
    const fp = footprintOf(r, vehicle(50, { f: 0 }));
    expect(fp.centre.y).toBeCloseTo(3.1, 9);
  });

  it("verge vehicle sits margin + width/2 beyond the physical edge on the resolved side", () => {
    // side "left" = +d: centre d = 3.5 + 0.5 + 0.9 = 4.9 → y = −4.9
    const fp = footprintOf(r, vehicle(50, { side: "left" }));
    expect(fp.centre.y).toBeCloseTo(-4.9, 9);
  });

  it("band defaults fill per kind (hedge margin 1.0 depth 2.0; wall 0.5/0.3 — design/03 §4 table)", () => {
    const bare = (kind: "hedge" | "wall"): ResolvedOccluder => ({
      id: `o${++nextId}`,
      kind,
      side: "left",
      at: { at_s: 10 },
      span_m: 5
    });
    const h = footprintOf(r, bare("hedge"));
    const hYs = h.polygon.map((p) => p.y);
    expect(Math.max(...hYs)).toBeCloseTo(-4.5, 9); // inner face: 3.5 + 1.0 (left ⇒ y = −d)
    expect(Math.min(...hYs)).toBeCloseTo(-6.5, 9); // outer face: + depth 2.0
    const w = footprintOf(r, bare("wall"));
    const wYs = w.polygon.map((p) => p.y);
    expect(Math.max(...wYs)).toBeCloseTo(-4.0, 9); // 3.5 + 0.5
    expect(Math.min(...wYs)).toBeCloseTo(-4.3, 9); // + depth 0.3
    // band spans [at_s, at_s + span_m] in +s
    const xs = h.polygon.map((p) => p.x);
    expect(Math.min(...xs)).toBeCloseTo(10, 9);
    expect(Math.max(...xs)).toBeCloseTo(15, 9);
  });

  it("footprints preserve occluder ids (the hazard_visible analyzer keys on them)", () => {
    const occs = [vehicle(30, { lane: "own" }), hedge(10, 5, 1.0, 2.0)];
    const fps = footprintsOf(r, occs);
    expect(fps.map((f) => f.id)).toEqual(occs.map((o) => o.id));
    expect(fps.map((f) => f.kind)).toEqual(["vehicle", "hedge"]);
  });
});
