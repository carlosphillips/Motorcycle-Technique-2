// test/viewer/viewer.test.ts — the v0.2 viewer's own gates (design/07).
//
// What this file demonstrates, as real usage rather than coverage:
//
//   · `C-BOOKMARKS` (07 §3.1) — the named jump points are EXACTLY the result's
//     `events` array. Proved three ways: one-for-one against the recorded
//     events, no kind outside 05 §5's closed set, and the print/parse
//     round-trip that carries a bookmark through a share/URL-shaped string and
//     back to the same event.
//   · the stepper (07 §3.1) — one cursor, one pathway: playback IS a scheduled
//     scrub of the same value a drag moves; ±0.1 s and ± one Sample land where
//     the doc says; the axis flip does not move the bike.
//   · per-view boot smoke (00 §3's phase table) — every view the viewer offers
//     renders, once, without throwing, over a real recomputed session.
//   · the import law — `viewer/` may see `core…render`, and must never import
//     from `src/cli/` (ARCHITECTURE §2's "viewer beside cli").
//
// The session under test is recomputed from a SPEC, in-process, by the same
// `run` the CLI calls — which is the recompute-in-viewer rule (07 §2.1) being
// exercised, not simulated.

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

import { EVENT_KINDS } from "../../src/core/types.js";
import { loadSession, type ViewerSession } from "../../src/viewer/session.js";
import { bookmarksOf, parseBookmark, printBookmark } from "../../src/viewer/bookmarks.js";
import {
  domainOf,
  initialStepper,
  jumpTo,
  play,
  scrubTo,
  stepFrame,
  stepSample,
  toggleAxis,
  advance,
  withSpeed,
  stationForTime,
  timeForStation
} from "../../src/viewer/stepper.js";
import { bootViews, renderView } from "../../src/viewer/views.js";
import { hudAt } from "../../src/viewer/hud.js";
import { VIEWER_VIEWS, PLAYBACK_SPEEDS } from "../../src/viewer/index.js";
import { FRAME_STEP_S } from "../../src/viewer/constants.js";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "../..");

/**
 * The C30 golden's own recorded input (test/fixtures/goldens/C30.json) — a
 * blessed fixture, so the session below is the engine's real, committed
 * behaviour rather than a hand-built stand-in.
 */
const C30_SPEC = (JSON.parse(readFileSync(join(repoRoot, "test/fixtures/goldens/C30.json"), "utf8")) as {
  input: { input: unknown };
}).input.input;

function session(): ViewerSession {
  const loaded = loadSession(C30_SPEC);
  if (!loaded.ok) throw new Error(`C30 spec did not load: ${JSON.stringify(loaded.error)}`);
  return loaded.value;
}

// ---------------------------------------------------------------------------

describe("recompute-in-viewer (design/07 §2.1)", () => {
  it("loads a SPEC — never a trajectory — and runs the engine itself to produce the lines", () => {
    const s = session();
    // the payload carried a road + an entry speed; the samples came from here
    expect(Object.keys(C30_SPEC as object).sort()).toEqual(["entry_kmh", "road"]);
    expect(s.lines.length).toBeGreaterThan(0);
    expect(s.lines[0]!.trajectory.samples.length).toBeGreaterThan(100);
    expect(s.focus).toBe(s.lines[0]!.line_id);
    // and the composed road came through with its drawing members intact
    expect(typeof s.road.worldAt).toBe("function");
    expect(s.road.dsl).toBe("lane 3.5 | S 35 | R 30 ^90 | S 25");
  });

  it("a payload the engine refuses returns the engine's typed error, not a thrown page", () => {
    const bad = loadSession({ road: "lane 3.5 | S 10", entry_kmh: -5 });
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(["SCHEMA", "BAD_RANGE", "NO_SOLUTION"]).toContain(bad.error.code);
  });
});

// ---------------------------------------------------------------------------

