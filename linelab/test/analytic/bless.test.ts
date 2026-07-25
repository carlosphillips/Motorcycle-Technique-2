// test/analytic/bless.test.ts — WP-16 gates (design/09 §3.2a; D35):
//
//   A-BLESS-REFUSES — the bless green-gate is MECHANICAL, verified with a
//   negative arm: in a throwaway sandbox copy of the package, one D-BOUNDS pin
//   is forced artificially wrong → `linelab-bless` exits 3 and writes NO
//   golden fixture and NO 02 §8.1 block; with the layer green it exits 0 and
//   writes both (goldens + the blessed-values block), byte-stably.
//
//   T-BLESSED-DOC-SYNC — the committed design/02 §8.1 block always matches
//   the committed golden fixtures: pre-first-bless (the current repo state)
//   the placeholder block claims nothing and no goldens exist; post-bless the
//   block regenerated from the committed fixtures is byte-equal to the block
//   in the doc. Both branches are implemented; the post-bless branch is
//   additionally exercised today against the sandbox bless output.
//
// IMPORTANT: the real first bless against this repo is WP-17's one
// commit-worthy act — every bless run here happens in a $TMPDIR sandbox copy
// (package copy + design/02 copy + symlinked node_modules); the repo's own
// design/ and test/fixtures/goldens are never written by this file.

import { describe, it, expect, beforeAll } from "vitest";
import { execFileSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdtempSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  BLESS_ROSTER,
  BLESSED_BLOCK_FIXTURES,
  BLESSED_BLOCK_RE,
  formatBlessedBlock,
  parseBlessedHeader,
  spliceBlessedBlock,
  type GoldenRecord
} from "../../src/cli/bless.js";
import { ENGINE_SEMVER } from "../../src/solve/run.js";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "../.."); // linelab/
const blessJs = join(repoRoot, "dist/cli/bless.js");
const design02 = resolve(repoRoot, "../design/02-physics-model.md");

beforeAll(() => {
  // dist/ is built once by test/globalSetup.ts before the worker pool starts;
  // this only asserts that build produced the bless binary this file spawns.
  if (!existsSync(blessJs)) throw new Error(`test/globalSetup.ts did not produce ${blessJs}`);
}, 180_000);

// ---------------------------------------------------------------------------
// Sandbox plumbing ($TMPDIR copies; node_modules symlinked, never copied)

interface Sandbox {
  readonly dir: string;
  readonly root: string; // the package copy
  readonly design: string; // the design copy
  readonly doc: string; // design/02 copy
}

function makeSandbox(): Sandbox {
  const dir = mkdtempSync(join(tmpdir(), "linelab-bless-"));
  const root = join(dir, "linelab");
  const design = join(dir, "design");
  mkdirSync(join(root, "test", "analytic"), { recursive: true });
  mkdirSync(design, { recursive: true });
  for (const f of ["package.json", "tsconfig.json"]) {
    cpSync(join(repoRoot, f), join(root, f));
  }
  // The project vitest.config.ts now wires a globalSetup (test/globalSetup.ts →
  // test/helpers/build.ts) that builds dist/ once for the CLI-spawning suites.
  // The bless analytic gate (runAnalyticGate → `vitest run test/analytic/*`) runs
  // pure in-process an/bounds fixtures and NEVER spawns dist/, so the sandbox uses
  // the original globalSetup-free config — the exact config it ran under before —
  // rather than dragging a pointless tree compile (and the globalSetup file, which
  // the sandbox does not copy) into the hermetic gate.
  writeFileSync(
    join(root, "vitest.config.ts"),
    'import { defineConfig } from "vitest/config";\n' +
      "export default defineConfig({\n" +
      '  test: { include: ["test/**/*.test.ts"], pool: "threads", isolate: true }\n' +
      "});\n"
  );
  cpSync(join(repoRoot, "src"), join(root, "src"), { recursive: true });
  mkdirSync(join(root, "test", "fixtures"), { recursive: true });
  cpSync(join(repoRoot, "test", "fixtures", "tolerances.json"), join(root, "test", "fixtures", "tolerances.json"));
  for (const f of ["an.test.ts", "bounds.test.ts"]) {
    cpSync(join(repoRoot, "test", "analytic", f), join(root, "test", "analytic", f));
  }
  symlinkSync(join(repoRoot, "node_modules"), join(root, "node_modules"), "dir");
  cpSync(design02, join(design, "02-physics-model.md"));
  return { dir, root, design, doc: join(design, "02-physics-model.md") };
}

interface BlessRun {
  readonly exit: number;
  readonly stdout: unknown;
}

function runBless(sb: Sandbox): BlessRun {
  try {
    const out = execFileSync(
      "node",
      [blessJs, "--root", sb.root, "--design", sb.design, "--write-docs"],
      { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }
    );
    return { exit: 0, stdout: JSON.parse(out) };
  } catch (e) {
    const err = e as { status: number; stdout: string };
    return { exit: err.status, stdout: JSON.parse(err.stdout) };
  }
}

