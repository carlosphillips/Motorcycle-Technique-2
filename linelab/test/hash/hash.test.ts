// WP-01 gates (ARCHITECTURE §7, §8 row WP-01): fnv1a/canonicalize vectors and the
// closed-set enumeration tests. Closed sets are retyped here INDEPENDENTLY from the
// design docs (double-entry, drift risk #12) and compared to the exports — never
// derived from them.

import { describe, it, expect } from "vitest";
import { canonicalize, fnv1a, fnv1a32 } from "../../src/core/hash.js";
import {
  EVENT_KINDS,
  OUTCOMES,
  PHASES,
  RIDER_PROFILE_NAMES,
  SAMPLE_FIELDS,
  SSD_MODELS,
  STEER_STATES,
  TERMINATED_REASONS
} from "../../src/core/types.js";
import type { Sample } from "../../src/core/types.js";
import { ERROR_CODES } from "../../src/core/result.js";
import {
  A_SLEW_DEFAULT,
  RATE_THRESHOLD,
  RIDER_PROFILES,
  SLEW_MAX,
  SLEW_MIN,
  dt_s,
  ds_m,
  v_floor_ms,
  v_valid_min_ms
} from "../../src/core/constants.js";
import { degToRad, handSign, kmhToMs, msToKmh, radToDeg } from "../../src/core/units.js";

function unwrap<T>(r: { ok: true; value: T } | { ok: false; error: unknown }): T {
  if (!r.ok) throw new Error(`expected ok, got error: ${JSON.stringify(r.error)}`);
  return r.value;
}

// ---------------------------------------------------------------------------
// fnv1a — 32-bit FNV-1a, offset 0x811c9dc5, prime 0x01000193, UTF-8 bytes,
// 8 lowercase hex; the spec_hash/result_hash form takes the first 6.

describe("fnv1a32 vectors (independent hand computation)", () => {
  it("empty string hashes to the offset basis", () => {
    // No bytes folded — the hash IS the offset basis 0x811c9dc5.
    expect(fnv1a32("")).toBe("811c9dc5");
    expect(fnv1a("")).toBe("811c9d");
  });

  it('"a" — one ASCII byte', () => {
    // Hand computation (one byte, 0x61):
    //   h = 0x811c9dc5 ^ 0x61        = 0x811c9da4
    //   h = 0x811c9da4 * 0x01000193  mod 2^32
    //     = 0x811c9da4·2^24 + 0x811c9da4·0x193  mod 2^32
    //     = 0xa4000000 + 0x400ae92c... folding out: = 0xe40c292c
    // (matches the published FNV-1a test vector for "a")
    expect(fnv1a32("a")).toBe("e40c292c");
    expect(fnv1a("a")).toBe("e40c29");
  });

  it('"é" (U+00E9) — a multibyte UTF-8 string, two bytes 0xC3 0xA9', () => {
    // The hash runs over UTF-8 BYTES, not UTF-16 code units. "é" encodes as
    // 0xC3 0xA9. Hand computation:
    //   h0 = 0x811c9dc5
    //   h1 = (h0 ^ 0xC3) * 0x01000193 mod 2^32 = 0x811c9d06 * 0x01000193 = 0x460b3072
    //   h2 = (h1 ^ 0xA9) * 0x01000193 mod 2^32 = 0x460b30db * 0x01000193 = 0x1e9de8c1
    // (verified against an independent Python implementation)
    expect(fnv1a32("é")).toBe("1e9de8c1");
    expect(fnv1a("é")).toBe("1e9de8");
  });

  it('"☃" (U+2603) — a three-byte UTF-8 code point, 0xE2 0x98 0x83', () => {
    // Independent Python cross-check: fnv1a32(b"\xe2\x98\x83") = 0x86c7c28c.
    expect(fnv1a32("☃")).toBe("86c7c28c");
  });

  it("renders 8 lowercase hex chars, first-6 form for identity hashes", () => {
    const full = fnv1a32("linelab");
    expect(full).toMatch(/^[0-9a-f]{8}$/);
    expect(fnv1a("linelab")).toBe(full.slice(0, 6));
    // the identity-hash regex pinned by design/05 §8.1 (^[0-9a-f]{6}$)
    expect(fnv1a("linelab")).toMatch(/^[0-9a-f]{6}$/);
  });
});

// ---------------------------------------------------------------------------
// canonicalize — sorted keys, ordered arrays, no whitespace, -0 → 0,
// undefined-key omission, non-finite → INTERNAL

