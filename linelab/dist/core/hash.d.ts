import type { Result } from "./result.js";
/**
 * 32-bit FNV-1a over the UTF-8 bytes of `s`, as 8 lowercase hex chars.
 * The UTF-8 encoding is done inline (core imports nothing, no TextEncoder
 * dependency); lone surrogates encode as U+FFFD, matching WHATWG encoders.
 */
export declare function fnv1a32(s: string): string;
/**
 * The hash form used by spec_hash / result_hash: first 6 hex chars of fnv1a32.
 * Usage: `fnv1a(canonicalized)` where `canonicalized` came from canonicalize().
 */
export declare function fnv1a(s: string): string;
/**
 * Canonical JSON of `v` per ARCHITECTURE §6.3. Total over plain finite data;
 * non-finite numbers (and unserializable roots) mint `INTERNAL` — such values
 * are believed-impossible in any hashed structure, so reaching that arm is a
 * linelab bug, reported with the offending path in `error.at`.
 */
export declare function canonicalize(v: unknown): Result<string>;
