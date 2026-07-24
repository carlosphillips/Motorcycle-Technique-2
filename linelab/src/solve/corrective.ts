// solve/corrective.ts — the corrective shot (D18; design/04 §4a): the machinery
// that decides `wide` vs `runoff`. This file owns the run_wide_detect predicate
// (§4a.2), the shot-start rule (§4a.3), the in-hash corrective verdict block
// shape (§4a.6 — deliberately NO rider field, D42 §4c.7), and the wide/runoff
// law (§4a.6). The shadow itself is ONE call of the counterfactual harness:
// `correctiveShot` is a named thin wrapper and declares its (rider, predicate)
// binding at this definition site (§4c.1) — CORRECTIVE_BINDING below.
//
// The shadow is BRANCHED, never the main integration (§4a.7): the drawn line is
// always the plan's own uncorrected consequence; the only main-line artifacts
// are two events (run_wide_detect, correction) and the verdict block. The
// shadow trajectory ships as recomputable DATA for the v0.2 stepper ghost —
// out-of-hash, never drawn ink, never exported.
//
// D42 also deleted §4a.5's stopped-shadow fail reason as a dead error name:
// with a_cmd = 0 and no drag, v is exactly constant across the shadow, so
// v_floor can only have fired before the shot — which is
// `departed_before_reaction`. The closed fail_reason set below is exactly
// §4a.5's four surviving names; the deleted token appears nowhere in src/
// (A-CF-DEAD-REASON greps for it, comments included).

import type { LinelabError, Result } from "../core/result.js";
import { ok, err } from "../core/result.js";
import type {
  Corner,
  Event,
  Hand,
  ResolvedScenario,
  Trajectory
} from "../core/types.js";
import { RIDER_PROFILES } from "../core/constants.js";
import { handSign, msToKmh, radToDeg } from "../core/units.js";
import { muUse, phiReserve } from "../core/slice.js";
import { compose } from "../road/compose.js";
import type { ComposedRoad, RoadSpec, Segment } from "../road/types.js";
import { F_DETECT, eps_f_detect } from "./constants.js";
import type { CfRefusal, CfShadowDocument } from "./counterfactual.js";
import {
  CF_DISCLOSURE_LEAN_ONLY,
  counterfactual,
  recordedStateAt
} from "./counterfactual.js";

// ---------------------------------------------------------------------------
// The declared binding (D42 §4c.1: named entry points are thin wrappers, and
// each declares its binding AT ITS DEFINITION SITE; P-COUNTERFACTUAL-NAMED and
// P-COUNTERFACTUAL-CLOSED enumerate through it).

export const CORRECTIVE_BINDING = Object.freeze({
  rider: "lean_only_reserve",
  predicate: "return_after_detect"
} as const);

/** The §4c.7 disclosure sentence corrective surfaces carry (re-exported home). */
export const CORRECTIVE_DISCLOSURE = CF_DISCLOSURE_LEAN_ONLY;

// ---------------------------------------------------------------------------
// The closed fail_reason set (§4a.5, D8). The deleted stopped-shadow error
// name does not exist — A-CF-DEAD-REASON checks both directions (token gone
// AND this enumeration exactly these four).

export const CORRECTIVE_FAIL_REASONS = [
  "departed_before_reaction",
  "shadow_off_road",
  "shadow_crash",
  "no_return_before_road_end"
] as const;
export type CorrectiveFailReason = (typeof CORRECTIVE_FAIL_REASONS)[number];

// ---------------------------------------------------------------------------
// The in-hash corrective verdict block (§4a.6; record shape owned by 05 §6.3).
// Deliberately gains NO rider field: the shadow's rider is fixed by §4a.4 for
// all time, known from the design of record, and disclosed in prose (§4c.7) —
// adding a field would move result_hash on every committed scene.

export interface CorrectiveBlock {
  readonly feasible: boolean;
  /** the bracketed outward crossing on the MAIN line */
  readonly detect: { readonly s: number; readonly f: number };
  /**
   * state at t_shot + the policy target. `null` only on the
   * `departed_before_reaction` arm, where the main trajectory ended before
   * t_shot and no shot state exists (recorded WP-08 judgment — §4a.6 spells
   * the member without conditioning it, but the state it names is undefined
   * on that arm).
   */
  readonly shot: {
    readonly s: number;
    readonly v_kmh: number;
    readonly phi_deg: number;
    readonly target_phi_deg: number;
  } | null;
  /** first return station (feasible only) */
  readonly returned: { readonly s: number; readonly f: number } | null;
  /** set iff !feasible */
  readonly fail_reason: CorrectiveFailReason | null;
}

/** The §4a.6 wide-vs-runoff decision for a ran-wide corner. */
export function wideVsRunoff(feasible: boolean): "wide" | "runoff" {
  return feasible ? "wide" : "runoff";
}

// ---------------------------------------------------------------------------
// Input: the structural subset of LineResult (05 §7) the shot reads. WP-09's
// LineResult satisfies it; declaring the subset here keeps WP-08 buildable
// before solve/types.ts exists (recorded ownership judgment).

