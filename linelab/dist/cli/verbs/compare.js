// cli/verbs/compare.ts — the `compare` verb (design/08 §3.5, §6(c); design/07
// §4): "Recompute all inputs — anything `run` accepts, plus envelopes (stripped
// to their FigureSpec and recomputed, per D6) — and emit per-line verdict deltas
// plus a station-aligned metric diff (sight, speed, lean, grip at shared
// stations) and an overlay figure. All inputs must resolve to the same road;
// occluders/hazards may differ and are disclosed in `world_delta`."
//
// THE ONE ENGINE (C-ONE-CORE). This verb steps NO physics of its own. It
// recomputes each input through `run()` (solve/run.ts — the single front door
// over `core/integrate`), then reads each line's OWN `stateAt` (core/stateAt.ts)
// at the shared lock positions. There is no second stepper and no second
// interpolation rule here: the station-aligned diff is `stateAt`, called once
// per (line, lock-position) pair, so `C-COMPARE` ("each line's ghost state
// equals its own `stateAt`; lines never share or leak state") holds by
// construction — every metric cell is `stateAt(THAT line, {s|t})`, and swapping
// two members' states is observable.
//
// D6 recompute path — "compare never trusts shipped trajectories". Every input
// is recomputed through the one engine (`run()`), never read off its stored
// samples:
//   · a scene lowers (`lowerScene`) then runs; a scenario / FigureSpec /
//     composed input runs directly;
//   · an ENVELOPE is recomputed line-by-line by re-running each line's
//     `resolved_scenario` — the canonical post-validation wire scenario the
//     engine integrated (05 §7), re-emitted through shared.ts's ONE road
//     projection (`roadWireSpec`, which threads the non-DSL-expressible
//     `bike_margin_m`/`use_full_width` beside the `dsl`). Re-running a
//     `resolved_scenario` reproduces the line exactly (A-RESOLVED-RERUN, 09) via
//     the one engine, so the trajectory AND verdict are recomputed from the spec
//     — never trusted. This is robust where the `export --as figure-spec`
//     projection is not: preset roads (whose line spec spells `{preset}` while
//     the projected figure road spells `{dsl}` → `line_road_differs`) and
//     non-default corridors both recompute exactly here.
//
// Typed refusals (D8, §3.5). Fewer than two inputs, or no line_id shared by two
// or more inputs, is `SCHEMA` — "a compare with nothing to compare … must be a
// typed refusal, not a degenerate one-line output". Roads that resolve
// differently are `SCHEMA/road_mismatch` (the shared road is compare's input
// *contract*), naming both road hashes and the first differing segment.
//
// IO stays in main.ts: this verb takes already-loaded input texts and returns a
// VerbOutcome (ARCHITECTURE §2). Pure and synchronous over frozen inputs.
import { run, relabelLine } from "../../solve/run.js";
import { stateAt } from "../../core/stateAt.js";
import { sightTrendAt } from "../../sight/analyze.js";
import { canonicalize, fnv1a } from "../../core/hash.js";
import { lowerScene } from "../../plan/scene.js";
import { isLineRefusal } from "../../solve/envelope.js";
import { renderViews } from "../../render/index.js";
import { LINELAB_SPEC } from "../../solve/types.js";
import { EXIT } from "../exit.js";
import { parseZeroFileFlags } from "../args.js";
import { errOutcome, isObject, looksLikeJson, okOutcome, parseJson, roadWireSpec, schemaErr } from "./shared.js";
// ---------------------------------------------------------------------------
// Local, unnamed-literal constants (ARCHITECTURE §6.6 — a station-aligned diff
// grid is bounded so the JSON document stays a document; the diff still spans
// the whole shared domain by uniform subsampling, disclosed via `truncated`,
// mirroring `sweep`'s own truncation flag, §4.3).
const COMPARE_MAX_SAMPLES = 400;
// ---------------------------------------------------------------------------
// Rounding — DISPLAY only (the compare payload is a view document, out of every
// hash). Kept local and tiny; it is not the verdict emission policy (that is
// solve/emit.ts, the hashed channel this verb never touches).
function r2(x) {
    return Number(x.toFixed(2));
}
function r3(x) {
    return Number(x.toFixed(3));
}
function canonOf(v) {
    const c = canonicalize(v);
    return c.ok ? c.value : "";
}
function looksLikeEnvelope(json) {
    const lines = json["lines"];
    if (!Array.isArray(lines))
        return false;
    return lines.some((l) => isObject(l) && ("trajectory" in l || "verdict" in l || "ok" in l));
}
/** run() → the recomputed slice (a spec input: scene/scenario/FigureSpec/composed). */
function recomputeSpec(input, engineSemver) {
    const fr = run(input, { engine_semver: engineSemver });
    if (!fr.ok)
        return fr;
    return {
        ok: true,
        value: {
            figure_id: fr.value.figure_id,
            road: fr.value.road,
            occluders: fr.value.occluders,
            hazards: fr.value.hazards,
            lines: fr.value.lines.filter((l) => !isLineRefusal(l))
        }
    };
}
/** re-run every line of an envelope from its `resolved_scenario` (A-RESOLVED-RERUN). */
function recomputeEnvelope(json, engineSemver) {
    const figure_id = typeof json["figure_id"] === "string" ? json["figure_id"] : "compare";
    const linesRaw = json["lines"] ?? [];
    const opts = { engine_semver: engineSemver };
    const lines = [];
    let road;
    let occluders = [];
    let hazards = [];
    for (let i = 0; i < linesRaw.length; i++) {
        const entry = linesRaw[i];
        if (isLineRefusal(entry))
            continue; // a refused input line has no trajectory to recompute
        const line = entry;
        const rs = line.resolved_scenario;
        const roadSpec = roadWireSpec(rs.road, `lines[${i}].resolved_scenario.road`);
        if (!roadSpec.ok)
            return roadSpec;
        // the resolved wire scenario, re-emitted as a runnable document (the same
        // shape `export --as scenario` produces; re-running reproduces the line)
        const wire = { ...rs, spec: LINELAB_SPEC, id: line.line_id, road: roadSpec.value };
        const fr = run(wire, opts);
        if (!fr.ok)
            return { ok: false, error: { ...fr.error, at: `lines[${line.line_id}]${fr.error.at ? `.${fr.error.at}` : ""}` } };
        const recomputed = fr.value.lines.find((l) => !isLineRefusal(l));
        if (recomputed === undefined)
            continue;
        lines.push(recomputed);
        if (road === undefined) {
            road = fr.value.road;
            occluders = fr.value.occluders;
            hazards = fr.value.hazards;
        }
    }
    if (road === undefined) {
        return { ok: false, error: schemaErr("input", "envelope carried no runnable line to recompute", "envelope_no_lines") };
    }
    return { ok: true, value: { figure_id, road, occluders, hazards, lines } };
}
function recomputeInput(text, engineSemver) {
    if (!looksLikeJson(text)) {
        const lowered = lowerScene(text);
        if (!lowered.ok)
            return lowered;
        return recomputeSpec(lowered.value, engineSemver);
    }
    const j = parseJson(text, "input");
    if (!j.ok)
        return j;
    if (!isObject(j.value)) {
        return { ok: false, error: schemaErr("input", "compare input must be a JSON object or scene text", "compare_input_not_object") };
    }
    return looksLikeEnvelope(j.value)
        ? recomputeEnvelope(j.value, engineSemver)
        : recomputeSpec(j.value, engineSemver);
}
function roadKey(road) {
    const segments = road.segments;
    return {
        lane_width_m: road.lane_width_m,
        bike_margin_m: road.bike_margin_m,
        use_full_width: road.use_full_width,
        segments
    };
}
function roadHash(road) {
    return fnv1a(canonOf(roadKey(road)));
}
/** first index at which two segment lists differ (by canonical JSON), or null. */
function firstDifferingSegment(a, b) {
    const n = Math.max(a.length, b.length);
    for (let i = 0; i < n; i++) {
        if (canonOf(a[i]) !== canonOf(b[i]))
            return i;
    }
    return null;
}
// ---------------------------------------------------------------------------
// world_delta (§3.5): occluders/hazards not shared by every input, disclosed.
function collectWorld(fr) {
    const occ = new Map();
    const haz = new Map();
    const addOcc = (o) => { occ.set(canonOf(o), o); };
    const addHaz = (h) => { haz.set(canonOf(h), h); };
    for (const o of fr.occluders)
        addOcc(o);
    for (const h of fr.hazards)
        addHaz(h);
    // solve-sourced lines carry the world on their own resolved_scenario (the
    // figure-spec projection lowers occluders onto the line spec), so read both.
    for (const l of fr.lines) {
        if (isLineRefusal(l))
            continue;
        for (const o of l.resolved_scenario.occluders)
            addOcc(o);
        for (const h of l.resolved_scenario.hazards)
            addHaz(h);
    }
    return { occ, haz };
}
function worldDelta(recomputed) {
    const n = recomputed.length;
    const worlds = recomputed.map(collectWorld);
    const diffEntries = (pick) => {
        const keys = new Set();
        for (const w of worlds)
            for (const k of pick(w).keys())
                keys.add(k);
        const out = [];
        for (const k of [...keys].sort()) {
            const present = [];
            let entry;
            for (let i = 0; i < n; i++) {
                const m = pick(worlds[i]);
                if (m.has(k)) {
                    present.push(i);
                    entry = m.get(k);
                }
            }
            if (present.length < n)
                out.push({ present_in: present, entry });
        }
        return out;
    };
    const occluders = diffEntries((w) => w.occ);
    const hazards = diffEntries((w) => w.haz);
    return { differs: occluders.length > 0 || hazards.length > 0, occluders, hazards };
}
// ---------------------------------------------------------------------------
// Per-line stateAt marshalling (the ONE arithmetic surface, 07 §2.4).
function stateInputFor(line, road) {
    return { trajectory: line.trajectory, road, plan: line.resolved_scenario.rider.plan, sightTrendAt };
}
function metricsOf(st) {
    return {
        s: r2(st.sample.s),
        t: r2(st.sample.t),
        v_kmh: r2(st.derived.v_kmh),
        phi_deg: r2(st.sample.phi),
        grip: r3(st.sample.grip),
        sight_ride_m: r2(st.sample.sight_ride_m),
        ssd_m: r2(st.sample.ssd_m),
        sight_margin_m: r2(st.derived.sight_margin_m),
        d: r3(st.sample.d),
        f: r3(st.sample.f)
    };
}
/** uniform subsample of `xs` to at most `cap` points, keeping the first and last. */
function subsample(xs, cap) {
    if (xs.length <= cap)
        return { grid: xs, truncated: false };
    const out = [];
    const step = (xs.length - 1) / (cap - 1);
    for (let i = 0; i < cap; i++)
        out.push(xs[Math.round(i * step)]);
    return { grid: out, truncated: true };
}
function buildPair(line_id, members, lock) {
    const key = lock === "station" ? "s" : "t";
    const EPS = 1e-6;
    const endsOf = (which) => {
        const first = [];
        const last = [];
        for (const m of members) {
            const s = m.line.trajectory.samples;
            first.push(s[0][which]);
            last.push(s[s.length - 1][which]);
        }
        return { first, last };
    };
    // `span` is ALWAYS station-based (§3.5: "the intersection of the paired lines'
    // STATION ranges") — the lock mode changes how the diff is SAMPLED, not the
    // diff domain. `clipped` flags a shortened diff (one line terminated early).
    const sEnds = endsOf("s");
    const from_s = Math.max(...sEnds.first);
    const to_s = Math.min(...sEnds.last);
    const clipped = from_s > Math.min(...sEnds.first) + EPS || to_s < Math.max(...sEnds.last) - EPS;
    // the sampling grid runs along the LOCK axis, over the intersection of the
    // members' ranges IN THAT AXIS (so every member's stateAt below is in-domain):
    // stations under `station` lock, elapsed times under `time` lock.
    const lockEnds = key === "s" ? sEnds : endsOf("t");
    const gridFrom = Math.max(...lockEnds.first);
    const gridTo = Math.min(...lockEnds.last);
    const refSamples = members[0].line.trajectory.samples;
    const rawGrid = refSamples
        .map((p) => p[key])
        .filter((q) => q >= gridFrom - EPS && q <= gridTo + EPS);
    const { grid, truncated } = subsample(rawGrid, COMPARE_MAX_SAMPLES);
    const samples = [];
    for (const q of grid) {
        const query = key === "s" ? { s: q } : { t: q };
        const per_input = {};
        let good = true;
        for (const m of members) {
            const st = stateAt(stateInputFor(m.line, m.road), query);
            if (!st.ok) {
                good = false;
                break;
            }
            per_input[String(m.input)] = metricsOf(st.value);
        }
        if (good)
            samples.push({ at: r2(q), per_input });
    }
    const verdict = members.map((m) => ({
        input: m.input,
        outcome: m.line.verdict.outcome,
        quality: m.line.verdict.quality,
        ok: m.line.verdict.ok,
        headline: m.line.verdict.headline,
        sight_margin_min_m: m.line.verdict.sight !== null ? r2(m.line.verdict.sight.margin_min_m) : null
    }));
    return {
        line_id,
        inputs: members.map((m) => m.input),
        verdict,
        span: { from_s: r2(from_s), to_s: r2(to_s), clipped },
        samples,
        truncated
    };
}
// ---------------------------------------------------------------------------
// The verb
export function compareVerb(input) {
    const parsed = parseZeroFileFlags(input.argv);
    if (!parsed.ok)
        return errOutcome(parsed.error);
    const lock = parsed.value.lock ?? "station";
    // D8 — "a compare with nothing to compare … must be a typed refusal, not a
    // degenerate one-line output" (§3.5).
    if (input.loadedTexts.length < 2) {
        return errOutcome(schemaErr("compare", `compare needs at least two inputs to compare (got ${input.loadedTexts.length}) — \`compare <A> <B> […]\``, "nothing_to_compare", {
            input_count: input.loadedTexts.length
        }));
    }
    // recompute every input (D6)
    const recomputed = [];
    for (let i = 0; i < input.loadedTexts.length; i++) {
        const fr = recomputeInput(input.loadedTexts[i], input.engineSemver);
        if (!fr.ok)
            return errOutcome({ ...fr.error, at: `inputs[${i}]${fr.error.at ? `.${fr.error.at}` : ""}` });
        recomputed.push(fr.value);
    }
    // road contract (§3.5) — every input resolves to the same road
    const hashes = recomputed.map((fr) => roadHash(fr.road));
    const base = hashes[0];
    for (let i = 1; i < hashes.length; i++) {
        if (hashes[i] !== base) {
            const segA = recomputed[0].road.segments;
            const segB = recomputed[i].road.segments;
            const at = firstDifferingSegment(segA, segB);
            return errOutcome(schemaErr("inputs", `compare requires one shared road; inputs[0] road ${base} ≠ inputs[${i}] road ${hashes[i]}`, "road_mismatch", {
                road_hash_a: base,
                road_hash_b: hashes[i],
                input_a: 0,
                input_b: i,
                first_differing_segment: at
            }));
        }
    }
    // pair lines by line_id (§3.5)
    const perInput = recomputed.map((fr) => {
        const m = new Map();
        for (const l of fr.lines)
            if (!isLineRefusal(l))
                m.set(l.line_id, l);
        return m;
    });
    const allIds = [...new Set(perInput.flatMap((m) => [...m.keys()]))].sort();
    const pairs = [];
    const unpairedA = [];
    const unpairedB = [];
    for (const id of allIds) {
        const members = [];
        for (let i = 0; i < perInput.length; i++) {
            const line = perInput[i].get(id);
            if (line !== undefined)
                members.push({ input: i, line, road: recomputed[i].road });
        }
        if (members.length >= 2) {
            pairs.push(buildPair(id, members, lock));
        }
        else if (members[0].input === 0) {
            unpairedA.push(id);
        }
        else {
            unpairedB.push(id);
        }
    }
    if (pairs.length === 0) {
        return errOutcome(schemaErr("compare", "nothing to compare — no line_id is shared by two or more inputs (pair lines by giving them the same line_id)", "no_paired_lines", {
            unpaired: { a: unpairedA, b: unpairedB }
        }));
    }
    // overlay figure (§3.5) — best effort, written only under `--out`
    const writes = [];
    let overlay = null;
    if (parsed.value.out !== undefined) {
        const mergedLines = [];
        recomputed.forEach((fr, i) => {
            for (const l of fr.lines)
                if (!isLineRefusal(l))
                    mergedLines.push(relabelLine(l, `in${i}_${l.line_id}`));
        });
        // FigureResult.road is a ComposedRoad at runtime (solve/run.ts composes it);
        // the type is widened to RoadModel on the envelope, so narrow it back for
        // the renderer, exactly as render.ts/export.ts do after recompose.
        const rendered = renderViews({ road: recomputed[0].road, lines: mergedLines });
        if (rendered.ok) {
            const path = `${parsed.value.out}/compare.svg`;
            writes.push({ path, content: rendered.value.svg });
            overlay = path;
        }
    }
    const result = {
        kind: "compare",
        lock,
        road_hash: base,
        inputs: recomputed.map((fr, i) => ({
            index: i,
            figure_id: fr.figure_id,
            lines: fr.lines.filter((l) => !isLineRefusal(l)).map((l) => l.line_id)
        })),
        world_delta: worldDelta(recomputed),
        pairs,
        unpaired: { a: unpairedA, b: unpairedB },
        overlay
    };
    return okOutcome(result, writes.length > 0 ? writes : undefined, EXIT.OK);
}
//# sourceMappingURL=compare.js.map