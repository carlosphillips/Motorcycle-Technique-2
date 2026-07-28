// cli/doc/schema.ts — buildSchemaDoc() (design/08 §5.1/§5.1.1; ARCHITECTURE
// §5): pure, exported, byte-equal to `linelab schema` stdout (A-STATE-VERB
// pattern). Reads owning-module registries directly — never restates a
// closed set or a pin-table row (drift risk #12).
import { CHECK_IDS } from "../../plan/doctrine/checks.js";
import { loadShippedRubricPack, rubricString } from "../../plan/doctrine/pack.js";
import { CHECKS_VERSION } from "../../plan/doctrine/metrics.js";
import { CONFIG_RUBRIC_DEFAULT } from "../../plan/constants.js";
import { MISTAKE_KIND_DEFS, MISTAKE_KINDS, MISTAKE_PIN_TABLE } from "../../plan/mistakes.js";
import { PRESETS, PRESET_NAMES } from "../../road/presets.js";
import { SAMPLE_FIELDS, EVENT_KINDS, OUTCOMES, PHASES } from "../../core/types.js";
import { ERROR_CODES } from "../../core/result.js";
import { NO_SOLUTION_SUB_REASONS } from "../../solve/types.js";
import { FLAG_MAPPINGS } from "../args.js";
import { deferredFor, DEFERRED_TABLE } from "../deferred.js";
import { SWEEP_DEFAULT_METRICS, SWEEP_MAX_CELLS, SWEEP_METRICS, SWEEP_ROOTS } from "../verbs/sweep.js";
/**
 * design/08 §5.1 — the closed section list shipped in THIS phase. `sweep`
 * JOINED it when the `sweep` verb shipped (v0.2): "the printed schema is the
 * phase" (D8/D37), so a section cannot stay hidden behind a verb that runs.
 * `continuations` remains phase-gated (D45, §6.4).
 */
