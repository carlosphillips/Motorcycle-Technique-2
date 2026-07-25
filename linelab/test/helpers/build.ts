// test/helpers/build.ts — the ONE build fixture for the whole suite.
//
// THE BUILD RACE THIS FILE EXISTS TO KILL. Roughly nine test files used to run
// `npm run build` inside their own `beforeAll`. Under vitest's parallel thread
// pool one file's build rewrote `dist/` WHILE a sibling spawned
// `node dist/cli/main.js` against it — the victim saw empty stdout /
// "Unexpected end of JSON input" / a truncated bundle. It was nondeterministic:
// the same suite passed on re-run, and each victim passed in isolation.
//
// THE FIX (structural, not tolerance). `dist/` is now built EXACTLY ONCE, in
// vitest's globalSetup phase (test/globalSetup.ts), which runs single-threaded
// in the main process BEFORE the worker pool starts. No test file builds in its
// own hook anymore, so `dist/` is never rewritten while any worker spawns
// against it. The build race is structurally impossible, not merely rare.
//
// The "rebuild only if stale" guard a prior agent added is preserved (a warm
// `dist/` costs one stat walk and writes nothing), but it can no longer fire
// concurrently: globalSetup owns the build and runs it once, ahead of everyone.

import { execFileSync } from "node:child_process";
import { readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
/** linelab/ — the package root (test/helpers/ is two levels down). */
export const repoRoot = resolve(here, "../..");
const mainJs = join(repoRoot, "dist/cli/main.js");
const srcDir = join(repoRoot, "src");

/** newest mtime under a directory tree (ms since epoch; 0 if absent). */
function newestMtime(dir: string): number {
  let newest = 0;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    newest = Math.max(newest, e.isDirectory() ? newestMtime(p) : statSync(p).mtimeMs);
  }
  return newest;
}

/**
 * Build `dist/` iff it is stale — missing binary, or older than the newest
 * source file. Idempotent and side-effect-free on a warm tree. Called ONCE
 * from test/globalSetup.ts, single-threaded, before any worker runs, so the
 * staleness guard can never race a concurrent build.
 */
export function ensureBuilt(): void {
  let fresh = false;
  try {
    fresh = statSync(mainJs).mtimeMs >= newestMtime(srcDir);
  } catch {
    fresh = false;
  }
  if (!fresh) execFileSync("npm", ["run", "build"], { cwd: repoRoot, stdio: "ignore" });
}
