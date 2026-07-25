// test/viewer/compare.test.ts — C-COMPARE (design/09 L2005): "in compare mode
// each line's ghost state equals its OWN `stateAt`; lines never share or leak
// state."
//
// Proven on a REAL multi-line envelope — a good line vs an `overspeed` MISTAKE
// line on book90 (05 §7's N-line result) — three ways:
//   1. STATION LOCK: at one shared station `s`, each ghost's instant is exactly
//      `stateAt(THAT line, {s})`, and the two ghosts differ (no shared state) —
//      swapping them is observable (07 §4.1).
//   2. TIME LOCK: at one shared elapsed `t`, the two lines sit at DIFFERENT
//      stations (the ghost race), and again each ghost is its own `stateAt`.
//   3. NO LEAK / independence: every ghost `instant` is a fresh FROZEN object;
//      recomputing the model at another cursor never mutates an earlier one, and
//      a line whose extent the shared coordinate outran freezes at its terminal
//      (07 §3.4) — its OWN terminal, not the focused line's.
//
// Plus the topdown ghost glyphs (07 §4.2): the non-focused line draws as a
// reduced-opacity, verdict-coloured glyph; a single-line envelope draws none, so
// its topdown is byte-identical to the v0.2 export + cursor.

import { describe, it, expect, beforeAll } from "vitest";

import { loadSession, stateInputFor, type ViewerSession } from "../../src/viewer/session.js";
import { compareModel, lockAxisOf } from "../../src/viewer/compare.js";
import { createApp, frameOf, focusLine, setLock } from "../../src/viewer/app.js";
import { domainOf } from "../../src/viewer/stepper.js";
import { COMPARE_GHOST_OPACITY } from "../../src/viewer/constants.js";
import { stateAt } from "../../src/core/stateAt.js";
import type { LineResult } from "../../src/solve/types.js";
import type { InstantState } from "../../src/core/types.js";

/** book90 @34 with an `overspeed` mistake: a clean good line + a departing mistake line. */
const SPEC = { road: { preset: "book90" }, entry_kmh: 34, turn_in: "auto", mistake: { kind: "overspeed" } };

let session: ViewerSession;
let good: LineResult;
let mistake: LineResult;

beforeAll(() => {
  const loaded = loadSession(SPEC, { engine_semver: "0.1.0" });
  if (!loaded.ok) throw new Error(`compare fixture did not load: ${JSON.stringify(loaded.error)}`);
  session = loaded.value;
  const m = session.lines.find((l) => l.role === "mistake");
  const g = session.lines.find((l) => l.role !== "mistake");
  if (m === undefined || g === undefined) {
    throw new Error(`compare fixture needs a good AND a mistake line; got roles ${session.lines.map((l) => l.role).join(", ")}`);
  }
  mistake = m;
  good = g;
}, 180_000);

/** the focused (good) line's own instant at a query — the shared-coordinate source. */
function focusInstantAt(query: { s: number } | { t: number }): InstantState {
  const r = stateAt(stateInputFor(session, good), query);
  if (!r.ok) throw new Error(`good line stateAt refused at ${JSON.stringify(query)}: ${JSON.stringify(r.error)}`);
  return r.value;
}

/** a station strictly inside BOTH lines' domains (the shared approach). */
function sharedStation(frac: number): number {
  const g = domainOf(good, "s");
  const m = domainOf(mistake, "s");
  const lo = Math.max(g.min, m.min);
  const hi = Math.min(g.max, m.max);
  return lo + frac * (hi - lo);
}

/** an elapsed time strictly inside BOTH lines' domains. */
function sharedTime(frac: number): number {
  const g = domainOf(good, "t");
  const m = domainOf(mistake, "t");
  const lo = Math.max(g.min, m.min);
  const hi = Math.min(g.max, m.max);
  return lo + frac * (hi - lo);
}

// ---------------------------------------------------------------------------

