// solve/vis.ts — vis=cautious: the V1 stop-within-sight speed governor + the
// V2 hold-wide position generation, bounded iteration verified SOLELY by the
// terminal self-check (design/04 §6, D4/D10/D22; ARCHITECTURE §5, WP-11).
//
// Mode contract (04 §6, D22 — no convergence is claimed):
//   solve → read the emergent sight channel → regenerate V1 speed caps and V2
//   holds → re-solve, bounded by vis_max_iterations; acceptance is decided
//   ONLY by the terminal self-check (V1 at every station, V2's hold ahead of
//   each blind corner under the actual-position rule, all authored
//   constraints) evaluated on the candidate's own full engine re-run. Typed
//   refusals: vis_unsatisfiable_within_bound (with per-iterate diagnostics)
//   and vis_speed_below_model_floor.
//
// V1 reads THE one ssd (sight/ssd.ts) against the recorded rider-path
// `sight_ride_m` (D16, drift risk #10) with the sample's own lean. The
// governor CAPS THE ENTRY SPEED (04 §6: "caps entry speed (upright, phi=0)"):
// the returned line's resolved start speed is the governed entry, and the cap
// only ever RATCHETS DOWN across iterations — once a violating iterate forces
// a cap, no later iterate re-raises it (A-SSD-GOVERNOR's strict governed <
// ungoverned comparison is exactly this ratchet's observable).
//
// Recorded WP-11 judgments (see the return report):
//  - ADJUDICATED 2026-07-23 — V2.5 turn-in placement pin CONFIRMED (seam
//    adjudication; engine-measured on bookBlind, margin 2.0, governed
//    8.75 m/s): the release station (first `trend = opening ∧ sight_ride ≥
//    vis_margin·ssd`, actual per-sample f) lands at s = 25.0, 9.0 m past
//    corner entry (s0 = 16.0) — the approach straight reads `closing` from
//    s = 4 on, so release can NEVER fire before the corner. An uncommitted
//    (track/position-held) line exits the road at s = 19.79 = s0 + 3.8 m:
//    tracker curvature ceiling G·tan(5°)/v² = 0.0112 m⁻¹ (R ≥ 89 m) against
//    the wide line's 0.0763 m⁻¹ (R ≈ 13.1 m) eats the ~0.46 m of outboard
//    room in √(2·0.46/0.0651) ≈ 3.8 m. Every turn-in at s ≥ s0 terminates
//    off_road at 19.8–20.4 (leans 24–44° swept); the latest survivable
//    turn-in is s ≈ 15 < s0. The crawl escape (tracker negotiates R13.1 only
//    at v ≤ 3.35 m/s = 12.1 km/h) sits below the model validity floor
//    v_valid_min_ms = 7.0 m/s and is the "fabricated crawl" 04 §6 forbids.
//    So the letter ("turn-in placed at or after release") is jointly
//    unsatisfiable with the binding D20 tracker authority and D19 road-edge
//    termination; the compliant maximum is implemented: the blind corner is
//    NEGOTIATED UNDER A WIDE COMMITMENT whose lean holds the vis_hold_f arc,
//    the hold band is self-checked from window end to release, and roll_on
//    stays gated on release (the letter's implementable clause, literal).
//  - V1's universal quantifier carries the same open-end carve-out as check 10
//    (plan/doctrine/metrics.ts sightDeficit): a cast that ran unblocked to the
//    road end has no sight limit; the D16 line-end clamp would otherwise fail
//    V1 on the final ssd-shadow of EVERY finite road.
//  - the mode's acceptance additionally requires the run to terminate
//    road_end (a crashed or off-road iterate is never a passing line).

