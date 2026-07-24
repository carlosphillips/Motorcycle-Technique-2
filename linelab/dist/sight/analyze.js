// sight/analyze.ts — post-run sight analysis (design/03 §5.3, D16, D27;
// ARCHITECTURE §8 WP-07). Operates over the RESAMPLED record core/integrate.ts
// already produced (the per-sample `sight_m`/`ssd_m`/limit point are already
// cast from the rider's own position, D4 — this pass rebases and bookmarks).
// Pure; `Trajectory` is deep-frozen, so this returns a NEW Trajectory rather
// than mutating (core/record.ts's `buildTrajectory` re-freezes it).
//
// Owns:
//   - the `sight_ride_m` rebase: exact path length along the line's OWN ridden
//     trajectory to where the centreline station reaches `s + sight_m`,
//     clamped at line end (05 §2.1, D16 — the sole basis for every
//     sight-vs-stopping judgment; corrects the ~15% error a centreline-basis
//     comparison carries in a corner, per D16/00-README).
//   - `hazard_visible` events (03 §5.3, D27): one per on-road vehicle, at the
//     first sample that sees it past every OTHER opaque footprint.
//   - the `sight_min` bookmark (05 §5): the line's single worst-margin sample.
//   - `sightTrendAt` (05 §4/§5.4): built now, tested now, for v0.2's
//     `core/stateAt.ts` (RESERVED) to consume without re-deriving the rule —
//     mirrors WP-07's phase-opener precompute in core/analyze.ts. v0.1 wires
//     nothing to it (no `derived.sight_trend` consumer exists yet).
import { buildTrajectory } from "../core/record.js";
import { sortEvents } from "../core/events.js";
import { footprintsOf } from "./footprints.js";
import { SIGHT_TREND_WINDOW_M, SIGHT_TREND_DEADBAND_M } from "./constants.js";
// ---------------------------------------------------------------------------
// sight_ride_m rebase (D16): pure trajectory-arc-length geometry, no road/sight
// machinery needed — the divergence from `sight_m` (centreline basis) IS the
// teaching (a line cutting the inside of a corner rides a shorter path to the
// same centreline lookahead station; a line running wide rides a longer one).
function binarySearchFirstGE(samples, target, from) {
    let lo = from;
    let hi = samples.length - 1;
    if (samples[hi].s < target)
        return -1; // beyond the last sample — caller clamps
    while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (samples[mid].s >= target)
            hi = mid;
        else
            lo = mid + 1;
    }
    return lo;
}
/**
 * `sight_ride_m[i]` = exact ridden-path length from sample `i` to the station
 * where the trajectory's own centreline station `s` first reaches
 * `s_i + sight_m_i`, linearly interpolating the final partial segment;
 * clamped to the remaining trajectory length when that target lies beyond the
 * line's last sample (03 §5.3's "clamped at line end").
 */
