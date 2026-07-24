// plan/doctrine/checks.ts — the 16 check evaluators of design/01 Appendix A,
// binding the closed metric vocabulary (metrics.ts, code) to pack thresholds
// and bands (parks-street.json, data).
//
// Evaluation law (design/01 §A.6, the D12 seam): code produces a closed BAND
// token per graded instance; the pack's `bands` table maps band → verdict.
// A pack cannot introduce arithmetic — it can only re-map bands and re-bind
// thresholds. `na` is a first-class verdict with a typed reason at
// `evidence.metrics.reason` — never a silently skipped instance, and never an
// asserted judgment the rubric refused.

import { G } from "../../core/constants.js";
import { msToKmh, degToRad } from "../../core/units.js";
import type { Sample } from "../../core/types.js";
import type {
  CheckResult,
  CheckVerdict,
  DoctrineBlock,
  DoctrineCorner,
  DoctrineRecord,
  RubricCheck,
  RubricPack
} from "./types.js";
import type { CornerWindow, MetricId } from "./metrics.js";
import {
  apexArgmin,
  apexPct,
  blindAtTurnIn,
  chainExtent,
  chainStructure,
  committedLeanDeg,
  cornerWindow,
  ellipseMax,
  exitSampleIndex,
  flowLegs,
  holdWideLegs,
  inputCount,
  leanMax,
  linkLegs,
  oioFractions,
  sightDeficit,
  steerShare,
  taperProfile,
  throttleLegs,
  trackerOverdrive
} from "./metrics.js";

// ---------------------------------------------------------------------------
// The catalogue — checks_version 2, 16 checks, closed set (design/01 §A.3,
// verbatim, catalogue order)

export const CHECK_IDS = [
  "late_apex",
  "out_in_out",
  "single_input",
  "quick_steer",
  "throttle_rule",
  "trail_brake_taper",
  "traction_ceiling",
  "lean_ceiling",
  "exit_containment",
  "stop_within_sight",
  "hold_wide_for_sight",
  "rideability",
  "link_continuity",
  "chain_containment",
  "chain_flow",
  "wrong_strategy_for_corner"
] as const;
export type CheckId = (typeof CHECK_IDS)[number];

/**
 * The metric each shipped check id consumes (code — a pack row binding a
 * different metric to one of these ids would be smuggling arithmetic and is
 * rejected at pack load). 16 checks over 14 metrics: checks 9 and 16 share
 * `oio_fractions` and `apex_pct` respectively.
 */
export const CHECK_METRIC: Readonly<Record<CheckId, MetricId>> = Object.freeze({
  late_apex: "apex_pct",
  out_in_out: "oio_fractions",
  single_input: "input_count",
  quick_steer: "steer_share",
  throttle_rule: "throttle_legs",
  trail_brake_taper: "taper_profile",
  traction_ceiling: "ellipse_max",
  lean_ceiling: "lean_max",
  exit_containment: "oio_fractions",
  stop_within_sight: "sight_deficit",
  hold_wide_for_sight: "hold_wide_legs",
  rideability: "tracker_overdrive",
  link_continuity: "link_legs",
  chain_containment: "chain_extent",
  chain_flow: "flow_legs",
  wrong_strategy_for_corner: "apex_pct"
});

/**
 * The scope of each shipped check id (design/01 §A.3 table, verbatim — code:
 * the evaluators emit instances of exactly this scope).
 */
export const CHECK_SCOPE: Readonly<Record<CheckId, "corner" | "pair" | "chain" | "line">> =
  Object.freeze({
    late_apex: "corner",
    out_in_out: "corner",
    single_input: "corner",
    quick_steer: "corner",
    throttle_rule: "corner",
    trail_brake_taper: "corner",
    traction_ceiling: "corner",
    lean_ceiling: "corner",
    exit_containment: "corner",
    stop_within_sight: "line",
    hold_wide_for_sight: "corner",
    rideability: "line",
    link_continuity: "pair",
    chain_containment: "chain",
    chain_flow: "chain",
    wrong_strategy_for_corner: "corner"
  });

/**
 * The band tokens each evaluator can produce (code). A loaded pack's `bands`
 * table must cover its check's tokens (validated at pack load; asserted by
 * A-CATALOGUE-RESOLVES).
 */
export const CHECK_BANDS: Readonly<Record<CheckId, readonly string[]>> = Object.freeze({
  late_apex: ["past_bar", "before_bar"],
  out_in_out: ["shape_met", "shape_broken"],
  single_input: ["within_allowance", "extra_input", "fifty_pence", "no_input"],
  quick_steer: ["quick", "slow_leg", "eats_corner"],
  throttle_rule: ["disciplined", "warn_leg", "fail_leg"],
  trail_brake_taper: ["tapered", "ate_reserve", "forced_standup"],
  traction_ceiling: ["within_ellipse", "exceeded"],
  lean_ceiling: ["within_reserve", "ate_reserve", "beyond_ceiling"],
  exit_containment: ["contained", "escaped"],
  stop_within_sight: ["margin_ok", "thin_margin", "deficit"],
  hold_wide_for_sight: ["held_wide", "drifted_early", "committed_closing", "cut_in_early"],
  rideability: ["rideable", "overdriven"],
  link_continuity: ["linked", "broken"],
  chain_containment: ["contained", "escaped"],
  chain_flow: ["flowing", "broken"],
  wrong_strategy_for_corner: ["single_late_apex", "double_blind_slow", "double_on_dr"]
});