describe("C-BOOKMARKS — named jump points are exactly the events array (07 §3.1)", () => {
  it("one bookmark per recorded event, in order, with the event's own exact (s, t)", () => {
    const line = session().lines[0]!;
    const events = line.trajectory.events;
    const marks = bookmarksOf(line);

    expect(marks.length).toBe(events.length);
    expect(marks.length).toBeGreaterThan(3); // C30 emits brake_start/crack/turn_in/apex/…
    for (const [i, m] of marks.entries()) {
      const e = events[i]!;
      expect(m.kind).toBe(e.kind);
      expect(m.t).toBe(e.t); // copied through, never re-derived
      expect(m.s).toBe(e.s);
      expect(m.index).toBe(i);
    }
  });

  it("no bookmark kind outside design/05 §5's closed set — there is no second source", () => {
    for (const m of bookmarksOf(session().lines[0]!)) {
      expect(EVENT_KINDS).toContain(m.kind);
    }
  });

  it("repeat occurrences carry the doc's `apex#2` ordinal spelling; the first is bare", () => {
    const line = session().lines[0]!;
    const marks = bookmarksOf(line);
    const byKind = new Map<string, number>();
    for (const m of marks) {
      const n = (byKind.get(m.kind) ?? 0) + 1;
      byKind.set(m.kind, n);
      expect(m.ordinal).toBe(n);
      expect(m.label).toBe(n === 1 ? m.kind : `${m.kind}#${n}`);
    }
  });

  it("round-trips: every bookmark prints to a token that parses back to the identical bookmark", () => {
    const line = session().lines[0]!;
    for (const m of bookmarksOf(line)) {
      const back = parseBookmark(printBookmark(m), line);
      expect(back.ok, `round-trip of "${printBookmark(m)}"`).toBe(true);
      if (back.ok) expect(back.value).toEqual(m);
    }
  });

  it("a token naming a kind this line never emitted is UNKNOWN_ID, never a nearest match", () => {
    const line = session().lines[0]!;
    const missing = parseBookmark("hazard_visible#9", line);
    expect(missing.ok).toBe(false);
    if (!missing.ok) {
      expect(missing.error.code).toBe("UNKNOWN_ID");
      expect(missing.error.detail?.["reason"]).toBe("bookmark_not_on_line");
    }
    const notAKind = parseBookmark("tau_close_s", line); // D44: not an event, not a jump target
    expect(notAKind.ok).toBe(false);
    if (!notAKind.ok) expect(notAKind.error.detail?.["reason"]).toBe("unknown_event_kind");
  });

  it("clicking a tick lands the scrubber on the event's own time", () => {
    const line = session().lines[0]!;
    const turnIn = bookmarksOf(line).find((b) => b.kind === "turn_in")!;
    const domain = domainOf(line, "t");
    const landed = jumpTo(initialStepper(domain), turnIn, domain);
    expect(landed.value).toBe(turnIn.t);
  });
});

// ---------------------------------------------------------------------------

describe("the stepper — one cursor, one pathway (07 §3.1)", () => {
  it("playback is a scheduled scrub of the SAME cursor: N ticks of dt at 1x == one drag of N*dt", () => {
    const line = session().lines[0]!;
    const domain = domainOf(line, "t");
    let played = play(initialStepper(domain));
    for (let i = 0; i < 10; i++) played = advance(played, 0.1, domain, line);
    const dragged = scrubTo(initialStepper(domain), domain.min + 1.0, domain);
    expect(played.value).toBeCloseTo(dragged.value, 10);
  });

  it("a 2x tick covers twice the run time of a 1x tick of the same wall duration", () => {
    const line = session().lines[0]!;
    const domain = domainOf(line, "t");
    const base = play(initialStepper(domain));
    const one = advance(base, 0.4, domain, line);
    const two = advance(withSpeed(base, 2), 0.4, domain, line);
    expect(two.value - domain.min).toBeCloseTo(2 * (one.value - domain.min), 10);
    expect(PLAYBACK_SPEEDS).toContain(2);
  });

  it("an unlisted speed multiplier is not offered — the closed set holds", () => {
    const domain = domainOf(session().lines[0]!, "t");
    expect(withSpeed(initialStepper(domain), 3.7).speed).toBe(1);
  });

  it("the frame-step button moves exactly ±0.1 s on the time axis", () => {
    const line = session().lines[0]!;
    const domain = domainOf(line, "t");
    const at = scrubTo(initialStepper(domain), 2.0, domain);
    expect(stepFrame(at, 1, domain, line).value).toBeCloseTo(2.0 + FRAME_STEP_S, 10);
    expect(stepFrame(at, -1, domain, line).value).toBeCloseTo(2.0 - FRAME_STEP_S, 10);
  });

  it("the sample-step button lands exactly ON recorded samples, in both directions", () => {
    const line = session().lines[0]!;
    const domain = domainOf(line, "s");
    const stations = line.trajectory.samples.map((p) => p.s);
    // start between two samples, step forward twice, back once
    const between = scrubTo({ ...initialStepper(domain), axis: "s" }, (stations[10]! + stations[11]!) / 2, domain);
    const fwd = stepSample(between, 1, line);
    expect(fwd.value).toBe(stations[11]);
    const fwd2 = stepSample(fwd, 1, line);
    expect(fwd2.value).toBe(stations[12]);
    expect(stepSample(fwd2, -1, line).value).toBe(stations[11]);
  });

  it("flipping the scrubber axis does not move the bike: t and s name the same instant", () => {
    const line = session().lines[0]!;
    const tDomain = domainOf(line, "t");
    const at = scrubTo(initialStepper(tDomain), 2.4, tDomain);
    const flipped = toggleAxis(at, line);
    expect(flipped.axis).toBe("s");
    expect(flipped.value).toBeCloseTo(stationForTime(line, 2.4), 10);
    // and back again
    expect(toggleAxis(flipped, line).value).toBeCloseTo(2.4, 6);
    expect(timeForStation(line, flipped.value)).toBeCloseTo(2.4, 6);
  });

  it("the cursor never leaves [first, terminated] — clamping is the viewer's job, not stateAt's", () => {
    const line = session().lines[0]!;
    const domain = domainOf(line, "t");
    expect(scrubTo(initialStepper(domain), -100, domain).value).toBe(domain.min);
    expect(scrubTo(initialStepper(domain), 1e9, domain).value).toBe(domain.max);
    // and the underlying query still refuses out of domain rather than clamping
    const past = hudAt(session(), line.line_id, { t: domain.max + 10 });
    expect(past.ok).toBe(false);
    if (!past.ok) expect(past.error.code).toBe("BAD_RANGE");
  });

  it("playback stops at the end of the run — there is no state past the terminal sample", () => {
    const line = session().lines[0]!;
    const domain = domainOf(line, "t");
    let s = play(scrubTo(initialStepper(domain), domain.max - 0.05, domain));
    s = advance(s, 1.0, domain, line);
    expect(s.value).toBe(domain.max);
    expect(s.playing).toBe(false);
  });
});

