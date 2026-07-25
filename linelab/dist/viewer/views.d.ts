import type { InstantState } from "../core/types.js";
import type { Result } from "../core/result.js";
import { type SaveWindowOverlay } from "./saveWindow.js";
import { type CorrectiveGhostOverlay } from "./correctiveGhost.js";
import { type CompareModel } from "./compare.js";
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
    /**
     * design/07 §3.5's corrective-ghost toggle — OFF BY DEFAULT, per line, a
     * third overlay class (07 §5.6). Same discipline as `saveWindow`: a
     * once-per-toggle object passed in, one extra `<g>` on the top-down, the
     * exported figure untouched — the ghost is stepper-only (D18).
     */
    readonly correctiveGhost?: CorrectiveGhostOverlay | null;
    /**
     * design/07 §5.2's `look` camera toggle (`heading | limit_point`), consumed by
     * the `pov` view. Default `heading`; an unknown value is `SCHEMA` (closed set,
     * D8). Ignored by `topdown`/`controls`.
     */
    readonly look?: string;
    /**
     * design/07 §4.2's compare model — when present, the top-down draws the
     * NON-focused lines as ghost glyphs (reduced opacity, verdict colour retained)
     * at their own state at the shared lock coordinate. Absent (the v0.2 default)
     * draws no ghosts, so the top-down is byte-identical to the export + cursor.
     */
    readonly compare?: CompareModel | null;
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
