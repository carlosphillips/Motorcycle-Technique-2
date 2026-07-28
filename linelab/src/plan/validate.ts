// plan/validate.ts — validate(json) → Result<ValidatedScenario> (design/03 §6,
// §6.1, §6.2): the SOLE rejection point. Normalizes, fills defaults, resolves
// anchors/placements to absolute stations, freezes. Closed-form only — NEVER
// runs the engine (03 §5.7) — so a `turn_in` whose `target` is still
// `"tangent_inside"` rides through structurally unresolved (see plan/types.ts's
// file-end deviation note).
//
// Rule ownership inside this file, top to bottom: top-level scenario shape →
// road (delegates to road/compose.ts) → occluders/hazards (delegates to
// plan/placements.ts) → rider (profile, roll-rate cap, start) → plan actions
// (stage A: per-action shape; stage B: turn_in governing-corner binding; stage
// C: position reachability, design/03 §6.1 rules 1-5) → config → expect_fail/meta.

import type { Result, LinelabError } from "../core/result.js";
import { ok, err } from "../core/result.js";
import type { Corner, Hand, RiderProfileName, SsdModel } from "../core/types.js";
import { RIDER_PROFILE_NAMES, SSD_MODELS } from "../core/types.js";
import type {
  ResolvedBrakeAction,
  ResolvedThrottleAction,
  ResolvedPositionAction,
  ResolvedOccluder,
  ResolvedHazard,
  ResolvedConfig
} from "../core/types.js";
import {
  RIDER_PROFILES,
  G,
  SLEW_MIN,
  SLEW_MAX,
  A_SLEW_DEFAULT,
  FREEZE_MAX_S,
  K_REACH,
  a_lat_pos_max
} from "../core/constants.js";
import { radToDeg, kmhToMs } from "../core/units.js";
import { compose } from "../road/compose.js";
import type { ComposedRoad } from "../road/types.js";
import type { RoadSpec, Segment } from "../road/types.js";
import { isPresetSpec } from "../road/types.js";
import { PRESETS } from "../road/presets.js";
import { resolveAnchor } from "./anchors.js";
import {
  resolveOccluder,
  resolveHazard,
  parseOccluderOrHazardToken
} from "./placements.js";
import type {
  Occluder,
  Hazard,
  TurnInTarget,
  ValidatedScenario,
  ValidatedTurnInAction,
  ValidatedPlanAction
} from "./types.js";
import {
  CONFIG_MU_DEFAULT,
  CONFIG_DS_M_DEFAULT,
  CONFIG_SSD_MODEL_DEFAULT,
  CONFIG_RUBRIC_DEFAULT,
  CONFIG_CHECKS_VERSION_DEFAULT,
  START_F_DEFAULT
} from "./constants.js";

// ---------------------------------------------------------------------------
// Small runtime type guards + error builders

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function schemaErr(at: string, message: string, reason: string, detail?: Record<string, unknown>): LinelabError {
  return { code: "SCHEMA", at, message, detail: { reason, ...detail } };
}
function badRange(at: string, message: string, reason: string, detail?: Record<string, unknown>): LinelabError {
  return { code: "BAD_RANGE", at, message, detail: { reason, ...detail } };
}
function ineffectual(at: string, message: string, reason: string, detail?: Record<string, unknown>): LinelabError {
  return { code: "INEFFECTUAL", at, message, detail: { reason, ...detail } };
}
function unknownId(at: string, message: string, reason: string, detail?: Record<string, unknown>): LinelabError {
  return { code: "UNKNOWN_ID", at, message, detail: { reason, ...detail } };
}
function dupId(at: string, message: string, reason: string, detail?: Record<string, unknown>): LinelabError {
  return { code: "DUP_ID", at, message, detail: { reason, ...detail } };
}

// ---------------------------------------------------------------------------
// Hand token (D26: full words reject SCHEMA with a rewrite hint)

function parseHandToken(value: unknown, at: string): Result<Hand> {
  if (value === "L" || value === "R") return ok(value);
  if (typeof value === "string") {
    const lower = value.toLowerCase();
    if (lower === "left" || lower === "right") {
      const rewrite = lower === "left" ? "L" : "R";
      return err(
        schemaErr(at, `hand must be spelled "L"|"R" — write "${rewrite}" instead of "${value}"`, "hand_full_word", {
          rewrite
        })
      );
    }
  }
  return err(schemaErr(at, `hand must be "L" or "R" (got ${JSON.stringify(value)})`, "hand_malformed"));
}

// ---------------------------------------------------------------------------
// road (design/03 §2.1) — raw JSON → RoadSpec, then road/compose.ts

