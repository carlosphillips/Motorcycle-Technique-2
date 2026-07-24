// plan/scene.ts — lowerScene(sceneText) → Result<FigureSpec> (design/04 §7; D30).
// A pure, total, deterministic lowering of the scene-text grammar onto the SAME
// canonical FigureSpec shape plan/figure.ts validates (D30: "scene text is
// sugar"; `spec_hash` is computed on the lowered form so spelling never changes
// identity — ARCHITECTURE §6.3, §10.4).
//
// Grammar (design/04 §7, copied verbatim in the file-level comments below each
// section): top-level keys at column 0 (`road lines occluders hazards marks
// labels view note`); `lines:`/`labels:` entries indented; `#` comments outside
// double quotes; every rejection is a typed `SCHEMA`/`UNKNOWN_ID`/`BAD_RANGE`
// error naming the offending token and the 1-based scene-text line number
// (`at` = "line <n>: <token-ish description>").
//
// Total means: for EVERY string input, `lowerScene` returns a `Result` — never
// throws, never loops unboundedly. Malformed input is not a partiality failure,
// it is a legitimate `err(...)` output (ARCHITECTURE §4's error discipline).
//
// SCOPE NOTE (recorded again at the point it bites, and in this package's
// returned "deviations"): the `naive` and `plan <file.json>` line kinds are
// part of design/04 §7's full grammar, but neither has a home in the v0.1
// build: `naive`/`solveGeometric` are NOT part of the v0.1 solve/ export
// surface (ARCHITECTURE §5 lists exactly `solve, suggestTurnIn, chainedSolve,
// solveDoubleApex, compileMistake, correctiveShot, counterfactual, gateFigure`),
// and `plan <file.json>` requires file IO, which `lowerScene` — pure and total
// per D30 — structurally cannot perform. Both kinds are recognized syntactically
// (the closed line-kind set is `ride | mistake | naive | plan`, per design) and
// rejected with a typed, distinctly-reasoned `SCHEMA` error rather than silently
// dropped or given fabricated semantics. None of the six committed book scenes
// use either kind.

import type { Result, LinelabError } from "../core/result.js";
import { ok, err } from "../core/result.js";
import type { Hand } from "../core/types.js";
import type { RoadSpec } from "../road/types.js";
import { parseRoadDSL, printRoadDSL } from "../road/dsl.js";
import { parseMistakeToken } from "./mistakes.js";
import { parseOccluderOrHazardToken } from "./placements.js";
import {
  FIGURE_ROLES,
  LABEL_FEATURES,
  MARK_CLASSES,
  SOLVE_STYLES,
  VIS_MODES,
  ACCEPT_POLICIES,
  CONSTRAINT_BOUNDS
} from "./figure.js";
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
  SolveSpec,
  MistakeSpec,
  SolveStyle,
  VisMode,
  AcceptPolicy,
  Constraint,
  ConstraintBound
} from "./types.js";

// ---------------------------------------------------------------------------
// Error builders (same convention as every other plan/ file — ARCHITECTURE
// §4's one error shape, a locally-named constructor per file).

function schemaErr(at: string, message: string, reason: string, detail?: Record<string, unknown>): LinelabError {
  return { code: "SCHEMA", at, message, detail: { reason, ...detail } };
}
function badRange(at: string, message: string, reason: string, detail?: Record<string, unknown>): LinelabError {
  return { code: "BAD_RANGE", at, message, detail: { reason, ...detail } };
}
function dupId(at: string, message: string, reason: string, detail?: Record<string, unknown>): LinelabError {
  return { code: "DUP_ID", at, message, detail: { reason, ...detail } };
}
function lineAt(lineNo: number, tail?: string): string {
  return tail === undefined ? `line ${lineNo}` : `line ${lineNo}: ${tail}`;
}

// ---------------------------------------------------------------------------
// Tokenizing helpers — quote-aware (a value may embed a double-quoted string
// with internal spaces and `|`s, e.g. `believeRoad="lane 3.5 | S 10 | ..."`).

/**
 * Strip a trailing `#` comment — but only OUTSIDE a double-quoted span, and
 * only when the `#` starts a WORD (line-start or preceded by whitespace). A
 * `#` glued to the previous character is the label grammar's `#<n>`
 * disambiguator (`turn_point#1@bad`, design/03 §8), never a comment marker.
 */
function stripComment(line: string): string {
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i]!;
    if (c === '"') inQuotes = !inQuotes;
    else if (c === "#" && !inQuotes && (i === 0 || /\s/.test(line[i - 1]!))) return line.slice(0, i);
  }
  return line;
}

