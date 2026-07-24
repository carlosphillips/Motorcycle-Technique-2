// cli/verbs/shared.ts — common types + helpers every verb module uses. Pure
// (ARCHITECTURE §2: only cli/main.ts and cli/bless.ts do IO) — verbs never
// touch fs/argv/stdout directly; they take already-loaded text and return a
// `VerbOutcome` main.ts turns into stdout bytes, file writes, and an exit code.

import type { LinelabError } from "../../core/result.js";
import type { Result } from "../../core/result.js";
import { compose } from "../../road/compose.js";
import type { ComposedRoad } from "../../road/types.js";
import { exitForErrorCode, EXIT, type ExitCode } from "../exit.js";

export interface WriteFile {
  readonly path: string;
  readonly content: string;
}

export interface VerbOutcome {
  /** the ONE JSON document (design/08 §3.2) */
  readonly stdout: unknown;
  readonly exit: ExitCode;
  readonly stderr?: string;
  readonly writes?: readonly WriteFile[];
}

export function okOutcome(value: unknown, writes?: readonly WriteFile[], exit: ExitCode = EXIT.OK): VerbOutcome {
  return { stdout: { ok: true, value }, exit, ...(writes !== undefined ? { writes } : {}) };
}

export function errOutcome(error: LinelabError, exitOverride?: ExitCode): VerbOutcome {
  return { stdout: { ok: false, error }, exit: exitOverride ?? exitForErrorCode(error.code) };
}

export function parseJson(text: string, at = "input"): { ok: true; value: unknown } | { ok: false; error: LinelabError } {
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch (e) {
    return {
      ok: false,
      error: {
        code: "SCHEMA",
        at,
        message: `invalid JSON: ${e instanceof Error ? e.message : String(e)}`,
        detail: { reason: "json_parse_error" }
      }
    };
  }
}

export function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** design/08 §3's content sniff: leading `{` after trimming → JSON; else scene text (D30). */
export function looksLikeJson(text: string): boolean {
  return text.trimStart().startsWith("{");
}

export function schemaErr(at: string, message: string, reason: string, detail?: Record<string, unknown>): LinelabError {
  return { code: "SCHEMA", at, message, detail: { reason, ...detail } };
}

// ---------------------------------------------------------------------------
// THE envelope-road recompose rule (one rule, every verb that reads an
// envelope off disk).
//
// A JSON round-trip strips a `ComposedRoad`'s function members (`worldAt`,
// `psi_road`, `dOf`, `fOf`, `muAt` are closures), so every verb that loads an
// envelope must re-`compose()` the road. The disclosed `dsl` is NOT enough:
// `bike_margin_m` and `use_full_width` are corridor parameters that the DSL
// string does not carry (road/types.ts `DslRoadSpec` takes them as SEPARATE
// members, and `compose()` falls back to the defaults when they are absent).
// Recomposing from `dsl` alone therefore rebuilds a DIFFERENT corridor from the
// one the engine rode, and every recomputed `f` — `stateAt`'s interpolated
// `sample.f`, `render`'s corridor ink, `export --as svg` — is wrong.
//
// The envelope discloses all three (`solve/run.ts` puts the ComposedRoad in
// `FigureResult.road`, whose data members survive serialization), so the rule
// is: recompose from the disclosed `{dsl, bike_margin_m, use_full_width}`
// TOGETHER. Declared once, here, so a fifth reader cannot reintroduce the bug.

/** The serialized shape of an envelope's `road` member (data members only). */
export interface DisclosedRoad {
  readonly dsl?: unknown;
  readonly bike_margin_m?: unknown;
  readonly use_full_width?: unknown;
}

export function recomposeEnvelopeRoad(road: DisclosedRoad | undefined, at = "input.road"): Result<ComposedRoad> {
  const dsl = road?.dsl;
  if (typeof dsl !== "string" || dsl.length === 0) {
    return {
      ok: false,
      error: schemaErr(at, "envelope carries no road.dsl to recompose", "envelope_road_undisclosed")
    };
  }
  return compose({
    dsl,
    ...(typeof road?.bike_margin_m === "number" ? { bike_margin_m: road.bike_margin_m } : {}),
    ...(typeof road?.use_full_width === "boolean" ? { use_full_width: road.use_full_width } : {})
  });
}