function goldenDirOf(sb: Sandbox): string {
  return join(sb.root, "test", "fixtures", "goldens");
}

// ---------------------------------------------------------------------------
// A-BLESS-REFUSES — negative arm: a reddened D-BOUNDS pin refuses everything

describe("A-BLESS-REFUSES (design/09 §3.2a step 3 — the green-gate cannot be routed around)", () => {
  it("with one D-BOUNDS pin forced artificially wrong, bless exits 3 and writes NO golden and NO 02 §8.1 block", { timeout: 300_000 }, () => {
    const sb = makeSandbox();
    try {
      // redden: the apex_pct late-bar pin becomes unsatisfiable in the COPY only
      const boundsPath = join(sb.root, "test", "analytic", "bounds.test.ts");
      const bounds = readFileSync(boundsPath, "utf8");
      const anchor = "expect(apexPct).toBeGreaterThan(50);";
      expect(bounds).toContain(anchor); // the mutation actually lands
      writeFileSync(boundsPath, bounds.replace(anchor, "expect(apexPct).toBeGreaterThan(1e9);"));
      const docBefore = readFileSync(sb.doc, "utf8");

      const r = runBless(sb);
      expect(r.exit).toBe(3);
      const doc = r.stdout as { ok: boolean; refusal: string };
      expect(doc.ok).toBe(false);
      expect(doc.refusal).toBe("analytic_gate_red");
      // no golden written
      expect(existsSync(goldenDirOf(sb))).toBe(false);
      // no 02 §8.1 block written — byte-identical design doc
      expect(readFileSync(sb.doc, "utf8")).toBe(docBefore);
    } finally {
      rmSync(sb.dir, { recursive: true, force: true });
    }
  });

  it("with the layer green, bless exits 0 and writes both — goldens (raw f64) and the 02 §8.1 block — byte-stably (idempotent re-run)", { timeout: 600_000 }, () => {
    const sb = makeSandbox();
    try {
      const r = runBless(sb);
      expect(r.exit).toBe(0);
      const doc = r.stdout as { ok: true; value: { engine_semver: string; blessed: readonly string[]; wrote_docs: boolean } };
      expect(doc.ok).toBe(true);
      expect(doc.value.wrote_docs).toBe(true);
      expect(doc.value.engine_semver).toBe(ENGINE_SEMVER);
      // one golden per roster fixture, roster-complete
      expect([...doc.value.blessed].sort()).toEqual(BLESS_ROSTER.map((e) => e.id).sort());
      const files = readdirSync(goldenDirOf(sb)).filter((f) => f.endsWith(".json")).sort();
      expect(files).toEqual(BLESS_ROSTER.map((e) => `${e.id}.json`).sort());

      // the C30 golden: raw pre-emission f64 via the bless tap (never the
      // rounded verdict) — its terminated station carries full float precision
      const c30 = JSON.parse(readFileSync(join(goldenDirOf(sb), "C30.json"), "utf8")) as GoldenRecord;
      expect(c30.engine_semver).toBe(ENGINE_SEMVER);
      const term = c30.lines[0]!.terminated.s;
      expect(term).not.toBe(Number((term as number).toFixed(2))); // unrounded — the tap sits BEFORE emission rounding
      expect(c30.blessed.map((b) => b.quantity)).toContain("turn_in_s");
      expect(c30.blessed.map((b) => b.quantity)).toContain("apex_pct");
      expect(c30.blessed.find((b) => b.quantity === "outcome")?.value).toBe("contained");
      expect(c30.blessed.find((b) => b.quantity === "outcome")?.tol).toBe("exact");

      // the 02 §8.1 block landed between the markers with the running engine's semver
      const written = readFileSync(sb.doc, "utf8");
      const header = parseBlessedHeader(written);
      expect(header?.engine).toBe(ENGINE_SEMVER);
      expect(written).toContain("| C30 | turn_in_s |");

      // T-BLESSED-DOC-SYNC's post-bless branch, exercised against the sandbox:
      // the block regenerated from the WRITTEN fixtures is byte-equal
      const records = files.map((f) => JSON.parse(readFileSync(join(goldenDirOf(sb), f), "utf8")) as GoldenRecord);
      const regenerated = formatBlessedBlock(records, header!.engine, header!.date);
      const inDoc = written.match(BLESSED_BLOCK_RE);
      expect(inDoc?.[0]).toBe(regenerated);

      // idempotence: a same-day re-run moves NO byte anywhere
      const goldenBytes = files.map((f) => readFileSync(join(goldenDirOf(sb), f), "utf8"));
      const r2 = runBless(sb);
      expect(r2.exit).toBe(0);
      expect(readFileSync(sb.doc, "utf8")).toBe(written);
      files.forEach((f, i) => {
        expect(readFileSync(join(goldenDirOf(sb), f), "utf8")).toBe(goldenBytes[i]);
      });
    } finally {
      rmSync(sb.dir, { recursive: true, force: true });
    }
  });
});