export const SHIPPED_SECTIONS = [
    "scenario", "plan", "road-dsl", "occluders", "hazards", "mistakes",
    "solve", "sweep", "scene", "figure", "view", "envelope", "rubric", "cli"
];
/** design/08 §5.1 — the FULL closed section list (incl. phase-gated names), for the pin-#18 error message. */
export const ALL_SECTIONS = [...SHIPPED_SECTIONS, "continuations"];
/** design/08 §5.1.1: "bumps on ANY section change" — v0.2 added the `sweep` section. */
export const SCHEMA_VERSION = 2;
// ---------------------------------------------------------------------------
// Section builders
function field(name, type, effect, schema_ref, extra) {
    return { name, type, effect, schema_ref, ...extra };
}
function scenarioSection() {
    return {
        name: "scenario",
        prose: "A wire Scenario ({spec:\"linelab/1\", id, road, occluders?, hazards?, rider, config?, expect_fail?, meta?}) is the explicit-plan input validate() accepts (design/03 §6). rider.start.speed_kmh is required, no default.",
        fields: [
            field("spec", "\"linelab/1\"", "identity literal", "scenario.spec", { required: true }),
            field("id", "string", "scenario identity, echoed into the envelope figure_id", "scenario.id", { required: true }),
            field("road", "RoadSpec", "one of segments|preset|dsl", "road-dsl", { required: true }),
            field("rider.start.speed_kmh", "number", "entry speed — REQUIRED, no default", "scenario.rider.start", { required: true }),
            field("rider.start.f", "number", "entry lane fraction", "scenario.rider.start", { default: 1.0 }),
            field("rider.profile", "casual|street|trained|racer", "control-law profile", "scenario.rider", { default: "street" }),
            field("rider.roll_rate_cap_dps", "number", "caps the profile roll rate", "scenario.rider"),
            field("rider.plan", "PlanAction[]", "the authored control plan", "plan"),
            field("config.mu", "number", "road-wide friction coefficient", "scenario.config", { default: 1.0 }),
            field("config.rubric", "\"parks-street\"", "the loaded doctrine pack", "rubric", { default: "parks-street" }),
            field("config.checks_version", "2", "the metric-code version", "rubric", { default: 2 }),
            field("expect_fail", "string[]", "check ids the applicable bar must NOT pass — the bidirectional rule", "envelope")
        ]
    };
}
function planSection() {
    return {
        name: "plan",
        prose: "design/03 §6.1 plan actions: brake, turn_in, throttle, position — each anchored via {at_s} or {ref, offset_m?} (the D32 anchor grammar).",
        fields: [
            field("do", "brake|turn_in|throttle|position", "the action's control channel", "plan", { required: true }),
            field("id", "string", "action id, addressed by sweep/mistake compounding", "plan", { required: true }),
            field("brake.decel", "number", "m/s^2, > 0", "plan"),
            field("turn_in.target", "{lean_deg}|\"tangent_inside\"", "the committed lean or solver-deferred", "plan"),
            field("throttle.accel", "number", "m/s^2, >= 0", "plan"),
            field("throttle.freeze_steer_s", "number", "steering freeze after this action's onset", "plan"),
            field("position.over_m", "number|\"auto\"", "station span the position action rides", "plan", { default: "auto" })
        ]
    };
}
function roadDslSection() {
    const grammar = [
        { token: "road-dsl", form: "lane <w> | S <len> | L|R <r> ^<deg> | L|R <r1>><r2> ^<deg>", example: "lane 3.5 | S 20 | R 25 ^90 | S 25" },
        { token: "road-ref", form: '"<road DSL>" | preset <name> [hand=L|R]', example: "preset book90 hand=R" }
    ];
    const presetFields = PRESET_NAMES.map((name) => {
        const p = PRESETS[name];
        return field(name, "preset", `default hand ${p.hand}, suggested entry ${p.suggested_entry_kmh} km/h`, "road-dsl", {
            default: p.dsl
        });
    });
    return {
        name: "road-dsl",
        prose: "One line, `|`-separated segments; `lane` appears exactly once, first. Presets print their full expansion at the default (book-ink) hand.",
        fields: presetFields,
        grammar
    };
}
function occludersSection() {
    return {
        name: "occluders",
        prose: "design/03 §4.1 band occluders (hedge|wall|bank) and the vehicle occluder, placed via the shared placement-token grammar.",
        fields: [
            field("kind", "hedge|wall|bank|vehicle", "occluder shape family", "occluders", { required: true }),
            field("side", "inside|outside|left|right", "band occluders only", "occluders"),
            field("at", "WireAnchor", "the D32 anchor grammar", "occluders", { required: true }),
            field("span_m", "number", "band occluders only", "occluders"),
            field("margin_m", "number", "clearance from the carriageway edge", "occluders"),
            field("lane", "own|oncoming", "vehicle occluder only", "occluders")
        ],
        grammar: [
            { token: "placement-token", form: "<kind> <side> <anchor> <offset>x<span> [<key>=<val>…]", example: "hedge inside entry:c1 -25x30 margin=1.0" },
            { token: "vehicle-token", form: "vehicle oncoming <anchor> <±offset>", example: "vehicle oncoming exit:c1 +8" }
        ]
    };
}
function hazardsSection() {
    return {
        name: "hazards",
        prose: "design/03 §4.2 — the gravel hazard, placed via the same band placement-token grammar as occluders.",
        fields: [
            field("kind", "\"gravel\"", "the one v0.1 hazard kind", "hazards", { required: true }),
            field("side", "inside|outside|left|right|center", "lateral placement", "hazards", { required: true }),
            field("at", "WireAnchor", "the D32 anchor grammar", "hazards", { required: true }),
            field("span_m", "number", "station span", "hazards", { required: true }),
            field("width_m", "number", "lateral width", "hazards", { default: 1.4 }),
            field("mu", "number", "local friction over the patch", "hazards", { default: 0.4 })
        ],
        grammar: [{ token: "placement-token", form: "gravel <side> <anchor> <offset>x<span> [width=][mu=]", example: "gravel outside exit:c1 2x8 mu=0.35" }]
    };
}
function mistakesSection() {
    const kinds = MISTAKE_KINDS.map((kind) => {
        const def = MISTAKE_KIND_DEFS[kind];
        const pinRow = MISTAKE_PIN_TABLE.find((r) => r.kind === kind && r.scope === undefined);
        return {
            kind,
            params: def.params.map((p) => field(p.name, "number|string", p.note, "mistakes", {
                ...(p.default !== undefined ? { default: p.default } : {}),
                ...(p.units !== undefined ? { units: p.units } : {})
            })),
            admissible_outcomes: pinRow?.admissible_outcomes ?? [],
            fixture_pin: pinRow?.fixture_pin ?? "",
            book_figure: def.book_mapping,
            note: def.perturbation
        };
    });
    return {
        name: "mistakes",
        prose: "design/03 §7.1's pin table, printed verbatim from the single machine-readable source plan/mistakes.ts — the schema, the compiler, and the oracle can never disagree.",
        kinds,
        grammar: [
            { token: "mistake-token", form: '[<line_id> "="] <kind> [":" params] ["@" scope]', example: "chop:offset_m=8,freeze_s=1.5@c2" }
        ]
    };
}
function solveSection() {
    return {
        name: "solve",
        prose: "design/04's intent surface (D10): the solver-layer fields that trigger run's delegate-to-solve rule.",
        fields: [
            field("entry_kmh", "number", "entry speed", "solve", { required: true }),
            field("turn_in", "\"auto\"|number", "auto-solved or a fixed station", "solve", { default: "auto" }),
            field("style", "single|double_apex|geometric", "solve strategy", "solve", { default: "single" }),
            field("vis", "none|cautious", "visibility-governed mode", "solve", { default: "none" }),
            field("vis_hold_f", "number", "the hold-wide lane-fraction target under vis=cautious", "solve"),
            field("vis_margin", "number", "stopping-distance standoff multiplier under vis=cautious", "solve", { default: 1.4 }),
            field("believed_road", "RoadSpec|string", "believed-road misjudge solving (04 §4.6)", "solve"),
            field("accept", "clean|best_failing", "acceptance policy (04 §4.7)", "solve", { default: "clean" }),
            field("constraints", "Constraint[]", "the compact bound grammar (04 §4.5)", "solve")
        ],
        grammar: [{ token: "constraint-token", form: "<f|v_kmh|sight_margin_m><>=|<=><value>@<span>", example: "f>=0.6@entry:c1..mid:c1" }]
    };
}
/**
 * design/08 §5.1: "The sweep section prints the root set, each root's
 * hold-fixed semantics, and the metric vocabulary with its sourcing rules
 * (§4.3)." Every closed set here is READ from `cli/verbs/sweep.ts`, the owning
 * module — the section restates no vocabulary (drift risk #12).
 */
