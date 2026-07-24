import { type VerbOutcome } from "./shared.js";
/**
 * design/08 §3 pins the flag (`--port N`) but not a default. Named locally
 * without TUNING status, per ARCHITECTURE §6.6's rule for unnamed design
 * literals.
 */
export declare const SERVE_DEFAULT_PORT = 4173;
/** The URL prefix the compiled module graph is mounted under (see the banner). */
export declare const SERVE_MODULE_ROOT = "/m";
export interface ServeDocument {
    readonly path: string;
    readonly contentType: string;
    readonly body: string;
}
/**
 * Everything `main.ts` needs to run the server, and nothing that needs a
 * runtime to produce. Pure data: a test can assert the whole plan without
 * binding a port.
 */
export interface ServePlan {
    readonly port: number;
    readonly url: string;
    /** exact-path documents, checked before the module mount */
    readonly documents: readonly ServeDocument[];
    /** URL prefix under which `dist/` is served read-only */
    readonly moduleRoot: string;
}
export interface ServeVerbInput {
    readonly loadedText: string;
    readonly argv: readonly string[];
    readonly engineSemver: string;
}
export interface ServeVerbResult {
    readonly outcome: VerbOutcome;
    /** null when the outcome is a refusal — nothing to serve */
    readonly plan: ServePlan | null;
}
/**
 * `serve` — build the plan and the one stdout document (08 §3.2: stdout is
 * exactly one JSON document per invocation; the URL rides its `value`, which
 * is what "print the URL" means for an agent-parseable CLI).
 */
export declare function serveVerb(input: ServeVerbInput): ServeVerbResult;