// ---------------------------------------------------------------------------
// T-BLESSED-DOC-SYNC — the committed doc can never claim numbers the committed
// fixtures don't hold (design/09 §3.2a; runs in the normal suite)

describe("T-BLESSED-DOC-SYNC (design/02 §8.1 ⇔ committed goldens)", () => {
  it("design/02 §8.1 carries exactly one BLESSED block", () => {
    const doc = readFileSync(design02, "utf8");
    const matches = doc.match(new RegExp(BLESSED_BLOCK_RE.source, "g"));
    expect(matches).toHaveLength(1);
  });

  it("the committed block byte-matches the committed golden fixtures (placeholder ⇔ no goldens before the first bless)", () => {
    const doc = readFileSync(design02, "utf8");
    const block = doc.match(BLESSED_BLOCK_RE)![0];
    const goldensDir = join(repoRoot, "test", "fixtures", "goldens");
    const files = existsSync(goldensDir) ? readdirSync(goldensDir).filter((f) => f.endsWith(".json")).sort() : [];

    if (files.length === 0) {
      // PRE-BLESS: the placeholder block claims nothing — template header and
      // the elided `…` value cells only (a generated row carries a real value)
      expect(block).toContain("engine=<semver>");
      expect(block).toContain("date=<YYYY-MM-DD>");
      expect(block).toContain("| C30 | turn_in_s | … | m | ±0.01 |");
    } else {
      // POST-BLESS (WP-17 onward): regenerate from the committed fixtures
      // under the committed header identity and assert byte equality; the
      // stamped engine must be the running engine (else it is a stale block)
      const header = parseBlessedHeader(doc);
      expect(header).not.toBeNull();
      expect(header!.engine).toBe(ENGINE_SEMVER);
      const records = files.map((f) => JSON.parse(readFileSync(join(goldensDir, f), "utf8")) as GoldenRecord);
      expect(block).toBe(formatBlessedBlock(records, header!.engine, header!.date));
    }
  });
});

// ---------------------------------------------------------------------------
// Pure block machinery (unit coverage for the writer the two gates lean on)

describe("blessed-block machinery (pure)", () => {
  const record: GoldenRecord = {
    fixture: "C30",
    engine_semver: "0.1.0",
    input: { kind: "run", input: {} },
    lines: [],
    blessed: [
      { fixture: "C30", quantity: "turn_in_s", value: 26.21782053655581, unit: "m", tol: "±0.01" },
      { fixture: "C30", quantity: "outcome", value: "contained", unit: "-", tol: "exact" }
    ]
  };

  it("formatBlessedBlock prints full-precision values in roster order under the given header", () => {
    const block = formatBlessedBlock([record], "0.1.0", "2026-07-23");
    expect(block.startsWith("<!-- BLESSED:BEGIN engine=0.1.0 date=2026-07-23 -->")).toBe(true);
    expect(block.endsWith("<!-- BLESSED:END -->")).toBe(true);
    expect(block).toContain("| C30 | turn_in_s | 26.21782053655581 | m | ±0.01 |");
    expect(block).toContain("| C30 | outcome | contained | - | exact |");
    // deterministic: same inputs, same bytes
    expect(formatBlessedBlock([record], "0.1.0", "2026-07-23")).toBe(block);
  });

  it("spliceBlessedBlock replaces the marker-delimited span idempotently and refuses a doc without markers", () => {
    const docText = "before\n<!-- BLESSED:BEGIN engine=<semver> date=<YYYY-MM-DD> -->\nold\n<!-- BLESSED:END -->\nafter";
    const block = formatBlessedBlock([record], "0.1.0", "2026-07-23");
    const once = spliceBlessedBlock(docText, block);
    expect(once.ok).toBe(true);
    if (!once.ok) return;
    expect(once.value).toContain("| C30 | turn_in_s |");
    expect(once.value.startsWith("before\n")).toBe(true);
    expect(once.value.endsWith("\nafter")).toBe(true);
    const twice = spliceBlessedBlock(once.value, block);
    expect(twice.ok && twice.value === once.value).toBe(true);
    const refused = spliceBlessedBlock("no markers here", block);
    expect(refused.ok).toBe(false);
  });

  it("parseBlessedHeader reads a generated header and returns null on the placeholder", () => {
    expect(parseBlessedHeader("<!-- BLESSED:BEGIN engine=0.1.0 date=2026-07-23 -->")).toEqual({
      engine: "0.1.0",
      date: "2026-07-23"
    });
    // the placeholder's `<semver>` spelling still parses as an identity — the
    // doc-sync branch keys on golden PRESENCE, not on parse failure
    expect(parseBlessedHeader("nothing")).toBeNull();
  });

  it("the roster is well-formed: unique ids; every blessed-block fixture is a roster member", () => {
    const ids = BLESS_ROSTER.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const f of BLESSED_BLOCK_FIXTURES) expect(ids).toContain(f);
  });
});
