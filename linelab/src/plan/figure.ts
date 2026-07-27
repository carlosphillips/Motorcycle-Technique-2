// plan/figure.ts — FigureSpec (design/03 §8; D30) shape-level validation, and
// specHash (D30; ARCHITECTURE §6.3, §6.6). `FigureSpec` IS `Figure`
// (plan/types.ts) — D30's "canonical figure spelling" is the SAME wire shape
// `lowerScene` (plan/scene.ts) produces, so this file's validator accepts
// hand-authored FigureSpec JSON to the identical shape scene.ts constructs by
// construction, and `specHash` hashes either origin identically (the
// A-FIGURE-JSON-PARITY precursor: same lowered value → same hash, regardless
// of which authoring surface produced it).
//
// Scope discipline (ARCHITECTURE §4): `view` is validated only for PRESENCE —
// its key/value semantics belong to render/, which plan/ never imports (avoids
// a plan→render dependency); `view` rides through as opaque data. Anchor and
// placement RESOLUTION (station arithmetic against a composed road) is NOT this
// file's job — validateFigureSpec is explicitly "shape-level" (the brief's own
// words): it checks that occluders/hazards/labels/plan actions have the right
// JSON shape, never that an anchor's corner id actually exists on a composed
// road. That semantic step is plan/validate.ts's (per-Scenario, WP-05) and,
// for figure-level anchors, a later solve/render composition step (not yet
// built) — this file only guarantees the JSON has the shape those stages need.

import type { Result, LinelabError } from "../core/result.js";
import { ok, err } from "../core/result.js";
import type { Hand } from "../core/types.js";
import type { Segment, RoadSpec } from "../road/types.js";
import { PRESET_NAMES } from "../road/presets.js";
import { MISTAKE_KINDS } from "./mistakes.js";
import type {
  Figure,
  FigureSpec,
  FigureLine,
  FigureLabel,
  FigureRole,
  LabelFeature,
  MarkClass,
  MarkSpec,
  Occluder,
  Hazard,
  WireAnchor,
  SolveSpec,
  MistakeSpec,
  Scenario,
  SolveStyle,
  VisMode,
  AcceptPolicy,
  Constraint,
  ConstraintBound
} from "./types.js";
import { canonicalize, fnv1a } from "../core/hash.js";

// ---------------------------------------------------------------------------
// The closed vocabularies scene.ts shares (ARCHITECTURE §6.6 — one declaration,
// imported everywhere else; §9.12 — copied verbatim from the design docs).

export const FIGURE_ROLES = ["ideal", "alternative", "mistake", "reference"] as const satisfies readonly FigureRole[];
export const LABEL_FEATURES = [
  "turn_point", "apex", "exit", "release", "correction", "run_wide_detect", "end", "sight_ray"
] as const satisfies readonly LabelFeature[];
export const MARK_CLASSES = ["turn_point", "apex", "exit", "release"] as const satisfies readonly MarkClass[];
export const SOLVE_STYLES = ["single", "double_apex", "geometric"] as const satisfies readonly SolveStyle[];
export const VIS_MODES = ["none", "cautious"] as const satisfies readonly VisMode[];
export const ACCEPT_POLICIES = ["clean", "best_failing"] as const satisfies readonly AcceptPolicy[];
export const CONSTRAINT_BOUNDS = [
  "f_min", "f_max", "v_max_kmh", "sight_margin_min_m"
] as const satisfies readonly ConstraintBound[];

// ---------------------------------------------------------------------------
// Small local error builders + guards (same convention as plan/validate.ts,
// plan/anchors.ts, plan/placements.ts — each file in this package mints its own
// rather than share module-private helpers across file boundaries).

