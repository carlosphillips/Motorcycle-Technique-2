// viewer/stepper.ts — the cursor (design/07 §3.1–§3.2).
//
// ONE CURSOR, ONE PATHWAY. 07 §3.1: "Playback is a scheduled scrub — it moves
// the same cursor the drag moves; there is no second animation pathway." So
// every control in this file — drag, play tick, frame step, sample step,
// bookmark jump, axis flip — is a pure `StepperState → StepperState`
// transition, and the browser's timer (viewer/app.ts) does nothing but call
// `advance` with the elapsed wall time. There is no animation state here at
// all: no easing, no interpolation memory, no smoothing (07 §5.2 pins that
// "no smoothing state is introduced — it would break frame purity").
//
// The cursor's VALUE is a `stateAt` query coordinate, nothing else.
//
// THE DOMAIN-END DECISION, MADE ONCE, HERE: **the stepper CLAMPS.** 05 §4 hands
// the choice to the caller — "the function never clamps silently; clamping is a
// caller (viewer) policy" — and 07 §3.4 fixes which way the viewer must go: a
// line that ends early "freezes at its terminal sample", and "the cursor remains
// draggable across the full scenario extent so surviving lines in compare mode
// keep stepping". A refusal here would blank a pane mid-drag and stop compare
// mode dead; the freeze is the specified UX. So: `stateAt`/`dualAt` refuse
// `BAD_RANGE` past the domain and never clamp; this file clamps, in exactly one
// function — `clampTo` — which both the cursor transitions and the axis
// conversion below route through. Pinned by test/viewer/onecore.test.ts's
// "the domain-end policy is ONE decision" case.

import { dualAt } from "../core/stateAt.js";
import type { LineResult } from "../solve/types.js";
import { FRAME_STEP_S, PLAYBACK_SPEEDS } from "./constants.js";
import type { Bookmark, CursorAxis, CursorDomain, StepperState } from "./types.js";

/** The scrubber's extent on one axis — exactly `stateAt`'s own `[first, terminated]`. */
export function domainOf(line: LineResult, axis: CursorAxis): CursorDomain {
  const samples = line.trajectory.samples;
  const first = samples[0];
  const last = samples[samples.length - 1];
  const min = first === undefined ? 0 : axis === "s" ? first.s : first.t;
  const max = last === undefined ? 0 : axis === "s" ? last.s : last.t;
  return Object.freeze({ axis, min, max });
}

/**
 * design/07 §3.4 — "the cursor remains draggable across the full scenario
 * extent so surviving lines in compare mode keep stepping": the scrubber's
 * extent is the UNION of the loaded lines' domains, not the focused line's.
 * A line that ended early simply freezes at its terminal sample.
 */
export function scenarioDomain(lines: readonly LineResult[], axis: CursorAxis): CursorDomain {
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  for (const line of lines) {
    const d = domainOf(line, axis);
    if (d.min < min) min = d.min;
    if (d.max > max) max = d.max;
  }
  if (!Number.isFinite(min) || !Number.isFinite(max)) return Object.freeze({ axis, min: 0, max: 0 });
  return Object.freeze({ axis, min, max });
}

export function clampTo(value: number, domain: CursorDomain): number {
  return value < domain.min ? domain.min : value > domain.max ? domain.max : value;
}

/** The initial cursor: the start of the run, paused, at 1× (07 §3.1's default speed). */
export function initialStepper(domain: CursorDomain): StepperState {
  return Object.freeze({ axis: domain.axis, value: domain.min, playing: false, speed: 1 });
}

/** Drag: land the cursor anywhere in the domain. */
export function scrubTo(state: StepperState, value: number, domain: CursorDomain): StepperState {
  return Object.freeze({ ...state, value: clampTo(value, domain) });
}

export function play(state: StepperState): StepperState {
  return Object.freeze({ ...state, playing: true });
}

export function pause(state: StepperState): StepperState {
  return Object.freeze({ ...state, playing: false });
}

/** design/07 §3.1's closed speed set; an unlisted multiplier is not offered. */
export function withSpeed(state: StepperState, speed: number): StepperState {
  return (PLAYBACK_SPEEDS as readonly number[]).includes(speed) ? Object.freeze({ ...state, speed }) : state;
}

/**
 * Playback = a scheduled scrub. `wallDeltaS` is real elapsed seconds; the
 * cursor moves `speed × wallDeltaS` of RUN time. On the station axis the same
 * schedule advances the station cursor by the run-time equivalent through
 * `stationForTime`, so both axes play at the same real-time rate — one
 * pathway, two spellings. Reaching the end pauses (the run is over; there is
 * no state past the terminal sample, 05 §4).
 */
