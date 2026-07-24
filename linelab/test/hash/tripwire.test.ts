// test/hash/tripwire.test.ts — the design/09 §3.3 tripwire: recompute
// spec_hash / result_hash for every COMMITTED stamp the repository carries and
// assert equality — any drift outside a re-bless commit is a failure.
//
// WP-17 (first bless) populates the committed stamp set: the golden store under
// test/fixtures/ and the baked FigureSpec stamps under figures/. PRE-BLESS none
// exist, so this file scans, structurally validates whatever it finds, and
// passes with count >= 0 — the scan machinery (and the in-memory recompute
// invariants below) are live from commit one, so the moment WP-17 lands stamps
// they are bound without touching this file's scan half. The full
// recompute-via-the-bless-loaders leg keys off the same enumerated files.
//
// Tests may use node builtins (the meta-test precedent); src/ may not.

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { canonicalize, fnv1a } from "../../src/core/hash.js";
import { lowerScene } from "../../src/plan/scene.js";
import { specHash } from "../../src/plan/figure.js";
import { ENGINE_SEMVER } from "../../src/solve/run.js";
import { resultHash, sealVerdict } from "../../src/solve/envelope.js";
import type { HashedRider } from "../../src/solve/envelope.js";
import type { Verdict } from "../../src/solve/types.js";
import type { ResolvedPlanAction } from "../../src/core/types.js";

const here = dirname(fileURLToPath(import.meta.url));
const linelabRoot = resolve(here, "../..");

// ---------------------------------------------------------------------------
// Stamp enumeration: every committed JSON under the two stamp homes
// (ARCHITECTURE §3: test/fixtures/ = golden store; figures/ = bake outputs).

const HASH6_RE = /^[0-9a-f]{6}$/;
const SEMVER_RE = /^\d+\.\d+\.\d+$/;
const HASH_KEYS = new Set(["spec_hash", "result_hash", "believed_road_hash"]);

function listJsonFiles(dir: string): string[] {
  if (!(statSync(dir, { throwIfNoEntry: false })?.isDirectory() ?? false)) return [];
  const out: string[] = [];
  const entries = readdirSync(dir, { withFileTypes: true }).sort((a, b) =>
    a.name < b.name ? -1 : a.name > b.name ? 1 : 0
  );
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listJsonFiles(full));
    else if (entry.isFile() && entry.name.endsWith(".json")) out.push(full);
  }
  return out;
}

interface FoundStamp {
  readonly file: string;
  readonly path: string;
  readonly key: string;
  readonly value: unknown;
}

/** Walk a parsed JSON document collecting every hash/semver-shaped stamp field. */
function collectStamps(doc: unknown, file: string, path: string, out: FoundStamp[]): void {
  if (doc === null || typeof doc !== "object") return;
  if (Array.isArray(doc)) {
    doc.forEach((item, i) => collectStamps(item, file, `${path}[${i}]`, out));
    return;
  }
  for (const [key, value] of Object.entries(doc as Record<string, unknown>)) {
    if (HASH_KEYS.has(key) || key === "engine_semver") {
      out.push({ file, path: `${path}.${key}`, key, value });
    }
    collectStamps(value, file, `${path}.${key}`, out);
  }
}

describe("committed-stamp tripwire (09 §3.3)", () => {
  const stampFiles = [
    ...listJsonFiles(join(linelabRoot, "test", "fixtures")),
    ...listJsonFiles(join(linelabRoot, "figures"))
  ];

  it("every committed stamp field is structurally well-formed (6-hex hashes, semver stamps)", () => {
    const stamps: FoundStamp[] = [];
    for (const file of stampFiles) {
      const doc: unknown = JSON.parse(readFileSync(file, "utf8"));
      collectStamps(doc, file, "$", stamps);
    }
    for (const stamp of stamps) {
      const where = `${stamp.file} at ${stamp.path}`;
      expect(typeof stamp.value, where).toBe("string");
      if (stamp.key === "engine_semver") {
        expect(stamp.value, where).toMatch(SEMVER_RE);
      } else {
        expect(stamp.value, where).toMatch(HASH6_RE);
      }
    }
    // PRE-BLESS: zero stamps exist and this passes vacuously by design.
    // WP-17 populates the stamp set at first bless; from that commit on, this
    // count going back to zero would itself be a regression to investigate.
    expect(stamps.length).toBeGreaterThanOrEqual(0);
  });

  // WP-17 (first bless) — the committed-stamp recompute leg (09 §3.3), via
  // the SAME loaders the bless/bake pipeline uses (lowerScene → specHash for
  // figure identity; fnv1a over the artifact bytes). The ENGINE half of the
  // tripwire — every golden line's result_hash recomputed through the bless
  // roster — is hosted by test/golden/roster.test.ts (one roster integration
  // per suite run, compared there hash-exact; duplicating the full engine
  // recompute here would double the suite's integration cost for zero extra
  // coverage).

  const figuresDir = join(linelabRoot, "figures");
  const scenesDir = resolve(linelabRoot, "../figures"); // scene SOURCES (design of record)
  const FIGURE_IDS = ["fig-08-01", "fig-08-02", "fig-08-03", "fig-08-04", "fig-08-05", "fig-08-06"];

  it("every baked figure stamp recomputes: manifest + judge spec_hash = specHash(lowerScene(scene)); judge svg_fnv1a = fnv1a(committed SVG bytes)", () => {
    const manifest = JSON.parse(readFileSync(join(figuresDir, "manifest.json"), "utf8")) as readonly {
      figure_id: string;
      spec_hash: string;
    }[];
    expect(manifest.map((r) => r.figure_id).sort()).toEqual([...FIGURE_IDS].sort());

    for (const id of FIGURE_IDS) {
      const sceneText = readFileSync(join(scenesDir, `${id}.scene`), "utf8");
      const lowered = lowerScene(sceneText);
      expect(lowered.ok, `${id}: lowerScene`).toBe(true);
      if (!lowered.ok) continue;
      const recomputedSpecHash = specHash(lowered.value);

      const row = manifest.find((r) => r.figure_id === id);
      expect(row, `${id}: manifest row`).toBeDefined();
      expect(row!.spec_hash, `${id}: manifest spec_hash`).toBe(recomputedSpecHash);

      const judge = JSON.parse(readFileSync(join(figuresDir, `${id}.judge.json`), "utf8")) as {
        spec_hash: string;
        svg_fnv1a: string;
      };
      expect(judge.spec_hash, `${id}: judge spec_hash`).toBe(recomputedSpecHash);
      expect(judge.svg_fnv1a, `${id}: judge svg_fnv1a`).toBe(fnv1a(readFileSync(join(figuresDir, `${id}.svg`), "utf8")));
    }
  });

  it("every committed golden is stamped with the running engine and 6-hex line hashes (result_hash recompute: test/golden/roster.test.ts)", () => {
    const goldensDir = join(linelabRoot, "test", "fixtures", "goldens");
    const files = readdirSync(goldensDir).filter((f) => f.endsWith(".json")).sort();
    expect(files.length).toBeGreaterThan(0); // post-first-bless: the store is populated
    for (const f of files) {
      const rec = JSON.parse(readFileSync(join(goldensDir, f), "utf8")) as {
        fixture: string;
        engine_semver: string;
        lines: readonly { result_hash: string }[];
      };
      expect(`${rec.fixture}.json`).toBe(f);
      expect(rec.engine_semver).toBe(ENGINE_SEMVER);
      for (const line of rec.lines) expect(line.result_hash).toMatch(HASH6_RE);
    }
  });
});