/** Split on whitespace, EXCEPT inside a double-quoted span (quotes retained in the token). */
function splitRespectingQuotes(s: string): string[] {
  const tokens: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i]!;
    if (c === '"') {
      inQuotes = !inQuotes;
      cur += c;
      continue;
    }
    if (/\s/.test(c) && !inQuotes) {
      if (cur.length > 0) {
        tokens.push(cur);
        cur = "";
      }
      continue;
    }
    cur += c;
  }
  if (cur.length > 0) tokens.push(cur);
  return tokens;
}

function hasUnterminatedQuote(s: string): boolean {
  let count = 0;
  for (const c of s) if (c === '"') count++;
  return count % 2 !== 0;
}

/** A token that is exactly `"...text..."` → the inner text; else undefined. */
function dequote(tok: string): string | undefined {
  if (tok.length >= 2 && tok.startsWith('"') && tok.endsWith('"')) return tok.slice(1, -1);
  return undefined;
}

function parseNumberToken(value: string, at: string): Result<number> {
  if (value.length === 0) return err(schemaErr(at, "expected a number, got an empty token", "scene_number_malformed"));
  const n = Number(value);
  if (!Number.isFinite(n)) return err(schemaErr(at, `expected a number, got "${value}"`, "scene_number_malformed"));
  return ok(n);
}

// ---------------------------------------------------------------------------
// Road-ref token (design/04 §7: `<road-DSL line> | preset <name> [hand=L|R]`,
// plus trailing `fullWidth=true` / `bikeMargin=<m>` options — shared verbatim
// by `road:` and the `believeRoad=` ride-line field; design/04 §7.4's CLI
// spelling additionally allows a bare preset name with no "preset " prefix,
// which this parser also accepts for both surfaces (permissive superset, never
// exercised by the six committed scenes — recorded as a deviation).

function parseRoadRefToken(tokens: readonly string[], at: string): Result<RoadSpec> {
  const first = tokens[0];
  if (first === undefined) {
    return err(schemaErr(at, "empty road reference", "road_ref_missing"));
  }

  if (first === "preset") {
    const name = tokens[1];
    if (name === undefined) {
      return err(schemaErr(at, '"preset" needs a name', "road_ref_preset_name_missing"));
    }
    let hand: Hand | undefined;
    let use_full_width: boolean | undefined;
    let bike_margin_m: number | undefined;
    const seen = new Set<string>();
    for (const tok of tokens.slice(2)) {
      const m = /^([a-zA-Z]+)=(.+)$/.exec(tok);
      if (m === null) return err(schemaErr(at, `unrecognized road option "${tok}"`, "road_ref_option_malformed"));
      const key = m[1]!;
      const val = m[2]!;
      if (seen.has(key)) return err(schemaErr(at, `duplicate road option "${key}"`, "road_ref_option_duplicate"));
      seen.add(key);
      if (key === "hand") {
        if (val !== "L" && val !== "R") return err(schemaErr(at, `hand must be "L" or "R" (got "${val}")`, "hand_malformed"));
        hand = val;
      } else if (key === "fullWidth") {
        if (val !== "true" && val !== "false") return err(schemaErr(at, `fullWidth must be "true" or "false" (got "${val}")`, "type_mismatch"));
        use_full_width = val === "true";
      } else if (key === "bikeMargin") {
        const n = parseNumberToken(val, at);
        if (!n.ok) return n;
        bike_margin_m = n.value;
      } else {
        return err(schemaErr(at, `unknown road option "${key}"`, "road_ref_option_unknown"));
      }
    }
    return ok({
      preset: name,
      ...(hand !== undefined ? { hand } : {}),
      ...(use_full_width !== undefined ? { use_full_width } : {}),
      ...(bike_margin_m !== undefined ? { bike_margin_m } : {})
    });
  }

  if (first !== "lane" && tokens.length === 1) {
    // A single bare word that is neither "preset ..." nor DSL text — accept as
    // preset-name shorthand (design/04 §7.4's CLI spelling: "<dsl | preset
    // name>"); `resolvePreset` (road/presets.ts) is the actual name check, so
    // an unknown bare word surfaces as UNKNOWN_ID downstream, not here.
    return ok({ preset: first });
  }

  // DSL form: pull any trailing fullWidth=/bikeMargin= options out of the
  // token stream (wherever they land) before handing the rest to the strict
  // DSL lexer; a `hand=` token here is the explicit-road rejection (D26/03 §3).
  const dslTokens: string[] = [];
  let use_full_width: boolean | undefined;
  let bike_margin_m: number | undefined;
  const seen = new Set<string>();
  for (const tok of tokens) {
    const m = /^(fullWidth|bikeMargin|hand)=(.+)$/.exec(tok);
    if (m === null) {
      dslTokens.push(tok);
      continue;
    }
    const key = m[1]!;
    const val = m[2]!;
    if (key === "hand") {
      return err(schemaErr(at, `hand="${val}" is rejected with the DSL road form — the DSL already says it`, "hand_on_explicit_road"));
    }
    if (seen.has(key)) return err(schemaErr(at, `duplicate road option "${key}"`, "road_ref_option_duplicate"));
    seen.add(key);
    if (key === "fullWidth") {
      if (val !== "true" && val !== "false") return err(schemaErr(at, `fullWidth must be "true" or "false" (got "${val}")`, "type_mismatch"));
      use_full_width = val === "true";
    } else {
      const n = parseNumberToken(val, at);
      if (!n.ok) return n;
      bike_margin_m = n.value;
    }
  }
  const parsed = parseRoadDSL(dslTokens.join(" "));
  if (!parsed.ok) return err({ ...parsed.error, at });
  return ok({
    dsl: printRoadDSL(parsed.value), // canonical spelling — whitespace variations in scene text hash identically
    ...(use_full_width !== undefined ? { use_full_width } : {}),
    ...(bike_margin_m !== undefined ? { bike_margin_m } : {})
  });
}

