// test/viewer/onecore.test.ts — `C-ONE-CORE` where the viewer can break it:
// the two surfaces that put a NUMBER on screen at a cursor.
//
// design/09 §6's C-ONE-CORE is "exactly one implementation of each core rule".
// `test/meta/imports.test.ts` grades the module-graph half (one engine module,
// reached by both entries). This file grades the ARITHMETIC half at the viewer's
// two cursor surfaces, because that is where a second copy of a core rule is
// cheapest to write and hardest to see:
//
//   1. THE HUD AND THE STRIP, one cursor, one screen. The HUD (07 §3.3) reads
//      `stateAt`'s interpolated instant; the controls strip's chips (06 §4)
//      once read the NEAREST RECORDED sample instead, so one cursor produced
//      two numbers for one channel. Measured on this very fixture at s = 1.250:
//      HUD `cmd_a` −1.594931 vs chip −1.273630 (Δ 0.321301), `grip` Δ 0.032752,
//      `v` Δ 0.153704 km/h — and the emitted SVG documented its own mismatch
//      (`data-cursor-s="15.25" data-sample-s="15"`). Both surfaces now resolve
//      the cursor through `core/stateAt.ts`, so the two readings are the same
//      f64 and the SVG's two station attributes are the same number.
//
//   2. THE STEPPER'S s↔t CONVERSION. `viewer/stepper.ts` once carried its own
//      bracket search + linear lerp — "the same bracket-and-lerp rule stateAt
//      uses", by its own admission — driving `advance`, `stepFrame` and
//      `toggleAxis`. It agreed numerically (both linear in t), which is exactly
//      what makes a second copy dangerous: it is a drift surface with no live
//      symptom. It now delegates to `core/stateAt.ts`'s `dualAt`, which shares
//      `locate` with `stateAt` — so the assertions below are BIT-exact (`toBe`),
//      not `toBeCloseTo`. An independent re-implementation would fail them.
//
// The domain-end policy is stated once, here, and pinned: `stateAt`/`dualAt`
// REFUSE past the domain (`BAD_RANGE`; 05 §4: "the function never clamps
// silently; clamping is a caller (viewer) policy"), and the stepper — the
// caller — CLAMPS, because 07 §3.4 requires the cursor to "remain draggable
// across the full scenario extent" with an early-ended line "frozen at its
// terminal sample".

import { describe, it, expect, beforeAll, vi } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * A pass-through spy on `core/stateAt.ts`'s `dualAt`: the real rule still runs
 * (every number below is the engine's), but the call is COUNTED. That is what
 * turns "the stepper agrees with `stateAt`" from a coincidence a re-implemented
 * lerp could also produce into "the stepper IS `stateAt`" — the substance of
 * `C-ONE-CORE`, which a numeric assertion alone cannot reach because the
 * retired copy agreed to the last bit.
 */
const spy = vi.hoisted(() => ({ dualCalls: 0 }));
vi.mock("../../src/core/stateAt.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../src/core/stateAt.js")>();
  return {
    ...actual,
    dualAt: (...args: Parameters<typeof actual.dualAt>) => {
      spy.dualCalls++;
      return actual.dualAt(...args);
    }
  };
});

import { stateAt, dualAt } from "../../src/core/stateAt.js";
import type { Sample } from "../../src/core/types.js";
import { msToKmh } from "../../src/core/units.js";
import { loadSession, stateInputFor, type ViewerSession } from "../../src/viewer/session.js";
import { hudAt } from "../../src/viewer/hud.js";
import { renderView } from "../../src/viewer/views.js";
import {
  advance,
  clampTo,
  domainOf,
  initialStepper,
  play,
  scrubTo,
  stationForTime,
  stepFrame,
  timeForStation,
  toggleAxis
} from "../../src/viewer/stepper.js";
import { FRAME_STEP_S } from "../../src/viewer/constants.js";
import type { LineResult } from "../../src/solve/types.js";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "../..");

/** The audited fixture: book90 solved clean at 34 km/h, `turn_in: auto`. */
const BOOK90_SPEC = { road: { preset: "book90" }, entry_kmh: 34, turn_in: "auto" };

/** The C30 golden's own recorded input — a blessed, longer line for the stepper half. */
const C30_SPEC = (
  JSON.parse(readFileSync(join(repoRoot, "test/fixtures/goldens/C30.json"), "utf8")) as {
    input: { input: unknown };
  }
).input.input;

function sessionOfSpec(spec: unknown): ViewerSession {
  const loaded = loadSession(spec);
  if (!loaded.ok) throw new Error(`session did not load: ${JSON.stringify(loaded.error)}`);
  return loaded.value;
}

