// viewer/app.ts — the workstation (design/07 §6.1) as a pure state machine
// plus one thin host binding.
//
// Split, deliberately:
//   · `AppState` + `frameOf(app)` are PURE — given the loaded session and the
//     cursor, `frameOf` returns everything the page shows: both view SVGs, the
//     HUD rows, the bookmark ticks, the legend. No host, no timers, no DOM. A
//     test drives the whole app through it.
//   · `boot(host, payloadText)` is the only stateful part: it recomputes the
//     session (07 §2.1), renders the first frame, and wires the controls. All
//     mutation is confined to one `current` binding inside the closure; every
//     transition goes through the pure functions above.
//
// 07 §6.3's read-mostly rule holds structurally: nothing here can edit a
// scenario. The app's only state is view-level — cursor, focus, lock mode,
// axis, playback.
import { ok, err } from "../core/result.js";
import { FRAME_STEP_S } from "./constants.js";
import { hudAt } from "./hud.js";
import { bookmarksOf, parseBookmark, printBookmark } from "./bookmarks.js";
import { advance, domainOf, initialStepper, jumpTo, pause, play, scenarioDomain, scrubTo, stepFrame, stepSample, toggleAxis, withSpeed } from "./stepper.js";
import { loadSession, lineOf, withFocus } from "./session.js";
import { renderView } from "./views.js";
import { saveWindowHudRows, saveWindowOverlay, saveWindowTicks } from "./saveWindow.js";
import { correctiveGhostOverlay } from "./correctiveGhost.js";
import { compareModel } from "./compare.js";
import { parsePovLook } from "./pov.js";
/** design/07 §3.4's placard, verbatim — the off-road badge's disclosure. */
export const OFF_ROAD_PLACARD = "left the road — off-road behaviour not modelled";
export function createApp(session) {
    const domain = scenarioDomain(session.lines, "t");
    return Object.freeze({
        session,
        stepper: initialStepper(domain),
        lock: "station",
        look: "heading",
        saveWindow: null,
        correctiveGhost: null
    });
}
/**
 * design/07 §3.6's toggle. ON computes the overlay ONCE (one `saveWindow(line)`
 * call for the focused line); OFF drops it. A refusal leaves the toggle off and
 * is reported through `frameOf`'s `problems` on the next frame rather than
 * throwing — the viewer's never-throw stance.
 */
export function toggleSaveWindow(app) {
    if (app.saveWindow !== null)
        return Object.freeze({ ...app, saveWindow: null });
    const line = lineOf(app.session, app.session.focus);
    if (line === null)
        return app;
    const overlay = saveWindowOverlay(line);
    return Object.freeze({ ...app, saveWindow: overlay.ok ? overlay.value : null });
}
/**
 * design/07 §3.5's corrective-ghost toggle. ON computes the ghost ONCE (one
 * `correctiveShot(line)` call for the focused line); OFF drops it. The toggle is
 * inert — stays null — when the focused line has no ran-wide corrective (07
 * §3.5: "the toggle is inert for that line"), and a refusal likewise leaves it
 * off (never-throw).
 */
export function toggleCorrectiveGhost(app) {
    if (app.correctiveGhost !== null)
        return Object.freeze({ ...app, correctiveGhost: null });
    const line = lineOf(app.session, app.session.focus);
    if (line === null)
        return app;
    const ghost = correctiveGhostOverlay(line);
    return Object.freeze({ ...app, correctiveGhost: ghost.ok ? ghost.value : null });
}
/**
 * The scrubber's extent: the whole scenario, not the focused line (07 §3.4 —
 * "the cursor remains draggable across the full scenario extent so surviving
 * lines in compare mode keep stepping").
 */
export function domainFor(app) {
    return scenarioDomain(app.session.lines, app.stepper.axis);
}
function terminalBadge(app) {
    const line = lineOf(app.session, app.session.focus);
    if (line === null)
        return "";
    const end = line.trajectory.terminated;
    const endValue = app.stepper.axis === "s" ? end.s : end.t;
    if (app.stepper.value < endValue)
        return "";
    return end.reason === "off_road" ? `off_road — ${OFF_ROAD_PLACARD}` : end.reason;
}
function legendOf(app) {
    return app.session.lines.map((l) => Object.freeze({
        line_id: l.line_id,
        role: l.role,
        label: l.label,
        quality: l.verdict.quality,
        outcome: l.verdict.outcome,
        focused: l.line_id === app.session.focus
    }));
}
/**
 * `frameOf(app)` — the whole page, derived. Never throws: a query outside the
 * focused line's domain (which happens by construction once a short line has
 * ended and the scenario cursor runs past it) freezes the HUD at that line's
 * terminal sample and records the reason in `problems`, exactly as 07 §3.4
 * requires ("a line that ends early freezes at its terminal sample").
 */