// ---------------------------------------------------------------------------
// The `ride`/`naive`-field key=value grammar (design/04 §7). `role=` is pulled
// out separately (it decorates the FigureLine, not the SolveSpec).

interface ParsedRideArgs {
  readonly solve: { -readonly [K in keyof SolveSpec]?: SolveSpec[K] };
  readonly role?: FigureRole;
}

function parseConstraintTokens(value: string, lineName: string, at: string): Result<readonly Constraint[]> {
  const parts = value.split(";").map((p) => p.trim()).filter((p) => p.length > 0);
  if (parts.length === 0) return err(schemaErr(at, "constraints=\"...\" carries no tokens", "constraints_empty"));
  const out: Constraint[] = [];
  const TOKEN_RE = /^(f|v_kmh|sight_margin_m)(>=|<=)([^@]+)@(.+)$/;
  for (let i = 0; i < parts.length; i++) {
    const tok = parts[i]!;
    const m = TOKEN_RE.exec(tok);
    if (m === null) {
      return err(schemaErr(at, `malformed constraint token "${tok}"`, "constraint_token_malformed"));
    }
    const [, field, op, valueStr, spanStr] = m as unknown as [string, string, string, string, string];
    let bound: ConstraintBound;
    if (field === "f" && op === ">=") bound = "f_min";
    else if (field === "f" && op === "<=") bound = "f_max";
    else if (field === "v_kmh" && op === "<=") bound = "v_max_kmh";
    else if (field === "sight_margin_m" && op === ">=") bound = "sight_margin_min_m";
    else {
      return err(
        schemaErr(at, `"${field}${op}" has no bound in the closed set — the bound vocabulary is closed`, "constraint_bound_unknown")
      );
    }
    const n = parseNumberToken(valueStr, at);
    if (!n.ok) return n;
    const ddIdx = spanStr.indexOf("..");
    const span = ddIdx === -1 ? { at: spanStr } : { from: spanStr.slice(0, ddIdx), to: spanStr.slice(ddIdx + 2) };
    out.push({ id: `${lineName}_c${i + 1}`, span, bound: bound as ConstraintBound, value: n.value });
  }
  return ok(out);
}

const RIDE_KEYS = [
  "entry", "turnIn", "style", "corner", "vis", "visHold", "visMargin",
  "believeRoad", "accept", "startF", "constraints", "role"
] as const;

