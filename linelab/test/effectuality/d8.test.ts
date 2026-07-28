// test/effectuality/d8.test.ts — the D8 effectuality harness (design/09 §8.1).
//
// "Every schema-accepted input surface has a committed witness row proving an
// observable effect, or a typed rejection. An input with no witness row does
// not ship." The quantifier is inverted into a decidable form: not "effectual
// on all scenarios" but "demonstrably effectual on a NAMED witness",
// exhaustively over the closed field enumeration.
//
//   - `verify/effectuality.json` is the committed witness table (data of
//     record); `effectAt(class, before, after)` is defined ONCE here, beside
//     the table, thresholds included (design/09 §8.1).
//   - T-D8-EXHAUSTIVE: every field path the `schema` verb prints (on the
//     INPUT surfaces — the row schema's closed 10-surface set; the schema's
//     `envelope` and `rubric` sections describe outputs and pack data, not
//     accepted input) appears in exactly one row; a row naming a surface the
//     schema no longer prints also fails (set equality, both directions).
//   - Every row is OBSERVED: `effect` rows run the named witness fixture with
//     and without the perturbation and assert the per-class difference;
//     `reject:<CODE>/<reason>` rows assert the exact typed code + reason.
//   - The mandated named rows ride their design fixtures: T-POS-EFFECT /
//     T-POS-INEFFECTUAL / T-POS-OVERLAP / T-POS-SHORTFALL (FX-POS-*), the
//     vis-knob INEFFECTUAL arm, the `turn_in.hand` witness, and the
//     constraint-vocabulary sweep.
//
// (The `--line-id` KNOWN-INERT row is RESOLVED: the flag is wired to its
// designed meaning — it names the primary authored line of a composed input
// (design/08 §4.1; solve/run.ts runComposed + cli/verbs/solve.ts consume it,
// stripped before the solver so ids stay outside every hash). Its row runs as
// an ordinary effect row; the collision arm (DUP_ID) and the figure-input
// rejection (SCHEMA/line_id_on_figure) are hosted below.)

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { buildSchemaDoc, type SchemaDoc } from "../../src/cli/doc/schema.js";
import {
  CLI_VIEWS,
  VERB_SCOPED_FLAGS,
  ineffectualFlagFor,
  parseZeroFileFlags,
  type ParsedInvocation
} from "../../src/cli/args.js";
import { SHIPPED_VERBS } from "../../src/cli/deferred.js";
import { run } from "../../src/solve/run.js";
import { runVerb } from "../../src/cli/verbs/run.js";
import { solveVerb } from "../../src/cli/verbs/solve.js";
import { renderVerb } from "../../src/cli/verbs/render.js";
import { figureVerb } from "../../src/cli/verbs/figure.js";
import type { VerbOutcome } from "../../src/cli/verbs/shared.js";
import { chainedSolve } from "../../src/solve/chained.js";
import { compileMistake } from "../../src/solve/mistake.js";
import { validate } from "../../src/plan/validate.js";
import { renderViews } from "../../src/render/index.js";
import { isLineRefusal } from "../../src/solve/envelope.js";
import { canonicalize } from "../../src/core/hash.js";
import type { LinelabError } from "../../src/core/result.js";
import type { LineResult, FigureResult } from "../../src/solve/types.js";
import type { ComposedRoad } from "../../src/road/types.js";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "../..");

// ---------------------------------------------------------------------------
// The committed table

interface WitnessRow {
  readonly id: string;
  readonly surface: string;
  readonly field: string;
  readonly fixture: string;
  readonly perturbation: unknown;
  readonly effect_class: EffectClass;
  readonly expect: string;
}

const TABLE = JSON.parse(readFileSync(join(repoRoot, "verify", "effectuality.json"), "utf8")) as {
  readonly note: string;
  readonly rows: readonly WitnessRow[];
};

const SURFACES = [
  "scenario", "plan", "road-dsl", "occluders", "hazards",
  "mistakes", "solve", "scene", "view", "cli"
] as const;

export const EFFECT_CLASSES = ["trajectory", "verdict", "sight", "render", "envelope", "analysis"] as const;
export type EffectClass = (typeof EFFECT_CLASSES)[number];

// ---------------------------------------------------------------------------
// effectAt — THE per-class difference predicate, defined once beside the
// table (design/09 §8.1). Each class compares ITS OWN observation document
// (the builder extracts the class's channel — trajectory: raw samples +
// termination; verdict: solved plan + verdict (a typed refusal is an
// observation, so a solve→refusal flip is a verdict change); sight: the
// recorded sight channel + verdict.sight; render: the drawn SVG bytes;
// envelope: the full output document; analysis: the recomputable analysis
// document MINUS its declared echo fields (reserve_checks, rubric,
// checks_version — the P-STANDING-STAMPED echoes; without the subtraction
// the detector would fire on a pack echo passing through).

function canon(v: unknown): string {
  const c = canonicalize(v);
  return c.ok ? c.value : JSON.stringify(v);
}

const ANALYSIS_ECHO_FIELDS = ["reserve_checks", "rubric", "checks_version"] as const;

function stripEcho(doc: unknown): unknown {
  if (typeof doc !== "object" || doc === null || Array.isArray(doc)) return doc;
  const out: Record<string, unknown> = { ...(doc as Record<string, unknown>) };
  for (const k of ANALYSIS_ECHO_FIELDS) delete out[k];
  return out;
}

export function effectAt(cls: EffectClass, before: unknown, after: unknown): boolean {
  switch (cls) {
    case "render":
      return String(before) !== String(after); // drawn diff of the artifact — byte inequality
    case "analysis":
      return canon(stripEcho(before)) !== canon(stripEcho(after));
    case "trajectory":
    case "verdict":
    case "sight":
    case "envelope":
      return canon(before) !== canon(after);
  }
}

// ---------------------------------------------------------------------------
// T-D8-EXHAUSTIVE — schema-driven enumeration (mirrors the table generator;
// this IS the decidable quantifier)

function enumerateWitnessPaths(doc: SchemaDoc): readonly { surface: string; field: string }[] {
  const out: { surface: string; field: string }[] = [];
  const simple: Readonly<Record<string, string>> = {
    scenario: "scenario",
    plan: "plan",
    "road-dsl": "road-dsl",
    occluders: "occluders",
    hazards: "hazards",
    solve: "solve",
    view: "view"
  };
  for (const [sec, surface] of Object.entries(simple)) {
    for (const f of doc.sections[sec]?.fields ?? []) out.push({ surface, field: f.name });
  }
  for (const k of doc.sections["mistakes"]?.kinds ?? []) {
    out.push({ surface: "mistakes", field: k.kind });
    for (const p of k.params) out.push({ surface: "mistakes", field: `${k.kind}.${p.name}` });
  }
  // D30: scene text and FigureSpec JSON are ONE identity — the `figure`
  // section's fields ride surface "scene" (the row schema has no "figure")
  for (const f of doc.sections["figure"]?.fields ?? []) out.push({ surface: "scene", field: f.name });
  for (const fl of doc.sections["cli"]?.flags ?? []) out.push({ surface: "cli", field: fl.flag });
  return out;
}