function sweepSection() {
    const holdFixed = {
        plan: "engine run only — the plan is explicit, the solver is bypassed (base = the line's resolved_scenario); everything else and all other lines held fixed",
        scenario: "figure-wide: re-solves every line at the new rider.start scalar; road, config, plan intent held fixed",
        config: "figure-wide: re-solves every line at the new mu; road, rider and plan intent held fixed",
        ride: "re-solves the --line-selected solver line at the new intent scalar; road, scenario and every other line held fixed",
        mistake: "re-compiles the named mistake line off its unchanged base; the base line's solve is held fixed",
        constraint: "re-solves the --line-selected line under the moved bound; a NO_SOLUTION cell is recorded as outcome:\"no_solution\" in that cell — never a verb failure",
        believe: "re-runs the believed-road pipeline at the new belief; the ACTUAL road is held fixed (04 §4.6)"
    };
    const metricSourcing = {
        outcome: "verdict.outcome",
        apex_pct: "the FINAL entry of the addressed corner's corners[].apexes[] list (05 §6.3) — null when the list is empty",
        apex_f: "the FINAL entry of the addressed corner's corners[].apexes[] list — null when the list is empty",
        v_apex_kmh: "the FINAL entry of the addressed corner's corners[].apexes[] list — null when the list is empty",
        lean_max_deg: "max over corners[].lean_max_deg",
        grip_min: "min over corners[].grip_min",
        exit_f: "the last corner row's exit.f",
        sight_margin_min_m: "verdict.sight.margin_min_m",
        end_s: "trajectory.terminated.s",
        end_reason: "trajectory.terminated.reason",
        acceptance_met: "the line's acceptance verdict under the active accept policy",
        apex_count: "the addressed corner's apexes[].length",
        s_divergence_m: "verdict.misjudgment.s_divergence_m"
    };
    return {
        name: "sweep",
        prose: "design/08 §4.3: `sweep` addresses the whole composed input through a CLOSED root set (D34) — never bare array indices — and reports one row per grid cell. 1–2 --params; grids larger than sweep_max_cells = " +
            `${SWEEP_MAX_CELLS} (TUNING) are truncated with truncated:true, keeping the first cells in row-major (param-1 outer) order. --format tsv requires --out; stdout stays the one JSON document.`,
        fields: [
            ...SWEEP_ROOTS.map((root) => field(`${root}.`, "sweep-root", holdFixed[root], "sweep")),
            ...SWEEP_METRICS.map((m) => field(m, "metric", metricSourcing[m], "sweep", {
                ...(SWEEP_DEFAULT_METRICS.includes(m) ? { default: true } : {})
            }))
        ],
        grammar: [
            { token: "plan.", form: "plan.<actionId>.<field>", example: "plan.b1.decel" },
            { token: "scenario.", form: "scenario.(entry_kmh|start_f)", example: "scenario.entry_kmh" },
            { token: "config.", form: "config.mu", example: "config.mu" },
            { token: "ride.", form: "ride.(vis_margin|vis_hold_f|turn_in_s)", example: "ride.vis_margin" },
            { token: "mistake.", form: "mistake.<lineId>.<param>", example: "mistake.bad.early_by_m" },
            { token: "constraint.", form: "constraint.<constraintId>.value", example: "constraint.c_apex.value" },
            { token: "believe.", form: "believe.(r_believed|sweep_believed_deg)", example: "believe.r_believed" },
            { token: "--range", form: "<from>:<to>:<step>", example: "30:44:2" }
        ]
    };
}
function sceneSection() {
    return {
        name: "scene",
        prose: "design/04 §7's scene-text grammar (D30 sugar over FigureSpec JSON): top-level keys road/lines/occluders/hazards/marks/labels/view/note/placards; `lines:`/`labels:`/`placards:` entries indented. lowerScene is the pure, total lowering.",
        grammar: [
            { token: "ride-line", form: "<name>: ride entry=<kmh> [turnIn=][style=][vis=][visHold=][visMargin=][believeRoad=][accept=][startF=][constraints=][role=][label=][marks=]", example: 'good: ride entry=34 turnIn=auto' },
            { token: "mistake-line", form: "<name>: mistake <mistake-token>", example: "bad: mistake premature" }
        ]
    };
}
function figureSection() {
    return {
        name: "figure",
        prose: "design/03 §8/D30 — the canonical FigureSpec JSON: {road, occluders?, hazards?, lines: [{name, role, spec, marks?, label?}], labels?, marks?, view?, note?, placards?}. Scene text lowers onto this exact shape.",
        fields: [
            field("lines[].name", "string", "line id — 1..N, order = draw order", "figure", { required: true }),
            field("lines[].role", "ideal|alternative|mistake|reference", "legend label only — never gates (D9)", "figure", { required: true }),
            field("lines[].spec", "SolveSpec|MistakeSpec|Scenario", "structurally discriminated by entry_kmh|kind|spec", "figure", { required: true }),
            // design/03 §8 scopes the MarkSpec "at figure and per-line"; design/04 §7
            // spells the per-line half as the ride key `marks=`. Both per-line keys
            // are OMITTED when unauthored — spec_hash covers the lowered form (D30).
            field("lines[].marks", "auto|all|none|MarkClass[]", "per-line MarkSpec — overrides the figure-level `marks` for THIS line", "figure"),
            field("lines[].label", "string", "legend text for this line (design/05 §7); absent, the solver's own label stands", "figure"),
            field("marks", "auto|all|none|MarkClass[]", "marker classes drawn", "figure", { default: "auto" }),
            field("note", "string", "figure caption", "figure"),
            field("placards", "string[]", "figure-level placard boxes, drawn in order at 06 §3.1 stage 11", "figure")
        ]
    };
}
function viewSection() {
    return {
        name: "view",
        prose: "design/06 §2.1 — the ViewSpec surface: mode (\"true\" only — \"diagram\" is deferred, ARCHITECTURE §6.5/§6.4), window, orient, rays, legend, and look (the pov camera toggle, design/07 §5.2 — shipped with immersion, v0.3).",
        fields: [
            field("mode", "\"true\"", "the v0.1 top-down projection", "view", { default: "true" }),
            field("window", "auto|all|{from,to}", "station crop", "view", { default: "auto" }),
            field("orient", "auto|0|90|180|270", "rotation only — never a mirror (D26: handedness lives on the road)", "view", { default: "auto" }),
            field("rays", "auto|off|all_turn_ins", "sight-ray drawing", "view", { default: "auto" }),
            field("legend", "auto|on|off", "legend visibility", "view", { default: "auto" }),
            field("look", "heading|limit_point", "pov camera aim (design/07 §5.2) — ignored by topdown/controls", "view", { default: "heading" })
        ]
    };
}
function envelopeSection() {
    return {
        name: "envelope",
        prose: "design/05 — output shapes. Sample field order (= trace CSV column order), the closed event-kind set, the closed outcome/phase sets, and the closed 8-code error vocabulary, each printed verbatim from their one owning declaration.",
        fields: [
            field("Sample", SAMPLE_FIELDS.join(","), "the pinned per-metre record, angles in degrees", "envelope"),
            field("EventKind", EVENT_KINDS.join("|"), "the closed event vocabulary, declaration order = tie-break order", "envelope"),
            field("Outcome", OUTCOMES.join("|"), "closed, precedence order crash>runoff>wide>stopped>contained", "envelope"),
            field("Phase", PHASES.join("|"), "closed five-token phase set", "envelope"),
            field("ErrorCode", ERROR_CODES.join("|"), "the closed 8-code error vocabulary", "envelope"),
            field("NO_SOLUTION.sub_reason", NO_SOLUTION_SUB_REASONS.join("|"), "rides detail.sub_reason, never detail.reason", "envelope")
        ]
    };
}
function rubricSection(pack) {
    return {
        name: "rubric",
        prose: `The active doctrine pack (design/01 §A.6): ${rubricString(pack)}, requires_checks_version ${pack.requires_checks_version}. Check thresholds/bands are pack DATA — code owns only the metric arithmetic (checks_version ${CHECKS_VERSION}).`,
        fields: CHECK_IDS.map((id) => {
            const row = pack.checks.find((c) => c.id === id);
            return field(id, "CheckResult", row?.teaches ?? "", "rubric", { required: false });
        })
    };
}
function cliSection() {
    return {
        name: "cli",
        prose: "The cross-surface spelling table (design/08 §4.1): one row per wire field, bijective with the runtime flag parser (cli/args.ts FLAG_TABLE — one source, so this section and the parser can never disagree).",
        flags: FLAG_MAPPINGS
    };
}
// ---------------------------------------------------------------------------
// buildSchemaDoc — pure, exported (ARCHITECTURE §5)
function allSections() {
    const packR = loadShippedRubricPack(CONFIG_RUBRIC_DEFAULT);
    const pack = packR.ok ? packR.value : undefined;
    return {
        scenario: scenarioSection(),
        plan: planSection(),
        "road-dsl": roadDslSection(),
        occluders: occludersSection(),
        hazards: hazardsSection(),
        mistakes: mistakesSection(),
        solve: solveSection(),
        sweep: sweepSection(),
        scene: sceneSection(),
        figure: figureSection(),
        view: viewSection(),
        envelope: envelopeSection(),
        rubric: pack !== undefined ? rubricSection(pack) : { name: "rubric", prose: "unavailable" },
        cli: cliSection()
    };
}
/**
 * `buildSchemaDoc(section?) → {ok:true,value:SchemaDoc} | {ok:false,error}`
 * (design/08 §5.1.1; ARCHITECTURE §5). Unknown section → typed `SCHEMA` naming
 * the closed list (pin #18); a phase-gated section name → `SCHEMA`+`deferred`.
 */