function parseRoadSpecJson(raw: unknown, at: string): Result<RoadSpec> {
  if (!isObject(raw)) return err(schemaErr(at, "road must be a JSON object", "road_not_object"));
  if ("traffic" in raw) {
    return err(
      schemaErr(
        `${at}.traffic`,
        "the traffic field is reserved for a future left-hand-traffic mode",
        "traffic_reserved"
      )
    );
  }
  const hasSegments = "segments" in raw;
  const hasPreset = "preset" in raw;
  const hasDsl = "dsl" in raw;
  if ([hasSegments, hasPreset, hasDsl].filter(Boolean).length !== 1) {
    return err(schemaErr(at, "road must carry exactly one of segments, preset, or dsl", "road_variant_ambiguous"));
  }

  const useFullWidthRaw = raw["use_full_width"];
  if (useFullWidthRaw !== undefined && typeof useFullWidthRaw !== "boolean") {
    return err(schemaErr(`${at}.use_full_width`, "use_full_width must be a boolean", "type_mismatch"));
  }
  const bikeMarginRaw = raw["bike_margin_m"];
  if (bikeMarginRaw !== undefined && typeof bikeMarginRaw !== "number") {
    return err(schemaErr(`${at}.bike_margin_m`, "bike_margin_m must be a number", "type_mismatch"));
  }
  const useFullWidth = useFullWidthRaw as boolean | undefined;
  const bikeMargin = bikeMarginRaw as number | undefined;

  if (hasPreset) {
    const presetName = raw["preset"];
    if (typeof presetName !== "string") return err(schemaErr(`${at}.preset`, "preset must be a string", "type_mismatch"));
    let hand: Hand | undefined;
    if (raw["hand"] !== undefined) {
      const h = parseHandToken(raw["hand"], `${at}.hand`);
      if (!h.ok) return h;
      hand = h.value;
    }
    return ok({
      preset: presetName,
      ...(hand !== undefined ? { hand } : {}),
      ...(useFullWidth !== undefined ? { use_full_width: useFullWidth } : {}),
      ...(bikeMargin !== undefined ? { bike_margin_m: bikeMargin } : {})
    });
  }

  if ("hand" in raw) {
    return err(schemaErr(`${at}.hand`, "spell hands per segment", "hand_on_explicit_road"));
  }

  if (hasDsl) {
    const dsl = raw["dsl"];
    if (typeof dsl !== "string") return err(schemaErr(`${at}.dsl`, "dsl must be a string", "type_mismatch"));
    return ok({
      dsl,
      ...(useFullWidth !== undefined ? { use_full_width: useFullWidth } : {}),
      ...(bikeMargin !== undefined ? { bike_margin_m: bikeMargin } : {})
    });
  }

  const laneWidth = raw["lane_width_m"];
  if (typeof laneWidth !== "number") {
    return err(schemaErr(`${at}.lane_width_m`, "lane_width_m must be a number", "type_mismatch"));
  }
  const segmentsRaw = raw["segments"];
  if (!Array.isArray(segmentsRaw) || segmentsRaw.length === 0) {
    return err(schemaErr(`${at}.segments`, "segments must be a non-empty array", "type_mismatch"));
  }
  const segments: Segment[] = [];
  for (let i = 0; i < segmentsRaw.length; i++) {
    const seg: unknown = segmentsRaw[i];
    const segAt = `${at}.segments[${i}]`;
    if (!isObject(seg)) return err(schemaErr(segAt, "segment must be a JSON object", "type_mismatch"));
    const type = seg["type"];
    if (type === "straight") {
      const len_m = seg["len_m"];
      if (typeof len_m !== "number") return err(schemaErr(`${segAt}.len_m`, "len_m must be a number", "type_mismatch"));
      segments.push({ type: "straight", len_m });
    } else if (type === "arc") {
      const r_m = seg["r_m"];
      const angle_deg = seg["angle_deg"];
      if (typeof r_m !== "number" || typeof angle_deg !== "number") {
        return err(schemaErr(segAt, "arc needs numeric r_m, angle_deg", "type_mismatch"));
      }
      const hand = parseHandToken(seg["hand"], `${segAt}.hand`);
      if (!hand.ok) return hand;
      segments.push({ type: "arc", r_m, angle_deg, hand: hand.value });
    } else if (type === "taper") {
      const r1_m = seg["r1_m"];
      const r2_m = seg["r2_m"];
      const angle_deg = seg["angle_deg"];
      if (typeof r1_m !== "number" || typeof r2_m !== "number" || typeof angle_deg !== "number") {
        return err(schemaErr(segAt, "taper needs numeric r1_m, r2_m, angle_deg", "type_mismatch"));
      }
      const hand = parseHandToken(seg["hand"], `${segAt}.hand`);
      if (!hand.ok) return hand;
      segments.push({ type: "taper", r1_m, r2_m, angle_deg, hand: hand.value });
    } else {
      return err(schemaErr(`${segAt}.type`, `unknown segment type "${String(type)}"`, "type_mismatch"));
    }
  }
  return ok({
    lane_width_m: laneWidth,
    segments,
    ...(useFullWidth !== undefined ? { use_full_width: useFullWidth } : {}),
    ...(bikeMargin !== undefined ? { bike_margin_m: bikeMargin } : {})
  });
}

// ---------------------------------------------------------------------------
// Occluders / hazards: id minting + preset-embedded tokens + resolution

function mintIds<T extends { readonly id?: string }>(
  rawList: readonly T[],
  prefix: string,
  at: string
): Result<readonly string[]> {
  const seen = new Set<string>();
  const ids: string[] = [];
  for (let i = 0; i < rawList.length; i++) {
    const raw = rawList[i]!;
    const id = raw.id ?? `${prefix}${i + 1}`;
    if (seen.has(id)) {
      return err(dupId(`${at}[${i}].id`, `duplicate id "${id}"`, "duplicate_id", { id }));
    }
    seen.add(id);
    ids.push(id);
  }
  return ok(ids);
}

// ---------------------------------------------------------------------------
// Rider

