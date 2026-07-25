// test/cli/inspection.test.ts — WP v0.2 gate: the `state` and `save-window`
// verbs (design/08 §3 verb table, §4.1's `--s`/`--t`/`--scan-ds`), spawned
// against the built CLI exactly as the other test/cli files do.
//
// What this file demonstrates, end to end, as real usage (not coverage
// theater):
//   - `state`'s `--s <m> | --t <s>` required-one/mutual-exclusion rule is
//     enforced (both AND neither both refuse `SCHEMA/query_exactly_one`,
//     design/05 §4) — enforced ONCE, by `stateAt` itself, not duplicated in
//     the CLI layer (see the doc comment on `ParsedInvocation.s`/`.t` in
//     cli/args.ts).
//   - the universal `--line` selector (design/08 §3.3) on a multi-line
//     envelope with no `--line` given.
//   - `save-window`'s `--corner`/`--scan-ds` flags and its closed status set.
//   - `--scan-ds` is INEFFECTUAL everywhere except `save-window` (D8, the
//     same shape as the already-shipped `--standing`/`check` pairing).
//   - inspection is not a gate: `state`/`save-window` only ever exit
//     {0, 2, 4} — never 3 — across a battery of malformed/refusing calls.
//   - the out-of-hash law (design/05 §6.4, design/04 §4b): calling `state`
//     or `save-window` on an envelope file never writes to that file and
//     never moves any line's `result_hash` — proven by a byte-identical
//     re-read of the file after both verbs have run against it.

import { describe, it, expect, beforeAll } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { saveWindow } from "../../src/solve/saveWindow.js";
import type { LineResult } from "../../src/solve/types.js";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "../.."); // linelab/
const mainJs = join(repoRoot, "dist/cli/main.js");

interface CliResult {
  readonly exit: number;
  readonly stdout: unknown;
}

function spawnCli(args: readonly string[], cwd: string): { readonly exit: number; readonly raw: string } {
  try {
    return { exit: 0, raw: execFileSync("node", [mainJs, ...args], { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }) };
  } catch (e) {
    const err = e as { status: number; stdout: string };
    return { exit: err.status, raw: err.stdout ?? "" };
  }
}

/**
 * Every verb prints exactly ONE JSON document (design/08 §3.2), so EMPTY stdout
 * is never a valid answer. `dist/` is built once by test/globalSetup.ts before
 * the worker pool starts, so a build can no longer race this spawn; empty
 * stdout now means a real bug and fails the case honestly (no retry mask).
 */
function cli(args: readonly string[], cwd = repoRoot): CliResult {
  const r = spawnCli(args, cwd);
  expect(r.raw.trim(), `the CLI produced no stdout for: ${args.join(" ")}`).not.toBe("");
  return { exit: r.exit, stdout: JSON.parse(r.raw) };
}

interface EnvLine {
  readonly line_id: string;
  readonly verdict?: { readonly result_hash: string; readonly corners: readonly { readonly id: string }[] };
}
interface Env {
  readonly lines: readonly EnvLine[];
}

function buildEnvelope(dir: string, name: string, args: readonly string[]): { readonly path: string; readonly env: Env } {
  const path = join(dir, name);
  const r = cli([...args, "--out", path]);
  expect(r.exit, `building fixture ${name}`).toBe(0);
  const env = JSON.parse(readFileSync(path, "utf8")) as Env;
  return { path, env };
}

// ---------------------------------------------------------------------------
// `state`

