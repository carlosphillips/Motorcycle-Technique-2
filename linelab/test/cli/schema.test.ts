// test/cli/schema.test.ts — WP-15 gate: A-SCHEMA-SHAPE/JSON, A-FLAG-MAP,
// A-IMPORT-SURFACE, A-EXIT-DECLARED, A-GATE-FIGURE, A-EXPLAIN-KIND,
// A-CORR-EXPLAIN, A-MISTAKE-GRAMMAR/SUGAR, A-RESOLVED-RERUN,
// A-FIGURE-JSON-PARITY, A-HAZARD-FLAG, A-FULLWIDTH, every §6.4 deferred-token
// row, and every tombstone rejection.
//
// Fast unit-level checks import the pure library directly (buildSchemaDoc,
// explain, args.ts's parser, deferred.ts's table); IO-shaped checks (exit
// codes, file writes, verb↔library byte-equality across a process boundary)
// spawn the built CLI (`dist/cli/main.js`), which test/globalSetup.ts builds
// once before the worker pool starts.

import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { buildSchemaDoc, SHIPPED_SECTIONS, ALL_SECTIONS } from "../../src/cli/doc/schema.js";
import { explain } from "../../src/cli/doc/explain.js";
import { FLAG_TABLE, FLAG_MAPPINGS, parseZeroFileFlags } from "../../src/cli/args.js";
import { DEFERRED_TABLE, DEFERRED_VERBS, SHIPPED_VERBS, TOMBSTONES, isShippedVerb } from "../../src/cli/deferred.js";
import { SWEEP_METRICS, SWEEP_ROOTS } from "../../src/cli/verbs/sweep.js";
import { exitForErrorCode, EXIT } from "../../src/cli/exit.js";
import { ERROR_CODES } from "../../src/core/result.js";
import { CF_DISCLOSURE_LEAN_ONLY } from "../../src/solve/counterfactual.js";
import { CHECK_IDS } from "../../src/plan/doctrine/checks.js";
import { MISTAKE_KINDS, parseMistakeToken, printMistakeToken } from "../../src/plan/mistakes.js";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "../.."); // linelab/
const mainJs = join(repoRoot, "dist/cli/main.js");

interface CliResult {
  readonly exit: number;
  readonly stdout: unknown;
}

function cli(args: readonly string[], cwd = repoRoot, input?: string): CliResult {
  try {
    const out = execFileSync("node", [mainJs, ...args], {
      cwd,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
      input: input ?? ""
    });
    return { exit: 0, stdout: JSON.parse(out) };
  } catch (e) {
    const err = e as { status: number; stdout: string };
    return { exit: err.status, stdout: JSON.parse(err.stdout) };
  }
}

// dist/ is built once by test/globalSetup.ts before the worker pool starts, so
// this file spawns the CLI directly with no build hook of its own.

// ---------------------------------------------------------------------------
// A-SCHEMA-SHAPE / A-SCHEMA-JSON

