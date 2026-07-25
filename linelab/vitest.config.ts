import { defineConfig } from "vitest/config";
export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    pool: "threads",
    isolate: true,
    // Build dist/ exactly once, before the worker pool starts (test/globalSetup.ts
    // → test/helpers/build.ts). No test file builds in its own beforeAll anymore,
    // so dist/ is never rewritten while a sibling spawns node dist/cli/main.js
    // against it — the build race is structurally impossible.
    globalSetup: ["./test/globalSetup.ts"],
  },
});
