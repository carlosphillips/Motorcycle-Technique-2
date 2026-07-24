// core/stateAt.ts — the per-instant query (design/05 §3–§4; ARCHITECTURE §10.2:
// stateAt, the phase machine and the interpolation contract live HERE, v0.2).
//
// `stateAt(line, {s | t}) → Result<InstantState>`: resolve the query against the
// monotone sample array by binary search, then interpolate per 05 §3.2:
//   - linear  : standard lerp (s, t, x, y, v, kappa, a_long, a_lat, grip, d,
//               cmd_a, n_long, n_lat, sight_m, ssd_m, limit_x, limit_y,
//               sight_ride_m, su_sustained, su_transient, a_cmd_rate)
//   - angle   : shortest-arc lerp in DEGREES (psi, phi, cmd_lean) — wrap-aware,
//               a 359°→1° step blends through 0°, never through 180°
//   - hold    : value of sample i0 (action_id, clipped, mu, roll_rate,
//               steer_state, lat_action_id, below_validity — step functions;
//               below_validity's per-bracket OR happened at RESAMPLING, 05 §3.2)
//   - f       : RECOMPUTED from the corridor algebra (road.fOf) at the
//               interpolated (d, s) — never lerped independently (ARCHITECTURE
//               drift risk #9). An exact sample hit returns the record verbatim.
//
// Queries outside [first, terminated] are err(BAD_RANGE) with `at` set to the
// valid interval — the function never clamps silently; clamping is a caller
// (viewer) policy. State after an early termination does not exist (05 §4).
//
// DEPENDENCY INVERSION (ARCHITECTURE §2 — core imports nothing): the composed
// RoadModel (`FigureResult.road`) and the 05 §4 sight-trend rule
// (sight/analyze.ts `sightTrendAt`, sited in sight/ as the sole producer of the
// `sight_m` channel it reads) are passed IN as values on `StateAtInput`, the
// same way the engine consumes RoadModel/SightCaster. WP-23's `state` verb and
// the viewer HUD build this input from one (FigureResult, LineResult) pair plus
// `sightTrendAt` — `plan` is `resolved_scenario.rider.plan`, which
// `derived.action` addresses against (05 §7).
//
// The D45-gated `derived.commitment_probe` member is ABSENT (phase law:
// absent, not stubbed). Pure, synchronous, zero engine runs.

import type {
  InstantState,
  ResolvedPlanAction,
  RoadModel,
  Sample,
  SightTrend,
  Trajectory
} from "./types.js";
import type { Result } from "./result.js";
import { ok, err } from "./result.js";
import { phaseOpeners, phaseAt } from "./analyze.js";
import { aNoReturn, aWiden, phiMax, PHI_VALID_MIN_DEG } from "./slice.js";
import { degToRad, radToDeg, msToKmh } from "./units.js";

// ---------------------------------------------------------------------------
// Input & query shapes

/** The 05 §4 sight-trend rule (implemented by sight/analyze.ts `sightTrendAt`). */
export type SightTrendRule = (samples: readonly Sample[], index: number) => SightTrend;

/**
 * The core-consumable slice of one line of an envelope (see the file banner):
 * the line's own `trajectory` and resolved `plan`, plus the figure's ONE
 * composed road and the sight-trend rule as injected values.
 */
export interface StateAtInput {
  /** the line's recorded trajectory (05 §2–§5) */
  readonly trajectory: Trajectory;
  /** the figure's ONE composed road (`FigureResult.road`) — corridor algebra + corner records */
  readonly road: RoadModel;
  /** `resolved_scenario.rider.plan` — `derived.action` addresses against it (05 §7) */
  readonly plan: readonly ResolvedPlanAction[];
  /** the 05 §4 windowed+deadbanded trend rule over the recorded `sight_m` channel */
  readonly sightTrendAt: SightTrendRule;
}

/** Exactly one of `s` or `t` (both or neither → err(SCHEMA), 05 §4). */
export type StateAtQuery = { readonly s: number } | { readonly t: number };

// ---------------------------------------------------------------------------
// Interpolation helpers (05 §3.2)

/** HUD `a_widen_ms2` uses c = 1, the fighting rider (ARCHITECTURE §10.12, pinned). */
const C_FIGHTING = 1;