function schemaErr(at: string, message: string, reason: string, detail?: Record<string, unknown>): LinelabError {
  return { code: "SCHEMA", at, message, detail: { reason, ...detail } };
}
function badRange(at: string, message: string, reason: string, detail?: Record<string, unknown>): LinelabError {
  return { code: "BAD_RANGE", at, message, detail: { reason, ...detail } };
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function isHand(v: unknown): v is Hand {
  return v === "L" || v === "R";
}

// ---------------------------------------------------------------------------
// road: RoadSpec shape (design/03 §2.1) — exactly one of segments | preset | dsl.

function validateRoadSpecShape(raw: unknown, at: string): Result<RoadSpec> {
  if (!isObject(raw)) return err(schemaErr(at, "road must be a JSON object", "road_not_object"));
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
  const tail = {
    ...(useFullWidthRaw !== undefined ? { use_full_width: useFullWidthRaw as boolean } : {}),
    ...(bikeMarginRaw !== undefined ? { bike_margin_m: bikeMarginRaw as number } : {})
  };

  if (hasPreset) {
    const name = raw["preset"];
    if (typeof name !== "string") return err(schemaErr(`${at}.preset`, "preset must be a string", "type_mismatch"));
    if (!(PRESET_NAMES as readonly string[]).includes(name)) {
      return err(schemaErr(`${at}.preset`, `unknown preset "${name}" (known: ${PRESET_NAMES.join(", ")})`, "unknown_preset"));
    }
    let hand: Hand | undefined;
    if (raw["hand"] !== undefined) {
      if (!isHand(raw["hand"])) return err(schemaErr(`${at}.hand`, 'hand must be "L" or "R"', "hand_malformed"));
      hand = raw["hand"];
    }
    return ok({ preset: name, ...(hand !== undefined ? { hand } : {}), ...tail });
  }
  if ("hand" in raw) {
    return err(schemaErr(`${at}.hand`, "spell hands per segment", "hand_on_explicit_road"));
  }
  if (hasDsl) {
    const dsl = raw["dsl"];
    if (typeof dsl !== "string" || dsl.length === 0) {
      return err(schemaErr(`${at}.dsl`, "dsl must be a non-empty string", "type_mismatch"));
    }
    return ok({ dsl, ...tail });
  }
  const laneWidth = raw["lane_width_m"];
  if (typeof laneWidth !== "number" || !(laneWidth > 0)) {
    return err(badRange(`${at}.lane_width_m`, "lane_width_m must be a positive number", "type_mismatch"));
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
    } else if (type === "arc" || type === "taper") {
      if (!isHand(seg["hand"])) return err(schemaErr(`${segAt}.hand`, 'hand must be "L" or "R"', "hand_malformed"));
      const angle_deg = seg["angle_deg"];
      if (typeof angle_deg !== "number") return err(schemaErr(`${segAt}.angle_deg`, "angle_deg must be a number", "type_mismatch"));
      if (type === "arc") {
        const r_m = seg["r_m"];
        if (typeof r_m !== "number") return err(schemaErr(`${segAt}.r_m`, "r_m must be a number", "type_mismatch"));
        segments.push({ type: "arc", r_m, angle_deg, hand: seg["hand"] });
      } else {
        const r1_m = seg["r1_m"];
        const r2_m = seg["r2_m"];
        if (typeof r1_m !== "number" || typeof r2_m !== "number") {
          return err(schemaErr(segAt, "taper needs numeric r1_m, r2_m", "type_mismatch"));
        }
        segments.push({ type: "taper", r1_m, r2_m, angle_deg, hand: seg["hand"] });
      }
    } else {
      return err(schemaErr(`${segAt}.type`, `unknown segment type "${String(type)}"`, "type_mismatch"));
    }
  }
  return ok({ lane_width_m: laneWidth, segments, ...tail });
}

// ---------------------------------------------------------------------------
// WireAnchor shape (design/03 §4/§6.1) — `{ref, offset_m?}` or `{at_s}`.