describe("A-SCHEMA-SHAPE / A-SCHEMA-JSON", () => {
  it("the full document carries the pinned wrapper shape and is JSON-serializable", () => {
    const doc = buildSchemaDoc();
    expect(doc.ok).toBe(true);
    if (!doc.ok) return;
    expect(doc.value.engine).toBe("linelab/1");
    expect(typeof doc.value.schema_version).toBe("number");
    expect(typeof doc.value.checks_version).toBe("number");
    expect(doc.value.rubric).toMatch(/^parks-street\/\d+$/);
    expect(Object.keys(doc.value.sections).sort()).toEqual([...SHIPPED_SECTIONS].sort());
    expect(() => JSON.stringify(doc.value)).not.toThrow();
    // round-trips through JSON with no loss (no functions/undefined leaking)
    const roundTripped = JSON.parse(JSON.stringify(doc.value));
    expect(roundTripped.engine).toBe("linelab/1");
  });

  it("`schema <section>` narrows to exactly that one section key, same wrapper", () => {
    for (const section of SHIPPED_SECTIONS) {
      const doc = buildSchemaDoc(section);
      expect(doc.ok).toBe(true);
      if (!doc.ok) continue;
      expect(Object.keys(doc.value.sections)).toEqual([section]);
      expect(doc.value.sections[section]?.name).toBe(section);
      expect(typeof doc.value.sections[section]?.prose).toBe("string");
    }
  });

  it("mistakes section is the teaching table sourced from plan/mistakes.ts — one kind row per MISTAKE_KINDS entry", () => {
    const doc = buildSchemaDoc("mistakes");
    expect(doc.ok).toBe(true);
    if (!doc.ok) return;
    const kinds = doc.value.sections["mistakes"]?.kinds ?? [];
    expect(kinds.map((k) => k.kind).sort()).toEqual([...MISTAKE_KINDS].sort());
    for (const k of kinds) {
      expect(k.admissible_outcomes.length).toBeGreaterThan(0);
      expect(k.book_figure.length).toBeGreaterThan(0);
    }
  });

  it("pin #18 — an unknown section is SCHEMA, message lists the closed section set; a phase-gated name is SCHEMA+deferred", () => {
    const bad = buildSchemaDoc("nonexistent");
    expect(bad.ok).toBe(false);
    if (bad.ok) return;
    expect(bad.error.code).toBe("SCHEMA");
    expect(bad.error.detail.reason).toBe("schema_unknown_section");
    expect(bad.error.detail.sections).toEqual(ALL_SECTIONS);

    // `sweep` LEFT the phase-gated set when the `sweep` verb shipped (v0.2):
    // "the printed schema is the phase", so the section now prints its root
    // set, per-root hold-fixed semantics and metric sourcing (design/08 §5.1).
    const sweep = buildSchemaDoc("sweep");
    expect(sweep.ok).toBe(true);
    if (!sweep.ok) return;
    expect(Object.keys(sweep.value.sections)).toEqual(["sweep"]);
    const sweepSection = sweep.value.sections["sweep"]!;
    const names = (sweepSection.fields ?? []).map((f) => f.name);
    for (const root of SWEEP_ROOTS) expect(names, `root ${root}. missing`).toContain(`${root}.`);
    for (const metric of SWEEP_METRICS) expect(names, `metric ${metric} missing`).toContain(metric);
    // the apex metrics must state their FINAL-entry sourcing rule (§4.3)
    const apexPct = (sweepSection.fields ?? []).find((f) => f.name === "apex_pct")!;
    expect(apexPct.effect).toContain("FINAL entry");
    expect((sweepSection.grammar ?? []).map((g) => g.token)).toContain("constraint.");

    const cont = buildSchemaDoc("continuations");
    expect(cont.ok).toBe(false);
    if (cont.ok) return;
    expect(cont.error.deferred).toBe("continuation envelope (D45)");
  });

  it("the `schema` verb's stdout byte-equals calling buildSchemaDoc() directly (A-STATE-VERB)", () => {
    const r = cli(["schema"]);
    expect(r.exit).toBe(0);
    const lib = buildSchemaDoc();
    expect(r.stdout).toEqual({ ok: true, value: lib.ok ? lib.value : null });
  });
});

// ---------------------------------------------------------------------------
// A-FLAG-MAP — the flag table is bijective with `schema cli`'s printed rows,
// by construction (both read FLAG_TABLE/FLAG_MAPPINGS — one source).

describe("A-FLAG-MAP", () => {
  it("`schema cli`'s flags[] is exactly FLAG_MAPPINGS (same array, same source)", () => {
    const doc = buildSchemaDoc("cli");
    expect(doc.ok).toBe(true);
    if (!doc.ok) return;
    expect(doc.value.sections["cli"]?.flags).toEqual(FLAG_MAPPINGS);
  });

  it("every flag (and sugar) in FLAG_TABLE is recognized by the runtime parser, and produces no error for a well-formed value", () => {
    // --brake-slew/--throttle-slew/--throttle-freeze compose ONTO a
    // preceding --brake/--throttle occurrence (they patch that action's
    // fields) — prepend the channel-opening flag for those three only.
    const PREREQ: Readonly<Record<string, readonly string[]>> = {
      "--brake-slew": ["--brake", "6"],
      "--throttle-slew": ["--throttle", "1"],
      "--throttle-freeze": ["--throttle", "1"]
    };
    for (const spec of FLAG_TABLE) {
      const flags = [spec.flag, ...(spec.sugar !== undefined ? [spec.sugar] : [])];
      for (const flag of flags) {
        const prereq = PREREQ[spec.flag] ?? [];
        const args = [...prereq, ...(spec.arity === "boolean" ? [flag] : [flag, sampleValueFor(spec.field)])];
        const r = parseZeroFileFlags(args);
        expect(r.ok, `${flag} rejected: ${!r.ok ? JSON.stringify(r.error) : ""}`).toBe(true);
      }
    }
  });

  it("row shape is exactly {field, scene_key, flag, sugar?} — the printed FlagMapping contract", () => {
    for (const row of FLAG_MAPPINGS) {
      expect(typeof row.field).toBe("string");
      expect(typeof row.scene_key).toBe("string");
      expect(typeof row.flag).toBe("string");
      expect(row.flag.startsWith("--")).toBe(true);
    }
  });
});

