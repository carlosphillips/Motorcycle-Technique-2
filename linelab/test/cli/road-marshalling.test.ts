// test/cli/road-marshalling.test.ts — the envelope→corridor marshalling rule.
//
// THE DEFECT THIS FILE EXISTS FOR. `bike_margin_m` and `use_full_width` are
// corridor parameters that design/03 §2 makes deliberately NOT DSL-expressible
// ("`bike_margin_m`, `use_full_width`, `ds_m` deliberately NOT DSL-expressible"),
// and the road DSL string carries neither: `lane 3.5 | S 12 | L 12 ^90 | S 16`
// is the same string at every margin and at both corridor modes. So a verb that
// reloads an envelope's road by re-`compose()`ing the disclosed `dsl` ALONE
// silently rebuilds a DIFFERENT corridor from the one the engine rode, and every
// `f` it recomputes against that corridor is wrong — `state`'s interpolated
// `sample.f`, `render`'s ink, `export`'s re-emitted spec.
//
// WHY THE EXISTING GATES CANNOT SEE IT — and what this file does instead.
// `A-STATE-VERB` compares the verb against the library `stateAt` on the SAME
// `StateAtInput`; when the marshalling is wrong, both sides get the same wrong
// road and agree perfectly. `test/contract/stateAt.test.ts` builds its own road
// and never runs the verb. Neither can fail. The assertion below is therefore
// deliberately NOT a verb-vs-library comparison: it is an INTRINSIC property of
// the verb's own output, checkable with no second implementation —
//
//   f is recomputed from the corridor algebra at `stateAt`, never lerped
//   (ARCHITECTURE §9.9), from an offset blended between two recorded samples
//   0.5 m apart. Under the corridor that produced those samples, the answer
//   must therefore land BETWEEN the two bracketing samples' own recorded `f`.
//   Under a foreign corridor it does not — `f` is rescaled by the corridor
//   width (design/03 §2: "everything reading `f` rescales together with the
//   corridor"), so the interpolated value leaves its own bracket almost
//   everywhere.
//
// Measured, this machine: under the disclosed corridor, 0 / 995 probes leave
// their bracket (max overshoot exactly 0.0). Under the dsl-only corridor,
// 881 / 995 leave it, by as much as 1.047 lane-fractions.
//
// The mutation arm proves the census is SENSITIVE to exactly the two dropped
// fields: it strips `bike_margin_m`/`use_full_width` from the envelope JSON —
// leaving the verb, the query and the `dsl` untouched — which is precisely what
// the dsl-only marshalling saw, and demands that the census then FAIL.

import { describe, it, expect, beforeAll } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { stateVerb } from "../../src/cli/verbs/state.js";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "../..");
const mainJs = join(repoRoot, "dist/cli/main.js");

interface CliResult {
  readonly exit: number;
  readonly raw: string;
  readonly stdout: unknown;
}