function parseRider(
  riderRaw: unknown,
  corners: readonly Corner[]
): Result<{
  readonly profile: RiderProfileName;
  readonly roll_rate_cap_dps: number | undefined;
  readonly rollRateEff: number;
  readonly speed_kmh: number;
  readonly start_f: number | undefined;
  readonly start_d: number | undefined;
  readonly planRaw: readonly unknown[];
}> {
  if (!isObject(riderRaw)) return err(schemaErr("rider", "rider must be a JSON object", "type_mismatch"));

  let profile: RiderProfileName = "street";
  if (riderRaw["profile"] !== undefined) {
    const p = riderRaw["profile"];
    if (typeof p !== "string" || !(RIDER_PROFILE_NAMES as readonly string[]).includes(p)) {
      return err(
        schemaErr(
          "rider.profile",
          `rider.profile must be one of ${RIDER_PROFILE_NAMES.join(", ")} (got ${JSON.stringify(p)})`,
          "type_mismatch"
        )
      );
    }
    profile = p as RiderProfileName;
  }
  const profileTable = RIDER_PROFILES[profile];

  let roll_rate_cap_dps: number | undefined;
  if (riderRaw["roll_rate_cap_dps"] !== undefined) {
    const cap = riderRaw["roll_rate_cap_dps"];
    if (typeof cap !== "number") {
      return err(schemaErr("rider.roll_rate_cap_dps", "roll_rate_cap_dps must be a number", "type_mismatch"));
    }
    if (!(cap > 0)) {
      return err(badRange("rider.roll_rate_cap_dps", "roll_rate_cap_dps must be > 0", "roll_rate_cap_nonpositive"));
    }
    if (cap >= profileTable.roll_rate_dps) {
      return err(
        ineffectual(
          "rider.roll_rate_cap_dps",
          `roll_rate_cap_dps (${cap}) does not bind below the ${profile} profile rate (${profileTable.roll_rate_dps})`,
          "roll_rate_cap_not_binding"
        )
      );
    }
    roll_rate_cap_dps = cap;
  }
  const rollRateEff = roll_rate_cap_dps ?? profileTable.roll_rate_dps;

  const startRaw = riderRaw["start"];
  if (!isObject(startRaw)) return err(schemaErr("rider.start", "rider.start must be a JSON object", "type_mismatch"));
  const speedKmhRaw = startRaw["speed_kmh"];
  // design/03 requiredness pin (ARCHITECTURE §10 pin #8): speed_kmh required, NO default.
  if (typeof speedKmhRaw !== "number" || !(speedKmhRaw > 0)) {
    return err(
      schemaErr("rider.start.speed_kmh", "rider.start.speed_kmh is required and must be a positive number", "speed_kmh_required")
    );
  }
  const hasF = startRaw["f"] !== undefined;
  const hasD = startRaw["d"] !== undefined;
  if (hasF && hasD) {
    return err(schemaErr("rider.start", "rider.start needs exactly one of f or d", "start_f_xor_d"));
  }
  let start_f: number | undefined;
  let start_d: number | undefined;
  if (hasD) {
    const d = startRaw["d"];
    if (typeof d !== "number") return err(schemaErr("rider.start.d", "d must be a number", "type_mismatch"));
    start_d = d;
  } else {
    const f = hasF ? startRaw["f"] : START_F_DEFAULT;
    if (typeof f !== "number") return err(schemaErr("rider.start.f", "f must be a number", "type_mismatch"));
    if (!(f >= 0 && f <= 1)) {
      return err(badRange("rider.start.f", `rider.start.f (${f}) must be in [0, 1]`, "start_f_outside_corridor"));
    }
    start_f = f;
  }

  const planRaw = riderRaw["plan"];
  if (!Array.isArray(planRaw)) return err(schemaErr("rider.plan", "rider.plan must be an array", "type_mismatch"));

  void corners;
  return ok({
    profile,
    roll_rate_cap_dps,
    rollRateEff,
    speed_kmh: speedKmhRaw,
    start_f,
    start_d,
    planRaw
  });
}

// ---------------------------------------------------------------------------
// Plan actions — station resolution shared by all four kinds

function resolveActionStation(raw: Record<string, unknown>, corners: readonly Corner[], at: string): Result<number> {
  const hasAtS = raw["at_s"] !== undefined;
  const hasAt = raw["at"] !== undefined;
  if (hasAtS === hasAt) {
    return err(schemaErr(at, "an action needs exactly one of at_s or at", "action_anchor_ambiguous"));
  }
  if (hasAtS) {
    const at_s = raw["at_s"];
    if (typeof at_s !== "number") return err(schemaErr(`${at}.at_s`, "at_s must be a number", "type_mismatch"));
    return ok(at_s);
  }
  const atObj = raw["at"];
  if (!isObject(atObj)) return err(schemaErr(`${at}.at`, "at must be a JSON object", "type_mismatch"));
  const ref = atObj["ref"];
  if (typeof ref !== "string") return err(schemaErr(`${at}.at.ref`, "at.ref must be a string", "type_mismatch"));
  let offset_m: number | undefined;
  if (atObj["offset_m"] !== undefined) {
    const o = atObj["offset_m"];
    if (typeof o !== "number") return err(schemaErr(`${at}.at.offset_m`, "offset_m must be a number", "type_mismatch"));
    offset_m = o;
  }
  return resolveAnchor(offset_m !== undefined ? { ref, offset_m } : { ref }, corners, `${at}.at`);
}

function parseSlew(value: unknown, at: string): Result<number> {
  if (value === undefined) return ok(A_SLEW_DEFAULT);
  if (typeof value !== "number") return err(schemaErr(at, "slew_mss must be a number", "type_mismatch"));
  if (value < SLEW_MIN || value > SLEW_MAX) {
    return err(badRange(at, `slew_mss must be in [${SLEW_MIN}, ${SLEW_MAX}]`, "slew_out_of_range"));
  }
  return ok(value);
}

function parseBrake(raw: Record<string, unknown>, id: string, at_s: number, at: string): Result<ResolvedBrakeAction> {
  if (raw["freeze_steer_s"] !== undefined) {
    return err(schemaErr(`${at}.freeze_steer_s`, "freeze_steer_s is a throttle-only field", "freeze_steer_s_not_here"));
  }
  const decel = raw["decel"];
  if (typeof decel !== "number" || !(decel > 0)) {
    return err(badRange(`${at}.decel`, "decel must be a positive number", "decel_nonpositive"));
  }
  let taper_to_s: number | undefined;
  if (raw["taper_to_s"] !== undefined) {
    const t = raw["taper_to_s"];
    if (typeof t !== "number") return err(schemaErr(`${at}.taper_to_s`, "taper_to_s must be a number", "type_mismatch"));
    taper_to_s = t;
  }
  const slew = parseSlew(raw["slew_mss"], `${at}.slew_mss`);
  if (!slew.ok) return slew;
  return ok({ do: "brake", id, at_s, decel, ...(taper_to_s !== undefined ? { taper_to_s } : {}), slew_mss: slew.value });
}