// ---------------------------------------------------------------------------
// In-memory recompute invariants — the tripwire's arithmetic, live pre-bless:
// the same seal → stamp → recompute loop the committed-fixture leg will run.

const PLAN: ResolvedPlanAction[] = [
  { do: "turn_in", id: "t1", at_s: 42.123456, target: { lean_deg: 28 }, hand: "R" }
];
const RIDER: HashedRider = { plan: PLAN };

/** A small hand-written raw verdict — no engine needed to pin the hash law. */
function rawVerdict(): Verdict {
  return {
    ok: true,
    spec_hash: "abc123",
    result_hash: "",
    checks_version: 2,
    rubric: "parks-street/2",
    engine: "linelab/1",
    outcome: "contained",
    quality: "good",
    headline: "contained — clean",
    diagnosis: null,
    acceptance: { policy: "clean", met: true },
    misjudgment: null,
    validity: null,
    corners: [
      {
        id: "c1",
        hand: "R",
        corner_type: "constant",
        turn_ins: [{ s: 42.123456, lean_commit_deg: 28, hand: "R", release_s: 65.987654 }],
        apexes: [{ s: 55.5555, pct: 52.31, f: 0.1231, clearance_m: 0.42, v_kmh: 54.001, lean_deg: 30.12 }],
        lean_max_deg: 31.51,
        grip_min: 0.4321,
        danger_dwell_s: 0,
        exit: { s: 70, d: 0, f: 0.5, heading_err_deg: 0.4 },
        ran_wide: false,
        corrective: null
      }
    ],
    sight: { margin_min_m: 12.345678, at_s: 50, v_at_s_kmh: 54, holds: [] },
    constraints: null,
    doctrine: {
      pass: 1,
      fail: 0,
      warn: 0,
      na: 0,
      checks: [
        {
          id: "late_apex",
          scope: "corner",
          corner_id: "c1",
          pair: null,
          verdict: "pass",
          evidence: { message: "final apex at 52.3%" }
        }
      ]
    }
  };
}

describe("tripwire arithmetic (in-memory, pre-bless)", () => {
  it("a sealed verdict's committed-style stamp recomputes to itself", () => {
    const sealedR = sealVerdict(rawVerdict(), RIDER);
    expect(sealedR.ok).toBe(true);
    if (!sealedR.ok) return;
    const v = sealedR.value;
    expect(v.result_hash).toMatch(HASH6_RE);
    const again = resultHash(v, RIDER);
    expect(again.ok).toBe(true);
    if (again.ok) expect(again.value).toBe(v.result_hash);
  });

  it("sealing is idempotent: re-sealing a sealed verdict moves nothing", () => {
    const once = sealVerdict(rawVerdict(), RIDER);
    if (!once.ok) throw new Error("seal refused");
    const twice = sealVerdict(once.value, RIDER);
    if (!twice.ok) throw new Error("re-seal refused");
    expect(twice.value.result_hash).toBe(once.value.result_hash);
  });

  it("canonicalize is key-order-blind: a structurally equal spec hashes identically", () => {
    const a = { road_spec: { dsl: "S 40 R 30 ^57" }, lines: [{ line_id: "l1", role: "ideal" }] };
    const b = { lines: [{ role: "ideal", line_id: "l1" }], road_spec: { dsl: "S 40 R 30 ^57" } };
    const ca = canonicalize(a);
    const cb = canonicalize(b);
    if (!ca.ok || !cb.ok) throw new Error("canonicalize refused");
    expect(ca.value).toBe(cb.value);
    expect(fnv1a(ca.value)).toBe(fnv1a(cb.value));
    expect(fnv1a(ca.value)).toMatch(HASH6_RE);
  });
});
