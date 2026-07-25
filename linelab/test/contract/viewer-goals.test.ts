// test/contract/viewer-goals.test.ts — the two viewer GOAL arms design/09's v0.2
// sweep found unenforced (V02-GATES.md, gates G3 and G5):
//
//   · G3 — Steppable animation (design/01 §2 L33-36). "The stepper … renders any
//     sample index WITHOUT RE-RUNNING THE SOLVER." The stepper mechanics are
//     covered in test/viewer/viewer.test.ts, but its OPERATIVE clause — no
//     re-solve while scrubbing — was never asserted anywhere. This file asserts
//     it with the same instrument test/contract/standing.test.ts uses for
//     A-STANDING-RESERVED's "zero integrate calls" arm: a hoisted counter on
//     `core/integrate.ts`, the sole stepper (ARCHITECTURE §2), so the count is
//     the number of times the physics engine actually ran.
//
//   · G5 — Failed lines are first-class (design/01 §2 L43-46). "The viewer can
//     scrub a MISTAKE line's trajectory and HUD." Both viewer test files load
//     the same single-line clean C30 golden; a mistake line's viewer
//     session/stepper/HUD path had zero coverage. This file loads a real
//     `premature` failure into a viewer session, focuses it, and scrubs its
//     trajectory and HUD exactly as a good line — proving the failed line is
//     per-instant inspectable, not a second-class dead end.
//
// WHY THIS LIVES IN test/contract/ AND NOT test/viewer/: the goal statements are
// behaviours of the viewer's own modules (`viewer/session`, `viewer/stepper`,
// `viewer/hud`, `viewer/bookmarks`), which any test may import; this file loads a
// real recomputed session through them and asserts the gate letters. It is
// placed here because test/viewer/** is owned by a concurrent agent this phase
// (the ownership boundary for this work package) — so the arms are added in an
// owned file that imports the viewer surface, rather than by editing a file
// outside ownership. Reported as a ratification item.

import { describe, it, expect, beforeAll, vi } from "vitest";

// G3's instrument: every integrate() call in this file rides a counting wrapper
// (behaviour unchanged — it delegates to the real engine). The count is what
// turns "the stepper agrees with the recorded line" into "the stepper never ran
// the engine", which is the substance of "without re-running the solver".
const integrateCalls = vi.hoisted(() => ({ n: 0 }));
vi.mock("../../src/core/integrate.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../src/core/integrate.js")>();
  const counted: typeof actual.integrate = (...args) => {
    integrateCalls.n += 1;
    return actual.integrate(...args);
  };
  return { ...actual, integrate: counted };
});

import { EVENT_KINDS } from "../../src/core/types.js";
import { isLineRefusal } from "../../src/solve/envelope.js";
import type { LineResult } from "../../src/solve/types.js";
import {
  loadSession,
  withFocus,
  focusedLine,
  type ViewerSession
} from "../../src/viewer/session.js";
import { hudAt } from "../../src/viewer/hud.js";
import { bookmarksOf } from "../../src/viewer/bookmarks.js";
import { HUD_GROUPS } from "../../src/viewer/types.js";
import {
  advance,
  domainOf,
  initialStepper,
  jumpTo,
  play,
  scrubTo,
  stationForTime,
  stepFrame,
  stepSample,
  timeForStation,
  toggleAxis
} from "../../src/viewer/stepper.js";

// F-ORACLE-90's own scenario, plus a premature mistake, so ONE loaded session
// carries both a clean good line and a real failure line (07 §4.2's multi-line
// scenario). loadSession = run(spec) in-process — the recompute-in-viewer rule.
const MISTAKE_SPEC = { road: { preset: "book90" }, entry_kmh: 34, turn_in: "auto", mistake: { kind: "premature" } };

function loadOrThrow(): ViewerSession {
  const loaded = loadSession(MISTAKE_SPEC);
  if (!loaded.ok) throw new Error(`session did not load: ${JSON.stringify(loaded.error)}`);
  return loaded.value;
}

let session: ViewerSession;
let loadCalls = 0; // integrate calls attributable to the one legitimate solve

beforeAll(() => {
  const before = integrateCalls.n;
  session = loadOrThrow();
  loadCalls = integrateCalls.n - before;
}, 300_000);

// ---------------------------------------------------------------------------
// G3 — the stepper renders any sample index WITHOUT re-running the solver.

