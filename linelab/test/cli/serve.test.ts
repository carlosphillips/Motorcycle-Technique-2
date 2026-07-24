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
// Recipe (c) (design/08 §6) is exercised end to end at the bottom, with its
// `compare` leg recorded honestly as still phase-gated to immersion (v0.3).

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { serveVerb, SERVE_DEFAULT_PORT, SERVE_MODULE_ROOT } from "../../src/cli/verbs/serve.js";
import { loadSession } from "../../src/viewer/session.js";

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
  execFileSync("npm", ["run", "build"], { cwd: repoRoot, stdio: "ignore" });
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
    expect(serveDoc!.views).toEqual(["topdown", "controls"]);
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
//   · the third command is `compare`, which is immersion (v0.3): it is still
//     phase-gated here, and design/07 §4.3's own closing line — "`serve` on
//     either envelope scrubs it" — is the v0.2 leg this package delivers.

const RECIPE_C_ROAD = "lane 3.5 | S 30 | L 30 ^100 | S 30";
const RECIPE_C_OCCLUDER = "hedge inside entry:c1 -25x30 margin=1.0";

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

  it("leg 3 (`compare`) is still phase-gated to immersion (v0.3) — the honest v0.2 statement", () => {
    const r = cli(["compare", join(dir, "geom.json"), join(dir, "vis.json"), "--lock", "station"]);
    expect(r.exit).toBe(2);
    const doc = r.stdout as { error: { code: string; deferred: string } };
    expect(doc.error.code).toBe("SCHEMA");
    expect(doc.error.deferred).toBe("immersion (v0.3)");
  });

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
});