import type { Result } from "../core/result.js";
import { err, ok } from "../core/result.js";
import type {
  Corner,
  Event,
  ResolvedPlanAction,
  RiderProfile,
  Sample,
  Trajectory
} from "../core/types.js";
import {
  G,
  K_REACH,
  MIN_POS_DD_M,
  RIDER_PROFILES,
  a_lat_pos_max,
  v_floor_ms
} from "../core/constants.js";
import { degToRad, kmhToMs, msToKmh } from "../core/units.js";
import { integrate } from "../core/integrate.js";
import { analyzeCorners } from "../core/analyze.js";
import { sortEvents } from "../core/events.js";
import { buildTrajectory } from "../core/record.js";
import { ssd } from "../sight/ssd.js";
import { analyzeSight, sightTrendAt } from "../sight/analyze.js";
import type { SsdModel } from "../core/types.js";
import {
  COARSE_DS_M,
  VIS_HOLD_F_DEFAULT,
  VIS_MARGIN_DEFAULT,
  VIS_MAX_ITERATIONS
} from "./constants.js";
import {
  constraintUnmet,
  constraintsSatisfied,
  evalConstraints,
  noSolution,
  solve,
  type SolveCtx,
  type SolveInput
} from "./solve.js";
import {
  buildChainContext,
  chainedSolve,
  executeSolvedPlan,
  patchAndReseal,
  wirePlanFromResolved,
  type ChainCtx
} from "./chained.js";
import type { LineResult, SightHold } from "./types.js";

// ---------------------------------------------------------------------------
// Local tolerances (WP-11 may not append to solve/constants.ts — recorded
// deviation from the one-constants-file discipline; values are 09 §3.5's)

/** 0.05 f-units — TUNING (09 §3.5 f_tol): the hold band tolerance. */
const VIS_HOLD_F_TOL = 0.05;

/** 1.0 m — the check-10 open-end carve-out's station tolerance (mirrored). */
const OPEN_END_EPS_M = 1.0;

/** cap-update safety factor (keeps the governed iterate strictly inside the cap). */
const VIS_CAP_SAFETY = 0.995;

// ---------------------------------------------------------------------------
// blind(c) — design/01 §A.2: at c's turn_in event, s_limit < s_end(c)
// (rider-eye, per-line, single-turn-in basis). s_limit rides the recorded
// per-sample cast as sample.s + sight_m.

export function blindOn(samples: readonly Sample[], events: readonly Event[], corner: Corner): boolean {
  const ti = events.find((e) => e.kind === "turn_in" && e.corner_id === corner.id);
  const atS = ti !== undefined ? ti.s : corner.s0;
  let best: Sample | null = null;
  for (const sm of samples) {
    if (best === null || Math.abs(sm.s - atS) < Math.abs(best.s - atS)) best = sm;
  }
  if (best === null) return false;
  return best.s + best.sight_m < corner.s1 - 1e-6;
}

// ---------------------------------------------------------------------------
// Coarse candidate runs at a governed entry speed (measureRun with the start
// speed overridden — the mode's one departure from the base spec)

interface VisRun {
  readonly traj: Trajectory;
  readonly entry_kmh: number;
}

function visMeasure(ctx: SolveCtx, plan: readonly ResolvedPlanAction[], entryKmh: number, coarse: boolean): VisRun {
  const scenario = {
    ...ctx.base,
    rider: {
      ...ctx.base.rider,
      start: { ...ctx.base.rider.start, speed_kmh: entryKmh },
      plan
    }
  };
  const traj0 = integrate(scenario, ctx.world, coarse ? { ds_m: COARSE_DS_M } : {});
  const traj1 = analyzeSight(traj0, ctx.road, scenario.occluders);
  const analysis = analyzeCorners(traj1, ctx.road, ctx.skill);
  return {
    traj: buildTrajectory([...traj1.samples], sortEvents([...traj1.events, ...analysis.events]), traj1.terminated),
    entry_kmh: entryKmh
  };
}

// ---------------------------------------------------------------------------
// V1 — the governor's arithmetic over a finished run

interface SsdEnv {
  readonly model: SsdModel;
  readonly profile: RiderProfile;
  readonly mu: number;
}

function ssdAt(env: SsdEnv, v_ms: number, phi_deg: number): number {
  return ssd(v_ms, degToRad(Math.abs(phi_deg)), env.model, env.profile, env.mu).ssd_m;
}

