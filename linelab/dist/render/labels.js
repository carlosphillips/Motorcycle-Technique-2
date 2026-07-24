// render/labels.ts — callout resolution (design/06 §3.1 stage 10; the label
// grammar itself is owned by design/03 §8 and pinned as `FigureLabel` in
// plan/types.ts: `feature[:corner][#n]@line ±m`). Resolved post-run against
// the named line's RECORDED events — never invented — with typed anchor
// failures (`UNKNOWN_ID`: `anchor_no_match`, `anchor_ambiguous`).
//
// v0.1 true mode: leader endpoints are the matched event's nearest-sample
// world position (identity projection, ARCHITECTURE §6.5); the box-repel
// candidate-scoring layout (§3.1 stage 10's "label boxes repel each other")
// is presentation-only and left to topdown.ts's draw pass — this file's job
// ends at RESOLVING each label to one leader target, which is what
// `A-LABEL-ANCHORS`/`A-ANCHOR-ERRORS` exercise.
import { ok, err } from "../core/result.js";
/** design/03 §8 feature vocabulary → recorded event kind, for the five event-sourced features. */
const FEATURE_EVENT = {
    turn_point: "turn_in",
    apex: "apex",
    exit: "exit",
    release: "release",
    correction: "correction",
    run_wide_detect: "run_wide_detect"
};
function unknownId(at, message, reason, extra) {
    return { code: "UNKNOWN_ID", at, message, detail: { reason, ...extra } };
}
function nearestSampleAnchor(line, s) {
    let best = line.trajectory.samples[0];
    let bestGap = Infinity;
    for (const sample of line.trajectory.samples) {
        const gap = Math.abs(sample.s - s);
        if (gap < bestGap) {
            bestGap = gap;
            best = sample;
        }
    }
    return { at: { x: best?.x ?? 0, y: best?.y ?? 0 }, s: best?.s ?? 0 };
}
/** Candidate match stations for `label.feature` on `line`, scoped by `label.corner` when given. */
function candidateStations(line, label) {
    if (label.feature === "end") {
        return [line.trajectory.terminated.s];
    }
    if (label.feature === "sight_ray") {
        const firstTurnIn = line.trajectory.events
            .filter((e) => e.kind === "turn_in")
            .sort((a, b) => a.s - b.s)[0];
        return firstTurnIn === undefined ? [] : [firstTurnIn.s];
    }
    const kind = FEATURE_EVENT[label.feature];
    if (kind === undefined)
        return [];
    const matches = line.trajectory.events
        .filter((e) => e.kind === kind)
        .filter((e) => label.corner === undefined || e.corner_id === label.corner)
        .sort((a, b) => a.s - b.s);
    return matches.map((e) => e.s);
}
function resolveOne(lines, label, at) {
    const line = lines.find((l) => l.line_id === label.line);
    if (line === undefined) {
        return err(unknownId(`${at}.line`, `label references unknown line "${label.line}"`, "anchor_no_match", { line: label.line }));
    }
    const stations = candidateStations(line, label);
    if (stations.length === 0) {
        return err(unknownId(at, `no "${label.feature}" event found on line "${label.line}"`, "anchor_no_match", {
            feature: label.feature,
            line: label.line,
            corner: label.corner
        }));
    }
    let chosenS;
    if (label.n !== undefined) {
        const idx = label.n - 1;
        if (idx < 0 || idx >= stations.length) {
            return err(unknownId(at, `"${label.feature}"#${label.n} has no match on line "${label.line}" (${stations.length} found)`, "anchor_no_match", {
                feature: label.feature,
                n: label.n,
                found: stations.length
            }));
        }
        chosenS = stations[idx];
    }
    else if (stations.length > 1) {
        return err(unknownId(at, `"${label.feature}" matches ${stations.length} events on line "${label.line}" — disambiguate with #n`, "anchor_ambiguous", {
            feature: label.feature,
            line: label.line,
            matches: stations.length
        }));
    }
    else {
        chosenS = stations[0];
    }
    const targetS = chosenS + (label.offset_m ?? 0);
    const resolved = nearestSampleAnchor(line, targetS);
    const text = label.text ?? (label.corner !== undefined ? `${label.feature}:${label.corner}` : label.feature);
    return ok({ text, anchor: resolved.at, s: resolved.s });
}
/**
 * `resolveLabels(lines, figureLabels) → Result<DrawnLabel[]>`. Fails on the
 * FIRST unresolved label (typed `UNKNOWN_ID`) — a label set is authored data;
 * a bad reference is a figure-authoring bug, not a per-label degradation.
 */
export function resolveLabels(lines, figureLabels) {
    if (figureLabels === undefined || figureLabels.length === 0)
        return ok([]);
    const out = [];
    for (let i = 0; i < figureLabels.length; i++) {
        const resolved = resolveOne(lines, figureLabels[i], `labels[${i}]`);
        if (!resolved.ok)
            return resolved;
        out.push(resolved.value);
    }
    return ok(out);
}
//# sourceMappingURL=labels.js.map