describe("state verb (design/08 §3, §5's A-STATE-VERB pattern)", () => {
  const dir = mkdtempSync(join(tmpdir(), "linelab-state-"));
  const single = buildEnvelope(dir, "single.json", ["solve", "--road", "preset book90", "--entry", "34", "--turn-in", "auto"]);
  const lineId = single.env.lines[0]!.line_id;

  it("--s resolves a station query", () => {
    const r = cli(["state", single.path, "--line", lineId, "--s", "10"]);
    expect(r.exit).toBe(0);
    const doc = r.stdout as { ok: boolean; value: { sample: { s: number }; derived: { phase: string } } };
    expect(doc.ok).toBe(true);
    expect(doc.value.sample.s).toBeCloseTo(10, 6);
    expect(typeof doc.value.derived.phase).toBe("string");
  });

  it("--t resolves a time query", () => {
    const r = cli(["state", single.path, "--line", lineId, "--t", "0.5"]);
    expect(r.exit).toBe(0);
    const doc = r.stdout as { value: { sample: { t: number } } };
    expect(doc.value.sample.t).toBeCloseTo(0.5, 6);
  });

  it("both --s and --t: SCHEMA/query_exactly_one, exit 2 — the required-one rule", () => {
    const r = cli(["state", single.path, "--line", lineId, "--s", "10", "--t", "0.5"]);
    expect(r.exit).toBe(2);
    const doc = r.stdout as { error: { code: string; detail?: { reason?: string } } };
    expect(doc.error.code).toBe("SCHEMA");
    expect(doc.error.detail?.reason).toBe("query_exactly_one");
  });

  it("neither --s nor --t: the same SCHEMA/query_exactly_one refusal", () => {
    const r = cli(["state", single.path, "--line", lineId]);
    expect(r.exit).toBe(2);
    const doc = r.stdout as { error: { code: string; detail?: { reason?: string } } };
    expect(doc.error.code).toBe("SCHEMA");
    expect(doc.error.detail?.reason).toBe("query_exactly_one");
  });

  it("a query past the trajectory's end is BAD_RANGE, never a silent clamp", () => {
    const r = cli(["state", single.path, "--line", lineId, "--s", "999999"]);
    expect(r.exit).toBe(2);
    const doc = r.stdout as { error: { code: string; detail?: { reason?: string; min?: number; max?: number } } };
    expect(doc.error.code).toBe("BAD_RANGE");
    expect(doc.error.detail?.reason).toBe("query_outside_domain");
    expect(doc.error.detail?.min).toBe(0);
  });

  it("an unknown --line is UNKNOWN_ID naming the available ids", () => {
    const r = cli(["state", single.path, "--line", "not-a-real-line", "--s", "1"]);
    expect(r.exit).toBe(2);
    const doc = r.stdout as { error: { code: string; detail?: { available?: string[] } } };
    expect(doc.error.code).toBe("UNKNOWN_ID");
    expect(doc.error.detail?.available).toEqual([lineId]);
  });

  it("multi-line envelope, no --line: SCHEMA/line_selector_required (design/08 §3.3's universal rule)", () => {
    const multi = buildEnvelope(dir, "multi.json", [
      "run", "--road", "preset book90", "--entry", "34", "--turn-in", "auto", "--mistake", "premature"
    ]);
    expect(multi.env.lines.length).toBeGreaterThan(1);
    const r = cli(["state", multi.path, "--s", "1"]);
    expect(r.exit).toBe(2);
    const doc = r.stdout as { error: { code: string; detail?: { reason?: string } } };
    expect(doc.error.code).toBe("SCHEMA");
    expect(doc.error.detail?.reason).toBe("line_selector_required");
  });

  it("state never exits 3 — inspection is not a gate (05 §4, 08 §3.1)", () => {
    for (const exit of [
      cli(["state", single.path, "--line", lineId]).exit,
      cli(["state", single.path, "--line", lineId, "--s", "999999"]).exit,
      cli(["state", single.path, "--line", "bogus", "--s", "1"]).exit
    ]) {
      expect([0, 2, 4]).toContain(exit);
    }
  });
});

// ---------------------------------------------------------------------------
// `save-window`

