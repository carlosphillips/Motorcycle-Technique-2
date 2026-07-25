import type { LinelabError, Result } from "../core/result.js";
import type { RiderProfileName } from "../core/types.js";
import type { RoadSpec } from "../road/types.js";
import { type ResolvedMistakeSpec } from "../plan/mistakes.js";
import type { AcceptPolicy, Constraint, Hazard, Occluder, PlanAction, SolveStyle, VisMode } from "../plan/types.js";
export interface ComposeDraft {
    road?: RoadSpec;
    use_full_width?: boolean;
    bike_margin_m?: number;
    mu?: number;
    occluders?: Occluder[];
    hazards?: Hazard[];
    entry_kmh?: number;
    start_f?: number;
    profile?: RiderProfileName;
    roll_rate_cap_dps?: number;
    turn_in?: "auto" | number;
    style?: SolveStyle;
    vis?: VisMode;
    vis_hold_f?: number;
    vis_margin?: number;
    constraints?: Constraint[];
    believed_road?: RoadSpec | string;
    accept?: AcceptPolicy;
    plan?: PlanAction[];
    mistakes: ResolvedMistakeSpec[];
    line_id?: string;
    marks?: string;
    view?: Record<string, string>;
    rubric?: string;
    checks_version?: number;
}
export type FlagArity = "value" | "boolean" | "repeatable";
export interface FlagMapping {
    readonly field: string;
    readonly scene_key: string;
    readonly flag: string;
    readonly sugar?: string;
}
interface FlagSpec extends FlagMapping {
    readonly arity: FlagArity;
    readonly group: string;
    /** applies one occurrence's value (arity "boolean" passes ""). */
    readonly apply: (draft: ComposeDraft, value: string, at: string) => Result<void>;
}
export declare const FLAG_TABLE: readonly FlagSpec[];
/** `schema cli`'s printed table (design/08 §5.1) — the plain FlagMapping projection. */
export declare const FLAG_MAPPINGS: readonly FlagMapping[];
export interface ParsedInvocation {
    readonly draft: ComposeDraft;
    readonly positional: readonly string[];
    readonly gate: boolean;
    readonly out?: string;
    readonly trace?: string;
    readonly suggest: boolean;
    readonly check: boolean;
    readonly views?: readonly string[];
    readonly mode?: "true" | "diagram";
    readonly as?: string;
    readonly all: boolean;
    readonly noCache: boolean;
    readonly line?: string;
    readonly pretty: boolean;
    readonly quiet: boolean;
    /** design/08 §4.1 analysis flags — out-of-hash, exit-code-neutral (D43) */
    readonly standing: boolean;
    readonly on?: string;
    readonly corner?: string;
    /**
     * design/08 §3's `state` verb: `--s <m> | --t <s>`. The required-one /
     * mutual-exclusion rule ("both or neither → SCHEMA") is enforced ONCE, by
     * `stateAt` itself (05 §4) on the query object `state.ts` builds from
     * these — not duplicated here, so there is exactly one source of that
     * refusal.
     */
    readonly s?: number;
    readonly t?: number;
    /** design/08 §4.1 `--scan-ds <m>` — save-window scan resolution; INEFFECTUAL off `save-window` (main.ts) */
    readonly scanDs?: number;
    /** design/08 §4.3 sweep path grammar — parsed now, consumed once the `sweep` verb ships */
    readonly param?: string;
    readonly param2?: string;
    readonly range?: string;
    readonly range2?: string;
    readonly metric?: string;
    readonly format?: "tsv" | "json";
    /** design/08 §3 `serve` verb — parsed now, consumed once `serve` ships */
    readonly port?: number;
    /**
     * design/08 §3.5 / design/07 §3.7 `compare` verb: `--lock station|time`.
     * Closed 2-value set, `station` the default (07 §4.1) — the lock mode that
     * governs how the paired lines align in the diff (station-locked = same road
     * station; time-locked = same elapsed t). INEFFECTUAL off `compare` (main.ts,
     * VERB_SCOPED_FLAGS below).
     */
    readonly lock?: "station" | "time";
}
/**
 * 00-README §5's CLOSED view vocabulary, as `--views` spells it. `pov` is a
 * legal NAME here and a phase-gated TARGET downstream (render/index.ts's one
 * deferral) — parsing and phase gating stay separate concerns.
 */
export declare const CLI_VIEWS: readonly ["topdown", "controls", "pov"];
export type CliView = (typeof CLI_VIEWS)[number];
/**
 * design/08 §3's per-verb syntax, machine-readable: which verb(s) each
 * VERB-SCOPED flag is effectual on. ARCHITECTURE §6.4: "Nothing is ever
 * accepted-and-ignored" — a flag named on a verb that does not consume it is
 * `INEFFECTUAL`, naming the dead field (D8), exactly as `--standing` and
 * `--scan-ds` already are. Verb-agnostic controls (`--out`, `--line`,
 * `--pretty`, …) are deliberately absent: they are effectual everywhere they
 * parse.
 */
export declare const VERB_SCOPED_FLAGS: readonly {
    readonly flag: string;
    readonly verbs: readonly string[];
}[];
/**
 * `ineffectualFlagFor(verb, parsed)` — the D8 verb-scope check, pure so the
 * effectuality harness can enumerate it without spawning a process. Returns the
 * typed `INEFFECTUAL` error for the FIRST verb-scoped flag the invocation named
 * that this verb does not consume, or null when every named flag bites.
 *
 * The two long-standing reason spellings (`standing_without_check`,
 * `scan_ds_without_save_window`) are preserved; every other flag reports
 * `flag_not_effectual_on_verb` with `effectual_on` naming the live verb set.
 */
export declare function ineffectualFlagFor(verb: string, parsed: ParsedInvocation): LinelabError | null;
/**
 * Parses one verb's remaining argv into a `ComposeDraft` plus the
 * verb-agnostic controls every verb may accept. Deferred flags reject
 * immediately, before any other flag's value is inspected (see file banner).
 */
export declare function parseZeroFileFlags(argv: readonly string[]): Result<ParsedInvocation>;
/** Builds the zero-file `SolveInput`-shaped object `run()`/`solve()` sniff on `entry_kmh`. */
export declare function draftToComposedInput(draft: ComposeDraft): Record<string, unknown>;
/**
 * The flag-over-file merge law (design/08 §4.2): shallow-merges the draft's
 * SET fields on top of an already-loaded JSON object, field by field —
 * "a flag always overrides the corresponding loaded field." When no file was
 * loaded, this degrades to `draftToComposedInput`.
 */
export declare function mergeDraftOverLoaded(loaded: unknown, draft: ComposeDraft): Record<string, unknown>;
export {};
