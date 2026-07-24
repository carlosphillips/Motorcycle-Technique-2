import type { LinelabError } from "../core/result.js";
export type DeferredPhase = "inspection (v0.2)" | "immersion (v0.3)" | "projection (post-v0.1)" | "continuation envelope (D45)" | "ensembles (v2)" | "fit (post-v1)";
export interface DeferredRow {
    readonly tokens: readonly string[];
    readonly deferred: DeferredPhase;
}
export declare const DEFERRED_TABLE: readonly DeferredRow[];
/**
 * The closed set of shipped verbs: the 9 v0.1 verbs (ARCHITECTURE scope line,
 * §8 WP-15 row) plus the four v0.2 inspection verbs — `state`, `save-window`,
 * `serve`, `sweep` (design/08 §3 verb table; the inspection verbs exit 0/2/4
 * only — no exit-3 tier, "inspection is not a gate").
 */
export declare const SHIPPED_VERBS: readonly ["run", "solve", "mistake", "figure", "render", "check", "state", "save-window", "serve", "sweep", "schema", "explain", "export"];
export type ShippedVerb = (typeof SHIPPED_VERBS)[number];
export declare function isShippedVerb(v: string): v is ShippedVerb;
/** Deferred verbs named in the design of record but not shipped yet. */
export declare const DEFERRED_VERBS: Readonly<Record<string, DeferredPhase>>;
export declare function deferredFor(token: string): DeferredPhase | undefined;
export declare function deferredError(at: string, token: string, deferred: DeferredPhase, schema_ref?: string): LinelabError;
export type TombstoneReason = "struck_by_decision" | "renamed_kind" | "renamed_check";
export interface TombstoneRow {
    readonly name: string;
    readonly reason: TombstoneReason;
    readonly successor: string | null;
    readonly message: string;
}
export declare const TOMBSTONES: readonly TombstoneRow[];
export declare function tombstoneFor(name: string): TombstoneRow | undefined;
export declare function tombstoneError(at: string, row: TombstoneRow): LinelabError;