function parseRideArgs(argsText: string, lineName: string, at: string): Result<ParsedRideArgs> {
  if (hasUnterminatedQuote(argsText)) {
    return err(schemaErr(at, `unterminated quoted value in "${argsText}"`, "scene_unterminated_quote"));
  }
  const solve: { -readonly [K in keyof SolveSpec]?: SolveSpec[K] } = {};
  let role: FigureRole | undefined;
  for (const tok of splitRespectingQuotes(argsText)) {
    const eq = tok.indexOf("=");
    if (eq <= 0) return err(schemaErr(at, `malformed ride argument "${tok}" (expected key=value)`, "ride_arg_malformed"));
    const key = tok.slice(0, eq);
    const rawVal = tok.slice(eq + 1);
    const dq = dequote(rawVal);
    const value = dq ?? rawVal;
    if (dq === undefined && (rawVal.startsWith('"') || rawVal.endsWith('"'))) {
      return err(schemaErr(at, `malformed quoted value in "${tok}"`, "scene_unterminated_quote"));
    }
    if (!(RIDE_KEYS as readonly string[]).includes(key)) {
      return err(schemaErr(at, `unknown ride field "${key}"`, "ride_unknown_key", { key }));
    }
    switch (key) {
      case "entry": {
        const n = parseNumberToken(value, at);
        if (!n.ok) return n;
        solve.entry_kmh = n.value;
        break;
      }
      case "turnIn": {
        if (value === "auto") {
          solve.turn_in = "auto";
        } else {
          const n = parseNumberToken(value, at);
          if (!n.ok) return n;
          solve.turn_in = n.value;
        }
        break;
      }
      case "style": {
        if (!(SOLVE_STYLES as readonly string[]).includes(value)) {
          return err(schemaErr(at, `style must be one of ${SOLVE_STYLES.join(", ")} (got "${value}")`, "ride_style_unknown"));
        }
        solve.style = value as SolveStyle;
        break;
      }
      case "corner": {
        if (!/^[A-Za-z0-9_]+(\.\.[A-Za-z0-9_]+)?$/.test(value)) {
          return err(schemaErr(at, `malformed corner token "${value}"`, "ride_corner_malformed"));
        }
        solve.corner = value;
        break;
      }
      case "vis": {
        if (!(VIS_MODES as readonly string[]).includes(value)) {
          return err(schemaErr(at, `vis must be one of ${VIS_MODES.join(", ")} (got "${value}")`, "ride_vis_unknown"));
        }
        solve.vis = value as VisMode;
        break;
      }
      case "visHold": {
        const n = parseNumberToken(value, at);
        if (!n.ok) return n;
        solve.vis_hold_f = n.value;
        break;
      }
      case "visMargin": {
        const n = parseNumberToken(value, at);
        if (!n.ok) return n;
        solve.vis_margin = n.value;
        break;
      }
      case "believeRoad": {
        if (dq === undefined) {
          return err(schemaErr(at, "believeRoad= needs a double-quoted value", "believe_road_needs_quotes"));
        }
        const parsedRoad = parseRoadRefToken(value.trim().split(/\s+/).filter((t) => t.length > 0), at);
        if (!parsedRoad.ok) return parsedRoad;
        solve.believed_road = parsedRoad.value;
        break;
      }
      case "accept": {
        if (!(ACCEPT_POLICIES as readonly string[]).includes(value)) {
          return err(schemaErr(at, `accept must be one of ${ACCEPT_POLICIES.join(", ")} (got "${value}")`, "ride_accept_unknown"));
        }
        solve.accept = value as AcceptPolicy;
        break;
      }
      case "startF": {
        const n = parseNumberToken(value, at);
        if (!n.ok) return n;
        solve.start_f = n.value;
        break;
      }
      case "constraints": {
        if (dq === undefined) {
          return err(schemaErr(at, "constraints= needs a double-quoted value", "constraints_need_quotes"));
        }
        const cs = parseConstraintTokens(value, lineName, at);
        if (!cs.ok) return cs;
        solve.constraints = cs.value;
        break;
      }
      case "role": {
        if (!(FIGURE_ROLES as readonly string[]).includes(value)) {
          return err(schemaErr(at, `role must be one of ${FIGURE_ROLES.join(", ")} (got "${value}")`, "ride_role_unknown"));
        }
        role = value as FigureRole;
        break;
      }
    }
  }
  if (solve.vis !== "cautious" && (solve.vis_hold_f !== undefined || solve.vis_margin !== undefined)) {
    return err({
      code: "INEFFECTUAL",
      at,
      message: "visHold=/visMargin= are only meaningful with vis=cautious",
      detail: { reason: "vis_knob_without_cautious" }
    });
  }
  return ok({ solve, ...(role !== undefined ? { role } : {}) });
}

// ---------------------------------------------------------------------------
// labels: block — `feature[:corner][#n]@line [±offset] "text"` (design/03 §8,
// design/04 §7). The road-anchor spellings `entry:<id>[ ±m]` / bare `exit:<id>`
// named in design/04 §7's prose are NOT representable by `FigureLabel`
// (plan/types.ts): that type requires a `line` on every label (it is a
// LINE-feature anchor grammar; `feature` is the closed 8-value event/marker
// set, which does not include "entry"/"mid"). None of the six committed scenes
// use a road anchor — every label anchors a recorded line event. Recorded as a
// deviation: `entry:`/`mid:` prefixes are rejected by name below, rather than
// silently misparsed.