// ---------------------------------------------------------------------------

describe("per-view boot smoke (00 §3 phase table)", () => {
  it("every view the viewer offers renders once, without throwing, over a real session", () => {
    const s = session();
    const hud = hudAt(s, s.focus, { s: 20 });
    expect(hud.ok).toBe(true);
    const instant = hud.ok ? hud.value.instant : null;

    const booted = bootViews(s, instant);
    expect(booted.length).toBe(VIEWER_VIEWS.length);
    for (const [i, r] of booted.entries()) {
      const view = VIEWER_VIEWS[i]!;
      expect(r.ok, `${view} failed to boot: ${r.ok ? "" : JSON.stringify(r.error)}`).toBe(true);
      if (r.ok) {
        expect(r.value.view).toBe(view);
        expect(r.value.svg.startsWith("<svg")).toBe(true);
        expect(r.value.svg.endsWith("</svg>")).toBe(true);
        // never the never-throw fallback card
        expect(r.value.svg).not.toContain("render failed");
      }
    }
  });

  it("the top-down is the exported picture PLUS a glyph layer — nothing else changes (07 §2.3)", () => {
    const s = session();
    const hud = hudAt(s, s.focus, { s: 40 });
    expect(hud.ok).toBe(true);
    if (!hud.ok) return;

    const bare = renderView(s, { view: "topdown", instant: null });
    const withCursor = renderView(s, { view: "topdown", instant: hud.value.instant });
    expect(bare.ok && withCursor.ok).toBe(true);
    if (!bare.ok || !withCursor.ok) return;

    const overlay = withCursor.value.svg.slice(bare.value.svg.length - "</svg>".length, -"</svg>".length);
    expect(overlay).toContain('data-overlay="glyph"');
    expect(overlay).toContain('data-overlay="tilt-bar"');
    // strip the overlay back out and the byte string is the export, exactly
    expect(withCursor.value.svg.replace(overlay, "")).toBe(bare.value.svg);
  });

  it("`pov` is still phase-gated — one deferral statement, render/'s own", () => {
    const r = renderView(session(), { view: "pov", instant: null });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.code).toBe("SCHEMA");
      expect(r.error.deferred).toBe("immersion (v0.3)");
    }
    expect(VIEWER_VIEWS as readonly string[]).not.toContain("pov");
  });

  it("an unknown view name is SCHEMA/unknown_view naming the views that exist", () => {
    const r = renderView(session(), { view: "chase", instant: null });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.detail?.["reason"]).toBe("unknown_view");
  });
});

// ---------------------------------------------------------------------------
// The import law. `test/meta/imports.test.ts` ranks `viewer/` EQUAL to `cli/`,
// which lets its DAG check pass an import in either direction; ARCHITECTURE §2
// means the stricter thing ("viewer beside cli"), so the viewer→cli half is
// asserted here, at the viewer's own gate.

function listTs(dir: string): string[] {
  const out: string[] = [];
  for (const e of readdirSync(dir, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
    const full = join(dir, e.name);
    if (e.isDirectory()) out.push(...listTs(full));
    else if (e.isFile() && e.name.endsWith(".ts")) out.push(full);
  }
  return out;
}

describe("import law — viewer beside cli (ARCHITECTURE §2)", () => {
  const viewerDir = join(repoRoot, "src", "viewer");

  it("no file under src/viewer/ imports from src/cli/", () => {
    const offenders: string[] = [];
    for (const file of listTs(viewerDir)) {
      const text = readFileSync(file, "utf8");
      for (const m of text.matchAll(/\bfrom\s+["']([^"']+)["']/g)) {
        const spec = m[1] ?? "";
        if (!spec.startsWith(".")) continue;
        const target = resolve(dirname(file), spec);
        if (target.includes(`${sep}cli${sep}`)) offenders.push(`${file}: ${spec}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("src/viewer/ carries no runtime dependency — every non-relative import is absent (D1)", () => {
    const offenders: string[] = [];
    for (const file of listTs(viewerDir)) {
      const text = readFileSync(file, "utf8");
      for (const m of text.matchAll(/\bfrom\s+["']([^"']+)["']/g)) {
        const spec = m[1] ?? "";
        if (!spec.startsWith(".")) offenders.push(`${file}: ${spec}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("the viewer directory exists and is being scanned", () => {
    expect(statSync(viewerDir).isDirectory()).toBe(true);
    expect(listTs(viewerDir).length).toBeGreaterThanOrEqual(9);
  });
});