function spawnCli(args: readonly string[]): { readonly exit: number; readonly raw: string } {
  try {
    return { exit: 0, raw: execFileSync("node", [mainJs, ...args], { cwd: repoRoot, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }) };
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
function cli(args: readonly string[]): CliResult {
  const r = spawnCli(args);
  expect(r.raw.trim(), `the CLI produced no stdout for: ${args.join(" ")}`).not.toBe("");
  return { exit: r.exit, raw: r.raw, stdout: JSON.parse(r.raw) };
}

interface Sample {
  readonly s: number;
  readonly f: number;
}
interface Envelope {
  readonly figure_id: string;
  readonly road: { dsl: string; lane_width_m: number; bike_margin_m: number; use_full_width: boolean };
  readonly lines: readonly { readonly line_id: string; readonly trajectory: { readonly samples: readonly Sample[] } }[];
}

const dir = mkdtempSync(join(tmpdir(), "linelab-roadmarshal-"));

interface Fixture {
  readonly path: string;
  readonly text: string;
  readonly env: Envelope;
}

function build(name: string, args: readonly string[]): Fixture {
  const path = join(dir, name);
  const r = cli([...args, "--out", path]);
  expect(r.exit, `building fixture ${name}: ${r.raw}`).toBe(0);
  const text = readFileSync(path, "utf8");
  return { path, text, env: JSON.parse(text) as Envelope };
}

// ---------------------------------------------------------------------------
// The two fixtures the corridor law actually distinguishes: one that moves the
// corridor MODE (`use_full_width`) and one that moves its INSET (`bike_margin`).
// Both build in one CLI call, both solve clean, and the DSL string of each is
// byte-identical to the one a default-corridor run would carry. Built in a
// hook against the `dist/` that test/globalSetup.ts built once before the
// worker pool started — no test file ever writes `dist/` during the run.

let FW: Fixture;
let BM: Fixture;
let DEFAULT: Fixture;

beforeAll(() => {
  FW = build("full-width.json", ["solve", "--road", "preset bookDecreasing", "--entry", "30", "--turn-in", "auto", "--use-full-width"]);
  BM = build("bike-margin.json", ["solve", "--road", "preset book90", "--entry", "34", "--turn-in", "auto", "--bike-margin", "0.9"]);
  DEFAULT = build("default.json", ["solve", "--road", "preset book90", "--entry", "34", "--turn-in", "auto"]);
}, 180_000);

/** Interior probe fractions per sample bracket — "many stations", not just midpoints. */
const PROBE_FRACTIONS = [0.1, 0.25, 0.5, 0.75, 0.9] as const;
const EPS = 1e-9;

interface Census {
  readonly probes: number;
  readonly outside: number;
  readonly maxOvershoot: number;
  readonly worst: string;
}

/**
 * Query the `state` VERB at `PROBE_FRACTIONS` interior stations of every sample
 * bracket and count how often the answer leaves the bracket its own two
 * endpoints define. `envelopeText` is the exact bytes the verb reads, so a
 * mutation of the disclosed road is a mutation of the verb's real input.
 */
function fBracketCensus(envelopeText: string, lineId: string, samples: readonly Sample[]): Census {
  let probes = 0;
  let outside = 0;
  let maxOvershoot = 0;
  let worst = "none";
  for (let i = 0; i + 1 < samples.length; i++) {
    const a = samples[i]!;
    const b = samples[i + 1]!;
    if (!(b.s > a.s)) continue;
    const lo = Math.min(a.f, b.f);
    const hi = Math.max(a.f, b.f);
    for (const w of PROBE_FRACTIONS) {
      const s = a.s + w * (b.s - a.s);
      const out = stateVerb({ loadedText: envelopeText, argv: ["--line", lineId, "--s", String(s)] });
      const doc = out.stdout as { ok: boolean; value?: { sample: { f: number } } };
      expect(doc.ok, `state failed at s=${s}: ${JSON.stringify(out.stdout)}`).toBe(true);
      const f = doc.value!.sample.f;
      probes++;
      const overshoot = Math.max(0, f - hi, lo - f);
      if (overshoot > EPS) outside++;
      if (overshoot > maxOvershoot) {
        maxOvershoot = overshoot;
        worst = `s=${s.toFixed(4)} f=${f.toFixed(6)} outside [${lo.toFixed(6)}, ${hi.toFixed(6)}]`;
      }
    }
  }
  return { probes, outside, maxOvershoot, worst };
}

/** The pre-fix view of the world: the same envelope with the corridor members deleted. */
function stripCorridorDisclosure(text: string): string {
  const env = JSON.parse(text) as Record<string, unknown>;
  const road = env["road"] as Record<string, unknown>;
  delete road["bike_margin_m"];
  delete road["use_full_width"];
  return JSON.stringify(env);
}

// ---------------------------------------------------------------------------

describe("the envelope discloses the corridor, not just the centreline (design/05 §7, design/03 §2.1)", () => {
  it("FigureResult.road carries dsl AND both corridor members — the marshalling's precondition", () => {
    // design/05 §7: `road` is "ONE composed RoadModel"; `core/types.ts`'s
    // RoadModel declares lane_width_m/bike_margin_m/use_full_width as DATA
    // members, so they survive the JSON round-trip while the closures do not.
    // If this ever stops holding, the corridor is genuinely unrecoverable from
    // the envelope and the defect becomes a CONTRACT defect — this case names
    // the missing field first, before any downstream `f` assertion confuses it
    // for an interpolation bug.
    for (const [name, fx] of [["full-width", FW], ["bike-margin", BM], ["default", DEFAULT]] as const) {
      expect(typeof fx.env.road.dsl, name).toBe("string");
      expect(typeof fx.env.road.lane_width_m, name).toBe("number");
      expect(typeof fx.env.road.bike_margin_m, name).toBe("number");
      expect(typeof fx.env.road.use_full_width, name).toBe("boolean");
    }
    // …and the DSL really is corridor-blind: all three roads differ in corridor,
    // and the two book90 ones spell the identical DSL string.
    expect(BM.env.road.dsl).toBe(DEFAULT.env.road.dsl);
    expect(BM.env.road.bike_margin_m).toBe(0.9);
    expect(DEFAULT.env.road.bike_margin_m).toBe(0.4);
    expect(FW.env.road.use_full_width).toBe(true);
    expect(DEFAULT.env.road.use_full_width).toBe(false);
  });
});

describe("state: interpolated f never leaves its own sample bracket (ARCHITECTURE §9.9, design/03 §2)", () => {
  it("--use-full-width envelope: 0 out-of-bracket probes across every bracket × 5 interior stations", () => {
    const line = FW.env.lines[0]!;
    const c = fBracketCensus(FW.text, line.line_id, line.trajectory.samples);
    expect(c.probes).toBeGreaterThan(400);
    expect(`${c.outside}/${c.probes} out of bracket (max overshoot ${c.maxOvershoot}; worst ${c.worst})`).toBe(
      `0/${c.probes} out of bracket (max overshoot 0; worst none)`
    );
  }, 180_000);

  it("--bike-margin 0.9 envelope: 0 out-of-bracket probes across every bracket × 5 interior stations", () => {
    const line = BM.env.lines[0]!;
    const c = fBracketCensus(BM.text, line.line_id, line.trajectory.samples);
    expect(c.probes).toBeGreaterThan(400);
    expect(`${c.outside}/${c.probes} out of bracket (max overshoot ${c.maxOvershoot}; worst ${c.worst})`).toBe(
      `0/${c.probes} out of bracket (max overshoot 0; worst none)`
    );
  }, 180_000);

  it("the census has teeth: stripping the two disclosed corridor members breaks it on BOTH fixtures", () => {
    // The mutation is the defect, exactly: same verb, same query, same `dsl` —
    // only the corridor disclosure is gone, so `compose()` falls back to
    // BIKE_MARGIN_DEFAULT_M / use_full_width:false, which is what recomposing
    // from `{dsl}` alone did. A census that passed here would be asserting
    // something the bug satisfies, i.e. nothing.
    for (const [name, fx] of [["full-width", FW], ["bike-margin", BM]] as const) {
      const line = fx.env.lines[0]!;
      const c = fBracketCensus(stripCorridorDisclosure(fx.text), line.line_id, line.trajectory.samples);
      expect(c.outside, `${name}: mutant census must fail`).toBeGreaterThan(c.probes / 2);
      expect(c.maxOvershoot, `${name}: mutant overshoot must be gross, not numeric noise`).toBeGreaterThan(0.1);
    }
  }, 180_000);

  it("the shipped binary answers what the verb entry point answers (the census probes the real path)", () => {
    // Not a verb-vs-library equality (that is the gate shape that could not see
    // this bug) — only proof that the fast in-process census above rides the
    // same code `node dist/cli/main.js state` runs.
    const line = BM.env.lines[0]!;
    const samples = line.trajectory.samples;
    for (const idx of [1, Math.floor(samples.length / 4), Math.floor(samples.length / 2), samples.length - 2]) {
      const s = (samples[idx]!.s + samples[idx + 1]!.s) / 2;
      const spawned = cli(["state", BM.path, "--line", line.line_id, "--s", String(s)]);
      const inProcess = stateVerb({ loadedText: BM.text, argv: ["--line", line.line_id, "--s", String(s)] });
      expect(spawned.raw).toBe(JSON.stringify(inProcess.stdout) + "\n");
    }
  }, 120_000);
});

// ---------------------------------------------------------------------------
// The same root, on the two other surfaces that reload an envelope's road.

describe("render: the disclosed corridor reaches the ink (design/06 §3.1)", () => {
  function svgOf(fixturePath: string, figureId: string, tag: string): string {
    const outDir = join(dir, `render-${tag}`);
    const r = cli(["render", fixturePath, "--out", outDir]);
    expect(r.exit, `render ${tag}: ${r.raw}`).toBe(0);
    return readFileSync(join(outDir, `${figureId}.svg`), "utf8");
  }

  it("a use_full_width envelope renders WITHOUT the lane centreline; a default-corridor one WITH it", () => {
    // design/06 §3.1 / design/03 §2: full width "relaxes the corridor and
    // nothing else; renderer suppresses centreline". The centreline is the only
    // dashed polyline in stage `3-lane-markings`. Recomposing from `dsl` alone
    // loses `use_full_width`, so the suppressed centreline comes back — 705
    // bytes of ink the figure must not contain.
    const dashed = (svg: string): number => (svg.match(/stroke-dasharray/g) ?? []).length;
    const fwMarkings = /data-stage="3-lane-markings"(.*?)<\/g>/s.exec(svgOf(FW.path, FW.env.figure_id, "fw"))![1]!;
    const dfMarkings = /data-stage="3-lane-markings"(.*?)<\/g>/s.exec(svgOf(DEFAULT.path, DEFAULT.env.figure_id, "df"))![1]!;
    expect(dashed(fwMarkings)).toBe(0);
    expect(dashed(dfMarkings)).toBe(1);
  }, 120_000);

  it("bike_margin_m moves the gravel band by exactly the margin delta, on an otherwise byte-identical ride", () => {
    // A gravel band is drawn flush against the corridor's usable edge
    // (`render/project.ts`'s hazardDBand reads road.dOf(0|1, s)), so the inset
    // is LIVE ink wherever a side-anchored hazard exists. Both runs use an
    // absolute `start.d` so the corridor change moves no physics: the two
    // trajectories are byte-identical and the gravel is the ONLY thing that may
    // move. Under a dsl-only recompose both fall back to margin 0.4 and the
    // band does not move at all.
    const base = cli(["export", DEFAULT.path, "--as", "scenario"]);
    expect(base.exit).toBe(0);
    const scenario = (base.stdout as { value: Record<string, unknown> }).value;
    const rider = scenario["rider"] as Record<string, unknown>;

    const stipples = (margin: number): { x: number; y: number }[] => {
      const doc = {
        ...scenario,
        road: { dsl: (scenario["road"] as { dsl: string }).dsl, bike_margin_m: margin },
        hazards: [{ kind: "gravel", side: "inside", at: { ref: "entry:c1" }, span_m: 8 }],
        rider: { ...rider, start: { speed_kmh: 34, d: 1.0 } }
      };
      const tag = `g${String(margin).replace(".", "")}`;
      const scnPath = join(dir, `${tag}.scenario.json`);
      writeFileSync(scnPath, JSON.stringify(doc), "utf8");
      const env = build(`${tag}.json`, ["run", scnPath]);
      const svg = svgOf(env.path, env.env.figure_id, tag);
      const group = /data-stage="4-gravel"(.*?)<\/g>/s.exec(svg)![1]!;
      return [...group.matchAll(/<circle cx="([-\d.e]+)" cy="([-\d.e]+)"/g)].map((m) => ({ x: Number(m[1]), y: Number(m[2]) }));
    };

    const a = stipples(0.4);
    const b = stipples(0.9);
    expect(a.length).toBeGreaterThan(0);
    expect(b.length).toBe(a.length);
    for (let i = 0; i < a.length; i++) {
      const dist = Math.hypot(a[i]!.x - b[i]!.x, a[i]!.y - b[i]!.y);
      expect(dist, `stipple ${i} must move by the 0.5 m margin delta`).toBeCloseTo(0.5, 2);
    }
  }, 180_000);
});

describe("export: the re-emitted spec carries the corridor a consumer must recompute (D6, design/05 §8.1)", () => {
  it("--as scenario round-trips use_full_width and bike_margin_m", () => {
    // design/05 §8.1: "Every consumer recomputes trajectories and verdicts from
    // the spec". A projection that keeps only `dsl` hands the consumer a road
    // whose corridor reverts to the defaults — the same defect as the dsl-only
    // recompose, one hop downstream. `--as scenario` is the surface where the
    // re-run contract (A-RESOLVED-RERUN) actually lives, and it holds.
    for (const [name, fx] of [["full-width", FW], ["bike-margin", BM]] as const) {
      const road = fx.env.road;
      const scn = cli(["export", fx.path, "--as", "scenario"]);
      expect(scn.exit, name).toBe(0);
      expect((scn.stdout as { value: { road: unknown } }).value.road, `${name}: scenario`).toEqual({
        dsl: road.dsl,
        use_full_width: road.use_full_width,
        bike_margin_m: road.bike_margin_m
      });
    }
  }, 120_000);

  it("RECORDED DEFECT — --as figure-spec / --as share-url still drop the corridor; the repair is an identity move", () => {
    // Pinned, not fixed. The FigureSpec projection keeps only `dsl`, so a
    // non-default-corridor envelope projects a spec that is NOT the road the
    // engine rode. Carrying the corridor here re-spells the FigureSpec, which
    // moves `spec_hash` — inside `result_hash`'s input, since the exclusion set
    // is closed at {result_hash, diagnosis, cache, skew, commitment}
    // (ARCHITECTURE §6.3) — so every envelope's identity moves while the physics
    // does not. Measured on the default-corridor `serve` fixture: spec_hash
    // ac968b → 120886, result_hash b8471c → 3794aa, plans equal, max |Δ(x, f)| = 0.
    // That is a re-bless event owned by solve/ (`figureLineSolveSpec`'s canonical
    // road-equality at solve/run.ts L720, and the spelling of `source.*.road`),
    // not a CLI marshalling repair. This case fails the day someone fixes it —
    // which is the point: it must be a deliberate, blessed change.
    for (const [name, fx] of [["full-width", FW], ["bike-margin", BM]] as const) {
      const spec = cli(["export", fx.path, "--as", "figure-spec"]);
      expect(spec.exit, name).toBe(0);
      expect((spec.stdout as { value: { road: unknown } }).value.road, `${name}: figure-spec`).toEqual({ dsl: fx.env.road.dsl });

      const url = cli(["export", fx.path, "--as", "share-url"]);
      expect(url.exit, name).toBe(0);
      const frag = (url.stdout as { value: { url: string } }).value.url;
      const decoded = JSON.parse(Buffer.from(frag.slice("#f=".length), "base64").toString("utf8")) as { road: unknown };
      expect(decoded.road, `${name}: share-url`).toEqual({ dsl: fx.env.road.dsl });
    }
    // …and the consequence is a typed REFUSAL, never a silently wrong corridor:
    // the projection recomputes to zero lines rather than riding the defaults.
    const spec = cli(["export", BM.path, "--as", "figure-spec"]);
    const specPath = join(dir, "projected.figspec.json");
    writeFileSync(specPath, JSON.stringify((spec.stdout as { value: unknown }).value), "utf8");
    const rerun = cli(["run", specPath]);
    const doc = rerun.stdout as { value?: { lines: { ok?: boolean; error?: { detail?: { reason?: string } } }[] } };
    const refusals = (doc.value?.lines ?? []).filter((l) => l.ok === false);
    expect(refusals.length, "the corridor-less projection must refuse, not silently ride the defaults").toBeGreaterThan(0);
    expect(refusals[0]!.error?.detail?.reason).toBe("line_road_differs");
  }, 120_000);

  it("--as scenario re-runs on the SAME corridor: every recorded f is reproduced exactly", () => {
    // The end-to-end consequence. A re-run of the exported scenario must land
    // on the same lane fractions, not merely the same geometry — which is what
    // separates a corridor-faithful export from a centreline-only one.
    for (const [name, fx] of [["full-width", FW], ["bike-margin", BM]] as const) {
      const scn = cli(["export", fx.path, "--as", "scenario"]);
      expect(scn.exit, name).toBe(0);
      const scnPath = join(dir, `rerun-${name}.json`);
      writeFileSync(scnPath, JSON.stringify((scn.stdout as { value: unknown }).value), "utf8");
      const rerun = build(`rerun-${name}.env.json`, ["run", scnPath]);
      expect(rerun.env.road.bike_margin_m, name).toBe(fx.env.road.bike_margin_m);
      expect(rerun.env.road.use_full_width, name).toBe(fx.env.road.use_full_width);
      const before = fx.env.lines[0]!.trajectory.samples;
      const after = rerun.env.lines[0]!.trajectory.samples;
      expect(after.length, name).toBe(before.length);
      let maxDf = 0;
      for (let i = 0; i < before.length; i++) maxDf = Math.max(maxDf, Math.abs(before[i]!.f - after[i]!.f));
      expect(maxDf, `${name}: max |Δf| across the re-run`).toBe(0);
    }
  }, 180_000);
});
