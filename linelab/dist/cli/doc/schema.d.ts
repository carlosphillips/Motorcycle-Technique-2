import { type FlagMapping } from "../args.js";
import { DEFERRED_TABLE } from "../deferred.js";
export interface SchemaField {
    readonly name: string;
    readonly type: string;
    readonly units?: string;
    readonly default?: unknown;
    readonly required?: boolean;
    readonly enum?: readonly string[];
    readonly effect: string;
    readonly schema_ref: string;
}
export interface SchemaKind {
    readonly kind: string;
    readonly params: readonly SchemaField[];
    readonly admissible_outcomes: readonly string[];
    readonly fixture_pin: string;
    readonly book_figure: string;
    readonly note?: string;
}
export interface SchemaGrammarRule {
    readonly token: string;
    readonly form: string;
    readonly example: string;
}
export interface SchemaSection {
    readonly name: string;
    readonly prose: string;
    readonly fields?: readonly SchemaField[];
    readonly kinds?: readonly SchemaKind[];
    readonly grammar?: readonly SchemaGrammarRule[];
    readonly flags?: readonly FlagMapping[];
}
export interface SchemaDoc {
    readonly schema_version: number;
    readonly engine: "linelab/1";
    readonly rubric: string;
    readonly checks_version: number;
    readonly sections: Readonly<Record<string, SchemaSection>>;
}
/**
 * design/08 §5.1 — the closed section list shipped in THIS phase. `sweep`
 * JOINED it when the `sweep` verb shipped (v0.2): "the printed schema is the
 * phase" (D8/D37), so a section cannot stay hidden behind a verb that runs.
 * `continuations` remains phase-gated (D45, §6.4).
 */
export declare const SHIPPED_SECTIONS: readonly ["scenario", "plan", "road-dsl", "occluders", "hazards", "mistakes", "solve", "sweep", "scene", "figure", "view", "envelope", "rubric", "cli"];
export type ShippedSection = (typeof SHIPPED_SECTIONS)[number];
/** design/08 §5.1 — the FULL closed section list (incl. phase-gated names), for the pin-#18 error message. */
export declare const ALL_SECTIONS: readonly ["scenario", "plan", "road-dsl", "occluders", "hazards", "mistakes", "solve", "sweep", "scene", "figure", "view", "envelope", "rubric", "cli", "continuations"];
/** design/08 §5.1.1: "bumps on ANY section change" — v0.2 added the `sweep` section. */
export declare const SCHEMA_VERSION = 2;
export interface SchemaDocError {
    readonly code: "SCHEMA";
    readonly at: string;
    readonly message: string;
    readonly deferred?: string;
    readonly detail: {
        readonly reason: string;
        readonly sections?: readonly string[];
    };
}
/**
 * `buildSchemaDoc(section?) → {ok:true,value:SchemaDoc} | {ok:false,error}`
 * (design/08 §5.1.1; ARCHITECTURE §5). Unknown section → typed `SCHEMA` naming
 * the closed list (pin #18); a phase-gated section name → `SCHEMA`+`deferred`.
 */
export declare function buildSchemaDoc(section?: string): {
    ok: true;
    value: SchemaDoc;
} | {
    ok: false;
    error: SchemaDocError;
};
export { DEFERRED_TABLE };