export function frameOf(app) {
    const problems = [];
    const domain = domainFor(app);
    const line = lineOf(app.session, app.session.focus);
    if (line === null) {
        return Object.freeze({
            cursor: app.stepper,
            domain: { min: domain.min, max: domain.max },
            instant: null,
            hud: [],
            bookmarks: [],
            save_window_ticks: [],
            corrective_ghost: null,
            views: [],
            pov: null,
            compare: null,
            legend: legendOf(app),
            terminal: "",
            problems: ["no drawable line in this envelope"]
        });
    }
    // freeze at the terminal sample rather than asking `stateAt` past its domain
    const own = domainOf(line, app.stepper.axis);
    const q = app.stepper.value < own.min ? own.min : app.stepper.value > own.max ? own.max : app.stepper.value;
    const queried = (() => {
        const r = hudAt(app.session, line.line_id, app.stepper.axis === "s" ? { s: q } : { t: q });
        if (r.ok)
            return r.value;
        problems.push(`${r.error.code}: ${r.error.message}`);
        return null;
    })();
    const instant = queried === null ? null : queried.instant;
    // 07 §3.5/§3.6: each overlay belongs to the FOCUSED line; a stale overlay
    // from a previous focus is dropped rather than drawn against the wrong
    // trajectory.
    const overlay = app.saveWindow !== null && app.saveWindow.line_id === line.line_id ? app.saveWindow : null;
    const ghost = app.correctiveGhost !== null && app.correctiveGhost.line_id === line.line_id ? app.correctiveGhost : null;
    // 07 §4 compare model — every line's OWN state at the shared lock coordinate,
    // computed from the focused line's instant (C-COMPARE, no shared state). Drives
    // the top-down ghost glyphs of the non-focused lines; a single-line envelope
    // yields no ghosts, so its top-down stays byte-identical to the v0.2 picture.
    const compare = instant === null ? null : compareModel(app.session, instant, app.lock);
    const views = [];
    for (const view of ["topdown", "controls"]) {
        const r = renderView(app.session, {
            view,
            instant,
            line_id: line.line_id,
            saveWindow: overlay,
            correctiveGhost: ghost,
            compare: view === "topdown" ? compare : null
        });
        if (r.ok)
            views.push(r.value);
        else
            problems.push(`${view}: ${r.error.message}`);
    }
    // 07 §5 the POV view (its own field, not in `views`): the focused line at the
    // cursor under `app.look`. `renderPovView` never throws and `app.look` is a
    // valid closed-set value, so this Result is always ok — a pov failure would
    // only surface as a `fallbackSvg`, never a frame `problem`.
    const povR = renderView(app.session, { view: "pov", instant, line_id: line.line_id, look: app.look });
    const pov = povR.ok ? povR.value : null;
    // 07 §3.6's HUD rows ride in the Verdict group, after the line's own rows.
    // `instant.sample.t` is the cursor's run time on BOTH scrubber axes, so the
    // countdown reads the same instant the rest of the HUD does.
    const saveRows = overlay === null || instant === null ? [] : saveWindowHudRows(overlay, instant.sample.t);
    return Object.freeze({
        cursor: app.stepper,
        domain: { min: domain.min, max: domain.max },
        instant,
        hud: queried === null ? [] : Object.freeze([...queried.rows, ...saveRows]),
        bookmarks: bookmarksOf(line),
        save_window_ticks: overlay === null ? [] : saveWindowTicks(overlay),
        corrective_ghost: ghost,
        views: Object.freeze(views),
        pov,
        compare,
        legend: legendOf(app),
        terminal: terminalBadge(app),
        problems: Object.freeze(problems)
    });
}
// ---------------------------------------------------------------------------
// Pure transitions (each returns a NEW AppState)
export function scrub(app, value) {
    return Object.freeze({ ...app, stepper: scrubTo(app.stepper, value, domainFor(app)) });
}
export function togglePlay(app) {
    return Object.freeze({ ...app, stepper: app.stepper.playing ? pause(app.stepper) : play(app.stepper) });
}
export function setSpeed(app, speed) {
    return Object.freeze({ ...app, stepper: withSpeed(app.stepper, speed) });
}
export function tick(app, wallDeltaS) {
    const line = lineOf(app.session, app.session.focus);
    return Object.freeze({
        ...app,
        stepper: advance(app.stepper, wallDeltaS, domainFor(app), line ?? undefined)
    });
}
export function nudgeFrame(app, direction) {
    const line = lineOf(app.session, app.session.focus);
    return Object.freeze({ ...app, stepper: stepFrame(app.stepper, direction, domainFor(app), line ?? undefined) });
}
export function nudgeSample(app, direction) {
    const line = lineOf(app.session, app.session.focus);
    return line === null ? app : Object.freeze({ ...app, stepper: stepSample(app.stepper, direction, line) });
}
export function flipAxis(app) {
    const line = lineOf(app.session, app.session.focus);
    if (line === null)
        return app;
    const flipped = toggleAxis(app.stepper, line);
    return Object.freeze({ ...app, stepper: scrubTo(flipped, flipped.value, scenarioDomain(app.session.lines, flipped.axis)) });
}
export function setLock(app, lock) {
    return Object.freeze({ ...app, lock });
}
/**
 * 07 §5.2's `look` camera toggle. The closed set is validated once, here: an
 * unknown value leaves `look` unchanged (the viewer never crashes on a bad
 * toggle — a bad `--look` was already refused `SCHEMA` at the CLI/scene door).
 */
