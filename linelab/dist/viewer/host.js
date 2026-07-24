// viewer/host.ts — the ONE file in src/ that touches a browser global.
//
// Why it exists: `tsconfig.json` pins `lib: ["es2023"]` with NO `dom`
// (ARCHITECTURE §1: "No `lib: dom` in v0.1 — the renderer builds SVG strings,
// never touches a DOM"). That pin is not this package's to change, and it is
// worth keeping: it is what guarantees no module beneath `viewer/` can grow a
// browser dependency by accident.
//
// So the viewer reaches its host through a hand-declared 8-member interface,
// exactly as `core/stateAt.ts` reaches the road and the sight-trend rule —
// dependency inversion, not ambient types. `browserHost()` is the single
// adapter; every other viewer file takes a `ViewerHost` as a parameter and is
// therefore drivable from a test with a plain object (which is what the boot
// smoke test does). Nothing here computes; it is pure plumbing.
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