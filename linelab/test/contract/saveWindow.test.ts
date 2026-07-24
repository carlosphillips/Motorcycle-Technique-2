// test/contract/saveWindow.test.ts — the D44 reserve-lean save window
// (design/04 §4b) as a CONTRACT suite. This file hosts the v0.2 exit gates
// design/00 §3 names for the analysis:
//
//   · C-SAVEWIN-REFUSE-COARSE (09 §10) — `--scan-ds 2.0` on F-ORACLE-90 exits
//     SCHEMA/scan_ds_too_coarse with a populated
//     {scan_ds_m, v_max_ms, step_s, bound_s} and produces NO SaveWindow.
//   · C-SAVEWIN-BUDGET (09 §10) — ≤ 400 ms per corner on the largest committed
//     figure × the 3× CI multiplier, AND `runs` asserted against §4b.8's
//     ⌈domain_len / scan_ds⌉ + 5 + ≤ 8 bound, recomputed independently here so
//     the budget claim is auditable rather than merely timed.
//   · G-SAVEWIN-GRID (09 §3.2) — the HORIZON_SCAN_DS_M sensitivity at
//     0.25 / 0.5 / 1.0 m: all three agree on `status` and on `tau_close_s`
//     within HORIZON_EPS_S; the retired 2.0 / 4.0 m rungs are refusals.
//
// plus the structural laws that keep the object honest: disclosure survives
// every refusal (§4b.5), a refusing status carries NO derived scalar
// (P-SAVEWIN-REFUSES), and the status table's first-match-wins order is pinned
// against the engine's own behaviour on F-ORACLE-90 (see the RATIFIED-DEFECT
// case — the letter and the measurement disagree there, and the test records
// which one the code follows so the disagreement cannot rot silently).
//
// Everything here reads a FINISHED line: `saveWindow` adds no engine run to any
// figure path (04 §4b.8), so nothing in this file touches a bake.

import { describe, it, expect, beforeAll } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { lowerScene } from "../../src/plan/scene.js";
import { run } from "../../src/solve/run.js";
import { isLineRefusal } from "../../src/solve/envelope.js";
import type { LineResult } from "../../src/solve/types.js";
import {
  SAVE_WINDOW_PLACARD,
  SAVE_WINDOW_STATUSES,
  SAVE_WINDOW_STATUS_SENTENCES,
  saveAt,
  saveWindow,
  saveWindowScalarLines,
  saveWindowSummary,
  type SaveWindow,
  type SaveWindowInput
} from "../../src/solve/saveWindow.js";
import {
  HORIZON_BISECT_MAX,
  HORIZON_EPS_S,
  HORIZON_SCAN_DS_M,
  HORIZON_TAU_QUANTUM_S,
  TAU_TAIL_S
} from "../../src/solve/constants.js";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "../..");
const mainJs = join(repoRoot, "dist/cli/main.js");
const scenesDir = resolve(repoRoot, "../figures");

// ---------------------------------------------------------------------------
// Fixtures. F-ORACLE-90 is design/09's own name for `book90` + `premature`;
// the two `resolved` witnesses are the same road under a different mistake, so
// the grid gate exercises a live `tau_close_s` instead of only a refusal.

function inputOf(line: LineResult): SaveWindowInput {
  return {
    line_id: line.line_id,
    trajectory: line.trajectory,
    resolved_scenario: line.resolved_scenario,
    verdict: { corners: line.verdict.corners }
  };
}

function mistakeLine(kind: string, entry: number): LineResult {
  const r = run({ road: { preset: "book90" }, entry_kmh: entry, turn_in: "auto", mistake: { kind } }, { engine_semver: "0.1.0" });
  expect(r.ok, `book90 + ${kind} @${entry} must solve`).toBe(true);
  if (!r.ok) throw new Error("unreachable");
  const line = r.value.lines.find((l): l is LineResult => !isLineRefusal(l) && l.role === "mistake");
  expect(line, `book90 + ${kind} produced no mistake line`).toBeDefined();
  return line!;
}

let oracle90: LineResult; // F-ORACLE-90 — book90 + premature @34
let resolvedOverspeed: LineResult;
let resolvedChop: LineResult;

beforeAll(() => {
  oracle90 = mistakeLine("premature", 34);
  resolvedOverspeed = mistakeLine("overspeed", 34);
  resolvedChop = mistakeLine("chop", 34);
}, 300_000);