export function advance(state: StepperState, wallDeltaS: number, domain: CursorDomain, line?: LineResult): StepperState {
  if (!state.playing) return state;
  const runDelta = state.speed * wallDeltaS;
  const next =
    state.axis === "t"
      ? state.value + runDelta
      : line === undefined
        ? state.value + runDelta
        : stationForTime(line, timeForStation(line, state.value) + runDelta);
  if (next >= domain.max) return Object.freeze({ ...state, value: domain.max, playing: false });
  return Object.freeze({ ...state, value: clampTo(next, domain) });
}

/** design/07 §3.1 — the frame-step button: one HUD refresh, ±0.1 s. */
export function stepFrame(state: StepperState, direction: 1 | -1, domain: CursorDomain, line?: LineResult): StepperState {
  if (state.axis === "t") return scrubTo(state, state.value + direction * FRAME_STEP_S, domain);
  if (line === undefined) return state;
  return scrubTo(state, stationForTime(line, timeForStation(line, state.value) + direction * FRAME_STEP_S), domain);
}

/**
 * design/07 §3.1 — the other frame-step button: ± one recorded Sample. Lands
 * exactly ON a sample's coordinate, which is `stateAt`'s endpoint-exact case
 * (the record verbatim, no interpolation).
 */
export function stepSample(state: StepperState, direction: 1 | -1, line: LineResult): StepperState {
  const samples = line.trajectory.samples;
  if (samples.length === 0) return state;
  const key = (i: number): number => (state.axis === "s" ? samples[i]!.s : samples[i]!.t);
  // i0 = the last sample at or before the cursor. Forward is always i0 + 1;
  // backward is i0 when the cursor sits BETWEEN samples (step back onto the
  // one behind it) and i0 - 1 when it already sits ON one.
  const i0 = lastIndexAtOrBefore(samples.length, key, state.value);
  const back = key(i0) === state.value ? i0 - 1 : i0;
  const target = direction === 1 ? Math.min(i0 + 1, samples.length - 1) : Math.max(back, 0);
  return Object.freeze({ ...state, value: key(target) });
}

/**
 * design/07 §3.1 — "clicking a tick lands the scrubber at the event's
 * interpolated `t`". The bookmark carries the event's exact `t`/`s` (05 §5);
 * this copies the axis-matching one through with no arithmetic.
 */
export function jumpTo(state: StepperState, bookmark: Bookmark, domain: CursorDomain): StepperState {
  return scrubTo(state, state.axis === "s" ? bookmark.s : bookmark.t, domain);
}

/**
 * design/07 §3.1's axis toggle. Flipping the scrubber axis must not move the
 * bike: the new coordinate is the CURRENT instant's dual, read off the
 * recorded samples by the same bracket-and-lerp rule `stateAt` uses, so
 * `t`-axis 1.20 s and `s`-axis 14.7 m are the same instant.
 */
export function toggleAxis(state: StepperState, line: LineResult): StepperState {
  const axis: CursorAxis = state.axis === "t" ? "s" : "t";
  const value = state.axis === "t" ? stationForTime(line, state.value) : timeForStation(line, state.value);
  return Object.freeze({ ...state, axis, value });
}

/**
 * The last index whose axis key is at or before `value` — an INDEX lookup, not
 * an interpolation: `stepSample` lands exactly ON recorded samples, which is
 * `stateAt`'s endpoint-exact case, so no blend is involved and none is defined
 * here (the blend lives once, in `core/stateAt.ts`).
 */
function lastIndexAtOrBefore(length: number, key: (i: number) => number, value: number): number {
  let lo = 0;
  let hi = length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (key(mid) <= value) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

// ---------------------------------------------------------------------------
// Axis conversion (the recorded monotone `(s, t)` pairing, 05 §3)
//
// THERE IS NO SECOND INTERPOLATION RULE HERE. Both helpers delegate to
// `core/stateAt.ts`'s `dualAt`, which shares `stateAt`'s own bracket search and
// `linear` blend — so the axis toggle, the playback schedule and the HUD can
// never land on different instants (C-ONE-CORE). The only thing this file adds
// is the CLAMP declared at the top of this module, and it adds it through the
// same `clampTo` the cursor transitions use — one policy, one implementation.

function convert(line: LineResult, value: number, from: "s" | "t"): number {
  const samples = line.trajectory.samples;
  const first = samples[0];
  const last = samples[samples.length - 1];
  if (first === undefined || last === undefined) return 0;
  const to: "s" | "t" = from === "s" ? "t" : "s";
  const inDomain = clampTo(value, { axis: from, min: first[from], max: last[from] });
  const dual = dualAt(line.trajectory, from === "s" ? { s: inDomain } : { t: inDomain });
  // in-domain by the clamp above, so `dualAt` cannot refuse; the fallback keeps
  // the function total rather than asserting
  return dual.ok ? dual.value : first[to];
}

/** The station this line reaches at run time `t`. */
export function stationForTime(line: LineResult, t: number): number {
  return convert(line, t, "t");
}

/** The run time at which this line reaches station `s`. */
export function timeForStation(line: LineResult, s: number): number {
  return convert(line, s, "s");
}