/**
 * The threshold NAMES each check's checks_version-2 arithmetic consumes (code
 * — the data side is the values a pack binds to them). The loader validates
 * every row binds every name listed here (SCHEMA/thresholds_incomplete),
 * symmetric with band-token completeness: a legal variant pack can re-bind a
 * threshold but can never silently omit one — thresholdValue's NaN fallback is
 * unreachable through loadRubricPack.
 */
export const CHECK_THRESHOLDS: Readonly<Record<CheckId, readonly string[]>> = Object.freeze({
  late_apex: ["APEX_PCT_BAR_DECREASING", "APEX_PCT_BAR_CONSTANT"],
  out_in_out: ["OIO_OUTSIDE_MIN", "OIO_INSIDE_MAX", "OIO_SWING_MIN"],
  single_input: [],
  quick_steer: ["QS_SHARE_FAIL", "QS_SHARE_WARN", "QS_TIME_WARN", "SMALL_LEAN_DEG"],
  throttle_rule: [
    "THR_EPS",
    "CRACK_EARLY_FRAC",
    "ROLLON_LATE_FRAC",
    "RATE_THRESHOLD",
    "CHOP_TOL",
    "SMALL_LEAN_DEG"
  ],
  trail_brake_taper: ["TB_PHI_MIN", "REDEEPEN_TOL", "RESID_FRAC", "A_SU_ONSET"],
  traction_ceiling: ["eps_mag"],
  lean_ceiling: ["BLIND_RESERVE_DEG"],
  exit_containment: [],
  stop_within_sight: ["SIGHT_WARN_M"],
  hold_wide_for_sight: ["HOLD_WINDOW_FRAC", "RELEASE_TOL_M", "HOLD_F_MIN"],
  rideability: ["RATE_TOL_DPS", "KAPPA_STEP", "PHI_JUMP"],
  link_continuity: ["LINK_ENTRY_OUTER_MIN", "LINK_BRAKE_RESET"],
  chain_containment: ["EPS_F"],
  chain_flow: ["SMALL_LEAN_DEG"],
  wrong_strategy_for_corner: ["DR_RATIO_MIN", "DR_ALT_SPEED_MARGIN"]
});

// Unnamed design literals with local names, no TUNING status (ARCHITECTURE §6.6)
const EXIT_F_BAR = 1.0; // check 9: pass iff f(exit sample) < 1.0
const HOLD_WARN_BAND_F = 0.15; // check 11 warn band width below HOLD_F_MIN

// ---------------------------------------------------------------------------
// Evaluation plumbing

interface Instance {
  readonly corner_id: string | null;
  readonly pair: readonly [string, string] | null;
  /** band token, or null for na */
  readonly band: string | null;
  /** typed na reason when band is null */
  readonly na_reason?: string;
  readonly message: string;
  readonly at_s?: number;
  readonly metrics?: Readonly<Record<string, unknown>>;
}

function thresholdValue(row: RubricCheck, name: string): number {
  const entry = row.thresholds[name];
  // The loader validates per-check threshold-name completeness against
  // CHECK_THRESHOLDS (SCHEMA/thresholds_incomplete), so this NaN fallback is
  // unreachable through loadRubricPack — it remains only as a defensive
  // never-invent-a-value guard for a hand-built RubricCheck.
  return entry ? entry.value : Number.NaN;
}

function naInstance(
  cornerId: string | null,
  pair: readonly [string, string] | null,
  reason: string,
  message: string
): Instance {
  return {
    corner_id: cornerId,
    pair,
    band: null,
    na_reason: reason,
    message,
    metrics: { reason }
  };
}

/** Ridden corner windows, in corner order (null → not-reached na). */
function windowsOf(record: DoctrineRecord): readonly (CornerWindow | null)[] {
  return record.corners.map((c) => cornerWindow(record, c));
}

// ---------------------------------------------------------------------------
// The per-check evaluators (catalogue order). Each returns instances; band
// tokens are mapped to verdicts through the pack's bands table by runChecks.

type Evaluator = (
  record: DoctrineRecord,
  row: RubricCheck,
  ctx: EvalContext
) => readonly Instance[];

interface EvalContext {
  readonly windows: readonly (CornerWindow | null)[];
  readonly chainModeCornerIds: ReadonlySet<string>;
  readonly geometricPairs: readonly (readonly [number, number])[];
}

