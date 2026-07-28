// cli/verbs/shared.ts — common types + helpers every verb module uses. Pure
// (ARCHITECTURE §2: only cli/main.ts and cli/bless.ts do IO) — verbs never
// touch fs/argv/stdout directly; they take already-loaded text and return a
// `VerbOutcome` main.ts turns into stdout bytes, file writes, and an exit code.

import type { LinelabError } from "../../core/result.js";
import type { Result } from "../../core/result.js";
import { compose } from "../../road/compose.js";
import type { ComposedRoad } from "../../road/types.js";
import { validateFigureWorld } from "../../plan/validate.js";
import { specHash } from "../../plan/figure.js";
import type { FigureSpec } from "../../plan/types.js";
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
// THE figure lint (design/08 §3: `check` is "Validate only; no simulation …
// Same code path as `figure --check`"). Declared here, once, so that sentence
// is true of the code and not only of the doc: `check` and `figure --check`
// both call this and nothing else.
//
// Two stages, and the second is the one that was missing. SHAPE — already done
// by the caller, since scene text and FigureSpec JSON reach shape-validity by
// different routes (`lowerScene` constructs it, `validateFigureSpec` checks it)
// and lower to the same value (D30). WORLD — `validateFigureWorld`, the road /
// occluder / hazard pass the BAKE runs before it solves a line (solve/run.ts's
// `composeWorld`). Without it the lint knew only that the JSON had the right
// shape, so a super-tight road passed the lint and was refused a verb later by
// `figure` (figures/SCOPE.md §4, S11) — while design/01 §8 rejects that regime
// "at validation" and the scenario door always did. Anything the lint cannot
// decide without solving stays the bake's business; nothing decidable here is
// deferred to it.

/** Lint an already-shape-valid figure: its world must validate, then its `spec_hash` is its identity. */
export function lintFigureSpec(spec: FigureSpec): VerbOutcome {
  const world = validateFigureWorld(spec);
  if (!world.ok) return errOutcome(world.error);
  return okOutcome({ valid: true, spec_hash: specHash(spec) }, undefined, EXIT.OK);
}

// ---------------------------------------------------------------------------
// THE envelope-road marshalling rule (ONE rule, every verb that reads a road
// off a serialized envelope — whether to re-`compose()` it or to re-emit it).
//
// `bike_margin_m` and `use_full_width` are corridor parameters that are
// DELIBERATELY NOT DSL-EXPRESSIBLE (design/03 §2's API law: "`bike_margin_m`,
// `use_full_width`, `ds_m` deliberately NOT DSL-expressible"; `road/types.ts`'s
// `DslRoadSpec` takes them as SEPARATE members beside `dsl`, and `compose()`
// silently falls back to `BIKE_MARGIN_DEFAULT_M`/`false` when they are absent).
// So `dsl` alone is NOT the road — it is the centreline geometry with the
// corridor thrown away. Two consequences, both measured, both live:
//
//   · re-COMPOSING from `dsl` alone rebuilds a different corridor from the one
//     the engine rode, so every `f` recomputed against it is wrong — `stateAt`'s
//     interpolated `sample.f` (`state`), the gravel band and centreline ink
//     (`render`, `export --as svg`).
//   · re-EMITTING `{dsl}` alone (the `export --as figure-spec` / `--as
//     share-url` projection) hands a consumer a spec that recomputes a
//     different corridor — D6's "every consumer recomputes from the spec"
//     (design/05 §8.1) silently stops holding.
//
// The envelope discloses all three: `FigureResult.road` is the `ComposedRoad`
// (design/05 §7, "ONE composed RoadModel"), whose `lane_width_m`,
// `bike_margin_m`, `use_full_width` and `dsl` are DATA members of the frozen
// model (`core/types.ts` `RoadModel`) and survive serialization intact — only
// the closures (`worldAt`, `psi_road`, `dOf`, `fOf`, `muAt`) are lost. The same
// three ride `LineResult.resolved_scenario.road`, the canonical resolved form
// of design/03 §2.1. So the disclosure is sufficient and the rule is simply:
// carry `{dsl, use_full_width, bike_margin_m}` TOGETHER, always. Declared once,
// here, so a fifth reader cannot reintroduce the bug.

/** The serialized shape of a road as an envelope discloses it (data members only). */
export interface DisclosedRoad {
  readonly dsl?: unknown;
  readonly bike_margin_m?: unknown;
  readonly use_full_width?: unknown;
}

/**
 * The wire `road` spec (design/03 §2.1's union, `dsl` arm) that reproduces the
 * disclosed corridor EXACTLY. Key order is fixed so re-emission is byte-stable.
 */
export interface RoadWireSpec {
  readonly dsl: string;
  readonly use_full_width?: boolean;
  readonly bike_margin_m?: number;
}

/** THE projection: disclosed road → the wire spec that rebuilds its corridor. */
export function roadWireSpec(road: DisclosedRoad | undefined, at = "input.road"): Result<RoadWireSpec> {
  const dsl = road?.dsl;
  if (typeof dsl !== "string" || dsl.length === 0) {
    return {
      ok: false,
      error: schemaErr(at, "envelope carries no road.dsl to recompose", "envelope_road_undisclosed")
    };
  }
  return {
    ok: true,
    value: {
      dsl,
      ...(typeof road?.use_full_width === "boolean" ? { use_full_width: road.use_full_width } : {}),
      ...(typeof road?.bike_margin_m === "number" ? { bike_margin_m: road.bike_margin_m } : {})
    }
  };
}

/** THE recompose: the same projection, handed straight to `compose()`. */
export function recomposeEnvelopeRoad(road: DisclosedRoad | undefined, at = "input.road"): Result<ComposedRoad> {
  const spec = roadWireSpec(road, at);
  if (!spec.ok) return spec;
  return compose(spec.value);
}