function parseThrottle(raw: Record<string, unknown>, id: string, at_s: number, at: string): Result<ResolvedThrottleAction> {
  const accel = raw["accel"];
  if (typeof accel !== "number" || accel < 0) {
    return err(badRange(`${at}.accel`, "accel must be ≥ 0", "accel_negative"));
  }
  const slew = parseSlew(raw["slew_mss"], `${at}.slew_mss`);
  if (!slew.ok) return slew;
  let freeze_steer_s: number | undefined;
  if (raw["freeze_steer_s"] !== undefined) {
    const f = raw["freeze_steer_s"];
    if (typeof f !== "number") return err(schemaErr(`${at}.freeze_steer_s`, "freeze_steer_s must be a number", "type_mismatch"));
    if (!(f > 0 && f <= FREEZE_MAX_S)) {
      return err(badRange(`${at}.freeze_steer_s`, `freeze_steer_s must be in (0, ${FREEZE_MAX_S}]`, "freeze_out_of_range"));
    }
    freeze_steer_s = f;
  }
  return ok({
    do: "throttle",
    id,
    at_s,
    accel,
    slew_mss: slew.value,
    ...(freeze_steer_s !== undefined ? { freeze_steer_s } : {})
  });
}

function parseTurnInTarget(raw: unknown, at: string): Result<TurnInTarget> {
  if (raw === "tangent_inside") return ok("tangent_inside");
  if (isObject(raw) && typeof raw["lean_deg"] === "number") {
    const lean = raw["lean_deg"];
    if (!(lean > 0 && lean < 90)) {
      return err(badRange(`${at}.lean_deg`, "lean_deg must be in (0, 90)", "lean_deg_out_of_range"));
    }
    return ok({ lean_deg: lean });
  }
  return err(schemaErr(at, 'turn_in target must be "tangent_inside" or {lean_deg}', "turn_in_target_malformed"));
}

interface StagedTurnIn {
  readonly id: string;
  readonly at_s: number;
  readonly target: TurnInTarget;
  readonly explicitHand: Hand | undefined;
  readonly at: string;
}

function parseTurnInStageA(raw: Record<string, unknown>, id: string, at_s: number, at: string): Result<StagedTurnIn> {
  if (raw["slew_mss"] !== undefined) {
    return err(schemaErr(`${at}.slew_mss`, "slew_mss is not a turn_in field", "slew_mss_not_here"));
  }
  if (raw["freeze_steer_s"] !== undefined) {
    return err(schemaErr(`${at}.freeze_steer_s`, "freeze_steer_s is a throttle-only field", "freeze_steer_s_not_here"));
  }
  const target = parseTurnInTarget(raw["target"], `${at}.target`);
  if (!target.ok) return target;
  let explicitHand: Hand | undefined;
  if (raw["hand"] !== undefined) {
    const h = parseHandToken(raw["hand"], `${at}.hand`);
    if (!h.ok) return h;
    explicitHand = h.value;
  }
  return ok({ id, at_s, target: target.value, explicitHand, at });
}

interface StagedPosition {
  readonly id: string;
  readonly at_s: number;
  readonly f: number | undefined;
  readonly d: number | undefined;
  readonly overRaw: number | "auto" | undefined;
  readonly at: string;
}

function parsePositionStageA(raw: Record<string, unknown>, id: string, at_s: number, at: string): Result<StagedPosition> {
  if (raw["slew_mss"] !== undefined) {
    return err(schemaErr(`${at}.slew_mss`, "slew_mss is not a position field", "slew_mss_not_here"));
  }
  const hasF = raw["f"] !== undefined;
  const hasD = raw["d"] !== undefined;
  if (hasF === hasD) {
    return err(schemaErr(at, "position needs exactly one of f or d", "position_f_xor_d"));
  }
  let f: number | undefined;
  let d: number | undefined;
  if (hasF) {
    const fv = raw["f"];
    if (typeof fv !== "number") return err(schemaErr(`${at}.f`, "f must be a number", "type_mismatch"));
    f = fv;
  } else {
    const dv = raw["d"];
    if (typeof dv !== "number") return err(schemaErr(`${at}.d`, "d must be a number", "type_mismatch"));
    d = dv;
  }
  let overRaw: number | "auto" | undefined;
  if (raw["over_m"] !== undefined) {
    const o = raw["over_m"];
    if (o === "auto") overRaw = "auto";
    else if (typeof o === "number") overRaw = o;
    else return err(schemaErr(`${at}.over_m`, 'over_m must be a number or "auto"', "type_mismatch"));
  }
  return ok({ id, at_s, f, d, overRaw, at });
}

function resolveGoverningCorner(
  at_s: number,
  explicitHand: Hand | undefined,
  corners: readonly Corner[],
  at: string
): Result<Corner> {
  const downstream = corners.filter((c) => c.s1 > at_s);
  const found = explicitHand === undefined ? downstream[0] : downstream.find((c) => c.hand === explicitHand);
  if (found === undefined) {
    return err(
      badRange(
        at,
        explicitHand === undefined
          ? "no corner lies downstream of this turn_in"
          : `no ${explicitHand}-hand corner lies downstream of this turn_in`,
        "no_governing_corner"
      )
    );
  }
  return ok(found);
}

// ---------------------------------------------------------------------------
// Closed-form v_cmd(s) / T_cmd(s0,s1) — design/03 §6.1: "integrating the plan's
// commanded brake/throttle accelerations kinematically from start.speed_kmh
// (piecewise v² = v0² ± 2·a·Δs, friction ellipse ignored)". Slew ramps are
// deliberately NOT modelled here (the closed form treats a command as active at
// its full level from `at_s`) — the validator's own stated simplification.

interface AccelSeg {
  readonly s0: number;
  readonly s1: number;
  readonly aStart: number;
  readonly aEnd: number;
}

