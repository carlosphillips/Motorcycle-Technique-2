#!/usr/bin/env node
// cli/main.ts — the IO shell (ARCHITECTURE §2/§5): argv → verbs → stdout/exit.
// The ONLY file (besides bless.ts) permitted to touch fs/process/argv/stdout.
// Every verb function above this file is pure; this file's whole job is
// reading argv/files/stdin, calling the right verb, and writing
// stdout/files/exit code. `engine_semver` is package.json's version, read
// here and THREADED into envelope assembly (ARCHITECTURE §5 SEAMS: no
// version constant in pure code — deliberate).

import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { dirname, extname, normalize, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import pkg from "../../package.json" with { type: "json" };

import { isShippedVerb, DEFERRED_VERBS, deferredError } from "./deferred.js";
import { ineffectualFlagFor, parseZeroFileFlags } from "./args.js";
import { EXIT, type ExitCode } from "./exit.js";
import type { VerbOutcome } from "./verbs/shared.js";
import { runVerb } from "./verbs/run.js";
import { solveVerb } from "./verbs/solve.js";
import { mistakeVerb } from "./verbs/mistake.js";
import { figureVerb } from "./verbs/figure.js";
import { renderVerb } from "./verbs/render.js";
import { checkVerb } from "./verbs/check.js";
import { stateVerb } from "./verbs/state.js";
import { saveWindowVerb } from "./verbs/saveWindow.js";
import { schemaVerb } from "./verbs/schema.js";
import { explainVerb } from "./verbs/explain.js";
import { exportVerb } from "./verbs/export.js";
import { sweepVerb } from "./verbs/sweep.js";
import { controlsView } from "./verbs/controls.js";
import { serveVerb, type ServePlan } from "./verbs/serve.js";
import { compareVerb } from "./verbs/compare.js";

const ENGINE_SEMVER: string = pkg.version;

function readStdin(): string {
  return readFileSync(0, "utf8");
}

function tryReadFile(path: string): { ok: true; text: string } | { ok: false; message: string } {
  try {
    return { ok: true, text: readFileSync(path, "utf8") };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }
}

// A synchronous `process.exit(code)` called immediately after a large
// `process.stdout.write(...)` can truncate the write — stdout to a pipe is
// non-blocking in Node, and `exit()` does not wait for the OS write to land.
// So this file never calls `process.exit`: `fail()` throws a lightweight
// sentinel `main()` catches at the top, and both exit paths set
// `process.exitCode` and let the process end naturally once the event loop
// (and the stdout write) drains.
class CliExit {
  constructor(readonly exit: ExitCode, readonly payload: unknown) {}
}

function fail(exit: ExitCode, error: unknown): never {
  throw new CliExit(exit, { ok: false, error });
}

function writeOutputs(outcome: VerbOutcome, pretty: boolean): void {
  const text = pretty ? JSON.stringify(outcome.stdout, null, 2) : JSON.stringify(outcome.stdout);
  process.stdout.write(text + "\n");
  // design/08 §3.2's one-document discipline governs STDOUT only; §7.1 sends
  // the human summary to stderr, so a pipe still sees exactly one JSON doc.
  if (outcome.stderr !== undefined && outcome.stderr.length > 0) process.stderr.write(outcome.stderr);

  let writeFailed = false;
  for (const w of outcome.writes ?? []) {
    try {
      const dir = dirname(w.path);
      if (dir.length > 0 && dir !== ".") mkdirSync(dir, { recursive: true });
      writeFileSync(w.path, w.content, "utf8");
    } catch (e) {
      writeFailed = true;
      process.stderr.write(`write failed: ${w.path}: ${e instanceof Error ? e.message : String(e)}\n`);
    }
  }

  const finalExit: ExitCode = writeFailed && outcome.exit === EXIT.OK ? EXIT.WRITE_FAILED : outcome.exit;
  process.exitCode = finalExit;
}

function main(): void {
  const argv = process.argv.slice(2);
  const verb = argv[0];
  const rest = argv.slice(1);

  if (verb === undefined) {
    fail(EXIT.BAD_INPUT, { code: "SCHEMA", at: "verb", message: "no verb given", detail: { reason: "verb_missing" } });
  }

  // verb-level phase gating BEFORE flag parsing (ARCHITECTURE §10 pin #19).
  // `cli/deferred.ts` is the ONE table (ARCHITECTURE §6.4); there is no local
  // bypass — `serve` and `sweep` left the `inspection (v0.2)` row when they
  // shipped, which is the phase-gating law working rather than being worked
  // around.
  if (verb in DEFERRED_VERBS) {
    fail(EXIT.BAD_INPUT, deferredError("verb", verb, DEFERRED_VERBS[verb]!));
  }
  if (!isShippedVerb(verb)) {
    fail(EXIT.BAD_INPUT, {
      code: "SCHEMA",
      at: "verb",
      message: `unknown verb "${verb}"`,
      detail: { reason: "unknown_verb" }
    });
  }

  // A pre-parse solely to learn positional args / --pretty / deferred flags
  // before any file IO — main.ts's own copy; verbs re-parse `rest` themselves
  // (cheap, pure, deterministic — keeps the IO/pure boundary exact).
  const preParsed = parseZeroFileFlags(rest);
  if (!preParsed.ok) fail(EXIT.BAD_INPUT, preParsed.error);
  const pretty = preParsed.value.pretty;
  const positional0 = preParsed.value.positional[0];

  // D8 / ARCHITECTURE §6.4: "Nothing is ever accepted-and-ignored." Every
  // VERB-SCOPED flag (design/08 §3's per-verb syntax) is effectual on a named
  // set of verbs and legal-but-inert everywhere else — INEFFECTUAL, naming the
  // dead field. The decision is PURE (`cli/args.ts`'s VERB_SCOPED_FLAGS +
  // `ineffectualFlagFor`) so the D8 harness enumerates the same rule this
  // shell enforces, rather than a retyped copy of it.
  const inert = ineffectualFlagFor(verb, preParsed.value);
  if (inert !== null) fail(EXIT.BAD_INPUT, inert);

  let outcome: VerbOutcome;

  switch (verb) {
    case "run":
    case "solve":
    case "check": {
      let loadedText: string | undefined;
      if (positional0 === "-") loadedText = readStdin();
      else if (positional0 !== undefined) {
        const r = tryReadFile(positional0);
        if (!r.ok) fail(EXIT.BAD_INPUT, { code: "SCHEMA", at: verb, message: `cannot read "${positional0}": ${r.message}`, detail: { reason: "file_not_readable" } });
        loadedText = r.text;
      }
      if (verb === "check" && loadedText === undefined) {
        fail(EXIT.BAD_INPUT, { code: "SCHEMA", at: "check", message: "check needs a <scenario.json|figure.json|file.scene> argument", detail: { reason: "check_input_missing" } });
      }
      outcome =
        verb === "run"
          ? runVerb({ loadedText, argv: rest, engineSemver: ENGINE_SEMVER })
          : verb === "solve"
            ? solveVerb({ loadedText, argv: rest })
            : checkVerb({ loadedText: loadedText as string, argv: rest });
      break;
    }
    case "figure": {
      if (positional0 === undefined) {
        fail(EXIT.BAD_INPUT, { code: "SCHEMA", at: "figure", message: "figure needs a <file.scene|figure.json|-> argument", detail: { reason: "figure_input_missing" } });
      }
      const loadedText = positional0 === "-" ? readStdin() : loadFileOrFail("figure", positional0);
      outcome = figureVerb({ loadedText, argv: rest, engineSemver: ENGINE_SEMVER });
      break;
    }
    case "render": {
      if (positional0 === undefined) {
        fail(EXIT.BAD_INPUT, { code: "SCHEMA", at: "render", message: "render needs an <envelope.json> argument", detail: { reason: "render_input_missing" } });
      }
      const loadedText = positional0 === "-" ? readStdin() : loadFileOrFail("render", positional0);
      // 00 §5's view vocabulary is `topdown | controls | pov`; `controls` is a
      // VIEW, not a verb (design/08 §3's verb table carries no `controls`
      // row), so it is reached here, through `render --views`. Before this
      // registration `--views controls` was accepted and ignored — the exact
      // shape D8 forbids.
      outcome = (preParsed.value.views ?? []).includes("controls")
        ? controlsView({ loadedText, argv: rest })
        : renderVerb({ loadedText, argv: rest });
      break;
    }
    case "sweep": {
      let loadedText: string | undefined;
      if (positional0 === "-") loadedText = readStdin();
      else if (positional0 !== undefined) loadedText = loadFileOrFail("sweep", positional0);
      outcome = sweepVerb({ loadedText, argv: rest, engineSemver: ENGINE_SEMVER });
      break;
    }
    case "export": {
      if (positional0 === undefined) {
        fail(EXIT.BAD_INPUT, { code: "SCHEMA", at: "export", message: "export needs an <envelope.json> argument", detail: { reason: "export_input_missing" } });
      }
      const loadedText = positional0 === "-" ? readStdin() : loadFileOrFail("export", positional0);
      outcome = exportVerb({ loadedText, argv: rest, engineSemver: ENGINE_SEMVER });
      break;
    }
    case "state": {
      if (positional0 === undefined) {
        fail(EXIT.BAD_INPUT, { code: "SCHEMA", at: "state", message: "state needs an <envelope.json|-> argument", detail: { reason: "state_input_missing" } });
      }
      const loadedText = positional0 === "-" ? readStdin() : loadFileOrFail("state", positional0);
      outcome = stateVerb({ loadedText, argv: rest });
      break;
    }
    case "save-window": {
      if (positional0 === undefined) {
        fail(EXIT.BAD_INPUT, { code: "SCHEMA", at: "save-window", message: "save-window needs an <envelope.json|-> argument", detail: { reason: "save_window_input_missing" } });
      }
      const loadedText = positional0 === "-" ? readStdin() : loadFileOrFail("save-window", positional0);
      outcome = saveWindowVerb({ loadedText, argv: rest });
      break;
    }
    case "serve": {
      if (positional0 === undefined) {
        fail(EXIT.BAD_INPUT, { code: "SCHEMA", at: "serve", message: "serve needs a <scenario|scene|figure.json|envelope> argument", detail: { reason: "serve_input_missing" } });
      }
      const loadedText = positional0 === "-" ? readStdin() : loadFileOrFail("serve", positional0);
      const served = serveVerb({ loadedText, argv: rest, engineSemver: ENGINE_SEMVER });
      if (served.plan === null) {
        writeOutputs(served.outcome, pretty);
        return;
      }
      // `serve` "runs until closed" (design/08 §3): stdout is written once the
      // socket is actually listening, then the process stays alive on the
      // open server handle. Everything that decided WHAT to serve was pure
      // (cli/verbs/serve.ts); everything below is the IO shell.
      startViewerServer(served.plan, served.outcome, pretty);
      return;
    }
    case "compare": {
      // design/08 §3.5 — `compare <A> <B> […]`: two or more positional inputs.
      // main.ts owns the IO (read each positional file, or stdin for "-"); the
      // verb recomputes them purely. A "nothing to compare" (<2 inputs) refusal
      // is the verb's own typed SCHEMA, so the empty-input case still routes in.
      const paths = preParsed.value.positional;
      const loadedTexts: string[] = [];
      for (const p of paths) {
        loadedTexts.push(p === "-" ? readStdin() : loadFileOrFail("compare", p));
      }
      outcome = compareVerb({ loadedTexts, argv: rest, engineSemver: ENGINE_SEMVER });
      break;
    }
    case "mistake": {
      const onPath = preParsed.value.on;
      let loadedText: string | undefined;
      if (onPath === "-") loadedText = readStdin();
      else if (onPath !== undefined) loadedText = loadFileOrFail("mistake", onPath);
      outcome = mistakeVerb({ loadedText, argv: rest });
      break;
    }
    case "schema": {
      outcome = schemaVerb({ argv: rest });
      break;
    }
    case "explain": {
      let loadedText: string | undefined;
      let target: string | undefined;
      if (positional0 === "-") loadedText = readStdin();
      else if (positional0 !== undefined && existsSync(positional0)) loadedText = loadFileOrFail("explain", positional0);
      else target = positional0;
      outcome = explainVerb({ loadedText, target, argv: rest });
      break;
    }
    default:
      fail(EXIT.BAD_INPUT, { code: "SCHEMA", at: "verb", message: `unknown verb "${verb}"`, detail: { reason: "unknown_verb" } });
  }

  writeOutputs(outcome, pretty);
}

function loadFileOrFail(at: string, path: string): string {
  const r = tryReadFile(path);
  if (!r.ok) fail(EXIT.BAD_INPUT, { code: "SCHEMA", at, message: `cannot read "${path}": ${r.message}`, detail: { reason: "file_not_readable" } });
  return r.text;
}

// ---------------------------------------------------------------------------
// `serve`'s IO shell (design/08 §3; ARCHITECTURE §2 — this file and bless.ts
// are the only legal homes for a socket, exactly as they are for `fs`).
//
// It serves two things and reaches nothing: the pure `ServePlan`'s inline
// documents, and the compiled ES module graph under `dist/`, read-only, with
// a containment check on every path. No proxying, no upstream fetch, no
// write path — the viewer is a pure consumer (07 §2.4) and this server is a
// pure static origin for it.

/** `dist/` — this file compiles to `dist/cli/main.js`, so the root is one level up. */
const DIST_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const CONTENT_TYPES: Readonly<Record<string, string>> = {
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  // JSON modules (`import pack from "./x.json" with { type: "json" }`) are
  // only accepted by a browser when served as application/json.
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".svg": "image/svg+xml"
};

/** Resolve a module-mount request to a real file under `dist/`, or null. */
function resolveModuleFile(urlPath: string, moduleRoot: string): string | null {
  if (!urlPath.startsWith(moduleRoot + "/")) return null;
  let decoded: string;
  try {
    decoded = decodeURIComponent(urlPath.slice(moduleRoot.length + 1));
  } catch {
    return null;
  }
  if (decoded.includes("\0")) return null;
  const candidate = resolve(DIST_ROOT, normalize(decoded));
  if (candidate !== DIST_ROOT && !candidate.startsWith(DIST_ROOT + sep)) return null; // traversal
  const stat = statSync(candidate, { throwIfNoEntry: false });
  if (stat === undefined || !stat.isFile()) return null;
  return candidate;
}

function startViewerServer(plan: ServePlan, outcome: VerbOutcome, pretty: boolean): void {
  const byPath = new Map(plan.documents.map((d) => [d.path, d]));

  const server = createServer((req, res) => {
    const rawUrl = req.url ?? "/";
    const path = rawUrl.split("?")[0] ?? "/";
    const doc = byPath.get(path === "" ? "/" : path);
    if (doc !== undefined) {
      res.writeHead(200, { "content-type": doc.contentType, "cache-control": "no-store" });
      res.end(doc.body);
      return;
    }
    const file = resolveModuleFile(path, plan.moduleRoot);
    if (file !== null) {
      res.writeHead(200, {
        "content-type": CONTENT_TYPES[extname(file)] ?? "application/octet-stream",
        "cache-control": "no-store"
      });
      res.end(readFileSync(file));
      return;
    }
    res.writeHead(404, { "content-type": "application/json; charset=utf-8" });
    res.end(
      JSON.stringify({ ok: false, error: { code: "UNKNOWN_ID", at: path, message: `no route "${path}"`, detail: { reason: "no_route" } } })
    );
  });

  server.on("error", (e: NodeJS.ErrnoException) => {
    // A port that will not bind is an IO failure, not a bad document: tier 1,
    // the same tier a failed write takes (design/08 §3.1).
    process.stdout.write(
      JSON.stringify({
        ok: false,
        error: {
          code: "INTERNAL",
          at: "--port",
          message: `serve could not bind port ${plan.port}: ${e.message}`,
          detail: { reason: "serve_bind_failed", port: plan.port, errno: e.code ?? null }
        }
      }) + "\n"
    );
    process.exitCode = EXIT.WRITE_FAILED;
  });

  server.listen(plan.port, "127.0.0.1", () => {
    writeOutputs(outcome, pretty);
    process.stderr.write(`linelab viewer on ${plan.url} — ctrl-c to stop\n`);
  });

  // "run until closed" — a clean shutdown on either interrupt signal.
  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.on(signal, () => {
      server.close(() => {
        process.exitCode = EXIT.OK;
      });
    });
  }
}

try {
  main();
} catch (e) {
  if (e instanceof CliExit) {
    process.stdout.write(JSON.stringify(e.payload) + "\n");
    process.exitCode = e.exit;
  } else {
    process.stdout.write(JSON.stringify({ ok: false, error: { code: "INTERNAL", at: "cli", message: e instanceof Error ? e.message : String(e), detail: { reason: "uncaught_exception" } } }) + "\n");
    process.exitCode = EXIT.INTERNAL;
  }
}