describe("T-D8-EXHAUSTIVE — the witness table covers the printed v0.1 schema exactly", () => {
  const docR = buildSchemaDoc();
  it("the schema doc builds", () => {
    expect(docR.ok).toBe(true);
  });
  if (!docR.ok) return;
  const enumerated = enumerateWitnessPaths(docR.value);

  it("every printed field path appears in exactly one row, and every row names a live surface (set equality, both directions)", () => {
    const want = enumerated.map((p) => `${p.surface}:${p.field}`).sort();
    const got = TABLE.rows.map((r) => `${r.surface}:${r.field}`).sort();
    expect(got).toEqual(want);
    expect(new Set(got).size).toBe(got.length); // exactly ONE row per path
  });

  it("rows are structurally sound: id spelling, closed surface set, closed effect-class set, expect grammar", () => {
    for (const row of TABLE.rows) {
      expect(row.id).toBe(`${row.surface}:${row.field}`);
      expect(SURFACES).toContain(row.surface as (typeof SURFACES)[number]);
      expect(EFFECT_CLASSES).toContain(row.effect_class);
      expect(row.expect).toMatch(/^(effect|reject:[A-Z_]+\/[a-z_]+)$/);
      expect(row.fixture.length).toBeGreaterThan(0);
      expect(row.perturbation === "presence" || typeof row.perturbation === "object").toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// Witness fixtures + memoized observation builders

const S120 = "lane 3.5 | S 120";
const C30 = "lane 3.5 | S 35 | R 30 ^90 | S 25";
const R25 = "lane 3.5 | S 20 | R 25 ^90 | S 25";

type Wire = Record<string, unknown>;

function scen(id: string, road: Wire | { dsl: string } | { preset: string }, speed: number, f: number | undefined, plan: readonly Wire[], extra?: Wire): Wire {
  return {
    spec: "linelab/1",
    id,
    road,
    rider: { start: { speed_kmh: speed, ...(f !== undefined ? { f } : {}) }, plan },
    ...(extra ?? {})
  };
}

const C30_PLAN: readonly Wire[] = [
  { do: "brake", id: "b1", at_s: 2, decel: 4.6 },
  { do: "throttle", id: "c1", at_s: 22, accel: 0 },
  { do: "turn_in", id: "t1", at_s: 29.5, target: { lean_deg: 36.5 } },
  { do: "throttle", id: "r1", at_s: 62, accel: 1.2 }
];
const c30Scen = (over?: { plan?: readonly Wire[]; rider?: Wire }): Wire => ({
  spec: "linelab/1",
  id: "fx-c30",
  road: { dsl: C30 },
  rider: { profile: "street", start: { speed_kmh: 70, f: 0.9 }, plan: over?.plan ?? C30_PLAN, ...(over?.rider ?? {}) }
});

const memoStore = new Map<string, unknown>();
function memo<T>(key: string, fn: () => T): T {
  if (!memoStore.has(key)) memoStore.set(key, fn());
  return memoStore.get(key) as T;
}

function runOk(key: string, input: Wire): FigureResult {
  return memo(`run:${key}`, () => {
    const r = run(input);
    if (!r.ok) throw new Error(`witness run "${key}" refused: ${JSON.stringify(r.error)}`);
    const refusal = r.value.lines.find((l) => isLineRefusal(l));
    if (refusal !== undefined) throw new Error(`witness line "${key}" refused: ${JSON.stringify(refusal)}`);
    return r.value;
  });
}

function lineOf(env: FigureResult, i = 0): LineResult {
  return env.lines.filter((l): l is LineResult => !isLineRefusal(l))[i]!;
}

/** class-shaped observation docs */
function trajDoc(env: FigureResult, i = 0): unknown {
  const l = lineOf(env, i);
  return { samples: l.trajectory.samples, terminated: l.trajectory.terminated };
}
function sightDoc(env: FigureResult, i = 0): unknown {
  const l = lineOf(env, i);
  return { sight: l.verdict.sight, channel: l.trajectory.samples.map((p) => [p.sight_m, p.sight_ride_m, p.limit_x, p.limit_y]) };
}
function verdictDocOfLine(l: LineResult): unknown {
  return { plan: l.resolved_scenario.rider.plan, verdict: l.verdict };
}
function vDoc(o: VerbOutcome): unknown {
  const doc = o.stdout as { ok: boolean; value?: FigureResult; error?: LinelabError };
  if (!doc.ok) return { refused: { code: doc.error?.code, detail: doc.error?.detail } };
  return verdictDocOfLine(lineOf(doc.value!));
}
function svgOf(o: VerbOutcome): string {
  return (o.writes ?? []).find((w) => w.path.endsWith(".svg"))?.content ?? "";
}

// verb-layer memos (pure, in-process — the A-STATE-VERB pattern: the verb IS
// the library plus the flag parser, so cli rows witness the parser too)
function sv(argv: readonly string[], loadedText?: string): VerbOutcome {
  return memo(`solve:${loadedText ?? ""}|${argv.join(" ")}`, () => solveVerb({ argv, ...(loadedText !== undefined ? { loadedText } : {}) }));
}
function rv(argv: readonly string[], loadedText?: string): VerbOutcome {
  return memo(`run:${loadedText ?? ""}|${argv.join(" ")}`, () => runVerb({ argv, engineSemver: "0.1.0", ...(loadedText !== undefined ? { loadedText } : {}) }));
}

// mistake compiles (the oracle's own path)
const F90: Wire = { road: "book90", entry_kmh: 34 };
const FDR: Wire = { road: "bookDecreasing", entry_kmh: 34 };
function base90(): LineResult {
  return memo("base90", () => {
    const r = chainedSolve(F90 as never);
    if (!r.ok) throw new Error(`F-ORACLE-90 base refused: ${JSON.stringify(r.error)}`);
    return r.value;
  });
}
function baseDR(): LineResult {
  return memo("baseDR", () => {
    const r = chainedSolve({ ...FDR, accept: "best_failing" } as never);
    if (!r.ok) throw new Error(`F-ORACLE-DR base refused: ${JSON.stringify(r.error)}`);
    return r.value;
  });
}
function compile(kind: string, params: Wire | undefined, base: LineResult, spec: Wire): LineResult {
  return memo(`cmp:${kind}:${JSON.stringify(params ?? {})}:${spec["road"] as string}`, () => {
    const c = compileMistake(kind, params as never, { base, spec: spec as never });
    if (!c.ok) throw new Error(`compile ${kind} refused: ${JSON.stringify(c.error)}`);
    return c.value.line;
  });
}
function compileErr(kind: string, params: Wire | undefined, base: LineResult, spec: Wire): LinelabError {
  const c = compileMistake(kind, params as never, { base, spec: spec as never });
  if (c.ok) throw new Error(`compile ${kind} unexpectedly succeeded`);
  return c.error;
}

// figure/view fixtures
const figJson = (over?: Wire, innerSpeed = 70): string =>
  JSON.stringify({
    road: { dsl: C30 },
    lines: [
      {
        name: (over?.["lineName"] as string) ?? "a",
        role: (over?.["lineRole"] as string) ?? "ideal",
        // design/03 §8's per-line MarkSpec + design/05 §7's per-line legend
        // text, both omitted unless the witness row perturbs them
        ...(over?.["lineMarks"] !== undefined ? { marks: over["lineMarks"] } : {}),
        ...(over?.["lineLabel"] !== undefined ? { label: over["lineLabel"] } : {}),
        spec: { ...c30Scen(), id: "inner", rider: { ...(c30Scen()["rider"] as Wire), start: { speed_kmh: innerSpeed, f: 0.9 } } }
      }
    ],
    ...(over?.["marks"] !== undefined ? { marks: over["marks"] } : {}),
    ...(over?.["note"] !== undefined ? { note: over["note"] } : {}),
    ...(over?.["placards"] !== undefined ? { placards: over["placards"] } : {})
  });
function fig(key: string, over?: Wire, innerSpeed = 70): VerbOutcome {
  return memo(`fig:${key}`, () => figureVerb({ loadedText: figJson(over, innerSpeed), argv: ["--out", "out"], engineSemver: "0.1.0" }));
}
function figEnvelope(o: VerbOutcome): unknown {
  return (o.stdout as { value: unknown }).value;
}

function viewSvg(key: string, viewSpec: Wire, envKey: "c30" | "occ" = "c30"): string {
  return memo(`view:${key}`, () => {
    const env = envKey === "c30" ? runOk("c30-plan", c30Scen()) : occTurnEnv();
    const lines = env.lines.filter((l): l is LineResult => !isLineRefusal(l));
    const r = renderViews({ road: env.road as unknown as ComposedRoad, lines, viewSpec: viewSpec as never });
    if (!r.ok) throw new Error(`renderViews refused: ${JSON.stringify(r.error)}`);
    return r.value.svg;
  });
}
/**
 * The `pov` render target under a given `look` (design/07 §5.2), on the
 * occluder-bearing turn fixture where the limit point is clamped — so the two
 * camera aims yield distinct frames. Feeds the `view:look` effect witness.
 */
function povLookSvg(look: "heading" | "limit_point"): string {
  return memo(`povlook:${look}`, () => {
    const env = occTurnEnv();
    const lines = env.lines.filter((l): l is LineResult => !isLineRefusal(l));
    const r = renderViews({ road: env.road as unknown as ComposedRoad, lines, target: "pov", viewSpec: { look } as never });
    if (!r.ok) throw new Error(`pov renderViews refused: ${JSON.stringify(r.error)}`);
    return r.value.svg;
  });
}
function occTurnEnv(): FigureResult {
  return runOk(
    "occ-turn",
    scen("fx-occ-turn", { preset: "book90" }, 25, 0.9, [{ do: "turn_in", id: "t1", at_s: 8, target: { lean_deg: 20 } }], {
      occluders: [{ kind: "hedge", side: "inside", at: { ref: "entry:c1", offset_m: -8 }, span_m: 20 }]
    })
  );
}

// occluder / hazard ride fixtures
const hedge = (over?: Wire): Wire => ({ kind: "hedge", side: "inside", at: { ref: "entry:c1", offset_m: -8 }, span_m: 20, ...(over ?? {}) });
function occRide(key: string, occluders?: readonly Wire[]): FigureResult {
  return runOk(`occ:${key}`, scen("fx-occ", { preset: "book90" }, 25, 0.5, [], occluders !== undefined ? { occluders } : {}));
}
const patch = (over?: Wire): Wire => ({ kind: "gravel", side: "center", at: { at_s: 15 }, span_m: 10, width_m: 3, mu: 0.3, ...(over ?? {}) });
function hazRide(key: string, hazards?: readonly Wire[]): FigureResult {
  return runOk(
    `haz:${key}`,
    // constant scenario id "fx-brake" — the perturbation, never the id, is the difference under observation
    scen("fx-brake", { dsl: S120 }, 60, 0.5, [{ do: "brake", id: "b1", at_s: 5, decel: 6.0 }], hazards !== undefined ? { hazards } : {})
  );
}

function presetRide(key: string, road: Wire): FigureResult {
  return runOk(`preset:${key}`, scen("fx-preset", road as never, 25, 0.5, []));
}

// wire texts for cli rows (flag-over-file merge witnesses)
const rideText = JSON.stringify(scen("fx-ride", { dsl: S120 }, 34, 0.2, []));
const c30Text = JSON.stringify(c30Scen());
const brakeText = JSON.stringify(scen("fx-brake", { dsl: S120 }, 60, 0.5, [{ do: "brake", id: "b1", at_s: 5, decel: 6.0 }]));
const occRideText = JSON.stringify(scen("fx-occ-cli", { preset: "book90" }, 25, 0.5, []));
const mergeText = JSON.stringify({ road: R25, entry_kmh: 44, turn_in: 12 });
const earlyText = JSON.stringify({ road: "lane 3.5 | S 6 | R 25 ^90 | S 30", entry_kmh: 30, turn_in: 2 });
const composedText = JSON.stringify({ road: "book90", entry_kmh: 34 });

function envText(): string {
  return memo("envText", () => JSON.stringify(figEnvelope(fig("base"))));
}
function occEnvText(): string {
  return memo("occEnvText", () => JSON.stringify(occTurnEnv()));
}
function rdr(argv: readonly string[], text: string): VerbOutcome {
  return memo(`rdr:${text.length}:${argv.join(" ")}`, () => renderVerb({ loadedText: text, argv: ["--views", "topdown", ...argv] }));
}
// the `render` verb on the pov target — the `.pov.svg` is what `svgOf` picks up
function rdrPov(argv: readonly string[], text: string): VerbOutcome {
  return memo(`rdrpov:${text.length}:${argv.join(" ")}`, () => renderVerb({ loadedText: text, argv: ["--views", "pov", ...argv] }));
}

// ---------------------------------------------------------------------------
// Observation builders, one per table row (T-D8-EXHAUSTIVE guarantees the key
// set matches the table; a missing builder fails the row's test)

type Obs = { readonly kind: "pair"; readonly before: unknown; readonly after: unknown } | { readonly kind: "reject"; readonly error: LinelabError };

function rejectOf(r: { ok: boolean; error?: LinelabError }): Obs {
  if (r.ok || r.error === undefined) throw new Error("witness unexpectedly validated");
  return { kind: "reject", error: r.error };
}
function pair(before: unknown, after: unknown): Obs {
  return { kind: "pair", before, after };
}

const BUILDERS: Readonly<Record<string, () => Obs>> = {
  // -- scenario --------------------------------------------------------------
  "scenario:spec": () => rejectOf(validate({ ...scen("fx", { dsl: S120 }, 34, 0.2, []), spec: "linelab/9" }) as never),
  "scenario:id": () => pair(runOk("ride-base", scen("fx-ride", { dsl: S120 }, 34, 0.2, [])), runOk("ride-id2", scen("fx-ride-2", { dsl: S120 }, 34, 0.2, []))),
  "scenario:road": () => pair(trajDoc(runOk("ride-base", scen("fx-ride", { dsl: S120 }, 34, 0.2, []))), trajDoc(runOk("ride-road80", scen("fx-ride", { dsl: "lane 3.5 | S 80" }, 34, 0.2, [])))),
  "scenario:rider.start.speed_kmh": () => pair(trajDoc(runOk("ride-base", scen("fx-ride", { dsl: S120 }, 34, 0.2, []))), trajDoc(runOk("ride-v50", scen("fx-ride", { dsl: S120 }, 50, 0.2, [])))),
  "scenario:rider.start.f": () => pair(trajDoc(runOk("ride-base", scen("fx-ride", { dsl: S120 }, 34, 0.2, []))), trajDoc(runOk("ride-f07", scen("fx-ride", { dsl: S120 }, 34, 0.7, [])))),
  "scenario:rider.profile": () => pair(trajDoc(runOk("c30-plan", c30Scen())), trajDoc(runOk("c30-casual", c30Scen({ rider: { profile: "casual" } })))),
  "scenario:rider.roll_rate_cap_dps": () => pair(trajDoc(runOk("c30-plan", c30Scen())), trajDoc(runOk("c30-cap15", c30Scen({ rider: { roll_rate_cap_dps: 15 } })))),
  "scenario:rider.plan": () => pair(trajDoc(runOk("pos-none", posScen([]))), trajDoc(runOk("pos-with", posScen(POS_ACTIONS)))),
  "scenario:config.mu": () => pair(trajDoc(hazRide("absent")), trajDoc(runOk("brake-mu05", { ...scen("fx-brake", { dsl: S120 }, 60, 0.5, [{ do: "brake", id: "b1", at_s: 5, decel: 6.0 }]), config: { mu: 0.5 } }))),
  "scenario:config.rubric": () => rejectOf(validate({ ...scen("fx", { dsl: S120 }, 34, 0.2, []), config: { rubric: "parks-track" } }) as never),
  "scenario:config.checks_version": () => rejectOf(validate({ ...scen("fx", { dsl: S120 }, 34, 0.2, []), config: { checks_version: 1 } }) as never),
  "scenario:expect_fail": () => rejectOf(run({ ...scen("fx", { dsl: S120 }, 34, 0.2, []), expect_fail: ["sight_vs_stopping"] }) as never),

  // -- plan ------------------------------------------------------------------
  "plan:do": () => rejectOf(validate(scen("fx", { dsl: S120 }, 34, 0.2, [{ do: "steer", id: "x1", at_s: 5 }])) as never),
  "plan:id": () => pair(hazRide("absent"), runOk("brake-bz", scen("fx-brake", { dsl: S120 }, 60, 0.5, [{ do: "brake", id: "bz", at_s: 5, decel: 6.0 }]))),
  "plan:brake.decel": () => pair(trajDoc(hazRide("absent")), trajDoc(runOk("brake-d3", scen("fx-brake", { dsl: S120 }, 60, 0.5, [{ do: "brake", id: "b1", at_s: 5, decel: 3.0 }])))),
  "plan:turn_in.target": () => pair(trajDoc(runOk("c30-plan", c30Scen())), trajDoc(runOk("c30-lean33", c30Scen({ plan: C30_PLAN.map((a) => (a["id"] === "t1" ? { ...a, target: { lean_deg: 33 } } : a)) })))),
  "plan:throttle.accel": () => pair(trajDoc(runOk("thr1", scen("fx-thr", { dsl: S120 }, 34, 0.5, [{ do: "throttle", id: "t1", at_s: 10, accel: 1.0 }]))), trajDoc(runOk("thr2", scen("fx-thr", { dsl: S120 }, 34, 0.5, [{ do: "throttle", id: "t1", at_s: 10, accel: 2.0 }])))),
  "plan:throttle.freeze_steer_s": () => {
    const rollAt70 = C30_PLAN.map((a) => (a["id"] === "r1" ? { ...a, at_s: 70 } : a));
    return pair(
      trajDoc(runOk("c30-freeze-base", c30Scen({ plan: rollAt70 }))),
      trajDoc(runOk("c30-freeze-on", c30Scen({ plan: rollAt70.map((a) => (a["id"] === "r1" ? { ...a, freeze_steer_s: 1.5 } : a)) })))
    );
  },
  "plan:position.over_m": () => rejectOf(validate(posScen([{ ...POS_ACTIONS[0]!, over_m: 6 }])) as never),

  // -- road-dsl (presets) ----------------------------------------------------
  ...Object.fromEntries(
    (["book90", "bookDecreasing", "bookEsses", "bookHairpin", "bookBlind", "bookDoubleApex"] as const).map((name) => [
      `road-dsl:${name}`,
      () => pair(trajDoc(presetRide("base", { dsl: C30 })), trajDoc(presetRide(name, { preset: name })))
    ])
  ),

  // -- occluders -------------------------------------------------------------
  "occluders:kind": () => pair(sightDoc(occRide("hedge", [hedge()])), sightDoc(occRide("wall", [hedge({ kind: "wall" })]))),
  "occluders:side": () => pair(sightDoc(occRide("hedge", [hedge()])), sightDoc(occRide("outside", [hedge({ side: "outside" })]))),
  "occluders:at": () => pair(sightDoc(occRide("hedge", [hedge()])), sightDoc(occRide("at2", [hedge({ at: { ref: "entry:c1", offset_m: 2 } })]))),
  "occluders:span_m": () => pair(sightDoc(occRide("hedge", [hedge()])), sightDoc(occRide("span4", [hedge({ span_m: 4 })]))),
  "occluders:margin_m": () => pair(sightDoc(occRide("m1", [hedge({ margin_m: 1.0 })])), sightDoc(occRide("m6", [hedge({ margin_m: 6.0 })]))),
  "occluders:lane": () => pair(
    sightDoc(occRide("veh-own", [{ kind: "vehicle", at: { ref: "mid:c1" }, lane: "own" }])),
    sightDoc(occRide("veh-onc", [{ kind: "vehicle", at: { ref: "mid:c1" }, lane: "oncoming" }]))
  ),

  // -- hazards ---------------------------------------------------------------
  "hazards:kind": () => pair(trajDoc(hazRide("absent")), trajDoc(hazRide("patch", [patch()]))),
  "hazards:side": () => pair(trajDoc(hazRide("narrow-c", [patch({ width_m: 1.0 })])), trajDoc(hazRide("narrow-l", [patch({ width_m: 1.0, side: "left" })]))),
  "hazards:at": () => pair(trajDoc(hazRide("patch", [patch()])), trajDoc(hazRide("at60", [patch({ at: { at_s: 60 } })]))),
  "hazards:span_m": () => pair(trajDoc(hazRide("patch", [patch()])), trajDoc(hazRide("span2", [patch({ span_m: 2 })]))),
  "hazards:width_m": () => pair(trajDoc(hazRide("left-w1", [patch({ side: "left", width_m: 1.0 })])), trajDoc(hazRide("left-w2", [patch({ side: "left", width_m: 2.0 })]))),
  "hazards:mu": () => pair(trajDoc(hazRide("patch", [patch()])), trajDoc(hazRide("mu08", [patch({ mu: 0.8 })]))),

  // -- mistakes (compiled off the oracle bases; presence rows compare against
  //    the base line — the mistake observably changes the line) --------------
  "mistakes:premature": () => pair(verdictDocOfLine(base90()), verdictDocOfLine(compile("premature", undefined, base90(), F90))),
  "mistakes:premature.early_by_m": () => pair(verdictDocOfLine(compile("premature", undefined, base90(), F90)), verdictDocOfLine(compile("premature", { early_by_m: 4 }, base90(), F90))),
  "mistakes:premature.lean_deg": () => pair(verdictDocOfLine(compile("premature", undefined, base90(), F90)), verdictDocOfLine(compile("premature", { lean_deg: 30 }, base90(), F90))),
  "mistakes:premature_contained": () => pair(verdictDocOfLine(base90()), verdictDocOfLine(compile("premature_contained", undefined, base90(), F90))),
  "mistakes:premature_contained.early_by_m": () => pair(verdictDocOfLine(compile("premature_contained", undefined, base90(), F90)), verdictDocOfLine(compile("premature_contained", { early_by_m: 4 }, base90(), F90))),
  "mistakes:slow_steer": () => pair(verdictDocOfLine(base90()), verdictDocOfLine(compile("slow_steer", undefined, base90(), F90))),
  "mistakes:slow_steer.roll_rate_factor": () => pair(verdictDocOfLine(compile("slow_steer", undefined, base90(), F90)), verdictDocOfLine(compile("slow_steer", { roll_rate_factor: 0.6 }, base90(), F90))),
  "mistakes:fifty_pence": () => pair(verdictDocOfLine(base90()), verdictDocOfLine(compile("fifty_pence", undefined, base90(), F90))),
  "mistakes:fifty_pence.early_by_m": () => pair(verdictDocOfLine(compile("fifty_pence", undefined, base90(), F90)), verdictDocOfLine(compile("fifty_pence", { early_by_m: 6 }, base90(), F90))),
  "mistakes:fifty_pence.facets": () => pair(verdictDocOfLine(compile("fifty_pence", undefined, base90(), F90)), verdictDocOfLine(compile("fifty_pence", { facets: 3 }, base90(), F90))),
  "mistakes:chop": () => pair(verdictDocOfLine(base90()), verdictDocOfLine(compile("chop", undefined, base90(), F90))),
  "mistakes:chop.offset_m": () => pair(verdictDocOfLine(compile("chop", undefined, base90(), F90)), verdictDocOfLine(compile("chop", { offset_m: 10 }, base90(), F90))),
  "mistakes:chop.slew_mss": () => pair(verdictDocOfLine(compile("chop", undefined, base90(), F90)), verdictDocOfLine(compile("chop", { slew_mss: 10 }, base90(), F90))),
  "mistakes:chop.freeze_s": () => pair(verdictDocOfLine(compile("chop", undefined, base90(), F90)), verdictDocOfLine(compile("chop", { freeze_s: 0.3 }, base90(), F90))),
  "mistakes:overspeed": () => pair(verdictDocOfLine(base90()), verdictDocOfLine(compile("overspeed", undefined, base90(), F90))),
  "mistakes:overspeed.by_kmh": () => pair(verdictDocOfLine(compile("overspeed", undefined, base90(), F90)), verdictDocOfLine(compile("overspeed", { by_kmh: 10 }, base90(), F90))),
  "mistakes:underread": () => pair(verdictDocOfLine(baseDR()), verdictDocOfLine(compile("underread", undefined, baseDR(), FDR))),
  "mistakes:underread.r_believed": () => pair(verdictDocOfLine(compile("underread", undefined, baseDR(), FDR)), verdictDocOfLine(compile("underread", { r_believed: 13 }, baseDR(), FDR))),
  "mistakes:underread.sweep_believed_deg": () => pair(verdictDocOfLine(compile("underread", { sweep_believed_deg: 70 }, base90(), F90)), verdictDocOfLine(compile("underread", { sweep_believed_deg: 75 }, base90(), F90))),
  "mistakes:underread.of": () => ({ kind: "reject", error: compileErr("underread", { r_believed: 16, of: "c9" }, base90(), F90) }),
  "mistakes:overread": () => pair(verdictDocOfLine(base90()), verdictDocOfLine(compile("overread", { sweep_believed_deg: 105 }, base90(), F90))),
  "mistakes:overread.r_believed": () => ({ kind: "reject", error: compileErr("overread", { sweep_believed_deg: 105, r_believed: 9 }, base90(), F90) }),
  "mistakes:overread.sweep_believed_deg": () => pair(verdictDocOfLine(compile("overread", { sweep_believed_deg: 105 }, base90(), F90)), verdictDocOfLine(compile("overread", { sweep_believed_deg: 100 }, base90(), F90))),
  "mistakes:overread.of": () => ({ kind: "reject", error: compileErr("overread", { sweep_believed_deg: 105, of: "c9" }, base90(), F90) }),

  // -- solve (via the pure solve verb — the wire twin of the cli rows) -------
  "solve:entry_kmh": () => pair(vDoc(sv(["--road", R25, "--entry", "48", "--turn-in", "12"])), vDoc(sv(["--road", R25, "--entry", "44", "--turn-in", "12"]))),
  "solve:turn_in": () => pair(vDoc(sv(["--road", R25, "--entry", "48", "--turn-in", "12"])), vDoc(sv(["--road", R25, "--entry", "48", "--turn-in", "8"]))),
  "solve:style": () => pair(vDoc(sv(["--road", "preset bookDoubleApex", "--entry", "30", "--style", "single", "--accept", "best_failing"])), vDoc(sv(["--road", "preset bookDoubleApex", "--entry", "30", "--style", "double_apex", "--accept", "best_failing"]))),
  "solve:vis": () => pair(vDoc(sv(["--road", "preset bookBlind", "--entry", "34"])), vDoc(sv(["--road", "preset bookBlind", "--entry", "34", "--vis", "cautious"]))),
  "solve:vis_hold_f": () => pair(vDoc(sv(["--road", "preset bookBlind", "--entry", "34", "--vis", "cautious"])), vDoc(sv(["--road", "preset bookBlind", "--entry", "34", "--vis", "cautious", "--vis-hold", "0.5"]))),
  "solve:vis_margin": () => pair(vDoc(sv(["--road", "preset bookBlind", "--entry", "34", "--vis", "cautious", "--vis-margin", "1.0"])), vDoc(sv(["--road", "preset bookBlind", "--entry", "34", "--vis", "cautious", "--vis-margin", "1.4"]))),
  "solve:believed_road": () => pair(vDoc(sv(["--road", R25, "--entry", "44", "--turn-in", "12"])), vDoc(sv(["--road", R25, "--entry", "44", "--turn-in", "12", "--believe-road", "lane 3.5 | S 20 | R 30 ^90 | S 25"]))),
  "solve:accept": () => pair(vDoc(sv(["--road", "preset bookDoubleApex", "--entry", "30", "--style", "double_apex"])), vDoc(sv(["--road", "preset bookDoubleApex", "--entry", "30", "--style", "double_apex", "--accept", "best_failing"]))),
  "solve:constraints": () => pair(vDoc(sv(["--road", R25, "--entry", "48", "--turn-in", "12"])), vDoc(sv(["--road", R25, "--entry", "48", "--turn-in", "12", "--constraint", "f>=0.3@entry:c1..mid:c1"]))),

  // -- scene (FigureSpec — D30: one identity) --------------------------------
  "scene:lines[].name": () => pair(figEnvelope(fig("base")), figEnvelope(fig("name-b", { lineName: "b" }))),
  "scene:lines[].role": () => pair(figEnvelope(fig("base")), figEnvelope(fig("role-ref", { lineRole: "reference" }))),
  "scene:lines[].spec": () => pair(figEnvelope(fig("base")), figEnvelope(fig("spec-60", undefined, 60))),
  // the per-line MarkSpec is DRAWN, so its witness is the svg — the one line
  // is `ideal`, so the figure-level default `auto` marks it and a per-line
  // `none` takes those glyphs away (design/03 §8's "figure and per-line" scope)
  "scene:lines[].marks": () => pair(svgOf(fig("base")), svgOf(fig("line-marks-none", { lineMarks: "none" }))),
  // the per-line label is the line's legend text (design/05 §7), carried on
  // the envelope's own line record — so the envelope is its witness
  "scene:lines[].label": () => pair(figEnvelope(fig("base")), figEnvelope(fig("line-label", { lineLabel: "the racing line" }))),
  "scene:marks": () => pair(svgOf(fig("base")), svgOf(fig("marks-none", { marks: "none" }))),
  "scene:note": () => pair(figEnvelope(fig("base")), figEnvelope(fig("note", { note: "a teaching note" }))),
  // design/06 §3.1 stage 11: a placard is DRAWN, so its witness is the svg —
  // `render` ("a drawn diff of the artifact"), not `envelope`.
  "scene:placards": () => pair(svgOf(fig("base")), svgOf(fig("placards", { placards: ["DOCTRINE FIGURE - reproduces no printed figure."] }))),

  // -- view ------------------------------------------------------------------
  "view:mode": () => {
    const env = runOk("c30-plan", c30Scen());
    const lines = env.lines.filter((l): l is LineResult => !isLineRefusal(l));
    const r = renderViews({ road: env.road as unknown as ComposedRoad, lines, viewSpec: { mode: "diagram" } as never });
    return rejectOf(r as never);
  },
  "view:window": () => pair(viewSvg("w-all", { mode: "true", window: "all" }), viewSvg("w-crop", { mode: "true", window: { from: { at_s: 10 }, to: { at_s: 60 } } })),
  "view:orient": () => pair(viewSvg("o-0", { mode: "true", orient: 0 }), viewSvg("o-90", { mode: "true", orient: 90 })),
  "view:rays": () => pair(viewSvg("r-all", { mode: "true", rays: "all_turn_ins" }, "occ"), viewSvg("r-off", { mode: "true", rays: "off" }, "occ")),
  "view:legend": () => pair(viewSvg("l-on", { mode: "true", legend: "on" }), viewSvg("l-off", { mode: "true", legend: "off" })),
  "view:look": () => pair(povLookSvg("heading"), povLookSvg("limit_point")),

  // -- cli (flag-over-file merge law, in-process verbs) ----------------------
  "cli:--road": () => pair(trajDoc((rv([], rideText).stdout as { value: FigureResult }).value), trajDoc((rv(["--road", "lane 3.5 | S 80"], rideText).stdout as { value: FigureResult }).value)),
  "cli:--use-full-width": () => pair(trajDoc((rv([], c30Text).stdout as { value: FigureResult }).value), trajDoc((rv(["--use-full-width"], c30Text).stdout as { value: FigureResult }).value)),
  "cli:--bike-margin": () => pair(trajDoc((rv([], c30Text).stdout as { value: FigureResult }).value), trajDoc((rv(["--bike-margin", "1.2"], c30Text).stdout as { value: FigureResult }).value)),
  "cli:--mu": () => pair(trajDoc((rv([], brakeText).stdout as { value: FigureResult }).value), trajDoc((rv(["--mu", "0.5"], brakeText).stdout as { value: FigureResult }).value)),
  "cli:--occluder": () => pair(sightDoc((rv([], occRideText).stdout as { value: FigureResult }).value), sightDoc((rv(["--occluder", "hedge inside entry:c1 -8x20"], occRideText).stdout as { value: FigureResult }).value)),
  "cli:--hazard": () => pair(trajDoc((rv([], brakeText).stdout as { value: FigureResult }).value), trajDoc((rv(["--hazard", "gravel center s:15 0x10 width=3 mu=0.3"], brakeText).stdout as { value: FigureResult }).value)),
  "cli:--entry": () => BUILDERS["solve:entry_kmh"]!(),
  "cli:--start-f": () => pair(trajDoc((rv([], rideText).stdout as { value: FigureResult }).value), trajDoc((rv(["--start-f", "0.7"], rideText).stdout as { value: FigureResult }).value)),
  "cli:--profile": () => pair(trajDoc((rv([], c30Text).stdout as { value: FigureResult }).value), trajDoc((rv(["--profile", "casual"], c30Text).stdout as { value: FigureResult }).value)),
  "cli:--roll-rate-cap": () => pair(trajDoc((rv([], c30Text).stdout as { value: FigureResult }).value), trajDoc((rv(["--roll-rate-cap", "15"], c30Text).stdout as { value: FigureResult }).value)),
  "cli:--turn-in": () => BUILDERS["solve:turn_in"]!(),
  "cli:--brake": () => pair(vDoc(sv([], mergeText)), vDoc(sv(["--brake", "3"], mergeText))),
  "cli:--brake-slew": () => pair(vDoc(sv(["--brake", "3"], mergeText)), vDoc(sv(["--brake", "3", "--brake-slew", "1.5"], mergeText))),
  "cli:--throttle": () => pair(vDoc(sv([], mergeText)), vDoc(sv(["--throttle", "1.0"], mergeText))),
  "cli:--throttle-slew": () => pair(vDoc(sv(["--throttle", "1.0"], mergeText)), vDoc(sv(["--throttle", "1.0", "--throttle-slew", "1.0"], mergeText))),
  "cli:--throttle-freeze": () => pair(vDoc(sv(["--throttle", "0"], earlyText)), vDoc(sv(["--throttle", "0", "--throttle-freeze", "1"], earlyText))),
  "cli:--position": () => pair(vDoc(sv([], mergeText)), vDoc(sv(["--position", "f=0.5,over=10"], mergeText))),
  "cli:--style": () => BUILDERS["solve:style"]!(),
  "cli:--vis": () => BUILDERS["solve:vis"]!(),
  "cli:--vis-hold": () => BUILDERS["solve:vis_hold_f"]!(),
  "cli:--vis-margin": () => BUILDERS["solve:vis_margin"]!(),
  "cli:--constraint": () => BUILDERS["solve:constraints"]!(),
  "cli:--believe-road": () => BUILDERS["solve:believed_road"]!(),
  "cli:--accept": () => BUILDERS["solve:accept"]!(),
  "cli:--mistake": () => pair(rv([], composedText).stdout, rv(["--mistake", "premature"], composedText).stdout),
  "cli:--line-id": () => pair(rv(["--mistake", "premature"], composedText).stdout, rv(["--mistake", "premature", "--line-id", "oops"], composedText).stdout),
  "cli:--marks": () => pair(svgOf(rdr(["--mode", "true"], envText())), svgOf(rdr(["--mode", "true", "--marks", "none"], envText()))),
  "cli:--rays": () => pair(svgOf(rdr(["--mode", "true", "--rays", "auto"], occEnvText())), svgOf(rdr(["--mode", "true", "--rays", "off"], occEnvText()))),
  "cli:--legend": () => pair(svgOf(rdr(["--mode", "true", "--legend", "on"], envText())), svgOf(rdr(["--mode", "true", "--legend", "off"], envText()))),
  "cli:--orient": () => pair(svgOf(rdr(["--mode", "true", "--orient", "0"], envText())), svgOf(rdr(["--mode", "true", "--orient", "90"], envText()))),
  "cli:--look": () => pair(svgOf(rdrPov(["--look", "heading"], occEnvText())), svgOf(rdrPov(["--look", "limit_point"], occEnvText()))),
  // roll `lean` rotates the frame by phi, `level` holds it upright and puts the
  // lean on the HUD dial — a POV-only render effect, like --look
  "cli:--roll": () => pair(svgOf(rdrPov(["--roll", "lean"], occEnvText())), svgOf(rdrPov(["--roll", "level"], occEnvText()))),
  "cli:--rubric": () => rejectOf((rv(["--rubric", "parks-track"], rideText).stdout as { ok: boolean; error?: LinelabError }) as never),
  "cli:--checks-version": () => rejectOf((rv(["--checks-version", "1"], rideText).stdout as { ok: boolean; error?: LinelabError }) as never)
};

// FX-POS-STRAIGHT (design/09 §8.1): lane 3.5 | S 120, street, 34 km/h, start.f 0.2
const POS_ACTIONS: readonly Wire[] = [{ do: "position", id: "p1", at_s: 10, f: 0.9, over_m: "auto" }];
function posScen(plan: readonly Wire[]): Wire {
  return scen("fx-pos-straight", { dsl: S120 }, 34, 0.2, plan);
}

// design/09 §8.1's known-defect exceptions — the harness OBSERVES each and CI
// goes red the moment one is fixed upstream (forcing the marker's removal).
// The set is currently EMPTY; the machinery stays for the next finding:
//   (cli:--orient was a KNOWN-INERT row — the string spelling "0"/"90"
//   rejected SCHEMA/no_view_mirror. FIXED by WP-17: render/project.ts now
//   accepts the canonical numeric-string spellings.)
//   (cli:--line-id was a KNOWN-INERT row — parsed but read by no consumer.
//   FIXED by the exercise-gates package: wired to design/08 §4.1's meaning,
//   naming the primary authored line of a composed input; see the banner.)
const KNOWN_INERT = new Set<string>([]);

// ---------------------------------------------------------------------------
// The harness: observe every row

describe("D8 effectuality harness — every row observed (design/09 §8.1)", () => {
  for (const row of TABLE.rows) {
    const runner = KNOWN_INERT.has(row.id) ? it.fails : it;
    runner(`${row.id} [${row.effect_class}] expects ${row.expect}${KNOWN_INERT.has(row.id) ? " — KNOWN-INERT (WP-15 finding, see banner)" : ""}`, { timeout: 300_000 }, () => {
      const build = BUILDERS[row.id];
      expect(build, `no observation builder for row ${row.id} — the harness must OBSERVE every row`).toBeDefined();
      const obs = build!();
      if (row.expect === "effect") {
        expect(obs.kind, `row ${row.id}: an effect row needs a before/after pair`).toBe("pair");
        if (obs.kind !== "pair") return;
        expect(
          effectAt(row.effect_class, obs.before, obs.after),
          `row ${row.id}: perturbation produced NO observable ${row.effect_class} difference`
        ).toBe(true);
      } else {
        const m = /^reject:([A-Z_]+)\/([a-z_]+)$/.exec(row.expect)!;
        expect(obs.kind, `row ${row.id}: a reject row needs a typed error`).toBe("reject");
        if (obs.kind !== "reject") return;
        expect(obs.error.code).toBe(m[1]);
        if (m[2] === "deferred") {
          // phase-gating law: the deferred member IS the reason (ARCHITECTURE §6.4)
          expect(obs.error.deferred).toBeDefined();
          expect(obs.error.detail?.["reason"]).toBe("deferred");
        } else {
          expect(obs.error.detail?.["reason"]).toBe(m[2]);
        }
      }
    });
  }
});

// ---------------------------------------------------------------------------
// effectAt null-probes + the analysis class (no v0.1 rows — StandingReport /
// SaveWindow / CommitmentReport are v0.2+ — but the detector ships closed
// over all six classes now)

describe("effectAt — the six-class difference predicate", () => {
  it("is false on identical observation documents, per class", () => {
    const doc = { a: 1, nested: { b: [1, 2, 3] } };
    for (const cls of EFFECT_CLASSES) {
      expect(effectAt(cls, doc, { ...doc, nested: { b: [1, 2, 3] } })).toBe(false);
    }
    expect(effectAt("render", "<svg>x</svg>", "<svg>x</svg>")).toBe(false);
  });

  it("fires on a real difference, per class", () => {
    expect(effectAt("trajectory", { samples: [1] }, { samples: [2] })).toBe(true);
    expect(effectAt("verdict", { outcome: "contained" }, { outcome: "wide" })).toBe(true);
    expect(effectAt("sight", { channel: [10] }, { channel: [12] })).toBe(true);
    expect(effectAt("render", "<svg>a</svg>", "<svg>b</svg>")).toBe(true);
    expect(effectAt("envelope", { note: "x" }, { note: "y" })).toBe(true);
    expect(effectAt("analysis", { rungs: [3] }, { rungs: [4] })).toBe(true);
  });

  it("analysis subtracts EXACTLY the declared echo fields (reserve_checks, rubric, checks_version) — a pack echo alone is NOT an effect", () => {
    const before = { rung: 3, reserve_checks: ["lean_ceiling"], rubric: "parks-street/2", checks_version: 2 };
    const after = { rung: 3, reserve_checks: [], rubric: "parks-street/3", checks_version: 3 };
    expect(effectAt("analysis", before, after)).toBe(false); // echo-only change
    expect(effectAt("analysis", before, { ...after, rung: 4 })).toBe(true); // re-derived body moved
  });
});

// ---------------------------------------------------------------------------
// The mandated named rows (design/09 §8.1 table) — FX-POS-* fixtures

describe("T-POS-EFFECT (FX-POS-STRAIGHT)", () => {
  it("position_start and position_complete fire; f completes at 0.9 ± 0.02; the absence probe leaves f = 0.2 ± 0.02 and moves result_hash", { timeout: 60_000 }, () => {
    const withPos = runOk("pos-with", posScen(POS_ACTIONS));
    const noPos = runOk("pos-none", posScen([]));
    const l = lineOf(withPos);
    const events = l.trajectory.events;
    const complete = events.find((e) => e.kind === "position_complete");
    expect(events.some((e) => e.kind === "position_start")).toBe(true);
    expect(complete).toBeDefined();
    const fAtComplete = l.trajectory.samples.find((p) => p.s >= complete!.s)!.f;
    expect(Math.abs(fAtComplete - 0.9)).toBeLessThanOrEqual(0.02);
    const lastF = lineOf(noPos).trajectory.samples.at(-1)!.f;
    expect(Math.abs(lastF - 0.2)).toBeLessThanOrEqual(0.02);
    expect(l.verdict.result_hash).not.toBe(lineOf(noPos).verdict.result_hash);
  });
});

describe("T-POS-INEFFECTUAL (FX-POS-SHORTWIN)", () => {
  it("over_m: 6 explicit → INEFFECTUAL/position_target_unreachable with the §8.1 payload bounds", () => {
    const r = validate(posScen([{ ...POS_ACTIONS[0]!, over_m: 6 }]));
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.code).toBe("INEFFECTUAL");
    expect(r.error.detail?.["reason"]).toBe("position_target_unreachable");
    expect(r.error.detail?.["required_over_m"] as number).toBeGreaterThanOrEqual(33.5);
    expect(r.error.detail?.["achievable_dd_m"] as number).toBeLessThan(1.89);
  });
});

describe("T-POS-OVERLAP (FX-POS-OVERLAP)", () => {
  it("a position window intersecting the turn_in static commitment span → INEFFECTUAL/position_overlaps_turn_in", () => {
    const r = validate(
      scen("fx-pos-overlap", { preset: "book90" }, 34, 0.9, [
        { do: "turn_in", id: "t1", at_s: 8, target: { lean_deg: 22 } },
        { do: "position", id: "p1", at_s: 5, f: 0.5, over_m: 8 }
      ])
    );
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.code).toBe("INEFFECTUAL");
    expect(r.error.detail?.["reason"]).toBe("position_overlaps_turn_in");
  });
});

describe("T-POS-SHORTFALL (FX-POS-POSTCOMMIT)", () => {
  // ENGINE-TRUTH NOTE (recorded deviation): the design letter hosts this on
  // "book90 SOLVED line + authored post-release position" — on this engine the
  // solve-merge route refuses every post-release placement with
  // NO_SOLUTION/authored_action_conflict (the solved turn_in's static
  // commitment span covers the exit straight). The fixture therefore rides the
  // EXPLICIT-plan spelling of the same ride (turn_in 37.5° at s=5.5 — the
  // hand-calibrated book90 line), which validates under post-commit leniency
  // and exercises the identical tracker/shortfall machinery.
  it("a post-release position {f: 0.1, over_m: 8} on the 16 m exit straight validates, runs, and emits position_shortfall with deficit_m > 0; outcome class unchanged", { timeout: 60_000 }, () => {
    const r = run(
      scen("fx-pos-postcommit", { preset: "book90" }, 34, 0.9, [
        { do: "turn_in", id: "t1", at_s: 5.5, target: { lean_deg: 37.5 } },
        { do: "position", id: "p1", at_s: 38, f: 0.1, over_m: 8 }
      ])
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const l = lineOf(r.value);
    const release = l.trajectory.events.find((e) => e.kind === "release");
    const shortfall = l.trajectory.events.find((e) => e.kind === "position_shortfall");
    expect(release).toBeDefined();
    expect(release!.s).toBeLessThan(38); // genuinely post-release
    expect(shortfall).toBeDefined();
    expect(shortfall!.detail?.["deficit_m"] as number).toBeGreaterThan(0);
    expect(l.verdict.outcome).toBe("contained"); // never a silent under-move, never a reclassed line
  });
});

// ---------------------------------------------------------------------------
// Further mandated arms (design/09 §8.1's "further rows the table must carry")

describe("vis knobs under vis=none (the INEFFECTUAL arm of the vis_hold_f / vis_margin rows)", () => {
  it("vis_hold_f without the mode → INEFFECTUAL/vis_knob_without_vis_mode", () => {
    const o = solveVerb({ argv: ["--road", "preset bookBlind", "--entry", "34", "--vis-hold", "0.5"] });
    const doc = o.stdout as { ok: boolean; error?: LinelabError };
    expect(doc.ok).toBe(false);
    expect(doc.error?.code).toBe("INEFFECTUAL");
    expect(doc.error?.detail?.["reason"]).toBe("vis_knob_without_vis_mode");
  });
  it("vis_margin without the mode → INEFFECTUAL/vis_knob_without_vis_mode", () => {
    const o = solveVerb({ argv: ["--road", "preset bookBlind", "--entry", "34", "--vis-margin", "1.4"] });
    const doc = o.stdout as { ok: boolean; error?: LinelabError };
    expect(doc.ok).toBe(false);
    expect(doc.error?.code).toBe("INEFFECTUAL");
    expect(doc.error?.detail?.["reason"]).toBe("vis_knob_without_vis_mode");
  });
});

describe("--line-id wired to design/08 §4.1 (the resolved KNOWN-INERT row's named arms)", () => {
  it("names the primary authored line of a composed input; the mistake line keeps its generated id", { timeout: 120_000 }, () => {
    const o = rv(["--mistake", "premature", "--line-id", "oops"], composedText);
    const doc = o.stdout as { ok: boolean; value?: FigureResult };
    expect(doc.ok).toBe(true);
    const ids = doc.value!.lines.map((l) => l.line_id);
    expect(ids).toEqual(["oops", "premature"]);
  });

  it("colliding with the generated mistake id → DUP_ID with the <line_id>= rename hint", { timeout: 120_000 }, () => {
    const o = rv(["--mistake", "premature", "--line-id", "premature"], composedText);
    const doc = o.stdout as { ok: boolean; error?: LinelabError };
    expect(doc.ok).toBe(false);
    expect(doc.error?.code).toBe("DUP_ID");
    expect(doc.error?.detail?.["reason"]).toBe("line_id_collides_with_mistake");
    expect(doc.error?.message).toContain("<line_id>=");
  });

  it("--line-id on a figure input → SCHEMA/line_id_on_figure (figure lines are named in the spec — never accepted-and-ignored)", () => {
    const o = rv(["--line-id", "oops"], figJson());
    const doc = o.stdout as { ok: boolean; error?: LinelabError };
    expect(doc.ok).toBe(false);
    expect(doc.error?.code).toBe("SCHEMA");
    expect(doc.error?.detail?.["reason"]).toBe("line_id_on_figure");
  });
});

describe("turn_in.hand (mandated row — the schema prints no turn_in.hand path, so the witness rides here; see returned ratification items)", () => {
  const LR = "lane 3.5 | S 35 | R 30 ^70 | S 10 | L 30 ^70 | S 25";
  const lrScen = (hand: "L" | "R"): Wire =>
    scen("fx-lr-hand", { dsl: LR }, 70, 0.9, [
      { do: "brake", id: "b1", at_s: 2, decel: 4.6 },
      { do: "throttle", id: "c1", at_s: 22, accel: 0 },
      { do: "turn_in", id: "t1", at_s: 29.5, target: { lean_deg: 36.5 }, hand },
      { do: "turn_in", id: "t2", at_s: 74, target: { lean_deg: 36.5 } },
      { do: "throttle", id: "r1", at_s: 125, accel: 1.2 }
    ]);

  it("flipping an explicit hand on the two-corner fixture observably changes the trajectory", { timeout: 60_000 }, () => {
    const rR = run(lrScen("R"));
    const rL = run(lrScen("L"));
    expect(rR.ok && rL.ok).toBe(true);
    if (!rR.ok || !rL.ok) return;
    expect(effectAt("trajectory", trajDoc(rR.value), trajDoc(rL.value))).toBe(true);
  });

  it("a turn_in with no corner ahead is rejected BAD_RANGE/no_governing_corner — never silently neutral", () => {
    const r = validate(scen("fx-straight-ti", { dsl: S120 }, 34, undefined, [{ do: "turn_in", id: "t1", at_s: 10, target: { lean_deg: 20 } }]));
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.code).toBe("BAD_RANGE");
    expect(r.error.detail?.["reason"]).toBe("no_governing_corner");
  });
});

describe("every bound in the constraint vocabulary changes the solved line on the reference scenario (mandated arm of the constraints row)", () => {
  const baseArgs = ["--road", R25, "--entry", "48", "--turn-in", "12"] as const;
  const tokens = ["f>=0.3@entry:c1..mid:c1", "f<=0.9@entry:c1..mid:c1", "v_kmh<=50@entry:c1..mid:c1", "sight_margin_m>=1@entry:c1..mid:c1"] as const;
  for (const token of tokens) {
    it(`"${token.split("@")[0]}" is observable on the verdict`, { timeout: 120_000 }, () => {
      const before = vDoc(sv([...baseArgs]));
      const after = vDoc(sv([...baseArgs, "--constraint", token]));
      expect(effectAt("verdict", before, after)).toBe(true);
    });
  }
});

// ---------------------------------------------------------------------------
// T-D8-VERB-SCOPED — the surface `verify/effectuality.json` cannot reach.
//
// The committed witness table enumerates the SCHEMA's field paths, and its
// `cli` surface is driven by `FLAG_MAPPINGS` — the wire-field↔flag bijection.
// design/08 §3's VERB-SCOPED flags (`--s`, `--t`, `--corner`, `--scan-ds`,
// `--standing`, `--port`, `--views`, and the five `sweep` flags) are not wire
// fields, so no `FLAG_MAPPINGS` row exists for them and `T-D8-EXHAUSTIVE` is
// exhaustive over the composition table only. This block closes that hole with
// the same D8 quantifier, over `cli/args.ts`'s `VERB_SCOPED_FLAGS` table:
//
//   · REJECTION arm — on every shipped verb OUTSIDE the flag's effectual set,
//     the flag is `INEFFECTUAL`, exit 2, naming the dead field and the live
//     verb set. "Nothing is ever accepted-and-ignored" (ARCHITECTURE §6.4).
//   · EFFECT arm — on a verb INSIDE the set the flag observably changes stdout.
//
// The rejection arm asserts the PURE decision function `main.ts` calls, so the
// harness grades the same rule the shell enforces rather than a copy of it;
// the effect arm goes through the real command line.

describe("T-D8-VERB-SCOPED — design/08 §3's verb-scoped flags are effectual where they parse, or refused", () => {
  it("every verb-scoped flag is INEFFECTUAL on every shipped verb outside its set, naming the dead field", () => {
    const sample: Readonly<Record<string, Partial<ParsedInvocation>>> = {
      "--s": { s: 5 },
      "--t": { t: 0.5 },
      "--corner": { corner: "c1" },
      "--scan-ds": { scanDs: 0.5 },
      "--standing": { standing: true },
      "--port": { port: 4173 },
      "--views": { views: ["topdown"] },
      "--param": { param: "scenario.entry_kmh" },
      "--param2": { param2: "config.mu" },
      "--range": { range: "30:40:5" },
      "--range2": { range2: "1:2:1" },
      "--metric": { metric: "outcome" },
      "--format": { format: "json" },
      "--lock": { lock: "station" }
    };
    // the parse of a flagless invocation, used as the base every sample layers on
    const bare = parseZeroFileFlags([]);
    expect(bare.ok).toBe(true);
    if (!bare.ok) return;

    let checked = 0;
    for (const row of VERB_SCOPED_FLAGS) {
      const patch = sample[row.flag];
      expect(patch, `VERB_SCOPED_FLAGS row "${row.flag}" has no sample value in this test`).toBeDefined();
      for (const verb of SHIPPED_VERBS) {
        const parsed = { ...bare.value, ...patch } as ParsedInvocation;
        const got = ineffectualFlagFor(verb, parsed);
        if (row.verbs.includes(verb)) {
          expect(got, `${row.flag} must BITE on ${verb}`).toBeNull();
          continue;
        }
        expect(got, `${row.flag} is accepted-and-ignored on ${verb}`).not.toBeNull();
        expect(got!.code).toBe("INEFFECTUAL");
        expect(got!.at).toBe(row.flag);
        expect(got!.detail?.["verb"]).toBe(verb);
        expect(got!.detail?.["effectual_on"]).toEqual(row.verbs);
        checked++;
      }
    }
    // |VERB_SCOPED_FLAGS| × |SHIPPED_VERBS|, minus the (flag, verb) pairs that
    // bite — computed dynamically so the roster/flag additions self-adjust.
    expect(checked).toBe(VERB_SCOPED_FLAGS.length * SHIPPED_VERBS.length -
      VERB_SCOPED_FLAGS.reduce((n, r) => n + r.verbs.length, 0));
  });

  it("the two long-standing reason spellings are preserved verbatim (nothing that already asserts on them moves)", () => {
    const bare = parseZeroFileFlags([]);
    expect(bare.ok).toBe(true);
    if (!bare.ok) return;
    const standing = ineffectualFlagFor("run", { ...bare.value, standing: true } as ParsedInvocation);
    expect(standing?.detail?.["reason"]).toBe("standing_without_check");
    const scan = ineffectualFlagFor("run", { ...bare.value, scanDs: 1 } as ParsedInvocation);
    expect(scan?.detail?.["reason"]).toBe("scan_ds_without_save_window");
    const port = ineffectualFlagFor("run", { ...bare.value, port: 1 } as ParsedInvocation);
    expect(port?.detail?.["reason"]).toBe("flag_not_effectual_on_verb");
  });

  it("`--views` names a CLOSED vocabulary — an unknown token is SCHEMA/view_unknown, never silently dropped", () => {
    const bad = parseZeroFileFlags(["--views", "bogus"]);
    expect(bad.ok).toBe(false);
    if (bad.ok) return;
    expect(bad.error.code).toBe("SCHEMA");
    expect(bad.error.detail?.["reason"]).toBe("view_unknown");
    expect(bad.error.detail?.["views"]).toEqual(CLI_VIEWS);

    // and a partly-good list refuses too — the old behaviour dropped the bad token
    const mixed = parseZeroFileFlags(["--views", "controls,bogus"]);
    expect(mixed.ok).toBe(false);

    for (const v of CLI_VIEWS) {
      const good = parseZeroFileFlags(["--views", v]);
      expect(good.ok, `"${v}" is in the closed set and must parse`).toBe(true);
    }
  });
});
