// test/oracle/rubric.test.ts — WP-06 gates (ARCHITECTURE §7):
//   A-CATALOGUE-RESOLVES, A-PACK-PROVENANCE (both pack dirs), P-QUALITY-TOTAL,
//   P-OUTCOME-RUBRIC-FREE (import-level + stubbed outcome inputs), the annex
//   validation of design/01 §A.6.1, tombstoned rename rejection (§A.5), and
//   per-check unit tests on hand-built records against design/01 Appendix A's
//   worked numbers (incl. the check-4 steer_share table).
//
// ── WP-17 section (engine-integrated exercise gates) — HOSTED at the end of
// this file: A-CATALOGUE-EXERCISED, A-CHAIN-GREEN, A-DANGER-DWELL (fail-
// fixture arm; the clean arm rides test/golden/roster.test.ts), and
// A-RUBRIC-STAMP. Corpus = the committed goldens' check vectors
// (test/fixtures/goldens/) ∪ the committed exercise fixtures
// (test/fixtures/exercise/*.json), run through the FULL engine here.
// ────────────────────────────────────────────────────────────────────────────

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import type { Event, Sample, Terminated } from "../../src/core/types.js";
import {
  RATE_THRESHOLD as CORE_RATE_THRESHOLD,
  A_SU_ONSET as CORE_A_SU_ONSET,
  eps_mag as CORE_EPS_MAG,
  RIDER_PROFILES
} from "../../src/core/constants.js";
import { muUse, phiMax, phiReserve, aWiden } from "../../src/core/slice.js";
import { degToRad, radToDeg } from "../../src/core/units.js";
import { run } from "../../src/solve/run.js";
import { isLineRefusal } from "../../src/solve/envelope.js";
import { deriveStations } from "../../src/solve/stations.js";
import type { FigureResult, LineResult } from "../../src/solve/types.js";
import { LINK_GAP_FRAC as ROAD_LINK_GAP_FRAC } from "../../src/road/constants.js";
import type {
  DoctrineBlock,
  DoctrineCorner,
  DoctrinePhysics,
  DoctrineRecord,
  CheckResult,
  RubricPack
} from "../../src/plan/doctrine/types.js";
import { CHECKS_VERSION, METRIC_IDS } from "../../src/plan/doctrine/metrics.js";
import {
  CHECK_BANDS,
  CHECK_IDS,
  CHECK_METRIC,
  CHECK_SCOPE,
  runChecks
} from "../../src/plan/doctrine/checks.js";
import {
  K_MEMBERS,
  KNOWN_BOOK_CITES,
  loadRubricPack,
  loadShippedRubricPack,
  resolveCheckId,
  rubricString,
  scanPackProvenance,
  TUNING_MARKED_NAMES,
  validateContinuationPackData
} from "../../src/plan/doctrine/pack.js";
import { clean, quality, QUALITIES } from "../../src/plan/doctrine/quality.js";
import parksStreetJson from "../../src/plan/doctrine/packs/parks-street.json" with { type: "json" };
import streetContinuationJson from "../../src/plan/continuations/packs/street.json" with { type: "json" };

const here = dirname(fileURLToPath(import.meta.url));
const linelabRoot = resolve(here, "../..");
const projectRoot = resolve(linelabRoot, "..");

// ---------------------------------------------------------------------------
// Fixture builders — hand-built finished records (design/01 §A.2: checks read
// only the record)

const V_DEFAULT = 10;

function mkSample(s: number, t: number, over: Partial<Sample> = {}): Sample {
  return {
    s,
    t,
    x: s,
    y: 0,
    psi: 0,
    v: V_DEFAULT,
    phi: 0,
    kappa: 0,
    a_long: 0,
    a_lat: 0,
    grip: 1,
    mu: 1,
    d: 0,
    f: 1.0,
    cmd_lean: 0,
    cmd_a: 0,
    roll_rate: 50,
    action_id: null,
    clipped: false,
    n_long: 0,
    n_lat: 0,
    sight_m: 200,
    ssd_m: 20,
    limit_x: 0,
    limit_y: 0,
    sight_ride_m: 200,
    steer_state: "track",
    lat_action_id: null,
    su_sustained: 0,
    su_transient: 0,
    a_cmd_rate: 0,
    below_validity: false,
    ...over
  };
}

/** Build a 0.5 m sample grid from `from` to `to`; t integrates ds/v. */
function series(from: number, to: number, fn: (s: number) => Partial<Sample>): Sample[] {
  const out: Sample[] = [];
  let t = 0;
  for (let s = from; s <= to + 1e-9; s += 0.5) {
    const over = fn(s);
    const v = over.v ?? V_DEFAULT;
    if (out.length > 0) t += 0.5 / v;
    out.push(mkSample(Number(s.toFixed(3)), t, over));
  }
  return out;
}

function tAt(samples: readonly Sample[], s: number): number {
  let best = samples[0] as Sample;
  for (const sm of samples) {
    if (Math.abs(sm.s - s) < Math.abs(best.s - s)) best = sm;
  }
  return best.t;
}

function ev(kind: Event["kind"], samples: readonly Sample[], s: number, corner_id: string): Event {
  return { kind, s, t: tAt(samples, s), corner_id };
}

const PHYSICS: DoctrinePhysics = {
  phi_reserve_deg: 40.36, // atan(mu_use = 0.85) — the street reserve
  phi_max_deg: 45, // atan(mu = 1.0)
  a_widen_ms2: (phiDeg) => (Math.abs(phiDeg) >= 15 ? 4.0 : null),
  brake_gap_m: 4
};

function mkCorner(over: Partial<DoctrineCorner> & { id: string }): DoctrineCorner {
  return {
    hand: "R",
    s0: 20,
    s1: 38.85, // book90 proportions: R 12 m, 90° → L_c = 18.85 m
    type: "constant",
    linked_next: false,
    apexes: [],
    ...over
  };
}

function mkRecord(
  samples: readonly Sample[],
  events: readonly Event[],
  corners: readonly DoctrineCorner[],
  over: Partial<DoctrineRecord> = {}
): DoctrineRecord {
  const last = samples[samples.length - 1] as Sample;
  const terminated: Terminated = {
    reason: "road_end",
    s: last.s,
    t: last.t,
    x: last.x,
    y: last.y
  };
  return { samples, events, terminated, corners, physics: PHYSICS, ...over };
}

const PACK: RubricPack = (() => {
  const r = loadRubricPack(parksStreetJson);
  if (!r.ok) throw new Error(`parks-street.json failed to load: ${r.error.message}`);
  return r.value;
})();

function resultsFor(record: DoctrineRecord, id: string): readonly CheckResult[] {
  return runChecks(record, PACK).checks.filter((c) => c.id === id);
}

function one(record: DoctrineRecord, id: string, cornerId?: string): CheckResult {
  const all = resultsFor(record, id).filter(
    (c) => cornerId === undefined || c.corner_id === cornerId
  );
  expect(all.length).toBeGreaterThan(0);
  return all[0] as CheckResult;
}

// ---------------------------------------------------------------------------
// Pack identity + A-CATALOGUE-RESOLVES

describe("parks-street/2 pack identity (design/01 §A.6)", () => {
  it("loads, and its rubric string is parks-street/2", () => {
    expect(rubricString(PACK)).toBe("parks-street/2");
    expect(PACK.pack).toBe("linelab-rubric/1");
    expect(PACK.requires_checks_version).toBe(CHECKS_VERSION);
  });

  it("ships the 16-check catalogue in Appendix A order, closed", () => {
    expect(PACK.checks.map((c) => c.id)).toEqual([...CHECK_IDS]);
  });

  it("the sole v2 critical is wrong_strategy_for_corner", () => {
    const critical = PACK.checks.filter((c) => c.severity === "critical");
    expect(critical.map((c) => c.id)).toEqual(["wrong_strategy_for_corner"]);
  });

  it("every check's scope matches the catalogue table", () => {
    for (const c of PACK.checks) {
      expect(c.scope, c.id).toBe(CHECK_SCOPE[c.id as (typeof CHECK_IDS)[number]]);
    }
  });

  it("A-CATALOGUE-RESOLVES: every check binds a shipped metric and covers its band tokens", () => {
    for (const c of PACK.checks) {
      const id = c.id as (typeof CHECK_IDS)[number];
      expect((METRIC_IDS as readonly string[]).includes(c.metric), c.id).toBe(true);
      expect(c.metric, c.id).toBe(CHECK_METRIC[id]);
      for (const token of CHECK_BANDS[id]) {
        expect(Object.keys(c.bands), `${c.id} band ${token}`).toContain(token);
      }
    }
  });

  it("annex.reserve_checks is exactly ['lean_ceiling', 'stop_within_sight'] (D43)", () => {
    expect(PACK.annex.reserve_checks).toEqual(["lean_ceiling", "stop_within_sight"]);
  });

  it("the rename table carries sight_vs_stopping → stop_within_sight (§A.5)", () => {
    expect(PACK.renames).toEqual({ sight_vs_stopping: "stop_within_sight" });
  });

  it("pack thresholds that mirror engine constants stay keyed to them (one trigger)", () => {
    const th = (id: string, name: string): number => {
      const row = PACK.checks.find((c) => c.id === id);
      const entry = row?.thresholds[name];
      expect(entry, `${id}.${name}`).toBeDefined();
      return (entry as { value: number }).value;
    };
    // check 5's chop leg keys on the SAME constant as 02 §5.2's transient stand-up
    expect(th("throttle_rule", "RATE_THRESHOLD")).toBe(CORE_RATE_THRESHOLD);
    expect(th("trail_brake_taper", "A_SU_ONSET")).toBe(CORE_A_SU_ONSET);
    expect(th("traction_ceiling", "eps_mag")).toBe(CORE_EPS_MAG);
    expect(th("link_continuity", "LINK_GAP_FRAC")).toBe(ROAD_LINK_GAP_FRAC);
    // SMALL_LEAN_DEG is one value wherever it appears
    expect(th("quick_steer", "SMALL_LEAN_DEG")).toBe(th("throttle_rule", "SMALL_LEAN_DEG"));
    expect(th("quick_steer", "SMALL_LEAN_DEG")).toBe(th("chain_flow", "SMALL_LEAN_DEG"));
  });
});

// ---------------------------------------------------------------------------
// Pack loader rejections (typed: code + detail.reason, never message text)

function cloneParks(): Record<string, unknown> {
  return JSON.parse(JSON.stringify(parksStreetJson)) as Record<string, unknown>;
}

