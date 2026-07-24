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
/**
 * The real browser host, or `null` when there is no document (i.e. under Node,
 * which is how every test reaches this module without pretending to be a
 * browser).
 */
export declare function browserHost(): ViewerHost | null;
