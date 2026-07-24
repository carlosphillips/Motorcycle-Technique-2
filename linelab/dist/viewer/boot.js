// viewer/boot.ts — the BROWSER entry point, and the only module in src/ with
// a top-level side effect.
//
// `<script type="module" src="<module-root>/viewer/boot.js">` (viewer/page.ts)
// loads this file; its relative imports pull in the compiled `core/ road/
// sight/ plan/ solve/ render/` graph — the same emitted JavaScript
// `dist/cli/main.js` imports. There is no bundler and no runtime dependency
// anywhere in that graph (D1); NodeNext's mandatory `.js` specifiers make it
// natively loadable by the browser's own ES module resolver.
//
// Under Node (tests, `linelab serve`'s own process) `browserHost()` returns
// null and this module does nothing at all — importing it is safe everywhere.
import { boot } from "./app.js";
import { browserHost } from "./host.js";
/**
 * Read the preloaded payload out of the page's inert JSON block and start the
 * workstation. Returns a status string rather than throwing, so a failed boot
 * paints a message in the header instead of leaving a blank page.
 */
export function bootFromPage() {
    const host = browserHost();
    if (host === null)
        return "no browser host";
    const payload = host.byId("payload");
    if (payload === null)
        return "no payload block on this page";
    const started = boot(host, payload.getText());
    if (!started.ok) {
        host.byId("readout")?.setText(`${started.error.code}: ${started.error.message}`);
        return started.error.code;
    }
    return "ok";
}
bootFromPage();
//# sourceMappingURL=boot.js.map