export interface CorrectiveShotInput {
  readonly trajectory: Trajectory;
  readonly resolved_scenario: ResolvedScenario;
}

// ---------------------------------------------------------------------------
// run_wide_detect (§4a.2): the first bracketed crossing where f rises through
// F_DETECT + eps_f_detect with df/dt > 0 (outward) and a turn_in event has
// occurred. At most one per corner; attribution = the last corner whose
// s0 <= s_detect (a drift on the exit straight belongs to the corner being
// exited). Outward-only BY DESIGN: no inside detect, no inside corrective.

export interface RunWideDetect {
  readonly corner_id: string;
  readonly hand: Hand;
  readonly s: number;
  readonly t: number;
  readonly x: number;
  readonly y: number;
  readonly f: number;
  readonly v: number;
}

/**
 * Scan a recorded line for run_wide_detect crossings (bracketed on the
 * retained record — the raw series is integrator-internal and already
 * discarded, 02 §6). Returns per-corner detects in station order.
 */
export function runWideDetect(
  traj: Trajectory,
  corners: readonly Corner[]
): readonly RunWideDetect[] {
  const firstTurnInT = traj.events
    .filter((e) => e.kind === "turn_in")
    .reduce<number | null>((acc, e) => (acc === null || e.t < acc ? e.t : acc), null);
  if (firstTurnInT === null) return [];

  const thr = F_DETECT + eps_f_detect;
  const out: RunWideDetect[] = [];
  const seen = new Set<string>();
  const samples = traj.samples;
  for (let i = 0; i + 1 < samples.length; i++) {
    const a = samples[i]!;
    const b = samples[i + 1]!;
    if (!(a.f <= thr && b.f > thr)) continue; // not a rising crossing of the edge
    if (!(b.f > a.f)) continue; // outward only: df/dt > 0
    const alpha = (thr - a.f) / (b.f - a.f);
    const t = a.t + alpha * (b.t - a.t);
    if (t < firstTurnInT - 1e-12) continue; // the turn_in-must-precede guard
    const s = a.s + alpha * (b.s - a.s);
    let corner: Corner | null = null;
    for (const c of corners) {
      if (c.s0 <= s + 1e-12) corner = c; // last corner whose s0 <= s_detect
    }
    if (corner === null) continue; // pre-first-corner drift: nothing to attribute
    if (seen.has(corner.id)) continue; // at most one detect per corner
    seen.add(corner.id);
    out.push({
      corner_id: corner.id,
      hand: corner.hand,
      s,
      t,
      x: a.x + alpha * (b.x - a.x),
      y: a.y + alpha * (b.y - a.y),
      f: thr,
      v: a.v + alpha * (b.v - a.v)
    });
  }
  return out;
}

/** The main-line event drafts for a detect list (kind run_wide_detect). */
export function runWideDetectEvents(detects: readonly RunWideDetect[]): readonly Event[] {
  return detects.map((d) => ({
    kind: "run_wide_detect" as const,
    s: d.s,
    t: d.t,
    corner_id: d.corner_id,
    detail: { f: d.f }
  }));
}

// ---------------------------------------------------------------------------
// Shot start (§4a.3): t_shot = max(t_detect, t_freeze_end) + t_react_s.
// t_freeze_end exists only when the line's plan carries a rider freeze (today:
// chop's freeze_s riding the throttle action's freeze_steer_s, 03 §7.1) — a
// frozen rider cannot begin reacting. Windows whose onset lies after t_detect
// do not delay the shot (recorded WP-08 judgment; the shipped freeze mistakes
// all open their window before the drift is detectable).

function freezeEndBefore(
  scenario: ResolvedScenario,
  events: readonly Event[],
  t_detect: number
): number {
  let end = Number.NEGATIVE_INFINITY;
  for (const action of scenario.rider.plan) {
    if (action.do !== "throttle" || action.freeze_steer_s === undefined) continue;
    const onset = events.find(
      (e) => (e.kind === "crack" || e.kind === "roll_on") && e.action_id === action.id
    );
    if (onset === undefined || onset.t > t_detect) continue;
    end = Math.max(end, onset.t + action.freeze_steer_s);
  }
  return end;
}

// ---------------------------------------------------------------------------
// The wrapper

function roadSpecOf(scenario: ResolvedScenario): RoadSpec {
  const rs = scenario.road;
  if (rs.dsl.length > 0) {
    return {
      dsl: rs.dsl,
      use_full_width: rs.use_full_width,
      bike_margin_m: rs.bike_margin_m
    };
  }
  return {
    lane_width_m: rs.lane_width_m,
    bike_margin_m: rs.bike_margin_m,
    use_full_width: rs.use_full_width,
    segments: rs.segments as readonly Segment[]
  };
}