/** 06 §4's chip formatting: 3 dp, `-0` normalised. */
function n3(x: number): number {
  const r = Number(x.toFixed(3));
  return Object.is(r, -0) ? 0 : r;
}

/**
 * THE RETIRED RULE, kept here (never in `src/`) so the gates below can prove
 * they are not vacuous: if nearest-record and `stateAt` agreed everywhere,
 * asserting their agreement would prove nothing.
 */
function nearestRecord(samples: readonly Sample[], s: number): Sample {
  let best = samples[0]!;
  for (const p of samples) if (Math.abs(p.s - s) < Math.abs(best.s - s)) best = p;
  return best;
}

/** The six cursor chips, in `PANEL_IDS` order, parsed back out of the strip SVG. */
function chipNumbers(svg: string): {
  readonly cursor_s: number;
  readonly sample_s: number;
  readonly source: string;
  readonly values: Readonly<Record<string, readonly number[]>>;
} {
  const head = /<g class="cursor" data-cursor-s="([-\d.]+)" data-sample-s="([-\d.]+)" data-cursor-source="(\w+)"/.exec(svg);
  if (head === null) throw new Error("no cursor group in the rendered strip");
  const group = svg.slice(svg.indexOf('<g class="cursor"'));
  const texts = [...group.matchAll(/<text[^>]*>([^<]+)<\/text>/g)].map((m) => m[1]!);
  const panels = ["v", "lean", "commands", "grip", "sight", "standup"];
  if (texts.length !== panels.length) throw new Error(`expected 6 chips, got ${texts.length}: ${JSON.stringify(texts)}`);
  const values: Record<string, readonly number[]> = {};
  panels.forEach((panel, i) => {
    values[panel] = [...texts[i]!.matchAll(/(-?\d+(?:\.\d+)?)/g)].map((m) => Number(m[1]));
  });
  return { cursor_s: Number(head[1]), sample_s: Number(head[2]), source: head[3]!, values };
}

/** The HUD row carrying `label`, by the viewer's own row model. */
function hudValue(rows: readonly { readonly label: string; readonly value: unknown }[], label: string): number {
  const row = rows.find((r) => r.label === label);
  if (row === undefined) throw new Error(`no HUD row labelled "${label}"`);
  if (typeof row.value !== "number") throw new Error(`HUD row "${label}" is not numeric`);
  return row.value;
}

let book90: ViewerSession;
let c30: ViewerSession;

beforeAll(() => {
  book90 = sessionOfSpec(BOOK90_SPEC);
  c30 = sessionOfSpec(C30_SPEC);
}, 180_000);

// ---------------------------------------------------------------------------