function validateAnchorShape(raw: unknown, at: string): Result<WireAnchor> {
  if (!isObject(raw)) return err(schemaErr(at, "an anchor must be a JSON object", "type_mismatch"));
  const hasAtS = raw["at_s"] !== undefined;
  const hasRef = raw["ref"] !== undefined;
  if (hasAtS === hasRef) {
    return err(schemaErr(at, "an anchor needs exactly one of at_s or ref", "anchor_ambiguous"));
  }
  if (hasAtS) {
    const at_s = raw["at_s"];
    if (typeof at_s !== "number") return err(schemaErr(`${at}.at_s`, "at_s must be a number", "type_mismatch"));
    return ok({ at_s });
  }
  const ref = raw["ref"];
  if (typeof ref !== "string") return err(schemaErr(`${at}.ref`, "ref must be a string", "type_mismatch"));
  let offset_m: number | undefined;
  if (raw["offset_m"] !== undefined) {
    const o = raw["offset_m"];
    if (typeof o !== "number") return err(schemaErr(`${at}.offset_m`, "offset_m must be a number", "type_mismatch"));
    offset_m = o;
  }
  return ok({ ref, ...(offset_m !== undefined ? { offset_m } : {}) });
}

// ---------------------------------------------------------------------------
// Occluder / Hazard shape (design/03 §4.1/§4.2) — field presence + type only;
// vehicle's lane⊕f⊕side exclusivity and margin defaults are resolution-time
// (plan/placements.ts), not shape.

const OCCLUDER_KINDS = ["hedge", "wall", "bank", "vehicle"] as const;
const OCCLUDER_SIDES = ["inside", "outside", "left", "right"] as const;
const VEHICLE_LANES = ["own", "oncoming"] as const;

function validateOccluderShape(raw: unknown, at: string): Result<Occluder> {
  if (!isObject(raw)) return err(schemaErr(at, "an occluder must be a JSON object", "type_mismatch"));
  const kind = raw["kind"];
  if (typeof kind !== "string" || !(OCCLUDER_KINDS as readonly string[]).includes(kind)) {
    return err(schemaErr(`${at}.kind`, `kind must be one of ${OCCLUDER_KINDS.join(", ")}`, "type_mismatch"));
  }
  const atAnchor = validateAnchorShape(raw["at"], `${at}.at`);
  if (!atAnchor.ok) return atAnchor;
  if (raw["side"] !== undefined && !(OCCLUDER_SIDES as readonly string[]).includes(raw["side"] as string)) {
    return err(schemaErr(`${at}.side`, `side must be one of ${OCCLUDER_SIDES.join(", ")}`, "type_mismatch"));
  }
  if (raw["lane"] !== undefined && !(VEHICLE_LANES as readonly string[]).includes(raw["lane"] as string)) {
    return err(schemaErr(`${at}.lane`, `lane must be one of ${VEHICLE_LANES.join(", ")}`, "type_mismatch"));
  }
  for (const numField of ["span_m", "margin_m", "depth_m", "len_m", "width_m", "f", "speed_kmh", "height_m"] as const) {
    if (raw[numField] !== undefined && typeof raw[numField] !== "number") {
      return err(schemaErr(`${at}.${numField}`, `${numField} must be a number`, "type_mismatch"));
    }
  }
  return ok(raw as unknown as Occluder);
}

function validateHazardShape(raw: unknown, at: string): Result<Hazard> {
  if (!isObject(raw)) return err(schemaErr(at, "a hazard must be a JSON object", "type_mismatch"));
  if (raw["kind"] !== "gravel") {
    return err(schemaErr(`${at}.kind`, 'hazard kind must be "gravel"', "type_mismatch"));
  }
  const HAZARD_SIDES = ["inside", "outside", "left", "right", "center"] as const;
  if (typeof raw["side"] !== "string" || !(HAZARD_SIDES as readonly string[]).includes(raw["side"])) {
    return err(schemaErr(`${at}.side`, `side must be one of ${HAZARD_SIDES.join(", ")}`, "type_mismatch"));
  }
  const atAnchor = validateAnchorShape(raw["at"], `${at}.at`);
  if (!atAnchor.ok) return atAnchor;
  if (typeof raw["span_m"] !== "number" || !(raw["span_m"] > 0)) {
    return err(badRange(`${at}.span_m`, "span_m must be a positive number", "span_nonpositive"));
  }
  for (const numField of ["width_m", "mu"] as const) {
    if (raw[numField] !== undefined && typeof raw[numField] !== "number") {
      return err(schemaErr(`${at}.${numField}`, `${numField} must be a number`, "type_mismatch"));
    }
  }
  return ok(raw as unknown as Hazard);
}

