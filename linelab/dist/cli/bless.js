#!/usr/bin/env node
// cli/bless.ts — `linelab-bless` (design/09 §3.2a; D35; ARCHITECTURE §5, §6.3).
//
// The bless pipeline, an IO SHELL driving pure library calls:
//
//   1. Run the analytic-acceptance layer (`A-AN-*`) AND `D-BOUNDS` — the
//      vitest child process is the ONE sanctioned child-process use (this file
//      is an IO shell; design/09 §3.2a step 3). If either is red, bless
//      MECHANICALLY REFUSES: exit 3, nothing written (`A-BLESS-REFUSES`).
//   2. Integrate the golden roster (the C30 family + book90-ideal + the
//      G-* engine fixtures of design/09 §3.2) and capture RAW full-precision
//      f64 quantities via the bless-only tap BEFORE emission rounding — the
//      tap reads the frozen raw Sample record + a raw `analyzeCorners` pass,
//      never the sealed (rounded) verdict scalars (solve/emit.ts header;
//      ARCHITECTURE §6.3 drift risk #2). Categorical fields (outcome,
//      quality, check verdicts, result_hash) come off the sealed verdict —
//      categoricals are not rounded.
//   3. Write the golden fixtures to test/fixtures/goldens/<id>.json.
//   4. With --write-docs: regenerate the BLESSED block between the markers in
//      design/02-physics-model.md §8.1 (sole writer; hand edits between the
//      markers are forbidden; T-BLESSED-DOC-SYNC keeps doc ⇔ fixtures in
//      byte-sync). D35 authorizes exactly this write into design/.
//   5. Re-stamp committed FigureSpec fixtures (test/fixtures/figures/*.json,
//      if any): `engine_semver` + per-line `expected {outcome, result_hash}`
//      — committed stamps are goldens and move only in re-bless commits
//      (design/09 §3.3f).
//
// Exit tiers (design/08 §3.1): 0 green; 2 usage; 3 gate refusal (red analytic
// layer / refusing roster fixture); 4 believed-impossible internal.
//
// ENGINE-TRUTH DEVIATIONS captured in the roster (all inherited from frozen
// upstream packages and PENDING RATIFICATION — see WP-16's returned notes):
//   - C30 solves at 63 km/h, not 02 §8's 70 (WP-10's A-AN-SOLVER-KISS seam).
//   - C30-DR rides the bookDecreasing-shaped taper `R 16>9 ^130` mirrored to
//     C30's right hand with accept=best_failing — 02 §8.2's `R40→R25` letter
//     has an EMPTY clean band on this engine at every probed entry.
//   - G-CORR-WIDE's base solves clean at 32 km/h (not 34); its premature line
//     comes out `runoff` with corrective infeasible on this engine, not the
//     designed `wide` (an engine finding under the oracle's iron rule — the
//     roster records engine truth; goldens are blessed, never asserted here).
//   - G-8.5-RED / G-8.4-COMPANION (scene bakes) are NOT in this roster: both
//     committed scenes currently produce per-line refusals; their pinned
//     goldens land with WP-17's bake, which owns the scene/bake interplay.
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import process from "node:process";
import { RIDER_PROFILES } from "../core/constants.js";
import { analyzeCorners } from "../core/analyze.js";
import { compose } from "../road/compose.js";
import { run, ENGINE_SEMVER } from "../solve/run.js";
import { chainedSolve } from "../solve/chained.js";
import { compileMistake } from "../solve/mistake.js";
import { isLineRefusal, stampExpected } from "../solve/envelope.js";
const C30_DSL = "lane 3.5 | S 35 | R 30 ^90 | S 25";
const C30_LR_DSL = "lane 3.5 | S 35 | R 30 ^70 | S 10 | L 30 ^70 | S 25";
/** engine-truth taper twin (see file banner) */
const C30_DR_DSL = "lane 3.5 | S 10 | R 16>9 ^130 | S 14";
function scenario(id, dsl, entry_kmh, f, plan) {
    return {
        spec: "linelab/1",
        id,
        road: { dsl },
        rider: { profile: "street", start: { speed_kmh: entry_kmh, ...(f !== undefined ? { f } : {}) }, plan }
    };
}
export const BLESS_ROSTER = [
    {
        id: "C30",
        blessed_line: "solved",
        input: { kind: "run", input: { road: C30_DSL, entry_kmh: 63 } }
    },
    {
        id: "C30-LR",
        input: {
            kind: "run",
            input: scenario("C30-LR", C30_LR_DSL, 70, 0.9, [
                { do: "brake", id: "b1", at_s: 2, decel: 4.6 },
                { do: "throttle", id: "c1", at_s: 22, accel: 0 },
                { do: "turn_in", id: "t1", at_s: 29.5, target: { lean_deg: 36.5 } },
                { do: "turn_in", id: "t2", at_s: 74, target: { lean_deg: 36.5 } },
                { do: "throttle", id: "r1", at_s: 125, accel: 1.2 }
            ])
        }
    },
    {
        id: "C30-chop",
        blessed_line: "chop",
        input: { kind: "run", input: { road: C30_DSL, entry_kmh: 63, mistake: { kind: "chop" } } }
    },
    {
        id: "C30-trailbrake",
        blessed_line: "C30-trailbrake",
        input: {
            kind: "run",
            input: scenario("C30-trailbrake", C30_DSL, 55, 0.9, [
                { do: "brake", id: "b1", at_s: 2, decel: 2.0 },
                { do: "turn_in", id: "t1", at_s: 29.5, target: { lean_deg: 19.5 } },
                { do: "throttle", id: "r0", at_s: 36, accel: 0 },
                { do: "throttle", id: "r1", at_s: 65, accel: 1.0 }
            ])
        }
    },
    {
        id: "C30-squeeze",
        input: {
            kind: "run",
            input: scenario("C30-squeeze", C30_DSL, 70, 0.9, [
                { do: "brake", id: "b1", at_s: 2, decel: 4.6 },
                { do: "throttle", id: "c1", at_s: 22, accel: 0 },
                { do: "turn_in", id: "t1", at_s: 29.5, target: { lean_deg: 36.5 } },
                { do: "brake", id: "b2", at_s: 50, decel: 2.0, slew_mss: 4 },
                { do: "throttle", id: "c2", at_s: 70, accel: 0 }
            ])
        }
    },
    {
        id: "C30-heldbrake",
        input: {
            kind: "run",
            input: scenario("C30-heldbrake", C30_DSL, 56.5, 0, [
                { do: "turn_in", id: "t1", at_s: 35, target: { lean_deg: 40 } },
                { do: "brake", id: "b1", at_s: 52, decel: 8.0 }
            ])
        }
    },
    {
        id: "C30-deeplean",
        input: {
            kind: "run",
            input: scenario("C30-deeplean", C30_DSL, 56.5, undefined, [
                { do: "turn_in", id: "t1", at_s: 33, target: { lean_deg: 40 } },
                { do: "brake", id: "b1", at_s: 48, decel: 9.0 }
            ])
        }
    },
    {
        id: "C30-stop",
        input: {
            kind: "run",
            input: scenario("C30-stop", C30_DSL, 60, 0.9, [{ do: "brake", id: "b1", at_s: 0, decel: 7.0 }])
        }
    },
    ...[10, 20, 40, 80].map((slew) => ({
        id: `C30-chop-sweep-${slew}`,
        input: {
            kind: "run",
            input: { road: C30_DSL, entry_kmh: 63, mistake: { kind: "chop", params: { slew_mss: slew } } }
        }
    })),
    {
        id: "C30-DR",
        blessed_line: "solved",
        input: { kind: "run", input: { road: C30_DR_DSL, entry_kmh: 34, accept: "best_failing" } }
    },
    {
        id: "book90-ideal",
        input: { kind: "run", input: { road: "book90", entry_kmh: 34 } }
    },
    {
        id: "G-CORR-RUNOFF",
        input: { kind: "run", input: { road: "book90", entry_kmh: 34, mistake: { kind: "premature" } } }
    },
    {
        id: "G-CORR-WIDE",
        input: { kind: "run", input: { road: { preset: "book90", hand: "R" }, entry_kmh: 32, mistake: { kind: "premature" } } }
    },
    {
        id: "G-MISJUDGE-DR",
        input: {
            kind: "mistake_on_base",
            baseSpec: { road: "bookDecreasing", entry_kmh: 34 },
            baseAccept: "best_failing",
            mistake: { kind: "underread" }
        }
    }
];
/** fixtures whose rows feed the 02 §8.1 blessed block (design/09 §3.2a write-back format). */
export const BLESSED_BLOCK_FIXTURES = ["C30", "C30-chop", "C30-trailbrake", "C30-DR"];
export function tolLabelsFrom(tolerancesJson) {
    const cats = tolerancesJson.categories ?? [];
    const label = (name, fallback) => {
        const row = cats.find((c) => c.category === name);
        return `±${row?.tol ?? fallback}`;
    };
    return {
        positions: label("positions", 0.01),
        angles: label("angles", 0.01),
        speeds: label("speeds", 0.01),
        apex_pct: label("apex_pct", 0.1),
        fractions: label("fractions", 0.001)
    };
}
// ---------------------------------------------------------------------------
// The raw tap: quantities off the frozen trajectory + a raw analyzeCorners pass
function trajStats(samples) {
    let phi = 0;
    let grip = Number.POSITIVE_INFINITY;
    let v = Number.POSITIVE_INFINITY;
    for (const p of samples) {
        const a = Math.abs(p.phi);
        if (a > phi)
            phi = a;
        if (p.grip < grip)
            grip = p.grip;
        if (p.v < v)
            v = p.v;
    }
    return { phi_max_deg: phi, grip_min: grip, v_min_ms: v };
}
function rawAnalysis(line, road) {
    const profile = line.resolved_scenario.rider.profile;
    const skill = RIDER_PROFILES[profile].skill;
    return analyzeCorners(line.trajectory, road, skill);
}
function eventsOf(traj) {
    return traj.events.map((e) => ({
        kind: e.kind,
        s: e.s,
        t: e.t,
        ...(e.corner_id !== undefined ? { corner_id: e.corner_id } : {}),
        ...(e.action_id !== undefined ? { action_id: e.action_id } : {})
    }));
}
function lineRecord(line, road) {
    const stats = trajStats(line.trajectory.samples);
    return {
        line_id: line.line_id,
        role: line.role,
        outcome: line.verdict.outcome,
        quality: line.verdict.quality,
        result_hash: line.verdict.result_hash,
        terminated: {
            reason: line.trajectory.terminated.reason,
            s: line.trajectory.terminated.s,
            t: line.trajectory.terminated.t
        },
        events: eventsOf(line.trajectory),
        corners: rawAnalysis(line, road).corners,
        ...stats,
        checks: line.verdict.doctrine.checks.map((c) => ({ id: c.id, verdict: c.verdict }))
    };
}
/** the 02 §8-enumerated quantities present on this line (raw f64 via the tap). */
export function blessedRowsFor(fixture, line, road, tol) {
    const rows = [];
    const push = (quantity, value, unit, t) => {
        if (value !== undefined && !(typeof value === "number" && !Number.isFinite(value))) {
            rows.push({ fixture, quantity, value, unit, tol: t });
        }
    };
    const samples = line.trajectory.samples;
    const events = line.trajectory.events;
    const stats = trajStats(samples);
    const analysis = rawAnalysis(line, road);
    const c1 = analysis.corners[0];
    const apex = c1 !== undefined && c1.apexes.length > 0
        ? c1.apexes.reduce((a, b) => (b.f < a.f ? b : a))
        : undefined;
    let leanCommit = 0;
    for (const p of samples)
        leanCommit = Math.max(leanCommit, Math.abs(p.cmd_lean));
    const last = samples[samples.length - 1];
    push("turn_in_s", events.find((e) => e.kind === "turn_in")?.s, "m", tol.positions);
    push("lean_commit_deg", leanCommit, "deg", tol.angles);
    push("apex_s", apex?.s, "m", tol.positions);
    push("apex_pct", apex?.pct, "%", tol.apex_pct);
    push("apex_f", apex?.f, "-", tol.fractions);
    push("apex_clearance_m", apex?.clearance_m, "m", tol.positions);
    push("v_apex_ms", apex !== undefined ? apex.v_kmh / 3.6 : undefined, "m/s", tol.speeds);
    push("phi_max_deg", stats.phi_max_deg, "deg", tol.angles);
    push("grip_min", stats.grip_min, "-", tol.fractions);
    push("release_s", events.find((e) => e.kind === "release")?.s, "m", tol.positions);
    push("exit_heading_err_deg", c1?.exit.heading_err_deg, "deg", tol.angles);
    if (line.trajectory.terminated.reason === "road_end" && last !== undefined) {
        push("road_end_phi_deg", last.phi, "deg", tol.angles);
        push("road_end_f", last.f, "-", tol.fractions);
    }
    push("outcome", line.verdict.outcome, "-", "exact");
    push("quality", line.verdict.quality, "-", "exact");
    return rows;
}
function composeDsl(dsl) {
    const r = compose({ dsl });
    if (!r.ok)
        throw new Error(`roster road failed to compose: ${JSON.stringify(r.error)}`);
    return r.value;
}
function computeOne(entry, tol) {
    if (entry.input.kind === "run") {
        const r = run(entry.input.input, { engine_semver: ENGINE_SEMVER, figure_id: entry.id });
        if (!r.ok)
            return { fixture: entry.id, error: r.error };
        const refusal = r.value.lines.find((l) => isLineRefusal(l));
        if (refusal !== undefined)
            return { fixture: entry.id, error: refusal.error };
        const lines = r.value.lines.filter((l) => !isLineRefusal(l));
        const road = r.value.road;
        const blessedLine = entry.blessed_line !== undefined ? lines.find((l) => l.line_id === entry.blessed_line) : undefined;
        if (entry.blessed_line !== undefined && blessedLine === undefined) {
            return { fixture: entry.id, error: { message: `blessed_line "${entry.blessed_line}" not in envelope` } };
        }
        return {
            fixture: entry.id,
            engine_semver: ENGINE_SEMVER,
            input: entry.input,
            lines: lines.map((l) => lineRecord(l, road)),
            blessed: blessedLine !== undefined && BLESSED_BLOCK_FIXTURES.includes(entry.id)
                ? blessedRowsFor(entry.id, blessedLine, road, tol)
                : []
        };
    }
    // mistake_on_base — the oracle's own compile path (see file banner)
    const baseR = chainedSolve({ ...entry.input.baseSpec, accept: entry.input.baseAccept });
    if (!baseR.ok)
        return { fixture: entry.id, error: baseR.error };
    const compiled = compileMistake(entry.input.mistake.kind, entry.input.mistake.params, {
        base: baseR.value,
        spec: entry.input.baseSpec
    });
    if (!compiled.ok)
        return { fixture: entry.id, error: compiled.error };
    const road = composeDsl(baseR.value.resolved_scenario.road.dsl);
    return {
        fixture: entry.id,
        engine_semver: ENGINE_SEMVER,
        input: entry.input,
        lines: [lineRecord(baseR.value, road), lineRecord(compiled.value.line, road)],
        blessed: []
    };
}
export function computeGoldenRecords(tol) {
    const records = [];
    for (const entry of BLESS_ROSTER) {
        const r = computeOne(entry, tol);
        if ("error" in r)
            return { ok: false, failure: r };
        records.push(r);
    }
    return { ok: true, records };
}
// ---------------------------------------------------------------------------
// The 02 §8.1 write-back block (design/09 §3.2a format, byte-stable)
export const BLESSED_BEGIN_RE = /<!-- BLESSED:BEGIN engine=\S+ date=\S+ -->/;
// NOTE: the pre-bless placeholder header is `engine=<semver> date=<YYYY-MM-DD>`
// — it contains literal `>` characters, so the header match must be non-greedy
// [\s\S], never [^>].
export const BLESSED_BLOCK_RE = /<!-- BLESSED:BEGIN[\s\S]*?-->[\s\S]*?<!-- BLESSED:END -->/;
/** rows in roster order, values printed at full (shortest round-trip) precision. */
export function formatBlessedBlock(records, engineSemver, dateIso) {
    const lines = [
        `<!-- BLESSED:BEGIN engine=${engineSemver} date=${dateIso} -->`,
        "| fixture | quantity | value | unit | tol |",
        "|---|---|---|---|---|"
    ];
    for (const fixtureId of BLESSED_BLOCK_FIXTURES) {
        const rec = records.find((r) => r.fixture === fixtureId);
        if (rec === undefined)
            continue;
        for (const row of rec.blessed) {
            lines.push(`| ${row.fixture} | ${row.quantity} | ${String(row.value)} | ${row.unit} | ${row.tol} |`);
        }
    }
    lines.push("<!-- BLESSED:END -->");
    return lines.join("\n");
}
/** replace the marker-delimited block; typed failure when the markers are absent. */
export function spliceBlessedBlock(docText, block) {
    if (!BLESSED_BLOCK_RE.test(docText)) {
        return { ok: false, error: "design/02 §8.1 BLESSED markers not found" };
    }
    return { ok: true, value: docText.replace(BLESSED_BLOCK_RE, block) };
}
/** parse the committed block's own header identity (engine, date) for regeneration. */
export function parseBlessedHeader(docText) {
    const m = /<!-- BLESSED:BEGIN engine=(\S+) date=(\S+) -->/.exec(docText);
    if (m === null)
        return null;
    return { engine: m[1], date: m[2] };
}
function restampFigureSpec(raw) {
    const r = run(raw, { engine_semver: ENGINE_SEMVER });
    if (!r.ok)
        return { ok: false, reason: `run refused: ${JSON.stringify(r.error)}` };
    const byName = new Map();
    for (const l of r.value.lines)
        if (!isLineRefusal(l))
            byName.set(l.line_id, l);
    const linesRaw = raw["lines"];
    if (!Array.isArray(linesRaw))
        return { ok: false, reason: "no lines[]" };
    const stampedLines = linesRaw.map((entry) => {
        if (typeof entry !== "object" || entry === null)
            return entry;
        const e = entry;
        const line = typeof e["name"] === "string" ? byName.get(e["name"]) : undefined;
        if (line === undefined)
            return e;
        return { ...e, expected: stampExpected(line.verdict) };
    });
    return { ok: true, value: { ...raw, engine_semver: ENGINE_SEMVER, lines: stampedLines } };
}
function usage(msg) {
    process.stdout.write(JSON.stringify({ ok: false, usage: msg }) + "\n");
    process.exit(2);
}
function parseArgs(argv, defaultRoot) {
    let writeDocs = false;
    let root = defaultRoot;
    let design;
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a === "--write-docs")
            writeDocs = true;
        else if (a === "--root") {
            const v = argv[++i];
            if (v === undefined)
                usage("--root needs a directory");
            root = resolve(v);
        }
        else if (a === "--design") {
            const v = argv[++i];
            if (v === undefined)
                usage("--design needs a directory");
            design = resolve(v);
        }
        else
            usage(`unknown flag "${a}" (known: --write-docs, --root <dir>, --design <dir>)`);
    }
    return { writeDocs, root, design: design ?? resolve(root, "../design") };
}
/** the analytic gate: A-AN-* + D-BOUNDS in ONE invocation (design/09 §3.2a step 3). */
function runAnalyticGate(root) {
    const vitestMjs = join(root, "node_modules", "vitest", "vitest.mjs");
    if (!existsSync(vitestMjs))
        return { green: false, exit: null, tail: `vitest not found at ${vitestMjs}` };
    const r = spawnSync(process.execPath, [vitestMjs, "run", "test/analytic/an.test.ts", "test/analytic/bounds.test.ts"], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    const out = `${r.stdout ?? ""}\n${r.stderr ?? ""}`;
    return { green: r.status === 0, exit: r.status, tail: out.slice(-2000) };
}
function main() {
    const scriptDir = dirname(fileURLToPath(import.meta.url));
    const defaultRoot = resolve(scriptDir, "../..");
    const args = parseArgs(process.argv.slice(2), defaultRoot);
    // 1. the green-gate — mechanical refusal, exit 3, NOTHING written
    const gate = runAnalyticGate(args.root);
    if (!gate.green) {
        process.stdout.write(JSON.stringify({ ok: false, refusal: "analytic_gate_red", vitest_exit: gate.exit, detail: "A-AN-* + D-BOUNDS must be green in this same invocation (design/09 §3.2a step 3; A-BLESS-REFUSES)", tail: gate.tail }, null, 2) + "\n");
        process.exit(3);
    }
    // 2. integrate the roster (raw-tap capture)
    const tolPath = join(args.root, "test", "fixtures", "tolerances.json");
    const tol = tolLabelsFrom(existsSync(tolPath) ? JSON.parse(readFileSync(tolPath, "utf8")) : {});
    const computed = computeGoldenRecords(tol);
    if (!computed.ok) {
        process.stdout.write(JSON.stringify({ ok: false, refusal: "golden_roster_refused", fixture: computed.failure.fixture, error: computed.failure.error }, null, 2) + "\n");
        process.exit(3);
    }
    // 3–5. PREPARE every write first (goldens, doc block, stamps) so any typed
    // refusal exits 3 with NOTHING written — bless writes are all-or-nothing.
    const writes = [];
    const goldensDir = join(args.root, "test", "fixtures", "goldens");
    for (const rec of computed.records) {
        writes.push({ path: join(goldensDir, `${rec.fixture}.json`), content: JSON.stringify(rec, null, 2) + "\n" });
    }
    let wroteDocs = false;
    if (args.writeDocs) {
        const docPath = join(args.design, "02-physics-model.md");
        if (!existsSync(docPath)) {
            process.stdout.write(JSON.stringify({ ok: false, refusal: "design_doc_missing", path: docPath }) + "\n");
            process.exit(3);
        }
        const date = new Date().toISOString().slice(0, 10);
        const block = formatBlessedBlock(computed.records, ENGINE_SEMVER, date);
        const doc = readFileSync(docPath, "utf8");
        const spliced = spliceBlessedBlock(doc, block);
        if (!spliced.ok) {
            process.stdout.write(JSON.stringify({ ok: false, refusal: "blessed_markers_missing", path: docPath }) + "\n");
            process.exit(3);
        }
        if (spliced.value !== doc)
            writes.push({ path: docPath, content: spliced.value });
        wroteDocs = true;
    }
    const stamped = [];
    const figuresDir = join(args.root, "test", "fixtures", "figures");
    if (existsSync(figuresDir)) {
        for (const file of readdirSync(figuresDir).filter((f) => f.endsWith(".json")).sort()) {
            const path = join(figuresDir, file);
            const raw = JSON.parse(readFileSync(path, "utf8"));
            if (typeof raw !== "object" || raw === null || !Array.isArray(raw["lines"])) {
                stamped.push({ file, stamped: false, reason: "not a FigureSpec (no lines[])" });
                continue;
            }
            const r = restampFigureSpec(raw);
            if (!r.ok) {
                process.stdout.write(JSON.stringify({ ok: false, refusal: "figure_stamp_refused", file, reason: r.reason }) + "\n");
                process.exit(3);
            }
            writes.push({ path, content: JSON.stringify(r.value, null, 2) + "\n" });
            stamped.push({ file, stamped: true });
        }
    }
    // commit the prepared writes
    mkdirSync(goldensDir, { recursive: true });
    for (const w of writes)
        writeFileSync(w.path, w.content);
    process.stdout.write(JSON.stringify({
        ok: true,
        value: {
            engine_semver: ENGINE_SEMVER,
            blessed: computed.records.map((r) => r.fixture),
            wrote_docs: wroteDocs,
            stamped
        }
    }, null, 2) + "\n");
    process.exit(0);
}
// Run only when executed directly (node dist/cli/bless.js / the linelab-bless
// bin) — importing this module (tests import the pure helpers above) must not
// trigger IO. realpath follows the bin symlink.
const argv1 = process.argv[1];
let invokedDirectly = false;
if (argv1 !== undefined) {
    try {
        invokedDirectly = import.meta.url === pathToFileURL(realpathSync(argv1)).href;
    }
    catch {
        invokedDirectly = import.meta.url === pathToFileURL(resolve(argv1)).href;
    }
}
if (invokedDirectly)
    main();
//# sourceMappingURL=bless.js.map