describe("G3 — steppable animation without re-running the solver (design/01 §2)", () => {
  it("the one legitimate solve DID run the engine — the counter is the live instrument", () => {
    // The whole gate is a comparison against this baseline: loading the session
    // ran the engine (once, at load), so a scrub that adds nothing to the count
    // is a scrub that never touched the solver. A dead counter would make the
    // zero below vacuous; this proves it is not dead.
    expect(loadCalls).toBeGreaterThan(0);
    expect(session.lines.length).toBeGreaterThanOrEqual(2); // good line + mistake line
  });

  it("scrubbing every line over every sample index — and interpolated stations — adds ZERO integrate calls", () => {
    const before = integrateCalls.n;
    let probed = 0;

    for (const line of session.lines) {
      const samples = line.trajectory.samples;
      expect(samples.length).toBeGreaterThan(10);
      const sDomain = domainOf(line, "s");
      const tDomain = domainOf(line, "t");

      // (a) render the HUD at EVERY recorded sample index — "any sample index"
      for (let i = 0; i < samples.length; i++) {
        const hud = hudAt(session, line.line_id, { s: samples[i]!.s });
        expect(hud.ok, `HUD refused at sample ${i} of ${line.line_id}`).toBe(true);
        if (hud.ok) expect(hud.value.rows.length).toBeGreaterThan(15); // a real refresh, not a no-op
        probed++;
      }

      // (b) and at the interpolated midpoint of every bracket — the off-grid
      // cursor the drag actually lands on between samples
      for (let i = 0; i + 1 < samples.length; i++) {
        const mid = (samples[i]!.s + samples[i + 1]!.s) / 2;
        const hud = hudAt(session, line.line_id, { s: mid });
        expect(hud.ok, `HUD refused at interpolated s=${mid} of ${line.line_id}`).toBe(true);
        probed++;
      }

      // (c) drive the stepper itself across the whole line, every control
      let st = initialStepper(sDomain);
      for (let i = 0; i < samples.length; i++) st = stepSample(st, 1, line); // walk to the end, sample by sample
      for (let i = 0; i < samples.length; i++) st = stepSample(st, -1, line); // and back
      let framed = scrubTo(initialStepper(tDomain), (tDomain.min + tDomain.max) / 2, tDomain);
      framed = stepFrame(framed, 1, tDomain, line);
      framed = stepFrame(framed, -1, tDomain, line);
      toggleAxis(scrubTo(initialStepper(tDomain), (tDomain.min + tDomain.max) / 2, tDomain), line);

      // (d) playback = a scheduled scrub: 20 ticks of wall time down the line
      let p = play(initialStepper(tDomain));
      for (let k = 0; k < 20; k++) p = advance(p, 0.1, tDomain, line);

      // (e) the axis conversions the scrubber makes as it drags
      for (let k = 0; k <= 25; k++) {
        const t = tDomain.min + ((tDomain.max - tDomain.min) * k) / 25;
        stationForTime(line, t);
      }
      for (let k = 0; k <= 25; k++) {
        const s = sDomain.min + ((sDomain.max - sDomain.min) * k) / 25;
        timeForStation(line, s);
      }

      // (f) every named jump point, and a jump onto each
      for (const m of bookmarksOf(line)) jumpTo(initialStepper(tDomain), m, tDomain);
    }

    // THE GATE: not one of those renders re-ran the solver.
    expect(integrateCalls.n - before, "scrubbing re-ran the solver").toBe(0);
    // and it was a dense scrub, not a token one — "any sample index" densely
    expect(probed).toBeGreaterThan(200);
  });

  it("the instrument would catch a re-solve: a SECOND loadSession does move the counter", () => {
    // The dual of the zero above: the exact same counter, watching the exact
    // same engine, increments the moment anything actually solves. So "0 during
    // a scrub" is a measured absence of solving, not a counter that never moves.
    const before = integrateCalls.n;
    loadOrThrow();
    expect(integrateCalls.n).toBeGreaterThan(before);
  });
});

// ---------------------------------------------------------------------------
// G5 — a mistake line is per-instant inspectable exactly like a good line.