describe("C-COMPARE — station lock: each ghost is its OWN stateAt at the shared station (design/09 L2005)", () => {
  it("the fixture really has two DISTINCT drawable lines", () => {
    expect(session.lines.length).toBeGreaterThanOrEqual(2);
    expect(good.line_id).not.toBe(mistake.line_id);
    expect(mistake.verdict.outcome).not.toBe("contained"); // it is a real mistake line
  });

  it("every ghost's instant equals `stateAt(that line, {s})` — the model leaks no state between lines", () => {
    const sStar = sharedStation(0.45);
    const focus = focusInstantAt({ s: sStar });
    expect(focus.sample.s).toBe(sStar); // lock_coord source is the focused line's own s

    const model = compareModel(session, focus, "station");
    expect(model.lock).toBe("station");
    expect(lockAxisOf(model.lock)).toBe("s");
    expect(model.lock_coord).toBe(sStar);
    expect(model.ghosts.length).toBe(session.lines.length);

    for (const ghost of model.ghosts) {
      const line = session.lines.find((l) => l.line_id === ghost.line_id)!;
      // THIS line's own stateAt at the shared station — the SAME arithmetic surface
      const own = stateAt(stateInputFor(session, line), { s: sStar });
      expect(own.ok).toBe(true);
      if (!own.ok) continue;
      expect(ghost.instant).not.toBeNull();
      // byte-for-byte the line's own instant (no clamp inside both domains)
      expect(ghost.instant).toEqual(own.value);
      expect(ghost.frozen).toBe(false);
      expect(ghost.at).toBe(sStar);
      expect(ghost.focused).toBe(line.line_id === session.focus);
    }
  });

  it("the two ghosts genuinely DIFFER at the same station — swapping their states is observable (no shared state)", () => {
    const sStar = sharedStation(0.45);
    const model = compareModel(session, focusInstantAt({ s: sStar }), "station");
    const gGood = model.ghosts.find((x) => x.line_id === good.line_id)!;
    const gMist = model.ghosts.find((x) => x.line_id === mistake.line_id)!;
    expect(gGood.instant).not.toBeNull();
    expect(gMist.instant).not.toBeNull();
    // at the same station the overspeed line differs from the good line — the
    // whole point of station-lock comparison (07 §4.1)
    expect(JSON.stringify(gGood.instant!.sample)).not.toBe(JSON.stringify(gMist.instant!.sample));
    // and it is the SPEED that separates them here (overspeed carries more)
    expect(gMist.instant!.sample.v).not.toBe(gGood.instant!.sample.v);
    // "swapping two members' states is observable": each line's own stateAt at
    // this station is a DIFFERENT object than the other's
    const ownGood = stateAt(stateInputFor(session, good), { s: sStar });
    const ownMist = stateAt(stateInputFor(session, mistake), { s: sStar });
    expect(ownGood.ok && ownMist.ok).toBe(true);
    if (ownGood.ok && ownMist.ok) {
      expect(JSON.stringify(ownGood.value.sample)).not.toBe(JSON.stringify(ownMist.value.sample));
    }
  });

  it("mutating (recomputing) one line's cursor never moves another's — ghost instants are frozen and independent", () => {
    const model1 = compareModel(session, focusInstantAt({ s: sharedStation(0.4) }), "station");
    const mistGhost1 = model1.ghosts.find((x) => x.line_id === mistake.line_id)!;
    expect(mistGhost1.instant).not.toBeNull();
    expect(Object.isFrozen(mistGhost1.instant)).toBe(true);
    const snapshot = JSON.stringify(mistGhost1.instant);

    // recompute the model at a COMPLETELY different cursor (a different focused
    // station) — the earlier model's mistake ghost must be untouched
    const model2 = compareModel(session, focusInstantAt({ s: sharedStation(0.8) }), "station");
    const mistGhost2 = model2.ghosts.find((x) => x.line_id === mistake.line_id)!;
    expect(JSON.stringify(mistGhost2.instant)).not.toBe(snapshot); // it DID move (different lock coord)
    expect(JSON.stringify(mistGhost1.instant)).toBe(snapshot); // …but the first model is unchanged
  });
});

// ---------------------------------------------------------------------------

describe("C-COMPARE — time lock: the ghost race (07 §4.1)", () => {
  it("at the same elapsed t the lines sit at DIFFERENT stations, each its own stateAt", () => {
    const tStar = sharedTime(0.5);
    const focus = focusInstantAt({ t: tStar });
    expect(focus.sample.t).toBe(tStar);

    const model = compareModel(session, focus, "time");
    expect(model.lock_axis).toBe("t");
    expect(model.lock_coord).toBe(tStar);

    const gGood = model.ghosts.find((x) => x.line_id === good.line_id)!;
    const gMist = model.ghosts.find((x) => x.line_id === mistake.line_id)!;
    // each ghost is its own line's stateAt at the shared time
    expect(gGood.instant).toEqual(stateAt(stateInputFor(session, good), { t: tStar }).ok ? stateAt(stateInputFor(session, good), { t: tStar }).value : null);
    expect(gMist.instant).toEqual(stateAt(stateInputFor(session, mistake), { t: tStar }).ok ? stateAt(stateInputFor(session, mistake), { t: tStar }).value : null);
    // the ghost race: at the same time the two lines are at different stations
    expect(gGood.instant).not.toBeNull();
    expect(gMist.instant).not.toBeNull();
    expect(gMist.instant!.sample.s).not.toBe(gGood.instant!.sample.s);
  });
});