/**
 * Line-end carve-out: the cast ran unblocked to the end of the RECORD (no
 * occluder limit). Check 10 applies it only to road_end terminations; the
 * GOVERNOR applies it to every termination — an early-terminated iterate's
 * clamped sight_ride is a line-end artifact, and letting it crash the entry
 * cap would turn every uncontained iterate into a spurious floor refusal
 * (recorded WP-11 judgment).
 */
function openEnded(sm: Sample, traj: Trajectory): boolean {
  return sm.s + sm.sight_m >= traj.terminated.s - OPEN_END_EPS_M;
}

interface V1Report {
  /** min over governed samples of sight_ride_m − vis_margin·ssd_m */
  readonly min_margin_m: number;
  readonly worst_s: number;
  /** largest entry-speed scale u ≤ 1 under which every station satisfies V1 */
  readonly cap_ratio: number;
  readonly satisfied: boolean;
}

function evalV1(traj: Trajectory, margin: number, env: SsdEnv): V1Report {
  let minMargin = Number.POSITIVE_INFINITY;
  let worstS = 0;
  let capRatio = 1;
  for (const sm of traj.samples) {
    if (openEnded(sm, traj)) continue;
    const have = sm.sight_ride_m;
    const need = margin * ssdAt(env, sm.v, sm.phi);
    const m = have - need;
    if (m < minMargin) {
      minMargin = m;
      worstS = sm.s;
    }
    if (need > have + 1e-9) {
      // find the largest speed scale u with margin·ssd(u·v, φ(u)) ≤ have,
      // lean scaling with u² on the sample's own radius (φ = atan(tan φ·u²))
      const phiRad = degToRad(Math.abs(sm.phi));
      const okAt = (u: number): boolean =>
        margin * ssd(u * sm.v, Math.atan(Math.tan(phiRad) * u * u), env.model, env.profile, env.mu).ssd_m <= have + 1e-9;
      let lo = 0.02;
      let hi = 1;
      if (!okAt(lo)) lo = 0.001;
      for (let i = 0; i < 24; i++) {
        const mid = (lo + hi) / 2;
        if (okAt(mid)) lo = mid;
        else hi = mid;
      }
      if (lo < capRatio) capRatio = lo;
    }
  }
  if (!Number.isFinite(minMargin)) {
    minMargin = 0;
    worstS = traj.terminated.s;
  }
  return { min_margin_m: minMargin, worst_s: worstS, cap_ratio: capRatio, satisfied: capRatio >= 1 };
}

// ---------------------------------------------------------------------------
// V2 — hold generation + release evaluation

interface HoldGen {
  readonly corner: Corner;
  /** null ⇔ clipped displacement below MIN_POS_DD_M — no wire action emitted */
  readonly action: ResolvedPlanAction | null;
  /** the effective hold bar: vis_hold_f, or the clipped target */
  readonly target_eff: number;
  readonly budget_limited: boolean;
  readonly window: readonly [number, number];
}

/** t_roll of the reachability formula (03 §6.1 — the validator's own value). */
function tRoll(profile: RiderProfile): number {
  return Math.atan(a_lat_pos_max / G) / degToRad(profile.roll_rate_dps);
}

function generateHold(
  ctx: SolveCtx,
  corner: Corner,
  windowStart: number,
  turnInS: number,
  fFrom: number,
  holdF: number,
  vGovMs: number,
  profile: RiderProfile
): HoldGen {
  const w0 = windowStart;
  const w1 = Math.max(w0 + 0.5, turnInS);
  const sMid = (w0 + w1) / 2;
  const dTgt = ctx.road.dOf(holdF, sMid);
  const dFrom = ctx.road.dOf(fFrom, sMid);
  const deltaD = Math.abs(dTgt - dFrom);
  const wCorr = Math.abs(ctx.road.dOf(1, sMid) - ctx.road.dOf(0, sMid));
  const T = (w1 - w0) / Math.max(vGovMs, 0.1);
  const half = Math.max(0, T / 2 - tRoll(profile));
  // 0.995: strict-interior safety on the validator's own reachability formula
  // (an exactly-at-the-bound clip fails validate by one ULP)
  const ddMax = ((a_lat_pos_max * half * half) / K_REACH) * 0.995;

  if (deltaD <= ddMax + 1e-12) {
    return {
      corner,
      action: { do: "position", id: `hold_${corner.id}`, at_s: w0, f: holdF, over_m: w1 - w0 },
      target_eff: holdF,
      budget_limited: false,
      window: [w0, w1]
    };
  }
  if (ddMax < MIN_POS_DD_M) {
    // emit no action at all — the line holds whatever f the exit left it at
    return { corner, action: null, target_eff: fFrom, budget_limited: true, window: [w0, w1] };
  }
  const dir = holdF >= fFrom ? 1 : -1;
  const fClip = fFrom + (dir * ddMax) / wCorr;
  return {
    corner,
    action: { do: "position", id: `hold_${corner.id}`, at_s: w0, f: fClip, over_m: w1 - w0 },
    target_eff: fClip,
    budget_limited: true,
    window: [w0, w1]
  };
}

