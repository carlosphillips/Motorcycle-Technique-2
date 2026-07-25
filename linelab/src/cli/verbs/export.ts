// cli/verbs/export.ts — the `export` verb (design/08 §3, D31): shareable
// artifacts off an envelope — the canonical envelope/figure-spec/scenario
// JSON, the per-metre trace CSV (SAMPLE_FIELDS column order,
// `<figure_id>.<line_id>.csv` naming), the rendered SVG, and a share-url
// fragment. `--as` is required and closed.

import { SAMPLE_FIELDS } from "../../core/types.js";
import type { LineResult } from "../../solve/types.js";
import { isLineRefusal } from "../../solve/envelope.js";
import { renderViews } from "../../render/index.js";
import { canonicalize } from "../../core/hash.js";
import { EXIT } from "../exit.js";
import { parseZeroFileFlags } from "../args.js";
import {
  errOutcome,
  okOutcome,
  isObject,
  parseJson,
  recomposeEnvelopeRoad,
  roadWireSpec,
  schemaErr,
  type DisclosedRoad,
  type VerbOutcome,
  type WriteFile
} from "./shared.js";

export interface ExportVerbInput {
  readonly loadedText: string;
  readonly argv: readonly string[];
  readonly engineSemver: string;
}

const EXPORT_AS = ["share-url", "trace-csv", "svg", "envelope", "scenario", "figure-spec"] as const;
type ExportAs = (typeof EXPORT_AS)[number];

function csvOf(line: LineResult): string {
  const header = SAMPLE_FIELDS.join(",");
  const rows = line.trajectory.samples.map((s) =>
    SAMPLE_FIELDS.map((f) => {
      const v = (s as unknown as Record<string, unknown>)[f];
      if (v === null || v === undefined) return "";
      if (typeof v === "number") return Number.isFinite(v) ? String(v) : "";
      if (typeof v === "boolean") return v ? "true" : "false";
      return String(v);
    }).join(",")
  );
  return [header, ...rows].join("\n");
}

function selectLines(lines: readonly LineResult[], lineId: string | undefined, all: boolean): { ok: true; value: readonly LineResult[] } | { ok: false; error: import("../../core/result.js").LinelabError } {
  if (all) return { ok: true, value: lines };
  if (lineId !== undefined) {
    const found = lines.find((l) => l.line_id === lineId);
    if (found === undefined) {
      return { ok: false, error: schemaErr("--line", `no line "${lineId}" (available: ${lines.map((l) => l.line_id).join(", ")})`, "line_selector_required") };
    }
    return { ok: true, value: [found] };
  }
  if (lines.length === 1) return { ok: true, value: lines };
  return { ok: false, error: schemaErr("--line", `ambiguous line — pass --line or --all (available: ${lines.map((l) => l.line_id).join(", ")})`, "line_selector_required") };
}

