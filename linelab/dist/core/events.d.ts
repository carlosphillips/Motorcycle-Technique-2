import type { Event, EventKind, TerminatedReason } from "./types.js";
import type { LongitudinalAction } from "./controller.js";
/**
 * Reason ↔ event mapping (02 §7): crash→crash, off_road→off_road,
 * stopped→stop (the two spellings are deliberate), road_end→road_end;
 * max_time/max_dist are runaway guards with NO bookmark event.
 */
export declare function terminalEventKind(reason: TerminatedReason): EventKind | null;
/**
 * Longitudinal-activation bookmark kind (05 §5): brake → brake_start;
 * throttle accel = 0.0 → crack (maintenance crack); accel > 0 → roll_on.
 */
export declare function longitudinalEventKind(action: LongitudinalAction): EventKind;
/**
 * Events are strictly ordered by t, ties broken by the EVENT_KINDS declaration
 * order (05 §5). Stable for identical (t, kind) pairs.
 */
export declare function sortEvents(events: readonly Event[]): Event[];
