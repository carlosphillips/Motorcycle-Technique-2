import type { ComposedRoad } from "../road/types.js";
import type { LineResult } from "../solve/types.js";
import type { Sample, ResolvedOccluder, OccluderKind, SightTrend } from "../core/types.js";
/** design/07 §5.2 — the `look` camera toggle, a closed two-value set. */
export declare const POV_LOOK_MODES: readonly ["heading", "limit_point"];
export type PovLook = (typeof POV_LOOK_MODES)[number];
/**
 * design/06 §2.1 / design/07 §5.3 — how the frame carries lean.
 *
 * `lean` is the engine default and the design's signature honesty: the whole
 * image rotates with `phi`, so the horizon angle IS the lean readout.
 *
 * `level` keeps the camera upright and moves lean into a HUD dial instead.
 * That is the BOOK's setting, for a reason that is about the reader and not
 * about the physics: a learner reading a still figure has no vestibular sense
 * to cancel the roll with, so a 30° tilt does not read as "I am leaning", it
 * reads as "the road is falling out of the frame". Both modes draw the same
 * lean; they differ only in which channel carries it.
 */
export declare const POV_ROLL_MODES: readonly ["lean", "level"];
export type PovRoll = (typeof POV_ROLL_MODES)[number];
/** design/07 §5.3 item 7 — the limit-point marker's presentation state (closed set; rides the frame draw list). */
export declare const POV_MARKER_STATES: readonly ["placed", "clamped"];
export type MarkerState = (typeof POV_MARKER_STATES)[number];
export interface Pt {
    readonly x: number;
    readonly y: number;
}
export interface PovLimitMarker {
    /** the recorded limit point's WORLD coordinates — `(Sample.limit_x, Sample.limit_y)`, the SAME source the topdown sight ray points at (C-POV-LIMIT-CONSISTENT). Invariant across both `look` modes. */
    readonly world: Pt;
    readonly markerState: MarkerState;
    /** the on-frame glyph position (chevron centre): the projected point when placed, the R_inset-boundary intersection when clamped. */
    readonly screen: Pt;
    /** the outward gaze-direction arrow — present IFF `markerState === "clamped"` (its presence is the off-frame signal, §5.3 item 7). */
    readonly arrow: {
        readonly dx: number;
        readonly dy: number;
        readonly length: number;
    } | null;
    /** opening / closing / steady badge, from the recorded sight channel (presentation-only). */
    readonly trend: SightTrend;
}
interface PovOccluder {
    readonly id: string;
    readonly kind: OccluderKind;
    /** extruded vertical faces (one quad per footprint edge), already sorted far→near for painter's order. */
    readonly quads: readonly (readonly Pt[])[];
}
export interface PovFrame {
    readonly width: number;
    readonly height: number;
    readonly look: PovLook;
    readonly roll: PovRoll;
    /** the resolved camera yaw (deg) — `psi` under `heading`; `psi + clamp(wrapDeg(bearing−psi), ±LOOK_MAX_DEG)` under `limit_point` (§5.2). */
    readonly yaw_deg: number;
    /** the recorded lean (deg). Under roll `lean` the frame is rotated by it — the horizon angle IS the lean readout (§5.2); under `level` the HUD dial carries it instead. */
    readonly phi_deg: number;
    readonly eye: Pt;
    readonly focal_px: number;
    readonly principal: Pt;
    /** stage 1 — the ground polygon below the rolled horizon (sky is the frame fill above it). */
    readonly ground: readonly Pt[];
    /** stage 2 — the road surface as per-station quads, far→near; empty when no span is in front of the camera. */
    readonly road: readonly (readonly Pt[])[];
    /** stage 3 — centreline + lane-edge polylines, split into contiguous visible runs. */
    readonly laneLines: readonly (readonly Pt[])[];
    /** stage 5 (partial) — the "what you can see" surface, as quads over the station span the rider can see. */
    readonly sightBand: readonly (readonly Pt[])[];
    /** stage 4 — occluder quads, sorted far→near (occlusion by paint order). */
    readonly occluders: readonly PovOccluder[];
    /**
     * stage 6 — the focused line's path ahead of the cursor, in verdict colour,
     * as visible runs. `offFrame` is non-null exactly when NO run touches the
     * frame: the rider is looking somewhere their line does not go, and the
     * marker on the frame edge says which way it went.
     */
    readonly path: {
        readonly runs: readonly (readonly Pt[])[];
        readonly colour: string;
        readonly offFrame: {
            readonly at: Pt;
            readonly dx: number;
            readonly dy: number;
        } | null;
    } | null;
    /** stage 7 — the limit-point marker (unconditional: exactly one per frame, D40). */
    readonly limit: PovLimitMarker;
    /** stage 8 — the heading tick on the horizon (only under `look: limit_point`, disclosing the head-turn), else null. */
    readonly headingTick: Pt | null;
    /** HUD numbers (stage 8 strip) — read straight off the recorded Sample, no UI arithmetic. */
    readonly hud: {
        readonly v_kmh: number;
        readonly phi_deg: number;
        readonly sight_ride_m: number;
        readonly ssd_m: number;
        readonly clipped: boolean;
    };
}
export interface PovFrameInput {
    readonly road: ComposedRoad;
    readonly occluders: readonly ResolvedOccluder[];
    /** the focused line — its verdict colour paints the path overlay (D9). */
    readonly line: LineResult;
    /** the cursor's resolved Sample — the camera pose and the recorded limit point. */
    readonly sample: Sample;
    readonly look: PovLook;
    /** frame roll; defaults to `lean` (the engine default — design/07 §5.3). */
    readonly roll?: PovRoll;
    readonly width?: number;
    readonly height?: number;
    /** presentation trend badge for the limit marker; default "steady". */
    readonly trend?: SightTrend;
}
/**
 * design/07 §5.2 — the yaw law. `heading`: yaw = psi. `limit_point`:
 * `bearing = atan2(limit_y − y, limit_x − x)`,
 * `yaw = psi + clamp(wrapDeg(bearing − psi), −LOOK_MAX_DEG, +LOOK_MAX_DEG)`.
 * All in degrees (the Sample's own unit); returns degrees.
 */
export declare function povYawDeg(sample: Sample, look: PovLook): number;
/** Build the POV draw list for one cursor Sample. Pure; the design's `frame(result, lineId, cursor, look)`. */
export declare function povFrame(input: PovFrameInput): PovFrame;
/**
 * `renderPov(input) → SvgString` (design/06 §6 self-contained SVG law): the
 * pure POV frame as a self-contained SVG string. NEVER throws — any failure is
 * caught and returned as `fallbackSvg(msg)`, exactly as `renderTopdown` does.
 */
export declare function renderPov(input: PovFrameInput): string;
/** The focused line: ideal wins, else the highest-priority role in draw order, else the first. */
export declare function povFocusLine(lines: readonly LineResult[]): LineResult | undefined;
/** A deterministic default cursor sample: nearest the first corner's mid-station, else the mid sample. */
export declare function povDefaultSample(road: ComposedRoad, line: LineResult): Sample | undefined;
/**
 * The static POV render target: pick the focused line + default cursor and
 * emit a self-contained SVG. `null`-safe — an empty/sampleless line yields a
 * `fallbackSvg` (never throws).
 */
export declare function renderPovForFigure(road: ComposedRoad, lines: readonly LineResult[], look: PovLook, roll?: PovRoll): string;
export {};
