import type { InstantState } from "../core/types.js";
import type { DrawnScene } from "../render/scene.js";
import type { LockMode } from "./types.js";
import { type ViewerSession } from "./session.js";
/** design/07 §4.1 — the shared lock axis: station `s` (default) or elapsed `t`. */
export declare function lockAxisOf(lock: LockMode): "s" | "t";
/** One line's state at the shared lock coordinate — the compare-mode ghost. */
export interface GhostState {
    readonly line_id: string;
    readonly role: string;
    /** the verdict colour source (D9) — retained at ghost opacity, never re-derived */
    readonly quality: string;
    readonly outcome: string;
    /** the one line that owns the HUD, the POV camera and full opacity (07 §4.2) */
    readonly focused: boolean;
    /** THIS line's OWN `stateAt` at the shared lock coordinate (null if it could not resolve) */
    readonly instant: InstantState | null;
    /** the coordinate actually queried on this line — clamped into its own domain (07 §3.4) */
    readonly at: number;
    /** true when the shared coordinate lay past this line's extent (frozen at its terminal, 07 §3.4) */
    readonly frozen: boolean;
}
/** The whole compare picture at one cursor: every line's own state at one shared coordinate. */
export interface CompareModel {
    readonly lock: LockMode;
    readonly lock_axis: "s" | "t";
    /** the shared coordinate — the focused line's own `s` (station lock) or `t` (time lock) at the cursor */
    readonly lock_coord: number;
    readonly ghosts: readonly GhostState[];
}
/**
 * `compareModel(session, focusInstant, lock)` — the compare picture at one
 * cursor. `focusInstant` is the FOCUSED line's own instant at the cursor
 * (already domain-clamped by the caller); the shared coordinate is that
 * instant's `s` (station lock) or `t` (time lock). Every line — the focused one
 * included, so the model is a complete picture — is then read at that
 * coordinate through its OWN `stateAt` (C-COMPARE: no shared or leaked state).
 */
export declare function compareModel(session: ViewerSession, focusInstant: InstantState, lock: LockMode): CompareModel;
/**
 * Ghost-glyph overlay for the NON-focused lines (07 §4.2: "ghost glyphs, reduced
 * opacity, verdict colour retained, on the topdown"). The focused line keeps its
 * own full-opacity cursor glyph (viewer/glyph.ts); these are the others, each at
 * its OWN position at the shared lock coordinate. Empty string when the session
 * has one drawable line (no one to compare against) — so a single-line topdown
 * is byte-identical to the v0.2 picture.
 *
 * Colour is `placeGlyph`'s own `QUALITY_COLOUR[verdict.quality]` (D9), reduced
 * only in OPACITY by a wrapping `<g>` — no line ink is modulated (D9 holds).
 */
export declare function compareGhostsSvg(session: ViewerSession, model: CompareModel, scene: DrawnScene): string;