describe("save-window verb (design/08 §3, §5's A-SAVEWIN-VERB pattern)", () => {
  const dir = mkdtempSync(join(tmpdir(), "linelab-savewin-"));
  const mistakeFig = buildEnvelope(dir, "mistake.json", [
    "run", "--road", "preset book90", "--entry", "34", "--turn-in", "auto", "--mistake", "premature"
  ]);
  const mistakeLine = mistakeFig.env.lines.find((l) => l.line_id !== mistakeFig.env.lines[0]!.line_id) ?? mistakeFig.env.lines[1]!;
  const cornerId = mistakeLine.verdict!.corners[0]!.id;

  it("returns the closed status set, disclosure fields always present, over every corner when --corner is omitted", () => {
    const r = cli(["save-window", mistakeFig.path, "--line", mistakeLine.line_id]);
    expect(r.exit).toBe(0);
    const doc = r.stdout as { value: readonly { status: string; rider: string; predicate: string; placard: string }[] };
    expect(Array.isArray(doc.value)).toBe(true);
    for (const w of doc.value) {
      expect(["resolved", "open_at_end", "never_open", "intermittent", "not_applicable"]).toContain(w.status);
      expect(w.rider).toBe("lean_only_reserve");
      expect(w.predicate).toBe("horizon_bounded_return");
      expect(w.placard.length).toBeGreaterThan(0);
    }
  });

  it("--corner narrows to one SaveWindow (not an array)", () => {
    const r = cli(["save-window", mistakeFig.path, "--line", mistakeLine.line_id, "--corner", cornerId]);
    expect(r.exit).toBe(0);
    const doc = r.stdout as { value: { corner_id: string; status: string } };
    expect(Array.isArray(doc.value)).toBe(false);
    expect(doc.value.corner_id).toBe(cornerId);
  });

  it("an unknown --corner is UNKNOWN_ID naming the line's actual corners", () => {
    const r = cli(["save-window", mistakeFig.path, "--line", mistakeLine.line_id, "--corner", "not-a-corner"]);
    expect(r.exit).toBe(2);
    const doc = r.stdout as { error: { code: string; detail?: { reason?: string } } };
    expect(doc.error.code).toBe("UNKNOWN_ID");
    expect(doc.error.detail?.reason).toBe("unknown_corner_id");
  });

  it("--scan-ds is accepted here (unlike everywhere else) and threads through", () => {
    // 1 m is coarser than the default (HORIZON_SCAN_DS_M = 0.5 m, design/04
    // §4b.5) but still legal at this fixture's v_max under the resolution
    // law — proves the flag actually reaches saveWindow() rather than being
    // silently ignored in favour of the default.
    const r = cli(["save-window", mistakeFig.path, "--line", mistakeLine.line_id, "--corner", cornerId, "--scan-ds", "1"]);
    expect(r.exit).toBe(0);
    const doc = r.stdout as { value: { scan_ds_m: number } };
    expect(doc.value.scan_ds_m).toBe(1);
  });

  it("--scan-ds is INEFFECTUAL on run/solve/figure — the same shape as --standing/check (D8)", () => {
    for (const verb of ["run", "solve"]) {
      const r = cli([verb, "--road", "preset book90", "--entry", "34", "--turn-in", "auto", "--scan-ds", "1"]);
      expect(r.exit).toBe(2);
      const doc = r.stdout as { error: { code: string; detail?: { reason?: string } } };
      expect(doc.error.code).toBe("INEFFECTUAL");
      expect(doc.error.detail?.reason).toBe("scan_ds_without_save_window");
    }
  });

  it("multi-line envelope, no --line: SCHEMA/line_selector_required", () => {
    const r = cli(["save-window", mistakeFig.path]);
    expect(r.exit).toBe(2);
    const doc = r.stdout as { error: { code: string; detail?: { reason?: string } } };
    expect(doc.error.code).toBe("SCHEMA");
    expect(doc.error.detail?.reason).toBe("line_selector_required");
  });

  it("A-SAVEWIN-VERB — `linelab save-window` stdout BYTE-EQUALS the library `saveWindow` output", () => {
    // design/09 §4: "the A-STATE-VERB pattern". The gate is byte equality of
    // the whole document, not a field-by-field comparison: a verb that added
    // one CLI-only member, dropped one, or reordered keys would still pass a
    // structural check and must fail here.
    const envelope = JSON.parse(readFileSync(mistakeFig.path, "utf8")) as { lines: LineResult[] };
    const line = envelope.lines.find((l) => l.line_id === mistakeLine.line_id)!;
    const lib = saveWindow(
      {
        line_id: line.line_id,
        trajectory: line.trajectory,
        resolved_scenario: line.resolved_scenario,
        verdict: { corners: line.verdict.corners }
      },
      cornerId
    );
    expect(lib.ok).toBe(true);
    if (!lib.ok) return;

    const raw = execFileSync(
      "node",
      [mainJs, "save-window", mistakeFig.path, "--line", mistakeLine.line_id, "--corner", cornerId],
      { cwd: repoRoot, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }
    );
    expect(raw).toBe(JSON.stringify({ ok: true, value: lib.value }) + "\n");

    // and the whole-line (no --corner) form is byte-equal to the array form
    const libAll = saveWindow({
      line_id: line.line_id,
      trajectory: line.trajectory,
      resolved_scenario: line.resolved_scenario,
      verdict: { corners: line.verdict.corners }
    });
    expect(libAll.ok).toBe(true);
    if (!libAll.ok) return;
    const rawAll = execFileSync("node", [mainJs, "save-window", mistakeFig.path, "--line", mistakeLine.line_id], {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"]
    });
    expect(rawAll).toBe(JSON.stringify({ ok: true, value: libAll.value }) + "\n");
  }, 180_000);

  it("save-window never exits 3 — inspection is not a gate", () => {
    for (const exit of [
      cli(["save-window", mistakeFig.path]).exit,
      cli(["save-window", mistakeFig.path, "--line", mistakeLine.line_id, "--corner", "bogus"]).exit,
      cli(["save-window", mistakeFig.path, "--line", "bogus"]).exit
    ]) {
      expect([0, 2, 4]).toContain(exit);
    }
  });
});

// ---------------------------------------------------------------------------
// The out-of-hash law: neither verb writes to the envelope it reads, and
// neither moves a result_hash (design/05 §6.4, design/04 §4b — both analyses
// are pure readers of an already-finished result).

describe("state/save-window are out-of-hash and off by default (05 §6.4, 04 §4b)", () => {
  it("calling state and save-window repeatedly leaves the source envelope file byte-identical and every result_hash unmoved", () => {
    const dir = mkdtempSync(join(tmpdir(), "linelab-hashlaw-"));
    const fig = buildEnvelope(dir, "fig.json", [
      "run", "--road", "preset book90", "--entry", "34", "--turn-in", "auto", "--mistake", "premature"
    ]);
    const before = readFileSync(fig.path, "utf8");
    const hashesBefore = fig.env.lines.map((l) => l.verdict?.result_hash);

    for (const line of fig.env.lines) {
      expect(cli(["state", fig.path, "--line", line.line_id, "--s", "5"]).exit).toBe(0);
      expect(cli(["save-window", fig.path, "--line", line.line_id]).exit).toBe(0);
    }

    const after = readFileSync(fig.path, "utf8");
    expect(after).toBe(before); // byte-identical: neither verb wrote to its own input
    const reread = JSON.parse(after) as Env;
    const hashesAfter = reread.lines.map((l) => l.verdict?.result_hash);
    expect(hashesAfter).toEqual(hashesBefore); // no hash moved
  });
});