function buildAccelSegments(
  brakes: readonly ResolvedBrakeAction[],
  throttles: readonly ResolvedThrottleAction[],
  horizon: number
): readonly AccelSeg[] {
  interface Long {
    readonly at_s: number;
    readonly isBrake: boolean;
    readonly level: number;
    readonly taper_to_s?: number;
  }
  const longs: Long[] = [
    ...brakes.map((b) => ({ at_s: b.at_s, isBrake: true, level: -b.decel, taper_to_s: b.taper_to_s })),
    ...throttles.map((t) => ({ at_s: t.at_s, isBrake: false, level: t.accel }))
  ].sort((a, b) => a.at_s - b.at_s);

  const segs: AccelSeg[] = [];
  let cursor = 0;
  let cursorA = 0;
  for (let i = 0; i < longs.length; i++) {
    const act = longs[i]!;
    if (act.at_s > cursor) {
      segs.push({ s0: cursor, s1: act.at_s, aStart: cursorA, aEnd: cursorA });
      cursor = act.at_s;
    }
    const next = longs[i + 1];
    if (act.isBrake && act.taper_to_s !== undefined) {
      const tEnd = next !== undefined ? Math.min(act.taper_to_s, next.at_s) : act.taper_to_s;
      if (tEnd > cursor) {
        segs.push({ s0: cursor, s1: tEnd, aStart: act.level, aEnd: 0 });
        cursor = tEnd;
        cursorA = 0;
      }
    } else {
      const end = next !== undefined ? next.at_s : horizon;
      if (end > cursor) {
        segs.push({ s0: cursor, s1: end, aStart: act.level, aEnd: act.level });
        cursor = end;
        cursorA = act.level;
      }
    }
  }
  if (cursor < horizon) segs.push({ s0: cursor, s1: horizon, aStart: cursorA, aEnd: cursorA });
  return segs;
}

const VCMD_GRID_N = 32;

function vSqAt(segs: readonly AccelSeg[], v0sq: number, sTarget: number): { vsq: number; parkedAt: number | null } {
  let vsq = v0sq;
  for (const seg of segs) {
    if (seg.s0 >= sTarget) break;
    const segEnd = Math.min(sTarget, seg.s1);
    const spanTotal = seg.s1 - seg.s0;
    const spanUsed = segEnd - seg.s0;
    if (spanUsed <= 0) continue;
    let prevA = seg.aStart;
    let sPrev = seg.s0;
    let vsqPrev = vsq;
    for (let k = 1; k <= VCMD_GRID_N; k++) {
      const sK = seg.s0 + (spanUsed * k) / VCMD_GRID_N;
      const aK = spanTotal > 0 ? seg.aStart + (seg.aEnd - seg.aStart) * ((sK - seg.s0) / spanTotal) : seg.aStart;
      const dS = sK - sPrev;
      const areaA = 0.5 * (prevA + aK) * dS;
      const vsqK = vsqPrev + 2 * areaA;
      if (vsqK <= 0) {
        const denom = vsqPrev - vsqK;
        const frac = denom > 0 ? vsqPrev / denom : 0;
        return { vsq: 0, parkedAt: sPrev + frac * dS };
      }
      vsqPrev = vsqK;
      sPrev = sK;
      prevA = aK;
    }
    vsq = vsqPrev;
    if (segEnd < seg.s1) break;
  }
  return { vsq, parkedAt: null };
}

function vCmdAt(segs: readonly AccelSeg[], v0: number, s: number): number {
  if (s <= 0) return v0;
  return Math.sqrt(Math.max(0, vSqAt(segs, v0 * v0, s).vsq));
}

const TCMD_GRID_N = 64;

/** T_cmd(s0,s1) — Infinity if v_cmd reaches 0 inside [s0,s1] (design/03 §6.1). */
function tCmd(segs: readonly AccelSeg[], v0: number, s0: number, s1: number): number {
  if (s1 <= s0) return 0;
  const atEnd = vSqAt(segs, v0 * v0, s1);
  if (atEnd.parkedAt !== null && atEnd.parkedAt <= s1) return Infinity;
  let t = 0;
  for (let k = 0; k < TCMD_GRID_N; k++) {
    const sa = s0 + ((s1 - s0) * k) / TCMD_GRID_N;
    const sb = s0 + ((s1 - s0) * (k + 1)) / TCMD_GRID_N;
    const va = vCmdAt(segs, v0, sa);
    const vb = vCmdAt(segs, v0, sb);
    if (va <= 0 || vb <= 0) return Infinity;
    t += (sb - sa) * 0.5 * (1 / va + 1 / vb);
  }
  return t;
}

/** L_req(Δd, v) — design/03 §6.1, verbatim. */
function lReq(deltaD: number, v: number, t_roll: number): number {
  return 2 * v * (Math.sqrt((K_REACH * deltaD) / a_lat_pos_max) + t_roll);
}

// ---------------------------------------------------------------------------
// The main entry point

