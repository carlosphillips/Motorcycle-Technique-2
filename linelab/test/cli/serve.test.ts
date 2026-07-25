// test/cli/serve.test.ts — the `serve` verb (design/08 §3):
//   "serve <scenario|scene|figure.json|envelope> [--port N] — Launch the
//    viewer (07) with the payload preloaded; print the URL; run until closed."
//
// Two halves:
//
//   1. The PURE half. `cli/verbs/serve.ts` opens no socket (ARCHITECTURE §2:
//      IO lives in main.ts/bless.ts and nowhere else), so its whole contract —
//      port resolution, the payload normalization for all four accepted
//      spellings, the route list, the refusals — is asserted in-process
//      against the returned `ServePlan`, with no port bound at all.
//
//   2. The REAL half. `linelab serve` is spawned, its routes are fetched over
//      HTTP, and the payload it serves is fed back through `loadSession` to
//      prove the served spec recomputes to the same lines the CLI computed —
//      the CLI-vs-viewer identity D1 exists for. The server is torn down in
//      `afterAll` on every path.
//
// Recipe (c) (design/08 §6) is exercised end to end at the bottom; its
// `compare` leg SHIPS in v0.3 immersion (leg 3 runs the real verb, exit 0).

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { serveVerb, SERVE_DEFAULT_PORT, SERVE_MODULE_ROOT } from "../../src/cli/verbs/serve.js";
import { loadSession, type ViewerSession } from "../../src/viewer/session.js";
import type { Sample } from "../../src/core/types.js";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "../..");
const mainJs = join(repoRoot, "dist/cli/main.js");
const ENGINE_SEMVER = (JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf8")) as { version: string }).version;

/** A port well outside the ephemeral range, unique to this file. */
const TEST_PORT = 45871;

let dir = "";

interface CliResult {
  readonly exit: number;
  readonly stdout: unknown;
}

function cli(args: readonly string[]): CliResult {
  try {
    const out = execFileSync("node", [mainJs, ...args], { cwd: repoRoot, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    return { exit: 0, stdout: JSON.parse(out) };
  } catch (e) {
    const err = e as { status: number; stdout: string };
    return { exit: err.status, stdout: JSON.parse(err.stdout) };
  }
}

beforeAll(() => {
  // dist/ is built once by test/globalSetup.ts before the worker pool starts.
  dir = mkdtempSync(join(tmpdir(), "linelab-serve-"));
}, 180_000);

// ---------------------------------------------------------------------------
// 1. The pure half

const SCENARIO_SPEC = { road: "lane 3.5 | S 35 | R 30 ^90 | S 25", entry_kmh: 63 };

describe("serve — the pure plan (no socket, no fs; ARCHITECTURE §2)", () => {
  it("resolves the default port and mounts three route families", () => {
    const r = serveVerb({ loadedText: JSON.stringify(SCENARIO_SPEC), argv: [], engineSemver: ENGINE_SEMVER });
    expect(r.plan).not.toBeNull();
    expect(r.outcome.exit).toBe(0);
    expect(r.plan!.port).toBe(SERVE_DEFAULT_PORT);
    expect(r.plan!.url).toBe(`http://127.0.0.1:${SERVE_DEFAULT_PORT}/`);
    expect(r.plan!.documents.map((d) => d.path)).toEqual(["/", "/payload.json"]);
    expect(r.plan!.moduleRoot).toBe(SERVE_MODULE_ROOT);
  });

  it("--port overrides it, and the printed URL names the port that will be bound", () => {
    const r = serveVerb({ loadedText: JSON.stringify(SCENARIO_SPEC), argv: ["--port", "5199"], engineSemver: ENGINE_SEMVER });
    expect(r.plan!.port).toBe(5199);
    expect((r.outcome.stdout as { value: { url: string } }).value.url).toBe("http://127.0.0.1:5199/");
  });

  it("a port outside [0, 65535] is BAD_RANGE with nothing served", () => {
    const r = serveVerb({ loadedText: JSON.stringify(SCENARIO_SPEC), argv: ["--port", "99999"], engineSemver: ENGINE_SEMVER });
    expect(r.plan).toBeNull();
    expect(r.outcome.exit).toBe(2);
    expect((r.outcome.stdout as { error: { code: string; detail: { reason: string } } }).error.code).toBe("BAD_RANGE");
    expect((r.outcome.stdout as { error: { detail: { reason: string } } }).error.detail.reason).toBe("port_out_of_range");
  });

  it("the served payload is the SPEC — scenario + line specs, never a trajectory (07 §2.1)", () => {
    const r = serveVerb({ loadedText: JSON.stringify(SCENARIO_SPEC), argv: [], engineSemver: ENGINE_SEMVER });
    const payload = r.plan!.documents.find((d) => d.path === "/payload.json")!;
    expect(payload.contentType).toBe("application/json; charset=utf-8");
    expect(payload.body).not.toContain("samples");
    expect(payload.body).not.toContain("trajectory");
    expect(JSON.parse(payload.body)).toEqual(SCENARIO_SPEC);
  });

  it("an ENVELOPE argument is stripped to its FigureSpec and recomputed (D6)", () => {
    const envPath = join(dir, "c30.env.json");
    expect(cli(["run", "--road", SCENARIO_SPEC.road, "--entry", String(SCENARIO_SPEC.entry_kmh), "--out", envPath]).exit).toBe(0);

    const envelopeText = readFileSync(envPath, "utf8");
    const r = serveVerb({ loadedText: envelopeText, argv: [], engineSemver: ENGINE_SEMVER });
    expect(r.plan).not.toBeNull();
    const payload = JSON.parse(r.plan!.documents.find((d) => d.path === "/payload.json")!.body) as {
      road: { dsl: string };
      lines: { name: string; role: string; spec: unknown }[];
    };
    // the projection: road + per-line SOURCE specs, and nothing computed
    expect(payload.road.dsl).toBe("lane 3.5 | S 35 | R 30 ^90 | S 25");
    expect(payload.lines.length).toBe(1);
    expect(payload.lines[0]!.spec).toBeTypeOf("object");
    expect(JSON.stringify(payload)).not.toContain("result_hash");
    expect(JSON.stringify(payload)).not.toContain("samples");
    expect((r.outcome.stdout as { value: { source: string } }).value.source).toBe("envelope");
  }, 60_000);

  it("RATIFIED DEFECT — an envelope built from a hand-written BARE-STRING road projects a FigureSpec the FigureSpec door then rejects", () => {
    // `plan/types.ts` declares `SolveSpec.road: RoadSpec | string` and
    // `solve/run.ts`'s composed door accepts the string form, but
    // `plan/figure.ts`'s `validateRoadSpecShape` refuses it
    // (SCHEMA/road_not_object). `export --as figure-spec` copies `source`
    // verbatim, so the projection of such an envelope is not re-runnable —
    // through `serve`, through `compare`, or through `run`. Both CLI flag
    // paths (`run --road`, `solve --road`) normalize to `{dsl}` and are
    // unaffected; only a hand-authored `{"road": "<dsl>"}` file reaches it.
    // Recorded here so the defect cannot rot silently; the repair belongs to
    // plan/figure.ts + cli/verbs/export.ts, neither owned by this package.
    const specPath = join(dir, "string-road.spec.json");
    writeFileSync(specPath, JSON.stringify(SCENARIO_SPEC), "utf8");
    const envPath = join(dir, "string-road.env.json");
    expect(cli(["run", specPath, "--out", envPath]).exit).toBe(0); // the composed door accepts it

    const r = serveVerb({ loadedText: readFileSync(envPath, "utf8"), argv: [], engineSemver: ENGINE_SEMVER });
    expect(r.plan).not.toBeNull();
    const payload = JSON.parse(r.plan!.documents.find((d) => d.path === "/payload.json")!.body) as {
      lines: { spec: { road: unknown } }[];
    };
    expect(typeof payload.lines[0]!.spec.road).toBe("string"); // the un-coerced form
    const reloaded = loadSession(payload);
    expect(reloaded.ok).toBe(false);
    if (!reloaded.ok) {
      expect(reloaded.error.code).toBe("SCHEMA");
      expect(reloaded.error.detail?.["reason"]).toBe("road_not_object");
    }
  }, 60_000);

  it("SCENE TEXT lowers through `lowerScene` — the same D30 lowering `figure` uses", () => {
    const scene = readFileSync(join(repoRoot, "..", "figures", "fig-08-01.scene"), "utf8");
    const r = serveVerb({ loadedText: scene, argv: [], engineSemver: ENGINE_SEMVER });
    expect(r.plan, `scene did not lower: ${JSON.stringify(r.outcome.stdout)}`).not.toBeNull();
    const payload = JSON.parse(r.plan!.documents.find((d) => d.path === "/payload.json")!.body) as {
      lines: { name: string }[];
    };
    expect(payload.lines.map((l) => l.name)).toEqual(["good", "bad"]);
    expect((r.outcome.stdout as { value: { source: string } }).value.source).toBe("scene");
  });

  it("the page preloads the payload inline and loads the compiled modules — no bundler, no CDN (D1)", () => {
    const r = serveVerb({ loadedText: JSON.stringify(SCENARIO_SPEC), argv: [], engineSemver: ENGINE_SEMVER });
    const page = r.plan!.documents.find((d) => d.path === "/")!.body;
    expect(page.startsWith("<!doctype html>")).toBe(true);
    expect(page).toContain('<script type="application/json" id="payload">');
    expect(page).toContain(`<script type="module" src="${SERVE_MODULE_ROOT}/viewer/boot.js">`);
    // the only <script> tags on the page are those two — nothing is fetched
    // from another origin, and no framework is inlined
    expect(page.match(/<script/g)!.length).toBe(2);
    expect(page).not.toContain("http://");
    expect(page).not.toContain("https://");
  });

  it("garbage input refuses typed, with no plan to serve", () => {
    const r = serveVerb({ loadedText: "{ not json", argv: [], engineSemver: ENGINE_SEMVER });
    expect(r.plan).toBeNull();
    expect(r.outcome.exit).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// 2. The real half — an actual listening server

let server: ChildProcess | null = null;
let serveDoc: { url: string; port: number; figure_id: string; views: string[] } | null = null;

async function fetchText(path: string): Promise<{ status: number; contentType: string; body: string }> {
  const res = await fetch(`http://127.0.0.1:${TEST_PORT}${path}`);
  return { status: res.status, contentType: res.headers.get("content-type") ?? "", body: await res.text() };
}

async function startServer(target: string): Promise<void> {
  server = spawn("node", [mainJs, "serve", target, "--port", String(TEST_PORT)], { cwd: repoRoot });
  const doc = await new Promise<string>((resolveP, rejectP) => {
    let buf = "";
    const timer = setTimeout(() => rejectP(new Error(`serve never printed its URL; stdout so far: ${buf}`)), 30_000);
    server!.stdout!.on("data", (chunk: Buffer) => {
      buf += chunk.toString();
      if (buf.includes("\n")) {
        clearTimeout(timer);
        resolveP(buf.split("\n")[0]!);
      }
    });
    server!.on("exit", (code) => {
      clearTimeout(timer);
      rejectP(new Error(`serve exited early with code ${code}; stdout: ${buf}`));
    });
  });
  serveDoc = (JSON.parse(doc) as { value: typeof serveDoc }).value;
}

afterAll(() => {
  if (server !== null && server.exitCode === null) server.kill("SIGTERM");
  server = null;
});

describe("serve — a real listening server (design/08 §3: print the URL; run until closed)", () => {
  let envPath = "";

  beforeAll(async () => {
    envPath = join(dir, "live.env.json");
    expect(cli(["run", "--road", SCENARIO_SPEC.road, "--entry", String(SCENARIO_SPEC.entry_kmh), "--out", envPath]).exit).toBe(0);
    await startServer(envPath);
  }, 120_000);

  it("prints exactly one JSON document naming the URL and the views it offers (08 §3.2)", () => {
    expect(serveDoc).not.toBeNull();
    expect(serveDoc!.url).toBe(`http://127.0.0.1:${TEST_PORT}/`);
    expect(serveDoc!.port).toBe(TEST_PORT);
    expect(serveDoc!.views).toEqual(["topdown", "controls", "pov"]);
  });

  it("GET / serves the workstation page", async () => {
    const r = await fetchText("/");
    expect(r.status).toBe(200);
    expect(r.contentType).toContain("text/html");
    expect(r.body).toContain('id="topdown"');
    expect(r.body).toContain('id="controls"');
    expect(r.body).toContain('id="scrubber"');
    expect(r.body).toContain('id="hud"');
  });

  it("GET /payload.json serves the spec, and it recomputes in the viewer to the CLI's own lines", async () => {
    const r = await fetchText("/payload.json");
    expect(r.status).toBe(200);
    expect(r.contentType).toContain("application/json");

    // THE D1 CHECK: feed the served payload to the viewer's loader and compare
    // against the envelope the CLI wrote from the same input.
    const recomputed = loadSession(JSON.parse(r.body));
    expect(recomputed.ok, recomputed.ok ? "" : JSON.stringify(recomputed.error)).toBe(true);
    if (!recomputed.ok) return;

    const cliEnvelope = JSON.parse(readFileSync(envPath, "utf8")) as {
      lines: { line_id: string; verdict: { result_hash: string; outcome: string } }[];
    };
    expect(recomputed.value.lines.map((l) => l.line_id)).toEqual(cliEnvelope.lines.map((l) => l.line_id));
    for (const [i, line] of recomputed.value.lines.entries()) {
      expect(line.verdict.result_hash, `line ${line.line_id}`).toBe(cliEnvelope.lines[i]!.verdict.result_hash);
      expect(line.verdict.outcome).toBe(cliEnvelope.lines[i]!.verdict.outcome);
    }
  }, 60_000);

  it("serves the compiled ES module graph the page imports — the same modules the CLI runs", async () => {
    for (const path of [
      "/m/viewer/boot.js",
      "/m/viewer/app.js",
      "/m/solve/run.js",
      "/m/core/stateAt.js",
      "/m/core/integrate.js",
      "/m/render/topdown.js"
    ]) {
      const r = await fetchText(path);
      expect(r.status, path).toBe(200);
      expect(r.contentType, path).toContain("text/javascript");
      expect(r.body.length, path).toBeGreaterThan(100);
    }
    // JSON modules need application/json or the browser rejects the import
    const pack = await fetchText("/m/plan/doctrine/packs/parks-street.json");
    expect(pack.status).toBe(200);
    expect(pack.contentType).toContain("application/json");
  });

  it("refuses to leave dist/: traversal is 404, not a file", async () => {
    for (const path of ["/m/%2e%2e/package.json", "/m/%2e%2e%2f%2e%2e%2fpackage.json", "/m/../package.json"]) {
      const r = await fetchText(path);
      expect(r.status, path).toBe(404);
      expect(r.body).not.toContain('"name": "linelab"');
    }
  });

  it("an unknown route is a typed JSON 404, never HTML or a stack trace", async () => {
    const r = await fetchText("/definitely-not-a-route");
    expect(r.status).toBe(404);
    const doc = JSON.parse(r.body) as { ok: boolean; error: { code: string; detail: { reason: string } } };
    expect(doc.ok).toBe(false);
    expect(doc.error.code).toBe("UNKNOWN_ID");
    expect(doc.error.detail.reason).toBe("no_route");
  });

  it("stops cleanly on SIGTERM — nothing is left listening", async () => {
    server!.kill("SIGTERM");
    await new Promise<void>((r) => server!.on("exit", () => r()));
    server = null;
    await expect(fetchText("/")).rejects.toBeTruthy();
  }, 30_000);
});

// ---------------------------------------------------------------------------
// Recipe (c) — the blind-corner visibility compare (design/08 §6), end to end.
//
// RATIFIED ARMS (recorded in this package's return, the same discipline
// A-RECIPE-A/B already use):
//   · the doc's second command spells `--vis-margin 1.5`; on this engine that
//     bound is unsatisfiable within the four-pass self-check bound
//     (NO_SOLUTION/vis_unsatisfiable_within_bound, exit 3). The recipe's
//     STORY — a visibility-governed line that holds wide and enters slower —
//     is reproduced at the largest margin this geometry admits, and both arms
//     are asserted so neither can rot.
//   · the third command is `compare`, which ships with immersion (v0.3): leg 3
//     runs the real verb (exit 0, both verdicts pair), and design/07 §4.3's own
//     closing line — "`serve` on either envelope scrubs it" — is also delivered.

const RECIPE_C_ROAD = "lane 3.5 | S 30 | L 30 ^100 | S 30";
const RECIPE_C_OCCLUDER = "hedge inside entry:c1 -25x30 margin=1.0";

// ---------------------------------------------------------------------------
// Real teeth for A-RECIPE-C's compare clauses, as AMENDED by `adj-recipe-c`
// (design/09 §3.6 A-RECIPE-C bullet + design/08 §6(c); DEVIATIONS.md
// `adj-recipe-c`, following `adj-vis`). The design letter's original clauses
// ("min(sight_ride_m − ssd_m) strictly larger on the governed line; governed
// entry speed lower") describe a SPEED-GOVERNED mechanism the ratified engine
// deliberately does NOT use on this class of blind corner: V1's entry-speed cap
// never binds, and the sight standoff is bought entirely by V2's HOLD-WIDE
// lateral positioning (`adj-vis`). So the letter — and these tests — assert the
// hold-wide signature the physics actually produces.
//
// The gate's clauses, as amended:
//   1. both solves succeed
//   2. the WIDE COMMITMENT / hold event — the governed line carries a vis-hold
//      at the shared corner (a held wide `target_f`) that the geometry-optimal
//      line lacks
//   3. it HOLDS WIDE through the corner — its minimum ridden corridor fraction
//      never collapses to the tight apex the ungoverned braked racing line
//      dives to
//   4. both verdicts present in the compare output — asserted by leg 3 above,
//      which now runs the shipped `compare` (exit 0, one pair, two verdicts)
//   5. (08 §6(c)'s closing sentence) `serve` on either envelope scrubs it —
//      already asserted above
//
// Clauses 1–3 are asserted against the RECOMPUTED session — through `serveVerb`
// → the served `/payload.json` → `loadSession`, the same D1 recompute path a
// real browser would take, not the CLI's raw --out file — using the
// already-ratified STORY arm (vis_margin 1.2, ok:true, quality caution)
// established above, since the doc's own --vis-margin 1.5 refuses NO_SOLUTION
// before any line exists to measure.

/**
 * Minimum ridden corridor fraction `f` over the shared corner span [s0, s1] —
 * how close to the inner (usable) edge the line ever comes inside the corner
 * (`f`: 0 = inner usable edge, 1 = outer edge; core/types.ts). A hold-wide line
 * stays out near the outer edge (large min `f`); a tight-apex racing line dives
 * to the inner edge (small min `f`). Both recipe-(c) lines ride the SAME road
 * (`compare`'s own road-hash precondition), so the corner's `s0`/`s1` are
 * station-identical boundaries for both.
 */
function minCorridorFractionOverCorner(samples: readonly Sample[], s0: number, s1: number): number {
  const inCorner = samples.filter((s) => s.s >= s0 && s.s <= s1);
  return Math.min(...inCorner.map((s) => s.f));
}

/**
 * Recompute one recipe-(c) leg through the FULL serve pipeline
 * (`serveVerb` → `/payload.json` → `loadSession`) — never the CLI's raw
 * `--out` file — so "run recipe (c) end to end including `serve`, fetching
 * the payload" is literally what produces the measured numbers below.
 */
function loadRecipeCLegViaServe(dirPath: string, name: string): ViewerSession {
  const envelopeText = readFileSync(join(dirPath, name), "utf8");
  const plan = serveVerb({ loadedText: envelopeText, argv: [], engineSemver: ENGINE_SEMVER });
  expect(plan.plan, `${name} did not plan: ${JSON.stringify(plan.outcome.stdout)}`).not.toBeNull();
  const payload = JSON.parse(plan.plan!.documents.find((d) => d.path === "/payload.json")!.body);
  const loaded = loadSession(payload);
  expect(loaded.ok, `${name}: ${loaded.ok ? "" : JSON.stringify(loaded.error)}`).toBe(true);
  if (!loaded.ok) throw new Error(`unreachable — asserted above`);
  return loaded.value;
}

describe("A-RECIPE-C — blind-corner visibility compare, through `serve` (08 §6(c), 07 §4.3)", () => {
  it("leg 1 verbatim: the geometry-optimal line solves clean", () => {
    const out = join(dir, "geom.json");
    const r = cli(["solve", "--road", RECIPE_C_ROAD, "--entry", "60", "--turn-in", "auto", "--occluder", RECIPE_C_OCCLUDER, "--out", out]);
    expect(r.exit).toBe(0);
    const env = JSON.parse(readFileSync(out, "utf8")) as { lines: { verdict: { outcome: string; quality: string; sight: { holds: unknown[] } | null } }[] };
    expect(env.lines[0]!.verdict.outcome).toBe("contained");
    expect(env.lines[0]!.verdict.quality).toBe("good");
    expect(env.lines[0]!.verdict.sight!.holds.length).toBe(0); // no hold: geometry-optimal
  }, 120_000);

  it("leg 2 verbatim at --vis-margin 1.5: NO_SOLUTION/vis_unsatisfiable_within_bound (ratified arm)", () => {
    const r = cli(["solve", "--road", RECIPE_C_ROAD, "--entry", "60", "--turn-in", "auto", "--occluder", RECIPE_C_OCCLUDER, "--vis", "cautious", "--vis-margin", "1.5"]);
    expect(r.exit).toBe(3);
    const doc = r.stdout as { error: { code: string; detail: { sub_reason: string } } };
    expect(doc.error.code).toBe("NO_SOLUTION");
    expect(doc.error.detail.sub_reason).toBe("vis_unsatisfiable_within_bound");
  }, 120_000);

  it("leg 2's STORY, at the margin this geometry admits: the visibility-governed line holds wide", () => {
    const out = join(dir, "vis.json");
    cli(["solve", "--road", RECIPE_C_ROAD, "--entry", "60", "--turn-in", "auto", "--occluder", RECIPE_C_OCCLUDER, "--vis", "cautious", "--vis-margin", "1.2", "--out", out]);
    const env = JSON.parse(readFileSync(out, "utf8")) as {
      lines: { resolved_scenario: { rider: { start: { speed_kmh: number } } }; verdict: { outcome: string; sight: { holds: unknown[] } | null } }[];
    };
    const line = env.lines[0]!;
    expect(line.verdict.outcome).toBe("contained");
    expect(line.verdict.sight!.holds.length).toBeGreaterThan(0); // the hold-wide entry
  }, 120_000);

  it("leg 3 (`compare`) SHIPS in v0.3: the geometry-optimal and visibility-governed lines pair and diff", () => {
    // recipe (c)'s closing clause: `compare geom.json vis.json --lock station`.
    // Both legs carry the SAME hedge occluder (only the --vis governance differs,
    // a rider/plan difference), so the WORLD is identical (world_delta.differs
    // false); both are single-line solves → line_id "solved" → one pair whose two
    // members are the two lines' verdicts (D6: compare recomputes each from its
    // FigureSpec through the one engine).
    const r = cli(["compare", join(dir, "geom.json"), join(dir, "vis.json"), "--lock", "station"]);
    expect(r.exit).toBe(0);
    const doc = r.stdout as { ok: boolean; value: { kind: string; pairs: { line_id: string; verdict: unknown[] }[]; world_delta: { differs: boolean } } };
    expect(doc.ok).toBe(true);
    expect(doc.value.kind).toBe("compare");
    expect(doc.value.pairs.map((p) => p.line_id)).toEqual(["solved"]);
    expect(doc.value.pairs[0]!.verdict.length).toBe(2);
    expect(doc.value.world_delta.differs).toBe(false);
  }, 120_000);

  it("`serve` on EITHER envelope scrubs it (07 §4.3): both load, boot both views, and step", async () => {
    // this is the v0.2 delivery of recipe (c)'s closing sentence
    const { bootViews } = await import("../../src/viewer/views.js");
    const { hudAt } = await import("../../src/viewer/hud.js");

    for (const name of ["geom.json", "vis.json"]) {
      const envelopeText = readFileSync(join(dir, name), "utf8");
      const plan = serveVerb({ loadedText: envelopeText, argv: [], engineSemver: ENGINE_SEMVER });
      expect(plan.plan, `${name} did not plan: ${JSON.stringify(plan.outcome.stdout)}`).not.toBeNull();

      const payload = JSON.parse(plan.plan!.documents.find((d) => d.path === "/payload.json")!.body);
      const loaded = loadSession(payload);
      expect(loaded.ok, `${name}: ${loaded.ok ? "" : JSON.stringify(loaded.error)}`).toBe(true);
      if (!loaded.ok) return;

      const s = loaded.value;
      const hud = hudAt(s, s.focus, { s: 40 });
      expect(hud.ok, `${name} HUD at s=40`).toBe(true);
      for (const view of bootViews(s, hud.ok ? hud.value.instant : null)) {
        expect(view.ok, `${name}: ${view.ok ? "" : JSON.stringify(view.error)}`).toBe(true);
      }
      // the sight row the recipe's story lives in is present and readable
      if (hud.ok) {
        const sightRide = hud.value.rows.find((r) => r.label === "sight_ride_m")!;
        expect(sightRide.value).toBe(hud.value.instant.sample.sight_ride_m);
      }
    }
  }, 180_000);

  it(
    "clause 1 — 'both solves succeed' (design/09 §3.6): real trajectories, zero refusals, through the served/recomputed session",
    () => {
      for (const name of ["geom.json", "vis.json"]) {
        const session = loadRecipeCLegViaServe(dir, name);
        expect(session.refusals.length, name).toBe(0);
        expect(session.lines.length, name).toBe(1);
        expect(session.lines[0]!.trajectory.samples.length, name).toBeGreaterThan(0);
        expect(session.lines[0]!.verdict.outcome, name).toBe("contained");
      }
    },
    120_000
  );

  // -------------------------------------------------------------------------
  // Clauses 2 and 3 — the HOLD-WIDE signature (`adj-recipe-c`, following
  // `adj-vis`; DEVIATIONS.md). The design letter's original clauses ("min(
  // sight_ride_m − ssd_m) strictly larger on the governed line; governed entry
  // speed lower") describe a speed-governed mechanism the ratified engine does
  // NOT use on this class of blind corner, and MEASURE the reverse across the
  // whole feasible `--vis-margin` range — so 09 §3.6 / 08 §6(c) are amended to
  // the hold-wide signature and the two clauses below assert THAT signature as
  // real green tripwires (no `it.fails`).
  //
  // MEASURED (this engine, this fixture — the ratified `vis_margin 1.2` STORY
  // arm used throughout this describe block; road `S 30 | L 30 ^100 | S 30`,
  // occluder `hedge inside entry:c1 -25x30 margin=1.0`, both legs `--entry 60`;
  // shared corner c1 s0=30 / s1≈82.36):
  //   governed (vis)   sight.holds = [{c1, target_f 0.9, achieved_f 0.888, …}]
  //   ungoverned (geom) sight.holds = []
  //   governed  min corridor fraction f over [s0, s1] ≈ 0.817  (holds wide)
  //   ungoverned min corridor fraction f over [s0, s1] ≈ 0.038  (tight apex)
  //
  // Corroborating (recorded in DEVIATIONS `adj-recipe-c`, NOT asserted here —
  // the reason the letter's own two clauses inverted): the governed line enters
  // at the authored 60.00 km/h with no brake event (V1's cap never binds); the
  // ungoverned line brakes s∈[0, 16.76] down to 49.26 km/h for its tight-apex
  // racing line, so the raw approach `min(sight_ride_m − ssd_m)` (18.84 geom >
  // 12.61 vis) and the corner-threshold speed both point OPPOSITE the stale
  // letter — a consequence of the hold-wide mechanism, exactly as `adj-vis`
  // predicts.

  it(
    "clause 2 — the wide commitment: the governed line carries a vis-hold at the shared corner (a held wide target_f) that the geometry-optimal line lacks (design/09 §3.6, adj-recipe-c)",
    () => {
      const geom = loadRecipeCLegViaServe(dir, "geom.json");
      const vis = loadRecipeCLegViaServe(dir, "vis.json");

      // the ungoverned geometry-optimal line negotiates the corner on grip
      // alone — no visibility hold
      expect(geom.lines[0]!.verdict.sight!.holds.length, "geom carries no vis-hold").toBe(0);

      // the governed line negotiates it under a WIDE COMMITMENT: a vis-hold at
      // the shared corner carrying a held wide target_f (the adj-vis mechanism
      // that replaces the never-binding speed governor)
      const c1 = vis.road.corners[0]!.id;
      const holds = vis.lines[0]!.verdict.sight!.holds;
      expect(holds.length, "vis holds wide for sight").toBeGreaterThan(0);
      const hold = holds.find((h) => h.corner_id === c1);
      expect(hold, `a hold at the shared corner ${c1}`).toBeDefined();
      // "wide": target_f sits in the OUTER band of the corridor (f=1 is the
      // outer edge) — a held wide commitment, not a speed cap
      expect(hold!.target_f, `held commitment target_f=${hold!.target_f} is wide (outer band)`).toBeGreaterThan(0.5);
    },
    120_000
  );

  it(
    "clause 3 — holds wide vs. the tight-apex racing line: over the shared corner the governed line's min corridor fraction stays in the outer band while the ungoverned line dives to a tight apex (design/09 §3.6, adj-recipe-c)",
    () => {
      const geom = loadRecipeCLegViaServe(dir, "geom.json");
      const vis = loadRecipeCLegViaServe(dir, "vis.json");

      // shared road ⇒ station-identical corner boundaries
      const cg = geom.road.corners[0]!;
      const cv = vis.road.corners[0]!;
      expect(cv.s0, "shared corner entry station").toBe(cg.s0);
      expect(cv.s1, "shared corner exit station").toBe(cg.s1);

      const geomMinF = minCorridorFractionOverCorner(geom.lines[0]!.trajectory.samples, cg.s0, cg.s1);
      const visMinF = minCorridorFractionOverCorner(vis.lines[0]!.trajectory.samples, cg.s0, cg.s1);

      // the ungoverned line dives to a tight apex (near the inner edge)…
      expect(geomMinF, `geom min f over [${cg.s0}, ${cg.s1.toFixed(2)}]=${geomMinF.toFixed(3)} (tight apex)`).toBeLessThan(0.3);
      // …the governed line holds wide (never leaves the outer band)…
      expect(visMinF, `vis min f=${visMinF.toFixed(3)} (holds wide)`).toBeGreaterThan(0.5);
      // …the hold-wide signature, in its true (adj-vis) direction
      expect(visMinF, `hold-wide: vis min f ${visMinF.toFixed(3)} > geom min f ${geomMinF.toFixed(3)}`).toBeGreaterThan(geomMinF);
    },
    120_000
  );
});