/**
 * The release station (04 §6 V2.5) evaluated on a finished run: the first
 * station at/after `from_s` where sight_trend = opening AND
 * sight_ride_m ≥ vis_margin·ssd_m — from the ACTUAL per-sample state, never an
 * unreached target. Open-end casts satisfy the sight clause (carve-out).
 */
function releaseStation(
  traj: Trajectory,
  from_s: number,
  margin: number,
  env: SsdEnv
): number | null {
  const samples = traj.samples;
  for (let i = 0; i < samples.length; i++) {
    const sm = samples[i]!;
    if (sm.s < from_s) continue;
    const sightOk = openEnded(sm, traj) || sm.sight_ride_m >= margin * ssdAt(env, sm.v, sm.phi) - 1e-9;
    if (sightOk && sightTrendAt(samples, i) === "opening") return sm.s;
  }
  return null;
}

// ---------------------------------------------------------------------------
// The cautious candidate plan (fixed shape, engine-verified)

interface Candidate {
  readonly plan: readonly ResolvedPlanAction[];
  readonly holds: readonly HoldGen[];
}

const LEAN_FIX_PROBES = 6;
const LEAN_FIX_STEP_DEG = 2.0;

function buildCandidate(
  chain: ChainCtx,
  blind: readonly boolean[],
  vGovKmh: number,
  holdF: number,
  profile: RiderProfile
): Candidate {
  const ctx0 = chain.ctxs[0]!;
  const vGovMs = kmhToMs(vGovKmh);
  const rollRateRad = degToRad(profile.roll_rate_dps);
  const startF = ctx0.start_f;

  let plan: ResolvedPlanAction[] = [];
  const holds: HoldGen[] = [];
  let prevCornerEnd = 0;
  let prevTargetF = startF;

  for (let k = 0; k < chain.ctxs.length; k++) {
    const ctx = chain.ctxs[k]!;
    const corner = ctx.corner;

    // roll-in anticipation from the authored hold-arc lean (the turn-in leads
    // the corner by a quarter of the roll distance)
    const sMid = corner.s_mid;
    const kap = ctx.road.kappa_road(sMid);
    const preLean =
      (180 / Math.PI) *
      Math.atan((vGovMs * vGovMs * Math.abs(kap / (1 + ctx.road.dOf(holdF, sMid) * kap))) / G);
    const tRollIn = degToRad(Math.max(preLean, 5)) / rollRateRad;
    const sTi = Math.max(prevCornerEnd + 1, corner.s0 - 0.5 * vGovMs * tRollIn);

    // V2 hold ahead of a blind corner (04 §6 V2.1–V2.4) — generated FIRST so
    // the wide commitment's lean reads the ACTUAL hold target (the clipped
    // value under the lateral budget — the actual-position rule)
    let holdTargetF = holdF;
    if (blind[k] === true) {
      const gen = generateHold(ctx, corner, Math.max(prevCornerEnd + (k > 0 ? 0.2 : 0), 0), sTi, prevTargetF, holdF, vGovMs, profile);
      holds.push(gen);
      if (gen.action !== null) plan.push(gen.action);
      prevTargetF = gen.target_eff;
      holdTargetF = gen.target_eff;
    }

    // the wide commitment's lean: the actual hold arc at governed speed, then
    // a bounded, containment-biased engine fix-up
    const dHold = ctx.road.dOf(Math.min(holdTargetF, 1), sMid);
    const kLine = Math.abs(kap / (1 + dHold * kap));
    let lean = (180 / Math.PI) * Math.atan((vGovMs * vGovMs * kLine) / G);
    const holdBar = holdTargetF - VIS_HOLD_F_TOL;
    for (let p = 0; p < LEAN_FIX_PROBES; p++) {
      const tiProbe: ResolvedPlanAction = {
        do: "turn_in",
        id: `ti_${corner.id}`,
        at_s: sTi,
        target: { lean_deg: lean },
        hand: corner.hand
      };
      const probePlan: ResolvedPlanAction[] = [...plan, tiProbe].sort((a, b) => a.at_s - b.at_s);
      const m = visMeasure(ctx0, probePlan, vGovKmh, true);
      let maxF = Number.NEGATIVE_INFINITY;
      let minF = Number.POSITIVE_INFINITY;
      for (const sm of m.traj.samples) {
        if (sm.s < corner.s0 - 1e-9 || sm.s > corner.s1 + 1e-9) continue;
        if (sm.f > maxF) maxF = sm.f;
        if (sm.f < minF) minF = sm.f;
      }
      const alive = m.traj.terminated.reason === "road_end" || m.traj.terminated.s > corner.s1;
      if (!alive || maxF > 1) {
        lean += LEAN_FIX_STEP_DEG; // drifting out — tighten (containment first)
        continue;
      }
      if (minF < holdBar - 0.05 && maxF < 0.98) {
        lean = Math.max(2, lean - LEAN_FIX_STEP_DEG / 2); // dug inside — ease gently
        continue;
      }
      break;
    }

    const ti: ResolvedPlanAction = {
      do: "turn_in",
      id: `ti_${corner.id}`,
      at_s: sTi,
      target: { lean_deg: lean },
      hand: corner.hand
    };
    plan = [...plan, ti].sort((a, b) => a.at_s - b.at_s);
    prevCornerEnd = corner.s1;
  }

  return { plan, holds };
}