describe("C-ONE-CORE (the cursor half) — the HUD and the strip read ONE instant", () => {
  /** exact sample hits, the two audited off-grid stations, and every 7th bracket midpoint */
  function probeStations(line: LineResult): number[] {
    const samples = line.trajectory.samples;
    const mids: number[] = [];
    for (let i = 0; i + 1 < samples.length; i += 7) {
      mids.push((samples[i]!.s + samples[i + 1]!.s) / 2);
    }
    return [samples[0]!.s, samples[10]!.s, 1.25, 15.25, ...mids];
  }

  it("every strip chip is the number the HUD shows for that channel, at the same cursor", () => {
    const line = book90.lines[0]!;
    let probed = 0;
    for (const s of probeStations(line)) {
      const hud = hudAt(book90, book90.focus, { s });
      expect(hud.ok, `hudAt refused at s=${s}`).toBe(true);
      if (!hud.ok) continue;
      const view = renderView(book90, { view: "controls", instant: hud.value.instant });
      expect(view.ok).toBe(true);
      if (!view.ok) continue;
      const chips = chipNumbers(view.value.svg);
      const rows = hud.value.rows;
      const sample = hud.value.instant.sample;

      // the four channels the HUD also prints — chip vs HUD ROW, same cursor
      expect(chips.values["v"]![0], `v @ s=${s}`).toBe(n3(hudValue(rows, "v")));
      expect(chips.values["lean"]![0], `phi @ s=${s}`).toBe(n3(hudValue(rows, "phi")));
      expect(chips.values["lean"]![1], `cmd_lean @ s=${s}`).toBe(n3(hudValue(rows, "cmd_lean → phi")));
      expect(chips.values["commands"]![0], `cmd_a @ s=${s}`).toBe(n3(hudValue(rows, "cmd_a")));
      expect(chips.values["commands"]![1], `a_long @ s=${s}`).toBe(n3(hudValue(rows, "cmd_a → a_long")));
      expect(chips.values["grip"]![0], `grip @ s=${s}`).toBe(n3(hudValue(rows, "grip")));
      expect(chips.values["sight"]![0], `sight_ride_m @ s=${s}`).toBe(n3(hudValue(rows, "sight_ride_m")));
      expect(chips.values["sight"]![1], `ssd_m @ s=${s}`).toBe(n3(hudValue(rows, "ssd_m")));
      // the stand-up pair has no HUD row of its own (07 §3.3 shows the net
      // chip); it is read off the same instant
      expect(chips.values["standup"]![0], `su_sustained @ s=${s}`).toBe(n3(sample.su_sustained));
      expect(chips.values["standup"]![1], `su_transient @ s=${s}`).toBe(n3(sample.su_transient));

      // and the SVG no longer documents a mismatch between the two stations
      expect(chips.source, `cursor source @ s=${s}`).toBe("stateAt");
      expect(chips.sample_s, `data-sample-s @ s=${s}`).toBe(chips.cursor_s);
      probed++;
    }
    expect(probed, "no cursor station was actually probed").toBeGreaterThan(10);
  });

  it("the gate is not vacuous: the retired nearest-record rule really does differ here", () => {
    // If nearest-record and `stateAt` agreed, the equality above would be free.
    // These are the audit's own measured divergences, reproduced.
    const line = book90.lines[0]!;
    const input = stateInputFor(book90, line);
    const samples = line.trajectory.samples;

    const at = stateAt(input, { s: 1.25 });
    expect(at.ok).toBe(true);
    if (!at.ok) return;
    const near = nearestRecord(samples, 1.25);
    expect(near.s).toBe(1); // the record the chips used to print
    expect(Math.abs(at.value.sample.cmd_a - near.cmd_a)).toBeCloseTo(0.321301, 5);
    expect(Math.abs(at.value.sample.grip - near.grip)).toBeCloseTo(0.032752, 5);
    expect(Math.abs(msToKmh(at.value.sample.v) - msToKmh(near.v))).toBeCloseTo(0.153704, 5);

    // and it is not one lucky station: the worst cmd_a divergence over every
    // interior bracket midpoint is far above the chips' 3 dp print precision
    let worst = 0;
    for (let i = 0; i + 1 < samples.length; i++) {
      const mid = (samples[i]!.s + samples[i + 1]!.s) / 2;
      const q = stateAt(input, { s: mid });
      if (!q.ok) continue;
      worst = Math.max(worst, Math.abs(q.value.sample.cmd_a - nearestRecord(samples, mid).cmd_a));
    }
    expect(worst).toBeGreaterThan(0.05);
  });
});

// ---------------------------------------------------------------------------