function cornerInstances(
  record: DoctrineRecord,
  ctx: EvalContext,
  row: RubricCheck,
  gradeOne: (w: CornerWindow, c: DoctrineCorner) => Instance
): readonly Instance[] {
  const out: Instance[] = [];
  for (let i = 0; i < record.corners.length; i++) {
    const c = record.corners[i] as DoctrineCorner;
    const trend = row.applicability.corner_trend;
    if (trend && !trend.includes(c.type)) {
      out.push(
        naInstance(c.id, null, `${c.type}_radius`, `not applicable on ${c.type}-radius corner`)
      );
      continue;
    }
    const w = ctx.windows[i] ?? null;
    if (w === null) {
      out.push(naInstance(c.id, null, "corner_not_reached", "line never rides this corner"));
      continue;
    }
    if (row.applicability.requires_blind) {
      const blind = blindAtTurnIn(record, c);
      if (blind !== true) {
        out.push(
          naInstance(
            c.id,
            null,
            "not_blind",
            "corner is not blind at this line's turn-in (blind(c) false)"
          )
        );
        continue;
      }
    }
    out.push(gradeOne(w, c));
  }
  return out;
}

const evaluators: Record<CheckId, Evaluator> = {
  // 1 ------------------------------------------------------------------------
  late_apex: (record, row, ctx) =>
    cornerInstances(record, ctx, row, (w, c) => {
      const m = apexPct(record, w);
      if (m.graded_pct === null) {
        // Empty recorded apex list AND no honest sweep denominator (arc corner,
        // no completed heading capture): §A.2's apex_pct is not measurable from
        // this record — refused with a typed na, never a fabricated 0 %
        // (design/01 §8 refusal-over-fabrication at check granularity).
        return naInstance(
          c.id,
          null,
          "sweep_unmeasurable",
          "no recorded apex and the corner's total sweep is not measurable from this record"
        );
      }
      const pct = m.graded_pct;
      const bar =
        c.type === "decreasing"
          ? thresholdValue(row, "APEX_PCT_BAR_DECREASING")
          : thresholdValue(row, "APEX_PCT_BAR_CONSTANT");
      const band = pct > bar ? "past_bar" : "before_bar";
      return {
        corner_id: c.id,
        pair: null,
        band,
        message:
          band === "past_bar"
            ? `apex at ${pct.toFixed(1)}% of sweep, past the ${bar}% bar`
            : `apex at ${pct.toFixed(1)}% of sweep, before the ${bar}% bar`,
        at_s: m.graded_s,
        metrics: { apex_pct: pct, bar }
      };
    }),

  // 2 ------------------------------------------------------------------------
  out_in_out: (record, row, ctx) =>
    cornerInstances(record, ctx, row, (w, c) => {
      const chained = ctx.chainModeCornerIds.has(c.id);
      const doubleApex = record.declared_style === "double_apex";
      const m = oioFractions(record, w, chained, doubleApex);
      const outMin = thresholdValue(row, "OIO_OUTSIDE_MIN");
      const inMax = thresholdValue(row, "OIO_INSIDE_MAX");
      const swingMin = thresholdValue(row, "OIO_SWING_MIN");
      if (m.ti_f === null) {
        return naInstance(c.id, null, "no_turn_in", "no turn_in event recorded for this corner");
      }
      let met: boolean;
      let note = "";
      if (chained) {
        met = m.ti_f >= outMin && m.apex_f <= inMax;
        note = " — exit leg waived (chained)";
      } else {
        met =
          m.exit_f !== null &&
          m.ti_f >= outMin &&
          m.apex_f <= inMax &&
          m.exit_f >= outMin &&
          Math.max(m.ti_f, m.exit_f) - m.apex_f >= swingMin;
      }
      return {
        corner_id: c.id,
        pair: null,
        band: met ? "shape_met" : "shape_broken",
        message: (met ? "out-in-out shape met" : "out-in-out shape broken") + note,
        metrics: { ti_f: m.ti_f, apex_f: m.apex_f, exit_f: m.exit_f, chained }
      };
    }),

  // 3 ------------------------------------------------------------------------
  single_input: (record, row, ctx) =>
    cornerInstances(record, ctx, row, (w, c) => {
      const count = inputCount(record, w);
      const doubleApex = record.declared_style === "double_apex";
      const allowed = doubleApex ? 2 : 1;
      // §A.3 check 3: count ≥ 3 always fails regardless of declaration (the
      // anti-gaming rule). Single-apex: pass iff count = 1 — zero commanded
      // inputs is the no_input fail. Declared double_apex: pass iff count ≤ 2
      // INCLUDING 0 — the letter's "≤ 2" has no lower bound.
      const band =
        count >= 3
          ? "fifty_pence"
          : doubleApex
            ? "within_allowance"
            : count === 0
              ? "no_input"
              : count === 1
                ? "within_allowance"
                : "extra_input";
      return {
        corner_id: c.id,
        pair: null,
        band,
        message: `${count} steering input(s), ${allowed} allowed`,
        metrics: { count, allowed }
      };
    }),

  // 4 ------------------------------------------------------------------------
  quick_steer: (record, row, ctx) =>
    cornerInstances(record, ctx, row, (w, c) => {
      const m = steerShare(record, w);
      const smallLean = thresholdValue(row, "SMALL_LEAN_DEG");
      if (m.phi_c_deg < smallLean) {
        return naInstance(c.id, null, "no_real_steering", "committed lean below SMALL_LEAN_DEG");
      }
      if (m.sc_s === null) {
        // Steering never completed inside the record [ADJUDICATED — see
        // metrics.steerShare]: the roll-in ate every ridden metre of the
        // corner and was still incomplete at line end. §A.4 mandates this
        // fail for the capped rider (slow_steer → quick_steer); the recorded
        // steer_share is the ridden-extent lower bound.
        return {
          corner_id: c.id,
          pair: null,
          band: "eats_corner",
          message: "roll-in never completed inside the record — it ate every ridden metre of the corner",
          metrics: {
            steer_share: m.steer_share,
            dt_steer_s: null,
            phi_c_deg: m.phi_c_deg,
            roll_in_completed: false
          }
        };
      }
      const shareFail = thresholdValue(row, "QS_SHARE_FAIL");
      const shareWarn = thresholdValue(row, "QS_SHARE_WARN");
      const timeWarn = thresholdValue(row, "QS_TIME_WARN");
      const band =
        m.steer_share > shareFail
          ? "eats_corner"
          : m.steer_share > shareWarn || (m.dt_steer_s !== null && m.dt_steer_s > timeWarn)
            ? "slow_leg"
            : "quick";
      return {
        corner_id: c.id,
        pair: null,
        band,
        message: `roll-in ate ${(m.steer_share * 100).toFixed(0)}% of the corner`,
        at_s: m.sc_s,
        metrics: {
          steer_share: m.steer_share,
          dt_steer_s: m.dt_steer_s,
          phi_c_deg: m.phi_c_deg
        }
      };
    }),

  // 5 ------------------------------------------------------------------------
  throttle_rule: (record, row, ctx) =>
    cornerInstances(record, ctx, row, (w, c) => {
      const m = throttleLegs(record, w, {
        thr_eps: thresholdValue(row, "THR_EPS"),
        crack_early_frac: thresholdValue(row, "CRACK_EARLY_FRAC"),
        rollon_late_frac: thresholdValue(row, "ROLLON_LATE_FRAC"),
        rate_threshold: thresholdValue(row, "RATE_THRESHOLD"),
        chop_tol: thresholdValue(row, "CHOP_TOL"),
        small_lean_deg: thresholdValue(row, "SMALL_LEAN_DEG")
      });
      const failLeg = !m.vmin_ok || !m.discipline_ok;
      const warnLeg = !m.crack_ok || !m.rollon_ok;
      const band = failLeg ? "fail_leg" : warnLeg ? "warn_leg" : "disciplined";
      const missed = [
        !m.crack_ok ? "crack" : null,
        !m.vmin_ok ? "v_min" : null,
        !m.rollon_ok ? "roll_on" : null,
        !m.discipline_ok ? "discipline" : null
      ].filter((x): x is string => x !== null);
      return {
        corner_id: c.id,
        pair: null,
        band,
        message: missed.length === 0 ? "throttle rule held" : `missed legs: ${missed.join(", ")}`,
        metrics: { ...m.detail, missed }
      };
    }),

  // 6 ------------------------------------------------------------------------
  trail_brake_taper: (record, row, ctx) =>
    cornerInstances(record, ctx, row, (w, c) => {
      const m = taperProfile(record, w, {
        tb_phi_min: thresholdValue(row, "TB_PHI_MIN"),
        redeepen_tol: thresholdValue(row, "REDEEPEN_TOL"),
        resid_frac: thresholdValue(row, "RESID_FRAC"),
        a_su_onset: thresholdValue(row, "A_SU_ONSET")
      });
      if (m.baseline) {
        return naInstance(
          c.id,
          null,
          "brake_complete_baseline",
          "entry braking completes at least brake_gap before turn-in"
        );
      }
      if (m.forced_standup_at_s !== null || m.redeepened_at_s !== null) {
        const atS = m.forced_standup_at_s ?? m.redeepened_at_s ?? undefined;
        return {
          corner_id: c.id,
          pair: null,
          band: "forced_standup",
          message:
            m.forced_standup_at_s !== null
              ? "braking hard enough to force stand-up at lean"
              : "brake re-deepened after its peak",
          ...(atS !== undefined ? { at_s: atS } : {}),
          metrics: {
            forced_standup_at_s: m.forced_standup_at_s,
            redeepened_at_s: m.redeepened_at_s
          }
        };
      }
      if (m.resid_exceeded || m.ate_reserve_at_s !== null) {
        return {
          corner_id: c.id,
          pair: null,
          band: "ate_reserve",
          message: m.resid_exceeded
            ? "residual decel at apex above RESID_FRAC of peak"
            : "leaned braking ate the stand-up reserve",
          ...(m.ate_reserve_at_s !== null ? { at_s: m.ate_reserve_at_s } : {}),
          metrics: { resid_exceeded: m.resid_exceeded, ate_reserve_at_s: m.ate_reserve_at_s }
        };
      }
      return {
        corner_id: c.id,
        pair: null,
        band: "tapered",
        message: "trail brake tapered below stand-up authority",
        metrics: {}
      };
    }),

  // 7 ------------------------------------------------------------------------
  traction_ceiling: (record, row, ctx) =>
    cornerInstances(record, ctx, row, (w, c) => {
      const m = ellipseMax(record, w);
      const eps = thresholdValue(row, "eps_mag");
      const exceeded = m.max_mag > 1 + eps || m.crash_in_window;
      return {
        corner_id: c.id,
        pair: null,
        band: exceeded ? "exceeded" : "within_ellipse",
        message: exceeded
          ? m.crash_in_window
            ? "crash event inside the corner window"
            : "friction ellipse exceeded"
          : "within the friction ellipse",
        at_s: m.at_s,
        metrics: { ellipse_max: m.max_mag, crash_in_window: m.crash_in_window }
      };
    }),

  // 8 ------------------------------------------------------------------------
  lean_ceiling: (record, row, ctx) =>
    cornerInstances(record, ctx, row, (w, c) => {
      const m = leanMax(record, w);
      const blindCap = thresholdValue(row, "BLIND_RESERVE_DEG");
      const blind = blindAtTurnIn(record, c) === true;
      const reserve = blind
        ? Math.min(record.physics.phi_reserve_deg, blindCap)
        : record.physics.phi_reserve_deg;
      const ceiling = record.physics.phi_max_deg;
      const band =
        m.phi_max_deg <= reserve
          ? "within_reserve"
          : m.phi_max_deg <= ceiling
            ? "ate_reserve"
            : "beyond_ceiling";
      return {
        corner_id: c.id,
        pair: null,
        band,
        message: `peak lean ${m.phi_max_deg.toFixed(1)}° vs reserve ${reserve.toFixed(1)}°, ceiling ${ceiling.toFixed(1)}°`,
        at_s: m.at_s,
        metrics: { phi_max_deg: m.phi_max_deg, reserve_deg: reserve, ceiling_deg: ceiling, blind }
      };
    }),

  // 9 ------------------------------------------------------------------------
  exit_containment: (record, row, ctx) =>
    cornerInstances(record, ctx, row, (w, c) => {
      const chained = ctx.chainModeCornerIds.has(c.id);
      // off_road termination before the exit sample exists → fail citing the
      // crossing station (design/01 §A.3 check 9)
      if (
        record.terminated.reason === "off_road" &&
        !w.exit &&
        record.terminated.s <= c.s1
      ) {
        return {
          corner_id: c.id,
          pair: null,
          band: "escaped",
          message: "terminated off-road before the exit sample",
          at_s: record.terminated.s,
          metrics: { crossing_s: record.terminated.s }
        };
      }
      const exIdx = exitSampleIndex(record, w, chained);
      if (exIdx === null) {
        return naInstance(c.id, null, "no_exit_sample", "no exit sample exists");
      }
      const f = (record.samples[exIdx] as Sample).f;
      const contained = f < EXIT_F_BAR;
      return {
        corner_id: c.id,
        pair: null,
        band: contained ? "contained" : "escaped",
        message: contained
          ? `exit lane fraction ${f.toFixed(2)} < 1`
          : `exit lane fraction ${f.toFixed(2)} ≥ 1`,
        at_s: (record.samples[exIdx] as Sample).s,
        metrics: { exit_f: f, at_link_station: chained }
      };
    }),

  // 10 -----------------------------------------------------------------------
  stop_within_sight: (record, row) => {
    if (record.vertically_blind === true) {
      return [
        naInstance(null, null, "vertical_sight_geometry_not_modelled", "vertical sight geometry not modelled")
      ];
    }
    if (record.samples.length === 0) {
      return [naInstance(null, null, "no_samples", "record has no samples")];
    }
    const m = sightDeficit(record);
    const warnM = thresholdValue(row, "SIGHT_WARN_M");
    const band =
      m.max_deficit_m > 0 ? "deficit" : m.min_margin_m < warnM ? "thin_margin" : "margin_ok";
    return [
      {
        corner_id: null,
        pair: null,
        band,
        message:
          band === "deficit"
            ? `stopping distance exceeds sight by ${m.max_deficit_m.toFixed(1)} m`
            : band === "thin_margin"
              ? `sight margin thin: ${m.min_margin_m.toFixed(1)} m`
              : "stopping distance fits inside sight at every station",
        ...(m.worst ? { at_s: m.worst.s } : {}),
        metrics: {
          max_deficit_m: m.max_deficit_m,
          min_margin_m: m.min_margin_m,
          worst: m.worst
        }
      }
    ];
  },

  // 11 -----------------------------------------------------------------------
  hold_wide_for_sight: (record, row, ctx) => {
    if (record.vertically_blind === true) {
      return record.corners.map((c) =>
        naInstance(c.id, null, "vertical_sight_geometry_not_modelled", "vertical sight geometry not modelled")
      );
    }
    return cornerInstances(record, ctx, row, (w, c) => {
      const m = holdWideLegs(record, w, {
        hold_window_frac: thresholdValue(row, "HOLD_WINDOW_FRAC"),
        release_tol_m: thresholdValue(row, "RELEASE_TOL_M")
      });
      const holdFMin = thresholdValue(row, "HOLD_F_MIN");
      const releaseTol = thresholdValue(row, "RELEASE_TOL_M");
      const committedClosing =
        m.release_s === null || m.turn_in_s < m.release_s - releaseTol;
      if (committedClosing) {
        return {
          corner_id: c.id,
          pair: null,
          band: "committed_closing",
          message: "committed while the sight line was still closing",
          at_s: m.turn_in_s,
          metrics: { release_s: m.release_s, turn_in_s: m.turn_in_s }
        };
      }
      if (m.min_f_nonopening !== null && m.min_f_nonopening < holdFMin) {
        const warnFloor = holdFMin - HOLD_WARN_BAND_F;
        const band = m.min_f_nonopening >= warnFloor ? "drifted_early" : "cut_in_early";
        return {
          corner_id: c.id,
          pair: null,
          band,
          message:
            band === "drifted_early"
              ? "drifted in early while the corner was still blind"
              : "cut in while the corner was still blind",
          metrics: { min_f: m.min_f_nonopening, hold_f_min: holdFMin }
        };
      }
      return {
        corner_id: c.id,
        pair: null,
        band: "held_wide",
        message: "held wide until the sight line released",
        metrics: { release_s: m.release_s, min_f: m.min_f_nonopening }
      };
    });
  },

  // 12 -----------------------------------------------------------------------
  rideability: (record, row) => {
    if (record.samples.length < 2) {
      return [naInstance(null, null, "no_samples", "record too short to grade")];
    }
    const m = trackerOverdrive(record);
    const rateTol = thresholdValue(row, "RATE_TOL_DPS");
    const kappaStep = thresholdValue(row, "KAPPA_STEP");
    const phiJump = thresholdValue(row, "PHI_JUMP");
    const overdriven =
      m.max_excess_dps > rateTol || m.max_dkappa > kappaStep || m.phi_jump_deg > phiJump;
    const why = [
      m.max_excess_dps > rateTol ? "tracker overdrive" : null,
      m.max_dkappa > kappaStep ? "kappa teleport" : null,
      m.phi_jump_deg > phiJump ? "phi teleport" : null
    ].filter((x): x is string => x !== null);
    return [
      {
        corner_id: null,
        pair: null,
        band: overdriven ? "overdriven" : "rideable",
        message: overdriven ? why.join(", ") : "kinematically rideable",
        ...(m.excess_at_s !== null && m.max_excess_dps > rateTol
          ? { at_s: m.excess_at_s }
          : {}),
        metrics: {
          max_excess_dps: m.max_excess_dps,
          max_dkappa: m.max_dkappa,
          phi_jump_deg: m.phi_jump_deg
        }
      }
    ];
  },

  // 13 -----------------------------------------------------------------------
  link_continuity: (record, row, ctx) => {
    if (ctx.geometricPairs.length === 0) {
      return [naInstance(null, null, "no_linked_pair", "no linked pair on road")];
    }
    const linkBrakeReset = thresholdValue(row, "LINK_BRAKE_RESET");
    const entryOuterMin = thresholdValue(row, "LINK_ENTRY_OUTER_MIN");
    return ctx.geometricPairs.map(([i, j]) => {
      const c = record.corners[i] as DoctrineCorner;
      const next = record.corners[j] as DoctrineCorner;
      const m = linkLegs(record, c, next);
      const legA = m.entry_f !== null && m.entry_f >= entryOuterMin;
      const legB = m.peak_brake !== null && m.peak_brake <= linkBrakeReset;
      // (c) one flick — design/01 §A.3 check 13's parenthetical implemented as
      // the binding refinement of the "≤ 1 local extremum" headline (DELIBERATE
      // reading, flagged for design ratification): the tolerated extremum set
      // is per hand configuration — alternating hands tolerate at most the one
      // flick MINIMUM (a lone maximum is an extra input, not a flick); same
      // hand tolerates none. ≥ 2 extrema always fail (inter-corner
      // fifty-pencing). Zero extrema pass in BOTH configurations: "exactly one
      // minimum" is read as naming the tolerated shape, not mandating its
      // presence — a late flick is graded by the entry-side leg and check 15's
      // rhythm, never manufactured into a leg-(c) fail.
      const legC = m.hands_alternate
        ? m.extrema_count === 0 ||
          (m.extrema_count === 1 && m.extrema_kinds[0] === "min")
        : m.extrema_count === 0;
      const linked = legA && legB && legC;
      const missed = [
        !legA ? "entry_side" : null,
        !legB ? "brake_reset" : null,
        !legC ? "one_flick" : null
      ].filter((x): x is string => x !== null);
      return {
        corner_id: null,
        pair: [c.id, next.id] as const,
        band: linked ? "linked" : "broken",
        message: linked ? "exit sets up the next entry" : `link broken: ${missed.join(", ")}`,
        metrics: {
          entry_f: m.entry_f,
          peak_brake: m.peak_brake,
          extrema_count: m.extrema_count
        }
      };
    });
  },

  // 14 -----------------------------------------------------------------------
  chain_containment: (record, row, ctx) => {
    const chainWs = chainSpanWindows(record, ctx);
    if (chainWs === null) {
      return [naInstance(null, null, "no_chain", "no chain-mode corner on this line")];
    }
    const epsF = thresholdValue(row, "EPS_F");
    const m = chainExtent(record, chainWs.sFrom, chainWs.sTo);
    const contained = m.max_f <= 1 + epsF && m.min_f >= -epsF;
    return [
      {
        corner_id: null,
        pair: null,
        band: contained ? "contained" : "escaped",
        message: contained
          ? "chain stays in the corridor"
          : `chain leaves the corridor on the ${m.worst_side} side`,
        at_s: m.worst_s,
        metrics: { max_f: m.max_f, min_f: m.min_f, worst_side: m.worst_side }
      }
    ];
  },

  // 15 -----------------------------------------------------------------------
  chain_flow: (record, row, ctx) => {
    const chainWs = chainSpanWindows(record, ctx);
    if (chainWs === null) {
      return [naInstance(null, null, "no_chain", "no chain-mode corner on this line")];
    }
    const m = flowLegs(record, chainWs.windows, thresholdValue(row, "SMALL_LEAN_DEG"));
    const rhythmOk = m.rhythm_sign_changes === m.hand_alternations;
    const flowing = m.vmin_ok && m.gap_ok && rhythmOk;
    const missed = [
      !m.vmin_ok ? "slow_in" : null,
      !m.gap_ok ? "gap_throttle" : null,
      !rhythmOk ? "rhythm" : null
    ].filter((x): x is string => x !== null);
    return [
      {
        corner_id: null,
        pair: null,
        band: flowing ? "flowing" : "broken",
        message: flowing ? "one rhythm through the sequence" : `flow broken: ${missed.join(", ")}`,
        metrics: {
          rhythm_sign_changes: m.rhythm_sign_changes,
          hand_alternations: m.hand_alternations
        }
      }
    ];
  },

  // 16 -----------------------------------------------------------------------
  wrong_strategy_for_corner: (record, row, ctx) => {
    const out: Instance[] = [];
    const drRatioMin = thresholdValue(row, "DR_RATIO_MIN");
    const speedMargin = thresholdValue(row, "DR_ALT_SPEED_MARGIN");
    // Applicability (§A.6: keys are code, VALUES are data): the trend filter is
    // the pack row's declared corner_trend binding — a variant pack re-binding
    // it changes which corners this check grades. The r1/r2 ≥ DR_RATIO_MIN
    // measurement is code; the bar is a pack threshold. Both gates share the
    // check's design-pinned na evidence token, not_a_dr_corner (§A.3 check 16 —
    // which is why this evaluator does not route through cornerInstances'
    // generic `<type>_radius` reason).
    const trend = row.applicability.corner_trend;
    for (let i = 0; i < record.corners.length; i++) {
      const c = record.corners[i] as DoctrineCorner;
      const trendOk = trend === undefined || trend.includes(c.type);
      const isDr =
        c.r1 !== undefined && c.r2 !== undefined && c.r2 > 0 && c.r1 / c.r2 >= drRatioMin;
      if (!trendOk || !isDr) {
        out.push(naInstance(c.id, null, "not_a_dr_corner", "not a decreasing-radius corner"));
        continue;
      }
      const w = ctx.windows[i] ?? null;
      if (w === null) {
        out.push(naInstance(c.id, null, "corner_not_reached", "line never rides this corner"));
        continue;
      }
      const m = apexPct(record, w);
      if (m.count < 2) {
        out.push({
          corner_id: c.id,
          pair: null,
          band: "single_late_apex",
          message: "single-apex strategy on the decreasing-radius corner",
          metrics: { apex_count: m.count, apexes_s: m.apexes_s, corner_id: c.id }
        });
        continue;
      }
      // The fig 8.4 caption carve-out: blind at commitment AND significantly slower
      const tiIdx = w.turn_in ? nearestIdx(record.samples, w.turn_in.s) : null;
      const tiSample = tiIdx !== null ? (record.samples[tiIdx] as Sample) : null;
      const blindAtCommit =
        tiSample !== null && w.turn_in !== null
          ? tiSample.sight_m < c.s1 - w.turn_in.s
          : false;
      const vReserve =
        (c.r2 ?? 0) > 0
          ? Math.sqrt(G * Math.tan(degToRad(record.physics.phi_reserve_deg)) * (c.r2 as number))
          : 0;
      const slowEnough = tiSample !== null && tiSample.v <= speedMargin * vReserve;
      const band = blindAtCommit && slowEnough ? "double_blind_slow" : "double_on_dr";
      out.push({
        corner_id: c.id,
        pair: null,
        band,
        message:
          band === "double_blind_slow"
            ? "double-apex strategy sanctioned: blind at commitment and significantly slower"
            : "double-apex strategy ridden on a decreasing-radius corner",
        ...(w.turn_in ? { at_s: w.turn_in.s } : {}),
        metrics: {
          apex_count: m.count,
          apexes_s: m.apexes_s,
          corner_id: c.id,
          blind_at_turn_in: blindAtCommit,
          v_turn_in_kmh: tiSample !== null ? msToKmh(tiSample.v) : null,
          v_reserve_kmh: msToKmh(vReserve),
          book_note:
            "In the case of blind corners, if you don’t know if it is a decreasing radius, you can take either path shown but at a significantly lower speed."
        }
      });
    }
    return out;
  }
};