// RECORDED DEFECT — the FigureSpec projection drops the corridor, and the
// repair is an IDENTITY MOVE, not a marshalling fix.
//
// `road: {dsl}` throws away `use_full_width`/`bike_margin_m`, exactly the two
// members design/03 §2 makes non-DSL-expressible, so the projection of a
// non-default-corridor envelope is not the road the engine rode. Measured, on
// `run --road "lane 3.5 | S 35 | R 30 ^90 | S 25" --entry 63 --bike-margin 0.9`:
// the projection recomputes to ZERO lines — `SCHEMA/line_road_differs` — because
// `solve/run.ts`'s `figureLineSolveSpec` (L720) compares a line's road to the
// figure's by CANONICAL JSON of the authored spec, and the line still spells
// `{dsl, bike_margin_m: 0.9}`. So the failure mode today is a typed REFUSAL, not
// a silently wrong corridor: `export --as figure-spec` / `--as share-url` /
// `serve` are unusable on such envelopes, but they never lie about one.
//
// Carrying the corridor here (and re-stamping each line's road to match, which
// is what makes `line_road_differs` go away — verified: both fixtures then
// recompute with no refusal) also re-spells the FigureSpec, which moves
// `spec_hash`, which is INSIDE the `result_hash` input — the exclusion set is
// closed at `{result_hash, diagnosis, cache, skew, commitment}` (ARCHITECTURE
// §6.3) — so every envelope's identity moves. Measured on the default-corridor
// `serve` fixture: spec_hash ac968b → 120886, result_hash b8471c → 3794aa, with
// the physics BYTE-IDENTICAL (plans equal, max |Δ(x, f)| = 0 over 216 samples).
// That is a re-bless event owned by `solve/` (the road-equality rule and the
// canonical spelling of `source.*.road`), not something a CLI marshalling
// repair may do on its own. Left as-is, deliberately; pinned by
// test/cli/road-marshalling.test.ts so it cannot rot silently.
function figureSpecFromEnvelope(envelope: Record<string, unknown>): Record<string, unknown> {
  const linesRaw = (envelope["lines"] as unknown[]) ?? [];
  const lines = linesRaw
    .filter((l): l is LineResult => !isLineRefusal(l as never))
    .map((l) => {
      const source = l.source;
      const spec =
        source.kind === "solve"
          ? source.solveSpec
          : source.kind === "mistake"
            ? { kind: source.mistakeSpec.kind, ...(source.mistakeSpec.params !== undefined ? { params: source.mistakeSpec.params } : {}), ...(source.mistakeSpec.scope !== undefined ? { scope: source.mistakeSpec.scope } : {}) }
            : source.kind === "scenario"
              ? source.scenario
              : { kind: "underread" }; // misjudge sugar fallback (best-effort projection)
      return { name: l.line_id, role: l.role, spec };
    });
  return {
    road: (envelope["road"] as { dsl?: string })?.dsl !== undefined ? { dsl: (envelope["road"] as { dsl: string }).dsl } : envelope["road"],
    lines
  };
}

export function exportVerb(input: ExportVerbInput): VerbOutcome {
  const parsed = parseZeroFileFlags(input.argv);
  if (!parsed.ok) return errOutcome(parsed.error);
  const as = parsed.value.as;
  if (as === undefined || !(EXPORT_AS as readonly string[]).includes(as)) {
    return errOutcome(schemaErr("--as", `--as must be one of ${EXPORT_AS.join(", ")}`, "export_as_unknown"));
  }

  const j = parseJson(input.loadedText, "input");
  if (!j.ok) return errOutcome(j.error);
  if (!isObject(j.value) || !Array.isArray(j.value["lines"])) {
    return errOutcome(schemaErr("input", "export input must be an envelope ({figure_id, road, lines, …})", "export_input_not_envelope"));
  }
  const envelope = j.value;
  const figureId = typeof envelope["figure_id"] === "string" ? envelope["figure_id"] : "figure";
  const allLines = (envelope["lines"] as unknown[]).filter((l): l is LineResult => !isLineRefusal(l as never)) as LineResult[];

  const asTyped = as as ExportAs;

  if (asTyped === "envelope") {
    return okOutcome(envelope, undefined, EXIT.OK);
  }

  if (asTyped === "figure-spec") {
    const fig = figureSpecFromEnvelope(envelope);
    return okOutcome(fig, undefined, EXIT.OK);
  }

  if (asTyped === "scenario") {
    const sel = selectLines(allLines, parsed.value.line, false);
    if (!sel.ok) return errOutcome(sel.error);
    const line = sel.value[0]!;
    // the wire `road` union takes exactly one of segments|preset|dsl (03 §2.1);
    // `resolved_scenario.road` (ValidatedRoadSpec) always carries BOTH segments
    // AND dsl together — re-emit the `dsl` arm so the re-run is a valid wire
    // document (09's re-run pin, A-RESOLVED-RERUN), through shared.ts's ONE
    // projection so the corridor members ride along with it.
    const rs = line.resolved_scenario;
    const roadSpec = roadWireSpec(rs.road, "resolved_scenario.road");
    if (!roadSpec.ok) return errOutcome(roadSpec.error);
    return okOutcome(
      { ...rs, spec: "linelab/1", id: line.line_id, road: roadSpec.value },
      undefined,
      EXIT.OK
    );
  }

  if (asTyped === "trace-csv") {
    const sel = selectLines(allLines, parsed.value.line, parsed.value.all);
    if (!sel.ok) return errOutcome(sel.error);
    const writes: WriteFile[] = sel.value.map((l) => ({
      path: (parsed.value.out ?? ".") + `/${figureId}.${l.line_id}.csv`,
      content: csvOf(l)
    }));
    return okOutcome({ written: writes.map((w) => w.path) }, writes, EXIT.OK);
  }

  if (asTyped === "svg") {
    if (parsed.value.out === undefined) {
      return errOutcome(schemaErr("--out", "--as svg needs --out <dir>", "export_svg_needs_out"));
    }
    // recompose through shared.ts's ONE rule — a JSON round-trip strips a
    // ComposedRoad's function members, and the disclosed `dsl` alone omits
    // `bike_margin_m`/`use_full_width` (see render.ts's identical note).
    const recomposed = recomposeEnvelopeRoad(envelope["road"] as DisclosedRoad | undefined);
    if (!recomposed.ok) return errOutcome(recomposed.error);
    const rendered = renderViews({ road: recomposed.value, lines: allLines });
    if (!rendered.ok) return errOutcome(rendered.error);
    const path = `${parsed.value.out}/${figureId}.svg`;
    return okOutcome({ written: [path] }, [{ path, content: rendered.value.svg }], EXIT.OK);
  }

  // share-url (D31/D6): `#f=<base64 canonical FigureSpec>` — full line set, stamped
  const fig = figureSpecFromEnvelope(envelope);
  const stamped = { ...fig, engine_semver: input.engineSemver };
  const canon = canonicalize(stamped);
  const b64 = base64Utf8(canon.ok ? canon.value : JSON.stringify(stamped));
  return okOutcome({ url: `#f=${b64}` }, undefined, EXIT.OK);
}