describe("pack loader — typed rejections", () => {
  it("requires_checks_version mismatch → SCHEMA naming both versions", () => {
    const bad = cloneParks();
    bad["requires_checks_version"] = 1;
    const r = loadRubricPack(bad);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.code).toBe("SCHEMA");
      expect(r.error.detail?.["reason"]).toBe("checks_version_mismatch");
      expect(r.error.message).toContain("1");
      expect(r.error.message).toContain("2");
    }
  });

  it("annex absent → SCHEMA/reserve_checks_missing at rubric.annex.reserve_checks", () => {
    const bad = cloneParks();
    delete bad["annex"];
    const r = loadRubricPack(bad);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.code).toBe("SCHEMA");
      expect(r.error.detail?.["reason"]).toBe("reserve_checks_missing");
      expect(r.error.at).toBe("rubric.annex.reserve_checks");
    }
  });

  it("annex.reserve_checks empty → SCHEMA/reserve_checks_empty", () => {
    const bad = cloneParks();
    bad["annex"] = { reserve_checks: [] };
    const r = loadRubricPack(bad);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.code).toBe("SCHEMA");
      expect(r.error.detail?.["reason"]).toBe("reserve_checks_empty");
    }
  });

  it("annex member not in the pack's check id set → UNKNOWN_ID/unknown_reserve_check", () => {
    const bad = cloneParks();
    bad["annex"] = { reserve_checks: ["lean_ceiling", "nope"] };
    const r = loadRubricPack(bad);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.code).toBe("UNKNOWN_ID");
      expect(r.error.detail?.["reason"]).toBe("unknown_reserve_check");
      expect(r.error.message).toContain("nope");
      expect(r.error.message).toContain("parks-street");
    }
  });

  it("tombstoned rename in the annex → UNKNOWN_ID/renamed_check naming the successor", () => {
    const bad = cloneParks();
    bad["annex"] = { reserve_checks: ["sight_vs_stopping"] };
    const r = loadRubricPack(bad);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.code).toBe("UNKNOWN_ID");
      expect(r.error.detail?.["reason"]).toBe("renamed_check");
      expect(r.error.message).toContain("stop_within_sight");
    }
  });

  it("a pack id with no shipped evaluator → UNKNOWN_ID (a pack cannot introduce arithmetic)", () => {
    const bad = cloneParks();
    const checks = bad["checks"] as Record<string, unknown>[];
    (checks[0] as Record<string, unknown>)["id"] = "my_new_check";
    const r = loadRubricPack(bad);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.code).toBe("UNKNOWN_ID");
      expect(r.error.detail?.["reason"]).toBe("unknown_check_id");
    }
  });

  it("a non-scalar threshold value → SCHEMA/pack_defines_rider (expression vs scalar, D12)", () => {
    const bad = cloneParks();
    const checks = bad["checks"] as Record<string, unknown>[];
    const th = (checks[3] as Record<string, unknown>)["thresholds"] as Record<string, unknown>;
    th["QS_SHARE_FAIL"] = { value: "0.3 * v", units: "-", source: "TUNING" };
    const r = loadRubricPack(bad);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.code).toBe("SCHEMA");
      expect(r.error.detail?.["reason"]).toBe("pack_defines_rider");
    }
  });

  it("unknown rubric NAME → UNKNOWN_ID; the shipped name resolves", () => {
    const bad = loadShippedRubricPack("track-day");
    expect(bad.ok).toBe(false);
    if (!bad.ok) {
      expect(bad.error.code).toBe("UNKNOWN_ID");
      expect(bad.error.detail?.["reason"]).toBe("unknown_rubric");
    }
    expect(loadShippedRubricPack("parks-street").ok).toBe(true);
  });

  it("a row missing a threshold its arithmetic consumes → SCHEMA/thresholds_incomplete naming check id + name", () => {
    const bad = cloneParks();
    const checks = bad["checks"] as Record<string, unknown>[];
    const th = (checks[3] as Record<string, unknown>)["thresholds"] as Record<string, unknown>;
    delete th["QS_SHARE_FAIL"]; // quick_steer would silently pass every roll-in via the NaN fallback
    const r = loadRubricPack(bad);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.code).toBe("SCHEMA");
      expect(r.error.detail?.["reason"]).toBe("thresholds_incomplete");
      expect(r.error.detail?.["id"]).toBe("quick_steer");
      expect(r.error.detail?.["missing"]).toBe("QS_SHARE_FAIL");
    }
  });

  it("threshold completeness is symmetric with bands: a re-bound value loads, an omitted name never does", () => {
    const rebound = cloneParks();
    const checks = rebound["checks"] as Record<string, unknown>[];
    const th = (checks[3] as Record<string, unknown>)["thresholds"] as Record<
      string,
      { value: number }
    >;
    (th["QS_SHARE_FAIL"] as { value: number }).value = 0.5; // legal variant re-tune
    expect(loadRubricPack(rebound).ok).toBe(true);
  });
});

describe("check-id tombstones (design/01 §A.5)", () => {
  it("renamed id resolves UNKNOWN_ID/renamed_check with the successor named", () => {
    const r = resolveCheckId(PACK, "sight_vs_stopping");
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.code).toBe("UNKNOWN_ID");
      expect(r.error.detail?.["reason"]).toBe("renamed_check");
      expect(r.error.message).toBe(
        "sight_vs_stopping was renamed to stop_within_sight in checks_version 2"
      );
    }
  });

  it("struck ids reject struck_by_decision — never deferred", () => {
    for (const id of ["out_available", "sight_ok", "commit_within_sight"]) {
      const r = resolveCheckId(PACK, id);
      expect(r.ok).toBe(false);
      if (!r.ok) {
        expect(r.error.code).toBe("UNKNOWN_ID");
        expect(r.error.detail?.["reason"]).toBe("struck_by_decision");
        expect(r.error.deferred).toBeUndefined();
      }
    }
  });

  it("a shipped id resolves ok; an unknown id rejects unknown_check", () => {
    expect(resolveCheckId(PACK, "stop_within_sight").ok).toBe(true);
    const r = resolveCheckId(PACK, "entry_speed");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.detail?.["reason"]).toBe("unknown_check");
  });
});

// ---------------------------------------------------------------------------
// A-PACK-PROVENANCE — over BOTH committed pack dirs + book_text/ resolution

describe("A-PACK-PROVENANCE (design/09 §4)", () => {
  const packDirs = [
    join(linelabRoot, "src/plan/doctrine/packs"),
    join(linelabRoot, "src/plan/continuations/packs")
  ];
  const committed: { file: string; json: unknown }[] = [];
  for (const dir of packDirs) {
    for (const f of readdirSync(dir)) {
      if (f.endsWith(".json")) {
        committed.push({ file: join(dir, f), json: JSON.parse(readFileSync(join(dir, f), "utf8")) });
      }
    }
  }

  it("finds both committed packs", () => {
    expect(committed.length).toBe(2);
  });

  it("(a) every source string in every committed pack is TUNING or ^book:", () => {
    for (const { file, json } of committed) {
      const r = scanPackProvenance(json);
      expect(r.ok, file).toBe(true);
      if (r.ok) expect(r.value, `${file} has zero sources`).toBeGreaterThan(0);
    }
  });

  it("(b) every book:<cite> resolves to a line present in book_text/", () => {
    const fulltext = readFileSync(
      join(projectRoot, "book_text/total-control-fulltext.md"),
      "utf8"
    );
    const cites: string[] = [];
    const walk = (node: unknown): void => {
      if (Array.isArray(node)) return node.forEach(walk);
      if (typeof node !== "object" || node === null) return;
      for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
        if (k === "source" && typeof v === "string" && v.startsWith("book:")) {
          cites.push(v.slice(5));
        } else {
          walk(v);
        }
      }
    };
    for (const { json } of committed) walk(json);
    expect(cites.length).toBeGreaterThan(0);
    for (const cite of cites) {
      expect(fulltext.includes(cite), `unresolved cite: ${cite}`).toBe(true);
      // the in-code registry (the pure loader's view of book_text/) stays honest
      expect(KNOWN_BOOK_CITES).toContain(cite);
    }
    // and every registry entry itself resolves on disk
    for (const cite of KNOWN_BOOK_CITES) {
      expect(fulltext.includes(cite), `stale registry cite: ${cite}`).toBe(true);
    }
  });

  it("(c) no committed pack binds a design-of-record TUNING name with a book: source", () => {
    const offenders: string[] = [];
    const walk = (node: unknown, parentKey: string | null): void => {
      if (Array.isArray(node)) return node.forEach((n) => walk(n, parentKey));
      if (typeof node !== "object" || node === null) return;
      const rec = node as Record<string, unknown>;
      const src = rec["source"];
      if (
        typeof src === "string" &&
        src.startsWith("book:") &&
        parentKey !== null &&
        TUNING_MARKED_NAMES.includes(parentKey)
      ) {
        offenders.push(parentKey);
      }
      for (const [k, v] of Object.entries(rec)) walk(v, k);
    };
    for (const { json } of committed) walk(json, null);
    expect(offenders).toEqual([]);
  });

  it("loader rejects a free-prose source → SCHEMA/source_unresolved", () => {
    const bad = cloneParks();
    const checks = bad["checks"] as Record<string, unknown>[];
    const th = (checks[0] as Record<string, unknown>)["thresholds"] as Record<
      string,
      { value: number; units: string; source: string }
    >;
    (th["APEX_PCT_BAR_CONSTANT"] as { source: string }).source = "measured on a track day";
    const r = loadRubricPack(bad);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.code).toBe("SCHEMA");
      expect(r.error.detail?.["reason"]).toBe("source_unresolved");
      // §A.6: the rejection names the check id and the string, not just the path
      expect(r.error.detail?.["check_id"]).toBe("late_apex");
      expect(r.error.detail?.["source"]).toBe("measured on a track day");
    }
  });

  it("loader rejects an unresolvable book cite → SCHEMA/source_unresolved", () => {
    const bad = cloneParks();
    const checks = bad["checks"] as Record<string, unknown>[];
    const th = (checks[0] as Record<string, unknown>)["thresholds"] as Record<
      string,
      { source: string }
    >;
    (th["APEX_PCT_BAR_CONSTANT"] as { source: string }).source =
      "book:this sentence does not appear in the book";
    const r = loadRubricPack(bad);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.detail?.["reason"]).toBe("source_unresolved");
      expect(r.error.detail?.["check_id"]).toBe("late_apex");
      expect(r.error.detail?.["cite"]).toBe("this sentence does not appear in the book");
    }
  });

  it("loader rejects a TUNING value dressed as a book citation → SCHEMA/source_unresolved", () => {
    const bad = cloneParks();
    const checks = bad["checks"] as Record<string, unknown>[];
    const th = (checks[1] as Record<string, unknown>)["thresholds"] as Record<
      string,
      { source: string }
    >;
    (th["OIO_OUTSIDE_MIN"] as { source: string }).source = `book:${KNOWN_BOOK_CITES[0]}`;
    const r = loadRubricPack(bad);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.detail?.["reason"]).toBe("source_unresolved");
      expect(r.error.detail?.["check_id"]).toBe("out_in_out");
      expect(r.error.detail?.["name"]).toBe("OIO_OUTSIDE_MIN");
    }
  });
});

// ---------------------------------------------------------------------------
// The committed continuation pack (D45 data; no loader beyond provenance in v0.1)

