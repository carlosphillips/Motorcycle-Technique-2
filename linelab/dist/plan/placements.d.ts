import type { Result, LinelabError } from "../core/result.js";
import type { Corner, ResolvedOccluder, ResolvedHazard } from "../core/types.js";
import type { Occluder, Hazard } from "./types.js";
export declare function resolveOccluder(raw: Occluder, corners: readonly Corner[], id: string, at: string): Result<ResolvedOccluder>;
export declare function resolveHazard(raw: Hazard, corners: readonly Corner[], id: string, at: string): Result<ResolvedHazard>;
/**
 * design/03 §2: an occluder/hazard placed in the oncoming lane under
 * `use_full_width: true` is refused (track framing and oncoming traffic cannot
 * both be true). `oncomingSide` names which of {inside, outside} reads as
 * oncoming under the placement's governing corner — the caller (validate.ts)
 * already has the hand-aware answer via road/corridor.ts, so this function just
 * takes the pre-computed boolean.
 */
export declare function checkFullWidthOncoming(useFullWidth: boolean, placedInOncomingLane: boolean, at: string): LinelabError | undefined;
/**
 * Parse an occluder-token OR gravel-token (band-shaped grammar; both share
 * `<kind> <side> <anchor> <offset>x<span> [<key>=<val>…]`) into wire form.
 */
export declare function parseOccluderOrHazardToken(token: string, at: string): Result<{
    readonly occluder?: Occluder;
    readonly hazard?: Hazard;
}>;
