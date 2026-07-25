// test/viewer/overlayHash.test.ts — the D44 OUT-OF-HASH property, proven on a
// corpus rather than assumed.
//
// design/04 §4b intro: "Everything in this section is OUT-OF-HASH, off by
// default, computed on demand, and absent from every committed book scene. No
// verdict member, no check, no exported ink." design/07 §3.5/§3.6 carry the same
// property for the two stepper overlays. The V0.2 gate audit flagged that this
// property, while structurally true, had never been exercised against a real
// envelope: no verb attaches a save-window/ghost scalar, so the sentinel was
// vacuous.
//
// This suite makes it non-vacuous. For every fixture it:
//   1. runs the engine once and records the line's `result_hash` (BEFORE);
//   2. computes BOTH stepper overlays — `saveWindowOverlay` (07 §3.6) and
//      `correctiveGhostOverlay` (07 §3.5) — against that line;
//   3. re-reads the line's `result_hash` (AFTER: the frozen envelope is
//      untouched) AND independently re-runs the engine to confirm the pipeline
//      hash did not move;
//   4. asserts no overlay key leaked into the serialized envelope line.
//
// The before/after table is printed so the proof is auditable from the output.

import { describe, it, expect } from "vitest";
import { loadSession } from "../../src/viewer/session.js";
import { saveWindowOverlay } from "../../src/viewer/saveWindow.js";
import { correctiveGhostOverlay } from "../../src/viewer/correctiveGhost.js";
import { run } from "../../src/solve/run.js";
import type { LineResult } from "../../src/solve/types.js";

interface Fixture {
  readonly name: string;
  readonly spec: Record<string, unknown>;
  /** which line to inspect: the mistake line, or the single line */
  readonly pick: "mistake" | "first";
}

const FIXTURES: readonly Fixture[] = [
  {
    name: "book90 + overspeed (save-window resolves; ghost inert)",
    spec: { road: { preset: "book90" }, entry_kmh: 34, turn_in: "auto", mistake: { kind: "overspeed" } },
    pick: "mistake"
  },
  {
    name: "book90 + premature (save-window never_open; ghost inert)",
    spec: { road: { preset: "book90" }, entry_kmh: 34, turn_in: "auto", mistake: { kind: "premature" } },
    pick: "mistake"
  },
  {
    name: "wide right-hander (ghost draws a WIDE save; save-window scans)",
    spec: {
      spec: "linelab/1",
      id: "wide",
      road: { dsl: "lane 5 | S 20 | R 20 ^90 | S 40" },
      rider: {
        profile: "street",
        start: { speed_kmh: 34, f: 1.0 },
        plan: [{ do: "turn_in", id: "t1", at_s: 20, target: { lean_deg: 20 }, hand: "R" }]
      }
    },
    pick: "first"
  },
  {
    name: "book90 + chop (freeze-carrying mistake)",
    spec: { road: { preset: "book90" }, entry_kmh: 34, turn_in: "auto", mistake: { kind: "chop" } },
    pick: "mistake"
  }
];

function pickLine(session: { lines: readonly LineResult[] }, pick: Fixture["pick"]): LineResult | undefined {
  if (pick === "mistake") return session.lines.find((l) => l.role === "mistake");
  return session.lines[0];
}

/** re-serialize the sealed line and scan for any overlay/attachment key leak. */
function overlayKeyLeaks(line: LineResult): readonly string[] {
  const json = JSON.stringify(line);
  return ["save_window", "saveWindow", "corrective_ghost", "correctiveGhost", "standing", "commitment"].filter((k) =>
    json.includes(`"${k}"`)
  );
}

describe("D44 out-of-hash — computing the stepper overlays never moves result_hash (04 §4b, 07 §3.5/§3.6)", () => {
  const table: { fixture: string; before: string; after: string; rerun: string; sw: string; ghost: string }[] = [];

  for (const fx of FIXTURES) {
    it(fx.name, () => {
      const loaded = loadSession(fx.spec, { engine_semver: "0.1.0" });
      expect(loaded.ok, `${fx.name} must load`).toBe(true);
      if (!loaded.ok) return;
      const line = pickLine(loaded.value, fx.pick);
      expect(line, `${fx.name} produced no target line`).toBeDefined();
      if (line === undefined) return;

      const before = line.verdict.result_hash;
      expect(before).toMatch(/^[0-9a-f]{6}$/);

      // compute BOTH overlays against the frozen line
      const sw = saveWindowOverlay(line);
      const ghost = correctiveGhostOverlay(line);
      expect(sw.ok, "save-window overlay must not error").toBe(true);
      expect(ghost.ok, "corrective ghost overlay must not error").toBe(true);

      // AFTER: the frozen envelope's own stamp is unchanged
      const after = line.verdict.result_hash;
      expect(after, `${fx.name}: result_hash moved after overlay computation`).toBe(before);

      // and re-running the pipeline reproduces the same hash — the overlays are
      // external to it, so they cannot have perturbed it
      const reran = run(fx.spec, { engine_semver: "0.1.0" });
      expect(reran.ok).toBe(true);
      const reranLine = reran.ok ? pickLine(reran.value as never, fx.pick) : undefined;
      const rerun = reranLine?.verdict.result_hash ?? "MISSING";
      expect(rerun, `${fx.name}: fresh re-run hash differs`).toBe(before);

      // no overlay/attachment key leaked into the sealed line
      expect(overlayKeyLeaks(line), `${fx.name}: an overlay key leaked into the envelope`).toEqual([]);

      const swStatus = sw.ok ? sw.value.windows.map((w) => w.status).join("+") || "none" : "err";
      const ghostKind = ghost.ok ? (ghost.value === null ? "inert" : ghost.value.kind) : "err";
      table.push({ fixture: fx.name, before, after, rerun, sw: swStatus, ghost: ghostKind });
    }, 300_000);
  }

  it("prints the before/after result_hash table (out-of-hash, auditable)", () => {
    // this runs after the per-fixture cases in declaration order (pool: threads,
    // isolate: true keeps the closure alive within the file)
    expect(table.length).toBeGreaterThanOrEqual(3);
    // every row is byte-stable across all three reads
    for (const r of table) {
      expect(r.after).toBe(r.before);
      expect(r.rerun).toBe(r.before);
    }
    // eslint-disable-next-line no-console
    console.log(
      "\nD44 out-of-hash — result_hash before/after overlay computation:\n" +
        "fixture".padEnd(52) +
        " | before | after  | re-run | save-window        | ghost\n" +
        "-".repeat(120) +
        "\n" +
        table
          .map(
            (r) =>
              r.fixture.padEnd(52) +
              ` | ${r.before} | ${r.after} | ${r.rerun} | ${r.sw.padEnd(18)} | ${r.ghost}`
          )
          .join("\n") +
        "\n"
    );
  });
});