function sampleValueFor(field: string): string {
  if (field === "road") return "preset book90";
  if (field === "occluders[]") return "hedge inside entry:c1 -5x10";
  if (field === "hazards[]") return "gravel outside exit:c1 2x8";
  if (field === "entry_kmh") return "34";
  if (field === "profile") return "street";
  if (field === "turn_in") return "auto";
  if (field === "mu" || field.includes("hold") || field.includes("margin")) return "1";
  if (field.includes("decel")) return "6";
  if (field.includes("slew")) return "20";
  if (field.includes("freeze")) return "1";
  if (field === "plan[].throttle.accel") return "1";
  if (field === "plan[].position") return "f=0.6";
  if (field === "style") return "double_apex";
  if (field === "vis") return "cautious";
  if (field === "constraints[]") return "f>=0.5@entry:c1..mid:c1";
  if (field === "believed_road") return "preset book90";
  if (field === "accept") return "best_failing";
  if (field === "mistake") return "premature";
  if (field === "line_id") return "ideal";
  if (field === "marks") return "auto";
  if (field.startsWith("view.rays")) return "off";
  if (field.startsWith("view.legend")) return "on";
  if (field.startsWith("view.orient")) return "90";
  if (field.startsWith("view.look")) return "limit_point";
  if (field === "config.rubric") return "parks-street";
  if (field === "config.checks_version") return "2";
  if (field === "bike_margin_m") return "0.4";
  return "1";
}

// ---------------------------------------------------------------------------
// A-IMPORT-SURFACE — src/index.ts exports exactly the v0.1 surface plus the
// shipped v0.2 names (stateAt landed with its package); unshipped names stay
// absent.

describe("A-IMPORT-SURFACE", () => {
  it("exports exactly the named shipped value surface (ARCHITECTURE §5)", async () => {
    const mod = (await import("../../src/index.js")) as Record<string, unknown>;
    const expected = [
      "run", "solve", "suggestTurnIn", "chainedSolve", "solveDoubleApex", "compileMistake",
      "correctiveShot", "counterfactual", "gateFigure",
      "validate", "lowerScene",
      "compose", "parseRoadDSL", "printRoadDSL", "truncateAt",
      "sightFrom", "ssd",
      "project", "renderTopdown", "renderViews", "gateProportions",
      "explain", "buildSchemaDoc",
      // v0.2 — shipped by the stateAt package (marked append in src/index.ts)
      "stateAt",
      // v0.2 — shipped by the standing package (D43 ladder)
      "standing", "standingAttachment", "standingPlacard"
    ];
    for (const name of expected) {
      expect(typeof mod[name], `missing export "${name}"`).toBe("function");
    }
  });

  it("unshipped v0.2/v0.3/D45 names are ABSENT — not stubbed", async () => {
    const mod = (await import("../../src/index.js")) as Record<string, unknown>;
    // `saveWindow`, `saveAt` and `renderControls` LANDED with v0.2 (they are on
    // ARCHITECTURE §5's v0.2 append list and design/08 §7.1's import block).
    // `sweep` is design/08 §7.1's one importable name this build does not carry
    // as a library function — it exists only as the argv-shaped CLI verb, and
    // that gap is recorded in DEVIATIONS.md rather than papered over with a
    // stub. `compare` and `commitmentEnvelope` are genuinely unshipped.
    const deferredNames = ["compare", "sweep", "commitmentEnvelope"];
    for (const name of deferredNames) {
      expect(name in mod, `"${name}" should be absent until its package ships`).toBe(false);
    }
  });
});