// ---------------------------------------------------------------------------
// Constraint shape (design/04 §4.5)

function validateConstraintShape(raw: unknown, at: string): Result<Constraint> {
  if (!isObject(raw)) return err(schemaErr(at, "a constraint must be a JSON object", "type_mismatch"));
  const id = raw["id"];
  if (typeof id !== "string" || id.length === 0) {
    return err(schemaErr(`${at}.id`, "constraint id must be a non-empty string", "type_mismatch"));
  }
  const bound = raw["bound"];
  if (typeof bound !== "string" || !(CONSTRAINT_BOUNDS as readonly string[]).includes(bound)) {
    return err(schemaErr(`${at}.bound`, `bound must be one of ${CONSTRAINT_BOUNDS.join(", ")}`, "type_mismatch"));
  }
  const value = raw["value"];
  if (typeof value !== "number") return err(schemaErr(`${at}.value`, "value must be a number", "type_mismatch"));
  const span = raw["span"];
  if (!isObject(span)) return err(schemaErr(`${at}.span`, "span must be a JSON object", "type_mismatch"));
  const hasFromTo = typeof span["from"] === "string" && typeof span["to"] === "string";
  const hasAt = typeof span["at"] === "string";
  if (hasFromTo === hasAt) {
    return err(schemaErr(`${at}.span`, "span needs exactly one of {from,to} or {at}", "type_mismatch"));
  }
  return ok({
    id,
    bound: bound as ConstraintBound,
    value,
    span: hasAt ? { at: span["at"] as string } : { from: span["from"] as string, to: span["to"] as string }
  });
}

// ---------------------------------------------------------------------------
// LineSpecKind shape (design/03 §8: ride-spec | mistake-spec | explicit plan) —
// discriminated structurally: `spec: "linelab/1"` → Scenario; `entry_kmh` →
// SolveSpec; `kind` → MistakeSpec. No other shape is legal.