describe("continuation pack street.json (design/03 §7a.2, D45-repaired bounds)", () => {
  const env = streetContinuationJson.envelope;

  it("carries the repaired envelope bounds verbatim", () => {
    expect(streetContinuationJson.pack).toBe("linelab-continuations/1");
    expect(streetContinuationJson.name).toBe("street");
    expect(streetContinuationJson.version).toBe(1);
    expect(env.kappa_max_1pm.value).toBe(1 / 7); // 0.14285714285714285 at binary64
    expect(env.dkappa_ds_max_1pm2.value).toBe(0.005); // raised from 0.0025 (D46 audit)
    expect(env.member_sweep_max_deg.value).toBe(150.0);
    // coupled constants move together (§7a.3 normative)
    expect(env.kappa_step_max_1pm.value).toBeGreaterThanOrEqual(env.kappa_max_1pm.value);
  });

  it("ladder is the fixed 7-rung sigma ladder", () => {
    expect(streetContinuationJson.ladder).toEqual([-1, -0.6667, -0.3333, 0, 0.3333, 0.6667, 1]);
  });

  it("references the escape rider by registry id, never defines one", () => {
    expect(streetContinuationJson.escape_rider).toBe("brake_reserve_escape");
    expect(streetContinuationJson.escape.escape_decel_mss.source).toBe("TUNING");
    expect(streetContinuationJson.escape.escape_ellipse_max.source).toBe("TUNING");
  });

  // -- design/03 §7a.2/§7a.3 load-time typed rejections (data-level; the D45
  //    loader calls this gate — v0.1 exercises it on the committed file)

  function cloneStreet(): Record<string, unknown> {
    return JSON.parse(JSON.stringify(streetContinuationJson)) as Record<string, unknown>;
  }

  it("the committed pack passes data-level validation (provenance + cardinality + coupling)", () => {
    const r = validateContinuationPackData(streetContinuationJson);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBeGreaterThan(0); // provenance actually scanned sources
  });

  it("ladder length ≠ K_MEMBERS → SCHEMA/ladder_cardinality_mismatch at prior.ladder", () => {
    const bad = cloneStreet();
    (bad["ladder"] as number[]).pop(); // 6 rungs against K_MEMBERS = 7
    const r = validateContinuationPackData(bad);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.code).toBe("SCHEMA");
      expect(r.error.detail?.["reason"]).toBe("ladder_cardinality_mismatch");
      expect(r.error.at).toBe("prior.ladder");
      expect(r.error.detail?.["expected"]).toBe(K_MEMBERS);
      expect(r.error.detail?.["got"]).toBe(K_MEMBERS - 1);
    }
  });

  it("kappa_step_max_1pm < kappa_max_1pm → SCHEMA (the §7a.3 coupled-constants check)", () => {
    const bad = cloneStreet();
    const env = bad["envelope"] as Record<string, { value: number }>;
    (env["kappa_step_max_1pm"] as { value: number }).value = 0.1; // below kappa_max 1/7
    const r = validateContinuationPackData(bad);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.code).toBe("SCHEMA");
      expect(r.error.detail?.["reason"]).toBe("kappa_step_below_kappa_max");
      expect(r.error.detail?.["kappa_max_1pm"]).toBe(1 / 7);
    }
  });

  it("a dishonest source string in a continuation pack refuses at the same gate", () => {
    const bad = cloneStreet();
    const env = bad["envelope"] as Record<string, { source: string }>;
    (env["kappa_max_1pm"] as { source: string }).source = "measured on a track day";
    const r = validateContinuationPackData(bad);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.detail?.["reason"]).toBe("source_unresolved");
  });
});

// ---------------------------------------------------------------------------
// Per-check unit tests (design/01 §A.3 arithmetic on hand-built records)

/** Single book90-proportioned constant corner, phi/cmd ramp parameterized. */
function book90Record(over: {
  crossS?: number; // station where |phi| reaches 0.9·phi_c
  phiC?: number;
  v?: number;
  apexes?: DoctrineCorner["apexes"];
  cornerOver?: Partial<DoctrineCorner>;
  sampleOver?: (s: number) => Partial<Sample>;
  recordOver?: Partial<DoctrineRecord>;
}): DoctrineRecord {
  const crossS = over.crossS ?? 24.2;
  const phiC = over.phiC ?? 25.2;
  const v = over.v ?? 8.33;
  const ramp = (s: number): number =>
    s < 20 ? 0 : Math.min(phiC, (0.9 * phiC * (s - 20)) / (crossS - 20));
  const samples = series(10, 40, (s) => ({
    v,
    phi: ramp(s),
    cmd_lean: s < 20 ? 0 : Math.min(phiC, (phiC * (s - 20)) / (crossS - 20)),
    f: 1 - 0.8 * Math.exp(-((s - 30) ** 2) / 20), // dip to f≈0.2 at s=30 (apex)
    ...(over.sampleOver ? over.sampleOver(s) : {})
  }));
  const corner = mkCorner({ id: "c1", apexes: over.apexes ?? [], ...(over.cornerOver ?? {}) });
  const events = [ev("turn_in", samples, 20, "c1")];
  return mkRecord(samples, events, [corner], over.recordOver ?? {});
}

describe("check 4 quick_steer — the worked steer_share table (design/01 §A.3)", () => {
  it("good line at street 50°/s: share ≈ 0.22 → pass", () => {
    const r = one(book90Record({ crossS: 24.2 }), "quick_steer");
    expect(r.verdict).toBe("pass");
    const share = (r.evidence.metrics?.["steer_share"] as number) ?? NaN;
    expect(share).toBeGreaterThan(0.2);
    expect(share).toBeLessThan(0.3);
  });

  it("slow_steer ×0.3 → share ≈ 0.74 → fail", () => {
    const r = one(book90Record({ crossS: 34.0 }), "quick_steer");
    expect(r.verdict).toBe("fail");
    const share = (r.evidence.metrics?.["steer_share"] as number) ?? NaN;
    expect(share).toBeGreaterThan(0.45);
  });

  it("gentler ×0.45 re-tune → share ≈ 0.50 → still fail (robust to re-tune)", () => {
    const r = one(book90Record({ crossS: 29.3 }), "quick_steer");
    expect(r.verdict).toBe("fail");
    const share = (r.evidence.metrics?.["steer_share"] as number) ?? NaN;
    expect(share).toBeGreaterThan(0.45);
    expect(share).toBeLessThan(0.55);
  });

  it("share in the warn band → warn (two-sided ladder)", () => {
    const r = one(book90Record({ crossS: 27.0 }), "quick_steer");
    expect(r.verdict).toBe("warn");
  });

  it("phi_c below SMALL_LEAN_DEG → na with typed reason (never asserted)", () => {
    const r = one(book90Record({ phiC: 2.0 }), "quick_steer");
    expect(r.verdict).toBe("na");
    expect(r.evidence.metrics?.["reason"]).toBe("no_real_steering");
  });
});

describe("check 1 late_apex", () => {
  it("constant radius: pct 55 > 50 → pass; pct 45 → fail citing {apex_pct, bar}", () => {
    const pass = one(
      book90Record({ apexes: [{ s: 30, pct: 55, f: 0.2 }] }),
      "late_apex"
    );
    expect(pass.verdict).toBe("pass");
    const fail = one(book90Record({ apexes: [{ s: 26, pct: 45, f: 0.2 }] }), "late_apex");
    expect(fail.verdict).toBe("fail");
    expect(fail.evidence.metrics?.["apex_pct"]).toBe(45);
    expect(fail.evidence.metrics?.["bar"]).toBe(50);
  });

  it("decreasing radius: the bar moves to 60", () => {
    const cornerOver = { type: "decreasing" as const, r1: 16, r2: 9 };
    const midway = one(
      book90Record({ apexes: [{ s: 30, pct: 55, f: 0.2 }], cornerOver }),
      "late_apex"
    );
    expect(midway.verdict).toBe("fail");
    const late = one(
      book90Record({ apexes: [{ s: 33, pct: 65, f: 0.2 }], cornerOver }),
      "late_apex"
    );
    expect(late.verdict).toBe("pass");
  });

  it("increasing radius → na (apex comes earlier; the rubric refuses)", () => {
    const r = one(
      book90Record({ apexes: [{ s: 25, pct: 30, f: 0.2 }], cornerOver: { type: "increasing" } }),
      "late_apex"
    );
    expect(r.verdict).toBe("na");
    expect(r.evidence.metrics?.["reason"]).toBe("increasing_radius");
  });
});

describe("check 1 late_apex — honest fallback when the recorded apex list is empty (§A.2)", () => {
  // psi ramps 4°/m through the corner (hand R, so cumΔψ is positive); f dips
  // at apexS. mkCorner default geometry: s0 = 20, s1 = 38.85 → L_c = 18.85 m.
  function fallbackRecord(over: {
    cornerOver?: Partial<DoctrineCorner>;
    endS?: number; // record end — < 38.85 simulates an early-terminated line
    apexS?: number; // argmin-f station
    exitEvent?: boolean;
  }): DoctrineRecord {
    const endS = over.endS ?? 40;
    const apexS = over.apexS ?? 30;
    const samples = series(10, endS, (s) => ({
      psi: s < 20 ? 0 : 4 * (s - 20),
      phi: s < 20 ? 0 : 25,
      cmd_lean: s < 20 ? 0 : 25,
      f: 1 - 0.8 * Math.exp(-((s - apexS) ** 2) / 8)
    }));
    const corner = mkCorner({ id: "c1", apexes: [], ...(over.cornerOver ?? {}) });
    const events = [ev("turn_in", samples, 20, "c1")];
    if (over.exitEvent) events.push(ev("exit", samples, corner.s1, "c1"));
    return mkRecord(samples, events, [corner]);
  }

  // Taper sweep is EXACT geometry: r linear in swept angle (road/compose.ts),
  // so Θ = L_c / mean(r1, r2) = 18.85 / 12.5 rad = 86.40°.
  const taper = { type: "decreasing" as const, r1: 16, r2: 9 };

  it("early-terminated line on a taper still grades — sweep from geometry, pct measured", () => {
    const late = one(
      fallbackRecord({ cornerOver: taper, endS: 36, apexS: 34 }),
      "late_apex"
    );
    expect(late.verdict).toBe("pass"); // cumΔψ = 56° / 86.40° = 64.8 % > 60
    expect(late.evidence.metrics?.["apex_pct"] as number).toBeCloseTo(64.8, 1);

    const early = one(
      fallbackRecord({ cornerOver: taper, endS: 36, apexS: 26 }),
      "late_apex"
    );
    expect(early.verdict).toBe("fail"); // 24° / 86.40° = 27.8 % < 60 — measured, not fabricated
    expect(early.evidence.metrics?.["apex_pct"] as number).toBeCloseTo(27.8, 1);
  });

  it("completed arc corner grades from the measured heading capture (exit event)", () => {
    // denominator = net Δψ entry → exit sample (psi 76° at the s≈38.85 capture)
    const late = one(fallbackRecord({ apexS: 36, exitEvent: true }), "late_apex");
    expect(late.verdict).toBe("pass"); // 64/76 = 84.2 % > 50
    expect(late.evidence.metrics?.["apex_pct"] as number).toBeCloseTo(84.2, 1);

    const early = one(fallbackRecord({ apexS: 24, exitEvent: true }), "late_apex");
    expect(early.verdict).toBe("fail"); // 16/76 = 21.1 %
    expect(early.evidence.metrics?.["apex_pct"] as number).toBeCloseTo(21.1, 1);
  });

  it("arc with no completed capture: refuses na/sweep_unmeasurable — never a fabricated {apex_pct: 0}", () => {
    const r = one(fallbackRecord({ endS: 34, apexS: 26 }), "late_apex");
    expect(r.verdict).toBe("na");
    expect(r.evidence.metrics?.["reason"]).toBe("sweep_unmeasurable");
    expect(r.evidence.metrics?.["apex_pct"]).toBeUndefined();
  });
});

describe("check 2 out_in_out", () => {
  it("wide-in, inside touch, wide-out → pass", () => {
    const rec = book90Record({
      sampleOver: (s) => ({
        f: s < 22 ? 0.9 : s < 34 ? 1 - 0.8 * Math.exp(-((s - 28) ** 2) / 8) : 0.8
      })
    });
    // exit event so exit_f is the recorded exit sample
    const events = [...rec.events, ev("exit", rec.samples, 38.5, "c1")];
    const r = one({ ...rec, events }, "out_in_out");
    expect(r.verdict).toBe("pass");
  });

  it("apex never reaches the inside → fail", () => {
    const rec = book90Record({ sampleOver: () => ({ f: 0.9 }) });
    const events = [...rec.events, ev("exit", rec.samples, 38.5, "c1")];
    const r = one({ ...rec, events }, "out_in_out");
    expect(r.verdict).toBe("fail");
  });
});