const LABEL_FEATURE_RE = new RegExp(
  `^(${LABEL_FEATURES.join("|")})(?::([A-Za-z0-9_]+))?(?:#(\\d+))?(?:@([A-Za-z0-9_]+))?$`
);

function parseLabelAnchor(tok: string, at: string): Result<{ feature: LabelFeature; corner?: string; n?: number; line?: string }> {
  if (/^(entry|mid):/.test(tok)) {
    return err(
      schemaErr(
        at,
        `"${tok}": road anchors (entry:/mid:) are not representable as a line-feature label in this build`,
        "label_road_anchor_unsupported"
      )
    );
  }
  const m = LABEL_FEATURE_RE.exec(tok);
  if (m === null) {
    return err(schemaErr(at, `malformed label anchor "${tok}" (feature must be one of ${LABEL_FEATURES.join(", ")})`, "label_anchor_malformed"));
  }
  const [, feature, corner, nStr, line] = m;
  return ok({
    feature: feature as LabelFeature,
    ...(corner !== undefined ? { corner } : {}),
    ...(nStr !== undefined ? { n: Number(nStr) } : {}),
    ...(line !== undefined ? { line } : {})
  });
}

function parseLabelEntry(text: string, at: string): Result<FigureLabel> {
  if (hasUnterminatedQuote(text)) {
    return err(schemaErr(at, `unterminated quoted label text in "${text}"`, "scene_unterminated_quote"));
  }
  const tokens = splitRespectingQuotes(text);
  if (tokens.length !== 2 && tokens.length !== 3) {
    return err(schemaErr(at, `malformed label entry "${text}" (expected: anchor [±offset] "text")`, "scene_label_malformed"));
  }
  const anchorTok = tokens[0]!;
  const lastTok = tokens[tokens.length - 1]!;
  const quotedText = dequote(lastTok);
  if (quotedText === undefined) {
    return err(schemaErr(at, `label caption must be a double-quoted string (got "${lastTok}")`, "scene_label_malformed"));
  }
  let offset_m: number | undefined;
  if (tokens.length === 3) {
    const offTok = tokens[1]!;
    const n = parseNumberToken(offTok, at);
    if (!n.ok) return err(schemaErr(at, `malformed label offset "${offTok}"`, "scene_label_malformed"));
    offset_m = n.value;
  }
  const anchor = parseLabelAnchor(anchorTok, at);
  if (!anchor.ok) return anchor;
  if (anchor.value.line === undefined) {
    // Resolved by the caller against the first ideal-role line (design/04 §7's
    // sugar); the caller passes the already-known name back in via a second pass.
    return ok({
      feature: anchor.value.feature,
      ...(anchor.value.corner !== undefined ? { corner: anchor.value.corner } : {}),
      ...(anchor.value.n !== undefined ? { n: anchor.value.n } : {}),
      line: "", // placeholder — filled in by `resolveLabelLines`
      ...(offset_m !== undefined ? { offset_m } : {}),
      text: quotedText
    });
  }
  return ok({
    feature: anchor.value.feature,
    ...(anchor.value.corner !== undefined ? { corner: anchor.value.corner } : {}),
    ...(anchor.value.n !== undefined ? { n: anchor.value.n } : {}),
    line: anchor.value.line,
    ...(offset_m !== undefined ? { offset_m } : {}),
    text: quotedText
  });
}

// ---------------------------------------------------------------------------
// marks: figure-level MarkSpec — `auto | all | none | <class-list>` (design/03
// §8), class-list spelled comma-separated (the mistake-token param convention,
// D32; not exercised by any committed scene beyond a single bare class —
// recorded as a deviation, since design/04 §7 does not itself pin the
// separator for a multi-class list).

function parseMarkSpec(value: string, at: string): Result<MarkSpec> {
  const v = value.trim();
  if (v === "auto" || v === "all" || v === "none") return ok(v);
  const classes = v.split(",").map((c) => c.trim()).filter((c) => c.length > 0);
  if (classes.length === 0) return err(schemaErr(at, "marks: carries no value", "marks_malformed"));
  for (const c of classes) {
    if (!(MARK_CLASSES as readonly string[]).includes(c)) {
      return err(schemaErr(at, `unknown mark class "${c}" (known: ${MARK_CLASSES.join(", ")})`, "marks_class_unknown"));
    }
  }
  return ok(classes as readonly MarkClass[]);
}

// ---------------------------------------------------------------------------
// view: — opaque key=value pairs (ARCHITECTURE §4: plan/ passes these through
// unvalidated; render/project.ts is the semantic owner).