function validateSolveSpecShape(raw: Record<string, unknown>, at: string): Result<SolveSpec> {
  const road = validateRoadSpecShape(raw["road"], `${at}.road`);
  if (!road.ok) return road;
  const entry_kmh = raw["entry_kmh"];
  if (typeof entry_kmh !== "number" || !(entry_kmh > 0)) {
    return err(badRange(`${at}.entry_kmh`, "entry_kmh must be a positive number", "entry_kmh_nonpositive"));
  }
  const out: { -readonly [K in keyof SolveSpec]?: SolveSpec[K] } = { road: road.value, entry_kmh };
  if (raw["style"] !== undefined) {
    if (!(SOLVE_STYLES as readonly string[]).includes(raw["style"] as string)) {
      return err(schemaErr(`${at}.style`, `style must be one of ${SOLVE_STYLES.join(", ")}`, "type_mismatch"));
    }
    out.style = raw["style"] as SolveStyle;
  }
  if (raw["vis"] !== undefined) {
    if (!(VIS_MODES as readonly string[]).includes(raw["vis"] as string)) {
      return err(schemaErr(`${at}.vis`, `vis must be one of ${VIS_MODES.join(", ")}`, "type_mismatch"));
    }
    out.vis = raw["vis"] as VisMode;
  }
  if (raw["accept"] !== undefined) {
    if (!(ACCEPT_POLICIES as readonly string[]).includes(raw["accept"] as string)) {
      return err(schemaErr(`${at}.accept`, `accept must be one of ${ACCEPT_POLICIES.join(", ")}`, "type_mismatch"));
    }
    out.accept = raw["accept"] as AcceptPolicy;
  }
  if (raw["turn_in"] !== undefined) {
    const t = raw["turn_in"];
    if (t !== "auto" && typeof t !== "number") {
      return err(schemaErr(`${at}.turn_in`, 'turn_in must be "auto" or a number', "type_mismatch"));
    }
    out.turn_in = t;
  }
  for (const strField of ["corner"] as const) {
    if (raw[strField] !== undefined) {
      if (typeof raw[strField] !== "string") return err(schemaErr(`${at}.${strField}`, `${strField} must be a string`, "type_mismatch"));
      out[strField] = raw[strField] as string;
    }
  }
  for (const numField of ["mu", "vis_hold_f", "vis_margin", "start_f", "roll_rate_cap_dps"] as const) {
    if (raw[numField] !== undefined) {
      if (typeof raw[numField] !== "number") return err(schemaErr(`${at}.${numField}`, `${numField} must be a number`, "type_mismatch"));
      out[numField] = raw[numField] as number;
    }
  }
  if (raw["believed_road"] !== undefined) {
    if (typeof raw["believed_road"] === "string") {
      out.believed_road = raw["believed_road"];
    } else {
      const br = validateRoadSpecShape(raw["believed_road"], `${at}.believed_road`);
      if (!br.ok) return br;
      out.believed_road = br.value;
    }
  }
  if (raw["occluders"] !== undefined) {
    if (!Array.isArray(raw["occluders"])) return err(schemaErr(`${at}.occluders`, "occluders must be an array", "type_mismatch"));
    const occs: Occluder[] = [];
    for (let i = 0; i < raw["occluders"].length; i++) {
      const o = validateOccluderShape(raw["occluders"][i], `${at}.occluders[${i}]`);
      if (!o.ok) return o;
      occs.push(o.value);
    }
    out.occluders = occs;
  }
  if (raw["hazards"] !== undefined) {
    if (!Array.isArray(raw["hazards"])) return err(schemaErr(`${at}.hazards`, "hazards must be an array", "type_mismatch"));
    const haz: Hazard[] = [];
    for (let i = 0; i < raw["hazards"].length; i++) {
      const h = validateHazardShape(raw["hazards"][i], `${at}.hazards[${i}]`);
      if (!h.ok) return h;
      haz.push(h.value);
    }
    out.hazards = haz;
  }
  if (raw["constraints"] !== undefined) {
    if (!Array.isArray(raw["constraints"])) return err(schemaErr(`${at}.constraints`, "constraints must be an array", "type_mismatch"));
    const cs: Constraint[] = [];
    for (let i = 0; i < raw["constraints"].length; i++) {
      const c = validateConstraintShape(raw["constraints"][i], `${at}.constraints[${i}]`);
      if (!c.ok) return c;
      cs.push(c.value);
    }
    out.constraints = cs;
  }
  if (raw["mistake"] !== undefined) {
    const m = validateMistakeSpecShape(raw["mistake"], `${at}.mistake`);
    if (!m.ok) return m;
    out.mistake = m.value;
  }
  return ok(out as SolveSpec);
}

function validateMistakeSpecShape(raw: unknown, at: string): Result<MistakeSpec> {
  if (!isObject(raw)) return err(schemaErr(at, "a mistake spec must be a JSON object", "type_mismatch"));
  const kind = raw["kind"];
  if (typeof kind !== "string" || !(MISTAKE_KINDS as readonly string[]).includes(kind)) {
    return err(schemaErr(`${at}.kind`, `unknown mistake kind "${String(kind)}" (known: ${MISTAKE_KINDS.join(", ")})`, "unknown_mistake_kind"));
  }
  let params: Record<string, number | string> | undefined;
  if (raw["params"] !== undefined) {
    if (!isObject(raw["params"])) return err(schemaErr(`${at}.params`, "params must be a JSON object", "type_mismatch"));
    for (const [k, v] of Object.entries(raw["params"])) {
      if (typeof v !== "number" && typeof v !== "string") {
        return err(schemaErr(`${at}.params.${k}`, "a param value must be a number or string", "type_mismatch"));
      }
    }
    params = raw["params"] as Record<string, number | string>;
  }
  let scope: readonly string[] | "all_corners" | undefined;
  if (raw["scope"] !== undefined) {
    const s = raw["scope"];
    if (s === "all_corners") scope = "all_corners";
    else if (Array.isArray(s) && s.every((x) => typeof x === "string")) scope = s as readonly string[];
    else return err(schemaErr(`${at}.scope`, 'scope must be "all_corners" or an array of corner ids', "type_mismatch"));
  }
  return ok({ kind, ...(params !== undefined ? { params } : {}), ...(scope !== undefined ? { scope } : {}) });
}