describe("C-ONE-CORE (the stepper half) — one bracket-and-lerp rule, shared with stateAt", () => {
  it("`stationForTime` is BIT-identical to `stateAt(line, {t}).sample.s` across the run", () => {
    const line = c30.lines[0]!;
    const input = stateInputFor(c30, line);
    const d = domainOf(line, "t");
    let checked = 0;
    for (let k = 0; k <= 200; k++) {
      const t = d.min + ((d.max - d.min) * k) / 200;
      const at = stateAt(input, { t });
      expect(at.ok, `stateAt refused at t=${t}`).toBe(true);
      if (!at.ok) continue;
      // `toBe` — not `toBeCloseTo`. A second implementation of 05 §3.2 would
      // differ in the last bits even when it agrees to 10 dp.
      expect(stationForTime(line, t), `t=${t}`).toBe(at.value.sample.s);
      checked++;
    }
    expect(checked).toBe(201);
  });

  it("`timeForStation` is BIT-identical to `stateAt(line, {s}).sample.t` across the run", () => {
    const line = c30.lines[0]!;
    const input = stateInputFor(c30, line);
    const d = domainOf(line, "s");
    for (let k = 0; k <= 200; k++) {
      const s = d.min + ((d.max - d.min) * k) / 200;
      const at = stateAt(input, { s });
      expect(at.ok, `stateAt refused at s=${s}`).toBe(true);
      if (!at.ok) continue;
      expect(timeForStation(line, s), `s=${s}`).toBe(at.value.sample.t);
    }
  });

  it("the axis toggle lands on `stateAt`'s own dual — not on a second reading of it", () => {
    const line = c30.lines[0]!;
    const input = stateInputFor(c30, line);
    const tDomain = domainOf(line, "t");
    for (const t of [tDomain.min + 0.37, 1.4, 2.4, tDomain.max - 0.11]) {
      const at = stateAt(input, { t });
      expect(at.ok).toBe(true);
      if (!at.ok) continue;
      const flipped = toggleAxis(scrubTo(initialStepper(tDomain), t, tDomain), line);
      expect(flipped.axis).toBe("s");
      expect(flipped.value, `t=${t}`).toBe(at.value.sample.s);
    }
  });

  it("playback and the frame-step button schedule against that same rule on the station axis", () => {
    const line = c30.lines[0]!;
    const input = stateInputFor(c30, line);
    const sDomain = domainOf(line, "s");
    const samples = line.trajectory.samples;
    const start = samples[20]!; // an exact record, so t is exact too

    const at = { ...initialStepper(sDomain), value: start.s };
    const played = advance(play(at), 0.25, sDomain, line);
    const expectedPlay = stateAt(input, { t: start.t + 0.25 });
    expect(expectedPlay.ok).toBe(true);
    if (expectedPlay.ok) expect(played.value).toBe(expectedPlay.value.sample.s);

    const stepped = stepFrame(at, 1, sDomain, line);
    const expectedStep = stateAt(input, { t: start.t + FRAME_STEP_S });
    expect(expectedStep.ok).toBe(true);
    if (expectedStep.ok) expect(stepped.value).toBe(expectedStep.value.sample.s);
  });

  it("every s↔t conversion the stepper makes IS a `dualAt` call — proved by substitution, not by agreement", () => {
    const line = c30.lines[0]!;
    const sDomain = domainOf(line, "s");
    const tDomain = domainOf(line, "t");
    const samples = line.trajectory.samples;
    const mid = (samples[30]!.t + samples[31]!.t) / 2; // strictly interior: the guards do not short-circuit

    // Each of the four surfaces 07 §3.1 names, one at a time.
    const before = spy.dualCalls;
    stationForTime(line, mid);
    expect(spy.dualCalls, "stationForTime did not consult core/stateAt").toBeGreaterThan(before);

    const b2 = spy.dualCalls;
    timeForStation(line, (samples[30]!.s + samples[31]!.s) / 2);
    expect(spy.dualCalls, "timeForStation did not consult core/stateAt").toBeGreaterThan(b2);

    const b3 = spy.dualCalls;
    toggleAxis(scrubTo(initialStepper(tDomain), mid, tDomain), line);
    expect(spy.dualCalls, "toggleAxis did not consult core/stateAt").toBeGreaterThan(b3);

    const b4 = spy.dualCalls;
    advance(play({ ...initialStepper(sDomain), value: samples[30]!.s }), 0.25, sDomain, line);
    expect(spy.dualCalls, "advance did not consult core/stateAt").toBeGreaterThan(b4);

    const b5 = spy.dualCalls;
    stepFrame({ ...initialStepper(sDomain), value: samples[30]!.s }, 1, sDomain, line);
    expect(spy.dualCalls, "stepFrame did not consult core/stateAt").toBeGreaterThan(b5);
  });

  it("the domain-end policy is ONE decision: stateAt REFUSES, the stepper CLAMPS (05 §4, 07 §3.4)", () => {
    const line = c30.lines[0]!;
    const input = stateInputFor(c30, line);
    const samples = line.trajectory.samples;
    const first = samples[0]!;
    const last = samples[samples.length - 1]!;
    const tDomain = domainOf(line, "t");

    // the core rule refuses, in both spellings, and never clamps
    for (const q of [{ t: last.t + 10 }, { t: first.t - 10 }] as const) {
      const at = stateAt(input, q);
      expect(at.ok).toBe(false);
      if (!at.ok) {
        expect(at.error.code).toBe("BAD_RANGE");
        expect(at.error.detail?.["reason"]).toBe("query_outside_domain");
      }
      const dual = dualAt(line.trajectory, q);
      expect(dual.ok).toBe(false);
      if (!dual.ok) expect(dual.error.code).toBe("BAD_RANGE");
    }

    // the CALLER's policy — the stepper clamps to the terminal sample, so the
    // cursor stays draggable across the whole extent (07 §3.4) instead of
    // throwing or blanking a pane
    expect(stationForTime(line, last.t + 10)).toBe(last.s);
    expect(stationForTime(line, first.t - 10)).toBe(first.s);
    expect(timeForStation(line, last.s + 10)).toBe(last.t);
    expect(timeForStation(line, first.s - 10)).toBe(first.t);
    expect(clampTo(1e9, tDomain)).toBe(tDomain.max);
    expect(scrubTo(initialStepper(tDomain), 1e9, tDomain).value).toBe(tDomain.max);

    // …and the clamp is the ONLY thing the stepper adds: strictly inside the
    // domain it is `stateAt`'s answer, bit for bit (the case above).
    expect(stationForTime(line, last.t)).toBe(last.s);
  });
});