export function buildSchemaDoc(section) {
    const packR = loadShippedRubricPack(CONFIG_RUBRIC_DEFAULT);
    const rubric = packR.ok ? rubricString(packR.value) : `${CONFIG_RUBRIC_DEFAULT}/0`;
    const sections = allSections();
    if (section === undefined) {
        return {
            ok: true,
            value: { schema_version: SCHEMA_VERSION, engine: "linelab/1", rubric, checks_version: CHECKS_VERSION, sections }
        };
    }
    if (SHIPPED_SECTIONS.includes(section)) {
        const one = { [section]: sections[section] };
        return {
            ok: true,
            value: { schema_version: SCHEMA_VERSION, engine: "linelab/1", rubric, checks_version: CHECKS_VERSION, sections: one }
        };
    }
    const deferred = deferredFor(section);
    if (deferred !== undefined || section === "continuations") {
        const phase = deferred ?? "continuation envelope (D45)";
        return {
            ok: false,
            error: {
                code: "SCHEMA",
                at: "schema.section",
                message: `schema section "${section}" is not shipped in this phase`,
                deferred: phase,
                detail: { reason: "deferred" }
            }
        };
    }
    return {
        ok: false,
        error: {
            code: "SCHEMA",
            at: "schema.section",
            message: `unknown schema section "${section}" (known: ${ALL_SECTIONS.join(", ")})`,
            detail: { reason: "schema_unknown_section", sections: ALL_SECTIONS }
        }
    };
}
export { DEFERRED_TABLE };
//# sourceMappingURL=schema.js.map