export function validate(json: unknown): Result<ValidatedScenario> {
  if (!isObject(json)) return err(schemaErr("", "a scenario must be a JSON object", "scenario_not_object"));

  const spec = json["spec"];
  if (spec !== "linelab/1") {
    return err(schemaErr("spec", `spec must be "linelab/1" (got ${JSON.stringify(spec)})`, "spec_mismatch"));
  }
  const id = json["id"];
  if (typeof id !== "string" || id.length === 0) {
    return err(schemaErr("id", "id must be a non-empty string", "id_missing"));
  }

  // -- road -------------------------------------------------------------------
  const roadSpecRaw = json["road"];
  const roadSpec = parseRoadSpecJson(roadSpecRaw, "road");
  if (!roadSpec.ok) return roadSpec;
  const composed = compose(roadSpec.value);
  if (!composed.ok) return composed;
  const road: ComposedRoad = composed.value;
  const corners = road.corners;

  // -- occluders (JSON-declared + preset-embedded tokens) ----------------------
  const occludersRaw = json["occluders"];
  if (occludersRaw !== undefined && !Array.isArray(occludersRaw)) {
    return err(schemaErr("occluders", "occluders must be an array", "type_mismatch"));
  }
  const presetOccluderTokens: readonly string[] = isPresetSpec(roadSpec.value)
    ? (PRESETS as Record<string, { readonly occluders: readonly string[] }>)[roadSpec.value.preset]?.occluders ?? []
    : [];
  const tokenOccluders: Occluder[] = [];
  for (let i = 0; i < presetOccluderTokens.length; i++) {
    const parsed = parseOccluderOrHazardToken(presetOccluderTokens[i]!, `road.preset.occluders[${i}]`);
    if (!parsed.ok) return parsed;
    if (parsed.value.occluder !== undefined) tokenOccluders.push(parsed.value.occluder);
  }
  const occludersInput: readonly Occluder[] = [...tokenOccluders, ...((occludersRaw as Occluder[] | undefined) ?? [])];
  const occluderIds = mintIds(occludersInput, "o", "occluders");
  if (!occluderIds.ok) return occluderIds;
  const occluders: ResolvedOccluder[] = [];
  for (let i = 0; i < occludersInput.length; i++) {
    const raw = occludersInput[i]!;
    if (!isObject(raw)) return err(schemaErr(`occluders[${i}]`, "occluder must be a JSON object", "type_mismatch"));
    if (raw.kind === "vehicle" && raw.lane === "oncoming" && road.use_full_width) {
      return err(
        {
          code: "OUT_OF_SCOPE",
          at: `occluders[${i}]`,
          message: "full_width and an oncoming-lane vehicle placement cannot both hold",
          detail: { reason: "full_width_with_oncoming_traffic" }
        }
      );
    }
    const resolved = resolveOccluder(raw, corners, occluderIds.value[i]!, `occluders[${i}]`);
    if (!resolved.ok) return resolved;
    occluders.push(resolved.value);
  }

  // -- hazards ------------------------------------------------------------------
  const hazardsRaw = json["hazards"];
  if (hazardsRaw !== undefined && !Array.isArray(hazardsRaw)) {
    return err(schemaErr("hazards", "hazards must be an array", "type_mismatch"));
  }
  const hazardsInput: readonly Hazard[] = (hazardsRaw as Hazard[] | undefined) ?? [];
  const hazardIds = mintIds(hazardsInput, "h", "hazards");
  if (!hazardIds.ok) return hazardIds;
  const hazards: ResolvedHazard[] = [];
  for (let i = 0; i < hazardsInput.length; i++) {
    const raw = hazardsInput[i]!;
    if (!isObject(raw)) return err(schemaErr(`hazards[${i}]`, "hazard must be a JSON object", "type_mismatch"));
    const resolved = resolveHazard(raw, corners, hazardIds.value[i]!, `hazards[${i}]`);
    if (!resolved.ok) return resolved;
    hazards.push(resolved.value);
  }

  // -- rider ----------------------------------------------------------------
  const rider = parseRider(json["rider"], corners);
  if (!rider.ok) return rider;
  const { profile, roll_rate_cap_dps, rollRateEff, speed_kmh, start_f, start_d, planRaw } = rider.value;
  const v0 = kmhToMs(speed_kmh);
  const phiAuthDeg = radToDeg(Math.atan(a_lat_pos_max / G));
  const t_roll = phiAuthDeg / rollRateEff;

  // -- plan stage A: per-action parsing (station resolution + shape) --------
  const finalActions: (ValidatedPlanAction | undefined)[] = new Array(planRaw.length).fill(undefined);
  const stagedTurnIns: Array<{ readonly index: number; readonly staged: StagedTurnIn }> = [];
  const stagedPositions: Array<{ readonly index: number; readonly staged: StagedPosition }> = [];
  const brakeActions: ResolvedBrakeAction[] = [];
  const throttleActions: ResolvedThrottleAction[] = [];
  const seenActionIds = new Set<string>();

  for (let i = 0; i < planRaw.length; i++) {
    const raw = planRaw[i];
    const at = `rider.plan[${i}]`;
    if (!isObject(raw)) return err(schemaErr(at, "plan action must be a JSON object", "type_mismatch"));
    const actionId = raw["id"];
    if (typeof actionId !== "string" || actionId.length === 0) {
      return err(schemaErr(`${at}.id`, "every action needs a stable string id", "action_id_missing"));
    }
    if (seenActionIds.has(actionId)) {
      return err(dupId(`${at}.id`, `duplicate plan action id "${actionId}"`, "duplicate_action_id", { id: actionId }));
    }
    seenActionIds.add(actionId);

    const at_sR = resolveActionStation(raw, corners, at);
    if (!at_sR.ok) return at_sR;
    const at_s = at_sR.value;

    const doField = raw["do"];
    if (doField === "brake") {
      const parsed = parseBrake(raw, actionId, at_s, at);
      if (!parsed.ok) return parsed;
      finalActions[i] = parsed.value;
      brakeActions.push(parsed.value);
    } else if (doField === "throttle") {
      const parsed = parseThrottle(raw, actionId, at_s, at);
      if (!parsed.ok) return parsed;
      finalActions[i] = parsed.value;
      throttleActions.push(parsed.value);
    } else if (doField === "turn_in") {
      const parsed = parseTurnInStageA(raw, actionId, at_s, at);
      if (!parsed.ok) return parsed;
      stagedTurnIns.push({ index: i, staged: parsed.value });
    } else if (doField === "position") {
      const parsed = parsePositionStageA(raw, actionId, at_s, at);
      if (!parsed.ok) return parsed;
      stagedPositions.push({ index: i, staged: parsed.value });
    } else {
      return err(schemaErr(`${at}.do`, `unknown action kind "${String(doField)}"`, "action_kind_unknown"));
    }
  }

  // -- plan stage B: turn_in governing-corner binding + freeze interaction --
  const resolvedTurnIns: Array<{
    readonly index: number;
    readonly action: ValidatedTurnInAction;
    readonly commitmentStart: number;
    readonly commitmentEnd: number;
  }> = [];
  for (const { index, staged } of stagedTurnIns) {
    const corner = resolveGoverningCorner(staged.at_s, staged.explicitHand, corners, staged.at);
    if (!corner.ok) return corner;
    for (const th of throttleActions) {
      if (th.freeze_steer_s === undefined) continue;
      const winStart = th.at_s;
      const winEnd = th.at_s + th.freeze_steer_s;
      if (staged.at_s >= winStart && staged.at_s < winEnd) {
        return err(
          ineffectual(staged.at, "turn_in falls inside a throttle steering-freeze window", "turn_in_during_freeze", {
            throttle_id: th.id
          })
        );
      }
    }
    const action: ValidatedTurnInAction = {
      do: "turn_in",
      id: staged.id,
      at_s: staged.at_s,
      target: staged.target,
      hand: corner.value.hand
    };
    resolvedTurnIns.push({ index, action, commitmentStart: staged.at_s, commitmentEnd: corner.value.s1 });
    finalActions[index] = action;
  }

  // -- plan stage C: position reachability (design/03 §6.1 rules 1-5) --------
  const roadEnd = road.total_len_m;
  const accelSegs = buildAccelSegments(brakeActions, throttleActions, roadEnd);
  const otherPositionStarts = stagedPositions.map((p) => p.staged.at_s);
  const turnInCommitmentStarts = resolvedTurnIns.map((t) => t.commitmentStart);

  interface LateralEvent {
    readonly at_s: number;
    readonly f_tgt: number | null; // null on a turn_in (post-commitment: undefined per design)
  }
  const lateralEvents: LateralEvent[] = [];
  for (const { staged } of stagedPositions) {
    const f_tgt = staged.f !== undefined ? staged.f : road.fOf(staged.d as number, staged.at_s);
    lateralEvents.push({ at_s: staged.at_s, f_tgt });
  }
  for (const t of resolvedTurnIns) {
    lateralEvents.push({ at_s: t.commitmentStart, f_tgt: null });
  }
  function fFrom(at_s: number): number | undefined {
    let best: LateralEvent | undefined;
    for (const e of lateralEvents) {
      if (e.at_s < at_s && (best === undefined || e.at_s > best.at_s)) best = e;
    }
    if (best === undefined) {
      return start_f !== undefined ? start_f : road.fOf(start_d as number, at_s);
    }
    return best.f_tgt === null ? undefined : best.f_tgt;
  }

  interface ResolvedPos {
    readonly index: number;
    readonly staged: StagedPosition;
    readonly f_tgt: number;
    readonly over_m: number;
    readonly windowStart: number;
    readonly windowEnd: number;
  }
  const resolvedPositions: ResolvedPos[] = [];
  for (const { index, staged } of stagedPositions) {
    const f_tgt = staged.f !== undefined ? staged.f : road.fOf(staged.d as number, staged.at_s);
    if (!(f_tgt >= 0 && f_tgt <= 1)) {
      return err(
        badRange(staged.at, `position target f=${f_tgt.toFixed(3)} is outside the corridor [0,1]`, "position_target_outside_corridor")
      );
    }
    let over_m: number;
    if (staged.overRaw === undefined || staged.overRaw === "auto") {
      const candidates = [
        roadEnd,
        ...otherPositionStarts.filter((s2) => s2 > staged.at_s),
        ...turnInCommitmentStarts.filter((s2) => s2 > staged.at_s)
      ];
      over_m = Math.min(...candidates) - staged.at_s;
    } else {
      over_m = staged.overRaw;
    }
    const windowStart = staged.at_s;
    const windowEnd = staged.at_s + over_m;
    if (!(windowStart >= 0 && windowEnd <= roadEnd)) {
      return err(
        badRange(staged.at, `position window [${windowStart}, ${windowEnd}] must lie within [0, ${roadEnd}]`, "position_window_outside_road")
      );
    }
    for (const t of resolvedTurnIns) {
      if (windowStart < t.commitmentEnd && t.commitmentStart < windowEnd) {
        return err(
          ineffectual(
            staged.at,
            `position window overlaps turn_in "${t.action.id}"'s commitment window`,
            "position_overlaps_turn_in",
            { turn_in_id: t.action.id }
          )
        );
      }
    }
    resolvedPositions.push({ index, staged, f_tgt, over_m, windowStart, windowEnd });
  }
  for (let i = 0; i < resolvedPositions.length; i++) {
    for (let j = i + 1; j < resolvedPositions.length; j++) {
      const a = resolvedPositions[i]!;
      const b = resolvedPositions[j]!;
      if (a.windowStart < b.windowEnd && b.windowStart < a.windowEnd) {
        return err(
          ineffectual(a.staged.at, `position windows of "${a.staged.id}" and "${b.staged.id}" overlap`, "position_overlaps_position", {
            ids: [a.staged.id, b.staged.id]
          })
        );
      }
    }
  }
  for (const rp of resolvedPositions) {
    const from = fFrom(rp.staged.at_s);
    if (from !== undefined) {
      const dTgt = road.dOf(rp.f_tgt, rp.staged.at_s);
      const dFrom = road.dOf(from, rp.staged.at_s);
      const deltaD = Math.abs(dTgt - dFrom);
      const T = tCmd(accelSegs, v0, rp.windowStart, rp.windowEnd);
      const halfBudget = Math.max(0, T / 2 - t_roll);
      const achievableDd = a_lat_pos_max * halfBudget * halfBudget;
      const requested = K_REACH * deltaD;
      if (requested > achievableDd) {
        const vAtStart = vCmdAt(accelSegs, v0, rp.windowStart);
        const requiredOverM = lReq(deltaD, vAtStart, t_roll);
        return err(
          ineffectual(
            rp.staged.at,
            `position target unreachable in ${rp.over_m.toFixed(1)} m (need ≈ ${requiredOverM.toFixed(1)} m)`,
            "position_target_unreachable",
            {
              requested_dd_m: deltaD,
              achievable_dd_m: achievableDd,
              over_m: rp.over_m,
              required_over_m: requiredOverM
            }
          )
        );
      }
    }
    const action: ResolvedPositionAction = {
      do: "position",
      id: rp.staged.id,
      at_s: rp.staged.at_s,
      ...(rp.staged.f !== undefined ? { f: rp.staged.f } : { d: rp.staged.d as number }),
      over_m: rp.over_m
    };
    finalActions[rp.index] = action;
  }

  const plan: ValidatedPlanAction[] = finalActions.map((a) => a as ValidatedPlanAction);

  // -- config -----------------------------------------------------------------
  const configRaw = json["config"] ?? {};
  if (!isObject(configRaw)) return err(schemaErr("config", "config must be a JSON object", "type_mismatch"));
  let mu = CONFIG_MU_DEFAULT;
  if (configRaw["mu"] !== undefined) {
    const m = configRaw["mu"];
    if (typeof m !== "number") return err(schemaErr("config.mu", "mu must be a number", "type_mismatch"));
    if (!(m > 0)) return err(badRange("config.mu", "mu must be > 0", "config_mu_nonpositive"));
    mu = m;
  }
  let ds_m = CONFIG_DS_M_DEFAULT;
  if (configRaw["ds_m"] !== undefined) {
    const d = configRaw["ds_m"];
    if (typeof d !== "number" || !(d > 0)) return err(schemaErr("config.ds_m", "ds_m must be a positive number", "type_mismatch"));
    ds_m = d;
  }
  let ssd_model: SsdModel = CONFIG_SSD_MODEL_DEFAULT;
  if (configRaw["ssd_model"] !== undefined) {
    const s = configRaw["ssd_model"];
    if (typeof s !== "string" || !(SSD_MODELS as readonly string[]).includes(s)) {
      return err(schemaErr("config.ssd_model", `ssd_model must be one of ${SSD_MODELS.join(", ")}`, "type_mismatch"));
    }
    ssd_model = s as SsdModel;
  }
  let rubric = CONFIG_RUBRIC_DEFAULT;
  if (configRaw["rubric"] !== undefined) {
    const r = configRaw["rubric"];
    if (typeof r !== "string") return err(schemaErr("config.rubric", "rubric must be a string", "type_mismatch"));
    if (r !== CONFIG_RUBRIC_DEFAULT) {
      return err(unknownId("config.rubric", `unknown rubric "${r}" (known: ${CONFIG_RUBRIC_DEFAULT})`, "unknown_rubric"));
    }
    rubric = r;
  }
  if (configRaw["checks_version"] !== undefined) {
    const cv = configRaw["checks_version"];
    if (cv !== CONFIG_CHECKS_VERSION_DEFAULT) {
      return err(
        schemaErr(
          "config.checks_version",
          `checks_version must be ${CONFIG_CHECKS_VERSION_DEFAULT} (got ${JSON.stringify(cv)})`,
          "checks_version_unsupported"
        )
      );
    }
  }
  const config: ResolvedConfig = { mu, ds_m, ssd_model, rubric, checks_version: CONFIG_CHECKS_VERSION_DEFAULT };

  // -- expect_fail / meta -----------------------------------------------------
  let expect_fail: readonly string[] | undefined;
  if (json["expect_fail"] !== undefined) {
    const ef = json["expect_fail"];
    if (!Array.isArray(ef) || ef.some((x) => typeof x !== "string")) {
      return err(schemaErr("expect_fail", "expect_fail must be an array of strings", "type_mismatch"));
    }
    expect_fail = ef as readonly string[];
  }
  let meta: Readonly<Record<string, unknown>> | undefined;
  if (json["meta"] !== undefined) {
    const m = json["meta"];
    if (!isObject(m)) return err(schemaErr("meta", "meta must be a JSON object", "type_mismatch"));
    meta = m;
  }

  return ok({
    spec: "linelab/1",
    id,
    road: {
      lane_width_m: road.lane_width_m,
      bike_margin_m: road.bike_margin_m,
      use_full_width: road.use_full_width,
      segments: road.segments,
      dsl: road.dsl
    },
    occluders,
    hazards,
    rider: {
      profile,
      ...(roll_rate_cap_dps !== undefined ? { roll_rate_cap_dps } : {}),
      start: { speed_kmh, ...(start_f !== undefined ? { f: start_f } : { d: start_d as number }) },
      plan
    },
    config,
    ...(expect_fail !== undefined ? { expect_fail } : {}),
    ...(meta !== undefined ? { meta } : {})
  });
}