// ---------------------------------------------------------------------------

describe("C-COMPARE — freeze at terminal (07 §3.4): a line the shared coordinate outran freezes at its OWN terminal", () => {
  it("a station past the mistake line's end freezes ITS ghost at ITS terminal, while the good line keeps stepping", () => {
    const mistMaxS = domainOf(mistake, "s").max;
    const goodMaxS = domainOf(good, "s").max;
    // a station past the (shorter) mistake line but still inside the good line
    expect(goodMaxS).toBeGreaterThan(mistMaxS);
    const sStar = (mistMaxS + goodMaxS) / 2;

    const model = compareModel(session, focusInstantAt({ s: sStar }), "station");
    const gMist = model.ghosts.find((x) => x.line_id === mistake.line_id)!;
    const gGood = model.ghosts.find((x) => x.line_id === good.line_id)!;

    // the mistake line is frozen at its OWN terminal (not the focused line's coord)
    expect(gMist.frozen).toBe(true);
    expect(gMist.at).toBe(mistMaxS);
    expect(gMist.instant).not.toBeNull();
    expect(gMist.instant!.sample.s).toBeCloseTo(mistMaxS, 6);
    // the good (focused) line keeps stepping at the shared coordinate
    expect(gGood.frozen).toBe(false);
    expect(gGood.at).toBe(sStar);
  });
});

// ---------------------------------------------------------------------------

describe("compare-mode ghost glyphs (07 §4.2) — non-focused lines draw as reduced-opacity, verdict-coloured glyphs", () => {
  it("the app frame exposes the compare model and draws one ghost glyph per non-focused drawable line", () => {
    const app = focusLine(createApp(session), good.line_id);
    const frame = frameOf(app);

    // the compare model rides its own frame field, complete (focused line included)
    expect(frame.compare).not.toBeNull();
    expect(frame.compare!.ghosts.length).toBe(session.lines.length);
    expect(frame.compare!.ghosts.filter((g) => g.focused).length).toBe(1);

    // the topdown carries the focused line's OWN cursor glyph …
    const topdown = frame.views.find((v) => v.view === "topdown")!;
    expect(topdown.svg).toContain('data-overlay="glyph"');
    // … plus exactly one ghost glyph (the non-focused mistake line)
    const nonFocused = session.lines.filter((l) => l.line_id !== good.line_id).length;
    const ghosts = topdown.svg.match(/data-overlay="ghost-glyph"/g) ?? [];
    expect(ghosts.length).toBe(nonFocused);
    expect(ghosts.length).toBeGreaterThan(0);
    // the ghost draws at reduced opacity (07 §4.2), keeping the line's verdict colour
    expect(topdown.svg).toContain(`data-overlay="ghost-glyph" data-line="${mistake.line_id}" opacity="${COMPARE_GHOST_OPACITY}"`);
    // and the frame still carries exactly the two v0.2 panes (pov rides its own field)
    expect(frame.views.map((v) => v.view)).toEqual(["topdown", "controls"]);
    expect(frame.pov).not.toBeNull();
    expect(frame.pov!.view).toBe("pov");
  });

  it("the lock toggle changes how lines align but not that each reads its own stateAt (07 §4.1)", () => {
    const app = focusLine(createApp(session), good.line_id);
    const station = frameOf(setLock(app, "station"));
    const time = frameOf(setLock(app, "time"));
    expect(station.compare!.lock_axis).toBe("s");
    expect(time.compare!.lock_axis).toBe("t");
    // both read the same recorded results — every ghost still resolves to an instant
    for (const g of [...station.compare!.ghosts, ...time.compare!.ghosts]) {
      if (g.focused) expect(g.instant).not.toBeNull();
    }
  });

  it("a SINGLE-line envelope draws no ghost glyphs — its topdown is the export + cursor, unchanged from v0.2", { timeout: 180_000 }, () => {
    const solo = loadSession({ road: { preset: "book90" }, entry_kmh: 34, turn_in: "auto" }, { engine_semver: "0.1.0" });
    expect(solo.ok).toBe(true);
    if (!solo.ok) return;
    const frame = frameOf(createApp(solo.value));
    const topdown = frame.views.find((v) => v.view === "topdown")!;
    expect(topdown.svg).not.toContain('data-overlay="ghost-glyph"');
    expect(frame.compare!.ghosts.length).toBe(1);
    expect(frame.compare!.ghosts[0]!.focused).toBe(true);
  });
});