function rebaseSightRide(samples) {
    const n = samples.length;
    const cum = new Array(n);
    cum[0] = 0;
    for (let k = 1; k < n; k++) {
        const a = samples[k - 1];
        const b = samples[k];
        cum[k] = cum[k - 1] + Math.hypot(b.x - a.x, b.y - a.y);
    }
    const out = new Array(n);
    for (let i = 0; i < n; i++) {
        const sample = samples[i];
        const target = sample.s + sample.sight_m;
        if (target <= sample.s) {
            out[i] = 0;
            continue;
        }
        const j = binarySearchFirstGE(samples, target, i);
        if (j === -1) {
            out[i] = cum[n - 1] - cum[i]; // clamped at line end
            continue;
        }
        const atJ = samples[j];
        if (Math.abs(atJ.s - target) <= 1e-9) {
            out[i] = cum[j] - cum[i];
            continue;
        }
        const prev = samples[j - 1];
        const span = atJ.s - prev.s;
        const alpha = span > 0 ? (target - prev.s) / span : 0;
        const partial = alpha * Math.hypot(atJ.x - prev.x, atJ.y - prev.y);
        out[i] = cum[j - 1] - cum[i] + partial;
    }
    return out;
}
// ---------------------------------------------------------------------------
// hazard_visible (D27, 03 §5.3): the local segment-vs-footprint unobstructed
// test duplicates sight/cast.ts's `segmentsCross`/`rayBlocked` (module-private
// there, not exported) — recorded deviation: this file cannot import them, so
// the ~15-line proper-intersection predicate is restated verbatim to stay
// numerically identical to the cast.
const EPS_PARALLEL = 1e-12;
const EPS_PARAM = 1e-9;
function segmentsCross(p, q, a, b) {
    const d1x = q.x - p.x;
    const d1y = q.y - p.y;
    const d2x = b.x - a.x;
    const d2y = b.y - a.y;
    const den = d1x * d2y - d1y * d2x;
    if (Math.abs(den) < EPS_PARALLEL)
        return false;
    const t = ((a.x - p.x) * d2y - (a.y - p.y) * d2x) / den;
    const u = ((a.x - p.x) * d1y - (a.y - p.y) * d1x) / den;
    return t > EPS_PARAM && t < 1 - EPS_PARAM && u > EPS_PARAM && u < 1 - EPS_PARAM;
}
function segmentUnblocked(eye, target, footprints) {
    for (const fp of footprints) {
        const poly = fp.polygon;
        const n = poly.length;
        for (let i = 0; i < n; i++) {
            if (segmentsCross(eye, target, poly[i], poly[(i + 1) % n]))
                return false;
        }
    }
    return true;
}
/** True on-road vehicles only (D27): `lane` or `f` placement. Verge (`side`) vehicles are scenery. */
function isOnRoadVehicle(occ) {
    return occ.kind === "vehicle" && (occ.lane !== undefined || occ.f !== undefined);
}
function hazardVisibleEvents(samples, road, occluders) {
    const all = footprintsOf(road, occluders);
    const events = [];
    occluders.forEach((occ, idx) => {
        if (!isOnRoadVehicle(occ))
            return;
        const own = all[idx];
        const others = all.filter((_, j) => j !== idx);
        for (const sample of samples) {
            const eye = { x: sample.x, y: sample.y };
            if (segmentUnblocked(eye, own.centre, others)) {
                events.push({
                    kind: "hazard_visible",
                    s: sample.s,
                    t: sample.t,
                    detail: { occluder_id: occ.id, dist_m: Math.hypot(own.centre.x - eye.x, own.centre.y - eye.y) }
                });
                return; // first-sighted only (03 §5.3) — no per-sample recording
            }
        }
        // no sample ever saw it before termination — absence is the recorded fact, no event
    });
    return events;
}
// ---------------------------------------------------------------------------
// sight_min (05 §5): the line's single canonical worst-moment bookmark — the
// sample minimizing sight_ride_m − ssd_m (D16, rider-path basis).
function sightMinEvent(samples, sightRide) {
    if (samples.length === 0)
        return null;
    let bestI = 0;
    let bestMargin = Number.POSITIVE_INFINITY;
    for (let i = 0; i < samples.length; i++) {
        const margin = sightRide[i] - samples[i].ssd_m;
        if (margin < bestMargin) {
            bestMargin = margin;
            bestI = i;
        }
    }
    const at = samples[bestI];
    return { kind: "sight_min", s: at.s, t: at.t, detail: { margin_m: bestMargin } };
}
// ---------------------------------------------------------------------------
// analyzeSight — the pinned signature (ARCHITECTURE §5)
/**
 * `analyzeSight(traj, road, occluders)`: rebases `sight_ride_m`, injects
 * `hazard_visible` + `sight_min` events, and returns a freshly-frozen
 * Trajectory (the input is immutable; nothing here mutates it).
 */
export function analyzeSight(traj, road, occluders) {
    const sightRide = rebaseSightRide(traj.samples);
    const samples = traj.samples.map((sample, i) => ({ ...sample, sight_ride_m: sightRide[i] }));
    const newEvents = hazardVisibleEvents(traj.samples, road, occluders);
    const minEvent = sightMinEvent(traj.samples, sightRide);
    if (minEvent !== null)
        newEvents.push(minEvent);
    const events = sortEvents([...traj.events, ...newEvents]);
    return buildTrajectory(samples, events, traj.terminated);
}
// ---------------------------------------------------------------------------
// sightTrendAt (05 §4/§5.4, D-owned by 05 but sited here — sight/'s the sole
// producer of the `sight_m` channel it reads): windowed + deadbanded, computed
// from the recorded per-sample `sight_m` (centreline basis, comparable across
// lines) — NEVER `sight_ride_m` (05 §5.4 rule 4).
/** Index of the sample whose `s` is NEAREST `targetS`, searching only i' ≤ upTo. */
function nearestIndexAtOrBefore(samples, targetS, upTo) {
    if (targetS <= samples[0].s)
        return 0;
    let lo = 0;
    let hi = upTo;
    while (lo < hi) {
        const mid = (lo + hi + 1) >> 1;
        if (samples[mid].s <= targetS)
            lo = mid;
        else
            hi = mid - 1;
    }
    const before = lo;
    const after = Math.min(before + 1, upTo);
    const dBefore = Math.abs(samples[before].s - targetS);
    const dAfter = Math.abs(samples[after].s - targetS);
    return dAfter < dBefore ? after : before;
}
/**
 * `sight_trend` at sample `index` (05 §4, exact): compare `sight_m[index]`
 * against `sight_m` at the sample nearest `s − SIGHT_TREND_WINDOW_M`, clamped
 * to the first sample early in the line; `Δ > +DEADBAND` → "opening",
 * `Δ < −DEADBAND` → "closing", else "steady".
 */
export function sightTrendAt(samples, index) {
    const cur = samples[index];
    const targetS = cur.s - SIGHT_TREND_WINDOW_M;
    const refIdx = nearestIndexAtOrBefore(samples, targetS, index);
    const ref = samples[refIdx];
    const delta = cur.sight_m - ref.sight_m;
    if (delta > SIGHT_TREND_DEADBAND_M)
        return "opening";
    if (delta < -SIGHT_TREND_DEADBAND_M)
        return "closing";
    return "steady";
}
//# sourceMappingURL=analyze.js.map