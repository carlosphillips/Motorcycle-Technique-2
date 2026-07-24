// test/contract/standing.test.ts — the D43 standing ladder (v0.2 inspection).
// Gates hosted here (design/09 §4 "the standing leg" + §10's v0.2 row):
//   G-STANDING-BITES            every rung witnessed by a committed fixture,
//                               asserted as set-equality over the corpus
//   G-STANDING-NO-HASH-MOVE     standing computed on EVERY golden-roster
//                               fixture moves zero envelope bytes and zero
//                               result_hash vs the committed blessed store
//   A-STANDING-LADDER-CUMULATIVE  table-driven synthesised product; the rung
//                               is the greatest satisfied threshold and no
//                               rung is attainable with a lower one violated
//   A-STANDING-RESERVED         F-ORACLE-90's good line grades "reserved";
//                               annex lookup only — ZERO integrate calls
//   A-STANDING-REFUSAL          a NO_SOLUTION envelope entry → standing null,
//                               refused true — never a rung, never a throw
//   A-RESERVE-CHECKS-RESOLVE    the committed annex resolves; the four §A.6.1
//                               typed rejections, asserted code AND reason
//   A-STANDING-TOMBSTONE        struck names reject UNKNOWN_ID on typed
//                               reasons; successors named (or not) per D43
//   A-LADDER-PROSE              every shipped printing surface carries pack
//                               id, checks_version, the rung-token gloss, and
//                               the 05 §6.4 placard verbatim
//   A-STANDING-WARN-BAND        typed it.todo — see SEAM-STANDING-WARN
//
// ═══════════════════════════════════════════════════════════════════════════
// SEAM-STANDING-WARN (OPEN — engine-truth finding, reported under the oracle's
// iron rule, design/09 §4: never an edited expectation).
// The design pin (09 §4 "F-STANDING-WARN"): preset book90, street, mu 1.0,
// DEFAULT solve, entry ∈ [36, 44] km/h grades contained ∧ clean(line) ∧
// lean_ceiling "warn" → standing "clean" (rung 3), blocked_by
// [{lean_ceiling, warn}]. On THIS engine that intersection is EMPTY over the
// whole calibration band, probed at 35, 35.5, 36, 36.5, 37, 38, 40, 42, 44:
//   · accept=clean refuses NO_SOLUTION across the band (36: non_clean_band —
//     the lone contained candidate carries 1 fail; 37–44: empty_band).
//   · accept=best_failing shows why: the best candidates grade contained with
//     an out_in_out FAIL from 35 km/h up (35: phi_max 33.17°, 36: 36.47°,
//     37: 36.77°), then containment itself breaks (38: wide at phi_max
//     39.17°; 40+: runoff) — all with lean_ceiling still PASS, i.e. below
//     the 40.36° reserve (phiReserve(0.85·1.0) = atan(0.85)).
//   · The clean band on book90's default solve therefore tops out below
//     35 km/h at phi_max ≈ 33°, ~7° under the warn floor: the design's
//     36.01 km/h floor arithmetic is sound, but clean(line) dies (out_in_out,
//     then containment) before the reserve is ever eaten.
// The design prices exactly this outcome: "If no entry in the band yields
// contained ∧ warn, that is an engine or doctrine finding reported under the
// oracle's iron rule — never an edited expectation" (09 §4). So:
//   · A-STANDING-WARN-BAND as designed is a typed it.todo below;
//   · the committed fixture test/fixtures/standing/fx-standing-warn.json
//     (road book90, entry 38 = F_STANDING_WARN_ENTRY_KMH) is pinned to its
//     EMERGENT truth — NO_SOLUTION/empty_band — so any engine drift re-opens
//     this seam mechanically;
//   · G-STANDING-BITES' rung-3 witness is discharged by the na-cap arm
//     instead (committed fixture fx-standing-straight.json: a clean
//     straight-road line whose zero-corner record gives lean_ceiling ZERO
//     instances → verdict "na" → reserved unattainable → rung 3 exactly as
//     05 §6.4's cap law demands). DEVIATION from the 09 §10 witness map,
//     recorded here and in this package's return; the designed witness lands
//     when the seam is ratified/resolved.
// ═══════════════════════════════════════════════════════════════════════════

import { describe, expect, it, vi } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// A-STANDING-RESERVED's "zero engine runs" arm: every integrate() call in
// this file rides a counting wrapper (behaviour unchanged — it delegates).
const integrateCalls = vi.hoisted(() => ({ n: 0 }));
vi.mock("../../src/core/integrate.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../src/core/integrate.js")>();
  const counted: typeof actual.integrate = (...args) => {
    integrateCalls.n += 1;
    return actual.integrate(...args);
  };
  return { ...actual, integrate: counted };
});

import {
  standing,
  standingAttachment,
  standingPlacard,
  STANDING_GLOSS,
  STANDING_RUNGS,
  type StandingReport
} from "../../src/solve/standing.js";
import {
  loadRubricPack,
  loadShippedRubricPack,
  resolveCheckId,
  rubricString
} from "../../src/plan/doctrine/pack.js";
import { clean, quality } from "../../src/plan/doctrine/quality.js";
import parksStreetRaw from "../../src/plan/doctrine/packs/parks-street.json" with { type: "json" };
import { lowerScene } from "../../src/plan/scene.js";
import { renderViews } from "../../src/render/index.js";
import type { CheckResult, CheckVerdict, RubricPack } from "../../src/plan/doctrine/types.js";
import { chainedSolve } from "../../src/solve/chained.js";
import { compileMistake } from "../../src/solve/mistake.js";
import { run } from "../../src/solve/run.js";
import { isLineRefusal } from "../../src/solve/envelope.js";
import type { LineEntry, LineRefusal, LineResult } from "../../src/solve/types.js";
import type { Outcome } from "../../src/core/types.js";
import type { LinelabError } from "../../src/core/result.js";
import { checkVerb } from "../../src/cli/verbs/check.js";
import { explain } from "../../src/cli/doc/explain.js";
import { BLESS_ROSTER } from "../../src/cli/bless.js";

