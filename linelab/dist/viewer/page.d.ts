export interface PageOptions {
    /** URL prefix the compiled ES modules are served under, e.g. "/m" */
    readonly moduleRoot: string;
    /** the SPEC document (scenario + line specs) — never a trajectory (07 §2.1) */
    readonly payloadJson: string;
    /** shown in the title bar and the header strip */
    readonly title: string;
    readonly engineSemver: string;
}
/**
 * The complete page. Element ids here are the contract `viewer/app.ts`'s
 * `boot` binds against — one list, in one file, so a renamed pane cannot
 * silently unwire a control.
 */
export declare function viewerPageHtml(opts: PageOptions): string;
