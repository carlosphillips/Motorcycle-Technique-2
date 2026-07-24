import type { Result } from "../core/result.js";
import type { ComposedRoad } from "../road/types.js";
import type { StateAtInput } from "../core/stateAt.js";
import type { FigureResult, LineRefusal, LineResult } from "../solve/types.js";
/**
 * One loaded workstation session: the recomputed envelope, split into the
 * lines that drew and the refusals that did not. A refusal stays a first-class
 * entry (05 §7 — "never a silent drop"): the legend lists it, it simply has no
 * trajectory to scrub.
 */
export interface ViewerSession {
    readonly figure: FigureResult;
    /**
     * The figure's ONE road. `FigureResult.road` is TYPED as the narrower
     * `RoadModel` (core owns the interface it consumes, ARCHITECTURE §4) but
     * `solve/run.ts` always puts a `ComposedRoad` there — `render/` needs the
     * wider members (`segments`, `worldAt`), so `sessionOf` checks and widens
     * ONCE, here, instead of every call site casting. In-process there is no
     * JSON round-trip, so unlike `cli/verbs/render.ts` the viewer never has to
     * re-`compose` from the disclosed `dsl`: it holds the engine's own road.
     */
    readonly road: ComposedRoad;
    readonly lines: readonly LineResult[];
    readonly refusals: readonly LineRefusal[];
    /** the focused line's id — 07 §4.2: exactly one line holds focus */
    readonly focus: string;
}
export interface LoadOptions {
    /** stamped into the envelope by `run`; the CLI threads package.json's version */
    readonly engine_semver?: string;
}
/**
 * `loadSession(spec)` — step 2 of the recompute rule. `spec` is the SPEC
 * document (a FigureSpec, a wire Scenario, or a composed solver input), never
 * an envelope: `run`'s own content sniff (08 §3) decides which, so the viewer
 * inherits the CLI's front door verbatim.
 */
export declare function loadSession(spec: unknown, opts?: LoadOptions): Result<ViewerSession>;
/** Build the view-state wrapper around an already-recomputed envelope. */
export declare function sessionOf(figure: FigureResult): Result<ViewerSession>;
/** Focus switch (07 §4.2: click a glyph/legend entry, or Tab-cycle). */
export declare function withFocus(session: ViewerSession, lineId: string): ViewerSession;
export declare function lineOf(session: ViewerSession, lineId: string): LineResult | null;
export declare function focusedLine(session: ViewerSession): LineResult | null;
/**
 * The `StateAtInput` for one line — the exact four members `core/stateAt.ts`'s
 * dependency-inversion banner names, assembled the exact same way the `state`
 * verb assembles them (`cli/verbs/state.ts`). One assembly rule, two callers;
 * that identity is what makes `C-HUD-EQUALS-STATEAT` a tautology rather than a
 * coincidence.
 */
export declare function stateInputFor(session: ViewerSession, line: LineResult): StateAtInput;
