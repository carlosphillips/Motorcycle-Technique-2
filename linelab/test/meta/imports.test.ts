// Meta gates for the module graph (ARCHITECTURE.md §2) and cross-cutting purity laws
// (§6.2). These tests read src/**/*.ts directly with node:fs — this is the one place
// in the test suite allowed to use node builtins for that purpose (tests may use node
// builtins; product src may not, per the task brief).
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, dirname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "../.."); // linelab/
const srcRoot = join(repoRoot, "src");

/** Recursively collect every .ts file under `dir`, absolute paths, deterministic order. */
function listTsFiles(dir: string): string[] {
  const entries = readdirSync(dir, { withFileTypes: true }).sort((a, b) =>
    a.name < b.name ? -1 : a.name > b.name ? 1 : 0
  );
  const out: string[] = [];
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...listTsFiles(full));
    } else if (entry.isFile() && entry.name.endsWith(".ts")) {
      out.push(full);
    }
  }
  return out;
}

const srcFiles = statSync(srcRoot, { throwIfNoEntry: false })?.isDirectory()
  ? listTsFiles(srcRoot)
  : [];

function relSrc(file: string): string {
  return relative(srcRoot, file).split(sep).join("/");
}

// ---------------------------------------------------------------------------
// (a) Module-DAG rule (§2): a file in module M may import (via relative specifier)
// only from modules at or before M in the strict order below. `viewer/` is pinned to
// sit "beside cli" (v0.2) — same rank as cli, so it may see everything cli sees but
// cli must never import from it. Files directly at src/ root (i.e. index.ts, the
// root export surface aggregator owned by WP-15) are exempt from the outgoing check:
// they are allowed to import from any module, since aggregating the whole surface is
// their entire job.
const MODULE_ORDER = ["core", "road", "sight", "plan", "solve", "render", "cli"] as const;
const CLI_RANK = MODULE_ORDER.indexOf("cli");
const ROOT_RANK = Number.POSITIVE_INFINITY;

function moduleRankOf(fileRelSrc: string): number {
  const segments = fileRelSrc.split("/");
  const top = segments[0];
  if (segments.length === 1) return ROOT_RANK; // src/index.ts etc.
  if (top === "viewer") return CLI_RANK;
  const idx = MODULE_ORDER.indexOf(top as (typeof MODULE_ORDER)[number]);
  return idx;
}

/** Extract every static/side-effect/dynamic import specifier string from source text. */
function extractSpecifiers(text: string): string[] {
  const specs: string[] = [];
  const patterns = [
    /\bfrom\s+["']([^"']+)["']/g,
    /\bimport\s+["']([^"']+)["']\s*;/g,
    /\bimport\(\s*["']([^"']+)["']\s*\)/g
  ];
  for (const re of patterns) {
    for (const m of text.matchAll(re)) {
      const spec = m[1];
      if (spec !== undefined) specs.push(spec);
    }
  }
  return specs;
}

interface Violation {
  file: string;
  line: number;
  detail: string;
}

function findDagViolations(): Violation[] {
  const violations: Violation[] = [];
  for (const file of srcFiles) {
    const fileRel = relSrc(file);
    const fileRank = moduleRankOf(fileRel);
    if (fileRank === ROOT_RANK) continue; // root aggregator exempt (outgoing)
    const text = readFileSync(file, "utf8");
    const lines = text.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i] ?? "";
      for (const spec of extractSpecifiers(line)) {
        if (!spec.startsWith(".")) continue; // non-relative: node builtin, package, etc.
        const targetAbs = resolve(dirname(file), spec);
        const targetTsAbs = targetAbs.endsWith(".js")
          ? targetAbs.slice(0, -3) + ".ts"
          : targetAbs;
        if (!targetTsAbs.startsWith(srcRoot + sep)) continue; // outside src/, not our concern
        const targetRel = relSrc(targetTsAbs);
        const targetRank = moduleRankOf(targetRel);
        if (targetRank === ROOT_RANK) continue; // nothing should import root, but not this rule's job
        if (targetRank > fileRank) {
          violations.push({
            file: fileRel,
            line: i + 1,
            detail: `imports "${spec}" (module rank ${targetRank}) from module rank ${fileRank} — later modules may not be imported by earlier ones (order: ${MODULE_ORDER.join(" < ")})`
          });
        }
      }
    }
  }
  return violations;
}