function lerp(a: number, b: number, alpha: number): number {
  return a + (b - a) * alpha;
}

/** Shortest-arc delta in degrees, wrapped to [−180, 180). */
function wrapDeg(x: number): number {
  return ((((x + 180) % 360) + 360) % 360) - 180;
}

/** Shortest-arc lerp in degrees (05 §3.2 `angle` rule — wrap-aware). */
function lerpAngleDeg(a: number, b: number, alpha: number): number {
  return a + wrapDeg(b - a) * alpha;
}

/** Verbatim copy of one recorded sample (endpoint exactness — the pinned 32 fields). */
function copySample(p: Sample): Sample {
  return {
    s: p.s,
    t: p.t,
    x: p.x,
    y: p.y,
    psi: p.psi,
    v: p.v,
    phi: p.phi,
    kappa: p.kappa,
    a_long: p.a_long,
    a_lat: p.a_lat,
    grip: p.grip,
    mu: p.mu,
    d: p.d,
    f: p.f,
    cmd_lean: p.cmd_lean,
    cmd_a: p.cmd_a,
    roll_rate: p.roll_rate,
    action_id: p.action_id,
    clipped: p.clipped,
    n_long: p.n_long,
    n_lat: p.n_lat,
    sight_m: p.sight_m,
    ssd_m: p.ssd_m,
    limit_x: p.limit_x,
    limit_y: p.limit_y,
    sight_ride_m: p.sight_ride_m,
    steer_state: p.steer_state,
    lat_action_id: p.lat_action_id,
    su_sustained: p.su_sustained,
    su_transient: p.su_transient,
    a_cmd_rate: p.a_cmd_rate,
    below_validity: p.below_validity
  };
}

/**
 * One interpolated sample between bracket [a, b] at blend `alpha` (05 §3.2).
 * The queried coordinate passes through exactly (no lerp round-trip noise);
 * its dual is lerped. `f` is recomputed from the corridor algebra (drift #9).
 */
function interpolateSample(
  a: Sample,
  b: Sample,
  alpha: number,
  key: "s" | "t",
  q: number,
  road: RoadModel
): Sample {
  const s = key === "s" ? q : lerp(a.s, b.s, alpha);
  const t = key === "t" ? q : lerp(a.t, b.t, alpha);
  const d = lerp(a.d, b.d, alpha);
  return {
    s,
    t,
    x: lerp(a.x, b.x, alpha),
    y: lerp(a.y, b.y, alpha),
    psi: lerpAngleDeg(a.psi, b.psi, alpha),
    v: lerp(a.v, b.v, alpha),
    phi: lerpAngleDeg(a.phi, b.phi, alpha),
    kappa: lerp(a.kappa, b.kappa, alpha),
    a_long: lerp(a.a_long, b.a_long, alpha),
    a_lat: lerp(a.a_lat, b.a_lat, alpha),
    grip: lerp(a.grip, b.grip, alpha),
    mu: a.mu,
    d,
    f: road.fOf(d, s),
    cmd_lean: lerpAngleDeg(a.cmd_lean, b.cmd_lean, alpha),
    cmd_a: lerp(a.cmd_a, b.cmd_a, alpha),
    roll_rate: a.roll_rate,
    action_id: a.action_id,
    clipped: a.clipped,
    n_long: lerp(a.n_long, b.n_long, alpha),
    n_lat: lerp(a.n_lat, b.n_lat, alpha),
    sight_m: lerp(a.sight_m, b.sight_m, alpha),
    ssd_m: lerp(a.ssd_m, b.ssd_m, alpha),
    limit_x: lerp(a.limit_x, b.limit_x, alpha),
    limit_y: lerp(a.limit_y, b.limit_y, alpha),
    sight_ride_m: lerp(a.sight_ride_m, b.sight_ride_m, alpha),
    steer_state: a.steer_state,
    lat_action_id: a.lat_action_id,
    su_sustained: lerp(a.su_sustained, b.su_sustained, alpha),
    su_transient: lerp(a.su_transient, b.su_transient, alpha),
    a_cmd_rate: lerp(a.a_cmd_rate, b.a_cmd_rate, alpha),
    below_validity: a.below_validity
  };
}

// ---------------------------------------------------------------------------
// Derived-block helpers (05 §4)

