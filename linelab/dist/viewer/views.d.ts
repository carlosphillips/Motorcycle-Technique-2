import type { InstantState } from "../core/types.js";
import type { Result } from "../core/result.js";
import { type SaveWindowOverlay } from "./saveWindow.js";
import { type ViewerSession } from "./session.js";
import { type ViewerView } from "./types.js";
export interface ViewRender {
    readonly view: ViewerView;
    readonly line_id: string;
    readonly svg: string;
}
export interface ViewRequest {
    readonly view: string;
    /** the instant the cursor sits at on the focused line, or null for a static draw */
    readonly instant?: InstantState | null;
    /** the focused line's id; defaults to the session's focus */
    readonly line_id?: string;
    /** `true` (v0.1/v0.2) — `diagram` stays phase-gated inside render/project.ts */
    readonly mode?: string;
    /**
     * design/07 §3.6's save-window toggle — OFF BY DEFAULT, per line. When the
     * caller has already computed the once-per-toggle overlay it passes it here
     * and the top-down gains one extra `<g>`; the exported picture is untouched
     * either way (C-SAVEWIN-NO-INK), because `render/` cannot reach this module.
     */
    readonly saveWindow?: SaveWindowOverlay | null;
}
/**
 * Render one view of one session at the cursor. Pure: it never touches a DOM,
 * a timer, or IO — it returns the SVG string the host writes into the pane.
 */
export declare function renderView(session: ViewerSession, req: ViewRequest): Result<ViewRender>;
/**
 * The per-view BOOT smoke check (00 §3's phase table): render every view the
 * viewer offers, once, and report which ones came back. A view that throws or
 * refuses shows up as an error entry rather than a crashed page — the viewer's
 * own never-throw stance, matching `renderTopdown`'s (06 §3).
 */
export declare function bootViews(session: ViewerSession, instant?: InstantState | null): readonly Result<ViewRender>[];