describe("module DAG (ARCHITECTURE.md §2)", () => {
  it("a file in module M imports only from modules at or before M", () => {
    const violations = findDagViolations();
    if (violations.length > 0) {
      const msg = violations
        .map((v) => `  ${v.file}:${v.line} — ${v.detail}`)
        .join("\n");
      expect.fail(`DAG order violated by:\n${msg}`);
    }
  });
});

// ---------------------------------------------------------------------------
// (b) Forbidden identifiers (§2, §6.2): none of these may appear anywhere in src/
// except src/cli/main.ts and src/cli/bless.ts (the two legal IO shells; bless.ts also
// gets a narrow wall-clock exception for the bless date stamp).
// The IO / host shells. Two were declared by ARCHITECTURE §2 for v0.1; the
// viewer added a third at v0.2, because design/07 §3.1 requires a PLAYBACK
// CLOCK ("playback is a scheduled scrub against real time") and §6.2 requires a
// browser entry point. Both are dependency-inverted — `viewer/host.ts` is the
// single adapter behind the 3-member `ViewerHost` interface, and every other
// viewer file takes that interface as a parameter — so the exemption buys one
// file, not a module. Recorded in DEVIATIONS.md as a ratification item.
const PURITY_EXEMPT = new Set(["cli/main.ts", "cli/bless.ts", "viewer/host.ts"]);

/** The files allowed to run anything at import time. Pinned so growth is explicit. */
const SIDE_EFFECT_ENTRY_POINTS = new Set(["cli/main.ts", "cli/bless.ts", "viewer/boot.ts"]);

// Each row carries a `sample` — one canonical offending CODE line — so the
// pattern set itself can be graded ("the lint has teeth", below). A row whose
// regex is typo'd, or whose spelling the comment-skipper swallows, fails there
// instead of silently passing every file forever.
const FORBIDDEN_IDENTIFIERS: ReadonlyArray<{ name: string; pattern: RegExp; sample: string }> = [
  { name: "Date.now", pattern: /Date\.now/, sample: "const stamp = Date.now();" },
  { name: "Math.random", pattern: /Math\.random/, sample: "const jitter = Math.random();" },
  { name: "process.", pattern: /process\./, sample: "const mu = process.env.MU;" },
  { name: "node:fs", pattern: /node:fs/, sample: 'import { readFileSync } from "node:fs";' },
  { name: "Intl.", pattern: /Intl\./, sample: "const f = new Intl.NumberFormat();" },
  { name: "toLocale", pattern: /toLocale/, sample: "return v.toLocaleString();" },
  // ---- added after a review found the clock surface unlinted --------------
  // §6.2's "no clock" is about REAL TIME, not about `Date.now` in particular:
  // a `performance.now()` or a `setInterval` anywhere else in src/ is the same
  // determinism break by a different spelling, and until this row existed the
  // lint could not see either.
  { name: "performance", pattern: /\bperformance\b/, sample: "const t0 = performance.now();" },
  { name: "setInterval / clearInterval", pattern: /\b(set|clear)Interval\b/, sample: "const h = setInterval(tick, 16);" },
  { name: "setTimeout / clearTimeout", pattern: /\b(set|clear)Timeout\b/, sample: "setTimeout(tick, 16);" },
  { name: "requestAnimationFrame", pattern: /\brequestAnimationFrame\b/, sample: "requestAnimationFrame(draw);" },
  { name: "queueMicrotask", pattern: /\bqueueMicrotask\b/, sample: "queueMicrotask(draw);" },
  { name: "globalThis", pattern: /\bglobalThis\b/, sample: "const g = globalThis as DomLike;" },
  // `Buffer` is a NODE global: a file using it cannot run in the browser, which
  // is the half of D1 the DAG alone does not enforce.
  { name: "Buffer", pattern: /\bBuffer\b/, sample: "return Buffer.from(s, \"utf8\");" }
];