describe("check 3 single_input", () => {
  function inputRecord(cmdLean: (s: number) => number, style?: "double_apex"): DoctrineRecord {
    const samples = series(10, 40, (s) => ({ cmd_lean: cmdLean(s), phi: cmdLean(s) }));
    const rec = mkRecord(samples, [ev("turn_in", samples, 20, "c1")], [mkCorner({ id: "c1" })]);
    return style ? { ...rec, declared_style: style } : rec;
  }
  const oneRise = (s: number): number => (s < 20 ? 0 : Math.min(25, (25 * (s - 20)) / 4));
  const twoRises = (s: number): number => {
    if (s < 20) return 0;
    if (s < 23) return Math.min(20, (20 * (s - 20)) / 3);
    if (s < 25) return 20 - 2.5 * (s - 23); // dip to 15
    return Math.min(25, 15 + 5 * (s - 25));
  };
  const sawtooth = (s: number): number => {
    if (s < 20) return 0;
    const k = Math.floor((s - 20) / 2);
    const inRise = (s - 20) % 2 < 1;
    const base = 4 * k;
    return inRise ? base + 8 * ((s - 20) % 2) : base + 8 - 4 * ((s - 20) % 2 - 1);
  };

  it("one commanded input → pass", () => {
    expect(one(inputRecord(oneRise), "single_input").verdict).toBe("pass");
  });

  it("the second bite → fail", () => {
    const r = one(inputRecord(twoRises), "single_input");
    expect(r.verdict).toBe("fail");
    expect(r.evidence.metrics?.["count"]).toBe(2);
  });

  it("declared double_apex tolerates exactly 2", () => {
    expect(one(inputRecord(twoRises, "double_apex"), "single_input").verdict).toBe("pass");
  });

  it("single-apex: zero commanded inputs → no_input fail ('pass iff count = 1')", () => {
    const r = one(inputRecord(() => 0), "single_input");
    expect(r.verdict).toBe("fail");
    expect(r.evidence.metrics?.["count"]).toBe(0);
  });

  it("declared double_apex: zero inputs pass — the letter's 'pass iff count ≤ 2' includes 0 (§A.3)", () => {
    const r = one(inputRecord(() => 0, "double_apex"), "single_input");
    expect(r.verdict).toBe("pass");
    expect(r.evidence.metrics?.["count"]).toBe(0);
  });

  it("≥ 3 inputs always fail regardless of declaration (anti-gaming)", () => {
    const r = one(inputRecord(sawtooth, "double_apex"), "single_input");
    expect(r.verdict).toBe("fail");
    expect(r.evidence.metrics?.["count"] as number).toBeGreaterThanOrEqual(3);
  });
});

describe("check 5 throttle_rule", () => {
  function throttleRecord(over: {
    vminS?: number;
    chopAt?: number;
    midBrakeAt?: number;
    midBrakeId?: string;
  }): DoctrineRecord {
    const vminS = over.vminS ?? 28;
    const samples = series(10, 40, (s) => {
      const phi = s < 20 ? 0 : Math.min(25, (25 * (s - 20)) / 4);
      const braking = s <= 19.5;
      let cmd_a = braking ? -3 : 0;
      let action_id: string | null = braking ? "b1" : null;
      if (s >= 31) cmd_a = 1.0; // roll-on
      if (over.midBrakeAt !== undefined && Math.abs(s - over.midBrakeAt) < 0.25) {
        cmd_a = -1.0;
        action_id = over.midBrakeId ?? "b2";
      }
      const a_cmd_rate =
        over.chopAt !== undefined && Math.abs(s - over.chopAt) < 0.25 ? -10 : 0;
      // v: decel to the dip at vminS, then build
      const v = s < vminS ? 12 - 0.02 * (s - 10) : 11.5 + 0.05 * (s - vminS);
      const f = 1 - 0.8 * Math.exp(-((s - 30) ** 2) / 8); // apex at 30
      return { phi, cmd_lean: phi, cmd_a, action_id, a_cmd_rate, v, f };
    });
    return mkRecord(samples, [ev("turn_in", samples, 20, "c1")], [mkCorner({ id: "c1" })]);
  }

  it("crack → v_min ≤ apex → roll-on, no chop → pass", () => {
    expect(one(throttleRecord({}), "throttle_rule").verdict).toBe("pass");
  });

  it("v_min after the apex → fail", () => {
    const r = one(throttleRecord({ vminS: 35 }), "throttle_rule");
    expect(r.verdict).toBe("fail");
    expect(r.evidence.metrics?.["missed"]).toContain("v_min");
  });

  it("a commanded chop after steering_complete → fail (keys on RATE_THRESHOLD)", () => {
    const r = one(throttleRecord({ chopAt: 27 }), "throttle_rule");
    expect(r.verdict).toBe("fail");
    expect(r.evidence.metrics?.["missed"]).toContain("discipline");
  });

  it("mid-corner brake fails — unless it is the entry brake action (trail-brake split)", () => {
    const foreign = one(throttleRecord({ midBrakeAt: 27, midBrakeId: "b2" }), "throttle_rule");
    expect(foreign.verdict).toBe("fail");
    const entry = one(throttleRecord({ midBrakeAt: 27, midBrakeId: "b1" }), "throttle_rule");
    expect(entry.verdict).toBe("pass");
  });
});

describe("check 6 trail_brake_taper", () => {
  function taperRecord(over: {
    brakeEndS?: number; // last station with cmd_a < 0
    decel?: (s: number) => number; // delivered −a_long
    phiCross15?: number;
  }): DoctrineRecord {
    const brakeEnd = over.brakeEndS ?? 24;
    const phiCross = over.phiCross15 ?? 23;
    const samples = series(10, 40, (s) => {
      const phi = s < 20 ? 0 : Math.min(25, (15 * (s - 20)) / (phiCross - 20));
      const decel = over.decel ? over.decel(s) : 0;
      return {
        phi,
        cmd_lean: phi,
        cmd_a: s <= brakeEnd ? -2 : 0,
        a_long: -decel,
        f: 1 - 0.8 * Math.exp(-((s - 30) ** 2) / 8)
      };
    });
    return mkRecord(samples, [ev("turn_in", samples, 20, "c1")], [mkCorner({ id: "c1" })]);
  }

  it("entry braking complete ≥ brake_gap before turn-in → na (the baseline)", () => {
    const r = one(taperRecord({ brakeEndS: 15.5 }), "trail_brake_taper");
    expect(r.verdict).toBe("na");
    expect(r.evidence.metrics?.["reason"]).toBe("brake_complete_baseline");
  });

  it("a clean taper below stand-up authority → pass", () => {
    const decel = (s: number): number =>
      s < 20 ? 3 : s <= 24 ? 3 - 0.6 * (s - 20) : 0; // tapers 3 → 0.6 → 0
    const r = one(taperRecord({ decel }), "trail_brake_taper");
    expect(r.verdict).toBe("pass");
  });

  it("leaned braking in (A_SU_ONSET, a_widen] → warn (ate the stand-up reserve)", () => {
    const decel = (s: number): number => (s < 20 ? 3.5 : s <= 24 ? 3.0 : 0);
    const r = one(taperRecord({ decel }), "trail_brake_taper");
    expect(r.verdict).toBe("warn");
  });

  it("braking beyond a_widen at lean → fail (forces stand-up)", () => {
    const decel = (s: number): number => (s < 20 ? 5 : s <= 24 ? 5 : 0);
    const r = one(taperRecord({ decel }), "trail_brake_taper");
    expect(r.verdict).toBe("fail");
  });

  it("brake re-deepening after its peak → fail", () => {
    const decel = (s: number): number => {
      if (s < 20) return 3;
      if (s <= 21) return 2;
      if (s <= 22) return 1;
      if (s <= 24) return 1.6; // re-deepen by 0.6 > REDEEPEN_TOL
      return 0;
    };
    const r = one(taperRecord({ decel, phiCross15: 27 }), "trail_brake_taper");
    expect(r.verdict).toBe("fail");
  });
});

describe("check 7 traction_ceiling", () => {
  it("within the ellipse → pass; beyond 1 + eps_mag → fail", () => {
    expect(one(book90Record({}), "traction_ceiling").verdict).toBe("pass");
    const rec = book90Record({
      sampleOver: (s) => (Math.abs(s - 25) < 0.25 ? { grip: -0.01 } : {})
    });
    expect(one(rec, "traction_ceiling").verdict).toBe("fail");
  });

  it("a crash event inside W_c → fail even with clean per-sample grip", () => {
    const rec = book90Record({});
    const events = [...rec.events, ev("crash", rec.samples, 30, "c1")];
    expect(one({ ...rec, events }, "traction_ceiling").verdict).toBe("fail");
  });
});

describe("check 8 lean_ceiling — three-band ladder + blind cap", () => {
  const flat = (phi: number) => (s: number) => ({
    phi: s < 20 ? 0 : phi,
    cmd_lean: s < 20 ? 0 : phi
  });

  it("within reserve → pass; ate the reserve → warn; beyond ceiling → fail", () => {
    expect(one(book90Record({ sampleOver: flat(38) }), "lean_ceiling").verdict).toBe("pass");
    expect(one(book90Record({ sampleOver: flat(43) }), "lean_ceiling").verdict).toBe("warn");
    expect(one(book90Record({ sampleOver: flat(46) }), "lean_ceiling").verdict).toBe("fail");
  });

  it("blind(c) caps the reserve at BLIND_RESERVE_DEG = 35°", () => {
    const rec = book90Record({
      sampleOver: (s) => ({ ...flat(38)(s), sight_m: 10 }) // 20 + 10 < 38.85 → blind
    });
    const r = one(rec, "lean_ceiling");
    expect(r.verdict).toBe("warn"); // 38 > capped 35, ≤ ceiling 45
    expect(r.evidence.metrics?.["reserve_deg"]).toBe(35);
  });
});

describe("check 9 exit_containment", () => {
  it("exit inside the corridor → pass; f ≥ 1 → fail", () => {
    const mk = (exitF: number): DoctrineRecord => {
      const rec = book90Record({ sampleOver: (s) => (s >= 38 ? { f: exitF } : {}) });
      const events = [...rec.events, ev("exit", rec.samples, 38.5, "c1")];
      return { ...rec, events };
    };
    expect(one(mk(0.8), "exit_containment").verdict).toBe("pass");
    expect(one(mk(1.05), "exit_containment").verdict).toBe("fail");
  });

  it("off_road termination before the exit sample → fail citing the crossing station", () => {
    const samples = series(10, 33, (s) => ({
      phi: s < 20 ? 0 : 25,
      cmd_lean: s < 20 ? 0 : 25,
      f: 1 + Math.max(0, (s - 25) * 0.05)
    }));
    const last = samples[samples.length - 1] as Sample;
    const rec: DoctrineRecord = {
      samples,
      events: [ev("turn_in", samples, 20, "c1")],
      terminated: { reason: "off_road", s: 33, t: last.t, x: last.x, y: last.y },
      corners: [mkCorner({ id: "c1" })],
      physics: PHYSICS
    };
    const r = one(rec, "exit_containment");
    expect(r.verdict).toBe("fail");
    expect(r.evidence.at_s).toBe(33);
  });
});

describe("check 10 stop_within_sight", () => {
  it("comfortable margin everywhere → pass", () => {
    expect(one(book90Record({}), "stop_within_sight").verdict).toBe("pass");
  });

  it("min margin under SIGHT_WARN_M → warn", () => {
    const rec = book90Record({ sampleOver: () => ({ sight_ride_m: 23 }) }); // ssd 20 → margin 3
    expect(one(rec, "stop_within_sight").verdict).toBe("warn");
  });

  it("stopping distance exceeds sight → fail citing the worst station", () => {
    // sight_m limited too: a real deficit comes from a BLOCKED cast (an
    // occluder), not from the road-end truncation — the open-end carve-out in
    // sightDeficit (WP-10 seam repair) keys on the cast reaching the road end
    const rec = book90Record({
      sampleOver: (s) => (Math.abs(s - 26) < 0.25 ? { ssd_m: 50, sight_ride_m: 40, sight_m: 10 } : {})
    });
    const r = one(rec, "stop_within_sight");
    expect(r.verdict).toBe("fail");
    expect(r.evidence.at_s).toBe(26);
  });

  it("vertically-blind scenario → na with the placard reason", () => {
    const rec = { ...book90Record({}), vertically_blind: true };
    const r = one(rec, "stop_within_sight");
    expect(r.verdict).toBe("na");
    expect(r.evidence.metrics?.["reason"]).toBe("vertical_sight_geometry_not_modelled");
  });
});

