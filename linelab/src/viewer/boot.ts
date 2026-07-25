// viewer/boot.ts — the BROWSER entry point (design/07 §6.2), and the third
// declared side-effect entry point in src/.
//
// THE EXEMPTION, STATED ONCE, HERE. Every other module in src/ is importable
// without consequence; this one runs `bootFromPage()` at module scope, because
// that is what `<script type="module">` means — the browser has no other way to
// start an application. `test/meta/imports.test.ts` pins the set of files
// allowed a top-level call to EXACTLY `{cli/main.ts, cli/bless.ts,
// viewer/boot.ts}` and fails on any fourth, so this is a declared door rather
// than a drift. The side effect is also inert off-browser: under Node
// `browserHost()` returns null and `bootFromPage()` returns a string having
// done nothing, which is why every test can import this module freely.
// Recorded as a ratification item against design/07 §6.2.
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
export function bootFromPage(): string {
  const host = browserHost();
  if (host === null) return "no browser host";
  const payload = host.byId("payload");
  if (payload === null) return "no payload block on this page";
  const started = boot(host, payload.getText());
  if (!started.ok) {
    host.byId("readout")?.setText(`${started.error.code}: ${started.error.message}`);
    return started.error.code;
  }
  return "ok";
}

bootFromPage();