function validateScenarioShape(raw: Record<string, unknown>, at: string): Result<Scenario> {
  // Shape-level only: full Scenario validation (anchors, plan-action reachability,
  // config defaults) is plan/validate.ts's `validate()` — the sole rejection point
  // for a standalone Scenario (ARCHITECTURE §5). Here we only confirm the JSON
  // has the minimum shape `validate()` itself demands as its own entry check,
  // so a `plan <file.json>`-shaped line embedded in a FigureSpec fails fast with
  // a figure-scoped `at` path rather than an opaque downstream error.
  if (raw["spec"] !== "linelab/1") {
    return err(schemaErr(`${at}.spec`, 'spec must be "linelab/1"', "spec_mismatch"));
  }
  if (typeof raw["id"] !== "string" || raw["id"].length === 0) {
    return err(schemaErr(`${at}.id`, "id must be a non-empty string", "id_missing"));
  }
  const road = validateRoadSpecShape(raw["road"], `${at}.road`);
  if (!road.ok) return road;
  if (!isObject(raw["rider"])) return err(schemaErr(`${at}.rider`, "rider must be a JSON object", "type_mismatch"));
  return ok(raw as unknown as Scenario);
}

/** Structural discriminator over `SolveSpec | MistakeSpec | Scenario` (design/03 §8). */
function validateLineSpecShape(raw: unknown, at: string): Result<SolveSpec | MistakeSpec | Scenario> {
  if (!isObject(raw)) return err(schemaErr(at, "a line spec must be a JSON object", "type_mismatch"));
  if (raw["spec"] === "linelab/1") return validateScenarioShape(raw, at);
  if ("entry_kmh" in raw) return validateSolveSpecShape(raw, at);
  if ("kind" in raw) return validateMistakeSpecShape(raw, at);
  return err(
    schemaErr(
      at,
      'a line spec must be a SolveSpec ({entry_kmh,…}), a MistakeSpec ({kind,…}), or an explicit Scenario ({spec:"linelab/1",…})',
      "line_spec_shape_unrecognized"
    )
  );
}

// ---------------------------------------------------------------------------
// FigureLabel shape (design/03 §8)

function validateLabelShape(raw: unknown, at: string): Result<FigureLabel> {
  if (!isObject(raw)) return err(schemaErr(at, "a label must be a JSON object", "type_mismatch"));
  const feature = raw["feature"];
  if (typeof feature !== "string" || !(LABEL_FEATURES as readonly string[]).includes(feature)) {
    return err(schemaErr(`${at}.feature`, `feature must be one of ${LABEL_FEATURES.join(", ")}`, "type_mismatch"));
  }
  const line = raw["line"];
  if (typeof line !== "string" || line.length === 0) {
    return err(schemaErr(`${at}.line`, "line must be a non-empty string", "type_mismatch"));
  }
  if (raw["corner"] !== undefined && typeof raw["corner"] !== "string") {
    return err(schemaErr(`${at}.corner`, "corner must be a string", "type_mismatch"));
  }
  if (raw["n"] !== undefined && typeof raw["n"] !== "number") {
    return err(schemaErr(`${at}.n`, "n must be a number", "type_mismatch"));
  }
  if (raw["offset_m"] !== undefined && typeof raw["offset_m"] !== "number") {
    return err(schemaErr(`${at}.offset_m`, "offset_m must be a number", "type_mismatch"));
  }
  if (raw["text"] !== undefined && typeof raw["text"] !== "string") {
    return err(schemaErr(`${at}.text`, "text must be a string", "type_mismatch"));
  }
  return ok({
    feature: feature as LabelFeature,
    line,
    ...(raw["corner"] !== undefined ? { corner: raw["corner"] as string } : {}),
    ...(raw["n"] !== undefined ? { n: raw["n"] as number } : {}),
    ...(raw["offset_m"] !== undefined ? { offset_m: raw["offset_m"] as number } : {}),
    ...(raw["text"] !== undefined ? { text: raw["text"] as string } : {})
  });
}