// ---------------------------------------------------------------------------
// C-SAVEWIN-REFUSE-COARSE

describe("C-SAVEWIN-REFUSE-COARSE — the §4b.5 resolution law refuses, it never under-triggers", () => {
  it("`--scan-ds 2.0` on F-ORACLE-90 is SCHEMA/scan_ds_too_coarse with the full detail payload and NO SaveWindow", () => {
    const r = saveWindow(inputOf(oracle90), "c1", { scan_ds_m: 2.0 });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.code).toBe("SCHEMA");
    expect(r.error.at).toBe("scan_ds_m");
    const d = r.error.detail as Record<string, number | string>;
    expect(d["reason"]).toBe("scan_ds_too_coarse");
    expect(d["scan_ds_m"]).toBe(2.0);
    expect(typeof d["v_max_ms"]).toBe("number");
    expect(typeof d["step_s"]).toBe("number");
    expect(d["bound_s"]).toBe(HORIZON_TAU_QUANTUM_S);
    // the law itself: the reported step really does violate the quantum
    expect((d["step_s"] as number)).toBeGreaterThan(HORIZON_TAU_QUANTUM_S);
    expect((d["step_s"] as number)).toBeCloseTo(2.0 / (d["v_max_ms"] as number), 12);
    // no value member at all — a refusal is not a SaveWindow with holes in it
    expect("value" in r).toBe(false);
  });

  it("the retired 4.0 m rung refuses too, and a non-positive scan step is BAD_RANGE (a different failure mode)", () => {
    const coarse = saveWindow(inputOf(oracle90), "c1", { scan_ds_m: 4.0 });
    expect(coarse.ok).toBe(false);
    if (!coarse.ok) expect((coarse.error.detail as Record<string, unknown>)["reason"]).toBe("scan_ds_too_coarse");

    for (const bad of [0, -1]) {
      const r = saveWindow(inputOf(oracle90), "c1", { scan_ds_m: bad });
      expect(r.ok).toBe(false);
      if (r.ok) continue;
      expect(r.error.code).toBe("BAD_RANGE");
      expect((r.error.detail as Record<string, unknown>)["reason"]).toBe("scan_ds_not_positive");
    }
  });

  it("through the CLI: exit 2, the same typed refusal, and stdout carries no `value`", () => {
    const dir = mkdtempSync(join(tmpdir(), "linelab-coarse-"));
    const path = join(dir, "o90.json");
    execFileSync("node", [mainJs, "run", "--road", "preset book90", "--entry", "34", "--turn-in", "auto",
      "--mistake", "premature", "--out", path], { cwd: repoRoot, stdio: "ignore" });
    let exit = 0;
    let out = "";
    try {
      out = execFileSync("node", [mainJs, "save-window", path, "--line", "premature", "--corner", "c1", "--scan-ds", "2.0"],
        { cwd: repoRoot, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    } catch (e) {
      const err = e as { status: number; stdout: string };
      exit = err.status;
      out = err.stdout;
    }
    expect(exit).toBe(2);
    const doc = JSON.parse(out) as { ok: boolean; value?: unknown; error: { code: string; detail: Record<string, unknown> } };
    expect(doc.ok).toBe(false);
    expect(doc.value).toBeUndefined();
    expect(doc.error.code).toBe("SCHEMA");
    expect(doc.error.detail["reason"]).toBe("scan_ds_too_coarse");
  }, 120_000);
});

// ---------------------------------------------------------------------------
// C-SAVEWIN-BUDGET

describe("C-SAVEWIN-BUDGET — the per-corner cost is bounded AND the bound is auditable from `runs`", () => {
  // 09 §10: "≤ 400 ms per corner on the largest committed figure, × the
  // standard 3× CI-variance multiplier".
  const BUDGET_MS = 400 * 3;

  /**
   * §4b.8's own arithmetic, recomputed here from the RECORD rather than read
   * off the implementation: `domain_len` is the station span of the §4b.5
   * τ-domain, and the grid can hold at most one point per `scan_ds` of it plus
   * the two endpoints and the three mandatory points, plus HORIZON_BISECT_MAX
   * bisection probes.
   */
  function runsBound(line: LineResult, cornerId: string, scanDs: number): number {
    const events = line.trajectory.events;
    const samples = line.trajectory.samples;
    const detect = events.find((e) => e.kind === "run_wide_detect" && e.corner_id === cornerId);
    expect(detect, "the budget arm needs a corner with a recorded detect").toBeDefined();
    const turnIn =
      events.find((e) => e.kind === "turn_in" && e.corner_id === cornerId) ??
      [...events].reverse().find((e) => e.kind === "turn_in" && e.t <= detect!.t + 1e-12);
    const exitEv = events.find((e) => e.kind === "exit" && e.corner_id === cornerId);
    const lo = Math.max(turnIn!.t, samples[0]!.t);
    const hi = Math.min(
      line.trajectory.terminated.t,
      exitEv === undefined ? Number.POSITIVE_INFINITY : exitEv.t + TAU_TAIL_S,
      samples[samples.length - 1]!.t
    );
    const inDomain = samples.filter((p) => p.t >= lo - 1e-9 && p.t <= hi + 1e-9);
    const domainLen = inDomain.length === 0 ? 0 : inDomain[inDomain.length - 1]!.s - inDomain[0]!.s;
    return Math.ceil(domainLen / scanDs) + 5 + HORIZON_BISECT_MAX;
  }

  it("every corner of the largest committed figure lands inside the budget, and `runs` obeys the §4b.8 bound", () => {
    const lowered = lowerScene(readFileSync(join(scenesDir, "fig-08-06.scene"), "utf8"));
    expect(lowered.ok).toBe(true);
    if (!lowered.ok) return;
    const fig = run(lowered.value as unknown as Record<string, unknown>, { engine_semver: "0.1.0", figure_id: "fig-08-06" });
    expect(fig.ok).toBe(true);
    if (!fig.ok) return;
    const lines = fig.value.lines.filter((l): l is LineResult => !isLineRefusal(l));
    expect(lines.length).toBeGreaterThan(0);

    let probedACorner = false;
    for (const line of lines) {
      const input = inputOf(line);
      for (const corner of line.verdict.corners) {
        const t0 = performance.now();
        const w = saveWindow(input, corner.id);
        const ms = performance.now() - t0;
        expect(w.ok, `saveWindow refused on ${line.line_id}/${corner.id}`).toBe(true);
        if (!w.ok) continue;
        expect(ms, `${line.line_id}/${corner.id} took ${ms.toFixed(1)} ms`).toBeLessThan(BUDGET_MS);
        if (w.value.status === "not_applicable") {
          expect(w.value.runs).toBe(0); // no corrective ⇒ no probe at all
          continue;
        }
        probedACorner = true;
        const bound = runsBound(line, corner.id, w.value.scan_ds_m);
        expect(
          w.value.runs,
          `${line.line_id}/${corner.id}: runs ${w.value.runs} exceeds ⌈domain_len/${w.value.scan_ds_m}⌉+5+${HORIZON_BISECT_MAX} = ${bound}`
        ).toBeLessThanOrEqual(bound);
      }
    }
    // the gate is only meaningful if at least one corner actually ran probes
    expect(probedACorner, "no corner of fig-08-06 carries a corrective — the budget arm would be vacuous").toBe(true);
  }, 300_000);

  it("`runs` is disclosed on every window, refusals included — the budget claim is readable off the object", () => {
    for (const line of [oracle90, resolvedOverspeed, resolvedChop]) {
      const all = saveWindow(inputOf(line));
      expect(all.ok).toBe(true);
      if (!all.ok) continue;
      for (const w of all.value) expect(Number.isInteger(w.runs)).toBe(true);
    }
  }, 300_000);
});

// ---------------------------------------------------------------------------
// G-SAVEWIN-GRID

describe("G-SAVEWIN-GRID — the scan-resolution sensitivity (09 §3.2)", () => {
  const RUNGS = [0.25, 0.5, 1.0] as const;

  function rungs(line: LineResult, cornerId: string): readonly SaveWindow[] {
    return RUNGS.map((ds) => {
      const r = saveWindow(inputOf(line), cornerId, { scan_ds_m: ds });
      expect(r.ok, `rung ${ds} m refused on ${line.line_id}: ${r.ok ? "" : JSON.stringify(r.error.detail)}`).toBe(true);
      if (!r.ok) throw new Error("rung refused");
      expect(r.value.scan_ds_m).toBe(ds); // the rung really threaded through
      return r.value;
    });
  }

  it("a RESOLVED window agrees on status and on tau_close_s within HORIZON_EPS_S across all three rungs (overspeed)", () => {
    const ws = rungs(resolvedOverspeed, "c1");
    expect(ws.map((w) => w.status)).toEqual(["resolved", "resolved", "resolved"]);
    const taus = ws.map((w) => w.tau_close_s!);
    for (const tau of taus) expect(typeof tau).toBe("number");
    expect(Math.max(...taus) - Math.min(...taus)).toBeLessThanOrEqual(HORIZON_EPS_S);
  }, 300_000);

  it("a second RESOLVED window agrees the same way (chop — a freeze-carrying line, so the §4b.5 clamp is exercised too)", () => {
    const ws = rungs(resolvedChop, "c1");
    expect(ws.map((w) => w.status)).toEqual(["resolved", "resolved", "resolved"]);
    const taus = ws.map((w) => w.tau_close_s!);
    expect(Math.max(...taus) - Math.min(...taus)).toBeLessThanOrEqual(HORIZON_EPS_S);
    // a freeze line emits t_freeze_end_s; a non-freeze line omits it (§4b.7)
    expect(ws[0]!.t_freeze_end_s).toBeDefined();
    expect(rungs(resolvedOverspeed, "c1")[0]!.t_freeze_end_s).toBeUndefined();
  }, 300_000);

  it("F-ORACLE-90 agrees on status across all three rungs (the refusing branch is rung-stable too)", () => {
    const ws = rungs(oracle90, "c1");
    expect(new Set(ws.map((w) => w.status)).size).toBe(1);
    // no rung invents a scalar the status suppresses
    for (const w of ws) expect(w.tau_close_s).toBeUndefined();
  }, 300_000);

  it("the retired 2.0 / 4.0 m rungs refuse on the same fixture — the law is what retired them", () => {
    for (const ds of [2.0, 4.0]) {
      const r = saveWindow(inputOf(resolvedOverspeed), "c1", { scan_ds_m: ds });
      expect(r.ok, `${ds} m must refuse`).toBe(false);
    }
  }, 120_000);

  it("RATIFIED DEFECT — the 1.0 m rung is not universally legal: it refuses on any line whose v_max < 10 m/s", () => {
    // design/09's G-SAVEWIN-GRID says all three rungs "satisfy the resolution
    // law of 04 §4b.5". They do not: the law is scan_ds / v_max ≤ 0.1 s, so
    // 1.0 m is legal only above 10 m/s, and §4b.5's OWN worked number for
    // book90 is 9.44 m/s ⟹ 0.106 s. `slow_steer` is a witness. The code is
    // faithful to §4b.5 (the normative statement); this case pins the
    // contradiction so the ratification cannot rot.
    const slow = mistakeLine("slow_steer", 34);
    let vMax = 0;
    for (const p of slow.trajectory.samples) vMax = Math.max(vMax, p.v);
    expect(vMax).toBeLessThan(1.0 / HORIZON_TAU_QUANTUM_S); // < 10 m/s
    const r = saveWindow(inputOf(slow), "c1", { scan_ds_m: 1.0 });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect((r.error.detail as Record<string, unknown>)["reason"]).toBe("scan_ds_too_coarse");
    // and the default rung is legal on the very same line
    expect(saveWindow(inputOf(slow), "c1", { scan_ds_m: HORIZON_SCAN_DS_M }).ok).toBe(true);
  }, 300_000);
});

// ---------------------------------------------------------------------------
// Structural laws (04 §4b.5) — disclosure survives every refusal

describe("disclosure survives every refusal (04 §4b.5) and a refusing status carries no scalar", () => {
  it("rider, predicate, policy, status, transition_count, scan_ds_m, eps_s, runs and placard are present on EVERY window", () => {
    for (const line of [oracle90, resolvedOverspeed, resolvedChop]) {
      const all = saveWindow(inputOf(line));
      expect(all.ok).toBe(true);
      if (!all.ok) continue;
      for (const w of all.value) {
        expect(w.rider).toBe("lean_only_reserve");
        expect(w.predicate).toBe("horizon_bounded_return");
        expect(w.policy.basis).toBe("phiReserve(skill·mu)");
        expect(w.policy.a_cmd_ms2).toBe(0);
        expect(SAVE_WINDOW_STATUSES).toContain(w.status);
        expect(Number.isInteger(w.transition_count)).toBe(true);
        expect(w.scan_ds_m).toBe(HORIZON_SCAN_DS_M);
        expect(w.eps_s).toBe(HORIZON_EPS_S);
        expect(w.placard).toBe(SAVE_WINDOW_PLACARD);
      }
    }
  }, 300_000);

  it("P-SAVEWIN-REFUSES — a `never_open` / `intermittent` / `not_applicable` window carries none of the derived scalars", () => {
    const suppressed = ["tau_close_s", "s_close_m", "s_star_m", "reaction_budget_s", "open_at_end"] as const;
    for (const line of [oracle90, resolvedOverspeed, resolvedChop]) {
      const all = saveWindow(inputOf(line));
      expect(all.ok).toBe(true);
      if (!all.ok) continue;
      for (const w of all.value) {
        if (w.status === "resolved" || w.status === "open_at_end") continue;
        for (const k of suppressed) {
          expect(w[k], `${line.line_id}/${w.corner_id} (${w.status}) leaked ${k}`).toBeUndefined();
        }
      }
    }
  }, 300_000);

  it("a `resolved` window's reaction budget is the §4b.6 difference, and its s_close_m is the station at tau_close_s", () => {
    const w = saveWindow(inputOf(resolvedOverspeed), "c1");
    expect(w.ok).toBe(true);
    if (!w.ok) return;
    expect(w.value.status).toBe("resolved");
    expect(w.value.reaction_budget_s).toBeCloseTo(w.value.tau_close_s! - w.value.t_earliest_s!, 12);
    expect(w.value.t_earliest_s).toBeCloseTo(
      Math.max(w.value.t_detect_s!, w.value.t_freeze_end_s ?? Number.NEGATIVE_INFINITY),
      12
    );
    // and the reported closing instant really is the LAST saved one, to eps
    const probe = saveAt(inputOf(resolvedOverspeed), "c1", w.value.tau_close_s!);
    expect(probe.ok).toBe(true);
    if (probe.ok) expect(probe.value.saved).toBe(true);
  }, 300_000);
});

// ---------------------------------------------------------------------------
// The status table's first-match-wins order (04 §4b.5) — pinned against the
// engine so the design-letter conflict cannot rot.

describe("RATIFIED DEFECT — §4b.5's table order reports `never_open` on a scan that demonstrably opened", () => {
  it("F-ORACLE-90's saved(τ) is F…T…F, so the window OPENED — yet the letter's row order classifies it `never_open`", () => {
    const input = inputOf(oracle90);
    const events = oracle90.trajectory.events;
    const turnIn = events.find((e) => e.kind === "turn_in")!;
    const lo = turnIn.t;
    const hi = oracle90.trajectory.terminated.t;

    const verdicts: boolean[] = [];
    for (let i = 0; i <= 30; i++) {
      const r = saveAt(input, "c1", lo + ((hi - lo) * i) / 30);
      expect(r.ok).toBe(true);
      if (r.ok) verdicts.push(r.value.saved);
    }
    // measurement: the window is open over a genuine interior band
    expect(verdicts[0]).toBe(false);
    expect(verdicts.some((v) => v)).toBe(true);
    let transitions = 0;
    for (let i = 0; i + 1 < verdicts.length; i++) if (verdicts[i] !== verdicts[i + 1]) transitions++;
    expect(transitions).toBeGreaterThan(1);

    // the letter: `saved(τ₀) = false → never_open` is row 2 and
    // `transition_count > 1 → intermittent` is row 5, first-match-wins, so
    // `never_open` wins — and with it the five scalars G-SAVEWIN-RUNOFF wants
    // to bless on this very fixture disappear.
    const w = saveWindow(input, "c1");
    expect(w.ok).toBe(true);
    if (!w.ok) return;
    expect(w.value.status).toBe("never_open");
    expect(w.value.transition_count).toBeGreaterThan(1);
    expect(w.value.tau_close_s).toBeUndefined();
    expect(w.value.reaction_budget_s).toBeUndefined();
  }, 300_000);

  it("`intermittent` is consequently UNREACHABLE in this build — its gate G-SAVEWIN-INTERMITTENT cannot be built until the order is ratified", () => {
    // `intermittent` needs verdicts[0] === true AND transition_count ≥ 2. Every
    // probed shape here starts false (an early τ cuts inside and departs), so
    // the branch is dead under the current table order. Recorded, not faked:
    // 09 §8.1 forbids dead branches, and this is the evidence that the branch
    // is dead for a DESIGN reason rather than an implementation one.
    const statuses = new Set<string>();
    for (const line of [oracle90, resolvedOverspeed, resolvedChop]) {
      const all = saveWindow(inputOf(line));
      if (!all.ok) continue;
      for (const w of all.value) statuses.add(w.status);
    }
    expect(statuses.has("intermittent")).toBe(false);
    expect(SAVE_WINDOW_STATUSES).toContain("intermittent"); // declared, unreachable
  }, 300_000);
});

// ---------------------------------------------------------------------------
// A-SAVEWIN-PLACARD, the two non-viewer surfaces (the HUD arm lives in
// test/viewer/hud.test.ts, where the overlay is built).

describe("A-SAVEWIN-PLACARD — no scalar is ever printed without the §4b.7 placard", () => {
  it("the CLI human summary carries the placard byte-identically, and every scalar it prints is display-clamped", () => {
    const w = saveWindow(inputOf(resolvedOverspeed), "c1");
    expect(w.ok).toBe(true);
    if (!w.ok) return;
    const summary = saveWindowSummary(w.value);
    expect(summary).toContain(SAVE_WINDOW_PLACARD);
    expect(summary).toContain("tau_close_s");
    // HORIZON_DISPLAY_DP = 1: every printed second/metre carries exactly one dp
    for (const m of summary.matchAll(/(-?\d+\.\d+) (?:s|m)\b/g)) {
      expect(m[1]!.split(".")[1]!.length, `"${m[0]}" is not clamped to 1 dp`).toBe(1);
    }
  }, 300_000);

  it("a REFUSING window still prints its sentence and its placard — and no scalar", () => {
    const w = saveWindow(inputOf(oracle90), "c1");
    expect(w.ok).toBe(true);
    if (!w.ok) return;
    const summary = saveWindowSummary(w.value);
    expect(summary).toContain(SAVE_WINDOW_STATUS_SENTENCES["never_open"]);
    expect(summary).toContain(SAVE_WINDOW_PLACARD);
    expect(summary).toContain("lean_only_reserve");
    // the placard itself names `tau_close_s` in prose, so the absence is
    // asserted on the SCALAR ROWS, which is where a leak would actually be
    expect(saveWindowScalarLines(w.value)).toEqual([]);
    const scalarRows = summary.split("\n").filter((l) => /^(tau_close_s|s_close_m|s_star_m|reaction budget)/.test(l));
    expect(scalarRows).toEqual([]);
  }, 300_000);

  it("the `save-window` verb really emits that summary on STDERR while stdout stays exactly one JSON document", () => {
    const dir = mkdtempSync(join(tmpdir(), "linelab-placard-"));
    const path = join(dir, "ov.json");
    execFileSync("node", [mainJs, "run", "--road", "preset book90", "--entry", "34", "--turn-in", "auto",
      "--mistake", "overspeed", "--out", path], { cwd: repoRoot, stdio: "ignore" });
    const stderrPath = join(dir, "err.txt");
    const stdout = execFileSync("node", [mainJs, "save-window", path, "--line", "overspeed", "--corner", "c1"],
      { cwd: repoRoot, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    // stdout: exactly one JSON document, nothing else
    expect(stdout.trimEnd().split("\n")).toHaveLength(1);
    const doc = JSON.parse(stdout) as { ok: boolean; value: SaveWindow };
    expect(doc.ok).toBe(true);
    // stderr: the human summary, placard included
    const err = execFileSync(
      "sh",
      ["-c", `node ${JSON.stringify(mainJs)} save-window ${JSON.stringify(path)} --line overspeed --corner c1 2>${JSON.stringify(stderrPath)} >/dev/null`],
      { cwd: repoRoot, encoding: "utf8" }
    );
    void err;
    const summary = readFileSync(stderrPath, "utf8");
    expect(summary).toContain(SAVE_WINDOW_PLACARD);
    expect(summary).toBe(saveWindowSummary(doc.value) + "\n");
    writeFileSync(join(dir, "keep.txt"), "", "utf8");
  }, 180_000);
});
