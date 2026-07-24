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

/** One addressable element of the host page. */
export interface HostElement {
  /** replace the element's markup (SVG panes, HUD table) */
  setHtml(html: string): void;
  /** replace the element's text content (status lines, chips) */
  setText(text: string): void;
  /** read the element's text content — how the page hands the viewer its preloaded payload */
  getText(): string;
  /** current value of an input control, "" when it has none */
  getValue(): string;
  setValue(value: string): void;
  /** register a listener; the handler takes no arguments — state lives in the app */
  on(event: string, handler: () => void): void;
}

/**
 * The host page the viewer drives.
 *
 * 07 §6.2 names three loading doors: file drop, share string (`#f=`/`#s=`),
 * and CLI handoff. This phase ships the CLI-handoff door — the one `linelab
 * serve` (08 §3) specifies — so no `hash()` member exists here: the share
 * door's decoder is absent, not stubbed (00 §3's phase law). See this
 * package's return for the 05 §8.1 encoding note that has to be settled
 * before the share door can land.
 */
export interface ViewerHost {
  byId(id: string): HostElement | null;
  /** schedule `fn` after `ms`; returns a cancel handle. Playback's only timer. */
  every(ms: number, fn: () => void): () => void;
  /** the wall-clock reading playback schedules against, in seconds */
  nowS(): number;
}

// ---------------------------------------------------------------------------
// The browser adapter. Everything below is structurally typed against the real
// DOM without importing DOM lib types: `globalThis` is narrowed to exactly the
// members used, and nothing wider is ever visible to the rest of src/.

interface DomNode {
  innerHTML: string;
  textContent: string | null;
  value?: string;
  addEventListener(type: string, handler: () => void): void;
}

interface DomLike {
  readonly document?: {
    getElementById(id: string): DomNode | null;
  };
  setInterval?(fn: () => void, ms: number): number;
  clearInterval?(handle: number): void;
  readonly performance?: { now(): number };
}

function elementOf(node: DomNode): HostElement {
  return {
    setHtml(html: string): void {
      node.innerHTML = html;
    },
    setText(text: string): void {
      node.textContent = text;
    },
    getText(): string {
      return node.textContent ?? "";
    },
    getValue(): string {
      return node.value ?? "";
    },
    setValue(value: string): void {
      node.value = value;
    },
    on(event: string, handler: () => void): void {
      node.addEventListener(event, handler);
    }
  };
}

/**
 * The real browser host, or `null` when there is no document (i.e. under Node,
 * which is how every test reaches this module without pretending to be a
 * browser).
 */
export function browserHost(): ViewerHost | null {
  const g = globalThis as unknown as DomLike;
  const doc = g.document;
  if (doc === undefined) return null;
  const setInterval_ = g.setInterval;
  const clearInterval_ = g.clearInterval;
  const perf = g.performance;
  return {
    byId(id: string): HostElement | null {
      const node = doc.getElementById(id);
      return node === null ? null : elementOf(node);
    },
    every(ms: number, fn: () => void): () => void {
      if (setInterval_ === undefined || clearInterval_ === undefined) return () => undefined;
      const handle = setInterval_(fn, ms);
      return () => clearInterval_(handle);
    },
    nowS(): number {
      return perf === undefined ? 0 : perf.now() / 1000;
    }
  };
}