/**
 * A COMMENT-ONLY line — `// …`, `/* …`, or a jsdoc `* …` continuation. The lint
 * grades CODE: a banner that names a forbidden identifier in order to explain
 * why it is forbidden is documentation, not a use. Code lines are never
 * truncated (a `//` mid-line could sit inside a string literal such as an XML
 * namespace URL), so nothing can hide a real use behind a trailing comment.
 */
function isCommentLine(line: string): boolean {
  const s = line.trim();
  return s.startsWith("//") || s.startsWith("/*") || s.startsWith("*");
}

/**
 * The scan, as a PURE function of text: the 1-indexed code lines of `text`
 * matching `pattern`. Split out from the file walk so the pattern set can be
 * graded against sample lines without touching the disk.
 */
function scanText(pattern: RegExp, text: string): number[] {
  const hits: number[] = [];
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    if (isCommentLine(line)) continue;
    if (pattern.test(line)) hits.push(i + 1);
  }
  return hits;
}

function findForbiddenUses(pattern: RegExp): Violation[] {
  const violations: Violation[] = [];
  for (const file of srcFiles) {
    const fileRel = relSrc(file);
    if (PURITY_EXEMPT.has(fileRel)) continue;
    const text = readFileSync(file, "utf8");
    const lines = text.split("\n");
    for (const n of scanText(pattern, text)) {
      violations.push({ file: fileRel, line: n, detail: (lines[n - 1] ?? "").trim() });
    }
  }
  return violations;
}

