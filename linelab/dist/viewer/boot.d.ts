/**
 * Read the preloaded payload out of the page's inert JSON block and start the
 * workstation. Returns a status string rather than throwing, so a failed boot
 * paints a message in the header instead of leaving a blank page.
 */
export declare function bootFromPage(): string;