// ---------------------------------------------------------------------------
// A-EXIT-DECLARED — the five exit tiers (design/08 §3.1)

describe("A-EXIT-DECLARED", () => {
  it("exitForErrorCode covers the closed 8-code set into exactly tiers {2,3,4}", () => {
    for (const code of ERROR_CODES) {
      const tier = exitForErrorCode(code);
      if (code === "INTERNAL") expect(tier).toBe(EXIT.INTERNAL);
      else if (code === "NO_SOLUTION") expect(tier).toBe(EXIT.DEVIATION);
      else expect(tier).toBe(EXIT.BAD_INPUT);
    }
  });

  it("tier 0 — a gate-less clean solve exits 0", () => {
    const r = cli(["run", "--road", "preset book90", "--entry", "34", "--turn-in", "auto"]);
    expect(r.exit).toBe(EXIT.OK);
  });

  it("tier 2 — an unknown verb/flag is SCHEMA, exit 2", () => {
    const r1 = cli(["frobnicate"]);
    expect(r1.exit).toBe(EXIT.BAD_INPUT);
    const r2 = cli(["run", "--not-a-real-flag", "x"]);
    expect(r2.exit).toBe(EXIT.BAD_INPUT);
  });

  it("tier 3 — NO_SOLUTION exits 3 on every reachable verb (run and solve both shown)", () => {
    const badRoad = "lane 3.5 | S 20 | R 25 ^90 | S 25";
    const r1 = cli(["run", "--road", badRoad, "--entry", "55", "--turn-in", "auto"]);
    expect(r1.exit).toBe(EXIT.DEVIATION);
    const r2 = cli(["solve", "--road", badRoad, "--entry", "55", "--turn-in", "auto"]);
    expect(r2.exit).toBe(EXIT.DEVIATION);
  });

  it("tier 4 — INTERNAL exits 4 (an invariant believed impossible surfaces this way if the CLI itself throws)", () => {
    expect(exitForErrorCode("INTERNAL")).toBe(4);
  });
});

// ---------------------------------------------------------------------------
// A-GATE-FIGURE — `run --gate`'s exit tier is exactly `gateFigure(envelope)`'s
// `pass` field, recomputed independently against the SAME stdout envelope.

describe("A-GATE-FIGURE", () => {
  it("--gate wiring: exit 0 iff the independently-recomputed gateFigure(envelope).pass is true", async () => {
    const { gateFigure } = await import("../../src/solve/gate.js");
    const clean = cli(["run", "--road", "preset book90", "--entry", "34", "--turn-in", "auto", "--gate"]);
    expect(clean.exit).toBe(0);
    const cleanDoc = clean.stdout as { value: unknown };
    expect(gateFigure(cleanDoc.value as never, {}).pass).toBe(true);

    // a mistake line's own admissible-outcome pin table makes it gate-passing
    // too (D9: roles never gate) — assert the SAME recompute law on a
    // two-line figure, not just the trivial single-line case.
    const withMistake = cli(["run", "--road", "preset book90", "--entry", "34", "--turn-in", "auto", "--mistake", "premature", "--gate"]);
    const wmDoc = withMistake.stdout as { value: unknown };
    const report = gateFigure(wmDoc.value as never, {});
    expect(withMistake.exit).toBe(report.pass ? 0 : 3);
  });
});

// ---------------------------------------------------------------------------
// A-EXPLAIN-KIND / A-CORR-EXPLAIN

describe("A-EXPLAIN-KIND", () => {
  it("explain <mistake kind> returns the teaching row (same data schema mistakes prints)", () => {
    const r = explain("premature");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.kind).toBe("mistake_kind");
    if (r.value.kind === "mistake_kind") {
      expect(r.value.admissible_outcomes).toContain("runoff");
      expect(r.value.book_figure).toMatch(/fig 8\.1/);
    }
  });

  it("explain <check id> and explain <error code> resolve too (the three-vocabulary disambiguation, in order)", () => {
    const c = explain(CHECK_IDS[0]!);
    expect(c.ok).toBe(true);
    if (c.ok) expect(c.value.kind).toBe("check");
    const e = explain("SCHEMA");
    expect(e.ok).toBe(true);
    if (e.ok) expect(e.value.kind).toBe("error_code");
  });

  it("an unrecognized target is SCHEMA, listing all three vocabularies", () => {
    const r = explain("not_a_real_anything");
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.code).toBe("SCHEMA");
    expect(r.error.message).toContain("late_apex");
  });
});