describe("check 11 hold_wide_for_sight", () => {
  function holdRecord(over: {
    holdF?: number;
    opensAt?: number | null; // station where sight starts opening; null = never
    turnInS?: number;
  }): DoctrineRecord {
    const turnInS = over.turnInS ?? 24;
    const opensAt = over.opensAt === undefined ? 22 : over.opensAt;
    const holdF = over.holdF ?? 0.9;
    const samples = series(5, 40, (s) => {
      // slope 2 m/m: opening (Δ > deadband over the 5 m window) while still
      // blind at the turn-in (24 + 12 < 38.85 = s_end)
      const sight = opensAt === null || s < opensAt ? 8 : 8 + 2 * (s - opensAt);
      const phi = s < turnInS ? 0 : 25;
      return {
        sight_m: sight,
        phi,
        cmd_lean: phi,
        f: s <= turnInS ? holdF : 1 - 0.8 * Math.exp(-((s - 30) ** 2) / 8)
      };
    });
    const rec = mkRecord(samples, [], [mkCorner({ id: "c1" })]);
    return { ...rec, events: [ev("turn_in", rec.samples, turnInS, "c1")] };
  }

  it("blind corner, held wide until release → pass", () => {
    expect(one(holdRecord({}), "hold_wide_for_sight").verdict).toBe("pass");
  });

  it("not blind at this line's turn-in → na (requires_blind applicability)", () => {
    const rec = book90Record({}); // sight_m 200 → not blind
    const r = one(rec, "hold_wide_for_sight");
    expect(r.verdict).toBe("na");
    expect(r.evidence.metrics?.["reason"]).toBe("not_blind");
  });

  it("committed while the sight line was still closing → fail", () => {
    const r = one(holdRecord({ opensAt: null }), "hold_wide_for_sight");
    expect(r.verdict).toBe("fail");
  });

  it("drifted in early → warn band just below HOLD_F_MIN", () => {
    expect(one(holdRecord({ holdF: 0.6 }), "hold_wide_for_sight").verdict).toBe("warn");
  });

  it("cut in while blind → fail", () => {
    expect(one(holdRecord({ holdF: 0.4 }), "hold_wide_for_sight").verdict).toBe("fail");
  });
});

describe("check 12 rideability", () => {
  it("a kinematically continuous record → pass", () => {
    expect(one(book90Record({ crossS: 26 }), "rideability").verdict).toBe("pass");
  });

  it("kappa teleport across a Δt→0 sample pair → fail (the adjudicated teleport regime)", () => {
    // Two retained samples at the SAME instant whose kappa disagrees by more
    // than KAPPA_STEP: a genuine kinematic teleport (record splice/corruption
    // — one integrator can never produce it).
    const base = book90Record({});
    const i = base.samples.findIndex((sm) => sm.s >= 25);
    const at = base.samples[i]!;
    const dup = { ...at, kappa: at.kappa + 0.02 };
    const rec = {
      ...base,
      samples: [...base.samples.slice(0, i + 1), dup, ...base.samples.slice(i + 1)]
    };
    const r = one(rec, "rideability");
    expect(r.verdict).toBe("fail");
    expect((r.evidence.metrics?.["max_dkappa"] as number)).toBeGreaterThan(0.01);
  });

  it("a full-rate profile flick at low speed steps kappa > KAPPA_STEP per 0.5 m grid sample yet passes — the guard reads Δt→0, not the grid (ADJUDICATED)", () => {
    // v = 7 m/s, street 50 °/s roll, kappa recorded honestly as g·tanφ/v²
    // (design/05 §2.1's derived column). Grid step Δκ ≈ 4.281·sec²φ/v³ ≈
    // 0.0125 > KAPPA_STEP = 0.01 — under the retired grid reading this
    // doctrinally-correct roll (check 4 MANDATES the full rate) failed check
    // 12 below ~27 km/h; the excess leg certifies it legitimate instead.
    const v = 7;
    const G = 9.81;
    const rampRate = 50; // deg/s — exactly the recorded roll_rate cap
    const crossS = 20 + (0.9 * 25.2 / rampRate) * v; // |phi| hits 0.9·phi_c at the profile rate
    const rec = book90Record({
      v,
      crossS,
      sampleOver: (s) => {
        const phi = s < 20 ? 0 : Math.min(25.2, (rampRate * (s - 20)) / v);
        return { phi, cmd_lean: Math.min(25.2, phi + 1), kappa: (G * Math.tan((phi * Math.PI) / 180)) / (v * v) };
      }
    });
    // the witness that this fixture exercises the retired failure mode:
    let gridStep = 0;
    for (let i = 0; i + 1 < rec.samples.length; i++) {
      gridStep = Math.max(gridStep, Math.abs(rec.samples[i + 1]!.kappa - rec.samples[i]!.kappa));
    }
    expect(gridStep).toBeGreaterThan(0.01);
    const r = one(rec, "rideability");
    expect(r.verdict).toBe("pass");
    expect(r.evidence.metrics?.["max_excess_dps"] as number).toBeLessThanOrEqual(2.0);
  });

  it("tracker overdrive fails — but the stand-up disturbance is subtracted first", () => {
    // phi jumps 10° in one 0.05 s step → 200 °/s >> roll_rate 50 + 2
    const raw = book90Record({
      sampleOver: (s) => ({ phi: s < 25 ? 0 : 10, cmd_lean: 0 })
    });
    expect(one(raw, "rideability").verdict).toBe("fail");
    // the same delivered motion, attributed to the recorded stand-up channel
    const compensated = book90Record({
      sampleOver: (s) => ({
        phi: s < 25 ? 0 : 10,
        cmd_lean: 0,
        su_sustained: Math.abs(s - 25) < 0.25 ? 200 : 0
      })
    });
    expect(one(compensated, "rideability").verdict).toBe("pass");
  });
});

// ---------------------------------------------------------------------------
// Chain fixtures (checks 13–15) — bookEsses-shaped two-corner record

function chainRecord(over: {
  entryF?: number;
  gapBrake?: boolean;
  gapWobble?: boolean;
  rhythmWobble?: boolean;
  escapeF?: boolean;
}): DoctrineRecord {
  const c1 = mkCorner({ id: "c1", hand: "R", s0: 20, s1: 34, linked_next: true });
  const c2 = mkCorner({ id: "c2", hand: "L", s0: 40, s1: 54 });
  const samples = series(10, 60, (s) => {
    // cmd_lean: quick roll to +20 in c1, one flick through the gap, −20 in c2
    let lean: number;
    if (s < 20) lean = 0;
    else if (s < 22) lean = 10 * (s - 20);
    else if (s <= 32) lean = 20;
    else if (s < 44) lean = 20 - (40 / 12) * (s - 32); // +20 → −20, zero at 38
    else if (s <= 52) lean = -20;
    else lean = Math.max(-20 + 10 * (s - 52), -20) > 0 ? 0 : -20 + 10 * (s - 52);
    if (over.rhythmWobble && s >= 28 && s < 29) lean = -5; // wobble inside c1
    if (over.gapWobble && s >= 34 && s <= 40) {
      lean = Math.abs(s - 35) < 0.25 || Math.abs(s - 37) < 0.25 ? 2 : 13;
    }
    // f: dip in each corner, controlled entry f at c2
    let f: number;
    if (s < 20) f = 0.9;
    else if (s <= 34) f = 1 - 0.8 * Math.exp(-((s - 27) ** 2) / 8);
    else if (s < 40) f = 0.6;
    else if (s <= 54) f = 1 - 0.8 * Math.exp(-((s - 47) ** 2) / 8);
    else f = 0.8;
    if (over.entryF !== undefined && Math.abs(s - 40) < 0.25) f = over.entryF;
    if (over.escapeF && Math.abs(s - 37) < 0.25) f = 1.1;
    const cmd_a = over.gapBrake && s >= 35 && s <= 37 ? -2 : 0;
    return { cmd_lean: lean, phi: lean, f, cmd_a };
  });
  const events = [
    ev("turn_in", samples, 20, "c1"),
    ev("turn_in", samples, 38, "c2"),
    ev("exit", samples, 54, "c2")
  ];
  return mkRecord(samples, events, [c1, c2]);
}

describe("checks 13–15 — the chain-aware set (one applicability rule)", () => {
  it("13: a flowing linked pair passes all three legs", () => {
    const r = one(chainRecord({}), "link_continuity");
    expect(r.verdict).toBe("pass");
    expect(r.pair).toEqual(["c1", "c2"]);
  });

  it("13: entering c2 from the inside half → fail (entry side leg)", () => {
    expect(one(chainRecord({ entryF: 0.3 }), "link_continuity").verdict).toBe("fail");
  });

  it("13: a brake reset on the gap fails link_continuity AND removes the chain exemptions", () => {
    const rec = chainRecord({ gapBrake: true });
    expect(one(rec, "link_continuity").verdict).toBe("fail");
    // the pair is geometric but no longer ridden-linked → no chain-mode corner
    expect(one(rec, "chain_containment").verdict).toBe("na");
    expect(one(rec, "chain_flow").verdict).toBe("na");
  });

  it("13: inter-corner fifty-pencing (≥ 2 extrema) → fail (one-flick leg)", () => {
    expect(one(chainRecord({ gapWobble: true }), "link_continuity").verdict).toBe("fail");
  });

  it("13–15 on a road with no linked pair → na ('no linked pair on road')", () => {
    const rec = book90Record({});
    expect(one(rec, "link_continuity").verdict).toBe("na");
    expect(one(rec, "chain_containment").verdict).toBe("na");
    expect(one(rec, "chain_flow").verdict).toBe("na");
  });

  it("14: the chain stays in the corridor → pass; an excursion past 1 + EPS_F → fail", () => {
    expect(one(chainRecord({}), "chain_containment").verdict).toBe("pass");
    const r = one(chainRecord({ escapeF: true }), "chain_containment");
    expect(r.verdict).toBe("fail");
    expect(r.evidence.metrics?.["worst_side"]).toBe("outside");
  });

  it("15: one rhythm through the sequence → pass; an extra wobble breaks it", () => {
    expect(one(chainRecord({}), "chain_flow").verdict).toBe("pass");
    const r = one(chainRecord({ rhythmWobble: true }), "chain_flow");
    expect(r.verdict).toBe("fail");
  });
});