describe("canonicalize", () => {
  it("sorts object keys recursively; arrays keep their order", () => {
    const canon = unwrap(canonicalize({ b: 1, a: { d: [3, 1, 2], c: true } }));
    expect(canon).toBe('{"a":{"c":true,"d":[3,1,2]},"b":1}');
  });

  it("key order in the source object is irrelevant to the hash", () => {
    // This is the whole point: spec_hash/result_hash are stable under key-order
    // churn. Usage idiom: fnv1a(canonicalize(x).value).
    const one = unwrap(canonicalize({ road: "lane 3.5 | S 35", entry_kmh: 70 }));
    const two = unwrap(canonicalize({ entry_kmh: 70, road: "lane 3.5 | S 35" }));
    expect(one).toBe(two);
    expect(fnv1a(one)).toBe(fnv1a(two));
  });

  it("sorts keys by UTF-16 code units, not locale ('Z' < 'a')", () => {
    expect(unwrap(canonicalize({ a: 1, Z: 2 }))).toBe('{"Z":2,"a":1}');
  });

  it("normalizes -0 to 0, including -0 produced by the emission-rounding idiom", () => {
    expect(unwrap(canonicalize(-0))).toBe("0");
    expect(unwrap(canonicalize({ d: -0 }))).toBe('{"d":0}');
    // The pinned rounding mechanism Number(x.toFixed(dp)) yields -0 for small
    // negative values; the canonical form must still read "0" (§6.3).
    const rounded = Number((-0.0004).toFixed(2));
    expect(Object.is(rounded, -0)).toBe(true);
    expect(unwrap(canonicalize({ heading_err_deg: rounded }))).toBe('{"heading_err_deg":0}');
  });

  it("omits undefined-valued keys; undefined array elements become null", () => {
    expect(unwrap(canonicalize({ kept: 1, dropped: undefined }))).toBe('{"kept":1}');
    expect(unwrap(canonicalize([1, undefined, 3]))).toBe("[1,null,3]");
  });

  it("serializes numbers via ECMAScript JSON.stringify (shortest round-trip)", () => {
    expect(unwrap(canonicalize([0.1, 5, 1e21, 1e-7]))).toBe("[0.1,5,1e+21,1e-7]");
  });

  it("emits no whitespace anywhere", () => {
    const canon = unwrap(canonicalize({ a: [1, 2], b: { c: "x y" } }));
    expect(canon.replace(/"x y"/, '"xy"')).not.toMatch(/\s/);
  });

  it("rejects non-finite numbers with INTERNAL, naming the offending path", () => {
    for (const bad of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      const r = canonicalize({ verdict: { corners: [{ grip_min: bad }] } });
      expect(r.ok).toBe(false);
      if (!r.ok) {
        expect(r.error.code).toBe("INTERNAL");
        expect(r.error.detail?.reason).toBe("non_finite_number");
        expect(r.error.at).toBe("$.verdict.corners[0].grip_min");
      }
    }
  });

  it("round-trips through JSON.parse (it is real JSON)", () => {
    const input = { s: 12.5, ids: ["c1", "c2"], nested: { ok: true } };
    expect(JSON.parse(unwrap(canonicalize(input)))).toEqual(input);
  });
});

// ---------------------------------------------------------------------------
// Closed-set enumeration (double-entry): each list is retyped here from the
// design doc named in the comment, then compared to the export — order included.

describe("closed-set enumeration (verbatim from the design docs)", () => {
  it("EventKind — design/05 §5, declaration order (event-time tie-break order)", () => {
    const fromDesignDoc05S5 = [
      "brake_start",
      "brake_end",
      "turn_in",
      "steering_complete",
      "crack",
      "roll_on",
      "apex",
      "exit",
      "release",
      "position_start",
      "position_complete",
      "position_shortfall",
      "sight_min",
      "run_wide_detect",
      "correction",
      "off_road",
      "hazard_visible",
      "violation",
      "crash",
      "stop",
      "road_end"
    ] as const;
    expect([...EVENT_KINDS]).toEqual([...fromDesignDoc05S5]);
    expect(EVENT_KINDS).toHaveLength(21);
  });

  it("Outcome — design/05 §6.1, precedence order crash > runoff > wide > stopped > contained", () => {
    expect([...OUTCOMES]).toEqual(["crash", "runoff", "wide", "stopped", "contained"]);
  });

  it("SteerState — design/02 §3.1 closed enum", () => {
    expect([...STEER_STATES]).toEqual(["track", "commit", "unwind", "position"]);
  });

  it("Phase — design/05 §4.1 closed five-token set", () => {
    expect([...PHASES]).toEqual(["approach", "turning", "midcorner", "exiting", "done"]);
  });

  it("Terminated.reason — design/05 §2, six values in termination-precedence order", () => {
    expect([...TERMINATED_REASONS]).toEqual([
      "crash", "off_road", "stopped", "road_end", "max_time", "max_dist"
    ]);
  });

  it("ErrorCode — ARCHITECTURE §4, the closed 8-set", () => {
    expect([...ERROR_CODES]).toEqual([
      "SCHEMA", "DUP_ID", "OUT_OF_SCOPE", "UNKNOWN_ID",
      "BAD_RANGE", "NO_SOLUTION", "INEFFECTUAL", "INTERNAL"
    ]);
  });

  it("rider profile names and ssd models — design/02 §3, design/03 §5", () => {
    expect([...RIDER_PROFILE_NAMES]).toEqual(["casual", "street", "trained", "racer"]);
    expect([...SSD_MODELS]).toEqual(["alert", "aashto"]);
  });
});