// ---------------------------------------------------------------------------
// solveCautious (ARCHITECTURE §5 — solve/vis.ts's entry point)

export interface CautiousDetail {
  readonly line: LineResult;
  /** candidate solve passes performed (≤ vis_max_iterations — P-VIS-BOUNDED) */
  readonly iterations: number;
  readonly governed_entry_kmh: number;
}

interface IterateRow {
  readonly min_margin_m: number;
  readonly worst_s: number;
  readonly hold_met: boolean;
}

/**
 * The vis=cautious mode (design/04 §6). Returns the first iterate whose
 * terminal self-check passes, or one of the two typed refusals. The governed
 * entry speed rides the returned line's resolved start
 * (`resolved_scenario.rider.start.speed_kmh`).
 */
export function solveCautiousDetailed(spec: SolveInput): Result<CautiousDetail> {
  if (spec.vis !== "cautious") {
    return err({
      code: "SCHEMA",
      at: "vis",
      message: 'solveCautious requires vis: "cautious"',
      detail: { reason: "vis_mode_required" }
    });
  }
  const holdF = spec.vis_hold_f ?? VIS_HOLD_F_DEFAULT;
  const margin = spec.vis_margin ?? VIS_MARGIN_DEFAULT;
  if (!(holdF > 0 && holdF <= 1)) {
    return err({
      code: "BAD_RANGE",
      at: "vis_hold_f",
      message: `vis_hold_f must lie in (0, 1], got ${String(spec.vis_hold_f)}`,
      detail: { reason: "vis_hold_f_out_of_range" }
    });
  }
  if (!(margin > 0)) {
    return err({
      code: "BAD_RANGE",
      at: "vis_margin",
      message: `vis_margin must be > 0, got ${String(spec.vis_margin)}`,
      detail: { reason: "vis_margin_out_of_range" }
    });
  }

  const { vis: _v, vis_hold_f: _vh, vis_margin: _vm, ...baseSpec } = spec;
  const chainR = buildChainContext(baseSpec);
  if (!chainR.ok) return chainR;
  const chain = chainR.value;
  const ctx0 = chain.ctxs[0]!;
  const baseProfile = RIDER_PROFILES[ctx0.base.rider.profile];
  const cap = ctx0.base.rider.roll_rate_cap_dps;
  const profile: RiderProfile =
    cap !== undefined && cap < baseProfile.roll_rate_dps ? { ...baseProfile, roll_rate_dps: cap } : baseProfile;
  const env: SsdEnv = { model: ctx0.base.config.ssd_model, profile, mu: ctx0.base.config.mu };

  // iterate 0 generator: the ordinary (sight-indifferent) solve — its emergent
  // sight channel seeds the first regeneration; a typed base refusal falls
  // back to a wide probe run (the mode can still read a sight channel)
  const multi = chain.ctxs.length > 1;
  const baseR = multi ? chainedSolve(baseSpec) : solve(baseSpec);
  let prevTraj: Trajectory;
  if (baseR.ok) {
    prevTraj = baseR.value.trajectory;
    // The ordinary solve IS the first iterate's generator: when the road has
    // no blind corner on its line, V2 generates nothing and the mode's
    // acceptance reduces to V1 + containment — a passing base line is returned
    // as the first (and only) iterate.
    const baseBlind = chain.ctxs.some((c) => blindOn(prevTraj.samples, prevTraj.events, c.corner));
    if (!baseBlind) {
      const v1Base = evalV1(prevTraj, margin, env);
      if (
        v1Base.satisfied &&
        prevTraj.terminated.reason === "road_end" &&
        baseR.value.verdict.outcome === "contained" &&
        constraintsSatisfied(baseR.value.verdict.constraints)
      ) {
        return ok({ line: baseR.value, iterations: 1, governed_entry_kmh: spec.entry_kmh });
      }
    }
  } else if (baseR.error.code === "NO_SOLUTION") {
    const probe = buildCandidate(chain, chain.ctxs.map(() => true), spec.entry_kmh, holdF, profile);
    prevTraj = visMeasure(ctx0, probe.plan, spec.entry_kmh, true).traj;
  } else {
    return baseR;
  }

  let vGov = spec.entry_kmh;
  const rows: IterateRow[] = [];

  for (let iter = 1; iter <= VIS_MAX_ITERATIONS; iter++) {
    // V1 regeneration from the previous run: ratchet the entry cap down
    const v1 = evalV1(prevTraj, margin, env);
    if (!v1.satisfied) {
      vGov = Math.min(vGov, vGov * v1.cap_ratio * VIS_CAP_SAFETY);
    }
    if (kmhToMs(vGov) < v_floor_ms) {
      return err(
        noSolution(
          "vis_speed_below_model_floor",
          "solveCautious",
          "the V1 governor caps speed below the model floor — the corner cannot be ridden within sight at this margin",
          { governed_kmh: vGov, floor_kmh: msToKmh(v_floor_ms), worst_s: v1.worst_s, vis_margin: margin }
        )
      );
    }

    // V2 regeneration: blind corners on the previous line
    const blind = chain.ctxs.map((c) => blindOn(prevTraj.samples, prevTraj.events, c.corner));
    const candidate = buildCandidate(chain, blind, vGov, holdF, profile);

    // roll-on gated on release (04 §6 V1: no roll-on while the limit point is
    // closing): read the candidate's own coarse run for the release stations
    const preRun = visMeasure(ctx0, candidate.plan, vGov, true);
    const lastCorner = chain.ctxs[chain.ctxs.length - 1]!.corner;
    const lastRelease = releaseStation(preRun.traj, lastCorner.s0, margin, env);
    let plan = candidate.plan;
    if (lastRelease !== null) {
      const roS = Math.max(lastRelease, lastCorner.s1) + 0.5;
      if (roS < chain.road.total_len_m - 1.5) {
        const ro: ResolvedPlanAction = { do: "throttle", id: "ro_vis", at_s: roS, accel: 2.2, slew_mss: 12 };
        plan = [...plan, ro].sort((a, b) => a.at_s - b.at_s);
      }
    }

    // the candidate solve pass: full engine re-run through the ONE pipeline
    const lineR = executeSolvedPlan({
      spec,
      wireRoad: chain.wireRoad,
      plan: wirePlanFromResolved(plan),
      policy: chain.policy,
      source: { kind: "solve", solveSpec: spec },
      constraints: ctx0.constraints,
      brake_gap_m: ctx0.stations.brake_gap_m,
      declared_style: "single",
      entry_kmh: vGov,
      label: `cautious ${spec.entry_kmh} km/h (governed ${vGov.toFixed(1)})`
    });
    if (!lineR.ok) return lineR;
    const line = lineR.value;
    const traj = line.trajectory;

    // ---- the terminal self-check (the mode's ONLY acceptance authority) ----
    const v1Final = evalV1(traj, margin, env);
    let holdMet = true;
    const holdRows: SightHold[] = [];
    for (const gen of candidate.holds) {
      if (gen.action === null) continue; // no wire action → no hold clause
      const release = releaseStation(traj, gen.corner.s0, margin, env);
      if (release === null) {
        holdMet = false;
        continue;
      }
      let achieved = Number.NaN;
      let bandOk = true;
      for (const sm of traj.samples) {
        if (sm.s < gen.window[1] - 1e-9 || sm.s > release + 1e-9) continue;
        if (sm.f < gen.target_eff - VIS_HOLD_F_TOL - 1e-9) bandOk = false;
      }
      const relSample = traj.samples.reduce<Sample | null>(
        (best, sm) => (best === null || Math.abs(sm.s - release) < Math.abs(best.s - release) ? sm : best),
        null
      );
      achieved = relSample !== null ? relSample.f : Number.NaN;
      if (!bandOk) holdMet = false;
      holdRows.push({
        corner_id: gen.corner.id,
        target_f: holdF,
        achieved_f: achieved,
        budget_limited: gen.budget_limited,
        hold_release_s: release
      });
    }
    const survived = traj.terminated.reason === "road_end" && line.verdict.outcome === "contained";
    const constraintsOk = constraintsSatisfied(line.verdict.constraints);

    if (v1Final.satisfied && holdMet && survived && constraintsOk) {
      const patched = patchHolds(line, holdRows);
      if (!patched.ok) return patched;
      return ok({ line: patched.value, iterations: iter, governed_entry_kmh: vGov });
    }

    rows.push({ min_margin_m: v1Final.min_margin_m, worst_s: v1Final.worst_s, hold_met: holdMet });
    if (!constraintsOk && line.verdict.constraints !== null && iter === VIS_MAX_ITERATIONS) {
      return err(constraintUnmet(line.verdict.constraints, "solveCautious"));
    }
    // containment fallback ratchet: an uncontained iterate whose casts are all
    // line-end-clamped gives V1 no signal — slowing is the mode's one answer
    // (the same law as the chain's ascending scan)
    if (!survived && v1Final.satisfied) {
      vGov = vGov * 0.93;
    }
    prevTraj = traj; // regenerate from the actual run
  }

  return err(
    noSolution(
      "vis_unsatisfiable_within_bound",
      "solveCautious",
      `no iterate passed the self-check within ${VIS_MAX_ITERATIONS} solve passes`,
      {
        iterations: rows.map((r) => ({
          min_margin_m: Number(r.min_margin_m.toFixed(2)),
          worst_s: Number(r.worst_s.toFixed(2)),
          hold_met: r.hold_met
        })),
        vis_margin: margin
      }
    )
  );
}

function patchHolds(line: LineResult, holds: readonly SightHold[]): Result<LineResult> {
  return patchAndReseal(line, holds, undefined);
}

/** solveCautious(spec) → Result<LineResult> — the mode's plain entry point. */
export function solveCautious(spec: SolveInput): Result<LineResult> {
  const r = solveCautiousDetailed(spec);
  return r.ok ? ok(r.value.line) : r;
}

// re-export for the property tests (evalConstraints is solve.ts's — one law)
export { evalConstraints };