export function setLook(app, look) {
    const parsed = parsePovLook(look);
    return parsed.ok ? Object.freeze({ ...app, look: parsed.value }) : app;
}
export function focusLine(app, lineId) {
    return lineOf(app.session, lineId) === null ? app : Object.freeze({ ...app, session: withFocus(app.session, lineId) });
}
/** Bookmark jump — the events-only pathway (07 §3.1, `C-BOOKMARKS`). */
export function jumpToBookmark(app, token) {
    const line = lineOf(app.session, app.session.focus);
    if (line === null)
        return app;
    const parsed = parseBookmark(token, line);
    if (!parsed.ok)
        return app;
    return Object.freeze({ ...app, stepper: jumpTo(app.stepper, parsed.value, domainFor(app)) });
}
// ---------------------------------------------------------------------------
// Host binding — the only stateful code in viewer/
function escapeHtml(s) {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
/** 07 §3.3's panel, as one table: group, label, value. */
export function hudHtml(rows) {
    const cells = rows
        .map((r) => `<tr data-group="${r.group}"${r.badge === undefined ? "" : ` data-badge="${r.badge}"`}>` +
        `<td class="g">${escapeHtml(r.group)}</td>` +
        `<td class="k">${escapeHtml(r.label)}</td>` +
        `<td class="v">${escapeHtml(r.text)}</td></tr>`)
        .join("");
    return `<table class="hud">${cells}</table>`;
}
/** The named-event ticks as `<option>`s; the option VALUE is the serialized bookmark. */
export function bookmarkOptionsHtml(bookmarks) {
    return bookmarks
        .map((b) => `<option value="${escapeHtml(printBookmark(b))}">${escapeHtml(b.label)} · t=${b.t.toFixed(2)} s</option>`)
        .join("");
}
export function legendHtml(entries) {
    return entries
        .map((e) => `<option value="${escapeHtml(e.line_id)}"${e.focused ? " selected" : ""}>` +
        `${escapeHtml(e.line_id)} · ${escapeHtml(e.role)} · ${escapeHtml(e.quality)} (${escapeHtml(e.outcome)})</option>`)
        .join("");
}
/**
 * `boot(host, payloadText)` — 07 §6.2's "CLI handoff" door. `payloadText` is
 * the SPEC (scenario + line specs), never a trajectory: the viewer recomputes
 * (§2.1). Returns `Result` rather than throwing, so a bad payload paints a
 * typed message instead of a blank page.
 */
export function boot(host, payloadText, engineSemver) {
    let spec;
    try {
        spec = JSON.parse(payloadText);
    }
    catch (e) {
        return err({
            code: "SCHEMA",
            at: "payload",
            message: `viewer payload is not JSON: ${e instanceof Error ? e.message : String(e)}`,
            detail: { reason: "json_parse_error" }
        });
    }
    const loaded = loadSession(spec, engineSemver === undefined ? undefined : { engine_semver: engineSemver });
    if (!loaded.ok)
        return loaded;
    let current = createApp(loaded.value);
    let last = host.nowS();
    const paint = () => {
        const f = frameOf(current);
        for (const v of f.views)
            host.byId(v.view)?.setHtml(v.svg);
        // 07 §6.1's right pane — the pov view rides its own field (not `f.views`)
        if (f.pov !== null)
            host.byId("pov")?.setHtml(f.pov.svg);
        host.byId("hud")?.setHtml(hudHtml(f.hud));
        host.byId("legend")?.setHtml(legendHtml(f.legend));
        // the range control carries a 0..1 FRACTION of the domain (see page.ts) —
        // view-level cursor bookkeeping, never a physics number
        const scrubber = host.byId("scrubber");
        if (scrubber !== null) {
            const span = f.domain.max - f.domain.min;
            scrubber.setValue(span === 0 ? "0" : String((f.cursor.value - f.domain.min) / span));
        }
        host.byId("readout")?.setText(`${f.cursor.axis} = ${f.cursor.value.toFixed(2)}` +
            ` · [${f.domain.min.toFixed(2)}, ${f.domain.max.toFixed(2)}]` +
            (f.terminal === "" ? "" : ` · ${f.terminal}`) +
            (f.problems.length === 0 ? "" : ` · ${f.problems.join(" · ")}`));
    };
    const apply = (next) => {
        current = next;
        paint();
    };
    // bookmark ticks are painted once — the events array does not change
    host.byId("bookmarks")?.setHtml(bookmarkOptionsHtml(frameOf(current).bookmarks));
    host.byId("play")?.on("click", () => apply(togglePlay(current)));
    host.byId("axis")?.on("click", () => apply(flipAxis(current)));
    host.byId("frame-back")?.on("click", () => apply(nudgeFrame(current, -1)));
    host.byId("frame-fwd")?.on("click", () => apply(nudgeFrame(current, 1)));
    host.byId("sample-back")?.on("click", () => apply(nudgeSample(current, -1)));
    host.byId("sample-fwd")?.on("click", () => apply(nudgeSample(current, 1)));
    host.byId("speed")?.on("change", () => {
        const raw = host.byId("speed")?.getValue() ?? "1";
        apply(setSpeed(current, Number(raw)));
    });
    host.byId("scrubber")?.on("input", () => {
        const frac = Number(host.byId("scrubber")?.getValue() ?? "");
        if (!Number.isFinite(frac))
            return;
        const d = domainFor(current);
        apply(scrub(current, d.min + frac * (d.max - d.min)));
    });
    host.byId("lock")?.on("change", () => {
        const raw = host.byId("lock")?.getValue() ?? "station";
        apply(setLock(current, raw === "time" ? "time" : "station"));
    });
    // 07 §5.2's `look` toggle beside the pov pane (07 §6.1)
    host.byId("look")?.on("change", () => {
        apply(setLook(current, host.byId("look")?.getValue() ?? "heading"));
    });
    host.byId("bookmarks")?.on("change", () => {
        const token = host.byId("bookmarks")?.getValue() ?? "";
        if (token !== "")
            apply(jumpToBookmark(current, token));
    });
    host.byId("legend")?.on("change", () => {
        const id = host.byId("legend")?.getValue() ?? "";
        if (id !== "") {
            apply(focusLine(current, id));
            host.byId("bookmarks")?.setHtml(bookmarkOptionsHtml(frameOf(current).bookmarks));
        }
    });
    // Playback: ONE timer, and all it does is hand `advance` the elapsed wall
    // time. 07 §3.1 — "playback is a scheduled scrub… there is no second
    // animation pathway".
    const cancel = host.every(1000 * FRAME_STEP_S, () => {
        const now = host.nowS();
        const delta = now - last;
        last = now;
        if (current.stepper.playing)
            apply(tick(current, delta));
    });
    paint();
    return ok({
        dispose: () => cancel(),
        state: () => current,
        refresh: paint
    });
}
//# sourceMappingURL=app.js.map