function nearestIdx(samples: readonly Sample[], s: number): number | null {
  if (samples.length === 0) return null;
  let best = 0;
  let bestD = Number.POSITIVE_INFINITY;
  for (let i = 0; i < samples.length; i++) {
    const d = Math.abs((samples[i] as Sample).s - s);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}

/** Chain span: first chained corner's turn-in to the last chain corner's exit sample. */
function chainSpanWindows(
  record: DoctrineRecord,
  ctx: EvalContext
): { readonly sFrom: number; readonly sTo: number; readonly windows: readonly CornerWindow[] } | null {
  if (ctx.chainModeCornerIds.size === 0) return null;
  // Chain member corners: every chain-mode corner plus each one's successor.
  const memberIdx = new Set<number>();
  for (let i = 0; i < record.corners.length; i++) {
    const c = record.corners[i] as DoctrineCorner;
    if (ctx.chainModeCornerIds.has(c.id)) {
      memberIdx.add(i);
      if (i + 1 < record.corners.length) memberIdx.add(i + 1);
    }
  }
  const windows: CornerWindow[] = [];
  for (const i of [...memberIdx].sort((a, b) => a - b)) {
    const w = ctx.windows[i] ?? null;
    if (w !== null) windows.push(w);
  }
  if (windows.length === 0) return null;
  const first = windows[0] as CornerWindow;
  const last = windows[windows.length - 1] as CornerWindow;
  const exIdx = exitSampleIndex(record, last, false);
  const sTo = exIdx !== null ? (record.samples[exIdx] as Sample).s : last.s_hi;
  return { sFrom: first.s_lo, sTo, windows };
}

// ---------------------------------------------------------------------------
// runChecks — the DoctrineBlock assembler

/**
 * Grade one finished record under one loaded pack. Pure and total: it never
 * throws, never mutates the record, and asserts nothing the rubric refused
 * (`na` is first-class). Pack rows ride in pack order; per-row instances in
 * corner/pair order.
 */
export function runChecks(record: DoctrineRecord, pack: RubricPack): DoctrineBlock {
  // Chain applicability is computed ONCE (design/01 §A.3): LINK_BRAKE_RESET is
  // read from the pack's link_continuity row (the one binding that owns it).
  const linkRow = pack.checks.find((r) => r.id === "link_continuity");
  const linkBrakeReset = linkRow?.thresholds["LINK_BRAKE_RESET"]?.value ?? Number.NaN;
  const chain = chainStructure(record, linkBrakeReset);
  const ctx: EvalContext = {
    windows: windowsOf(record),
    chainModeCornerIds: chain.chainModeCornerIds,
    geometricPairs: chain.geometricPairs
  };
  const results: CheckResult[] = [];
  for (const row of pack.checks) {
    const evaluator = evaluators[row.id as CheckId];
    if (!evaluator) continue; // loader guarantees; skip defensively, never invent
    const instances = evaluator(record, row, ctx);
    for (const inst of instances) {
      let verdict: CheckVerdict;
      if (inst.band === null) {
        verdict = "na";
      } else {
        verdict = row.bands[inst.band] ?? "na";
        // design/01 §A.1 severity law: "advisory — worst verdict is warn; never
        // blocks green." Severity is pack DATA, so the law must bind every
        // loadable pack: an advisory row's bands can map to fail, but the
        // emitted verdict clamps to warn — it can never trip clean() or exit 3.
        if (row.severity === "advisory" && verdict === "fail") verdict = "warn";
      }
      results.push({
        id: row.id,
        scope: row.scope,
        corner_id: inst.corner_id,
        pair: inst.pair,
        verdict,
        evidence: {
          message: inst.message,
          ...(inst.at_s !== undefined ? { at_s: inst.at_s } : {}),
          ...(inst.metrics !== undefined ? { metrics: inst.metrics } : {})
        }
      });
    }
  }
  let pass = 0;
  let fail = 0;
  let warn = 0;
  let na = 0;
  for (const r of results) {
    if (r.verdict === "pass") pass++;
    else if (r.verdict === "fail") fail++;
    else if (r.verdict === "warn") warn++;
    else na++;
  }
  return { pass, fail, warn, na, checks: results };
}