/**
 * `ssd_station_m` — the centreline station the rider's path reaches after
 * `ssd_m` of PATH length from the query point (the inverse of the
 * `sight_ride_m` lookahead, 05 §4), clamped at line end — conservative.
 * `startIdx` is the first record index strictly past the query point.
 */
function ssdStationM(samples: readonly Sample[], startIdx: number, from: Sample): number {
  let remaining = from.ssd_m;
  let px = from.x;
  let py = from.y;
  let ps = from.s;
  for (let k = startIdx; k < samples.length; k++) {
    const n = samples[k]!;
    const seg = Math.hypot(n.x - px, n.y - py);
    if (seg > 0 && remaining <= seg) return ps + (n.s - ps) * (remaining / seg);
    remaining -= seg;
    px = n.x;
    py = n.y;
    ps = n.s;
  }
  return samples[samples.length - 1]!.s;
}

/**
 * Corner containing `s`, or null (05 §4). At a shared boundary (adjacent
 * corners, s1 = next s0) the LATER corner governs — the same handoff-station
 * convention the corridor algebra pins (05 §2.1).
 */
function cornerIdAt(road: RoadModel, s: number): string | null {
  let id: string | null = null;
  for (const c of road.corners) {
    if (s >= c.s0 && s <= c.s1) id = c.id;
  }
  return id;
}

function deriveAt(input: StateAtInput, sample: Sample, i0: number, i1: number, alpha: number): InstantState["derived"] {
  const samples = input.trajectory.samples;
  // upright immunity band (02 §5.3/§7): both crossovers are null below 2° lean
  const upright = Math.abs(sample.phi) < PHI_VALID_MIN_DEG;
  const phiRad = degToRad(sample.phi);
  const rollRad = degToRad(sample.roll_rate);
  const startIdx = i0 === i1 ? i0 + 1 : i1;
  const action =
    sample.action_id === null ? null : (input.plan.find((a) => a.id === sample.action_id) ?? null);
  return Object.freeze({
    v_kmh: msToKmh(sample.v),
    sight_margin_m: sample.sight_ride_m - sample.ssd_m,
    sight_trend: input.sightTrendAt(samples, i0),
    ssd_station_m: ssdStationM(samples, startIdx, sample),
    phi_max_deg: radToDeg(phiMax(sample.mu)),
    stand_up_dps: sample.su_sustained + sample.su_transient,
    a_noreturn_ms2: upright ? null : aNoReturn(phiRad, rollRad),
    // a_widen(phi, v; c=1) — aWiden itself returns null where the denominator
    // ≤ 0, which IS the 02 §5.3 low-speed existence bound
    a_widen_ms2: upright ? null : aWiden(phiRad, sample.v, C_FIGHTING, rollRad),
    limit_point: Object.freeze({ x: sample.limit_x, y: sample.limit_y }),
    action,
    corner_id: cornerIdAt(input.road, sample.s),
    phase: phaseAt(phaseOpeners(input.trajectory, input.road), sample.t)
  });
}

// ---------------------------------------------------------------------------
// THE bracket rule (05 §3.2) — one binary search, one blend, in one place.
//
// `stateAt` resolves a full InstantState and needs a road for `f`. The viewer's
// axis toggle and its playback schedule need only the query coordinate's DUAL
// (`s ↔ t`), which the `linear` rule lerps and which no road touches. Both go
// through `locate` so there is exactly ONE search-and-blend rule in the
// codebase — the substance of `C-ONE-CORE` on the lookup side.

interface Located {
  readonly i0: number;
  readonly i1: number;
  readonly alpha: number;
  readonly key: "s" | "t";
  readonly value: number;
}