function parseViewSpec(value: string, at: string): Result<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const tok of value.trim().split(/\s+/).filter((t) => t.length > 0)) {
    const eq = tok.indexOf("=");
    if (eq <= 0) return err(schemaErr(at, `malformed view token "${tok}" (expected key=value)`, "view_token_malformed"));
    const key = tok.slice(0, eq);
    if (key in out) return err(schemaErr(at, `duplicate view key "${key}"`, "view_duplicate_key"));
    out[key] = tok.slice(eq + 1);
  }
  if (Object.keys(out).length === 0) return err(schemaErr(at, "view: carries no key=value pairs", "view_malformed"));
  return ok(out);
}

// ---------------------------------------------------------------------------
// Top-level scanning: column-0 keys, `lines:`/`labels:` children indented.

const TOP_LEVEL_KEYS = ["road", "lines", "occluders", "hazards", "marks", "labels", "view", "note"] as const;
type TopLevelKey = (typeof TOP_LEVEL_KEYS)[number];

interface TopEntry {
  readonly key: TopLevelKey;
  readonly inlineValue: string;
  readonly children: readonly { readonly text: string; readonly lineNo: number }[];
  readonly lineNo: number;
}

function scanTopLevel(sceneText: string): Result<readonly TopEntry[]> {
  const rawLines = sceneText.split("\n");
  const entries: TopEntry[] = [];
  for (let idx = 0; idx < rawLines.length; idx++) {
    const lineNo = idx + 1;
    const stripped = stripComment(rawLines[idx]!);
    if (stripped.trim().length === 0) continue;
    const isIndented = /^\s/.test(stripped);
    if (!isIndented) {
      const m = /^([A-Za-z][A-Za-z0-9_]*):(.*)$/.exec(stripped);
      if (m === null) {
        return err(schemaErr(lineAt(lineNo), `malformed top-level line "${stripped.trim()}"`, "scene_top_level_malformed"));
      }
      const key = m[1]!;
      if (!(TOP_LEVEL_KEYS as readonly string[]).includes(key)) {
        return err(schemaErr(lineAt(lineNo), `unknown scene key "${key}"`, "scene_unknown_key", { key }));
      }
      entries.push({ key: key as TopLevelKey, inlineValue: m[2]!.trim(), children: [], lineNo });
    } else {
      const last = entries[entries.length - 1];
      if (last === undefined) {
        return err(schemaErr(lineAt(lineNo), "indented line before any top-level key", "scene_indent_without_key"));
      }
      (last.children as { readonly text: string; readonly lineNo: number }[]).push({ text: stripped.trim(), lineNo });
    }
  }
  return ok(entries);
}

// ---------------------------------------------------------------------------
// lines: block entries — `<name>: <kind> <rest>`

interface RawSceneLine {
  readonly name: string;
  readonly kind: string;
  readonly rest: string;
  readonly lineNo: number;
}

function parseLinesBlock(children: readonly { readonly text: string; readonly lineNo: number }[]): Result<readonly RawSceneLine[]> {
  const out: RawSceneLine[] = [];
  const seenNames = new Set<string>();
  for (const child of children) {
    const m = /^([A-Za-z_][A-Za-z0-9_]*):\s*(.*)$/.exec(child.text);
    if (m === null) {
      return err(schemaErr(lineAt(child.lineNo), `malformed line entry "${child.text}" (expected "name: kind args")`, "scene_line_entry_malformed"));
    }
    const name = m[1]!;
    const specText = m[2]!.trim();
    if (seenNames.has(name)) {
      return err(dupId(lineAt(child.lineNo), `duplicate line name "${name}"`, "duplicate_line_name", { name }));
    }
    seenNames.add(name);
    const km = /^(\S+)\s*(.*)$/.exec(specText);
    if (km === null) {
      return err(schemaErr(lineAt(child.lineNo), `line "${name}" has no spec (expected a kind: ride|mistake|naive|plan)`, "scene_line_entry_malformed"));
    }
    out.push({ name, kind: km[1]!, rest: km[2]!.trim(), lineNo: child.lineNo });
  }
  return ok(out);
}

// ---------------------------------------------------------------------------
// lowerScene — the main entry point

/**
 * `lowerScene(sceneText) → Result<FigureSpec>` (design/04 §7; D30). Pure,
 * total, deterministic: identical scene text always lowers to a
 * structurally-identical `FigureSpec` (`P-…` determinism precursor; see
 * `test/cli/scene.test.ts`'s "twice → identical" case).
 */