describe("check 13 leg (c) — the one-flick tolerance per hand configuration (§A.3, parenthetical)", () => {
  // Two corners with a 6 m connecting span [34, 40]; the lean function shapes
  // the |cmd_lean| series over the span. f stays legal for the entry-side leg.
  function pairRecord(hand2: "L" | "R", lean: (s: number) => number): DoctrineRecord {
    const c1 = mkCorner({ id: "c1", hand: "R", s0: 20, s1: 34, linked_next: true });
    const c2 = mkCorner({ id: "c2", hand: hand2, s0: 40, s1: 54 });
    const samples = series(10, 60, (s) => {
      let f: number;
      if (s < 20) f = 0.9;
      else if (s <= 34) f = 1 - 0.8 * Math.exp(-((s - 27) ** 2) / 8);
      else if (s < 40) f = 0.6;
      else if (s <= 54) f = 1 - 0.8 * Math.exp(-((s - 47) ** 2) / 8);
      else f = 0.8;
      const l = lean(s);
      return { cmd_lean: l, phi: l, f, cmd_a: 0 };
    });
    const events = [
      ev("turn_in", samples, 20, "c1"),
      ev("turn_in", samples, 40, "c2"),
      ev("exit", samples, 54, "c2")
    ];
    return mkRecord(samples, events, [c1, c2]);
  }

  const ramp = (s: number): number => (s < 20 ? 0 : s < 22 ? 10 * (s - 20) : 20);

  it("same hand, lean held through the span (0 extrema) → pass", () => {
    const held = (s: number): number =>
      s <= 52 ? ramp(s) : Math.max(0, 20 - 10 * (s - 52));
    expect(one(pairRecord("R", held), "link_continuity").verdict).toBe("pass");
  });

  it("same hand, one prominent dip on the span → fail (same hand tolerates none)", () => {
    const dip = (s: number): number => {
      const base = s <= 52 ? ramp(s) : Math.max(0, 20 - 10 * (s - 52));
      if (s >= 35.5 && s <= 38.5) return base - 8 * Math.max(0, 1 - Math.abs(s - 37) / 1.5);
      return base;
    };
    const r = one(pairRecord("R", dip), "link_continuity");
    expect(r.verdict).toBe("fail");
    expect(r.evidence.metrics?.["extrema_count"]).toBe(1);
  });

  it("alternating hands, exactly the one flick minimum → pass (the tolerated shape)", () => {
    // chainRecord's default flick crosses zero inside the span — re-assert here
    // beside its discriminating siblings
    expect(one(chainRecord({}), "link_continuity").verdict).toBe("pass");
  });

  it("alternating hands, a lone MAXIMUM on the span → fail (an extra input is not a flick)", () => {
    const loneMax = (s: number): number => {
      if (s < 34) return ramp(s);
      if (s <= 37) return 13 + 2 * (s - 34); // rise to 19
      if (s <= 40) return 19 - 3 * (s - 37); // fall to 10 — one max, no min in-span
      if (s <= 44) return 10 - 7.5 * (s - 40); // the late flick, inside c2
      if (s <= 52) return -20;
      return Math.min(0, -20 + 10 * (s - 52));
    };
    const r = one(pairRecord("L", loneMax), "link_continuity");
    expect(r.verdict).toBe("fail");
    expect(r.evidence.metrics?.["extrema_count"]).toBe(1);
  });

  it("alternating hands, zero extrema (late flick) → pass — 'exactly one minimum' is a tolerance, not a mandate", () => {
    // DELIBERATE reading of the §A.3 check 13 parenthetical, flagged for design
    // ratification: a rider who flicks inside the next corner's window leaves a
    // monotone span series; the late entry is graded by the entry-side leg and
    // check 15's rhythm, never manufactured into a leg-(c) fail.
    const lateFlick = (s: number): number => {
      if (s < 34) return ramp(s);
      if (s <= 40) return 20 - 2.5 * (s - 34); // monotone 20 → 5 across the span
      if (s <= 44) return 5 - 6.25 * (s - 40); // flick inside c2
      if (s <= 52) return -20;
      return Math.min(0, -20 + 10 * (s - 52));
    };
    expect(one(pairRecord("L", lateFlick), "link_continuity").verdict).toBe("pass");
  });
});

describe("check 16 wrong_strategy_for_corner (the fig 8.4 check, sole critical)", () => {
  const dr = { type: "decreasing" as const, r1: 16, r2: 9 }; // ratio 1.78 ≥ 1.25
  const twoApexes = [
    { s: 26, pct: 30, f: 0.35 },
    { s: 34, pct: 75, f: 0.3 }
  ];

  it("not a DR corner → na with evidence not_a_dr_corner", () => {
    const r = one(book90Record({ apexes: twoApexes }), "wrong_strategy_for_corner");
    expect(r.verdict).toBe("na");
    expect(r.evidence.metrics?.["reason"]).toBe("not_a_dr_corner");
  });

  it("single apex on the DR corner → pass", () => {
    const r = one(
      book90Record({ apexes: [{ s: 33, pct: 70, f: 0.3 }], cornerOver: dr }),
      "wrong_strategy_for_corner"
    );
    expect(r.verdict).toBe("pass");
  });

  it("two measured apexes on the DR corner → fail (critical) with the full evidence block", () => {
    const r = one(
      book90Record({ apexes: twoApexes, cornerOver: dr, v: 12 }),
      "wrong_strategy_for_corner"
    );
    expect(r.verdict).toBe("fail");
    expect(r.evidence.metrics?.["apex_count"]).toBe(2);
    expect(r.evidence.metrics?.["blind_at_turn_in"]).toBe(false);
    expect(typeof r.evidence.metrics?.["book_note"]).toBe("string");
  });

  it("blind at commitment AND significantly slower → warn (the caption's sanction)", () => {
    // sqrt(g·tan(40.36°)·9) ≈ 8.66 m/s; ride at 8 with sight_m 10 (< remaining arc)
    const r = one(
      book90Record({
        apexes: twoApexes,
        cornerOver: dr,
        v: 8,
        sampleOver: () => ({ sight_m: 10 })
      }),
      "wrong_strategy_for_corner"
    );
    expect(r.verdict).toBe("warn");
    expect(r.evidence.metrics?.["blind_at_turn_in"]).toBe(true);
  });

  it("blind but NOT slower → still fail (both conjuncts required)", () => {
    const r = one(
      book90Record({
        apexes: twoApexes,
        cornerOver: dr,
        v: 12,
        sampleOver: () => ({ sight_m: 10 })
      }),
      "wrong_strategy_for_corner"
    );
    expect(r.verdict).toBe("fail");
  });

  it("consults its pack row's declared corner_trend — the applicability VALUE is data that binds", () => {
    const variantJson = cloneParks();
    const checks = variantJson["checks"] as Record<string, unknown>[];
    (checks[15] as Record<string, unknown>)["applicability"] = { corner_trend: ["increasing"] };
    const variant = loadRubricPack(variantJson);
    expect(variant.ok).toBe(true);
    if (!variant.ok) return;
    // same DR record that fails under the shipped binding…
    const record = book90Record({ apexes: twoApexes, cornerOver: dr, v: 12 });
    expect(one(record, "wrong_strategy_for_corner").verdict).toBe("fail");
    // …reads na once the variant pack re-binds the trend away from "decreasing"
    const rows = runChecks(record, variant.value).checks.filter(
      (c) => c.id === "wrong_strategy_for_corner"
    );
    expect(rows.length).toBe(1);
    expect((rows[0] as CheckResult).verdict).toBe("na");
    expect((rows[0] as CheckResult).evidence.metrics?.["reason"]).toBe("not_a_dr_corner");
  });
});

// ---------------------------------------------------------------------------
// §A.1 advisory severity law — pack DATA, so the law binds every loadable pack

describe("§A.1 advisory severity: worst verdict is warn; never blocks green", () => {
  // late_apex re-bound advisory in a legal variant pack; its before_bar band
  // still maps to fail — the runChecks clamp is what enforces the law.
  const variant = (() => {
    const json = cloneParks();
    const checks = json["checks"] as Record<string, unknown>[];
    (checks[0] as Record<string, unknown>)["severity"] = "advisory";
    const r = loadRubricPack(json);
    if (!r.ok) throw new Error(r.error.message);
    return r.value;
  })();
  const beforeBar = book90Record({ apexes: [{ s: 26, pct: 45, f: 0.2 }] });

  it("an advisory row's fail band clamps to warn at evaluation", () => {
    const shipped = runChecks(beforeBar, PACK).checks.filter((c) => c.id === "late_apex");
    expect((shipped[0] as CheckResult).verdict).toBe("fail"); // standard severity: fail stands
    const advisory = runChecks(beforeBar, variant).checks.filter((c) => c.id === "late_apex");
    expect((advisory[0] as CheckResult).verdict).toBe("warn"); // advisory: clamped
  });

  it("advisory can never block green: clean holds and quality stays good", () => {
    const block = runChecks(beforeBar, variant);
    expect(block.fail).toBe(0);
    expect(clean("contained", block)).toBe(true);
    expect(quality("contained", block, variant)).toBe("good");
  });
});

describe("na is first-class: a corner the line never reaches is refused, not asserted", () => {
  it("corner beyond termination reads na corner_not_reached on corner checks", () => {
    const samples = series(10, 18, () => ({}));
    const rec = mkRecord(samples, [], [mkCorner({ id: "c1" })]);
    const r = one(rec, "late_apex");
    expect(r.verdict).toBe("na");
    expect(r.evidence.metrics?.["reason"]).toBe("corner_not_reached");
  });
});

// ---------------------------------------------------------------------------
// P-QUALITY-TOTAL — the one colour law, total over the input lattice

describe("P-QUALITY-TOTAL (design/06 §5.1 ≡ design/05 §6.1)", () => {
  const OUTCOMES = ["crash", "runoff", "wide", "stopped", "contained"] as const;

  function mkBlock(rows: readonly { id: string; verdict: CheckResult["verdict"] }[]): DoctrineBlock {
    const checks: CheckResult[] = rows.map((r) => ({
      id: r.id,
      scope: "corner",
      corner_id: "c1",
      pair: null,
      verdict: r.verdict,
      evidence: { message: "synthetic" }
    }));
    return {
      pass: checks.filter((c) => c.verdict === "pass").length,
      fail: checks.filter((c) => c.verdict === "fail").length,
      warn: checks.filter((c) => c.verdict === "warn").length,
      na: checks.filter((c) => c.verdict === "na").length,
      checks
    };
  }

  const blocks: readonly { name: string; block: DoctrineBlock }[] = [
    { name: "empty", block: mkBlock([]) },
    { name: "all-pass", block: mkBlock([{ id: "late_apex", verdict: "pass" }]) },
    { name: "na-only", block: mkBlock([{ id: "hold_wide_for_sight", verdict: "na" }]) },
    { name: "warn-only", block: mkBlock([{ id: "lean_ceiling", verdict: "warn" }]) },
    { name: "standard-fail", block: mkBlock([{ id: "late_apex", verdict: "fail" }]) },
    {
      name: "critical-fail",
      block: mkBlock([{ id: "wrong_strategy_for_corner", verdict: "fail" }])
    },
    {
      name: "critical-warn",
      block: mkBlock([{ id: "wrong_strategy_for_corner", verdict: "warn" }])
    }
  ];

  it("is total: every (outcome × block) yields one of the three tokens", () => {
    for (const outcome of OUTCOMES) {
      for (const { block } of blocks) {
        expect(QUALITIES).toContain(quality(outcome, block, PACK));
      }
    }
  });

  it("failing iff outcome ∈ {crash, runoff, wide} or a critical check failed", () => {
    for (const outcome of ["crash", "runoff", "wide"] as const) {
      for (const { block } of blocks) {
        expect(quality(outcome, block, PACK)).toBe("failing");
      }
    }
    for (const outcome of ["stopped", "contained"] as const) {
      expect(
        quality(outcome, mkBlock([{ id: "wrong_strategy_for_corner", verdict: "fail" }]), PACK)
      ).toBe("failing");
    }
  });

  it("good iff clean: contained with zero applicable fails (na/warn never block green)", () => {
    for (const name of ["empty", "all-pass", "na-only", "warn-only"]) {
      const b = blocks.find((x) => x.name === name)?.block as DoctrineBlock;
      expect(quality("contained", b, PACK), name).toBe("good");
      expect(clean("contained", b)).toBe(true);
    }
  });

  it("caution: contained-with-fails, and every stopped run", () => {
    const standardFail = blocks.find((x) => x.name === "standard-fail")?.block as DoctrineBlock;
    expect(quality("contained", standardFail, PACK)).toBe("caution");
    expect(clean("contained", standardFail)).toBe(false);
    for (const name of ["empty", "all-pass", "standard-fail", "warn-only"]) {
      const b = blocks.find((x) => x.name === name)?.block as DoctrineBlock;
      expect(quality("stopped", b, PACK), name).toBe("caution");
    }
    // a critical WARN does not fail anything — advisory of the band, not red
    const cw = blocks.find((x) => x.name === "critical-warn")?.block as DoctrineBlock;
    expect(quality("contained", cw, PACK)).toBe("good");
  });
});