function locate(samples: readonly Sample[], key: "s" | "t", value: number): Result<Located> {
  if (samples.length === 0) {
    return err({
      code: "INTERNAL",
      at: "trajectory.samples",
      message: "stateAt on an empty trajectory (believed impossible: every run retains >= 1 sample)",
      detail: { reason: "empty_trajectory" }
    });
  }
  const keyOf = (p: Sample): number => (key === "s" ? p.s : p.t);
  const lo = keyOf(samples[0]!);
  const hi = keyOf(samples[samples.length - 1]!);
  if (value < lo || value > hi) {
    return err({
      code: "BAD_RANGE",
      at: `[${lo}, ${hi}]`,
      message: `query ${key} = ${value} outside the trajectory domain ${key} ∈ [${lo}, ${hi}] (state after the end of a trajectory does not exist)`,
      detail: { reason: "query_outside_domain", key, min: lo, max: hi }
    });
  }
  // largest i0 with key(samples[i0]) <= value
  let loI = 0;
  let hiI = samples.length - 1;
  while (loI < hiI) {
    const mid = (loI + hiI + 1) >> 1;
    if (keyOf(samples[mid]!) <= value) loI = mid;
    else hiI = mid - 1;
  }
  const a = samples[loI]!;
  if (keyOf(a) === value) {
    // endpoint exactness: querying a sample's own s or t returns that sample
    return ok({ i0: loI, i1: loI, alpha: 0, key, value });
  }
  const i1 = loI + 1;
  const b = samples[i1]!;
  return ok({ i0: loI, i1, alpha: (value - keyOf(a)) / (keyOf(b) - keyOf(a)), key, value });
}

/**
 * `dualAt(trajectory, {s} | {t})` — the OTHER coordinate of the same instant,
 * under 05 §3.2's `linear` rule (both `s` and `t` are on its field list). The
 * viewer's axis toggle and playback schedule call this instead of carrying
 * their own bracket-and-lerp; `stateAt` and `dualAt` cannot disagree because
 * they share `locate`.
 *
 * Like `stateAt` it never clamps: a query outside `[first, terminated]` is
 * `BAD_RANGE`, and clamping stays a caller (viewer) policy (05 §4).
 */
export function dualAt(trajectory: Trajectory, query: StateAtQuery): Result<number> {
  const parsed = parseQuery(query);
  if (!parsed.ok) return parsed;
  const samples = trajectory.samples;
  const located = locate(samples, parsed.value.key, parsed.value.value);
  if (!located.ok) return located;
  const dual: "s" | "t" = parsed.value.key === "s" ? "t" : "s";
  const a = samples[located.value.i0]!;
  const b = samples[located.value.i1]!;
  return ok(lerp(a[dual], b[dual], located.value.alpha));
}

/** `{s}`/`{t}` validation — exactly one, finite (05 §4). Shared by both queries. */
function parseQuery(query: StateAtQuery): Result<{ readonly key: "s" | "t"; readonly value: number }> {
  const q = query as { readonly s?: unknown; readonly t?: unknown } | null;
  const hasS = q !== null && typeof q === "object" && "s" in q;
  const hasT = q !== null && typeof q === "object" && "t" in q;
  if (hasS === hasT) {
    return err({
      code: "SCHEMA",
      at: "query",
      message: "stateAt requires exactly one of {s} or {t}",
      detail: { reason: "query_exactly_one" }
    });
  }
  const key: "s" | "t" = hasS ? "s" : "t";
  const value = hasS ? q!.s : q!.t;
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return err({
      code: "SCHEMA",
      at: `query.${key}`,
      message: `stateAt query ${key} must be a finite number`,
      detail: { reason: "query_not_finite", key }
    });
  }
  return ok({ key, value });
}

// ---------------------------------------------------------------------------
// The query

/**
 * `stateAt(line, {s | t})` — everything about the bike at this point (05 §4).
 * Pure, Result-based, no IO; the returned InstantState is frozen.
 */
export function stateAt(input: StateAtInput, query: StateAtQuery): Result<InstantState> {
  const parsed = parseQuery(query);
  if (!parsed.ok) return parsed;
  const samples = input.trajectory.samples;
  const located = locate(samples, parsed.value.key, parsed.value.value);
  if (!located.ok) return located;
  const { i0, i1, alpha, key, value } = located.value;

  const a = samples[i0]!;
  // an exact hit returns the record verbatim (i0 === i1, alpha 0); otherwise
  // the bracket [a, b] is blended by 05 §3.2's per-field rules
  const sample = i0 === i1 ? copySample(a) : interpolateSample(a, samples[i1]!, alpha, key, value, input.road);

  const frozenSample = Object.freeze(sample);
  return ok(
    Object.freeze({
      sample: frozenSample,
      derived: deriveAt(input, frozenSample, i0, i1, alpha),
      at: Object.freeze({ i0, i1, alpha })
    })
  );
}
