// viewer/host.ts — the THIRD purity exemption, and the ONE file in src/ that
// touches a browser global or a clock.
//
// THE EXEMPTION, STATED ONCE, HERE. ARCHITECTURE §2/§6.2 declare exactly two
// files where IO and real time are legal — `cli/main.ts` and `cli/bless.ts`.
// design/07 needs a third: §3.1 specifies PLAYBACK ("speed multipliers 0.25× /
// 0.5× / 1× / 2× of real time"), which is a scheduled scrub against a real
// clock, and §6.2 specifies a browser entry point. A viewer with no clock
// cannot play. So this file — and only this file — reads `performance.now()`
// and schedules with `setInterval`/`clearInterval`.
//
// The exemption is scoped, not a licence for the module:
//   · `test/meta/imports.test.ts` names `viewer/host.ts` in `PURITY_EXEMPT`
//     alongside the two CLI shells, and asserts that set is EXACTLY those three;
//   · the same file asserts that NO other `viewer/*.ts` names `globalThis`,
//     `performance`, or a timer — so the exemption buys one file, never a layer;
//   · every other viewer module takes `ViewerHost` as a PARAMETER, so it is
//     drivable from a test with a plain object (which is what the boot smoke
//     test does) and stays pure and deterministic;
//   · nothing here computes. It is plumbing: no physics value is produced,
//     transformed, or rounded in this file.
// Recorded as a ratification item against design/07 §3.1 and §6.2.
//
// Why the interface is hand-declared: `tsconfig.json` pins `lib: ["es2023"]`
// with NO `dom` (ARCHITECTURE §1: "No `lib: dom` in v0.1 — the renderer builds
// SVG strings, never touches a DOM"). That pin is not this package's to change,
// and it is worth keeping: it is what guarantees no module beneath `viewer/`
// can grow a browser dependency by accident. So the viewer reaches its host
// through two hand-declared interfaces — `HostElement` (6 members) and
// `ViewerHost` (3) — exactly as `core/stateAt.ts` reaches the road and the
// sight-trend rule: dependency inversion, not ambient types.
function elementOf(node) {
    return {
        setHtml(html) {
            node.innerHTML = html;
        },
        setText(text) {
            node.textContent = text;
        },
        getText() {
            return node.textContent ?? "";
        },
        getValue() {
            return node.value ?? "";
        },
        setValue(value) {
            node.value = value;
        },
        on(event, handler) {
            node.addEventListener(event, handler);
        }
    };
}
/**
 * The real browser host, or `null` when there is no document (i.e. under Node,
 * which is how every test reaches this module without pretending to be a
 * browser).
 */
export function browserHost() {
    const g = globalThis;
    const doc = g.document;
    if (doc === undefined)
        return null;
    const setInterval_ = g.setInterval;
    const clearInterval_ = g.clearInterval;
    const perf = g.performance;
    return {
        byId(id) {
            const node = doc.getElementById(id);
            return node === null ? null : elementOf(node);
        },
        every(ms, fn) {
            if (setInterval_ === undefined || clearInterval_ === undefined)
                return () => undefined;
            const handle = setInterval_(fn, ms);
            return () => clearInterval_(handle);
        },
        nowS() {
            return perf === undefined ? 0 : perf.now() / 1000;
        }
    };
}
//# sourceMappingURL=host.js.map