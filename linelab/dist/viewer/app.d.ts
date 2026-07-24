import type { InstantState } from "../core/types.js";
import type { Result } from "../core/result.js";
import { scenarioDomain } from "./stepper.js";
import { type ViewerSession } from "./session.js";
import { type ViewRender } from "./views.js";
import { type SaveWindowOverlay } from "./saveWindow.js";
import type { Bookmark, HudRow, LockMode, StepperState } from "./types.js";
import type { ViewerHost } from "./host.js";
/** The complete view-level state of the workstation (07 §6.3). */
export interface AppState {
    readonly session: ViewerSession;
    readonly stepper: StepperState;
    /** 07 §4.1's lock toggle; compare-mode ghost rendering itself is v0.3 */
    readonly lock: LockMode;
    /**
     * design/07 §3.6's save-window toggle — OFF BY DEFAULT (null), per line, and
     * computed ONCE PER TOGGLE rather than per frame. Holding the finished
     * overlay in the state is what makes "once per toggle" structural: `frameOf`
     * only ever READS it.
     */
    readonly saveWindow: SaveWindowOverlay | null;
}
/** One legend entry — 07 §6.1's "line legend (role, verdict colour, focus control)". */
export interface LegendEntry {
    readonly line_id: string;
    readonly role: string;
    readonly label: string;
    readonly quality: string;
    readonly outcome: string;
    readonly focused: boolean;
}
/** Everything the page shows at one cursor position. Pure function of `AppState`. */
export interface AppFrame {
    readonly cursor: StepperState;
    readonly domain: {
        readonly min: number;
        readonly max: number;
    };
    readonly instant: InstantState | null;
    readonly hud: readonly HudRow[];
    readonly bookmarks: readonly Bookmark[];
    readonly views: readonly ViewRender[];
    readonly legend: readonly LegendEntry[];
    /**
     * 07 §3.6's scrubber ticks, "in the overlay register and visually distinct
     * from event ticks" — empty while the toggle is off, which is the default.
     */
    readonly save_window_ticks: readonly {
        readonly corner_id: string;
        readonly t: number;
    }[];
    /** terminal badge text keyed to `terminated.reason` (07 §3.4), or "" while running */
    readonly terminal: string;
    /** non-empty when the frame could not be fully built (never throws) */
    readonly problems: readonly string[];
}
/** design/07 §3.4's placard, verbatim — the off-road badge's disclosure. */
export declare const OFF_ROAD_PLACARD = "left the road \u2014 off-road behaviour not modelled";
export declare function createApp(session: ViewerSession): AppState;
/**
 * design/07 §3.6's toggle. ON computes the overlay ONCE (one `saveWindow(line)`
 * call for the focused line); OFF drops it. A refusal leaves the toggle off and
 * is reported through `frameOf`'s `problems` on the next frame rather than
 * throwing — the viewer's never-throw stance.
 */
export declare function toggleSaveWindow(app: AppState): AppState;
/**
 * The scrubber's extent: the whole scenario, not the focused line (07 §3.4 —
 * "the cursor remains draggable across the full scenario extent so surviving
 * lines in compare mode keep stepping").
 */
export declare function domainFor(app: AppState): ReturnType<typeof scenarioDomain>;
/**
 * `frameOf(app)` — the whole page, derived. Never throws: a query outside the
 * focused line's domain (which happens by construction once a short line has
 * ended and the scenario cursor runs past it) freezes the HUD at that line's
 * terminal sample and records the reason in `problems`, exactly as 07 §3.4
 * requires ("a line that ends early freezes at its terminal sample").
 */
export declare function frameOf(app: AppState): AppFrame;
export declare function scrub(app: AppState, value: number): AppState;
export declare function togglePlay(app: AppState): AppState;
export declare function setSpeed(app: AppState, speed: number): AppState;
export declare function tick(app: AppState, wallDeltaS: number): AppState;
export declare function nudgeFrame(app: AppState, direction: 1 | -1): AppState;
export declare function nudgeSample(app: AppState, direction: 1 | -1): AppState;
export declare function flipAxis(app: AppState): AppState;
export declare function setLock(app: AppState, lock: LockMode): AppState;
export declare function focusLine(app: AppState, lineId: string): AppState;
/** Bookmark jump — the events-only pathway (07 §3.1, `C-BOOKMARKS`). */
export declare function jumpToBookmark(app: AppState, token: string): AppState;
/** 07 §3.3's panel, as one table: group, label, value. */
export declare function hudHtml(rows: readonly HudRow[]): string;
/** The named-event ticks as `<option>`s; the option VALUE is the serialized bookmark. */
export declare function bookmarkOptionsHtml(bookmarks: readonly Bookmark[]): string;
export declare function legendHtml(entries: readonly LegendEntry[]): string;
export interface AppHandle {
    /** stop playback's timer; leaves the page as it is */
    dispose(): void;
    /** the current pure state — exposed so a driver can assert against it */
    state(): AppState;
    /** force a re-render (the same path every control takes) */
    refresh(): void;
}
/**
 * `boot(host, payloadText)` — 07 §6.2's "CLI handoff" door. `payloadText` is
 * the SPEC (scenario + line specs), never a trajectory: the viewer recomputes
 * (§2.1). Returns `Result` rather than throwing, so a bad payload paints a
 * typed message instead of a blank page.
 */
export declare function boot(host: ViewerHost, payloadText: string, engineSemver?: string): Result<AppHandle>;