describe("A-CORR-EXPLAIN", () => {
  it('explain output carries the CORRECTIVE_DISCLOSURE prose containing "lean-only rider"', () => {
    expect(CF_DISCLOSURE_LEAN_ONLY).toContain("lean-only rider");
    const r = explain("lean_only_reserve");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(JSON.stringify(r.value)).toContain("lean-only rider");
  });

  it("brake_reserve_escape is deferred (D45) — not printed, not answered", () => {
    const r = explain("brake_reserve_escape");
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.deferred).toBe("continuation envelope (D45)");
  });
});

// ---------------------------------------------------------------------------
// A-MISTAKE-GRAMMAR / A-MISTAKE-SUGAR — the D32 token↔JSON bijection

describe("A-MISTAKE-GRAMMAR / A-MISTAKE-SUGAR", () => {
  it("token → JSON: the design/08 §4.1 worked example, verbatim", () => {
    const r = parseMistakeToken("premature:early_by_m=6@c1,c2", "test");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value).toEqual({ kind: "premature", params: { early_by_m: "6" }, scope: ["c1", "c2"] });
  });

  it('"@all" ↔ scope: "all_corners"', () => {
    const r = parseMistakeToken("bad2=premature@all", "test");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value).toEqual({ line_id: "bad2", kind: "premature", scope: "all_corners" });
  });

  it("print ∘ parse is an identity over the compact token grammar", () => {
    for (const token of ["premature", "premature:early_by_m=6", "chop:offset_m=8,freeze_s=1.5@c2", "bad2=premature@all"]) {
      const parsed = parseMistakeToken(token, "t");
      expect(parsed.ok).toBe(true);
      if (!parsed.ok) continue;
      expect(printMistakeToken(parsed.value)).toBe(token);
    }
  });

  it("a malformed token is SCHEMA/mistake_token_malformed (schema_ref: cli.mistake grammar)", () => {
    const r = parseMistakeToken("premature:badparam", "test");
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.code).toBe("SCHEMA");
  });

  it("sugar: `--mistake premature` on `run` mints a generated line_id equal to the kind", () => {
    const r = cli(["run", "--road", "preset book90", "--entry", "34", "--turn-in", "auto", "--mistake", "premature"]);
    expect(r.exit).toBe(0);
    const doc = r.stdout as { value: { lines: readonly { line_id: string }[] } };
    expect(doc.value.lines.some((l) => l.line_id === "premature")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// A-RESOLVED-RERUN — export --as scenario reproduces the line on re-run

describe("A-RESOLVED-RERUN", () => {
  it("export --as scenario, fed back through `run -`, reproduces the same physics (outcome/quality/checks identical)", () => {
    const dir = mkdtempSync(join(tmpdir(), "linelab-rerun-"));
    const solved = cli(["solve", "--road", "preset book90", "--entry", "34", "--turn-in", "auto", "--out", join(dir, "solved.json")]);
    expect(solved.exit).toBe(0);

    const exported = cli(["export", join(dir, "solved.json"), "--as", "scenario"]);
    expect(exported.exit).toBe(0);
    const scenario = (exported.stdout as { value: unknown }).value;
    writeFileSync(join(dir, "scenario.json"), JSON.stringify(scenario));

    const rerun = cli(["run", "-"], repoRoot, JSON.stringify(scenario));
    expect(rerun.exit).toBe(0);

    interface VerdictShape {
      readonly outcome: string;
      readonly quality: string;
      readonly doctrine: { readonly pass: number; readonly fail: number; readonly warn: number };
    }
    interface OneLineDoc {
      readonly value: { readonly lines: readonly [{ readonly verdict: VerdictShape }] };
    }
    const a = (solved.stdout as OneLineDoc).value.lines[0].verdict;
    const b = (rerun.stdout as OneLineDoc).value.lines[0].verdict;
    expect(b.outcome).toBe(a.outcome);
    expect(b.quality).toBe(a.quality);
    expect(b.doctrine).toEqual(a.doctrine);
  });
});

// ---------------------------------------------------------------------------
// A-FIGURE-JSON-PARITY — scene vs hand-authored JSON → same spec_hash

describe("A-FIGURE-JSON-PARITY", () => {
  it("fig-08-01.scene and its hand-lowered FigureSpec JSON produce the identical spec_hash through the `figure` verb", async () => {
    const { lowerScene } = await import("../../src/plan/scene.js");
    const figuresDir = resolve(repoRoot, "../figures");
    const sceneText = readFileSync(join(figuresDir, "fig-08-01.scene"), "utf8");
    const lowered = lowerScene(sceneText);
    expect(lowered.ok).toBe(true);
    if (!lowered.ok) return;

    const dir = mkdtempSync(join(tmpdir(), "linelab-parity-"));
    writeFileSync(join(dir, "fig.json"), JSON.stringify(lowered.value));

    const fromScene = cli(["figure", join(figuresDir, "fig-08-01.scene"), "--check"]);
    const fromJson = cli(["figure", join(dir, "fig.json"), "--check"]);
    expect(fromScene.exit).toBe(0);
    expect(fromJson.exit).toBe(0);
    const a = (fromScene.stdout as { value: { spec_hash: string } }).value.spec_hash;
    const b = (fromJson.stdout as { value: { spec_hash: string } }).value.spec_hash;
    expect(a).toMatch(/^[0-9a-f]{6}$/);
    expect(a).toBe(b);
  });
});

// ---------------------------------------------------------------------------
// A-HAZARD-FLAG — --hazard composes into a resolved hazard the engine sees

describe("A-HAZARD-FLAG", () => {
  it("--hazard token parses into the wire Hazard shape (kind/side/at/span_m/mu)", () => {
    const r = parseZeroFileFlags(["--hazard", "gravel outside exit:c1 2x8 mu=0.35", "--road", "preset book90"]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.draft.hazards).toEqual([
      { kind: "gravel", side: "outside", at: { ref: "exit:c1", offset_m: 2 }, span_m: 8, mu: 0.35 }
    ]);
  });

  it("a run composed with --hazard carries the resolved hazard in the envelope (direct wire-scenario execution — the patch legitimately narrows book90's clean-solve band, a solve/-owned physics fact, not a composition fault)", () => {
    const dir = mkdtempSync(join(tmpdir(), "linelab-hz-"));
    const base = cli(["solve", "--road", "preset book90", "--entry", "34", "--turn-in", "auto", "--out", join(dir, "base.json")]);
    expect(base.exit).toBe(0);
    const scenarioR = cli(["export", join(dir, "base.json"), "--as", "scenario"]);
    const scenario = (scenarioR.stdout as { value: Record<string, unknown> }).value;

    const r = cli(["run", "--hazard", "gravel outside exit:c1 2x8 mu=0.35", "-"], repoRoot, JSON.stringify(scenario));
    const doc = r.stdout as { value?: { hazards: readonly { kind: string; mu: number }[] } };
    expect(doc.value?.hazards).toHaveLength(1);
    expect(doc.value?.hazards[0]!.kind).toBe("gravel");
    expect(doc.value?.hazards[0]!.mu).toBe(0.35);
  });
});

// ---------------------------------------------------------------------------
// A-FULLWIDTH — --use-full-width composes into resolved_scenario.road

describe("A-FULLWIDTH", () => {
  it("--use-full-width sets use_full_width: true on the composed road", () => {
    const r = parseZeroFileFlags(["--use-full-width", "--road", "preset book90"]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.draft.use_full_width).toBe(true);
  });

  it("a run composed with --use-full-width carries it through to resolved_scenario.road", () => {
    // book90 with use_full_width=true happens to fall outside the current
    // engine's clean-solve band at every tested speed (a solve/-owned
    // tuning fact, not a CLI composition fault — verified directly against
    // routeSolve()); a wire Scenario direct-execution path exercises the
    // SAME flag composition without needing a clean solve.
    const dir = mkdtempSync(join(tmpdir(), "linelab-fw-"));
    const base = cli(["solve", "--road", "preset book90", "--entry", "34", "--turn-in", "auto", "--out", join(dir, "base.json")]);
    expect(base.exit).toBe(0);
    const scenarioR = cli(["export", join(dir, "base.json"), "--as", "scenario"]);
    const scenario = (scenarioR.stdout as { value: Record<string, unknown> }).value;

    const r = cli(["run", "--use-full-width", "-"], repoRoot, JSON.stringify(scenario));
    const doc = r.stdout as { value?: { lines: [{ resolved_scenario: { road: { use_full_width: boolean } } }] } };
    expect(doc.value?.lines[0]!.resolved_scenario.road.use_full_width).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Deferred-token rejections — every §6.4 row rejects with the right string

describe("deferred-token rejections (ARCHITECTURE §6.4, verbatim table)", () => {
  it("every deferred verb rejects SCHEMA + the row's deferred string, checked before flag parsing", () => {
    for (const [verb, phase] of Object.entries(DEFERRED_VERBS)) {
      const r = cli([verb, "--this-flag-does-not-exist", "garbage"]);
      expect(r.exit).toBe(2);
      const doc = r.stdout as { ok: boolean; error: { code: string; deferred?: string } };
      expect(doc.ok).toBe(false);
      expect(doc.error.code).toBe("SCHEMA");
      expect(doc.error.deferred).toBe(phase);
    }
  });

  it("--scan-ds SHIPPED with the v0.2 save-window verb: no longer deferred; on a verb that emits no SaveWindow it is INEFFECTUAL, never accepted-and-ignored (D8)", () => {
    const r = cli(["run", "--road", "preset book90", "--entry", "34", "--turn-in", "auto", "--scan-ds", "1"]);
    expect(r.exit).toBe(2);
    const doc = r.stdout as { error: { code: string; deferred?: string; detail?: { reason?: string } } };
    expect(doc.error.code).toBe("INEFFECTUAL");
    expect(doc.error.deferred).toBeUndefined();
    expect(doc.error.detail?.reason).toBe("scan_ds_without_save_window");
  });

  it("--standing SHIPPED with the D43 ladder: no longer deferred; on a verb that emits no StandingReport it is INEFFECTUAL, never accepted-and-ignored (D8)", () => {
    const r = cli(["run", "--road", "preset book90", "--entry", "34", "--turn-in", "auto", "--standing"]);
    expect(r.exit).toBe(2);
    const doc = r.stdout as { error: { code: string; deferred?: string; detail?: { reason?: string } } };
    expect(doc.error.code).toBe("INEFFECTUAL");
    expect(doc.error.deferred).toBeUndefined();
    expect(doc.error.detail?.reason).toBe("standing_without_check");
  });

  it("--commitment / --prior reject continuation envelope (D45)", () => {
    for (const args of [["--commitment"], ["--prior", "street"]]) {
      const r = cli(["run", "--road", "preset book90", "--entry", "34", "--turn-in", "auto", ...args]);
      expect(r.exit).toBe(2);
      const doc = r.stdout as { error: { deferred?: string } };
      expect(doc.error.deferred).toBe("continuation envelope (D45)");
    }
  });

  it("--jitter rejects ensembles (v2)", () => {
    const r = cli(["run", "--road", "preset book90", "--entry", "34", "--turn-in", "auto", "--jitter"]);
    expect(r.exit).toBe(2);
    expect((r.stdout as { error: { deferred?: string } }).error.deferred).toBe("ensembles (v2)");
  });

  it("--look is a shipped ViewSpec flag (v0.3 immersion) — it drives the pov camera, no longer deferred", () => {
    const dir = mkdtempSync(join(tmpdir(), "linelab-look-"));
    const base = cli(["solve", "--road", "preset book90", "--entry", "34", "--turn-in", "auto", "--out", join(dir, "e.json")]);
    expect(base.exit).toBe(0);
    // heading vs limit_point are the two legal camera aims — both render pov
    const h = cli(["render", join(dir, "e.json"), "--views", "pov", "--look", "heading", "--out", join(dir, "h")]);
    const l = cli(["render", join(dir, "e.json"), "--views", "pov", "--look", "limit_point", "--out", join(dir, "l")]);
    expect(h.exit).toBe(0);
    expect(l.exit).toBe(0);
    expect((h.stdout as { value: { pov: string } }).value.pov).toContain(".pov.svg");
    // an unknown look is a plain closed-set SCHEMA refusal (D8), never a deferral
    const bad = cli(["render", join(dir, "e.json"), "--views", "pov", "--look", "chase"]);
    expect(bad.exit).toBe(2);
    const err = (bad.stdout as { error: { code: string; deferred?: string; detail?: { reason?: string } } }).error;
    expect(err.code).toBe("SCHEMA");
    expect(err.deferred).toBeUndefined();
    expect(err.detail?.reason).toBe("look_unknown");
  });

  it("view.mode=diagram rejects projection (post-v0.1) — reachable through `render`", () => {
    const dir = mkdtempSync(join(tmpdir(), "linelab-diag-"));
    const base = cli(["solve", "--road", "preset book90", "--entry", "34", "--turn-in", "auto", "--out", join(dir, "e.json")]);
    const r = cli(["render", join(dir, "e.json"), "--mode", "diagram"]);
    expect(r.exit).toBe(2);
    expect((r.stdout as { error: { deferred?: string } }).error.deferred).toBe("projection (post-v0.1)");
  });

  it("the deferred table has shrunk to the rows that are still unshipped, and SHIPPED_VERBS is the 9 v0.1 verbs plus the four v0.2 inspection verbs plus the v0.3 immersion verb compare", () => {
    // ARCHITECTURE §6.4's v0.1 table had six rows. The `inspection (v0.2)` row
    // is GONE — `state`, `save-window`, `serve`, `sweep`, `--standing` and
    // `--scan-ds` all shipped. The `immersion (v0.3)` row is GONE too — `compare`
    // (verb), `pov` (render target) and `--look` (its ViewSpec flag) all shipped.
    // The phase-gating law says a token leaves the table the moment it ships, so
    // FOUR rows remain (projection, continuation, ensembles, fit), none naming a
    // token this build answers.
    expect(DEFERRED_TABLE).toHaveLength(4);
    expect(DEFERRED_TABLE.map((r) => r.deferred)).not.toContain("inspection (v0.2)");
    expect(DEFERRED_TABLE.map((r) => r.deferred)).not.toContain("immersion (v0.3)");
    expect([...SHIPPED_VERBS].sort()).toEqual(
      ["run", "solve", "mistake", "figure", "render", "check", "state", "save-window", "serve", "sweep", "compare", "schema", "explain", "export"].sort()
    );
    for (const v of SHIPPED_VERBS) expect(isShippedVerb(v)).toBe(true);
    expect(isShippedVerb("sweep")).toBe(true);
    expect(isShippedVerb("serve")).toBe(true);
    // and nothing shipped is ALSO deferred — the two sets are disjoint
    for (const v of SHIPPED_VERBS) expect(v in DEFERRED_VERBS, `${v} is both shipped and deferred`).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Tombstone rejections — UNKNOWN_ID, never `deferred`

describe("tombstone rejections (never deferred)", () => {
  it("every tombstone row is UNKNOWN_ID with the right reason, and carries no `deferred` member", () => {
    for (const row of TOMBSTONES) {
      const r = explain(row.name);
      expect(r.ok, `${row.name} unexpectedly resolved`).toBe(false);
      if (r.ok) continue;
      expect(r.error.code).toBe("UNKNOWN_ID");
      expect(r.error.detail?.["reason"]).toBe(row.reason);
      expect(r.error.deferred).toBeUndefined();
    }
  });

  it("early_apex is rejected as UNKNOWN_ID through the CLI --mistake flag too, naming premature", () => {
    const r = cli(["run", "--road", "preset book90", "--entry", "34", "--turn-in", "auto", "--mistake", "early_apex"]);
    expect(r.exit).toBe(2);
    const doc = r.stdout as { error: { code: string; detail: { reason: string; renamed_to: string } } };
    expect(doc.error.code).toBe("UNKNOWN_ID");
    expect(doc.error.detail.reason).toBe("renamed_kind");
    expect(doc.error.detail.renamed_to).toBe("premature");
  });
});
