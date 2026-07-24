import type { Result } from "../core/result.js";
import type { Corner } from "../core/types.js";
import type { RefAnchor, StationAnchor, WireAnchor } from "./types.js";
export type { RefAnchor, StationAnchor, WireAnchor };
export type AnchorKind = "entry" | "exit" | "mid";
export interface CornerAnchor {
    readonly kind: AnchorKind;
    readonly corner_id: string;
}
/**
 * Parse a ref STRING (wire `at.ref`, or the bare anchor sub-token of a
 * placement/CLI token) into a `CornerAnchor`. Never resolves against a road —
 * that is `resolveAnchor`'s job, which also needs `UNKNOWN_ID` on a missing
 * corner id.
 */
export declare function parseAnchorRef(ref: string, at: string): Result<CornerAnchor>;
/**
 * Parse a full anchor TOKEN (`s:<m>` absolute-station spelling, or any ref
 * form) into a `WireAnchor`. Used for placement tokens (preset-embedded
 * occluders, scene/CLI) — never for JSON `at.ref`, which is already split into
 * `{ref, offset_m?}` at the wire level.
 */
export declare function parseAnchorToken(token: string, at: string): Result<WireAnchor>;
/**
 * Resolve a `WireAnchor` against the composed road's corners into an absolute
 * station. `UNKNOWN_ID` on a corner id that doesn't exist.
 */
export declare function resolveAnchor(anchor: WireAnchor, corners: readonly Corner[], at: string): Result<number>;