// ---------------------------------------------------------------------------
// P-OUTCOME-RUBRIC-FREE — outcome computable with checks stubbed out

describe("P-OUTCOME-RUBRIC-FREE", () => {
  it("import-level: no core/ file imports from plan/ (outcome physics precedes doctrine)", () => {
    const coreDir = join(linelabRoot, "src/core");
    for (const f of readdirSync(coreDir)) {
      if (!f.endsWith(".ts")) continue;
      const text = readFileSync(join(coreDir, f), "utf8");
      expect(/from\s+["'][^"']*\/plan\//.test(text), `core/${f} imports plan/`).toBe(false);
    }
  });

  it("import-level: doctrine imports nothing from solve/, render/, cli/, or the integrator", () => {
    const dir = join(linelabRoot, "src/plan/doctrine");
    for (const f of readdirSync(dir)) {
      if (!f.endsWith(".ts")) continue;
      const text = readFileSync(join(dir, f), "utf8");
      for (const banned of ["/solve/", "/render/", "/cli/", "core/integrate"]) {
        expect(text.includes(`${banned}`), `doctrine/${f} references ${banned}`).toBe(false);
      }
    }
  });

  it("functional: re-grading under a different pack changes doctrine only — the record (the outcome's input) is untouched", () => {
    const record = book90Record({ apexes: [{ s: 26, pct: 45, f: 0.2 }] });
    Object.freeze(record);
    Object.freeze(record.samples);
    Object.freeze(record.events);
    Object.freeze(record.corners);
    const before = JSON.stringify({ ...record, physics: undefined });

    const doctrineA = runChecks(record, PACK);

    // a variant pack with the late-apex bands re-mapped (data change, no code)
    const variantJson = cloneParks();
    const checks = variantJson["checks"] as Record<string, unknown>[];
    (checks[0] as Record<string, unknown>)["bands"] = {
      past_bar: "pass",
      before_bar: "warn"
    };
    const variant = loadRubricPack(variantJson);
    expect(variant.ok).toBe(true);
    if (!variant.ok) return;
    const doctrineB = runChecks(record, variant.value);

    expect(doctrineA.fail).toBeGreaterThan(doctrineB.fail); // grading changed
    expect(JSON.stringify({ ...record, physics: undefined })).toBe(before); // record identical
    // and a stubbed outcome composed with either block never consults samples:
    expect(clean("contained", doctrineA)).toBe(false);
    expect(clean("contained", doctrineB)).toBe(true);
  });

  it("grading is deterministic: same record, same pack → identical block", () => {
    const record = book90Record({});
    const a = runChecks(record, PACK);
    const b = runChecks(record, PACK);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// WP-17 section — engine-integrated exercise gates (design/09 §4), deferred by
// WP-06's header and hosted here after the fix/adjudication phases.
//
// The committed exercise corpus (test/fixtures/exercise/*.json) exists to
// close the coverage holes A-CATALOGUE-EXERCISED found over the blessed
// goldens (quick_steer / traction_ceiling / lean_ceiling / wrong_strategy
// never fail; hold_wide_for_sight has zero non-na instances; the chain trio is
// one-sided). Each fixture is a run() input of record; this file runs each
// through the FULL engine once and pins its graded truth, so the corpus cannot
// rot silently.
//
// Engine-truth notes (ratification items, returned by this package):
//   - fx-lean-crash also witnesses the D43 standing rung 0: its outcome IS
//     "crash" (not contained) — G-STANDING-BITES' rung-0 witness exists on
//     this engine at v0.2 promotion.
//   - hold_wide_for_sight's PASS band is engine-unattainable (typed it.todo
//     below, arithmetic in place).
//   - A-CHAIN-GREEN as designed (quality good) is engine-unattainable (typed
//     it.todo below); the adjudicated truth is pinned.
// ═══════════════════════════════════════════════════════════════════════════

const exerciseDir = join(linelabRoot, "test", "fixtures", "exercise");
const EXERCISE_IDS = [
  "fx-qs-slowsteer",
  "fx-lean-crash",
  "fx-esses-chain",
  "fx-chain-flow-broken",
  "fx-wrong-strategy-dr",
  "fx-holdless-blind"
] as const;

const exerciseCache = new Map<string, FigureResult>();
function exerciseEnv(id: (typeof EXERCISE_IDS)[number]): FigureResult {
  const hit = exerciseCache.get(id);
  if (hit !== undefined) return hit;
  const input: unknown = JSON.parse(readFileSync(join(exerciseDir, `${id}.json`), "utf8"));
  const r = run(input);
  if (!r.ok) throw new Error(`exercise fixture ${id} refused: ${JSON.stringify(r.error)}`);
  exerciseCache.set(id, r.value);
  return r.value;
}

function exerciseLine(id: (typeof EXERCISE_IDS)[number], lineId?: string): LineResult {
  const env = exerciseEnv(id);
  const lines = env.lines.filter((l): l is LineResult => !isLineRefusal(l));
  const line = lineId === undefined ? lines[0] : lines.find((l) => l.line_id === lineId);
  if (line === undefined) throw new Error(`exercise fixture ${id} has no line ${lineId ?? "[0]"}`);
  return line;
}

function checkRows(line: LineResult, id: string): readonly CheckResult[] {
  return line.verdict.doctrine.checks.filter((c) => c.id === id);
}

// ---------------------------------------------------------------------------
// Per-fixture engine-truth pins (each fail arm asserted where it lives)

describe("exercise corpus — per-fixture engine truth (design/09 §4)", () => {
  it("fx-qs-slowsteer: the book90 solved line grades contained/good; the slow_steer line FAILS quick_steer (the catalogue's quick_steer fail arm)", { timeout: 300_000 }, () => {
    const solved = exerciseLine("fx-qs-slowsteer", "solved");
    expect(solved.verdict.outcome).toBe("contained");
    expect(solved.verdict.quality).toBe("good");
    const ss = exerciseLine("fx-qs-slowsteer", "slow_steer");
    const qs = checkRows(ss, "quick_steer");
    expect(qs.some((c) => c.verdict === "fail")).toBe(true);
  });

  it("fx-lean-crash: mu 0.4 overspeed-lean line terminates crash; lean_ceiling FAILS beyond the ceiling; traction_ceiling FAILS on the in-window crash (the two ceiling fail arms + the D43 rung-0 witness)", { timeout: 300_000 }, () => {
    const line = exerciseLine("fx-lean-crash");
    expect(line.trajectory.terminated.reason).toBe("crash");
    expect(line.verdict.outcome).toBe("crash"); // standing rung 0's witness (v0.2)
    const lc = checkRows(line, "lean_ceiling")[0]!;
    expect(lc.verdict).toBe("fail");
    const phiMaxDeg = lc.evidence.metrics?.["phi_max_deg"] as number;
    const ceilingDeg = lc.evidence.metrics?.["ceiling_deg"] as number;
    expect(ceilingDeg).toBeCloseTo(radToDeg(phiMax(0.4)), 1);
    expect(phiMaxDeg).toBeGreaterThan(ceilingDeg);
    const tc = checkRows(line, "traction_ceiling")[0]!;
    expect(tc.verdict).toBe("fail");
    expect(tc.evidence.metrics?.["crash_in_window"]).toBe(true);
  });

  it("fx-chain-flow-broken: chain_flow FAILS (rhythm break) while link_continuity passes — the chain trio's missing fail side", { timeout: 300_000 }, () => {
    const line = exerciseLine("fx-chain-flow-broken");
    const flow = checkRows(line, "chain_flow")[0]!;
    expect(flow.verdict).toBe("fail");
    const changes = flow.evidence.metrics?.["rhythm_sign_changes"] as number;
    const alternations = flow.evidence.metrics?.["hand_alternations"] as number;
    expect(changes).not.toBe(alternations);
    expect(checkRows(line, "link_continuity").every((c) => c.verdict === "pass")).toBe(true);
    // the same ride escapes the corridor inside — chain_containment's fail arm
    expect(checkRows(line, "chain_containment")[0]!.verdict).toBe("fail");
  });

  it("fx-wrong-strategy-dr: double-apexing the decreasing-radius corner FAILS the sole critical check and forces quality failing", { timeout: 300_000 }, () => {
    const line = exerciseLine("fx-wrong-strategy-dr");
    const ws = checkRows(line, "wrong_strategy_for_corner")[0]!;
    expect(ws.verdict).toBe("fail");
    expect(ws.evidence.metrics?.["apex_count"]).toBe(2);
    // critical severity bites the colour law even on a contained line
    expect(line.verdict.outcome).toBe("contained");
    expect(line.verdict.quality).toBe("failing");
  });

  it("fx-holdless-blind: cutting in while bookBlind is still closing FAILS hold_wide_for_sight (the first non-na instance's fail arm)", { timeout: 300_000 }, () => {
    const line = exerciseLine("fx-holdless-blind");
    const hw = checkRows(line, "hold_wide_for_sight")[0]!;
    expect(hw.verdict).toBe("fail");
    expect(hw.evidence.metrics?.["turn_in_s"]).toBe(17);
  });
});

// ---------------------------------------------------------------------------
// A-CATALOGUE-EXERCISED (design/09 §4) — every one of the 16 ids has ≥ 1
// committed fixture where it fails and ≥ 1 where it passes, over the corpus =
// blessed goldens ∪ exercise fixtures.

describe("A-CATALOGUE-EXERCISED (design/09 §4)", () => {
  function corpusCoverage(): ReadonlyMap<string, { pass: number; fail: number }> {
    const cov = new Map<string, { pass: number; fail: number }>();
    for (const id of CHECK_IDS) cov.set(id, { pass: 0, fail: 0 });
    const count = (id: string, verdict: string): void => {
      const row = cov.get(id);
      if (row === undefined) return;
      if (verdict === "pass") row.pass++;
      if (verdict === "fail") row.fail++;
    };
    // committed golden check vectors (data of record, blessed)
    const goldensDir = join(linelabRoot, "test", "fixtures", "goldens");
    for (const f of readdirSync(goldensDir)) {
      if (!f.endsWith(".json")) continue;
      const rec = JSON.parse(readFileSync(join(goldensDir, f), "utf8")) as {
        lines: readonly { checks: readonly { id: string; verdict: string }[] }[];
      };
      for (const line of rec.lines) for (const c of line.checks) count(c.id, c.verdict);
    }
    // committed exercise fixtures, graded by the engine in this run
    for (const id of EXERCISE_IDS) {
      const env = exerciseEnv(id);
      for (const l of env.lines) {
        if (isLineRefusal(l)) continue;
        for (const c of (l as LineResult).verdict.doctrine.checks) count(c.id, c.verdict);
      }
    }
    return cov;
  }

  it("every check id has a committed FAIL witness, and every id except hold_wide_for_sight a committed PASS witness", { timeout: 600_000 }, () => {
    const cov = corpusCoverage();
    const missingPass: string[] = [];
    const missingFail: string[] = [];
    for (const id of CHECK_IDS) {
      const row = cov.get(id)!;
      if (row.pass === 0 && id !== "hold_wide_for_sight") missingPass.push(id);
      if (row.fail === 0) missingFail.push(id);
    }
    expect(missingPass, `check ids with no committed pass witness: ${missingPass.join(", ")}`).toEqual([]);
    expect(missingFail, `check ids with no committed fail witness: ${missingFail.join(", ")}`).toEqual([]);
    // hold_wide's FAIL side exists (fx-holdless-blind); its PASS side is the
    // typed todo below — pin the current truth so the todo cannot go stale
    expect(cov.get("hold_wide_for_sight")!.fail).toBeGreaterThan(0);
    expect(cov.get("hold_wide_for_sight")!.pass).toBe(0);
  });

  it.todo(
    "hold_wide_for_sight PASS witness — ENGINE-UNATTAINABLE, needs the A-VIS-HOLD-REACH seam (ratification): " +
      "held_wide requires min f ≥ HOLD_F_MIN = 0.7 over the hold window [ti − 0.75·L_c, ti] AND ti ≥ release − 2 m, " +
      "where release = first station with sight trend opening ∧ sight_ride_m ≥ ssd_m. Measured on this engine: " +
      "bookBlind wide lines (f ≥ 0.7) leave the carriageway un-turned at s ≈ 20.4–21.8 while the earliest release " +
      "any surviving line records is s ≈ 24.5 (inside line, 30 km/h) — the hold window cannot reach the release. " +
      "On authored two-hedge variants (R 12/R 20) the wide line's sight_m parallax is ~0.5 m per 5 m — under " +
      "SIGHT_TREND_DEADBAND_M = 2.0 the trend never reads opening, so release stays null. The vis=cautious governor " +
      "line (the design's own device for this discipline) itself grades committed_closing FAIL — the same OPEN seam " +
      "A-VIS-HOLD-REACH pins in design/09 §3.5."
  );
});

// ---------------------------------------------------------------------------
// A-CHAIN-GREEN (design/09 §4) — hosted at the adjudicated engine truth.

describe("A-CHAIN-GREEN (design/09 §4) — bookEsses chainedSolve, adjudicated engine truth", () => {
  it("the chain line is contained; the chain checks (13–15) pass under chain-mode applicability; the adjudicated fail set is exactly out_in_out@{c3,c4} → quality caution", { timeout: 300_000 }, () => {
    const line = exerciseLine("fx-esses-chain");
    expect(line.verdict.outcome).toBe("contained");
    // the chain trio passes — 13/14/15's engine-ridden PASS arms
    expect(checkRows(line, "link_continuity").map((c) => c.verdict)).toEqual(["pass", "pass", "pass"]);
    expect(checkRows(line, "chain_containment")[0]!.verdict).toBe("pass");
    expect(checkRows(line, "chain_flow")[0]!.verdict).toBe("pass");
    // adjudicated engine truth (WP-11's pinned fail set, post-adjudication:
    // rideability now PASSES; out_in_out still fails on c3/c4)
    const fails = line.verdict.doctrine.checks
      .filter((c) => c.verdict === "fail")
      .map((c) => `${c.id}@${c.corner_id ?? "-"}`)
      .sort();
    expect(fails).toEqual(["out_in_out@c3", "out_in_out@c4"]);
    expect(line.verdict.quality).toBe("caution");
  });

  it.todo(
    "A-CHAIN-GREEN as designed — ENGINE-UNATTAINABLE (ratification): the letter wants quality = good / colour green / " +
      "solve exit 0 on the bookEsses chain line. Adjudicated truth: out_in_out fails on c3 and c4 (the solved chain " +
      "cannot reach the outside third entering the back-to-back flicks at 32 km/h), so clean() is false and quality " +
      "is caution — the fig-08-06 bake exits 3 for the same reason. Needs either a 04 §5 chain-solver change or an " +
      "out_in_out chain-mode applicability amendment (design decision)."
  );
});

// ---------------------------------------------------------------------------
// A-DANGER-DWELL (design/09 §4), fail-fixture arm — the clean arm (C30 ≡ 0.0
// on every corner) rides test/golden/roster.test.ts. Here: the lean_ceiling-
// fail fixture pins corners[].danger_dwell_s to the bracketed-interpolated
// reserve-exceedance time, recomputed INDEPENDENTLY from the raw samples
// (arithmetic owned by design/01 Appendix A).

describe("A-DANGER-DWELL — the lean_ceiling-fail fixture's dwell (design/09 §4)", () => {
  it("corners[].danger_dwell_s > 0 and equals the independent bracketed-crossing recompute within ±0.01 s", { timeout: 300_000 }, () => {
    const line = exerciseLine("fx-lean-crash");
    const corner = line.verdict.corners.find((c) => c.id === "c1")!;
    expect(corner.danger_dwell_s).toBeGreaterThan(0);

    // independent recompute: W_c = [s(turn_in event), terminated.s] (no exit
    // exists on the crash line); exceedance e(sample) = |phi| − reserve at the
    // sample's own mu; both the window clip and the zero crossing interpolate
    // linearly between bracketing samples (01 Appendix A's rule).
    const skill = RIDER_PROFILES[line.resolved_scenario.rider.profile].skill;
    const turnIn = line.trajectory.events.find((e) => e.kind === "turn_in" && e.corner_id === "c1")!;
    const w0 = turnIn.s;
    const w1 = line.trajectory.terminated.s;
    const exceed = (p: Sample): number => Math.abs(degToRad(p.phi)) - phiReserve(muUse(skill, p.mu));
    let dwell = 0;
    const samples = line.trajectory.samples;
    for (let i = 0; i + 1 < samples.length; i++) {
      const a = samples[i]!;
      const b = samples[i + 1]!;
      const lo = Math.max(a.s, w0);
      const hi = Math.min(b.s, w1);
      const span = b.s - a.s;
      if (hi <= lo || span <= 0) continue;
      const aLo = (lo - a.s) / span;
      const aHi = (hi - a.s) / span;
      const eA = exceed(a);
      const eB = exceed(b);
      const eLo = eA + aLo * (eB - eA);
      const eHi = eA + aHi * (eB - eA);
      const tLo = a.t + aLo * (b.t - a.t);
      const tHi = a.t + aHi * (b.t - a.t);
      if (eLo > 0 && eHi > 0) dwell += tHi - tLo;
      else if (eLo > 0 || eHi > 0) {
        const cross = tLo + (eLo / (eLo - eHi)) * (tHi - tLo);
        dwell += eLo > 0 ? cross - tLo : tHi - cross;
      }
    }
    expect(dwell).toBeGreaterThan(0);
    expect(Math.abs(corner.danger_dwell_s - dwell)).toBeLessThanOrEqual(0.01);
  });
});

// ---------------------------------------------------------------------------
// A-RUBRIC-STAMP (design/09 §4) — three arms: the stamp is present (and inside
// result_hash by construction); recomputing under the SAME pack reproduces the
// graded values and the hash; recomputing under a pack whose perturbed grading
// threshold is decisive moves the GRADE (doctrine + quality), not merely the
// hash — the vacuity the third arm exists to close.

describe("A-RUBRIC-STAMP (design/09 §4)", () => {
  it("every exercise line's sealed verdict carries the rubric stamp parks-street/2 and checks_version 2", { timeout: 600_000 }, () => {
    for (const id of EXERCISE_IDS) {
      for (const l of exerciseEnv(id).lines) {
        if (isLineRefusal(l)) continue;
        const v = (l as LineResult).verdict;
        expect(v.rubric, id).toBe("parks-street/2");
        expect(v.checks_version, id).toBe(2);
        expect(v.result_hash, id).toMatch(/^[0-9a-f]{6}$/);
      }
    }
  });

  it("recompute under the SAME pack reproduces result_hash (fresh engine run, byte-equal verdict identity)", { timeout: 300_000 }, () => {
    const first = exerciseLine("fx-lean-crash");
    const input: unknown = JSON.parse(readFileSync(join(exerciseDir, "fx-lean-crash.json"), "utf8"));
    const again = run(input); // NOT the memo — a genuinely fresh recompute
    expect(again.ok).toBe(true);
    if (!again.ok) return;
    const line = again.value.lines.find((l): l is LineResult => !isLineRefusal(l))!;
    expect(line.verdict.result_hash).toBe(first.verdict.result_hash);
    expect(line.verdict.rubric).toBe(first.verdict.rubric);
  });

  it("recompute under a perturbed pack whose threshold is decisive flips the GRADE (late_apex pass→fail, quality good→caution) and moves the rubric stamp", { timeout: 300_000 }, () => {
    const env = exerciseEnv("fx-qs-slowsteer");
    const line = exerciseLine("fx-qs-slowsteer", "solved");
    expect(line.verdict.quality).toBe("good");

    // Rebuild the engine's own DoctrineRecord seam from the ridden line (the
    // same construction solve/solve.ts executeLine uses), then regrade.
    const road = env.road;
    const corners: DoctrineCorner[] = road.corners.map((c) => {
      const row = line.verdict.corners.find((r) => r.id === c.id);
      return {
        id: c.id,
        hand: c.hand,
        s0: c.s0,
        s1: c.s1,
        type: c.type,
        ...(c.r1 !== undefined ? { r1: c.r1 } : {}),
        ...(c.r2 !== undefined ? { r2: c.r2 } : {}),
        linked_next: c.linked_next,
        apexes: (row?.apexes ?? []).map((a) => ({ s: a.s, pct: a.pct, f: a.f }))
      };
    });
    const mu = line.resolved_scenario.config.mu;
    const profile = RIDER_PROFILES[line.resolved_scenario.rider.profile];
    const rollRateRad = degToRad(profile.roll_rate_dps);
    const stations = deriveStations(road, 0);
    if (!stations.ok) throw new Error("deriveStations refused on book90");
    const record: DoctrineRecord = {
      samples: line.trajectory.samples,
      events: line.trajectory.events,
      terminated: line.trajectory.terminated,
      corners,
      declared_style: "single",
      physics: {
        phi_reserve_deg: radToDeg(phiReserve(muUse(profile.skill, mu))),
        phi_max_deg: radToDeg(phiMax(mu)),
        a_widen_ms2: (phiDeg, vMs) => aWiden(degToRad(phiDeg), vMs, 1, rollRateRad),
        brake_gap_m: stations.value.brake_gap_m
      }
    };

    // arm 2 (grade half): the SAME pack reproduces the graded values verbatim
    const samePack = runChecks(record, PACK);
    expect(samePack.checks.map((c) => ({ id: c.id, corner_id: c.corner_id, verdict: c.verdict }))).toEqual(
      line.verdict.doctrine.checks.map((c) => ({ id: c.id, corner_id: c.corner_id, verdict: c.verdict }))
    );
    expect(quality(line.verdict.outcome, samePack, PACK)).toBe(line.verdict.quality);

    // arm 3: perturb the decisive threshold (late_apex constant-corner bar 50
    // → 80; the solved line's measured apex_pct ≈ 66) in a legal variant pack
    // with its own identity — the GRADE moves, and so does the stamp.
    const variantJson = cloneParks();
    variantJson["name"] = "parks-street-perturbed";
    const checks = variantJson["checks"] as Record<string, unknown>[];
    const th = (checks[0] as Record<string, unknown>)["thresholds"] as Record<string, { value: number }>;
    (th["APEX_PCT_BAR_CONSTANT"] as { value: number }).value = 80;
    const variantR = loadRubricPack(variantJson);
    expect(variantR.ok).toBe(true);
    if (!variantR.ok) return;
    const variant = variantR.value;

    const regraded = runChecks(record, variant);
    const la = regraded.checks.find((c) => c.id === "late_apex")!;
    expect(la.verdict).toBe("fail"); // the grade itself moved …
    expect(regraded.fail).toBe(samePack.fail + 1);
    expect(quality(line.verdict.outcome, regraded, variant)).toBe("caution"); // … and the colour with it
    expect(clean(line.verdict.outcome, regraded)).toBe(false);
    // the rubric stamp moves (and rides INSIDE result_hash, 05 §8.3 — two
    // distinct packs can never collide silently)
    expect(rubricString(variant)).toBe("parks-street-perturbed/2");
    expect(rubricString(variant)).not.toBe(line.verdict.rubric);
  });
});
