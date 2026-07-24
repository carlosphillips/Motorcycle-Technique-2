// core/events.ts — in-run event emission helpers and the reason↔event mapping
// (design/02 §7, design/05 §5). The integrator collects event drafts (exact
// bracketed crossings, never snapped to the 0.5 m grid) and this module orders
// and freezes them.
//
// In-run kinds emitted by the engine: brake_start, brake_end, crack, roll_on,
// turn_in, steering_complete, release, position_start, position_complete,
// position_shortfall, plus the terminal bookmark. Post-hoc kinds (apex, exit,
// sight_min, hazard_visible, run_wide_detect, correction, violation) are
// injected later by the analyzers / corrective shot (WP-07/WP-08/WP-09) into
// the same array — one event source, every consumer.
import { EVENT_KINDS } from "./types.js";
/**
 * Reason ↔ event mapping (02 §7): crash→crash, off_road→off_road,
 * stopped→stop (the two spellings are deliberate), road_end→road_end;
 * max_time/max_dist are runaway guards with NO bookmark event.
 */
export function terminalEventKind(reason) {
    switch (reason) {
        case "crash":
            return "crash";
        case "off_road":
            return "off_road";
        case "stopped":
            return "stop";
        case "road_end":
            return "road_end";
        case "max_time":
        case "max_dist":
            return null;
    }
}
/**
 * Longitudinal-activation bookmark kind (05 §5): brake → brake_start;
 * throttle accel = 0.0 → crack (maintenance crack); accel > 0 → roll_on.
 */
export function longitudinalEventKind(action) {
    if (action.do === "brake")
        return "brake_start";
    return action.accel > 0 ? "roll_on" : "crack";
}
const KIND_ORDER = new Map(EVENT_KINDS.map((k, i) => [k, i]));
/**
 * Events are strictly ordered by t, ties broken by the EVENT_KINDS declaration
 * order (05 §5). Stable for identical (t, kind) pairs.
 */
export function sortEvents(events) {
    return events
        .map((e, i) => ({ e, i }))
        .sort((a, b) => {
        if (a.e.t !== b.e.t)
            return a.e.t - b.e.t;
        const ka = KIND_ORDER.get(a.e.kind) ?? 0;
        const kb = KIND_ORDER.get(b.e.kind) ?? 0;
        if (ka !== kb)
            return ka - kb;
        return a.i - b.i;
    })
        .map(({ e }) => e);
}
//# sourceMappingURL=events.js.map