const here = dirname(fileURLToPath(import.meta.url));
const linelabRoot = resolve(here, "../..");
const standingFixturesDir = join(linelabRoot, "test", "fixtures", "standing");
const goldensDir = join(linelabRoot, "test", "fixtures", "goldens");
const scenesDir = resolve(linelabRoot, "../figures");

function loadJson(path: string): unknown {
  return JSON.parse(readFileSync(path, "utf8"));
}

// ---------------------------------------------------------------------------
// Memoized corpus lines (engine work happens once per line, whatever order
// vitest runs the blocks in)

const memo = new Map<string, unknown>();
function once<T>(key: string, fn: () => T): T {
  if (!memo.has(key)) memo.set(key, fn());
  return memo.get(key) as T;
}

const F90 = { road: "book90", entry_kmh: 34 };

function base90(): LineResult {
  return once("base90", () => {
    const r = chainedSolve(F90 as never);
    if (!r.ok) throw new Error(`F-ORACLE-90 refused: ${JSON.stringify(r.error)}`);
    return r.value;
  });
}

function mistakeLine(kind: "premature" | "premature_contained"): LineResult {
  return once(`mistake:${kind}`, () => {
    const r = compileMistake(kind, undefined, { base: base90(), spec: F90 as never });
    if (!r.ok) throw new Error(`${kind} refused: ${JSON.stringify(r.error)}`);
    return r.value.line;
  });
}

function runFixtureLine(path: string, key: string): LineResult {
  return once(`run:${key}`, () => {
    const r = run(loadJson(path));
    if (!r.ok) throw new Error(`${key} refused: ${JSON.stringify(r.error)}`);
    const line = r.value.lines.find((l) => !isLineRefusal(l));
    if (line === undefined) throw new Error(`${key}: no non-refused line`);
    return line as LineResult;
  });
}

function crashLine(): LineResult {
  return runFixtureLine(join(linelabRoot, "test", "fixtures", "exercise", "fx-lean-crash.json"), "fx-lean-crash");
}

function straightLine(): LineResult {
  return runFixtureLine(join(standingFixturesDir, "fx-standing-straight.json"), "fx-standing-straight");
}

function shippedPack(): RubricPack {
  return once("pack", () => {
    const r = loadShippedRubricPack("parks-street");
    if (!r.ok) throw new Error("shipped pack failed to load");
    return r.value;
  });
}

function gradeOf(entry: LineEntry): StandingReport {
  const r = standing(entry);
  expect(r.ok, r.ok ? undefined : JSON.stringify((r as { error: LinelabError }).error)).toBe(true);
  return (r as { ok: true; value: StandingReport }).value;
}

function errOf(r: { ok: boolean }): LinelabError {
  expect(r.ok).toBe(false);
  return (r as { ok: false; error: LinelabError }).error;
}

const PLACARD = standingPlacard("parks-street/2", 2);

// ---------------------------------------------------------------------------
// A-STANDING-RESERVED — the top rung, at zero engine runs

describe("A-STANDING-RESERVED (design/09 §4)", () => {
  it("F-ORACLE-90's good line grades reserved: both reserve rows pass, reserved_blocked_by []", { timeout: 300_000 }, () => {
    const report = gradeOf(base90());
    expect(report.standing).toBe("reserved");
    expect(report.rung).toBe(4);
    expect(report.refused).toBe(false);
    expect(report.reserve.map((r) => ({ id: r.id, verdict: r.verdict }))).toEqual([
      { id: "lean_ceiling", verdict: "pass" },
      { id: "stop_within_sight", verdict: "pass" }
    ]);
    for (const row of report.reserve) expect(row.instances).toBeGreaterThan(0);
    expect(report.reserved_blocked_by).toEqual([]);
  });

  it("standing is an annex LOOKUP: zero integrate calls (05 §6.4 'Cost')", { timeout: 300_000 }, () => {
    const line = base90(); // engine work (if any) happens HERE, before the snapshot
    const before = integrateCalls.n;
    for (let i = 0; i < 3; i++) gradeOf(line);
    expect(integrateCalls.n - before).toBe(0);
  });

  it("every emission carries its provenance stamps + the placard (P-STANDING-STAMPED's shape, D43)", { timeout: 300_000 }, () => {
    const report = gradeOf(base90());
    expect(report.kind).toBe("standing");
    expect(report.rubric).toBe("parks-street/2");
    expect(report.checks_version).toBe(2);
    expect(report.reserve_checks).toEqual([...shippedPack().annex.reserve_checks]);
    expect(report.placard).toBe(PLACARD);
  });

  it("standing is pure and deterministic: the same line twice yields byte-identical reports", { timeout: 300_000 }, () => {
    const a = JSON.stringify(gradeOf(base90()));
    const b = JSON.stringify(gradeOf(base90()));
    expect(a).toBe(b);
  });
});

// ---------------------------------------------------------------------------
// G-STANDING-BITES — every rung witnessed by a committed fixture, as a
// set-equality over the declared witness corpus (see SEAM-STANDING-WARN for
// the rung-3 deviation).

