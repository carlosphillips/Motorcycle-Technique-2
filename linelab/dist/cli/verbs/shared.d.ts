import type { LinelabError } from "../../core/result.js";
import type { Result } from "../../core/result.js";
import type { ComposedRoad } from "../../road/types.js";
import type { FigureSpec } from "../../plan/types.js";
import { type ExitCode } from "../exit.js";
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
export declare function okOutcome(value: unknown, writes?: readonly WriteFile[], exit?: ExitCode): VerbOutcome;
export declare function errOutcome(error: LinelabError, exitOverride?: ExitCode): VerbOutcome;
export declare function parseJson(text: string, at?: string): {
    ok: true;
    value: unknown;
} | {
    ok: false;
    error: LinelabError;
};
export declare function isObject(v: unknown): v is Record<string, unknown>;
/** design/08 §3's content sniff: leading `{` after trimming → JSON; else scene text (D30). */
export declare function looksLikeJson(text: string): boolean;
export declare function schemaErr(at: string, message: string, reason: string, detail?: Record<string, unknown>): LinelabError;
/** Lint an already-shape-valid figure: its world must validate, then its `spec_hash` is its identity. */
export declare function lintFigureSpec(spec: FigureSpec): VerbOutcome;
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
export declare function roadWireSpec(road: DisclosedRoad | undefined, at?: string): Result<RoadWireSpec>;
/** THE recompose: the same projection, handed straight to `compose()`. */
export declare function recomposeEnvelopeRoad(road: DisclosedRoad | undefined, at?: string): Result<ComposedRoad>;