describe("purity lint — forbidden identifiers (§6.2, no RNG/no clock/no locale/no fs)", () => {
  for (const { name, pattern } of FORBIDDEN_IDENTIFIERS) {
    it(`"${name}" appears nowhere in src/ outside the declared shells`, () => {
      const violations = findForbiddenUses(pattern);
      if (violations.length > 0) {
        const msg = violations.map((v) => `  ${v.file}:${v.line} — ${v.detail}`).join("\n");
        expect.fail(`forbidden identifier "${name}" found in:\n${msg}`);
      }
    });
  }

  it("the lint has teeth: every row catches its own spelling in CODE, and none of them fires on a comment", () => {
    // Without this, a typo'd regex (or a row whose spelling `isCommentLine`
    // swallows) passes every file forever and the lint reads green while seeing
    // nothing — which is precisely how `performance.now()` and `setInterval`
    // went unlinted until the review found them.
    for (const { name, pattern, sample } of FORBIDDEN_IDENTIFIERS) {
      expect(scanText(pattern, sample), `"${name}" does not match its own sample line: ${sample}`).toEqual([1]);
      expect(scanText(pattern, `// ${sample}`), `"${name}" fires on a comment`).toEqual([]);
      expect(scanText(pattern, ` * ${sample}`), `"${name}" fires on a jsdoc continuation`).toEqual([]);
    }
    // …and a clean line matches nothing at all
    for (const { name, pattern } of FORBIDDEN_IDENTIFIERS) {
      expect(scanText(pattern, "const y = lerp(a.s, b.s, alpha);"), `"${name}" fires on clean code`).toEqual([]);
    }
  });

  it("the exemption set is exactly the three declared shells — growing it is an explicit edit, never a drift", () => {
    expect([...PURITY_EXEMPT].sort()).toEqual(["cli/bless.ts", "cli/main.ts", "viewer/host.ts"]);
    for (const f of PURITY_EXEMPT) {
      expect(srcFiles.map(relSrc), `exempt file ${f} does not exist`).toContain(f);
    }
  });

  it("`viewer/host.ts` earns its exemption: it is the ONLY viewer file naming a host global, and every other viewer file takes ViewerHost as a parameter", () => {
    const hostGlobals = /\bglobalThis\b|\bperformance\b|\b(set|clear)Interval\b/;
    const offenders = srcFiles
      .map(relSrc)
      .filter((f) => f.startsWith("viewer/") && f !== "viewer/host.ts")
      .filter((f) =>
        readFileSync(join(srcRoot, f), "utf8")
          .split("\n")
          .some((line) => !isCommentLine(line) && hostGlobals.test(line))
      );
    expect(offenders).toEqual([]);
  });

  it("only the declared entry points run anything at import time", () => {
    // A top-level side effect makes a module unimportable-without-consequence.
    // Detected structurally: a top-level line that is a bare call statement
    // (`foo();`) at column 0, which is what `viewer/boot.ts`'s `bootFromPage();`
    // and `cli/main.ts`'s `try { main(); }` are.
    const bareCall = /^[A-Za-z_$][\w$.]*\(.*\);\s*$|^try \{\s*$/;
    const offenders: string[] = [];
    for (const file of srcFiles) {
      const rel = relSrc(file);
      if (SIDE_EFFECT_ENTRY_POINTS.has(rel)) continue;
      for (const line of readFileSync(file, "utf8").split("\n")) {
        if (!isCommentLine(line) && bareCall.test(line)) {
          offenders.push(`${rel} — ${line.trim()}`);
          break;
        }
      }
    }
    expect(offenders).toEqual([]);
    expect([...SIDE_EFFECT_ENTRY_POINTS].sort()).toEqual(["cli/bless.ts", "cli/main.ts", "viewer/boot.ts"]);
  });
});

// ---------------------------------------------------------------------------
// (b2) The units law (ARCHITECTURE §6.1 + drift risk #1): `core/units.ts` holds
// "the ONLY conversion helpers", and "any formula touching roll_rate or record
// angles converts via these — never an inline `* Math.PI / 180`". An inline
// factor is invisible to every numeric test — `p.v * 3.6` and `msToKmh(p.v)`
// are the same f64 — so a source lint is the only thing that can hold the law.
// (The strip's chips and its `v` channel both inlined `* 3.6` until a review
// found them; nothing numeric could have caught it.)

const CONVERSION_FACTORS: ReadonlyArray<{ name: string; pattern: RegExp; sample: string }> = [
  { name: "km/h ↔ m/s (× or ÷ 3.6)", pattern: /[*/]\s*3\.6\b/, sample: "const kmh = p.v * 3.6;" },
  {
    name: "deg ↔ rad (180 / Math.PI)",
    pattern: /180\s*\/\s*Math\.PI|Math\.PI\s*\/\s*180/,
    sample: "const deg = rad * (180 / Math.PI);"
  }
];

/**
 * The conversion helpers' own home, plus the files that already inlined a
 * factor before this lint existed. This is a RATCHET, not a blessing: the set
 * may only shrink. Each entry is a live finding — the fix is to route the line
 * through `core/units.ts` and delete the entry.
 *
 *   solve/chained.ts:518, solve/doubleApex.ts:485, solve/vis.ts:352, :373,
 *   plan/doctrine/metrics.ts:275   — `(180 / Math.PI) * …` instead of `radToDeg`
 *   cli/bless.ts:367               — `v_kmh / 3.6` instead of `kmhToMs`
 */
const INLINE_CONVERSION_KNOWN = new Set([
  "core/units.ts", // the owner: the factors live here and nowhere else
  "solve/chained.ts",
  "solve/doubleApex.ts",
  "solve/vis.ts",
  "plan/doctrine/metrics.ts",
  "cli/bless.ts"
]);

describe("units law — core/units.ts holds the only conversion helpers (ARCHITECTURE §6.1)", () => {
  it("the factor patterns have teeth", () => {
    for (const { name, pattern, sample } of CONVERSION_FACTORS) {
      expect(scanText(pattern, sample), `"${name}" does not match its own sample`).toEqual([1]);
      expect(scanText(pattern, `// ${sample}`), `"${name}" fires on a comment`).toEqual([]);
      // the section marks that riddle these files ("07 §3.6", "design/03 §2")
      // are not conversion factors
      expect(scanText(pattern, 'const label = "07 §3.6 overlay";'), `"${name}" fires on a section mark`).toEqual([]);
    }
  });

  it("no file inlines a unit-conversion factor outside the declared ratchet — and the ratchet never grows", () => {
    const offenders = new Map<string, string[]>();
    for (const file of srcFiles) {
      const rel = relSrc(file);
      const text = readFileSync(file, "utf8");
      const lines = text.split("\n");
      for (const { name, pattern } of CONVERSION_FACTORS) {
        for (const n of scanText(pattern, text)) {
          const at = `${rel}:${n} [${name}] ${(lines[n - 1] ?? "").trim()}`;
          offenders.set(rel, [...(offenders.get(rel) ?? []), at]);
        }
      }
    }
    const unexpected = [...offenders.entries()]
      .filter(([rel]) => !INLINE_CONVERSION_KNOWN.has(rel))
      .flatMap(([, hits]) => hits);
    if (unexpected.length > 0) {
      expect.fail(
        `inline unit conversion outside core/units.ts (ARCHITECTURE §6.1 names it "the ONLY conversion helpers"):\n${unexpected
          .map((h) => `  ${h}`)
          .join("\n")}`
      );
    }
    // the display layers — where a stray `* 3.6` is likeliest and least visible
    // — carry none at all
    for (const rel of offenders.keys()) {
      expect(rel.startsWith("render/") || rel.startsWith("viewer/"), `${rel} inlines a conversion factor`).toBe(false);
    }
  });
});

// ---------------------------------------------------------------------------
// (c) C-ONE-CORE — the module-graph lint (design/09 §6).
//
// The design's words: "the viewer's recompute path and the CLI's solve path
// resolve to ONE engine/ module — a single entry imported by both viewer/ and
// cli/, with no second copy of the engine in either bundle… Recomputing a
// trajectory and comparing it to the CLI's is a tautology … so that
// recompute-equality is kept only as a cheap sentinel; the LINT is the
// guarantee."
//
// This build has no bundler: `linelab serve` mounts the emitted `dist/` module
// graph read-only and the browser's own resolver walks it (viewer/page.ts →
// `<script type="module" src="<root>/viewer/boot.js">`), so the "bundle" is
// exactly the transitive relative-import closure of each entry. The lint walks
// that closure over `src/` — which NodeNext emits 1:1 — from both entries and
// asserts:
//
//   1. the engine module `core/integrate.ts` is REACHED by both closures;
//   2. it is reached at the SAME path (one module, not two copies);
//   3. no other file in src/ defines an integrator (the rk4 grep, kept as the
//      cheap sentinel the design describes);
//   4. the CLI closure and the viewer closure INTERSECT on the whole engine
//      core — every core/ file either entry pulls in is the same file.

const ENGINE_MODULE = "core/integrate.ts";
const CLI_ENTRY = "cli/main.ts";
const VIEWER_ENTRY = "viewer/boot.ts";

/** The transitive relative-import closure of one src file, as src-relative paths. */
function moduleClosure(entryRel: string): Set<string> {
  const seen = new Set<string>();
  const queue = [entryRel];
  while (queue.length > 0) {
    const rel = queue.pop()!;
    if (seen.has(rel)) continue;
    const abs = join(srcRoot, rel);
    if (statSync(abs, { throwIfNoEntry: false }) === undefined) continue;
    seen.add(rel);
    for (const spec of extractSpecifiers(readFileSync(abs, "utf8"))) {
      if (!spec.startsWith(".")) continue;
      const targetAbs = resolve(dirname(abs), spec);
      const targetTs = targetAbs.endsWith(".js") ? targetAbs.slice(0, -3) + ".ts" : targetAbs;
      if (!targetTs.startsWith(srcRoot + sep)) continue;
      queue.push(relSrc(targetTs));
    }
  }
  return seen;
}

describe("C-ONE-CORE — one engine module, reached by both the CLI and the viewer (design/09 §6)", () => {
  it("both entry points' module closures reach the SAME core/integrate module", () => {
    const cli = moduleClosure(CLI_ENTRY);
    const viewer = moduleClosure(VIEWER_ENTRY);
    expect(cli.has(CLI_ENTRY)).toBe(true);
    expect(viewer.has(VIEWER_ENTRY)).toBe(true);
    expect(cli.has(ENGINE_MODULE), "the CLI closure does not reach the engine").toBe(true);
    expect(viewer.has(ENGINE_MODULE), "the viewer closure does not reach the engine").toBe(true);
    // there is exactly ONE file in src/ that could be the engine
    const engineCopies = srcFiles.map(relSrc).filter((f) => /(^|\/)integrate\.ts$/.test(f));
    expect(engineCopies).toEqual([ENGINE_MODULE]);
  });

  it("every core/ module the viewer reaches is the very file the CLI reaches — no forked engine core", () => {
    const cli = moduleClosure(CLI_ENTRY);
    const viewer = moduleClosure(VIEWER_ENTRY);
    const viewerCore = [...viewer].filter((f) => f.startsWith("core/")).sort();
    expect(viewerCore.length).toBeGreaterThan(5);
    for (const f of viewerCore) {
      expect(cli.has(f), `viewer reaches ${f}; the CLI does not — the two paths have forked`).toBe(true);
    }
  });

  it("the viewer never imports from cli/, so `serve`'s cli→viewer edge cannot become a cycle", () => {
    // design/07 §2.2 + design/08 §3 require `serve` to open the viewer, so ONE
    // cli→viewer edge exists (cli/verbs/serve.ts → viewer/page.ts). The reverse
    // direction would make the two ranks mutually dependent and is forbidden.
    const offenders: string[] = [];
    for (const file of srcFiles) {
      const rel = relSrc(file);
      if (!rel.startsWith("viewer/")) continue;
      for (const spec of extractSpecifiers(readFileSync(file, "utf8"))) {
        if (spec.startsWith(".") && resolve(dirname(file), spec).startsWith(join(srcRoot, "cli") + sep)) {
          offenders.push(`${rel} → ${spec}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it("the SERVED graph carries one engine too: dist/ holds exactly one core/integrate.js", () => {
    // `cli/verbs/serve.ts` mounts `dist/` at SERVE_MODULE_ROOT and the browser
    // resolves specifiers against it, so a second emitted copy of the engine
    // would be a second engine on the wire. Skipped (not failed) when dist/ is
    // absent: this file must stay runnable before a build.
    const distRoot = join(repoRoot, "dist");
    if (statSync(distRoot, { throwIfNoEntry: false }) === undefined) return;
    const found: string[] = [];
    const walk = (dir: string): void => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (entry.isFile() && entry.name === "integrate.js") found.push(relative(distRoot, full).split(sep).join("/"));
      }
    };
    walk(distRoot);
    expect(found).toEqual(["core/integrate.js"]);
  });
});

// The cheap sentinel the design names beside the lint: only src/core/integrate.ts
// may contain the integrator loop. No other src file may mention rk4/RK4.
describe("one engine (C-ONE-CORE sentinel)", () => {
  it("no src file other than core/integrate.ts matches /rk4|RK4/", () => {
    const pattern = /rk4|RK4/;
    const owner = "core/integrate.ts";
    const violations: Violation[] = [];
    for (const file of srcFiles) {
      const fileRel = relSrc(file);
      if (fileRel === owner) continue;
      const lines = readFileSync(file, "utf8").split("\n");
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i] ?? "";
        if (pattern.test(line)) {
          violations.push({ file: fileRel, line: i + 1, detail: line.trim() });
        }
      }
    }
    if (violations.length > 0) {
      const msg = violations.map((v) => `  ${v.file}:${v.line} — ${v.detail}`).join("\n");
      expect.fail(`rk4/RK4 found outside the sole integrator (${owner}):\n${msg}`);
    }
  });
});

// ---------------------------------------------------------------------------
// Sanity: the suite must actually be exercising files, once src/ has real content
// beyond the WP-00 stub. This does not fail on the stub tree (src/index.ts only) —
// it only guards against the scanner silently finding zero files due to a path bug.
describe("meta scanner sanity", () => {
  it("finds at least the src/index.ts stub", () => {
    expect(srcFiles.length).toBeGreaterThan(0);
    expect(srcFiles.some((f) => relSrc(f) === "index.ts")).toBe(true);
  });
});