// ---------------------------------------------------------------------------
// The figure-level world — ONE declaration, because two callers must reach the
// SAME verdict on it: the BAKE (`solve/run.ts`'s `composeWorld`, which needs
// the resolved value) and the LINT (`check` / `figure --check`, which needs
// only the verdict).
//
// They diverged once, and the divergence is what this section exists to make
// impossible: a super-tight road (design/01 §8 — "≥ 170° of sweep accumulated
// at local radius ≤ 15 m … rejected `OUT_OF_SCOPE` at validation") linted
// `{valid: true}` as a `.scene` and refused only when `figure` went on to bake
// it, one verb later than that sentence allows, while the same road spelled as
// a wire Scenario refused here at `check` (figures/SCOPE.md §4, S11). The lint
// had no road build of its own; now it makes this call, so "the sole rejection
// point" is one point for figures too.

/**
 * The world half of a `FigureSpec` (design/03 §8): everything a figure declares
 * that is decidable before a single line is solved. A structural subset, so
 * both a whole `Figure` and a bare `{road}` satisfy it.
 */
export interface FigureWorldSpec {
  readonly road: RoadSpec;
  readonly occluders?: readonly Occluder[];
  readonly hazards?: readonly Hazard[];
}

/**
 * The probe entry speed the figure-world scenario carries. A figure's world is
 * validated with a rider that plans NOTHING, so no rule downstream of the road
 * / occluders / hazards can read this value — it exists only because
 * `rider.start.speed_kmh` is a required wire field. Inside the model-validity
 * band (02 §7) so the placeholder is never itself the reason for a refusal.
 */
const FIGURE_WORLD_PROBE_KMH = 30;

/**
 * `validate()` applied to a figure's world: its road, its occluders and its
 * hazards, under a rider that rides nothing. Returns the same
 * `ValidatedScenario` — resolved occluders/hazards at absolute stations — that
 * the bake's composed skeleton is built from, and the same typed error the bake
 * would have raised, at whichever verb asks first.
 */
export function validateFigureWorld(fig: FigureWorldSpec): Result<ValidatedScenario> {
  return validate({
    spec: "linelab/1",
    id: "figure",
    road: fig.road,
    ...(fig.occluders !== undefined ? { occluders: fig.occluders } : {}),
    ...(fig.hazards !== undefined ? { hazards: fig.hazards } : {}),
    rider: { start: { speed_kmh: FIGURE_WORLD_PROBE_KMH }, plan: [] }
  });
}
