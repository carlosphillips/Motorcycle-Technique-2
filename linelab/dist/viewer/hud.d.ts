import type { InstantState } from "../core/types.js";
import type { Result } from "../core/result.js";
import { type StateAtQuery } from "../core/stateAt.js";
import type { LineResult } from "../solve/types.js";
import type { HudRow } from "./types.js";
import { type ViewerSession } from "./session.js";
/** One HUD refresh: the queried instant plus the rows drawn from it. */
export interface HudModel {
    readonly line_id: string;
    /** VERBATIM `stateAt` output — the HUD's single source of physics */
    readonly instant: InstantState;
    readonly rows: readonly HudRow[];
}
/**
 * `hudRowsOf(instant, line)` — 07 §3.3's six groups, in the doc's table order,
 * over an already-queried instant. Split out from `hudAt` so a caller holding
 * an `InstantState` from anywhere (including a `linelab state` document parsed
 * back in) gets byte-identical rows.
 */
export declare function hudRowsOf(instant: InstantState, line: LineResult): readonly HudRow[];
/**
 * `hudAt(session, lineId, query)` — one HUD refresh. Exactly one physics call
 * (`stateAt`), and it is the same call, on the same input, that
 * `linelab state --line <id> --s <m>` makes: `C-HUD-EQUALS-STATEAT`.
 * A beyond-domain query returns `stateAt`'s own `BAD_RANGE` untouched — the
 * viewer never silently clamps (05 §4).
 */
export declare function hudAt(session: ViewerSession, lineId: string, query: StateAtQuery): Result<HudModel>;
/**
 * The `C-HUD-EQUALS-STATEAT` reader: resolve a row's declared `path` against
 * the `InstantState` it claims to have read. Exported so the gate test asserts
 * the law with the viewer's own accessor rather than a second path walker.
 */
export declare function instantValueAt(instant: InstantState, path: string): unknown;