// ---------------------------------------------------------------------------
// MarkSpec shape (design/03 §8) — `auto | all | none | <class-list>`

function validateMarkSpecShape(raw: unknown, at: string): Result<MarkSpec> {
  if (raw === "auto" || raw === "all" || raw === "none") return ok(raw);
  if (Array.isArray(raw) && raw.length > 0 && raw.every((c) => (MARK_CLASSES as readonly string[]).includes(c as string))) {
    return ok(raw as readonly MarkClass[]);
  }
  return err(
    schemaErr(at, `marks must be "auto"|"all"|"none" or a non-empty array of ${MARK_CLASSES.join("|")}`, "marks_malformed")
  );
}

// ---------------------------------------------------------------------------
// The main entry point

/**
 * `validateFigureSpec(json) → Result<FigureSpec>` — shape-level validation of a
 * hand-authored FigureSpec JSON document (design/03 §8; D30's canonical
 * spelling). Never runs the engine, never resolves an anchor to a station
 * (that needs a composed road); see the file banner for the exact scope line.
 */
export function validateFigureSpec(json: unknown): Result<FigureSpec> {
  if (!isObject(json)) return err(schemaErr("", "a FigureSpec must be a JSON object", "figure_not_object"));

  const road = validateRoadSpecShape(json["road"], "road");
  if (!road.ok) return road;

  const linesRaw = json["lines"];
  if (!Array.isArray(linesRaw) || linesRaw.length === 0) {
    return err(schemaErr("lines", "lines must be a non-empty array", "figure_no_lines"));
  }
  const lines: FigureLine[] = [];
  const seenNames = new Set<string>();
  for (let i = 0; i < linesRaw.length; i++) {
    const raw: unknown = linesRaw[i];
    const at = `lines[${i}]`;
    if (!isObject(raw)) return err(schemaErr(at, "a figure line must be a JSON object", "type_mismatch"));
    const name = raw["name"];
    if (typeof name !== "string" || name.length === 0) {
      return err(schemaErr(`${at}.name`, "name must be a non-empty string", "type_mismatch"));
    }
    if (seenNames.has(name)) {
      return err({ code: "DUP_ID", at: `${at}.name`, message: `duplicate line name "${name}"`, detail: { reason: "duplicate_line_name", name } });
    }
    seenNames.add(name);
    const role = raw["role"];
    if (typeof role !== "string" || !(FIGURE_ROLES as readonly string[]).includes(role)) {
      return err(schemaErr(`${at}.role`, `role must be one of ${FIGURE_ROLES.join(", ")}`, "type_mismatch"));
    }
    const spec = validateLineSpecShape(raw["spec"], `${at}.spec`);
    if (!spec.ok) return spec;
    lines.push({ name, role: role as FigureRole, spec: spec.value });
  }

  let occluders: readonly Occluder[] | undefined;
  if (json["occluders"] !== undefined) {
    if (!Array.isArray(json["occluders"])) return err(schemaErr("occluders", "occluders must be an array", "type_mismatch"));
    const occs: Occluder[] = [];
    for (let i = 0; i < json["occluders"].length; i++) {
      const o = validateOccluderShape(json["occluders"][i], `occluders[${i}]`);
      if (!o.ok) return o;
      occs.push(o.value);
    }
    occluders = occs;
  }
  let hazards: readonly Hazard[] | undefined;
  if (json["hazards"] !== undefined) {
    if (!Array.isArray(json["hazards"])) return err(schemaErr("hazards", "hazards must be an array", "type_mismatch"));
    const haz: Hazard[] = [];
    for (let i = 0; i < json["hazards"].length; i++) {
      const h = validateHazardShape(json["hazards"][i], `hazards[${i}]`);
      if (!h.ok) return h;
      haz.push(h.value);
    }
    hazards = haz;
  }
  let labels: readonly FigureLabel[] | undefined;
  if (json["labels"] !== undefined) {
    if (!Array.isArray(json["labels"])) return err(schemaErr("labels", "labels must be an array", "type_mismatch"));
    const ls: FigureLabel[] = [];
    for (let i = 0; i < json["labels"].length; i++) {
      const l = validateLabelShape(json["labels"][i], `labels[${i}]`);
      if (!l.ok) return l;
      ls.push(l.value);
    }
    labels = ls;
  }
  let marks: MarkSpec | undefined;
  if (json["marks"] !== undefined) {
    const m = validateMarkSpecShape(json["marks"], "marks");
    if (!m.ok) return m;
    marks = m.value;
  }
  if (json["note"] !== undefined && typeof json["note"] !== "string") {
    return err(schemaErr("note", "note must be a string", "type_mismatch"));
  }
  // design/06 §3.1 stage 11's figure-level placard boxes. The key exists in
  // BOTH spellings because D30 makes them one identity — and because the
  // figures that most need a placard (the doctrine candidates of
  // figures/SCOPE.md §3) are FigureSpec JSON, not scene text (S28).
  let placards: readonly string[] | undefined;
  if (json["placards"] !== undefined) {
    if (!Array.isArray(json["placards"])) return err(schemaErr("placards", "placards must be an array of strings", "type_mismatch"));
    const ps: string[] = [];
    for (let i = 0; i < json["placards"].length; i++) {
      const p: unknown = json["placards"][i];
      if (typeof p !== "string" || p.trim().length === 0) {
        return err(schemaErr(`placards[${i}]`, "each placard must be a non-empty string", "type_mismatch"));
      }
      ps.push(p);
    }
    // D8: an empty list would be accepted-and-ignored — and it would also move
    // `spec_hash` for no ink. Omit the key instead.
    if (ps.length === 0) return err(schemaErr("placards", "placards must not be empty — omit the key instead", "type_mismatch"));
    placards = ps;
  }
  // `view` is deliberately unvalidated beyond presence — render/'s vocabulary
  // (ARCHITECTURE §4); plan/ never depends on render/.

  const spec: Figure = {
    road: road.value,
    ...(occluders !== undefined ? { occluders } : {}),
    ...(hazards !== undefined ? { hazards } : {}),
    lines,
    ...(labels !== undefined ? { labels } : {}),
    ...(marks !== undefined ? { marks } : {}),
    ...(json["view"] !== undefined ? { view: json["view"] } : {}),
    ...(typeof json["note"] === "string" ? { note: json["note"] } : {}),
    ...(placards !== undefined ? { placards } : {})
  };
  return ok(Object.freeze(spec));
}