describe("G-STANDING-BITES (design/09 §10)", () => {
  it("the witness corpus attains exactly the rung set {0,1,2,3,4}", { timeout: 600_000 }, () => {
    const witnesses: readonly { rung: number; token: string; line: LineResult }[] = [
      { rung: 4, token: "reserved", line: base90() }, // F-ORACLE-90 good line
      { rung: 3, token: "clean", line: straightLine() }, // na-cap witness (SEAM-STANDING-WARN)
      { rung: 2, token: "caution", line: mistakeLine("premature_contained") },
      { rung: 1, token: "failing", line: mistakeLine("premature") },
      { rung: 0, token: "crash", line: crashLine() }
    ];
    const attained = new Set<number>();
    for (const w of witnesses) {
      const report = gradeOf(w.line);
      expect(report.rung, `witness for rung ${w.rung} (${w.line.line_id})`).toBe(w.rung);
      expect(report.standing).toBe(w.token);
      expect(report.standing).toBe(STANDING_RUNGS[w.rung]);
      attained.add(report.rung as number);
    }
    expect([...attained].sort()).toEqual([0, 1, 2, 3, 4]);
  });

  it("the rung-3 witness is clean-but-not-reserved via the na cap: clean(line) holds, lean_ceiling has ZERO instances, and the block is recorded, never inferred", { timeout: 300_000 }, () => {
    const line = straightLine();
    expect(line.verdict.outcome).toBe("contained");
    expect(clean(line.verdict.outcome, line.verdict.doctrine)).toBe(true);
    const report = gradeOf(line);
    expect(report.standing).toBe("clean");
    expect(report.rung).toBe(3);
    const lc = report.reserve.find((r) => r.id === "lean_ceiling")!;
    expect(lc.verdict).toBe("na"); // zero instances reads "na", never a vacuous universal
    expect(lc.instances).toBe(0);
    expect(report.reserved_blocked_by).toEqual([{ id: "lean_ceiling", reason: "na" }]);
  });

  it("rung 1 vs rung 0 discriminate on outcome, not on quality (both witnesses grade quality failing)", { timeout: 300_000 }, () => {
    const runoff = mistakeLine("premature");
    const crash = crashLine();
    expect(runoff.verdict.quality).toBe("failing");
    expect(crash.verdict.quality).toBe("failing");
    expect(runoff.verdict.outcome).toBe("runoff");
    expect(crash.verdict.outcome).toBe("crash");
    expect(gradeOf(runoff).rung).toBe(1);
    expect(gradeOf(crash).rung).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// A-STANDING-LADDER-CUMULATIVE — the table IS the readable definition

type ReserveSpec = CheckVerdict | "absent";

function synthChecks(lean: ReserveSpec, sight: ReserveSpec, extraFail: boolean): CheckResult[] {
  const rows: CheckResult[] = [];
  const push = (id: string, verdict: CheckVerdict, scope: "corner" | "line"): void => {
    rows.push({
      id,
      scope,
      corner_id: scope === "corner" ? "c1" : null,
      pair: null,
      verdict,
      evidence: { message: "synthesised (A-STANDING-LADDER-CUMULATIVE)" }
    });
  };
  if (lean !== "absent") push("lean_ceiling", lean, "corner");
  if (sight !== "absent") push("stop_within_sight", sight, "line");
  if (extraFail) push("out_in_out", "fail", "corner");
  return rows;
}

function synthLine(outcome: Outcome, lean: ReserveSpec, sight: ReserveSpec, extraFail: boolean): LineResult {
  const checks = synthChecks(lean, sight, extraFail);
  const count = (v: CheckVerdict): number => checks.filter((c) => c.verdict === v).length;
  const doctrine = { pass: count("pass"), fail: count("fail"), warn: count("warn"), na: count("na"), checks };
  const q = quality(outcome, doctrine, shippedPack()); // the ONE colour law — coherent tuples only
  const verdict = {
    ok: clean(outcome, doctrine),
    spec_hash: "000000",
    result_hash: "000000",
    checks_version: 2,
    rubric: "parks-street/2",
    engine: "linelab/1",
    outcome,
    quality: q,
    headline: "synthesised",
    diagnosis: null,
    acceptance: { policy: "clean", met: clean(outcome, doctrine) },
    misjudgment: null,
    validity: null,
    corners: [],
    sight: null,
    constraints: null,
    doctrine
  };
  return { line_id: `synth-${outcome}-${lean}-${sight}-${extraFail ? "xf" : "ok"}`, verdict } as unknown as LineResult;
}

describe("A-STANDING-LADDER-CUMULATIVE (design/09 §4)", () => {
  const OUTCOMES: readonly Outcome[] = ["contained", "stopped", "wide", "runoff", "crash"];
  const RESERVE_SPECS: readonly ReserveSpec[] = ["pass", "warn", "fail", "na", "absent"];

  it("over the full synthesised product, the rung equals the greatest satisfied threshold — and no rung is attainable with a lower threshold violated", () => {
    let cases = 0;
    for (const outcome of OUTCOMES) {
      for (const lean of RESERVE_SPECS) {
        for (const sight of RESERVE_SPECS) {
          for (const extraFail of [false, true]) {
            const line = synthLine(outcome, lean, sight, extraFail);
            const v = line.verdict;
            // the independent readable table (design/05 §6.4, verbatim):
            const t1 = v.outcome !== "crash"; //             standing >= 1
            const t2 = v.quality !== "failing"; //           standing >= 2
            const t3 = clean(v.outcome, v.doctrine); //      standing >= 3
            const t4 = t3 && lean === "pass" && sight === "pass"; // standing = 4
            const expected = !t1 ? 0 : !t2 ? 1 : !t3 ? 2 : !t4 ? 3 : 4;

            const report = gradeOf(line);
            expect(report.rung, line.line_id).toBe(expected);
            expect(report.standing).toBe(STANDING_RUNGS[expected]);
            // cumulative-monotone: every threshold at or below the rung holds
            const thresholds = [true, t1, t2, t3, t4];
            for (let k = 0; k <= (report.rung as number); k++) {
              expect(thresholds[k], `${line.line_id}: threshold ${k} under rung ${report.rung}`).toBe(true);
            }
            // reserved_blocked_by is [] exactly when the annex conjunct holds
            const annexHolds = lean === "pass" && sight === "pass";
            expect(report.reserved_blocked_by.length === 0).toBe(annexHolds);
            cases++;
          }
        }
      }
    }
    expect(cases).toBe(OUTCOMES.length * RESERVE_SPECS.length * RESERVE_SPECS.length * 2);
  });

  it("the rung-token gloss is the law: a line at rung 4 satisfies clean(line), and so does a line at rung 3", () => {
    const r4 = synthLine("contained", "pass", "pass", false);
    const r3 = synthLine("contained", "warn", "pass", false);
    expect(gradeOf(r4).rung).toBe(4);
    expect(gradeOf(r3).rung).toBe(3);
    expect(clean(r4.verdict.outcome, r4.verdict.doctrine)).toBe(true);
    expect(clean(r3.verdict.outcome, r3.verdict.doctrine)).toBe(true); // "clean" names the highest rung ATTAINED
  });

  it("na and zero-instance members cap the ladder at 3 and are named with their reason (P-STANDING-NA-CAP's law)", () => {
    const naCase = synthLine("contained", "na", "pass", false);
    const absent = synthLine("contained", "absent", "pass", false);
    for (const line of [naCase, absent]) {
      const report = gradeOf(line);
      expect(report.rung).toBe(3);
      expect(report.reserved_blocked_by).toEqual([{ id: "lean_ceiling", reason: "na" }]);
    }
    expect(gradeOf(absent).reserve.find((r) => r.id === "lean_ceiling")).toEqual({
      id: "lean_ceiling",
      verdict: "na",
      instances: 0
    });
  });
});

// ---------------------------------------------------------------------------
// A-STANDING-REFUSAL — refusals are not a rung

describe("A-STANDING-REFUSAL (design/09 §4)", () => {
  const refusal: LineRefusal = {
    line_id: "refused-line",
    role: "ideal",
    ok: false,
    error: {
      code: "NO_SOLUTION",
      at: "solve",
      message: "no clean band",
      detail: { sub_reason: "empty_band" }
    }
  };

  it("a NO_SOLUTION envelope entry yields standing: null, refused: true — never a rung and never an exception", () => {
    const report = gradeOf(refusal);
    expect(report.standing).toBeNull();
    expect(report.rung).toBeNull();
    expect(report.refused).toBe(true);
    expect(report.reserve).toEqual([]);
    expect(report.reserved_blocked_by).toEqual([]);
    // the emission still carries its provenance stamps + placard
    expect(report.rubric).toBe("parks-street/2");
    expect(report.checks_version).toBe(2);
    expect(report.placard).toBe(PLACARD);
  });

  it("the attachment builder skips refusals — one row per NON-refused line (05 §7)", { timeout: 300_000 }, () => {
    const rows = standingAttachment([refusal, straightLine()]);
    expect(rows.ok).toBe(true);
    if (!rows.ok) return;
    expect(rows.value).toHaveLength(1);
    expect(rows.value[0]!.line_id).toBe("fx-standing-straight");
  });
});

// ---------------------------------------------------------------------------
// A-RESERVE-CHECKS-RESOLVE — the annex resolves; the four §A.6.1 typed errors

describe("A-RESERVE-CHECKS-RESOLVE (design/01 §A.6.1)", () => {
  const packJson = (): Record<string, unknown> =>
    structuredClone(loadJson(join(linelabRoot, "src", "plan", "doctrine", "packs", "parks-street.json"))) as Record<string, unknown>;

  it("every member of parks-street/2's annex resolves in that pack's check id set", () => {
    const pack = shippedPack();
    expect([...pack.annex.reserve_checks]).toEqual(["lean_ceiling", "stop_within_sight"]);
    const ids = new Set(pack.checks.map((c) => c.id));
    for (const member of pack.annex.reserve_checks) {
      expect(ids.has(member), member).toBe(true);
      const resolved = resolveCheckId(pack, member);
      expect(resolved.ok).toBe(true);
    }
  });

  it("annex absent → SCHEMA/reserve_checks_missing (refused, never defaulted)", () => {
    const json = packJson();
    delete json["annex"];
    const e = errOf(loadRubricPack(json));
    expect(e.code).toBe("SCHEMA");
    expect(e.detail?.["reason"]).toBe("reserve_checks_missing");
    expect(e.at).toBe("rubric.annex.reserve_checks");
  });

  it("annex empty → SCHEMA/reserve_checks_empty (a vacuous top rung is rejected, not shipped)", () => {
    const json = packJson();
    json["annex"] = { reserve_checks: [] };
    const e = errOf(loadRubricPack(json));
    expect(e.code).toBe("SCHEMA");
    expect(e.detail?.["reason"]).toBe("reserve_checks_empty");
  });

  it("unknown member → UNKNOWN_ID/unknown_reserve_check naming the pack and the id", () => {
    const json = packJson();
    json["annex"] = { reserve_checks: ["lean_ceiling", "not_a_check"] };
    const e = errOf(loadRubricPack(json));
    expect(e.code).toBe("UNKNOWN_ID");
    expect(e.detail?.["reason"]).toBe("unknown_reserve_check");
    expect(e.detail?.["id"]).toBe("not_a_check");
    expect(e.detail?.["pack"]).toBe("parks-street/2");
  });

  it('tombstoned member: "sight_vs_stopping" in the annex → UNKNOWN_ID/renamed_check naming stop_within_sight (renames consulted FIRST)', () => {
    const json = packJson();
    json["annex"] = { reserve_checks: ["sight_vs_stopping"] };
    const e = errOf(loadRubricPack(json));
    expect(e.code).toBe("UNKNOWN_ID");
    expect(e.detail?.["reason"]).toBe("renamed_check");
    expect(e.detail?.["successor"]).toBe("stop_within_sight");
  });
});

// ---------------------------------------------------------------------------
// A-STANDING-TOMBSTONE — struck names reject on typed reasons

describe("A-STANDING-TOMBSTONE (design/09 §4)", () => {
  it("out_available / sight_ok / commit_within_sight reject UNKNOWN_ID/struck_by_decision at check-id resolution; the first two name their successor mechanism, the third names none", () => {
    const pack = shippedPack();
    const expectStruck = (id: string, successorNamed: string | null): void => {
      const e = errOf(resolveCheckId(pack, id));
      expect(e.code, id).toBe("UNKNOWN_ID");
      expect(e.detail?.["reason"], id).toBe("struck_by_decision");
      if (successorNamed !== null) expect(e.message).toContain(successorNamed);
      else expect(e.message).toContain("no successor");
    };
    expectStruck("out_available", "annex.reserve_checks");
    expectStruck("sight_ok", "stop_within_sight");
    expectStruck("commit_within_sight", null);
  });

  it("SIGHT_MARGIN_ROB rejects UNKNOWN_ID/struck_by_decision naming annex.reserve_checks (explain surface)", () => {
    const r = explain("SIGHT_MARGIN_ROB");
    const e = errOf(r);
    expect(e.code).toBe("UNKNOWN_ID");
    expect(e.detail?.["reason"]).toBe("struck_by_decision");
    expect(e.detail?.["successor"]).toBe("annex.reserve_checks");
    expect(e.deferred).toBeUndefined(); // struck is NEVER deferred
  });

  it("sight_vs_stopping resolves to its rename tombstone wherever a check id is addressed", () => {
    const e = errOf(resolveCheckId(shippedPack(), "sight_vs_stopping"));
    expect(e.code).toBe("UNKNOWN_ID");
    expect(e.detail?.["reason"]).toBe("renamed_check");
    expect(e.detail?.["successor"]).toBe("stop_within_sight");
  });
});

// ---------------------------------------------------------------------------
// A-LADDER-PROSE — the shipped printing surfaces carry the full disclosure

describe("A-LADDER-PROSE (design/09 §4)", () => {
  function checkStandingValue(): { standing: StandingReport[]; standing_gloss: string; figure_id: string } {
    return once("check-standing-value", () => {
      const env = run(loadJson(join(standingFixturesDir, "fx-standing-straight.json")));
      if (!env.ok) throw new Error("straight fixture refused");
      const outcome = checkVerb({ loadedText: JSON.stringify(env.value), argv: ["--standing"] });
      expect(outcome.exit).toBe(0);
      const doc = outcome.stdout as { ok: boolean; value: { standing: StandingReport[]; standing_gloss: string; figure_id: string } };
      expect(doc.ok).toBe(true);
      return doc.value;
    });
  }

  it("check --standing (envelope input): every row carries the pack id, checks_version, and the 05 §6.4 placard verbatim; the surface carries the rung-token gloss", { timeout: 300_000 }, () => {
    const value = checkStandingValue();
    expect(value.standing.length).toBeGreaterThan(0);
    for (const row of value.standing) {
      expect(row.rubric).toBe("parks-street/2");
      expect(row.checks_version).toBe(2);
      expect(row.placard).toBe(PLACARD);
    }
    expect(value.standing_gloss).toBe(STANDING_GLOSS);
  });

  it("explain standing / reserved / reserve_checks: threshold table, gloss, loaded pack annex, placard — byte-identical to the check surface's strings", () => {
    for (const target of ["standing", "reserved", "reserve_checks"]) {
      const r = explain(target);
      expect(r.ok, target).toBe(true);
      if (!r.ok) continue;
      expect(r.value.kind).toBe("analysis");
      if (r.value.kind !== "analysis") continue;
      const block = r.value.standing;
      expect(block, target).toBeDefined();
      expect(block!.gloss).toBe(STANDING_GLOSS);
      expect(block!.placard).toBe(PLACARD); // byte-identity ACROSS surfaces
      expect(block!.rubric).toBe("parks-street/2");
      expect(block!.checks_version).toBe(2);
      expect([...block!.reserve_checks]).toEqual(["lean_ceiling", "stop_within_sight"]);
      expect(block!.thresholds.length).toBeGreaterThanOrEqual(5);
      expect([...block!.rungs]).toEqual([...STANDING_RUNGS]);
    }
  });

  it("check --standing is exit-code-neutral on an envelope whatever the rungs say (crash line included)", { timeout: 300_000 }, () => {
    const env = run(loadJson(join(linelabRoot, "test", "fixtures", "exercise", "fx-lean-crash.json")));
    expect(env.ok).toBe(true);
    if (!env.ok) return;
    const outcome = checkVerb({ loadedText: JSON.stringify(env.value), argv: ["--standing"] });
    expect(outcome.exit).toBe(0); // rung 0 in the rows, exit 0 on the verb — analysis is not a gate
    const doc = outcome.stdout as { value: { standing: StandingReport[] } };
    expect(doc.value.standing[0]!.standing).toBe("crash");
  });

  it("check --standing on a verdict-less input is INEFFECTUAL/standing_without_finished_lines — never accepted-and-ignored (D8)", () => {
    const scenario = readFileSync(join(linelabRoot, "test", "fixtures", "exercise", "fx-lean-crash.json"), "utf8");
    const onScenario = checkVerb({ loadedText: scenario, argv: ["--standing"] });
    expect(onScenario.exit).toBe(2);
    const e1 = (onScenario.stdout as { error: LinelabError }).error;
    expect(e1.code).toBe("INEFFECTUAL");
    expect(e1.detail?.["reason"]).toBe("standing_without_finished_lines");

    const onScene = checkVerb({ loadedText: "ride book90\n", argv: ["--standing"] });
    expect(onScene.exit).toBe(2);
    expect((onScene.stdout as { error: LinelabError }).error.detail?.["reason"]).toBe("standing_without_finished_lines");
  });

  it("a refused envelope line gets no row on the check surface (05 §7)", { timeout: 300_000 }, () => {
    const line = straightLine();
    const envelope = {
      figure_id: "prose-refusal",
      road: {},
      lines: [
        { line_id: "refused", role: "ideal", ok: false, error: { code: "NO_SOLUTION", at: "solve", message: "x" } },
        line
      ]
    };
    const outcome = checkVerb({ loadedText: JSON.stringify(envelope), argv: ["--standing"] });
    expect(outcome.exit).toBe(0);
    const doc = outcome.stdout as { value: { standing: StandingReport[] } };
    expect(doc.value.standing.map((r) => r.line_id)).toEqual(["fx-standing-straight"]);
  });

  it("a malformed envelope line is a typed SCHEMA rejection, never a throw", () => {
    const envelope = { figure_id: "bad", road: {}, lines: [{ line_id: "x", verdict: { outcome: "contained" } }] };
    const outcome = checkVerb({ loadedText: JSON.stringify(envelope), argv: ["--standing"] });
    expect(outcome.exit).toBe(2);
    const e = (outcome.stdout as { error: LinelabError }).error;
    expect(e.code).toBe("SCHEMA");
    expect(e.detail?.["reason"]).toBe("envelope_line_malformed");
  });
});

// ---------------------------------------------------------------------------
// A-STANDING-WARN-BAND — SEAM-STANDING-WARN (see the file banner)

describe("A-STANDING-WARN-BAND / SEAM-STANDING-WARN", () => {
  it.todo(
    "A-STANDING-WARN-BAND as designed — F-STANDING-WARN (preset book90, street, mu 1.0, default solve, entry 38 ∈ [36,44]) grades contained ∧ clean ∧ lean_ceiling warn → standing clean (rung 3), reserved_blocked_by [{lean_ceiling, warn}] — lands when SEAM-STANDING-WARN is ratified/resolved (on this engine no entry in the calibration band yields contained ∧ clean ∧ warn; arithmetic in the file banner and in the three ENFORCED cases below)"
  );

  // The three cases below are the parts of A-STANDING-WARN-BAND this engine CAN
  // decide. Before them the gate was a bare `it.todo` and nothing about the warn
  // band was asserted at all; now the reachable half bites, and the unreachable
  // half is pinned with numbers so a drift that opens it re-opens the seam.

  it("the warn BAND itself is reachable — on a BLIND corner, where the reserve is min(phi_reserve, BLIND_RESERVE_DEG = 35°)", { timeout: 300_000 }, () => {
    // `lean_ceiling`'s reserve is capped at the pack's BLIND_RESERVE_DEG when
    // `blindAtTurnIn` holds (checks.ts's evaluator), so a blind corner ridden at
    // 36–39° of lean is squarely in `ate_reserve` while the ceiling stays 45°.
    const r = run(
      {
        spec: "linelab/1",
        id: "fx-standing-warn-blind",
        road: { preset: "bookBlind" },
        rider: { profile: "street", start: { speed_kmh: 34, f: 1.0 }, plan: [{ do: "turn_in", id: "t1", at_s: 12, target: { lean_deg: 37 } }] }
      },
      { engine_semver: "0.1.0" }
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const line = r.value.lines[0] as LineResult;
    expect(isLineRefusal(line)).toBe(false);
    expect(line.verdict.outcome).toBe("contained");
    const lc = line.verdict.doctrine.checks.filter((c) => c.id === "lean_ceiling");
    expect(lc.length).toBeGreaterThan(0);
    expect(lc.map((c) => c.verdict)).toContain("warn");
    const m = lc.find((c) => c.verdict === "warn")!.evidence.metrics as Record<string, number>;
    expect(m["reserve_deg"]).toBe(35); // the BLIND cap, not atan(0.85) = 40.4°
    expect(m["ceiling_deg"]).toBeCloseTo(45, 6);
    expect(m["phi_max_deg"]).toBeGreaterThan(35);
    expect(m["phi_max_deg"]).toBeLessThanOrEqual(45);
  });

  it("and on that witness the LADDER half of A-STANDING-WARN-BAND holds: reserved is blocked by exactly [{lean_ceiling, warn}]", { timeout: 300_000 }, () => {
    const r = run(
      {
        spec: "linelab/1",
        id: "fx-standing-warn-blind",
        road: { preset: "bookBlind" },
        rider: { profile: "street", start: { speed_kmh: 34, f: 1.0 }, plan: [{ do: "turn_in", id: "t1", at_s: 12, target: { lean_deg: 37 } }] }
      },
      { engine_semver: "0.1.0" }
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const report = gradeOf(r.value.lines[0] as LineEntry);
    expect(report.reserved_blocked_by).toEqual([{ id: "lean_ceiling", reason: "warn" }]);
    // the rung is 2 rather than the designed 3 for ONE reason and it is stated:
    // this witness is not `clean` (out_in_out / hold_wide_for_sight fail on an
    // authored plan that is not a solved out-in-out line on a blind corner), and
    // rung 3's threshold IS clean(line). That is the whole seam.
    expect(report.standing).toBe("caution");
    expect(clean((r.value.lines[0] as LineResult).verdict.outcome, (r.value.lines[0] as LineResult).verdict.doctrine)).toBe(false);
  });

  it("SEAM pin, quantified: the CLEAN band's peak lean never exceeds the (non-blind) reserve on any book preset — it tops out exactly AT it", { timeout: 900_000 }, () => {
    // This is why `contained ∧ clean ∧ warn` is unreachable off a blind corner:
    // the solver's clean door refuses the moment the required lean would pass
    // phiReserve, so the band's supremum IS the reserve and the warn band opens
    // only where the clean door has already closed.
    const probes: { preset: string; entry: number }[] = [];
    for (const preset of ["book90", "bookHairpin", "bookDecreasing"]) {
      for (const entry of [29, 30, 30.5, 31, 32, 34, 36, 38]) probes.push({ preset, entry });
    }
    let cleanLines = 0;
    let maxCleanPhi = 0;
    let reserveDeg = 0;
    for (const { preset, entry } of probes) {
      const r = chainedSolve({ road: { preset }, entry_kmh: entry, turn_in: "auto" } as never);
      if (!r.ok) continue;
      const line = r.value;
      if (!clean(line.verdict.outcome, line.verdict.doctrine)) continue;
      cleanLines++;
      for (const c of line.verdict.doctrine.checks.filter((x) => x.id === "lean_ceiling")) {
        const m = c.evidence.metrics as Record<string, number>;
        expect(c.verdict, `${preset}@${entry} produced a clean WARN — the seam is closed, resolve A-STANDING-WARN-BAND`).toBe("pass");
        maxCleanPhi = Math.max(maxCleanPhi, m["phi_max_deg"]!);
        reserveDeg = m["reserve_deg"]!;
      }
    }
    expect(cleanLines).toBeGreaterThan(3);
    expect(reserveDeg).toBeCloseTo(40.36, 1); // atan(0.85), the non-blind reserve
    // the supremum sits AT the reserve, not below it by an arbitrary margin
    expect(maxCleanPhi).toBeLessThanOrEqual(reserveDeg + 1e-6);
    expect(maxCleanPhi).toBeGreaterThan(reserveDeg - 0.1);
  });

  it("SEAM pin: the committed F-STANDING-WARN input (entry 38) refuses NO_SOLUTION/empty_band on this engine — pinned so drift re-opens the seam", { timeout: 300_000 }, () => {
    const input = loadJson(join(standingFixturesDir, "fx-standing-warn.json")) as { road: string; entry_kmh: number };
    expect(input).toEqual({ road: "book90", entry_kmh: 38 }); // F_STANDING_WARN_ENTRY_KMH pin
    const r = chainedSolve(input as never);
    const e = errOf(r);
    expect(e.code).toBe("NO_SOLUTION");
    expect(e.detail?.["sub_reason"]).toBe("empty_band");
  });

  it("SEAM pin: the clean band sits wholly below the warn floor — the 34 km/h clean line reads lean_ceiling PASS (never warn)", { timeout: 300_000 }, () => {
    const report = gradeOf(base90());
    expect(report.reserve.find((r) => r.id === "lean_ceiling")!.verdict).toBe("pass");
  });

  it("the emergent refusal grades as A-STANDING-REFUSAL demands when carried as an envelope entry", { timeout: 300_000 }, () => {
    const input = loadJson(join(standingFixturesDir, "fx-standing-warn.json"));
    const r = chainedSolve(input as never);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    const entry: LineRefusal = { line_id: "fx-standing-warn", role: "ideal", ok: false, error: r.error };
    const report = gradeOf(entry);
    expect(report.standing).toBeNull();
    expect(report.refused).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// G-STANDING-NO-HASH-MOVE — standing over EVERY golden-roster fixture moves
// zero envelope bytes and zero result_hash vs the committed blessed store

interface GoldenLineSummary {
  readonly line_id: string;
  readonly result_hash: string;
}

describe("G-STANDING-NO-HASH-MOVE (design/01 §A.6.1 / design/09 §10)", () => {
  it("for every roster fixture: standing computes on every line, the entry's bytes are untouched, and result_hash equals the committed golden's", { timeout: 900_000 }, () => {
    expect(BLESS_ROSTER.length).toBeGreaterThan(0);
    for (const entry of BLESS_ROSTER) {
      const committed = loadJson(join(goldensDir, `${entry.id}.json`)) as { lines: readonly GoldenLineSummary[] };
      const byId = new Map(committed.lines.map((l) => [l.line_id, l.result_hash]));

      let lines: readonly LineResult[];
      if (entry.input.kind === "run") {
        const r = run(entry.input.input);
        expect(r.ok, `${entry.id}: run refused`).toBe(true);
        if (!r.ok) continue;
        lines = r.value.lines.filter((l): l is LineResult => !isLineRefusal(l));
      } else {
        const baseR = chainedSolve({ ...(entry.input.baseSpec as object), accept: entry.input.baseAccept } as never);
        expect(baseR.ok, `${entry.id}: base refused`).toBe(true);
        if (!baseR.ok) continue;
        const compiled = compileMistake(entry.input.mistake.kind as never, entry.input.mistake.params as never, {
          base: baseR.value,
          spec: entry.input.baseSpec as never
        });
        expect(compiled.ok, `${entry.id}: mistake refused`).toBe(true);
        if (!compiled.ok) continue;
        lines = [baseR.value, compiled.value.line];
      }

      for (const line of lines) {
        const before = JSON.stringify(line);
        const report = standing(line);
        expect(report.ok, `${entry.id}/${line.line_id}: standing refused`).toBe(true);
        expect(JSON.stringify(line), `${entry.id}/${line.line_id}: envelope bytes moved`).toBe(before);
        const blessed = byId.get(line.line_id);
        expect(blessed, `${entry.id}/${line.line_id}: missing from committed golden`).toBeDefined();
        expect(line.verdict.result_hash, `${entry.id}/${line.line_id}: result_hash moved`).toBe(blessed);
        // the report exists BESIDE the record: no verdict/envelope member gained it
        expect(before.includes('"standing"')).toBe(false);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// G-STANDING-NO-HASH-MOVE, the ANNEX A/B arm.
//
// design/09 §10's letter: "adding `annex.reserve_checks` to parks-street/2
// moves no `result_hash` and no `spec_hash`; the six Chapter-8 book figures and
// every committed book scene bake BYTE-IDENTICAL before and after."
//
// The letter's literal "before" state — the pack with no annex at all — is
// unrunnable against the current strict loader (`SCHEMA/reserve_checks_missing`,
// asserted above), by design: the annex is mandatory pack data. The runnable
// equivalent asserted here is stronger in the direction that matters and weaker
// in none: VARY the annex to a different VALID subset, and demand that nothing
// downstream of it moves — not one result_hash, not one spec_hash, not one byte
// of any of the six committed scene bakes.
//
// That is exactly the property G7 wants: the annex is DECLARED PACK DATA, out of
// hash, off the gate, off the picture.

describe("G-STANDING-NO-HASH-MOVE — the annex A/B (design/09 §10)", () => {
  /** parks-street/2 with a DIFFERENT valid annex subset. */
  function variantPack(): RubricPack {
    const shipped = loadShippedRubricPack("parks-street");
    expect(shipped.ok).toBe(true);
    if (!shipped.ok) throw new Error("pack refused");
    const raw = JSON.parse(JSON.stringify(parksStreetRaw)) as Record<string, unknown>;
    const annex = raw["annex"] as Record<string, unknown>;
    // a proper, non-empty subset of the shipped annex — still every-member-valid
    const subset = [shipped.value.annex.reserve_checks[0]!];
    expect(subset.length).toBeLessThan(shipped.value.annex.reserve_checks.length);
    annex["reserve_checks"] = subset;
    const varied = loadRubricPack(raw);
    expect(varied.ok, "the varied annex must still load").toBe(true);
    if (!varied.ok) throw new Error("varied pack refused");
    expect(varied.value.annex.reserve_checks).toEqual(subset);
    return varied.value;
  }

  it("varying the annex changes the LADDER on at least one roster line — otherwise the A/B below is vacuous", { timeout: 900_000 }, () => {
    const varied = variantPack();
    const line = base90();
    const withShipped = standing(line);
    const withVaried = standing(line, varied);
    expect(withShipped.ok && withVaried.ok).toBe(true);
    if (!withShipped.ok || !withVaried.ok) return;
    // the reserve ROSTER differs (that is the annex's whole job)
    expect(withVaried.value.reserve.map((r) => r.id)).not.toEqual(withShipped.value.reserve.map((r) => r.id));
    expect(withVaried.value.reserve_checks).toEqual(varied.annex.reserve_checks);
  });

  it("neither result_hash nor spec_hash moves under EITHER annex, on every roster fixture", { timeout: 900_000 }, () => {
    const varied = variantPack();
    expect(BLESS_ROSTER.length).toBeGreaterThan(0);
    for (const entry of BLESS_ROSTER) {
      const committed = loadJson(join(goldensDir, `${entry.id}.json`)) as {
        lines: readonly { line_id: string; result_hash: string; spec_hash?: string }[];
      };
      const byId = new Map(committed.lines.map((l) => [l.line_id, l]));

      let lines: readonly LineResult[];
      if (entry.input.kind === "run") {
        const r = run(entry.input.input);
        expect(r.ok, `${entry.id}: run refused`).toBe(true);
        if (!r.ok) continue;
        lines = r.value.lines.filter((l): l is LineResult => !isLineRefusal(l));
      } else {
        const baseR = chainedSolve({ ...(entry.input.baseSpec as object), accept: entry.input.baseAccept } as never);
        expect(baseR.ok, `${entry.id}: base refused`).toBe(true);
        if (!baseR.ok) continue;
        const compiled = compileMistake(entry.input.mistake.kind as never, entry.input.mistake.params as never, {
          base: baseR.value,
          spec: entry.input.baseSpec as never
        });
        expect(compiled.ok, `${entry.id}: mistake refused`).toBe(true);
        if (!compiled.ok) continue;
        lines = [baseR.value, compiled.value.line];
      }

      for (const line of lines) {
        const hashBefore = line.verdict.result_hash;
        const specBefore = line.verdict.spec_hash;
        for (const pack of [undefined, varied]) {
          const report = standing(line, pack);
          expect(report.ok, `${entry.id}/${line.line_id}: standing refused`).toBe(true);
        }
        expect(line.verdict.result_hash, `${entry.id}/${line.line_id}: result_hash moved`).toBe(hashBefore);
        expect(line.verdict.spec_hash, `${entry.id}/${line.line_id}: spec_hash moved`).toBe(specBefore);
        const blessed = byId.get(line.line_id);
        expect(blessed, `${entry.id}/${line.line_id}: missing from committed golden`).toBeDefined();
        expect(line.verdict.result_hash).toBe(blessed!.result_hash);
      }
    }
  });

  it("all SIX committed book scenes bake byte-identical before and after the annex is varied — SVG, spec_hash and every result_hash", { timeout: 900_000 }, () => {
    const scenes = readdirSync(scenesDir)
      .filter((f) => f.endsWith(".scene"))
      .sort();
    expect(scenes.length, "the six committed book scenes").toBe(6);

    interface Bake {
      readonly svg: string;
      readonly spec_hashes: readonly string[];
      readonly result_hashes: readonly string[];
      readonly lines: readonly LineResult[];
    }
    /** One full bake of one committed scene: solve + render, exactly as `figure` does. */
    function bake(id: string, text: string): Bake {
      const lowered = lowerScene(text);
      expect(lowered.ok, `${id} must lower`).toBe(true);
      if (!lowered.ok) throw new Error("lower refused");
      const fig = run(lowered.value as unknown as Record<string, unknown>, { engine_semver: "0.1.0", figure_id: id });
      expect(fig.ok, `${id} must bake`).toBe(true);
      if (!fig.ok) throw new Error("bake refused");
      const drawn = fig.value.lines.filter((l): l is LineResult => !isLineRefusal(l));
      const rendered = renderViews({ road: fig.value.road as never, lines: drawn });
      expect(rendered.ok, `${id} must render`).toBe(true);
      if (!rendered.ok) throw new Error("render refused");
      return {
        svg: rendered.value.svg,
        spec_hashes: drawn.map((l) => l.verdict.spec_hash),
        result_hashes: drawn.map((l) => l.verdict.result_hash),
        lines: drawn
      };
    }

    const varied = variantPack();
    for (const file of scenes) {
      const id = file.replace(/\.scene$/, "");
      const text = readFileSync(join(scenesDir, file), "utf8");
      const before = bake(id, text);

      // the annex is exercised over every line of THAT bake, under BOTH packs
      for (const line of before.lines) {
        expect(standing(line).ok).toBe(true);
        expect(standing(line, varied).ok).toBe(true);
      }

      const after = bake(id, text);
      expect(after.svg, `${id}: baked SVG moved`).toBe(before.svg);
      expect(after.spec_hashes, `${id}: spec_hash moved`).toEqual(before.spec_hashes);
      expect(after.result_hashes, `${id}: result_hash moved`).toEqual(before.result_hashes);
      // and the standing token never reached the picture (D43's out-of-hash law)
      expect(after.svg.includes("standing")).toBe(false);
      expect(after.svg.includes("reserved")).toBe(false);
    }
  });
});
