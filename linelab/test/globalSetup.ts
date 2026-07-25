// test/globalSetup.ts — vitest globalSetup (wired in vitest.config.ts).
//
// Runs ONCE, single-threaded, in the main process before the worker pool
// starts. Its sole job is to build `dist/` exactly one time, so no test file
// ever has to build in its own `beforeAll` and no build ever races a spawn.
// See test/helpers/build.ts for the full rationale.

import { ensureBuilt } from "./helpers/build.js";

export default function setup(): void {
  ensureBuilt();
}