export function lowerScene(sceneText: string): Result<FigureSpec> {
  const scanned = scanTopLevel(sceneText);
  if (!scanned.ok) return scanned;
  const entries = scanned.value;

  const byKey = new Map<TopLevelKey, TopEntry[]>();
  for (const e of entries) {
    const list = byKey.get(e.key);
    if (list === undefined) byKey.set(e.key, [e]);
    else list.push(e);
  }

  const SINGLETON_KEYS: readonly TopLevelKey[] = ["road", "lines", "marks", "labels", "view", "note"];
  for (const key of SINGLETON_KEYS) {
    const list = byKey.get(key);
    if (list !== undefined && list.length > 1) {
      return err(schemaErr(lineAt(list[1]!.lineNo), `duplicate "${key}:" key (first seen at line ${list[0]!.lineNo})`, "scene_duplicate_key", { key }));
    }
  }
  for (const key of ["road", "marks", "view", "note", "occluders", "hazards"] as const) {
    for (const e of byKey.get(key) ?? []) {
      if (e.children.length > 0) {
        return err(schemaErr(lineAt(e.children[0]!.lineNo), `unexpected indented content under "${key}:"`, "scene_unexpected_indent"));
      }
    }
  }

  // -- road: (required, exactly one) -----------------------------------------
  const roadEntry = byKey.get("road")?.[0];
  if (roadEntry === undefined) {
    return err(schemaErr("road", 'scene requires exactly one "road:" line', "scene_road_missing"));
  }
  const roadTokens = roadEntry.inlineValue.split(/\s+/).filter((t) => t.length > 0);
  const road = parseRoadRefToken(roadTokens, lineAt(roadEntry.lineNo));
  if (!road.ok) return road;

  // -- lines: (required, ≥1 entries, ≥1 `ride`) -------------------------------
  const linesEntry = byKey.get("lines")?.[0];
  if (linesEntry === undefined || linesEntry.children.length === 0) {
    return err(schemaErr("lines", 'scene requires a "lines:" block with at least one entry', "scene_lines_missing"));
  }
  if (linesEntry.inlineValue.length > 0) {
    return err(schemaErr(lineAt(linesEntry.lineNo), '"lines:" takes no inline value — entries are indented below it', "scene_unexpected_indent"));
  }
  const rawLines = parseLinesBlock(linesEntry.children);
  if (!rawLines.ok) return rawLines;
  if (!rawLines.value.some((l) => l.kind === "ride")) {
    return err(
      schemaErr("lines", "no reference line; a mistake needs a first \"ride\" entry to compile against", "scene_no_reference_line")
    );
  }

  const figureLines: FigureLine[] = [];
  let sawRide = false;
  for (const raw of rawLines.value) {
    const at = lineAt(raw.lineNo, raw.name);
    if (raw.kind === "ride") {
      const parsed = parseRideArgs(raw.rest, raw.name, at);
      if (!parsed.ok) return parsed;
      if (parsed.value.solve.entry_kmh === undefined) {
        return err(schemaErr(at, `ride line "${raw.name}" needs entry=<kmh>`, "ride_entry_required"));
      }
      const defaultRole: FigureRole = sawRide ? "alternative" : "ideal";
      sawRide = true;
      figureLines.push({
        name: raw.name,
        role: parsed.value.role ?? defaultRole,
        spec: { ...parsed.value.solve, road: road.value, entry_kmh: parsed.value.solve.entry_kmh } as SolveSpec
      });
    } else if (raw.kind === "mistake") {
      const parsed = parseMistakeToken(raw.rest, at);
      if (!parsed.ok) return parsed;
      if (parsed.value.line_id !== undefined) {
        return err(
          schemaErr(at, `a scene mistake entry supplies its own line id ("${raw.name}") — drop the "${parsed.value.line_id}=" prefix`, "mistake_lineid_not_allowed_in_scene")
        );
      }
      const spec: MistakeSpec = {
        kind: parsed.value.kind,
        ...(parsed.value.params !== undefined ? { params: parsed.value.params } : {}),
        ...(parsed.value.scope !== undefined ? { scope: parsed.value.scope } : {})
      };
      figureLines.push({ name: raw.name, role: "mistake", spec });
    } else if (raw.kind === "naive" || raw.kind === "plan") {
      return err(
        schemaErr(
          at,
          `line kind "${raw.kind}" is design vocabulary (design/04 §7) not reachable through the v0.1 solve/ build (ARCHITECTURE §5) — ` +
            (raw.kind === "plan"
              ? "an explicit-plan line requires file IO, which a pure/total lowerScene cannot perform"
              : "the naive baseline solver is not part of the v0.1 exported surface"),
          "scene_line_kind_unsupported_v0_1",
          { kind: raw.kind }
        )
      );
    } else {
      return err(schemaErr(at, `unknown line kind "${raw.kind}" (expected: ride|mistake|naive|plan)`, "scene_line_kind_unknown"));
    }
  }

  // -- occluders: / hazards: (optional, may repeat) ---------------------------
  const firstIdealLine = figureLines.find((l) => l.role === "ideal")?.name ?? figureLines[0]!.name;

  const occluders: Occluder[] = [];
  for (const e of byKey.get("occluders") ?? []) {
    const at = lineAt(e.lineNo);
    const parsed = parseOccluderOrHazardToken(e.inlineValue, at);
    if (!parsed.ok) return parsed;
    if (parsed.value.occluder === undefined) {
      return err(schemaErr(at, 'a "gravel" token belongs under "hazards:", not "occluders:"', "occluder_token_kind_mismatch"));
    }
    occluders.push(parsed.value.occluder);
  }
  const hazards: Hazard[] = [];
  for (const e of byKey.get("hazards") ?? []) {
    const at = lineAt(e.lineNo);
    const parsed = parseOccluderOrHazardToken(e.inlineValue, at);
    if (!parsed.ok) return parsed;
    if (parsed.value.hazard === undefined) {
      return err(schemaErr(at, 'only a "gravel" token belongs under "hazards:"', "hazard_token_kind_mismatch"));
    }
    hazards.push(parsed.value.hazard);
  }

  // -- marks: (optional) -------------------------------------------------------
  let marks: MarkSpec | undefined;
  const marksEntry = byKey.get("marks")?.[0];
  if (marksEntry !== undefined) {
    const parsed = parseMarkSpec(marksEntry.inlineValue, lineAt(marksEntry.lineNo));
    if (!parsed.ok) return parsed;
    marks = parsed.value;
  }

  // -- labels: (optional) -------------------------------------------------------
  let labels: FigureLabel[] | undefined;
  const labelsEntry = byKey.get("labels")?.[0];
  if (labelsEntry !== undefined) {
    if (labelsEntry.inlineValue.length > 0) {
      return err(schemaErr(lineAt(labelsEntry.lineNo), '"labels:" takes no inline value — entries are indented below it', "scene_unexpected_indent"));
    }
    labels = [];
    const lineNames = new Set(figureLines.map((l) => l.name));
    for (const child of labelsEntry.children) {
      const at = lineAt(child.lineNo);
      const parsed = parseLabelEntry(child.text, at);
      if (!parsed.ok) return parsed;
      const resolvedLine = parsed.value.line.length === 0 ? firstIdealLine : parsed.value.line;
      if (!lineNames.has(resolvedLine)) {
        return err({
          code: "UNKNOWN_ID",
          at,
          message: `label anchors unknown line "${resolvedLine}"`,
          detail: { reason: "anchor_no_match", line: resolvedLine }
        });
      }
      labels.push({ ...parsed.value, line: resolvedLine });
    }
  }

  // -- view: (optional) ---------------------------------------------------------
  let view: Record<string, string> | undefined;
  const viewEntry = byKey.get("view")?.[0];
  if (viewEntry !== undefined) {
    const parsed = parseViewSpec(viewEntry.inlineValue, lineAt(viewEntry.lineNo));
    if (!parsed.ok) return parsed;
    view = parsed.value;
  }

  // -- note: (optional) ----------------------------------------------------------
  let note: string | undefined;
  const noteEntry = byKey.get("note")?.[0];
  if (noteEntry !== undefined) {
    if (hasUnterminatedQuote(noteEntry.inlineValue)) {
      return err(schemaErr(lineAt(noteEntry.lineNo), `unterminated quoted note "${noteEntry.inlineValue}"`, "scene_unterminated_quote"));
    }
    const toks = splitRespectingQuotes(noteEntry.inlineValue);
    const dq = toks.length === 1 ? dequote(toks[0]!) : undefined;
    if (dq === undefined) {
      return err(schemaErr(lineAt(noteEntry.lineNo), "note: must be a single double-quoted string", "scene_note_malformed"));
    }
    note = dq;
  }

  const spec: Figure = {
    road: road.value,
    ...(occluders.length > 0 ? { occluders } : {}),
    ...(hazards.length > 0 ? { hazards } : {}),
    lines: figureLines,
    ...(labels !== undefined ? { labels } : {}),
    ...(marks !== undefined ? { marks } : {}),
    ...(view !== undefined ? { view } : {}),
    ...(note !== undefined ? { note } : {})
  };
  return ok(Object.freeze(spec));
}