// ---------------------------------------------------------------------------
// specHash (D30; ARCHITECTURE §6.3)
//
// `spec_hash = fnv1a(canonicalize(lowered FigureSpec))`. ARCHITECTURE §6.3's
// exclusion list (`engine_semver`, `expected`, `solved`) names fields of the
// SHARE-format wire document (D31's per-line `expected`/`solved` stamps) — a
// shape not present anywhere on `FigureSpec`/`Figure` (plan/types.ts) as built
// in v0.1. There is therefore nothing to exclude YET: this function hashes the
// complete lowered FigureSpec. If a future package adds those stamp fields to
// `Figure`/`FigureLine`, `specHash` must be updated to strip them before
// hashing — recorded here so the obligation is not lost (see this package's
// returned "deviations").
export function specHash(spec: FigureSpec): string {
  const canon = canonicalize(spec);
  if (!canon.ok) {
    // `FigureSpec` is plain finite JSON-shaped data by construction (lowerScene
    // builds it from parsed numbers/strings; validateFigureSpec type-checks
    // every field as `number`/`string`) — canonicalize's own INTERNAL arm is
    // believed-impossible here. ARCHITECTURE §5 pins `specHash`'s return type as
    // plain `string`, so there is no Result to thread this through; a genuine
    // hit here is a linelab bug, not a caller input error.
    throw new Error(`specHash: canonicalize failed unexpectedly at ${canon.error.at}: ${canon.error.message}`);
  }
  return fnv1a(canon.value);
}
