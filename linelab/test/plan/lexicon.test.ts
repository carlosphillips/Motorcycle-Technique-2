// test/plan/lexicon.test.ts — the rider lexicon (plan/doctrine/lexicon.ts).
//
// The lexicon exists because the figures handed a reader `late_apex`,
// `out_in_out`, `single_input`, `rideability: tracker overdrive`. It is
// PRESENTATION: it must cover the whole catalogue, must never smuggle in a
// second opinion about whether a line passed, and must never say more than the
// check recorded.

import { describe, it, expect } from "vitest";

import { CHECK_IDS, type CheckId } from "../../src/plan/doctrine/checks.js";
import { CHECK_LEXICON, checkLexiconRows, riderMessage } from "../../src/plan/doctrine/lexicon.js";

describe("the lexicon covers the catalogue, exactly", () => {
  it("has a phrasing for every check id and no id of its own", () => {
    expect(Object.keys(CHECK_LEXICON).sort()).toEqual([...CHECK_IDS].sort());
    expect(checkLexiconRows().map((r) => r.id)).toEqual([...CHECK_IDS]);
  });

  it("every entry says what it is, why it matters, and what to do about it", () => {
    for (const row of checkLexiconRows()) {
      expect(row.title.length, `${row.id}: empty title`).toBeGreaterThan(3);
      expect(row.why.length, `${row.id}: empty why`).toBeGreaterThan(30);
      expect(row.fix.length, `${row.id}: empty fix`).toBeGreaterThan(20);
    }
  });

  // The failure the lexicon exists to fix: a reader meeting an identifier.
  it("no rider-facing sentence contains an engine identifier", () => {
    const prose = checkLexiconRows()
      .flatMap((r) => [r.title, r.why, r.fix])
      .join(" ");
    for (const id of CHECK_IDS) expect(prose, `the prose leaks the identifier ${id}`).not.toContain(id);
    for (const field of ["ssd", "phi", "cmd_a", "_m", "apex_pct"]) {
      expect(prose, `the prose leaks the field name ${field}`).not.toContain(field);
    }
  });
});

describe("riderMessage says only what the check recorded", () => {
  it("reads the check's own metrics, and declines when they are absent", () => {
    expect(riderMessage("late_apex", undefined)).toBeNull();
    expect(riderMessage("late_apex", { apex_pct: 31.8 })).toBeNull(); // no bar → no claim
    expect(riderMessage("single_input", { count: 3 })).toBeNull(); // no allowance → no claim
  });

  it("puts fig 8.3's disputed number in a scope that makes it true", () => {
    // The figure draws six turn-point markers (the marker-from-event law is
    // record-wide) and the check reads three (the three inside c1, before the
    // line left the road). Both are right; the phrasing has to say WHICH.
    expect(riderMessage("single_input", { count: 3, allowed: 1 })).toBe(
      "you steered 3 separate times inside this corner where one input would do"
    );
    expect(riderMessage("single_input", { count: 1, allowed: 1 })).toContain("one committed steering input");
    expect(riderMessage("single_input", { count: 0, allowed: 1 })).toContain("no steering input");
  });

  it("keeps the apex verdict on the same side of the bar as the check did", () => {
    const early = riderMessage("late_apex", { apex_pct: 31.8, bar: 50 });
    const late = riderMessage("late_apex", { apex_pct: 66.3, bar: 50 });
    expect(early).toContain("before the middle");
    expect(early).toContain("past 50%");
    expect(late).toContain("past the 50%");
    // and never the other way round
    expect(late).not.toContain("asks you to wait");
  });

  it("reports a sight deficit as the metres of sight that were missing", () => {
    expect(riderMessage("stop_within_sight", { max_deficit_m: 22.2 })).toBe(
      "you needed 22 m more sight than you had to stop in what you could see"
    );
    expect(riderMessage("stop_within_sight", { max_deficit_m: 0 })).toContain("always have stopped");
  });

  it("has no rewrite for checks whose own message already reads plainly", () => {
    for (const id of ["out_in_out", "chain_flow", "link_continuity", "rideability"] as CheckId[]) {
      expect(riderMessage(id, { anything: 1 }), `${id} should defer to the catalogue's own wording`).toBeNull();
    }
  });
});