// ---------------------------------------------------------------------------
// Sample field order — design/05 §2.1 / §8.2 pinned CSV column order. The literal
// below is BOTH the runtime double-entry (Object.keys order vs SAMPLE_FIELDS) and
// a compile-time check that the Sample interface carries exactly these fields.

describe("Sample field order (design/05 §2.1, pinned append-only)", () => {
  it("SAMPLE_FIELDS matches the pinned order and the Sample interface", () => {
    const example: Sample = {
      // Kinematics & dynamics (core/)
      s: 12.5,
      t: 1.44,
      x: 12.5,
      y: 0,
      psi: 0,
      v: 13.9,
      phi: 0,
      kappa: 0,
      a_long: -2.1,
      a_lat: 0,
      grip: 0.79,
      mu: 1.0,
      d: -0.4,
      f: 1.0,
      // Commanded controls (plan/)
      cmd_lean: 0,
      cmd_a: -3.0,
      roll_rate: 50,
      action_id: "b1",
      clipped: true,
      n_long: -0.21,
      n_lat: 0,
      // Sight (sight/)
      sight_m: 42.0,
      ssd_m: 18.3,
      limit_x: 54.5,
      limit_y: 0,
      // Merged append block
      sight_ride_m: 41.7,
      steer_state: "track",
      lat_action_id: null,
      su_sustained: 0,
      su_transient: 0,
      a_cmd_rate: 0,
      below_validity: false
    };
    expect(Object.keys(example)).toEqual([...SAMPLE_FIELDS]);
    expect(SAMPLE_FIELDS).toHaveLength(32);
  });
});

// ---------------------------------------------------------------------------
// Units — the single conversion point (drift risk #11: sign conventions)

describe("units (core/units.ts — the ONLY conversion helpers)", () => {
  it('handSign("R") = +1, handSign("L") = −1 (y-down frame, +kappa = right-hand turn)', () => {
    expect(handSign("R")).toBe(1);
    expect(handSign("L")).toBe(-1);
  });

  it("degree/radian round trips", () => {
    expect(degToRad(180)).toBeCloseTo(Math.PI, 15);
    expect(radToDeg(Math.PI / 4)).toBeCloseTo(45, 12);
    expect(radToDeg(degToRad(28))).toBeCloseTo(28, 12);
  });

  it("km/h ↔ m/s (÷/× 3.6, exact)", () => {
    expect(kmhToMs(36)).toBe(10);
    expect(msToKmh(15)).toBe(54);
    expect(kmhToMs(70)).toBeCloseTo(19.4444444, 6);
  });
});

// ---------------------------------------------------------------------------
// Constants — design-stated relationships (not value re-typing theater; these
// inequalities are load-bearing claims in design/02 §5.2 and §7)

describe("constants relationships (design/02)", () => {
  it("A_SLEW_DEFAULT sits deliberately BELOW RATE_THRESHOLD (a default brake never fires the chop transient)", () => {
    expect(A_SLEW_DEFAULT).toBeLessThan(RATE_THRESHOLD);
  });

  it("schema slew bounds bracket the default", () => {
    expect(SLEW_MIN).toBeLessThan(A_SLEW_DEFAULT);
    expect(A_SLEW_DEFAULT).toBeLessThan(SLEW_MAX);
  });

  it("v_floor_ms (numerical stop) sits below v_valid_min_ms (model-validity band)", () => {
    expect(v_floor_ms).toBeLessThan(v_valid_min_ms);
  });

  it("the retained arc grid is coarser than a single integrator step at road speeds", () => {
    // at v = 7 m/s (v_valid_min_ms) one dt step covers 0.035 m << ds_m = 0.5 m
    expect(v_valid_min_ms * dt_s).toBeLessThan(ds_m);
  });

  it("rider profiles are frozen and closed over the profile-name set", () => {
    expect(Object.keys(RIDER_PROFILES)).toEqual([...RIDER_PROFILE_NAMES]);
    expect(Object.isFrozen(RIDER_PROFILES)).toBe(true);
    expect(Object.isFrozen(RIDER_PROFILES.street)).toBe(true);
    expect(RIDER_PROFILES.street.roll_rate_dps).toBe(50);
  });
});