// ---------------------------------------------------------------------------
// base64 of a UTF-8 string, by hand.
//
// `Buffer` is a NODE global, and ARCHITECTURE §2 confines runtime globals to
// `cli/main.ts` and `cli/bless.ts`; every other file in `src/` — this one
// included — must be pure and platform-free, because the same emitted module
// graph is what the browser loads (D1). The encoder below is byte-identical to
// `Buffer.from(s, "utf8").toString("base64")` and runs anywhere.
//
// DECLARED GAP: design/05 §8.1 specifies `deflateRaw` + base64url for the share
// string. This build emits PLAIN base64 of the canonical FigureSpec with no
// compression — the share door's decoder (07 §6.2 door 2) is not shipped, so
// nothing consumes the encoding yet and settling it is a prerequisite of that
// door, not of this verb. Recorded in DEVIATIONS.md.

const B64_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

/** UTF-8 bytes of a JS string (surrogate pairs folded into 4-byte sequences). */
function utf8Bytes(s: string): number[] {
  const out: number[] = [];
  for (let i = 0; i < s.length; i++) {
    let cp = s.charCodeAt(i);
    if (cp >= 0xd800 && cp <= 0xdbff && i + 1 < s.length) {
      const lo = s.charCodeAt(i + 1);
      if (lo >= 0xdc00 && lo <= 0xdfff) {
        cp = 0x10000 + ((cp - 0xd800) << 10) + (lo - 0xdc00);
        i++;
      }
    }
    if (cp < 0x80) out.push(cp);
    else if (cp < 0x800) out.push(0xc0 | (cp >> 6), 0x80 | (cp & 0x3f));
    else if (cp < 0x10000) out.push(0xe0 | (cp >> 12), 0x80 | ((cp >> 6) & 0x3f), 0x80 | (cp & 0x3f));
    else out.push(0xf0 | (cp >> 18), 0x80 | ((cp >> 12) & 0x3f), 0x80 | ((cp >> 6) & 0x3f), 0x80 | (cp & 0x3f));
  }
  return out;
}

export function base64Utf8(s: string): string {
  const bytes = utf8Bytes(s);
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i]!;
    const b1 = bytes[i + 1];
    const b2 = bytes[i + 2];
    out += B64_ALPHABET[b0 >> 2];
    out += B64_ALPHABET[((b0 & 0x03) << 4) | ((b1 ?? 0) >> 4)];
    out += b1 === undefined ? "=" : B64_ALPHABET[((b1 & 0x0f) << 2) | ((b2 ?? 0) >> 6)];
    out += b2 === undefined ? "=" : B64_ALPHABET[b2 & 0x3f];
  }
  return out;
}