export interface CorrectiveShotResult {
  /** null ⇔ never attempted: no outward detect, or the main run crashed */
  readonly corrective: CorrectiveBlock | null;
  /** the branched shadow document (out-of-hash data for the v0.2 ghost) */
  readonly shadow: CfShadowDocument | null;
  /**
   * main-line event drafts this machinery mints (run_wide_detect per detected
   * corner + correction iff the shot launched) — WP-09's verdict assembly
   * merges them into the line's events array (05 §5: one event source)
   */
  readonly events: readonly Event[];
}

/**
 * correctiveShot(lineResult) → Result<{corrective, shadow}> (§4a.7; 08 §7.1
 * pure-API tier). Fixed policy, one deterministic shadow, never a search:
 * react (t_react_s, freeze-clamped), roll to phiReserve at the profile cap,
 * a_cmd = 0 — launched through the ONE counterfactual harness under this
 * file's declared binding. Crash strictly precedes corrective solving.
 */
export function correctiveShot(
  line: CorrectiveShotInput
): Result<CorrectiveShotResult, CfRefusal | LinelabError> {
  const traj = line.trajectory;
  const scenario = line.resolved_scenario;

  // crash strictly precedes corrective solving — no save for a lowsided line
  if (traj.terminated.reason === "crash" || traj.events.some((e) => e.kind === "crash")) {
    return ok({ corrective: null, shadow: null, events: [] });
  }

  const spec = roadSpecOf(scenario);
  const composed = compose(spec);
  if (!composed.ok) return composed;
  const road: ComposedRoad = composed.value;

  const detects = runWideDetect(traj, road.corners);
  if (detects.length === 0) {
    return ok({ corrective: null, shadow: null, events: [] });
  }
  const detect = detects[0]!; // the shot is computed for the first ran-wide corner
  const events: Event[] = [...runWideDetectEvents(detects)];

  const profile = RIDER_PROFILES[scenario.rider.profile];
  const t_freeze_end = freezeEndBefore(scenario, traj.events, detect.t);
  const t_shot = Math.max(detect.t, t_freeze_end) + profile.t_react_s;

  if (traj.terminated.t < t_shot - 1e-12) {
    // not a degenerate corner case but the NORMAL mechanism by which a short
    // corner with a hard outside edge pins runoff (§4a.3); no correction
    // event — there is no shot start on the main line to bookmark
    return ok({
      corrective: {
        feasible: false,
        detect: { s: detect.s, f: detect.f },
        shot: null,
        returned: null,
        fail_reason: "departed_before_reaction"
      },
      shadow: null,
      events
    });
  }

  const at = recordedStateAt(traj, t_shot, road);
  if (at === null) {
    return err({
      code: "INTERNAL",
      at: "correctiveShot",
      message: "shot instant inside the record could not be interpolated",
      detail: { reason: "shot_state_unresolvable", t_shot }
    } satisfies LinelabError);
  }

  const cf = counterfactual(
    spec,
    {
      resolved_scenario: scenario,
      sample: at.sample,
      dfds: at.dfds,
      turn_in_before: traj.events.some((e) => e.kind === "turn_in" && e.t <= t_shot + 1e-12),
      hand: detect.hand,
      s_detect: detect.s
    },
    0, // the reaction latency is already consumed by t_shot (§4a.3 reads the record)
    CORRECTIVE_BINDING.rider,
    CORRECTIVE_BINDING.predicate
  );
  if (!cf.ok) return cf;
  const { trajectory: shadow, verdict } = cf.value;

  let fail_reason: CorrectiveFailReason | null = null;
  if (!verdict.saved) {
    switch (shadow.terminated.reason) {
      case "off_road":
        fail_reason = "shadow_off_road";
        break;
      case "crash":
        fail_reason = "shadow_crash";
        break;
      case "road_end":
      case "max_time":
      case "max_dist":
        fail_reason = "no_return_before_road_end";
        break;
      case "stopped":
        // believed-impossible: v is exactly constant across the shadow and the
        // main line was above the floor at t_shot (P-CORR-CONSTANT-SPEED pins
        // the fact); reaching here is a physics-tier defect, not a fail_reason
        return err({
          code: "INTERNAL",
          at: "correctiveShot.shadow",
          message: "the lean-only shadow cannot slow: constant-speed law violated",
          detail: { reason: "constant_speed_violated" }
        } satisfies LinelabError);
    }
  }

  const target_phi_deg = radToDeg(
    handSign(detect.hand) * phiReserve(muUse(profile.skill, scenario.config.mu))
  );
  const corrective: CorrectiveBlock = {
    feasible: verdict.saved,
    detect: { s: detect.s, f: detect.f },
    shot: {
      s: at.sample.s,
      v_kmh: msToKmh(at.sample.v),
      phi_deg: at.sample.phi,
      target_phi_deg
    },
    returned: verdict.saved ? verdict.returned : null,
    fail_reason
  };

  // the shot-start bookmark: "the last moment a save had to begin" (§4a.3);
  // never implies the main line bends back
  events.push({
    kind: "correction",
    s: at.sample.s,
    t: t_shot,
    corner_id: detect.corner_id,
    detail: { feasible: verdict.saved }
  });

  return ok({ corrective, shadow, events });
}