describe("G5 — the viewer scrubs a MISTAKE line's trajectory and HUD (design/01 §2)", () => {
  function mistakeLine(): LineResult {
    const line = session.lines.find((l) => l.role === "mistake");
    if (line === undefined) throw new Error("the premature scenario produced no mistake line");
    return line;
  }

  it("the failure is a FIRST-CLASS drawable line — a LineResult in the session, never shunted to refusals", () => {
    const mistake = mistakeLine();
    expect(isLineRefusal(mistake)).toBe(false);
    expect(session.lines.map((l) => l.line_id)).toContain(mistake.line_id);
    expect(session.refusals.map((r) => r.line_id)).not.toContain(mistake.line_id);
    // it genuinely FAILED — that is the whole point of inspecting it
    expect(mistake.verdict.quality).toBe("failing");
    expect(["contained", "stopped"]).not.toContain(mistake.verdict.outcome);
    expect(mistake.trajectory.samples.length).toBeGreaterThan(10);
    // and it takes focus exactly like a good line (07 §4.2)
    const focused = withFocus(session, mistake.line_id);
    expect(focusedLine(focused)?.line_id).toBe(mistake.line_id);
  });

  it("its trajectory scrubs end to end — every recorded sample index and every interpolated station resolves", () => {
    const mistake = mistakeLine();
    const focused = withFocus(session, mistake.line_id);
    const samples = mistake.trajectory.samples;

    for (let i = 0; i < samples.length; i++) {
      const hud = hudAt(focused, mistake.line_id, { s: samples[i]!.s });
      expect(hud.ok, `mistake HUD refused at sample ${i}`).toBe(true);
    }
    for (let i = 0; i + 1 < samples.length; i++) {
      const mid = (samples[i]!.s + samples[i + 1]!.s) / 2;
      expect(hudAt(focused, mistake.line_id, { s: mid }).ok, `mistake HUD refused at s=${mid}`).toBe(true);
    }

    // the stepper walks its samples both ways and lands ON records
    const sDomain = domainOf(mistake, "s");
    let st = initialStepper(sDomain);
    for (let i = 0; i < 5; i++) st = stepSample(st, 1, mistake);
    expect(st.value).toBe(samples[5]!.s);

    // and it plays to the terminal (the failure instant) and STOPS — there is no
    // state past the run-off, exactly as for a good line (05 §4, 07 §3.4)
    const tDomain = domainOf(mistake, "t");
    let p = play(scrubTo(initialStepper(tDomain), tDomain.max - 0.05, tDomain));
    p = advance(p, 1.0, tDomain, mistake);
    expect(p.value).toBe(tDomain.max);
    expect(p.playing).toBe(false);
  });

  it("its HUD populates all six of 07 §3.3's groups, and reads the FAILURE's own physics — the verdict row shows the run-off outcome", () => {
    const mistake = mistakeLine();
    const focused = withFocus(session, mistake.line_id);
    const samples = mistake.trajectory.samples;
    const mid = samples[Math.floor(samples.length / 2)]!.s;

    const hud = hudAt(focused, mistake.line_id, { s: mid });
    expect(hud.ok).toBe(true);
    if (!hud.ok) return;
    const groups = new Set(hud.value.rows.map((r) => r.group));
    for (const g of HUD_GROUPS) expect(groups, `mistake HUD group "${g}" empty`).toContain(g);
    for (const r of hud.value.rows) expect(HUD_GROUPS).toContain(r.group);

    // the failed line reads its OWN verdict, not a good line's — inspectable,
    // not sanitised: the verdict "outcome" row IS this line's failing outcome
    const outcomeRow = hud.value.rows.find((r) => r.label === "outcome");
    expect(outcomeRow, "no verdict outcome row on the mistake HUD").toBeDefined();
    expect(outcomeRow!.value).toBe(mistake.verdict.outcome);
    const roleRow = hud.value.rows.find((r) => r.label === "role");
    expect(roleRow!.value).toBe("mistake");
  });

  it("its named jump points are exactly its own events array — the failure instant is a bookmark like any other", () => {
    const mistake = mistakeLine();
    const marks = bookmarksOf(mistake);
    const events = mistake.trajectory.events;
    expect(marks.length).toBe(events.length);
    expect(marks.length).toBeGreaterThan(3);
    for (const [i, m] of marks.entries()) {
      expect(m.kind).toBe(events[i]!.kind);
      expect(EVENT_KINDS).toContain(m.kind);
      expect(m.t).toBe(events[i]!.t); // copied through, never re-derived
      expect(m.s).toBe(events[i]!.s);
    }
  });

  it("PARITY — the good line and the mistake line are both fully scrubbable from the same session", () => {
    const mistake = mistakeLine();
    const good = session.lines.find((l) => l.role !== "mistake");
    expect(good, "the scenario carried no good line to compare against").toBeDefined();
    for (const line of [good!, mistake]) {
      const d = domainOf(line, "s");
      const hud = hudAt(session, line.line_id, { s: (d.min + d.max) / 2 });
      expect(hud.ok, `${line.line_id} did not scrub`).toBe(true);
      if (hud.ok) expect(hud.value.rows.length).toBeGreaterThan(15);
      expect(bookmarksOf(line).length).toBeGreaterThan(0);
    }
  });
});
