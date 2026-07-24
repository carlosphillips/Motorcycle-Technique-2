// core/hash.ts — canonicalize + 32-bit FNV-1a (ARCHITECTURE §6.3, pinned algorithm).
//
// canonicalize(v): JSON with recursively lexicographically sorted object keys
// (UTF-16 code-unit order), arrays in order, no whitespace, undefined-valued keys
// omitted, -0 normalized to 0, non-finite numbers → INTERNAL. Numbers serialize
// via ECMAScript JSON.stringify (shortest round-trip).
//
// fnv1a32(s): 32-bit FNV-1a (offset 0x811c9dc5, prime 0x01000193) over the UTF-8
// bytes of s, rendered as 8 lowercase hex chars; fnv1a(s) takes the FIRST 6 —
// the spec_hash/result_hash form.

import { err, ok } from "./result.js";
import type { Result } from "./result.js";

// ---------------------------------------------------------------------------
// FNV-1a

const FNV_OFFSET_BASIS = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

function fnv1a32Fold(h: number, byte: number): number {
  // xor the octet, then multiply by the prime, mod 2^32 (Math.imul is exact mod 2^32)
  return Math.imul(h ^ byte, FNV_PRIME) >>> 0;
}

/**
 * 32-bit FNV-1a over the UTF-8 bytes of `s`, as 8 lowercase hex chars.
 * The UTF-8 encoding is done inline (core imports nothing, no TextEncoder
 * dependency); lone surrogates encode as U+FFFD, matching WHATWG encoders.
 */
export function fnv1a32(s: string): string {
  let h = FNV_OFFSET_BASIS;
  for (let i = 0; i < s.length; i++) {
    let cp = s.charCodeAt(i);
    if (cp >= 0xd800 && cp <= 0xdbff) {
      const lo = i + 1 < s.length ? s.charCodeAt(i + 1) : 0;
      if (lo >= 0xdc00 && lo <= 0xdfff) {
        cp = 0x10000 + ((cp - 0xd800) << 10) + (lo - 0xdc00);
        i++;
      } else {
        cp = 0xfffd; // lone high surrogate
      }
    } else if (cp >= 0xdc00 && cp <= 0xdfff) {
      cp = 0xfffd; // lone low surrogate
    }
    if (cp < 0x80) {
      h = fnv1a32Fold(h, cp);
    } else if (cp < 0x800) {
      h = fnv1a32Fold(h, 0xc0 | (cp >> 6));
      h = fnv1a32Fold(h, 0x80 | (cp & 0x3f));
    } else if (cp < 0x10000) {
      h = fnv1a32Fold(h, 0xe0 | (cp >> 12));
      h = fnv1a32Fold(h, 0x80 | ((cp >> 6) & 0x3f));
      h = fnv1a32Fold(h, 0x80 | (cp & 0x3f));
    } else {
      h = fnv1a32Fold(h, 0xf0 | (cp >> 18));
      h = fnv1a32Fold(h, 0x80 | ((cp >> 12) & 0x3f));
      h = fnv1a32Fold(h, 0x80 | ((cp >> 6) & 0x3f));
      h = fnv1a32Fold(h, 0x80 | (cp & 0x3f));
    }
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

/**
 * The hash form used by spec_hash / result_hash: first 6 hex chars of fnv1a32.
 * Usage: `fnv1a(canonicalized)` where `canonicalized` came from canonicalize().
 */
export function fnv1a(s: string): string {
  return fnv1a32(s).slice(0, 6);
}

// ---------------------------------------------------------------------------
// canonicalize

interface CanonFailure {
  readonly canonFailure: true;
  readonly at: string;
  readonly reason: "non_finite_number" | "unserializable_value";
  readonly found: string;
}

function canonFail(at: string, reason: CanonFailure["reason"], found: string): never {
  const failure: CanonFailure = { canonFailure: true, at, reason, found };
  throw failure; // internal control flow only — caught at the canonicalize boundary
}

function isCanonFailure(e: unknown): e is CanonFailure {
  return typeof e === "object" && e !== null && (e as { canonFailure?: unknown }).canonFailure === true;
}

/** Values JSON.stringify would omit as an object member / render null in an array. */
function isOmitted(v: unknown): boolean {
  return v === undefined || typeof v === "function" || typeof v === "symbol";
}

function build(v: unknown, path: string): string {
  if (v === null) return "null";
  switch (typeof v) {
    case "boolean":
      return v ? "true" : "false";
    case "number": {
      if (!Number.isFinite(v)) canonFail(path, "non_finite_number", String(v));
      if (Object.is(v, -0)) return "0"; // -0 normalized (JSON.stringify(-0) is "0" too; explicit for clarity)
      return JSON.stringify(v); // ECMAScript shortest round-trip
    }
    case "string":
      return JSON.stringify(v);
    case "bigint":
      canonFail(path, "unserializable_value", "bigint");
  }
  if (isOmitted(v)) canonFail(path, "unserializable_value", typeof v);
  if (Array.isArray(v)) {
    // arrays keep their order (order is data)
    const parts: string[] = [];
    for (let i = 0; i < v.length; i++) {
      const item: unknown = v[i];
      parts.push(isOmitted(item) ? "null" : build(item, `${path}[${i}]`));
    }
    return `[${parts.join(",")}]`;
  }
  // plain object: recursively sort keys lexicographically (UTF-16 code-unit
  // order — the Array.prototype.sort default), omit undefined-valued keys.
  // Structural by design: toJSON is deliberately NOT consulted (determinism law —
  // canonical form is a pure function of enumerable own data properties).
  const obj = v as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  const parts: string[] = [];
  for (const key of keys) {
    const value = obj[key];
    if (isOmitted(value)) continue; // undefined-valued keys omitted
    parts.push(`${JSON.stringify(key)}:${build(value, `${path}.${key}`)}`);
  }
  return `{${parts.join(",")}}`;
}

/**
 * Canonical JSON of `v` per ARCHITECTURE §6.3. Total over plain finite data;
 * non-finite numbers (and unserializable roots) mint `INTERNAL` — such values
 * are believed-impossible in any hashed structure, so reaching that arm is a
 * linelab bug, reported with the offending path in `error.at`.
 */
export function canonicalize(v: unknown): Result<string> {
  try {
    return ok(build(v, "$"));
  } catch (e) {
    if (isCanonFailure(e)) {
      return err({
        code: "INTERNAL",
        at: e.at,
        message: `canonicalize: ${e.reason === "non_finite_number" ? "non-finite number" : "unserializable value"} (${e.found}) at ${e.at}`,
        detail: { reason: e.reason, found: e.found }
      });
    }
    throw e; // genuinely unexpected — believed impossible
  }
}
